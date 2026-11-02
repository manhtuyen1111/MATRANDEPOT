// ============================================================================
// THÔNG TIN CONT TỪ API HÃNG TÀU (người dùng 2026-11-02): Giám định Hạ vỏ nhập số cont trước → hỏi API hãng tàu.
//   Ô nào API trả được (Size / Type / ISO / AGE / Phân loại) thì tự điền, Giám định không phải nhập lại; Văn phòng sửa được sau.
//   Chưa kết nối / API lỗi / cont không có dữ liệu → Giám định tự nhập như trước (không chặn tác nghiệp — EDI_MAERSK.md 12.2).
// Thiết kế chung cho mọi hãng: mỗi hãng khai báo nguồn API trong hồ sơ hãng (CarrierProfile.equipment); hạng vỏ hãng trả về dùng thẳng làm mã
//   PHÂN LOẠI nếu mã đó có trong Danh mục Phân loại của hãng (DEC-166) — thêm hãng mới chỉ cần thêm nguồn + Danh mục.
// Maersk: API 1 getEquipmentDetails (containerSize, equipmentSubType, equipmentISOCode, productionYear, smokeTested).
//   Khóa API chỉ ở máy chủ (Edge Function) — CHƯA CÓ KHÓA nên nguồn MSK đang "chưa kết nối". Không bao giờ tạo dữ liệu giả.
// ============================================================================
import type { DepotState } from '../depotStore';
import { stuffingOptions } from '../stuffing';
import { carrierOf } from './registry';
import type { EquipmentInfo, EquipmentLookup } from './types';

export type { EquipmentInfo, EquipmentLookup } from './types';

export const CONTAINER_NO_PATTERN = /^[A-Z]{4}\d{7}$/;
export const cleanContainerNo = (no?: string) => (no || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const isContainerNoFormat = (no?: string) => CONTAINER_NO_PATTERN.test(cleanContainerNo(no));

// Nguồn API theo hãng: khai báo trong hồ sơ hãng (carriers/<hãng>/profile.ts → equipment)
const sourceOf = (lineCode?: string) => carrierOf(lineCode)?.equipment;

export const hasEquipmentSource = (lineCode?: string) => Boolean(sourceOf(lineCode));

export async function lookupEquipment(lineCode: string | undefined, containerNo: string): Promise<EquipmentLookup> {
  const no = cleanContainerNo(containerNo);
  if (!isContainerNoFormat(no)) return { status: 'ERROR', message: 'Số cont phải gồm 4 chữ + 7 số (VD MSKU1234567).' };
  const src = sourceOf(lineCode);
  if (!src) return { status: 'NOT_CONNECTED', message: `Hãng ${lineCode || '—'} chưa có API thông tin cont — Giám định tự nhập.` };
  if (!src.connected || !src.fetch) return { status: 'NOT_CONNECTED', message: `Chưa kết nối API ${src.label} — Giám định tự nhập.` };
  try {
    return await src.fetch(no);
  } catch {
    return { status: 'ERROR', message: 'Không lấy được thông tin từ API hãng tàu — Giám định tự nhập.' };
  }
}

// Giá trị tự điền từ API: chỉ nhận giá trị hợp lệ; hạng vỏ phải có trong Danh mục Phân loại của hãng
export interface EquipmentPrefill {
  size?: string;
  type?: string;
  isoCode?: string;
  manufactureYear?: number;
  stuffingClass?: string;
}
export function equipmentPrefill(state: DepotState, lineCode: string | undefined, info?: EquipmentInfo): EquipmentPrefill {
  if (!info) return {};
  const year = info.manufactureYear;
  const grade = info.grade?.trim().toUpperCase();
  return {
    size: info.size && ['20', '40', '45'].includes(info.size) ? info.size : undefined,
    type: info.type?.trim().toUpperCase() || undefined,
    isoCode: info.isoCode && /^[0-9A-Z]{4}$/.test(info.isoCode) ? info.isoCode : undefined,
    manufactureYear: year && year >= 1980 && year <= new Date().getFullYear() + 1 ? year : undefined,
    stuffingClass: grade && stuffingOptions(state, lineCode).includes(grade) ? grade : undefined,
  };
}
