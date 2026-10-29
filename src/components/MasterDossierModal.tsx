import React from 'react';
import { CheckCircle2, Clock, Eye, FileDown, FileText, Printer, ReceiptText, X } from 'lucide-react';
import { ContainerStatus, K80InternalTicket, PaymentVoucher, RECEIPT_OPERATION_LABELS, VesselList, VesselListItem } from '../types/depot';
import { DepotState, formatVnd } from '../services/depotStore';
import { formatLocation } from '../services/core';
import { paymentLabelOf, receiptOperationOf } from '../services/payments';
import { documentPackOf } from "../services/driverRoute";
import { recordReceiptPrint } from "../services/api";
import { formatDateTime } from "../services/datetime";
import { CompanyHeader, PrintPreviewModal } from "./ReceiptPrint";
import { exportPdf, printNow } from "./printNow";
import { CustomerSlipK80, EeirK80Sheet, slipPrintCount, VesselEeirPrintSheet } from './K80TicketModal';
import { findVesselItemByCode, vesselListProgress } from '../services/vessel';
import { linkCls, formatViTime, PhotoGallery } from './shared';

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

// ---------------------------------------------------------------------------
// Khối dùng chung — DEC-058: mỗi bộ phận 1 khối, nội dung bên trái, xác nhận bên phải
// ---------------------------------------------------------------------------
const Field: React.FC<{ label: string; value?: React.ReactNode; mono?: boolean }> = ({ label, value, mono }) => (
  <div>
    <dt className="text-[10px] font-semibold uppercase text-ink-muted">{label}</dt>
    <dd className={`text-xs font-semibold text-ink ${mono ? 'font-mono' : ''}`}>{value || '-'}</dd>
  </div>
);

interface ConfirmInfo {
  done: boolean;
  by?: string;
  at?: string;
  pending?: string;
}

const Confirm: React.FC<ConfirmInfo> = ({ done, by, at, pending }) =>
  done ? (
    <div className="flex items-start gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-2 text-[11px]">
      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
      <div>
        <span className="block text-[10px] font-black uppercase tracking-wide text-emerald-700">Hoàn thành</span>
        <span className="block font-semibold text-ink">{by || '-'}</span>
        <span className="font-mono text-ink-muted">{formatViTime(at)}</span>
      </div>
    </div>
  ) : (
    <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-2 text-[11px]">
      <Clock className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
      <span className="font-semibold text-amber-800">{pending || 'Đang chờ'}</span>
    </div>
  );

const Step: React.FC<{ no: number; title: string; tone?: 'default' | 'payment'; confirm: ConfirmInfo; children: React.ReactNode }> = ({
  no,
  title,
  tone = 'default',
  confirm,
  children,
}) => (
  <section
    className={`dossier-step grid grid-cols-1 gap-3 rounded-md border p-3 sm:grid-cols-[1fr_200px] ${
      tone === 'payment' ? 'border-line-strong bg-navy-50/40' : 'border-line'
    }`}
  >
    <div>
      <h4 className="mb-2 flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-ink">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-navy-900 text-[10px] text-white">{no}</span>
        {title}
      </h4>
      <div className="text-xs text-ink">{children}</div>
    </div>
    <div className="sm:border-l sm:border-line sm:pl-3">
      <Confirm {...confirm} />
    </div>
  </section>
);

const ReceiptLink: React.FC<{ label: string; target: string; onOpenReceipt?: (key: string) => void }> = ({ label, target, onOpenReceipt }) =>
  onOpenReceipt ? (
    <button type="button" onClick={() => onOpenReceipt(target)} className={`inline-flex items-center gap-1 ${linkCls}`}>
      <ReceiptText className="h-3.5 w-3.5" />
      {label}
    </button>
  ) : (
    <span className="font-mono font-bold">{label}</span>
  );

