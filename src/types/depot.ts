// ============================================================================
// MATRAN DEPOT ERP — CORE TYPES & BUSINESS ENUMS
// Đồng bộ 100% với quy trình thực tế từng bộ phận đã xác nhận
// ============================================================================

export type AppRole =
  | 'ADMIN'
  | 'MANAGER'
  | 'OFFICE'
  | 'GATE_STAFF'
  | 'YARD_STAFF'
  | 'FORKLIFT'
  | 'CLEANING'
  | 'INSPECTOR'
  | 'REPAIR_STAFF'
  | 'ACCOUNTANT';

export const ROLE_LABELS: Record<AppRole, string> = {
  ADMIN: 'Quản trị hệ thống',
  MANAGER: 'Quản lý bãi',
  OFFICE: 'Bộ phận Văn phòng',
  GATE_STAFF: 'Nhân viên cổng',
  YARD_STAFF: 'Nhân viên hiện trường',
  FORKLIFT: 'Bộ phận Xe nâng',
  CLEANING: 'Bộ phận Vệ sinh',
  INSPECTOR: 'Bộ phận Giám định / Báo giá',
  REPAIR_STAFF: 'Bộ phận Sửa chữa',
  ACCOUNTANT: 'Bộ phận Kế toán',
};

// Cấu trúc Menu Tác Nghiệp Bên Trái đã xác nhận
export type WorkspaceMenuId =
  | 'TON_VO'
  | 'DANH_MUC_CHUNG'
  | 'BAO_CAO'
  | 'VP_HA_VO'
  | 'VP_CAP_VO'
  | 'VP_NHAP_TAU'
  | 'VP_XUAT_TAU'
  | 'GD_HA_VO'
  | 'VS_CHO_VE_SINH'
  | 'XN_CHO_HA_VO'
  | 'XN_CHO_CAP_VO'
  | 'XN_DAO_CHUYEN_SUA_CHUA'
  | 'XN_DAO_CHUYEN_KE_GD'
  | 'BG_CHO_BAO_GIA'
  | 'SC_CHO_SUA_CHUA';

export type GateInType = 'CUSTOMER_RETURN' | 'VESSEL_IMPORT';

export const GATE_IN_TYPE_LABELS: Record<GateInType, string> = {
  CUSTOMER_RETURN: 'Khách trả rỗng theo lệnh hãng tàu (HẠ VỎ)',
  VESSEL_IMPORT: 'NHẬP TÀU (Xe kéo bãi từ cảng về)',
};

export type GateOutType = 'EMPTY_RELEASE' | 'VESSEL_EXPORT' | 'SPECIAL_RETURN';

export const GATE_OUT_TYPE_LABELS: Record<GateOutType, string> = {
  EMPTY_RELEASE: 'CẤP VỎ theo lệnh hãng tàu',
  VESSEL_EXPORT: 'XUẤT TÀU (Đưa container ra cảng)',
  SPECIAL_RETURN: 'Trả container theo lệnh riêng',
};

// Phân loại Giám định Hạ vỏ đã xác nhận
export type FieldConditionClass = 'DAMAGE' | 'AV';
export type FieldStuffingClass = 'M' | 'K' | 'E';

export type FieldCleaningItem =
  | 'KHÔNG VỆ SINH'
  | 'WP - QUÉT'
  | 'WW - RỬA NƯỚC'
  | 'CC - HÓA CHẤT'
  | 'RM - NHỔ ĐINH'
  | 'ML - BÓC TEM';

export const CLEANING_ITEM_OPTIONS: FieldCleaningItem[] = [
  'KHÔNG VỆ SINH',
  'WP - QUÉT',
  'WW - RỬA NƯỚC',
  'CC - HÓA CHẤT',
  'RM - NHỔ ĐINH',
  'ML - BÓC TEM',
];

export const DAMAGE_QUICK_SUGGESTIONS: string[] = [
  'Móp vách',
  'Thủng vách/nóc',
  'Hư sàn/xước sàn',
  'Cong đà/khung',
  'Hỏng cửa/gioăng/khóa',
  'Rỉ sét nặng',
  'Bẩn dầu/hóa chất',
];

export type ContainerSize = string; // Mặc định: '20' | '40' | '45' (Cấu hình trong DANH MỤC CHUNG)
export type ContainerType = string; // Mặc định: 'DC' | 'HC' | 'OT' | 'FR' | 'RF' (Cấu hình trong DANH MỤC CHUNG)

