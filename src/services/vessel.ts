import {
  ContainerRecord,
  ContainerSize,
  ContainerType,
  FieldCleaningItem,
  FieldConditionClass,
  FieldStuffingClass,
  ServiceWorkOrder,
  VesselList,
  VesselListItem,
  VesselMode,
  VESSEL_MODE_LABELS,
} from '../types/depot';
import type { DepotState } from './depotStore';
import { allocateCode } from './codes';
import {
  appendAudit,
  assertPermission,
  formatLocation,
  newId,
  normalizeContainerNo,
  nowIso,
  updateContainerById,
} from './core';
import { gateInContainerConflict, normalizeCleaningItems } from './depotOperations';
import { formatDateTime } from './datetime';

// ============================================================================
// NHẬP TÀU / XUẤT TÀU (DEC-069)
//   - Văn phòng / Quản lý lập danh sách theo tàu (tên tàu, thời gian, danh sách số xe, container).
//   - Mỗi container 1 hồ sơ: NT-YYMMDD-NNN / XT-YYMMDD-NNN (DEC-068).
//   - Không thu phí, không phiếu K80, không trả chứng từ.
//   - NHẬP TÀU: Giám định xác nhận cont về thực tế → cont vào hàng chờ Vệ sinh (nếu có) → Xe nâng hạ vỏ
//     (dùng chung hàng chờ & hàm của Hạ vỏ) → cont tồn bãi ngay, Văn phòng cấp vỏ được.
//     DAMAGE đi tiếp Báo giá → Sửa chữa như Hạ vỏ.
//   - XUẤT TÀU: danh sách lấy từ tồn vỏ (mọi cont đang tồn bãi, trừ cont khóa / đã lập lệnh / đã trong danh sách khác);
//     Giám định / Xe nâng chọn cont + gán số xe → cont OUT khỏi bãi.
//   - Hết danh sách → Văn phòng / Quản lý DUYỆT danh sách thành công.
// ============================================================================

const label = (mode: VesselMode) => VESSEL_MODE_LABELS[mode];

function normalizeTrucks(raw: string[]): string[] {
  return Array.from(new Set(raw.map((t) => t.trim().toUpperCase()).filter(Boolean)));
}

function findList(state: DepotState, listId: string, mode: VesselMode): VesselList {
  const list = (state.vesselLists || []).find((l) => l.id === listId);
  if (!list || list.mode !== mode) throw new Error(`Không tìm thấy danh sách ${label(mode)}.`);
  if (list.status === 'APPROVED') throw new Error(`Danh sách ${label(mode)} tàu ${list.vesselName} đã được duyệt — không thao tác thêm.`);
  return list;
}

function findItem(list: VesselList, itemId: string): VesselListItem {
  const item = list.items.find((i) => i.id === itemId);
  if (!item) throw new Error('Không tìm thấy container trong danh sách.');
  return item;
}

function patchItem(state: DepotState, listId: string, itemId: string, patch: Partial<VesselListItem>): DepotState {
  return {
    ...state,
    vesselLists: state.vesselLists.map((l) =>
      l.id === listId ? { ...l, items: l.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)) } : l
    ),
  };
}

// Cont NHẬP TÀU đang chờ về (chưa xong) ở danh sách khác chưa duyệt
function pendingImportOf(state: DepotState, containerNo: string, exceptListId?: string): VesselList | undefined {
  return (state.vesselLists || []).find(
    (l) => l.mode === 'NHAP_TAU' && l.id !== exceptListId && l.status === 'OPEN' && l.items.some((i) => i.containerNo === containerNo && i.status === 'PENDING')
  );
}

// Lý do container KHÔNG đưa được vào danh sách XUẤT TÀU (null = được)
export function vesselExportBlocker(c: ContainerRecord): string | null {
  if (c.status !== 'IN_YARD') return c.status === 'ALLOCATED' ? 'Đã lập lệnh cấp vỏ' : 'Chưa tồn bãi (chờ hạ vỏ)';
  if (c.vesselExportItemId) return 'Đã trong danh sách Xuất tàu khác';
  if (c.isOnHold) return 'Container đang bị KHÓA';
  return null;
}

