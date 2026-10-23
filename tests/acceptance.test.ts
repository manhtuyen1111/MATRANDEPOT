import { describe, expect, it } from 'vitest';
import { createInitialState, DepotState, normalizeDepotState } from '../src/services/depotStore';
import {
  addRepairTeam,
  addStaffUser,
  updateStaffUser,
  addRepairTeamMember,
  approveDamageQuotation,
  setRepairTeamMemberActive,
  completeCleaningTask,
  completeRepairTask,
  confirmGateInPaymentAndComplete,
  confirmPrepaidCash,
  confirmReleasePayment,
  correctContainerLocation,
  createMasterPrepaidReceipt,
  createReleaseOrder,
  deleteGateInFieldRecord,
  executeGateOut,
  getBookingSummary,
  processBankTransferCallback,
  recordGateInFieldStep,
  releaseAllocatedContainer,
  shiftContainer,
  simulateDemoBankTransfer,
  toggleContainerHold,
  updateContainerLocation,
  verifyGateInOfficeAndCreatePayment,
} from '../src/services/depotOperations';
import { buildSummaryReport, queryGateInReport, queryGateOutReport, queryReceipts, queryRepairReport, toSpreadsheetXml, toXlsxBuffer } from '../src/services/reports';
import { allocateCode } from '../src/services/codes';
import { canOpenMenu } from '../src/services/permissions';

const as = (state: DepotState, userId: string): DepotState => ({
  ...state,
  currentUser: state.staffUsers.find((u) => u.id === userId)!,
});

const FEE_LOLO_40HC_MSK = 'fee-lolo-40-hc-maersk';
const FEE_RAC_40 = 'fee-rac-40';
const VIETLOG = 'Công ty Tiếp Vận Việt (VietLog)';

function fieldStep(state: DepotState, overrides: Partial<Parameters<typeof recordGateInFieldStep>[1]> = {}) {
  return recordGateInFieldStep(as(state, 'usr-inspector'), {
    gateInType: 'CUSTOMER_RETURN',
    doorPhotoUrl: 'data:image/jpeg;base64,AAA',
    conditionClass: 'AV',
    stuffingClass: 'E',
    cleaningItems: ['KHÔNG VỆ SINH'],
    manufactureYear: 2019,
    ...overrides,
  });
}

function officeStep(state: DepotState, gateInId: string, containerNo: string) {
  return verifyGateInOfficeAndCreatePayment(as(state, 'usr-office'), {
    gateInId,
    containerNo,
    size: '40',
    type: 'HC',
    truckNo: '15C-123.45',
    driverPhone: '0912 345 678',
    customerName: VIETLOG,
    shippingLineCode: 'MAERSK',
    orderDocNo: 'EIR-001',
    feeCatalogIds: [FEE_LOLO_40HC_MSK, FEE_RAC_40],
  });
}

// Hạ vỏ trọn gói tới GATE IN OK bằng TTS (không cần tiền)
function gateInTts(state: DepotState, containerNo: string, overrides = {}) {
  let s = fieldStep(state, overrides);
  const order = s.gateInOrders[0];
  s = officeStep(s, order.id, containerNo);
  s = confirmGateInPaymentAndComplete(as(s, 'usr-office'), {
    gateInId: order.id,
    paymentCategory: 'TTS',
    ttsNote: 'Hãng tàu duyệt công nợ',
  });
  return { state: s, order: s.gateInOrders.find((o) => o.id === order.id)! };
}

function placeInYard(state: DepotState, containerNo: string, slot = { blockCode: 'BLOCK-A' }) {
  return updateContainerLocation(as(state, 'usr-forklift'), { containerNo, ...slot, reason: 'Hạ vỏ' });
}

