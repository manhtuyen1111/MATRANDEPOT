// ============================================================================
// CỬA CHUNG CHO MỌI THAO TÁC GHI (DEC-155). Giao diện import hàm ghi từ ĐÂY, không import thẳng từ
// depotOperations / payments / vessel / invoice / feedback / driverRoute (test DEC-155 kiểm).
//   - Demo: chạy đúng hàm nghiệp vụ gốc (không đổi gì).
//   - Database: chạy hàm gốc trên máy (kiểm quy tắc, báo lỗi ngay) + xếp RPC tương ứng vào hàng chờ (sync.ts).
// Tên tham số RPC khớp supabase/migrations/*. Hàm đọc (không ghi) vẫn import từ file gốc như cũ.
// ============================================================================
import * as ops from './depotOperations';
import * as pay from './payments';
import * as ves from './vessel';
import * as inv from './invoice';
import * as fb from './feedback';
import * as route from './driverRoute';
import type { DepotState } from './depotStore';
import { enqueue, isRemoteMode, mapId, realId, requestId, rpc, uploadDoorPhoto, uploadRepairPhotos, type RemoteOp } from './remote/sync';
import { callEdgeFunction } from './remote/edge';

function wrap<A extends unknown[], R>(fn: (...args: A) => R, remote: (args: A, result: R) => RemoteOp): (...args: A) => R {
  return (...args: A) => {
    const result = fn(...args);
    if (isRemoteMode()) enqueue(remote(args, result));
    return result;
  };
}

const nul = <T>(v: T | undefined | null | ''): T | null => (v === undefined || v === '' ? null : (v as T));
const settle = (i: { paymentCategory: string; scannedQrCode?: string; ttsNote?: string; directMethod?: string }) => ({
  p_category: i.paymentCategory, p_scanned_qr: nul(i.scannedQrCode), p_tts_note: nul(i.ttsNote), p_method: nul(i.directMethod),
});
const slot = (i: { blockCode: string; bay?: string; row?: string; tier?: string }) => ({
  p_block: i.blockCode, p_bay: nul(i.bay), p_row: nul(i.row), p_tier: nul(i.tier),
});
const containerNoOf = (s: DepotState, id: string) => s.containers.find((c) => c.id === id)?.containerNo || '';

// ---------------------------------------------------------------------------
// HẠ VỎ — Giám định / Văn phòng / thanh toán
// ---------------------------------------------------------------------------
export const recordGateInFieldStep = wrap(ops.recordGateInFieldStep, ([, i], next) => async (c) => {
  const path = await uploadDoorPhoto(c, i.doorPhotoUrl, next.gateInOrders[0]?.masterDossierCode || 'HV');
  await rpc(c, 'record_gate_in_field_step', {
    p_request_id: requestId(), p_door_photo_path: path, p_shipping_line_code: i.shippingLineCode, p_condition: i.conditionClass, p_cleaning_items: i.cleaningItems,
    p_damage_remarks: i.damageRemarks || [], p_stuffing: nul(i.stuffingClass), p_manufacture_year: nul(i.manufactureYear), p_container_hint: nul(i.initialContainerHint),
  });
});
export const deleteGateInFieldRecord = wrap(ops.deleteGateInFieldRecord, ([, i]) => async (c) => {
  await rpc(c, 'delete_gate_in_field_record', { p_gate_in_id: i.gateInId });
});
export const completeRackInspection = wrap(ops.completeRackInspection, ([, i]) => async (c) => {
  await rpc(c, 'complete_rack_inspection', {
    p_request_id: requestId(), p_container_id: i.containerId, p_condition: i.conditionClass, p_stuffing: nul(i.stuffingClass),
    p_manufacture_year: i.manufactureYear, p_damage_remarks: i.damageRemarks || [],
  });
});
export const verifyGateInOfficeAndCreatePayment = wrap(ops.verifyGateInOfficeAndCreatePayment, ([, i]) => async (c) => {
  await rpc(c, 'verify_gate_in_office', {
    p_gate_in_id: i.gateInId, p_container_no: i.containerNo, p_size: i.size, p_type: i.type, p_truck_no: i.truckNo, p_driver_phone: i.driverPhone,
    p_customer_name: i.customerName, p_shipping_line_code: i.shippingLineCode, p_order_doc_no: i.orderDocNo, p_fee_ids: i.feeCatalogIds,
    p_stuffing: nul(i.stuffingClass), // DEC-166
  });
});
export const confirmGateInPaymentAndComplete = wrap(ops.confirmGateInPaymentAndComplete, ([, i]) => async (c) => {
  await rpc(c, 'confirm_gate_in_payment', { p_request_id: requestId(), p_gate_in_id: i.gateInId, ...settle(i) });
});

