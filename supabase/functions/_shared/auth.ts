// Dùng chung cho các Edge Function của MATRAN DEPOT.
// KHÔNG chứa khóa bí mật — SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY do Supabase cấp sẵn trong môi trường Edge Function.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.49.1';

// DEC-151: tên đăng nhập → email nội bộ cho Supabase Auth
export const LOGIN_EMAIL_DOMAIN = 'matrandepot.local';
export const usernameToEmail = (username: string) => `${username.trim().toLowerCase()}@${LOGIN_EMAIL_DOMAIN}`;

// DEC-143: mật khẩu ban đầu / sau khi đặt lại
export const DEFAULT_PASSWORD = '123456';

// DEC-153: Supabase bắt buộc mật khẩu ≥ 6 ký tự; người dùng muốn "bao nhiêu ký tự cũng được"
// → LUÔN ghép đoạn cố định này vào cuối mật khẩu người dùng gõ trước khi gửi Supabase (đăng nhập, đổi, đặt lại).
// Frontend phải dùng ĐÚNG hàm / hằng này (src/services/authPassword.ts sẽ chép y nguyên). Không phải bí mật.
export const PASSWORD_SUFFIX = '::matran';
export const toAuthPassword = (plain: string) => `${plain}${PASSWORD_SUFFIX}`;

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS } });

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Xác minh người gọi đang đăng nhập + là Admin đang hoạt động. Trả về id Admin, hoặc Response lỗi.
export async function requireAdmin(req: Request, admin: SupabaseClient): Promise<string | Response> {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'Phiên đăng nhập không hợp lệ.' }, 401);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) return json({ error: 'Phiên đăng nhập không hợp lệ.' }, 401);
  const { data: staff } = await admin
    .from('staff')
    .select('id, is_active, staff_roles(role)')
    .eq('id', data.user.id)
    .maybeSingle();
  const roles = (staff?.staff_roles as { role: string }[] | undefined)?.map((r) => r.role) || [];
  if (!staff?.is_active || !roles.includes('ADMIN')) return json({ error: 'Không đủ quyền: chỉ Admin.' }, 403);
  return data.user.id;
}
