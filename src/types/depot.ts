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
  | 'REPAIR_STAFF'
  | 'ACCOUNTANT'; // DEC-111: thêm lại Kế toán — chỉ cập nhật trạng thái hóa đơn từ phiếu thu

export const ROLE_LABELS: Record<AppRole, string> = {
  ADMIN: 'Admin',
  MANAGER: 'Quản lý',
  OFFICE: 'Văn phòng',
  FORKLIFT: 'Xe nâng',
  CLEANING: 'Vệ sinh',
  INSPECTOR: 'Giám định',
  QUOTATION: 'Báo giá',
  REPAIR_STAFF: 'Sửa chữa',
  ACCOUNTANT: 'Kế toán',
};

// DEC-111: trạng thái xuất hóa đơn của phiếu thu
export type InvoiceStatus = 'CHUA_XHD' | 'YEU_CAU_XHD' | 'DA_XHD';

// DEC-120: GÓP Ý XÂY DỰNG HỆ THỐNG
export type FeedbackStatus = 'MOI' | 'DANG_XU_LY' | 'DA_XU_LY' | 'KHONG_AP_DUNG';
export interface FeedbackItem {
  id: string;
  code: string;        // GY-YYMMDD-NNN
  menuId: string;      // mã menu (WorkspaceMenuId) hoặc 'KHAC'
  menuLabel: string;   // tên menu / tính năng tại thời điểm góp ý
  content: string;
  status: FeedbackStatus;
  createdAt: string;
  createdById: string;
  createdBy: string;
  response?: string;   // phản hồi của Admin
  respondedAt?: string;
  respondedBy?: string;
}

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
  | 'GD_NHAP_TAU'
  | 'GD_XUAT_TAU'
  | 'XN_NHAP_TAU'
  | 'XN_XUAT_TAU'
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
  | 'DM_PHAN_LOAI' // DEC-166: Phân loại đóng hàng
  | 'DM_CONG_TY'
  | 'DM_USER'
  | 'DM_DATABASE' // DEC-189: sức khỏe database (chỉ Admin)
  | 'DM_EDI' // DEC-197: EDI CODECO hãng tàu — chạy thử (chỉ Admin)
  | 'BC_HA_VO'
  | 'BC_SUA_CHUA'
  | 'BC_SC_SAN_LUONG' // DEC-179: Sửa chữa — Sản lượng (tách khỏi tab)
  | 'BC_GD_CHI_TIET' // DEC-179: Giám định — Chi tiết
  | 'BC_VS_CHI_TIET' // DEC-179: Vệ sinh — Chi tiết
  | 'BC_XN_CHI_TIET' // DEC-179: Xe nâng — Chi tiết
  // DEC-180: menu Báo cáo chỉ có bộ phận — báo cáo con là tab trong trang bộ phận (mã BC_… ở trên = quyền từng tab)
  | 'BC_BP_GIAM_DINH'
  | 'BC_BP_VAN_PHONG'
  | 'BC_BP_VE_SINH'
  | 'BC_BP_XE_NANG'
  | 'BC_BP_SUA_CHUA'
  | 'BC_GOP_Y'; // DEC-120

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
// DEC-147: 'W-SURVEY' = chưa giám định được → hạ lên kệ; Giám định bổ sung AV / DAMAGE + Đóng hàng + AGE sau (completeRackInspection)
export type FieldConditionClass = 'DAMAGE' | 'AV' | 'W-SURVEY';
export const CONDITION_DEFERRED = 'W-SURVEY' as const;
// DEC-166: mã PHÂN LOẠI ĐÓNG HÀNG lấy từ Danh mục theo hãng tàu (mặc định M / K / E) — trống khi hãng không dùng
export type FieldStuffingClass = string;
export interface StuffingClassItem {
  id: string;
  shippingLineCode: string;
  code: string;          // VD: M, K, E
  description?: string;
  isActive: boolean;
}

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

// DEC-195: mã ISO 6346 theo Size + Type (Danh mục Container, Admin sửa). Màn hình / phiếu / biểu giá vẫn dùng 20DC, 40HC…
export interface ContainerIsoCode {
  size: ContainerSize;
  type: ContainerType;
  isoCode: string; // 4 ký tự, VD 22G1, 45G1, L5G1
}

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
  amountInclVat: number; // Thành tiền dòng (= đơn giá × số lượng)
  quantity?: number;          // DEC-077: số lượng (mặc định 1)
  unitAmountInclVat?: number; // DEC-077: đơn giá biểu giá tại thời điểm lập
}

