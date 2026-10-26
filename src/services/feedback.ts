// ============================================================================
// DEC-120: GÓP Ý XÂY DỰNG HỆ THỐNG
//   - Mọi người dùng đang hoạt động gửi góp ý: chọn MENU / TÍNH NĂNG + NỘI DUNG (nút "Góp ý" góc trên bên phải).
//   - Mã góp ý GY-YYMMDD-NNN cấp qua codes.ts.
//   - Chỉ ADMIN xem Báo cáo → Góp ý, cập nhật trạng thái + phản hồi:
//       MỚI → ĐANG XỬ LÝ → ĐÃ XỬ LÝ / KHÔNG ÁP DỤNG
//   - Người góp ý chỉ xem được góp ý của chính mình (trạng thái + phản hồi).
// ============================================================================
import type { FeedbackItem, FeedbackStatus } from '../types/depot';
import type { DepotState } from './depotStore';
import { allocateCode } from './codes';
import { appendAudit, assertPermission, newId, nowIso } from './core';

export const FEEDBACK_STATUS_LABELS: Record<FeedbackStatus, string> = {
  MOI: 'MỚI',
  DANG_XU_LY: 'ĐANG XỬ LÝ',
  DA_XU_LY: 'ĐÃ XỬ LÝ',
  KHONG_AP_DUNG: 'KHÔNG ÁP DỤNG',
};

export const FEEDBACK_OTHER_MENU = 'KHAC';
export const FEEDBACK_MAX_LENGTH = 2000;

export function submitFeedback(state: DepotState, input: { menuId: string; menuLabel: string; content: string }): DepotState {
  if (!state.currentUser?.isActive) throw new Error('Tài khoản không hoạt động — không gửi được góp ý.');
  const menuId = input.menuId.trim();
  const menuLabel = input.menuLabel.trim();
  if (!menuId || !menuLabel) throw new Error('Vui lòng chọn MENU / TÍNH NĂNG cần góp ý.');
  const content = input.content.trim();
  if (content.length < 5) throw new Error('Nội dung góp ý quá ngắn (tối thiểu 5 ký tự).');
  if (content.length > FEEDBACK_MAX_LENGTH) throw new Error(`Nội dung góp ý tối đa ${FEEDBACK_MAX_LENGTH} ký tự.`);
  const allocated = allocateCode(state, 'GY');
  const item: FeedbackItem = {
    id: newId('gy'),
    code: allocated.code,
    menuId,
    menuLabel,
    content,
    status: 'MOI',
    createdAt: nowIso(),
    createdById: state.currentUser.id,
    createdBy: state.currentUser.fullName,
  };
  return appendAudit(
    { ...allocated.state, feedbacks: [item, ...(allocated.state.feedbacks || [])] },
    'FEEDBACK_SUBMIT',
    'FEEDBACK',
    item.code,
    `[Góp ý ${item.code}] ${state.currentUser.fullName} góp ý về "${menuLabel}"`
  );
}

// Chỉ ADMIN: đổi trạng thái + ghi phản hồi cho người góp ý
export function respondFeedback(state: DepotState, input: { id: string; status: FeedbackStatus; response?: string }): DepotState {
  assertPermission(state, 'FEEDBACK_MANAGE', 'chỉ Quản trị viên (Admin) được xử lý góp ý.');
  const item = (state.feedbacks || []).find((f) => f.id === input.id);
  if (!item) throw new Error('Không tìm thấy góp ý.');
  if (!FEEDBACK_STATUS_LABELS[input.status]) throw new Error('Trạng thái góp ý không hợp lệ.');
  const response = input.response?.trim() || undefined;
  if ((input.status === 'DA_XU_LY' || input.status === 'KHONG_AP_DUNG') && !response) {
    throw new Error('Vui lòng ghi PHẢN HỒI cho người góp ý khi kết thúc (Đã xử lý / Không áp dụng).');
  }
  const updated: FeedbackItem = { ...item, status: input.status, response, respondedAt: nowIso(), respondedBy: state.currentUser.fullName };
  return appendAudit(
    { ...state, feedbacks: (state.feedbacks || []).map((f) => (f.id === item.id ? updated : f)) },
    'FEEDBACK_RESPOND',
    'FEEDBACK',
    item.code,
    `[Góp ý ${item.code}] Admin cập nhật ${FEEDBACK_STATUS_LABELS[input.status]}${response ? ` — ${response}` : ''}`
  );
}

// Góp ý của chính người đang đăng nhập (mới nhất trước)
export function myFeedbacks(state: DepotState): FeedbackItem[] {
  return (state.feedbacks || []).filter((f) => f.createdById === state.currentUser.id);
}