export type FeeTariffCategory =
  | 'NANG_HA'      // NÂNG HẠ (theo từng Size - Type - Hãng tàu)
  | 'THU_GOM_RAC'  // THU GOM RÁC
  | 'KHAC';        // BIỂU GIÁ KHÁC (Vệ sinh / Dịch vụ bãi)

// Danh mục BIỂU GIÁ / HẠNG MỤC CHI PHÍ (chung) của bãi — Đơn giá đã BAO GỒM VAT (Chỉ Admin cấu hình)
export interface DepotFeeCatalogItem {
  id: string;
  code: string;
  name: string;
  category?: FeeTariffCategory;
  size?: ContainerSize;
  type?: ContainerType;
  shippingLineCode?: string;
  defaultAmountInclVat: number;
}

// Dòng chi phí chi tiết của từng hồ sơ (Đã BAO GỒM VAT)
export interface FeeLineItem {
  id: string;
  catalogCode: string;
  name: string;
  amountInclVat: number;
}

// 3 loại thanh toán đã xác nhận (DEC-004)
export type PaymentCategory =
  | 'TTT'   // THANH TOÁN TRƯỚC (Phiếu thu mẹ + Quét mã QR trừ dần)
  | 'TTS'   // THANH TOÁN SAU (Kiểm tra nguồn + Note ở chứng từ là TTS)
  | 'TTTT'; // THANH TOÁN TRỰC TIẾP (Chuyển khoản API / Tiền mặt)

export type DirectPaymentMethod = 'BANK_TRANSFER_API' | 'CASH';

export type GateInStatus =
  | 'FIELD_RECORDED'  // Giám định đã chụp ảnh cửa cont & xác nhận tác nghiệp sang Văn phòng
  | 'OFFICE_VERIFIED' // Văn phòng đã kiểm tra lệnh/chứng từ & bổ sung thông tin
  | 'PAYMENT_PENDING' // Đã tạo yêu cầu thanh toán (chưa hoàn tất thu tiền)
  | 'GATE_IN_OK'      // Đã xác nhận thanh toán hợp lệ -> GATE IN OK & In phiếu K80 có QR
  | 'CANCELLED';

export type ContainerStatus =
  | 'PENDING_GATE_IN'   // Đang làm thủ tục Hạ vỏ
  | 'WAITING_PLACEMENT' // Đã GATE IN OK, đang ở hàng chờ XE NÂNG - CHỜ HẠ VỎ
  | 'IN_YARD'           // Đang tồn bãi
  | 'ALLOCATED'         // Đã lập lệnh CẤP VỎ & khóa phân bổ, đang ở XE NÂNG - CHỜ CẤP VỎ
  | 'GATED_OUT';        // Đã xuất khỏi bãi

export interface StaffUser {
  id: string;
  staffCode: string;
  fullName: string;
  email: string;
  roles: AppRole[];
  isActive: boolean;
}

export interface Partner {
  id: string;
  code: string;
  name: string;
  isShippingLine: boolean;
  isCustomer: boolean;
  allowTts: boolean;
}

export interface YardBlock {
  blockCode: string;
  blockName: string;
  maxBay: number;
  maxRow: number;
  maxTier: number;
  capacity: number;
  description: string;
}

// Dữ liệu in Phiếu TÁC NGHIỆP NỘI BỘ khổ K80 (80mm) kèm Mã QR
export interface K80InternalTicket {
  ticketCode: string;
  masterDossierCode: string; // MÃ HỒ SƠ CHÍNH khởi tạo từ Giám định xuyên suốt vòng đời cont
  qrCode: string; // Mã QR in trên phiếu K80 để các bộ phận quét xác nhận hoàn thành
  operationMode: 'HA_VO' | 'CAP_VO';
  isPaid: boolean; // TRẠNG THÁI THANH TOÁN: TÍCH (true) HOẶC X (false)
  paymentLabel: string;
  containerNo: string;
  size: ContainerSize;
  type: ContainerType;
  conditionClass: FieldConditionClass; // DAMAGE / AV
  damageRemarks?: string[];
  stuffingClass: FieldStuffingClass;   // M / K / E
  cleaningItems: FieldCleaningItem[];
  manufactureYear?: number;            // AGE (Năm sinh cont)
  truckNo?: string;
  customerRep?: string;
  targetBlock?: string;
  issuedAt: string;
  issuedBy: string;
}

