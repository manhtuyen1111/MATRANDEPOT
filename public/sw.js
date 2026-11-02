// ============================================================================
// SERVICE WORKER — PWA MATRAN DEPOT (DEC-205): cài lên màn hình điện thoại như 1 ứng dụng.
//   - Chỉ giữ "vỏ" ứng dụng (trang + file JS/CSS/icon cùng tên miền) để mở nhanh, mở được khi sóng yếu.
//   - KHÔNG lưu dữ liệu nghiệp vụ: Supabase (database, ảnh kho), font… là tên miền khác → đi thẳng mạng, không qua đây.
//   - Trang (index.html) luôn lấy mạng trước → bản mới trên Vercel có hiệu lực ngay; mất mạng mới dùng bản đã lưu.
//   - File /assets/* có mã băm trong tên → lưu lâu, giữ tối đa ASSET_MAX file (bản cũ vẫn mở được — DEC-172).
// Đổi VERSION khi cần xóa sạch bộ nhớ đệm cũ trên máy người dùng.
// ============================================================================
const VERSION = 'matran-v1';
const SHELL_CACHE = `${VERSION}-shell`;
const ASSET_CACHE = `${VERSION}-assets`;
const ASSET_MAX = 200;
const SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(`${VERSION}-`)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function trimAssets() {
  const cache = await caches.open(ASSET_CACHE);
  const keys = await cache.keys();
  for (const k of keys.slice(0, Math.max(0, keys.length - ASSET_MAX))) await cache.delete(k);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Supabase / ảnh kho / font: không đụng tới

  // Mở trang: mạng trước, mất mạng → bản đã lưu
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put('/', copy));
          }
          return res;
        })
        .catch(() => caches.match('/').then((r) => r || Response.error()))
    );
    return;
  }

  // File build có mã băm: bộ nhớ đệm trước
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(ASSET_CACHE).then((c) => c.put(req, copy)).then(trimAssets);
            }
            return res;
          })
      )
    );
    return;
  }

  // Còn lại (icon, manifest…): mạng trước, mất mạng → bản đã lưu
  event.respondWith(fetch(req).catch(() => caches.match(req).then((r) => r || Response.error())));
});
