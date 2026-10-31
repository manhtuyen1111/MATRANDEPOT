// ============================================================================
// DEC-202 (cập nhật 2026-10-31): TỒN VỎ & ĐẢO CHUYỂN giữ 2 cột TRẠNG THÁI + TIẾN ĐỘ (cột TIẾN ĐỘ nằm ngay bên cạnh cột TRẠNG THÁI).
// - Cột TRẠNG THÁI: DAMAGE / AV (cont W-SURVEY chưa giám định bổ sung → để trống).
// - Cột TIẾN ĐỘ: chỉ hiển thị đúng 1 tiến độ chờ thực tế (xét từ trên xuống, khớp điều kiện nào trước thì lấy; không chờ việc gì → null):
//   1 CHỜ GIÁM ĐỊNH      — cont W-SURVEY đã lên kệ (trong bãi), chưa giám định bổ sung (DEC-147)
//   2 CHỜ VỆ SINH        — còn việc vệ sinh chưa xong
//   3 CHỜ XE NÂNG        — chờ hạ vỏ / hạ lại (đổi cont) / đã thu tiền chờ cấp
//   4 CHỜ VĂN PHÒNG      — đã lập lệnh cấp vỏ, chưa thu tiền
//   5 CHỜ BÁO GIÁ        — cont hư, Báo giá chưa cập nhật tình trạng sửa chữa
//   6 CHỜ DUYỆT SỬA CHỮA — Báo giá đã lưu tình trạng + giờ công (bước 1 DEC-086), chưa xác nhận chờ sửa chữa
//   7 CHỜ SỬA CHỮA       — đã xác nhận, chờ tổ sửa chữa
// ============================================================================
import type { ContainerRecord } from '../types/depot';
import type { DepotState } from './depotStore';

export type YardCondition = 'DAMAGE' | 'AV';
export const YARD_CONDITIONS: YardCondition[] = ['DAMAGE', 'AV'];

export function yardCondition(c: ContainerRecord): YardCondition | null {
  if (c.conditionClass === 'DAMAGE') return 'DAMAGE';
  if (c.conditionClass === 'AV') return 'AV';
  return null;
}

export type YardProgress =
  | 'CHO_GIAM_DINH'
  | 'CHO_VAN_PHONG'
  | 'CHO_VE_SINH'
  | 'CHO_XE_NANG'
  | 'CHO_BAO_GIA'
  | 'CHO_DUYET_SUA_CHUA'
  | 'CHO_SUA_CHUA';

// Thứ tự = thứ tự ô lọc Tiến độ người dùng chốt
export const YARD_PROGRESS_LABELS: Record<YardProgress, string> = {
  CHO_GIAM_DINH: 'CHỜ GIÁM ĐỊNH',
  CHO_VAN_PHONG: 'CHỜ VĂN PHÒNG',
  CHO_VE_SINH: 'CHỜ VỆ SINH',
  CHO_XE_NANG: 'CHỜ XE NÂNG',
  CHO_BAO_GIA: 'CHỜ BÁO GIÁ',
  CHO_DUYET_SUA_CHUA: 'CHỜ DUYỆT SỬA CHỮA',
  CHO_SUA_CHUA: 'CHỜ SỬA CHỮA',
};
export const YARD_PROGRESSES = Object.keys(YARD_PROGRESS_LABELS) as YardProgress[];

// Báo giá đã lưu bước 1 (đủ điều kiện bấm XÁC NHẬN CHỜ SỬA CHỮA — cùng điều kiện confirmQuotationToRepair)
const quotationSaved = (c: ContainerRecord) => Boolean(c.quotationItems?.length) && Number(c.quotationLaborHours) > 0;

export function yardProgress(state: Pick<DepotState, 'gateOutOrders'> | undefined, c: ContainerRecord): YardProgress | null {
  if (c.conditionClass === 'W-SURVEY' && c.status === 'IN_YARD') return 'CHO_GIAM_DINH';
  if (c.needsCleaning) return 'CHO_VE_SINH';
  const order =
    c.status === 'ALLOCATED'
      ? state?.gateOutOrders.find(
          (o) => o.containerNo === c.containerNo && o.masterDossierCode === c.masterDossierCode && (o.status === 'PAYMENT_PENDING' || o.status === 'PENDING_FORKLIFT')
        )
      : undefined;
  if (c.status === 'WAITING_PLACEMENT' || c.swapReturn || order?.status === 'PENDING_FORKLIFT') return 'CHO_XE_NANG';
  if (order?.status === 'PAYMENT_PENDING') return 'CHO_VAN_PHONG';
  if (c.needsQuotation) return quotationSaved(c) ? 'CHO_DUYET_SUA_CHUA' : 'CHO_BAO_GIA';
  if (c.needsRepair) return 'CHO_SUA_CHUA';
  return null;
}
