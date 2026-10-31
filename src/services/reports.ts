import {
  ContainerRecord,
  GateInOrder,
  GateOutOrder,
  GateOutType,
  LocationHistoryItem,
  PaymentTransaction,
  PaymentReceipt,
  PaymentTransactionStatus,
  DirectPaymentMethod,
  ReceiptOperation,
  ServiceWorkOrder,
  VesselList,
  VesselListItem,
  VesselMode,
} from '../types/depot';
import type { DepotState } from './depotStore';
import { formatLocation, storageDays } from './core';
import { YARD_STATUS_LABELS, yardStatus } from './yardStatus';
import { containerPaymentInfo, masterReceiptUsage, PAYMENT_CATEGORY_FULL_LABELS, receiptOperationOf, voucherPaymentInfo } from './payments';
import { formatDateTime, parseDateTime } from './datetime';
import { receiptInvoiceLabel, receiptInvoiceStatus } from './invoice';
import { FEEDBACK_STATUS_LABELS } from './feedback';
import { assertPermission } from './core';
import { vesselListProgress, vesselListStatusLabel } from './vessel';
import type { FeedbackItem, FeedbackStatus, InvoiceStatus } from '../types/depot';
import { matchContainerNo } from './containerSearch';

// ============================================================================
// BÁO CÁO & TRA CỨU (CR-08, CR-04 PHIẾU THU)
// Nguyên tắc: không tự tải toàn bộ dữ liệu; bắt buộc có điều kiện lọc; giới hạn số dòng / trang.
// Ở chế độ Supabase các hàm này tương ứng truy vấn có range/limit phía server.
// ============================================================================

export const REPORT_PAGE_SIZE = 50;
export const RECEIPT_PAGE_SIZE = 20;
// DEC-080: người dùng chọn số dòng / trang ở mọi danh sách nhiều dữ liệu
export const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
export const MAX_RANGE_DAYS = 366;

export interface DateRange {
  dateFrom?: string; // dd/MM/yyyy HH:mm:ss (DEC-054); chấp nhận dd/MM/yyyy hoặc yyyy-MM-dd
  dateTo?: string;   // dd/MM/yyyy HH:mm:ss
}

export interface PagedResult<T> {
  rows: T[];
  total: number;
  page: number;
  pageCount: number;
}

function toRange(range: DateRange): { from: number; to: number } | null {
  if (!range.dateFrom && !range.dateTo) return null;
  if (!range.dateFrom || !range.dateTo) throw new Error('Vui lòng chọn đủ TỪ và ĐẾN (dd/mm/yyyy hh:mm:ss).');
  const fromD = parseDateTime(range.dateFrom, 'start');
  const toD = parseDateTime(range.dateTo, 'end');
  if (!fromD || !toD) throw new Error('Thời gian không hợp lệ — nhập theo dạng dd/mm/yyyy hh:mm:ss.');
  const from = fromD.getTime();
  const to = toD.getTime();
  if (from > to) throw new Error('Thời gian TỪ phải trước hoặc bằng ĐẾN.');
  if ((to - from) / 86_400_000 > MAX_RANGE_DAYS) {
    throw new Error(`Khoảng thời gian tối đa ${MAX_RANGE_DAYS} ngày cho mỗi lần truy vấn.`);
  }
  return { from, to };
}

function inRange(iso: string | undefined, range: { from: number; to: number } | null): boolean {
  if (!range) return true;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= range.from && t <= range.to;
}

// Xuất Excel lấy 1 lần mọi dòng (DEC-178 — trước đây lặp từng trang 20 dòng, mỗi trang lọc + sắp xếp lại toàn bộ)
export const ALL_ROWS = Number.MAX_SAFE_INTEGER;

function paginate<T>(rows: T[], page: number, requested: number): PagedResult<T> {
  const pageSize = requested === ALL_ROWS ? Math.max(1, rows.length) : (PAGE_SIZE_OPTIONS as readonly number[]).includes(requested) ? requested : REPORT_PAGE_SIZE;
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(1, page), pageCount);
  return {
    rows: rows.slice((safePage - 1) * pageSize, safePage * pageSize),
    total: rows.length,
    page: safePage,
    pageCount,
  };
}

export interface OperationReportFilter extends DateRange {
  containerNo?: string;
  shippingLineCode?: string;
  size?: string;
}

function requireFilter(f: OperationReportFilter): { from: number; to: number } | null {
  const range = toRange(f);
  if (!range && !f.containerNo?.trim()) {
    throw new Error('Nhập số container hoặc chọn khoảng thời gian trước khi tra cứu.');
  }
  return range;
}

// Báo cáo CẤP VỎ / XUẤT TÀU (hồ sơ gate-out)
export function queryGateOutReport(
  state: DepotState,
  types: GateOutType[],
  filter: OperationReportFilter,
  page = 1,
  pageSize = REPORT_PAGE_SIZE
): PagedResult<GateOutOrder> {
  const range = requireFilter(filter);
  const no = filter.containerNo?.trim().toUpperCase();
  const contByDossier = filter.shippingLineCode || filter.size ? new Map(state.containers.map((c) => [c.masterDossierCode, c])) : undefined;
  const rows = state.gateOutOrders
    .filter((o) => types.includes(o.gateOutType))
    .filter((o) => matchContainerNo(o.containerNo, no))
    .filter((o) => inRange(o.confirmedAt || o.createdAt, range))
    .filter((o) => {
      if (!filter.shippingLineCode && !filter.size) return true;
      const c = contByDossier?.get(o.masterDossierCode);
      if (filter.shippingLineCode && c?.shippingLineCode !== filter.shippingLineCode) return false;
      if (filter.size && c?.size !== filter.size) return false;
      return true;
    })
    .sort((a, b) => (b.confirmedAt || b.createdAt).localeCompare(a.confirmedAt || a.createdAt));
  return paginate(rows, page, pageSize);
}

// Báo cáo HẠ VỎ / NHẬP TÀU (hồ sơ gate-in)
export function queryGateInReport(
  state: DepotState,
  type: GateInOrder['gateInType'],
  filter: OperationReportFilter,
  page = 1,
  pageSize = REPORT_PAGE_SIZE
): PagedResult<GateInOrder> {
  const range = requireFilter(filter);
  const no = filter.containerNo?.trim().toUpperCase();
  const rows = state.gateInOrders
    .filter((o) => o.gateInType === type)
    .filter((o) => matchContainerNo(o.containerNo, no))
    .filter((o) => inRange(o.gateInOkAt || o.fieldRecordedAt, range))
    .filter((o) => !filter.shippingLineCode || o.shippingLineCode === filter.shippingLineCode)
    .filter((o) => !filter.size || o.size === filter.size)
    .sort((a, b) => (b.gateInOkAt || b.fieldRecordedAt).localeCompare(a.gateInOkAt || a.fieldRecordedAt));
  return paginate(rows, page, pageSize);
}

