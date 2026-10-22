import React from 'react';
import {
  CheckCircle2,
  Clock,
  CreditCard,
  FileText,
  Lock,
  Plus,
  QrCode,
  Receipt,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import {
  DepotFeeCatalogItem,
  DirectPaymentMethod,
  PaymentCategory,
  PaymentTransaction,
} from '../types/depot';
import { DepotState, formatVnd } from '../services/depotStore';
import { can } from '../services/permissions';
import { isSupabaseConfigured } from '../lib/env';

// ---------------------------------------------------------------------------
// Thông báo lỗi / thành công thống nhất
// ---------------------------------------------------------------------------
export const Feedback: React.FC<{
  error?: string | null;
  success?: string | null;
  onClose?: () => void;
}> = ({ error, success, onClose }) => {
  if (!error && !success) return null;
  const isError = Boolean(error);
  return (
    <div
      role={isError ? 'alert' : 'status'}
      className={`flex items-start justify-between gap-3 rounded-lg border px-3.5 py-2.5 text-xs ${
        isError ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-900'
      }`}
    >
      <div className="flex items-start gap-2">
        {isError ? (
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
        ) : (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
        )}
        <span className="font-medium">{error || success}</span>
      </div>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Đóng thông báo" className="shrink-0 opacity-60 hover:opacity-100">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
};

export const SectionCard: React.FC<{
  title: React.ReactNode;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, icon, right, children, className = '' }) => (
  <section className={`rounded-lg border border-slate-200 bg-white ${className}`}>
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
      <h3 className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-800">
        {icon}
        {title}
      </h3>
      {right}
    </header>
    <div className="p-4">{children}</div>
  </section>
);

export const LockIcon: React.FC<{ reason?: string }> = ({ reason }) => (
  <span title={reason ? `Đang khóa: ${reason}` : 'Đang khóa'} className="inline-flex text-rose-600">
    <Lock className="h-3.5 w-3.5" aria-label="Container đang bị khóa" />
  </span>
);

export const ContainerNo: React.FC<{ no: string; locked?: boolean; lockReason?: string; className?: string }> = ({
  no,
  locked,
  lockReason,
  className = '',
}) => (
  <span className={`inline-flex items-center gap-1 font-mono font-bold text-slate-900 ${className}`}>
    {no}
    {locked && <LockIcon reason={lockReason} />}
  </span>
);

export const inputCls =
  'w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-hidden focus:ring-1 focus:ring-blue-600';
export const labelCls = 'mb-1 block text-[11px] font-semibold uppercase text-slate-600';
export const primaryBtn =
  'inline-flex items-center justify-center gap-1.5 rounded-md bg-blue-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50';
export const secondaryBtn =
  'inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50';

// ---------------------------------------------------------------------------
// CHI PHÍ (ĐÃ BAO GỒM VAT) — chỉ chọn từ biểu giá Danh mục chung (dùng chung Hạ vỏ / Cấp vỏ)
// ---------------------------------------------------------------------------
export function suggestLoloFee(
  catalog: DepotFeeCatalogItem[],
  size?: string,
  type?: string,
  line?: string
): DepotFeeCatalogItem | undefined {
  const lolo = catalog.filter((f) => f.category === 'NANG_HA');
  return (
    lolo.find((f) => f.size === size && f.type === type && f.shippingLineCode === line) ||
    lolo.find((f) => f.size === size && f.type === type && f.shippingLineCode === 'ALL')
  );
}

export const FeeLinesEditor: React.FC<{
  catalog: DepotFeeCatalogItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  suggestedId?: string;
  disabled?: boolean;
}> = ({ catalog, selectedIds, onChange, suggestedId, disabled }) => {
  const [pickId, setPickId] = React.useState<string>(suggestedId || '');
  React.useEffect(() => {
    if (suggestedId) setPickId(suggestedId);
  }, [suggestedId]);

  const groups: { label: string; items: DepotFeeCatalogItem[] }[] = [
    { label: 'Nâng hạ', items: catalog.filter((f) => f.category === 'NANG_HA') },
    { label: 'Thu gom rác', items: catalog.filter((f) => f.category === 'THU_GOM_RAC') },
    { label: 'Khác', items: catalog.filter((f) => f.category !== 'NANG_HA' && f.category !== 'THU_GOM_RAC') },
  ];
  const lines = selectedIds
    .map((id, index) => ({ index, item: catalog.find((c) => c.id === id) }))
    .filter((l): l is { index: number; item: DepotFeeCatalogItem } => Boolean(l.item));
  const total = lines.reduce((s, l) => s + l.item.defaultAmountInclVat, 0);

  return (
    <SectionCard
      title="Chi phí (đã bao gồm VAT)"
      icon={<Receipt className="h-4 w-4 text-slate-500" />}
      right={<span className="font-mono text-xs font-bold text-slate-900">{formatVnd(total)}</span>}
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <select
          value={pickId}
          onChange={(e) => setPickId(e.target.value)}
          className={inputCls}
          disabled={disabled}
          aria-label="Chọn khoản chi phí"
        >
          <option value="">-- Chọn khoản chi phí --</option>
          {groups.map((g) =>
            g.items.length ? (
              <optgroup key={g.label} label={g.label}>
                {g.items.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name} — {formatVnd(f.defaultAmountInclVat)}
                  </option>
                ))}
              </optgroup>
            ) : null
          )}
        </select>
        <button
          type="button"
          disabled={disabled || !pickId}
          onClick={() => pickId && onChange([...selectedIds, pickId])}
          className={`${primaryBtn} shrink-0`}
        >
          <Plus className="h-4 w-4" />
          Thêm
        </button>
      </div>

      {lines.length > 0 && (
        <table className="mt-3 w-full text-left text-xs">
          <tbody className="divide-y divide-slate-100">
            {lines.map(({ index, item }) => (
              <tr key={`${item.id}-${index}`}>
                <td className="py-1.5 pr-2 font-mono text-[11px] text-slate-500">{item.code}</td>
                <td className="py-1.5 pr-2 text-slate-900">{item.name}</td>
                <td className="py-1.5 pr-2 text-right font-mono font-semibold">{formatVnd(item.defaultAmountInclVat)}</td>
                <td className="w-8 py-1.5 text-right">
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => onChange(selectedIds.filter((_, i) => i !== index))}
                      className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      aria-label={`Xóa ${item.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </SectionCard>
  );
};

// ---------------------------------------------------------------------------
// HÌNH THỨC THANH TOÁN — TTT / TTS / TTTT (dùng chung Hạ vỏ / Cấp vỏ)
// ---------------------------------------------------------------------------
export interface PaymentChoice {
  paymentCategory: PaymentCategory;
  scannedQrCode: string;
  ttsNote: string;
  directMethod: DirectPaymentMethod;
}

export const EMPTY_PAYMENT: PaymentChoice = {
  paymentCategory: 'TTT',
  scannedQrCode: '',
  ttsNote: '',
  directMethod: 'CASH',
};

const PAYMENT_OPTIONS: { code: PaymentCategory; title: string; sub: string }[] = [
  { code: 'TTT', title: 'TTT — Thanh toán trước', sub: 'Quét QR Phiếu thu mẹ, trừ dần' },
  { code: 'TTS', title: 'TTS — Thanh toán sau', sub: 'Ghi chú TTS trên chứng từ (công nợ)' },
  { code: 'TTTT', title: 'TTTT — Trực tiếp', sub: 'Chuyển khoản API QR / Tiền mặt' },
];

export function paymentSubmitLabel(p: PaymentChoice): string {
  if (p.paymentCategory === 'TTT') return 'Trừ Phiếu thu mẹ & hoàn tất';
  if (p.paymentCategory === 'TTS') return 'Xác nhận TTS & hoàn tất';
  return p.directMethod === 'CASH' ? 'Xác nhận đã thu tiền mặt & hoàn tất' : 'Tạo QR chuyển khoản';
}

export function isPaymentChoiceComplete(p: PaymentChoice): boolean {
  if (p.paymentCategory === 'TTT') return Boolean(p.scannedQrCode.trim());
  if (p.paymentCategory === 'TTS') return Boolean(p.ttsNote.trim());
  return Boolean(p.directMethod);
}

export const PaymentPanel: React.FC<{
  state: DepotState;
  value: PaymentChoice;
  onChange: (next: PaymentChoice) => void;
}> = ({ state, value, onChange }) => {
  const activeMasters = state.masterReceipts.filter((r) => r.status === 'ACTIVE');
  const set = (patch: Partial<PaymentChoice>) => onChange({ ...value, ...patch });
  return (
    <SectionCard title="Hình thức thanh toán" icon={<CreditCard className="h-4 w-4 text-slate-500" />}>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Hình thức thanh toán">
        {PAYMENT_OPTIONS.map((opt) => {
          const active = value.paymentCategory === opt.code;
          return (
            <button
              key={opt.code}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => set({ paymentCategory: opt.code })}
              className={`rounded-md border px-3 py-2 text-left text-xs transition ${
                active ? 'border-blue-600 bg-blue-50 ring-1 ring-blue-600' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span className="block font-bold text-slate-900">{opt.title}</span>
              <span className="text-[11px] text-slate-500">{opt.sub}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3">
        {value.paymentCategory === 'TTT' && (
          <label className="block">
            <span className={labelCls}>Mã QR Phiếu thu mẹ</span>
            <div className="flex items-center gap-2">
              <QrCode className="h-4 w-4 shrink-0 text-slate-500" />
              <input
                list="ttt-qr-list"
                value={value.scannedQrCode}
                onChange={(e) => set({ scannedQrCode: e.target.value.toUpperCase() })}
                placeholder="Quét hoặc nhập mã QR TTT..."
                className={`${inputCls} font-mono`}
              />
              <datalist id="ttt-qr-list">
                {activeMasters.map((r) => (
                  <option key={r.id} value={r.qrCode}>
                    {r.customerName} — Dư {formatVnd(r.remainingAmount)}
                  </option>
                ))}
              </datalist>
            </div>
          </label>
        )}
        {value.paymentCategory === 'TTS' && (
          <label className="block">
            <span className={labelCls}>Ghi chú TTS trên chứng từ</span>
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 shrink-0 text-slate-500" />
              <input
                value={value.ttsNote}
                onChange={(e) => set({ ttsNote: e.target.value })}
                placeholder="Nguồn xác nhận TTS (hãng tàu / hợp đồng / người duyệt)..."
                className={inputCls}
              />
            </div>
          </label>
        )}
        {value.paymentCategory === 'TTTT' && (
          <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Phương thức thanh toán trực tiếp">
            {(['BANK_TRANSFER_API', 'CASH'] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={value.directMethod === m}
                onClick={() => set({ directMethod: m })}
                className={`rounded-md border py-2 text-xs font-semibold ${
                  value.directMethod === m
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {m === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản (API QR)'}
              </button>
            ))}
          </div>
        )}
      </div>
    </SectionCard>
  );
};

// ---------------------------------------------------------------------------
// Yêu cầu chuyển khoản đang chờ ngân hàng xác nhận
// ---------------------------------------------------------------------------
export const PendingTransferPanel: React.FC<{
  state: DepotState;
  transaction: PaymentTransaction;
  onSimulate: () => void;
  onCancel: (reason: string) => void;
}> = ({ state, transaction, onSimulate, onCancel }) => {
  const [reason, setReason] = React.useState('');
  const showDemo = !isSupabaseConfigured && can(state.currentUser, 'DEMO_BANK_SIMULATOR');
  return (
    <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-xs text-amber-950">
      <p className="flex items-center gap-1.5 font-bold">
        <Clock className="h-4 w-4" />
        Đang chờ ngân hàng xác nhận chuyển khoản — chưa ghi nhận đã thu tiền
      </p>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <div>
          <span className="block text-[11px] text-amber-800">Nội dung / mã tham chiếu</span>
          <span className="font-mono font-bold">{transaction.paymentRef}</span>
        </div>
        <div>
          <span className="block text-[11px] text-amber-800">Số tiền</span>
          <span className="font-mono font-bold">{formatVnd(transaction.amount)}</span>
        </div>
        <div>
          <span className="block text-[11px] text-amber-800">Dữ liệu QR</span>
          <span className="break-all font-mono text-[11px]">{transaction.qrPayload}</span>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        {showDemo && (
          <button type="button" onClick={onSimulate} className={primaryBtn}>
            Giả lập ngân hàng báo có (DEMO)
          </button>
        )}
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Lý do hủy yêu cầu chuyển khoản..."
          className={inputCls}
        />
        <button type="button" disabled={!reason.trim()} onClick={() => onCancel(reason)} className={`${secondaryBtn} shrink-0`}>
          Hủy yêu cầu
        </button>
      </div>
      {showDemo && (
        <p className="text-[11px] text-amber-800">
          Chế độ Demo chưa kết nối ngân hàng. Nút giả lập đi qua cùng cơ chế chống trùng như webhook thật và sẽ bị ẩn khi cấu hình Supabase.
        </p>
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Chọn vị trí Block / Bay / Row / Tier theo cấu hình
// ---------------------------------------------------------------------------
export interface SlotValue {
  blockCode: string;
  bay: string;
  row: string;
  tier: string;
}

export const EMPTY_SLOT: SlotValue = { blockCode: '', bay: '', row: '', tier: '' };

export function isSlotComplete(v: SlotValue): boolean {
  return Boolean(v.blockCode) && (!v.bay || Boolean(v.row && v.tier));
}

export const SlotPicker: React.FC<{
  state: DepotState;
  value: SlotValue;
  onChange: (next: SlotValue) => void;
}> = ({ state, value, onChange }) => {
  const block = state.yardBlocks.find((b) => b.blockCode === value.blockCode);
  const range = (n: number) => Array.from({ length: n }, (_, i) => String(i + 1).padStart(2, '0'));
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <label>
        <span className={labelCls}>Block *</span>
        <select
          value={value.blockCode}
          onChange={(e) => onChange({ blockCode: e.target.value, bay: '', row: '', tier: '' })}
          className={inputCls}
        >
          <option value="">-- Chọn --</option>
          {state.yardBlocks.map((b) => (
            <option key={b.blockCode} value={b.blockCode}>
              {b.blockCode}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span className={labelCls}>Bay</span>
        <select
          value={value.bay}
          disabled={!block}
          onChange={(e) => onChange({ ...value, bay: e.target.value, row: e.target.value ? value.row : '', tier: e.target.value ? value.tier : '' })}
          className={inputCls}
        >
          <option value="">Cấp Block</option>
          {block && range(block.maxBay).map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </label>
      <label>
        <span className={labelCls}>Row</span>
        <select value={value.row} disabled={!value.bay} onChange={(e) => onChange({ ...value, row: e.target.value })} className={inputCls}>
          <option value="">--</option>
          {block && range(block.maxRow).map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </label>
      <label>
        <span className={labelCls}>Tier</span>
        <select value={value.tier} disabled={!value.bay} onChange={(e) => onChange({ ...value, tier: e.target.value })} className={inputCls}>
          <option value="">--</option>
          {block && range(block.maxTier).map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </label>
    </div>
  );
};

// Phân trang gọn cho báo cáo / phiếu thu
export const Pager: React.FC<{ page: number; pageCount: number; total: number; onPage: (p: number) => void }> = ({
  page,
  pageCount,
  total,
  onPage,
}) => (
  <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-2 text-[11px] text-slate-600">
    <span>{total} bản ghi</span>
    <div className="flex items-center gap-1">
      <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className={secondaryBtn}>
        Trước
      </button>
      <span className="px-2 font-mono">
        {page}/{pageCount}
      </span>
      <button type="button" disabled={page >= pageCount} onClick={() => onPage(page + 1)} className={secondaryBtn}>
        Sau
      </button>
    </div>
  </div>
);

export function formatViTime(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