// ---------------------------------------------------------------------------
// 1. VĂN PHÒNG — LẬP DANH SÁCH
// ---------------------------------------------------------------------------
export function createVesselList(
  state: DepotState,
  input: {
    mode: VesselMode;
    vesselName: string;
    plannedAt: string;
    truckNos: string[];
    shippingLineCode?: string;
    importItems?: { containerNo: string; size: ContainerSize; type: ContainerType }[];
    exportContainerIds?: string[];
  }
): { state: DepotState; listId: string } {
  assertPermission(state, 'VESSEL_LIST_MANAGE', `chỉ Văn phòng / Quản lý được lập danh sách ${label(input.mode)}.`);
  const vesselName = input.vesselName.trim().toUpperCase();
  if (!vesselName) throw new Error('Bắt buộc nhập TÊN TÀU.');
  if (!input.plannedAt || Number.isNaN(new Date(input.plannedAt).getTime())) {
    throw new Error(`Bắt buộc nhập THỜI GIAN ${label(input.mode)} hợp lệ (dd/MM/yyyy HH:mm:ss).`);
  }
  const truckNos = normalizeTrucks(input.truckNos);
  if (truckNos.length === 0) throw new Error(`Bắt buộc nhập DANH SÁCH SỐ XE ${label(input.mode)}.`);

  const now = nowIso();
  const listId = newId('vsl');
  let next = state;
  const items: VesselListItem[] = [];

  if (input.mode === 'NHAP_TAU') {
    const line = state.partners.find((p) => p.isShippingLine && p.code === input.shippingLineCode);
    if (!line) throw new Error('Bắt buộc chọn HÃNG TÀU theo Danh mục chung.');
    const rows = input.importItems || [];
    if (rows.length === 0) throw new Error('Danh sách nhập tàu chưa có container nào.');
    const seen = new Set<string>();
    for (const r of rows) {
      const no = normalizeContainerNo(r.containerNo);
      if (seen.has(no)) throw new Error(`Container ${no} bị trùng trong danh sách.`);
      seen.add(no);
      if (!state.containerSizes.includes(r.size)) throw new Error(`Size "${r.size}" của ${no} không có trong Danh mục.`);
      if (!state.containerTypes.includes(r.type)) throw new Error(`Type "${r.type}" của ${no} không có trong Danh mục.`);
      const conflict = gateInContainerConflict(state, no);
      if (conflict) throw new Error(conflict);
      const other = pendingImportOf(state, no);
      if (other) throw new Error(`Container ${no} đang chờ nhập ở danh sách tàu ${other.vesselName}.`);
      items.push({ id: newId('vsi'), containerNo: no, size: r.size, type: r.type, status: 'PENDING' });
    }
    next = { ...next, vesselLists: [{ id: listId, mode: input.mode, vesselName, shippingLineCode: line.code, plannedAt: input.plannedAt, truckNos, items, status: 'OPEN', createdBy: state.currentUser.fullName, createdAt: now }, ...(next.vesselLists || [])] };
  } else {
    const ids = Array.from(new Set(input.exportContainerIds || []));
    if (ids.length === 0) throw new Error('Danh sách xuất tàu chưa có container nào (chọn từ tồn vỏ).');
    for (const id of ids) {
      const c = next.containers.find((x) => x.id === id);
      if (!c || c.status === 'GATED_OUT') throw new Error('Có container không còn tồn bãi — tải lại danh sách.');
      const blocker = vesselExportBlocker(c);
      if (blocker) throw new Error(`Container ${c.containerNo} không đưa vào XUẤT TÀU được: ${blocker}.`);
      const allocated = allocateCode(next, 'XT');
      next = allocated.state;
      const itemId = newId('vsi');
      items.push({
        id: itemId,
        containerNo: c.containerNo,
        size: c.size,
        type: c.type,
        status: 'PENDING',
        dossierCode: allocated.code,
        containerId: c.id,
        conditionClass: c.conditionClass,
        stuffingClass: c.stuffingClass,
        locationAtList: formatLocation(c),
      });
      next = updateContainerById(next, c.id, { vesselExportItemId: itemId });
    }
    next = { ...next, vesselLists: [{ id: listId, mode: input.mode, vesselName, plannedAt: input.plannedAt, truckNos, items, status: 'OPEN', createdBy: state.currentUser.fullName, createdAt: now }, ...(next.vesselLists || [])] };
  }

  return {
    listId,
    state: appendAudit(
      next,
      input.mode === 'NHAP_TAU' ? 'NHAP_TAU_LAP_DANH_SACH' : 'XUAT_TAU_LAP_DANH_SACH',
      'VESSEL',
      vesselName,
      `Văn phòng lập danh sách ${label(input.mode)} tàu ${vesselName} (${formatDateTime(input.plannedAt)}): ${items.length} container, xe ${truckNos.join(', ')}`
    ),
  };
}

