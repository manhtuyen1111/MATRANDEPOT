import React, { useMemo, useState } from 'react';
import {
  FileBarChart2,
  Package,
  ArrowDownToLine,
  ArrowUpFromLine,
  Calendar,
  Building2,
  Printer,
  CheckCircle2,
  Search,
  RotateCcw,
  FileText,
  StickyNote,
} from 'lucide-react';
import { ContainerStatus } from '../../types/depot';
import { DepotState } from '../../services/depotStore';

interface Props {
  state: DepotState;
  onOpenDossier: (masterDossierCode: string) => void;
}

type ReportTab = 'TON_VO' | 'HA_VO' | 'CAP_VO';

const STATUS_BADGE: Record<
  ContainerStatus,
  { label: string; bg: string; text: string }
> = {
  PENDING_GATE_IN: {
    label: 'Đang làm thủ tục Hạ vỏ',
    bg: 'bg-purple-100',
    text: 'text-purple-800',
  },
  WAITING_PLACEMENT: {
    label: 'Chờ Xe nâng hạ bãi',
    bg: 'bg-amber-100',
    text: 'text-amber-800',
  },
  IN_YARD: {
    label: 'Đang tồn bãi (IN YARD)',
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
  },
  ALLOCATED: {
    label: 'Đã phân bổ Cấp vỏ',
    bg: 'bg-sky-100',
    text: 'text-sky-800',
  },
  GATED_OUT: {
    label: 'Đã xuất bãi (GATED OUT)',
    bg: 'bg-slate-100',
    text: 'text-slate-600',
  },
};

