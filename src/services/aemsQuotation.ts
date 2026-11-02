// ============================================================================
// BÁO GIÁ THEO AEMS (DEC-207) — hãng bật features.aemsQuotation (MSK). Thay màn nhập "tình trạng + giờ công" (DEC-086).
//   1. Phiếu mới tự có dòng từ Giám định (eEIR): mỗi chỗ hư bên thứ 3 → 1 dòng T (Loc = CEDEX); có ảnh hao mòn → 1 dòng W.
//   2. LƯU (saveAemsQuotation) → tính lại toàn bộ (carriers/maersk/aems.ts), trạng thái Maersk = Draft.
//   3. Cập nhật trạng thái Maersk bằng tay (setAemsApproval) — sau này qua API sửa chữa Maersk.
//   4. Chỉ APPROVED mới XÁC NHẬN CHỜ SỬA CHỮA (kiểm tra ở confirmQuotationToRepair + trigger database).
// Database khớp: save_aems_quotation / set_aems_approval (migration 20261128000001).
// ============================================================================
import { AEMS_APPROVAL_LABELS, type AemsApproval, type AemsQuote, type ContainerRecord, type InspectionSurvey } from '../types/depot';
import type { DepotState } from './depotStore';
import { appendAudit, assertPermission, findActiveContainer, newId, nowIso, updateContainerById } from './core';
import { carrierUses } from './carriers/registry';
import { aemsCatalogOf, aemsLineText, computeAemsQuote, type AemsLineInput, type AemsQuoteInput } from './carriers/maersk/aems';

export const usesAemsQuotation = (lineCode?: string | null) => carrierUses(lineCode, 'aemsQuotation');

function quotedContainer(state: DepotState, containerNo: string): ContainerRecord {
  const c = findActiveContainer(state, containerNo);
  if (!c || !c.needsQuotation) throw new Error('Container không nằm trong hàng chờ Báo giá.');
  if (!usesAemsQuotation(c.shippingLineCode)) throw new Error(`Hãng ${c.shippingLineCode || '-'} không báo giá theo AEMS.`);
  return c;
}

// Tình trạng eEIR của lượt lưu bãi (Hạ vỏ / Nhập tàu)
export function containerSurvey(state: DepotState, c: ContainerRecord): InspectionSurvey | undefined {
  return (
    state.gateInOrders.find((o) => o.masterDossierCode === c.masterDossierCode)?.survey ||
    (state.vesselLists || []).flatMap((l) => l.items).find((i) => i.containerId === c.id)?.survey
  );
}

// Dòng gợi ý khi chưa có phiếu: chỗ hư bên thứ 3 → T (Loc sẵn); có ảnh hao mòn → 1 dòng W (Báo giá điền Loc)
export function aemsDraftLines(state: DepotState, c: ContainerRecord): AemsLineInput[] {
  if (c.aemsQuote) return c.aemsQuote.lines;
  const sv = containerSurvey(state, c);
  const lines: AemsLineInput[] = (sv?.damages || []).map((d) => ({ damageCode: '', repairCode: '', locCode: d.location, tpi: 'T', pcs: 1 }));
  if (sv?.wearTearPhotos.length) lines.push({ damageCode: '', repairCode: '', locCode: '', tpi: 'W', pcs: 1 });
  return lines;
}

// Xem trước tiền (giao diện) — cùng hàm tính với lúc lưu
export function previewAemsQuote(state: DepotState, lineCode: string, input: AemsQuoteInput) {
  return computeAemsQuote(aemsCatalogOf(state, lineCode), input, () => newId('aql'));
}

export function saveAemsQuotation(state: DepotState, input: AemsQuoteInput & { containerNo: string }): DepotState {
  assertPermission(state, 'QUOTATION', 'chỉ Bộ phận Báo giá được cập nhật báo giá.');
  const c = quotedContainer(state, input.containerNo);
  if (c.aemsQuote?.approval === 'APPROVED') throw new Error(`${c.containerNo}: Maersk đã duyệt (Approved) — không sửa phiếu; bấm XÁC NHẬN CHỜ SỬA CHỮA.`);
  const computed = computeAemsQuote(aemsCatalogOf(state, c.shippingLineCode), input, () => newId('aql'));
  const now = nowIso();
  const actor = state.currentUser.fullName;
  const quote: AemsQuote = { ...computed, approval: 'DRAFT', workOrderNo: c.aemsQuote?.workOrderNo, savedAt: now, savedBy: actor };
  const next = updateContainerById(state, c.id, {
    aemsQuote: quote,
    quotationItems: quote.lines.map(aemsLineText), // TÌNH TRẠNG SỬA CHỮA dùng tiếp ở Sửa chữa / hồ sơ / báo cáo
    quotationLaborHours: quote.totalHours,
    quotationAmount: quote.totalExclVat,
    quotationUpdatedBy: actor,
    quotationUpdatedAt: now,
  });
  return appendAudit(next, 'SAVE_AEMS_QUOTATION', 'QUOTATION', c.masterDossierCode,
    `[Hồ sơ ${c.masterDossierCode}] Báo giá AEMS ${c.containerNo}: ${quote.lines.length} dòng • ${quote.totalHours} giờ (chuẩn bị ${quote.preparationHours}) • ${quote.totalExclVat.toLocaleString('vi-VN')}đ — Draft`,
    c.masterDossierCode);
}

// Trạng thái duyệt của Maersk (nhập tay — sau này API). Draft chỉ đặt khi LƯU phiếu.
export function setAemsApproval(state: DepotState, input: { containerNo: string; approval: AemsApproval; workOrderNo?: string }): DepotState {
  assertPermission(state, 'QUOTATION', 'chỉ Bộ phận Báo giá được cập nhật trạng thái duyệt.');
  const c = quotedContainer(state, input.containerNo);
  if (!c.aemsQuote) throw new Error(`${c.containerNo}: chưa LƯU phiếu báo giá AEMS.`);
  if (!AEMS_APPROVAL_LABELS[input.approval] || input.approval === 'DRAFT') throw new Error('Trạng thái duyệt không hợp lệ.');
  const workOrderNo = input.workOrderNo?.trim() || c.aemsQuote.workOrderNo;
  if (workOrderNo && !/^[A-Z0-9-]{1,20}$/i.test(workOrderNo)) throw new Error('Số Work Order AEMS gồm 1–20 chữ / số.');
  const now = nowIso();
  const next = updateContainerById(state, c.id, {
    aemsQuote: { ...c.aemsQuote, approval: input.approval, approvalAt: now, approvalBy: state.currentUser.fullName, workOrderNo },
  });
  return appendAudit(next, 'SET_AEMS_APPROVAL', 'QUOTATION', c.masterDossierCode,
    `[Hồ sơ ${c.masterDossierCode}] Báo giá AEMS ${c.containerNo}: Maersk ${AEMS_APPROVAL_LABELS[input.approval]}${workOrderNo ? ` (WO ${workOrderNo})` : ''}`,
    c.masterDossierCode);
}

// Lý do chưa chuyển Sửa chữa được (null = được) — dùng ở confirmQuotationToRepair / hàng loạt / giao diện
export function aemsRepairBlocker(c: ContainerRecord): string | null {
  if (!usesAemsQuotation(c.shippingLineCode)) return null;
  if (!c.aemsQuote) return 'Chưa lưu phiếu báo giá AEMS';
  if (c.aemsQuote.approval !== 'APPROVED') return `Maersk chưa duyệt (${AEMS_APPROVAL_LABELS[c.aemsQuote.approval]})`;
  return null;
}
