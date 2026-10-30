// ============================================================================
// QUY TẮC RIÊNG CONT MAERSK (eEIR — docs/EDI_MAERSK.md mục 12, 15, 18). Mã hãng trong Danh mục: MSK.
//   DEC-198: chụp ảnh cấp vỏ • DEC-199: booking 9–11 chữ số • DEC-200: hư hỏng theo CEDEX
// Database khớp: release_photo_lines(), maersk_booking_ok() (migration 20261119000001, 20261120000001).
// ============================================================================

export const MAERSK_LINE_CODES = ['MSK'];
export const isMaerskLine = (lineCode?: string) => MAERSK_LINE_CODES.includes(lineCode || '');

// DEC-199: eEIR gate-out của Maersk chỉ nhận booking 9–11 chữ số
export const MAERSK_BOOKING_RE = /^\d{9,11}$/;
export const MAERSK_BOOKING_ERROR = 'Booking Maersk phải là 9–11 chữ số.';
export const isMaerskBooking = (bookingNo: string) => MAERSK_BOOKING_RE.test(bookingNo.trim());
