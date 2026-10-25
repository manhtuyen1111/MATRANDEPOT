import { ContainerRecord, YardBlock } from '../types/depot';
import type { DepotState } from './depotStore';
import { can, PermissionKey } from './permissions';

export function nowIso(): string {
  return new Date().toISOString();
}

let idSeq = 0;
export function newId(prefix: string): string {
  idSeq = (idSeq + 1) % 1_000_000;
  return `${prefix}-${Date.now().toString(36)}-${idSeq.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 6)}`;
}

export const SYSTEM_ACTOR = 'HỆ THỐNG';

export function appendAudit(
  state: DepotState,
  actionCode: string,
  entityType: string,
  entityCode: string,
  summary: string,
  masterDossierCode?: string,
  actor?: { name: string; role: 'SYSTEM' }
): DepotState {
  const entry = {
    id: newId('aud'),
    masterDossierCode,
    actorName: actor?.name || state.currentUser.fullName,
    actorRole: actor?.role || state.currentUser.roles[0] || 'OFFICE',
    actionCode,
    entityType,
    entityCode,
    summary,
    createdAt: nowIso(),
  };
  return {
    ...state,
    auditLogs: [entry, ...state.auditLogs],
  };
}

export function assertPermission(state: DepotState, permission: PermissionKey, message: string): void {
  if (!can(state.currentUser, permission)) {
    throw new Error(`Không đủ quyền: ${message}`);
  }
}

// Mỗi số container chỉ có tối đa 1 lượt lưu bãi đang mở; các lượt đã OUT được giữ làm lịch sử
export function findActiveContainer(state: DepotState, containerNo?: string): ContainerRecord | undefined {
  const no = containerNo?.trim().toUpperCase();
  if (!no) return undefined;
  return state.containers.find((c) => c.containerNo === no && c.status !== 'GATED_OUT');
}

export function findActiveContainerByCode(state: DepotState, rawCode?: string): ContainerRecord | undefined {
  const code = rawCode?.trim().toUpperCase();
  if (!code) return undefined;
  return state.containers.find(
    (c) =>
      c.status !== 'GATED_OUT' &&
      (c.activeQrCode?.toUpperCase() === code ||
        c.masterDossierCode?.toUpperCase() === code ||
        c.outDossierCode?.toUpperCase() === code ||
        c.containerNo.toUpperCase() === code)
  );
}

export function updateContainerById(
  state: DepotState,
  containerId: string,
  patch: Partial<ContainerRecord>
): DepotState {
  return {
    ...state,
    containers: state.containers.map((c) => (c.id === containerId ? { ...c, ...patch } : c)),
  };
}

export function formatLocation(c: {
  currentBlock: string | null;
  currentBay: string | null;
  currentRow: string | null;
  currentTier: string | null;
}): string {
  if (!c.currentBlock) return '-';
  const parts = [c.currentBay, c.currentRow, c.currentTier];
  if (parts.every(Boolean)) return `${c.currentBlock} / ${parts.join('-')}`;
  // DEC-082: Block chỉ cấu hình một phần (VD chỉ Bay) → ghi rõ nhãn từng chiều
  const labeled = [['Bay', c.currentBay], ['Row', c.currentRow], ['Tier', c.currentTier]].filter(([, v]) => v).map(([k, v]) => `${k} ${v}`);
  return labeled.length ? `${c.currentBlock} / ${labeled.join(' • ')}` : c.currentBlock;
}

export interface SlotInput {
  blockCode: string;
  bay?: string;
  row?: string;
  tier?: string;
}

export interface ValidSlot {
  block: string;
  bay: string | null;
  row: string | null;
  tier: string | null;
}

// DEC-082: chiều vị trí Block có dùng thực tế (giá trị tối đa > 0). Chiều không cấu hình → không hiện, không nhập.
export type SlotDimension = 'bay' | 'row' | 'tier';
export const SLOT_DIMENSION_LABELS: Record<SlotDimension, string> = { bay: 'Bay', row: 'Row', tier: 'Tier' };

export function blockDimensions(block: Pick<YardBlock, 'maxBay' | 'maxRow' | 'maxTier'>): { key: SlotDimension; max: number }[] {
  return ([
    ['bay', block.maxBay],
    ['row', block.maxRow],
    ['tier', block.maxTier],
  ] as [SlotDimension, number][])
    .filter(([, max]) => Number(max) > 0)
    .map(([key, max]) => ({ key, max: Number(max) }));
}