// ---------------------------------------------------------------------------
// PHIẾU THU — tra cứu giao dịch thu tiền (Chờ thanh toán / Thành công / Thất bại / Hủy)
// ---------------------------------------------------------------------------
export interface ReceiptQueryFilter extends DateRange {
  keyword?: string; // Mã phiếu thu, số container, mã hồ sơ, mã tham chiếu
  method?: DirectPaymentMethod | 'ALL';
  status?: PaymentTransactionStatus | 'ALL';
  operation?: ReceiptOperation | 'ALL';
  receiptNo?: string; // Mở thẳng 1 phiếu thu từ hồ sơ (DEC-051)
  invoiceStatus?: InvoiceStatus | 'ALL'; // DEC-111
}

export interface ReceiptRow {
  transaction: PaymentTransaction;
  receipt?: PaymentReceipt;
}

export function queryReceipts(state: DepotState, filter: ReceiptQueryFilter, page = 1, pageSize = RECEIPT_PAGE_SIZE): PagedResult<ReceiptRow> {
  const range = toRange(filter);
  const keyword = filter.keyword?.trim().toUpperCase();
  if (!range && !keyword && !filter.receiptNo) {
    throw new Error('Chọn khoảng thời gian hoặc nhập từ khóa (mã phiếu thu / số container / mã hồ sơ) trước khi tra cứu.');
  }
  const receiptsByTx = new Map(state.paymentReceipts.map((r) => [r.transactionId, r]));
  const rows = state.paymentTransactions
    .map((transaction) => ({ transaction, receipt: receiptsByTx.get(transaction.id) }))
    .filter(({ transaction }) => inRange(transaction.confirmedAt || transaction.createdAt, range))
    .filter(({ transaction }) => !filter.method || filter.method === 'ALL' || transaction.method === filter.method)
    .filter(({ transaction }) => !filter.status || filter.status === 'ALL' || transaction.status === filter.status)
    .filter(({ transaction, receipt }) => !filter.receiptNo || receipt?.receiptNo === filter.receiptNo || transaction.id === filter.receiptNo)
    .filter(({ receipt }) => !filter.invoiceStatus || filter.invoiceStatus === 'ALL' || (receipt && receiptInvoiceStatus(state, receipt) === filter.invoiceStatus)) // DEC-130
    .filter(
      ({ transaction, receipt }) =>
        !filter.operation || filter.operation === 'ALL' || receiptOperationOf(state, { ...transaction, operation: receipt?.operation }) === filter.operation
    )
    .filter(({ transaction, receipt }) => {
      if (!keyword) return true;
      return [receipt?.receiptNo, transaction.containerNo, transaction.dossierCode, transaction.paymentRef, transaction.payerName]
        .filter(Boolean)
        .some((v) => v!.toUpperCase().includes(keyword));
    })
    .sort((a, b) => b.transaction.createdAt.localeCompare(a.transaction.createdAt));
  return paginate(rows, page, pageSize);
}

// ---------------------------------------------------------------------------
// BÁO CÁO TỔNG HỢP — 5 sheet: HẠ VỎ, CẤP VỎ, XUẤT VỎ, NHẬP VỎ, TỒN VỎ
// ---------------------------------------------------------------------------
export interface SheetData {
  name: string;
  columns: string[];
  rows: (string | number)[][];
}

const fmt = (iso?: string) => (iso ? formatDateTime(iso) : '');

export function gateInSheet(name: string, orders: GateInOrder[], state?: DepotState): SheetData {
  const voucherById = new Map((state?.vouchers || []).map((v) => [v.id, v]));
  return {
    name,
    columns: [
      'MÃ HỒ SƠ', 'SỐ CONTAINER', 'SIZE', 'TYPE', 'HÃNG TÀU', 'LOẠI', 'TRẠNG THÁI HỒ SƠ', 'KHÁCH HÀNG', // DEC-139: 5 cột đầu cố định
      'SỐ XE', 'SĐT LÁI XE', 'SỐ LỆNH / CHỨNG TỪ', 'TRẠNG THÁI', 'GHI CHÚ HƯ HỎNG', 'PHÂN LOẠI ĐÓNG HÀNG',
      'TÌNH TRẠNG VỆ SINH', 'AGE', 'GIÁM ĐỊNH', 'THỜI GIAN GIÁM ĐỊNH', 'VĂN PHÒNG', 'THỜI GIAN VĂN PHÒNG',
      'CHI PHÍ (ĐÃ GỒM VAT)', 'THANH TOÁN', 'MÃ PHIẾU THU', 'GATE IN OK LÚC', 'GATE IN OK BỞI', 'LÝ DO HỦY',
    ],
    rows: orders.map((o) => [
      o.masterDossierCode, o.containerNo || '', o.size || '', o.type || '', o.shippingLineCode || '',
      o.gateInType, o.status, o.customerRep || '', o.truckNo || '', o.driverPhone || '', o.orderDocNo || '',
      o.conditionClass, o.damageRemarks.join('; '), o.stuffingClass || '', o.cleaningItems.join(' + '),
      o.manufactureYear || '', o.fieldStaffName, fmt(o.fieldRecordedAt), o.officeStaffName || '', fmt(o.officeVerifiedAt),
      o.feeAmount || 0,
      // DEC-126: thanh toán + mã phiếu thu (như Tồn vỏ)
      ...(() => { const p = state ? voucherPaymentInfo(state, o.voucherId ? voucherById.get(o.voucherId) : undefined) : undefined; return [p?.label || '', p?.receipt || '']; })(),
      fmt(o.gateInOkAt), o.gateInOkBy || '', o.cancelReason || '',
    ]),
  };
}

export function gateOutSheet(name: string, state: DepotState, orders: GateOutOrder[]): SheetData {
  const contByDossier = new Map(state.containers.map((c) => [c.masterDossierCode, c]));
  const voucherById = new Map(state.vouchers.map((v) => [v.id, v]));
  return {
    name,
    columns: [
      'MÃ HỒ SƠ CẤP', 'SỐ CONTAINER', 'SIZE', 'TYPE', 'HÃNG TÀU', // DEC-139: 5 cột đầu cố định
      'MÃ HỒ SƠ HẠ VỎ', 'LOẠI', 'TRẠNG THÁI HỒ SƠ', 'BOOKING', 'TRẠNG THÁI', 'PHÂN LOẠI ĐÓNG HÀNG', 'KHÁCH HÀNG', 'SỐ XE', 'SĐT LÁI XE',
      'CHI PHÍ (ĐÃ GỒM VAT)', 'THANH TOÁN', 'MÃ PHIẾU THU', 'LẬP LỆNH LÚC', 'LẬP LỆNH BỞI', 'OUT LÚC', 'XÁC NHẬN OUT BỞI',
      'LÝ DO HỦY',
    ],
    rows: orders.map((o) => {
      const c = contByDossier.get(o.masterDossierCode);
      const v = o.voucherId ? voucherById.get(o.voucherId) : undefined;
      return [
        o.gateOutCode, o.containerNo, c?.size || '', c?.type || '', c?.shippingLineCode || '',
        o.masterDossierCode, o.gateOutType, o.status, o.bookingNo, c?.conditionClass || '', c?.stuffingClass || '', o.receiverRep,
        o.truckNo, o.driverPhone || '', o.feeAmount || 0,
        ...(() => { const p = voucherPaymentInfo(state, v); return [p.label, p.receipt]; })(), // DEC-126
        fmt(o.createdAt), o.createdBy || '', fmt(o.confirmedAt), o.confirmedBy || '', o.cancelReason || '',
      ];
    }),
  };
}

