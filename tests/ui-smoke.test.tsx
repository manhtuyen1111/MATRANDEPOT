import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { createInitialState, DepotState } from '../src/services/depotStore';
import { App } from '../src/app/App';
import { FeedbackButton, FeedbackPanel } from '../src/components/FeedbackButton';
import { FeedbackReport } from '../src/features/reports/FeedbackReport';
import { InvoicePortal } from '../src/features/invoice/InvoicePortal';
import { demoBackend } from '../src/features/invoice/portalBackend';
import { InvoicePanel } from '../src/features/receipts/ReceiptsWorkspace';
import { createDemoState } from '../src/services/demoData';
import { YardFeature } from '../src/features/yard/YardFeature';
import { OfficeCapVoWorkspace, OfficeHaVoWorkspace } from '../src/features/office/OfficeWorkspaces';
import { ExportPicker, ListDetail, OfficeVesselWorkspace } from '../src/features/vessel/OfficeVesselWorkspace';
import { VesselFieldMobile } from '../src/features/vessel/VesselFieldMobile';
import { createVesselList, inspectVesselImportItem } from '../src/services/vessel';
import { FieldQueueWorkspaces, FieldQueueMode, getFieldQueue, QueueListRow } from '../src/features/field-queues/FieldQueueWorkspaces';
import { YardShiftWorkspace } from '../src/features/forklift/YardShiftWorkspace';
import { InvoiceGroupDetail, MasterUsagePanel, ReceiptsWorkspace } from '../src/features/receipts/ReceiptsWorkspace';
import { ReportsWorkspace } from '../src/features/reports/ReportsWorkspace';
import { MasterCatalogWorkspace } from '../src/features/catalog/MasterCatalogWorkspace';
import { MasterDossierModal } from '../src/components/MasterDossierModal';
import { InspectorHaVoMobile } from '../src/features/inspector/InspectorHaVoMobile';
import { RepairTeamCatalog } from '../src/features/catalog/RepairTeamCatalog';
import { UserRoleCatalog } from '../src/features/catalog/UserRoleCatalog';
import { DocumentReturnWorkspace } from '../src/features/office/DocumentReturnWorkspace';
import { CustomerSlipK80, EeirK80Sheet, K80TicketModal, slipPrintCount, VesselEeirPrintSheet } from '../src/components/K80TicketModal';
import { documentPackOf } from '../src/services/driverRoute';
import { CompanyCatalog } from '../src/features/catalog/CompanyCatalog';
import { ReceiptPrintSheet } from '../src/components/ReceiptPrint';
import { DetailDrawer, FeeLinesEditor, Pager } from '../src/components/shared';
import { confirmGateInPaymentAndComplete, recordGateInFieldStep, toggleContainerHold, verifyGateInOfficeAndCreatePayment } from '../src/services/depotOperations';

// Smoke test: mỗi màn hình render được với dữ liệu mẫu, không ném lỗi khi render
const noop = () => {};
const base = createInitialState();
const as = (s: DepotState, id: string) => ({ ...s, currentUser: s.staffUsers.find((u) => u.id === id)! });