export interface ContainerRecord {
  id: string;
  masterDossierCode: string; // MÃ HỒ SƠ CHÍNH khởi tạo từ bộ phận GIÁM ĐỊNH xuyên suốt đến khi OUT khỏi bãi
  containerNo: string;
  size: ContainerSize;
  type: ContainerType;
  manufactureYear: number; // AGE: 2001, 2002...
  shippingLineCode: string;
  customerRep: string;
  status: ContainerStatus;
  conditionClass: FieldConditionClass; // DAMAGE / AV (Chỉ AV mới vào danh sách sẵn sàng CẤP VỎ)
  damageRemarks: string[];
  stuffingClass: FieldStuffingClass;   // M / K / E
  cleaningItems: FieldCleaningItem[];
  // Mã QR tác nghiệp nội bộ K80 hiện hành của container
  activeQrCode: string;
  isPaid: boolean;
  // Vị trí hiện tại (DEC-005): Block không độc quyền; Bay/Row/Tier độc quyền theo ô
  currentBlock: string | null;
  currentBay: string | null;
  currentRow: string | null;
  currentTier: string | null;
  // Hàng chờ công việc của các bộ phận (FIFO, làm xong tự ẩn)
  needsCleaning: boolean;        // Hàng chờ BỘ PHẬN VỆ SINH -> CHỜ VỆ SINH
  needsQuotation: boolean;       // Hàng chờ BỘ PHẬN BÁO GIÁ -> CHỜ BÁO GIÁ (chỉ cont DAMAGE)
  needsRepair: boolean;          // Hàng chờ BỘ PHẬN SỬA CHỮA -> CHỜ SỬA CHỮA (sau khi duyệt Báo giá)
  forkliftShiftTask: 'NONE' | 'HA_SUA_CHUA' | 'HA_KE_GIAM_DINH'; // Hàng chờ XE NÂNG -> ĐẢO CHUYỂN
  quotationAmount?: number;
  quotationItems?: string[];
  // Tạm giữ / Khóa xuất (DEC-002, DEC-015)
  isOnHold: boolean;
  holdReason?: string;
  holdBy?: string;
  holdAt?: string;
  // Khóa phân bổ cấp vỏ (DEC-006)
  allocatedBookingNo?: string;
  allocatedTruckNo?: string;
  allocatedAt?: string;
  // Ghi chú của Nhân viên Văn phòng trong danh sách TỒN VỎ (Cont có ghi chú sẽ được focus nổi bật)
  officeNote?: string;
  officeNoteUpdatedBy?: string;
  officeNoteUpdatedAt?: string;
  gateInAt: string;
  gateOutAt?: string;
}

export interface LocationHistoryItem {
  id: string;
  masterDossierCode: string; // Liên kết MÃ HỒ SƠ CHÍNH
  containerNo: string;
  fromLocation: string;
  toLocation: string;
  actionType:
    | 'INITIAL_BLOCK'
    | 'DETAIL_SLOT_UPDATE'
    | 'YARD_MOVE'
    | 'SHIFT_REPAIR'
    | 'SHIFT_INSPECTION_RACK'
    | 'GATE_OUT_CLEAR';
  reason: string;
  performedBy: string;
  performedAt: string;
}

export interface MasterPrepaidReceipt {
  id: string;
  receiptCode: string;
  qrCode: string;
  customerName: string;
  lotDescription: string;
  totalAmount: number;
  remainingAmount: number;
  status: 'ACTIVE' | 'EXHAUSTED' | 'CANCELLED';
  createdBy: string;
  createdAt: string;
}

export interface MasterReceiptDeduction {
  id: string;
  receiptCode: string;
  qrCode: string;
  voucherNo: string;
  containerNo: string;
  deductedAmount: number;
  balanceBefore: number;
  balanceAfter: number;
  performedBy: string;
  performedAt: string;
}

