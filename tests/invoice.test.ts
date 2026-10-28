import { describe, expect, it } from 'vitest';
import { createInitialState, DepotState, normalizeDepotState } from '../src/services/depotStore';
import { confirmGateInPaymentAndComplete, recordGateInFieldStep, verifyGateInOfficeAndCreatePayment } from '../src/services/depotOperations';
import {
  ensureInvoiceFields,
  generateInvoiceSecret,
  isValidInvoiceSecret,
  lookupInvoicePortal,
  markInvoiceIssued,
  submitInvoiceRequest,
} from '../src/services/invoice';
import { canOpenMenu } from '../src/services/permissions';
import { simulateDemoBankTransfer } from '../src/services/depotOperations';
import { receiptCollectorName } from '../src/services/payments';
import { collectAllPages, queryReceipts, receiptsSheet } from '../src/services/reports';

const as = (state: DepotState, userId: string): DepotState => ({ ...state, currentUser: state.staffUsers.find((u) => u.id === userId)! });

function paidReceiptState() {
  let s = recordGateInFieldStep(as(createInitialState(), 'usr-inspector'), {
    gateInType: 'CUSTOMER_RETURN', shippingLineCode: 'MAERSK', doorPhotoUrl: 'data:image/jpeg;base64,AAA', conditionClass: 'AV', stuffingClass: 'E', cleaningItems: ['KHÔNG VỆ SINH'], manufactureYear: 2019,
  });
  const gi = s.gateInOrders[0];
  s = verifyGateInOfficeAndCreatePayment(as(s, 'usr-office'), {
    gateInId: gi.id, containerNo: 'MSKU1234567', size: '40', type: 'HC', truckNo: '15C-123.45', driverPhone: '0912 345 678',
    customerName: 'Công ty Tiếp Vận Việt (VietLog)', shippingLineCode: 'MAERSK', orderDocNo: 'EIR-1', feeCatalogIds: ['fee-lolo-40-hc-maersk'],
  });
  return confirmGateInPaymentAndComplete(as(s, 'usr-office'), { gateInId: gi.id, paymentCategory: 'TTTT', directMethod: 'CASH' });
}

const REQ = { taxCode: '0101234567', email: 'KeToan@VietLog.vn', companyName: 'VietLog', address: 'Hải Phòng', note: 'Gấp' };

describe('DEC-111: mã bảo mật xuất hóa đơn', () => {
  it('12 ký tự chữ hoa / thường / số, sinh ngẫu nhiên, không trùng', () => {
    const codes = new Set<string>();
    for (let i = 0; i < 2000; i++) {
      const c = generateInvoiceSecret(codes);
      expect(isValidInvoiceSecret(c)).toBe(true);
      codes.add(c);
    }
    expect(codes.size).toBe(2000);
    const all = [...codes].join('');
    expect(/[A-Z]/.test(all) && /[a-z]/.test(all) && /[0-9]/.test(all)).toBe(true);
  });

  it('phiếu thu mới có mã + CHƯA XHD; phiếu cũ được bổ sung khi nạp dữ liệu', () => {
    const s = paidReceiptState();
    const r = s.paymentReceipts[0];
    expect(isValidInvoiceSecret(r.invoiceSecret!)).toBe(true);
    expect(r.invoiceStatus).toBe('CHUA_XHD');
    const old = ensureInvoiceFields([{ ...r, invoiceSecret: undefined, invoiceStatus: undefined }]);
    expect(isValidInvoiceSecret(old[0].invoiceSecret!)).toBe(true);
    expect(old[0].invoiceStatus).toBe('CHUA_XHD');
    const loaded = normalizeDepotState({ ...s, paymentReceipts: [{ ...r, invoiceSecret: undefined, invoiceStatus: undefined }] });
    expect(loaded.paymentReceipts[0].invoiceStatus).toBe('CHUA_XHD');
  });
});