describe('HẠ VỎ — Giám định → Văn phòng → Thanh toán → GATE IN OK', () => {
  it('GIN-001/CR-07: mã hồ sơ IN-YYMMDD-NNN do hệ thống cấp, tăng dần, không nhận mã từ giao diện', () => {
    let s = fieldStep(createInitialState(), { initialContainerHint: 'HS-999999-999' });
    s = fieldStep(s);
    const [second, first] = s.gateInOrders;
    expect(first.masterDossierCode).toMatch(/^IN-\d{6}-001$/);
    expect(second.masterDossierCode).toMatch(/^IN-\d{6}-002$/);
    expect(first.initialContainerHint).toBeUndefined();
  });

  it('GIN-003/CR-04: Văn phòng nhập SĐT LÁI XE, chi phí chỉ lấy từ biểu giá (đơn giá theo danh mục)', () => {
    let s = fieldStep(createInitialState());
    const order = s.gateInOrders[0];
    s = officeStep(s, order.id, 'MSKU1234567');
    const updated = s.gateInOrders.find((o) => o.id === order.id)!;
    const voucher = s.vouchers.find((v) => v.id === updated.voucherId)!;
    expect(updated.driverPhone).toBe('0912345678');
    expect(updated.status).toBe('PAYMENT_PENDING');
    expect(voucher.amount).toBe(650000 + 150000);
    expect(voucher.status).toBe('PENDING');

    expect(() =>
      verifyGateInOfficeAndCreatePayment(as(s, 'usr-office'), {
        gateInId: order.id, containerNo: 'MSKU1234567', size: '40', type: 'HC', truckNo: '15C', driverPhone: '0912345678',
        customerName: VIETLOG, shippingLineCode: 'MAERSK', orderDocNo: '', feeCatalogIds: [],
      })
    ).toThrow(/CHI PHÍ/);
    expect(() =>
      verifyGateInOfficeAndCreatePayment(as(s, 'usr-office'), {
        gateInId: order.id, containerNo: 'MSKU1234567', size: '40', type: 'HC', truckNo: '15C', driverPhone: 'abc',
        customerName: VIETLOG, shippingLineCode: 'MAERSK', orderDocNo: '', feeCatalogIds: [FEE_RAC_40],
      })
    ).toThrow(/SĐT LÁI XE/);
  });

  it('GIN-004: không GATE IN OK khi chưa lập chứng từ', () => {
    const s = fieldStep(createInitialState());
    expect(() =>
      confirmGateInPaymentAndComplete(as(s, 'usr-office'), { gateInId: s.gateInOrders[0].id, paymentCategory: 'TTS', ttsNote: 'x' })
    ).toThrow(/GIN-004/);
  });

  it('GIN-006: chặn hai hồ sơ Hạ vỏ đang mở cho cùng số container', () => {
    let s = fieldStep(createInitialState());
    const a = s.gateInOrders[0];
    s = officeStep(s, a.id, 'MSKU1234567');
    s = fieldStep(s);
    const b = s.gateInOrders[0];
    expect(() => officeStep(s, b.id, 'MSKU1234567')).toThrow(/GIN-006/);
  });

  it('TTT: trừ dần Phiếu thu mẹ, GATE IN OK, không phát hành phiếu thu mới', () => {
    let s = fieldStep(createInitialState());
    const order = s.gateInOrders[0];
    s = officeStep(s, order.id, 'MSKU1234567');
    s = confirmGateInPaymentAndComplete(as(s, 'usr-office'), {
      gateInId: order.id, paymentCategory: 'TTT', scannedQrCode: 'QR-TTT-VIETLOG-001',
    });
    expect(s.gateInOrders.find((o) => o.id === order.id)!.status).toBe('GATE_IN_OK');
    expect(s.masterReceipts.find((r) => r.id === 'mpr-1')!.remainingAmount).toBe(13800000 - 800000);
    expect(s.paymentReceipts).toHaveLength(0);
    expect(s.k80Tickets[0].isPaid).toBe(true);
  });

  it('TTS: chứng từ DEFERRED (công nợ, chưa thu tiền) nhưng được GATE IN OK; K80 ghi chưa thanh toán', () => {
    const { state, order } = gateInTts(createInitialState(), 'MSKU1234567');
    expect(order.status).toBe('GATE_IN_OK');
    expect(state.vouchers.find((v) => v.id === order.voucherId)!.status).toBe('DEFERRED');
    expect(state.paymentReceipts).toHaveLength(0);
    expect(state.k80Tickets[0].isPaid).toBe(false);
  });

  it('TTTT tiền mặt: người có quyền xác nhận → giao dịch thành công → phát hành 1 PHIẾU THU PT-YYYY-NNNNNN', () => {
    let s = fieldStep(createInitialState());
    const order = s.gateInOrders[0];
    s = officeStep(s, order.id, 'MSKU1234567');
    s = confirmGateInPaymentAndComplete(as(s, 'usr-office'), { gateInId: order.id, paymentCategory: 'TTTT', directMethod: 'CASH' });
    expect(s.gateInOrders.find((o) => o.id === order.id)!.status).toBe('GATE_IN_OK');
    expect(s.paymentReceipts).toHaveLength(1);
    expect(s.paymentReceipts[0].receiptNo).toMatch(/^PT-\d{4}-000001$/);
    expect(s.paymentReceipts[0].dossierCode).toBe(order.masterDossierCode);
  });

  it('TTTT chuyển khoản: tạo QR KHÔNG phải đã thu; chỉ callback hợp lệ mới GATE IN OK; callback lặp không tạo phiếu thu trùng', () => {
    let s = fieldStep(createInitialState());
    const order = s.gateInOrders[0];
    s = officeStep(s, order.id, 'MSKU1234567');
    s = confirmGateInPaymentAndComplete(as(s, 'usr-office'), {
      gateInId: order.id, paymentCategory: 'TTTT', directMethod: 'BANK_TRANSFER_API',
    });
    const tx = s.paymentTransactions[0];
    expect(tx.status).toBe('PENDING');
    expect(s.gateInOrders.find((o) => o.id === order.id)!.status).toBe('PAYMENT_PENDING');
    expect(s.paymentReceipts).toHaveLength(0);

    // Không được đổi sang hình thức khác khi đang chờ chuyển khoản
    expect(() =>
      confirmGateInPaymentAndComplete(as(s, 'usr-office'), { gateInId: order.id, paymentCategory: 'TTS', ttsNote: 'x' })
    ).toThrow(/chuyển khoản/);

    // Sai số tiền: từ chối
    expect(() =>
      processBankTransferCallback(s, { paymentRef: tx.paymentRef, providerTxRef: 'VCB-1', amount: 1, success: true })
    ).toThrow(/không khớp/);

    s = processBankTransferCallback(s, { paymentRef: tx.paymentRef, providerTxRef: 'VCB-1', amount: tx.amount, success: true });
    expect(s.gateInOrders.find((o) => o.id === order.id)!.status).toBe('GATE_IN_OK');
    expect(s.paymentReceipts).toHaveLength(1);

    const again = processBankTransferCallback(s, { paymentRef: tx.paymentRef, providerTxRef: 'VCB-1', amount: tx.amount, success: true });
    expect(again.paymentReceipts).toHaveLength(1);
    expect(again.containers.filter((c) => c.containerNo === 'MSKU1234567')).toHaveLength(1);
  });

  it('PAY-003: ngân hàng báo thất bại → không ghi nhận thu tiền, không GATE IN OK', () => {
    let s = fieldStep(createInitialState());
    const order = s.gateInOrders[0];
    s = officeStep(s, order.id, 'MSKU1234567');
    s = confirmGateInPaymentAndComplete(as(s, 'usr-office'), { gateInId: order.id, paymentCategory: 'TTTT', directMethod: 'BANK_TRANSFER_API' });
    const tx = s.paymentTransactions[0];
    s = processBankTransferCallback(s, { paymentRef: tx.paymentRef, providerTxRef: 'VCB-FAIL', amount: tx.amount, success: false });
    expect(s.paymentTransactions[0].status).toBe('FAILED');
    expect(s.paymentReceipts).toHaveLength(0);
    expect(s.gateInOrders.find((o) => o.id === order.id)!.status).toBe('PAYMENT_PENDING');
  });

  it('Giả lập ngân hàng (Demo) đi qua cùng cơ chế chống trùng', () => {
    let s = fieldStep(createInitialState());
    const order = s.gateInOrders[0];
    s = officeStep(s, order.id, 'MSKU1234567');
    s = confirmGateInPaymentAndComplete(as(s, 'usr-office'), { gateInId: order.id, paymentCategory: 'TTTT', directMethod: 'BANK_TRANSFER_API' });
    const txId = s.paymentTransactions[0].id;
    s = simulateDemoBankTransfer(s, { transactionId: txId });
    s = simulateDemoBankTransfer(s, { transactionId: txId });
    expect(s.paymentReceipts).toHaveLength(1);
    expect(s.gateInOrders.find((o) => o.id === order.id)!.status).toBe('GATE_IN_OK');
  });
});