// ---------------------------------------------------------------------------
// THANH TOÁN — 1 mục riêng ngay dưới Văn phòng (DEC-058): chi phí, hình thức, trạng thái, link phiếu thu
// ---------------------------------------------------------------------------
function paymentInfo(state: DepotState, voucher?: PaymentVoucher) {
  if (!voucher) return { confirm: { done: false, pending: 'Chưa lập chứng từ' } as ConfirmInfo, status: 'Chưa lập chứng từ', receipts: [] as { no: string; target: string; note: string }[] };
  const txs = state.paymentTransactions.filter((t) => t.voucherId === voucher.id);
  const paid = txs.find((t) => t.status === 'SUCCEEDED');
  const pending = txs.find((t) => t.status === 'PENDING');
  const receipts: { no: string; target: string; note: string }[] = [];
  for (const t of txs) {
    const r = state.paymentReceipts.find((x) => x.transactionId === t.id);
    if (r) receipts.push({ no: r.receiptNo, target: r.receiptNo, note: `${RECEIPT_OPERATION_LABELS[receiptOperationOf(state, r)]} • ${formatVnd(r.amount)} • ${t.method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'}` });
  }
  if (voucher.paymentCategory === 'TTT' && voucher.masterReceiptCode) {
    const m = state.masterReceipts.find((x) => x.receiptCode === voucher.masterReceiptCode);
    const topup = m && state.paymentTransactions.find((t) => t.masterReceiptId === m.id && t.status === 'SUCCEEDED');
    const r = topup && state.paymentReceipts.find((x) => x.transactionId === topup.id);
    if (r) receipts.push({ no: r.receiptNo, target: r.receiptNo, note: `Phiếu thu gốc của Phiếu thu trả trước ${voucher.masterReceiptCode}` });
  }

  let status: string;
  let confirm: ConfirmInfo;
  if (voucher.status === 'CONFIRMED') {
    status = `ĐÃ THANH TOÁN — ${paymentLabelOf(voucher)}`;
    confirm = { done: true, by: paid?.confirmedBy || voucher.confirmedBy, at: paid?.confirmedAt || voucher.confirmedAt };
  } else if (voucher.status === 'DEFERRED') {
    status = `THANH TOÁN SAU (TTS — công nợ, chưa thu tiền): ${voucher.ttsNote || ''}`;
    confirm = { done: true, by: voucher.confirmedBy, at: voucher.confirmedAt };
  } else if (voucher.status === 'CANCELLED') {
    status = 'CHỨNG TỪ ĐÃ HỦY';
    confirm = { done: false, pending: 'Đã hủy' };
  } else if (pending) {
    status = `ĐANG CHỜ CHUYỂN KHOẢN — yêu cầu ${pending.paymentRef}`;
    receipts.push({ no: `Yêu cầu ${pending.paymentRef}`, target: pending.id, note: 'Chưa ghi nhận đã thu tiền' });
    confirm = { done: false, pending: 'Chờ ngân hàng xác nhận' };
  } else {
    status = 'CHƯA THANH TOÁN';
    confirm = { done: false, pending: 'Chờ thanh toán' };
  }
  return { status, confirm, receipts };
}

