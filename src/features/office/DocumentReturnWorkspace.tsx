import React, { useEffect, useState } from 'react';
import { FileCheck2, Printer, QrCode, X } from 'lucide-react';
import { PAYMENT_METHOD_LABELS, RECEIPT_OPERATION_LABELS } from '../../types/depot';
import { DepotState, formatVnd } from '../../services/depotStore';
import { confirmDocumentsReturn, DocumentPack, getDriverRoute, ticketsAwaitingReturn } from '../../services/driverRoute';
import { receiptOperationOf } from '../../services/payments';
import { ContainerNo, Feedback, formatViTime, inputCls, primaryBtn, secondaryBtn, SectionCard } from '../../components/shared';

// VĂN PHÒNG — TRẢ CHỨNG TỪ (DEC-052): lái xe quay về, quét QR phiếu K80 → in EEIR + phiếu thu (nếu có)
export const DocumentReturnWorkspace: React.FC<{
  state: DepotState;
  onUpdateState: (next: DepotState) => void;
}> = ({ state, onUpdateState }) => {
  const [code, setCode] = useState('');
  const [pack, setPack] = useState<DocumentPack | null>(null);
  const [error, setError] = useState<string | null>(null);
  const waiting = ticketsAwaitingReturn(state);

  const confirm = (raw: string) => {
    setError(null);
    try {
      const res = confirmDocumentsReturn(state, { scannedQrCode: raw });
      onUpdateState(res.state);
      setPack(res.pack);
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
        <p className="mt-2 text-[11px] text-slate-500">Chỉ trả được khi lái xe đã đi đủ các bộ phận trên lộ trình phiếu K80. Hệ thống tự mở lệnh in EEIR và phiếu thu (nếu có).</p>
      </SectionCard>

      <SectionCard title={`Đang chờ trả chứng từ (${waiting.length})`} icon={<FileCheck2 className="h-4 w-4 text-slate-500" />}>
        {waiting.length === 0 ? (
          <p className="text-xs text-slate-500">Không có lái xe nào đang chờ.</p>
        ) : (
          <ul className="divide-y divide-slate-100 text-xs">
            {waiting.map((t) => (
              <li key={t.ticketCode} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span className="flex items-center gap-2">
                  <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-black text-white">{t.operationMode === 'CAP_VO' ? 'CẤP VỎ' : 'HẠ VỎ'}</span>
                  <ContainerNo no={t.containerNo} />
                  <span className="text-slate-600">Xe {t.truckNo || '-'} • {t.driverPhone || '-'}</span>
                </span>
                <button type="button" onClick={() => confirm(t.qrCode)} className={secondaryBtn}>Trả chứng từ</button>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      {pack && <DocumentPackPrint state={state} pack={pack} onClose={() => setPack(null)} />}
    </div>
  );
};

// Bộ chứng từ in cho lái xe: EEIR + phiếu thu
const DocumentPackPrint: React.FC<{ state: DepotState; pack: DocumentPack; onClose: () => void }> = ({ state, pack, onClose }) => {
  const t = pack.ticket;
  const steps = getDriverRoute(state, t);
  useEffect(() => {
    const id = setTimeout(() => window.print(), 300);
    return () => clearTimeout(id);
  }, [pack]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Bộ chứng từ">
      <div className="my-4 w-full max-w-2xl space-y-4 rounded-lg bg-white p-5 text-xs shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold">Bộ chứng từ trả lái xe — {pack.dossierCode}</h2>
          <div className="flex gap-2">
            <button type="button" onClick={() => window.print()} className={secondaryBtn}><Printer className="h-3.5 w-3.5" />In lại</button>
            <button type="button" onClick={onClose} aria-label="Đóng" className={secondaryBtn}><X className="h-3.5 w-3.5" /></button>
          </div>
        </div>

        <section className="border-2 border-slate-800 p-4">
          <h3 className="mb-2 text-center text-sm font-black">EEIR — PHIẾU GIAO NHẬN CONTAINER ({t.operationMode === 'CAP_VO' ? 'CẤP VỎ' : 'HẠ VỎ'})</h3>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
            <dt className="text-slate-500">Mã hồ sơ</dt><dd className="font-mono font-bold">{pack.dossierCode}</dd>
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
                  <td className="py-1">{s.done ? `✓ ${s.doneBy || ''} • ${formatViTime(s.doneAt)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-6 grid grid-cols-2 text-center">
            <span>Lái xe<br /><br /><br />(Ký, ghi rõ họ tên)</span>
            <span>Đại diện MATRAN DEPOT<br /><br /><br />(Ký, ghi rõ họ tên)</span>
          </div>
        </section>

        {pack.receipts.map((r) => (
          <section key={r.id} className="border-2 border-slate-800 p-4">
            <h3 className="text-center text-sm font-black">PHIẾU THU {r.receiptNo}</h3>
            <p className="mb-2 text-center font-black">TÁC NGHIỆP: {RECEIPT_OPERATION_LABELS[receiptOperationOf(state, r)]}</p>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1">
              <dt className="text-slate-500">Bên thanh toán</dt><dd>{r.payerName}</dd>
              <dt className="text-slate-500">Số tiền</dt><dd className="font-mono font-bold">{formatVnd(r.amount)}</dd>
              <dt className="text-slate-500">Hình thức</dt><dd>{PAYMENT_METHOD_LABELS[r.method]}</dd>
              <dt className="text-slate-500">Chứng từ</dt><dd className="font-mono">{r.voucherNo || '-'}</dd>
              <dt className="text-slate-500">Thu lúc</dt><dd>{formatViTime(r.issuedAt)} • {r.issuedBy}</dd>
            </dl>
          </section>
        ))}
        {pack.receipts.length === 0 && <p className="text-center text-slate-500">Không có phiếu thu (TTT trừ Phiếu thu mẹ / TTS công nợ).</p>}
      </div>
    </div>
  );
};