describe('DEC-111: khách gửi yêu cầu → Kế toán cập nhật ĐÃ XHD', () => {
  it('đúng luồng: tra cứu bằng mã → YÊU CẦU XHD → sửa được → Kế toán ĐÃ XHD (số HĐ tùy chọn) → khóa sửa', () => {
    let s = paidReceiptState();
    const r = s.paymentReceipts[0];
    const view = lookupInvoicePortal(s, r.invoiceSecret!);
    expect(view).toMatchObject({ receiptNo: r.receiptNo, status: 'CHUA_XHD', amount: r.amount });
    expect(view).not.toHaveProperty('invoiceSecret');

    s = submitInvoiceRequest(s, { secret: r.invoiceSecret!, ...REQ });
    let x = s.paymentReceipts[0];
    expect(x.invoiceStatus).toBe('YEU_CAU_XHD');
    expect(x.invoiceRequest).toMatchObject({ taxCode: '0101234567', email: 'ketoan@vietlog.vn', companyName: 'VietLog', address: 'Hải Phòng', note: 'Gấp' });
    expect(s.auditLogs[0]).toMatchObject({ actionCode: 'INVOICE_REQUEST', actorName: 'Khách hàng (trang hóa đơn)' });

    s = submitInvoiceRequest(s, { secret: r.invoiceSecret!, ...REQ, taxCode: '0101234567-002' });
    expect(s.paymentReceipts[0].invoiceRequest!.taxCode).toBe('0101234567-002');
    expect(s.auditLogs[0].actionCode).toBe('INVOICE_REQUEST_UPDATE');

    expect(() => markInvoiceIssued(as(s, 'usr-office'), { receiptNo: r.receiptNo })).toThrow(/Không đủ quyền/);
    s = markInvoiceIssued(as(s, 'usr-acc'), { receiptNo: r.receiptNo, invoiceNo: ' 0000123 ' });
    x = s.paymentReceipts[0];
    expect(x.invoiceStatus).toBe('DA_XHD');
    expect(x.invoiceIssued).toMatchObject({ invoiceNo: '0000123', issuedBy: expect.any(String) });
    expect(() => markInvoiceIssued(as(s, 'usr-acc'), { receiptNo: r.receiptNo })).toThrow(/đã ở trạng thái ĐÃ XHD/);
    expect(() => submitInvoiceRequest(s, { secret: r.invoiceSecret!, ...REQ })).toThrow(/đã xuất hóa đơn/);
    expect(lookupInvoicePortal(s, r.invoiceSecret!)).toMatchObject({ status: 'DA_XHD', invoiceNo: '0000123' });
  });

  it('từ chối: sai mã / sai chữ hoa-thường, MST sai, Gmail sai, thiếu tên công ty / địa chỉ, Kế toán xuất khi chưa có yêu cầu', () => {
    const s = paidReceiptState();
    const r = s.paymentReceipts[0];
    const secret = r.invoiceSecret!;
    const flipped = secret.replace(/[A-Za-z]/, (ch) => (ch === ch.toUpperCase() ? ch.toLowerCase() : ch.toUpperCase()));
    if (flipped !== secret) expect(() => lookupInvoicePortal(s, flipped)).toThrow(/Mã bảo mật không đúng/);
    expect(() => lookupInvoicePortal(s, 'ABC')).toThrow(/Mã bảo mật không đúng/);
    expect(() => lookupInvoicePortal(s, 'AAAAAAAAAAAA')).toThrow(/Mã bảo mật không đúng/);
    expect(() => submitInvoiceRequest(s, { secret, ...REQ, taxCode: '12345' })).toThrow(/MÃ SỐ THUẾ/);
    expect(() => submitInvoiceRequest(s, { secret, ...REQ, email: 'abc' })).toThrow(/GMAIL/);
    expect(() => submitInvoiceRequest(s, { secret, ...REQ, companyName: ' ' })).toThrow(/TÊN CÔNG TY/);
    expect(() => submitInvoiceRequest(s, { secret, ...REQ, address: '' })).toThrow(/ĐỊA CHỈ/);
    expect(() => markInvoiceIssued(as(s, 'usr-acc'), { receiptNo: r.receiptNo })).toThrow(/chưa có yêu cầu/);
  });

  it('Kế toán chỉ thấy Phiếu thu; lọc theo trạng thái hóa đơn; Excel có cột hóa đơn', () => {
    let s = paidReceiptState();
    const acc = as(s, 'usr-acc');
    expect(acc.currentUser.roles).toEqual(['ACCOUNTANT']);
    expect(canOpenMenu(acc.currentUser, 'VP_PHIEU_THU')).toBe(true);
    expect(canOpenMenu(acc.currentUser, 'VP_HA_VO')).toBe(false);
    expect(canOpenMenu(acc.currentUser, 'TON_VO')).toBe(false);
    s = submitInvoiceRequest(s, { secret: s.paymentReceipts[0].invoiceSecret!, ...REQ });
    const rows = (st: 'ALL' | 'CHUA_XHD' | 'YEU_CAU_XHD') => collectAllPages((p) => queryReceipts(s, { keyword: 'MSKU1234567', invoiceStatus: st }, p));
    expect(rows('YEU_CAU_XHD')).toHaveLength(1);
    expect(rows('CHUA_XHD')).toHaveLength(0);
    const sheet = receiptsSheet(s, rows('ALL'));
    const i = sheet.columns.indexOf('TRẠNG THÁI HĐ');
    expect(sheet.columns.slice(i, i + 4)).toEqual(['TRẠNG THÁI HĐ', 'MÃ SỐ THUẾ', 'GMAIL NHẬN HĐ', 'TÊN CÔNG TY']);
    expect(sheet.rows[0][i]).toBe('YÊU CẦU XHD');
    expect(sheet.rows[0][i + 1]).toBe('0101234567');
    expect(sheet.columns).not.toContain('MÃ BẢO MẬT');
    for (const row of sheet.rows) expect(row.length).toBe(sheet.columns.length);
  });
});

