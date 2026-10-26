import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, ListChecks, Search } from "lucide-react";
import { ContainerRecord } from '../../types/depot';
import { DepotState } from '../../services/depotStore';
import { bulkConfirmQuotationToRepair, confirmQuotationToRepair, saveQuotationDraft } from "../../services/depotOperations";
import { formatLocation, parseContainerList, storageDays } from "../../services/core";
import { formatDateTime, fileStamp } from '../../services/datetime';
import { yardStockSheet } from '../../services/reports';
import { linkCls,
  ContainerNo,
  DetailDrawer,
  ExportExcelButton,
  Feedback,
  inputCls,
  labelCls,
  Pager,
  primaryBtn,
  secondaryBtn,
  usePageSize,
  LocationText,
  CellText,
  CELL_MAX,
} from '../../components/shared';

// BÁO GIÁ → CHỜ BÁO GIÁ (DEC-084): danh sách giống Tồn vỏ; bấm dòng mở cửa sổ trượt nhập Remark sửa chữa + giờ công (DEC-080)
export const QuotationWorkspace: React.FC<{
  state: DepotState;
  queue: ContainerRecord[];
  onUpdateState: (next: DepotState) => void;
  onOpenDossier?: (code: string) => void;
}> = ({ state, queue, onUpdateState, onOpenDossier }) => {
  const [search, setSearch] = useState('');
  const [size, setSize] = useState('ALL');
  const [type, setType] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize('quotation', 50);
  const [selectedId, setSelectedId] = useState('');
  const [items, setItems] = useState('');
  const [hours, setHours] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // DEC-088: tìm hàng loạt + chọn nhiều + xác nhận chờ sửa chữa hàng loạt (giống Tồn vỏ)
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkList, setBulkList] = useState<string[]>([]);
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const bulkSet = useMemo(() => new Set(bulkList), [bulkList]);
  const filtered = useMemo(
    () =>
      queue
        .filter((c) => bulkList.length === 0 || bulkSet.has(c.containerNo))
        .filter((c) => !search.trim() || c.containerNo.includes(search.trim().toUpperCase()))
        .filter((c) => size === 'ALL' || c.size === size)
        .filter((c) => type === 'ALL' || c.type === type),
    [queue, bulkList, bulkSet, search, size, type]
  );
  const notFound = bulkList.filter((no) => !queue.some((c) => c.containerNo === no));
  const pickedIds = filtered.filter((c) => picked.has(c.id)).map((c) => c.id);
  const allPicked = filtered.length > 0 && pickedIds.length === filtered.length;
  const togglePick = (id: string) => {
    const next = new Set(picked);
    if (next.has(id)) next.delete(id); else next.add(id);
    setPicked(next);
  };
  const runBulkConfirm = () => {
    setError(null);
    setSuccess(null);
    try {
      const res = bulkConfirmQuotationToRepair(state, { containerIds: pickedIds });
      onUpdateState(res.state);
      setSuccess(
        `Đã xác nhận ${res.done.length} container → CHỜ SỬA CHỮA.` +
          (res.skipped.length ? ` Bỏ qua ${res.skipped.length}: ${res.skipped.map((s) => `${s.containerNo} (${s.reason})`).join(', ')}.` : '')
      );
      setPicked(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi xác nhận hàng loạt');
    }
  };
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const rows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const now = new Date();
  const selected = queue.find((c) => c.id === selectedId);

  const open = (c: ContainerRecord) => {
    setSelectedId(c.id);
    setItems((c.quotationItems || []).join(", "));
    setHours(c.quotationLaborHours ? String(c.quotationLaborHours) : "");
    setError(null);
  };

  // DEC-086: (1) lưu tình trạng sửa chữa + giờ công; (2) xác nhận chờ sửa chữa → chuyển bộ phận Sửa chữa
  const save = () => {
    if (!selected) return;
    setError(null);
    setSuccess(null);
    try {
      onUpdateState(saveQuotationDraft(state, { containerNo: selected.containerNo, quotationItems: items.split(","), laborHours: Number(hours) }));
      setSuccess(`Đã lưu báo giá ${selected.containerNo} — bấm "Xác nhận chờ sửa chữa" để chuyển bộ phận Sửa chữa.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi cập nhật báo giá");
    }
  };
  const confirmRepair = (c: ContainerRecord) => {
    setError(null);
    setSuccess(null);
    try {
      onUpdateState(confirmQuotationToRepair(state, { containerNo: c.containerNo }));
      setSuccess(`Đã xác nhận ${c.containerNo} → CHỜ SỬA CHỮA (chuyển bộ phận Sửa chữa).`);
      setSelectedId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi xác nhận chờ sửa chữa");
    }
  };
  const hasDraft = (c: ContainerRecord) => Boolean(c.quotationItems?.length && Number(c.quotationLaborHours) > 0);

  return (
    <div className="w-full space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs">
        <div>
          <span className="block text-[11px] font-semibold uppercase text-slate-500">Bộ phận Báo giá</span>
          <h2 className="text-sm font-bold text-slate-900">Chờ báo giá ({filtered.length} / {queue.length})</h2>
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
          <button type="button" onClick={() => setBulkOpen(!bulkOpen)} className={`${secondaryBtn} ${bulkList.length ? 'border-blue-600 text-blue-700' : ''}`}>
            <ListChecks className="h-3.5 w-3.5" />
            Tìm hàng loạt{bulkList.length ? ` (${bulkList.length})` : ''}
          </button>
          <ExportExcelButton fileName={`MATRAN_CHO_BAO_GIA_${fileStamp(formatDateTime(new Date()))}.xlsx`} disabled={filtered.length === 0} getSheets={() => [{ ...yardStockSheet(filtered, state), name: "CHỜ BÁO GIÁ" }]} />
        </div>
        {bulkOpen && (
          <div className="flex w-full flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-end">
            <label className="flex-1">
              <span className={labelCls}>Danh sách số container (mỗi dòng 1 số, hoặc cách nhau bởi dấu phẩy / khoảng trắng)</span>
              <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} rows={3} placeholder={'MSKU4089123\nTGHU2211457'} className={`${inputCls} font-mono uppercase`} />
            </label>
            <div className="flex gap-2">
              <button type="button" onClick={() => { setBulkList(parseContainerList(bulkText)); setPicked(new Set()); setPage(1); }} disabled={!bulkText.trim()} className={primaryBtn}>Tìm</button>
              {bulkList.length > 0 && (
                <button type="button" onClick={() => { setBulkList([]); setBulkText(''); setPicked(new Set()); }} className={secondaryBtn}>Bỏ lọc</button>
              )}
            </div>
          </div>
        )}
        {bulkList.length > 0 && notFound.length > 0 && (
          <p className="w-full rounded-md bg-rose-50 px-3 py-2 text-[11px] text-rose-800">
            Không có trong Chờ báo giá ({notFound.length}): <span className="font-mono">{notFound.join(', ')}</span>
          </p>
        )}
      </div>

      {!selected && <Feedback error={error} success={success} onClose={() => (setError(null), setSuccess(null))} />}

      {pickedIds.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-xs sm:flex-row sm:items-center">
          <p className="font-bold text-blue-900">
            Đã chọn {pickedIds.length} container — {filtered.filter((c) => picked.has(c.id) && hasDraft(c)).length} đã cập nhật báo giá
          </p>
          <span className="flex-1 text-[11px] text-slate-600">Cont chưa cập nhật tình trạng sửa chữa / giờ công sẽ được bỏ qua và báo lại.</span>
          <button type="button" onClick={runBulkConfirm} className={primaryBtn}>Xác nhận chờ sửa chữa hàng loạt ({pickedIds.length})</button>
          <button type="button" onClick={() => setPicked(new Set())} className={secondaryBtn}>Bỏ chọn</button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[1320px] whitespace-nowrap text-left text-xs">{/* DEC-142: mỗi cont 1 dòng như Tồn vỏ */}
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-600">
            <tr>
              <th className="w-8 px-2 py-2.5">
                <input type="checkbox" aria-label="Chọn tất cả theo bộ lọc" checked={allPicked} onChange={() => setPicked(allPicked ? new Set() : new Set(filtered.map((c) => c.id)))} />
              </th>
              <th className="w-32 whitespace-nowrap px-2 py-2.5">Mã hồ sơ</th>
              <th className="w-36 whitespace-nowrap px-2 py-2.5">Số container</th>
              <th className="w-12 px-2 py-2.5 text-center">Size</th>
              <th className="w-12 px-2 py-2.5 text-center">Type</th>
              <th className="w-20 whitespace-nowrap px-2 py-2.5">Hãng tàu</th>
              <th className="w-40 whitespace-nowrap px-2 py-2.5">Date in</th>
              <th className="w-20 whitespace-nowrap px-2 py-2.5 text-center">Trạng thái</th>
              <th className="w-16 whitespace-nowrap px-2 py-2.5 text-right">Lưu bãi</th>
              <th className="w-44 whitespace-nowrap px-2 py-2.5">Vị trí</th>
              <th className="min-w-[12rem] px-2 py-2.5">Tình trạng sửa chữa</th>
              <th className="w-16 whitespace-nowrap px-2 py-2.5 text-right">Giờ công</th>
              <th className="min-w-[10rem] px-2 py-2.5">Ghi chú</th>
              <th className="w-56 whitespace-nowrap px-2 py-2.5 text-right">Tác nghiệp</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr><td colSpan={14} className="px-4 py-8 text-center text-slate-500">Không có container DAMAGE nào đang chờ báo giá.</td></tr>
            ) : (
              rows.map((c) => (
                <tr key={c.id} onClick={() => open(c)} className={`cursor-pointer whitespace-nowrap ${selectedId === c.id || picked.has(c.id) ? 'bg-blue-50' : 'hover:bg-slate-50'}`} data-testid="quote-row">
                  <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" aria-label={`Chọn ${c.containerNo}`} checked={picked.has(c.id)} onChange={() => togglePick(c.id)} />
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5 font-mono text-blue-700">
                    <button type="button" onClick={(e) => { e.stopPropagation(); onOpenDossier?.(c.masterDossierCode); }} className={linkCls}>{c.masterDossierCode}</button>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5"><ContainerNo no={c.containerNo} locked={c.isOnHold} lockReason={c.officeNote || c.holdReason} className="text-sm" /></td>
                  <td className="px-2 py-2.5 text-center">{c.size}</td>
                  <td className="px-2 py-2.5 text-center">{c.type}</td>
                  <td className="whitespace-nowrap px-2 py-2.5">{c.shippingLineCode}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 font-mono">
                    {formatDateTime(c.gateInAt).slice(0, 10)} <span className="text-slate-500">{formatDateTime(c.gateInAt).slice(11)}</span>
                  </td>
                  <td className="px-2 py-2.5 text-center font-bold text-rose-700">{c.conditionClass}</td>
                  <td className="px-2 py-2.5 text-right font-mono font-bold">{storageDays(c.gateInAt, now)}</td>
                  <td className="px-2 py-2.5 font-mono"><LocationText loc={c} /></td>
                  <td className="px-2 py-2.5">{c.quotationItems?.length ? <CellText text={c.quotationItems.join(", ")} max={CELL_MAX.LONG} className="font-semibold text-slate-900" /> : <span className="italic text-slate-400">Chưa cập nhật</span>}</td>
                  <td className="px-2 py-2.5 text-right font-mono font-bold">{c.quotationLaborHours ?? "-"}</td>
                  <td className={`px-2 py-2.5 ${c.officeNote ? 'bg-yellow-200 font-semibold' : 'text-slate-400'}`}><CellText text={c.officeNote} max={CELL_MAX.LONG} /></td>
                  <td className="px-2 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                    <span className="inline-flex gap-1">
                      <button type="button" onClick={() => open(c)} className={secondaryBtn}>Cập nhật</button>
                      <button type="button" disabled={!hasDraft(c)} title={hasDraft(c) ? "" : "Cập nhật tình trạng sửa chữa + giờ công trước"} onClick={() => confirmRepair(c)} className={primaryBtn}>Xác nhận chờ sửa chữa</button>
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {filtered.length > 0 && <Pager page={safePage} pageCount={pageCount} total={filtered.length} onPage={setPage} pageSize={pageSize} onPageSize={setPageSize} />}
      </div>

      <DetailDrawer
        open={Boolean(selected)}
        onClose={() => setSelectedId('')}
        title={selected ? <span className="flex items-center gap-2">Báo giá <ContainerNo no={selected.containerNo} className="text-base" /></span> : ''}
      >
        {selected && (
          <div className="space-y-3">
            <Feedback error={error} onClose={() => setError(null)} />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-md border border-slate-200 p-3 sm:grid-cols-4">
              <dt className="text-slate-500">Mã hồ sơ</dt><dd><button type="button" onClick={() => onOpenDossier?.(selected.masterDossierCode)} className={linkCls}>{selected.masterDossierCode}</button></dd>
              <dt className="text-slate-500">Size / Type</dt><dd className="font-semibold">{selected.size} / {selected.type}</dd>
              <dt className="text-slate-500">Hãng tàu</dt><dd className="font-semibold">{selected.shippingLineCode || '-'}</dd>
              <dt className="text-slate-500">AGE</dt><dd className="font-semibold">{selected.manufactureYear}</dd>
              <dt className="text-slate-500">Vị trí</dt><dd className="font-mono"><LocationText loc={selected} /></dd>
              <dt className="text-slate-500">Lưu bãi</dt><dd className="font-mono">{storageDays(selected.gateInAt, now)} ngày</dd>
              <dt className="text-slate-500">Hư hỏng giám định</dt><dd className="font-semibold text-rose-800 sm:col-span-3">{selected.damageRemarks.join(', ') || '-'}</dd>
            </dl>
            <label className="block">
              <span className={labelCls}>Tình trạng sửa chữa thực tế * (phân cách bằng dấu phẩy)</span>
              <input value={items} onChange={(e) => setItems(e.target.value)} placeholder="Thay tôn vách trái 1m2, Hàn sàn..." className={inputCls} />
            </label>
            <label className="block w-48">
              <span className={labelCls}>Giờ công sửa chữa *</span>
              <input type="number" min={0} step={0.5} inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="VD: 2.5" className={`${inputCls} font-mono`} />
            </label>
            <Feedback success={success} onClose={() => setSuccess(null)} />
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!items.trim() || !(Number(hours) > 0)} onClick={save} className={secondaryBtn}>
                <FileSpreadsheet className="h-4 w-4" />
                Lưu cập nhật báo giá
              </button>
              <button type="button" disabled={!hasDraft(selected)} onClick={() => confirmRepair(selected)} className={primaryBtn} title={hasDraft(selected) ? '' : 'Lưu cập nhật báo giá trước'}>
                Xác nhận chờ sửa chữa → chuyển Sửa chữa
              </button>
            </div>
            {selected.quotationUpdatedBy && (
              <p className="text-[11px] text-slate-500">Cập nhật gần nhất: {selected.quotationUpdatedBy} • {formatDateTime(selected.quotationUpdatedAt)}</p>
            )}
          </div>
        )}
      </DetailDrawer>
    </div>
  );
};
