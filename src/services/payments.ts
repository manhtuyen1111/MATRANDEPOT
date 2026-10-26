import {
  FeeLineItem,
  DirectPaymentMethod,
  MasterPrepaidReceipt,
  PaymentCategory,
  PaymentReceipt,
  PaymentTransaction,
  PaymentVoucher,
  ReceiptOperation,
} from '../types/depot';
import { allocateCode } from './codes';
import { generateInvoiceSecret } from './invoice';
import { appendAudit, assertPermission, newId, nowIso, SYSTEM_ACTOR } from './core';
import type { DepotState } from './depotStore';

// ============================================================================
// TÀI CHÍNH: CHỨNG TỪ PHẢI THU → GIAO DỊCH THU TIỀN → PHIẾU THU (DEC-031, DEC-032)
//  - TTT : trừ dần Phiếu thu trả trước đã ACTIVE. Không phát hành phiếu thu mới (tiền đã thu khi nạp quỹ).
//  - TTS : ghi chú TTS, chứng từ DEFERRED (công nợ). Không phát hành phiếu thu.
//  - TTTT Tiền mặt     : người có quyền xác nhận đã nhận tiền → giao dịch SUCCEEDED → phiếu thu.
//  - TTTT Chuyển khoản : tạo yêu cầu (QR) ở trạng thái PENDING; chỉ SUCCEEDED khi có callback
//                        ngân hàng hợp lệ (chống xử lý lặp theo mã giao dịch ngân hàng).
// ============================================================================

export interface SettleVoucherInput {
  paymentCategory: PaymentCategory;
  scannedQrCode?: string;
  ttsNote?: string;
  directMethod?: DirectPaymentMethod;
}

export type SettleOutcome = 'SETTLED' | 'AWAITING_TRANSFER';

export function isVoucherSettled(v?: PaymentVoucher): boolean {
  return v?.status === 'CONFIRMED' || v?.status === 'DEFERRED';
}

export function paymentLabelOf(v: PaymentVoucher): string {
  if (v.status === 'DEFERRED') return `TTS (${v.ttsNote || 'Thanh toán sau'})`;
  if (v.paymentCategory === 'TTT') return `TTT (Đã trừ Phiếu thu trả trước ${v.masterReceiptCode || ''})`.trim();
  if (v.paymentCategory === 'TTTT') {
    return `TTTT (${v.directMethod === 'BANK_TRANSFER_API' ? 'Chuyển khoản API' : 'Tiền mặt'})`;
  }
  return 'Chưa thanh toán';
}

export function pendingTransactionOf(state: DepotState, voucherId: string): PaymentTransaction | undefined {
  return state.paymentTransactions.find(
    (t) => t.purpose === 'VOUCHER' && t.voucherId === voucherId && t.status === 'PENDING'
  );
}

function transferQrPayload(paymentRef: string, amount: number): string {
  return `MATRANDEPOT|${paymentRef}|${amount}`;
}

function updateVoucher(state: DepotState, id: string, patch: Partial<PaymentVoucher>): DepotState {
  return { ...state, vouchers: state.vouchers.map((v) => (v.id === id ? { ...v, ...patch } : v)) };
}

function updateTransaction(state: DepotState, id: string, patch: Partial<PaymentTransaction>): DepotState {
  return {
    ...state,
    paymentTransactions: state.paymentTransactions.map((t) => (t.id === id ? { ...t, ...patch } : t)),
  };
}

function updateMaster(state: DepotState, id: string, patch: Partial<MasterPrepaidReceipt>): DepotState {
  return {
    ...state,
    masterReceipts: state.masterReceipts.map((r) => (r.id === id ? { ...r, ...patch } : r)),
  };
}

// Phát hành PHIẾU THU cho một giao dịch thành công — tối đa 1 phiếu / giao dịch
// DEC-113: NGƯỜI THU TIỀN trên phiếu luôn là nhân viên tác nghiệp — ngân hàng / hệ thống chỉ là công cụ xác nhận.
//   Khi ngân hàng báo có → lấy nhân viên Văn phòng đã lập yêu cầu thu (tx.createdBy).
export function receiptCollectorName(state: DepotState, r: { issuedBy: string; transactionId: string }): string {
  if (!r.issuedBy.startsWith(SYSTEM_ACTOR)) return r.issuedBy;
  return state.paymentTransactions.find((t) => t.id === r.transactionId)?.createdBy || r.issuedBy;
}

