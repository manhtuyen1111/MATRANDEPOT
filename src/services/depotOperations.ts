import {
  AppRole,
  CompanyProfile,
  StaffUser,
  ContainerRecord,
  ContainerSize,
  ContainerType,
  FeeLineItem,
  FeeTariffCategory,
  FieldCleaningItem,
  FieldConditionClass,
  FieldStuffingClass,
  GateInType,
  GateOutOrder,
  K80InternalTicket,
  ReleaseBooking,
  RepairGrade,
  RepairTeam,
  RepairTeamMember,
  ServiceWorkOrder,
  RELEASE_PURPOSE_LABELS,
  ReleasePurpose,
  STAFF_GENDER_LABELS,
  StaffGender,
  SWAP_REASON_LABELS,
  SwapReason,
  CONDITION_DEFERRED,
} from '../types/depot';
import { DepotState, hasRolePermission } from './depotStore';
import { allocateCode } from './codes';
import { markVesselImportPlaced } from './vessel';
import { resolveStuffing } from './stuffing';
import { ASSIGNABLE_ROLES } from './permissions';
import { isMaerskBooking, isMaerskLine, MAERSK_BOOKING_ERROR } from './edi/maersk';
import {
  appendAudit,
  assertPermission,
  findActiveContainer,
  findActiveContainerByCode,
  formatLocation,
  newId,
  normalizeContainerNo,
  normalizeDriverPhone,
  nowIso,
  SYSTEM_ACTOR,
  updateContainerById,
  validateTargetSlot,
} from './core';
import {
  applyBankCallback,
  BankCallbackInput,
  demoBankProviderRef,
  isVoucherSettled,
  paymentLabelOf,
  pendingTransactionOf,
  settleVoucher,
  SettleOutcome,
  SettleVoucherInput,
  cancelPendingTransaction,
} from './payments';

export {
  cancelPendingTransaction,
  confirmPrepaidCash,
  createMasterPrepaidReceipt,
} from './payments';

type Actor = { name: string; role: 'SYSTEM' } | undefined;

const LEGACY_CLEANING_MAP: Record<string, FieldCleaningItem> = {
  'KHÔNG VỆ SINH': 'KHÔNG VỆ SINH',
  'QUÉT': 'WP - QUÉT',
  'WP - QUÉT': 'WP - QUÉT',
  'RỬA NƯỚC': 'WW - RỬA NƯỚC',
  'WW - RỬA NƯỚC': 'WW - RỬA NƯỚC',
  'VỆ SINH CÔNG NGHIỆP': 'CC - HÓA CHẤT', // DEC-021: CC - HÓA CHẤT chính là VỆ SINH CÔNG NGHIỆP
  'CC - HÓA CHẤT': 'CC - HÓA CHẤT',
  'NHỔ ĐINH': 'RM - NHỔ ĐINH',
  'RM - NHỔ ĐINH': 'RM - NHỔ ĐINH',
  'BÓC TEM': 'ML - BÓC TEM',
  'ML - BÓC TEM': 'ML - BÓC TEM',
};

export function normalizeCleaningItems(items: (FieldCleaningItem | string)[]): FieldCleaningItem[] {
  if (!items || items.length === 0) return ['KHÔNG VỆ SINH'];
  const mapped = items.map((i) => LEGACY_CLEANING_MAP[i] || (i as FieldCleaningItem));
  if (mapped.length > 1 && mapped.includes('KHÔNG VỆ SINH')) {
    return Array.from(new Set(mapped.filter((item) => item !== 'KHÔNG VỆ SINH')));
  }
  return Array.from(new Set(mapped));
}

// Chi phí chỉ được lấy từ BIỂU GIÁ trong Danh mục chung, chụp lại đơn giá tại thời điểm lập chứng từ
function buildFeeLines(state: DepotState, feeCatalogIds: string[]): FeeLineItem[] {
  if (!feeCatalogIds || feeCatalogIds.length === 0) {
    throw new Error('Vui lòng thêm ít nhất 1 khoản CHI PHÍ (đã bao gồm VAT) từ biểu giá.');
  }
  return feeCatalogIds.map((catalogId) => {
    const cat = state.feeCatalog.find((f) => f.id === catalogId);
    if (!cat) throw new Error('Biểu giá đã chọn không còn trong Danh mục chung. Vui lòng chọn lại.');
    return {
      id: newId('fl'),
      catalogCode: cat.code,
      name: cat.name,
      amountInclVat: Number(cat.defaultAmountInclVat),
    };
  });
}

function sumFees(lines: FeeLineItem[]): number {
  return lines.reduce((sum, l) => sum + Number(l.amountInclVat || 0), 0);
}

// DEC-093: khách hàng gõ tay hoặc chọn từ Danh mục. Trùng tên Danh mục (không phân biệt hoa thường) → lấy đúng tên Danh mục;
// không có trong Danh mục → vẫn lưu tên tự do (chỉ thanh toán Tiền mặt / Chuyển khoản — xem settleVoucher).
export function normalizeCustomer(state: DepotState, customerName: string): string {
  const name = customerName.trim().replace(/\s+/g, ' ');
  if (!name) throw new Error('Vui lòng nhập hoặc chọn KHÁCH HÀNG.');
  if (name.length > 120) throw new Error('Tên KHÁCH HÀNG tối đa 120 ký tự.');
  const known = state.partners.find((p) => p.isCustomer && p.name.toLowerCase() === name.toLowerCase());
  return known ? known.name : name;
}

export function isCatalogCustomer(state: DepotState, name?: string): boolean {
  const n = (name || '').trim().toLowerCase();
  return Boolean(n) && state.partners.some((p) => p.isCustomer && p.name.toLowerCase() === n);
}

// ============================================================================
// 1. BỘ PHẬN GIÁM ĐỊNH — HẠ VỎ (Mobile): Chụp ảnh cửa cont + nhập thông tin ban đầu
// ============================================================================
export function recordGateInFieldStep(
  state: DepotState,
  input: {
    gateInType: GateInType;
    doorPhotoUrl: string;
    initialContainerHint?: string;
    // DEC-166: Giám định chọn HÃNG TÀU trước → biết bộ Phân loại đóng hàng của hãng (hãng không dùng → không hỏi)
    shippingLineCode: string;
    conditionClass: FieldConditionClass;
    damageRemarks?: string[];
    // DEC-147: W-SURVEY → bỏ trống Đóng hàng / AGE (bổ sung trên kệ bằng completeRackInspection)
    stuffingClass?: FieldStuffingClass;
    cleaningItems: (FieldCleaningItem | string)[];
    manufactureYear?: number;
  }
): DepotState {
  assertPermission(
    state,
    'GATE_IN_FIELD',
    'chỉ Bộ phận Giám định / Hiện trường / Quản lý mới được xác nhận tác nghiệp Hạ vỏ.'
  );
  if (!input.doorPhotoUrl?.trim()) {
    throw new Error('Bắt buộc phải chụp 1 ảnh cửa container nhìn rõ số container.');
  }
  // DEC-147: W-SURVEY (LÊN KỆ) thay ô tích HẠ KỆ GIÁM ĐỊNH (DEC-109) — chỉ cần ảnh + Vệ sinh
  const deferred = input.conditionClass === CONDITION_DEFERRED;
  const lineCode = input.shippingLineCode?.trim();
  if (!state.partners.some((p) => p.isShippingLine && p.code === lineCode)) throw new Error('Vui lòng chọn HÃNG TÀU theo Danh mục chung.');
  let year: number | undefined;
  let stuffing: string | undefined;
  if (!deferred) {
    stuffing = resolveStuffing(state, lineCode, input.stuffingClass);
    year = assertManufactureYear(input.manufactureYear);
  }

  const normalizedCleaning = normalizeCleaningItems(input.cleaningItems);
  const remarks = input.conditionClass === 'DAMAGE' ? input.damageRemarks || [] : [];
  // Mã hồ sơ do hệ thống cấp, không nhận mã sinh ở giao diện (CR-07)
  const allocated = allocateCode(state, 'HV');
  const code = allocated.code;
  const hint = input.initialContainerHint?.trim().toUpperCase();

  const newOrder = {
    id: newId('gin'),
    masterDossierCode: code,
    orderCode: code,
    gateInType: input.gateInType,
    doorPhotoUrl: input.doorPhotoUrl.trim(),
    initialContainerHint: hint && !/^(HS|GD|IN)-/.test(hint) ? hint : undefined,
    conditionClass: input.conditionClass,
    damageRemarks: remarks,
    shippingLineCode: lineCode,
    stuffingClass: stuffing,
    cleaningItems: normalizedCleaning,
    manufactureYear: year,
    toInspectionRack: deferred,
    fieldStaffName: state.currentUser.fullName,
    fieldRecordedAt: nowIso(),
    feeAmount: 0,
    status: 'FIELD_RECORDED' as const,
    nextDepartments: [],
  };

  return appendAudit(
    { ...allocated.state, gateInOrders: [newOrder, ...allocated.state.gateInOrders] },
    'GIAM_DINH_HA_VO',
    'GATE_IN',
    code,
    deferred
      ? `[Hồ sơ ${code}] Giám định xác nhận Hạ vỏ: W-SURVEY (LÊN KỆ), Vệ sinh [${normalizedCleaning.join(', ')}] — HẠ KỆ GIÁM ĐỊNH`
      : `[Hồ sơ ${code}] Giám định xác nhận Hạ vỏ: Trạng thái ${input.conditionClass}${
          remarks.length ? ` (${remarks.join(', ')})` : ''
        }, Hãng ${lineCode}, Đóng hàng ${stuffing || '-'}, Vệ sinh [${normalizedCleaning.join(', ')}], AGE ${year}`,
    code
  );
}

function assertManufactureYear(value: number | undefined): number {
  const year = Number(value);
  if (!Number.isInteger(year) || year < 1980 || year > new Date().getFullYear() + 1) {
    throw new Error('Năm sinh container (AGE) phải theo định dạng 4 chữ số hợp lệ (VD: 2001, 2002...).');
  }
  return year;
}

// ============================================================================
// DEC-147: GIÁM ĐỊNH BỔ SUNG TRÊN KỆ — cont W-SURVEY đã hạ lên kệ → Giám định nhập AV / DAMAGE + Đóng hàng + AGE
// ============================================================================
// Phiếu chờ giám định trên kệ: lượt lưu bãi đang W-SURVEY (Văn phòng đã nhập Số cont / Size / Type), mới nhất trước
export function pendingRackInspections(state: DepotState): ContainerRecord[] {
  return state.containers
    .filter((c) => c.status !== 'GATED_OUT' && c.conditionClass === CONDITION_DEFERRED)
    .sort((a, b) => new Date(b.gateInAt).getTime() - new Date(a.gateInAt).getTime());
}

export function completeRackInspection(
  state: DepotState,
  input: {
    containerId: string;
    conditionClass: FieldConditionClass;
    damageRemarks?: string[];
    stuffingClass?: FieldStuffingClass;
    manufactureYear: number;
  }
): DepotState {
  assertPermission(state, 'GATE_IN_FIELD', 'chỉ Bộ phận Giám định / Hiện trường / Quản lý mới được giám định bổ sung trên kệ.');
  const c = state.containers.find((x) => x.id === input.containerId);
  if (!c || c.status === 'GATED_OUT') throw new Error('Không tìm thấy container đang lưu bãi.');
  if (c.conditionClass !== CONDITION_DEFERRED) throw new Error(`Container ${c.containerNo} không ở trạng thái W-SURVEY (đã giám định).`);
  if (c.status !== 'IN_YARD') throw new Error(`Container ${c.containerNo} chưa được Xe nâng hạ lên kệ — chưa giám định bổ sung được.`);
  if (input.conditionClass !== 'AV' && input.conditionClass !== 'DAMAGE') throw new Error('Vui lòng chọn TRẠNG THÁI AV hoặc DAMAGE.');
  const stuffing = resolveStuffing(state, c.shippingLineCode, input.stuffingClass); // DEC-166
  const year = assertManufactureYear(input.manufactureYear);
  const isDamage = input.conditionClass === 'DAMAGE';
  const remarks = isDamage ? (input.damageRemarks || []).map((r) => r.trim()).filter(Boolean) : [];
  if (isDamage && remarks.length === 0) throw new Error('Container DAMAGE: chọn ít nhất 1 lỗi hư hỏng hoặc nhập ghi chú.');

  const patch = { conditionClass: input.conditionClass, damageRemarks: remarks, stuffingClass: stuffing, manufactureYear: year };
  const actor = state.currentUser.fullName;
  const now = nowIso();
  let next = updateContainerById(state, c.id, { ...patch, needsQuotation: isDamage });
  next = {
    ...next,
    gateInOrders: next.gateInOrders.map((o) =>
      o.masterDossierCode === c.masterDossierCode ? { ...o, ...patch, rackInspectedBy: actor, rackInspectedAt: now } : o
    ),
    k80Tickets: next.k80Tickets.map((t) => (t.masterDossierCode === c.masterDossierCode ? { ...t, ...patch } : t)),
    // Như Hạ vỏ thường: DAMAGE → hàng chờ Báo giá
    workOrders: isDamage
      ? [
          {
            id: newId('wo'),
            masterDossierCode: c.masterDossierCode,
            workOrderCode: `INSP-${c.masterDossierCode}`,
            containerNo: c.containerNo,
            category: 'INSPECTION' as const,
            sourceOrderCode: c.masterDossierCode,
            items: [...remarks],
            estimateCost: 0,
            approvalStatus: 'NOT_REQUIRED' as const,
            workStatus: 'OPEN' as const,
            assignedTo: 'Bộ phận Báo giá',
            createdAt: now,
          },
          ...next.workOrders,
        ]
      : next.workOrders,
  };
  return appendAudit(
    next,
    'GIAM_DINH_TREN_KE',
    'GATE_IN',
    c.masterDossierCode,
    `[Hồ sơ ${c.masterDossierCode}] Giám định bổ sung trên kệ ${c.containerNo}: Trạng thái ${input.conditionClass}${
      remarks.length ? ` (${remarks.join(', ')})` : ''
    }, Đóng hàng ${stuffing || '-'}, AGE ${year}${isDamage ? ' → BÁO GIÁ - CHỜ BÁO GIÁ' : ''}`,
    c.masterDossierCode
  );
}