// Bỏ 1 container còn chờ khỏi danh sách (chưa tác nghiệp)
export function removeVesselListItem(state: DepotState, input: { listId: string; itemId: string; mode: VesselMode }): DepotState {
  assertPermission(state, 'VESSEL_LIST_MANAGE', `chỉ Văn phòng / Quản lý được sửa danh sách ${label(input.mode)}.`);
  const list = findList(state, input.listId, input.mode);
  const item = findItem(list, input.itemId);
  if (item.status !== 'PENDING') throw new Error(`Container ${item.containerNo} đã tác nghiệp — không bỏ khỏi danh sách được.`);
  let next: DepotState = {
    ...state,
    vesselLists: state.vesselLists.map((l) => (l.id === list.id ? { ...l, items: l.items.filter((i) => i.id !== item.id) } : l)),
  };
  if (item.containerId) next = updateContainerById(next, item.containerId, { vesselExportItemId: undefined });
  return appendAudit(next, 'VESSEL_REMOVE_ITEM', 'VESSEL', list.vesselName, `Bỏ ${item.containerNo} khỏi danh sách ${label(list.mode)} tàu ${list.vesselName}`, item.dossierCode);
}

// ---------------------------------------------------------------------------
// 2. GIÁM ĐỊNH — NHẬP TÀU: xác nhận cont về thực tế
// ---------------------------------------------------------------------------
export function inspectVesselImportItem(
  state: DepotState,
  input: {
    listId: string;
    itemId: string;
    actualContainerNo: string;
    truckNo: string;
    conditionClass: FieldConditionClass;
    damageRemarks?: string[];
    stuffingClass: FieldStuffingClass;
    cleaningItems: (FieldCleaningItem | string)[];
    manufactureYear: number;
  }
): DepotState {
  assertPermission(state, 'VESSEL_IMPORT_INSPECT', 'chỉ Bộ phận Giám định / Quản lý được xác nhận container NHẬP TÀU.');
  const list = findList(state, input.listId, 'NHAP_TAU');
  const item = findItem(list, input.itemId);
  if (item.status !== 'PENDING') throw new Error(`Container ${item.containerNo} đã được Giám định xác nhận.`);
  const actual = normalizeContainerNo(input.actualContainerNo);
  if (actual !== item.containerNo) {
    throw new Error(`Số cont thực tế ${actual} không khớp danh sách (${item.containerNo}). Kiểm tra lại hoặc báo Văn phòng sửa danh sách.`);
  }
  const truckNo = input.truckNo.trim().toUpperCase();
  if (!list.truckNos.includes(truckNo)) throw new Error('Bắt buộc chọn SỐ XE trong danh sách xe nhập tàu.');
  if (input.conditionClass !== 'AV' && input.conditionClass !== 'DAMAGE') throw new Error('Bắt buộc chọn TRẠNG THÁI: DAMAGE / AV.');
  if (!['M', 'K', 'E'].includes(input.stuffingClass)) throw new Error('Bắt buộc chọn PHÂN LOẠI ĐÓNG HÀNG: M / K / E.');
  if (!input.cleaningItems?.some((i) => String(i).trim())) throw new Error('Bắt buộc chọn TÌNH TRẠNG VỆ SINH (1 hoặc nhiều phương án).');
  const cleaningItems = normalizeCleaningItems(input.cleaningItems);
  const year = Number(input.manufactureYear);
  if (!Number.isInteger(year) || year < 1980 || year > new Date().getFullYear() + 1) {
    throw new Error('Năm sinh container (AGE) phải theo định dạng 4 chữ số hợp lệ (VD: 2001, 2002...).');
  }
  const conflict = gateInContainerConflict(state, actual);
  if (conflict) throw new Error(conflict);

  const allocated = allocateCode(state, 'NT');
  const code = allocated.code;
  const now = nowIso();
  const actor = state.currentUser.fullName;
  const isDamage = input.conditionClass === 'DAMAGE';
  const remarks = isDamage ? (input.damageRemarks || []).map((r) => r.trim()).filter(Boolean) : [];
  const requiresCleaning = cleaningItems.some((i) => i !== 'KHÔNG VỆ SINH');
  const qr = `QR-${code}`;

  const workOrders: ServiceWorkOrder[] = [];
  if (isDamage) {
    workOrders.push({
      id: newId('wo'), masterDossierCode: code, workOrderCode: `INSP-${code}`, containerNo: actual, category: 'INSPECTION',
      sourceOrderCode: code, items: remarks.length ? remarks : ['Hư hỏng ghi nhận khi Nhập tàu'], estimateCost: 0,
      approvalStatus: 'NOT_REQUIRED', workStatus: 'OPEN', assignedTo: 'Bộ phận Báo giá', createdAt: now,
    });
  }
  if (requiresCleaning) {
    workOrders.push({
      id: newId('wo'), masterDossierCode: code, workOrderCode: `CLN-${code}`, containerNo: actual, category: 'CLEANING',
      sourceOrderCode: code, items: [...cleaningItems], estimateCost: 0,
      approvalStatus: 'NOT_REQUIRED', workStatus: 'OPEN', assignedTo: 'Bộ phận Vệ sinh', createdAt: now,
    });
  }

  const container: ContainerRecord = {
    id: newId('cnt'),
    masterDossierCode: code,
    containerNo: actual,
    size: item.size,
    type: item.type,
    manufactureYear: year,
    shippingLineCode: list.shippingLineCode || '',
    customerRep: '',
    truckNo,
    status: 'WAITING_PLACEMENT',
    conditionClass: input.conditionClass,
    damageRemarks: remarks,
    stuffingClass: input.stuffingClass,
    cleaningItems,
    activeQrCode: qr,
    isPaid: false,
    currentBlock: null,
    currentBay: null,
    currentRow: null,
    currentTier: null,
    needsCleaning: requiresCleaning,
    needsQuotation: isDamage,
    needsRepair: false,
    forkliftShiftTask: 'NONE',
    isOnHold: false,
    gateInAt: now,
  };

  let next: DepotState = { ...allocated.state, containers: [container, ...allocated.state.containers], workOrders: [...workOrders, ...allocated.state.workOrders] };
  next = patchItem(next, list.id, item.id, {
    status: 'INSPECTED', dossierCode: code, containerId: container.id, truckNo, conditionClass: input.conditionClass,
    stuffingClass: input.stuffingClass, cleaningItems, damageRemarks: remarks, manufactureYear: year, inspectedBy: actor, inspectedAt: now,
  });
  return appendAudit(
    next,
    'NHAP_TAU_GIAM_DINH',
    'VESSEL',
    code,
    `[Hồ sơ ${code}] Giám định xác nhận NHẬP TÀU ${actual} (tàu ${list.vesselName}, xe ${truckNo}): ${input.conditionClass}${remarks.length ? ` (${remarks.join(', ')})` : ''}, Đóng hàng ${input.stuffingClass}, Vệ sinh [${cleaningItems.join(', ')}], AGE ${year} -> ${requiresCleaning ? 'Chờ vệ sinh' : 'Chờ hạ vỏ'}`,
    code
  );
}

