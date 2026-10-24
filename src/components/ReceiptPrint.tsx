import React from 'react';
import { createPortal } from 'react-dom';
import { Printer } from 'lucide-react';
import { CompanyProfile, K80InternalTicket, PAYMENT_METHOD_LABELS, PaymentReceipt, RECEIPT_OPERATION_LABELS, VesselList, VesselListItem } from '../types/depot';
import { DepotState, formatVnd } from '../services/depotStore';
import { receiptOperationOf } from '../services/payments';
import { recordReceiptPrint } from '../services/depotOperations';
import { formatDateTime } from '../services/datetime';
import { ticketContext } from '../services/driverRoute';
import { secondaryBtn } from './shared';

// ============================================================================
// GIẤY TỜ IN DÙNG CHUNG (DEC-062, DEC-063, DEC-072)
//   Mọi giấy tờ cùng 1 khung: đầu CÔNG TY → TIÊU ĐỀ + Số → TÁC NGHIỆP → thông tin → bảng → chữ ký → "In lúc".
//   EEIR và PHIẾU THU in cùng kích thước, cùng kiểu chữ để gửi khách hàng thành một bộ.
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

// Khung giấy tờ: tiêu đề, số, tác nghiệp, nhãn in lại
const PrintFrame: React.FC<{ state: DepotState; title: string; number: string; operation: string; reprintNo?: number; children: React.ReactNode }> = ({
  state,
  title,
  number,
  operation,
  reprintNo,
  children,
}) => (
  <section className="print-sheet relative break-inside-avoid border-2 border-slate-800 bg-white p-4 text-xs text-slate-900">
    {reprintNo && reprintNo > 1 && (
      <span className="absolute right-3 top-3 rounded border-2 border-rose-600 px-2 py-0.5 text-[11px] font-black text-rose-600">BẢN IN LẠI — LẦN {reprintNo}</span>
    )}
    <CompanyHeader
      company={state.companyProfile}
      title={title}
      subtitle={
        <>
          <p className="font-mono text-sm font-bold">Số: {number}</p>
          <p className="mt-1 inline-block bg-slate-900 px-2 py-0.5 text-xs font-black text-white">TÁC NGHIỆP: {operation}</p>
        </>
      }
    />
    {children}
  </section>
);

