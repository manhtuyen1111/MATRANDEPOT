import React, { useMemo, useState } from 'react';
import { ArrowLeftRight, ChevronDown, ChevronUp, History, Search, X } from 'lucide-react';
import { DepotState } from '../../services/depotStore';
import { shiftContainer } from '../../services/depotOperations';
import { ContainerProgress, formatLocation, getContainerProgress, PROGRESS_LABELS } from '../../services/core';
import {
  ContainerNo,
  EMPTY_SLOT,
  Feedback,
  formatViTime,
  inputCls,
  isSlotComplete,
  labelCls,
  primaryBtn,
  secondaryBtn,
  SlotPicker,
  SlotValue,
} from '../../components/shared';

const PAGE_SIZE = 20;
// DEC-092: phần chi tiết vị trí "17-02-02" (bỏ chiều không có) — đi sau ô tên Block rộng cố định
const slotDetail = (c: { currentBay: string | null; currentRow: string | null; currentTier: string | null }) =>
  [c.currentBay, c.currentRow, c.currentTier].filter(Boolean).join("-");
const PROGRESS_FILTERS: ContainerProgress[] = ['CHO_SUA_CHUA', 'CHO_BAO_GIA', 'CHO_VE_SINH', 'DA_LAP_LENH_CAP', 'SAN_SANG'];