describe('CR-03 & DEC-035: Vệ sinh trước Xe nâng hạ vỏ; quyền hoàn tất từng bộ phận', () => {
  it('Container có yêu cầu vệ sinh chỉ được hạ vỏ sau khi Vệ sinh xác nhận', () => {
    let { state: s } = gateInTts(createInitialState(), 'MSKU1234567', { cleaningItems: ['WW - RỬA NƯỚC'] });
    expect(() => placeInYard(s, 'MSKU1234567')).toThrow(/CR-03/);
    expect(() => completeCleaningTask(as(s, 'usr-forklift'), { containerNo: 'MSKU1234567' })).toThrow(/Không đủ quyền/);
    s = completeCleaningTask(as(s, 'usr-office'), { containerNo: 'MSKU1234567' });
    s = placeInYard(s, 'MSKU1234567');
    const c = s.containers.find((x) => x.containerNo === 'MSKU1234567' && x.status !== 'GATED_OUT')!;
    expect(c.status).toBe('IN_YARD');
    expect(s.workOrders.find((w) => w.masterDossierCode === c.masterDossierCode && w.category === 'CLEANING')!.workStatus).toBe('COMPLETED');
  });

  it('DAMAGE (DEC-040): chỉ BÁO GIÁ nhập remark → Chờ sửa chữa (không cần số tiền); chỉ SỬA CHỮA hoàn tất → AV', () => {
    let { state: s } = gateInTts(createInitialState(), 'MSKU1234567', { conditionClass: 'DAMAGE', damageRemarks: ['Móp vách'] });
    s = placeInYard(s, 'MSKU1234567');
    const quote = { containerNo: 'MSKU1234567', quotationItems: ['Móp vách'], laborHours: 2.5 };
    expect(() => approveDamageQuotation(as(s, 'usr-quotation'), { ...quote, quotationItems: [' '] })).toThrow(/REMARK/);
    expect(() => approveDamageQuotation(as(s, 'usr-quotation'), { ...quote, laborHours: 0 })).toThrow(/GIỜ CÔNG/);
    expect(() => approveDamageQuotation(as(s, 'usr-inspector'), quote)).toThrow(/Không đủ quyền/);
    expect(() => approveDamageQuotation(as(s, 'usr-office'), quote)).toThrow(/Không đủ quyền/);
    s = approveDamageQuotation(as(s, 'usr-quotation'), quote);
    const repair = { containerNo: 'MSKU1234567', teamId: 'rt-1', memberIds: ['rtm-1'] };
    expect(() => completeRepairTask(as(s, 'usr-office'), repair)).toThrow(/Không đủ quyền/);
    expect(() => completeRepairTask(as(s, 'usr-repair'), { ...repair, teamId: '' })).toThrow(/TỔ SỬA CHỮA/);
    expect(() => completeRepairTask(as(s, 'usr-repair'), { ...repair, memberIds: [] })).toThrow(/ít nhất 1 nhân viên/);
    expect(() => completeRepairTask(as(s, 'usr-repair'), { ...repair, memberIds: ['rtm-x'] })).toThrow();
    s = completeRepairTask(as(s, 'usr-repair'), repair);
    const c = s.containers.find((x) => x.containerNo === 'MSKU1234567')!;
    expect(c.conditionClass).toBe('AV');
    expect(c.needsRepair).toBe(false);
    const wo = s.workOrders.find((w) => w.masterDossierCode === c.masterDossierCode && w.category === 'REPAIR')!;
    expect(wo.laborHours).toBe(2.5);
    expect(wo.repairTeamCode).toBe('TO-SC-01');
    expect(wo.repairMembers).toEqual(['Đặng Kỹ Thuật Sửa Chữa']);

    // DEC-044: báo cáo sửa chữa chi tiết bắt buộc lọc, lọc được theo tổ
    expect(() => queryRepairReport(s, {})).toThrow(/khoảng thời gian/);
    expect(queryRepairReport(s, { containerNo: 'MSKU1234567', teamCode: 'TO-SC-01' }).total).toBe(1);
    expect(queryRepairReport(s, { containerNo: 'MSKU1234567', teamCode: 'TO-KHAC' }).total).toBe(0);
  });

  it('DEC-042: Danh mục tổ sửa chữa — chỉ ADMIN; thêm tổ, thêm / ngưng nhân viên', () => {
    const s0 = createInitialState();
    expect(() => addRepairTeam(as(s0, 'usr-office'), { code: 'TO-2', name: 'Tổ 2' })).toThrow(/ADMIN/);
    let s = addRepairTeam(as(s0, 'usr-admin'), { code: 'to-2', name: 'Tổ 2' });
    expect(() => addRepairTeam(s, { code: 'TO-2', name: 'Trùng' })).toThrow(/đã tồn tại/);
    const team = s.repairTeams.find((t) => t.code === 'TO-2')!;
    s = addRepairTeamMember(s, { teamId: team.id, fullName: 'Trần Văn A' });
    expect(() => addRepairTeamMember(s, { teamId: team.id, fullName: 'trần văn a' })).toThrow(/đã có/);
    const member = s.repairTeams.find((t) => t.id === team.id)!.members[0];
    s = setRepairTeamMemberActive(s, { teamId: team.id, memberId: member.id, isActive: false });
    expect(s.repairTeams.find((t) => t.id === team.id)!.members[0].isActive).toBe(false);
  });
});

describe('CR-01/CR-02: ĐẢO CHUYỂN, SỬA VỊ TRÍ, KHÓA CONTAINER', () => {
  it('YARD-002: ĐẢO CHUYỂN lưu lịch sử tác nghiệp (tên, thời gian, nhân sự, trước/sau)', () => {
    const s0 = createInitialState();
    const c = s0.containers.find((x) => x.containerNo === 'MSKU4089123')!;
    const s = shiftContainer(as(s0, 'usr-forklift'), { containerId: c.id, blockCode: 'BLOCK-B', bay: '01', row: '01', tier: '01' });
    const h = s.locationHistory[0];
    expect(h.actionType).toBe('YARD_SHIFT');
    expect(h.fromLocation).toBe('BLOCK-A / 04-02-01');
    expect(h.toLocation).toBe('BLOCK-B / 01-01-01');
    expect(h.performedBy).toBe('Phạm Hoàng Xe Nâng');
    expect(h.performedAt).toBeTruthy();
  });

  it('YARD-003/004: từ chối ô ngoài cấu hình và ô đã có container', () => {
    const s0 = as(createInitialState(), 'usr-forklift');
    const one = s0.containers.find((x) => x.containerNo === 'ONEU2291045')!;
    expect(() => shiftContainer(s0, { containerId: one.id, blockCode: 'BLOCK-A', bay: '04', row: '02', tier: '01' })).toThrow(/đang có container/);
    expect(() => shiftContainer(s0, { containerId: one.id, blockCode: 'BLOCK-A', bay: '99', row: '01', tier: '01' })).toThrow(/ngoài cấu hình/);
    expect(() => shiftContainer(s0, { containerId: one.id, blockCode: 'BLOCK-A', bay: '01' })).toThrow(/đủ cả 3/);
  });

  it('Không đảo chuyển / sửa vị trí container chưa có vị trí chính thức', () => {
    const s0 = createInitialState();
    const waiting = s0.containers.find((x) => x.containerNo === 'MSKU9102388')!;
    expect(() => shiftContainer(as(s0, 'usr-forklift'), { containerId: waiting.id, blockCode: 'BLOCK-A' })).toThrow(/vị trí chính thức/);
    expect(() => correctContainerLocation(as(s0, 'usr-office'), { containerId: waiting.id, blockCode: 'BLOCK-A' })).toThrow(/vị trí chính thức/);
  });

  it('SỬA VỊ TRÍ hành chính: chỉ Văn phòng/Quản lý, không tạo lịch sử ĐẢO CHUYỂN, có nhật ký kiểm toán', () => {
    const s0 = createInitialState();
    const c = s0.containers.find((x) => x.containerNo === 'MSKU4089123')!;
    expect(() => correctContainerLocation(as(s0, 'usr-forklift'), { containerId: c.id, blockCode: 'BLOCK-B' })).toThrow(/Không đủ quyền/);
    const s = correctContainerLocation(as(s0, 'usr-office'), { containerId: c.id, blockCode: 'BLOCK-B' });
    expect(s.locationHistory).toHaveLength(s0.locationHistory.length);
    expect(s.containers.find((x) => x.id === c.id)!.currentBlock).toBe('BLOCK-B');
    expect(s.auditLogs[0].actionCode).toBe('YARD_LOCATION_CORRECTION');
  });

  it('KHÓA: bắt buộc ghi chú; bị khóa thì không CẤP VỎ, vẫn ĐẢO CHUYỂN & SỬA VỊ TRÍ được', () => {
    let s = as(createInitialState(), 'usr-office');
    expect(() => toggleContainerHold(s, { containerNo: 'MSKU4089123', hold: true, reason: '  ' })).toThrow(/GHI CHÚ/);
    s = toggleContainerHold(s, { containerNo: 'MSKU4089123', hold: true, reason: 'Hãng tàu yêu cầu giữ' });
    const c = s.containers.find((x) => x.containerNo === 'MSKU4089123')!;
    expect(c.isOnHold).toBe(true);
    expect(() =>
      createReleaseOrder(s, {
        bookingNo: 'BK-NEW-1', customerName: VIETLOG, containerNo: 'MSKU4089123', truckNo: '15H-1', driverPhone: '0912345678',
        feeCatalogIds: [FEE_LOLO_40HC_MSK],
      })
    ).toThrow(/KHÓA/);
    s = shiftContainer(as(s, 'usr-forklift'), { containerId: c.id, blockCode: 'BLOCK-B' });
    s = correctContainerLocation(as(s, 'usr-office'), { containerId: c.id, blockCode: 'BLOCK-A' });
    expect(s.containers.find((x) => x.id === c.id)!.currentBlock).toBe('BLOCK-A');
  });
});

