// DEC-108: DỮ LIỆU TEST đầy đủ các trường hợp — người dùng yêu cầu để kiểm thử bản Demo.
// Dữ liệu được tạo bằng cách CHẠY ĐÚNG các hàm nghiệp vụ (đúng vai trò, đúng thứ tự), không ghi tay vào state,
// nên mã hồ sơ / phiếu thu / chứng từ / K80 / nhật ký luôn khớp quy tắc như khi nhân viên thao tác thật.
// DEC-148: Hãng tàu duy nhất MSK; 10 khách hàng (KH01 → KH10); công ty CÔNG TY CỔ PHẦN MATRAN; biểu giá 20DC / 40DC / 40HC / 45HC + Thu gom rác LV1 / LV2.
import { createCleanState, DepotState } from './depotStore';
import {
  completeRepairTask,
  confirmGateInPaymentAndComplete,
  confirmPrepaidCash,
  confirmQuotationToRepair,
  confirmReleasePayment,
  createMasterPrepaidReceipt,
  createReleaseOrder,
  addDepotFeeCatalogItem,
  addPartnerCatalogItem,
  deleteDepotFeeCatalogItem,
  deletePartnerCatalogItem,
  executeGateOut,
  updateCompanyProfile,
  recordGateInFieldStep,
  saveQuotationDraft,
  simulateDemoBankTransfer,
  toggleContainerHold,
  updateContainerLocation,
  verifyGateInOfficeAndCreatePayment,
} from './depotOperations';
import { createVesselList, executeVesselExport, inspectVesselImportItem } from './vessel';
import { completeCleaningTask, completeRackInspection, shiftContainer } from './depotOperations';
import { markInvoiceIssued, prepaidInvoiceView, submitInvoiceRequest, submitPrepaidInvoiceGroup } from './invoice';
import { respondFeedback, submitFeedback } from './feedback';
import type { ContainerSize, ContainerType } from '../types/depot';

const as = (state: DepotState, userId: string): DepotState => ({
  ...state,
  currentUser: state.staffUsers.find((u) => u.id === userId) || state.currentUser,
});

const LINE = 'MSK';
// 10 khách hàng test (tên chung — người dùng chưa cung cấp tên thật); KH09, KH10 không cho TTS để thử chặn
const CUSTOMERS = Array.from({ length: 10 }, (_, i) => {
  const no = String(i + 1).padStart(2, '0');
  return { code: `KH${no}`, name: `Khách hàng ${no}`, allowTts: i < 8 };
});
const KH = (n: number) => CUSTOMERS[n - 1].name;
const TYPE: Record<string, ContainerType> = { '20': 'DC', '40': 'HC', '45': 'HC' };
// Biểu giá (đã gồm VAT) theo yêu cầu người dùng
const LOLO: { size: ContainerSize; type: ContainerType; amount: number }[] = [
  { size: '20', type: 'DC', amount: 1_000_000 },
  { size: '40', type: 'DC', amount: 1_500_000 },
  { size: '40', type: 'HC', amount: 1_500_000 },
  { size: '45', type: 'HC', amount: 1_500_000 },
];
const RAC = [
  { name: 'THU GOM RÁC LV1', amount: 200_000 },
  { name: 'THU GOM RÁC LV2', amount: 500_000 },
];
let FEES: Record<string, string[]> = {};