// ---------------------------------------------------------------------------
// BÃI — Xe nâng, Vệ sinh, Báo giá, Sửa chữa, Tồn vỏ
// ---------------------------------------------------------------------------
export const updateContainerLocation = wrap(ops.updateContainerLocation, ([, i]) => async (c) => {
  await rpc(c, 'update_container_location', {
    p_request_id: requestId(), ...slot(i), p_reason: i.reason || '', p_container_no: nul(i.containerNo), p_scanned_code: nul(i.scannedQrCode),
  });
});
export const shiftContainer = wrap(ops.shiftContainer, ([, i]) => async (c) => {
  await rpc(c, 'shift_container', { p_request_id: requestId(), p_container_id: i.containerId, ...slot(i), p_note: nul(i.note) });
});
export const correctContainerLocation = wrap(ops.correctContainerLocation, ([, i]) => async (c) => {
  await rpc(c, 'correct_container_location', { p_container_id: i.containerId, ...slot(i) });
});
export const completeCleaningTask = wrap(ops.completeCleaningTask, ([, i]) => async (c) => {
  await rpc(c, 'complete_cleaning_task', { p_request_id: requestId(), p_container_no: nul(i.containerNo), p_scanned_code: nul(i.scannedQrCode), p_notes: nul(i.notes) });
});
export const saveQuotationDraft = wrap(ops.saveQuotationDraft, ([, i]) => async (c) => {
  await rpc(c, 'save_quotation_draft', { p_container_no: i.containerNo, p_items: i.quotationItems, p_labor_hours: i.laborHours });
});
export const confirmQuotationToRepair = wrap(ops.confirmQuotationToRepair, ([, i]) => async (c) => {
  await rpc(c, 'confirm_quotation_to_repair', { p_container_no: i.containerNo });
});
// DEC-176: tải ảnh HOÀN THÀNH SỬA CHỮA lên kho repair-photos trước, rồi hoàn tất + gắn đường dẫn ảnh trong 1 lời gọi
export const completeRepairTask = wrap(ops.completeRepairTask, ([s, i]) => {
  const teamCode = s.repairTeams.find((t) => t.id === i.teamId)?.code || 'TO';
  const reqId = requestId();
  return async (c) => {
    const paths = await uploadRepairPhotos(c, i.photos, teamCode, i.containerNo || i.scannedQrCode || 'CONT');
    await rpc(c, 'complete_repair_with_photos', {
      p_request_id: reqId, p_team_id: i.teamId, p_member_ids: i.memberIds, p_photo_paths: paths,
      p_container_no: nul(i.containerNo), p_scanned_code: nul(i.scannedQrCode), p_notes: nul(i.notes),
    });
  };
});
export const toggleContainerHold = wrap(ops.toggleContainerHold, ([, i]) => async (c) => {
  await rpc(c, 'toggle_container_hold', { p_container_no: i.containerNo, p_hold: i.hold, p_reason: i.reason });
});
export const updateContainerOfficeNote = wrap(ops.updateContainerOfficeNote, ([, i]) => async (c) => {
  await rpc(c, 'update_container_office_note', { p_container_id: i.containerId, p_note: i.officeNote });
});
// Hàng loạt: chỉ gửi các cont hàm gốc đã làm được (bỏ qua cont đã ở trạng thái đích — như Demo)
export const bulkToggleContainerHold = wrap(ops.bulkToggleContainerHold, ([, i], res) => async (c) => {
  for (const no of res.done) await rpc(c, 'toggle_container_hold', { p_container_no: no, p_hold: i.hold, p_reason: i.reason });
});
export const bulkUpdateOfficeNote = wrap(ops.bulkUpdateOfficeNote, ([s, i], res) => async (c) => {
  const ids = i.containerIds.filter((id) => res.done.includes(containerNoOf(s, id)));
  for (const id of ids) await rpc(c, 'update_container_office_note', { p_container_id: id, p_note: i.officeNote });
});
export const bulkConfirmQuotationToRepair = wrap(ops.bulkConfirmQuotationToRepair, (_a, res) => async (c) => {
  for (const no of res.done) await rpc(c, 'confirm_quotation_to_repair', { p_container_no: no });
});

