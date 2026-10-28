// ============================================================================
// DANH MỤC PHÂN LOẠI ĐÓNG HÀNG THEO HÃNG TÀU (DEC-166)
// Mỗi hãng tàu có bộ mã riêng (mặc định M / K / E), Admin thêm / ngừng dùng ở Danh mục chung.
// Hãng KHÔNG có mã nào đang dùng → không hỏi Đóng hàng khi giám định (lưu trống).
// Database: bảng stuffing_classes + hàm public.resolve_stuffing (cùng quy tắc với resolveStuffing dưới đây).
// ============================================================================
import type { Partner, StuffingClassItem } from '../types/depot';
import type { DepotState } from './depotStore';

export const DEFAULT_STUFFING_CODES = ['M', 'K', 'E'];

// Bộ mặc định M / K / E cho mọi hãng tàu — dữ liệu cũ / dữ liệu test (giữ đúng hành vi trước DEC-166)
export function defaultStuffingClasses(partners: Partner[]): StuffingClassItem[] {
  return partners
    .filter((p) => p.isShippingLine)
    .flatMap((p) => DEFAULT_STUFFING_CODES.map((code) => ({ id: `stf-${p.code}-${code}`, shippingLineCode: p.code, code, isActive: true })));
}

// Mã đang dùng của 1 hãng tàu (theo thứ tự trong Danh mục)
export function stuffingOptions(state: DepotState, shippingLineCode?: string): string[] {
  if (!shippingLineCode) return [];
  return (state.stuffingClasses || []).filter((s) => s.isActive && s.shippingLineCode === shippingLineCode).map((s) => s.code);
}

// Kiểm tra mã đóng hàng theo hãng: hãng có dùng → bắt buộc + phải đúng Danh mục; hãng không dùng → trống
export function resolveStuffing(state: DepotState, shippingLineCode: string | undefined, value: string | undefined): string | undefined {
  const options = stuffingOptions(state, shippingLineCode);
  if (options.length === 0) return undefined;
  const v = value?.trim().toUpperCase();
  if (!v) throw new Error(`Vui lòng chọn PHÂN LOẠI ĐÓNG HÀNG (${options.join(' / ')}) — hãng tàu ${shippingLineCode}.`);
  if (!options.includes(v)) throw new Error(`PHÂN LOẠI ĐÓNG HÀNG "${v}" không có trong Danh mục của hãng tàu ${shippingLineCode} (${options.join(' / ')}).`);
  return v;
}
