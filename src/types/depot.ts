// ============================================================================
// MATRAN DEPOT ERP — CORE TYPES & BUSINESS ENUMS
// Nguồn quy tắc: docs/DECISIONS.md (DEC-001 → DEC-04x)
// ============================================================================

export type AppRole =
  | 'ADMIN'
  | 'MANAGER'
  | 'OFFICE'
  | 'FORKLIFT'
  | 'CLEANING'
  | 'INSPECTOR'
  | 'QUOTATION'
  | 'REPAIR_STAFF';

export const ROLE_LABELS: Record<AppRole, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Quản lý',
  OFFICE: 'Văn phòng',
  FORKLIFT: 'Xe nâng',
  CLEANING: 'Vệ sinh',
  INSPECTOR: 'Giám định',
  QUOTATION: 'Báo giá',
  REPAIR_STAFF: 'Sửa chữa',
};

// Cấu trúc Menu tác nghiệp (CR-06, CR-09)
export type WorkspaceMenuId =
  | 'TON_VO'
  | 'GD_HA_VO'
  | 'VP_HA_VO'
  | 'VP_CAP_VO'
  | 'VP_PHIEU_THU'
  | 'VP_TRA_CHUNG_TU'
  | 'VP_NHAP_TAU'
  | 'VP_XUAT_TAU'
  | 'VS_CHO_VE_SINH'
  | 'XN_CHO_HA_VO'
  | 'XN_CHO_CAP_VO'
  | 'XN_DAO_CHUYEN'
  | 'BG_CHO_BAO_GIA'
  | 'SC_CHO_SUA_CHUA'
  | 'BC_CAP_VO'
  | 'BC_NHAP_TAU'
  | 'BC_XUAT_TAU'
  | 'BC_TONG_HOP'
  | 'DM_KHACH_HANG'
  | 'DM_HANG_TAU'
  | 'DM_VI_TRI'
  | 'DM_CONTAINER'
  | 'DM_BIEU_GIA'
  | 'DM_SUA_CHUA'
  | 'DM_CONG_TY'
  | 'DM_USER'
  | 'BC_HA_VO'
  | 'BC_SUA_CHUA';

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

// Phân loại Giám định Hạ vỏ đã xác nhận (DEC-016, DEC-021)
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

// Dòng chi phí của từng hồ sơ: chụp lại tên & đơn giá biểu giá tại thời điểm lập chứng từ (Đã BAO GỒM VAT)
export interface FeeLineItem {
  id: string;
  catalogCode: string;
  name: string;
  amountInclVat: number;
}

// 3 trường hợp thanh toán đã xác nhận (DEC-004, DEC-031)
export type PaymentCategory =
  | 'TTT'   // THANH TOÁN TRƯỚC (Phiếu thu mẹ + Quét mã QR trừ dần)
  | 'TTS'   // THANH TOÁN SAU (Kiểm tra nguồn + Note ở chứng từ là TTS) -> công nợ, chưa thu tiền
  | 'TTTT'; // THANH TOÁN TRỰC TIẾP (Chuyển khoản API QR / Tiền mặt)

export type DirectPaymentMethod = 'BANK_TRANSFER_API' | 'CASH';

export const PAYMENT_METHOD_LABELS: Record<DirectPaymentMethod, string> = {
  BANK_TRANSFER_API: 'Chuyển khoản (API QR)',
  CASH: 'Tiền mặt',
};

export type GateInStatus =
  | 'FIELD_RECORDED'  // Giám định đã chụp ảnh cửa cont & xác nhận tác nghiệp sang Văn phòng
  | 'OFFICE_VERIFIED' // Văn phòng đã kiểm tra lệnh/chứng từ & bổ sung thông tin
  | 'PAYMENT_PENDING' // Đã tạo yêu cầu thanh toán (chưa hoàn tất thu tiền)
  | 'GATE_IN_OK'      // Đã xác nhận thanh toán hợp lệ -> GATE IN OK & In phiếu K80 có QR
  | 'CANCELLED';

export type ContainerStatus =
  | 'PENDING_GATE_IN'   // Đang làm thủ tục Hạ vỏ
  | 'WAITING_PLACEMENT' // Đã GATE IN OK, chờ (vệ sinh nếu có rồi) XE NÂNG - CHỜ HẠ VỎ
  | 'IN_YARD'           // Đang tồn bãi
  | 'ALLOCATED'         // Đã lập lệnh CẤP VỎ & khóa phân bổ
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
  masterDossierCode: string; // Mã hồ sơ HẠ VỎ (HV-...) của lượt lưu bãi
  outDossierCode?: string;   // Mã hồ sơ CẤP VỎ (CV-...) nếu là phiếu cấp vỏ
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
  driverPhone?: string;
  customerRep?: string;
  targetBlock?: string;
  issuedAt: string;
  issuedBy: string;
}

