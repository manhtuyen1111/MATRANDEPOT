import React, { useState } from 'react';
import {
  CheckCircle2,
  CheckSquare,
  Lock,
  LogOut,
  Plus,
  QrCode,
  ShieldAlert,
  Unlock,
} from 'lucide-react';
import {
  ContainerSize,
  ContainerType,
  DirectPaymentMethod,
  GATE_OUT_TYPE_LABELS,
  GateOutType,
  PaymentCategory,
} from '../../types/depot';
import { DepotState, formatVnd, hasRolePermission } from '../../services/depotStore';
import {
  allocateContainerToBooking,
  executeGateOut,
  releaseAllocatedContainer,
} from '../../services/depotOperations';

interface Props {
  state: DepotState;
  onUpdateState: (next: DepotState) => void;
}

export const BookingGateOutFeature: React.FC<Props> = ({ state, onUpdateState }) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Tạo Booking mới
  const [newBookingNo, setNewBookingNo] = useState('BK-ONE-2026-205');
  const [releaseType, setReleaseType] = useState<GateOutType>('EMPTY_RELEASE');
  const [shippingLineCode, setShippingLineCode] = useState('ONE');
  const [requesterName, setRequesterName] = useState('Công ty Tiếp Vận Việt (VietLog)');
  const [receiverName, setReceiverName] = useState('Nhà máy Lắp Ráp Hải Phòng');
  const [reqSize, setReqSize] = useState<ContainerSize>('20');
  const [reqType, setReqType] = useState<ContainerType>('DC');
  const [requestedQty, setRequestedQty] = useState<number>(2);

  // Phân bổ container vào Booking (DEC-006)
  const [selectedBookingId, setSelectedBookingId] = useState<string>(
    state.bookings[0]?.id || ''
  );
  const selectedBooking = state.bookings.find((b) => b.id === selectedBookingId);
  const [allocateContNo, setAllocateContNo] = useState<string>('MSKU4089123');
  const [releaseReason, setReleaseReason] = useState<string>(
    'Khách yêu cầu đổi container khác'
  );

  // Gate Out (DEC-014, DEC-015)
  const [gateOutContNo, setGateOutContNo] = useState<string>('MSKU4089123');
  const [gateOutTruckNo, setGateOutTruckNo] = useState<string>('15H-556.88');
  const [gateOutReceiver, setGateOutReceiver] = useState<string>(
    'Công ty Tiếp Vận Việt (VietLog)'
  );
  const [gateOutFee, setGateOutFee] = useState<number>(650000);
  const [paymentCategory, setPaymentCategory] = useState<PaymentCategory>('TTT');
  const [scannedQrCode, setScannedQrCode] = useState<string>('QR-TTT-VIETLOG-001');
  const [ttsNote, setTtsNote] = useState<string>('Hãng tàu/khách hàng xác nhận TTS');
  const [directMethod, setDirectMethod] = useState<DirectPaymentMethod>('CASH');
  const [providerTxRef, setProviderTxRef] = useState<string>('API-OUT-001');
  const [documentsVerified, setDocumentsVerified] = useState<boolean>(true);

  const handleCreateBooking = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!hasRolePermission(state.currentUser, ['OFFICE', 'MANAGER'])) {
      setErrorMsg('Không đủ quyền tạo Booking/Lệnh cấp.');
      return;
    }
    if (!newBookingNo.trim()) return;

    const bk = {
      id: `bk-${Date.now()}`,
      bookingNo: newBookingNo.trim().toUpperCase(),
      releaseType,
      shippingLineCode,
      requesterName,
      receiverName,
      size: reqSize,
      type: reqType,
      requestedQty: Number(requestedQty),
      allocatedContainers: [],
      gatedOutContainers: [],
      status: 'OPEN' as const,
      createdAt: new Date().toISOString(),
    };

    const nextState: DepotState = {
      ...state,
      bookings: [bk, ...state.bookings],
    };
    onUpdateState(nextState);
    setSelectedBookingId(bk.id);
    setSuccessMsg(`Đã tạo lệnh cấp/Booking ${bk.bookingNo} (${GATE_OUT_TYPE_LABELS[releaseType]}).`);
  };

  const handleAllocateContainer = () => {
    if (!selectedBooking) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const next = allocateContainerToBooking(state, {
        bookingId: selectedBooking.id,
        containerNo: allocateContNo,
      });
      onUpdateState(next);
      setGateOutContNo(allocateContNo);
      setSuccessMsg(
        `Đã khóa phân bổ container ${allocateContNo} cho lệnh ${selectedBooking.bookingNo} (DEC-006 chống cấp trùng).`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi phân bổ container');
    }
  };

  const handleReleaseAllocation = (contNo: string) => {
    if (!selectedBooking) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const next = releaseAllocatedContainer(state, {
        bookingId: selectedBooking.id,
        containerNo: contNo,
        reason: releaseReason,
      });
      onUpdateState(next);
      setSuccessMsg(`Đã giải phóng khóa phân bổ của container ${contNo}.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi giải phóng phân bổ');
    }
  };

  // Kiểm tra trực tiếp 5 điều kiện xuất bãi trên giao diện (DEC-015)
  const targetGateOutContainer = state.containers.find((c) => c.containerNo === gateOutContNo);
  const cond1ValidOrder = Boolean(selectedBooking && selectedBooking.status !== 'CANCELLED');
  const cond2NotOnHold = Boolean(targetGateOutContainer && !targetGateOutContainer.isOnHold);
  const cond3CorrectContainer = Boolean(
    selectedBooking && selectedBooking.allocatedContainers.includes(gateOutContNo)
  );
  const cond4PaymentReady = Boolean(
    (paymentCategory === 'TTT' && scannedQrCode.trim()) ||
      (paymentCategory === 'TTS' && ttsNote.trim()) ||
      (paymentCategory === 'TTTT' && directMethod)
  );
  const cond5DocsReady = Boolean(
    documentsVerified && gateOutTruckNo.trim() && gateOutReceiver.trim()
  );

  const handleExecuteGateOut = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const next = executeGateOut(state, {
        gateOutType: selectedBooking.releaseType,
        bookingNo: selectedBooking.bookingNo,
        containerNo: gateOutContNo,
        truckNo: gateOutTruckNo,
        receiverRep: gateOutReceiver,
        feeAmount: Number(gateOutFee),
        paymentCategory,
        scannedQrCode,
        ttsNote,
        directMethod,
        providerTxRef,
        documentsVerified,
      });
      onUpdateState(next);
      setSuccessMsg(
        `Đã hoàn tất GATE OUT cho container ${gateOutContNo} theo lệnh ${selectedBooking.bookingNo}! Đã xóa vị trí hiện tại trong bãi và lưu lịch sử.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi Gate Out');
    }
  };

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <p className="font-semibold">Từ chối cấp / xuất container</p>
            <p>{errorMsg}</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-semibold">Hoàn tất thao tác</p>
            <p>{successMsg}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* CỘT TRÁI: TẠO BOOKING & KHÓA PHÂN BỔ CONTAINER (DEC-006) */}
        <div className="lg:col-span-6 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <h2 className="mb-3 flex items-center gap-2 text-base font-bold text-slate-900">
              <Plus className="h-5 w-5 text-blue-600" />
              1. Tạo Lệnh Cấp / Booking Xuất Container (DEC-014)
            </h2>

            <form onSubmit={handleCreateBooking} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">Số Booking / Lệnh *</label>
                  <input
                    type="text"
                    value={newBookingNo}
                    onChange={(e) => setNewBookingNo(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono uppercase"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">
                    Trường hợp ra khỏi bãi (DEC-014) *
                  </label>
                  <select
                    value={releaseType}
                    onChange={(e) => setReleaseType(e.target.value as GateOutType)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  >
                    <option value="EMPTY_RELEASE">{GATE_OUT_TYPE_LABELS.EMPTY_RELEASE}</option>
                    <option value="VESSEL_EXPORT">{GATE_OUT_TYPE_LABELS.VESSEL_EXPORT}</option>
                    <option value="SPECIAL_RETURN">{GATE_OUT_TYPE_LABELS.SPECIAL_RETURN}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">Hãng tàu</label>
                  <select
                    value={shippingLineCode}
                    onChange={(e) => setShippingLineCode(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-2 py-2"
                  >
                    <option value="MAERSK">MAERSK</option>
                    <option value="ONE">ONE</option>
                    <option value="COSCO">COSCO</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">Size</label>
                  <select
                    value={reqSize}
                    onChange={(e) => setReqSize(e.target.value as ContainerSize)}
                    className="w-full rounded-lg border border-slate-300 px-2 py-2"
                  >
                    <option value="20">20&apos;</option>
                    <option value="40">40&apos;</option>
                    <option value="45">45&apos;</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">Type</label>
                  <select
                    value={reqType}
                    onChange={(e) => setReqType(e.target.value as ContainerType)}
                    className="w-full rounded-lg border border-slate-300 px-2 py-2"
                  >
                    <option value="DC">DC</option>
                    <option value="HC">HC</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">SL Cấp</label>
                  <input
                    type="number"
                    min={1}
                    value={requestedQty}
                    onChange={(e) => setRequestedQty(Number(e.target.value))}
                    className="w-full rounded-lg border border-slate-300 px-2 py-2 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">Bên yêu cầu</label>
                  <input
                    type="text"
                    value={requesterName}
                    onChange={(e) => setRequesterName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="mb-1 block font-semibold text-slate-700">Bên nhận vỏ</label>
                  <input
                    type="text"
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-700"
              >
                Tạo Lệnh Cấp / Booking Mới
              </button>
            </form>
          </div>

          {/* KHÓA PHÂN BỔ CONTAINER (DEC-006) */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <Lock className="h-4 w-4 text-indigo-600" />
                2. Chọn & Khóa Phân Bổ Container Vào Lệnh Cấp (DEC-006)
              </h3>
              <select
                value={selectedBookingId}
                onChange={(e) => setSelectedBookingId(e.target.value)}
                className="rounded-lg border border-slate-300 bg-slate-50 px-2.5 py-1.5 text-xs font-mono font-bold"
              >
                {state.bookings.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.bookingNo} ({b.size}&apos;{b.type} • Đã cấp {b.allocatedContainers.length}/{b.requestedQty})
                  </option>
                ))}
              </select>
            </div>

            {selectedBooking && (
              <div className="space-y-3 text-xs">
                <div className="rounded-xl bg-indigo-50/70 p-3 text-indigo-950">
                  <p className="font-bold">
                    Lệnh: {selectedBooking.bookingNo} —{' '}
                    {GATE_OUT_TYPE_LABELS[selectedBooking.releaseType]}
                  </p>
                  <p className="mt-0.5 text-indigo-800">
                    Yêu cầu: {selectedBooking.requestedQty} cont {selectedBooking.size}&apos;
                    {selectedBooking.type} ({selectedBooking.shippingLineCode}) • Bên nhận:{' '}
                    {selectedBooking.receiverName}
                  </p>
                </div>

                <div className="flex gap-2">
                  <select
                    value={allocateContNo}
                    onChange={(e) => setAllocateContNo(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2 font-mono font-bold"
                  >
                    {state.containers
                      .filter((c) => c.status !== 'GATED_OUT')
                      .map((c) => (
                        <option key={c.id} value={c.containerNo}>
                          {c.containerNo} ({c.size}&apos;{c.type} • {c.conditionClass} •{' '}
                          {c.status === 'ALLOCATED'
                            ? `Đang khóa bởi ${c.allocatedBookingNo}`
                            : c.isOnHold
                            ? 'Đang HOLD'
                            : 'Có thể chọn'}
                          )
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleAllocateContainer}
                    className="rounded-xl bg-indigo-600 px-4 py-2 font-semibold text-white hover:bg-indigo-700"
                  >
                    Khóa Phân Bổ
                  </button>
                </div>

                {selectedBooking.allocatedContainers.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <p className="font-semibold text-slate-700">
                      Container đang được khóa phân bổ cho lệnh này:
                    </p>
                    <input
                      type="text"
                      value={releaseReason}
                      onChange={(e) => setReleaseReason(e.target.value)}
                      placeholder="Lý do đổi / hủy khóa phân bổ..."
                      className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs"
                    />
                    {selectedBooking.allocatedContainers.map((cNo) => (
                      <div
                        key={cNo}
                        className="flex items-center justify-between rounded-lg border border-indigo-200 bg-white px-3 py-2"
                      >
                        <span className="font-mono font-bold text-indigo-700">{cNo}</span>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => setGateOutContNo(cNo)}
                            className="rounded bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 hover:bg-emerald-100"
                          >
                            Chọn làm Gate Out
                          </button>
                          <button
                            type="button"
                            onClick={() => handleReleaseAllocation(cNo)}
                            className="inline-flex items-center gap-1 rounded bg-rose-50 px-2.5 py-1 font-semibold text-rose-700 hover:bg-rose-100"
                          >
                            <Unlock className="h-3 w-3" />
                            Mở khóa
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* CỘT PHẢI: GATE OUT & CHECKLIST 5 ĐIỀU KIỆN BẮT BUỘC (DEC-015) */}
        <div className="lg:col-span-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <LogOut className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                3. Thực Hiện Gate Out & Kiểm Tra 5 Điều Kiện (DEC-015)
              </h2>
              <p className="text-xs text-slate-500">
                Chặn xuất trùng hoặc xuất khi chưa đạt đủ 5 điều kiện bắt buộc
              </p>
            </div>
          </div>

          <form onSubmit={handleExecuteGateOut} className="space-y-4 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  Container xuất bãi *
                </label>
                <select
                  value={gateOutContNo}
                  onChange={(e) => setGateOutContNo(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono font-bold"
                >
                  {state.containers.map((c) => (
                    <option key={c.id} value={c.containerNo}>
                      {c.containerNo} ({c.status}
                      {c.isOnHold ? ' - ĐANG HOLD' : ''})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-700">Số xe nhận vỏ *</label>
                <input
                  type="text"
                  value={gateOutTruckNo}
                  onChange={(e) => setGateOutTruckNo(e.target.value.toUpperCase())}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 uppercase"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  Đại diện nhận container *
                </label>
                <input
                  type="text"
                  value={gateOutReceiver}
                  onChange={(e) => setGateOutReceiver(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block font-semibold text-slate-700">
                  Phí nâng hạ / xuất bãi (VNĐ)
                </label>
                <input
                  type="number"
                  value={gateOutFee}
                  onChange={(e) => setGateOutFee(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-bold"
                />
              </div>
            </div>

            {/* PHƯƠNG THỨC THANH TOÁN KHI GATE OUT (TTT / TTS / TTTT) */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2.5">
              <label className="block font-bold text-slate-800">
                Xác nhận khoản thu xuất bãi (TTT / TTS / TTTT):
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['TTT', 'TTS', 'TTTT'] as PaymentCategory[]).map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setPaymentCategory(cat)}
                    className={`rounded-lg border py-1.5 font-bold ${
                      paymentCategory === cat
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : 'border-slate-300 bg-white text-slate-700'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {paymentCategory === 'TTT' && (
                <div className="flex items-center gap-2">
                  <QrCode className="h-4 w-4 text-blue-600 shrink-0" />
                  <select
                    value={scannedQrCode}
                    onChange={(e) => setScannedQrCode(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-mono"
                  >
                    {state.masterReceipts.map((r) => (
                      <option key={r.id} value={r.qrCode}>
                        {r.qrCode} — Dư: {formatVnd(r.remainingAmount)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {paymentCategory === 'TTS' && (
                <input
                  type="text"
                  value={ttsNote}
                  onChange={(e) => setTtsNote(e.target.value)}
                  placeholder="Note ở chứng từ là TTS..."
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5"
                />
              )}

              {paymentCategory === 'TTTT' && (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDirectMethod('BANK_TRANSFER_API')}
                    className={`rounded border py-1.5 font-semibold ${
                      directMethod === 'BANK_TRANSFER_API'
                        ? 'border-amber-600 bg-amber-600 text-white'
                        : 'bg-white'
                    }`}
                  >
                    Chuyển khoản (API)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDirectMethod('CASH')}
                    className={`rounded border py-1.5 font-semibold ${
                      directMethod === 'CASH'
                        ? 'border-amber-600 bg-amber-600 text-white'
                        : 'bg-white'
                    }`}
                  >
                    Tiền mặt
                  </button>
                </div>
              )}
            </div>

            {/* CHECKLIST 5 ĐIỀU KIỆN KIỂM TRA TRƯỚC KHI XUẤT (DEC-015) */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
              <p className="flex items-center gap-1.5 font-bold text-slate-900">
                <CheckSquare className="h-4 w-4 text-emerald-600" />
                Checklist 5 điều kiện kiểm tra bắt buộc trước khi xuất (DEC-015):
              </p>
              {[
                {
                  ok: cond1ValidOrder,
                  label: `1. Có lệnh cấp/lệnh xuất hợp lệ (${selectedBooking?.bookingNo || 'Chưa chọn'})`,
                },
                {
                  ok: cond2NotOnHold,
                  label: `2. Container không bị tạm giữ hoặc khóa xuất (${
                    targetGateOutContainer?.isOnHold ? 'ĐANG BỊ HOLD!' : 'Hợp lệ'
                  })`,
                },
                {
                  ok: cond3CorrectContainer,
                  label: `3. Đúng số container được phép xuất trong lệnh (${gateOutContNo})`,
                },
                {
                  ok: cond4PaymentReady,
                  label: `4. Đã thanh toán / xác nhận khoản phí bắt buộc (${paymentCategory})`,
                },
                {
                  ok: cond5DocsReady,
                  label: '5. Chứng từ và thủ tục đã hoàn tất',
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className={`flex items-center justify-between rounded-lg px-2.5 py-1.5 font-medium ${
                    item.ok
                      ? 'bg-emerald-100/70 text-emerald-900'
                      : 'bg-rose-100/80 text-rose-900'
                  }`}
                >
                  <span>{item.label}</span>
                  <span className="font-bold">{item.ok ? 'ĐẠT' : 'CHƯA ĐẠT'}</span>
                </div>
              ))}

              <label className="flex items-center gap-2 pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={documentsVerified}
                  onChange={(e) => setDocumentsVerified(e.target.checked)}
                  className="rounded border-slate-300"
                />
                <span className="font-medium text-slate-700">
                  Xác nhận đã kiểm tra đầy đủ chứng từ & thủ tục tại cổng
                </span>
              </label>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 font-bold text-white shadow-xs hover:bg-emerald-700 transition"
            >
              Xác Nhận Hoàn Tất GATE OUT (Xuất Khỏi Bãi)
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
