// ============================================================================
// DANH SÁCH HÃNG TÀU ĐÃ TÍCH HỢP + HÀM TRA CỨU CHUNG. Thêm hãng: tạo carriers/<hãng>/profile.ts rồi thêm vào CARRIERS.
// Hãng không có trong danh sách → dùng quy trình chung của depot (không form eEIR, không ảnh cấp vỏ, không kiểm booking riêng).
// ============================================================================
import type { CarrierFeatures, CarrierProfile } from './types';
import { MAERSK } from './maersk/profile';

export const CARRIERS: CarrierProfile[] = [MAERSK];

export const carrierOf = (lineCode?: string | null): CarrierProfile | undefined =>
  lineCode ? CARRIERS.find((c) => c.lineCodes.includes(lineCode)) : undefined;

export const carrierUses = (lineCode: string | null | undefined, feature: keyof CarrierFeatures): boolean => Boolean(carrierOf(lineCode)?.features[feature]);

// Mã hãng (Danh mục) đang bật 1 chức năng — VD ảnh cấp vỏ
export const linesWith = (feature: keyof CarrierFeatures): string[] => CARRIERS.filter((c) => c.features[feature]).flatMap((c) => c.lineCodes);

// Lỗi số booking theo quy tắc riêng của hãng (null = hợp lệ / hãng không có quy tắc riêng)
export function carrierBookingProblem(lineCode: string | null | undefined, bookingNo: string): string | null {
  const rule = carrierOf(lineCode)?.bookingRule;
  return rule && !rule.test(bookingNo) ? rule.message : null;
}
