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
  completeRackInspection,
  pendingRackInspections,
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
    shippingLineCode: 'MAERSK',
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
    const repair = { containerNo: 'MSKU1234567', teamId: 'rt-1', memberIds: ['rtm-1'], photos: ['data:image/jpeg;base64,A1', 'data:image/jpeg;base64,A2'] };
    expect(() => completeRepairTask(as(s, 'usr-office'), repair)).toThrow(/Không đủ quyền/);
    expect(() => completeRepairTask(as(s, 'usr-repair'), { ...repair, teamId: '' })).toThrow(/TỔ SỬA CHỮA/);
    expect(() => completeRepairTask(as(s, 'usr-repair'), { ...repair, memberIds: [] })).toThrow(/ít nhất 1 nhân viên/);
    expect(() => completeRepairTask(as(s, 'usr-repair'), { ...repair, memberIds: ['rtm-x'] })).toThrow();
    // DEC-176: bắt buộc 1–30 ảnh HOÀN THÀNH SỬA CHỮA
    expect(() => completeRepairTask(as(s, 'usr-repair'), { ...repair, photos: [] })).toThrow(/CHỤP ẢNH HOÀN THÀNH SỬA CHỮA/);
    expect(() => completeRepairTask(as(s, 'usr-repair'), { ...repair, photos: Array(31).fill('data:image/jpeg;base64,A') })).toThrow(/Tối đa 30/);
    s = completeRepairTask(as(s, 'usr-repair'), repair);
    expect(s.workOrders.find((w) => w.containerNo === 'MSKU1234567' && w.category === 'REPAIR')!.repairPhotos).toEqual(repair.photos);
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
    // DEC-124: cấp ngay mã PT-TTR- (chờ thanh toán), QR = QR-<mã>
    expect(master.receiptCode).toMatch(/^PT-TTR-\d{6}-0001$/);
    expect(master.qrCode).toBe(`QR-${master.receiptCode}`);
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
    expect(canOpenMenu(u('usr-repair'), 'BC_SUA_CHUA')).toBe(true); // DEC-179: bộ phận xem báo cáo của mình
    expect(canOpenMenu(u('usr-repair'), 'BC_HA_VO')).toBe(false);
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
  it('Vai trò cũ trong dữ liệu đã lưu: cổng / hiện trường → Giám định, Kế toán giữ nguyên (DEC-111 thêm lại)', () => {
    const legacy = createInitialState() as Partial<DepotState>;
    legacy.staffUsers = [{ id: 'u1', staffCode: 'X', fullName: 'A', email: 'a@b.vn', isActive: true, roles: ['GATE_STAFF', 'YARD_STAFF', 'ACCOUNTANT'] as never }];
    expect(normalizeDepotState(legacy).staffUsers.find((u) => u.id === 'u1')!.roles).toEqual(['INSPECTOR', 'ACCOUNTANT']);
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
    // DEC-107: số cont ngay sau tác nghiệp; không còn cột chứng từ; hình thức TT ghi chữ
    expect(sheet.columns.slice(0, 3)).toEqual(['MÃ PHIẾU THU', 'TÁC NGHIỆP', 'SỐ CONTAINER']);
    expect(sheet.rows[0][2]).toBe('MSKU1234567');
    expect(sheet.columns).not.toContain('CHỨNG TỪ');
    expect(sheet.rows[0][sheet.columns.indexOf('HÌNH THỨC TT')]).toBe('TT — TRỰC TIẾP');
    for (const row of sheet.rows) expect(row.length).toBe(sheet.columns.length);
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
    // DEC-128: TRẠNG THÁI → PHÂN LOẠI (đóng hàng) → LƯU BÃI
    expect(sheet.columns.indexOf('PHÂN LOẠI')).toBe(sheet.columns.indexOf('TRẠNG THÁI') + 1);
    expect(sheet.columns.indexOf('LƯU BÃI (NGÀY)')).toBe(sheet.columns.indexOf('TRẠNG THÁI') + 2);
    expect(sheet.columns).toContain('VỊ TRÍ');
    for (const r of sheet.rows) expect(r.length).toBe(sheet.columns.length);
    expect(sheet.columns.slice(4, 8)).toEqual(['HÃNG TÀU', 'AGE', 'DATE IN', 'VÀO BÃI BẰNG']); // DEC-129
    expect(sheet.columns.indexOf('TIẾN ĐỘ')).toBe(sheet.columns.indexOf('MÃ PHIẾU THU') + 1);
    expect(sheet.rows[0][sheet.columns.indexOf('VÀO BÃI BẰNG')]).toBe('HẠ VỎ');
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
    expect(m.receiptCode).toMatch(/^PT-TTR-\d{6}-\d{4}$/);
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
    expect(before.rows[0]).toMatchObject({ voucherNo: 'HV-261019-001', dossierCode: 'HV-261019-001', operation: 'HẠ VỎ', amount: 1200000 });
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
    expect(sheet.columns.slice(-2)).toEqual(['SỐ LƯỢT ĐÃ DÙNG (TTR)', 'CÒN LẠI (TTR)']);
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
    expect(containerPaymentInfo(s0, { masterDossierCode: 'HV-261019-001' })).toMatchObject({ category: 'TTT', label: 'TRẢ TRƯỚC', receipt: 'PTT-2026-001' });
    // TTTT tiền mặt
    let s = fieldStep(s0);
    const g = s.gateInOrders[0];
    s = officeStep(s, g.id, 'MSKU1234567');
    expect(containerPaymentInfo(s, { masterDossierCode: g.masterDossierCode }).label).toBe('Chưa thanh toán');
    s = confirmGateInPaymentAndComplete(as(s, 'usr-office'), { gateInId: g.id, paymentCategory: 'TTTT', directMethod: 'CASH' });
    const tttt = containerPaymentInfo(s, { masterDossierCode: g.masterDossierCode });
    expect(tttt).toMatchObject({ category: 'TTTT', label: 'TRỰC TIẾP' });
    expect(tttt.receipt).toMatch(/^PT-TT-\d{6}-\d{4}$/);
    expect(tttt.receiptTarget).toBe(tttt.receipt); // DEC-105: link mở đúng phiếu thu
    // TTS
    const t = gateInTts(createInitialState(), 'MSKU7654321');
    const tts = containerPaymentInfo(t.state, { masterDossierCode: t.order.masterDossierCode });
    expect(tts).toMatchObject({ category: 'TTS', label: 'THANH TOÁN SAU' });
    expect(tts.receipt).toBe(''); // DEC-104: TTS không có phiếu thu → để trống, không hiện chứng từ
    // Nhập tàu
    expect(containerPaymentInfo(s, { masterDossierCode: 'NT-261025-001' })).toEqual({ label: 'Không thu phí', receipt: '' });
    // Excel
    const c = s.containers.find((x) => x.masterDossierCode === g.masterDossierCode)!;
    const sheet = yardStockSheet([c], s);
    const i = sheet.columns.indexOf('THANH TOÁN');
    expect(sheet.columns.slice(i, i + 2)).toEqual(['THANH TOÁN', 'MÃ PHIẾU THU']);
    expect(sheet.rows[0][i]).toBe('TRỰC TIẾP');
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


describe('DEC-106: dữ liệu sạch để test lại từ đầu', () => {
  it('giữ danh mục, xóa toàn bộ dữ liệu tác nghiệp và bộ đếm mã', async () => {
    const { createCleanState } = await import('../src/services/depotStore');
    const seed = createInitialState();
    const s = createCleanState();
    expect(s.staffUsers.length).toBe(seed.staffUsers.length);
    expect(s.partners.length).toBe(seed.partners.length);
    expect(s.yardBlocks.length).toBe(seed.yardBlocks.length);
    expect(s.feeCatalog.length).toBe(seed.feeCatalog.length);
    for (const k of ['containers', 'gateInOrders', 'gateOutOrders', 'bookings', 'vouchers', 'paymentTransactions', 'paymentReceipts', 'masterReceipts', 'receiptDeductions', 'workOrders', 'k80Tickets', 'vesselLists', 'auditLogs', 'locationHistory'] as const) {
      expect(s[k]).toEqual([]);
    }
    expect(s.codeCounters).toEqual({});
    // Bắt đầu lại: mã hồ sơ / phiếu thu đầu tiên là 001 / 0001
    let x = fieldStep(s);
    const g = x.gateInOrders[0];
    expect(g.masterDossierCode).toMatch(/^HV-[0-9]{6}-001$/);
    x = officeStep(x, g.id, 'MSKU1234567');
    x = confirmGateInPaymentAndComplete(as(x, 'usr-office'), { gateInId: g.id, paymentCategory: 'TTTT', directMethod: 'CASH' });
    expect(x.paymentReceipts[0].receiptNo).toMatch(/^PT-TT-[0-9]{6}-0001$/);
  });
});

describe('DEC-109 / DEC-147: HẠ KỆ GIÁM ĐỊNH', () => {
  it('W-SURVEY → Xe nâng chỉ hạ vào Kệ giám định → Đảo chuyển về bay thì xóa cờ', async () => {
    const { getDriverRoute } = await import('../src/services/driverRoute');
    let { state: s } = gateInTts(createInitialState(), 'MSKU1234567', { conditionClass: 'W-SURVEY', stuffingClass: undefined, manufactureYear: undefined });
    expect(s.gateInOrders[0].toInspectionRack).toBe(true);
    const c = s.containers.find((x) => x.containerNo === 'MSKU1234567' && x.status === 'WAITING_PLACEMENT')!;
    expect(c.forkliftShiftTask).toBe('HA_KE_GIAM_DINH');
    const ticket = s.k80Tickets.find((t) => t.masterDossierCode === c.masterDossierCode)!;
    expect(getDriverRoute(s, ticket).find((x) => x.key === 'FORKLIFT_PLACE')!.action).toMatch(/HẠ KỆ GIÁM ĐỊNH/);
    // Không hạ về bay / block thường
    expect(() => placeInYard(s, 'MSKU1234567', { blockCode: 'BLOCK-A', bay: '01', row: '01', tier: '01' })).toThrow(/HẠ KỆ GIÁM ĐỊNH/);
    // Chưa có kệ trong danh mục → báo Admin cấu hình
    const noRack = { ...s, yardBlocks: s.yardBlocks.map((b) => ({ ...b, isInspectionRack: false })) };
    expect(() => placeInYard(noRack, 'MSKU1234567', { blockCode: 'BLOCK-DAMAGE', bay: '01', row: '01', tier: '01' })).toThrow(/Chưa có KỆ GIÁM ĐỊNH/);
    s = placeInYard(s, 'MSKU1234567', { blockCode: 'BLOCK-DAMAGE', bay: '01', row: '01', tier: '01' });
    expect(s.containers.find((x) => x.id === c.id)!).toMatchObject({ status: 'IN_YARD', currentBlock: 'BLOCK-DAMAGE', forkliftShiftTask: 'HA_KE_GIAM_DINH' });
    // Giám định xong (thông báo ngoài) → Xe nâng ĐẢO CHUYỂN về vị trí phù hợp
    s = shiftContainer(as(s, 'usr-forklift'), { containerId: c.id, blockCode: 'BLOCK-A', bay: '05', row: '01', tier: '01' });
    expect(s.containers.find((x) => x.id === c.id)!).toMatchObject({ currentBlock: 'BLOCK-A', forkliftShiftTask: 'NONE' });
  });

  it('Cont không đánh dấu vẫn hạ bình thường; chỉ Admin đánh dấu Kệ giám định', async () => {
    const { setYardBlockInspectionRack } = await import('../src/services/depotOperations');
    let { state: s } = gateInTts(createInitialState(), 'MSKU1234567');
    expect(s.containers.find((x) => x.containerNo === 'MSKU1234567' && x.status === 'WAITING_PLACEMENT')!.forkliftShiftTask).toBe('NONE');
    s = placeInYard(s, 'MSKU1234567', { blockCode: 'BLOCK-B' });
    expect(() => setYardBlockInspectionRack(as(s, 'usr-office'), 'BLOCK-B', true)).toThrow();
    s = setYardBlockInspectionRack(as(s, 'usr-admin'), 'BLOCK-B', true);
    expect(s.yardBlocks.find((b) => b.blockCode === 'BLOCK-B')!.isInspectionRack).toBe(true);
    expect(s.auditLogs[0].actionCode).toBe('ADMIN_SET_INSPECTION_RACK');
  });
});

describe('DEC-110: Trả chứng từ — Xem trước', () => {
  it('xem được EEIR + phiếu thu mà không ghi trả chứng từ, không tăng lần in; sai quyền / sai mã bị từ chối', async () => {
    const { previewDocumentPack, getDriverRoute } = await import('../src/services/driverRoute');
    let s = fieldStep(createInitialState());
    const gi = s.gateInOrders[0];
    s = officeStep(s, gi.id, 'MSKU1234567');
    s = confirmGateInPaymentAndComplete(as(s, 'usr-office'), { gateInId: gi.id, paymentCategory: 'TTTT', directMethod: 'CASH' });
    const ticket = s.k80Tickets[0];
    const before = JSON.stringify(s);
    // Xem trước được cả khi lái xe chưa đi hết lộ trình
    const pack = previewDocumentPack(as(s, 'usr-office'), { scannedQrCode: ticket.qrCode });
    expect(pack.dossierCode).toBe(gi.masterDossierCode);
    expect(pack.receipts).toHaveLength(1);
    expect(JSON.stringify(s)).toBe(before);
    expect(s.paymentReceipts[0].printLog?.length || 0).toBe(0);
    expect(getDriverRoute(s, ticket).at(-1)!.done).toBe(false);
    expect(() => previewDocumentPack(as(s, 'usr-forklift'), { scannedQrCode: ticket.qrCode })).toThrow(/Không đủ quyền/);
    expect(() => previewDocumentPack(as(s, 'usr-office'), { scannedQrCode: 'QR-KHONG-CO' })).toThrow(/Không tìm thấy/);
  });
});

describe('DEC-119: số chứng từ = mã hồ sơ tác nghiệp (không còn mã CT-)', () => {
  it('Hạ vỏ: chứng từ + mã tham chiếu chuyển khoản = HV-; Cấp vỏ: chứng từ = CV-; Excel không còn cột SỐ CHỨNG TỪ', async () => {
    const { gateInSheet, gateOutSheet } = await import('../src/services/reports');
    let s = fieldStep(createInitialState());
    const gi = s.gateInOrders[0];
    s = officeStep(s, gi.id, 'MSKU1234567');
    const v = s.vouchers.find((x) => x.masterDossierCode === gi.masterDossierCode && x.serviceType === 'GATE_IN')!;
    expect(v.voucherNo).toBe(gi.masterDossierCode);
    expect(v.voucherNo.startsWith('CT-')).toBe(false);
    s = confirmGateInPaymentAndComplete(as(s, 'usr-office'), { gateInId: gi.id, paymentCategory: 'TTTT', directMethod: 'BANK_TRANSFER_API' });
    expect(s.paymentTransactions[0].paymentRef).toBe(gi.masterDossierCode);
    s = simulateDemoBankTransfer(as(s, 'usr-office'), { transactionId: s.paymentTransactions[0].id });
    expect(s.paymentReceipts[0].voucherNo).toBe(gi.masterDossierCode);

    s = createReleaseOrder(as(createInitialState(), 'usr-office'), {
      bookingNo: 'BK-119', customerName: VIETLOG, containerNo: 'MSKU4089123', truckNo: '15H-1', driverPhone: '0912345678', feeCatalogIds: [FEE_LOLO_40HC_MSK],
    });
    const go = s.gateOutOrders[0];
    expect(s.vouchers.find((x) => x.id === go.voucherId)!.voucherNo).toBe(go.gateOutCode);
    expect(s.vouchers.every((x) => !x.voucherNo.startsWith('CT-'))).toBe(true);
    expect(gateInSheet('HẠ VỎ', s.gateInOrders).columns).not.toContain('SỐ CHỨNG TỪ');
    expect(gateOutSheet('CẤP VỎ', s, s.gateOutOrders).columns).not.toContain('SỐ CHỨNG TỪ');
  });
});

describe('DEC-147: W-SURVEY (LÊN KỆ) + giám định bổ sung trên kệ', () => {
  const DEFER = { conditionClass: 'W-SURVEY', stuffingClass: undefined, manufactureYear: undefined } as const;

  it('Giám định chọn W-SURVEY: chỉ cần ảnh + Vệ sinh, không cần Đóng hàng / AGE; tự HẠ KỆ', () => {
    const s = fieldStep(createInitialState(), { ...DEFER, cleaningItems: ['WP'] });
    expect(s.gateInOrders[0]).toMatchObject({ conditionClass: 'W-SURVEY', toInspectionRack: true, cleaningItems: ['WP'] });
    expect(s.gateInOrders[0].stuffingClass).toBeUndefined();
    expect(s.gateInOrders[0].manufactureYear).toBeUndefined();
    expect(s.auditLogs[0].summary).toMatch(/W-SURVEY/);
    // AV / DAMAGE vẫn bắt buộc Đóng hàng + AGE
    expect(() => fieldStep(createInitialState(), { stuffingClass: undefined })).toThrow(/PHÂN LOẠI ĐÓNG HÀNG/);
    expect(() => fieldStep(createInitialState(), { manufactureYear: undefined })).toThrow(/AGE/);
  });

  it('Văn phòng làm như thường; EEIR / K80 ghi W-SURVEY; Vệ sinh → Xe nâng chỉ hạ kệ; chưa cho Cấp vỏ', async () => {
    const { releaseBlocker } = await import('../src/services/depotOperations');
    let { state: s } = gateInTts(createInitialState(), 'MSKU1234567', { ...DEFER, cleaningItems: ['WP'] });
    const c = s.containers.find((x) => x.containerNo === 'MSKU1234567')!;
    expect(c).toMatchObject({ conditionClass: 'W-SURVEY', forkliftShiftTask: 'HA_KE_GIAM_DINH', needsCleaning: true, needsQuotation: false });
    expect(s.k80Tickets[0].conditionClass).toBe('W-SURVEY');
    expect(pendingRackInspections(s).map((x) => x.id)).toEqual([c.id]);
    // Chưa hạ lên kệ → chưa giám định bổ sung được
    expect(() => completeRackInspection(as(s, 'usr-inspector'), { containerId: c.id, conditionClass: 'AV', stuffingClass: 'E', manufactureYear: 2019 })).toThrow(/chưa được Xe nâng hạ lên kệ/);
    s = completeCleaningTask(as(s, 'usr-cleaning'), { containerNo: 'MSKU1234567' });
    s = placeInYard(s, 'MSKU1234567', { blockCode: 'BLOCK-DAMAGE', bay: '01', row: '01', tier: '01' });
    expect(releaseBlocker(s.containers.find((x) => x.id === c.id)!)).toMatch(/W-SURVEY/);
  });

  it('Giám định bổ sung DAMAGE → cập nhật phiếu + hàng chờ Báo giá; AV → hết chờ; bị từ chối khi sai quyền / thiếu dữ liệu', () => {
    const setup = () => {
      let { state: s } = gateInTts(createInitialState(), 'MSKU1234567', DEFER);
      s = placeInYard(s, 'MSKU1234567', { blockCode: 'BLOCK-DAMAGE', bay: '01', row: '01', tier: '01' });
      return { s, id: s.containers.find((x) => x.containerNo === 'MSKU1234567')!.id };
    };
    const { s, id } = setup();
    const insp = as(s, 'usr-inspector');
    expect(() => completeRackInspection(as(s, 'usr-office'), { containerId: id, conditionClass: 'AV', stuffingClass: 'E', manufactureYear: 2019 })).toThrow(/Không đủ quyền|chỉ Bộ phận Giám định/);
    expect(() => completeRackInspection(insp, { containerId: id, conditionClass: 'W-SURVEY', stuffingClass: 'E', manufactureYear: 2019 })).toThrow(/AV hoặc DAMAGE/);
    expect(() => completeRackInspection(insp, { containerId: id, conditionClass: 'DAMAGE', stuffingClass: 'E', manufactureYear: 2019 })).toThrow(/lỗi hư hỏng/);
    expect(() => completeRackInspection(insp, { containerId: id, conditionClass: 'AV', stuffingClass: 'E', manufactureYear: 19 })).toThrow(/AGE/);

    const d = completeRackInspection(insp, { containerId: id, conditionClass: 'DAMAGE', damageRemarks: ['Móp vách'], stuffingClass: 'M', manufactureYear: 2018 });
    const dc = d.containers.find((x) => x.id === id)!;
    expect(dc).toMatchObject({ conditionClass: 'DAMAGE', stuffingClass: 'M', manufactureYear: 2018, needsQuotation: true, damageRemarks: ['Móp vách'] });
    expect(d.gateInOrders[0]).toMatchObject({ conditionClass: 'DAMAGE', stuffingClass: 'M', manufactureYear: 2018, rackInspectedBy: insp.currentUser.fullName });
    expect(d.k80Tickets[0]).toMatchObject({ conditionClass: 'DAMAGE', stuffingClass: 'M' });
    expect(d.workOrders.some((w) => w.category === 'INSPECTION' && w.masterDossierCode === dc.masterDossierCode)).toBe(true);
    expect(pendingRackInspections(d)).toEqual([]);
    expect(d.auditLogs[0].actionCode).toBe('GIAM_DINH_TREN_KE');
    // Không giám định bổ sung lần 2
    expect(() => completeRackInspection(as(d, 'usr-inspector'), { containerId: id, conditionClass: 'AV', stuffingClass: 'E', manufactureYear: 2019 })).toThrow(/không ở trạng thái W-SURVEY/);

    const a = completeRackInspection(insp, { containerId: id, conditionClass: 'AV', stuffingClass: 'E', manufactureYear: 2019 });
    expect(a.containers.find((x) => x.id === id)!).toMatchObject({ conditionClass: 'AV', needsQuotation: false, forkliftShiftTask: 'HA_KE_GIAM_DINH' });
    expect(a.workOrders.some((w) => w.category === 'INSPECTION' && w.masterDossierCode === dc.masterDossierCode)).toBe(false);
  });
});

// N7 (DEC-157, DEC-178): báo cáo chế độ database lọc ngoài cửa sổ làm việc (từ 00:00 hôm nay) → tải riêng theo khoảng lọc, tối đa 3 tháng
import { assertRemoteRange, needsRangeLoad, setReportLoader, stateForRange } from '../src/services/remote/reportSource';
import { formatDateTime as fmtDt } from '../src/services/datetime';

describe('N7: nguồn dữ liệu báo cáo theo khoảng lọc', () => {
  const daysAgo = (n: number) => fmtDt(new Date(Date.now() - n * 86_400_000));

  it('Demo hoặc lọc trong hôm nay → không tải riêng, dùng state hiện tại (DEC-178: cửa sổ làm việc = từ 00:00 hôm nay)', async () => {
    const state = createInitialState();
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    expect(needsRangeLoad({ dateFrom: daysAgo(200), dateTo: daysAgo(150) }, new Date(), false)).toBe(false);
    expect(needsRangeLoad({ dateFrom: fmtDt(midnight), dateTo: daysAgo(0) }, new Date(), true)).toBe(false);
    expect(needsRangeLoad({ dateFrom: fmtDt(new Date(midnight.getTime() - 1000)), dateTo: daysAgo(0) }, new Date(), true)).toBe(true);
    expect(needsRangeLoad({ dateFrom: daysAgo(3), dateTo: daysAgo(0) }, new Date(), true)).toBe(true);
    expect(needsRangeLoad({ dateFrom: daysAgo(30), dateTo: daysAgo(0) }, new Date(), true)).toBe(true);
    expect(await stateForRange(state, { dateFrom: daysAgo(200), dateTo: daysAgo(150) })).toBe(state);
  });

  it('Database lọc trước hôm nay → tải đúng khoảng, giữ người dùng hiện tại', async () => {
    const state = createInitialState();
    const loaded = { ...createInitialState(), currentUser: { ...state.currentUser, id: 'khac' } };
    let asked: { from: string; to: string } | null = null;
    setReportLoader(async (r) => { asked = r; return loaded; });
    try {
      const range = { dateFrom: daysAgo(150), dateTo: daysAgo(100) };
      expect(needsRangeLoad(range)).toBe(true);
      const out = await stateForRange(state, range);
      expect(out.currentUser).toBe(state.currentUser);
      expect(out.containers).toBe(loaded.containers);
      expect(asked).not.toBeNull();
      expect(new Date(asked!.from).getTime()).toBeLessThan(new Date(asked!.to).getTime());
    } finally {
      setReportLoader(null);
    }
  });

  it('Từ chối: khoảng quá 3 tháng, TỪ sau ĐẾN, thiếu ngày; lỗi tải được báo lại', async () => {
    expect(() => assertRemoteRange({ dateFrom: daysAgo(200), dateTo: daysAgo(100) })).toThrow('tối đa 3 tháng');
    expect(() => assertRemoteRange({ dateFrom: daysAgo(100), dateTo: daysAgo(120) })).toThrow('TỪ phải trước');
    expect(() => assertRemoteRange({ dateFrom: '', dateTo: daysAgo(1) })).toThrow('Chọn đủ thời gian');
    setReportLoader(async () => { throw new Error('Không tải được dữ liệu: mất mạng'); });
    try {
      await expect(stateForRange(createInitialState(), { dateFrom: daysAgo(150), dateTo: daysAgo(100) })).rejects.toThrow('mất mạng');
      await expect(stateForRange(createInitialState(), { dateFrom: daysAgo(300), dateTo: daysAgo(100) })).rejects.toThrow('tối đa 3 tháng');
    } finally {
      setReportLoader(null);
    }
  });
});

// N8 (DEC-151): mất mạng → báo lỗi ngay, không xếp hàng; lỗi mạng trình duyệt → câu tiếng Việt
import { enqueue, friendlyError, OFFLINE_MESSAGE, setRemoteSink as setSink } from '../src/services/remote/sync';

describe('N8: mất mạng ở chế độ database', () => {
  const setOnline = (v: boolean) => Object.defineProperty(globalThis.navigator, 'onLine', { value: v, configurable: true });

  it('Có mạng → thao tác vào hàng chờ', () => {
    const got: unknown[] = [];
    setSink((op) => got.push(op));
    try {
      setOnline(true);
      enqueue(async () => {});
      expect(got).toHaveLength(1);
    } finally {
      setSink(null);
    }
  });

  it('Từ chối: mất mạng → ném lỗi tiếng Việt, không xếp hàng; Demo (không hàng chờ) không bị ảnh hưởng', () => {
    const got: unknown[] = [];
    setSink((op) => got.push(op));
    try {
      setOnline(false);
      expect(() => enqueue(async () => {})).toThrow('CHƯA được lưu');
      expect(got).toHaveLength(0);
      setSink(null);
      expect(() => enqueue(async () => {})).not.toThrow();
    } finally {
      setOnline(true);
      setSink(null);
    }
  });

  it('Lỗi mạng của trình duyệt → câu tiếng Việt; lỗi nghiệp vụ giữ nguyên', () => {
    expect(friendlyError('TypeError: Failed to fetch')).toBe(OFFLINE_MESSAGE);
    expect(friendlyError('Container đang bị khóa.')).toBe('Container đang bị khóa.');
  });
});

describe('DEC-166: Danh mục PHÂN LOẠI ĐÓNG HÀNG theo hãng tàu', () => {
  it('Admin thêm / ngừng dùng / mở lại; vai trò khác bị từ chối; chặn trùng, mã sai, hãng ngoài danh mục', async () => {
    const { addStuffingClassCatalogItem, setStuffingClassActive } = await import('../src/services/depotOperations');
    const { stuffingOptions } = await import('../src/services/stuffing');
    const s0 = createInitialState();
    expect(stuffingOptions(s0, 'MAERSK')).toEqual(['M', 'K', 'E']); // mặc định giữ hành vi cũ
    expect(() => addStuffingClassCatalogItem(as(s0, 'usr-office'), { shippingLineCode: 'MAERSK', code: 'X' })).toThrow(/ADMIN/);
    const admin = as(s0, 'usr-admin');
    expect(() => addStuffingClassCatalogItem(admin, { shippingLineCode: 'MAERSK', code: 'M' })).toThrow(/đã có/);
    expect(() => addStuffingClassCatalogItem(admin, { shippingLineCode: 'MAERSK', code: 'A B' })).toThrow(/1–5 chữ/);
    expect(() => addStuffingClassCatalogItem(admin, { shippingLineCode: 'KHONGCO', code: 'X' })).toThrow(/HÃNG TÀU/);
    let s = addStuffingClassCatalogItem(admin, { shippingLineCode: 'MAERSK', code: 'x', description: 'Đặc biệt' });
    expect(stuffingOptions(s, 'MAERSK')).toEqual(['M', 'K', 'E', 'X']);
    s = setStuffingClassActive(s, { shippingLineCode: 'MAERSK', code: 'K', isActive: false });
    expect(stuffingOptions(s, 'MAERSK')).toEqual(['M', 'E', 'X']);
    expect(() => setStuffingClassActive(as(s, 'usr-office'), { shippingLineCode: 'MAERSK', code: 'K', isActive: true })).toThrow(/ADMIN/);
    s = addStuffingClassCatalogItem(s, { shippingLineCode: 'MAERSK', code: 'K' }); // mở lại
    expect(stuffingOptions(s, 'MAERSK')).toContain('K');
    expect(s.auditLogs[0].summary).toMatch(/Mở lại PHÂN LOẠI ĐÓNG HÀNG K/);
  });

  it('Giám định: bắt buộc hãng tàu; hãng dùng phân loại → bắt buộc + đúng bộ của hãng; hãng không dùng → lưu trống', async () => {
    const { setStuffingClassActive } = await import('../src/services/depotOperations');
    const s0 = createInitialState();
    expect(() => fieldStep(s0, { shippingLineCode: '' })).toThrow(/HÃNG TÀU/);
    expect(() => fieldStep(s0, { stuffingClass: undefined })).toThrow(/PHÂN LOẠI ĐÓNG HÀNG \(M \/ K \/ E\)/);
    expect(() => fieldStep(s0, { stuffingClass: 'Z' })).toThrow(/không có trong Danh mục/);
    expect(fieldStep(s0, { stuffingClass: 'k' }).gateInOrders[0]).toMatchObject({ shippingLineCode: 'MAERSK', stuffingClass: 'K' });
    // ONE ngừng dùng cả 3 mã → không hỏi đóng hàng
    let s = as(s0, 'usr-admin');
    for (const code of ['M', 'K', 'E']) s = setStuffingClassActive(s, { shippingLineCode: 'ONE', code, isActive: false });
    const one = fieldStep(s, { shippingLineCode: 'ONE', stuffingClass: 'E' }).gateInOrders[0];
    expect(one.stuffingClass).toBeUndefined();
    // W-SURVEY: không cần đóng hàng dù hãng có dùng
    expect(fieldStep(s0, { conditionClass: 'W-SURVEY', stuffingClass: undefined, manufactureYear: undefined }).gateInOrders[0].stuffingClass).toBeUndefined();
  });

  it('Văn phòng đổi hãng: hãng mới không có mã cũ → bắt buộc chọn lại; hãng không dùng → xóa phân loại', async () => {
    const { addStuffingClassCatalogItem, setStuffingClassActive } = await import('../src/services/depotOperations');
    let s = as(createInitialState(), 'usr-admin');
    for (const code of ['M', 'K', 'E']) s = setStuffingClassActive(s, { shippingLineCode: 'ONE', code, isActive: false });
    s = addStuffingClassCatalogItem(s, { shippingLineCode: 'ONE', code: 'F' });
    s = fieldStep(s, { stuffingClass: 'E' });
    const id = s.gateInOrders[0].id;
    const office = (line: string, stuffingClass?: string) =>
      verifyGateInOfficeAndCreatePayment(as(s, 'usr-office'), {
        gateInId: id, containerNo: 'MSCU1234565', size: '40', type: 'HC', truckNo: '15C-123.45', driverPhone: '0912 345 678',
        customerName: VIETLOG, shippingLineCode: line, orderDocNo: 'EIR-001', feeCatalogIds: [FEE_RAC_40], stuffingClass,
      });
    expect(() => office('ONE')).toThrow(/không có trong Danh mục của hãng tàu ONE/);
    expect(office('ONE', 'F').gateInOrders[0].stuffingClass).toBe('F');
    expect(office('MAERSK').gateInOrders[0].stuffingClass).toBe('E');
    s = setStuffingClassActive(as(s, 'usr-admin'), { shippingLineCode: 'ONE', code: 'F', isActive: false });
    expect(office('ONE').gateInOrders[0].stuffingClass).toBeUndefined();
  });
});

describe('DEC-166: hãng tàu ƯU TIÊN (Giám định Hạ vỏ chọn sẵn)', () => {
  it('Chỉ Admin; chỉ 1 hãng ưu tiên — tích hãng khác thì hãng cũ tự bỏ; bỏ tích → không còn hãng ưu tiên', async () => {
    const { setShippingLinePriority } = await import('../src/services/depotOperations');
    const { priorityShippingLine } = await import('../src/services/stuffing');
    const s0 = createInitialState();
    expect(priorityShippingLine(s0)).toBe('');
    expect(() => setShippingLinePriority(as(s0, 'usr-office'), { code: 'MAERSK', isPriority: true })).toThrow(/ADMIN/);
    expect(() => setShippingLinePriority(as(s0, 'usr-admin'), { code: 'KHONGCO', isPriority: true })).toThrow(/HÃNG TÀU/);
    let s = setShippingLinePriority(as(s0, 'usr-admin'), { code: 'MAERSK', isPriority: true });
    expect(priorityShippingLine(s)).toBe('MAERSK');
    s = setShippingLinePriority(s, { code: 'ONE', isPriority: true });
    expect(priorityShippingLine(s)).toBe('ONE');
    expect(s.partners.filter((p) => p.isPriority).map((p) => p.code)).toEqual(['ONE']);
    s = setShippingLinePriority(s, { code: 'ONE', isPriority: false });
    expect(priorityShippingLine(s)).toBe('');
  });
});

// DEC-170: SẢN LƯỢNG SỬA CHỮA — giờ công cont chia đều cho số nhân viên tác nghiệp
import { queryRepairOutput } from '../src/services/reports';
describe('DEC-170 sản lượng sửa chữa', () => {
  const wo = (id: string, hours: number, members: string[], status: 'COMPLETED' | 'OPEN' = 'COMPLETED') => ({
    id, masterDossierCode: `HV-${id}`, containerNo: `TEST${id}`, category: 'REPAIR' as const, items: [], estimateCost: 0,
    approvalStatus: 'APPROVED' as const, workStatus: status, assignedTo: '', createdAt: '2026-10-28T01:00:00.000Z',
    completedAt: '2026-10-28T02:00:00.000Z', laborHours: hours, repairTeamCode: 'TO-1', repairTeamName: 'Tổ 1', repairMembers: members,
  });
  const s = { ...createInitialState(), workOrders: [wo('1', 6, ['An']), wo('2', 6, ['An', 'Bình']), wo('3', 9, ['An', 'Bình', 'Cường']), wo('4', 5, ['An'], 'OPEN')] } as unknown as DepotState;
  const range = { dateFrom: '28/10/2026 00:00:00', dateTo: '28/10/2026 23:59:59' };
  it('1 người nhận cả, 2 người chia 2, 3 người chia 3; chưa sửa xong không tính', () => {
    const rows = queryRepairOutput(s, range);
    const by = Object.fromEntries(rows.map((r) => [r.memberName, r]));
    expect(by['An'].hours).toBe(6 + 3 + 3);
    expect(by['An'].containers).toBe(3);
    expect(by['Bình'].hours).toBe(3 + 3);
    expect(by['Cường'].hours).toBe(3);
  });
  it('lọc nhân viên / tổ; bắt buộc thời gian', () => {
    expect(queryRepairOutput(s, { ...range, memberName: 'Bình' }).map((r) => r.memberName)).toEqual(['Bình']);
    expect(queryRepairOutput(s, { ...range, teamCode: 'TO-KHAC' })).toEqual([]);
    expect(() => queryRepairOutput(s, {})).toThrow(/thời gian/);
  });
});

// DEC-173: tổ theo số lượng, bậc thợ, gán tổ + bậc thợ cho nhân viên Sửa chữa; báo cáo sản lượng có thành tiền
import { addRepairTeamsByCount, assignRepairStaff, repairStaffAssignment, upsertRepairGrade } from '../src/services/depotOperations';
describe('DEC-173 bậc thợ sửa chữa', () => {
  const admin = as(createInitialState(), 'usr-admin');
  it('tạo tổ theo số lượng, đánh số tiếp, bỏ mã đã có', () => {
    const s = addRepairTeamsByCount(admin, { count: 3 });
    const added = s.repairTeams.slice(admin.repairTeams.length);
    expect(added).toHaveLength(3);
    expect(added.every((t) => /^TỔ SỬA CHỮA \d+$/.test(t.name))).toBe(true);
    expect(new Set(s.repairTeams.map((t) => t.code)).size).toBe(s.repairTeams.length);
    expect(() => addRepairTeamsByCount(admin, { count: 0 })).toThrow(/1 đến 50/);
  });
  it('bậc thợ bắt buộc tên + đơn giá > 0, không trùng tên', () => {
    expect(() => upsertRepairGrade(admin, { name: 'Bậc 1', hourlyRate: 0 })).toThrow(/lớn hơn 0/);
    const s = upsertRepairGrade(admin, { name: 'Bậc 1', hourlyRate: 30000 });
    expect(() => upsertRepairGrade(s, { name: 'bậc 1', hourlyRate: 40000 })).toThrow(/đã tồn tại/);
    expect(() => upsertRepairGrade(as(s, 'usr-office'), { name: 'Bậc 2', hourlyRate: 1 })).toThrow(/ADMIN/);
  });
  it('gán tổ + bậc thợ: chỉ user Sửa chữa, đổi tổ thì rời tổ cũ, báo cáo tính thành tiền', () => {
    let s = upsertRepairGrade(addRepairTeamsByCount(admin, { count: 2 }), { name: 'Bậc 3', hourlyRate: 50000 });
    const [t1, t2] = s.repairTeams.slice(-2);
    const g = s.repairGrades[0];
    expect(() => assignRepairStaff(s, { staffUserId: 'usr-office', teamId: t1.id, gradeId: g.id })).toThrow(/SỬA CHỮA/);
    expect(() => assignRepairStaff(s, { staffUserId: 'usr-repair', teamId: t1.id, gradeId: '' })).toThrow(/BẬC THỢ/);
    s = assignRepairStaff(s, { staffUserId: 'usr-repair', teamId: t1.id, gradeId: g.id });
    s = assignRepairStaff(s, { staffUserId: 'usr-repair', teamId: t2.id, gradeId: g.id });
    const a = repairStaffAssignment(s, 'usr-repair');
    expect(a.team?.id).toBe(t2.id);
    expect(a.grade?.hourlyRate).toBe(50000);
    expect(s.repairTeams.flatMap((t) => t.members).filter((m) => m.isActive && m.staffUserId === 'usr-repair')).toHaveLength(1);
    const name = a.member!.fullName;
    const wo = { id: 'w9', workOrderCode: 'SC-9', masterDossierCode: 'HV-9', containerNo: 'TEST9', category: 'REPAIR' as const, items: [], estimateCost: 0, approvalStatus: 'APPROVED' as const,
      workStatus: 'COMPLETED' as const, assignedTo: '', createdAt: '2026-10-28T01:00:00.000Z', completedAt: '2026-10-28T02:00:00.000Z', laborHours: 3, repairMembers: [name, 'Người khác'] };
    const rows = queryRepairOutput({ ...s, workOrders: [wo] }, { dateFrom: '28/10/2026 00:00:00', dateTo: '28/10/2026 23:59:59' });
    const r = rows.find((x) => x.memberName === name)!;
    expect(r.hours).toBe(1.5);
    expect(r.amount).toBe(75000);
    expect(rows.find((x) => x.memberName === 'Người khác')!.amount).toBeUndefined();
  });
});

// DEC-174: đơn giá bậc thợ CHỐT lúc sửa xong — đổi đơn giá sau, kỳ cũ giữ giá cũ
describe('DEC-174 đơn giá cũ tính theo giá cũ', () => {
  it('cont đã chốt giá giữ giá cũ; cont chưa có giá chốt lấy giá hiện tại; nhiều mức thì cộng đúng', () => {
    const admin = as(createInitialState(), 'usr-admin');
    let s = upsertRepairGrade(addRepairTeamsByCount(admin, { count: 1 }), { name: 'Bậc 2', hourlyRate: 80000 });
    const team = s.repairTeams[s.repairTeams.length - 1];
    s = assignRepairStaff(s, { staffUserId: 'usr-repair', teamId: team.id, gradeId: s.repairGrades[0].id });
    const name = repairStaffAssignment(s, 'usr-repair').member!.fullName;
    const base = { workOrderCode: 'SC', containerNo: 'TEST', category: 'REPAIR' as const, items: [], estimateCost: 0, approvalStatus: 'APPROVED' as const,
      workStatus: 'COMPLETED' as const, assignedTo: '', createdAt: '2026-10-28T01:00:00.000Z', completedAt: '2026-10-28T02:00:00.000Z', laborHours: 2, repairMembers: [name] };
    const old = { ...base, id: 'w1', masterDossierCode: 'HV-1', repairMemberRates: [{ name, gradeName: 'Bậc 1', hourlyRate: 50000 }] };
    const legacy = { ...base, id: 'w2', masterDossierCode: 'HV-2' };
    const rows = queryRepairOutput({ ...s, workOrders: [old, legacy] }, { dateFrom: '28/10/2026 00:00:00', dateTo: '28/10/2026 23:59:59' });
    const r = rows.find((x) => x.memberName === name)!;
    expect(r.jobs.find((j) => j.workOrder.id === 'w1')!.amount).toBe(100000); // 2 giờ × 50.000 (giá cũ)
    expect(r.jobs.find((j) => j.workOrder.id === 'w2')!.amount).toBe(160000); // 2 giờ × 80.000 (chưa chốt → giá hiện tại)
    expect(r.amount).toBe(260000);
    expect(r.hourlyRate).toBeUndefined(); // nhiều mức
    expect(r.gradeName).toBe('Nhiều bậc');
  });
});

// DEC-176: thư mục ảnh theo ngày — ANH-GATE-IN/năm/tháng/ngày, ANH-SUA-CHUA/năm/tháng/ngày/tổ/số cont
import { gateInPhotoPath, repairPhotoPath } from '../src/services/photo';
describe('DEC-176 đường dẫn ảnh', () => {
  const d = new Date(2026, 9, 29, 8, 5, 9);
  it('ảnh sửa chữa theo ngày / tổ / số cont; ảnh Gate in theo ngày; không có chữ có dấu', () => {
    expect(repairPhotoPath('TO-SC-01', 'MSKU1234567', 0, d)).toBe('ANH-SUA-CHUA/2026/10/29/TO-SC-01/MSKU1234567/MSKU1234567-080509-01.jpg');
    expect(repairPhotoPath('Tổ sửa chữa 1', 'MSKU1234567', 11, d)).toBe('ANH-SUA-CHUA/2026/10/29/TO-SUA-CHUA-1/MSKU1234567/MSKU1234567-080509-12.jpg');
    expect(gateInPhotoPath('HV-261029-0001', d)).toMatch(/^ANH-GATE-IN\/2026\/10\/29\/HV-261029-0001-[0-9a-f]{8}\.jpg$/);
  });
});

// DEC-175: VƯỢT GIỜ — giờ công trong khoảng lọc trên mốc (mặc định 200) tính thêm đơn giá vượt giờ (mặc định 3.000 đ / giờ)
import { updateRepairOvertime } from '../src/services/depotOperations';
import { repairOutputSheets } from '../src/services/reports';
describe('DEC-175 vượt giờ sửa chữa', () => {
  const admin = as(createInitialState(), 'usr-admin');
  const range = { dateFrom: '28/10/2026 00:00:00', dateTo: '28/10/2026 23:59:59' };
  const job = (id: string, hours: number, members: string[], rate?: number) => ({
    id, workOrderCode: `SC-${id}`, masterDossierCode: `HV-${id}`, containerNo: `TEST${id}`, category: 'REPAIR' as const, items: [], estimateCost: 0,
    approvalStatus: 'APPROVED' as const, workStatus: 'COMPLETED' as const, assignedTo: '', createdAt: '2026-10-28T01:00:00.000Z',
    completedAt: '2026-10-28T02:00:00.000Z', laborHours: hours, repairMembers: members,
    repairMemberRates: rate === undefined ? undefined : members.map((name) => ({ name, gradeName: 'Bậc 1', hourlyRate: rate })),
  });
  it('mặc định 200 giờ / 3.000 đ; tổng tiền = lương sản phẩm + sản phẩm vượt giờ', () => {
    expect(admin.repairOvertime).toEqual({ thresholdHours: 200, hourlyRate: 3000 });
    const rows = queryRepairOutput({ ...admin, workOrders: [job('1', 150, ['An'], 10000), job('2', 100, ['An'], 10000), job('3', 120, ['Bình'], 10000)] }, range);
    const an = rows.find((r) => r.memberName === 'An')!;
    expect(an.hours).toBe(250);
    expect(an.productWage).toBe(2500000);
    expect(an.overtimeHours).toBe(50);
    expect(an.overtimeAmount).toBe(150000);
    expect(an.amount).toBe(2650000);
    const binh = rows.find((r) => r.memberName === 'Bình')!;
    expect([binh.overtimeHours, binh.overtimeAmount, binh.amount]).toEqual([0, 0, 1200000]);
  });
  it('đúng 200 giờ chưa vượt; chưa có bậc thợ vẫn tính sản phẩm vượt giờ', () => {
    const rows = queryRepairOutput({ ...admin, workOrders: [job('1', 200, ['An'], 10000), job('2', 210, ['Cường'])] }, range);
    expect(rows.find((r) => r.memberName === 'An')!.overtimeHours).toBe(0);
    const c = rows.find((r) => r.memberName === 'Cường')!;
    expect([c.productWage, c.overtimeHours, c.overtimeAmount, c.amount]).toEqual([undefined, 10, 30000, 30000]);
  });
  it('Admin đổi mốc / đơn giá → báo cáo tính theo cấu hình mới; người khác hoặc số sai bị từ chối', () => {
    const s = updateRepairOvertime(admin, { thresholdHours: 100, hourlyRate: 5000 });
    expect(s.auditLogs[0].actionCode).toBe('ADMIN_UPDATE_REPAIR_OVERTIME');
    const an = queryRepairOutput({ ...s, workOrders: [job('1', 150, ['An'], 10000)] }, range)[0];
    expect([an.overtimeHours, an.overtimeAmount, an.amount]).toEqual([50, 250000, 1750000]);
    expect(() => updateRepairOvertime(as(admin, 'usr-office'), { thresholdHours: 100, hourlyRate: 5000 })).toThrow(/ADMIN/);
    expect(() => updateRepairOvertime(admin, { thresholdHours: 0, hourlyRate: 5000 })).toThrow(/MỐC GIỜ CÔNG/);
    expect(() => updateRepairOvertime(admin, { thresholdHours: 200, hourlyRate: -1 })).toThrow(/VƯỢT GIỜ/);
  });
  it('Excel tổng hợp có 3 cột mới trước TỔNG TIỀN SẢN PHẨM, dòng tổng cộng đúng', () => {
    const [sum] = repairOutputSheets(queryRepairOutput({ ...admin, workOrders: [job('1', 250, ['An'], 10000)] }, range));
    expect(sum.columns.slice(-4)).toEqual(['LƯƠNG SẢN PHẨM', 'GIỜ VƯỢT GIỜ', 'SẢN PHẨM VƯỢT GIỜ', 'TỔNG TIỀN SẢN PHẨM (VND)']);
    expect(sum.rows[0].slice(-4)).toEqual([2500000, 50, 150000, 2650000]);
    expect(sum.rows[1].slice(-4)).toEqual([2500000, 50, 150000, 2650000]);
  });
});

// DEC-178: mở app tải theo vai trò; hồ sơ container tải khi bấm mở rồi ghép vào dữ liệu đang có
import { dossierLoaderActive, loadDossier, mergeDossier, setDossierLoader } from '../src/services/remote/dossierSource';
import { seesPayments, workingWindowStart } from '../src/services/remote/loadWorking';
import { createDemoState } from '../src/services/demoData';

describe('DEC-178: tải theo vai trò + hồ sơ tải khi bấm mở', () => {
  it('Chỉ vai trò thu tiền / xem phiếu thu mới tải phiếu thu, giao dịch; hiện trường thì không', () => {
    const s = createDemoState();
    const role = (r: string) => s.staffUsers.find((u) => u.roles.includes(r as never))!;
    expect(seesPayments(role('OFFICE'))).toBe(true);
    expect(seesPayments(role('ACCOUNTANT'))).toBe(true);
    expect(seesPayments(role('ADMIN'))).toBe(true);
    for (const r of ['INSPECTOR', 'FORKLIFT', 'CLEANING', 'REPAIR_STAFF', 'QUOTATION']) expect(seesPayments(role(r))).toBe(false);
  });

  it('Cửa sổ làm việc bắt đầu 00:00 hôm nay', () => {
    const d = workingWindowStart(new Date(2026, 9, 29, 15, 30));
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 9, 29, 0, 0]);
  });

  it('Ghép hồ sơ: thêm dòng chưa có, dòng vừa tải ghi đè dòng cũ cùng id, không mất dữ liệu khác', () => {
    const s = createDemoState();
    const [a, b] = s.containers;
    const extra = { ...s, containers: [{ ...a, officeNote: 'MỚI TẢI' }, { ...b, id: 'cont-chi-co-trong-ho-so' }], workOrders: [] };
    const merged = mergeDossier(s, extra);
    expect(merged.containers).toHaveLength(s.containers.length + 1);
    expect(merged.containers.find((c) => c.id === a.id)!.officeNote).toBe('MỚI TẢI');
    expect(merged.workOrders).toBe(s.workOrders);
    expect(merged.currentUser).toBe(s.currentUser);
    expect(mergeDossier(s, null)).toBe(s);
  });

  it('Demo không tải hồ sơ riêng; database gọi đúng mã hồ sơ, lỗi được báo lại', async () => {
    const s = createInitialState();
    expect(dossierLoaderActive()).toBe(false);
    expect(await loadDossier(s, 'HV-1')).toBeNull();
    let asked = '';
    setDossierLoader(async (_st, code) => { asked = code; return s; });
    try {
      expect(await loadDossier(s, 'CV-2')).toBe(s);
      expect(asked).toBe('CV-2');
      setDossierLoader(async () => { throw new Error('Không tải được dữ liệu: mất mạng'); });
      await expect(loadDossier(s, 'HV-1')).rejects.toThrow('mất mạng');
    } finally {
      setDossierLoader(null);
    }
  });
});