function stockSheet(containers: ContainerRecord[]): SheetData {
  return {
    name: 'TỒN VỎ',
    columns: [
      'MÃ HỒ SƠ', 'SỐ CONTAINER', 'SIZE', 'TYPE', 'HÃNG TÀU', 'TRẠNG THÁI', 'PHÂN LOẠI ĐÓNG HÀNG', 'AGE',
      'TÌNH TRẠNG VỆ SINH', 'GHI CHÚ HƯ HỎNG', 'VỊ TRÍ', 'TÌNH TRẠNG LƯU BÃI', 'CHỜ VỆ SINH', 'CHỜ BÁO GIÁ',
      'CHỜ SỬA CHỮA', 'KHÓA', 'GHI CHÚ KHÓA', 'BOOKING ĐÃ LẬP LỆNH', 'MÃ HỒ SƠ CẤP', 'KHÁCH HÀNG', 'SỐ XE HẠ',
      'SĐT LÁI XE HẠ', 'GATE IN LÚC', 'GHI CHÚ VĂN PHÒNG',
    ],
    rows: containers.map((c) => [
      c.masterDossierCode, c.containerNo, c.size, c.type, c.shippingLineCode, c.conditionClass, c.stuffingClass || '',
      c.manufactureYear || '', c.cleaningItems.join(' + '), c.damageRemarks.join('; '), formatLocation(c), c.status,
      c.needsCleaning ? 'X' : '', c.needsQuotation ? 'X' : '', c.needsRepair ? 'X' : '', c.isOnHold ? 'X' : '',
      c.holdReason || '', c.allocatedBookingNo || '', c.outDossierCode || '', c.customerRep, c.truckNo || '',
      c.driverPhone || '', fmt(c.gateInAt), c.officeNote || '',
    ]),
  };
}

export function buildSummaryReport(state: DepotState, range: DateRange): SheetData[] {
  const r = toRange(range);
  if (!r) throw new Error('Báo cáo TỔNG HỢP: vui lòng chọn khoảng thời gian trước khi tạo báo cáo.');
  const gateIn = (type: GateInOrder['gateInType']) =>
    state.gateInOrders.filter((o) => o.gateInType === type && inRange(o.gateInOkAt || o.fieldRecordedAt, r));
  const gateOut = (types: GateOutType[]) =>
    state.gateOutOrders.filter((o) => types.includes(o.gateOutType) && inRange(o.confirmedAt || o.createdAt, r));
  const vesselRows = (mode: VesselMode): VesselReportRow[] =>
    (state.vesselLists || []).filter((l) => l.mode === mode && inRange(l.plannedAt, r)).flatMap((list) => list.items.map((item) => ({ list, item })));
  return [
    gateInSheet('HẠ VỎ', gateIn('CUSTOMER_RETURN'), state),
    gateOutSheet('CẤP VỎ', state, gateOut(['EMPTY_RELEASE'])),
    // DEC-040 + DEC-069: XUẤT VỎ = XUẤT TÀU, NHẬP VỎ = NHẬP TÀU (theo thời gian nhập / xuất tàu của danh sách)
    { ...vesselReportSheet('XUAT_TAU', vesselRows('XUAT_TAU')), name: 'XUẤT VỎ' },
    { ...vesselReportSheet('NHAP_TAU', vesselRows('NHAP_TAU')), name: 'NHẬP VỎ' },
    // TỒN VỎ phản ánh thời điểm lập báo cáo, không theo khoảng thời gian
    stockSheet(state.containers.filter((c) => c.status !== 'GATED_OUT')),
  ];
}

// Xuất Excel dạng SpreadsheetML 2003 (nhiều sheet, mở được bằng Excel) — không cần cài thêm thư viện
function xmlEscape(v: string | number): string {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function toSpreadsheetXml(sheets: SheetData[]): string {
  const cell = (v: string | number) =>
    typeof v === 'number'
      ? `<Cell><Data ss:Type="Number">${v}</Data></Cell>`
      : `<Cell><Data ss:Type="String">${xmlEscape(v)}</Data></Cell>`;
  const body = sheets
    .map(
      (s) =>
        `<Worksheet ss:Name="${xmlEscape(s.name)}"><Table>` +
        `<Row>${s.columns.map((c) => `<Cell ss:StyleID="h"><Data ss:Type="String">${xmlEscape(c)}</Data></Cell>`).join('')}</Row>` +
        s.rows.map((row) => `<Row>${row.map(cell).join('')}</Row>`).join('') +
        `</Table></Worksheet>`
    )
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?>' +
    '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">' +
    '<Styles><Style ss:ID="h"><Font ss:Bold="1"/></Style></Styles>' +
    body +
    '</Workbook>'
  );
}

// ---------------------------------------------------------------------------
// BÁO CÁO SỬA CHỮA CHI TIẾT (DEC-044) — bắt buộc bộ lọc, phân trang
// ---------------------------------------------------------------------------
export interface RepairReportFilter extends DateRange {
  containerNo?: string;
  teamCode?: string;
  shippingLineCode?: string;
  status?: 'ALL' | 'OPEN' | 'COMPLETED' | 'CANCELLED';
}

export interface RepairReportRow {
  workOrder: ServiceWorkOrder;
  container?: ContainerRecord;
}

export function queryRepairReport(state: DepotState, filter: RepairReportFilter, page = 1, pageSize = REPORT_PAGE_SIZE): PagedResult<RepairReportRow> {
  const range = toRange(filter);
  const no = filter.containerNo?.trim().toUpperCase();
  if (!range && !no) throw new Error('Nhập số container hoặc chọn khoảng thời gian trước khi tra cứu.');
  const contByDossier = new Map(state.containers.map((c) => [c.masterDossierCode, c]));
  const rows = state.workOrders
    .filter((w) => w.category === 'REPAIR')
    .map((workOrder) => ({ workOrder, container: contByDossier.get(workOrder.masterDossierCode) }))
    .filter(({ workOrder: w }) => matchContainerNo(w.containerNo, no))
    .filter(({ workOrder: w }) => inRange(w.completedAt || w.createdAt, range))
    .filter(({ workOrder: w }) => !filter.teamCode || w.repairTeamCode === filter.teamCode)
    .filter(({ container }) => !filter.shippingLineCode || container?.shippingLineCode === filter.shippingLineCode)
    .filter(({ workOrder: w }) => !filter.status || filter.status === 'ALL' || w.workStatus === filter.status)
    .sort((a, b) => (b.workOrder.completedAt || b.workOrder.createdAt).localeCompare(a.workOrder.completedAt || a.workOrder.createdAt));
  return paginate(rows, page, pageSize);
}

export function repairReportSheet(rows: RepairReportRow[]): SheetData {
  return {
    name: 'SỬA CHỮA',
    columns: [
      'MÃ HỒ SƠ', 'SỐ CONTAINER', 'SIZE', 'TYPE', 'HÃNG TÀU', 'REMARK SỬA CHỮA', 'GIỜ CÔNG', 'TRẠNG THÁI',
      'BÁO GIÁ BỞI', 'NGÀY BÁO GIÁ', 'TỔ SỬA CHỮA', 'NHÂN VIÊN', 'HOÀN TẤT BỞI', 'NGÀY HOÀN TẤT',
    ],
    rows: rows.map(({ workOrder: w, container: c }) => [
      w.masterDossierCode, w.containerNo, c?.size || '', c?.type || '', c?.shippingLineCode || '', w.items.join('; '),
      w.laborHours || 0, w.workStatus, w.approvedBy || '', fmt(w.createdAt), w.repairTeamName || '',
      (w.repairMembers || []).join(', '), w.completedBy || '', fmt(w.completedAt),
    ]),
  };
}

