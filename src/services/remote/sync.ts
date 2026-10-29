// ============================================================================
// CHẾ ĐỘ DATABASE — hàng chờ ghi (DEC-155):
//   1. Giao diện gọi hàm nghiệp vụ như Demo → quy tắc kiểm ngay trên máy (báo lỗi tức thì).
//   2. Hàm bọc (src/services/api.ts) xếp lời gọi RPC tương ứng vào hàng chờ.
//   3. RemoteApp khóa màn "Đang lưu…", chạy lần lượt từng RPC (database kiểm lại), rồi tải lại dữ liệu thật.
//   Database từ chối → báo lỗi + tải lại (không mất gì). Không có hàng chờ (Demo) → hàm bọc chỉ chạy hàm gốc.
// ============================================================================
import type { SupabaseClient } from '@supabase/supabase-js';
import { gateInPhotoPath, photoBlob, repairPhotoPath } from '../photo';

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

export const OFFLINE_MESSAGE = 'Mất kết nối mạng — thao tác CHƯA được lưu. Kiểm tra mạng rồi bấm lại.';

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

// Mất mạng (DEC-151): báo lỗi ngay, không xếp hàng — hàm bọc ném lỗi trước khi trả kết quả nên màn hình giữ dữ liệu để bấm lại
export function enqueue(op: RemoteOp): void {
  if (!sink) return;
  if (isOffline()) throw new Error(OFFLINE_MESSAGE);
  sink(op);
}

// Lỗi mạng của trình duyệt (tiếng Anh) → câu tiếng Việt
export function friendlyError(message: string): string {
  return /failed to fetch|networkerror|load failed|network request failed/i.test(message) ? OFFLINE_MESSAGE : message;
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

// Danh mục / nhân viên vừa bị sửa → lần tải lại sau khi lưu phải tải lại danh mục (bình thường dùng bản đã có — DEC-160)
let catalogTouched = false;
export function takeCatalogTouched(): boolean {
  const v = catalogTouched;
  catalogTouched = false;
  return v;
}

// Lỗi RPC → Error với đúng câu tiếng Việt database trả về
export async function rpc<T = unknown>(client: SupabaseClient, name: string, params: Record<string, unknown> = {}): Promise<T> {
  if (/^(catalog_|admin_)/.test(name)) catalogTouched = true;
  const { data, error } = await client.rpc(name, params);
  if (error) throw new Error(friendlyError(error.message));
  return data as T;
}

export const requestId = (): string => crypto.randomUUID();

// ---------------------------------------------------------------------------
// ẢNH CỬA CONTAINER (DEC-150) + ẢNH HOÀN THÀNH SỬA CHỮA (DEC-176): nén < 200 KB trên máy rồi tải lên kho riêng tư
// Thư mục theo ngày — ANH-GATE-IN/<năm>/<tháng>/<ngày>, ANH-SUA-CHUA/<năm>/<tháng>/<ngày>/<tổ>/<số cont> (services/photo.ts)
// ---------------------------------------------------------------------------
async function uploadPhoto(client: SupabaseClient, bucket: string, path: string, dataUrl: string): Promise<void> {
  const blob = await photoBlob(dataUrl);
  const { error } = await client.storage.from(bucket).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new Error(`Không tải được ảnh lên: ${error.message}`);
}

// Ảnh dạng data: → tải lên, trả đường dẫn kho; ảnh dạng link (ảnh mẫu khi thử trên máy tính) → giữ nguyên
export async function uploadDoorPhoto(client: SupabaseClient, photo: string, label: string): Promise<string> {
  if (!photo.startsWith('data:')) return photo;
  const path = gateInPhotoPath(label);
  await uploadPhoto(client, 'door-photos', path, photo);
  return path;
}

// Ảnh sửa chữa: tải song song 4 ảnh / lượt (nhanh trên 4G, không nghẽn); trả đường dẫn theo đúng thứ tự chụp
export async function uploadRepairPhotos(client: SupabaseClient, photos: string[], teamCode: string, containerNo: string): Promise<string[]> {
  const at = new Date();
  const paths = photos.map((p, i) => (p.startsWith('data:') ? repairPhotoPath(teamCode, containerNo, i, at) : p));
  const queue = photos.map((p, i) => i).filter((i) => photos[i].startsWith('data:'));
  const worker = async () => {
    for (let i = queue.shift(); i !== undefined; i = queue.shift()) await uploadPhoto(client, 'repair-photos', paths[i], photos[i]);
  };
  await Promise.all(Array.from({ length: Math.min(4, queue.length) }, worker));
  return paths;
}
