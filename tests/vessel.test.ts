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
    expect(() => updateContainerLocation(as(s, 'usr-forklift'), { containerNo: 'TCLU1234567', blockCode: 'BLOCK-B', reason: '' })).toThrow(/vệ sinh/);
    s = completeCleaningTask(as(s, 'usr-cleaning'), { containerNo: 'TCLU1234567' });
    s = updateContainerLocation(as(s, 'usr-forklift'), { containerNo: 'TCLU1234567', blockCode: 'BLOCK-B', reason: '' });
    expect(s.vesselLists[0].items[0].status).toBe('DONE');
    expect(s.containers.find((c) => c.id === it1.containerId)!.status).toBe('IN_YARD');

    s = inspectVesselImportItem(as(s, 'usr-inspector'), {
      ...inspect, itemId: i2.id, actualContainerNo: 'TCLU7654321', truckNo: '15C-222.22', conditionClass: 'AV', damageRemarks: [], cleaningItems: ['KHÔNG VỆ SINH'],
    });
    const c2 = s.containers.find((c) => c.containerNo === 'TCLU7654321' && c.status !== 'GATED_OUT')!;
    expect(c2.needsCleaning).toBe(false);
    s = updateContainerLocation(as(s, 'usr-forklift'), { containerNo: 'TCLU7654321', blockCode: 'BLOCK-B', reason: '' });
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

describe('DEC-070: Văn phòng sửa / thêm cont / xóa danh sách khi chưa duyệt', () => {
  it('Nhập tàu: sửa thông tin, thêm cont (chặn trùng), đổi hãng tàu bị chặn khi đã giám định, xóa bị chặn khi đã tác nghiệp', async () => {
    const v = await import('../src/services/vessel');
    const office = as(createInitialState(), 'usr-office');
    let { state: s, listId } = v.createVesselList(office, {
      mode: 'NHAP_TAU', vesselName: 'Tàu A', plannedAt: PLANNED, truckNos: ['15C-1'], shippingLineCode: 'MAERSK',
      importItems: [{ containerNo: 'TCLU1234567', size: '40', type: 'HC' }],
    });
    expect(() => v.updateVesselList(as(s, 'usr-forklift'), { listId, mode: 'NHAP_TAU', vesselName: 'X', plannedAt: PLANNED, truckNos: ['1'], shippingLineCode: 'MAERSK' })).toThrow(/Không đủ quyền/);
    expect(() => v.updateVesselList(s, { listId, mode: 'NHAP_TAU', vesselName: ' ', plannedAt: PLANNED, truckNos: ['1'], shippingLineCode: 'MAERSK' })).toThrow(/TÊN TÀU/);
    s = v.updateVesselList(s, { listId, mode: 'NHAP_TAU', vesselName: 'Tàu B', plannedAt: PLANNED, truckNos: ['15C-1', '15c-2'], shippingLineCode: 'ONE' });
    expect(s.vesselLists[0]).toMatchObject({ vesselName: 'TÀU B', truckNos: ['15C-1', '15C-2'], shippingLineCode: 'ONE' });

    expect(() => v.addVesselListItems(s, { listId, mode: 'NHAP_TAU', importItems: [{ containerNo: 'TCLU1234567', size: '40', type: 'HC' }] })).toThrow(/trùng/);
    s = v.addVesselListItems(s, { listId, mode: 'NHAP_TAU', importItems: [{ containerNo: 'TCLU7654321', size: '20', type: 'DC' }] });
    expect(s.vesselLists[0].items).toHaveLength(2);

    const it0 = s.vesselLists[0].items[0];
    s = v.inspectVesselImportItem(as(s, 'usr-inspector'), {
      listId, itemId: it0.id, actualContainerNo: it0.containerNo, truckNo: '15C-2', conditionClass: 'AV', stuffingClass: 'E', cleaningItems: ['KHÔNG VỆ SINH'], manufactureYear: 2015,
    });
    s = as(s, 'usr-office');
    expect(() => v.updateVesselList(s, { listId, mode: 'NHAP_TAU', vesselName: 'Tàu B', plannedAt: PLANNED, truckNos: ['15C-1'], shippingLineCode: 'MAERSK' })).toThrow(/HÃNG TÀU/);
    expect(() => v.deleteVesselList(s, { listId, mode: 'NHAP_TAU' })).toThrow(/không xóa/);
  });

  it('Xuất tàu: thêm cont từ tồn vỏ (XT- mới), xóa danh sách chưa tác nghiệp → cont mở lại cho cấp vỏ; danh sách đã duyệt thì không sửa', async () => {
    const v = await import('../src/services/vessel');
    const office = as(createInitialState(), 'usr-office');
    const yard = office.containers.filter((c) => c.status === 'IN_YARD').slice(0, 2);
    let { state: s, listId } = v.createVesselList(office, { mode: 'XUAT_TAU', vesselName: 'Tàu X', plannedAt: PLANNED, truckNos: ['15C-9'], exportContainerIds: [yard[0].id] });
    s = v.addVesselListItems(s, { listId, mode: 'XUAT_TAU', exportContainerIds: [yard[1].id] });
    expect(s.vesselLists[0].items.map((i) => i.dossierCode)).toEqual([expect.stringMatching(/-001$/), expect.stringMatching(/-002$/)]);
    expect(() => v.addVesselListItems(s, { listId, mode: 'XUAT_TAU', exportContainerIds: [yard[1].id] })).toThrow(/Xuất tàu khác/);
    expect(() => v.deleteVesselList(as(s, 'usr-inspector'), { listId, mode: 'XUAT_TAU' })).toThrow(/Không đủ quyền/);
    const deleted = v.deleteVesselList(s, { listId, mode: 'XUAT_TAU' });
    expect(deleted.vesselLists).toHaveLength(0);
    expect(deleted.containers.filter((c) => yard.some((y) => y.id === c.id)).every((c) => !c.vesselExportItemId && !/XUẤT TÀU/.test(releaseBlocker(c) || ""))).toBe(true);

    for (const i of s.vesselLists[0].items) s = executeVesselExport(as(s, 'usr-forklift'), { listId, itemId: i.id, truckNo: '15C-9' });
    s = approveVesselList(as(s, 'usr-office'), { listId, mode: 'XUAT_TAU' });
    expect(() => v.updateVesselList(s, { listId, mode: 'XUAT_TAU', vesselName: 'Y', plannedAt: PLANNED, truckNos: ['1'] })).toThrow(/đã được duyệt/);
    expect(() => v.deleteVesselList(s, { listId, mode: 'XUAT_TAU' })).toThrow(/đã được duyệt/);
  });
});

