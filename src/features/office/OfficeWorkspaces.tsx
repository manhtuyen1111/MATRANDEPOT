import React, { useMemo, useState } from 'react';
import { ClipboardList, Search, Truck } from 'lucide-react';
import {
  ContainerRecord,
  FieldConditionClass,
  GateInOrder,
  GateOutOrder,
  K80InternalTicket,
} from '../../types/depot';
import { DepotState, formatVnd } from '../../services/depotStore';
import {
  confirmGateInPaymentAndComplete,
  confirmReleasePayment,
  createReleaseOrder,
  gateInContainerConflict,
  getBookingSummary,
  releaseAllocatedContainer,
  blockedOnlyByHold,
  releaseBlocker,
  simulateDemoBankTransfer,
  verifyGateInOfficeAndCreatePayment,
} from '../../services/depotOperations';
import { cancelPendingTransaction, pendingTransactionOf } from '../../services/payments';
import { formatLocation } from '../../services/core';
import { linkCls,
  ContainerNo,
  CustomerInput,
  EMPTY_PAYMENT,
  FeeLinesEditor,
  Feedback,
  formatViTime,
  inputCls,
  isPaymentChoiceComplete,
  labelCls,
  PaymentChoice,
  PaymentPanel,
  paymentSubmitLabel,
  PendingTransferPanel,
  primaryBtn,
  secondaryBtn,
  SectionCard,
  suggestLoloFee,
  LocationText,
} from '../../components/shared';

interface OfficeProps {
  state: DepotState;
  onUpdateState: (next: DepotState) => void;
  onOpenK80Ticket: (ticket: K80InternalTicket) => void;
  onOpenDossier?: (code: string) => void;
}