// Xe nâng hạ cont NHẬP TÀU → cont đó hoàn thành (gọi từ updateContainerLocation)
export function markVesselImportPlaced(state: DepotState, containerId: string): DepotState {
  const list = (state.vesselLists || []).find((l) => l.mode === 'NHAP_TAU' && l.items.some((i) => i.containerId === containerId));
  if (!list) return state;
  const item = list.items.find((i) => i.containerId === containerId)!;
  if (item.status !== 'INSPECTED') return state;
  return patchItem(state, list.id, item.id, { status: 'DONE', doneBy: state.currentUser.fullName, doneAt: nowIso() });
}

// ---------------------------------------------------------------------------
// 3. GIÁM ĐỊNH / XE NÂNG — XUẤT TÀU: chọn cont, gán số xe → OUT khỏi bãi
// ---------------------------------------------------------------------------
export function executeVesselExport(state: DepotState, input: { listId: string; itemId: string; truckNo: string }): DepotState {
  assertPermission(state, 'VESSEL_EXPORT_EXECUTE', 'chỉ Bộ phận Giám định / Xe nâng / Quản lý được tác nghiệp XUẤT TÀU.');
  const list = findList(state, input.listId, 'XUAT_TAU');
  const item = findItem(list, input.itemId);
  if (item.status !== 'PENDING') throw new Error(`Container ${item.containerNo} đã xuất tàu.`);
  const truckNo = input.truckNo.trim().toUpperCase();
  if (!list.truckNos.includes(truckNo)) throw new Error('Bắt buộc chọn SỐ XE trong danh sách xe xuất tàu.');
  const c = state.containers.find((x) => x.id === item.containerId);
  if (!c || c.status === 'GATED_OUT') throw new Error(`Container ${item.containerNo} không còn tồn bãi.`);
  if (c.isOnHold) throw new Error(`Container ${c.containerNo} đang bị KHÓA (${c.holdReason || ''}) — Văn phòng phải mở khóa trước khi xuất tàu.`);
  if (c.status !== 'IN_YARD') throw new Error(`Container ${c.containerNo} không ở trạng thái tồn bãi.`);

  const now = nowIso();
  const actor = state.currentUser.fullName;
  const prevLoc = formatLocation(c);
  const code = item.dossierCode!;
  let next: DepotState = {
    ...state,
    // Cont rời bãi: đóng các việc Vệ sinh / Báo giá / Sửa chữa còn mở của lượt lưu bãi
    workOrders: state.workOrders.map((w) =>
      w.masterDossierCode === c.masterDossierCode && w.workStatus === 'OPEN'
        ? { ...w, workStatus: 'CANCELLED' as const, resultNotes: `Đóng do XUẤT TÀU (${code})` }
        : w
    ),
    locationHistory: [
      {
        id: newId('loc'),
        masterDossierCode: c.masterDossierCode,
        containerNo: c.containerNo,
        fromLocation: prevLoc,
        toLocation: `XUẤT TÀU ${list.vesselName} (${truckNo})`,
        actionType: 'GATE_OUT_CLEAR',
        reason: `Xuất tàu ${list.vesselName} (${code})`,
        performedBy: actor,
        performedAt: now,
      },
      ...state.locationHistory,
    ],
  };
  next = updateContainerById(next, c.id, {
    status: 'GATED_OUT',
    currentBlock: null,
    currentBay: null,
    currentRow: null,
    currentTier: null,
    needsCleaning: false,
    needsQuotation: false,
    needsRepair: false,
    forkliftShiftTask: 'NONE',
    outDossierCode: code,
    vesselExportItemId: undefined,
    gateOutAt: now,
  });
  next = patchItem(next, list.id, item.id, { status: 'DONE', truckNo, doneBy: actor, doneAt: now });
  return appendAudit(
    next,
    'XUAT_TAU_OK',
    'VESSEL',
    code,
    `[Hồ sơ ${code}] XUẤT TÀU ${c.containerNo} (${c.conditionClass}) từ ${prevLoc} — tàu ${list.vesselName}, xe ${truckNo}`,
    c.masterDossierCode
  );
}

