import React from 'react';
import { Check, Copy, Printer, X } from 'lucide-react';
import { QrImage } from './Qr';
import { printNow } from './printNow';
import { PrintFooter, PrintPortal, ReceiptPaymentBody, Signatures } from './ReceiptPrint';
import { receiptCollectorName } from '../services/payments';
import { K80InternalTicket, PaymentReceipt, VesselList, VesselListItem } from '../types/depot';
import { getVesselRoute, vesselQrCode } from '../services/vessel';
import type { DepotState } from '../services/depotStore';
import { getDriverRoute, isTicketClosed } from '../services/driverRoute';
import { formatDateTime } from '../services/datetime';

interface Props {
  ticket: K80InternalTicket | null;
  state?: DepotState; // có state → hiển thị tiến độ từng bước (✓ đã xong)
  onClose: () => void;
  onSimulateScanQr?: (qrCode: string) => void;
}

const Row: React.FC<{ label: string; value?: React.ReactNode; big?: boolean }> = ({ label, value, big }) => (
  <div className="flex items-baseline justify-between gap-2 border-b border-dotted border-line-strong py-0.5">
    <span className="shrink-0 font-bold">{label}</span>
    <span className={`text-right ${big ? 'text-sm font-black tracking-wide' : 'font-semibold'}`}>{value || '-'}</span>
  </div>
);