// DEC-178: tìm số container theo 7 số seri — chính xác khi đủ, gợi ý theo đầu seri khi đang gõ
import { containerSerial, isExactContainerQuery, matchContainerNo } from '../src/services/containerSearch';

describe('DEC-178: tìm số container', () => {
  it('Đủ 7 số seri / 11 ký tự → chính xác; đang gõ → gợi ý theo đầu seri', () => {
    expect(containerSerial('MSKU1234567')).toBe('1234567');
    expect(matchContainerNo('MSKU1234567', '1234567')).toBe(true);
    expect(matchContainerNo('MSKU1234568', '1234567')).toBe(false);
    expect(matchContainerNo('MSKU1234567', '12345')).toBe(true);
    expect(matchContainerNo('TCLU1234501', '12345')).toBe(true);
    expect(matchContainerNo('MSKU1234567', 'msku 1234-567')).toBe(true);
    expect(matchContainerNo('MSKU1234567', 'MSKU12')).toBe(true);
    expect(isExactContainerQuery('1234567')).toBe(true);
    expect(isExactContainerQuery('MSKU1234567')).toBe(true);
    expect(isExactContainerQuery('12345')).toBe(false);
    expect(matchContainerNo('MSKU1234567', '')).toBe(true);
  });

  it('Từ chối: số nằm giữa seri, đuôi seri, sai hãng không còn khớp (trước đây "chứa chuỗi")', () => {
    expect(matchContainerNo('MSKU1234567', '34567')).toBe(false);
    expect(matchContainerNo('MSKU1234567', '567')).toBe(false);
    expect(matchContainerNo('MSKU1234567', 'TCLU1234567')).toBe(false);
    expect(matchContainerNo('MSKU1234567', 'SKU')).toBe(false);
    expect(matchContainerNo(undefined, '123')).toBe(false);
  });

  it('Báo cáo dùng cùng quy tắc', () => {
    const s = createDemoState();
    const order = s.gateInOrders.find((o) => o.containerNo && o.gateInOkAt)!;
    const day = order.gateInOkAt!;
    const filter = { dateFrom: fmtDt(new Date(new Date(day).getTime() - 86_400_000)), dateTo: fmtDt(new Date(new Date(day).getTime() + 86_400_000)) };
    const serial = containerSerial(order.containerNo);
    const hit = queryGateInReport(s, order.gateInType, { ...filter, containerNo: serial }, 1, 100).rows;
    expect(hit.some((o) => o.id === order.id)).toBe(true);
    const miss = queryGateInReport(s, order.gateInType, { ...filter, containerNo: serial.slice(2) }, 1, 100).rows;
    expect(miss.some((o) => o.id === order.id)).toBe(false);
  });
});