// ---------------------------------------------------------------------------
// CẤP VỎ
// ---------------------------------------------------------------------------
export const createReleaseOrder = wrap(ops.createReleaseOrder, ([s, i], next) => {
  const localId = next.gateOutOrders.find((o) => !s.gateOutOrders.some((x) => x.id === o.id))?.id;
  return async (c) => {
    const res = await rpc<{ gate_out_id: string }>(c, 'create_release_order', {
      p_request_id: requestId(), p_booking_no: i.bookingNo, p_customer_name: i.customerName, p_container_no: i.containerNo,
      p_truck_no: i.truckNo, p_driver_phone: i.driverPhone, p_fee_ids: i.feeCatalogIds,
      p_purpose: i.releasePurpose || 'CUSTOMER', p_sale_code: nul(i.saleCode), // DEC-194
    });
    if (localId) mapId(localId, res.gate_out_id); // lập lệnh + thu tiền trong cùng 1 lần bấm
  };
});
export const confirmReleasePayment = wrap(ops.confirmReleasePayment, ([, i]) => async (c) => {
  await rpc(c, 'confirm_release_payment', { p_request_id: requestId(), p_gate_out_id: realId(i.gateOutOrderId), ...settle(i) });
});
export const releaseAllocatedContainer = wrap(ops.releaseAllocatedContainer, ([, i]) => async (c) => {
  await rpc(c, 'release_allocated_container', { p_container_no: i.containerNo, p_reason: i.reason });
});
// DEC-185: ĐỔI CONTAINER khi chờ trả chứng từ cấp vỏ (RPC swap_gate_out_container — migration 20261111000001)
export const swapGateOutContainer = wrap(ops.swapGateOutContainer, ([, i]) => async (c) => {
  await rpc(c, 'swap_gate_out_container', {
    p_request_id: requestId(), p_gate_out_id: realId(i.gateOutOrderId), p_reason: i.reason, p_new_container_no: i.newContainerNo, p_note: nul(i.note),
  });
});
export const executeGateOut = wrap(ops.executeGateOut, ([, i]) => async (c) => {
  await rpc(c, 'execute_gate_out', { p_request_id: requestId(), p_container_no: nul(i.containerNo), p_scanned_code: nul(i.scannedQrCode), p_pickup_block: nul(i.pickupBlock) });
});

