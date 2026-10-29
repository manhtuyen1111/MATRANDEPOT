import React, { useEffect, useState } from 'react';
import { CameraScanButton } from '../../components/Qr';
import { confirmDocumentsReturn, recordReceiptPrint } from '../../services/api';
import { Eye, FileCheck2, Printer, QrCode, Repeat, X } from 'lucide-react';
import { DepotState } from '../../services/depotStore';

import { DocumentPack, previewDocumentPack, ticketsAwaitingReturn } from '../../services/driverRoute';
import { linkCls, ContainerNo, Feedback, inputCls, primaryBtn, secondaryBtn, SectionCard } from '../../components/shared';
import { PrintPortal } from '../../components/ReceiptPrint';
import { CustomerSlipK80, slipPrintCount } from '../../components/K80TicketModal';
import { printNow } from '../../components/printNow';
import { canSwapGateOut } from '../../services/depotOperations';
import { SwapContainerModal } from './SwapContainerModal';

type Mode = 'HA_VO' | 'CAP_VO';
const MODE_LABEL: Record<Mode, string> = { HA_VO: 'HẠ VỎ', CAP_VO: 'CẤP VỎ' };

// VĂN PHÒNG — TRẢ CHỨNG TỪ (DEC-052, DEC-064): 1 ô quét chung; danh sách chờ chia 2 cột HẠ VỎ / CẤP VỎ
export const DocumentReturnWorkspace: React.FC<{
  state: DepotState;
  onUpdateState: (next: DepotState) => void;
  onOpenDossier?: (code: string) => void;
}> = ({ state, onUpdateState, onOpenDossier }) => {
  const [code, setCode] = useState('');
  const [pack, setPack] = useState<DocumentPack | null>(null);
  const [preview, setPreview] = useState<DocumentPack | null>(null); // DEC-110: xem trước, không in
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [swapOrderId, setSwapOrderId] = useState<string | null>(null); // DEC-185
  const allWaiting = ticketsAwaitingReturn(state);

  const confirm = (raw: string) => {
    setError(null);
    try {
      const res = confirmDocumentsReturn(state, { scannedQrCode: raw });
      // In tự động bộ chứng từ = 1 lần in của mỗi phiếu thu kèm theo (DEC-063)
      let next = res.state;
      for (const r of res.pack.receipts) next = recordReceiptPrint(next, { receiptNo: r.receiptNo });
      onUpdateState(next);
      setPack({ ...res.pack, receipts: next.paymentReceipts.filter((r) => res.pack.receipts.some((x) => x.id === r.id)) });
      setCode('');
    } catch (err) {
      setPack(null);
      setError(err instanceof Error ? err.message : 'Lỗi trả chứng từ');
    }
  };

  const showPreview = (raw: string) => {
    setError(null);
    try {
      setPreview(previewDocumentPack(state, { scannedQrCode: raw }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi xem chứng từ');
    }
  };

  return (
    <div className="space-y-4">
      <Feedback error={error} success={success} onClose={() => { setError(null); setSuccess(null); }} />
      <SectionCard title="Trả chứng từ — quét mã QR phiếu EEIR (K80)" icon={<QrCode className="h-4 w-4 text-ink-muted" />}>
        <form onSubmit={(e) => { e.preventDefault(); confirm(code); }} className="flex gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoFocus placeholder="Quét mã QR phiếu EEIR (K80) / mã hồ sơ..." className={`${inputCls} py-2.5 font-mono text-sm uppercase`} />
          <button type="button" disabled={!code.trim()} onClick={() => showPreview(code)} className={`${secondaryBtn} shrink-0`}><Eye className="h-3.5 w-3.5" />Xem trước</button>
          <button type="submit" disabled={!code.trim()} className={`${primaryBtn} shrink-0`}>Xác nhận & in</button>
          <CameraScanButton onResult={(c) => { setCode(c); confirm(c); }} />
        </form>
        <p className="mt-2 text-[11px] text-ink-muted">Quét được cả phiếu Hạ vỏ và Cấp vỏ. Chỉ trả được khi lái xe đã đi đủ các bộ phận trên lộ trình. Hệ thống tự in PHIẾU TRẢ KHÁCH HÀNG (MATRAN EEIR - PHIẾU THU, khổ K80) gộp EEIR + thông tin thanh toán; lần in được ghi nhận theo phiếu thu.</p>
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {(['HA_VO', 'CAP_VO'] as Mode[]).map((m) => {
          const waiting = allWaiting.filter((t) => t.operationMode === m);
          return (
            <SectionCard
              key={m}
              title={`Đang chờ TRẢ CHỨNG TỪ ${MODE_LABEL[m]}`}
              icon={<FileCheck2 className="h-4 w-4 text-ink-muted" />}
              right={<span className="rounded bg-navy-900 px-2 py-0.5 text-[11px] font-bold text-white">{waiting.length}</span>}
            >
              {waiting.length === 0 ? (
                <p className="text-xs text-ink-muted">Không có lái xe nào đang chờ.</p>
              ) : (
                <ul className="divide-y divide-line text-xs">
                  {waiting.map((t) => {
                    // DEC-185: cont đã cấp ra, chờ trả chứng từ → được ĐỔI CONTAINER
                    const outOrder = m === 'CAP_VO' ? state.gateOutOrders.find((o) => o.gateOutCode === t.outDossierCode) : undefined;
                    return (
                    <li key={t.ticketCode} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span className="flex flex-wrap items-center gap-2">
                        <ContainerNo no={t.containerNo} />
                        <button type="button" onClick={() => onOpenDossier?.(t.outDossierCode || t.masterDossierCode)} className={linkCls}>{t.outDossierCode || t.masterDossierCode}</button>
                        <span className="text-ink-muted">Xe {t.truckNo || '-'} • {t.driverPhone || '-'}</span>
                      </span>
                      <span className="flex gap-2">
                        <button type="button" onClick={() => showPreview(t.qrCode)} className={secondaryBtn}><Eye className="h-3.5 w-3.5" />Xem trước</button>
                        <button type="button" onClick={() => confirm(t.qrCode)} className={secondaryBtn}>Trả chứng từ</button>
                        {outOrder && canSwapGateOut(outOrder) && (
                          <button type="button" onClick={() => setSwapOrderId(outOrder.id)} className={secondaryBtn}><Repeat className="h-3.5 w-3.5" />ĐỔI CONTAINER</button>
                        )}
                      </span>
                    </li>
                    );
                  })}
                </ul>
              )}
            </SectionCard>
          );
        })}
      </div>

      {pack && <DocumentPackPrint state={state} pack={pack} onClose={() => setPack(null)} />}
      {swapOrderId && (
        <SwapContainerModal
          state={state}
          gateOutOrderId={swapOrderId}
          onClose={() => setSwapOrderId(null)}
          onDone={(next, message) => { onUpdateState(next); setSwapOrderId(null); setSuccess(message); }}
        />
      )}
      {preview && <DocumentPackPrint state={state} pack={preview} preview onClose={() => setPreview(null)} />}
    </div>
  );
};

// PHIẾU TRẢ KHÁCH HÀNG "MATRAN EEIR - PHIẾU THU" (DEC-162): 1 phiếu K80 gộp EEIR + phiếu thu
// preview (DEC-110): chỉ xem trên màn hình — không tự in, không có vùng in, không nút in
// Lần in = bộ đếm phiếu thu (đã ghi nhận khi Trả chứng từ); in lại có đếm → Hồ sơ container → PHIẾU TRẢ KHÁCH HÀNG
const DocumentPackPrint: React.FC<{ state: DepotState; pack: DocumentPack; preview?: boolean; onClose: () => void }> = ({ state, pack, preview, onClose }) => {
  useEffect(() => {
    if (preview) return;
    const id = setTimeout(printNow, 300);
    return () => clearTimeout(id);
  }, [pack]);
  const printed = slipPrintCount(pack.receipts);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Phiếu trả khách hàng">
      <div className="my-4 w-full max-w-2xl space-y-4 rounded-lg bg-white p-5 text-xs shadow-xl">
        <div className="no-print flex items-center justify-between">
          <h2 className="text-sm font-bold">{preview ? 'XEM TRƯỚC phiếu trả khách hàng (chưa trả, chưa in)' : 'Phiếu trả khách hàng'} — {pack.dossierCode}</h2>
          <button type="button" onClick={onClose} aria-label="Đóng" className={secondaryBtn}><X className="h-3.5 w-3.5" /></button>
        </div>
        <div className="flex justify-center rounded-xl bg-canvas p-4">
          <CustomerSlipK80 state={state} ticket={pack.ticket} receipts={pack.receipts} printNo={preview ? (pack.receipts.length ? printed + 1 : undefined) : printed || undefined} />
        </div>
        {!preview && (
          <PrintPortal>
            <CustomerSlipK80 state={state} ticket={pack.ticket} receipts={pack.receipts} printNo={printed || undefined} />
          </PrintPortal>
        )}
        <p className="no-print text-[11px] text-ink-muted">
          {preview
            ? 'Chỉ xem — chưa ghi nhận trả chứng từ, không in, không tính lần in. Bấm Trả chứng từ để trả và in.'
            : 'In lại sau này tại Hồ sơ container → PHIẾU TRẢ KHÁCH HÀNG, hoặc phiếu thu lẻ tại Văn phòng → Phiếu thu (hệ thống hỏi xác nhận, đánh dấu BẢN IN LẠI).'}
        </p>
      </div>
    </div>
  );
};