// ============================================================================
// 2. BỘ PHẬN VĂN PHÒNG — HẠ VỎ: Bổ sung hồ sơ & lập chứng từ chi phí (chưa thu tiền)
// ============================================================================
export function verifyGateInOfficeAndCreatePayment(
  state: DepotState,
  input: {
    gateInId: string;
    containerNo: string;
    size: ContainerSize;
    type: ContainerType;
    truckNo: string;
    driverPhone: string;
    customerName: string;
    shippingLineCode: string;
    orderDocNo: string;
    feeCatalogIds: string[];
    // DEC-166: chỉ cần khi Văn phòng đổi sang hãng có bộ phân loại khác với lúc Giám định chọn
    stuffingClass?: FieldStuffingClass;
  }
): DepotState {
  assertPermission(state, 'GATE_IN_OFFICE', 'chỉ Bộ phận Văn phòng / Quản lý mới được kiểm tra chứng từ và lập chi phí.');

  const order = state.gateInOrders.find((o) => o.id === input.gateInId);
  if (!order) throw new Error('Không tìm thấy lượt Hạ vỏ.');
  if (order.status === 'GATE_IN_OK' || order.status === 'CANCELLED') {
    throw new Error(`Lượt Hạ vỏ đang ở trạng thái ${order.status}, không thể lập lại chứng từ.`);
  }
  const existingVoucher = order.voucherId ? state.vouchers.find((v) => v.id === order.voucherId) : undefined;
  if (existingVoucher && existingVoucher.status !== 'PENDING') {
    throw new Error(`Chứng từ ${existingVoucher.voucherNo} đã được xử lý thanh toán, không thể sửa chi phí.`);
  }
  if (existingVoucher && pendingTransactionOf(state, existingVoucher.id)) {
    throw new Error('Chứng từ đang chờ kết quả chuyển khoản. Hủy yêu cầu chuyển khoản trước khi sửa hồ sơ.');
  }

  const contNo = normalizeContainerNo(input.containerNo);
  if (!state.containerSizes.includes(input.size)) throw new Error('SIZE không có trong Danh mục chung.');
  if (!state.containerTypes.includes(input.type)) throw new Error('TYPE không có trong Danh mục chung.');
  if (!state.partners.some((p) => p.isShippingLine && p.code === input.shippingLineCode)) {
    throw new Error('Vui lòng chọn HÃNG TÀU theo Danh mục chung.');
  }
  // DEC-166: kiểm lại Phân loại đóng hàng theo hãng Văn phòng chốt (W-SURVEY bổ sung trên kệ)
  const stuffing = order.conditionClass === CONDITION_DEFERRED ? undefined : resolveStuffing(state, input.shippingLineCode, input.stuffingClass || order.stuffingClass);
  const customerName = normalizeCustomer(state, input.customerName);
  const truckNo = input.truckNo.trim().toUpperCase();
  if (!truckNo) throw new Error('Văn phòng bắt buộc nhập SỐ XE.');
  const driverPhone = normalizeDriverPhone(input.driverPhone);

  const conflict = gateInContainerConflict(state, contNo, order.id);
  if (conflict) throw new Error(conflict);

  const feeLines = buildFeeLines(state, input.feeCatalogIds);
  const amount = sumFees(feeLines);

  let next = state;
  // DEC-119: số chứng từ = MÃ HỒ SƠ của tác nghiệp (không cấp mã CT- riêng)
  const voucherNo = order.masterDossierCode;
  const voucher = {
    id: existingVoucher?.id || newId('vch'),
    masterDossierCode: order.masterDossierCode,
    voucherNo,
    serviceType: 'GATE_IN' as const,
    referenceCode: order.masterDossierCode,
    containerNo: contNo,
    shippingLineCode: input.shippingLineCode,
    payerName: customerName,
    amount,
    feeLines,
    status: 'PENDING' as const,
    createdBy: existingVoucher?.createdBy || state.currentUser.fullName,
    createdAt: existingVoucher?.createdAt || nowIso(),
  };
  next = {
    ...next,
    vouchers: existingVoucher
      ? next.vouchers.map((v) => (v.id === voucher.id ? voucher : v))
      : [voucher, ...next.vouchers],
    gateInOrders: next.gateInOrders.map((o) =>
      o.id === order.id
        ? {
            ...o,
            containerNo: contNo,
            size: input.size,
            type: input.type,
            truckNo,
            driverPhone,
            customerRep: customerName,
            shippingLineCode: input.shippingLineCode,
            stuffingClass: stuffing,
            orderDocNo: input.orderDocNo.trim(),
            officeStaffName: state.currentUser.fullName,
            officeVerifiedAt: nowIso(),
            feeLines,
            feeAmount: amount,
            voucherId: voucher.id,
            voucherNo,
            status: 'PAYMENT_PENDING' as const,
          }
        : o
    ),
  };

  return appendAudit(
    next,
    'GATE_IN_OFFICE_VERIFY',
    'GATE_IN',
    order.masterDossierCode,
    `[Hồ sơ ${order.masterDossierCode}] Văn phòng bổ sung cont ${contNo} (${input.size}${input.type}, Xe ${truckNo}, SĐT ${driverPhone}) & lập chứng từ ${voucherNo}: ${amount.toLocaleString('vi-VN')}đ`,
    order.masterDossierCode
  );
}

// ============================================================================
// 3. VĂN PHÒNG — Thanh toán (TTT / TTS / TTTT) → GATE IN OK khi đã thanh toán / xác nhận hợp lệ
// ============================================================================
export function confirmGateInPaymentAndComplete(
  state: DepotState,
  input: { gateInId: string } & SettleVoucherInput
): DepotState {
  const order = state.gateInOrders.find((o) => o.id === input.gateInId);
  if (!order) throw new Error('Không tìm thấy lượt Hạ vỏ.');
  if (order.status === 'GATE_IN_OK') throw new Error('Lượt Hạ vỏ này đã ở trạng thái GATE IN OK.');
  if (order.status === 'CANCELLED') throw new Error('Lượt Hạ vỏ đã bị hủy.');
  if (!order.containerNo || !order.voucherId) {
    throw new Error('Chưa hoàn tất bước Văn phòng kiểm tra chứng từ và lập chi phí (GIN-004).');
  }
  const voucher = state.vouchers.find((v) => v.id === order.voucherId);
  if (!voucher) throw new Error('Không tìm thấy chứng từ thanh toán.');

  let next = state;
  let outcome: SettleOutcome = 'SETTLED';
  if (voucher.status === 'PENDING') {
    ({ state: next, outcome } = settleVoucher(state, voucher.id, input));
  } else if (!isVoucherSettled(voucher)) {
    throw new Error(`Chứng từ ${voucher.voucherNo} ở trạng thái ${voucher.status}, không thể hoàn tất Hạ vỏ.`);
  }
  if (outcome === 'AWAITING_TRANSFER') return next;
  return completeGateIn(next, order.id);
}

// Hoàn tất GATE IN OK: chỉ khi chứng từ CONFIRMED (đã thu / đã trừ quỹ) hoặc DEFERRED (TTS hợp lệ)
function completeGateIn(state: DepotState, gateInId: string, actor?: Actor): DepotState {
  const order = state.gateInOrders.find((o) => o.id === gateInId);
  if (!order || !order.containerNo || !order.size || !order.type) {
    throw new Error('Hồ sơ Hạ vỏ chưa đủ thông tin để hoàn tất.');
  }
  if (order.status === 'GATE_IN_OK') return state;
  const voucher = state.vouchers.find((v) => v.id === order.voucherId);
  if (!isVoucherSettled(voucher)) {
    throw new Error('Không thể cập nhật GATE IN OK khi chưa thanh toán / xác nhận thanh toán hợp lệ (GIN-004).');
  }
  if (findActiveContainer(state, order.containerNo)) {
    throw new Error(`Container ${order.containerNo} đang có lượt lưu bãi chưa OUT.`);
  }
  const actorName = actor?.name || state.currentUser.fullName;
  const now = nowIso();
  const isDamage = order.conditionClass === 'DAMAGE';
  const requiresCleaning = order.cleaningItems.some((item) => item !== 'KHÔNG VỆ SINH');

  // DEC-024 & CR-03: có yêu cầu vệ sinh thì Vệ sinh xác nhận xong mới vào hàng chờ Xe nâng hạ vỏ
  const nextDepartments: string[] = requiresCleaning
    ? [`VỆ SINH - CHỜ VỆ SINH (${order.cleaningItems.join(', ')})`, 'XE NÂNG - CHỜ HẠ VỎ (sau khi vệ sinh xong)']
    : ['XE NÂNG - CHỜ HẠ VỎ'];
  if (isDamage) nextDepartments.push('BÁO GIÁ - CHỜ BÁO GIÁ');

  const newWorkOrders: ServiceWorkOrder[] = [];
  if (isDamage) {
    newWorkOrders.push({
      id: newId('wo'),
      masterDossierCode: order.masterDossierCode,
      workOrderCode: `INSP-${order.masterDossierCode}`,
      containerNo: order.containerNo,
      category: 'INSPECTION',
      sourceOrderCode: order.orderCode,
      items: order.damageRemarks.length > 0 ? [...order.damageRemarks] : ['Hư hỏng ghi nhận khi Hạ vỏ'],
      estimateCost: 0,
      approvalStatus: 'NOT_REQUIRED',
      workStatus: 'OPEN',
      assignedTo: 'Bộ phận Báo giá',
      createdAt: now,
    });
  }
  if (requiresCleaning) {
    newWorkOrders.push({
      id: newId('wo'),
      masterDossierCode: order.masterDossierCode,
      workOrderCode: `CLN-${order.masterDossierCode}`,
      containerNo: order.containerNo,
      category: 'CLEANING',
      sourceOrderCode: order.orderCode,
      items: [...order.cleaningItems],
      estimateCost: 0,
      approvalStatus: 'NOT_REQUIRED',
      workStatus: 'OPEN',
      assignedTo: 'Bộ phận Vệ sinh',
      createdAt: now,
    });
  }

  // DEC-057: QR duy nhất theo mã hồ sơ (không theo số container — container quay lại bãi sẽ có QR mới)
  const k80QrCode = `QR-${order.masterDossierCode}`;
  const ticket: K80InternalTicket = {
    ticketCode: `K80-${order.masterDossierCode}`,
    masterDossierCode: order.masterDossierCode,
    qrCode: k80QrCode,
    operationMode: 'HA_VO',
    isPaid: voucher!.status === 'CONFIRMED',
    paymentLabel: paymentLabelOf(voucher!),
    containerNo: order.containerNo,
    size: order.size,
    type: order.type,
    conditionClass: order.conditionClass,
    damageRemarks: order.damageRemarks,
    stuffingClass: order.stuffingClass,
    cleaningItems: order.cleaningItems,
    manufactureYear: order.manufactureYear,
    truckNo: order.truckNo,
    driverPhone: order.driverPhone,
    customerRep: order.customerRep,
    issuedAt: now,
    issuedBy: actorName,
  };

  const container: ContainerRecord = {
    id: newId('cnt'),
    masterDossierCode: order.masterDossierCode,
    containerNo: order.containerNo,
    size: order.size,
    type: order.type,
    manufactureYear: order.manufactureYear,
    shippingLineCode: order.shippingLineCode || '',
    customerRep: order.customerRep || '',
    truckNo: order.truckNo,
    driverPhone: order.driverPhone,
    status: 'WAITING_PLACEMENT',
    conditionClass: order.conditionClass,
    damageRemarks: order.damageRemarks || [],
    stuffingClass: order.stuffingClass,
    cleaningItems: order.cleaningItems,
    activeQrCode: k80QrCode,
    isPaid: voucher!.status === 'CONFIRMED',
    currentBlock: null,
    currentBay: null,
    currentRow: null,
    currentTier: null,
    needsCleaning: requiresCleaning,
    needsQuotation: isDamage,
    needsRepair: false,
    forkliftShiftTask: order.toInspectionRack ? 'HA_KE_GIAM_DINH' : 'NONE', // DEC-109
    isOnHold: false,
    gateInAt: now,
  };

  return appendAudit(
    {
      ...state,
      gateInOrders: state.gateInOrders.map((o) =>
        o.id === order.id
          ? { ...o, k80QrCode, status: 'GATE_IN_OK' as const, gateInOkAt: now, gateInOkBy: actorName, nextDepartments }
          : o
      ),
      workOrders: [...newWorkOrders, ...state.workOrders],
      k80Tickets: [ticket, ...state.k80Tickets],
      // Giữ lại các lượt lưu bãi cũ đã OUT của cùng số container làm lịch sử
      containers: [container, ...state.containers],
    },
    `GATE_IN_OK_${voucher!.paymentCategory || 'PAID'}`,
    'GATE_IN',
    order.masterDossierCode,
    `[Hồ sơ ${order.masterDossierCode}] GATE IN OK cho ${order.containerNo} (${paymentLabelOf(voucher!)}) -> In phiếu K80 [${k80QrCode}] -> ${nextDepartments.join(' + ')}`,
    order.masterDossierCode,
    actor
  );
}

// ============================================================================
// 4. BỘ PHẬN XE NÂNG — CHỜ HẠ VỎ: ghi nhận vị trí chính thức đầu tiên
// ============================================================================
export function updateContainerLocation(
  state: DepotState,
  input: {
    containerNo?: string;
    scannedQrCode?: string;
    blockCode: string;
    bay?: string;
    row?: string;
    tier?: string;
    reason: string;
  }
): DepotState {
  assertPermission(state, 'FORKLIFT_OPS', 'chỉ Bộ phận Xe nâng / Hiện trường / Văn phòng / Quản lý mới được hạ vỏ.');
  const container =
    findActiveContainer(state, input.containerNo) || findActiveContainerByCode(state, input.scannedQrCode);
  if (!container) {
    throw new Error('Không tìm thấy container tương ứng với mã QR / Mã hồ sơ / số container vừa quét.');
  }
  if (container.status !== 'WAITING_PLACEMENT') {
    throw new Error(`Container ${container.containerNo} không nằm trong hàng chờ HẠ VỎ (dùng ĐẢO CHUYỂN cho container đã tồn bãi).`);
  }
  if (container.needsCleaning) {
    throw new Error(
      `Container ${container.containerNo} có yêu cầu vệ sinh — Bộ phận Vệ sinh phải xác nhận hoàn tất trước khi Xe nâng hạ vỏ (CR-03).`
    );
  }
  // DEC-109: cont HẠ KỆ GIÁM ĐỊNH chỉ được hạ vào block Admin đánh dấu là Kệ giám định
  if (container.forkliftShiftTask === 'HA_KE_GIAM_DINH') {
    const racks = state.yardBlocks.filter((b) => b.isInspectionRack);
    if (!racks.length) throw new Error('Chưa có KỆ GIÁM ĐỊNH trong Danh mục Vị trí — Admin cần đánh dấu block Kệ giám định.');
    if (!racks.some((b) => b.blockCode === input.blockCode)) {
      throw new Error(`Container ${container.containerNo} phải HẠ KỆ GIÁM ĐỊNH (${racks.map((b) => b.blockCode).join(' / ')}), không hạ về bay.`);
    }
  }
  const slot = validateTargetSlot(state, container, input);
  const toLabel = formatLocation({
    currentBlock: slot.block,
    currentBay: slot.bay,
    currentRow: slot.row,
    currentTier: slot.tier,
  });
  if (container.swapReturn) return placeSwapReturn(state, container, slot, toLabel, input.reason);

  const next = updateContainerById(state, container.id, {
    status: 'IN_YARD',
    currentBlock: slot.block,
    currentBay: slot.bay,
    currentRow: slot.row,
    currentTier: slot.tier,
  });
  // DEC-069: cont NHẬP TÀU được xe nâng hạ → hoàn thành trong danh sách tàu
  return markVesselImportPlaced(appendAudit(
    {
      ...next,
      locationHistory: [
        {
          id: newId('loc'),
          masterDossierCode: container.masterDossierCode,
          containerNo: container.containerNo,
          fromLocation: 'Chờ hạ vỏ (GATE IN)',
          toLocation: toLabel,
          actionType: 'INITIAL_BLOCK',
          reason: input.reason.trim() || 'Xe nâng hạ vỏ',
          performedBy: state.currentUser.fullName,
          performedAt: nowIso(),
        },
        ...next.locationHistory,
      ],
    },
    'YARD_PLACEMENT',
    'CONTAINER',
    container.masterDossierCode,
    `[Hồ sơ ${container.masterDossierCode}] Xe nâng hạ vỏ ${container.containerNo} vào ${toLabel}`,
    container.masterDossierCode
  ), container.id);
}

// DEC-185 / DEC-192: việc Báo giá cho cont PHÁT SINH CẤP VỎ (hư hỏng phát hiện khi cấp vỏ)
function releaseDamageWorkOrder(container: ContainerRecord, gateOutCode: string, now: string): ServiceWorkOrder {
  return {
    id: newId('wo'),
    masterDossierCode: container.masterDossierCode,
    workOrderCode: `INSP-${container.masterDossierCode}-PS`,
    containerNo: container.containerNo,
    category: 'INSPECTION',
    sourceOrderCode: gateOutCode,
    items: container.damageRemarks.length ? [...container.damageRemarks] : ['Hư hỏng phát sinh khi cấp vỏ'],
    estimateCost: 0,
    approvalStatus: 'NOT_REQUIRED',
    workStatus: 'OPEN',
    assignedTo: 'Bộ phận Báo giá',
    createdAt: now,
  };
}

// DEC-185: Xe nâng HẠ LẠI cont bị ĐỔI CONTAINER (vị trí mới do Xe nâng chọn).
// Kén vỏ → tồn bãi, cấp được cho khách khác. Hư hỏng → CHỜ BÁO GIÁ (nhãn PHÁT SINH CẤP VỎ), rồi Sửa chữa như luồng thường.
function placeSwapReturn(
  state: DepotState,
  container: ContainerRecord,
  slot: { block: string; bay: string | null; row: string | null; tier: string | null },
  toLabel: string,
  reason: string
): DepotState {
  const swap = container.swapReturn!;
  const isDamage = swap.reason === 'DAMAGE';
  const now = nowIso();
  let next = updateContainerById(state, container.id, {
    status: 'IN_YARD',
    currentBlock: slot.block,
    currentBay: slot.bay,
    currentRow: slot.row,
    currentTier: slot.tier,
    swapReturn: undefined,
    needsQuotation: isDamage || container.needsQuotation,
  });
  next = {
    ...next,
    locationHistory: [
      {
        id: newId('loc'),
        masterDossierCode: container.masterDossierCode,
        containerNo: container.containerNo,
        fromLocation: `Đổi container (${swap.gateOutCode})`,
        toLocation: toLabel,
        actionType: 'SWAP_RETURN',
        reason: reason.trim() || SWAP_REASON_LABELS[swap.reason],
        performedBy: state.currentUser.fullName,
        performedAt: now,
      },
      ...next.locationHistory,
    ],
    workOrders: isDamage ? [releaseDamageWorkOrder(container, swap.gateOutCode, now), ...next.workOrders] : next.workOrders,
  };
  return appendAudit(
    next,
    'SWAP_RETURN_PLACEMENT',
    'CONTAINER',
    container.masterDossierCode,
    `[Hồ sơ ${container.masterDossierCode}] Xe nâng hạ lại ${container.containerNo} (đổi container ${swap.gateOutCode}) vào ${toLabel}${isDamage ? ' → CHỜ BÁO GIÁ (PHÁT SINH CẤP VỎ)' : ''}`,
    container.masterDossierCode
  );
}

