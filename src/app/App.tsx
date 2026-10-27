import React, { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  Building2,
  Calculator,
  ChartColumn,
  ChevronDown,
  ClipboardCheck,
  Forklift,
  KeyRound,
  LogOut,
  Menu,
  PanelLeft,
  RefreshCw,
  Settings2,
  Smartphone,
  SprayCan,
  UserCheck,
  Wrench,
  X,
} from 'lucide-react';
import { K80InternalTicket, ROLE_LABELS, WorkspaceMenuId } from '../types/depot';
import { DepotState, loadDepotState, resetDepotState, saveDepotState } from '../services/depotStore';
import { createDemoState } from '../services/demoData';
import { canOpenMenu } from '../services/permissions';
import { isSupabaseConfigured } from '../lib/env';
import { openVesselLists, VesselFieldStep, vesselStepSummary } from '../services/vessel';
import { FieldQueueMode, FieldQueueWorkspaces, getFieldQueue } from '../features/field-queues/FieldQueueWorkspaces';
import { ticketsAwaitingReturn } from '../services/driverRoute';
import { pendingRackInspections } from '../services/depotOperations';
import { FeedbackButton } from '../components/FeedbackButton';
import { ScreenLoading } from '../components/LoadingScreens';
import type { VesselFieldMode } from '../features/vessel/VesselFieldMobile';
import type { CatalogTab } from '../features/catalog/MasterCatalogWorkspace';
import type { ReportSection } from '../features/reports/ReportsWorkspace';

// Màn hình tải khi mở lần đầu (tách file) → mở app nhanh hơn; màn đã mở lần sau hiện ngay
// Sau khi app mở xong và rảnh → tải sẵn các màn còn lại (chạy ngầm, lần lượt) → bấm menu là mở ngay
const SCREEN_LOADERS: (() => Promise<unknown>)[] = [];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const named = <M extends Record<K, React.ComponentType<any>>, K extends keyof M>(load: () => Promise<M>, name: K) => {
  SCREEN_LOADERS.push(load);
  return lazy(async () => ({ default: (await load())[name] })); // giữ nguyên kiểu props của màn hình
};
// Thư viện tạo mã QR (phiếu K80 / phiếu trả trước) — tải sẵn để lúc in mã hiện ngay
SCREEN_LOADERS.push(() => import('qrcode'));
function preloadScreens(): () => void {
  let stopped = false;
  // Trình duyệt không có requestIdleCallback (Safari cũ) → đợi 1,5 giây
  const idle = (fn: () => void) =>
    typeof window.requestIdleCallback === 'function' ? window.requestIdleCallback(fn, { timeout: 3000 }) : setTimeout(fn, 1500);
  const next = (i: number) => {
    if (stopped || i >= SCREEN_LOADERS.length) return;
    SCREEN_LOADERS[i]().catch(() => {}).finally(() => idle(() => next(i + 1)));
  };
  const start = window.setTimeout(() => idle(() => next(0)), 1500);
  return () => {
    stopped = true;
    window.clearTimeout(start);
  };
}
const InspectorHaVoMobile = named(() => import('../features/inspector/InspectorHaVoMobile'), 'InspectorHaVoMobile');
const OfficeHaVoWorkspace = named(() => import('../features/office/OfficeWorkspaces'), 'OfficeHaVoWorkspace');
const OfficeCapVoWorkspace = named(() => import('../features/office/OfficeWorkspaces'), 'OfficeCapVoWorkspace');
const OfficeVesselWorkspace = named(() => import('../features/vessel/OfficeVesselWorkspace'), 'OfficeVesselWorkspace');
const VesselFieldMobile = named(() => import('../features/vessel/VesselFieldMobile'), 'VesselFieldMobile');
const YardShiftWorkspace = named(() => import('../features/forklift/YardShiftWorkspace'), 'YardShiftWorkspace');
const YardFeature = named(() => import('../features/yard/YardFeature'), 'YardFeature');
const MasterCatalogWorkspace = named(() => import('../features/catalog/MasterCatalogWorkspace'), 'MasterCatalogWorkspace');
const ReportsWorkspace = named(() => import('../features/reports/ReportsWorkspace'), 'ReportsWorkspace');
const ReceiptsWorkspace = named(() => import('../features/receipts/ReceiptsWorkspace'), 'ReceiptsWorkspace');
const DocumentReturnWorkspace = named(() => import('../features/office/DocumentReturnWorkspace'), 'DocumentReturnWorkspace');
const RepairTeamCatalog = named(() => import('../features/catalog/RepairTeamCatalog'), 'RepairTeamCatalog');
const UserRoleCatalog = named(() => import('../features/catalog/UserRoleCatalog'), 'UserRoleCatalog');
const CompanyCatalog = named(() => import('../features/catalog/CompanyCatalog'), 'CompanyCatalog');
const FeedbackReport = named(() => import('../features/reports/FeedbackReport'), 'FeedbackReport');
const MasterDossierModal = named(() => import('../components/MasterDossierModal'), 'MasterDossierModal');
const K80TicketModal = named(() => import('../components/K80TicketModal'), 'K80TicketModal');