function issueReceipt(state: DepotState, transactionId: string, issuedBy: string): DepotState {
  const tx = state.paymentTransactions.find((t) => t.id === transactionId);
  if (!tx || tx.status !== 'SUCCEEDED') {
    throw new Error('Chỉ phát hành phiếu thu cho giao dịch đã thanh toán thành công.');
  }
  if (tx.receiptId || state.paymentReceipts.some((r) => r.transactionId === tx.id)) return state;

  // DEC-098: mã phiếu thu cho biết hình thức + ngày thu
  // DEC-124: phiếu nạp trả trước dùng lại mã PT-TTR- đã cấp khi tạo (dữ liệu cũ mã PTT- → cấp PT-TTR- mới)
  const topupMaster = tx.purpose === 'PREPAID_TOPUP' ? state.masterReceipts.find((m) => m.id === tx.masterReceiptId) : undefined;
  const allocated = topupMaster?.receiptCode.startsWith('PT-TTR-')
    ? { code: topupMaster.receiptCode, state }
    : allocateCode(state, tx.purpose === 'PREPAID_TOPUP' ? 'PT-TTR' : 'PT-TT');
  const voucher = tx.voucherId ? allocated.state.vouchers.find((v) => v.id === tx.voucherId) : undefined;
  const master = tx.masterReceiptId
    ? allocated.state.masterReceipts.find((r) => r.id === tx.masterReceiptId)
    : undefined;
  const receipt: PaymentReceipt = {
    id: newId('pt'),
    receiptNo: allocated.code,
    transactionId: tx.id,
    purpose: tx.purpose,
    operation: receiptOperationOf(allocated.state, { purpose: tx.purpose, voucherId: tx.voucherId }),
    amount: tx.amount,
    method: tx.method,
    paymentCategory: tx.paymentCategory,
    voucherId: voucher?.id,
    voucherNo: voucher?.voucherNo,
    masterReceiptId: master?.id,
    masterReceiptCode: master?.receiptCode,
    dossierCode: tx.dossierCode,
    containerNo: tx.containerNo,
    payerName: tx.payerName,
    providerTxRef: tx.providerTxRef,
    issuedAt: nowIso(),
    issuedBy: issuedBy.startsWith(SYSTEM_ACTOR) ? tx.createdBy || issuedBy : issuedBy, // DEC-113
    // DEC-111: mã bảo mật xuất hóa đơn — duy nhất trong toàn bộ phiếu thu
    invoiceSecret: generateInvoiceSecret(allocated.state.paymentReceipts.map((r) => r.invoiceSecret || '')),
    invoiceStatus: 'CHUA_XHD',
  };
  const next = updateTransaction(
    { ...allocated.state, paymentReceipts: [receipt, ...allocated.state.paymentReceipts] },
    tx.id,
    { receiptId: receipt.id }
  );
  return next;
}

// Áp dụng kết quả thu tiền thành công lên chứng từ / phiếu thu trả trước
function applySucceededTransaction(state: DepotState, tx: PaymentTransaction, actorName: string): DepotState {
  let next = issueReceipt(state, tx.id, actorName);
  if (tx.purpose === 'VOUCHER' && tx.voucherId) {
    next = updateVoucher(next, tx.voucherId, {
      paymentCategory: 'TTTT',
      directMethod: tx.method,
      providerTxRef: tx.providerTxRef,
      status: 'CONFIRMED',
      confirmedBy: actorName,
      confirmedAt: nowIso(),
    });
  }
  if (tx.purpose === 'PREPAID_TOPUP' && tx.masterReceiptId) {
    const master = next.masterReceipts.find((r) => r.id === tx.masterReceiptId);
    if (master && master.status === 'PENDING_PAYMENT') {
      next = updateMaster(next, master.id, {
        status: 'ACTIVE',
        remainingAmount: master.totalAmount,
        activatedAt: nowIso(),
      });
    }
  }
  return next;
}

