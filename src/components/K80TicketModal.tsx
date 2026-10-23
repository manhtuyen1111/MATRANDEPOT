import React from 'react';
import { Check, Copy, Printer, QrCode, X } from 'lucide-react';
import { K80InternalTicket } from '../types/depot';
import type { DepotState } from '../services/depotStore';
import { getDriverRoute } from '../services/driverRoute';

interface Props {
  ticket: K80InternalTicket | null;
  state?: DepotState; // có state → hiển thị tiến độ từng bước (✓ đã xong)
  onClose: () => void;
  onSimulateScanQr?: (qrCode: string) => void;
}

const Row: React.FC<{ label: string; value?: React.ReactNode; big?: boolean }> = ({ label, value, big }) => (
  <div className="flex items-baseline justify-between gap-2 border-b border-dotted border-slate-400 py-0.5">
    <span className="shrink-0 font-bold">{label}</span>
    <span className={`text-right ${big ? 'text-sm font-black tracking-wide' : 'font-semibold'}`}>{value || '-'}</span>
  </div>
);

// PHIẾU TÁC NGHIỆP NỘI BỘ K80 (DEC-023, DEC-052): thông tin chung ở đầu → LỘ TRÌNH các bước → mã QR
export const K80TicketModal: React.FC<Props> = ({ ticket, state, onClose, onSimulateScanQr }) => {
  const [copied, setCopied] = React.useState(false);
  if (!ticket) return null;

  const isOut = ticket.operationMode === 'CAP_VO';
  type Step = { key: string; dept: string; action: string; done: boolean; doneAt?: string };
  const steps: Step[] = state
    ? getDriverRoute(state, ticket)
    : [
        { key: 'OFFICE_PAY', dept: 'VĂN PHÒNG', action: 'Thu phí & in phiếu', done: true },
        ...(!isOut && ticket.cleaningItems.some((i) => i !== 'KHÔNG VỆ SINH')
          ? [{ key: 'CLEANING', dept: 'VỆ SINH', action: `Quét mã • ${ticket.cleaningItems.join(' + ')}`, done: false }]
          : []),
        { key: 'FORKLIFT', dept: 'XE NÂNG', action: isOut ? 'Quét mã • nhận vỏ' : 'Quét mã • hạ vỏ', done: false },
        { key: 'OFFICE_RETURN', dept: 'VĂN PHÒNG', action: 'Quét mã • nhận EEIR / phiếu thu', done: false },
      ];
  const nextStep = steps.find((s) => !s.done);

  const handleCopy = () => {
    navigator.clipboard?.writeText(ticket.qrCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-900/60 p-4" role="dialog" aria-modal="true" aria-label="Phiếu K80">
      <div className="relative my-auto w-full max-w-[350px] rounded-2xl border border-slate-300 bg-white p-4 shadow-2xl">
        <button type="button" onClick={onClose} aria-label="Đóng" className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
          <X className="h-5 w-5" />
        </button>

        {/* KHỔ GIẤY IN NHIỆT K80 (80mm) */}
        <div className="mx-auto border-2 border-dashed border-slate-800 bg-white p-3 font-mono text-[11px] leading-snug text-slate-900">
          {/* 1. THÔNG TIN CHUNG */}
          <div className="border-b-2 border-slate-800 pb-2 text-center">
            <p className="text-xs font-black tracking-wider">MATRAN DEPOT — PHIẾU TÁC NGHIỆP</p>
            <p className="mt-1 inline-block bg-slate-900 px-2 py-0.5 text-sm font-black text-white">{isOut ? 'CẤP VỎ' : 'HẠ VỎ'}</p>
            <p className="mt-1 text-[10px]">Mã hồ sơ: <strong>{ticket.outDossierCode || ticket.masterDossierCode}</strong></p>
          </div>
          <div className="py-2">
            <Row label="SỐ CONT" value={ticket.containerNo} big />
            <Row label="SIZE / TYPE" value={`${ticket.size} / ${ticket.type}${ticket.manufactureYear ? ` • AGE ${ticket.manufactureYear}` : ''}`} />
            <Row label="SỐ XE" value={ticket.truckNo} big />
            <Row label="SĐT LÁI XE" value={ticket.driverPhone} />
            <Row label="TRẠNG THÁI" value={`${ticket.conditionClass} • Đóng hàng ${ticket.stuffingClass}`} />
            {ticket.damageRemarks && ticket.damageRemarks.length > 0 && <Row label="HƯ HỎNG" value={ticket.damageRemarks.join(', ')} />}
            <Row label="VỆ SINH" value={ticket.cleaningItems.join(' + ')} />
            <Row label="THANH TOÁN" value={`${ticket.isPaid ? '✓' : '✗'} ${ticket.paymentLabel}`} />
          </div>

          {/* 2. LỘ TRÌNH — đến bộ phận nào thì quét mã, tích ☐ bằng bút */}
          <div className="border-y-2 border-slate-800 py-2">
            <p className="mb-1.5 text-center text-xs font-black tracking-wider">LỘ TRÌNH — QUÉT MÃ TẠI TỪNG BỘ PHẬN</p>
            <ol className="space-y-1.5">
              {steps.map((s, i) => (
                <li
                  key={s.key}
                  className={`flex items-start gap-2 ${state && nextStep?.key === s.key ? 'rounded bg-amber-100 px-1' : ''}`}
                >
                  <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center border-2 border-slate-900 text-xs font-black">
                    {state && s.done ? '✓' : ''}
                  </span>
                  <span className="flex-1">
                    <span className="font-black">{i + 1}. {s.dept}</span>
                    <span className="block text-[10px]">{s.action}</span>
                  </span>
                  {state && s.done && s.doneAt && (
                    <span className="shrink-0 text-[9px] text-slate-600">
                      {new Date(s.doneAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </div>

          {/* 3. MÃ QR TÁC NGHIỆP */}
          <div className="pt-2 text-center">
            <div className="mx-auto flex h-28 w-28 flex-col items-center justify-center border-2 border-slate-900 bg-white p-1.5">
              <QrCode className="h-16 w-16 text-slate-900" />
              <span className="mt-1 text-[9px] font-black tracking-tighter">{ticket.qrCode}</span>
            </div>
            <p className="mt-1 text-[9px] text-slate-600">
              In lúc {new Date(ticket.issuedAt).toLocaleString('vi-VN')} • {ticket.issuedBy}
            </p>
          </div>
        </div>

        {state && nextStep && (
          <p className="mt-3 rounded-md bg-amber-50 px-3 py-1.5 text-center text-xs font-semibold text-amber-900">
            Bước tiếp theo: {nextStep.dept} — {nextStep.action}
          </p>
        )}

        <div className="mt-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => window.print()} className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-bold text-white hover:bg-slate-800">
              <Printer className="h-4 w-4" />
              In phiếu K80
            </button>
            <button type="button" onClick={handleCopy} className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-100">
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              {copied ? 'Đã chép QR' : 'Copy mã QR'}
            </button>
          </div>
          {onSimulateScanQr && (
            <button
              type="button"
              onClick={() => {
                onSimulateScanQr(ticket.qrCode);
                onClose();
              }}
              className="w-full rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700"
            >
              Chuyển sang Xe nâng & quét thử mã QR này
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
