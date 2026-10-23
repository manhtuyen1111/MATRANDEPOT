import React from 'react';
import { Ship } from 'lucide-react';
import { VesselList, VesselMode, VESSEL_MODE_LABELS } from '../../types/depot';
import { vesselListProgress } from '../../services/vessel';
import { formatDateTime } from '../../services/datetime';

// Thanh tiến độ 1 danh sách tàu — mọi bộ phận cùng theo dõi (DEC-069)
export const VesselProgressBar: React.FC<{ list: VesselList }> = ({ list }) => {
  const p = vesselListProgress(list);
  const pct = p.total ? Math.round((p.done / p.total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
      </div>
      <p className="flex flex-wrap gap-x-3 text-[11px] text-slate-600">
        <span className="font-bold text-emerald-700">Xong {p.done}/{p.total}</span>
        {list.mode === 'NHAP_TAU' && <span>Đã giám định, chờ hạ: {p.inspected}</span>}
        <span>{list.mode === 'NHAP_TAU' ? 'Chờ xe về' : 'Chờ xuất'}: {p.pending}</span>
      </p>
    </div>
  );
};

export const VesselListTitle: React.FC<{ list: VesselList }> = ({ list }) => (
  <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
    <Ship className="h-4 w-4 text-slate-500" />
    <span className="font-black text-slate-900">{list.vesselName}</span>
    <span className="font-mono text-[11px] text-slate-600">{formatDateTime(list.plannedAt)}</span>
    {list.shippingLineCode && <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-700">{list.shippingLineCode}</span>}
    {list.status === 'APPROVED' && <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">ĐÃ DUYỆT</span>}
  </span>
);

// Tiến độ các danh sách đang mở (dùng ở màn mobile các bộ phận)
export const VesselProgressPanel: React.FC<{ lists: VesselList[]; mode: VesselMode; selectedId?: string; onSelect?: (id: string) => void }> = ({
  lists,
  mode,
  selectedId,
  onSelect,
}) => (
  <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
    <p className="text-[11px] font-bold uppercase text-slate-600">Tiến độ {VESSEL_MODE_LABELS[mode]} ({lists.length} danh sách)</p>
    {lists.length === 0 ? (
      <p className="text-xs text-slate-500">Chưa có danh sách {VESSEL_MODE_LABELS[mode].toLowerCase()} nào đang mở.</p>
    ) : (
      lists.map((l) => (
        <button
          key={l.id}
          type="button"
          onClick={() => onSelect?.(l.id)}
          disabled={!onSelect}
          className={`block w-full space-y-1.5 rounded-md border p-2.5 text-left text-xs ${selectedId === l.id ? 'border-blue-600 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'} disabled:cursor-default`}
        >
          <VesselListTitle list={l} />
          <VesselProgressBar list={l} />
        </button>
      ))
    )}
  </div>
);

// Nút chọn lớn cho màn mobile (một lựa chọn)
export function ChoiceButtons<T extends string>({
  options,
  value,
  onChange,
  cols = 2,
  tone,
}: {
  options: readonly T[];
  value: T | '';
  onChange: (v: T) => void;
  cols?: number;
  tone?: (v: T) => string;
}) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={`rounded-lg border py-2.5 text-sm font-bold transition ${
            value === o ? tone?.(o) || 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
