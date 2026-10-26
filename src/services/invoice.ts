// ============================================================================
// DEC-111: YÊU CẦU XUẤT HÓA ĐƠN TỪ PHIẾU THU
//   - Mỗi phiếu thu có MÃ BẢO MẬT 12 ký tự (A-Z, a-z, 0-9), sinh ngẫu nhiên bằng crypto, duy nhất.
//   - Khách vào trang "Yêu cầu xuất hóa đơn", dán mã → nhập MST, Gmail, Tên công ty, Địa chỉ, Ghi chú.
//   - Trạng thái: CHƯA XHD → YÊU CẦU XHD (khách gửi, sửa được khi chưa xuất) → ĐÃ XHD (Kế toán cập nhật sau khi xuất trên MISA).
//   Trang khách hàng KHÔNG cần đăng nhập — mã bảo mật là bằng chứng duy nhất, nên chỉ trả về thông tin tối thiểu.
// ============================================================================
import type { InvoiceGroup, InvoiceStatus, PaymentReceipt } from '../types/depot';
import type { DepotState } from './depotStore';
import { appendAudit, assertPermission, newId, nowIso } from './core';
import { masterReceiptUsage } from './payments';

export const INVOICE_SECRET_LENGTH = 12;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; // 62 ký tự → 62^12 ≈ 3,2 × 10^21 khả năng

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  CHUA_XHD: 'CHƯA XHD',
  YEU_CAU_XHD: 'YÊU CẦU XHD',
  DA_XHD: 'ĐÃ XHD',
};

// Đường dẫn trang khách hàng (hash route — chạy được trên mọi hosting tĩnh)
export const INVOICE_PORTAL_HASH = '#/hoa-don';

// Sinh mã bảo mật bằng nguồn ngẫu nhiên mật mã (crypto.getRandomValues), loại bỏ lệch phân bố (rejection sampling)
export function generateInvoiceSecret(existing: Iterable<string> = []): string {
  const used = new Set(existing);
  const cryptoApi = globalThis.crypto;
  if (!cryptoApi?.getRandomValues) throw new Error('Thiết bị không hỗ trợ sinh mã bảo mật an toàn.');
  for (;;) {
    let out = '';
    while (out.length < INVOICE_SECRET_LENGTH) {
      const buf = new Uint8Array(32);
      cryptoApi.getRandomValues(buf);
      for (const b of buf) {
        if (b < 248 && out.length < INVOICE_SECRET_LENGTH) out += ALPHABET[b % 62]; // 248 = 62 × 4
      }
    }
    if (!used.has(out)) return out;
  }
}

export function isValidInvoiceSecret(code: string): boolean {
  return new RegExp(`^[A-Za-z0-9]{${INVOICE_SECRET_LENGTH}}$`).test(code);
}

// Bổ sung mã bảo mật + trạng thái cho phiếu thu cũ chưa có (gọi khi nạp dữ liệu)
export function ensureInvoiceFields(receipts: PaymentReceipt[]): PaymentReceipt[] {
  const used = new Set(receipts.map((r) => r.invoiceSecret).filter(Boolean) as string[]);
  return receipts.map((r) => {
    if (r.invoiceSecret && r.invoiceStatus) return r;
    const secret = r.invoiceSecret || generateInvoiceSecret(used);
    used.add(secret);
    return { ...r, invoiceSecret: secret, invoiceStatus: r.invoiceStatus || 'CHUA_XHD' };
  });
}

// Thông tin khách được thấy khi dán đúng mã (không lộ dữ liệu nội bộ khác)
export interface InvoicePortalView {
  receiptNo: string;
  issuedAt: string;
  amount: number;
  payerName: string;
  containerNo?: string;
  status: InvoiceStatus;
  request?: PaymentReceipt['invoiceRequest'];
  invoiceNo?: string;
  prepaid?: PrepaidInvoiceView; // DEC-130: phiếu thu trả trước — hóa đơn theo lượt
}

// DEC-130: một LƯỢT đã dùng phiếu thu trả trước + trạng thái hóa đơn của lượt đó
export interface PrepaidLot {
  deductionId: string;
  dossierCode: string;
  operation: string;
  containerNo: string;
  amount: number;
  performedAt: string;
  groupId?: string;
  status: InvoiceStatus;
  invoiceNo?: string;
}
export interface PrepaidInvoiceView {
  lots: PrepaidLot[];
  groups: InvoiceGroup[];
  remainingAmount: number;
}

const isPrepaidReceipt = (r: PaymentReceipt) => r.purpose === 'PREPAID_TOPUP' && Boolean(r.masterReceiptCode);