const InfoGrid: React.FC<{ rows: [string, React.ReactNode, boolean?][] }> = ({ rows }) => (
  <dl className="mt-3 grid grid-cols-[140px_1fr] gap-x-3 gap-y-1">
    {rows.map(([label, value, mono]) => (
      <React.Fragment key={label}>
        <dt className="text-slate-600">{label}</dt>
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
  <p className="mt-2 text-center text-[10px] text-slate-500">In lúc {formatDateTime(new Date())}{note ? ` • ${note}` : ''}</p>
);

// ---------------------------------------------------------------------------
// PHIẾU THU — mẫu duy nhất (DEC-062, DEC-063): Văn phòng → Phiếu thu, Trả chứng từ, Hồ sơ container
// ---------------------------------------------------------------------------
export const ReceiptPrintSheet: React.FC<{ state: DepotState; receipt: PaymentReceipt; printNo?: number }> = ({ state, receipt: r, printNo }) => {
  const opKey = receiptOperationOf(state, r);
  const op = RECEIPT_OPERATION_LABELS[opKey];
  const tx = state.paymentTransactions.find((t) => t.id === r.transactionId);
  const voucher = r.voucherId ? state.vouchers.find((v) => v.id === r.voucherId) : undefined;
  // DEC-077: PHIẾU THU TRƯỚC — cùng khung, khác tên, có khung nổi bật Phiếu thu mẹ PTT-
  const master = r.purpose === "PREPAID_TOPUP" ? state.masterReceipts.find((m) => m.id === r.masterReceiptId || m.receiptCode === r.masterReceiptCode) : undefined;
  const isPrepaid = opKey === "THU_TRUOC" || Boolean(master);
  const lines = master?.feeLines?.length ? master.feeLines : voucher?.feeLines || [];
  const hasQty = lines.some((l) => (l.quantity || 1) > 1);
  return (
    <PrintFrame state={state} title={isPrepaid ? "PHIẾU THU TRƯỚC (TTT)" : "PHIẾU THU"} number={r.receiptNo} operation={op} reprintNo={printNo}>
      {isPrepaid && master && (
        <div className="mt-2 border-4 border-double border-slate-900 px-3 py-2 text-center">
          <p className="text-[10px] font-bold uppercase tracking-wider">Phiếu thu mẹ — dùng trừ dần cho Hạ vỏ / Cấp vỏ</p>
          <p className="font-mono text-lg font-black">{master.receiptCode}</p>
          <p className="text-[11px]">Mã QR trừ dần: <span className="font-mono font-bold">{master.qrCode}</span>{master.lotDescription ? ` • ${master.lotDescription}` : ''}</p>
          <p className="mt-1 text-sm font-black">SỐ TIỀN NẠP TRƯỚC: <span className="font-mono text-base">{formatVnd(r.amount)}</span></p>
        </div>
      )}
      <InfoGrid
        rows={[
          ["Bên thanh toán", r.payerName],
          ...(isPrepaid ? [] : ([["Mã hồ sơ", r.dossierCode || r.masterReceiptCode, true], ["Số container", r.containerNo, true], ["Chứng từ", r.voucherNo, true]] as [string, React.ReactNode, boolean][])),
          ['Hình thức', `${PAYMENT_METHOD_LABELS[r.method]}${r.providerTxRef ? ` • Mã GD ${r.providerTxRef}` : ''}`],
          ['Thời gian thu', formatDateTime(tx?.confirmedAt || r.issuedAt), true],
        ]}
      />
      {lines.length > 0 && (
        <table className="mt-3 w-full border-collapse text-left">
          <thead>
            <tr className="border-y border-slate-400">
              <th className="py-1">Nội dung (đã gồm VAT)</th>
              {(isPrepaid || hasQty) && <><th className="py-1 text-right">SL</th><th className="py-1 text-right">Đơn giá</th></>}
              <th className="py-1 text-right">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-b border-slate-200">
                <td className="py-1">{l.name}</td>
                {(isPrepaid || hasQty) && <><td className="py-1 text-right font-mono">{l.quantity || 1}</td><td className="py-1 text-right font-mono">{formatVnd(l.unitAmountInclVat ?? l.amountInclVat)}</td></>}
                <td className="py-1 text-right font-mono">{formatVnd(l.amountInclVat)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-2 text-right text-sm font-black">{isPrepaid ? "TỔNG THU TRƯỚC: " : "TỔNG THU: "}<span className="font-mono">{formatVnd(r.amount)}</span></p>
      <Signatures left="Người nộp tiền" right="Người thu tiền" rightName={r.issuedBy} />
      {state.companyProfile.bankAccount && <p className="mt-3 text-center text-[10px] text-slate-600">TK ngân hàng: {state.companyProfile.bankAccount}</p>}
      <PrintFooter note={printNo ? `lần in thứ ${printNo}` : undefined} />
    </PrintFrame>
  );
};

// ---------------------------------------------------------------------------
// EEIR — PHIẾU GIAO NHẬN CONTAINER (DEC-072): thông tin Hạ vỏ / Cấp vỏ chi tiết gửi khách hàng kèm phiếu thu
// ---------------------------------------------------------------------------
export const EeirPrintSheet: React.FC<{ state: DepotState; ticket: K80InternalTicket }> = ({ state, ticket: t }) => {
  const { gateIn, gateOut } = ticketContext(state, t);
  const isOut = t.operationMode === 'CAP_VO';
  const dossierCode = isOut ? t.outDossierCode || t.masterDossierCode : t.masterDossierCode;
  const container = state.containers.find((c) => c.masterDossierCode === t.masterDossierCode);
  const loc = state.locationHistory.filter((l) => l.masterDossierCode === t.masterDossierCode);
  const location = isOut
    ? loc.find((l) => l.actionType === 'GATE_OUT_CLEAR')?.fromLocation
    : [...loc].reverse().find((l) => l.actionType === 'INITIAL_BLOCK')?.toLocation;
  return (
    <PrintFrame state={state} title="EEIR — PHIẾU GIAO NHẬN CONTAINER" number={dossierCode} operation={isOut ? 'CẤP VỎ' : 'HẠ VỎ'}>
      <InfoGrid
        rows={[
          ['Số container', <span className="text-sm">{t.containerNo}</span>, true],
          ['Size / Type', `${t.size} / ${t.type}`],
          ['Hãng tàu', container?.shippingLineCode || gateIn?.shippingLineCode],
          ['Khách hàng', isOut ? gateOut?.receiverRep : t.customerRep],
          ...(isOut ? ([['Booking', gateOut?.bookingNo, true]] as [string, React.ReactNode, boolean][]) : ([['Số lệnh / chứng từ', gateIn?.orderDocNo, true]] as [string, React.ReactNode, boolean][])),
          ['Số xe • SĐT lái xe', `${t.truckNo || '-'} • ${t.driverPhone || '-'}`],
          [isOut ? 'Thời gian OUT' : 'Thời gian GATE IN', formatDateTime(isOut ? gateOut?.confirmedAt : gateIn?.gateInOkAt), true],
          [isOut ? 'Vị trí lấy' : 'Vị trí hạ', location, true],
          ['Thanh toán', t.paymentLabel],
        ]}
      />
      {/* TÌNH TRẠNG VỎ do Giám định ghi nhận (DEC-076) — không in các bộ phận */}
      <ConditionBox
        condition={t.conditionClass}
        stuffing={t.stuffingClass}
        damage={t.damageRemarks}
        cleaning={t.cleaningItems}
        age={t.manufactureYear}
        inspectedBy={gateIn?.fieldStaffName}
        inspectedAt={gateIn?.fieldRecordedAt}
      />
      <Signatures left="Lái xe / Khách hàng" right={`Đại diện ${state.companyProfile.shortName || state.companyProfile.name}`} />
      <PrintFooter />
    </PrintFrame>
  );
};

// Khối TÌNH TRẠNG VỎ do Giám định ghi nhận (DEC-076) — dùng chung mọi EEIR
const ConditionBox: React.FC<{
  condition?: string;
  stuffing?: string;
  damage?: string[];
  cleaning?: string[];
  age?: number | string;
  inspectedBy?: string;
  inspectedAt?: string;
}> = ({ condition, stuffing, damage, cleaning, age, inspectedBy, inspectedAt }) => (
  <div className="mt-2 border border-slate-400 p-2">
    <p className="mb-1 font-black uppercase">Tình trạng vỏ (Giám định)</p>
    <dl className="grid grid-cols-[110px_1fr_70px_1fr] gap-x-2 gap-y-0.5">
      <dt className="text-slate-600">Trạng thái</dt><dd className="font-black">{condition || '-'}</dd>
      <dt className="text-slate-600">Đóng hàng</dt><dd className="font-semibold">{stuffing || '-'}</dd>
      <dt className="text-slate-600">Hư hỏng</dt><dd className="col-span-3 font-semibold">{damage?.length ? damage.join(', ') : 'Không'}</dd>
      <dt className="text-slate-600">Vệ sinh</dt><dd className="font-semibold">{(cleaning || []).join(' + ') || '-'}</dd>
      <dt className="text-slate-600">AGE</dt><dd className="font-semibold">{age || '-'}</dd>
      <dt className="text-slate-600">Giám định</dt><dd className="col-span-3 font-semibold">{inspectedBy || '-'} • {formatDateTime(inspectedAt)}</dd>
    </dl>
  </div>
);

// ---------------------------------------------------------------------------
// EEIR NHẬP TÀU / XUẤT TÀU (DEC-081): cùng khung EEIR Hạ vỏ / Cấp vỏ; dữ liệu từ danh sách tàu + lượt lưu bãi
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
    <PrintFrame state={state} title="EEIR — PHIẾU GIAO NHẬN CONTAINER" number={item.dossierCode || '-'} operation={isImport ? 'NHẬP TÀU' : 'XUẤT TÀU'}>
      <InfoGrid
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
    </PrintFrame>
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
      setTimeout(() => window.print(), 100);
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
        <button type="button" onClick={() => setConfirmReprint(false)} className="rounded border border-slate-300 bg-white px-2 py-1">Hủy</button>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      <button type="button" onClick={() => (printed > 0 ? setConfirmReprint(true) : doPrint())} className={secondaryBtn}>
        <Printer className="h-3.5 w-3.5" />
        {printed > 0 ? 'In lại' : 'In phiếu thu'}
      </button>
      <span className={`text-[11px] font-semibold ${printed > 0 ? 'text-rose-700' : 'text-slate-500'}`}>Đã in: {printed} lần</span>
    </span>
  );
};
