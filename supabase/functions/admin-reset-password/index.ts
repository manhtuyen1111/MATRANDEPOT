// Edge Function: Admin đặt lại mật khẩu nhân viên về 123456 (DEC-143). Admin KHÔNG xem được mật khẩu.
// Body: { staff_id }. Sau khi đặt lại, nhân viên bắt buộc đổi ở lần đăng nhập tới (public.mark_password_reset).
import { CORS, DEFAULT_PASSWORD, json, requireAdmin, serviceClient, toAuthPassword } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'Chỉ nhận POST.' }, 405);
  const admin = serviceClient();
  const actor = await requireAdmin(req, admin);
  if (actor instanceof Response) return actor;

  let staffId = '';
  try {
    staffId = String((await req.json()).staff_id || '');
  } catch {
    return json({ error: 'Dữ liệu gửi lên không hợp lệ.' }, 400);
  }
  if (!staffId) return json({ error: 'Thiếu nhân viên cần đặt lại mật khẩu.' }, 400);

  const updated = await admin.auth.admin.updateUserById(staffId, { password: toAuthPassword(DEFAULT_PASSWORD) });
  if (updated.error) return json({ error: 'Không đặt lại được mật khẩu.' }, 400);
  const { error } = await admin.rpc('mark_password_reset', { p_actor_id: actor, p_staff_id: staffId });
  if (error) return json({ error: error.message }, 400);
  return json({ ok: true, initial_password: DEFAULT_PASSWORD });
});
