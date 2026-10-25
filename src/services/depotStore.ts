import { renameLegacyCodes } from './codes';
import { ensureInvoiceFields } from './invoice';
import {
  AppRole,
  AuditLogEntry,
  ContainerRecord,
  ContainerSize,
  ContainerType,
  DepotFeeCatalogItem,
  GateInOrder,
  GateOutOrder,
  K80InternalTicket,
  LocationHistoryItem,
  MasterPrepaidReceipt,
  MasterReceiptDeduction,
  Partner,
  PaymentReceipt,
  PaymentTransaction,
  PaymentVoucher,
  RepairTeam,
  CompanyProfile,
  ReleaseBooking,
  ServiceWorkOrder,
  StaffUser,
  YardBlock,
  VesselList,
} from '../types/depot';

// DEC-106, DEC-108, DEC-111: đổi khóa để mọi máy nạp lại dữ liệu test mới; khóa cũ bị xóa khi nạp
const STORAGE_KEY = 'matran_depot_erp_state_v10';
const LEGACY_STORAGE_KEYS = ['matran_depot_erp_state_v7', 'matran_depot_erp_state_v8', 'matran_depot_erp_state_v9'];

export interface DepotState {
  currentUser: StaffUser;
  staffUsers: StaffUser[];
  partners: Partner[];
  yardBlocks: YardBlock[];
  containerSizes: ContainerSize[];
  containerTypes: ContainerType[];
  feeCatalog: DepotFeeCatalogItem[];
  containers: ContainerRecord[];
  locationHistory: LocationHistoryItem[];
  masterReceipts: MasterPrepaidReceipt[];
  receiptDeductions: MasterReceiptDeduction[];
  vouchers: PaymentVoucher[];
  paymentTransactions: PaymentTransaction[];
  paymentReceipts: PaymentReceipt[];
  gateInOrders: GateInOrder[];
  workOrders: ServiceWorkOrder[];
  bookings: ReleaseBooking[];
  gateOutOrders: GateOutOrder[];
  k80Tickets: K80InternalTicket[];
  auditLogs: AuditLogEntry[];
  repairTeams: RepairTeam[];
  companyProfile: CompanyProfile;
  vesselLists: VesselList[]; // NHẬP TÀU / XUẤT TÀU (DEC-069)
  // Bộ đếm cấp mã hồ sơ / phiếu (HV-YYMMDD, CV-YYMMDD, PT-YYYY...). Ở chế độ Supabase do database cấp.
  codeCounters: Record<string, number>;
}

export const INITIAL_CONTAINER_SIZES: ContainerSize[] = ['20', '40', '45'];

export const INITIAL_CONTAINER_TYPES: ContainerType[] = [
  'DC',
  'HC',
  'OT',
  'FR',
  'RF',
];

export const INITIAL_STAFF: StaffUser[] = [
  {
    id: 'usr-admin',
    staffCode: 'NV-001',
    fullName: 'Nguyễn Quản Trị (Admin)',
    email: 'admin@matrandepot.vn',
    roles: ['ADMIN', 'MANAGER'],
    isActive: true,
  },
  {
    id: 'usr-office',
    staffCode: 'NV-002',
    fullName: 'Trần Thị Minh (Văn Phòng)',
    email: 'office@matrandepot.vn',
    roles: ['OFFICE'],
    isActive: true,
  },
  {
    id: 'usr-inspector',
    staffCode: 'NV-003',
    fullName: 'Lê Hoàng Giám Định (Hạ vỏ & Báo giá)',
    email: 'inspector@matrandepot.vn',
    roles: ['INSPECTOR'],
    isActive: true,
  },
  {
    id: 'usr-quotation',
    staffCode: 'NV-008',
    fullName: 'Ngô Thị Báo Giá',
    email: 'quotation@matrandepot.vn',
    roles: ['QUOTATION'],
    isActive: true,
  },
  {
    id: 'usr-forklift',
    staffCode: 'NV-004',
    fullName: 'Phạm Hoàng Xe Nâng',
    email: 'forklift@matrandepot.vn',
    roles: ['FORKLIFT'],
    isActive: true,
  },
  {
    id: 'usr-cleaning',
    staffCode: 'NV-005',
    fullName: 'Vũ Văn Vệ Sinh',
    email: 'cleaning@matrandepot.vn',
    roles: ['CLEANING'],
    isActive: true,
  },
  {
    id: 'usr-repair',
    staffCode: 'NV-006',
    fullName: 'Đặng Kỹ Thuật Sửa Chữa',
    email: 'repair@matrandepot.vn',
    roles: ['REPAIR_STAFF'],
    isActive: true,
  },
  {
    id: 'usr-acc',
    staffCode: 'NV-007',
    fullName: 'Đỗ Thị Thu (Kế toán)',
    email: 'accounting@matrandepot.vn',
    roles: ['ACCOUNTANT'], // DEC-111
    isActive: true,
  },
];

