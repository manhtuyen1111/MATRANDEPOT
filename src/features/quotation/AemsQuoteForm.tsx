import React, { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { AEMS_APPROVAL_LABELS, type AemsApproval, type AemsTpi, type ContainerRecord } from '../../types/depot';
import type { DepotState } from '../../services/depotStore';
import { aemsDraftLines, aemsRepairBlocker, previewAemsQuote } from '../../services/aemsQuotation';
import {
  AEMS_DEFAULT_MODE,
  AEMS_MODE_NAMES,
  AEMS_REMARK_MAX,
  AEMS_TPI_LABELS,
  aemsCatalogOf,
  isLaborRateCode,
  isPreparationCode,
  type AemsLineInput,
  type AemsQuoteInput,
} from '../../services/carriers/maersk/aems';
import { formatDateTime } from '../../services/datetime';
import { inputCls, labelCls, primaryBtn, secondaryBtn } from '../../components/shared';

// DEC-207: BÁO GIÁ THEO AEMS (cont hãng bật aemsQuotation). Giao diện chỉ nhập + xem trước — tính / kiểm tra ở services
// (previewAemsQuote = cùng hàm với lúc lưu). Bố cục như AEMS: đầu phiếu → dòng sửa chữa → giờ công → tổng tiền → ghi chú.
type Row = { id?: string; damageCode: string; repairCode: string; locCode: string; tpi: AemsTpi; pcs: string; manHours: string; materialCost: string };
const num = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const vnd = (n: number) => `${num.format(n)} đ`;
const toRow = (l: AemsLineInput): Row => ({
  id: l.id, damageCode: l.damageCode, repairCode: l.repairCode, locCode: l.locCode, tpi: l.tpi, pcs: String(l.pcs ?? 1),
  manHours: l.manHours == null ? '' : String(l.manHours), materialCost: l.materialCost == null ? '' : String(l.materialCost),
});
const toInput = (r: Row): AemsLineInput => ({
  id: r.id, damageCode: r.damageCode, repairCode: r.repairCode, locCode: r.locCode, tpi: r.tpi, pcs: Number(r.pcs),
  manHours: r.manHours.trim() === '' ? null : Number(r.manHours), materialCost: r.materialCost.trim() === '' ? null : Number(r.materialCost),
});
const APPROVAL_SET: AemsApproval[] = ['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'SUSPEND_TTL', 'DECLARED_TTL'];

export const AemsQuoteForm: React.FC<{
  state: DepotState;
  container: ContainerRecord;
  onSave: (input: AemsQuoteInput) => void;
  onApproval: (approval: AemsApproval, workOrderNo: string) => void;
  onConfirm: () => void;
}> = ({ state, container: c, onSave, onApproval, onConfirm }) => {
  const q = c.aemsQuote;
  const cat = useMemo(() => aemsCatalogOf(state, c.shippingLineCode), [state, c.shippingLineCode]);
  const [mode, setMode] = useState(q?.mode || AEMS_DEFAULT_MODE);
  const [remark, setRemark] = useState(q?.remark || '');
  const [rows, setRows] = useState<Row[]>(() => aemsDraftLines(state, c).map(toRow));
  const [approval, setApproval] = useState<AemsApproval>(q && q.approval !== 'DRAFT' ? q.approval : 'PENDING_APPROVAL');
  const [wo, setWo] = useState(q?.workOrderNo || '');
  const locked = q?.approval === 'APPROVED';
  const blocker = aemsRepairBlocker(c);

  const modes = [...new Set(cat.repairCodes.map((r) => r.repairMode).filter((m) => m !== '-'))].sort();
  const repairOptions = cat.repairCodes.filter((r) => r.repairMode === mode && !isLaborRateCode(r) && !isPreparationCode(r));
  const input: AemsQuoteInput = { mode, remark, lines: rows.map(toInput) };
  let preview: ReturnType<typeof previewAemsQuote> | null = null;
  let problem: string | null = null;
  try {
    preview = previewAemsQuote(state, c.shippingLineCode, input);
  } catch (err) {
    problem = err instanceof Error ? err.message : 'Phiếu chưa hợp lệ';
  }
  const set = (i: number, p: Partial<Row>) => setRows(rows.map((r, k) => (k === i ? { ...r, ...p } : r)));
  const cell = 'h-8 w-full rounded border border-line-strong bg-white px-1.5 font-mono text-xs uppercase disabled:bg-canvas';

  return (
    <div className="space-y-3 text-xs" data-testid="aems-quote">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <label>
          <span className={labelCls}>Mode</span>
          <select value={mode} onChange={(e) => setMode(e.target.value)} disabled={locked} className={inputCls}>
            {(modes.length ? modes : [AEMS_DEFAULT_MODE]).map((m) => <option key={m} value={m}>{m}{AEMS_MODE_NAMES[m] ? ` ${AEMS_MODE_NAMES[m]}` : ''}</option>)}
          </select>
        </label>
        <div className="rounded-md border border-line bg-canvas px-3 py-1.5">
          <span className="block text-[10px] font-bold uppercase text-ink-muted">Cause</span>
          <span className="font-semibold">{preview?.cause || '-'}</span>
        </div>
        <div className="rounded-md border border-line bg-canvas px-3 py-1.5">
          <span className="block text-[10px] font-bold uppercase text-ink-muted">Trạng thái Maersk</span>
          <span className="font-bold" data-testid="aems-approval">{q ? AEMS_APPROVAL_LABELS[q.approval] : 'Chưa lưu'}</span>
        </div>
        <div className="rounded-md border border-line bg-canvas px-3 py-1.5">
          <span className="block text-[10px] font-bold uppercase text-ink-muted">Tiền tệ / VAT</span>
          <span className="font-semibold">VND • VAT 0</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-line">
        <table className="data-table w-full whitespace-nowrap text-left text-xs">
          <thead className="border-b border-line bg-canvas text-[11px] uppercase text-ink-muted">
            <tr>
              <th className="px-2 py-2">Damage Code</th>
              <th className="px-2 py-2">Repair Code</th>
              <th className="px-2 py-2">Repair Loc code</th>
              <th className="px-2 py-2">TPI</th>
              <th className="px-2 py-2 text-right">Pcs</th>
              <th className="px-2 py-2 text-right">Man Hrs/pc</th>
              <th className="px-2 py-2 text-right">Material cost/pc</th>
              <th className="px-2 py-2 text-right">Item Total</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r, i) => {
              const code = repairOptions.find((x) => x.repairCode === r.repairCode.toUpperCase());
              return (
                <tr key={i} data-testid="aems-line">
                  <td className="px-1 py-1 w-24">
                    <select value={r.damageCode} onChange={(e) => set(i, { damageCode: e.target.value })} disabled={locked} className={cell}>
                      <option value="">--</option>
                      {cat.damageCodes.map((d) => <option key={d.code} value={d.code}>{d.code} — {d.name}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-1 w-56">
                    <select value={r.repairCode} onChange={(e) => set(i, { repairCode: e.target.value, manHours: '', materialCost: '' })} disabled={locked} className={cell}>
                      <option value="">--</option>
                      {repairOptions.map((x) => <option key={x.id} value={x.repairCode}>{x.repairCode} — {x.repairName}</option>)}
                    </select>
                  </td>
                  <td className="px-1 py-1 w-24"><input value={r.locCode} maxLength={4} onChange={(e) => set(i, { locCode: e.target.value.toUpperCase() })} disabled={locked} placeholder="BR5N" className={cell} /></td>
                  <td className="px-1 py-1 w-20">
                    <select value={r.tpi} onChange={(e) => set(i, { tpi: e.target.value as AemsTpi })} disabled={locked} className={cell} title={AEMS_TPI_LABELS[r.tpi]}>
                      <option value="W">W</option>
                      <option value="T">T</option>
                    </select>
                  </td>
                  <td className="px-1 py-1 w-16"><input value={r.pcs} inputMode="numeric" onChange={(e) => set(i, { pcs: e.target.value })} disabled={locked} className={`${cell} text-right`} /></td>
                  <td className="px-1 py-1 w-20"><input value={r.manHours} inputMode="decimal" onChange={(e) => set(i, { manHours: e.target.value })} disabled={locked} placeholder={code ? String(code.manHour) : ''} className={`${cell} text-right`} /></td>
                  <td className="px-1 py-1 w-28"><input value={r.materialCost} inputMode="decimal" onChange={(e) => set(i, { materialCost: e.target.value })} disabled={locked} placeholder={code ? String(code.materialRate) : ''} className={`${cell} text-right`} /></td>
                  <td className="px-2 py-1 text-right font-mono">{preview?.lines[i] ? num.format(preview.lines[i].itemTotal) : '-'}</td>
                  <td className="px-1 py-1">
                    {!locked && (
                      <button type="button" onClick={() => setRows(rows.filter((_, k) => k !== i))} aria-label={`Xóa dòng ${i + 1}`} className="rounded p-1 text-ink-muted hover:bg-danger-bg hover:text-danger-fg">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!locked && (
        <button type="button" onClick={() => setRows([...rows, { damageCode: '', repairCode: '', locCode: '', tpi: 'T', pcs: '1', manHours: '', materialCost: '' }])} className={secondaryBtn}>
          <Plus className="h-4 w-4" />
          Add repair item
        </button>
      )}
      {!cat.repairCodes.length && <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-900">Danh mục CODE CEDEX hãng {c.shippingLineCode} chưa có MÃ SỬA CHỮA — Admin nhập Excel ở Danh mục chung → Sửa chữa.</p>}

      <div className="grid grid-cols-3 gap-2" data-testid="aems-hours">
        {[['Ordinary Hours', preview?.totalHours], ['Preparation Time', preview?.preparationHours], ['Total Man Hours', preview?.totalHours]].map(([label, v]) => (
          <div key={label as string} className="rounded-md border border-line px-3 py-1.5">
            <span className="block text-[10px] font-bold uppercase text-ink-muted">{label}</span>
            <span className="font-mono font-bold">{v ?? '-'}</span>
          </div>
        ))}
      </div>

      <table className="data-table w-full whitespace-nowrap text-xs" data-testid="aems-summary">
        <tbody className="divide-y divide-line rounded-md border border-line">
          {([
            ['Total Labor Cost', preview?.laborCost, preview ? `${preview.totalHours} giờ × ${num.format(preview.laborRate)}` : ''],
            ['Total Material Cost', preview?.materialCost, ''],
            ['Total Wear and Tear', preview?.wearTearTotal, ''],
            ['Total Third Party', preview?.thirdPartyTotal, ''],
            ['Total cost excluding Tax/VAT', preview?.totalExclVat, ''],
            ['Total cost including Tax/VAT', preview?.totalInclVat, ''],
          ] as [string, number | undefined, string][]).map(([label, v, note]) => (
            <tr key={label} className={label.startsWith('Total cost') ? 'font-bold' : ''}>
              <td className="px-3 py-1.5">{label}{note && <span className="ml-2 text-[11px] font-normal text-ink-muted">{note}</span>}</td>
              <td className="px-3 py-1.5 text-right font-mono">{v === undefined ? '-' : vnd(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <label className="block">
        <span className={labelCls}>Ghi chú ({remark.length}/{AEMS_REMARK_MAX})</span>
        <textarea value={remark} maxLength={AEMS_REMARK_MAX} onChange={(e) => setRemark(e.target.value)} disabled={locked} rows={2}
          placeholder="General condition of box, main damage, wear and tear share of repair…" className={inputCls} />
      </label>

      {problem && rows.length > 0 && <p className="rounded-md bg-amber-50 px-3 py-2 text-amber-900" data-testid="aems-problem">{problem}</p>}
      {!locked && (
        <button type="button" disabled={Boolean(problem)} onClick={() => onSave(input)} className={`${primaryBtn} w-full`}>
          LƯU PHIẾU BÁO GIÁ (Draft)
        </button>
      )}

      {q && (
        <div className="space-y-2 rounded-md border border-line p-3">
          <span className="block text-[11px] font-bold uppercase text-ink-muted">Trạng thái duyệt Maersk (nhập theo AEMS)</span>
          <div className="flex flex-wrap items-end gap-2">
            <label>
              <span className={labelCls}>Trạng thái</span>
              <select value={approval} onChange={(e) => setApproval(e.target.value as AemsApproval)} className={inputCls}>
                {APPROVAL_SET.map((a) => <option key={a} value={a}>{AEMS_APPROVAL_LABELS[a]}</option>)}
              </select>
            </label>
            <label>
              <span className={labelCls}>Work Order AEMS</span>
              <input value={wo} onChange={(e) => setWo(e.target.value)} placeholder="VD 513325391" className={`${inputCls} font-mono`} />
            </label>
            <button type="button" onClick={() => onApproval(approval, wo)} className={secondaryBtn}>CẬP NHẬT TRẠNG THÁI</button>
          </div>
          {q.approvalAt && <p className="text-[11px] text-ink-muted">{AEMS_APPROVAL_LABELS[q.approval]} • {q.approvalBy} • {formatDateTime(q.approvalAt)}</p>}
          <p className="text-[11px] text-ink-muted">Lưu gần nhất: {q.savedBy} • {formatDateTime(q.savedAt)}</p>
        </div>
      )}

      <button type="button" disabled={Boolean(blocker)} onClick={onConfirm} title={blocker || ''} className={`${primaryBtn} w-full`}>
        XÁC NHẬN CHỜ SỬA CHỮA → chuyển Sửa chữa
      </button>
      {blocker && <p className="text-center text-[11px] text-ink-muted">{blocker} — chỉ Approved mới chuyển Sửa chữa.</p>}
    </div>
  );
};
