import React, { useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, ClipboardList, ListPlus, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { FieldConditionClass, VesselList, VesselMode, VESSEL_MODE_LABELS } from '../../types/depot';
import { DepotState } from '../../services/depotStore';
import {
  addVesselListItems,
  approveVesselList,
  createVesselList,
  deleteVesselList,
  parseTruckList,
  parseVesselImportText,
  removeVesselListItem,
  sortVesselItems,
  updateVesselList,
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

type View = { kind: 'LIST' } | { kind: 'CREATE' } | { kind: 'DETAIL'; listId: string };

// VĂN PHÒNG — NHẬP TÀU / XUẤT TÀU (DEC-069, DEC-070): danh sách đang thực hiện → chi tiết; thêm / sửa / xóa khi chưa duyệt
export const OfficeVesselWorkspace: React.FC<Props> = ({ mode, state, onUpdateState, onOpenDossier }) => {
  const modeLabel = VESSEL_MODE_LABELS[mode];
  const canManage = can(state.currentUser, 'VESSEL_LIST_MANAGE');
  const [view, setView] = useState<View>({ kind: 'LIST' });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const lists = (state.vesselLists || []).filter((l) => l.mode === mode);
  const openLists = lists.filter((l) => l.status === 'OPEN').sort((a, b) => a.plannedAt.localeCompare(b.plannedAt));
  const approved = lists.filter((l) => l.status === 'APPROVED').slice(0, 5);
  const detail = view.kind === 'DETAIL' ? lists.find((l) => l.id === view.listId) : undefined;

  // Chạy một thao tác service; trả true nếu thành công
  const run = (fn: () => DepotState, message: string): boolean => {
    setError(null);
    setSuccess(null);
    try {
      onUpdateState(fn());
      setSuccess(message);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thao tác thất bại');
      return false;
    }
  };

  const feedback = <Feedback error={error} success={success} onClose={() => (setError(null), setSuccess(null))} />;

  if (view.kind === 'CREATE' && canManage) {
    return (
      <div className="space-y-4">
        {feedback}
        <CreateListForm
          mode={mode}
          state={state}
          onCancel={() => setView({ kind: 'LIST' })}
          onCreate={(input) => {
            setError(null);
            setSuccess(null);
            try {
              const res = createVesselList(state, { mode, ...input });
              onUpdateState(res.state);
              const l = res.state.vesselLists.find((x) => x.id === res.listId)!;
              setSuccess(`Đã lập danh sách ${modeLabel} tàu ${l.vesselName}: ${l.items.length} container, ${l.truckNos.length} xe.`);
              setView({ kind: 'DETAIL', listId: res.listId });
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Lỗi lập danh sách');
            }
          }}
        />
      </div>
    );
  }

  if (view.kind === 'DETAIL' && detail) {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => setView({ kind: 'LIST' })} className={secondaryBtn}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Danh sách {modeLabel}
        </button>
        {feedback}
        <ListDetail
          list={detail}
          mode={mode}
          state={state}
          canManage={canManage && detail.status === 'OPEN'}
          onOpenDossier={onOpenDossier}
          run={run}
          onDeleted={() => setView({ kind: 'LIST' })}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {feedback}
      <SectionCard
        title={
          <span className="flex items-center gap-2">
            Danh sách {modeLabel} đang thực hiện
            <span className="rounded bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-white">{openLists.length}</span>
          </span>
        }
        icon={<ClipboardList className="h-4 w-4 text-slate-500" />}
        right={
          canManage && (
            <button type="button" onClick={() => { setError(null); setSuccess(null); setView({ kind: 'CREATE' }); }} className={primaryBtn}>
              <ListPlus className="h-4 w-4" />
              Lập danh sách {modeLabel}
            </button>
          )
        }
      >
        {openLists.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-500">Chưa có danh sách {modeLabel.toLowerCase()} nào đang thực hiện.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="border-b border-slate-200 text-[11px] uppercase text-slate-500">
                <tr>
                  <th className="py-2 pr-2">Tên tàu</th>
                  <th className="py-2 pr-2">Thời gian {modeLabel.toLowerCase()}</th>
                  {mode === 'NHAP_TAU' && <th className="py-2 pr-2">Hãng tàu</th>}
                  <th className="py-2 pr-2 text-right">Số cont</th>
                  <th className="w-56 py-2 pr-2">Tiến độ</th>
                  <th className="py-2 pr-2">Số xe</th>
                  <th className="py-2">Lập bởi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {openLists.map((l) => (
                  <tr key={l.id} onClick={() => { setError(null); setSuccess(null); setView({ kind: 'DETAIL', listId: l.id }); }} className="cursor-pointer hover:bg-slate-50">
                    <td className="py-2.5 pr-2 font-black text-blue-700">{l.vesselName}</td>
                    <td className="py-2.5 pr-2 font-mono">{formatDateTime(l.plannedAt)}</td>
                    {mode === 'NHAP_TAU' && <td className="py-2.5 pr-2">{l.shippingLineCode}</td>}
                    <td className="py-2.5 pr-2 text-right font-mono font-bold">{l.items.length}</td>
                    <td className="py-2.5 pr-2"><VesselProgressBar list={l} /></td>
                    <td className="py-2.5 pr-2">{l.truckNos.length} xe</td>
                    <td className="py-2.5 text-[11px] text-slate-600">{l.createdBy} • {formatDateTime(l.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {approved.length > 0 && (
        <SectionCard title={`Đã duyệt gần đây (xem đầy đủ ở Báo cáo → ${mode === 'NHAP_TAU' ? 'Nhập tàu' : 'Xuất tàu'})`} icon={<CheckCircle2 className="h-4 w-4 text-emerald-600" />}>
          <ul className="divide-y divide-slate-100 text-xs">
            {approved.map((l) => (
              <li key={l.id}>
                <button type="button" onClick={() => setView({ kind: 'DETAIL', listId: l.id })} className="flex w-full flex-wrap items-center justify-between gap-2 py-2 text-left hover:bg-slate-50">
                  <VesselListTitle list={l} />
                  <span className="text-[11px] text-slate-600">{l.items.length} cont • duyệt bởi {l.approvedBy} • {formatDateTime(l.approvedAt)}</span>
                </button>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Thông tin chung danh sách (dùng cho Lập và Sửa)
// ---------------------------------------------------------------------------
interface HeaderValue {
  vesselName: string;
  plannedAt: string; // dd/MM/yyyy HH:mm:ss
  lineCode: string;
  trucksText: string;
}

const HeaderFields: React.FC<{ mode: VesselMode; state: DepotState; value: HeaderValue; onChange: (v: HeaderValue) => void }> = ({ mode, state, value, onChange }) => {
  const trucks = parseTruckList(value.trucksText);
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
      <label>
        <span className={labelCls}>Tên tàu *</span>
        <input value={value.vesselName} onChange={(e) => onChange({ ...value, vesselName: e.target.value.toUpperCase() })} className={`${inputCls} uppercase`} />
      </label>
      <DateTimeField label={`Thời gian ${VESSEL_MODE_LABELS[mode].toLowerCase()} *`} value={value.plannedAt} onChange={(v) => onChange({ ...value, plannedAt: v })} />
      {mode === 'NHAP_TAU' && (
        <label>
          <span className={labelCls}>Hãng tàu *</span>
          <select value={value.lineCode} onChange={(e) => onChange({ ...value, lineCode: e.target.value })} className={inputCls}>
            <option value="">-- Chọn --</option>
            {state.partners.filter((p) => p.isShippingLine).map((p) => <option key={p.id} value={p.code}>{p.code} — {p.name}</option>)}
          </select>
        </label>
      )}
      <label className={mode === 'NHAP_TAU' ? '' : 'sm:col-span-2'}>
        <span className={labelCls}>Danh sách số xe * ({trucks.length})</span>
        <textarea value={value.trucksText} onChange={(e) => onChange({ ...value, trucksText: e.target.value })} rows={2} placeholder={'15C-111.11\n15C-222.22'} className={`${inputCls} uppercase`} />
      </label>
    </div>
  );
};

const toHeaderInput = (v: HeaderValue) => {
  const at = parseDateTime(v.plannedAt, 'start');
  return { vesselName: v.vesselName, plannedAt: at ? at.toISOString() : '', truckNos: parseTruckList(v.trucksText), shippingLineCode: v.lineCode || undefined };
};

// ---------------------------------------------------------------------------
// Chọn container: NHẬP TÀU dán từ Excel; XUẤT TÀU chọn từ tồn vỏ
// ---------------------------------------------------------------------------
const ImportPaste: React.FC<{ state: DepotState; text: string; onChange: (t: string) => void }> = ({ state, text, onChange }) => {
  const parsed = parseVesselImportText(state, text);
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <label>
        <span className={labelCls}>Container — mỗi dòng: SỐ CONT  SIZE  TYPE (dán từ Excel được)</span>
        <textarea value={text} onChange={(e) => onChange(e.target.value)} rows={8} placeholder={'TCLU1234567\t40\tHC\nTCLU7654321\t20\tDC'} className={`${inputCls} font-mono uppercase`} />
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
              {sortVesselItems(parsed.rows).map((r, i) => (
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
  );
};

const ExportPicker: React.FC<{ state: DepotState; picked: Set<string>; onChange: (s: Set<string>) => void }> = ({ state, picked, onChange }) => {
  const [search, setSearch] = useState('');
  const [size, setSize] = useState('ALL');
  const [condition, setCondition] = useState<'ALL' | FieldConditionClass>('ALL');
  const yard = useMemo(
    () =>
      sortVesselItems(
        state.containers
          .filter((c) => c.status === 'IN_YARD' || c.status === 'ALLOCATED')
          .filter((c) => !search.trim() || c.containerNo.includes(search.trim().toUpperCase()))
          .filter((c) => size === 'ALL' || c.size === size)
          .filter((c) => condition === 'ALL' || c.conditionClass === condition)
      ),
    [state.containers, search, size, condition]
  );
  const selectable = yard.filter((c) => !vesselExportBlocker(c));
  const allPicked = selectable.length > 0 && selectable.every((c) => picked.has(c.id));
  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
  };
  return (
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
                <input type="checkbox" aria-label="Chọn tất cả" checked={allPicked} onChange={() => onChange(allPicked ? new Set() : new Set(selectable.map((c) => c.id)))} />
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
                  <tr key={c.id} onClick={() => !blocker && toggle(c.id)} className={blocker ? 'bg-slate-50 text-slate-400' : `cursor-pointer ${picked.has(c.id) ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                    <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" aria-label={`Chọn ${c.containerNo}`} disabled={Boolean(blocker)} checked={picked.has(c.id)} onChange={() => toggle(c.id)} />
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
  );
};

// ---------------------------------------------------------------------------
// LẬP DANH SÁCH
// ---------------------------------------------------------------------------
const CreateListForm: React.FC<{
  mode: VesselMode;
  state: DepotState;
  onCancel: () => void;
  onCreate: (input: ReturnType<typeof toHeaderInput> & { importItems?: ReturnType<typeof parseVesselImportText>['rows']; exportContainerIds?: string[] }) => void;
}> = ({ mode, state, onCancel, onCreate }) => {
  const [header, setHeader] = useState<HeaderValue>(() => ({ vesselName: '', plannedAt: formatDateTime(new Date()), lineCode: '', trucksText: '' }));
  const [importText, setImportText] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const parsed = parseVesselImportText(state, importText);
  const count = mode === 'NHAP_TAU' ? parsed.rows.length : picked.size;
  return (
    <SectionCard
      title={`Lập danh sách ${VESSEL_MODE_LABELS[mode]}`}
      icon={<ListPlus className="h-4 w-4 text-slate-500" />}
      right={<button type="button" onClick={onCancel} aria-label="Đóng" className={secondaryBtn}><X className="h-3.5 w-3.5" /></button>}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (mode === 'NHAP_TAU' && parsed.errors.length) return;
          onCreate({ ...toHeaderInput(header), importItems: mode === 'NHAP_TAU' ? parsed.rows : undefined, exportContainerIds: mode === 'XUAT_TAU' ? Array.from(picked) : undefined });
        }}
        className="space-y-3 text-xs"
      >
        <HeaderFields mode={mode} state={state} value={header} onChange={setHeader} />
        {mode === 'NHAP_TAU' ? <ImportPaste state={state} text={importText} onChange={setImportText} /> : <ExportPicker state={state} picked={picked} onChange={setPicked} />}
        <div className="flex gap-2">
          <button type="submit" disabled={mode === 'NHAP_TAU' && parsed.errors.length > 0} className={primaryBtn}>
            <ListPlus className="h-4 w-4" />
            Lập danh sách ({count} cont)
          </button>
          <button type="button" onClick={onCancel} className={secondaryBtn}>Hủy</button>
        </div>
      </form>
    </SectionCard>
  );
};

// ---------------------------------------------------------------------------
// CHI TIẾT DANH SÁCH: sửa thông tin, thêm cont, bỏ cont, xóa, duyệt
// ---------------------------------------------------------------------------
const ListDetail: React.FC<{
  list: VesselList;
  mode: VesselMode;
  state: DepotState;
  canManage: boolean;
  run: (fn: () => DepotState, message: string) => boolean;
  onDeleted: () => void;
  onOpenDossier?: (code: string) => void;
}> = ({ list, mode, state, canManage, run, onDeleted, onOpenDossier }) => {
  const isImport = mode === 'NHAP_TAU';
  const p = vesselListProgress(list);
  const complete = p.total > 0 && p.done === p.total;
  const [panel, setPanel] = useState<'' | 'EDIT' | 'ADD' | 'DELETE'>('');
  const [header, setHeader] = useState<HeaderValue>(() => ({
    vesselName: list.vesselName,
    plannedAt: formatDateTime(list.plannedAt),
    lineCode: list.shippingLineCode || '',
    trucksText: list.truckNos.join('\n'),
  }));
  const [importText, setImportText] = useState('');
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const parsed = parseVesselImportText(state, importText);
  const items = sortVesselItems(list.items);

  const openPanel = (p2: typeof panel) => {
    setPanel(panel === p2 ? '' : p2);
    setHeader({ vesselName: list.vesselName, plannedAt: formatDateTime(list.plannedAt), lineCode: list.shippingLineCode || '', trucksText: list.truckNos.join('\n') });
    setImportText('');
    setPicked(new Set());
  };

  return (
    <SectionCard
      title={<VesselListTitle list={list} />}
      right={
        canManage && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => openPanel('EDIT')} className={secondaryBtn}><Pencil className="h-3.5 w-3.5" />Sửa thông tin</button>
            <button type="button" onClick={() => openPanel('ADD')} className={secondaryBtn}><Plus className="h-3.5 w-3.5" />Thêm cont</button>
            <button type="button" onClick={() => openPanel('DELETE')} className={`${secondaryBtn} text-rose-700`}><Trash2 className="h-3.5 w-3.5" />Xóa danh sách</button>
            <button type="button" onClick={() => run(() => approveVesselList(state, { listId: list.id, mode }), `Đã duyệt ${VESSEL_MODE_LABELS[mode]} thành công tàu ${list.vesselName}.`)} disabled={!complete} className={primaryBtn} title={complete ? '' : 'Chỉ duyệt khi đã xong hết danh sách'}>
              <CheckCircle2 className="h-4 w-4" />
              Duyệt {VESSEL_MODE_LABELS[mode]} thành công
            </button>
          </div>
        )
      }
    >
      <div className="space-y-3 text-xs">
        <p className="text-[11px] text-slate-600">
          Xe: <span className="font-semibold">{list.truckNos.join(', ')}</span> • lập bởi {list.createdBy}, {formatDateTime(list.createdAt)}
          {list.status === 'APPROVED' && <> • <span className="font-bold text-emerald-700">duyệt bởi {list.approvedBy}, {formatDateTime(list.approvedAt)}</span></>}
        </p>
        <VesselProgressBar list={list} />

        {panel === 'EDIT' && (
          <div className="space-y-2 rounded-md border border-blue-200 bg-blue-50/40 p-3">
            <HeaderFields mode={mode} state={state} value={header} onChange={setHeader} />
            <div className="flex gap-2">
              <button type="button" onClick={() => run(() => updateVesselList(state, { listId: list.id, mode, ...toHeaderInput(header) }), 'Đã lưu thông tin danh sách.') && setPanel('')} className={primaryBtn}>Lưu thông tin</button>
              <button type="button" onClick={() => setPanel('')} className={secondaryBtn}>Hủy</button>
            </div>
          </div>
        )}
        {panel === 'ADD' && (
          <div className="space-y-2 rounded-md border border-blue-200 bg-blue-50/40 p-3">
            {isImport ? <ImportPaste state={state} text={importText} onChange={setImportText} /> : <ExportPicker state={state} picked={picked} onChange={setPicked} />}
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isImport ? parsed.rows.length === 0 || parsed.errors.length > 0 : picked.size === 0}
                onClick={() =>
                  run(
                    () => addVesselListItems(state, { listId: list.id, mode, importItems: isImport ? parsed.rows : undefined, exportContainerIds: isImport ? undefined : Array.from(picked) }),
                    `Đã thêm ${isImport ? parsed.rows.length : picked.size} container vào danh sách.`
                  ) && setPanel('')
                }
                className={primaryBtn}
              >
                <Plus className="h-4 w-4" />
                Thêm {isImport ? parsed.rows.length : picked.size} container
              </button>
              <button type="button" onClick={() => setPanel('')} className={secondaryBtn}>Hủy</button>
            </div>
          </div>
        )}
        {panel === 'DELETE' && (
          <div className="flex flex-wrap items-center gap-2 rounded-md border border-rose-300 bg-rose-50 p-3 text-rose-900">
            <span className="mr-auto font-semibold">Xóa cả danh sách tàu {list.vesselName} ({list.items.length} container)? Chỉ xóa được khi chưa có cont nào được tác nghiệp.</span>
            <button type="button" onClick={() => run(() => deleteVesselList(state, { listId: list.id, mode }), `Đã xóa danh sách tàu ${list.vesselName}.`) && onDeleted()} className="rounded-md bg-rose-600 px-3 py-2 font-bold text-white">Xác nhận xóa</button>
            <button type="button" onClick={() => setPanel('')} className={secondaryBtn}>Hủy</button>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead className="border-b border-slate-200 text-[11px] uppercase text-slate-500">
              <tr>
                <th className="py-1.5 pr-2">#</th>
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
              {items.map((i, idx) => {
                const st = ITEM_STATUS[mode][i.status];
                return (
                  <tr key={i.id}>
                    <td className="py-1.5 pr-2 text-slate-400">{idx + 1}</td>
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
                        <button type="button" onClick={() => run(() => removeVesselListItem(state, { listId: list.id, itemId: i.id, mode }), `Đã bỏ ${i.containerNo} khỏi danh sách.`)} className={secondaryBtn} title="Bỏ khỏi danh sách">
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
    </SectionCard>
  );
};
