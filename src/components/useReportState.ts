import { useState } from 'react';
import type { DepotState } from '../services/depotStore';
import type { DateRange } from '../services/reports';
import { needsRangeLoad, stateForRange } from '../services/remote/reportSource';

// Báo cáo / tra cứu (N7): bấm Tra cứu → run(khoảng lọc, apply); chạy query trên `data`.
// Demo hoặc lọc trong cửa sổ làm việc (7 ngày) → apply ngay, data = state hiện tại.
// Database lọc xa hơn → tải riêng theo khoảng lọc (tối đa 3 tháng) rồi mới apply.
export function useReportState(state: DepotState) {
  const [loaded, setLoaded] = useState<DepotState | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const run = (range: DateRange, apply: (data: DepotState) => void): void => {
    setLoadError(null);
    if (!needsRangeLoad(range)) {
      setLoaded(null);
      apply(state);
      return;
    }
    setLoading(true);
    stateForRange(state, range)
      .then((next) => {
        setLoaded(next);
        apply(next);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : 'Không tải được dữ liệu báo cáo.'))
      .finally(() => setLoading(false));
  };

  return { data: loaded ?? state, run, loading, loadError };
}
