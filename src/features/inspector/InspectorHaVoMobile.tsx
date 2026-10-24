import React, { useEffect, useRef, useState } from 'react';
import { InspectionFields } from '../../components/InspectionFields';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock,
  Eye,
  Plus,
  RefreshCw,
  Send,
  ShieldAlert,
  Upload,
  X,
} from 'lucide-react';
import {
  FieldCleaningItem,
  FieldConditionClass,
  FieldStuffingClass,
  GateInOrder,
} from '../../types/depot';
import { DepotState } from '../../services/depotStore';
import {
  deleteGateInFieldRecord,
  recordGateInFieldStep,
} from '../../services/depotOperations';
import { peekNextCode } from '../../services/codes';
import { formatDateTime } from '../../services/datetime';

interface Props {
  state: DepotState;
  onUpdateState: (next: DepotState) => void;
  onOpenDossier?: (masterDossierCode: string) => void;
}



export const InspectorHaVoMobile: React.FC<Props> = ({
  state,
  onUpdateState,
  onOpenDossier,
}) => {
  // Danh sách màn hình chờ của Giám định — Hạ vỏ:
  // Cont nào Văn phòng đã thực hiện tác nghiệp xác nhận rồi (GATE_IN_OK) sẽ tự động ẩn, không hiển thị ở màn hình chờ của Giám định nữa.
  // Tác nghiệp mới được xác nhận luôn ưu tiên hiển thị trên cùng.
  const recentOrders = [...state.gateInOrders]
    .filter((o) => o.status !== 'GATE_IN_OK' && o.status !== 'CANCELLED')
    .sort(
      (a, b) =>
        new Date(b.fieldRecordedAt).getTime() -
        new Date(a.fieldRecordedAt).getTime()
    );

  // Xem chi tiết khi kích vào 1 dòng trong danh sách
  const [selectedOrder, setSelectedOrder] = useState<GateInOrder | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Luồng tạo tác nghiệp mới theo từng bước:
  // - Khi mới bấm (+): CHỈ hiển thị màn chụp ảnh cửa cont (chưa có doorPhotoDataUrl)
  // - Chụp ảnh xong: Mới hiển thị các tác nghiệp chọn tiếp theo (yêu cầu nhập đủ mới được bấm NEXT)
  // - Bấm NEXT: Chuyển sang bước XÁC NHẬN TÁC NGHIỆP
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [doorPhotoDataUrl, setDoorPhotoDataUrl] = useState<string>('');
  const [cameraOpen, setCameraOpen] = useState<boolean>(false);

  // Khởi tạo rỗng để bắt buộc Giám định phải chọn đủ từng mục trước khi Next
  const [conditionClass, setConditionClass] =
    useState<FieldConditionClass | null>(null);
  const [selectedDamageRemarks, setSelectedDamageRemarks] = useState<string[]>(
    []
  );
  const [customDamageNote, setCustomDamageNote] = useState('');
  const [stuffingClass, setStuffingClass] =
    useState<FieldStuffingClass | null>(null);
  const [cleaningItems, setCleaningItems] = useState<FieldCleaningItem[]>([]);
  const [manufactureYear, setManufactureYear] = useState<string>('');

  // Bước xác nhận cuối sau khi đã nhập đủ và bấm NEXT
  const [isReadyToConfirmStep, setIsReadyToConfirmStep] =
    useState<boolean>(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  };

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  // Mở Camera trực tiếp ngay trên màn hình App
  const handleStartLiveCamera = async () => {
    setErrorMsg(null);
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = mediaStream;
      setCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch {
      fileInputRef.current?.click();
    }
  };

  // Bấm dấu (+) góc phải dưới màn hình -> Tạo Mã Hồ Sơ Chính tự động & Chỉ hiển thị màn chụp ảnh cửa cont
  const handleCreateNewKey = () => {
    // Chỉ là mã dự kiến để hiển thị; mã thật do hệ thống cấp khi xác nhận (CR-07)
    const newKey = peekNextCode(state, 'HV');
    setSelectedOrder(null);
    setActiveKey(newKey);
    setDoorPhotoDataUrl('');
    setConditionClass(null);
    setSelectedDamageRemarks([]);
    setCustomDamageNote('');
    setStuffingClass(null);
    setCleaningItems([]);
    setManufactureYear('');
    setIsReadyToConfirmStep(false);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  // Chụp khung hình từ Camera trực tiếp trên màn hình App
  const handleCaptureFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 800;
    canvas.height = video.videoHeight || 600;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setDoorPhotoDataUrl(dataUrl);
    }
    stopCameraStream();
  };

  const handleFileCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setDoorPhotoDataUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Kiểm tra đã nhập đủ tất cả các trường bắt buộc chưa
  const parsedYear = Number(manufactureYear);
  const isYearValid =
    manufactureYear.trim().length === 4 &&
    !Number.isNaN(parsedYear) &&
    parsedYear >= 1980 &&
    parsedYear <= 2030;
  const isDamageValid =
    conditionClass !== 'DAMAGE' ||
    selectedDamageRemarks.length > 0 ||
    customDamageNote.trim().length > 0;

  const isAllFieldsValid = Boolean(
    doorPhotoDataUrl &&
      conditionClass &&
      isDamageValid &&
      stuffingClass &&
      cleaningItems.length > 0 &&
      isYearValid
  );

  const handleNextToConfirm = () => {
    setErrorMsg(null);
    if (!doorPhotoDataUrl) {
      setErrorMsg('Vui lòng chụp ảnh cửa container trước.');
      return;
    }
    if (!conditionClass) {
      setErrorMsg('Vui lòng chọn TRẠNG THÁI (AV hoặc DAMAGE).');
      return;
    }
    if (!isDamageValid) {
      setErrorMsg(
        'Container DAMAGE: Vui lòng chọn ít nhất 1 lỗi hư hỏng hoặc nhập ghi chú hư hỏng.'
      );
      return;
    }
    if (!stuffingClass) {
      setErrorMsg('Vui lòng chọn PHÂN LOẠI ĐÓNG HÀNG (M / K / E).');
      return;
    }
    if (cleaningItems.length === 0) {
      setErrorMsg('Vui lòng chọn TÌNH TRẠNG VỆ SINH.');
      return;
    }
    if (!isYearValid) {
      setErrorMsg('Vui lòng chọn hoặc nhập năm sản xuất AGE hợp lệ (4 chữ số, VD: 2018).');
      return;
    }
    setIsReadyToConfirmStep(true);
  };

  const handleConfirmOperation = () => {
    if (!isAllFieldsValid || !conditionClass || !stuffingClass) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const remarks = [...selectedDamageRemarks];
      if (customDamageNote.trim()) {
        remarks.push(customDamageNote.trim());
      }

      const next = recordGateInFieldStep(state, {
        gateInType: 'CUSTOMER_RETURN',
        doorPhotoUrl: doorPhotoDataUrl,
        conditionClass,
        damageRemarks: remarks,
        stuffingClass,
        cleaningItems,
        manufactureYear: parsedYear,
      });

      onUpdateState(next);
      const created = next.gateInOrders[0];
      stopCameraStream();
      setActiveKey(null);
      setIsReadyToConfirmStep(false);
      setSuccessMsg(
        `Đã xác nhận tác nghiệp [${created.masterDossierCode}] — Đã đưa lên đầu danh sách chờ và chuyển sang Văn phòng.`
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Lỗi xác nhận tác nghiệp'
      );
    }
  };

  return (
    <div className="relative mx-auto w-full max-w-lg space-y-4 pb-24">
      {/* TIÊU ĐỀ MÀN HẠ VỎ (TỐI ƯU MOBILE NGOÀI HIỆN TRƯỜNG) */}
      {/* Đồng bộ tiêu đề với các màn mobile khác (Vệ sinh, Xe nâng, Sửa chữa) */}
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2.5">
        <div>
          <span className="block text-[11px] font-semibold uppercase text-slate-500">Bộ phận Giám định</span>
          <h2 className="text-sm font-bold text-slate-900">Hạ vỏ</h2>
        </div>
        <span className="rounded bg-slate-900 px-2.5 py-1 text-xs font-bold text-white">{recentOrders.length}</span>
      </div>

      {errorMsg && !activeKey && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">{errorMsg}</div>
      )}
      {successMsg && (
        <div className="flex items-start justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span className="font-medium">{successMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="text-emerald-700 hover:text-emerald-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* BẢNG DANH SÁCH CÁC TÁC NGHIỆP GẦN NHẤT: SỐ PHIẾU - THỜI GIAN XÁC NHẬN GIÁM ĐỊNH - TRẠNG THÁI */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="grid grid-cols-12 border-b border-slate-200 bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700">
          <div className="col-span-4">Số phiếu (Mã Hồ Sơ Chính)</div>
          <div className="col-span-5">Thời gian xác nhận giám định</div>
          <div className="col-span-3 text-right">Trạng thái</div>
        </div>

        {recentOrders.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Chưa có tác nghiệp Hạ vỏ nào đang chờ. Bấm nút dấu (+) góc phải dưới màn hình để tạo tác nghiệp mới.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {recentOrders.map((item, idx) => {
              const isSelected = selectedOrder?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    setSelectedOrder(isSelected ? null : item)
                  }
                  className={`grid w-full grid-cols-12 items-center px-4 py-3.5 text-left text-xs transition ${
                    isSelected
                      ? 'bg-blue-50/80 font-semibold'
                      : 'hover:bg-slate-50'
                  }`}
                >
                  {/* Cột 1: Số phiếu */}
                  <div className="col-span-4 flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-blue-700">
                      {item.masterDossierCode || item.orderCode}
                    </span>
                  </div>

                  {/* Cột 2: Thời gian xác nhận giám định */}
                  <div className="col-span-5 flex items-center gap-1.5 text-slate-700">
                    <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="font-mono">
                      {formatDateTime(item.fieldRecordedAt)}
                    </span>
                  </div>

                  {/* Cột 3: Trạng thái */}
                  <div className="col-span-3 flex items-center justify-end gap-2">
                    <span
                      className={`rounded px-2.5 py-1 text-xs font-bold ${
                        item.conditionClass === 'DAMAGE'
                          ? 'bg-rose-100 text-rose-700'
                          : 'bg-emerald-100 text-emerald-700'
                      }`}
                    >
                      {item.conditionClass}
                    </span>
                    <Eye className="h-3.5 w-3.5 text-slate-400" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* PANEL XEM CHI TIẾT KHI KÍCH VÀO 1 TÁC NGHIỆP TRONG DANH SÁCH */}
      {selectedOrder && (
        <div className="rounded-lg border border-blue-200 bg-white p-4 shadow-xs">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
            <div>
              <span className="text-[11px] text-slate-500 block">
                Chi tiết Mã Hồ Sơ Chính (Khởi tạo từ Giám định xuyên suốt đến khi Out bãi)
              </span>
              <h3 className="font-mono text-base font-bold text-blue-700">
                {selectedOrder.masterDossierCode || selectedOrder.orderCode}
              </h3>
            </div>
            <div className="flex items-center gap-2">
              {onOpenDossier && (
                <button
                  type="button"
                  onClick={() =>
                    onOpenDossier(
                      selectedOrder.masterDossierCode || selectedOrder.orderCode
                    )
                  }
                  className="rounded bg-blue-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-blue-700"
                >
                  Xem tiến độ liên thông
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="rounded border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                Đóng chi tiết
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
            <div className="md:col-span-5">
              <p className="mb-1 text-xs font-semibold text-slate-600">
                Ảnh chụp cửa Container:
              </p>
              <img
                src={selectedOrder.doorPhotoUrl}
                alt={`Ảnh cửa cont ${selectedOrder.orderCode}`}
                className="h-48 w-full rounded-lg border border-slate-200 object-cover"
              />
            </div>

            <div className="md:col-span-7 grid grid-cols-2 gap-2.5 text-xs">
              <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
                <span className="text-[11px] text-slate-500 block">
                  Số phiếu / Mã Hồ Sơ Chính
                </span>
                <span className="font-mono text-sm font-bold text-slate-900">
                  {selectedOrder.masterDossierCode || selectedOrder.orderCode}
                </span>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
                <span className="text-[11px] text-slate-500 block">
                  Thời gian xác nhận giám định
                </span>
                <span className="font-mono font-semibold text-slate-900">
                  {formatDateTime(selectedOrder.fieldRecordedAt)}
                </span>
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
                <span className="text-[11px] text-slate-500 block">
                  Trạng thái
                </span>
                <span
                  className={`inline-block rounded px-2 py-0.5 text-xs font-bold ${
                    selectedOrder.conditionClass === 'DAMAGE'
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {selectedOrder.conditionClass}
                </span>
                {selectedOrder.damageRemarks.length > 0 && (
                  <p className="mt-1 text-[11px] text-rose-700">
                    Lỗi: {selectedOrder.damageRemarks.join(', ')}
                  </p>
                )}
              </div>

              <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5">
                <span className="text-[11px] text-slate-500 block">
                  Phân loại đóng hàng & AGE
                </span>
                <span className="font-bold text-slate-900">
                  Đóng hàng: {selectedOrder.stuffingClass} • AGE:{' '}
                  {selectedOrder.manufactureYear}
                </span>
              </div>

              <div className="col-span-2 rounded-md border border-slate-200 bg-slate-50 p-2.5">
                <span className="text-[11px] text-slate-500 block">
                  Tình trạng vệ sinh
                </span>
                <span className="font-bold text-slate-900">
                  {selectedOrder.cleaningItems.join(', ')}
                </span>
              </div>
            </div>
          </div>

          {/* DEC-059: Giám định xóa hồ sơ khi Văn phòng chưa thao tác — xác nhận 2 bước */}
          {selectedOrder.status === 'FIELD_RECORDED' && !selectedOrder.officeVerifiedAt && !selectedOrder.voucherId && (
            <div className="mt-3 border-t border-slate-100 pt-3">
              {confirmDeleteId === selectedOrder.id ? (
                <div className="flex flex-col gap-2 rounded-md border border-red-300 bg-red-50 p-3 text-xs text-red-800 sm:flex-row sm:items-center sm:justify-between">
                  <span>Xóa hẳn hồ sơ <strong className="font-mono">{selectedOrder.masterDossierCode}</strong>? Không lưu lịch sử, không khôi phục được.</span>
                  <span className="flex gap-2">
                    <button type="button" onClick={() => setConfirmDeleteId(null)} className="rounded border border-slate-300 bg-white px-3 py-2 font-semibold text-slate-700">Hủy</button>
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          onUpdateState(deleteGateInFieldRecord(state, { gateInId: selectedOrder.id }));
                          setSuccessMsg(`Đã xóa hồ sơ ${selectedOrder.masterDossierCode}.`);
                          setSelectedOrder(null);
                        } catch (err) {
                          setErrorMsg(err instanceof Error ? err.message : 'Không xóa được hồ sơ');
                        }
                        setConfirmDeleteId(null);
                      }}
                      className="rounded bg-red-600 px-3 py-2 font-bold text-white hover:bg-red-700"
                    >
                      Xác nhận xóa
                    </button>
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDeleteId(selectedOrder.id)}
                  className="w-full rounded-md border border-red-300 bg-white py-2.5 text-xs font-bold text-red-700 hover:bg-red-50"
                >
                  Xóa hồ sơ (Văn phòng chưa thao tác)
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* NÚT DẤU (+) BÊN PHẢI DƯỚI MÀN HÌNH ĐỂ TẠO TÁC NGHIỆP MỚI */}
      <button
        type="button"
        onClick={handleCreateNewKey}
        title="Tạo tác nghiệp Hạ vỏ mới"
        className="sticky bottom-6 z-30 ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg hover:bg-blue-700 active:scale-95 transition"
      >
        <Plus className="h-7 w-7 stroke-[2.5]" />
      </button>

      {/* MODAL TẠO TÁC NGHIỆP MỚI THEO TỪNG BƯỚC (STEP-BY-STEP) */}
      {activeKey && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="my-auto w-full max-w-md rounded-lg border border-slate-200 bg-white p-4 shadow-xl max-h-[92vh] overflow-y-auto space-y-4">
            {/* HEADER MÃ HỒ SƠ CHÍNH */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-2.5">
              <div>
                <span className="text-[11px] text-slate-500 block">
                  MÃ HỒ SƠ HẠ VỎ (dự kiến — cấp chính thức khi xác nhận)
                </span>
                <span className="font-mono text-base font-bold text-blue-700">
                  {activeKey}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  stopCameraStream();
                  setActiveKey(null);
                  setIsReadyToConfirmStep(false);
                }}
                className="rounded border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                Đóng
              </button>
            </div>

            {/* THANH TIẾN TRÌNH 3 BƯỚC RÕ RÀNG */}
            <div className="grid grid-cols-3 gap-1.5 text-center text-[11px] font-bold">
              <div
                className={`rounded py-1.5 ${
                  !doorPhotoDataUrl
                    ? 'bg-blue-600 text-white'
                    : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                1. Chụp Cửa Cont
              </div>
              <div
                className={`rounded py-1.5 ${
                  doorPhotoDataUrl && !isReadyToConfirmStep
                    ? 'bg-blue-600 text-white'
                    : isReadyToConfirmStep
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                2. Chọn Thông Tin
              </div>
              <div
                className={`rounded py-1.5 ${
                  isReadyToConfirmStep
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                3. Xác Nhận
              </div>
            </div>

            {errorMsg && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
                <ShieldAlert className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Input camera điện thoại ẩn */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileCapture}
              className="hidden"
            />

            {/* ==============================================================
                BƯỚC 1: KHI CHƯA CHỤP ẢNH -> CHỈ HIỂN THỊ MÀN CHỤP ẢNH CỬA CONT
               ============================================================== */}
            {!doorPhotoDataUrl ? (
              <div className="space-y-3 py-2">
                <p className="text-center text-xs font-bold text-slate-800">
                  Bước 1: Chụp ảnh cửa Container (Nhìn rõ số Cont) để bắt đầu tác nghiệp
                </p>

                {cameraOpen ? (
                  <div className="space-y-2 rounded-lg border border-slate-300 bg-black p-2">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="h-60 w-full rounded object-cover"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleCaptureFrame}
                        className="flex-1 rounded-lg bg-blue-600 py-3 text-xs font-bold text-white"
                      >
                        Chụp Ảnh Ngay
                      </button>
                      <button
                        type="button"
                        onClick={stopCameraStream}
                        className="rounded-lg bg-slate-700 px-4 py-3 text-xs font-semibold text-white"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    <button
                      type="button"
                      onClick={handleStartLiveCamera}
                      className="flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-blue-500 bg-blue-50/50 py-10 text-sm font-bold text-blue-700 hover:bg-blue-50 active:scale-98"
                    >
                      <Camera className="h-9 w-9 text-blue-600" />
                      CHỤP ẢNH CỬA CONTAINER TẠI APP
                    </button>

                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white py-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      <Upload className="h-4 w-4 text-slate-500" />
                      Mở Camera Điện Thoại / Chọn Ảnh
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setDoorPhotoDataUrl(
                          'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80'
                        )
                      }
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 text-[11px] font-medium text-slate-600 hover:bg-slate-100"
                    >
                      Dùng ảnh mẫu cửa Cont (khi kiểm thử trên máy tính)
                    </button>
                  </div>
                )}
              </div>
            ) : !isReadyToConfirmStep ? (
              /* ==============================================================
                 BƯỚC 2: ĐÃ CHỤP ẢNH XONG -> MỚI HIỂN THỊ CÁC TÁC NGHIỆP CHỌN TIẾP THEO
                 YÊU CẦU NHẬP ĐỦ MỚI BẤM NEXT ĐẾN XÁC NHẬN TÁC NGHIỆP
                 ============================================================== */
              <div className="space-y-4">
                {/* ẢNH ĐÃ CHỤP GỌN Ở TRÊN + NÚT CHỤP LẠI */}
                <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-2">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={doorPhotoDataUrl}
                      alt="Ảnh cửa container"
                      className="h-14 w-20 rounded object-cover border border-slate-300"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-emerald-700 block">
                        ✓ Đã chụp ảnh cửa Cont
                      </span>
                      <span className="text-[11px] text-slate-500">
                        Vui lòng chọn đủ 4 mục bên dưới
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDoorPhotoDataUrl('');
                      setIsReadyToConfirmStep(false);
                    }}
                    className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Chụp lại
                  </button>
                </div>

                {/* UI-02: form Giám định dùng chung (hiện lần lượt từng mục) */}
                <InspectionFields
                  progressive
                  value={{
                    condition: conditionClass || '',
                    damage: selectedDamageRemarks,
                    damageNote: customDamageNote,
                    stuffing: stuffingClass || '',
                    cleaning: cleaningItems,
                    year: manufactureYear,
                  }}
                  onChange={(x) => {
                    setConditionClass(x.condition || null);
                    setSelectedDamageRemarks(x.condition === 'DAMAGE' ? x.damage : []);
                    setCustomDamageNote(x.condition === 'DAMAGE' ? x.damageNote : '');
                    setStuffingClass(x.stuffing || null);
                    setCleaningItems(x.cleaning);
                    setManufactureYear(x.year);
                  }}
                />

                {/* NÚT TIẾP TỤC (NEXT) -> CHỈ HIỂN THỊ KHI ĐÃ NHẬP XONG ĐỦ CẢ 4 MỤC */}
                {isAllFieldsValid && (
                  <button
                    type="button"
                    onClick={handleNextToConfirm}
                    className="flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 active:scale-98"
                  >
                    <span>TIẾP TỤC (NEXT) ĐẾN XÁC NHẬN TÁC NGHIỆP</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                )}
              </div>
            ) : (
              /* ==============================================================
                 BƯỚC 3: ĐÃ NHẬP ĐỦ & BẤM NEXT -> HIỂN THỊ MÀN XÁC NHẬN TÁC NGHIỆP
                 ============================================================== */
              <div className="space-y-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2.5 text-xs">
                  <img
                    src={doorPhotoDataUrl}
                    alt="Ảnh cửa container"
                    className="h-40 w-full rounded object-cover border border-slate-300"
                  />

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="rounded bg-white p-2 border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">
                        TRẠNG THÁI
                      </span>
                      <span
                        className={`font-bold text-sm ${
                          conditionClass === 'DAMAGE'
                            ? 'text-rose-600'
                            : 'text-emerald-600'
                        }`}
                      >
                        {conditionClass}
                      </span>
                      {conditionClass === 'DAMAGE' && (
                        <p className="text-[11px] text-rose-700">
                          {[...selectedDamageRemarks, customDamageNote.trim()]
                            .filter(Boolean)
                            .join(', ')}
                        </p>
                      )}
                    </div>

                    <div className="rounded bg-white p-2 border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">
                        ĐÓNG HÀNG & AGE
                      </span>
                      <span className="font-bold text-sm text-slate-900">
                        {stuffingClass} • Năm {manufactureYear}
                      </span>
                    </div>

                    <div className="col-span-2 rounded bg-white p-2 border border-slate-200">
                      <span className="text-[10px] text-slate-500 block">
                        TÌNH TRẠNG VỆ SINH
                      </span>
                      <span className="font-bold text-slate-900">
                        {cleaningItems.join(', ')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsReadyToConfirmStep(false)}
                    className="inline-flex items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-3.5 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Quay lại sửa
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmOperation}
                    className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700 active:scale-98"
                  >
                    <Send className="h-4 w-4" />
                    XÁC NHẬN TÁC NGHIỆP
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