export function prepaidInvoiceView(state: DepotState, r: PaymentReceipt): PrepaidInvoiceView | undefined {
  if (!isPrepaidReceipt(r)) return undefined;
  const usage = masterReceiptUsage(state, r.masterReceiptCode!);
  if (!usage) return undefined;
  const groups = r.invoiceGroups || [];
  const lots = usage.rows.map((u) => {
    const g = groups.find((x) => x.deductionIds.includes(u.deductionId));
    return {
      deductionId: u.deductionId, dossierCode: u.dossierCode, operation: u.operation, containerNo: u.containerNo, amount: u.amount, performedAt: u.performedAt,
      groupId: g?.id, status: (g?.status || 'CHUA_XHD') as InvoiceStatus, invoiceNo: g?.invoiceNo,
    };
  });
  return { lots, groups, remainingAmount: usage.remainingAmount };
}

// Trạng thái hóa đơn của phiếu thu (tính lại mỗi lần — phiếu trả trước có thể phát sinh lượt mới)
//   Trả trước: ĐÃ XHD khi mọi lượt đã dùng đều đã xuất; YÊU CẦU XHD khi còn yêu cầu chờ Kế toán; còn lại CHƯA XHD
export function receiptInvoiceStatus(state: DepotState, r: PaymentReceipt): InvoiceStatus {
  const view = prepaidInvoiceView(state, r);
  if (!view) return r.invoiceStatus || 'CHUA_XHD';
  if (view.groups.some((g) => g.status === 'YEU_CAU_XHD')) return 'YEU_CAU_XHD';
  if (view.lots.length > 0 && view.lots.every((l) => l.status === 'DA_XHD')) return 'DA_XHD';
  return 'CHUA_XHD';
}

// Nhãn hiển thị: phiếu trả trước kèm số lượt đã xuất, VD "YÊU CẦU XHD • đã xuất 1/3 lượt"
export function receiptInvoiceLabel(state: DepotState, r: PaymentReceipt): string {
  const status = receiptInvoiceStatus(state, r);
  const view = prepaidInvoiceView(state, r);
  if (!view) return INVOICE_STATUS_LABELS[status];
  const done = view.lots.filter((l) => l.status === 'DA_XHD').length;
  return `${INVOICE_STATUS_LABELS[status]} • đã xuất ${done}/${view.lots.length} lượt`;
}

function findBySecret(state: DepotState, rawCode: string): PaymentReceipt {
  const code = rawCode.trim();
  // So khớp chính xác, phân biệt chữ hoa / thường
  const receipt = isValidInvoiceSecret(code) ? state.paymentReceipts.find((r) => r.invoiceSecret === code) : undefined;
  if (!receipt) throw new Error('Mã bảo mật không đúng. Vui lòng kiểm tra lại mã in trên phiếu thu (phân biệt chữ hoa / thường).');
  return receipt;
}

export function lookupInvoicePortal(state: DepotState, rawCode: string): InvoicePortalView {
  const r = findBySecret(state, rawCode);
  return {
    receiptNo: r.receiptNo,
    issuedAt: r.issuedAt,
    amount: r.amount,
    payerName: r.payerName,
    containerNo: r.containerNo,
    status: r.invoiceStatus || 'CHUA_XHD',
    request: r.invoiceRequest,
    invoiceNo: r.invoiceIssued?.invoiceNo,
    prepaid: prepaidInvoiceView(state, r),
  };
}

export interface InvoiceRequestInput {
  secret: string;
  taxCode: string;
  email: string;
  companyName: string;
  address: string;
  note?: string;
}

function cleanInvoiceInfo(input: InvoiceRequestInput) {
  const taxCode = input.taxCode.replace(/\s+/g, '');
  if (!/^\d{10}(-\d{3})?$/.test(taxCode)) throw new Error('MÃ SỐ THUẾ phải gồm 10 chữ số, hoặc 10 chữ số + "-" + 3 chữ số (chi nhánh).');
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('GMAIL NHẬN HÓA ĐƠN không hợp lệ.');
  const companyName = input.companyName.trim();
  if (!companyName) throw new Error('Vui lòng nhập TÊN CÔNG TY.');
  const address = input.address.trim();
  if (!address) throw new Error('Vui lòng nhập ĐỊA CHỈ.');
  return { taxCode, email, companyName, address, note: input.note?.trim() || undefined };
}

const CUSTOMER_ACTOR = { name: 'Khách hàng (trang hóa đơn)', role: 'SYSTEM' as const };