describe('DEC-113: người thu tiền trên phiếu là nhân viên, không phải hệ thống ngân hàng', () => {
  it('chuyển khoản báo có → phiếu thu ghi nhân viên Văn phòng đã lập yêu cầu thu; dữ liệu cũ ghi HỆ THỐNG vẫn in tên nhân viên', () => {
    let s = recordGateInFieldStep(as(createInitialState(), 'usr-inspector'), {
      gateInType: 'CUSTOMER_RETURN', shippingLineCode: 'MAERSK', doorPhotoUrl: 'data:image/jpeg;base64,AAA', conditionClass: 'AV', stuffingClass: 'E', cleaningItems: ['KHÔNG VỆ SINH'], manufactureYear: 2019,
    });
    const gi = s.gateInOrders[0];
    s = verifyGateInOfficeAndCreatePayment(as(s, 'usr-office'), {
      gateInId: gi.id, containerNo: 'MSKU1234567', size: '40', type: 'HC', truckNo: '15C-123.45', driverPhone: '0912 345 678',
      customerName: 'Công ty Tiếp Vận Việt (VietLog)', shippingLineCode: 'MAERSK', orderDocNo: 'EIR-1', feeCatalogIds: ['fee-lolo-40-hc-maersk'],
    });
    s = confirmGateInPaymentAndComplete(as(s, 'usr-office'), { gateInId: gi.id, paymentCategory: 'TTTT', directMethod: 'BANK_TRANSFER_API' });
    const office = s.staffUsers.find((u) => u.id === 'usr-office')!.fullName;
    s = simulateDemoBankTransfer(as(s, 'usr-office'), { transactionId: s.paymentTransactions[0].id });
    const r = s.paymentReceipts[0];
    expect(r.issuedBy).toBe(office);
    expect(r.issuedBy).not.toMatch(/HỆ THỐNG/);
    expect(receiptCollectorName(s, { ...r, issuedBy: 'HỆ THỐNG (Ngân hàng)' })).toBe(office);
    expect(receiptCollectorName(s, r)).toBe(office);
  });
});