// SẢN LƯỢNG SỬA CHỮA (DEC-170): giờ công từng nhân viên theo bộ lọc.
// Chỉ tính cont ĐÃ SỬA XONG, theo thời gian hoàn tất. Giờ công cont chia đều cho số nhân viên tác nghiệp (1 người = cả, 2 = chia 2, 3 = chia 3…).
export interface RepairOutputFilter extends DateRange {
  teamCode?: string;
  memberName?: string;
}

export interface RepairOutputJob {
  workOrder: ServiceWorkOrder;
  container?: ContainerRecord;
  memberCount: number;
  share: number;
  // DEC-174: bậc thợ + đơn giá CHỐT lúc sửa xong (cont sửa trước khi có bậc thợ → lấy bậc hiện tại)
  gradeName?: string;
  hourlyRate?: number;
  amount?: number;
}

export interface RepairOutputRow {
  memberName: string;
  teamName: string;
  containers: number;
  hours: number;
  jobs: RepairOutputJob[];
  // DEC-173 / DEC-174: bậc / đơn giá chỉ hiện khi cả kỳ cùng 1 mức
  gradeName?: string;
  hourlyRate?: number;
  // DEC-175: LƯƠNG SẢN PHẨM = tổng (giờ chia × đơn giá chốt của từng cont);
  // GIỜ VƯỢT GIỜ = giờ công trong khoảng lọc vượt mốc; SẢN PHẨM VƯỢT GIỜ = giờ vượt × đơn giá vượt giờ;
  // TỔNG TIỀN SẢN PHẨM = LƯƠNG SẢN PHẨM + SẢN PHẨM VƯỢT GIỜ
  productWage?: number;
  overtimeHours: number;
  overtimeAmount: number;
  amount?: number;
}

// Bậc thợ hiện tại theo tên nhân viên (phiếu sửa chữa lưu tên) — ưu tiên dòng đang hoạt động, có bậc thợ
function gradeOfMember(state: DepotState, name: string) {
  const members = state.repairTeams.flatMap((t) => t.members).filter((m) => m.fullName === name && m.gradeId);
  const m = members.find((x) => x.isActive) || members[members.length - 1];
  return m ? (state.repairGrades || []).find((g) => g.id === m.gradeId) : undefined;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function queryRepairOutput(state: DepotState, filter: RepairOutputFilter): RepairOutputRow[] {
  const range = toRange(filter);
  if (!range) throw new Error('Chọn khoảng thời gian trước khi tra cứu.');
  const byMember = new Map<string, RepairOutputRow>();
  const contByDossier = new Map(state.containers.map((c) => [c.masterDossierCode, c]));
  const gradeCache = new Map<string, ReturnType<typeof gradeOfMember>>();
  const gradeOf = (name: string) => {
    if (!gradeCache.has(name)) gradeCache.set(name, gradeOfMember(state, name));
    return gradeCache.get(name);
  };
  state.workOrders
    .filter((w) => w.category === 'REPAIR' && w.workStatus === 'COMPLETED' && inRange(w.completedAt, range))
    .filter((w) => !filter.teamCode || w.repairTeamCode === filter.teamCode)
    .forEach((w) => {
      const members = Array.from(new Set((w.repairMembers || []).map((m) => m.trim()).filter(Boolean)));
      if (!members.length) return;
      const share = (w.laborHours || 0) / members.length;
      const container = contByDossier.get(w.masterDossierCode);
      members
        .filter((m) => !filter.memberName || m === filter.memberName)
        .forEach((m) => {
          const key = `${w.repairTeamName || ''}|${m}`;
          const row = byMember.get(key) || { memberName: m, teamName: w.repairTeamName || '', containers: 0, hours: 0, jobs: [], overtimeHours: 0, overtimeAmount: 0 };
          row.containers += 1;
          row.hours += share;
          const fixed = (w.repairMemberRates || []).find((x) => x.name.trim() === m && x.hourlyRate !== undefined);
          const now = fixed ? undefined : gradeOf(m);
          const gradeName = fixed ? fixed.gradeName : now?.name;
          const hourlyRate = fixed ? fixed.hourlyRate : now?.hourlyRate;
          row.jobs.push({
            workOrder: w, container, memberCount: members.length, share: round2(share),
            gradeName, hourlyRate, amount: hourlyRate === undefined ? undefined : Math.round(share * hourlyRate),
          });
          byMember.set(key, row);
        });
    });
  const overtime = state.repairOvertime;
  return Array.from(byMember.values())
    .map((r) => {
      const priced = r.jobs.filter((j) => j.amount !== undefined);
      const rates = new Set(priced.map((j) => j.hourlyRate));
      const grades = new Set(priced.map((j) => j.gradeName));
      const hours = round2(r.hours);
      const productWage = priced.length ? priced.reduce((s, j) => s + (j.amount || 0), 0) : undefined;
      const overtimeHours = overtime ? round2(Math.max(0, hours - overtime.thresholdHours)) : 0;
      const overtimeAmount = overtime ? Math.round(overtimeHours * overtime.hourlyRate) : 0;
      return {
        ...r,
        hours,
        gradeName: grades.size === 1 ? [...grades][0] : grades.size > 1 ? 'Nhiều bậc' : undefined,
        hourlyRate: rates.size === 1 ? [...rates][0] : undefined,
        productWage,
        overtimeHours,
        overtimeAmount,
        amount: productWage === undefined && !overtimeAmount ? undefined : (productWage || 0) + overtimeAmount,
      };
    })
    .map((r) => ({ ...r, jobs: r.jobs.sort((a, b) => (b.workOrder.completedAt || '').localeCompare(a.workOrder.completedAt || '')) }))
    .sort((a, b) => a.teamName.localeCompare(b.teamName) || b.hours - a.hours || a.memberName.localeCompare(b.memberName));
}

export function repairOutputSheets(rows: RepairOutputRow[]): SheetData[] {
  return [
    {
      name: 'SẢN LƯỢNG SỬA CHỮA',
      columns: ['TỔ SỬA CHỮA', 'NHÂN VIÊN', 'BẬC THỢ', 'SỐ CONT', 'GIỜ CÔNG', 'NHÂN CÔNG BẬC THỢ (Đ/GIỜ)', 'LƯƠNG SẢN PHẨM', 'GIỜ VƯỢT GIỜ', 'SẢN PHẨM VƯỢT GIỜ', 'TỔNG TIỀN SẢN PHẨM (VND)'],
      rows: [
        ...rows.map((r) => [r.teamName, r.memberName, r.gradeName || '', r.containers, r.hours, r.hourlyRate ?? '', r.productWage ?? '', r.overtimeHours, r.overtimeAmount, r.amount ?? '']),
        [
          '', 'TỔNG', '', rows.reduce((s, r) => s + r.containers, 0), round2(rows.reduce((s, r) => s + r.hours, 0)), '',
          rows.reduce((s, r) => s + (r.productWage || 0), 0), round2(rows.reduce((s, r) => s + r.overtimeHours, 0)),
          rows.reduce((s, r) => s + r.overtimeAmount, 0), rows.reduce((s, r) => s + (r.amount || 0), 0),
        ],
      ],
    },
    {
      // Vượt giờ tính trên tổng giờ cả kỳ của nhân viên → sheet chi tiết từng cont chỉ có LƯƠNG SẢN PHẨM
      name: 'CHI TIẾT',
      columns: ['TỔ SỬA CHỮA', 'NHÂN VIÊN', 'MÃ HỒ SƠ', 'SỐ CONTAINER', 'SIZE', 'TYPE', 'HÃNG TÀU', 'GIỜ CÔNG CONT', 'SỐ NGƯỜI', 'GIỜ CÔNG CHIA', 'BẬC THỢ', 'NHÂN CÔNG BẬC THỢ (Đ/GIỜ)', 'LƯƠNG SẢN PHẨM', 'NGÀY HOÀN TẤT'],
      rows: rows.flatMap((r) =>
        r.jobs.map((j) => [
          r.teamName, r.memberName, j.workOrder.masterDossierCode, j.workOrder.containerNo, j.container?.size || '', j.container?.type || '',
          j.container?.shippingLineCode || '', j.workOrder.laborHours || 0, j.memberCount, j.share,
          j.gradeName || '', j.hourlyRate ?? '', j.amount ?? '', fmt(j.workOrder.completedAt),
        ])
      ),
    },
  ];
}

// Xuất Excel .xlsx chuẩn (Q-034). exceljs chỉ được tải khi người dùng bấm "Tải Excel" (dynamic import).
export async function toXlsxBuffer(sheets: SheetData[]): Promise<ArrayBuffer> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  wb.creator = 'MATRAN DEPOT';
  wb.created = new Date();
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name.slice(0, 31));
    // Kiểu basic, chuyên nghiệp: tiêu đề đậm nền xám, viền mỏng, cố định dòng tiêu đề, bộ lọc cột, số tiền có dấu phân cách
    const thin = { style: 'thin' as const, color: { argb: 'FFBFBFBF' } };
    const border = { top: thin, left: thin, bottom: thin, right: thin };
    const header = ws.addRow(s.columns);
    header.eachCell((c) => {
      c.font = { bold: true };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE7E6E6' } };
      c.alignment = { vertical: 'middle', wrapText: true };
      c.border = border;
    });
    for (const row of s.rows) {
      const r = ws.addRow(row);
      r.eachCell({ includeEmpty: true }, (c) => {
        c.border = border;
        if (typeof c.value === 'number' && Math.abs(c.value) >= 1000) c.numFmt = '#,##0';
      });
    }
    ws.views = [{ state: 'frozen', ySplit: 1 }];
    if (s.columns.length) ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: s.columns.length } };
    ws.columns.forEach((col, i) => {
      const longest = Math.max(s.columns[i]?.length || 0, ...s.rows.slice(0, 200).map((r) => String(r[i] ?? '').length));
      col.width = Math.min(Math.max(longest + 2, 8), 50);
    });
  }
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

