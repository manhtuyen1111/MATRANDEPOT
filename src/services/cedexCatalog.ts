// ============================================================================
// CODE CEDEX theo hãng tàu (DEC-206 — Danh mục chung → Sửa chữa → tab CODE CEDEX). Chỉ ADMIN sửa; khối Văn phòng xem.
//   MÃ VỊ TRÍ / MÃ HƯ HỎNG / MÃ VẬT LIỆU: Mã | Tên | Ghi chú | Trạng thái
//   MÃ SỬA CHỮA: đúng mẫu bảng giá hãng (AEMS Maersk) — Item Name | Repair Mode | Repair Name | Max Qty per work order |
//     Fixed man hour per work order | Repair Code | Material Rate (Excluding VAT)
// Mọi thêm / sửa / ngừng dùng / nhập Excel đi qua upsertCedexCodes / upsertRepairCodes (1 dòng hay nhiều dòng như nhau).
// Database khớp: catalog_upsert_cedex_codes / catalog_upsert_repair_codes (migration 20261127000001).
// Dùng cho Báo giá theo AEMS (Damage Code + Repair Code + Repair Loc code) — bước sau (docs/design/BAO_GIA_AEMS.md).
// ============================================================================
import type { CedexCode, CedexCodeKind, RepairCode } from '../types/depot';
import { CEDEX_CODE_KIND_LABELS } from '../types/depot';
import type { DepotState } from './depotStore';
import { appendAudit, newId } from './core';
import { assertAdmin } from './depotOperations';

export const CEDEX_CODE_RE = /^[A-Z0-9]{1,10}$/;
export const REPAIR_ITEM_RE = /^[A-Z0-9-]{1,20}$/;
export const REPAIR_FIELD_RE = /^([A-Z0-9]{1,10}|-)$/; // Repair Mode / Repair Code: mã hoặc "-" (không áp dụng)
export const CEDEX_NAME_MAX = 255;

export type CedexCodeInput = { code: string; name: string; note?: string; isActive?: boolean };
export type RepairCodeInput = {
  itemName: string;
  repairMode: string;
  repairName: string;
  maxQty?: number | null;
  manHour: number;
  repairCode: string;
  materialRate: number;
  isActive?: boolean;
};

const up = (v?: string) => (v || '').trim().toUpperCase();
const isMoney = (n: number) => Number.isFinite(n) && n >= 0 && Math.round(n * 100) === Number((n * 100).toFixed(6));

function assertLine(state: DepotState, line: string) {
  if (!state.partners.some((p) => p.isShippingLine && p.code === line)) throw new Error('Vui lòng chọn HÃNG TÀU theo Danh mục chung.');
}

// Lỗi của 1 dòng (null = hợp lệ) — dùng cho xem trước khi nhập Excel và khi lưu
export function cedexCodeProblem(r: CedexCodeInput): string | null {
  if (!CEDEX_CODE_RE.test(up(r.code))) return 'Mã gồm 1–10 chữ / số (không dấu cách).';
  if (!r.name?.trim()) return 'Thiếu tên.';
  if (r.name.trim().length > CEDEX_NAME_MAX || (r.note || '').trim().length > CEDEX_NAME_MAX) return `Tên / ghi chú tối đa ${CEDEX_NAME_MAX} ký tự.`;
  return null;
}

export function repairCodeProblem(r: RepairCodeInput): string | null {
  if (!REPAIR_ITEM_RE.test(up(r.itemName))) return 'Item Name gồm 1–20 chữ / số / gạch (VD DR001).';
  if (!REPAIR_FIELD_RE.test(up(r.repairMode))) return 'Repair Mode là mã 1–10 chữ / số hoặc "-".';
  if (!r.repairName?.trim()) return 'Thiếu Repair Name.';
  if (r.repairName.trim().length > CEDEX_NAME_MAX) return `Repair Name tối đa ${CEDEX_NAME_MAX} ký tự.`;
  if (r.maxQty != null && !(Number.isInteger(r.maxQty) && r.maxQty >= 1)) return 'Max Qty là số nguyên ≥ 1 (bỏ trống = không giới hạn).';
  if (!isMoney(r.manHour)) return 'Fixed man hour là số ≥ 0, tối đa 2 số lẻ.';
  if (!REPAIR_FIELD_RE.test(up(r.repairCode))) return 'Repair Code là mã 1–10 chữ / số hoặc "-".';
  if (!isMoney(r.materialRate)) return 'Material Rate là số ≥ 0, tối đa 2 số lẻ.';
  return null;
}

