import React, { useState } from 'react';
import { Search } from 'lucide-react';
import type { GateInOrder } from '../../types/depot';
import type { DepotState } from '../../services/depotStore';
import {
  CLEANING_STATUS_LABELS,
  CleaningReportFilter,
  CleaningReportRow,
  cleaningSheet,
  collectAllPages,
  FORKLIFT_ACTIONS,
  ForkliftReportFilter,
  ForkliftReportRow,
  forkliftSheet,
  INSPECTION_OPERATION_LABELS,
  InspectionReportFilter,
  inspectionSheet,
  LOCATION_ACTION_LABELS,
  queryCleaningReport,
  queryForkliftReport,
  queryInspectionReport,
  visitOperationLabel,
} from '../../services/reports';
import { quickRange, fileStamp } from '../../services/datetime';
import { CONTAINER_SEARCH_HINT } from '../../services/containerSearch';
import { usePagedReport } from '../../components/usePagedReport';
import {
  BlockIcon,
  CELL_MAX,
  CellText,
  DateRangeFilter,
  ExportExcelButton,
  formatViTime,
  inputCls,
  labelCls,
  linkCls,
  Pager,
  PhotoGallery,
  primaryBtn,
  SectionCard,
  usePageSize,
} from '../../components/shared';

// ============================================================================
// BÁO CÁO THEO BỘ PHẬN (DEC-179): GIÁM ĐỊNH / VỆ SINH / XE NÂNG — CHI TIẾT.
// Cùng khuôn báo cáo Sửa chữa: bắt buộc lọc, phân trang (database trả từng trang — usePagedReport), Excel đủ kết quả lọc.
// ============================================================================

interface Props {
  state: DepotState;
  onOpenDossier: (code: string) => void;
}

// Vị trí lưu dạng chữ BLOCK-… → icon định vị thay chữ "BLOCK-" (DEC-136)
const LocText: React.FC<{ text?: string }> = ({ text }) =>
  text && /^BLOCK-/i.test(text) ? (
    <span className="inline-flex items-center gap-0.5 whitespace-nowrap" title={text}>
      <BlockIcon />
      {text.replace(/^BLOCK-/i, '')}
    </span>
  ) : (
    <>{text || '-'}</>
  );

// Khung chung: bộ lọc + nút Tra cứu / Excel + bảng kết quả + phân trang
const ReportFrame: React.FC<{
  title: string;
  filters: React.ReactNode;
  onSubmit: () => void;
  loading: boolean;
  applied: boolean;
  error: string | null;
  total: number;
  excel: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, filters, onSubmit, loading, applied, error, total, excel, children }) => (
  <div className="space-y-4">
    <SectionCard title={title} icon={<Search className="h-4 w-4 text-ink-muted" />}>
      <form onSubmit={(e) => { e.preventDefault(); onSubmit(); }} className="grid grid-cols-2 gap-2 sm:grid-cols-6">
        {filters}
        <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-6">
          <button type="submit" className={primaryBtn} disabled={loading}>
            <Search className="h-4 w-4" />
            {loading ? 'Đang tải…' : 'Tra cứu'}
          </button>
          {applied && total > 0 && excel}
        </div>
      </form>
    </SectionCard>
    <div className="overflow-x-auto rounded-lg border border-line bg-white">
      {!applied ? (
        <p className="p-8 text-center text-xs text-ink-muted">Nhập số container hoặc chọn khoảng thời gian, sau đó bấm Tra cứu.</p>
      ) : error ? (
        <p className="p-6 text-center text-xs text-red-700">{error}</p>
      ) : loading ? (
        <p className="p-8 text-center text-xs text-ink-muted">Đang tải…</p>
      ) : total === 0 ? (
        <p className="p-8 text-center text-xs text-ink-muted">Không có dữ liệu phù hợp.</p>
      ) : (
        children
      )}
    </div>
  </div>
);

const ContainerField: React.FC<{ value: string; onChange: (v: string) => void }> = ({ value, onChange }) => (
  <label className="col-span-2 sm:col-span-1">
    <span className={labelCls}>Số container</span>
    <input value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} placeholder={CONTAINER_SEARCH_HINT} className={`${inputCls} font-mono uppercase`} />
  </label>
);

const LineField: React.FC<{ state: DepotState; value: string; onChange: (v: string) => void }> = ({ state, value, onChange }) => (
  <label>
    <span className={labelCls}>Hãng tàu</span>
    <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
      <option value="">Tất cả</option>
      {state.partners.filter((p) => p.isShippingLine).map((p) => <option key={p.id} value={p.code}>{p.code}</option>)}
    </select>
  </label>
);