describe('DEC-070: sắp xếp danh sách tàu', () => {
  it('Size 20 → 40 → 45, cùng size thì số cont A→Z', async () => {
    const { sortVesselItems } = await import('../src/services/vessel');
    const rows = [
      { containerNo: 'ZZZU0000001', size: '20' }, { containerNo: 'AAAU0000001', size: '40' },
      { containerNo: 'BBBU0000001', size: '20' }, { containerNo: 'CCCU0000001', size: '45' }, { containerNo: 'AAAU0000002', size: '20' },
    ];
    expect(sortVesselItems(rows).map((r) => r.containerNo)).toEqual(['AAAU0000002', 'BBBU0000001', 'ZZZU0000001', 'AAAU0000001', 'CCCU0000001']);
  });
});

describe('DEC-071: theo dõi tác nghiệp hiện trường từng bộ phận', () => {
  it('Giám định / Xe nâng nhập tàu, xuất tàu: chờ làm / chưa tới lượt / đã xong, của tôi, theo xe', async () => {
    const v = await import('../src/services/vessel');
    const office = as(createInitialState(), 'usr-office');
    let { state: s, listId } = v.createVesselList(office, {
      mode: 'NHAP_TAU', vesselName: 'Tàu T', plannedAt: PLANNED, truckNos: ['15C-1', '15C-2'], shippingLineCode: 'MAERSK',
      importItems: [{ containerNo: 'TCLU1000001', size: '20', type: 'DC' }, { containerNo: 'TCLU1000002', size: '40', type: 'HC' }],
    });
    const [a, b] = s.vesselLists[0].items;
    s = v.inspectVesselImportItem(as(s, 'usr-inspector'), { listId, itemId: a.id, actualContainerNo: a.containerNo, truckNo: '15C-2', conditionClass: 'AV', stuffingClass: 'E', cleaningItems: ['WW'], manufactureYear: 2015 });
    const list = () => s.vesselLists[0];
    const gd = v.vesselStepSummary(s, 'NT_INSPECT', list());
    expect(gd).toMatchObject({ total: 2, done: 1, todo: 1, wait: 0, mine: 1 });
    expect(gd.byTruck).toEqual([{ truckNo: '15C-1', count: 0 }, { truckNo: '15C-2', count: 1 }]);
    expect(v.vesselStepInfo(s, 'NT_INSPECT', list().items[0])).toMatchObject({ status: 'DONE', truckNo: '15C-2' });
    // Xe nâng: cont đã giám định nhưng còn chờ vệ sinh → chưa tới lượt; cont chưa về → chưa tới lượt
    expect(v.vesselStepSummary(s, 'NT_PLACE', list())).toMatchObject({ todo: 0, wait: 2, done: 0 });
    expect(v.vesselStepInfo(s, 'NT_PLACE', list().items[0]).note).toMatch(/Vệ sinh/);
    expect(v.vesselStepInfo(s, 'NT_PLACE', list().items.find((i) => i.id === b.id)!).note).toMatch(/Giám định/);
    s = completeCleaningTask(as(s, 'usr-cleaning'), { containerNo: a.containerNo });
    expect(v.vesselStepInfo(s, 'NT_PLACE', list().items[0]).status).toBe('TODO');
    s = updateContainerLocation(as(s, 'usr-forklift'), { containerNo: a.containerNo, blockCode: 'BLOCK-B', reason: '' });
    expect(v.vesselStepSummary(s, 'NT_PLACE', list())).toMatchObject({ done: 1, mine: 1 });
  });
});
