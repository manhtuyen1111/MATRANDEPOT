// DEC-108: DỮ LIỆU TEST đầy đủ các trường hợp — người dùng yêu cầu để kiểm thử bản Demo.
// Dữ liệu được tạo bằng cách CHẠY ĐÚNG các hàm nghiệp vụ (đúng vai trò, đúng thứ tự), không ghi tay vào state,
// nên mã hồ sơ / phiếu thu / chứng từ / K80 / nhật ký luôn khớp quy tắc như khi nhân viên thao tác thật.
// Hãng tàu: MAERSK (MSK). Size: 20 / 40 / 45.
import { createCleanState, DepotState } from './depotStore';
import {
  completeRepairTask,
  confirmGateInPaymentAndComplete,
  confirmPrepaidCash,
  confirmQuotationToRepair,
  confirmReleasePayment,
  createMasterPrepaidReceipt,
  createReleaseOrder,
  executeGateOut,
  recordGateInFieldStep,
  saveQuotationDraft,
  simulateDemoBankTransfer,
  toggleContainerHold,
  updateContainerLocation,
  verifyGateInOfficeAndCreatePayment,
} from './depotOperations';
import { createVesselList, executeVesselExport, inspectVesselImportItem } from './vessel';
import type { ContainerSize, ContainerType } from '../types/depot';

const as = (state: DepotState, userId: string): DepotState => ({
  ...state,
  currentUser: state.staffUsers.find((u) => u.id === userId) || state.currentUser,
});

const VIETLOG = 'Công ty Tiếp Vận Việt (VietLog)';
const NAM_HAI = 'Vận Tải Nam Hải';
const FEES: Record<string, string[]> = {
  '20': ['fee-lolo-20-dc-maersk', 'fee-rac-20'],
  '40': ['fee-lolo-40-hc-maersk', 'fee-rac-40'],
  '45': ['fee-lolo-45-hc-all', 'fee-rac-chung'],
};
const TYPE: Record<string, ContainerType> = { '20': 'DC', '40': 'HC', '45': 'HC' };

type Pay = { kind: 'TT_CASH' } | { kind: 'TT_BANK' } | { kind: 'TTR'; qr: string } | { kind: 'TTS' } | { kind: 'NONE' };

interface GateInCase {
  containerNo: string;
  size: ContainerSize;
  customer: string;
  pay: Pay;
  damage?: string[];
  cleaning?: string[];
  truckNo: string;
}

// Hạ vỏ: Giám định → Văn phòng lập chứng từ → thanh toán theo hình thức
function gateIn(state: DepotState, c: GateInCase): DepotState {
  let s = recordGateInFieldStep(as(state, 'usr-inspector'), {
    gateInType: 'CUSTOMER_RETURN',
    doorPhotoUrl: 'data:image/jpeg;base64,AAA',
    conditionClass: c.damage ? 'DAMAGE' : 'AV',
    damageRemarks: c.damage,
    stuffingClass: 'E',
    cleaningItems: c.cleaning || ['KHÔNG VỆ SINH'],
    manufactureYear: 2019,
  });
  const order = s.gateInOrders[0];
  s = verifyGateInOfficeAndCreatePayment(as(s, 'usr-office'), {
    gateInId: order.id,
    containerNo: c.containerNo,
    size: c.size,
    type: TYPE[c.size],
    truckNo: c.truckNo,
    driverPhone: '0912 345 678',
    customerName: c.customer,
    shippingLineCode: 'MAERSK',
    orderDocNo: `EIR-${c.containerNo.slice(-4)}`,
    feeCatalogIds: FEES[c.size],
  });
  const office = as(s, 'usr-office');
  switch (c.pay.kind) {
    case 'TT_CASH':
      return confirmGateInPaymentAndComplete(office, { gateInId: order.id, paymentCategory: 'TTTT', directMethod: 'CASH' });
    case 'TT_BANK': {
      s = confirmGateInPaymentAndComplete(office, { gateInId: order.id, paymentCategory: 'TTTT', directMethod: 'BANK_TRANSFER_API' });
      const tx = s.paymentTransactions.find((t) => t.status === 'PENDING' && t.containerNo === c.containerNo)!;
      return simulateDemoBankTransfer(as(s, 'usr-office'), { transactionId: tx.id });
    }
    case 'TTR':
      return confirmGateInPaymentAndComplete(office, { gateInId: order.id, paymentCategory: 'TTT', scannedQrCode: c.pay.qr });
    case 'TTS':
      return confirmGateInPaymentAndComplete(office, { gateInId: order.id, paymentCategory: 'TTS', ttsNote: 'Hãng tàu MSK duyệt công nợ' });
    case 'NONE':
      return s; // dừng ở Chờ thanh toán
  }
}

const place = (s: DepotState, containerNo: string, blockCode: string, bay?: string, row?: string, tier?: string) =>
  updateContainerLocation(as(s, 'usr-forklift'), { containerNo, blockCode, bay, row, tier, reason: 'Hạ vỏ' });