// Thanh toán một chứng từ PENDING theo 1 trong 3 trường hợp TTT / TTS / TTTT
export function settleVoucher(
  state: DepotState,
  voucherId: string,
  input: SettleVoucherInput
): { state: DepotState; outcome: SettleOutcome } {
  assertPermission(state, 'PAYMENT_CONFIRM', 'chỉ Văn phòng / Quản lý được xác nhận khoản thu.');
  const voucher = state.vouchers.find((v) => v.id === voucherId);
  if (!voucher) throw new Error('Không tìm thấy chứng từ thanh toán.');
  if (voucher.status !== 'PENDING') {
    throw new Error(`Chứng từ ${voucher.voucherNo} đang ở trạng thái ${voucher.status}, không thể thanh toán lại.`);
  }
  if (pendingTransactionOf(state, voucher.id)) {
    throw new Error(
      `Chứng từ ${voucher.voucherNo} đang chờ kết quả chuyển khoản. Hủy yêu cầu chuyển khoản trước khi đổi hình thức thanh toán.`
    );
  }
  if (voucher.amount <= 0) {
    throw new Error('Chứng từ chưa có chi phí hợp lệ (phải chọn ít nhất 1 biểu giá).');
  }
  const actor = state.currentUser.fullName;

  // DEC-093: khách ngoài Danh mục (tên gõ tự do) chỉ được thanh toán trực tiếp (Tiền mặt / Chuyển khoản)
  if (input.paymentCategory === 'TTT' || input.paymentCategory === 'TTS') {
    const payer = voucher.payerName.trim().toLowerCase();
    if (!state.partners.some((p) => p.isCustomer && p.name.toLowerCase() === payer)) {
      throw new Error(
        `Khách hàng "${voucher.payerName}" chưa có trong Danh mục — chỉ thanh toán TRỰC TIẾP (Tiền mặt / Chuyển khoản), không dùng ${input.paymentCategory}.`
      );
    }
  }

  if (input.paymentCategory === 'TTT') {
    const qr = (input.scannedQrCode || '').trim().toUpperCase();
    if (!qr) throw new Error('TRẢ TRƯỚC (TTR): Vui lòng quét mã QR của Phiếu thu trả trước vào chứng từ.');
    const master = state.masterReceipts.find((r) => r.qrCode.toUpperCase() === qr);
    if (!master) throw new Error(`Mã QR "${qr}" không tồn tại.`);
    if (master.status === 'PENDING_PAYMENT') {
      throw new Error(`Phiếu thu trả trước ${master.receiptCode} chưa được thu tiền nạp quỹ, chưa thể trừ dần.`);
    }
    if (master.status !== 'ACTIVE') throw new Error(`Phiếu thu trả trước ${master.receiptCode} không còn hiệu lực.`);
    if (master.remainingAmount < voucher.amount) {
      throw new Error(
        `Số dư Phiếu thu trả trước ${master.receiptCode} (${master.remainingAmount.toLocaleString('vi-VN')}đ) không đủ để trừ khoản thu (${voucher.amount.toLocaleString('vi-VN')}đ).`
      );
    }
    const balanceAfter = master.remainingAmount - voucher.amount;
    let next = updateMaster(state, master.id, {
      remainingAmount: balanceAfter,
      status: balanceAfter === 0 ? 'EXHAUSTED' : 'ACTIVE',
    });
    next = {
      ...next,
      receiptDeductions: [
        {
          id: newId('ded'),
          receiptCode: master.receiptCode,
          qrCode: master.qrCode,
          voucherNo: voucher.voucherNo,
          containerNo: voucher.containerNo,
          deductedAmount: voucher.amount,
          balanceBefore: master.remainingAmount,
          balanceAfter,
          performedBy: actor,
          performedAt: nowIso(),
        },
        ...next.receiptDeductions,
      ],
    };
    next = updateVoucher(next, voucher.id, {
      paymentCategory: 'TTT',
      directMethod: undefined,
      scannedQrCode: qr,
      masterReceiptCode: master.receiptCode,
      status: 'CONFIRMED',
      confirmedBy: actor,
      confirmedAt: nowIso(),
    });
    return { state: next, outcome: 'SETTLED' };
  }

  if (input.paymentCategory === 'TTS') {
    const note = input.ttsNote?.trim();
    if (!note) throw new Error('THANH TOÁN SAU (TTS): Phải ghi chú (Note) xác nhận TTS trên chứng từ.');
    const next = updateVoucher(state, voucher.id, {
      paymentCategory: 'TTS',
      directMethod: undefined,
      ttsNote: `TTS - ${note}`,
      status: 'DEFERRED',
      confirmedBy: actor,
      confirmedAt: nowIso(),
    });
    return { state: next, outcome: 'SETTLED' };
  }

  // TTTT — Thanh toán trực tiếp
  if (!input.directMethod) {
    throw new Error('TRỰC TIẾP (TT): Phải chọn Chuyển khoản (API QR) hoặc Tiền mặt.');
  }
  const tx: PaymentTransaction = {
    id: newId('tx'),
    paymentRef: voucher.voucherNo,
    purpose: 'VOUCHER',
    voucherId: voucher.id,
    dossierCode: voucher.referenceCode,
    containerNo: voucher.containerNo,
    payerName: voucher.payerName,
    method: input.directMethod,
    paymentCategory: 'TTTT',
    amount: voucher.amount,
    status: 'PENDING',
    createdBy: actor,
    createdAt: nowIso(),
  };

  if (input.directMethod === 'CASH') {
    // Người có quyền bấm xác nhận "đã nhận tiền mặt" là căn cứ thu tiền thực tế
    const succeeded: PaymentTransaction = { ...tx, status: 'SUCCEEDED', confirmedBy: actor, confirmedAt: nowIso() };
    let next: DepotState = { ...state, paymentTransactions: [succeeded, ...state.paymentTransactions] };
    next = applySucceededTransaction(next, succeeded, actor);
    return { state: next, outcome: 'SETTLED' };
  }

  const pending: PaymentTransaction = { ...tx, qrPayload: transferQrPayload(tx.paymentRef, tx.amount) };
  let next: DepotState = { ...state, paymentTransactions: [pending, ...state.paymentTransactions] };
  next = updateVoucher(next, voucher.id, { paymentCategory: 'TTTT', directMethod: 'BANK_TRANSFER_API' });
  next = appendAudit(
    next,
    'PAYMENT_TRANSFER_REQUESTED',
    'FINANCE',
    voucher.voucherNo,
    `Tạo yêu cầu chuyển khoản QR cho chứng từ ${voucher.voucherNo} (${voucher.amount.toLocaleString('vi-VN')}đ) — chờ ngân hàng xác nhận`,
    voucher.masterDossierCode
  );
  return { state: next, outcome: 'AWAITING_TRANSFER' };
}

