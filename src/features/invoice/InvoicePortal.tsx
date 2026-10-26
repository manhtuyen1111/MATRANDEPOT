import React, { useState } from 'react';
import { FileText, KeyRound, Send } from 'lucide-react';
import { DepotState, formatVnd, loadDepotState, saveDepotState } from '../../services/depotStore';
import { createDemoState } from '../../services/demoData';
import { formatDateTime } from '../../services/datetime';
import {
  cancelPrepaidInvoiceGroup,
  INVOICE_SECRET_LENGTH,
  INVOICE_STATUS_LABELS,
  InvoicePortalView,
  lookupInvoicePortal,
  PrepaidInvoiceView,
  submitInvoiceRequest,
  submitPrepaidInvoiceGroup,
} from '../../services/invoice';
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
    <div className="min-h-screen bg-canvas px-4 py-6 text-ink">
      <div className="mx-auto w-full max-w-lg space-y-4">
        <div className="rounded-lg border border-line bg-white px-4 py-3">
          <p className="text-[11px] font-semibold uppercase text-ink-muted">{state.companyProfile.name}</p>
          <h1 className="flex items-center gap-1.5 text-base font-bold"><FileText className="h-4 w-4 text-ink-muted" />Yêu cầu xuất hóa đơn</h1>
        </div>
        <Feedback error={error} success={success} onClose={() => (setError(null), setSuccess(null))} />

        <form onSubmit={lookup} className="space-y-2 rounded-lg border border-line bg-white p-4">
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
          <p className="text-[11px] text-ink-muted">Phân biệt chữ hoa / chữ thường.</p>
          <button type="submit" disabled={code.length !== INVOICE_SECRET_LENGTH} className={`${primaryBtn} w-full py-3`}>
            <KeyRound className="h-4 w-4" />
            Tra cứu phiếu thu
          </button>
        </form>

        <InvoiceGuide state={state} />

        {view && (
          <div className="space-y-3 rounded-lg border border-navy-900 bg-white p-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-black">{view.receiptNo}</span>
              <span className={`rounded px-2 py-0.5 text-[11px] font-bold ${view.status === 'DA_XHD' ? 'bg-emerald-100 text-emerald-800' : view.status === 'YEU_CAU_XHD' ? 'bg-amber-100 text-amber-800' : 'bg-navy-50 text-ink'}`}>
                {INVOICE_STATUS_LABELS[view.status]}
              </span>
            </div>
            <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
              <dt className="text-ink-muted">Ngày thu</dt><dd className="font-mono">{formatDateTime(view.issuedAt)}</dd>
              <dt className="text-ink-muted">Số tiền</dt><dd className="font-mono font-bold">{formatVnd(view.amount)}</dd>
              <dt className="text-ink-muted">Bên thanh toán</dt><dd>{view.payerName}</dd>
              {view.containerNo && (<><dt className="text-ink-muted">Số container</dt><dd className="font-mono">{view.containerNo}</dd></>)}
              {view.invoiceNo && (<><dt className="text-ink-muted">Số hóa đơn</dt><dd className="font-mono font-bold">{view.invoiceNo}</dd></>)}
            </dl>

            {view.prepaid ? (
              <PrepaidPortal
                secret={code}
                prepaid={view.prepaid}
                state={state}
                onDone={(next, message) => {
                  onUpdateState(next);
                  setView(lookupInvoicePortal(next, code));
                  setError(null);
                  setSuccess(message);
                }}
                onError={(m) => { setSuccess(null); setError(m); }}
              />
            ) : (
            <form onSubmit={submit} className="space-y-2 border-t border-line pt-3">
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
            )}
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
    <div className="space-y-2 rounded-lg border border-line bg-white p-4 text-xs" data-testid="invoice-guide">
      <p className="font-bold text-ink">Hướng dẫn</p>
      <ol className="space-y-1.5">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-navy-900 text-[10px] font-black text-white">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
      <p className="border-t border-line pt-2 text-ink-muted">
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

// DEC-130: PHIẾU THU TRẢ TRƯỚC — khách chọn các LƯỢT đã dùng (gộp 1 hoặc nhiều lượt) → 1 yêu cầu hóa đơn / 1 MST
const EMPTY_INFO = { taxCode: '', email: '', companyName: '', address: '', note: '' };
const PrepaidPortal: React.FC<{
  secret: string;
  prepaid: PrepaidInvoiceView;
  state: DepotState;
  onDone: (next: DepotState, message: string) => void;
  onError: (message: string) => void;
}> = ({ secret, prepaid, state, onDone, onError }) => {
  const [picked, setPicked] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [info, setInfo] = useState(EMPTY_INFO);
  const selectable = prepaid.lots.filter((l) => !l.groupId || l.groupId === editingId);
  const total = prepaid.lots.filter((l) => picked.includes(l.deductionId)).reduce((s, l) => s + l.amount, 0);
  const last = [...prepaid.groups].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const set = (k: keyof typeof EMPTY_INFO) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setInfo({ ...info, [k]: e.target.value });
  const reset = () => { setPicked([]); setEditingId(null); setInfo(EMPTY_INFO); };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const next = submitPrepaidInvoiceGroup(state, { secret, deductionIds: picked, groupId: editingId || undefined, ...info });
      reset();
      onDone(next, editingId ? 'Đã cập nhật yêu cầu hóa đơn.' : 'Đã gửi yêu cầu hóa đơn cho các lượt đã chọn.');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Không gửi được yêu cầu.');
    }
  };

  return (
    <div className="space-y-3 border-t border-line pt-3" data-testid="prepaid-portal">
      <p className="text-ink-muted">
        Phiếu thu trả trước: yêu cầu hóa đơn theo <strong>từng lượt đã dùng</strong> — chọn 1 hoặc nhiều lượt để gộp chung 1 hóa đơn. Còn {formatVnd(prepaid.remainingAmount)} chưa dùng (chưa xuất hóa đơn được).
      </p>

      {/* Các yêu cầu đã gửi */}
      {prepaid.groups.map((g, i) => {
        const lots = prepaid.lots.filter((l) => g.deductionIds.includes(l.deductionId));
        return (
          <div key={g.id} className={`space-y-1 rounded-md border p-2 ${editingId === g.id ? 'border-navy-900' : 'border-line'}`}>
            <div className="flex items-center justify-between">
              <span className="font-bold">Yêu cầu {i + 1}: {lots.length} lượt • {formatVnd(g.amount)}</span>
              <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold ${g.status === 'DA_XHD' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{INVOICE_STATUS_LABELS[g.status]}</span>
            </div>
            <p className="font-mono text-[11px] text-ink-muted">{lots.map((l) => l.dossierCode).join(', ')}</p>
            <p>{g.companyName} • MST {g.taxCode}{g.invoiceNo ? ` • HĐ ${g.invoiceNo}` : ''}</p>
            {g.status === 'YEU_CAU_XHD' && (
              <div className="flex gap-2">
                <button type="button" onClick={() => { setEditingId(g.id); setPicked(g.deductionIds); setInfo({ taxCode: g.taxCode, email: g.email, companyName: g.companyName, address: g.address, note: g.note || '' }); }} className="font-semibold text-navy-700 underline">Sửa</button>
                <button
                  type="button"
                  onClick={() => {
                    try { onDone(cancelPrepaidInvoiceGroup(state, { secret, groupId: g.id }), 'Đã hủy yêu cầu — các lượt được chọn lại.'); reset(); }
                    catch (err) { onError(err instanceof Error ? err.message : 'Không hủy được.'); }
                  }}
                  className="font-semibold text-rose-700 underline"
                >
                  Hủy yêu cầu
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Chọn lượt + nhập thông tin */}
      {selectable.length === 0 ? (
        <p className="rounded bg-emerald-50 p-2 text-center font-semibold text-emerald-800">Mọi lượt đã dùng đều đã có yêu cầu hóa đơn.</p>
      ) : (
        <form onSubmit={submit} className="space-y-2">
          <p className="font-bold text-ink">{editingId ? 'Sửa yêu cầu' : 'Yêu cầu mới'} — chọn lượt *</p>
          <ul className="divide-y divide-line rounded-md border border-line">
            {selectable.map((l) => (
              <li key={l.deductionId}>
                <label className="flex items-center gap-2 px-2 py-2">
                  <input type="checkbox" checked={picked.includes(l.deductionId)} onChange={(e) => setPicked((p) => (e.target.checked ? [...p, l.deductionId] : p.filter((x) => x !== l.deductionId)))} className="h-4 w-4" />
                  <span className="flex-1">
                    <span className="block font-mono font-bold">{l.dossierCode} • {l.containerNo}</span>
                    <span className="block text-[11px] text-ink-muted">{l.operation} • {formatDateTime(l.performedAt)}</span>
                  </span>
                  <span className="font-mono font-bold">{formatVnd(l.amount)}</span>
                </label>
              </li>
            ))}
          </ul>
          <p className="text-right font-bold">Đã chọn {picked.length} lượt • {formatVnd(total)}</p>
          {last && !editingId && (
            <button type="button" onClick={() => setInfo({ taxCode: last.taxCode, email: last.email, companyName: last.companyName, address: last.address, note: '' })} className="font-semibold text-navy-700 underline">
              Dùng lại thông tin yêu cầu trước
            </button>
          )}
          <label className="block"><span className={labelCls}>Mã số thuế *</span><input value={info.taxCode} onChange={set('taxCode')} inputMode="numeric" className={`${inputCls} font-mono`} /></label>
          <label className="block"><span className={labelCls}>Gmail nhận hóa đơn *</span><input value={info.email} onChange={set('email')} type="email" className={inputCls} /></label>
          <label className="block"><span className={labelCls}>Tên công ty *</span><input value={info.companyName} onChange={set('companyName')} className={inputCls} /></label>
          <label className="block"><span className={labelCls}>Địa chỉ *</span><input value={info.address} onChange={set('address')} className={inputCls} /></label>
          <label className="block"><span className={labelCls}>Ghi chú</span><textarea value={info.note} onChange={set('note')} rows={2} className={inputCls} /></label>
          <div className="flex gap-2">
            <button type="submit" disabled={picked.length === 0} className={`${primaryBtn} flex-1 py-3`}>
              <Send className="h-4 w-4" />
              {editingId ? 'Cập nhật yêu cầu' : 'Gửi yêu cầu hóa đơn'}
            </button>
            {editingId && <button type="button" onClick={reset} className="rounded-md border border-line-strong px-3 font-semibold text-ink">Bỏ sửa</button>}
          </div>
        </form>
      )}
    </div>
  );
};
