import React, { useMemo, useState } from 'react';
import { Check, ListChecks, Lock, LockOpen, MessageSquarePlus, Pencil, Search, X } from 'lucide-react';
import { DepotState } from '../../services/depotStore';
import {
  bulkToggleContainerHold,
  bulkUpdateOfficeNote,
  BulkResult,
  correctContainerLocation,
  toggleContainerHold,
  updateContainerOfficeNote,
} from '../../services/depotOperations';
import { formatLocation, getContainerProgress, parseContainerList, PROGRESS_LABELS, storageDays } from '../../services/core';
import { can } from '../../services/permissions';
import { yardStockSheet } from '../../services/reports';
import { fileStamp, formatDateTime } from '../../services/datetime';
import { ContainerRecord, FieldConditionClass, K80InternalTicket } from '../../types/depot';
import {
  EMPTY_SLOT,
  ExportExcelButton,
  Feedback,
  inputCls,
  isSlotComplete,
  labelCls,
  Pager,
  usePageSize,
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

type Panel = { id: string; kind: 'LOCATION' | 'LOCK' } | null;
type BulkAction = 'LOCK' | 'UNLOCK' | 'NOTE';

// TỒN VỎ (DEC-030, DEC-065, DEC-067): khóa tại icon cạnh số cont; sửa vị trí / ghi chú tại ô; tìm + khóa + ghi chú hàng loạt
export const YardFeature: React.FC<Props> = ({ state, onUpdateState, onOpenDossier }) => {
  const [search, setSearch] = useState('');
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkList, setBulkList] = useState<string[]>([]);
  const [size, setSize] = useState('ALL');
  const [type, setType] = useState('ALL');
  const [condition, setCondition] = useState<'ALL' | FieldConditionClass>('ALL');
  const [page, setPage] = useState(1);
  const [PAGE_SIZE, setPageSize] = usePageSize("yard", 50); // DEC-080
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState('');
  const [panel, setPanel] = useState<Panel>(null);
  const [slot, setSlot] = useState<SlotValue>(EMPTY_SLOT);
  const [lockNote, setLockNote] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<BulkAction>('LOCK');
  const [bulkNote, setBulkNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canEditLocation = can(state.currentUser, 'YARD_LOCATION_CORRECT');
  const canLock = can(state.currentUser, 'CONTAINER_LOCK');
  const canNote = can(state.currentUser, 'OFFICE_NOTE');
  const canBulk = canLock || canNote;

  const active = state.containers.filter((c) => c.status !== 'GATED_OUT');
  const bulkSet = useMemo(() => new Set(bulkList), [bulkList]);
  const filtered = useMemo(
    () =>
      active
        .filter((c) => bulkList.length === 0 || bulkSet.has(c.containerNo))
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
    [state.containers, bulkList, search, size, type, condition]
  );
  const notFound = bulkList.filter((no) => !active.some((c) => c.containerNo === no));
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const rows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const selectedIds = filtered.filter((c) => selected.has(c.id)).map((c) => c.id);
  const allFilteredSelected = filtered.length > 0 && selectedIds.length === filtered.length;
  const now = new Date();

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

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const applyBulkSearch = () => {
    setBulkList(parseContainerList(bulkText));
    setSelected(new Set());
    setPage(1);
  };

  const runBulk = () => {
    setError(null);
    setSuccess(null);
    try {
      let res: BulkResult;
      if (bulkAction === 'NOTE') res = bulkUpdateOfficeNote(state, { containerIds: selectedIds, officeNote: bulkNote });
      else res = bulkToggleContainerHold(state, { containerIds: selectedIds, hold: bulkAction === 'LOCK', reason: bulkNote });
      onUpdateState(res.state);
      const label = bulkAction === 'LOCK' ? 'khóa' : bulkAction === 'UNLOCK' ? 'mở khóa' : 'ghi chú';
      setSuccess(
        `Đã ${label} ${res.done.length} container.` +
          (res.skipped.length ? ` Bỏ qua ${res.skipped.length}: ${res.skipped.map((s) => `${s.containerNo} (${s.reason})`).join(', ')}.` : '')
      );
      setSelected(new Set());
      setBulkNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thao tác hàng loạt thất bại');
    }
  };

  const colCount = canBulk ? 12 : 11;

  return (
    <div className="w-full space-y-3">
      <div className="space-y-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs">
        <div className="flex flex-wrap items-end justify-between gap-3">
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
            <button type="button" onClick={() => setBulkOpen(!bulkOpen)} className={`${secondaryBtn} ${bulkList.length ? 'border-blue-600 text-blue-700' : ''}`}>
              <ListChecks className="h-3.5 w-3.5" />
              Tìm hàng loạt{bulkList.length ? ` (${bulkList.length})` : ''}
            </button>
            <ExportExcelButton fileName={`MATRAN_TON_VO_${fileStamp(formatDateTime(new Date()))}.xlsx`} disabled={filtered.length === 0} getSheets={() => [yardStockSheet(filtered)]} />
          </div>
        </div>

        {bulkOpen && (
          <div className="flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-end">
            <label className="flex-1">
              <span className={labelCls}>Danh sách số container (mỗi dòng 1 số, hoặc cách nhau bởi dấu phẩy / khoảng trắng)</span>
              <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={3} placeholder={'MSKU4089123\nTGHU2211457'} className={`${inputCls} font-mono uppercase`} />
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={applyBulkSearch} disabled={!bulkText.trim()} className={primaryBtn}>Tìm</button>
              {bulkList.length > 0 && (
                <button type="button" onClick={() => { setBulkList([]); setBulkText(''); setSelected(new Set()); }} className={secondaryBtn}>Bỏ lọc</button>
              )}
            </div>
          </div>
        )}
        {bulkList.length > 0 && notFound.length > 0 && (
          <p className="rounded-md bg-rose-50 px-3 py-2 text-[11px] text-rose-800">
            Không có trong tồn vỏ ({notFound.length}): <span className="font-mono">{notFound.join(', ')}</span>
          </p>
        )}
      </div>

      <Feedback error={error} success={success} onClose={() => (setError(null), setSuccess(null))} />

      {canBulk && selectedIds.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs sm:flex-row sm:items-end">
          <p className="font-bold text-blue-900 sm:self-center">Đã chọn {selectedIds.length} container</p>
          <label>
            <span className={labelCls}>Thao tác</span>
            <select value={bulkAction} onChange={(e) => setBulkAction(e.target.value as BulkAction)} className={inputCls}>
              {canLock && <option value="LOCK">Khóa</option>}
              {canLock && <option value="UNLOCK">Mở khóa</option>}
              {canNote && <option value="NOTE">Ghi chú</option>}
            </select>
          </label>
          <label className="flex-1">
            <span className={labelCls}>{bulkAction === 'LOCK' ? 'Ghi chú (lý do khóa) *' : bulkAction === 'UNLOCK' ? 'Ghi chú mở khóa *' : 'Ghi chú (để trống = xóa ghi chú)'}</span>
            <input value={bulkNote} onChange={(e) => setBulkNote(e.target.value)} className={inputCls} />
          </label>
          <button type="button" onClick={runBulk} disabled={bulkAction !== 'NOTE' && !bulkNote.trim()} className={primaryBtn}>Áp dụng</button>
          <button type="button" onClick={() => setSelected(new Set())} className={secondaryBtn}>Bỏ chọn</button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[1120px] text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-600">
            <tr>
              {canBulk && (
                <th className="w-8 px-2 py-2.5">
                  <input
                    type="checkbox"
                    aria-label="Chọn tất cả theo bộ lọc"
                    checked={allFilteredSelected}
                    onChange={() => setSelected(allFilteredSelected ? new Set() : new Set(filtered.map((c) => c.id)))}
                  />
                </th>
              )}
              <th className="w-32 whitespace-nowrap px-2 py-2.5">Mã hồ sơ</th>
              <th className="w-36 whitespace-nowrap px-2 py-2.5">Số container</th>
              <th className="w-12 px-2 py-2.5 text-center">Size</th>
              <th className="w-12 px-2 py-2.5 text-center">Type</th>
              <th className="w-20 whitespace-nowrap px-2 py-2.5">Hãng tàu</th>
              <th className="w-24 whitespace-nowrap px-2 py-2.5">Date in</th>
              <th className="w-20 whitespace-nowrap px-2 py-2.5 text-center">Trạng thái</th>
              <th className="w-16 whitespace-nowrap px-2 py-2.5 text-right">Lưu bãi</th>
              <th className="w-40 px-2 py-2.5">Vị trí</th>
              <th className="w-40 px-2 py-2.5">Tiến độ</th>
              <th className="min-w-[14rem] px-2 py-2.5">Ghi chú</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr><td colSpan={colCount} className="px-4 py-8 text-center text-slate-500">Không có container khớp bộ lọc.</td></tr>
            ) : (
              rows.map((c) => {
                const hasNote = Boolean(c.officeNote?.trim());
                const hasPosition = Boolean(c.currentBlock) && (c.status === 'IN_YARD' || c.status === 'ALLOCATED');
                const panelOpen = panel?.id === c.id;
                return (
                  <React.Fragment key={c.id}>
                    <tr onClick={() => onOpenDossier?.(c.masterDossierCode)} className={`cursor-pointer hover:bg-slate-50 ${selected.has(c.id) ? 'bg-blue-50/60' : ''}`}>
                      {canBulk && (
                        <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <input type="checkbox" aria-label={`Chọn ${c.containerNo}`} checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} />
                        </td>
                      )}
                      <td className="whitespace-nowrap px-2 py-2.5 font-mono text-blue-700">{c.masterDossierCode}</td>
                      <td className="whitespace-nowrap px-2 py-2.5">
                        <span className="inline-flex items-center gap-1.5 font-mono text-sm font-bold text-slate-900">
                          {c.containerNo}
                          <button
                            type="button"
                            disabled={!canLock}
                            onClick={(e) => { e.stopPropagation(); openPanel(c, panelOpen && panel!.kind === 'LOCK' ? '' : 'LOCK'); }}
                            title={c.isOnHold ? `Đang khóa: ${c.holdReason || ''}${canLock ? ' — bấm để mở khóa' : ''}` : canLock ? 'Bấm để khóa container' : 'Không khóa'}
                            className={`inline-flex disabled:cursor-default ${c.isOnHold ? 'text-rose-600' : 'text-slate-300 hover:text-slate-500'}`}
                          >
                            {c.isOnHold ? (
                              <Lock className="h-3.5 w-3.5" aria-label="Container đang bị khóa" />
                            ) : (
                              <LockOpen className="h-3.5 w-3.5" aria-label="Container không khóa" />
                            )}
                          </button>
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-center">{c.size}</td>
                      <td className="px-2 py-2.5 text-center">{c.type}</td>
                      <td className="whitespace-nowrap px-2 py-2.5">{c.shippingLineCode}</td>
                      <td className="whitespace-nowrap px-2 py-2.5 font-mono leading-tight" title="Thời gian vào bãi (Hạ vỏ / Nhập tàu)">
                        <span className="block">{formatDateTime(c.gateInAt).slice(0, 10)}</span>
                        <span className="block text-[10px] text-slate-500">{formatDateTime(c.gateInAt).slice(11)}</span>
                      </td>
                      <td className={`px-2 py-2.5 text-center font-bold ${c.conditionClass === 'DAMAGE' ? 'text-rose-700' : 'text-emerald-700'}`}>{c.conditionClass}</td>
                      <td className="px-2 py-2.5 text-right font-mono font-bold">{storageDays(c.gateInAt, now)}</td>
                      <td className="px-2 py-2.5 font-mono" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-start justify-between gap-2">
                          <span>{formatLocation(c)}</span>
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
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-[11px]">{getContainerProgress(c).map((p) => PROGRESS_LABELS[p]).join(', ')}</td>
                      <td className={`px-2 py-2.5 ${hasNote && editingNoteId !== c.id ? 'bg-yellow-200' : ''}`} onClick={(e) => e.stopPropagation()}>
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
                            <span className="font-semibold text-slate-900">{c.officeNote}</span>
                            {canNote && (
                              <button type="button" aria-label="Sửa ghi chú" onClick={() => { setEditingNoteId(c.id); setNoteDraft(c.officeNote || ''); }} className="text-slate-600 hover:text-slate-900">
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
                    </tr>
                    {panelOpen && (
                      <tr className="bg-slate-50">
                        <td colSpan={colCount} className="px-4 py-3">
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
                                disabled={!isSlotComplete(slot, state)}
                                onClick={() => run(() => correctContainerLocation(state, { containerId: c.id, ...slot }), `Đã sửa vị trí ${c.containerNo}.`)}
                                className={primaryBtn}
                              >
                                Lưu vị trí
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                              <label className="flex-1">
                                <span className={labelCls}>{c.isOnHold ? `Mở khóa ${c.containerNo} — ghi chú mở khóa *` : `Khóa ${c.containerNo} — ghi chú (lý do khóa) *`}</span>
                                <input value={lockNote} onChange={(e) => setLockNote(e.target.value)} placeholder={c.isOnHold ? `Đang khóa: ${c.holdReason}` : 'Ghi vào cột Ghi chú'} className={inputCls} />
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
                              <button type="button" onClick={() => setPanel(null)} className={secondaryBtn}>Hủy</button>
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
        {filtered.length > 0 && <Pager page={safePage} pageCount={pageCount} total={filtered.length} onPage={setPage} pageSize={PAGE_SIZE} onPageSize={setPageSize} />}
      </div>
    </div>
  );
};