// Một bản ghi = một LƯỢT LƯU BÃI của container (từ HẠ VỎ đến khi OUT). Lượt đã OUT được giữ lại làm lịch sử.
export interface ContainerRecord {
  id: string;
  masterDossierCode: string; // Mã hồ sơ HẠ VỎ (HV-YYMMDD-NNN — DEC-068)
  containerNo: string;
  size: ContainerSize;
  type: ContainerType;
  manufactureYear: number; // AGE: 2001, 2002...
  shippingLineCode: string;
  customerRep: string;     // Khách hàng (hạ vỏ)
  truckNo?: string;        // Số xe hạ vỏ
  driverPhone?: string;    // SĐT lái xe hạ vỏ
  status: ContainerStatus;
  conditionClass: FieldConditionClass;
  damageRemarks: string[];
  stuffingClass: FieldStuffingClass;   // M / K / E
  cleaningItems: FieldCleaningItem[];
  // Mã QR tác nghiệp nội bộ K80 hiện hành của container
  activeQrCode: string;
  isPaid: boolean;
  // Vị trí hiện tại chính thức (DEC-005): chỉ do HẠ VỎ, ĐẢO CHUYỂN hoặc SỬA VỊ TRÍ ghi nhận
  currentBlock: string | null;
  currentBay: string | null;
  currentRow: string | null;
  currentTier: string | null;
  // Hàng chờ công việc của các bộ phận (FIFO, làm xong tự ẩn)
  needsCleaning: boolean;        // CHỜ VỆ SINH
  needsQuotation: boolean;       // CHỜ BÁO GIÁ (chỉ cont DAMAGE)
  needsRepair: boolean;          // CHỜ SỬA CHỮA (sau khi Báo giá)
  // Cờ cũ của luồng đảo chuyển HẠ SỬA CHỮA / HẠ KỆ GIÁM ĐỊNH (menu đã gỡ theo CR-01; được xóa khi ĐẢO CHUYỂN)
  forkliftShiftTask: 'NONE' | 'HA_SUA_CHUA' | 'HA_KE_GIAM_DINH';
  quotationAmount?: number;
  quotationItems?: string[];
  quotationLaborHours?: number; // GIỜ CÔNG SỬA CHỮA do Báo giá nhập (DEC-041)
  // KHÓA CONTAINER = Tạm giữ / Khóa xuất (DEC-002, DEC-015, CR-02)
  isOnHold: boolean;
  holdReason?: string;
  holdBy?: string;
  holdAt?: string;
  // Khóa phân bổ cấp vỏ (DEC-006) & hồ sơ CẤP VỎ
  allocatedBookingNo?: string;
  allocatedTruckNo?: string;
  allocatedDriverPhone?: string;
  allocatedAt?: string;
  outDossierCode?: string; // CV-YYMMDD-NNN
  // Ghi chú của Nhân viên Văn phòng trong danh sách TỒN VỎ
  officeNote?: string;
  officeNoteUpdatedBy?: string;
  officeNoteUpdatedAt?: string;
  gateInAt: string;
  gateOutAt?: string;
}

export type LocationActionType =
  | 'INITIAL_BLOCK'
  | 'DETAIL_SLOT_UPDATE'
  | 'YARD_MOVE'
  | 'YARD_SHIFT' // ĐẢO CHUYỂN (CR-01)
  | 'SHIFT_REPAIR'
  | 'SHIFT_INSPECTION_RACK'
  | 'GATE_OUT_CLEAR';

// Lịch sử TÁC NGHIỆP vị trí (Xe nâng). Thao tác SỬA VỊ TRÍ hành chính KHÔNG ghi vào đây (CR-02).
export interface LocationHistoryItem {
  id: string;
  masterDossierCode: string;
  containerNo: string;
  fromLocation: string;
  toLocation: string;
  actionType: LocationActionType;
  reason: string;
  performedBy: string;
  performedAt: string;
}

