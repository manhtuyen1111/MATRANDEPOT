import React, { lazy, Suspense, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { isSupabaseConfigured } from './lib/env';
import { INVOICE_PORTAL_HASH } from './services/invoice';
import { AppLoading } from './components/LoadingScreens';
import './index.css';

// Chỉ tải phần cần dùng: bản database (kèm thư viện Supabase) / bản Demo / trang hóa đơn khách
const App = lazy(async () => ({ default: (await import('./app/App')).App }));
const RemoteApp = lazy(async () => ({ default: (await import('./app/RemoteApp')).RemoteApp }));
const InvoicePortalPage = lazy(async () => ({ default: (await import('./features/invoice/InvoicePortal')).InvoicePortalPage }));

// DEC-172: Vercel lên bản mới → tab đang mở (bản cũ) gọi file theo tên cũ đã bị thay ("Failed to fetch dynamically imported module")
// → tự tải lại trang để lấy bản mới. Chặn lặp: tối đa 1 lần / 30 giây.
window.addEventListener('vite:preloadError', (event) => {
  const KEY = 'matran_chunk_reload_at';
  let last = 0;
  try {
    last = Number(sessionStorage.getItem(KEY) || 0);
    if (Date.now() - last < 30_000) return; // vừa tải lại mà vẫn lỗi → để lỗi hiện ra (mất mạng…)
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* không có sessionStorage → vẫn tải lại */
  }
  event.preventDefault();
  window.alert('Ứng dụng vừa có bản cập nhật mới. Trang sẽ tải lại — sau đó bạn bấm lại thao tác vừa rồi.');
  window.location.reload();
});

// DEC-111: đường link #/hoa-don mở trang khách hàng yêu cầu xuất hóa đơn (không qua đăng nhập / menu nội bộ)
const Root: React.FC = () => {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  // DEC-155: có cấu hình Supabase → đăng nhập + database; không có → Demo như cũ
  const page = hash.startsWith(INVOICE_PORTAL_HASH) ? <InvoicePortalPage /> : isSupabaseConfigured ? <RemoteApp /> : <App />;
  return <Suspense fallback={<AppLoading step="Đang mở ứng dụng…" />}>{page}</Suspense>;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
