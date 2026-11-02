import React from 'react';
import type { DepotState } from '../services/depotStore';
import { EeirSource, eeirCurrentMove, eeirLocationLabel } from '../services/carriers/maersk/eeir';

// Dòng CURRENT MOVE • LOCATION như app eEIR Maersk (người dùng duyệt 2026-11-02) — chỉ đọc, tự gán theo tác nghiệp.
// Chỉ đặt ở màn Giám định cont MSK (nơi gọi tự kiểm tra hãng).
export const EeirMoveLine: React.FC<{ state: Pick<DepotState, 'companyProfile'>; source: EeirSource }> = ({ state, source }) => (
  <div className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border border-line bg-canvas p-2" data-testid="eeir-move-line">
    <div className="min-w-0">
      <span className="block text-[10px] font-bold uppercase text-ink-muted">Current Move</span>
      <span className="block truncate font-mono text-xs font-bold text-ink" data-testid="eeir-current-move">{eeirCurrentMove(source)}</span>
    </div>
    <div className="text-right">
      <span className="block text-[10px] font-bold uppercase text-ink-muted">Location</span>
      <span className="block font-mono text-xs font-bold text-ink">{eeirLocationLabel(state) || '-'}</span>
    </div>
  </div>
);
