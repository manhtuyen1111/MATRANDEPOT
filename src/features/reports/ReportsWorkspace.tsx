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
import { fileStamp } from '../../services/datetime';
import { DateTimeField, ExportExcelButton, Feedback, formatViTime, inputCls, labelCls, Pager, primaryBtn, SectionCard } from '../../components/shared';

export type ReportSection = 'BC_HA_VO' | 'BC_CAP_VO' | 'BC_NHAP_TAU' | 'BC_XUAT_TAU' | 'BC_SUA_CHUA' | 'BC_TONG_HOP';

interface Props {
  state: DepotState;
  section: ReportSection;
  onOpenDossier: (code: string) => void;
}

const TITLES: Record<ReportSection, string> = {
  BC_CAP_VO: 'Báo cáo Cấp vỏ',
  BC_HA_VO: 'Báo cáo Hạ vỏ',
  BC_NHAP_TAU: 'Báo cáo Nhập tàu',
  BC_XUAT_TAU: 'Báo cáo Xuất tàu',
  BC_SUA_CHUA: 'Báo cáo Sửa chữa chi tiết',
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
    return gateInSheet(section === 'BC_HA_VO' ? 'HẠ VỎ' : 'NHẬP TÀU', collectAllPages((p) => queryGateInReport(state, type, f, p)));
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

export const ReportsWorkspace: React.FC<Props> = ({ state, section, onOpenDossier }) => {
  // key theo section để reset bộ lọc khi đổi báo cáo
  if (section === 'BC_SUA_CHUA') return <RepairReport key={section} state={state} onOpenDossier={onOpenDossier} />;
  return section === 'BC_TONG_HOP' ? (
    <SummaryReport key={section} state={state} />
  ) : (
    <OperationReport key={section} state={state} section={section} onOpenDossier={onOpenDossier} />
  );
};

const OperationReport: React.FC<Props> = ({ state, section, onOpenDossier }) => {
  const [draft, setDraft] = useState<OperationReportFilter>({ containerNo: '', dateFrom: '', dateTo: '', shippingLineCode: '', size: '' });
  const [applied, setApplied] = useState<OperationReportFilter | null>(null);
  const [page, setPage] = useState(1);
  const showMoney = can(state.currentUser, 'REPORT_FINANCE');

  let outRows: PagedResult<GateOutOrder> | null = null;
  let inRows: PagedResult<GateInOrder> | null = null;
  let queryError: string | null = null;
  if (applied) {
    const f = { ...applied, shippingLineCode: applied.shippingLineCode || undefined, size: applied.size || undefined };
    try {
      if (section === 'BC_HA_VO') inRows = queryGateInReport(state, 'CUSTOMER_RETURN', f, page);
      else if (section === 'BC_NHAP_TAU') inRows = queryGateInReport(state, 'VESSEL_IMPORT', f, page);
      else outRows = queryGateOutReport(state, section === 'BC_CAP_VO' ? ['EMPTY_RELEASE'] : ['VESSEL_EXPORT'], f, page);
    } catch (err) {
      queryError = err instanceof Error ? err.message : 'Lỗi tra cứu';
    }
  }
  const result = outRows || inRows;

  return (
    <div className="space-y-4">
      <SectionCard title={TITLES[section]} icon={<Search className="h-4 w-4 text-slate-500" />}>
        {(section === 'BC_NHAP_TAU' || section === 'BC_XUAT_TAU') && (
          <p className="mb-3 text-[11px] text-slate-500">Phân hệ {section === 'BC_NHAP_TAU' ? 'Nhập tàu' : 'Xuất tàu'} sẽ xây dựng ở giai đoạn sau; báo cáo hiển thị dữ liệu khi phân hệ đi vào sử dụng.</p>
        )}
        <form onSubmit={(e) => { e.preventDefault(); setApplied({ ...draft }); setPage(1); }} className="grid grid-cols-2 gap-2 sm:grid-cols-6">
          <label className="col-span-2">
            <span className={labelCls}>Số container</span>
            <input value={draft.containerNo} onChange={(e) => setDraft({ ...draft, containerNo: e.target.value.toUpperCase() })} className={`${inputCls} font-mono uppercase`} />
          </label>
          <DateTimeField label="Từ (dd/mm/yyyy hh:mm:ss)" value={draft.dateFrom || ''} onChange={(v) => setDraft({ ...draft, dateFrom: v })} />
          <DateTimeField label="Đến (dd/mm/yyyy hh:mm:ss)" value={draft.dateTo || ''} onChange={(v) => setDraft({ ...draft, dateTo: v })} fallback="end" />
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
            <button type="submit" className={primaryBtn}>
              <Search className="h-4 w-4" />
              Tra cứu
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

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        {!applied ? (
          <p className="p-8 text-center text-xs text-slate-500">Nhập số container hoặc chọn khoảng thời gian, sau đó bấm Tra cứu.</p>
        ) : queryError ? (
          <p className="p-6 text-center text-xs text-red-700">{queryError}</p>
        ) : !result || result.total === 0 ? (
          <p className="p-8 text-center text-xs text-slate-500">Không có dữ liệu phù hợp.</p>
        ) : (
          <>
            {outRows && (
              <table className="w-full min-w-[860px] text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Mã hồ sơ</th>
                    <th className="px-3 py-2">Số container</th>
                    <th className="px-3 py-2">Booking</th>
                    <th className="px-3 py-2">Khách hàng</th>
                    <th className="px-3 py-2">Số xe</th>
                    <th className="px-3 py-2">SĐT lái xe</th>
                    <th className="px-3 py-2">Trạng thái</th>
                    <th className="px-3 py-2">Lập lệnh</th>
                    <th className="px-3 py-2">OUT</th>
                    {showMoney && <th className="px-3 py-2 text-right">Chi phí</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {outRows.rows.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2"><button type="button" onClick={() => onOpenDossier(o.gateOutCode)} className="font-mono text-blue-700 hover:underline">{o.gateOutCode}</button></td>
                      <td className="px-3 py-2 font-mono font-bold">{o.containerNo}</td>
                      <td className="px-3 py-2 font-mono">{o.bookingNo}</td>
                      <td className="px-3 py-2">{o.receiverRep}</td>
                      <td className="px-3 py-2">{o.truckNo}</td>
                      <td className="px-3 py-2">{o.driverPhone || '-'}</td>
                      <td className="px-3 py-2">{GATE_OUT_STATUS[o.status]}</td>
                      <td className="px-3 py-2">{formatViTime(o.createdAt)}</td>
                      <td className="px-3 py-2">{formatViTime(o.confirmedAt)}</td>
                      {showMoney && <td className="px-3 py-2 text-right font-mono">{formatVnd(o.feeAmount)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {inRows && (
              <table className="w-full min-w-[960px] text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Mã hồ sơ</th>
                    <th className="px-3 py-2">Số container</th>
                    <th className="px-3 py-2">Size/Type</th>
                    <th className="px-3 py-2">Hãng tàu</th>
                    <th className="px-3 py-2">Khách hàng</th>
                    <th className="px-3 py-2">Số xe</th>
                    <th className="px-3 py-2">SĐT lái xe</th>
                    <th className="px-3 py-2">Trạng thái cont</th>
                    <th className="px-3 py-2">Hồ sơ</th>
                    <th className="px-3 py-2">Giám định</th>
                    <th className="px-3 py-2">GATE IN OK</th>
                    {showMoney && <th className="px-3 py-2 text-right">Chi phí</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inRows.rows.map((o) => (
                    <tr key={o.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2"><button type="button" onClick={() => onOpenDossier(o.masterDossierCode)} className="font-mono text-blue-700 hover:underline">{o.masterDossierCode}</button></td>
                      <td className="px-3 py-2 font-mono font-bold">{o.containerNo || '-'}</td>
                      <td className="px-3 py-2">{o.size || '-'}/{o.type || '-'}</td>
                      <td className="px-3 py-2">{o.shippingLineCode || '-'}</td>
                      <td className="px-3 py-2">{o.customerRep || '-'}</td>
                      <td className="px-3 py-2">{o.truckNo || '-'}</td>
                      <td className="px-3 py-2">{o.driverPhone || '-'}</td>
                      <td className="px-3 py-2">{o.conditionClass}</td>
                      <td className="px-3 py-2">{GATE_IN_STATUS[o.status]}</td>
                      <td className="px-3 py-2">{formatViTime(o.fieldRecordedAt)}</td>
                      <td className="px-3 py-2">{formatViTime(o.gateInOkAt)}</td>
                      {showMoney && <td className="px-3 py-2 text-right font-mono">{formatVnd(o.feeAmount || 0)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <Pager page={result.page} pageCount={result.pageCount} total={result.total} onPage={setPage} />
          </>
        )}
      </div>
    </div>
  );
};

const SummaryReport: React.FC<{ state: DepotState }> = ({ state }) => {
  const [range, setRange] = useState({ dateFrom: '', dateTo: '' });
  const [sheets, setSheets] = useState<SheetData[] | null>(null);
  const [generatedAt, setGeneratedAt] = useState('');
  const [error, setError] = useState<string | null>(null);

  const generate = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      setSheets(buildSummaryReport(state, range));
      setGeneratedAt(new Date().toISOString());
    } catch (err) {
      setSheets(null);
      setError(err instanceof Error ? err.message : 'Lỗi tạo báo cáo');
    }
  };

  return (
    <div className="space-y-4">
      <SectionCard title="Báo cáo Tổng hợp" icon={<FileSpreadsheet className="h-4 w-4 text-slate-500" />}>
        <form onSubmit={generate} className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <DateTimeField label="Từ (dd/mm/yyyy hh:mm:ss) *" value={range.dateFrom || ''} onChange={(v) => setRange({ ...range, dateFrom: v })} />
          <DateTimeField label="Đến (dd/mm/yyyy hh:mm:ss) *" value={range.dateTo || ''} onChange={(v) => setRange({ ...range, dateTo: v })} fallback="end" />
          <button type="submit" className={primaryBtn}>Tạo báo cáo</button>
        </form>
        <p className="mt-2 text-[11px] text-slate-500">
          Gồm 5 sheet: HẠ VỎ, CẤP VỎ, XUẤT VỎ, NHẬP VỎ (theo khoảng thời gian) và TỒN VỎ (tại thời điểm lập báo cáo).
        </p>
      </SectionCard>

      <Feedback error={error} />

      {sheets && (
        <SectionCard
          title={`Kết quả — lập lúc ${formatViTime(generatedAt)}`}
          right={
            <ExportExcelButton getSheets={() => sheets} fileName={`MATRAN_TONG_HOP_${fileStamp(range.dateFrom)}_${fileStamp(range.dateTo)}.xlsx`} />
          }
        >
          <ul className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
            {sheets.map((s) => (
              <li key={s.name} className="rounded-md border border-slate-200 px-3 py-2">
                <span className="block text-[11px] font-semibold uppercase text-slate-500">{s.name}</span>
                <span className="text-lg font-bold text-slate-900">{s.rows.length}</span>
                <span className="text-[11px] text-slate-500"> dòng • {s.columns.length} cột</span>
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
const RepairReport: React.FC<{ state: DepotState; onOpenDossier: (code: string) => void }> = ({ state, onOpenDossier }) => {
  const [draft, setDraft] = useState<RepairReportFilter>({ containerNo: '', dateFrom: '', dateTo: '', teamCode: '', shippingLineCode: '', status: 'ALL' });
  const [applied, setApplied] = useState<RepairReportFilter | null>(null);
  const [page, setPage] = useState(1);

  const clean = (f: RepairReportFilter): RepairReportFilter => ({
    ...f,
    teamCode: f.teamCode || undefined,
    shippingLineCode: f.shippingLineCode || undefined,
  });
  let result: PagedResult<RepairReportRow> | null = null;
  let queryError: string | null = null;
  if (applied) {
    try {
      result = queryRepairReport(state, clean(applied), page);
    } catch (err) {
      queryError = err instanceof Error ? err.message : 'Lỗi tra cứu';
    }
  }

  return (
    <div className="space-y-4">
      <SectionCard title="Báo cáo Sửa chữa chi tiết" icon={<Search className="h-4 w-4 text-slate-500" />}>
        <form onSubmit={(e) => { e.preventDefault(); setApplied({ ...draft }); setPage(1); }} className="grid grid-cols-2 gap-2 sm:grid-cols-6">
          <label className="col-span-2 sm:col-span-1">
            <span className={labelCls}>Số container</span>
            <input value={draft.containerNo} onChange={(e) => setDraft({ ...draft, containerNo: e.target.value.toUpperCase() })} className={`${inputCls} font-mono uppercase`} />
          </label>
          <DateTimeField label="Từ (dd/mm/yyyy hh:mm:ss)" value={draft.dateFrom || ''} onChange={(v) => setDraft({ ...draft, dateFrom: v })} />
          <DateTimeField label="Đến (dd/mm/yyyy hh:mm:ss)" value={draft.dateTo || ''} onChange={(v) => setDraft({ ...draft, dateTo: v })} fallback="end" />
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
            <button type="submit" className={primaryBtn}>
              <Search className="h-4 w-4" />
              Tra cứu
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

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        {!applied ? (
          <p className="p-8 text-center text-xs text-slate-500">Nhập số container hoặc chọn khoảng thời gian, sau đó bấm Tra cứu.</p>
        ) : queryError ? (
          <p className="p-6 text-center text-xs text-red-700">{queryError}</p>
        ) : !result || result.total === 0 ? (
          <p className="p-8 text-center text-xs text-slate-500">Không có dữ liệu phù hợp.</p>
        ) : (
          <>
            <table className="w-full min-w-[960px] text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-600">
                <tr>
                  <th className="px-3 py-2">Mã hồ sơ</th>
                  <th className="px-3 py-2">Số container</th>
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
              <tbody className="divide-y divide-slate-100">
                {result.rows.map(({ workOrder: w, container: c }) => (
                  <tr key={w.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <button type="button" onClick={() => onOpenDossier(w.masterDossierCode)} className="font-mono text-blue-700 hover:underline">{w.masterDossierCode}</button>
                    </td>
                    <td className="px-3 py-2 font-mono font-bold">{w.containerNo}</td>
                    <td className="px-3 py-2">{c?.shippingLineCode || '-'}</td>
                    <td className="px-3 py-2">{w.items.join(', ')}</td>
                    <td className="px-3 py-2 text-right font-mono">{w.laborHours ?? '-'}</td>
                    <td className="px-3 py-2">{REPAIR_STATUS[w.workStatus] || w.workStatus}</td>
                    <td className="px-3 py-2">{w.repairTeamName || '-'}</td>
                    <td className="px-3 py-2">{(w.repairMembers || []).join(', ') || '-'}</td>
                    <td className="px-3 py-2">{w.approvedBy || '-'} • {formatViTime(w.createdAt)}</td>
                    <td className="px-3 py-2">{w.completedBy ? `${w.completedBy} • ${formatViTime(w.completedAt)}` : '-'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
                  <td colSpan={4} className="px-3 py-2 text-right">Tổng giờ công (trang này)</td>
                  <td className="px-3 py-2 text-right font-mono">{result.rows.reduce((s, r) => s + (r.workOrder.laborHours || 0), 0)}</td>
                  <td colSpan={5} />
                </tr>
              </tfoot>
            </table>
            <Pager page={result.page} pageCount={result.pageCount} total={result.total} onPage={setPage} />
          </>
        )}
      </div>
    </div>
  );
};
