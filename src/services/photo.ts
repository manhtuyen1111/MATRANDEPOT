// ============================================================================
// ẢNH CHỤP TÁC NGHIỆP (DEC-150, DEC-176) — nén ngay trên máy, mỗi ảnh < 200 KB.
// Dùng chung cho ảnh cửa Gate in và ảnh HOÀN THÀNH SỬA CHỮA (chỉ chạy trên trình duyệt).
// Đường dẫn kho ảnh (Supabase Storage không nhận chữ có dấu → thư mục viết không dấu):
//   door-photos   : ANH-GATE-IN/<năm>/<tháng>/<ngày>/<mã hồ sơ>-<ngẫu nhiên>.jpg
//   repair-photos : ANH-SUA-CHUA/<năm>/<tháng>/<ngày>/<mã tổ>/<số cont>/<số cont>-<giờ phút giây>-<n>.jpg
// ============================================================================

export const PHOTO_MAX_BYTES = 200_000; // < 200 KB / ảnh
const MAX_SIDE = 1600; // cạnh dài tối đa — đủ đọc rõ số cont, vết hàn

const pad = (n: number) => String(n).padStart(2, '0');
// Ngày theo giờ trên máy (Việt Nam) — thư mục theo ngày tác nghiệp
export const photoDateFolder = (d = new Date()) => `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
const safe = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'D').replace(/[^A-Za-z0-9-]+/g, '-').toUpperCase() || 'KHAC';

export function gateInPhotoPath(dossierCode: string, d = new Date()): string {
  return `ANH-GATE-IN/${photoDateFolder(d)}/${safe(dossierCode)}-${crypto.randomUUID().slice(0, 8)}.jpg`;
}

export function repairPhotoPath(teamCode: string, containerNo: string, index: number, d = new Date()): string {
  const no = safe(containerNo);
  return `ANH-SUA-CHUA/${photoDateFolder(d)}/${safe(teamCode)}/${no}/${no}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}-${pad(index + 1)}.jpg`;
}

// Kho chứa ảnh theo đường dẫn (ảnh cửa cũ không có thư mục ANH-GATE-IN vẫn ở door-photos)
export const photoBucket = (path: string) => (path.startsWith('ANH-SUA-CHUA/') ? 'repair-photos' : 'door-photos');

const toBlob = (canvas: HTMLCanvasElement, q: number) => new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', q));

// Vẽ nguồn ảnh (khung camera / ảnh) vào canvas cạnh dài ≤ 1600 rồi hạ chất lượng, thiếu thì thu nhỏ tiếp — đến khi < 200 KB.
// crop: vùng cắt trên nguồn (zoom số khi camera không hỗ trợ zoom thật)
export async function compressToJpeg(
  source: CanvasImageSource,
  width: number,
  height: number,
  crop?: { x: number; y: number; w: number; h: number }
): Promise<Blob> {
  const area = crop || { x: 0, y: 0, w: width, h: height };
  let scale = Math.min(1, MAX_SIDE / Math.max(area.w, area.h));
  const canvas = document.createElement('canvas');
  for (let round = 0; round < 6; round++) {
    canvas.width = Math.max(1, Math.round(area.w * scale));
    canvas.height = Math.max(1, Math.round(area.h * scale));
    canvas.getContext('2d')!.drawImage(source, area.x, area.y, area.w, area.h, 0, 0, canvas.width, canvas.height);
    for (const q of [0.8, 0.7, 0.6, 0.5]) {
      const blob = await toBlob(canvas, q);
      if (blob && blob.size < PHOTO_MAX_BYTES) return blob;
    }
    scale *= 0.8;
  }
  throw new Error('Không nén được ảnh xuống dưới 200 KB.');
}

export const blobToDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('Không đọc được ảnh.'));
    r.readAsDataURL(blob);
  });

const loadImage = (src: string) =>
  new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Không đọc được ảnh chụp.'));
    i.src = src;
  });

// Ảnh data: → Blob JPEG < 200 KB. Ảnh đã nén sẵn (chụp trong app) thì giữ nguyên, không nén lại.
export async function photoBlob(dataUrl: string): Promise<Blob> {
  const raw = await (await fetch(dataUrl)).blob();
  if (raw.type === 'image/jpeg' && raw.size < PHOTO_MAX_BYTES) return raw;
  const img = await loadImage(dataUrl);
  return compressToJpeg(img, img.naturalWidth, img.naturalHeight);
}

// Ảnh chọn từ máy / camera hệ điều hành (File) → data: JPEG < 200 KB
export async function fileToPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    return blobToDataUrl(await compressToJpeg(img, img.naturalWidth, img.naturalHeight));
  } finally {
    URL.revokeObjectURL(url);
  }
}
