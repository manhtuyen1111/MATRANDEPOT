// ============================================================================
// CẤU HÌNH TÍCH HỢP MAERSK (không chứa khóa / mật khẩu — khóa API chỉ ở biến môi trường máy chủ).
//   CODECO: thông số file app cũ (docs/EDI_MAERSK.md 3.1, 3.5) • eEIR: mã shop + email nhận PDF (docs/EDI_MAERSK.md 19, 22)
// ============================================================================
import type { CodecoConfig } from '../standards/codeco';

// CODECO: cấu hình lấy từ file mẫu app cũ (docs/EDI_MAERSK.md 3.1, 3.5)
export const MAERSK_CODECO: CodecoConfig = {
  partnerCode: 'MSK',
  sender: 'VNHPHVI',
  receiver: 'MAEU',
  location: 'VNHPHVI',
  terminal: 'HPHVI',
  truckCarrier: 'HPHTRK',
  codeSet: 'LEGACY',
  legacySizeType: { '20DC': '2200', '40DC': '4200', '40HC': '4200', '45HC': '4500' },
  lineBreak: '\n',
};

export interface EeirConfig {
  depotCode: string;    // Shop trên PDF (3HY - MATRAN)
  surveyorId: string;   // client id eEIR của depot — điền ở máy chủ khi có khóa (không để trong code)
  emails: string[];     // email nhận PDF (Q-060) — cấu hình, không viết cứng
}
export const MAERSK_EEIR: EeirConfig = { depotCode: '3HY', surveyorId: '', emails: [] };