function assertUnique<T>(rows: T[], key: (r: T) => string, label: string) {
  const seen = new Set<string>();
  for (const r of rows) {
    const k = key(r);
    if (seen.has(k)) throw new Error(`${label} ${k} bị trùng trong danh sách lưu.`);
    seen.add(k);
  }
}

// Thêm / sửa / ngừng dùng (trùng hãng + loại + mã → cập nhật dòng cũ)
export function upsertCedexCodes(state: DepotState, input: { shippingLineCode: string; kind: CedexCodeKind; rows: CedexCodeInput[] }): DepotState {
  assertAdmin(state);
  const line = input.shippingLineCode?.trim();
  assertLine(state, line);
  if (!CEDEX_CODE_KIND_LABELS[input.kind]) throw new Error('Loại mã không hợp lệ.');
  if (!input.rows.length) throw new Error('Không có dòng nào để lưu.');
  input.rows.forEach((r, i) => {
    const p = cedexCodeProblem(r);
    if (p) throw new Error(`Dòng ${i + 1} (${r.code || '-'}): ${p}`);
  });
  const rows = input.rows.map((r) => ({ code: up(r.code), name: r.name.trim(), note: r.note?.trim() || undefined, isActive: r.isActive ?? true }));
  assertUnique(rows, (r) => r.code, 'Mã');
  let list = [...(state.cedexCodes || [])];
  for (const r of rows) {
    const i = list.findIndex((c) => c.shippingLineCode === line && c.kind === input.kind && c.code === r.code);
    const item: CedexCode = { id: i >= 0 ? list[i].id : newId('cdx'), shippingLineCode: line, kind: input.kind, ...r };
    if (i >= 0) list[i] = item;
    else list = [...list, item];
  }
  const label = CEDEX_CODE_KIND_LABELS[input.kind];
  return appendAudit({ ...state, cedexCodes: list }, 'ADMIN_UPSERT_CEDEX', 'CATALOG', `${line}-${input.kind}`,
    `[Admin Danh mục chung] CODE CEDEX ${label} hãng ${line}: lưu ${rows.length} mã${rows.length <= 3 ? ` (${rows.map((r) => r.code).join(', ')})` : ''}`);
}

export function upsertRepairCodes(state: DepotState, input: { shippingLineCode: string; rows: RepairCodeInput[] }): DepotState {
  assertAdmin(state);
  const line = input.shippingLineCode?.trim();
  assertLine(state, line);
  if (!input.rows.length) throw new Error('Không có dòng nào để lưu.');
  input.rows.forEach((r, i) => {
    const p = repairCodeProblem(r);
    if (p) throw new Error(`Dòng ${i + 1} (${r.itemName || '-'}): ${p}`);
  });
  const rows = input.rows.map((r) => ({
    itemName: up(r.itemName), repairMode: up(r.repairMode), repairName: r.repairName.trim(), maxQty: r.maxQty ?? undefined,
    manHour: r.manHour, repairCode: up(r.repairCode), materialRate: r.materialRate, isActive: r.isActive ?? true,
  }));
  assertUnique(rows, (r) => r.itemName, 'Item Name');
  let list = [...(state.repairCodes || [])];
  for (const r of rows) {
    const i = list.findIndex((c) => c.shippingLineCode === line && c.itemName === r.itemName);
    const item: RepairCode = { id: i >= 0 ? list[i].id : newId('rpc'), shippingLineCode: line, ...r };
    if (i >= 0) list[i] = item;
    else list = [...list, item];
  }
  return appendAudit({ ...state, repairCodes: list }, 'ADMIN_UPSERT_REPAIR_CODE', 'CATALOG', `${line}-REPAIR`,
    `[Admin Danh mục chung] MÃ SỬA CHỮA hãng ${line}: lưu ${rows.length} mã${rows.length <= 3 ? ` (${rows.map((r) => r.itemName).join(', ')})` : ''}`);
}

