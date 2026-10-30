import React, { useState } from 'react';
import { Globe2, Save } from 'lucide-react';
import { setContainerIsoCode } from '../../services/api';
import { DepotState } from '../../services/depotStore';
import { Feedback, inputCls, labelCls, primaryBtn } from '../../components/shared';

// DEC-195: MÃ ISO 6346 theo Size + Type — màn hình / phiếu / biểu giá vẫn dùng 20DC, 40HC…; mã ISO dùng cho EDI / API hãng tàu.
// Admin sửa; người khác chỉ xem. Mã trống = bỏ.
export const ContainerIsoCodeCard: React.FC<{ state: DepotState; isAdmin: boolean; onUpdateState: (next: DepotState) => void }> = ({ state, isAdmin, onUpdateState }) => {
  const sizes = state.containerSizes || [];
  const types = state.containerTypes || [];
  const [size, setSize] = useState(sizes[0] || '');
  const [type, setType] = useState(types[0] || '');
  const current = (state.containerIsoCodes || []).find((c) => c.size === size && c.type === type)?.isoCode || '';
  const [code, setCode] = useState(current);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const rows = [...(state.containerIsoCodes || [])].sort((a, b) => `${a.size}${a.type}`.localeCompare(`${b.size}${b.type}`));

  const pick = (s: string, t: string) => {
    setSize(s);
    setType(t);
    setCode((state.containerIsoCodes || []).find((c) => c.size === s && c.type === t)?.isoCode || '');
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      onUpdateState(setContainerIsoCode(state, { size, type, isoCode: code }));
      setSuccess(code.trim() ? `Đã lưu mã ISO ${size}${type} = ${code.trim().toUpperCase()}.` : `Đã bỏ mã ISO ${size}${type}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được mã ISO');
    }
  };

  return (
    <div className="space-y-4 rounded-xl border border-line bg-white p-4 text-xs" data-testid="iso-code-card">
      <div>
        <h3 className="flex items-center gap-1.5 text-sm font-bold text-ink"><Globe2 className="h-4 w-4 text-ink-muted" />Mã ISO 6346 theo Size - Type ({rows.length})</h3>
        <p className="text-[11px] text-ink-muted">
          Chuẩn quốc tế dùng khi gửi EDI / API hãng tàu. Màn hình, phiếu in, biểu giá vẫn ghi 20DC, 40HC… Cont có mã riêng (VD lấy từ Maersk) sẽ ưu tiên mã riêng.
        </p>
      </div>
      <Feedback error={error} success={success} onClose={() => (setError(null), setSuccess(null))} />
      {isAdmin && (
        <form onSubmit={save} className="flex flex-wrap items-end gap-2">
          <label className="w-24">
            <span className={labelCls}>Size</span>
            <select value={size} onChange={(e) => pick(e.target.value, type)} className={inputCls}>
              {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <label className="w-24">
            <span className={labelCls}>Type</span>
            <select value={type} onChange={(e) => pick(size, e.target.value)} className={inputCls}>
              {types.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="w-32">
            <span className={labelCls}>Mã ISO 6346</span>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={4} placeholder="VD 45G1" className={`${inputCls} font-mono uppercase`} />
          </label>
          <button type="submit" className={primaryBtn}><Save className="h-3.5 w-3.5" />Lưu</button>
        </form>
      )}
      <div className="overflow-x-auto">
        <table className="data-table w-full whitespace-nowrap text-left text-xs">
          <thead className="bg-canvas text-[11px] font-semibold text-ink-muted">
            <tr>
              <th className="px-3 py-2">Size - Type</th>
              <th className="px-3 py-2">Mã ISO 6346</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 ? (
              <tr><td colSpan={2} className="px-3 py-2 text-ink-muted">Chưa khai báo mã ISO.</td></tr>
            ) : (
              rows.map((r) => (
                <tr key={`${r.size}${r.type}`} onClick={() => isAdmin && pick(r.size, r.type)} className={isAdmin ? 'cursor-pointer hover:bg-canvas' : ''}>
                  <td className="px-3 py-2 font-mono font-bold">{r.size}{r.type}</td>
                  <td className="px-3 py-2 font-mono">{r.isoCode}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
