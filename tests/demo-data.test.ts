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
    expect(s.vesselLists.map((l) => l.mode).sort()).toEqual(['NHAP_TAU', 'XUAT_TAU']);
  });
});
