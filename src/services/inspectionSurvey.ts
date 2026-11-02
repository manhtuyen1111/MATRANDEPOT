// ============================================================================
// DEC-203: TÌNH TRẠNG / HƯ HỎNG theo eEIR Maersk — Giám định Hạ vỏ cont MSK (thiết kế: docs/design/EEIR_GIAM_DINH.md).
//   KHÔNG HƯ (tổng ≤ 20 ảnh, tính cả ảnh cửa cont) • HAO MÒN (≤ 20 ảnh) • HƯ DO BÊN THỨ 3 / XẾP DỠ (mỗi chỗ hư: CEDEX + loại + bên gây hư + 1–3 ảnh)
//   AV / DAMAGE tự suy: có ≥ 1 chỗ hư bên thứ 3 → DAMAGE, còn lại → AV.
// Database khớp: record_gate_in_survey (migration 20261120000001).
// ============================================================================
import { EEIR_DAMAGE_SIDES, EEIR_DAMAGE_SOURCES, EEIR_DAMAGE_TYPES, EeirDamageSide, InspectionDamageItem, InspectionSurvey } from '../types/depot';
import { carrierUses } from './carriers/registry';

export const NO_DAMAGE_PHOTO_MAX = 20; // app eEIR: tối đa 20 ảnh "không hư" (ảnh app thật 2026-11-01; tính cả ảnh cửa cont)
export const WEAR_TEAR_PHOTO_MAX = 20;
export const DAMAGE_PHOTO_MIN = 1;
export const DAMAGE_PHOTO_MAX = 3;
export const DAMAGE_NOTE_MAX = 255;

export const EMPTY_SURVEY: InspectionSurvey = { noDamagePhotos: [], wearTearPhotos: [], damages: [] };

// Hãng phải ghi tình trạng theo eEIR
export const usesInspectionSurvey = (lineCode?: string) => carrierUses(lineCode, 'inspectionSurvey');

export const surveyCondition = (s: InspectionSurvey): 'AV' | 'DAMAGE' => (s.damages.length ? 'DAMAGE' : 'AV');

const typeLabel = (code: number) => EEIR_DAMAGE_TYPES.find((t) => t.code === code)?.label.split(' (')[0] || String(code);
export const damageTypeLabel = (code: number) => EEIR_DAMAGE_TYPES.find((t) => t.code === code)?.label || String(code);
export const damageSourceLabel = (code: number) => EEIR_DAMAGE_SOURCES.find((t) => t.code === code)?.label || String(code);
export const damageSideLabel = (side: EeirDamageSide) => EEIR_DAMAGE_SIDES.find((s) => s.code === side)?.label || side;

// Mặt không có lưới trên app eEIR → vị trí cố định <mặt>XXX
export const FIXED_LOCATION_SIDES: EeirDamageSide[] = ['E', 'I', 'N', 'X'];
export const fixedDamageLocation = (side: EeirDamageSide) => (FIXED_LOCATION_SIDES.includes(side) ? `${side}XXX` : null);
// Mặc định như app eEIR: loại hư Bẩn (Dirty), bên gây hư Khách hàng
export const DEFAULT_DAMAGE_TYPE = 1;
export const DEFAULT_DAMAGE_SOURCE = 2;

// LƯỚI VỊ TRÍ CEDEX (người dùng mô tả theo app eEIR, 2026-11-01). Mã = mặt + hàng + cột đầu + (cột cuối | N khi 1 cột):
//   Vách L / R, Cửa D, Mặt trước F: hàng H trên cùng • T trên • B dưới • G dưới cùng; nhiều hàng → X
//   Nóc T, Khung đáy U, Sàn B: hàng L (trên) • R (dưới); cả 2 → X
//   Cột: vách / nóc / đáy / sàn 10 ô (cont 40') hoặc 5 ô (cont 20'), số 1…9, 0; cửa / mặt trước 4 cột 1–4
//   VD DB2N, DX3N, TL1N, TX1N, TX14, LT89, LB34
export type ContainerLength = '20' | '40';
// Giám định chọn SIZE CONT trước khi giám định (người dùng 2026-11-01): 20' → 5 ô; 40' / 45' → 10 ô
export const SURVEY_SIZES = ['20', '40', '45'];
export const surveyLength = (size?: string): ContainerLength => (size === '20' ? '20' : '40');
const SIZED_SIDES: EeirDamageSide[] = ['L', 'R', 'T', 'U', 'B'];
export interface CedexGrid {
  rows: { code: string; thin?: boolean }[];
  cols: number;
}
export function cedexGrid(side: EeirDamageSide, length: ContainerLength = '40'): CedexGrid | null {
  const sideRows = [{ code: 'H', thin: true }, { code: 'T' }, { code: 'B' }, { code: 'G', thin: true }];
  if (side === 'D' || side === 'F') return { rows: sideRows, cols: 4 };
  if (side === 'L' || side === 'R') return { rows: sideRows, cols: length === '20' ? 5 : 10 };
  if (side === 'T' || side === 'U' || side === 'B') return { rows: [{ code: 'L' }, { code: 'R' }], cols: length === '20' ? 5 : 10 };
  return null; // E / I / N / X: vị trí cố định
}
const colDigit = (n: number) => String(n % 10); // cột 10 → 0
export function cedexLocation(side: EeirDamageSide, rows: string[], cols: number[]): string | null {
  if (!rows.length || !cols.length) return null;
  const row = new Set(rows).size === 1 ? rows[0] : 'X';
  const min = Math.min(...cols);
  const max = Math.max(...cols);
  return `${side}${row}${colDigit(min)}${max > min ? colDigit(max) : 'N'}`;
}
// Mã khớp lưới của mặt (không bắt buộc đúng số cột 20' / 40' vì Giám định chưa biết size)
const CEDEX_PATTERN: Partial<Record<EeirDamageSide, RegExp>> = {
  D: /^D[HTBGX][1-4][1-4N]$/,
  F: /^F[HTBGX][1-4][1-4N]$/,
  L: /^L[HTBGX][0-9][0-9N]$/,
  R: /^R[HTBGX][0-9][0-9N]$/,
  T: /^T[LRX][0-9][0-9N]$/,
  U: /^U[LRX][0-9][0-9N]$/,
  B: /^B[LRX][0-9][0-9N]$/,
};

