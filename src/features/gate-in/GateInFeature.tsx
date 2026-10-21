import React, { useState } from 'react';
import {
  Camera,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileText,
  QrCode,
  ShieldAlert,
  Truck,
} from 'lucide-react';
import {
  CLEANING_ITEM_OPTIONS,
  ContainerSize,
  ContainerType,
  DirectPaymentMethod,
  FieldCleaningItem,
  FieldConditionClass,
  FieldStuffingClass,
  GATE_IN_TYPE_LABELS,
  GateInOrder,
  GateInType,
  PaymentCategory,
} from '../../types/depot';
import { DepotState, formatVnd } from '../../services/depotStore';
import {
  confirmGateInPaymentAndComplete,
  normalizeCleaningItems,
  recordGateInFieldStep,
  verifyGateInOfficeAndCreatePayment,
} from '../../services/depotOperations';

interface Props {
  state: DepotState;
  onUpdateState: (next: DepotState) => void;
}

export const GateInFeature: React.FC<Props> = ({ state, onUpdateState }) => {
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form Bước 1: Hiện trường
  const [gateInType, setGateInType] = useState<GateInType>('CUSTOMER_RETURN');
  const [doorPhotoUrl, setDoorPhotoUrl] = useState(
    'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80'
  );
  const [initialHint, setInitialHint] = useState('');
  const [conditionClass, setConditionClass] = useState<FieldConditionClass>('AV');
  const [stuffingClass, setStuffingClass] = useState<FieldStuffingClass>('E');
  const [cleaningItems, setCleaningItems] = useState<FieldCleaningItem[]>(['KHÔNG VỆ SINH']);

  // Form Bước 2 & 3: Văn phòng kiểm tra chứng từ & xác nhận thanh toán
  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    state.gateInOrders[0]?.id || ''
  );
  const selectedOrder: GateInOrder | undefined = state.gateInOrders.find(
    (o) => o.id === selectedOrderId
  );

  const [contNo, setContNo] = useState(selectedOrder?.containerNo || 'MSKU6612098');
  const [size, setSize] = useState<ContainerSize>(selectedOrder?.size || '40');
  const [type, setType] = useState<ContainerType>(selectedOrder?.type || 'HC');
  const [truckNo, setTruckNo] = useState(selectedOrder?.truckNo || '15C-668.99');
  const [customerRep, setCustomerRep] = useState(
    selectedOrder?.customerRep || 'Công ty Tiếp Vận Việt (VietLog)'
  );
  const [shippingLineCode, setShippingLineCode] = useState(
    selectedOrder?.shippingLineCode || 'MAERSK'
  );
  const [orderDocNo, setOrderDocNo] = useState(
    selectedOrder?.orderDocNo || 'EIR-MSK-2026-901'
  );
  const [feeAmount, setFeeAmount] = useState<number>(selectedOrder?.feeAmount || 950000);

  // Bước 3: Xác nhận khoản thu (TTT / TTS / TTTT)
  const [paymentCategory, setPaymentCategory] = useState<PaymentCategory>('TTT');
  const [scannedQrCode, setScannedQrCode] = useState('QR-TTT-VIETLOG-001');
  const [ttsNote, setTtsNote] = useState('Đã kiểm tra nguồn công nợ hãng tàu/khách hàng hợp lệ');
  const [directMethod, setDirectMethod] = useState<DirectPaymentMethod>('BANK_TRANSFER_API');
  const [providerTxRef, setProviderTxRef] = useState(`VCB-API-${Date.now().toString().slice(-6)}`);

  const handleSelectOrder = (order: GateInOrder) => {
    setSelectedOrderId(order.id);
    setErrorMsg(null);
    setSuccessMsg(null);
    setContNo(
      order.containerNo ||
        (order.initialContainerHint?.match(/[A-Z]{4}\d{7}/)?.[0] ?? 'MSKU6612098')
    );
    setSize(order.size || '40');
    setType(order.type || 'HC');
    setTruckNo(order.truckNo || '15C-668.99');
    setCustomerRep(order.customerRep || 'Công ty Tiếp Vận Việt (VietLog)');
    setShippingLineCode(order.shippingLineCode || 'MAERSK');
    setOrderDocNo(order.orderDocNo || 'EIR-MSK-2026-901');
    setFeeAmount(order.feeAmount || 950000);
  };

  const toggleCleaningOption = (item: FieldCleaningItem) => {
    if (item === 'KHÔNG VỆ SINH') {
      setCleaningItems(['KHÔNG VỆ SINH']);
      return;
    }
    const withoutNone = cleaningItems.filter((x) => x !== 'KHÔNG VỆ SINH');
    if (withoutNone.includes(item)) {
      const next = withoutNone.filter((x) => x !== item);
      setCleaningItems(next.length === 0 ? ['KHÔNG VỆ SINH'] : next);
    } else {
      setCleaningItems(normalizeCleaningItems([...withoutNone, item]));
    }
  };

  const handleFieldSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const next = recordGateInFieldStep(state, {
        gateInType,
        doorPhotoUrl,
        initialContainerHint: initialHint,
        conditionClass,
        stuffingClass,
        cleaningItems,
      });
      onUpdateState(next);
      const created = next.gateInOrders[0];
      if (created) handleSelectOrder(created);
      setInitialHint('');
      setSuccessMsg(
        `Đã ghi nhận bước Hiện trường thành công (${created.orderCode}). Chuyển sang Văn phòng kiểm tra lệnh/chứng từ.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi ghi nhận Gate In');
    }
  };

  const handleOfficeVerify = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const next = verifyGateInOfficeAndCreatePayment(state, {
        gateInId: selectedOrder.id,
        containerNo: contNo,
        size,
        type,
        truckNo,
        customerRep,
        shippingLineCode,
        orderDocNo,
        feeAmount: Number(feeAmount),
      });
      onUpdateState(next);
      setSuccessMsg(
        `Đã lưu thông tin Văn phòng & tạo yêu cầu thanh toán (Trạng thái: PAYMENT_PENDING — chưa GATE IN OK cho đến khi xác nhận khoản thu).`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi kiểm tra văn phòng');
    }
  };

  const handleConfirmPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) return;
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const next = confirmGateInPaymentAndComplete(state, {
        gateInId: selectedOrder.id,
        paymentCategory,
        scannedQrCode,
        ttsNote,
        directMethod,
        providerTxRef,
      });
      onUpdateState(next);
      setProviderTxRef(`VCB-API-${Date.now().toString().slice(-6)}`);
      setSuccessMsg(
        `Xác nhận thanh toán [${paymentCategory}] thành công -> Đã cập nhật GATE IN OK và chuyển tiếp sang bộ phận tiếp theo!`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi xác nhận thanh toán');
    }
  };

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <p className="font-semibold">Thao tác bị từ chối theo quy tắc nghiệp vụ</p>
            <p>{errorMsg}</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-semibold">Cập nhật thành công</p>
            <p>{successMsg}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* CỘT TRÁI: BƯỚC 1 - HIỆN TRƯỜNG CHỤP ẢNH & GHI NHẬN BAN ĐẦU */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="mb-4 flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                1. Bước Hiện Trường / Cổng (Gate In)
              </h2>
              <p className="text-xs text-slate-500">
                Chụp ảnh cửa container rõ số cont & ghi nhận phân loại ban đầu
              </p>
            </div>
          </div>

          <form onSubmit={handleFieldSubmit} className="space-y-4 text-sm">
            <div>
              <label className="mb-1 block font-medium text-slate-700">
                Loại tiếp nhận vào bãi (DEC-007)
              </label>
              <select
                value={gateInType}
                onChange={(e) => setGateInType(e.target.value as GateInType)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-600 focus:outline-hidden"
              >
                <option value="CUSTOMER_RETURN">{GATE_IN_TYPE_LABELS.CUSTOMER_RETURN}</option>
                <option value="VESSEL_IMPORT">{GATE_IN_TYPE_LABELS.VESSEL_IMPORT}</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block font-medium text-slate-700">
                Link/Ảnh chụp cửa container (bắt buộc nhìn rõ số container) *
              </label>
              <input
                type="text"
                value={doorPhotoUrl}
                onChange={(e) => setDoorPhotoUrl(e.target.value)}
                placeholder="URL ảnh cửa container..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-blue-600 focus:outline-hidden"
                required
              />
            </div>

            <div>
              <label className="mb-1 block font-medium text-slate-700">
                Ghi chú nhanh số container trên cửa (nếu có)
              </label>
              <input
                type="text"
                value={initialHint}
                onChange={(e) => setInitialHint(e.target.value)}
                placeholder="VD: MSKU6612098"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 uppercase focus:border-blue-600 focus:outline-hidden"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-medium text-slate-700">
                  Phân loại (DAMAGE / AV) *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(['AV', 'DAMAGE'] as FieldConditionClass[]).map((cls) => (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => setConditionClass(cls)}
                      className={`rounded-lg border py-2 font-semibold transition ${
                        conditionClass === cls
                          ? cls === 'DAMAGE'
                            ? 'border-red-600 bg-red-600 text-white'
                            : 'border-emerald-600 bg-emerald-600 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {cls}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block font-medium text-slate-700">
                  Phân loại đóng hàng (M / K / E) *
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {(['M', 'K', 'E'] as FieldStuffingClass[]).map((stf) => (
                    <button
                      key={stf}
                      type="button"
                      onClick={() => setStuffingClass(stf)}
                      className={`rounded-lg border py-2 font-semibold transition ${
                        stuffingClass === stf
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      {stf}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block font-medium text-slate-700">
                Tình trạng vệ sinh (Cho phép chọn nhiều — DEC-016) *
              </label>
              <div className="grid grid-cols-2 gap-2">
                {CLEANING_ITEM_OPTIONS.map((item) => {
                  const active = cleaningItems.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleCleaningOption(item)}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs font-medium transition ${
                        active
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900 ring-1 ring-indigo-600'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span>{item}</span>
                      {active && <span className="text-indigo-600 font-bold">✓</span>}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white shadow-xs hover:bg-blue-700 transition"
            >
              Xác nhận Container đến bãi (Ghi nhận Hiện trường)
            </button>
          </form>
        </div>

        {/* CỘT PHẢI: BƯỚC 2 & 3 - VĂN PHÒNG BỔ SUNG HỒ SƠ & XÁC NHẬN THANH TOÁN (TTT / TTS / TTTT) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
                  <ClipboardCheck className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    2. Bước Văn Phòng Kiểm Tra & Bổ Sung Trường Bắt Buộc
                  </h2>
                  <p className="text-xs text-slate-500">
                    Bổ sung SỐ CONTAINER, SIZE, TYPE, SỐ XE, ĐẠI DIỆN KHÁCH HÀNG & tạo thanh toán
                  </p>
                </div>
              </div>

              <select
                value={selectedOrderId}
                onChange={(e) => {
                  const found = state.gateInOrders.find((o) => o.id === e.target.value);
                  if (found) handleSelectOrder(found);
                }}
                className="rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-800"
              >
                {state.gateInOrders.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.orderCode} — {o.containerNo || o.initialContainerHint || 'Chưa nhập số cont'} ({o.status})
                  </option>
                ))}
              </select>
            </div>

            {selectedOrder ? (
              <div className="space-y-5">
                {/* Tóm tắt dữ liệu hiện trường & ảnh cửa cont */}
                <div className="flex flex-col gap-4 rounded-xl bg-slate-50 p-3.5 sm:flex-row sm:items-center">
                  <img
                    src={selectedOrder.doorPhotoUrl}
                    alt="Ảnh cửa container"
                    className="h-24 w-36 rounded-lg object-cover border border-slate-200 shrink-0"
                  />
                  <div className="space-y-1 text-xs">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900">{selectedOrder.orderCode}</span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 font-semibold ${
                          selectedOrder.status === 'GATE_IN_OK'
                            ? 'bg-emerald-100 text-emerald-800'
                            : selectedOrder.status === 'PAYMENT_PENDING'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {selectedOrder.status}
                      </span>
                    </div>
                    <p className="text-slate-600">
                      Hiện trường: <strong>{selectedOrder.fieldStaffName}</strong> | Gợi ý số cont:{' '}
                      <strong>{selectedOrder.initialContainerHint || 'Xem ảnh cửa cont'}</strong>
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      <span
                        className={`rounded-md px-2 py-0.5 font-bold ${
                          selectedOrder.conditionClass === 'DAMAGE'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        Phân loại: {selectedOrder.conditionClass}
                      </span>
                      <span className="rounded-md bg-blue-100 px-2 py-0.5 font-bold text-blue-700">
                        Đóng hàng: {selectedOrder.stuffingClass}
                      </span>
                      <span className="rounded-md bg-indigo-100 px-2 py-0.5 font-medium text-indigo-800">
                        Vệ sinh: {selectedOrder.cleaningItems.join(', ')}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Form 5 trường Văn phòng bắt buộc (DEC-016) */}
                <form onSubmit={handleOfficeVerify} className="space-y-3 text-sm">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        1. SỐ CONTAINER *
                      </label>
                      <input
                        type="text"
                        value={contNo}
                        onChange={(e) => setContNo(e.target.value.toUpperCase())}
                        placeholder="MSKU4089123"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono uppercase"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        2. SIZE *
                      </label>
                      <select
                        value={size}
                        onChange={(e) => setSize(e.target.value as ContainerSize)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      >
                        <option value="20">20'</option>
                        <option value="40">40'</option>
                        <option value="45">45'</option>
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        3. TYPE *
                      </label>
                      <select
                        value={type}
                        onChange={(e) => setType(e.target.value as ContainerType)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      >
                        <option value="DC">DC (Dry Container)</option>
                        <option value="HC">HC (High Cube)</option>
                        <option value="OT">OT (Open Top)</option>
                        <option value="FR">FR (Flat Rack)</option>
                        <option value="RF">RF (Reefer rỗng)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        4. SỐ XE *
                      </label>
                      <input
                        type="text"
                        value={truckNo}
                        onChange={(e) => setTruckNo(e.target.value.toUpperCase())}
                        placeholder="15C-889.12"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 uppercase"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        5. ĐẠI DIỆN KHÁCH HÀNG *
                      </label>
                      <input
                        type="text"
                        value={customerRep}
                        onChange={(e) => setCustomerRep(e.target.value)}
                        placeholder="Tên công ty / người đại diện trả vỏ"
                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Hãng tàu / Chủ vỏ
                      </label>
                      <select
                        value={shippingLineCode}
                        onChange={(e) => setShippingLineCode(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      >
                        {state.partners
                          .filter((p) => p.isShippingLine)
                          .map((p) => (
                            <option key={p.id} value={p.code}>
                              {p.code} — {p.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Số lệnh / Chứng từ hãng tàu
                      </label>
                      <input
                        type="text"
                        value={orderDocNo}
                        onChange={(e) => setOrderDocNo(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-700">
                        Phí Gate In phải thu (VNĐ)
                      </label>
                      <input
                        type="number"
                        value={feeAmount}
                        onChange={(e) => setFeeAmount(Number(e.target.value))}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 font-semibold text-slate-900"
                      />
                    </div>
                  </div>

                  {selectedOrder.status !== 'GATE_IN_OK' && (
                    <button
                      type="submit"
                      className="w-full rounded-xl bg-amber-600 px-4 py-2.5 font-semibold text-white hover:bg-amber-700 transition"
                    >
                      Lưu Hồ Sơ Văn Phòng & Tạo Yêu Cầu Thanh Toán (Chưa GATE IN OK)
                    </button>
                  )}
                </form>

                {/* BƯỚC 3: XÁC NHẬN KHOẢN THU (TTT / TTS / TTTT) ĐỂ LÊN GATE IN OK */}
                <div className="border-t border-slate-200 pt-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-emerald-600" />
                      <h3 className="text-sm font-bold text-slate-900">
                        3. Văn Phòng Xác Nhận Khoản Thu Trên Chứng Từ (TTT / TTS / TTTT)
                      </h3>
                    </div>
                    {selectedOrder.voucherNo && (
                      <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-mono font-semibold text-slate-700">
                        Chứng từ: {selectedOrder.voucherNo} ({formatVnd(selectedOrder.feeAmount)})
                      </span>
                    )}
                  </div>

                  {selectedOrder.status === 'GATE_IN_OK' ? (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs text-emerald-900 space-y-1">
                      <p className="font-bold text-sm text-emerald-800">
                        ✓ ĐÃ CẬP NHẬT TRẠNG THÁI: GATE IN OK
                      </p>
                      <p>
                        Xác nhận bởi: <strong>{selectedOrder.gateInOkBy}</strong> lúc{' '}
                        {selectedOrder.gateInOkAt
                          ? new Date(selectedOrder.gateInOkAt).toLocaleString('vi-VN')
                          : ''}
                      </p>
                      <p>
                        Chuyển tiếp tự động:{' '}
                        <strong>{selectedOrder.nextDepartments.join(' → ')}</strong>
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleConfirmPayment} className="space-y-4 text-sm">
                      <div className="grid grid-cols-3 gap-2">
                        {(
                          [
                            {
                              code: 'TTT',
                              title: 'TTT — Thanh Toán Trước',
                              desc: 'Quét mã QR Phiếu thu mẹ & trừ dần',
                            },
                            {
                              code: 'TTS',
                              title: 'TTS — Thanh Toán Sau',
                              desc: 'Check nguồn & Note ở chứng từ là TTS',
                            },
                            {
                              code: 'TTTT',
                              title: 'TTTT — Trực Tiếp',
                              desc: 'Chuyển khoản (API) / Tiền mặt',
                            },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.code}
                            type="button"
                            onClick={() => setPaymentCategory(opt.code)}
                            className={`rounded-xl border p-3 text-left transition ${
                              paymentCategory === opt.code
                                ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600'
                                : 'border-slate-200 bg-white hover:bg-slate-50'
                            }`}
                          >
                            <p className="font-bold text-slate-900 text-xs">{opt.title}</p>
                            <p className="mt-0.5 text-[11px] text-slate-500">{opt.desc}</p>
                          </button>
                        ))}
                      </div>

                      {paymentCategory === 'TTT' && (
                        <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-3.5 space-y-2">
                          <label className="flex items-center gap-1.5 text-xs font-bold text-blue-900">
                            <QrCode className="h-4 w-4" />
                            Quét mã QR thanh toán của Phiếu thu mẹ vào CHỨNG TỪ:
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={scannedQrCode}
                              onChange={(e) => setScannedQrCode(e.target.value)}
                              placeholder="Nhập hoặc quét mã QR Phiếu thu mẹ..."
                              className="flex-1 rounded-lg border border-blue-300 bg-white px-3 py-2 font-mono text-xs uppercase"
                            />
                            <select
                              value={scannedQrCode}
                              onChange={(e) => setScannedQrCode(e.target.value)}
                              className="rounded-lg border border-blue-300 bg-white px-2.5 py-2 text-xs"
                            >
                              {state.masterReceipts.map((r) => (
                                <option key={r.id} value={r.qrCode}>
                                  {r.qrCode} (Dư: {formatVnd(r.remainingAmount)})
                                </option>
                              ))}
                            </select>
                          </div>
                          <p className="text-[11px] text-blue-700">
                            Hệ thống sẽ kiểm tra tính hợp lệ của chứng từ và tự động trừ{' '}
                            <strong>{formatVnd(selectedOrder.feeAmount)}</strong> trong Phiếu thu mẹ.
                          </p>
                        </div>
                      )}

                      {paymentCategory === 'TTS' && (
                        <div className="rounded-xl border border-purple-200 bg-purple-50/60 p-3.5 space-y-2">
                          <label className="flex items-center gap-1.5 text-xs font-bold text-purple-900">
                            <FileText className="h-4 w-4" />
                            Nhân viên văn phòng kiểm tra nguồn TTS & Note vào CHỨNG TỪ:
                          </label>
                          <input
                            type="text"
                            value={ttsNote}
                            onChange={(e) => setTtsNote(e.target.value)}
                            placeholder="Note xác nhận TTS trên chứng từ..."
                            className="w-full rounded-lg border border-purple-300 bg-white px-3 py-2 text-xs"
                          />
                          <p className="text-[11px] text-purple-700">
                            Chứng từ sẽ được ghi chú chính thức là <strong>TTS - {ttsNote}</strong>.
                          </p>
                        </div>
                      )}

                      {paymentCategory === 'TTTT' && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 space-y-3">
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setDirectMethod('BANK_TRANSFER_API')}
                              className={`rounded-lg border py-2 text-xs font-semibold ${
                                directMethod === 'BANK_TRANSFER_API'
                                  ? 'border-amber-600 bg-amber-600 text-white'
                                  : 'border-slate-300 bg-white text-slate-700'
                              }`}
                            >
                              Thanh toán chuyển khoản (API)
                            </button>
                            <button
                              type="button"
                              onClick={() => setDirectMethod('CASH')}
                              className={`rounded-lg border py-2 text-xs font-semibold ${
                                directMethod === 'CASH'
                                  ? 'border-amber-600 bg-amber-600 text-white'
                                  : 'border-slate-300 bg-white text-slate-700'
                              }`}
                            >
                              Thanh toán tiền mặt
                            </button>
                          </div>
                          {directMethod === 'BANK_TRANSFER_API' && (
                            <div>
                              <label className="mb-1 block text-xs font-semibold text-amber-900">
                                Mã tham chiếu giao dịch API / Webhook ngân hàng:
                              </label>
                              <input
                                type="text"
                                value={providerTxRef}
                                onChange={(e) => setProviderTxRef(e.target.value)}
                                className="w-full rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-mono text-xs"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      <button
                        type="submit"
                        className="w-full rounded-xl bg-emerald-600 px-4 py-2.5 font-bold text-white shadow-xs hover:bg-emerald-700 transition"
                      >
                        Xác Nhận Thanh Toán Hợp Lệ & Cập Nhật GATE IN OK
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-500">Chưa có lượt Gate In nào.</p>
            )}
          </div>
        </div>
      </div>

      {/* DANH SÁCH LƯỢT GATE IN */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Truck className="h-4 w-4 text-blue-600" />
            Danh sách các lượt Gate In gần đây
          </h3>
          <span className="text-xs text-slate-500">
            Nhấn vào một dòng để mở hồ sơ tại khung Văn phòng
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="px-3 py-2.5">Mã Gate In</th>
                <th className="px-3 py-2.5">Số Container</th>
                <th className="px-3 py-2.5">Size/Type</th>
                <th className="px-3 py-2.5">Hiện trường (Phân loại / Đóng hàng / Vệ sinh)</th>
                <th className="px-3 py-2.5">Số xe & Đại diện KH</th>
                <th className="px-3 py-2.5">Chứng từ & Phí</th>
                <th className="px-3 py-2.5">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.gateInOrders.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => handleSelectOrder(order)}
                  className={`cursor-pointer transition hover:bg-blue-50/50 ${
                    order.id === selectedOrderId ? 'bg-blue-50/80' : ''
                  }`}
                >
                  <td className="px-3 py-2.5 font-mono font-bold text-slate-900">
                    {order.orderCode}
                  </td>
                  <td className="px-3 py-2.5 font-mono font-semibold text-blue-700">
                    {order.containerNo || order.initialContainerHint || 'Chưa bổ sung'}
                  </td>
                  <td className="px-3 py-2.5">
                    {order.size && order.type ? `${order.size}' ${order.type}` : '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`mr-1.5 rounded px-1.5 py-0.5 font-bold ${
                        order.conditionClass === 'DAMAGE'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {order.conditionClass}
                    </span>
                    <span className="mr-1.5 rounded bg-blue-100 px-1.5 py-0.5 font-bold text-blue-700">
                      {order.stuffingClass}
                    </span>
                    <span className="text-slate-600">{order.cleaningItems.join(', ')}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    {order.truckNo ? (
                      <div>
                        <span className="font-semibold">{order.truckNo}</span> — {order.customerRep}
                      </div>
                    ) : (
                      <span className="text-slate-400">Chờ văn phòng nhập</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="font-semibold text-slate-900">
                      {formatVnd(order.feeAmount)}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      {order.voucherNo || 'Chưa tạo chứng từ'}
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 font-bold ${
                        order.status === 'GATE_IN_OK'
                          ? 'bg-emerald-100 text-emerald-800'
                          : order.status === 'PAYMENT_PENDING'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
