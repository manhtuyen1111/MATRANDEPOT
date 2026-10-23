import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { VesselMode, VESSEL_MODE_LABELS } from '../../types/depot';
import { DepotState } from '../../services/depotStore';
import { collectAllPages, queryVesselReport, VesselReportFilter, vesselReportSheet } from '../../services/reports';
import { defaultLastDayRange, fileStamp, formatDateTime } from '../../services/datetime';
import { ContainerNo, DateTimeField, ExportExcelButton, inputCls, labelCls, Pager, primaryBtn, SectionCard, usePageSize } from '../../components/shared';

const STATUS: Record<VesselMode, Record<string, string>> = {
  NHAP_TAU: { PENDING: 'Chờ xe về', INSPECTED: 'Đã giám định — chờ hạ', DONE: 'Đã hạ bãi' },
  XUAT_TAU: { PENDING: 'Chờ xuất', INSPECTED: '-', DONE: 'Đã xuất tàu' },
};

// BÁO CÁO NHẬP TÀU / XUẤT TÀU (DEC-069): lọc theo thời gian nhập / xuất tàu, tên tàu, số cont
export const VesselReport: React.FC<{ state: DepotState; mode: VesselMode; onOpenDossier?: (code: string) => void }> = ({ state, mode, onOpenDossier }) => {
  const isImport = mode === 'NHAP_TAU';
  const label = VESSEL_MODE_LABELS[mode];
  const [draft, setDraft] = useState<VesselReportFilter>(() => ({ containerNo: '', vesselName: '', ...defaultLastDayRange() }));
  const [applied, setApplied] = useState<VesselReportFilter | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize(`report-${mode}`, 50); // DEC-080

  let result: ReturnType<typeof queryVesselReport> | null = null;
  let queryError: string | null = null;
  if (applied) {
    try {
      result = queryVesselReport(state, mode, applied, page, pageSize);
    } catch (err) {
      queryError = err instanceof Error ? err.message : 'Lỗi tra cứu';
    }
  }

  return (
    <div className="space-y-4">
      <SectionCard title={`Báo cáo ${isImport ? 'Nhập tàu' : 'Xuất tàu'}`} icon={<Search className="h-4 w-4 text-slate-500" />}>
        <form onSubmit={(e) => { e.preventDefault(); setApplied({ ...draft }); setPage(1); }} className="grid grid-cols-2 gap-2 sm:grid-cols-6">
          <label className="col-span-2 sm:col-span-1">
            <span className={labelCls}>Số container</span>
            <input value={draft.containerNo} onChange={(e) => setDraft({ ...draft, containerNo: e.target.value.toUpperCase() })} className={`${inputCls} font-mono uppercase`} />
          </label>
          <label className="col-span-2 sm:col-span-1">
            <span className={labelCls}>Tên tàu</span>
            <input value={draft.vesselName} onChange={(e) => setDraft({ ...draft, vesselName: e.target.value.toUpperCase() })} className={`${inputCls} uppercase`} />
          </label>
          <DateTimeField label={`Thời gian ${label.toLowerCase()} từ`} value={draft.dateFrom || ''} onChange={(v) => setDraft({ ...draft, dateFrom: v })} />
          <DateTimeField label="Đến" value={draft.dateTo || ''} onChange={(v) => setDraft({ ...draft, dateTo: v })} fallback="end" />
          <div className="col-span-2 flex flex-wrap items-end gap-2">
            <button type="submit" className={primaryBtn}>
              <Search className="h-4 w-4" />
              Tra cứu
            </button>
            {applied && result && result.total > 0 && (
              <ExportExcelButton
                fileName={`MATRAN_${mode}_${fileStamp(applied.dateFrom) || applied.vesselName || applied.containerNo || 'tra-cuu'}.xlsx`}
                getSheets={() => [vesselReportSheet(mode, collectAllPages((p) => queryVesselReport(state, mode, applied, p)))]}
              />
            )}
          </div>
        </form>
      </SectionCard>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        {!applied ? (
          <p className="p-8 text-center text-xs text-slate-500">Nhập số container / tên tàu hoặc chọn khoảng thời gian, sau đó bấm Tra cứu.</p>
        ) : queryError ? (
          <p className="p-6 text-center text-xs text-red-700">{queryError}</p>
        ) : !result || result.total === 0 ? (
          <p className="p-8 text-center text-xs text-slate-500">Không có dữ liệu phù hợp.</p>
        ) : (
          <>
            <table className="w-full min-w-[960px] text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2">Tàu</th>
                  <th className="px-3 py-2">Thời gian {label.toLowerCase()}</th>
                  <th className="px-3 py-2">Mã hồ sơ</th>
                  <th className="px-3 py-2">Số container</th>
                  <th className="px-3 py-2">Size/Type</th>
                  <th className="px-3 py-2">Trạng thái • Phân loại</th>
                  <th className="px-3 py-2">Số xe</th>
                  <th className="px-3 py-2">Tiến độ</th>
                  <th className="px-3 py-2">{isImport ? 'Hạ bãi' : 'Xuất'} lúc</th>
                  <th className="px-3 py-2">Duyệt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.rows.map(({ list: l, item: i }) => (
                  <tr key={i.id}>
                    <td className="px-3 py-2 font-semibold">{l.vesselName}{l.shippingLineCode ? ` (${l.shippingLineCode})` : ''}</td>
                    <td className="px-3 py-2 font-mono">{formatDateTime(l.plannedAt)}</td>
                    <td className="px-3 py-2 font-mono">
                      {i.dossierCode && i.status !== 'PENDING' ? (
                        <button type="button" onClick={() => onOpenDossier?.(i.dossierCode!)} className="text-blue-700 hover:underline">{i.dossierCode}</button>
                      ) : (
                        i.dossierCode || '-'
                      )}
                    </td>
                    <td className="px-3 py-2"><ContainerNo no={i.containerNo} /></td>
                    <td className="px-3 py-2">{i.size}/{i.type}</td>
                    <td className="px-3 py-2">{i.conditionClass ? `${i.conditionClass} • ${i.stuffingClass || '-'}` : '-'}</td>
                    <td className="px-3 py-2">{i.truckNo || '-'}</td>
                    <td className="px-3 py-2">{STATUS[mode][i.status]}</td>
                    <td className="px-3 py-2 font-mono">{formatDateTime(i.doneAt)}</td>
                    <td className="px-3 py-2">{l.status === 'APPROVED' ? <span className="font-bold text-emerald-700">Đã duyệt</span> : <span className="text-slate-500">Chưa</span>}</td>
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
