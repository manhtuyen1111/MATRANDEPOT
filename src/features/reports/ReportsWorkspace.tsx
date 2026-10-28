import React, { useState } from 'react';
import { FileSpreadsheet, Search } from 'lucide-react';
import { GateInOrder, GateOutOrder, GateOutType } from '../../types/depot';
import { DepotState, formatVnd } from '../../services/depotStore';
import {
  buildSummaryReport,
  collectAllPages,
  gateInSheet,
  gateOutSheet,
  OperationReportFilter,
  PagedResult,
  queryGateInReport,
  queryGateOutReport,
  SheetData,


} from '../../services/reports';
import { queryRepairReport, RepairReportFilter, RepairReportRow, repairReportSheet } from '../../services/reports';
import { can } from '../../services/permissions';
import { quickRange, fileStamp } from '../../services/datetime';
import { VesselReport } from './VesselReport';
import { useReportState } from '../../components/useReportState';
import { linkCls, DateRangeFilter, ExportExcelButton, Feedback, formatViTime, inputCls, labelCls, Pager, primaryBtn, SectionCard, usePageSize, CellText, CELL_MAX } from '../../components/shared';
import { PaymentInfoCells } from '../../components/PaymentInfoCells';
import { voucherPaymentInfo } from '../../services/payments';

export type ReportSection = 'BC_HA_VO' | 'BC_CAP_VO' | 'BC_NHAP_TAU' | 'BC_XUAT_TAU' | 'BC_SUA_CHUA' | 'BC_TONG_HOP';

interface Props {
  state: DepotState;
  section: ReportSection;
  onOpenDossier: (code: string) => void;
  onOpenReceipt?: (key: string) => void; // DEC-126: mở phiếu thu
}

const TITLES: Record<ReportSection, string> = {
  BC_CAP_VO: 'Báo cáo Cấp vỏ',
  BC_HA_VO: 'Báo cáo Hạ vỏ',
  BC_NHAP_TAU: 'Báo cáo Nhập tàu',
  BC_XUAT_TAU: 'Báo cáo Xuất tàu',
  BC_SUA_CHUA: 'Báo cáo Sửa chữa',
  BC_TONG_HOP: 'Báo cáo Tổng hợp',
};

const SECTION_FILE: Record<ReportSection, string> = {
  BC_HA_VO: 'HA_VO',
  BC_CAP_VO: 'CAP_VO',
  BC_NHAP_TAU: 'NHAP_TAU',
  BC_XUAT_TAU: 'XUAT_TAU',
  BC_SUA_CHUA: 'SUA_CHUA',
  BC_TONG_HOP: 'TONG_HOP',
};

// Toàn bộ kết quả theo bộ lọc của báo cáo tác nghiệp → 1 sheet Excel (DEC-055), cùng cột với báo cáo Tổng hợp
function operationSheet(state: DepotState, section: ReportSection, f: OperationReportFilter): SheetData {
  if (section === 'BC_HA_VO' || section === 'BC_NHAP_TAU') {
    const type = section === 'BC_HA_VO' ? 'CUSTOMER_RETURN' : 'VESSEL_IMPORT';
    return gateInSheet(section === 'BC_HA_VO' ? 'HẠ VỎ' : 'NHẬP TÀU', collectAllPages((p) => queryGateInReport(state, type, f, p)), state);
  }
  const types: GateOutType[] = section === 'BC_CAP_VO' ? ['EMPTY_RELEASE'] : ['VESSEL_EXPORT'];
  return gateOutSheet(section === 'BC_CAP_VO' ? 'CẤP VỎ' : 'XUẤT TÀU', state, collectAllPages((p) => queryGateOutReport(state, types, f, p)));
}

const GATE_IN_STATUS: Record<GateInOrder['status'], string> = {
  FIELD_RECORDED: 'Chờ văn phòng',
  OFFICE_VERIFIED: 'Văn phòng đã kiểm tra',
  PAYMENT_PENDING: 'Chờ thanh toán',
  GATE_IN_OK: 'GATE IN OK',
  CANCELLED: 'Đã hủy',
};

