import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialState, DepotState } from '../src/services/depotStore';
import { App } from '../src/app/App';
import { FeedbackButton, FeedbackPanel } from '../src/components/FeedbackButton';
import { FeedbackReport } from '../src/features/reports/FeedbackReport';
import { InvoicePortal } from '../src/features/invoice/InvoicePortal';
import { InvoicePanel } from '../src/features/receipts/ReceiptsWorkspace';
import { createDemoState } from '../src/services/demoData';
import { YardFeature } from '../src/features/yard/YardFeature';
import { OfficeCapVoWorkspace, OfficeHaVoWorkspace } from '../src/features/office/OfficeWorkspaces';
import { ExportPicker, OfficeVesselWorkspace } from '../src/features/vessel/OfficeVesselWorkspace';
import { VesselFieldMobile } from '../src/features/vessel/VesselFieldMobile';
import { createVesselList, inspectVesselImportItem } from '../src/services/vessel';
import { FieldQueueWorkspaces, FieldQueueMode, getFieldQueue, QueueListRow } from '../src/features/field-queues/FieldQueueWorkspaces';
import { YardShiftWorkspace } from '../src/features/forklift/YardShiftWorkspace';
import { MasterUsagePanel, ReceiptsWorkspace } from '../src/features/receipts/ReceiptsWorkspace';
import { ReportsWorkspace } from '../src/features/reports/ReportsWorkspace';
import { MasterCatalogWorkspace } from '../src/features/catalog/MasterCatalogWorkspace';
import { MasterDossierModal } from '../src/components/MasterDossierModal';
import { InspectorHaVoMobile } from '../src/features/inspector/InspectorHaVoMobile';
import { RepairTeamCatalog } from '../src/features/catalog/RepairTeamCatalog';
import { UserRoleCatalog } from '../src/features/catalog/UserRoleCatalog';
import { DocumentReturnWorkspace } from '../src/features/office/DocumentReturnWorkspace';
import { K80TicketModal } from '../src/components/K80TicketModal';
import { CompanyCatalog } from '../src/features/catalog/CompanyCatalog';
import { EeirPrintSheet, ReceiptPrintSheet, VesselEeirPrintSheet } from '../src/components/ReceiptPrint';
import { DetailDrawer, FeeLinesEditor, Pager } from '../src/components/shared';
import { confirmGateInPaymentAndComplete, recordGateInFieldStep, toggleContainerHold, verifyGateInOfficeAndCreatePayment } from '../src/services/depotOperations';

// Smoke test: mỗi màn hình render được với dữ liệu mẫu, không ném lỗi khi render
const noop = () => {};
const base = createInitialState();
const as = (s: DepotState, id: string) => ({ ...s, currentUser: s.staffUsers.find((u) => u.id === id)! });