// DEC-178 bước 4b: báo cáo phân trang ở database — bộ lọc trên màn → bộ lọc gửi database (cùng điều kiện với reports.ts)
import { reportPagerActive, setReportPager, toServerFilter, fetchReportPage } from '../src/services/remote/reportPaging';

describe('DEC-178 bước 4b: báo cáo phân trang ở database', () => {
  it('Đổi bộ lọc màn hình sang ISO; bỏ giới hạn 3 tháng (tối đa 1 năm như Demo); chỉ số cont cũng tra được', () => {
    const f = toServerFilter({ dateFrom: '01/01/2026 00:00:00', dateTo: '31/10/2026 23:59:59', containerNo: ' 12345 ', shippingLineCode: '', size: '40' });
    expect(new Date(f.from!).getTime()).toBe(new Date(2026, 0, 1, 0, 0, 0).getTime());
    expect(new Date(f.to!).getTime()).toBe(new Date(2026, 9, 31, 23, 59, 59, 999).getTime()); // hết giây cuối, như reports.ts
    expect(f).toMatchObject({ containerNo: '12345', shippingLineCode: undefined, size: '40' });
    expect(toServerFilter({ containerNo: 'MSKU1234567' })).toMatchObject({ from: undefined, containerNo: 'MSKU1234567' });
  });

  it('Từ chối: thiếu TỪ / ĐẾN, TỪ sau ĐẾN, quá 1 năm, không ngày + không số cont, ngày sai', () => {
    expect(() => toServerFilter({ dateFrom: '01/01/2026 00:00:00' })).toThrow('đủ TỪ và ĐẾN');
    expect(() => toServerFilter({ dateFrom: '02/01/2026 00:00:00', dateTo: '01/01/2026 00:00:00' })).toThrow('TỪ phải trước');
    expect(() => toServerFilter({ dateFrom: '01/01/2025 00:00:00', dateTo: '31/12/2026 00:00:00' })).toThrow('tối đa');
    expect(() => toServerFilter({})).toThrow('Nhập số container hoặc chọn khoảng thời gian');
    expect(() => toServerFilter({ dateFrom: 'abc', dateTo: 'xyz' })).toThrow('không hợp lệ');
  });

  it('Database: gọi đúng loại báo cáo / trang, giữ người dùng hiện tại; Demo không có pager', async () => {
    const s = createInitialState();
    expect(reportPagerActive()).toBe(false);
    await expect(fetchReportPage(s, 'HA_VO', { containerNo: '1234567' }, 1, 50)).rejects.toThrow('Chưa kết nối');
    let asked: unknown[] = [];
    const other = { ...createInitialState(), currentUser: { ...s.currentUser, id: 'khac' } };
    setReportPager({ page: async (_st, kind, f, page, size) => { asked = [kind, f.containerNo, page, size]; return { state: other, total: 123 }; }, all: async () => other });
    try {
      const r = await fetchReportPage(s, 'CAP_VO', { containerNo: '1234567' }, 3, 50);
      expect(asked).toEqual(['CAP_VO', '1234567', 3, 50]);
      expect(r.total).toBe(123);
      expect(r.state.currentUser).toBe(s.currentUser);
    } finally {
      setReportPager(null);
    }
  });
});