// Remark hư gửi Báo giá (luồng DAMAGE cũ): "LT89 Móp"
export const surveyRemarks = (s: InspectionSurvey): string[] => s.damages.map((d) => `${d.location} ${typeLabel(d.damageType)}`);

// Chỗ hư bên thứ 3 còn thiếu gì (null = đủ) — dùng cho nút LƯU ở giao diện và kiểm tra khi lưu
export function damageItemProblem(d: Pick<InspectionDamageItem, 'side' | 'location' | 'damageType' | 'source' | 'photos' | 'description'>): string | null {
  if (!EEIR_DAMAGE_SIDES.some((s) => s.code === d.side)) return 'Chọn mặt container bị hư.';
  const loc = (d.location || '').trim().toUpperCase();
  const fixed = fixedDamageLocation(d.side);
  if (fixed && loc !== fixed) return `Mặt ${damageSideLabel(d.side)} có vị trí cố định ${fixed}.`;
  if (!/^[A-Z0-9]{4}$/.test(loc) || loc[0] !== d.side) return `Vị trí CEDEX phải 4 ký tự chữ / số, bắt đầu bằng ${d.side}.`;
  const pattern = CEDEX_PATTERN[d.side];
  if (pattern && !pattern.test(loc)) return `Vị trí ${loc} không đúng lưới ${damageSideLabel(d.side)} — chọn ô trên sơ đồ.`;
  if (!EEIR_DAMAGE_TYPES.some((t) => t.code === d.damageType)) return 'Chọn loại hư.';
  if (!EEIR_DAMAGE_SOURCES.some((t) => t.code === d.source)) return 'Chọn bên gây hư.';
  if ((d.description || '').length > DAMAGE_NOTE_MAX) return `Mô tả tối đa ${DAMAGE_NOTE_MAX} ký tự.`;
  const n = d.photos.filter(Boolean).length;
  if (n < DAMAGE_PHOTO_MIN) return 'Chụp ít nhất 1 ảnh chỗ hư.';
  if (n > DAMAGE_PHOTO_MAX) return `Tối đa ${DAMAGE_PHOTO_MAX} ảnh / chỗ hư.`;
  return null;
}

// Kiểm tra + chuẩn hóa (ảnh cửa cont đã chụp ở bước 1 → tính vào nhóm KHÔNG HƯ)
// hasDoorPhoto: Hạ vỏ có ảnh cửa cont tính vào nhóm KHÔNG HƯ; Nhập tàu không chụp ảnh cửa (DEC-156)
export function validateSurvey(s: InspectionSurvey | undefined, opts: { hasDoorPhoto?: boolean } = {}): InspectionSurvey {
  const door = opts.hasDoorPhoto === false ? 0 : 1;
  if (!s) throw new Error('Cont hãng Maersk: vui lòng ghi TÌNH TRẠNG theo eEIR (Không hư / Hao mòn / Hư do bên thứ 3).');
  if (!SURVEY_SIZES.includes(s.size || '')) throw new Error('Vui lòng chọn SIZE CONT (20 / 40 / 45) trước khi giám định.');
  const noDamagePhotos = (s.noDamagePhotos || []).filter(Boolean);
  const wearTearPhotos = (s.wearTearPhotos || []).filter(Boolean);
  if (noDamagePhotos.length + door > NO_DAMAGE_PHOTO_MAX) throw new Error(`KHÔNG HƯ: tối đa ${NO_DAMAGE_PHOTO_MAX} ảnh${door ? ' (tính cả ảnh cửa cont)' : ''}.`);
  if (wearTearPhotos.length > WEAR_TEAR_PHOTO_MAX) throw new Error(`HAO MÒN: tối đa ${WEAR_TEAR_PHOTO_MAX} ảnh.`);
  const damages = (s.damages || []).map((d) => {
    const problem = damageItemProblem(d);
    if (problem) throw new Error(`Hư bên thứ 3 (${d.location || damageSideLabel(d.side)}): ${problem}`);
    // Cont 20': vách / nóc / đáy / sàn chỉ có 5 ô (cột 1–5)
    const loc = d.location.trim().toUpperCase();
    if (s.size === '20' && SIZED_SIDES.includes(d.side) && ![loc[2], loc[3]].every((c) => c === 'N' || (c >= '1' && c <= '5'))) {
      throw new Error(`Hư bên thứ 3 (${loc}): cont 20' chỉ có 5 ô (cột 1–5).`);
    }
    const description = d.description?.trim();
    return { ...d, location: d.location.trim().toUpperCase(), photos: d.photos.filter(Boolean), description: description || undefined };
  });
  return { size: s.size, noDamagePhotos, wearTearPhotos, damages };
}
