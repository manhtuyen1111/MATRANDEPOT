// ============================================================================
// QUY TẮC RIÊNG CONT MAERSK (eEIR — docs/EDI_MAERSK.md mục 12, 15, 18). Mã hãng trong Danh mục: MSK.
//   DEC-198: chụp ảnh cấp vỏ • DEC-199: booking 9–11 chữ số • DEC-200: hư hỏng theo CEDEX
// Database khớp: release_photo_lines(), maersk_booking_ok() (migration 20261119000001, 20261120000001).
// ============================================================================

export const MAERSK_LINE_CODES = ['MSK'];
export const isMaerskLine = (lineCode?: string) => MAERSK_LINE_CODES.includes(lineCode || '');

// DEC-199: eEIR gate-out của Maersk chỉ nhận booking 9–11 ký tự chữ / số (tài liệu v4.3 mục 6.1.1 — alphanumeric)
export const MAERSK_BOOKING_RE = /^[A-Z0-9]{9,11}$/;
export const MAERSK_BOOKING_ERROR = 'Booking Maersk phải gồm 9–11 ký tự chữ / số (không dấu cách, gạch).';
export const isMaerskBooking = (bookingNo: string) => MAERSK_BOOKING_RE.test(bookingNo.trim().toUpperCase());
