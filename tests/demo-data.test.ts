import { describe, expect, it } from 'vitest';
import { createDemoState } from '../src/services/demoData';
import { containerPaymentInfo } from '../src/services/payments';

describe('DEC-108: dữ liệu test đầy đủ trường hợp', () => {
  it('tạo được bằng đúng các hàm nghiệp vụ và có đủ trường hợp', () => {
    const s = createDemoState();
    const yard = s.containers.filter((c) => c.status !== 'GATED_OUT');
    expect(new Set(yard.map((c) => c.size))).toEqual(new Set(['20', '40', '45']));
    expect(yard.every((c) => c.shippingLineCode === 'MAERSK')).toBe(true);
    const cats = new Set(yard.map((c) => containerPaymentInfo(s, c).category).filter(Boolean));
    expect(cats).toEqual(new Set(['TTTT', 'TTT', 'TTS']));
    expect(yard.some((c) => c.isOnHold)).toBe(true);
    expect(yard.some((c) => c.needsQuotation)).toBe(true);
    expect(yard.some((c) => c.needsRepair)).toBe(true);
    expect(yard.some((c) => c.needsCleaning)).toBe(true);
    expect(s.paymentReceipts.some((r) => r.receiptNo.startsWith('PT-TT-'))).toBe(true);
    expect(s.paymentReceipts.some((r) => r.receiptNo.startsWith('PT-TTR-'))).toBe(true);
    expect(s.paymentTransactions.some((t) => t.status === 'PENDING')).toBe(true);
    expect(s.gateOutOrders.some((o) => o.status === 'GATE_OUT_OK')).toBe(true);
    expect(s.gateOutOrders.some((o) => o.status === 'PENDING_FORKLIFT')).toBe(true);
    expect(s.containers.some((c) => c.forkliftShiftTask === 'HA_KE_GIAM_DINH' && c.status === 'IN_YARD')).toBe(true);
    expect(s.containers.some((c) => c.forkliftShiftTask === 'HA_KE_GIAM_DINH' && c.status === 'WAITING_PLACEMENT')).toBe(true);
    expect(new Set(s.paymentReceipts.map((r) => r.invoiceStatus))).toEqual(new Set(['CHUA_XHD', 'YEU_CAU_XHD', 'DA_XHD']));
    expect(s.feedbacks.map((f) => f.status).sort()).toEqual(['DA_XU_LY', 'MOI']);
    expect(s.vesselLists.map((l) => l.mode).sort()).toEqual(['NHAP_TAU', 'XUAT_TAU']);
  });
});

describe('DEC-121: phiếu thu trả trước — cột MÃ HỒ SƠ là các tác nghiệp đã dùng phiếu', () => {
  it('phiếu nạp PT-TTR- → Excel MÃ HỒ SƠ = các HV- đã trừ tiền (không phải PTT-)', async () => {
    const { collectAllPages, queryReceipts, receiptsSheet } = await import('../src/services/reports');
    const s = createDemoState();
    const topup = s.paymentReceipts.find((r) => r.receiptNo.startsWith('PT-TTR-'))!;
    const sheet = receiptsSheet(s, collectAllPages((p) => queryReceipts(s, { receiptNo: topup.receiptNo }, p)));
    const cell = String(sheet.rows[0][sheet.columns.indexOf('MÃ HỒ SƠ')]);
    expect(cell).toMatch(/^HV-/);
    expect(cell).not.toMatch(/PTT-/);
    const { masterReceiptUsage } = await import('../src/services/payments');
    const used = masterReceiptUsage(s, topup.masterReceiptCode!)!.rows.length;
    expect(used).toBe(2); // dữ liệu test: 2 lượt Hạ vỏ trả trước
    expect(cell.split(', ')).toHaveLength(used);
    expect(sheet.rows[0][sheet.columns.indexOf('PHIẾU THU TRẢ TRƯỚC')]).toMatch(/^PTT-/);
  });
});