// ============================================================================
// 5. XE NÂNG — ĐẢO CHUYỂN (CR-01): tác nghiệp vận hành, lưu lịch sử trước/sau
// ============================================================================
function assertInYardWithPosition(container: ContainerRecord | undefined): ContainerRecord {
  if (!container) throw new Error('Không tìm thấy container đang tồn bãi.');
  if ((container.status !== 'IN_YARD' && container.status !== 'ALLOCATED') || !container.currentBlock) {
    throw new Error(`Container ${container.containerNo} chưa có vị trí chính thức trong bãi.`);
  }
  return container;
}

export function shiftContainer(
  state: DepotState,
  input: { containerId: string; blockCode: string; bay?: string; row?: string; tier?: string; note?: string }
): DepotState {
  assertPermission(state, 'FORKLIFT_OPS', 'chỉ Bộ phận Xe nâng / Hiện trường / Văn phòng / Quản lý mới được đảo chuyển.');
  const container = assertInYardWithPosition(state.containers.find((c) => c.id === input.containerId));
  const slot = validateTargetSlot(state, container, input);
  const fromLabel = formatLocation(container);
  const toLabel = formatLocation({
    currentBlock: slot.block,
    currentBay: slot.bay,
    currentRow: slot.row,
    currentTier: slot.tier,
  });
  if (fromLabel === toLabel) throw new Error('Vị trí mới trùng với vị trí hiện tại.');

  const next = updateContainerById(state, container.id, {
    currentBlock: slot.block,
    currentBay: slot.bay,
    currentRow: slot.row,
    currentTier: slot.tier,
    forkliftShiftTask: 'NONE',
  });
  return appendAudit(
    {
      ...next,
      locationHistory: [
        {
          id: newId('loc'),
          masterDossierCode: container.masterDossierCode,
          containerNo: container.containerNo,
          fromLocation: fromLabel,
          toLocation: toLabel,
          actionType: 'YARD_SHIFT',
          reason: input.note?.trim() || 'ĐẢO CHUYỂN',
          performedBy: state.currentUser.fullName,
          performedAt: nowIso(),
        },
        ...next.locationHistory,
      ],
    },
    'YARD_SHIFT',
    'CONTAINER',
    container.masterDossierCode,
    `[Hồ sơ ${container.masterDossierCode}] ĐẢO CHUYỂN ${container.containerNo}: ${fromLabel} -> ${toLabel}`,
    container.masterDossierCode
  );
}

// ============================================================================
// 6. TỒN VỎ — SỬA VỊ TRÍ hành chính (CR-02): không tạo lịch sử tác nghiệp ĐẢO CHUYỂN
// ============================================================================
export function correctContainerLocation(
  state: DepotState,
  input: { containerId: string; blockCode: string; bay?: string; row?: string; tier?: string }
): DepotState {
  assertPermission(state, 'YARD_LOCATION_CORRECT', 'chỉ Văn phòng / Quản lý được sửa vị trí bãi.');
  const container = assertInYardWithPosition(state.containers.find((c) => c.id === input.containerId));
  const slot = validateTargetSlot(state, container, input);
  const fromLabel = formatLocation(container);
  const toLabel = formatLocation({
    currentBlock: slot.block,
    currentBay: slot.bay,
    currentRow: slot.row,
    currentTier: slot.tier,
  });
  if (fromLabel === toLabel) throw new Error('Vị trí mới trùng với vị trí hiện tại.');

  const next = updateContainerById(state, container.id, {
    currentBlock: slot.block,
    currentBay: slot.bay,
    currentRow: slot.row,
    currentTier: slot.tier,
  });
  // Chỉ ghi nhật ký kiểm toán hệ thống (ai sửa, sửa gì); không phải lịch sử tác nghiệp Xe nâng
  return appendAudit(
    next,
    'YARD_LOCATION_CORRECTION',
    'CONTAINER',
    container.masterDossierCode,
    `[Hồ sơ ${container.masterDossierCode}] Văn phòng SỬA VỊ TRÍ ${container.containerNo}: ${fromLabel} -> ${toLabel}`,
    container.masterDossierCode
  );
}

// ============================================================================
// 7. BỘ PHẬN VỆ SINH — CHỜ VỆ SINH (Văn phòng được hoàn tất thay — DEC-035)
// ============================================================================
export function completeCleaningTask(
  state: DepotState,
  input: { containerNo?: string; scannedQrCode?: string; notes?: string }
): DepotState {
  assertPermission(state, 'CLEANING_COMPLETE', 'chỉ Bộ phận Vệ sinh / Văn phòng được xác nhận hoàn tất vệ sinh.');
  const container =
    findActiveContainer(state, input.containerNo) || findActiveContainerByCode(state, input.scannedQrCode);
  if (!container || !container.needsCleaning) {
    throw new Error('Không tìm thấy container đang chờ vệ sinh khớp với mã QR / Mã hồ sơ / số container.');
  }
  const now = nowIso();
  const next = updateContainerById(state, container.id, { needsCleaning: false });
  return appendAudit(
    {
      ...next,
      workOrders: next.workOrders.map((w) =>
        w.masterDossierCode === container.masterDossierCode && w.category === 'CLEANING' && w.workStatus === 'OPEN'
          ? {
              ...w,
              workStatus: 'COMPLETED' as const,
              completedAt: now,
              completedBy: state.currentUser.fullName,
              resultNotes: input.notes || 'Đã xác nhận hoàn thành vệ sinh',
            }
          : w
      ),
    },
    'COMPLETE_CLEANING',
    'CLEANING',
    container.masterDossierCode,
    `[Hồ sơ ${container.masterDossierCode}] Hoàn tất vệ sinh [${container.cleaningItems.join(', ')}] cho ${container.containerNo}`,
    container.masterDossierCode
  );
}

// ============================================================================
// 8. BỘ PHẬN BÁO GIÁ — CHỜ BÁO GIÁ (vai trò riêng QUOTATION — DEC-026)
// ============================================================================
export function approveDamageQuotation(
  state: DepotState,
  // DEC-040: Báo giá chỉ cần REMARK SỬA CHỮA; số tiền không bắt buộc (chưa có API hãng tàu duyệt)
  // DEC-041: bắt buộc GIỜ CÔNG SỬA CHỮA
  input: { containerNo: string; quotationItems: string[]; laborHours: number; quotationAmount?: number }
): DepotState {
  assertPermission(state, 'QUOTATION', 'chỉ Bộ phận Báo giá được xác nhận báo giá.');
  const container = findActiveContainer(state, input.containerNo);
  if (!container || !container.needsQuotation) throw new Error('Container không nằm trong hàng chờ Báo giá.');
  const amount = input.quotationAmount === undefined ? 0 : Number(input.quotationAmount);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Số tiền báo giá không hợp lệ.');
  const items = input.quotationItems.map((i) => i.trim()).filter(Boolean);
  if (items.length === 0) throw new Error('Vui lòng nhập REMARK SỬA CHỮA.');
  const laborHours = Number(input.laborHours);
  if (!Number.isFinite(laborHours) || laborHours <= 0 || laborHours > 1000) {
    throw new Error('Vui lòng nhập GIỜ CÔNG SỬA CHỮA lớn hơn 0.');
  }
  const now = nowIso();

  const next = updateContainerById(state, container.id, {
    needsQuotation: false,
    needsRepair: true,
    quotationAmount: amount,
    quotationItems: items,
    quotationLaborHours: laborHours,
  });
  const repairWo: ServiceWorkOrder = {
    id: newId('wo'),
    masterDossierCode: container.masterDossierCode,
    workOrderCode: `MNR-${container.masterDossierCode}`,
    containerNo: container.containerNo,
    category: 'REPAIR',
    sourceOrderCode: container.masterDossierCode,
    items,
    estimateCost: amount,
    laborHours,
    approvalStatus: 'APPROVED',
    approvedBy: state.currentUser.fullName,
    workStatus: 'OPEN',
    assignedTo: 'Bộ phận Sửa chữa',
    createdAt: now,
  };
  return appendAudit(
    {
      ...next,
      workOrders: [
        repairWo,
        ...next.workOrders.map((w) =>
          w.masterDossierCode === container.masterDossierCode && w.category === 'INSPECTION' && w.workStatus === 'OPEN'
            ? { ...w, workStatus: 'COMPLETED' as const, completedAt: now, completedBy: state.currentUser.fullName }
            : w
        ),
      ],
    },
    'APPROVE_QUOTATION',
    'QUOTATION',
    container.masterDossierCode,
    `[Hồ sơ ${container.masterDossierCode}] Báo giá ${container.containerNo}: REMARK [${items.join(', ')}] • ${laborHours} giờ công${amount ? ` • ${amount.toLocaleString('vi-VN')}đ` : ''} -> CHỜ SỬA CHỮA`,
    container.masterDossierCode
  );
}

// DEC-086: BÁO GIÁ 2 bước — (1) cập nhật TÌNH TRẠNG SỬA CHỮA thực tế + GIỜ CÔNG (lưu, vẫn ở Chờ báo giá)
//   (2) XÁC NHẬN CHỜ SỬA CHỮA → chuyển bộ phận Sửa chữa (dùng đúng nội dung đã lưu)
export function saveQuotationDraft(
  state: DepotState,
  input: { containerNo: string; quotationItems: string[]; laborHours: number }
): DepotState {
  assertPermission(state, 'QUOTATION', 'chỉ Bộ phận Báo giá được cập nhật báo giá.');
  const container = findActiveContainer(state, input.containerNo);
  if (!container || !container.needsQuotation) throw new Error('Container không nằm trong hàng chờ Báo giá.');
  const items = input.quotationItems.map((i) => i.trim()).filter(Boolean);
  if (items.length === 0) throw new Error('Vui lòng nhập TÌNH TRẠNG SỬA CHỮA.');
  const laborHours = Number(input.laborHours);
  if (!Number.isFinite(laborHours) || laborHours <= 0 || laborHours > 1000) {
    throw new Error('Vui lòng nhập GIỜ CÔNG SỬA CHỮA lớn hơn 0.');
  }
  const next = updateContainerById(state, container.id, {
    quotationItems: items,
    quotationLaborHours: laborHours,
    quotationUpdatedBy: state.currentUser.fullName,
    quotationUpdatedAt: nowIso(),
  });
  return appendAudit(
    next,
    'SAVE_QUOTATION',
    'QUOTATION',
    container.masterDossierCode,
    `[Hồ sơ ${container.masterDossierCode}] Báo giá cập nhật ${container.containerNo}: TÌNH TRẠNG SỬA CHỮA [${items.join(', ')}] • ${laborHours} giờ công (chưa chuyển sửa chữa)`,
    container.masterDossierCode
  );
}

export function confirmQuotationToRepair(state: DepotState, input: { containerNo: string }): DepotState {
  assertPermission(state, 'QUOTATION', 'chỉ Bộ phận Báo giá được xác nhận báo giá.');
  const container = findActiveContainer(state, input.containerNo);
  if (!container || !container.needsQuotation) throw new Error('Container không nằm trong hàng chờ Báo giá.');
  if (!container.quotationItems?.length || !(Number(container.quotationLaborHours) > 0)) {
    throw new Error(`Chưa cập nhật TÌNH TRẠNG SỬA CHỮA / GIỜ CÔNG cho ${container.containerNo} — bấm "Cập nhật" trước.`);
  }
  return approveDamageQuotation(state, {
    containerNo: container.containerNo,
    quotationItems: container.quotationItems,
    laborHours: Number(container.quotationLaborHours),
  });
}

// ============================================================================
// 9. BỘ PHẬN SỬA CHỮA — CHỜ SỬA CHỮA: hoàn tất -> AV
// ============================================================================
// DEC-176: ảnh HOÀN THÀNH SỬA CHỮA — tối thiểu 1, tối đa 30 ảnh / cont
export const REPAIR_PHOTO_MIN = 1;
export const REPAIR_PHOTO_MAX = 30;

export function completeRepairTask(
  state: DepotState,
  // DEC-043: bắt buộc chọn TỔ SỬA CHỮA và ít nhất 1 thành viên đang hoạt động của tổ
  input: { containerNo?: string; scannedQrCode?: string; notes?: string; teamId: string; memberIds: string[]; photos: string[] }
): DepotState {
  assertPermission(state, 'REPAIR', 'chỉ Bộ phận Sửa chữa được xác nhận hoàn tất sửa chữa.');
  const container =
    findActiveContainer(state, input.containerNo) || findActiveContainerByCode(state, input.scannedQrCode);
  if (!container || !container.needsRepair) {
    throw new Error('Không tìm thấy container đang chờ sửa chữa khớp với mã QR / Mã hồ sơ / số container.');
  }
  const team = state.repairTeams.find((t) => t.id === input.teamId && t.isActive);
  if (!team) throw new Error('Vui lòng chọn TỔ SỬA CHỮA.');
  const members = team.members.filter((m) => m.isActive && input.memberIds.includes(m.id));
  if (members.length === 0) throw new Error('Phải chọn ít nhất 1 nhân viên trong tổ sửa chữa.');
  if (members.length !== new Set(input.memberIds).size) {
    throw new Error('Có nhân viên không thuộc tổ đã chọn hoặc đã ngưng hoạt động.');
  }
  const photos = (input.photos || []).filter(Boolean);
  if (photos.length < REPAIR_PHOTO_MIN) throw new Error('Vui lòng CHỤP ẢNH HOÀN THÀNH SỬA CHỮA (ít nhất 1 ảnh).');
  if (photos.length > REPAIR_PHOTO_MAX) throw new Error(`Tối đa ${REPAIR_PHOTO_MAX} ảnh hoàn thành sửa chữa / container.`);
  const memberNames = members.map((m) => m.fullName);
  const now = nowIso();
  const next = updateContainerById(state, container.id, {
    // DEC-049: bỏ QC — Sửa chữa hoàn tất là chuyển AV
    needsRepair: false,
    conditionClass: 'AV',
    damageRemarks: [],
  });
  return appendAudit(
    {
      ...next,
      workOrders: next.workOrders.map((w) =>
        w.masterDossierCode === container.masterDossierCode && w.category === 'REPAIR' && w.workStatus === 'OPEN'
          ? {
              ...w,
              workStatus: 'COMPLETED' as const,
              completedAt: now,
              completedBy: state.currentUser.fullName,
              resultNotes: input.notes || 'Đã sửa chữa hoàn tất -> AV',
              repairTeamCode: team.code,
              repairTeamName: team.name,
              repairMembers: memberNames,
              // DEC-174: chốt đơn giá bậc thợ tại thời điểm sửa xong
              repairMemberRates: members.map((m) => {
                const g = (state.repairGrades || []).find((x) => x.id === m.gradeId);
                return { name: m.fullName, gradeName: g?.name, hourlyRate: g?.hourlyRate };
              }),
              repairPhotos: photos,
            }
          : w
      ),
    },
    'COMPLETE_REPAIR_TO_AV',
    'REPAIR',
    container.masterDossierCode,
    `[Hồ sơ ${container.masterDossierCode}] Hoàn tất sửa chữa ${container.containerNo} -> AV • ${team.name}: ${memberNames.join(', ')}`,
    container.masterDossierCode
  );
}