// Danh sách theo hãng (+ loại), sắp theo mã
export const cedexCodesOf = (state: DepotState, line: string, kind: CedexCodeKind) =>
  (state.cedexCodes || []).filter((c) => c.shippingLineCode === line && c.kind === kind).sort((a, b) => a.code.localeCompare(b.code));
export const repairCodesOf = (state: DepotState, line: string) =>
  (state.repairCodes || []).filter((c) => c.shippingLineCode === line).sort((a, b) => a.itemName.localeCompare(b.itemName));

// ---------------------------------------------------------------------------
// EXCEL — cột màn hình = cột file (DEC-129). Nhập: tìm dòng tiêu đề trong 10 dòng đầu, đọc chữ hiển thị (giữ số 0 đầu: 0003)
// ---------------------------------------------------------------------------
export const CEDEX_COLUMNS = ['Mã', 'Tên', 'Ghi chú', 'Trạng thái'];
export const REPAIR_COLUMNS = ['Item Name', 'Repair Mode', 'Repair Name', 'Max Qty per work order', 'Fixed man hour applicable per work order', 'Repair Code', 'Material Rate (Excluding VAT)', 'Trạng thái'];
const ACTIVE_TEXT = 'Đang dùng';
const INACTIVE_TEXT = 'Ngừng dùng';
export const activeText = (on: boolean) => (on ? ACTIVE_TEXT : INACTIVE_TEXT);

export const cedexSheetRows = (codes: CedexCode[]) => codes.map((c) => [c.code, c.name, c.note || '', activeText(c.isActive)]);
export const repairSheetRows = (codes: RepairCode[]) =>
  codes.map((c) => [c.itemName, c.repairMode, c.repairName, c.maxQty ?? '', c.manHour, c.repairCode, c.materialRate, activeText(c.isActive)]);

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]/g, '');
// Tên cột chấp nhận (tiếng Việt / tiếng Anh, không phân biệt hoa thường, dấu cách, xuống dòng)
const CEDEX_HEADERS: Record<string, string[]> = { code: ['ma', 'code'], name: ['ten', 'name', 'description'], note: ['ghichu', 'note', 'notes'], status: ['trangthai', 'status'] };
const REPAIR_HEADERS: Record<string, string[]> = {
  itemName: ['itemname'], repairMode: ['repairmode', 'mode'], repairName: ['repairname'], maxQty: ['maxqtyperworkorder', 'maxqty'],
  manHour: ['fixedmanhourapplicableperworkorder', 'fixedmanhour', 'manhour'], repairCode: ['repaircode'],
  materialRate: ['materialrateexcludingvat', 'materialrate'], status: ['trangthai', 'status'],
};

export interface ImportPreview<T> {
  rows: T[];
  errors: { row: number; message: string }[]; // row = số dòng trong file Excel
  rounded?: number[]; // dòng Excel có số > 2 số lẻ (ô chỉ HIỂN THỊ làm tròn) → đã làm tròn 2 số lẻ như Excel hiển thị
}

const parseStatus = (s: string) => !/^(ngung|ngungdung|inactive|n|0|khong)$/.test(norm(s));
const parseNumber = (s: string): number => {
  const t = s.replace(/\s/g, '');
  if (!t) return NaN;
  // 9,215.85 / 28,000.00 (dấu phẩy nghìn) hoặc 9.215,85 (kiểu Việt)
  const v = /,\d{1,2}$/.test(t) && t.includes('.') ? t.replace(/\./g, '').replace(',', '.') : t.replace(/,/g, '');
  return Number(v);
};

type Grid = string[][];
async function readGrid(buffer: ArrayBuffer): Promise<Grid> {
  const { default: ExcelJS } = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const ws = wb.worksheets[0];
  if (!ws) throw new Error('File Excel không có trang tính nào.');
  const grid: Grid = [];
  ws.eachRow({ includeEmpty: true }, (row, n) => {
    const cells: string[] = [];
    row.eachCell({ includeEmpty: true }, (cell, c) => {
      // Mã lưu dạng số + định dạng "0000" (hiện 0003) → giữ số 0 đầu
      const fmt = cell.numFmt || '';
      cells[c - 1] =
        typeof cell.value === 'number' && /^0+$/.test(fmt) ? String(cell.value).padStart(fmt.length, '0') : (cell.text ?? '').toString().trim();
    });
    grid[n - 1] = cells;
  });
  return grid.map((r) => r || []);
}