// DEC-179: báo cáo theo bộ phận — bộ phận nào xem báo cáo của bộ phận đó; Văn phòng / Quản lý / Admin xem tất cả
import { queryCleaningReport, queryForkliftReport, queryInspectionReport, cleaningSheet, forkliftSheet, inspectionSheet } from '../src/services/reports';

describe('DEC-179: báo cáo theo bộ phận', () => {
  const s = createDemoState();
  const role = (r: string) => ({ ...s.currentUser, id: `thu-${r}`, roles: [r as never], isActive: true }); // người dùng thử chỉ 1 vai trò
  const OWN: Record<string, string[]> = {
    INSPECTOR: ['BC_GD_CHI_TIET'],
    CLEANING: ['BC_VS_CHI_TIET'],
    FORKLIFT: ['BC_XN_CHI_TIET'],
    REPAIR_STAFF: ['BC_SUA_CHUA', 'BC_SC_SAN_LUONG'],
  };
  const ALL = ['BC_GD_CHI_TIET', 'BC_HA_VO', 'BC_CAP_VO', 'BC_XUAT_TAU', 'BC_NHAP_TAU', 'BC_VS_CHI_TIET', 'BC_XN_CHI_TIET', 'BC_SUA_CHUA', 'BC_SC_SAN_LUONG'] as const;

  it('Mỗi bộ phận hiện trường chỉ xem báo cáo của mình; Văn phòng / Quản lý / Admin xem tất cả', () => {
    for (const [r, own] of Object.entries(OWN)) {
      const u = role(r);
      expect(u, r).toBeTruthy();
      for (const m of ALL) expect(canOpenMenu(u, m), `${r} ${m}`).toBe(own.includes(m));
    }
    for (const r of ['OFFICE', 'MANAGER', 'ADMIN']) for (const m of ALL) expect(canOpenMenu(role(r), m), `${r} ${m}`).toBe(true);
    expect(canOpenMenu(role('INSPECTOR'), 'BC_TONG_HOP')).toBe(false);
    // DEC-180: mục bộ phận trong menu
    const DEPT: Record<string, string> = { INSPECTOR: 'BC_BP_GIAM_DINH', CLEANING: 'BC_BP_VE_SINH', FORKLIFT: 'BC_BP_XE_NANG', REPAIR_STAFF: 'BC_BP_SUA_CHUA' };
    const DEPTS = ['BC_BP_GIAM_DINH', 'BC_BP_VAN_PHONG', 'BC_BP_VE_SINH', 'BC_BP_XE_NANG', 'BC_BP_SUA_CHUA'] as const;
    for (const [r, d] of Object.entries(DEPT)) for (const m of DEPTS) expect(canOpenMenu(role(r), m), `${r} ${m}`).toBe(m === d);
    for (const r of ['OFFICE', 'MANAGER', 'ADMIN']) for (const m of DEPTS) expect(canOpenMenu(role(r), m)).toBe(true);
    expect(canOpenMenu(role('ACCOUNTANT'), 'BC_BP_VAN_PHONG')).toBe(false);
  });

  const all = { dateFrom: '01/01/2000 00:00:00', dateTo: '31/12/2000 23:59:59' };
  const wide = (iso: string) => ({ dateFrom: fmtDt(new Date(new Date(iso).getTime() - 86_400_000)), dateTo: fmtDt(new Date(new Date(iso).getTime() + 86_400_000)) });

  it('Giám định — Chi tiết: lọc tác nghiệp / trạng thái / số cont; Excel đủ cột', () => {
    const o = s.gateInOrders.find((g) => g.containerNo)!;
    const f = { ...wide(o.fieldRecordedAt), containerNo: containerSerial(o.containerNo) };
    expect(queryInspectionReport(s, f).rows.map((x) => x.id)).toContain(o.id);
    expect(queryInspectionReport(s, { ...f, operation: o.gateInType === 'CUSTOMER_RETURN' ? 'VESSEL_IMPORT' : 'CUSTOMER_RETURN' }).rows.map((x) => x.id)).not.toContain(o.id);
    expect(queryInspectionReport(s, { ...f, condition: o.conditionClass === 'AV' ? 'DAMAGE' : 'AV' }).rows.map((x) => x.id)).not.toContain(o.id);
    const sheet = inspectionSheet([o]);
    expect(sheet.columns.slice(0, 5)).toEqual(['MÃ HỒ SƠ', 'SỐ CONTAINER', 'SIZE', 'TYPE', 'HÃNG TÀU']);
    expect(sheet.rows[0]).toHaveLength(sheet.columns.length);
  });

  it('Vệ sinh / Xe nâng — Chi tiết: có dữ liệu Demo, Excel đủ cột, lọc trạng thái / loại', () => {
    const w = s.workOrders.find((x) => x.category === 'CLEANING')!;
    const cl = queryCleaningReport(s, wide(w.completedAt || w.createdAt), 1, 100);
    expect(cl.rows.some((r) => r.workOrder.id === w.id)).toBe(true);
    expect(queryCleaningReport(s, { ...wide(w.completedAt || w.createdAt), status: w.workStatus === 'OPEN' ? 'COMPLETED' : 'OPEN' }, 1, 100).rows.some((r) => r.workOrder.id === w.id)).toBe(false);
    expect(cleaningSheet(cl.rows).rows[0]).toHaveLength(cleaningSheet(cl.rows).columns.length);
    const h = s.locationHistory[0];
    const fk = queryForkliftReport(s, wide(h.performedAt), 1, 100);
    expect(fk.rows.some((r) => r.item.id === h.id)).toBe(true);
    expect(queryForkliftReport(s, { ...wide(h.performedAt), action: h.actionType === 'YARD_SHIFT' ? 'INITIAL_BLOCK' : 'YARD_SHIFT' }, 1, 100).rows.some((r) => r.item.id === h.id)).toBe(false);
    expect(forkliftSheet(fk.rows).rows[0]).toHaveLength(forkliftSheet(fk.rows).columns.length);
  });

  it('Từ chối: không chọn thời gian lẫn số cont; khoảng ngoài dữ liệu thì rỗng', () => {
    expect(() => queryInspectionReport(s, {})).toThrow('Nhập số container hoặc chọn khoảng thời gian');
    expect(() => queryCleaningReport(s, {})).toThrow('Nhập số container hoặc chọn khoảng thời gian');
    expect(() => queryForkliftReport(s, {})).toThrow('Nhập số container hoặc chọn khoảng thời gian');
    expect(queryInspectionReport(s, all).total).toBe(0);
  });
});