interface MenuItem {
  id: WorkspaceMenuId;
  label: string;
  mobile?: boolean; // Tác nghiệp hiện trường dùng trên điện thoại (DEC-012)
}
interface MenuGroup {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: MenuItem[];
}

// Cấu trúc menu theo nghiệp vụ (CR-09). Tên mục giữ nguyên tên nghiệp vụ đã dùng.
const MENU: MenuGroup[] = [
  { key: 'TON_VO', label: 'Tồn vỏ', icon: Boxes, items: [{ id: 'TON_VO', label: 'Danh sách tồn vỏ' }] },
  { key: 'GD', label: 'Giám định', icon: ClipboardCheck, items: [
    { id: 'GD_HA_VO', label: 'Hạ vỏ', mobile: true },
    { id: 'GD_NHAP_TAU', label: 'Nhập tàu', mobile: true },
    { id: 'GD_XUAT_TAU', label: 'Xuất tàu', mobile: true },
  ] },
  {
    key: 'VP',
    label: 'Văn phòng',
    icon: Building2,
    items: [
      { id: 'VP_HA_VO', label: 'Hạ vỏ' },
      { id: 'VP_CAP_VO', label: 'Cấp vỏ' },
      { id: 'VP_PHIEU_THU', label: 'Phiếu thu' },
      { id: 'VP_TRA_CHUNG_TU', label: 'Trả chứng từ' },
      { id: 'VP_NHAP_TAU', label: 'Nhập tàu' },
      { id: 'VP_XUAT_TAU', label: 'Xuất tàu' },
    ],
  },
  { key: 'VS', label: 'Vệ sinh', icon: SprayCan, items: [
    { id: 'VS_CHO_VE_SINH', label: 'Chờ vệ sinh', mobile: true },
  ] },
  {
    key: 'XN',
    label: 'Xe nâng',
    icon: Forklift,
    items: [
      { id: 'XN_CHO_HA_VO', label: 'Chờ hạ vỏ', mobile: true },
      { id: 'XN_CHO_CAP_VO', label: 'Chờ cấp vỏ', mobile: true },
      { id: 'XN_DAO_CHUYEN', label: 'Đảo chuyển', mobile: true },
      { id: 'XN_NHAP_TAU', label: 'Nhập tàu', mobile: true },
      { id: 'XN_XUAT_TAU', label: 'Xuất tàu', mobile: true },
    ],
  },
  { key: 'BG', label: 'Báo giá', icon: Calculator, items: [{ id: 'BG_CHO_BAO_GIA', label: 'Chờ báo giá' }] },
  { key: 'SC', label: 'Sửa chữa', icon: Wrench, items: [{ id: 'SC_CHO_SUA_CHUA', label: 'Chờ sửa chữa', mobile: true }] },
  {
    key: 'BC',
    label: 'Báo cáo',
    icon: ChartColumn,
    items: [
      { id: 'BC_HA_VO', label: 'Hạ vỏ' },
      { id: 'BC_CAP_VO', label: 'Cấp vỏ' },
      { id: 'BC_NHAP_TAU', label: 'Nhập tàu' },
      { id: 'BC_XUAT_TAU', label: 'Xuất tàu' },
      { id: 'BC_SUA_CHUA', label: 'Sửa chữa' },
      { id: 'BC_TONG_HOP', label: 'Tổng hợp' },
      { id: 'BC_GOP_Y', label: 'Góp ý' }, // DEC-120: chỉ Admin
    ],
  },
  {
    key: 'DM',
    label: 'Danh mục chung',
    icon: Settings2,
    items: [
      { id: 'DM_KHACH_HANG', label: 'Khách hàng' },
      { id: 'DM_HANG_TAU', label: 'Hãng tàu' },
      { id: 'DM_VI_TRI', label: 'Vị trí bãi' },
      { id: 'DM_CONTAINER', label: 'Container' },
      { id: 'DM_BIEU_GIA', label: 'Biểu giá' },
      { id: 'DM_CONG_TY', label: 'Công ty' },
      { id: 'DM_SUA_CHUA', label: 'Sửa chữa' },
      { id: 'DM_USER', label: 'User - Role' }, // DEC-144: đổi tên menu (giữ lại)
    ],
  },
];

