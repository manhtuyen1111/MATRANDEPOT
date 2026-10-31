import React from 'react';
import { CameraScanButton } from './Qr';
import {
  CheckCircle2,
  FileSpreadsheet,
  Clock,
  CreditCard,
  FileText,
  Image as ImageIcon,
  Lock,
  MapPin,
  Plus,
  QrCode,
  Receipt,
  ShieldAlert,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
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
import { cachedPhotoUrl, photoUrl } from '../services/remote/photoLink';
import { DATETIME_PLACEHOLDER, formatDateTime, maskDateTimeInput, parseDateTime, QUICK_RANGE_OPTIONS, quickRange, QuickRangeKey } from '../services/datetime';
import { PAGE_SIZE_OPTIONS, SheetData, toXlsxBuffer, XLSX_MIME } from '../services/reports';
import { blockDimensions, formatLocation, SLOT_DIMENSION_LABELS, SlotDimension } from '../services/core';

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
      className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
        isError ? 'border-danger-bg bg-danger-bg text-danger-fg' : 'border-success-bg bg-success-bg text-success-fg'
      }`}
    >
      <div className="flex items-start gap-2">
        {isError ? (
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-danger-fg" />
        ) : (
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success-fg" />
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
  <section className={`rounded-xl border border-line bg-surface ${className}`}>
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
      <h3 className="flex items-center gap-1.5 text-base font-semibold text-ink">
        {icon}
        {title}
      </h3>
      {right}
    </header>
    <div className="p-4">{children}</div>
  </section>
);

export const LockIcon: React.FC<{ reason?: string }> = ({ reason }) => (
  <span title={reason ? `Đang khóa: ${reason}` : 'Đang khóa'} className="inline-flex text-danger-fg">
    <Lock className="h-3.5 w-3.5" aria-label="Container đang bị khóa" />
  </span>
);

export const ContainerNo: React.FC<{ no: string; locked?: boolean; lockReason?: string; className?: string }> = ({
  no,
  locked,
  lockReason,
  className = '',
}) => (
  <span className={`inline-flex items-center gap-1 font-mono font-bold text-ink ${className}`}>
    {no}
    {locked && <LockIcon reason={lockReason} />}
  </span>
);

export const inputCls =
  'w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm text-ink focus:border-accent focus:outline-hidden focus:ring-2 focus:ring-accent/40';
export const labelCls = 'mb-1 block text-xs font-medium text-ink-muted';
// DEC-117: KIỂU LINK DỮ LIỆU THỐNG NHẤT toàn app (mã hồ sơ, mã phiếu thu, mã cấp vỏ, NT- / XT-…) — giống Mã hồ sơ ở Tồn vỏ
export const linkCls = 'font-mono text-navy-700 hover:underline';

// DEC-135: GIỚI HẠN CHỮ MỖI Ô BẢNG — tối đa N ký tự, dư thì "…", rê chuột xem đủ (dữ liệu lưu vẫn đầy đủ)
export const CELL_MAX = { SHORT: 20, MEDIUM: 30, LONG: 40 } as const; // tên người / khách: 20–30, ghi chú / remark / nội dung: 40
export const clipText = (text: string | undefined | null, max: number): string => {
  const s = (text || '').trim();
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
};
// DEC-136: hiển thị vị trí — bỏ chữ "BLOCK-" (tốn chỗ), thay bằng icon định vị. Mã lưu / Danh mục / Excel / in vẫn là BLOCK-…
export const blockLabel = (code: string | null | undefined): string => (code || '').replace(/^BLOCK-/i, '');
export const BlockIcon: React.FC<{ className?: string }> = ({ className = 'h-3 w-3' }) => (
  <MapPin className={`inline-block shrink-0 text-rose-600 ${className}`} aria-label="Block" data-testid="block-icon" />
);
export const LocationText: React.FC<{
  loc: { currentBlock: string | null; currentBay: string | null; currentRow: string | null; currentTier: string | null };
  className?: string;
  iconClassName?: string;
}> = ({ loc, className = '', iconClassName }) => {
  if (!loc.currentBlock) return <span className={className}>-</span>;
  const text = formatLocation(loc);
  return (
    <span className={`inline-flex items-center gap-0.5 whitespace-nowrap ${className}`} title={text}>
      <BlockIcon className={iconClassName} />
      {text.replace(/^BLOCK-/i, '')}
    </span>
  );
};

// DEC-185: nhãn PHÁT SINH CẤP VỎ — cont hư phát hiện khi cấp vỏ (Đổi container), đi lại Báo giá → Sửa chữa
export const ReleaseDamageTag: React.FC<{ show?: boolean }> = ({ show }) =>
  show ? <span className="ml-1.5 inline-block rounded bg-danger-fg px-1.5 py-0.5 align-middle text-[10px] font-bold text-white" data-testid="release-damage">PHÁT SINH CẤP VỎ</span> : null;

// Vị trí lưu dạng chữ BLOCK-… (lịch sử vị trí, hồ sơ) → icon định vị thay chữ "BLOCK-" (DEC-136)
export const LocText: React.FC<{ text?: string }> = ({ text }) =>
  text && /^BLOCK-/i.test(text) ? (
    <span className="inline-flex items-center gap-0.5 whitespace-nowrap" title={text}>
      <BlockIcon />
      {text.replace(/^BLOCK-/i, '')}
    </span>
  ) : (
    <>{text || '-'}</>
  );

export const CellText: React.FC<{ text?: string | null; max?: number; className?: string }> = ({ text, max = CELL_MAX.MEDIUM, className = '' }) => {
  const s = (text || '').trim();
  if (!s) return <>-</>;
  return <span className={className} title={s.length > max ? s : undefined}>{clipText(s, max)}</span>;
};

export const primaryBtn =
  'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg bg-navy-900 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700 focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-45';
export const secondaryBtn =
  'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-lg border border-line-strong bg-surface px-3 py-2 text-sm font-medium text-ink hover:bg-canvas focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-45';

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
  // DEC-077: có truyền thì hiện cột SỐ LƯỢNG (VD phiếu thu trước theo lô); không truyền = mỗi dòng 1
  quantities?: number[];
  onQuantitiesChange?: (q: number[]) => void;
}> = ({ catalog, selectedIds, onChange, suggestedId, disabled, quantities = [], onQuantitiesChange }) => {
  const withQty = Boolean(onQuantitiesChange);
  const qtyAt = (i: number) => (withQty ? quantities[i] ?? 1 : 1);
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
  const total = lines.reduce((s, l) => s + l.item.defaultAmountInclVat * (Number(qtyAt(l.index)) || 0), 0);

  return (
    <SectionCard
      title="Chi phí (đã bao gồm VAT)"
      icon={<Receipt className="h-4 w-4 text-ink-muted" />}
      right={<span className="font-mono text-xs font-bold text-ink">{formatVnd(total)}</span>}
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
          onClick={() => {
            if (!pickId) return;
            onChange([...selectedIds, pickId]);
            if (withQty) onQuantitiesChange!([...selectedIds.map((_, i) => qtyAt(i)), 1]);
          }}
          className={`${primaryBtn} shrink-0`}
        >
          <Plus className="h-4 w-4" />
          Thêm
        </button>
      </div>

      {lines.length > 0 && (
        <table className="mt-3 w-full text-left text-xs">
          <tbody className="divide-y divide-line">
            {lines.map(({ index, item }) => (
              <tr key={`${item.id}-${index}`}>
                <td className="py-1.5 pr-2 font-mono text-[11px] text-ink-muted">{item.code}</td>
                <td className="py-1.5 pr-2 text-ink">{item.name}</td>
                {withQty && (
                  <>
                    <td className="py-1.5 pr-2 text-right font-mono text-[11px] text-ink-muted">{formatVnd(item.defaultAmountInclVat)} ×</td>
                    <td className="w-20 py-1.5 pr-2">
                      <input
                        type="number"
                        min={1}
                        step={1}
                        inputMode="numeric"
                        aria-label={`Số lượng ${item.name}`}
                        value={qtyAt(index)}
                        disabled={disabled}
                        onChange={(e) => onQuantitiesChange!(selectedIds.map((_, i) => (i === index ? Number(e.target.value) : qtyAt(i))))}
                        className={`${inputCls} py-1 text-right font-mono`}
                      />
                    </td>
                  </>
                )}
                <td className="py-1.5 pr-2 text-right font-mono font-semibold">{formatVnd(item.defaultAmountInclVat * (Number(qtyAt(index)) || 0))}</td>
                <td className="w-8 py-1.5 text-right">
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => {
                        onChange(selectedIds.filter((_, i) => i !== index));
                        if (withQty) onQuantitiesChange!(selectedIds.map((_, i) => qtyAt(i)).filter((_, i) => i !== index));
                      }}
                      className="rounded p-1 text-ink-muted hover:bg-rose-50 hover:text-rose-600"
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

// DEC-097: mặc định TTTT — Trực tiếp (hình thức dùng nhiều nhất)
export const EMPTY_PAYMENT: PaymentChoice = {
  paymentCategory: 'TTTT',
  scannedQrCode: '',
  ttsNote: '',
  directMethod: 'CASH',
};

// DEC-097: trả ngay đứng đầu; DEC-100: ký hiệu TT / TTR / TTS
const PAYMENT_OPTIONS: { code: PaymentCategory; title: string; sub: string }[] = [
  { code: 'TTTT', title: 'TT — Trực tiếp', sub: 'Tiền mặt hoặc chuyển khoản (API QR)' },
  { code: 'TTT', title: 'TTR — Trả trước', sub: 'Dùng tiền khách đã nạp trước (QR Phiếu thu trả trước)' },
  { code: 'TTS', title: 'TTS — Thanh toán sau', sub: 'Ghi chú TTS trên chứng từ (công nợ)' },
];

export function paymentSubmitLabel(p: PaymentChoice): string {
  if (p.paymentCategory === 'TTT') return 'Trừ Phiếu thu trả trước & hoàn tất';
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
    <SectionCard title="Hình thức thanh toán" icon={<CreditCard className="h-4 w-4 text-ink-muted" />}>
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
                active ? 'border-navy-900 bg-navy-50 ring-1 ring-accent' : 'border-line hover:bg-canvas'
              }`}
            >
              <span className="block font-bold text-ink">{opt.title}</span>
              <span className="text-[11px] text-ink-muted">{opt.sub}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3">
        {value.paymentCategory === 'TTT' && (
          <label className="block">
            <span className={labelCls}>Mã QR Phiếu thu trả trước</span>
            <div className="flex items-center gap-2">
              <QrCode className="h-4 w-4 shrink-0 text-ink-muted" />
              <input
                list="ttt-qr-list"
                value={value.scannedQrCode}
                onChange={(e) => set({ scannedQrCode: e.target.value.toUpperCase() })}
                placeholder="Quét hoặc nhập mã QR TTT..."
                className={`${inputCls} font-mono`}
              />
              <CameraScanButton onResult={(c) => set({ scannedQrCode: c })} />
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
              <FileText className="h-4 w-4 shrink-0 text-ink-muted" />
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
                    ? 'border-navy-900 bg-navy-900 text-white'
                    : 'border-line-strong bg-white text-ink hover:bg-canvas'
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
  // DEC-152 / DEC-154: database chưa nối ngân hàng → Văn phòng / Quản lý xác nhận tay sau khi đối chiếu sao kê
  const showManual = isSupabaseConfigured && can(state.currentUser, 'PAYMENT_CONFIRM');
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
        {showManual && (
          <button type="button" onClick={onSimulate} className={primaryBtn} data-testid="manual-transfer-confirm">
            Đã nhận tiền chuyển khoản (đối chiếu sao kê)
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

// DEC-082: đủ khi đã chọn Block và nhập đủ các chiều Block có cấu hình (service kiểm tra lại)
export function isSlotComplete(v: SlotValue, state: DepotState): boolean {
  const block = state.yardBlocks.find((b) => b.blockCode === v.blockCode);
  if (!block) return false;
  return blockDimensions(block).every((d) => Boolean(v[d.key]));
}

// Chọn vị trí: chỉ hiện Bay / Row / Tier mà Block có cấu hình (DEC-082)
// DEC-125: CHỌN VỊ TRÍ TỪNG BƯỚC — Block → Bay → Row → Tier (chỉ các chiều Block có cấu hình, DEC-082).
//   Dòng tóm tắt trên cùng luôn hiện giá trị đã chọn (bấm vào 1 phần để chọn lại phần đó và các phần sau);
//   bên dưới chỉ hiện bước đang chọn với toàn bộ giá trị dạng nút lớn → ép chọn đủ, dễ thao tác trên điện thoại.
const SLOT_BUTTON_LIMIT = 60; // quá nhiều giá trị (cấu hình lớn) → dùng ô chọn thả xuống
export const SlotPicker: React.FC<{
  state: DepotState;
  value: SlotValue;
  onChange: (next: SlotValue) => void;
  onlyBlocks?: string[]; // DEC-109: giới hạn block được chọn (VD: chỉ Kệ giám định)
}> = ({ state, value, onChange, onlyBlocks }) => {
  const blocks = state.yardBlocks.filter((b) => !onlyBlocks || onlyBlocks.includes(b.blockCode));
  const block = state.yardBlocks.find((b) => b.blockCode === value.blockCode);
  const dims = block ? blockDimensions(block) : [];
  const range = (n: number) => Array.from({ length: n }, (_, i) => String(i + 1).padStart(2, '0'));
  const step = !block ? 'block' : dims.find((d) => !value[d.key])?.key; // undefined = đã chọn đủ
  const current = dims.find((d) => d.key === step);
  // chọn lại 1 phần → xóa phần đó và các phần sau
  const resetFrom = (key: 'block' | SlotDimension) => {
    if (key === 'block') return onChange({ blockCode: '', bay: '', row: '', tier: '' });
    const idx = dims.findIndex((d) => d.key === key);
    const next = { ...value };
    dims.slice(idx).forEach((d) => (next[d.key] = ''));
    onChange(next);
  };
  const btn = (active: boolean) =>
    `min-h-[2.75rem] rounded-md border px-2 py-2 text-center font-mono text-sm font-bold ${active ? 'border-navy-900 bg-navy-900 text-white' : 'border-line-strong bg-white text-ink hover:border-blue-400 active:bg-navy-50'}`;
  const seg = (filled: boolean, active: boolean) =>
    `rounded px-1.5 py-0.5 font-mono font-black ${filled ? 'bg-navy-900 text-white' : active ? 'border border-dashed border-navy-900 text-navy-700' : 'text-ink-muted'}`;
  return (
    <div className="space-y-2" data-testid="slot-picker">
      {/* Dòng tóm tắt: giá trị đã chọn */}
      <div className="flex flex-wrap items-center gap-1 rounded-md border border-line bg-white px-2 py-1.5 text-xs" data-testid="slot-summary">
        <span className="mr-1 text-[11px] font-semibold uppercase text-ink-muted">Vị trí</span>
        <button type="button" onClick={() => resetFrom('block')} disabled={!block} className={seg(Boolean(block), step === 'block')} title="Chọn lại Block">
          {block ? <span className="inline-flex items-center gap-0.5"><BlockIcon />{blockLabel(block.blockCode)}</span> : 'Block'}
        </button>
        {dims.map((d, i) => (
          <React.Fragment key={d.key}>
            <span className="text-ink-muted">{i === 0 ? '/' : '-'}</span>
            <button type="button" onClick={() => resetFrom(d.key)} disabled={!value[d.key]} className={seg(Boolean(value[d.key]), step === d.key)} title={`Chọn lại ${SLOT_DIMENSION_LABELS[d.key]}`}>
              {value[d.key] || SLOT_DIMENSION_LABELS[d.key]}
            </button>
          </React.Fragment>
        ))}
        {block && !step && <span className="ml-auto font-bold text-emerald-700">✓ Đủ vị trí</span>}
      </div>

      {/* Bước đang chọn */}
      {step === 'block' && (
        <div>
          <span className={labelCls}>Chọn Block *</span>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {blocks.map((b) => (
              <button key={b.blockCode} type="button" onClick={() => onChange({ blockCode: b.blockCode, bay: '', row: '', tier: '' })} className={btn(false)}>
                <span className="inline-flex items-center gap-1"><BlockIcon />{blockLabel(b.blockCode)}</span>
              </button>
            ))}
          </div>
          {blocks.length === 0 && <p className="text-[11px] text-amber-700">Chưa có Block phù hợp trong Danh mục Vị trí.</p>}
        </div>
      )}
      {current && (
        <div>
          <span className={labelCls}>Chọn {SLOT_DIMENSION_LABELS[current.key]} * (01 → {String(current.max).padStart(2, '0')})</span>
          {current.max > SLOT_BUTTON_LIMIT ? (
            <select value="" onChange={(e) => onChange({ ...value, [current.key]: e.target.value })} className={inputCls}>
              <option value="">--</option>
              {range(current.max).map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          ) : (
            <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
              {range(current.max).map((v) => (
                <button key={v} type="button" onClick={() => onChange({ ...value, [current.key]: v })} className={btn(false)}>
                  {v}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {block && dims.length === 0 && (
        <p className="text-[11px] text-ink-muted">{block.blockCode} chỉ quản lý theo Block — không cần Bay / Row / Tier.</p>
      )}
    </div>
  );
};

// Phân trang gọn cho báo cáo / phiếu thu
export const Pager: React.FC<{
  page: number;
  pageCount: number;
  total: number;
  onPage: (p: number) => void;
  // DEC-080: người dùng chọn số dòng / trang
  pageSize?: number;
  onPageSize?: (n: number) => void;
}> = ({ page, pageCount, total, onPage, pageSize, onPageSize }) => (
  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-3 py-2 text-[11px] text-ink-muted">
    <span className="flex items-center gap-2">
      {total} bản ghi
      {onPageSize && (
        <select value={pageSize} onChange={(e) => { onPageSize(Number(e.target.value)); onPage(1); }} aria-label="Số dòng mỗi trang" className="rounded border border-line-strong bg-white px-1.5 py-1 text-[11px]">
          {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n} dòng / trang</option>)}
        </select>
      )}
    </span>
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

// DEC-054: mọi chỗ hiển thị thời gian dùng dd/MM/yyyy HH:mm:ss
export function formatViTime(iso?: string): string {
  return formatDateTime(iso);
}

// Ô nhập thời gian chuẩn dd/MM/yyyy HH:mm:ss (tự chèn dấu khi gõ số; viền đỏ nếu sai). Dùng cho mọi bộ lọc thời gian.
export const DateTimeField: React.FC<{
  label: string;
  value: string;
  onChange: (next: string) => void;
  fallback?: 'start' | 'end';
}> = ({ label, value, onChange, fallback = 'start' }) => {
  const invalid = Boolean(value.trim()) && !parseDateTime(value, fallback);
  return (
    <label className="block">
      <span className={labelCls}>{label}</span>
      <input
        value={value}
        inputMode="numeric"
        placeholder={DATETIME_PLACEHOLDER}
        onChange={(e) => onChange(maskDateTimeInput(e.target.value))}
        aria-invalid={invalid}
        className={`${inputCls} font-mono ${invalid ? 'border-red-500 focus:border-red-600 focus:ring-red-600' : ''}`}
      />
    </label>
  );
};

// DEC-102: ô lọc nhanh thời gian (Hôm nay … Năm nay / Tùy chọn) — dùng cho MỌI bộ lọc thời gian.
// Chỉ khi chọn Tùy chọn mới hiện 2 ô Từ - Đến. Trả về các ô liền nhau để đặt thẳng vào lưới bộ lọc.
export const DateRangeFilter: React.FC<{
  value: { dateFrom?: string; dateTo?: string };
  onChange: (next: { dateFrom: string; dateTo: string }) => void;
  label?: string;
  required?: boolean;
}> = ({ value, onChange, label = 'Thời gian', required }) => {
  const [preset, setPreset] = React.useState<QuickRangeKey>('TODAY');
  const mark = required ? ' *' : '';
  return (
    <>
      <label className="block">
        <span className={labelCls}>{label}{mark}</span>
        <select
          value={preset}
          aria-label="Lọc nhanh thời gian"
          onChange={(e) => {
            const key = e.target.value as QuickRangeKey;
            setPreset(key);
            if (key !== 'CUSTOM') onChange(quickRange(key));
          }}
          className={inputCls}
        >
          {QUICK_RANGE_OPTIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
      </label>
      {preset === 'CUSTOM' && (
        <>
          <DateTimeField label={`Từ (dd/mm/yyyy hh:mm:ss)${mark}`} value={value.dateFrom || ''} onChange={(v) => onChange({ dateFrom: v, dateTo: value.dateTo || '' })} />
          <DateTimeField label={`Đến (dd/mm/yyyy hh:mm:ss)${mark}`} value={value.dateTo || ''} onChange={(v) => onChange({ dateFrom: value.dateFrom || '', dateTo: v })} fallback="end" />
        </>
      )}
    </>
  );
};

// Tải file Excel .xlsx (DEC-050, DEC-055) — dùng chung cho Phiếu thu và mọi báo cáo
export const ExportExcelButton: React.FC<{
  getSheets: () => SheetData[] | Promise<SheetData[]>; // database: lấy dữ liệu theo đợt (DEC-178)
  fileName: string;
  disabled?: boolean;
}> = ({ getSheets, fileName, disabled }) => {
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);
  const run = async () => {
    setErr(null);
    setBusy(true);
    try {
      const buf = await toXlsxBuffer(await getSheets());
      const url = URL.createObjectURL(new Blob([buf], { type: XLSX_MIME }));
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Không tạo được file Excel.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={run} disabled={disabled || busy} className={secondaryBtn}>
        <FileSpreadsheet className="h-4 w-4 text-emerald-700" />
        {busy ? 'Đang tạo file...' : 'Xuất Excel'}
      </button>
      {err && <span className="text-[11px] text-red-700">{err}</span>}
    </span>
  );
};

// ---------------------------------------------------------------------------
// DEC-080: TRANG NHIỀU DỮ LIỆU — số dòng / trang do người dùng chọn (nhớ theo từng màn, trên trình duyệt này)
// ---------------------------------------------------------------------------
export function usePageSize(screenKey: string, fallback = 50): [number, (n: number) => void] {
  const storageKey = `matran.pageSize.${screenKey}`;
  const [size, setSize] = React.useState<number>(() => {
    try {
      const saved = Number(window.localStorage.getItem(storageKey));
      return (PAGE_SIZE_OPTIONS as readonly number[]).includes(saved) ? saved : fallback;
    } catch {
      return fallback;
    }
  });
  const update = (n: number) => {
    setSize(n);
    try {
      window.localStorage.setItem(storageKey, String(n));
    } catch {
      /* trình duyệt chặn lưu — vẫn dùng được trong phiên */
    }
  };
  return [size, update];
}

// DEC-080: CHI TIẾT 1 DÒNG — cửa sổ trượt bên phải; danh sách vẫn thấy phía sau; đóng bằng X / Esc / bấm ra ngoài
export const DetailDrawer: React.FC<{
  open: boolean;
  title: React.ReactNode;
  onClose: () => void;
  actions?: React.ReactNode;
  wide?: boolean;
  children: React.ReactNode;
}> = ({ open, title, onClose, actions, wide, children }) => {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label="Chi tiết">
      <button type="button" aria-label="Đóng chi tiết" onClick={onClose} className="absolute inset-0 cursor-default bg-navy-900/30" />
      <aside className={`relative flex h-full w-full flex-col bg-white shadow-2xl ${wide ? 'sm:w-[min(960px,75vw)]' : 'sm:w-[min(760px,60vw)]'}`}>
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
          <h3 className="min-w-0 flex-1 text-sm font-black text-ink">{title}</h3>
          <div className="flex flex-wrap items-center gap-2">
            {actions}
            <button type="button" onClick={onClose} aria-label="Đóng" className={secondaryBtn}>
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 text-xs">{children}</div>
      </aside>
    </div>
  );
};

// DEC-093: Ô KHÁCH HÀNG — gõ tay hoặc chọn; gõ thì hiện gợi ý khách trong Danh mục.
//   Khách ngoài Danh mục vẫn lưu được nhưng chỉ thanh toán Tiền mặt / Chuyển khoản (service kiểm tra).
export const CustomerInput: React.FC<{
  state: DepotState;
  value: string;
  onChange: (name: string) => void;
  id: string;
  placeholder?: string;
}> = ({ state, value, onChange, id, placeholder = 'Gõ tên hoặc mã khách hàng...' }) => {
  const customers = state.partners.filter((p) => p.isCustomer);
  const typed = value.trim().toLowerCase();
  // Gõ đúng MÃ khách (VD VIETLOG) → điền tên khách trong Danh mục
  const byCode = customers.find((c) => c.code.toLowerCase() === typed);
  const known = customers.some((c) => c.name.toLowerCase() === typed);
  return (
    <>
      <input
        list={`${id}-list`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => byCode && onChange(byCode.name)}
        placeholder={placeholder}
        className={inputCls}
        autoComplete="off"
      />
      <datalist id={`${id}-list`}>
        {customers.map((c) => (
          <option key={c.id} value={c.name}>{c.code}</option>
        ))}
      </datalist>
      {typed && !known && !byCode && (
        <span className="mt-1 block text-[11px] font-semibold text-amber-700">Khách ngoài Danh mục — chỉ thanh toán Tiền mặt / Chuyển khoản (không TTS / TTT).</span>
      )}
    </>
  );
};

// ẢNH CỬA CONTAINER — KÍNH LÚP (đọc số cont cho chuẩn):
//   rê chuột lên ảnh nhỏ → kính lúp tròn phóng to đúng chỗ con trỏ (máy tính);
//   bấm ảnh → xem toàn màn hình, phóng to 1× → 4× (nút / cuộn chuột), kéo để di chuyển (cả điện thoại).
const LENS_SIZE = 160;
const LENS_ZOOM = 3;
const ZOOM_STEPS = [1, 1.5, 2, 3, 4];

// Ảnh trong kho chỉ lưu đường dẫn → xin link xem khi ảnh được hiện (DEC-178); ảnh data / http dùng thẳng
function usePhotoSrc(src: string): string {
  const [url, setUrl] = React.useState(() => cachedPhotoUrl(src) || '');
  React.useEffect(() => {
    let alive = true;
    void photoUrl(src).then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [src]);
  return url;
}

// NÚT XEM ẢNH (DEC-178): mở hồ sơ / chi tiết KHÔNG tải ảnh — chỉ bấm XEM ẢNH mới xin link + tải ảnh
// autoShow (DEC-182): ảnh cửa cont của Giám định hiện luôn khi mở hồ sơ / màn chi tiết (1 ảnh) — không cần bấm XEM ẢNH
export const PhotoGallery: React.FC<{ photos: (string | undefined)[]; alt: string; className: string; testId?: string; autoShow?: boolean }> = ({ photos, alt, className, testId, autoShow = false }) => {
  const [shown, setShown] = React.useState(autoShow);
  const list = photos.filter((p): p is string => Boolean(p));
  if (!list.length) return null;
  if (!shown) {
    return (
      <button type="button" onClick={(e) => { e.stopPropagation(); setShown(true); }} className="inline-flex items-center gap-1.5 rounded-md border border-line-strong bg-white px-2.5 py-1.5 text-xs font-bold text-navy-700 hover:bg-navy-50" data-testid={testId}>
        <ImageIcon className="h-4 w-4" />
        XEM ẢNH ({list.length})
      </button>
    );
  }
  return (
    <div className="flex flex-wrap gap-1.5" data-testid={testId}>
      {list.map((p, i) => (
        <PhotoZoom key={p} src={p} alt={list.length > 1 ? `${alt} ${i + 1}` : alt} className={className} />
      ))}
    </div>
  );
};

export const PhotoZoom: React.FC<{ src: string; alt: string; className: string }> = ({ src: path, alt, className }) => {
  const [lens, setLens] = React.useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [open, setOpen] = React.useState(false);
  const src = usePhotoSrc(path);
  if (!src) return <span className={`flex items-center justify-center rounded-md border border-line bg-canvas text-[10px] text-ink-muted ${className}`}>Đang tải ảnh…</span>;
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation(); // ảnh trong dòng bảng bấm được (DEC-117)
          setOpen(true);
        }}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setLens({ x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height });
        }}
        onMouseLeave={() => setLens(null)}
        className={`relative block cursor-zoom-in overflow-visible p-0 ${className}`}
        aria-label={`${alt} — bấm để phóng to`}
        title="Rê chuột để soi kính lúp, bấm để xem toàn màn hình"
      >
        <img src={src} alt={alt} loading="lazy" className="h-full w-full rounded-md border border-line object-cover" />
        <span className="absolute bottom-1 right-1 rounded bg-navy-900/70 p-1 text-white">
          <ZoomIn className="h-3.5 w-3.5" />
        </span>
        {lens && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute z-30 rounded-full border-2 border-white shadow-[0_8px_32px_rgba(11,37,69,0.35)]"
            style={{
              width: LENS_SIZE,
              height: LENS_SIZE,
              left: lens.x - LENS_SIZE / 2,
              top: lens.y - LENS_SIZE / 2,
              backgroundImage: `url("${src}")`,
              backgroundRepeat: 'no-repeat',
              backgroundSize: `${lens.w * LENS_ZOOM}px ${lens.h * LENS_ZOOM}px`,
              backgroundPosition: `${LENS_SIZE / 2 - lens.x * LENS_ZOOM}px ${LENS_SIZE / 2 - lens.y * LENS_ZOOM}px`,
            }}
          />
        )}
      </button>
      {open && <PhotoViewer src={src} alt={alt} onClose={() => setOpen(false)} />}
    </>
  );
};

const PhotoViewer: React.FC<{ src: string; alt: string; onClose: () => void }> = ({ src, alt, onClose }) => {
  const [step, setStep] = React.useState(0);
  const box = React.useRef<HTMLDivElement>(null);
  const drag = React.useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const zoom = ZOOM_STEPS[step];
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const change = (d: number) => setStep((s) => Math.min(ZOOM_STEPS.length - 1, Math.max(0, s + d)));
  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-navy-900/95" role="dialog" aria-modal="true" aria-label={alt}>
      <div className="flex items-center justify-between gap-2 px-4 py-2 text-white">
        <span className="text-sm font-semibold">{alt} — {Math.round(zoom * 100)}%</span>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => change(-1)} disabled={step === 0} aria-label="Thu nhỏ" className="rounded-md bg-white/15 p-2 disabled:opacity-40">
            <ZoomOut className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => change(1)} disabled={step === ZOOM_STEPS.length - 1} aria-label="Phóng to" className="rounded-md bg-white/15 p-2 disabled:opacity-40">
            <ZoomIn className="h-4 w-4" />
          </button>
          <button type="button" onClick={onClose} aria-label="Đóng ảnh" className="rounded-md bg-white/15 p-2">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        ref={box}
        className={`flex-1 overflow-auto ${zoom > 1 ? 'cursor-grab' : ''}`}
        onWheel={(e) => change(e.deltaY < 0 ? 1 : -1)}
        onPointerDown={(e) => {
          if (!box.current) return;
          drag.current = { x: e.clientX, y: e.clientY, left: box.current.scrollLeft, top: box.current.scrollTop };
        }}
        onPointerMove={(e) => {
          if (!drag.current || !box.current) return;
          box.current.scrollLeft = drag.current.left - (e.clientX - drag.current.x);
          box.current.scrollTop = drag.current.top - (e.clientY - drag.current.y);
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerLeave={() => (drag.current = null)}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          onDoubleClick={() => setStep((s) => (s === 0 ? 3 : 0))}
          className="mx-auto block select-none"
          style={zoom === 1 ? { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' } : { width: `${zoom * 100}%`, maxWidth: 'none' }}
        />
      </div>
      <p className="px-4 py-2 text-center text-[11px] text-white/70">Cuộn chuột hoặc bấm +/- để phóng to • kéo để di chuyển • bấm đúp để phóng to nhanh • Esc để đóng</p>
    </div>
  );
};

// DEC-202: màu TRẠNG THÁI hiện tại của cont (Tồn vỏ, Đảo chuyển) — AV xanh, DAMAGE đỏ, các bước CHỜ nền nhạt (token — DEC-145)
export const yardStatusTone = (status: string) =>
  status === 'AV' ? 'bg-success-bg text-success-fg' : status === 'DAMAGE' ? 'bg-danger-bg text-danger-fg' : 'bg-accent-soft text-ink';

