import React, { useMemo, useState } from 'react';
import { CheckCircle2, ClipboardList, ListPlus, Search, Trash2 } from 'lucide-react';
import { FieldConditionClass, VesselList, VesselMode, VESSEL_MODE_LABELS } from '../../types/depot';
import { DepotState } from '../../services/depotStore';
import {
  approveVesselList,
  createVesselList,
  parseTruckList,
  parseVesselImportText,
  removeVesselListItem,
  vesselExportBlocker,
  vesselListProgress,
} from '../../services/vessel';
import { formatLocation, storageDays } from '../../services/core';
import { formatDateTime, parseDateTime } from '../../services/datetime';
import { can } from '../../services/permissions';
import { ContainerNo, DateTimeField, Feedback, inputCls, labelCls, primaryBtn, secondaryBtn, SectionCard } from '../../components/shared';
import { VesselListTitle, VesselProgressBar } from './VesselShared';

interface Props {
  mode: VesselMode;
  state: DepotState;
  onUpdateState: (next: DepotState) => void;
  onOpenDossier?: (code: string) => void;
}

const ITEM_STATUS: Record<VesselMode, Record<string, { label: string; cls: string }>> = {
  NHAP_TAU: {
    PENDING: { label: 'Chờ xe về', cls: 'bg-slate-100 text-slate-700' },
    INSPECTED: { label: 'Đã giám định — chờ hạ', cls: 'bg-amber-100 text-amber-800' },
    DONE: { label: 'Đã hạ bãi', cls: 'bg-emerald-100 text-emerald-800' },
  },
  XUAT_TAU: {
    PENDING: { label: 'Chờ xuất', cls: 'bg-slate-100 text-slate-700' },
    INSPECTED: { label: '-', cls: '' },
    DONE: { label: 'Đã xuất tàu', cls: 'bg-emerald-100 text-emerald-800' },
  },
};