// DEC-181: HỒ SƠ CONTAINER — LỊCH SỬ HỒ SƠ dựng từ dữ liệu tác nghiệp, cũ trên – mới dưới, việc chưa làm ở dòng ĐANG CHỜ
import { dossierHistory, resolveDossier } from '../src/services/dossierHistory';

describe('DEC-181: lịch sử hồ sơ container', () => {
  const demo = createDemoState();
  const historyOf = (s: DepotState, code: string) => dossierHistory(s, resolveDossier(s, code)!);

  it('cont sửa chữa: đủ bước theo thứ tự thời gian (cũ trên, mới dưới), ảnh sửa chữa giữ đường dẫn', () => {
    const wo = demo.workOrders.find((w) => w.category === 'REPAIR' && w.workStatus === 'COMPLETED' && w.repairPhotos?.length)!;
    const { rows } = historyOf(demo, wo.masterDossierCode);
    const ats = rows.map((r) => r.at);
    expect([...ats].sort()).toEqual(ats);
    const ops = rows.map((r) => r.operation);
    for (const op of ['Giám định — Hạ vỏ', 'Văn phòng — Hạ vỏ', 'Báo giá — Xác nhận chờ sửa chữa', 'Sửa chữa']) expect(ops).toContain(op);
    expect(ops.indexOf('Giám định — Hạ vỏ')).toBeLessThan(ops.indexOf('Sửa chữa'));
    const repair = rows.find((r) => r.operation === 'Sửa chữa')!;
    expect(repair.action).toBe('TẠO MỚI');
    // DEC-184: cột BỘ PHẬN — Thanh toán thuộc Văn phòng
    expect(rows.find((r) => r.operation === 'Thanh toán — Hạ vỏ')?.dept).toBe('Văn phòng');
    expect(rows.find((r) => r.operation === 'Báo giá — Xác nhận chờ sửa chữa')?.dept).toBe('Báo giá');
    expect(repair.staff).toBe(wo.completedBy);
    expect(repair.photos).toEqual(wo.repairPhotos);
  });

  it('đảo chuyển = SỬA (vị trí cũ → mới); hạ vỏ = TẠO MỚI', () => {
    const shift = demo.locationHistory.find((l) => l.actionType === 'YARD_SHIFT')!;
    const { rows } = historyOf(demo, shift.masterDossierCode);
    const row = rows.find((r) => r.operation === 'Xe nâng — Đảo chuyển')!;
    expect(row.action).toBe('SỬA');
    expect(row.location).toEqual({ from: shift.fromLocation, to: shift.toLocation });
    expect(rows.find((r) => r.operation === 'Xe nâng — Hạ vỏ')?.action).toBe('TẠO MỚI');
  });

  it('hủy lệnh cấp = XÓA, nằm sau dòng lập lệnh; mở bằng mã CV- vẫn ra hồ sơ lượt lưu bãi', () => {
    const c = demo.containers.find((x) => x.status === 'ALLOCATED')!;
    const order = demo.gateOutOrders.find((o) => o.masterDossierCode === c.masterDossierCode && o.status !== 'CANCELLED')!;
    const s = releaseAllocatedContainer(as(demo, 'usr-office'), { containerNo: c.containerNo, reason: 'Khách đổi lịch' });
    const d = resolveDossier(s, order.gateOutCode)!;
    expect(d.visitCode).toBe(c.masterDossierCode);
    const { rows, pending } = dossierHistory(s, d);
    const ops = rows.map((r) => r.operation);
    const cancel = rows.find((r) => r.operation === 'Văn phòng — Hủy lệnh cấp')!;
    expect(cancel.action).toBe('XÓA');
    expect(cancel.detail).toContain('Khách đổi lịch');
    expect(ops.indexOf('Văn phòng — Cấp vỏ')).toBeLessThan(ops.indexOf('Văn phòng — Hủy lệnh cấp'));
    expect(pending.some((p) => p.label.includes(order.gateOutCode))).toBe(false);
  });

  it('bước chưa làm vào ĐANG CHỜ, không thành dòng lịch sử; mã không tồn tại → không có hồ sơ', () => {
    let s = recordGateInFieldStep(as(createInitialState(), 'usr-inspector'), {
      gateInType: 'CUSTOMER_RETURN', shippingLineCode: 'MAERSK', doorPhotoUrl: 'data:x', conditionClass: 'AV', stuffingClass: 'E',
      cleaningItems: ['WW'], manufactureYear: 2019,
    });
    const code = s.gateInOrders[0].masterDossierCode;
    const h = historyOf(s, code);
    expect(h.rows.map((r) => r.operation)).toEqual(['Giám định — Hạ vỏ']);
    expect(h.rows[0].photos).toEqual(['data:x']);
    expect(h.pending).toEqual([{ dept: 'Văn phòng', task: 'Hạ vỏ', label: 'Chờ Văn phòng bổ sung thông tin hạ vỏ' }]);
    expect(h.rows[0].task).toBe('Hạ vỏ');
    expect(h.rows[0].dept).toBe('Giám định');
    expect(resolveDossier(s, 'HV-000000-999')).toBeNull();
  });
});

