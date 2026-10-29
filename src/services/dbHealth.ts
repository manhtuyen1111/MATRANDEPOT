// ============================================================================
// DANH MỤC CHUNG → DATABASE: SỨC KHỎE DATABASE (DEC-189) — chỉ Admin.
// Database trả số liệu thô (RPC db_health); ở đây đánh giá theo ngưỡng → mức OK / CẢNH BÁO / NGUY HIỂM + lời nhắc việc cần làm.
// Không có tên đăng nhập, mật khẩu, khóa, chuỗi kết nối — chỉ số đo kỹ thuật.
// ============================================================================

export interface DbHealthSnapshot {
  checkedAt: string;
  database: {
    sizeBytes: number;
    version: string;
    startedAt: string;
    cacheHitPct: number | null;
    deadlocks: number;
    xidAge: number;
    lastActivityAt: string | null;
  };
  connections: { total: number; active: number; idleInTx: number; waitingLock: number; slowQueries: number; longestQuerySec: number; max: number };
  storage: { bucket: string; files: number; bytes: number }[];
  tables: { name: string; bytes: number; rows: number; deadRows: number; vacuumedAt: string | null }[];
  cron: { name: string; schedule: string; active: boolean; lastStatus: string | null; lastStartAt: string | null; failed7d: number }[];
  partitions: { table: string; nextMonthReady: boolean; defaultRows: number }[];
  limits: { dbMb: number; storageMb: number; updatedBy: string | null; updatedAt: string | null };
}

export type HealthLevel = 'ok' | 'warn' | 'danger' | 'info';

export interface HealthCheck {
  key: string;
  group: 'Dung lượng' | 'Kết nối & truy vấn' | 'Hiệu năng' | 'Bảo trì';
  label: string;
  value: string;
  threshold: string; // ngưỡng cảnh báo (chữ) — để người xem biết vì sao vàng / đỏ
  level: HealthLevel;
  advice?: string;   // việc cần làm khi vàng / đỏ
}

// Ngưỡng (người dùng chốt: vàng 70% / đỏ 85% cho dung lượng, kết nối)
export const USAGE_WARN_PCT = 70;
export const USAGE_DANGER_PCT = 85;
export const LATENCY_WARN_MS = 1000;
export const LATENCY_DANGER_MS = 3000;
export const CACHE_WARN_PCT = 99;
export const CACHE_DANGER_PCT = 95;
export const SLOW_QUERY_DANGER_SEC = 300;
export const DEAD_ROW_WARN_PCT = 20;
export const DEAD_ROW_MIN_ROWS = 10_000; // bảng nhỏ thì bỏ qua tỉ lệ dòng chết
export const XID_WARN = 1_000_000_000;
export const XID_DANGER = 1_500_000_000;
export const HEALTH_REFRESH_MS = 15 * 60 * 1000; // cảnh báo trên menu kiểm tra lại mỗi 15 phút

// Tên dễ hiểu cho bảng chính (bảng khác hiện tên gốc)
export const TABLE_LABELS: Record<string, string> = {
  containers: 'Container (lượt lưu bãi)',
  gate_in_orders: 'Hồ sơ Hạ vỏ',
  gate_out_orders: 'Lệnh Cấp vỏ',
  release_bookings: 'Booking',
  k80_tickets: 'Phiếu K80',
  work_orders: 'Việc Vệ sinh / Báo giá / Sửa chữa',
  work_order_members: 'Nhân viên sửa chữa theo việc',
  location_history: 'Lịch sử vị trí (Xe nâng)',
  audit_logs: 'Nhật ký thao tác',
  vouchers: 'Chứng từ',
  fee_lines: 'Dòng chi phí',
  payment_transactions: 'Giao dịch thanh toán',
  payment_receipts: 'Phiếu thu',
  prepaid_receipts: 'Phiếu thu trả trước',
  prepaid_deductions: 'Trừ phiếu trả trước',
  receipt_prints: 'Lần in phiếu thu',
  invoice_groups: 'Yêu cầu xuất hóa đơn',
  vessel_lists: 'Danh sách tàu',
  vessel_list_items: 'Container trong danh sách tàu',
  feedbacks: 'Góp ý',
  request_log: 'Chống bấm lặp (tự dọn 7 ngày)',
  sync_deletions: 'Đồng bộ dòng đã xóa (tự dọn 7 ngày)',
  staff: 'Nhân viên',
  partners: 'Khách hàng / Hãng tàu',
};
export const BUCKET_LABELS: Record<string, string> = { 'door-photos': 'Ảnh cửa container (Giám định)', 'repair-photos': 'Ảnh hoàn thành sửa chữa' };
export const CRON_LABELS: Record<string, string> = {
  'matran-ensure-partitions': 'Tạo trước partition 3 tháng tới',
  'matran-purge-request-log': 'Dọn nhật ký chống bấm lặp',
  'matran-purge-sync-deletions': 'Dọn dữ liệu đồng bộ cũ',
};
// Lịch chạy đọc được (giờ Việt Nam) — lịch gốc ở migration 20261031000001 / 20261102000001 (giờ UTC)
export const CRON_WHEN: Record<string, string> = {
  'matran-ensure-partitions': 'Ngày 25 hằng tháng, 01:00',
  'matran-purge-request-log': 'Hằng ngày, 01:30',
  'matran-purge-sync-deletions': 'Hằng ngày, 01:40',
};