// ---------------------------------------------------------------------------
// TIỀN — chuyển khoản, phiếu thu trả trước, in phiếu, hóa đơn
// ---------------------------------------------------------------------------
// Database: không có giả lập ngân hàng → Văn phòng / Quản lý xác nhận tay đã nhận tiền chuyển khoản (DEC-152, DEC-154)
export const simulateDemoBankTransfer = wrap(ops.simulateDemoBankTransfer, ([, i]) => async (c) => {
  await rpc(c, 'confirm_transfer_manually', { p_transaction_id: i.transactionId, p_bank_ref: null });
});
export const cancelPendingTransaction = wrap(pay.cancelPendingTransaction, ([, i]) => async (c) => {
  await rpc(c, 'cancel_pending_transaction', { p_transaction_id: i.transactionId, p_reason: i.reason });
});
export const createMasterPrepaidReceipt = wrap(pay.createMasterPrepaidReceipt, ([, i]) => async (c) => {
  await rpc(c, 'create_prepaid_receipt', {
    p_customer_code: i.customerCode, p_lot_description: i.lotDescription, p_method: i.method, p_total_amount: nul(i.totalAmount),
    p_fee_items: i.feeItems?.length ? i.feeItems.map((f) => ({ catalog_id: f.catalogId, quantity: f.quantity })) : null,
  });
});
export const confirmPrepaidCash = wrap(pay.confirmPrepaidCash, ([, i]) => async (c) => {
  await rpc(c, 'confirm_prepaid_cash', { p_transaction_id: i.transactionId });
});
export const recordReceiptPrint = wrap(ops.recordReceiptPrint, ([, i]) => async (c) => {
  await rpc(c, 'record_receipt_print', { p_receipt_no: i.receiptNo });
});
export const markInvoiceIssued = wrap(inv.markInvoiceIssued, ([, i]) => async (c) => {
  await rpc(c, 'mark_invoice_issued', { p_receipt_no: i.receiptNo, p_invoice_no: nul(i.invoiceNo), p_group_id: nul(i.groupId) });
});

// ---------------------------------------------------------------------------
// NHẬP / XUẤT TÀU
// ---------------------------------------------------------------------------
export const createVesselList = wrap(ves.createVesselList, ([, i]) => async (c) => {
  await rpc(c, 'create_vessel_list', {
    p_mode: i.mode, p_vessel_name: i.vesselName, p_planned_at: i.plannedAt, p_truck_nos: i.truckNos, p_shipping_line_code: nul(i.shippingLineCode),
    p_destination_port: nul(i.destinationPort), // DEC-196
    p_import_items: i.importItems?.length ? i.importItems.map((r) => ({ container_no: r.containerNo, size: r.size, type: r.type })) : null,
    p_export_container_ids: i.exportContainerIds?.length ? i.exportContainerIds : null,
  });
});
export const updateVesselList = wrap(ves.updateVesselList, ([, i]) => async (c) => {
  await rpc(c, 'update_vessel_list', {
    p_list_id: i.listId, p_mode: i.mode, p_vessel_name: i.vesselName, p_planned_at: i.plannedAt, p_truck_nos: i.truckNos, p_shipping_line_code: nul(i.shippingLineCode),
    p_destination_port: nul(i.destinationPort), // DEC-196
  });
});
export const addVesselListItems = wrap(ves.addVesselListItems, ([, i]) => async (c) => {
  await rpc(c, 'add_vessel_list_items', {
    p_list_id: i.listId, p_mode: i.mode,
    p_import_items: i.importItems?.length ? i.importItems.map((r) => ({ container_no: r.containerNo, size: r.size, type: r.type })) : null,
    p_export_container_ids: i.exportContainerIds?.length ? i.exportContainerIds : null,
  });
});
export const deleteVesselList = wrap(ves.deleteVesselList, ([, i]) => async (c) => {
  await rpc(c, 'delete_vessel_list', { p_list_id: i.listId, p_mode: i.mode });
});
export const removeVesselListItem = wrap(ves.removeVesselListItem, ([, i]) => async (c) => {
  await rpc(c, 'remove_vessel_list_item', { p_list_id: i.listId, p_item_id: i.itemId, p_mode: i.mode });
});
export const inspectVesselImportItem = wrap(ves.inspectVesselImportItem, ([, i]) => async (c) => {
  await rpc(c, 'inspect_vessel_import_item', {
    p_request_id: requestId(), p_list_id: i.listId, p_item_id: i.itemId, p_actual_container_no: i.actualContainerNo, p_truck_no: i.truckNo,
    p_condition: i.conditionClass, p_stuffing: nul(i.stuffingClass), p_cleaning_items: i.cleaningItems, p_manufacture_year: i.manufactureYear,
    p_damage_remarks: i.damageRemarks || [], p_door_photo_path: null,
  });
});
export const executeVesselExport = wrap(ves.executeVesselExport, ([, i]) => async (c) => {
  await rpc(c, 'execute_vessel_export', { p_request_id: requestId(), p_list_id: i.listId, p_item_id: i.itemId, p_truck_no: i.truckNo });
});
export const approveVesselList = wrap(ves.approveVesselList, ([, i]) => async (c) => {
  await rpc(c, 'approve_vessel_list', { p_list_id: i.listId, p_mode: i.mode, p_reason: nul(i.reason) });
});

