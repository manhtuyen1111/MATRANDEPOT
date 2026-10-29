import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { VesselMode, VESSEL_MODE_LABELS } from '../../types/depot';
import { DepotState } from '../../services/depotStore';
import { collectAllPages, queryVesselReport, queryVesselSummaryReport, VesselReportFilter, vesselReportSheet, vesselSummarySheet } from '../../services/reports';
import { VesselListStatus } from '../vessel/VesselShared';
import { quickRange, fileStamp, formatDateTime } from '../../services/datetime';
import { linkCls, ContainerNo, DateRangeFilter, ExportExcelButton, Feedback, inputCls, labelCls, Pager, primaryBtn, SectionCard, usePageSize, CellText, CELL_MAX } from '../../components/shared';
import { useReportState } from '../../components/useReportState';
import { CONTAINER_SEARCH_HINT } from '../../services/containerSearch';

const STATUS: Record<VesselMode, Record<string, string>> = {
  NHAP_TAU: { PENDING: 'Chờ xe về', INSPECTED: 'Đã giám định — chờ hạ', DONE: 'Đã hạ bãi', SKIPPED: 'Không kịp (gạch)' },
  XUAT_TAU: { PENDING: 'Chờ xuất', INSPECTED: '-', DONE: 'Đã xuất tàu', SKIPPED: 'Không kịp (gạch)' },
};

