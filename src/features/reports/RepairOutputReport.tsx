import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { DepotState, formatVnd } from '../../services/depotStore';
import { queryRepairOutput, RepairOutputFilter, RepairOutputRow, repairOutputSheets } from '../../services/reports';
import { quickRange, fileStamp } from '../../services/datetime';
import { useReportState } from '../../components/useReportState';
import { linkCls, DateRangeFilter, DetailDrawer, ExportExcelButton, Feedback, formatViTime, inputCls, labelCls, primaryBtn, SectionCard } from '../../components/shared';

// BÁO CÁO SẢN LƯỢNG SỬA CHỮA (DEC-170): giờ công từng nhân viên theo bộ lọc thời gian / tổ / nhân viên.
// Giờ công 1 cont chia đều cho số nhân viên tác nghiệp cont đó (quy tắc ở queryRepairOutput — services/reports.ts).
// DEC-175: Lương sản phẩm + Sản phẩm vượt giờ (giờ công trong khoảng lọc vượt mốc ở Danh mục) = Tổng tiền sản phẩm.
export const RepairOutputReport: React.FC<{ state: DepotState; onOpenDossier: (code: string) => void }> = ({ state: live, onOpenDossier }) => {
  const report = useReportState(live, 'REPAIR_OUTPUT'); // DEC-178: chỉ tải phiếu sửa chữa đã xong trong khoảng
  const state = report.data;
  const [draft, setDraft] = useState<RepairOutputFilter>(() => ({ ...quickRange('TODAY'), teamCode: '', memberName: '' }));
  const [applied, setApplied] = useState<RepairOutputFilter | null>(null);
  const [open, setOpen] = useState<RepairOutputRow | null>(null);

  // Nhân viên theo tổ đang chọn (cả nhân viên đã ngưng — vẫn có sản lượng cũ)
  const members = useMemo(() => {
    const teams = state.repairTeams.filter((t) => !draft.teamCode || t.code === draft.teamCode);
    return Array.from(new Set(teams.flatMap((t) => t.members.map((m) => m.fullName)))).sort((a, b) => a.localeCompare(b));
  }, [state.repairTeams, draft.teamCode]);

  const clean = (f: RepairOutputFilter): RepairOutputFilter => ({ ...f, teamCode: f.teamCode || undefined, memberName: f.memberName || undefined });
  let rows: RepairOutputRow[] | null = null;
  let queryError: string | null = null;
  if (applied) {
    try {
      rows = queryRepairOutput(state, clean(applied));
    } catch (err) {
      queryError = err instanceof Error ? err.message : 'Lỗi tra cứu';
    }
  }
  const totalHours = rows ? Math.round(rows.reduce((s, r) => s + r.hours, 0) * 100) / 100 : 0;

  return (
    <div className="space-y-4">
      <SectionCard title="Sản lượng sửa chữa" icon={<Search className="h-4 w-4 text-ink-muted" />}>
        <form onSubmit={(e) => { e.preventDefault(); report.run(draft, () => setApplied({ ...draft })); }} className="grid grid-cols-2 gap-2 sm:grid-cols-6">
          <DateRangeFilter value={draft} onChange={(r) => setDraft({ ...draft, ...r })} />
          <label>
            <span className={labelCls}>Tổ sửa chữa</span>
            <select value={draft.teamCode} onChange={(e) => setDraft({ ...draft, teamCode: e.target.value, memberName: '' })} className={inputCls}>
              <option value="">Tất cả</option>
              {state.repairTeams.map((t) => <option key={t.id} value={t.code}>{t.code}</option>)}
            </select>
          </label>
          <label>
            <span className={labelCls}>Nhân viên sửa chữa</span>
            <select value={draft.memberName} onChange={(e) => setDraft({ ...draft, memberName: e.target.value })} className={inputCls}>
              <option value="">Tất cả</option>
              {members.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </label>
          <div className="col-span-2 flex gap-2 sm:col-span-6">
            <button type="submit" className={primaryBtn} disabled={report.loading}>
              <Search className="h-4 w-4" />
              {report.loading ? 'Đang tải…' : 'Tra cứu'}
            </button>
            {rows && rows.length > 0 && (
              <ExportExcelButton getSheets={() => repairOutputSheets(rows!)} fileName={`MATRAN_SAN_LUONG_SUA_CHUA_${fileStamp(applied!.dateFrom) || 'tra-cuu'}.xlsx`} />
            )}
          </div>
        </form>
      </SectionCard>

      <Feedback error={report.loadError} />

      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        {!applied ? (
          <p className="p-8 text-center text-xs text-ink-muted">Chọn khoảng thời gian, sau đó bấm Tra cứu.</p>
        ) : queryError ? (
          <p className="p-6 text-center text-xs text-red-700">{queryError}</p>
        ) : !rows || rows.length === 0 ? (
          <p className="p-8 text-center text-xs text-ink-muted">Không có dữ liệu phù hợp.</p>
        ) : (
          <table className="data-table w-full min-w-[960px] whitespace-nowrap text-left text-xs">
            <thead className="border-b border-line bg-canvas text-[11px] uppercase text-ink-muted">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Tổ sửa chữa</th>
                <th className="px-3 py-2">Nhân viên</th>
                <th className="px-3 py-2">Bậc thợ</th>
                <th className="px-3 py-2 text-right">Số cont</th>
                <th className="px-3 py-2 text-right">Giờ công</th>
                <th className="px-3 py-2 text-right">Nhân công bậc thợ (đ / giờ)</th>
                <th className="px-3 py-2 text-right">Lương sản phẩm</th>
                <th className="px-3 py-2 text-right">Giờ vượt giờ</th>
                <th className="px-3 py-2 text-right">Sản phẩm vượt giờ</th>
                <th className="px-3 py-2 text-right">Tổng tiền sản phẩm (VND)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((r, idx) => (
                <tr key={`${r.teamName}|${r.memberName}`} onClick={() => setOpen(r)} className="cursor-pointer hover:bg-canvas">
                  <td className="px-3 py-2 text-ink-muted">{idx + 1}</td>
                  <td className="px-3 py-2">{r.teamName || '-'}</td>
                  <td className="px-3 py-2 font-semibold">{r.memberName}</td>
                  <td className="px-3 py-2">{r.gradeName || <span className="text-amber-700">Chưa có bậc</span>}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.containers}</td>
                  <td className="px-3 py-2 text-right font-mono font-bold">{r.hours}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.hourlyRate !== undefined ? formatVnd(r.hourlyRate) : r.productWage !== undefined ? 'Nhiều mức' : '-'}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.productWage !== undefined ? formatVnd(r.productWage) : '-'}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.overtimeHours || '-'}</td>
                  <td className="px-3 py-2 text-right font-mono">{r.overtimeAmount ? formatVnd(r.overtimeAmount) : '-'}</td>
                  <td className="px-3 py-2 text-right font-mono font-bold">{r.amount !== undefined ? formatVnd(r.amount) : '-'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-line bg-canvas font-semibold">
                <td colSpan={4} className="px-3 py-2 text-right">Tổng</td>
                <td className="px-3 py-2 text-right font-mono">{rows.reduce((s, r) => s + r.containers, 0)}</td>
                <td className="px-3 py-2 text-right font-mono">{totalHours}</td>
                <td />
                <td className="px-3 py-2 text-right font-mono">{formatVnd(rows.reduce((s, r) => s + (r.productWage || 0), 0))}</td>
                <td className="px-3 py-2 text-right font-mono">{Math.round(rows.reduce((s, r) => s + r.overtimeHours, 0) * 100) / 100}</td>
                <td className="px-3 py-2 text-right font-mono">{formatVnd(rows.reduce((s, r) => s + r.overtimeAmount, 0))}</td>
                <td className="px-3 py-2 text-right font-mono">{formatVnd(rows.reduce((s, r) => s + (r.amount || 0), 0))}</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      <DetailDrawer open={Boolean(open)} title={open ? `${open.memberName} — ${open.hours} giờ công • ${open.containers} cont` : ''} onClose={() => setOpen(null)} wide>
        {open && (
          <table className="data-table w-full whitespace-nowrap text-left text-xs">
            <thead className="border-b border-line bg-canvas text-[11px] uppercase text-ink-muted">
              <tr>
                <th className="px-2 py-1.5">Mã hồ sơ</th>
                <th className="px-2 py-1.5">Số container</th>
                <th className="px-2 py-1.5">Size/Type</th>
                <th className="px-2 py-1.5 text-right">Giờ công cont</th>
                <th className="px-2 py-1.5 text-right">Số người</th>
                <th className="px-2 py-1.5 text-right">Giờ công chia</th>
                <th className="px-2 py-1.5">Bậc thợ</th>
                <th className="px-2 py-1.5 text-right">Nhân công bậc thợ (đ / giờ)</th>
                <th className="px-2 py-1.5 text-right">Lương sản phẩm</th>
                <th className="px-2 py-1.5">Hoàn tất</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {open.jobs.map((j) => (
                <tr key={j.workOrder.id}>
                  <td className="px-2 py-1.5"><button type="button" onClick={() => onOpenDossier(j.workOrder.masterDossierCode)} className={linkCls}>{j.workOrder.masterDossierCode}</button></td>
                  <td className="px-2 py-1.5 font-mono font-bold">{j.workOrder.containerNo}</td>
                  <td className="px-2 py-1.5">{j.container ? `${j.container.size}/${j.container.type}` : '-'}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{j.workOrder.laborHours ?? 0}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{j.memberCount}</td>
                  <td className="px-2 py-1.5 text-right font-mono font-bold">{j.share}</td>
                  <td className="px-2 py-1.5">{j.gradeName || '-'}</td>
                  <td className="px-2 py-1.5 text-right font-mono">{j.hourlyRate !== undefined ? formatVnd(j.hourlyRate) : '-'}</td>
                  <td className="px-2 py-1.5 text-right font-mono font-bold">{j.amount !== undefined ? formatVnd(j.amount) : '-'}</td>
                  <td className="px-2 py-1.5 font-mono">{formatViTime(j.workOrder.completedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </DetailDrawer>
    </div>
  );
};
