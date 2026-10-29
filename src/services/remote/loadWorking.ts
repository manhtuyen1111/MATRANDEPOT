// ============================================================================
// CHẾ ĐỘ DATABASE — tải DỮ LIỆU ĐANG LÀM VIỆC (DEC-155, DEC-158): mọi thứ đang mở / trong bãi + 7 ngày gần nhất,
// chuyển về đúng kiểu DepotState mà giao diện đang dùng. Chỉ tải dữ liệu dạng bảng; ảnh chỉ giữ đường dẫn,
// bấm XEM ẢNH mới xin link + tải ảnh (DEC-178). Mở app tải đủ 1 lần, sau đó chỉ lấy phần thay đổi (createWorkingSync).
// Báo cáo lọc ngoài 7 ngày → tải riêng theo khoảng lọc (tối đa 3 tháng, reportSource.ts — N7).
// ============================================================================
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ContainerRecord, FeeLineItem, FeedbackItem, GateInOrder, GateOutOrder, InvoiceGroup, K80InternalTicket, LocationHistoryItem,
  MasterPrepaidReceipt, MasterReceiptDeduction, PaymentReceipt, PaymentTransaction, PaymentVoucher, ReleaseBooking,
  ServiceWorkOrder, VesselList, VesselListItem,
} from '../../types/depot';
import type { DepotState } from '../depotStore';
import type { StaffSession } from './session';
import { loadCatalogState } from './loadState';

export const WORKING_DAYS = 7; // DEC-158 (đo N8: 90 ngày = 206 giây / 171 MB — không dùng được)
const FAR = '9999-12-31T23:59:59Z';
const OVERLAP_MS = 60_000; // lấy chồng 1 phút khi đồng bộ (giao dịch ghi chậm) — trùng thì ghép theo id
const windowStart = () => new Date(Date.now() - WORKING_DAYS * 86400000).toISOString();
const PAGE = 1000;
const CHUNK = 150;
const PARALLEL = 6;

type Row = Record<string, any>;

// Đọc hết theo trang (PostgREST trả tối đa 1.000 dòng / lần)
async function all(build: (from: number, to: number) => PromiseLike<{ data: Row[] | null; error: { message: string } | null }>): Promise<Row[]> {
  const out: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1);
    if (error) throw new Error(`Không tải được dữ liệu: ${error.message}`);
    out.push(...(data || []));
    if (!data || data.length < PAGE) return out;
  }
}

// Đọc theo danh sách id (chia nhỏ để không quá dài URL)
async function byIds(client: SupabaseClient, table: string, column: string, ids: (string | null | undefined)[], select = '*'): Promise<Row[]> {
  const uniq = Array.from(new Set(ids.filter(Boolean) as string[]));
  const parts: string[][] = [];
  for (let i = 0; i < uniq.length; i += CHUNK) parts.push(uniq.slice(i, i + CHUNK));
  const out: Row[] = [];
  // Chạy song song từng đợt PARALLEL lô (N8: tuần tự hàng trăm lô quá chậm)
  for (let i = 0; i < parts.length; i += PARALLEL) {
    const batch = await Promise.all(parts.slice(i, i + PARALLEL).map((part) => all((a, b) => client.from(table).select(select).in(column, part).range(a, b))));
    for (const rows of batch) out.push(...rows);
  }
  return out;
}

const merge = (...lists: Row[][]): Row[] => {
  const map = new Map<string, Row>();
  for (const l of lists) for (const r of l) map.set(r.id, r);
  return Array.from(map.values());
};
const opt = <T>(v: T | null | undefined): T | undefined => (v === null || v === undefined ? undefined : v);
const num = (v: any): number => Number(v || 0);
// Gom theo khóa → tra cứu O(1) khi ghép (tránh filter / find lồng nhau: 45.000 × 45.000 phép so sánh — N8)
const groupBy = (rows: Row[], key: string): Map<string, Row[]> => {
  const map = new Map<string, Row[]>();
  for (const r of rows) {
    const k = r[key];
    if (k === null || k === undefined) continue;
    const list = map.get(k);
    if (list) list.push(r);
    else map.set(k, [r]);
  }
  return map;
};
const desc = (key: string) => (a: Row, b: Row) => String(b[key] || '').localeCompare(String(a[key] || ''));

