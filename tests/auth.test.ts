import { describe, expect, it } from 'vitest';
import { createInitialState, DepotState, normalizeDepotState } from '../src/services/depotStore';
import { addStaffUser, updateStaffUser } from '../src/services/depotOperations';
import { changePassword, DEFAULT_PASSWORD, isLoggedIn, login, logout, mustChangePassword, resetStaffPassword, sha256Hex } from '../src/services/auth';

const as = (s: DepotState, id: string) => ({ ...s, currentUser: s.staffUsers.find((u) => u.id === id)! });
const admin = () => as(createInitialState(), 'usr-admin');

describe('DEC-143: tài khoản do Admin tạo, mật khẩu mặc định 123456, đổi khi đăng nhập lần đầu', () => {
  it('SHA-256 đúng chuẩn', () => {
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  });

  it('Admin tạo tài khoản → nhân viên đăng nhập 123456 → bắt buộc đổi → đăng nhập bằng mật khẩu mới', () => {
    let s = addStaffUser(admin(), { fullName: 'Lê Văn Tuấn', username: 'GD.Tuan', roles: ['INSPECTOR'] });
    const u = s.staffUsers.find((x) => x.username === 'gd.tuan')!; // tên đăng nhập chuẩn hóa chữ thường
    expect(u.email).toBe(''); // email không bắt buộc
    expect(mustChangePassword(u)).toBe(true);
    s = logout(s);
    expect(isLoggedIn(s)).toBe(false);
    s = login(s, { username: 'gd.tuan', password: DEFAULT_PASSWORD });
    expect(isLoggedIn(s)).toBe(true);
    expect(s.currentUser.id).toBe(u.id);
    expect(mustChangePassword(s.currentUser)).toBe(true);
    s = changePassword(s, { currentPassword: DEFAULT_PASSWORD, newPassword: 'tuan2026', confirmPassword: 'tuan2026' });
    expect(mustChangePassword(s.currentUser)).toBe(false);
    const saved = s.staffUsers.find((x) => x.id === u.id)!;
    expect(saved.passwordHash).toBeTruthy();
    expect(saved.passwordHash).not.toContain('tuan2026'); // chỉ lưu dạng băm
    s = logout(s);
    expect(() => login(s, { username: 'gd.tuan', password: DEFAULT_PASSWORD })).toThrow(/Sai tên đăng nhập hoặc mật khẩu/);
    expect(isLoggedIn(login(s, { username: 'gd.tuan', password: 'tuan2026' }))).toBe(true);
    expect(s.auditLogs.some((a) => a.actionCode === 'CHANGE_PASSWORD')).toBe(true);
  });

  it('Từ chối: sai mật khẩu, tài khoản bị khóa, tên đăng nhập sai định dạng / trùng, không phải Admin', () => {
    let s = addStaffUser(admin(), { fullName: 'A', username: 'xn.hung', roles: ['FORKLIFT'] });
    expect(() => login(s, { username: 'xn.hung', password: 'sai' })).toThrow(/Sai tên đăng nhập/);
    expect(() => login(s, { username: 'khongco', password: DEFAULT_PASSWORD })).toThrow(/Sai tên đăng nhập/);
    expect(() => login(s, { username: '', password: '' })).toThrow(/Vui lòng nhập/);
    const id = s.staffUsers.find((x) => x.username === 'xn.hung')!.id;
    s = updateStaffUser(s, { userId: id, isActive: false });
    expect(() => login(s, { username: 'xn.hung', password: DEFAULT_PASSWORD })).toThrow(/bị khóa/);
    expect(() => addStaffUser(s, { fullName: 'B', username: 'xn.hung', roles: ['FORKLIFT'] })).toThrow(/đã có người dùng/);
    expect(() => addStaffUser(s, { fullName: 'B', username: 'Nguyễn Văn', roles: ['FORKLIFT'] })).toThrow(/Tên đăng nhập/);
    expect(() => addStaffUser(s, { fullName: 'B', username: 'ab', roles: ['FORKLIFT'] })).toThrow(/Tên đăng nhập/);
    expect(() => addStaffUser(as(s, 'usr-office'), { fullName: 'B', username: 'vp.b', roles: ['OFFICE'] })).toThrow(/ADMIN/);
    expect(() => resetStaffPassword(as(s, 'usr-office'), { userId: id })).toThrow(/Admin/);
  });

  it('Đổi mật khẩu: bao nhiêu ký tự cũng được (DEC-144) nhưng không trống, khác 123456, khác mật khẩu cũ, nhập lại khớp, đúng mật khẩu hiện tại', () => {
    const s = login(createInitialState(), { username: 'office', password: DEFAULT_PASSWORD });
    const ch = (cur: string, pw: string, cf = pw) => () => changePassword(s, { currentPassword: cur, newPassword: pw, confirmPassword: cf });
    expect(ch(DEFAULT_PASSWORD, '')).toThrow(/nhập mật khẩu mới/);
    expect(ch(DEFAULT_PASSWORD, '1')).not.toThrow(); // 1 ký tự cũng được
    expect(ch(DEFAULT_PASSWORD, DEFAULT_PASSWORD)).toThrow(/mặc định/);
    expect(ch(DEFAULT_PASSWORD, 'abcdef', 'abcdeg')).toThrow(/không khớp/);
    expect(ch('sai', 'abcdef')).toThrow(/hiện tại không đúng/);
    expect(() => changePassword(logout(s), { currentPassword: DEFAULT_PASSWORD, newPassword: 'abcdef', confirmPassword: 'abcdef' })).toThrow(/đăng nhập/);
  });

  it('Admin đặt lại mật khẩu → về 123456, nhân viên phải đổi lại', () => {
    let s = login(createInitialState(), { username: 'office', password: DEFAULT_PASSWORD });
    s = changePassword(s, { currentPassword: DEFAULT_PASSWORD, newPassword: 'vp2026', confirmPassword: 'vp2026' });
    s = logout(s);
    s = login(s, { username: 'admin', password: DEFAULT_PASSWORD });
    s = resetStaffPassword(s, { userId: 'usr-office' });
    s = logout(s);
    expect(() => login(s, { username: 'office', password: 'vp2026' })).toThrow();
    s = login(s, { username: 'office', password: DEFAULT_PASSWORD });
    expect(mustChangePassword(s.currentUser)).toBe(true);
  });

  it('DEC-144: gợi ý tên đăng nhập ten.hoten — Lê Văn Tuấn → tuan.lv; trùng thêm số', async () => {
    const { suggestUsername } = await import('../src/services/auth');
    let s = admin();
    expect(suggestUsername(s, 'Lê Văn Tuấn')).toBe('tuan.lv');
    expect(suggestUsername(s, 'Đỗ Thị Thu')).toBe('thu.dt');
    expect(suggestUsername(s, '  nguyễn   quang   đức ')).toBe('duc.nq');
    expect(suggestUsername(s, 'Hùng')).toBe('hung');
    expect(suggestUsername(s, '')).toBe('');
    s = addStaffUser(s, { fullName: 'Lê Văn Tuấn', username: suggestUsername(s, 'Lê Văn Tuấn'), roles: ['INSPECTOR'] });
    expect(suggestUsername(s, 'Lý Vĩnh Tuấn')).toBe('tuan.lv2');
  });

  it('Dữ liệu cũ chưa có tên đăng nhập → lấy phần trước @ của email; trạng thái đăng nhập giữ khi nạp lại', () => {
    const legacy = createInitialState() as Partial<DepotState>;
    legacy.staffUsers = [...legacy.staffUsers!.map((u) => ({ ...u, username: undefined } as never))];
    const s = normalizeDepotState(legacy);
    expect(s.staffUsers.find((u) => u.id === 'usr-office')!.username).toBe('office');
    const logged = login(s, { username: 'office', password: DEFAULT_PASSWORD });
    expect(isLoggedIn(normalizeDepotState(JSON.parse(JSON.stringify(logged))))).toBe(true);
  });
});
