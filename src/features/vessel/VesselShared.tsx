import React from 'react';
import { Ship } from 'lucide-react';
import { ContainerRecord, VesselList } from '../../types/depot';
import type { DepotState } from '../../services/depotStore';
import { ContainerOperationCode, containerOperation, vesselListProgress } from '../../services/vessel';
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

// DEC-083: nhãn TÁC NGHIỆP (Hạ vỏ / Cấp vỏ / Nhập tàu + tàu / Xuất tàu + tàu) cho màn Vệ sinh / Xe nâng
const OP_TONE: Record<ContainerOperationCode, string> = {
  HA_VO: 'bg-op-ha-vo text-white',
  CAP_VO: 'bg-op-cap-vo text-white',
  NHAP_TAU: 'bg-op-nhap-tau text-white',
  XUAT_TAU: 'bg-op-xuat-tau text-ink',
};

export const OperationBadge: React.FC<{ state: DepotState; container: ContainerRecord; large?: boolean; hideVessel?: boolean; block?: boolean }> = ({ state, container, large, hideVessel, block }) => {
  const op = containerOperation(state, container);
  return (
    <span
      data-testid="operation-badge"
      className={`${block ? "flex w-full justify-center text-center" : "inline-flex"} flex-wrap items-center gap-x-1.5 rounded font-black uppercase ${OP_TONE[op.code]} ${large ? "px-2.5 py-1 text-sm" : "px-1.5 py-1 text-[10px]"}`}
    >
      {op.label}
      {!hideVessel && op.vesselName && <span className={`font-semibold normal-case ${large ? 'text-xs' : ''}`}>• Tàu {op.vesselName}</span>}
    </span>
  );
};