function locate(grid: Grid, headers: Record<string, string[]>, required: string[]) {
  for (let r = 0; r < Math.min(grid.length, 10); r++) {
    const keys = (grid[r] || []).map((h) => norm(h || ''));
    const idx: Record<string, number> = {};
    for (const [field, names] of Object.entries(headers)) {
      const i = keys.findIndex((k) => names.includes(k));
      if (i >= 0) idx[field] = i;
    }
    if (required.every((f) => idx[f] !== undefined)) return { headerRow: r, idx };
  }
  return null;
}

export function parseCedexGrid(grid: Grid): ImportPreview<CedexCodeInput> {
  const found = locate(grid, CEDEX_HEADERS, ['code', 'name']);
  if (!found) throw new Error(`Không thấy dòng tiêu đề — file cần các cột: ${CEDEX_COLUMNS.join(' | ')}.`);
  const { headerRow, idx } = found;
  const out: ImportPreview<CedexCodeInput> = { rows: [], errors: [] };
  const get = (r: string[], f: string) => (idx[f] === undefined ? '' : r[idx[f]] || '');
  for (let n = headerRow + 1; n < grid.length; n++) {
    const r = grid[n] || [];
    if (r.every((v) => !v)) continue;
    const row: CedexCodeInput = { code: up(get(r, 'code')), name: get(r, 'name'), note: get(r, 'note') || undefined, isActive: parseStatus(get(r, 'status')) };
    const p = cedexCodeProblem(row);
    if (p) out.errors.push({ row: n + 1, message: `${row.code || '-'}: ${p}` });
    else if (out.rows.some((x) => x.code === row.code)) out.errors.push({ row: n + 1, message: `${row.code}: trùng mã trong file.` });
    else out.rows.push(row);
  }
  return out;
}

export function parseRepairGrid(grid: Grid): ImportPreview<RepairCodeInput> {
  const found = locate(grid, REPAIR_HEADERS, ['itemName', 'repairName', 'repairCode']);
  if (!found) throw new Error(`Không thấy dòng tiêu đề — file cần các cột: ${REPAIR_COLUMNS.slice(0, 7).join(' | ')}.`);
  const { headerRow, idx } = found;
  const out: ImportPreview<RepairCodeInput> = { rows: [], errors: [], rounded: [] };
  // Excel thường lưu số đầy đủ (VD công thức 1234.5678) nhưng ô định dạng 0.00 chỉ hiện 1,234.57 → lấy đúng số đang hiển thị
  const round2 = (v: number, n: number) => {
    const r = Math.round(v * 100) / 100;
    if (Number.isFinite(v) && Math.abs(r - v) > 1e-9 && !out.rounded!.includes(n)) out.rounded!.push(n);
    return r;
  };
  const get = (r: string[], f: string) => (idx[f] === undefined ? '' : r[idx[f]] || '');
  for (let n = headerRow + 1; n < grid.length; n++) {
    const r = grid[n] || [];
    if (r.every((v) => !v)) continue;
    const qty = get(r, 'maxQty');
    const row: RepairCodeInput = {
      itemName: up(get(r, 'itemName')), repairMode: up(get(r, 'repairMode')) || '-', repairName: get(r, 'repairName'),
      maxQty: qty ? parseNumber(qty) : null, manHour: round2(parseNumber(get(r, 'manHour') || '0'), n + 1), repairCode: up(get(r, 'repairCode')) || '-',
      materialRate: round2(parseNumber(get(r, 'materialRate') || '0'), n + 1), isActive: parseStatus(get(r, 'status')),
    };
    const p = repairCodeProblem(row);
    if (p) out.errors.push({ row: n + 1, message: `${row.itemName || '-'}: ${p}` });
    else if (out.rows.some((x) => x.itemName === row.itemName)) out.errors.push({ row: n + 1, message: `${row.itemName}: trùng Item Name trong file.` });
    else out.rows.push(row);
  }
  return out;
}

export async function readCedexExcel(buffer: ArrayBuffer): Promise<ImportPreview<CedexCodeInput>> {
  return parseCedexGrid(await readGrid(buffer));
}
export async function readRepairExcel(buffer: ArrayBuffer): Promise<ImportPreview<RepairCodeInput>> {
  return parseRepairGrid(await readGrid(buffer));
}
