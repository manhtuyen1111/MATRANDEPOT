import React from 'react';
import { Printer } from 'lucide-react';
import { CompanyProfile, PAYMENT_METHOD_LABELS, PaymentReceipt, RECEIPT_OPERATION_LABELS } from '../types/depot';
import { DepotState, formatVnd } from '../services/depotStore';
import { receiptOperationOf } from '../services/payments';
import { recordReceiptPrint } from '../services/depotOperations';
import { formatDateTime } from '../services/datetime';
import { secondaryBtn } from './shared';

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

// MẪU IN PHIẾU THU THỐNG NHẤT (DEC-062, DEC-063) — dùng ở Văn phòng → Phiếu thu và Trả chứng từ
export const ReceiptPrintSheet: React.FC<{ state: DepotState; receipt: PaymentReceipt; printNo?: number }> = ({ state, receipt: r, printNo }) => {
  const company = state.companyProfile;
  const op = RECEIPT_OPERATION_LABELS[receiptOperationOf(state, r)];
  const tx = state.paymentTransactions.find((t) => t.id === r.transactionId);
  const voucher = r.voucherId ? state.vouchers.find((v) => v.id === r.voucherId) : undefined;
  return (
    <section className="relative border-2 border-slate-800 bg-white p-4 text-xs text-slate-900">
      {printNo && printNo > 1 && (
        <span className="absolute right-3 top-3 rounded border-2 border-rose-600 px-2 py-0.5 text-[11px] font-black text-rose-600">BẢN IN LẠI — LẦN {printNo}</span>
      )}
      <CompanyHeader
        company={company}
        title="PHIẾU THU"
        subtitle={
          <>
            <p className="font-mono text-sm font-bold">Số: {r.receiptNo}</p>
            <p className="mt-1 inline-block bg-slate-900 px-2 py-0.5 text-xs font-black text-white">TÁC NGHIỆP: {op}</p>
          </>
        }
      />
      <dl className="mt-3 grid grid-cols-[140px_1fr] gap-x-3 gap-y-1">
        <dt className="text-slate-600">Bên thanh toán</dt><dd className="font-semibold">{r.payerName}</dd>
        <dt className="text-slate-600">Mã hồ sơ</dt><dd className="font-mono">{r.dossierCode || r.masterReceiptCode || '-'}</dd>
        <dt className="text-slate-600">Số container</dt><dd className="font-mono font-bold">{r.containerNo || '-'}</dd>
        <dt className="text-slate-600">Chứng từ</dt><dd className="font-mono">{r.voucherNo || '-'}</dd>
        <dt className="text-slate-600">Hình thức</dt><dd>{PAYMENT_METHOD_LABELS[r.method]}{r.providerTxRef ? ` • Mã GD ${r.providerTxRef}` : ''}</dd>
        <dt className="text-slate-600">Thời gian thu</dt><dd className="font-mono">{formatDateTime(tx?.confirmedAt || r.issuedAt)}</dd>
      </dl>
      {voucher?.feeLines && voucher.feeLines.length > 0 && (
        <table className="mt-3 w-full border-collapse text-left">
          <thead>
            <tr className="border-y border-slate-400"><th className="py-1">Nội dung (đã gồm VAT)</th><th className="py-1 text-right">Thành tiền</th></tr>
          </thead>
          <tbody>
            {voucher.feeLines.map((l) => (
              <tr key={l.id} className="border-b border-slate-200"><td className="py-1">{l.name}</td><td className="py-1 text-right font-mono">{formatVnd(l.amountInclVat)}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="mt-2 text-right text-sm font-black">TỔNG THU: <span className="font-mono">{formatVnd(r.amount)}</span></p>
      <div className="mt-5 grid grid-cols-2 text-center">
        <span>Người nộp tiền<br /><br /><br />(Ký, ghi rõ họ tên)</span>
        <span>Người thu tiền<br /><br /><br />{r.issuedBy}</span>
      </div>
      {company.bankAccount && <p className="mt-3 text-center text-[10px] text-slate-600">TK ngân hàng: {company.bankAccount}</p>}
      <p className="mt-1 text-center text-[10px] text-slate-500">
        In lúc {formatDateTime(new Date())}{printNo ? ` • lần in thứ ${printNo}` : ''}
      </p>
    </section>
  );
};

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
