import { GateInOrder, GateOutOrder, K80InternalTicket, PaymentReceipt } from '../types/depot';
import type { DepotState } from './depotStore';
import { appendAudit, assertPermission, nowIso } from './core';
import { formatDateTime } from './datetime';

// ============================================================================
// LỘ TRÌNH LÁI XE TRÊN PHIẾU K80 & TRẢ CHỨNG TỪ (DEC-052)
//   HẠ VỎ : Văn phòng thu phí → (Vệ sinh) → Xe nâng hạ vỏ → Văn phòng trả chứng từ
//   CẤP VỎ: Văn phòng thu phí → Xe nâng cấp vỏ → Văn phòng trả chứng từ
// Văn phòng quét QR lần cuối → ghi nhận trả chứng từ → in EEIR + phiếu thu (nếu có).
// ============================================================================

export interface RouteStep {
  key: 'OFFICE_PAY' | 'CLEANING' | 'FORKLIFT_PLACE' | 'FORKLIFT_RELEASE' | 'OFFICE_RETURN';
  dept: string;
  action: string;
  done: boolean;
  doneAt?: string;
  doneBy?: string;
}

export interface TicketContext {
  ticket: K80InternalTicket;
  gateIn?: GateInOrder;
  gateOut?: GateOutOrder;
}

export function ticketContext(state: DepotState, ticket: K80InternalTicket): TicketContext {
  const gateIn = state.gateInOrders.find((o) => o.masterDossierCode === ticket.masterDossierCode);
  const gateOut =
    ticket.operationMode === 'CAP_VO'
      ? state.gateOutOrders.find((o) => o.gateOutCode === ticket.outDossierCode)
      : undefined;
  return { ticket, gateIn, gateOut };
}

export function getDriverRoute(state: DepotState, ticket: K80InternalTicket): RouteStep[] {
  const { gateIn, gateOut } = ticketContext(state, ticket);
  const visit = ticket.masterDossierCode;

  if (ticket.operationMode === 'CAP_VO') {
    const released = gateOut?.status === 'GATE_OUT_OK';
    return [
      { key: 'OFFICE_PAY', dept: 'VĂN PHÒNG', action: 'Thu phí & in phiếu', done: true, doneAt: ticket.issuedAt, doneBy: ticket.issuedBy },
      { key: 'FORKLIFT_RELEASE', dept: 'XE NÂNG', action: `Quét mã • nhận vỏ${ticket.targetBlock ? ` tại ${ticket.targetBlock}` : ''}`, done: released, doneAt: gateOut?.confirmedAt, doneBy: gateOut?.confirmedBy },
      { key: 'OFFICE_RETURN', dept: 'VĂN PHÒNG', action: 'Quét mã • nhận EEIR / phiếu thu', done: Boolean(gateOut?.documentsReturnedAt), doneAt: gateOut?.documentsReturnedAt, doneBy: gateOut?.documentsReturnedBy },
    ];
  }

  const cleaningWo = state.workOrders.find((w) => w.masterDossierCode === visit && w.category === 'CLEANING');
  const placement = state.locationHistory.find((h) => h.masterDossierCode === visit && h.actionType === 'INITIAL_BLOCK');
  const steps: RouteStep[] = [
    { key: 'OFFICE_PAY', dept: 'VĂN PHÒNG', action: 'Thu phí & in phiếu', done: gateIn?.status === 'GATE_IN_OK', doneAt: gateIn?.gateInOkAt, doneBy: gateIn?.gateInOkBy },
  ];
  if (cleaningWo) {
    steps.push({ key: 'CLEANING', dept: 'VỆ SINH', action: `Quét mã • ${ticket.cleaningItems.join(' + ')}`, done: cleaningWo.workStatus === 'COMPLETED', doneAt: cleaningWo.completedAt, doneBy: cleaningWo.completedBy });
  }
  steps.push(
    { key: 'FORKLIFT_PLACE', dept: 'XE NÂNG', action: gateIn?.toInspectionRack ? 'Quét mã • HẠ KỆ GIÁM ĐỊNH' : 'Quét mã • hạ vỏ', done: Boolean(placement), doneAt: placement?.performedAt, doneBy: placement?.performedBy },
    { key: 'OFFICE_RETURN', dept: 'VĂN PHÒNG', action: 'Quét mã • nhận EEIR / phiếu thu', done: Boolean(gateIn?.documentsReturnedAt), doneAt: gateIn?.documentsReturnedAt, doneBy: gateIn?.documentsReturnedBy }
  );
  return steps;
}

// Phiếu K80 mới nhất theo mã QR (cùng số container có thể có nhiều lượt — lấy lượt gần nhất)
export function findTicketByQr(state: DepotState, rawCode: string): K80InternalTicket | undefined {
  const code = rawCode.trim().toUpperCase();
  if (!code) return undefined;
  return state.k80Tickets.find(
    (t) => t.qrCode.toUpperCase() === code || t.ticketCode.toUpperCase() === code || t.outDossierCode?.toUpperCase() === code || t.masterDossierCode.toUpperCase() === code
  );
}

export interface DocumentPack {
  ticket: K80InternalTicket;
  dossierCode: string; // HV-... hoặc CV-...
  receipts: PaymentReceipt[];
}

