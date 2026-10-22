import React from 'react';
import { CheckCircle2, Clock, Printer, QrCode, X } from 'lucide-react';
import { ContainerStatus, FeeLineItem, GateOutOrder, K80InternalTicket, PaymentVoucher } from '../types/depot';
import { DepotState, formatVnd } from '../services/depotStore';
import { formatLocation } from '../services/core';
import { paymentLabelOf } from '../services/payments';
import { formatViTime } from './shared';

interface Props {
  masterDossierCode: string | null; // Mã hồ sơ HẠ VỎ (IN-...) hoặc CẤP VỎ (OUT-...)
  state: DepotState;
  onClose: () => void;
  onOpenK80Ticket?: (ticket: K80InternalTicket) => void;
}

const CONTAINER_STATUS: Record<ContainerStatus, string> = {
  PENDING_GATE_IN: 'Đang làm thủ tục hạ vỏ',
  WAITING_PLACEMENT: 'Chờ hạ vỏ',
  IN_YARD: 'Đang tồn bãi',
  ALLOCATED: 'Đã lập lệnh cấp',
  GATED_OUT: 'Đã OUT',
};

const OUT_STATUS: Record<GateOutOrder['status'], string> = {
  PAYMENT_PENDING: 'Chờ thanh toán',
  PENDING_FORKLIFT: 'Chờ xe nâng',
  GATE_OUT_OK: 'Đã OUT',
  CANCELLED: 'Đã hủy',
};

const Field: React.FC<{ label: string; value?: React.ReactNode; mono?: boolean }> = ({ label, value, mono }) => (
  <div>
    <dt className="text-[10px] font-semibold uppercase text-slate-500">{label}</dt>
    <dd className={`text-xs font-semibold text-slate-900 ${mono ? 'font-mono' : ''}`}>{value || '-'}</dd>
  </div>
);

const Confirm: React.FC<{ done: boolean; by?: string; at?: string; pending?: string }> = ({ done, by, at, pending }) => (
  <div className="flex items-start gap-2 text-[11px]">
    {done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <Clock className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />}
    <div>
      {done ? (
        <>
          <span className="block font-semibold text-slate-900">{by || '-'}</span>
          <span className="text-slate-500">{formatViTime(at)}</span>
        </>
      ) : (
        <span className="text-amber-700">{pending || 'Đang chờ'}</span>
      )}
    </div>
  </div>
);

const Dept: React.FC<{ title: string; confirm: React.ReactNode; children: React.ReactNode }> = ({ title, confirm, children }) => (
  <section className="grid grid-cols-1 gap-3 border-b border-slate-200 py-3 last:border-0 sm:grid-cols-[1fr_190px]">
    <div>
      <h4 className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-700">{title}</h4>
      <div className="text-xs text-slate-700">{children}</div>
    </div>
    <div className="sm:border-l sm:border-slate-100 sm:pl-3">{confirm}</div>
  </section>
);

