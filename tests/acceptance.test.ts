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

function placeInYard(state: DepotState, containerNo: string, slot: { blockCode: string; bay?: string; row?: string; tier?: string } = { blockCode: 'BLOCK-B' }) {
  return updateContainerLocation(as(state, 'usr-forklift'), { containerNo, ...slot, reason: 'Hạ vỏ' });
}

describe('HẠ VỎ — Giám định → Văn phòng → Thanh toán → GATE IN OK', () => {
  it('GIN-001/CR-07: mã hồ sơ HV-YYMMDD-NNN do hệ thống cấp, tăng dần, không nhận mã từ giao diện', () => {
    let s = fieldStep(createInitialState(), { initialContainerHint: 'HS-999999-999' });
    s = fieldStep(s);
    const [second, first] = s.gateInOrders;
    expect(first.masterDossierCode).toMatch(/^HV-\d{6}-001$/);
    expect(second.masterDossierCode).toMatch(/^HV-\d{6}-002$/);
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

  it('TTT: trừ dần Phiếu thu trả trước, GATE IN OK, không phát hành phiếu thu mới', () => {
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

  it('TTTT tiền mặt: người có quyền xác nhận → giao dịch thành công → phát hành 1 PHIẾU THU PT-TT-YYMMDD-NNNN (DEC-098)', () => {
    let s = fieldStep(createInitialState());
    const order = s.gateInOrders[0];
    s = officeStep(s, order.id, 'MSKU1234567');
    s = confirmGateInPaymentAndComplete(as(s, 'usr-office'), { gateInId: order.id, paymentCategory: 'TTTT', directMethod: 'CASH' });
    expect(s.gateInOrders.find((o) => o.id === order.id)!.status).toBe('GATE_IN_OK');
    expect(s.paymentReceipts).toHaveLength(1);
    expect(s.paymentReceipts[0].receiptNo).toMatch(/^PT-TT-\d{6}-0001$/);
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
    const s = shiftContainer(as(s0, 'usr-forklift'), { containerId: c.id, blockCode: 'BLOCK-DAMAGE', bay: '01', row: '01', tier: '01' });
    const h = s.locationHistory[0];
    expect(h.actionType).toBe('YARD_SHIFT');
    expect(h.fromLocation).toBe('BLOCK-A / 04-02-01');
    expect(h.toLocation).toBe('BLOCK-DAMAGE / 01-01-01');
    expect(h.performedBy).toBe('Phạm Hoàng Xe Nâng');
    expect(h.performedAt).toBeTruthy();
  });

  it('YARD-003/004: từ chối ô ngoài cấu hình và ô đã có container', () => {
    const s0 = as(createInitialState(), 'usr-forklift');
    const one = s0.containers.find((x) => x.containerNo === 'ONEU2291045')!;
    expect(() => shiftContainer(s0, { containerId: one.id, blockCode: 'BLOCK-A', bay: '04', row: '02', tier: '01' })).toThrow(/đang có container/);
    expect(() => shiftContainer(s0, { containerId: one.id, blockCode: 'BLOCK-A', bay: '99', row: '01', tier: '01' })).toThrow(/ngoài cấu hình/);
    expect(() => shiftContainer(s0, { containerId: one.id, blockCode: 'BLOCK-A', bay: '01' })).toThrow(/nhập đủ: Row, Tier/);
    // DEC-082: Block có cấu hình → bắt buộc đủ; Block chỉ có tên Block → bỏ qua Bay/Row/Tier, nhiều cont chung 1 Block
    expect(() => shiftContainer(s0, { containerId: one.id, blockCode: 'BLOCK-A' })).toThrow(/nhập đủ: Bay, Row, Tier/);
    const a = s0.containers.find((x) => x.containerNo === 'MSKU4089123')!;
    const moved = shiftContainer(s0, { containerId: a.id, blockCode: 'BLOCK-B', bay: '05', row: '01', tier: '01' });
    expect(moved.containers.find((x) => x.id === a.id)).toMatchObject({ currentBlock: 'BLOCK-B', currentBay: null, currentRow: null, currentTier: null });
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
    expect(() => toggleContainerHold(s, { containerNo: 'MSKU4089123', hold: true, reason: '  ' })).toThrow(/REMARK VĂN PHÒNG/);
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
    s = correctContainerLocation(as(s, 'usr-office'), { containerId: c.id, blockCode: 'BLOCK-A', bay: '05', row: '01', tier: '01' });
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
    expect(go.gateOutCode).toMatch(/^CV-\d{6}-001$/);
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
  it('DEC-047: Văn phòng tạo phiếu thu TTT (bỏ Kế toán); tạo xong là CHỜ THANH TOÁN, QR chưa dùng được; xác nhận tiền mặt → phiếu thu + Phiếu thu trả trước ACTIVE', () => {
    const s0 = createInitialState();
    const input = { customerCode: 'VIETLOG', lotDescription: 'Lô 10 cont', totalAmount: 5000000, method: 'CASH' as const };
    expect(() => createMasterPrepaidReceipt(as(s0, 'usr-forklift'), input)).toThrow(/Không đủ quyền/);
    let s = createMasterPrepaidReceipt(as(s0, 'usr-office'), input);
    const master = s.masterReceipts[0];
    expect(master.status).toBe('PENDING_PAYMENT');
    expect(master.receiptCode).toMatch(/^PTT-\d{4}-003$/);
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
  it('Báo cáo Tổng hợp → file .xlsx đọc lại được, đủ 5 sheet, có dòng tiêu đề', { timeout: 20000 }, async () => {
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
    expect(res.pack.dossierCode).toMatch(/^CV-/);
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

describe('DEC-062 / DEC-063: thông tin công ty; theo dõi số lần in phiếu thu', () => {
  it('Chỉ Admin sửa thông tin công ty; mỗi lần in phiếu thu được ghi nhận (lần 2 = in lại, có nhật ký)', async () => {
    const { updateCompanyProfile, recordReceiptPrint } = await import('../src/services/depotOperations');
    const s0 = createInitialState();
    const profile = { ...s0.companyProfile, name: 'CÔNG TY CP MATRAN', address: 'Hải Phòng', phone: '0225 123 4567' };
    expect(() => updateCompanyProfile(as(s0, 'usr-office'), profile)).toThrow(/ADMIN/);
    expect(() => updateCompanyProfile(as(s0, 'usr-admin'), { ...profile, name: ' ' })).toThrow(/TÊN CÔNG TY/);
    let s = updateCompanyProfile(as(s0, 'usr-admin'), profile);
    expect(s.companyProfile.address).toBe('Hải Phòng');

    s = fieldStep(s);
    const gi = s.gateInOrders[0];
    s = officeStep(s, gi.id, 'MSKU1234567');
    s = confirmGateInPaymentAndComplete(as(s, 'usr-office'), { gateInId: gi.id, paymentCategory: 'TTTT', directMethod: 'CASH' });
    const no = s.paymentReceipts[0].receiptNo;
    expect(() => recordReceiptPrint(as(s, 'usr-forklift'), { receiptNo: no })).toThrow(/Không đủ quyền/);
    s = recordReceiptPrint(as(s, 'usr-office'), { receiptNo: no });
    s = recordReceiptPrint(as(s, 'usr-office'), { receiptNo: no });
    expect(s.paymentReceipts[0].printLog).toHaveLength(2);
    expect(s.auditLogs[0].actionCode).toBe('RECEIPT_REPRINT');
  });

  it('Trả chứng từ tự in → tính 1 lần in cho phiếu thu kèm theo', async () => {
    const { confirmDocumentsReturn } = await import('../src/services/driverRoute');
    const { recordReceiptPrint } = await import('../src/services/depotOperations');
    let s = fieldStep(createInitialState());
    const gi = s.gateInOrders[0];
    s = officeStep(s, gi.id, 'MSKU1234567');
    s = confirmGateInPaymentAndComplete(as(s, 'usr-office'), { gateInId: gi.id, paymentCategory: 'TTTT', directMethod: 'CASH' });
    s = placeInYard(s, 'MSKU1234567');
    const res = confirmDocumentsReturn(as(s, 'usr-office'), { scannedQrCode: s.k80Tickets[0].qrCode });
    let n = res.state;
    for (const r of res.pack.receipts) n = recordReceiptPrint(n, { receiptNo: r.receiptNo });
    expect(n.paymentReceipts[0].printLog).toHaveLength(1);
  });
});

describe('DEC-065: khóa = Remark Văn phòng; cont khóa vẫn hiện ở Cấp vỏ; Excel Tồn vỏ', () => {
  it('Khóa ghi vào Remark Văn phòng; cont chỉ vướng khóa vẫn hiện nhưng phải mở khóa mới cấp được', async () => {
    const { blockedOnlyByHold, releaseBlocker } = await import('../src/services/depotOperations');
    const { yardStockSheet } = await import('../src/services/reports');
    let s = toggleContainerHold(as(createInitialState(), 'usr-office'), { containerNo: 'MSKU4089123', hold: true, reason: 'Giữ theo yêu cầu hãng tàu' });
    let c = s.containers.find((x) => x.containerNo === 'MSKU4089123')!;
    expect(c.officeNote).toBe('Giữ theo yêu cầu hãng tàu');
    expect(blockedOnlyByHold(c)).toBe(true);
    expect(releaseBlocker(c)).toMatch(/KHÓA/);
    const sheet = yardStockSheet([c]);
    expect(sheet.rows[0]).toContain('ĐANG KHÓA');
    expect(sheet.rows[0]).toContain('Giữ theo yêu cầu hãng tàu');
    s = toggleContainerHold(s, { containerNo: 'MSKU4089123', hold: false, reason: 'Hãng tàu cho cấp' });
    c = s.containers.find((x) => x.containerNo === 'MSKU4089123')!;
    expect(blockedOnlyByHold(c)).toBe(false);
    expect(releaseBlocker(c)).toBeNull();
    s = createReleaseOrder(s, {
      bookingNo: 'BK-NEW-2', customerName: VIETLOG, containerNo: 'MSKU4089123', truckNo: '15H-2', driverPhone: '0912345678',
      feeCatalogIds: [FEE_LOLO_40HC_MSK],
    });
    expect(s.gateOutOrders[0].containerNo).toBe('MSKU4089123');
  });
});

describe('DEC-067: Tồn vỏ — lưu bãi, khóa / ghi chú hàng loạt', () => {
  it('LƯU BÃI = số ngày lịch từ gate in (ngày hạ = 0)', async () => {
    const { storageDays, parseContainerList } = await import('../src/services/core');
    expect(storageDays('2026-10-23T23:50:00', new Date('2026-10-23T23:59:00'))).toBe(0);
    expect(storageDays('2026-10-23T23:50:00', new Date('2026-10-24T00:10:00'))).toBe(1);
    expect(storageDays('2026-10-01T08:00:00', new Date('2026-10-31T07:00:00'))).toBe(30);
    expect(parseContainerList('msku4089123, TGHU2211457\nmsku4089123 ;')).toEqual(['MSKU4089123', 'TGHU2211457']);
  });

  it('Khóa / ghi chú hàng loạt: đúng quyền, bắt buộc ghi chú khi khóa, bỏ qua cont đã khóa', async () => {
    const { bulkToggleContainerHold, bulkUpdateOfficeNote } = await import('../src/services/depotOperations');
    const { yardStockSheet } = await import('../src/services/reports');
    const s0 = createInitialState();
    const ids = s0.containers.filter((c) => c.status === 'IN_YARD').slice(0, 2).map((c) => c.id);
    expect(ids.length).toBe(2);
    expect(() => bulkToggleContainerHold(as(s0, 'usr-forklift'), { containerIds: ids, hold: true, reason: 'x' })).toThrow(/Không đủ quyền/);
    expect(() => bulkToggleContainerHold(as(s0, 'usr-office'), { containerIds: ids, hold: true, reason: ' ' })).toThrow(/REMARK/);
    expect(() => bulkToggleContainerHold(as(s0, 'usr-office'), { containerIds: [], hold: true, reason: 'x' })).toThrow(/Chưa chọn/);
    const first = s0.containers.find((c) => c.id === ids[0])!;
    const pre = toggleContainerHold(as(s0, 'usr-office'), { containerNo: first.containerNo, hold: true, reason: 'Giữ trước' });
    const res = bulkToggleContainerHold(pre, { containerIds: ids, hold: true, reason: 'Hãng tàu giữ' });
    expect(res.done).toHaveLength(1);
    expect(res.skipped[0].reason).toBe('Đã khóa');
    expect(res.state.containers.filter((c) => ids.includes(c.id)).every((c) => c.isOnHold)).toBe(true);
    const noted = bulkUpdateOfficeNote(res.state, { containerIds: ids, officeNote: 'Kiểm tra lại' });
    expect(noted.state.containers.filter((c) => ids.includes(c.id)).every((c) => c.officeNote === 'Kiểm tra lại')).toBe(true);
    expect(() => bulkUpdateOfficeNote(as(s0, 'usr-forklift'), { containerIds: ids, officeNote: 'x' })).toThrow(/Không đủ quyền/);
    const sheet = yardStockSheet(noted.state.containers.filter((c) => ids.includes(c.id)));
    expect(sheet.columns.indexOf('LƯU BÃI (NGÀY)')).toBe(sheet.columns.indexOf('TRẠNG THÁI') + 1);
    expect(sheet.columns.slice(4, 7)).toEqual(['HÃNG TÀU', 'DATE IN', 'VÀO BÃI BẰNG']);
    expect(sheet.rows[0][6]).toBe('HẠ VỎ');
    expect(sheet.columns).toContain('GHI CHÚ');
  });
});

describe('DEC-068: tiền tố mã theo tác nghiệp; đổi mã cũ khi nạp dữ liệu', () => {
  it('Đổi IN-/HS- → HV-, OUT-/GO- → CV-, PTM- → PTT- (cả QR, nhật ký, bộ đếm); không đụng GIN-/CT-', async () => {
    const { renameLegacyCodes } = await import('../src/services/codes');
    const old = {
      a: 'IN-261023-001', b: 'QR-OUT-261023-002', c: 'PTM-2026-004', d: 'HS-261019-001', e: 'GO-261018-001',
      f: 'CT-GIN-261019-01', g: '[Hồ sơ IN-261023-001] ...', counters: { 'IN-261023': 1, 'OUT-261023': 2, 'PTM-2026': 4, 'PT-2026': 9 },
    };
    const n = renameLegacyCodes(old);
    expect(n).toEqual({
      a: 'HV-261023-001', b: 'QR-CV-261023-002', c: 'PTT-2026-004', d: 'HV-261019-001', e: 'CV-261018-001',
      f: 'CT-GIN-261019-01', g: '[Hồ sơ HV-261023-001] ...', counters: { 'HV-261023': 1, 'CV-261023': 2, 'PTT-2026': 4, 'PT-2026': 9 },
    });
    const s = normalizeDepotState({ ...createInitialState(), containers: [{ ...createInitialState().containers[0], masterDossierCode: 'IN-261023-009' }] });
    expect(s.containers[0].masterDossierCode).toBe('HV-261023-009');
  });
});

describe('DEC-077: phiếu thu trước chọn biểu giá kèm số lượng', () => {
  it('Tổng = đơn giá × số lượng do hệ thống tính; lưu dòng chi phí; chặn số lượng sai / biểu giá không có', () => {
    const s0 = as(createInitialState(), 'usr-office');
    const fee = s0.feeCatalog[0];
    const customer = s0.partners.find((p) => p.isCustomer)!.code;
    const s = createMasterPrepaidReceipt(s0, { customerCode: customer, lotDescription: 'Lô 20 cont', method: 'CASH', feeItems: [{ catalogId: fee.id, quantity: 20 }] });
    const m = s.masterReceipts[0];
    expect(m.receiptCode).toMatch(/^PTT-\d{4}-\d{3}$/);
    expect(m.totalAmount).toBe(fee.defaultAmountInclVat * 20);
    expect(m.feeLines![0]).toMatchObject({ quantity: 20, unitAmountInclVat: fee.defaultAmountInclVat, amountInclVat: fee.defaultAmountInclVat * 20 });
    expect(s.paymentTransactions[0]).toMatchObject({ amount: fee.defaultAmountInclVat * 20, status: 'PENDING', purpose: 'PREPAID_TOPUP' });
    expect(() => createMasterPrepaidReceipt(s0, { customerCode: customer, lotDescription: '', method: 'CASH', feeItems: [{ catalogId: fee.id, quantity: 0 }] })).toThrow(/Số lượng/);
    expect(() => createMasterPrepaidReceipt(s0, { customerCode: customer, lotDescription: '', method: 'CASH', feeItems: [{ catalogId: fee.id, quantity: 1.5 }] })).toThrow(/Số lượng/);
    expect(() => createMasterPrepaidReceipt(s0, { customerCode: customer, lotDescription: '', method: 'CASH', feeItems: [{ catalogId: 'x', quantity: 1 }] })).toThrow(/Biểu giá/);
    expect(() => createMasterPrepaidReceipt(as(s0, 'usr-inspector'), { customerCode: customer, lotDescription: '', method: 'CASH', feeItems: [{ catalogId: fee.id, quantity: 1 }] })).toThrow(/Không đủ quyền/);
  });
});

describe('DEC-079: phiếu thu trả trước liên kết từng lần trừ tiền — chứng từ, hồ sơ, số lượt, số tiền', () => {
  it('Tổng hợp sử dụng: số lượt, đã trừ, còn lại; mỗi lượt gắn chứng từ + hồ sơ + tác nghiệp', async () => {
    const { masterReceiptUsage } = await import('../src/services/payments');
    let s = createInitialState();
    const before = masterReceiptUsage(s, 'PTT-2026-001')!;
    expect(before.usedCount).toBe(1);
    expect(before.rows[0]).toMatchObject({ voucherNo: 'CT-GIN-261019-01', dossierCode: 'HV-261019-001', operation: 'HẠ VỎ', amount: 1200000 });
    s = fieldStep(s);
    const gi = s.gateInOrders[0];
    s = officeStep(s, gi.id, 'MSKU1234567');
    s = confirmGateInPaymentAndComplete(as(s, 'usr-office'), { gateInId: gi.id, paymentCategory: 'TTT', scannedQrCode: 'QR-TTT-VIETLOG-001' });
    const after = masterReceiptUsage(s, 'PTT-2026-001')!;
    expect(after.usedCount).toBe(2);
    expect(after.rows[0]).toMatchObject({ dossierCode: gi.masterDossierCode, containerNo: 'MSKU1234567', operation: 'HẠ VỎ' });
    expect(after.usedAmount).toBe(before.usedAmount + after.rows[0].amount);
    expect(after.remainingAmount).toBe(before.remainingAmount - after.rows[0].amount);
    expect(masterReceiptUsage(s, 'PTT-9999-999')).toBeUndefined();
  });
});

describe('DEC-079: Excel phiếu thu', () => {
  it('Cột PHƯƠNG THỨC TT, số lượt / còn lại TTT; số cột tiêu đề = số ô mỗi dòng', async () => {
    const { receiptsSheet, queryReceipts, collectAllPages } = await import('../src/services/reports');
    const { createMasterPrepaidReceipt: create, confirmPrepaidCash } = await import('../src/services/payments');
    const office = as(createInitialState(), 'usr-office');
    let s = create(office, { customerCode: office.partners.find((p) => p.isCustomer)!.code, lotDescription: '', method: 'CASH', feeItems: [{ catalogId: office.feeCatalog[0].id, quantity: 2 }] });
    s = confirmPrepaidCash(s, { transactionId: s.paymentTransactions[0].id });
    const receiptNo = s.paymentReceipts[0].receiptNo;
    const rows = collectAllPages((p) => queryReceipts(s, { receiptNo }, p));
    const sheet = receiptsSheet(s, rows);
    expect(sheet.columns).toContain('PHƯƠNG THỨC TT');
    expect(sheet.columns.slice(-2)).toEqual(['SỐ LƯỢT ĐÃ DÙNG (TTT)', 'CÒN LẠI (TTT)']);
    expect(sheet.rows.length).toBeGreaterThan(0);
    for (const row of sheet.rows) expect(row.length).toBe(sheet.columns.length);
    expect(sheet.rows[0].slice(-2)).toEqual([0, office.feeCatalog[0].defaultAmountInclVat * 2]);
    expect(sheet.rows[0][sheet.columns.indexOf('PHƯƠNG THỨC TT')]).toBe('Tiền mặt');
  });
});

describe('DEC-080: số dòng / trang do người dùng chọn', () => {
  it('Nhận 20 / 50 / 100; giá trị khác về mặc định 50', async () => {
    const { queryGateInReport } = await import('../src/services/reports');
    let s = createInitialState();
    for (let i = 0; i < 3; i++) s = fieldStep(s);
    const f = { containerNo: '', dateFrom: '', dateTo: '' };
    const all = { ...f, ...{ dateFrom: '01/01/2026 00:00:00', dateTo: '31/12/2026 23:59:59' } };
    expect(queryGateInReport(s, 'CUSTOMER_RETURN', all, 1, 20).rows.length).toBeLessThanOrEqual(20);
    const total = queryGateInReport(s, 'CUSTOMER_RETURN', all, 1, 100).total;
    expect(queryGateInReport(s, 'CUSTOMER_RETURN', all, 1, 100).pageCount).toBe(Math.max(1, Math.ceil(total / 100)));
    expect(queryGateInReport(s, 'CUSTOMER_RETURN', all, 1, 7).pageCount).toBe(Math.max(1, Math.ceil(total / 50)));
  });
});

describe('DEC-082: vị trí theo cấu hình thực tế của Block', () => {
  it('Mã tự thêm BLOCK-; chiều để trống = không dùng; chỉ bắt buộc chiều đã cấu hình', async () => {
    const { addYardBlockCatalogItem, shiftContainer: shift } = await import('../src/services/depotOperations');
    const { formatLocation, blockDimensions } = await import('../src/services/core');
    let s = as(createInitialState(), 'usr-admin');
    expect(() => addYardBlockCatalogItem(as(s, 'usr-office'), { blockCode: 'C' })).toThrow(/ADMIN/);
    expect(() => addYardBlockCatalogItem(s, { blockCode: ' ' })).toThrow(/BLOCK-/);
    expect(() => addYardBlockCatalogItem(s, { blockCode: 'C', maxBay: 2.5 })).toThrow(/số nguyên/);
    expect(() => addYardBlockCatalogItem(s, { blockCode: 'block-a' })).toThrow(/đã tồn tại/);
    s = addYardBlockCatalogItem(s, { blockCode: 'c', description: 'Khu C' });
    const c = s.yardBlocks.find((b) => b.blockCode === 'BLOCK-C')!;
    expect(c).toMatchObject({ blockName: 'Khu C', maxBay: 0, maxRow: 0, maxTier: 0, capacity: 0 });
    expect(blockDimensions(c)).toEqual([]);
    s = addYardBlockCatalogItem(s, { blockCode: 'BLOCK-D', maxBay: 5 });
    const d = s.yardBlocks.find((b) => b.blockCode === 'BLOCK-D')!;
    expect(d).toMatchObject({ maxBay: 5, maxRow: 0, maxTier: 0, capacity: 5 });

    const cont = s.containers.find((x) => x.containerNo === 'MSKU4089123')!;
    const fk = as(s, 'usr-forklift');
    expect(() => shift(fk, { containerId: cont.id, blockCode: 'BLOCK-D' })).toThrow(/nhập đủ: Bay/);
    expect(() => shift(fk, { containerId: cont.id, blockCode: 'BLOCK-D', bay: '06' })).toThrow(/ngoài cấu hình/);
    const moved = shift(fk, { containerId: cont.id, blockCode: 'BLOCK-D', bay: '03', row: '09', tier: '09' });
    const m = moved.containers.find((x) => x.id === cont.id)!;
    expect(m).toMatchObject({ currentBlock: 'BLOCK-D', currentBay: '03', currentRow: null, currentTier: null });
    expect(formatLocation(m)).toBe('BLOCK-D / Bay 03');
    // DEC-087: vị trí chưa đủ 4 phần (chỉ Bay) → nhiều cont đặt chung 1 Bay được
    const other = moved.containers.find((x) => x.containerNo === 'ONEU2291045')!;
    const both = shift(as(moved, 'usr-forklift'), { containerId: other.id, blockCode: 'BLOCK-D', bay: '03' });
    expect(both.containers.filter((x) => x.currentBlock === 'BLOCK-D' && x.currentBay === '03' && x.status !== 'GATED_OUT')).toHaveLength(2);
  });
});

describe('DEC-086: Báo giá 2 bước — cập nhật tình trạng sửa chữa + giờ công, rồi xác nhận chờ sửa chữa', () => {
  it('Lưu nháp vẫn ở Chờ báo giá; xác nhận cần đã cập nhật; chuyển Sửa chữa đúng nội dung đã lưu', async () => {
    const { saveQuotationDraft, confirmQuotationToRepair } = await import('../src/services/depotOperations');
    const s0 = createInitialState();
    const c = s0.containers.find((x) => x.needsQuotation && x.status !== 'GATED_OUT')!;
    expect(c).toBeTruthy();
    const q = as(s0, 'usr-quotation');
    expect(() => saveQuotationDraft(as(s0, 'usr-office'), { containerNo: c.containerNo, quotationItems: ['x'], laborHours: 1 })).toThrow(/Không đủ quyền/);
    expect(() => saveQuotationDraft(q, { containerNo: c.containerNo, quotationItems: [' '], laborHours: 1 })).toThrow(/TÌNH TRẠNG SỬA CHỮA/);
    expect(() => saveQuotationDraft(q, { containerNo: c.containerNo, quotationItems: ['Hàn sàn'], laborHours: 0 })).toThrow(/GIỜ CÔNG/);
    expect(() => confirmQuotationToRepair(q, { containerNo: c.containerNo })).toThrow(/Chưa cập nhật/);

    let s = saveQuotationDraft(q, { containerNo: c.containerNo, quotationItems: ['Thay tôn vách', 'Hàn sàn'], laborHours: 3.5 });
    const draft = s.containers.find((x) => x.id === c.id)!;
    expect(draft).toMatchObject({ needsQuotation: true, needsRepair: false, quotationItems: ['Thay tôn vách', 'Hàn sàn'], quotationLaborHours: 3.5, quotationUpdatedBy: expect.any(String) });
    expect(s.auditLogs[0].actionCode).toBe('SAVE_QUOTATION');

    s = confirmQuotationToRepair(s, { containerNo: c.containerNo });
    const done = s.containers.find((x) => x.id === c.id)!;
    expect(done).toMatchObject({ needsQuotation: false, needsRepair: true });
    const wo = s.workOrders.find((w) => w.masterDossierCode === c.masterDossierCode && w.category === 'REPAIR')!;
    expect(wo).toMatchObject({ items: ['Thay tôn vách', 'Hàn sàn'], laborHours: 3.5, workStatus: 'OPEN' });
    expect(() => confirmQuotationToRepair(s, { containerNo: c.containerNo })).toThrow(/không nằm trong hàng chờ/);
  });
});

describe('DEC-088: Báo giá xác nhận chờ sửa chữa hàng loạt', () => {
  it('Đúng quyền; bỏ qua cont chưa cập nhật; xác nhận cont đã cập nhật', async () => {
    const { saveQuotationDraft, bulkConfirmQuotationToRepair } = await import('../src/services/depotOperations');
    let s = fieldStep(createInitialState(), { conditionClass: 'DAMAGE', damageRemarks: ['Móp vách'] });
    const gi = s.gateInOrders[0];
    s = officeStep(s, gi.id, 'MSKU1234567');
    s = confirmGateInPaymentAndComplete(as(s, 'usr-office'), { gateInId: gi.id, paymentCategory: 'TTTT', directMethod: 'CASH' });
    const q = as(s, 'usr-quotation');
    const waiting = q.containers.filter((c) => c.needsQuotation && c.status !== 'GATED_OUT');
    expect(waiting.length).toBeGreaterThanOrEqual(2);
    const [a, b] = waiting;
    expect(() => bulkConfirmQuotationToRepair(as(s, 'usr-office'), { containerIds: [a.id] })).toThrow(/Không đủ quyền/);
    expect(() => bulkConfirmQuotationToRepair(q, { containerIds: [] })).toThrow(/Chưa chọn/);
    let next = saveQuotationDraft(q, { containerNo: a.containerNo, quotationItems: ['Hàn vách'], laborHours: 2 });
    const res = bulkConfirmQuotationToRepair(next, { containerIds: [a.id, b.id] });
    expect(res.done).toEqual([a.containerNo]);
    expect(res.skipped).toEqual([{ containerNo: b.containerNo, reason: 'Chưa cập nhật tình trạng sửa chữa / giờ công' }]);
    next = res.state;
    expect(next.containers.find((c) => c.id === a.id)).toMatchObject({ needsQuotation: false, needsRepair: true });
    expect(next.containers.find((c) => c.id === b.id)).toMatchObject({ needsQuotation: true });
  });
});

describe('DEC-093: khách hàng gõ tay hoặc chọn; khách ngoài Danh mục chỉ thanh toán trực tiếp', () => {
  it('Chuẩn hóa tên Danh mục; lưu tên tự do; chặn TTS / TTT với khách ngoài Danh mục, cho Tiền mặt', async () => {
    const { normalizeCustomer, isCatalogCustomer } = await import('../src/services/depotOperations');
    const s0 = createInitialState();
    expect(normalizeCustomer(s0, '  công ty tiếp vận việt (vietlog) ')).toBe(VIETLOG);
    expect(normalizeCustomer(s0, 'Anh  Ba   Vận Tải')).toBe('Anh Ba Vận Tải');
    expect(() => normalizeCustomer(s0, '  ')).toThrow(/KHÁCH HÀNG/);
    expect(isCatalogCustomer(s0, VIETLOG)).toBe(true);
    expect(isCatalogCustomer(s0, 'Anh Ba Vận Tải')).toBe(false);

    // Hạ vỏ với khách tự do: lưu được; TTS / TTT bị chặn; Tiền mặt OK
    let s = fieldStep(s0);
    const gi = s.gateInOrders[0];
    s = verifyGateInOfficeAndCreatePayment(as(s, 'usr-office'), {
      gateInId: gi.id, containerNo: 'MSKU1234567', size: '40', type: 'HC', shippingLineCode: 'MAERSK',
      customerName: 'Anh Ba Vận Tải', truckNo: '15C-1', driverPhone: '0912345678', orderDocNo: 'EIR-9', feeCatalogIds: [FEE_LOLO_40HC_MSK],
    } as never);
    expect(s.gateInOrders.find((o) => o.id === gi.id)!.customerRep).toBe('Anh Ba Vận Tải');
    expect(() => confirmGateInPaymentAndComplete(as(s, 'usr-office'), { gateInId: gi.id, paymentCategory: 'TTS', ttsNote: 'x' })).toThrow(/chưa có trong Danh mục/);
    expect(() => confirmGateInPaymentAndComplete(as(s, 'usr-office'), { gateInId: gi.id, paymentCategory: 'TTT', scannedQrCode: 'QR-TTT-VIETLOG-001' })).toThrow(/chưa có trong Danh mục/);
    s = confirmGateInPaymentAndComplete(as(s, 'usr-office'), { gateInId: gi.id, paymentCategory: 'TTTT', directMethod: 'CASH' });
    expect(s.gateInOrders.find((o) => o.id === gi.id)!.status).toBe('GATE_IN_OK');
  });
});

describe('DEC-098: mã phiếu thu theo hình thức + ngày, duy nhất', () => {
  it('Trực tiếp PT-TT-YYMMDD-NNNN tăng dần trong ngày; nạp quỹ thu trước PT-TTR-YYMMDD-NNNN; không trùng', async () => {
    const { createMasterPrepaidReceipt, confirmPrepaidCash } = await import('../src/services/payments');
    let s = fieldStep(fieldStep(createInitialState()));
    const [g2, g1] = s.gateInOrders;
    s = officeStep(s, g1.id, 'MSKU1234567');
    s = officeStep(s, g2.id, 'MSKU7654321');
    s = confirmGateInPaymentAndComplete(as(s, 'usr-office'), { gateInId: g1.id, paymentCategory: 'TTTT', directMethod: 'CASH' });
    s = confirmGateInPaymentAndComplete(as(s, 'usr-office'), { gateInId: g2.id, paymentCategory: 'TTTT', directMethod: 'CASH' });
    const day = s.paymentReceipts[0].receiptNo.slice(6, 12);
    expect(s.paymentReceipts.map((r) => r.receiptNo).sort()).toEqual([`PT-TT-${day}-0001`, `PT-TT-${day}-0002`]);

    const office = as(s, 'usr-office');
    s = createMasterPrepaidReceipt(office, { customerCode: office.partners.find((p) => p.isCustomer)!.code, lotDescription: '', method: 'CASH', feeItems: [{ catalogId: office.feeCatalog[0].id, quantity: 1 }] });
    s = confirmPrepaidCash(s, { transactionId: s.paymentTransactions[0].id });
    const topup = s.paymentReceipts.find((r) => r.purpose === 'PREPAID_TOPUP')!;
    expect(topup.receiptNo).toMatch(/^PT-TTR-\d{6}-0001$/);
    const all = s.paymentReceipts.map((r) => r.receiptNo);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('DEC-099: Tồn vỏ — hình thức thanh toán + phiếu thu của lượt vào bãi', () => {
  it('TT (mã PT-TT), TTS (công nợ CT-), TTR (phiếu thu trả trước PTT-), chưa thanh toán; Excel đủ cột', async () => {
    const { containerPaymentInfo } = await import('../src/services/payments');
    const { yardStockSheet } = await import('../src/services/reports');
    // TTT — dữ liệu mẫu HV-261019-001 trừ phiếu thu trả trước PTT-2026-001
    const s0 = createInitialState();
    expect(containerPaymentInfo(s0, { masterDossierCode: 'HV-261019-001' })).toMatchObject({ category: 'TTT', label: 'TTR — TRẢ TRƯỚC', receipt: 'PTT-2026-001' });
    // TTTT tiền mặt
    let s = fieldStep(s0);
    const g = s.gateInOrders[0];
    s = officeStep(s, g.id, 'MSKU1234567');
    expect(containerPaymentInfo(s, { masterDossierCode: g.masterDossierCode }).label).toBe('Chưa thanh toán');
    s = confirmGateInPaymentAndComplete(as(s, 'usr-office'), { gateInId: g.id, paymentCategory: 'TTTT', directMethod: 'CASH' });
    const tttt = containerPaymentInfo(s, { masterDossierCode: g.masterDossierCode });
    expect(tttt).toMatchObject({ category: 'TTTT', label: 'TT — TRỰC TIẾP' });
    expect(tttt.receipt).toMatch(/^PT-TT-\d{6}-\d{4}$/);
    // TTS
    const t = gateInTts(createInitialState(), 'MSKU7654321');
    const tts = containerPaymentInfo(t.state, { masterDossierCode: t.order.masterDossierCode });
    expect(tts).toMatchObject({ category: 'TTS', label: 'TTS — THANH TOÁN SAU' });
    expect(tts.receipt).toBe(''); // DEC-104: TTS không có phiếu thu → để trống, không hiện chứng từ
    // Nhập tàu
    expect(containerPaymentInfo(s, { masterDossierCode: 'NT-261025-001' })).toEqual({ label: 'Không thu phí', receipt: '' });
    // Excel
    const c = s.containers.find((x) => x.masterDossierCode === g.masterDossierCode)!;
    const sheet = yardStockSheet([c], s);
    const i = sheet.columns.indexOf('HÌNH THỨC TT');
    expect(sheet.columns.slice(i, i + 2)).toEqual(['HÌNH THỨC TT', 'MÃ PHIẾU THU']);
    expect(sheet.rows[0][i]).toBe('TT — TRỰC TIẾP');
    expect(String(sheet.rows[0][i + 1])).toMatch(/^PT-TT-/);
    for (const row of sheet.rows) expect(row.length).toBe(sheet.columns.length);
  });
});

describe('DEC-102: lọc nhanh thời gian', () => {
  it('Hôm nay / Hôm qua / Tuần (từ Thứ Hai) / Tháng / Năm tính đúng mốc', async () => {
    const { quickRange } = await import('../src/services/datetime');
    const now = new Date(2026, 9, 25, 10, 20, 30); // Chủ nhật 25/10/2026
    expect(quickRange('TODAY', now)).toEqual({ dateFrom: '25/10/2026 00:00:00', dateTo: '25/10/2026 10:20:30' });
    expect(quickRange('YESTERDAY', now)).toEqual({ dateFrom: '24/10/2026 00:00:00', dateTo: '24/10/2026 23:59:59' });
    expect(quickRange('THIS_WEEK', now).dateFrom).toBe('19/10/2026 00:00:00');
    expect(quickRange('LAST_WEEK', now)).toEqual({ dateFrom: '12/10/2026 00:00:00', dateTo: '18/10/2026 23:59:59' });
    expect(quickRange('THIS_MONTH', now).dateFrom).toBe('01/10/2026 00:00:00');
    expect(quickRange('LAST_MONTH', now)).toEqual({ dateFrom: '01/09/2026 00:00:00', dateTo: '30/09/2026 23:59:59' });
    expect(quickRange('THIS_YEAR', now).dateFrom).toBe('01/01/2026 00:00:00');
    // Thứ Hai là ngày đầu tuần; tháng 1 → tháng trước là tháng 12 năm trước
    expect(quickRange('THIS_WEEK', new Date(2026, 9, 19, 8)).dateFrom).toBe('19/10/2026 00:00:00');
    expect(quickRange('LAST_MONTH', new Date(2026, 0, 5)).dateFrom).toBe('01/12/2025 00:00:00');
  });
});
