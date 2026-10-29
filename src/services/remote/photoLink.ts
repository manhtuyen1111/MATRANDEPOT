// ============================================================================
// LINK XEM ẢNH THEO YÊU CẦU (DEC-178). Dữ liệu chỉ giữ ĐƯỜNG DẪN ảnh trong kho; mở app không xin link nào.
// Ảnh hiện trên màn (mở hồ sơ, chi tiết Văn phòng) mới xin link xem tạm — gom các ảnh cùng lúc thành 1 lượt gọi / kho,
// nhớ link 50 phút. Demo / ảnh vừa chụp (data:, http) dùng thẳng.
// ============================================================================
import type { SupabaseClient } from '@supabase/supabase-js';
import { photoBucket } from '../photo';

const LINK_SECONDS = 3600;
const KEEP_MS = 50 * 60_000;

let client: SupabaseClient | null = null;
const cache = new Map<string, { url: string; at: number }>();
const waiting = new Map<string, { resolve: (url: string) => void }[]>();
let timer: ReturnType<typeof setTimeout> | null = null;

// RemoteApp đăng ký khi đăng nhập, gỡ khi đăng xuất
export function setPhotoClient(next: SupabaseClient | null): void {
  client = next;
  cache.clear();
}

export const isStoredPhoto = (src?: string | null): src is string => Boolean(src) && !/^(https?:|data:|blob:)/.test(src!);

// Link đã có sẵn (không cần chờ) — ảnh dạng data / http, hoặc đường dẫn đã xin link trong 50 phút
export function cachedPhotoUrl(src?: string | null): string | undefined {
  if (!src) return undefined;
  if (!isStoredPhoto(src)) return src;
  const c = cache.get(src);
  return c && Date.now() - c.at < KEEP_MS ? c.url : undefined;
}

async function flush(): Promise<void> {
  timer = null;
  const paths = Array.from(waiting.keys());
  const done = (path: string, url: string) => {
    for (const w of waiting.get(path) || []) w.resolve(url);
    waiting.delete(path);
  };
  if (!client) {
    paths.forEach((p) => done(p, ''));
    return;
  }
  const byBucket = new Map<string, string[]>();
  for (const p of paths) byBucket.set(photoBucket(p), [...(byBucket.get(photoBucket(p)) || []), p]);
  await Promise.all(
    Array.from(byBucket).map(async ([bucket, list]) => {
      for (let i = 0; i < list.length; i += 100) {
        const part = list.slice(i, i + 100);
        const { data } = await client!.storage.from(bucket).createSignedUrls(part, LINK_SECONDS);
        const now = Date.now();
        for (const x of data || []) if (x.path && x.signedUrl) cache.set(x.path, { url: x.signedUrl, at: now });
        part.forEach((p) => done(p, cache.get(p)?.url || ''));
      }
    })
  );
}

// Xin link xem cho 1 ảnh; nhiều ảnh gọi cùng lúc được gom lại
export function photoUrl(src?: string | null): Promise<string> {
  const ready = cachedPhotoUrl(src);
  if (ready !== undefined || !src) return Promise.resolve(ready || '');
  return new Promise((resolve) => {
    waiting.set(src, [...(waiting.get(src) || []), { resolve }]);
    if (!timer) timer = setTimeout(() => void flush(), 0);
  });
}
