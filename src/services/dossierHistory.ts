// HỒ SƠ CONTAINER — LỊCH SỬ HỒ SƠ (DEC-181)
// Dựng từ dữ liệu tác nghiệp sẵn có (không đọc nhật ký audit): mỗi bước đã làm = 1 dòng
// THỜI GIAN | BỘ PHẬN | NỘI DUNG (TẠO MỚI / SỬA / XÓA) | CHI TIẾT | NHÂN VIÊN — cũ trên, mới dưới (DEC-184: cột Bộ phận).
// Bước chưa làm: mỗi việc 1 dòng ĐANG CHỜ cuối bảng, kèm bộ phận phụ trách.
import { SWAP_REASON_LABELS } from '../types/depot';
import type { ContainerRecord, GateInOrder, GateOutOrder, LocationHistoryItem, PaymentVoucher, ServiceWorkOrder, VesselList, VesselListItem } from '../types/depot';
import type { DepotState } from './depotStore';
import { formatVnd } from './depotStore';
import { paymentLabelOf } from './payments';
import { formatDateTime } from './datetime';
import { findVesselItemByCode, vesselListProgress } from './vessel';
import { LOCATION_ACTION_LABELS } from './reports';

export type HistoryAction = 'TẠO MỚI' | 'SỬA' | 'XÓA';

export interface HistoryReceipt {
  label: string;  // "Phiếu thu PT-TT-…" / "Yêu cầu …"
  target: string; // khóa mở Văn phòng → Phiếu thu (DEC-051)
}

export interface DossierHistoryRow {
  id: string;
  at: string;
  dept: string;      // BỘ PHẬN (DEC-184): Giám định / Văn phòng / Vệ sinh / Xe nâng / Báo giá / Sửa chữa
  operation: string; // tác nghiệp cụ thể (đầu dòng chi tiết): "Giám định — Hạ vỏ", "Xe nâng — Đảo chuyển"…
  action: HistoryAction;
  detail: string;
  staff: string;
  location?: { from?: string; to: string }; // mã BLOCK-… (giao diện hiển thị bằng icon định vị — DEC-136)
  receipts?: HistoryReceipt[];
  photos?: string[]; // đường dẫn kho — chỉ tải khi bấm XEM ẢNH (DEC-178)
  photoAlt?: string;
  showPhotos?: boolean; // DEC-182: ảnh cửa cont Giám định hiện luôn (không cần bấm XEM ẢNH)
}

export interface DossierContext {
  visitCode: string; // mã hồ sơ lượt lưu bãi (HV- / NT-)
  gateIn?: GateInOrder;
  container?: ContainerRecord;
  outMatch?: GateOutOrder;
  outOrders: GateOutOrder[];
  workOrders: ServiceWorkOrder[];
  locations: LocationHistoryItem[];
  importHit?: { list: VesselList; item: VesselListItem };
  exportHits: { list: VesselList; item: VesselListItem }[];
  inVoucher?: PaymentVoucher;
}

