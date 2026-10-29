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
import { resolveStuffing } from './stuffing';

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
// 1. VĂN PHÒNG / QUẢN LÝ — LẬP, SỬA, THÊM CONT, BỎ CONT, XÓA DANH SÁCH (chỉ khi chưa duyệt — DEC-070)
// ---------------------------------------------------------------------------
type ImportRow = { containerNo: string; size: ContainerSize; type: ContainerType };

function validateHeader(mode: VesselMode, input: { vesselName: string; plannedAt: string; truckNos: string[] }) {
  const vesselName = input.vesselName.trim().toUpperCase();
  if (!vesselName) throw new Error('Bắt buộc nhập TÊN TÀU.');
  if (!input.plannedAt || Number.isNaN(new Date(input.plannedAt).getTime())) {
    throw new Error(`Bắt buộc nhập THỜI GIAN ${label(mode)} hợp lệ (dd/MM/yyyy HH:mm:ss).`);
  }
  const truckNos = normalizeTrucks(input.truckNos);
  if (truckNos.length === 0) throw new Error(`Bắt buộc nhập DANH SÁCH SỐ XE ${label(mode)}.`);
  return { vesselName, truckNos };
}

function assertShippingLine(state: DepotState, code?: string): string {
  const line = state.partners.find((p) => p.isShippingLine && p.code === code);
  if (!line) throw new Error('Bắt buộc chọn HÃNG TÀU theo Danh mục chung.');
  return line.code;
}

// Dòng NHẬP TÀU mới: kiểm tra số cont, size / type, trùng tồn vỏ / hồ sơ Hạ vỏ / danh sách khác / chính danh sách
function buildImportItems(state: DepotState, rows: ImportRow[], existing: VesselListItem[] = []): VesselListItem[] {
  if (rows.length === 0) throw new Error('Danh sách nhập tàu chưa có container nào.');
  const seen = new Set(existing.map((i) => i.containerNo));
  return rows.map((r) => {
    const no = normalizeContainerNo(r.containerNo);
    if (seen.has(no)) throw new Error(`Container ${no} bị trùng trong danh sách.`);
    seen.add(no);
    if (!state.containerSizes.includes(r.size)) throw new Error(`Size "${r.size}" của ${no} không có trong Danh mục.`);
    if (!state.containerTypes.includes(r.type)) throw new Error(`Type "${r.type}" của ${no} không có trong Danh mục.`);
    const conflict = gateInContainerConflict(state, no);
    if (conflict) throw new Error(conflict);
    const other = pendingImportOf(state, no);
    if (other) throw new Error(`Container ${no} đang chờ nhập ở danh sách tàu ${other.vesselName}.`);
    return { id: newId('vsi'), containerNo: no, size: r.size, type: r.type, status: 'PENDING' as const };
  });
}

// Dòng XUẤT TÀU mới: chọn từ tồn vỏ, cấp mã XT- và đánh dấu cont đang trong danh sách
// DEC-131: cont trong danh sách XUẤT TÀU tự KHÓA + ghi chú tên tàu (thay ghi chú cũ); bỏ khỏi danh sách / không kịp → tự mở khóa + xóa ghi chú
function vesselLock(state: DepotState, containerId: string, vesselName: string): DepotState {
  const note = `XUẤT TÀU ${vesselName}`;
  const now = nowIso();
  return updateContainerById(state, containerId, {
    isOnHold: true, holdSource: 'VESSEL_EXPORT', holdReason: note, holdBy: state.currentUser.fullName, holdAt: now,
    officeNote: note, officeNoteUpdatedBy: state.currentUser.fullName, officeNoteUpdatedAt: now,
  });
}
function vesselUnlock(state: DepotState, containerId: string): DepotState {
  return updateContainerById(state, containerId, {
    vesselExportItemId: undefined, isOnHold: false, holdSource: undefined, holdReason: undefined, holdBy: undefined, holdAt: undefined,
    officeNote: undefined, officeNoteUpdatedBy: undefined, officeNoteUpdatedAt: undefined,
  });
}

