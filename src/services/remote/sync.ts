// ============================================================================
// CHẾ ĐỘ DATABASE — hàng chờ ghi (DEC-155):
//   1. Giao diện gọi hàm nghiệp vụ như Demo → quy tắc kiểm ngay trên máy (báo lỗi tức thì).
//   2. Hàm bọc (src/services/api.ts) xếp lời gọi RPC tương ứng vào hàng chờ.
//   3. RemoteApp khóa màn "Đang lưu…", chạy lần lượt từng RPC (database kiểm lại), rồi tải lại dữ liệu thật.
//   Database từ chối → báo lỗi + tải lại (không mất gì). Không có hàng chờ (Demo) → hàm bọc chỉ chạy hàm gốc.
// ============================================================================
import type { SupabaseClient } from '@supabase/supabase-js';

export type RemoteOp = (client: SupabaseClient) => Promise<void>;

let sink: ((op: RemoteOp) => void) | null = null;

// id tạm (tạo trên máy) → id thật do database cấp, dùng khi 1 lần bấm có 2 thao tác nối nhau (VD lập lệnh cấp vỏ rồi thu tiền)
const idMap = new Map<string, string>();

export function setRemoteSink(fn: ((op: RemoteOp) => void) | null): void {
  sink = fn;
  idMap.clear();
}

export function isRemoteMode(): boolean {
  return sink !== null;
}

export function enqueue(op: RemoteOp): void {
  sink?.(op);
}

export function mapId(localId: string, realId: string): void {
  idMap.set(localId, realId);
}

export function realId(id: string): string {
  return idMap.get(id) || id;
}

export function clearIdMap(): void {
  idMap.clear();
}

// Lỗi RPC → Error với đúng câu tiếng Việt database trả về
export async function rpc<T = unknown>(client: SupabaseClient, name: string, params: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await client.rpc(name, params);
  if (error) throw new Error(error.message);
  return data as T;
}

export const requestId = (): string => crypto.randomUUID();

// ---------------------------------------------------------------------------
// ẢNH CỬA CONTAINER (DEC-150): nén ~200 KB trên máy rồi tải lên kho riêng tư door-photos
// ---------------------------------------------------------------------------
async function compressDataUrl(dataUrl: string, maxSide = 1280, quality = 0.7): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Không đọc được ảnh chụp.'));
    i.src = dataUrl;
  });
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  for (let q = quality; q >= 0.4; q -= 0.1) {
    const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', q));
    if (blob && (blob.size <= 220_000 || q <= 0.45)) return blob;
  }
  throw new Error('Không nén được ảnh chụp.');
}

// Ảnh dạng data: → tải lên, trả đường dẫn kho; ảnh dạng link (ảnh mẫu khi thử trên máy tính) → giữ nguyên
export async function uploadDoorPhoto(client: SupabaseClient, photo: string, label: string): Promise<string> {
  if (!photo.startsWith('data:')) return photo;
  const blob = await compressDataUrl(photo);
  const now = new Date();
  const path = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${label}-${crypto.randomUUID().slice(0, 8)}.jpg`;
  const { error } = await client.storage.from('door-photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(`Không tải được ảnh lên: ${error.message}`);
  return path;
}
