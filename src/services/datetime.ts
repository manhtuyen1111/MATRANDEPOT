// ============================================================================
// ĐỊNH DẠNG THỜI GIAN THỐNG NHẤT TOÀN APP (DEC-054): dd/MM/yyyy HH:mm:ss (24 giờ)
// Hiển thị: formatDateTime. Nhập / bộ lọc: chuỗi cùng định dạng → parseDateTime.
// Không dùng toLocaleString / toLocaleTimeString / <input type="date"> trực tiếp ở giao diện.
// ============================================================================

const pad = (n: number) => String(n).padStart(2, '0');

export const DATETIME_FORMAT = 'dd/MM/yyyy HH:mm:ss';
export const DATETIME_PLACEHOLDER = 'dd/mm/yyyy hh:mm:ss';

export function formatDateTime(value?: string | Date | null): string {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

// Mốc đầu / cuối ngày theo định dạng chuẩn — dùng làm giá trị mặc định cho bộ lọc
export function startOfDayText(d = new Date()): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} 00:00:00`;
}
export function endOfDayText(d = new Date()): string {
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} 23:59:59`;
}

/**
 * Đọc chuỗi thời gian người dùng nhập. Chấp nhận:
 *  - dd/MM/yyyy HH:mm:ss (chuẩn)  - dd/MM/yyyy HH:mm  - dd/MM/yyyy (khi đó dùng `fallbackTime`)
 *  - yyyy-MM-dd (dữ liệu cũ / test)
 * Trả về null nếu sai định dạng hoặc ngày không tồn tại (vd 31/02).
 */
export function parseDateTime(text: string | undefined, fallbackTime: 'start' | 'end' = 'start'): Date | null {
  const s = (text || '').trim();
  if (!s) return null;
  let day: number, month: number, year: number;
  let h = fallbackTime === 'end' ? 23 : 0;
  let mi = fallbackTime === 'end' ? 59 : 0;
  let sec = fallbackTime === 'end' ? 59 : 0;
  let ms = fallbackTime === 'end' ? 999 : 0;
  const vn = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (vn) {
    [day, month, year] = [Number(vn[1]), Number(vn[2]), Number(vn[3])];
    if (vn[4] !== undefined) {
      h = Number(vn[4]);
      mi = Number(vn[5]);
      sec = vn[6] !== undefined ? Number(vn[6]) : fallbackTime === 'end' ? 59 : 0;
      ms = fallbackTime === 'end' ? 999 : 0;
    }
  } else if (iso) {
    [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else {
    return null;
  }
  if (h > 23 || mi > 59 || sec > 59) return null;
  const d = new Date(year, month - 1, day, h, mi, sec, ms);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return d;
}

// Tự chèn dấu "/", " ", ":" khi người dùng gõ số liên tục trên điện thoại / bàn phím
export function maskDateTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 14);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8), digits.slice(8, 10), digits.slice(10, 12), digits.slice(12, 14)];
  let out = parts[0];
  if (digits.length > 2) out += `/${parts[1]}`;
  if (digits.length > 4) out += `/${parts[2]}`;
  if (digits.length > 8) out += ` ${parts[3]}`;
  if (digits.length > 10) out += `:${parts[4]}`;
  if (digits.length > 12) out += `:${parts[5]}`;
  return out;
}

// Chuỗi an toàn cho tên file (dd-MM-yyyy_HHmmss)
export function fileStamp(text?: string): string {
  const d = parseDateTime(text);
  if (!d) return '';
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
}

// DEC-056: mặc định bộ lọc thời gian khi mở Phiếu thu / Báo cáo lần đầu = 1 ngày trước → thời điểm hiện tại
export function defaultLastDayRange(now = new Date()): { dateFrom: string; dateTo: string } {
  return { dateFrom: formatDateTime(new Date(now.getTime() - 86_400_000)), dateTo: formatDateTime(now) };
}