// Khách hàng gửi / sửa yêu cầu xuất hóa đơn (không cần đăng nhập — mã bảo mật là điều kiện)
export function submitInvoiceRequest(state: DepotState, input: InvoiceRequestInput): DepotState {
  const r = findBySecret(state, input.secret);
  if (isPrepaidReceipt(r)) throw new Error('Phiếu thu trả trước: chọn các LƯỢT đã dùng để yêu cầu hóa đơn (không xuất hóa đơn cho cả phiếu).');
  if (r.invoiceStatus === 'DA_XHD') throw new Error(`Phiếu thu ${r.receiptNo} đã xuất hóa đơn — không sửa được yêu cầu. Liên hệ Văn phòng nếu cần.`);
  const { taxCode, email, companyName, address, note } = cleanInvoiceInfo(input);
  const now = nowIso();
  const isUpdate = r.invoiceStatus === 'YEU_CAU_XHD';
  const request = {
    taxCode,
    email,
    companyName,
    address,
    note,
    requestedAt: r.invoiceRequest?.requestedAt || now,
    updatedAt: now,
  };
  return appendAudit(
    {
      ...state,
      paymentReceipts: state.paymentReceipts.map((x) => (x.id === r.id ? { ...x, invoiceStatus: 'YEU_CAU_XHD' as const, invoiceRequest: request } : x)),
    },
    isUpdate ? 'INVOICE_REQUEST_UPDATE' : 'INVOICE_REQUEST',
    'PAYMENT',
    r.receiptNo,
    `[Phiếu thu ${r.receiptNo}] Khách hàng ${isUpdate ? 'sửa' : 'gửi'} yêu cầu xuất hóa đơn: MST ${taxCode}, ${companyName}, ${email}`,
    r.dossierCode,
    CUSTOMER_ACTOR
  );
}

// ---------------------------------------------------------------------------
// DEC-130: PHIẾU THU TRẢ TRƯỚC — khách tự gộp các lượt đã dùng thành từng yêu cầu hóa đơn
// ---------------------------------------------------------------------------
const recomputeStatus = (state: DepotState, receiptId: string): DepotState => ({
  ...state,
  paymentReceipts: state.paymentReceipts.map((x) => (x.id === receiptId ? { ...x, invoiceStatus: receiptInvoiceStatus(state, x) } : x)),
});

// Gửi mới (không có groupId) hoặc sửa (groupId) 1 yêu cầu hóa đơn cho các lượt đã chọn
export function submitPrepaidInvoiceGroup(state: DepotState, input: InvoiceRequestInput & { deductionIds: string[]; groupId?: string }): DepotState {
  const r = findBySecret(state, input.secret);
  const view = prepaidInvoiceView(state, r);
  if (!view) throw new Error('Phiếu thu này không phải phiếu thu trả trước.');
  const ids = Array.from(new Set(input.deductionIds));
  if (ids.length === 0) throw new Error('Vui lòng chọn ít nhất 1 LƯỢT để yêu cầu hóa đơn.');
  const editing = input.groupId ? view.groups.find((g) => g.id === input.groupId) : undefined;
  if (input.groupId && !editing) throw new Error('Không tìm thấy yêu cầu hóa đơn cần sửa.');
  if (editing?.status === 'DA_XHD') throw new Error('Yêu cầu này đã xuất hóa đơn — không sửa được. Liên hệ Kế toán nếu cần.');
  for (const id of ids) {
    const lot = view.lots.find((l) => l.deductionId === id);
    if (!lot) throw new Error('Có lượt không thuộc phiếu thu này (hoặc chưa phát sinh).');
    if (lot.groupId && lot.groupId !== editing?.id) throw new Error(`Lượt ${lot.dossierCode} đã nằm trong một yêu cầu hóa đơn khác.`);
  }
  const info = cleanInvoiceInfo(input);
  const now = nowIso();
  const amount = view.lots.filter((l) => ids.includes(l.deductionId)).reduce((s, l) => s + l.amount, 0);
  const group: InvoiceGroup = editing
    ? { ...editing, ...info, deductionIds: ids, amount, updatedAt: now }
    : { id: newId('ivg'), ...info, deductionIds: ids, amount, status: 'YEU_CAU_XHD', requestedAt: now, updatedAt: now };
  const groups = editing ? view.groups.map((g) => (g.id === editing.id ? group : g)) : [...view.groups, group];
  const next = recomputeStatus({ ...state, paymentReceipts: state.paymentReceipts.map((x) => (x.id === r.id ? { ...x, invoiceGroups: groups } : x)) }, r.id);
  const codes = view.lots.filter((l) => ids.includes(l.deductionId)).map((l) => l.dossierCode).join(', ');
  return appendAudit(next, editing ? 'INVOICE_REQUEST_UPDATE' : 'INVOICE_REQUEST', 'PAYMENT', r.receiptNo,
    `[Phiếu thu ${r.receiptNo}] Khách hàng ${editing ? 'sửa' : 'gửi'} yêu cầu hóa đơn cho ${ids.length} lượt (${codes}): MST ${info.taxCode}, ${info.companyName}`, r.dossierCode, CUSTOMER_ACTOR);
}

