// ============================================================================
// TÀI KHOẢN / ĐĂNG NHẬP (DEC-143)
//   - Admin tạo tài khoản cho nhân viên: đặt TÊN ĐĂNG NHẬP + gán vai trò. Nhân viên chỉ nhận tài khoản và tác nghiệp.
//   - Mật khẩu ban đầu luôn là DEFAULT_PASSWORD (123456); Admin "Đặt lại mật khẩu" cũng về 123456.
//   - Lần đăng nhập đầu tiên (hoặc sau khi đặt lại) BẮT BUỘC đổi mật khẩu — bao nhiêu ký tự cũng được (DEC-144), khác 123456.
//   - Tên đăng nhập gợi ý tự động dạng ten.hoten: "Lê Văn Tuấn" → tuan.lv (DEC-144); Admin sửa được.
//   - BẢN DEMO: mật khẩu lưu dạng băm SHA-256 + salt ngẫu nhiên trong trình duyệt — KHÔNG phải bảo mật thật.
//     Giai đoạn 4 chuyển sang Supabase Auth (băm phía máy chủ), giữ nguyên màn hình và quy tắc.
// ============================================================================
import { DepotState } from './depotStore';
import { StaffUser } from '../types/depot';
import { appendAudit } from './core';
import { hasRolePermission } from './permissions';

function assertAdmin(state: DepotState): void {
  if (!hasRolePermission(state.currentUser, ['ADMIN'])) throw new Error('Từ chối quyền: chỉ Admin được quản lý tài khoản.');
}

export const DEFAULT_PASSWORD = '123456';
export const PASSWORD_MIN_LENGTH = 1; // DEC-144: không giới hạn độ dài, chỉ không để trống
export const USERNAME_PATTERN = /^[a-z0-9._-]{3,30}$/;

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

// DEC-144: gợi ý tên đăng nhập từ họ tên — tên + "." + chữ cái đầu của họ và tên đệm, không dấu.
//   "Lê Văn Tuấn" → tuan.lv; "Đỗ Thị Thu" → thu.dt; trùng thì thêm số: tuan.lv2, tuan.lv3…
export function stripVietnamese(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}
export function suggestUsername(state: DepotState, fullName: string, exceptUserId?: string): string {
  const words = stripVietnamese(fullName).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const given = words[words.length - 1];
  const initials = words.slice(0, -1).map((w) => w[0]).join('');
  const base = initials ? `${given}.${initials}` : given;
  const taken = new Set(state.staffUsers.filter((u) => u.id !== exceptUserId).map((u) => normalizeUsername(u.username || '')));
  if (!taken.has(base)) return base;
  for (let n = 2; ; n++) if (!taken.has(`${base}${n}`)) return `${base}${n}`;
}

export function validateUsername(state: DepotState, raw: string, exceptUserId?: string): string {
  const username = normalizeUsername(raw);
  if (!USERNAME_PATTERN.test(username)) {
    throw new Error('Tên đăng nhập 3–30 ký tự, chỉ gồm chữ thường không dấu, số và . _ - (VD: gd.tuan).');
  }
  if (state.staffUsers.some((u) => u.id !== exceptUserId && normalizeUsername(u.username || '') === username)) {
    throw new Error(`Tên đăng nhập ${username} đã có người dùng.`);
  }
  return username;
}

// ---------------------------------------------------------------------------
// Băm mật khẩu: SHA-256 (thuần JS, đồng bộ) trên "salt:mật khẩu". Lưu "salt$hex".
// ---------------------------------------------------------------------------
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01,
  0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147,
  0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116, 0x1e376c08,
  0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export function sha256Hex(text: string): string {
  const bytes = new TextEncoder().encode(text);
  const bitLen = bytes.length * 8;
  const padded = new Uint8Array(((bytes.length + 9 + 63) >> 6) << 6);
  padded.set(bytes);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor(bitLen / 0x100000000));
  view.setUint32(padded.length - 4, bitLen >>> 0);
  const h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  const w = new Uint32Array(64);
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n));
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) w[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const t1 = (hh + S1 + ((e & f) ^ (~e & g)) + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d; h[4] += e; h[5] += f; h[6] += g; h[7] += hh;
  }
  return Array.from(h, (x) => x.toString(16).padStart(8, '0')).join('');
}

function randomSalt(): string {
  const buf = new Uint8Array(12);
  globalThis.crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}

export function hashPassword(password: string, salt = randomSalt()): string {
  return `${salt}$${sha256Hex(`${salt}:${password}`)}`;
}