export interface PaymentVoucher {
  id: string;
  masterDossierCode: string; // Liên kết MÃ HỒ SƠ CHÍNH
  voucherNo: string;
  serviceType: 'GATE_IN' | 'GATE_OUT' | 'CLEANING' | 'REPAIR' | 'STORAGE';
  referenceCode: string;
  containerNo: string;
  shippingLineCode: string;
  payerName: string;
  amount: number;
  paymentCategory?: PaymentCategory;
  directMethod?: DirectPaymentMethod;
  scannedQrCode?: string;
  masterReceiptCode?: string;
  ttsNote?: string;
  providerTxRef?: string;
  status: 'PENDING' | 'CONFIRMED' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
  confirmedBy?: string;
  confirmedAt?: string;
  createdBy: string;
  createdAt: string;
}

export interface GateInOrder {
  id: string;
  masterDossierCode: string; // MÃ HỒ SƠ CHÍNH khởi tạo ban đầu từ bộ phận GIÁM ĐỊNH
  orderCode: string;
  gateInType: GateInType;
  // Bước 1: Giám định Hạ vỏ chụp ảnh cửa cont & xác nhận tác nghiệp
  doorPhotoUrl: string;
  initialContainerHint?: string;
  conditionClass: FieldConditionClass; // DAMAGE | AV
  damageRemarks: string[];             // Remark nhanh hư hỏng
  stuffingClass: FieldStuffingClass;   // M | K | E
  cleaningItems: FieldCleaningItem[];  // KHÔNG VỆ SINH / WP / WW / CC / RM / ML
  manufactureYear: number;             // AGE: 2001, 2002...
  fieldStaffName: string;
  fieldRecordedAt: string;
  // Bước 2: Văn phòng kiểm tra lệnh/chứng từ & bổ sung thông tin
  containerNo?: string;
  size?: ContainerSize;
  type?: ContainerType;
  truckNo?: string;
  customerRep?: string;
  shippingLineCode?: string;
  orderDocNo?: string;
  officeStaffName?: string;
  officeVerifiedAt?: string;
  // Bước 3: Chi phí (Đã bao gồm VAT) & Thanh toán & GATE IN OK & Mã QR phiếu K80
  feeLines?: FeeLineItem[];
  feeAmount: number; // Tổng chi phí đã bao gồm VAT
  voucherId?: string;
  voucherNo?: string;
  k80QrCode?: string;
  status: GateInStatus;
  gateInOkAt?: string;
  gateInOkBy?: string;
  nextDepartments: string[];
  cancelReason?: string;
}

export interface ServiceWorkOrder {
  id: string;
  masterDossierCode: string; // Liên kết MÃ HỒ SƠ CHÍNH
  workOrderCode: string;
  containerNo: string;
  category: 'CLEANING' | 'INSPECTION' | 'REPAIR';
  sourceOrderCode?: string;
  items: string[];
  estimateCost: number;
  approvalStatus: 'NOT_REQUIRED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  workStatus: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'REWORK_REQUIRED';
  assignedTo: string;
  resultNotes?: string;
  createdAt: string;
  completedAt?: string;
  completedBy?: string;
}

export interface ReleaseBooking {
  id: string;
  bookingNo: string;
  releaseType: GateOutType;
  shippingLineCode: string;
  requesterName: string;
  receiverName: string;
  size: ContainerSize;
  type: ContainerType;
  requestedQty: number;
  allocatedContainers: string[];
  gatedOutContainers: string[];
  status: 'OPEN' | 'FULLY_ALLOCATED' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
}

export interface GateOutOrder {
  id: string;
  masterDossierCode: string; // Liên kết MÃ HỒ SƠ CHÍNH cho đến khi OUT khỏi bãi
  gateOutCode: string;
  gateOutType: GateOutType;
  bookingNo: string;
  containerNo: string;
  truckNo: string;
  receiverRep: string;
  feeAmount: number;
  voucherId?: string;
  voucherNo?: string;
  k80QrCode: string;
  chkValidOrder: boolean;
  chkNotOnHold: boolean;
  chkCorrectContainer: boolean;
  chkPaymentSettled: boolean;
  chkDocumentsCompleted: boolean;
  status: 'PENDING_FORKLIFT' | 'GATE_OUT_OK' | 'CANCELLED';
  confirmedBy?: string;
  confirmedAt?: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  masterDossierCode?: string; // Liên kết MÃ HỒ SƠ CHÍNH
  actorName: string;
  actorRole: AppRole;
  actionCode: string;
  entityType: string;
  entityCode: string;
  summary: string;
  createdAt: string;
}