export interface BankCallbackInput {
  paymentRef: string;
  providerTxRef: string;
  amount: number;
  success: boolean;
}

// Xử lý kết quả ngân hàng (webhook đã xác minh chữ ký ở backend). Gửi lặp cùng providerTxRef không ghi nhận lại.
export function applyBankCallback(
  state: DepotState,
  input: BankCallbackInput
): { state: DepotState; transaction?: PaymentTransaction; alreadyProcessed: boolean } {
  const ref = input.providerTxRef.trim();
  if (!ref) throw new Error('Thiếu mã giao dịch ngân hàng.');
  const processed = state.paymentTransactions.find((t) => t.providerTxRef === ref);
  if (processed) return { state, transaction: processed, alreadyProcessed: true };

  const tx = state.paymentTransactions.find(
    (t) => t.paymentRef === input.paymentRef && t.method === 'BANK_TRANSFER_API' && t.status === 'PENDING'
  );
  if (!tx) throw new Error(`Không có yêu cầu chuyển khoản đang chờ cho mã ${input.paymentRef}.`);
  if (Number(input.amount) !== tx.amount) {
    throw new Error(
      `Số tiền ngân hàng báo (${Number(input.amount).toLocaleString('vi-VN')}đ) không khớp yêu cầu (${tx.amount.toLocaleString('vi-VN')}đ).`
    );
  }
  const actorName = `${SYSTEM_ACTOR} (Ngân hàng)`;
  const updated: PaymentTransaction = {
    ...tx,
    status: input.success ? 'SUCCEEDED' : 'FAILED',
    providerTxRef: ref,
    confirmedBy: actorName,
    confirmedAt: nowIso(),
  };
  let next = updateTransaction(state, tx.id, updated);
  if (input.success) next = applySucceededTransaction(next, updated, actorName);
  next = appendAudit(
    next,
    input.success ? 'PAYMENT_TRANSFER_SUCCEEDED' : 'PAYMENT_TRANSFER_FAILED',
    'FINANCE',
    tx.paymentRef,
    `Ngân hàng báo ${input.success ? 'THÀNH CÔNG' : 'THẤT BẠI'} giao dịch ${ref} cho ${tx.paymentRef} (${tx.amount.toLocaleString('vi-VN')}đ)`,
    tx.dossierCode,
    { name: actorName, role: 'SYSTEM' }
  );
  return {
    state: next,
    transaction: next.paymentTransactions.find((t) => t.id === tx.id),
    alreadyProcessed: false,
  };
}

