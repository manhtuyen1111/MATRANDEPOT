import React from 'react';
import { CheckCircle2, Clock, Eye, EyeOff, FileDown, FileText, Printer, ReceiptText, X } from 'lucide-react';
import { ContainerStatus, K80InternalTicket, VesselList, VesselListItem } from '../types/depot';
import { DepotState } from '../services/depotStore';
import { formatLocation } from '../services/core';
import { containerIsoCode } from '../services/depotOperations';
import { documentPackOf } from "../services/driverRoute";
import { recordReceiptPrint } from "../services/api";
import { formatDateTime } from "../services/datetime";
import { DossierHistory, dossierHistory, DossierHistoryRow, SWAP_TASK, HistoryAction, HistoryReceipt, resolveDossier } from '../services/dossierHistory';
import { CompanyHeader, PrintPreviewModal } from "./ReceiptPrint";
import { exportPdf, printNow } from "./printNow";
import { CustomerSlipK80, EeirK80Sheet, slipPrintCount, VesselEeirPrintSheet } from './K80TicketModal';
import { CELL_MAX, CellText, linkCls, formatViTime, LocText, PhotoGallery } from './shared';

interface Props {
  masterDossierCode: string | null; // Mã hồ sơ HẠ VỎ (HV-...) hoặc CẤP VỎ (CV-...)
  state: DepotState;
  onClose: () => void;
  onOpenK80Ticket?: (ticket: K80InternalTicket) => void;
  onOpenReceipt?: (key: string) => void; // DEC-051: mở Văn phòng → Phiếu thu
  onUpdateState?: (next: DepotState) => void; // DEC-072: ghi nhận số lần in phiếu thu khi in kèm EEIR
}

const CONTAINER_STATUS: Record<ContainerStatus, string> = {
  PENDING_GATE_IN: 'Đang làm thủ tục hạ vỏ',
  WAITING_PLACEMENT: 'Chờ hạ vỏ',
  IN_YARD: 'Đang tồn bãi',
  ALLOCATED: 'Đã lập lệnh cấp',
  GATED_OUT: 'Đã OUT',
};

const Field: React.FC<{ label: string; value?: React.ReactNode; mono?: boolean }> = ({ label, value, mono }) => (
  <div>
    <dt className="text-[10px] font-semibold uppercase text-ink-muted">{label}</dt>
    <dd className={`text-xs font-semibold text-ink ${mono ? 'font-mono' : ''}`}>{value || '-'}</dd>
  </div>
);

const ReceiptLink: React.FC<{ receipt: HistoryReceipt; onOpenReceipt?: (key: string) => void }> = ({ receipt, onOpenReceipt }) =>
  onOpenReceipt ? (
    <button type="button" onClick={() => onOpenReceipt(receipt.target)} className={`inline-flex items-center gap-1 ${linkCls}`}>
      <ReceiptText className="h-3.5 w-3.5" />
      {receipt.label}
    </button>
  ) : (
    <span className="font-mono font-bold">{receipt.label}</span>
  );

// NỘI DUNG: TẠO MỚI / SỬA / XÓA (DEC-181)
const ACTION_TONE: Record<HistoryAction, string> = {
  'TẠO MỚI': 'border-emerald-300 bg-emerald-50 text-emerald-800',
  SỬA: 'border-amber-300 bg-amber-50 text-amber-800',
  XÓA: 'border-rose-300 bg-rose-50 text-rose-800',
};

const HistoryDetail: React.FC<{ row: DossierHistoryRow; onOpenReceipt?: (key: string) => void }> = ({ row, onOpenReceipt }) => (
  <div className="space-y-1">
    {row.location && (
      <p className="inline-flex flex-wrap items-center gap-1 font-semibold">
        {row.location.from && <><LocText text={row.location.from} /> →</>}
        <LocText text={row.location.to} />
      </p>
    )}
    {row.detail && <p>{row.detail}</p>}
    {row.receipts && row.receipts.length > 0 && (
      <p className="flex flex-wrap gap-x-3 gap-y-1">
        {row.receipts.map((r) => <ReceiptLink key={r.target} receipt={r} onOpenReceipt={onOpenReceipt} />)}
      </p>
    )}
    {/* Ảnh cửa cont Giám định hiện luôn (DEC-182); ảnh khác chỉ tải khi bấm XEM ẢNH (DEC-178) */}
    {row.photos && row.photos.length > 0 && (
      <div data-testid={row.operation === 'Sửa chữa' ? 'repair-photo-list' : undefined}>
        <PhotoGallery photos={row.photos} alt={row.photoAlt || 'Ảnh'} className={row.showPhotos ? 'h-24 w-36' : 'h-16 w-16'} autoShow={row.showPhotos} />
      </div>
    )}
  </div>
);