// ---------------------------------------------------------------------------
// 4. VĂN PHÒNG / QUẢN LÝ — DUYỆT danh sách khi đã xong hết
// ---------------------------------------------------------------------------
export function vesselListProgress(list: VesselList): { total: number; done: number; inspected: number; pending: number } {
  const done = list.items.filter((i) => i.status === 'DONE').length;
  const inspected = list.items.filter((i) => i.status === 'INSPECTED').length;
  return { total: list.items.length, done, inspected, pending: list.items.length - done - inspected };
}

export function approveVesselList(state: DepotState, input: { listId: string; mode: VesselMode }): DepotState {
  assertPermission(state, 'VESSEL_LIST_MANAGE', `chỉ Văn phòng / Quản lý được duyệt ${label(input.mode)}.`);
  const list = findList(state, input.listId, input.mode);
  const p = vesselListProgress(list);
  if (p.total === 0) throw new Error('Danh sách không có container nào.');
  if (p.done < p.total) throw new Error(`Chưa ${label(list.mode)} hết danh sách (${p.done}/${p.total}) — chưa duyệt được.`);
  const now = nowIso();
  return appendAudit(
    { ...state, vesselLists: state.vesselLists.map((l) => (l.id === list.id ? { ...l, status: 'APPROVED' as const, approvedBy: state.currentUser.fullName, approvedAt: now } : l)) },
    list.mode === 'NHAP_TAU' ? 'NHAP_TAU_DUYET' : 'XUAT_TAU_DUYET',
    'VESSEL',
    list.vesselName,
    `Duyệt ${label(list.mode)} thành công tàu ${list.vesselName}: ${p.total} container`
  );
}

