import { describe, expect, it } from 'vitest';
import { createInitialState } from '../src/services/depotStore';
import {
  allocateContainerToBooking,
  approveDamageQuotation,
  completeCleaningTask,
  completeRepairTask,
  confirmGateInPaymentAndComplete,
  createMasterPrepaidReceipt,
  executeGateOut,
  recordGateInFieldStep,
  releaseAllocatedContainer,
  toggleContainerHold,
  updateContainerLocation,
  verifyGateInOfficeAndCreatePayment,
} from '../src/services/depotOperations';

describe('MATRAN DEPOT ERP — Acceptance Tests (ACCEPTANCE_TESTS.md)', () => {
  it('GIN-001 -> GIN-005 & K80 QR: Luồng Giám định Hạ vỏ (WP/WW/CC/RM/ML + AGE) -> Văn phòng -> Phiếu K80 -> Báo giá -> Sửa chữa -> AV', () => {
    let state = createInitialState();

    // 1. Giám định Hạ vỏ chụp ảnh cửa cont & xác nhận tác nghiệp (DAMAGE + Remark + K + WP/WW/RM + AGE 2002)
    state = recordGateInFieldStep(state, {
      gateInType: 'CUSTOMER_RETURN',
      doorPhotoUrl: 'https://example.com/door-photo.jpg',
      initialContainerHint: 'MSKU1234567',
      conditionClass: 'DAMAGE',
      damageRemarks: ['Móp vách', 'Hư sàn/xước sàn'],
      stuffingClass: 'K',
      cleaningItems: ['WW - RỬA NƯỚC', 'RM - NHỔ ĐINH', 'ML - BÓC TEM'],
      manufactureYear: 2002,
    });
    const order = state.gateInOrders[0];
    expect(order.status).toBe('FIELD_RECORDED');
    expect(order.masterDossierCode).toMatch(/^HS-/);
    expect(order.manufactureYear).toBe(2002);
    expect(order.damageRemarks).toEqual(['Móp vách', 'Hư sàn/xước sàn']);
    expect(order.cleaningItems).toEqual([
      'WW - RỬA NƯỚC',
      'RM - NHỔ ĐINH',
      'ML - BÓC TEM',
    ]);

    // 2. Văn phòng bổ sung 5 trường bắt buộc & tạo thanh toán
    state = verifyGateInOfficeAndCreatePayment(state, {
      gateInId: order.id,
      containerNo: 'MSKU1234567',
      size: '40',
      type: 'HC',
      truckNo: '15C-123.45',
      customerRep: 'Công ty Tiếp Vận Việt (VietLog)',
      shippingLineCode: 'MAERSK',
      orderDocNo: 'EIR-001',
      feeAmount: 1000000,
    });

    // 3. Xác nhận thanh toán bằng TTT (quét QR Phiếu thu mẹ & trừ dần) -> Sinh phiếu K80
    state = confirmGateInPaymentAndComplete(state, {
      gateInId: order.id,
      paymentCategory: 'TTT',
      scannedQrCode: 'QR-TTT-VIETLOG-001',
    });

    const updatedOrder = state.gateInOrders.find((o) => o.id === order.id)!;
    expect(updatedOrder.status).toBe('GATE_IN_OK');
    expect(updatedOrder.k80QrCode).toBe('QR-K80-MSKU1234567');
    expect(state.k80Tickets[0].qrCode).toBe('QR-K80-MSKU1234567');
    expect(state.k80Tickets[0].masterDossierCode).toBe(order.masterDossierCode);

    // Kiểm tra container DAMAGE tự động vào hàng chờ BÁO GIÁ (needsQuotation = true) và CHỜ VỆ SINH (needsCleaning = true) và gắn MÃ HỒ SƠ CHÍNH
    const cont = state.containers.find((c) => c.containerNo === 'MSKU1234567')!;
    expect(cont.masterDossierCode).toBe(order.masterDossierCode);
    expect(cont.needsQuotation).toBe(true);
    expect(cont.needsCleaning).toBe(true);

    // 4. Bộ phận Vệ sinh quét mã QR phiếu K80 để xác nhận hoàn thành vệ sinh
    state = completeCleaningTask(state, {
      scannedQrCode: 'QR-K80-MSKU1234567',
    });
    expect(
      state.containers.find((c) => c.containerNo === 'MSKU1234567')!
        .needsCleaning
    ).toBe(false);

    // 5. Bộ phận Báo giá xác nhận báo giá -> Đẩy sang CHỜ SỬA CHỮA
    state = approveDamageQuotation(state, {
      containerNo: 'MSKU1234567',
      quotationAmount: 1950000,
      quotationItems: ['Móp vách', 'Hư sàn/xước sàn'],
    });
    expect(
      state.containers.find((c) => c.containerNo === 'MSKU1234567')!
        .needsQuotation
    ).toBe(false);
    expect(
      state.containers.find((c) => c.containerNo === 'MSKU1234567')!.needsRepair
    ).toBe(true);

    // 6. Bộ phận Sửa chữa quét mã QR K80 hoàn tất sửa chữa -> Chuyển sang AV sẵn sàng CẤP VỎ
    state = completeRepairTask(state, {
      scannedQrCode: 'QR-K80-MSKU1234567',
    });
    const repairedCont = state.containers.find(
      (c) => c.containerNo === 'MSKU1234567'
    )!;
    expect(repairedCont.needsRepair).toBe(false);
    expect(repairedCont.conditionClass).toBe('AV');
  });

  it('YARD-001 -> YARD-004 (DEC-005): Quét mã QR K80 hạ vỏ cấp Block không độc quyền, vị trí chi tiết Bay/Row/Tier chống trùng ô', () => {
    let state = createInitialState();

    // Xe nâng quét mã QR K80 của MSKU9102388 để hạ vào BLOCK-B ở cấp Block
    state = updateContainerLocation(state, {
      scannedQrCode: 'QR-K80-MSKU9102388',
      blockCode: 'BLOCK-B',
      reason: 'Quét QR K80 hạ bãi cấp Block',
    });

    const c1 = state.containers.find((c) => c.containerNo === 'MSKU9102388')!;
    expect(c1.currentBlock).toBe('BLOCK-B');
    expect(c1.currentBay).toBeNull();
    expect(c1.status).toBe('IN_YARD');

    // Cập nhật vị trí chi tiết Bay/Row/Tier
    state = updateContainerLocation(state, {
      containerNo: 'MSKU9102388',
      blockCode: 'BLOCK-B',
      bay: '06',
      row: '02',
      tier: '01',
      reason: 'Bổ sung vị trí chi tiết Bay/Row/Tier',
    });

    // Thử xếp trùng ô chi tiết -> Phải bị từ chối
    expect(() =>
      updateContainerLocation(state, {
        containerNo: 'ONEU2291045',
        blockCode: 'BLOCK-B',
        bay: '06',
        row: '02',
        tier: '01',
        reason: 'Thử xếp trùng ô chi tiết',
      })
    ).toThrow();
  });

  it('REL-001 -> REL-004 & GOUT-001 -> GOUT-003: Cấp vỏ cont AV, chặn Hold và chống xuất trùng', () => {
    let state = createInitialState();
    const bookingId = state.bookings[0].id;

    state = allocateContainerToBooking(state, {
      bookingId,
      containerNo: 'MSKU4089123',
      truckNo: '15H-999.99',
    });

    expect(() =>
      allocateContainerToBooking(state, {
        bookingId,
        containerNo: 'MSKU4089123',
      })
    ).toThrow();

    state = toggleContainerHold(state, {
      containerNo: 'MSKU4089123',
      hold: true,
      reason: 'Kiểm tra chặn xuất khi đang Hold',
    });

    expect(() =>
      executeGateOut(state, {
        gateOutType: 'EMPTY_RELEASE',
        bookingNo: 'BK-MSK-2026-109',
        containerNo: 'MSKU4089123',
        truckNo: '15H-999.99',
        receiverRep: 'VietLog',
        feeAmount: 500000,
        paymentCategory: 'TTS',
        ttsNote: 'Đã duyệt TTS',
        documentsVerified: true,
      })
    ).toThrow(/tạm giữ/);

    state = toggleContainerHold(state, {
      containerNo: 'MSKU4089123',
      hold: false,
      reason: 'Đủ điều kiện xuất',
    });

    state = executeGateOut(state, {
      gateOutType: 'EMPTY_RELEASE',
      bookingNo: 'BK-MSK-2026-109',
      containerNo: 'MSKU4089123',
      truckNo: '15H-999.99',
      receiverRep: 'VietLog',
      feeAmount: 500000,
      paymentCategory: 'TTS',
      ttsNote: 'Xác nhận công nợ hãng tàu MAERSK',
      documentsVerified: true,
    });

    const exited = state.containers.find(
      (c) => c.containerNo === 'MSKU4089123'
    )!;
    expect(exited.status).toBe('GATED_OUT');
  });

  it('PAY-001 -> PAY-006: Tạo Phiếu thu mẹ (TTT) và kiểm tra giải phóng khóa phân bổ', () => {
    let state = createInitialState();
    state = createMasterPrepaidReceipt(state, {
      customerName: 'Công ty Vận Tải Biển Đông',
      lotDescription: 'Đóng trước lô 15 cont',
      totalAmount: 10000000,
    });
    expect(state.masterReceipts[0].qrCode).toContain('QR-TTT-');

    const bookingId = state.bookings[0].id;
    state = allocateContainerToBooking(state, {
      bookingId,
      containerNo: 'MSKU4089123',
    });
    state = releaseAllocatedContainer(state, {
      bookingId,
      containerNo: 'MSKU4089123',
      reason: 'Khách đổi lịch lấy vỏ',
    });
    expect(
      state.containers.find((c) => c.containerNo === 'MSKU4089123')!.status
    ).toBe('IN_YARD');
  });
});