export const INITIAL_PARTNERS: Partner[] = [
  {
    id: 'pt-maersk',
    code: 'MAERSK',
    name: 'Maersk Line Vietnam',
    isShippingLine: true,
    isCustomer: false,
    allowTts: true,
  },
  {
    id: 'pt-one',
    code: 'ONE',
    name: 'Ocean Network Express (ONE)',
    isShippingLine: true,
    isCustomer: false,
    allowTts: true,
  },
  {
    id: 'pt-cosco',
    code: 'COSCO',
    name: 'COSCO Shipping Lines',
    isShippingLine: true,
    isCustomer: false,
    allowTts: true,
  },
  {
    id: 'pt-trans-vn',
    code: 'VIETLOG',
    name: 'Công ty Tiếp Vận Việt (VietLog)',
    isShippingLine: false,
    isCustomer: true,
    allowTts: true,
  },
  {
    id: 'pt-haiphong',
    code: 'HPT-TRANS',
    name: 'Vận Tải Nam Hải',
    isShippingLine: false,
    isCustomer: true,
    allowTts: false,
  },
];

export const INITIAL_YARD_BLOCKS: YardBlock[] = [
  {
    blockCode: 'BLOCK-A',
    blockName: 'Khu A — Container AV Sẵn sàng Cấp vỏ',
    maxBay: 20,
    maxRow: 6,
    maxTier: 5,
    capacity: 300,
    description: 'Lưu bãi container rỗng đạt chuẩn cấp vỏ (AV)',
  },
  {
    blockCode: 'BLOCK-B',
    blockName: 'Khu B — Container Lưu bãi chung (chỉ Block)',
    // DEC-082: không cấu hình Bay / Row / Tier → cont chỉ cần chọn Block, không giới hạn số cont
    maxBay: 0,
    maxRow: 0,
    maxTier: 0,
    capacity: 0,
    description: 'Khu vực chỉ quản lý theo Block — không cần Bay / Row / Tier',
  },
  {
    blockCode: 'BLOCK-CLEAN',
    blockName: 'Khu Vệ Sinh (WP / WW / CC / RM / ML)',
    maxBay: 8,
    maxRow: 4,
    maxTier: 3,
    capacity: 60,
    description: 'Khu vực thực hiện Quét, Rửa nước, Hóa chất, Nhổ đinh, Bóc tem',
  },
  {
    blockCode: 'BLOCK-DAMAGE',
    blockName: 'Khu Kệ Giám Định & Xưởng Sửa Chữa M&R',
    maxBay: 10,
    maxRow: 4,
    maxTier: 3,
    capacity: 80,
    description: 'Khu vực container DAMAGE chờ Báo giá và Sửa chữa',
    isInspectionRack: true, // DEC-109: mặc định là Kệ giám định, Admin đổi được
  },
];