const FIELD_QUEUE_MENUS: FieldQueueMode[] = ['VS_CHO_VE_SINH', 'XN_CHO_HA_VO', 'XN_CHO_CAP_VO', 'BG_CHO_BAO_GIA', 'SC_CHO_SUA_CHUA'];
const VESSEL_FIELD_MENUS: VesselFieldMode[] = ['GD_NHAP_TAU', 'GD_XUAT_TAU', 'XN_NHAP_TAU', 'XN_XUAT_TAU'];
const MOBILE_MENU_IDS = new Set<WorkspaceMenuId>(MENU.flatMap((g) => g.items.filter((i) => i.mobile).map((i) => i.id)));
const CATALOG_TABS: Partial<Record<WorkspaceMenuId, CatalogTab>> = {
  DM_KHACH_HANG: 'KHACH_HANG',
  DM_HANG_TAU: 'HANG_TAU',
  DM_VI_TRI: 'VI_TRI',
  DM_CONTAINER: 'CONTAINER',
  DM_BIEU_GIA: 'BIEU_GIA',
};
const REPORT_MENUS: ReportSection[] = ['BC_HA_VO', 'BC_CAP_VO', 'BC_NHAP_TAU', 'BC_XUAT_TAU', 'BC_SUA_CHUA', 'BC_TONG_HOP'];

const UI_PREFS_KEY = 'matran_depot_ui_prefs_v1';
function readPrefs(): { collapsedGroups: string[]; railMode: boolean } {
  try {
    const raw = localStorage.getItem(UI_PREFS_KEY);
    if (raw) return { collapsedGroups: [], railMode: false, ...JSON.parse(raw) };
  } catch {
    // bỏ qua nếu trình duyệt chặn localStorage
  }
  return { collapsedGroups: [], railMode: false };
}
function writePrefs(p: { collapsedGroups: string[]; railMode: boolean }) {
  try {
    localStorage.setItem(UI_PREFS_KEY, JSON.stringify(p));
  } catch {
    // bỏ qua
  }
}

// DEC-155: chế độ database — RemoteApp truyền dữ liệu đã tải + thông tin phiên; không có thì chạy Demo như cũ
export interface RemoteSessionProps {
  fullName: string;
  username: string;
  onSignOut: () => void;
  onChangePassword: () => void;
  onReload?: () => void;
}

