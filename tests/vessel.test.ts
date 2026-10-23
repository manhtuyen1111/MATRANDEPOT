import { describe, expect, it } from 'vitest';
import { createInitialState, DepotState } from '../src/services/depotStore';
import { completeCleaningTask, releaseBlocker, toggleContainerHold, updateContainerLocation } from '../src/services/depotOperations';
import {
  approveVesselList,
  createVesselList,
  executeVesselExport,
  inspectVesselImportItem,
  removeVesselListItem,
} from '../src/services/vessel';
import { queryVesselReport, vesselReportSheet } from '../src/services/reports';

const as = (state: DepotState, userId: string): DepotState => ({
  ...state,
  currentUser: state.staffUsers.find((u) => u.id === userId)!,
});
const PLANNED = new Date().toISOString();

describe('DEC-069: NHẬP TÀU', () => {
  const base = { mode: 'NHAP_TAU' as const, vesselName: 'Ever Gentle', plannedAt: PLANNED, truckNos: ['15c-111.11', '15C-222.22'], shippingLineCode: 'MAERSK' };
  const items = [
    { containerNo: 'TCLU1234567', size: '40' as const, type: 'HC' as const },
    { containerNo: 'TCLU7654321', size: '20' as const, type: 'DC' as const },
  ];

  it('Lập danh sách: từ chối khi sai quyền, thiếu hãng tàu / số xe, cont đang tồn bãi, cont trùng', () => {
    const s0 = createInitialState();
    expect(() => createVesselList(as(s0, 'usr-inspector'), { ...base, importItems: items })).toThrow(/Không đủ quyền/);
    expect(() => createVesselList(as(s0, 'usr-office'), { ...base, shippingLineCode: '', importItems: items })).toThrow(/HÃNG TÀU/);
    expect(() => createVesselList(as(s0, 'usr-office'), { ...base, truckNos: [' '], importItems: items })).toThrow(/SỐ XE/);
    expect(() => createVesselList(as(s0, 'usr-office'), { ...base, importItems: [items[0], items[0]] })).toThrow(/trùng/);
    const inYard = s0.containers.find((c) => c.status === 'IN_YARD')!;
    expect(() =>
      createVesselList(as(s0, 'usr-office'), { ...base, importItems: [{ containerNo: inYard.containerNo, size: inYard.size, type: inYard.type }] })
    ).toThrow(/TỒN VỎ/);
    const first = createVesselList(as(s0, 'usr-office'), { ...base, importItems: items }).state;
    expect(() => createVesselList(first, { ...base, vesselName: 'Khác', importItems: [items[0]] })).toThrow(/đang chờ nhập/);
  });

  it('Giám định (NT-) → Vệ sinh → Xe nâng hạ → tồn bãi, cấp vỏ được ngay → Văn phòng duyệt', () => {
    let { state: s, listId } = createVesselList(as(createInitialState(), 'usr-office'), { ...base, importItems: items });
    const list = s.vesselLists[0];
    expect(list.vesselName).toBe('EVER GENTLE');
    expect(list.truckNos).toEqual(['15C-111.11', '15C-222.22']);
    const [i1, i2] = list.items;
    const inspect = {
      listId, itemId: i1.id, actualContainerNo: 'tclu1234567', truckNo: '15C-111.11', conditionClass: 'DAMAGE' as const,
      damageRemarks: ['Móp vách'], stuffingClass: 'E' as const, cleaningItems: ['WW'], manufactureYear: 2015,
    };
    expect(() => inspectVesselImportItem(as(s, 'usr-office'), inspect)).toThrow(/Không đủ quyền/);
    expect(() => inspectVesselImportItem(as(s, 'usr-inspector'), { ...inspect, actualContainerNo: 'TCLU9999999' })).toThrow(/không khớp/);
    expect(() => inspectVesselImportItem(as(s, 'usr-inspector'), { ...inspect, truckNo: '99X-000' })).toThrow(/SỐ XE/);
    expect(() => inspectVesselImportItem(as(s, 'usr-inspector'), { ...inspect, cleaningItems: [] })).toThrow(/VỆ SINH/);
    expect(() => inspectVesselImportItem(as(s, 'usr-inspector'), { ...inspect, manufactureYear: 15 })).toThrow(/AGE/);

    s = inspectVesselImportItem(as(s, 'usr-inspector'), inspect);
    const it1 = s.vesselLists[0].items[0];
    expect(it1.status).toBe('INSPECTED');
    expect(it1.dossierCode).toMatch(/^NT-\d{6}-001$/);
    const c1 = s.containers.find((c) => c.id === it1.containerId)!;
    expect(c1).toMatchObject({ masterDossierCode: it1.dossierCode, activeQrCode: `QR-${it1.dossierCode}`, status: 'WAITING_PLACEMENT', needsCleaning: true, needsQuotation: true, shippingLineCode: 'MAERSK', truckNo: '15C-111.11' });
    expect(s.workOrders.some((w) => w.masterDossierCode === it1.dossierCode && w.category === 'INSPECTION')).toBe(true);
    expect(s.k80Tickets.some((t) => t.masterDossierCode === it1.dossierCode)).toBe(false); // không K80
    expect(s.vouchers.some((x) => x.masterDossierCode === it1.dossierCode)).toBe(false);    // không thu phí
    expect(() => inspectVesselImportItem(as(s, 'usr-inspector'), inspect)).toThrow(/đã được Giám định/);
    expect(() => approveVesselList(as(s, 'usr-office'), { listId, mode: 'NHAP_TAU' })).toThrow(/Chưa NHẬP TÀU hết/);

    // Có vệ sinh: Xe nâng chỉ hạ được sau khi Vệ sinh xong (dùng chung hàm Hạ vỏ)
    expect(() => updateContainerLocation(as(s, 'usr-forklift'), { containerNo: 'TCLU1234567', blockCode: 'BLOCK-A', reason: '' })).toThrow(/vệ sinh/);
    s = completeCleaningTask(as(s, 'usr-cleaning'), { containerNo: 'TCLU1234567' });
    s = updateContainerLocation(as(s, 'usr-forklift'), { containerNo: 'TCLU1234567', blockCode: 'BLOCK-A', reason: '' });
    expect(s.vesselLists[0].items[0].status).toBe('DONE');
    expect(s.containers.find((c) => c.id === it1.containerId)!.status).toBe('IN_YARD');

    s = inspectVesselImportItem(as(s, 'usr-inspector'), {
      ...inspect, itemId: i2.id, actualContainerNo: 'TCLU7654321', truckNo: '15C-222.22', conditionClass: 'AV', damageRemarks: [], cleaningItems: ['KHÔNG VỆ SINH'],
    });
    const c2 = s.containers.find((c) => c.containerNo === 'TCLU7654321' && c.status !== 'GATED_OUT')!;
    expect(c2.needsCleaning).toBe(false);
    s = updateContainerLocation(as(s, 'usr-forklift'), { containerNo: 'TCLU7654321', blockCode: 'BLOCK-A', reason: '' });
    expect(releaseBlocker(s.containers.find((c) => c.id === c2.id)!)).toBeNull();

    expect(() => approveVesselList(as(s, 'usr-forklift'), { listId, mode: 'NHAP_TAU' })).toThrow(/Không đủ quyền/);
    s = approveVesselList(as(s, 'usr-office'), { listId, mode: 'NHAP_TAU' });
    expect(s.vesselLists[0]).toMatchObject({ status: 'APPROVED', approvedBy: expect.any(String) });
    expect(s.auditLogs[0].actionCode).toBe('NHAP_TAU_DUYET');
    expect(() => inspectVesselImportItem(as(s, 'usr-inspector'), inspect)).toThrow(/đã được duyệt/);

    const report = queryVesselReport(s, 'NHAP_TAU', { dateFrom: '', dateTo: '', containerNo: 'TCLU' }, 1);
    expect(report.total).toBe(2);
    const sheet = vesselReportSheet('NHAP_TAU', report.rows);
    expect(sheet.columns).toContain('MÃ HỒ SƠ');
    expect(sheet.rows[0]).toContain('EVER GENTLE');
  });
});

