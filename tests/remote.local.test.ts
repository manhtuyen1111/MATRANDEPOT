// Kiểm thử THẬT với Supabase LOCAL (Docker) — chỉ chạy khi có biến môi trường:
//   MATRAN_LOCAL_SUPABASE_URL, MATRAN_LOCAL_ANON_KEY, MATRAN_LOCAL_SERVICE_KEY (khóa local mặc định từ `npx supabase status`)
// `npm test` thường sẽ bỏ qua file này. KHÔNG trỏ vào project thật.
import { createClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { changePassword, loadStaffSession, signIn, signOut } from '../src/services/remote/session';
import { loadCatalogState } from '../src/services/remote/loadState';
import { toAuthPassword, usernameToEmail } from '../src/services/authPassword';

// Đọc biến môi trường không cần @types/node (dự án không cài gói này)
const ENV = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env || {};
const URL = ENV.MATRAN_LOCAL_SUPABASE_URL;
const ANON = ENV.MATRAN_LOCAL_ANON_KEY;
const SERVICE = ENV.MATRAN_LOCAL_SERVICE_KEY;
const run = Boolean(URL && ANON && SERVICE && /127\.0\.0\.1|localhost/.test(URL || ''));

describe.skipIf(!run)('N1 — đăng nhập thật với Supabase local', () => {
  const admin = run ? createClient(URL!, SERVICE!, { auth: { persistSession: false } }) : null!;
  const client = () => createClient(URL!, ANON!, { auth: { persistSession: false } });
  const stamp = Date.now().toString(36);
  const staffUser = `nv.${stamp}`;

  it('Admin tạo nhân viên → nhân viên đăng nhập 123456 → bắt buộc đổi → đổi mật khẩu 1 ký tự → đăng nhập lại', async () => {
    // Nhân viên mới (giống Edge Function admin-create-staff)
    const created = await admin.auth.admin.createUser({ email: usernameToEmail(staffUser), password: toAuthPassword('123456'), email_confirm: true });
    expect(created.error).toBeNull();
    const id = created.data.user!.id;
    await admin.from('staff').insert({ id, staff_code: `T${stamp}`.slice(0, 12), username: staffUser, full_name: 'Nhân viên Thử', must_change_password: true });
    await admin.from('staff_roles').insert({ staff_id: id, role: 'OFFICE' });

    const c = client();
    await expect(signIn(c, staffUser, 'sai')).rejects.toThrow('Sai tên đăng nhập hoặc mật khẩu.');
    await signIn(c, staffUser, '123456');
    const me = await loadStaffSession(c);
    expect(me).toMatchObject({ username: staffUser, roles: ['OFFICE'], mustChangePassword: true });

    await expect(changePassword(c, staffUser, { current: '123456', next: '123456', confirm: '123456' })).rejects.toThrow(/mặc định/);
    await expect(changePassword(c, staffUser, { current: 'sai', next: 'x', confirm: 'x' })).rejects.toThrow('Mật khẩu hiện tại không đúng.');
    await changePassword(c, staffUser, { current: '123456', next: 'x', confirm: 'x' });
    expect((await loadStaffSession(c))!.mustChangePassword).toBe(false);
    await signOut(c);
    expect(await loadStaffSession(c)).toBeNull();

    const c2 = client();
    await signIn(c2, staffUser, 'x'); // mật khẩu 1 ký tự (DEC-153)
    const state = await loadCatalogState(c2, (await loadStaffSession(c2))!);
    expect(state.currentUser.fullName).toBe('Nhân viên Thử');
    expect(state.staffUsers.map((u) => u.id)).toEqual([id]); // không phải Admin → chỉ thấy chính mình

    // Tài khoản bị khóa: đăng nhập được Auth nhưng hồ sơ khóa → đăng xuất + báo lỗi
    await admin.from('staff').update({ is_active: false }).eq('id', id);
    const c3 = client();
    await signIn(c3, staffUser, 'x');
    await expect(loadStaffSession(c3)).rejects.toThrow(/đã bị khóa/);

    // Dọn
    await admin.from('staff_roles').delete().eq('staff_id', id);
    await admin.from('audit_logs').delete().eq('entity_code', staffUser);
    await admin.from('staff').delete().eq('id', id);
    await admin.auth.admin.deleteUser(id);
  }, 30000);
});