// Hủy một yêu cầu thu tiền đang chờ (chưa thu được tiền)
export function cancelPendingTransaction(
  state: DepotState,
  input: { transactionId: string; reason: string }
): DepotState {
  const tx = state.paymentTransactions.find((t) => t.id === input.transactionId);
  if (!tx) throw new Error('Không tìm thấy giao dịch.');
  assertPermission(
    state,
    tx.purpose === 'PREPAID_TOPUP' ? 'PREPAID_CASH_CONFIRM' : 'PAYMENT_CONFIRM',
    'không được hủy yêu cầu thanh toán này.'
  );
  if (tx.status !== 'PENDING') throw new Error('Chỉ hủy được giao dịch đang chờ thanh toán.');
  if (!input.reason.trim()) throw new Error('Bắt buộc nhập lý do hủy yêu cầu thanh toán.');

  let next = updateTransaction(state, tx.id, { status: 'CANCELLED', cancelReason: input.reason.trim() });
  if (tx.purpose === 'VOUCHER' && tx.voucherId) {
    next = updateVoucher(next, tx.voucherId, { paymentCategory: undefined, directMethod: undefined });
  }
  if (tx.purpose === 'PREPAID_TOPUP' && tx.masterReceiptId) {
    next = updateMaster(next, tx.masterReceiptId, { status: 'CANCELLED' });
  }
  return appendAudit(
    next,
    'PAYMENT_REQUEST_CANCELLED',
    'FINANCE',
    tx.paymentRef,
    `Hủy yêu cầu thanh toán ${tx.paymentRef} (${tx.amount.toLocaleString('vi-VN')}đ). Lý do: ${input.reason.trim()}`,
    tx.dossierCode
  );
}

