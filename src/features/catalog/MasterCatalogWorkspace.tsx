import React, { useState } from 'react';
import { setShippingLinePriority, addContainerSizeCatalogItem, addContainerTypeCatalogItem, addDepotFeeCatalogItem, addPartnerCatalogItem, addYardBlockCatalogItem, deleteContainerSizeCatalogItem, deleteContainerTypeCatalogItem, deleteDepotFeeCatalogItem, deletePartnerCatalogItem, deleteYardBlockCatalogItem, setYardBlockInspectionRack } from '../../services/api';
import {
  Box,
  CheckCircle2,
  Lock,
  MapPin,
  Plus,
  Receipt,
  ShieldAlert,
  Ship,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';
import {
  DepotState,
  formatVnd,
  INITIAL_CONTAINER_SIZES,
  INITIAL_CONTAINER_TYPES,
  INITIAL_FEE_CATALOG,
} from '../../services/depotStore';

import { FeeTariffCategory } from '../../types/depot';
import { blockDimensions, SLOT_DIMENSION_LABELS } from '../../services/core';

export type CatalogTab =
  | 'KHACH_HANG'
  | 'VI_TRI'
  | 'HANG_TAU'
  | 'CONTAINER'
  | 'BIEU_GIA';

interface Props {
  state: DepotState;
  onUpdateState: (next: DepotState) => void;
  // Mục con được chọn từ menu DANH MỤC CHUNG (CR-06); khi có thì ẩn thanh tab nội bộ
  tab?: CatalogTab;
}

export const MasterCatalogWorkspace: React.FC<Props> = ({
  state,
  onUpdateState,
  tab,
}) => {
  const isAdmin = state.currentUser.roles.includes('ADMIN');

  const [activeTabState, setActiveTab] = useState<CatalogTab>('BIEU_GIA');
  const activeTab = tab || activeTabState;
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const containerSizes =
    state.containerSizes && state.containerSizes.length > 0
      ? state.containerSizes
      : INITIAL_CONTAINER_SIZES;
  const containerTypes =
    state.containerTypes && state.containerTypes.length > 0
      ? state.containerTypes
      : INITIAL_CONTAINER_TYPES;
  const feeCatalog =
    state.feeCatalog && state.feeCatalog.length > 0
      ? state.feeCatalog
      : INITIAL_FEE_CATALOG;

  const customers = state.partners.filter((p) => p.isCustomer);
  const shippingLines = state.partners.filter((p) => p.isShippingLine);

  // State form KHÁCH HÀNG
  const [custCode, setCustCode] = useState('');
  const [custName, setCustName] = useState('');
  const [custAllowTts, setCustAllowTts] = useState(true);

  // State form HÃNG TÀU
  const [lineCode, setLineCode] = useState('');
  const [lineName, setLineName] = useState('');
  const [lineAllowTts, setLineAllowTts] = useState(true);

  // State form VỊ TRÍ
  const [blockCode, setBlockCode] = useState('');
  const [blockName, setBlockName] = useState('');
  // DEC-082: để trống = chiều đó không dùng
  const [maxBay, setMaxBay] = useState('');
  const [maxRow, setMaxRow] = useState('');
  const [maxTier, setMaxTier] = useState('');
  const [blockDesc, setBlockDesc] = useState('');
  const [blockIsRack, setBlockIsRack] = useState(false); // DEC-109

  // State form CONTAINER (SIZE - TYPE)
  const [newSize, setNewSize] = useState('');
  const [newType, setNewType] = useState('');

  // State form BIỂU GIÁ (NÂNG HẠ theo từng Size - Type - Hãng tàu & THU GOM RÁC)
  const [tariffCategory, setTariffCategory] =
    useState<FeeTariffCategory>('NANG_HA');
  const [tariffSize, setTariffSize] = useState<string>(containerSizes[0] || '20');
  const [tariffType, setTariffType] = useState<string>(containerTypes[0] || 'DC');
  const [tariffShippingLine, setTariffShippingLine] = useState<string>(
    shippingLines[0]?.code || 'MAERSK'
  );
  const [tariffName, setTariffName] = useState<string>('');
  const [tariffAmount, setTariffAmount] = useState<number>(450000);
  const [filterTariffCat, setFilterTariffCat] = useState<
    'ALL' | FeeTariffCategory
  >('ALL');

  const clearFeedback = () => {
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleSwitchToAdmin = () => {
    const adminUser = state.staffUsers.find((u) => u.roles.includes('ADMIN'));
    if (adminUser) {
      onUpdateState({ ...state, currentUser: adminUser });
      setErrorMsg(null);
      setSuccessMsg(
        `Đã chuyển sang tài khoản Quản trị hệ thống: ${adminUser.fullName}. Bạn có toàn quyền cấu hình DANH MỤC CHUNG.`
      );
    }
  };

  // 1. Xử lý thêm KHÁCH HÀNG
  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();
    try {
      const next = addPartnerCatalogItem(state, {
        code: custCode,
        name: custName,
        partnerType: 'CUSTOMER',
        allowTts: custAllowTts,
      });
      onUpdateState(next);
      setCustCode('');
      setCustName('');
      setSuccessMsg(`Đã thêm KHÁCH HÀNG [${custCode.toUpperCase()}] ${custName} vào Danh mục chung.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi thêm Khách hàng');
    }
  };

  // 2. Xử lý thêm HÃNG TÀU
  const handleAddShippingLine = (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();
    try {
      const next = addPartnerCatalogItem(state, {
        code: lineCode,
        name: lineName,
        partnerType: 'SHIPPING_LINE',
        allowTts: lineAllowTts,
      });
      onUpdateState(next);
      setLineCode('');
      setLineName('');
      setSuccessMsg(`Đã thêm HÃNG TÀU [${lineCode.toUpperCase()}] ${lineName} vào Danh mục chung.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi thêm Hãng tàu');
    }
  };

  // 3. Xử lý thêm VỊ TRÍ
  const handleAddBlock = (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();
    try {
      const next = addYardBlockCatalogItem(state, {
        blockCode,
        blockName,
        maxBay: maxBay ? Number(maxBay) : null,
        maxRow: maxRow ? Number(maxRow) : null,
        maxTier: maxTier ? Number(maxTier) : null,
        description: blockDesc,
        isInspectionRack: blockIsRack,
      });
      onUpdateState(next);
      setBlockIsRack(false);
      setBlockCode('');
      setBlockName('');
      setBlockDesc('');
      setMaxBay('');
      setMaxRow('');
      setMaxTier('');
      setSuccessMsg(`Đã thêm VỊ TRÍ [BLOCK-${blockCode.toUpperCase()}] vào Danh mục chung.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi thêm Vị trí');
    }
  };

  // 4. Xử lý thêm SIZE / TYPE
  const handleAddSize = (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();
    try {
      const next = addContainerSizeCatalogItem(state, newSize);
      onUpdateState(next);
      setNewSize('');
      setSuccessMsg(`Đã thêm SIZE "${newSize.toUpperCase()}" vào Danh mục chung.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi thêm Size');
    }
  };

  const handleAddType = (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();
    try {
      const next = addContainerTypeCatalogItem(state, newType);
      onUpdateState(next);
      setNewType('');
      setSuccessMsg(`Đã thêm TYPE "${newType.toUpperCase()}" vào Danh mục chung.`);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi thêm Type');
    }
  };

  // 5. Xử lý thêm BIỂU GIÁ (NÂNG HẠ theo Size - Type - Hãng tàu / THU GOM RÁC / KHÁC)
  const handleAddTariff = (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();
    try {
      const next = addDepotFeeCatalogItem(state, {
        category: tariffCategory,
        size: tariffCategory !== 'KHAC' ? tariffSize : undefined,
        type: tariffCategory === 'NANG_HA' ? tariffType : undefined,
        shippingLineCode:
          tariffCategory === 'NANG_HA' ? tariffShippingLine : undefined,
        name: tariffName,
        defaultAmountInclVat: Number(tariffAmount),
      });
      onUpdateState(next);
      setTariffName('');
      setSuccessMsg('Đã thêm BIỂU GIÁ mới (Đã bao gồm VAT) vào Danh mục chung.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi thêm Biểu giá');
    }
  };

  return (
    <div className="space-y-4">
      {/* HEADER & QUYỀN ADMIN */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3">
        <div>
          <h2 className="text-base font-extrabold text-ink">
            DANH MỤC CHUNG HỆ THỐNG
          </h2>
          <p className="text-xs text-ink-muted">
            Cấu hình chuẩn cho toàn hệ thống: Khách hàng • Vị trí • Hãng tàu • Container (Size - Type) • Biểu giá (Nâng hạ &amp; Thu gom rác). Các màn hình tác nghiệp chỉ được chọn theo cấu hình tại đây.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs">
          {isAdmin ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-100 px-3 py-1.5 font-bold text-emerald-800">
              <UserCheck className="h-4 w-4" />
              Quyền Admin: Đang mở khóa cấu hình
            </span>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-1.5 font-bold text-amber-900">
                <Lock className="h-4 w-4" />
                Chế độ Chỉ Xem (Chỉ Admin có quyền cấu hình)
              </span>
              <button
                type="button"
                onClick={handleSwitchToAdmin}
                className="rounded-lg bg-navy-900 px-3 py-1.5 font-bold text-white hover:bg-navy-700"
              >
                Chuyển sang tài khoản Admin
              </button>
            </div>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-800">
          <ShieldAlert className="h-4 w-4 shrink-0 text-red-600 mt-0.5" />
          <span className="font-semibold">{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div className="flex items-start gap-2.5 rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-900">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
          <span className="font-semibold">{successMsg}</span>
        </div>
      )}

      {/* 5 TABS DANH MỤC CHUNG — chỉ dùng khi không điều hướng từ menu */}
      {!tab && (
      <div className="flex flex-wrap gap-2 border-b border-line pb-2 text-xs">
        {(
          [
            {
              id: 'KHACH_HANG',
              label: '+ KHÁCH HÀNG',
              count: customers.length,
              icon: Users,
            },
            {
              id: 'VI_TRI',
              label: '+ VỊ TRÍ',
              count: state.yardBlocks.length,
              icon: MapPin,
            },
            {
              id: 'HANG_TAU',
              label: '+ HÃNG TÀU',
              count: shippingLines.length,
              icon: Ship,
            },
            {
              id: 'CONTAINER',
              label: '+ CONTAINER (SIZE - TYPE)',
              count: `${containerSizes.length} Size / ${containerTypes.length} Type`,
              icon: Box,
            },
            {
              id: 'BIEU_GIA',
              label: '+ BIỂU GIÁ (NÂNG HẠ & THU GOM RÁC)',
              count: feeCatalog.length,
              icon: Receipt,
            },
          ] as const
        ).map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                clearFeedback();
                setActiveTab(item.id);
              }}
              className={`inline-flex items-center gap-2 rounded-lg border px-3.5 py-2 font-bold transition ${
                active
                  ? 'border-navy-900 bg-navy-900 text-white shadow-xs'
                  : 'border-line bg-white text-ink hover:bg-canvas'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{item.label}</span>
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-black ${
                  active
                    ? 'bg-blue-800 text-white'
                    : 'bg-navy-50 text-ink-muted'
                }`}
              >
                {item.count}
              </span>
            </button>
          );
        })}
      </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 1: + KHÁCH HÀNG */}
      {/* ===================================================================== */}
      {activeTab === 'KHACH_HANG' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="lg:col-span-4 rounded-xl border border-line bg-white p-4 text-xs space-y-3">
            <h3 className="text-sm font-bold text-ink">
              Thêm Khách Hàng Mới (Admin)
            </h3>
            <form onSubmit={handleAddCustomer} className="space-y-3">
              <div>
                <label className="mb-1 block font-bold text-ink">
                  Mã Khách Hàng *
                </label>
                <input
                  type="text"
                  value={custCode}
                  onChange={(e) => setCustCode(e.target.value.toUpperCase())}
                  placeholder="VD: VIETLOG, NAMHAI..."
                  disabled={!isAdmin}
                  className="w-full rounded-lg border border-line-strong px-3 py-2 font-mono font-bold uppercase disabled:bg-navy-50"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block font-bold text-ink">
                  Tên Khách Hàng / Đại Diện KH *
                </label>
                <input
                  type="text"
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  placeholder="VD: Công ty Tiếp Vận Việt (VietLog)"
                  disabled={!isAdmin}
                  className="w-full rounded-lg border border-line-strong px-3 py-2 disabled:bg-navy-50"
                  required
                />
              </div>
              <label className="flex items-center gap-2 font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={custAllowTts}
                  onChange={(e) => setCustAllowTts(e.target.checked)}
                  disabled={!isAdmin}
                />
                Cho phép Thanh Toán Sau (TTS)
              </label>
              <button
                type="submit"
                disabled={!isAdmin}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-navy-900 py-2.5 font-bold text-white hover:bg-navy-700 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Thêm vào Danh Mục Khách Hàng
              </button>
            </form>
          </div>

          <div className="lg:col-span-8 rounded-xl border border-line bg-white overflow-hidden">
            <div className="border-b border-line bg-canvas px-4 py-2.5 text-xs font-bold text-ink">
              Danh sách KHÁCH HÀNG đã cấu hình ({customers.length})
            </div>
            <table className="data-table w-full text-left text-xs">
              <thead>
                <tr className="border-b border-line bg-navy-50 font-bold text-ink-muted">
                  <th className="px-4 py-2.5">Mã KH</th>
                  <th className="px-4 py-2.5">Tên Khách Hàng / Đại Diện</th>
                  <th className="px-4 py-2.5">Chính sách TTS</th>
                  <th className="px-4 py-2.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {customers.map((c) => (
                  <tr key={c.id} className="hover:bg-canvas">
                    <td className="px-4 py-2.5 font-mono font-bold text-navy-700">
                      {c.code}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-ink">
                      {c.name}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded px-2 py-0.5 text-[11px] font-bold ${
                          c.allowTts
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-navy-50 text-ink-muted'
                        }`}
                      >
                        {c.allowTts ? 'Được phép TTS' : 'Không TTS'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        disabled={!isAdmin}
                        onClick={() => {
                          clearFeedback();
                          onUpdateState(deletePartnerCatalogItem(state, c.id));
                        }}
                        className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-40"
                      >
                        <Trash2 className="h-3 w-3" />
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 2: + VỊ TRÍ */}
      {/* ===================================================================== */}
      {activeTab === 'VI_TRI' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="lg:col-span-4 rounded-xl border border-line bg-white p-4 text-xs space-y-3">
            <h3 className="text-sm font-bold text-ink">
              Thêm Vị Trí / Khu Vực Bãi (Admin)
            </h3>
            <form onSubmit={handleAddBlock} className="space-y-3">
              {/* DEC-082: mã luôn bắt đầu bằng BLOCK- — chỉ cần gõ A, B, C... */}
              <div>
                <label className="mb-1 block font-bold text-ink">Mã Vị Trí *</label>
                <div className="flex items-stretch overflow-hidden rounded-lg border border-line-strong">
                  <span className="flex items-center bg-navy-50 px-3 font-mono font-bold text-ink-muted">BLOCK-</span>
                  <input
                    type="text"
                    value={blockCode}
                    onChange={(e) => setBlockCode(e.target.value.toUpperCase().replace(/^BLOCK[-\s]*/, ''))}
                    placeholder="A, B, C..."
                    disabled={!isAdmin}
                    className="w-full px-3 py-2 font-mono font-bold uppercase outline-none disabled:bg-navy-50"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block font-bold text-ink">Mô tả thông tin</label>
                <textarea
                  value={blockDesc}
                  onChange={(e) => setBlockDesc(e.target.value)}
                  rows={2}
                  placeholder="VD: Khu lưu cont 40'HC AV sẵn sàng cấp vỏ..."
                  disabled={!isAdmin}
                  className="w-full rounded-lg border border-line-strong px-3 py-2 disabled:bg-navy-50"
                />
              </div>
              <div>
                <p className="mb-1 font-bold text-ink">Vị trí chi tiết (để trống = không dùng)</p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    ['Số Bay tối đa', maxBay, setMaxBay],
                    ['Số Row tối đa', maxRow, setMaxRow],
                    ['Số Tier tối đa', maxTier, setMaxTier],
                  ] as [string, string, (v: string) => void][]).map(([label, val, setVal]) => (
                    <label key={label}>
                      <span className="mb-1 block text-[11px] font-semibold text-ink-muted">{label}</span>
                      <input
                        type="number"
                        min={1}
                        value={val}
                        onChange={(e) => setVal(e.target.value)}
                        placeholder="Không dùng"
                        disabled={!isAdmin}
                        className="w-full rounded-lg border border-line-strong px-2.5 py-1.5 font-mono font-bold disabled:bg-navy-50"
                      />
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-ink-muted">
                  Chiều nào để trống thì khi đặt cont ở khu này sẽ không hiện và không yêu cầu nhập. Không nhập cả 3 → chỉ cần chọn Block, không giới hạn số cont.
                </p>
              </div>
              <label className="flex items-start gap-2 rounded-lg border border-line p-2.5">
                <input type="checkbox" checked={blockIsRack} onChange={(e) => setBlockIsRack(e.target.checked)} className="mt-0.5" />
                <span>
                  <span className="block font-bold text-ink">Đây là KỆ GIÁM ĐỊNH</span>
                  <span className="block text-[11px] text-ink-muted">Cont Giám định đánh dấu "Hạ kệ giám định" chỉ được Xe nâng hạ vào các khu này.</span>
                </span>
              </label>
              <button
                type="submit"
                disabled={!isAdmin}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-navy-900 py-2.5 font-bold text-white hover:bg-navy-700 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Thêm vào Danh Mục Vị Trí
              </button>
            </form>
          </div>

          <div className="lg:col-span-8 rounded-xl border border-line bg-white overflow-hidden">
            <div className="border-b border-line bg-canvas px-4 py-2.5 text-xs font-bold text-ink">
              Danh sách VỊ TRÍ BÃI đã cấu hình ({state.yardBlocks.length}) — Bộ phận Xe nâng chỉ được chọn trong danh sách này
            </div>
            <table className="data-table w-full text-left text-xs">
              <thead>
                <tr className="border-b border-line bg-navy-50 font-bold text-ink-muted">
                  <th className="px-4 py-2.5">Mã Vị Trí</th>
                  <th className="px-4 py-2.5">Tên Khu Vực</th>
                  <th className="px-4 py-2.5">Cấu hình Ô (Bay / Row / Tier)</th>
                  <th className="px-4 py-2.5 text-center">Kệ giám định</th>
                  <th className="px-4 py-2.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {state.yardBlocks.map((b) => (
                  <tr key={b.blockCode} className="hover:bg-canvas">
                    <td className="px-4 py-2.5 font-mono font-bold text-navy-700">
                      {b.blockCode}
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="font-semibold text-ink">{b.blockName}</p>
                      <p className="text-[11px] text-ink-muted">{b.description}</p>
                    </td>
                    <td className="px-4 py-2.5 font-mono text-ink">
                      {/* DEC-082: chỉ hiện chiều có cấu hình */}
                      {blockDimensions(b).length === 0
                        ? 'Chỉ Block — không giới hạn số cont'
                        : `${blockDimensions(b).map((d) => `${SLOT_DIMENSION_LABELS[d.key]}: 01..${String(d.max).padStart(2, '0')}`).join(' • ')} (${b.capacity} vị trí)`}
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <input
                        type="checkbox"
                        aria-label={`Kệ giám định ${b.blockCode}`}
                        checked={Boolean(b.isInspectionRack)}
                        disabled={!isAdmin}
                        onChange={(e) => {
                          clearFeedback();
                          try {
                            onUpdateState(setYardBlockInspectionRack(state, b.blockCode, e.target.checked));
                          } catch (err) {
                            setErrorMsg(err instanceof Error ? err.message : 'Lỗi cập nhật Kệ giám định');
                          }
                        }}
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        disabled={!isAdmin}
                        onClick={() => {
                          clearFeedback();
                          onUpdateState(
                            deleteYardBlockCatalogItem(state, b.blockCode)
                          );
                        }}
                        className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-40"
                      >
                        <Trash2 className="h-3 w-3" />
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 3: + HÃNG TÀU */}
      {/* ===================================================================== */}
      {activeTab === 'HANG_TAU' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <div className="lg:col-span-4 rounded-xl border border-line bg-white p-4 text-xs space-y-3">
            <h3 className="text-sm font-bold text-ink">
              Thêm Hãng Tàu Mới (Admin)
            </h3>
            <form onSubmit={handleAddShippingLine} className="space-y-3">
              <div>
                <label className="mb-1 block font-bold text-ink">
                  Mã Hãng Tàu *
                </label>
                <input
                  type="text"
                  value={lineCode}
                  onChange={(e) => setLineCode(e.target.value.toUpperCase())}
                  placeholder="VD: MSC, EVERGREEN, SITC..."
                  disabled={!isAdmin}
                  className="w-full rounded-lg border border-line-strong px-3 py-2 font-mono font-bold uppercase disabled:bg-navy-50"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block font-bold text-ink">
                  Tên Hãng Tàu *
                </label>
                <input
                  type="text"
                  value={lineName}
                  onChange={(e) => setLineName(e.target.value)}
                  placeholder="VD: Mediterranean Shipping Company (MSC)"
                  disabled={!isAdmin}
                  className="w-full rounded-lg border border-line-strong px-3 py-2 disabled:bg-navy-50"
                  required
                />
              </div>
              <label className="flex items-center gap-2 font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={lineAllowTts}
                  onChange={(e) => setLineAllowTts(e.target.checked)}
                  disabled={!isAdmin}
                />
                Hãng tàu áp dụng Thanh Toán Sau (TTS)
              </label>
              <button
                type="submit"
                disabled={!isAdmin}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-navy-900 py-2.5 font-bold text-white hover:bg-navy-700 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Thêm vào Danh Mục Hãng Tàu
              </button>
            </form>
          </div>

          <div className="lg:col-span-8 rounded-xl border border-line bg-white overflow-hidden">
            <div className="border-b border-line bg-canvas px-4 py-2.5 text-xs font-bold text-ink">
              Danh sách HÃNG TÀU đã cấu hình ({shippingLines.length})
            </div>
            <table className="data-table w-full text-left text-xs">
              <thead>
                <tr className="border-b border-line bg-navy-50 font-bold text-ink-muted">
                  <th className="px-4 py-2.5">Mã Hãng Tàu</th>
                  <th className="px-4 py-2.5">Tên Hãng Tàu</th>
                  <th className="px-4 py-2.5">Chính sách TTS</th>
                  <th className="px-4 py-2.5 text-center">Ưu tiên</th>
                  <th className="px-4 py-2.5 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {shippingLines.map((s) => (
                  <tr key={s.id} className="hover:bg-canvas">
                    <td className="px-4 py-2.5 font-mono font-bold text-indigo-700">
                      {s.code}
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-ink">
                      {s.name}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`rounded px-2 py-0.5 text-[11px] font-bold ${
                          s.allowTts
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-navy-50 text-ink-muted'
                        }`}
                      >
                        {s.allowTts ? 'Được phép TTS' : 'Không TTS'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      {/* DEC-166: hãng ưu tiên — Giám định Hạ vỏ chọn sẵn; chỉ 1 hãng */}
                      <input
                        type="checkbox"
                        aria-label={`Ưu tiên ${s.code}`}
                        checked={Boolean(s.isPriority)}
                        disabled={!isAdmin}
                        onChange={(e) => {
                          clearFeedback();
                          onUpdateState(setShippingLinePriority(state, { code: s.code, isPriority: e.target.checked }));
                        }}
                        className="h-4 w-4 accent-navy-900"
                      />
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        disabled={!isAdmin}
                        onClick={() => {
                          clearFeedback();
                          onUpdateState(deletePartnerCatalogItem(state, s.id));
                        }}
                        className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-40"
                      >
                        <Trash2 className="h-3 w-3" />
                        Xóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 4: + CONTAINER (SIZE - TYPE) */}
      {/* ===================================================================== */}
      {activeTab === 'CONTAINER' && (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {/* CẤU HÌNH SIZE */}
          <div className="rounded-xl border border-line bg-white p-4 text-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-ink">
                Cấu Hình CONTAINER — SIZE ({containerSizes.length})
              </h3>
              <p className="text-[11px] text-ink-muted">
                Các phần chọn SIZE trong hệ thống chỉ hiển thị theo danh sách này
              </p>
            </div>

            <form onSubmit={handleAddSize} className="flex gap-2">
              <input
                type="text"
                value={newSize}
                onChange={(e) => setNewSize(e.target.value.toUpperCase())}
                placeholder="Nhập Size mới (VD: 10, 20, 40, 45)..."
                disabled={!isAdmin}
                className="flex-1 rounded-lg border border-line-strong px-3 py-2 font-mono font-bold uppercase disabled:bg-navy-50"
                required
              />
              <button
                type="submit"
                disabled={!isAdmin}
                className="inline-flex items-center gap-1 rounded-lg bg-navy-900 px-4 py-2 font-bold text-white hover:bg-navy-700 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Thêm Size
              </button>
            </form>

            <div className="divide-y divide-line rounded-lg border border-line">
              {containerSizes.map((sz) => (
                <div
                  key={sz}
                  className="flex items-center justify-between px-3.5 py-2.5"
                >
                  <span className="font-mono text-sm font-black text-ink">
                    {sz}&apos;
                  </span>
                  <button
                    type="button"
                    disabled={!isAdmin}
                    onClick={() => {
                      clearFeedback();
                      onUpdateState(deleteContainerSizeCatalogItem(state, sz));
                    }}
                    className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-40"
                  >
                    <Trash2 className="h-3 w-3" />
                    Xóa
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* CẤU HÌNH TYPE */}
          <div className="rounded-xl border border-line bg-white p-4 text-xs space-y-4">
            <div>
              <h3 className="text-sm font-bold text-ink">
                Cấu Hình CONTAINER — TYPE ({containerTypes.length})
              </h3>
              <p className="text-[11px] text-ink-muted">
                Các phần chọn TYPE trong hệ thống chỉ hiển thị theo danh sách này
              </p>
            </div>

            <form onSubmit={handleAddType} className="flex gap-2">
              <input
                type="text"
                value={newType}
                onChange={(e) => setNewType(e.target.value.toUpperCase())}
                placeholder="Nhập Type mới (VD: DC, HC, OT, FR, RF)..."
                disabled={!isAdmin}
                className="flex-1 rounded-lg border border-line-strong px-3 py-2 font-mono font-bold uppercase disabled:bg-navy-50"
                required
              />
              <button
                type="submit"
                disabled={!isAdmin}
                className="inline-flex items-center gap-1 rounded-lg bg-navy-900 px-4 py-2 font-bold text-white hover:bg-navy-700 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Thêm Type
              </button>
            </form>

            <div className="divide-y divide-line rounded-lg border border-line">
              {containerTypes.map((tp) => (
                <div
                  key={tp}
                  className="flex items-center justify-between px-3.5 py-2.5"
                >
                  <span className="font-mono text-sm font-black text-ink">
                    {tp}
                  </span>
                  <button
                    type="button"
                    disabled={!isAdmin}
                    onClick={() => {
                      clearFeedback();
                      onUpdateState(deleteContainerTypeCatalogItem(state, tp));
                    }}
                    className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-40"
                  >
                    <Trash2 className="h-3 w-3" />
                    Xóa
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* TAB 5: + BIỂU GIÁ (NÂNG HẠ THEO SIZE - TYPE - HÃNG TÀU & THU GOM RÁC) */}
      {/* ===================================================================== */}
      {activeTab === 'BIEU_GIA' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* FORM THÊM NHIỀU BIỂU GIÁ KHÁC NHAU (CHỈ ADMIN) */}
          <div className="lg:col-span-4 rounded-xl border border-line bg-white p-4 text-xs space-y-3">
            <div>
              <h3 className="text-sm font-bold text-ink">
                Thêm Biểu Giá Mới (Admin)
              </h3>
              <p className="text-[11px] text-ink-muted">
                Cho phép thêm nhiều biểu giá khác nhau (Đơn giá ĐÃ BAO GỒM VAT)
              </p>
            </div>

            <form onSubmit={handleAddTariff} className="space-y-3">
              <div>
                <label className="mb-1 block font-bold text-ink">
                  Nhóm Biểu Giá *
                </label>
                <select
                  value={tariffCategory}
                  onChange={(e) =>
                    setTariffCategory(e.target.value as FeeTariffCategory)
                  }
                  disabled={!isAdmin}
                  className="w-full rounded-lg border border-line-strong px-3 py-2 font-bold text-ink disabled:bg-navy-50"
                >
                  <option value="NANG_HA">
                    - NÂNG HẠ (Theo từng Size - Type - Hãng tàu)
                  </option>
                  <option value="THU_GOM_RAC">- THU GOM RÁC</option>
                  <option value="KHAC">
                    - BIỂU GIÁ KHÁC (Vệ sinh / Dịch vụ bãi)
                  </option>
                </select>
              </div>

              {tariffCategory === 'NANG_HA' && (
                <div className="grid grid-cols-3 gap-2 rounded-lg border border-line-strong bg-navy-50/50 p-2.5">
                  <div>
                    <label className="mb-1 block font-bold text-ink">
                      SIZE *
                    </label>
                    <select
                      value={tariffSize}
                      onChange={(e) => setTariffSize(e.target.value)}
                      disabled={!isAdmin}
                      className="w-full rounded border border-line-strong bg-white px-2 py-1.5 font-mono font-bold"
                    >
                      {containerSizes.map((s) => (
                        <option key={s} value={s}>
                          {s}&apos;
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block font-bold text-ink">
                      TYPE *
                    </label>
                    <select
                      value={tariffType}
                      onChange={(e) => setTariffType(e.target.value)}
                      disabled={!isAdmin}
                      className="w-full rounded border border-line-strong bg-white px-2 py-1.5 font-mono font-bold"
                    >
                      {containerTypes.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block font-bold text-ink">
                      HÃNG TÀU *
                    </label>
                    <select
                      value={tariffShippingLine}
                      onChange={(e) => setTariffShippingLine(e.target.value)}
                      disabled={!isAdmin}
                      className="w-full rounded border border-line-strong bg-white px-2 py-1.5 font-mono font-bold"
                    >
                      {shippingLines.map((l) => (
                        <option key={l.id} value={l.code}>
                          {l.code}
                        </option>
                      ))}
                      <option value="ALL">Tất cả (ALL)</option>
                    </select>
                  </div>
                </div>
              )}

              {tariffCategory === 'THU_GOM_RAC' && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-2.5">
                  <label className="mb-1 block font-bold text-ink">
                    Áp dụng theo SIZE (Tùy chọn)
                  </label>
                  <select
                    value={tariffSize}
                    onChange={(e) => setTariffSize(e.target.value)}
                    disabled={!isAdmin}
                    className="w-full rounded border border-line-strong bg-white px-2.5 py-1.5 font-mono font-bold"
                  >
                    <option value="">Áp dụng chung mọi Size</option>
                    {containerSizes.map((s) => (
                      <option key={s} value={s}>
                        Cont {s}&apos;
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="mb-1 block font-bold text-ink">
                  Tên hiển thị Biểu Giá (Để trống sẽ tự sinh theo cấu hình)
                </label>
                <input
                  type="text"
                  value={tariffName}
                  onChange={(e) => setTariffName(e.target.value)}
                  placeholder={
                    tariffCategory === 'NANG_HA'
                      ? `VD: Nâng hạ vỏ ${tariffSize}' ${tariffType} — Hãng tàu ${tariffShippingLine} (Đã gồm VAT)`
                      : tariffCategory === 'THU_GOM_RAC'
                      ? 'VD: Phí thu gom rác container (Đã gồm VAT)'
                      : 'VD: Phí vệ sinh / phụ phí dịch vụ bãi...'
                  }
                  disabled={!isAdmin}
                  className="w-full rounded-lg border border-line-strong px-3 py-2 disabled:bg-navy-50"
                />
              </div>

              <div>
                <label className="mb-1 block font-bold text-ink">
                  Đơn giá ĐÃ BAO GỒM VAT (VNĐ) *
                </label>
                <input
                  type="number"
                  min={0}
                  value={tariffAmount}
                  onChange={(e) => setTariffAmount(Number(e.target.value))}
                  disabled={!isAdmin}
                  className="w-full rounded-lg border border-line-strong px-3 py-2 font-mono text-sm font-black text-emerald-700 disabled:bg-navy-50"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={!isAdmin}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-navy-900 py-2.5 font-bold text-white hover:bg-navy-700 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                Thêm Biểu Giá vào Danh Mục Chung
              </button>
            </form>
          </div>

          {/* DANH SÁCH BIỂU GIÁ ĐÃ CẤU HÌNH */}
          <div className="lg:col-span-8 rounded-xl border border-line bg-white overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-canvas px-4 py-2.5 text-xs">
              <span className="font-bold text-ink">
                Danh sách BIỂU GIÁ đã cấu hình ({feeCatalog.length} biểu giá — ĐÃ BAO GỒM VAT)
              </span>
              <div className="flex items-center gap-1.5">
                {(
                  [
                    { id: 'ALL', label: 'Tất cả' },
                    { id: 'NANG_HA', label: 'Nâng hạ (Size-Type-Hãng tàu)' },
                    { id: 'THU_GOM_RAC', label: 'Thu gom rác' },
                    { id: 'KHAC', label: 'Khác / Vệ sinh' },
                  ] as const
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFilterTariffCat(f.id)}
                    className={`rounded px-2.5 py-1 text-[11px] font-bold ${
                      filterTariffCat === f.id
                        ? 'bg-navy-900 text-white'
                        : 'bg-white border border-line text-ink-muted hover:bg-navy-50'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <table className="data-table w-full text-left text-xs">
              <thead>
                <tr className="border-b border-line bg-navy-50 font-bold text-ink-muted">
                  <th className="px-3.5 py-2.5">Nhóm</th>
                  <th className="px-3.5 py-2.5">Cấu hình (Size - Type - Hãng tàu)</th>
                  <th className="px-3.5 py-2.5">Tên Biểu Giá</th>
                  <th className="px-3.5 py-2.5 text-right">Đơn giá (Đã gồm VAT)</th>
                  <th className="px-3.5 py-2.5 text-right">Xóa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {feeCatalog
                  .filter(
                    (item) =>
                      filterTariffCat === 'ALL' ||
                      (item.category || 'KHAC') === filterTariffCat
                  )
                  .map((item) => {
                    const cat = item.category || 'KHAC';
                    return (
                      <tr key={item.id} className="hover:bg-canvas">
                        <td className="px-3.5 py-2.5">
                          <span
                            className={`inline-block rounded px-2 py-0.5 text-[10px] font-black ${
                              cat === 'NANG_HA'
                                ? 'bg-navy-50 text-navy-900'
                                : cat === 'THU_GOM_RAC'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-navy-50 text-ink'
                            }`}
                          >
                            {cat === 'NANG_HA'
                              ? 'NÂNG HẠ'
                              : cat === 'THU_GOM_RAC'
                              ? 'THU GOM RÁC'
                              : 'DỊCH VỤ / VS'}
                          </span>
                        </td>
                        <td className="px-3.5 py-2.5 font-mono text-[11px] font-bold text-ink">
                          {cat === 'NANG_HA' ? (
                            <span>
                              {item.size || 'ALL'}&apos; • {item.type || 'ALL'} •{' '}
                              <strong className="text-indigo-700">
                                {item.shippingLineCode || 'ALL'}
                              </strong>
                            </span>
                          ) : item.size ? (
                            <span>Cont {item.size}&apos;</span>
                          ) : (
                            <span className="text-ink-muted">Chung</span>
                          )}
                        </td>
                        <td className="px-3.5 py-2.5 font-semibold text-ink">
                          {item.name}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-mono font-bold text-emerald-700">
                          {formatVnd(item.defaultAmountInclVat)}
                        </td>
                        <td className="px-3.5 py-2.5 text-right">
                          <button
                            type="button"
                            disabled={!isAdmin}
                            onClick={() => {
                              clearFeedback();
                              onUpdateState(
                                deleteDepotFeeCatalogItem(state, item.id)
                              );
                            }}
                            className="inline-flex items-center gap-1 rounded border border-rose-200 bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-40"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
