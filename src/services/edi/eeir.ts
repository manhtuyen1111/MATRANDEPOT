// ============================================================================
// eEIR MAERSK — CHẠY THỬ (tài liệu eEIR External API v4.3 — docs/EDI_MAERSK.md mục 12, 15, 18, 19). CHƯA GỬI Maersk.
// Phạm vi: chỉ cont hãng MSK loại KHÔ (DRY: DC / HC) — cont khác chưa tích hợp (người dùng 2026-10-30).
//   Gate-in : Hạ vỏ (HV-)                → moveStatus 1 IN,  moveType 2 IMP (dự đoán — Q-058)
//   Gate-out: Cấp vỏ theo booking (CV-)   → moveStatus 2 OUT, moveType 3 EXP (xác nhận từ PDF mẫu OUT-EMPTY-EXP)
//             Cấp sale                   → chờ Maersk (Q-058)
// Hư hỏng (mục 6.1.2): không hư → 0000 / tpIndicator 0; hao mòn → 0000 / tpIndicator 3; bên thứ 3 → mã CEDEX + loại hư +
//   bên gây hư + 1–3 ảnh / chỗ hư (DEC-200 — chưa có màn nhập → cont DAMAGE báo thiếu).
// Hạng (Grade) lấy từ API 1 (smokeTested); chưa gọi được API 1 → "N" (đúng hướng dẫn tài liệu).
// Chưa đưa: Nhập tàu / Xuất tàu (Q-065). JSON là KHUNG theo bảng trường v4.3 — chỉnh khi có file inspectionDetails mẫu (Q-056).
// ============================================================================
import type { DepotState } from '../depotStore';
import { containerIsoCode } from '../depotOperations';
import { isMaerskBooking, isMaerskLine, MAERSK_BOOKING_ERROR } from './maersk';

export interface EeirConfig {
  depotCode: string;    // Shop trên PDF (3HY - MATRAN)
  surveyorId: string;   // client id eEIR của depot — điền ở máy chủ khi có khóa (không để trong code)
  emails: string[];     // email nhận PDF (Q-060) — cấu hình, không viết cứng
}
export const MAERSK_EEIR: EeirConfig = { depotCode: '3HY', surveyorId: '', emails: [] };

// Loại cont theo Maersk (equipmentSubType). Hiện chỉ tích hợp DRY.
const SUB_TYPE: Record<string, string> = { DC: 'DRY', HC: 'DRY', RF: 'REEF', RH: 'REEF', OT: 'OPEN', FR: 'FLAT' };
export const EEIR_SUB_TYPES = ['DRY'];
export const eeirSubType = (type: string) => SUB_TYPE[type] || '';
export const isEeirContainer = (c: { shippingLineCode?: string; type: string }) => isMaerskLine(c.shippingLineCode) && EEIR_SUB_TYPES.includes(eeirSubType(c.type));

export type EeirSource = 'HA_VO' | 'CAP_VO' | 'CAP_SALE';
export const EEIR_SOURCE_LABELS: Record<EeirSource, string> = { HA_VO: 'Hạ vỏ', CAP_VO: 'Cấp vỏ', CAP_SALE: 'Cấp sale' };
export type EeirMoveType = 'POS' | 'IMP' | 'EXP';
const MOVE_TYPE_CODE: Record<EeirMoveType, number> = { POS: 1, IMP: 2, EXP: 3 };

// tpIndicator (6.1.2): 0 không hư • 2 bên thứ 3 • 3 hao mòn
export interface EeirDamage {
  location: string;     // CEDEX 4 ký tự (bên thứ 3) — '0000' khi không hư / hao mòn
  tpIndicator: 0 | 2 | 3;
  note: string;
}

export interface EeirInspection {
  key: string;
  source: EeirSource;
  dossierCode: string;
  containerNo: string;
  size: string;
  type: string;
  isoCode: string;
  moveStatus: 'IN' | 'OUT';
  moveType: EeirMoveType | '';
  moveTypeConfirmed: boolean;
  at: string;             // giờ kiểm tra (ISO)
  bookingNo: string;
  grade: string;
  productionYear?: number;
  truckRegNo: string;
  driverPhone?: string;
  photos: string[];
  damages: EeirDamage[];
  problems: string[];     // thiếu dữ liệu → chưa gửi được
  notes: string[];        // lưu ý, không chặn
}