const GATE_OUT_STATUS: Record<GateOutOrder['status'], string> = {
  PAYMENT_PENDING: 'Chờ thanh toán',
  PENDING_FORKLIFT: 'Chờ xe nâng',
  GATE_OUT_OK: 'Đã OUT',
  CANCELLED: 'Đã hủy',
};


export const ReportsWorkspace: React.FC<Props> = ({ state, section, onOpenDossier, onOpenReceipt }) => {
  // key theo section để reset bộ lọc khi đổi báo cáo
  if (section === 'BC_SUA_CHUA') return <RepairReport key={section} state={state} onOpenDossier={onOpenDossier} />;
  if (section === 'BC_NHAP_TAU' || section === 'BC_XUAT_TAU') {
    return <VesselReport key={section} state={state} mode={section === 'BC_NHAP_TAU' ? 'NHAP_TAU' : 'XUAT_TAU'} onOpenDossier={onOpenDossier} />;
  }
  return section === 'BC_TONG_HOP' ? (
    <SummaryReport key={section} state={state} />
  ) : (
    <OperationReport key={section} state={state} section={section} onOpenDossier={onOpenDossier} onOpenReceipt={onOpenReceipt} />
  );
};

const OperationReport: React.FC<Props> = ({ state: live, section, onOpenDossier, onOpenReceipt }) => {
  const report = useReportState(live); // N7: lọc ngoài 90 ngày ở chế độ database → tải riêng
  const state = report.data;
  const [draft, setDraft] = useState<OperationReportFilter>(() => ({ containerNo: '', ...quickRange('TODAY'), shippingLineCode: '', size: '' }));
  const [applied, setApplied] = useState<OperationReportFilter | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize(`report-${section}`, 50); // DEC-080
  const showMoney = can(state.currentUser, 'REPORT_FINANCE');

  let outRows: PagedResult<GateOutOrder> | null = null;
  let inRows: PagedResult<GateInOrder> | null = null;
  let queryError: string | null = null;
  if (applied) {
    const f = { ...applied, shippingLineCode: applied.shippingLineCode || undefined, size: applied.size || undefined };
    try {
      if (section === 'BC_HA_VO') inRows = queryGateInReport(state, 'CUSTOMER_RETURN', f, page, pageSize);
      else if (section === 'BC_NHAP_TAU') inRows = queryGateInReport(state, 'VESSEL_IMPORT', f, page, pageSize);
      else outRows = queryGateOutReport(state, section === 'BC_CAP_VO' ? ['EMPTY_RELEASE'] : ['VESSEL_EXPORT'], f, page, pageSize);
    } catch (err) {
      queryError = err instanceof Error ? err.message : 'Lỗi tra cứu';
    }
  }
  const result = outRows || inRows;

  return (
    <div className="space-y-4">
      <SectionCard title={TITLES[section]} icon={<Search className="h-4 w-4 text-ink-muted" />}>
        <form onSubmit={(e) => { e.preventDefault(); report.run(draft, () => { setApplied({ ...draft }); setPage(1); }); }} className="grid grid-cols-2 gap-2 sm:grid-cols-6">
          <label className="col-span-2">
            <span className={labelCls}>Số container</span>
            <input value={draft.containerNo} onChange={(e) => setDraft({ ...draft, containerNo: e.target.value.toUpperCase() })} className={`${inputCls} font-mono uppercase`} />
          </label>
          <DateRangeFilter value={draft} onChange={(r) => setDraft({ ...draft, ...r })} />
          <label>
            <span className={labelCls}>Hãng tàu</span>
            <select value={draft.shippingLineCode} onChange={(e) => setDraft({ ...draft, shippingLineCode: e.target.value })} className={inputCls}>
              <option value="">Tất cả</option>
              {state.partners.filter((p) => p.isShippingLine).map((p) => <option key={p.id} value={p.code}>{p.code}</option>)}
            </select>
          </label>
          <label>
            <span className={labelCls}>Size</span>
            <select value={draft.size} onChange={(e) => setDraft({ ...draft, size: e.target.value })} className={inputCls}>
              <option value="">Tất cả</option>
              {state.containerSizes.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </label>
          <div className="col-span-2 flex flex-wrap items-center gap-2 sm:col-span-6">
            <button type="submit" className={primaryBtn} disabled={report.loading}>
              <Search className="h-4 w-4" />
              {report.loading ? 'Đang tải…' : 'Tra cứu'}
            </button>
            {applied && result && result.total > 0 && (
              <ExportExcelButton
                fileName={`MATRAN_${SECTION_FILE[section]}_${fileStamp(applied.dateFrom) || applied.containerNo || "tra-cuu"}.xlsx`}
                getSheets={() => [operationSheet(state, section, { ...applied, shippingLineCode: applied.shippingLineCode || undefined, size: applied.size || undefined })]}
              />
            )}
          </div>
        </form>
      </SectionCard>

      <Feedback error={report.loadError} />

      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        {!applied ? (
          <p className="p-8 text-center text-xs text-ink-muted">Nhập số container hoặc chọn khoảng thời gian, sau đó bấm Tra cứu.</p>
        ) : queryError ? (
          <p className="p-6 text-center text-xs text-red-700">{queryError}</p>
        ) : !result || result.total === 0 ? (
          <p className="p-8 text-center text-xs text-ink-muted">Không có dữ liệu phù hợp.</p>
        ) : (
          <>
            {outRows && (
              <table className="data-table w-full min-w-[860px] whitespace-nowrap text-left text-xs">
                <thead className="border-b border-line bg-canvas text-[11px] uppercase text-ink-muted">
                  <tr>
                    <th className="px-3 py-2">Mã hồ sơ</th>
                    <th className="px-3 py-2">Số container</th>
                    <th className="px-3 py-2 text-center">Size</th>
                    <th className="px-3 py-2 text-center">Type</th>
                    <th className="px-3 py-2">Hãng tàu</th>
                    <th className="px-3 py-2">Booking</th>
                    <th className="px-3 py-2">Khách hàng</th>
                    <th className="px-3 py-2">Số xe</th>
                    <th className="px-3 py-2">SĐT lái xe</th>
                    <th className="px-3 py-2">Trạng thái</th>
                    <th className="px-3 py-2">Lập lệnh</th>
                    <th className="px-3 py-2">OUT</th>
                    {showMoney && <th className="px-3 py-2 text-right">Chi phí</th>}
                    <th className="px-3 py-2">Thanh toán</th>
                    <th className="px-3 py-2">Mã phiếu thu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {outRows.rows.map((o) => {
                    const c = state.containers.find((x) => x.masterDossierCode === o.masterDossierCode);
                    return (
                    <tr key={o.id} className="hover:bg-canvas">
                      <td className="px-3 py-2"><button type="button" onClick={() => onOpenDossier(o.gateOutCode)} className={linkCls}>{o.gateOutCode}</button></td>
                      <td className="px-3 py-2 font-mono font-bold">{o.containerNo}</td>
                      <td className="px-3 py-2 text-center">{c?.size || '-'}</td>
                      <td className="px-3 py-2 text-center">{c?.type || '-'}</td>
                      <td className="px-3 py-2">{c?.shippingLineCode || '-'}</td>
                      <td className="px-3 py-2 font-mono">{o.bookingNo}</td>
                      <td className="px-3 py-2"><CellText text={o.receiverRep} max={CELL_MAX.MEDIUM} /></td>
                      <td className="px-3 py-2">{o.truckNo}</td>
                      <td className="px-3 py-2">{o.driverPhone || '-'}</td>
                      <td className="px-3 py-2">{GATE_OUT_STATUS[o.status]}</td>
                      <td className="px-3 py-2">{formatViTime(o.createdAt)}</td>
                      <td className="px-3 py-2">{formatViTime(o.confirmedAt)}</td>
                      {showMoney && <td className="px-3 py-2 text-right font-mono">{formatVnd(o.feeAmount)}</td>}
                      <PaymentInfoCells info={voucherPaymentInfo(state, state.vouchers.find((v) => v.id === o.voucherId))} onOpenReceipt={onOpenReceipt} cellCls="px-3 py-2" />
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
            {inRows && (
              <table className="data-table w-full min-w-[960px] whitespace-nowrap text-left text-xs">
                <thead className="border-b border-line bg-canvas text-[11px] uppercase text-ink-muted">
                  <tr>
                    <th className="px-3 py-2">Mã hồ sơ</th>
                    <th className="px-3 py-2">Số container</th>
                    <th className="px-3 py-2 text-center">Size</th>
                    <th className="px-3 py-2 text-center">Type</th>
                    <th className="px-3 py-2">Hãng tàu</th>
                    <th className="px-3 py-2">Khách hàng</th>
                    <th className="px-3 py-2">Số xe</th>
                    <th className="px-3 py-2">SĐT lái xe</th>
                    <th className="px-3 py-2">Trạng thái cont</th>
                    <th className="px-3 py-2">Hồ sơ</th>
                    <th className="px-3 py-2">Giám định</th>
                    <th className="px-3 py-2">GATE IN OK</th>
                    {showMoney && <th className="px-3 py-2 text-right">Chi phí</th>}
                    <th className="px-3 py-2">Thanh toán</th>
                    <th className="px-3 py-2">Mã phiếu thu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {inRows.rows.map((o) => (
                    <tr key={o.id} className="hover:bg-canvas">
                      <td className="px-3 py-2"><button type="button" onClick={() => onOpenDossier(o.masterDossierCode)} className={linkCls}>{o.masterDossierCode}</button></td>
                      <td className="px-3 py-2 font-mono font-bold">{o.containerNo || '-'}</td>
                      <td className="px-3 py-2 text-center">{o.size || '-'}</td>
                      <td className="px-3 py-2 text-center">{o.type || '-'}</td>
                      <td className="px-3 py-2">{o.shippingLineCode || '-'}</td>
                      <td className="px-3 py-2"><CellText text={o.customerRep} max={CELL_MAX.MEDIUM} /></td>
                      <td className="px-3 py-2">{o.truckNo || '-'}</td>
                      <td className="px-3 py-2">{o.driverPhone || '-'}</td>
                      <td className="px-3 py-2">{o.conditionClass}</td>
                      <td className="px-3 py-2">{GATE_IN_STATUS[o.status]}</td>
                      <td className="px-3 py-2">{formatViTime(o.fieldRecordedAt)}</td>
                      <td className="px-3 py-2">{formatViTime(o.gateInOkAt)}</td>
                      {showMoney && <td className="px-3 py-2 text-right font-mono">{formatVnd(o.feeAmount || 0)}</td>}
                      <PaymentInfoCells info={voucherPaymentInfo(state, state.vouchers.find((v) => v.id === o.voucherId))} onOpenReceipt={onOpenReceipt} cellCls="px-3 py-2" />
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <Pager page={result.page} pageCount={result.pageCount} total={result.total} onPage={setPage} pageSize={pageSize} onPageSize={setPageSize} />
          </>
        )}
      </div>
    </div>
  );
};

const SummaryReport: React.FC<{ state: DepotState }> = ({ state: live }) => {
  const report = useReportState(live);
  const [range, setRange] = useState(() => quickRange('TODAY'));
  const [sheets, setSheets] = useState<SheetData[] | null>(null);
  const [generatedAt, setGeneratedAt] = useState('');
  const [error, setError] = useState<string | null>(null);

  const generate = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    report.run(range, (data) => {
      try {
        setSheets(buildSummaryReport(data, range));
        setGeneratedAt(new Date().toISOString());
      } catch (err) {
        setSheets(null);
        setError(err instanceof Error ? err.message : 'Lỗi tạo báo cáo');
      }
    });
  };

  return (
    <div className="space-y-4">
      <SectionCard title="Báo cáo Tổng hợp" icon={<FileSpreadsheet className="h-4 w-4 text-ink-muted" />}>
        <form onSubmit={generate} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <DateRangeFilter value={range} onChange={(r) => setRange(r)} required />
          <button type="submit" className={primaryBtn} disabled={report.loading}>{report.loading ? 'Đang tải…' : 'Tạo báo cáo'}</button>
        </form>
        <p className="mt-2 text-[11px] text-ink-muted">
          Gồm 5 sheet: HẠ VỎ, CẤP VỎ, XUẤT VỎ, NHẬP VỎ (theo khoảng thời gian) và TỒN VỎ (tại thời điểm lập báo cáo).
        </p>
      </SectionCard>

      <Feedback error={error || report.loadError} />

      {sheets && (
        <SectionCard
          title={`Kết quả — lập lúc ${formatViTime(generatedAt)}`}
          right={
            <ExportExcelButton getSheets={() => sheets} fileName={`MATRAN_TONG_HOP_${fileStamp(range.dateFrom)}_${fileStamp(range.dateTo)}.xlsx`} />
          }
        >
          <ul className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
            {sheets.map((s) => (
              <li key={s.name} className="rounded-md border border-line px-3 py-2">
                <span className="block text-[11px] font-semibold uppercase text-ink-muted">{s.name}</span>
                <span className="text-lg font-bold text-ink">{s.rows.length}</span>
                <span className="text-[11px] text-ink-muted"> dòng • {s.columns.length} cột</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}
    </div>
  );
};

const REPAIR_STATUS: Record<string, string> = {
  OPEN: 'Chờ sửa chữa',
  COMPLETED: 'Đã sửa xong',
  CANCELLED: 'Đã đóng (cấp DAMAGE)',
  IN_PROGRESS: 'Đang sửa',
  REWORK_REQUIRED: 'Làm lại',
};

// BÁO CÁO SỬA CHỮA CHI TIẾT (DEC-044): bắt buộc lọc, phân trang, xuất Excel kết quả lọc
const RepairReport: React.FC<{ state: DepotState; onOpenDossier: (code: string) => void }> = ({ state: live, onOpenDossier }) => {
  const report = useReportState(live);
  const state = report.data;
  const [draft, setDraft] = useState<RepairReportFilter>(() => ({ containerNo: '', ...quickRange('TODAY'), teamCode: '', shippingLineCode: '', status: 'ALL' }));
  const [applied, setApplied] = useState<RepairReportFilter | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize('report-BC_SUA_CHUA', 50); // DEC-080

  const clean = (f: RepairReportFilter): RepairReportFilter => ({
    ...f,
    teamCode: f.teamCode || undefined,
    shippingLineCode: f.shippingLineCode || undefined,
  });
  let result: PagedResult<RepairReportRow> | null = null;
  let queryError: string | null = null;
  if (applied) {
    try {
      result = queryRepairReport(state, clean(applied), page, pageSize);
    } catch (err) {
      queryError = err instanceof Error ? err.message : 'Lỗi tra cứu';
    }
  }

  return (
    <div className="space-y-4">
      <SectionCard title="Báo cáo Sửa chữa" icon={<Search className="h-4 w-4 text-ink-muted" />}>
        <form onSubmit={(e) => { e.preventDefault(); report.run(draft, () => { setApplied({ ...draft }); setPage(1); }); }} className="grid grid-cols-2 gap-2 sm:grid-cols-6">
          <label className="col-span-2 sm:col-span-1">
            <span className={labelCls}>Số container</span>
            <input value={draft.containerNo} onChange={(e) => setDraft({ ...draft, containerNo: e.target.value.toUpperCase() })} className={`${inputCls} font-mono uppercase`} />
          </label>
          <DateRangeFilter value={draft} onChange={(r) => setDraft({ ...draft, ...r })} />
          <label>
            <span className={labelCls}>Tổ sửa chữa</span>
            <select value={draft.teamCode} onChange={(e) => setDraft({ ...draft, teamCode: e.target.value })} className={inputCls}>
              <option value="">Tất cả</option>
              {state.repairTeams.map((t) => <option key={t.id} value={t.code}>{t.code}</option>)}
            </select>
          </label>
          <label>
            <span className={labelCls}>Hãng tàu</span>
            <select value={draft.shippingLineCode} onChange={(e) => setDraft({ ...draft, shippingLineCode: e.target.value })} className={inputCls}>
              <option value="">Tất cả</option>
              {state.partners.filter((p) => p.isShippingLine).map((p) => <option key={p.id} value={p.code}>{p.code}</option>)}
            </select>
          </label>
          <label>
            <span className={labelCls}>Trạng thái</span>
            <select value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value as RepairReportFilter['status'] })} className={inputCls}>
              <option value="ALL">Tất cả</option>
              <option value="OPEN">Chờ sửa chữa</option>
              <option value="COMPLETED">Đã sửa xong</option>
              <option value="CANCELLED">Đã đóng</option>
            </select>
          </label>
          <div className="col-span-2 flex gap-2 sm:col-span-6">
            <button type="submit" className={primaryBtn} disabled={report.loading}>
              <Search className="h-4 w-4" />
              {report.loading ? 'Đang tải…' : 'Tra cứu'}
            </button>
            {result && result.total > 0 && (
              <ExportExcelButton
                getSheets={() => [repairReportSheet(collectAllPages((p) => queryRepairReport(state, clean(applied!), p)))]}
                fileName={`MATRAN_SUA_CHUA_${fileStamp(applied!.dateFrom) || applied!.containerNo || "tra-cuu"}.xlsx`}
              />
            )}
          </div>
        </form>
      </SectionCard>

      <Feedback error={report.loadError} />

      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        {!applied ? (
          <p className="p-8 text-center text-xs text-ink-muted">Nhập số container hoặc chọn khoảng thời gian, sau đó bấm Tra cứu.</p>
        ) : queryError ? (
          <p className="p-6 text-center text-xs text-red-700">{queryError}</p>
        ) : !result || result.total === 0 ? (
          <p className="p-8 text-center text-xs text-ink-muted">Không có dữ liệu phù hợp.</p>
        ) : (
          <>
            <table className="data-table w-full min-w-[960px] whitespace-nowrap text-left text-xs">
              <thead className="border-b border-line bg-canvas text-[11px] uppercase text-ink-muted">
                <tr>
                  <th className="px-3 py-2">Mã hồ sơ</th>
                  <th className="px-3 py-2">Số container</th>
                  <th className="px-3 py-2 text-center">Size</th>
                  <th className="px-3 py-2 text-center">Type</th>
                  <th className="px-3 py-2">Hãng tàu</th>
                  <th className="px-3 py-2">Remark sửa chữa</th>
                  <th className="px-3 py-2 text-right">Giờ công</th>
                  <th className="px-3 py-2">Trạng thái</th>
                  <th className="px-3 py-2">Tổ</th>
                  <th className="px-3 py-2">Nhân viên</th>
                  <th className="px-3 py-2">Báo giá</th>
                  <th className="px-3 py-2">Hoàn tất</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {result.rows.map(({ workOrder: w, container: c }) => (
                  <tr key={w.id} className="hover:bg-canvas">
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => onOpenDossier(w.masterDossierCode)} className={linkCls}>{w.masterDossierCode}</button>
                    </td>
                    <td className="px-3 py-2 font-mono font-bold">{w.containerNo}</td>
                    <td className="px-3 py-2 text-center">{c?.size || '-'}</td>
                    <td className="px-3 py-2 text-center">{c?.type || '-'}</td>
                    <td className="px-3 py-2">{c?.shippingLineCode || '-'}</td>
                    <td className="px-3 py-2"><CellText text={w.items.join(', ')} max={CELL_MAX.LONG} /></td>
                    <td className="px-3 py-2 text-right font-mono">{w.laborHours ?? '-'}</td>
                    <td className="px-3 py-2">{REPAIR_STATUS[w.workStatus] || w.workStatus}</td>
                    <td className="px-3 py-2">{w.repairTeamName || '-'}</td>
                    <td className="px-3 py-2"><CellText text={(w.repairMembers || []).join(', ')} max={CELL_MAX.MEDIUM} /></td>
                    <td className="px-3 py-2">{w.approvedBy || '-'} • {formatViTime(w.createdAt)}</td>
                    <td className="px-3 py-2">{w.completedBy ? `${w.completedBy} • ${formatViTime(w.completedAt)}` : '-'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-line bg-canvas font-semibold">
                  <td colSpan={4} className="px-3 py-2 text-right">Tổng giờ công (trang này)</td>
                  <td className="px-3 py-2 text-right font-mono">{result.rows.reduce((s, r) => s + (r.workOrder.laborHours || 0), 0)}</td>
                  <td colSpan={5} />
                </tr>
              </tfoot>
            </table>
            <Pager page={result.page} pageCount={result.pageCount} total={result.total} onPage={setPage} pageSize={pageSize} onPageSize={setPageSize} />
          </>
        )}
      </div>
    </div>
  );
};
