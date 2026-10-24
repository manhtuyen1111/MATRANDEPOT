import React, { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, ChevronDown, ChevronUp, FileSpreadsheet, MapPin, QrCode, X } from 'lucide-react';
import { ContainerRecord } from '../../types/depot';
import { DepotState, formatVnd } from '../../services/depotStore';
import {
  approveDamageQuotation,
  completeCleaningTask,
  completeRepairTask,
  executeGateOut,
  updateContainerLocation,
} from '../../services/depotOperations';
import { formatLocation } from '../../services/core';
import { findTicketByQr, isTicketClosed } from '../../services/driverRoute';
import {
  ContainerNo,
  EMPTY_SLOT,
  Feedback,
  inputCls,
  isSlotComplete,
  labelCls,
  primaryBtn,
  SlotPicker,
  SlotValue,
} from '../../components/shared';

export type FieldQueueMode = 'VS_CHO_VE_SINH' | 'XN_CHO_HA_VO' | 'XN_CHO_CAP_VO' | 'BG_CHO_BAO_GIA' | 'SC_CHO_SUA_CHUA';

interface Props {
  mode: FieldQueueMode;
  state: DepotState;
  onUpdateState: (next: DepotState) => void;
  initialScannedQr?: string;
  onOpenDossier?: (code: string) => void;
}

const sortFifo = (arr: ContainerRecord[]) => [...arr].sort((a, b) => a.gateInAt.localeCompare(b.gateInAt));

// Hàng chờ của từng bộ phận — cùng điều kiện với kiểm tra nghiệp vụ trong services
export function getFieldQueue(state: DepotState, mode: FieldQueueMode): ContainerRecord[] {
  const active = state.containers.filter((c) => c.status !== 'GATED_OUT');
  switch (mode) {
    case 'VS_CHO_VE_SINH':
      return sortFifo(active.filter((c) => c.needsCleaning));
    case 'XN_CHO_HA_VO':
      // CR-03: có yêu cầu vệ sinh thì phải vệ sinh xong mới vào hàng chờ hạ vỏ
      return sortFifo(active.filter((c) => c.status === 'WAITING_PLACEMENT' && !c.needsCleaning));
    case 'XN_CHO_CAP_VO':
      return sortFifo(
        active.filter(
          (c) =>
            c.status === 'ALLOCATED' &&
            state.gateOutOrders.some(
              (o) => o.containerNo === c.containerNo && o.masterDossierCode === c.masterDossierCode && o.status === 'PENDING_FORKLIFT'
            )
        )
      );
    case 'BG_CHO_BAO_GIA':
      return sortFifo(active.filter((c) => c.conditionClass === 'DAMAGE' && c.needsQuotation));
    case 'SC_CHO_SUA_CHUA':
      return sortFifo(active.filter((c) => c.needsRepair));
  }
}

const TITLES: Record<FieldQueueMode, { dept: string; name: string }> = {
  VS_CHO_VE_SINH: { dept: 'Bộ phận Vệ sinh', name: 'Chờ vệ sinh' },
  XN_CHO_HA_VO: { dept: 'Bộ phận Xe nâng', name: 'Chờ hạ vỏ' },
  XN_CHO_CAP_VO: { dept: 'Bộ phận Xe nâng', name: 'Chờ cấp vỏ' },
  BG_CHO_BAO_GIA: { dept: 'Bộ phận Báo giá', name: 'Chờ báo giá' },
  SC_CHO_SUA_CHUA: { dept: 'Bộ phận Sửa chữa', name: 'Chờ sửa chữa' },
};

