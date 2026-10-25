import React, { useState } from 'react';
import { FileText, KeyRound, Send } from 'lucide-react';
import { DepotState, formatVnd, loadDepotState, saveDepotState } from '../../services/depotStore';
import { createDemoState } from '../../services/demoData';
import { formatDateTime } from '../../services/datetime';
import { INVOICE_SECRET_LENGTH, INVOICE_STATUS_LABELS, InvoicePortalView, lookupInvoicePortal, submitInvoiceRequest } from '../../services/invoice';
import { Feedback, inputCls, labelCls, primaryBtn } from '../../components/shared';

// DEC-111: TRANG KHÁCH HÀNG — YÊU CẦU XUẤT HÓA ĐƠN (không cần đăng nhập, chỉ cần mã bảo mật in trên phiếu thu)
export const InvoicePortal: React.FC<{ state: DepotState; onUpdateState: (next: DepotState) => void }> = ({ state, onUpdateState }) => {
  const [code, setCode] = useState('');
  const [view, setView] = useState<InvoicePortalView | null>(null);
  const [form, setForm] = useState({ taxCode: '', email: '', companyName: '', address: '', note: '' });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const lookup = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      const v = lookupInvoicePortal(state, code);
      setView(v);
      setForm({
        taxCode: v.request?.taxCode || '',
        email: v.request?.email || '',
        companyName: v.request?.companyName || '',
        address: v.request?.address || '',
        note: v.request?.note || '',
      });
    } catch (err) {
      setView(null);
      setError(err instanceof Error ? err.message : 'Không tra cứu được.');
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      const next = submitInvoiceRequest(state, { secret: code, ...form });
      onUpdateState(next);
      setView(lookupInvoicePortal(next, code));
      setSuccess('Đã gửi yêu cầu xuất hóa đơn. Hóa đơn sẽ được gửi tới Gmail của bạn sau khi Kế toán xuất.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không gửi được yêu cầu.');
    }
  };

  const locked = view?.status === 'DA_XHD';
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900">
      <div className="mx-auto w-full max-w-lg space-y-4">
        <div className="rounded-lg border border-slate-200 bg-white px-4 py-3">
          <p className="text-[11px] font-semibold uppercase text-slate-500">{state.companyProfile.name}</p>
          <h1 className="flex items-center gap-1.5 text-base font-bold"><FileText className="h-4 w-4 text-slate-500" />Yêu cầu xuất hóa đơn</h1>
        </div>
        <Feedback error={error} success={success} onClose={() => (setError(null), setSuccess(null))} />

        <form onSubmit={lookup} className="space-y-2 rounded-lg border border-slate-200 bg-white p-4">
          <label className="block">
            <span className={labelCls}>Mã bảo mật trên phiếu thu ({INVOICE_SECRET_LENGTH} ký tự)</span>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.trim())}
              maxLength={INVOICE_SECRET_LENGTH}
              autoComplete="off"
              spellCheck={false}
              className={`${inputCls} py-2.5 font-mono text-base tracking-widest`}
              aria-label="Mã bảo mật"
            />
          </label>
          <p className="text-[11px] text-slate-500">Phân biệt chữ hoa / chữ thường.</p>
          <button type="submit" disabled={code.length !== INVOICE_SECRET_LENGTH} className={`${primaryBtn} w-full py-3`}>
            <KeyRound className="h-4 w-4" />
            Tra cứu phiếu thu
          </button>
        </form>

        <InvoiceGuide state={state} />

        {view && (
          <div className="space-y-3 rounded-lg border border-blue-600 bg-white p-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-black">{view.receiptNo}</span>
              <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${view.status === 'DA_XHD' ? 'bg-emerald-100 text-emerald-800' : view.status === 'YEU_CAU_XHD' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'}`}>
                {INVOICE_STATUS_LABELS[view.status]}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
              <dt className="text-slate-500">Ngày thu</dt><dd className="font-mono">{formatDateTime(view.issuedAt)}</dd>
              <dt className="text-slate-500">Số tiền</dt><dd className="font-mono font-bold">{formatVnd(view.amount)}</dd>
              <dt className="text-slate-500">Bên thanh toán</dt><dd>{view.payerName}</dd>
              {view.containerNo && (<><dt className="text-slate-500">Số container</dt><dd className="font-mono">{view.containerNo}</dd></>)}
              {view.invoiceNo && (<><dt className="text-slate-500">Số hóa đơn</dt><dd className="font-mono font-bold">{view.invoiceNo}</dd></>)}
            </dl>

            <form onSubmit={submit} className="space-y-2 border-t border-slate-200 pt-3">
              <label className="block"><span className={labelCls}>Mã số thuế *</span><input value={form.taxCode} onChange={set('taxCode')} disabled={locked} inputMode="numeric" placeholder="0123456789" className={`${inputCls} font-mono`} /></label>
              <label className="block"><span className={labelCls}>Gmail nhận hóa đơn *</span><input value={form.email} onChange={set('email')} disabled={locked} type="email" className={inputCls} /></label>
              <label className="block"><span className={labelCls}>Tên công ty *</span><input value={form.companyName} onChange={set('companyName')} disabled={locked} className={inputCls} /></label>
              <label className="block"><span className={labelCls}>Địa chỉ *</span><input value={form.address} onChange={set('address')} disabled={locked} className={inputCls} /></label>
              <label className="block"><span className={labelCls}>Ghi chú</span><textarea value={form.note} onChange={set('note')} disabled={locked} rows={2} className={inputCls} /></label>
              {locked ? (
                <p className="rounded bg-emerald-50 p-2 text-center font-semibold text-emerald-800">Phiếu thu đã xuất hóa đơn — không sửa được thông tin.</p>
              ) : (
                <button type="submit" className={`${primaryBtn} w-full py-3`}>
                  <Send className="h-4 w-4" />
                  {view.status === 'YEU_CAU_XHD' ? 'Cập nhật yêu cầu' : 'Gửi yêu cầu xuất hóa đơn'}
                </button>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  );
};

// DEC-113, DEC-114: HƯỚNG DẪN NGẮN cho khách — 3 bước + 2 trường hợp sai thông tin
export const InvoiceGuide: React.FC<{ state: DepotState }> = ({ state }) => {
  const phone = state.companyProfile.phone;
  const steps = ['Nhập mã bảo mật trên phiếu thu → Tra cứu', 'Điền Mã số thuế, Tên công ty, Địa chỉ, Gmail → Gửi', 'Nhận hóa đơn qua Gmail'];
  return (
    <div className="space-y-2 rounded-lg border border-slate-200 bg-white p-4 text-xs" data-testid="invoice-guide">
      <p className="font-bold text-slate-900">Hướng dẫn</p>
      <ol className="space-y-1.5">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[10px] font-black text-white">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <p className="border-t border-slate-100 pt-2 text-slate-600">
        <strong>Ghi sai?</strong> Chưa xuất: tra cứu lại → sửa → <strong>Cập nhật yêu cầu</strong>. Đã xuất: liên hệ Kế toán{phone ? ` ${phone}` : ''}.
      </p>
    </div>
  );
};

// Trang độc lập (mở bằng đường link #/hoa-don) — tự nạp / lưu dữ liệu, không qua menu nội bộ
export const InvoicePortalPage: React.FC = () => {
  const [state, setState] = useState<DepotState>(() => loadDepotState(createDemoState));
  return (
    <InvoicePortal
      state={state}
      onUpdateState={(next) => {
        setState(next);
        saveDepotState(next);
      }}
    />
  );
};