// Chưa có passwordHash = tài khoản mới / đã đặt lại → mật khẩu là 123456
export function verifyPassword(user: StaffUser, password: string): boolean {
  if (!user.passwordHash) return password === DEFAULT_PASSWORD;
  const [salt, hex] = user.passwordHash.split('$');
  return Boolean(salt && hex) && sha256Hex(`${salt}:${password}`) === hex;
}

export function mustChangePassword(user: StaffUser): boolean {
  return !user.passwordHash || Boolean(user.mustChangePassword);
}

export function isLoggedIn(state: DepotState): boolean {
  return Boolean(state.sessionUserId) && state.sessionUserId === state.currentUser.id;
}

// ---------------------------------------------------------------------------
// ĐĂNG NHẬP / ĐĂNG XUẤT
// ---------------------------------------------------------------------------
export function login(state: DepotState, input: { username: string; password: string }): DepotState {
  const username = normalizeUsername(input.username);
  if (!username || !input.password) throw new Error('Vui lòng nhập tên đăng nhập và mật khẩu.');
  const user = state.staffUsers.find((u) => normalizeUsername(u.username || '') === username);
  if (!user || !verifyPassword(user, input.password)) throw new Error('Sai tên đăng nhập hoặc mật khẩu.');
  if (!user.isActive) throw new Error('Tài khoản đã bị khóa — liên hệ Admin.');
  return appendAudit({ ...state, currentUser: user, sessionUserId: user.id }, 'LOGIN', 'USER', user.staffCode, `Đăng nhập: ${user.username} (${user.fullName})`);
}

export function logout(state: DepotState): DepotState {
  if (!isLoggedIn(state)) return { ...state, sessionUserId: null };
  return appendAudit({ ...state, sessionUserId: null }, 'LOGOUT', 'USER', state.currentUser.staffCode, `Đăng xuất: ${state.currentUser.username}`);
}

// ---------------------------------------------------------------------------
// ĐỔI MẬT KHẨU (nhân viên tự đổi — bắt buộc ở lần đăng nhập đầu tiên)
// ---------------------------------------------------------------------------
export function changePassword(state: DepotState, input: { currentPassword: string; newPassword: string; confirmPassword: string }): DepotState {
  if (!isLoggedIn(state)) throw new Error('Vui lòng đăng nhập trước.');
  const user = state.staffUsers.find((u) => u.id === state.currentUser.id);
  if (!user) throw new Error('Không tìm thấy tài khoản.');
  if (!verifyPassword(user, input.currentPassword)) throw new Error('Mật khẩu hiện tại không đúng.');
  const pw = input.newPassword;
  if (pw.length < PASSWORD_MIN_LENGTH) throw new Error('Vui lòng nhập mật khẩu mới.');
  if (pw === DEFAULT_PASSWORD) throw new Error('Không được dùng mật khẩu mặc định 123456.');
  if (pw === input.currentPassword) throw new Error('Mật khẩu mới phải khác mật khẩu hiện tại.');
  if (pw !== input.confirmPassword) throw new Error('Nhập lại mật khẩu mới không khớp.');
  const updated: StaffUser = { ...user, passwordHash: hashPassword(pw), mustChangePassword: false };
  return appendAudit(
    { ...state, staffUsers: state.staffUsers.map((u) => (u.id === user.id ? updated : u)), currentUser: updated },
    'CHANGE_PASSWORD',
    'USER',
    user.staffCode,
    `Đổi mật khẩu: ${user.username}`
  );
}

// ---------------------------------------------------------------------------
// ADMIN ĐẶT LẠI MẬT KHẨU → 123456, nhân viên phải đổi ở lần đăng nhập kế tiếp
// ---------------------------------------------------------------------------
export function resetStaffPassword(state: DepotState, input: { userId: string }): DepotState {
  assertAdmin(state);
  const user = state.staffUsers.find((u) => u.id === input.userId);
  if (!user) throw new Error('Không tìm thấy user.');
  const updated: StaffUser = { ...user, passwordHash: undefined, mustChangePassword: true };
  const isSelf = state.currentUser.id === user.id;
  return appendAudit(
    { ...state, staffUsers: state.staffUsers.map((u) => (u.id === user.id ? updated : u)), currentUser: isSelf ? updated : state.currentUser },
    'ADMIN_RESET_PASSWORD',
    'USER',
    user.staffCode,
    `[Admin] Đặt lại mật khẩu ${user.username} (${user.fullName}) về mặc định — phải đổi khi đăng nhập`
  );
}