// DEC-185: ĐỔI CONTAINER khi chờ trả chứng từ cấp vỏ — giữ lệnh CV-, chứng từ, phiếu thu, QR; cont cũ Xe nâng hạ lại
import { canSwapGateOut, isGateOutLifted, releaseBlocker, swapCandidates, swapGateOutContainer } from '../src/services/depotOperations';
import { containerOperation } from '../src/services/vessel';

describe('DEC-185: đổi container khi chờ trả chứng từ cấp vỏ', () => {
  const demo = createDemoState();
  const order = demo.gateOutOrders.find((o) => o.status === 'GATE_OUT_OK' && !o.documentsReturnedAt)!;
  const old = demo.containers.find((c) => c.masterDossierCode === order.masterDossierCode && c.containerNo === order.containerNo)!;
  const fresh = demo.containers.find(
    (c) => c.status === 'IN_YARD' && !releaseBlocker(c) && c.size === old.size && c.type === old.type && c.shippingLineCode === old.shippingLineCode
  )!;
  // Ô trống: block thường, đủ Bay / Row / Tier (tìm từ ô cuối)
  const yard = demo.yardBlocks.find((b) => !b.isInspectionRack)!;
  const pad = (n: number) => String(n).padStart(2, '0');
  const freeSlot = (() => {
    for (let bay = yard.maxBay; bay >= 1; bay--)
      for (let row = yard.maxRow; row >= 1; row--)
        for (let tier = yard.maxTier; tier >= 1; tier--)
          if (!demo.containers.some((c) => c.status !== 'GATED_OUT' && c.currentBlock === yard.blockCode && c.currentBay === pad(bay) && c.currentRow === pad(row) && c.currentTier === pad(tier)))
            return { blockCode: yard.blockCode, bay: pad(bay), row: pad(row), tier: pad(tier) };
    throw new Error('Hết ô trống');
  })();
  const office = as(demo, 'usr-office');
  const swap = (reason: 'KEN_VO' | 'DAMAGE', note?: string) =>
    swapGateOutContainer(office, { gateOutOrderId: order.id, reason, newContainerNo: fresh.containerNo, note });

  it('Khách kén vỏ: lệnh CV- chuyển sang cont mới, giữ chứng từ / phiếu thu / QR; cont cũ chờ hạ lại, hạ xong cấp được khách khác', () => {
    let s = swap('KEN_VO');
    const o = s.gateOutOrders.find((x) => x.id === order.id)!;
    expect(o.gateOutCode).toBe(order.gateOutCode);
    expect(o.containerNo).toBe(fresh.containerNo);
    expect(o.status).toBe('PENDING_FORKLIFT');
    expect(o.swaps).toHaveLength(1);
    const v = s.vouchers.find((x) => x.id === order.voucherId)!;
    expect(v.containerNo).toBe(fresh.containerNo);
    expect(v.status).toBe(demo.vouchers.find((x) => x.id === order.voucherId)!.status);
    expect(s.paymentReceipts.filter((r) => r.voucherId === order.voucherId).every((r) => r.containerNo === fresh.containerNo)).toBe(true);
    expect(s.k80Tickets.find((t) => t.outDossierCode === order.gateOutCode)!.containerNo).toBe(fresh.containerNo);

    const back = s.containers.find((c) => c.id === old.id)!;
    expect(back.status).toBe('WAITING_PLACEMENT');
    expect(back.conditionClass).toBe(old.conditionClass);
    expect(back.gateInAt).toBe(old.gateInAt); // giữ ngày hạ gốc
    expect(back.swapReturn?.reason).toBe('KEN_VO');
    expect(s.containers.find((c) => c.id === fresh.id)!.status).toBe('ALLOCATED');

    // DEC-186: Chờ cấp vỏ hiện nhãn ĐỔI CONT; chưa hạ cont cũ thì KHÔNG cấp được cont mới
    expect(containerOperation(s, s.containers.find((c) => c.id === fresh.id)!).code).toBe('DOI_CONT');
    expect(() => executeGateOut(as(s, 'usr-forklift'), { scannedQrCode: `QR-${order.gateOutCode}` })).toThrow(
      `Phải HẠ container ${old.containerNo} (đổi cont) ở Xe nâng — Chờ hạ vỏ trước khi cấp ${fresh.containerNo}.`
    );
    expect(dossierHistory(s, resolveDossier(s, order.gateOutCode)!).pending.some((p) => p.label.includes(`hạ ${old.containerNo}`))).toBe(true);
    // Xe nâng hạ lại cont cũ → tồn bãi, đủ điều kiện cấp khách khác
    s = updateContainerLocation(as(s, 'usr-forklift'), { containerNo: old.containerNo, ...freeSlot, reason: '' });
    // Hạ xong → cấp cont mới bằng QR phiếu K80 đang cầm (QR-CV- giữ nguyên)
    s = executeGateOut(as(s, 'usr-forklift'), { scannedQrCode: `QR-${order.gateOutCode}` });
    expect(s.containers.find((c) => c.id === fresh.id)!.status).toBe('GATED_OUT');
    const placed = s.containers.find((c) => c.id === old.id)!;
    expect(placed.status).toBe('IN_YARD');
    expect(placed.swapReturn).toBeUndefined();
    expect(releaseBlocker(placed)).toBeNull();
    expect(s.locationHistory.some((l) => l.containerNo === old.containerNo && l.actionType === 'SWAP_RETURN')).toBe(true);

    // Hồ sơ: cont cũ có dòng Đổi container (SỬA) + Xe nâng hạ lại; cont mới có dòng cấp thay
    const oldRows = dossierHistory(s, resolveDossier(s, old.masterDossierCode)!).rows;
    expect(oldRows.find((r) => r.operation === 'Văn phòng — Đổi container')?.action).toBe('SỬA');
    // DEC-187: tác nghiệp ĐỔI CONT ghi rõ (không lẫn Trả chứng từ / Cấp vỏ)
    expect(oldRows.filter((r) => r.task.startsWith('ĐỔI CONT')).map((r) => `${r.dept}|${r.task}`)).toEqual(['Văn phòng|ĐỔI CONT', 'Xe nâng|ĐỔI CONT — Hạ lại']);
    expect(oldRows.some((r) => r.operation === 'Xe nâng — Hạ lại (đổi container)')).toBe(true);
    const newRows = dossierHistory(s, resolveDossier(s, order.gateOutCode)!).rows;
    expect(newRows.find((r) => r.operation === 'Văn phòng — Đổi container')?.detail).toContain(old.containerNo);
    expect(newRows.find((r) => r.operation === 'Xe nâng — Cấp vỏ')?.task).toBe('ĐỔI CONT — Cấp vỏ');
  });

  it('Phát sinh hư hỏng: cont cũ chuyển DAMAGE + PHÁT SINH CẤP VỎ; Xe nâng hạ xong → Chờ báo giá', () => {
    let s = swap('DAMAGE', 'Thủng sàn');
    const back = s.containers.find((c) => c.id === old.id)!;
    expect(back.conditionClass).toBe('DAMAGE');
    expect(back.releaseDamage).toBe(true);
    expect(back.needsQuotation).toBe(false); // chưa hạ → chưa vào Báo giá
    s = updateContainerLocation(as(s, 'usr-forklift'), { containerNo: old.containerNo, ...freeSlot, reason: '' });
    const placed = s.containers.find((c) => c.id === old.id)!;
    expect(placed.needsQuotation).toBe(true);
    expect(placed.releaseDamage).toBe(true);
    expect(s.workOrders.find((w) => w.masterDossierCode === old.masterDossierCode && w.category === 'INSPECTION' && w.workStatus === 'OPEN')?.items).toEqual(['Thủng sàn']);
    expect(dossierHistory(s, resolveDossier(s, old.masterDossierCode)!).pending.some((p) => p.dept === 'Báo giá')).toBe(true);
  });

  it('Từ chối: sai quyền, chưa cấp ra / đã trả chứng từ, cont thay thế khác size-type hoặc đang khóa, trùng cont', () => {
    expect(() => swapGateOutContainer(as(demo, 'usr-forklift'), { gateOutOrderId: order.id, reason: 'KEN_VO', newContainerNo: fresh.containerNo })).toThrow(/Không đủ quyền/);
    // DEC-192: lệnh chưa thu tiền thì không đổi (hủy lệnh như cũ)
    const unpaid = demo.gateOutOrders.find((o) => o.status === 'PAYMENT_PENDING');
    if (unpaid) {
      expect(() => swapGateOutContainer(office, { gateOutOrderId: unpaid.id, reason: 'KEN_VO', newContainerNo: fresh.containerNo })).toThrow(/chờ trả chứng từ/);
    }
    const returned = { ...office, gateOutOrders: office.gateOutOrders.map((o) => (o.id === order.id ? { ...o, documentsReturnedAt: '2026-10-29T00:00:00.000Z' } : o)) };
    expect(() => swapGateOutContainer(returned, { gateOutOrderId: order.id, reason: 'KEN_VO', newContainerNo: fresh.containerNo })).toThrow(/chờ trả chứng từ/);
    const other = demo.containers.find((c) => c.status === 'IN_YARD' && !releaseBlocker(c) && (c.size !== old.size || c.type !== old.type));
    if (other) {
      expect(() => swapGateOutContainer(office, { gateOutOrderId: order.id, reason: 'KEN_VO', newContainerNo: other.containerNo })).toThrow(/cùng hãng tàu \/ size \/ type/);
    }
    const held = toggleContainerHold(office, { containerNo: fresh.containerNo, hold: true, reason: 'Giữ cont' });
    expect(() => swapGateOutContainer(held, { gateOutOrderId: order.id, reason: 'KEN_VO', newContainerNo: fresh.containerNo })).toThrow(/chưa đủ điều kiện CẤP VỎ/);
    expect(() => swapGateOutContainer(office, { gateOutOrderId: order.id, reason: 'KEN_VO', newContainerNo: old.containerNo })).toThrow(/Không tìm thấy container thay thế/);
    expect(() => swapGateOutContainer(office, { gateOutOrderId: order.id, reason: 'X' as never, newContainerNo: fresh.containerNo })).toThrow(/lý do/);
  });
});

