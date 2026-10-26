import React, { useEffect, useState } from 'react';
import { CreditCard, FilePlus2, Printer, ReceiptText, Search, X } from 'lucide-react';
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
import { cancelPendingTransaction, confirmPrepaidCash, createMasterPrepaidReceipt, masterReceiptUsage, receiptOperationOf } from '../../services/payments';
import { collectAllPages, queryReceipts, ReceiptQueryFilter, ReceiptRow, receiptsSheet } from '../../services/reports';
import { can } from '../../services/permissions';
import { INVOICE_STATUS_LABELS, invoicePortalUrl, markInvoiceIssued, prepaidInvoiceView, PrepaidInvoiceView, receiptInvoiceLabel, receiptInvoiceStatus } from '../../services/invoice';
import type { InvoiceStatus, PaymentReceipt } from '../../types/depot';
import { PrintPortal, PrintReceiptButton, ReceiptPrintSheet } from '../../components/ReceiptPrint';
import { quickRange, fileStamp } from '../../services/datetime';
import { linkCls,
  DateRangeFilter,
  DetailDrawer,
  ExportExcelButton,
  FeeLinesEditor,
  Feedback,
  formatViTime,
  inputCls,
  labelCls,
  Pager,
  usePageSize,
  PendingTransferPanel,
  primaryBtn,
  secondaryBtn,
  SectionCard,
} from '../../components/shared';


const STATUS_STYLE: Record<PaymentTransactionStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800',
  SUCCEEDED: 'bg-emerald-100 text-emerald-800',
  FAILED: 'bg-rose-100 text-rose-800',
  CANCELLED: 'bg-navy-50 text-ink-muted',
};

