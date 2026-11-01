// ============================================================================
// DEC-203: TÌNH TRẠNG / HƯ HỎNG theo eEIR Maersk — Giám định Hạ vỏ cont MSK (thiết kế: docs/design/EEIR_GIAM_DINH.md).
//   KHÔNG HƯ (tổng ≤ 10 ảnh, tính cả ảnh cửa cont) • HAO MÒN (≤ 20 ảnh) • HƯ DO BÊN THỨ 3 / XẾP DỠ (mỗi chỗ hư: CEDEX + loại + bên gây hư + 1–3 ảnh)
//   AV / DAMAGE tự suy: có ≥ 1 chỗ hư bên thứ 3 → DAMAGE, còn lại → AV.
// Database khớp: record_gate_in_survey (migration 20261120000001).
// ============================================================================
import { EEIR_DAMAGE_SIDES, EEIR_DAMAGE_SOURCES, EEIR_DAMAGE_TYPES, EeirDamageSide, InspectionDamageItem, InspectionSurvey } from '../types/depot';
import { isMaerskLine } from './edi/maersk';

export const NO_DAMAGE_PHOTO_MAX = 10; // app eEIR: tối đa 10 ảnh "không hư" (tính cả ảnh cửa cont)
export const WEAR_TEAR_PHOTO_MAX = 20;
export const DAMAGE_PHOTO_MIN = 1;
export const DAMAGE_PHOTO_MAX = 3;
export const DAMAGE_NOTE_MAX = 255;

export const EMPTY_SURVEY: InspectionSurvey = { noDamagePhotos: [], wearTearPhotos: [], damages: [] };

// Hãng phải ghi tình trạng theo eEIR
export const usesInspectionSurvey = (lineCode?: string) => isMaerskLine(lineCode);

export const surveyCondition = (s: InspectionSurvey): 'AV' | 'DAMAGE' => (s.damages.length ? 'DAMAGE' : 'AV');

const typeLabel = (code: number) => EEIR_DAMAGE_TYPES.find((t) => t.code === code)?.label.split(' (')[0] || String(code);
export const damageTypeLabel = (code: number) => EEIR_DAMAGE_TYPES.find((t) => t.code === code)?.label || String(code);
export const damageSourceLabel = (code: number) => EEIR_DAMAGE_SOURCES.find((t) => t.code === code)?.label || String(code);
export const damageSideLabel = (side: EeirDamageSide) => EEIR_DAMAGE_SIDES.find((s) => s.code === side)?.label || side;

// Remark hư gửi Báo giá (luồng DAMAGE cũ): "LT89 Móp"
export const surveyRemarks = (s: InspectionSurvey): string[] => s.damages.map((d) => `${d.location} ${typeLabel(d.damageType)}`);

// Chỗ hư bên thứ 3 còn thiếu gì (null = đủ) — dùng cho nút LƯU ở giao diện và kiểm tra khi lưu
export function damageItemProblem(d: Pick<InspectionDamageItem, 'side' | 'location' | 'damageType' | 'source' | 'photos' | 'description'>): string | null {
  if (!EEIR_DAMAGE_SIDES.some((s) => s.code === d.side)) return 'Chọn mặt container bị hư.';
  const loc = (d.location || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{4}$/.test(loc) || loc[0] !== d.side) return `Vị trí CEDEX phải 4 ký tự chữ / số, bắt đầu bằng ${d.side}.`;
  if (!EEIR_DAMAGE_TYPES.some((t) => t.code === d.damageType)) return 'Chọn loại hư.';
  if (!EEIR_DAMAGE_SOURCES.some((t) => t.code === d.source)) return 'Chọn bên gây hư.';
  if ((d.description || '').length > DAMAGE_NOTE_MAX) return `Mô tả tối đa ${DAMAGE_NOTE_MAX} ký tự.`;
  const n = d.photos.filter(Boolean).length;
  if (n < DAMAGE_PHOTO_MIN) return 'Chụp ít nhất 1 ảnh chỗ hư.';
  if (n > DAMAGE_PHOTO_MAX) return `Tối đa ${DAMAGE_PHOTO_MAX} ảnh / chỗ hư.`;
  return null;
}

// Kiểm tra + chuẩn hóa (ảnh cửa cont đã chụp ở bước 1 → tính vào nhóm KHÔNG HƯ)
export function validateSurvey(s: InspectionSurvey | undefined): InspectionSurvey {
  if (!s) throw new Error('Cont hãng Maersk: vui lòng ghi TÌNH TRẠNG theo eEIR (Không hư / Hao mòn / Hư do bên thứ 3).');
  const noDamagePhotos = (s.noDamagePhotos || []).filter(Boolean);
  const wearTearPhotos = (s.wearTearPhotos || []).filter(Boolean);
  if (noDamagePhotos.length + 1 > NO_DAMAGE_PHOTO_MAX) throw new Error(`KHÔNG HƯ: tối đa ${NO_DAMAGE_PHOTO_MAX} ảnh (tính cả ảnh cửa cont).`);
  if (wearTearPhotos.length > WEAR_TEAR_PHOTO_MAX) throw new Error(`HAO MÒN: tối đa ${WEAR_TEAR_PHOTO_MAX} ảnh.`);
  const damages = (s.damages || []).map((d) => {
    const problem = damageItemProblem(d);
    if (problem) throw new Error(`Hư bên thứ 3 (${d.location || damageSideLabel(d.side)}): ${problem}`);
    const description = d.description?.trim();
    return { ...d, location: d.location.trim().toUpperCase(), photos: d.photos.filter(Boolean), description: description || undefined };
  });
  return { noDamagePhotos, wearTearPhotos, damages };
}