// KẾ TOÁN tạo PHIẾU THU TTT (nạp Phiếu thu trả trước) tại menu PHIẾU THU — chưa ghi nhận đã thu tiền
export function createMasterPrepaidReceipt(
  state: DepotState,
  input: {
    customerCode: string;
    lotDescription: string;
    totalAmount?: number;
    method: DirectPaymentMethod;
    // DEC-077: chọn từ BIỂU GIÁ kèm SỐ LƯỢNG — tổng tiền do hệ thống tính (đơn giá × số lượng)
    feeItems?: { catalogId: string; quantity: number }[];
  }
): DepotState {
  assertPermission(state, 'PREPAID_RECEIPT_CREATE', 'chỉ Văn phòng được tạo phiếu thu TTR (Trả trước).');
  const partner = state.partners.find((p) => p.code === input.customerCode.trim().toUpperCase());
  if (!partner) throw new Error('Vui lòng chọn khách hàng / đối tác thanh toán từ Danh mục chung.');
  const feeLines = input.feeItems?.length ? buildPrepaidFeeLines(state, input.feeItems) : undefined;
  const amount = feeLines ? feeLines.reduce((s, l) => s + l.amountInclVat, 0) : Number(input.totalAmount);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error('Số tiền nạp trước phải lớn hơn 0.');
  if (input.method !== 'CASH' && input.method !== 'BANK_TRANSFER_API') {
    throw new Error('Chọn hình thức thanh toán: Chuyển khoản (API QR) hoặc Tiền mặt.');
  }

  // DEC-124: MỘT mã duy nhất — cấp PT-TTR-YYMMDD-NNNN ngay khi tạo (CHỜ THANH TOÁN); thu xong chính mã này là phiếu thu.
  //   QR trừ dần = QR-<mã>; mã cũng là nội dung chuyển khoản. Không còn cấp PTT-.
  const allocated = allocateCode(state, 'PT-TTR');
  const qrCode = `QR-${allocated.code}`;
  const master: MasterPrepaidReceipt = {
    id: newId('mpr'),
    receiptCode: allocated.code,
    qrCode,
    customerCode: partner.code,
    customerName: partner.name,
    lotDescription: input.lotDescription.trim() || 'Thanh toán trước 1 lô container',
    totalAmount: amount,
    remainingAmount: 0,
    status: 'PENDING_PAYMENT',
    paymentMethod: input.method,
    feeLines,
    createdBy: state.currentUser.fullName,
    createdAt: nowIso(),
  };
  const tx: PaymentTransaction = {
    id: newId('tx'),
    paymentRef: master.receiptCode,
    purpose: 'PREPAID_TOPUP',
    masterReceiptId: master.id,
    payerName: partner.name,
    method: input.method,
    paymentCategory: 'TTT',
    amount,
    status: 'PENDING',
    qrPayload: input.method === 'BANK_TRANSFER_API' ? transferQrPayload(master.receiptCode, amount) : undefined,
    createdBy: state.currentUser.fullName,
    createdAt: nowIso(),
  };
  const next: DepotState = {
    ...allocated.state,
    masterReceipts: [master, ...allocated.state.masterReceipts],
    paymentTransactions: [tx, ...allocated.state.paymentTransactions],
  };
  return appendAudit(
    next,
    'CREATE_MASTER_RECEIPT_TTT',
    'FINANCE',
    master.receiptCode,
    `Tạo phiếu thu TTR ${master.receiptCode} cho ${partner.name}: ${amount.toLocaleString('vi-VN')}đ (${
      input.method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản QR'
    }) — Chờ thanh toán`
  );
}

// KẾ TOÁN xác nhận đã nhận TIỀN MẶT cho phiếu thu TTT (nạp Phiếu thu trả trước)
export function confirmPrepaidCash(state: DepotState, input: { transactionId: string }): DepotState {
  assertPermission(state, 'PREPAID_CASH_CONFIRM', 'chỉ Văn phòng được xác nhận đã thu tiền mặt.');
  const tx = state.paymentTransactions.find((t) => t.id === input.transactionId);
  if (!tx || tx.purpose !== 'PREPAID_TOPUP') throw new Error('Không tìm thấy phiếu thu TTR cần xác nhận.');
  if (tx.method !== 'CASH') throw new Error('Phiếu chuyển khoản chỉ được xác nhận bằng kết quả từ ngân hàng.');
  if (tx.status !== 'PENDING') throw new Error('Giao dịch không còn ở trạng thái chờ thanh toán.');

  const actor = state.currentUser.fullName;
  const succeeded: PaymentTransaction = { ...tx, status: 'SUCCEEDED', confirmedBy: actor, confirmedAt: nowIso() };
  let next = updateTransaction(state, tx.id, succeeded);
  next = applySucceededTransaction(next, succeeded, actor);
  return appendAudit(
    next,
    'PREPAID_CASH_CONFIRMED',
    'FINANCE',
    tx.paymentRef,
    `Văn phòng xác nhận đã thu tiền mặt ${tx.amount.toLocaleString('vi-VN')}đ cho ${tx.paymentRef}`
  );
}