// Lấy toàn bộ kết quả theo bộ lọc (mọi trang) để xuất Excel
export function collectAllPages<T>(query: (page: number, pageSize: number) => PagedResult<T>): T[] {
  const first = query(1, ALL_ROWS);
  const rows = [...first.rows];
  for (let p = 2; p <= first.pageCount; p++) rows.push(...query(p, ALL_ROWS).rows);
  return rows;
}

// Sheet PHIẾU THU (DEC-055) — đủ cột tra cứu / đối soát
// DEC-111, DEC-130: 8 cột hóa đơn của phiếu thu — phiếu thu trả trước ghép các yêu cầu theo lượt (ngăn cách "; ")
function invoiceCells(state: DepotState, r: PaymentReceipt | undefined): string[] {
  if (!r) return ['', '', '', '', '', '', '', ''];
  const groups = r.invoiceGroups || [];
  if (groups.length) {
    const j = (f: (g: (typeof groups)[number]) => string | undefined) => groups.map((g) => f(g) || '-').join('; ');
    return [receiptInvoiceLabel(state, r), j((g) => g.taxCode), j((g) => g.email), j((g) => g.companyName), j((g) => g.address), j((g) => g.note),
      j((g) => g.invoiceNo), j((g) => (g.issuedAt ? `${fmt(g.issuedAt)} • ${g.issuedBy}` : undefined))];
  }
  const q = r.invoiceRequest;
  return [receiptInvoiceLabel(state, r), q?.taxCode || '', q?.email || '', q?.companyName || '', q?.address || '', q?.note || '', r.invoiceIssued?.invoiceNo || '',
    r.invoiceIssued ? `${fmt(r.invoiceIssued.issuedAt)} • ${r.invoiceIssued.issuedBy}` : ''];
}

export function receiptsSheet(state: DepotState, rows: ReceiptRow[]): SheetData {
  const STATUS: Record<string, string> = { PENDING: 'Chờ thanh toán', SUCCEEDED: 'Thành công', FAILED: 'Thất bại', CANCELLED: 'Đã hủy' };
  const OP: Record<string, string> = { HA_VO: 'HẠ VỎ', CAP_VO: 'CẤP VỎ', THU_TRUOC: 'THU TRƯỚC (TTR)', KHAC: 'KHÁC' };
  return {
    name: 'PHIẾU THU',
    columns: [
      'MÃ PHIẾU THU', 'TÁC NGHIỆP', 'SỐ CONTAINER', 'TRẠNG THÁI', 'SỐ TIỀN', 'HÌNH THỨC TT', 'PHƯƠNG THỨC TT', 'BÊN THANH TOÁN', 'MÃ HỒ SƠ',
      'PHIẾU THU TRẢ TRƯỚC', 'MÃ THAM CHIẾU', 'MÃ GD NGÂN HÀNG', 'TẠO LÚC', 'NGƯỜI TẠO',
      'XÁC NHẬN THU LÚC', 'NGƯỜI XÁC NHẬN', 'LÝ DO HỦY', 'SỐ LẦN IN', 'IN GẦN NHẤT',
      // DEC-111: xuất hóa đơn
      'TRẠNG THÁI HĐ', 'MÃ SỐ THUẾ', 'GMAIL NHẬN HĐ', 'TÊN CÔNG TY', 'ĐỊA CHỈ', 'GHI CHÚ HĐ', 'SỐ HÓA ĐƠN', 'CẬP NHẬT XHD',
      'SỐ LƯỢT ĐÃ DÙNG (TTR)', 'CÒN LẠI (TTR)',
    ],
    rows: rows.map(({ transaction: t, receipt: r }) => [
      r?.receiptNo || '', OP[receiptOperationOf(state, { ...t, operation: r?.operation })], t.containerNo || '', STATUS[t.status] || t.status, t.amount,
      PAYMENT_CATEGORY_FULL_LABELS[t.paymentCategory] || t.paymentCategory, t.method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản', t.payerName,
      // DEC-121: phiếu thu trả trước → mã hồ sơ các tác nghiệp đã dùng phiếu
      t.purpose === 'PREPAID_TOPUP' ? masterReceiptUsage(state, r?.masterReceiptCode || t.paymentRef)?.rows.map((u) => u.dossierCode).join(', ') || '' : t.dossierCode || '',
      r?.masterReceiptCode || (t.purpose === 'PREPAID_TOPUP' ? t.paymentRef : ''), t.paymentRef,
      t.providerTxRef || '', fmt(t.createdAt), t.createdBy, fmt(t.confirmedAt), t.confirmedBy || '', t.cancelReason || '',
      r?.printLog?.length || 0, r?.printLog?.length ? `${fmt(r.printLog[r.printLog.length - 1].at)} • ${r.printLog[r.printLog.length - 1].by}` : '',
      ...invoiceCells(state, r),
      // DEC-079: phiếu thu trước — số lượt tác nghiệp đã trừ, số tiền còn lại
      ...(() => {
        const u = t.purpose === 'PREPAID_TOPUP' ? masterReceiptUsage(state, r?.masterReceiptCode || t.paymentRef) : undefined;
        return u ? [u.usedCount, u.remainingAmount] : ['', ''];
      })(),
    ]),
  };
}

