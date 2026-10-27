// Edge Function: Admin tạo tài khoản nhân viên (DEC-143, DEC-151, DEC-153).
// Body: { username, full_name, email?, roles: AppRole[] }
// Tạo Supabase Auth user (email nội bộ, mật khẩu ban đầu 123456 đã ghép đoạn cố định) → public.register_staff.
// register_staff lỗi (trùng tên đăng nhập, sai vai trò…) → xóa lại Auth user để không sót tài khoản rỗng.
import { CORS, DEFAULT_PASSWORD, json, requireAdmin, serviceClient, toAuthPassword, usernameToEmail } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Chỉ nhận POST.' }, 405);
  const admin = serviceClient();
  const actor = await requireAdmin(req, admin);
  if (actor instanceof Response) return actor;

  let body: { username?: string; full_name?: string; email?: string; roles?: string[] };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Dữ liệu gửi lên không hợp lệ.' }, 400);
  }
  const username = (body.username || '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{3,30}$/.test(username)) return json({ error: 'Tên đăng nhập 3–30 ký tự: chữ thường không dấu, số, dấu . _ -' }, 400);
  if (!(body.full_name || '').trim()) return json({ error: 'Vui lòng nhập HỌ TÊN.' }, 400);
  if (!Array.isArray(body.roles) || body.roles.length === 0) return json({ error: 'Vui lòng chọn ít nhất 1 vai trò.' }, 400);

  const created = await admin.auth.admin.createUser({
    email: usernameToEmail(username),
    password: toAuthPassword(DEFAULT_PASSWORD),
    email_confirm: true,
    user_metadata: { username },
  });
  if (created.error || !created.data.user) {
    const dup = /already|exists|registered/i.test(created.error?.message || '');
    return json({ error: dup ? `Tên đăng nhập "${username}" đã có.` : 'Không tạo được tài khoản đăng nhập.' }, dup ? 409 : 500);
  }
  const authId = created.data.user.id;
  const { data, error } = await admin.rpc('register_staff', {
    p_actor_id: actor,
    p_auth_id: authId,
    p_username: username,
    p_full_name: body.full_name,
    p_email: body.email || null,
    p_roles: body.roles,
  });
  if (error) {
    await admin.auth.admin.deleteUser(authId);
    return json({ error: error.message }, 400);
  }
  return json({ staff: data, initial_password: DEFAULT_PASSWORD });
});
