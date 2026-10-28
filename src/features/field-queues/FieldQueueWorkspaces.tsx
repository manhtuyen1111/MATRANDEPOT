import React, { useEffect, useRef, useState } from 'react';
import { ScanField } from '../../components/Qr';
import { completeCleaningTask, completeRepairTask, executeGateOut, updateContainerLocation } from '../../services/api';
import { Camera, CheckCircle2, ChevronDown, ChevronUp, MapPin, QrCode, X } from 'lucide-react';
import { ContainerRecord } from '../../types/depot';
import { DepotState } from '../../services/depotStore';

import { formatLocation } from '../../services/core';
import { findTicketByQr, isTicketClosed } from '../../services/driverRoute';
import { OperationBadge } from '../vessel/VesselShared';
import { containerOperation } from '../../services/vessel';
import { QuotationWorkspace } from '../quotation/QuotationWorkspace';
import { linkCls,
  ContainerNo,
  EMPTY_SLOT,
  Feedback,
  inputCls,
  isSlotComplete,
  labelCls,
  primaryBtn,
  SlotPicker,
  SlotValue,
  LocationText,
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

  useEffect(() => {
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
    if (!code) return setError('Vui lòng quét hoặc nhập mã QR trên phiếu EEIR (K80).');
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

  // DEC-084: Chờ báo giá hiển thị như Tồn vỏ (bảng + cửa sổ trượt nhập báo giá)
  if (mode === 'BG_CHO_BAO_GIA') {
    return <QuotationWorkspace state={state} queue={queue} onUpdateState={onUpdateState} onOpenDossier={onOpenDossier} />;
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

      <div className="space-y-3 rounded-lg border border-line bg-white p-4">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase text-ink">
          <QrCode className="h-4 w-4 text-ink-muted" />
          Quét mã QR trên phiếu EEIR (K80)
        </span>
        <ScanField value={scannedQr} onChange={setScannedQr} onSubmit={lookup} placeholder="Mã QR phiếu EEIR (K80) / Mã hồ sơ / Số cont..." />
      </div>

      {scanned && (
        <div className="space-y-3 rounded-lg border border-navy-900 bg-white p-4 text-xs">
          <div className="flex items-center justify-between">
            {isForklift ? (
              <OperationBadge state={state} container={scanned} large />
            ) : (
              <span className="flex flex-wrap items-center gap-2">
                <OperationBadge state={state} container={scanned} large />
                <ContainerNo no={scanned.containerNo} locked={scanned.isOnHold} lockReason={scanned.holdReason} className="text-base" />
              </span>
            )}
            <button type="button" onClick={() => setScanned(null)} aria-label="Bỏ chọn" className="text-ink-muted hover:text-ink">
              <X className="h-4 w-4" />
            </button>
          </div>
          {/* DEC-061: khung nổi bật dùng chung cho Xe nâng (Chờ hạ vỏ / Chờ cấp vỏ) — tối ưu đọc nhanh trên điện thoại */}
          {(mode === 'XN_CHO_HA_VO' || mode === 'XN_CHO_CAP_VO') && (
            <div className="space-y-2 rounded-lg bg-navy-900 p-3 text-white" data-testid="forklift-focus">
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
                    <LocationText loc={scanned} className="font-mono text-lg font-black text-amber-300" iconClassName="h-5 w-5" />
                  </div>
                )}
              </div>
              {mode === 'XN_CHO_HA_VO' && scanned.forkliftShiftTask === 'HA_KE_GIAM_DINH' && (
                <div className="rounded bg-amber-400 px-2 py-1.5 text-center text-base font-black text-ink" data-testid="ha-ke-giam-dinh">
                  HẠ KỆ GIÁM ĐỊNH — không hạ về bay
                </div>
              )}
            </div>
          )}
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
            {isForklift ? (
              <>
                <dt className="text-ink-muted">AGE</dt>
                <dd className="font-semibold">{scanned.manufactureYear}</dd>
              </>
            ) : (
              <>
                <dt className="text-ink-muted">Size / Type / AGE</dt>
                <dd className="font-semibold">{scanned.size}/{scanned.type} • {scanned.manufactureYear}</dd>
                <dt className="text-ink-muted">Trạng thái / Đóng hàng</dt>
                <dd className="font-semibold">{scanned.conditionClass} • {scanned.stuffingClass}</dd>
              </>
            )}
            <dt className="text-ink-muted">Vệ sinh</dt>
            <dd className="font-semibold">{scanned.cleaningItems.join(', ')}</dd>
            {mode !== "XN_CHO_CAP_VO" && (
              <>
                <dt className="text-ink-muted">Vị trí hiện tại</dt>
                <dd className="font-mono font-semibold"><LocationText loc={scanned} /></dd>
              </>
            )}
            {mode === 'XN_CHO_CAP_VO' && (
              <>
                <dt className="text-ink-muted">Số xe nhận vỏ</dt>
                <dd className="font-bold text-ink">{scanned.allocatedTruckNo || '-'}</dd>
                <dt className="text-ink-muted">SĐT lái xe</dt>
                <dd className="font-bold text-ink">
                  {scanned.allocatedDriverPhone ? <a href={`tel:${scanned.allocatedDriverPhone}`} className="text-navy-700">{scanned.allocatedDriverPhone}</a> : '-'}
                </dd>
                <dt className="text-ink-muted">Booking</dt>
                <dd className="font-mono">{scanned.allocatedBookingNo || '-'}</dd>
              </>
            )}
            {isRepair && (
              <>
                <dt className="text-ink-muted">Remark sửa chữa</dt>
                <dd className="font-semibold">{(scannedRepair?.items || scanned.quotationItems || []).join(', ') || '-'}</dd>
                <dt className="text-ink-muted">Giờ công</dt>
                <dd className="font-semibold">{scannedRepair?.laborHours ?? scanned.quotationLaborHours ?? '-'}</dd>
              </>
            )}
            <dt className="text-ink-muted">Hồ sơ</dt>
            <dd>
              <button type="button" onClick={() => onOpenDossier?.(scanned.masterDossierCode)} className={linkCls}>
                {scanned.outDossierCode || scanned.masterDossierCode}
              </button>
            </dd>
          </dl>
          {needsSlot && (
            <div className="space-y-2 rounded-md border border-line bg-canvas p-3">
              <span className="flex items-center gap-1.5 font-bold text-ink">
                <MapPin className="h-4 w-4 text-ink-muted" />
                Vị trí hạ vỏ *
              </span>
              <SlotPicker
                state={state}
                value={slot}
                onChange={setSlot}
                onlyBlocks={scanned.forkliftShiftTask === 'HA_KE_GIAM_DINH' ? state.yardBlocks.filter((b) => b.isInspectionRack).map((b) => b.blockCode) : undefined}
              />
            </div>
          )}
          {isRepair && (
            <div className="space-y-2 rounded-md border border-line bg-canvas p-3">
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
                      <label key={m.id} className="flex items-center gap-2 rounded border border-line bg-white px-2 py-1.5">
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

      <div className="overflow-hidden rounded-lg border border-line bg-white">
        <button type="button" onClick={() => setShowList((v) => !v)} className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-bold text-ink hover:bg-canvas">
          <span>Danh sách chờ ({queue.length})</span>
          {showList ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {showList && (
          <ul className="divide-y divide-line border-t border-line">
            {queue.length === 0 ? (
              <li className="p-6 text-center text-xs text-ink-muted">Không có container nào trong danh sách chờ.</li>
            ) : (
              queue.map((c) => (
                <li key={c.id}>
                  <QueueListRow
                    state={state}
                    container={c}
                    extra={
                      mode === 'XN_CHO_CAP_VO'
                        ? `${c.allocatedTruckNo || '-'} • ${c.allocatedDriverPhone || '-'}`
                        : isRepair
                        ? `${repairWoOf(c)?.laborHours ?? c.quotationLaborHours ?? '-'} giờ công`
                        : mode === 'XN_CHO_HA_VO' && c.forkliftShiftTask === 'HA_KE_GIAM_DINH'
                        ? 'HẠ KỆ GIÁM ĐỊNH'
                        : undefined
                    }
                    onClick={() => lookup(c.activeQrCode)}
                  />
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
  <div className="flex items-center justify-between rounded-lg border border-line bg-white px-4 py-2.5">
    <div>
      <span className="block text-[11px] font-semibold uppercase text-ink-muted">{dept}</span>
      <h2 className="text-sm font-bold text-ink">{name}</h2>
    </div>
    <span className="rounded bg-navy-900 px-2.5 py-1 text-xs font-bold text-white">{count}</span>
  </div>
);

// DEC-089: 1 dòng danh sách chờ Vệ sinh / Xe nâng — ô TÁC NGHIỆP riêng bên trái;
//   bên phải: tầng 1 số cont (cột cố định, thẳng hàng) | size/type | vị trí; tầng 2 tên tàu | thông tin phụ
export const QueueListRow: React.FC<{ state: DepotState; container: ContainerRecord; extra?: string; onClick: () => void }> = ({ state, container: c, extra, onClick }) => {
  const op = containerOperation(state, c);
  return (
    <button type="button" onClick={onClick} className="grid w-full grid-cols-[5rem_1fr] items-center gap-2.5 px-3 py-2.5 text-left text-xs hover:bg-canvas" data-testid="queue-row">
      <OperationBadge state={state} container={c} hideVessel block />
      <span className="min-w-0">
        <span className="grid grid-cols-[8.5rem_3rem_1fr] items-center gap-2">
          <ContainerNo no={c.containerNo} locked={c.isOnHold} lockReason={c.holdReason} className="text-sm" />
          <span className="font-mono text-ink-muted">{c.size}/{c.type}</span>
          <LocationText loc={c} className="truncate text-right font-mono text-[11px] text-ink-muted" />
        </span>
        <span className="mt-0.5 flex items-center justify-between gap-2 text-[11px] text-ink-muted">
          <span className="min-w-0 truncate font-semibold">{op.vesselName ? `Tàu ${op.vesselName}` : ''}</span>
          {extra && <span className="shrink-0">{extra}</span>}
        </span>
      </span>
    </button>
  );
};