// ============================================================================
// 10. KHÓA CONTAINER (Tạm giữ / Khóa xuất) — CR-02, DEC-030
// ============================================================================
export function toggleContainerHold(
  state: DepotState,
  input: { containerNo: string; hold: boolean; reason: string }
): DepotState {
  assertPermission(state, 'CONTAINER_LOCK', 'chỉ Văn phòng / Quản lý được khóa / mở khóa container.');
  const reason = input.reason.trim();
  if (!reason) {
    throw new Error(input.hold ? 'Bắt buộc nhập REMARK VĂN PHÒNG khi khóa container.' : 'Bắt buộc nhập ghi chú khi mở khóa container.');
  }
  const container = findActiveContainer(state, input.containerNo);
  if (!container) throw new Error('Không tìm thấy container đang tồn bãi.');
  // DEC-131: khóa do danh sách XUẤT TÀU chỉ gỡ bằng cách bỏ cont khỏi danh sách / duyệt danh sách
  if (container.holdSource === 'VESSEL_EXPORT') throw new Error(`Container ${container.containerNo} đang khóa do ${container.holdReason} — bỏ khỏi danh sách Xuất tàu để mở khóa.`);
  if (container.isOnHold === input.hold) {
    throw new Error(input.hold ? 'Container đã đang bị khóa.' : 'Container hiện không bị khóa.');
  }
  const next = updateContainerById(state, container.id, {
    isOnHold: input.hold,
    holdReason: input.hold ? reason : undefined,
    holdBy: input.hold ? state.currentUser.fullName : undefined,
    holdAt: input.hold ? nowIso() : undefined,
    // DEC-065: nội dung khóa chính là Remark Văn phòng (ghi chú tồn vỏ)
    ...(input.hold ? { officeNote: reason, officeNoteUpdatedBy: state.currentUser.fullName, officeNoteUpdatedAt: nowIso() } : {}),
  });
  return appendAudit(
    next,
    input.hold ? 'CONTAINER_LOCK' : 'CONTAINER_UNLOCK',
    'CONTAINER',
    container.masterDossierCode,
    `[Hồ sơ ${container.masterDossierCode}] ${input.hold ? 'KHÓA' : 'MỞ KHÓA'} container ${container.containerNo}: ${reason}`,
    container.masterDossierCode
  );
}

// ============================================================================
// 11. CẤP VỎ — điều kiện, lập lệnh (thu phí tại Văn phòng như Hạ vỏ), xuất bãi
// ============================================================================

// DEC-027: AV đã xong toàn bộ quy trình; DAMAGE được cấp theo chỉ định riêng; không cấp khi còn chờ vệ sinh / bị khóa
export function releaseBlocker(c: ContainerRecord): string | null {
  if (c.status !== 'IN_YARD') {
    return c.status === 'ALLOCATED' ? 'Đã lập lệnh cấp' : 'Chưa tồn bãi (chờ hạ vỏ)';
  }
  if (c.vesselExportItemId) return 'Đang trong danh sách XUẤT TÀU';
  if (c.isOnHold) return 'Container đang bị KHÓA';
  if (c.needsCleaning) return 'Chưa xác nhận vệ sinh';
  if (c.conditionClass === CONDITION_DEFERRED) return 'Chưa giám định (W-SURVEY)'; // DEC-147
  if (c.conditionClass === 'AV' && (c.needsQuotation || c.needsRepair)) return 'Chưa hoàn tất báo giá / sửa chữa';
  return null;
}

// DEC-065: container chỉ vướng KHÓA — vẫn hiện ở Cấp vỏ nhưng phải mở khóa trước khi cấp
export function blockedOnlyByHold(c: ContainerRecord): boolean {
  return Boolean(c.isOnHold) && releaseBlocker({ ...c, isOnHold: false }) === null;
}

export interface BookingSummary {
  booking?: ReleaseBooking;
  orders: GateOutOrder[];
  issued: GateOutOrder[];          // Đã lập lệnh (không tính đã hủy)
  waitingPayment: GateOutOrder[];
  waitingForklift: GateOutOrder[];
  gatedOut: GateOutOrder[];
  cancelled: GateOutOrder[];
}

export function getBookingSummary(state: DepotState, rawBookingNo: string): BookingSummary {
  const bookingNo = rawBookingNo.trim().toUpperCase();
  const orders = state.gateOutOrders.filter((o) => o.bookingNo.toUpperCase() === bookingNo);
  return {
    booking: state.bookings.find((b) => b.bookingNo.toUpperCase() === bookingNo),
    orders,
    issued: orders.filter((o) => o.status !== 'CANCELLED'),
    waitingPayment: orders.filter((o) => o.status === 'PAYMENT_PENDING'),
    waitingForklift: orders.filter((o) => o.status === 'PENDING_FORKLIFT'),
    gatedOut: orders.filter((o) => o.status === 'GATE_OUT_OK'),
    cancelled: orders.filter((o) => o.status === 'CANCELLED'),
  };
}

export function createReleaseOrder(
  state: DepotState,
  input: {
    bookingNo: string;
    customerName: string;
    containerNo: string;
    truckNo: string;
    driverPhone: string;
    feeCatalogIds: string[];
    releasePurpose?: ReleasePurpose; // DEC-194: mặc định Release for customer
    saleCode?: string;
  }
): DepotState {
  assertPermission(state, 'RELEASE_ORDER', 'chỉ Văn phòng / Quản lý được lập lệnh CẤP VỎ.');
  const purpose: ReleasePurpose = input.releasePurpose || 'CUSTOMER';
  if (!RELEASE_PURPOSE_LABELS[purpose]) throw new Error('Tác nghiệp cấp vỏ không hợp lệ.');
  const saleCode = purpose === 'SALE' ? (input.saleCode || '').trim().toUpperCase() : '';
  if (purpose === 'SALE' && !saleCode) throw new Error('Release for sale: vui lòng nhập SALE CODE.');
  if (saleCode.length > 40) throw new Error('SALE CODE tối đa 40 ký tự.');
  const bookingNo = input.bookingNo.trim().toUpperCase();
  if (!bookingNo) throw new Error('Vui lòng nhập SỐ BOOKING.');
  const customerName = normalizeCustomer(state, input.customerName);
  const container = findActiveContainer(state, input.containerNo);
  if (!container) throw new Error('Không tìm thấy container đang tồn bãi.');
  const blocker = releaseBlocker(container);
  if (blocker) throw new Error(`Container ${container.containerNo} chưa đủ điều kiện CẤP VỎ: ${blocker}.`);
  // DEC-199: cont Maersk cấp cho khách — booking 9–11 chữ số (eEIR gate-out); cấp sale dùng Sale code nên không kiểm
  if (purpose === 'CUSTOMER' && isMaerskLine(container.shippingLineCode) && !isMaerskBooking(bookingNo)) throw new Error(MAERSK_BOOKING_ERROR);
  const truckNo = input.truckNo.trim().toUpperCase();
  if (!truckNo) throw new Error('Vui lòng nhập SỐ XE.');
  const driverPhone = normalizeDriverPhone(input.driverPhone);
  const feeLines = buildFeeLines(state, input.feeCatalogIds);
  const amount = sumFees(feeLines);

  let next = state;
  let booking = next.bookings.find((b) => b.bookingNo.toUpperCase() === bookingNo);
  if (booking) {
    if (booking.status === 'CANCELLED') throw new Error(`Booking ${bookingNo} đã bị hủy.`);
    if (booking.size !== container.size || booking.type !== container.type) {
      throw new Error(
        `Kích cỡ/Loại container (${container.size}${container.type}) không khớp Booking ${bookingNo} (${booking.size}${booking.type}).`
      );
    }
    const summary = getBookingSummary(next, bookingNo);
    if (booking.requestedQty && summary.issued.length >= booking.requestedQty) {
      throw new Error(`Booking ${bookingNo} đã cấp đủ ${booking.requestedQty} container.`);
    }
  } else {
    booking = {
      id: newId('bk'),
      bookingNo,
      releaseType: 'EMPTY_RELEASE',
      shippingLineCode: container.shippingLineCode,
      requesterName: customerName,
      receiverName: customerName,
      size: container.size,
      type: container.type,
      allocatedContainers: [],
      gatedOutContainers: [],
      releasedContainers: [],
      status: 'OPEN',
      createdAt: nowIso(),
    };
    next = { ...next, bookings: [booking, ...next.bookings] };
  }

  const outCode = allocateCode(next, 'CV');
  next = outCode.state;

  const voucher = {
    id: newId('vch'),
    masterDossierCode: container.masterDossierCode,
    voucherNo: outCode.code, // DEC-119: số chứng từ = mã hồ sơ CẤP VỎ
    serviceType: 'GATE_OUT' as const,
    referenceCode: outCode.code,
    containerNo: container.containerNo,
    shippingLineCode: container.shippingLineCode,
    payerName: customerName,
    amount,
    feeLines,
    status: 'PENDING' as const,
    createdBy: state.currentUser.fullName,
    createdAt: nowIso(),
  };
  const order: GateOutOrder = {
    id: newId('gout'),
    masterDossierCode: container.masterDossierCode,
    gateOutCode: outCode.code,
    gateOutType: 'EMPTY_RELEASE',
    bookingNo,
    containerNo: container.containerNo,
    truckNo,
    driverPhone,
    receiverRep: customerName,
    feeLines,
    feeAmount: amount,
    voucherId: voucher.id,
    voucherNo: voucher.voucherNo,
    k80QrCode: '',
    chkValidOrder: true,
    chkNotOnHold: true,
    chkCorrectContainer: true,
    chkPaymentSettled: false,
    chkDocumentsCompleted: true,
    status: 'PAYMENT_PENDING',
    createdBy: state.currentUser.fullName,
    createdAt: nowIso(),
    ...(purpose === 'SALE' ? { releasePurpose: 'SALE' as const, saleCode } : {}),
  };
  const bookingId = booking.id;
  next = updateContainerById(
    {
      ...next,
      vouchers: [voucher, ...next.vouchers],
      gateOutOrders: [order, ...next.gateOutOrders],
      bookings: next.bookings.map((b) =>
        b.id === bookingId ? { ...b, allocatedContainers: [...b.allocatedContainers, container.containerNo] } : b
      ),
    },
    container.id,
    {
      status: 'ALLOCATED',
      allocatedBookingNo: bookingNo,
      allocatedTruckNo: truckNo,
      allocatedDriverPhone: driverPhone,
      allocatedAt: nowIso(),
      outDossierCode: outCode.code,
    }
  );
  return appendAudit(
    next,
    'RELEASE_ORDER_CREATED',
    'GATE_OUT',
    outCode.code,
    `[Hồ sơ ${outCode.code}] Lập lệnh CẤP VỎ ${container.containerNo} (${container.conditionClass}) theo booking ${bookingNo}, xe ${truckNo}${purpose === 'SALE' ? `, Release for sale — Sale code ${saleCode}` : ''}; chứng từ ${voucher.voucherNo}: ${amount.toLocaleString('vi-VN')}đ`,
    container.masterDossierCode
  );
}

export function confirmReleasePayment(
  state: DepotState,
  input: { gateOutOrderId: string } & SettleVoucherInput
): DepotState {
  const order = state.gateOutOrders.find((o) => o.id === input.gateOutOrderId);
  if (!order) throw new Error('Không tìm thấy hồ sơ CẤP VỎ.');
  if (order.status !== 'PAYMENT_PENDING') throw new Error(`Hồ sơ ${order.gateOutCode} không ở trạng thái chờ thanh toán.`);
  const voucher = state.vouchers.find((v) => v.id === order.voucherId);
  if (!voucher) throw new Error('Không tìm thấy chứng từ thanh toán.');
  let next = state;
  let outcome: SettleOutcome = 'SETTLED';
  if (voucher.status === 'PENDING') {
    ({ state: next, outcome } = settleVoucher(state, voucher.id, input));
  } else if (!isVoucherSettled(voucher)) {
    throw new Error(`Chứng từ ${voucher.voucherNo} ở trạng thái ${voucher.status}.`);
  }
  if (outcome === 'AWAITING_TRANSFER') return next;
  return completeReleasePayment(next, order.id);
}

// Thanh toán xong -> in phiếu K80 CẤP VỎ & đẩy sang XE NÂNG - CHỜ CẤP VỎ
function completeReleasePayment(state: DepotState, gateOutOrderId: string, actor?: Actor): DepotState {
  const order = state.gateOutOrders.find((o) => o.id === gateOutOrderId);
  if (!order) throw new Error('Không tìm thấy hồ sơ CẤP VỎ.');
  if (order.status !== 'PAYMENT_PENDING') return state;
  const voucher = state.vouchers.find((v) => v.id === order.voucherId);
  if (!isVoucherSettled(voucher)) throw new Error('Chưa thanh toán / xác nhận thanh toán hợp lệ.');
  const container = findActiveContainer(state, order.containerNo);
  if (!container) throw new Error('Không tìm thấy container của hồ sơ CẤP VỎ.');
  const actorName = actor?.name || state.currentUser.fullName;
  const qrCode = `QR-${order.gateOutCode}`; // DEC-057: QR duy nhất theo hồ sơ CẤP VỎ
  const ticket: K80InternalTicket = {
    ticketCode: `K80-${order.gateOutCode}`,
    masterDossierCode: container.masterDossierCode,
    outDossierCode: order.gateOutCode,
    qrCode,
    operationMode: 'CAP_VO',
    isPaid: voucher!.status === 'CONFIRMED',
    paymentLabel: paymentLabelOf(voucher!),
    containerNo: container.containerNo,
    size: container.size,
    type: container.type,
    conditionClass: container.conditionClass,
    damageRemarks: container.damageRemarks,
    stuffingClass: container.stuffingClass,
    cleaningItems: container.cleaningItems,
    manufactureYear: container.manufactureYear,
    truckNo: order.truckNo,
    driverPhone: order.driverPhone,
    customerRep: order.receiverRep,
    targetBlock: container.currentBlock || undefined,
    issuedAt: nowIso(),
    issuedBy: actorName,
  };
  const next = updateContainerById(
    {
      ...state,
      k80Tickets: [ticket, ...state.k80Tickets],
      gateOutOrders: state.gateOutOrders.map((o) =>
        o.id === order.id ? { ...o, status: 'PENDING_FORKLIFT' as const, chkPaymentSettled: true, k80QrCode: qrCode } : o
      ),
    },
    container.id,
    { activeQrCode: qrCode }
  );
  return appendAudit(
    next,
    'RELEASE_ORDER_PAID',
    'GATE_OUT',
    order.gateOutCode,
    `[Hồ sơ ${order.gateOutCode}] ${paymentLabelOf(voucher!)} -> In phiếu K80 [${qrCode}] -> XE NÂNG - CHỜ CẤP VỎ`,
    container.masterDossierCode,
    actor
  );
}

// Hủy lệnh cấp & giải phóng khóa phân bổ (chỉ khi chưa ghi nhận thanh toán)
export function releaseAllocatedContainer(
  state: DepotState,
  input: { containerNo: string; reason: string }
): DepotState {
  assertPermission(state, 'RELEASE_ORDER', 'chỉ Văn phòng / Quản lý được hủy lệnh cấp vỏ.');
  const reason = input.reason.trim();
  if (!reason) throw new Error('Bắt buộc nhập lý do đổi/hủy lệnh cấp container (REL-003/REL-004).');
  const container = findActiveContainer(state, input.containerNo);
  if (!container || container.status !== 'ALLOCATED') {
    throw new Error('Container không ở trạng thái đã lập lệnh cấp vỏ.');
  }
  const order = state.gateOutOrders.find(
    (o) =>
      o.containerNo === container.containerNo &&
      o.masterDossierCode === container.masterDossierCode &&
      (o.status === 'PAYMENT_PENDING' || o.status === 'PENDING_FORKLIFT')
  );
  if (!order) throw new Error('Không tìm thấy hồ sơ CẤP VỎ đang hiệu lực của container.');
  const voucher = state.vouchers.find((v) => v.id === order.voucherId);
  if (isVoucherSettled(voucher)) {
    throw new Error(
      `Hồ sơ ${order.gateOutCode} đã ghi nhận thanh toán (${paymentLabelOf(voucher!)}). Hủy lệnh cần quy trình hoàn tiền / điều chỉnh công nợ chưa được xác nhận (OPEN-006).`
    );
  }
  let next = state;
  const pending = voucher ? pendingTransactionOf(next, voucher.id) : undefined;
  if (pending) next = cancelPendingTransaction(next, { transactionId: pending.id, reason });
  const now = nowIso();
  next = {
    ...next,
    vouchers: next.vouchers.map((v) => (v.id === voucher?.id ? { ...v, status: 'CANCELLED' as const } : v)),
    gateOutOrders: next.gateOutOrders.map((o) =>
      o.id === order.id ? { ...o, status: 'CANCELLED' as const, cancelReason: reason, cancelledAt: now } : o
    ),
    bookings: next.bookings.map((b) =>
      b.bookingNo === order.bookingNo
        ? {
            ...b,
            allocatedContainers: b.allocatedContainers.filter((no) => no !== container.containerNo),
            releasedContainers: [
              ...(b.releasedContainers || []),
              {
                containerNo: container.containerNo,
                outDossierCode: order.gateOutCode,
                reason,
                releasedBy: state.currentUser.fullName,
                releasedAt: now,
              },
            ],
            status: b.status === 'FULLY_ALLOCATED' ? ('OPEN' as const) : b.status,
          }
        : b
    ),
  };
  next = updateContainerById(next, container.id, {
    status: 'IN_YARD',
    activeQrCode: `QR-${container.masterDossierCode}`, // quay về QR phiếu Hạ vỏ của lượt lưu bãi
    allocatedBookingNo: undefined,
    allocatedTruckNo: undefined,
    allocatedDriverPhone: undefined,
    allocatedAt: undefined,
    outDossierCode: undefined,
  });
  return appendAudit(
    next,
    'RELEASE_ORDER_CANCELLED',
    'GATE_OUT',
    order.gateOutCode,
    `[Hồ sơ ${order.gateOutCode}] Hủy lệnh cấp ${container.containerNo} khỏi booking ${order.bookingNo}. Lý do: ${reason}`,
    container.masterDossierCode
  );
}

