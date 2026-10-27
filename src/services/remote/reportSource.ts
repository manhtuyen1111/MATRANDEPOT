// ============================================================================
// NGUỒN DỮ LIỆU BÁO CÁO (N7 — DEC-157). Demo: báo cáo chạy trên state sẵn có.
// Database: app chỉ giữ dữ liệu đang làm việc (90 ngày — loadWorking.ts). Lọc có ngày bắt đầu cũ hơn →
// tải riêng đúng khoảng lọc (tối đa 3 tháng) rồi chạy cùng hàm báo cáo / Excel trong reports.ts.
// ============================================================================
import type { DepotState } from '../depotStore';
import { parseDateTime } from '../datetime';
import type { DateRange } from '../reports';
import { WORKING_DAYS } from './loadWorking';

export const REMOTE_MAX_RANGE_DAYS = 92; // ~3 tháng (APP_DB_INTEGRATION nguyên tắc 4)

type RangeLoader = (range: { from: string; to: string }) => Promise<DepotState>;
let loader: RangeLoader | null = null;

// RemoteApp đăng ký khi đăng nhập, gỡ khi đăng xuất
export function setReportLoader(fn: RangeLoader | null): void {
  loader = fn;
}

function bounds(range: DateRange): { from: Date; to: Date } | null {
  const from = parseDateTime(range.dateFrom, 'start');
  const to = parseDateTime(range.dateTo, 'end');
  return from && to ? { from, to } : null;
}

// Cần tải riêng khi đang chạy database và ngày bắt đầu nằm ngoài cửa sổ 90 ngày đã tải
export function needsRangeLoad(range: DateRange, now = new Date(), active = loader !== null): boolean {
  if (!active) return false;
  const b = bounds(range);
  if (!b) return false;
  return b.from.getTime() < now.getTime() - (WORKING_DAYS - 1) * 86_400_000;
}

export function assertRemoteRange(range: DateRange): { from: string; to: string } {
  const b = bounds(range);
  if (!b) throw new Error('Chọn đủ thời gian TỪ và ĐẾN.');
  if (b.from > b.to) throw new Error('Thời gian TỪ phải trước hoặc bằng ĐẾN.');
  if ((b.to.getTime() - b.from.getTime()) / 86_400_000 > REMOTE_MAX_RANGE_DAYS) {
    throw new Error('Tra cứu dữ liệu cũ hơn 90 ngày: mỗi lần tối đa 3 tháng.');
  }
  return { from: b.from.toISOString(), to: b.to.toISOString() };
}

// Trả về state để chạy báo cáo: state hiện tại, hoặc dữ liệu tải riêng theo khoảng lọc (giữ người dùng hiện tại)
export async function stateForRange(state: DepotState, range: DateRange): Promise<DepotState> {
  if (!loader || !needsRangeLoad(range)) return state;
  const loaded = await loader(assertRemoteRange(range));
  return { ...loaded, currentUser: state.currentUser };
}