// Cột TRẠNG THÁI (DEC-188): chỉ icon — tích xanh = hoàn thành, đồng hồ = đang chờ (DEC-192: bỏ đồng hồ cát)
const DoneIcon: React.FC = () => <CheckCircle2 className="inline h-5 w-5 text-emerald-600" aria-label="Hoàn thành" data-testid="status-done" />;
const WaitIcon: React.FC = () => <Clock className="inline h-5 w-5 animate-pulse text-amber-500" aria-label="Đang chờ" data-testid="status-wait" />;

// Tác nghiệp ĐỔI CONT nổi bật (DEC-187)
const TaskText: React.FC<{ task: string }> = ({ task }) =>
  task.startsWith(SWAP_TASK.SWAP) ? <span className="rounded bg-danger-fg px-1.5 py-0.5 text-[10px] font-bold text-white">{task}</span> : <>{task}</>;

// LỊCH SỬ HỒ SƠ (DEC-181, DEC-183, DEC-184, DEC-187): BỘ PHẬN | TÁC NGHIỆP (trong bộ phận); mỗi tác nghiệp đúng 1 dòng; CHI TIẾT luôn ẩn (nút mắt) — bấm mắt mở dòng chi tiết ngay bên dưới;
// nút MỞ / ẨN TOÀN BỘ CHI TIẾT. Bản in A4 (printMode) luôn mở hết, không có nút.
export const HistoryTable: React.FC<{ history: DossierHistory; onOpenReceipt?: (key: string) => void; printMode?: boolean }> = ({ history, onOpenReceipt, printMode = false }) => {
  const [open, setOpen] = React.useState<Set<string>>(() => new Set());
  const all = history.rows.length > 0 && history.rows.every((r) => open.has(r.id));
  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const isOpen = (id: string) => printMode || open.has(id);
  return (
    <>
      <div className="flex items-center justify-between gap-2 pt-1">
        <h3 className="text-xs font-black uppercase tracking-wider text-ink-muted">Lịch sử hồ sơ</h3>
        {!printMode && history.rows.length > 0 && (
          <button
            type="button"
            onClick={() => setOpen(all ? new Set() : new Set(history.rows.map((r) => r.id)))}
            className="no-print inline-flex items-center gap-1.5 rounded-md border border-line-strong px-2.5 py-1.5 text-[11px] font-bold text-navy-700 hover:bg-navy-50"
          >
            {all ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {all ? 'ẨN TOÀN BỘ CHI TIẾT' : 'MỞ TOÀN BỘ CHI TIẾT'}
          </button>
        )}
      </div>
      <div className="overflow-x-auto rounded-md border border-line">
        <table className="dossier-history w-full whitespace-nowrap text-left text-xs" data-testid="dossier-history">
          <thead className="bg-canvas text-[10px] font-bold uppercase text-ink-muted">
            <tr>
              <th className="px-2.5 py-2">Thời gian</th>
              <th className="px-2.5 py-2">Bộ phận</th>
              <th className="px-2.5 py-2">Tác nghiệp</th>
              <th className="px-2.5 py-2">Nội dung</th>
              <th className="px-2.5 py-2 text-center">Chi tiết</th>
              <th className="px-2.5 py-2">Nhân viên</th>
              <th className="px-2.5 py-2 text-center">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {history.rows.map((r) => (
              <React.Fragment key={r.id}>
                <tr>
                  <td className="px-2.5 py-2 font-mono">{formatViTime(r.at)}</td>
                  <td className="px-2.5 py-2 font-semibold">{r.dept}</td>
                  <td className="px-2.5 py-2"><TaskText task={r.task} /></td>
                  <td className="px-2.5 py-2">
                    <span className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${ACTION_TONE[r.action]}`}>{r.action}</span>
                  </td>
                  <td className="px-2.5 py-1 text-center">
                    {!printMode && (
                      <button
                        type="button"
                        onClick={() => toggle(r.id)}
                        aria-label={isOpen(r.id) ? 'Ẩn chi tiết' : 'Xem chi tiết'}
                        aria-expanded={isOpen(r.id)}
                        className={`no-print rounded-md p-1 hover:bg-navy-50 ${isOpen(r.id) ? 'text-navy-700' : 'text-ink-muted'}`}
                      >
                        {isOpen(r.id) ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </button>
                    )}
                  </td>
                  <td className="px-2.5 py-2"><CellText text={r.staff} max={CELL_MAX.MEDIUM} /></td>
                  <td className="px-2.5 py-2 text-center"><DoneIcon /></td>
                </tr>
                {isOpen(r.id) && (
                  <tr className="bg-canvas/60" data-testid="dossier-detail">
                    <td colSpan={7} className="whitespace-normal px-2.5 py-2 pl-6">
                      <HistoryDetail row={r} onOpenReceipt={onOpenReceipt} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
            {history.rows.length === 0 && (
              <tr><td colSpan={7} className="px-2.5 py-3 text-center text-ink-muted">Chưa có tác nghiệp.</td></tr>
            )}
            {/* ĐANG CHỜ (DEC-184): mỗi việc chờ 1 dòng — bộ phận phụ trách, nội dung chờ; icon chờ ở cột Trạng thái (DEC-188) */}
            {history.pending.map((p, i) => (
              <tr key={`p${i}`} className="bg-amber-50/70" data-testid="dossier-pending">
                <td className="px-2.5 py-2 text-amber-700">-</td>
                <td className="px-2.5 py-2 font-semibold text-amber-900">{p.dept}</td>
                <td className="px-2.5 py-2 text-amber-900"><TaskText task={p.task} /></td>
                <td className="px-2.5 py-2">
                  <span className="rounded border border-amber-400 bg-white px-1.5 py-0.5 text-[10px] font-bold text-amber-700">ĐANG CHỜ</span>
                </td>
                <td colSpan={2} className="px-2.5 py-2 font-semibold text-amber-900">{p.label}</td>
                <td className="px-2.5 py-2 text-center"><WaitIcon /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};

// ---------------------------------------------------------------------------
// HỒ SƠ CONTAINER: thông tin container ở đầu (DEC-058) → LỊCH SỬ HỒ SƠ dạng bảng, cũ trên – mới dưới (DEC-181)
// ---------------------------------------------------------------------------
export const MasterDossierModal: React.FC<Props> = ({ masterDossierCode, state, onClose, onOpenK80Ticket, onOpenReceipt, onUpdateState }) => {
  // HỒ SƠ CONTAINER khổ A4 (DEC-161): toàn bộ hồ sơ tới thời điểm in — mở cửa sổ xem, trong đó IN / XUẤT PDF
  const [viewDossier, setViewDossier] = React.useState(false);
  const closeDossierView = React.useCallback(() => setViewDossier(false), []);
  // Esc để đóng hồ sơ (DEC-080)
  React.useEffect(() => {
    if (!masterDossierCode) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [masterDossierCode, onClose]);
  if (!masterDossierCode) return null;

  const dossier = resolveDossier(state, masterDossierCode);
  if (!dossier) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
        <div className="w-full max-w-sm rounded-lg bg-white p-5 text-center text-xs">
          <p className="mb-3">Không tìm thấy hồ sơ <span className="font-mono font-bold">{masterDossierCode}</span>.</p>
          <button type="button" onClick={onClose} className="rounded-md border border-line-strong px-3 py-1.5 font-semibold">Đóng</button>
        </div>
      </div>
    );
  }

  const { visitCode, gateIn, container, outMatch, outOrders, importHit, exportHits } = dossier;
  const tickets = state.k80Tickets.filter((t) => t.masterDossierCode === visitCode);
  const containerNo = container?.containerNo || gateIn?.containerNo || outMatch?.containerNo;
  const cleaningItems = container?.cleaningItems || gateIn?.cleaningItems || [];
  const activeOut = outOrders.find((o) => o.status !== 'CANCELLED' && o.masterDossierCode === visitCode); // DEC-185: bỏ lệnh đã đổi sang cont khác
  const history = dossierHistory(state, dossier);
  // DEC-195: mã ISO 6346 (mã riêng của cont → theo Danh mục Size + Type)
  const isoCode = containerIsoCode(state, { size: container?.size || gateIn?.size || '', type: container?.type || gateIn?.type || '', isoCode: container?.isoCode });

  // Nội dung hồ sơ — dùng chung cho màn hình và bản in A4 (bản in mở toàn bộ chi tiết)
  const renderContent = (printMode: boolean) => (
    <>
        {/* THÔNG TIN CƠ BẢN CONTAINER — focus số cont */}
        <header className="bg-navy-900 px-5 py-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-300">Hồ sơ container</p>
              <p className="font-mono text-3xl font-black tracking-wider">{containerNo || 'CHƯA CÓ SỐ CONT'}</p>
              <p className="mt-1 flex flex-wrap gap-1.5 font-mono text-[11px]">
                <span className="rounded bg-white/15 px-1.5 py-0.5">{importHit ? 'NHẬP TÀU' : 'HẠ VỎ'} {visitCode}</span>
                {activeOut && <span className="rounded bg-white/15 px-1.5 py-0.5">CẤP VỎ {activeOut.gateOutCode}</span>}
                {exportHits.map(({ item }) => <span key={item.id} className="rounded bg-white/15 px-1.5 py-0.5">XUẤT TÀU {item.dossierCode}</span>)}
                {container && <span className="rounded bg-amber-400 px-1.5 py-0.5 font-sans font-bold text-ink">{CONTAINER_STATUS[container.status]}</span>}
                {container?.isOnHold && <span className="rounded bg-rose-500 px-1.5 py-0.5 font-sans font-bold">ĐANG KHÓA: {container.holdReason}</span>}
                {container?.releaseDamage && <span className="rounded bg-rose-500 px-1.5 py-0.5 font-sans font-bold">PHÁT SINH CẤP VỎ</span>}
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Đóng hồ sơ" className="no-print rounded-md border border-white/30 p-1.5 text-white hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-white/20 pt-3 text-xs sm:grid-cols-4 [&_dd]:text-white [&_dt]:text-slate-300">
            <Field label="Size / Type (ISO)" value={`${container?.size || gateIn?.size || '-'} / ${container?.type || gateIn?.type || '-'}${isoCode ? ` (${isoCode})` : ''}`} />
            <Field label="Hãng tàu" value={container?.shippingLineCode || gateIn?.shippingLineCode} />
            <Field label="Trạng thái • Đóng hàng" value={`${container?.conditionClass || gateIn?.conditionClass || '-'} • ${container?.stuffingClass || gateIn?.stuffingClass || '-'}`} />
            <Field label="AGE" value={container?.manufactureYear || gateIn?.manufactureYear} />
            <Field label="Vị trí hiện tại" value={container ? formatLocation(container) : '-'} mono />
            <Field label={importHit ? "Tàu" : "Khách hàng"} value={importHit ? importHit.list.vesselName : gateIn?.customerRep || container?.customerRep} />
            <Field label="Vệ sinh" value={cleaningItems.join(' + ')} />
            <Field label="Gate in" value={formatViTime(container?.gateInAt || gateIn?.gateInOkAt)} mono />
          </dl>
        </header>

        <div className="space-y-2.5 px-5 py-4">
          {container?.officeNote && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <strong>Ghi chú văn phòng:</strong> {container.officeNote}
              {container.officeNoteUpdatedBy && <span className="text-amber-700"> — {container.officeNoteUpdatedBy}, {formatViTime(container.officeNoteUpdatedAt)}</span>}
            </p>
          )}

          {/* LỊCH SỬ HỒ SƠ (DEC-181, DEC-183): mỗi tác nghiệp 1 dòng, chi tiết ẩn — bản in A4 mở hết */}
          <HistoryTable history={history} onOpenReceipt={onOpenReceipt} printMode={printMode} />
        </div>
    </>
  );

  // Bản HỒ SƠ CONTAINER khổ A4 (xem trước + in / xuất PDF)
  const dossierA4 = (
    <div className="dossier-a4 space-y-3 bg-white text-ink">
      <CompanyHeader company={state.companyProfile} title="HỒ SƠ CONTAINER" subtitle={<p className="text-[11px]">Toàn bộ hồ sơ tới thời điểm in • In lúc {formatDateTime(new Date())}</p>} />
      {renderContent(true)}
    </div>
  );

  return (
    // DEC-080: hồ sơ mở dạng cửa sổ trượt bên phải (giống chi tiết các danh sách); bấm ra ngoài / Esc để đóng
    <div className="fixed inset-0 z-50 flex justify-end bg-navy-900/30" role="dialog" aria-modal="true" aria-label="Hồ sơ container" onClick={onClose}>
      <div className="h-full w-full overflow-y-auto bg-white shadow-2xl sm:w-[min(960px,80vw)]" onClick={(e) => e.stopPropagation()}>
        {renderContent(false)}

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3">
          <button
            type="button"
            onClick={() => setViewDossier(true)}
            className="inline-flex items-center gap-1.5 rounded-md bg-navy-900 px-3 py-2 text-xs font-semibold text-white hover:bg-navy-700"
          >
            <FileText className="h-4 w-4" />
            HỒ SƠ CONTAINER
          </button>
        </footer>
        {/* HỒ SƠ CONTAINER A4: mở ra xem → trong cửa sổ chọn IN hoặc XUẤT PDF */}
        {viewDossier && (
          <PrintPreviewModal
            title={`HỒ SƠ CONTAINER — ${containerNo || visitCode}`}
            onClose={closeDossierView}
            actions={
              <>
                <button type="button" onClick={() => setTimeout(printNow, 50)} className="inline-flex items-center gap-1.5 rounded-md border border-line-strong px-3 py-2 text-xs font-semibold text-ink hover:bg-canvas">
                  <Printer className="h-4 w-4" />
                  IN
                </button>
                <button type="button" onClick={() => exportPdf(`HO-SO-${containerNo || visitCode}`).catch((e) => window.alert(e instanceof Error ? e.message : 'Không xuất được PDF'))} className="inline-flex items-center gap-1.5 rounded-md bg-navy-900 px-3 py-2 text-xs font-semibold text-white hover:bg-navy-700">
                  <FileDown className="h-4 w-4" />
                  XUẤT PDF
                </button>
              </>
            }
            print={dossierA4}
          >
            <div className="w-full overflow-x-auto">
              <div className="mx-auto w-[190mm] max-w-none bg-white p-4 shadow">{dossierA4}</div>
            </div>
            <p className="w-full text-center text-[11px] text-ink-muted">XUẤT PDF: tải thẳng file PDF khổ A4, tên file theo số container.</p>
          </PrintPreviewModal>
        )}
        <DossierPrintBar state={state} tickets={tickets} onUpdateState={onUpdateState} vessel={[...(importHit ? [importHit] : []), ...exportHits]} />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// PHIẾU từ hồ sơ (DEC-072, DEC-161): bấm "Xem phiếu" → cửa sổ xem đúng khổ K80 → nút In trong cửa sổ.
//   Hạ vỏ / Cấp vỏ = PHIẾU EEIR TÁC NGHIỆP (không đếm) + PHIẾU TRẢ KHÁCH HÀNG (đếm theo phiếu thu — DEC-063, DEC-162); Nhập / Xuất tàu = EEIR (K80)
// ---------------------------------------------------------------------------
const DossierPrintBar: React.FC<{
  state: DepotState;
  tickets: K80InternalTicket[];
  onUpdateState?: (next: DepotState) => void;
  // DEC-081: EEIR Nhập tàu / Xuất tàu (không có phiếu tác nghiệp K80)
  vessel?: { list: VesselList; item: VesselListItem }[];
}> = ({ state, tickets, onUpdateState, vessel = [] }) => {
  // ticket = PHIẾU EEIR TÁC NGHIỆP (không đếm in) • slip = PHIẾU TRẢ KHÁCH HÀNG (đếm theo phiếu thu — DEC-162) • vessel = EEIR tàu
  const [view, setView] = React.useState<{ kind: 'ticket' | 'slip' | 'vessel'; id: string } | null>(null);
  const [confirmReprint, setConfirmReprint] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const close = React.useCallback(() => {
    setView(null);
    setConfirmReprint(false);
    setError(null);
  }, []);
  // Mỗi tác nghiệp lấy phiếu K80 mới nhất (EEIR theo lượt Hạ vỏ / từng lệnh Cấp vỏ)
  const seen = new Set<string>();
  const packs = tickets
    .filter((t) => {
      const key = `${t.operationMode}-${t.outDossierCode || t.masterDossierCode}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((t) => documentPackOf(state, t));
  if (packs.length === 0 && vessel.length === 0) return null;

  // EEIR tàu: Nhập tàu xem được từ khi Giám định xác nhận; Xuất tàu ngay khi lập danh sách (đã có mã XT-) — DEC-167
  const vesselReady = (v: { list: VesselList; item: VesselListItem }) => (v.list.mode === 'NHAP_TAU' ? v.item.status !== 'PENDING' : Boolean(v.item.dossierCode) && v.item.status !== 'SKIPPED');
  const pack = view?.kind === 'ticket' || view?.kind === 'slip' ? packs.find((p) => p.ticket.ticketCode === view.id) : undefined;
  const vesselHit = view?.kind === 'vessel' ? vessel.find((v) => v.item.id === view.id) : undefined;

  // In PHIẾU TRẢ KHÁCH HÀNG: ghi nhận 1 lần in cho mỗi phiếu thu kèm theo (DEC-063 / DEC-162)
  const printSlip = () => {
    setError(null);
    setConfirmReprint(false);
    if (pack && pack.receipts.length) {
      if (!onUpdateState) return setError('Màn này không ghi nhận được số lần in — in phiếu thu tại Văn phòng → Phiếu thu.');
      try {
        let next = state;
        for (const r of pack.receipts) next = recordReceiptPrint(next, { receiptNo: r.receiptNo });
        onUpdateState(next);
      } catch (err) {
        return setError(err instanceof Error ? err.message : 'Không in được phiếu thu');
      }
    }
    setTimeout(printNow, 150);
  };

  const btn = 'inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold';
  // Tên phiếu trên nút (IN HOA, thống nhất — người dùng 2026-10-28)
  const docName = (mode: string) => ({ HA_VO: 'PHIẾU EEIR HẠ VỎ', CAP_VO: 'PHIẾU EEIR CẤP VỎ', NHAP_TAU: 'PHIẾU EEIR NHẬP TÀU', XUAT_TAU: 'PHIẾU EEIR XUẤT TÀU' } as Record<string, string>)[mode] || mode;
  const printedBefore = pack ? pack.receipts.filter((r) => (r.printLog?.length || 0) > 0) : [];
  const printed = pack ? slipPrintCount(pack.receipts) : 0;
  return (
    <div className="space-y-2 border-t border-line px-5 py-3 text-xs">
      {packs.map((p) => {
        const op = p.ticket.operationMode === 'CAP_VO' ? 'CẤP VỎ' : 'HẠ VỎ';
        return (
          <div key={p.ticket.ticketCode} className="flex flex-wrap items-center justify-end gap-2">
            <span className="mr-auto font-semibold text-ink">
              {op} — <span className="font-mono">{p.dossierCode}</span>
              {p.receipts.length > 0 && <span className="text-ink-muted"> • đã in phiếu trả khách {slipPrintCount(p.receipts)} lần</span>}
            </span>
            <button type="button" onClick={() => setView({ kind: 'ticket', id: p.ticket.ticketCode })} className={`${btn} border border-line-strong text-ink hover:bg-canvas`}>
              <Eye className="h-4 w-4" />
              {docName(p.ticket.operationMode)}
            </button>
            <button type="button" onClick={() => setView({ kind: 'slip', id: p.ticket.ticketCode })} className={`${btn} bg-navy-900 text-white hover:bg-navy-700`}>
              <Eye className="h-4 w-4" />
              PHIẾU TRẢ KHÁCH HÀNG
            </button>
          </div>
        );
      })}
      {vessel.map((v) => {
        const op = v.list.mode === 'NHAP_TAU' ? 'NHẬP TÀU' : 'XUẤT TÀU';
        const ready = vesselReady(v);
        // DEC-168: cont xuất tàu nhưng không xuất được (Không kịp) → mộc đỏ KHÔNG XUẤT TÀU, không mở phiếu
        const notExported = v.list.mode === 'XUAT_TAU' && v.item.status === 'SKIPPED';
        return (
          <div key={v.item.id} className="flex flex-wrap items-center justify-end gap-2">
            <span className="mr-auto font-semibold text-ink">
              {op} — <span className="font-mono">{v.item.dossierCode}</span> • tàu {v.list.vesselName}
            </span>
            {notExported && (
              <span className="-rotate-6 rounded border-2 border-rose-600 px-2 py-0.5 text-xs font-extrabold tracking-wider text-rose-600">KHÔNG XUẤT TÀU</span>
            )}
            <button
              type="button"
              disabled={!ready}
              title={ready ? '' : v.list.mode === 'NHAP_TAU' ? 'Chờ Giám định xác nhận cont' : 'Cont không xuất tàu'}
              onClick={() => setView({ kind: 'vessel', id: v.item.id })}
              className={`${btn} border border-line-strong text-ink hover:bg-canvas disabled:cursor-not-allowed disabled:opacity-40`}
            >
              <Eye className="h-4 w-4" />
              {docName(v.list.mode)}
            </button>
          </div>
        );
      })}

      {pack && view?.kind === 'ticket' && (
        <PrintPreviewModal
          title={`${docName(pack.ticket.operationMode)} — ${pack.dossierCode}`}
          onClose={close}
          actions={
            <button type="button" onClick={() => setTimeout(printNow, 50)} className={`${btn} bg-navy-900 text-white hover:bg-navy-700`}>
              <Printer className="h-4 w-4" />
              IN {docName(pack.ticket.operationMode)}
            </button>
          }
          print={<EeirK80Sheet state={state} ticket={pack.ticket} />}
        >
          <EeirK80Sheet state={state} ticket={pack.ticket} />
        </PrintPreviewModal>
      )}
      {pack && view?.kind === 'slip' && (
        <PrintPreviewModal
          title={`PHIẾU TRẢ KHÁCH HÀNG ${pack.ticket.operationMode === 'CAP_VO' ? 'CẤP VỎ' : 'HẠ VỎ'} — ${pack.dossierCode}`}
          onClose={close}
          actions={
            confirmReprint ? (
              <span className="inline-flex flex-wrap items-center gap-2 rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-[11px] text-rose-800">
                {printedBefore.map((r) => `${r.receiptNo} đã in ${r.printLog!.length} lần (gần nhất ${formatDateTime(r.printLog![r.printLog!.length - 1].at)})`).join('; ')}. In lại?
                <button type="button" onClick={printSlip} className="rounded bg-rose-600 px-2 py-1 font-bold text-white">In lại lần {printed + 1}</button>
                <button type="button" onClick={() => setConfirmReprint(false)} className="rounded border border-line-strong bg-white px-2 py-1">Hủy</button>
              </span>
            ) : (
              <>
                {pack.receipts.length > 0 && <span className={`text-[11px] font-semibold ${printed > 0 ? 'text-rose-700' : 'text-ink-muted'}`}>Đã in: {printed} lần</span>}
                <button type="button" onClick={() => (printed > 0 ? setConfirmReprint(true) : printSlip())} className={`${btn} bg-navy-900 text-white hover:bg-navy-700`}>
                  <Printer className="h-4 w-4" />
                  {printed > 0 ? 'IN LẠI PHIẾU TRẢ KHÁCH HÀNG' : 'IN PHIẾU TRẢ KHÁCH HÀNG'}
                </button>
              </>
            )
          }
          print={<CustomerSlipK80 state={state} ticket={pack.ticket} receipts={pack.receipts} printNo={printed || undefined} />}
        >
          {error && <p className="w-full rounded-md bg-rose-50 px-3 py-2 text-rose-800">{error}</p>}
          <CustomerSlipK80 state={state} ticket={pack.ticket} receipts={pack.receipts} printNo={pack.receipts.length ? printed + 1 : undefined} />
        </PrintPreviewModal>
      )}
      {vesselHit && (
        <PrintPreviewModal
          title={`${docName(vesselHit.list.mode)} — ${vesselHit.item.dossierCode}`}
          onClose={close}
          actions={
            <button type="button" onClick={() => setTimeout(printNow, 50)} className={`${btn} bg-navy-900 text-white hover:bg-navy-700`}>
              <Printer className="h-4 w-4" />
              IN {docName(vesselHit.list.mode)}
            </button>
          }
          print={<VesselEeirPrintSheet state={state} list={vesselHit.list} item={vesselHit.item} />}
        >
          <VesselEeirPrintSheet state={state} list={vesselHit.list} item={vesselHit.item} />
        </PrintPreviewModal>
      )}
    </div>
  );
};