export function createDemoState(): DepotState {
  let s = as(createCleanState(), 'usr-admin');

  // ── PHIẾU THU TRẢ TRƯỚC: 1 phiếu đã thu tiền mặt (dùng được), 1 phiếu chờ chuyển khoản
  s = createMasterPrepaidReceipt(as(s, 'usr-office'), { customerCode: 'VIETLOG', lotDescription: 'Lô 10 cont tháng này', totalAmount: 10_000_000, method: 'CASH' });
  const prepaid = s.masterReceipts[0];
  const topupTx = s.paymentTransactions.find((t) => t.masterReceiptId === prepaid.id)!;
  s = confirmPrepaidCash(as(s, 'usr-office'), { transactionId: topupTx.id });
  s = createMasterPrepaidReceipt(as(s, 'usr-office'), { customerCode: 'VIETLOG', lotDescription: 'Lô bổ sung (chờ chuyển khoản)', totalAmount: 5_000_000, method: 'BANK_TRANSFER_API' });
  const qr = s.masterReceipts.find((m) => m.id === prepaid.id)!.qrCode;

  // ── HẠ VỎ → TỒN VỎ: đủ hình thức thanh toán, tình trạng, vị trí, khóa
  const cases: GateInCase[] = [
    { containerNo: 'MSKU1000011', size: '20', customer: VIETLOG, pay: { kind: 'TT_CASH' }, truckNo: '15C-101.01' },
    { containerNo: 'MSKU1000022', size: '40', customer: NAM_HAI, pay: { kind: 'TT_BANK' }, truckNo: '15C-102.02' },
    { containerNo: 'MSKU1000033', size: '45', customer: VIETLOG, pay: { kind: 'TTR', qr }, truckNo: '15C-103.03' },
    { containerNo: 'MSKU1000044', size: '40', customer: VIETLOG, pay: { kind: 'TTS' }, truckNo: '15C-104.04' },
    { containerNo: 'MSKU1000055', size: '20', customer: VIETLOG, pay: { kind: 'TT_CASH' }, damage: ['Móp vách trái', 'Thủng sàn'], truckNo: '15C-105.05' },
    { containerNo: 'MSKU1000066', size: '40', customer: VIETLOG, pay: { kind: 'TTS' }, damage: ['Rách mái'], truckNo: '15C-106.06' },
    { containerNo: 'MSKU1000077', size: '40', customer: VIETLOG, pay: { kind: 'TTR', qr }, damage: ['Cong khung cửa'], truckNo: '15C-107.07' },
    { containerNo: 'MSKU1000088', size: '20', customer: NAM_HAI, pay: { kind: 'TT_CASH' }, cleaning: ['WW'], truckNo: '15C-108.08' },
    { containerNo: 'MSKU1000099', size: '45', customer: VIETLOG, pay: { kind: 'TTS' }, truckNo: '15C-109.09' },
    { containerNo: 'MSKU1000100', size: '20', customer: NAM_HAI, pay: { kind: 'NONE' }, truckNo: '15C-110.10' },
    // Dùng cho Cấp vỏ / Xuất tàu
    { containerNo: 'MSKU2000011', size: '40', customer: VIETLOG, pay: { kind: 'TTS' }, truckNo: '15C-201.01' },
    { containerNo: 'MSKU2000022', size: '20', customer: VIETLOG, pay: { kind: 'TTS' }, truckNo: '15C-202.02' },
    { containerNo: 'MSKU3000011', size: '40', customer: VIETLOG, pay: { kind: 'TTS' }, truckNo: '15C-301.01' },
    { containerNo: 'MSKU3000022', size: '20', customer: VIETLOG, pay: { kind: 'TTS' }, truckNo: '15C-302.02' },
  ];
  for (const c of cases) s = gateIn(s, c);

  // Vị trí: Block có Bay / Row / Tier và Block chỉ quản lý theo Block
  s = place(s, 'MSKU1000011', 'BLOCK-A', '01', '01', '01');
  s = place(s, 'MSKU1000022', 'BLOCK-A', '01', '01', '02');
  s = place(s, 'MSKU1000033', 'BLOCK-B');
  s = place(s, 'MSKU1000044', 'BLOCK-A', '02', '01', '01');
  s = place(s, 'MSKU1000055', 'BLOCK-DAMAGE', '01', '01', '01');
  s = place(s, 'MSKU1000066', 'BLOCK-DAMAGE', '01', '02', '01');
  s = place(s, 'MSKU1000077', 'BLOCK-DAMAGE', '02', '01', '01');
  for (const no of ['MSKU2000011', 'MSKU2000022', 'MSKU3000011', 'MSKU3000022']) s = place(s, no, 'BLOCK-B');
  // MSKU1000088: chờ Vệ sinh; MSKU1000099: đã thanh toán, chờ Xe nâng hạ; MSKU1000100: chờ thanh toán

  // Khóa container (Remark Văn phòng)
  s = toggleContainerHold(as(s, 'usr-office'), { containerNo: 'MSKU1000044', hold: true, reason: 'Hãng tàu MSK yêu cầu giữ vỏ' });

  // DAMAGE: 1 chờ báo giá; 1 đã báo giá → chờ sửa chữa; 1 sửa xong → AV
  s = saveQuotationDraft(as(s, 'usr-quotation'), { containerNo: 'MSKU1000066', quotationItems: ['Vá mái 0.5m2'], laborHours: 2 });
  s = confirmQuotationToRepair(as(s, 'usr-quotation'), { containerNo: 'MSKU1000066' });
  s = saveQuotationDraft(as(s, 'usr-quotation'), { containerNo: 'MSKU1000077', quotationItems: ['Nắn khung cửa', 'Thay gioăng'], laborHours: 3.5 });
  s = confirmQuotationToRepair(as(s, 'usr-quotation'), { containerNo: 'MSKU1000077' });
  s = completeRepairTask(as(s, 'usr-repair'), { containerNo: 'MSKU1000077', teamId: 'rt-1', memberIds: ['rtm-1', 'rtm-2'] });

  // ── CẤP VỎ: 1 lượt đã xuất bãi (TT tiền mặt), 1 lượt TTS chờ Xe nâng
  s = createReleaseOrder(as(s, 'usr-office'), { bookingNo: 'BK-MSK-0001', customerName: VIETLOG, containerNo: 'MSKU2000011', truckNo: '15H-501.01', driverPhone: '0987 654 321', feeCatalogIds: FEES['40'] });
  s = confirmReleasePayment(as(s, 'usr-office'), { gateOutOrderId: s.gateOutOrders[0].id, paymentCategory: 'TTTT', directMethod: 'CASH' });
  s = executeGateOut(as(s, 'usr-forklift'), { containerNo: 'MSKU2000011' });
  s = createReleaseOrder(as(s, 'usr-office'), { bookingNo: 'BK-MSK-0002', customerName: VIETLOG, containerNo: 'MSKU2000022', truckNo: '15H-502.02', driverPhone: '0987 654 322', feeCatalogIds: FEES['20'] });
  s = confirmReleasePayment(as(s, 'usr-office'), { gateOutOrderId: s.gateOutOrders[0].id, paymentCategory: 'TTS', ttsNote: 'Hãng tàu MSK duyệt công nợ' });

  // ── NHẬP TÀU: 1 cont đã hạ bãi, 1 cont DAMAGE + vệ sinh đang chờ, 1 cont chưa giám định
  const planned = new Date().toISOString();
  const nt = createVesselList(as(s, 'usr-office'), {
    mode: 'NHAP_TAU', vesselName: 'MAERSK DETROIT', plannedAt: planned, truckNos: ['15C-401.01', '15C-402.02'], shippingLineCode: 'MAERSK',
    importItems: [
      { containerNo: 'MSKU4000011', size: '40', type: 'HC' },
      { containerNo: 'MSKU4000022', size: '20', type: 'DC' },
      { containerNo: 'MSKU4000033', size: '45', type: 'HC' },
    ],
  });
  s = nt.state;
  const ntItems = s.vesselLists.find((l) => l.id === nt.listId)!.items;
  const ntItem = (no: string) => ntItems.find((i) => i.containerNo === no)!;
  s = inspectVesselImportItem(as(s, 'usr-inspector'), {
    listId: nt.listId, itemId: ntItem('MSKU4000011').id, actualContainerNo: 'MSKU4000011', truckNo: '15C-401.01',
    conditionClass: 'AV', damageRemarks: [], stuffingClass: 'E', cleaningItems: ['KHÔNG VỆ SINH'], manufactureYear: 2020,
  });
  s = place(s, 'MSKU4000011', 'BLOCK-A', '03', '01', '01');
  s = inspectVesselImportItem(as(s, 'usr-inspector'), {
    listId: nt.listId, itemId: ntItem('MSKU4000022').id, actualContainerNo: 'MSKU4000022', truckNo: '15C-402.02',
    conditionClass: 'DAMAGE', damageRemarks: ['Móp vách sau'], stuffingClass: 'E', cleaningItems: ['WW'], manufactureYear: 2016,
  });

  // ── XUẤT TÀU: 1 cont đã xuất, 1 cont chờ xuất
  const xt = createVesselList(as(s, 'usr-office'), {
    mode: 'XUAT_TAU', vesselName: 'MAERSK SEMARANG', plannedAt: planned, truckNos: ['15C-501.01'],
    exportContainerIds: ['MSKU3000011', 'MSKU3000022'].map((no) => s.containers.find((c) => c.containerNo === no && c.status === 'IN_YARD')!.id),
  });
  s = xt.state;
  const xtItems = s.vesselLists.find((l) => l.id === xt.listId)!.items;
  s = executeVesselExport(as(s, 'usr-forklift'), { listId: xt.listId, itemId: xtItems.find((i) => i.containerNo === 'MSKU3000011')!.id, truckNo: '15C-501.01' });

  // Vệ sinh: MSKU1000088 (Hạ vỏ) và MSKU4000022 (Nhập tàu) để ở hàng chờ
  return as(s, 'usr-admin');
}
