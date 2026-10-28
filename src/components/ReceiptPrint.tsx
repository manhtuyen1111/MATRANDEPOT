import React from 'react';
import { recordReceiptPrint } from '../services/api';
import { createPortal } from 'react-dom';
import { Eye, Printer, X } from 'lucide-react';
import { CompanyProfile, PAYMENT_METHOD_LABELS, PaymentReceipt, RECEIPT_OPERATION_LABELS, VesselList, VesselListItem } from '../types/depot';
import { DepotState, formatVnd } from '../services/depotStore';
import { receiptCollectorName, receiptOperationOf } from '../services/payments';

import { formatDateTime } from '../services/datetime';
import { secondaryBtn } from './shared';
import { QrImage } from './Qr';
import { invoicePortalUrl } from '../services/invoice';
import { printNow } from './printNow';

// ============================================================================
// GIẤY TỜ IN DÙNG CHUNG (DEC-062, DEC-063, DEC-072)
//   Mọi giấy tờ cùng 1 khung: đầu CÔNG TY → TIÊU ĐỀ + Số → TÁC NGHIỆP → thông tin → bảng → chữ ký → "In lúc".
//   Hạ vỏ / Cấp vỏ (DEC-161): PHIẾU EEIR (K80) (EeirK80Sheet — K80TicketModal.tsx) + PHIẾU THU (K80) in liền 1 cuộn.
//   EEIR Nhập tàu / Xuất tàu cũng khổ K80 (K80Frame). Quy trình: Xem phiếu → trong cửa sổ xem có nút In (PrintPreviewModal).
// ============================================================================

// Khối thông tin CÔNG TY dùng chung cho mọi giấy tờ in (DEC-062)
export const CompanyHeader: React.FC<{ company: CompanyProfile; title: string; subtitle?: React.ReactNode }> = ({ company, title, subtitle }) => (
  <div className="border-b-2 border-slate-800 pb-2 text-center">
    <p className="text-sm font-black uppercase">{company.name}</p>
    {company.address && <p className="text-[11px]">Địa chỉ: {company.address}</p>}
    {(company.phone || company.email) && (
      <p className="text-[11px]">
        {company.phone && <>ĐT: {company.phone}</>}
        {company.phone && company.email && ' • '}
        {company.email && <>Email: {company.email}</>}
      </p>
    )}
    {company.taxCode && <p className="text-[11px]">MST: {company.taxCode}</p>}
    <p className="mt-2 text-base font-black tracking-wide">{title}</p>
    {subtitle}
  </div>
);

// Khung giấy tờ K80 (DEC-161) — PHIẾU THU (K80) và EEIR Nhập / Xuất tàu (K80); cùng khổ, cùng kiểu chữ với PHIẾU EEIR (K80)
const K80Frame: React.FC<{ state: DepotState; title: string; number: string; operation: string; reprintNo?: number; children: React.ReactNode }> = ({
  state,
  title,
  number,
  operation,
  reprintNo,
  children,
}) => {
  const c = state.companyProfile;
  return (
    <section className="k80-sheet mx-auto border-2 border-dashed border-slate-800 bg-white px-2 py-2 font-mono text-[11px] leading-snug text-ink">
      <div className="border-b-2 border-slate-800 pb-2 text-center">
        <p className="text-xs font-black uppercase">{c.name}</p>
        {c.address && <p className="text-[10px]">{c.address}</p>}
        {(c.phone || c.email) && <p className="text-[10px]">{[c.phone && `ĐT: ${c.phone}`, c.email].filter(Boolean).join(' • ')}</p>}
        {c.taxCode && <p className="text-[10px]">MST: {c.taxCode}</p>}
        <p className="mt-1.5 text-sm font-black tracking-wide">{title}</p>
        <p className="text-xs font-bold">Số: {number}</p>
        <p className="mt-1 inline-block bg-navy-900 px-2 py-0.5 text-xs font-black text-white">TÁC NGHIỆP: {operation}</p>
        {reprintNo && reprintNo > 1 && <p className="mt-1 border-2 border-rose-600 py-0.5 text-[11px] font-black text-rose-600">BẢN IN LẠI — LẦN {reprintNo}</p>}
      </div>
      {children}
    </section>
  );
};