export const INITIAL_FEE_CATALOG: DepotFeeCatalogItem[] = [
  // 1. BIỂU GIÁ NÂNG HẠ (Theo từng SIZE - TYPE - HÃNG TÀU)
  {
    id: 'fee-lolo-20-dc-maersk',
    code: 'LOLO_20_DC_MAERSK',
    name: "Nâng hạ vỏ 20' DC — Hãng tàu MAERSK (Đã gồm VAT)",
    category: 'NANG_HA',
    size: '20',
    type: 'DC',
    shippingLineCode: 'MAERSK',
    defaultAmountInclVat: 450000,
  },
  {
    id: 'fee-lolo-40-hc-maersk',
    code: 'LOLO_40_HC_MAERSK',
    name: "Nâng hạ vỏ 40' HC — Hãng tàu MAERSK (Đã gồm VAT)",
    category: 'NANG_HA',
    size: '40',
    type: 'HC',
    shippingLineCode: 'MAERSK',
    defaultAmountInclVat: 650000,
  },
  {
    id: 'fee-lolo-20-dc-one',
    code: 'LOLO_20_DC_ONE',
    name: "Nâng hạ vỏ 20' DC — Hãng tàu ONE (Đã gồm VAT)",
    category: 'NANG_HA',
    size: '20',
    type: 'DC',
    shippingLineCode: 'ONE',
    defaultAmountInclVat: 440000,
  },
  {
    id: 'fee-lolo-40-hc-one',
    code: 'LOLO_40_HC_ONE',
    name: "Nâng hạ vỏ 40' HC — Hãng tàu ONE (Đã gồm VAT)",
    category: 'NANG_HA',
    size: '40',
    type: 'HC',
    shippingLineCode: 'ONE',
    defaultAmountInclVat: 640000,
  },
  {
    id: 'fee-lolo-20-dc-cosco',
    code: 'LOLO_20_DC_COSCO',
    name: "Nâng hạ vỏ 20' DC — Hãng tàu COSCO (Đã gồm VAT)",
    category: 'NANG_HA',
    size: '20',
    type: 'DC',
    shippingLineCode: 'COSCO',
    defaultAmountInclVat: 460000,
  },
  {
    id: 'fee-lolo-40-hc-cosco',
    code: 'LOLO_40_HC_COSCO',
    name: "Nâng hạ vỏ 40' HC — Hãng tàu COSCO (Đã gồm VAT)",
    category: 'NANG_HA',
    size: '40',
    type: 'HC',
    shippingLineCode: 'COSCO',
    defaultAmountInclVat: 660000,
  },
  {
    id: 'fee-lolo-45-hc-all',
    code: 'LOLO_45_HC_ALL',
    name: "Nâng hạ vỏ 45' HC — Tất cả hãng tàu (Đã gồm VAT)",
    category: 'NANG_HA',
    size: '45',
    type: 'HC',
    shippingLineCode: 'ALL',
    defaultAmountInclVat: 750000,
  },
  // 2. BIỂU GIÁ THU GOM RÁC
  {
    id: 'fee-rac-20',
    code: 'RAC_20',
    name: "Phí thu gom rác cont 20' (Đã gồm VAT)",
    category: 'THU_GOM_RAC',
    size: '20',
    defaultAmountInclVat: 100000,
  },
  {
    id: 'fee-rac-40',
    code: 'RAC_40',
    name: "Phí thu gom rác cont 40'/45' (Đã gồm VAT)",
    category: 'THU_GOM_RAC',
    size: '40',
    defaultAmountInclVat: 150000,
  },
  {
    id: 'fee-rac-chung',
    code: 'RAC_CHUNG',
    name: 'Phí thu gom rác tiêu chuẩn bãi (Đã gồm VAT)',
    category: 'THU_GOM_RAC',
    defaultAmountInclVat: 120000,
  },
  // 3. BIỂU GIÁ KHÁC (VỆ SINH / DỊCH VỤ BÃI)
  {
    id: 'fee-vs-wp',
    code: 'VS_WP',
    name: 'Phí vệ sinh WP - Quét (Đã gồm VAT)',
    category: 'KHAC',
    defaultAmountInclVat: 150000,
  },
  {
    id: 'fee-vs-ww',
    code: 'VS_WW',
    name: 'Phí vệ sinh WW - Rửa nước (Đã gồm VAT)',
    category: 'KHAC',
    defaultAmountInclVat: 250000,
  },
  {
    id: 'fee-vs-cc',
    code: 'VS_CC',
    name: 'Phí vệ sinh CC - Hóa chất (Đã gồm VAT)',
    category: 'KHAC',
    defaultAmountInclVat: 450000,
  },
  {
    id: 'fee-vs-rm',
    code: 'VS_RM',
    name: 'Phí nhổ đinh RM (Đã gồm VAT)',
    category: 'KHAC',
    defaultAmountInclVat: 150000,
  },
  {
    id: 'fee-vs-ml',
    code: 'VS_ML',
    name: 'Phí bóc tem ML (Đã gồm VAT)',
    category: 'KHAC',
    defaultAmountInclVat: 150000,
  },
];

