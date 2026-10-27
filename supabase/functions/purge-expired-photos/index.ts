// Edge Function: xóa FILE ảnh cửa container đã quá 2 tháng (DEC-159), rồi bỏ đường dẫn khỏi hồ sơ.
// Gọi theo lịch (pg_cron + pg_net, cấu hình ở supabase/README.md) bằng khóa service_role — không cho người dùng gọi.
// Mỗi lần xử lý tối đa 500 ảnh; còn thì lần sau làm tiếp.
import { json, serviceClient } from '../_shared/auth.ts';

const BUCKET = 'door-photos';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Chỉ nhận POST.' }, 405);
  // Chỉ chấp nhận đúng khóa service_role
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token || token !== Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')) return json({ error: 'Không đủ quyền.' }, 403);

  const admin = serviceClient();
  const { data: rows, error } = await admin.rpc('expired_photo_paths', { p_limit: 500 });
  if (error) return json({ error: error.message }, 500);
  const paths = ((rows || []) as { path: string }[]).map((r) => r.path).filter(Boolean);
  if (paths.length === 0) return json({ purged: 0 });

  const removed = await admin.storage.from(BUCKET).remove(paths);
  if (removed.error) return json({ error: removed.error.message }, 500);
  // File không còn trên kho (đã xóa trước đó) vẫn đánh dấu để không xử lý lại mãi
  const { data: marked, error: markError } = await admin.rpc('mark_photos_purged', { p_paths: paths });
  if (markError) return json({ error: markError.message }, 500);
  return json({ purged: marked });
});