// Sheet TỒN VỎ (DEC-065)
export function yardStockSheet(rows: ContainerRecord[], state?: DepotState): SheetData {
  return {
    name: 'TỒN VỎ',
    columns: [
            // DEC-128: PHÂN LOẠI ngay sau TRẠNG THÁI; DEC-129: AGE sau HÃNG TÀU (cùng thứ tự màn hình); DEC-202: bỏ TIẾN ĐỘ, TRẠNG THÁI = 1 trạng thái hiện tại
      'MÃ HỒ SƠ', 'SỐ CONTAINER', 'SIZE', 'TYPE', 'HÃNG TÀU', 'AGE', 'DATE IN', 'VÀO BÃI BẰNG', 'TRẠNG THÁI', 'PHÂN LOẠI', 'LƯU BÃI (NGÀY)', 'VỊ TRÍ',
      'THANH TOÁN', 'MÃ PHIẾU THU',
      'KHÁCH HÀNG', 'SỐ XE HẠ', 'KHÓA', 'NGƯỜI KHÓA', 'KHÓA LÚC', 'GHI CHÚ', 'GHI CHÚ BỞI', 'GHI CHÚ LÚC',
    ],
    rows: rows.map((c) => {
      const pay = state ? containerPaymentInfo(state, c) : undefined;
      return [
        c.masterDossierCode, c.containerNo, c.size, c.type, c.shippingLineCode, c.manufactureYear || '', fmt(c.gateInAt), c.masterDossierCode.startsWith('NT-') ? 'NHẬP TÀU' : 'HẠ VỎ',
        state ? YARD_STATUS_LABELS[yardStatus(state, c)] : c.conditionClass, c.stuffingClass || '', storageDays(c.gateInAt), formatLocation(c),
        pay?.label || '', pay?.receipt || '',
        c.customerRep || '', c.truckNo || '', c.isOnHold ? 'ĐANG KHÓA' : '', c.holdBy || '', fmt(c.holdAt),
        c.officeNote || '', c.officeNoteUpdatedBy || '', fmt(c.officeNoteUpdatedAt),
      ];
    }),
  };
}

// ---------------------------------------------------------------------------
// BÁO CÁO NHẬP TÀU / XUẤT TÀU (DEC-069) — mỗi dòng = 1 container trong danh sách tàu
// Bắt buộc lọc: khoảng thời gian (theo thời gian nhập / xuất tàu) hoặc số cont / tên tàu.
// ---------------------------------------------------------------------------
export interface VesselReportFilter extends DateRange {
  containerNo?: string;
  vesselName?: string;
}
export interface VesselReportRow {
  list: VesselList;
  item: VesselListItem;
}

export function queryVesselReport(state: DepotState, mode: VesselMode, filter: VesselReportFilter, page = 1, pageSize = REPORT_PAGE_SIZE): PagedResult<VesselReportRow> {
  const range = toRange(filter);
  const no = filter.containerNo?.trim().toUpperCase();
  const vessel = filter.vesselName?.trim().toUpperCase();
  if (!range && !no && !vessel) throw new Error('Nhập số container / tên tàu hoặc chọn khoảng thời gian trước khi tra cứu.');
  const rows = (state.vesselLists || [])
    .filter((l) => l.mode === mode)
    .filter((l) => !vessel || l.vesselName.includes(vessel))
    .filter((l) => inRange(l.plannedAt, range))
    .flatMap((list) => list.items.filter((i) => matchContainerNo(i.containerNo, no)).map((item) => ({ list, item })))
    .sort((a, b) => b.list.plannedAt.localeCompare(a.list.plannedAt) || a.item.containerNo.localeCompare(b.item.containerNo));
  return paginate(rows, page, pageSize);
}

const VESSEL_ITEM_STATUS: Record<string, Record<string, string>> = {
  NHAP_TAU: { PENDING: 'Chờ xe về', INSPECTED: 'Đã giám định — chờ hạ', DONE: 'Đã hạ bãi', SKIPPED: 'Không kịp (gạch)' }, // DEC-131
  XUAT_TAU: { PENDING: 'Chờ xuất', INSPECTED: '-', DONE: 'Đã xuất tàu', SKIPPED: 'Không kịp (gạch)' },
};

export function vesselReportSheet(mode: VesselMode, rows: VesselReportRow[]): SheetData {
  const isImport = mode === 'NHAP_TAU';
  return {
    name: isImport ? 'NHẬP TÀU' : 'XUẤT TÀU',
    columns: [
      'TÊN TÀU', 'MÃ HỒ SƠ', 'SỐ CONTAINER', 'SIZE', 'TYPE', 'HÃNG TÀU', // DEC-139: 6 cột đầu cố định
      isImport ? 'THỜI GIAN NHẬP TÀU' : 'THỜI GIAN XUẤT TÀU', 'DUYỆT DANH SÁCH',
      'TIẾN ĐỘ', 'SỐ XE', 'TRẠNG THÁI', 'PHÂN LOẠI', ...(isImport ? ['VỆ SINH', 'AGE', 'GHI CHÚ HƯ HỎNG', 'GIÁM ĐỊNH', 'GIÁM ĐỊNH LÚC'] : ['VỊ TRÍ LÚC LẬP']),
      isImport ? 'HẠ BÃI BỞI' : 'XUẤT BỞI', isImport ? 'HẠ BÃI LÚC' : 'XUẤT LÚC', 'LẬP DANH SÁCH', 'LẬP LÚC',
    ],
    rows: rows.map(({ list: l, item: i }) => [
      l.vesselName, i.dossierCode || '', i.containerNo, i.size, i.type, l.shippingLineCode || '',
      fmt(l.plannedAt), l.status === 'APPROVED' ? `ĐÃ DUYỆT • ${l.approvedBy || ''} • ${fmt(l.approvedAt)}` : 'Chưa duyệt',
      VESSEL_ITEM_STATUS[mode][i.status], i.truckNo || '', i.conditionClass || '', i.stuffingClass || '',
      ...(isImport
        ? [(i.cleaningItems || []).join(', '), i.manufactureYear || '', (i.damageRemarks || []).join(', '), i.inspectedBy || '', fmt(i.inspectedAt)]
        : [i.locationAtList || '']),
      i.doneBy || '', fmt(i.doneAt), l.createdBy, fmt(l.createdAt),
    ]),
  };
}

