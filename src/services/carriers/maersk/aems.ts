// ============================================================================
// BÁO GIÁ THEO AEMS MAERSK (DEC-207 — thiết kế docs/design/BAO_GIA_AEMS.md). Hàm THUẦN: kiểm tra + tính tiền 1 phiếu.
//   Dòng: Damage Code (MÃ HƯ HỎNG) • Repair Code (MÃ SỬA CHỮA, theo Mode) • Repair Loc code (CEDEX) • TPI W / T • Pcs •
//         Man Hrs/pc • Material cost/pc (mặc định từ mã sửa chữa) • Item Total = Pcs × Material cost/pc
//   Giờ công: sửa = Σ Pcs × Man Hrs • Preparation tự tính theo mã "PREPARATION - FOR TOTAL REPAIR TIME …" (khoảng giờ đọc từ
//   Repair Name: ≤ 2 → 0.1 • 2–8 → 0.2 • 8–24 → 0.3 • 24–40 → 0.5 • > 40 → 0.8 — bảng người dùng gửi 2026-11-02)
//   Tiền công = Ordinary Hours × đơn giá mã "Man hour rate" (DR001). VND, VAT 0. OT1–OT3: chưa dùng (cont khô).
// Database khớp: aems_quote_compute (migration 20261128000001) — cùng quy tắc.
// ============================================================================
import type { AemsQuote, AemsQuoteLine, AemsTpi, CedexCode, RepairCode } from '../../../types/depot';

export const AEMS_DEFAULT_MODE = '03';
export const AEMS_MODE_NAMES: Record<string, string> = { '03': 'REPAIRS, STEEL DRY CONTAINER IN SERVICE' }; // ảnh AEMS thật
export const AEMS_TPI_LABELS: Record<AemsTpi, string> = { W: 'W — Hao mòn', T: 'T — Bên thứ 3' };
export const AEMS_REMARK_MAX = 255;
export const AEMS_CAUSE_WEAR = '1 - Wear And Tear';
export const AEMS_CAUSE_THIRD_PARTY = 'Third Party';
export const AEMS_LOC_RE = /^[A-Z0-9]{4}$/;

const r2 = (n: number) => Math.round(n * 100) / 100;
const up = (v?: string) => (v || '').trim().toUpperCase();

export const isLaborRateCode = (c: Pick<RepairCode, 'repairName'>) => /man\s*hour\s*rate/i.test(c.repairName);
export const isPreparationCode = (c: Pick<RepairCode, 'repairName'>) => /^\s*preparation\b/i.test(c.repairName);

// Khoảng giờ trong tên mã PREPARATION: (min, max] — "LESS THAN OR EQUAL TO 2" → (−∞, 2]; "BETWEEN 2 & 8" → (2, 8]; "EXCEEDING 40" → (40, ∞)
export function preparationRange(name: string): { min: number; max: number } | null {
  const n = '(\\d+(?:\\.\\d+)?)';
  let m = new RegExp(`(?:less than or equal to|up to|not exceeding)\\s*${n}`, 'i').exec(name);
  if (m) return { min: -Infinity, max: Number(m[1]) };
  m = new RegExp(`between\\s*${n}\\s*(?:&|and|-|to)\\s*${n}`, 'i').exec(name);
  if (m) return { min: Number(m[1]), max: Number(m[2]) };
  m = new RegExp(`(?:exceeding|more than|over|above)\\s*${n}`, 'i').exec(name);
  if (m) return { min: Number(m[1]), max: Infinity };
  return null;
}

export interface AemsCatalog {
  repairCodes: RepairCode[]; // của hãng, đang dùng
  damageCodes: CedexCode[];  // MÃ HƯ HỎNG của hãng, đang dùng
}
export const aemsCatalogOf = (state: { repairCodes?: RepairCode[]; cedexCodes?: CedexCode[] }, line: string): AemsCatalog => ({
  repairCodes: (state.repairCodes || []).filter((c) => c.shippingLineCode === line && c.isActive),
  damageCodes: (state.cedexCodes || []).filter((c) => c.shippingLineCode === line && c.kind === 'DAMAGE' && c.isActive),
});

export const aemsLaborRate = (cat: AemsCatalog) => cat.repairCodes.find(isLaborRateCode)?.materialRate;

// Giờ chuẩn bị theo tổng giờ sửa (0 khi chưa có giờ sửa)
export function aemsPreparation(cat: AemsCatalog, repairHours: number): number {
  if (!(repairHours > 0)) return 0;
  for (const c of cat.repairCodes.filter(isPreparationCode)) {
    const range = preparationRange(c.repairName);
    if (range && repairHours > range.min && repairHours <= range.max) return c.manHour;
  }
  return 0;
}

// Mã sửa chữa theo Repair Code + Mode (bỏ mã giờ công / chuẩn bị — tự tính)
export const findRepairCode = (cat: AemsCatalog, repairCode: string, mode: string) =>
  cat.repairCodes.find((c) => c.repairCode === up(repairCode) && c.repairMode === up(mode) && !isLaborRateCode(c) && !isPreparationCode(c));

export const aemsCause = (lines: Pick<AemsQuoteLine, 'tpi'>[]) => (lines.some((l) => l.tpi === 'T') ? AEMS_CAUSE_THIRD_PARTY : AEMS_CAUSE_WEAR);

