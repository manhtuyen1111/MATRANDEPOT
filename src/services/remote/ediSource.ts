// ============================================================================
// EDI CODECO chạy thử (DEC-197) — dữ liệu 1 khoảng giờ. Demo: dùng dữ liệu đang có.
// Database: tải riêng lượt ra / vào trong khoảng (loadEdiState) — RemoteApp đăng ký khi đăng nhập, gỡ khi đăng xuất.
// ============================================================================
import type { DepotState } from '../depotStore';

type EdiLoader = (state: DepotState, range: { from: string; to: string }) => Promise<DepotState>;
let loader: EdiLoader | null = null;

export function setEdiLoader(fn: EdiLoader | null): void {
  loader = fn;
}

export async function ediStateFor(state: DepotState, range: { from: Date; to: Date }): Promise<DepotState> {
  return loader ? loader(state, { from: range.from.toISOString(), to: range.to.toISOString() }) : state;
}