// ---------------------------------------------------------------------------
// TRẢ CHỨNG TỪ, GÓP Ý
// ---------------------------------------------------------------------------
export const confirmDocumentsReturn = wrap(route.confirmDocumentsReturn, ([s, i], res) => {
  const ticket = route.findTicketByQr(s, i.scannedQrCode);
  return async (c) => {
    await rpc(c, 'mark_documents_returned', { p_operation: ticket?.operationMode || 'HA_VO', p_code: res.pack.dossierCode });
  };
});
export const submitFeedback = wrap(fb.submitFeedback, ([, i]) => async (c) => {
  await rpc(c, 'submit_feedback', { p_menu_id: i.menuId, p_menu_label: i.menuLabel, p_content: i.content });
});
export const respondFeedback = wrap(fb.respondFeedback, ([, i]) => async (c) => {
  await rpc(c, 'respond_feedback', { p_id: i.id, p_status: i.status, p_response: nul(i.response) });
});

// ---------------------------------------------------------------------------
// DANH MỤC (chỉ Admin) — "xóa" ở database = ngừng dùng (giữ liên kết hồ sơ cũ)
// ---------------------------------------------------------------------------
export const addPartnerCatalogItem = wrap(ops.addPartnerCatalogItem, ([, i]) => async (c) => {
  await rpc(c, 'catalog_upsert_partner', {
    p_code: i.code, p_name: i.name, p_is_shipping_line: i.partnerType === 'SHIPPING_LINE', p_is_customer: i.partnerType === 'CUSTOMER', p_allow_tts: i.allowTts,
  });
});
export const deletePartnerCatalogItem = wrap(ops.deletePartnerCatalogItem, ([s, id]) => {
  const code = s.partners.find((p) => p.id === id)?.code || '';
  return async (c) => {
    await rpc(c, 'catalog_set_partner_active', { p_code: code, p_active: false });
  };
});
export const addYardBlockCatalogItem = wrap(ops.addYardBlockCatalogItem, ([, i]) => async (c) => {
  await rpc(c, 'catalog_upsert_yard_block', {
    p_code: i.blockCode, p_name: nul(i.blockName), p_max_bay: i.maxBay || 0, p_max_row: i.maxRow || 0, p_max_tier: i.maxTier || 0, p_capacity: 0,
    p_description: i.description || '', p_is_inspection_rack: Boolean(i.isInspectionRack),
  });
});
export const setYardBlockInspectionRack = wrap(ops.setYardBlockInspectionRack, ([, code, isRack]) => async (c) => {
  await rpc(c, 'catalog_set_inspection_rack', { p_code: code, p_is_rack: isRack });
});
export const deleteYardBlockCatalogItem = wrap(ops.deleteYardBlockCatalogItem, ([, code]) => async (c) => {
  await rpc(c, 'catalog_set_yard_block_active', { p_code: code, p_active: false });
});
export const addContainerSizeCatalogItem = wrap(ops.addContainerSizeCatalogItem, ([, v]) => async (c) => {
  await rpc(c, 'catalog_add_size', { p_code: v });
});
export const deleteContainerSizeCatalogItem = wrap(ops.deleteContainerSizeCatalogItem, ([, v]) => async (c) => {
  await rpc(c, 'catalog_set_size_active', { p_code: v, p_active: false });
});
export const addContainerTypeCatalogItem = wrap(ops.addContainerTypeCatalogItem, ([, v]) => async (c) => {
  await rpc(c, 'catalog_add_type', { p_code: v });
});
export const deleteContainerTypeCatalogItem = wrap(ops.deleteContainerTypeCatalogItem, ([, v]) => async (c) => {
  await rpc(c, 'catalog_set_type_active', { p_code: v, p_active: false });
});
// DEC-195: mã ISO 6346 theo Size + Type (mã trống = bỏ)
export const setContainerIsoCode = wrap(ops.setContainerIsoCode, ([, i]) => async (c) => {
  await rpc(c, 'catalog_set_iso_code', { p_size: i.size, p_type: i.type, p_iso_code: i.isoCode });
});
export const addDepotFeeCatalogItem = wrap(ops.addDepotFeeCatalogItem, ([, i]) => async (c) => {
  await rpc(c, 'catalog_add_fee', {
    p_category: i.category || 'NANG_HA', p_amount: Math.round(Number(i.defaultAmountInclVat)), p_name: nul(i.name), p_size: nul(i.size),
    p_type: nul(i.type), p_shipping_line_code: nul(i.shippingLineCode),
  });
});
export const deleteDepotFeeCatalogItem = wrap(ops.deleteDepotFeeCatalogItem, ([, id]) => async (c) => {
  await rpc(c, 'catalog_set_fee_active', { p_id: id, p_active: false });
});
export const updateCompanyProfile = wrap(ops.updateCompanyProfile, ([, p]) => async (c) => {
  await rpc(c, 'catalog_update_company', {
    p_name: p.name, p_short_name: p.shortName, p_address: p.address, p_phone: p.phone, p_email: p.email, p_tax_code: p.taxCode, p_bank_account: p.bankAccount,
  });
});
export const addRepairTeam = wrap(ops.addRepairTeam, ([, i]) => async (c) => {
  await rpc(c, 'catalog_upsert_repair_team', { p_code: i.code, p_name: i.name, p_active: true });
});
// DEC-166: Danh mục PHÂN LOẠI ĐÓNG HÀNG theo hãng tàu + hãng ƯU TIÊN
export const setShippingLinePriority = wrap(ops.setShippingLinePriority, ([, i]) => async (c) => {
  await rpc(c, 'catalog_set_partner_priority', { p_code: i.code, p_priority: i.isPriority });
});
export const addStuffingClassCatalogItem = wrap(ops.addStuffingClassCatalogItem, ([, i]) => async (c) => {
  await rpc(c, 'catalog_upsert_stuffing_class', { p_shipping_line_code: i.shippingLineCode, p_code: i.code.trim().toUpperCase(), p_description: nul(i.description?.trim()) });
});
export const setStuffingClassActive = wrap(ops.setStuffingClassActive, ([, i]) => async (c) => {
  await rpc(c, 'catalog_set_stuffing_class_active', { p_shipping_line_code: i.shippingLineCode, p_code: i.code, p_active: i.isActive });
});
export const setRepairTeamActive = wrap(ops.setRepairTeamActive, ([s, i]) => {
  const t = s.repairTeams.find((x) => x.id === i.teamId);
  return async (c) => {
    await rpc(c, 'catalog_upsert_repair_team', { p_code: t?.code || '', p_name: t?.name || '', p_active: i.isActive });
  };
});
export const addRepairTeamMember = wrap(ops.addRepairTeamMember, ([s, i], next) => {
  const before = s.repairTeams.find((t) => t.id === i.teamId)?.members.length || 0;
  const added = next.repairTeams.find((t) => t.id === i.teamId)?.members[before];
  return async (c) => {
    await rpc(c, 'catalog_upsert_repair_member', { p_team_id: i.teamId, p_full_name: added?.fullName || i.fullName || '', p_staff_id: nul(i.staffUserId), p_active: true });
  };
});
// DEC-173: tạo tổ theo số lượng (mỗi tổ 1 lời gọi), bậc thợ, gán tổ + bậc thợ cho nhân viên Sửa chữa
export const addRepairTeamsByCount = wrap(ops.addRepairTeamsByCount, ([s, i]) => {
  const teams = ops.repairTeamsToCreate(s, i.count);
  return async (c) => {
    for (const t of teams) await rpc(c, 'catalog_upsert_repair_team', { p_code: t.code, p_name: t.name, p_active: true });
  };
});
export const upsertRepairGrade = wrap(ops.upsertRepairGrade, ([, i]) => async (c) => {
  await rpc(c, 'catalog_upsert_repair_grade', { p_name: i.name, p_hourly_rate: i.hourlyRate, p_active: true, p_id: nul(i.id) });
});
export const setRepairGradeActive = wrap(ops.setRepairGradeActive, ([s, i]) => {
  const g = s.repairGrades.find((x) => x.id === i.id);
  return async (c) => {
    await rpc(c, 'catalog_upsert_repair_grade', { p_name: g?.name || '', p_hourly_rate: g?.hourlyRate || 0, p_active: i.isActive, p_id: i.id });
  };
});
// DEC-175: vượt giờ sửa chữa
export const updateRepairOvertime = wrap(ops.updateRepairOvertime, ([, i]) => async (c) => {
  await rpc(c, 'catalog_update_repair_overtime', { p_threshold_hours: i.thresholdHours, p_hourly_rate: i.hourlyRate });
});
export const assignRepairStaff = wrap(ops.assignRepairStaff, ([, i]) => async (c) => {
  await rpc(c, 'catalog_assign_repair_staff', { p_staff_id: i.staffUserId, p_team_id: i.teamId, p_grade_id: i.gradeId });
});
export const setRepairTeamMemberActive = wrap(ops.setRepairTeamMemberActive, ([s, i]) => {
  const m = s.repairTeams.find((t) => t.id === i.teamId)?.members.find((x) => x.id === i.memberId);
  return async (c) => {
    await rpc(c, 'catalog_upsert_repair_member', {
      p_team_id: i.teamId, p_full_name: m?.fullName || '', p_staff_id: nul(m?.staffUserId), p_active: i.isActive, p_member_id: i.memberId,
    });
  };
});

