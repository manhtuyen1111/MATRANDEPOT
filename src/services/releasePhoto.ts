// ============================================================================
// DEC-198: GIÁM ĐỊNH CHỤP ẢNH CẤP VỎ — chỉ cont hãng MSK (eEIR gate-out bắt buộc ≥ 1 ảnh).
//   Xe nâng cấp lên xe (GATE OUT OK) → Giám định chụp 1–30 ảnh → mới được Trả chứng từ (bước trên lộ trình K80).
//   Ảnh gắn với SỐ CONT đã chụp: đổi container (DEC-185 / DEC-192) thì cont mới phải chụp lại.
// ============================================================================
import type { ContainerRecord, GateOutOrder } from '../types/depot';
import type { DepotState } from './depotStore';
import { appendAudit, assertPermission, nowIso } from './core';
import { formatDateTime } from './datetime';

export const RELEASE_PHOTO_LINES = ['MSK'];
export const RELEASE_PHOTO_MIN = 1;
export const RELEASE_PHOTO_MAX = 30;

export const releaseContainerOf = (state: DepotState, order: GateOutOrder): ContainerRecord | undefined =>
  state.containers.find((c) => c.masterDossierCode === order.masterDossierCode && c.containerNo === order.containerNo);

// Lệnh cấp này có phải chụp ảnh cấp vỏ không (theo hãng của cont đang được cấp)
export function needsReleasePhoto(state: DepotState, order: GateOutOrder | undefined): boolean {
  if (!order) return false;
  return RELEASE_PHOTO_LINES.includes(releaseContainerOf(state, order)?.shippingLineCode || '');
}

// Đã có ảnh cấp vỏ của ĐÚNG cont đang cấp
export const hasReleasePhoto = (order: GateOutOrder | undefined) =>
  Boolean(order?.releasePhotos?.length && order.releasePhotoContainerNo === order.containerNo);

// Hàng chờ Giám định → Cấp vỏ: đã OUT, chưa trả chứng từ, cont MSK, chưa có ảnh — cũ trước
export function pendingReleasePhotos(state: DepotState): GateOutOrder[] {
  return state.gateOutOrders
    .filter((o) => o.status === 'GATE_OUT_OK' && !o.documentsReturnedAt && needsReleasePhoto(state, o) && !hasReleasePhoto(o))
    .sort((a, b) => (a.confirmedAt || '').localeCompare(b.confirmedAt || ''));
}

export function recordReleasePhotos(state: DepotState, input: { gateOutOrderId: string; photos: string[] }): DepotState {
  assertPermission(state, 'GATE_IN_FIELD', 'chỉ Giám định / Quản lý được chụp ảnh cấp vỏ.');
  const order = state.gateOutOrders.find((o) => o.id === input.gateOutOrderId);
  if (!order) throw new Error('Không tìm thấy lệnh cấp vỏ.');
  if (order.documentsReturnedAt) throw new Error(`Lệnh ${order.gateOutCode} đã trả chứng từ — không chụp thêm.`);
  if (order.status !== 'GATE_OUT_OK') throw new Error(`Xe nâng chưa cấp cont ${order.containerNo} lên xe — chưa chụp ảnh cấp vỏ được.`);
  if (!needsReleasePhoto(state, order)) throw new Error(`Cont ${order.containerNo} không thuộc hãng phải chụp ảnh cấp vỏ.`);
  if (hasReleasePhoto(order)) throw new Error(`Đã chụp ảnh cấp vỏ cont ${order.containerNo} lúc ${formatDateTime(order.releasePhotosAt)} (${order.releasePhotosBy}).`);
  const photos = (input.photos || []).filter(Boolean);
  if (photos.length < RELEASE_PHOTO_MIN) throw new Error('Vui lòng CHỤP ẢNH CẤP VỎ (ít nhất 1 ảnh).');
  if (photos.length > RELEASE_PHOTO_MAX) throw new Error(`Tối đa ${RELEASE_PHOTO_MAX} ảnh cấp vỏ / container.`);

  const now = nowIso();
  const by = state.currentUser.fullName;
  const next: DepotState = {
    ...state,
    gateOutOrders: state.gateOutOrders.map((o) =>
      o.id === order.id ? { ...o, releasePhotos: photos, releasePhotoContainerNo: order.containerNo, releasePhotosAt: now, releasePhotosBy: by } : o
    ),
  };
  return appendAudit(
    next,
    'RELEASE_PHOTOS',
    'GATE_OUT',
    order.gateOutCode,
    `[Hồ sơ ${order.gateOutCode}] Giám định chụp ${photos.length} ảnh cấp vỏ cont ${order.containerNo}`,
    order.masterDossierCode
  );
}