export const FieldQueueWorkspaces: React.FC<Props> = ({ mode, state, onUpdateState, initialScannedQr = '', onOpenDossier }) => {
  const [scannedQr, setScannedQr] = useState(initialScannedQr);
  const [scanned, setScanned] = useState<ContainerRecord | null>(null);
  const [slot, setSlot] = useState<SlotValue>(EMPTY_SLOT);
  const [showList, setShowList] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [quote, setQuote] = useState<Record<string, { hours: string; items: string }>>({});
  const [teamId, setTeamId] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const activeTeams = state.repairTeams.filter((t) => t.isActive);
  const selectedTeam = activeTeams.find((t) => t.id === teamId);
  // Chọn tổ → mặc định chọn hết nhân viên đang hoạt động trong tổ (DEC-043)
  const chooseTeam = (id: string) => {
    setTeamId(id);
    setMemberIds(activeTeams.find((t) => t.id === id)?.members.filter((m) => m.isActive).map((m) => m.id) || []);
  };
  const repairWoOf = (c: ContainerRecord) =>
    state.workOrders.find(
      (w) =>
        w.masterDossierCode === c.masterDossierCode &&
        w.category === 'REPAIR' &&
        w.workStatus === 'OPEN'
    );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const queue = getFieldQueue(state, mode);
  const title = TITLES[mode];

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCameraOpen(false);
  };
  useEffect(() => () => stopCamera(), []);
  useEffect(() => {
    stopCamera();
    setScanned(null);
    setShowList(false);
    setError(null);
    setSuccess(null);
    setSlot(EMPTY_SLOT);
  }, [mode]);

  // Chỉ nhận container đang nằm trong hàng chờ của bộ phận này
  const lookup = (raw: string) => {
    setError(null);
    setSuccess(null);
    const code = raw.trim().toUpperCase();
    if (!code) return setError('Vui lòng quét hoặc nhập mã QR trên phiếu K80.');
    const found = queue.find(
      (c) =>
        c.activeQrCode.toUpperCase() === code ||
        c.masterDossierCode.toUpperCase() === code ||
        c.outDossierCode?.toUpperCase() === code ||
        c.containerNo === code
    );
    if (!found) {
      setScanned(null);
      const t = findTicketByQr(state, code);
      if (t && isTicketClosed(state, t)) return setError(`Mã "${code}" thuộc phiếu đã hoàn tất & trả chứng từ — mã đã đóng, không dùng lại được.`);
      return setError(`Mã "${code}" không có trong danh sách ${title.name.toLowerCase()} của ${title.dept}.`);
    }
    setScannedQr(found.activeQrCode);
    setScanned(found);
    setSlot(EMPTY_SLOT);
  };

  useEffect(() => {
    if (initialScannedQr) lookup(initialScannedQr);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialScannedQr]);

  const openCamera = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
      streamRef.current = stream;
      setCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      }, 50);
    } catch {
      setError('Thiết bị không mở được camera. Vui lòng nhập mã QR thủ công.');
    }
  };

  const run = (fn: () => DepotState, message: string) => {
    setError(null);
    setSuccess(null);
    try {
      onUpdateState(fn());
      setSuccess(message);
      setScanned(null);
      setScannedQr('');
      setSlot(EMPTY_SLOT);
      setTeamId('');
      setMemberIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi xác nhận hoàn tất');
    }
  };

  const confirm = () => {
    if (!scanned) return;
    const no = scanned.containerNo;
    if (mode === 'VS_CHO_VE_SINH') {
      run(() => completeCleaningTask(state, { containerNo: no }), `Đã xác nhận hoàn tất VỆ SINH cho ${no}.`);
    } else if (mode === 'XN_CHO_HA_VO') {
      run(
        () =>
          updateContainerLocation(state, {
            containerNo: no,
            ...slot,
            reason: `Xe nâng quét QR K80 (${scanned.activeQrCode}) hạ vỏ`,
          }),
        `Đã hạ vỏ ${no} vào ${slot.blockCode}${slot.bay ? ` / ${slot.bay}-${slot.row}-${slot.tier}` : ''}.`
      );
    } else if (mode === 'XN_CHO_CAP_VO') {
      run(
        () => executeGateOut(state, { containerNo: no, pickupBlock: scanned.currentBlock || undefined }),
        `Đã hoàn tất CẤP VỎ — ${no} đã OUT khỏi bãi.`
      );
    } else if (mode === 'SC_CHO_SUA_CHUA') {
      run(
        () => completeRepairTask(state, { containerNo: no, teamId, memberIds }),
        `Đã hoàn tất SỬA CHỮA ${no} → AV (${selectedTeam?.name}).`
      );
    }
  };

  if (mode === 'BG_CHO_BAO_GIA') {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-3 pb-16">
        <QueueHeader dept={title.dept} name={title.name} count={queue.length} />
        <Feedback error={error} success={success} onClose={() => (setError(null), setSuccess(null))} />
        {queue.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-xs text-slate-500">
            Không có container DAMAGE nào đang chờ báo giá.
          </p>
        ) : (
          queue.map((c) => {
            const q = quote[c.id] || { hours: '', items: c.damageRemarks.join(', ') };
            const setQ = (patch: Partial<typeof q>) => setQuote((prev) => ({ ...prev, [c.id]: { ...q, ...patch } }));
            return (
              <div key={c.id} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <ContainerNo no={c.containerNo} locked={c.isOnHold} lockReason={c.holdReason} className="text-sm" />
                    <span className="text-slate-500">{c.size}/{c.type} • AGE {c.manufactureYear} • {formatLocation(c)}</span>
                  </span>
                  <button type="button" onClick={() => onOpenDossier?.(c.masterDossierCode)} className="font-mono text-blue-700 hover:underline">
                    {c.masterDossierCode}
                  </button>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                  <label className="block sm:col-span-3">
                    <span className={labelCls}>Remark sửa chữa * (phân cách bằng dấu phẩy)</span>
                    <input value={q.items} onChange={(e) => setQ({ items: e.target.value })} placeholder="Móp vách, Hư sàn..." className={inputCls} />
                  </label>
                  <label className="block">
                    <span className={labelCls}>Giờ công sửa chữa *</span>
                    <input type="number" min={0} step={0.5} inputMode="decimal" value={q.hours} onChange={(e) => setQ({ hours: e.target.value })} placeholder="VD: 2.5" className={`${inputCls} font-mono`} />
                  </label>
                </div>
                <button
                  type="button"
                  disabled={!q.items.trim() || !(Number(q.hours) > 0)}
                  onClick={() =>
                    run(
                      () =>
                        approveDamageQuotation(state, {
                          containerNo: c.containerNo,
                          quotationItems: q.items.split(','),
                          laborHours: Number(q.hours),
                        }),
                      `Đã cập nhật ${c.containerNo} → Chờ sửa chữa.`
                    )
                  }
                  className={`${primaryBtn} w-full`}
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Cập nhật sang Chờ sửa chữa
                </button>
              </div>
            );
          })
        )}
      </div>
    );
  }

  const needsSlot = mode === 'XN_CHO_HA_VO';
  const isForklift = mode === 'XN_CHO_HA_VO' || mode === 'XN_CHO_CAP_VO';
  const isRepair = mode === 'SC_CHO_SUA_CHUA';
  const canConfirm = scanned && (!needsSlot || isSlotComplete(slot, state)) && (!isRepair || (selectedTeam && memberIds.length > 0));

  const scannedRepair = scanned && isRepair ? repairWoOf(scanned) : undefined;

  return (
    <div className="mx-auto w-full max-w-lg space-y-3 pb-16">
      <QueueHeader dept={title.dept} name={title.name} count={queue.length} />
      <Feedback error={error} success={success} onClose={() => (setError(null), setSuccess(null))} />

      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase text-slate-700">
          <QrCode className="h-4 w-4 text-slate-500" />
          Quét mã QR trên phiếu K80
        </span>
        {cameraOpen ? (
          <div className="space-y-2 rounded-md bg-black p-2">
            <video ref={videoRef} autoPlay playsInline muted className="h-48 w-full rounded object-cover" />
            <button type="button" onClick={stopCamera} className="w-full rounded-md bg-slate-700 py-2 text-xs font-semibold text-white">
              Đóng camera
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); lookup(scannedQr); }} className="flex gap-2">
            <input
              value={scannedQr}
              onChange={(e) => setScannedQr(e.target.value.toUpperCase())}
              placeholder="Mã QR K80 / Mã hồ sơ / Số cont..."
              className={`${inputCls} font-mono uppercase`}
            />
            <button type="submit" className={`${primaryBtn} shrink-0`}>Quét</button>
            <button type="button" onClick={openCamera} aria-label="Mở camera quét QR" className="shrink-0 rounded-md border border-slate-300 px-3 text-slate-600 hover:bg-slate-50">
              <Camera className="h-4 w-4" />
            </button>
          </form>
        )}
      </div>

      {scanned && (
        <div className="space-y-3 rounded-lg border border-blue-600 bg-white p-4 text-xs">
          <div className="flex items-center justify-between">
            {isForklift ? (
              <span className="text-[11px] font-bold uppercase text-blue-700">Container vừa quét</span>
            ) : (
              <ContainerNo no={scanned.containerNo} locked={scanned.isOnHold} lockReason={scanned.holdReason} className="text-base" />
            )}
            <button type="button" onClick={() => setScanned(null)} aria-label="Bỏ chọn" className="text-slate-400 hover:text-slate-700">
              <X className="h-4 w-4" />
            </button>
          </div>
          {/* DEC-061: khung nổi bật dùng chung cho Xe nâng (Chờ hạ vỏ / Chờ cấp vỏ) — tối ưu đọc nhanh trên điện thoại */}
          {(mode === 'XN_CHO_HA_VO' || mode === 'XN_CHO_CAP_VO') && (
            <div className="space-y-2 rounded-lg bg-slate-900 p-3 text-white" data-testid="forklift-focus">
              <div>
                <span className="block text-[10px] font-semibold uppercase text-slate-300">Số container</span>
                <span className="block break-all font-mono text-2xl font-black leading-tight tracking-wide">
                  {scanned.containerNo}
                  {scanned.isOnHold && <span className="ml-2 align-middle text-xs font-bold text-rose-300">ĐANG KHÓA</span>}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 border-t border-white/20 pt-2">
                <div>
                  <span className="block text-[10px] font-semibold uppercase text-slate-300">Size / Type</span>
                  <span className="font-mono text-lg font-black">{scanned.size} / {scanned.type}</span>
                </div>
                {mode === 'XN_CHO_HA_VO' ? (
                  <div className="text-right">
                    <span className="block text-[10px] font-semibold uppercase text-slate-300">Trạng thái / Đóng hàng</span>
                    <span className={`font-mono text-lg font-black ${scanned.conditionClass === 'DAMAGE' ? 'text-rose-300' : 'text-emerald-300'}`}>
                      {scanned.conditionClass} / {scanned.stuffingClass}
                    </span>
                  </div>
                ) : (
                  <div className="text-right">
                    <span className="block text-[10px] font-semibold uppercase text-slate-300">Vị trí hiện tại</span>
                    <span className="font-mono text-lg font-black text-amber-300">{formatLocation(scanned)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
            {isForklift ? (
              <>
                <dt className="text-slate-500">AGE</dt>
                <dd className="font-semibold">{scanned.manufactureYear}</dd>
              </>
            ) : (
              <>
                <dt className="text-slate-500">Size / Type / AGE</dt>
                <dd className="font-semibold">{scanned.size}/{scanned.type} • {scanned.manufactureYear}</dd>
                <dt className="text-slate-500">Trạng thái / Đóng hàng</dt>
                <dd className="font-semibold">{scanned.conditionClass} • {scanned.stuffingClass}</dd>
              </>
            )}
            <dt className="text-slate-500">Vệ sinh</dt>
            <dd className="font-semibold">{scanned.cleaningItems.join(', ')}</dd>
            {mode !== "XN_CHO_CAP_VO" && (
              <>
                <dt className="text-slate-500">Vị trí hiện tại</dt>
                <dd className="font-mono font-semibold">{formatLocation(scanned)}</dd>
              </>
            )}
            {mode === 'XN_CHO_CAP_VO' && (
              <>
                <dt className="text-slate-500">Số xe nhận vỏ</dt>
                <dd className="font-bold text-slate-900">{scanned.allocatedTruckNo || '-'}</dd>
                <dt className="text-slate-500">SĐT lái xe</dt>
                <dd className="font-bold text-slate-900">
                  {scanned.allocatedDriverPhone ? <a href={`tel:${scanned.allocatedDriverPhone}`} className="text-blue-700">{scanned.allocatedDriverPhone}</a> : '-'}
                </dd>
                <dt className="text-slate-500">Booking</dt>
                <dd className="font-mono">{scanned.allocatedBookingNo || '-'}</dd>
              </>
            )}
            {isRepair && (
              <>
                <dt className="text-slate-500">Remark sửa chữa</dt>
                <dd className="font-semibold">{(scannedRepair?.items || scanned.quotationItems || []).join(', ') || '-'}</dd>
                <dt className="text-slate-500">Giờ công</dt>
                <dd className="font-semibold">{scannedRepair?.laborHours ?? scanned.quotationLaborHours ?? '-'}</dd>
              </>
            )}
            <dt className="text-slate-500">Hồ sơ</dt>
            <dd>
              <button type="button" onClick={() => onOpenDossier?.(scanned.masterDossierCode)} className="font-mono text-blue-700 hover:underline">
                {scanned.outDossierCode || scanned.masterDossierCode}
              </button>
            </dd>
          </dl>
          {needsSlot && (
            <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
              <span className="flex items-center gap-1.5 font-bold text-slate-800">
                <MapPin className="h-4 w-4 text-slate-500" />
                Vị trí hạ vỏ *
              </span>
              <SlotPicker state={state} value={slot} onChange={setSlot} />
            </div>
          )}
          {isRepair && (
            <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
              <label className="block">
                <span className={labelCls}>Tổ sửa chữa *</span>
                <select value={teamId} onChange={(e) => chooseTeam(e.target.value)} className={inputCls}>
                  <option value="">-- Chọn tổ --</option>
                  {activeTeams.map((t) => <option key={t.id} value={t.id}>{t.code} — {t.name}</option>)}
                </select>
              </label>
              {activeTeams.length === 0 && <p className="text-[11px] text-amber-700">Chưa có tổ sửa chữa. Admin cấu hình tại Danh mục chung → Sửa chữa.</p>}
              {selectedTeam && (
                <fieldset>
                  <legend className={labelCls}>Nhân viên thực hiện * ({memberIds.length}/{selectedTeam.members.filter((m) => m.isActive).length})</legend>
                  <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
                    {selectedTeam.members.filter((m) => m.isActive).map((m) => (
                      <label key={m.id} className="flex items-center gap-2 rounded border border-slate-200 bg-white px-2 py-1.5">
                        <input
                          type="checkbox"
                          checked={memberIds.includes(m.id)}
                          onChange={(e) => setMemberIds((prev) => (e.target.checked ? [...prev, m.id] : prev.filter((x) => x !== m.id)))}
                        />
                        {m.fullName}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
            </div>
          )}
          <button type="button" onClick={confirm} disabled={!canConfirm} className={`${primaryBtn} w-full py-3`}>
            <CheckCircle2 className="h-4 w-4" />
            Xác nhận hoàn tất
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <button type="button" onClick={() => setShowList((v) => !v)} className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-bold text-slate-700 hover:bg-slate-50">
          <span>Danh sách chờ ({queue.length})</span>
          {showList ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {showList && (
          <ul className="divide-y divide-slate-100 border-t border-slate-200">
            {queue.length === 0 ? (
              <li className="p-6 text-center text-xs text-slate-500">Không có container nào trong danh sách chờ.</li>
            ) : (
              queue.map((c) => (
                <li key={c.id}>
                  <button type="button" onClick={() => lookup(c.activeQrCode)} className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-xs hover:bg-slate-50">
                    <span className="flex items-center gap-2">
                      <ContainerNo no={c.containerNo} locked={c.isOnHold} lockReason={c.holdReason} />
                      <span className="text-slate-500">{c.size}/{c.type}</span>
                    </span>
                    {mode === 'XN_CHO_CAP_VO' && (
                      <span className="text-[11px] text-slate-700">{c.allocatedTruckNo || '-'} • {c.allocatedDriverPhone || '-'}</span>
                    )}
                    {isRepair && <span className="text-[11px] text-slate-700">{repairWoOf(c)?.laborHours ?? c.quotationLaborHours ?? '-'} giờ công</span>}
                    <span className="font-mono text-[11px] text-slate-500">{formatLocation(c)}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
};

const QueueHeader: React.FC<{ dept: string; name: string; count: number }> = ({ dept, name, count }) => (
  <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2.5">
    <div>
      <span className="block text-[11px] font-semibold uppercase text-slate-500">{dept}</span>
      <h2 className="text-sm font-bold text-slate-900">{name}</h2>
    </div>
    <span className="rounded bg-slate-900 px-2.5 py-1 text-xs font-bold text-white">{count}</span>
  </div>
);
