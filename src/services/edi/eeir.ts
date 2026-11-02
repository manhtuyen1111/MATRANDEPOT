// ============================================================================
// eEIR MAERSK — CHẠY THỬ (tài liệu eEIR External API v4.3 — docs/EDI_MAERSK.md mục 12, 15, 18, 19). CHƯA GỬI Maersk.
// Phạm vi: chỉ cont hãng MSK loại KHÔ (DRY: DC / HC) — cont khác chưa tích hợp (người dùng 2026-10-30).
// Current Move (danh sách trên app eEIR thật — người dùng chốt 2026-11-01, Q-058):
//   Hạ vỏ (HV-)              → IN-EMPTY-IMPORT_RETURN  (moveStatus 1 IN,  moveType 2 IMP)
//   Nhập tàu (NT-)           → IN-EMPTY-POSITION       (1 IN,  1 POS)
//   Cấp vỏ theo booking (CV-) → OUT-EMPTY-EXPORT       (2 OUT, 3 EXP — booking bắt buộc)
//   Cấp sale (CV-)           → OUT-EMPTY-POSITION      (2 OUT, 1 POS — không cần booking)
//   Xuất tàu (XT-)           → OUT-EMPTY-POSITION      (2 OUT, 1 POS) — TẠM CHƯA GỬI (người dùng 2026-11-01: Xuất tàu chưa chụp ảnh)
export const EEIR_SEND_VESSEL_EXPORT = false;
// Hư hỏng (mục 6.1.2): không hư → 0000 / tpIndicator 0; hao mòn → 0000 / tpIndicator 3; bên thứ 3 → mã CEDEX + loại hư +
//   bên gây hư + 1–3 ảnh / chỗ hư — lấy từ Giám định Hạ vỏ (GateInOrder.survey — DEC-203).
// Hạng (Grade) lấy từ API 1 (smokeTested); chưa gọi được API 1 → "N" (đúng hướng dẫn tài liệu).
// JSON là KHUNG theo bảng trường v4.3 — chỉnh khi có file inspectionDetails mẫu (Q-056).
// ============================================================================
import type { DepotState } from '../depotStore';
import { containerIsoCode } from '../depotOperations';
import { isMaerskBooking, isMaerskLine, MAERSK_BOOKING_ERROR } from './maersk';
import type { InspectionSurvey } from '../../types/depot';

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

export type EeirSource = 'HA_VO' | 'NHAP_TAU' | 'CAP_VO' | 'CAP_SALE' | 'XUAT_TAU';
export const EEIR_SOURCE_LABELS: Record<EeirSource, string> = { HA_VO: 'Hạ vỏ', NHAP_TAU: 'Nhập tàu', CAP_VO: 'Cấp vỏ', CAP_SALE: 'Cấp sale', XUAT_TAU: 'Xuất tàu' };
export type EeirMoveType = 'POS' | 'IMP' | 'EXP';
const MOVE_TYPE_CODE: Record<EeirMoveType, number> = { POS: 1, IMP: 2, EXP: 3 };