export function createInitialState(): DepotState {
  return {
    currentUser: INITIAL_STAFF[0],
    staffUsers: INITIAL_STAFF,
    partners: INITIAL_PARTNERS,
    yardBlocks: INITIAL_YARD_BLOCKS,
    containerSizes: INITIAL_CONTAINER_SIZES,
    containerTypes: INITIAL_CONTAINER_TYPES,
    feeCatalog: INITIAL_FEE_CATALOG,
    containers: [
      {
        id: 'cnt-1',
        masterDossierCode: 'HV-261019-001',
        containerNo: 'MSKU4089123',
        size: '40',
        type: 'HC',
        manufactureYear: 2019,
        shippingLineCode: 'MAERSK',
        customerRep: 'Công ty Tiếp Vận Việt (VietLog)',
        status: 'IN_YARD',
        conditionClass: 'AV',
        damageRemarks: [],
        stuffingClass: 'E',
        cleaningItems: ['KHÔNG VỆ SINH'],
        activeQrCode: 'QR-K80-MSKU4089123',
        isPaid: true,
        currentBlock: 'BLOCK-A',
        currentBay: '04',
        currentRow: '02',
        currentTier: '01',
        needsCleaning: false,
        needsQuotation: false,
        needsRepair: false,
        forkliftShiftTask: 'NONE',
        isOnHold: false,
        gateInAt: '2026-10-19T08:30:00+07:00',
      },
      {
        id: 'cnt-2',
        masterDossierCode: 'HV-261020-001',
        containerNo: 'ONEU2291045',
        size: '20',
        type: 'DC',
        manufactureYear: 2021,
        shippingLineCode: 'ONE',
        customerRep: 'Công ty Tiếp Vận Việt (VietLog)',
        status: 'IN_YARD',
        conditionClass: 'AV',
        damageRemarks: [],
        stuffingClass: 'K',
        cleaningItems: ['WP - QUÉT', 'ML - BÓC TEM'],
        activeQrCode: 'QR-K80-ONEU2291045',
        isPaid: true,
        currentBlock: 'BLOCK-B',
        currentBay: null,
        currentRow: null,
        currentTier: null,
        needsCleaning: true,
        needsQuotation: false,
        needsRepair: false,
        forkliftShiftTask: 'NONE',
        isOnHold: false,
        officeNote: 'Ưu tiên vệ sinh gấp để cấp cho lô VietLog chiều nay',
        officeNoteUpdatedBy: 'Trần Thị Minh (Văn Phòng)',
        officeNoteUpdatedAt: '2026-10-20T10:30:00+07:00',
        gateInAt: '2026-10-20T10:15:00+07:00',
      },
      {
        id: 'cnt-3',
        masterDossierCode: 'HV-261020-002',
        containerNo: 'CSNU7712309',
        size: '40',
        type: 'HC',
        manufactureYear: 2016,
        shippingLineCode: 'COSCO',
        customerRep: 'Vận Tải Nam Hải',
        status: 'IN_YARD',
        conditionClass: 'DAMAGE',
        damageRemarks: ['Móp vách', 'Hư sàn/xước sàn'],
        stuffingClass: 'M',
        cleaningItems: ['WW - RỬA NƯỚC', 'RM - NHỔ ĐINH'],
        activeQrCode: 'QR-K80-CSNU7712309',
        isPaid: true,
        currentBlock: 'BLOCK-DAMAGE',
        currentBay: '02',
        currentRow: '01',
        currentTier: '01',
        needsCleaning: true,
        needsQuotation: true,
        needsRepair: false,
        forkliftShiftTask: 'HA_KE_GIAM_DINH',
        isOnHold: false,
        gateInAt: '2026-10-20T13:20:00+07:00',
      },
      {
        id: 'cnt-4',
        masterDossierCode: 'HV-261021-001',
        containerNo: 'MSKU9102388',
        size: '40',
        type: 'HC',
        manufactureYear: 2020,
        shippingLineCode: 'MAERSK',
        customerRep: 'Công ty Tiếp Vận Việt (VietLog)',
        status: 'WAITING_PLACEMENT',
        conditionClass: 'AV',
        damageRemarks: [],
        stuffingClass: 'E',
        cleaningItems: ['WW - RỬA NƯỚC'],
        activeQrCode: 'QR-K80-MSKU9102388',
        isPaid: true,
        currentBlock: null,
        currentBay: null,
        currentRow: null,
        currentTier: null,
        needsCleaning: true,
        needsQuotation: false,
        needsRepair: false,
        forkliftShiftTask: 'NONE',
        isOnHold: false,
        gateInAt: '2026-10-21T08:45:00+07:00',
      },
    ],
    locationHistory: [
      {
        id: 'loc-1',
        masterDossierCode: 'HV-261019-001',
        containerNo: 'MSKU4089123',
        fromLocation: 'GATE-IN',
        toLocation: 'BLOCK-A (Chưa xếp Bay/Row/Tier)',
        actionType: 'INITIAL_BLOCK',
        reason: 'Hạ bãi ban đầu cấp Block sau GATE IN OK',
        performedBy: 'Phạm Hoàng Xe Nâng',
        performedAt: '2026-10-19T08:40:00+07:00',
      },
      {
        id: 'loc-2',
        masterDossierCode: 'HV-261019-001',
        containerNo: 'MSKU4089123',
        fromLocation: 'BLOCK-A (Chưa xếp Bay/Row/Tier)',
        toLocation: 'BLOCK-A / Bay 04 / Row 02 / Tier 01',
        actionType: 'DETAIL_SLOT_UPDATE',
        reason: 'Cập nhật vị trí chi tiết Bay/Row/Tier',
        performedBy: 'Phạm Hoàng Xe Nâng',
        performedAt: '2026-10-19T09:05:00+07:00',
      },
    ],
    masterReceipts: [
      {
        id: 'mpr-1',
        receiptCode: 'PTT-2026-001',
        qrCode: 'QR-TTT-VIETLOG-001',
        customerName: 'Công ty Tiếp Vận Việt (VietLog)',
        lotDescription: 'Đóng trước lô 20 cont rỗng tháng 10/2026',
        totalAmount: 15000000,
        remainingAmount: 13800000,
        status: 'ACTIVE',
        createdBy: 'Đỗ Kế Toán',
        createdAt: '2026-10-18T09:00:00+07:00',
      },
      {
        id: 'mpr-2',
        receiptCode: 'PTT-2026-002',
        qrCode: 'QR-TTT-NAMHAI-002',
        customerName: 'Vận Tải Nam Hải',
        lotDescription: 'Phiếu thu trả trước lô 10 cont',
        totalAmount: 5000000,
        remainingAmount: 5000000,
        status: 'ACTIVE',
        createdBy: 'Đỗ Kế Toán',
        createdAt: '2026-10-20T08:00:00+07:00',
      },
    ],
    receiptDeductions: [
      {
        id: 'ded-1',
        receiptCode: 'PTT-2026-001',
        qrCode: 'QR-TTT-VIETLOG-001',
        voucherNo: 'CT-GIN-261019-01',
        containerNo: 'MSKU4089123',
        deductedAmount: 1200000,
        balanceBefore: 15000000,
        balanceAfter: 13800000,
        performedBy: 'Trần Thị Minh (Văn Phòng)',
        performedAt: '2026-10-19T08:28:00+07:00',
      },
    ],
    vouchers: [
      {
        id: 'vch-1',
        masterDossierCode: 'HV-261019-001',
        voucherNo: 'CT-GIN-261019-01',
        serviceType: 'GATE_IN',
        referenceCode: 'HV-261019-001',
        containerNo: 'MSKU4089123',
        shippingLineCode: 'MAERSK',
        payerName: 'Công ty Tiếp Vận Việt (VietLog)',
        amount: 1200000,
        paymentCategory: 'TTT',
        scannedQrCode: 'QR-TTT-VIETLOG-001',
        masterReceiptCode: 'PTT-2026-001',
        status: 'CONFIRMED',
        confirmedBy: 'Trần Thị Minh (Văn Phòng)',
        confirmedAt: '2026-10-19T08:28:00+07:00',
        createdBy: 'Trần Thị Minh (Văn Phòng)',
        createdAt: '2026-10-19T08:25:00+07:00',
      },
      {
        id: 'vch-2',
        masterDossierCode: 'HV-261021-002',
        voucherNo: 'CT-GIN-261021-02',
        serviceType: 'GATE_IN',
        referenceCode: 'HV-261021-002',
        containerNo: 'ONEU5581920',
        shippingLineCode: 'ONE',
        payerName: 'Công ty Tiếp Vận Việt (VietLog)',
        amount: 850000,
        status: 'PENDING',
        createdBy: 'Trần Thị Minh (Văn Phòng)',
        createdAt: '2026-10-21T09:10:00+07:00',
      },
    ],
    paymentTransactions: [],
    paymentReceipts: [],
    gateInOrders: [
      {
        id: 'gin-1',
        masterDossierCode: 'HV-261021-003',
        orderCode: 'HV-261021-003',
        gateInType: 'CUSTOMER_RETURN',
        doorPhotoUrl: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80',
        conditionClass: 'DAMAGE',
        damageRemarks: ['Móp vách', 'Hỏng cửa/gioăng/khóa'],
        stuffingClass: 'K',
        cleaningItems: ['WW - RỬA NƯỚC', 'RM - NHỔ ĐINH', 'ML - BÓC TEM'],
        manufactureYear: 2017,
        fieldStaffName: 'Lê Hoàng Giám Định (Hạ vỏ & Báo giá)',
        fieldRecordedAt: '2026-10-21T09:15:00+07:00',
        feeAmount: 0,
        status: 'FIELD_RECORDED',
        nextDepartments: [],
      },
      {
        id: 'gin-2',
        masterDossierCode: 'HV-261021-002',
        orderCode: 'HV-261021-002',
        gateInType: 'CUSTOMER_RETURN',
        doorPhotoUrl: 'https://images.unsplash.com/photo-1494412574643-ff11b0a5c1c3?auto=format&fit=crop&w=800&q=80',
        conditionClass: 'AV',
        damageRemarks: [],
        stuffingClass: 'E',
        cleaningItems: ['WP - QUÉT', 'ML - BÓC TEM'],
        manufactureYear: 2021,
        fieldStaffName: 'Lê Hoàng Giám Định (Hạ vỏ & Báo giá)',
        fieldRecordedAt: '2026-10-21T09:00:00+07:00',
        feeAmount: 0,
        status: 'FIELD_RECORDED',
        nextDepartments: [],
      },
      {
        id: 'gin-3',
        masterDossierCode: 'HV-261021-001',
        orderCode: 'HV-261021-001',
        gateInType: 'CUSTOMER_RETURN',
        doorPhotoUrl: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=800&q=80',
        conditionClass: 'AV',
        damageRemarks: [],
        stuffingClass: 'E',
        cleaningItems: ['WW - RỬA NƯỚC'],
        manufactureYear: 2020,
        fieldStaffName: 'Lê Hoàng Giám Định (Hạ vỏ & Báo giá)',
        fieldRecordedAt: '2026-10-21T08:30:00+07:00',
        containerNo: 'MSKU9102388',
        size: '40',
        type: 'HC',
        truckNo: '15H-019.45',
        customerRep: 'Công ty Tiếp Vận Việt (VietLog)',
        shippingLineCode: 'MAERSK',
        orderDocNo: 'EIR-MSK-2026-502',
        officeStaffName: 'Trần Thị Minh (Văn Phòng)',
        officeVerifiedAt: '2026-10-21T08:40:00+07:00',
        feeAmount: 1100000,
        k80QrCode: 'QR-K80-MSKU9102388',
        status: 'GATE_IN_OK',
        gateInOkAt: '2026-10-21T08:45:00+07:00',
        gateInOkBy: 'Trần Thị Minh (Văn Phòng)',
        nextDepartments: ['XE NÂNG - CHỜ HẠ VỎ', 'VỆ SINH - CHỜ VỆ SINH'],
      },
    ],
    workOrders: [
      {
        id: 'wo-1',
        masterDossierCode: 'HV-261020-002',
        workOrderCode: 'INSP-261020-001',
        containerNo: 'CSNU7712309',
        category: 'INSPECTION',
        items: ['Móp vách', 'Hư sàn/xước sàn'],
        estimateCost: 0,
        approvalStatus: 'NOT_REQUIRED',
        workStatus: 'COMPLETED',
        assignedTo: 'Lê Hoàng Giám Định (Hạ vỏ & Báo giá)',
        resultNotes: 'Đã giám định và chuyển hàng chờ BÁO GIÁ',
        createdAt: '2026-10-20T13:25:00+07:00',
        completedAt: '2026-10-20T14:10:00+07:00',
      },
      {
        id: 'wo-2',
        masterDossierCode: 'HV-261020-002',
        workOrderCode: 'MNR-261020-001',
        containerNo: 'CSNU7712309',
        category: 'REPAIR',
        items: ['Móp vách', 'Hư sàn/xước sàn'],
        estimateCost: 2450000,
        approvalStatus: 'PENDING_APPROVAL',
        workStatus: 'OPEN',
        assignedTo: 'Đặng Kỹ Thuật Sửa Chữa',
        createdAt: '2026-10-20T14:15:00+07:00',
      },
      {
        id: 'wo-3',
        masterDossierCode: 'HV-261021-001',
        workOrderCode: 'CLN-261021-001',
        containerNo: 'MSKU9102388',
        category: 'CLEANING',
        sourceOrderCode: 'HV-261021-001',
        items: ['WW - RỬA NƯỚC'],
        estimateCost: 250000,
        approvalStatus: 'NOT_REQUIRED',
        workStatus: 'OPEN',
        assignedTo: 'Vũ Văn Vệ Sinh',
        createdAt: '2026-10-21T08:45:00+07:00',
      },
    ],
    bookings: [
      {
        id: 'bk-1',
        bookingNo: 'BK-MSK-2026-109',
        releaseType: 'EMPTY_RELEASE',
        shippingLineCode: 'MAERSK',
        requesterName: 'Công ty Tiếp Vận Việt (VietLog)',
        receiverName: 'Nhà máy Điện Tử Hải Phòng',
        size: '40',
        type: 'HC',
        requestedQty: 2,
        allocatedContainers: [],
        gatedOutContainers: [],
        status: 'OPEN',
        createdAt: '2026-10-21T08:00:00+07:00',
      },
    ],
    gateOutOrders: [
      {
        id: 'gout-1',
        masterDossierCode: 'HV-261018-001',
        gateOutCode: 'CV-261018-001',
        gateOutType: 'EMPTY_RELEASE',
        bookingNo: 'BK-MSK-2026-109',
        containerNo: 'MSKU3190024',
        truckNo: '15H-686.88',
        receiverRep: 'Công ty Tiếp Vận Việt (VietLog)',
        feeAmount: 450000,
        k80QrCode: 'QR-K80-MSKU3190024',
        chkValidOrder: true,
        chkNotOnHold: true,
        chkCorrectContainer: true,
        chkPaymentSettled: true,
        chkDocumentsCompleted: true,
        status: 'GATE_OUT_OK',
        confirmedBy: 'Phạm Hoàng Xe Nâng',
        confirmedAt: '2026-10-20T15:30:00+07:00',
        createdAt: '2026-10-20T15:00:00+07:00',
      },
    ],
    k80Tickets: [
      {
        ticketCode: 'K80-261021-001',
        masterDossierCode: 'HV-261021-001',
        qrCode: 'QR-K80-MSKU9102388',
        operationMode: 'HA_VO',
        isPaid: true,
        paymentLabel: 'TTT (Đã trừ Phiếu thu trả trước)',
        containerNo: 'MSKU9102388',
        size: '40',
        type: 'HC',
        conditionClass: 'AV',
        damageRemarks: [],
        stuffingClass: 'E',
        cleaningItems: ['WW - RỬA NƯỚC'],
        manufactureYear: 2020,
        truckNo: '15H-019.45',
        customerRep: 'Công ty Tiếp Vận Việt (VietLog)',
        issuedAt: '2026-10-21T08:45:00+07:00',
        issuedBy: 'Trần Thị Minh (Văn Phòng)',
      },
    ],
    auditLogs: [
      {
        id: 'aud-1',
        masterDossierCode: 'HV-261019-001',
        actorName: 'Trần Thị Minh (Văn Phòng)',
        actorRole: 'OFFICE',
        actionCode: 'GATE_IN_OK_TTT',
        entityType: 'GATE_IN',
        entityCode: 'HV-261019-001',
        summary: '[Hồ sơ HV-261019-001] Xác nhận TTT quét mã QR-TTT-VIETLOG-001 trừ 1,200,000đ -> Cập nhật GATE IN OK & In phiếu K80 cho MSKU4089123',
        createdAt: '2026-10-19T08:28:00+07:00',
      },
    ],
    repairTeams: [
      {
        id: 'rt-1',
        code: 'TO-SC-01',
        name: 'Tổ sửa chữa 1',
        isActive: true,
        members: [
          { id: 'rtm-1', fullName: 'Đặng Kỹ Thuật Sửa Chữa', isActive: true, staffUserId: 'usr-repair' },
          { id: 'rtm-2', fullName: 'Nguyễn Văn Hàn', isActive: true },
        ],
      },
    ],
    // Dữ liệu mẫu — Admin sửa tại Danh mục chung → Công ty
    companyProfile: {
      name: 'CÔNG TY MATRAN DEPOT',
      shortName: 'MATRAN DEPOT',
      address: '',
      phone: '',
      email: '',
      taxCode: '',
      bankAccount: '',
    },
    vesselLists: [],
    codeCounters: {},
  };
}