describe('CR-05 CẤP VỎ — booking tự đếm, thu phí tại Văn phòng như Hạ vỏ, Xe nâng xuất bãi', () => {
  const order = (s: DepotState, containerNo: string, bookingNo = 'BK-MSK-2026-109') =>
    createReleaseOrder(as(s, 'usr-office'), {
      bookingNo, customerName: VIETLOG, containerNo, truckNo: '15H-999.99', driverPhone: '0987654321',
      feeCatalogIds: [FEE_LOLO_40HC_MSK],
    });

  it('REL-001/GOUT-001: lập lệnh → TTS → K80 cấp vỏ → Xe nâng OUT; booking đếm số đã cấp', () => {
    let s = order(createInitialState(), 'MSKU4089123');
    const go = s.gateOutOrders[0];
    expect(go.gateOutCode).toMatch(/^OUT-\d{6}-001$/);
    expect(go.status).toBe('PAYMENT_PENDING');
    // Chưa thanh toán: Xe nâng không được xuất
    expect(() => executeGateOut(as(s, 'usr-forklift'), { containerNo: 'MSKU4089123' })).toThrow(/Điều kiện 4/);

    s = confirmReleasePayment(as(s, 'usr-office'), { gateOutOrderId: go.id, paymentCategory: 'TTS', ttsNote: 'Công nợ hãng tàu' });
    expect(s.gateOutOrders[0].status).toBe('PENDING_FORKLIFT');
    expect(s.k80Tickets[0].operationMode).toBe('CAP_VO');
    expect(s.k80Tickets[0].outDossierCode).toBe(go.gateOutCode);

    s = executeGateOut(as(s, 'usr-forklift'), { containerNo: 'MSKU4089123' });
    expect(s.containers.find((c) => c.containerNo === 'MSKU4089123')!.status).toBe('GATED_OUT');
    // Booking mẫu đã có sẵn 1 hồ sơ OUT (gout-1) — hệ thống đếm theo hồ sơ thực tế
    const summary = getBookingSummary(s, 'bk-msk-2026-109');
    expect(summary.gatedOut.map((o) => o.containerNo)).toEqual(['MSKU4089123', 'MSKU3190024']);
    expect(summary.issued).toHaveLength(2);
    expect(s.bookings.find((b) => b.bookingNo === 'BK-MSK-2026-109')!.allocatedContainers).toEqual([]);

    // GOUT-003 & lỗi cũ: container đã OUT không thể bị giải phóng về IN_YARD hay xuất lần nữa
    expect(() => releaseAllocatedContainer(as(s, 'usr-office'), { containerNo: 'MSKU4089123', reason: 'x' })).toThrow();
    expect(() => executeGateOut(as(s, 'usr-forklift'), { containerNo: 'MSKU4089123' })).toThrow(/GOUT-003/);
  });

  it('REL-002: không lập 2 lệnh cho cùng container', () => {
    const s = order(createInitialState(), 'MSKU4089123');
    expect(() => order(s, 'MSKU4089123', 'BK-OTHER')).toThrow(/Đã lập lệnh cấp/);
  });

  it('Booking mới chỉ cần số booking, không gán cứng số lượng', () => {
    const s = order(createInitialState(), 'MSKU4089123', 'bk-new-777');
    const b = s.bookings.find((x) => x.bookingNo === 'BK-NEW-777')!;
    expect(b.requestedQty).toBeUndefined();
    expect(getBookingSummary(s, 'BK-NEW-777').issued).toHaveLength(1);
  });

  it('DEC-027: chờ vệ sinh thì không được cấp; DAMAGE được cấp theo chỉ định (không cần ghi chú)', () => {
    const s0 = createInitialState();
    expect(() =>
      createReleaseOrder(as(s0, 'usr-office'), {
        bookingNo: 'BK-ONE', customerName: VIETLOG, containerNo: 'ONEU2291045', truckNo: '15H', driverPhone: '0912345678',
        feeCatalogIds: ['fee-lolo-20-dc-one'],
      })
    ).toThrow(/vệ sinh/);

    let { state: s } = gateInTts(s0, 'MSKU7654321', { conditionClass: 'DAMAGE', damageRemarks: ['Thủng nóc'] });
    s = placeInYard(s, 'MSKU7654321');
    s = order(s, 'MSKU7654321', 'BK-DAMAGE-1');
    const go = s.gateOutOrders[0];
    s = confirmReleasePayment(as(s, 'usr-office'), { gateOutOrderId: go.id, paymentCategory: 'TTTT', directMethod: 'CASH' });
    s = executeGateOut(as(s, 'usr-forklift'), { containerNo: 'MSKU7654321' });
    const out = s.containers.find((c) => c.containerNo === 'MSKU7654321')!;
    expect(out.status).toBe('GATED_OUT');
    expect(out.needsQuotation).toBe(false);
    expect(s.workOrders.find((w) => w.masterDossierCode === out.masterDossierCode && w.category === 'INSPECTION')!.workStatus).toBe('CANCELLED');
    expect(s.paymentReceipts[0].dossierCode).toBe(go.gateOutCode);
  });

  it('REL-004: hủy lệnh chưa thanh toán được; đã thanh toán thì chặn (chưa có quy trình hoàn tiền)', () => {
    let s = order(createInitialState(), 'MSKU4089123');
    s = releaseAllocatedContainer(as(s, 'usr-office'), { containerNo: 'MSKU4089123', reason: 'Khách đổi lịch' });
    expect(s.containers.find((c) => c.containerNo === 'MSKU4089123')!.status).toBe('IN_YARD');
    expect(getBookingSummary(s, 'BK-MSK-2026-109').cancelled).toHaveLength(1);

    s = order(s, 'MSKU4089123');
    s = confirmReleasePayment(as(s, 'usr-office'), { gateOutOrderId: s.gateOutOrders[0].id, paymentCategory: 'TTS', ttsNote: 'x' });
    expect(() => releaseAllocatedContainer(as(s, 'usr-office'), { containerNo: 'MSKU4089123', reason: 'x' })).toThrow(/hoàn tiền/);
  });

  it('Container quay lại bãi lần 2 vẫn giữ lượt lưu bãi cũ đã OUT', () => {
    let s = order(createInitialState(), 'MSKU4089123');
    s = confirmReleasePayment(as(s, 'usr-office'), { gateOutOrderId: s.gateOutOrders[0].id, paymentCategory: 'TTS', ttsNote: 'x' });
    s = executeGateOut(as(s, 'usr-forklift'), { containerNo: 'MSKU4089123' });
    s = gateInTts(s, 'MSKU4089123').state;
    const visits = s.containers.filter((c) => c.containerNo === 'MSKU4089123');
    expect(visits.map((v) => v.status).sort()).toEqual(['GATED_OUT', 'WAITING_PLACEMENT']);
  });
});

