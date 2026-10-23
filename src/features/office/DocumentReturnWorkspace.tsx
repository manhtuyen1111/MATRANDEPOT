import React, { useEffect, useState } from 'react';
import { FileCheck2, Printer, QrCode, X } from 'lucide-react';
import { K80InternalTicket } from '../../types/depot';
import { DepotState } from '../../services/depotStore';
import { recordReceiptPrint } from '../../services/depotOperations';
import { confirmDocumentsReturn, DocumentPack, getDriverRoute, ticketsAwaitingReturn } from '../../services/driverRoute';
import { formatDateTime } from '../../services/datetime';
import { ContainerNo, Feedback, inputCls, primaryBtn, secondaryBtn, SectionCard } from '../../components/shared';
import { CompanyHeader, ReceiptPrintSheet } from '../../components/ReceiptPrint';

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

const EeirSheet: React.FC<{ state: DepotState; ticket: K80InternalTicket; dossierCode: string }> = ({ state, ticket: t, dossierCode }) => {
  const steps = getDriverRoute(state, t);
  return (
    <section className="border-2 border-slate-800 bg-white p-4">
      <CompanyHeader
        company={state.companyProfile}
        title={`EEIR — PHIẾU GIAO NHẬN CONTAINER`}
        subtitle={<p className="mt-1 inline-block bg-slate-900 px-2 py-0.5 text-xs font-black text-white">TÁC NGHIỆP: {t.operationMode === 'CAP_VO' ? 'CẤP VỎ' : 'HẠ VỎ'}</p>}
      />
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
        <dt className="text-slate-500">Mã hồ sơ</dt><dd className="font-mono font-bold">{dossierCode}</dd>
        <dt className="text-slate-500">Số container</dt><dd className="font-mono font-bold">{t.containerNo}</dd>
        <dt className="text-slate-500">Size / Type</dt><dd>{t.size} / {t.type}</dd>
        <dt className="text-slate-500">Trạng thái</dt><dd>{t.conditionClass} • {t.stuffingClass}</dd>
        <dt className="text-slate-500">Số xe</dt><dd className="font-bold">{t.truckNo || '-'}</dd>
        <dt className="text-slate-500">SĐT lái xe</dt><dd>{t.driverPhone || '-'}</dd>
        <dt className="text-slate-500">Khách hàng</dt><dd className="sm:col-span-3">{t.customerRep || '-'}</dd>
        {t.damageRemarks && t.damageRemarks.length > 0 && (<><dt className="text-slate-500">Hư hỏng</dt><dd className="sm:col-span-3">{t.damageRemarks.join(', ')}</dd></>)}
      </dl>
      <table className="mt-3 w-full border-collapse text-left">
        <thead><tr className="border-b border-slate-400"><th className="py-1">Bước</th><th className="py-1">Bộ phận</th><th className="py-1">Xác nhận</th></tr></thead>
        <tbody>
          {steps.map((s, i) => (
            <tr key={s.key} className="border-b border-slate-200">
              <td className="py-1">{i + 1}. {s.action}</td>
              <td className="py-1 font-semibold">{s.dept}</td>
              <td className="py-1">{s.done ? `✓ ${s.doneBy || ''} • ${formatDateTime(s.doneAt)}` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-6 grid grid-cols-2 text-center">
        <span>Lái xe<br /><br /><br />(Ký, ghi rõ họ tên)</span>
        <span>Đại diện {state.companyProfile.shortName}<br /><br /><br />(Ký, ghi rõ họ tên)</span>
      </div>
    </section>
  );
};

// Bộ chứng từ trả lái xe: EEIR + phiếu thu (cùng mẫu với Văn phòng → Phiếu thu)
const DocumentPackPrint: React.FC<{ state: DepotState; pack: DocumentPack; onClose: () => void }> = ({ state, pack, onClose }) => {
  useEffect(() => {
    const id = setTimeout(() => window.print(), 300);
    return () => clearTimeout(id);
  }, [pack]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Bộ chứng từ">
      <div className="my-4 w-full max-w-2xl space-y-4 rounded-lg bg-white p-5 text-xs shadow-xl">
        <div className="no-print flex items-center justify-between">
          <h2 className="text-sm font-bold">Bộ chứng từ trả lái xe — {pack.dossierCode}</h2>
          <div className="flex gap-2">
            <button type="button" onClick={() => window.print()} className={secondaryBtn}><Printer className="h-3.5 w-3.5" />In EEIR</button>
            <button type="button" onClick={onClose} aria-label="Đóng" className={secondaryBtn}><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>
        <div className="print-area space-y-4">
          <EeirSheet state={state} ticket={pack.ticket} dossierCode={pack.dossierCode} />
          {pack.receipts.map((r) => (
            <ReceiptPrintSheet key={r.id} state={state} receipt={r} printNo={r.printLog?.length || 1} />
          ))}
          {pack.receipts.length === 0 && <p className="text-center text-slate-500">Không có phiếu thu (TTT trừ Phiếu thu mẹ / TTS công nợ).</p>}
        </div>
        <p className="no-print text-[11px] text-slate-500">In lại phiếu thu sau này tại Văn phòng → Phiếu thu (hệ thống hỏi xác nhận và đánh dấu BẢN IN LẠI).</p>
      </div>
    </div>
  );
};