function errMsg(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

// ============================================================================
// BỘ PHẬN VĂN PHÒNG — HẠ VỎ
// ============================================================================
export const OfficeHaVoWorkspace: React.FC<OfficeProps> = ({ state, onUpdateState, onOpenK80Ticket, onOpenDossier }) => {
  const shippingLines = state.partners.filter((p) => p.isShippingLine);

  const pendingOrders = [...state.gateInOrders]
    .filter((o) => o.status !== 'GATE_IN_OK' && o.status !== 'CANCELLED')
    .sort((a, b) => b.fieldRecordedAt.localeCompare(a.fieldRecordedAt));

  const [selectedId, setSelectedId] = useState<string>(pendingOrders[0]?.id || '');
  const order: GateInOrder | undefined = pendingOrders.find((o) => o.id === selectedId) || pendingOrders[0];

  const blankForm = (o?: GateInOrder) => ({
    contNo: o?.containerNo || '',
    size: o?.size || '',
    type: o?.type || '',
    shippingLineCode: o?.shippingLineCode || '',
    customerName: o?.customerRep || '',
    orderDocNo: o?.orderDocNo || '',
    truckNo: o?.truckNo || '',
    driverPhone: o?.driverPhone || '',
  });
  const [form, setForm] = useState(blankForm(order));
  const [feeIds, setFeeIds] = useState<string[]>(
    () =>
      order?.feeLines
        ?.map((l) => state.feeCatalog.find((f) => f.code === l.catalogCode)?.id)
        .filter((x): x is string => Boolean(x)) || []
  );
  const [payment, setPayment] = useState<PaymentChoice>(EMPTY_PAYMENT);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));
  const selectOrder = (o: GateInOrder) => {
    setSelectedId(o.id);
    setForm(blankForm(o));
    setFeeIds(
      o.feeLines
        ?.map((l) => state.feeCatalog.find((f) => f.code === l.catalogCode)?.id)
        .filter((x): x is string => Boolean(x)) || []
    );
    setPayment(EMPTY_PAYMENT);
    setError(null);
    setSuccess(null);
  };

  const voucher = order?.voucherId ? state.vouchers.find((v) => v.id === order.voucherId) : undefined;
  const pendingTx = voucher ? pendingTransactionOf(state, voucher.id) : undefined;
  // DEC-060: kiểm tra Tồn vỏ ngay khi nhập số container — trùng thì chặn, không mở các bước tiếp
  const contConflict = order ? gateInContainerConflict(state, form.contNo, order.id) : null;
  const section1Done = !contConflict && Boolean(
    form.contNo.trim() && form.size && form.type && form.shippingLineCode && form.customerName && form.truckNo.trim() && form.driverPhone.trim()
  );
  const suggested = suggestLoloFee(state.feeCatalog, form.size, form.type, form.shippingLineCode)?.id;

  const openTicket = (s: DepotState, code: string) => {
    const t = s.k80Tickets.find((k) => k.masterDossierCode === code && k.operationMode === 'HA_VO');
    if (t) onOpenK80Ticket(t);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!order) return;
    setError(null);
    setSuccess(null);
    try {
      const afterVerify = verifyGateInOfficeAndCreatePayment(state, {
        gateInId: order.id,
        containerNo: form.contNo,
        size: form.size,
        type: form.type,
        truckNo: form.truckNo,
        driverPhone: form.driverPhone,
        customerName: form.customerName,
        shippingLineCode: form.shippingLineCode,
        orderDocNo: form.orderDocNo,
        feeCatalogIds: feeIds,
      });
      const next = confirmGateInPaymentAndComplete(afterVerify, { gateInId: order.id, ...payment });
      onUpdateState(next);
      const done = next.gateInOrders.find((o) => o.id === order.id);
      if (done?.status === 'GATE_IN_OK') {
        setSuccess(`GATE IN OK — ${done.containerNo} (hồ sơ ${done.masterDossierCode}). Đã mở phiếu K80.`);
        openTicket(next, done.masterDossierCode);
      } else {
        setSuccess('Đã tạo yêu cầu chuyển khoản QR. Hồ sơ hoàn tất khi ngân hàng xác nhận đã nhận tiền.');
      }
    } catch (err) {
      setError(errMsg(err, 'Lỗi xử lý Hạ vỏ'));
    }
  };

  const handleSimulate = () => {
    if (!pendingTx || !order) return;
    try {
      const next = simulateDemoBankTransfer(state, { transactionId: pendingTx.id });
      onUpdateState(next);
      setSuccess('Ngân hàng (giả lập) đã xác nhận — GATE IN OK.');
      openTicket(next, order.masterDossierCode);
    } catch (err) {
      setError(errMsg(err, 'Lỗi giả lập ngân hàng'));
    }
  };

  const handleCancelTransfer = (reason: string) => {
    if (!pendingTx) return;
    try {
      onUpdateState(cancelPendingTransaction(state, { transactionId: pendingTx.id, reason }));
      setSuccess('Đã hủy yêu cầu chuyển khoản. Có thể chọn lại hình thức thanh toán.');
    } catch (err) {
      setError(errMsg(err, 'Lỗi hủy yêu cầu'));
    }
  };

  return (
    <div className="space-y-4">
      <Feedback error={error} success={success} onClose={() => (setError(null), setSuccess(null))} />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <SectionCard
          className="lg:col-span-4"
          title="Hàng chờ Văn phòng — Hạ vỏ"
          icon={<ClipboardList className="h-4 w-4 text-slate-500" />}
          right={<span className="rounded bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-white">{pendingOrders.length}</span>}
        >
          {pendingOrders.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">Không có hồ sơ nào đang chờ.</p>
          ) : (
            <ul className="space-y-1.5">
              {pendingOrders.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => selectOrder(o)}
                    className={`flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-xs ${
                      order?.id === o.id ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span>
                      <span className="block font-mono font-bold text-slate-900">{o.masterDossierCode}</span>
                      <span className="text-[11px] text-slate-500">{formatViTime(o.fieldRecordedAt)}</span>
                    </span>
                    <span className="text-right">
                      <span className={`block font-bold ${o.conditionClass === 'DAMAGE' ? 'text-rose-700' : 'text-emerald-700'}`}>
                        {o.conditionClass}
                      </span>
                      {o.toInspectionRack && <span className="block text-[10px] font-bold text-amber-700">HẠ KỆ GĐ</span>}
                      {o.status === 'PAYMENT_PENDING' && <span className="text-[10px] text-amber-700">Chờ thanh toán</span>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <div className="space-y-4 lg:col-span-8">
          {!order ? (
            <div className="rounded-lg border border-slate-200 bg-white py-12 text-center text-xs text-slate-500">
              Tất cả hồ sơ Hạ vỏ đã được xử lý.
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <SectionCard
                title={
                  <button type="button" onClick={() => onOpenDossier?.(order.masterDossierCode)} className={linkCls}>
                    Hồ sơ {order.masterDossierCode}
                  </button>
                }
                right={<span className="text-[11px] text-slate-500">Giám định: {order.fieldStaffName}</span>}
              >
                <div className="flex flex-col gap-3 sm:flex-row">
                  <img src={order.doorPhotoUrl} alt="Ảnh cửa container" className="h-28 w-full rounded-md border border-slate-200 object-cover sm:w-44" />
                  <dl className="grid flex-1 grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                    <dt className="text-slate-500">Trạng thái</dt>
                    <dd className={`font-bold ${order.conditionClass === 'DAMAGE' ? 'text-rose-700' : 'text-emerald-700'}`}>
                      {order.conditionClass}
                      {order.damageRemarks.length > 0 && <span className="font-normal text-slate-600"> — {order.damageRemarks.join(', ')}</span>}
                    </dd>
                    {order.toInspectionRack && (
                      <>
                        <dt className="text-slate-500">Xe nâng</dt>
                        <dd className="font-black text-amber-700">HẠ KỆ GIÁM ĐỊNH</dd>
                      </>
                    )}
                    <dt className="text-slate-500">Phân loại đóng hàng</dt>
                    <dd className="font-bold">{order.stuffingClass}</dd>
                    <dt className="text-slate-500">Vệ sinh</dt>
                    <dd className="font-semibold">{order.cleaningItems.join(' + ')}</dd>
                    <dt className="text-slate-500">AGE</dt>
                    <dd className="font-semibold">{order.manufactureYear}</dd>
                  </dl>
                </div>
              </SectionCard>

              <SectionCard title="1. Thông tin hồ sơ">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <label>
                    <span className={labelCls}>Số container *</span>
                    <input value={form.contNo} onChange={(e) => set({ contNo: e.target.value.toUpperCase() })} placeholder="MSKU6829104" aria-invalid={Boolean(contConflict)} className={`${inputCls} font-mono font-bold uppercase ${contConflict ? "border-red-500 bg-red-50" : ""}`} />
                    {contConflict && <span role="alert" className="mt-1 block text-[11px] font-semibold text-red-700">{contConflict}</span>}
                  </label>
                  <label>
                    <span className={labelCls}>Size *</span>
                    <select value={form.size} onChange={(e) => set({ size: e.target.value })} className={inputCls}>
                      <option value="">-- Chọn --</option>
                      {state.containerSizes.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className={labelCls}>Type *</span>
                    <select value={form.type} onChange={(e) => set({ type: e.target.value })} className={inputCls}>
                      <option value="">-- Chọn --</option>
                      {state.containerTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className={labelCls}>Hãng tàu *</span>
                    <select value={form.shippingLineCode} onChange={(e) => set({ shippingLineCode: e.target.value })} className={inputCls}>
                      <option value="">-- Chọn --</option>
                      {shippingLines.map((l) => <option key={l.id} value={l.code}>{l.code} — {l.name}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className={labelCls}>Khách hàng *</span>
                    <CustomerInput id="havo-customer" state={state} value={form.customerName} onChange={(v) => set({ customerName: v })} />
                  </label>
                  <label>
                    <span className={labelCls}>Số lệnh / chứng từ</span>
                    <input value={form.orderDocNo} onChange={(e) => set({ orderDocNo: e.target.value })} className={inputCls} />
                  </label>
                  <label>
                    <span className={labelCls}>Số xe *</span>
                    <input value={form.truckNo} onChange={(e) => set({ truckNo: e.target.value.toUpperCase() })} placeholder="15C-882.19" className={`${inputCls} uppercase`} />
                  </label>
                  <label>
                    <span className={labelCls}>SĐT lái xe *</span>
                    <input type="tel" inputMode="tel" value={form.driverPhone} onChange={(e) => set({ driverPhone: e.target.value })} placeholder="0912345678" className={inputCls} />
                  </label>
                </div>
              </SectionCard>

              {section1Done && (
                <FeeLinesEditor catalog={state.feeCatalog} selectedIds={feeIds} onChange={setFeeIds} suggestedId={suggested} disabled={Boolean(pendingTx)} />
              )}

              {section1Done && feeIds.length > 0 && (
                pendingTx ? (
                  <PendingTransferPanel state={state} transaction={pendingTx} onSimulate={handleSimulate} onCancel={handleCancelTransfer} />
                ) : (
                  <>
                    <PaymentPanel state={state} value={payment} onChange={setPayment} />
                    <button type="submit" disabled={!isPaymentChoiceComplete(payment)} className={`${primaryBtn} w-full py-3`}>
                      {paymentSubmitLabel(payment)}
                    </button>
                  </>
                )
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// BỘ PHẬN VĂN PHÒNG — CẤP VỎ
// ============================================================================
type ConditionFilter = 'ALL' | FieldConditionClass;

export const OfficeCapVoWorkspace: React.FC<OfficeProps> = ({ state, onUpdateState, onOpenK80Ticket, onOpenDossier }) => {
  const shippingLines = state.partners.filter((p) => p.isShippingLine);

  const [filters, setFilters] = useState({ search: '', line: 'ALL', size: 'ALL', type: 'ALL', condition: 'AV' as ConditionFilter });
  const [bookingNo, setBookingNo] = useState('');
  const [showBookingList, setShowBookingList] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [selectedContainerId, setSelectedContainerId] = useState('');
  const [truckNo, setTruckNo] = useState('');
  const [driverPhone, setDriverPhone] = useState('');
  const [feeIds, setFeeIds] = useState<string[]>([]);
  const [payment, setPayment] = useState<PaymentChoice>(EMPTY_PAYMENT);
  const [resumeOrderId, setResumeOrderId] = useState<string>('');
  const [cancelReason, setCancelReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const ready = useMemo(
    () =>
      state.containers
        .filter((c) => releaseBlocker(c) === null || blockedOnlyByHold(c))
        .filter((c) => !filters.search.trim() || c.containerNo.includes(filters.search.trim().toUpperCase()))
        .filter((c) => filters.line === 'ALL' || c.shippingLineCode === filters.line)
        .filter((c) => filters.size === 'ALL' || c.size === filters.size)
        .filter((c) => filters.type === 'ALL' || c.type === filters.type)
        .filter((c) => filters.condition === 'ALL' || c.conditionClass === filters.condition)
        .sort((a, b) => a.gateInAt.localeCompare(b.gateInAt)),
    [state.containers, filters]
  );
  const selected: ContainerRecord | undefined = state.containers.find((c) => c.id === selectedContainerId);
  const summary = bookingNo.trim() ? getBookingSummary(state, bookingNo) : undefined;
  const pendingOrders = state.gateOutOrders.filter((o) => o.status === 'PAYMENT_PENDING');
  const resumeOrder = pendingOrders.find((o) => o.id === resumeOrderId);
  const resumeVoucher = resumeOrder ? state.vouchers.find((v) => v.id === resumeOrder.voucherId) : undefined;
  const resumeTx = resumeVoucher ? pendingTransactionOf(state, resumeVoucher.id) : undefined;

  const suggested = selected
    ? suggestLoloFee(state.feeCatalog, selected.size, selected.type, selected.shippingLineCode)?.id
    : undefined;
  const part1Done = Boolean(bookingNo.trim() && customerName && selected);
  const part2Done = part1Done && Boolean(truckNo.trim() && driverPhone.trim());

  const resetForm = () => {
    setSelectedContainerId('');
    setTruckNo('');
    setDriverPhone('');
    setFeeIds([]);
    setPayment(EMPTY_PAYMENT);
  };

  const openTicket = (s: DepotState, gateOutCode: string) => {
    const t = s.k80Tickets.find((k) => k.outDossierCode === gateOutCode);
    if (t) onOpenK80Ticket(t);
  };

  const afterPayment = (next: DepotState, order: GateOutOrder) => {
    onUpdateState(next);
    const updated = next.gateOutOrders.find((o) => o.id === order.id)!;
    if (updated.status === 'PENDING_FORKLIFT') {
      setSuccess(`Đã lập lệnh CẤP VỎ ${updated.gateOutCode} cho ${updated.containerNo} — phiếu K80 đã mở, chuyển Xe nâng.`);
      openTicket(next, updated.gateOutCode);
      setResumeOrderId('');
    } else {
      setSuccess(`Đã lập hồ sơ ${updated.gateOutCode}. Đang chờ ngân hàng xác nhận chuyển khoản.`);
      setResumeOrderId(updated.id);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setError(null);
    setSuccess(null);
    try {
      const created = createReleaseOrder(state, {
        bookingNo,
        customerName,
        containerNo: selected.containerNo,
        truckNo,
        driverPhone,
        feeCatalogIds: feeIds,
      });
      const order = created.gateOutOrders[0];
      const next = confirmReleasePayment(created, { gateOutOrderId: order.id, ...payment });
      afterPayment(next, order);
      resetForm();
    } catch (err) {
      setError(errMsg(err, 'Lỗi lập lệnh cấp vỏ'));
    }
  };

  const handleResumePay = () => {
    if (!resumeOrder) return;
    setError(null);
    try {
      afterPayment(confirmReleasePayment(state, { gateOutOrderId: resumeOrder.id, ...payment }), resumeOrder);
    } catch (err) {
      setError(errMsg(err, 'Lỗi thanh toán'));
    }
  };

  const handleCancelOrder = (o: GateOutOrder) => {
    setError(null);
    try {
      onUpdateState(releaseAllocatedContainer(state, { containerNo: o.containerNo, reason: cancelReason }));
      setSuccess(`Đã hủy lệnh ${o.gateOutCode}; ${o.containerNo} trở lại tồn bãi.`);
      setCancelReason('');
      setResumeOrderId('');
    } catch (err) {
      setError(errMsg(err, 'Lỗi hủy lệnh'));
    }
  };

  const statusLabel: Record<GateOutOrder['status'], string> = {
    PAYMENT_PENDING: 'Chờ thanh toán',
    PENDING_FORKLIFT: 'Chờ xe nâng',
    GATE_OUT_OK: 'Đã OUT',
    CANCELLED: 'Đã hủy',
  };

  return (
    <div className="space-y-4">
      <Feedback error={error} success={success} onClose={() => (setError(null), setSuccess(null))} />

      {pendingOrders.length > 0 && (
        <SectionCard title={`Hồ sơ cấp vỏ chờ thanh toán (${pendingOrders.length})`}>
          <ul className="space-y-2 text-xs">
            {pendingOrders.map((o) => (
              <li key={o.id} className="rounded-md border border-slate-200 p-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    <button type="button" onClick={() => onOpenDossier?.(o.gateOutCode)} className={linkCls}>
                      {o.gateOutCode}
                    </button>{' '}
                    • <span className="font-mono">{o.containerNo}</span> • {o.bookingNo} • {formatVnd(o.feeAmount)}
                  </span>
                  <button type="button" onClick={() => { setResumeOrderId(resumeOrderId === o.id ? '' : o.id); setPayment(EMPTY_PAYMENT); }} className={secondaryBtn}>
                    {resumeOrderId === o.id ? 'Đóng' : 'Tiếp tục'}
                  </button>
                </div>
                {resumeOrderId === o.id && (
                  <div className="mt-3 space-y-3">
                    {resumeTx ? (
                      <PendingTransferPanel
                        state={state}
                        transaction={resumeTx}
                        onSimulate={() => {
                          try {
                            afterPayment(simulateDemoBankTransfer(state, { transactionId: resumeTx.id }), o);
                          } catch (err) {
                            setError(errMsg(err, 'Lỗi giả lập ngân hàng'));
                          }
                        }}
                        onCancel={(reason) => {
                          try {
                            onUpdateState(cancelPendingTransaction(state, { transactionId: resumeTx.id, reason }));
                          } catch (err) {
                            setError(errMsg(err, 'Lỗi hủy yêu cầu'));
                          }
                        }}
                      />
                    ) : (
                      <>
                        <PaymentPanel state={state} value={payment} onChange={setPayment} />
                        <button type="button" onClick={handleResumePay} disabled={!isPaymentChoiceComplete(payment)} className={`${primaryBtn} w-full`}>
                          {paymentSubmitLabel(payment)}
                        </button>
                      </>
                    )}
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Lý do hủy lệnh cấp..." className={inputCls} />
                      <button type="button" disabled={!cancelReason.trim()} onClick={() => handleCancelOrder(o)} className={`${secondaryBtn} shrink-0`}>
                        Hủy lệnh cấp
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <SectionCard
          className="lg:col-span-6"
          title="Danh sách container sẵn sàng CẤP VỎ"
          right={<span className="rounded bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-white">{ready.length}</span>}
        >
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <label className="col-span-2 sm:col-span-1">
              <span className={labelCls}>Số cont</span>
              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} className={`${inputCls} pl-7 font-mono uppercase`} />
              </div>
            </label>
            <label>
              <span className={labelCls}>Hãng tàu</span>
              <select value={filters.line} onChange={(e) => setFilters({ ...filters, line: e.target.value })} className={inputCls}>
                <option value="ALL">Tất cả</option>
                {shippingLines.map((l) => <option key={l.id} value={l.code}>{l.code}</option>)}
              </select>
            </label>
            <label>
              <span className={labelCls}>Size</span>
              <select value={filters.size} onChange={(e) => setFilters({ ...filters, size: e.target.value })} className={inputCls}>
                <option value="ALL">Tất cả</option>
                {state.containerSizes.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label>
              <span className={labelCls}>Type</span>
              <select value={filters.type} onChange={(e) => setFilters({ ...filters, type: e.target.value })} className={inputCls}>
                <option value="ALL">Tất cả</option>
                {state.containerTypes.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label>
              <span className={labelCls}>Trạng thái</span>
              <select value={filters.condition} onChange={(e) => setFilters({ ...filters, condition: e.target.value as ConditionFilter })} className={inputCls}>
                <option value="AV">AV</option>
                <option value="DAMAGE">DAMAGE</option>
                <option value="ALL">ALL</option>
              </select>
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-xs">
              <thead className="border-b border-slate-200 text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-2">Số container</th>
                  <th className="py-2 pr-2">Size/Type</th>
                  <th className="py-2 pr-2">Hãng tàu</th>
                  <th className="py-2 pr-2">Trạng thái</th>
                  <th className="py-2 pr-2">Đóng hàng</th>
                  <th className="py-2 pr-2">Vị trí</th>
                  <th className="py-2">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ready.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-slate-500">Không có container phù hợp bộ lọc.</td>
                  </tr>
                ) : (
                  ready.map((c) => (
                    <tr
                      key={c.id}
                      onClick={() => {
                        if (c.isOnHold) { setError(`Container ${c.containerNo} đang KHÓA (${c.officeNote || c.holdReason || ""}) — mở khóa ở Tồn vỏ trước khi cấp.`); return; }
                        setError(null); setSelectedContainerId(c.id); setFeeIds([]);
                      }}
                      className={`${c.isOnHold ? "cursor-not-allowed bg-rose-50/60 text-slate-500" : "cursor-pointer"} ${selectedContainerId === c.id ? "bg-blue-50" : c.isOnHold ? "" : "hover:bg-slate-50"}`}
                    >
                      <td className="py-2 pr-2"><ContainerNo no={c.containerNo} locked={c.isOnHold} lockReason={c.officeNote || c.holdReason} /></td>
                      <td className="py-2 pr-2">{c.size}/{c.type}</td>
                      <td className="py-2 pr-2">{c.shippingLineCode}</td>
                      <td className={`py-2 pr-2 font-bold ${c.conditionClass === 'DAMAGE' ? 'text-rose-700' : 'text-emerald-700'}`}>{c.conditionClass}</td>
                      <td className="py-2 pr-2">{c.stuffingClass}</td>
                      <td className="py-2 pr-2 font-mono"><LocationText loc={c} /></td>
                      <td className="py-2 text-[11px] font-semibold text-amber-900">{c.officeNote || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <form onSubmit={handleSubmit} className="space-y-4 lg:col-span-6">
          <SectionCard title="1. Booking & container" icon={<Truck className="h-4 w-4 text-slate-500" />}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label>
                <span className={labelCls}>Số booking *</span>
                <input value={bookingNo} onChange={(e) => setBookingNo(e.target.value.toUpperCase())} placeholder="BK-MSK-2026-109" className={`${inputCls} font-mono uppercase`} />
              </label>
              <label>
                <span className={labelCls}>Khách hàng nhận vỏ *</span>
                <CustomerInput id="capvo-customer" state={state} value={customerName} onChange={setCustomerName} />
              </label>
            </div>

            {summary && (
              <div className="mt-3 rounded-md border border-slate-200 bg-slate-50 p-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    Đã cấp theo booking: <strong className="text-sm">{summary.issued.length}</strong>
                    {summary.booking?.requestedQty ? ` / ${summary.booking.requestedQty}` : ''} container
                    <span className="text-slate-500">
                      {' '}(Chờ TT {summary.waitingPayment.length} • Chờ xe nâng {summary.waitingForklift.length} • Đã OUT {summary.gatedOut.length})
                      {summary.cancelled.length > 0 && ` • Đã hủy ${summary.cancelled.length}`}
                    </span>
                  </span>
                  {summary.orders.length > 0 && (
                    <button type="button" onClick={() => setShowBookingList((v) => !v)} className={secondaryBtn}>
                      {showBookingList ? 'Ẩn danh sách' : 'Xem danh sách'}
                    </button>
                  )}
                </div>
                {!summary.booking && <p className="mt-1 text-[11px] text-slate-500">Booking mới — sẽ được tạo khi lập lệnh đầu tiên.</p>}
                {showBookingList && (
                  <table className="mt-2 w-full text-left text-[11px]">
                    <tbody className="divide-y divide-slate-200">
                      {summary.orders.map((o) => (
                        <tr key={o.id}>
                          <td className="py-1 pr-2 font-mono">
                            <button type="button" onClick={() => onOpenDossier?.(o.gateOutCode)} className={linkCls}>{o.gateOutCode}</button>
                          </td>
                          <td className="py-1 pr-2 font-mono">{o.containerNo}</td>
                          <td className="py-1 pr-2">{statusLabel[o.status]}</td>
                          <td className="py-1">{formatViTime(o.confirmedAt || o.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            <div className="mt-3 text-xs">
              <span className={labelCls}>Container được chọn</span>
              {selected ? (
                <span>
                  <ContainerNo no={selected.containerNo} /> • {selected.size}/{selected.type} • {selected.shippingLineCode} •{' '}
                  <strong className={selected.conditionClass === 'DAMAGE' ? 'text-rose-700' : 'text-emerald-700'}>{selected.conditionClass}</strong>
                </span>
              ) : (
                <span className="text-slate-500">Chọn container ở danh sách bên trái.</span>
              )}
            </div>
          </SectionCard>

          {part1Done && (
            <SectionCard title="2. Phương tiện">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label>
                  <span className={labelCls}>Số xe *</span>
                  <input value={truckNo} onChange={(e) => setTruckNo(e.target.value.toUpperCase())} placeholder="15H-686.88" className={`${inputCls} uppercase`} />
                </label>
                <label>
                  <span className={labelCls}>SĐT lái xe *</span>
                  <input type="tel" inputMode="tel" value={driverPhone} onChange={(e) => setDriverPhone(e.target.value)} placeholder="0912345678" className={inputCls} />
                </label>
              </div>
            </SectionCard>
          )}

          {part2Done && <FeeLinesEditor catalog={state.feeCatalog} selectedIds={feeIds} onChange={setFeeIds} suggestedId={suggested} />}

          {part2Done && feeIds.length > 0 && (
            <>
              <PaymentPanel state={state} value={payment} onChange={setPayment} />
              <button type="submit" disabled={!isPaymentChoiceComplete(payment)} className={`${primaryBtn} w-full py-3`}>
                Lập lệnh cấp vỏ — {paymentSubmitLabel(payment)}
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
};