// DEC-189: Danh mục chung → Database — sức khỏe database (chỉ Admin); ngưỡng vàng 70% / đỏ 85%
import { evaluateDbHealth, healthAlertCount, validateDbLimits, type DbHealthSnapshot } from '../src/services/dbHealth';

describe('DEC-189: sức khỏe database', () => {
  const MB = 1024 * 1024;
  // Số liệu mẫu CHỈ dùng trong test (không đưa vào dữ liệu Demo)
  const snap = (over: Partial<DbHealthSnapshot> = {}): DbHealthSnapshot => ({
    checkedAt: '2026-10-29T03:00:00.000Z',
    database: { sizeBytes: 100 * MB, version: '15.8', startedAt: '2026-10-01T00:00:00.000Z', cacheHitPct: 99.9, deadlocks: 0, xidAge: 1000, lastActivityAt: null },
    connections: { total: 10, active: 2, idleInTx: 0, waitingLock: 0, slowQueries: 0, longestQuerySec: 0, max: 60 },
    storage: [{ bucket: 'door-photos', files: 100, bytes: 20 * MB }],
    tables: [{ name: 'containers', bytes: 5 * MB, rows: 50_000, deadRows: 100, vacuumedAt: null }],
    cron: [{ name: 'matran-purge-request-log', schedule: '30 18 * * *', active: true, lastStatus: 'succeeded', lastStartAt: null, failed7d: 0 }],
    partitions: [{ table: 'audit_logs', nextMonthReady: true, defaultRows: 0 }],
    limits: { dbMb: 1000, storageMb: 1000, updatedBy: null, updatedAt: null },
    ...over,
  });
  const level = (s: DbHealthSnapshot, key: string, latency?: number) => evaluateDbHealth(s, latency).find((c) => c.key === key)!.level;

  it('bình thường → không cảnh báo', () => {
    expect(healthAlertCount(evaluateDbHealth(snap(), 200))).toBe(0);
  });

  it('dung lượng / kết nối: vàng từ 70%, đỏ từ 85%', () => {
    const db = (mb: number) => snap({ database: { ...snap().database, sizeBytes: mb * MB } });
    expect(level(db(690), 'db-size')).toBe('ok');
    expect(level(db(700), 'db-size')).toBe('warn');
    expect(level(db(850), 'db-size')).toBe('danger');
    expect(level(snap({ storage: [{ bucket: 'door-photos', files: 1, bytes: 900 * MB }] }), 'storage-size')).toBe('danger');
    expect(level(snap({ connections: { ...snap().connections, total: 45 } }), 'connections')).toBe('warn');
  });

  it('tác vụ lỗi → đỏ; truy vấn chậm, partition chưa tạo, phản hồi chậm → cảnh báo', () => {
    expect(level(snap({ cron: [{ ...snap().cron[0], lastStatus: 'failed', failed7d: 1 }] }), 'cron')).toBe('danger');
    expect(level(snap({ connections: { ...snap().connections, slowQueries: 1, longestQuerySec: 90 } }), 'slow-queries')).toBe('warn');
    expect(level(snap({ connections: { ...snap().connections, slowQueries: 1, longestQuerySec: 400 } }), 'slow-queries')).toBe('danger');
    expect(level(snap({ partitions: [{ table: 'audit_logs', nextMonthReady: false, defaultRows: 0 }] }), 'partitions')).toBe('warn');
    expect(level(snap(), 'latency', 1500)).toBe('warn');
    expect(level(snap(), 'latency', 3500)).toBe('danger');
    expect(level(snap({ tables: [{ name: 'containers', bytes: 1, rows: 40_000, deadRows: 20_000, vacuumedAt: null }] }), 'dead-rows')).toBe('warn');
  });

  it('chỉ Admin mở được menu Database; giới hạn dung lượng phải > 0', () => {
    expect(canOpenMenu(as(createInitialState(), 'usr-admin').currentUser, 'DM_DATABASE')).toBe(true);
    for (const id of ['usr-office', 'usr-inspector', 'usr-forklift', 'usr-acc']) {
      expect(canOpenMenu(as(createInitialState(), id).currentUser, 'DM_DATABASE')).toBe(false);
    }
    expect(() => validateDbLimits(0, 100)).toThrow(/lớn hơn 0/);
    expect(() => validateDbLimits(8192, 102400)).not.toThrow();
  });

  it('số liệu không chứa thông tin đăng nhập / khóa', () => {
    const text = evaluateDbHealth(snap(), 100).map((c) => `${c.label} ${c.value} ${c.threshold} ${c.advice || ''}`).join(' ').toLowerCase();
    for (const bad of ['password', 'mật khẩu', 'secret', 'api key', 'khóa bí mật', 'token']) expect(text).not.toContain(bad);
  });
});

// DEC-191: thông tin chi tiết nhân viên — chỉ Admin sửa; phòng ban độc lập với vai trò; CCCD 12 số, không trùng
import { staffProfileMissing, updateStaffProfile } from '../src/services/depotOperations';
import { addStaffUser as addStaff } from '../src/services/depotOperations';

describe('DEC-191: thông tin chi tiết nhân viên', () => {
  const admin = as(createInitialState(), 'usr-admin');
  const target = admin.staffUsers.find((u) => u.id === 'usr-forklift')!;

  it('tạo nhân viên chỉ cần họ tên + vai trò (phòng ban tùy chọn); thông tin chi tiết để trống = chưa cập nhật', () => {
    const s = addStaff(admin, { fullName: 'Nguyễn Văn Mới', email: 'moi@matran.vn', roles: ['FORKLIFT'], department: 'CLEANING' });
    const u = s.staffUsers[s.staffUsers.length - 1];
    expect(u.department).toBe('CLEANING'); // phòng ban độc lập với vai trò (Xe nâng)
    expect(u.roles).toEqual(['FORKLIFT']);
    expect(staffProfileMissing(u)).toEqual(['Giới tính', 'CCCD', 'Năm sinh', 'Quê quán']);
  });

  it('Admin cập nhật đủ thông tin; nhật ký không ghi số CCCD', () => {
    const s = updateStaffProfile(admin, { userId: target.id, department: 'FORKLIFT', gender: 'NAM', idNumber: '031 095 012 345', birthYear: 1995, hometown: 'Hải Phòng' });
    const u = s.staffUsers.find((x) => x.id === target.id)!;
    expect(u).toMatchObject({ department: 'FORKLIFT', gender: 'NAM', idNumber: '031095012345', birthYear: 1995, hometown: 'Hải Phòng' });
    expect(staffProfileMissing(u)).toEqual([]);
    expect(s.auditLogs[0].summary).not.toContain('031095012345');
    // để trống lại = chưa cập nhật
    const cleared = updateStaffProfile(s, { userId: target.id, idNumber: '', hometown: ' ' });
    expect(staffProfileMissing(cleared.staffUsers.find((x) => x.id === target.id)!)).toContain('CCCD');
  });

  it('từ chối: không phải Admin, CCCD sai / trùng, năm sinh sai, phòng ban sai', () => {
    expect(() => updateStaffProfile(as(admin, 'usr-office'), { userId: target.id, gender: 'NU' })).toThrow(/ADMIN/);
    expect(() => updateStaffProfile(admin, { userId: target.id, idNumber: '12345' })).toThrow(/12 chữ số/);
    const withId = updateStaffProfile(admin, { userId: 'usr-office', idNumber: '031095012345' });
    expect(() => updateStaffProfile(withId, { userId: target.id, idNumber: '031095012345' })).toThrow(/đã có ở nhân viên khác/);
    expect(() => updateStaffProfile(admin, { userId: target.id, birthYear: 1900 })).toThrow(/Năm sinh không hợp lệ/);
    expect(() => updateStaffProfile(admin, { userId: target.id, birthYear: new Date().getFullYear() })).toThrow(/Năm sinh không hợp lệ/);
    expect(() => updateStaffProfile(admin, { userId: target.id, department: 'X' as never })).toThrow(/Phòng ban/);
  });
});

// DEC-192: ĐỔI CONTAINER khi CHƯA NÂNG HẠ (lái xe kiểm tra trước) — cont cũ giữ chỗ; Xe nâng Chờ cấp vỏ đổi sang cont mới (nhãn ĐỔI CONT)
describe('DEC-192: đổi container trước khi nâng hạ', () => {
  const demo = createDemoState();
  const order = demo.gateOutOrders.find((o) => o.status === 'PENDING_FORKLIFT')!;
  const old = demo.containers.find((c) => c.masterDossierCode === order.masterDossierCode && c.containerNo === order.containerNo)!;
  const office = as(demo, 'usr-office');
  const fresh = swapCandidates(office, order.id)[0];

  it('Kén vỏ: cont cũ giữ nguyên vị trí, tồn bãi cấp được ngay; lệnh vẫn chờ Xe nâng, sang cont mới (ĐỔI CONT)', () => {
    expect(canSwapGateOut(order)).toBe(true);
    expect(isGateOutLifted(order)).toBe(false);
    const s = swapGateOutContainer(office, { gateOutOrderId: order.id, reason: 'KEN_VO', newContainerNo: fresh.containerNo });
    const back = s.containers.find((c) => c.id === old.id)!;
    expect(back.status).toBe('IN_YARD');
    expect(back.currentBlock).toBe(old.currentBlock); // không có việc Xe nâng hạ lại
    expect(back.swapReturn).toBeUndefined();
    expect(back.outDossierCode).toBeUndefined();
    expect(releaseBlocker(back)).toBeNull();
    const o = s.gateOutOrders.find((x) => x.id === order.id)!;
    expect(o.status).toBe('PENDING_FORKLIFT');
    expect(o.containerNo).toBe(fresh.containerNo);
    expect(o.swaps![0].lifted).toBe(false);
    const nf = s.containers.find((c) => c.id === fresh.id)!;
    expect(nf.status).toBe('ALLOCATED');
    expect(containerOperation(s, nf).code).toBe('DOI_CONT');
    expect(s.bookings.find((b) => b.bookingNo === order.bookingNo)!.allocatedContainers).toContain(fresh.containerNo);
    expect(s.bookings.find((b) => b.bookingNo === order.bookingNo)!.allocatedContainers).not.toContain(old.containerNo);
    // Không phải hạ cont cũ → cấp cont mới được ngay bằng QR phiếu đang cầm
    const out = executeGateOut(as(s, 'usr-forklift'), { scannedQrCode: `QR-${order.gateOutCode}` });
    expect(out.containers.find((c) => c.id === fresh.id)!.status).toBe('GATED_OUT');
    const rows = dossierHistory(s, resolveDossier(s, old.masterDossierCode)!).rows;
    expect(rows.some((r) => r.operation === 'Xe nâng — Cấp vỏ')).toBe(false); // cont cũ chưa từng lên xe
    expect(rows.find((r) => r.task === 'ĐỔI CONT')?.detail).toContain('Chưa nâng hạ');
  });

  it('Hư hỏng: cont cũ giữ chỗ, chuyển DAMAGE + PHÁT SINH CẤP VỎ, vào Chờ báo giá ngay', () => {
    const s = swapGateOutContainer(office, { gateOutOrderId: order.id, reason: 'DAMAGE', newContainerNo: fresh.containerNo, note: 'Móp vách' });
    const back = s.containers.find((c) => c.id === old.id)!;
    expect(back).toMatchObject({ status: 'IN_YARD', conditionClass: 'DAMAGE', releaseDamage: true, needsQuotation: true });
    expect(s.workOrders.find((w) => w.masterDossierCode === old.masterDossierCode && w.category === 'INSPECTION' && w.workStatus === 'OPEN')?.items).toEqual(['Móp vách']);
  });
});