export const App: React.FC<{ initialState?: DepotState; remote?: RemoteSessionProps }> = ({ initialState, remote }) => {
  const [state, setState] = useState<DepotState>(() => initialState || loadDepotState(createDemoState));
  // Chế độ database: dữ liệu thật vừa tải lại → thay dữ liệu đang hiển thị (giữ menu / bộ lọc đang mở)
  const isRemote = Boolean(remote);
  useEffect(() => {
    // Chỉ chạy khi có dữ liệu mới từ database (không chạy lại mỗi lần RemoteApp vẽ lại)
    if (isRemote && initialState) setState(initialState);
  }, [initialState, isRemote]);
  useEffect(() => preloadScreens(), []);
  const [activeMenu, setActiveMenu] = useState<WorkspaceMenuId>('GD_HA_VO');
  const [activeK80Ticket, setActiveK80Ticket] = useState<K80InternalTicket | null>(null);
  const [activeDossierCode, setActiveDossierCode] = useState<string | null>(null);
  const [simulatedQr, setSimulatedQr] = useState('');
  const [receiptFocus, setReceiptFocus] = useState<{ key: string; nonce: number } | null>(null);
  // DEC-051, DEC-105: mở thẳng Văn phòng → Phiếu thu (chỉ khi user được vào menu Phiếu thu)
  const openReceipt = canOpenMenu(state.currentUser, 'VP_PHIEU_THU')
    ? (key: string) => {
        setActiveDossierCode(null);
        setReceiptFocus({ key, nonce: Date.now() });
        setActiveMenu('VP_PHIEU_THU');
      }
    : undefined;
  const [prefs, setPrefs] = useState(readPrefs);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // DEC-120: danh sách MENU / TÍNH NĂNG để chọn khi góp ý (menu người dùng được thấy) và để Admin lọc báo cáo (mọi menu)
  const toOptions = (groups: MenuGroup[]) => groups.flatMap((g) => g.items.map((i) => ({ id: i.id, label: `${g.label} → ${i.label}`, group: g.label, item: i.label })));
  const allMenuOptions = toOptions(MENU);

  const handleUpdateState = (next: DepotState) => {
    setState(next);
    // Chế độ database: thao tác đã xếp hàng chờ ghi (services/api.ts); không ghi localStorage để không lẫn với Demo
    if (!remote) saveDepotState(next);
  };

  const visibleMenu = useMemo(
    () =>
      MENU.map((g) => ({ ...g, items: g.items.filter((i) => canOpenMenu(state.currentUser, i.id)) })).filter(
        (g) => g.items.length > 0
      ),
    [state.currentUser]
  );
  const feedbackMenuOptions = toOptions(visibleMenu);

  // Đổi người dùng → nếu không còn quyền với màn hình hiện tại thì chuyển sang mục đầu tiên được phép
  useEffect(() => {
    if (!canOpenMenu(state.currentUser, activeMenu)) {
      const first = visibleMenu[0]?.items[0]?.id;
      if (first) setActiveMenu(first);
    }
  }, [state.currentUser, activeMenu, visibleMenu]);

  const badges: Partial<Record<WorkspaceMenuId, number>> = {
    TON_VO: state.containers.filter((c) => c.status !== 'GATED_OUT').length,
    // DEC-147: + phiếu chờ giám định trên kệ (cont đã hạ lên kệ)
    GD_HA_VO: state.gateInOrders.filter((o) => o.status === 'FIELD_RECORDED').length + pendingRackInspections(state).filter((c) => c.status === 'IN_YARD').length,
    VP_HA_VO: state.gateInOrders.filter((o) => o.status !== 'GATE_IN_OK' && o.status !== 'CANCELLED').length,
    VP_CAP_VO: state.gateOutOrders.filter((o) => o.status === 'PAYMENT_PENDING').length,
    VP_PHIEU_THU: state.paymentTransactions.filter((t) => t.status === 'PENDING').length,
    VP_TRA_CHUNG_TU: ticketsAwaitingReturn(state).length,
  };
  for (const m of FIELD_QUEUE_MENUS) badges[m] = getFieldQueue(state, m).length;
  // DEC-075: số cont chờ làm của từng bước Nhập tàu / Xuất tàu (cộng các tàu đang mở)
  const vesselTodo = (mode: "NHAP_TAU" | "XUAT_TAU", step: VesselFieldStep) =>
    openVesselLists(state, mode).reduce((s, l) => s + vesselStepSummary(state, step, l).todo, 0);
  badges.GD_NHAP_TAU = vesselTodo("NHAP_TAU", "NT_INSPECT");
  badges.XN_NHAP_TAU = vesselTodo("NHAP_TAU", "NT_PLACE");
  badges.GD_XUAT_TAU = badges.XN_XUAT_TAU = vesselTodo("XUAT_TAU", "XT_EXPORT");
  badges.VP_NHAP_TAU = openVesselLists(state, "NHAP_TAU").length;
  badges.VP_XUAT_TAU = openVesselLists(state, "XUAT_TAU").length;
  // Việc hiện trường (mục mobile) đang chờ → nổi bật màu cam để bộ phận thấy ngay
  const urgent = (id: WorkspaceMenuId) => Boolean(MOBILE_MENU_IDS.has(id) && (badges[id] || 0) > 0);

  const toggleGroup = (key: string) => {
    const collapsedGroups = prefs.collapsedGroups.includes(key)
      ? prefs.collapsedGroups.filter((k) => k !== key)
      : [...prefs.collapsedGroups, key];
    const next = { ...prefs, collapsedGroups };
    setPrefs(next);
    writePrefs(next);
  };
  const toggleRail = () => {
    const next = { ...prefs, railMode: !prefs.railMode };
    setPrefs(next);
    writePrefs(next);
  };
  const selectMenu = (id: WorkspaceMenuId) => {
    setActiveMenu(id);
    setDrawerOpen(false);
  };

  const activeGroup = MENU.find((g) => g.items.some((i) => i.id === activeMenu));
  const activeItem = activeGroup?.items.find((i) => i.id === activeMenu);

  const renderNav = (rail: boolean) => (
    <nav aria-label="Menu tác nghiệp" className="space-y-1 text-xs">
      {visibleMenu.map((g) => {
        const Icon = g.icon;
        const containsActive = g.items.some((i) => i.id === activeMenu);
        const single = g.key === 'TON_VO';
        const collapsed = prefs.collapsedGroups.includes(g.key) && !containsActive;
        const groupBadge = g.items.reduce((s, i) => s + (badges[i.id] || 0), 0);
        const groupUrgent = g.items.some((i) => urgent(i.id));

        if (rail) {
          return (
            <button
              key={g.key}
              type="button"
              title={g.label}
              aria-label={g.label}
              onClick={() => selectMenu(g.items[0].id)}
              className={`relative flex h-10 w-10 items-center justify-center rounded-md ${
                containsActive ? 'bg-navy-900 text-white' : 'text-ink-muted hover:bg-navy-50'
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
              {groupBadge > 0 && !single && (
                <span className={`absolute -right-0.5 -top-0.5 rounded-full px-1 text-[9px] font-bold text-white ${groupUrgent ? "animate-pulse bg-amber-500" : "bg-navy-900"}`}>{groupBadge}</span>
              )}
            </button>
          );
        }

        if (single) {
          const item = g.items[0];
          return (
            <button
              key={g.key}
              type="button"
              onClick={() => selectMenu(item.id)}
              aria-current={activeMenu === item.id ? 'page' : undefined}
              className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 font-semibold ${
                activeMenu === item.id ? 'bg-navy-900 text-white' : 'text-ink hover:bg-navy-50'
              }`}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className="flex-1 text-left">{g.label}</span>
              {badges[item.id] !== undefined && <span className="font-mono text-[11px] opacity-70">{badges[item.id]}</span>}
            </button>
          );
        }

        return (
          <div key={g.key}>
            <button
              type="button"
              onClick={() => toggleGroup(g.key)}
              aria-expanded={!collapsed}
              className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 font-semibold ${
                containsActive ? 'text-navy-700' : 'text-ink'
              } hover:bg-navy-50`}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className="flex-1 text-left">{g.label}</span>
              {collapsed && groupBadge > 0 && <span className={`font-mono text-[11px] ${groupUrgent ? "rounded bg-amber-500 px-1.5 font-bold text-white" : "text-ink-muted"}`}>{groupBadge}</span>}
              <ChevronDown className={`h-3.5 w-3.5 text-ink-muted transition-transform ${collapsed ? '-rotate-90' : ''}`} />
            </button>
            {!collapsed && (
              <ul className="ml-[18px] mt-0.5 space-y-0.5 border-l border-line pl-3">
                {g.items.map((item) => {
                  const active = activeMenu === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => selectMenu(item.id)}
                        aria-current={active ? 'page' : undefined}
                        className={`flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-left ${
                          active ? 'bg-navy-900 font-semibold text-white' : 'text-ink-muted hover:bg-navy-50 hover:text-ink'
                        }`}
                      >
                        {/* DEC-078: 3 cột cố định — tên | biểu tượng mobile | số đếm — để biểu tượng mobile thẳng hàng */}
                        <span className="min-w-0 flex-1 truncate">{item.label}</span>
                        <span className="flex w-6 shrink-0 justify-center">
                          {item.mobile && (
                            <span
                              title="Tác nghiệp mobile"
                              aria-label="Tác nghiệp mobile"
                              className={`inline-flex items-center rounded px-1 py-0.5 ${active ? 'bg-white/20 text-white' : 'bg-emerald-50 text-emerald-700'}`}
                            >
                              <Smartphone className="h-3 w-3" />
                            </span>
                          )}
                        </span>
                        <span className="flex w-9 shrink-0 justify-end">
                          {badges[item.id] !== undefined && (badges[item.id]! > 0 || active) && (
                            <span
                              title={urgent(item.id) ? "Có việc đang chờ" : undefined}
                              className={`inline-flex items-center gap-1 rounded px-1.5 font-mono text-[10px] font-bold ${
                                urgent(item.id) ? "bg-amber-500 text-white" : active ? "bg-white/20" : "bg-navy-50 text-ink"
                              }`}
                            >
                              {urgent(item.id) && !active && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" aria-label="Có việc đang chờ" />}
                              {badges[item.id]}
                            </span>
                          )}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </nav>
  );

  const brand = (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-navy-900 text-[11px] font-black text-white">MD</div>
      <div className="leading-tight">
        <p className="text-sm font-bold text-ink">MATRAN DEPOT</p>
        <p className="text-[10px] text-ink-muted">Quản lý bãi container rỗng</p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-canvas text-ink">
      {/* Menu máy tính */}
      <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-white lg:flex ${prefs.railMode ? 'w-16 items-center' : 'w-60'}`}>
        <div className={`flex items-center border-b border-line py-3 ${prefs.railMode ? 'justify-center' : 'justify-between px-3'}`}>
          {!prefs.railMode && brand}
          <button type="button" onClick={toggleRail} aria-label={prefs.railMode ? 'Mở rộng menu' : 'Thu gọn menu'} className="rounded-md p-1.5 text-ink-muted hover:bg-navy-50">
            <PanelLeft className="h-4 w-4" />
          </button>
        </div>
        <div className={`flex-1 overflow-y-auto py-3 ${prefs.railMode ? 'space-y-1 px-2' : 'px-2'}`}>{renderNav(prefs.railMode)}</div>
      </aside>

      {/* Menu điện thoại */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Đóng menu" className="absolute inset-0 bg-black/40" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-line px-3 py-3">
              {brand}
              <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Đóng menu" className="rounded-md p-1.5 text-ink-muted hover:bg-navy-50">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-3">{renderNav(false)}</div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-line bg-white px-4 py-2">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Mở menu" className="rounded-md border border-line p-1.5 text-ink-muted lg:hidden">
              <Menu className="h-4 w-4" />
            </button>
            <p className="text-xs text-ink-muted">
              {activeGroup && activeGroup.items.length > 1 && <span>{activeGroup.label} / </span>}
              <span className="font-bold text-ink">{activeItem?.label}</span>
            </p>
            {activeItem?.mobile && (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                <Smartphone className="h-3 w-3" />
                Mobile
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* DEC-120: Góp ý — mọi người dùng, góc trên bên phải */}
            <FeedbackButton state={state} onUpdateState={handleUpdateState} menuOptions={feedbackMenuOptions} />
            {!isSupabaseConfigured && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">DEMO</span>}
            {remote ? (
              <>
                <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-canvas px-2 py-1" data-testid="session-user">
                  <UserCheck className="h-3.5 w-3.5 text-ink-muted" />
                  <span className="font-medium text-ink">{remote.fullName}</span>
                  <span className="font-mono text-ink-muted">{remote.username}</span>
                </span>
                {remote.onReload && (
                  <button type="button" onClick={remote.onReload} className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-2 py-1 text-ink-muted hover:bg-canvas" data-testid="reload-data">
                    <RefreshCw className="h-3 w-3" />
                    Tải lại
                  </button>
                )}
                <button type="button" onClick={remote.onChangePassword} className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-2 py-1 text-ink-muted hover:bg-canvas">
                  <KeyRound className="h-3 w-3" />
                  Đổi mật khẩu
                </button>
                <button type="button" onClick={remote.onSignOut} className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-2 py-1 text-ink-muted hover:bg-canvas" data-testid="sign-out">
                  <LogOut className="h-3 w-3" />
                  Đăng xuất
                </button>
              </>
            ) : (<>
            <label className="flex items-center gap-1.5 rounded-md border border-line bg-canvas px-2 py-1">
              <UserCheck className="h-3.5 w-3.5 text-ink-muted" />
              <span className="sr-only">Người dùng (Demo)</span>
              <select
                value={state.currentUser.id}
                onChange={(e) => {
                  const found = state.staffUsers.find((u) => u.id === e.target.value);
                  if (found) handleUpdateState({ ...state, currentUser: found });
                }}
                className="max-w-[220px] bg-transparent font-medium text-ink focus:outline-hidden"
              >
                {state.staffUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({u.roles.map((r) => ROLE_LABELS[r]).join(', ')})
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => { if (window.confirm('Xóa toàn bộ dữ liệu tác nghiệp (container, lệnh, phiếu thu…)? Danh mục và góp ý được giữ lại.')) handleUpdateState({ ...resetDepotState(), feedbacks: state.feedbacks || [] }); }} className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-2 py-1 text-ink-muted hover:bg-canvas">
              <RefreshCw className="h-3 w-3" />
              Xóa dữ liệu
            </button>
            <button type="button" onClick={() => { if (window.confirm('Thay toàn bộ dữ liệu hiện tại bằng DỮ LIỆU TEST (đủ các trường hợp)?')) setState(resetDepotState(createDemoState)); }} className="inline-flex items-center gap-1 rounded-md border border-line bg-white px-2 py-1 text-ink-muted hover:bg-canvas">
              <RefreshCw className="h-3 w-3" />
              Nạp dữ liệu test
            </button>
            </>)}
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-4">
          <Suspense fallback={<ScreenLoading />}>
          {activeMenu === 'TON_VO' && (
            <YardFeature state={state} onUpdateState={handleUpdateState} onOpenDossier={setActiveDossierCode} onOpenK80Ticket={setActiveK80Ticket} onOpenReceipt={openReceipt} />
          )}
          {activeMenu === 'GD_HA_VO' && <InspectorHaVoMobile state={state} onUpdateState={handleUpdateState} onOpenDossier={setActiveDossierCode} />}
          {activeMenu === 'VP_HA_VO' && (
            <OfficeHaVoWorkspace state={state} onUpdateState={handleUpdateState} onOpenK80Ticket={setActiveK80Ticket} onOpenDossier={setActiveDossierCode} />
          )}
          {activeMenu === 'VP_CAP_VO' && (
            <OfficeCapVoWorkspace state={state} onUpdateState={handleUpdateState} onOpenK80Ticket={setActiveK80Ticket} onOpenDossier={setActiveDossierCode} />
          )}
          {activeMenu === 'VP_TRA_CHUNG_TU' && <DocumentReturnWorkspace state={state} onUpdateState={handleUpdateState} onOpenDossier={setActiveDossierCode} />}
          {activeMenu === 'VP_PHIEU_THU' && <ReceiptsWorkspace state={state} onUpdateState={handleUpdateState} onOpenDossier={setActiveDossierCode} focus={receiptFocus} />}
          {activeMenu === 'VP_NHAP_TAU' && <OfficeVesselWorkspace mode="NHAP_TAU" state={state} onUpdateState={handleUpdateState} onOpenDossier={setActiveDossierCode} />}
          {activeMenu === 'VP_XUAT_TAU' && <OfficeVesselWorkspace mode="XUAT_TAU" state={state} onUpdateState={handleUpdateState} onOpenDossier={setActiveDossierCode} />}
          {VESSEL_FIELD_MENUS.includes(activeMenu as VesselFieldMode) && (
            <VesselFieldMobile key={activeMenu} kind={activeMenu as VesselFieldMode} state={state} onUpdateState={handleUpdateState} onOpenDossier={setActiveDossierCode} />
          )}
          {FIELD_QUEUE_MENUS.includes(activeMenu as FieldQueueMode) && (
            <FieldQueueWorkspaces
              mode={activeMenu as FieldQueueMode}
              state={state}
              onUpdateState={handleUpdateState}
              initialScannedQr={simulatedQr}
              onOpenDossier={setActiveDossierCode}
            />
          )}
          {activeMenu === 'XN_DAO_CHUYEN' && <YardShiftWorkspace state={state} onUpdateState={handleUpdateState} onOpenDossier={setActiveDossierCode} />}
          {REPORT_MENUS.includes(activeMenu as ReportSection) && (
            <ReportsWorkspace state={state} section={activeMenu as ReportSection} onOpenDossier={setActiveDossierCode} onOpenReceipt={openReceipt} />
          )}
          {activeMenu === 'BC_GOP_Y' && <FeedbackReport state={state} onUpdateState={handleUpdateState} menuOptions={allMenuOptions} />}
          {activeMenu === 'DM_SUA_CHUA' && <RepairTeamCatalog state={state} onUpdateState={handleUpdateState} />}
          {activeMenu === 'DM_USER' && <UserRoleCatalog state={state} onUpdateState={handleUpdateState} />}
          {activeMenu === 'DM_CONG_TY' && <CompanyCatalog state={state} onUpdateState={handleUpdateState} />}
          {CATALOG_TABS[activeMenu] &&<MasterCatalogWorkspace state={state} onUpdateState={handleUpdateState} tab={CATALOG_TABS[activeMenu]} />}
          </Suspense>
        </main>
      </div>

      {/* Hồ sơ / phiếu K80 chỉ tải khi mở lần đầu */}
      <Suspense fallback={null}>
      {activeDossierCode && <MasterDossierModal
        masterDossierCode={activeDossierCode}
        state={state}
        onClose={() => setActiveDossierCode(null)}
        onOpenK80Ticket={setActiveK80Ticket}
        onUpdateState={handleUpdateState}
        onOpenReceipt={openReceipt}
      />}

      {activeK80Ticket && <K80TicketModal
        ticket={activeK80Ticket}
        state={state}
        onClose={() => setActiveK80Ticket(null)}
        onSimulateScanQr={(qr) => {
          setSimulatedQr(qr);
          setActiveMenu(activeK80Ticket?.operationMode === 'CAP_VO' ? 'XN_CHO_CAP_VO' : 'XN_CHO_HA_VO');
        }}
      />}
      </Suspense>
    </div>
  );
};
