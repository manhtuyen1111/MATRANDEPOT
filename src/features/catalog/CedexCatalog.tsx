import React, { useMemo, useRef, useState } from 'react';
import { FileUp, Plus, Search } from 'lucide-react';
import { upsertCedexCodes, upsertRepairCodes } from '../../services/api';
import type { DepotState } from '../../services/depotStore';
import {
  activeText,
  CEDEX_COLUMNS,
  cedexCodesOf,
  cedexSheetRows,
  ImportPreview,
  readCedexExcel,
  readRepairExcel,
  REPAIR_COLUMNS,
  repairCodesOf,
  repairSheetRows,
  type CedexCodeInput,
  type RepairCodeInput,
} from '../../services/cedexCatalog';
import { CEDEX_CODE_KIND_LABELS, type CedexCode, type CedexCodeKind, type RepairCode } from '../../types/depot';
import { CellText, CELL_MAX, DetailDrawer, ExportExcelButton, inputCls, labelCls, Pager, primaryBtn, secondaryBtn, usePageSize } from '../../components/shared';

// DEC-206: Danh mục chung → Sửa chữa → CODE CEDEX theo hãng tàu. Chỉ Admin thêm / sửa / nhập Excel; khối Văn phòng xem.
type Kind = CedexCodeKind | 'REPAIR';
type Run = (fn: () => DepotState, message: string) => boolean;
const KINDS: [Kind, string][] = [['LOCATION', CEDEX_CODE_KIND_LABELS.LOCATION], ['DAMAGE', CEDEX_CODE_KIND_LABELS.DAMAGE], ['MATERIAL', CEDEX_CODE_KIND_LABELS.MATERIAL], ['REPAIR', 'MÃ SỬA CHỮA']];
const num2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const num1 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 2 });

type Editing = { kind: Kind; item?: CedexCode | RepairCode } | null;

