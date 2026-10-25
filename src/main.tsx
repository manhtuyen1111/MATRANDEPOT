import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app/App';
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
  return hash.startsWith(INVOICE_PORTAL_HASH) ? <InvoicePortalPage /> : <App />;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