// BÁO CÁO NHẬP / XUẤT TÀU — chế độ xem THEO TÀU (DEC-165): mỗi danh sách tàu 1 dòng, cùng bộ lọc với chi tiết
export interface VesselSummaryRow {
  list: VesselList;
  total: number;
  size20: number;
  size40: number;
  done: number;
  inspected: number;
  pending: number;
  skipped: number;
}

export function queryVesselSummaryReport(state: DepotState, mode: VesselMode, filter: VesselReportFilter, page = 1, pageSize = REPORT_PAGE_SIZE): PagedResult<VesselSummaryRow> {
  const range = toRange(filter);
  const no = filter.containerNo?.trim().toUpperCase();
  const vessel = filter.vesselName?.trim().toUpperCase();
  if (!range && !no && !vessel) throw new Error('Nhập số container / tên tàu hoặc chọn khoảng thời gian trước khi tra cứu.');
  const rows = (state.vesselLists || [])
    .filter((l) => l.mode === mode)
    .filter((l) => !vessel || l.vesselName.includes(vessel))
    .filter((l) => inRange(l.plannedAt, range))
    .filter((l) => !no || l.items.some((i) => matchContainerNo(i.containerNo, no)))
    .sort((a, b) => b.plannedAt.localeCompare(a.plannedAt))
    .map((list) => {
      const p = vesselListProgress(list);
      const size20 = list.items.filter((i) => String(i.size).startsWith('2')).length;
      return { list, total: p.total, size20, size40: p.total - size20, done: p.done, inspected: p.inspected, pending: p.pending, skipped: p.skipped };
    });
  return paginate(rows, page, pageSize);
}

export function vesselSummarySheet(mode: VesselMode, rows: VesselSummaryRow[]): SheetData {
  const isImport = mode === 'NHAP_TAU';
  return {
    name: isImport ? 'NHẬP TÀU THEO TÀU' : 'XUẤT TÀU THEO TÀU',
    columns: [
      'TÊN TÀU', 'HÃNG TÀU', isImport ? 'THỜI GIAN NHẬP TÀU' : 'THỜI GIAN XUẤT TÀU', 'SỐ LƯỢNG', "20'", "40'+",
      isImport ? 'ĐÃ HẠ BÃI' : 'ĐÃ XUẤT', ...(isImport ? ['ĐÃ GIÁM ĐỊNH - CHỜ HẠ'] : []), isImport ? 'CHỜ XE VỀ' : 'CHỜ XUẤT', 'KHÔNG KỊP',
      'TRẠNG THÁI', 'NGƯỜI TẠO', 'TẠO LÚC', 'NGƯỜI DUYỆT', 'DUYỆT LÚC', 'LÝ DO DUYỆT',
    ],
    rows: rows.map((r) => [
      r.list.vesselName, r.list.shippingLineCode || '', fmt(r.list.plannedAt), r.total, r.size20, r.size40,
      r.done, ...(isImport ? [r.inspected] : []), r.pending, r.skipped,
      vesselListStatusLabel(r.list), r.list.createdBy, fmt(r.list.createdAt), r.list.approvedBy || '', fmt(r.list.approvedAt), r.list.approveNote || '',
    ]),
  };
}

// ---------------------------------------------------------------------------
// BÁO CÁO GÓP Ý (DEC-120) — chỉ Admin; lọc thời gian / trạng thái / menu / từ khóa
// ---------------------------------------------------------------------------
export interface FeedbackFilter extends DateRange {
  status?: FeedbackStatus | 'ALL';
  menuId?: string; // 'ALL' hoặc mã menu
  keyword?: string; // mã góp ý, nội dung, người góp ý
}