// Danh mục: hãng tàu, khách hàng, công ty, biểu giá — qua hàm Danh mục của Admin
function seedCatalog(state: DepotState): DepotState {
  let s = as(state, 'usr-admin');
  for (const p of s.partners) s = deletePartnerCatalogItem(s, p.id);
  for (const f of s.feeCatalog) s = deleteDepotFeeCatalogItem(s, f.id);
  s = addPartnerCatalogItem(s, { code: LINE, name: 'MSK', partnerType: 'SHIPPING_LINE', allowTts: true });
  for (const c of CUSTOMERS) s = addPartnerCatalogItem(s, { code: c.code, name: c.name, partnerType: 'CUSTOMER', allowTts: c.allowTts });
  s = updateCompanyProfile(s, {
    name: 'CÔNG TY CỔ PHẦN MATRAN',
    shortName: 'MATRAN DEPOT',
    address: 'Số 189, đường Đình Vũ, phường Hải An, thành phố Hải Phòng.',
    phone: '0912907980',
    email: 'Matran@gmail.com',
    taxCode: '',
    bankAccount: '',
  });
  for (const l of LOLO) s = addDepotFeeCatalogItem(s, { category: 'NANG_HA', size: l.size, type: l.type, shippingLineCode: 'ALL', defaultAmountInclVat: l.amount });
  for (const r of RAC) s = addDepotFeeCatalogItem(s, { category: 'THU_GOM_RAC', name: r.name, defaultAmountInclVat: r.amount });
  const lolo = (size: string, type: string) => s.feeCatalog.find((f) => f.category === 'NANG_HA' && f.size === size && f.type === type)!.id;
  const rac = (name: string) => s.feeCatalog.find((f) => f.name === name)!.id;
  FEES = {
    '20': [lolo('20', 'DC'), rac('THU GOM RÁC LV1')],
    '40DC': [lolo('40', 'DC'), rac('THU GOM RÁC LV1')],
    '40': [lolo('40', 'HC'), rac('THU GOM RÁC LV1')],
    '45': [lolo('45', 'HC'), rac('THU GOM RÁC LV2')],
  };
  return s;
}

type Pay = { kind: 'TT_CASH' } | { kind: 'TT_BANK' } | { kind: 'TTR'; qr: string } | { kind: 'TTS' } | { kind: 'NONE' };

interface GateInCase {
  containerNo: string;
  size: ContainerSize;
  customer: string;
  pay: Pay;
  damage?: string[];
  cleaning?: string[];
  rack?: boolean; // DEC-147: W-SURVEY (lên kệ)
  type?: ContainerType;
  truckNo: string;
}