// Tìm hồ sơ theo mã bất kỳ (HV- / NT- / CV- / XT-) → lượt lưu bãi tương ứng (DEC-058, DEC-069)
export function resolveDossier(state: DepotState, code: string): DossierContext | null {
  const vesselHit = findVesselItemByCode(state, code);
  const xtContainer = vesselHit?.list.mode === 'XUAT_TAU' ? state.containers.find((c) => c.id === vesselHit.item.containerId) : undefined;
  const outMatch = state.gateOutOrders.find((o) => o.gateOutCode === code);
  const visitCode = outMatch?.masterDossierCode || xtContainer?.masterDossierCode || code;
  const importHit = visitCode.startsWith('NT-') ? findVesselItemByCode(state, visitCode) : undefined;
  const gateIn = state.gateInOrders.find((o) => o.masterDossierCode === visitCode || o.orderCode === visitCode);
  const container = state.containers.find((c) => c.masterDossierCode === visitCode);
  // DEC-185: kể cả lệnh đã ĐỔI CONTAINER khỏi lượt này (lệnh đã chuyển sang cont khác)
  const outOrders = state.gateOutOrders.filter(
    (o) => o.masterDossierCode === visitCode || (o.swaps || []).some((s) => s.fromMasterDossierCode === visitCode)
  );
  if (!gateIn && !container && outOrders.length === 0 && !importHit) return null;
  const exportHits = (state.vesselLists || [])
    .filter((l) => l.mode === 'XUAT_TAU')
    .flatMap((list) => list.items.filter((i) => container && i.containerId === container.id).map((item) => ({ list, item })));
  const inVoucher = gateIn?.voucherId
    ? state.vouchers.find((v) => v.id === gateIn.voucherId)
    : state.vouchers.find((v) => v.masterDossierCode === visitCode && v.serviceType === 'GATE_IN');
  return {
    visitCode,
    gateIn,
    container,
    outMatch,
    outOrders,
    workOrders: state.workOrders.filter((w) => w.masterDossierCode === visitCode),
    locations: state.locationHistory.filter((l) => l.masterDossierCode === visitCode),
    importHit,
    exportHits,
    inVoucher,
  };
}

// Phiếu thu của 1 chứng từ: phiếu thu trực tiếp + phiếu thu gốc của phiếu thu trả trước (TTR)
function voucherReceipts(state: DepotState, voucher: PaymentVoucher): HistoryReceipt[] {
  const out: HistoryReceipt[] = [];
  for (const t of state.paymentTransactions.filter((x) => x.voucherId === voucher.id)) {
    const r = state.paymentReceipts.find((x) => x.transactionId === t.id);
    if (r) out.push({ label: `Phiếu thu ${r.receiptNo}`, target: r.receiptNo });
  }
  if (voucher.paymentCategory === 'TTT' && voucher.masterReceiptCode) {
    const m = state.masterReceipts.find((x) => x.receiptCode === voucher.masterReceiptCode);
    const topup = m && state.paymentTransactions.find((t) => t.masterReceiptId === m.id && t.status === 'SUCCEEDED');
    const r = topup && state.paymentReceipts.find((x) => x.transactionId === topup.id);
    if (r) out.push({ label: `Phiếu thu ${r.receiptNo}`, target: r.receiptNo });
  }
  return out;
}

const join = (parts: (string | number | false | undefined | null)[]) => parts.filter(Boolean).join(' • ');
const inspectText = (cond?: string, damage?: string[]) => `${cond || '-'}${damage?.length ? ` — ${damage.join(', ')}` : ''}`;

// Việc đang chờ — mỗi việc 1 dòng, kèm bộ phận phụ trách (DEC-184)
export interface DossierPending {
  dept: string;
  label: string;
}

export interface DossierHistory {
  rows: DossierHistoryRow[];
  pending: DossierPending[];
}

// Bộ phận = phần đầu tên tác nghiệp; Thanh toán do Văn phòng làm
const deptOf = (operation: string) => {
  const head = operation.split(' — ')[0];
  return head === 'Thanh toán' ? 'Văn phòng' : head;
};