export type AemsLineInput = Pick<AemsQuoteLine, 'damageCode' | 'repairCode' | 'locCode' | 'tpi' | 'pcs'> & {
  id?: string;
  manHours?: number | null;     // trống → Fixed man hour của mã sửa chữa
  materialCost?: number | null; // trống → Material Rate
};
export type AemsQuoteInput = { mode?: string; remark?: string; lines: AemsLineInput[] };
export type AemsComputed = Omit<AemsQuote, 'approval' | 'approvalAt' | 'approvalBy' | 'workOrderNo' | 'savedAt' | 'savedBy'>;

const isAmount = (n: number) => Number.isFinite(n) && n >= 0 && Math.abs(r2(n) - n) < 1e-9;

// Kiểm tra + tính toàn bộ phiếu. Lỗi → throw (thông báo tiếng Việt, kèm số dòng)
export function computeAemsQuote(cat: AemsCatalog, input: AemsQuoteInput, newId: () => string): AemsComputed {
  const mode = up(input.mode) || AEMS_DEFAULT_MODE;
  const laborRate = aemsLaborRate(cat);
  if (laborRate === undefined) throw new Error('Danh mục CODE CEDEX chưa có mã đơn giá giờ công ("Man hour rate…") — Admin nhập MÃ SỬA CHỮA trước.');
  if (!input.lines.length) throw new Error('Phiếu báo giá cần ít nhất 1 dòng sửa chữa.');
  const remark = (input.remark || '').trim();
  if (remark.length > AEMS_REMARK_MAX) throw new Error(`Ghi chú tối đa ${AEMS_REMARK_MAX} ký tự.`);
  const lines: AemsQuoteLine[] = input.lines.map((l, i) => {
    const at = `Dòng ${i + 1}`;
    const damageCode = up(l.damageCode);
    if (!damageCode) throw new Error(`${at}: chọn Damage Code.`);
    if (!cat.damageCodes.some((d) => d.code === damageCode)) throw new Error(`${at}: Damage Code ${damageCode} không có trong Danh mục CODE CEDEX (MÃ HƯ HỎNG).`);
    if (!up(l.repairCode)) throw new Error(`${at}: chọn Repair Code.`);
    const code = findRepairCode(cat, l.repairCode, mode);
    if (!code) throw new Error(`${at}: Repair Code ${up(l.repairCode)} (Mode ${mode}) không có trong Danh mục MÃ SỬA CHỮA.`);
    const locCode = up(l.locCode);
    if (!AEMS_LOC_RE.test(locCode)) throw new Error(`${at}: Repair Loc code phải 4 ký tự chữ / số (VD BR5N, IXXX).`);
    if (l.tpi !== 'W' && l.tpi !== 'T') throw new Error(`${at}: chọn TPI (W hao mòn / T bên thứ 3).`);
    const pcs = Number(l.pcs);
    if (!Number.isInteger(pcs) || pcs < 1) throw new Error(`${at}: Pcs là số nguyên ≥ 1.`);
    if (code.maxQty != null && pcs > code.maxQty) throw new Error(`${at}: Repair Code ${code.repairCode} tối đa ${code.maxQty} / work order.`);
    const manHours = l.manHours == null || (l.manHours as unknown) === '' ? code.manHour : Number(l.manHours);
    const materialCost = l.materialCost == null || (l.materialCost as unknown) === '' ? code.materialRate : Number(l.materialCost);
    if (!isAmount(manHours)) throw new Error(`${at}: Man Hrs/pc là số ≥ 0, tối đa 2 số lẻ.`);
    if (!isAmount(materialCost)) throw new Error(`${at}: Material cost/pc là số ≥ 0, tối đa 2 số lẻ.`);
    return { id: l.id || newId(), damageCode, repairCode: code.repairCode, locCode, tpi: l.tpi, pcs, manHours, materialCost, itemTotal: r2(pcs * materialCost) };
  });
  const repairHours = r2(lines.reduce((s, l) => s + l.pcs * l.manHours, 0));
  const preparationHours = aemsPreparation(cat, repairHours);
  const totalHours = r2(repairHours + preparationHours);
  if (!(totalHours > 0)) throw new Error('Tổng giờ công phải lớn hơn 0 (kiểm tra Man Hrs/pc).');
  if (totalHours > 1000) throw new Error('Tổng giờ công tối đa 1000.');
  const laborCost = r2(totalHours * laborRate);
  const materialCost = r2(lines.reduce((s, l) => s + l.itemTotal, 0));
  const sumTpi = (t: AemsTpi) => r2(lines.filter((l) => l.tpi === t).reduce((s, l) => s + l.itemTotal, 0));
  const totalExclVat = r2(laborCost + materialCost);
  return {
    mode, cause: aemsCause(lines), remark: remark || undefined, lines,
    repairHours, preparationHours, totalHours, laborRate, laborCost, materialCost,
    wearTearTotal: sumTpi('W'), thirdPartyTotal: sumTpi('T'), totalExclVat, totalInclVat: totalExclVat,
  };
}

// Tóm tắt dòng cho TÌNH TRẠNG SỬA CHỮA (Sửa chữa / hồ sơ / báo cáo dùng như trước): "BR5N CU 6620 ×1 (T)"
export const aemsLineText = (l: Pick<AemsQuoteLine, 'locCode' | 'damageCode' | 'repairCode' | 'pcs' | 'tpi'>) =>
  `${l.locCode} ${l.damageCode} ${l.repairCode} ×${l.pcs} (${l.tpi})`;