describe('CR-04 PHIẾU THU — Văn phòng tạo phiếu thu TTT', () => {
  it('DEC-047: Văn phòng tạo phiếu thu TTT (bỏ Kế toán); tạo xong là CHỜ THANH TOÁN, QR chưa dùng được; xác nhận tiền mặt → phiếu thu + Phiếu thu mẹ ACTIVE', () => {
    const s0 = createInitialState();
    const input = { customerCode: 'VIETLOG', lotDescription: 'Lô 10 cont', totalAmount: 5000000, method: 'CASH' as const };
    expect(() => createMasterPrepaidReceipt(as(s0, 'usr-forklift'), input)).toThrow(/Không đủ quyền/);
    let s = createMasterPrepaidReceipt(as(s0, 'usr-office'), input);
    const master = s.masterReceipts[0];
    expect(master.status).toBe('PENDING_PAYMENT');
    expect(master.receiptCode).toMatch(/^PTM-\d{4}-003$/);
    expect(s.paymentReceipts).toHaveLength(0);

    // Dùng QR khi chưa thu tiền nạp → từ chối
    let g = fieldStep(s);
    const gi = g.gateInOrders[0];
    g = officeStep(g, gi.id, 'MSKU1234567');
    expect(() =>
      confirmGateInPaymentAndComplete(as(g, 'usr-office'), { gateInId: gi.id, paymentCategory: 'TTT', scannedQrCode: master.qrCode })
    ).toThrow(/chưa được thu tiền/);

    expect(() => confirmPrepaidCash(as(s, 'usr-forklift'), { transactionId: s.paymentTransactions[0].id })).toThrow(/Không đủ quyền/);
    s = confirmPrepaidCash(as(s, 'usr-office'), { transactionId: s.paymentTransactions[0].id });
    expect(s.masterReceipts[0].status).toBe('ACTIVE');
    expect(s.masterReceipts[0].remainingAmount).toBe(5000000);
    expect(s.paymentReceipts).toHaveLength(1);
    expect(s.paymentReceipts[0].masterReceiptCode).toBe(master.receiptCode);
    expect(() => confirmPrepaidCash(as(s, 'usr-office'), { transactionId: s.paymentTransactions[0].id })).toThrow();
  });

  it('PT-YYYY-NNNNNN tăng dần và không trùng', () => {
    let s = createInitialState();
    const a = allocateCode(s, 'PT');
    s = a.state;
    const b = allocateCode(s, 'PT');
    expect(a.code).not.toBe(b.code);
    expect(b.code).toMatch(/^PT-\d{4}-000002$/);
  });

  it('Tra cứu phiếu thu bắt buộc có bộ lọc', () => {
    const s = createInitialState();
    expect(() => queryReceipts(s, {})).toThrow(/khoảng thời gian/);
    expect(queryReceipts(s, { keyword: 'PT-' }).total).toBe(0);
  });
});

describe('CR-08 BÁO CÁO & phân quyền menu', () => {
  it('Báo cáo cấp vỏ không tự tải: phải có số container hoặc khoảng thời gian; có phân trang', () => {
    const s = createInitialState();
    expect(() => queryGateOutReport(s, ['EMPTY_RELEASE'], {})).toThrow(/số container hoặc chọn khoảng thời gian/);
    const r = queryGateOutReport(s, ['EMPTY_RELEASE'], { containerNo: 'MSKU3190024' });
    expect(r.total).toBe(1);
    expect(r.pageCount).toBe(1);
  });

  it('Báo cáo TỔNG HỢP gồm đúng 5 sheet, bắt buộc khoảng thời gian, TỒN VỎ theo thời điểm hiện tại', () => {
    const s = createInitialState();
    expect(() => buildSummaryReport(s, {})).toThrow(/khoảng thời gian/);
    const sheets = buildSummaryReport(s, { dateFrom: '2026-10-01', dateTo: '2026-10-31' });
    expect(sheets.map((x) => x.name)).toEqual(['HẠ VỎ', 'CẤP VỎ', 'XUẤT VỎ', 'NHẬP VỎ', 'TỒN VỎ']);
    expect(sheets[4].rows).toHaveLength(s.containers.filter((c) => c.status !== 'GATED_OUT').length);
    expect(toSpreadsheetXml(sheets)).toContain('ss:Name="TỒN VỎ"');
  });

  it('Menu chỉ hiển thị theo quyền', () => {
    const s = createInitialState();
    const user = (id: string) => s.staffUsers.find((u) => u.id === id)!;
    expect(canOpenMenu(user('usr-forklift'), 'XN_DAO_CHUYEN')).toBe(true);
    expect(canOpenMenu(user('usr-forklift'), 'VP_PHIEU_THU')).toBe(false);
    expect(canOpenMenu(user('usr-quotation'), 'BG_CHO_BAO_GIA')).toBe(true);
    expect(canOpenMenu(user('usr-inspector'), 'BG_CHO_BAO_GIA')).toBe(false);
    expect(canOpenMenu(user('usr-admin'), 'BC_TONG_HOP')).toBe(true);
  });
});

describe('Dữ liệu demo cũ trong localStorage', () => {
  it('Chuẩn hóa không làm mất dữ liệu; TTS cũ CONFIRMED → DEFERRED; bổ sung nhân sự Báo giá', () => {
    const legacy = createInitialState() as Partial<DepotState>;
    delete legacy.paymentTransactions;
    delete legacy.paymentReceipts;
    delete legacy.codeCounters;
    legacy.staffUsers = legacy.staffUsers!.filter((u) => u.id !== 'usr-quotation');
    legacy.vouchers = [{ ...legacy.vouchers![0], paymentCategory: 'TTS', status: 'CONFIRMED' }];
    const s = normalizeDepotState(legacy);
    expect(s.containers).toHaveLength(legacy.containers!.length);
    expect(s.vouchers[0].status).toBe('DEFERRED');
    expect(s.staffUsers.some((u) => u.id === 'usr-quotation')).toBe(true);
    expect(s.paymentReceipts).toEqual([]);
  });
});

