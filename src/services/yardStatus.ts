// ============================================================================
// DEC-202: TRẠNG THÁI TỒN VỎ — mỗi cont đúng 1 trạng thái hiện tại (thay cột Trạng thái AV / DAMAGE + cột Tiến độ).
// Xét từ trên xuống, khớp điều kiện nào trước thì lấy trạng thái đó (người dùng chốt 2026-10-31):
//   1 CHỜ GIÁM ĐỊNH      — cont W-SURVEY đã lên kệ (trong bãi), chưa giám định bổ sung (DEC-147)
//   2 CHỜ VỆ SINH        — còn việc vệ sinh chưa xong
//   3 CHỜ XE NÂNG        — chờ hạ vỏ / hạ lại (đổi cont) / đã thu tiền chờ cấp
//   4 CHỜ VĂN PHÒNG      — đã lập lệnh cấp vỏ, chưa thu tiền
//   5 CHỜ BÁO GIÁ        — cont hư, Báo giá chưa cập nhật tình trạng sửa chữa
//   6 CHỜ DUYỆT SỬA CHỮA — Báo giá đã lưu tình trạng + giờ công (bước 1 DEC-086), chưa xác nhận chờ sửa chữa
//   7 CHỜ SỬA CHỮA       — đã xác nhận, chờ tổ sửa chữa
//   8 DAMAGE / AV        — không chờ việc gì → tình trạng vỏ
// ============================================================================
import type { ContainerRecord } from '../types/depot';
import type { DepotState } from './depotStore';

export type YardStatus =
  | 'CHO_GIAM_DINH'
  | 'CHO_VE_SINH'
  | 'CHO_XE_NANG'
  | 'CHO_VAN_PHONG'
  | 'CHO_BAO_GIA'
  | 'CHO_DUYET_SUA_CHUA'
  | 'CHO_SUA_CHUA'
  | 'DAMAGE'
  | 'AV';

// Thứ tự = thứ tự ô lọc (2 tình trạng vỏ trước, rồi các bước chờ theo luồng)
export const YARD_STATUS_LABELS: Record<YardStatus, string> = {
  DAMAGE: 'DAMAGE',
  AV: 'AV',
  CHO_GIAM_DINH: 'CHỜ GIÁM ĐỊNH',
  CHO_VAN_PHONG: 'CHỜ VĂN PHÒNG',
  CHO_VE_SINH: 'CHỜ VỆ SINH',
  CHO_XE_NANG: 'CHỜ XE NÂNG',
  CHO_BAO_GIA: 'CHỜ BÁO GIÁ',
  CHO_DUYET_SUA_CHUA: 'CHỜ DUYỆT SỬA CHỮA',
  CHO_SUA_CHUA: 'CHỜ SỬA CHỮA',
};
export const YARD_STATUSES = Object.keys(YARD_STATUS_LABELS) as YardStatus[];

// Báo giá đã lưu bước 1 (đủ điều kiện bấm XÁC NHẬN CHỜ SỬA CHỮA — cùng điều kiện confirmQuotationToRepair)
const quotationSaved = (c: ContainerRecord) => Boolean(c.quotationItems?.length) && Number(c.quotationLaborHours) > 0;

export function yardStatus(state: DepotState, c: ContainerRecord): YardStatus {
  if (c.conditionClass === 'W-SURVEY' && c.status === 'IN_YARD') return 'CHO_GIAM_DINH';
  if (c.needsCleaning) return 'CHO_VE_SINH';
  const order =
    c.status === 'ALLOCATED'
      ? state.gateOutOrders.find(
          (o) => o.containerNo === c.containerNo && o.masterDossierCode === c.masterDossierCode && (o.status === 'PAYMENT_PENDING' || o.status === 'PENDING_FORKLIFT')
        )
      : undefined;
  if (c.status === 'WAITING_PLACEMENT' || c.swapReturn || order?.status === 'PENDING_FORKLIFT') return 'CHO_XE_NANG';
  if (order?.status === 'PAYMENT_PENDING') return 'CHO_VAN_PHONG';
  if (c.needsQuotation) return quotationSaved(c) ? 'CHO_DUYET_SUA_CHUA' : 'CHO_BAO_GIA';
  if (c.needsRepair) return 'CHO_SUA_CHUA';
  return c.conditionClass === 'DAMAGE' ? 'DAMAGE' : 'AV';
}
