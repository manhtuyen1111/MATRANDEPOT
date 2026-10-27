// ============================================================================
// ĐĂNG NHẬP — quy tắc dùng chung (DEC-143, DEC-151, DEC-153). Không gọi mạng; dùng được ở cả Demo và database.
// PHẢI khớp supabase/functions/_shared/auth.ts (PASSWORD_SUFFIX, LOGIN_EMAIL_DOMAIN, DEFAULT_PASSWORD).
// ============================================================================

// DEC-151: tên đăng nhập → email nội bộ cho Supabase Auth (không cần email thật)
export const LOGIN_EMAIL_DOMAIN = 'matrandepot.local';
// DEC-143: mật khẩu ban đầu / sau khi Admin đặt lại
export const DEFAULT_PASSWORD = '123456';
// DEC-153: luôn ghép đoạn cố định vào cuối mật khẩu trước khi gửi Supabase (Supabase đòi ≥ 6 ký tự).
// Không phải bí mật. Đổi giá trị này thì mọi mật khẩu cũ không đăng nhập được.
export const PASSWORD_SUFFIX = '::matran';

export const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function usernameToEmail(username: string): string {
  return `${normalizeUsername(username)}@${LOGIN_EMAIL_DOMAIN}`;
}

export function toAuthPassword(plain: string): string {
  return `${plain}${PASSWORD_SUFFIX}`;
}

// Kiểm tra ô đăng nhập trước khi gửi (thông báo tiếng Việt)
export function validateLoginInput(username: string, password: string): string | null {
  if (!normalizeUsername(username)) return 'Vui lòng nhập TÊN ĐĂNG NHẬP.';
  if (!USERNAME_PATTERN.test(normalizeUsername(username))) return 'Tên đăng nhập 3–30 ký tự: chữ thường không dấu, số, dấu . _ -';
  if (!password) return 'Vui lòng nhập MẬT KHẨU.';
  return null;
}

// DEC-143 / DEC-144: mật khẩu mới bao nhiêu ký tự cũng được, không trống, khác 123456, khác mật khẩu hiện tại, nhập lại phải khớp
export function validateNewPassword(input: { current: string; next: string; confirm: string }): string | null {
  if (!input.current) return 'Vui lòng nhập MẬT KHẨU HIỆN TẠI.';
  if (!input.next) return 'Vui lòng nhập MẬT KHẨU MỚI.';
  if (input.next === DEFAULT_PASSWORD) return `Không được dùng mật khẩu mặc định ${DEFAULT_PASSWORD}.`;
  if (input.next === input.current) return 'Mật khẩu mới phải khác mật khẩu hiện tại.';
  if (input.next !== input.confirm) return 'Nhập lại mật khẩu mới không khớp.';
  return null;
}

// Nhớ tên đăng nhập trên máy riêng (không bao giờ lưu mật khẩu). Trình duyệt chặn lưu trữ → bỏ qua.
const REMEMBER_KEY = 'matran_remember_username';
export function readRememberedUsername(): string {
  try {
    return globalThis.localStorage?.getItem(REMEMBER_KEY) || '';
  } catch {
    return '';
  }
}
export function writeRememberedUsername(username: string | null): void {
  try {
    if (username) globalThis.localStorage?.setItem(REMEMBER_KEY, normalizeUsername(username));
    else globalThis.localStorage?.removeItem(REMEMBER_KEY);
  } catch {
    // bỏ qua
  }
}

// Môi trường hiển thị dưới màn đăng nhập (để không nhầm bản thử với bản chính thức)
export function environmentLabel(env: string | undefined): string {
  switch ((env || '').toLowerCase()) {
    case 'production':
    case 'prod':
      return 'Chính thức';
    case 'staging':
      return 'Bản kiểm thử (staging)';
    case 'dev':
    case 'development':
      return 'Bản thử (dev)';
    default:
      return 'Bản chạy trên máy (local)';
  }
}