describe('DEC-045 USER - PHÂN QUYỀN & Báo cáo Hạ vỏ', () => {
  it('Mỗi vai trò chỉ thấy màn làm việc của mình', () => {
    const s = createInitialState();
    const u = (id: string) => s.staffUsers.find((x) => x.id === id)!;
    expect(canOpenMenu(u('usr-forklift'), 'XN_CHO_HA_VO')).toBe(true);
    expect(canOpenMenu(u('usr-forklift'), 'TON_VO')).toBe(false);
    expect(canOpenMenu(u('usr-forklift'), 'BC_CAP_VO')).toBe(false);
    expect(canOpenMenu(u('usr-cleaning'), 'DM_BIEU_GIA')).toBe(false);
    expect(canOpenMenu(u('usr-repair'), 'SC_CHO_SUA_CHUA')).toBe(true);
    expect(canOpenMenu(u('usr-repair'), 'BG_CHO_BAO_GIA')).toBe(false);
    expect(canOpenMenu(u('usr-repair'), 'BC_SUA_CHUA')).toBe(false);
    expect(canOpenMenu(u('usr-office'), 'DM_USER')).toBe(false);
    expect(canOpenMenu(u('usr-admin'), 'DM_USER')).toBe(true);
  });

  it('Chỉ ADMIN thêm / sửa user; giữ ít nhất 1 ADMIN; không tự khóa', () => {
    const s0 = createInitialState();
    const input = { fullName: 'Nguyễn QC', email: 'qc2@matrandepot.vn', roles: ['REPAIR_STAFF' as const] };
    expect(() => addStaffUser(as(s0, 'usr-office'), input)).toThrow(/ADMIN/);
    let s = addStaffUser(as(s0, 'usr-admin'), input);
    expect(() => addStaffUser(s, input)).toThrow(/đã tồn tại/);
    expect(() => addStaffUser(s, { ...input, email: 'x@y.vn', roles: [] })).toThrow(/ít nhất 1 vai trò/);
    const added = s.staffUsers.find((x) => x.email === 'qc2@matrandepot.vn')!;
    s = updateStaffUser(s, { userId: added.id, roles: ['CLEANING'] });
    expect(s.staffUsers.find((x) => x.id === added.id)!.roles).toEqual(['CLEANING']);
    expect(() => updateStaffUser(s, { userId: 'usr-admin', isActive: false })).toThrow(/tự khóa/);
    expect(() => updateStaffUser(s, { userId: 'usr-admin', roles: ['MANAGER'] })).toThrow(/ít nhất 1 tài khoản ADMIN/);
  });

  it('Báo cáo Hạ vỏ lấy dữ liệu HẠ VỎ, bắt buộc lọc', () => {
    const { state: s } = gateInTts(createInitialState(), 'MSKU1234567');
    expect(() => queryGateInReport(s, 'CUSTOMER_RETURN', {})).toThrow(/khoảng thời gian/);
    const r = queryGateInReport(s, 'CUSTOMER_RETURN', { containerNo: 'MSKU1234567' });
    expect(r.total).toBe(1);
    expect(r.rows[0].driverPhone).toBe('0912345678');
  });
});

describe('DEC-047 / DEC-048', () => {
  it('Vai trò cũ trong dữ liệu đã lưu: cổng / hiện trường → Giám định, Kế toán → Văn phòng', () => {
    const legacy = createInitialState() as Partial<DepotState>;
    legacy.staffUsers = [{ id: 'u1', staffCode: 'X', fullName: 'A', email: 'a@b.vn', isActive: true, roles: ['GATE_STAFF', 'YARD_STAFF', 'ACCOUNTANT'] as never }];
    expect(normalizeDepotState(legacy).staffUsers.find((u) => u.id === 'u1')!.roles).toEqual(['INSPECTOR', 'OFFICE']);
  });

  it('Thêm user Sửa chữa có sẵn vào tổ; không thêm trùng; user bị khóa không thêm được', () => {
    let s = addStaffUser(as(createInitialState(), 'usr-admin'), { fullName: 'Thợ Test', email: 'tho@test.vn', roles: ['REPAIR_STAFF'] });
    const u = s.staffUsers.find((x) => x.email === 'tho@test.vn')!;
    s = addRepairTeamMember(s, { teamId: 'rt-1', staffUserId: u.id });
    const m = s.repairTeams[0].members.find((x) => x.staffUserId === u.id)!;
    expect(m.fullName).toBe('Thợ Test');
    expect(() => addRepairTeamMember(s, { teamId: 'rt-1', staffUserId: u.id })).toThrow(/đã có/);
    s = updateStaffUser(s, { userId: u.id, isActive: false });
    expect(() => addRepairTeamMember(s, { teamId: 'rt-1', staffUserId: u.id })).toThrow();
  });

});

describe('DEC-049: bỏ QC Sửa chữa', () => {
  it('Sửa chữa hoàn tất là AV; vai trò QC cũ trong dữ liệu lưu → Sửa chữa; container "chờ nghiệm thu" cũ → AV', () => {
    const legacy = createInitialState() as Partial<DepotState>;
    legacy.staffUsers = [{ id: 'u-qc', staffCode: 'Q', fullName: 'QC', email: 'qc@x.vn', isActive: true, roles: ['REPAIR_QC'] as never }];
    legacy.containers = [{ ...legacy.containers![2], needsQcInspection: true } as never];
    const s = normalizeDepotState(legacy);
    expect(s.staffUsers[0].roles).toEqual(['REPAIR_STAFF']);
    expect(s.containers[0].conditionClass).toBe('AV');
    expect('needsQcInspection' in s.containers[0]).toBe(false);
  });
});

describe('Q-034: xuất Excel .xlsx chuẩn', () => {
  it('Báo cáo Tổng hợp → file .xlsx đọc lại được, đủ 5 sheet, có dòng tiêu đề', async () => {
    const sheets = buildSummaryReport(createInitialState(), { dateFrom: '2026-10-01', dateTo: '2026-10-31' });
    const buf = await toXlsxBuffer(sheets);
    const { default: ExcelJS } = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(buf);
    expect(wb.worksheets.map((w) => w.name)).toEqual(['HẠ VỎ', 'CẤP VỎ', 'XUẤT VỎ', 'NHẬP VỎ', 'TỒN VỎ']);
    const ton = wb.getWorksheet('TỒN VỎ')!;
    expect(ton.getRow(1).getCell(2).value).toBe('SỐ CONTAINER');
    expect(ton.rowCount).toBe(sheets[4].rows.length + 1);
  });
});