export function documentPackOf(state: DepotState, ticket: K80InternalTicket): DocumentPack {
  const { gateIn, gateOut } = ticketContext(state, ticket);
  const voucherId = ticket.operationMode === 'CAP_VO' ? gateOut?.voucherId : gateIn?.voucherId;
  const txIds = state.paymentTransactions.filter((t) => t.voucherId && t.voucherId === voucherId).map((t) => t.id);
  return {
    ticket,
    dossierCode: ticket.operationMode === 'CAP_VO' ? ticket.outDossierCode || ticket.masterDossierCode : ticket.masterDossierCode,
    receipts: state.paymentReceipts.filter((r) => txIds.includes(r.transactionId)),
  };
}

// DEC-110: XEM TRƯỚC bộ chứng từ (EEIR + phiếu thu) — chỉ xem, KHÔNG ghi trả chứng từ, KHÔNG in, KHÔNG tăng số lần in
export function previewDocumentPack(state: DepotState, input: { scannedQrCode: string }): DocumentPack {
  assertPermission(state, 'GATE_IN_OFFICE', 'chỉ Văn phòng / Quản lý được xem chứng từ.');
  const ticket = findTicketByQr(state, input.scannedQrCode);
  if (!ticket) throw new Error('Không tìm thấy phiếu K80 khớp mã vừa quét.');
  return documentPackOf(state, ticket);
}

// Văn phòng quét QR lần cuối: chỉ khi các bước trước đã xong; mỗi phiếu trả chứng từ 1 lần
export function confirmDocumentsReturn(
  state: DepotState,
  input: { scannedQrCode: string }
): { state: DepotState; pack: DocumentPack } {
  assertPermission(state, 'GATE_IN_OFFICE', 'chỉ Văn phòng / Quản lý được trả chứng từ.');
  const ticket = findTicketByQr(state, input.scannedQrCode);
  if (!ticket) throw new Error('Không tìm thấy phiếu K80 khớp mã vừa quét.');
  const steps = getDriverRoute(state, ticket);
  const last = steps[steps.length - 1];
  if (last.done) throw new Error(`Đã trả chứng từ cho phiếu này lúc ${formatDateTime(last.doneAt)} (${last.doneBy}).`);
  const pendingStep = steps.slice(0, -1).find((s) => !s.done);
  if (pendingStep) throw new Error(`Chưa hoàn tất bước ${pendingStep.dept} — ${pendingStep.action}. Lái xe cần đến bộ phận này trước.`);

  const now = nowIso();
  const by = state.currentUser.fullName;
  const { gateIn, gateOut } = ticketContext(state, ticket);
  let next = state;
  if (ticket.operationMode === 'CAP_VO' && gateOut) {
    next = { ...next, gateOutOrders: next.gateOutOrders.map((o) => (o.id === gateOut.id ? { ...o, documentsReturnedAt: now, documentsReturnedBy: by } : o)) };
  } else if (gateIn) {
    next = { ...next, gateInOrders: next.gateInOrders.map((o) => (o.id === gateIn.id ? { ...o, documentsReturnedAt: now, documentsReturnedBy: by } : o)) };
  } else {
    throw new Error('Không tìm thấy hồ sơ của phiếu K80.');
  }
  const pack = documentPackOf(next, ticket);
  next = appendAudit(
    next,
    'DOCUMENTS_RETURNED',
    ticket.operationMode === 'CAP_VO' ? 'GATE_OUT' : 'GATE_IN',
    pack.dossierCode,
    `[Hồ sơ ${pack.dossierCode}] Văn phòng trả chứng từ cho lái xe ${ticket.truckNo || ''} (EEIR${pack.receipts.length ? ` + ${pack.receipts.length} phiếu thu` : ''})`,
    ticket.masterDossierCode
  );
  return { state: next, pack };
}

// Phiếu đang chờ trả chứng từ (các bước trước đã xong)
export function ticketsAwaitingReturn(state: DepotState): K80InternalTicket[] {
  const seen = new Set<string>();
  return state.k80Tickets.filter((t) => {
    const key = `${t.operationMode}-${t.outDossierCode || t.masterDossierCode}`;
    if (seen.has(key)) return false;
    seen.add(key);
    const steps = getDriverRoute(state, t);
    return !steps[steps.length - 1].done && steps.slice(0, -1).every((s) => s.done);
  });
}

// DEC-192: Văn phòng → Trả chứng từ, cột CẤP VỎ hiện ĐỦ lệnh đã thu tiền chưa trả chứng từ — kèm đã / chưa nâng hạ.
// Chưa nâng hạ (Xe nâng chưa cấp) thì chưa trả chứng từ được (lộ trình chặn), nhưng vẫn ĐỔI CONTAINER được.
export function releaseTicketsInProgress(state: DepotState): { ticket: K80InternalTicket; order: GateOutOrder; lifted: boolean }[] {
  const out: { ticket: K80InternalTicket; order: GateOutOrder; lifted: boolean }[] = [];
  const seen = new Set<string>();
  for (const t of state.k80Tickets) {
    if (t.operationMode !== 'CAP_VO' || !t.outDossierCode || seen.has(t.outDossierCode)) continue;
    seen.add(t.outDossierCode);
    const order = state.gateOutOrders.find((o) => o.gateOutCode === t.outDossierCode);
    if (!order || order.documentsReturnedAt || (order.status !== 'PENDING_FORKLIFT' && order.status !== 'GATE_OUT_OK')) continue;
    out.push({ ticket: t, order, lifted: order.status === 'GATE_OUT_OK' });
  }
  return out;
}

// DEC-057: phiếu đã trả chứng từ (đi hết lộ trình) → đóng, không được in lại / quét lại
export function isTicketClosed(state: DepotState, ticket: K80InternalTicket): boolean {
  const steps = getDriverRoute(state, ticket);
  return steps[steps.length - 1].done;
}
