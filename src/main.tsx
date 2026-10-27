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