const feeLine = (f: Row): FeeLineItem => ({
  id: f.id, catalogCode: f.catalog_code, name: f.name, amountInclVat: num(f.amount), quantity: f.quantity, unitAmountInclVat: num(f.unit_amount),
});

// Dữ liệu thô theo bảng — giữ trong bộ nhớ để ghép phần thay đổi (N8)
export interface RawData {
  containers: Row[]; gateIns: Row[]; gateOuts: Row[]; bookings: Row[]; prepaids: Row[]; vouchers: Row[]; txs: Row[]; receipts: Row[];
  deductions: Row[]; prints: Row[]; groups: Row[]; groupItems: Row[]; fees: Row[]; tickets: Row[]; works: Row[]; members: Row[];
  history: Row[]; lists: Row[]; items: Row[]; feedbacks: Row[];
}

async function fetchRaw(client: SupabaseClient, since: string, until: string): Promise<RawData> {
  // Chạy theo ĐỢT: truy vấn không phụ thuộc nhau gửi cùng lúc (trước đây ~25 lượt nối tiếp → chậm qua mạng thật)
  const win = (table: string, col: string) => all((a, b) => client.from(table).select('*').gte(col, since).lte(col, until).range(a, b));

  // Đợt 1: mọi thứ lọc theo trạng thái / thời gian
  const [contOpen, contWin, giOpen, giWin, goOpen, goWin, bkWin, ppOpen, ppWin, vcWin, txWin, txPending, rcWin, ddWin, tkWin, lsOpen, lsWin, feedbacks] = await Promise.all([
    all((a, b) => client.from('containers').select('*').neq('status', 'GATED_OUT').range(a, b)),
    win('containers', 'gate_in_at'),
    all((a, b) => client.from('gate_in_orders').select('*').in('status', ['FIELD_RECORDED', 'PAYMENT_PENDING']).range(a, b)),
    win('gate_in_orders', 'created_at'),
    all((a, b) => client.from('gate_out_orders').select('*').in('status', ['PAYMENT_PENDING', 'PENDING_FORKLIFT']).range(a, b)),
    win('gate_out_orders', 'created_at'),
    win('release_bookings', 'created_at'),
    all((a, b) => client.from('prepaid_receipts').select('*').in('status', ['PENDING_PAYMENT', 'ACTIVE']).range(a, b)),
    win('prepaid_receipts', 'created_at'),
    win('vouchers', 'created_at'),
    win('payment_transactions', 'created_at'),
    all((a, b) => client.from('payment_transactions').select('*').eq('status', 'PENDING').range(a, b)),
    win('payment_receipts', 'issued_at'),
    win('prepaid_deductions', 'performed_at'),
    win('k80_tickets', 'issued_at'),
    all((a, b) => client.from('vessel_lists').select('*').eq('status', 'OPEN').range(a, b)),
    win('vessel_lists', 'created_at'),
    win('feedbacks', 'created_at'),
  ]);
  const containers = merge(contOpen, contWin);
  const gateOuts = merge(goOpen, goWin);
  const prepaids = merge(ppOpen, ppWin);
  const lists = merge(lsOpen, lsWin);

  // Đợt 2: hồ sơ liên quan tới cont / lệnh / phiếu trả trước / danh sách tàu đã có
  const [giById, bkById, txByPrepaid, ddByPrepaid, tkByDossier, works, history, items] = await Promise.all([
    byIds(client, 'gate_in_orders', 'id', containers.map((c) => c.gate_in_id)),
    byIds(client, 'release_bookings', 'id', gateOuts.map((o) => o.booking_id)),
    byIds(client, 'payment_transactions', 'prepaid_id', prepaids.map((p) => p.id)),
    byIds(client, 'prepaid_deductions', 'prepaid_id', prepaids.map((p) => p.id)),
    byIds(client, 'k80_tickets', 'dossier_code', containers.map((c) => c.dossier_code)),
    byIds(client, 'work_orders', 'container_id', containers.map((c) => c.id)),
    byIds(client, 'location_history', 'container_id', containers.map((c) => c.id)),
    byIds(client, 'vessel_list_items', 'list_id', lists.map((l) => l.id)),
  ]);
  const gateIns = merge(giOpen, giWin, giById);
  const bookings = merge(bkWin, bkById);
  const txs = merge(txWin, txPending, txByPrepaid);
  const deductions = merge(ddWin, ddByPrepaid);
  const tickets = merge(tkWin, tkByDossier);

  // Đợt 3: chứng từ của hồ sơ, phiếu thu của giao dịch, thành viên tổ sửa chữa
  const [vcById, rcByTx, members] = await Promise.all([
    byIds(client, 'vouchers', 'id', [...gateIns.map((g) => g.voucher_id), ...gateOuts.map((o) => o.voucher_id)]),
    byIds(client, 'payment_receipts', 'transaction_id', txs.map((t) => t.id)),
    byIds(client, 'work_order_members', 'work_order_id', works.map((w) => w.id), 'work_order_id, member_name, grade_name, hourly_rate'),
  ]);
  const vouchers = merge(vcWin, vcById);
  const receipts = merge(rcWin, rcByTx);

  // Đợt 4: dòng chi phí, lần in, yêu cầu hóa đơn
  const [fees, prints, groups] = await Promise.all([
    byIds(client, 'fee_lines', 'owner_id', [...vouchers.map((v) => v.id), ...prepaids.map((p) => p.id)]),
    byIds(client, 'receipt_prints', 'receipt_id', receipts.map((r) => r.id)),
    byIds(client, 'invoice_groups', 'receipt_id', receipts.map((r) => r.id)),
  ]);

  // Đợt 5: lượt thuộc từng yêu cầu hóa đơn
  const groupItems = await byIds(client, 'invoice_group_items', 'group_id', groups.map((g) => g.id), 'group_id, deduction_id');

  return { containers, gateIns, gateOuts, bookings, prepaids, vouchers, txs, receipts, deductions, prints, groups, groupItems, fees, tickets, works, members, history, lists, items, feedbacks };
}