// Khách hủy 1 yêu cầu chưa xuất (để gộp / tách lại các lượt)
export function cancelPrepaidInvoiceGroup(state: DepotState, input: { secret: string; groupId: string }): DepotState {
  const r = findBySecret(state, input.secret);
  const g = (r.invoiceGroups || []).find((x) => x.id === input.groupId);
  if (!g) throw new Error('Không tìm thấy yêu cầu hóa đơn.');
  if (g.status === 'DA_XHD') throw new Error('Yêu cầu này đã xuất hóa đơn — không hủy được. Liên hệ Kế toán nếu cần.');
  const next = recomputeStatus({ ...state, paymentReceipts: state.paymentReceipts.map((x) => (x.id === r.id ? { ...x, invoiceGroups: (x.invoiceGroups || []).filter((y) => y.id !== g.id) } : x)) }, r.id);
  return appendAudit(next, 'INVOICE_REQUEST_CANCEL', 'PAYMENT', r.receiptNo, `[Phiếu thu ${r.receiptNo}] Khách hàng hủy yêu cầu hóa đơn ${g.deductionIds.length} lượt`, r.dossierCode, CUSTOMER_ACTOR);
}

// Kế toán cập nhật ĐÃ XHD sau khi xuất hóa đơn trên MISA (số hóa đơn không bắt buộc)
//   Phiếu thu trả trước: cập nhật theo TỪNG YÊU CẦU (groupId)
export function markInvoiceIssued(state: DepotState, input: { receiptNo: string; invoiceNo?: string; groupId?: string }): DepotState {
  assertPermission(state, 'INVOICE_ISSUE', 'chỉ Kế toán được cập nhật trạng thái hóa đơn.');
  const r = state.paymentReceipts.find((x) => x.receiptNo === input.receiptNo);
  if (!r) throw new Error('Không tìm thấy phiếu thu.');
  if (isPrepaidReceipt(r)) {
    const g = (r.invoiceGroups || []).find((x) => x.id === input.groupId);
    if (!g) throw new Error('Phiếu thu trả trước: chọn YÊU CẦU hóa đơn (nhóm lượt) cần cập nhật.');
    if (g.status === 'DA_XHD') throw new Error('Yêu cầu này đã ở trạng thái ĐÃ XHD.');
    const invoiceNo = input.invoiceNo?.trim() || undefined;
    const issued: InvoiceGroup = { ...g, status: 'DA_XHD', invoiceNo, issuedAt: nowIso(), issuedBy: state.currentUser.fullName };
    const next = recomputeStatus({ ...state, paymentReceipts: state.paymentReceipts.map((x) => (x.id === r.id ? { ...x, invoiceGroups: (x.invoiceGroups || []).map((y) => (y.id === g.id ? issued : y)) } : x)) }, r.id);
    return appendAudit(next, 'INVOICE_ISSUED', 'PAYMENT', r.receiptNo, `[Phiếu thu ${r.receiptNo}] Kế toán cập nhật ĐÃ XHD cho ${g.deductionIds.length} lượt${invoiceNo ? ` — số hóa đơn ${invoiceNo}` : ''}`, r.dossierCode);
  }
  if (r.invoiceStatus === 'DA_XHD') throw new Error(`Phiếu thu ${r.receiptNo} đã ở trạng thái ĐÃ XHD.`);
  if (r.invoiceStatus !== 'YEU_CAU_XHD' || !r.invoiceRequest) throw new Error(`Phiếu thu ${r.receiptNo} chưa có yêu cầu xuất hóa đơn của khách hàng.`);
  const invoiceNo = input.invoiceNo?.trim() || undefined;
  return appendAudit(
    {
      ...state,
      paymentReceipts: state.paymentReceipts.map((x) =>
        x.id === r.id ? { ...x, invoiceStatus: 'DA_XHD' as const, invoiceIssued: { invoiceNo, issuedAt: nowIso(), issuedBy: state.currentUser.fullName } } : x
      ),
    },
    'INVOICE_ISSUED',
    'PAYMENT',
    r.receiptNo,
    `[Phiếu thu ${r.receiptNo}] Kế toán cập nhật ĐÃ XHD${invoiceNo ? ` — số hóa đơn ${invoiceNo}` : ''}`,
    r.dossierCode
  );
}

// Đường link đầy đủ in trên phiếu thu (trên máy chủ thật = tên miền công ty)
export function invoicePortalUrl(): string {
  const loc = (globalThis as { location?: { origin: string; pathname: string } }).location;
  return loc ? `${loc.origin}${loc.pathname}${INVOICE_PORTAL_HASH}` : INVOICE_PORTAL_HASH;
}
