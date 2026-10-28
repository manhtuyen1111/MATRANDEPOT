import React, { useState } from 'react';
import { addStuffingClassCatalogItem, setStuffingClassActive } from '../../services/api';
import { PackageCheck, Plus } from 'lucide-react';
import { DepotState } from '../../services/depotStore';
import { hasRolePermission } from '../../services/permissions';
import { CellText, CELL_MAX, Feedback, inputCls, labelCls, primaryBtn, SectionCard } from '../../components/shared';

// DANH MỤC CHUNG — PHÂN LOẠI ĐÓNG HÀNG theo hãng tàu (DEC-166). Chỉ ADMIN cấu hình, vai trò khác xem.
// Hãng không có mã nào đang dùng → Giám định không hỏi Đóng hàng. Không xóa cứng (hồ sơ cũ còn dùng mã) — chỉ ngừng dùng / mở lại.
export const StuffingClassCatalog: React.FC<{ state: DepotState; onUpdateState: (next: DepotState) => void }> = ({ state, onUpdateState }) => {
  const isAdmin = hasRolePermission(state.currentUser, ['ADMIN']);
  const lines = state.partners.filter((p) => p.isShippingLine);
  const [line, setLine] = useState(lines[0]?.code || '');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  const items = [...(state.stuffingClasses || [])].sort((a, b) => a.shippingLineCode.localeCompare(b.shippingLineCode));
  const linesWithout = lines.filter((p) => !items.some((s) => s.isActive && s.shippingLineCode === p.code));

  return (
    <div className="space-y-4">
      <Feedback error={error} success={success} onClose={() => (setError(null), setSuccess(null))} />
      {isAdmin && (
        <SectionCard title="Thêm phân loại đóng hàng" icon={<Plus className="h-4 w-4 text-ink-muted" />}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const c = code.trim().toUpperCase();
              if (run(() => addStuffingClassCatalogItem(state, { shippingLineCode: line, code: c, description }), `Đã thêm phân loại ${c} cho hãng tàu ${line}.`)) {
                setCode('');
                setDescription('');
              }
            }}
            className="grid grid-cols-1 gap-3 sm:grid-cols-4"
          >
            <label>
              <span className={labelCls}>Hãng tàu *</span>
              <select value={line} onChange={(e) => setLine(e.target.value)} className={inputCls}>
                {lines.map((p) => <option key={p.code} value={p.code}>{p.code} — {p.name}</option>)}
              </select>
            </label>
            <label>
              <span className={labelCls}>Mã phân loại * (VD: M, K, E)</span>
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={5} className={`${inputCls} font-mono uppercase`} />
            </label>
            <label>
              <span className={labelCls}>Mô tả</span>
              <input value={description} onChange={(e) => setDescription(e.target.value)} className={inputCls} />
            </label>
            <div className="flex items-end">
              <button type="submit" className={primaryBtn}>
                <Plus className="h-4 w-4" />
                Thêm
              </button>
            </div>
          </form>
        </SectionCard>
      )}

      <SectionCard title={`Phân loại đóng hàng (${items.filter((s) => s.isActive).length} đang dùng)`} icon={<PackageCheck className="h-4 w-4 text-ink-muted" />}>
        {linesWithout.length > 0 && (
          <p className="mb-2 text-[11px] text-ink-muted">
            Hãng tàu không dùng phân loại (Giám định không hỏi Đóng hàng): <span className="font-bold text-ink">{linesWithout.map((p) => p.code).join(', ')}</span>
          </p>
        )}
        {items.length === 0 ? (
          <p className="py-6 text-center text-xs text-ink-muted">Chưa có phân loại đóng hàng nào.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table w-full whitespace-nowrap text-left text-xs">
              <thead className="border-b border-line text-[11px] uppercase text-ink-muted">
                <tr>
                  <th className="py-2 pr-2">Hãng tàu</th>
                  <th className="py-2 pr-2">Mã phân loại</th>
                  <th className="py-2 pr-2">Mô tả</th>
                  <th className="py-2 pr-2">Trạng thái</th>
                  {isAdmin && <th className="py-2" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((s) => (
                  <tr key={s.id} className={s.isActive ? '' : 'text-ink-muted'}>
                    <td className="py-2 pr-2 font-bold">{s.shippingLineCode}</td>
                    <td className="py-2 pr-2 font-mono text-sm font-black">{s.code}</td>
                    <td className="py-2 pr-2"><CellText text={s.description || '-'} max={CELL_MAX.MEDIUM} /></td>
                    <td className="py-2 pr-2">
                      {s.isActive ? <span className="font-bold text-emerald-700">Đang dùng</span> : <span>Ngừng dùng</span>}
                    </td>
                    {isAdmin && (
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            run(
                              () => setStuffingClassActive(state, { shippingLineCode: s.shippingLineCode, code: s.code, isActive: !s.isActive }),
                              `${s.isActive ? 'Đã ngừng dùng' : 'Đã mở lại'} phân loại ${s.code} của hãng ${s.shippingLineCode}.`
                            )
                          }
                          className="rounded border border-line-strong bg-white px-2 text-[11px] font-bold text-ink hover:bg-canvas"
                        >
                          {s.isActive ? 'Ngừng dùng' : 'Mở lại'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
};