const PaymentBody: React.FC<{ state: DepotState; voucher?: PaymentVoucher; onOpenReceipt?: (key: string) => void }> = ({ state, voucher, onOpenReceipt }) => {
  if (!voucher) return <p className="text-ink-muted">Chưa lập chứng từ chi phí.</p>;
  const info = paymentInfo(state, voucher);
  const paidTone = voucher.status === 'CONFIRMED' ? 'text-emerald-700' : voucher.status === 'DEFERRED' ? 'text-violet-700' : 'text-amber-700';
  return (
    <div className="space-y-2">
      {voucher.feeLines && voucher.feeLines.length > 0 && (
        <table className="w-full text-xs">
          <tbody className="divide-y divide-line">
            {voucher.feeLines.map((l) => (
              <tr key={l.id}>
                <td className="py-1 pr-2">{l.name}</td>
                <td className="py-1 text-right font-mono">{formatVnd(l.amountInclVat)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Field label="Tổng (đã gồm VAT)" value={formatVnd(voucher.amount)} mono />
        <Field label="Bên thanh toán" value={voucher.payerName} />
      </dl>
      <p className={`font-black ${paidTone}`}>{info.status}</p>
      {info.receipts.length > 0 && (
        <ul className="space-y-1">
          {info.receipts.map((r) => (
            <li key={r.target} className="flex flex-wrap items-center gap-2">
              <ReceiptLink label={r.no.startsWith('Yêu cầu') ? r.no : `Phiếu thu ${r.no}`} target={r.target} onOpenReceipt={onOpenReceipt} />
              <span className="text-[11px] text-ink-muted">{r.note}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// HỒ SƠ CONTAINER (DEC-058): thông tin container ở đầu → các bộ phận theo thứ tự tác nghiệp
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

  // DEC-069: mã XT- → lượt lưu bãi của container đã xuất tàu; mã NT- là hồ sơ lượt lưu bãi
  const vesselHit = findVesselItemByCode(state, masterDossierCode);
  const xtContainer = vesselHit?.list.mode === 'XUAT_TAU' ? state.containers.find((c) => c.id === vesselHit.item.containerId) : undefined;
  const outMatch = state.gateOutOrders.find((o) => o.gateOutCode === masterDossierCode);
  const visitCode = outMatch?.masterDossierCode || xtContainer?.masterDossierCode || masterDossierCode;
  const importHit = visitCode.startsWith('NT-') ? findVesselItemByCode(state, visitCode) : undefined;
  const gateIn = state.gateInOrders.find((o) => o.masterDossierCode === visitCode || o.orderCode === visitCode);
  const container = state.containers.find((c) => c.masterDossierCode === visitCode);
  const outOrders = state.gateOutOrders.filter((o) => o.masterDossierCode === visitCode);
  const workOrders = state.workOrders.filter((w) => w.masterDossierCode === visitCode);
  const locations = state.locationHistory.filter((l) => l.masterDossierCode === visitCode);
  const tickets = state.k80Tickets.filter((t) => t.masterDossierCode === visitCode);
  const exportHits = (state.vesselLists || [])
    .filter((l) => l.mode === 'XUAT_TAU')
    .flatMap((list) => list.items.filter((i) => container && i.containerId === container.id).map((item) => ({ list, item })));

  if (!gateIn && !container && outOrders.length === 0 && !importHit) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
        <div className="w-full max-w-sm rounded-lg bg-white p-5 text-center text-xs">
          <p className="mb-3">Không tìm thấy hồ sơ <span className="font-mono font-bold">{masterDossierCode}</span>.</p>
          <button type="button" onClick={onClose} className="rounded-md border border-line-strong px-3 py-1.5 font-semibold">Đóng</button>
        </div>
      </div>
    );
  }

  const inVoucher = gateIn?.voucherId
    ? state.vouchers.find((v) => v.id === gateIn.voucherId)
    : state.vouchers.find((v) => v.masterDossierCode === visitCode && v.serviceType === 'GATE_IN');
  const containerNo = container?.containerNo || gateIn?.containerNo || outMatch?.containerNo;
  const cleaningItems = container?.cleaningItems || gateIn?.cleaningItems || [];
  const requiresCleaning = cleaningItems.some((i) => i !== 'KHÔNG VỆ SINH');
  const cleaningWo = workOrders.find((w) => w.category === 'CLEANING');
  const inspectionWo = workOrders.find((w) => w.category === 'INSPECTION');
  const repairWo = workOrders.find((w) => w.category === 'REPAIR');
  const placement = [...locations].reverse().find((l) => l.actionType === 'INITIAL_BLOCK');
  const moves = [...locations].reverse().filter((l) => l.actionType !== 'INITIAL_BLOCK' && l.actionType !== 'GATE_OUT_CLEAR');
  const activeOut = outOrders.find((o) => o.status !== 'CANCELLED');
  const isDamageFlow = Boolean(inspectionWo || repairWo || gateIn?.conditionClass === 'DAMAGE');

  let n = 0;
  const next = () => ++n;

  // Các bước sau khi cont vào bãi — dùng chung HẠ VỎ và NHẬP TÀU (DEC-069)
  const renderYardSteps = () => (
    <>
      {requiresCleaning && (
        <Step
          no={next()}
          title="Vệ sinh"
          confirm={{
            done: cleaningWo?.workStatus === 'COMPLETED',
            by: cleaningWo?.completedBy,
            at: cleaningWo?.completedAt,
            pending: 'Chờ vệ sinh',
          }}
        >
          Hạng mục: <strong>{cleaningItems.join(' + ')}</strong>
          {cleaningWo?.resultNotes && <p className="text-ink-muted">{cleaningWo.resultNotes}</p>}
        </Step>
      )}
      
      <Step
        no={next()}
        title="Xe nâng — Hạ vỏ"
        confirm={{ done: Boolean(placement), by: placement?.performedBy, at: placement?.performedAt, pending: 'Chờ hạ vỏ' }}
      >
        {placement ? (
          <p>Hạ vỏ vào <strong className="font-mono">{placement.toLocation}</strong></p>
        ) : (
          <p className="text-ink-muted">Chưa hạ vỏ.</p>
        )}
        {moves.length > 0 && (
          <ul className="mt-1.5 space-y-0.5 border-t border-line pt-1.5 text-[11px]">
            {moves.map((l) => (
              <li key={l.id} className="flex flex-wrap justify-between gap-2">
                <span>
                  <strong>{l.actionType === 'YARD_SHIFT' ? 'ĐẢO CHUYỂN' : l.actionType}</strong>{' '}
                  <span className="font-mono">{l.fromLocation} → {l.toLocation}</span>
                </span>
                <span className="text-ink-muted">{l.performedBy} • {formatViTime(l.performedAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Step>
      
      {isDamageFlow && (
        <Step
          no={next()}
          title="Báo giá"
          confirm={{
            done: Boolean(repairWo),
            by: repairWo?.approvedBy,
            at: repairWo?.createdAt,
            pending: inspectionWo?.workStatus === 'CANCELLED' ? 'Đóng khi cấp vỏ DAMAGE' : 'Chờ báo giá',
          }}
        >
          {repairWo ? (
            <p>
              Remark sửa chữa: <strong>{repairWo.items.join(', ')}</strong> • Giờ công: <strong>{repairWo.laborHours ?? '-'}</strong>
              {repairWo.estimateCost > 0 && <> • <strong className="font-mono">{formatVnd(repairWo.estimateCost)}</strong></>}
            </p>
          ) : (
            <p>Hư hỏng ghi nhận: <strong>{(inspectionWo?.items || (gateIn?.damageRemarks || container?.damageRemarks || [])).join(', ') || '-'}</strong></p>
          )}
        </Step>
      )}
      
      {repairWo && (
        <Step
          no={next()}
          title="Sửa chữa"
          confirm={{
            done: repairWo.workStatus === 'COMPLETED',
            by: repairWo.completedBy,
            at: repairWo.completedAt,
            pending: repairWo.workStatus === 'CANCELLED' ? 'Đóng khi cấp vỏ DAMAGE' : 'Chờ sửa chữa',
          }}
        >
          {repairWo.repairTeamName ? (
            <p>Tổ: <strong>{repairWo.repairTeamName}</strong> — {(repairWo.repairMembers || []).join(', ')}</p>
          ) : (
            <p className="text-ink-muted">Chưa sửa.</p>
          )}
          {/* DEC-176: ảnh HOÀN THÀNH SỬA CHỮA — bấm XEM ẢNH mới tải (DEC-178) */}
          {repairWo.repairPhotos && repairWo.repairPhotos.length > 0 && (
            <div className="mt-2" data-testid="repair-photo-list">
              <p className="mb-1 text-ink-muted">Ảnh hoàn thành sửa chữa ({repairWo.repairPhotos.length})</p>
              <PhotoGallery photos={repairWo.repairPhotos} alt="Ảnh hoàn thành sửa chữa" className="h-16 w-16" />
            </div>
          )}
        </Step>
      )}
    </>
  );

  // Nội dung hồ sơ — dùng chung cho màn hình và bản in A4
  const content = (
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
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Đóng hồ sơ" className="no-print rounded-md border border-white/30 p-1.5 text-white hover:bg-white/10">
              <X className="h-4 w-4" />
            </button>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-white/20 pt-3 text-xs sm:grid-cols-4 [&_dd]:text-white [&_dt]:text-slate-300">
            <Field label="Size / Type" value={`${container?.size || gateIn?.size || '-'} / ${container?.type || gateIn?.type || '-'}`} />
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

          {/* ===================== HẠ VỎ ===================== */}
          {gateIn && (
            <>
              <h3 className="pt-1 text-xs font-black uppercase tracking-wider text-ink-muted">Tác nghiệp HẠ VỎ — {visitCode}</h3>
              <Step no={next()} title="Giám định — Hạ vỏ" confirm={{ done: true, by: gateIn.fieldStaffName, at: gateIn.fieldRecordedAt }}>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <div className="shrink-0 sm:w-36"><PhotoGallery photos={[gateIn.doorPhotoUrl]} alt="Ảnh cửa container" className="h-24 w-full sm:w-36" /></div>
                  <dl className="grid flex-1 grid-cols-2 gap-2">
                    <Field label="Trạng thái" value={`${gateIn.conditionClass}${gateIn.damageRemarks.length ? ` — ${gateIn.damageRemarks.join(', ')}` : ''}`} />
                    <Field label="Đóng hàng" value={gateIn.stuffingClass} />
                    <Field label="Vệ sinh" value={gateIn.cleaningItems.join(' + ')} />
                    <Field label="AGE" value={gateIn.manufactureYear} />
                  </dl>
                </div>
              </Step>

              <Step
                no={next()}
                title="Văn phòng — Hạ vỏ"
                confirm={{ done: Boolean(gateIn.officeVerifiedAt), by: gateIn.officeStaffName, at: gateIn.officeVerifiedAt, pending: 'Chờ văn phòng' }}
              >
                <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Field label="Khách hàng" value={gateIn.customerRep} />
                  <Field label="Hãng tàu" value={gateIn.shippingLineCode} />
                  <Field label="Số lệnh / chứng từ" value={gateIn.orderDocNo} mono />
                  <Field label="Số xe" value={gateIn.truckNo} />
                  <Field label="SĐT lái xe" value={gateIn.driverPhone} />
                  <Field label="GATE IN OK" value={gateIn.gateInOkAt ? `${formatViTime(gateIn.gateInOkAt)} • ${gateIn.gateInOkBy}` : '-'} />
                </dl>
              </Step>

              <Step no={next()} title="Thanh toán — Hạ vỏ" tone="payment" confirm={paymentInfo(state, inVoucher).confirm}>
                <PaymentBody state={state} voucher={inVoucher} onOpenReceipt={onOpenReceipt} />
              </Step>

              {renderYardSteps()}

              <Step
                no={next()}
                title="Văn phòng — Trả chứng từ Hạ vỏ"
                confirm={{ done: Boolean(gateIn.documentsReturnedAt), by: gateIn.documentsReturnedBy, at: gateIn.documentsReturnedAt, pending: 'Chờ lái xe quay về' }}
              >
                <p>Lái xe quét mã tại Văn phòng → in Phiếu EEIR (K80) {inVoucher && paymentInfo(state, inVoucher).receipts.length ? '+ Phiếu thu (K80)' : ''}.</p>
              </Step>
            </>
          )}

          {/* ===================== NHẬP TÀU (DEC-069) ===================== */}
          {importHit && (
            <>
              <h3 className="pt-1 text-xs font-black uppercase tracking-wider text-ink-muted">Tác nghiệp NHẬP TÀU — {visitCode}</h3>
              <Step no={next()} title="Văn phòng — Lập danh sách nhập tàu" confirm={{ done: true, by: importHit.list.createdBy, at: importHit.list.createdAt }}>
                <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Field label="Tên tàu" value={importHit.list.vesselName} />
                  <Field label="Thời gian nhập tàu" value={formatViTime(importHit.list.plannedAt)} mono />
                  <Field label="Hãng tàu" value={importHit.list.shippingLineCode} />
                  <Field label="Số xe" value={importHit.item.truckNo} />
                </dl>
              </Step>
              <Step no={next()} title="Giám định — Nhập tàu" confirm={{ done: Boolean(importHit.item.inspectedAt), by: importHit.item.inspectedBy, at: importHit.item.inspectedAt, pending: 'Chờ xe về' }}>
                <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Field label="Trạng thái" value={`${importHit.item.conditionClass || '-'}${importHit.item.damageRemarks?.length ? ` — ${importHit.item.damageRemarks.join(', ')}` : ''}`} />
                  <Field label="Đóng hàng" value={importHit.item.stuffingClass} />
                  <Field label="Vệ sinh" value={(importHit.item.cleaningItems || []).join(' + ')} />
                  <Field label="AGE" value={importHit.item.manufactureYear} />
                </dl>
              </Step>
              {renderYardSteps()}
              <Step
                no={next()}
                title="Văn phòng — Duyệt nhập tàu"
                confirm={{ done: importHit.list.status === 'APPROVED', by: importHit.list.approvedBy, at: importHit.list.approvedAt, pending: 'Chờ nhập hết danh sách' }}
              >
                <p>Duyệt cả danh sách tàu <strong>{importHit.list.vesselName}</strong> khi đã nhập hết. Không thu phí, không phiếu EEIR (K80).</p>
              </Step>
            </>
          )}

          {/* ===================== CẤP VỎ ===================== */}
          {outOrders.map((o) => {
            const v = state.vouchers.find((x) => x.id === o.voucherId);
            if (o.status === 'CANCELLED') {
              return (
                <p key={o.id} className="rounded-md border border-line bg-canvas px-3 py-2 text-[11px] text-ink-muted">
                  Lệnh cấp <span className="font-mono">{o.gateOutCode}</span> (booking {o.bookingNo}) đã hủy lúc {formatViTime(o.cancelledAt)} — {o.cancelReason}
                </p>
              );
            }
            return (
              <React.Fragment key={o.id}>
                <h3 className="pt-2 text-xs font-black uppercase tracking-wider text-ink-muted">Tác nghiệp CẤP VỎ — {o.gateOutCode}</h3>
                <Step no={next()} title="Văn phòng — Cấp vỏ" confirm={{ done: true, by: o.createdBy, at: o.createdAt }}>
                  <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Field label="Booking" value={o.bookingNo} mono />
                    <Field label="Khách hàng" value={o.receiverRep} />
                    <Field label="Số xe" value={o.truckNo} />
                    <Field label="SĐT lái xe" value={o.driverPhone} />
                  </dl>
                </Step>
                <Step no={next()} title="Thanh toán — Cấp vỏ" tone="payment" confirm={paymentInfo(state, v).confirm}>
                  <PaymentBody state={state} voucher={v} onOpenReceipt={onOpenReceipt} />
                </Step>
                <Step
                  no={next()}
                  title="Xe nâng — Cấp vỏ"
                  confirm={{ done: o.status === 'GATE_OUT_OK', by: o.confirmedBy, at: o.confirmedAt, pending: o.status === 'PAYMENT_PENDING' ? 'Chờ thanh toán' : 'Chờ xe nâng' }}
                >
                  {o.status === 'GATE_OUT_OK' ? <p>Đã OUT khỏi bãi • xe <strong>{o.truckNo}</strong></p> : <p className="text-ink-muted">Chưa OUT.</p>}
                </Step>
                <Step
                  no={next()}
                  title="Văn phòng — Trả chứng từ Cấp vỏ"
                  confirm={{ done: Boolean(o.documentsReturnedAt), by: o.documentsReturnedBy, at: o.documentsReturnedAt, pending: 'Chờ lái xe quay về' }}
                >
                  <p>Lái xe quét mã tại Văn phòng → in Phiếu EEIR (K80) {v && paymentInfo(state, v).receipts.length ? '+ Phiếu thu (K80)' : ''}.</p>
                </Step>
              </React.Fragment>
            );
          })}

          {/* ===================== XUẤT TÀU (DEC-069) ===================== */}
          {exportHits.map(({ list, item }) => (
            <React.Fragment key={item.id}>
              <h3 className="pt-2 text-xs font-black uppercase tracking-wider text-ink-muted">Tác nghiệp XUẤT TÀU — {item.dossierCode}</h3>
              <Step no={next()} title="Văn phòng — Lập danh sách xuất tàu" confirm={{ done: true, by: list.createdBy, at: list.createdAt }}>
                <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Field label="Tên tàu" value={list.vesselName} />
                  <Field label="Thời gian xuất tàu" value={formatViTime(list.plannedAt)} mono />
                  <Field label="Vị trí lúc lập" value={item.locationAtList} mono />
                  <Field label="Xe trong danh sách" value={list.truckNos.join(', ')} />
                </dl>
              </Step>
              <Step no={next()} title="Giám định / Xe nâng — Xuất tàu" confirm={{ done: item.status === 'DONE', by: item.doneBy, at: item.doneAt, pending: 'Chờ xuất tàu' }}>
                {item.status === 'DONE' ? <p>Đã OUT khỏi bãi • xe <strong>{item.truckNo}</strong></p> : <p className="text-ink-muted">Chưa xuất.</p>}
              </Step>
              <Step no={next()} title="Văn phòng — Duyệt xuất tàu" confirm={{ done: list.status === 'APPROVED', by: list.approvedBy, at: list.approvedAt, pending: 'Chờ xuất hết danh sách' }}>
                {/* DEC-169: nội dung duyệt xuất tàu + tiến độ thực tế (cont đã xuất / tổng danh sách) */}
                <p>Xác nhận hoàn thành danh sách xuất tàu <strong>{list.vesselName}</strong></p>
                <p>Tiến độ thực tế : <strong className="font-mono">{vesselListProgress(list).done}/{vesselListProgress(list).total}</strong></p>
              </Step>
            </React.Fragment>
          ))}
        </div>
    </>
  );

  // Bản HỒ SƠ CONTAINER khổ A4 (xem trước + in / xuất PDF)
  const dossierA4 = (
    <div className="dossier-a4 space-y-3 bg-white text-ink">
      <CompanyHeader company={state.companyProfile} title="HỒ SƠ CONTAINER" subtitle={<p className="text-[11px]">Toàn bộ hồ sơ tới thời điểm in • In lúc {formatDateTime(new Date())}</p>} />
      {content}
    </div>
  );

  return (
    // DEC-080: hồ sơ mở dạng cửa sổ trượt bên phải (giống chi tiết các danh sách); bấm ra ngoài / Esc để đóng
    <div className="fixed inset-0 z-50 flex justify-end bg-navy-900/30" role="dialog" aria-modal="true" aria-label="Hồ sơ container" onClick={onClose}>
      <div className="h-full w-full overflow-y-auto bg-white shadow-2xl sm:w-[min(960px,80vw)]" onClick={(e) => e.stopPropagation()}>
        {content}

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