export function dossierHistory(state: DepotState, d: DossierContext): DossierHistory {
  const rows: DossierHistoryRow[] = [];
  const pending: DossierPending[] = [];
  const pend = (dept: string, label: string) => pending.push({ dept, label });
  const add = (row: Omit<DossierHistoryRow, 'id' | 'staff' | 'dept'> & { staff?: string }) => {
    if (row.at) rows.push({ ...row, id: `h${rows.length}`, dept: deptOf(row.operation), staff: row.staff || '-' });
  };
  const { gateIn, container, importHit, inVoucher } = d;

  // THANH TOÁN (1 dòng / chứng từ) — đã thu / TTS / hủy; chưa xong → ĐANG CHỜ
  const payment = (voucher: PaymentVoucher | undefined, op: string) => {
    if (!voucher) return;
    const fees = (voucher.feeLines || []).map((l) => `${l.name} ${formatVnd(l.amountInclVat)}`).join(', ');
    const base = [fees && `Phí: ${fees}`, `Tổng ${formatVnd(voucher.amount)}`, voucher.payerName && `Bên thanh toán: ${voucher.payerName}`];
    const txs = state.paymentTransactions.filter((t) => t.voucherId === voucher.id);
    if (voucher.status === 'CONFIRMED') {
      const paid = txs.find((t) => t.status === 'SUCCEEDED');
      add({
        at: paid?.confirmedAt || voucher.confirmedAt || '',
        operation: `Thanh toán — ${op}`,
        action: 'TẠO MỚI',
        detail: join([...base, `ĐÃ THANH TOÁN — ${paymentLabelOf(voucher)}`]),
        staff: paid?.confirmedBy || voucher.confirmedBy,
        receipts: voucherReceipts(state, voucher),
      });
    } else if (voucher.status === 'DEFERRED') {
      add({
        at: voucher.confirmedAt || '',
        operation: `Thanh toán — ${op}`,
        action: 'TẠO MỚI',
        detail: join([...base, `THANH TOÁN SAU (TTS — công nợ, chưa thu tiền)${voucher.ttsNote ? `: ${voucher.ttsNote}` : ''}`]),
        staff: voucher.confirmedBy,
      });
    } else if (voucher.status === 'CANCELLED') {
      // Chứng từ không lưu giờ hủy → không có dòng lịch sử; ghi chú ở dòng chờ để không mất thông tin
      pend('Văn phòng', `Chứng từ ${op.toLowerCase()} đã hủy`);
    } else {
      const req = txs.find((t) => t.status === 'PENDING');
      pend('Văn phòng', req ? `Chờ ngân hàng xác nhận chuyển khoản ${op.toLowerCase()} (yêu cầu ${req.paymentRef})` : `Chờ thanh toán ${op.toLowerCase()}`);
    }
  };

  // ===================== HẠ VỎ =====================
  if (gateIn) {
    add({
      at: gateIn.fieldRecordedAt,
      operation: 'Giám định — Hạ vỏ',
      action: 'TẠO MỚI',
      detail: join([
        `Hãng tàu ${gateIn.shippingLineCode || '-'}`,
        `Trạng thái ${gateIn.toInspectionRack && !gateIn.rackInspectedAt ? 'W-SURVEY (lên kệ)' : inspectText(gateIn.conditionClass, gateIn.damageRemarks)}`,
        gateIn.stuffingClass && `Đóng hàng ${gateIn.stuffingClass}`,
        `Vệ sinh ${gateIn.cleaningItems.join(' + ') || '-'}`,
        gateIn.manufactureYear && `AGE ${gateIn.manufactureYear}`,
      ]),
      staff: gateIn.fieldStaffName,
      photos: gateIn.doorPhotoUrl ? [gateIn.doorPhotoUrl] : [],
      photoAlt: 'Ảnh cửa container',
      showPhotos: true,
    });
    if (gateIn.toInspectionRack) {
      if (gateIn.rackInspectedAt) {
        add({
          at: gateIn.rackInspectedAt,
          operation: 'Giám định — Trên kệ',
          action: 'SỬA',
          detail: join([
            `W-SURVEY → ${inspectText(container?.conditionClass || gateIn.conditionClass, container?.damageRemarks || gateIn.damageRemarks)}`,
            (container?.stuffingClass || gateIn.stuffingClass) && `Đóng hàng ${container?.stuffingClass || gateIn.stuffingClass}`,
            (container?.manufactureYear || gateIn.manufactureYear) && `AGE ${container?.manufactureYear || gateIn.manufactureYear}`,
          ]),
          staff: gateIn.rackInspectedBy,
        });
      } else if (container && container.status !== 'GATED_OUT') pend('Giám định', 'Chờ giám định trên kệ');
    }
    if (gateIn.officeVerifiedAt) {
      add({
        at: gateIn.officeVerifiedAt,
        operation: 'Văn phòng — Hạ vỏ',
        action: 'TẠO MỚI',
        detail: join([
          gateIn.containerNo && `Số cont ${gateIn.containerNo} ${gateIn.size || ''}${gateIn.type || ''}`.trim(),
          `Khách hàng ${gateIn.customerRep || '-'}`,
          gateIn.orderDocNo && `Số lệnh ${gateIn.orderDocNo}`,
          gateIn.truckNo && `Số xe ${gateIn.truckNo}`,
          gateIn.driverPhone && `SĐT ${gateIn.driverPhone}`,
        ]),
        staff: gateIn.officeStaffName,
      });
      payment(inVoucher, 'Hạ vỏ');
      if (gateIn.gateInOkAt) {
        add({ at: gateIn.gateInOkAt, operation: 'Văn phòng — GATE IN OK', action: 'TẠO MỚI', detail: 'Cho cont vào bãi', staff: gateIn.gateInOkBy });
      }
    } else if (gateIn.status !== 'CANCELLED') pend('Văn phòng', 'Chờ Văn phòng bổ sung thông tin hạ vỏ');
  }

  // ===================== NHẬP TÀU (DEC-069) =====================
  if (importHit) {
    const { list, item } = importHit;
    add({
      at: list.createdAt,
      operation: 'Văn phòng — Lập danh sách nhập tàu',
      action: 'TẠO MỚI',
      detail: join([`Tàu ${list.vesselName}`, list.plannedAt && `Nhập tàu ${formatDateTime(list.plannedAt)}`, list.shippingLineCode && `Hãng tàu ${list.shippingLineCode}`]),
      staff: list.createdBy,
    });
    if (item.inspectedAt) {
      add({
        at: item.inspectedAt,
        operation: 'Giám định — Nhập tàu',
        action: 'TẠO MỚI',
        detail: join([
          item.truckNo && `Số xe ${item.truckNo}`,
          `Trạng thái ${inspectText(item.conditionClass, item.damageRemarks)}`,
          item.stuffingClass && `Đóng hàng ${item.stuffingClass}`,
          `Vệ sinh ${(item.cleaningItems || []).join(' + ') || '-'}`,
          item.manufactureYear && `AGE ${item.manufactureYear}`,
        ]),
        staff: item.inspectedBy,
        photos: item.doorPhotoUrl ? [item.doorPhotoUrl] : [],
        photoAlt: 'Ảnh cửa container',
        showPhotos: true,
      });
    } else pend('Giám định', 'Chờ xe về — Giám định nhập tàu');
  }

  // ===================== SAU KHI VÀO BÃI (Hạ vỏ / Nhập tàu) =====================
  const cleaningItems = container?.cleaningItems || gateIn?.cleaningItems || [];
  const cleaningWo = d.workOrders.find((w) => w.category === 'CLEANING');
  const inspectionWo = d.workOrders.find((w) => w.category === 'INSPECTION');
  const repairWo = d.workOrders.find((w) => w.category === 'REPAIR');
  const stillInYard = Boolean(container && container.status !== 'GATED_OUT');
  if (cleaningItems.some((i) => i !== 'KHÔNG VỆ SINH')) {
    if (cleaningWo?.workStatus === 'COMPLETED') {
      add({
        at: cleaningWo.completedAt || '',
        operation: 'Vệ sinh',
        action: 'TẠO MỚI',
        detail: join([`Hạng mục ${cleaningItems.join(' + ')}`, cleaningWo.resultNotes]),
        staff: cleaningWo.completedBy,
      });
    } else if (stillInYard) pend('Vệ sinh', 'Chờ vệ sinh');
  }

  // Xe nâng: hạ vỏ / hạ kệ / đảo chuyển… (lấy ra khi cấp vỏ / xuất tàu đã có dòng riêng)
  for (const l of d.locations) {
    if (l.actionType === 'GATE_OUT_CLEAR') continue;
    const first = l.actionType === 'INITIAL_BLOCK' || l.actionType === 'SHIFT_INSPECTION_RACK' || l.actionType === 'SWAP_RETURN';
    add({
      at: l.performedAt,
      operation: `Xe nâng — ${l.actionType === 'INITIAL_BLOCK' ? 'Hạ vỏ' : LOCATION_ACTION_LABELS[l.actionType]}`,
      action: first ? 'TẠO MỚI' : 'SỬA',
      detail: l.reason && (!first || l.actionType === 'SWAP_RETURN') ? l.reason : '',
      staff: l.performedBy,
      location: { from: first ? undefined : l.fromLocation, to: l.toLocation },
    });
  }
  if (stillInYard && (gateIn?.officeVerifiedAt || importHit?.item.inspectedAt) && !d.locations.some((l) => l.actionType === 'INITIAL_BLOCK' || l.actionType === 'SHIFT_INSPECTION_RACK')) {
    pend('Xe nâng', 'Chờ xe nâng hạ vỏ');
  }
  if (container?.swapReturn) {
    pend('Xe nâng', `Chờ xe nâng hạ lại (đổi container ${container.swapReturn.gateOutCode}${container.swapReturn.reason === 'DAMAGE' ? ' — hạ khu sửa chữa' : ''})`);
  }

  // Báo giá (DEC-086: cập nhật tình trạng + giờ công → xác nhận chờ sửa chữa) → Sửa chữa (DEC-176)
  const isDamageFlow = Boolean(inspectionWo || repairWo || gateIn?.conditionClass === 'DAMAGE');
  if (isDamageFlow) {
    if (container?.quotationUpdatedAt) {
      add({
        at: container.quotationUpdatedAt,
        operation: 'Báo giá — Cập nhật',
        action: 'TẠO MỚI',
        detail: join([`Tình trạng sửa chữa ${(container.quotationItems || []).join(', ') || '-'}`, `Giờ công ${container.quotationLaborHours ?? '-'}`]),
        staff: container.quotationUpdatedBy,
      });
    }
    if (repairWo) {
      add({
        at: repairWo.createdAt,
        operation: 'Báo giá — Xác nhận chờ sửa chữa',
        action: 'TẠO MỚI',
        // Đã có dòng Cập nhật (DEC-086) → không lặp lại tình trạng / giờ công
        detail: container?.quotationUpdatedAt
          ? join(['Chuyển Sửa chữa', repairWo.estimateCost > 0 && formatVnd(repairWo.estimateCost)])
          : join([
              `Tình trạng sửa chữa ${repairWo.items.join(', ') || '-'}`,
              `Giờ công ${repairWo.laborHours ?? '-'}`,
              repairWo.estimateCost > 0 && formatVnd(repairWo.estimateCost),
            ]),
        staff: repairWo.approvedBy,
      });
      if (repairWo.workStatus === 'COMPLETED') {
        add({
          at: repairWo.completedAt || '',
          operation: 'Sửa chữa',
          action: 'TẠO MỚI',
          detail: join([
            repairWo.repairTeamName && `Tổ ${repairWo.repairTeamName}`,
            (repairWo.repairMembers || []).join(', '),
            `Giờ công ${repairWo.laborHours ?? '-'}`,
            'Chuyển AV',
          ]),
          staff: repairWo.completedBy,
          photos: repairWo.repairPhotos || [],
          photoAlt: 'Ảnh hoàn thành sửa chữa',
        });
      } else if (repairWo.workStatus === 'CANCELLED') {
        add({ at: repairWo.completedAt || '', operation: 'Sửa chữa', action: 'XÓA', detail: 'Đóng khi cấp vỏ DAMAGE', staff: repairWo.completedBy });
      } else if (stillInYard) pend('Sửa chữa', 'Chờ sửa chữa');
    } else if (inspectionWo?.workStatus === 'CANCELLED') {
      add({ at: inspectionWo.completedAt || '', operation: 'Báo giá', action: 'XÓA', detail: 'Đóng khi cấp vỏ DAMAGE', staff: inspectionWo.completedBy });
    } else if (stillInYard && !(gateIn?.toInspectionRack && !gateIn.rackInspectedAt)) pend('Báo giá', 'Chờ báo giá');
  }
  // DEC-185: hư hỏng PHÁT SINH CẤP VỎ — lượt đã từng sửa chữa xong vẫn phải hiện chờ báo giá lần mới
  if (container?.needsQuotation && !pending.some((p) => p.label === 'Chờ báo giá')) pend('Báo giá', 'Chờ báo giá (phát sinh cấp vỏ)');

  // Văn phòng — ghi chú Tồn vỏ / khóa container (chỉ lưu lần gần nhất — DEC-030, DEC-065)
  if (container?.officeNoteUpdatedAt && container.officeNote) {
    add({ at: container.officeNoteUpdatedAt, operation: 'Văn phòng — Ghi chú', action: 'SỬA', detail: container.officeNote, staff: container.officeNoteUpdatedBy });
  }
  if (container?.isOnHold && container.holdAt) {
    add({ at: container.holdAt, operation: 'Văn phòng — Khóa container', action: 'SỬA', detail: container.holdReason || '', staff: container.holdBy });
  }

  if (gateIn?.officeVerifiedAt) {
    if (gateIn.documentsReturnedAt) {
      add({ at: gateIn.documentsReturnedAt, operation: 'Văn phòng — Trả chứng từ Hạ vỏ', action: 'TẠO MỚI', detail: 'Trả Phiếu EEIR (K80) + phiếu thu cho lái xe', staff: gateIn.documentsReturnedBy });
    } else pend('Văn phòng', 'Chờ lái xe quay về trả chứng từ hạ vỏ');
  }
  if (importHit) {
    const { list } = importHit;
    if (list.status === 'APPROVED') {
      add({ at: list.approvedAt || '', operation: 'Văn phòng — Duyệt nhập tàu', action: 'TẠO MỚI', detail: join([`Tàu ${list.vesselName}`, list.approveNote]), staff: list.approvedBy });
    } else pend('Văn phòng', `Chờ duyệt nhập tàu ${list.vesselName}`);
  }

  // ===================== CẤP VỎ =====================
  for (const o of d.outOrders) {
    add({
      at: o.createdAt,
      operation: 'Văn phòng — Cấp vỏ',
      action: 'TẠO MỚI',
      detail: join([`Lệnh ${o.gateOutCode}`, `Booking ${o.bookingNo}`, `Khách hàng ${o.receiverRep || '-'}`, o.truckNo && `Số xe ${o.truckNo}`, o.driverPhone && `SĐT ${o.driverPhone}`]),
      staff: o.createdBy,
    });
    // DEC-185: ĐỔI CONTAINER — lượt này là cont bị đổi đi (đã cấp ra rồi trả về) hoặc cont cấp thay
    for (const s of o.swaps || []) {
      if (s.fromMasterDossierCode === d.visitCode) {
        add({ at: s.gatedOutAt || '', operation: 'Xe nâng — Cấp vỏ', action: 'TẠO MỚI', detail: join(['Đã OUT khỏi bãi', o.truckNo && `Số xe ${o.truckNo}`]), staff: s.gatedOutBy });
        add({
          at: s.swappedAt,
          operation: 'Văn phòng — Đổi container',
          action: 'SỬA',
          detail: join([SWAP_REASON_LABELS[s.reason], s.note, `Lệnh ${o.gateOutCode} chuyển sang ${s.toContainerNo}`, s.reason === 'DAMAGE' && 'Chuyển DAMAGE — PHÁT SINH CẤP VỎ']),
          staff: s.swappedBy,
        });
      }
      if (s.toMasterDossierCode === d.visitCode) {
        add({
          at: s.swappedAt,
          operation: 'Văn phòng — Đổi container',
          action: 'TẠO MỚI',
          detail: join([`Cấp thay cont ${s.fromContainerNo}`, SWAP_REASON_LABELS[s.reason], s.note]),
          staff: s.swappedBy,
        });
      }
    }
    if (o.masterDossierCode !== d.visitCode) continue; // lệnh đã chuyển sang cont khác
    if (o.status === 'CANCELLED') {
      add({ at: o.cancelledAt || '', operation: 'Văn phòng — Hủy lệnh cấp', action: 'XÓA', detail: join([`Lệnh ${o.gateOutCode}`, o.cancelReason]) });
      continue;
    }
    payment(state.vouchers.find((x) => x.id === o.voucherId), 'Cấp vỏ');
    if (o.status === 'GATE_OUT_OK') {
      add({ at: o.confirmedAt || '', operation: 'Xe nâng — Cấp vỏ', action: 'TẠO MỚI', detail: join(['Đã OUT khỏi bãi', o.truckNo && `Số xe ${o.truckNo}`]), staff: o.confirmedBy });
      if (o.documentsReturnedAt) {
        add({ at: o.documentsReturnedAt, operation: 'Văn phòng — Trả chứng từ Cấp vỏ', action: 'TẠO MỚI', detail: 'Trả Phiếu EEIR (K80) + phiếu thu cho lái xe', staff: o.documentsReturnedBy });
      } else pend('Văn phòng', `Chờ lái xe quay về trả chứng từ cấp vỏ ${o.gateOutCode}`);
    } else if (o.status === 'PENDING_FORKLIFT') {
      const waitSwap = (o.swaps || []).map((s) => state.containers.find((c) => c.id === s.fromContainerId)).find((c) => c?.swapReturn);
      pend('Xe nâng', waitSwap ? `Chờ xe nâng hạ ${waitSwap.containerNo} rồi cấp vỏ ${o.gateOutCode}` : `Chờ xe nâng cấp vỏ ${o.gateOutCode}`);
    }
  }

  // ===================== XUẤT TÀU (DEC-069, DEC-131, DEC-169) =====================
  for (const { list, item } of d.exportHits) {
    add({
      at: list.createdAt,
      operation: 'Văn phòng — Lập danh sách xuất tàu',
      action: 'TẠO MỚI',
      detail: join([item.dossierCode && `Hồ sơ ${item.dossierCode}`, `Tàu ${list.vesselName}`, list.plannedAt && `Xuất tàu ${formatDateTime(list.plannedAt)}`, item.locationAtList && `Vị trí lúc lập ${item.locationAtList}`]),
      staff: list.createdBy,
    });
    if (item.status === 'DONE') {
      add({ at: item.doneAt || '', operation: 'Xe nâng — Xuất tàu', action: 'TẠO MỚI', detail: join(['Đã OUT khỏi bãi', item.truckNo && `Số xe ${item.truckNo}`]), staff: item.doneBy });
    } else if (item.status !== 'SKIPPED') pend('Xe nâng', `Chờ xuất tàu ${list.vesselName}`);
    if (list.status === 'APPROVED') {
      const p = vesselListProgress(list);
      add({
        at: list.approvedAt || '',
        operation: 'Văn phòng — Duyệt xuất tàu',
        action: 'TẠO MỚI',
        detail: join([`Tàu ${list.vesselName}`, `Tiến độ thực tế ${p.done}/${p.total}`, item.status === 'SKIPPED' && 'Cont này KHÔNG XUẤT TÀU', list.approveNote]),
        staff: list.approvedBy,
      });
    } else pend('Văn phòng', `Chờ duyệt xuất tàu ${list.vesselName}`);
  }

  // Cũ trên, mới dưới; cùng giờ giữ thứ tự tác nghiệp (sort ổn định)
  rows.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  return { rows, pending };
}