const InfoGrid: React.FC<{ rows: [string, React.ReactNode, boolean?][]; narrow?: boolean }> = ({ rows, narrow }) => (
  <dl className={`mt-3 grid ${narrow ? 'grid-cols-[92px_1fr] gap-x-2 gap-y-0.5' : 'grid-cols-[140px_1fr] gap-x-3 gap-y-1'}`}>
    {rows.map(([label, value, mono]) => (
      <React.Fragment key={label}>
        <dt className="text-ink-muted">{label}</dt>
        <dd className={`font-semibold ${mono ? 'font-mono' : ''}`}>{value || '-'}</dd>
      </React.Fragment>
    ))}
  </dl>
);

const Signatures: React.FC<{ left: string; right: string; rightName?: string }> = ({ left, right, rightName }) => (
  <div className="mt-5 grid grid-cols-2 text-center">
    <span>{left}<br /><br /><br />(Ký, ghi rõ họ tên)</span>
    <span>{right}<br /><br /><br />{rightName || '(Ký, ghi rõ họ tên)'}</span>
  </div>
);

const PrintFooter: React.FC<{ note?: string }> = ({ note }) => (
  <p className="mt-2 text-center text-[10px] text-ink-muted">In lúc {formatDateTime(new Date())}{note ? ` • ${note}` : ''}</p>
);

