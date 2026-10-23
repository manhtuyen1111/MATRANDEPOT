import React, { useEffect, useState } from 'react';
import { FilePlus2, Printer, ReceiptText, Search, X } from 'lucide-react';
import {
  DirectPaymentMethod,
  PAYMENT_METHOD_LABELS,
  PAYMENT_TX_STATUS_LABELS,
  PaymentTransactionStatus,
  RECEIPT_OPERATION_LABELS,
  ReceiptOperation,
} from '../../types/depot';
import { DepotState, formatVnd } from '../../services/depotStore';
import { simulateDemoBankTransfer } from '../../services/depotOperations';
import { cancelPendingTransaction, confirmPrepaidCash, createMasterPrepaidReceipt, receiptOperationOf } from '../../services/payments';
import { collectAllPages, queryReceipts, ReceiptQueryFilter, ReceiptRow, receiptsSheet } from '../../services/reports';
import { can } from '../../services/permissions';
import { PrintReceiptButton, ReceiptPrintSheet } from '../../components/ReceiptPrint';
import { defaultLastDayRange, fileStamp } from '../../services/datetime';
import {
  DateTimeField,
  ExportExcelButton,
  Feedback,
  formatViTime,
  inputCls,
  labelCls,
  Pager,
  PendingTransferPanel,
  primaryBtn,
  secondaryBtn,
  SectionCard,
} from '../../components/shared';


const STATUS_STYLE: Record<PaymentTransactionStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  SUCCEEDED: 'bg-emerald-100 text-emerald-800',
  FAILED: 'bg-rose-100 text-rose-800',
  CANCELLED: 'bg-slate-100 text-slate-600',
};