// ============================================================================
// DEC-185: ĐỔI CONTAINER — Văn phòng, khi cont đã cấp ra (Xe nâng OUT) và đang chờ TRẢ CHỨNG TỪ CẤP VỎ.
//   DEC-192: cũng đổi được khi CHƯA NÂNG HẠ (lái xe kiểm tra trước) — cont cũ giữ chỗ, bỏ khóa phân bổ; hư hỏng → Chờ báo giá ngay.
//   Giữ nguyên lệnh CV-, chứng từ, phiếu thu, QR phiếu K80 → lệnh chuyển sang cont thay thế (Xe nâng cấp lại).
//   Cont cũ quay về bãi (giữ hồ sơ HV- / ngày hạ gốc) → Xe nâng HẠ LẠI, chọn vị trí mới.
//   KEN_VO: giữ trạng thái, hạ xong cấp được cho khách khác. DAMAGE: chuyển DAMAGE + PHÁT SINH CẤP VỎ, hạ xong → Chờ báo giá.
// ============================================================================
// DEC-185 / DEC-192: lệnh cấp đổi được container — đã thu tiền, chưa trả chứng từ:
//   CHƯA NÂNG HẠ (chờ Xe nâng cấp) hoặc ĐÃ NÂNG HẠ lên xe (đã OUT)
export function canSwapGateOut(order: GateOutOrder | undefined): boolean {
  return Boolean(order && !order.documentsReturnedAt && (order.status === 'GATE_OUT_OK' || order.status === 'PENDING_FORKLIFT'));
}
export const isGateOutLifted = (order: GateOutOrder | undefined) => order?.status === 'GATE_OUT_OK';
export function swapCandidates(state: DepotState, gateOutOrderId: string): ContainerRecord[] {
  const order = state.gateOutOrders.find((o) => o.id === gateOutOrderId);
  if (!canSwapGateOut(order)) return [];
  const old = state.containers.find((c) => c.masterDossierCode === order!.masterDossierCode && c.containerNo === order!.containerNo);
  const booking = state.bookings.find((b) => b.bookingNo === order!.bookingNo);
  if (!old || !booking) return [];
  return state.containers
    .filter(
      (c) =>
        c.status === 'IN_YARD' &&
        c.containerNo !== old.containerNo &&
        c.size === booking.size &&
        c.type === booking.type &&
        c.shippingLineCode === old.shippingLineCode &&
        !releaseBlocker(c)
    )
    .sort((a, b) => a.containerNo.localeCompare(b.containerNo));
}

// DEC-186: lệnh đã ĐỔI CONTAINER — Xe nâng phải HẠ cont cũ (Chờ hạ vỏ) xong mới được cấp cont mới
export function swapPlacementBlocker(state: DepotState, order: GateOutOrder | undefined): string | null {
  const waiting = (order?.swaps || [])
    .map((s) => state.containers.find((c) => c.id === s.fromContainerId))
    .find((c) => c?.swapReturn && c.status === 'WAITING_PLACEMENT');
  return waiting
    ? `Phải HẠ container ${waiting.containerNo} (đổi cont) ở Xe nâng — Chờ hạ vỏ trước khi cấp ${order!.containerNo}.`
    : null;
}

export function swapGateOutContainer(
  state: DepotState,
  input: { gateOutOrderId: string; reason: SwapReason; newContainerNo: string; note?: string }
): DepotState {
  assertPermission(state, 'RELEASE_ORDER', 'chỉ Văn phòng / Quản lý được đổi container.');
  if (!SWAP_REASON_LABELS[input.reason]) throw new Error('Vui lòng chọn lý do ĐỔI CONTAINER.');
  const order = state.gateOutOrders.find((o) => o.id === input.gateOutOrderId);
  if (!order) throw new Error('Không tìm thấy hồ sơ CẤP VỎ.');
  if (!canSwapGateOut(order)) {
    throw new Error(`Hồ sơ ${order.gateOutCode}: chỉ ĐỔI CONTAINER khi lệnh đã thu tiền và đang chờ trả chứng từ.`);
  }
  const lifted = isGateOutLifted(order); // DEC-192: chưa nâng hạ → cont cũ vẫn nằm trong bãi
  const old = state.containers.find(
    (c) => c.masterDossierCode === order.masterDossierCode && c.containerNo === order.containerNo && c.status === (lifted ? 'GATED_OUT' : 'ALLOCATED')
  );
  if (!old) throw new Error(`Không tìm thấy lượt lưu bãi của container ${order.containerNo}.`);
  if (lifted && findActiveContainer(state, old.containerNo)) {
    throw new Error(`Container ${old.containerNo} đang có lượt lưu bãi khác — không đổi được.`);
  }
  const fresh = findActiveContainer(state, input.newContainerNo);
  if (!fresh) throw new Error('Không tìm thấy container thay thế đang tồn bãi.');
  if (fresh.containerNo === old.containerNo) throw new Error('Container thay thế phải khác container đang đổi.');
  const blocker = releaseBlocker(fresh);
  if (blocker) throw new Error(`Container ${fresh.containerNo} chưa đủ điều kiện CẤP VỎ: ${blocker}.`);
  const booking = state.bookings.find((b) => b.bookingNo === order.bookingNo);
  if (!booking) throw new Error(`Không tìm thấy booking ${order.bookingNo}.`);
  if (fresh.size !== booking.size || fresh.type !== booking.type || fresh.shippingLineCode !== old.shippingLineCode) {
    throw new Error(
      `Container thay thế phải cùng hãng tàu / size / type với booking ${order.bookingNo} (${old.shippingLineCode} ${booking.size}${booking.type}).`
    );
  }
  const note = input.note?.trim() || undefined;
  const isDamage = input.reason === 'DAMAGE';
  const actor = state.currentUser.fullName;
  const now = nowIso();
  const swap = {
    fromContainerId: old.id,
    fromContainerNo: old.containerNo,
    fromMasterDossierCode: old.masterDossierCode,
    toContainerNo: fresh.containerNo,
    toMasterDossierCode: fresh.masterDossierCode,
    reason: input.reason,
    note,
    lifted,
    gatedOutBy: order.confirmedBy,
    gatedOutAt: order.confirmedAt,
    swappedBy: actor,
    swappedAt: now,
  };

  let next: DepotState = {
    ...state,
    gateOutOrders: state.gateOutOrders.map((o) =>
      o.id === order.id
        ? {
            ...o,
            containerNo: fresh.containerNo,
            masterDossierCode: fresh.masterDossierCode,
            status: 'PENDING_FORKLIFT' as const,
            confirmedBy: undefined,
            confirmedAt: undefined,
            swaps: [...(o.swaps || []), swap],
          }
        : o
    ),
    vouchers: state.vouchers.map((v) =>
      v.id === order.voucherId ? { ...v, containerNo: fresh.containerNo, masterDossierCode: fresh.masterDossierCode } : v
    ),
    paymentTransactions: state.paymentTransactions.map((t) =>
      order.voucherId && t.voucherId === order.voucherId ? { ...t, containerNo: fresh.containerNo } : t
    ),
    paymentReceipts: state.paymentReceipts.map((r) =>
      order.voucherId && r.voucherId === order.voucherId ? { ...r, containerNo: fresh.containerNo } : r
    ),
    k80Tickets: state.k80Tickets.map((t) =>
      t.outDossierCode === order.gateOutCode
        ? {
            ...t,
            masterDossierCode: fresh.masterDossierCode,
            containerNo: fresh.containerNo,
            size: fresh.size,
            type: fresh.type,
            conditionClass: fresh.conditionClass,
            damageRemarks: fresh.damageRemarks,
            stuffingClass: fresh.stuffingClass,
            cleaningItems: fresh.cleaningItems,
            manufactureYear: fresh.manufactureYear,
            targetBlock: fresh.currentBlock || undefined,
          }
        : t
    ),
    bookings: state.bookings.map((b) =>
      b.id === booking.id
        ? {
            ...b,
            gatedOutContainers: b.gatedOutContainers.filter((no) => no !== old.containerNo),
            allocatedContainers: [...b.allocatedContainers.filter((no) => no !== old.containerNo), fresh.containerNo],
            releasedContainers: [
              ...(b.releasedContainers || []),
              { containerNo: old.containerNo, outDossierCode: order.gateOutCode, reason: `ĐỔI CONTAINER: ${SWAP_REASON_LABELS[input.reason]}`, releasedBy: actor, releasedAt: now },
            ],
            status: b.status === 'COMPLETED' ? ('OPEN' as const) : b.status,
          }
        : b
    ),
  };
  const damage = isDamage ? { conditionClass: 'DAMAGE' as const, damageRemarks: note ? [note] : old.damageRemarks, releaseDamage: true } : {};
  if (!lifted) {
    // DEC-192: chưa nâng hạ → cont cũ giữ nguyên vị trí, bỏ khóa phân bổ; hư hỏng → Chờ báo giá ngay (không việc Xe nâng)
    next = updateContainerById(next, old.id, {
      status: 'IN_YARD',
      allocatedBookingNo: undefined,
      allocatedTruckNo: undefined,
      allocatedDriverPhone: undefined,
      allocatedAt: undefined,
      outDossierCode: undefined,
      activeQrCode: `QR-${old.masterDossierCode}`,
      ...damage,
      ...(isDamage ? { needsQuotation: true } : {}),
    });
    if (isDamage) {
      const damaged = next.containers.find((c) => c.id === old.id)!;
      next = { ...next, workOrders: [releaseDamageWorkOrder(damaged, order.gateOutCode, now), ...next.workOrders] };
    }
  } else {
    // Đã nâng lên xe → cont cũ về hàng chờ Xe nâng HẠ LẠI (giữ hồ sơ HV- + ngày hạ gốc)
    next = updateContainerById(next, old.id, {
      status: 'WAITING_PLACEMENT',
      gateOutAt: undefined,
      allocatedBookingNo: undefined,
      allocatedTruckNo: undefined,
      allocatedDriverPhone: undefined,
      allocatedAt: undefined,
      outDossierCode: undefined,
      activeQrCode: `QR-${old.masterDossierCode}`,
      swapReturn: { gateOutCode: order.gateOutCode, reason: input.reason, note, toContainerNo: fresh.containerNo, requestedBy: actor, requestedAt: now },
      ...damage,
    });
  }
  // Cont thay thế: khóa phân bổ cho lệnh CV- (QR phiếu K80 giữ nguyên)
  next = updateContainerById(next, fresh.id, {
    status: 'ALLOCATED',
    allocatedBookingNo: order.bookingNo,
    allocatedTruckNo: order.truckNo,
    allocatedDriverPhone: order.driverPhone,
    allocatedAt: now,
    outDossierCode: order.gateOutCode,
    activeQrCode: `QR-${order.gateOutCode}`,
  });
  return appendAudit(
    next,
    'GATE_OUT_SWAP',
    'GATE_OUT',
    order.gateOutCode,
    `[Hồ sơ ${order.gateOutCode}] ĐỔI CONTAINER ${old.containerNo} → ${fresh.containerNo} (${lifted ? 'đã nâng lên xe' : 'chưa nâng hạ'}). Lý do: ${SWAP_REASON_LABELS[input.reason]}${note ? ` — ${note}` : ''}`,
    old.masterDossierCode
  );
}

// XE NÂNG — CHỜ CẤP VỎ: kiểm tra đủ 5 điều kiện (DEC-015) rồi xuất bãi
export function executeGateOut(
  state: DepotState,
  input: { containerNo?: string; scannedQrCode?: string; pickupBlock?: string }
): DepotState {
  assertPermission(state, 'GATE_OUT_CONFIRM', 'không được xác nhận xuất bãi / cấp vỏ.');
  const container =
    findActiveContainer(state, input.containerNo) || findActiveContainerByCode(state, input.scannedQrCode);
  if (!container) throw new Error('Không tìm thấy container đang trong bãi (có thể đã xuất trước đó — GOUT-003).');
  if (container.status !== 'ALLOCATED') {
    throw new Error(`Container ${container.containerNo} chưa có lệnh CẤP VỎ hợp lệ.`);
  }
  const order = state.gateOutOrders.find(
    (o) =>
      o.containerNo === container.containerNo &&
      o.masterDossierCode === container.masterDossierCode &&
      (o.status === 'PAYMENT_PENDING' || o.status === 'PENDING_FORKLIFT')
  );
  const booking = order ? state.bookings.find((b) => b.bookingNo === order.bookingNo) : undefined;
  if (!order || !booking || booking.status === 'CANCELLED') {
    throw new Error('Điều kiện 1 thất bại: Không có lệnh cấp / booking hợp lệ (GOUT-002).');
  }
  const swapBlocker = swapPlacementBlocker(state, order); // DEC-186
  if (swapBlocker) throw new Error(swapBlocker);
  if (container.isOnHold) {
    throw new Error(`Điều kiện 2 thất bại: Container ${container.containerNo} đang bị KHÓA (${container.holdReason}).`);
  }
  if (!booking.allocatedContainers.includes(container.containerNo)) {
    throw new Error(`Điều kiện 3 thất bại: Container ${container.containerNo} không thuộc booking ${booking.bookingNo}.`);
  }
  const voucher = state.vouchers.find((v) => v.id === order.voucherId);
  if (order.status !== 'PENDING_FORKLIFT' || !isVoucherSettled(voucher)) {
    throw new Error('Điều kiện 4 thất bại: Chưa thanh toán / xác nhận thanh toán phí cấp vỏ tại Văn phòng.');
  }
  if (!order.truckNo || !order.driverPhone) {
    throw new Error('Điều kiện 5 thất bại: Thiếu SỐ XE / SĐT LÁI XE trên hồ sơ cấp vỏ.');
  }

  const now = nowIso();
  const prevLoc = formatLocation(container);
  const isDamageRelease = container.conditionClass === 'DAMAGE';
  const gatedOutCount = booking.gatedOutContainers.length + 1;

  let next: DepotState = {
    ...state,
    gateOutOrders: state.gateOutOrders.map((o) =>
      o.id === order.id
        ? {
            ...o,
            status: 'GATE_OUT_OK' as const,
            chkValidOrder: true,
            chkNotOnHold: true,
            chkCorrectContainer: true,
            chkPaymentSettled: true,
            chkDocumentsCompleted: true,
            confirmedBy: state.currentUser.fullName,
            confirmedAt: now,
          }
        : o
    ),
    bookings: state.bookings.map((b) =>
      b.id === booking.id
        ? {
            ...b,
            allocatedContainers: b.allocatedContainers.filter((no) => no !== container.containerNo),
            gatedOutContainers: [...b.gatedOutContainers, container.containerNo],
            status: b.requestedQty && gatedOutCount >= b.requestedQty ? ('COMPLETED' as const) : b.status,
          }
        : b
    ),
    // DAMAGE cấp theo chỉ định: đóng các việc Báo giá / Sửa chữa còn mở của lượt lưu bãi
    workOrders: isDamageRelease
      ? state.workOrders.map((w) =>
          w.masterDossierCode === container.masterDossierCode &&
          (w.category === 'INSPECTION' || w.category === 'REPAIR') &&
          w.workStatus === 'OPEN'
            ? { ...w, workStatus: 'CANCELLED' as const, resultNotes: 'Đóng do cấp vỏ DAMAGE theo chỉ định' }
            : w
        )
      : state.workOrders,
    locationHistory: [
      {
        id: newId('loc'),
        masterDossierCode: container.masterDossierCode,
        containerNo: container.containerNo,
        fromLocation: prevLoc,
        toLocation: `OUT KHỎI BÃI (${order.truckNo})`,
        actionType: 'GATE_OUT_CLEAR',
        reason: `Cấp vỏ theo booking ${booking.bookingNo} (${order.gateOutCode})`,
        performedBy: state.currentUser.fullName,
        performedAt: now,
      },
      ...state.locationHistory,
    ],
  };
  next = updateContainerById(next, container.id, {
    status: 'GATED_OUT',
    currentBlock: null,
    currentBay: null,
    currentRow: null,
    currentTier: null,
    needsQuotation: false,
    needsRepair: false,
    forkliftShiftTask: 'NONE',
    gateOutAt: now,
  });
  return appendAudit(
    next,
    'GATE_OUT_OK',
    'GATE_OUT',
    order.gateOutCode,
    `[Hồ sơ ${order.gateOutCode}] Xuất bãi ${container.containerNo} (${container.conditionClass}) từ ${prevLoc}${
      input.pickupBlock ? ` (xác nhận lấy tại ${input.pickupBlock})` : ''
    } theo booking ${booking.bookingNo}, xe ${order.truckNo}`,
    container.masterDossierCode
  );
}

