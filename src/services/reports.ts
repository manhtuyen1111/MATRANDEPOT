import {
  ContainerRecord,
  GateInOrder,
  GateOutOrder,
  GateOutType,
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
import { formatLocation, getContainerProgress, PROGRESS_LABELS, storageDays } from './core';
import { receiptOperationOf } from './payments';
import { formatDateTime, parseDateTime } from './datetime';

// ============================================================================
// BÁO CÁO & TRA CỨU (CR-08, CR-04 PHIẾU THU)
// Nguyên tắc: không tự tải toàn bộ dữ liệu; bắt buộc có điều kiện lọc; giới hạn số dòng / trang.
// Ở chế độ Supabase các hàm này tương ứng truy vấn có range/limit phía server.
// ============================================================================

export const REPORT_PAGE_SIZE = 50;
export const RECEIPT_PAGE_SIZE = 20;
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

function paginate<T>(rows: T[], page: number, pageSize: number): PagedResult<T> {
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
  page = 1
): PagedResult<GateOutOrder> {
  const range = requireFilter(filter);
  const no = filter.containerNo?.trim().toUpperCase();
  const rows = state.gateOutOrders
    .filter((o) => types.includes(o.gateOutType))
    .filter((o) => !no || o.containerNo.includes(no))
    .filter((o) => inRange(o.confirmedAt || o.createdAt, range))
    .filter((o) => {
      if (!filter.shippingLineCode && !filter.size) return true;
      const c = state.containers.find((x) => x.masterDossierCode === o.masterDossierCode);
      if (filter.shippingLineCode && c?.shippingLineCode !== filter.shippingLineCode) return false;
      if (filter.size && c?.size !== filter.size) return false;
      return true;
    })
    .sort((a, b) => (b.confirmedAt || b.createdAt).localeCompare(a.confirmedAt || a.createdAt));
  return paginate(rows, page, REPORT_PAGE_SIZE);
}

// Báo cáo HẠ VỎ / NHẬP TÀU (hồ sơ gate-in)
export function queryGateInReport(
  state: DepotState,
  type: GateInOrder['gateInType'],
  filter: OperationReportFilter,
  page = 1
): PagedResult<GateInOrder> {
  const range = requireFilter(filter);
  const no = filter.containerNo?.trim().toUpperCase();
  const rows = state.gateInOrders
    .filter((o) => o.gateInType === type)
    .filter((o) => !no || (o.containerNo || '').includes(no))
    .filter((o) => inRange(o.gateInOkAt || o.fieldRecordedAt, range))
    .filter((o) => !filter.shippingLineCode || o.shippingLineCode === filter.shippingLineCode)
    .filter((o) => !filter.size || o.size === filter.size)
    .sort((a, b) => (b.gateInOkAt || b.fieldRecordedAt).localeCompare(a.gateInOkAt || a.fieldRecordedAt));
  return paginate(rows, page, REPORT_PAGE_SIZE);
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
}

export interface ReceiptRow {
  transaction: PaymentTransaction;
  receipt?: PaymentReceipt;
}

export function queryReceipts(state: DepotState, filter: ReceiptQueryFilter, page = 1): PagedResult<ReceiptRow> {
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
  return paginate(rows, page, RECEIPT_PAGE_SIZE);
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

export function gateInSheet(name: string, orders: GateInOrder[]): SheetData {
  return {
    name,
    columns: [
      'MÃ HỒ SƠ', 'LOẠI', 'TRẠNG THÁI HỒ SƠ', 'SỐ CONTAINER', 'SIZE', 'TYPE', 'HÃNG TÀU', 'KHÁCH HÀNG',
      'SỐ XE', 'SĐT LÁI XE', 'SỐ LỆNH / CHỨNG TỪ', 'TRẠNG THÁI', 'GHI CHÚ HƯ HỎNG', 'PHÂN LOẠI ĐÓNG HÀNG',
      'TÌNH TRẠNG VỆ SINH', 'AGE', 'GIÁM ĐỊNH', 'THỜI GIAN GIÁM ĐỊNH', 'VĂN PHÒNG', 'THỜI GIAN VĂN PHÒNG',
      'SỐ CHỨNG TỪ', 'CHI PHÍ (ĐÃ GỒM VAT)', 'GATE IN OK LÚC', 'GATE IN OK BỞI', 'LÝ DO HỦY',
    ],
    rows: orders.map((o) => [
      o.masterDossierCode, o.gateInType, o.status, o.containerNo || '', o.size || '', o.type || '',
      o.shippingLineCode || '', o.customerRep || '', o.truckNo || '', o.driverPhone || '', o.orderDocNo || '',
      o.conditionClass, o.damageRemarks.join('; '), o.stuffingClass, o.cleaningItems.join(' + '),
      o.manufactureYear, o.fieldStaffName, fmt(o.fieldRecordedAt), o.officeStaffName || '', fmt(o.officeVerifiedAt),
      o.voucherNo || '', o.feeAmount || 0, fmt(o.gateInOkAt), o.gateInOkBy || '', o.cancelReason || '',
    ]),
  };
}

export function gateOutSheet(name: string, state: DepotState, orders: GateOutOrder[]): SheetData {
  return {
    name,
    columns: [
      'MÃ HỒ SƠ CẤP', 'MÃ HỒ SƠ HẠ VỎ', 'LOẠI', 'TRẠNG THÁI HỒ SƠ', 'BOOKING', 'SỐ CONTAINER', 'SIZE', 'TYPE',
      'HÃNG TÀU', 'TRẠNG THÁI', 'PHÂN LOẠI ĐÓNG HÀNG', 'KHÁCH HÀNG', 'SỐ XE', 'SĐT LÁI XE', 'SỐ CHỨNG TỪ',
      'CHI PHÍ (ĐÃ GỒM VAT)', 'HÌNH THỨC THANH TOÁN', 'LẬP LỆNH LÚC', 'LẬP LỆNH BỞI', 'OUT LÚC', 'XÁC NHẬN OUT BỞI',
      'LÝ DO HỦY',
    ],
    rows: orders.map((o) => {
      const c = state.containers.find((x) => x.masterDossierCode === o.masterDossierCode);
      const v = state.vouchers.find((x) => x.id === o.voucherId);
      return [
        o.gateOutCode, o.masterDossierCode, o.gateOutType, o.status, o.bookingNo, o.containerNo, c?.size || '',
        c?.type || '', c?.shippingLineCode || '', c?.conditionClass || '', c?.stuffingClass || '', o.receiverRep,
        o.truckNo, o.driverPhone || '', o.voucherNo || '', o.feeAmount || 0,
        v ? `${v.paymentCategory || ''}${v.directMethod ? ` / ${v.directMethod}` : ''} (${v.status})` : '',
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
      c.masterDossierCode, c.containerNo, c.size, c.type, c.shippingLineCode, c.conditionClass, c.stuffingClass,
      c.manufactureYear, c.cleaningItems.join(' + '), c.damageRemarks.join('; '), formatLocation(c), c.status,
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
    gateInSheet('HẠ VỎ', gateIn('CUSTOMER_RETURN')),
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

export function queryRepairReport(state: DepotState, filter: RepairReportFilter, page = 1): PagedResult<RepairReportRow> {
  const range = toRange(filter);
  const no = filter.containerNo?.trim().toUpperCase();
  if (!range && !no) throw new Error('Nhập số container hoặc chọn khoảng thời gian trước khi tra cứu.');
  const rows = state.workOrders
    .filter((w) => w.category === 'REPAIR')
    .map((workOrder) => ({
      workOrder,
      container: state.containers.find((c) => c.masterDossierCode === workOrder.masterDossierCode),
    }))
    .filter(({ workOrder: w }) => !no || w.containerNo.includes(no))
    .filter(({ workOrder: w }) => inRange(w.completedAt || w.createdAt, range))
    .filter(({ workOrder: w }) => !filter.teamCode || w.repairTeamCode === filter.teamCode)
    .filter(({ container }) => !filter.shippingLineCode || container?.shippingLineCode === filter.shippingLineCode)
    .filter(({ workOrder: w }) => !filter.status || filter.status === 'ALL' || w.workStatus === filter.status)
    .sort((a, b) => (b.workOrder.completedAt || b.workOrder.createdAt).localeCompare(a.workOrder.completedAt || a.workOrder.createdAt));
  return paginate(rows, page, REPORT_PAGE_SIZE);
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
export function collectAllPages<T>(query: (page: number) => PagedResult<T>): T[] {
  const first = query(1);
  const rows = [...first.rows];
  for (let p = 2; p <= first.pageCount; p++) rows.push(...query(p).rows);
  return rows;
}

// Sheet PHIẾU THU (DEC-055) — đủ cột tra cứu / đối soát
export function receiptsSheet(state: DepotState, rows: ReceiptRow[]): SheetData {
  const STATUS: Record<string, string> = { PENDING: 'Chờ thanh toán', SUCCEEDED: 'Thành công', FAILED: 'Thất bại', CANCELLED: 'Đã hủy' };
  const OP: Record<string, string> = { HA_VO: 'HẠ VỎ', CAP_VO: 'CẤP VỎ', THU_TRUOC: 'THU TRƯỚC (TTT)', KHAC: 'KHÁC' };
  return {
    name: 'PHIẾU THU',
    columns: [
      'MÃ PHIẾU THU', 'TÁC NGHIỆP', 'TRẠNG THÁI', 'SỐ TIỀN', 'TRƯỜNG HỢP', 'HÌNH THỨC', 'BÊN THANH TOÁN', 'MÃ HỒ SƠ',
      'SỐ CONTAINER', 'CHỨNG TỪ', 'PHIẾU THU MẸ', 'MÃ THAM CHIẾU', 'MÃ GD NGÂN HÀNG', 'TẠO LÚC', 'NGƯỜI TẠO',
      'XÁC NHẬN THU LÚC', 'NGƯỜI XÁC NHẬN', 'LÝ DO HỦY', 'SỐ LẦN IN', 'IN GẦN NHẤT',
    ],
    rows: rows.map(({ transaction: t, receipt: r }) => [
      r?.receiptNo || '', OP[receiptOperationOf(state, { ...t, operation: r?.operation })], STATUS[t.status] || t.status, t.amount,
      t.paymentCategory, t.method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản', t.payerName, t.dossierCode || '', t.containerNo || '',
      r?.voucherNo || '', r?.masterReceiptCode || (t.purpose === 'PREPAID_TOPUP' ? t.paymentRef : ''), t.paymentRef,
      t.providerTxRef || '', fmt(t.createdAt), t.createdBy, fmt(t.confirmedAt), t.confirmedBy || '', t.cancelReason || '',
      r?.printLog?.length || 0, r?.printLog?.length ? `${fmt(r.printLog[r.printLog.length - 1].at)} • ${r.printLog[r.printLog.length - 1].by}` : '',
    ]),
  };
}

// Sheet TỒN VỎ (DEC-065)
export function yardStockSheet(rows: ContainerRecord[]): SheetData {
  return {
    name: 'TỒN VỎ',
    columns: [
      'MÃ HỒ SƠ', 'SỐ CONTAINER', 'SIZE', 'TYPE', 'HÃNG TÀU', 'DATE IN', 'VÀO BÃI BẰNG', 'TRẠNG THÁI', 'LƯU BÃI (NGÀY)', 'ĐÓNG HÀNG', 'AGE', 'VỊ TRÍ', 'TIẾN ĐỘ',
      'KHÁCH HÀNG', 'SỐ XE HẠ', 'KHÓA', 'NGƯỜI KHÓA', 'KHÓA LÚC', 'GHI CHÚ', 'GHI CHÚ BỞI', 'GHI CHÚ LÚC',
    ],
    rows: rows.map((c) => [
      c.masterDossierCode, c.containerNo, c.size, c.type, c.shippingLineCode, fmt(c.gateInAt), c.masterDossierCode.startsWith('NT-') ? 'NHẬP TÀU' : 'HẠ VỎ',
      c.conditionClass, storageDays(c.gateInAt), c.stuffingClass,
      c.manufactureYear || '', formatLocation(c), getContainerProgress(c).map((p) => PROGRESS_LABELS[p]).join(', '),
      c.customerRep || '', c.truckNo || '', c.isOnHold ? 'ĐANG KHÓA' : '', c.holdBy || '', fmt(c.holdAt),
      c.officeNote || '', c.officeNoteUpdatedBy || '', fmt(c.officeNoteUpdatedAt),
    ]),
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

export function queryVesselReport(state: DepotState, mode: VesselMode, filter: VesselReportFilter, page = 1): PagedResult<VesselReportRow> {
  const range = toRange(filter);
  const no = filter.containerNo?.trim().toUpperCase();
  const vessel = filter.vesselName?.trim().toUpperCase();
  if (!range && !no && !vessel) throw new Error('Nhập số container / tên tàu hoặc chọn khoảng thời gian trước khi tra cứu.');
  const rows = (state.vesselLists || [])
    .filter((l) => l.mode === mode)
    .filter((l) => !vessel || l.vesselName.includes(vessel))
    .filter((l) => inRange(l.plannedAt, range))
    .flatMap((list) => list.items.filter((i) => !no || i.containerNo.includes(no)).map((item) => ({ list, item })))
    .sort((a, b) => b.list.plannedAt.localeCompare(a.list.plannedAt) || a.item.containerNo.localeCompare(b.item.containerNo));
  return paginate(rows, page, REPORT_PAGE_SIZE);
}

const VESSEL_ITEM_STATUS: Record<string, Record<string, string>> = {
  NHAP_TAU: { PENDING: 'Chờ xe về', INSPECTED: 'Đã giám định — chờ hạ', DONE: 'Đã hạ bãi' },
  XUAT_TAU: { PENDING: 'Chờ xuất', INSPECTED: '-', DONE: 'Đã xuất tàu' },
};

export function vesselReportSheet(mode: VesselMode, rows: VesselReportRow[]): SheetData {
  const isImport = mode === 'NHAP_TAU';
  return {
    name: isImport ? 'NHẬP TÀU' : 'XUẤT TÀU',
    columns: [
      'TÊN TÀU', isImport ? 'THỜI GIAN NHẬP TÀU' : 'THỜI GIAN XUẤT TÀU', 'HÃNG TÀU', 'DUYỆT DANH SÁCH', 'MÃ HỒ SƠ', 'SỐ CONTAINER', 'SIZE', 'TYPE',
      'TIẾN ĐỘ', 'SỐ XE', 'TRẠNG THÁI', 'ĐÓNG HÀNG', ...(isImport ? ['VỆ SINH', 'AGE', 'GHI CHÚ HƯ HỎNG', 'GIÁM ĐỊNH', 'GIÁM ĐỊNH LÚC'] : ['VỊ TRÍ LÚC LẬP']),
      isImport ? 'HẠ BÃI BỞI' : 'XUẤT BỞI', isImport ? 'HẠ BÃI LÚC' : 'XUẤT LÚC', 'LẬP DANH SÁCH', 'LẬP LÚC',
    ],
    rows: rows.map(({ list: l, item: i }) => [
      l.vesselName, fmt(l.plannedAt), l.shippingLineCode || '', l.status === 'APPROVED' ? `ĐÃ DUYỆT • ${l.approvedBy || ''} • ${fmt(l.approvedAt)}` : 'Chưa duyệt',
      i.dossierCode || '', i.containerNo, i.size, i.type, VESSEL_ITEM_STATUS[mode][i.status], i.truckNo || '', i.conditionClass || '', i.stuffingClass || '',
      ...(isImport
        ? [(i.cleaningItems || []).join(', '), i.manufactureYear || '', (i.damageRemarks || []).join(', '), i.inspectedBy || '', fmt(i.inspectedAt)]
        : [i.locationAtList || '']),
      i.doneBy || '', fmt(i.doneAt), l.createdBy, fmt(l.createdAt),
    ]),
  };
}