export const ReceiptsWorkspace: React.FC<{
  state: DepotState;
  onUpdateState: (next: DepotState) => void;
  onOpenDossier?: (code: string) => void;
  // Mở thẳng 1 phiếu thu (mã PT- hoặc id giao dịch) khi bấm từ hồ sơ container (DEC-051); nonce để mở lại cùng phiếu
  focus?: { key: string; nonce: number } | null;
}> = ({ state, onUpdateState, onOpenDossier, focus }) => {
  const [draft, setDraft] = useState<ReceiptQueryFilter>(() => ({ ...quickRange('TODAY'), keyword: '', method: 'ALL', status: 'ALL', operation: 'ALL', invoiceStatus: 'ALL' }));
  const [applied, setApplied] = useState<ReceiptQueryFilter | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize("receipts", 20); // DEC-080
  const [selectedTxId, setSelectedTxId] = useState('');
  const [create, setCreate] = useState({ customerCode: '', lotDescription: '', method: 'CASH' as DirectPaymentMethod });
  const [feeIds, setFeeIds] = useState<string[]>([]);
  const [qtys, setQtys] = useState<number[]>([]);
  // Chỉ để xem trước — tổng thật do service tính (DEC-077)
  const previewTotal = feeIds.reduce((s, id, i) => s + (state.feeCatalog.find((f) => f.id === id)?.defaultAmountInclVat || 0) * (qtys[i] || 0), 0);
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
      result = queryReceipts(state, applied, page, pageSize);
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

  // DEC-118: bấm mã phiếu thu trả trước → mở phiếu nạp tiền (PT-TTR-) của nó trên cùng màn
  const openMaster = (code: string) => {
    const m = state.masterReceipts.find((x) => x.receiptCode === code);
    const tx = m && state.paymentTransactions.find((x) => x.purpose === 'PREPAID_TOPUP' && x.masterReceiptId === m.id);
    if (tx) setSelectedTxId(tx.id);
  };

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
      const next = createMasterPrepaidReceipt(state, { ...create, feeItems: feeIds.map((catalogId, i) => ({ catalogId, quantity: qtys[i] })) });
      onUpdateState(next);
      setSelectedTxId(next.paymentTransactions[0].id);
      setSuccess(`Đã tạo phiếu thu TTR ${next.masterReceipts[0].receiptCode} — đang chờ thanh toán.`);
      setCreate({ customerCode: '', lotDescription: '', method: 'CASH' });
      setFeeIds([]);
      setQtys([]);
      setCreateOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi tạo phiếu thu');
    }
  };

  return (
    <div className="space-y-4">
      <Feedback error={error} success={success} onClose={() => (setError(null), setSuccess(null))} />

      <SectionCard title="Tra cứu phiếu thu" icon={<ReceiptText className="h-4 w-4 text-ink-muted" />}>
        <form
          onSubmit={(e) => { e.preventDefault(); setApplied({ ...draft }); setPage(1); setSelectedTxId(''); }}
          className="grid grid-cols-2 gap-2 sm:grid-cols-6"
        >
          <DateRangeFilter value={draft} onChange={(r) => setDraft({ ...draft, ...r })} />
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
          <label>
            <span className={labelCls}>Hóa đơn</span>
            <select value={draft.invoiceStatus || 'ALL'} onChange={(e) => setDraft({ ...draft, invoiceStatus: e.target.value as ReceiptQueryFilter['invoiceStatus'] })} className={inputCls}>
              <option value="ALL">Tất cả</option>
              {(Object.keys(INVOICE_STATUS_LABELS) as InvoiceStatus[]).map((s) => <option key={s} value={s}>{INVOICE_STATUS_LABELS[s]}</option>)}
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
              <button type="button" onClick={() => setCreateOpen(!createOpen)} className={`${secondaryBtn} ${createOpen ? "border-navy-900 text-navy-700" : ""}`}>
                <FilePlus2 className="h-4 w-4" />
                Tạo phiếu thu TTR (trả trước)
              </button>
            )}
          </div>
        </form>
      </SectionCard>

      {/* TẠO PHIẾU THU TRƯỚC — cùng bố cục màn thanh toán Hạ vỏ / Cấp vỏ (DEC-077) */}
      {canCreate && createOpen && (
        <form onSubmit={handleCreate} className="space-y-4 rounded-lg border-2 border-line-strong bg-navy-50/30 p-3 text-xs">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-black text-ink">
              <FilePlus2 className="h-4 w-4 text-navy-700" />
              Tạo phiếu thu TRƯỚC (TTR — trả trước)
            </h3>
            <button type="button" onClick={() => setCreateOpen(false)} aria-label="Đóng" className={secondaryBtn}><X className="h-3.5 w-3.5" /></button>
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <SectionCard title="1. Khách hàng thanh toán trước">
              <div className="space-y-3">
                <label className="block">
                  <span className={labelCls}>Khách hàng / đối tác *</span>
                  <select value={create.customerCode} onChange={(e) => setCreate({ ...create, customerCode: e.target.value })} className={inputCls}>
                    <option value="">-- Chọn --</option>
                    {state.partners.map((p) => <option key={p.id} value={p.code}>[{p.code}] {p.name}</option>)}
                  </select>
                </label>
                <label className="block">
                  <span className={labelCls}>Diễn giải lô</span>
                  <input value={create.lotDescription} onChange={(e) => setCreate({ ...create, lotDescription: e.target.value })} placeholder="VD: Thanh toán trước lô 20 cont tháng 11" className={inputCls} />
                </label>
              </div>
            </SectionCard>
            <FeeLinesEditor catalog={state.feeCatalog} selectedIds={feeIds} onChange={setFeeIds} quantities={qtys} onQuantitiesChange={setQtys} />
          </div>
          <SectionCard title="3. Hình thức thanh toán" icon={<CreditCard className="h-4 w-4 text-ink-muted" />}>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Hình thức thanh toán trước">
              {(['BANK_TRANSFER_API', 'CASH'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  role="radio"
                  aria-checked={create.method === m}
                  onClick={() => setCreate({ ...create, method: m })}
                  className={`rounded-md border py-2.5 text-xs font-semibold ${create.method === m ? 'border-navy-900 bg-navy-900 text-white' : 'border-line-strong bg-white text-ink hover:bg-canvas'}`}
                >
                  {m === 'CASH' ? 'Tiền mặt' : 'Chuyển khoản (API QR)'}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-ink-muted">Chỉ ghi nhận đã thu khi Văn phòng xác nhận tiền mặt hoặc ngân hàng xác nhận chuyển khoản; khi đó Phiếu thu trả trước mới dùng được để trừ dần.</p>
          </SectionCard>
          <div className="flex flex-wrap items-center justify-end gap-3">
            <span className="text-sm">Tổng thu trước: <strong className="font-mono text-base">{formatVnd(previewTotal)}</strong></span>
            <button type="submit" disabled={!create.customerCode || feeIds.length === 0 || qtys.some((q) => !(q >= 1))} className={primaryBtn}>
              Tạo phiếu thu trước (chờ thanh toán)
            </button>
          </div>
        </form>
      )}

      {/* DEC-077: danh sách full chiều ngang; chi tiết phiếu ở dưới */}
      <div className="space-y-4">
        <div>
          <div className="overflow-x-auto rounded-lg border border-line bg-white">
            {!applied ? (
              <p className="p-8 text-center text-xs text-ink-muted">Chọn điều kiện và bấm Tra cứu để xem phiếu thu.</p>
            ) : queryError ? (
              <p className="p-6 text-center text-xs text-red-700">{queryError}</p>
            ) : result && result.total === 0 ? (
              <p className="p-8 text-center text-xs text-ink-muted">Không có phiếu thu phù hợp.</p>
            ) : (
              result && (
                <>
                  <table className="w-full min-w-[1180px] whitespace-nowrap text-left text-xs">
                    <thead className="border-b border-line bg-canvas text-[11px] uppercase text-ink-muted">
                      <tr>
                        <th className="whitespace-nowrap px-2 py-2">Mã phiếu thu</th>
                        <th className="whitespace-nowrap px-2 py-2">Tác nghiệp</th>
                        <th className="whitespace-nowrap px-2 py-2">Số cont</th>
                        <th className="whitespace-nowrap px-2 py-2 text-right">Số tiền</th>
                        <th className="whitespace-nowrap px-2 py-2">Phương thức TT</th>
                        <th className="px-2 py-2">Bên thanh toán</th>
                        <th className="whitespace-nowrap px-2 py-2">Mã hồ sơ</th>
                        <th className="whitespace-nowrap px-2 py-2">Thời gian</th>
                        <th className="whitespace-nowrap px-2 py-2">Nhân viên</th>
                        <th className="whitespace-nowrap px-2 py-2">Trạng thái</th>
                        <th className="whitespace-nowrap px-2 py-2">Hóa đơn</th>
                        <th className="whitespace-nowrap px-2 py-2 text-center">Đã in</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {result.rows.map((row) => {
                        const { transaction: t, receipt: r } = row;
                        // DEC-079: phiếu thu trước → hiện luôn số lượt đã dùng / số tiền còn lại của Phiếu thu trả trước
                        const usage = t.purpose === 'PREPAID_TOPUP' ? masterReceiptUsage(state, r?.masterReceiptCode || t.paymentRef) : undefined;
                        return (
                        <tr key={t.id} onClick={() => setSelectedTxId(t.id)} className={`cursor-pointer ${selectedTxId === t.id ? 'bg-navy-50' : 'hover:bg-canvas'}`}>
                          <td className="whitespace-nowrap px-2 py-2">{r ? <button type="button" onClick={() => setSelectedTxId(t.id)} className={linkCls}>{r.receiptNo}</button> : '—'}</td>
                          <td className="whitespace-nowrap px-2 py-2 font-bold">{RECEIPT_OPERATION_LABELS[operationOf(row)]}</td>
                          <td className="whitespace-nowrap px-2 py-2 font-mono font-bold">{t.containerNo || '-'}</td>
                          <td className="whitespace-nowrap px-2 py-2 text-right font-mono font-bold">{formatVnd(t.amount)}</td>
                          <td className="whitespace-nowrap px-2 py-2">{PAYMENT_METHOD_LABELS[t.method]}</td>
                          <td className="px-2 py-2">{t.payerName}</td>
                          <td className="whitespace-nowrap px-2 py-2 font-mono">
                            {usage ? (
                              // DEC-122: thu trước chỉ hiện tóm tắt — bấm để xem chi tiết (cửa sổ phiếu + bảng các lượt đã dùng)
                              <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedTxId(t.id); }} className={`${linkCls} font-sans text-[11px]`} data-testid="prepaid-usage-link">
                                Dùng {usage.usedCount} lượt • còn {formatVnd(usage.remainingAmount)}
                              </button>
                            ) : (
                              t.dossierCode ? (
                                <button type="button" onClick={(e) => { e.stopPropagation(); onOpenDossier?.(t.dossierCode!); }} className={linkCls}>{t.dossierCode}</button>
                              ) : r?.masterReceiptCode ? (
                                <button type="button" onClick={(e) => { e.stopPropagation(); openMaster(r.masterReceiptCode!); }} className={linkCls}>{r.masterReceiptCode}</button>
                              ) : '-'
                            )}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 font-mono text-[11px]">{formatViTime(t.createdAt)}</td>
                          <td className="px-2 py-2 text-[11px]">{t.createdBy}</td>
                          <td className="px-2 py-2"><span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[t.status]}`}>{PAYMENT_TX_STATUS_LABELS[t.status]}</span></td>
                          <td className="px-2 py-2">{r ? <InvoiceBadge status={receiptInvoiceStatus(state, r)} label={receiptInvoiceLabel(state, r)} /> : '—'}</td>
                          <td className={`px-2 py-2 text-center font-bold ${(r?.printLog?.length || 0) > 1 ? "text-rose-700" : "text-ink-muted"}`}>{r ? r.printLog?.length || 0 : "—"}</td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <Pager page={result.page} pageCount={result.pageCount} total={result.total} onPage={setPage} pageSize={pageSize} onPageSize={setPageSize} />
                </>
              )
            )}
          </div>
        </div>

        <div className="space-y-4">
          {selected && (
            <DetailDrawer
              open
              onClose={() => setSelectedTxId("")}
              title={selected.receipt ? `Phiếu thu ${selected.receipt.receiptNo}` : 'Yêu cầu thanh toán (chưa phát hành phiếu thu)'}
              actions={
                selected.receipt && (
                  <PrintReceiptButton state={state} receipt={selected.receipt} onUpdateState={onUpdateState} onError={setError} />
                )
              }
            >
              {/* Mẫu in thống nhất (DEC-062) — chỉ hiện khi in */}
              {selected.receipt && (
                <PrintPortal>
                  <ReceiptPrintSheet state={state} receipt={selected.receipt} printNo={selected.receipt.printLog?.length || 1} />
                </PrintPortal>
              )}
              {selected.receipt && (selected.receipt.printLog?.length || 0) > 0 && (
                <div className="mb-3 rounded-md border border-line px-3 py-2 text-[11px]">
                  <span className="font-bold text-ink">Lịch sử in ({selected.receipt.printLog!.length} lần)</span>
                  <ul className="mt-1 space-y-0.5">
                    {selected.receipt.printLog!.map((p, i) => (
                      <li key={i} className={i > 0 ? 'text-rose-700' : 'text-ink-muted'}>
                        Lần {i + 1}{i > 0 ? ' (in lại)' : ''}: {formatViTime(p.at)} • {p.by}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <p className="mb-3 rounded-md border border-line-strong bg-canvas px-3 py-2 text-center text-sm font-black tracking-wide text-ink">
                TÁC NGHIỆP: {RECEIPT_OPERATION_LABELS[operationOf(selected)]}
              </p>
              <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <dt className="text-ink-muted">Trạng thái</dt>
                <dd><span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${STATUS_STYLE[selected.transaction.status]}`}>{PAYMENT_TX_STATUS_LABELS[selected.transaction.status]}</span></dd>
                <dt className="text-ink-muted">Số tiền</dt>
                <dd className="font-mono font-bold">{formatVnd(selected.transaction.amount)}</dd>
                <dt className="text-ink-muted">Phương thức TT</dt>
                <dd>{PAYMENT_METHOD_LABELS[selected.transaction.method]}</dd>
                <dt className="text-ink-muted">Bên thanh toán</dt>
                <dd>{selected.transaction.payerName}</dd>
                <dt className="text-ink-muted">Mã tham chiếu</dt>
                <dd className="font-mono">{selected.transaction.paymentRef}</dd>
                {selected.transaction.providerTxRef && (
                  <>
                    <dt className="text-ink-muted">Mã GD ngân hàng</dt>
                    <dd className="font-mono">{selected.transaction.providerTxRef}</dd>
                  </>
                )}
                <dt className="text-ink-muted">Người tạo</dt>
                <dd>{selected.transaction.createdBy} • {formatViTime(selected.transaction.createdAt)}</dd>
                {selected.transaction.confirmedBy && (
                  <>
                    <dt className="text-ink-muted">Xác nhận thu</dt>
                    <dd>{selected.transaction.confirmedBy} • {formatViTime(selected.transaction.confirmedAt)}</dd>
                  </>
                )}
                {selected.transaction.cancelReason && (
                  <>
                    <dt className="text-ink-muted">Lý do hủy</dt>
                    <dd>{selected.transaction.cancelReason}</dd>
                  </>
                )}
                {selected.transaction.dossierCode && (
                  <>
                    <dt className="text-ink-muted">Hồ sơ nghiệp vụ</dt>
                    <dd>
                      <button type="button" onClick={() => onOpenDossier?.(selected.transaction.dossierCode!)} className={linkCls}>
                        {selected.transaction.dossierCode}
                      </button>
                      {selected.transaction.containerNo && <span className="font-mono"> • {selected.transaction.containerNo}</span>}
                    </dd>
                  </>
                )}
                {(selected.receipt?.masterReceiptCode || selected.transaction.purpose === 'PREPAID_TOPUP') && (
                  <>
                    <dt className="text-ink-muted">Phiếu thu trả trước (TTR)</dt>
                    <dd className="font-mono">
                      <button type="button" onClick={() => openMaster(selected.receipt?.masterReceiptCode || selected.transaction.paymentRef)} className={linkCls}>
                        {selected.receipt?.masterReceiptCode || selected.transaction.paymentRef}
                      </button>
                      {(() => {
                        const m = state.masterReceipts.find((x) => x.id === selected.transaction.masterReceiptId);
                        return m ? ` • QR ${m.qrCode} • Dư ${formatVnd(m.remainingAmount)}` : ''; // DEC-124: mã = số phiếu PT-TTR-
                      })()}
                    </dd>
                  </>
                )}
              </dl>
              {selected.receipt && (
                <InvoicePanel
                  receipt={selected.receipt}
                  status={receiptInvoiceStatus(state, selected.receipt)}
                  prepaid={prepaidInvoiceView(state, selected.receipt)}
                  canIssue={can(state.currentUser, 'INVOICE_ISSUE')}
                  onIssue={(invoiceNo, groupId) => run(() => markInvoiceIssued(state, { receiptNo: selected.receipt!.receiptNo, invoiceNo, groupId }), 'Đã cập nhật ĐÃ XHD.')}
                />
              )}
              {selected.transaction.purpose === "PREPAID_TOPUP" && (
                <MasterUsagePanel
                  state={state}
                  code={selected.receipt?.masterReceiptCode || selected.transaction.paymentRef}
                  onOpenDossier={onOpenDossier}
                  invoice={selected.receipt ? {
                    view: prepaidInvoiceView(state, selected.receipt),
                    canIssue: can(state.currentUser, 'INVOICE_ISSUE'),
                    onIssue: (invoiceNo, groupId) => run(() => markInvoiceIssued(state, { receiptNo: selected.receipt!.receiptNo, invoiceNo, groupId }), 'Đã cập nhật ĐÃ XHD.'),
                  } : undefined}
                />
              )}

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
            </DetailDrawer>
          )}

        </div>
      </div>
    </div>
  );
};

// DEC-079: SỬ DỤNG PHIẾU THU TRẢ TRƯỚC — mỗi lần trừ tiền gắn chứng từ, hồ sơ; tổng nạp / số lượt / đã dùng / còn lại
export const MasterUsagePanel: React.FC<{
  state: DepotState;
  code: string;
  onOpenDossier?: (code: string) => void;
  invoice?: { view?: PrepaidInvoiceView; canIssue: boolean; onIssue: (invoiceNo: string, groupId?: string) => void }; // DEC-133
}> = ({ state, code, onOpenDossier, invoice }) => {
  const usage = masterReceiptUsage(state, code);
  const [openLot, setOpenLot] = useState('');
  const view = invoice?.view;
  if (!usage) return null;
  const tile = (label: string, value: React.ReactNode, tone: string) => (
    <div className={`rounded-md border px-2.5 py-1.5 ${tone}`}>
      <p className="text-[10px] font-semibold uppercase">{label}</p>
      <p className="font-mono text-sm font-black">{value}</p>
    </div>
  );
  return (
    <div className="mt-3 space-y-2 rounded-md border-2 border-line-strong p-3 text-xs">
      <p className="font-black uppercase text-ink">Sử dụng phiếu thu trả trước {usage.master.receiptCode}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {tile('Tổng nạp', formatVnd(usage.master.totalAmount), 'border-line text-ink')}
        {tile('Số lượt đã dùng', `${usage.usedCount} lượt`, 'border-line-strong bg-navy-50 text-navy-900')}
        {tile('Đã trừ', formatVnd(usage.usedAmount), 'border-amber-200 bg-amber-50 text-amber-800')}
        {tile('Còn lại', formatVnd(usage.remainingAmount), 'border-emerald-200 bg-emerald-50 text-emerald-800')}
      </div>
      {usage.rows.length === 0 ? (
        <p className="text-ink-muted">{usage.master.status === 'PENDING_PAYMENT' ? 'Chưa thu tiền nạp — chưa dùng được để trừ.' : 'Chưa có lượt tác nghiệp nào trừ vào phiếu thu trả trước này.'}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left">
            <thead className="border-b border-line text-[11px] uppercase text-ink-muted">
              <tr>
                <th className="py-1.5 pr-2">#</th>
                <th className="py-1.5 pr-2">Thời gian</th>
                <th className="py-1.5 pr-2">Tác nghiệp</th>
                <th className="py-1.5 pr-2">Mã hồ sơ</th>
                <th className="py-1.5 pr-2">Số cont</th>
                <th className="py-1.5 pr-2 text-right">Số tiền trừ</th>
                <th className="py-1.5 pr-2 text-right">Số dư sau</th>
                <th className="py-1.5 pr-2">Nhân viên</th>
                {view && <th className="py-1.5">Hóa đơn</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {usage.rows.map((u, i) => {
                const lot = view?.lots.find((l) => l.deductionId === u.deductionId);
                return (
                <React.Fragment key={u.deductionId}>
                <tr className={openLot === u.deductionId ? 'bg-navy-50/60' : ''}>
                  <td className="py-1.5 pr-2 text-ink-muted">{usage.rows.length - i}</td>
                  <td className="whitespace-nowrap py-1.5 pr-2 font-mono text-[11px]">{formatViTime(u.performedAt)}</td>
                  <td className="py-1.5 pr-2 font-bold">{u.operation}</td>
                  <td className="py-1.5 pr-2 font-mono">
                    {u.dossierCode ? (
                      <button type="button" onClick={() => onOpenDossier?.(u.dossierCode)} className={linkCls}>{u.dossierCode}</button>
                    ) : '-'}
                  </td>
                  <td className="py-1.5 pr-2 font-mono">{u.containerNo}</td>
                  <td className="py-1.5 pr-2 text-right font-mono font-bold">{formatVnd(u.amount)}</td>
                  <td className="py-1.5 pr-2 text-right font-mono">{formatVnd(u.balanceAfter)}</td>
                  <td className="py-1.5 pr-2 text-[11px]">{u.performedBy}</td>
                  {view && (
                    <td className="py-1.5">
                      {/* DEC-133: trạng thái hóa đơn từng lượt — bấm xem yêu cầu của khách */}
                      <button type="button" onClick={() => setOpenLot(openLot === u.deductionId ? '' : u.deductionId)} title="Xem yêu cầu hóa đơn" data-testid="lot-invoice">
                        <InvoiceBadge status={lot?.status || 'CHUA_XHD'} label={`${INVOICE_STATUS_LABELS[lot?.status || 'CHUA_XHD']} ${openLot === u.deductionId ? '▴' : '▾'}`} />
                      </button>
                    </td>
                  )}
                </tr>
                {view && openLot === u.deductionId && (
                  <tr>
                    <td colSpan={9} className="bg-navy-50/60 px-2 pb-2">
                      <InvoiceGroupDetail view={view} groupId={lot?.groupId} canIssue={invoice!.canIssue} onIssue={invoice!.onIssue} />
                    </td>
                  </tr>
                )}
                </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// DEC-111: trạng thái xuất hóa đơn của phiếu thu
const INVOICE_STYLE: Record<InvoiceStatus, string> = {
  CHUA_XHD: 'bg-navy-50 text-ink-muted',
  YEU_CAU_XHD: 'bg-amber-100 text-amber-800',
  DA_XHD: 'bg-emerald-100 text-emerald-800',
};

export const InvoiceBadge: React.FC<{ status: InvoiceStatus; label?: string }> = ({ status, label }) => (
  <span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold ${INVOICE_STYLE[status]}`}>{label || INVOICE_STATUS_LABELS[status]}</span>
);

// Thông tin khách gửi + Kế toán cập nhật ĐÃ XHD (số hóa đơn MISA không bắt buộc). Hiện mã bảo mật để đối soát (DEC-112); không có trong Excel.
export const InvoicePanel: React.FC<{
  receipt: PaymentReceipt;
  canIssue: boolean;
  onIssue: (invoiceNo: string, groupId?: string) => void;
  status?: InvoiceStatus;
  prepaid?: PrepaidInvoiceView; // DEC-130: phiếu thu trả trước — hóa đơn theo nhóm lượt
}> = ({ receipt: r, canIssue, onIssue, status: statusProp, prepaid }) => {
  const [invoiceNo, setInvoiceNo] = useState('');
  const status = statusProp || r.invoiceStatus || 'CHUA_XHD';
  const req = r.invoiceRequest;
  return (
    <div className="mt-3 space-y-2 rounded-md border border-line p-3 text-xs" data-testid="invoice-panel">
      <div className="flex items-center justify-between">
        <span className="font-bold uppercase text-ink">Xuất hóa đơn</span>
        <InvoiceBadge status={status} />
      </div>
      {/* DEC-112: hiện mã bảo mật để Văn phòng / Kế toán đối soát với phiếu khách mang tới */}
      {r.invoiceSecret && (
        <dl className="grid grid-cols-[6rem_1fr] gap-x-2 gap-y-1 rounded bg-canvas px-2 py-1.5" data-testid="invoice-secret-panel">
          <dt className="text-ink-muted">Đường link</dt>
          <dd className="break-all font-mono text-[11px]">{invoicePortalUrl()}</dd>
          <dt className="text-ink-muted">Mã bảo mật</dt>
          <dd className="font-mono text-sm font-black tracking-widest">{r.invoiceSecret}</dd>
        </dl>
      )}
      {prepaid ? (
        <p className="text-ink-muted" data-testid="prepaid-invoice-summary">
          {prepaid.lots.length} lượt đã dùng • {prepaid.lots.filter((l) => !l.groupId).length} lượt chưa yêu cầu • {prepaid.groups.filter((g) => g.status === 'YEU_CAU_XHD').length} yêu cầu chờ xuất • còn {formatVnd(prepaid.remainingAmount)} chưa dùng (chưa xuất hóa đơn được).
          {' '}Trạng thái + yêu cầu của khách xem ở cột <b>HÓA ĐƠN</b> từng lượt bên dưới.
        </p>
      ) : req ? (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1">
          <dt className="text-ink-muted">Mã số thuế</dt><dd className="font-mono font-bold">{req.taxCode}</dd>
          <dt className="text-ink-muted">Gmail nhận HĐ</dt><dd className="break-all">{req.email}</dd>
          <dt className="text-ink-muted">Tên công ty</dt><dd>{req.companyName}</dd>
          <dt className="text-ink-muted">Địa chỉ</dt><dd>{req.address}</dd>
          {req.note && (<><dt className="text-ink-muted">Ghi chú</dt><dd>{req.note}</dd></>)}
          <dt className="text-ink-muted">Khách gửi lúc</dt><dd className="font-mono">{formatViTime(req.updatedAt)}</dd>
          {r.invoiceIssued && (
            <>
              <dt className="text-ink-muted">Số hóa đơn</dt><dd className="font-mono font-bold">{r.invoiceIssued.invoiceNo || '-'}</dd>
              <dt className="text-ink-muted">Cập nhật XHD</dt><dd>{r.invoiceIssued.issuedBy} • {formatViTime(r.invoiceIssued.issuedAt)}</dd>
            </>
          )}
        </dl>
      ) : (
        <p className="text-ink-muted">Khách hàng chưa gửi yêu cầu (dùng mã bảo mật in trên phiếu thu).</p>
      )}
      {!prepaid && status === 'YEU_CAU_XHD' && canIssue && (
        <div className="flex gap-2 border-t border-line pt-2">
          <input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="Số hóa đơn MISA (không bắt buộc)" className={`${inputCls} font-mono`} />
          <button type="button" onClick={() => onIssue(invoiceNo)} className={`${primaryBtn} shrink-0`}>Đã xuất hóa đơn</button>
        </div>
      )}
    </div>
  );
};

// DEC-133: chi tiết 1 yêu cầu hóa đơn (nhóm lượt) — mở từ ô HÓA ĐƠN của bảng Sử dụng phiếu thu trả trước
export const InvoiceGroupDetail: React.FC<{ view: PrepaidInvoiceView; groupId?: string; canIssue: boolean; onIssue: (invoiceNo: string, groupId?: string) => void }> = ({ view, groupId, canIssue, onIssue }) => {
  const [no, setNo] = useState('');
  const g = view.groups.find((x) => x.id === groupId);
  if (!g) return <p className="text-ink-muted" data-testid="invoice-group-detail">Khách hàng chưa gửi yêu cầu hóa đơn cho lượt này.</p>;
  const no_ = view.groups.indexOf(g) + 1;
  const lots = view.lots.filter((l) => g.deductionIds.includes(l.deductionId));
  return (
    <div className="space-y-1 rounded border border-line bg-white p-2" data-testid="invoice-group-detail">
      <div className="flex items-center justify-between">
        <span className="font-bold">Yêu cầu {no_} — {lots.length} lượt • {formatVnd(g.amount)}</span>
        <InvoiceBadge status={g.status} />
      </div>
      <p className="font-mono text-[11px] text-ink-muted">Gộp: {lots.map((l) => `${l.dossierCode} (${l.containerNo})`).join(', ')}</p>
      <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-0.5">
        <dt className="text-ink-muted">Mã số thuế</dt><dd className="font-mono font-bold">{g.taxCode}</dd>
        <dt className="text-ink-muted">Gmail nhận HĐ</dt><dd className="break-all">{g.email}</dd>
        <dt className="text-ink-muted">Tên công ty</dt><dd>{g.companyName}</dd>
        <dt className="text-ink-muted">Địa chỉ</dt><dd>{g.address}</dd>
        {g.note && (<><dt className="text-ink-muted">Ghi chú</dt><dd>{g.note}</dd></>)}
        {g.status === 'DA_XHD' && (<><dt className="text-ink-muted">Số hóa đơn</dt><dd className="font-mono font-bold">{g.invoiceNo || '-'} • {g.issuedBy}</dd></>)}
      </dl>
      {g.status === 'YEU_CAU_XHD' && canIssue && (
        <div className="flex gap-2 pt-1">
          <input value={no} onChange={(e) => setNo(e.target.value)} placeholder="Số hóa đơn MISA (không bắt buộc)" className={`${inputCls} font-mono`} />
          <button type="button" onClick={() => onIssue(no, g.id)} className={`${primaryBtn} shrink-0`}>Đã xuất hóa đơn</button>
        </div>
      )}
    </div>
  );
};