// ============================================================================
// 12. KẾT QUẢ CHUYỂN KHOẢN (webhook ngân hàng / giả lập Demo)
// ============================================================================
export function processBankTransferCallback(state: DepotState, input: BankCallbackInput): DepotState {
  const result = applyBankCallback(state, input);
  const tx = result.transaction;
  if (result.alreadyProcessed || !tx || tx.status !== 'SUCCEEDED' || tx.purpose !== 'VOUCHER') {
    return result.state;
  }
  const actor: Actor = { name: `${SYSTEM_ACTOR} (Ngân hàng)`, role: 'SYSTEM' };
  const voucher = result.state.vouchers.find((v) => v.id === tx.voucherId);
  if (voucher?.serviceType === 'GATE_IN') {
    const order = result.state.gateInOrders.find((o) => o.voucherId === voucher.id);
    if (order) return completeGateIn(result.state, order.id, actor);
  }
  if (voucher?.serviceType === 'GATE_OUT') {
    const order = result.state.gateOutOrders.find((o) => o.voucherId === voucher.id);
    if (order) return completeReleasePayment(result.state, order.id, actor);
  }
  return result.state;
}

// CHỈ DÙNG Ở CHẾ ĐỘ DEMO — giả lập ngân hàng báo có cho một yêu cầu chuyển khoản
export function simulateDemoBankTransfer(state: DepotState, input: { transactionId: string }): DepotState {
  assertPermission(state, 'DEMO_BANK_SIMULATOR', 'không được dùng giả lập ngân hàng.');
  const tx = state.paymentTransactions.find((t) => t.id === input.transactionId);
  if (!tx || tx.method !== 'BANK_TRANSFER_API') throw new Error('Không tìm thấy yêu cầu chuyển khoản.');
  return processBankTransferCallback(state, {
    paymentRef: tx.paymentRef,
    providerTxRef: demoBankProviderRef(tx.id),
    amount: tx.amount,
    success: true,
  });
}

// ============================================================================
// 13. CẤU HÌNH DANH MỤC CHUNG (CHỈ ADMIN CÓ QUYỀN CẤU HÌNH)
// ============================================================================
function assertAdmin(state: DepotState): void {
  if (!hasRolePermission(state.currentUser, ['ADMIN'])) {
    throw new Error(
      'Từ chối quyền: Chỉ tài khoản Quản trị hệ thống (ADMIN) mới có quyền cấu hình DANH MỤC CHUNG.'
    );
  }
}

// 13.1. Thêm KHÁCH HÀNG hoặc HÃNG TÀU vào DANH MỤC CHUNG
export function addPartnerCatalogItem(
  state: DepotState,
  input: {
    code: string;
    name: string;
    partnerType: 'CUSTOMER' | 'SHIPPING_LINE';
    allowTts: boolean;
  }
): DepotState {
  assertAdmin(state);
  const cleanCode = input.code.trim().toUpperCase();
  const cleanName = input.name.trim();
  if (!cleanCode || !cleanName) {
    throw new Error('Vui lòng nhập đầy đủ Mã và Tên đối tác.');
  }
  if (state.partners.some((p) => p.code.toUpperCase() === cleanCode)) {
    throw new Error(`Mã "${cleanCode}" đã tồn tại trong Danh mục chung.`);
  }

  const newPartner = {
    id: newId('pt'),
    code: cleanCode,
    name: cleanName,
    isShippingLine: input.partnerType === 'SHIPPING_LINE',
    isCustomer: input.partnerType === 'CUSTOMER',
    allowTts: input.allowTts,
  };

  return appendAudit(
    {
      ...state,
      partners: [...state.partners, newPartner],
    },
    'ADMIN_ADD_PARTNER',
    'CATALOG',
    cleanCode,
    `[Admin Danh mục chung] Thêm ${
      input.partnerType === 'SHIPPING_LINE' ? 'HÃNG TÀU' : 'KHÁCH HÀNG'
    }: [${cleanCode}] ${cleanName}`
  );
}

export function deletePartnerCatalogItem(
  state: DepotState,
  partnerId: string
): DepotState {
  assertAdmin(state);
  const target = state.partners.find((p) => p.id === partnerId);
  if (!target) return state;

  return appendAudit(
    {
      ...state,
      partners: state.partners.filter((p) => p.id !== partnerId),
    },
    'ADMIN_DELETE_PARTNER',
    'CATALOG',
    target.code,
    `[Admin Danh mục chung] Xóa đối tác [${target.code}] ${target.name}`
  );
}

// 13.2. Thêm / Xóa VỊ TRÍ (Block / Bay / Row / Tier) trong DANH MỤC CHUNG
export function addYardBlockCatalogItem(
  state: DepotState,
  input: {
    blockCode: string;        // DEC-082: nhập "A" → "BLOCK-A" (có hoặc không gõ tiền tố BLOCK-)
    blockName?: string;       // để trống → "Khu A"
    maxBay?: number | null;   // để trống / 0 = không dùng chiều Bay
    maxRow?: number | null;
    maxTier?: number | null;
    description?: string;
    isInspectionRack?: boolean; // DEC-109
  }
): DepotState {
  assertAdmin(state);
  const suffix = input.blockCode.trim().toUpperCase().replace(/^BLOCK[-\s]*/, '').replace(/\s+/g, '-');
  if (!suffix) throw new Error('Vui lòng nhập Mã Vị trí sau chữ BLOCK- (VD: A, B, C).');
  if (!/^[A-Z0-9-]{1,20}$/.test(suffix)) throw new Error('Mã Vị trí chỉ gồm chữ, số, dấu gạch ngang (VD: A, B1, KHO-2).');
  const cleanCode = `BLOCK-${suffix}`;
  if (state.yardBlocks.some((b) => b.blockCode.toUpperCase() === cleanCode)) {
    throw new Error(`Mã Vị trí "${cleanCode}" đã tồn tại trong Danh mục chung.`);
  }
  // DEC-082: chiều nào để trống thì không dùng (0); có nhập thì phải là số nguyên 1 → 999
  const dim = (label: string, v?: number | null): number => {
    if (v === null || v === undefined || String(v).trim() === '' || Number(v) === 0) return 0;
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1 || n > 999) throw new Error(`Số ${label} tối đa phải là số nguyên 1 → 999, hoặc để trống nếu không dùng.`);
    return n;
  };
  const maxBay = dim('Bay', input.maxBay);
  const maxRow = dim('Row', input.maxRow);
  const maxTier = dim('Tier', input.maxTier);
  const used = [maxBay, maxRow, maxTier].filter((n) => n > 0);
  const capacity = used.length ? used.reduce((a, b) => a * b, 1) : 0; // 0 = chỉ Block, không giới hạn số cont
  const cleanName = input.blockName?.trim() || `Khu ${suffix}`;

  const newBlock = {
    blockCode: cleanCode,
    blockName: cleanName,
    maxBay,
    maxRow,
    maxTier,
    capacity,
    description: input.description?.trim() || '',
    isInspectionRack: Boolean(input.isInspectionRack),
  };
  const dimsLabel = [maxBay && `Bay:${maxBay}`, maxRow && `Row:${maxRow}`, maxTier && `Tier:${maxTier}`].filter(Boolean).join(' / ') || 'chỉ Block';

  return appendAudit(
    {
      ...state,
      yardBlocks: [...state.yardBlocks, newBlock],
    },
    'ADMIN_ADD_YARD_BLOCK',
    'CATALOG',
    cleanCode,
    `[Admin Danh mục chung] Thêm VỊ TRÍ [${cleanCode}] ${cleanName} (${dimsLabel})`
  );
}

// DEC-109: Admin đánh dấu / bỏ đánh dấu block là KỆ GIÁM ĐỊNH
export function setYardBlockInspectionRack(state: DepotState, blockCode: string, isInspectionRack: boolean): DepotState {
  assertAdmin(state);
  const block = state.yardBlocks.find((b) => b.blockCode === blockCode);
  if (!block) throw new Error(`Không tìm thấy Vị trí ${blockCode}.`);
  return appendAudit(
    { ...state, yardBlocks: state.yardBlocks.map((b) => (b.blockCode === blockCode ? { ...b, isInspectionRack } : b)) },
    'ADMIN_SET_INSPECTION_RACK',
    'CATALOG',
    blockCode,
    `[Admin Danh mục chung] ${isInspectionRack ? 'Đánh dấu' : 'Bỏ đánh dấu'} [${blockCode}] là KỆ GIÁM ĐỊNH`
  );
}

export function deleteYardBlockCatalogItem(
  state: DepotState,
  blockCode: string
): DepotState {
  assertAdmin(state);
  if (state.containers.some((c) => c.status !== 'GATED_OUT' && c.currentBlock === blockCode)) {
    throw new Error(`Không thể xóa ${blockCode}: đang có container tồn bãi tại vị trí này.`);
  }
  return appendAudit(
    {
      ...state,
      yardBlocks: state.yardBlocks.filter((b) => b.blockCode !== blockCode),
    },
    'ADMIN_DELETE_YARD_BLOCK',
    'CATALOG',
    blockCode,
    `[Admin Danh mục chung] Xóa VỊ TRÍ [${blockCode}]`
  );
}

// 13.3. Cấu hình CONTAINER (SIZE - TYPE) trong DANH MỤC CHUNG
export function addContainerSizeCatalogItem(
  state: DepotState,
  sizeValue: string
): DepotState {
  assertAdmin(state);
  const clean = sizeValue.trim().toUpperCase();
  if (!clean) throw new Error('Vui lòng nhập mã SIZE container (VD: 20, 40, 45, 48).');
  const current = state.containerSizes || ['20', '40', '45'];
  if (current.includes(clean)) {
    throw new Error(`SIZE "${clean}" đã tồn tại trong Danh mục chung.`);
  }
  return appendAudit(
    {
      ...state,
      containerSizes: [...current, clean],
    },
    'ADMIN_ADD_CONT_SIZE',
    'CATALOG',
    clean,
    `[Admin Danh mục chung] Thêm cấu hình Container SIZE: ${clean}`
  );
}

export function deleteContainerSizeCatalogItem(
  state: DepotState,
  sizeValue: string
): DepotState {
  assertAdmin(state);
  const current = state.containerSizes || ['20', '40', '45'];
  return appendAudit(
    {
      ...state,
      containerSizes: current.filter((s) => s !== sizeValue),
    },
    'ADMIN_DELETE_CONT_SIZE',
    'CATALOG',
    sizeValue,
    `[Admin Danh mục chung] Xóa cấu hình Container SIZE: ${sizeValue}`
  );
}

export function addContainerTypeCatalogItem(
  state: DepotState,
  typeValue: string
): DepotState {
  assertAdmin(state);
  const clean = typeValue.trim().toUpperCase();
  if (!clean) throw new Error('Vui lòng nhập mã TYPE container (VD: DC, HC, OT, FR, RF).');
  const current = state.containerTypes || ['DC', 'HC', 'OT', 'FR', 'RF'];
  if (current.includes(clean)) {
    throw new Error(`TYPE "${clean}" đã tồn tại trong Danh mục chung.`);
  }
  return appendAudit(
    {
      ...state,
      containerTypes: [...current, clean],
    },
    'ADMIN_ADD_CONT_TYPE',
    'CATALOG',
    clean,
    `[Admin Danh mục chung] Thêm cấu hình Container TYPE: ${clean}`
  );
}

// DEC-195: MÃ ISO 6346 theo Size + Type — Admin đặt / sửa / bỏ (mã trống = bỏ). 4 ký tự chữ hoa / số (VD 22G1, 45G1, L5G1).
export function setContainerIsoCode(state: DepotState, input: { size: string; type: string; isoCode: string }): DepotState {
  assertAdmin(state);
  const size = input.size.trim().toUpperCase();
  const type = input.type.trim().toUpperCase();
  if (!(state.containerSizes || []).includes(size) || !(state.containerTypes || []).includes(type)) {
    throw new Error('Vui lòng chọn SIZE và TYPE có trong Danh mục Container.');
  }
  const isoCode = input.isoCode.trim().toUpperCase();
  if (isoCode && !/^[0-9A-Z]{4}$/.test(isoCode)) throw new Error('Mã ISO 6346 gồm đúng 4 ký tự chữ / số (VD: 22G1, 45G1, L5G1).');
  const rest = (state.containerIsoCodes || []).filter((c) => !(c.size === size && c.type === type));
  return appendAudit(
    { ...state, containerIsoCodes: isoCode ? [...rest, { size, type, isoCode }] : rest },
    'ADMIN_SET_ISO_CODE',
    'CATALOG',
    `${size}${type}`,
    `[Admin Danh mục chung] Mã ISO 6346 ${size}${type}: ${isoCode || '(bỏ)'}`
  );
}

// Mã ISO 6346 của 1 cont: mã riêng của cont (nếu có) → theo Danh mục Size + Type → trống
export function containerIsoCode(state: Pick<DepotState, 'containerIsoCodes'>, c: { size: string; type: string; isoCode?: string }): string {
  return c.isoCode || (state.containerIsoCodes || []).find((x) => x.size === c.size && x.type === c.type)?.isoCode || '';
}

// DEC-166: tích / bỏ hãng tàu ƯU TIÊN — chỉ 1 hãng; tích hãng khác thì hãng cũ tự bỏ
export function setShippingLinePriority(state: DepotState, input: { code: string; isPriority: boolean }): DepotState {
  assertAdmin(state);
  const line = state.partners.find((p) => p.isShippingLine && p.code === input.code);
  if (!line) throw new Error('Không tìm thấy HÃNG TÀU trong Danh mục chung.');
  const partners = state.partners.map((p) =>
    p.isShippingLine ? { ...p, isPriority: p.code === input.code ? input.isPriority : input.isPriority ? false : p.isPriority } : p
  );
  return appendAudit({ ...state, partners }, 'ADMIN_SET_LINE_PRIORITY', 'CATALOG', line.code,
    `[Admin Danh mục chung] ${input.isPriority ? 'Đặt' : 'Bỏ'} ƯU TIÊN hãng tàu ${line.code}`);
}

// DEC-166: DANH MỤC PHÂN LOẠI ĐÓNG HÀNG theo hãng tàu — thêm (hoặc mở lại) / ngừng dùng; không xóa cứng (hồ sơ cũ còn dùng mã)
export function addStuffingClassCatalogItem(state: DepotState, input: { shippingLineCode: string; code: string; description?: string }): DepotState {
  assertAdmin(state);
  const line = input.shippingLineCode?.trim();
  if (!state.partners.some((p) => p.isShippingLine && p.code === line)) throw new Error('Vui lòng chọn HÃNG TÀU theo Danh mục chung.');
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9]{1,5}$/.test(code)) throw new Error('Mã PHÂN LOẠI ĐÓNG HÀNG gồm 1–5 chữ / số (VD: M, K, E).');
  const items = state.stuffingClasses || [];
  const existing = items.find((s) => s.shippingLineCode === line && s.code === code);
  if (existing?.isActive) throw new Error(`Hãng tàu ${line} đã có phân loại đóng hàng ${code}.`);
  const description = input.description?.trim() || undefined;
  const next = existing
    ? items.map((s) => (s.id === existing.id ? { ...s, isActive: true, description: description ?? s.description } : s))
    : [...items, { id: newId('stf'), shippingLineCode: line, code, description, isActive: true }];
  return appendAudit({ ...state, stuffingClasses: next }, 'ADMIN_ADD_STUFFING', 'CATALOG', `${line}-${code}`,
    `[Admin Danh mục chung] ${existing ? 'Mở lại' : 'Thêm'} PHÂN LOẠI ĐÓNG HÀNG ${code} cho hãng tàu ${line}`);
}

