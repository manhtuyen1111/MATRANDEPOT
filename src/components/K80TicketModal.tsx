import React from 'react';
import { Check, Copy, Printer, QrCode, X } from 'lucide-react';
import { K80InternalTicket } from '../types/depot';

interface Props {
  ticket: K80InternalTicket | null;
  onClose: () => void;
  onSimulateScanQr?: (qrCode: string) => void;
}

export const K80TicketModal: React.FC<Props> = ({
  ticket,
  onClose,
  onSimulateScanQr,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!ticket) return null;

  const handleCopy = () => {
    navigator.clipboard?.writeText(ticket.qrCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="relative w-full max-w-[350px] rounded-2xl bg-white p-5 shadow-2xl border border-slate-300">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
        >
          <X className="h-5 w-5" />
        </button>

        {/* KHUNG GIẤY IN NHIỆT K80 (80mm) */}
        <div className="mx-auto rounded-lg border-2 border-dashed border-slate-800 bg-amber-50/20 p-4 font-mono text-xs text-slate-900">
          <div className="border-b-2 border-dashed border-slate-800 pb-2.5 text-center">
            <p className="text-sm font-black tracking-wider">
              MATRANDEPOT - TÁC NGHIỆP NỘI BỘ
            </p>
            <p className="mt-0.5 text-[10px] text-slate-600">
              Phiếu khổ K80 • Mã phiếu: {ticket.ticketCode} (
              {ticket.operationMode === 'HA_VO' ? 'HẠ VỎ' : 'CẤP VỎ'})
            </p>
            <p className="mt-1 rounded bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-white inline-block">
              MÃ HỒ SƠ CHÍNH: {ticket.masterDossierCode}
            </p>
          </div>

          <div className="space-y-2 py-3 text-[11px] leading-relaxed">
            <div className="flex items-center justify-between border-b border-dotted border-slate-400 pb-1.5">
              <span className="font-bold">TRẠNG THÁI THANH TOÁN :</span>
              <span
                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-sm font-black ${
                  ticket.isPaid
                    ? 'bg-emerald-600 text-white'
                    : 'bg-rose-600 text-white'
                }`}
              >
                {ticket.isPaid ? '✓ (ĐÃ TT)' : '✗ (CHƯA TT)'}
              </span>
            </div>

            <div className="border-b border-dotted border-slate-400 pb-1.5">
              <div>
                <span className="font-bold">SỐ CONTAINER : </span>
                <span className="text-sm font-black tracking-wide">
                  {ticket.containerNo}
                </span>
              </div>
              <div className="mt-1 flex justify-between">
                <span>
                  <strong>SIZE :</strong> {ticket.size}&apos;
                </span>
                <span>
                  <strong>TYPE :</strong> {ticket.type}
                </span>
                {ticket.manufactureYear && (
                  <span>
                    <strong>AGE :</strong> {ticket.manufactureYear}
                  </span>
                )}
              </div>
            </div>

            <div className="flex justify-between border-b border-dotted border-slate-400 pb-1.5">
              <span className="font-bold">TRẠNG THÁI :</span>
              <span
                className={`font-black ${
                  ticket.conditionClass === 'DAMAGE'
                    ? 'text-rose-700'
                    : 'text-emerald-700'
                }`}
              >
                {ticket.conditionClass}
              </span>
            </div>

            {ticket.damageRemarks && ticket.damageRemarks.length > 0 && (
              <div className="border-b border-dotted border-slate-400 pb-1.5 text-[10px]">
                <span className="font-bold">REMARK HƯ HỎNG : </span>
                <span>{ticket.damageRemarks.join(', ')}</span>
              </div>
            )}

            <div className="flex justify-between border-b border-dotted border-slate-400 pb-1.5">
              <span className="font-bold">PHÂN LOẠI ĐÓNG HÀNG :</span>
              <span className="font-black">{ticket.stuffingClass}</span>
            </div>

            <div className="border-b border-dotted border-slate-400 pb-1.5">
              <span className="font-bold">TÌNH TRẠNG VỆ SINH :</span>
              <div className="mt-0.5 font-black text-slate-900">
                {ticket.cleaningItems.join(' + ')}
              </div>
            </div>

            {ticket.truckNo && (
              <div className="flex justify-between text-[10px] text-slate-600">
                <span>SỐ XE: {ticket.truckNo}</span>
                <span>{new Date(ticket.issuedAt).toLocaleTimeString('vi-VN')}</span>
              </div>
            )}
          </div>

          {/* MÃ QR TÁC NGHIỆP IN TRÊN PHIẾU K80 */}
          <div className="border-t-2 border-dashed border-slate-800 pt-3 text-center">
            <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider">
              MÃ QR TÁC NGHIỆP (QUÉT TẠI BỘ PHẬN)
            </p>
            <div className="mx-auto flex h-32 w-32 flex-col items-center justify-center rounded-xl border-2 border-slate-900 bg-white p-2 shadow-xs">
              <QrCode className="h-20 w-20 text-slate-900" />
              <span className="mt-1 text-[9px] font-black tracking-tighter text-slate-800">
                {ticket.qrCode}
              </span>
            </div>
          </div>
        </div>

        {/* NÚT THAO TÁC IN K80 & COPY MÃ QR */}
        <div className="mt-4 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
            >
              <Printer className="h-4 w-4" />
              In Phiếu K80
            </button>

            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-slate-50 px-3 py-2.5 text-xs font-bold text-slate-800 hover:bg-slate-100"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4 text-emerald-600" />
                  Đã chép QR
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  Copy Mã QR
                </>
              )}
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
              Chuyển sang Bộ phận Xe nâng & Quét thử Mã QR này ngay
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