// Bổ sung các trường mới cho dữ liệu demo đã lưu từ phiên bản trước, không xóa dữ liệu cũ
export function normalizeDepotState(input: Partial<DepotState>): DepotState {
  // DEC-068: đổi mã cũ IN-/HS- → HV-, OUT-/GO- → CV-, PTM- → PTT-
  const raw = renameLegacyCodes(input);
  const base = createInitialState();
  // DEC-047: nhân viên cổng / hiện trường → Giám định; DEC-111: Kế toán (ACCOUNTANT) được dùng lại, không đổi nữa
  // DEC-049: bỏ QC Sửa chữa → Sửa chữa
  const LEGACY_ROLE: Record<string, AppRole> = { GATE_STAFF: 'INSPECTOR', YARD_STAFF: 'INSPECTOR', REPAIR_QC: 'REPAIR_STAFF' };
  const staffUsers = (raw.staffUsers || base.staffUsers).map((u) => ({
    ...u,
    roles: Array.from(new Set(u.roles.map((r) => LEGACY_ROLE[r as string] || r))) as AppRole[],
  }));
  for (const seed of INITIAL_STAFF) {
    if (!staffUsers.some((u) => u.id === seed.id)) staffUsers.push(seed);
  }
  const currentUser =
    staffUsers.find((u) => u.id === raw.currentUser?.id) || staffUsers[0];

  // TTS là công nợ (chưa thu tiền) — không còn ghi nhận là CONFIRMED (đã thanh toán)
  const vouchers = (raw.vouchers || base.vouchers).map((v) =>
    v.paymentCategory === 'TTS' && v.status === 'CONFIRMED'
      ? { ...v, status: 'DEFERRED' as const }
      : v
  );

  // DEC-049: bỏ bước QC — container đang "chờ nghiệm thu" ở dữ liệu cũ coi như đã sửa xong → AV
  const containers = (raw.containers || base.containers).map((c) => {
    const legacy = c as typeof c & { needsQcInspection?: boolean };
    if (!legacy.needsQcInspection) return c;
    const { needsQcInspection: _drop, ...rest } = legacy;
    void _drop;
    return { ...rest, conditionClass: 'AV' as const, damageRemarks: [] };
  });

  return {
    ...base,
    ...raw,
    containers,
    currentUser,
    staffUsers,
    vouchers,
    paymentTransactions: raw.paymentTransactions || [],
    paymentReceipts: ensureInvoiceFields(raw.paymentReceipts || []), // DEC-111
    repairTeams: raw.repairTeams || base.repairTeams,
    companyProfile: { ...base.companyProfile, ...(raw.companyProfile || {}) },
    vesselLists: raw.vesselLists || [],
    codeCounters: raw.codeCounters || {},
  } as DepotState;
}