export function setStuffingClassActive(state: DepotState, input: { shippingLineCode: string; code: string; isActive: boolean }): DepotState {
  assertAdmin(state);
  const items = state.stuffingClasses || [];
  const item = items.find((s) => s.shippingLineCode === input.shippingLineCode && s.code === input.code);
  if (!item) throw new Error(`Không tìm thấy phân loại ${input.code} của hãng tàu ${input.shippingLineCode}.`);
  return appendAudit({ ...state, stuffingClasses: items.map((s) => (s.id === item.id ? { ...s, isActive: input.isActive } : s)) },
    'ADMIN_SET_STUFFING_ACTIVE', 'CATALOG', `${item.shippingLineCode}-${item.code}`,
    `[Admin Danh mục chung] ${input.isActive ? 'Mở lại' : 'Ngừng dùng'} PHÂN LOẠI ĐÓNG HÀNG ${item.code} của hãng tàu ${item.shippingLineCode}`);
}

export function deleteContainerTypeCatalogItem(
  state: DepotState,
  typeValue: string
): DepotState {
  assertAdmin(state);
  const current = state.containerTypes || ['DC', 'HC', 'OT', 'FR', 'RF'];
  return appendAudit(
    {
      ...state,
      containerTypes: current.filter((t) => t !== typeValue),
    },
    'ADMIN_DELETE_CONT_TYPE',
    'CATALOG',
    typeValue,
    `[Admin Danh mục chung] Xóa cấu hình Container TYPE: ${typeValue}`
  );
}