// BÁO CÁO NHẬP TÀU / XUẤT TÀU (DEC-069): lọc theo thời gian nhập / xuất tàu, tên tàu, số cont
export const VesselReport: React.FC<{ state: DepotState; mode: VesselMode; onOpenDossier?: (code: string) => void }> = ({ state: live, mode, onOpenDossier }) => {
  const report = useReportState(live); // N7
  const state = report.data;
  const isImport = mode === 'NHAP_TAU';
  const label = VESSEL_MODE_LABELS[mode];
  const [draft, setDraft] = useState<VesselReportFilter>(() => ({ containerNo: '', vesselName: '', ...quickRange('TODAY') }));
  const [applied, setApplied] = useState<VesselReportFilter | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize(`report-${mode}`, 50); // DEC-080
  // DEC-165: 2 chế độ xem — CHI TIẾT (từng cont) / TÊN TÀU (mỗi tàu 1 dòng); cùng bộ lọc, Excel theo chế độ đang xem
  const [view, setView] = useState<'DETAIL' | 'VESSEL'>('DETAIL');

  let result: ReturnType<typeof queryVesselReport> | null = null;
  let summary: ReturnType<typeof queryVesselSummaryReport> | null = null;
  let queryError: string | null = null;
  if (applied) {
    try {
      if (view === 'DETAIL') result = queryVesselReport(state, mode, applied, page, pageSize);
      else summary = queryVesselSummaryReport(state, mode, applied, page, pageSize);
    } catch (err) {
      queryError = err instanceof Error ? err.message : 'Lỗi tra cứu';
    }
  }

  return (
    <div className="space-y-4">
      <SectionCard title={`Báo cáo ${isImport ? 'Nhập tàu' : 'Xuất tàu'}`} icon={<Search className="h-4 w-4 text-ink-muted" />}>
        <form onSubmit={(e) => { e.preventDefault(); report.run(draft, () => { setApplied({ ...draft }); setPage(1); }); }} className="grid grid-cols-2 gap-2 sm:grid-cols-6">
          <label className="col-span-2 sm:col-span-1">
            <span className={labelCls}>Số container</span>
            <input value={draft.containerNo} onChange={(e) => setDraft({ ...draft, containerNo: e.target.value.toUpperCase() })} placeholder={CONTAINER_SEARCH_HINT} className={`${inputCls} font-mono uppercase`} />
          </label>
          <label className="col-span-2 sm:col-span-1">
            <span className={labelCls}>Tên tàu</span>
            <input value={draft.vesselName} onChange={(e) => setDraft({ ...draft, vesselName: e.target.value.toUpperCase() })} className={`${inputCls} uppercase`} />
          </label>
          <DateRangeFilter label={`Thời gian ${label.toLowerCase()}`} value={draft} onChange={(r) => setDraft({ ...draft, ...r })} />
          <div className="col-span-2 flex flex-wrap items-end gap-2">
            <button type="submit" className={primaryBtn} disabled={report.loading}>
              <Search className="h-4 w-4" />
              {report.loading ? 'Đang tải…' : 'Tra cứu'}
            </button>
            {applied && (result?.total || summary?.total) ? (
              <ExportExcelButton
                fileName={`MATRAN_${mode}${view === 'VESSEL' ? '_THEO-TAU' : ''}_${fileStamp(applied.dateFrom) || applied.vesselName || applied.containerNo || 'tra-cuu'}.xlsx`}
                getSheets={() => [
                  view === 'DETAIL'
                    ? vesselReportSheet(mode, collectAllPages((p, size) => queryVesselReport(state, mode, applied, p, size)))
                    : vesselSummarySheet(mode, collectAllPages((p, size) => queryVesselSummaryReport(state, mode, applied, p, size))),
                ]}
              />
            ) : null}
          </div>
        </form>
      </SectionCard>

      <Feedback error={report.loadError} />

      <div className="inline-flex overflow-hidden rounded-lg border border-line bg-white text-xs font-bold">
        {([['DETAIL', 'CHI TIẾT'], ['VESSEL', 'TÊN TÀU']] as const).map(([k, t]) => (
          <button key={k} type="button" onClick={() => { setView(k); setPage(1); }} className={`px-4 py-2 ${view === k ? 'bg-navy-900 text-white' : 'text-ink-muted hover:bg-canvas'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        {!applied ? (
          <p className="p-8 text-center text-xs text-ink-muted">Nhập số container / tên tàu hoặc chọn khoảng thời gian, sau đó bấm Tra cứu.</p>
        ) : queryError ? (
          <p className="p-6 text-center text-xs text-red-700">{queryError}</p>
        ) : view === 'VESSEL' && summary && summary.total > 0 ? (
          <>
            <table className="data-table w-full min-w-[960px] whitespace-nowrap text-left text-xs">
              <thead className="border-b border-line bg-canvas text-[11px] uppercase text-ink-muted">
                <tr>
                  <th className="px-3 py-2">Tên tàu</th>
                  <th className="px-3 py-2">Hãng tàu</th>
                  <th className="px-3 py-2">Thời gian {label.toLowerCase()}</th>
                  <th className="px-3 py-2 text-right">Số lượng</th>
                  <th className="px-3 py-2 text-right">20'</th>
                  <th className="px-3 py-2 text-right">40'+</th>
                  <th className="px-3 py-2 text-right">{isImport ? 'Đã hạ bãi' : 'Đã xuất'}</th>
                  {isImport && <th className="px-3 py-2 text-right">Chờ hạ</th>}
                  <th className="px-3 py-2 text-right">{isImport ? 'Chờ xe về' : 'Chờ xuất'}</th>
                  <th className="px-3 py-2 text-right">Không kịp</th>
                  <th className="px-3 py-2">Trạng thái</th>
                  <th className="px-3 py-2">Người tạo</th>
                  <th className="px-3 py-2">Người duyệt</th>
                  <th className="px-3 py-2">Duyệt lúc</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {summary.rows.map((r) => (
                  <tr key={r.list.id}>
                    <td className="px-3 py-2 font-semibold"><CellText text={r.list.vesselName} max={CELL_MAX.SHORT} /></td>
                    <td className="px-3 py-2">{r.list.shippingLineCode || '-'}</td>
                    <td className="px-3 py-2 font-mono">{formatDateTime(r.list.plannedAt)}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold">{r.total}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.size20}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.size40}</td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-emerald-700">{r.done}</td>
                    {isImport && <td className="px-3 py-2 text-right font-mono">{r.inspected}</td>}
                    <td className="px-3 py-2 text-right font-mono">{r.pending}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.skipped || '-'}</td>
                    <td className="px-3 py-2"><VesselListStatus list={r.list} /></td>
                    <td className="px-3 py-2"><CellText text={r.list.createdBy} max={CELL_MAX.SHORT} /></td>
                    <td className="px-3 py-2"><CellText text={r.list.approvedBy || '-'} max={CELL_MAX.SHORT} /></td>
                    <td className="px-3 py-2 font-mono">{formatDateTime(r.list.approvedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager page={summary.page} pageCount={summary.pageCount} total={summary.total} onPage={setPage} pageSize={pageSize} onPageSize={setPageSize} />
          </>
        ) : !result || result.total === 0 ? (
          <p className="p-8 text-center text-xs text-ink-muted">Không có dữ liệu phù hợp.</p>
        ) : (
          <>
            <table className="data-table w-full min-w-[960px] whitespace-nowrap text-left text-xs">
              <thead className="border-b border-line bg-canvas text-[11px] uppercase text-ink-muted">
                <tr>
                  <th className="px-3 py-2">Tên tàu</th>
                  <th className="px-3 py-2">Mã hồ sơ</th>
                  <th className="px-3 py-2">Số container</th>
                  <th className="px-3 py-2 text-center">Size</th>
                  <th className="px-3 py-2 text-center">Type</th>
                  <th className="px-3 py-2">Hãng tàu</th>
                  <th className="px-3 py-2">Thời gian {label.toLowerCase()}</th>
                  <th className="px-3 py-2 text-center">Trạng thái</th>
                  <th className="px-3 py-2 text-center">Phân loại</th>
                  <th className="px-3 py-2">Số xe</th>
                  <th className="px-3 py-2">Tiến độ</th>
                  <th className="px-3 py-2">{isImport ? 'Hạ bãi' : 'Xuất'} lúc</th>
                  <th className="px-3 py-2">Duyệt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.rows.map(({ list: l, item: i }) => (
                  <tr key={i.id}>
                    <td className="px-3 py-2 font-semibold"><CellText text={l.vesselName} max={CELL_MAX.SHORT} /></td>
                    <td className="px-3 py-2 font-mono">
                      {i.dossierCode && i.status !== 'PENDING' ? (
                        <button type="button" onClick={() => onOpenDossier?.(i.dossierCode!)} className={linkCls}>{i.dossierCode}</button>
                      ) : (
                        i.dossierCode || '-'
                      )}
                    </td>
                    <td className="px-3 py-2"><ContainerNo no={i.containerNo} /></td>
                    <td className="px-3 py-2 text-center">{i.size}</td>
                    <td className="px-3 py-2 text-center">{i.type}</td>
                    <td className="px-3 py-2">{l.shippingLineCode || '-'}</td>
                    <td className="px-3 py-2 font-mono">{formatDateTime(l.plannedAt)}</td>
                    <td className="px-3 py-2 text-center">{i.conditionClass || '-'}</td>
                    <td className="px-3 py-2 text-center">{i.stuffingClass || '-'}</td>
                    <td className="px-3 py-2">{i.truckNo || '-'}</td>
                    <td className="px-3 py-2">{STATUS[mode][i.status]}</td>
                    <td className="px-3 py-2 font-mono">{formatDateTime(i.doneAt)}</td>
                    <td className="px-3 py-2">{l.status === 'APPROVED' ? <span className="font-bold text-emerald-700">Đã duyệt</span> : <span className="text-ink-muted">Chưa</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pager page={result.page} pageCount={result.pageCount} total={result.total} onPage={setPage} pageSize={pageSize} onPageSize={setPageSize} />
          </>
        )}
      </div>
    </div>
  );
};
