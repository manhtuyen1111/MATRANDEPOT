import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  FileSpreadsheet,
  MapPin,
  QrCode,
  ShieldAlert,
  X,
} from 'lucide-react';
import { ContainerRecord } from '../../types/depot';
import { DepotState, formatVnd } from '../../services/depotStore';
import {
  approveDamageQuotation,
  completeCleaningTask,
  completeForkliftShift,
  completeRepairTask,
  executeGateOut,
  updateContainerLocation,
} from '../../services/depotOperations';

interface Props {
  mode:
    | 'VS_CHO_VE_SINH'
    | 'XN_CHO_HA_VO'
    | 'XN_CHO_CAP_VO'
    | 'XN_DAO_CHUYEN_SUA_CHUA'
    | 'XN_DAO_CHUYEN_KE_GD'
    | 'BG_CHO_BAO_GIA'
    | 'SC_CHO_SUA_CHUA';
  state: DepotState;
  onUpdateState: (next: DepotState) => void;
  initialScannedQr?: string;
  onOpenDossier?: (masterDossierCode: string) => void;
}

export const FieldQueueWorkspaces: React.FC<Props> = ({
  mode,
  state,
  onUpdateState,
  initialScannedQr = '',
  onOpenDossier,
}) => {
  const [scannedQr, setScannedQr] = useState(initialScannedQr);
  const [scannedContainer, setScannedContainer] =
    useState<ContainerRecord | null>(null);

  // Vị trí bắt buộc cập nhật đối với Bộ phận Xe nâng trước khi XÁC NHẬN HOÀN TẤT (Khởi tạo rỗng để bắt buộc chọn theo trình tự)
  const [selectedBlock, setSelectedBlock] = useState<string>('');
  const [bay, setBay] = useState('');
  const [row, setRow] = useState('');
  const [tier, setTier] = useState('');

  // Danh sách chờ tác nghiệp mặc định ẨN ở dưới, kích vào mới mở xem chi tiết
  const [showWaitingList, setShowWaitingList] = useState<boolean>(false);
  const [expandedDetailId, setExpandedDetailId] = useState<string | null>(null);

  // Camera quét QR trên điện thoại
  const [cameraOpen, setCameraOpen] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [quoteAmount, setQuoteAmount] = useState<number>(1850000);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
  };

  useEffect(() => {
    return () => stopCamera();
  }, []);

  // Reset trạng thái khi chuyển qua lại giữa các menu bộ phận
  useEffect(() => {
    stopCamera();
    setScannedContainer(null);
    setShowWaitingList(false);
    setExpandedDetailId(null);
    setErrorMsg(null);
    setSuccessMsg(null);
    setSelectedBlock('');
    setBay('');
    setRow('');
    setTier('');
  }, [mode]);

  // Lọc hàng chờ của từng bộ phận (FIFO)
  const sortFifo = <T extends { gateInAt: string }>(arr: T[]): T[] =>
    [...arr].sort(
      (a, b) => new Date(a.gateInAt).getTime() - new Date(b.gateInAt).getTime()
    );

  const cleaningQueue = sortFifo(
    state.containers.filter(
      (c) => c.status !== 'GATED_OUT' && c.needsCleaning
    )
  );
  const forkliftHaVoQueue = sortFifo(
    state.containers.filter((c) => c.status === 'WAITING_PLACEMENT')
  );
  const forkliftCapVoQueue = sortFifo(
    state.containers.filter((c) => c.status === 'ALLOCATED')
  );
  const forkliftShiftRepairQueue = sortFifo(
    state.containers.filter(
      (c) => c.status !== 'GATED_OUT' && c.forkliftShiftTask === 'HA_SUA_CHUA'
    )
  );
  const forkliftShiftRackQueue = sortFifo(
    state.containers.filter(
      (c) =>
        c.status !== 'GATED_OUT' && c.forkliftShiftTask === 'HA_KE_GIAM_DINH'
    )
  );
  const quotationQueue = sortFifo(
    state.containers.filter(
      (c) =>
        c.status !== 'GATED_OUT' &&
        c.conditionClass === 'DAMAGE' &&
        c.needsQuotation
    )
  );
  const repairQueue = sortFifo(
    state.containers.filter(
      (c) => c.status !== 'GATED_OUT' && c.needsRepair
    )
  );

  const currentQueue: ContainerRecord[] =
    mode === 'VS_CHO_VE_SINH'
      ? cleaningQueue
      : mode === 'XN_CHO_HA_VO'
      ? forkliftHaVoQueue
      : mode === 'XN_CHO_CAP_VO'
      ? forkliftCapVoQueue
      : mode === 'XN_DAO_CHUYEN_SUA_CHUA'
      ? forkliftShiftRepairQueue
      : mode === 'XN_DAO_CHUYEN_KE_GD'
      ? forkliftShiftRackQueue
      : mode === 'BG_CHO_BAO_GIA'
      ? quotationQueue
      : repairQueue;

  const isForkliftMode =
    mode === 'XN_CHO_HA_VO' ||
    mode === 'XN_CHO_CAP_VO' ||
    mode === 'XN_DAO_CHUYEN_SUA_CHUA' ||
    mode === 'XN_DAO_CHUYEN_KE_GD';

  // Tìm container trong hàng chờ khi quét mã QR trên phiếu K80
  const lookupContainerByQr = (rawCode: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const code = rawCode.trim().toUpperCase();
    if (!code) {
      setErrorMsg('Vui lòng quét hoặc nhập Mã QR trên tờ phiếu K80.');
      return;
    }

    const found =
      currentQueue.find(
        (c) =>
          c.activeQrCode.toUpperCase() === code ||
          c.masterDossierCode.toUpperCase() === code ||
          c.containerNo.toUpperCase() === code
      ) ||
      state.containers.find(
        (c) =>
          c.status !== 'GATED_OUT' &&
          (c.activeQrCode.toUpperCase() === code ||
            c.masterDossierCode.toUpperCase() === code ||
            c.containerNo.toUpperCase() === code)
      );

    if (!found) {
      setScannedContainer(null);
      setErrorMsg(
        `Không tìm thấy container nào khớp với mã QR "${code}" trong danh sách chờ.`
      );
      return;
    }

    setScannedQr(found.activeQrCode);
    setScannedContainer(found);
    setSelectedBlock('');
    setBay('');
    setRow('');
    setTier('');
  };

  useEffect(() => {
    if (initialScannedQr) {
      setScannedQr(initialScannedQr);
      lookupContainerByQr(initialScannedQr);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialScannedQr]);

  const handleOpenCameraScan = async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch {
      // Nếu thiết bị không có camera trực tiếp, tự động quét container đầu tiên trong hàng chờ
      if (currentQueue[0]) {
        lookupContainerByQr(currentQueue[0].activeQrCode);
      } else {
        setErrorMsg('Hiện không có container nào trong hàng chờ để quét.');
      }
    }
  };

  // Xử lý khi bấm nút XÁC NHẬN HOÀN TẤT sau khi đã quét QR (và cập nhật VỊ TRÍ với Xe nâng)
  const handleConfirmComplete = () => {
    if (!scannedContainer) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      if (mode === 'VS_CHO_VE_SINH') {
        const next = completeCleaningTask(state, {
          containerNo: scannedContainer.containerNo,
          scannedQrCode: scannedContainer.activeQrCode,
        });
        onUpdateState(next);
        setSuccessMsg(
          `Đã xác nhận hoàn tất VỆ SINH cho container ${scannedContainer.containerNo} (Hồ sơ: ${scannedContainer.masterDossierCode})!`
        );
        setScannedContainer(null);
        setScannedQr('');
      } else if (mode === 'XN_CHO_HA_VO') {
        if (!selectedBlock) {
          throw new Error(
            'Bộ phận Xe nâng bắt buộc chọn VỊ TRÍ (Block / Bay-Row-Tier) trước khi Xác nhận hoàn tất.'
          );
        }
        const next = updateContainerLocation(state, {
          containerNo: scannedContainer.containerNo,
          scannedQrCode: scannedContainer.activeQrCode,
          blockCode: selectedBlock,
          bay,
          row,
          tier,
          reason: `Xe nâng quét QR K80 (${scannedContainer.activeQrCode}) hạ vỏ vào vị trí ${selectedBlock}`,
        });
        onUpdateState(next);
        setSuccessMsg(
          `Đã cập nhật VỊ TRÍ (${selectedBlock}${
            bay ? ` / ${bay}-${row}-${tier}` : ''
          }) và xác nhận hoàn tất HẠ VỎ cho container ${
            scannedContainer.containerNo
          }!`
        );
        setScannedContainer(null);
        setScannedQr('');
      } else if (
        mode === 'XN_DAO_CHUYEN_SUA_CHUA' ||
        mode === 'XN_DAO_CHUYEN_KE_GD'
      ) {
        if (!selectedBlock) {
          throw new Error(
            'Bộ phận Xe nâng bắt buộc chọn VỊ TRÍ khu vực đảo chuyển trước khi Xác nhận hoàn tất.'
          );
        }
        let next = completeForkliftShift(state, {
          containerNo: scannedContainer.containerNo,
          scannedQrCode: scannedContainer.activeQrCode,
          shiftType:
            mode === 'XN_DAO_CHUYEN_SUA_CHUA'
              ? 'HA_SUA_CHUA'
              : 'HA_KE_GIAM_DINH',
          targetBlock: selectedBlock,
        });
        if (bay && row && tier) {
          next = updateContainerLocation(next, {
            containerNo: scannedContainer.containerNo,
            blockCode: selectedBlock,
            bay,
            row,
            tier,
            reason: 'Cập nhật vị trí chi tiết sau khi đảo chuyển',
          });
        }
        onUpdateState(next);
        setSuccessMsg(
          `Đã cập nhật VỊ TRÍ (${selectedBlock}${
            bay ? ` / ${bay}-${row}-${tier}` : ''
          }) và hoàn tất ĐẢO CHUYỂN cho container ${
            scannedContainer.containerNo
          }!`
        );
        setScannedContainer(null);
        setScannedQr('');
      } else if (mode === 'XN_CHO_CAP_VO') {
        if (!selectedBlock) {
          throw new Error(
            'Vui lòng xác nhận VỊ TRÍ lấy vỏ trước khi Xác nhận hoàn tất Cấp vỏ.'
          );
        }
        const next = executeGateOut(state, {
          gateOutType: 'EMPTY_RELEASE',
          bookingNo:
            scannedContainer.allocatedBookingNo ||
            state.bookings[0]?.bookingNo ||
            'BK-MSK-2026-109',
          containerNo: scannedContainer.containerNo,
          truckNo: scannedContainer.allocatedTruckNo || '15H-686.88',
          receiverRep: scannedContainer.customerRep || 'Khách nhận vỏ',
          feeAmount: 0,
          paymentCategory: 'TTS',
          ttsNote: `Xe nâng xác nhận lấy vỏ từ vị trí ${selectedBlock} và hoàn tất CẤP VỎ`,
          documentsVerified: true,
        });
        onUpdateState(next);
        setSuccessMsg(
          `Đã xác nhận lấy vỏ tại vị trí ${selectedBlock} và hoàn tất CẤP VỎ (Out khỏi bãi) cho container ${scannedContainer.containerNo}!`
        );
        setScannedContainer(null);
        setScannedQr('');
      } else if (mode === 'SC_CHO_SUA_CHUA') {
        const next = completeRepairTask(state, {
          containerNo: scannedContainer.containerNo,
          scannedQrCode: scannedContainer.activeQrCode,
        });
        onUpdateState(next);
        setSuccessMsg(
          `Đã xác nhận hoàn tất SỬA CHỮA cho container ${scannedContainer.containerNo} -> Chuyển trạng thái sang AV!`
        );
        setScannedContainer(null);
        setScannedQr('');
      }
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Lỗi xác nhận hoàn tất'
      );
    }
  };

  const titles: Record<
    Props['mode'],
    { dept: string; name: string; count: number }
  > = {
    VS_CHO_VE_SINH: {
      dept: 'BỘ PHẬN VỆ SINH',
      name: 'CHỜ VỆ SINH',
      count: cleaningQueue.length,
    },
    XN_CHO_HA_VO: {
      dept: 'BỘ PHẬN XE NÂNG',
      name: 'CHỜ HẠ VỎ',
      count: forkliftHaVoQueue.length,
    },
    XN_CHO_CAP_VO: {
      dept: 'BỘ PHẬN XE NÂNG',
      name: 'CHỜ CẤP VỎ',
      count: forkliftCapVoQueue.length,
    },
    XN_DAO_CHUYEN_SUA_CHUA: {
      dept: 'BỘ PHẬN XE NÂNG — ĐẢO CHUYỂN',
      name: '+ HẠ SỬA CHỮA',
      count: forkliftShiftRepairQueue.length,
    },
    XN_DAO_CHUYEN_KE_GD: {
      dept: 'BỘ PHẬN XE NÂNG — ĐẢO CHUYỂN',
      name: '+ HẠ KỆ GIÁM ĐỊNH',
      count: forkliftShiftRackQueue.length,
    },
    BG_CHO_BAO_GIA: {
      dept: 'BỘ PHẬN BÁO GIÁ',
      name: 'CHỜ BÁO GIÁ',
      count: quotationQueue.length,
    },
    SC_CHO_SUA_CHUA: {
      dept: 'BỘ PHẬN SỬA CHỮA',
      name: 'CHỜ SỬA CHỮA',
      count: repairQueue.length,
    },
  };

  const headerInfo = titles[mode];

  // Riêng màn hình BỘ PHẬN BÁO GIÁ (Văn phòng/Báo giá duyệt dự toán cont DAMAGE)
  if (mode === 'BG_CHO_BAO_GIA') {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-3 pb-16">
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3">
          <div>
            <span className="text-[11px] font-bold text-slate-500 block">
              {headerInfo.dept}
            </span>
            <h2 className="text-sm font-bold text-slate-900">
              {headerInfo.name}
            </h2>
          </div>
          <span className="rounded bg-blue-600 px-2.5 py-1 text-xs font-bold text-white">
            Đang chờ: {headerInfo.count} cont
          </span>
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
            <ShieldAlert className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        <div className="space-y-2.5">
          {quotationQueue.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-xs text-slate-400">
              Không có container DAMAGE nào đang chờ Báo giá.
            </div>
          ) : (
            quotationQueue.map((c) => (
              <div
                key={c.id}
                className="rounded-lg border border-slate-200 bg-white p-4 space-y-3 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => onOpenDossier?.(c.masterDossierCode)}
                      className="rounded bg-blue-600 px-2 py-0.5 font-mono font-bold text-white"
                    >
                      {c.masterDossierCode}
                    </button>
                    <span className="font-mono text-sm font-bold text-slate-900">
                      {c.containerNo} ({c.size}&apos;{c.type} • AGE{' '}
                      {c.manufactureYear})
                    </span>
                  </div>
                  <span className="rounded bg-rose-100 px-2 py-0.5 font-bold text-rose-700">
                    DAMAGE
                  </span>
                </div>

                <p className="text-slate-700">
                  Lỗi hư hỏng:{' '}
                  <strong>
                    {c.damageRemarks.join(', ') || 'Cần báo giá sửa chữa'}
                  </strong>
                </p>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={quoteAmount}
                    onChange={(e) => setQuoteAmount(Number(e.target.value))}
                    className="w-36 rounded border border-slate-300 px-3 py-2 font-bold"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = approveDamageQuotation(state, {
                        containerNo: c.containerNo,
                        quotationAmount: Number(quoteAmount),
                        quotationItems:
                          c.damageRemarks.length > 0
                            ? c.damageRemarks
                            : ['Sửa chữa hư hỏng tổng hợp'],
                      });
                      onUpdateState(next);
                      setSuccessMsg(
                        `Đã duyệt báo giá (${formatVnd(quoteAmount)}) cho ${
                          c.containerNo
                        } -> Đẩy sang CHỜ SỬA CHỮA & Xe nâng HẠ SỬA CHỮA.`
                      );
                    }}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded bg-blue-600 py-2 font-bold text-white hover:bg-blue-700"
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Xác Nhận Báo Giá
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    );
  }

  // ============================================================================
  // GIAO DIỆN TỐI ƯU MOBILE CHO BỘ PHẬN XE NÂNG - VỆ SINH - SỬA CHỮA:
  // 1. Chỉ hiển thị "Quét Mã QR Trên Phiếu K80 Để Xác Nhận Nhanh:"
  // 2. Khi quét scan -> hiển thị thông tin sơ bộ của container + cập nhật VỊ TRÍ (với Xe nâng) + nút XÁC NHẬN HOÀN TẤT
  // 3. Danh sách chờ tác nghiệp ẩn ở dưới, kích vào mới mở xem chi tiết
  // ============================================================================
  return (
    <div className="mx-auto w-full max-w-lg space-y-4 pb-16">
      {/* TIÊU ĐỀ GỌN NHẸ */}
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2.5">
        <div>
          <span className="text-[10px] font-bold uppercase text-blue-700 block">
            {headerInfo.dept} (Mobile)
          </span>
          <h2 className="text-sm font-bold text-slate-900">{headerInfo.name}</h2>
        </div>
        <span className="rounded bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
          Chờ: {headerInfo.count}
        </span>
      </div>

      {errorMsg && (
        <div className="flex items-start justify-between gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
          <div className="flex items-start gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
          <button type="button" onClick={() => setErrorMsg(null)}>
            <X className="h-4 w-4 text-red-500" />
          </button>
        </div>
      )}

      {successMsg && (
        <div className="flex items-start justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
            <span className="font-medium">{successMsg}</span>
          </div>
          <button type="button" onClick={() => setSuccessMsg(null)}>
            <X className="h-4 w-4 text-emerald-600" />
          </button>
        </div>
      )}

      {/* 1. KHUNG CHÍNH: QUÉT MÃ QR TRÊN PHIẾU K80 ĐỂ XÁC NHẬN NHANH */}
      <div className="rounded-lg border-2 border-blue-600 bg-white p-4 shadow-xs space-y-3">
        <label className="flex items-center gap-1.5 text-xs font-bold uppercase text-blue-900">
          <QrCode className="h-4 w-4 text-blue-600" />
          Quét Mã QR Trên Phiếu K80 Để Xác Nhận Nhanh:
        </label>

        {cameraOpen ? (
          <div className="space-y-2 rounded-lg bg-black p-2">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-48 w-full rounded object-cover"
            />
            <div className="flex gap-2">
              {currentQueue[0] && (
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    lookupContainerByQr(currentQueue[0].activeQrCode);
                  }}
                  className="flex-1 rounded-lg bg-blue-600 py-2.5 text-xs font-bold text-white"
                >
                  Nhận diện QR ({currentQueue[0].activeQrCode})
                </button>
              )}
              <button
                type="button"
                onClick={stopCamera}
                className="rounded-lg bg-slate-700 px-3 py-2.5 text-xs font-semibold text-white"
              >
                Đóng Camera
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              lookupContainerByQr(scannedQr);
            }}
            className="space-y-2"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={scannedQr}
                onChange={(e) => setScannedQr(e.target.value.toUpperCase())}
                placeholder="Quét hoặc nhập Mã QR K80 / Mã Hồ Sơ / Số Cont..."
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-xs font-bold uppercase text-slate-900"
              />
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 shrink-0"
              >
                Quét Scan
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleOpenCameraScan}
                className="inline-flex items-center gap-1.5 rounded-md border border-blue-300 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-100"
              >
                <Camera className="h-3.5 w-3.5" />
                Mở Camera Quét QR
              </button>

              {/* Gợi ý quét nhanh phiếu K80 đang chờ khi thử nghiệm trên máy tính */}
              {currentQueue.slice(0, 2).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => lookupContainerByQr(c.activeQrCode)}
                  className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-[11px] font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Quét thử: {c.activeQrCode}
                </button>
              ))}
            </div>
          </form>
        )}
      </div>

      {/* 2. KHI QUÉT SCAN XONG -> HIỂN THỊ THÔNG TIN SƠ BỘ CỦA CONTAINER + CẬP NHẬT VỊ TRÍ (VỚI XE NÂNG) + NÚT XÁC NHẬN HOÀN TẤT */}
      {scannedContainer && (
        <div className="rounded-lg border-2 border-emerald-600 bg-white p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div>
              <span className="text-[11px] font-semibold text-emerald-700 block">
                Thông tin sơ bộ Container vừa quét QR
              </span>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="font-mono text-base font-bold text-slate-900">
                  {scannedContainer.containerNo}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onOpenDossier?.(scannedContainer.masterDossierCode)
                  }
                  className="rounded bg-blue-100 px-2 py-0.5 font-mono text-xs font-bold text-blue-800 hover:bg-blue-200"
                >
                  Hồ sơ: {scannedContainer.masterDossierCode}
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setScannedContainer(null)}
              className="rounded border border-slate-200 p-1 text-slate-400 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* THÔNG TIN SƠ BỘ CỦA CONTAINER */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded border border-slate-200 bg-slate-50 p-2.5">
              <span className="text-[11px] text-slate-500 block">
                Size / Type / AGE
              </span>
              <span className="font-mono font-bold text-slate-900">
                {scannedContainer.size}&apos;{scannedContainer.type} • Năm{' '}
                {scannedContainer.manufactureYear}
              </span>
            </div>

            <div className="rounded border border-slate-200 bg-slate-50 p-2.5">
              <span className="text-[11px] text-slate-500 block">
                Trạng thái & Đóng hàng
              </span>
              <span
                className={`font-bold ${
                  scannedContainer.conditionClass === 'DAMAGE'
                    ? 'text-rose-700'
                    : 'text-emerald-700'
                }`}
              >
                {scannedContainer.conditionClass}
              </span>{' '}
              • Đóng hàng: <strong>{scannedContainer.stuffingClass}</strong>
            </div>

            <div className="col-span-2 rounded border border-slate-200 bg-slate-50 p-2.5">
              <span className="text-[11px] text-slate-500 block">
                Tình trạng vệ sinh / Ghi chú
              </span>
              <span className="font-bold text-slate-900">
                {scannedContainer.cleaningItems.join(', ')}
              </span>
              {scannedContainer.damageRemarks.length > 0 && (
                <p className="mt-0.5 text-[11px] text-rose-700">
                  Hư hỏng: {scannedContainer.damageRemarks.join(', ')}
                </p>
              )}
            </div>
          </div>

          {/* VỚI BỘ PHẬN XE NÂNG: YÊU CẦU CẬP NHẬT THÊM CẢ VỊ TRÍ THEO TỪNG BƯỚC TRƯỚC KHI HIỂN THỊ NÚT XÁC NHẬN HOÀN TẤT */}
          {isForkliftMode && (
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 space-y-2.5 text-xs">
              <label className="flex items-center gap-1.5 font-bold text-blue-950">
                <MapPin className="h-4 w-4 text-blue-600" />
                Cập nhật VỊ TRÍ Container trước khi Xác nhận hoàn tất *
              </label>

              <div>
                <span className="mb-1 block text-[11px] font-semibold text-slate-600">
                  1. Chọn Khu / Block (Chọn xong mới mở phần tiếp theo):
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  {state.yardBlocks.map((b) => (
                    <button
                      key={b.blockCode}
                      type="button"
                      onClick={() => {
                        setSelectedBlock(b.blockCode);
                        setBay('');
                        setRow('');
                        setTier('');
                      }}
                      className={`rounded-lg border py-2 text-xs font-bold transition ${
                        selectedBlock === b.blockCode
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {b.blockCode}
                    </button>
                  ))}
                </div>
              </div>

              {/* CHỈ HIỂN THỊ CHỌN BAY / ROW / TIER KHI ĐÃ CHỌN KHU / BLOCK */}
              {selectedBlock !== '' &&
                (() => {
                  const activeBlockCfg =
                    state.yardBlocks.find((b) => b.blockCode === selectedBlock) ||
                    state.yardBlocks[0];
                  const bayOptions = Array.from(
                    { length: activeBlockCfg?.maxBay || 10 },
                    (_, i) => String(i + 1).padStart(2, '0')
                  );
                  const rowOptions = Array.from(
                    { length: activeBlockCfg?.maxRow || 6 },
                    (_, i) => String(i + 1).padStart(2, '0')
                  );
                  const tierOptions = Array.from(
                    { length: activeBlockCfg?.maxTier || 5 },
                    (_, i) => String(i + 1).padStart(2, '0')
                  );

                  return (
                    <div className="grid grid-cols-3 gap-2 pt-1 border-t border-blue-100">
                      <div>
                        <span className="mb-1 block text-[10px] text-slate-500">
                          2. Bay (Theo cấu hình)
                        </span>
                        <select
                          value={bay}
                          onChange={(e) => {
                            setBay(e.target.value);
                            if (!e.target.value) {
                              setRow('');
                              setTier('');
                            }
                          }}
                          className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs font-bold"
                        >
                          <option value="">-- Cấp Block --</option>
                          {bayOptions.map((b) => (
                            <option key={b} value={b}>
                              Bay {b}
                            </option>
                          ))}
                        </select>
                      </div>
                      {bay !== '' && (
                        <div>
                          <span className="mb-1 block text-[10px] text-slate-500">
                            3. Row (Theo cấu hình) *
                          </span>
                          <select
                            value={row}
                            onChange={(e) => {
                              setRow(e.target.value);
                              if (!e.target.value) setTier('');
                            }}
                            className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs font-bold"
                          >
                            <option value="">-- Chọn Row --</option>
                            {rowOptions.map((r) => (
                              <option key={r} value={r}>
                                Row {r}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      {bay !== '' && row !== '' && (
                        <div>
                          <span className="mb-1 block text-[10px] text-slate-500">
                            4. Tier (Theo cấu hình) *
                          </span>
                          <select
                            value={tier}
                            onChange={(e) => setTier(e.target.value)}
                            className="w-full rounded border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs font-bold"
                          >
                            <option value="">-- Chọn Tier --</option>
                            {tierOptions.map((t) => (
                              <option key={t} value={t}>
                                Tier {t}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })()}
            </div>
          )}

          {/* NÚT XÁC NHẬN HOÀN TẤT — CHỈ HIỂN THỊ KHI ĐÃ HOÀN TẤT CÁC PHẦN TRƯỚC */}
          {(!isForkliftMode ||
            (selectedBlock !== '' &&
              (bay === '' || (row !== '' && tier !== '')))) && (
            <button
              type="button"
              onClick={handleConfirmComplete}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 py-3.5 text-sm font-bold text-white hover:bg-emerald-700 active:scale-98"
            >
              <CheckCircle2 className="h-4 w-4" />
              XÁC NHẬN HOÀN TẤT
            </button>
          )}
        </div>
      )}

      {/* 3. DANH SÁCH CHỜ TÁC NGHIỆP (MẶC ĐỊNH ẨN Ở DƯỚI - NẾU CẦN CÓ THỂ KÍCH VÀO XEM CHI TIẾT) */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <button
          type="button"
          onClick={() => setShowWaitingList((prev) => !prev)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          <span>
            Danh sách chờ tác nghiệp ({currentQueue.length} container) — Kích vào
            để {showWaitingList ? 'ẩn' : 'xem chi tiết'}
          </span>
          {showWaitingList ? (
            <ChevronUp className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          )}
        </button>

        {showWaitingList && (
          <div className="border-t border-slate-200 divide-y divide-slate-100">
            {currentQueue.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                Hiện không có container nào trong danh sách chờ của bộ phận này.
              </div>
            ) : (
              currentQueue.map((c) => {
                const isExpanded = expandedDetailId === c.id;
                return (
                  <div key={c.id} className="p-3 text-xs space-y-2">
                    <div
                      onClick={() =>
                        setExpandedDetailId(isExpanded ? null : c.id)
                      }
                      className="flex cursor-pointer items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-blue-700">
                          {c.masterDossierCode}
                        </span>
                        <span className="font-mono font-bold text-slate-900">
                          {c.containerNo}
                        </span>
                        <span className="text-slate-500">
                          ({c.size}&apos;{c.type})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            c.conditionClass === 'DAMAGE'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-emerald-100 text-emerald-700'
                          }`}
                        >
                          {c.conditionClass}
                        </span>
                        <Eye className="h-3.5 w-3.5 text-slate-400" />
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="rounded-md border border-slate-200 bg-slate-50 p-2.5 space-y-1.5">
                        <p>
                          <strong>Mã Hồ Sơ Chính:</strong>{' '}
                          <span className="font-mono font-bold text-blue-700">
                            {c.masterDossierCode}
                          </span>{' '}
                          • <strong>Mã QR K80:</strong>{' '}
                          <span className="font-mono">{c.activeQrCode}</span>
                        </p>
                        <p>
                          <strong>Đóng hàng:</strong> {c.stuffingClass} •{' '}
                          <strong>AGE:</strong> {c.manufactureYear} •{' '}
                          <strong>Vị trí:</strong>{' '}
                          {c.currentBlock || 'Chờ hạ bãi'}
                        </p>
                        <p>
                          <strong>Vệ sinh:</strong> {c.cleaningItems.join(', ')}
                        </p>
                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => lookupContainerByQr(c.activeQrCode)}
                            className="rounded bg-blue-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-blue-700"
                          >
                            Nạp lên khung Quét QR để xác nhận
                          </button>
                          {onOpenDossier && (
                            <button
                              type="button"
                              onClick={() => onOpenDossier(c.masterDossierCode)}
                              className="rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                            >
                              Xem hồ sơ liên thông
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};
