import {
  ContainerSize,
  ContainerType,
  DirectPaymentMethod,
  FeeLineItem,
  FeeTariffCategory,
  FieldCleaningItem,
  FieldConditionClass,
  FieldStuffingClass,
  GateInType,
  GateOutOrder,
  GateOutType,
  K80InternalTicket,
  PaymentCategory,
} from '../types/depot';
import { DepotState, hasRolePermission } from './depotStore';

function nowIso(): string {
  return new Date().toISOString();
}

function appendAudit(
  state: DepotState,
  actionCode: string,
  entityType: string,
  entityCode: string,
  summary: string,
  masterDossierCode?: string
): DepotState {
  const entry = {
    id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    masterDossierCode,
    actorName: state.currentUser.fullName,
    actorRole: state.currentUser.roles[0] || 'OFFICE',
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

export function generateNextMasterDossierCode(state: DepotState): string {
  const now = new Date();
  const y = String(now.getFullYear()).slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const seq = String(state.gateInOrders.length + 1).padStart(3, '0');
  return `HS-${y}${m}${d}-${seq}`;
}

const LEGACY_CLEANING_MAP: Record<string, FieldCleaningItem> = {
  'KHÔNG VỆ SINH': 'KHÔNG VỆ SINH',
  'QUÉT': 'WP - QUÉT',
  'WP - QUÉT': 'WP - QUÉT',
  'RỬA NƯỚC': 'WW - RỬA NƯỚC',
  'WW - RỬA NƯỚC': 'WW - RỬA NƯỚC',
  'VỆ SINH CÔNG NGHIỆP': 'CC - HÓA CHẤT',
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

// 1. BỘ PHẬN GIÁM ĐỊNH — HẠ VỎ (Mobile): Chụp ảnh cửa cont + nhập thông tin ban đầu & XÁC NHẬN TÁC NGHIỆP sang Văn phòng
export function recordGateInFieldStep(
  state: DepotState,
  input: {
    gateInType: GateInType;
    doorPhotoUrl: string;
    initialContainerHint?: string;
    conditionClass: FieldConditionClass;
    damageRemarks?: string[];
    stuffingClass: FieldStuffingClass;
    cleaningItems: (FieldCleaningItem | string)[];
    manufactureYear?: number;
  }
): DepotState {
  if (
    !hasRolePermission(state.currentUser, [
      'INSPECTOR',
      'GATE_STAFF',
      'YARD_STAFF',
      'MANAGER',
    ])
  ) {
    throw new Error(
      'Không đủ quyền: Chỉ Bộ phận Giám định / Hiện trường / Quản lý mới được xác nhận tác nghiệp Hạ vỏ.'
    );
  }
  if (!input.doorPhotoUrl.trim()) {
    throw new Error('Bắt buộc phải chụp 1 ảnh cửa container nhìn rõ số container.');
  }

  const year = input.manufactureYear || 2018;
  if (year < 1980 || year > 2030) {
    throw new Error('Năm sinh container (AGE) phải theo định dạng 4 chữ số hợp lệ (VD: 2001, 2002...).');
  }

  const normalizedCleaning = normalizeCleaningItems(input.cleaningItems);
  const remarks = input.conditionClass === 'DAMAGE' ? input.damageRemarks || [] : [];
  const isGeneratedKey =
    input.initialContainerHint?.startsWith('HS-') ||
    input.initialContainerHint?.startsWith('GD-');
  const masterDossierCode = isGeneratedKey
    ? input.initialContainerHint!
    : generateNextMasterDossierCode(state);
  const orderCode = masterDossierCode;

  const newOrder = {
    id: `gin-${Date.now()}`,
    masterDossierCode,
    orderCode,
    gateInType: input.gateInType,
    doorPhotoUrl: input.doorPhotoUrl.trim(),
    initialContainerHint: isGeneratedKey
      ? undefined
      : input.initialContainerHint?.trim().toUpperCase(),
    conditionClass: input.conditionClass,
    damageRemarks: remarks,
    stuffingClass: input.stuffingClass,
    cleaningItems: normalizedCleaning,
    manufactureYear: year,
    fieldStaffName: state.currentUser.fullName,
    fieldRecordedAt: nowIso(),
    feeAmount: input.conditionClass === 'DAMAGE' ? 1150000 : 850000,
    status: 'FIELD_RECORDED' as const,
    nextDepartments: [],
  };

  return appendAudit(
    {
      ...state,
      gateInOrders: [newOrder, ...state.gateInOrders],
    },
    'GIAM_DINH_HA_VO',
    'GATE_IN',
    masterDossierCode,
    `[Hồ sơ ${masterDossierCode}] Giám định khởi tạo MÃ HỒ SƠ CHÍNH & xác nhận Hạ vỏ: Trạng thái ${input.conditionClass}${
      remarks.length ? ` (${remarks.join(', ')})` : ''
    }, Đóng hàng ${input.stuffingClass}, Vệ sinh [${normalizedCleaning.join(', ')}], AGE ${year}`,
    masterDossierCode
  );
}

// 2. BỘ PHẬN VĂN PHÒNG — HẠ VỎ: Kiểm tra chứng từ, bổ sung 5 trường & tạo thanh toán
export function verifyGateInOfficeAndCreatePayment(
  state: DepotState,
  input: {
    gateInId: string;
    containerNo: string;
    size: ContainerSize;
    type: ContainerType;
    truckNo: string;
    customerRep: string;
    shippingLineCode: string;
    orderDocNo: string;
    feeLines?: FeeLineItem[];
    feeAmount: number;
  }
): DepotState {
  if (!hasRolePermission(state.currentUser, ['OFFICE', 'MANAGER'])) {
    throw new Error('Không đủ quyền: Chỉ Bộ phận Văn phòng / Quản lý mới được kiểm tra chứng từ và tạo thanh toán.');
  }

  const cleanContNo = input.containerNo.trim().toUpperCase();
  if (!/^[A-Z]{4}\d{7}$/.test(cleanContNo)) {
    throw new Error('SỐ CONTAINER không hợp lệ (chuẩn 4 chữ cái + 7 chữ số, ví dụ MSKU4089123).');
  }
  if (!input.truckNo.trim() || !input.customerRep.trim()) {
    throw new Error('Văn phòng bắt buộc nhập đầy đủ SỐ CONTAINER, SIZE, TYPE, SỐ XE và ĐẠI DIỆN KHÁCH HÀNG.');
  }

  const targetOrder = state.gateInOrders.find((o) => o.id === input.gateInId);
  if (!targetOrder) {
    throw new Error('Không tìm thấy lượt Hạ vỏ.');
  }
  if (targetOrder.status === 'GATE_IN_OK' || targetOrder.status === 'CANCELLED') {
    throw new Error(`Lượt Hạ vỏ đang ở trạng thái ${targetOrder.status}, không thể tạo lại yêu cầu thanh toán.`);
  }

  const existingActiveCont = state.containers.find(
    (c) => c.containerNo === cleanContNo && c.status !== 'GATED_OUT'
  );
  if (existingActiveCont) {
    throw new Error(`Container ${cleanContNo} hiện đang ở trong bãi (${existingActiveCont.status}), không thể Hạ vỏ trùng.`);
  }

  const voucherNo = targetOrder.voucherNo || `CT-GIN-${Date.now().toString().slice(-6)}`;
  const voucherId = targetOrder.voucherId || `vch-${Date.now()}`;

  const newVoucher = {
    id: voucherId,
    masterDossierCode: targetOrder.masterDossierCode,
    voucherNo,
    serviceType: 'GATE_IN' as const,
    referenceCode: targetOrder.orderCode,
    containerNo: cleanContNo,
    shippingLineCode: input.shippingLineCode,
    payerName: input.customerRep.trim(),
    amount: input.feeAmount,
    status: 'PENDING' as const,
    createdBy: state.currentUser.fullName,
    createdAt: nowIso(),
  };

  const vouchers = targetOrder.voucherId
    ? state.vouchers.map((v) => (v.id === voucherId ? newVoucher : v))
    : [newVoucher, ...state.vouchers];

  const gateInOrders = state.gateInOrders.map((o) =>
    o.id === targetOrder.id
      ? {
          ...o,
          containerNo: cleanContNo,
          size: input.size,
          type: input.type,
          truckNo: input.truckNo.trim().toUpperCase(),
          customerRep: input.customerRep.trim(),
          shippingLineCode: input.shippingLineCode,
          orderDocNo: input.orderDocNo.trim(),
          officeStaffName: state.currentUser.fullName,
          officeVerifiedAt: nowIso(),
          feeLines: input.feeLines || [],
          feeAmount: input.feeAmount,
          voucherId,
          voucherNo,
          status: 'PAYMENT_PENDING' as const,
        }
      : o
  );

  return appendAudit(
    { ...state, vouchers, gateInOrders },
    'GATE_IN_OFFICE_VERIFY',
    'GATE_IN',
    targetOrder.masterDossierCode,
    `[Hồ sơ ${targetOrder.masterDossierCode}] Văn phòng bổ sung thông tin cont ${cleanContNo} (${input.size}${input.type}, Xe ${input.truckNo}, ĐD: ${input.customerRep}) & tạo chứng từ ${voucherNo}`,
    targetOrder.masterDossierCode
  );
}

// 3. BỘ PHẬN VĂN PHÒNG — Xác nhận thanh toán (TTT / TTS / TTTT) -> GATE IN OK -> Sinh Phiếu K80 + QR & Đẩy hàng chờ bộ phận
export function confirmGateInPaymentAndComplete(
  state: DepotState,
  input: {
    gateInId: string;
    paymentCategory: PaymentCategory;
    scannedQrCode?: string;
    ttsNote?: string;
    directMethod?: DirectPaymentMethod;
    providerTxRef?: string;
  }
): DepotState {
  if (!hasRolePermission(state.currentUser, ['OFFICE', 'ACCOUNTANT', 'MANAGER'])) {
    throw new Error('Không đủ quyền xác nhận khoản thu.');
  }

  const order = state.gateInOrders.find((o) => o.id === input.gateInId);
  if (!order) throw new Error('Không tìm thấy lượt Hạ vỏ.');
  if (order.status === 'GATE_IN_OK') {
    throw new Error('Lượt Hạ vỏ này đã ở trạng thái GATE IN OK.');
  }
  if (!order.containerNo || !order.size || !order.type || !order.voucherId) {
    throw new Error('Chưa hoàn tất bước Văn phòng kiểm tra chứng từ và tạo yêu cầu thanh toán (GIN-004).');
  }

  const voucher = state.vouchers.find((v) => v.id === order.voucherId);
  if (!voucher) throw new Error('Không tìm thấy chứng từ thanh toán.');

  let updatedMasterReceipts = [...state.masterReceipts];
  let updatedDeductions = [...state.receiptDeductions];
  let matchedReceiptCode: string | undefined;

  if (input.paymentCategory === 'TTT') {
    const qr = (input.scannedQrCode || '').trim().toUpperCase();
    if (!qr) {
      throw new Error('THANH TOÁN TRƯỚC (TTT): Vui lòng quét mã QR của Phiếu thu mẹ vào chứng từ.');
    }
    const receipt = updatedMasterReceipts.find((r) => r.qrCode.toUpperCase() === qr);
    if (!receipt || receipt.status !== 'ACTIVE') {
      throw new Error(`Mã QR "${qr}" không tồn tại hoặc không còn hiệu lực.`);
    }
    if (receipt.remainingAmount < voucher.amount) {
      throw new Error(
        `Số dư Phiếu thu mẹ ${receipt.receiptCode} (${receipt.remainingAmount.toLocaleString('vi-VN')}đ) không đủ để trừ khoản thu (${voucher.amount.toLocaleString('vi-VN')}đ).`
      );
    }

    const balanceBefore = receipt.remainingAmount;
    const balanceAfter = balanceBefore - voucher.amount;
    matchedReceiptCode = receipt.receiptCode;

    updatedMasterReceipts = updatedMasterReceipts.map((r) =>
      r.id === receipt.id
        ? {
            ...r,
            remainingAmount: balanceAfter,
            status: balanceAfter === 0 ? 'EXHAUSTED' : 'ACTIVE',
          }
        : r
    );

    updatedDeductions = [
      {
        id: `ded-${Date.now()}`,
        receiptCode: receipt.receiptCode,
        qrCode: receipt.qrCode,
        voucherNo: voucher.voucherNo,
        containerNo: order.containerNo,
        deductedAmount: voucher.amount,
        balanceBefore,
        balanceAfter,
        performedBy: state.currentUser.fullName,
        performedAt: nowIso(),
      },
      ...updatedDeductions,
    ];
  } else if (input.paymentCategory === 'TTS') {
    if (!input.ttsNote?.trim()) {
      throw new Error('THANH TOÁN SAU (TTS): Phải ghi chú (Note) xác nhận TTS trên chứng từ.');
    }
  } else if (input.paymentCategory === 'TTTT') {
    if (!input.directMethod) {
      throw new Error('THANH TOÁN TRỰC TIẾP (TTTT): Phải chọn Chuyển khoản (API) hoặc Tiền mặt.');
    }
  }

  const updatedVouchers = state.vouchers.map((v) =>
    v.id === voucher.id
      ? {
          ...v,
          paymentCategory: input.paymentCategory,
          directMethod: input.paymentCategory === 'TTTT' ? input.directMethod : undefined,
          scannedQrCode: input.paymentCategory === 'TTT' ? input.scannedQrCode?.trim().toUpperCase() : undefined,
          masterReceiptCode: matchedReceiptCode,
          ttsNote: input.paymentCategory === 'TTS' ? `TTS - ${input.ttsNote?.trim()}` : undefined,
          providerTxRef: input.paymentCategory === 'TTTT' ? input.providerTxRef?.trim() : undefined,
          status: 'CONFIRMED' as const,
          confirmedBy: state.currentUser.fullName,
          confirmedAt: nowIso(),
        }
      : v
  );

  const nextDepartments: string[] = ['XE NÂNG - CHỜ HẠ VỎ'];
  const newWorkOrders = [...state.workOrders];
  const isDamage = order.conditionClass === 'DAMAGE';
  const requiresCleaning = order.cleaningItems.some((item) => item !== 'KHÔNG VỆ SINH');

  if (isDamage) {
    nextDepartments.push('BỘ PHẬN BÁO GIÁ - CHỜ BÁO GIÁ');
    newWorkOrders.unshift({
      id: `wo-insp-${Date.now()}`,
      masterDossierCode: order.masterDossierCode,
      workOrderCode: `INSP-${Date.now().toString().slice(-6)}`,
      containerNo: order.containerNo,
      category: 'INSPECTION',
      sourceOrderCode: order.orderCode,
      items:
        order.damageRemarks.length > 0
          ? [...order.damageRemarks]
          : ['Giám định đầu vào container DAMAGE'],
      estimateCost: 0,
      approvalStatus: 'NOT_REQUIRED',
      workStatus: 'OPEN',
      assignedTo: 'Lê Hoàng Giám Định (Hạ vỏ & Báo giá)',
      createdAt: nowIso(),
    });
  } else {
    nextDepartments.push('SẴN SÀNG CẤP VỎ (AV)');
  }

  if (requiresCleaning) {
    nextDepartments.push(`BỘ PHẬN VỆ SINH - CHỜ VỆ SINH (${order.cleaningItems.join(', ')})`);
    newWorkOrders.unshift({
      id: `wo-cln-${Date.now() + 1}`,
      masterDossierCode: order.masterDossierCode,
      workOrderCode: `CLN-${Date.now().toString().slice(-6)}`,
      containerNo: order.containerNo,
      category: 'CLEANING',
      sourceOrderCode: order.orderCode,
      items: [...order.cleaningItems],
      estimateCost: order.cleaningItems.length * 150000,
      approvalStatus: 'NOT_REQUIRED',
      workStatus: 'OPEN',
      assignedTo: 'Vũ Văn Vệ Sinh',
      createdAt: nowIso(),
    });
  }

  const k80QrCode = `QR-K80-${order.containerNo}`;
  const newK80Ticket: K80InternalTicket = {
    ticketCode: `K80-${Date.now().toString().slice(-6)}`,
    masterDossierCode: order.masterDossierCode,
    qrCode: k80QrCode,
    operationMode: 'HA_VO',
    isPaid: true,
    paymentLabel:
      input.paymentCategory === 'TTT'
        ? 'TTT (Đã trừ Phiếu thu mẹ)'
        : input.paymentCategory === 'TTS'
        ? `TTS (${input.ttsNote?.trim()})`
        : `TTTT (${input.directMethod === 'BANK_TRANSFER_API' ? 'Chuyển khoản API' : 'Tiền mặt'})`,
    containerNo: order.containerNo,
    size: order.size,
    type: order.type,
    conditionClass: order.conditionClass,
    damageRemarks: order.damageRemarks,
    stuffingClass: order.stuffingClass,
    cleaningItems: order.cleaningItems,
    manufactureYear: order.manufactureYear,
    truckNo: order.truckNo,
    customerRep: order.customerRep,
    issuedAt: nowIso(),
    issuedBy: state.currentUser.fullName,
  };

  const updatedGateInOrders = state.gateInOrders.map((o) =>
    o.id === order.id
      ? {
          ...o,
          k80QrCode,
          status: 'GATE_IN_OK' as const,
          gateInOkAt: nowIso(),
          gateInOkBy: state.currentUser.fullName,
          nextDepartments,
        }
      : o
  );

  const newContainer = {
    id: `cnt-${Date.now()}`,
    masterDossierCode: order.masterDossierCode,
    containerNo: order.containerNo,
    size: order.size,
    type: order.type,
    manufactureYear: order.manufactureYear || 2018,
    shippingLineCode: order.shippingLineCode || 'MAERSK',
    customerRep: order.customerRep || '',
    status: 'WAITING_PLACEMENT' as const,
    conditionClass: order.conditionClass,
    damageRemarks: order.damageRemarks || [],
    stuffingClass: order.stuffingClass,
    cleaningItems: order.cleaningItems,
    activeQrCode: k80QrCode,
    isPaid: true,
    currentBlock: null,
    currentBay: null,
    currentRow: null,
    currentTier: null,
    needsCleaning: requiresCleaning,
    needsQuotation: isDamage,
    needsRepair: false,
    forkliftShiftTask: isDamage ? ('HA_KE_GIAM_DINH' as const) : ('NONE' as const),
    isOnHold: false,
    gateInAt: nowIso(),
  };

  return appendAudit(
    {
      ...state,
      masterReceipts: updatedMasterReceipts,
      receiptDeductions: updatedDeductions,
      vouchers: updatedVouchers,
      gateInOrders: updatedGateInOrders,
      workOrders: newWorkOrders,
      k80Tickets: [newK80Ticket, ...state.k80Tickets],
      containers: [
        newContainer,
        ...state.containers.filter((c) => c.containerNo !== order.containerNo),
      ],
    },
    `GATE_IN_OK_${input.paymentCategory}`,
    'GATE_IN',
    order.masterDossierCode,
    `[Hồ sơ ${order.masterDossierCode}] Hoàn tất Hạ vỏ GATE IN OK cho ${order.containerNo} (${input.paymentCategory}) -> In phiếu K80 [${k80QrCode}] -> Chuyển hàng chờ: ${nextDepartments.join(' + ')}`,
    order.masterDossierCode
  );
}

// 4. BỘ PHẬN XE NÂNG — CHỜ HẠ VỎ & CẬP NHẬT VỊ TRÍ (Hỗ trợ quét mã QR phiếu K80)
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
  if (!hasRolePermission(state.currentUser, ['FORKLIFT', 'YARD_STAFF', 'MANAGER'])) {
    throw new Error('Không đủ quyền: Chỉ Bộ phận Xe nâng / Hiện trường / Quản lý mới được cập nhật vị trí.');
  }

  const block = state.yardBlocks.find((b) => b.blockCode === input.blockCode);
  if (!block) throw new Error(`Block "${input.blockCode}" không hợp lệ (YARD-003).`);

  const qr = input.scannedQrCode?.trim().toUpperCase();
  const container = state.containers.find(
    (c) =>
      c.status !== 'GATED_OUT' &&
      (c.containerNo === input.containerNo?.trim().toUpperCase() ||
        (qr &&
          (c.activeQrCode.toUpperCase() === qr ||
            c.masterDossierCode.toUpperCase() === qr ||
            c.containerNo.toUpperCase() === qr)))
  );

  if (!container) {
    throw new Error('Không tìm thấy container tương ứng với mã QR / Mã Hồ Sơ Chính / số container vừa quét.');
  }

  const cleanBay = input.bay?.trim() || null;
  const cleanRow = input.row?.trim() || null;
  const cleanTier = input.tier?.trim() || null;

  const hasAnyDetail = Boolean(cleanBay || cleanRow || cleanTier);
  const hasAllDetail = Boolean(cleanBay && cleanRow && cleanTier);

  if (hasAnyDetail && !hasAllDetail) {
    throw new Error('Khi nhập vị trí chi tiết, vui lòng nhập đủ cả 3 thông số Bay, Row, Tier; hoặc để trống cả 3 nếu chỉ ghi nhận ở cấp Block.');
  }

  if (hasAllDetail) {
    const occupied = state.containers.find(
      (c) =>
        c.containerNo !== container.containerNo &&
        c.status !== 'GATED_OUT' &&
        c.currentBlock === input.blockCode &&
        c.currentBay === cleanBay &&
        c.currentRow === cleanRow &&
        c.currentTier === cleanTier
    );
    if (occupied) {
      throw new Error(
        `Ô vị trí chi tiết ${input.blockCode} / Bay ${cleanBay} / Row ${cleanRow} / Tier ${cleanTier} đang có container ${occupied.containerNo} nằm (YARD-003).`
      );
    }
  }

  const fromLabel = container.currentBlock
    ? container.currentBay
      ? `${container.currentBlock} / Bay ${container.currentBay} / Row ${container.currentRow} / Tier ${container.currentTier}`
      : `${container.currentBlock} (Cấp Block)`
    : 'Chờ hạ vỏ (GATE-IN)';

  const toLabel = hasAllDetail
    ? `${input.blockCode} / Bay ${cleanBay} / Row ${cleanRow} / Tier ${cleanTier}`
    : `${input.blockCode} (Cấp Block — chưa xếp Bay/Row/Tier)`;

  const actionType = !container.currentBlock
    ? 'INITIAL_BLOCK'
    : !container.currentBay && hasAllDetail
    ? 'DETAIL_SLOT_UPDATE'
    : 'YARD_MOVE';

  const updatedContainers = state.containers.map((c) =>
    c.containerNo === container.containerNo
      ? {
          ...c,
          status: c.status === 'WAITING_PLACEMENT' ? ('IN_YARD' as const) : c.status,
          currentBlock: input.blockCode,
          currentBay: cleanBay,
          currentRow: cleanRow,
          currentTier: cleanTier,
        }
      : c
  );

  const historyItem = {
    id: `loc-${Date.now()}`,
    masterDossierCode: container.masterDossierCode,
    containerNo: container.containerNo,
    fromLocation: fromLabel,
    toLocation: toLabel,
    actionType: actionType as 'INITIAL_BLOCK' | 'DETAIL_SLOT_UPDATE' | 'YARD_MOVE',
    reason: input.reason.trim() || 'Xe nâng xác nhận vị trí trong bãi',
    performedBy: state.currentUser.fullName,
    performedAt: nowIso(),
  };

  return appendAudit(
    {
      ...state,
      containers: updatedContainers,
      locationHistory: [historyItem, ...state.locationHistory],
    },
    'YARD_LOCATION_UPDATE',
    'CONTAINER',
    container.masterDossierCode,
    `[Hồ sơ ${container.masterDossierCode}] Xe nâng cập nhật vị trí ${container.containerNo}: ${fromLabel} -> ${toLabel}`,
    container.masterDossierCode
  );
}

// 5. BỘ PHẬN VỆ SINH — CHỜ VỆ SINH: Quét mã QR phiếu K80 / Mã Hồ Sơ Chính hoặc bấm xác nhận hoàn thành vệ sinh
export function completeCleaningTask(
  state: DepotState,
  input: {
    containerNo?: string;
    scannedQrCode?: string;
    notes?: string;
  }
): DepotState {
  const qr = input.scannedQrCode?.trim().toUpperCase();
  const container = state.containers.find(
    (c) =>
      c.needsCleaning &&
      (c.containerNo === input.containerNo?.trim().toUpperCase() ||
        (qr &&
          (c.activeQrCode.toUpperCase() === qr ||
            c.masterDossierCode.toUpperCase() === qr ||
            c.containerNo.toUpperCase() === qr)))
  );

  if (!container) {
    throw new Error('Không tìm thấy container đang chờ vệ sinh khớp với mã QR / Mã Hồ Sơ Chính / số container.');
  }

  const updatedContainers = state.containers.map((c) =>
    c.containerNo === container.containerNo ? { ...c, needsCleaning: false } : c
  );

  const updatedWorkOrders = state.workOrders.map((w) =>
    w.containerNo === container.containerNo && w.category === 'CLEANING'
      ? {
          ...w,
          workStatus: 'COMPLETED' as const,
          completedAt: nowIso(),
          completedBy: state.currentUser.fullName,
          resultNotes: input.notes || 'Đã quét QR xác nhận hoàn thành vệ sinh',
        }
      : w
  );

  return appendAudit(
    {
      ...state,
      containers: updatedContainers,
      workOrders: updatedWorkOrders,
    },
    'COMPLETE_CLEANING_QR',
    'CLEANING',
    container.masterDossierCode,
    `[Hồ sơ ${container.masterDossierCode}] Bộ phận Vệ sinh hoàn tất vệ sinh [${container.cleaningItems.join(', ')}] cho ${container.containerNo}`,
    container.masterDossierCode
  );
}

// 6. BỘ PHẬN BÁO GIÁ — CHỜ BÁO GIÁ (Chỉ cont DAMAGE): Xác nhận báo giá -> Đẩy sang CHỜ SỬA CHỮA & XE NÂNG HẠ SỬA CHỮA
export function approveDamageQuotation(
  state: DepotState,
  input: {
    containerNo: string;
    quotationAmount: number;
    quotationItems: string[];
  }
): DepotState {
  const container = state.containers.find(
    (c) => c.containerNo === input.containerNo && c.needsQuotation
  );
  if (!container) {
    throw new Error('Container không nằm trong hàng chờ Báo giá.');
  }

  const updatedContainers = state.containers.map((c) =>
    c.containerNo === container.containerNo
      ? {
          ...c,
          needsQuotation: false,
          needsRepair: true,
          forkliftShiftTask: 'HA_SUA_CHUA' as const,
          quotationAmount: input.quotationAmount,
          quotationItems: input.quotationItems,
        }
      : c
  );

  const newRepairWo = {
    id: `wo-rep-${Date.now()}`,
    masterDossierCode: container.masterDossierCode,
    workOrderCode: `MNR-${Date.now().toString().slice(-6)}`,
    containerNo: container.containerNo,
    category: 'REPAIR' as const,
    sourceOrderCode: container.masterDossierCode,
    items: input.quotationItems,
    estimateCost: input.quotationAmount,
    approvalStatus: 'APPROVED' as const,
    approvedBy: state.currentUser.fullName,
    workStatus: 'OPEN' as const,
    assignedTo: 'Đặng Kỹ Thuật Sửa Chữa',
    createdAt: nowIso(),
  };

  return appendAudit(
    {
      ...state,
      containers: updatedContainers,
      workOrders: [newRepairWo, ...state.workOrders],
    },
    'APPROVE_QUOTATION',
    'QUOTATION',
    container.masterDossierCode,
    `[Hồ sơ ${container.masterDossierCode}] Bộ phận Báo giá hoàn tất báo giá ${container.containerNo} (${input.quotationAmount.toLocaleString('vi-VN')}đ) -> Chuyển sang CHỜ SỬA CHỮA & Xe nâng HẠ SỬA CHỮA`,
    container.masterDossierCode
  );
}

// 7. BỘ PHẬN SỬA CHỮA — CHỜ SỬA CHỮA: Quét QR hoàn tất sửa chữa -> Chuyển cont sang AV sẵn sàng CẤP VỎ
export function completeRepairTask(
  state: DepotState,
  input: {
    containerNo?: string;
    scannedQrCode?: string;
    notes?: string;
  }
): DepotState {
  const qr = input.scannedQrCode?.trim().toUpperCase();
  const container = state.containers.find(
    (c) =>
      c.needsRepair &&
      (c.containerNo === input.containerNo?.trim().toUpperCase() ||
        (qr &&
          (c.activeQrCode.toUpperCase() === qr ||
            c.masterDossierCode.toUpperCase() === qr ||
            c.containerNo.toUpperCase() === qr)))
  );
  if (!container) {
    throw new Error('Không tìm thấy container đang chờ sửa chữa khớp với mã QR / Mã Hồ Sơ Chính / số container.');
  }

  const updatedContainers = state.containers.map((c) =>
    c.containerNo === container.containerNo
      ? {
          ...c,
          needsRepair: false,
          conditionClass: 'AV' as const,
          damageRemarks: [],
        }
      : c
  );

  const updatedWorkOrders = state.workOrders.map((w) =>
    w.containerNo === container.containerNo && w.category === 'REPAIR'
      ? {
          ...w,
          workStatus: 'COMPLETED' as const,
          completedAt: nowIso(),
          completedBy: state.currentUser.fullName,
          resultNotes: input.notes || 'Đã sửa chữa hoàn tất -> Nghiệm thu đạt chuẩn AV',
        }
      : w
  );

  return appendAudit(
    {
      ...state,
      containers: updatedContainers,
      workOrders: updatedWorkOrders,
    },
    'COMPLETE_REPAIR_TO_AV',
    'REPAIR',
    container.masterDossierCode,
    `[Hồ sơ ${container.masterDossierCode}] Bộ phận Sửa chữa hoàn tất sửa chữa ${container.containerNo} -> Chuyển trạng thái sang AV sẵn sàng CẤP VỎ`,
    container.masterDossierCode
  );
}

// 8. BỘ PHẬN XE NÂNG — ĐẢO CHUYỂN (+ HẠ SỬA CHỮA / + HẠ KỆ GIÁM ĐỊNH)
export function completeForkliftShift(
  state: DepotState,
  input: {
    containerNo?: string;
    scannedQrCode?: string;
    shiftType: 'HA_SUA_CHUA' | 'HA_KE_GIAM_DINH';
    targetBlock: string;
  }
): DepotState {
  const qr = input.scannedQrCode?.trim().toUpperCase();
  const container = state.containers.find(
    (c) =>
      c.forkliftShiftTask === input.shiftType &&
      (c.containerNo === input.containerNo?.trim().toUpperCase() ||
        (qr &&
          (c.activeQrCode.toUpperCase() === qr ||
            c.masterDossierCode.toUpperCase() === qr ||
            c.containerNo.toUpperCase() === qr)))
  );
  if (!container) {
    throw new Error('Không tìm thấy container trong danh sách chờ đảo chuyển này.');
  }

  const label =
    input.shiftType === 'HA_SUA_CHUA'
      ? 'Đảo chuyển HẠ SỬA CHỮA'
      : 'Đảo chuyển HẠ KỆ GIÁM ĐỊNH';

  const updatedContainers = state.containers.map((c) =>
    c.containerNo === container.containerNo
      ? {
          ...c,
          forkliftShiftTask: 'NONE' as const,
          currentBlock: input.targetBlock,
          currentBay: null,
          currentRow: null,
          currentTier: null,
        }
      : c
  );

  const locItem = {
    id: `loc-${Date.now()}`,
    masterDossierCode: container.masterDossierCode,
    containerNo: container.containerNo,
    fromLocation: container.currentBlock || 'Bãi',
    toLocation: `${input.targetBlock} (${label})`,
    actionType:
      input.shiftType === 'HA_SUA_CHUA'
        ? ('SHIFT_REPAIR' as const)
        : ('SHIFT_INSPECTION_RACK' as const),
    reason: label,
    performedBy: state.currentUser.fullName,
    performedAt: nowIso(),
  };

  return appendAudit(
    {
      ...state,
      containers: updatedContainers,
      locationHistory: [locItem, ...state.locationHistory],
    },
    'FORKLIFT_SHIFT_DONE',
    'CONTAINER',
    container.masterDossierCode,
    `[Hồ sơ ${container.masterDossierCode}] Xe nâng hoàn tất ${label} cho container ${container.containerNo} tại ${input.targetBlock}`,
    container.masterDossierCode
  );
}

// 9. TẠM GIỮ / KHÓA XUẤT CONTAINER
export function toggleContainerHold(
  state: DepotState,
  input: {
    containerNo: string;
    hold: boolean;
    reason: string;
  }
): DepotState {
  if (!hasRolePermission(state.currentUser, ['MANAGER', 'OFFICE'])) {
    throw new Error('Không đủ quyền đặt/gỡ khóa xuất (Hold).');
  }
  if (!input.reason.trim()) {
    throw new Error('Bắt buộc nhập lý do tạm giữ / mở khóa xuất.');
  }

  const targetCont = state.containers.find((c) => c.containerNo === input.containerNo);
  const updatedContainers = state.containers.map((c) =>
    c.containerNo === input.containerNo
      ? {
          ...c,
          isOnHold: input.hold,
          holdReason: input.hold ? input.reason.trim() : undefined,
          holdBy: input.hold ? state.currentUser.fullName : undefined,
          holdAt: input.hold ? nowIso() : undefined,
        }
      : c
  );

  return appendAudit(
    { ...state, containers: updatedContainers },
    input.hold ? 'CONTAINER_HOLD' : 'CONTAINER_UNHOLD',
    'CONTAINER',
    targetCont?.masterDossierCode || input.containerNo,
    `[Hồ sơ ${targetCont?.masterDossierCode || 'N/A'}] ${input.hold ? 'Đặt khóa xuất (Hold)' : 'Gỡ khóa xuất (Unhold)'} container ${input.containerNo}: ${input.reason.trim()}`,
    targetCont?.masterDossierCode
  );
}

// 10. BOOKING & CẤP VỎ — Khóa phân bổ chống cấp trùng (DEC-006)
export function allocateContainerToBooking(
  state: DepotState,
  input: {
    bookingId: string;
    containerNo: string;
    truckNo?: string;
  }
): DepotState {
  if (!hasRolePermission(state.currentUser, ['OFFICE', 'MANAGER'])) {
    throw new Error('Không đủ quyền phân bổ và khóa cấp container.');
  }

  const booking = state.bookings.find((b) => b.id === input.bookingId);
  if (!booking) throw new Error('Không tìm thấy Booking/Lệnh cấp.');

  if (booking.allocatedContainers.length >= booking.requestedQty) {
    throw new Error(`Booking ${booking.bookingNo} đã phân bổ đủ số lượng (${booking.requestedQty} container).`);
  }

  const container = state.containers.find((c) => c.containerNo === input.containerNo);
  if (!container) throw new Error('Không tìm thấy container.');

  if (container.status === 'ALLOCATED' || container.allocatedBookingNo) {
    throw new Error(
      `Chặn cấp trùng (DEC-006): Container ${container.containerNo} đang bị khóa phân bổ cho lệnh ${container.allocatedBookingNo}.`
    );
  }
  if (container.status !== 'IN_YARD') {
    throw new Error(`Container ${container.containerNo} chưa ở trạng thái tồn bãi sẵn sàng.`);
  }
  if (container.conditionClass !== 'AV') {
    throw new Error(`Chỉ container trạng thái AV mới được phép CẤP VỎ (hiện tại: ${container.conditionClass}).`);
  }
  if (container.isOnHold) {
    throw new Error(`Container ${container.containerNo} đang bị tạm giữ/khóa xuất (${container.holdReason}).`);
  }
  if (container.size !== booking.size || container.type !== booking.type) {
    throw new Error(
      `Kích cỡ/Loại của container (${container.size}${container.type}) không khớp với yêu cầu của Booking (${booking.size}${booking.type}).`
    );
  }

  const nextAllocated = [...booking.allocatedContainers, container.containerNo];
  const k80QrCode = `QR-OUT-${container.containerNo}`;

  const updatedBookings = state.bookings.map((b) =>
    b.id === booking.id
      ? {
          ...b,
          allocatedContainers: nextAllocated,
          status:
            nextAllocated.length >= b.requestedQty ? ('FULLY_ALLOCATED' as const) : ('OPEN' as const),
        }
      : b
  );

  const updatedContainers = state.containers.map((c) =>
    c.containerNo === container.containerNo
      ? {
          ...c,
          status: 'ALLOCATED' as const,
          activeQrCode: k80QrCode,
          allocatedBookingNo: booking.bookingNo,
          allocatedTruckNo: input.truckNo?.trim().toUpperCase(),
          allocatedAt: nowIso(),
        }
      : c
  );

  const k80Ticket: K80InternalTicket = {
    ticketCode: `K80-OUT-${Date.now().toString().slice(-6)}`,
    masterDossierCode: container.masterDossierCode,
    qrCode: k80QrCode,
    operationMode: 'CAP_VO',
    isPaid: true,
    paymentLabel: 'ĐÃ XÁC NHẬN LỆNH CẤP VỎ',
    containerNo: container.containerNo,
    size: container.size,
    type: container.type,
    conditionClass: container.conditionClass,
    stuffingClass: container.stuffingClass,
    cleaningItems: container.cleaningItems,
    manufactureYear: container.manufactureYear,
    truckNo: input.truckNo?.trim().toUpperCase(),
    customerRep: booking.receiverName,
    targetBlock: container.currentBlock || 'BLOCK-A',
    issuedAt: nowIso(),
    issuedBy: state.currentUser.fullName,
  };

  return appendAudit(
    {
      ...state,
      bookings: updatedBookings,
      containers: updatedContainers,
      k80Tickets: [k80Ticket, ...state.k80Tickets],
    },
    'BOOKING_ALLOCATE_LOCK',
    'BOOKING',
    container.masterDossierCode,
    `[Hồ sơ ${container.masterDossierCode}] Văn phòng khóa phân bổ cont AV ${container.containerNo} vào lệnh ${booking.bookingNo}, in phiếu K80 [${k80QrCode}] & chuyển sang XE NÂNG - CHỜ CẤP VỎ`,
    container.masterDossierCode
  );
}

export function releaseAllocatedContainer(
  state: DepotState,
  input: {
    bookingId: string;
    containerNo: string;
    reason: string;
  }
): DepotState {
  if (!hasRolePermission(state.currentUser, ['OFFICE', 'MANAGER'])) {
    throw new Error('Không đủ quyền giải phóng khóa phân bổ container.');
  }
  if (!input.reason.trim()) {
    throw new Error('Bắt buộc nhập lý do đổi/hủy phân bổ container (REL-003/REL-004).');
  }

  const booking = state.bookings.find((b) => b.id === input.bookingId);
  if (!booking) throw new Error('Không tìm thấy Booking.');

  const targetCont = state.containers.find((c) => c.containerNo === input.containerNo);
  const updatedBookings = state.bookings.map((b) =>
    b.id === booking.id
      ? {
          ...b,
          allocatedContainers: b.allocatedContainers.filter((no) => no !== input.containerNo),
          status: 'OPEN' as const,
        }
      : b
  );

  const updatedContainers = state.containers.map((c) =>
    c.containerNo === input.containerNo
      ? {
          ...c,
          status: 'IN_YARD' as const,
          allocatedBookingNo: undefined,
          allocatedTruckNo: undefined,
          allocatedAt: undefined,
        }
      : c
  );

  return appendAudit(
    { ...state, bookings: updatedBookings, containers: updatedContainers },
    'BOOKING_RELEASE_LOCK',
    'BOOKING',
    targetCont?.masterDossierCode || booking.bookingNo,
    `[Hồ sơ ${targetCont?.masterDossierCode || 'N/A'}] Giải phóng khóa phân bổ container ${input.containerNo} khỏi lệnh ${booking.bookingNo}. Lý do: ${input.reason.trim()}`,
    targetCont?.masterDossierCode
  );
}

// 11. GATE OUT / XE NÂNG CHỜ CẤP VỎ — Kiểm tra đủ 5 điều kiện & quét QR xuất bãi (kết thúc vòng đời Mã Hồ Sơ Chính tại bãi)
export function executeGateOut(
  state: DepotState,
  input: {
    gateOutType: GateOutType;
    bookingNo: string;
    containerNo: string;
    truckNo: string;
    receiverRep: string;
    feeAmount: number;
    paymentCategory: PaymentCategory;
    scannedQrCode?: string;
    ttsNote?: string;
    directMethod?: DirectPaymentMethod;
    providerTxRef?: string;
    documentsVerified: boolean;
  }
): DepotState {
  if (
    !hasRolePermission(state.currentUser, [
      'FORKLIFT',
      'GATE_STAFF',
      'YARD_STAFF',
      'OFFICE',
      'MANAGER',
    ])
  ) {
    throw new Error('Không đủ quyền thực hiện xuất bãi / cấp vỏ.');
  }

  const container = state.containers.find((c) => c.containerNo === input.containerNo);
  if (!container) throw new Error('Không tìm thấy container trong hệ thống.');
  if (container.status === 'GATED_OUT') {
    throw new Error(`Chặn xuất trùng (GOUT-003): Container ${container.containerNo} đã được xuất bãi trước đó.`);
  }

  const booking = state.bookings.find((b) => b.bookingNo === input.bookingNo.trim());
  if (!booking || booking.status === 'CANCELLED') {
    throw new Error('Điều kiện 1 thất bại: Không tìm thấy lệnh cấp/lệnh xuất hợp lệ (GOUT-002).');
  }
  if (container.isOnHold) {
    throw new Error(
      `Điều kiện 2 thất bại: Container ${container.containerNo} đang bị tạm giữ / khóa xuất (${container.holdReason}).`
    );
  }
  if (!booking.allocatedContainers.includes(container.containerNo)) {
    throw new Error(
      `Điều kiện 3 thất bại: Container ${container.containerNo} chưa được khóa phân bổ trong lệnh ${booking.bookingNo}.`
    );
  }
  if (!input.documentsVerified || !input.truckNo.trim() || !input.receiverRep.trim()) {
    throw new Error('Điều kiện 5 thất bại: Chứng từ, biển số xe nhận hoặc thủ tục xuất bãi chưa hoàn tất.');
  }

  let updatedMasterReceipts = [...state.masterReceipts];
  let updatedDeductions = [...state.receiptDeductions];
  const voucherNo = `CT-GOUT-${Date.now().toString().slice(-6)}`;

  if (input.paymentCategory === 'TTT') {
    const qr = (input.scannedQrCode || '').trim().toUpperCase();
    const receipt = updatedMasterReceipts.find((r) => r.qrCode.toUpperCase() === qr && r.status === 'ACTIVE');
    if (!receipt || receipt.remainingAmount < input.feeAmount) {
      throw new Error('Điều kiện 4 thất bại: Mã QR Phiếu thu mẹ (TTT) không hợp lệ hoặc không đủ số dư.');
    }
    const before = receipt.remainingAmount;
    const after = before - input.feeAmount;
    updatedMasterReceipts = updatedMasterReceipts.map((r) =>
      r.id === receipt.id ? { ...r, remainingAmount: after, status: after === 0 ? 'EXHAUSTED' : 'ACTIVE' } : r
    );
    updatedDeductions = [
      {
        id: `ded-${Date.now()}`,
        receiptCode: receipt.receiptCode,
        qrCode: receipt.qrCode,
        voucherNo,
        containerNo: container.containerNo,
        deductedAmount: input.feeAmount,
        balanceBefore: before,
        balanceAfter: after,
        performedBy: state.currentUser.fullName,
        performedAt: nowIso(),
      },
      ...updatedDeductions,
    ];
  } else if (input.paymentCategory === 'TTS') {
    if (!input.ttsNote?.trim()) {
      throw new Error('Điều kiện 4 thất bại: Thanh toán sau (TTS) bắt buộc có ghi chú (Note) TTS trên chứng từ.');
    }
  } else if (input.paymentCategory === 'TTTT') {
    if (!input.directMethod) {
      throw new Error('Điều kiện 4 thất bại: Thanh toán trực tiếp (TTTT) phải chọn Chuyển khoản (API) hoặc Tiền mặt.');
    }
  }

  const gateOutCode = `GOUT-${Date.now().toString().slice(-6)}`;
  const newVoucher = {
    id: `vch-out-${Date.now()}`,
    masterDossierCode: container.masterDossierCode,
    voucherNo,
    serviceType: 'GATE_OUT' as const,
    referenceCode: gateOutCode,
    containerNo: container.containerNo,
    shippingLineCode: container.shippingLineCode,
    payerName: input.receiverRep.trim(),
    amount: input.feeAmount,
    paymentCategory: input.paymentCategory,
    directMethod: input.paymentCategory === 'TTTT' ? input.directMethod : undefined,
    scannedQrCode: input.paymentCategory === 'TTT' ? input.scannedQrCode?.trim().toUpperCase() : undefined,
    ttsNote: input.paymentCategory === 'TTS' ? `TTS - ${input.ttsNote?.trim()}` : undefined,
    providerTxRef: input.providerTxRef?.trim(),
    status: 'CONFIRMED' as const,
    confirmedBy: state.currentUser.fullName,
    confirmedAt: nowIso(),
    createdBy: state.currentUser.fullName,
    createdAt: nowIso(),
  };

  const prevLoc = container.currentBlock
    ? container.currentBay
      ? `${container.currentBlock} / Bay ${container.currentBay} / Row ${container.currentRow} / Tier ${container.currentTier}`
      : `${container.currentBlock} (Cấp Block)`
    : 'Trong bãi';

  const updatedContainers = state.containers.map((c) =>
    c.containerNo === container.containerNo
      ? {
          ...c,
          status: 'GATED_OUT' as const,
          currentBlock: null,
          currentBay: null,
          currentRow: null,
          currentTier: null,
          gateOutAt: nowIso(),
        }
      : c
  );

  const updatedBookings = state.bookings.map((b) =>
    b.id === booking.id
      ? {
          ...b,
          gatedOutContainers: [...b.gatedOutContainers, container.containerNo],
          status:
            b.gatedOutContainers.length + 1 >= b.requestedQty ? ('COMPLETED' as const) : b.status,
        }
      : b
  );

  const newGateOutOrder: GateOutOrder = {
    id: `gout-${Date.now()}`,
    masterDossierCode: container.masterDossierCode,
    gateOutCode,
    gateOutType: input.gateOutType,
    bookingNo: booking.bookingNo,
    containerNo: container.containerNo,
    truckNo: input.truckNo.trim().toUpperCase(),
    receiverRep: input.receiverRep.trim(),
    feeAmount: input.feeAmount,
    voucherId: newVoucher.id,
    voucherNo: newVoucher.voucherNo,
    k80QrCode: container.activeQrCode,
    chkValidOrder: true,
    chkNotOnHold: true,
    chkCorrectContainer: true,
    chkPaymentSettled: true,
    chkDocumentsCompleted: true,
    status: 'GATE_OUT_OK',
    confirmedBy: state.currentUser.fullName,
    confirmedAt: nowIso(),
    createdAt: nowIso(),
  };

  const locHistoryItem = {
    id: `loc-${Date.now()}`,
    masterDossierCode: container.masterDossierCode,
    containerNo: container.containerNo,
    fromLocation: prevLoc,
    toLocation: `OUT KHỎI BÃI (${input.truckNo.trim().toUpperCase()})`,
    actionType: 'GATE_OUT_CLEAR' as const,
    reason: `Xuất bãi theo lệnh ${booking.bookingNo} (${input.gateOutType})`,
    performedBy: state.currentUser.fullName,
    performedAt: nowIso(),
  };

  return appendAudit(
    {
      ...state,
      masterReceipts: updatedMasterReceipts,
      receiptDeductions: updatedDeductions,
      vouchers: [newVoucher, ...state.vouchers],
      containers: updatedContainers,
      bookings: updatedBookings,
      gateOutOrders: [newGateOutOrder, ...state.gateOutOrders],
      locationHistory: [locHistoryItem, ...state.locationHistory],
    },
    'GATE_OUT_OK',
    'GATE_OUT',
    container.masterDossierCode,
    `[Hồ sơ ${container.masterDossierCode}] Hoàn tất xuất bãi (${input.gateOutType}) cho cont ${container.containerNo} theo lệnh ${booking.bookingNo}, xe ${input.truckNo} -> KẾT THÚC VÒNG ĐỜI HỒ SƠ TẠI BÃI`,
    container.masterDossierCode
  );
}

// 12. TẠO PHIẾU THU MẸ MỚI CHO KHÁCH HÀNG (TTT)
export function createMasterPrepaidReceipt(
  state: DepotState,
  input: {
    customerName: string;
    lotDescription: string;
    totalAmount: number;
  }
): DepotState {
  if (!hasRolePermission(state.currentUser, ['ACCOUNTANT', 'OFFICE', 'MANAGER'])) {
    throw new Error('Không đủ quyền tạo Phiếu thu mẹ (TTT).');
  }
  if (!input.customerName.trim() || input.totalAmount <= 0) {
    throw new Error('Vui lòng nhập khách hàng và số tiền lô trả trước lớn hơn 0.');
  }

  const seq = String(state.masterReceipts.length + 1).padStart(3, '0');
  const receiptCode = `PTM-2026-${seq}`;
  const cleanCode = input.customerName
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
  const qrCode = `QR-TTT-${cleanCode || 'CUST'}-${seq}`;

  const newReceipt = {
    id: `mpr-${Date.now()}`,
    receiptCode,
    qrCode,
    customerName: input.customerName.trim(),
    lotDescription: input.lotDescription.trim() || 'Đóng trước 1 lô container',
    totalAmount: input.totalAmount,
    remainingAmount: input.totalAmount,
    status: 'ACTIVE' as const,
    createdBy: state.currentUser.fullName,
    createdAt: nowIso(),
  };

  return appendAudit(
    {
      ...state,
      masterReceipts: [newReceipt, ...state.masterReceipts],
    },
    'CREATE_MASTER_RECEIPT_TTT',
    'FINANCE',
    receiptCode,
    `Tạo Phiếu thu mẹ ${receiptCode} (Mã QR: ${qrCode}) cho ${input.customerName} với số tiền ${input.totalAmount.toLocaleString('vi-VN')}đ`
  );
}

// 13. CẤU HÌNH DANH MỤC CHUNG (CHỈ ADMIN CÓ QUYỀN CẤU HÌNH)
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
    id: `pt-${Date.now()}`,
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
    blockCode: string;
    blockName: string;
    maxBay: number;
    maxRow: number;
    maxTier: number;
    description?: string;
  }
): DepotState {
  assertAdmin(state);
  const cleanCode = input.blockCode.trim().toUpperCase();
  const cleanName = input.blockName.trim();
  if (!cleanCode || !cleanName) {
    throw new Error('Vui lòng nhập đầy đủ Mã Vị trí (Block) và Tên khu vực.');
  }
  if (state.yardBlocks.some((b) => b.blockCode.toUpperCase() === cleanCode)) {
    throw new Error(`Mã Vị trí "${cleanCode}" đã tồn tại trong Danh mục chung.`);
  }
  const maxBay = Math.max(1, Number(input.maxBay) || 10);
  const maxRow = Math.max(1, Number(input.maxRow) || 4);
  const maxTier = Math.max(1, Number(input.maxTier) || 4);
  const capacity = maxBay * maxRow * maxTier;

  const newBlock = {
    blockCode: cleanCode,
    blockName: cleanName,
    maxBay,
    maxRow,
    maxTier,
    capacity,
    description: input.description?.trim() || 'Khu vực lưu bãi theo cấu hình Danh mục chung',
  };

  return appendAudit(
    {
      ...state,
      yardBlocks: [...state.yardBlocks, newBlock],
    },
    'ADMIN_ADD_YARD_BLOCK',
    'CATALOG',
    cleanCode,
    `[Admin Danh mục chung] Thêm VỊ TRÍ [${cleanCode}] ${cleanName} (Bay:${maxBay} / Row:${maxRow} / Tier:${maxTier})`
  );
}