// Hạ vỏ: Giám định → Văn phòng lập chứng từ → thanh toán theo hình thức
function gateIn(state: DepotState, c: GateInCase): DepotState {
  let s = recordGateInFieldStep(as(state, 'usr-inspector'), {
    gateInType: 'CUSTOMER_RETURN',
    doorPhotoUrl: 'data:image/jpeg;base64,AAA',
    conditionClass: c.rack ? 'W-SURVEY' : c.damage ? 'DAMAGE' : 'AV',
    damageRemarks: c.damage,
    stuffingClass: c.rack ? undefined : 'E',
    cleaningItems: c.cleaning || ['KHÔNG VỆ SINH'],
    manufactureYear: c.rack ? undefined : 2019,
  });
  const order = s.gateInOrders[0];
  s = verifyGateInOfficeAndCreatePayment(as(s, 'usr-office'), {
    gateInId: order.id,
    containerNo: c.containerNo,
    size: c.size,
    type: c.type || TYPE[c.size],
    truckNo: c.truckNo,
    driverPhone: '0912 345 678',
    customerName: c.customer,
    shippingLineCode: LINE,
    orderDocNo: `EIR-${c.containerNo.slice(-4)}`,
    feeCatalogIds: FEES[c.type === 'DC' && c.size === '40' ? '40DC' : c.size],
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

// DEC-148: KHỐI DỮ LIỆU LỚN — nhiều lượt cho mọi tác nghiệp, đủ các trạng thái, để thử lọc / phân trang / Excel.
// Vẫn chạy bằng hàm nghiệp vụ thật. Số cont MSKU5xxxxxx (Hạ vỏ), MSKU6xxxxxx (Nhập tàu).
const BULK_GATE_IN = 80;
const PAYS: Pay[] = [{ kind: 'TT_CASH' }, { kind: 'TT_BANK' }, { kind: 'TTS' }, { kind: 'TT_CASH' }, { kind: 'TTS' }];
const DAMAGES = [['Móp vách trái'], ['Thủng sàn', 'Rỉ sét nóc'], ['Cong khung cửa'], ['Rách mái'], ['Gãy tay khóa cửa']];
const CLEANINGS = [['WP - QUÉT'], ['WW - RỬA NƯỚC'], ['WP - QUÉT', 'CC - HÓA CHẤT'], ['RM - NHỔ ĐINH'], ['ML - BÓC TEM', 'WW - RỬA NƯỚC']];

function bulkData(state: DepotState): DepotState {
  let s = state;
  type Bulk = { no: string; damage: boolean; cleaning: boolean; rack: boolean; pending: boolean };
  const made: Bulk[] = [];
  for (let i = 0; i < BULK_GATE_IN; i++) {
    const no = `MSKU5${String(i + 1).padStart(6, '0')}`;
    const size = (['20', '40', '40', '45'] as ContainerSize[])[i % 4];
    const type: ContainerType = i % 4 === 2 ? 'DC' : TYPE[size];
    const custIdx = i % 10; // KH01 → KH10
    let pay = PAYS[i % PAYS.length];
    if (pay.kind === 'TTS' && !CUSTOMERS[custIdx].allowTts) pay = { kind: 'TT_CASH' }; // KH09 / KH10 không được TTS
    const pending = i % 17 === 16; // vài lượt dừng ở Chờ thanh toán
    const damage = i % 5 === 3;
    const cleaning = i % 4 === 1;
    const rack = !damage && i % 15 === 7;
    s = gateIn(s, {
      containerNo: no, size, type, customer: CUSTOMERS[custIdx].name, pay: pending ? { kind: 'NONE' } : pay,
      damage: damage ? DAMAGES[i % DAMAGES.length] : undefined,
      cleaning: cleaning ? CLEANINGS[i % CLEANINGS.length] : undefined,
      rack, truckNo: `15C-${String(600 + i).padStart(3, '0')}.${String(10 + (i % 90)).padStart(2, '0')}`,
    });
    made.push({ no, damage, cleaning, rack, pending });
  }

  // Vệ sinh xong 2/3 số cont cần vệ sinh; còn lại ở hàng chờ Vệ sinh
  made.filter((m) => m.cleaning && !m.pending).forEach((m, k) => {
    if (k % 3 !== 2) s = completeCleaningTask(as(s, 'usr-cleaning'), { containerNo: m.no });
  });

  // Xe nâng hạ: AV → BLOCK-A (bay 04 → 20), DAMAGE / W-SURVEY → BLOCK-DAMAGE (bay 04 → 10); vài cont để chờ hạ
  let a = 0;
  let d = 0;
  const placed: Bulk[] = [];
  made.forEach((m, k) => {
    const c = s.containers.find((x) => x.containerNo === m.no && x.status === 'WAITING_PLACEMENT');
    if (!c || c.needsCleaning || k % 11 === 10) return;
    if (m.damage || m.rack) {
      s = place(s, m.no, 'BLOCK-DAMAGE', String(4 + Math.floor(d / 12)).padStart(2, '0'), String(1 + (Math.floor(d / 3) % 4)).padStart(2, '0'), String(1 + (d % 3)).padStart(2, '0'));
      d++;
    } else if (k % 3 === 0) {
      s = place(s, m.no, 'BLOCK-B');
    } else {
      s = place(s, m.no, 'BLOCK-A', String(4 + Math.floor(a / 6)).padStart(2, '0'), String(1 + (a % 6)).padStart(2, '0'), '01');
      a++;
    }
    placed.push(m);
  });

  // Báo giá / Sửa chữa: 1/3 chờ báo giá, 1/3 chờ sửa chữa, 1/3 sửa xong
  placed.filter((m) => m.damage).forEach((m, k) => {
    if (k % 3 === 0) return;
    s = saveQuotationDraft(as(s, 'usr-quotation'), { containerNo: m.no, quotationItems: ['Gò nắn vách', 'Sơn dặm'], laborHours: 1 + (k % 4) });
    s = confirmQuotationToRepair(as(s, 'usr-quotation'), { containerNo: m.no });
    if (k % 3 === 2) s = completeRepairTask(as(s, 'usr-repair'), { containerNo: m.no, teamId: 'rt-1', memberIds: ['rtm-1', 'rtm-2'] });
  });

  // W-SURVEY: một nửa đã giám định bổ sung trên kệ
  placed.filter((m) => m.rack).forEach((m, k) => {
    if (k % 2) return;
    const c = s.containers.find((x) => x.containerNo === m.no && x.status === 'IN_YARD')!;
    s = completeRackInspection(as(s, 'usr-inspector'), { containerId: c.id, conditionClass: 'AV', stuffingClass: 'E', manufactureYear: 2017 });
  });

  // Khóa vài cont; đảo chuyển vài cont
  const av = placed.filter((m) => !m.damage && !m.rack).map((m) => m.no);
  for (const no of av.slice(0, 4)) s = toggleContainerHold(as(s, 'usr-office'), { containerNo: no, hold: true, reason: 'Hãng tàu MSK yêu cầu giữ vỏ' });
  av.slice(4, 8).forEach((no, k) => {
    const c = s.containers.find((x) => x.containerNo === no && x.status === 'IN_YARD')!;
    s = shiftContainer(as(s, 'usr-forklift'), { containerId: c.id, blockCode: 'BLOCK-A', bay: '20', row: String(1 + k).padStart(2, '0'), tier: '02', note: 'Gom cont cùng size' });
  });

  // Cấp vỏ: 24 lệnh — 1/2 đã xuất bãi (TT), 1/4 TTS chờ Xe nâng, 1/4 chờ thanh toán
  const free = av.slice(8, 32);
  free.forEach((no, k) => {
    const c = s.containers.find((x) => x.containerNo === no && x.status === 'IN_YARD')!;
    const fee = FEES[c.size === '40' && c.type === 'DC' ? '40DC' : c.size];
    const cust = CUSTOMERS[k % 8].name;
    s = createReleaseOrder(as(s, 'usr-office'), { bookingNo: `BK-MSK-${String(100 + k).padStart(4, '0')}`, customerName: cust, containerNo: no, truckNo: `15H-${String(700 + k)}.${String(10 + k).padStart(2, '0')}`, driverPhone: '0912 907 980', feeCatalogIds: fee });
    const order = s.gateOutOrders[0];
    if (k % 4 === 3) return; // chờ thanh toán
    if (k % 4 === 2) {
      s = confirmReleasePayment(as(s, 'usr-office'), { gateOutOrderId: order.id, paymentCategory: 'TTS', ttsNote: 'Hãng tàu MSK duyệt công nợ' });
      return;
    }
    s = confirmReleasePayment(as(s, 'usr-office'), { gateOutOrderId: order.id, paymentCategory: 'TTTT', directMethod: 'CASH' });
    s = executeGateOut(as(s, 'usr-forklift'), { containerNo: no });
  });

  // Nhập tàu: 3 tàu × 20 cont — tàu 1 đã giám định hết + hạ một phần, tàu 2 giám định một nửa, tàu 3 chưa làm
  const planned = new Date().toISOString();
  ['MSK ALPHA', 'MSK BRAVO', 'MSK CHARLIE'].forEach((vessel, v) => {
    const trucks = [`15C-8${v}1.11`, `15C-8${v}2.22`];
    const r = createVesselList(as(s, 'usr-office'), {
      mode: 'NHAP_TAU', vesselName: vessel, plannedAt: planned, truckNos: trucks, shippingLineCode: LINE,
      importItems: Array.from({ length: 20 }, (_, j) => {
        const size = (['20', '40', '45'] as ContainerSize[])[j % 3];
        return { containerNo: `MSKU6${v}${String(j + 1).padStart(5, '0')}`, size, type: TYPE[size] };
      }),
    });
    s = r.state;
    const items = s.vesselLists.find((l) => l.id === r.listId)!.items;
    const doCount = v === 0 ? items.length : v === 1 ? 10 : 0;
    items.slice(0, doCount).forEach((it, j) => {
      const dmg = j % 6 === 5;
      s = inspectVesselImportItem(as(s, 'usr-inspector'), {
        listId: r.listId, itemId: it.id, actualContainerNo: it.containerNo, truckNo: trucks[j % 2],
        conditionClass: dmg ? 'DAMAGE' : 'AV', damageRemarks: dmg ? ['Móp vách sau'] : [], stuffingClass: (['E', 'M', 'K'] as const)[j % 3],
        cleaningItems: j % 4 === 0 ? ['WP - QUÉT'] : ['KHÔNG VỆ SINH'], manufactureYear: 2012 + (j % 10),
      });
      const c = s.containers.find((x) => x.containerNo === it.containerNo && x.status === 'WAITING_PLACEMENT');
      if (v === 0 && c && !c.needsCleaning) s = place(s, it.containerNo, 'BLOCK-B');
    });
  });

  // Xuất tàu: 1 tàu 12 cont đã xuất một nửa
  const exportNos = av.slice(32, 44).filter((no) => s.containers.some((x) => x.containerNo === no && x.status === 'IN_YARD' && !x.isOnHold));
  if (exportNos.length) {
    const xt = createVesselList(as(s, 'usr-office'), {
      mode: 'XUAT_TAU', vesselName: 'MSK DELTA', plannedAt: planned, truckNos: ['15C-901.01', '15C-902.02'],
      exportContainerIds: exportNos.map((no) => s.containers.find((c) => c.containerNo === no && c.status === 'IN_YARD')!.id),
    });
    s = xt.state;
    s.vesselLists.find((l) => l.id === xt.listId)!.items.forEach((it, j) => {
      if (j % 2 === 0) s = executeVesselExport(as(s, 'usr-forklift'), { listId: xt.listId, itemId: it.id, truckNo: j % 4 ? '15C-902.02' : '15C-901.01' });
    });
  }

  // Góp ý: nhiều màn
  const fb: [string, string, string, string][] = [
    ['usr-inspector', 'GD_HA_VO', 'Giám định → Hạ vỏ', 'Ảnh chụp cửa cont cần phóng to được.'],
    ['usr-cleaning', 'VS_CHO_VE_SINH', 'Vệ sinh → Chờ vệ sinh', 'Muốn xem trước loại vệ sinh trên danh sách.'],
    ['usr-quotation', 'BG_CHO_BAO_GIA', 'Báo giá → Chờ báo giá', 'Thêm mẫu hạng mục sửa chữa hay dùng.'],
    ['usr-repair', 'SC_CHO_SUA_CHUA', 'Sửa chữa', 'Chọn tổ mặc định theo ca.'],
    ['usr-office', 'VP_TON_VO', 'Văn phòng → Tồn vỏ', 'Lọc theo khách hàng.'],
    ['usr-acc', 'VP_PHIEU_THU', 'Văn phòng → Phiếu thu', 'Xuất Excel theo tháng.'],
  ];
  for (const [u, menuId, menuLabel, content] of fb) s = submitFeedback(as(s, u), { menuId: menuId as never, menuLabel, content });
  return s;
}

export function createDemoState(): DepotState {
  let s = seedCatalog(createCleanState());

  // ── PHIẾU THU TRẢ TRƯỚC: 1 phiếu đã thu tiền mặt (dùng được), 1 phiếu chờ chuyển khoản
  s = createMasterPrepaidReceipt(as(s, 'usr-office'), { customerCode: 'KH01', lotDescription: 'Lô 10 cont tháng này', totalAmount: 10_000_000, method: 'CASH' });
  const prepaid = s.masterReceipts[0];
  const topupTx = s.paymentTransactions.find((t) => t.masterReceiptId === prepaid.id)!;
  s = confirmPrepaidCash(as(s, 'usr-office'), { transactionId: topupTx.id });
  s = createMasterPrepaidReceipt(as(s, 'usr-office'), { customerCode: 'KH01', lotDescription: 'Lô bổ sung (chờ chuyển khoản)', totalAmount: 5_000_000, method: 'BANK_TRANSFER_API' });
  const qr = s.masterReceipts.find((m) => m.id === prepaid.id)!.qrCode;

  // ── HẠ VỎ → TỒN VỎ: đủ hình thức thanh toán, tình trạng, vị trí, khóa
  const cases: GateInCase[] = [
    { containerNo: 'MSKU1000011', size: '20', customer: KH(3), pay: { kind: 'TT_CASH' }, truckNo: '15C-101.01' },
    { containerNo: 'MSKU1000022', size: '40', type: 'DC', customer: KH(4), pay: { kind: 'TT_BANK' }, truckNo: '15C-102.02' },
    { containerNo: 'MSKU1000033', size: '45', customer: KH(1), pay: { kind: 'TTR', qr }, truckNo: '15C-103.03' },
    { containerNo: 'MSKU1000044', size: '40', customer: KH(5), pay: { kind: 'TTS' }, truckNo: '15C-104.04' },
    { containerNo: 'MSKU1000055', size: '20', customer: KH(6), pay: { kind: 'TT_CASH' }, damage: ['Móp vách trái', 'Thủng sàn'], truckNo: '15C-105.05' },
    { containerNo: 'MSKU1000066', size: '40', customer: KH(7), pay: { kind: 'TTS' }, damage: ['Rách mái'], truckNo: '15C-106.06' },
    { containerNo: 'MSKU1000077', size: '40', customer: KH(1), pay: { kind: 'TTR', qr }, damage: ['Cong khung cửa'], truckNo: '15C-107.07' },
    { containerNo: 'MSKU1000088', size: '20', customer: KH(9), pay: { kind: 'TT_CASH' }, cleaning: ['WW - RỬA NƯỚC'], truckNo: '15C-108.08' },
    { containerNo: 'MSKU1000099', size: '45', customer: KH(8), pay: { kind: 'TTS' }, truckNo: '15C-109.09' },
    { containerNo: 'MSKU1000100', size: '20', customer: KH(10), pay: { kind: 'NONE' }, truckNo: '15C-110.10' },
    // DEC-109: chưa giám định ngay được → Hạ kệ giám định (1 cont đã lên kệ, 1 cont chờ Xe nâng)
    { containerNo: 'MSKU1000111', size: '40', customer: KH(2), pay: { kind: 'TT_CASH' }, rack: true, truckNo: '15C-111.11' },
    { containerNo: 'MSKU1000122', size: '20', customer: KH(3), pay: { kind: 'TTS' }, rack: true, cleaning: ['WP - QUÉT'], truckNo: '15C-112.12' },
    // Dùng cho Cấp vỏ / Xuất tàu
    { containerNo: 'MSKU2000011', size: '40', customer: KH(4), pay: { kind: 'TTS' }, truckNo: '15C-201.01' },
    { containerNo: 'MSKU2000022', size: '20', customer: KH(5), pay: { kind: 'TTS' }, truckNo: '15C-202.02' },
    { containerNo: 'MSKU3000011', size: '40', customer: KH(6), pay: { kind: 'TTS' }, truckNo: '15C-301.01' },
    { containerNo: 'MSKU3000022', size: '20', customer: KH(7), pay: { kind: 'TTS' }, truckNo: '15C-302.02' },
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
  s = place(s, 'MSKU1000111', 'BLOCK-DAMAGE', '03', '01', '01'); // Hạ kệ giám định
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
  s = createReleaseOrder(as(s, 'usr-office'), { bookingNo: 'BK-MSK-0001', customerName: KH(2), containerNo: 'MSKU2000011', truckNo: '15H-501.01', driverPhone: '0987 654 321', feeCatalogIds: FEES['40'] });
  s = confirmReleasePayment(as(s, 'usr-office'), { gateOutOrderId: s.gateOutOrders[0].id, paymentCategory: 'TTTT', directMethod: 'CASH' });
  s = executeGateOut(as(s, 'usr-forklift'), { containerNo: 'MSKU2000011' });
  s = createReleaseOrder(as(s, 'usr-office'), { bookingNo: 'BK-MSK-0002', customerName: KH(2), containerNo: 'MSKU2000022', truckNo: '15H-502.02', driverPhone: '0987 654 322', feeCatalogIds: FEES['20'] });
  s = confirmReleasePayment(as(s, 'usr-office'), { gateOutOrderId: s.gateOutOrders[0].id, paymentCategory: 'TTS', ttsNote: 'Hãng tàu MSK duyệt công nợ' });

  // ── NHẬP TÀU: 1 cont đã hạ bãi, 1 cont DAMAGE + vệ sinh đang chờ, 1 cont chưa giám định
  const planned = new Date().toISOString();
  const nt = createVesselList(as(s, 'usr-office'), {
    mode: 'NHAP_TAU', vesselName: 'MAERSK DETROIT', plannedAt: planned, truckNos: ['15C-401.01', '15C-402.02'], shippingLineCode: LINE,
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
    conditionClass: 'DAMAGE', damageRemarks: ['Móp vách sau'], stuffingClass: 'E', cleaningItems: ['WW - RỬA NƯỚC'], manufactureYear: 2016,
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

  s = bulkData(s);

  // ── XUẤT HÓA ĐƠN (DEC-111): 1 phiếu khách đã gửi yêu cầu, 1 phiếu Kế toán đã xuất; còn lại CHƯA XHD
  const receiptOf = (no: string) => s.paymentReceipts.find((r) => r.containerNo === no)!;
  s = submitInvoiceRequest(s, {
    secret: receiptOf('MSKU1000011').invoiceSecret!,
    taxCode: '0101234567', email: 'ketoan@kh01.test', companyName: 'KHÁCH HÀNG 01', address: 'Hải Phòng', note: 'Gửi hóa đơn trong ngày',
  });
  s = submitInvoiceRequest(s, {
    secret: receiptOf('MSKU1000022').invoiceSecret!,
    taxCode: '0209876543-001', email: 'hoadon@kh02.test', companyName: 'KHÁCH HÀNG 02', address: 'Hải Phòng',
  });
  s = markInvoiceIssued(as(s, 'usr-acc'), { receiptNo: receiptOf('MSKU1000022').receiptNo, invoiceNo: '0000123' });

  // DEC-130: phiếu thu TRẢ TRƯỚC — khách yêu cầu hóa đơn cho 1 trong 2 lượt đã dùng (lượt còn lại chưa yêu cầu)
  const topup = s.paymentReceipts.find((r) => r.purpose === 'PREPAID_TOPUP' && r.receiptNo === prepaid.receiptCode)!;
  const lots = prepaidInvoiceView(s, topup)!.lots;
  s = submitPrepaidInvoiceGroup(s, {
    secret: topup.invoiceSecret!, deductionIds: [lots[lots.length - 1].deductionId],
    taxCode: '0101234567', email: 'ketoan@kh01.test', companyName: 'KHÁCH HÀNG 01', address: 'Hải Phòng',
  });

  // ── GÓP Ý (DEC-120): 1 góp ý mới, 1 góp ý Admin đã phản hồi
  s = submitFeedback(as(s, 'usr-forklift'), { menuId: 'XN_DAO_CHUYEN', menuLabel: 'Xe nâng → Đảo chuyển', content: 'Muốn lọc nhanh theo Block khi đảo chuyển.' });
  s = submitFeedback(as(s, 'usr-office'), { menuId: 'VP_PHIEU_THU', menuLabel: 'Văn phòng → Phiếu thu', content: 'Cần in lại nhiều phiếu thu cùng lúc.' });
  s = respondFeedback(as(s, 'usr-admin'), { id: s.feedbacks[0].id, status: 'DA_XU_LY', response: 'Đã ghi nhận, sẽ làm ở bản sau.' });
  return as(s, 'usr-admin');
}
