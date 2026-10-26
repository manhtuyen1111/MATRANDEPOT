import React from 'react';
import type { ContainerPaymentInfo } from '../services/payments';
import { linkCls } from './shared';

// DEC-099, DEC-126: 2 ô THANH TOÁN | MÃ PHIẾU THU dùng chung — Tồn vỏ, Báo cáo Hạ vỏ, Báo cáo Cấp vỏ
export const PAYMENT_TONE: Record<string, string> = { TTTT: 'text-emerald-700', TTT: 'text-blue-700', TTS: 'text-violet-700' };

export const PaymentInfoCells: React.FC<{
  info: ContainerPaymentInfo;
  onOpenReceipt?: (key: string) => void;
  cellCls?: string; // khoảng đệm theo bảng đang dùng
}> = ({ info, onOpenReceipt, cellCls = 'px-2 py-2.5' }) => (
  <>
    <td className={`whitespace-nowrap ${cellCls} text-[11px] font-bold ${(info.category && PAYMENT_TONE[info.category]) || 'text-slate-400'}`}>{info.label}</td>
    <td className={`whitespace-nowrap ${cellCls} font-mono text-blue-700`}>
      {info.receipt && info.receiptTarget && onOpenReceipt ? (
        <button type="button" onClick={(e) => { e.stopPropagation(); onOpenReceipt(info.receiptTarget!); }} className={linkCls} title="Mở phiếu thu">
          {info.receipt}
        </button>
      ) : (
        info.receipt
      )}
    </td>
  </>
);