describe('DEC-069: XUẤT TÀU', () => {
  const base = { mode: 'XUAT_TAU' as const, vesselName: 'Wan Hai 305', plannedAt: PLANNED, truckNos: ['15C-333.33'] };

  it('Lập từ tồn vỏ (XT-), chặn cont khóa, gán xe → OUT, chặn cấp vỏ khi đang trong danh sách, bỏ cont, duyệt', () => {
    const s0 = as(createInitialState(), 'usr-office');
    const yard = s0.containers.filter((c) => c.status === 'IN_YARD').slice(0, 2);
    expect(yard.length).toBe(2);
    const locked = toggleContainerHold(s0, { containerNo: yard[0].containerNo, hold: true, reason: 'Giữ' });
    expect(() => createVesselList(locked, { ...base, exportContainerIds: [yard[0].id] })).toThrow(/KHÓA/);
    expect(() => createVesselList(s0, { ...base, exportContainerIds: [] })).toThrow(/chưa có container/);

    let { state: s, listId } = createVesselList(s0, { ...base, exportContainerIds: yard.map((c) => c.id) });
    const items = s.vesselLists[0].items;
    expect(items.map((i) => i.dossierCode)).toEqual([expect.stringMatching(/^XT-\d{6}-001$/), expect.stringMatching(/^XT-\d{6}-002$/)]);
    expect(items[0].locationAtList).toBeTruthy();
    expect(releaseBlocker(s.containers.find((c) => c.id === yard[0].id)!)).toMatch(/XUẤT TÀU/);
    expect(() => createVesselList(s, { ...base, exportContainerIds: [yard[0].id] })).toThrow(/Xuất tàu khác/);

    expect(() => executeVesselExport(as(s, 'usr-office'), { listId, itemId: items[0].id, truckNo: '15C-333.33' })).toThrow(/Không đủ quyền/);
    expect(() => executeVesselExport(as(s, 'usr-forklift'), { listId, itemId: items[0].id, truckNo: 'X' })).toThrow(/SỐ XE/);
    const lockedLater = toggleContainerHold(s, { containerNo: yard[0].containerNo, hold: true, reason: 'Giữ' });
    expect(() => executeVesselExport(as(lockedLater, 'usr-forklift'), { listId, itemId: items[0].id, truckNo: '15C-333.33' })).toThrow(/mở khóa/);

    s = executeVesselExport(as(s, 'usr-inspector'), { listId, itemId: items[0].id, truckNo: '15c-333.33' });
    expect(s.containers.find((c) => c.id === yard[0].id)).toMatchObject({ status: 'GATED_OUT', outDossierCode: items[0].dossierCode, currentBlock: null });
    expect(s.locationHistory[0].toLocation).toContain('XUẤT TÀU WAN HAI 305');
    expect(() => executeVesselExport(as(s, 'usr-forklift'), { listId, itemId: items[0].id, truckNo: '15C-333.33' })).toThrow(/đã xuất tàu/);
    s = as(s, 'usr-office');
    expect(() => approveVesselList(s, { listId, mode: 'XUAT_TAU' })).toThrow(/1\/2/);

    s = removeVesselListItem(s, { listId, itemId: items[1].id, mode: 'XUAT_TAU' });
    expect(s.containers.find((c) => c.id === yard[1].id)!.vesselExportItemId).toBeUndefined();
    expect(() => removeVesselListItem(s, { listId, itemId: items[0].id, mode: 'XUAT_TAU' })).toThrow(/đã tác nghiệp/);
    s = approveVesselList(s, { listId, mode: 'XUAT_TAU' });
    expect(s.vesselLists[0].status).toBe('APPROVED');
    expect(queryVesselReport(s, 'XUAT_TAU', { dateFrom: '', dateTo: '', vesselName: 'wan hai' }, 1).total).toBe(1);
  });
});

describe('DEC-069: đọc danh sách dán từ Excel', () => {
  it('Nhận tab / dấu phẩy / "40HC"; báo dòng lỗi', async () => {
    const { parseVesselImportText, parseTruckList } = await import('../src/services/vessel');
    const s = createInitialState();
    const r = parseVesselImportText(s, 'tclu1234567\t40\tHC\nTCLU7654321, 20, DC\nTCLU1111111 40HC\nABC 40 HC\nTCLU2222222 99 HC\ntclu1234567 40 HC');
    expect(r.rows.map((x) => x.containerNo)).toEqual(['TCLU1234567', 'TCLU7654321', 'TCLU1111111']);
    expect(r.rows[2]).toMatchObject({ size: '40', type: 'HC' });
    expect(r.errors).toHaveLength(3);
    expect(parseTruckList('15c-111.11\n15C-222.22, 15c-111.11')).toEqual(['15C-111.11', '15C-222.22']);
  });
});