const TH: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => <th className={`px-3 py-2 ${className}`}>{children}</th>;
const head = 'border-b border-line bg-canvas text-[11px] uppercase text-ink-muted';
const tableCls = 'data-table w-full whitespace-nowrap text-left text-xs';

// ---------------------------------------------------------------------------
// GIÁM ĐỊNH — CHI TIẾT
// ---------------------------------------------------------------------------
export const InspectionReport: React.FC<Props> = ({ state: live, onOpenDossier }) => {
  const [draft, setDraft] = useState<InspectionReportFilter>(() => ({ containerNo: '', ...quickRange('TODAY'), shippingLineCode: '', operation: '', condition: '' }));
  const [applied, setApplied] = useState<InspectionReportFilter | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize('report-BC_GD_CHI_TIET', 50);
  const filter = applied && { ...applied, shippingLineCode: applied.shippingLineCode || undefined, operation: applied.operation || undefined, condition: applied.condition || undefined };
  const paged = usePagedReport<GateInOrder>(live, 'GIAM_DINH', filter, page, pageSize, (s, p, size) => queryInspectionReport(s, filter!, p, size));
  const result = paged.result;

  return (
    <ReportFrame
      title="Báo cáo Giám định — Chi tiết"
      onSubmit={() => { setApplied({ ...draft }); setPage(1); }}
      loading={paged.loading}
      applied={Boolean(applied)}
      error={paged.error}
      total={result?.total || 0}
      excel={
        <ExportExcelButton
          fileName={`MATRAN_GIAM_DINH_${fileStamp(applied?.dateFrom) || applied?.containerNo || 'tra-cuu'}.xlsx`}
          getSheets={async () => {
            const all = await paged.exportState();
            return [inspectionSheet(collectAllPages((p, size) => queryInspectionReport(all, filter!, p, size)))];
          }}
        />
      }
      filters={
        <>
          <ContainerField value={draft.containerNo || ''} onChange={(v) => setDraft({ ...draft, containerNo: v })} />
          <DateRangeFilter value={draft} onChange={(r) => setDraft({ ...draft, ...r })} />
          <LineField state={live} value={draft.shippingLineCode || ''} onChange={(v) => setDraft({ ...draft, shippingLineCode: v })} />
          <label>
            <span className={labelCls}>Tác nghiệp</span>
            <select value={draft.operation} onChange={(e) => setDraft({ ...draft, operation: e.target.value as InspectionReportFilter['operation'] })} className={inputCls}>
              <option value="">Tất cả</option>
              <option value="CUSTOMER_RETURN">Hạ vỏ</option>
              <option value="VESSEL_IMPORT">Nhập tàu</option>
            </select>
          </label>
          <label>
            <span className={labelCls}>Trạng thái</span>
            <select value={draft.condition} onChange={(e) => setDraft({ ...draft, condition: e.target.value })} className={inputCls}>
              <option value="">Tất cả</option>
              <option value="AV">AV</option>
              <option value="DAMAGE">DAMAGE</option>
              <option value="W-SURVEY">W-SURVEY</option>
            </select>
          </label>
        </>
      }
    >
      {result && (
        <>
          <table className={`${tableCls} min-w-[1100px]`}>
            <thead className={head}>
              <tr>
                <TH>Mã hồ sơ</TH><TH>Số container</TH><TH className="text-center">Size</TH><TH className="text-center">Type</TH><TH>Hãng tàu</TH>
                <TH>Tác nghiệp</TH><TH>Trạng thái</TH><TH>Ghi chú hư hỏng</TH><TH>Đóng hàng</TH><TH>AGE</TH><TH>Giám định</TH><TH>Thời gian</TH><TH>Ảnh</TH>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {result.rows.map((o) => (
                <tr key={o.id} className="hover:bg-canvas">
                  <td className="px-3 py-2"><button type="button" onClick={() => onOpenDossier(o.masterDossierCode)} className={linkCls}>{o.masterDossierCode}</button></td>
                  <td className="px-3 py-2 font-mono font-bold">{o.containerNo || '-'}</td>
                  <td className="px-3 py-2 text-center">{o.size || '-'}</td>
                  <td className="px-3 py-2 text-center">{o.type || '-'}</td>
                  <td className="px-3 py-2">{o.shippingLineCode || '-'}</td>
                  <td className="px-3 py-2">{INSPECTION_OPERATION_LABELS[o.gateInType]}</td>
                  <td className="px-3 py-2 font-semibold">{o.conditionClass}</td>
                  <td className="px-3 py-2"><CellText text={o.damageRemarks.join(', ')} max={CELL_MAX.MEDIUM} /></td>
                  <td className="px-3 py-2">{o.stuffingClass || '-'}</td>
                  <td className="px-3 py-2">{o.manufactureYear || '-'}</td>
                  <td className="px-3 py-2"><CellText text={o.fieldStaffName} max={CELL_MAX.SHORT} /></td>
                  <td className="px-3 py-2">{formatViTime(o.fieldRecordedAt)}</td>
                  {/* DEC-178: ảnh chỉ tải khi bấm XEM ẢNH */}
                  <td className="px-3 py-2"><PhotoGallery photos={[o.doorPhotoUrl]} alt={`Ảnh cửa ${o.containerNo || o.masterDossierCode}`} className="h-7 w-10" /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={result.page} pageCount={result.pageCount} total={result.total} onPage={setPage} pageSize={pageSize} onPageSize={setPageSize} />
        </>
      )}
    </ReportFrame>
  );
};

// ---------------------------------------------------------------------------
// VỆ SINH — CHI TIẾT
// ---------------------------------------------------------------------------
export const CleaningReport: React.FC<Props> = ({ state: live, onOpenDossier }) => {
  const [draft, setDraft] = useState<CleaningReportFilter>(() => ({ containerNo: '', ...quickRange('TODAY'), shippingLineCode: '', status: 'ALL' }));
  const [applied, setApplied] = useState<CleaningReportFilter | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize('report-BC_VS_CHI_TIET', 50);
  const filter = applied && { ...applied, shippingLineCode: applied.shippingLineCode || undefined };
  const paged = usePagedReport<CleaningReportRow>(live, 'VE_SINH', filter, page, pageSize, (s, p, size) => queryCleaningReport(s, filter!, p, size));
  const result = paged.result;

  return (
    <ReportFrame
      title="Báo cáo Vệ sinh — Chi tiết"
      onSubmit={() => { setApplied({ ...draft }); setPage(1); }}
      loading={paged.loading}
      applied={Boolean(applied)}
      error={paged.error}
      total={result?.total || 0}
      excel={
        <ExportExcelButton
          fileName={`MATRAN_VE_SINH_${fileStamp(applied?.dateFrom) || applied?.containerNo || 'tra-cuu'}.xlsx`}
          getSheets={async () => {
            const all = await paged.exportState();
            return [cleaningSheet(collectAllPages((p, size) => queryCleaningReport(all, filter!, p, size)))];
          }}
        />
      }
      filters={
        <>
          <ContainerField value={draft.containerNo || ''} onChange={(v) => setDraft({ ...draft, containerNo: v })} />
          <DateRangeFilter value={draft} onChange={(r) => setDraft({ ...draft, ...r })} />
          <LineField state={live} value={draft.shippingLineCode || ''} onChange={(v) => setDraft({ ...draft, shippingLineCode: v })} />
          <label>
            <span className={labelCls}>Trạng thái</span>
            <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as CleaningReportFilter['status'] })} className={inputCls}>
              <option value="ALL">Tất cả</option>
              <option value="OPEN">Chờ vệ sinh</option>
              <option value="COMPLETED">Đã vệ sinh</option>
            </select>
          </label>
        </>
      }
    >
      {result && (
        <>
          <table className={`${tableCls} min-w-[960px]`}>
            <thead className={head}>
              <tr>
                <TH>Mã hồ sơ</TH><TH>Số container</TH><TH className="text-center">Size</TH><TH className="text-center">Type</TH><TH>Hãng tàu</TH>
                <TH>Tác nghiệp</TH><TH>Hạng mục vệ sinh</TH><TH>Trạng thái</TH><TH>Người làm</TH><TH>Hoàn tất lúc</TH>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {result.rows.map(({ workOrder: w, container: c }) => (
                <tr key={w.id} className="hover:bg-canvas">
                  <td className="px-3 py-2"><button type="button" onClick={() => onOpenDossier(w.masterDossierCode)} className={linkCls}>{w.masterDossierCode}</button></td>
                  <td className="px-3 py-2 font-mono font-bold">{w.containerNo}</td>
                  <td className="px-3 py-2 text-center">{c?.size || '-'}</td>
                  <td className="px-3 py-2 text-center">{c?.type || '-'}</td>
                  <td className="px-3 py-2">{c?.shippingLineCode || '-'}</td>
                  <td className="px-3 py-2">{visitOperationLabel(w.masterDossierCode)}</td>
                  <td className="px-3 py-2"><CellText text={w.items.join(' + ')} max={CELL_MAX.LONG} /></td>
                  <td className="px-3 py-2">{CLEANING_STATUS_LABELS[w.workStatus] || w.workStatus}</td>
                  <td className="px-3 py-2"><CellText text={w.completedBy} max={CELL_MAX.SHORT} /></td>
                  <td className="px-3 py-2">{formatViTime(w.completedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={result.page} pageCount={result.pageCount} total={result.total} onPage={setPage} pageSize={pageSize} onPageSize={setPageSize} />
        </>
      )}
    </ReportFrame>
  );
};

// ---------------------------------------------------------------------------
// XE NÂNG — CHI TIẾT (lịch sử vị trí)
// ---------------------------------------------------------------------------
export const ForkliftReport: React.FC<Props> = ({ state: live, onOpenDossier }) => {
  const [draft, setDraft] = useState<ForkliftReportFilter>(() => ({ containerNo: '', ...quickRange('TODAY'), action: '' }));
  const [applied, setApplied] = useState<ForkliftReportFilter | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize('report-BC_XN_CHI_TIET', 50);
  const filter = applied && { ...applied, action: applied.action || undefined };
  const paged = usePagedReport<ForkliftReportRow>(live, 'XE_NANG', filter, page, pageSize, (s, p, size) => queryForkliftReport(s, filter!, p, size));
  const result = paged.result;

  return (
    <ReportFrame
      title="Báo cáo Xe nâng — Chi tiết"
      onSubmit={() => { setApplied({ ...draft }); setPage(1); }}
      loading={paged.loading}
      applied={Boolean(applied)}
      error={paged.error}
      total={result?.total || 0}
      excel={
        <ExportExcelButton
          fileName={`MATRAN_XE_NANG_${fileStamp(applied?.dateFrom) || applied?.containerNo || 'tra-cuu'}.xlsx`}
          getSheets={async () => {
            const all = await paged.exportState();
            return [forkliftSheet(collectAllPages((p, size) => queryForkliftReport(all, filter!, p, size)))];
          }}
        />
      }
      filters={
        <>
          <ContainerField value={draft.containerNo || ''} onChange={(v) => setDraft({ ...draft, containerNo: v })} />
          <DateRangeFilter value={draft} onChange={(r) => setDraft({ ...draft, ...r })} />
          <label>
            <span className={labelCls}>Loại</span>
            <select value={draft.action} onChange={(e) => setDraft({ ...draft, action: e.target.value as ForkliftReportFilter['action'] })} className={inputCls}>
              <option value="">Tất cả</option>
              {FORKLIFT_ACTIONS.map((a) => <option key={a} value={a}>{LOCATION_ACTION_LABELS[a]}</option>)}
            </select>
          </label>
        </>
      }
    >
      {result && (
        <>
          <table className={`${tableCls} min-w-[1000px]`}>
            <thead className={head}>
              <tr>
                <TH>Mã hồ sơ</TH><TH>Số container</TH><TH className="text-center">Size</TH><TH className="text-center">Type</TH><TH>Hãng tàu</TH>
                <TH>Loại</TH><TH>Vị trí cũ</TH><TH>Vị trí mới</TH><TH>Người lái</TH><TH>Thời gian</TH><TH>Ghi chú</TH>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {result.rows.map(({ item: h, container: c }) => (
                <tr key={h.id} className="hover:bg-canvas">
                  <td className="px-3 py-2"><button type="button" onClick={() => onOpenDossier(h.masterDossierCode)} className={linkCls}>{h.masterDossierCode}</button></td>
                  <td className="px-3 py-2 font-mono font-bold">{h.containerNo}</td>
                  <td className="px-3 py-2 text-center">{c?.size || '-'}</td>
                  <td className="px-3 py-2 text-center">{c?.type || '-'}</td>
                  <td className="px-3 py-2">{c?.shippingLineCode || '-'}</td>
                  <td className="px-3 py-2">{LOCATION_ACTION_LABELS[h.actionType] || h.actionType}</td>
                  <td className="px-3 py-2"><LocText text={h.fromLocation} /></td>
                  <td className="px-3 py-2"><LocText text={h.toLocation} /></td>
                  <td className="px-3 py-2"><CellText text={h.performedBy} max={CELL_MAX.SHORT} /></td>
                  <td className="px-3 py-2">{formatViTime(h.performedAt)}</td>
                  <td className="px-3 py-2"><CellText text={h.reason} max={CELL_MAX.MEDIUM} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pager page={result.page} pageCount={result.pageCount} total={result.total} onPage={setPage} pageSize={pageSize} onPageSize={setPageSize} />
        </>
      )}
    </ReportFrame>
  );
};