// 3 trường hợp thanh toán đã xác nhận (DEC-004, DEC-031)
export type PaymentCategory =
  | 'TTT'   // THANH TOÁN TRƯỚC (Phiếu thu trả trước + Quét mã QR trừ dần)
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
  // DEC-191: thông tin chi tiết — chỉ Admin + chính nhân viên xem; để trống = chưa cập nhật (cập nhật / xác minh sau)
  department?: AppRole; // PHÒNG BAN (1) — độc lập với vai trò / role phân quyền
  gender?: StaffGender;
  idNumber?: string;    // CCCD 12 số
  birthYear?: number;
  hometown?: string;
}

export type StaffGender = 'NAM' | 'NU';
export const STAFF_GENDER_LABELS: Record<StaffGender, string> = { NAM: 'Nam', NU: 'Nữ' };

export interface Partner {
  id: string;
  code: string;
  name: string;
  isShippingLine: boolean;
  isCustomer: boolean;
  allowTts: boolean;
  isPriority?: boolean; // DEC-166: hãng tàu ƯU TIÊN — Giám định Hạ vỏ chọn sẵn (chỉ 1 hãng)
}

export interface YardBlock {
  blockCode: string;
  blockName: string;
  maxBay: number;
  maxRow: number;
  maxTier: number;
  capacity: number;
  description: string;
  isInspectionRack?: boolean; // DEC-109: KỆ GIÁM ĐỊNH — Admin đánh dấu; cont "Hạ kệ giám định" chỉ được hạ vào block này
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
  stuffingClass?: FieldStuffingClass;  // M / K / E — trống khi W-SURVEY (DEC-147)
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
  manufactureYear?: number; // AGE: 2001, 2002... — trống khi W-SURVEY (DEC-147)
  shippingLineCode: string;
  customerRep: string;     // Khách hàng (hạ vỏ)
  truckNo?: string;        // Số xe hạ vỏ
  driverPhone?: string;    // SĐT lái xe hạ vỏ
  status: ContainerStatus;
  conditionClass: FieldConditionClass;
  damageRemarks: string[];
  stuffingClass?: FieldStuffingClass;  // M / K / E — trống khi W-SURVEY (DEC-147)
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
  // DEC-109: HA_KE_GIAM_DINH = cont phải hạ vào KỆ GIÁM ĐỊNH (đặt từ Giám định Hạ vỏ); xóa khi ĐẢO CHUYỂN về vị trí khác.
  // HA_SUA_CHUA: cờ cũ (menu đã gỡ theo CR-01).
  forkliftShiftTask: 'NONE' | 'HA_SUA_CHUA' | 'HA_KE_GIAM_DINH';
  holdSource?: 'VESSEL_EXPORT'; // DEC-131: khóa tự động do nằm trong danh sách XUẤT TÀU (chặn cấp vỏ, vẫn xuất tàu được)
  quotationAmount?: number;
  quotationItems?: string[];
  quotationLaborHours?: number; // GIỜ CÔNG SỬA CHỮA do Báo giá nhập (DEC-041)
  quotationUpdatedBy?: string; // DEC-086: người / giờ cập nhật báo giá (trước khi chuyển sửa chữa)
  quotationUpdatedAt?: string;
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
  vesselExportItemId?: string; // Đang nằm trong danh sách XUẤT TÀU (DEC-069)
  // DEC-185: ĐỔI CONTAINER khi chờ trả chứng từ cấp vỏ — chờ Xe nâng hạ lại (xóa khi hạ xong)
  swapReturn?: { gateOutCode: string; reason: SwapReason; note?: string; toContainerNo: string; requestedBy: string; requestedAt: string };
  isoCode?: string; // DEC-195: mã ISO 6346 riêng của cont (VD lấy từ Maersk eEIR); trống = theo Danh mục Size + Type
  releaseDamage?: boolean; // DEC-185: nhãn PHÁT SINH CẤP VỎ — hư hỏng phát hiện khi cấp vỏ (giữ cho cả lượt lưu bãi)
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
  | 'GATE_OUT_CLEAR'
  | 'SWAP_RETURN'; // DEC-185: Xe nâng hạ lại cont bị ĐỔI CONTAINER khi chờ trả chứng từ cấp vỏ

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

// Phiếu thu trả trước (TTT): chỉ ACTIVE (dùng được để trừ dần) sau khi tiền nạp đã thu thực tế
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
  feeLines?: FeeLineItem[]; // DEC-077: chi phí theo biểu giá × số lượng (tổng = totalAmount)
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
  paymentCategory: 'TTT' | 'TTTT'; // TTT = nạp Phiếu thu trả trước; TTTT = thu trực tiếp cho chứng từ
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
  THU_TRUOC: 'THU TRƯỚC (TTR)',
  KHAC: 'KHÁC',
};

