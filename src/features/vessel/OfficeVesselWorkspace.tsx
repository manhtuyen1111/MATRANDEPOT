import React, { useMemo, useState } from 'react';
import { addVesselListItems, approveVesselList, createVesselList, deleteVesselList, removeVesselListItem, updateVesselList } from '../../services/api';
import { CheckCircle2, ClipboardList, FileDown, ListChecks, ListPlus, Pencil, Plus, Printer, Search, Trash2, X } from 'lucide-react';
import { PrintPreviewModal } from '../../components/ReceiptPrint';
import { VesselEeirPrintSheet } from '../../components/K80TicketModal';
import { exportPdf, printNow } from '../../components/printNow';
import { FieldConditionClass, VesselList, VesselMode, VESSEL_MODE_LABELS } from '../../types/depot';
import { DepotState } from '../../services/depotStore';
import { parseTruckList, parseVesselImportText, sortVesselItems, vesselExportBlocker, vesselListProgress } from '../../services/vessel';
import { formatLocation, parseContainerList, storageDays } from '../../services/core';
import { formatDateTime, parseDateTime } from '../../services/datetime';
import { can } from '../../services/permissions';
import { linkCls, ContainerNo, DateTimeField, DetailDrawer, Feedback, inputCls, labelCls, Pager, primaryBtn, secondaryBtn, SectionCard, usePageSize, LocationText, CellText, CELL_MAX, BlockIcon, blockLabel } from '../../components/shared';
import { VesselListStatus, VesselListTitle, VesselProgressBar, VesselProgressInline } from './VesselShared';

interface Props {
  mode: VesselMode;
  state: DepotState;
  onUpdateState: (next: DepotState) => void;
  onOpenDossier?: (code: string) => void;
}