const FeeTable: React.FC<{ lines?: FeeLineItem[]; voucher?: PaymentVoucher }> = ({ lines, voucher }) => {
  if (!voucher && !lines?.length) return <p className="text-slate-500">Chưa lập chứng từ chi phí.</p>;
  return (
    <div className="space-y-1">
      {lines && lines.length > 0 && (
        <table className="w-full text-xs">
          <tbody className="divide-y divide-slate-100">
            {lines.map((l) => (
              <tr key={l.id}>
                <td className="py-1 pr-2 text-slate-700">{l.name}</td>
                <td className="py-1 text-right font-mono">{formatVnd(l.amountInclVat)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {voucher && (
        <p className="text-[11px] text-slate-600">
          Chứng từ <span className="font-mono">{voucher.voucherNo}</span> • Tổng <strong className="font-mono">{formatVnd(voucher.amount)}</strong> •{' '}
          {voucher.status === 'PENDING' ? 'Chờ thanh toán' : voucher.status === 'CANCELLED' ? 'Đã hủy' : paymentLabelOf(voucher)}
        </p>
      )}
    </div>
  );
};

export const MasterDossierModal: React.FC<Props> = ({ masterDossierCode, state, onClose, onOpenK80Ticket }) => {
  if (!masterDossierCode) return null;

  const outMatch = state.gateOutOrders.find((o) => o.gateOutCode === masterDossierCode);
  const visitCode = outMatch?.masterDossierCode || masterDossierCode;

  const gateIn = state.gateInOrders.find((o) => o.masterDossierCode === visitCode || o.orderCode === visitCode);
  const container = state.containers.find((c) => c.masterDossierCode === visitCode);
  const outOrders = state.gateOutOrders.filter((o) => o.masterDossierCode === visitCode);
  const workOrders = state.workOrders.filter((w) => w.masterDossierCode === visitCode);
  const locations = state.locationHistory.filter((l) => l.masterDossierCode === visitCode);
  const inVoucher = gateIn?.voucherId
    ? state.vouchers.find((v) => v.id === gateIn.voucherId)
    : state.vouchers.find((v) => v.masterDossierCode === visitCode && v.serviceType === 'GATE_IN');
  const dossierCodes = new Set([visitCode, ...outOrders.map((o) => o.gateOutCode)]);
  const receipts = state.paymentReceipts.filter((r) => r.dossierCode && dossierCodes.has(r.dossierCode));
  const tickets = state.k80Tickets.filter((t) => t.masterDossierCode === visitCode);

  if (!gateIn && !container && outOrders.length === 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true">
        <div className="w-full max-w-sm rounded-lg bg-white p-5 text-center text-xs">
          <p className="mb-3">Không tìm thấy hồ sơ <span className="font-mono font-bold">{masterDossierCode}</span>.</p>
          <button type="button" onClick={onClose} className="rounded-md border border-slate-300 px-3 py-1.5 font-semibold">Đóng</button>
        </div>
      </div>
    );
  }

  const containerNo = container?.containerNo || gateIn?.containerNo || outMatch?.containerNo;
  const conditionClass = container?.conditionClass || gateIn?.conditionClass;
  const stuffingClass = container?.stuffingClass || gateIn?.stuffingClass;
  const cleaningItems = container?.cleaningItems || gateIn?.cleaningItems || [];
  const requiresCleaning = cleaningItems.some((i) => i !== 'KHÔNG VỆ SINH');
  const cleaningWo = workOrders.find((w) => w.category === 'CLEANING');
  const inspectionWo = workOrders.find((w) => w.category === 'INSPECTION');
  const repairWo = workOrders.find((w) => w.category === 'REPAIR');
  const placement = [...locations].reverse().find((l) => l.actionType === 'INITIAL_BLOCK');
  const activeOut = outOrders.find((o) => o.status !== 'CANCELLED');
  const latestTicket = tickets[0];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-2 sm:p-4" role="dialog" aria-modal="true" aria-label="Hồ sơ container">
      <div className="my-4 w-full max-w-4xl rounded-lg border border-slate-300 bg-white shadow-xl">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-3">
          <div>
            <p className="text-[11px] font-semibold uppercase text-slate-500">Hồ sơ container</p>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-lg font-bold text-slate-900">{containerNo || 'Chưa có số container'}</span>
              <span className="rounded border border-slate-300 px-1.5 py-0.5 font-mono text-[11px]">{visitCode}</span>
              {activeOut && <span className="rounded border border-slate-300 px-1.5 py-0.5 font-mono text-[11px]">{activeOut.gateOutCode}</span>}
              {container && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700">{CONTAINER_STATUS[container.status]}</span>}
              {container?.isOnHold && <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold text-rose-700">Đang khóa: {container.holdReason}</span>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Đóng hồ sơ" className="rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-50">
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="space-y-4 px-5 py-4">
          <dl className="grid grid-cols-1 gap-4 rounded-md border border-slate-200 p-3 sm:grid-cols-3">
            <div className="grid grid-cols-2 gap-2">
              <p className="col-span-2 text-[10px] font-bold uppercase text-slate-400">A. Nhận diện</p>
              <Field label="Số container" value={containerNo} mono />
              <Field label="Hãng tàu" value={container?.shippingLineCode || gateIn?.shippingLineCode} />
              <Field label="Size" value={container?.size || gateIn?.size} />
              <Field label="Type" value={container?.type || gateIn?.type} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <p className="col-span-2 text-[10px] font-bold uppercase text-slate-400">B. Tình trạng</p>
              <Field label="Trạng thái" value={conditionClass} />
              <Field label="Phân loại đóng hàng" value={stuffingClass} />
              <Field label="AGE" value={container?.manufactureYear || gateIn?.manufactureYear} />
              <Field label="Vị trí" value={container ? formatLocation(container) : '-'} mono />
            </div>
            <div className="grid grid-cols-1 gap-2">
              <p className="text-[10px] font-bold uppercase text-slate-400">C. Khách hàng & vận tải (Hạ vỏ)</p>
              <Field label="Khách hàng" value={gateIn?.customerRep || container?.customerRep} />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Thông tin vận tải" value={gateIn?.truckNo || container?.truckNo} />
                <Field label="SĐT vận tải" value={gateIn?.driverPhone || container?.driverPhone} />
              </div>
            </div>
          </dl>

          {container?.officeNote && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <strong>Ghi chú văn phòng:</strong> {container.officeNote}
              {container.officeNoteUpdatedBy && <span className="text-amber-700"> — {container.officeNoteUpdatedBy}, {formatViTime(container.officeNoteUpdatedAt)}</span>}
            </p>
          )}

          <div>
            {gateIn && (
              <Dept title="Giám định — Hạ vỏ" confirm={<Confirm done by={gateIn.fieldStaffName} at={gateIn.fieldRecordedAt} />}>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <img src={gateIn.doorPhotoUrl} alt="Ảnh cửa container" className="h-24 w-full rounded border border-slate-200 object-cover sm:w-36" />
                  <dl className="grid flex-1 grid-cols-2 gap-2">
                    <Field label="Trạng thái" value={`${gateIn.conditionClass}${gateIn.damageRemarks.length ? ` — ${gateIn.damageRemarks.join(', ')}` : ''}`} />
                    <Field label="Đóng hàng" value={gateIn.stuffingClass} />
                    <Field label="Vệ sinh" value={gateIn.cleaningItems.join(' + ')} />
                    <Field label="AGE" value={gateIn.manufactureYear} />
                  </dl>
                </div>
              </Dept>
            )}

            {gateIn && (
              <Dept
                title="Văn phòng — Hạ vỏ"
                confirm={<Confirm done={gateIn.status === 'GATE_IN_OK'} by={gateIn.gateInOkBy} at={gateIn.gateInOkAt} pending={gateIn.status === 'PAYMENT_PENDING' ? 'Chờ thanh toán' : 'Chờ văn phòng'} />}
              >
                {gateIn.orderDocNo && <p className="mb-1">Số lệnh / chứng từ: <span className="font-mono">{gateIn.orderDocNo}</span></p>}
                <FeeTable lines={inVoucher?.feeLines || gateIn.feeLines} voucher={inVoucher} />
              </Dept>
            )}

            {requiresCleaning && (
              <Dept
                title="Vệ sinh"
                confirm={<Confirm done={cleaningWo?.workStatus === 'COMPLETED' || (container ? !container.needsCleaning : false)} by={cleaningWo?.completedBy} at={cleaningWo?.completedAt} pending="Chờ vệ sinh" />}
              >
                Hạng mục: <strong>{cleaningItems.join(' + ')}</strong>
                {cleaningWo?.resultNotes && <p className="text-slate-500">{cleaningWo.resultNotes}</p>}
              </Dept>
            )}

            {(container || locations.length > 0) && (
              <Dept title="Xe nâng — Vị trí bãi" confirm={<Confirm done={Boolean(placement)} by={placement?.performedBy} at={placement?.performedAt} pending="Chờ hạ vỏ" />}>
                {locations.length === 0 ? (
                  <p className="text-slate-500">Chưa có tác nghiệp vị trí.</p>
                ) : (
                  <ul className="space-y-1">
                    {locations.map((l) => (
                      <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-2 text-[11px]">
                        <span>
                          <strong>{l.actionType === 'YARD_SHIFT' ? 'ĐẢO CHUYỂN' : l.actionType === 'INITIAL_BLOCK' ? 'HẠ VỎ' : l.actionType === 'GATE_OUT_CLEAR' ? 'OUT' : l.actionType}</strong>{' '}
                          <span className="font-mono">{l.fromLocation} → {l.toLocation}</span>
                        </span>
                        <span className="text-slate-500">{l.performedBy} • {formatViTime(l.performedAt)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Dept>
            )}

            {(inspectionWo || conditionClass === 'DAMAGE' || container?.quotationAmount) && (
              <Dept
                title="Báo giá"
                confirm={<Confirm done={Boolean(repairWo) || inspectionWo?.workStatus === 'COMPLETED'} by={repairWo?.approvedBy || inspectionWo?.completedBy} at={repairWo?.createdAt || inspectionWo?.completedAt} pending={inspectionWo?.workStatus === 'CANCELLED' ? 'Đóng khi cấp vỏ DAMAGE' : 'Chờ báo giá'} />}
              >
                {repairWo ? (
                  <>Remark sửa chữa: <strong>{repairWo.items.join(', ')}</strong>{repairWo.estimateCost > 0 && <> • <strong className="font-mono">{formatVnd(repairWo.estimateCost)}</strong></>}</>
                ) : (
                  <>Hư hỏng ghi nhận: <strong>{(inspectionWo?.items || gateIn?.damageRemarks || []).join(', ') || '-'}</strong></>
                )}
              </Dept>
            )}

            {repairWo && (
              <Dept title="Sửa chữa" confirm={<Confirm done={repairWo.workStatus === 'COMPLETED'} by={repairWo.completedBy} at={repairWo.completedAt} pending={repairWo.workStatus === 'CANCELLED' ? 'Đóng khi cấp vỏ DAMAGE' : 'Chờ sửa chữa'} />}>
                <p>Remark sửa chữa: <strong>{repairWo.items.join(', ')}</strong> • Giờ công: <strong>{repairWo.laborHours ?? '-'}</strong></p>
                {repairWo.repairTeamName && (
                  <p>Tổ: <strong>{repairWo.repairTeamName}</strong> — {(repairWo.repairMembers || []).join(', ')}</p>
                )}
              </Dept>
            )}

            {outOrders.map((o) => {
              const v = state.vouchers.find((x) => x.id === o.voucherId);
              return (
                <Dept
                  key={o.id}
                  title={`Cấp vỏ — ${o.gateOutCode} (${OUT_STATUS[o.status]})`}
                  confirm={
                    <div className="space-y-2">
                      <Confirm done by={o.createdBy ? `Lập lệnh: ${o.createdBy}` : 'Lập lệnh'} at={o.createdAt} />
                      {o.status !== 'CANCELLED' && <Confirm done={o.status === 'GATE_OUT_OK'} by={o.confirmedBy ? `OUT: ${o.confirmedBy}` : undefined} at={o.confirmedAt} pending={OUT_STATUS[o.status]} />}
                    </div>
                  }
                >
                  <dl className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Field label="Booking" value={o.bookingNo} mono />
                    <Field label="Khách hàng" value={o.receiverRep} />
                    <Field label="Thông tin vận tải" value={o.truckNo} />
                    <Field label="SĐT vận tải" value={o.driverPhone} />
                  </dl>
                  {o.status === 'CANCELLED' ? <p className="text-slate-500">Lý do hủy: {o.cancelReason}</p> : <FeeTable lines={o.feeLines} voucher={v} />}
                </Dept>
              );
            })}

            {receipts.length > 0 && (
              <Dept title="Phiếu thu" confirm={<Confirm done by={receipts[0].issuedBy} at={receipts[0].issuedAt} />}>
                <ul className="space-y-0.5">
                  {receipts.map((r) => (
                    <li key={r.id} className="font-mono text-[11px]">
                      {r.receiptNo} • {formatVnd(r.amount)} • {r.method === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản'} • {r.dossierCode}
                    </li>
                  ))}
                </ul>
              </Dept>
            )}
          </div>
        </div>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-slate-200 px-5 py-3">
          {latestTicket && onOpenK80Ticket && (
            <button type="button" onClick={() => onOpenK80Ticket(latestTicket)} className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              <QrCode className="h-4 w-4" />
              In phiếu K80
            </button>
          )}
          <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-1.5 rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800">
            <Printer className="h-4 w-4" />
            In hồ sơ
          </button>
        </footer>
      </div>
    </div>
  );
};