// ---------------------------------------------------------------------------
// PHIẾU THU (K80) — mẫu duy nhất (DEC-062, DEC-063, DEC-161): Văn phòng → Phiếu thu, Trả chứng từ, Hồ sơ container
// ---------------------------------------------------------------------------
export const ReceiptPrintSheet: React.FC<{ state: DepotState; receipt: PaymentReceipt; printNo?: number }> = ({ state, receipt: r, printNo }) => {
  const opKey = receiptOperationOf(state, r);
  const op = RECEIPT_OPERATION_LABELS[opKey];
  const tx = state.paymentTransactions.find((t) => t.id === r.transactionId);
  const voucher = r.voucherId ? state.vouchers.find((v) => v.id === r.voucherId) : undefined;
  // DEC-077: PHIẾU THU TRƯỚC — cùng khung, khác tên, có khung nổi bật mã QR trừ dần (DEC-124: mã = số phiếu PT-TTR-)
  const master = r.purpose === "PREPAID_TOPUP" ? state.masterReceipts.find((m) => m.id === r.masterReceiptId || m.receiptCode === r.masterReceiptCode) : undefined;
  const isPrepaid = opKey === "THU_TRUOC" || Boolean(master);
  const lines = master?.feeLines?.length ? master.feeLines : voucher?.feeLines || [];
  const hasQty = lines.some((l) => (l.quantity || 1) > 1);
  return (
    <K80Frame state={state} title={isPrepaid ? "PHIẾU THU TRẢ TRƯỚC (TTR)" : "PHIẾU THU"} number={r.receiptNo} operation={op} reprintNo={printNo}>
      {isPrepaid && master && (
        <div className="mt-2 border-4 border-double border-slate-900 px-3 py-2 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider">Phiếu thu trả trước — dùng trừ dần cho Hạ vỏ / Cấp vỏ</p>
          <p className="text-sm font-black">{master.receiptCode}</p>
          {/* Mã QR thật — Văn phòng quét bằng camera / súng quét khi khách thanh toán TTT */}
          <QrImage value={master.qrCode} size={88} className="mx-auto my-1" />
          <p className="text-[11px]">Mã QR trừ dần: <span className="font-mono font-bold">{master.qrCode}</span>{master.lotDescription ? ` • ${master.lotDescription}` : ''}</p>
          <p className="mt-1 text-xs font-black">SỐ TIỀN NẠP TRƯỚC: <span className="text-sm">{formatVnd(r.amount)}</span></p>
        </div>
      )}
      <InfoGrid
        narrow
        rows={[
          ["Bên thanh toán", r.payerName],
          ...(isPrepaid ? [] : ([["Mã hồ sơ", r.dossierCode || r.masterReceiptCode, true], ["Số container", r.containerNo, true]] as [string, React.ReactNode, boolean][])),
          ['Hình thức', `${PAYMENT_METHOD_LABELS[r.method]}${r.providerTxRef ? ` • Mã GD ${r.providerTxRef}` : ''}`],
          ['Thời gian thu', formatDateTime(tx?.confirmedAt || r.issuedAt), true],
        ]}
      />
      {lines.length > 0 && (
        <table className="mt-3 w-full border-collapse text-left">
          <thead>
            <tr className="border-y border-line-strong">
              <th className="py-1">Nội dung (đã gồm VAT)</th>
              {(isPrepaid || hasQty) && <><th className="py-1 text-right">SL</th><th className="py-1 text-right">Đơn giá</th></>}
              <th className="py-1 text-right">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-b border-line">
                <td className="py-1">{l.name}</td>
                {(isPrepaid || hasQty) && <><td className="py-1 text-right font-mono">{l.quantity || 1}</td><td className="py-1 text-right font-mono">{formatVnd(l.unitAmountInclVat ?? l.amountInclVat)}</td></>}
                <td className="py-1 text-right font-mono">{formatVnd(l.amountInclVat)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-2 text-right text-sm font-black">{isPrepaid ? "TỔNG THU TRƯỚC: " : "TỔNG THU: "}<span className="font-mono">{formatVnd(r.amount)}</span></p>
      {/* DEC-111: mã bảo mật để khách yêu cầu xuất hóa đơn */}
      {r.invoiceSecret && (
        <div className="mt-3 border border-dashed border-slate-500 px-2 py-2 text-[11px]" data-testid="invoice-secret">
          {/* QR nhỏ góc phải = link trang yêu cầu xuất hóa đơn → khách quét mở nhanh, không phải gõ địa chỉ */}
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-bold uppercase">Yêu cầu xuất hóa đơn</p>
              <p>Truy cập: <span className="font-mono font-bold break-all">{invoicePortalUrl()}</span></p>
            </div>
            <div className="shrink-0 border-2 border-slate-900 bg-white p-0.5 text-center">
              <QrImage value={invoicePortalUrl()} size={60} />
              <p className="text-[8px] leading-tight">Quét để mở</p>
            </div>
          </div>
          <p>
            Mã bảo mật: <span className="font-mono text-sm font-black tracking-widest">{r.invoiceSecret}</span>
            <span className="block text-ink-muted">(phân biệt chữ hoa / thường — không chia sẻ cho người khác)</span>
          </p>
        </div>
      )}
      <Signatures left="Người nộp tiền" right="Người thu tiền" rightName={receiptCollectorName(state, r)} />
      {state.companyProfile.bankAccount && <p className="mt-3 text-center text-[10px] text-ink-muted">TK ngân hàng: {state.companyProfile.bankAccount}</p>}
      <PrintFooter note={printNo ? `lần in thứ ${printNo}` : undefined} />
    </K80Frame>
  );
};

// Khối TÌNH TRẠNG VỎ do Giám định ghi nhận (DEC-076) — EEIR Nhập tàu / Xuất tàu
const ConditionBox: React.FC<{
  condition?: string;
  stuffing?: string;
  damage?: string[];
  cleaning?: string[];
  age?: number | string;
  inspectedBy?: string;
  inspectedAt?: string;
}> = ({ condition, stuffing, damage, cleaning, age, inspectedBy, inspectedAt }) => (
  <div className="mt-2 border border-slate-800 p-1.5">
    <p className="mb-1 font-black uppercase">Tình trạng vỏ (Giám định)</p>
    <dl className="grid grid-cols-[80px_1fr] gap-x-2 gap-y-0.5">
      <dt className="text-ink-muted">Trạng thái</dt><dd className="font-black">{condition || '-'}</dd>
      <dt className="text-ink-muted">Đóng hàng</dt><dd className="font-semibold">{stuffing || '-'}</dd>
      <dt className="text-ink-muted">Hư hỏng</dt><dd className="font-semibold">{damage?.length ? damage.join(', ') : 'Không'}</dd>
      <dt className="text-ink-muted">Vệ sinh</dt><dd className="font-semibold">{(cleaning || []).join(' + ') || '-'}</dd>
      <dt className="text-ink-muted">AGE</dt><dd className="font-semibold">{age || '-'}</dd>
      <dt className="text-ink-muted">Giám định</dt><dd className="font-semibold">{inspectedBy || '-'} • {formatDateTime(inspectedAt)}</dd>
    </dl>
  </div>
);

// ---------------------------------------------------------------------------
// EEIR NHẬP TÀU / XUẤT TÀU (DEC-081, DEC-161): khổ K80; dữ liệu từ danh sách tàu + lượt lưu bãi
// ---------------------------------------------------------------------------
export const VesselEeirPrintSheet: React.FC<{ state: DepotState; list: VesselList; item: VesselListItem }> = ({ state, list, item }) => {
  const isImport = list.mode === 'NHAP_TAU';
  const container = state.containers.find((c) => c.id === item.containerId);
  const visit = container?.masterDossierCode;
  const loc = state.locationHistory.filter((l) => l.masterDossierCode === visit);
  const location = isImport
    ? [...loc].reverse().find((l) => l.actionType === 'INITIAL_BLOCK')?.toLocation
    : item.locationAtList || loc.find((l) => l.actionType === 'GATE_OUT_CLEAR')?.fromLocation;
  // Tình trạng vỏ: Nhập tàu = kết quả Giám định của lượt này; Xuất tàu = tình trạng hiện tại + Giám định lúc cont vào bãi
  const origin = visit ? state.gateInOrders.find((o) => o.masterDossierCode === visit) : undefined;
  const originVessel = visit?.startsWith('NT-')
    ? (state.vesselLists || []).flatMap((l) => l.items).find((i) => i.dossierCode === visit)
    : undefined;
  const cond = isImport
    ? { condition: item.conditionClass, stuffing: item.stuffingClass, damage: item.damageRemarks, cleaning: item.cleaningItems, age: item.manufactureYear, inspectedBy: item.inspectedBy, inspectedAt: item.inspectedAt }
    : {
        condition: container?.conditionClass,
        stuffing: container?.stuffingClass,
        damage: container?.damageRemarks,
        cleaning: container?.cleaningItems,
        age: container?.manufactureYear,
        inspectedBy: origin?.fieldStaffName || originVessel?.inspectedBy,
        inspectedAt: origin?.fieldRecordedAt || originVessel?.inspectedAt,
      };
  return (
    <K80Frame state={state} title="EEIR — PHIẾU GIAO NHẬN CONTAINER" number={item.dossierCode || '-'} operation={isImport ? 'NHẬP TÀU' : 'XUẤT TÀU'}>
      <InfoGrid
        narrow
        rows={[
          ['Số container', <span className="text-sm">{item.containerNo}</span>, true],
          ['Size / Type', `${item.size} / ${item.type}`],
          ['Hãng tàu', list.shippingLineCode || container?.shippingLineCode],
          ['Tên tàu', list.vesselName],
          [isImport ? 'Thời gian nhập tàu' : 'Thời gian xuất tàu', formatDateTime(list.plannedAt), true],
          ['Số xe', item.truckNo],
          [isImport ? 'Thời gian vào bãi' : 'Thời gian OUT', formatDateTime(isImport ? container?.gateInAt : item.doneAt), true],
          ...(isImport ? [] : ([['Date in (vào bãi)', formatDateTime(container?.gateInAt), true]] as [string, React.ReactNode, boolean][])),
          [isImport ? 'Vị trí hạ' : 'Vị trí lấy', location, true],
          ['Thanh toán', 'Không thu phí (tác nghiệp tàu)'],
        ]}
      />
      <ConditionBox {...cond} />
      <Signatures left="Lái xe" right={`Đại diện ${state.companyProfile.shortName || state.companyProfile.name}`} />
      <PrintFooter />
    </K80Frame>
  );
};

// ---------------------------------------------------------------------------
// LỚP IN: gắn thẳng vào <body> để không bị cắt bởi cửa sổ (modal) đang mở; chỉ hiện khi in
// ---------------------------------------------------------------------------
export const PrintPortal: React.FC<{ children: React.ReactNode }> = ({ children }) =>
  typeof document === 'undefined' ? null : createPortal(<div className="print-area print-job hidden space-y-4 print:block">{children}</div>, document.body);

// Nút IN PHIẾU THU: ghi nhận số lần in; từ lần 2 phải xác nhận "in lại" (DEC-063)
export const PrintReceiptButton: React.FC<{
  state: DepotState;
  receipt: PaymentReceipt;
  onUpdateState: (next: DepotState) => void;
  onError?: (msg: string) => void;
}> = ({ state, receipt, onUpdateState, onError }) => {
  const [confirmReprint, setConfirmReprint] = React.useState(false);
  const printed = receipt.printLog?.length || 0;
  const doPrint = () => {
    try {
      onUpdateState(recordReceiptPrint(state, { receiptNo: receipt.receiptNo }));
      setConfirmReprint(false);
      setTimeout(printNow, 100);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Không in được phiếu thu');
    }
  };
  if (confirmReprint) {
    const last = receipt.printLog![receipt.printLog!.length - 1];
    return (
      <span className="inline-flex flex-wrap items-center gap-2 rounded-md border border-rose-300 bg-rose-50 px-2 py-1 text-[11px] text-rose-800">
        Đã in {printed} lần (gần nhất {formatDateTime(last.at)} • {last.by}). In lại?
        <button type="button" onClick={doPrint} className="rounded bg-rose-600 px-2 py-1 font-bold text-white">In lại lần {printed + 1}</button>
        <button type="button" onClick={() => setConfirmReprint(false)} className="rounded border border-line-strong bg-white px-2 py-1">Hủy</button>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={() => (printed > 0 ? setConfirmReprint(true) : doPrint())} className={secondaryBtn}>
        <Printer className="h-3.5 w-3.5" />
        {printed > 0 ? 'In lại' : 'In phiếu thu'}
      </button>
      <span className={`text-[11px] font-semibold ${printed > 0 ? 'text-rose-700' : 'text-ink-muted'}`}>Đã in: {printed} lần</span>
    </span>
  );
};

// ---------------------------------------------------------------------------
// XEM PHIẾU (DEC-161): bấm "Xem phiếu" → cửa sổ hiện phiếu đúng khổ K80 → nút In ở trong cửa sổ.
// Bản in đi qua PrintPortal (children in) — phiếu trên màn hình chỉ để xem.
// ---------------------------------------------------------------------------
export const PrintPreviewModal: React.FC<{ title: string; onClose: () => void; actions: React.ReactNode; children: React.ReactNode; print?: React.ReactNode }> = ({
  title,
  onClose,
  actions,
  children,
  print,
}) => {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-navy-900/60 p-4" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="my-4 w-full max-w-[760px] rounded-2xl bg-white p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="no-print mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-sm font-bold text-ink">{title}</h2>
          {actions}
          <button type="button" onClick={onClose} aria-label="Đóng" className={secondaryBtn}><X className="h-3.5 w-3.5" /></button>
        </div>
        <div className="flex flex-wrap items-start justify-center gap-4 rounded-xl bg-canvas p-4">{children}</div>
        {print && <PrintPortal>{print}</PrintPortal>}
      </div>
    </div>
  );
};

// Nút XEM PHIẾU THU (K80) → cửa sổ xem, trong đó có nút In / In lại (DEC-063 đếm số lần in)
export const ReceiptViewButton: React.FC<{
  state: DepotState;
  receipt: PaymentReceipt;
  onUpdateState: (next: DepotState) => void;
  onError?: (msg: string) => void;
}> = ({ state, receipt, onUpdateState, onError }) => {
  const [open, setOpen] = React.useState(false);
  const close = React.useCallback(() => setOpen(false), []);
  const printed = receipt.printLog?.length || 0;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={secondaryBtn}>
        <Eye className="h-3.5 w-3.5" />
        PHIẾU THU
      </button>
      {open && (
        <PrintPreviewModal
          title={`Phiếu thu (K80) — ${receipt.receiptNo}`}
          onClose={close}
          actions={<PrintReceiptButton state={state} receipt={receipt} onUpdateState={onUpdateState} onError={onError} />}
          print={<ReceiptPrintSheet state={state} receipt={receipt} printNo={printed || 1} />}
        >
          <ReceiptPrintSheet state={state} receipt={receipt} printNo={printed + 1} />
        </PrintPreviewModal>
      )}
    </>
  );
};