// 13.4. Thêm / Xóa BIỂU GIÁ (NÂNG HẠ theo từng Size - Type - Hãng tàu, THU GOM RÁC, và Biểu giá khác) — CHỈ ADMIN
export function addDepotFeeCatalogItem(
  state: DepotState,
  input: {
    name?: string;
    category?: FeeTariffCategory;
    size?: ContainerSize;
    type?: ContainerType;
    shippingLineCode?: string;
    defaultAmountInclVat: number;
  }
): DepotState {
  assertAdmin(state);
  if (input.defaultAmountInclVat < 0) {
    throw new Error('Vui lòng nhập đơn giá (đã bao gồm VAT) hợp lệ.');
  }

  const category: FeeTariffCategory = input.category || 'NANG_HA';
  const size = input.size?.trim() || undefined;
  const type = input.type?.trim() || undefined;
  const shippingLineCode = input.shippingLineCode?.trim() || undefined;

  const seq = String((state.feeCatalog || []).length + 1).padStart(2, '0');
  let code = `BG_${seq}`;
  let autoName = input.name?.trim() || '';

  if (category === 'NANG_HA') {
    code = `LOLO_${size || 'ALL'}_${type || 'ALL'}_${shippingLineCode || 'ALL'}_${seq}`;
    if (!autoName) {
      autoName = `Nâng hạ vỏ ${size ? `${size}'` : ''} ${type || ''} — Hãng tàu ${
        shippingLineCode === 'ALL' || !shippingLineCode ? 'Tất cả' : shippingLineCode
      } (Đã gồm VAT)`.replace(/\s+/g, ' ');
    }
  } else if (category === 'THU_GOM_RAC') {
    code = `RAC_${size || 'CHUNG'}_${seq}`;
    if (!autoName) {
      autoName = `Phí thu gom rác ${size ? `cont ${size}'` : 'tiêu chuẩn bãi'} (Đã gồm VAT)`;
    }
  } else {
    code = `DV_${seq}`;
    if (!autoName) {
      throw new Error('Vui lòng nhập tên biểu giá dịch vụ.');
    }
  }

  const newItem = {
    id: newId('fee'),
    code,
    name: autoName,
    category,
    size,
    type,
    shippingLineCode,
    defaultAmountInclVat: Number(input.defaultAmountInclVat),
  };

  return appendAudit(
    {
      ...state,
      feeCatalog: [...(state.feeCatalog || []), newItem],
    },
    'ADMIN_ADD_FEE_CATALOG',
    'FEE_CATALOG',
    code,
    `[Admin Danh mục chung] Thêm BIỂU GIÁ: ${newItem.name} (${newItem.defaultAmountInclVat.toLocaleString('vi-VN')}đ — Đã gồm VAT)`
  );
}

export function deleteDepotFeeCatalogItem(
  state: DepotState,
  feeId: string
): DepotState {
  assertAdmin(state);
  const target = (state.feeCatalog || []).find((f) => f.id === feeId);
  if (!target) return state;

  return appendAudit(
    {
      ...state,
      feeCatalog: (state.feeCatalog || []).filter((f) => f.id !== feeId),
    },
    'ADMIN_DELETE_FEE_CATALOG',
    'FEE_CATALOG',
    target.code,
    `[Admin Danh mục chung] Xóa BIỂU GIÁ [${target.code}] ${target.name}`
  );
}

// ============================================================================
// 14. GHI CHÚ CỦA NHÂN VIÊN VĂN PHÒNG TRONG DANH SÁCH TỒN VỎ
// ============================================================================
export function updateContainerOfficeNote(
  state: DepotState,
  input: { containerId: string; officeNote: string }
): DepotState {
  assertPermission(state, 'OFFICE_NOTE', 'chỉ Văn phòng / Quản lý được ghi chú tồn vỏ.');
  const target = state.containers.find((c) => c.id === input.containerId);
  if (!target) return state;
  // DEC-131: ghi chú = tên tàu khi nằm trong danh sách XUẤT TÀU — không sửa tay
  if (target.holdSource === 'VESSEL_EXPORT') throw new Error(`Container ${target.containerNo} đang khóa do ${target.holdReason} — ghi chú do danh sách Xuất tàu quản lý.`);

  const cleanNote = input.officeNote.trim();
  const next = updateContainerById(state, target.id, {
    officeNote: cleanNote || undefined,
    officeNoteUpdatedBy: cleanNote ? state.currentUser.fullName : undefined,
    officeNoteUpdatedAt: cleanNote ? nowIso() : undefined,
  });

  return appendAudit(
    next,
    'UPDATE_TON_VO_NOTE',
    'CONTAINER',
    target.masterDossierCode,
    cleanNote
      ? `[Hồ sơ ${target.masterDossierCode}] Văn phòng thêm Ghi chú tồn vỏ cho ${target.containerNo}: "${cleanNote}"`
      : `[Hồ sơ ${target.masterDossierCode}] Văn phòng xóa Ghi chú tồn vỏ cho ${target.containerNo}`,
    target.masterDossierCode
  );
}

// ============================================================================
// 15. DANH MỤC CHUNG — TỔ SỬA CHỮA (DEC-042, chỉ ADMIN). Ngưng hoạt động thay vì xóa để giữ lịch sử sửa chữa.
// ============================================================================
export function addRepairTeam(state: DepotState, input: { code: string; name: string }): DepotState {
  assertAdmin(state);
  const code = input.code.trim().toUpperCase();
  const name = input.name.trim();
  if (!code || !name) throw new Error('Vui lòng nhập Mã tổ và Tên tổ sửa chữa.');
  if (state.repairTeams.some((t) => t.code === code)) throw new Error(`Mã tổ "${code}" đã tồn tại.`);
  return appendAudit(
    { ...state, repairTeams: [...state.repairTeams, { id: newId('rt'), code, name, members: [], isActive: true }] },
    'ADMIN_ADD_REPAIR_TEAM',
    'CATALOG',
    code,
    `[Admin Danh mục chung] Thêm TỔ SỬA CHỮA [${code}] ${name}`
  );
}

export function setRepairTeamActive(state: DepotState, input: { teamId: string; isActive: boolean }): DepotState {
  assertAdmin(state);
  const team = state.repairTeams.find((t) => t.id === input.teamId);
  if (!team) throw new Error('Không tìm thấy tổ sửa chữa.');
  return appendAudit(
    { ...state, repairTeams: state.repairTeams.map((t) => (t.id === team.id ? { ...t, isActive: input.isActive } : t)) },
    input.isActive ? 'ADMIN_ACTIVATE_REPAIR_TEAM' : 'ADMIN_DEACTIVATE_REPAIR_TEAM',
    'CATALOG',
    team.code,
    `[Admin Danh mục chung] ${input.isActive ? 'Kích hoạt' : 'Ngưng'} TỔ SỬA CHỮA [${team.code}]`
  );
}

// DEC-048: chọn user có sẵn trong hệ thống (staffUserId) hoặc nhập họ tên nhân viên không có tài khoản
export function addRepairTeamMember(
  state: DepotState,
  input: { teamId: string; staffUserId?: string; fullName?: string }
): DepotState {
  assertAdmin(state);
  const team = state.repairTeams.find((t) => t.id === input.teamId);
  if (!team) throw new Error('Không tìm thấy tổ sửa chữa.');
  let fullName = (input.fullName || '').trim();
  let staffUserId: string | undefined;
  if (input.staffUserId) {
    const user = state.staffUsers.find((u) => u.id === input.staffUserId);
    if (!user || !user.isActive) throw new Error('User không tồn tại hoặc đã bị khóa.');
    if (team.members.some((m) => m.isActive && m.staffUserId === user.id)) {
      throw new Error(`${user.fullName} đã có trong ${team.name}.`);
    }
    staffUserId = user.id;
    fullName = user.fullName;
  }
  if (!fullName) throw new Error('Vui lòng chọn user hoặc nhập họ tên nhân viên.');
  if (team.members.some((m) => m.isActive && m.fullName.toLowerCase() === fullName.toLowerCase())) {
    throw new Error(`Nhân viên "${fullName}" đã có trong ${team.name}.`);
  }
  const member = { id: newId('rtm'), fullName, isActive: true, staffUserId };
  return appendAudit(
    {
      ...state,
      repairTeams: state.repairTeams.map((t) => (t.id === team.id ? { ...t, members: [...t.members, member] } : t)),
    },
    'ADMIN_ADD_REPAIR_MEMBER',
    'CATALOG',
    team.code,
    `[Admin Danh mục chung] Thêm nhân viên ${fullName} vào ${team.name}`
  );
}

export function setRepairTeamMemberActive(
  state: DepotState,
  input: { teamId: string; memberId: string; isActive: boolean }
): DepotState {
  assertAdmin(state);
  const team = state.repairTeams.find((t) => t.id === input.teamId);
  const member = team?.members.find((m) => m.id === input.memberId);
  if (!team || !member) throw new Error('Không tìm thấy nhân viên trong tổ.');
  return appendAudit(
    {
      ...state,
      repairTeams: state.repairTeams.map((t) =>
        t.id === team.id
          ? { ...t, members: t.members.map((m) => (m.id === member.id ? { ...m, isActive: input.isActive } : m)) }
          : t
      ),
    },
    input.isActive ? 'ADMIN_ACTIVATE_REPAIR_MEMBER' : 'ADMIN_DEACTIVATE_REPAIR_MEMBER',
    'CATALOG',
    team.code,
    `[Admin Danh mục chung] ${input.isActive ? 'Kích hoạt' : 'Ngưng'} nhân viên ${member.fullName} (${team.name})`
  );
}

// DEC-173: tạo tổ theo SỐ LƯỢNG — đánh số tiếp theo tổ đã có: TỔ SỬA CHỮA n (mã TO-SC-0n)
export function repairTeamsToCreate(state: DepotState, count: number): { code: string; name: string }[] {
  if (!Number.isInteger(count) || count < 1 || count > 50) throw new Error('Số lượng tổ phải từ 1 đến 50.');
  const used = new Set(state.repairTeams.map((t) => t.code));
  const out: { code: string; name: string }[] = [];
  for (let n = 1; out.length < count; n++) {
    const code = `TO-SC-${String(n).padStart(2, '0')}`;
    if (!used.has(code)) out.push({ code, name: `TỔ SỬA CHỮA ${n}` });
  }
  return out;
}

export function addRepairTeamsByCount(state: DepotState, input: { count: number }): DepotState {
  return repairTeamsToCreate(state, input.count).reduce((s, t) => addRepairTeam(s, t), state);
}

// DEC-173: BẬC THỢ — tên + đơn giá tiền / 1 giờ công. Sửa đơn giá = đổi cho mọi nhân viên cùng bậc.
export function upsertRepairGrade(state: DepotState, input: { id?: string; name: string; hourlyRate: number }): DepotState {
  assertAdmin(state);
  const name = input.name.trim();
  if (!name) throw new Error('Vui lòng nhập tên BẬC THỢ.');
  if (!Number.isFinite(input.hourlyRate) || input.hourlyRate <= 0) throw new Error('GIỜ CÔNG BẬC THỢ (đơn giá / giờ) phải lớn hơn 0.');
  const grades = state.repairGrades || [];
  if (grades.some((g) => g.id !== input.id && g.name.toLowerCase() === name.toLowerCase())) throw new Error(`Bậc thợ "${name}" đã tồn tại.`);
  const old = input.id ? grades.find((g) => g.id === input.id) : undefined;
  if (input.id && !old) throw new Error('Không tìm thấy bậc thợ.');
  const code = old?.code || `BT-${String(grades.length + 1).padStart(2, '0')}`;
  const row = { id: old?.id || newId('bt'), code, name, hourlyRate: Math.round(input.hourlyRate), isActive: old?.isActive ?? true };
  return appendAudit(
    { ...state, repairGrades: old ? grades.map((g) => (g.id === old.id ? row : g)) : [...grades, row] },
    'ADMIN_UPSERT_REPAIR_GRADE',
    'CATALOG',
    code,
    `[Admin Danh mục chung] ${old ? 'Sửa' : 'Thêm'} BẬC THỢ ${name} — ${row.hourlyRate.toLocaleString('vi-VN')}đ / giờ`
  );
}

export function setRepairGradeActive(state: DepotState, input: { id: string; isActive: boolean }): DepotState {
  assertAdmin(state);
  const g = (state.repairGrades || []).find((x) => x.id === input.id);
  if (!g) throw new Error('Không tìm thấy bậc thợ.');
  return appendAudit(
    { ...state, repairGrades: state.repairGrades.map((x) => (x.id === g.id ? { ...x, isActive: input.isActive } : x)) },
    'ADMIN_UPSERT_REPAIR_GRADE',
    'CATALOG',
    g.code,
    `[Admin Danh mục chung] ${input.isActive ? 'Kích hoạt' : 'Ngưng'} BẬC THỢ ${g.name}`
  );
}

// DEC-175: VƯỢT GIỜ — mốc giờ công + đơn giá vượt giờ (đ / giờ), dùng ở báo cáo SẢN LƯỢNG SỬA CHỮA. Chỉ ADMIN.
export function updateRepairOvertime(state: DepotState, input: { thresholdHours: number; hourlyRate: number }): DepotState {
  assertAdmin(state);
  if (!Number.isFinite(input.thresholdHours) || input.thresholdHours <= 0) throw new Error('MỐC GIỜ CÔNG phải lớn hơn 0.');
  if (!Number.isFinite(input.hourlyRate) || input.hourlyRate <= 0) throw new Error('ĐƠN GIÁ VƯỢT GIỜ (đ / giờ) phải lớn hơn 0.');
  const row = { thresholdHours: Math.round(input.thresholdHours * 100) / 100, hourlyRate: Math.round(input.hourlyRate) };
  return appendAudit(
    { ...state, repairOvertime: row },
    'ADMIN_UPDATE_REPAIR_OVERTIME',
    'CATALOG',
    'REPAIR_OVERTIME',
    `[Admin Danh mục chung] VƯỢT GIỜ: trên ${row.thresholdHours} giờ — ${row.hourlyRate.toLocaleString('vi-VN')}đ / giờ`
  );
}

// DEC-173: DANH SÁCH NHÂN VIÊN SỬA CHỮA = user có vai trò Sửa chữa; mỗi người thuộc đúng 1 tổ + 1 bậc thợ (bắt buộc cả 2).
export function repairStaffAssignment(state: DepotState, staffUserId: string): { team?: RepairTeam; member?: RepairTeamMember; grade?: RepairGrade } {
  for (const team of state.repairTeams) {
    const member = team.members.find((m) => m.isActive && m.staffUserId === staffUserId);
    if (member) return { team, member, grade: (state.repairGrades || []).find((g) => g.id === member.gradeId) };
  }
  return {};
}

export function assignRepairStaff(state: DepotState, input: { staffUserId: string; teamId: string; gradeId: string }): DepotState {
  assertAdmin(state);
  const user = state.staffUsers.find((u) => u.id === input.staffUserId);
  if (!user || !user.isActive || !user.roles.includes('REPAIR_STAFF')) throw new Error('Chỉ gán được user đang hoạt động có vai trò SỬA CHỮA.');
  const team = state.repairTeams.find((t) => t.id === input.teamId && t.isActive);
  if (!team) throw new Error('Vui lòng chọn TỔ SỬA CHỮA.');
  const grade = (state.repairGrades || []).find((g) => g.id === input.gradeId && g.isActive);
  if (!grade) throw new Error('Vui lòng chọn BẬC THỢ.');
  const repairTeams = state.repairTeams.map((t) => {
    // Rời tổ cũ (ngưng, giữ lịch sử); ở lại tổ này thì cập nhật bậc thợ
    const members = t.members.map((m) =>
      m.isActive && m.staffUserId === user.id ? (t.id === team.id ? { ...m, gradeId: grade.id, fullName: user.fullName } : { ...m, isActive: false }) : m
    );
    if (t.id === team.id && !members.some((m) => m.isActive && m.staffUserId === user.id)) {
      members.push({ id: newId('rtm'), fullName: user.fullName, isActive: true, staffUserId: user.id, gradeId: grade.id });
    }
    return { ...t, members };
  });
  return appendAudit(
    { ...state, repairTeams },
    'ADMIN_ADD_REPAIR_MEMBER',
    'CATALOG',
    team.code,
    `[Admin Danh mục chung] Gán ${user.fullName} → ${team.name}, bậc thợ ${grade.name} (${grade.hourlyRate.toLocaleString('vi-VN')}đ / giờ)`
  );
}

// ============================================================================
// 16. DANH MỤC CHUNG — USER & PHÂN QUYỀN (DEC-045, chỉ ADMIN)
// Chế độ Demo: chỉ quản lý hồ sơ nhân viên. Chế độ Supabase: tài khoản đăng nhập tạo qua Supabase Auth (server-side).
// ============================================================================
function cleanRoles(roles: AppRole[]): AppRole[] {
  const list = Array.from(new Set(roles)).filter((r) => ASSIGNABLE_ROLES.includes(r));
  if (list.length === 0) throw new Error('Phải chọn ít nhất 1 vai trò.');
  return list;
}

function assertKeepsAdmin(state: DepotState, users: StaffUser[]): void {
  if (!users.some((u) => u.isActive && u.roles.includes('ADMIN'))) {
    throw new Error('Hệ thống phải còn ít nhất 1 tài khoản ADMIN đang hoạt động.');
  }
  void state;
}

export function addStaffUser(
  state: DepotState,
  input: { fullName: string; email: string; roles: AppRole[]; department?: AppRole }
): DepotState {
  assertAdmin(state);
  const fullName = input.fullName.trim();
  if (input.department && !ASSIGNABLE_ROLES.includes(input.department)) throw new Error('Phòng ban không hợp lệ.'); // DEC-191
  const email = input.email.trim().toLowerCase();
  if (!fullName) throw new Error('Vui lòng nhập họ tên.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Email không hợp lệ.');
  if (state.staffUsers.some((u) => u.email.toLowerCase() === email)) throw new Error(`Email ${email} đã tồn tại.`);
  const roles = cleanRoles(input.roles);
  const maxNo = state.staffUsers.reduce((m, u) => Math.max(m, Number(u.staffCode.replace(/\D/g, '')) || 0), 0);
  const staffCode = `NV-${String(maxNo + 1).padStart(3, '0')}`;
  const user: StaffUser = { id: newId('usr'), staffCode, fullName, email, roles, isActive: true, department: input.department };
  return appendAudit(
    { ...state, staffUsers: [...state.staffUsers, user] },
    'ADMIN_ADD_USER',
    'USER',
    staffCode,
    `[Admin] Thêm user ${staffCode} ${fullName} — vai trò ${roles.join(', ')}`
  );
}

export function updateStaffUser(
  state: DepotState,
  input: { userId: string; roles?: AppRole[]; isActive?: boolean }
): DepotState {
  assertAdmin(state);
  const target = state.staffUsers.find((u) => u.id === input.userId);
  if (!target) throw new Error('Không tìm thấy user.');
  if (target.id === state.currentUser.id && input.isActive === false) {
    throw new Error('Không thể tự khóa tài khoản đang đăng nhập.');
  }
  const updated: StaffUser = {
    ...target,
    roles: input.roles ? cleanRoles(input.roles) : target.roles,
    isActive: input.isActive ?? target.isActive,
  };
  const staffUsers = state.staffUsers.map((u) => (u.id === target.id ? updated : u));
  assertKeepsAdmin(state, staffUsers);
  return appendAudit(
    { ...state, staffUsers, currentUser: state.currentUser.id === target.id ? updated : state.currentUser },
    'ADMIN_UPDATE_USER',
    'USER',
    target.staffCode,
    `[Admin] Cập nhật user ${target.staffCode} ${target.fullName}: vai trò ${updated.roles.join(', ')}, ${updated.isActive ? 'đang hoạt động' : 'đã khóa'}`
  );
}

// DEC-191: THÔNG TIN CHI TIẾT NHÂN VIÊN — chỉ Admin sửa; để trống = chưa cập nhật. Nhật ký không ghi số CCCD.
export const STAFF_MIN_AGE = 15;
export function updateStaffProfile(
  state: DepotState,
  input: { userId: string; department?: AppRole | null; gender?: StaffGender | null; idNumber?: string | null; birthYear?: number | null; hometown?: string | null }
): DepotState {
  assertAdmin(state);
  const target = state.staffUsers.find((u) => u.id === input.userId);
  if (!target) throw new Error('Không tìm thấy nhân viên.');
  const idNumber = (input.idNumber || '').replace(/\s/g, '') || undefined;
  if (idNumber && !/^\d{12}$/.test(idNumber)) throw new Error('Số CCCD phải gồm đúng 12 chữ số.');
  if (idNumber && state.staffUsers.some((u) => u.id !== target.id && u.idNumber === idNumber)) throw new Error('Số CCCD đã có ở nhân viên khác.');
  const maxYear = new Date().getFullYear() - STAFF_MIN_AGE;
  const birthYear = input.birthYear || undefined;
  if (birthYear !== undefined && (!Number.isInteger(birthYear) || birthYear < 1940 || birthYear > maxYear)) {
    throw new Error(`Năm sinh không hợp lệ (1940 → ${maxYear}).`);
  }
  if (input.gender && !STAFF_GENDER_LABELS[input.gender]) throw new Error('Giới tính chỉ là Nam hoặc Nữ.');
  if (input.department && !ASSIGNABLE_ROLES.includes(input.department)) throw new Error('Phòng ban không hợp lệ.');
  const updated: StaffUser = {
    ...target,
    department: input.department || undefined,
    gender: input.gender || undefined,
    idNumber,
    birthYear,
    hometown: input.hometown?.trim() || undefined,
  };
  return appendAudit(
    {
      ...state,
      staffUsers: state.staffUsers.map((u) => (u.id === target.id ? updated : u)),
      currentUser: state.currentUser.id === target.id ? { ...state.currentUser, ...updated } : state.currentUser,
    },
    'ADMIN_UPDATE_STAFF_PROFILE',
    'USER',
    target.staffCode,
    `[Admin] Cập nhật thông tin chi tiết ${target.staffCode} ${target.fullName}`
  );
}

// Ô thông tin chi tiết còn trống (hiện "Chưa cập nhật")
export function staffProfileMissing(u: StaffUser): string[] {
  return [
    !u.gender && 'Giới tính',
    !u.idNumber && 'CCCD',
    !u.birthYear && 'Năm sinh',
    !u.hometown && 'Quê quán',
    !u.department && 'Phòng ban',
  ].filter(Boolean) as string[];
}

// ============================================================================
// 17. GIÁM ĐỊNH — XÓA HỒ SƠ HẠ VỎ khi Văn phòng chưa thao tác (DEC-059)
// Xóa hẳn, không lưu lịch sử / không ghi nhật ký (người dùng xác nhận). Mã đã cấp không được dùng lại.
// ============================================================================
export function deleteGateInFieldRecord(state: DepotState, input: { gateInId: string }): DepotState {
  assertPermission(state, 'GATE_IN_FIELD', 'chỉ Giám định / Quản lý được xóa hồ sơ hạ vỏ.');
  const order = state.gateInOrders.find((o) => o.id === input.gateInId);
  if (!order) throw new Error('Không tìm thấy hồ sơ hạ vỏ.');
  const officeTouched =
    order.status !== 'FIELD_RECORDED' || Boolean(order.officeVerifiedAt || order.voucherId || order.containerNo);
  if (officeTouched) {
    throw new Error(`Hồ sơ ${order.masterDossierCode} đã được Văn phòng xử lý — Giám định không được xóa.`);
  }
  return { ...state, gateInOrders: state.gateInOrders.filter((o) => o.id !== order.id) };
}

// DEC-060: kiểm tra số container khi Văn phòng Hạ vỏ — dùng cả lúc gõ (giao diện) và lúc xác nhận (nghiệp vụ)
export function gateInContainerConflict(state: DepotState, rawContainerNo: string, gateInId?: string): string | null {
  const contNo = rawContainerNo.trim().toUpperCase();
  if (!/^[A-Z]{4}\d{7}$/.test(contNo)) return null;
  const active = findActiveContainer(state, contNo);
  if (active) {
    return `Container ${contNo} đang có trong TỒN VỎ (hồ sơ ${active.masterDossierCode}, vị trí ${formatLocation(active)}) — không thể Hạ vỏ trùng.`;
  }
  const dup = state.gateInOrders.find(
    (o) => o.id !== gateInId && o.containerNo === contNo && o.status !== 'GATE_IN_OK' && o.status !== 'CANCELLED'
  );
  if (dup) return `Container ${contNo} đang có hồ sơ Hạ vỏ khác chưa hoàn tất (${dup.masterDossierCode}) (GIN-006).`;
  return null;
}

// ============================================================================
// 18. DANH MỤC CHUNG — CÔNG TY (DEC-062, chỉ ADMIN): thông tin in trên giấy tờ
// ============================================================================
export function updateCompanyProfile(state: DepotState, input: CompanyProfile): DepotState {
  assertAdmin(state);
  const name = input.name.trim();
  if (!name) throw new Error('Vui lòng nhập TÊN CÔNG TY.');
  const profile: CompanyProfile = {
    name,
    shortName: input.shortName.trim() || name,
    address: input.address.trim(),
    phone: input.phone.trim(),
    email: input.email.trim(),
    taxCode: input.taxCode.trim(),
    bankAccount: input.bankAccount.trim(),
  };
  return appendAudit({ ...state, companyProfile: profile }, 'ADMIN_UPDATE_COMPANY', 'CATALOG', 'COMPANY', `[Admin Danh mục chung] Cập nhật thông tin công ty: ${name}`);
}

// ============================================================================
// 19. IN PHIẾU THU — theo dõi số lần in (DEC-063): mỗi lần in đều ghi nhận người + giờ
// ============================================================================
export function recordReceiptPrint(state: DepotState, input: { receiptNo: string }): DepotState {
  if (!hasRolePermission(state.currentUser, ['OFFICE', 'MANAGER'])) {
    throw new Error('Không đủ quyền: chỉ Văn phòng / Quản lý được in phiếu thu.');
  }
  const r = state.paymentReceipts.find((x) => x.receiptNo === input.receiptNo);
  if (!r) throw new Error(`Không tìm thấy phiếu thu ${input.receiptNo}.`);
  const entry = { at: nowIso(), by: state.currentUser.fullName };
  const count = (r.printLog?.length || 0) + 1;
  return appendAudit(
    {
      ...state,
      paymentReceipts: state.paymentReceipts.map((x) => (x.id === r.id ? { ...x, printLog: [...(x.printLog || []), entry] } : x)),
    },
    count === 1 ? 'RECEIPT_PRINT' : 'RECEIPT_REPRINT',
    'FINANCE',
    r.receiptNo,
    `In phiếu thu ${r.receiptNo} lần ${count}${count > 1 ? ' (IN LẠI)' : ''}`,
    r.dossierCode
  );
}

// ============================================================================
// TỒN VỎ — KHÓA / MỞ KHÓA & GHI CHÚ HÀNG LOẠT (DEC-067)
//   Áp dụng từng container qua đúng hàm đơn lẻ (cùng quyền, kiểm tra, nhật ký).
//   Container đã ở trạng thái đích được bỏ qua (không lỗi cả lô).
// ============================================================================
export interface BulkResult {
  state: DepotState;
  done: string[];
  skipped: { containerNo: string; reason: string }[];
}

export function bulkToggleContainerHold(
  state: DepotState,
  input: { containerIds: string[]; hold: boolean; reason: string }
): BulkResult {
  assertPermission(state, 'CONTAINER_LOCK', 'chỉ Văn phòng / Quản lý được khóa / mở khóa container.');
  if (input.containerIds.length === 0) throw new Error('Chưa chọn container nào.');
  if (!input.reason.trim()) {
    throw new Error(input.hold ? 'Bắt buộc nhập REMARK VĂN PHÒNG khi khóa container.' : 'Bắt buộc nhập ghi chú khi mở khóa container.');
  }
  let next = state;
  const done: string[] = [];
  const skipped: BulkResult['skipped'] = [];
  for (const id of input.containerIds) {
    const c = next.containers.find((x) => x.id === id);
    if (!c || c.status === 'GATED_OUT') { skipped.push({ containerNo: c?.containerNo || id, reason: 'Không còn tồn bãi' }); continue; }
    if (Boolean(c.isOnHold) === input.hold) { skipped.push({ containerNo: c.containerNo, reason: input.hold ? 'Đã khóa' : 'Không bị khóa' }); continue; }
    next = toggleContainerHold(next, { containerNo: c.containerNo, hold: input.hold, reason: input.reason });
    done.push(c.containerNo);
  }
  return { state: next, done, skipped };
}

export function bulkUpdateOfficeNote(state: DepotState, input: { containerIds: string[]; officeNote: string }): BulkResult {
  assertPermission(state, 'OFFICE_NOTE', 'chỉ Văn phòng / Quản lý được ghi chú tồn vỏ.');
  if (input.containerIds.length === 0) throw new Error('Chưa chọn container nào.');
  let next = state;
  const done: string[] = [];
  const skipped: BulkResult['skipped'] = [];
  for (const id of input.containerIds) {
    const c = next.containers.find((x) => x.id === id);
    if (!c || c.status === 'GATED_OUT') { skipped.push({ containerNo: c?.containerNo || id, reason: 'Không còn tồn bãi' }); continue; }
    next = updateContainerOfficeNote(next, { containerId: id, officeNote: input.officeNote });
    done.push(c.containerNo);
  }
  return { state: next, done, skipped };
}

// DEC-088: BÁO GIÁ — XÁC NHẬN CHỜ SỬA CHỮA HÀNG LOẠT (gọi lại confirmQuotationToRepair cho từng cont;
//   cont chưa cập nhật tình trạng sửa chữa / giờ công được bỏ qua và báo lại)
export function bulkConfirmQuotationToRepair(state: DepotState, input: { containerIds: string[] }): BulkResult {
  assertPermission(state, 'QUOTATION', 'chỉ Bộ phận Báo giá được xác nhận báo giá.');
  if (input.containerIds.length === 0) throw new Error('Chưa chọn container nào.');
  let next = state;
  const done: string[] = [];
  const skipped: BulkResult['skipped'] = [];
  for (const id of input.containerIds) {
    const c = next.containers.find((x) => x.id === id);
    if (!c || c.status === 'GATED_OUT' || !c.needsQuotation) {
      skipped.push({ containerNo: c?.containerNo || id, reason: 'Không còn chờ báo giá' });
      continue;
    }
    if (!c.quotationItems?.length || !(Number(c.quotationLaborHours) > 0)) {
      skipped.push({ containerNo: c.containerNo, reason: 'Chưa cập nhật tình trạng sửa chữa / giờ công' });
      continue;
    }
    next = confirmQuotationToRepair(next, { containerNo: c.containerNo });
    done.push(c.containerNo);
  }
  return { state: next, done, skipped };
}
