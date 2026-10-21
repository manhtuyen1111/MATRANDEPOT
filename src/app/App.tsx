import React, { useState } from 'react';
import {
  ChevronRight,
  Menu,
  RefreshCw,
  Smartphone,
  UserCheck,
} from 'lucide-react';
import {
  K80InternalTicket,
  ROLE_LABELS,
  WorkspaceMenuId,
} from '../types/depot';
import {
  DepotState,
  loadDepotState,
  resetDepotState,
  saveDepotState,
} from '../services/depotStore';
import { K80TicketModal } from '../components/K80TicketModal';
import { MasterDossierModal } from '../components/MasterDossierModal';
import { InspectorHaVoMobile } from '../features/inspector/InspectorHaVoMobile';
import {
  OfficeCapVoWorkspace,
  OfficeHaVoWorkspace,
  OfficeVesselBatchWorkspace,
} from '../features/office/OfficeWorkspaces';
import { FieldQueueWorkspaces } from '../features/field-queues/FieldQueueWorkspaces';
import { YardFeature } from '../features/yard/YardFeature';
import { MasterCatalogWorkspace } from '../features/catalog/MasterCatalogWorkspace';
import { ReportsWorkspace } from '../features/reports/ReportsWorkspace';

export const App: React.FC = () => {
  const [state, setState] = useState<DepotState>(() => loadDepotState());
  const [activeMenu, setActiveMenu] = useState<WorkspaceMenuId>('GD_HA_VO');
  const [activeK80Ticket, setActiveK80Ticket] =
    useState<K80InternalTicket | null>(null);
  const [activeDossierCode, setActiveDossierCode] = useState<string | null>(
    null
  );
  const [simulatedQr, setSimulatedQr] = useState<string>('');
  const [showFullMenu, setShowFullMenu] = useState<boolean>(true);

  const handleUpdateState = (next: DepotState) => {
    setState(next);
    saveDepotState(next);
  };

  const handleResetDemo = () => {
    const fresh = resetDepotState();
    setState(fresh);
  };

  // Đếm số lượng công việc ĐANG CHỜ của từng bộ phận
  const activeConts = state.containers.filter((c) => c.status !== 'GATED_OUT');
  const countVpHaVo = state.gateInOrders.filter(
    (o) => o.status !== 'GATE_IN_OK' && o.status !== 'CANCELLED'
  ).length;
  const countGdHaVo = state.gateInOrders.filter(
    (o) => o.status !== 'GATE_IN_OK' && o.status !== 'CANCELLED'
  ).length;
  const countVpCapVo = activeConts.filter(
    (c) => c.status === 'IN_YARD' && c.conditionClass === 'AV' && !c.isOnHold
  ).length;
  const countVsChoVeSinh = activeConts.filter((c) => c.needsCleaning).length;
  const countXnChoHaVo = activeConts.filter(
    (c) => c.status === 'WAITING_PLACEMENT'
  ).length;
  const countXnChoCapVo = activeConts.filter(
    (c) => c.status === 'ALLOCATED'
  ).length;
  const countXnHaSuaChua = activeConts.filter(
    (c) => c.forkliftShiftTask === 'HA_SUA_CHUA'
  ).length;
  const countXnHaKeGd = activeConts.filter(
    (c) => c.forkliftShiftTask === 'HA_KE_GIAM_DINH'
  ).length;
  const countBgChoBaoGia = activeConts.filter(
    (c) => c.conditionClass === 'DAMAGE' && c.needsQuotation
  ).length;
  const countScChoSuaChua = activeConts.filter((c) => c.needsRepair).length;

  const selectMenu = (id: WorkspaceMenuId) => {
    setActiveMenu(id);
  };

  const renderMenuButton = (
    id: WorkspaceMenuId,
    label: string,
    badge?: number,
    indent = false
  ) => {
    const active = activeMenu === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => selectMenu(id)}
        className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition ${
          indent ? 'pl-6' : ''
        } ${
          active
            ? 'bg-blue-600 font-bold text-white'
            : 'text-slate-700 hover:bg-slate-100'
        }`}
      >
        <span className="flex items-center gap-1">
          {indent && <ChevronRight className="h-3 w-3 opacity-60" />}
          {label}
        </span>
        {badge !== undefined && (
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
              active
                ? 'bg-white text-blue-700'
                : badge > 0
                ? 'bg-slate-200 text-slate-800'
                : 'text-slate-400'
            }`}
          >
            {badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900">
      {/* MENU BÊN TRÁI — LUÔN HIỂN THỊ FULL MENU (CÓ THỂ THU GỌN TRÊN ĐIỆN THOẠI KHI CẦN) */}
      {showFullMenu && (
        <aside className="w-60 shrink-0 border-r border-slate-200 bg-white p-3">
          <div className="mb-3 border-b border-slate-200 pb-2.5">
            <h1 className="text-sm font-bold text-slate-900">MATRAN DEPOT</h1>
            <p className="text-[11px] text-slate-500">Menu tác nghiệp nội bộ</p>
          </div>

          <div className="space-y-3 text-xs">
            {/* TỒN VỎ */}
            <div>
              <div className="mb-1 px-2 text-[11px] font-bold uppercase text-slate-500">
                TỒN VỎ :
              </div>
              {renderMenuButton(
                'TON_VO',
                '- DANH SÁCH TỒN VỎ',
                activeConts.length
              )}
            </div>

            {/* 1. BỘ PHẬN GIÁM ĐỊNH (ĐẨY LÊN TRÊN VĂN PHÒNG VÌ GIÁM ĐỊNH LÀM VIỆC TRƯỚC — TÁC NGHIỆP MOBILE) */}
            <div>
              <div className="mb-1 flex items-center justify-between px-2 text-[11px] font-bold uppercase text-slate-600">
                <span>BỘ PHẬN GIÁM ĐỊNH</span>
                <span className="inline-flex items-center gap-0.5 rounded bg-blue-50 px-1 py-0.5 text-[9px] font-semibold text-blue-700">
                  <Smartphone className="h-2.5 w-2.5" />
                  Mobile
                </span>
              </div>
              <div className="space-y-0.5">
                {renderMenuButton('GD_HA_VO', '- HẠ VỎ', countGdHaVo)}
              </div>
            </div>

            {/* 2. BỘ PHẬN VĂN PHÒNG */}
            <div>
              <div className="mb-1 px-2 text-[11px] font-bold uppercase text-slate-500">
                BỘ PHẬN VĂN PHÒNG
              </div>
              <div className="space-y-0.5">
                {renderMenuButton('VP_HA_VO', '- HẠ VỎ', countVpHaVo)}
                {renderMenuButton('VP_CAP_VO', '- CẤP VỎ', countVpCapVo)}
                {renderMenuButton('VP_NHAP_TAU', '- NHẬP TÀU')}
                {renderMenuButton('VP_XUAT_TAU', '- XUẤT TÀU')}
              </div>
            </div>

            {/* 3. BỘ PHẬN VỆ SINH (TÁC NGHIỆP MOBILE) */}
            <div>
              <div className="mb-1 flex items-center justify-between px-2 text-[11px] font-bold uppercase text-slate-600">
                <span>BỘ PHẬN VỆ SINH</span>
                <span className="inline-flex items-center gap-0.5 rounded bg-blue-50 px-1 py-0.5 text-[9px] font-semibold text-blue-700">
                  <Smartphone className="h-2.5 w-2.5" />
                  Mobile
                </span>
              </div>
              <div className="space-y-0.5">
                {renderMenuButton(
                  'VS_CHO_VE_SINH',
                  '- CHỜ VỆ SINH',
                  countVsChoVeSinh
                )}
              </div>
            </div>

            {/* 4. BỘ PHẬN XE NÂNG (TÁC NGHIỆP MOBILE) */}
            <div>
              <div className="mb-1 flex items-center justify-between px-2 text-[11px] font-bold uppercase text-slate-600">
                <span>BỘ PHẬN XE NÂNG</span>
                <span className="inline-flex items-center gap-0.5 rounded bg-blue-50 px-1 py-0.5 text-[9px] font-semibold text-blue-700">
                  <Smartphone className="h-2.5 w-2.5" />
                  Mobile
                </span>
              </div>
              <div className="space-y-0.5">
                {renderMenuButton(
                  'XN_CHO_HA_VO',
                  '- CHỜ HẠ VỎ',
                  countXnChoHaVo
                )}
                {renderMenuButton(
                  'XN_CHO_CAP_VO',
                  '- CHỜ CẤP VỎ',
                  countXnChoCapVo
                )}
                <div className="px-2.5 py-1 text-xs font-medium text-slate-600">
                  - ĐẢO CHUYỂN
                </div>
                {renderMenuButton(
                  'XN_DAO_CHUYEN_SUA_CHUA',
                  '+ HẠ SỬA CHỮA',
                  countXnHaSuaChua,
                  true
                )}
                {renderMenuButton(
                  'XN_DAO_CHUYEN_KE_GD',
                  '+ HẠ KỆ GIÁM ĐỊNH',
                  countXnHaKeGd,
                  true
                )}
              </div>
            </div>

            {/* 5. BỘ PHẬN BÁO GIÁ */}
            <div>
              <div className="mb-1 px-2 text-[11px] font-bold uppercase text-slate-500">
                BỘ PHẬN BÁO GIÁ
              </div>
              <div className="space-y-0.5">
                {renderMenuButton(
                  'BG_CHO_BAO_GIA',
                  '- CHỜ BÁO GIÁ',
                  countBgChoBaoGia
                )}
              </div>
            </div>

            {/* 6. BỘ PHẬN SỬA CHỮA (TÁC NGHIỆP MOBILE) */}
            <div>
              <div className="mb-1 flex items-center justify-between px-2 text-[11px] font-bold uppercase text-slate-600">
                <span>BỘ PHẬN SỬA CHỮA</span>
                <span className="inline-flex items-center gap-0.5 rounded bg-blue-50 px-1 py-0.5 text-[9px] font-semibold text-blue-700">
                  <Smartphone className="h-2.5 w-2.5" />
                  Mobile
                </span>
              </div>
              <div className="space-y-0.5">
                {renderMenuButton(
                  'SC_CHO_SUA_CHUA',
                  '- CHỜ SỬA CHỮA',
                  countScChoSuaChua
                )}
              </div>
            </div>

            {/* 7. DANH MỤC CHUNG (CHỈ ADMIN CÓ QUYỀN CẤU HÌNH) */}
            <div className="border-t border-slate-200 pt-3">
              <div className="mb-1 flex items-center justify-between px-2 text-[11px] font-bold uppercase text-slate-600">
                <span>DANH MỤC CHUNG</span>
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-800">
                  Admin
                </span>
              </div>
              <div className="space-y-0.5">
                {renderMenuButton(
                  'DANH_MUC_CHUNG',
                  '- CẤU HÌNH DANH MỤC'
                )}
              </div>
            </div>

            {/* 8. BÁO CÁO (DƯỚI CÙNG CÁC MENU: TỒN VỎ / HẠ VỎ / CẤP VỎ) */}
            <div className="border-t border-slate-200 pt-3">
              <div className="mb-1 px-2 text-[11px] font-bold uppercase text-slate-600">
                BÁO CÁO
              </div>
              <div className="space-y-0.5">
                {renderMenuButton(
                  'BAO_CAO',
                  '- TỒN VỎ / HẠ VỎ / CẤP VỎ'
                )}
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* VÙNG LÀM VIỆC BÊN PHẢI */}
      <div className="flex flex-1 flex-col min-w-0">
        {/* THANH HEADER BASIC */}
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-white px-4 py-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowFullMenu((prev) => !prev)}
              className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <Menu className="h-3.5 w-3.5" />
              {showFullMenu ? 'Menu' : 'Hiện Full Menu'}
            </button>
            <span className="text-xs font-semibold text-slate-700">
              MATRAN DEPOT
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            <div className="flex items-center gap-1.5 rounded border border-slate-200 bg-slate-50 px-2 py-1">
              <UserCheck className="h-3.5 w-3.5 text-slate-600" />
              <select
                value={state.currentUser.id}
                onChange={(e) => {
                  const found = state.staffUsers.find(
                    (u) => u.id === e.target.value
                  );
                  if (found) handleUpdateState({ ...state, currentUser: found });
                }}
                className="bg-transparent font-medium text-slate-800 focus:outline-hidden"
              >
                {state.staffUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.fullName} ({u.roles.map((r) => ROLE_LABELS[r]).join(', ')})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleResetDemo}
              className="inline-flex items-center gap-1 rounded border border-slate-200 bg-white px-2 py-1 text-slate-600 hover:bg-slate-50"
            >
              <RefreshCw className="h-3 w-3" />
              Reset
            </button>
          </div>
        </header>

        {/* NỘI DUNG TÁC NGHIỆP BÊN PHẢI */}
        <main className="flex-1 p-4">
          {activeMenu === 'TON_VO' && (
            <YardFeature
              state={state}
              onUpdateState={handleUpdateState}
              onOpenDossier={(code) => setActiveDossierCode(code)}
              onOpenK80Ticket={(t) => setActiveK80Ticket(t)}
            />
          )}

          {activeMenu === 'DANH_MUC_CHUNG' && (
            <MasterCatalogWorkspace
              state={state}
              onUpdateState={handleUpdateState}
            />
          )}

          {activeMenu === 'VP_HA_VO' && (
            <OfficeHaVoWorkspace
              state={state}
              onUpdateState={handleUpdateState}
              onOpenK80Ticket={(t) => setActiveK80Ticket(t)}
              onOpenDossier={(code) => setActiveDossierCode(code)}
            />
          )}

          {activeMenu === 'VP_CAP_VO' && (
            <OfficeCapVoWorkspace
              state={state}
              onUpdateState={handleUpdateState}
              onOpenK80Ticket={(t) => setActiveK80Ticket(t)}
              onOpenDossier={(code) => setActiveDossierCode(code)}
            />
          )}

          {activeMenu === 'VP_NHAP_TAU' && (
            <OfficeVesselBatchWorkspace
              mode="NHAP_TAU"
              state={state}
              onUpdateState={handleUpdateState}
            />
          )}

          {activeMenu === 'VP_XUAT_TAU' && (
            <OfficeVesselBatchWorkspace
              mode="XUAT_TAU"
              state={state}
              onUpdateState={handleUpdateState}
            />
          )}

          {activeMenu === 'GD_HA_VO' && (
            <InspectorHaVoMobile
              state={state}
              onUpdateState={handleUpdateState}
              onOpenDossier={(code) => setActiveDossierCode(code)}
            />
          )}

          {(activeMenu === 'VS_CHO_VE_SINH' ||
            activeMenu === 'XN_CHO_HA_VO' ||
            activeMenu === 'XN_CHO_CAP_VO' ||
            activeMenu === 'XN_DAO_CHUYEN_SUA_CHUA' ||
            activeMenu === 'XN_DAO_CHUYEN_KE_GD' ||
            activeMenu === 'BG_CHO_BAO_GIA' ||
            activeMenu === 'SC_CHO_SUA_CHUA') && (
            <FieldQueueWorkspaces
              mode={activeMenu}
              state={state}
              onUpdateState={handleUpdateState}
              initialScannedQr={simulatedQr}
              onOpenDossier={(code) => setActiveDossierCode(code)}
            />
          )}
        </main>
      </div>

      {/* MODAL XEM XUYÊN SUỐT MÃ HỒ SƠ CHÍNH (TỪ GIÁM ĐỊNH ĐẾN KHI OUT KHỎI BÃI) */}
      <MasterDossierModal
        masterDossierCode={activeDossierCode}
        state={state}
        onClose={() => setActiveDossierCode(null)}
      />

      {/* MODAL IN PHIẾU K80 TÁC NGHIỆP NỘI BỘ (CHỈ XUẤT HIỆN KHI ĐÃ XÁC NHẬN Ở VĂN PHÒNG) */}
      <K80TicketModal
        ticket={activeK80Ticket}
        onClose={() => setActiveK80Ticket(null)}
        onSimulateScanQr={(qr) => {
          setSimulatedQr(qr);
          setActiveMenu(
            activeK80Ticket?.operationMode === 'CAP_VO'
              ? 'XN_CHO_CAP_VO'
              : 'XN_CHO_HA_VO'
          );
        }}
      />
    </div>
  );
};