const MB = 1024 * 1024;
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const v = bytes / 1024 ** i;
  return `${v >= 100 || i === 0 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}
export const formatCount = (n: number) => Math.round(n).toLocaleString('vi-VN');
const pct = (used: number, limit: number) => (limit > 0 ? Math.round((1000 * used) / limit) / 10 : 0);
const usageLevel = (p: number): HealthLevel => (p >= USAGE_DANGER_PCT ? 'danger' : p >= USAGE_WARN_PCT ? 'warn' : 'ok');

export function storageBytes(s: DbHealthSnapshot): number {
  return s.storage.reduce((t, b) => t + Number(b.bytes || 0), 0);
}

// Tỉ lệ dùng (%) của database / kho ảnh / kết nối — cho thanh tiến độ ở dashboard
export function usage(s: DbHealthSnapshot) {
  return {
    dbPct: pct(s.database.sizeBytes, s.limits.dbMb * MB),
    storagePct: pct(storageBytes(s), s.limits.storageMb * MB),
    connPct: pct(s.connections.total, s.connections.max),
  };
}

export function evaluateDbHealth(s: DbHealthSnapshot, latencyMs?: number): HealthCheck[] {
  const u = usage(s);
  const checks: HealthCheck[] = [];
  const add = (c: HealthCheck) => checks.push(c);

  add({
    key: 'db-size', group: 'Dung lượng', label: 'Dung lượng database',
    value: `${formatBytes(s.database.sizeBytes)} / ${formatBytes(s.limits.dbMb * MB)} (${u.dbPct}%)`,
    threshold: `Vàng ≥ ${USAGE_WARN_PCT}% • Đỏ ≥ ${USAGE_DANGER_PCT}%`, level: usageLevel(u.dbPct),
    advice: 'Sắp đầy dung lượng database — nâng gói Supabase hoặc xin ý kiến dọn dữ liệu cũ.',
  });
  add({
    key: 'storage-size', group: 'Dung lượng', label: 'Kho ảnh',
    value: `${formatBytes(storageBytes(s))} / ${formatBytes(s.limits.storageMb * MB)} (${u.storagePct}%) • ${formatCount(s.storage.reduce((t, b) => t + Number(b.files || 0), 0))} ảnh`,
    threshold: `Vàng ≥ ${USAGE_WARN_PCT}% • Đỏ ≥ ${USAGE_DANGER_PCT}%`, level: usageLevel(u.storagePct),
    advice: 'Sắp đầy kho ảnh — nâng gói Supabase (ảnh không tự xóa — DEC-176).',
  });
  add({
    key: 'connections', group: 'Kết nối & truy vấn', label: 'Kết nối đang mở',
    value: `${s.connections.total} / ${s.connections.max} (${u.connPct}%) • đang chạy ${s.connections.active}`,
    threshold: `Vàng ≥ ${USAGE_WARN_PCT}% • Đỏ ≥ ${USAGE_DANGER_PCT}%`, level: usageLevel(u.connPct),
    advice: 'Gần hết số kết nối — có thể nhiều máy mở app cùng lúc hoặc kết nối bị treo.',
  });
  add({
    key: 'slow-queries', group: 'Kết nối & truy vấn', label: 'Truy vấn chạy lâu (> 60 giây)',
    value: s.connections.slowQueries ? `${s.connections.slowQueries} truy vấn • lâu nhất ${s.connections.longestQuerySec} giây` : 'Không có',
    threshold: `Vàng ≥ 1 • Đỏ khi > ${SLOW_QUERY_DANGER_SEC / 60} phút`,
    level: !s.connections.slowQueries ? 'ok' : s.connections.longestQuerySec > SLOW_QUERY_DANGER_SEC ? 'danger' : 'warn',
    advice: 'Có truy vấn chạy lâu — báo kỹ thuật kiểm tra (báo cáo / Excel khoảng lọc quá rộng?).',
  });
  add({
    key: 'locks', group: 'Kết nối & truy vấn', label: 'Đang chờ khóa dữ liệu',
    value: `${s.connections.waitingLock} kết nối • treo trong giao dịch ${s.connections.idleInTx}`,
    threshold: 'Vàng ≥ 1', level: s.connections.waitingLock || s.connections.idleInTx ? 'warn' : 'ok',
    advice: 'Thao tác đang phải chờ nhau — nếu kéo dài, người dùng sẽ thấy lưu chậm.',
  });
  if (latencyMs !== undefined) {
    add({
      key: 'latency', group: 'Hiệu năng', label: 'Thời gian phản hồi (từ máy này)',
      value: `${Math.round(latencyMs)} ms`, threshold: `Vàng ≥ ${LATENCY_WARN_MS} ms • Đỏ ≥ ${LATENCY_DANGER_MS} ms`,
      level: latencyMs >= LATENCY_DANGER_MS ? 'danger' : latencyMs >= LATENCY_WARN_MS ? 'warn' : 'ok',
      advice: 'Phản hồi chậm — kiểm tra mạng của máy này trước, sau đó tới database.',
    });
  }
  const cache = s.database.cacheHitPct;
  add({
    key: 'cache', group: 'Hiệu năng', label: 'Đọc từ bộ nhớ đệm',
    value: cache === null ? 'Chưa có số liệu' : `${cache}%`, threshold: `Vàng < ${CACHE_WARN_PCT}% • Đỏ < ${CACHE_DANGER_PCT}%`,
    level: cache === null ? 'info' : cache < CACHE_DANGER_PCT ? 'danger' : cache < CACHE_WARN_PCT ? 'warn' : 'ok',
    advice: 'Database phải đọc đĩa nhiều — dữ liệu đã lớn hơn bộ nhớ, cân nhắc nâng cấu hình máy chủ.',
  });
  const bloated = s.tables.filter((t) => t.rows + t.deadRows >= DEAD_ROW_MIN_ROWS && pct(t.deadRows, t.rows + t.deadRows) >= DEAD_ROW_WARN_PCT);
  add({
    key: 'dead-rows', group: 'Bảo trì', label: 'Dòng chờ dọn dẹp (bảng lớn)',
    value: bloated.length ? bloated.map((t) => `${TABLE_LABELS[t.name] || t.name} ${pct(t.deadRows, t.rows + t.deadRows)}%`).join(', ') : 'Bình thường',
    threshold: `Vàng ≥ ${DEAD_ROW_WARN_PCT}% dòng chết`, level: bloated.length ? 'warn' : 'ok',
    advice: 'Tự dọn dẹp (autovacuum) chưa theo kịp — báo kỹ thuật kiểm tra.',
  });
  const cronFailed = s.cron.filter((j) => j.lastStatus === 'failed' || j.failed7d > 0);
  const cronOff = s.cron.filter((j) => !j.active);
  add({
    key: 'cron', group: 'Bảo trì', label: 'Tác vụ định kỳ',
    value: !s.cron.length ? 'Không có tác vụ' : cronFailed.length || cronOff.length
      ? [...cronFailed.map((j) => `${CRON_LABELS[j.name] || j.name}: lỗi`), ...cronOff.map((j) => `${CRON_LABELS[j.name] || j.name}: đang tắt`)].join(', ')
      : `${s.cron.length} tác vụ chạy bình thường`,
    threshold: 'Đỏ khi lần chạy lỗi • Vàng khi tắt', level: cronFailed.length ? 'danger' : cronOff.length ? 'warn' : s.cron.length ? 'ok' : 'info',
    advice: 'Tác vụ tự động bị lỗi / tắt — partition tháng sau hoặc dọn dẹp có thể không chạy.',
  });
  const notReady = s.partitions.filter((p) => !p.nextMonthReady);
  const spilled = s.partitions.filter((p) => p.defaultRows > 0);
  add({
    key: 'partitions', group: 'Bảo trì', label: 'Partition tháng sau (nhật ký, lịch sử vị trí)',
    value: notReady.length || spilled.length
      ? [...notReady.map((p) => `${TABLE_LABELS[p.table] || p.table}: chưa tạo`), ...spilled.map((p) => `${TABLE_LABELS[p.table] || p.table}: ${formatCount(p.defaultRows)} dòng ngoài partition`)].join(', ')
      : 'Đã tạo sẵn',
    threshold: 'Vàng khi chưa tạo / có dòng ngoài partition', level: notReady.length || spilled.length ? 'warn' : 'ok',
    advice: 'Partition chưa sẵn sàng — kiểm tra tác vụ "Tạo trước partition 3 tháng tới".',
  });
  const xid = Number(s.database.xidAge || 0);
  add({
    key: 'xid', group: 'Bảo trì', label: 'Tuổi giao dịch (chống tràn bộ đếm)',
    value: formatCount(xid), threshold: `Vàng ≥ ${formatCount(XID_WARN)} • Đỏ ≥ ${formatCount(XID_DANGER)}`,
    level: xid >= XID_DANGER ? 'danger' : xid >= XID_WARN ? 'warn' : 'ok',
    advice: 'Bộ đếm giao dịch quá cao — báo kỹ thuật chạy dọn dẹp (VACUUM FREEZE) ngay.',
  });
  return checks;
}

// Số mục cần chú ý (vàng + đỏ) — số đếm trên menu Danh mục chung → Database
export const healthAlertCount = (checks: HealthCheck[]) => checks.filter((c) => c.level === 'warn' || c.level === 'danger').length;

export function validateDbLimits(dbMb: number, storageMb: number): void {
  if (!Number.isFinite(dbMb) || dbMb <= 0 || !Number.isFinite(storageMb) || storageMb <= 0) {
    throw new Error('Giới hạn dung lượng phải lớn hơn 0 MB.');
  }
}
