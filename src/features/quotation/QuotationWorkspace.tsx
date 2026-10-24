import React, { useMemo, useState } from 'react';
import { FileSpreadsheet, Search } from 'lucide-react';
import { ContainerRecord } from '../../types/depot';
import { DepotState } from '../../services/depotStore';
import { approveDamageQuotation } from '../../services/depotOperations';
import { formatLocation, storageDays } from '../../services/core';
import { formatDateTime, fileStamp } from '../../services/datetime';
import { yardStockSheet } from '../../services/reports';
import {
  ContainerNo,
  DetailDrawer,
  ExportExcelButton,
  Feedback,
  inputCls,
  labelCls,
  Pager,
  primaryBtn,
  usePageSize,
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

  const filtered = useMemo(
    () =>
      queue
        .filter((c) => !search.trim() || c.containerNo.includes(search.trim().toUpperCase()))
        .filter((c) => size === 'ALL' || c.size === size)
        .filter((c) => type === 'ALL' || c.type === type),
    [queue, search, size, type]
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const rows = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);
  const now = new Date();
  const selected = queue.find((c) => c.id === selectedId);

  const open = (c: ContainerRecord) => {
    setSelectedId(c.id);
    setItems(c.damageRemarks.join(', '));
    setHours('');
    setError(null);
  };

  const submit = () => {
    if (!selected) return;
    setError(null);
    setSuccess(null);
    try {
      onUpdateState(approveDamageQuotation(state, { containerNo: selected.containerNo, quotationItems: items.split(','), laborHours: Number(hours) }));
      setSuccess(`Đã cập nhật ${selected.containerNo} → Chờ sửa chữa.`);
      setSelectedId('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi cập nhật báo giá');
    }
  };

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
          <ExportExcelButton fileName={`MATRAN_CHO_BAO_GIA_${fileStamp(formatDateTime(new Date()))}.xlsx`} disabled={filtered.length === 0} getSheets={() => [{ ...yardStockSheet(filtered), name: 'CHỜ BÁO GIÁ' }]} />
        </div>
      </div>

      {!selected && <Feedback error={error} success={success} onClose={() => (setError(null), setSuccess(null))} />}

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[1120px] text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-600">
            <tr>
              <th className="w-32 whitespace-nowrap px-2 py-2.5">Mã hồ sơ</th>
              <th className="w-36 whitespace-nowrap px-2 py-2.5">Số container</th>
              <th className="w-12 px-2 py-2.5 text-center">Size</th>
              <th className="w-12 px-2 py-2.5 text-center">Type</th>
              <th className="w-20 whitespace-nowrap px-2 py-2.5">Hãng tàu</th>
              <th className="w-24 whitespace-nowrap px-2 py-2.5">Date in</th>
              <th className="w-20 whitespace-nowrap px-2 py-2.5 text-center">Trạng thái</th>
              <th className="w-16 whitespace-nowrap px-2 py-2.5 text-right">Lưu bãi</th>
              <th className="w-40 px-2 py-2.5">Vị trí</th>
              <th className="min-w-[12rem] px-2 py-2.5">Hư hỏng (giám định)</th>
              <th className="min-w-[10rem] px-2 py-2.5">Ghi chú</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.length === 0 ? (
              <tr><td colSpan={11} className="px-4 py-8 text-center text-slate-500">Không có container DAMAGE nào đang chờ báo giá.</td></tr>
            ) : (
              rows.map((c) => (
                <tr key={c.id} onClick={() => open(c)} className={`cursor-pointer ${selectedId === c.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                  <td className="whitespace-nowrap px-2 py-2.5 font-mono text-blue-700">
                    <button type="button" onClick={(e) => { e.stopPropagation(); onOpenDossier?.(c.masterDossierCode); }} className="hover:underline">{c.masterDossierCode}</button>
                  </td>
                  <td className="whitespace-nowrap px-2 py-2.5"><ContainerNo no={c.containerNo} locked={c.isOnHold} lockReason={c.officeNote || c.holdReason} className="text-sm" /></td>
                  <td className="px-2 py-2.5 text-center">{c.size}</td>
                  <td className="px-2 py-2.5 text-center">{c.type}</td>
                  <td className="whitespace-nowrap px-2 py-2.5">{c.shippingLineCode}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 font-mono leading-tight">
                    <span className="block">{formatDateTime(c.gateInAt).slice(0, 10)}</span>
                    <span className="block text-[10px] text-slate-500">{formatDateTime(c.gateInAt).slice(11)}</span>
                  </td>
                  <td className="px-2 py-2.5 text-center font-bold text-rose-700">{c.conditionClass}</td>
                  <td className="px-2 py-2.5 text-right font-mono font-bold">{storageDays(c.gateInAt, now)}</td>
                  <td className="px-2 py-2.5 font-mono">{formatLocation(c)}</td>
                  <td className="px-2 py-2.5 font-semibold text-rose-800">{c.damageRemarks.join(', ') || '-'}</td>
                  <td className={`px-2 py-2.5 ${c.officeNote ? 'bg-yellow-200 font-semibold' : 'text-slate-400'}`}>{c.officeNote || '-'}</td>
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
              <dt className="text-slate-500">Mã hồ sơ</dt><dd className="font-mono font-bold">{selected.masterDossierCode}</dd>
              <dt className="text-slate-500">Size / Type</dt><dd className="font-semibold">{selected.size} / {selected.type}</dd>
              <dt className="text-slate-500">Hãng tàu</dt><dd className="font-semibold">{selected.shippingLineCode || '-'}</dd>
              <dt className="text-slate-500">AGE</dt><dd className="font-semibold">{selected.manufactureYear}</dd>
              <dt className="text-slate-500">Vị trí</dt><dd className="font-mono">{formatLocation(selected)}</dd>
              <dt className="text-slate-500">Lưu bãi</dt><dd className="font-mono">{storageDays(selected.gateInAt, now)} ngày</dd>
              <dt className="text-slate-500">Hư hỏng giám định</dt><dd className="font-semibold text-rose-800 sm:col-span-3">{selected.damageRemarks.join(', ') || '-'}</dd>
            </dl>
            <label className="block">
              <span className={labelCls}>Remark sửa chữa * (phân cách bằng dấu phẩy)</span>
              <input value={items} onChange={(e) => setItems(e.target.value)} placeholder="Móp vách, Hư sàn..." className={inputCls} />
            </label>
            <label className="block w-48">
              <span className={labelCls}>Giờ công sửa chữa *</span>
              <input type="number" min={0} step={0.5} inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="VD: 2.5" className={`${inputCls} font-mono`} />
            </label>
            <button type="button" disabled={!items.trim() || !(Number(hours) > 0)} onClick={submit} className={primaryBtn}>
              <FileSpreadsheet className="h-4 w-4" />
              Cập nhật sang Chờ sửa chữa
            </button>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
};
