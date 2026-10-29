// ============================================================================
// BÁO CÁO PHÂN TRANG Ở DATABASE (DEC-178 bước 4b) — Hạ vỏ, Cấp vỏ, Sửa chữa (chi tiết).
// Demo: báo cáo chạy trên state sẵn có (không đăng ký pager).
// Database: mỗi lần đổi bộ lọc / trang → database trả 1 trang + tổng số dòng (loadReportPage); Excel lấy toàn bộ theo đợt.
// Không còn giới hạn 3 tháng — mỗi lần tối đa MAX_RANGE_DAYS (1 năm) như bản Demo.
// ============================================================================
import type { DepotState } from '../depotStore';
import { parseDateTime } from '../datetime';
import { MAX_RANGE_DAYS } from '../reports';
import type { ServerReportFilter, ServerReportKind } from './loadWorking';

export interface ReportPager {
  page(state: DepotState, kind: ServerReportKind, f: ServerReportFilter, page: number, size: number): Promise<{ state: DepotState; total: number }>;
  all(state: DepotState, kind: ServerReportKind, f: ServerReportFilter, onProgress?: (done: number, total: number) => void): Promise<DepotState>;
}

let pager: ReportPager | null = null;

// RemoteApp đăng ký khi đăng nhập, gỡ khi đăng xuất
export function setReportPager(next: ReportPager | null): void {
  pager = next;
}

export const reportPagerActive = () => pager !== null;

// Bộ lọc trên màn (dd/MM/yyyy HH:mm:ss) → bộ lọc gửi database (ISO); cùng điều kiện với hàm báo cáo trong reports.ts
export interface ScreenReportFilter {
  dateFrom?: string;
  dateTo?: string;
  containerNo?: string;
  shippingLineCode?: string;
  size?: string;
  teamCode?: string;
  status?: string;
}

export function toServerFilter(f: ScreenReportFilter): ServerReportFilter {
  const hasRange = Boolean(f.dateFrom || f.dateTo);
  if (hasRange && (!f.dateFrom || !f.dateTo)) throw new Error('Vui lòng chọn đủ TỪ và ĐẾN (dd/mm/yyyy hh:mm:ss).');
  const from = f.dateFrom ? parseDateTime(f.dateFrom, 'start') : null;
  const to = f.dateTo ? parseDateTime(f.dateTo, 'end') : null;
  if (hasRange && (!from || !to)) throw new Error('Thời gian không hợp lệ — nhập theo dạng dd/mm/yyyy hh:mm:ss.');
  if (from && to) {
    if (from > to) throw new Error('Thời gian TỪ phải trước hoặc bằng ĐẾN.');
    if ((to.getTime() - from.getTime()) / 86_400_000 > MAX_RANGE_DAYS) throw new Error(`Khoảng thời gian tối đa ${MAX_RANGE_DAYS} ngày cho mỗi lần truy vấn.`);
  }
  if (!from && !f.containerNo?.trim()) throw new Error('Nhập số container hoặc chọn khoảng thời gian trước khi tra cứu.');
  return {
    from: from?.toISOString(), to: to?.toISOString(), containerNo: f.containerNo?.trim() || undefined,
    shippingLineCode: f.shippingLineCode || undefined, size: f.size || undefined, teamCode: f.teamCode || undefined, status: f.status || undefined,
  };
}

// Giữ người dùng / danh mục đang có (dữ liệu tải riêng chỉ để hiển thị báo cáo)
export async function fetchReportPage(state: DepotState, kind: ServerReportKind, f: ScreenReportFilter, page: number, size: number) {
  if (!pager) throw new Error('Chưa kết nối database.');
  const out = await pager.page(state, kind, toServerFilter(f), page, size);
  return { state: { ...out.state, currentUser: state.currentUser }, total: out.total };
}

export async function fetchReportAll(state: DepotState, kind: ServerReportKind, f: ScreenReportFilter, onProgress?: (done: number, total: number) => void) {
  if (!pager) return state;
  const out = await pager.all(state, kind, toServerFilter(f), onProgress);
  return { ...out, currentUser: state.currentUser };
}
