// ============================================================================
// HỒ SƠ HÃNG TÀU (CarrierProfile) — 1 hãng = 1 thư mục src/services/carriers/<hãng>/ + 1 hồ sơ đăng ký ở registry.ts.
// Nghiệp vụ chung (Giám định, Cấp vỏ, ảnh cấp vỏ, EDI…) KHÔNG kiểm tra cứng mã hãng — chỉ hỏi registry:
//   carrierUses(line, 'inspectionSurvey'), carrierBookingProblem(line, booking), carrierOf(line)?.equipment …
// Thêm hãng mới: docs/PROJECT_STRUCTURE.md mục 6.
// ============================================================================
import type { CodecoConfig } from './standards/codeco';

// Chức năng bật theo hãng (mỗi chức năng gắn 1 quyết định trong docs/DECISIONS.md)
export interface CarrierFeatures {
  inspectionSurvey: boolean; // DEC-203: Giám định theo form eEIR (Không hư / Hao mòn / Hư bên thứ 3 + CEDEX)
  releasePhoto: boolean;     // DEC-198: Giám định chụp ảnh cấp vỏ trước khi trả chứng từ
  aemsQuotation: boolean;    // DEC-207: Báo giá theo AEMS (dòng Damage / Repair / Loc / TPI…), chờ hãng duyệt mới sửa
}

// Kiểm tra số booking riêng của hãng (DEC-199) — null = hợp lệ
export interface BookingRule {
  test: (bookingNo: string) => boolean;
  message: string;
}

// Thông tin cont từ API hãng (DEC-204). connected = đã có khóa ở máy chủ; fetch gọi qua Edge Function (không đặt khóa ở frontend)
export interface EquipmentInfo {
  size?: string;
  type?: string;
  isoCode?: string;
  manufactureYear?: number;
  grade?: string; // hạng vỏ hãng trả về — dùng làm mã PHÂN LOẠI nếu có trong Danh mục (DEC-166)
}
export type EquipmentLookup =
  | { status: 'OK'; info: EquipmentInfo }
  | { status: 'NOT_CONNECTED' | 'NOT_FOUND' | 'ERROR'; message: string };
export interface EquipmentSource {
  label: string;
  connected: boolean;
  fetch?: (containerNo: string) => Promise<EquipmentLookup>;
}

export interface CarrierProfile {
  key: string;            // tên thư mục (maersk)
  name: string;           // tên hiển thị
  lineCodes: string[];    // mã hãng tàu trong Danh mục chung (MSK…) — database khớp: maersk_line_codes(), release_photo_lines()
  features: CarrierFeatures;
  bookingRule?: BookingRule;
  equipment?: EquipmentSource;
  codeco?: CodecoConfig;  // EDI CODECO (DEC-197) — chuẩn chung standards/codeco.ts + cấu hình riêng hãng
}
