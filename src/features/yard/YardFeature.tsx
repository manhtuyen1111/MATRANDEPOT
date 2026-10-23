import React, { useMemo, useState } from 'react';
import { Check, Lock, LockOpen, MessageSquarePlus, Pencil, Pin, Search, X } from 'lucide-react';
import { DepotState } from '../../services/depotStore';
import { correctContainerLocation, toggleContainerHold, updateContainerOfficeNote } from '../../services/depotOperations';
import { formatLocation, getContainerProgress, PROGRESS_LABELS } from '../../services/core';
import { can } from '../../services/permissions';
import { yardStockSheet } from '../../services/reports';
import { fileStamp, formatDateTime } from '../../services/datetime';
import { ContainerRecord, FieldConditionClass, K80InternalTicket } from '../../types/depot';
import {
  ContainerNo,
  EMPTY_SLOT,
  ExportExcelButton,
  Feedback,
  inputCls,
  isSlotComplete,
  labelCls,
  Pager,
  primaryBtn,
  secondaryBtn,
  SlotPicker,
  SlotValue,
} from '../../components/shared';

interface Props {
  state: DepotState;
  onUpdateState: (next: DepotState) => void;
  onOpenDossier?: (code: string) => void;
  onOpenK80Ticket?: (ticket: K80InternalTicket) => void;
}

const PAGE_SIZE = 50;
type Panel = { id: string; kind: 'LOCATION' | 'LOCK' } | null;