// VĂN PHÒNG — NHẬP TÀU / XUẤT TÀU (DEC-069): lập danh sách, theo dõi tiến độ, duyệt
export const OfficeVesselWorkspace: React.FC<Props> = ({ mode, state, onUpdateState, onOpenDossier }) => {
  const isImport = mode === 'NHAP_TAU';
  const modeLabel = VESSEL_MODE_LABELS[mode];
  const canManage = can(state.currentUser, 'VESSEL_LIST_MANAGE');
  const [vesselName, setVesselName] = useState('');
  const [plannedAt, setPlannedAt] = useState(() => formatDateTime(new Date()));
  const [lineCode, setLineCode] = useState('');
  const [trucksText, setTrucksText] = useState('');
  const [importText, setImportText] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [size, setSize] = useState('ALL');
  const [condition, setCondition] = useState<'ALL' | FieldConditionClass>('ALL');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const lists = (state.vesselLists || []).filter((l) => l.mode === mode);
  const openLists = lists.filter((l) => l.status === 'OPEN');
  const approved = lists.filter((l) => l.status === 'APPROVED').slice(0, 5);
  const parsed = isImport ? parseVesselImportText(state, importText) : { rows: [], errors: [] };
  const trucks = parseTruckList(trucksText);

  // XUẤT TÀU: chọn từ tồn vỏ (mọi cont đang tồn bãi; cont không đưa vào được thì hiện lý do)
  const yard = useMemo(
    () =>
      state.containers
        .filter((c) => c.status === 'IN_YARD' || c.status === 'ALLOCATED')
        .filter((c) => !search.trim() || c.containerNo.includes(search.trim().toUpperCase()))
        .filter((c) => size === 'ALL' || c.size === size)
        .filter((c) => condition === 'ALL' || c.conditionClass === condition)
        .sort((a, b) => a.gateInAt.localeCompare(b.gateInAt)),
    [state.containers, search, size, condition]
  );
  const selectable = yard.filter((c) => !vesselExportBlocker(c));

  const run = (fn: () => DepotState, message: string) => {
    setError(null);
    setSuccess(null);
    try {
      onUpdateState(fn());
      setSuccess(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thao tác thất bại');
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      if (isImport && parsed.errors.length) throw new Error(`Danh sách container còn ${parsed.errors.length} dòng lỗi — sửa trước khi lập.`);
      const at = parseDateTime(plannedAt, 'start');
      const res = createVesselList(state, {
        mode,
        vesselName,
        plannedAt: at ? at.toISOString() : '',
        truckNos: trucks,
        shippingLineCode: isImport ? lineCode : undefined,
        importItems: isImport ? parsed.rows : undefined,
        exportContainerIds: isImport ? undefined : Array.from(picked),
      });
      onUpdateState(res.state);
      const list = res.state.vesselLists.find((l) => l.id === res.listId)!;
      setSuccess(`Đã lập danh sách ${modeLabel} tàu ${list.vesselName}: ${list.items.length} container, ${list.truckNos.length} xe.`);
      setVesselName('');
      setTrucksText('');
      setImportText('');
      setPicked(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi lập danh sách');
    }
  };

  const togglePick = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id); else next.add(id);
    setPicked(next);
  };
  const allPicked = selectable.length > 0 && selectable.every((c) => picked.has(c.id));

  return (
    <div className="space-y-4">
      <Feedback error={error} success={success} onClose={() => (setError(null), setSuccess(null))} />

      {canManage && (
        <SectionCard title={`Lập danh sách ${modeLabel}`} icon={<ListPlus className="h-4 w-4 text-slate-500" />}>
          <form onSubmit={submit} className="space-y-3 text-xs">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <label>
                <span className={labelCls}>Tên tàu *</span>
                <input value={vesselName} onChange={(e) => setVesselName(e.target.value.toUpperCase())} className={`${inputCls} uppercase`} />
              </label>
              <DateTimeField label={`Thời gian ${modeLabel.toLowerCase()} *`} value={plannedAt} onChange={setPlannedAt} />
              {isImport && (
                <label>
                  <span className={labelCls}>Hãng tàu *</span>
                  <select value={lineCode} onChange={(e) => setLineCode(e.target.value)} className={inputCls}>
                    <option value="">-- Chọn --</option>
                    {state.partners.filter((p) => p.isShippingLine).map((p) => <option key={p.id} value={p.code}>{p.code} — {p.name}</option>)}
                  </select>
                </label>
              )}
              <label className={isImport ? '' : 'sm:col-span-2'}>
                <span className={labelCls}>Danh sách số xe * ({trucks.length})</span>
                <textarea value={trucksText} onChange={(e) => setTrucksText(e.target.value)} rows={2} placeholder={'15C-111.11\n15C-222.22'} className={`${inputCls} uppercase`} />
              </label>
            </div>

            {isImport ? (
              <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                <label>
                  <span className={labelCls}>Danh sách container * — mỗi dòng: SỐ CONT  SIZE  TYPE (dán từ Excel được)</span>
                  <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={8} placeholder={'TCLU1234567\t40\tHC\nTCLU7654321\t20\tDC'} className={`${inputCls} font-mono uppercase`} />
                </label>
                <div className="rounded-md border border-slate-200 p-2">
                  <p className="mb-1 text-[11px] font-bold uppercase text-slate-600">Xem trước: {parsed.rows.length} container</p>
                  {parsed.errors.length > 0 && (
                    <ul className="mb-2 space-y-0.5 rounded bg-rose-50 p-2 text-[11px] text-rose-800">
                      {parsed.errors.map((er) => <li key={er}>{er}</li>)}
                    </ul>
                  )}
                  <div className="max-h-48 overflow-y-auto">
                    <table className="w-full text-left">
                      <tbody className="divide-y divide-slate-100">
                        {parsed.rows.map((r, i) => (
                          <tr key={r.containerNo}>
                            <td className="py-1 pr-2 text-slate-400">{i + 1}</td>
                            <td className="py-1 pr-2"><ContainerNo no={r.containerNo} /></td>
                            <td className="py-1">{r.size}/{r.type}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-2 rounded-md border border-slate-200 p-2">
                <div className="flex flex-wrap items-end gap-2">
                  <p className="mr-auto text-[11px] font-bold uppercase text-slate-600">Chọn container từ tồn vỏ — đã chọn {picked.size}</p>
                  <label>
                    <span className={labelCls}>Số cont</span>
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                      <input value={search} onChange={(e) => setSearch(e.target.value)} className={`${inputCls} w-40 pl-7 font-mono uppercase`} />
                    </div>
                  </label>
                  <label>
                    <span className={labelCls}>Size</span>
                    <select value={size} onChange={(e) => setSize(e.target.value)} className={inputCls}>
                      <option value="ALL">Tất cả</option>
                      {state.containerSizes.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                  <label>
                    <span className={labelCls}>Trạng thái</span>
                    <select value={condition} onChange={(e) => setCondition(e.target.value as 'ALL' | FieldConditionClass)} className={inputCls}>
                      <option value="ALL">Tất cả</option>
                      <option value="AV">AV</option>
                      <option value="DAMAGE">DAMAGE</option>
                    </select>
                  </label>
                </div>
                <div className="max-h-80 overflow-auto">
                  <table className="w-full min-w-[760px] text-left">
                    <thead className="sticky top-0 border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-600">
                      <tr>
                        <th className="w-8 px-2 py-2">
                          <input
                            type="checkbox"
                            aria-label="Chọn tất cả"
                            checked={allPicked}
                            onChange={() => setPicked(allPicked ? new Set() : new Set(selectable.map((c) => c.id)))}
                          />
                        </th>
                        <th className="px-2 py-2">Số container</th>
                        <th className="px-2 py-2">Size</th>
                        <th className="px-2 py-2">Type</th>
                        <th className="px-2 py-2">Hãng tàu</th>
                        <th className="px-2 py-2">Trạng thái</th>
                        <th className="px-2 py-2">Phân loại</th>
                        <th className="px-2 py-2">Vị trí hiện tại</th>
                        <th className="px-2 py-2 text-right">Lưu bãi</th>
                        <th className="px-2 py-2">Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {yard.length === 0 ? (
                        <tr><td colSpan={10} className="py-6 text-center text-slate-500">Không có container tồn bãi khớp bộ lọc.</td></tr>
                      ) : (
                        yard.map((c) => {
                          const blocker = vesselExportBlocker(c);
                          return (
                            <tr key={c.id} onClick={() => !blocker && togglePick(c.id)} className={blocker ? 'bg-slate-50 text-slate-400' : `cursor-pointer ${picked.has(c.id) ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                              <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                                <input type="checkbox" aria-label={`Chọn ${c.containerNo}`} disabled={Boolean(blocker)} checked={picked.has(c.id)} onChange={() => togglePick(c.id)} />
                              </td>
                              <td className="px-2 py-1.5"><ContainerNo no={c.containerNo} locked={c.isOnHold} lockReason={c.officeNote || c.holdReason} /></td>
                              <td className="px-2 py-1.5">{c.size}</td>
                              <td className="px-2 py-1.5">{c.type}</td>
                              <td className="px-2 py-1.5">{c.shippingLineCode}</td>
                              <td className={`px-2 py-1.5 font-bold ${blocker ? '' : c.conditionClass === 'DAMAGE' ? 'text-rose-700' : 'text-emerald-700'}`}>{c.conditionClass}</td>
                              <td className="px-2 py-1.5">{c.stuffingClass}</td>
                              <td className="px-2 py-1.5 font-mono">{formatLocation(c)}</td>
                              <td className="px-2 py-1.5 text-right font-mono">{storageDays(c.gateInAt)}</td>
                              <td className="px-2 py-1.5 text-[11px]">{blocker ? <span className="font-semibold text-rose-700">{blocker}</span> : c.officeNote || ''}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <button type="submit" className={primaryBtn}>
              <ListPlus className="h-4 w-4" />
              Lập danh sách {modeLabel} ({isImport ? parsed.rows.length : picked.size} cont)
            </button>
          </form>
        </SectionCard>
      )}

      <SectionCard
        title={`Danh sách ${modeLabel} đang thực hiện`}
        icon={<ClipboardList className="h-4 w-4 text-slate-500" />}
        right={<span className="rounded bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-white">{openLists.length}</span>}
      >
        {openLists.length === 0 ? (
          <p className="text-xs text-slate-500">Chưa có danh sách nào đang thực hiện.</p>
        ) : (
          <div className="space-y-4">
            {openLists.map((l) => (
              <VesselListCard key={l.id} list={l} mode={mode} canManage={canManage} onOpenDossier={onOpenDossier}
                onApprove={() => run(() => approveVesselList(state, { listId: l.id, mode }), `Đã duyệt ${modeLabel} thành công tàu ${l.vesselName}.`)}
                onRemove={(itemId, no) => run(() => removeVesselListItem(state, { listId: l.id, itemId, mode }), `Đã bỏ ${no} khỏi danh sách.`)}
              />
            ))}
          </div>
        )}
      </SectionCard>

      {approved.length > 0 && (
        <SectionCard title={`Đã duyệt gần đây (xem đầy đủ ở Báo cáo → ${isImport ? 'Nhập tàu' : 'Xuất tàu'})`} icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}>
          <ul className="divide-y divide-slate-100 text-xs">
            {approved.map((l) => (
              <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <VesselListTitle list={l} />
                <span className="text-[11px] text-slate-600">{l.items.length} cont • duyệt bởi {l.approvedBy} • {formatDateTime(l.approvedAt)}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
};

const VesselListCard: React.FC<{
  list: VesselList;
  mode: VesselMode;
  canManage: boolean;
  onApprove: () => void;
  onRemove: (itemId: string, containerNo: string) => void;
  onOpenDossier?: (code: string) => void;
}> = ({ list, mode, canManage, onApprove, onRemove, onOpenDossier }) => {
  const p = vesselListProgress(list);
  const isImport = mode === 'NHAP_TAU';
  const complete = p.total > 0 && p.done === p.total;
  return (
    <div className="space-y-2 rounded-lg border border-slate-200 p-3 text-xs">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-1">
          <VesselListTitle list={list} />
          <p className="text-[11px] text-slate-600">Xe: <span className="font-semibold">{list.truckNos.join(', ')}</span> • lập bởi {list.createdBy}, {formatDateTime(list.createdAt)}</p>
        </div>
        {canManage && (
          <button type="button" onClick={onApprove} disabled={!complete} className={primaryBtn} title={complete ? '' : 'Chỉ duyệt khi đã xong hết danh sách'}>
            <CheckCircle2 className="h-4 w-4" />
            Duyệt {VESSEL_MODE_LABELS[mode]} thành công
          </button>
        )}
      </div>
      <VesselProgressBar list={list} />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead className="border-b border-slate-200 text-[11px] uppercase text-slate-500">
            <tr>
              <th className="py-1.5 pr-2">Mã hồ sơ</th>
              <th className="py-1.5 pr-2">Số container</th>
              <th className="py-1.5 pr-2">Size/Type</th>
              <th className="py-1.5 pr-2">{isImport ? 'Giám định' : 'Trạng thái • Phân loại'}</th>
              {!isImport && <th className="py-1.5 pr-2">Vị trí lúc lập</th>}
              <th className="py-1.5 pr-2">Số xe</th>
              <th className="py-1.5 pr-2">Tiến độ</th>
              <th className="py-1.5 pr-2">Người / giờ</th>
              <th className="py-1.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.items.map((i) => {
              const st = ITEM_STATUS[mode][i.status];
              return (
                <tr key={i.id}>
                  <td className="py-1.5 pr-2 font-mono">
                    {i.dossierCode && i.status !== 'PENDING' ? (
                      <button type="button" onClick={() => onOpenDossier?.(i.dossierCode!)} className="text-blue-700 hover:underline">{i.dossierCode}</button>
                    ) : (
                      <span className="text-slate-500">{i.dossierCode || '-'}</span>
                    )}
                  </td>
                  <td className="py-1.5 pr-2"><ContainerNo no={i.containerNo} /></td>
                  <td className="py-1.5 pr-2">{i.size}/{i.type}</td>
                  <td className="py-1.5 pr-2">{i.conditionClass ? `${i.conditionClass} • ${i.stuffingClass || '-'}` : '-'}{isImport && i.cleaningItems ? ` • ${i.cleaningItems.join(', ')}` : ''}</td>
                  {!isImport && <td className="py-1.5 pr-2 font-mono">{i.locationAtList || '-'}</td>}
                  <td className="py-1.5 pr-2">{i.truckNo || '-'}</td>
                  <td className="py-1.5 pr-2"><span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${st.cls}`}>{st.label}</span></td>
                  <td className="py-1.5 pr-2 text-[11px] text-slate-600">
                    {i.doneBy ? `${i.doneBy} • ${formatDateTime(i.doneAt)}` : i.inspectedBy ? `${i.inspectedBy} • ${formatDateTime(i.inspectedAt)}` : '-'}
                  </td>
                  <td className="py-1.5 text-right">
                    {canManage && i.status === 'PENDING' && (
                      <button type="button" onClick={() => onRemove(i.id, i.containerNo)} className={secondaryBtn} title="Bỏ khỏi danh sách">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