describe('UI smoke — render các màn hình với dữ liệu mẫu', () => {
  it('App khung menu', () => {
    // DEC-106: App mở với dữ liệu sạch; smoke này cần dữ liệu mẫu → nạp qua localStorage giả
    const store: Record<string, string> = { matran_depot_erp_state_v12: JSON.stringify(base) };
    const prev = (globalThis as { localStorage?: unknown }).localStorage;
    (globalThis as { localStorage?: unknown }).localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => { store[k] = v; }, removeItem: (k: string) => { delete store[k]; } };
    const html = renderToString(<App />);
    (globalThis as { localStorage?: unknown }).localStorage = prev;
    expect(html).toContain('MATRAN DEPOT');
    expect(html).toContain('Đảo chuyển');
    expect(html).not.toContain('HẠ SỬA CHỮA');
    expect(html.match(/aria-label="Tác nghiệp mobile"/g)?.length).toBe(10);
    // DEC-075: việc hiện trường đang chờ được tô cam + chấm nhấp nháy
    expect(html).toContain('Có việc đang chờ');
    // DEC-078: biểu tượng mobile nằm trong cột cố định → thẳng hàng
    expect(html.match(/flex w-6 shrink-0 justify-center"><span title="Tác nghiệp mobile"/g)?.length).toBe(10);
  });

  it('Tồn vỏ hiển thị biểu tượng khóa và dấu - cho container chưa có vị trí', () => {
    const locked = toggleContainerHold(as(base, 'usr-office'), { containerNo: 'MSKU4089123', hold: true, reason: 'Giữ' });
    const html = renderToString(<YardFeature state={locked} onUpdateState={noop} />);
    expect(html).toContain('Container đang bị khóa');
    expect(html).toContain('>-<');
    expect(html).toContain('Lưu bãi');
    // DEC-074: cột Date in nằm giữa Hãng tàu và Trạng thái
    expect(html).toMatch(/Hãng tàu<\/th><th[^>]*>Date in<\/th><th[^>]*>Trạng thái/);
    // DEC-128: cột Phân loại (đóng hàng) ngay bên phải Trạng thái
    expect(html).toMatch(/>Trạng thái<\/th><th[^>]*>Phân loại<\/th>/);
    expect(html).toContain('Tìm hàng loạt');
    expect(html).toContain('Container không khóa');
    // DEC-099: cột thanh toán
    expect(html).toContain('>Thanh toán<');
    expect(html).toContain('>Mã phiếu thu<');
    expect(html).toContain('>TRẢ TRƯỚC<'); // DEC-127: không kèm ký hiệu
    expect(html).not.toContain('TTR — TRẢ TRƯỚC');
    expect(html).not.toContain('>Thao tác<');
  });

  it('DEC-109: Danh mục Vị trí có cột / ô đánh dấu Kệ giám định', () => {
    const html = renderToString(<MasterCatalogWorkspace state={as(base, 'usr-admin')} onUpdateState={noop} tab="VI_TRI" />);
    expect(html).toContain('Kệ giám định');
    expect(html).toContain('Đây là KỆ GIÁM ĐỊNH');
    expect(html).toContain('aria-label="Kệ giám định BLOCK-DAMAGE"');
  });

  it('DEC-105: mã phiếu thu ở Tồn vỏ là link mở phiếu thu thực tế', () => {
    // Dữ liệu mẫu chưa có phiếu nạp của PTT-2026-001 → thêm 1 giao dịch nạp + phiếu thu để có link
    const m = base.masterReceipts.find((x) => x.receiptCode === 'PTT-2026-001')!;
    const s = {
      ...base,
      paymentTransactions: [...base.paymentTransactions, { id: 'tx-topup', masterReceiptId: m.id, status: 'SUCCEEDED' } as DepotState['paymentTransactions'][number]],
      paymentReceipts: [...base.paymentReceipts, { id: 'rc-topup', transactionId: 'tx-topup', receiptNo: 'PT-TTR-261019-0001' } as DepotState['paymentReceipts'][number]],
    };
    const html = renderToString(<YardFeature state={s} onUpdateState={noop} onOpenReceipt={noop} />);
    expect(html).toContain('title="Mở phiếu thu"');
    // DEC-117: link dữ liệu cùng kiểu Mã hồ sơ (font-mono text-blue-700, gạch chân khi rê chuột)
    expect(html).toContain('class="font-mono text-blue-700 hover:underline" title="Mở phiếu thu"');
    // DEC-118: mã hồ sơ ở Tồn vỏ cũng là link (cùng kiểu)
    expect(html).toMatch(/<button type="button" class="font-mono text-blue-700 hover:underline">HV-/);
    expect(renderToString(<YardFeature state={base} onUpdateState={noop} />)).not.toContain('title="Mở phiếu thu"');
  });

  it('Văn phòng / Xe nâng / Vệ sinh / Báo giá / Sửa chữa / Phiếu thu / Báo cáo / Danh mục / Hồ sơ', () => {
    const office = as(base, 'usr-office');
    const screens: React.ReactElement[] = [
      <OfficeHaVoWorkspace state={office} onUpdateState={noop} onOpenK80Ticket={noop} />,
      <OfficeCapVoWorkspace state={office} onUpdateState={noop} onOpenK80Ticket={noop} />,
      <OfficeVesselWorkspace mode="NHAP_TAU" state={office} onUpdateState={noop} />,
      <OfficeVesselWorkspace mode="XUAT_TAU" state={office} onUpdateState={noop} />,
      <ReportsWorkspace state={base} section="BC_NHAP_TAU" onOpenDossier={noop} />,
      <ReportsWorkspace state={base} section="BC_XUAT_TAU" onOpenDossier={noop} />,
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
      <MasterDossierModal masterDossierCode="HV-261019-001" state={base} onClose={noop} />,
      <MasterDossierModal masterDossierCode="CV-261018-001" state={base} onClose={noop} />,
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
    // DEC-058: thứ tự bộ phận; thanh toán 1 mục riêng ngay dưới Văn phòng; xác nhận HOÀN THÀNH
    const order = ['Giám định — Hạ vỏ', 'Văn phòng — Hạ vỏ', 'Thanh toán — Hạ vỏ', 'Xe nâng — Hạ vỏ', 'Văn phòng — Trả chứng từ Hạ vỏ'].map((x) => withLink.indexOf(x));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(withLink.match(/Thanh toán — Hạ vỏ/g)).toHaveLength(1);
    expect(withLink).toContain('Hoàn thành');
    expect(withLink).toContain("font-mono text-blue-700 hover:underline");
    expect(withLink).toContain(`Phiếu thu ${ptNo}`);
    const noLink = renderToString(<MasterDossierModal masterDossierCode={gi.masterDossierCode} state={s} onClose={noop} />);
    expect(noLink).toContain(ptNo);
    expect(noLink).not.toContain("font-mono text-blue-700 hover:underline");
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

describe('DEC-102 (thay DEC-056): màn Phiếu thu / Báo cáo có ô lọc nhanh, mặc định Hôm nay', () => {
  it('mọi màn có bộ lọc thời gian đều có ô Lọc nhanh, chọn sẵn Hôm nay', () => {
    for (const el of [
      <ReceiptsWorkspace state={as(base, 'usr-office')} onUpdateState={noop} />,
      <ReportsWorkspace state={base} section="BC_HA_VO" onOpenDossier={noop} />,
      <ReportsWorkspace state={base} section="BC_SUA_CHUA" onOpenDossier={noop} />,
      <ReportsWorkspace state={base} section="BC_TONG_HOP" onOpenDossier={noop} />,
    ]) {
      expect(renderToString(el)).toMatch(/aria-label="Lọc nhanh thời gian"[^>]*><option value="TODAY" selected/);
    }
  });
});

describe('DEC-059: nút xóa hồ sơ ở Giám định', () => {
  it('Màn Giám định render được (nút xóa nằm trong chi tiết hồ sơ chưa qua Văn phòng)', () => {
    expect(renderToString(<InspectorHaVoMobile state={as(base, 'usr-inspector')} onUpdateState={noop} />)).toContain('Hạ vỏ');
  });
});

describe('DEC-062/064: mẫu in phiếu thu thống nhất; Trả chứng từ 2 phần; Danh mục Công ty', () => {
  it('Phiếu thu in có tên công ty + TÁC NGHIỆP; bản in lại có nhãn; Trả chứng từ có 2 tab', () => {
    const office = as(base, 'usr-office');
    let s = recordGateInFieldStep(as(base, 'usr-inspector'), {
      gateInType: 'CUSTOMER_RETURN', doorPhotoUrl: 'data:x', conditionClass: 'AV', stuffingClass: 'E', cleaningItems: ['KHÔNG VỆ SINH'], manufactureYear: 2019,
    });
    const gi = s.gateInOrders[0];
    s = verifyGateInOfficeAndCreatePayment({ ...s, currentUser: office.currentUser }, {
      gateInId: gi.id, containerNo: 'MSKU1234567', size: '40', type: 'HC', truckNo: '15C', driverPhone: '0912345678',
      customerName: 'Công ty Tiếp Vận Việt (VietLog)', shippingLineCode: 'MAERSK', orderDocNo: '', feeCatalogIds: ['fee-rac-40'],
    });
    s = confirmGateInPaymentAndComplete(s, { gateInId: gi.id, paymentCategory: 'TTTT', directMethod: 'CASH' });
    const r = s.paymentReceipts[0];
    const first = renderToString(<ReceiptPrintSheet state={s} receipt={r} printNo={1} />);
    expect(first).toContain(s.companyProfile.name);
    expect(first.replace(/<!-- -->/g, '')).toContain('TÁC NGHIỆP: HẠ VỎ');
    expect(first).not.toContain('BẢN IN LẠI');
    expect(renderToString(<ReceiptPrintSheet state={s} receipt={r} printNo={2} />)).toContain('BẢN IN LẠI');

    const ret = renderToString(<DocumentReturnWorkspace state={office} onUpdateState={noop} />);
    expect(ret.replace(/<!-- -->/g, '')).toContain('Đang chờ TRẢ CHỨNG TỪ HẠ VỎ');
    expect(ret.replace(/<!-- -->/g, '')).toContain('Đang chờ TRẢ CHỨNG TỪ CẤP VỎ');
    // DEC-110: nút Xem trước nằm bên trái nút Trả chứng từ / Xác nhận & in
    expect(ret).toMatch(/Xem trước<\/button><button[^>]*>(Trả chứng từ|Xác nhận &amp; in)<\/button>/);
    expect(renderToString(<CompanyCatalog state={as(base, 'usr-admin')} onUpdateState={noop} />)).toContain('Lưu thông tin công ty');
  });
});

describe('DEC-069: màn Nhập tàu / Xuất tàu', () => {
  it('Văn phòng thấy danh sách + tiến độ; mobile Giám định / Xe nâng / Vệ sinh khung max-w-lg; hồ sơ NT- / XT-', () => {
    const office = as(createInitialState(), 'usr-office');
    const nt = createVesselList(office, {
      mode: 'NHAP_TAU', vesselName: 'Ever Gentle', plannedAt: new Date().toISOString(), truckNos: ['15C-111.11'], shippingLineCode: 'MAERSK',
      importItems: [{ containerNo: 'TCLU1234567', size: '40', type: 'HC' }],
    }).state;
    const yardId = nt.containers.find((c) => c.status === 'IN_YARD')!.id;
    const both = createVesselList(nt, { mode: 'XUAT_TAU', vesselName: 'Wan Hai', plannedAt: new Date().toISOString(), truckNos: ['15C-333.33'], exportContainerIds: [yardId] }).state;
    const strip = (h: string) => h.replace(/<!-- -->/g, '');

    const vpNt = strip(renderToString(<OfficeVesselWorkspace mode="NHAP_TAU" state={both} onUpdateState={noop} />));
    expect(vpNt).toContain('EVER GENTLE');
    expect(vpNt).toContain('Lập danh sách NHẬP TÀU');
    expect(vpNt).toContain('Xong 0/1');
    const vpXt = strip(renderToString(<OfficeVesselWorkspace mode="XUAT_TAU" state={both} onUpdateState={noop} />));
    expect(vpXt).toContain('WAN HAI');
    expect(vpXt).toContain('Lập danh sách XUẤT TÀU');

    const gd = strip(renderToString(<VesselFieldMobile kind="GD_NHAP_TAU" state={as(both, 'usr-inspector')} onUpdateState={noop} />));
    expect(gd).toContain('max-w-lg');
    expect(gd).toContain('TCLU1234567');
    expect(gd).toContain('Chờ làm (1)');
    expect(gd).toContain('Đã xong (0)');
    expect(gd).toContain('Bạn đã làm');
    expect(gd).toContain('15C-111.11: 0');
    const xnNt = strip(renderToString(<VesselFieldMobile kind="XN_NHAP_TAU" state={as(both, 'usr-forklift')} onUpdateState={noop} />));
    expect(xnNt).toContain('đã hạ bãi');
    expect(xnNt).toContain('Chưa về — chờ Giám định');
    const xn = strip(renderToString(<VesselFieldMobile kind="XN_XUAT_TAU" state={as(both, 'usr-forklift')} onUpdateState={noop} />));
    expect(xn).toContain('max-w-lg');
    expect(xn).toContain('Bộ phận Xe nâng');

    const xtCode = both.vesselLists[0].items[0].dossierCode!;
    expect(strip(renderToString(<MasterDossierModal masterDossierCode={xtCode} state={both} onClose={noop} />))).toContain('Tác nghiệp XUẤT TÀU');

    const ntList = both.vesselLists.find((l) => l.mode === 'NHAP_TAU')!;
    const inspected = inspectVesselImportItem(as(both, 'usr-inspector'), {
      listId: ntList.id, itemId: ntList.items[0].id, actualContainerNo: 'TCLU1234567', truckNo: '15C-111.11',
      conditionClass: 'AV', stuffingClass: 'E', cleaningItems: ['WW'], manufactureYear: 2015,
    });
    const ntCode = inspected.vesselLists.find((l) => l.id === ntList.id)!.items[0].dossierCode!;
    const ntHtml = strip(renderToString(<MasterDossierModal masterDossierCode={ntCode} state={inspected} onClose={noop} />));
    expect(ntHtml).toContain('Tác nghiệp NHẬP TÀU');
    expect(ntHtml).toContain('Giám định — Nhập tàu');
    expect(ntHtml).toContain('Vệ sinh');
    expect(ntHtml).toContain('Văn phòng — Duyệt nhập tàu');
  });
});

describe('DEC-070: menu Vệ sinh không còn Nhập tàu; cont nhập tàu có vệ sinh vào Chờ vệ sinh chung', () => {
  it('Cont NT- chờ vệ sinh hiện trong Vệ sinh → Chờ vệ sinh', () => {
    const office = as(createInitialState(), 'usr-office');
    const { state: s, listId } = createVesselList(office, {
      mode: 'NHAP_TAU', vesselName: 'Tàu VS', plannedAt: new Date().toISOString(), truckNos: ['15C-1'], shippingLineCode: 'MAERSK',
      importItems: [{ containerNo: 'TCLU5555555', size: '20', type: 'DC' }],
    });
    const done = inspectVesselImportItem(as(s, 'usr-inspector'), {
      listId, itemId: s.vesselLists[0].items[0].id, actualContainerNo: 'TCLU5555555', truckNo: '15C-1',
      conditionClass: 'AV', stuffingClass: 'E', cleaningItems: ['WW'], manufactureYear: 2018,
    });
    expect(getFieldQueue(done, 'VS_CHO_VE_SINH').some((c) => c.containerNo === 'TCLU5555555' && c.masterDossierCode.startsWith('NT-'))).toBe(true);
    const html = renderToString(<FieldQueueWorkspaces mode="VS_CHO_VE_SINH" state={as(done, 'usr-cleaning')} onUpdateState={noop} />);
    expect(html).toContain('Chờ vệ sinh');
    expect(renderToString(<App />)).not.toContain('VS_NHAP_TAU');
  });
});

describe('DEC-072: in EEIR đồng bộ với phiếu thu', () => {
  it('Hồ sơ có nút In EEIR (không còn "In hồ sơ" in trang trắng); EEIR cùng khung với phiếu thu: công ty, Số, TÁC NGHIỆP, chữ ký', () => {
    const s = createInitialState();
    const t = s.k80Tickets[0];
    expect(t).toBeTruthy();
    const strip = (h: string) => h.replace(/<!-- -->/g, '');
    const dossier = strip(renderToString(<MasterDossierModal masterDossierCode={t.masterDossierCode} state={s} onClose={noop} onUpdateState={noop} />));
    expect(dossier).toContain('In EEIR');
    expect(dossier).not.toContain('In hồ sơ');
    const eeir = strip(renderToString(<EeirPrintSheet state={s} ticket={t} />));
    expect(eeir).toContain(s.companyProfile.name);
    expect(eeir).toContain('EEIR — PHIẾU GIAO NHẬN CONTAINER');
    expect(eeir).toContain(`Số: ${t.operationMode === 'CAP_VO' ? t.outDossierCode : t.masterDossierCode}`);
    expect(eeir).toMatch(/TÁC NGHIỆP: (HẠ|CẤP) VỎ/);
    expect(eeir).toContain(t.containerNo);
    expect(eeir).toContain('In lúc');
    // DEC-076: EEIR ghi tình trạng vỏ của Giám định, không in các bộ phận; khổ A5 (print-sheet)
    expect(eeir).toContain('Tình trạng vỏ (Giám định)');
    expect(eeir).not.toContain('Bộ phận');
    expect(eeir).toContain('print-sheet');
  });
});

describe('DEC-073: Lập danh sách XUẤT TÀU có Tìm hàng loạt như Tồn vỏ', () => {
  it('Bộ chọn cont từ tồn vỏ có nút Tìm hàng loạt', () => {
    const html = renderToString(<ExportPicker state={as(base, 'usr-office')} picked={new Set()} onChange={noop} />);
    expect(html).toContain('Tìm hàng loạt');
    expect(html).toContain('Chọn container từ tồn vỏ');
  });
});

describe('DEC-076: Phiếu thu — nút Tạo phiếu thu TTT cùng hàng Tra cứu', () => {
  it('Nút Tạo phiếu thu TTT nằm trong hàng nút tra cứu; form chưa mở sẵn', () => {
    const html = renderToString(<ReceiptsWorkspace state={as(base, 'usr-office')} onUpdateState={noop} />).replace(/<!-- -->/g, '');
    expect(html).toMatch(/Tra cứu<\/button>.*Tạo phiếu thu TTR \(trả trước\)<\/button>/s);
    expect(html).not.toContain('Tạo phiếu thu (chờ thanh toán)');
    // DEC-102: ô lọc nhanh thời gian, mặc định Hôm nay; chưa chọn Tùy chọn thì chưa hiện ô Từ - Đến
    expect(html).toContain('aria-label="Lọc nhanh thời gian"');
    for (const t of ['Hôm nay', 'Hôm qua', 'Tuần này', 'Tuần trước', 'Tháng này', 'Tháng trước', 'Năm nay', 'Tùy chọn']) expect(html).toContain(t);
    expect(html).not.toContain('Từ (dd/mm/yyyy hh:mm:ss)');
  });
});

describe('DEC-077: phiếu thu trước — biểu giá × số lượng, bản in riêng', () => {
  it('In PHIẾU THU TRƯỚC: tên khác, khung PTT-, cột SL / Đơn giá; khối Chi phí có số lượng', async () => {
    const { createMasterPrepaidReceipt, confirmPrepaidCash } = await import('../src/services/payments');
    const office = as(createInitialState(), 'usr-office');
    const fee = office.feeCatalog[0];
    let s = createMasterPrepaidReceipt(office, { customerCode: office.partners.find((p) => p.isCustomer)!.code, lotDescription: 'Lô tháng 11', method: 'CASH', feeItems: [{ catalogId: fee.id, quantity: 3 }] });
    const master = s.masterReceipts[0];
    s = confirmPrepaidCash(s, { transactionId: s.paymentTransactions[0].id });
    const receipt = s.paymentReceipts.find((r) => r.masterReceiptId === master.id)!;
    const html = renderToString(<ReceiptPrintSheet state={s} receipt={receipt} />).replace(/<!-- -->/g, '');
    expect(html).toContain('PHIẾU THU TRẢ TRƯỚC (TTR)');
    expect(html).toContain(master.receiptCode);
    expect(html).toContain('SỐ TIỀN NẠP TRƯỚC');
    expect(html).toContain('Lô tháng 11');
    expect(html).toContain('>SL<');
    const editor = renderToString(<FeeLinesEditor catalog={s.feeCatalog} selectedIds={[fee.id]} onChange={noop} quantities={[3]} onQuantitiesChange={noop} />);
    expect(editor).toContain('Số lượng');
  });
});

describe('DEC-079: khối Sử dụng phiếu thu trả trước', () => {
  it('Hiện tổng nạp, số lượt, đã trừ, còn lại và bảng từng lần trừ (link hồ sơ)', () => {
    const html = renderToString(<MasterUsagePanel state={base} code="PTT-2026-001" />).replace(/<!-- -->/g, '');
    expect(html).toContain('Sử dụng phiếu thu trả trước PTT-2026-001');
    expect(html).toContain('1 lượt');
    expect(html).toContain('HV-261019-001');
    expect(html).toContain('Còn lại');
  });
});

describe('DEC-080: trang nhiều dữ liệu — chi tiết mở cửa sổ trượt phải, chọn số dòng', () => {
  it('DetailDrawer có tiêu đề + nút đóng; Pager có ô chọn 20 / 50 / 100', () => {
    const drawer = renderToString(<DetailDrawer open title="Chi tiết thử" onClose={noop}><p>Nội dung</p></DetailDrawer>);
    expect(drawer).toContain('Chi tiết thử');
    expect(drawer).toContain('aria-label="Đóng"');
    expect(drawer).toContain('justify-end');
    expect(renderToString(<DetailDrawer open={false} title="x" onClose={noop}>y</DetailDrawer>)).toBe('');
    const pager = renderToString(<Pager page={1} pageCount={3} total={120} onPage={noop} pageSize={50} onPageSize={noop} />).replace(/<!-- -->/g, '');
    expect(pager).toContain('Số dòng mỗi trang');
    expect(pager).toContain('100 dòng / trang');
  });
});

describe('DEC-081: EEIR cho hồ sơ Nhập tàu / Xuất tàu', () => {
  it('Hồ sơ NT- / XT- có nút In EEIR; mẫu EEIR tàu cùng khung, có tình trạng vỏ Giám định', async () => {
    const { executeVesselExport } = await import('../src/services/vessel');
    const strip = (h: string) => h.replace(/<!-- -->/g, '');
    const office = as(createInitialState(), 'usr-office');
    let { state: s, listId } = createVesselList(office, {
      mode: 'NHAP_TAU', vesselName: 'Tàu EEIR', plannedAt: new Date().toISOString(), truckNos: ['15C-9'], shippingLineCode: 'MAERSK',
      importItems: [{ containerNo: 'TCLU8888888', size: '40', type: 'HC' }],
    });
    s = inspectVesselImportItem(as(s, 'usr-inspector'), {
      listId, itemId: s.vesselLists[0].items[0].id, actualContainerNo: 'TCLU8888888', truckNo: '15C-9',
      conditionClass: 'DAMAGE', damageRemarks: ['Móp vách'], stuffingClass: 'E', cleaningItems: ['WW'], manufactureYear: 2016,
    });
    const nt = s.vesselLists[0];
    const ntItem = nt.items[0];
    expect(strip(renderToString(<MasterDossierModal masterDossierCode={ntItem.dossierCode!} state={s} onClose={noop} />))).toContain('In EEIR NHẬP TÀU');
    const ntSheet = strip(renderToString(<VesselEeirPrintSheet state={s} list={nt} item={ntItem} />));
    expect(ntSheet).toContain('EEIR — PHIẾU GIAO NHẬN CONTAINER');
    expect(ntSheet).toContain(`Số: ${ntItem.dossierCode}`);
    expect(ntSheet).toContain('TÁC NGHIỆP: NHẬP TÀU');
    expect(ntSheet).toContain('TÀU EEIR');
    expect(ntSheet).toContain('Tình trạng vỏ (Giám định)');
    expect(ntSheet).toContain('Móp vách');
    expect(ntSheet).toContain('Không thu phí');

    // Xuất tàu: cont đang tồn bãi → lập danh sách → xuất → EEIR XUẤT TÀU
    const yardId = s.containers.find((c) => c.status === 'IN_YARD')!.id;
    const xt = createVesselList(as(s, 'usr-office'), { mode: 'XUAT_TAU', vesselName: 'Tàu Ra', plannedAt: new Date().toISOString(), truckNos: ['15C-7'], exportContainerIds: [yardId] });
    s = executeVesselExport(as(xt.state, 'usr-forklift'), { listId: xt.listId, itemId: xt.state.vesselLists[0].items[0].id, truckNo: '15C-7' });
    const xtList = s.vesselLists.find((l) => l.id === xt.listId)!;
    const xtSheet = strip(renderToString(<VesselEeirPrintSheet state={s} list={xtList} item={xtList.items[0]} />));
    expect(xtSheet).toContain('TÁC NGHIỆP: XUẤT TÀU');
    expect(xtSheet).toContain('Thời gian OUT');
    expect(xtSheet).toContain('15C-7');
    expect(strip(renderToString(<MasterDossierModal masterDossierCode={xtList.items[0].dossierCode!} state={s} onClose={noop} />))).toContain('In EEIR XUẤT TÀU');
  });
});

describe('UI-02: form Giám định dùng chung (Hạ vỏ / Nhập tàu)', () => {
  it('progressive: chỉ hiện mục 1 khi trống, đủ mục trước mới hiện mục sau; không progressive hiện cả 4', async () => {
    const m = await import('../src/components/InspectionFields');
    const { InspectionFields, EMPTY_INSPECTION, isInspectionComplete, inspectionRemarks } = m;
    const empty = renderToString(<InspectionFields progressive value={EMPTY_INSPECTION} onChange={noop} />);
    expect(empty).toContain('1. TRẠNG THÁI');
    expect(empty).not.toContain('2. PHÂN LOẠI ĐÓNG HÀNG');
    const step2 = renderToString(<InspectionFields progressive value={{ ...EMPTY_INSPECTION, condition: 'AV' }} onChange={noop} />);
    expect(step2).toContain('2. PHÂN LOẠI ĐÓNG HÀNG');
    expect(step2).not.toContain('3. TÌNH TRẠNG VỆ SINH');
    const damageNoRemark = renderToString(<InspectionFields progressive value={{ ...EMPTY_INSPECTION, condition: 'DAMAGE' }} onChange={noop} />);
    expect(damageNoRemark).not.toContain('2. PHÂN LOẠI ĐÓNG HÀNG');
    const all = renderToString(<InspectionFields value={EMPTY_INSPECTION} onChange={noop} />);
    expect(all).toContain('4. AGE');
    const full = { condition: 'DAMAGE' as const, damage: ['Móp vách'], damageNote: 'Thủng sàn, ', stuffing: 'E' as const, cleaning: ['WW - RỬA NƯỚC' as const], year: '2018' };
    expect(isInspectionComplete(full)).toBe(true);
    expect(isInspectionComplete({ ...full, year: '18' })).toBe(false);
    expect(isInspectionComplete({ ...full, damage: [], damageNote: '' })).toBe(false);
    expect(inspectionRemarks(full)).toEqual(['Móp vách', 'Thủng sàn']);
  });
});

describe('DEC-082: chọn vị trí chỉ hiện chiều Block có cấu hình', () => {
  it('BLOCK-A hiện Bay / Row / Tier; BLOCK-B (chỉ Block) không hiện, báo chỉ cần Block', async () => {
    const { SlotPicker, isSlotComplete } = await import('../src/components/shared');
    const a = renderToString(<SlotPicker state={base} value={{ blockCode: 'BLOCK-A', bay: '', row: '', tier: '' }} onChange={noop} />);
    expect(a).toContain('Bay');
    expect(a).toContain('Tier');
    const b = renderToString(<SlotPicker state={base} value={{ blockCode: 'BLOCK-B', bay: '', row: '', tier: '' }} onChange={noop} />);
    expect(b).not.toContain('>Bay');
    expect(b).toContain('chỉ quản lý theo Block');
    expect(isSlotComplete({ blockCode: 'BLOCK-B', bay: '', row: '', tier: '' }, base)).toBe(true);
    expect(isSlotComplete({ blockCode: 'BLOCK-A', bay: '01', row: '', tier: '' }, base)).toBe(false);
  });
});

describe('DEC-125: chọn vị trí từng bước (Block → Bay → Row → Tier), tóm tắt ở trên', () => {
  it('chưa chọn: chỉ hiện toàn bộ Block dạng nút; chọn dần thì tóm tắt hiện giá trị đã chọn và bước tiếp theo', async () => {
    const { SlotPicker } = await import('../src/components/shared');
    const empty = renderToString(<SlotPicker state={base} value={{ blockCode: '', bay: '', row: '', tier: '' }} onChange={noop} />).replace(/<!-- -->/g, '');
    expect(empty).toContain('Chọn Block *');
    for (const b of base.yardBlocks) expect(empty).toContain(`>${b.blockCode}</button>`);
    expect(empty).not.toContain('Chọn Bay');
    const bay = renderToString(<SlotPicker state={base} value={{ blockCode: 'BLOCK-A', bay: '', row: '', tier: '' }} onChange={noop} />).replace(/<!-- -->/g, '');
    expect(bay).toContain('Chọn Bay * (01 → 20)');
    expect(bay).not.toContain('Chọn Block *');
    expect(bay).toMatch(/data-testid="slot-summary"[\s\S]*>BLOCK-A<\/button>/);
    const row = renderToString(<SlotPicker state={base} value={{ blockCode: 'BLOCK-A', bay: '05', row: '', tier: '' }} onChange={noop} />).replace(/<!-- -->/g, '');
    expect(row).toContain('>05</button>');
    expect(row).toContain('Chọn Row *');
    expect(row).not.toContain('Chọn Tier');
    const done = renderToString(<SlotPicker state={base} value={{ blockCode: 'BLOCK-A', bay: '05', row: '02', tier: '01' }} onChange={noop} />).replace(/<!-- -->/g, '');
    expect(done).toContain('✓ Đủ vị trí');
    expect(done).not.toContain('Chọn Tier');
    const rack = renderToString(<SlotPicker state={base} value={{ blockCode: '', bay: '', row: '', tier: '' }} onChange={noop} onlyBlocks={['BLOCK-DAMAGE']} />);
    expect(rack).toContain('>BLOCK-DAMAGE</button>');
    expect(rack).not.toContain('>BLOCK-A</button>');
  });
});

describe('DEC-083: nhãn tác nghiệp ở màn Vệ sinh / Xe nâng', () => {
  it('OperationBadge hiện HẠ VỎ cho cont thường', async () => {
    const { OperationBadge } = await import('../src/features/vessel/VesselShared');
    const c = base.containers.find((x) => x.status === 'IN_YARD')!;
    expect(renderToString(<OperationBadge state={base} container={c} large />)).toContain('HẠ VỎ');
  });
});

describe('DEC-084: Báo giá → Chờ báo giá hiển thị như Tồn vỏ', () => {
  it('Bảng full cột như Tồn vỏ + cột Hư hỏng; có lọc, Excel, chọn số dòng; không còn thẻ form cũ', () => {
    const q = getFieldQueue(base, 'BG_CHO_BAO_GIA');
    const html = renderToString(<FieldQueueWorkspaces mode="BG_CHO_BAO_GIA" state={as(base, 'usr-quotation')} onUpdateState={noop} />).replace(/<!-- -->/g, '');
    expect(html).toContain('Chờ báo giá');
    for (const col of ['Mã hồ sơ', 'Số container', 'Hãng tàu', 'Date in', 'Trạng thái', 'Lưu bãi', 'Vị trí', 'Tình trạng sửa chữa', 'Giờ công', 'Ghi chú', 'Tác nghiệp']) expect(html).toContain(col);
    expect(html).not.toContain('Hư hỏng (giám định)');
    if (q.length) expect(html).toContain('Xác nhận chờ sửa chữa');
    // DEC-088: tìm hàng loạt + chọn nhiều
    expect(html).toContain('Tìm hàng loạt');
    expect(html).toContain('Chọn tất cả theo bộ lọc');
    expect(html).toContain('Xuất Excel');
    if (q.length) {
      expect(html).toContain(q[0].containerNo);
      expect(html).toContain('Số dòng mỗi trang');
    }
    expect(html).not.toContain('max-w-2xl');
  });
});

describe('DEC-089: dòng danh sách chờ Vệ sinh / Xe nâng — ô tác nghiệp riêng bên trái', () => {
  it('Ô tác nghiệp đứng đầu (không kèm tên tàu); bên phải số cont rồi tên tàu ở tầng 2', () => {
    const strip = (h: string) => h.replace(/<!-- -->/g, '');
    const office = as(createInitialState(), 'usr-office');
    const nt = createVesselList(office, { mode: 'NHAP_TAU', vesselName: 'Tàu Tên Rất Dài', plannedAt: new Date().toISOString(), truckNos: ['15C-1'], shippingLineCode: 'MAERSK', importItems: [{ containerNo: 'TCLU4444444', size: '20', type: 'DC' }] });
    const s = inspectVesselImportItem(as(nt.state, 'usr-inspector'), { listId: nt.listId, itemId: nt.state.vesselLists[0].items[0].id, actualContainerNo: 'TCLU4444444', truckNo: '15C-1', conditionClass: 'AV', stuffingClass: 'E', cleaningItems: ['WW'], manufactureYear: 2018 });
    const c = s.containers.find((x) => x.containerNo === 'TCLU4444444')!;
    const html = strip(renderToString(<QueueListRow state={s} container={c} onClick={noop} />));
    const iOp = html.indexOf('NHẬP TÀU');
    const iCont = html.indexOf('TCLU4444444');
    const iVessel = html.indexOf('Tàu TÀU TÊN RẤT DÀI');
    expect(iOp).toBeGreaterThan(-1);
    expect(iCont).toBeGreaterThan(iOp);
    expect(iVessel).toBeGreaterThan(iCont);
    expect(html.match(/TÀU TÊN RẤT DÀI/g)?.length).toBe(1);
  });
});

describe('DEC-090: Xe nâng → Đảo chuyển — vị trí thẳng cột', () => {
  it('Mỗi dòng dùng lưới cột cố định (số cont | size/type | vị trí canh trái)', () => {
    const html = renderToString(<YardShiftWorkspace state={base} onUpdateState={noop} />).replace(/<!-- -->/g, '');
    const rows = html.match(/data-testid="shift-row"/g)?.length || 0;
    expect(rows).toBeGreaterThan(0);
    // DEC-092: 1 dòng số cont | size/type | "BLOCK-A / 04-02-01"; ô Block rộng = mã Block dài nhất (ch) → Bay-Row-Tier thẳng cột
    expect(html.match(/data-testid="shift-slot"/g)?.length).toBe(rows);
    const ch = Math.max(5, ...base.yardBlocks.map((b) => b.blockCode.length));
    expect(html.split(`style="width:${ch}ch"`).length - 1).toBe(rows);
    expect(html).toMatch(/>BLOCK-A<\/span><span class="truncate"> \/ 04-02-01<\/span>/);
    expect(html).toMatch(/>BLOCK-B<\/span><span class="truncate"><\/span>/);
    expect(html).not.toContain('>Tier</span>');
    // DEC-094: ô TRẠNG THÁI đầu dòng (AV / DAMAGE), tiến độ ở cuối ô
    expect(html.match(/data-testid="shift-status"/g)?.length).toBe(rows);
    expect(html.match(/data-testid="shift-progress"/g)?.length).toBe(rows);
    const c = base.containers.find((x) => x.containerNo === 'MSKU4089123')!;
    const at = html.indexOf(c.containerNo);
    const statusAt = html.lastIndexOf('data-testid="shift-status"', at);
    const progressAt = html.indexOf('data-testid="shift-progress"', at);
    expect(statusAt).toBeGreaterThan(-1);
    // DEC-115: 2 dòng — dòng 1 số cont | size/type | tiến độ; dòng 2 vị trí | ghi chú; không xuống dòng
    expect(progressAt).toBeLessThan(html.indexOf('/ 04-02-01', at));
    expect(html.indexOf('data-testid="shift-slot"', at)).toBeGreaterThan(progressAt);
    expect(html.match(/data-testid="shift-note"/g)?.length).toBe(rows);
    expect(html.indexOf('data-testid="shift-note"', at)).toBeGreaterThan(html.indexOf('data-testid="shift-slot"', at));
    expect(html.match(/flex items-center gap-2 overflow-hidden whitespace-nowrap/g)?.length).toBe(rows * 2);
    const noted = toggleContainerHold(as(base, 'usr-office'), { containerNo: 'MSKU4089123', hold: true, reason: 'Chờ hãng tàu' });
    const html2 = renderToString(<YardShiftWorkspace state={noted} onUpdateState={noop} />).replace(/<!-- -->/g, '');
    expect(html2).toMatch(/bg-yellow-200[^"]*"[^>]*>Ghi chú: Chờ hãng tàu</);
    // DEC-096: ô AV / DAMAGE cùng kích thước ô tác nghiệp ở danh sách Xe nâng (cột 5rem, px-1.5 py-1 text-[10px])
    expect(html).toContain('grid grid-cols-[5rem_1fr] items-center gap-2.5" data-testid="shift-row"');
    expect(html).toMatch(/data-testid="shift-status" class="[^"]*px-1\.5 py-1 text-center text-\[10px\]/);
    const row = renderToString(<QueueListRow state={base} container={c} onClick={noop} />);
    expect(row).toContain('grid-cols-[5rem_1fr]');
    expect(row).toMatch(/px-1\.5 py-1 text-\[10px\]/);
  });
});

describe('DEC-093: ô Khách hàng gõ tay + gợi ý Danh mục', () => {
  it('Có datalist gợi ý khách trong Danh mục; gõ tên mới thì cảnh báo chỉ Tiền mặt / Chuyển khoản', async () => {
    const { CustomerInput } = await import('../src/components/shared');
    const known = base.partners.find((p) => p.isCustomer)!;
    const a = renderToString(<CustomerInput id="t" state={base} value={known.name} onChange={noop} />);
    expect(a).toContain('<datalist id="t-list">');
    expect(a).toContain(known.name);
    expect(a).not.toContain('Khách ngoài Danh mục');
    const b = renderToString(<CustomerInput id="t" state={base} value="Anh Ba Vận Tải" onChange={noop} />);
    expect(b).toContain('Khách ngoài Danh mục');
    const ha = renderToString(<OfficeHaVoWorkspace state={as(base, 'usr-office')} onUpdateState={noop} onOpenK80Ticket={noop} />);
    expect(ha).not.toContain('<select value="" class') ;
  });
});

describe('DEC-097: Hình thức thanh toán — TTTT Trực tiếp đứng đầu và chọn sẵn', () => {
  it('Thứ tự TTTT → TTT → TTS; mặc định TTTT + Tiền mặt', async () => {
    const { PaymentPanel, EMPTY_PAYMENT } = await import('../src/components/shared');
    expect(EMPTY_PAYMENT).toMatchObject({ paymentCategory: 'TTTT', directMethod: 'CASH' });
    const html = renderToString(<PaymentPanel state={base} value={EMPTY_PAYMENT} onChange={noop} />);
    const iTTTT = html.indexOf('TT — Trực tiếp');
    expect(iTTTT).toBeGreaterThan(-1);
    expect(iTTTT).toBeLessThan(html.indexOf('TTR — Trả trước'));
    expect(html.indexOf('TTR — Trả trước')).toBeLessThan(html.indexOf('TTS — Thanh toán sau'));
    expect(html).toMatch(/aria-checked="true"[^>]*><span[^>]*>TT — Trực tiếp/);
  });
});

describe('DEC-111: xuất hóa đơn từ phiếu thu', () => {
  const demo = createDemoState();
  it('trang khách hàng: ô dán mã bảo mật, chưa hiện form khi chưa tra cứu', () => {
    const html = renderToString(<InvoicePortal state={demo} onUpdateState={noop} />);
    expect(html).toContain('Yêu cầu xuất hóa đơn');
    expect(html).toContain('aria-label="Mã bảo mật"');
    expect(html).not.toContain('Gmail nhận hóa đơn *'); // form chỉ hiện sau khi tra cứu đúng mã
    // DEC-113: hướng dẫn từng bước + xử lý khi sai thông tin / đã xuất
    expect(html).toContain('data-testid="invoice-guide"');
    expect(html).toContain('Cập nhật yêu cầu');
    expect(html).toContain('liên hệ Kế toán');
    // DEC-114: hướng dẫn nằm dưới ô mã bảo mật
    expect(html.indexOf('aria-label="Mã bảo mật"')).toBeLessThan(html.indexOf('data-testid="invoice-guide"'));
  });
  it('phiếu thu in kèm đường link + mã bảo mật', () => {
    const r = demo.paymentReceipts.find((x) => x.invoiceSecret)!;
    const html = renderToString(<ReceiptPrintSheet state={demo} receipt={r} printNo={1} />);
    expect(html).toContain('data-testid="invoice-secret"');
    expect(html).toContain(r.invoiceSecret!);
    expect(html).toContain('#/hoa-don');
  });
  it('Phiếu thu có cột / lọc Hóa đơn; Kế toán thấy nút Đã xuất hóa đơn khi khách đã yêu cầu', () => {
    const html = renderToString(<ReceiptsWorkspace state={as(demo, 'usr-acc')} onUpdateState={noop} />).replace(/<!-- -->/g, '');
    expect(html).toContain('>Hóa đơn<');
    expect(html).toContain('YÊU CẦU XHD');
    const req = demo.paymentReceipts.find((x) => x.invoiceStatus === 'YEU_CAU_XHD')!;
    const panel = renderToString(<InvoicePanel receipt={req} canIssue onIssue={noop} />);
    expect(panel).toContain('Đã xuất hóa đơn');
    expect(panel).toContain(req.invoiceRequest!.taxCode);
    expect(panel).toContain(req.invoiceSecret!); // DEC-112: hiện mã bảo mật để đối soát
    expect(panel).toContain('#/hoa-don'); // DEC-113: kèm đường link
    expect(renderToString(<InvoicePanel receipt={req} canIssue={false} onIssue={noop} />)).not.toContain('Đã xuất hóa đơn</button>');
  });
});

// DEC-116: quy tắc chữ 16px cho ô nhập trên màn nhỏ nằm ở src/index.css (môi trường test không nạp CSS — kiểm tra bằng tay trên điện thoại)
describe('DEC-116: Đảo chuyển không có ghi chú tác nghiệp', () => {
  it('Đảo chuyển: không còn ô Ghi chú tác nghiệp', () => {
    const c = base.containers.find((x) => x.status === 'IN_YARD' && x.currentBlock)!;
    const html = renderToString(<YardShiftWorkspace state={base} onUpdateState={noop} />);
    expect(c).toBeTruthy();
    expect(html).not.toContain('Ghi chú tác nghiệp');
  });
});

describe('DEC-120: Góp ý', () => {
  const demo = createDemoState();
  const opts = [
    { id: 'TON_VO', label: 'Văn phòng → Tồn vỏ', group: 'Văn phòng', item: 'Tồn vỏ' },
    { id: 'VP_PHIEU_THU', label: 'Văn phòng → Phiếu thu', group: 'Văn phòng', item: 'Phiếu thu' },
  ];
  it('nút Góp ý + form chọn menu / nội dung + Góp ý của tôi', () => {
    expect(renderToString(<FeedbackButton state={demo} onUpdateState={noop} menuOptions={opts} />)).toContain('data-testid="feedback-button"');
    const html = renderToString(<FeedbackPanel state={as(demo, 'usr-forklift')} onUpdateState={noop} menuOptions={opts} />).replace(/<!-- -->/g, '');
    expect(html).toContain('aria-label="Menu góp ý"');
    expect(html).toContain('>Khác<');
    // DEC-123: chọn menu chính trước — chưa hiện ô Tính năng / Nội dung
    expect(html).toContain('>Văn phòng<');
    expect(html).not.toContain('aria-label="Tính năng góp ý"');
    expect(html).not.toContain('3. Nội dung góp ý');
    expect(html).toContain('Góp ý của tôi (1)');
  });
  it('Báo cáo → Góp ý có bộ lọc + Tra cứu', () => {
    const html = renderToString(<FeedbackReport state={as(demo, 'usr-admin')} onUpdateState={noop} menuOptions={opts} />);
    expect(html).toContain('Báo cáo Góp ý');
    expect(html).toContain('aria-label="Lọc nhanh thời gian"');
  });
});