const ITEM_STATUS: Record<VesselMode, Record<string, { label: string; cls: string }>> = {
  NHAP_TAU: {
    PENDING: { label: 'Chờ xe về', cls: 'bg-navy-50 text-ink' },
    INSPECTED: { label: 'Đã giám định — chờ hạ', cls: 'bg-amber-100 text-amber-800' },
    DONE: { label: 'Đã hạ bãi', cls: 'bg-emerald-100 text-emerald-800' },
    SKIPPED: { label: 'Không kịp', cls: 'bg-rose-100 text-rose-700' }, // DEC-131
  },
  XUAT_TAU: {
    PENDING: { label: 'Chờ xuất', cls: 'bg-navy-50 text-ink' },
    INSPECTED: { label: '-', cls: '' },
    DONE: { label: 'Đã xuất tàu', cls: 'bg-emerald-100 text-emerald-800' },
    SKIPPED: { label: 'Không kịp', cls: 'bg-rose-100 text-rose-700' }, // DEC-131
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
  // DEC-165: DANH SÁCH NHẬP / XUẤT TÀU — mọi danh sách (đang thực hiện + đã duyệt), mới nhất trước, phân trang
  const allLists = [...lists].sort((a, b) => b.plannedAt.localeCompare(a.plannedAt));
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize(`vessel-lists-${mode}`, 20);
  const pageCount = Math.max(1, Math.ceil(allLists.length / pageSize));
  const curPage = Math.min(page, pageCount);
  const pageRows = allLists.slice((curPage - 1) * pageSize, curPage * pageSize);
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

  return (
    <div className="space-y-4">
      {!detail && feedback}
      {/* DEC-080: chi tiết danh sách mở trong cửa sổ trượt bên phải, danh sách vẫn ở phía sau */}
      <DetailDrawer open={Boolean(detail)} wide title={detail ? <VesselListTitle list={detail} /> : ''} onClose={() => setView({ kind: 'LIST' })}>
        {detail && (
          <div className="space-y-3">
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
        )}
      </DetailDrawer>
      <SectionCard
        title={
          <span className="flex items-center gap-2">
            Danh sách {modeLabel} đang thực hiện
            <span className="rounded bg-navy-900 px-2 py-0.5 text-[11px] font-bold text-white">{openLists.length}</span>
          </span>
        }
        icon={<ClipboardList className="h-4 w-4 text-ink-muted" />}
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
          <p className="py-6 text-center text-xs text-ink-muted">Chưa có danh sách {modeLabel.toLowerCase()} nào đang thực hiện.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full whitespace-nowrap text-left text-xs">
              <thead className="border-b border-line text-[11px] uppercase text-ink-muted">
                <tr>
                  <th className="py-2 pr-2">Tên tàu</th>
                  <th className="py-2 pr-2">Thời gian {modeLabel.toLowerCase()}</th>
                  {mode === 'NHAP_TAU' && <th className="py-2 pr-2">Hãng tàu</th>}
                  <th className="py-2 pr-2 text-right">Số cont</th>
                  <th className="py-2 pr-2">Tiến độ</th>
                  <th className="py-2 pr-2">Số xe</th>
                  <th className="py-2 pr-2">Lập bởi</th>
                  <th className="py-2">Thời gian lập</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {openLists.map((l) => (
                  <tr key={l.id} onClick={() => { setError(null); setSuccess(null); setView({ kind: 'DETAIL', listId: l.id }); }} className="cursor-pointer hover:bg-canvas">
                    <td className="py-2.5 pr-2 font-black text-navy-700">{l.vesselName}</td>
                    <td className="py-2.5 pr-2 font-mono">{formatDateTime(l.plannedAt)}</td>
                    {mode === 'NHAP_TAU' && <td className="py-2.5 pr-2">{l.shippingLineCode}</td>}
                    <td className="py-2.5 pr-2 text-right font-mono font-bold">{l.items.length}</td>
                    <td className="py-2.5 pr-2"><VesselProgressInline list={l} /></td>
                    <td className="py-2.5 pr-2">{l.truckNos.length} xe</td>
                    <td className="py-2.5 pr-2"><CellText text={l.createdBy} max={CELL_MAX.SHORT} /></td>
                    <td className="py-2.5 font-mono">{formatDateTime(l.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {allLists.length > 0 && (
        <SectionCard
          title={
            <span className="flex items-center gap-2">
              Danh sách {modeLabel}
              <span className="rounded bg-navy-900 px-2 py-0.5 text-[11px] font-bold text-white">{allLists.length}</span>
            </span>
          }
          icon={<CheckCircle2 className="h-4 w-4 text-ink-muted" />}
        >
          <div className="overflow-x-auto">
            <table className="data-table w-full whitespace-nowrap text-left text-xs">
              <thead className="border-b border-line text-[11px] uppercase text-ink-muted">
                <tr>
                  <th className="py-2 pr-2">Tên tàu</th>
                  <th className="py-2 pr-2">Hãng tàu</th>
                  <th className="py-2 pr-2 text-right">Số lượng</th>
                  <th className="py-2 pr-2">Thời gian bắt đầu</th>
                  <th className="py-2 pr-2">Tiến độ</th>
                  <th className="py-2 pr-2">Trạng thái</th>
                  <th className="py-2 pr-2">Người tạo</th>
                  <th className="py-2">Người duyệt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pageRows.map((l) => (
                  <tr key={l.id} onClick={() => { setError(null); setSuccess(null); setView({ kind: 'DETAIL', listId: l.id }); }} className="cursor-pointer hover:bg-canvas">
                    <td className="py-2 pr-2 font-black text-navy-700"><CellText text={l.vesselName} max={CELL_MAX.SHORT} /></td>
                    <td className="py-2 pr-2">{l.shippingLineCode || '-'}</td>
                    <td className="py-2 pr-2 text-right font-mono font-bold">{l.items.length}</td>
                    <td className="py-2 pr-2 font-mono">{formatDateTime(l.plannedAt)}</td>
                    <td className="py-2 pr-2"><VesselProgressInline list={l} /></td>
                    <td className="py-2 pr-2"><VesselListStatus list={l} /></td>
                    <td className="py-2 pr-2"><CellText text={l.createdBy} max={CELL_MAX.SHORT} /></td>
                    <td className="py-2"><CellText text={l.approvedBy || '-'} max={CELL_MAX.SHORT} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pager page={curPage} pageCount={pageCount} total={allLists.length} onPage={setPage} pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} />
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
      <div className="rounded-md border border-line p-2">
        <p className="mb-1 text-[11px] font-bold uppercase text-ink-muted">Xem trước: {parsed.rows.length} container</p>
        {parsed.errors.length > 0 && (
          <ul className="mb-2 space-y-0.5 rounded bg-rose-50 p-2 text-[11px] text-rose-800">
            {parsed.errors.map((er) => <li key={er}>{er}</li>)}
          </ul>
        )}
        <div className="max-h-48 overflow-y-auto">
          <table className="data-table w-full text-left">
            <tbody className="divide-y divide-line">
              {sortVesselItems(parsed.rows).map((r, i) => (
                <tr key={r.containerNo}>
                  <td className="py-1 pr-2 text-ink-muted">{i + 1}</td>
                  <td className="py-1 pr-2"><ContainerNo no={r.containerNo} /></td>
                  <td className="py-1 pr-2">{r.size}</td>
                  <td className="py-1">{r.type}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const ExportPicker: React.FC<{ state: DepotState; picked: Set<string>; onChange: (s: Set<string>) => void }> = ({ state, picked, onChange }) => {
  const [search, setSearch] = useState('');
  const [size, setSize] = useState('ALL');
  // Tìm hàng loạt — giống Tồn vỏ (DEC-073)
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkList, setBulkList] = useState<string[]>([]);
  const [condition, setCondition] = useState<'ALL' | FieldConditionClass>('ALL');
  const yard = useMemo(
    () =>
      sortVesselItems(
        state.containers
          .filter((c) => c.status === 'IN_YARD' || c.status === 'ALLOCATED')
          .filter((c) => bulkList.length === 0 || bulkList.includes(c.containerNo))
          .filter((c) => !search.trim() || c.containerNo.includes(search.trim().toUpperCase()))
          .filter((c) => size === 'ALL' || c.size === size)
          .filter((c) => condition === 'ALL' || c.conditionClass === condition)
      ),
    [state.containers, bulkList, search, size, condition]
  );
  const notFound = bulkList.filter((no) => !state.containers.some((c) => c.containerNo === no && (c.status === "IN_YARD" || c.status === "ALLOCATED")));
  const selectable = yard.filter((c) => !vesselExportBlocker(c));
  const allPicked = selectable.length > 0 && selectable.every((c) => picked.has(c.id));
  const toggle = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id); else next.add(id);
    onChange(next);
  };
  return (
    <div className="space-y-2 rounded-md border border-line p-2">
      <div className="flex flex-wrap items-end gap-2">
        <p className="mr-auto text-[11px] font-bold uppercase text-ink-muted">Chọn container từ tồn vỏ — đã chọn {picked.size}</p>
        <label>
          <span className={labelCls}>Số cont</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
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
        <button type="button" onClick={() => setBulkOpen(!bulkOpen)} className={`${secondaryBtn} ${bulkList.length ? 'border-navy-900 text-navy-700' : ''}`}>
          <ListChecks className="h-3.5 w-3.5" />
          Tìm hàng loạt{bulkList.length ? ` (${bulkList.length})` : ''}
        </button>
      </div>
      {bulkOpen && (
        <div className="flex flex-col gap-2 border-t border-line pt-2 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className={labelCls}>Danh sách số container (mỗi dòng 1 số, hoặc cách nhau bởi dấu phẩy / khoảng trắng)</span>
            <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={3} placeholder={'MSKU4089123\nTGHU2211457'} className={`${inputCls} font-mono uppercase`} />
          </label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setBulkList(parseContainerList(bulkText))} disabled={!bulkText.trim()} className={primaryBtn}>Tìm</button>
            {bulkList.length > 0 && (
              <button type="button" onClick={() => { setBulkList([]); setBulkText(''); }} className={secondaryBtn}>Bỏ lọc</button>
            )}
          </div>
        </div>
      )}
      {bulkList.length > 0 && (
        <p className="text-[11px] text-ink-muted">
          Tìm thấy <strong>{yard.length}</strong> / {bulkList.length} container — chọn được <strong>{selectable.length}</strong>
          {selectable.length > 0 && (
            <button type="button" onClick={() => onChange(new Set([...picked, ...selectable.map((c) => c.id)]))} className="ml-2 font-bold text-navy-700 underline">
              Chọn tất cả {selectable.length} cont tìm được
            </button>
          )}
        </p>
      )}
      {bulkList.length > 0 && notFound.length > 0 && (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-[11px] text-rose-800">
          Không có trong tồn vỏ ({notFound.length}): <span className="font-mono">{notFound.join(', ')}</span>
        </p>
      )}
      <div className="max-h-80 overflow-auto">
        <table className="data-table w-full min-w-[760px] text-left">
          <thead className="sticky top-0 border-b border-line bg-canvas text-[11px] uppercase text-ink-muted">
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
          <tbody className="divide-y divide-line">
            {yard.length === 0 ? (
              <tr><td colSpan={10} className="py-6 text-center text-ink-muted">Không có container tồn bãi khớp bộ lọc.</td></tr>
            ) : (
              yard.map((c) => {
                const blocker = vesselExportBlocker(c);
                return (
                  <tr key={c.id} onClick={() => !blocker && toggle(c.id)} className={blocker ? 'bg-canvas text-ink-muted' : `cursor-pointer ${picked.has(c.id) ? 'bg-navy-50' : 'hover:bg-canvas'}`}>
                    <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" aria-label={`Chọn ${c.containerNo}`} disabled={Boolean(blocker)} checked={picked.has(c.id)} onChange={() => toggle(c.id)} />
                    </td>
                    <td className="px-2 py-1.5"><ContainerNo no={c.containerNo} locked={c.isOnHold} lockReason={c.officeNote || c.holdReason} /></td>
                    <td className="px-2 py-1.5">{c.size}</td>
                    <td className="px-2 py-1.5">{c.type}</td>
                    <td className="px-2 py-1.5">{c.shippingLineCode}</td>
                    <td className={`px-2 py-1.5 font-bold ${blocker ? '' : c.conditionClass === 'DAMAGE' ? 'text-rose-700' : 'text-emerald-700'}`}>{c.conditionClass}</td>
                    <td className="px-2 py-1.5">{c.stuffingClass}</td>
                    <td className="px-2 py-1.5 font-mono"><LocationText loc={c} /></td>
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
      icon={<ListPlus className="h-4 w-4 text-ink-muted" />}
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
export const ListDetail: React.FC<{
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
  const [panel, setPanel] = useState<'' | 'EDIT' | 'ADD' | 'DELETE' | 'APPROVE'>('');
  const [approveReason, setApproveReason] = useState(''); // DEC-131
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
  // DEC-167 / DEC-168: EEIR XUẤT TÀU in được ngay khi lập danh sách — từng cont (bỏ cont Không kịp; bỏ in cả danh sách)
  const printable = isImport ? [] : items.filter((i) => i.dossierCode && i.status !== 'SKIPPED');
  const [printIds, setPrintIds] = useState<string[] | null>(null);
  const printItems = printIds ? printable.filter((i) => printIds.includes(i.id)) : [];
  const closePrint = React.useCallback(() => setPrintIds(null), []);
  const sheets = printItems.map((i) => <VesselEeirPrintSheet key={i.id} state={state} list={list} item={i} />);

  const openPanel = (p2: typeof panel) => {
    setPanel(panel === p2 ? '' : p2);
    setHeader({ vesselName: list.vesselName, plannedAt: formatDateTime(list.plannedAt), lineCode: list.shippingLineCode || '', trucksText: list.truckNos.join('\n') });
    setImportText('');
    setPicked(new Set());
  };

  return (
    <SectionCard
      title="Chi tiết danh sách"
      right={
        canManage && (
          <div className="flex flex-wrap gap-2">
            {canManage && <>
            <button type="button" onClick={() => openPanel('EDIT')} className={secondaryBtn}><Pencil className="h-3.5 w-3.5" />Sửa thông tin</button>
            <button type="button" onClick={() => openPanel('ADD')} className={secondaryBtn}><Plus className="h-3.5 w-3.5" />Thêm cont</button>
            <button type="button" onClick={() => openPanel('DELETE')} className={`${secondaryBtn} text-rose-700`}><Trash2 className="h-3.5 w-3.5" />Xóa danh sách</button>
            {/* DEC-131: duyệt được cả khi chưa đủ — bắt buộc lý do, cont không kịp bị gạch */}
            <button type="button" onClick={() => (complete ? run(() => approveVesselList(state, { listId: list.id, mode }), `Đã duyệt ${VESSEL_MODE_LABELS[mode]} thành công tàu ${list.vesselName}.`) : openPanel('APPROVE'))} disabled={list.status === 'APPROVED' || p.total === 0} className={primaryBtn}>
              <CheckCircle2 className="h-4 w-4" />
              Duyệt {VESSEL_MODE_LABELS[mode]} thành công
            </button>
            </>}
          </div>
        )
      }
    >
      <div className="space-y-3 text-xs">
        <p className="text-[11px] text-ink-muted">
          Xe: <span className="font-semibold">{list.truckNos.join(', ')}</span> • lập bởi {list.createdBy}, {formatDateTime(list.createdAt)}
          {list.status === 'APPROVED' && <> • <span className="font-bold text-emerald-700">duyệt bởi {list.approvedBy}, {formatDateTime(list.approvedAt)}</span></>}
          {list.approveNote && <> • <span className="font-bold text-amber-800">Duyệt chưa đủ — lý do: {list.approveNote}</span></>}
        </p>
        <VesselProgressBar list={list} />

        {panel === 'EDIT' && (
          <div className="space-y-2 rounded-md border border-line-strong bg-navy-50/40 p-3">
            <HeaderFields mode={mode} state={state} value={header} onChange={setHeader} />
            <div className="flex gap-2">
              <button type="button" onClick={() => run(() => updateVesselList(state, { listId: list.id, mode, ...toHeaderInput(header) }), 'Đã lưu thông tin danh sách.') && setPanel('')} className={primaryBtn}>Lưu thông tin</button>
              <button type="button" onClick={() => setPanel('')} className={secondaryBtn}>Hủy</button>
            </div>
          </div>
        )}
        {panel === 'ADD' && (
          <div className="space-y-2 rounded-md border border-line-strong bg-navy-50/40 p-3">
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
        {panel === 'APPROVE' && (
          <div className="space-y-2 rounded-md border border-amber-400 bg-amber-50 p-3 text-amber-900" data-testid="approve-incomplete">
            <p className="font-semibold">
              Chưa {VESSEL_MODE_LABELS[mode].toLowerCase()} đủ ({p.done}/{p.total}). Duyệt bây giờ: {p.pending} cont chưa tác nghiệp sẽ bị <span className="line-through">gạch đi</span> (Không kịp)
              {isImport ? '; cont đã giám định vẫn tiếp tục hạ bãi.' : ' và tự mở khóa, xóa ghi chú — trở lại tồn bãi.'}
            </p>
            <label className="block">
              <span className={labelCls}>Lý do duyệt khi chưa đủ *</span>
              <input value={approveReason} onChange={(e) => setApproveReason(e.target.value)} placeholder="VD: Tàu chạy sớm" className={inputCls} />
            </label>
            <div className="flex gap-2">
              <button type="button" disabled={!approveReason.trim()} onClick={() => run(() => approveVesselList(state, { listId: list.id, mode, reason: approveReason }), `Đã duyệt ${VESSEL_MODE_LABELS[mode]} tàu ${list.vesselName} (chưa đủ).`) && setPanel('')} className={primaryBtn}>Xác nhận duyệt</button>
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
          {/* DEC-146: mỗi cột 1 thông tin, mỗi cont 1 dòng (DEC-134) — không gộp Size/Type, Trạng thái • Phân loại, Người / giờ */}
          <table className="data-table w-full whitespace-nowrap text-left" data-testid="vessel-detail-table">
            <thead className="border-b border-line bg-canvas text-[11px] uppercase text-ink-muted">
              <tr>
                <th className="px-2 py-1.5">#</th>
                <th className="px-2 py-1.5">Mã hồ sơ</th>
                <th className="px-2 py-1.5">Số container</th>
                <th className="px-2 py-1.5">Size</th>
                <th className="px-2 py-1.5">Type</th>
                <th className="px-2 py-1.5">Hãng tàu</th>
                <th className="px-2 py-1.5">Trạng thái</th>
                <th className="px-2 py-1.5">Phân loại</th>
                {isImport ? <th className="px-2 py-1.5">Vệ sinh</th> : <th className="px-2 py-1.5">Vị trí lúc lập</th>}
                <th className="px-2 py-1.5">Số xe</th>
                <th className="px-2 py-1.5">Tiến độ</th>
                <th className="px-2 py-1.5">Người thực hiện</th>
                <th className="px-2 py-1.5">Thời gian</th>
                <th className="px-2 py-1.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {items.map((i, idx) => {
                const st = ITEM_STATUS[mode][i.status];
                const line = list.shippingLineCode || (i.containerId ? state.containers.find((c) => c.id === i.containerId)?.shippingLineCode : undefined);
                const by = i.doneBy || i.inspectedBy;
                const at = i.doneBy ? i.doneAt : i.inspectedAt;
                return (
                  <tr key={i.id} className={i.status === 'SKIPPED' ? 'text-ink-muted line-through' : ''}>
                    <td className="px-2 py-1.5 text-ink-muted">{idx + 1}</td>
                    <td className="px-2 py-1.5 font-mono">
                      {i.dossierCode && i.status !== 'PENDING' ? (
                        <button type="button" onClick={() => onOpenDossier?.(i.dossierCode!)} className={linkCls}>{i.dossierCode}</button>
                      ) : (
                        <span className="text-ink-muted">{i.dossierCode || '-'}</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5"><ContainerNo no={i.containerNo} /></td>
                    <td className="px-2 py-1.5">{i.size}</td>
                    <td className="px-2 py-1.5">{i.type}</td>
                    <td className="px-2 py-1.5">{line || '-'}</td>
                    <td className="px-2 py-1.5">{i.conditionClass || '-'}</td>
                    <td className="px-2 py-1.5">{i.stuffingClass || '-'}</td>
                    {isImport ? (
                      <td className="px-2 py-1.5"><CellText text={i.cleaningItems?.join(', ')} max={CELL_MAX.SHORT} /></td>
                    ) : (
                      <td className="px-2 py-1.5 font-mono">
                        {i.locationAtList ? <span className="inline-flex items-center gap-0.5" title={i.locationAtList}><BlockIcon />{blockLabel(i.locationAtList)}</span> : '-'}
                      </td>
                    )}
                    <td className="px-2 py-1.5">{i.truckNo || '-'}</td>
                    <td className="px-2 py-1.5"><span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${st.cls}`}>{st.label}</span></td>
                    <td className="px-2 py-1.5"><CellText text={by} max={CELL_MAX.SHORT} /></td>
                    <td className="px-2 py-1.5 font-mono">{at ? formatDateTime(at) : '-'}</td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">
                      {printable.includes(i) && (
                        <button type="button" onClick={() => setPrintIds([i.id])} className={`${secondaryBtn} mr-1`} title="PHIẾU EEIR XUẤT TÀU">
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                      )}
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
      {printItems.length > 0 && (
        <PrintPreviewModal
          title={`PHIẾU EEIR XUẤT TÀU — ${list.vesselName}${printItems.length > 1 ? ` (${printItems.length} phiếu)` : ` — ${printItems[0].dossierCode}`}`}
          onClose={closePrint}
          actions={
            <>
              <button type="button" onClick={() => setTimeout(printNow, 50)} className={secondaryBtn}>
                <Printer className="h-3.5 w-3.5" />IN
              </button>
              <button type="button" onClick={() => exportPdf(`EEIR-XUAT-TAU-${list.vesselName}${printItems.length === 1 ? `-${printItems[0].dossierCode}` : ''}`).catch((e) => window.alert(e instanceof Error ? e.message : 'Không xuất được PDF'))} className={primaryBtn}>
                <FileDown className="h-4 w-4" />XUẤT PDF
              </button>
            </>
          }
          print={sheets}
        >
          {sheets}
        </PrintPreviewModal>
      )}
    </SectionCard>
  );
};
