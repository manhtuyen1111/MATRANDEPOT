import React, { useState } from 'react';
import {
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  FileText,
  Plus,
  Printer,
  QrCode,
  Receipt,
  ShieldAlert,
  Ship,
  Trash2,
  Truck,
} from 'lucide-react';
import {
  ContainerSize,
  ContainerType,
  DirectPaymentMethod,
  FeeLineItem,
  GateInOrder,
  K80InternalTicket,
  PaymentCategory,
} from '../../types/depot';
import {
  DepotState,
  formatVnd,
  INITIAL_CONTAINER_SIZES,
  INITIAL_CONTAINER_TYPES,
  INITIAL_FEE_CATALOG,
} from '../../services/depotStore';
import {
  allocateContainerToBooking,
  confirmGateInPaymentAndComplete,
  recordGateInFieldStep,
  verifyGateInOfficeAndCreatePayment,
} from '../../services/depotOperations';

interface OfficeHaVoProps {
  state: DepotState;
  onUpdateState: (next: DepotState) => void;
  onOpenK80Ticket: (ticket: K80InternalTicket) => void;
  onOpenDossier?: (masterDossierCode: string) => void;
}

export const OfficeHaVoWorkspace: React.FC<OfficeHaVoProps> = ({
  state,
  onUpdateState,
  onOpenK80Ticket,
  onOpenDossier,
}) => {
  const feeCatalog =
    state.feeCatalog && state.feeCatalog.length > 0
      ? state.feeCatalog
      : INITIAL_FEE_CATALOG;
  const containerSizes =
    state.containerSizes && state.containerSizes.length > 0
      ? state.containerSizes
      : INITIAL_CONTAINER_SIZES;
  const containerTypes =
    state.containerTypes && state.containerTypes.length > 0
      ? state.containerTypes
      : INITIAL_CONTAINER_TYPES;
  const customerList = state.partners.filter((p) => p.isCustomer);
  const shippingLineList = state.partners.filter((p) => p.isShippingLine);

  // Danh sách tác nghiệp đang chờ tại Văn phòng Hạ vỏ: Tác nghiệp mới được xác nhận luôn ưu tiên hiển thị trên cùng
  const pendingOrders = [...state.gateInOrders]
    .filter((o) => o.status !== 'GATE_IN_OK' && o.status !== 'CANCELLED')
    .sort(
      (a, b) =>
        new Date(b.fieldRecordedAt).getTime() -
        new Date(a.fieldRecordedAt).getTime()
    );

  const [selectedOrderId, setSelectedOrderId] = useState<string>(
    pendingOrders[0]?.id || ''
  );
  const activeOrder: GateInOrder | undefined =
    pendingOrders.find((o) => o.id === selectedOrderId) || pendingOrders[0];

  // 5 trường bắt buộc nhân viên văn phòng phải TỰ NHẬP BỔ SUNG (khởi tạo trống nếu chưa nhập)
  const [contNo, setContNo] = useState<string>(activeOrder?.containerNo || '');
  const [size, setSize] = useState<'' | ContainerSize>(
    activeOrder?.size || ''
  );
  const [type, setType] = useState<'' | ContainerType>(
    activeOrder?.type || ''
  );
  const [truckNo, setTruckNo] = useState<string>(activeOrder?.truckNo || '');
  const [customerRep, setCustomerRep] = useState<string>(
    activeOrder?.customerRep || ''
  );
  const [shippingLineCode, setShippingLineCode] = useState<string>(
    activeOrder?.shippingLineCode || ''
  );
  const [orderDocNo, setOrderDocNo] = useState<string>(
    activeOrder?.orderDocNo || 'EIR-MSK-2026-901'
  );

  // PHẦN CHI PHÍ TÁCH RIÊNG: Chỉ được chọn từ BIỂU GIÁ đã cấu hình trong DANH MỤC CHUNG (ĐÃ BAO GỒM VAT)
  const [feeLines, setFeeLines] = useState<FeeLineItem[]>(
    activeOrder?.feeLines || []
  );
  const [selectedCatalogId, setSelectedCatalogId] = useState<string>(
    feeCatalog[0]?.id || ''
  );
  const selectedCatalogItem =
    feeCatalog.find((c) => c.id === selectedCatalogId) || feeCatalog[0];
  const customLineAmount = selectedCatalogItem?.defaultAmountInclVat || 0;

  // 3 loại thanh toán: TTT / TTS / TTTT
  const [paymentCategory, setPaymentCategory] =
    useState<PaymentCategory>('TTT');
  const [scannedQrCode, setScannedQrCode] = useState('QR-TTT-VIETLOG-001');
  const [ttsNote, setTtsNote] = useState(
    'Đã kiểm tra nguồn TTS hãng tàu/khách hàng hợp lệ'
  );
  const [directMethod, setDirectMethod] =
    useState<DirectPaymentMethod>('BANK_TRANSFER_API');
  const [providerTxRef] = useState(
    `VCB-API-${Date.now().toString().slice(-6)}`
  );

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const totalFeeInclVat = feeLines.reduce(
    (sum, item) => sum + Number(item.amountInclVat || 0),
    0
  );

  const handleSelectOrder = (order: GateInOrder) => {
    setSelectedOrderId(order.id);
    setErrorMsg(null);
    setSuccessMsg(null);
    // Để trống nếu nhân viên văn phòng chưa nhập bổ sung
    setContNo(order.containerNo || '');
    setSize(order.size || '');
    setType(order.type || '');
    setTruckNo(order.truckNo || '');
    setCustomerRep(order.customerRep || '');
    setShippingLineCode(order.shippingLineCode || '');
    setOrderDocNo(order.orderDocNo || 'EIR-MSK-2026-901');
    setFeeLines(order.feeLines || []);
  };

  // Tự động gợi ý biểu giá NÂNG HẠ khớp với (SIZE - TYPE - HÃNG TÀU) khi nhân viên Văn phòng chọn
  const autoMatchLoloTariff = (
    nextSize: string,
    nextType: string,
    nextLine: string
  ) => {
    if (!nextSize && !nextType && !nextLine) return;
    const matched =
      feeCatalog.find(
        (f) =>
          f.category === 'NANG_HA' &&
          (!nextSize || f.size === nextSize) &&
          (!nextType || f.type === nextType) &&
          (!nextLine ||
            f.shippingLineCode === nextLine ||
            f.shippingLineCode === 'ALL')
      ) ||
      feeCatalog.find(
        (f) => f.category === 'NANG_HA' && (!nextSize || f.size === nextSize)
      );
    if (matched) {
      setSelectedCatalogId(matched.id);
    }
  };

  // Thêm 1 chi phí từ BIỂU GIÁ trong DANH MỤC CHUNG vào Bảng chi phí của container này
  const handleAddFeeLine = () => {
    const cat = feeCatalog.find((c) => c.id === selectedCatalogId);
    if (!cat) return;
    const newLine: FeeLineItem = {
      id: `fl-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      catalogCode: cat.code,
      name: cat.name,
      amountInclVat: Number(cat.defaultAmountInclVat),
    };
    setFeeLines((prev) => [...prev, newLine]);
  };

  const handleRemoveFeeLine = (lineId: string) => {
    setFeeLines((prev) => prev.filter((l) => l.id !== lineId));
  };

  // Xử lý lưu hồ sơ văn phòng + chi phí (đã gồm VAT) + xác nhận hình thức thanh toán + in phiếu K80
  const handleCompleteOfficeHaVo = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeOrder) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    if (
      !contNo.trim() ||
      !size ||
      !type ||
      !shippingLineCode ||
      !truckNo.trim() ||
      !customerRep.trim()
    ) {
      setErrorMsg(
        'Vui lòng nhập SỐ CONTAINER, SỐ XE và chọn đầy đủ SIZE, TYPE, HÃNG TÀU, ĐẠI DIỆN KHÁCH HÀNG theo cấu hình Danh mục chung.'
      );
      return;
    }

    if (feeLines.length === 0) {
      setErrorMsg(
        'Vui lòng thêm ít nhất 1 khoản chi phí trong Bảng thể hiện chi phí (Đã bao gồm VAT) trước khi xác nhận thanh toán.'
      );
      return;
    }

    try {
      // Bước 1: Lưu 5 thông tin Văn phòng tự nhập bổ sung & Bảng chi phí (Đã bao gồm VAT)
      const afterVerify = verifyGateInOfficeAndCreatePayment(state, {
        gateInId: activeOrder.id,
        containerNo: contNo,
        size,
        type,
        truckNo,
        customerRep,
        shippingLineCode,
        orderDocNo,
        feeLines,
        feeAmount: totalFeeInclVat,
      });

      // Bước 2: Xác nhận Hình thức thanh toán (TTT / TTS / TTTT) -> Cập nhật GATE IN OK & Sinh phiếu K80
      const afterPayment = confirmGateInPaymentAndComplete(afterVerify, {
        gateInId: activeOrder.id,
        paymentCategory,
        scannedQrCode,
        ttsNote,
        directMethod,
        providerTxRef,
      });

      onUpdateState(afterPayment);
      const latestTicket = afterPayment.k80Tickets[0];
      if (latestTicket) {
        onOpenK80Ticket(latestTicket);
      }

      // Reset form cho phiếu tiếp theo
      setContNo('');
      setSize('');
      setType('');
      setShippingLineCode('');
      setTruckNo('');
      setCustomerRep('');
      setFeeLines([]);

      setSuccessMsg(
        `Đã hoàn tất HẠ VỎ (GATE IN OK) cho container ${contNo.toUpperCase()} — Tổng chi phí (đã gồm VAT): ${formatVnd(
          totalFeeInclVat
        )}! Đã mở phiếu in K80 kèm Mã QR.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi xử lý Hạ vỏ');
    }
  };

  return (
    <div className="space-y-5">
      {errorMsg && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <p className="font-bold">Từ chối thao tác</p>
            <p>{errorMsg}</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-bold">Hoàn tất thủ tục Văn phòng — Hạ vỏ</p>
            <p>{successMsg}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* DANH SÁCH CÔNG VIỆC ĐANG CHỜ CỦA VĂN PHÒNG - HẠ VỎ (FIFO) */}
        <div className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Hàng Chờ Văn Phòng — HẠ VỎ
              </h3>
              <p className="text-[11px] text-slate-500">
                Do Giám định gửi sang (FIFO • Xong tự ẩn)
              </p>
            </div>
            <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-black text-white">
              {pendingOrders.length} chờ
            </span>
          </div>

          {pendingOrders.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
              Hiện không có container nào đang chờ thủ tục Hạ vỏ tại Văn phòng.
            </div>
          ) : (
            <div className="space-y-2">
              {pendingOrders.map((order) => {
                const isSelected = activeOrder?.id === order.id;
                const timeStr = new Date(
                  order.fieldRecordedAt
                ).toLocaleString('vi-VN', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                });
                return (
                  <div
                    key={order.id}
                    onClick={() => handleSelectOrder(order)}
                    className={`cursor-pointer rounded-lg border p-3 text-xs transition ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/80 ring-1 ring-blue-600'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-bold text-slate-900">
                        {order.orderCode}
                      </span>
                      <span className="font-mono text-[11px] text-slate-600">
                        {timeStr}
                      </span>
                      <span
                        className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                          order.conditionClass === 'DAMAGE'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {order.conditionClass}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-[11px] text-slate-600">
            💡 Hồ sơ sau khi xác nhận hoàn tất sẽ <strong>tự động in Phiếu K80</strong> cho khách hàng và chuyển sang danh sách <strong>TỒN VỎ</strong>. Muốn in lại phiếu tác nghiệp, vui lòng vào mục <strong>TỒN VỎ</strong> và tìm kiếm số container.
          </div>
        </div>

        {/* KHUNG THAO TÁC VĂN PHÒNG BÊN PHẢI */}
        <div className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          {activeOrder ? (
            <form onSubmit={handleCompleteOfficeHaVo} className="space-y-5">
              {/* THÔNG TIN & ẢNH CỬA CONT TỪ BỘ PHẬN GIÁM ĐỊNH */}
              <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:flex-row">
                <img
                  src={activeOrder.doorPhotoUrl}
                  alt="Ảnh cửa container do Giám định chụp"
                  className="h-36 w-52 rounded-xl object-cover border border-slate-300 shrink-0"
                />
                <div className="space-y-1.5 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onOpenDossier?.(
                          activeOrder.masterDossierCode || activeOrder.orderCode
                        )
                      }
                      className="rounded bg-blue-600 px-2 py-0.5 font-mono font-bold text-white hover:bg-blue-700"
                    >
                      Mã Hồ Sơ Chính:{' '}
                      {activeOrder.masterDossierCode || activeOrder.orderCode}
                    </button>
                    <span className="text-slate-500">
                      Giám định: <strong>{activeOrder.fieldStaffName}</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="rounded-lg bg-white p-2 border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">
                        TRẠNG THÁI GIÁM ĐỊNH
                      </span>
                      <span
                        className={`font-black text-sm ${
                          activeOrder.conditionClass === 'DAMAGE'
                            ? 'text-rose-600'
                            : 'text-emerald-600'
                        }`}
                      >
                        {activeOrder.conditionClass}
                      </span>
                      {activeOrder.damageRemarks?.length > 0 && (
                        <p className="text-[11px] font-medium text-rose-700">
                          Lỗi: {activeOrder.damageRemarks.join(', ')}
                        </p>
                      )}
                    </div>

                    <div className="rounded-lg bg-white p-2 border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">
                        ĐÓNG HÀNG & NĂM SINH (AGE)
                      </span>
                      <span className="font-black text-sm text-blue-700">
                        {activeOrder.stuffingClass} • Năm {activeOrder.manufactureYear}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-lg bg-white p-2 border border-slate-200">
                    <span className="text-[10px] text-slate-500 block">
                      PHƯƠNG ÁN VỆ SINH DO GIÁM ĐỊNH CHỌN:
                    </span>
                    <span className="font-bold text-indigo-800">
                      {activeOrder.cleaningItems.join(' + ')}
                    </span>
                  </div>
                </div>
              </div>

              {/* MỤC 1: NHÂN VIÊN VĂN PHÒNG NHẬP & CHỌN THEO CẤU HÌNH DANH MỤC CHUNG */}
              <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                  <h4 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                    <ClipboardCheck className="h-4 w-4 text-blue-600" />
                    1. Nhân Viên Văn Phòng Bổ Sung Hồ Sơ (Nhập xong Phần 1 mới hiển thị Phần 2)
                  </h4>
                  <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-900">
                    Chỉ được chọn theo cấu hình hạng mục
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="mb-1 block font-bold text-slate-700">
                      SỐ CONTAINER *
                    </label>
                    <input
                      type="text"
                      value={contNo}
                      onChange={(e) => setContNo(e.target.value.toUpperCase())}
                      placeholder="Nhập số cont (VD: MSKU6829104)..."
                      className="w-full rounded-lg border-2 border-blue-400 bg-blue-50/30 px-3 py-2 font-mono text-sm font-black uppercase placeholder:font-sans placeholder:font-normal placeholder:text-slate-400"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-bold text-slate-700">
                      SIZE (Theo Danh mục chung) *
                    </label>
                    <select
                      value={size}
                      onChange={(e) => {
                        const nextSz = e.target.value as '' | ContainerSize;
                        setSize(nextSz);
                        autoMatchLoloTariff(nextSz, type, shippingLineCode);
                      }}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 font-bold"
                      required
                    >
                      <option value="">-- Chọn Size --</option>
                      {containerSizes.map((sz) => (
                        <option key={sz} value={sz}>
                          {sz}&apos;
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block font-bold text-slate-700">
                      TYPE (Theo Danh mục chung) *
                    </label>
                    <select
                      value={type}
                      onChange={(e) => {
                        const nextTp = e.target.value as '' | ContainerType;
                        setType(nextTp);
                        autoMatchLoloTariff(size, nextTp, shippingLineCode);
                      }}
                      className="w-full rounded-lg border border-slate-300 px-3 py-2 font-bold"
                      required
                    >
                      <option value="">-- Chọn Type --</option>
                      {containerTypes.map((tp) => (
                        <option key={tp} value={tp}>
                          {tp}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* CHỈ HIỂN THỊ DÒNG THÔNG TIN TIẾP THEO KHI ĐÃ NHẬP XONG SỐ CONTAINER, SIZE, TYPE */}
                {Boolean(contNo.trim() && size && type) ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 pt-1 border-t border-slate-100">
                    <div>
                      <label className="mb-1 block font-bold text-slate-700">
                        HÃNG TÀU (Theo Danh mục chung) *
                      </label>
                      <select
                        value={shippingLineCode}
                        onChange={(e) => {
                          const nextLine = e.target.value;
                          setShippingLineCode(nextLine);
                          autoMatchLoloTariff(size, type, nextLine);
                        }}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 font-bold text-indigo-900"
                        required
                      >
                        <option value="">-- Chọn Hãng tàu --</option>
                        {shippingLineList.map((line) => (
                          <option key={line.id} value={line.code}>
                            {line.code} — {line.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block font-bold text-slate-700">
                        SỐ XE *
                      </label>
                      <input
                        type="text"
                        value={truckNo}
                        onChange={(e) => setTruckNo(e.target.value.toUpperCase())}
                        placeholder="Nhập biển số xe (VD: 15C-882.19)..."
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 uppercase font-bold placeholder:font-normal placeholder:normal-case placeholder:text-slate-400"
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block font-bold text-slate-700">
                        ĐẠI DIỆN KHÁCH HÀNG (Theo Danh mục chung) *
                      </label>
                      <select
                        value={customerRep}
                        onChange={(e) => setCustomerRep(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 font-bold text-slate-900"
                        required
                      >
                        <option value="">-- Chọn Khách hàng --</option>
                        {customerList.map((cust) => (
                          <option key={cust.id} value={cust.name}>
                            [{cust.code}] {cust.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ) : (
                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] font-medium text-slate-500">
                    ↳ Vui lòng nhập xong <strong>SỐ CONTAINER</strong>, chọn <strong>SIZE</strong> và <strong>TYPE</strong> ở trên để mở tiếp mục chọn <strong>HÃNG TÀU, SỐ XE &amp; ĐẠI DIỆN KHÁCH HÀNG</strong>.
                  </p>
                )}
              </div>

              {/* MỤC 2 (TÁCH RIÊNG): CHỈ HIỂN THỊ KHI ĐÃ NHẬP XONG ĐẦY ĐỦ MỤC 1 */}
              {Boolean(
                contNo.trim() &&
                  size &&
                  type &&
                  shippingLineCode &&
                  truckNo.trim() &&
                  customerRep.trim()
              ) && (
                <div className="space-y-3 rounded-xl border-2 border-indigo-200 bg-indigo-50/30 p-4 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-200/80 pb-2.5">
                    <div>
                      <h4 className="flex items-center gap-1.5 text-sm font-black text-indigo-950">
                        <Receipt className="h-4 w-4 text-indigo-600" />
                        2. Phần Chi Phí (Tách Riêng) — Bảng Thể Hiện Chi Phí ĐÃ BAO GỒM VAT
                      </h4>
                      <p className="mt-0.5 text-[11px] text-indigo-700">
                        Chỉ được chọn các biểu giá từ mục{' '}
                        <strong>
                          DANH MỤC CHUNG → BIỂU GIÁ (Nâng hạ theo Size - Type - Hãng tàu &amp; Thu gom rác)
                        </strong>
                        . Thêm xong chi phí mới hiển thị Phần 3 (Hình thức thanh toán).
                      </p>
                    </div>
                    <span className="rounded bg-indigo-100 px-2.5 py-1 text-[11px] font-bold text-indigo-800">
                      Cấu hình bởi Admin tại Danh Mục Chung
                    </span>
                  </div>

                  {/* Thanh chọn biểu giá từ DANH MỤC CHUNG để đưa vào Bảng chi phí */}
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12 items-end rounded-xl bg-white p-3 border border-indigo-100">
                    <div className="sm:col-span-6">
                      <label className="mb-1 block font-bold text-slate-700">
                        Chọn từ BIỂU GIÁ (Đã cấu hình trong Danh Mục Chung)
                      </label>
                      <select
                        value={selectedCatalogId}
                        onChange={(e) => setSelectedCatalogId(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 font-bold text-slate-800"
                      >
                        <optgroup label="- NÂNG HẠ (Theo từng Size - Type - Hãng tàu)">
                          {feeCatalog
                            .filter((item) => item.category === 'NANG_HA')
                            .map((item) => (
                              <option key={item.id} value={item.id}>
                                [{item.size || 'ALL'}&apos; • {item.type || 'ALL'} •{' '}
                                {item.shippingLineCode || 'ALL'}] {item.name} —{' '}
                                {formatVnd(item.defaultAmountInclVat)}
                              </option>
                            ))}
                        </optgroup>
                        <optgroup label="- THU GOM RÁC">
                          {feeCatalog
                            .filter((item) => item.category === 'THU_GOM_RAC')
                            .map((item) => (
                              <option key={item.id} value={item.id}>
                                [{item.code}] {item.name} —{' '}
                                {formatVnd(item.defaultAmountInclVat)}
                              </option>
                            ))}
                        </optgroup>
                        <optgroup label="- BIỂU GIÁ KHÁC (Vệ sinh / Dịch vụ bãi)">
                          {feeCatalog
                            .filter(
                              (item) =>
                                item.category !== 'NANG_HA' &&
                                item.category !== 'THU_GOM_RAC'
                            )
                            .map((item) => (
                              <option key={item.id} value={item.id}>
                                [{item.code}] {item.name} —{' '}
                                {formatVnd(item.defaultAmountInclVat)}
                              </option>
                            ))}
                        </optgroup>
                      </select>
                    </div>
                    <div className="sm:col-span-3">
                      <label className="mb-1 block font-bold text-slate-700">
                        Đơn giá cấu hình ĐÃ GỒM VAT
                      </label>
                      <input
                        type="text"
                        value={formatVnd(customLineAmount)}
                        readOnly
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono font-bold text-emerald-700"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <button
                        type="button"
                        onClick={handleAddFeeLine}
                        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-2 font-black text-white shadow-sm hover:bg-indigo-700"
                      >
                        <Plus className="h-4 w-4" />
                        THÊM CHI PHÍ
                      </button>
                    </div>
                  </div>

                  {/* BẢNG THỂ HIỆN CHI PHÍ (ĐÃ BAO GỒM VAT) */}
                  <div className="overflow-hidden rounded-xl border border-indigo-200 bg-white">
                    <div className="flex items-center justify-between bg-indigo-900 px-3.5 py-2 text-white">
                      <span className="font-bold uppercase tracking-wide text-[11px]">
                        BẢNG THỂ HIỆN CHI PHÍ ({feeLines.length} hạng mục)
                      </span>
                      <span className="rounded bg-emerald-500 px-2 py-0.5 text-[10px] font-black text-white">
                        ĐÃ BAO GỒM VAT
                      </span>
                    </div>

                    {feeLines.length === 0 ? (
                      <div className="p-4 text-center text-slate-500">
                        Chưa có chi phí nào trong bảng. Vui lòng chọn biểu giá từ{' '}
                        <strong>DANH MỤC CHUNG</strong> bên trên và bấm{' '}
                        <strong>+ THÊM CHI PHÍ</strong> để mở tiếp Phần 3 (Hình thức thanh toán).
                      </div>
                    ) : (
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-bold text-slate-600">
                            <th className="py-2 px-3 w-12">STT</th>
                            <th className="py-2 px-3">Mã HM</th>
                            <th className="py-2 px-3">Hạng mục chi phí (Biểu giá chung)</th>
                            <th className="py-2 px-3 text-right">
                              Thành tiền (ĐÃ BAO GỒM VAT)
                            </th>
                            <th className="py-2 px-3 text-center w-14">Xóa</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {feeLines.map((line, index) => (
                            <tr key={line.id} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-bold text-slate-500">
                                {index + 1}
                              </td>
                              <td className="py-2 px-3 font-mono text-[11px] font-bold text-indigo-700">
                                {line.catalogCode}
                              </td>
                              <td className="py-2 px-3 font-semibold text-slate-900">
                                {line.name}
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                                {formatVnd(line.amountInclVat)}
                              </td>
                              <td className="py-2 px-3 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFeeLine(line.id)}
                                  className="inline-flex items-center justify-center rounded p-1 text-rose-500 hover:bg-rose-50 hover:text-rose-700"
                                  title="Xóa khoản phí này"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t-2 border-indigo-200 bg-emerald-50/70">
                            <td
                              colSpan={3}
                              className="py-2.5 px-3 text-right font-black uppercase text-slate-900"
                            >
                              TỔNG CHI PHÍ THANH TOÁN (ĐÃ BAO GỒM VAT):
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-sm font-black text-emerald-700">
                              {formatVnd(totalFeeInclVat)}
                            </td>
                            <td />
                          </tr>
                        </tfoot>
                      </table>
                    )}
                  </div>
                </div>
              )}

              {/* MỤC 3: HÌNH THỨC THANH TOÁN — CHỈ HIỂN THỊ KHI ĐÃ XONG MỤC 1 & ĐÃ THÊM CHI PHÍ Ở MỤC 2 */}
              {Boolean(
                contNo.trim() &&
                  size &&
                  type &&
                  shippingLineCode &&
                  truckNo.trim() &&
                  customerRep.trim() &&
                  feeLines.length > 0
              ) && (
                <>
                  <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
                      <h4 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                        <CreditCard className="h-4 w-4 text-emerald-600" />
                        3. Hình Thức Thanh Toán (TTT / TTS / TTTT) &amp; In Phiếu K80 kèm Mã QR
                      </h4>
                      <span className="font-mono text-xs font-black text-emerald-700">
                        Tổng thu (đã gồm VAT): {formatVnd(totalFeeInclVat)}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5">
                      {(
                        [
                          {
                            code: 'TTT',
                            title: 'TTT — Thanh Toán Trước',
                            sub: 'Quét QR Phiếu thu mẹ & trừ dần',
                          },
                          {
                            code: 'TTS',
                            title: 'TTS — Thanh Toán Sau',
                            sub: 'Check nguồn & Note TTS vào chứng từ',
                          },
                          {
                            code: 'TTTT',
                            title: 'TTTT — Trực Tiếp',
                            sub: 'Chuyển khoản (API) / Tiền mặt',
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
                          <p className="font-bold text-slate-900">{opt.title}</p>
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {opt.sub}
                          </p>
                        </button>
                      ))}
                    </div>

                    {paymentCategory === 'TTT' && (
                      <div className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/70 p-3">
                        <QrCode className="h-5 w-5 text-blue-600 shrink-0" />
                        <select
                          value={scannedQrCode}
                          onChange={(e) => setScannedQrCode(e.target.value)}
                          className="flex-1 rounded-lg border border-blue-300 bg-white px-3 py-2 font-mono font-bold"
                        >
                          {state.masterReceipts.map((r) => (
                            <option key={r.id} value={r.qrCode}>
                              {r.qrCode} — {r.customerName} (Dư:{' '}
                              {formatVnd(r.remainingAmount)})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {paymentCategory === 'TTS' && (
                      <div className="flex items-center gap-2 rounded-xl border border-purple-200 bg-purple-50/70 p-3">
                        <FileText className="h-5 w-5 text-purple-600 shrink-0" />
                        <input
                          type="text"
                          value={ttsNote}
                          onChange={(e) => setTtsNote(e.target.value)}
                          placeholder="Note xác nhận TTS trên chứng từ..."
                          className="flex-1 rounded-lg border border-purple-300 bg-white px-3 py-2"
                        />
                      </div>
                    )}

                    {paymentCategory === 'TTTT' && (
                      <div className="grid grid-cols-2 gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                        <button
                          type="button"
                          onClick={() => setDirectMethod('BANK_TRANSFER_API')}
                          className={`rounded-lg border py-2 font-bold ${
                            directMethod === 'BANK_TRANSFER_API'
                              ? 'border-amber-600 bg-amber-600 text-white'
                              : 'bg-white text-slate-700'
                          }`}
                        >
                          Chuyển khoản (API)
                        </button>
                        <button
                          type="button"
                          onClick={() => setDirectMethod('CASH')}
                          className={`rounded-lg border py-2 font-bold ${
                            directMethod === 'CASH'
                              ? 'border-amber-600 bg-amber-600 text-white'
                              : 'bg-white text-slate-700'
                          }`}
                        >
                          Tiền mặt
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-black text-white shadow-sm hover:bg-emerald-700"
                  >
                    <Printer className="h-5 w-5" />
                    XÁC NHẬN THANH TOÁN (GATE IN OK) &amp; IN PHIẾU K80 CÓ MÃ QR CHO LÁI XE
                  </button>
                </>
              )}
            </form>
          ) : (
            <div className="py-12 text-center text-sm text-slate-500">
              Tất cả hồ sơ Hạ vỏ trong hàng chờ đã được xử lý xong.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// BỘ PHẬN VĂN PHÒNG — CẤP VỎ (Chỉ các cont AV mới vào danh sách sẵn sàng CẤP VỎ)
// ============================================================================

export const OfficeCapVoWorkspace: React.FC<OfficeHaVoProps> = ({
  state,
  onUpdateState,
  onOpenK80Ticket,
  onOpenDossier,
}) => {
  // Chỉ các cont AV (không bị Hold, không chờ vệ sinh/sửa chữa) mới nằm trong hàng chờ sẵn sàng CẤP VỎ
  const avReadyContainers = state.containers.filter(
    (c) =>
      c.status === 'IN_YARD' &&
      c.conditionClass === 'AV' &&
      !c.isOnHold &&
      !c.needsRepair
  );

  const [bookingNo, setBookingNo] = useState('');
  const [selectedContNo, setSelectedContNo] = useState(
    avReadyContainers[0]?.containerNo || ''
  );
  const [truckNo, setTruckNo] = useState('');
  const [receiverName, setReceiverName] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleIssueCapVo = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      let currentState = state;
      let booking = currentState.bookings.find(
        (b) => b.bookingNo === bookingNo.trim().toUpperCase()
      );
      const targetCont = currentState.containers.find(
        (c) => c.containerNo === selectedContNo
      );
      if (!targetCont) {
        throw new Error('Vui lòng chọn container AV cần cấp vỏ.');
      }

      if (!booking) {
        booking = {
          id: `bk-${Date.now()}`,
          bookingNo: bookingNo.trim().toUpperCase(),
          releaseType: 'EMPTY_RELEASE',
          shippingLineCode: targetCont.shippingLineCode,
          requesterName: receiverName,
          receiverName,
          size: targetCont.size,
          type: targetCont.type,
          requestedQty: 5,
          allocatedContainers: [],
          gatedOutContainers: [],
          status: 'OPEN',
          createdAt: new Date().toISOString(),
        };
        currentState = {
          ...currentState,
          bookings: [booking, ...currentState.bookings],
        };
      }

      const next = allocateContainerToBooking(currentState, {
        bookingId: booking.id,
        containerNo: selectedContNo,
        truckNo,
      });

      onUpdateState(next);
      const latestTicket = next.k80Tickets[0];
      if (latestTicket) {
        onOpenK80Ticket(latestTicket);
      }

      const remainingAv = next.containers.filter(
        (c) =>
          c.status === 'IN_YARD' &&
          c.conditionClass === 'AV' &&
          !c.isOnHold
      );
      setSelectedContNo(remainingAv[0]?.containerNo || '');
      setSuccessMsg(
        `Đã lập lệnh CẤP VỎ cho container AV ${selectedContNo}! Đã in phiếu K80 kèm Mã QR và đẩy sang hàng chờ BỘ PHẬN XE NÂNG -> CHỜ CẤP VỎ.`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi cấp vỏ');
    }
  };

  return (
    <div className="space-y-5">
      {errorMsg && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <p>{errorMsg}</p>
        </div>
      )}

      {successMsg && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <p className="font-semibold">{successMsg}</p>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* DANH SÁCH CONT AV ĐỦ ĐIỀU KIỆN TRONG HÀNG CHỜ CẤP VỎ */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Danh Sách Container AV Sẵn Sàng CẤP VỎ
              </h3>
              <p className="text-[11px] text-slate-500">
                Chỉ hiển thị các container đạt trạng thái AV trong bãi
              </p>
            </div>
            <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-black text-white">
              {avReadyContainers.length} AV
            </span>
          </div>

          <div className="space-y-2">
            {avReadyContainers.map((c) => (
              <div
                key={c.id}
                onClick={() => setSelectedContNo(c.containerNo)}
                className={`cursor-pointer rounded-xl border p-3 text-xs transition ${
                  selectedContNo === c.containerNo
                    ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-600'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-black text-slate-900">
                    {c.containerNo} ({c.size}&apos;{c.type})
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenDossier?.(c.masterDossierCode);
                      }}
                      className="rounded bg-blue-100 px-2 py-0.5 font-mono text-[10px] font-bold text-blue-800 hover:bg-blue-200"
                    >
                      Hồ sơ: {c.masterDossierCode}
                    </button>
                    <span className="rounded bg-emerald-100 px-2 py-0.5 font-black text-emerald-800">
                      AV • Năm {c.manufactureYear}
                    </span>
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-slate-600">
                  Vị trí: <strong>{c.currentBlock || 'Bãi'}</strong>{' '}
                  {c.currentBay ? `(${c.currentBay}-${c.currentRow}-${c.currentTier})` : '(Cấp Block)'}{' '}
                  • Hãng tàu: <strong>{c.shippingLineCode}</strong>
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* FORM LẬP LỆNH CẤP VỎ & IN PHIẾU K80 */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <h3 className="mb-4 flex items-center gap-2 text-base font-bold text-slate-900">
            <Truck className="h-5 w-5 text-emerald-600" />
            Thao Tác Văn Phòng — CẤP VỎ & In Phiếu K80 Có Mã QR
          </h3>

          <form onSubmit={handleIssueCapVo} className="space-y-4 text-xs">
            {/* PHẦN 1: SỐ LỆNH BOOKING & CHỌN CONTAINER AV */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-3">
              <p className="font-bold text-slate-900">
                1. Chọn Container AV &amp; Nhập Số Lệnh Cấp / Booking
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block font-bold text-slate-700">
                    Số Lệnh Cấp / Booking *
                  </label>
                  <input
                    type="text"
                    value={bookingNo}
                    onChange={(e) => setBookingNo(e.target.value.toUpperCase())}
                    placeholder="Nhập số Booking (VD: BK-MSK-2026-109)..."
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono font-bold uppercase"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block font-bold text-slate-700">
                    Container AV được chọn cấp *
                  </label>
                  <input
                    type="text"
                    value={selectedContNo}
                    readOnly
                    placeholder="Chọn container AV ở danh sách bên trái..."
                    className="w-full rounded-lg border border-emerald-400 bg-emerald-50 px-3 py-2 font-mono font-black text-emerald-900"
                  />
                </div>
              </div>
            </div>

            {/* PHẦN 2: CHỈ HIỂN THỊ KHI ĐÃ XONG PHẦN 1 (CÓ BOOKING & ĐÃ CHỌN CONT AV) */}
            {Boolean(bookingNo.trim() && selectedContNo) && (
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-3">
                <p className="font-bold text-slate-900">
                  2. Thông Tin Phương Tiện &amp; Khách Hàng Nhận Vỏ
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1 block font-bold text-slate-700">
                      Số Xe Vào Nhận Vỏ *
                    </label>
                    <input
                      type="text"
                      value={truckNo}
                      onChange={(e) => setTruckNo(e.target.value.toUpperCase())}
                      placeholder="Nhập biển số xe (VD: 15H-686.88)..."
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-bold uppercase"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-bold text-slate-700">
                      Khách Hàng / Bên Nhận Vỏ (Theo Danh mục chung) *
                    </label>
                    <select
                      value={receiverName}
                      onChange={(e) => setReceiverName(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-bold text-slate-900"
                      required
                    >
                      <option value="">-- Chọn Khách hàng nhận vỏ --</option>
                      {state.partners
                        .filter((p) => p.isCustomer)
                        .map((cust) => (
                          <option key={cust.id} value={cust.name}>
                            [{cust.code}] {cust.name}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {/* NÚT XÁC NHẬN: CHỈ HIỂN THỊ KHI ĐÃ NHẬP ĐỦ CẢ PHẦN 1 & PHẦN 2 */}
            {Boolean(
              bookingNo.trim() &&
                selectedContNo &&
                truckNo.trim() &&
                receiverName.trim()
            ) && (
              <button
                type="submit"
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3.5 text-sm font-black text-white shadow-sm hover:bg-emerald-700"
              >
                <Printer className="h-5 w-5" />
                KHÓA PHÂN BỔ CONT &amp; IN PHIẾU K80 (ĐẨY SANG XE NÂNG CHỜ CẤP VỎ)
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// BỘ PHẬN VĂN PHÒNG — NHẬP TÀU & XUẤT TÀU
// ============================================================================

export const OfficeVesselBatchWorkspace: React.FC<{
  mode: 'NHAP_TAU' | 'XUAT_TAU';
  state: DepotState;
  onUpdateState: (next: DepotState) => void;
}> = ({ mode, state, onUpdateState }) => {
  const [vesselName, setVesselName] = useState('');
  const [contNo, setContNo] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const handleBatchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'NHAP_TAU') {
      const next = recordGateInFieldStep(state, {
        gateInType: 'VESSEL_IMPORT',
        doorPhotoUrl:
          'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=800&q=80',
        initialContainerHint: contNo,
        conditionClass: 'AV',
        stuffingClass: 'E',
        cleaningItems: ['KHÔNG VỆ SINH'],
        manufactureYear: 2020,
      });
      onUpdateState(next);
      setMsg(
        `Đã tiếp nhận container ${contNo} thuộc lô NHẬP TÀU (${vesselName}) vào hàng chờ xử lý!`
      );
    } else {
      setMsg(
        `Đã ghi nhận lệnh XUẤT TÀU (${vesselName}) đưa container ${contNo} ra cảng!`
      );
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-blue-50 p-2.5 text-blue-600">
          <Ship className="h-6 w-6" />
        </div>
        <div>
          <h2 className="text-base font-extrabold text-slate-900">
            BỘ PHẬN VĂN PHÒNG — {mode === 'NHAP_TAU' ? 'NHẬP TÀU' : 'XUẤT TÀU'}
          </h2>
          <p className="text-xs text-slate-500">
            {mode === 'NHAP_TAU'
              ? 'Bãi tổ chức đoàn xe kéo vận chuyển lô container rỗng từ cảng về bãi'
              : 'Bãi tổ chức đoàn xe kéo vận chuyển lô container rỗng từ bãi ra cảng'}
          </p>
        </div>
      </div>

      {msg && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-900">
          {msg}
        </div>
      )}

      <form onSubmit={handleBatchSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-3 text-xs">
        <div>
          <label className="mb-1 block font-bold text-slate-700">
            1. Tên tàu / Chuyến tàu *
          </label>
          <input
            type="text"
            value={vesselName}
            onChange={(e) => setVesselName(e.target.value)}
            placeholder="Nhập tên tàu / chuyến tàu..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            required
          />
        </div>
        {vesselName.trim() !== '' && (
          <div>
            <label className="mb-1 block font-bold text-slate-700">
              2. Số Container trong lô *
            </label>
            <input
              type="text"
              value={contNo}
              onChange={(e) => setContNo(e.target.value.toUpperCase())}
              placeholder="Nhập số container..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono uppercase"
              required
            />
          </div>
        )}
        {vesselName.trim() !== '' && contNo.trim() !== '' && (
          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-xl bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700"
            >
              Xác nhận Lệnh {mode === 'NHAP_TAU' ? 'Nhập Tàu' : 'Xuất Tàu'}
            </button>
          </div>
        )}
      </form>
    </div>
  );
};