describe('DEC-130: phiếu thu trả trước — hóa đơn theo từng lượt, khách tự gộp', () => {
  it('chọn lượt → gộp yêu cầu; 1 lượt chỉ thuộc 1 yêu cầu; sửa / hủy khi chưa xuất; Kế toán xuất theo yêu cầu; trạng thái tổng hợp', async () => {
    const { createDemoState } = await import('../src/services/demoData');
    const { cancelPrepaidInvoiceGroup, prepaidInvoiceView, receiptInvoiceLabel, receiptInvoiceStatus, submitPrepaidInvoiceGroup } = await import('../src/services/invoice');
    let s = createDemoState();
    const find = () => s.paymentReceipts.find((r) => r.purpose === 'PREPAID_TOPUP' && (r.invoiceGroups || []).length > 0)!;
    let r = find();
    const secret = r.invoiceSecret!;
    let view = prepaidInvoiceView(s, r)!;
    expect(view.lots).toHaveLength(2);
    expect(view.groups).toHaveLength(1);
    expect(receiptInvoiceStatus(s, r)).toBe('YEU_CAU_XHD');
    // Phiếu trả trước không cho yêu cầu cả phiếu
    expect(() => submitInvoiceRequest(s, { secret, ...REQ })).toThrow(/LƯỢT/);
    // Lượt đã nằm trong yêu cầu khác → từ chối; chưa chọn lượt → từ chối; lượt lạ → từ chối
    const taken = view.groups[0].deductionIds[0];
    const free = view.lots.find((l) => !l.groupId)!.deductionId;
    expect(() => submitPrepaidInvoiceGroup(s, { secret, ...REQ, deductionIds: [taken, free] })).toThrow(/yêu cầu hóa đơn khác/);
    expect(() => submitPrepaidInvoiceGroup(s, { secret, ...REQ, deductionIds: [] })).toThrow(/ít nhất 1 LƯỢT/);
    expect(() => submitPrepaidInvoiceGroup(s, { secret, ...REQ, deductionIds: ['ded-x'] })).toThrow(/không thuộc/);
    // Hủy yêu cầu cũ → gộp cả 2 lượt vào 1 hóa đơn
    s = cancelPrepaidInvoiceGroup(s, { secret, groupId: view.groups[0].id });
    expect(receiptInvoiceStatus(s, find() || s.paymentReceipts.find((x) => x.invoiceSecret === secret)!)).toBe('CHUA_XHD');
    s = submitPrepaidInvoiceGroup(s, { secret, ...REQ, deductionIds: [taken, free] });
    r = s.paymentReceipts.find((x) => x.invoiceSecret === secret)!;
    view = prepaidInvoiceView(s, r)!;
    expect(view.groups).toHaveLength(1);
    expect(view.groups[0].amount).toBe(view.lots.reduce((a, l) => a + l.amount, 0));
    // Tách lại: sửa yêu cầu chỉ còn 1 lượt, lượt kia tạo yêu cầu riêng với MST khác
    s = submitPrepaidInvoiceGroup(s, { secret, ...REQ, groupId: view.groups[0].id, deductionIds: [taken] });
    s = submitPrepaidInvoiceGroup(s, { secret, ...REQ, taxCode: '0209876543', companyName: 'Đơn vị B', deductionIds: [free] });
    r = s.paymentReceipts.find((x) => x.invoiceSecret === secret)!;
    view = prepaidInvoiceView(s, r)!;
    expect(view.groups.map((g) => g.taxCode).sort()).toEqual(['0101234567', '0209876543']);
    // Kế toán: phải chọn yêu cầu; xuất từng yêu cầu
    expect(() => markInvoiceIssued(as(s, 'usr-acc'), { receiptNo: r.receiptNo })).toThrow(/chọn YÊU CẦU/);
    expect(() => markInvoiceIssued(as(s, 'usr-office'), { receiptNo: r.receiptNo, groupId: view.groups[0].id })).toThrow(/Không đủ quyền/);
    s = markInvoiceIssued(as(s, 'usr-acc'), { receiptNo: r.receiptNo, groupId: view.groups[0].id, invoiceNo: '0000501' });
    r = s.paymentReceipts.find((x) => x.invoiceSecret === secret)!;
    expect(receiptInvoiceLabel(s, r)).toBe('YÊU CẦU XHD • đã xuất 1/2 lượt');
    expect(() => submitPrepaidInvoiceGroup(s, { secret, ...REQ, groupId: view.groups[0].id, deductionIds: [taken] })).toThrow(/đã xuất hóa đơn/);
    expect(() => cancelPrepaidInvoiceGroup(s, { secret, groupId: view.groups[0].id })).toThrow(/đã xuất hóa đơn/);
    s = markInvoiceIssued(as(s, 'usr-acc'), { receiptNo: r.receiptNo, groupId: view.groups[1].id });
    r = s.paymentReceipts.find((x) => x.invoiceSecret === secret)!;
    expect(receiptInvoiceStatus(s, r)).toBe('DA_XHD');
    expect(receiptInvoiceLabel(s, r)).toBe('ĐÃ XHD • đã xuất 2/2 lượt');
    // Excel ghép theo từng yêu cầu
    const sheet = receiptsSheet(s, collectAllPages((p) => queryReceipts(as(s, 'usr-acc'), { receiptNo: r.receiptNo }, p)));
    expect(String(sheet.rows[0][sheet.columns.indexOf('MÃ SỐ THUẾ')])).toBe('0101234567; 0209876543');
    expect(collectAllPages((p) => queryReceipts(s, { receiptNo: r.receiptNo, invoiceStatus: 'DA_XHD' }, p))).toHaveLength(1);
  });
});