// tpIndicator (6.1.2): 0 không hư • 2 bên thứ 3 • 3 hao mòn. Mỗi mục có ảnh riêng (không hư / hao mòn 1–20; bên thứ 3 1–3)
export interface EeirDamage {
  location: string;     // CEDEX 4 ký tự (bên thứ 3) — '0000' khi không hư / hao mòn
  tpIndicator: 0 | 2 | 3;
  damageType?: number;  // bên thứ 3 (DEC-203)
  source?: number;      // damageCarrierCode
  description?: string;
  photos: string[];
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
// Tên Current Move như app eEIR
const MOVE_NAME: Record<EeirMoveType, string> = { IMP: 'IMPORT_RETURN', EXP: 'EXPORT', POS: 'POSITION' };
export const eeirMoveLabel = (i: Pick<EeirInspection, 'moveStatus' | 'moveType'>) => `${i.moveStatus}-EMPTY-${i.moveType ? MOVE_NAME[i.moveType] : '?'}`;

const inRange = (at: string | undefined, from: Date, to: Date) => Boolean(at) && new Date(at!) >= from && new Date(at!) < to;
const truckOf = (no?: string) => (no || '').replace(/\s+/g, '').toUpperCase();
const GRADE_NOTE = 'Hạng (Grade) = N cho tới khi gọi được API 1 (smokeTested)';

// photos = nhóm ảnh chung (không hư / hao mòn, 1–20); damaged = cont DAMAGE chưa ghi hư theo eEIR (DEC-203)
function checks(problems: string[], containerNo: string, truck: string, photos: string[], damaged: boolean, noPhoto = 'Thiếu ảnh (eEIR bắt buộc ≥ 1 ảnh)') {
  if (!CONTAINER_NO_RE.test(containerNo)) problems.push('Số cont phải 4 chữ + 7 số');
  if (!truck) problems.push('Thiếu số xe');
  else if (truck.length > TRUCK_REG_MAX) problems.push(`Số xe quá ${TRUCK_REG_MAX} ký tự`);
  if (!photos.length) problems.push(noPhoto);
  else if (photos.length > EEIR_PHOTO_MAX) problems.push(`Quá ${EEIR_PHOTO_MAX} ảnh / phiếu`);
  if (damaged) problems.push('Cont hư chưa ghi tình trạng theo eEIR (Hao mòn / Bên thứ 3 + CEDEX — DEC-203)');
}

// DEC-203: nhóm ảnh chung (ảnh cửa nếu có + KHÔNG HƯ + HAO MÒN; có ảnh hao mòn → tpIndicator 3) + mỗi chỗ hư bên thứ 3 1 mục riêng
function surveyDamages(survey: InspectionSurvey | undefined, doorPhoto?: string): { general: string[]; damages: EeirDamage[] } {
  const general = [doorPhoto, ...(survey?.noDamagePhotos || []), ...(survey?.wearTearPhotos || [])].filter((x): x is string => Boolean(x));
  return {
    general,
    damages: [
      { location: '0000', tpIndicator: survey?.wearTearPhotos.length ? 3 : 0, photos: general },
      ...(survey?.damages || []).map((d) => ({ location: d.location, tpIndicator: 2 as const, damageType: d.damageType, source: d.source, description: d.description, photos: d.photos })),
    ],
  };
}

// Phiếu eEIR của các lượt cont Maersk DRY trong khoảng [from, to) — sắp theo giờ
export function eeirInspections(state: DepotState, range: { from: Date; to: Date }): EeirInspection[] {
  const { from, to } = range;
  const out: EeirInspection[] = [];

  // Gate-in: Hạ vỏ
  for (const c of state.containers) {
    if (!c.masterDossierCode.startsWith('HV-') || !isEeirContainer(c) || !inRange(c.gateInAt, from, to)) continue;
    const gi = state.gateInOrders.find((g) => g.masterDossierCode === c.masterDossierCode);
    const survey = gi?.survey;
    const { general, damages } = surveyDamages(survey, gi?.doorPhotoUrl);
    const truck = truckOf(gi?.truckNo || c.truckNo);
    const problems: string[] = [];
    if (c.conditionClass === 'W-SURVEY') problems.push('Chưa giám định (GIÁM ĐỊNH SAU)');
    checks(problems, c.containerNo, truck, general, c.conditionClass === 'DAMAGE' && !survey?.damages.length);
    out.push({
      key: `IN-${c.id}`, source: 'HA_VO', dossierCode: c.masterDossierCode, containerNo: c.containerNo, size: c.size, type: c.type,
      isoCode: containerIsoCode(state, c), moveStatus: 'IN', moveType: 'IMP', moveTypeConfirmed: true, at: c.gateInAt, bookingNo: '',
      grade: 'N', productionYear: c.manufactureYear, truckRegNo: truck, driverPhone: gi?.driverPhone || c.driverPhone,
      photos: damages.flatMap((d) => d.photos), damages, problems, notes: [GRADE_NOTE], // Hạ vỏ = IN-EMPTY-IMPORT_RETURN (app eEIR thật — Q-058)
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
    if (!sale && !isMaerskBooking(o.bookingNo)) problems.push(MAERSK_BOOKING_ERROR); // cấp sale (POSITION) không cần booking
    checks(problems, c.containerNo, truck, photos, damaged, 'Chưa có ảnh cấp vỏ của Giám định (DEC-198)');
    out.push({
      key: `OUT-${o.id}`, source: sale ? 'CAP_SALE' : 'CAP_VO', dossierCode: o.gateOutCode, containerNo: o.containerNo, size: c.size, type: c.type,
      isoCode: containerIsoCode(state, c), moveStatus: 'OUT', moveType: sale ? 'POS' : 'EXP', moveTypeConfirmed: true,
      at: o.releasePhotosAt || o.confirmedAt!, bookingNo: sale ? '' : o.bookingNo, grade: 'N', productionYear: c.manufactureYear,
      truckRegNo: truck, driverPhone: o.driverPhone, photos, damages: damaged ? [] : [{ location: '0000', tpIndicator: 0, photos }], problems, notes: [GRADE_NOTE],
    });
  }
  // Nhập tàu (IN-EMPTY-POSITION) / Xuất tàu (OUT-EMPTY-POSITION — tạm chưa gửi) — tình trạng Nhập tàu lấy từ VesselListItem.survey (DEC-203)
  for (const l of state.vesselLists || []) {
    if (l.mode === 'XUAT_TAU' && !EEIR_SEND_VESSEL_EXPORT) continue;
    for (const it of l.items) {
      const imp = l.mode === 'NHAP_TAU';
      const at = imp ? it.inspectedAt : it.status === 'DONE' ? it.doneAt : undefined;
      if (!inRange(at, from, to)) continue;
      const c = state.containers.find((x) => x.id === it.containerId);
      if (!c || !isEeirContainer(c)) continue;
      const { general, damages } = surveyDamages(imp ? it.survey : undefined);
      const truck = truckOf(it.truckNo);
      const problems: string[] = [];
      checks(problems, c.containerNo, truck, general, imp && it.conditionClass === 'DAMAGE' && !it.survey?.damages.length,
        imp ? 'Thiếu ảnh (eEIR bắt buộc ≥ 1 ảnh)' : 'Xuất tàu chưa chụp ảnh (eEIR bắt buộc ≥ 1 ảnh)');
      out.push({
        key: `${imp ? 'NT' : 'XT'}-${it.id}`, source: imp ? 'NHAP_TAU' : 'XUAT_TAU', dossierCode: it.dossierCode || c.masterDossierCode,
        containerNo: c.containerNo, size: c.size, type: c.type, isoCode: containerIsoCode(state, c), moveStatus: imp ? 'IN' : 'OUT',
        moveType: 'POS', moveTypeConfirmed: true, at: at!, bookingNo: '', grade: 'N', productionYear: c.manufactureYear, truckRegNo: truck,
        photos: damages.flatMap((d) => d.photos), damages, problems, notes: [GRADE_NOTE],
      });
    }
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
  // Tên ảnh đánh số liên tục qua mọi mục (trùng tên file đính kèm)
  let n = 0;
  const imagesOf = i.damages.map((d) => d.photos.map(() => ({ imageName: eeirImageName(i.containerNo, n++) })));
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
    // 6.1.2: bên thứ 3 thêm damageType, damageCarrierCode, panelIndicatorCode (chữ đầu vị trí), panelImageFilename (giá trị cố định)
    damages: i.damages.map((d, k) => ({
      damageLocation: d.location,
      tpIndicator: d.tpIndicator,
      isDamage: d.tpIndicator !== 0,
      ...(d.tpIndicator === 2
        ? { damageType: d.damageType, damageCarrierCode: d.source, panelIndicatorCode: d.location[0], panelImageFilename: 'D_sketch_DX24_1', ...(d.description ? { description: d.description } : {}) }
        : {}),
      images: imagesOf[k],
    })),
    truckers: { truckerRegno: i.truckRegNo, ...(i.driverPhone ? { truckerContactNo: i.driverPhone } : {}) },
    emails: cfg.emails.map((email) => ({ email, category: 'Shop' })),
  };
}