export const TRUCK_REG_MAX = 11;
export const EEIR_PHOTO_MAX = 20; // không hư / hao mòn: 1–20 ảnh
export const CONTAINER_NO_RE = /^[A-Z]{4}\d{7}$/;

// containerSize + equipmentSubType + " " + ISO (VD 40DRY 45G1); không rõ → 99XXX 99X9
export function eeirTypeSize(i: Pick<EeirInspection, 'size' | 'type' | 'isoCode'>): string {
  const sub = eeirSubType(i.type);
  return sub && i.isoCode ? `${i.size}${sub} ${i.isoCode}` : '99XXX 99X9';
}
export const eeirMoveLabel = (i: Pick<EeirInspection, 'moveStatus' | 'moveType'>) => `${i.moveStatus}-EMPTY-${i.moveType || '?'}`;

const inRange = (at: string | undefined, from: Date, to: Date) => Boolean(at) && new Date(at!) >= from && new Date(at!) < to;
const truckOf = (no?: string) => (no || '').replace(/\s+/g, '').toUpperCase();
const NO_DAMAGE: EeirDamage = { location: '0000', tpIndicator: 0, note: 'Không hư' };
const GRADE_NOTE = 'Hạng (Grade) = N cho tới khi gọi được API 1 (smokeTested)';

function checks(problems: string[], containerNo: string, truck: string, photos: string[], damaged: boolean, noPhoto = 'Thiếu ảnh (eEIR bắt buộc ≥ 1 ảnh)') {
  if (!CONTAINER_NO_RE.test(containerNo)) problems.push('Số cont phải 4 chữ + 7 số');
  if (!truck) problems.push('Thiếu số xe');
  else if (truck.length > TRUCK_REG_MAX) problems.push(`Số xe quá ${TRUCK_REG_MAX} ký tự`);
  if (!photos.length) problems.push(noPhoto);
  else if (photos.length > EEIR_PHOTO_MAX) problems.push(`Quá ${EEIR_PHOTO_MAX} ảnh / phiếu`);
  if (damaged) problems.push('Cont hư: chưa phân loại Hao mòn / Bên thứ 3 + mã CEDEX (DEC-200)');
}