describe('DEC-051: phiếu thu ghi rõ tác nghiệp', () => {
  it('Hạ vỏ tiền mặt → HA_VO; Cấp vỏ tiền mặt → CAP_VO; nạp TTT → THU_TRUOC; lọc theo tác nghiệp / mở theo mã phiếu', () => {
    let s = fieldStep(createInitialState());
    const gi = s.gateInOrders[0];
    s = officeStep(s, gi.id, 'MSKU1234567');
    s = confirmGateInPaymentAndComplete(as(s, 'usr-office'), { gateInId: gi.id, paymentCategory: 'TTTT', directMethod: 'CASH' });
    s = createReleaseOrder(as(s, 'usr-office'), {
      bookingNo: 'BK-X', customerName: VIETLOG, containerNo: 'MSKU4089123', truckNo: '15H', driverPhone: '0912345678',
      feeCatalogIds: [FEE_LOLO_40HC_MSK],
    });
    s = confirmReleasePayment(as(s, 'usr-office'), { gateOutOrderId: s.gateOutOrders[0].id, paymentCategory: 'TTTT', directMethod: 'CASH' });
    s = createMasterPrepaidReceipt(as(s, 'usr-office'), { customerCode: 'VIETLOG', lotDescription: '', totalAmount: 1000000, method: 'CASH' });
    s = confirmPrepaidCash(as(s, 'usr-office'), { transactionId: s.paymentTransactions[0].id });

    const ops = s.paymentReceipts.map((r) => r.operation).sort();
    expect(ops).toEqual(['CAP_VO', 'HA_VO', 'THU_TRUOC']);
    const today = new Date().toISOString().slice(0, 10);
    expect(queryReceipts(s, { dateFrom: today, dateTo: today, operation: 'CAP_VO' }).total).toBe(1);
    const ha = s.paymentReceipts.find((r) => r.operation === 'HA_VO')!;
    const found = queryReceipts(s, { receiptNo: ha.receiptNo });
    expect(found.total).toBe(1);
    expect(found.rows[0].receipt!.receiptNo).toBe(ha.receiptNo);
  });
});

describe('DEC-052: lộ trình phiếu K80 & Văn phòng trả chứng từ', () => {
  it('Hạ vỏ có vệ sinh: 4 bước; chưa qua Vệ sinh / Xe nâng thì không trả được; xong thì trả 1 lần, kèm phiếu thu', async () => {
    const { confirmDocumentsReturn, getDriverRoute, ticketsAwaitingReturn } = await import('../src/services/driverRoute');
    let s = fieldStep(createInitialState(), { cleaningItems: ['WW - RỬA NƯỚC'] });
    const gi = s.gateInOrders[0];
    s = officeStep(s, gi.id, 'MSKU1234567');
    s = confirmGateInPaymentAndComplete(as(s, 'usr-office'), { gateInId: gi.id, paymentCategory: 'TTTT', directMethod: 'CASH' });
    const ticket = s.k80Tickets[0];
    expect(getDriverRoute(s, ticket).map((x) => x.dept)).toEqual(['VĂN PHÒNG', 'VỆ SINH', 'XE NÂNG', 'VĂN PHÒNG']);

    expect(() => confirmDocumentsReturn(as(s, 'usr-office'), { scannedQrCode: ticket.qrCode })).toThrow(/VỆ SINH/);
    s = completeCleaningTask(as(s, 'usr-cleaning'), { containerNo: 'MSKU1234567' });
    expect(() => confirmDocumentsReturn(as(s, 'usr-office'), { scannedQrCode: ticket.qrCode })).toThrow(/XE NÂNG/);
    s = placeInYard(s, 'MSKU1234567');
    expect(ticketsAwaitingReturn(s).map((t) => t.containerNo)).toContain('MSKU1234567');
    expect(() => confirmDocumentsReturn(as(s, 'usr-forklift'), { scannedQrCode: ticket.qrCode })).toThrow(/Không đủ quyền/);

    const res = confirmDocumentsReturn(as(s, 'usr-office'), { scannedQrCode: ticket.qrCode });
    expect(res.pack.receipts).toHaveLength(1);
    expect(getDriverRoute(res.state, ticket).every((x) => x.done)).toBe(true);
    expect(() => confirmDocumentsReturn(res.state, { scannedQrCode: ticket.qrCode })).toThrow(/Đã trả chứng từ/);
  });

  it('Cấp vỏ: Văn phòng → Xe nâng → Văn phòng; TTS không có phiếu thu', async () => {
    const { confirmDocumentsReturn, getDriverRoute } = await import('../src/services/driverRoute');
    let s = createReleaseOrder(as(createInitialState(), 'usr-office'), {
      bookingNo: 'BK-R', customerName: VIETLOG, containerNo: 'MSKU4089123', truckNo: '15H', driverPhone: '0912345678', feeCatalogIds: [FEE_LOLO_40HC_MSK],
    });
    s = confirmReleasePayment(as(s, 'usr-office'), { gateOutOrderId: s.gateOutOrders[0].id, paymentCategory: 'TTS', ttsNote: 'x' });
    const ticket = s.k80Tickets[0];
    expect(getDriverRoute(s, ticket).map((x) => x.dept)).toEqual(['VĂN PHÒNG', 'XE NÂNG', 'VĂN PHÒNG']);
    expect(() => confirmDocumentsReturn(as(s, 'usr-office'), { scannedQrCode: ticket.qrCode })).toThrow(/XE NÂNG/);
    s = executeGateOut(as(s, 'usr-forklift'), { containerNo: 'MSKU4089123' });
    const res = confirmDocumentsReturn(as(s, 'usr-office'), { scannedQrCode: ticket.qrCode });
    expect(res.pack.dossierCode).toMatch(/^OUT-/);
    expect(res.pack.receipts).toHaveLength(0);
  });
});

describe('DEC-054: định dạng thời gian dd/MM/yyyy HH:mm:ss', () => {
  it('Hiển thị & đọc chuẩn; từ chối ngày sai; lọc theo giờ phút giây', async () => {
    const { formatDateTime, parseDateTime, maskDateTimeInput } = await import('../src/services/datetime');
    expect(formatDateTime(new Date(2026, 9, 23, 7, 5, 9))).toBe('23/10/2026 07:05:09');
    expect(parseDateTime('23/10/2026 07:05:09')!.getSeconds()).toBe(9);
    expect(parseDateTime('23/10/2026', 'end')!.getHours()).toBe(23);
    expect(parseDateTime('31/02/2026 00:00:00')).toBeNull();
    expect(parseDateTime('23/10/2026 25:00:00')).toBeNull();
    expect(maskDateTimeInput('23102026070509')).toBe('23/10/2026 07:05:09');

    // Phiếu thu tạo "bây giờ": khoảng kết thúc 1 giây trước → không thấy; khoảng bao quanh → thấy
    let s = fieldStep(createInitialState());
    const gi = s.gateInOrders[0];
    s = officeStep(s, gi.id, 'MSKU1234567');
    s = confirmGateInPaymentAndComplete(as(s, 'usr-office'), { gateInId: gi.id, paymentCategory: 'TTTT', directMethod: 'CASH' });
    const t = new Date(s.paymentTransactions[0].confirmedAt!);
    const before = formatDateTime(new Date(t.getTime() - 60_000));
    const justBefore = formatDateTime(new Date(t.getTime() - 1_000));
    const after = formatDateTime(new Date(t.getTime() + 60_000));
    expect(queryReceipts(s, { dateFrom: before, dateTo: after }).total).toBe(1);
    expect(queryReceipts(s, { dateFrom: before, dateTo: justBefore }).total).toBe(0);
    expect(() => queryReceipts(s, { dateFrom: '99/99/2026', dateTo: after })).toThrow(/dd\/mm\/yyyy/);
  });
});

