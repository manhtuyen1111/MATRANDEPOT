import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialState, DepotState } from '../src/services/depotStore';
import { App } from '../src/app/App';
import { YardFeature } from '../src/features/yard/YardFeature';
import { OfficeCapVoWorkspace, OfficeHaVoWorkspace, OfficeVesselBatchWorkspace } from '../src/features/office/OfficeWorkspaces';
import { FieldQueueWorkspaces, FieldQueueMode } from '../src/features/field-queues/FieldQueueWorkspaces';
import { YardShiftWorkspace } from '../src/features/forklift/YardShiftWorkspace';
import { ReceiptsWorkspace } from '../src/features/receipts/ReceiptsWorkspace';
import { ReportsWorkspace } from '../src/features/reports/ReportsWorkspace';
import { MasterCatalogWorkspace } from '../src/features/catalog/MasterCatalogWorkspace';
import { MasterDossierModal } from '../src/components/MasterDossierModal';
import { InspectorHaVoMobile } from '../src/features/inspector/InspectorHaVoMobile';
import { RepairTeamCatalog } from '../src/features/catalog/RepairTeamCatalog';
import { UserRoleCatalog } from '../src/features/catalog/UserRoleCatalog';
import { DocumentReturnWorkspace } from '../src/features/office/DocumentReturnWorkspace';
import { K80TicketModal } from '../src/components/K80TicketModal';
import { confirmGateInPaymentAndComplete, recordGateInFieldStep, toggleContainerHold, verifyGateInOfficeAndCreatePayment } from '../src/services/depotOperations';

// Smoke test: mỗi màn hình render được với dữ liệu mẫu, không ném lỗi khi render
const noop = () => {};
const base = createInitialState();
const as = (s: DepotState, id: string) => ({ ...s, currentUser: s.staffUsers.find((u) => u.id === id)! });

describe('UI smoke — render các màn hình với dữ liệu mẫu', () => {
  it('App khung menu', () => {
    const html = renderToString(<App />);
    expect(html).toContain('MATRAN DEPOT');
    expect(html).toContain('Đảo chuyển');
    expect(html).not.toContain('HẠ SỬA CHỮA');
    expect(html.match(/aria-label="Tác nghiệp mobile"/g)?.length).toBe(6);
  });

  it('Tồn vỏ hiển thị biểu tượng khóa và dấu - cho container chưa có vị trí', () => {
    const locked = toggleContainerHold(as(base, 'usr-office'), { containerNo: 'MSKU4089123', hold: true, reason: 'Giữ' });
    const html = renderToString(<YardFeature state={locked} onUpdateState={noop} />);
    expect(html).toContain('Container đang bị khóa');
    expect(html).toContain('>-<');
  });

  it('Văn phòng / Xe nâng / Vệ sinh / Báo giá / Sửa chữa / Phiếu thu / Báo cáo / Danh mục / Hồ sơ', () => {
    const office = as(base, 'usr-office');
    const screens: React.ReactElement[] = [
      <OfficeHaVoWorkspace state={office} onUpdateState={noop} onOpenK80Ticket={noop} />,
      <OfficeCapVoWorkspace state={office} onUpdateState={noop} onOpenK80Ticket={noop} />,
      <OfficeVesselBatchWorkspace mode="NHAP_TAU" />,
      <InspectorHaVoMobile state={base} onUpdateState={noop} />,
      <YardShiftWorkspace state={base} onUpdateState={noop} />,
      <ReceiptsWorkspace state={as(base, 'usr-acc')} onUpdateState={noop} />,
      <ReportsWorkspace state={base} section="BC_CAP_VO" onOpenDossier={noop} />,
      <ReportsWorkspace state={base} section="BC_TONG_HOP" onOpenDossier={noop} />,
      <MasterCatalogWorkspace state={base} onUpdateState={noop} tab="BIEU_GIA" />,
      <RepairTeamCatalog state={base} onUpdateState={noop} />,
      <UserRoleCatalog state={base} onUpdateState={noop} />,
      <ReportsWorkspace state={base} section="BC_HA_VO" onOpenDossier={noop} />,
      <ReportsWorkspace state={base} section="BC_SUA_CHUA" onOpenDossier={noop} />,
      <MasterDossierModal masterDossierCode="HS-261019-001" state={base} onClose={noop} />,
      <MasterDossierModal masterDossierCode="GO-261018-001" state={base} onClose={noop} />,
      ...(['VS_CHO_VE_SINH', 'XN_CHO_HA_VO', 'XN_CHO_CAP_VO', 'BG_CHO_BAO_GIA', 'SC_CHO_SUA_CHUA'] as FieldQueueMode[]).map((m) => (
        <FieldQueueWorkspaces key={m} mode={m} state={base} onUpdateState={noop} />
      )),
    ];
    for (const el of screens) expect(renderToString(el).length).toBeGreaterThan(50);
  });

  it('Cấp vỏ mặc định lọc AV và có cột phân loại đóng hàng', () => {
    const html = renderToString(<OfficeCapVoWorkspace state={as(base, 'usr-office')} onUpdateState={noop} onOpenK80Ticket={noop} />);
    expect(html).toContain('Đóng hàng');
    expect(html).toContain('MSKU4089123'); // AV, đã có vị trí
    expect(html).not.toContain('CSNU7712309'); // DAMAGE, còn chờ vệ sinh
  });
});

