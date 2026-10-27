// Chạy thử Edge Function trên Supabase LOCAL: mở `npx supabase functions serve` rồi `node supabase/tests/edge-functions.local.cjs .`
// Khóa local mặc định lấy từ `npx supabase status` lúc chạy, không ghi ra file. KHÔNG chạy lên project thật.
const { execSync } = require('child_process');
const env = Object.fromEntries(
  execSync('npx supabase status -o env', { cwd: process.argv[2], encoding: 'utf8' })
    .split(/\r?\n/).filter((l) => l.includes('=')).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, '')]; })
);
const API = env.API_URL, SR = env.SERVICE_ROLE_KEY, ANON = env.ANON_KEY;
const psql = (sql) => execSync(`docker exec supabase_db_MATRANDEPOT psql -U postgres -Atc "${sql.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim();
const req = async (path, { token, body, key = ANON } = {}) => {
  const r = await fetch(API + path, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body || {}) });
  let j; try { j = await r.json(); } catch { j = null; }
  return { status: r.status, body: j };
};
const login = async (email, password) => (await req('/auth/v1/token?grant_type=password', { body: { email, password } })).body?.access_token;
const results = [];
const check = (name, ok, extra = '') => results.push(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? '  — ' + extra : ''}`);

(async () => {
  // Admin thử
  const a = await req('/auth/v1/admin/users', { key: SR, token: SR, body: { email: 'admin.test@matrandepot.local', password: 'admin::matran', email_confirm: true } });
  const adminId = a.body?.id;
  psql(`insert into public.staff (id, staff_code, username, full_name, must_change_password) values ('${adminId}', 'NV900', 'admin.test', 'Admin Thử', false); insert into public.staff_roles values ('${adminId}', 'ADMIN');`);
  const adminToken = await login('admin.test@matrandepot.local', 'admin::matran');
  check('Admin đăng nhập (mật khẩu ngắn "admin" + đoạn ghép)', Boolean(adminToken));

  const c = await req('/functions/v1/admin-create-staff', { token: adminToken, body: { username: 'tuan.lv', full_name: 'Lê Văn Tuấn', roles: ['OFFICE'] } });
  check('Admin tạo tài khoản tuan.lv', c.status === 200, JSON.stringify(c.body));
  check('Hồ sơ nhân viên bắt buộc đổi mật khẩu', psql(`select must_change_password from public.staff where username = 'tuan.lv'`) === 't');
  const dup = await req('/functions/v1/admin-create-staff', { token: adminToken, body: { username: 'tuan.lv', full_name: 'Trùng', roles: ['OFFICE'] } });
  check('Trùng tên đăng nhập bị chặn', dup.status === 409, JSON.stringify(dup.body));
  const bad = await req('/functions/v1/admin-create-staff', { token: adminToken, body: { username: 'tu', full_name: 'X', roles: ['OFFICE'] } });
  check('Tên đăng nhập quá ngắn bị chặn', bad.status === 400);

  const staffToken = await login('tuan.lv@matrandepot.local', '123456::matran');
  check('Nhân viên mới đăng nhập bằng 123456', Boolean(staffToken));
  const notAdmin = await req('/functions/v1/admin-create-staff', { token: staffToken, body: { username: 'hack.er', full_name: 'X', roles: ['ADMIN'] } });
  check('Nhân viên thường không tạo được tài khoản', notAdmin.status === 403);
  const noToken = await req('/functions/v1/admin-create-staff', { body: { username: 'abc.de', full_name: 'X', roles: ['ADMIN'] } });
  check('Không đăng nhập thì bị chặn', noToken.status === 401 || noToken.status === 403, String(noToken.status));
  check('Không sót tài khoản Auth khi bị chặn', psql(`select count(*) from auth.users where email in ('hack.er@matrandepot.local','abc.de@matrandepot.local','tu@matrandepot.local')`) === '0');

  const staffId = psql(`select id from public.staff where username = 'tuan.lv'`);
  psql(`update public.staff set must_change_password = false where id = '${staffId}'`);
  const rs = await req('/functions/v1/admin-reset-password', { token: adminToken, body: { staff_id: staffId } });
  check('Admin đặt lại mật khẩu', rs.status === 200, JSON.stringify(rs.body));
  check('Sau đặt lại → bắt buộc đổi lần tới', psql(`select must_change_password from public.staff where id = '${staffId}'`) === 't');
  const rsBad = await req('/functions/v1/admin-reset-password', { token: staffToken, body: { staff_id: adminId } });
  // Phiên cũ của nhân viên đã bị hủy khi đặt lại mật khẩu → 401; còn phiên thì 403 — cả hai đều bị chặn
  check('Nhân viên thường không đặt lại mật khẩu người khác', rsBad.status === 401 || rsBad.status === 403, String(rsBad.status));
  const staffToken2 = await login('tuan.lv@matrandepot.local', '123456::matran');
  const rsBad2 = await req('/functions/v1/admin-reset-password', { token: staffToken2, body: { staff_id: adminId } });
  check('Nhân viên đăng nhập lại vẫn không đặt lại được (403)', rsBad2.status === 403, String(rsBad2.status));
  check('Mật khẩu Admin không bị đổi', Boolean(await login('admin.test@matrandepot.local', 'admin::matran')));

  const pg = await req('/functions/v1/purge-expired-photos', { token: SR, key: SR });
  check('Xóa ảnh hết hạn chạy bằng khóa service_role', pg.status === 200, JSON.stringify(pg.body));
  const pgUser = await req('/functions/v1/purge-expired-photos', { token: adminToken });
  check('Người dùng (kể cả Admin) không gọi được xóa ảnh', pgUser.status === 403);

  // Dọn dữ liệu thử
  psql(`delete from public.audit_logs where entity_type = 'STAFF'; delete from public.staff_roles where staff_id in (select id from public.staff where username in ('tuan.lv','admin.test')); delete from public.staff where username in ('tuan.lv','admin.test'); delete from auth.users where email in ('tuan.lv@matrandepot.local','admin.test@matrandepot.local');`);
  console.log(results.join('\n'));
  console.log(`${results.filter((r) => r.startsWith('PASS')).length}/${results.length}`);
})().catch((e) => { console.error(e); process.exit(1); });