// DEC-106: DỮ LIỆU SẠCH — giữ danh mục (nhân viên, khách hàng / hãng tàu, block, size / type, biểu phí, tổ sửa chữa, công ty),
// xóa toàn bộ dữ liệu tác nghiệp (container, lệnh, chứng từ, giao dịch, phiếu thu, phiếu thu trả trước, K80, tàu, nhật ký, bộ đếm mã).
// createInitialState() (có dữ liệu mẫu) chỉ còn dùng cho test.
export function createCleanState(): DepotState {
  return {
    ...createInitialState(),
    containers: [],
    locationHistory: [],
    masterReceipts: [],
    receiptDeductions: [],
    vouchers: [],
    paymentTransactions: [],
    paymentReceipts: [],
    gateInOrders: [],
    workOrders: [],
    bookings: [],
    gateOutOrders: [],
    k80Tickets: [],
    auditLogs: [],
    vesselLists: [],
    codeCounters: {},
  };
}

// DEC-108: chưa có dữ liệu lưu → dùng fallback (App truyền dữ liệu test); mặc định dữ liệu sạch
export function loadDepotState(fallback: () => DepotState = createCleanState): DepotState {
  try {
    for (const key of LEGACY_STORAGE_KEYS) localStorage.removeItem(key);
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback();
    return normalizeDepotState(JSON.parse(raw) as Partial<DepotState>);
  } catch {
    return fallback();
  }
}

export function saveDepotState(state: DepotState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors
  }
}

// DEC-106: Xóa dữ liệu → dữ liệu sạch; DEC-108: Nạp dữ liệu test → truyền createDemoState
export function resetDepotState(build: () => DepotState = createCleanState): DepotState {
  const initial = build();
  saveDepotState(initial);
  return initial;
}

export { hasRolePermission } from './permissions';

export function formatVnd(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}