describe('DEC-055: xuất Excel theo bộ lọc — Phiếu thu & mọi báo cáo', () => {
  it('Sheet PHIẾU THU đủ cột; file .xlsx có tiêu đề nền + bộ lọc cột; collectAllPages lấy hết các trang', async () => {
    const { receiptsSheet, collectAllPages, gateInSheet } = await import('../src/services/reports');
    let s = fieldStep(createInitialState());
    const gi = s.gateInOrders[0];
    s = officeStep(s, gi.id, 'MSKU1234567');
    s = confirmGateInPaymentAndComplete(as(s, 'usr-office'), { gateInId: gi.id, paymentCategory: 'TTTT', directMethod: 'CASH' });
    const sheet = receiptsSheet(s, collectAllPages((p) => queryReceipts(s, { keyword: 'MSKU1234567' }, p)));
    expect(sheet.columns).toContain('TÁC NGHIỆP');
    expect(sheet.rows[0][1]).toBe('HẠ VỎ');
    const inSheet = gateInSheet('HẠ VỎ', collectAllPages((p) => queryGateInReport(s, 'CUSTOMER_RETURN', { containerNo: 'MSKU1234567' }, p)));
    expect(inSheet.columns).toContain('SĐT LÁI XE');

    const { default: ExcelJS } = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await toXlsxBuffer([sheet]));
    const ws = wb.getWorksheet('PHIẾU THU')!;
    expect(ws.getRow(1).getCell(1).font?.bold).toBe(true);
    expect(ws.autoFilter).toBeTruthy();
  });
});

describe('DEC-056: mặc định bộ lọc = 1 ngày trước → hiện tại', () => {
  it('defaultLastDayRange trả đúng 24 giờ theo định dạng chuẩn', async () => {
    const { defaultLastDayRange } = await import('../src/services/datetime');
    const r = defaultLastDayRange(new Date(2026, 9, 23, 10, 10, 10));
    expect(r).toEqual({ dateFrom: '22/10/2026 10:10:10', dateTo: '23/10/2026 10:10:10' });
  });
});

describe('DEC-057: mã QR phiếu K80 duy nhất & đóng sau khi trả chứng từ', () => {
  it('QR theo mã hồ sơ: cùng container 2 lượt / lập lệnh lại sau khi hủy đều có QR khác; phiếu đã trả chứng từ bị đóng', async () => {
    const { confirmDocumentsReturn, isTicketClosed } = await import('../src/services/driverRoute');
    // Lượt 1: hạ vỏ → hạ bãi → trả chứng từ → cấp vỏ → OUT
    let { state: s } = gateInTts(createInitialState(), 'MSKU1234567');
    const t1 = s.k80Tickets[0];
    expect(t1.qrCode).toBe(`QR-${t1.masterDossierCode}`);
    s = placeInYard(s, 'MSKU1234567');
    s = confirmDocumentsReturn(as(s, 'usr-office'), { scannedQrCode: t1.qrCode }).state;
    expect(isTicketClosed(s, t1)).toBe(true);
    expect(() => confirmDocumentsReturn(as(s, 'usr-office'), { scannedQrCode: t1.qrCode })).toThrow(/Đã trả chứng từ/);

    const order = (st: DepotState, b: string) =>
      createReleaseOrder(as(st, 'usr-office'), { bookingNo: b, customerName: VIETLOG, containerNo: 'MSKU1234567', truckNo: '15H', driverPhone: '0912345678', feeCatalogIds: [FEE_LOLO_40HC_MSK] });
    s = order(s, 'BK-A');
    s = releaseAllocatedContainer(as(s, 'usr-office'), { containerNo: 'MSKU1234567', reason: 'đổi lịch' });
    s = order(s, 'BK-B');
    s = confirmReleasePayment(as(s, 'usr-office'), { gateOutOrderId: s.gateOutOrders[0].id, paymentCategory: 'TTS', ttsNote: 'x' });
    const outTicket = s.k80Tickets[0];
    expect(outTicket.qrCode).toBe(`QR-${s.gateOutOrders[0].gateOutCode}`);
    s = executeGateOut(as(s, 'usr-forklift'), { scannedQrCode: outTicket.qrCode });

    // Lượt 2: cùng container quay lại bãi → QR mới
    s = gateInTts(s, 'MSKU1234567').state;
    const t2 = s.k80Tickets[0];
    const all = s.k80Tickets.map((t) => t.qrCode);
    expect(new Set(all).size).toBe(all.length);
    expect(t2.qrCode).not.toBe(t1.qrCode);
  });
});

describe('DEC-059: Giám định xóa hồ sơ hạ vỏ khi Văn phòng chưa thao tác', () => {
  it('Xóa được khi chưa thao tác, không ghi nhật ký; đã thao tác thì chặn; vai trò khác bị chặn; mã không cấp lại', () => {
    let s = fieldStep(createInitialState());
    const a = s.gateInOrders[0];
    const logs = s.auditLogs.length;
    expect(() => deleteGateInFieldRecord(as(s, 'usr-office'), { gateInId: a.id })).toThrow(/Không đủ quyền/);
    s = deleteGateInFieldRecord(as(s, 'usr-inspector'), { gateInId: a.id });
    expect(s.gateInOrders.find((o) => o.id === a.id)).toBeUndefined();
    expect(s.auditLogs.length).toBe(logs);
    s = fieldStep(s);
    expect(s.gateInOrders[0].masterDossierCode).not.toBe(a.masterDossierCode);

    const b = s.gateInOrders[0];
    s = officeStep(s, b.id, 'MSKU1234567');
    expect(() => deleteGateInFieldRecord(as(s, 'usr-inspector'), { gateInId: b.id })).toThrow(/Văn phòng xử lý/);
  });
});

describe('DEC-060: Văn phòng Hạ vỏ kiểm tra Tồn vỏ ngay khi nhập số container', () => {
  it('Cont đang tồn vỏ → báo ngay & chặn; cont đã OUT hoặc mới → cho phép', async () => {
    const { gateInContainerConflict } = await import('../src/services/depotOperations');
    const s = fieldStep(createInitialState());
    const gi = s.gateInOrders[0];
    expect(gateInContainerConflict(s, 'MSKU4089123', gi.id)).toMatch(/TỒN VỎ/);
    expect(gateInContainerConflict(s, 'MSKU3190024', gi.id)).toBeNull(); // đã OUT trước đó
    expect(gateInContainerConflict(s, 'MSKU1234567', gi.id)).toBeNull();
    expect(gateInContainerConflict(s, 'MSKU40', gi.id)).toBeNull(); // chưa nhập đủ → chưa báo
    expect(() => officeStep(s, gi.id, 'MSKU4089123')).toThrow(/TỒN VỎ/);
  });
});
