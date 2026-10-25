// ============================================================================
// DEC-111: YÊU CẦU XUẤT HÓA ĐƠN TỪ PHIẾU THU
//   - Mỗi phiếu thu có MÃ BẢO MẬT 12 ký tự (A-Z, a-z, 0-9), sinh ngẫu nhiên bằng crypto, duy nhất.
//   - Khách vào trang "Yêu cầu xuất hóa đơn", dán mã → nhập MST, Gmail, Tên công ty, Địa chỉ, Ghi chú.
//   - Trạng thái: CHƯA XHD → YÊU CẦU XHD (khách gửi, sửa được khi chưa xuất) → ĐÃ XHD (Kế toán cập nhật sau khi xuất trên MISA).
//   Trang khách hàng KHÔNG cần đăng nhập — mã bảo mật là bằng chứng duy nhất, nên chỉ trả về thông tin tối thiểu.
// ============================================================================
import type { InvoiceStatus, PaymentReceipt } from '../types/depot';
import type { DepotState } from './depotStore';
import { appendAudit, assertPermission, nowIso } from './core';

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

// Khách hàng gửi / sửa yêu cầu xuất hóa đơn (không cần đăng nhập — mã bảo mật là điều kiện)
export function submitInvoiceRequest(state: DepotState, input: InvoiceRequestInput): DepotState {
  const r = findBySecret(state, input.secret);
  if (r.invoiceStatus === 'DA_XHD') throw new Error(`Phiếu thu ${r.receiptNo} đã xuất hóa đơn — không sửa được yêu cầu. Liên hệ Văn phòng nếu cần.`);
  const taxCode = input.taxCode.replace(/\s+/g, '');
  if (!/^\d{10}(-\d{3})?$/.test(taxCode)) throw new Error('MÃ SỐ THUẾ phải gồm 10 chữ số, hoặc 10 chữ số + "-" + 3 chữ số (chi nhánh).');
  const email = input.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('GMAIL NHẬN HÓA ĐƠN không hợp lệ.');
  const companyName = input.companyName.trim();
  if (!companyName) throw new Error('Vui lòng nhập TÊN CÔNG TY.');
  const address = input.address.trim();
  if (!address) throw new Error('Vui lòng nhập ĐỊA CHỈ.');
  const now = nowIso();
  const isUpdate = r.invoiceStatus === 'YEU_CAU_XHD';
  const request = {
    taxCode,
    email,
    companyName,
    address,
    note: input.note?.trim() || undefined,
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
    { name: 'Khách hàng (trang hóa đơn)', role: 'SYSTEM' }
  );
}

// Kế toán cập nhật ĐÃ XHD sau khi xuất hóa đơn trên MISA (số hóa đơn không bắt buộc)
export function markInvoiceIssued(state: DepotState, input: { receiptNo: string; invoiceNo?: string }): DepotState {
  assertPermission(state, 'INVOICE_ISSUE', 'chỉ Kế toán được cập nhật trạng thái hóa đơn.');
  const r = state.paymentReceipts.find((x) => x.receiptNo === input.receiptNo);
  if (!r) throw new Error('Không tìm thấy phiếu thu.');
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