// Giả lập ngân hàng báo có — CHỈ dùng ở chế độ Demo (chưa cấu hình Supabase / API ngân hàng).
// Đi qua đúng applyBankCallback nên bấm nhiều lần không phát sinh phiếu thu trùng.
export function demoBankProviderRef(transactionId: string): string {
  return `DEMO-${transactionId}`;
}

// DEC-051: xác định tác nghiệp của khoản thu (Hạ vỏ / Cấp vỏ / Thu trước) — dùng cho phiếu thu cũ chưa lưu operation
export function receiptOperationOf(
  state: DepotState,
  input: { purpose: 'VOUCHER' | 'PREPAID_TOPUP'; voucherId?: string; operation?: ReceiptOperation }
): ReceiptOperation {
  if (input.operation) return input.operation;
  if (input.purpose === 'PREPAID_TOPUP') return 'THU_TRUOC';
  const v = state.vouchers.find((x) => x.id === input.voucherId);
  if (v?.serviceType === 'GATE_IN') return 'HA_VO';
  if (v?.serviceType === 'GATE_OUT') return 'CAP_VO';
  return 'KHAC';
}

// DEC-077: dòng chi phí phiếu thu trước — chỉ lấy từ BIỂU GIÁ, số lượng nguyên dương; chụp đơn giá lúc lập
function buildPrepaidFeeLines(state: DepotState, items: { catalogId: string; quantity: number }[]): FeeLineItem[] {
  return items.map((it) => {
    const cat = state.feeCatalog.find((f) => f.id === it.catalogId);
    if (!cat) throw new Error('Biểu giá đã chọn không còn trong Danh mục chung. Vui lòng chọn lại.');
    const qty = Number(it.quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 9999) throw new Error(`Số lượng của "${cat.name}" phải là số nguyên từ 1 đến 9999.`);
    const unit = Number(cat.defaultAmountInclVat);
    return { id: newId('fl'), catalogCode: cat.code, name: cat.name, quantity: qty, unitAmountInclVat: unit, amountInclVat: unit * qty };
  });
}

// DEC-079: SỬ DỤNG PHIẾU THU TRẢ TRƯỚC (TTT) — từng lần trừ tiền gắn với chứng từ, hồ sơ, tác nghiệp; tổng nạp / đã dùng / còn lại
export interface MasterReceiptUsageRow {
  deductionId: string;
  voucherNo: string;
  dossierCode: string;   // HV-... / CV-...
  operation: 'HẠ VỎ' | 'CẤP VỎ' | 'KHÁC';
  containerNo: string;
  amount: number;
  balanceAfter: number;
  performedBy: string;
  performedAt: string;
}
export interface MasterReceiptUsage {
  master: MasterPrepaidReceipt;
  rows: MasterReceiptUsageRow[]; // mới nhất trước
  usedCount: number;             // số lượt tác nghiệp đã trừ
  usedAmount: number;
  remainingAmount: number;
}

export function masterReceiptUsage(state: DepotState, receiptCode: string): MasterReceiptUsage | undefined {
  const master = state.masterReceipts.find((m) => m.receiptCode === receiptCode);
  if (!master) return undefined;
  const rows = state.receiptDeductions
    .filter((d) => d.receiptCode === receiptCode)
    .map((d) => {
      const v = state.vouchers.find((x) => x.voucherNo === d.voucherNo);
      return {
        deductionId: d.id,
        voucherNo: d.voucherNo,
        dossierCode: v?.referenceCode || v?.masterDossierCode || '',
        operation: v?.serviceType === 'GATE_IN' ? ('HẠ VỎ' as const) : v?.serviceType === 'GATE_OUT' ? ('CẤP VỎ' as const) : ('KHÁC' as const),
        containerNo: d.containerNo,
        amount: d.deductedAmount,
        balanceAfter: d.balanceAfter,
        performedBy: d.performedBy,
        performedAt: d.performedAt,
      };
    })
    .sort((a, b) => b.performedAt.localeCompare(a.performedAt));
  const usedAmount = rows.reduce((s, r) => s + r.amount, 0);
  return { master, rows, usedCount: rows.length, usedAmount, remainingAmount: master.remainingAmount };
}