export function deleteYardBlockCatalogItem(
  state: DepotState,
  blockCode: string
): DepotState {
  assertAdmin(state);
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
    id: `fee-${Date.now()}`,
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

// 14. CẬP NHẬT GHI CHÚ CỦA NHÂN VIÊN VĂN PHÒNG TRONG DANH SÁCH TỒN VỎ
export function updateContainerOfficeNote(
  state: DepotState,
  input: {
    containerId: string;
    officeNote: string;
  }
): DepotState {
  const target = state.containers.find((c) => c.id === input.containerId);
  if (!target) return state;

  const cleanNote = input.officeNote.trim();
  const updatedContainers = state.containers.map((c) =>
    c.id === input.containerId
      ? {
          ...c,
          officeNote: cleanNote || undefined,
          officeNoteUpdatedBy: cleanNote ? state.currentUser.fullName : undefined,
          officeNoteUpdatedAt: cleanNote ? nowIso() : undefined,
        }
      : c
  );

  return appendAudit(
    {
      ...state,
      containers: updatedContainers,
    },
    'UPDATE_TON_VO_NOTE',
    'CONTAINER',
    target.masterDossierCode,
    cleanNote
      ? `[Hồ sơ ${target.masterDossierCode}] Văn phòng thêm Ghi chú tồn vỏ cho ${target.containerNo}: "${cleanNote}"`
      : `[Hồ sơ ${target.masterDossierCode}] Văn phòng xóa Ghi chú tồn vỏ cho ${target.containerNo}`,
    target.masterDossierCode
  );
}