export interface PaymentReceipt {
  id: string;
  receiptNo: string; // PT-TT-YYMMDD-NNNN / PT-TTR-YYMMDD-NNNN (DEC-098); dữ liệu cũ PT-YYYY-NNNNNN
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
  // DEC-111: xuất hóa đơn — mã bảo mật 12 ký tự in trên phiếu; khách dùng để gửi yêu cầu
  invoiceSecret?: string;
  invoiceStatus?: InvoiceStatus;
  invoiceRequest?: { taxCode: string; email: string; companyName: string; address: string; note?: string; requestedAt: string; updatedAt: string };
  invoiceIssued?: { invoiceNo?: string; issuedAt: string; issuedBy: string };
  // DEC-130: phiếu thu TRẢ TRƯỚC — khách tự gộp các LƯỢT đã dùng thành từng yêu cầu hóa đơn
  invoiceGroups?: InvoiceGroup[];
}

// DEC-130: 1 yêu cầu hóa đơn = 1 nhóm lượt trừ tiền của phiếu thu trả trước (1 MST / 1 địa chỉ)
export interface InvoiceGroup {
  id: string;
  deductionIds: string[];
  amount: number;
  taxCode: string;
  email: string;
  companyName: string;
  address: string;
  note?: string;
  status: 'YEU_CAU_XHD' | 'DA_XHD';
  requestedAt: string;
  updatedAt: string;
  invoiceNo?: string;
  issuedAt?: string;
  issuedBy?: string;
}