function buildExportItems(state: DepotState, containerIds: string[], vesselName: string): { state: DepotState; items: VesselListItem[] } {
  const ids = Array.from(new Set(containerIds));
  if (ids.length === 0) throw new Error('Danh sách xuất tàu chưa có container nào (chọn từ tồn vỏ).');
  let next = state;
  const items: VesselListItem[] = [];
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
    next = vesselLock(updateContainerById(next, c.id, { vesselExportItemId: itemId }), c.id, vesselName);
  }
  return { state: next, items };
}

export function createVesselList(
  state: DepotState,
  input: {
    mode: VesselMode;
    vesselName: string;
    plannedAt: string;
    truckNos: string[];
    shippingLineCode?: string;
    importItems?: ImportRow[];
    exportContainerIds?: string[];
  }
): { state: DepotState; listId: string } {
  assertPermission(state, 'VESSEL_LIST_MANAGE', `chỉ Văn phòng / Quản lý được lập danh sách ${label(input.mode)}.`);
  const { vesselName, truckNos } = validateHeader(input.mode, input);
  const listId = newId('vsl');
  let next = state;
  let items: VesselListItem[];
  let shippingLineCode: string | undefined;
  if (input.mode === 'NHAP_TAU') {
    shippingLineCode = assertShippingLine(state, input.shippingLineCode);
    items = buildImportItems(state, input.importItems || []);
  } else {
    ({ state: next, items } = buildExportItems(state, input.exportContainerIds || [], vesselName));
  }
  const list: VesselList = {
    id: listId, mode: input.mode, vesselName, shippingLineCode, plannedAt: input.plannedAt, truckNos, items,
    status: 'OPEN', createdBy: state.currentUser.fullName, createdAt: nowIso(),
  };
  return {
    listId,
    state: appendAudit(
      { ...next, vesselLists: [list, ...(next.vesselLists || [])] },
      input.mode === 'NHAP_TAU' ? 'NHAP_TAU_LAP_DANH_SACH' : 'XUAT_TAU_LAP_DANH_SACH',
      'VESSEL',
      vesselName,
      `Văn phòng lập danh sách ${label(input.mode)} tàu ${vesselName} (${formatDateTime(input.plannedAt)}): ${items.length} container, xe ${truckNos.join(', ')}`
    ),
  };
}

// Sửa thông tin chung: tên tàu, thời gian, danh sách số xe; hãng tàu (NHẬP TÀU) chỉ đổi được khi chưa giám định cont nào
export function updateVesselList(
  state: DepotState,
  input: { listId: string; mode: VesselMode; vesselName: string; plannedAt: string; truckNos: string[]; shippingLineCode?: string }
): DepotState {
  assertPermission(state, 'VESSEL_LIST_MANAGE', `chỉ Văn phòng / Quản lý được sửa danh sách ${label(input.mode)}.`);
  const list = findList(state, input.listId, input.mode);
  const { vesselName, truckNos } = validateHeader(input.mode, input);
  let shippingLineCode = list.shippingLineCode;
  if (input.mode === 'NHAP_TAU') {
    const code = assertShippingLine(state, input.shippingLineCode);
    if (code !== list.shippingLineCode && list.items.some((i) => i.status !== 'PENDING')) {
      throw new Error('Đã có container được giám định — không đổi HÃNG TÀU được.');
    }
    shippingLineCode = code;
  }
  let next: DepotState = state;
  if (list.mode === 'XUAT_TAU' && vesselName !== list.vesselName) {
    for (const i of list.items) if (i.status === 'PENDING' && i.containerId) next = vesselLock(next, i.containerId, vesselName); // DEC-131
  }
  return appendAudit(
    { ...next, vesselLists: next.vesselLists.map((l) => (l.id === list.id ? { ...l, vesselName, plannedAt: input.plannedAt, truckNos, shippingLineCode } : l)) },
    'VESSEL_UPDATE_LIST',
    'VESSEL',
    vesselName,
    `Sửa danh sách ${label(list.mode)}: tàu ${list.vesselName} → ${vesselName}, ${formatDateTime(input.plannedAt)}, xe ${truckNos.join(', ')}${shippingLineCode ? `, hãng ${shippingLineCode}` : ''}`
  );
}