// range (ISO) có → tải hồ sơ trong khoảng đó thay cho cửa sổ làm việc — báo cáo lọc xa hơn (N7)
export async function loadWorkingState(client: SupabaseClient, me: StaffSession, range?: { from: string; to: string }): Promise<DepotState> {
  const base = await loadCatalogState(client, me);
  const raw = await fetchRaw(client, range?.from ?? windowStart(), range?.to ?? FAR);
  return buildState(base, raw);
}

// Ảnh: chỉ giữ ĐƯỜNG DẪN trong kho — bấm XEM ẢNH mới xin link (photoLink.ts — DEC-178)
const photo = (p: string | null): string => p || '';

function buildState(base: DepotState, raw: RawData): DepotState {
  const { containers, gateIns, gateOuts, bookings, prepaids, vouchers, txs, receipts, deductions, prints, groups, groupItems, fees, tickets, works, members, history, lists, items, feedbacks } = raw;

  // --- Ghép ---
  const feesByOwner = groupBy(fees, 'owner_id');
  const gateOutsByBooking = groupBy(gateOuts, 'booking_id');
  const gateOutByVoucher = new Map(gateOuts.filter((o) => o.voucher_id).map((o) => [o.voucher_id, o]));
  const receiptByTx = new Map(receipts.map((r) => [r.transaction_id, r]));
  const printsByReceipt = groupBy(prints, 'receipt_id');
  const groupsByReceipt = groupBy(groups, 'receipt_id');
  const itemsByGroup = groupBy(groupItems, 'group_id');
  const membersByWork = groupBy(members, 'work_order_id');
  const itemsByList = groupBy(items, 'list_id');
  const feeOf = (ownerId: string) => (feesByOwner.get(ownerId) || []).sort((a, b) => a.sort_order - b.sort_order).map(feeLine);
  const voucherNoById = new Map(vouchers.map((v) => [v.id, v.voucher_no]));
  const prepaidById = new Map(prepaids.map((p) => [p.id, p]));
  const gateOutByContainer = new Map(gateOuts.filter((o) => ['PAYMENT_PENDING', 'PENDING_FORKLIFT'].includes(o.status)).map((o) => [o.container_id, o]));

  const mapContainer = (c: Row): ContainerRecord => {
    const go = gateOutByContainer.get(c.id);
    return {
      id: c.id, masterDossierCode: c.dossier_code, containerNo: c.container_no, size: c.size, type: c.type, manufactureYear: opt(c.manufacture_year),
      shippingLineCode: c.shipping_line_code, customerRep: c.customer_name, truckNo: opt(c.truck_no), driverPhone: opt(c.driver_phone), status: c.status,
      conditionClass: c.condition_class, damageRemarks: c.damage_remarks || [], stuffingClass: opt(c.stuffing_class), cleaningItems: c.cleaning_items || [],
      activeQrCode: c.active_qr_code, isPaid: c.is_paid, currentBlock: c.current_block, currentBay: c.current_bay, currentRow: c.current_row, currentTier: c.current_tier,
      needsCleaning: c.needs_cleaning, needsQuotation: c.needs_quotation, needsRepair: c.needs_repair, forkliftShiftTask: c.forklift_task,
      holdSource: opt(c.hold_source), quotationItems: c.quotation_items?.length ? c.quotation_items : undefined,
      quotationLaborHours: c.quotation_labor_hours === null ? undefined : num(c.quotation_labor_hours),
      quotationUpdatedBy: opt(c.quotation_by_name), quotationUpdatedAt: opt(c.quotation_at),
      isOnHold: c.is_on_hold, holdReason: opt(c.hold_reason), holdBy: opt(c.hold_by_name), holdAt: opt(c.hold_at),
      allocatedBookingNo: go?.booking_no, allocatedTruckNo: go?.truck_no, allocatedDriverPhone: opt(go?.driver_phone), allocatedAt: go?.created_at,
      outDossierCode: opt(c.out_dossier_code), officeNote: opt(c.office_note), officeNoteUpdatedBy: opt(c.office_note_by_name), officeNoteUpdatedAt: opt(c.office_note_at),
      vesselExportItemId: opt(c.vessel_export_item_id), gateInAt: c.gate_in_at, gateOutAt: opt(c.gate_out_at),
    };
  };

  const mapGateIn = (g: Row): GateInOrder => ({
    id: g.id, masterDossierCode: g.code, orderCode: g.code, gateInType: g.gate_in_type, doorPhotoUrl: photo(g.door_photo_path),
    initialContainerHint: opt(g.initial_container_hint), conditionClass: g.condition_class, damageRemarks: g.damage_remarks || [],
    stuffingClass: opt(g.stuffing_class), cleaningItems: g.cleaning_items || [], manufactureYear: opt(g.manufacture_year),
    toInspectionRack: g.to_inspection_rack, rackInspectedBy: opt(g.rack_inspected_by_name), rackInspectedAt: opt(g.rack_inspected_at),
    fieldStaffName: g.field_by_name, fieldRecordedAt: g.field_at, containerNo: opt(g.container_no), size: opt(g.size), type: opt(g.type),
    truckNo: opt(g.truck_no), driverPhone: opt(g.driver_phone), customerRep: opt(g.customer_name), shippingLineCode: opt(g.shipping_line_code),
    orderDocNo: opt(g.order_doc_no), officeStaffName: opt(g.office_by_name), officeVerifiedAt: opt(g.office_at),
    feeLines: g.voucher_id ? feeOf(g.voucher_id) : undefined, feeAmount: num(g.fee_amount), voucherId: opt(g.voucher_id),
    voucherNo: g.voucher_id ? voucherNoById.get(g.voucher_id) : undefined, status: g.status, gateInOkAt: opt(g.gate_in_ok_at), gateInOkBy: opt(g.gate_in_ok_by_name),
    nextDepartments: g.next_departments || [], documentsReturnedAt: opt(g.documents_returned_at), documentsReturnedBy: opt(g.documents_returned_by_name),
    cancelReason: opt(g.cancel_reason),
  });

  const mapGateOut = (o: Row): GateOutOrder => ({
    id: o.id, masterDossierCode: o.dossier_code, gateOutCode: o.code, gateOutType: o.gate_out_type, bookingNo: o.booking_no, containerNo: o.container_no,
    truckNo: o.truck_no, driverPhone: opt(o.driver_phone), receiverRep: o.receiver_name, feeLines: o.voucher_id ? feeOf(o.voucher_id) : undefined,
    feeAmount: num(o.fee_amount), voucherId: opt(o.voucher_id), voucherNo: o.voucher_id ? voucherNoById.get(o.voucher_id) : undefined,
    k80QrCode: o.k80_qr_code || '', chkValidOrder: o.chk_valid_order, chkNotOnHold: o.chk_not_on_hold, chkCorrectContainer: o.chk_correct_container,
    chkPaymentSettled: o.chk_payment_settled, chkDocumentsCompleted: o.chk_documents_completed, status: o.status, createdBy: opt(o.created_by_name),
    confirmedBy: opt(o.confirmed_by_name), confirmedAt: opt(o.confirmed_at), cancelReason: opt(o.cancel_reason), cancelledAt: opt(o.cancelled_at),
    documentsReturnedAt: opt(o.documents_returned_at), documentsReturnedBy: opt(o.documents_returned_by_name), createdAt: o.created_at,
  } as GateOutOrder);

  const mapBooking = (b: Row): ReleaseBooking => {
    const orders = gateOutsByBooking.get(b.id) || [];
    return {
      id: b.id, bookingNo: b.booking_no, releaseType: b.release_type, shippingLineCode: b.shipping_line_code, requesterName: b.requester_name,
      receiverName: b.receiver_name, size: b.size, type: b.type, requestedQty: opt(b.requested_qty),
      allocatedContainers: orders.filter((o) => ['PAYMENT_PENDING', 'PENDING_FORKLIFT'].includes(o.status)).map((o) => o.container_no),
      gatedOutContainers: orders.filter((o) => o.status === 'GATE_OUT_OK').map((o) => o.container_no),
      releasedContainers: orders.filter((o) => o.status === 'CANCELLED').map((o) => ({
        containerNo: o.container_no, outDossierCode: o.code, reason: o.cancel_reason || '', releasedBy: o.cancelled_by_name || '', releasedAt: o.cancelled_at || o.created_at,
      })),
      status: b.status, createdAt: b.created_at,
    };
  };

  const mapVoucher = (v: Row): PaymentVoucher => ({
    id: v.id, masterDossierCode: v.service_type === 'GATE_OUT' ? (gateOutByVoucher.get(v.id)?.dossier_code || v.dossier_code) : v.dossier_code,
    voucherNo: v.voucher_no, serviceType: v.service_type, referenceCode: v.dossier_code, containerNo: v.container_no,
    shippingLineCode: v.shipping_line_code, payerName: v.payer_name, amount: num(v.amount), feeLines: feeOf(v.id),
    paymentCategory: opt(v.payment_category), directMethod: opt(v.direct_method), scannedQrCode: opt(v.scanned_qr_code),
    masterReceiptCode: opt(v.prepaid_code), ttsNote: opt(v.tts_note), providerTxRef: opt(v.provider_tx_ref), status: v.status,
    confirmedBy: opt(v.confirmed_by_name), confirmedAt: opt(v.confirmed_at), createdBy: v.created_by_name, createdAt: v.created_at,
  });

  const mapTx = (t: Row): PaymentTransaction => ({
    id: t.id, paymentRef: t.payment_ref, purpose: t.purpose, voucherId: opt(t.voucher_id), masterReceiptId: opt(t.prepaid_id),
    dossierCode: opt(t.dossier_code), containerNo: opt(t.container_no), payerName: t.payer_name, method: t.method, paymentCategory: t.payment_category,
    amount: num(t.amount), status: t.status, qrPayload: opt(t.qr_payload), providerTxRef: opt(t.provider_tx_ref), createdBy: t.created_by_name,
    createdAt: t.created_at, confirmedBy: opt(t.confirmed_by_name), confirmedAt: opt(t.confirmed_at), cancelReason: opt(t.cancel_reason),
    receiptId: receiptByTx.get(t.id)?.id,
  });

  const mapReceipt = (r: Row): PaymentReceipt => ({
    id: r.id, receiptNo: r.receipt_no, transactionId: r.transaction_id, purpose: r.purpose, operation: r.operation, amount: num(r.amount),
    method: r.method, paymentCategory: r.payment_category, voucherId: opt(r.voucher_id), voucherNo: opt(r.voucher_no),
    masterReceiptId: opt(r.prepaid_id), masterReceiptCode: opt(r.prepaid_code), dossierCode: opt(r.dossier_code), containerNo: opt(r.container_no),
    payerName: r.payer_name, providerTxRef: opt(r.provider_tx_ref), issuedAt: r.issued_at, issuedBy: r.issued_by_name,
    printLog: (printsByReceipt.get(r.id) || []).sort((a, b) => a.printed_at.localeCompare(b.printed_at)).map((p) => ({ at: p.printed_at, by: p.printed_by_name })),
    invoiceSecret: r.invoice_secret, invoiceStatus: r.invoice_status,
    invoiceRequest: r.invoice_tax_code
      ? { taxCode: r.invoice_tax_code, email: r.invoice_email, companyName: r.invoice_company, address: r.invoice_address, note: opt(r.invoice_note), requestedAt: r.invoice_requested_at, updatedAt: r.invoice_updated_at }
      : undefined,
    invoiceIssued: r.invoice_issued_at ? { invoiceNo: opt(r.invoice_no), issuedAt: r.invoice_issued_at, issuedBy: r.invoice_issued_by_name } : undefined,
    invoiceGroups: (groupsByReceipt.get(r.id) || []).map((g): InvoiceGroup => ({
      id: g.id, deductionIds: (itemsByGroup.get(g.id) || []).map((i) => i.deduction_id), amount: num(g.amount),
      taxCode: g.tax_code, email: g.email, companyName: g.company_name, address: g.address, note: opt(g.note), status: g.status,
      requestedAt: g.requested_at, updatedAt: g.updated_at, invoiceNo: opt(g.invoice_no), issuedAt: opt(g.issued_at), issuedBy: opt(g.issued_by_name),
    })),
  } as PaymentReceipt);

  const mapPrepaid = (p: Row): MasterPrepaidReceipt => ({
    id: p.id, receiptCode: p.code, qrCode: p.qr_code, customerCode: p.customer_code, customerName: p.customer_name, lotDescription: p.lot_description,
    totalAmount: num(p.total_amount), remainingAmount: num(p.remaining_amount), status: p.status, paymentMethod: p.payment_method,
    feeLines: feeOf(p.id), createdBy: p.created_by_name, createdAt: p.created_at, activatedAt: opt(p.activated_at),
  });

  const mapDeduction = (d: Row): MasterReceiptDeduction => {
    const p = prepaidById.get(d.prepaid_id);
    return {
      id: d.id, receiptCode: p?.code || '', qrCode: p?.qr_code || '', voucherNo: voucherNoById.get(d.voucher_id) || '', containerNo: d.container_no,
      deductedAmount: num(d.amount), balanceBefore: num(d.balance_before), balanceAfter: num(d.balance_after), performedBy: d.performed_by_name, performedAt: d.performed_at,
    };
  };

  const mapTicket = (t: Row): K80InternalTicket => ({
    ticketCode: t.code, masterDossierCode: t.dossier_code, outDossierCode: opt(t.out_dossier_code), qrCode: t.qr_code, operationMode: t.operation_mode,
    isPaid: t.is_paid, paymentLabel: t.payment_label, containerNo: t.container_no, size: t.size, type: t.type, conditionClass: t.condition_class,
    damageRemarks: t.damage_remarks || [], stuffingClass: opt(t.stuffing_class), cleaningItems: t.cleaning_items || [], manufactureYear: opt(t.manufacture_year),
    truckNo: opt(t.truck_no), driverPhone: opt(t.driver_phone), customerRep: opt(t.customer_name), targetBlock: opt(t.target_block),
    issuedAt: t.issued_at, issuedBy: t.issued_by_name,
  });

  const mapWork = (w: Row): ServiceWorkOrder => ({
    id: w.id, masterDossierCode: w.dossier_code, workOrderCode: w.code, containerNo: w.container_no, category: w.category, sourceOrderCode: w.dossier_code,
    items: w.items || [], estimateCost: 0, approvalStatus: w.approval_status, approvedBy: opt(w.approved_by_name), workStatus: w.work_status,
    assignedTo: w.assigned_to, resultNotes: opt(w.result_notes), createdAt: w.created_at, completedAt: opt(w.completed_at), completedBy: opt(w.completed_by_name),
    laborHours: w.labor_hours === null ? undefined : num(w.labor_hours), repairTeamCode: opt(w.repair_team_code), repairTeamName: opt(w.repair_team_name),
    repairMembers: (membersByWork.get(w.id) || []).map((m) => m.member_name),
    repairMemberRates: (membersByWork.get(w.id) || []).map((m) => ({
      name: m.member_name, gradeName: opt(m.grade_name), hourlyRate: m.hourly_rate === null || m.hourly_rate === undefined ? undefined : num(m.hourly_rate),
    })), // DEC-174
    repairPhotos: w.photo_paths?.length ? (w.photo_paths as string[]).map((p) => photo(p)) : undefined, // DEC-176
  });

  const mapHistory = (h: Row): LocationHistoryItem => ({
    id: h.id, masterDossierCode: h.dossier_code, containerNo: h.container_no, fromLocation: h.from_location, toLocation: h.to_location,
    actionType: h.action, reason: h.reason, performedBy: h.performed_by_name, performedAt: h.performed_at,
  });

  const mapItem = (i: Row): VesselListItem => ({
    id: i.id, containerNo: i.container_no, size: i.size, type: i.type, status: i.status, dossierCode: opt(i.dossier_code), containerId: opt(i.container_id),
    truckNo: opt(i.truck_no), conditionClass: opt(i.condition_class), stuffingClass: opt(i.stuffing_class), locationAtList: opt(i.location_at_list),
    manufactureYear: opt(i.manufacture_year), cleaningItems: i.cleaning_items || undefined, damageRemarks: i.damage_remarks?.length ? i.damage_remarks : undefined,
    doorPhotoUrl: i.door_photo_path ? photo(i.door_photo_path) : undefined, inspectedBy: opt(i.inspected_by_name), inspectedAt: opt(i.inspected_at), doneBy: opt(i.done_by_name), doneAt: opt(i.done_at),
  });

  const mapList = (l: Row): VesselList => ({
    id: l.id, mode: l.mode, vesselName: l.vessel_name, shippingLineCode: opt(l.shipping_line_code), plannedAt: l.planned_at, truckNos: l.truck_nos || [],
    items: (itemsByList.get(l.id) || []).map(mapItem), status: l.status, createdBy: l.created_by_name, createdAt: l.created_at,
    approvedBy: opt(l.approved_by_name), approvedAt: opt(l.approved_at), approveNote: opt(l.approve_note),
  });

  const mapFeedback = (f: Row): FeedbackItem => ({
    id: f.id, code: f.code, menuId: f.menu_id, menuLabel: f.menu_label, content: f.content, status: f.status, createdAt: f.created_at,
    createdById: f.created_by, createdBy: f.created_by_name, response: opt(f.response), respondedAt: opt(f.responded_at), respondedBy: opt(f.responded_by_name),
  });

  return {
    ...base,
    containers: containers.sort(desc('gate_in_at')).map(mapContainer),
    gateInOrders: gateIns.sort(desc('field_at')).map(mapGateIn),
    gateOutOrders: gateOuts.sort(desc('created_at')).map(mapGateOut),
    bookings: bookings.sort(desc('created_at')).map(mapBooking),
    vouchers: vouchers.sort(desc('created_at')).map(mapVoucher),
    paymentTransactions: txs.sort(desc('created_at')).map(mapTx),
    paymentReceipts: receipts.sort(desc('issued_at')).map(mapReceipt),
    masterReceipts: prepaids.sort(desc('created_at')).map(mapPrepaid),
    receiptDeductions: deductions.sort(desc('performed_at')).map(mapDeduction),
    k80Tickets: tickets.sort(desc('issued_at')).map(mapTicket),
    workOrders: works.sort(desc('created_at')).map(mapWork),
    locationHistory: history.sort(desc('performed_at')).map(mapHistory),
    vesselLists: lists.sort(desc('created_at')).map(mapList),
    feedbacks: feedbacks.sort(desc('created_at')).map(mapFeedback),
    auditLogs: [],
  };
}