// ĐẦU PHIẾU dùng chung PHIẾU EEIR (Hạ vỏ / Cấp vỏ / Nhập tàu / Xuất tàu) và PHIẾU TRẢ KHÁCH HÀNG:
// thông tin depot → (tên phiếu / Số / TÁC NGHIỆP | mã QR tác nghiệp)
const SheetHeader: React.FC<{ state?: DepotState; title?: string; number: string; operation: string; qrCode: string }> = ({ state, title, number, operation, qrCode }) => {
  const company = state?.companyProfile;
  return (
    <div className="border-b-2 border-slate-800 pb-2">
      {/* Thông tin depot — cùng mẫu đầu Phiếu thu (K80) */}
      {company && (
        <div className="text-center">
          <p className="text-xs font-black uppercase">{company.name}</p>
          {company.address && <p className="text-[10px]">{company.address}</p>}
          {(company.phone || company.email) && <p className="text-[10px]">{[company.phone && `ĐT: ${company.phone}`, company.email].filter(Boolean).join(' • ')}</p>}
          {company.taxCode && <p className="text-[10px]">MST: {company.taxCode}</p>}
        </div>
      )}
      {/* Bên trái: tên phiếu → Số → TÁC NGHIỆP; bên phải: MÃ QR TÁC NGHIỆP vừa khít 3 dòng (QR-<mã hồ sơ> như cũ, DEC-057) */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <div className="min-w-0 space-y-1">
          {title && <p className="text-sm font-black tracking-wide">{title}</p>}
          <p className="text-xs font-bold">Số: {number}</p>
          <p className="inline-block bg-navy-900 px-2 py-0.5 text-xs font-black text-white">TÁC NGHIỆP: {operation}</p>
        </div>
        {qrCode && (
          <div className="shrink-0 border-2 border-slate-900 bg-white p-0.5 text-center">
            <QrImage value={qrCode} size={60} />
            <span className="block text-[8px] font-black tracking-tighter">{qrCode}</span>
          </div>
        )}
      </div>
    </div>
  );
};

const TicketHeader: React.FC<{ ticket: K80InternalTicket; state?: DepotState; title?: string }> = ({ ticket, state, title }) => (
  <SheetHeader
    state={state}
    title={title}
    number={ticket.outDossierCode || ticket.masterDossierCode}
    operation={ticket.operationMode === 'CAP_VO' ? 'CẤP VỎ' : 'HẠ VỎ'}
    qrCode={ticket.qrCode}
  />
);

// LỘ TRÌNH — đến bộ phận nào thì quét mã, tích ☐ bằng bút (live: tô bước kế tiếp + ✓ bước đã xong)
type RouteItem = { key: string; dept: string; action: string; done: boolean; doneAt?: string };
const RouteBox: React.FC<{ steps: RouteItem[]; live: boolean }> = ({ steps, live }) => {
  const nextStep = steps.find((s) => !s.done);
  return (
    <div className="border-y-2 border-slate-800 py-2">
      <p className="mb-1.5 text-center text-xs font-black tracking-wider">LỘ TRÌNH — QUÉT MÃ TẠI TỪNG BỘ PHẬN</p>
      <ol className="space-y-1.5">
        {steps.map((s, i) => (
          <li key={s.key} className={`flex items-start gap-2 ${live && nextStep?.key === s.key ? 'rounded bg-amber-100 px-1' : ''}`}>
            <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center border-2 border-slate-900 text-xs font-black">{live && s.done ? '✓' : ''}</span>
            <span className="flex-1">
              <span className="font-black">{i + 1}. {s.dept}</span>
              <span className="block text-[10px]">{s.action}</span>
            </span>
            {live && s.done && s.doneAt && <span className="shrink-0 text-[9px] text-ink-muted">{formatDateTime(s.doneAt).slice(11)}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
};

// VĂN PHÒNG XÁC NHẬN — người lập phiếu / danh sách
const OfficeConfirm: React.FC<{ by?: string; at?: string }> = ({ by, at }) => (
  <div className="pt-2 text-center">
    <p className="text-[10px] font-black uppercase">Văn phòng xác nhận</p>
    <p className="text-[9px] text-ink-muted">(Ký, ghi rõ họ tên)</p>
    <p className="mt-6 text-xs font-black">{by || '-'}</p>
    <p className="text-[9px] text-ink-muted">Lập phiếu lúc {formatDateTime(at)}</p>
  </div>
);

// THÔNG TIN CONTAINER dùng chung 2 phiếu
const TicketInfoRows: React.FC<{ ticket: K80InternalTicket }> = ({ ticket }) => (
  <div className="py-2">
    <Row label="SỐ CONT" value={ticket.containerNo} big />
    <Row label="SIZE / TYPE" value={`${ticket.size} / ${ticket.type}${ticket.manufactureYear ? ` • AGE ${ticket.manufactureYear}` : ''}`} />
    <Row label="SỐ XE" value={ticket.truckNo} big />
    <Row label="SĐT LÁI XE" value={ticket.driverPhone} />
    <Row label="TRẠNG THÁI" value={ticket.stuffingClass ? `${ticket.conditionClass} • Đóng hàng ${ticket.stuffingClass}` : ticket.conditionClass} />
    {ticket.damageRemarks && ticket.damageRemarks.length > 0 && <Row label="HƯ HỎNG" value={ticket.damageRemarks.join(', ')} />}
    <Row label="VỆ SINH" value={ticket.cleaningItems.join(' + ')} />
    <Row label="THANH TOÁN" value={`${ticket.isPaid ? '✓' : '✗'} ${ticket.paymentLabel}`} />
  </div>
);

// PHIẾU TRẢ KHÁCH HÀNG (DEC-162): gộp EEIR + phiếu thu thành 1 phiếu K80 giao khách khi Trả chứng từ.
// Đầu phiếu (depot → Số / TÁC NGHIỆP | QR) + thông tin cont như phiếu EEIR; thay LỘ TRÌNH bằng khối PHIẾU THU (+ yêu cầu xuất hóa đơn);
// BẢN IN LẠI — LẦN n ghi ngay dưới khối PHIẾU THU.
// Số lần in = bộ đếm của phiếu thu kèm theo (recordReceiptPrint); không có phiếu thu (TTS / trừ trả trước) → không đếm.
export const CustomerSlipK80: React.FC<{ ticket: K80InternalTicket; state: DepotState; receipts: PaymentReceipt[]; printNo?: number }> = ({ ticket, state, receipts, printNo }) => (
  <div className="k80-sheet mx-auto border-2 border-dashed border-slate-800 bg-white px-2 py-2 font-mono text-[11px] leading-snug text-ink">
    <TicketHeader ticket={ticket} state={state} />
    <TicketInfoRows ticket={ticket} />
    <div className="border-t-2 border-slate-800 pt-2">
      <p className="text-center text-xs font-black tracking-wider">PHIẾU THU</p>
      {receipts.length === 0 ? (
        <p className="mt-1 text-center text-[10px]">{ticket.paymentLabel} — không phát hành phiếu thu lượt này.</p>
      ) : (
        receipts.map((r) => (
          <div key={r.id} className="[&+&]:mt-2 [&+&]:border-t [&+&]:border-dotted [&+&]:border-line-strong">
            <ReceiptPaymentBody state={state} receipt={r} inSlip />
          </div>
        ))
      )}
      {printNo && printNo > 1 && <p className="mt-2 border-2 border-rose-600 py-0.5 text-center text-[11px] font-black text-rose-600">BẢN IN LẠI — LẦN {printNo}</p>}
    </div>
    <Signatures
      left="Lái xe / Khách hàng"
      right="Văn phòng xác nhận"
      rightName={receipts[0] ? receiptCollectorName(state, receipts[0]) : state.currentUser.fullName}
    />
    {state.companyProfile.bankAccount && receipts.length > 0 && <p className="mt-2 text-center text-[10px] text-ink-muted">TK ngân hàng: {state.companyProfile.bankAccount}</p>}
    <PrintFooter note={printNo ? `lần in thứ ${printNo}` : undefined} />
  </div>
);

// Lần in hiện tại của phiếu trả khách hàng = lần in của phiếu thu kèm theo (lớn nhất)
export const slipPrintCount = (receipts: PaymentReceipt[]): number => Math.max(0, ...receipts.map((r) => r.printLog?.length || 0));

// PHIẾU EEIR TÁC NGHIỆP (K80) (DEC-023, DEC-052, DEC-161): đầu phiếu → thông tin cont → LỘ TRÌNH → Văn phòng xác nhận.
// Lái xe cầm đi các bộ phận quét mã. Giao khách khi Trả chứng từ là PHIẾU TRẢ KHÁCH HÀNG (CustomerSlipK80).
export const EeirK80Sheet: React.FC<{ ticket: K80InternalTicket; state?: DepotState }> = ({ ticket, state }) => {
  const isOut = ticket.operationMode === 'CAP_VO';
  type Step = { key: string; dept: string; action: string; done: boolean; doneAt?: string };
  const steps: Step[] = state
    ? getDriverRoute(state, ticket)
    : [
        { key: 'OFFICE_PAY', dept: 'VĂN PHÒNG', action: 'Thu phí & in phiếu', done: true },
        ...(!isOut && ticket.cleaningItems.some((i) => i !== 'KHÔNG VỆ SINH')
          ? [{ key: 'CLEANING', dept: 'VỆ SINH', action: `Quét mã • ${ticket.cleaningItems.join(' + ')}`, done: false }]
          : []),
        { key: 'FORKLIFT', dept: 'XE NÂNG', action: isOut ? 'Quét mã • nhận vỏ' : 'Quét mã • hạ vỏ', done: false },
        { key: 'OFFICE_RETURN', dept: 'VĂN PHÒNG', action: 'Quét mã • nhận EEIR / phiếu thu', done: false },
      ];
  return (
    // KHỔ GIẤY IN NHIỆT K80 (80mm)
    <div className="k80-sheet mx-auto border-2 border-dashed border-slate-800 bg-white px-2 py-2 font-mono text-[11px] leading-snug text-ink">
      <TicketHeader ticket={ticket} state={state} title="PHIẾU EEIR TÁC NGHIỆP" />
      <TicketInfoRows ticket={ticket} />
      <RouteBox steps={steps} live={Boolean(state)} />
      <OfficeConfirm by={ticket.issuedBy} at={ticket.issuedAt} />
    </div>
  );
};

// PHIẾU EEIR NHẬP TÀU / XUẤT TÀU (K80) (DEC-081, DEC-161, DEC-163): cùng mẫu phiếu tác nghiệp Hạ vỏ / Cấp vỏ —
// đầu phiếu + mã QR (QR-<NT- / XT->) → thông tin cont + tàu + tình trạng vỏ → LỘ TRÌNH (getVesselRoute) → Văn phòng xác nhận.
export const VesselEeirPrintSheet: React.FC<{ state: DepotState; list: VesselList; item: VesselListItem }> = ({ state, list, item }) => {
  const isImport = list.mode === 'NHAP_TAU';
  const container = state.containers.find((c) => c.id === item.containerId);
  const visit = container?.masterDossierCode;
  const loc = state.locationHistory.filter((l) => l.masterDossierCode === visit);
  const location = isImport
    ? [...loc].reverse().find((l) => l.actionType === 'INITIAL_BLOCK')?.toLocation
    : item.locationAtList || loc.find((l) => l.actionType === 'GATE_OUT_CLEAR')?.fromLocation;
  // Tình trạng vỏ: Nhập tàu = kết quả Giám định của lượt này; Xuất tàu = tình trạng hiện tại + Giám định lúc cont vào bãi
  const origin = visit ? state.gateInOrders.find((o) => o.masterDossierCode === visit) : undefined;
  const originVessel = visit?.startsWith('NT-') ? (state.vesselLists || []).flatMap((l) => l.items).find((i) => i.dossierCode === visit) : undefined;
  const cond = isImport
    ? { condition: item.conditionClass, stuffing: item.stuffingClass, damage: item.damageRemarks, cleaning: item.cleaningItems, age: item.manufactureYear, by: item.inspectedBy, at: item.inspectedAt }
    : {
        condition: container?.conditionClass,
        stuffing: container?.stuffingClass,
        damage: container?.damageRemarks,
        cleaning: container?.cleaningItems,
        age: container?.manufactureYear,
        by: origin?.fieldStaffName || originVessel?.inspectedBy,
        at: origin?.fieldRecordedAt || originVessel?.inspectedAt,
      };
  return (
    <div className="k80-sheet mx-auto border-2 border-dashed border-slate-800 bg-white px-2 py-2 font-mono text-[11px] leading-snug text-ink">
      <SheetHeader state={state} title="PHIẾU EEIR TÁC NGHIỆP" number={item.dossierCode || '-'} operation={isImport ? 'NHẬP TÀU' : 'XUẤT TÀU'} qrCode={vesselQrCode(item)} />
      <div className="py-2">
        <Row label="SỐ CONT" value={item.containerNo} big />
        <Row label="SIZE / TYPE" value={`${item.size} / ${item.type}${cond.age ? ` • AGE ${cond.age}` : ''}`} />
        <Row label="SỐ XE" value={item.truckNo} big />
        <Row label="TÊN TÀU" value={list.vesselName} />
        <Row label="HÃNG TÀU" value={list.shippingLineCode || container?.shippingLineCode} />
        <Row label={isImport ? 'NHẬP TÀU' : 'XUẤT TÀU'} value={formatDateTime(list.plannedAt)} />
        <Row label={isImport ? 'VÀO BÃI' : 'OUT'} value={formatDateTime(isImport ? container?.gateInAt : item.doneAt)} />
        {!isImport && <Row label="DATE IN" value={formatDateTime(container?.gateInAt)} />}
        <Row label={isImport ? 'VỊ TRÍ HẠ' : 'VỊ TRÍ LẤY'} value={location} />
        <Row label="TRẠNG THÁI" value={cond.stuffing ? `${cond.condition || '-'} • Đóng hàng ${cond.stuffing}` : cond.condition} />
        {cond.damage && cond.damage.length > 0 && <Row label="HƯ HỎNG" value={cond.damage.join(', ')} />}
        <Row label="VỆ SINH" value={(cond.cleaning || []).join(' + ')} />
        <Row label="GIÁM ĐỊNH" value={cond.by ? `${cond.by} • ${formatDateTime(cond.at)}` : '-'} />
        <Row label="THANH TOÁN" value="Không thu phí (tác nghiệp tàu)" />
      </div>
      <RouteBox steps={getVesselRoute(state, list, item)} live />
      <OfficeConfirm by={list.createdBy} at={list.createdAt} />
    </div>
  );
};

// Cửa sổ xem / in PHIẾU EEIR (K80)
export const K80TicketModal: React.FC<Props> = ({ ticket, state, onClose, onSimulateScanQr }) => {
  const [copied, setCopied] = React.useState(false);
  if (!ticket) return null;

  const nextStep = state ? getDriverRoute(state, ticket).find((s) => !s.done) : undefined;
  const closed = state ? isTicketClosed(state, ticket) : false;

  const handleCopy = () => {
    navigator.clipboard?.writeText(ticket.qrCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-navy-900/60 p-4" role="dialog" aria-modal="true" aria-label="Phiếu EEIR (K80)">
      <div className="relative my-auto w-full max-w-[350px] rounded-2xl border border-line-strong bg-white p-4 shadow-2xl">
        <button type="button" onClick={onClose} aria-label="Đóng" className="absolute right-3 top-3 rounded-lg p-1.5 text-ink-muted hover:bg-navy-50 hover:text-ink">
          <X className="h-5 w-5" />
        </button>

        <EeirK80Sheet ticket={ticket} state={state} />
        {/* Bản in qua lớp in riêng (giống Trả chứng từ / hồ sơ) → khổ K80 vừa đủ phiếu */}
        <PrintPortal>
          <EeirK80Sheet ticket={ticket} state={state} />
        </PrintPortal>

        {closed && (
          <p className="mt-3 rounded-md bg-navy-50 px-3 py-1.5 text-center text-xs font-semibold text-ink">
            Phiếu đã hoàn tất lộ trình & trả chứng từ — mã QR đã đóng, không in lại.
          </p>
        )}
        {state && nextStep && (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-1.5 text-center text-xs font-semibold text-amber-900">
            Bước tiếp theo: {nextStep.dept} — {nextStep.action}
          </p>
        )}

        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" disabled={closed} onClick={printNow} className="flex items-center justify-center gap-1.5 rounded-xl bg-navy-900 px-3 py-2.5 text-xs font-bold text-white hover:bg-navy-700 disabled:cursor-not-allowed disabled:opacity-40">
              <Printer className="h-4 w-4" />
              In phiếu EEIR (K80)
            </button>
            <button type="button" onClick={handleCopy} className="flex items-center justify-center gap-1.5 rounded-xl border border-line-strong bg-canvas px-3 py-2.5 text-xs font-bold text-ink hover:bg-navy-50">
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Đã chép QR' : 'Copy mã QR'}
            </button>
          </div>
          {onSimulateScanQr && !closed && (
            <button
              type="button"
              onClick={() => {
                onSimulateScanQr(ticket.qrCode);
                onClose();
              }}
              className="w-full rounded-xl bg-navy-900 px-3 py-2 text-xs font-bold text-white hover:bg-navy-700"
            >
              Chuyển sang Xe nâng & quét thử mã QR này
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