// Thêm container vào danh sách đang mở
export function addVesselListItems(
  state: DepotState,
  input: { listId: string; mode: VesselMode; importItems?: ImportRow[]; exportContainerIds?: string[] }
): DepotState {
  assertPermission(state, 'VESSEL_LIST_MANAGE', `chỉ Văn phòng / Quản lý được sửa danh sách ${label(input.mode)}.`);
  const list = findList(state, input.listId, input.mode);
  let next = state;
  let items: VesselListItem[];
  if (input.mode === 'NHAP_TAU') items = buildImportItems(state, input.importItems || [], list.items);
  else ({ state: next, items } = buildExportItems(state, input.exportContainerIds || [], list.vesselName));
  return appendAudit(
    { ...next, vesselLists: next.vesselLists.map((l) => (l.id === list.id ? { ...l, items: [...l.items, ...items] } : l)) },
    'VESSEL_ADD_ITEMS',
    'VESSEL',
    list.vesselName,
    `Thêm ${items.length} container vào danh sách ${label(list.mode)} tàu ${list.vesselName}: ${items.map((i) => i.containerNo).join(', ')}`
  );
}

// Xóa cả danh sách: chỉ khi CHƯA có container nào được tác nghiệp (tránh mất hồ sơ đã tạo)
export function deleteVesselList(state: DepotState, input: { listId: string; mode: VesselMode }): DepotState {
  assertPermission(state, 'VESSEL_LIST_MANAGE', `chỉ Văn phòng / Quản lý được xóa danh sách ${label(input.mode)}.`);
  const list = findList(state, input.listId, input.mode);
  const worked = list.items.filter((i) => i.status !== 'PENDING');
  if (worked.length > 0) {
    throw new Error(`Đã có ${worked.length} container được tác nghiệp — không xóa danh sách được (chỉ bỏ được cont còn chờ).`);
  }
  let next: DepotState = { ...state, vesselLists: state.vesselLists.filter((l) => l.id !== list.id) };
  for (const i of list.items) if (i.containerId && list.mode === 'XUAT_TAU') next = vesselUnlock(next, i.containerId); // DEC-131
  return appendAudit(next, 'VESSEL_DELETE_LIST', 'VESSEL', list.vesselName, `Xóa danh sách ${label(list.mode)} tàu ${list.vesselName} (${list.items.length} container chưa tác nghiệp)`);
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
  if (item.containerId && list.mode === 'XUAT_TAU') next = vesselUnlock(next, item.containerId); // DEC-131
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
    stuffingClass?: FieldStuffingClass;
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
  const stuffing = resolveStuffing(state, list.shippingLineCode, input.stuffingClass); // DEC-166: theo Danh mục của hãng tàu
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
    stuffingClass: stuffing,
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
    stuffingClass: stuffing, cleaningItems, damageRemarks: remarks, manufactureYear: year, inspectedBy: actor, inspectedAt: now,
  });
  return appendAudit(
    next,
    'NHAP_TAU_GIAM_DINH',
    'VESSEL',
    code,
    `[Hồ sơ ${code}] Giám định xác nhận NHẬP TÀU ${actual} (tàu ${list.vesselName}, xe ${truckNo}): ${input.conditionClass}${remarks.length ? ` (${remarks.join(', ')})` : ''}, Đóng hàng ${stuffing || '-'}, Vệ sinh [${cleaningItems.join(', ')}], AGE ${year} -> ${requiresCleaning ? 'Chờ vệ sinh' : 'Chờ hạ vỏ'}`,
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
  // DEC-131: khóa do chính danh sách XUẤT TÀU không chặn xuất tàu; khóa thường thì phải mở khóa trước
  if (c.isOnHold && c.holdSource !== 'VESSEL_EXPORT') throw new Error(`Container ${c.containerNo} đang bị KHÓA (${c.holdReason || ''}) — Văn phòng phải mở khóa trước khi xuất tàu.`);
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
    isOnHold: false,
    holdSource: undefined,
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
export function vesselListProgress(list: VesselList): { total: number; done: number; inspected: number; pending: number; skipped: number } {
  const done = list.items.filter((i) => i.status === 'DONE').length;
  const inspected = list.items.filter((i) => i.status === 'INSPECTED').length;
  const skipped = list.items.filter((i) => i.status === 'SKIPPED').length;
  return { total: list.items.length, done, inspected, skipped, pending: list.items.length - done - inspected - skipped };
}

// Trạng thái danh sách tàu hiển thị (DEC-165): ĐANG THỰC HIỆN / ĐÃ DUYỆT / DUYỆT THIẾU (có cont không kịp)
export function vesselListStatusLabel(list: VesselList): string {
  if (list.status !== 'APPROVED') return 'ĐANG THỰC HIỆN';
  return list.items.some((i) => i.status === 'SKIPPED') ? 'DUYỆT THIẾU' : 'ĐÃ DUYỆT';
}

// DEC-131: duyệt được cả khi CHƯA làm đủ — bắt buộc ghi LÝ DO; cont chưa tác nghiệp (PENDING) bị gạch đi (SKIPPED).
//   Xuất tàu: cont không kịp tự mở khóa + xóa ghi chú, trở lại tồn bãi bình thường.
//   Nhập tàu: cont đã Giám định (đang chờ hạ) vẫn đi tiếp luồng hạ bãi; chỉ cont chưa về mới bị gạch.
export function approveVesselList(state: DepotState, input: { listId: string; mode: VesselMode; reason?: string }): DepotState {
  assertPermission(state, 'VESSEL_LIST_MANAGE', `chỉ Văn phòng / Quản lý được duyệt ${label(input.mode)}.`);
  const list = findList(state, input.listId, input.mode);
  if (list.status === 'APPROVED') throw new Error('Danh sách đã được duyệt.');
  const p = vesselListProgress(list);
  if (p.total === 0) throw new Error('Danh sách không có container nào.');
  const incomplete = p.done < p.total;
  const reason = input.reason?.trim();
  if (incomplete && !reason) throw new Error(`Chưa ${label(list.mode)} đủ (${p.done}/${p.total}) — bắt buộc ghi LÝ DO khi duyệt.`);
  const skippedItems = list.items.filter((i) => i.status === 'PENDING');
  let next = state;
  if (list.mode === 'XUAT_TAU') for (const i of skippedItems) if (i.containerId) next = vesselUnlock(next, i.containerId);
  const now = nowIso();
  next = {
    ...next,
    vesselLists: next.vesselLists.map((l) =>
      l.id === list.id
        ? {
            ...l,
            status: 'APPROVED' as const,
            approvedBy: state.currentUser.fullName,
            approvedAt: now,
            approveNote: incomplete ? reason : undefined,
            items: l.items.map((i) => (i.status === 'PENDING' ? { ...i, status: 'SKIPPED' as const } : i)),
          }
        : l
    ),
  };
  return appendAudit(
    next,
    list.mode === 'NHAP_TAU' ? 'NHAP_TAU_DUYET' : 'XUAT_TAU_DUYET',
    'VESSEL',
    list.vesselName,
    incomplete
      ? `Duyệt ${label(list.mode)} tàu ${list.vesselName} CHƯA ĐỦ: ${p.done}/${p.total} container${skippedItems.length ? `, gạch ${skippedItems.length} cont không kịp (${skippedItems.map((i) => i.containerNo).join(', ')})` : ''}. Lý do: ${reason}`
      : `Duyệt ${label(list.mode)} thành công tàu ${list.vesselName}: ${p.total} container`
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

// DEC-070: danh sách container luôn xếp theo SIZE (20 → 40 → 45...) rồi số container A→Z
export function sortVesselItems<T extends { containerNo: string; size: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => Number(a.size) - Number(b.size) || a.containerNo.localeCompare(b.containerNo));
}

// ---------------------------------------------------------------------------
// THEO DÕI TÁC NGHIỆP HIỆN TRƯỜNG (DEC-071): mỗi bộ phận biết cont nào mình phải làm / đã làm / chưa tới lượt
// ---------------------------------------------------------------------------
export type VesselFieldStep = 'NT_INSPECT' | 'NT_PLACE' | 'XT_EXPORT';
export type VesselStepStatus = 'TODO' | 'WAIT' | 'DONE';

export interface VesselStepInfo {
  status: VesselStepStatus;
  note: string;      // Mô tả ngắn hiển thị trên thẻ
  by?: string;
  at?: string;
  truckNo?: string;
}

export function vesselStepInfo(state: DepotState, step: VesselFieldStep, item: VesselListItem): VesselStepInfo {
  if (step === 'NT_INSPECT') {
    return item.status === 'PENDING'
      ? { status: 'TODO', note: 'Chờ giám định' }
      : { status: 'DONE', note: item.status === 'DONE' ? 'Đã giám định • đã hạ bãi' : 'Đã giám định', by: item.inspectedBy, at: item.inspectedAt, truckNo: item.truckNo };
  }
  if (step === 'NT_PLACE') {
    if (item.status === 'DONE') return { status: 'DONE', note: 'Đã hạ bãi', by: item.doneBy, at: item.doneAt, truckNo: item.truckNo };
    if (item.status === 'PENDING') return { status: 'WAIT', note: 'Chưa về — chờ Giám định' };
    const c = state.containers.find((x) => x.id === item.containerId);
    if (c?.needsCleaning) return { status: 'WAIT', note: 'Chờ Vệ sinh xong', truckNo: item.truckNo };
    return { status: 'TODO', note: 'Chờ hạ bãi', truckNo: item.truckNo };
  }
  return item.status === 'DONE'
    ? { status: 'DONE', note: 'Đã xuất tàu', by: item.doneBy, at: item.doneAt, truckNo: item.truckNo }
    : { status: 'TODO', note: 'Chờ xuất' };
}

export interface VesselStepSummary {
  total: number;
  todo: number;
  wait: number;
  done: number;
  mine: number;                          // số cont người đang dùng đã làm ở bước này
  byTruck: { truckNo: string; count: number }[]; // số cont đã làm theo từng xe
}

export function vesselStepSummary(state: DepotState, step: VesselFieldStep, list: VesselList): VesselStepSummary {
  const infos = list.items.map((i) => vesselStepInfo(state, step, i));
  const done = infos.filter((x) => x.status === 'DONE');
  const counts = new Map<string, number>(list.truckNos.map((t) => [t, 0]));
  for (const d of done) if (d.truckNo) counts.set(d.truckNo, (counts.get(d.truckNo) || 0) + 1);
  return {
    total: infos.length,
    todo: infos.filter((x) => x.status === 'TODO').length,
    wait: infos.filter((x) => x.status === 'WAIT').length,
    done: done.length,
    mine: done.filter((x) => x.by === state.currentUser.fullName).length,
    byTruck: Array.from(counts, ([truckNo, count]) => ({ truckNo, count })),
  };
}

// ---------------------------------------------------------------------------
// DEC-083: TÁC NGHIỆP hiện tại của 1 cont — để Vệ sinh / Xe nâng biết đang làm việc gì
//   NT- → NHẬP TÀU (+ tên tàu); trong danh sách xuất tàu → XUẤT TÀU (+ tên tàu);
//   đã lập lệnh cấp → CẤP VỎ; còn lại → HẠ VỎ.
// ---------------------------------------------------------------------------
export type ContainerOperationCode = 'HA_VO' | 'CAP_VO' | 'NHAP_TAU' | 'XUAT_TAU' | 'DOI_CONT';
export const CONTAINER_OPERATION_LABELS: Record<ContainerOperationCode, string> = {
  HA_VO: 'HẠ VỎ',
  CAP_VO: 'CẤP VỎ',
  NHAP_TAU: 'NHẬP TÀU',
  XUAT_TAU: 'XUẤT TÀU',
  DOI_CONT: 'ĐỔI CONT', // DEC-185: cont trả về sau ĐỔI CONTAINER — Xe nâng hạ lại
};

export interface ContainerOperation {
  code: ContainerOperationCode;
  label: string;
  dossierCode: string;   // mã hồ sơ của tác nghiệp (HV- / CV- / NT- / XT-)
  vesselName?: string;   // Nhập tàu / Xuất tàu
  truckNo?: string;      // Nhập tàu / Xuất tàu: số xe trong danh sách tàu — hiện ở Vệ sinh / Xe nâng
}

export function containerOperation(state: DepotState, c: ContainerRecord): ContainerOperation {
  const lists = state.vesselLists || [];
  if (c.vesselExportItemId) {
    const list = lists.find((l) => l.items.some((i) => i.id === c.vesselExportItemId));
    const item = list?.items.find((i) => i.id === c.vesselExportItemId);
    return { code: 'XUAT_TAU', label: CONTAINER_OPERATION_LABELS.XUAT_TAU, dossierCode: item?.dossierCode || c.masterDossierCode, vesselName: list?.vesselName, truckNo: item?.truckNo };
  }
  if (c.swapReturn) {
    return { code: 'DOI_CONT', label: CONTAINER_OPERATION_LABELS.DOI_CONT, dossierCode: c.swapReturn.gateOutCode };
  }
  if (c.status === 'ALLOCATED' && c.outDossierCode) {
    return { code: 'CAP_VO', label: CONTAINER_OPERATION_LABELS.CAP_VO, dossierCode: c.outDossierCode };
  }
  if (c.masterDossierCode.startsWith('NT-')) {
    const list = lists.find((l) => l.mode === 'NHAP_TAU' && l.items.some((i) => i.dossierCode === c.masterDossierCode));
    const item = list?.items.find((i) => i.dossierCode === c.masterDossierCode);
    return { code: 'NHAP_TAU', label: CONTAINER_OPERATION_LABELS.NHAP_TAU, dossierCode: c.masterDossierCode, vesselName: list?.vesselName, truckNo: item?.truckNo };
  }
  return { code: 'HA_VO', label: CONTAINER_OPERATION_LABELS.HA_VO, dossierCode: c.masterDossierCode };
}

// ============================================================================
// PHIẾU EEIR NHẬP TÀU / XUẤT TÀU (K80) — mã QR + LỘ TRÌNH như phiếu tác nghiệp Hạ vỏ / Cấp vỏ (DEC-163)
// QR = QR-<mã hồ sơ NT- / XT-> (DEC-057). Trạng thái từng bước lấy từ dữ liệu thật — không ghi gì thêm.
// ============================================================================
export interface VesselRouteStep {
  key: string;
  dept: string;
  action: string;
  done: boolean;
  doneAt?: string;
  doneBy?: string;
}

export function vesselQrCode(item: VesselListItem): string {
  return item.dossierCode ? `QR-${item.dossierCode}` : '';
}

export function getVesselRoute(state: DepotState, list: VesselList, item: VesselListItem): VesselRouteStep[] {
  const approved = list.status === 'APPROVED';
  if (list.mode === 'XUAT_TAU') {
    return [
      { key: 'OFFICE_LIST', dept: 'VĂN PHÒNG', action: 'Lập danh sách xuất tàu', done: true, doneAt: list.createdAt, doneBy: list.createdBy },
      { key: 'FORKLIFT_EXPORT', dept: 'XE NÂNG', action: 'Quét mã • xuất cont lên xe', done: item.status === 'DONE', doneAt: item.doneAt, doneBy: item.doneBy },
      { key: 'OFFICE_APPROVE', dept: 'VĂN PHÒNG', action: 'Duyệt xuất tàu', done: approved, doneAt: list.approvedAt, doneBy: list.approvedBy },
    ];
  }
  const code = item.dossierCode;
  const cleaningWo = code ? state.workOrders.find((w) => w.masterDossierCode === code && w.category === 'CLEANING') : undefined;
  const placement = code ? state.locationHistory.find((h) => h.masterDossierCode === code && h.actionType === 'INITIAL_BLOCK') : undefined;
  const steps: VesselRouteStep[] = [
    { key: 'INSPECT', dept: 'GIÁM ĐỊNH', action: 'Giám định cont nhập tàu', done: Boolean(item.inspectedAt), doneAt: item.inspectedAt, doneBy: item.inspectedBy },
  ];
  if (cleaningWo) {
    steps.push({ key: 'CLEANING', dept: 'VỆ SINH', action: `Quét mã • ${(item.cleaningItems || []).join(' + ')}`, done: cleaningWo.workStatus === 'COMPLETED', doneAt: cleaningWo.completedAt, doneBy: cleaningWo.completedBy });
  }
  steps.push(
    { key: 'FORKLIFT_PLACE', dept: 'XE NÂNG', action: 'Quét mã • hạ vỏ', done: Boolean(placement), doneAt: placement?.performedAt, doneBy: placement?.performedBy },
    { key: 'OFFICE_APPROVE', dept: 'VĂN PHÒNG', action: 'Duyệt nhập tàu', done: approved, doneAt: list.approvedAt, doneBy: list.approvedBy }
  );
  return steps;
}