// Tra cứu theo mã hồ sơ NT- / XT-
export function findVesselItemByCode(state: DepotState, code: string): { list: VesselList; item: VesselListItem } | undefined {
  for (const list of state.vesselLists || []) {
    const item = list.items.find((i) => i.dossierCode === code);
    if (item) return { list, item };
  }
  return undefined;
}

// Danh sách đang mở theo tác nghiệp (mới nhất trước)
export function openVesselLists(state: DepotState, mode: VesselMode): VesselList[] {
  return (state.vesselLists || []).filter((l) => l.mode === mode && l.status === 'OPEN');
}

// Đọc danh sách NHẬP TÀU dán từ Excel / gõ tay: mỗi dòng "SỐ CONT  SIZE  TYPE" (tab, dấu phẩy, khoảng trắng; "40HC" cũng được)
export function parseVesselImportText(
  state: DepotState,
  text: string
): { rows: { containerNo: string; size: ContainerSize; type: ContainerType }[]; errors: string[] } {
  const rows: { containerNo: string; size: ContainerSize; type: ContainerType }[] = [];
  const errors: string[] = [];
  text.split(/\r?\n/).forEach((line, idx) => {
    const raw = line.trim().toUpperCase();
    if (!raw) return;
    const parts = raw.split(/[\t,;\s]+/).filter(Boolean);
    const no = parts[0] || '';
    let size = parts[1] || '';
    let type = parts[2] || '';
    const joined = /^(\d{2})([A-Z]{2})$/.exec(size);
    if (joined && !type) [size, type] = [joined[1], joined[2]];
    if (!/^[A-Z]{4}\d{7}$/.test(no)) return errors.push(`Dòng ${idx + 1}: số container "${no}" không hợp lệ.`);
    if (!state.containerSizes.includes(size as ContainerSize)) return errors.push(`Dòng ${idx + 1}: size "${size || '-'}" không có trong Danh mục.`);
    if (!state.containerTypes.includes(type as ContainerType)) return errors.push(`Dòng ${idx + 1}: type "${type || '-'}" không có trong Danh mục.`);
    if (rows.some((r) => r.containerNo === no)) return errors.push(`Dòng ${idx + 1}: ${no} bị trùng.`);
    rows.push({ containerNo: no, size: size as ContainerSize, type: type as ContainerType });
  });
  return { rows, errors };
}

// Danh sách số xe: mỗi dòng / dấu phẩy 1 xe
export function parseTruckList(text: string): string[] {
  return normalizeTrucks(text.split(/[\n,;]+/));
}