// Phiếu thu mẹ (TTT): chỉ ACTIVE (dùng được để trừ dần) sau khi tiền nạp đã thu thực tế
export interface MasterPrepaidReceipt {
  id: string;
  receiptCode: string;
  qrCode: string;
  customerCode?: string;
  customerName: string;
  lotDescription: string;
  totalAmount: number;
  remainingAmount: number;
  status: 'PENDING_PAYMENT' | 'ACTIVE' | 'EXHAUSTED' | 'CANCELLED';
  paymentMethod?: DirectPaymentMethod;
  createdBy: string;
  createdAt: string;
  activatedAt?: string;
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

// Chứng từ / Khoản phải thu của một hồ sơ nghiệp vụ.
// CONFIRMED = đã thanh toán (đã trừ quỹ TTT hoặc đã thu TTTT); DEFERRED = TTS (công nợ, chưa thu tiền).
export interface PaymentVoucher {
  id: string;
  masterDossierCode: string;
  voucherNo: string;
  serviceType: 'GATE_IN' | 'GATE_OUT' | 'CLEANING' | 'REPAIR' | 'STORAGE';
  referenceCode: string; // Mã hồ sơ nghiệp vụ (HV-... / CV-...)
  containerNo: string;
  shippingLineCode: string;
  payerName: string;
  amount: number;
  feeLines?: FeeLineItem[];
  paymentCategory?: PaymentCategory;
  directMethod?: DirectPaymentMethod;
  scannedQrCode?: string;
  masterReceiptCode?: string;
  ttsNote?: string;
  providerTxRef?: string;
  status: 'PENDING' | 'CONFIRMED' | 'DEFERRED' | 'FAILED' | 'REFUNDED' | 'CANCELLED';
  confirmedBy?: string;
  confirmedAt?: string;
  createdBy: string;
  createdAt: string;
}

// Giao dịch thu tiền thực tế (Tiền mặt / Chuyển khoản API QR)
export type PaymentTransactionStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';

export const PAYMENT_TX_STATUS_LABELS: Record<PaymentTransactionStatus, string> = {
  PENDING: 'Chờ thanh toán',
  SUCCEEDED: 'Thanh toán thành công',
  FAILED: 'Thanh toán thất bại',
  CANCELLED: 'Đã hủy',
};

export interface PaymentTransaction {
  id: string;
  paymentRef: string;              // Mã tham chiếu nội dung chuyển khoản / giao dịch
  purpose: 'VOUCHER' | 'PREPAID_TOPUP';
  voucherId?: string;
  masterReceiptId?: string;
  dossierCode?: string;
  containerNo?: string;
  payerName: string;
  method: DirectPaymentMethod;
  paymentCategory: 'TTT' | 'TTTT'; // TTT = nạp Phiếu thu mẹ; TTTT = thu trực tiếp cho chứng từ
  amount: number;
  status: PaymentTransactionStatus;
  qrPayload?: string;              // Nội dung QR chuyển khoản (chỉ là yêu cầu thanh toán, không phải bằng chứng đã thu)
  providerTxRef?: string;          // Mã giao dịch ngân hàng (chống xử lý lặp callback)
  createdBy: string;
  createdAt: string;
  confirmedBy?: string;
  confirmedAt?: string;
  cancelReason?: string;
  receiptId?: string;
}

// PHIẾU THU: chỉ phát hành khi giao dịch thu tiền thực tế thành công; mỗi giao dịch tối đa 1 phiếu
// Tác nghiệp phát sinh khoản thu, in trên phiếu thu (DEC-051)
export type ReceiptOperation = 'HA_VO' | 'CAP_VO' | 'THU_TRUOC' | 'KHAC';

export const RECEIPT_OPERATION_LABELS: Record<ReceiptOperation, string> = {
  HA_VO: 'HẠ VỎ',
  CAP_VO: 'CẤP VỎ',
  THU_TRUOC: 'THU TRƯỚC (TTT)',
  KHAC: 'KHÁC',
};

export interface PaymentReceipt {
  id: string;
  receiptNo: string; // PT-YYYY-NNNNNN
  transactionId: string;
  purpose: 'VOUCHER' | 'PREPAID_TOPUP';
  operation?: ReceiptOperation; // Tác nghiệp phát sinh khoản thu (DEC-051)
  amount: number;
  method: DirectPaymentMethod;
  paymentCategory: 'TTT' | 'TTTT';
  voucherId?: string;
  voucherNo?: string;
  masterReceiptId?: string;
  masterReceiptCode?: string;
  dossierCode?: string;
  containerNo?: string;
  payerName: string;
  providerTxRef?: string;
  issuedAt: string;
  issuedBy: string;
  printLog?: { at: string; by: string }[]; // DEC-063: mỗi lần in phiếu thu
}

export interface GateInOrder {
  id: string;
  masterDossierCode: string; // Mã hồ sơ HẠ VỎ (HV-YYMMDD-NNN)
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
  driverPhone?: string;
  customerRep?: string; // Khách hàng (theo Danh mục chung)
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
  documentsReturnedAt?: string; // Văn phòng quét QR trả chứng từ cho lái xe (DEC-052)
  documentsReturnedBy?: string;
  cancelReason?: string;
}

export interface ServiceWorkOrder {
  id: string;
  masterDossierCode: string;
  workOrderCode: string;
  containerNo: string;
  category: 'CLEANING' | 'INSPECTION' | 'REPAIR';
  sourceOrderCode?: string;
  items: string[];
  estimateCost: number;
  approvalStatus: 'NOT_REQUIRED' | 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  workStatus: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED' | 'REWORK_REQUIRED' | 'CANCELLED';
  assignedTo: string;
  resultNotes?: string;
  createdAt: string;
  completedAt?: string;
  completedBy?: string;
  // Sửa chữa (DEC-041, DEC-043)
  laborHours?: number;
  repairTeamCode?: string;
  repairTeamName?: string;
  repairMembers?: string[];
}

export interface BookingReleasedItem {
  containerNo: string;
  outDossierCode?: string;
  reason: string;
  releasedBy: string;
  releasedAt: string;
}

// Booking / Lệnh cấp: số lượng xem trên chứng từ booking; hệ thống tự đếm số đã cấp (DEC-034)
export interface ReleaseBooking {
  id: string;
  bookingNo: string;
  releaseType: GateOutType;
  shippingLineCode: string;
  requesterName: string;
  receiverName: string;
  size: ContainerSize;
  type: ContainerType;
  requestedQty?: number;
  allocatedContainers: string[]; // Đã lập lệnh, chưa OUT
  gatedOutContainers: string[];  // Đã OUT
  releasedContainers?: BookingReleasedItem[]; // Đã hủy lệnh cấp
  status: 'OPEN' | 'FULLY_ALLOCATED' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
}

// Hồ sơ CẤP VỎ / XUẤT bãi
export interface GateOutOrder {
  id: string;
  masterDossierCode: string; // Mã hồ sơ HẠ VỎ của lượt lưu bãi
  gateOutCode: string;       // CV-YYMMDD-NNN — DEC-068
  gateOutType: GateOutType;
  bookingNo: string;
  containerNo: string;
  truckNo: string;
  driverPhone?: string;
  receiverRep: string;       // Khách hàng nhận vỏ
  feeLines?: FeeLineItem[];
  feeAmount: number;
  voucherId?: string;
  voucherNo?: string;
  k80QrCode: string;
  chkValidOrder: boolean;
  chkNotOnHold: boolean;
  chkCorrectContainer: boolean;
  chkPaymentSettled: boolean;
  chkDocumentsCompleted: boolean;
  status: 'PAYMENT_PENDING' | 'PENDING_FORKLIFT' | 'GATE_OUT_OK' | 'CANCELLED';
  createdBy?: string;
  confirmedBy?: string;
  confirmedAt?: string;
  cancelReason?: string;
  cancelledAt?: string;
  documentsReturnedAt?: string; // DEC-052
  documentsReturnedBy?: string;
  createdAt: string;
}

export interface AuditLogEntry {
  id: string;
  masterDossierCode?: string;
  actorName: string;
  actorRole: AppRole | 'SYSTEM';
  actionCode: string;
  entityType: string;
  entityCode: string;
  summary: string;
  createdAt: string;
}

// Tổ sửa chữa — Danh mục chung (DEC-042). Thành viên là nhân viên sửa chữa (không bắt buộc có tài khoản).
export interface RepairTeamMember {
  id: string;
  fullName: string;
  isActive: boolean;
  staffUserId?: string; // Liên kết user hệ thống (DEC-048); trống = nhân viên không có tài khoản
}

export interface RepairTeam {
  id: string;
  code: string;
  name: string;
  members: RepairTeamMember[];
  isActive: boolean;
}

// DEC-062: thông tin CÔNG TY in trên giấy tờ (phiếu thu, EEIR, K80)
export interface CompanyProfile {
  name: string;
  shortName: string;
  address: string;
  phone: string;
  email: string;
  taxCode: string;
  bankAccount: string;
}