// Phiếu eEIR của các lượt cont Maersk DRY trong khoảng [from, to) — sắp theo giờ
export function eeirInspections(state: DepotState, range: { from: Date; to: Date }): EeirInspection[] {
  const { from, to } = range;
  const out: EeirInspection[] = [];

  // Gate-in: Hạ vỏ
  for (const c of state.containers) {
    if (!c.masterDossierCode.startsWith('HV-') || !isEeirContainer(c) || !inRange(c.gateInAt, from, to)) continue;
    const gi = state.gateInOrders.find((g) => g.masterDossierCode === c.masterDossierCode);
    const photos = gi?.doorPhotoUrl ? [gi.doorPhotoUrl] : [];
    const truck = truckOf(gi?.truckNo || c.truckNo);
    const damaged = c.conditionClass === 'DAMAGE';
    const problems: string[] = [];
    if (c.conditionClass === 'W-SURVEY') problems.push('Chưa giám định (W-SURVEY)');
    checks(problems, c.containerNo, truck, photos, damaged);
    out.push({
      key: `IN-${c.id}`, source: 'HA_VO', dossierCode: c.masterDossierCode, containerNo: c.containerNo, size: c.size, type: c.type,
      isoCode: containerIsoCode(state, c), moveStatus: 'IN', moveType: 'IMP', moveTypeConfirmed: false, at: c.gateInAt, bookingNo: '',
      grade: 'N', productionYear: c.manufactureYear, truckRegNo: truck, driverPhone: gi?.driverPhone || c.driverPhone, photos,
      damages: damaged ? [] : [NO_DAMAGE], problems, notes: ['moveType IMP chưa được Maersk xác nhận (Q-058)', GRADE_NOTE],
    });
  }

  // Gate-out: Cấp vỏ / Cấp sale (Xe nâng đã cấp ra)
  for (const o of state.gateOutOrders) {
    if (o.status !== 'GATE_OUT_OK' || !inRange(o.confirmedAt, from, to)) continue;
    const c = state.containers.find((x) => x.masterDossierCode === o.masterDossierCode && x.containerNo === o.containerNo);
    if (!c || !isEeirContainer(c)) continue;
    const sale = o.releasePurpose === 'SALE';
    const photos = o.releasePhotoContainerNo === o.containerNo ? o.releasePhotos || [] : [];
    const truck = truckOf(o.truckNo);
    const damaged = c.conditionClass === 'DAMAGE';
    const problems: string[] = [];
    if (sale) problems.push('Cấp sale: chờ Maersk xác nhận moveType / booking (Q-058)');
    else if (!isMaerskBooking(o.bookingNo)) problems.push(MAERSK_BOOKING_ERROR);
    checks(problems, c.containerNo, truck, photos, damaged, 'Chưa có ảnh cấp vỏ của Giám định (DEC-198)');
    out.push({
      key: `OUT-${o.id}`, source: sale ? 'CAP_SALE' : 'CAP_VO', dossierCode: o.gateOutCode, containerNo: o.containerNo, size: c.size, type: c.type,
      isoCode: containerIsoCode(state, c), moveStatus: 'OUT', moveType: sale ? '' : 'EXP', moveTypeConfirmed: !sale,
      at: o.releasePhotosAt || o.confirmedAt!, bookingNo: sale ? '' : o.bookingNo, grade: 'N', productionYear: c.manufactureYear,
      truckRegNo: truck, driverPhone: o.driverPhone, photos, damages: damaged ? [] : [NO_DAMAGE], problems, notes: [GRADE_NOTE],
    });
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

// Lưu ý cấu hình chung (không theo từng phiếu)
export function eeirConfigProblems(cfg: EeirConfig = MAERSK_EEIR): string[] {
  const p: string[] = [];
  if (!cfg.surveyorId) p.push('Chưa có khóa eEIR (client id) — xin eEIRSupport@maersk.com (Q-056)');
  if (!cfg.emails.length) p.push('Chưa cấu hình email nhận PDF eEIR (Q-060)');
  return p;
}

// Giờ Việt Nam "YYYY-MM-DD HH:MM:SS" / giờ UTC "yyyy-MM-ddTHH:mm:ssZ"
const pad = (n: number) => String(n).padStart(2, '0');
export function eeirLocalDate(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 7 * 3600 * 1000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}
const eeirUtcDate = (iso: string) => new Date(iso).toISOString().replace(/\.\d{3}Z$/, 'Z');

// Tên ảnh: chữ / số / gạch dưới, không đuôi file — phải trùng tên file đính kèm (6.1.3)
export const eeirImageName = (containerNo: string, n: number) => `${containerNo}_${n + 1}`;

// `inspectionDetails` gửi kèm ảnh (multipart/form-data) — theo bảng trường v4.3 mục 6.1
export function eeirInspectionDetails(i: EeirInspection, cfg: EeirConfig = MAERSK_EEIR) {
  const images = i.photos.map((_, n) => ({ imageName: eeirImageName(i.containerNo, n) }));
  const local = eeirLocalDate(i.at);
  return {
    createdLocalDate: local,
    createdUtcDate: eeirUtcDate(i.at),
    submittedLocalDate: local, // tài liệu: dùng createdLocalDate
    comments: '',
    user: { surveyorId: cfg.surveyorId || '<CHƯA CÓ KHÓA>' },
    container: {
      containerStatus: 1, // 1 rỗng
      operator: 1, // 1 Maersk
      moveType: i.moveType ? MOVE_TYPE_CODE[i.moveType] : null,
      moveStatus: i.moveStatus === 'IN' ? 1 : 2,
      fgStatus: 1, // tài liệu: luôn 1
      containerTypeSize: eeirTypeSize(i),
      ...(i.bookingNo ? { bookingNo: i.bookingNo } : {}),
      grade: i.grade,
      containerNo: i.containerNo,
      ...(i.productionYear ? { productionYear: i.productionYear } : {}),
      stSound: 'Y', // tài liệu: luôn Y
      damage: null, // tài liệu: luôn null
    },
    damages: i.damages.map((d) => ({ damageLocation: d.location, tpIndicator: d.tpIndicator, isDamage: d.tpIndicator !== 0, images })),
    truckers: { truckerRegno: i.truckRegNo, ...(i.driverPhone ? { truckerContactNo: i.driverPhone } : {}) },
    emails: cfg.emails.map((email) => ({ email, category: 'Shop' })),
  };
}
