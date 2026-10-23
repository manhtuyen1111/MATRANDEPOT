import { AppRole, StaffUser, WorkspaceMenuId } from '../types/depot';

// ============================================================================
// MA TRẬN QUYỀN THAO TÁC — nguồn duy nhất cho cả kiểm tra nghiệp vụ và hiển thị menu.
// ADMIN luôn có toàn quyền (hasRolePermission). Đồng bộ với docs/ROLE_PERMISSION_MATRIX.md.
// Ở chế độ Supabase, cùng ma trận này phải được kiểm tra trong RPC/RLS (không tin frontend).
// ============================================================================
export const PERMISSIONS = {
  GATE_IN_FIELD: ['INSPECTOR', 'MANAGER'],
  GATE_IN_OFFICE: ['OFFICE', 'MANAGER'],
  PAYMENT_CONFIRM: ['OFFICE', 'MANAGER'],
  // DEC-035: Văn phòng được hoàn tất thêm Vệ sinh và Xe nâng; Báo giá / Sửa chữa chỉ bộ phận đó
  CLEANING_COMPLETE: ['CLEANING', 'OFFICE'],
  FORKLIFT_OPS: ['FORKLIFT', 'OFFICE', 'MANAGER'],
  QUOTATION: ['QUOTATION'],
  REPAIR: ['REPAIR_STAFF'],
  YARD_LOCATION_CORRECT: ['OFFICE', 'MANAGER'],
  CONTAINER_LOCK: ['OFFICE', 'MANAGER'],
  OFFICE_NOTE: ['OFFICE', 'MANAGER'],
  RELEASE_ORDER: ['OFFICE', 'MANAGER'],
  GATE_OUT_CONFIRM: ['FORKLIFT', 'OFFICE', 'MANAGER'],
  // DEC-047: bỏ vai trò Kế toán — Văn phòng tạo phiếu thu TTT và xác nhận tiền mặt
  RECEIPT_VIEW: ['OFFICE', 'MANAGER'],
  PREPAID_RECEIPT_CREATE: ['OFFICE'],
  PREPAID_CASH_CONFIRM: ['OFFICE'],
  REPORT_FINANCE: ['OFFICE', 'MANAGER'],
  DEMO_BANK_SIMULATOR: ['OFFICE', 'MANAGER'],
  // DEC-069: NHẬP TÀU / XUẤT TÀU
  VESSEL_LIST_MANAGE: ['OFFICE', 'MANAGER'],
  VESSEL_IMPORT_INSPECT: ['INSPECTOR', 'MANAGER'],
  VESSEL_EXPORT_EXECUTE: ['INSPECTOR', 'FORKLIFT', 'MANAGER'],
  CATALOG_EDIT: [] as AppRole[],
} satisfies Record<string, AppRole[]>;

export type PermissionKey = keyof typeof PERMISSIONS;

export function hasRolePermission(user: StaffUser, allowedRoles: AppRole[]): boolean {
  if (!user.isActive) return false;
  if (user.roles.includes('ADMIN')) return true;
  return user.roles.some((r) => allowedRoles.includes(r));
}

export function can(user: StaffUser, permission: PermissionKey): boolean {
  return hasRolePermission(user, PERMISSIONS[permission]);
}

// DEC-045: mỗi vai trò chỉ thấy màn làm việc của mình. Văn phòng / Quản lý là khối văn phòng dùng chung báo cáo & danh mục (xem).
const OFFICE_BLOCK: AppRole[] = ['OFFICE', 'MANAGER'];

// Quyền hiển thị menu (chỉ ẩn/hiện; thao tác vẫn được kiểm tra trong từng nghiệp vụ). ADMIN luôn thấy tất cả.
export const MENU_ACCESS: Record<WorkspaceMenuId, AppRole[]> = {
  TON_VO: ['OFFICE', 'MANAGER'],
  GD_HA_VO: PERMISSIONS.GATE_IN_FIELD,
  VP_HA_VO: OFFICE_BLOCK,
  VP_CAP_VO: OFFICE_BLOCK,
  VP_PHIEU_THU: PERMISSIONS.RECEIPT_VIEW,
  VP_TRA_CHUNG_TU: PERMISSIONS.GATE_IN_OFFICE,
  VP_NHAP_TAU: ['OFFICE', 'MANAGER'],
  VP_XUAT_TAU: ['OFFICE', 'MANAGER'],
  GD_NHAP_TAU: PERMISSIONS.VESSEL_IMPORT_INSPECT,
  GD_XUAT_TAU: ['INSPECTOR', 'MANAGER'],
  XN_NHAP_TAU: PERMISSIONS.FORKLIFT_OPS,
  XN_XUAT_TAU: ['FORKLIFT', 'MANAGER'],
  VS_CHO_VE_SINH: ['CLEANING', 'OFFICE', 'MANAGER'],
  XN_CHO_HA_VO: PERMISSIONS.FORKLIFT_OPS,
  XN_CHO_CAP_VO: PERMISSIONS.GATE_OUT_CONFIRM,
  XN_DAO_CHUYEN: PERMISSIONS.FORKLIFT_OPS,
  BG_CHO_BAO_GIA: PERMISSIONS.QUOTATION,
  SC_CHO_SUA_CHUA: PERMISSIONS.REPAIR,
  BC_HA_VO: OFFICE_BLOCK,
  BC_CAP_VO: OFFICE_BLOCK,
  BC_NHAP_TAU: OFFICE_BLOCK,
  BC_XUAT_TAU: OFFICE_BLOCK,
  BC_TONG_HOP: PERMISSIONS.REPORT_FINANCE,
  BC_SUA_CHUA: OFFICE_BLOCK,
  DM_SUA_CHUA: OFFICE_BLOCK,
  DM_CONG_TY: OFFICE_BLOCK,
  DM_KHACH_HANG: OFFICE_BLOCK,
  DM_HANG_TAU: OFFICE_BLOCK,
  DM_VI_TRI: OFFICE_BLOCK,
  DM_CONTAINER: OFFICE_BLOCK,
  DM_BIEU_GIA: OFFICE_BLOCK,
  DM_USER: [],
};

// Vai trò được chọn trong màn USER - PHÂN QUYỀN (DEC-045, DEC-047)
export const ASSIGNABLE_ROLES: AppRole[] = [
  'INSPECTOR',
  'OFFICE',
  'FORKLIFT',
  'CLEANING',
  'QUOTATION',
  'MANAGER',
  'ADMIN',
  'REPAIR_STAFF',
];

export function canOpenMenu(user: StaffUser, menuId: WorkspaceMenuId): boolean {
  return hasRolePermission(user, MENU_ACCESS[menuId]);
}