export const YardFeature: React.FC<Props> = ({ state, onUpdateState, onOpenDossier }) => {
  const [search, setSearch] = useState('');
  const [size, setSize] = useState('ALL');
  const [type, setType] = useState('ALL');
  const [condition, setCondition] = useState<'ALL' | FieldConditionClass>('ALL');
  const [page, setPage] = useState(1);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [panel, setPanel] = useState<Panel>(null);
  const [slot, setSlot] = useState<SlotValue>(EMPTY_SLOT);
  const [lockNote, setLockNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canEditLocation = can(state.currentUser, 'YARD_LOCATION_CORRECT');
  const canLock = can(state.currentUser, 'CONTAINER_LOCK');
  const canNote = can(state.currentUser, 'OFFICE_NOTE');

  const active = state.containers.filter((c) => c.status !== 'GATED_OUT');
  const filtered = useMemo(
    () =>
      active
        .filter((c) => !search.trim() || c.containerNo.includes(search.trim().toUpperCase()))
        .filter((c) => size === 'ALL' || c.size === size)
        .filter((c) => type === 'ALL' || c.type === type)
        .filter((c) => condition === 'ALL' || c.conditionClass === condition)
        .sort((a, b) => {
          const an = Boolean(a.officeNote?.trim());
          const bn = Boolean(b.officeNote?.trim());
          if (an !== bn) return an ? -1 : 1;
          return b.gateInAt.localeCompare(a.gateInAt);
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state.containers, search, size, type, condition]
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const run = (fn: () => DepotState, message: string) => {
    setError(null);
    setSuccess(null);
    try {
      onUpdateState(fn());
      setSuccess(message);
      setPanel(null);
      setSlot(EMPTY_SLOT);
      setLockNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thao tác thất bại');
    }
  };

  const openPanel = (c: ContainerRecord, kind: 'LOCATION' | 'LOCK' | '') => {
    setPanel(kind ? { id: c.id, kind } : null);
    setSlot(EMPTY_SLOT);
    setLockNote(kind === 'LOCK' && !c.isOnHold ? c.officeNote || '' : '');
  };

  return (
    <div className="w-full space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Tồn vỏ ({filtered.length} / {active.length})</h2>
          <p className="text-[11px] text-slate-500">Bấm vào dòng để mở hồ sơ container.</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <label>
            <span className={labelCls}>Số container</span>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className={`${inputCls} w-44 pl-7 font-mono uppercase`} />
            </div>
          </label>
          <label>
            <span className={labelCls}>Size</span>
            <select value={size} onChange={(e) => { setSize(e.target.value); setPage(1); }} className={inputCls}>
              <option value="ALL">Tất cả</option>
              {state.containerSizes.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label>
            <span className={labelCls}>Type</span>
            <select value={type} onChange={(e) => { setType(e.target.value); setPage(1); }} className={inputCls}>
              <option value="ALL">Tất cả</option>
              {state.containerTypes.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label>
            <span className={labelCls}>Trạng thái</span>
            <select value={condition} onChange={(e) => { setCondition(e.target.value as 'ALL' | FieldConditionClass); setPage(1); }} className={inputCls}>
              <option value="ALL">Tất cả</option>
              <option value="AV">AV</option>
              <option value="DAMAGE">DAMAGE</option>
            </select>
          </label>
          <ExportExcelButton fileName={`MATRAN_TON_VO_${fileStamp(formatDateTime(new Date()))}.xlsx`} disabled={filtered.length === 0} getSheets={() => [yardStockSheet(filtered)]} />
        </div>
      </div>

      <Feedback error={error} success={success} onClose={() => (setError(null), setSuccess(null))} />

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[920px] text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2.5">Mã hồ sơ</th>
              <th className="px-3 py-2.5">Số container</th>
              <th className="px-3 py-2.5">Size</th>
              <th className="px-3 py-2.5">Type</th>
              <th className="px-3 py-2.5">Hãng tàu</th>
              <th className="px-3 py-2.5">Trạng thái</th>
              <th className="px-3 py-2.5">Vị trí</th>
              <th className="px-3 py-2.5">Tiến độ</th>
              <th className="w-64 px-3 py-2.5">Ghi chú văn phòng</th>
              <th className="px-3 py-2.5 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-500">Không có container khớp bộ lọc.</td></tr>
            ) : (
              rows.map((c) => {
                const hasNote = Boolean(c.officeNote?.trim());
                const hasPosition = Boolean(c.currentBlock) && (c.status === 'IN_YARD' || c.status === 'ALLOCATED');
                const panelOpen = panel?.id === c.id;
                return (
                  <React.Fragment key={c.id}>
                    <tr onClick={() => onOpenDossier?.(c.masterDossierCode)} className={`cursor-pointer ${hasNote ? 'bg-amber-50/70' : 'hover:bg-slate-50'}`}>
                      <td className="px-3 py-2.5 font-mono text-blue-700">
                        <span className="inline-flex items-center gap-1">
                          {hasNote && <Pin className="h-3 w-3 text-amber-600" aria-label="Có ghi chú" />}
                          {c.masterDossierCode}
                        </span>
                      </td>
                      <td className="px-3 py-2.5"><ContainerNo no={c.containerNo} locked={c.isOnHold} lockReason={c.holdReason} className="text-sm" /></td>
                      <td className="px-3 py-2.5">{c.size}</td>
                      <td className="px-3 py-2.5">{c.type}</td>
                      <td className="px-3 py-2.5">{c.shippingLineCode}</td>
                      <td className={`px-3 py-2.5 font-bold ${c.conditionClass === 'DAMAGE' ? 'text-rose-700' : 'text-emerald-700'}`}>{c.conditionClass}</td>
                      <td className="px-3 py-2.5 font-mono" onClick={(e) => canEditLocation && hasPosition && e.stopPropagation()}>
                        <span className="inline-flex items-center gap-1.5">
                          {formatLocation(c)}
                          {canEditLocation && hasPosition && (
                            <button
                              type="button"
                              aria-label={`Sửa vị trí ${c.containerNo}`}
                              title="Sửa vị trí bãi"
                              onClick={() => openPanel(c, panelOpen && panel!.kind === 'LOCATION' ? '' : 'LOCATION')}
                              className="text-slate-500 hover:text-slate-800"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-[11px]">{getContainerProgress(c).map((p) => PROGRESS_LABELS[p]).join(', ')}</td>
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        {editingNoteId === c.id ? (
                          <div className="flex items-center gap-1">
                            <input value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} autoFocus className={inputCls} />
                            <button
                              type="button"
                              aria-label="Lưu ghi chú"
                              onClick={() => { run(() => updateContainerOfficeNote(state, { containerId: c.id, officeNote: noteDraft }), 'Đã lưu ghi chú.'); setEditingNoteId(null); }}
                              className="rounded bg-blue-600 p-1.5 text-white"
                            >
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button type="button" aria-label="Hủy" onClick={() => setEditingNoteId(null)} className="rounded border border-slate-300 p-1.5 text-slate-600">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : hasNote ? (
                          <div className="flex items-start justify-between gap-2">
                            <span className="font-semibold text-amber-900">{c.officeNote}</span>
                            {canNote && (
                              <button type="button" aria-label="Sửa ghi chú" onClick={() => { setEditingNoteId(c.id); setNoteDraft(c.officeNote || ''); }} className="text-slate-500 hover:text-slate-800">
                                <Pencil className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        ) : canNote ? (
                          <button type="button" onClick={() => { setEditingNoteId(c.id); setNoteDraft(''); }} className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800">
                            <MessageSquarePlus className="h-3.5 w-3.5" />
                            Thêm ghi chú
                          </button>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                        {canLock && (
                          <button
                            type="button"
                            onClick={() => openPanel(c, panelOpen && panel!.kind === 'LOCK' ? '' : 'LOCK')}
                            className={secondaryBtn}
                            title={c.isOnHold ? 'Mở khóa container' : 'Khóa container'}
                          >
                            {c.isOnHold ? <LockOpen className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                            {c.isOnHold ? 'Mở khóa' : 'Khóa'}
                          </button>
                        )}
                      </td>
                    </tr>
                    {panelOpen && (
                      <tr className="bg-slate-50">
                        <td colSpan={10} className="px-4 py-3">
                          {panel!.kind === 'LOCATION' ? (
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
                              <div className="flex-1">
                                <p className="mb-2 text-[11px] text-slate-600">
                                  SỬA VỊ TRÍ hành chính cho <strong>{c.containerNo}</strong> (hiện tại {formatLocation(c)}). Không ghi nhận là tác nghiệp ĐẢO CHUYỂN.
                                </p>
                                <SlotPicker state={state} value={slot} onChange={setSlot} />
                              </div>
                              <button
                                type="button"
                                disabled={!isSlotComplete(slot)}
                                onClick={() => run(() => correctContainerLocation(state, { containerId: c.id, ...slot }), `Đã sửa vị trí ${c.containerNo}.`)}
                                className={primaryBtn}
                              >
                                Lưu vị trí
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                              <label className="flex-1">
                                <span className={labelCls}>{c.isOnHold ? 'Ghi chú mở khóa *' : 'Remark Văn phòng (lý do khóa) *'}</span>
                                <input value={lockNote} onChange={(e) => setLockNote(e.target.value)} placeholder={c.isOnHold ? `Đang khóa: ${c.holdReason}` : 'Remark Văn phòng — ghi vào cột Ghi chú văn phòng'} className={inputCls} />
                              </label>
                              <button
                                type="button"
                                disabled={!lockNote.trim()}
                                onClick={() =>
                                  run(
                                    () => toggleContainerHold(state, { containerNo: c.containerNo, hold: !c.isOnHold, reason: lockNote }),
                                    c.isOnHold ? `Đã mở khóa ${c.containerNo}.` : `Đã khóa ${c.containerNo} — không thể cấp vỏ / xuất vỏ.`
                                  )
                                }
                                className={primaryBtn}
                              >
                                {c.isOnHold ? 'Xác nhận mở khóa' : 'Xác nhận khóa'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
        {filtered.length > PAGE_SIZE && <Pager page={safePage} pageCount={pageCount} total={filtered.length} onPage={setPage} />}
      </div>
    </div>
  );
};