// ============================================================================
// ĐỒNG BỘ PHẦN THAY ĐỔI (N8 — DEC-158): full() khi mở app / bấm Tải lại; refresh() sau mỗi lần lưu và mỗi 30 giây
// chỉ lấy dòng có sync_at mới hơn mốc trước (giờ máy chủ) + dòng bị xóa (sync_deletions), ghép vào dữ liệu thô.
// ============================================================================
const SYNC_TABLES: { key: keyof RawData; table: string }[] = [
  { key: 'containers', table: 'containers' }, { key: 'gateIns', table: 'gate_in_orders' }, { key: 'gateOuts', table: 'gate_out_orders' },
  { key: 'bookings', table: 'release_bookings' }, { key: 'prepaids', table: 'prepaid_receipts' }, { key: 'vouchers', table: 'vouchers' },
  { key: 'txs', table: 'payment_transactions' }, { key: 'receipts', table: 'payment_receipts' }, { key: 'deductions', table: 'prepaid_deductions' },
  { key: 'prints', table: 'receipt_prints' }, { key: 'groups', table: 'invoice_groups' }, { key: 'fees', table: 'fee_lines' },
  { key: 'tickets', table: 'k80_tickets' }, { key: 'works', table: 'work_orders' }, { key: 'history', table: 'location_history' },
  { key: 'lists', table: 'vessel_lists' }, { key: 'items', table: 'vessel_list_items' }, { key: 'feedbacks', table: 'feedbacks' },
];
// Bảng con không có id riêng: thay đổi → tải lại toàn bộ dòng con của cha đó
const SYNC_CHILDREN: { key: keyof RawData; table: string; parent: string; select: string }[] = [
  { key: 'groupItems', table: 'invoice_group_items', parent: 'group_id', select: 'group_id, deduction_id' },
  { key: 'members', table: 'work_order_members', parent: 'work_order_id', select: 'work_order_id, member_name, grade_name, hourly_rate' },
];

