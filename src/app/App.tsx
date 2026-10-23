import React, { useEffect, useMemo, useState } from 'react';
import {
  Boxes,
  Building2,
  Calculator,
  ChartColumn,
  ChevronDown,
  ClipboardCheck,
  Forklift,
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
import { canOpenMenu } from '../services/permissions';
import { isSupabaseConfigured } from '../lib/env';
import { K80TicketModal } from '../components/K80TicketModal';
import { MasterDossierModal } from '../components/MasterDossierModal';
import { InspectorHaVoMobile } from '../features/inspector/InspectorHaVoMobile';
import { OfficeCapVoWorkspace, OfficeHaVoWorkspace, OfficeVesselBatchWorkspace } from '../features/office/OfficeWorkspaces';
import { FieldQueueMode, FieldQueueWorkspaces, getFieldQueue } from '../features/field-queues/FieldQueueWorkspaces';
import { YardShiftWorkspace } from '../features/forklift/YardShiftWorkspace';
import { YardFeature } from '../features/yard/YardFeature';
import { CatalogTab, MasterCatalogWorkspace } from '../features/catalog/MasterCatalogWorkspace';
import { ReportSection, ReportsWorkspace } from '../features/reports/ReportsWorkspace';
import { ReceiptsWorkspace } from '../features/receipts/ReceiptsWorkspace';
import { DocumentReturnWorkspace } from '../features/office/DocumentReturnWorkspace';
import { ticketsAwaitingReturn } from '../services/driverRoute';
import { RepairTeamCatalog } from '../features/catalog/RepairTeamCatalog';
import { UserRoleCatalog } from '../features/catalog/UserRoleCatalog';

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
  { key: 'GD', label: 'Giám định', icon: ClipboardCheck, items: [{ id: 'GD_HA_VO', label: 'Hạ vỏ', mobile: true }] },
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
  { key: 'VS', label: 'Vệ sinh', icon: SprayCan, items: [{ id: 'VS_CHO_VE_SINH', label: 'Chờ vệ sinh', mobile: true }] },
  {
    key: 'XN',
    label: 'Xe nâng',
    icon: Forklift,
    items: [
      { id: 'XN_CHO_HA_VO', label: 'Chờ hạ vỏ', mobile: true },
      { id: 'XN_CHO_CAP_VO', label: 'Chờ cấp vỏ', mobile: true },
      { id: 'XN_DAO_CHUYEN', label: 'Đảo chuyển', mobile: true },
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
      { id: 'BC_SUA_CHUA', label: 'Sửa chữa chi tiết' },
      { id: 'BC_TONG_HOP', label: 'Tổng hợp' },
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
      { id: 'DM_SUA_CHUA', label: 'Sửa chữa' },
      { id: 'DM_USER', label: 'User - Phân quyền' },
    ],
  },
];

const FIELD_QUEUE_MENUS: FieldQueueMode[] = ['VS_CHO_VE_SINH', 'XN_CHO_HA_VO', 'XN_CHO_CAP_VO', 'BG_CHO_BAO_GIA', 'SC_CHO_SUA_CHUA'];
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

