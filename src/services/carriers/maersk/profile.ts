// ============================================================================
// HỒ SƠ HÃNG MAERSK — bật chức năng nào cho cont MSK (mỗi dòng gắn 1 quyết định trong docs/DECISIONS.md).
// ============================================================================
import type { CarrierProfile } from '../types';
import { MAERSK_CODECO } from './config';
import { isMaerskBooking, MAERSK_BOOKING_ERROR, MAERSK_LINE_CODES } from './rules';

export const MAERSK: CarrierProfile = {
  key: 'maersk',
  name: 'Maersk',
  lineCodes: MAERSK_LINE_CODES,
  features: {
    inspectionSurvey: true, // DEC-203
    releasePhoto: true, // DEC-198
  },
  bookingRule: { test: isMaerskBooking, message: MAERSK_BOOKING_ERROR }, // DEC-199
  // DEC-204: API 1 getEquipmentDetails — CHƯA CÓ KHÓA → chưa kết nối (bật khi có Edge Function + khóa staging)
  equipment: { label: 'Maersk eEIR (getEquipmentDetails)', connected: false },
  codeco: MAERSK_CODECO, // DEC-197
};
