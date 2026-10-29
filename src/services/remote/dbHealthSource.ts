// ============================================================================
// SỨC KHỎE DATABASE (DEC-189) — chỉ ở chế độ database. Demo: không có database → màn hiện thông báo, không số liệu giả.
// RemoteApp đăng ký client khi đăng nhập, gỡ khi đăng xuất. Quyền Admin kiểm tra ở RPC (db_health / set_db_health_limits).
// ============================================================================
import type { SupabaseClient } from '@supabase/supabase-js';
import type { DbHealthSnapshot } from '../dbHealth';
import { validateDbLimits } from '../dbHealth';
import { rpc } from './sync';

let client: SupabaseClient | null = null;

export function setDbHealthClient(c: SupabaseClient | null): void {
  client = c;
}

export const dbHealthActive = () => client !== null;

// Lấy số liệu + đo thời gian phản hồi từ máy đang mở
export async function fetchDbHealth(): Promise<{ snapshot: DbHealthSnapshot; latencyMs: number }> {
  if (!client) throw new Error('Chế độ Demo không có database.');
  const t0 = performance.now();
  const snapshot = await rpc<DbHealthSnapshot>(client, 'db_health');
  return { snapshot, latencyMs: performance.now() - t0 };
}

export async function saveDbHealthLimits(dbMb: number, storageMb: number): Promise<void> {
  if (!client) throw new Error('Chế độ Demo không có database.');
  validateDbLimits(dbMb, storageMb);
  await rpc(client, 'set_db_health_limits', { p_db_mb: Math.round(dbMb), p_storage_mb: Math.round(storageMb) });
}