// ---------------------------------------------------------------------------
// NHÂN VIÊN (Admin) — tạo tài khoản qua Edge Function (cần tên đăng nhập); sửa vai trò / khóa qua RPC
// ---------------------------------------------------------------------------
export const addStaffUser = (state: DepotState, input: Parameters<typeof ops.addStaffUser>[1] & { username?: string }) => {
  const next = ops.addStaffUser(state, input);
  if (isRemoteMode()) {
    enqueue(async (c) => {
      const res = await callEdgeFunction<{ staff?: { id: string } }>('admin-create-staff', { username: input.username || '', full_name: input.fullName, email: input.email || null, roles: input.roles });
      // DEC-191: phòng ban gán ngay khi tạo (thông tin chi tiết khác cập nhật sau)
      if (input.department && res.staff?.id) {
        await rpc(c, 'admin_update_staff_profile', { p_staff_id: res.staff.id, p_department: input.department, p_gender: null, p_id_number: null, p_birth_year: null, p_hometown: null });
      }
    });
  }
  return next;
};
// DEC-191: thông tin chi tiết nhân viên (chỉ Admin)
export const updateStaffProfile = wrap(ops.updateStaffProfile, ([, i]) => async (c) => {
  await rpc(c, 'admin_update_staff_profile', {
    p_staff_id: i.userId, p_department: nul(i.department), p_gender: nul(i.gender), p_id_number: nul(i.idNumber), p_birth_year: nul(i.birthYear), p_hometown: nul(i.hometown),
  });
});
export const updateStaffUser = wrap(ops.updateStaffUser, ([s, i], next) => {
  const u = next.staffUsers.find((x) => x.id === i.userId) || s.staffUsers.find((x) => x.id === i.userId);
  return async (c) => {
    await rpc(c, 'admin_update_staff', { p_staff_id: i.userId, p_full_name: u?.fullName || '', p_email: nul(u?.email), p_roles: u?.roles || [], p_active: u?.isActive ?? true });
  };
});
export const resetStaffPassword = async (staffId: string): Promise<void> => {
  await callEdgeFunction('admin-reset-password', { staff_id: staffId });
};
