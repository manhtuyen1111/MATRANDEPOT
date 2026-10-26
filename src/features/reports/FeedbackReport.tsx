import React, { useState } from 'react';
import { MessageSquare, Search } from 'lucide-react';
import type { DepotState } from '../../services/depotStore';
import { collectAllPages, feedbackSheet, FeedbackFilter, queryFeedback } from '../../services/reports';
import { FEEDBACK_STATUS_LABELS, respondFeedback } from '../../services/feedback';
import { fileStamp, formatDateTime, quickRange } from '../../services/datetime';
import { DateRangeFilter, DetailDrawer, ExportExcelButton, Feedback, inputCls, labelCls, Pager, primaryBtn, SectionCard, usePageSize, CellText, CELL_MAX} from '../../components/shared';
import { FeedbackMenuOption, FeedbackStatusBadge } from '../../components/FeedbackButton';
import type { FeedbackItem, FeedbackStatus } from '../../types/depot';

// BÁO CÁO → GÓP Ý (DEC-120): chỉ Admin — lọc, phân trang, Excel; bấm dòng mở chi tiết, cập nhật trạng thái + phản hồi
export const FeedbackReport: React.FC<{ state: DepotState; onUpdateState: (next: DepotState) => void; menuOptions: FeedbackMenuOption[] }> = ({ state, onUpdateState, menuOptions }) => {
  const [draft, setDraft] = useState<FeedbackFilter>(() => ({ ...quickRange('TODAY'), status: 'ALL', menuId: 'ALL', keyword: '' }));
  const [applied, setApplied] = useState<FeedbackFilter | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize('report-feedback', 50);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  let result: ReturnType<typeof queryFeedback> | null = null;
  let queryError: string | null = null;
  if (applied) {
    try {
      result = queryFeedback(state, applied, page, pageSize);
    } catch (err) {
      queryError = err instanceof Error ? err.message : 'Lỗi tra cứu';
    }
  }
  const selected = (state.feedbacks || []).find((f) => f.id === selectedId) || null;

  return (
    <div className="space-y-4">
      <SectionCard title="Báo cáo Góp ý" icon={<MessageSquare className="h-4 w-4 text-slate-500" />}>
        <form onSubmit={(e) => { e.preventDefault(); setApplied({ ...draft }); setPage(1); }} className="grid grid-cols-2 gap-2 sm:grid-cols-6">
          <DateRangeFilter value={draft} onChange={(r) => setDraft({ ...draft, ...r })} />
          <label>
            <span className={labelCls}>Trạng thái</span>
            <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as FeedbackFilter['status'] })} className={inputCls}>
              <option value="ALL">Tất cả</option>
              {(Object.keys(FEEDBACK_STATUS_LABELS) as FeedbackStatus[]).map((s) => <option key={s} value={s}>{FEEDBACK_STATUS_LABELS[s]}</option>)}
            </select>
          </label>
          <label>
            <span className={labelCls}>Menu / tính năng</span>
            <select value={draft.menuId} onChange={(e) => setDraft({ ...draft, menuId: e.target.value })} className={inputCls}>
              <option value="ALL">Tất cả</option>
              {menuOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
              <option value="KHAC">Khác</option>
            </select>
          </label>
          <label className="col-span-2">
            <span className={labelCls}>Từ khóa (mã, nội dung, người góp ý)</span>
            <input value={draft.keyword} onChange={(e) => setDraft({ ...draft, keyword: e.target.value })} className={inputCls} />
          </label>
          <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-6">
            <button type="submit" className={primaryBtn}><Search className="h-4 w-4" />Tra cứu</button>
            {applied && result && result.total > 0 && (
              <ExportExcelButton
                fileName={`MATRAN_GOP_Y_${fileStamp(applied.dateFrom) || 'tra-cuu'}.xlsx`}
                getSheets={() => [feedbackSheet(collectAllPages((p) => queryFeedback(state, applied, p)))]}
              />
            )}
          </div>
        </form>
      </SectionCard>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        {!applied ? (
          <p className="p-8 text-center text-xs text-slate-500">Chọn điều kiện và bấm Tra cứu để xem góp ý.</p>
        ) : queryError ? (
          <p className="p-6 text-center text-xs text-red-700">{queryError}</p>
        ) : !result || result.total === 0 ? (
          <p className="p-8 text-center text-xs text-slate-500">Không có góp ý phù hợp.</p>
        ) : (
          <>
            <table className="w-full min-w-[960px] whitespace-nowrap text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2">Mã góp ý</th>
                  <th className="px-3 py-2">Thời gian</th>
                  <th className="px-3 py-2">Người góp ý</th>
                  <th className="px-3 py-2">Menu / tính năng</th>
                  <th className="px-3 py-2">Nội dung</th>
                  <th className="px-3 py-2">Trạng thái</th>
                  <th className="px-3 py-2">Phản hồi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.rows.map((f) => (
                  <tr key={f.id} onClick={() => setSelectedId(f.id)} className={`cursor-pointer ${selectedId === f.id ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                    <td className="whitespace-nowrap px-3 py-2 font-mono font-bold">{f.code}</td>
                    <td className="whitespace-nowrap px-3 py-2 font-mono">{formatDateTime(f.createdAt)}</td>
                    <td className="px-3 py-2">{f.createdBy}</td>
                    <td className="px-3 py-2">{f.menuLabel}</td>
                    <td className="px-3 py-2"><CellText text={f.content} max={CELL_MAX.LONG} /></td>
                    <td className="px-3 py-2"><FeedbackStatusBadge status={f.status} /></td>
                    <td className="px-3 py-2 text-slate-600"><CellText text={f.response} max={CELL_MAX.MEDIUM} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager page={result.page} pageCount={result.pageCount} total={result.total} onPage={setPage} pageSize={pageSize} onPageSize={setPageSize} />
          </>
        )}
      </div>

      <DetailDrawer open={Boolean(selected)} title={selected ? `Góp ý ${selected.code}` : ''} onClose={() => setSelectedId(null)}>
        {selected && <FeedbackDetail key={selected.id + (selected.respondedAt || '')} item={selected} state={state} onUpdateState={onUpdateState} />}
      </DetailDrawer>
    </div>
  );
};

const FeedbackDetail: React.FC<{ item: FeedbackItem; state: DepotState; onUpdateState: (next: DepotState) => void }> = ({ item: f, state, onUpdateState }) => {
  const [status, setStatus] = useState<FeedbackStatus>(f.status);
  const [response, setResponse] = useState(f.response || '');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const save = () => {
    setError(null);
    setSuccess(null);
    try {
      onUpdateState(respondFeedback(state, { id: f.id, status, response }));
      setSuccess('Đã lưu trạng thái / phản hồi.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được.');
    }
  };
  return (
    <div className="space-y-3 text-xs">
      <Feedback error={error} success={success} onClose={() => (setError(null), setSuccess(null))} />
      <dl className="grid grid-cols-[7rem_1fr] gap-x-3 gap-y-1.5">
        <dt className="text-slate-500">Người góp ý</dt><dd>{f.createdBy}</dd>
        <dt className="text-slate-500">Thời gian</dt><dd className="font-mono">{formatDateTime(f.createdAt)}</dd>
        <dt className="text-slate-500">Menu / tính năng</dt><dd className="font-semibold">{f.menuLabel}</dd>
        <dt className="text-slate-500">Trạng thái</dt><dd><FeedbackStatusBadge status={f.status} /></dd>
        {f.respondedBy && (<><dt className="text-slate-500">Phản hồi lúc</dt><dd>{f.respondedBy} • {formatDateTime(f.respondedAt)}</dd></>)}
      </dl>
      <p className="whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-3 text-slate-900">{f.content}</p>
      <div className="space-y-2 border-t border-slate-200 pt-3">
        <label className="block">
          <span className={labelCls}>Trạng thái xử lý</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as FeedbackStatus)} className={inputCls}>
            {(Object.keys(FEEDBACK_STATUS_LABELS) as FeedbackStatus[]).map((s) => <option key={s} value={s}>{FEEDBACK_STATUS_LABELS[s]}</option>)}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Phản hồi cho người góp ý</span>
          <textarea value={response} onChange={(e) => setResponse(e.target.value)} rows={3} className={inputCls} />
        </label>
        <button type="button" onClick={save} className={`${primaryBtn} w-full`}>Lưu</button>
      </div>
    </div>
  );
};
