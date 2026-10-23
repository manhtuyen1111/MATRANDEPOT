import React, { useEffect, useState } from 'react';
import { FileCheck2, Printer, QrCode, X } from 'lucide-react';
import { DepotState } from '../../services/depotStore';
import { recordReceiptPrint } from '../../services/depotOperations';
import { confirmDocumentsReturn, DocumentPack, ticketsAwaitingReturn } from '../../services/driverRoute';
import { ContainerNo, Feedback, inputCls, primaryBtn, secondaryBtn, SectionCard } from '../../components/shared';
import { EeirPrintSheet, PrintPortal, ReceiptPrintSheet } from '../../components/ReceiptPrint';

type Mode = 'HA_VO' | 'CAP_VO';
const MODE_LABEL: Record<Mode, string> = { HA_VO: 'HẠ VỎ', CAP_VO: 'CẤP VỎ' };

// VĂN PHÒNG — TRẢ CHỨNG TỪ (DEC-052, DEC-064): 1 ô quét chung; danh sách chờ chia 2 cột HẠ VỎ / CẤP VỎ
export const DocumentReturnWorkspace: React.FC<{
  state: DepotState;
  onUpdateState: (next: DepotState) => void;
}> = ({ state, onUpdateState }) => {
  const [code, setCode] = useState('');
  const [pack, setPack] = useState<DocumentPack | null>(null);
  const [error, setError] = useState<string | null>(null);
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

  return (
    <div className="space-y-4">
      <Feedback error={error} onClose={() => setError(null)} />
      <SectionCard title="Trả chứng từ — quét mã QR phiếu K80" icon={<QrCode className="h-4 w-4 text-slate-500" />}>
        <form onSubmit={(e) => { e.preventDefault(); confirm(code); }} className="flex gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} autoFocus placeholder="Quét mã QR K80 / mã hồ sơ..." className={`${inputCls} py-2.5 font-mono text-sm uppercase`} />
          <button type="submit" disabled={!code.trim()} className={`${primaryBtn} shrink-0`}>Xác nhận & in</button>
        </form>
        <p className="mt-2 text-[11px] text-slate-500">Quét được cả phiếu Hạ vỏ và Cấp vỏ. Chỉ trả được khi lái xe đã đi đủ các bộ phận trên lộ trình. Hệ thống tự in EEIR và phiếu thu (nếu có); mỗi lần in phiếu thu được ghi nhận.</p>
      </SectionCard>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {(['HA_VO', 'CAP_VO'] as Mode[]).map((m) => {
          const waiting = allWaiting.filter((t) => t.operationMode === m);
          return (
            <SectionCard
              key={m}
              title={`Đang chờ TRẢ CHỨNG TỪ ${MODE_LABEL[m]}`}
              icon={<FileCheck2 className="h-4 w-4 text-slate-500" />}
              right={<span className="rounded bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-white">{waiting.length}</span>}
            >
              {waiting.length === 0 ? (
                <p className="text-xs text-slate-500">Không có lái xe nào đang chờ.</p>
              ) : (
                <ul className="divide-y divide-slate-100 text-xs">
                  {waiting.map((t) => (
                    <li key={t.ticketCode} className="flex flex-wrap items-center justify-between gap-2 py-2">
                      <span className="flex flex-wrap items-center gap-2">
                        <ContainerNo no={t.containerNo} />
                        <span className="font-mono text-slate-600">{t.outDossierCode || t.masterDossierCode}</span>
                        <span className="text-slate-600">Xe {t.truckNo || '-'} • {t.driverPhone || '-'}</span>
                      </span>
                      <button type="button" onClick={() => confirm(t.qrCode)} className={secondaryBtn}>Trả chứng từ</button>
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          );
        })}
      </div>

      {pack && <DocumentPackPrint state={state} pack={pack} onClose={() => setPack(null)} />}
    </div>
  );
};

// Bộ chứng từ trả lái xe: EEIR + phiếu thu (cùng mẫu với Văn phòng → Phiếu thu)
const DocumentPackPrint: React.FC<{ state: DepotState; pack: DocumentPack; onClose: () => void }> = ({ state, pack, onClose }) => {
  // Lần in tự động = EEIR + phiếu thu (đã ghi nhận 1 lần in); bấm "In lại EEIR" chỉ in EEIR (phiếu thu in lại ở Văn phòng → Phiếu thu)
  const [eeirOnly, setEeirOnly] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => window.print(), 300);
    return () => clearTimeout(id);
  }, [pack]);
  const printEeir = () => {
    setEeirOnly(true);
    setTimeout(() => window.print(), 100);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Bộ chứng từ">
      <div className="my-4 w-full max-w-2xl space-y-4 rounded-lg bg-white p-5 text-xs shadow-xl">
        <div className="no-print flex items-center justify-between">
          <h2 className="text-sm font-bold">Bộ chứng từ trả lái xe — {pack.dossierCode}</h2>
          <div className="flex gap-2">
            <button type="button" onClick={printEeir} className={secondaryBtn}><Printer className="h-3.5 w-3.5" />In lại EEIR</button>
            <button type="button" onClick={onClose} aria-label="Đóng" className={secondaryBtn}><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>
        <div className="space-y-4">
          <EeirPrintSheet state={state} ticket={pack.ticket} />
          {pack.receipts.map((r) => (
            <ReceiptPrintSheet key={r.id} state={state} receipt={r} printNo={r.printLog?.length || 1} />
          ))}
          {pack.receipts.length === 0 && <p className="text-center text-slate-500">Không có phiếu thu (TTT trừ Phiếu thu mẹ / TTS công nợ).</p>}
        </div>
        <PrintPortal>
          <EeirPrintSheet state={state} ticket={pack.ticket} />
          {!eeirOnly && pack.receipts.map((r) => <ReceiptPrintSheet key={r.id} state={state} receipt={r} printNo={r.printLog?.length || 1} />)}
        </PrintPortal>
        <p className="no-print text-[11px] text-slate-500">In lại phiếu thu sau này tại Văn phòng → Phiếu thu (hệ thống hỏi xác nhận và đánh dấu BẢN IN LẠI).</p>
      </div>
    </div>
  );
};