export const ReportsWorkspace: React.FC<Props> = ({ state, onOpenDossier }) => {
  const [activeTab, setActiveTab] = useState<ReportTab>('TON_VO');

  // Bộ lọc HẠ VỎ (yêu cầu chọn khoảng thời gian + HÃNG TÀU trước khi tạo báo cáo)
  const [haVoFromDate, setHaVoFromDate] = useState<string>('2026-01-01');
  const [haVoToDate, setHaVoToDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [haVoShippingLine, setHaVoShippingLine] = useState<string>('');
  const [haVoGenerated, setHaVoGenerated] = useState<boolean>(false);

  // Bộ lọc CẤP VỎ (yêu cầu chọn khoảng thời gian + HÃNG TÀU trước khi tạo báo cáo)
  const [capVoFromDate, setCapVoFromDate] = useState<string>('2026-01-01');
  const [capVoToDate, setCapVoToDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [capVoShippingLine, setCapVoShippingLine] = useState<string>('');
  const [capVoGenerated, setCapVoGenerated] = useState<boolean>(false);

  // Danh sách Hãng tàu từ DANH MỤC CHUNG
  const shippingLines = useMemo(
    () => state.partners.filter((p) => p.isShippingLine),
    [state.partners]
  );

  // 1. TỒN VỎ: Luôn hiển thị full danh sách tồn vỏ hiện tại
  const activeYardContainers = useMemo(() => {
    return state.containers
      .filter((c) => c.status !== 'GATED_OUT')
      .sort((a, b) => {
        const aHasNote = Boolean(a.officeNote && a.officeNote.trim());
        const bHasNote = Boolean(b.officeNote && b.officeNote.trim());
        if (aHasNote !== bHasNote) return aHasNote ? -1 : 1;
        return new Date(b.gateInAt).getTime() - new Date(a.gateInAt).getTime();
      });
  }, [state.containers]);

  // 2. HẠ VỎ: Lọc theo khoảng thời gian + Hãng tàu (chỉ những hồ sơ đã xác nhận hạ bãi GATE_IN_OK)
  const haVoRecords = useMemo(() => {
    if (!haVoGenerated || !haVoFromDate || !haVoToDate || !haVoShippingLine) {
      return [];
    }
    const startMs = new Date(`${haVoFromDate}T00:00:00`).getTime();
    const endMs = new Date(`${haVoToDate}T23:59:59.999`).getTime();

    return state.gateInOrders
      .filter((g) => g.status === 'GATE_IN_OK')
      .filter((g) => {
        const rawTime = g.gateInOkAt || g.officeVerifiedAt || g.fieldRecordedAt;
        const ts = new Date(rawTime).getTime();
        const inRange = ts >= startMs && ts <= endMs;
        const matchLine =
          haVoShippingLine === 'ALL' || g.shippingLineCode === haVoShippingLine;
        return inRange && matchLine;
      });
  }, [
    state.gateInOrders,
    haVoGenerated,
    haVoFromDate,
    haVoToDate,
    haVoShippingLine,
  ]);

  // 3. CẤP VỎ: Lọc theo khoảng thời gian + Hãng tàu
  const capVoRecords = useMemo(() => {
    if (!capVoGenerated || !capVoFromDate || !capVoToDate || !capVoShippingLine) {
      return [];
    }
    const startMs = new Date(`${capVoFromDate}T00:00:00`).getTime();
    const endMs = new Date(`${capVoToDate}T23:59:59.999`).getTime();

    return state.gateOutOrders
      .map((go) => {
        const booking = state.releaseBookings.find(
          (b) => b.bookingNo === go.bookingNo
        );
        const cont = state.containers.find(
          (c) =>
            c.masterDossierCode === go.masterDossierCode ||
            c.containerNo === go.containerNo
        );
        const shippingLineCode =
          booking?.shippingLineCode || cont?.shippingLineCode || 'MAERSK';
        const sizeType = cont
          ? `${cont.size}${cont.type}`
          : booking
          ? `${booking.size}${booking.type}`
          : '20DC';
        return {
          ...go,
          shippingLineCode,
          sizeType,
        };
      })
      .filter((go) => {
        const ts = new Date(go.confirmedAt || go.createdAt).getTime();
        const inRange = ts >= startMs && ts <= endMs;
        const matchLine =
          capVoShippingLine === 'ALL' ||
          go.shippingLineCode === capVoShippingLine;
        return inRange && matchLine;
      });
  }, [
    state.gateOutOrders,
    state.releaseBookings,
    state.containers,
    capVoGenerated,
    capVoFromDate,
    capVoToDate,
    capVoShippingLine,
  ]);

  const canGenerateHaVo = Boolean(
    haVoFromDate && haVoToDate && haVoShippingLine
  );
  const canGenerateCapVo = Boolean(
    capVoFromDate && capVoToDate && capVoShippingLine
  );

  return (
    <div className="space-y-4">
      {/* Header & chọn loại Báo cáo */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
              <FileBarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                BÁO CÁO TỔNG HỢP BÃI (TỒN VỎ / HẠ VỎ / CẤP VỎ)
              </h2>
              <p className="text-xs text-slate-500">
                Chọn loại báo cáo: Tồn Vỏ Hiện Tại, Báo Cáo Hạ Vỏ hoặc Báo Cáo Cấp Vỏ theo Hãng Tàu & Khoảng Thời Gian
              </p>
            </div>
          </div>

          {/* 3 Nút chọn chế độ báo cáo */}
          <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveTab('TON_VO')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'TON_VO'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              <Package className="w-4 h-4" />
              TỒN VỎ ({activeYardContainers.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('HA_VO')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'HA_VO'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              <ArrowDownToLine className="w-4 h-4" />
              HẠ VỎ
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('CAP_VO')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                activeTab === 'CAP_VO'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              <ArrowUpFromLine className="w-4 h-4" />
              CẤP VỎ
            </button>
          </div>
        </div>
      </div>

      {/* TAB 1: TỒN VỎ - Luôn hiển thị full danh sách tồn vỏ hiện tại */}
      {activeTab === 'TON_VO' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-wider">
                BÁO CÁO TỒN VỎ: LUÔN HIỂN THỊ FULL DANH SÁCH TỒN VỎ HIỆN TẠI ({activeYardContainers.length} CONTAINER)
              </span>
            </div>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              In Báo Cáo Tồn Vỏ
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                  <th className="py-2.5 px-3">STT</th>
                  <th className="py-2.5 px-3">Số Container</th>
                  <th className="py-2.5 px-3">Mã Hồ Sơ EEIR</th>
                  <th className="py-2.5 px-3">Size - Type</th>
                  <th className="py-2.5 px-3">Hãng Tàu</th>
                  <th className="py-2.5 px-3">Phân Loại</th>
                  <th className="py-2.5 px-3">Trạng Thái</th>
                  <th className="py-2.5 px-3">Vị Trí Bãi</th>
                  <th className="py-2.5 px-3">Ngày Hạ Bãi</th>
                  <th className="py-2.5 px-3">Ghi Chú Văn Phòng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {activeYardContainers.map((c, idx) => {
                  const badge = STATUS_BADGE[c.status];
                  const hasNote = Boolean(c.officeNote && c.officeNote.trim());
                  const locText = c.currentBlock
                    ? `${c.currentBlock}-${c.currentBay || '01'}-${c.currentRow || '01'}-${c.currentTier || '1'}`
                    : 'Chưa xếp vị trí';
                  return (
                    <tr
                      key={c.id}
                      onClick={() => onOpenDossier(c.masterDossierCode)}
                      className={`cursor-pointer transition-colors ${
                        hasNote
                          ? 'bg-amber-50/90 hover:bg-amber-100/80'
                          : 'hover:bg-blue-50/40'
                      }`}
                    >
                      <td className="py-2.5 px-3 font-semibold text-slate-500">
                        {idx + 1}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-black text-slate-900">
                        {c.containerNo}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-blue-700">
                        {c.masterDossierCode}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-slate-800">
                        {c.size}
                        {c.type}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-indigo-700">
                        {c.shippingLineCode}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            c.conditionClass === 'AV'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-rose-100 text-rose-800'
                          }`}
                        >
                          {c.conditionClass}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-bold ${badge.bg} ${badge.text}`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-800">
                        {locText}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600">
                        {new Date(c.gateInAt).toLocaleString('vi-VN')}
                      </td>
                      <td className="py-2.5 px-3">
                        {hasNote ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-200/80 text-amber-950 font-bold text-[11px]">
                            <StickyNote className="w-3 h-3 text-amber-700" />
                            {c.officeNote}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: HẠ VỎ - Yêu cầu chọn khoảng thời gian + HÃNG TÀU để tiến hành tạo báo cáo */}
      {activeTab === 'HA_VO' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-emerald-600" />
                CHỌN BỘ LỌC KHOẢNG THỜI GIAN + HÃNG TÀU ĐỂ TIẾN HÀNH TẠO BÁO CÁO HẠ VỎ
              </h3>
              {haVoGenerated && (
                <button
                  type="button"
                  onClick={() => {
                    setHaVoGenerated(false);
                    setHaVoShippingLine('');
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Đặt lại bộ lọc
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Từ ngày <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={haVoFromDate}
                  onChange={(e) => {
                    setHaVoFromDate(e.target.value);
                    setHaVoGenerated(false);
                  }}
                  className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Đến ngày <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={haVoToDate}
                  onChange={(e) => {
                    setHaVoToDate(e.target.value);
                    setHaVoGenerated(false);
                  }}
                  className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Hãng Tàu (Danh mục chung) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={haVoShippingLine}
                  onChange={(e) => {
                    setHaVoShippingLine(e.target.value);
                    setHaVoGenerated(false);
                  }}
                  className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none bg-white"
                >
                  <option value="">-- Chọn Hãng Tàu --</option>
                  <option value="ALL">Tất cả Hãng tàu (ALL)</option>
                  {shippingLines.map((line) => (
                    <option key={line.id} value={line.code}>
                      {line.code} - {line.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <button
                  type="button"
                  disabled={!canGenerateHaVo}
                  onClick={() => setHaVoGenerated(true)}
                  className={`w-full py-2 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    canGenerateHaVo
                      ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Search className="w-4 h-4" />
                  TẠO BÁO CÁO HẠ VỎ
                </button>
              </div>
            </div>
          </div>

          {!haVoGenerated ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
              <Building2 className="w-8 h-8 text-amber-600 mx-auto mb-2" />
              <div className="text-sm font-bold text-amber-900">
                Vui lòng chọn Khoảng thời gian (Từ ngày - Đến ngày) và HÃNG TÀU, sau đó nhấn &quot;TẠO BÁO CÁO HẠ VỎ&quot;
              </div>
              <p className="text-xs text-amber-700 mt-1">
                Hệ thống yêu cầu chọn đủ bộ lọc ở bước trên trước khi hiển thị kết quả báo cáo hạ vỏ.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-emerald-900 text-white flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    KẾT QUẢ BÁO CÁO HẠ VỎ ({haVoFromDate} → {haVoToDate} | Hãng tàu: {haVoShippingLine}) — {haVoRecords.length} CONT
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold"
                >
                  <Printer className="w-3.5 h-3.5" />
                  In Báo Cáo Hạ Vỏ
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                      <th className="py-2.5 px-3">STT</th>
                      <th className="py-2.5 px-3">Mã Hồ Sơ EEIR</th>
                      <th className="py-2.5 px-3">Số Container</th>
                      <th className="py-2.5 px-3">Size - Type</th>
                      <th className="py-2.5 px-3">Hãng Tàu</th>
                      <th className="py-2.5 px-3">Số Xe Hạ</th>
                      <th className="py-2.5 px-3">Đại Diện KH</th>
                      <th className="py-2.5 px-3">Phân Loại</th>
                      <th className="py-2.5 px-3 text-right">Tổng Chi Phí (Gồm VAT)</th>
                      <th className="py-2.5 px-3">Thời Gian Hạ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {haVoRecords.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-400">
                          Không có dữ liệu Hạ Vỏ nào khớp với khoảng thời gian và Hãng tàu đã chọn.
                        </td>
                      </tr>
                    ) : (
                      haVoRecords.map((g, idx) => (
                        <tr
                          key={g.id}
                          onClick={() => onOpenDossier(g.masterDossierCode)}
                          className="hover:bg-emerald-50/40 cursor-pointer"
                        >
                          <td className="py-2.5 px-3 font-semibold text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-blue-700">
                            {g.masterDossierCode}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-black text-slate-900">
                            {g.containerNo || '—'}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">
                            {g.size || '20'}
                            {g.type || 'DC'}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-indigo-700">
                            {g.shippingLineCode || '—'}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-semibold text-slate-700">
                            {g.truckNo || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">
                            {g.customerRep || '—'}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-700 text-[11px]">
                              {g.conditionClass}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-emerald-700">
                            {g.feeAmount.toLocaleString('vi-VN')} đ
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {new Date(
                              g.gateInOkAt || g.officeVerifiedAt || g.fieldRecordedAt
                            ).toLocaleString('vi-VN')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: CẤP VỎ - Yêu cầu chọn khoảng thời gian + HÃNG TÀU để tiến hành tạo báo cáo */}
      {activeTab === 'CAP_VO' && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Calendar className="w-4 h-4 text-amber-600" />
                CHỌN BỘ LỌC KHOẢNG THỜI GIAN + HÃNG TÀU ĐỂ TIẾN HÀNH TẠO BÁO CÁO CẤP VỎ
              </h3>
              {capVoGenerated && (
                <button
                  type="button"
                  onClick={() => {
                    setCapVoGenerated(false);
                    setCapVoShippingLine('');
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Đặt lại bộ lọc
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Từ ngày <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={capVoFromDate}
                  onChange={(e) => {
                    setCapVoFromDate(e.target.value);
                    setCapVoGenerated(false);
                  }}
                  className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Đến ngày <span className="text-rose-500">*</span>
                </label>
                <input
                  type="date"
                  value={capVoToDate}
                  onChange={(e) => {
                    setCapVoToDate(e.target.value);
                    setCapVoGenerated(false);
                  }}
                  className="w-full px-3 py-2 text-xs font-semibold border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Hãng Tàu (Danh mục chung) <span className="text-rose-500">*</span>
                </label>
                <select
                  value={capVoShippingLine}
                  onChange={(e) => {
                    setCapVoShippingLine(e.target.value);
                    setCapVoGenerated(false);
                  }}
                  className="w-full px-3 py-2 text-xs font-bold border border-slate-300 rounded-lg focus:ring-2 focus:ring-amber-500 outline-none bg-white"
                >
                  <option value="">-- Chọn Hãng Tàu --</option>
                  <option value="ALL">Tất cả Hãng tàu (ALL)</option>
                  {shippingLines.map((line) => (
                    <option key={line.id} value={line.code}>
                      {line.code} - {line.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <button
                  type="button"
                  disabled={!canGenerateCapVo}
                  onClick={() => setCapVoGenerated(true)}
                  className={`w-full py-2 px-4 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition-all ${
                    canGenerateCapVo
                      ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Search className="w-4 h-4" />
                  TẠO BÁO CÁO CẤP VỎ
                </button>
              </div>
            </div>
          </div>

          {!capVoGenerated ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
              <FileText className="w-8 h-8 text-amber-600 mx-auto mb-2" />
              <div className="text-sm font-bold text-amber-900">
                Vui lòng chọn Khoảng thời gian (Từ ngày - Đến ngày) và HÃNG TÀU, sau đó nhấn &quot;TẠO BÁO CÁO CẤP VỎ&quot;
              </div>
              <p className="text-xs text-amber-700 mt-1">
                Hệ thống yêu cầu chọn đủ bộ lọc ở bước trên trước khi hiển thị kết quả báo cáo cấp vỏ.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-amber-900 text-white flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-amber-300" />
                  <span className="text-xs font-bold uppercase tracking-wider">
                    KẾT QUẢ BÁO CÁO CẤP VỎ ({capVoFromDate} → {capVoToDate} | Hãng tàu: {capVoShippingLine}) — {capVoRecords.length} CONT
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-bold"
                >
                  <Printer className="w-3.5 h-3.5" />
                  In Báo Cáo Cấp Vỏ
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                      <th className="py-2.5 px-3">STT</th>
                      <th className="py-2.5 px-3">Mã Hồ Sơ EEIR</th>
                      <th className="py-2.5 px-3">Số Container</th>
                      <th className="py-2.5 px-3">Size - Type</th>
                      <th className="py-2.5 px-3">Hãng Tàu</th>
                      <th className="py-2.5 px-3">Số Booking / Lệnh Cấp</th>
                      <th className="py-2.5 px-3">Số Xe Nhận</th>
                      <th className="py-2.5 px-3">Đại Diện Nhận</th>
                      <th className="py-2.5 px-3 text-right">Phí Nâng (Gồm VAT)</th>
                      <th className="py-2.5 px-3">Thời Gian Cấp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-xs">
                    {capVoRecords.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-8 text-center text-slate-400">
                          Không có dữ liệu Cấp Vỏ nào khớp với khoảng thời gian và Hãng tàu đã chọn.
                        </td>
                      </tr>
                    ) : (
                      capVoRecords.map((go, idx) => (
                        <tr
                          key={go.id}
                          onClick={() => onOpenDossier(go.masterDossierCode)}
                          className="hover:bg-amber-50/40 cursor-pointer"
                        >
                          <td className="py-2.5 px-3 font-semibold text-slate-500">
                            {idx + 1}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-blue-700">
                            {go.masterDossierCode}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-black text-slate-900">
                            {go.containerNo}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">
                            {go.sizeType}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-indigo-700">
                            {go.shippingLineCode}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-semibold text-slate-800">
                            {go.bookingNo}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-semibold text-slate-700">
                            {go.truckNo}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">
                            {go.receiverRep}
                          </td>
                          <td className="py-2.5 px-3 text-right font-bold text-amber-700">
                            {go.feeAmount.toLocaleString('vi-VN')} đ
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {new Date(go.confirmedAt || go.createdAt).toLocaleString('vi-VN')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