// DEC-099: THÔNG TIN THANH TOÁN của lượt cont vào bãi (dùng ở Tồn vỏ + Excel)
//   (DEC-100: ký hiệu hiển thị TT / TTS / TTR; mã nội bộ vẫn TTTT / TTS / TTT)
//   DEC-104: chỉ hiện MÃ PHIẾU THU của lượt — TT → PT-TT-…; TTR → mã phiếu thu trả trước PT-TTR-… (DEC-124; dữ liệu cũ PTT-);
//   TTS (không có phiếu thu) / chưa thanh toán / Nhập tàu → để trống. Số chứng từ = mã hồ sơ (DEC-119).
// DEC-127: cột THANH TOÁN ở Tồn vỏ / Báo cáo Hạ vỏ / Cấp vỏ — chỉ tên hình thức, không kèm ký hiệu (gọn hiển thị)
export const PAYMENT_CATEGORY_SHORT_LABELS: Record<PaymentCategory, string> = {
  TTTT: 'TRỰC TIẾP',
  TTS: 'THANH TOÁN SAU',
  TTT: 'TRẢ TRƯỚC',
};

export const PAYMENT_CATEGORY_FULL_LABELS: Record<PaymentCategory, string> = {
  TTTT: 'TT — TRỰC TIẾP',
  TTS: 'TTS — THANH TOÁN SAU',
  TTT: 'TTR — TRẢ TRƯỚC',
};

export interface ContainerPaymentInfo {
  category?: PaymentCategory;
  label: string;        // hình thức thanh toán (chữ đầy đủ) hoặc tình trạng
  receipt: string;      // mã phiếu thu (TT) / mã phiếu thu trả trước (TTR); trống nếu không có
  receiptTarget?: string; // DEC-105: khóa mở đúng phiếu thu thực tế ở Văn phòng → Phiếu thu
}

export function containerPaymentInfo(state: DepotState, c: { masterDossierCode: string }): ContainerPaymentInfo {
  if (c.masterDossierCode.startsWith('NT-')) return { label: 'Không thu phí', receipt: '' };
  return voucherPaymentInfo(state, state.vouchers.find((v) => v.masterDossierCode === c.masterDossierCode && v.serviceType === 'GATE_IN'));
}

// DEC-126: THANH TOÁN + MÃ PHIẾU THU theo chứng từ chi phí (Hạ vỏ hoặc Cấp vỏ)
export function voucherPaymentInfo(state: DepotState, voucher: PaymentVoucher | undefined): ContainerPaymentInfo {
  if (!voucher) return { label: 'Chưa lập chứng từ', receipt: '' };
  if (voucher.status !== 'CONFIRMED' && voucher.status !== 'DEFERRED') {
    return { label: 'Chưa thanh toán', receipt: '' };
  }
  const category = voucher.paymentCategory;
  if (category === 'TTS') return { category, label: PAYMENT_CATEGORY_SHORT_LABELS.TTS, receipt: '' };
  if (category === 'TTT') {
    // TTR: link tới phiếu thu nạp tiền (PT-TTR-…) của phiếu thu trả trước
    const m = state.masterReceipts.find((x) => x.receiptCode === voucher.masterReceiptCode);
    const topup = m && state.paymentTransactions.find((t) => t.masterReceiptId === m.id && t.status === 'SUCCEEDED');
    const r = topup && state.paymentReceipts.find((x) => x.transactionId === topup.id);
    return { category, label: PAYMENT_CATEGORY_SHORT_LABELS.TTT, receipt: voucher.masterReceiptCode || '', receiptTarget: r?.receiptNo || topup?.id };
  }
  const txIds = state.paymentTransactions.filter((t) => t.voucherId === voucher.id && t.status === 'SUCCEEDED').map((t) => t.id);
  const receipts = state.paymentReceipts.filter((r) => txIds.includes(r.transactionId)).map((r) => r.receiptNo);
  return { category: 'TTTT', label: PAYMENT_CATEGORY_SHORT_LABELS.TTTT, receipt: receipts.join(', '), receiptTarget: receipts[0] };
}