export const App: React.FC = () => {
  const [state, setState] = useState<DepotState>(() => loadDepotState());
  const [activeMenu, setActiveMenu] = useState<WorkspaceMenuId>('GD_HA_VO');
  const [activeK80Ticket, setActiveK80Ticket] = useState<K80InternalTicket | null>(null);
  const [activeDossierCode, setActiveDossierCode] = useState<string | null>(null);
  const [simulatedQr, setSimulatedQr] = useState('');
  const [receiptFocus, setReceiptFocus] = useState<{ key: string; nonce: number } | null>(null);
  const [prefs, setPrefs] = useState(readPrefs);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleUpdateState = (next: DepotState) => {
    setState(next);
    saveDepotState(next);
  };

  const visibleMenu = useMemo(
    () =>
      MENU.map((g) => ({ ...g, items: g.items.filter((i) => canOpenMenu(state.currentUser, i.id)) })).filter(
        (g) => g.items.length > 0
      ),
    [state.currentUser]
  );

  // Đổi người dùng → nếu không còn quyền với màn hình hiện tại thì chuyển sang mục đầu tiên được phép
  useEffect(() => {
    if (!canOpenMenu(state.currentUser, activeMenu)) {
      const first = visibleMenu[0]?.items[0]?.id;
      if (first) setActiveMenu(first);
    }
  }, [state.currentUser, activeMenu, visibleMenu]);

  const badges: Partial<Record<WorkspaceMenuId, number>> = {
    TON_VO: state.containers.filter((c) => c.status !== 'GATED_OUT').length,
    GD_HA_VO: state.gateInOrders.filter((o) => o.status === 'FIELD_RECORDED').length,
    VP_HA_VO: state.gateInOrders.filter((o) => o.status !== 'GATE_IN_OK' && o.status !== 'CANCELLED').length,
    VP_CAP_VO: state.gateOutOrders.filter((o) => o.status === 'PAYMENT_PENDING').length,
    VP_PHIEU_THU: state.paymentTransactions.filter((t) => t.status === 'PENDING').length,
    VP_TRA_CHUNG_TU: ticketsAwaitingReturn(state).length,
  };
  for (const m of FIELD_QUEUE_MENUS) badges[m] = getFieldQueue(state, m).length;

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

        if (rail) {
          return (
            <button
              key={g.key}
              type="button"
              title={g.label}
              aria-label={g.label}
              onClick={() => selectMenu(g.items[0].id)}
              className={`relative flex h-10 w-10 items-center justify-center rounded-md ${
                containsActive ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
              {groupBadge > 0 && !single && (
                <span className="absolute -right-0.5 -top-0.5 rounded-full bg-slate-900 px-1 text-[9px] font-bold text-white">{groupBadge}</span>
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
                activeMenu === item.id ? 'bg-blue-600 text-white' : 'text-slate-700 hover:bg-slate-100'
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
                containsActive ? 'text-blue-700' : 'text-slate-700'
              } hover:bg-slate-100`}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" />
              <span className="flex-1 text-left">{g.label}</span>
              {collapsed && groupBadge > 0 && <span className="font-mono text-[11px] text-slate-500">{groupBadge}</span>}
              <ChevronDown className={`h-3.5 w-3.5 text-slate-400 transition-transform ${collapsed ? '-rotate-90' : ''}`} />
            </button>
            {!collapsed && (
              <ul className="ml-[18px] mt-0.5 space-y-0.5 border-l border-slate-200 pl-3">
                {g.items.map((item) => {
                  const active = activeMenu === item.id;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => selectMenu(item.id)}
                        aria-current={active ? 'page' : undefined}
                        className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 ${
                          active ? 'bg-blue-600 font-semibold text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          {item.label}
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
                        {badges[item.id] !== undefined && (badges[item.id]! > 0 || active) && (
                          <span className={`rounded px-1.5 font-mono text-[10px] font-bold ${active ? 'bg-white/20' : 'bg-slate-100 text-slate-700'}`}>
                            {badges[item.id]}
                          </span>
                        )}
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
      <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-900 text-[11px] font-black text-white">MD</div>
      <div className="leading-tight">
        <p className="text-sm font-bold text-slate-900">MATRAN DEPOT</p>
        <p className="text-[10px] text-slate-500">Quản lý bãi container rỗng</p>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* Menu máy tính */}
      <aside className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-slate-200 bg-white lg:flex ${prefs.railMode ? 'w-16 items-center' : 'w-60'}`}>
        <div className={`flex items-center border-b border-slate-200 py-3 ${prefs.railMode ? 'justify-center' : 'justify-between px-3'}`}>
          {!prefs.railMode && brand}
          <button type="button" onClick={toggleRail} aria-label={prefs.railMode ? 'Mở rộng menu' : 'Thu gọn menu'} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100">
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
            <div className="flex items-center justify-between border-b border-slate-200 px-3 py-3">
              {brand}
              <button type="button" onClick={() => setDrawerOpen(false)} aria-label="Đóng menu" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-2 py-3">{renderNav(false)}</div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setDrawerOpen(true)} aria-label="Mở menu" className="rounded-md border border-slate-200 p-1.5 text-slate-600 lg:hidden">
              <Menu className="h-4 w-4" />
            </button>
            <p className="text-xs text-slate-500">
              {activeGroup && activeGroup.items.length > 1 && <span>{activeGroup.label} / </span>}
              <span className="font-bold text-slate-900">{activeItem?.label}</span>
            </p>
            {activeItem?.mobile && (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
                <Smartphone className="h-3 w-3" />
                Mobile
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {!isSupabaseConfigured && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800">DEMO</span>}
            <label className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
              <UserCheck className="h-3.5 w-3.5 text-slate-500" />
              <span className="sr-only">Người dùng (Demo)</span>
              <select
                value={state.currentUser.id}
                onChange={(e) => {
                  const found = state.staffUsers.find((u) => u.id === e.target.value);
                  if (found) handleUpdateState({ ...state, currentUser: found });
                }}
                className="max-w-[220px] bg-transparent font-medium text-slate-800 focus:outline-hidden"
              >
                {state.staffUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({u.roles.map((r) => ROLE_LABELS[r]).join(', ')})
                  </option>
                ))}
              </select>
            </label>
            <button type="button" onClick={() => setState(resetDepotState())} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-600 hover:bg-slate-50">
              <RefreshCw className="h-3 w-3" />
              Reset demo
            </button>
          </div>
        </header>

        <main className="flex-1 p-3 sm:p-4">
          {activeMenu === 'TON_VO' && (
            <YardFeature state={state} onUpdateState={handleUpdateState} onOpenDossier={setActiveDossierCode} onOpenK80Ticket={setActiveK80Ticket} />
          )}
          {activeMenu === 'GD_HA_VO' && <InspectorHaVoMobile state={state} onUpdateState={handleUpdateState} onOpenDossier={setActiveDossierCode} />}
          {activeMenu === 'VP_HA_VO' && (
            <OfficeHaVoWorkspace state={state} onUpdateState={handleUpdateState} onOpenK80Ticket={setActiveK80Ticket} onOpenDossier={setActiveDossierCode} />
          )}
          {activeMenu === 'VP_CAP_VO' && (
            <OfficeCapVoWorkspace state={state} onUpdateState={handleUpdateState} onOpenK80Ticket={setActiveK80Ticket} onOpenDossier={setActiveDossierCode} />
          )}
          {activeMenu === 'VP_TRA_CHUNG_TU' && <DocumentReturnWorkspace state={state} onUpdateState={handleUpdateState} />}
          {activeMenu === 'VP_PHIEU_THU' && <ReceiptsWorkspace state={state} onUpdateState={handleUpdateState} onOpenDossier={setActiveDossierCode} focus={receiptFocus} />}
          {activeMenu === 'VP_NHAP_TAU' && <OfficeVesselBatchWorkspace mode="NHAP_TAU" />}
          {activeMenu === 'VP_XUAT_TAU' && <OfficeVesselBatchWorkspace mode="XUAT_TAU" />}
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
            <ReportsWorkspace state={state} section={activeMenu as ReportSection} onOpenDossier={setActiveDossierCode} />
          )}
          {activeMenu === 'DM_SUA_CHUA' && <RepairTeamCatalog state={state} onUpdateState={handleUpdateState} />}
          {activeMenu === 'DM_USER' && <UserRoleCatalog state={state} onUpdateState={handleUpdateState} />}
          {CATALOG_TABS[activeMenu] &&<MasterCatalogWorkspace state={state} onUpdateState={handleUpdateState} tab={CATALOG_TABS[activeMenu]} />}
        </main>
      </div>

      <MasterDossierModal
        masterDossierCode={activeDossierCode}
        state={state}
        onClose={() => setActiveDossierCode(null)}
        onOpenK80Ticket={setActiveK80Ticket}
        // DEC-051: link thẳng tới Văn phòng → Phiếu thu (chỉ khi user được vào menu Phiếu thu)
        onOpenReceipt={
          canOpenMenu(state.currentUser, 'VP_PHIEU_THU')
            ? (key) => {
                setActiveDossierCode(null);
                setReceiptFocus({ key, nonce: Date.now() });
                setActiveMenu('VP_PHIEU_THU');
              }
            : undefined
        }
      />

      <K80TicketModal
        ticket={activeK80Ticket}
        state={state}
        onClose={() => setActiveK80Ticket(null)}
        onSimulateScanQr={(qr) => {
          setSimulatedQr(qr);
          setActiveMenu(activeK80Ticket?.operationMode === 'CAP_VO' ? 'XN_CHO_CAP_VO' : 'XN_CHO_HA_VO');
        }}
      />
    </div>
  );
};
