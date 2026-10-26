import { describe, expect, it } from 'vitest';
import { createInitialState, createCleanState, DepotState, normalizeDepotState } from '../src/services/depotStore';
import { myFeedbacks, respondFeedback, submitFeedback } from '../src/services/feedback';
import { canOpenMenu } from '../src/services/permissions';
import { collectAllPages, feedbackSheet, queryFeedback } from '../src/services/reports';

const as = (state: DepotState, userId: string): DepotState => ({ ...state, currentUser: state.staffUsers.find((u) => u.id === userId)! });
const INPUT = { menuId: 'TON_VO', menuLabel: 'Tồn vỏ', content: 'Thêm cột ngày dự kiến cấp.' };

describe('DEC-120: Góp ý xây dựng hệ thống', () => {
  it('mọi người dùng gửi được; mã GY-YYMMDD-NNN; chỉ thấy góp ý của mình', () => {
    let s = submitFeedback(as(createInitialState(), 'usr-forklift'), INPUT);
    s = submitFeedback(as(s, 'usr-office'), { ...INPUT, content: 'Góp ý thứ hai của Văn phòng' });
    expect(s.feedbacks).toHaveLength(2);
    expect(s.feedbacks[1].code).toMatch(/^GY-[0-9]{6}-001$/);
    expect(s.feedbacks[0].code).toMatch(/^GY-[0-9]{6}-002$/);
    expect(s.feedbacks[1]).toMatchObject({ status: 'MOI', menuId: 'TON_VO', menuLabel: 'Tồn vỏ', createdById: 'usr-forklift' });
    expect(myFeedbacks(as(s, 'usr-forklift')).map((f) => f.createdById)).toEqual(['usr-forklift']);
    expect(myFeedbacks(as(s, 'usr-cleaning'))).toHaveLength(0);
    expect(s.auditLogs[0].actionCode).toBe('FEEDBACK_SUBMIT');
  });

  it('từ chối: chưa chọn menu, nội dung quá ngắn / quá dài, tài khoản khóa', () => {
    const s = as(createInitialState(), 'usr-forklift');
    expect(() => submitFeedback(s, { ...INPUT, menuId: '', menuLabel: '' })).toThrow(/MENU/);
    expect(() => submitFeedback(s, { ...INPUT, content: ' ab ' })).toThrow(/quá ngắn/);
    expect(() => submitFeedback(s, { ...INPUT, content: 'x'.repeat(2001) })).toThrow(/tối đa/);
    expect(() => submitFeedback({ ...s, currentUser: { ...s.currentUser, isActive: false } }, INPUT)).toThrow(/không hoạt động/);
  });

  it('chỉ Admin xem báo cáo + xử lý; kết thúc phải có phản hồi; Excel đủ cột', () => {
    let s = submitFeedback(as(createInitialState(), 'usr-forklift'), INPUT);
    const id = s.feedbacks[0].id;
    expect(canOpenMenu(as(s, 'usr-admin').currentUser, 'BC_GOP_Y')).toBe(true);
    for (const u of ['usr-office', 'usr-forklift', 'usr-acc']) expect(canOpenMenu(as(s, u).currentUser, 'BC_GOP_Y')).toBe(false);
    expect(() => queryFeedback(as(s, 'usr-office'), {})).toThrow(/Không đủ quyền/);
    expect(() => respondFeedback(as(s, 'usr-office'), { id, status: 'DANG_XU_LY' })).toThrow(/Không đủ quyền/);
    expect(() => respondFeedback(as(s, 'usr-admin'), { id, status: 'DA_XU_LY', response: ' ' })).toThrow(/PHẢN HỒI/);
    s = respondFeedback(as(s, 'usr-admin'), { id, status: 'DANG_XU_LY' });
    s = respondFeedback(as(s, 'usr-admin'), { id, status: 'KHONG_AP_DUNG', response: 'Đã có ở Báo cáo Tổng hợp' });
    expect(s.feedbacks[0]).toMatchObject({ status: 'KHONG_AP_DUNG', response: 'Đã có ở Báo cáo Tổng hợp', respondedBy: expect.any(String) });
    expect(myFeedbacks(as(s, 'usr-forklift'))[0].response).toBe('Đã có ở Báo cáo Tổng hợp');
    const admin = as(s, 'usr-admin');
    expect(queryFeedback(admin, { status: 'KHONG_AP_DUNG' }).total).toBe(1);
    expect(queryFeedback(admin, { status: 'MOI' }).total).toBe(0);
    expect(queryFeedback(admin, { keyword: 'ngày dự kiến' }).total).toBe(1);
    const sheet = feedbackSheet(collectAllPages((p) => queryFeedback(admin, {}, p)));
    expect(sheet.columns).toContain('MENU / TÍNH NĂNG');
    expect(sheet.rows[0]).toContain('KHÔNG ÁP DỤNG');
    for (const r of sheet.rows) expect(r.length).toBe(sheet.columns.length);
  });

  it('dữ liệu cũ chưa có góp ý vẫn nạp được', () => {
    const raw = { ...createCleanState() } as Partial<DepotState>;
    delete raw.feedbacks;
    expect(normalizeDepotState(raw).feedbacks).toEqual([]);
  });
});