// BỘ PHẬN XE NÂNG — ĐẢO CHUYỂN (CR-01): tác nghiệp mobile (max-w-lg như các màn hiện trường), có lịch sử
export const YardShiftWorkspace: React.FC<{
  state: DepotState;
  onUpdateState: (next: DepotState) => void;
  onOpenDossier?: (code: string) => void;
}> = ({ state, onUpdateState, onOpenDossier }) => {
  const [search, setSearch] = useState('');
  const [size, setSize] = useState('ALL');
  const [progress, setProgress] = useState<'ALL' | ContainerProgress>('ALL');
  const [shown, setShown] = useState(PAGE_SIZE);
  // DEC-092: ô tên Block rộng đúng bằng mã Block dài nhất (đơn vị ch, chữ đều nét) → các phần Bay-Row-Tier thẳng cột
  const blockCh = Math.max(5, ...state.yardBlocks.map((b) => b.blockCode.length));
  const [selectedId, setSelectedId] = useState('');
  const [slot, setSlot] = useState<SlotValue>(EMPTY_SLOT);
  const [note, setNote] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const inYard = useMemo(
    () =>
      state.containers
        .filter((c) => (c.status === 'IN_YARD' || c.status === 'ALLOCATED') && c.currentBlock)
        .filter((c) => !search.trim() || c.containerNo.includes(search.trim().toUpperCase()))
        .filter((c) => size === 'ALL' || c.size === size)
        .filter((c) => progress === 'ALL' || getContainerProgress(c).includes(progress))
        .sort((a, b) => a.containerNo.localeCompare(b.containerNo)),
    [state.containers, search, size, progress]
  );
  const selected = state.containers.find((c) => c.id === selectedId);
  const recent = state.locationHistory.filter((h) => h.actionType === 'YARD_SHIFT').slice(0, 10);
  const resetPage = () => setShown(PAGE_SIZE);

  const handleShift = () => {
    if (!selected) return;
    setError(null);
    setSuccess(null);
    try {
      onUpdateState(shiftContainer(state, { containerId: selected.id, ...slot, note }));
      setSuccess(`Đã ĐẢO CHUYỂN ${selected.containerNo}: ${formatLocation(selected)} → ${slot.blockCode}${slot.bay ? ` / ${slot.bay}-${slot.row}-${slot.tier}` : ''}.`);
      setSlot(EMPTY_SLOT);
      setNote('');
      setSelectedId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi đảo chuyển');
    }
  };

  return (
    <div className="mx-auto w-full max-w-lg space-y-3 pb-16">
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2.5">
        <div>
          <span className="block text-[11px] font-semibold uppercase text-slate-500">Bộ phận Xe nâng</span>
          <h2 className="text-sm font-bold text-slate-900">Đảo chuyển</h2>
        </div>
        <span className="rounded bg-slate-900 px-2.5 py-1 text-xs font-bold text-white">{inYard.length}</span>
      </div>

      <Feedback error={error} success={success} onClose={() => (setError(null), setSuccess(null))} />

      {/* Container đang chọn — đặt trên cùng để thao tác một tay trên điện thoại */}
      {selected && (
        <div className="space-y-3 rounded-lg border border-blue-600 bg-white p-4 text-xs">
          <div className="flex items-center justify-between">
            <ContainerNo no={selected.containerNo} locked={selected.isOnHold} lockReason={selected.holdReason} className="text-base" />
            <button type="button" onClick={() => setSelectedId('')} aria-label="Bỏ chọn" className="p-1 text-slate-400 hover:text-slate-700">
              <X className="h-4 w-4" />
            </button>
          </div>
          <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
            <dt className="text-slate-500">Size / Type</dt>
            <dd className="font-semibold">{selected.size}/{selected.type}</dd>
            <dt className="text-slate-500">Trạng thái</dt>
            <dd className="font-semibold">{selected.conditionClass} • {getContainerProgress(selected).map((p) => PROGRESS_LABELS[p]).join(', ')}</dd>
            <dt className="text-slate-500">Vị trí hiện tại</dt>
            <dd className="font-mono font-bold">{formatLocation(selected)}</dd>
          </dl>
          <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
            <span className="block font-bold text-slate-800">Vị trí mới *</span>
            <SlotPicker state={state} value={slot} onChange={setSlot} />
            <label className="block">
              <span className={labelCls}>Ghi chú tác nghiệp</span>
              <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: Hạ khu sửa chữa" className={inputCls} />
            </label>
          </div>
          <button type="button" disabled={!isSlotComplete(slot, state)} onClick={handleShift} className={`${primaryBtn} w-full py-3`}>
            <ArrowLeftRight className="h-4 w-4" />
            Xác nhận đảo chuyển
          </button>
        </div>
      )}

      <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); resetPage(); }}
            placeholder="Tìm số container..."
            className={`${inputCls} py-2.5 pl-8 font-mono text-sm uppercase`}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <select value={size} onChange={(e) => { setSize(e.target.value); resetPage(); }} className={inputCls} aria-label="Lọc size">
            <option value="ALL">Size: Tất cả</option>
            {state.containerSizes.map((s) => <option key={s} value={s}>Size {s}</option>)}
          </select>
          <select value={progress} onChange={(e) => { setProgress(e.target.value as 'ALL' | ContainerProgress); resetPage(); }} className={inputCls} aria-label="Lọc tiến độ">
            <option value="ALL">Tiến độ: Tất cả</option>
            {PROGRESS_FILTERS.map((p) => <option key={p} value={p}>{PROGRESS_LABELS[p]}</option>)}
          </select>
        </div>
      </div>

      <ul className="space-y-1.5">
        {inYard.length === 0 ? (
          <li className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center text-xs text-slate-500">Không có container phù hợp.</li>
        ) : (
          inYard.slice(0, shown).map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => { setSelectedId(c.id); setSlot(EMPTY_SLOT); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                className={`w-full rounded-lg border px-3 py-2.5 text-left text-xs ${selectedId === c.id ? 'border-blue-600 bg-blue-50' : 'border-slate-200 bg-white active:bg-slate-50'}`}
              >
                {/* DEC-092: 1 dòng SỐ CONT | SIZE/TYPE | VỊ TRÍ "BLOCK-A / 17-02-02"; ô Block rộng cố định (mã dài nhất) → Block thẳng Block, Bay thẳng Bay */}
                <div className="grid grid-cols-[7rem_2.75rem_1fr] items-center gap-2" data-testid="shift-row">
                  <ContainerNo no={c.containerNo} locked={c.isOnHold} lockReason={c.holdReason} className="text-sm" />
                  <span className="font-mono text-slate-600">{c.size}/{c.type}</span>
                  <span className="flex min-w-0 font-mono text-[11px] font-bold text-slate-900" data-testid="shift-slot">
                    <span className="shrink-0" style={{ width: `${blockCh}ch` }}>{c.currentBlock || ''}</span>
                    <span className="truncate">{slotDetail(c) ? ` / ${slotDetail(c)}` : ''}</span>
                  </span>
                </div>
                <div className="mt-0.5 grid grid-cols-[7rem_1fr] gap-2 text-[11px] text-slate-500">
                  <span className={c.conditionClass === 'DAMAGE' ? 'font-semibold text-rose-700' : 'font-semibold text-emerald-700'}>{c.conditionClass}</span>
                  <span className="truncate">{getContainerProgress(c).map((p) => PROGRESS_LABELS[p]).join(', ')}</span>
                </div>
              </button>
            </li>
          ))
        )}
      </ul>
      {inYard.length > shown && (
        <button type="button" onClick={() => setShown((n) => n + PAGE_SIZE)} className={`${secondaryBtn} w-full`}>
          Xem thêm ({inYard.length - shown})
        </button>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <button type="button" onClick={() => setShowHistory((v) => !v)} className="flex w-full items-center justify-between px-4 py-3 text-left text-xs font-bold text-slate-700">
          <span className="flex items-center gap-1.5"><History className="h-4 w-4 text-slate-500" />Lịch sử đảo chuyển gần đây ({recent.length})</span>
          {showHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {showHistory && (
          <ul className="divide-y divide-slate-100 border-t border-slate-200 text-xs">
            {recent.length === 0 ? (
              <li className="p-4 text-center text-slate-500">Chưa có tác nghiệp đảo chuyển.</li>
            ) : (
              recent.map((h) => (
                <li key={h.id} className="px-4 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <button type="button" onClick={() => onOpenDossier?.(h.masterDossierCode)} className="font-mono font-bold text-slate-900">{h.containerNo}</button>
                    <span className="text-[11px] text-slate-500">{formatViTime(h.performedAt)}</span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-700">{h.fromLocation} → {h.toLocation}</div>
                  <div className="text-[11px] text-slate-500">{h.performedBy} • {h.reason}</div>
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    </div>
  );
};