export function queryFeedback(state: DepotState, filter: FeedbackFilter, page = 1, pageSize = REPORT_PAGE_SIZE): PagedResult<FeedbackItem> {
  assertPermission(state, 'FEEDBACK_MANAGE', 'chỉ Quản trị viên (Admin) được xem báo cáo góp ý.');
  const range = toRange(filter);
  const keyword = filter.keyword?.trim().toLowerCase();
  const rows = (state.feedbacks || [])
    .filter((f) => inRange(f.createdAt, range))
    .filter((f) => !filter.status || filter.status === 'ALL' || f.status === filter.status)
    .filter((f) => !filter.menuId || filter.menuId === 'ALL' || f.menuId === filter.menuId)
    .filter((f) => !keyword || [f.code, f.content, f.createdBy, f.menuLabel].some((v) => v.toLowerCase().includes(keyword)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return paginate(rows, page, pageSize);
}

export function feedbackSheet(rows: FeedbackItem[]): SheetData {
  return {
    name: 'GÓP Ý',
    columns: ['MÃ GÓP Ý', 'THỜI GIAN', 'NGƯỜI GÓP Ý', 'MENU / TÍNH NĂNG', 'NỘI DUNG', 'TRẠNG THÁI', 'PHẢN HỒI', 'PHẢN HỒI LÚC', 'NGƯỜI PHẢN HỒI'],
    rows: rows.map((f) => [
      f.code, fmt(f.createdAt), f.createdBy, f.menuLabel, f.content, FEEDBACK_STATUS_LABELS[f.status], f.response || '', fmt(f.respondedAt), f.respondedBy || '',
    ]),
  };
}

// ---------------------------------------------------------------------------
// BÁO CÁO THEO BỘ PHẬN (DEC-179): GIÁM ĐỊNH / VỆ SINH / XE NÂNG — CHI TIẾT
// ---------------------------------------------------------------------------
export const INSPECTION_OPERATION_LABELS: Record<GateInOrder['gateInType'], string> = { CUSTOMER_RETURN: 'Hạ vỏ', VESSEL_IMPORT: 'Nhập tàu' };
// Tác nghiệp của lượt lưu bãi theo mã hồ sơ (NT- = Nhập tàu, còn lại Hạ vỏ)
export const visitOperationLabel = (dossierCode: string) => (dossierCode.startsWith('NT-') ? 'Nhập tàu' : 'Hạ vỏ');

export interface InspectionReportFilter extends DateRange {
  containerNo?: string;
  shippingLineCode?: string;
  operation?: GateInOrder['gateInType'] | '';
  condition?: string; // AV / DAMAGE / W-SURVEY
}

// GIÁM ĐỊNH — CHI TIẾT: mọi lượt giám định (Hạ vỏ + Nhập tàu), theo thời gian giám định
export function queryInspectionReport(state: DepotState, filter: InspectionReportFilter, page = 1, pageSize = REPORT_PAGE_SIZE): PagedResult<GateInOrder> {
  const range = requireFilter(filter);
  const rows = state.gateInOrders
    .filter((o) => matchContainerNo(o.containerNo, filter.containerNo))
    .filter((o) => inRange(o.fieldRecordedAt, range))
    .filter((o) => !filter.shippingLineCode || o.shippingLineCode === filter.shippingLineCode)
    .filter((o) => !filter.operation || o.gateInType === filter.operation)
    .filter((o) => !filter.condition || o.conditionClass === filter.condition)
    .sort((a, b) => b.fieldRecordedAt.localeCompare(a.fieldRecordedAt));
  return paginate(rows, page, pageSize);
}

export function inspectionSheet(rows: GateInOrder[]): SheetData {
  return {
    name: 'GIÁM ĐỊNH',
    columns: [
      'MÃ HỒ SƠ', 'SỐ CONTAINER', 'SIZE', 'TYPE', 'HÃNG TÀU', // DEC-139
      'TÁC NGHIỆP', 'TRẠNG THÁI', 'GHI CHÚ HƯ HỎNG', 'PHÂN LOẠI ĐÓNG HÀNG', 'AGE', 'TÌNH TRẠNG VỆ SINH', 'GIÁM ĐỊNH', 'THỜI GIAN GIÁM ĐỊNH',
    ],
    rows: rows.map((o) => [
      o.masterDossierCode, o.containerNo || '', o.size || '', o.type || '', o.shippingLineCode || '',
      INSPECTION_OPERATION_LABELS[o.gateInType], o.conditionClass, o.damageRemarks.join('; '), o.stuffingClass || '', o.manufactureYear || '',
      o.cleaningItems.join(' + '), o.fieldStaffName, fmt(o.fieldRecordedAt),
    ]),
  };
}

export interface CleaningReportFilter extends DateRange {
  containerNo?: string;
  shippingLineCode?: string;
  status?: ServiceWorkOrder['workStatus'] | 'ALL';
}
export interface CleaningReportRow {
  workOrder: ServiceWorkOrder;
  container?: ContainerRecord;
}
export const CLEANING_STATUS_LABELS: Record<string, string> = { OPEN: 'Chờ vệ sinh', IN_PROGRESS: 'Đang vệ sinh', COMPLETED: 'Đã vệ sinh', CANCELLED: 'Đã hủy', REWORK_REQUIRED: 'Làm lại' };

// VỆ SINH — CHI TIẾT: phiếu vệ sinh, theo thời điểm hoàn tất (chưa xong thì lúc tạo)
export function queryCleaningReport(state: DepotState, filter: CleaningReportFilter, page = 1, pageSize = REPORT_PAGE_SIZE): PagedResult<CleaningReportRow> {
  const range = requireFilter(filter);
  const contByDossier = new Map(state.containers.map((c) => [c.masterDossierCode, c]));
  const rows = state.workOrders
    .filter((w) => w.category === 'CLEANING')
    .map((workOrder) => ({ workOrder, container: contByDossier.get(workOrder.masterDossierCode) }))
    .filter(({ workOrder: w }) => matchContainerNo(w.containerNo, filter.containerNo))
    .filter(({ workOrder: w }) => inRange(w.completedAt || w.createdAt, range))
    .filter(({ container }) => !filter.shippingLineCode || container?.shippingLineCode === filter.shippingLineCode)
    .filter(({ workOrder: w }) => !filter.status || filter.status === 'ALL' || w.workStatus === filter.status)
    .sort((a, b) => (b.workOrder.completedAt || b.workOrder.createdAt).localeCompare(a.workOrder.completedAt || a.workOrder.createdAt));
  return paginate(rows, page, pageSize);
}

export function cleaningSheet(rows: CleaningReportRow[]): SheetData {
  return {
    name: 'VỆ SINH',
    columns: ['MÃ HỒ SƠ', 'SỐ CONTAINER', 'SIZE', 'TYPE', 'HÃNG TÀU', 'TÁC NGHIỆP', 'HẠNG MỤC VỆ SINH', 'TRẠNG THÁI', 'NGƯỜI LÀM', 'HOÀN TẤT LÚC'],
    rows: rows.map(({ workOrder: w, container: c }) => [
      w.masterDossierCode, w.containerNo, c?.size || '', c?.type || '', c?.shippingLineCode || '',
      visitOperationLabel(w.masterDossierCode), w.items.join(' + '), CLEANING_STATUS_LABELS[w.workStatus] || w.workStatus, w.completedBy || '', fmt(w.completedAt),
    ]),
  };
}

export interface ForkliftReportFilter extends DateRange {
  containerNo?: string;
  action?: LocationHistoryItem['actionType'] | '';
}
export interface ForkliftReportRow {
  item: LocationHistoryItem;
  container?: ContainerRecord;
}
export const LOCATION_ACTION_LABELS: Record<LocationHistoryItem['actionType'], string> = {
  INITIAL_BLOCK: 'Hạ bãi',
  DETAIL_SLOT_UPDATE: 'Cập nhật vị trí',
  YARD_MOVE: 'Di chuyển',
  YARD_SHIFT: 'Đảo chuyển',
  SHIFT_REPAIR: 'Chuyển sửa chữa',
  SHIFT_INSPECTION_RACK: 'Hạ kệ giám định',
  GATE_OUT_CLEAR: 'Lấy ra (cấp vỏ / xuất tàu)',
  SWAP_RETURN: 'Hạ lại (đổi container)', // DEC-185
};
// Loại tác nghiệp có trong database (bộ lọc Xe nâng)
export const FORKLIFT_ACTIONS: LocationHistoryItem['actionType'][] = ['INITIAL_BLOCK', 'YARD_SHIFT', 'GATE_OUT_CLEAR', 'DETAIL_SLOT_UPDATE', 'SWAP_RETURN'];

// XE NÂNG — CHI TIẾT: lịch sử vị trí (hạ bãi / đảo chuyển / lấy ra / cập nhật ô), theo thời gian thực hiện
export function queryForkliftReport(state: DepotState, filter: ForkliftReportFilter, page = 1, pageSize = REPORT_PAGE_SIZE): PagedResult<ForkliftReportRow> {
  const range = requireFilter(filter);
  const contByDossier = new Map(state.containers.map((c) => [c.masterDossierCode, c]));
  const rows = state.locationHistory
    .filter((h) => matchContainerNo(h.containerNo, filter.containerNo))
    .filter((h) => inRange(h.performedAt, range))
    .filter((h) => !filter.action || h.actionType === filter.action)
    .map((item) => ({ item, container: contByDossier.get(item.masterDossierCode) }))
    .sort((a, b) => b.item.performedAt.localeCompare(a.item.performedAt));
  return paginate(rows, page, pageSize);
}

export function forkliftSheet(rows: ForkliftReportRow[]): SheetData {
  return {
    name: 'XE NÂNG',
    columns: ['MÃ HỒ SƠ', 'SỐ CONTAINER', 'SIZE', 'TYPE', 'HÃNG TÀU', 'LOẠI', 'VỊ TRÍ CŨ', 'VỊ TRÍ MỚI', 'NGƯỜI LÁI', 'THỜI GIAN', 'GHI CHÚ'],
    rows: rows.map(({ item: h, container: c }) => [
      h.masterDossierCode, h.containerNo, c?.size || '', c?.type || '', c?.shippingLineCode || '',
      LOCATION_ACTION_LABELS[h.actionType] || h.actionType, h.fromLocation, h.toLocation, h.performedBy, fmt(h.performedAt), h.reason || '',
    ]),
  };
}