export const ReceiptsWorkspace: React.FC<{
  state: DepotState;
  onUpdateState: (next: DepotState) => void;
  onOpenDossier?: (code: string) => void;
  // Mở thẳng 1 phiếu thu (mã PT- hoặc id giao dịch) khi bấm từ hồ sơ container (DEC-051); nonce để mở lại cùng phiếu
  focus?: { key: string; nonce: number } | null;
}> = ({ state, onUpdateState, onOpenDossier, focus }) => {
  const [draft, setDraft] = useState<ReceiptQueryFilter>(() => ({ ...defaultLastDayRange(), keyword: '', method: 'ALL', status: 'ALL', operation: 'ALL' }));
  const [applied, setApplied] = useState<ReceiptQueryFilter | null>(null);
  const [page, setPage] = useState(1);
  const [selectedTxId, setSelectedTxId] = useState('');
  const [create, setCreate] = useState({ customerCode: '', totalAmount: '', lotDescription: '', method: 'CASH' as DirectPaymentMethod });
  const [createOpen, setCreateOpen] = useState(false); // DEC-076: nút Tạo phiếu thu TTT cùng hàng Tra cứu
  const [cancelReason, setCancelReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Bấm từ hồ sơ container → tra cứu đúng phiếu thu đó và mở chi tiết
  useEffect(() => {
    if (!focus?.key) return;
    const tx =
      state.paymentTransactions.find((t) => t.id === focus.key) ||
      state.paymentTransactions.find((t) => state.paymentReceipts.some((r) => r.receiptNo === focus.key && r.transactionId === t.id));
    setApplied({ receiptNo: focus.key });
    setPage(1);
    setSelectedTxId(tx?.id || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.nonce]);

  const operationOf = (row: ReceiptRow): ReceiptOperation =>
    receiptOperationOf(state, { ...row.transaction, operation: row.receipt?.operation });

  const canCreate = can(state.currentUser, 'PREPAID_RECEIPT_CREATE');
  let result: ReturnType<typeof queryReceipts> | null = null;
  let queryError: string | null = null;
  if (applied) {
    try {
      result = queryReceipts(state, applied, page);
    } catch (err) {
      queryError = err instanceof Error ? err.message : 'Lỗi tra cứu';
    }
  }
  const selected: ReceiptRow | undefined = selectedTxId
    ? (() => {
        const transaction = state.paymentTransactions.find((t) => t.id === selectedTxId);
        return transaction ? { transaction, receipt: state.paymentReceipts.find((r) => r.transactionId === transaction.id) } : undefined;
      })()
    : undefined;

  const run = (fn: () => DepotState, message: string) => {
    setError(null);
    setSuccess(null);
    try {
      onUpdateState(fn());
      setSuccess(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thao tác thất bại');
    }
  };

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      const next = createMasterPrepaidReceipt(state, { ...create, totalAmount: Number(create.totalAmount) });
      onUpdateState(next);
      setSelectedTxId(next.paymentTransactions[0].id);
      setSuccess(`Đã tạo phiếu thu TTT ${next.masterReceipts[0].receiptCode} — đang chờ thanh toán.`);
      setCreate({ customerCode: '', totalAmount: '', lotDescription: '', method: 'CASH' });
      setCreateOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi tạo phiếu thu');
    }
  };

  return (
    <div className="space-y-4">
      <Feedback error={error} success={success} onClose={() => (setError(null), setSuccess(null))} />

      <SectionCard title="Tra cứu phiếu thu" icon={<ReceiptText className="h-4 w-4 text-slate-500" />}>
        <form
          onSubmit={(e) => { e.preventDefault(); setApplied({ ...draft }); setPage(1); setSelectedTxId(''); }}
          className="grid grid-cols-2 gap-2 sm:grid-cols-6"
        >
          <DateTimeField label="Từ (dd/mm/yyyy hh:mm:ss)" value={draft.dateFrom || ''} onChange={(v) => setDraft({ ...draft, dateFrom: v })} />
          <DateTimeField label="Đến (dd/mm/yyyy hh:mm:ss)" value={draft.dateTo || ''} onChange={(v) => setDraft({ ...draft, dateTo: v })} fallback="end" />
          <label className="col-span-2">
            <span className={labelCls}>Mã phiếu thu / Số cont / Mã hồ sơ</span>
            <input value={draft.keyword} onChange={(e) => setDraft({ ...draft, keyword: e.target.value })} className={`${inputCls} font-mono uppercase`} />
          </label>
          <label>
            <span className={labelCls}>Hình thức</span>
            <select value={draft.method} onChange={(e) => setDraft({ ...draft, method: e.target.value as ReceiptQueryFilter['method'] })} className={inputCls}>
              <option value="ALL">Tất cả</option>
              <option value="CASH">Tiền mặt</option>
              <option value="BANK_TRANSFER_API">Chuyển khoản</option>
            </select>
          </label>
          <label>
            <span className={labelCls}>Tác nghiệp</span>
            <select value={draft.operation} onChange={(e) => setDraft({ ...draft, operation: e.target.value as ReceiptQueryFilter['operation'] })} className={inputCls}>
              <option value="ALL">Tất cả</option>
              {(Object.keys(RECEIPT_OPERATION_LABELS) as ReceiptOperation[]).map((o) => (
                <option key={o} value={o}>{RECEIPT_OPERATION_LABELS[o]}</option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelCls}>Trạng thái</span>
            <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as ReceiptQueryFilter['status'] })} className={inputCls}>
              <option value="ALL">Tất cả</option>
              {(Object.keys(PAYMENT_TX_STATUS_LABELS) as PaymentTransactionStatus[]).map((s) => (
                <option key={s} value={s}>{PAYMENT_TX_STATUS_LABELS[s]}</option>
              ))}
            </select>
          </label>
          <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-6">
            <button type="submit" className={primaryBtn}>
              <Search className="h-4 w-4" />
              Tra cứu
            </button>
            {applied && result && result.total > 0 && (
              <ExportExcelButton
                fileName={`MATRAN_PHIEU_THU_${fileStamp(applied.dateFrom) || applied.receiptNo || "tra-cuu"}.xlsx`}
                getSheets={() => [receiptsSheet(state, collectAllPages((p) => queryReceipts(state, applied, p)))]}
              />
            )}
            {canCreate && (
              <button type="button" onClick={() => setCreateOpen(!createOpen)} className={`${secondaryBtn} ${createOpen ? "border-blue-600 text-blue-700" : ""}`}>
                <FilePlus2 className="h-4 w-4" />
                Tạo phiếu thu TTT (thanh toán trước)
              </button>
            )}
          </div>
        </form>
      </SectionCard>

      {canCreate && createOpen && (
        <SectionCard
          title="Tạo phiếu thu TTT (thanh toán trước)"
          icon={<FilePlus2 className="h-4 w-4 text-slate-500" />}
          right={<button type="button" onClick={() => setCreateOpen(false)} aria-label="Đóng" className={secondaryBtn}><X className="h-3.5 w-3.5" /></button>}
        >
          <form onSubmit={handleCreate} className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-6 sm:items-end">
            <label className="sm:col-span-2">
              <span className={labelCls}>Khách hàng / đối tác *</span>
              <select value={create.customerCode} onChange={(e) => setCreate({ ...create, customerCode: e.target.value })} className={inputCls}>
                <option value="">-- Chọn --</option>
                {state.partners.map((p) => <option key={p.id} value={p.code}>[{p.code}] {p.name}</option>)}
              </select>
            </label>
            <label>
              <span className={labelCls}>Số tiền (VNĐ) *</span>
              <input type="number" min={0} inputMode="numeric" value={create.totalAmount} onChange={(e) => setCreate({ ...create, totalAmount: e.target.value })} className={`${inputCls} font-mono`} />
            </label>
            <label>
              <span className={labelCls}>Hình thức *</span>
              <select value={create.method} onChange={(e) => setCreate({ ...create, method: e.target.value as DirectPaymentMethod })} className={inputCls}>
                <option value="CASH">Tiền mặt</option>
                <option value="BANK_TRANSFER_API">Chuyển khoản (API QR)</option>
              </select>
            </label>
            <label className="sm:col-span-2">
              <span className={labelCls}>Diễn giải lô</span>
              <input value={create.lotDescription} onChange={(e) => setCreate({ ...create, lotDescription: e.target.value })} placeholder="VD: Thanh toán trước lô 20 cont tháng 11" className={inputCls} />
            </label>
            <div className="flex flex-wrap items-center gap-2 sm:col-span-6">
              <button type="submit" disabled={!create.customerCode || !Number(create.totalAmount)} className={primaryBtn}>Tạo phiếu thu (chờ thanh toán)</button>
              <span className="text-[11px] text-slate-500">Chỉ ghi nhận đã thu khi Văn phòng xác nhận tiền mặt hoặc ngân hàng xác nhận chuyển khoản; khi đó Phiếu thu mẹ mới dùng được để trừ dần.</span>
            </div>
          </form>
        </SectionCard>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            {!applied ? (
              <p className="p-8 text-center text-xs text-slate-500">Chọn điều kiện và bấm Tra cứu để xem phiếu thu.</p>
            ) : queryError ? (
              <p className="p-6 text-center text-xs text-red-700">{queryError}</p>
            ) : result && result.total === 0 ? (
              <p className="p-8 text-center text-xs text-slate-500">Không có phiếu thu phù hợp.</p>
            ) : (
              result && (
                <>
                  <table className="w-full min-w-[640px] text-left text-xs">
                    <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-600">
                      <tr>
                        <th className="px-3 py-2">Mã phiếu thu</th>
                        <th className="px-3 py-2">Tác nghiệp</th>
                        <th className="px-3 py-2">Thời gian</th>
                        <th className="px-3 py-2 text-right">Số tiền</th>
                        <th className="px-3 py-2">Hình thức</th>
                        <th className="px-3 py-2">Trạng thái</th>
                        <th className="px-3 py-2">Hồ sơ / Cont</th>
                        <th className="px-3 py-2 text-center">Đã in</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {result.rows.map((row) => {
                        const { transaction: t, receipt: r } = row;
                        return (
                        <tr key={t.id} onClick={() => setSelectedTxId(t.id)} className={`cursor-pointer ${selectedTxId === t.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                          <td className="px-3 py-2 font-mono font-bold">{r?.receiptNo || '—'}</td>
                          <td className="px-3 py-2 font-bold">{RECEIPT_OPERATION_LABELS[operationOf(row)]}</td>
                          <td className="px-3 py-2">{formatViTime(t.confirmedAt || t.createdAt)}</td>
                          <td className="px-3 py-2 text-right font-mono">{formatVnd(t.amount)}</td>
                          <td className="px-3 py-2">{t.paymentCategory === 'TTT' ? 'TTT (nạp trước)' : 'TTTT'} • {PAYMENT_METHOD_LABELS[t.method]}</td>
                          <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[t.status]}`}>{PAYMENT_TX_STATUS_LABELS[t.status]}</span></td>
                          <td className="px-3 py-2 font-mono">{t.dossierCode || t.paymentRef}{t.containerNo ? ` • ${t.containerNo}` : ''}</td>
                          <td className={`px-3 py-2 text-center font-bold ${(r?.printLog?.length || 0) > 1 ? "text-rose-700" : "text-slate-600"}`}>{r ? r.printLog?.length || 0 : "—"}</td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <Pager page={result.page} pageCount={result.pageCount} total={result.total} onPage={setPage} />
                </>
              )
            )}
          </div>
        </div>

        <div className="space-y-4 lg:col-span-5">
          {selected && (
            <SectionCard
              title={selected.receipt ? `Phiếu thu ${selected.receipt.receiptNo}` : 'Yêu cầu thanh toán (chưa phát hành phiếu thu)'}
              right={
                selected.receipt && (
                  <PrintReceiptButton state={state} receipt={selected.receipt} onUpdateState={onUpdateState} onError={setError} />
                )
              }
            >
              {/* Mẫu in thống nhất (DEC-062) — chỉ hiện khi in */}
              {selected.receipt && (
                <div className="print-area hidden print:block">
                  <ReceiptPrintSheet state={state} receipt={selected.receipt} printNo={selected.receipt.printLog?.length || 1} />
                </div>
              )}
              {selected.receipt && (selected.receipt.printLog?.length || 0) > 0 && (
                <div className="mb-3 rounded-md border border-slate-200 px-3 py-2 text-[11px]">
                  <span className="font-bold text-slate-700">Lịch sử in ({selected.receipt.printLog!.length} lần)</span>
                  <ul className="mt-1 space-y-0.5">
                    {selected.receipt.printLog!.map((p, i) => (
                      <li key={i} className={i > 0 ? 'text-rose-700' : 'text-slate-600'}>
                        Lần {i + 1}{i > 0 ? ' (in lại)' : ''}: {formatViTime(p.at)} • {p.by}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="mb-3 rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-center text-sm font-black tracking-wide text-slate-900">
                TÁC NGHIỆP: {RECEIPT_OPERATION_LABELS[operationOf(selected)]}
              </p>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <dt className="text-slate-500">Trạng thái</dt>
                <dd><span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[selected.transaction.status]}`}>{PAYMENT_TX_STATUS_LABELS[selected.transaction.status]}</span></dd>
                <dt className="text-slate-500">Số tiền</dt>
                <dd className="font-mono font-bold">{formatVnd(selected.transaction.amount)}</dd>
                <dt className="text-slate-500">Trường hợp / Phương thức</dt>
                <dd>{selected.transaction.paymentCategory} • {PAYMENT_METHOD_LABELS[selected.transaction.method]}</dd>
                <dt className="text-slate-500">Bên thanh toán</dt>
                <dd>{selected.transaction.payerName}</dd>
                <dt className="text-slate-500">Mã tham chiếu</dt>
                <dd className="font-mono">{selected.transaction.paymentRef}</dd>
                {selected.transaction.providerTxRef && (
                  <>
                    <dt className="text-slate-500">Mã GD ngân hàng</dt>
                    <dd className="font-mono">{selected.transaction.providerTxRef}</dd>
                  </>
                )}
                <dt className="text-slate-500">Người tạo</dt>
                <dd>{selected.transaction.createdBy} • {formatViTime(selected.transaction.createdAt)}</dd>
                {selected.transaction.confirmedBy && (
                  <>
                    <dt className="text-slate-500">Xác nhận thu</dt>
                    <dd>{selected.transaction.confirmedBy} • {formatViTime(selected.transaction.confirmedAt)}</dd>
                  </>
                )}
                {selected.transaction.cancelReason && (
                  <>
                    <dt className="text-slate-500">Lý do hủy</dt>
                    <dd>{selected.transaction.cancelReason}</dd>
                  </>
                )}
                {selected.transaction.dossierCode && (
                  <>
                    <dt className="text-slate-500">Hồ sơ nghiệp vụ</dt>
                    <dd>
                      <button type="button" onClick={() => onOpenDossier?.(selected.transaction.dossierCode!)} className="font-mono text-blue-700 hover:underline">
                        {selected.transaction.dossierCode}
                      </button>
                      {selected.transaction.containerNo && <span className="font-mono"> • {selected.transaction.containerNo}</span>}
                    </dd>
                  </>
                )}
                {selected.receipt?.voucherNo && (
                  <>
                    <dt className="text-slate-500">Chứng từ</dt>
                    <dd className="font-mono">{selected.receipt.voucherNo}</dd>
                  </>
                )}
                {(selected.receipt?.masterReceiptCode || selected.transaction.purpose === 'PREPAID_TOPUP') && (
                  <>
                    <dt className="text-slate-500">Phiếu thu mẹ (TTT)</dt>
                    <dd className="font-mono">
                      {selected.receipt?.masterReceiptCode || selected.transaction.paymentRef}
                      {(() => {
                        const m = state.masterReceipts.find((x) => x.id === selected.transaction.masterReceiptId);
                        return m ? ` • QR ${m.qrCode} • Dư ${formatVnd(m.remainingAmount)}` : '';
                      })()}
                    </dd>
                  </>
                )}
              </dl>

              {selected.transaction.status === 'PENDING' && (
                <div className="mt-3 space-y-2">
                  {selected.transaction.method === 'BANK_TRANSFER_API' ? (
                    <PendingTransferPanel
                      state={state}
                      transaction={selected.transaction}
                      onSimulate={() => run(() => simulateDemoBankTransfer(state, { transactionId: selected.transaction.id }), 'Ngân hàng (giả lập) đã xác nhận — đã phát hành phiếu thu.')}
                      onCancel={(reason) => run(() => cancelPendingTransaction(state, { transactionId: selected.transaction.id, reason }), 'Đã hủy yêu cầu thanh toán.')}
                    />
                  ) : (
                    <>
                      {selected.transaction.purpose === 'PREPAID_TOPUP' && can(state.currentUser, 'PREPAID_CASH_CONFIRM') && (
                        <button
                          type="button"
                          onClick={() => run(() => confirmPrepaidCash(state, { transactionId: selected.transaction.id }), 'Đã xác nhận thu tiền mặt và phát hành phiếu thu.')}
                          className={`${primaryBtn} w-full`}
                        >
                          Xác nhận đã thu tiền mặt
                        </button>
                      )}
                      <div className="flex gap-2">
                        <input value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Lý do hủy..." className={inputCls} />
                        <button
                          type="button"
                          disabled={!cancelReason.trim()}
                          onClick={() => { run(() => cancelPendingTransaction(state, { transactionId: selected.transaction.id, reason: cancelReason }), 'Đã hủy yêu cầu thanh toán.'); setCancelReason(''); }}
                          className={`${secondaryBtn} shrink-0`}
                        >
                          Hủy
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </SectionCard>
          )}

        </div>
      </div>
    </div>
  );
};