// DEC-194: Văn phòng → Cấp vỏ: Tác nghiệp Release for customer (mặc định) / Release for sale (bắt buộc Sale code); các bước sau giống nhau
describe('DEC-194: cấp vỏ Release for sale', () => {
  const office = as(createInitialState(), 'usr-office');
  const base = { bookingNo: 'BK-SALE-1', customerName: VIETLOG, containerNo: 'MSKU4089123', truckNo: '15H-1', driverPhone: '0912345678', feeCatalogIds: [FEE_LOLO_40HC_MSK] };

  it('mặc định Release for customer (không lưu sale code)', () => {
    const s = createReleaseOrder(office, { ...base, saleCode: 'BỎ QUA' });
    expect(s.gateOutOrders[0].releasePurpose).toBeUndefined();
    expect(s.gateOutOrders[0].saleCode).toBeUndefined();
  });

  it('Release for sale: bắt buộc Sale code; lưu viết hoa; thanh toán → Xe nâng như thường; hồ sơ ghi rõ', () => {
    expect(() => createReleaseOrder(office, { ...base, releasePurpose: 'SALE', saleCode: '  ' })).toThrow(/SALE CODE/);
    expect(() => createReleaseOrder(office, { ...base, releasePurpose: 'SALE', saleCode: 'X'.repeat(41) })).toThrow(/40 ký tự/);
    let s = createReleaseOrder(office, { ...base, releasePurpose: 'SALE', saleCode: 'sl-2026-001' });
    const o = s.gateOutOrders[0];
    expect(o).toMatchObject({ releasePurpose: 'SALE', saleCode: 'SL-2026-001', gateOutType: 'EMPTY_RELEASE' });
    s = confirmReleasePayment(s, { gateOutOrderId: o.id, paymentCategory: 'TTTT', directMethod: 'CASH' });
    expect(s.gateOutOrders.find((x) => x.id === o.id)!.status).toBe('PENDING_FORKLIFT');
    s = executeGateOut(as(s, 'usr-forklift'), { containerNo: 'MSKU4089123' });
    expect(s.gateOutOrders.find((x) => x.id === o.id)!.status).toBe('GATE_OUT_OK');
    const row = dossierHistory(s, resolveDossier(s, o.gateOutCode)!).rows.find((r) => r.operation === 'Văn phòng — Cấp vỏ')!;
    expect(row.detail).toContain('Release for sale');
    expect(row.detail).toContain('Sale code SL-2026-001');
  });
});

// DEC-195: mã ISO 6346 theo Size + Type (Danh mục Container) — màn hình vẫn 20DC / 40HC…
import { containerIsoCode, setContainerIsoCode } from '../src/services/depotOperations';

describe('DEC-195: mã ISO 6346', () => {
  const admin = as(createInitialState(), 'usr-admin');
  it('mặc định có mã thường dùng; cont có mã riêng thì ưu tiên mã riêng', () => {
    expect(containerIsoCode(admin, { size: '20', type: 'DC' })).toBe('22G1');
    expect(containerIsoCode(admin, { size: '40', type: 'HC' })).toBe('45G1');
    expect(containerIsoCode(admin, { size: '45', type: 'HC' })).toBe('L5G1');
    expect(containerIsoCode(admin, { size: '40', type: 'HC', isoCode: '4510' })).toBe('4510');
    expect(containerIsoCode(admin, { size: '45', type: 'DC' })).toBe('');
  });
  it('Admin đặt / sửa / bỏ mã; từ chối sai quyền, sai mã, size / type ngoài Danh mục', () => {
    let s = setContainerIsoCode(admin, { size: '40', type: 'hc', isoCode: '45g1 ' });
    s = setContainerIsoCode(s, { size: '45', type: 'DC', isoCode: 'L2G1' });
    expect(containerIsoCode(s, { size: '45', type: 'DC' })).toBe('L2G1');
    s = setContainerIsoCode(s, { size: '45', type: 'DC', isoCode: '' });
    expect(containerIsoCode(s, { size: '45', type: 'DC' })).toBe('');
    expect(() => setContainerIsoCode(as(admin, 'usr-office'), { size: '40', type: 'HC', isoCode: '45G1' })).toThrow(/ADMIN/);
    expect(() => setContainerIsoCode(admin, { size: '40', type: 'HC', isoCode: '45G' })).toThrow(/4 ký tự/);
    expect(() => setContainerIsoCode(admin, { size: '53', type: 'HC', isoCode: '45G1' })).toThrow(/Danh mục Container/);
  });
});

// DEC-198: GIÁM ĐỊNH CHỤP ẢNH CẤP VỎ (cont MSK) — sau khi Xe nâng cấp, trước khi Văn phòng trả chứng từ
import { hasReleasePhoto, needsReleasePhoto, pendingReleasePhotos, recordReleasePhotos, RELEASE_PHOTO_MAX } from '../src/services/releasePhoto';
import { confirmDocumentsReturn as returnDocs, getDriverRoute as routeOf, releaseTicketsInProgress } from '../src/services/driverRoute';

describe('DEC-198: Giám định chụp ảnh cấp vỏ cont MSK', () => {
  const demo = createDemoState();
  const order = pendingReleasePhotos(demo)[0];
  const ticket = demo.k80Tickets.find((t) => t.outDossierCode === order.gateOutCode)!;
  const inspector = as(demo, 'usr-inspector');

  it('cont MSK đã cấp lên xe vào hàng chờ; lộ trình K80 có bước GIÁM ĐỊNH; chưa chụp thì không trả chứng từ', () => {
    expect(needsReleasePhoto(demo, order)).toBe(true);
    expect(routeOf(demo, ticket).map((x) => x.dept)).toEqual(['VĂN PHÒNG', 'XE NÂNG', 'GIÁM ĐỊNH', 'VĂN PHÒNG']);
    expect(() => returnDocs(as(demo, 'usr-office'), { scannedQrCode: ticket.qrCode })).toThrow(/GIÁM ĐỊNH — Chụp ảnh cấp vỏ/);
    expect(releaseTicketsInProgress(demo).find((r) => r.order.id === order.id)?.photoWait).toBe(true);
    expect(dossierHistory(demo, resolveDossier(demo, order.gateOutCode)!).pending.some((p) => p.dept === 'Giám định' && p.task === 'Chụp ảnh cấp vỏ')).toBe(true);
  });

  it('chụp 1 ảnh → rời hàng chờ, có dòng hồ sơ kèm ảnh, Văn phòng trả chứng từ được', () => {
    const s = recordReleasePhotos(inspector, { gateOutOrderId: order.id, photos: ['data:a'] });
    const o = s.gateOutOrders.find((x) => x.id === order.id)!;
    expect(hasReleasePhoto(o)).toBe(true);
    expect(o.releasePhotosBy).toBe(inspector.currentUser.fullName);
    expect(pendingReleasePhotos(s).some((x) => x.id === order.id)).toBe(false);
    const row = dossierHistory(s, resolveDossier(s, order.gateOutCode)!).rows.find((r) => r.operation === 'Giám định — Chụp ảnh cấp vỏ')!;
    expect(row.photos).toEqual(['data:a']);
    expect(row.dept).toBe('Giám định');
    expect(s.auditLogs.some((a) => a.actionCode === 'RELEASE_PHOTOS' && a.entityCode === order.gateOutCode)).toBe(true);
    expect(returnDocs(as(s, 'usr-office'), { scannedQrCode: ticket.qrCode }).pack.dossierCode).toBe(order.gateOutCode);
    expect(() => recordReleasePhotos(as(s, 'usr-inspector'), { gateOutOrderId: order.id, photos: ['data:b'] })).toThrow(/Đã chụp ảnh cấp vỏ/);
  });

  it('từ chối: sai quyền, không có ảnh, quá 30 ảnh, Xe nâng chưa cấp, đã trả chứng từ', () => {
    expect(() => recordReleasePhotos(as(demo, 'usr-forklift'), { gateOutOrderId: order.id, photos: ['data:a'] })).toThrow(/Không đủ quyền/);
    expect(() => recordReleasePhotos(inspector, { gateOutOrderId: order.id, photos: [] })).toThrow(/ít nhất 1 ảnh/);
    expect(() => recordReleasePhotos(inspector, { gateOutOrderId: order.id, photos: Array(RELEASE_PHOTO_MAX + 1).fill('data:a') })).toThrow(/Tối đa 30/);
    const waiting = demo.gateOutOrders.find((o) => o.status === 'PENDING_FORKLIFT')!;
    expect(() => recordReleasePhotos(inspector, { gateOutOrderId: waiting.id, photos: ['data:a'] })).toThrow(/chưa cấp/);
    const returned = demo.gateOutOrders.find((o) => o.documentsReturnedAt);
    if (returned) expect(() => recordReleasePhotos(inspector, { gateOutOrderId: returned.id, photos: ['data:a'] })).toThrow(/đã trả chứng từ/);
  });

  it('cont hãng khác không phải chụp — lộ trình giữ 3 bước, Giám định không chụp được', () => {
    let s = createReleaseOrder(as(createInitialState(), 'usr-office'), {
      bookingNo: 'BK-R', customerName: VIETLOG, containerNo: 'MSKU4089123', truckNo: '15H', driverPhone: '0912345678', feeCatalogIds: [FEE_LOLO_40HC_MSK],
    });
    s = confirmReleasePayment(as(s, 'usr-office'), { gateOutOrderId: s.gateOutOrders[0].id, paymentCategory: 'TTS', ttsNote: 'x' });
    s = executeGateOut(as(s, 'usr-forklift'), { containerNo: 'MSKU4089123' });
    expect(needsReleasePhoto(s, s.gateOutOrders[0])).toBe(false);
    expect(routeOf(s, s.k80Tickets[0]).map((x) => x.dept)).toEqual(['VĂN PHÒNG', 'XE NÂNG', 'VĂN PHÒNG']);
    expect(() => recordReleasePhotos(as(s, 'usr-inspector'), { gateOutOrderId: s.gateOutOrders[0].id, photos: ['data:a'] })).toThrow(/không thuộc hãng/);
  });

  it('đổi container sau khi chụp: ảnh cũ không tính, cont mới phải chụp lại', () => {
    let s = recordReleasePhotos(inspector, { gateOutOrderId: order.id, photos: ['data:a'] });
    const old = s.containers.find((c) => c.masterDossierCode === order.masterDossierCode && c.containerNo === order.containerNo)!;
    const fresh = swapCandidates(s, order.id)[0];
    s = swapGateOutContainer(as(s, 'usr-office'), { gateOutOrderId: order.id, reason: 'KEN_VO', newContainerNo: fresh.containerNo });
    expect(hasReleasePhoto(s.gateOutOrders.find((x) => x.id === order.id))).toBe(false);
    expect(old.containerNo).not.toBe(fresh.containerNo);
  });
});


// Đồng bộ 30 giây (DEC-158): lệnh cấp mới dùng lại booking tạo ngày trước → phải tải bù booking / cont còn thiếu (lỗi GOUT-002 ở Xe nâng)
import { missingReleaseRefs } from '../src/services/remote/loadWorking';

describe('Đồng bộ: tải bù booking / cont lệnh cấp trỏ tới', () => {
  it('lệnh mới về máy nhưng booking cũ (không đổi) chưa có → cần tải bù; đã có thì không tải lại', () => {
    const gateOuts = [
      { id: 'o1', booking_id: 'bk-old', container_id: 'c1' },
      { id: 'o2', booking_id: 'bk-old', container_id: 'c2' },
      { id: 'o3', booking_id: 'bk-today', container_id: 'c1' },
    ];
    expect(missingReleaseRefs({ gateOuts, bookings: [{ id: 'bk-today' }], containers: [{ id: 'c1' }] })).toEqual({ bookings: ['bk-old'], containers: ['c2'] });
    expect(missingReleaseRefs({ gateOuts, bookings: [{ id: 'bk-old' }, { id: 'bk-today' }], containers: [{ id: 'c1' }, { id: 'c2' }] })).toEqual({ bookings: [], containers: [] });
    expect(missingReleaseRefs({ gateOuts: [{ id: 'o4', booking_id: null, container_id: null }], bookings: [], containers: [] })).toEqual({ bookings: [], containers: [] });
  });
});