export const CedexCatalog: React.FC<{ state: DepotState; isAdmin: boolean; run: Run }> = ({ state, isAdmin, run }) => {
  const lines = state.partners.filter((p) => p.isShippingLine);
  const [line, setLine] = useState(() => lines.find((p) => p.isPriority)?.code || lines[0]?.code || '');
  const [kind, setKind] = useState<Kind>('REPAIR');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize('dm-cedex', 50);
  const [editing, setEditing] = useState<Editing>(null);
  const [preview, setPreview] = useState<{ kind: Kind; data: ImportPreview<CedexCodeInput | RepairCodeInput>; file: string } | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const isRepair = kind === 'REPAIR';
  const all = useMemo<(CedexCode | RepairCode)[]>(
    () => (isRepair ? repairCodesOf(state, line) : cedexCodesOf(state, line, kind as CedexCodeKind)),
    [state, line, kind, isRepair]
  );
  const term = q.trim().toLowerCase();
  const filtered = term
    ? all.filter((c) =>
        ('itemName' in c ? [c.itemName, c.repairCode, c.repairName, c.repairMode] : [c.code, c.name, c.note || '']).some((v) => v.toLowerCase().includes(term))
      )
    : all;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const shown = filtered.slice((Math.min(page, pageCount) - 1) * pageSize, Math.min(page, pageCount) * pageSize);
  const kindLabel = KINDS.find(([k]) => k === kind)![1];

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    setFileError(null);
    try {
      const buf = await f.arrayBuffer();
      const data = isRepair ? await readRepairExcel(buf) : await readCedexExcel(buf);
      setPreview({ kind, data, file: f.name });
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Không đọc được file Excel.');
    }
  };

  const saveImport = () => {
    if (!preview) return;
    const n = preview.data.rows.length;
    const ok =
      preview.kind === 'REPAIR'
        ? run(() => upsertRepairCodes(state, { shippingLineCode: line, rows: preview.data.rows as RepairCodeInput[] }), `Đã nhập ${n} MÃ SỬA CHỮA cho hãng ${line}.`)
        : run(() => upsertCedexCodes(state, { shippingLineCode: line, kind: preview.kind as CedexCodeKind, rows: preview.data.rows as CedexCodeInput[] }), `Đã nhập ${n} ${kindLabel} cho hãng ${line}.`);
    if (ok) setPreview(null);
  };

  return (
    <div className="space-y-3" data-testid="cedex-catalog">
      <div className="flex flex-wrap items-end gap-2">
        <label>
          <span className={labelCls}>Hãng tàu</span>
          <select value={line} onChange={(e) => { setLine(e.target.value); setPage(1); }} className={inputCls} data-testid="cedex-line">
            {lines.map((p) => <option key={p.code} value={p.code}>{p.code} — {p.name}</option>)}
          </select>
        </label>
        <div className="inline-flex overflow-hidden rounded-lg border border-line bg-white text-xs font-bold" role="tablist">
          {KINDS.map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={kind === k} onClick={() => { setKind(k); setPage(1); setQ(''); }} className={`px-3 py-2 ${kind === k ? 'bg-navy-900 text-white' : 'text-ink-muted hover:bg-canvas'}`}>
              {label}
            </button>
          ))}
        </div>
        <label className="min-w-[200px] flex-1">
          <span className={labelCls}>Tìm</span>
          <span className="relative block">
            <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
            <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} placeholder={isRepair ? 'Item Name / Repair Code / tên' : 'Mã / tên / ghi chú'} className={`${inputCls} pl-8`} />
          </span>
        </label>
        <ExportExcelButton
          fileName={`CEDEX_${line}_${kind}.xlsx`}
          disabled={!filtered.length}
          getSheets={() => [isRepair
            ? { name: 'MA SUA CHUA', columns: REPAIR_COLUMNS, rows: repairSheetRows(filtered as RepairCode[]) }
            : { name: kindLabel, columns: CEDEX_COLUMNS, rows: cedexSheetRows(filtered as CedexCode[]) }]}
        />
        {isAdmin && (
          <>
            <input ref={fileRef} type="file" accept=".xlsx" className="hidden" onChange={onFile} data-testid="cedex-file" />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={!line} className={secondaryBtn}>
              <FileUp className="h-4 w-4" />
              NHẬP EXCEL
            </button>
            <button type="button" onClick={() => setEditing({ kind })} disabled={!line} className={primaryBtn}>
              <Plus className="h-4 w-4" />
              THÊM MÃ
            </button>
          </>
        )}
      </div>
      {isAdmin && (
        <p className="text-[11px] text-ink-muted">
          File Excel cần dòng tiêu đề: {(isRepair ? REPAIR_COLUMNS.slice(0, 7) : CEDEX_COLUMNS).join(' | ')} (cột Trạng thái không bắt buộc). Mã đã có thì cập nhật, mã mới thì thêm.
        </p>
      )}
      {fileError && <p className="rounded-md border border-danger-fg bg-danger-bg px-3 py-2 text-xs text-danger-fg">{fileError}</p>}

      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        {shown.length === 0 ? (
          <p className="p-8 text-center text-xs text-ink-muted">{all.length ? 'Không có mã khớp tìm kiếm.' : `Hãng ${line || '-'} chưa có ${kindLabel}.${isAdmin ? ' Bấm NHẬP EXCEL hoặc THÊM MÃ.' : ''}`}</p>
        ) : (
          <table className="data-table w-full whitespace-nowrap text-left text-xs">
            <thead className="border-b border-line bg-canvas text-[11px] uppercase text-ink-muted">
              {isRepair ? (
                <tr>
                  <th className="px-3 py-2">Item Name</th>
                  <th className="px-3 py-2">Repair Mode</th>
                  <th className="px-3 py-2">Repair Name</th>
                  <th className="px-3 py-2 text-right">Max Qty per work order</th>
                  <th className="px-3 py-2 text-right">Fixed man hour per work order</th>
                  <th className="px-3 py-2">Repair Code</th>
                  <th className="px-3 py-2 text-right">Material Rate (Excluding VAT)</th>
                  <th className="px-3 py-2">Trạng thái</th>
                </tr>
              ) : (
                <tr>
                  <th className="px-3 py-2">Mã</th>
                  <th className="px-3 py-2">Tên</th>
                  <th className="px-3 py-2">Ghi chú</th>
                  <th className="px-3 py-2">Trạng thái</th>
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-line">
              {shown.map((c) => (
                <tr key={c.id} onClick={() => setEditing({ kind, item: c })} className={`cursor-pointer hover:bg-canvas ${c.isActive ? '' : 'text-ink-muted line-through'}`}>
                  {'itemName' in c ? (
                    <>
                      <td className="px-3 py-2 font-mono font-semibold">{c.itemName}</td>
                      <td className="px-3 py-2 font-mono">{c.repairMode}</td>
                      <td className="px-3 py-2"><CellText text={c.repairName} max={CELL_MAX.LONG} /></td>
                      <td className="px-3 py-2 text-right font-mono">{c.maxQty ?? '-'}</td>
                      <td className="px-3 py-2 text-right font-mono">{num1.format(c.manHour)}</td>
                      <td className="px-3 py-2 font-mono font-semibold">{c.repairCode}</td>
                      <td className="px-3 py-2 text-right font-mono">{num2.format(c.materialRate)}</td>
                    </>
                  ) : (
                    <>
                      <td className="px-3 py-2 font-mono font-semibold">{c.code}</td>
                      <td className="px-3 py-2"><CellText text={c.name} max={CELL_MAX.LONG} /></td>
                      <td className="px-3 py-2"><CellText text={c.note} max={CELL_MAX.LONG} /></td>
                    </>
                  )}
                  <td className="px-3 py-2">{activeText(c.isActive)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {filtered.length > 0 && <Pager page={Math.min(page, pageCount)} pageCount={pageCount} total={filtered.length} onPage={setPage} pageSize={pageSize} onPageSize={setPageSize} />}
      </div>

      <DetailDrawer open={Boolean(editing)} title={editing?.item ? `Sửa ${editing.kind === 'REPAIR' ? 'MÃ SỬA CHỮA' : CEDEX_CODE_KIND_LABELS[editing.kind as CedexCodeKind]}` : `Thêm ${kindLabel} — hãng ${line}`} onClose={() => setEditing(null)}>
        {editing && (
          <CodeForm
            key={editing.item?.id || 'new'}
            editing={editing}
            readOnly={!isAdmin}
            onSave={(row) => {
              const ok =
                editing.kind === 'REPAIR'
                  ? run(() => upsertRepairCodes(state, { shippingLineCode: line, rows: [row as RepairCodeInput] }), `Đã lưu MÃ SỬA CHỮA ${(row as RepairCodeInput).itemName}.`)
                  : run(() => upsertCedexCodes(state, { shippingLineCode: line, kind: editing.kind as CedexCodeKind, rows: [row as CedexCodeInput] }), `Đã lưu mã ${(row as CedexCodeInput).code}.`);
              if (ok) setEditing(null);
            }}
          />
        )}
      </DetailDrawer>

      <DetailDrawer open={Boolean(preview)} wide title={`Nhập Excel — ${preview ? KINDS.find(([k]) => k === preview.kind)![1] : ''} — hãng ${line}`} onClose={() => setPreview(null)}>
        {preview && (
          <div className="space-y-3 text-xs" data-testid="cedex-import-preview">
            <p>
              File <b>{preview.file}</b>: <b className="text-success-fg">{preview.data.rows.length} dòng hợp lệ</b>
              {preview.data.errors.length > 0 && <>, <b className="text-danger-fg">{preview.data.errors.length} dòng lỗi</b> (bỏ qua — sửa file rồi nhập lại)</>}.
            </p>
            {(preview.data.rounded?.length || 0) > 0 && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-900" data-testid="cedex-import-rounded">
                {preview.data.rounded!.length} dòng có số nhiều hơn 2 số lẻ (Excel chỉ hiển thị làm tròn) — đã làm tròn 2 số lẻ đúng như Excel hiển thị: dòng {preview.data.rounded!.slice(0, 20).join(', ')}{preview.data.rounded!.length > 20 ? '…' : ''}.
              </p>
            )}
            {preview.data.errors.length > 0 && (
              <ul className="max-h-60 space-y-1 overflow-y-auto rounded-md border border-line bg-canvas p-2">
                {preview.data.errors.slice(0, 200).map((e) => <li key={e.row}>Dòng {e.row}: {e.message}</li>)}
              </ul>
            )}
            <button type="button" onClick={saveImport} disabled={!preview.data.rows.length} className={`${primaryBtn} w-full`}>
              LƯU {preview.data.rows.length} DÒNG HỢP LỆ
            </button>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
};

// Form 1 mã (thêm / sửa / ngừng dùng). Kiểm tra lại ở service khi lưu.
const CodeForm: React.FC<{ editing: NonNullable<Editing>; readOnly: boolean; onSave: (row: CedexCodeInput | RepairCodeInput) => void }> = ({ editing, readOnly, onSave }) => {
  const repair = editing.kind === 'REPAIR';
  const it = editing.item as (CedexCode & RepairCode) | undefined;
  const [f, setF] = useState({
    code: it?.code || '', name: it?.name || '', note: it?.note || '',
    itemName: it?.itemName || '', repairMode: it?.repairMode || '', repairName: it?.repairName || '',
    maxQty: it?.maxQty != null ? String(it.maxQty) : '', manHour: it ? String(it.manHour ?? '') : '', repairCode: it?.repairCode || '',
    materialRate: it ? String(it.materialRate ?? '') : '', isActive: it?.isActive ?? true,
  });
  const set = (p: Partial<typeof f>) => setF({ ...f, ...p });
  const field = (label: string, key: keyof typeof f, opts: { mono?: boolean; number?: boolean; lock?: boolean; area?: boolean } = {}) => (
    <label className="block">
      <span className={labelCls}>{label}</span>
      {opts.area ? (
        <textarea value={String(f[key])} onChange={(e) => set({ [key]: e.target.value })} disabled={readOnly} rows={2} className={inputCls} />
      ) : (
        <input
          value={String(f[key])}
          onChange={(e) => set({ [key]: e.target.value })}
          disabled={readOnly || opts.lock}
          inputMode={opts.number ? 'decimal' : undefined}
          className={`${inputCls} ${opts.mono ? 'font-mono uppercase' : ''}`}
        />
      )}
    </label>
  );
  const row: CedexCodeInput | RepairCodeInput = repair
    ? {
        itemName: f.itemName, repairMode: f.repairMode, repairName: f.repairName, maxQty: f.maxQty.trim() ? Number(f.maxQty) : null,
        manHour: Number(f.manHour || 0), repairCode: f.repairCode, materialRate: Number(f.materialRate || 0), isActive: f.isActive,
      }
    : { code: f.code, name: f.name, note: f.note, isActive: f.isActive };
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSave(row); }} className="space-y-3 text-xs" data-testid="cedex-form">
      {repair ? (
        <>
          {field('Item Name *', 'itemName', { mono: true, lock: Boolean(it) })}
          <div className="grid grid-cols-2 gap-2">
            {field('Repair Mode * (mã hoặc -)', 'repairMode', { mono: true })}
            {field('Repair Code * (mã hoặc -)', 'repairCode', { mono: true })}
          </div>
          {field('Repair Name *', 'repairName', { area: true })}
          <div className="grid grid-cols-3 gap-2">
            {field('Max Qty / work order', 'maxQty', { mono: true, number: true })}
            {field('Fixed man hour *', 'manHour', { mono: true, number: true })}
            {field('Material Rate (chưa VAT) *', 'materialRate', { mono: true, number: true })}
          </div>
        </>
      ) : (
        <>
          {field('Mã *', 'code', { mono: true, lock: Boolean(it) })}
          {field('Tên *', 'name')}
          {field('Ghi chú', 'note', { area: true })}
        </>
      )}
      <label className="flex items-center gap-2">
        <input type="checkbox" checked={f.isActive} onChange={(e) => set({ isActive: e.target.checked })} disabled={readOnly} />
        <span>Đang dùng (bỏ chọn = ngừng dùng)</span>
      </label>
      {!readOnly && <button type="submit" className={`${primaryBtn} w-full`}>LƯU</button>}
    </form>
  );
};