describe('UI smoke — render các màn hình với dữ liệu mẫu', () => {
  it('App khung menu', () => {
    // DEC-106: App mở với dữ liệu sạch; smoke này cần dữ liệu mẫu → nạp qua localStorage giả
    const store: Record<string, string> = { matran_depot_erp_state_v13: JSON.stringify(base) };
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
    // DEC-132: mỗi cont 1 dòng (không xuống dòng), Date in ngày + giờ cùng 1 dòng
    expect(html).toMatch(/cursor-pointer whitespace-nowrap[^"]*" data-testid="yard-row"/);
    expect(html).not.toContain('block text-[10px] text-ink-muted');
    // DEC-129: AGE ngay sau Hãng tàu; Date in vẫn trước Trạng thái
    expect(html).toMatch(/Hãng tàu<\/th><th[^>]*>AGE<\/th><th[^>]*>Date in<\/th><th[^>]*>Trạng thái/);
    expect(html).toMatch(/>Mã phiếu thu<\/th><th[^>]*>Tiến độ<\/th>/);
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
    expect(html).toContain('class="font-mono text-navy-700 hover:underline" title="Mở phiếu thu"');
    // DEC-118: mã hồ sơ ở Tồn vỏ cũng là link (cùng kiểu)
    expect(html).toMatch(/<button type="button" class="font-mono text-navy-700 hover:underline">HV-/);
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
      gateInType: 'CUSTOMER_RETURN', shippingLineCode: 'MAERSK', doorPhotoUrl: 'data:x', conditionClass: 'AV', stuffingClass: 'E',
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
    expect(withLink).toContain("font-mono text-navy-700 hover:underline");
    expect(withLink).toContain(`Phiếu thu ${ptNo}`);
    const noLink = renderToString(<MasterDossierModal masterDossierCode={gi.masterDossierCode} state={s} onClose={noop} />);
    expect(noLink).toContain(ptNo);
    expect(noLink).not.toContain("font-mono text-navy-700 hover:underline");
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
      gateInType: 'CUSTOMER_RETURN', shippingLineCode: 'MAERSK', doorPhotoUrl: 'data:x', conditionClass: 'AV', stuffingClass: 'E', cleaningItems: ['KHÔNG VỆ SINH'], manufactureYear: 2019,
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
    expect(vpNt).toContain('0/1'); // DEC-165: tiến độ 1 dòng trong bảng
    // DEC-165: bảng DANH SÁCH NHẬP TÀU đủ cột + trạng thái
    for (const col of ['Hãng tàu', 'Số lượng', 'Thời gian bắt đầu', 'Tiến độ', 'Trạng thái', 'Người tạo', 'Người duyệt']) expect(vpNt).toContain(col);
    expect(vpNt).toContain('Danh sách NHẬP TÀU');
    expect(vpNt).toContain('ĐANG THỰC HIỆN');
    expect(vpNt).not.toContain('Đã duyệt gần đây');
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

describe('DEC-161: Phiếu EEIR (K80) + Phiếu thu (K80); in hồ sơ container A4', () => {
  const strip = (h: string) => h.replace(/<!-- -->/g, '');
  it('Phiếu K80 = PHIẾU EEIR TÁC NGHIỆP (khổ k80-sheet); không còn EEIR A4 cho Hạ vỏ / Cấp vỏ', () => {
    const s = createInitialState();
    const t = s.k80Tickets[0];
    expect(t).toBeTruthy();
    const eeir = strip(renderToString(<EeirK80Sheet state={s} ticket={t} />));
    expect(eeir).toContain('PHIẾU EEIR TÁC NGHIỆP');
    expect(eeir).not.toContain('— PHIẾU EEIR TÁC NGHIỆP'); // không lặp tên depot ở tiêu đề
    expect(eeir).toContain(s.companyProfile.name); // đầu phiếu = thông tin depot như Phiếu thu (K80)
    expect(eeir).toMatch(/TÁC NGHIỆP: (HẠ|CẤP) VỎ/);
    expect(eeir).toContain('Văn phòng xác nhận'); // dưới cùng: xác nhận Văn phòng (QR đã lên góc phải trên)
    expect(eeir.indexOf('qr-image') < 0 || eeir.indexOf(`Mã QR ${t.qrCode}`) < eeir.indexOf('LỘ TRÌNH')).toBe(true);
    expect(eeir).toContain('k80-sheet');
    expect(eeir).toContain(t.containerNo);
    expect(eeir).toContain('LỘ TRÌNH');
    expect(eeir).not.toContain('print-sheet');
    const modal = strip(renderToString(<K80TicketModal ticket={t} state={s} onClose={noop} />));
    expect(modal).toContain('In phiếu EEIR (K80)');
  });
  it('Phiếu thu in khổ K80 (cùng khung EEIR K80), giữ đủ thông tin: công ty, Số, tác nghiệp, chữ ký', () => {
    const s = createDemoState();
    const r = s.paymentReceipts[0];
    expect(r).toBeTruthy();
    const html = strip(renderToString(<ReceiptPrintSheet state={s} receipt={r} printNo={1} />));
    expect(html).toContain('k80-sheet');
    expect(html).not.toContain('print-sheet');
    expect(html).toContain(s.companyProfile.name);
    expect(html).toContain(`Số: ${r.receiptNo}`);
    expect(html).toContain('Người thu tiền');
    expect(html).toContain('In lúc');
  });
  it('Hồ sơ: PHIẾU EEIR HẠ VỎ / CẤP VỎ + PHIẾU TRẢ KHÁCH HÀNG (DEC-162), không còn nút Xem phiếu EEIR (K80), HỒ SƠ CONTAINER (A4)', () => {
    const s = createInitialState();
    const t = s.k80Tickets[0];
    const dossier = strip(renderToString(<MasterDossierModal masterDossierCode={t.masterDossierCode} state={s} onClose={noop} onUpdateState={noop} onOpenK80Ticket={noop} />));
    expect(dossier).toMatch(/PHIẾU EEIR (HẠ|CẤP) VỎ/);
    expect(dossier).toContain('PHIẾU TRẢ KHÁCH HÀNG');
    expect(dossier).not.toContain('Xem / in phiếu EEIR (K80)');
    expect(dossier).toContain('HỒ SƠ CONTAINER');
    expect(dossier).not.toContain('EEIR — PHIẾU GIAO NHẬN CONTAINER');
  });
});

describe('DEC-162: PHIẾU TRẢ KHÁCH HÀNG — gộp EEIR + phiếu thu, đếm in theo phiếu thu', () => {
  const strip = (h: string) => h.replace(/<!-- -->/g, '');
  it('Có phiếu thu: đầu chỉ Số / TÁC NGHIỆP + QR, bỏ LỘ TRÌNH, khối PHIẾU THU (Khách hàng, Số phiếu thu, xuất hóa đơn); BẢN IN LẠI dưới khối phiếu thu', () => {
    const demo = createDemoState();
    const r = demo.paymentReceipts.find((x) => x.invoiceSecret && x.dossierCode)!;
    expect(r).toBeTruthy();
    const t = demo.k80Tickets.find((k) => (k.outDossierCode || k.masterDossierCode) === r.dossierCode)!;
    expect(t).toBeTruthy();
    const pack = documentPackOf(demo, t);
    expect(pack.receipts.length).toBeGreaterThan(0);
    const html = strip(renderToString(<CustomerSlipK80 state={demo} ticket={t} receipts={pack.receipts} printNo={1} />));
    expect(html).not.toContain('MATRAN EEIR - PHIẾU THU');
    expect(html).toContain(`Số: ${t.outDossierCode || t.masterDossierCode}`);
    expect(html).toMatch(/TÁC NGHIỆP: (HẠ|CẤP) VỎ/);
    expect(html).toContain('k80-sheet');
    expect(html).toContain(`Mã QR ${t.qrCode}`); // QR tác nghiệp ở đầu phiếu như phiếu tác nghiệp
    expect(html).toContain(t.containerNo);
    expect(html).not.toContain('LỘ TRÌNH');
    expect(html).toContain('>PHIẾU THU<');
    expect(html).not.toContain('THÔNG TIN THANH TOÁN');
    expect(html).toContain('Khách hàng');
    expect(html).not.toContain('Bên thanh toán');
    expect(html).toContain(pack.receipts[0].receiptNo);
    expect(html).toContain('data-testid="invoice-secret"');
    expect(html).not.toContain('BẢN IN LẠI');
    const re = strip(renderToString(<CustomerSlipK80 state={demo} ticket={t} receipts={pack.receipts} printNo={2} />));
    expect(re).toContain('BẢN IN LẠI — LẦN 2');
    expect(re.indexOf('BẢN IN LẠI')).toBeGreaterThan(re.indexOf('>PHIẾU THU<')); // nhãn in lại nằm dưới khối phiếu thu
    // Đếm in = bộ đếm phiếu thu (lớn nhất của các phiếu thu kèm theo)
    expect(slipPrintCount([])).toBe(0);
    expect(slipPrintCount([{ ...pack.receipts[0], printLog: [{ at: 'x', by: 'a' }, { at: 'y', by: 'b' }] }])).toBe(2);
  });
  it('Không có phiếu thu (TTS / trừ trả trước): vẫn in được, ghi hình thức thanh toán, không có khối xuất hóa đơn', () => {
    const s = createInitialState();
    const t = s.k80Tickets[0];
    const html = strip(renderToString(<CustomerSlipK80 state={s} ticket={t} receipts={[]} />));
    expect(html).toContain('>PHIẾU THU<');
    expect(html).toContain('không phát hành phiếu thu lượt này');
    expect(html).not.toContain('data-testid="invoice-secret"');
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
    expect(strip(renderToString(<MasterDossierModal masterDossierCode={ntItem.dossierCode!} state={s} onClose={noop} />))).toContain('EEIR NHẬP TÀU');
    const ntSheet = strip(renderToString(<VesselEeirPrintSheet state={s} list={nt} item={ntItem} />));
    // DEC-163: cùng mẫu phiếu tác nghiệp Hạ vỏ / Cấp vỏ — mã QR + LỘ TRÌNH
    expect(ntSheet).toContain('PHIẾU EEIR TÁC NGHIỆP');
    expect(ntSheet).toContain(`Mã QR QR-${ntItem.dossierCode}`);
    expect(ntSheet).toContain('LỘ TRÌNH — QUÉT MÃ TẠI TỪNG BỘ PHẬN');
    expect(ntSheet).toContain('GIÁM ĐỊNH');
    expect(ntSheet).toContain('Duyệt nhập tàu');
    expect(ntSheet).toContain('Văn phòng xác nhận');
    expect(ntSheet).toContain('k80-sheet'); // DEC-161: EEIR tàu khổ K80
    // Vệ sinh / Xe nâng: cont Nhập tàu hiện cả SỐ XE (danh sách chờ + khung cont vừa quét)
    const { OperationBadge } = await import('../src/features/vessel/VesselShared');
    const ntCont = s.containers.find((c) => c.masterDossierCode === ntItem.dossierCode)!;
    const row = strip(renderToString(<QueueListRow state={s} container={ntCont} onClick={noop} />));
    expect(row).toContain('Tàu TÀU EEIR • Xe 15C-9');
    expect(strip(renderToString(<OperationBadge state={s} container={ntCont} large />))).toContain('Xe 15C-9');
    expect(ntSheet).toContain(`Số: ${ntItem.dossierCode}`);
    expect(ntSheet).toContain('TÁC NGHIỆP: NHẬP TÀU');
    expect(ntSheet).toContain('TÀU EEIR');
    expect(ntSheet).toContain('GIÁM ĐỊNH');
    expect(ntSheet).toContain('Móp vách');
    expect(ntSheet).toContain('Không thu phí');

    // Xuất tàu: cont đang tồn bãi → lập danh sách → xuất → EEIR XUẤT TÀU
    const yardId = s.containers.find((c) => c.status === 'IN_YARD')!.id;
    const xt = createVesselList(as(s, 'usr-office'), { mode: 'XUAT_TAU', vesselName: 'Tàu Ra', plannedAt: new Date().toISOString(), truckNos: ['15C-7'], exportContainerIds: [yardId] });
    s = executeVesselExport(as(xt.state, 'usr-forklift'), { listId: xt.listId, itemId: xt.state.vesselLists[0].items[0].id, truckNo: '15C-7' });
    const xtList = s.vesselLists.find((l) => l.id === xt.listId)!;
    const xtSheet = strip(renderToString(<VesselEeirPrintSheet state={s} list={xtList} item={xtList.items[0]} />));
    expect(xtSheet).toContain('TÁC NGHIỆP: XUẤT TÀU');
    expect(xtSheet).toContain('>OUT<');
    expect(xtSheet).toContain(`Mã QR QR-${xtList.items[0].dossierCode}`);
    expect(xtSheet).toContain('Quét mã • xuất cont lên xe');
    expect(xtSheet).toContain('15C-7');
    expect(strip(renderToString(<MasterDossierModal masterDossierCode={xtList.items[0].dossierCode!} state={s} onClose={noop} />))).toContain('EEIR XUẤT TÀU');
  });
});

describe('UI-02: form Giám định dùng chung (Hạ vỏ / Nhập tàu)', () => {
  it('progressive: chỉ hiện mục 1 khi trống, đủ mục trước mới hiện mục sau; không progressive hiện cả 4', async () => {
    const m = await import('../src/components/InspectionFields');
    const { InspectionFields, EMPTY_INSPECTION, isInspectionComplete, inspectionRemarks } = m;
    const MKE = ['M', 'K', 'E'];
    const empty = renderToString(<InspectionFields stuffingOptions={MKE} progressive value={EMPTY_INSPECTION} onChange={noop} />);
    expect(empty).toContain('1. TRẠNG THÁI');
    expect(empty).not.toContain('2. PHÂN LOẠI ĐÓNG HÀNG');
    const step2 = renderToString(<InspectionFields stuffingOptions={MKE} progressive value={{ ...EMPTY_INSPECTION, condition: 'AV' }} onChange={noop} />);
    expect(step2).toContain('2. PHÂN LOẠI ĐÓNG HÀNG');
    expect(step2).not.toContain('3. TÌNH TRẠNG VỆ SINH');
    const damageNoRemark = renderToString(<InspectionFields stuffingOptions={MKE} progressive value={{ ...EMPTY_INSPECTION, condition: 'DAMAGE' }} onChange={noop} />);
    expect(damageNoRemark).not.toContain('2. PHÂN LOẠI ĐÓNG HÀNG');
    const all = renderToString(<InspectionFields stuffingOptions={MKE} value={EMPTY_INSPECTION} onChange={noop} />);
    expect(all).toContain('4. AGE');
    const full = { condition: 'DAMAGE' as const, damage: ['Móp vách'], damageNote: 'Thủng sàn, ', stuffing: 'E' as const, cleaning: ['WW - RỬA NƯỚC' as const], year: '2018' };
    expect(isInspectionComplete(full, MKE)).toBe(true);
    // DEC-166: hãng không dùng phân loại → không hiện mục 2, không cần đóng hàng; hãng dùng → mã phải đúng bộ của hãng
    const noLine = renderToString(<InspectionFields stuffingOptions={[]} progressive value={{ ...EMPTY_INSPECTION, condition: 'AV' }} onChange={noop} />);
    expect(noLine).not.toContain('2. PHÂN LOẠI ĐÓNG HÀNG');
    expect(noLine).toContain('3. TÌNH TRẠNG VỆ SINH');
    expect(isInspectionComplete({ ...full, stuffing: '' }, [])).toBe(true);
    expect(isInspectionComplete({ ...full, stuffing: '' }, MKE)).toBe(false);
    expect(isInspectionComplete({ ...full, stuffing: 'X' }, MKE)).toBe(false);
    expect(isInspectionComplete({ ...full, year: '18' }, MKE)).toBe(false);
    expect(isInspectionComplete({ ...full, damage: [], damageNote: '' }, MKE)).toBe(false);
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
    // DEC-136: nút Block hiện icon + tên bỏ tiền tố BLOCK-
    for (const b of base.yardBlocks) expect(empty).toContain(`</svg>${b.blockCode.replace(/^BLOCK-/, '')}</span></button>`);
    expect(empty).not.toContain('Chọn Bay');
    const bay = renderToString(<SlotPicker state={base} value={{ blockCode: 'BLOCK-A', bay: '', row: '', tier: '' }} onChange={noop} />).replace(/<!-- -->/g, '');
    expect(bay).toContain('Chọn Bay * (01 → 20)');
    expect(bay).not.toContain('Chọn Block *');
    expect(bay).toMatch(/data-testid="slot-summary"[\s\S]*<\/svg>A<\/span><\/button>/);
    const row = renderToString(<SlotPicker state={base} value={{ blockCode: 'BLOCK-A', bay: '05', row: '', tier: '' }} onChange={noop} />).replace(/<!-- -->/g, '');
    expect(row).toContain('>05</button>');
    expect(row).toContain('Chọn Row *');
    expect(row).not.toContain('Chọn Tier');
    const done = renderToString(<SlotPicker state={base} value={{ blockCode: 'BLOCK-A', bay: '05', row: '02', tier: '01' }} onChange={noop} />).replace(/<!-- -->/g, '');
    expect(done).toContain('✓ Đủ vị trí');
    expect(done).not.toContain('Chọn Tier');
    const rack = renderToString(<SlotPicker state={base} value={{ blockCode: '', bay: '', row: '', tier: '' }} onChange={noop} onlyBlocks={['BLOCK-DAMAGE']} />);
    expect(rack).toContain('</svg>DAMAGE</span></button>');
    expect(rack).not.toContain('</svg>A</span></button>');
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
    const ch = Math.max(4, ...base.yardBlocks.map((b) => b.blockCode.replace(/^BLOCK-/, '').length)) + 2; // DEC-136: icon thay chữ BLOCK-
    expect(html.split(`style="width:${ch}ch"`).length - 1).toBe(rows);
    expect(html).toMatch(/<\/svg>A<\/span><span class="truncate"> \/ 04-02-01<\/span>/);
    expect(html).toMatch(/<\/svg>B<\/span><span class="truncate"><\/span>/);
    expect(html).not.toContain('>BLOCK-A<');
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
    const html = renderToString(<InvoicePortal backend={demoBackend()} />);
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
    expect(html).toContain('Quét để mở'); // QR nhỏ link trang xuất hóa đơn
    expect(html).toContain(r.invoiceSecret!);
    expect(html).toContain('#/hoa-don');
  });
  it('Phiếu thu có cột / lọc Hóa đơn; Kế toán thấy nút Đã xuất hóa đơn khi khách đã yêu cầu', async () => {
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
    // DEC-130: phiếu trả trước → các yêu cầu theo lượt, Kế toán xuất từng yêu cầu
    const { prepaidInvoiceView } = await import('../src/services/invoice');
    const topup = demo.paymentReceipts.find((x) => x.purpose === 'PREPAID_TOPUP' && (x.invoiceGroups || []).length)!;
    const pp = renderToString(<InvoicePanel receipt={topup} canIssue onIssue={noop} prepaid={prepaidInvoiceView(demo, topup)} />).replace(/<!-- -->/g, '');
    // DEC-133: khối Xuất hóa đơn chỉ tóm tắt; trạng thái + yêu cầu nằm ở cột HÓA ĐƠN từng lượt
    expect(pp).toContain('data-testid="prepaid-invoice-summary"');
    const view = prepaidInvoiceView(demo, topup)!;
    const usage = renderToString(<MasterUsagePanel state={demo} code={topup.masterReceiptCode!} invoice={{ view, canIssue: true, onIssue: noop }} />).replace(/<!-- -->/g, '');
    expect(usage).toContain('>Hóa đơn<');
    expect((usage.match(/data-testid="lot-invoice"/g) || []).length).toBe(view.lots.length);
    const g = view.groups.find((x) => x.status === 'YEU_CAU_XHD') || view.groups[0];
    const detail = renderToString(<InvoiceGroupDetail view={view} groupId={g.id} canIssue onIssue={noop} />).replace(/<!-- -->/g, '');
    expect(detail).toContain('Yêu cầu 1');
    expect(detail).toContain(g.taxCode);
    if (g.status === 'YEU_CAU_XHD') expect(detail).toContain('Đã xuất hóa đơn</button>');
    expect(renderToString(<InvoiceGroupDetail view={view} canIssue onIssue={noop} />)).toContain('chưa gửi yêu cầu');
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

describe('DEC-129: Tồn vỏ — thứ tự cột màn hình = thứ tự cột Excel', () => {
  it('mọi cột hiển thị trên màn đều có trong Excel, đúng thứ tự', async () => {
    const { yardStockSheet } = await import('../src/services/reports');
    const html = renderToString(<YardFeature state={base} onUpdateState={noop} />).replace(/<!-- -->/g, '');
    const thead = html.slice(html.indexOf('<thead'), html.indexOf('</thead>'));
    const screen = [...thead.matchAll(/<th[^>]*>([^<]+)<\/th>/g)].map((m) => m[1].trim().toUpperCase()).filter(Boolean);
    const excel = yardStockSheet(base.containers, base).columns;
    const positions = screen.map((label) => excel.findIndex((col) => col === label || col.startsWith(label + ' ')));
    screen.forEach((label, i) => expect(positions[i], `Excel thiếu cột "${label}"`).toBeGreaterThan(-1));
    for (let i = 1; i < positions.length; i++) expect(positions[i], `Sai thứ tự cột "${screen[i]}"`).toBeGreaterThan(positions[i - 1]);
  });
});

// DEC-134: bảng / danh sách — mỗi thông tin chỉ 1 dòng (không xuống dòng, cuộn ngang khi rộng)
describe('DEC-135: giới hạn chữ mỗi ô', () => {
  it('clipText cắt đúng N ký tự + "…"; CellText có title khi bị cắt', async () => {
    const { clipText, CellText, CELL_MAX } = await import('../src/components/shared');
    expect(clipText('ABC', 5)).toBe('ABC');
    const long = 'X'.repeat(60);
    expect(clipText(long, CELL_MAX.LONG)).toHaveLength(CELL_MAX.LONG);
    expect(clipText(long, CELL_MAX.LONG).endsWith('…')).toBe(true);
    const html = renderToString(<CellText text={long} max={CELL_MAX.LONG} />);
    expect(html).toContain(`title="${long}"`);
    expect(renderToString(<CellText text="Ngắn" />)).not.toContain('title=');
    expect(renderToString(<CellText text="" />)).toBe('-');
  });
});

describe('DEC-134: bảng 1 dòng', () => {
  const demo = createDemoState();
  it('Phiếu thu + Báo cáo Hạ vỏ / Cấp vỏ / Nhập tàu / Xuất tàu / Sửa chữa: bảng whitespace-nowrap', () => {
    const screens = [
      <ReceiptsWorkspace state={as(demo, 'usr-office')} onUpdateState={noop} />,
      ...(['BC_HA_VO', 'BC_CAP_VO', 'BC_NHAP_TAU', 'BC_XUAT_TAU', 'BC_SUA_CHUA'] as const).map((s) => <ReportsWorkspace state={demo} section={s} onOpenDossier={noop} />),
    ];
    for (const el of screens) {
      const html = renderToString(el);
      const tables = html.match(/<table[^>]*>/g) || [];
      for (const tb of tables) expect(tb).toContain('whitespace-nowrap');
    }
  });
});

// DEC-136: vị trí hiển thị icon định vị thay chữ "BLOCK-" (mã lưu vẫn BLOCK-…)
describe('DEC-136: vị trí dùng icon thay chữ BLOCK', () => {
  it('LocationText / blockLabel bỏ tiền tố BLOCK-, có icon; Tồn vỏ không hiện chữ BLOCK- ở cột vị trí', async () => {
    const { LocationText, blockLabel } = await import('../src/components/shared');
    expect(blockLabel('BLOCK-A')).toBe('A');
    const html = renderToString(<LocationText loc={{ currentBlock: 'BLOCK-A', currentBay: '17', currentRow: '02', currentTier: '02' }} />).replace(/<!-- -->/g, '');
    expect(html).toContain('data-testid="block-icon"');
    expect(html).toContain('>A / 17-02-02<');
    expect(html).toContain('title="BLOCK-A / 17-02-02"');
    expect(renderToString(<LocationText loc={{ currentBlock: null, currentBay: null, currentRow: null, currentTier: null }} />)).not.toContain('block-icon');
    const demo = createDemoState();
    const yard = renderToString(<YardFeature state={demo} onUpdateState={noop} />);
    expect(yard).toContain('data-testid="block-icon"');
  });
});

// DEC-137: Cấp vỏ — "Container được chọn" chia ô rõ ràng (chỉ đọc, tự điền khi chọn ở danh sách)
describe('DEC-137: Cấp vỏ — container được chọn chia ô', () => {
  it('có đủ 6 ô: Số container, Size/Type, Hãng tàu, Trạng thái, Đóng hàng, Vị trí', () => {
    const html = renderToString(<OfficeCapVoWorkspace state={as(base, 'usr-office')} onUpdateState={noop} onOpenK80Ticket={noop} />).replace(/<!-- -->/g, '');
    const i = html.indexOf('data-testid="selected-container"');
    expect(i).toBeGreaterThan(0);
    const box = html.slice(i, i + 4000);
    for (const l of ['Số container', 'Size/Type', 'Hãng tàu', 'Trạng thái', 'Đóng hàng', 'Vị trí']) expect(box).toContain(`>${l}</span>`);
    expect(box).toContain('bấm chọn ở danh sách bên trái');
  });
});

// DEC-139: cố định cột đầu khi cuộn ngang — Mã hồ sơ | Số container | Size | Type | Hãng tàu (tàu: Tên tàu + 5 cột); Excel cùng thứ tự
describe('DEC-139 / DEC-141: thứ tự 5 cột đầu (không cố định cột)', () => {
  const demo = createDemoState();
  const head = (html: string) => (html.match(/<th[^>]*>[\s\S]*?<\/th>/g) || []).map((th) => ({ sticky: /class="[^"]*sticky/.test(th), label: th.replace(/<[^>]+>/g, '').trim() }));
  const STD = ['Mã hồ sơ', 'Số container', 'Size', 'Type', 'Hãng tàu'];
  it('Tồn vỏ: 5 cột đầu đúng thứ tự; không cố định cột (DEC-141)', () => {
    const cols = head(renderToString(<YardFeature state={as(demo, 'usr-office')} onUpdateState={noop} />).replace(/<!-- -->/g, '')).filter((c) => c.label);
    expect(cols.slice(0, 5).map((c) => c.label)).toEqual(STD);
    expect(cols.some((c) => c.sticky)).toBe(false);
  });
  it('Excel cùng thứ tự 5 / 6 cột đầu', async () => {
    const r = await import('../src/services/reports');
    const STDX = ['SỐ CONTAINER', 'SIZE', 'TYPE', 'HÃNG TÀU'];
    expect(r.gateInSheet('HẠ VỎ', [], demo).columns.slice(0, 5)).toEqual(['MÃ HỒ SƠ', ...STDX]);
    expect(r.gateOutSheet('CẤP VỎ', demo, []).columns.slice(0, 5)).toEqual(['MÃ HỒ SƠ CẤP', ...STDX]);
    expect(r.repairReportSheet([]).columns.slice(0, 5)).toEqual(['MÃ HỒ SƠ', ...STDX]);
    expect(r.yardStockSheet([], demo).columns.slice(0, 5)).toEqual(['MÃ HỒ SƠ', ...STDX]);
    expect(r.vesselReportSheet('NHAP_TAU', []).columns.slice(0, 6)).toEqual(['TÊN TÀU', 'MÃ HỒ SƠ', ...STDX]);
    expect(r.vesselReportSheet('XUAT_TAU', []).columns.slice(0, 6)).toEqual(['TÊN TÀU', 'MÃ HỒ SƠ', ...STDX]);
  });
});

// DEC-140: Báo cáo Nhập / Xuất tàu — Trạng thái và Phân loại là 2 cột riêng (Excel cùng tên)
describe('DEC-140: báo cáo tàu tách Trạng thái / Phân loại', () => {
  it('Excel có cột TRẠNG THÁI và PHÂN LOẠI riêng', async () => {
    const r = await import('../src/services/reports');
    for (const m of ['NHAP_TAU', 'XUAT_TAU'] as const) {
      const cols = r.vesselReportSheet(m, []).columns;
      expect(cols.indexOf('PHÂN LOẠI')).toBe(cols.indexOf('TRẠNG THÁI') + 1);
      expect(cols).not.toContain('ĐÓNG HÀNG');
    }
  });
});

// DEC-142: Báo giá → Chờ báo giá — mỗi cont 1 dòng như Tồn vỏ
describe('DEC-142: Chờ báo giá 1 dòng', () => {
  it('bảng whitespace-nowrap, Date in ngày + giờ cùng dòng', () => {
    const demo = createDemoState();
    const html = renderToString(<FieldQueueWorkspaces mode="BG_CHO_BAO_GIA" state={as(demo, 'usr-quotation')} onUpdateState={noop} />).replace(/<!-- -->/g, '');
    expect(html).toMatch(/<table class="[^"]*whitespace-nowrap/);
    expect(html).toContain('data-testid="quote-row"');
    expect(html).not.toContain('block text-[10px] text-ink-muted');
  });
});

describe('DEC-145: design system v2 (navy + accent, Be Vietnam Pro)', () => {
  it('thành phần dùng chung lấy màu theo token, nhãn tác nghiệp theo op-*', async () => {
    const shared = await import('../src/components/shared');
    expect(shared.primaryBtn).toContain('bg-navy-900');
    expect(shared.primaryBtn).not.toContain('bg-blue-600');
    expect(shared.secondaryBtn).toContain('border-line-strong');
    expect(shared.labelCls).not.toContain('uppercase');
    expect(shared.linkCls).toBe('font-mono text-navy-700 hover:underline');
  });
});

describe('DEC-145: code giao diện chỉ dùng token design system (docs/DESIGN_SYSTEM.md)', () => {
  it('không còn class màu cũ bị cấm trong src/', () => {
    const files = import.meta.glob('../src/**/*.tsx', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    expect(Object.keys(files).length).toBeGreaterThan(10);
    const banned = /(^|[\s"'`:])(bg-blue-600|text-blue-700|bg-slate-900|text-slate-(900|700|500)|border-slate-(200|300)|bg-slate-50)(?=$|[\s"'`])/m;
    const offenders = Object.entries(files).filter(([, src]) => banned.test(src)).map(([f]) => f);
    expect(offenders).toEqual([]);
  });
});

describe('DEC-146: Văn phòng → Nhập / Xuất tàu — bảng chi tiết tàu mỗi cột 1 thông tin, 1 dòng', () => {
  it('tách Size | Type | Hãng tàu | Trạng thái | Phân loại | Người thực hiện | Thời gian; không còn cột gộp', () => {
    const office = as(createInitialState(), 'usr-office');
    const nt = createVesselList(office, {
      mode: 'NHAP_TAU', vesselName: 'Ever Gentle', plannedAt: new Date().toISOString(), truckNos: ['15C-111.11'], shippingLineCode: 'MAERSK',
      importItems: [{ containerNo: 'TCLU1234567', size: '40', type: 'HC' }],
    }).state;
    const yardId = nt.containers.find((c) => c.status === 'IN_YARD')!.id;
    const both = createVesselList(nt, { mode: 'XUAT_TAU', vesselName: 'Wan Hai', plannedAt: new Date().toISOString(), truckNos: ['15C-333.33'], exportContainerIds: [yardId] }).state;
    for (const mode of ['NHAP_TAU', 'XUAT_TAU'] as const) {
      const list = both.vesselLists.find((l) => l.mode === mode)!;
      const html = renderToString(<ListDetail list={list} mode={mode} state={both} canManage run={() => true} onDeleted={noop} />).replace(/<!-- -->/g, '');
      expect(html).toMatch(/<table class="[^"]*whitespace-nowrap[^"]*" data-testid="vessel-detail-table"/);
      expect(html).toMatch(/Mã hồ sơ<\/th><th[^>]*>Số container<\/th><th[^>]*>Size<\/th><th[^>]*>Type<\/th><th[^>]*>Hãng tàu<\/th><th[^>]*>Trạng thái<\/th><th[^>]*>Phân loại<\/th>/);
      expect(html).toContain('>Người thực hiện</th>');
      expect(html).toContain('>Thời gian</th>');
      for (const merged of ['Size/Type', 'Trạng thái • Phân loại', 'Người / giờ', '>Giám định</th>']) expect(html).not.toContain(merged);
    }
    expect(renderToString(<ListDetail list={both.vesselLists.find((l) => l.mode === 'NHAP_TAU')!} mode="NHAP_TAU" state={both} canManage run={() => true} onDeleted={noop} />)).toContain('MAERSK');
  });
});

describe('DEC-147: Giám định – Hạ vỏ có tab Chờ giám định trên kệ', () => {
  it('dữ liệu Demo có cont W-SURVEY → hiện tab với số đếm', () => {
    const s = as(createDemoState(), 'usr-inspector');
    const html = renderToString(<InspectorHaVoMobile state={s} onUpdateState={noop} />).replace(/<!-- -->/g, '');
    expect(html).toContain('data-testid="inspector-tab-TREN_KE"');
    expect(html).toMatch(/Chờ giám định trên kệ \([1-9]/);
    expect(html).toContain('max-w-lg');
  });
});

describe('DEC-155: màn đăng nhập (chế độ database)', () => {
  it('dựng được, không dùng màu cũ', async () => {
    const { LoginScreen } = await import('../src/features/auth/LoginScreen');
    const html = renderToString(<LoginScreen onSignIn={async () => {}} />);
    expect(html).toContain('data-testid="login-screen"');
    expect(html).toContain('bg-navy-900');
  });
});

describe('DEC-155: giao diện ghi dữ liệu chỉ qua services/api.ts', () => {
  it('màn hình / thành phần không import hàm ghi thẳng từ file nghiệp vụ gốc', async () => {
    const api = await import('../src/services/api');
    const writeNames = new Set(Object.keys(api));
    const files = import.meta.glob(['../src/features/**/*.tsx', '../src/components/**/*.tsx', '../src/app/**/*.tsx'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const bad: string[] = [];
    const re = /import\s*\{([^}]*)\}\s*from\s*['"][./]*services\/(depotOperations|payments|vessel|invoice|feedback|driverRoute)['"]/g;
    for (const [path, src] of Object.entries(files)) {
      for (const m of src.matchAll(re)) {
        m[1].split(',').map((x) => x.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0]).filter((n) => writeNames.has(n)).forEach((n) => bad.push(`${path}: ${n} (${m[2]})`));
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('DEC-164: bảng danh sách đồng bộ chiều cao dòng (mốc Tồn vỏ 40px)', () => {
  it('mọi <table> trong màn hình / thành phần có class "data-table" (trừ bảng không phải danh sách)', () => {
    // Bảng không phải danh sách: bảng phí trên phiếu in, bảng con trong hồ sơ / ô Chi phí / ô danh sách lệnh cấp
    const NOT_LIST = ['/components/ReceiptPrint.tsx', '/components/MasterDossierModal.tsx', '/components/shared.tsx', '/features/office/OfficeWorkspaces.tsx#mt-2'];
    const files = import.meta.glob(['../src/features/**/*.tsx', '../src/components/**/*.tsx'], { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
    const bad: string[] = [];
    for (const [path, src] of Object.entries(files)) {
      for (const m of src.matchAll(/<table className="([^"]*)"/g)) {
        if (m[1].includes('data-table')) continue;
        if (NOT_LIST.some((x) => { const [f, mark] = x.split('#'); return path.endsWith(f) && (!mark || m[1].includes(mark)); })) continue;
        bad.push(`${path}: <table className="${m[1]}">`);
      }
    }
    expect(bad).toEqual([]);
  });
});

describe('Danh mục Sửa chữa + kính lúp ảnh cửa cont', () => {
  it('Tổ sửa chữa: bảng mỗi tổ 1 dòng (DEC-134), bấm mở chi tiết — không còn khung từng tổ', () => {
    const html = renderToString(<RepairTeamCatalog state={{ ...createInitialState(), currentUser: createInitialState().staffUsers.find((u) => u.roles.includes('ADMIN'))! }} onUpdateState={() => {}} />);
    expect(html).toContain('whitespace-nowrap');
    expect(html).toMatch(/<tr[^>]*cursor-pointer[^>]*>.*TO-SC-01/);
    expect(html).not.toContain('Hoặc nhập họ tên nhân viên'); // phần gán nhân viên nằm trong cửa sổ chi tiết
  });

  it('PhotoZoom: ảnh nhỏ có kính lúp + bấm để phóng to', async () => {
    const { PhotoZoom } = await import('../src/components/shared');
    const html = renderToString(<PhotoZoom src="https://example.invalid/door.jpg" alt="Ảnh cửa container" className="h-28 w-44" />);
    expect(html).toContain('cursor-zoom-in');
    expect(html).toContain('bấm để phóng to');
    expect(html).toContain('https://example.invalid/door.jpg');
  });
});

describe('DEC-057: mã QR tác nghiệp THẬT + quét bằng camera', () => {
  it('Mã QR tạo được, thưa (phiên bản nhỏ → quét nhanh), đúng nội dung', async () => {
    const QR = await import('qrcode');
    const code = base.k80Tickets[0].qrCode;
    const qr = QR.create(code, { errorCorrectionLevel: 'M' });
    expect(qr.version).toBeLessThanOrEqual(3); // ≤ 29×29 ô — đọc trong tích tắc
    expect(qr.segments.map((s) => s.data.toString()).join('')).toBe(code);
    expect(await QR.toDataURL(code, { errorCorrectionLevel: 'M', margin: 1 })).toMatch(/^data:image\/png;base64,/);
  });

  it('Phiếu K80 dùng mã QR thật (không còn hình minh họa); màn hiện trường + Trả chứng từ có nút camera quét', () => {
    const ticket = base.k80Tickets[0];
    const k80 = renderToString(<K80TicketModal ticket={ticket} state={base} onClose={noop} />);
    expect(k80).toContain(`aria-label="Mã QR ${ticket.qrCode}"`);
    expect(k80).not.toContain('lucide-qr-code');
    const field = renderToString(<FieldQueueWorkspaces mode="XN_CHO_HA_VO" state={as(base, 'usr-forklift')} onUpdateState={noop} />);
    expect(field).toContain('Mở camera quét QR');
    expect(renderToString(<DocumentReturnWorkspace state={as(base, 'usr-office')} onUpdateState={noop} />)).toContain('Mở camera quét QR');
  });
});

describe('DEC-166: màn Danh mục → Phân loại đóng hàng', () => {
  it('Admin thấy form thêm + bảng theo hãng; Văn phòng chỉ xem; hãng không dùng được liệt kê', async () => {
    const { StuffingClassCatalog } = await import('../src/features/catalog/StuffingClassCatalog');
    const { setStuffingClassActive } = await import('../src/services/depotOperations');
    let s = as(createInitialState(), 'usr-admin');
    for (const code of ['M', 'K', 'E']) s = setStuffingClassActive(s, { shippingLineCode: 'ONE', code, isActive: false });
    const admin = renderToString(<StuffingClassCatalog state={s} onUpdateState={noop} />).replace(/<!-- -->/g, '');
    expect(admin).toContain('Thêm phân loại đóng hàng');
    expect(admin).toContain('data-table');
    expect(admin).toMatch(/không dùng phân loại.*ONE/);
    const office = renderToString(<StuffingClassCatalog state={as(s, 'usr-office')} onUpdateState={noop} />);
    expect(office).not.toContain('Thêm phân loại đóng hàng');
    expect(office).not.toContain('Ngừng dùng</button>');
  });
});