describe('Tác nghiệp mobile dùng khung max-w-lg', () => {
  it('Giám định Hạ vỏ, Đảo chuyển, các hàng chờ hiện trường', () => {
    const screens = [
      <InspectorHaVoMobile state={base} onUpdateState={noop} />,
      <YardShiftWorkspace state={base} onUpdateState={noop} />,
      <FieldQueueWorkspaces mode="XN_CHO_HA_VO" state={base} onUpdateState={noop} />,
    ];
    for (const el of screens) expect(renderToString(el)).toContain('max-w-lg');
  });
});

describe('DEC-051: hồ sơ container link về Phiếu thu', () => {
  it('Khung Thu tiền nổi bật, link phiếu thu khi được vào menu Phiếu thu; chỉ chữ khi không có quyền', () => {
    const office = as(base, 'usr-office');
    let s = recordGateInFieldStep(as(base, 'usr-inspector'), {
      gateInType: 'CUSTOMER_RETURN', doorPhotoUrl: 'data:x', conditionClass: 'AV', stuffingClass: 'E',
      cleaningItems: ['KHÔNG VỆ SINH'], manufactureYear: 2019,
    });
    const gi = s.gateInOrders[0];
    s = verifyGateInOfficeAndCreatePayment({ ...s, currentUser: office.currentUser }, {
      gateInId: gi.id, containerNo: 'MSKU1234567', size: '40', type: 'HC', truckNo: '15C', driverPhone: '0912345678',
      customerName: 'Công ty Tiếp Vận Việt (VietLog)', shippingLineCode: 'MAERSK', orderDocNo: '', feeCatalogIds: ['fee-rac-40'],
    });
    s = confirmGateInPaymentAndComplete(s, { gateInId: gi.id, paymentCategory: 'TTTT', directMethod: 'CASH' });
    const ptNo = s.paymentReceipts[0].receiptNo;

    const withLink = renderToString(<MasterDossierModal masterDossierCode={gi.masterDossierCode} state={s} onClose={noop} onOpenReceipt={noop} />);
    expect(withLink).toContain('Thu tiền — HẠ VỎ');
    expect(withLink).toContain("text-blue-700 underline");
    expect(withLink).toContain(`Phiếu thu ${ptNo}`);
    const noLink = renderToString(<MasterDossierModal masterDossierCode={gi.masterDossierCode} state={s} onClose={noop} />);
    expect(noLink).toContain(ptNo);
    expect(noLink).not.toContain("text-blue-700 underline");
  });
});

describe('DEC-052: phiếu K80 có lộ trình; màn Trả chứng từ', () => {
  it('K80 hiển thị thông tin chung + LỘ TRÌNH; màn Trả chứng từ render', () => {
    const ticket = base.k80Tickets[0];
    const html = renderToString(<K80TicketModal ticket={ticket} state={base} onClose={noop} />);
    expect(html).toContain('LỘ TRÌNH');
    expect(html).toContain('SĐT LÁI XE');
    expect(html).toContain('nhận EEIR / phiếu thu');
    expect(renderToString(<DocumentReturnWorkspace state={as(base, 'usr-office')} onUpdateState={noop} />)).toContain('Trả chứng từ');
  });
});

describe('DEC-056: màn Phiếu thu / Báo cáo mở lần đầu đã điền sẵn 24 giờ gần nhất', () => {
  it('ô Đến có giá trị dd/MM/yyyy HH:mm:ss', () => {
    for (const el of [
      <ReceiptsWorkspace state={as(base, 'usr-office')} onUpdateState={noop} />,
      <ReportsWorkspace state={base} section="BC_HA_VO" onOpenDossier={noop} />,
      <ReportsWorkspace state={base} section="BC_SUA_CHUA" onOpenDossier={noop} />,
      <ReportsWorkspace state={base} section="BC_TONG_HOP" onOpenDossier={noop} />,
    ]) {
      expect(renderToString(el)).toMatch(/value="\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}"/);
    }
  });
});
