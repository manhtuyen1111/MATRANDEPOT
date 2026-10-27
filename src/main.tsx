import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
import { RemoteApp } from './app/RemoteApp';
import { isSupabaseConfigured } from './lib/env';
import { InvoicePortalPage } from './features/invoice/InvoicePortal';
import { INVOICE_PORTAL_HASH } from './services/invoice';
import './index.css';

// DEC-111: đường link #/hoa-don mở trang khách hàng yêu cầu xuất hóa đơn (không qua đăng nhập / menu nội bộ)
const Root: React.FC = () => {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  // DEC-155: có cấu hình Supabase → đăng nhập + database; không có → Demo như cũ
  if (hash.startsWith(INVOICE_PORTAL_HASH)) return <InvoicePortalPage />;
  return isSupabaseConfigured ? <RemoteApp /> : <App />;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