export interface GateInOrder {
  id: string;
  masterDossierCode: string; // Mã hồ sơ HẠ VỎ (HV-YYMMDD-NNN)
  orderCode: string;
  gateInType: GateInType;
  // Bước 1: Giám định Hạ vỏ chụp ảnh cửa cont & xác nhận tác nghiệp
  doorPhotoUrl: string;
  initialContainerHint?: string;
  conditionClass: FieldConditionClass; // DAMAGE | AV | W-SURVEY (DEC-147)
  damageRemarks: string[];             // Remark nhanh hư hỏng
  stuffingClass?: FieldStuffingClass;  // M | K | E — trống khi W-SURVEY
  cleaningItems: FieldCleaningItem[];  // KHÔNG VỆ SINH / WP / WW / CC / RM / ML
  manufactureYear?: number;            // AGE: 2001, 2002... — trống khi W-SURVEY
  toInspectionRack?: boolean;          // DEC-109 / DEC-147: = W-SURVEY → Xe nâng HẠ KỆ GIÁM ĐỊNH
  rackInspectedBy?: string;            // DEC-147: Giám định bổ sung trên kệ
  rackInspectedAt?: string;
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
  // DEC-174: bậc thợ + đơn giá (đ / giờ) của từng nhân viên LÚC HOÀN TẤT sửa chữa — đổi đơn giá sau không ảnh hưởng
  repairMemberRates?: { name: string; gradeName?: string; hourlyRate?: number }[];
  // DEC-176: ảnh HOÀN THÀNH SỬA CHỮA (1–30 ảnh, mỗi ảnh < 200 KB). Demo: ảnh nén dạng data:; database: link xem tạm của kho repair-photos
  repairPhotos?: string[];
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

// DEC-194: TÁC NGHIỆP cấp vỏ — Release for customer (mặc định) / Release for sale (CẤP SALE, bắt buộc Sale code).
// Các bước sau (thanh toán, Xe nâng, trả chứng từ, đổi cont) giống nhau; dùng cho EDI hãng tàu (docs/EDI_MAERSK.md).
export type ReleasePurpose = 'CUSTOMER' | 'SALE';
export const RELEASE_PURPOSE_LABELS: Record<ReleasePurpose, string> = { CUSTOMER: 'Release for customer', SALE: 'Release for sale' };

// DEC-185: ĐỔI CONTAINER (Văn phòng, khi cont đã cấp ra, chưa trả chứng từ) — giữ mã CV-, chứng từ, phiếu thu
export type SwapReason = 'KEN_VO' | 'DAMAGE';
export const SWAP_REASON_LABELS: Record<SwapReason, string> = {
  KEN_VO: 'Khách kén vỏ, yêu cầu đổi cont khác',
  DAMAGE: 'Container phát sinh hư hỏng, không đủ điều kiện cấp khách',
};
export interface GateOutSwap {
  fromContainerId: string;
  fromContainerNo: string;
  fromMasterDossierCode: string;
  toContainerNo: string;
  toMasterDossierCode: string;
  reason: SwapReason;
  note?: string;
  lifted?: boolean;     // DEC-192: true = đổi khi cont đã nâng lên xe (đã OUT); false = đổi trước khi nâng hạ
  gatedOutBy?: string; // Xe nâng đã cấp cont cũ (trước khi đổi)
  gatedOutAt?: string;
  swappedBy: string;
  swappedAt: string;
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
  swaps?: GateOutSwap[]; // DEC-185: các lần ĐỔI CONTAINER của lệnh
  releasePurpose?: ReleasePurpose; // DEC-194: không có = Release for customer
  saleCode?: string;               // DEC-194: bắt buộc khi Release for sale
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
  gradeId?: string; // DEC-173: bậc thợ của nhân viên trong tổ
}

// DEC-173: BẬC THỢ sửa chữa — đơn giá tiền / 1 giờ công
export interface RepairGrade {
  id: string;
  code: string;
  name: string;
  hourlyRate: number;
  isActive: boolean;
}

// DEC-175: VƯỢT GIỜ sửa chữa — giờ công trên mốc (theo khoảng lọc báo cáo) tính thêm đơn giá vượt giờ / giờ
export interface RepairOvertimeSetting {
  thresholdHours: number;
  hourlyRate: number;
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

// ============================================================================
// NHẬP TÀU / XUẤT TÀU (DEC-069) — danh sách theo tàu, mỗi container 1 hồ sơ NT- / XT-
// Không thu phí, không phiếu K80, không trả chứng từ.
// ============================================================================
export type VesselMode = 'NHAP_TAU' | 'XUAT_TAU';
export const VESSEL_MODE_LABELS: Record<VesselMode, string> = { NHAP_TAU: 'NHẬP TÀU', XUAT_TAU: 'XUẤT TÀU' };

export type VesselListStatus = 'OPEN' | 'APPROVED';
// NT: PENDING (chờ xe về) → INSPECTED (Giám định xác nhận, cont vào hàng chờ Vệ sinh / Xe nâng) → DONE (Xe nâng hạ, cont tồn bãi)
// XT: PENDING (chờ xuất) → DONE (Giám định / Xe nâng gán xe, cont OUT khỏi bãi)
export type VesselItemStatus = 'PENDING' | 'INSPECTED' | 'DONE' | 'SKIPPED'; // DEC-131: SKIPPED = không kịp tác nghiệp khi duyệt (gạch đi)

export interface VesselListItem {
  id: string;
  containerNo: string;
  size: ContainerSize;
  type: ContainerType;
  status: VesselItemStatus;
  dossierCode?: string;          // NT-YYMMDD-NNN (cấp khi Giám định xác nhận) / XT-YYMMDD-NNN (cấp khi lập danh sách)
  containerId?: string;          // Lượt lưu bãi tương ứng (NT: lượt mới tạo; XT: lượt đang tồn bãi)
  truckNo?: string;
  // XT: ảnh chụp thông tin lúc lập danh sách
  conditionClass?: FieldConditionClass;
  stuffingClass?: FieldStuffingClass;
  locationAtList?: string;
  // NT: kết quả Giám định
  manufactureYear?: number;
  cleaningItems?: FieldCleaningItem[];
  damageRemarks?: string[];
  doorPhotoUrl?: string;
  inspectedBy?: string;
  inspectedAt?: string;
  doneBy?: string;
  doneAt?: string;
}

export interface VesselList {
  id: string;
  mode: VesselMode;
  vesselName: string;
  shippingLineCode?: string;     // NT: bắt buộc, 1 hãng cho cả danh sách
  destinationPort?: string;      // DEC-196: XT — mã cảng / terminal đến (VD VNHPHTM), tùy tàu; gửi EDI CODECO (RFF+BN)
  plannedAt: string;             // Thời gian nhập / xuất tàu
  truckNos: string[];            // Danh sách số xe
  items: VesselListItem[];
  status: VesselListStatus;
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  approveNote?: string; // DEC-131: lý do duyệt khi chưa xuất / nhập đủ
}