export interface WorkingSync {
  full(): Promise<DepotState>;
  // catalog: false → dùng lại danh mục đã tải (sau khi lưu nghiệp vụ — nhanh hơn); mặc định tải lại cả danh mục
  refresh(opts?: { catalog?: boolean }): Promise<DepotState>;
}

export function createWorkingSync(client: SupabaseClient, me: StaffSession): WorkingSync {
  let raw: RawData | null = null;
  let cursor = '';
  const serverNow = async (): Promise<string> => {
    const { data, error } = await client.rpc('server_now');
    if (error) throw new Error(`Không tải được dữ liệu: ${error.message}`);
    return String(data);
  };
  // Danh mục giữ lại giữa các lần đồng bộ
  let catalog: DepotState | null = null;
  const build = async (r: RawData, reloadCatalog = true) => {
    const base = reloadCatalog || !catalog ? await loadCatalogState(client, me) : catalog;
    catalog = base;
    return buildState(base, r);
  };

  const full = async () => {
    cursor = await serverNow(); // lấy mốc TRƯỚC khi tải → không sót thay đổi xảy ra trong lúc tải
    raw = await fetchRaw(client, windowStart(), FAR);
    return build(raw);
  };

  const refresh = async (opts: { catalog?: boolean } = {}) => {
    if (!raw) return full();
    const r = raw;
    // Mốc mới lấy song song với truy vấn (bớt 1 lượt chờ mạng) — OVERLAP_MS bù độ lệch vài trăm ms
    const after = new Date(new Date(cursor).getTime() - OVERLAP_MS).toISOString();
    const [next, changed, childChanged, deleted] = await Promise.all([
      serverNow(),
      Promise.all(SYNC_TABLES.map((t) => all((a, b) => client.from(t.table).select('*').gt('sync_at', after).range(a, b)))),
      Promise.all(SYNC_CHILDREN.map((c) => all((a, b) => client.from(c.table).select(c.select).gt('sync_at', after).range(a, b)))),
      all((a, b) => client.from('sync_deletions').select('table_name, row_id').gt('deleted_at', after).range(a, b)),
    ]);
    const gone = groupBy(deleted, 'table_name');
    SYNC_TABLES.forEach((t, i) => {
      const drop = new Set((gone.get(t.table) || []).map((d) => d.row_id));
      r[t.key] = merge(drop.size ? r[t.key].filter((x) => !drop.has(x.id)) : r[t.key], changed[i]);
    });
    for (const [i, c] of SYNC_CHILDREN.entries()) {
      const parents = new Set<string>([...childChanged[i].map((x) => x[c.parent]), ...(gone.get(c.table) || []).map((d) => d.row_id)]);
      if (!parents.size) continue;
      const fresh = await byIds(client, c.table, c.parent, Array.from(parents), c.select);
      r[c.key] = [...r[c.key].filter((x) => !parents.has(x[c.parent])), ...fresh];
    }
    cursor = next;
    return build(r, opts.catalog ?? true);
  };

  return { full, refresh };
}
