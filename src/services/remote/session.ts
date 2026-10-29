// ============================================================================
// CHẾ ĐỘ DATABASE — phiên đăng nhập (Supabase Auth) + hồ sơ nhân viên (DEC-143, DEC-151, DEC-153, DEC-155).
// Chỉ dùng khi isSupabaseConfigured. Không giữ khóa bí mật: client dùng khóa anon, quyền do RLS / RPC kiểm.
// ============================================================================
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppRole, StaffUser } from '../../types/depot';
import { toAuthPassword, usernameToEmail, validateLoginInput, validateNewPassword } from '../authPassword';

// DEC-191: thông tin chi tiết nhân viên (cột bảng staff — RLS chỉ Admin + chính nhân viên)
export const STAFF_PROFILE_COLUMNS = 'department, gender, id_number, birth_year, hometown';
export interface StaffProfileRow {
  department: AppRole | null;
  gender: 'NAM' | 'NU' | null;
  id_number: string | null;
  birth_year: number | null;
  hometown: string | null;
}
export const mapStaffProfile = (s: StaffProfileRow): Pick<StaffUser, 'department' | 'gender' | 'idNumber' | 'birthYear' | 'hometown'> => ({
  department: s.department || undefined,
  gender: s.gender || undefined,
  idNumber: s.id_number || undefined,
  birthYear: s.birth_year || undefined,
  hometown: s.hometown || undefined,
});

export interface StaffSession extends StaffUser {
  username: string;
  mustChangePassword: boolean;
}

// Lỗi Supabase → câu tiếng Việt cho người dùng (không lộ chi tiết kỹ thuật)
export function friendlyAuthError(message: string | undefined): string {
  const m = (message || '').toLowerCase();
  if (m.includes('invalid login') || m.includes('invalid credentials')) return 'Sai tên đăng nhập hoặc mật khẩu.';
  if (m.includes('fetch') || m.includes('network')) return 'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.';
  return message || 'Có lỗi xảy ra, vui lòng thử lại.';
}

export async function signIn(client: SupabaseClient, username: string, password: string): Promise<void> {
  const invalid = validateLoginInput(username, password);
  if (invalid) throw new Error(invalid);
  const { error } = await client.auth.signInWithPassword({ email: usernameToEmail(username), password: toAuthPassword(password) });
  if (error) throw new Error(friendlyAuthError(error.message));
}

export async function signOut(client: SupabaseClient): Promise<void> {
  await client.auth.signOut();
}

// Hồ sơ nhân viên của người đang đăng nhập. null = chưa đăng nhập.
// Tài khoản bị khóa / không có hồ sơ → đăng xuất + báo lỗi (DEC-143: tài khoản khóa không đăng nhập được)
export async function loadStaffSession(client: SupabaseClient): Promise<StaffSession | null> {
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await client
    .from('staff')
    .select(`id, staff_code, username, full_name, email, is_active, must_change_password, staff_roles(role), ${STAFF_PROFILE_COLUMNS}`)
    .eq('id', auth.user.id)
    .maybeSingle();
  if (error) throw new Error(friendlyAuthError(error.message));
  if (!data || !data.is_active) {
    await client.auth.signOut();
    throw new Error('Tài khoản đã bị khóa hoặc chưa được cấp quyền. Liên hệ Admin.');
  }
  return {
    id: data.id,
    staffCode: data.staff_code,
    username: data.username,
    fullName: data.full_name,
    email: data.email || '',
    roles: ((data.staff_roles as { role: AppRole }[] | null) || []).map((r) => r.role),
    isActive: data.is_active,
    mustChangePassword: data.must_change_password,
    ...mapStaffProfile(data as StaffProfileRow), // DEC-191: thông tin chi tiết của chính mình
  };
}

// Đổi mật khẩu: xác minh mật khẩu hiện tại bằng cách đăng nhập lại, rồi đặt mật khẩu mới và báo database đã đổi
export async function changePassword(
  client: SupabaseClient,
  username: string,
  input: { current: string; next: string; confirm: string }
): Promise<void> {
  const invalid = validateNewPassword(input);
  if (invalid) throw new Error(invalid);
  const check = await client.auth.signInWithPassword({ email: usernameToEmail(username), password: toAuthPassword(input.current) });
  if (check.error) throw new Error('Mật khẩu hiện tại không đúng.');
  const { error } = await client.auth.updateUser({ password: toAuthPassword(input.next) });
  if (error) throw new Error(friendlyAuthError(error.message));
  const rpc = await client.rpc('staff_password_changed');
  if (rpc.error) throw new Error(friendlyAuthError(rpc.error.message));
}
