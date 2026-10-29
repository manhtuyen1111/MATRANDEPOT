import { useEffect, useState } from 'react';
import type { DepotState } from '../services/depotStore';
import { ALL_ROWS, type PagedResult } from '../services/reports';
import type { ServerReportKind } from '../services/remote/loadWorking';
import { fetchReportAll, fetchReportPage, reportPagerActive, type ScreenReportFilter } from '../services/remote/reportPaging';

// BÁO CÁO PHÂN TRANG (DEC-178 bước 4b) — Hạ vỏ, Cấp vỏ, Sửa chữa.
// Demo: chạy hàm báo cáo trên state hiện tại (như trước).
// Database: database trả đúng trang đang xem + tổng số dòng; dòng vẫn dựng bằng cùng hàm báo cáo (local) trên dữ liệu của trang.
// exportState(): dữ liệu đủ mọi dòng theo bộ lọc để xuất Excel (database: lấy theo đợt).
export function usePagedReport<R>(
  live: DepotState,
  kind: ServerReportKind,
  applied: ScreenReportFilter | null,
  page: number,
  pageSize: number,
  local: (state: DepotState, page: number, pageSize: number) => PagedResult<R>
) {
  const remote = reportPagerActive();
  const key = JSON.stringify([kind, applied, page, pageSize]);
  const [server, setServer] = useState<{ key: string; state: DepotState; total: number } | null>(null);
  const [failed, setFailed] = useState<{ key: string; message: string } | null>(null);

  useEffect(() => {
    if (!remote || !applied) return;
    let alive = true;
    fetchReportPage(live, kind, applied, page, pageSize)
      .then((r) => alive && setServer({ key, ...r }))
      .catch((err) => alive && setFailed({ key, message: err instanceof Error ? err.message : 'Không tải được dữ liệu báo cáo.' }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- chỉ tải lại khi đổi bộ lọc / trang (không theo đồng bộ 30 giây)
  }, [key, remote]);

  const exportState = (onProgress?: (done: number, total: number) => void): Promise<DepotState> =>
    remote && applied ? fetchReportAll(live, kind, applied, onProgress) : Promise.resolve(live);

  if (!applied) return { result: null, state: live, loading: false, error: null, exportState };
  if (!remote) {
    try {
      return { result: local(live, page, pageSize), state: live, loading: false, error: null, exportState };
    } catch (err) {
      return { result: null, state: live, loading: false, error: err instanceof Error ? err.message : 'Lỗi tra cứu', exportState };
    }
  }
  if (failed?.key === key) return { result: null, state: live, loading: false, error: failed.message, exportState };
  if (server?.key !== key) return { result: null, state: live, loading: true, error: null, exportState };
  const result: PagedResult<R> = {
    rows: local(server.state, 1, ALL_ROWS).rows,
    total: server.total,
    page,
    pageCount: Math.max(1, Math.ceil(server.total / pageSize)),
  };
  return { result, state: server.state, loading: false, error: null, exportState };
}