// Kiểm tra vị trí đích theo cấu hình Block (DEC-005, DEC-082, YARD-003) và chống trùng ô
//   - Chiều Block có cấu hình → BẮT BUỘC nhập, trong giới hạn 1 → tối đa.
//   - Chiều không cấu hình → bỏ qua (không lưu).
//   - Vị trí không đủ 4 phần (Block chỉ có tên, hoặc chỉ Bay / Bay + Row...) → nhiều cont đặt chung (DEC-087).
export function validateTargetSlot(
  state: DepotState,
  container: ContainerRecord,
  input: SlotInput
): ValidSlot {
  const block: YardBlock | undefined = state.yardBlocks.find((b) => b.blockCode === input.blockCode);
  if (!block) throw new Error(`Block "${input.blockCode}" không hợp lệ (YARD-003).`);

  const dims = blockDimensions(block);
  const raw: Record<SlotDimension, string | null> = {
    bay: input.bay?.trim() || null,
    row: input.row?.trim() || null,
    tier: input.tier?.trim() || null,
  };
  const value: Record<SlotDimension, string | null> = { bay: null, row: null, tier: null };
  const missing = dims.filter((d) => !raw[d.key]).map((d) => SLOT_DIMENSION_LABELS[d.key]);
  if (missing.length) {
    throw new Error(`Block ${block.blockCode} có cấu hình ${dims.map((d) => SLOT_DIMENSION_LABELS[d.key]).join(' / ')} — vui lòng nhập đủ: ${missing.join(', ')} (YARD-003).`);
  }
  for (const d of dims) {
    const v = raw[d.key]!;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > d.max) {
      throw new Error(`${SLOT_DIMENSION_LABELS[d.key]} ${v} nằm ngoài cấu hình của ${block.blockCode} (1 → ${d.max}) (YARD-003).`);
    }
    value[d.key] = v;
  }
  // DEC-087: chỉ chặn trùng khi vị trí ĐỦ Block + Bay + Row + Tier; thiếu chiều thì 1 vị trí chứa được nhiều cont
  if (dims.length === 3) {
    const occupied = state.containers.find(
      (c) =>
        c.id !== container.id &&
        c.status !== 'GATED_OUT' &&
        c.currentBlock === block.blockCode &&
        c.currentBay === value.bay &&
        c.currentRow === value.row &&
        c.currentTier === value.tier
    );
    if (occupied) {
      throw new Error(
        `Ô vị trí ${formatLocation({ currentBlock: block.blockCode, currentBay: value.bay, currentRow: value.row, currentTier: value.tier })} đang có container ${occupied.containerNo} (YARD-003).`
      );
    }
  }
  return { block: block.blockCode, ...value };
}

// TIẾN ĐỘ của một container trong bãi (dùng cho Tồn vỏ, Đảo chuyển, Cấp vỏ)
export type ContainerProgress =
  | 'CHO_HA_VO'
  | 'CHO_VE_SINH'
  | 'CHO_BAO_GIA'
  | 'CHO_SUA_CHUA'
  | 'DA_LAP_LENH_CAP'
  | 'SAN_SANG';

export const PROGRESS_LABELS: Record<ContainerProgress, string> = {
  CHO_HA_VO: 'Chờ hạ vỏ',
  CHO_VE_SINH: 'Chờ vệ sinh',
  CHO_BAO_GIA: 'Chờ báo giá',
  CHO_SUA_CHUA: 'Chờ sửa chữa',
  DA_LAP_LENH_CAP: 'Đã lập lệnh cấp',
  SAN_SANG: 'Sẵn sàng',
};

export function getContainerProgress(c: ContainerRecord): ContainerProgress[] {
  const tags: ContainerProgress[] = [];
  if (c.status === 'WAITING_PLACEMENT') tags.push('CHO_HA_VO');
  if (c.needsCleaning) tags.push('CHO_VE_SINH');
  if (c.needsQuotation) tags.push('CHO_BAO_GIA');
  if (c.needsRepair) tags.push('CHO_SUA_CHUA');
  if (c.status === 'ALLOCATED') tags.push('DA_LAP_LENH_CAP');
  if (tags.length === 0 && c.status === 'IN_YARD') tags.push('SAN_SANG');
  return tags;
}

export function normalizeContainerNo(raw: string): string {
  const clean = raw.trim().toUpperCase();
  if (!/^[A-Z]{4}\d{7}$/.test(clean)) {
    throw new Error('SỐ CONTAINER không hợp lệ (chuẩn 4 chữ cái + 7 chữ số, ví dụ MSKU4089123).');
  }
  return clean;
}

// SĐT lái xe: 9–11 chữ số (cho phép khoảng trắng, dấu chấm, gạch nối, tiền tố +84)
export function normalizeDriverPhone(raw: string): string {
  const compact = raw.trim().replace(/[\s.-]/g, '');
  const digits = compact.startsWith('+84') ? `0${compact.slice(3)}` : compact;
  if (!/^\d{9,11}$/.test(digits)) {
    throw new Error('SĐT LÁI XE không hợp lệ (9–11 chữ số, ví dụ 0912345678).');
  }
  return digits;
}

// LƯU BÃI (DEC-067): số ngày lịch từ ngày gate in đến hôm nay (ngày hạ vỏ = 0), số nguyên
export function storageDays(gateInAt: string, now: Date = new Date()): number {
  const d = new Date(gateInAt);
  if (Number.isNaN(d.getTime())) return 0;
  const start = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const end = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

// Tách danh sách số container dán hàng loạt (xuống dòng, dấu phẩy, chấm phẩy, khoảng trắng)
export function parseContainerList(text: string): string[] {
  return Array.from(new Set(text.toUpperCase().split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean)));
}
