import React, { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  FileText,
  MapPin,
  Printer,
  QrCode,
  Receipt,
  Sparkles,
  Wrench,
  X,
} from 'lucide-react';
import { DepotState, formatVnd } from '../services/depotStore';
import { K80InternalTicket } from '../types/depot';

interface Props {
  masterDossierCode: string | null;
  state: DepotState;
  onClose: () => void;
  onOpenK80Ticket?: (ticket: K80InternalTicket) => void;
}

function formatViTime(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

export const MasterDossierModal: React.FC<Props> = ({
  masterDossierCode,
  state,
  onClose,
  onOpenK80Ticket,
}) => {
  const [showReceiptPrintView, setShowReceiptPrintView] =
    useState<boolean>(false);

  if (!masterDossierCode) return null;

  const gateIn = state.gateInOrders.find(
    (o) =>
      o.masterDossierCode === masterDossierCode ||
      o.orderCode === masterDossierCode
  );
  const container = state.containers.find(
    (c) => c.masterDossierCode === masterDossierCode
  );
  const vouchers = state.vouchers.filter(
    (v) => v.masterDossierCode === masterDossierCode
  );
  const workOrders = state.workOrders.filter(
    (w) => w.masterDossierCode === masterDossierCode
  );
  const locations = state.locationHistory.filter(
    (l) => l.masterDossierCode === masterDossierCode
  );
  const gateOut = state.gateOutOrders.find(
    (g) => g.masterDossierCode === masterDossierCode
  );

  // Dữ liệu tổng hợp của Container
  const contNo = container?.containerNo || gateIn?.containerNo || 'CHƯA CẬP NHẬT';
  const size = container?.size || gateIn?.size || '—';
  const type = container?.type || gateIn?.type || '—';
  const shippingLine =
    container?.shippingLineCode || gateIn?.shippingLineCode || '—';
  const customerRep = container?.customerRep || gateIn?.customerRep || '—';
  const truckNo = gateIn?.truckNo || container?.allocatedTruckNo || '—';
  const conditionClass =
    container?.conditionClass || gateIn?.conditionClass || 'AV';
  const stuffingClass =
    container?.stuffingClass || gateIn?.stuffingClass || 'E';
  const manufactureYear =
    container?.manufactureYear || gateIn?.manufactureYear || 2020;
  const cleaningItems =
    container?.cleaningItems || gateIn?.cleaningItems || ['KHÔNG VỆ SINH'];
  const damageRemarks =
    container?.damageRemarks || gateIn?.damageRemarks || [];

  // 1. Trạng thái hoàn thành Phần 1: GIÁM ĐỊNH + VĂN PHÒNG
  const inspectorConfirmed = Boolean(gateIn || container);
  const inspectorName =
    gateIn?.fieldStaffName || 'Lê Hoàng Giám Định (Hạ vỏ & Báo giá)';
  const inspectorTime = gateIn?.fieldRecordedAt || container?.gateInAt;

  const officeConfirmed = Boolean(
    gateIn?.status === 'GATE_IN_OK' || container
  );
  const officeName =
    gateIn?.gateInOkBy ||
    gateIn?.officeStaffName ||
    vouchers[0]?.confirmedBy ||
    'Trần Thị Minh (Văn Phòng)';
  const officeTime =
    gateIn?.gateInOkAt ||
    gateIn?.officeVerifiedAt ||
    vouchers[0]?.confirmedAt ||
    container?.gateInAt;

  // 2. Trạng thái hoàn thành Phần 2: VỆ SINH
  const requiresCleaning = cleaningItems.some((i) => i !== 'KHÔNG VỆ SINH');
  const cleaningWo = workOrders.find((w) => w.category === 'CLEANING');
  const cleaningDone = Boolean(
    !requiresCleaning ||
      (container && !container.needsCleaning) ||
      cleaningWo?.workStatus === 'COMPLETED'
  );
  const cleaningConfirmedBy =
    cleaningWo?.completedBy ||
    cleaningWo?.assignedTo ||
    (requiresCleaning ? 'Vũ Văn Vệ Sinh' : 'Không yêu cầu vệ sinh');
  const cleaningConfirmedAt =
    cleaningWo?.completedAt || (!requiresCleaning ? officeTime : container?.gateInAt);

  // 3. Trạng thái hoàn thành Phần 3: XE NÂNG
  const latestLocation = locations[0];
  const forkliftDone = Boolean(
    container?.currentBlock ||
      container?.status === 'GATED_OUT' ||
      latestLocation
  );
  const forkliftConfirmedBy =
    latestLocation?.performedBy ||
    gateOut?.confirmedBy ||
    'Phạm Hoàng Xe Nâng';
  const forkliftConfirmedAt =
    latestLocation?.performedAt ||
    gateOut?.confirmedAt ||
    (container?.currentBlock ? container.gateInAt : undefined);

  // 4. Trạng thái hoàn thành Phần 4: BÁO GIÁ - SỬA CHỮA
  const inspectionWo = workOrders.find((w) => w.category === 'INSPECTION');
  const repairWo = workOrders.find((w) => w.category === 'REPAIR');
  const hadDamage = Boolean(
    gateIn?.conditionClass === 'DAMAGE' ||
      container?.conditionClass === 'DAMAGE' ||
      inspectionWo ||
      repairWo
  );
  const quotationDone = Boolean(
    !hadDamage ||
      (container && !container.needsQuotation) ||
      repairWo?.approvalStatus === 'APPROVED'
  );
  const repairDone = Boolean(
    !hadDamage ||
      (container && !container.needsQuotation && !container.needsRepair) ||
      repairWo?.workStatus === 'COMPLETED'
  );
  const repairConfirmedBy =
    repairWo?.completedBy ||
    repairWo?.approvedBy ||
    repairWo?.assignedTo ||
    'Đặng Kỹ Thuật Sửa Chữa';
  const repairConfirmedAt =
    repairWo?.completedAt || repairWo?.createdAt || container?.gateInAt;

  // Hàm mở IN ĐIỀU ĐỘNG (Phiếu K80)
  const handlePrintDieuDongK80 = () => {
    if (!onOpenK80Ticket) {
      window.print();
      return;
    }
    const existingK80 = state.k80Tickets.find(
      (t) =>
        t.masterDossierCode === masterDossierCode ||
        t.containerNo === contNo
    );
    if (existingK80) {
      onOpenK80Ticket(existingK80);
      return;
    }

    const fallbackTicket: K80InternalTicket = {
      ticketCode: `K80-${masterDossierCode.slice(-6)}`,
      masterDossierCode,
      qrCode: container?.activeQrCode || gateIn?.k80QrCode || `QR-K80-${contNo}`,
      operationMode: container?.status === 'ALLOCATED' ? 'CAP_VO' : 'HA_VO',
      isPaid: true,
      paymentLabel: 'Đã xác nhận thanh toán tại Văn phòng',
      containerNo: contNo,
      size,
      type,
      conditionClass,
      damageRemarks,
      stuffingClass,
      cleaningItems,
      manufactureYear,
      truckNo,
      customerRep,
      issuedAt: officeTime || new Date().toISOString(),
      issuedBy: officeName,
    };
    onOpenK80Ticket(fallbackTicket);
  };

  // Tổng tiền phiếu thu
  const primaryVoucher = vouchers[0];
  const feeLines = gateIn?.feeLines || [];
  const totalAmountInclVat =
    primaryVoucher?.amount ||
    gateIn?.feeAmount ||
    (conditionClass === 'DAMAGE' ? 1150000 : 650000);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 overflow-y-auto">
      <div className="my-auto w-full max-w-4xl rounded-xl border border-slate-300 bg-white p-5 shadow-2xl max-h-[92vh] overflow-y-auto space-y-4 text-xs">
        {/* ================================================================ */}
        {/* HEADER: HỒ SƠ CỦA 1 CONTAINER TẠI BÃI LÀ PHIẾU EEIR CÓ TÊN LÀ MÃ HỒ SƠ */}
        {/* ================================================================ */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white font-black text-sm">
              EEIR
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-mono text-base font-black text-slate-900">
                  PHIẾU EEIR: <span className="text-blue-700">{masterDossierCode}</span>
                </h2>
                <span className="rounded bg-slate-900 px-2.5 py-0.5 font-mono text-xs font-bold text-white">
                  Cont: {contNo} ({size}&apos;{type})
                </span>
                <span
                  className={`rounded px-2 py-0.5 text-[11px] font-bold ${
                    conditionClass === 'DAMAGE'
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {conditionClass}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-500">
                Hồ sơ điện tử xuyên suốt vòng đời Container tại bãi MATRAN DEPOT • Hãng tàu: <strong>{shippingLine}</strong> • Khách hàng: <strong>{customerRep}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 font-bold text-slate-700 hover:bg-slate-50"
          >
            <X className="h-4 w-4" />
            Đóng hồ sơ
          </button>
        </div>

        {/* GHI CHÚ VĂN PHÒNG (NẾU CÓ TRONG TỒN VỎ) */}
        {container?.officeNote && (
          <div className="rounded-lg border-2 border-amber-400 bg-amber-50 px-3.5 py-2.5 text-amber-950">
            <span className="font-bold uppercase text-[11px] text-amber-800 block">
              📌 Ghi chú Văn phòng (Tồn vỏ):
            </span>
            <p className="font-bold text-xs mt-0.5">{container.officeNote}</p>
            {container.officeNoteUpdatedBy && (
              <span className="text-[10px] text-amber-700">
                Cập nhật bởi: {container.officeNoteUpdatedBy} ({formatViTime(container.officeNoteUpdatedAt)})
              </span>
            )}
          </div>
        )}

        {/* CHẾ ĐỘ XEM IN PHIẾU THU (KHI BẤM NÚT IN PHIẾU THU) */}
        {showReceiptPrintView ? (
          <div className="rounded-xl border-2 border-slate-800 bg-white p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-300 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">
                  PHIẾU THU DỊCH VỤ BÃI (ĐÃ BAO GỒM VAT)
                </h3>
                <p className="font-mono text-xs font-bold text-blue-700">
                  Kèm theo Phiếu EEIR: {masterDossierCode} • Số chứng từ:{' '}
                  {primaryVoucher?.voucherNo || `PT-${masterDossierCode}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowReceiptPrintView(false)}
                className="rounded border border-slate-300 px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50"
              >
                ← Quay lại Phiếu EEIR
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 rounded-lg bg-slate-50 p-3 border border-slate-200">
              <div>
                <p>
                  <strong>Khách hàng / Đơn vị nộp:</strong> {customerRep}
                </p>
                <p>
                  <strong>Số Container:</strong>{' '}
                  <span className="font-mono font-bold">{contNo}</span> ({size}
                  &apos;{type})
                </p>
                <p>
                  <strong>Hãng tàu:</strong> {shippingLine} •{' '}
                  <strong>Số xe:</strong> {truckNo}
                </p>
              </div>
              <div>
                <p>
                  <strong>Hình thức thanh toán:</strong>{' '}
                  <span className="font-bold text-emerald-700">
                    {primaryVoucher?.paymentCategory || 'TTT / Đã thu'}
                  </span>
                </p>
                <p>
                  <strong>Người lập / xác nhận thu:</strong> {officeName}
                </p>
                <p>
                  <strong>Thời gian xác nhận:</strong>{' '}
                  {formatViTime(officeTime)}
                </p>
              </div>
            </div>

            <table className="w-full border-collapse border border-slate-300 text-xs">
              <thead>
                <tr className="bg-slate-100 font-bold text-slate-800">
                  <th className="border border-slate-300 px-3 py-2 text-left">
                    STT
                  </th>
                  <th className="border border-slate-300 px-3 py-2 text-left">
                    Hạng mục biểu giá (Đã bao gồm VAT)
                  </th>
                  <th className="border border-slate-300 px-3 py-2 text-right">
                    Thành tiền (VNĐ)
                  </th>
                </tr>
              </thead>
              <tbody>
                {feeLines.length > 0 ? (
                  feeLines.map((line, i) => (
                    <tr key={line.id}>
                      <td className="border border-slate-300 px-3 py-2">
                        {i + 1}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 font-semibold">
                        [{line.catalogCode}] {line.name}
                      </td>
                      <td className="border border-slate-300 px-3 py-2 text-right font-mono font-bold">
                        {formatVnd(line.amountInclVat)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td className="border border-slate-300 px-3 py-2">1</td>
                    <td className="border border-slate-300 px-3 py-2 font-semibold">
                      Phí dịch vụ nâng hạ &amp; tác nghiệp container {contNo} (
                      {size}&apos;{type} — Đã bao gồm VAT)
                    </td>
                    <td className="border border-slate-300 px-3 py-2 text-right font-mono font-bold">
                      {formatVnd(totalAmountInclVat)}
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-emerald-50 font-black text-slate-900">
                  <td
                    colSpan={2}
                    className="border border-slate-300 px-3 py-2.5 text-right uppercase"
                  >
                    TỔNG CỘNG ĐÃ THU (ĐÃ BAO GỒM VAT):
                  </td>
                  <td className="border border-slate-300 px-3 py-2.5 text-right font-mono text-sm text-emerald-700">
                    {formatVnd(totalAmountInclVat)}
                  </td>
                </tr>
              </tfoot>
            </table>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 font-black text-white hover:bg-emerald-700"
              >
                <Printer className="h-4 w-4" />
                Xác Nhận In Phiếu Thu Ngay
              </button>
            </div>
          </div>
        ) : (
          /* ================================================================ */
          /* NỘI DUNG PHIẾU EEIR SẮP XẾP THEO TỪNG TÁC NGHIỆP BỘ PHẬN */
          /* ================================================================ */
          <div className="space-y-3.5">
            {/* PHẦN 1: BỘ PHẬN GIÁM ĐỊNH + VĂN PHÒNG (LÀ CÙNG 1 PHẦN) */}
            <div className="rounded-xl border border-slate-300 bg-white overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-100 px-4 py-2.5">
                <div className="flex items-center gap-2 font-black text-slate-900 text-xs uppercase">
                  <FileText className="h-4 w-4 text-blue-600" />
                  <span>PHẦN 1: TÁC NGHIỆP GIÁM ĐỊNH + VĂN PHÒNG</span>
                </div>
                {inspectorConfirmed && officeConfirmed ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    ✓ ĐÃ XÁC NHẬN HOÀN THÀNH
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                    <Clock className="h-3.5 w-3.5" />
                    Đang chờ Văn phòng hoàn tất
                  </span>
                )}
              </div>

              <div className="p-4 space-y-3">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
                  {/* Ảnh cửa cont do Giám định chụp */}
                  <div className="md:col-span-4">
                    <img
                      src={
                        gateIn?.doorPhotoUrl ||
                        'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80'
                      }
                      alt="Ảnh cửa container"
                      className="h-36 w-full rounded-lg border border-slate-300 object-cover"
                    />
                  </div>

                  {/* Thông tin Giám định + Văn phòng gộp chung */}
                  <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                      <span className="text-[10px] text-slate-500 block">
                        SỐ CONTAINER / SIZE - TYPE
                      </span>
                      <span className="font-mono text-sm font-black text-slate-900">
                        {contNo} ({size}&apos;{type})
                      </span>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                      <span className="text-[10px] text-slate-500 block">
                        TRẠNG THÁI / ĐÓNG HÀNG / AGE
                      </span>
                      <span className="font-bold text-slate-900">
                        {conditionClass} • Loại {stuffingClass} • Năm{' '}
                        {manufactureYear}
                      </span>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                      <span className="text-[10px] text-slate-500 block">
                        HÃNG TÀU &amp; SỐ XE
                      </span>
                      <span className="font-bold text-slate-900">
                        {shippingLine} • Xe: {truckNo}
                      </span>
                    </div>
                    <div className="col-span-2 rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                      <span className="text-[10px] text-slate-500 block">
                        ĐẠI DIỆN KHÁCH HÀNG &amp; PHƯƠNG ÁN VỆ SINH
                      </span>
                      <span className="font-bold text-slate-900">
                        {customerRep} • VS: {cleaningItems.join(' + ')}
                      </span>
                    </div>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2.5">
                      <span className="text-[10px] text-slate-500 block">
                        TỔNG THU (ĐÃ GỒM VAT)
                      </span>
                      <span className="font-mono font-black text-emerald-700">
                        {formatVnd(totalAmountInclVat)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* DÒNG XÁC NHẬN HOÀN THÀNH CỦA GIÁM ĐỊNH & VĂN PHÒNG */}
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-emerald-800 block">
                        Xác nhận Giám định hiện trường:
                      </span>
                      <span className="font-bold text-slate-900">
                        {inspectorName}
                      </span>
                      <span className="block font-mono text-[11px] text-slate-600">
                        Thời gian: {formatViTime(inspectorTime)}
                      </span>
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  </div>

                  <div
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                      officeConfirmed
                        ? 'border-emerald-200 bg-emerald-50/70'
                        : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <div>
                      <span className="text-[10px] font-bold uppercase text-emerald-800 block">
                        Xác nhận Văn phòng (Chứng từ &amp; Thu phí):
                      </span>
                      <span className="font-bold text-slate-900">
                        {officeConfirmed ? officeName : 'Đang chờ xác nhận'}
                      </span>
                      <span className="block font-mono text-[11px] text-slate-600">
                        Thời gian:{' '}
                        {officeConfirmed ? formatViTime(officeTime) : '—'}
                      </span>
                    </div>
                    {officeConfirmed ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                    ) : (
                      <Clock className="h-5 w-5 text-amber-500 shrink-0" />
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* PHẦN 2: BỘ PHẬN VỆ SINH */}
            <div className="rounded-xl border border-slate-300 bg-white overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-100 px-4 py-2.5">
                <div className="flex items-center gap-2 font-black text-slate-900 text-xs uppercase">
                  <Sparkles className="h-4 w-4 text-blue-600" />
                  <span>PHẦN 2: BỘ PHẬN VỆ SINH</span>
                </div>
                {cleaningDone ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    ✓ ĐÃ XÁC NHẬN HOÀN THÀNH
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                    <Clock className="h-3.5 w-3.5" />
                    Đang chờ Bộ phận Vệ sinh thực hiện
                  </span>
                )}
              </div>

              <div className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-slate-600">
                    Hạng mục vệ sinh chỉ định:{' '}
                    <strong className="text-slate-900">
                      {cleaningItems.join(' + ')}
                    </strong>
                  </p>
                  {cleaningWo?.resultNotes && (
                    <p className="mt-0.5 text-[11px] text-emerald-700 font-semibold">
                      Kết quả: {cleaningWo.resultNotes}
                    </p>
                  )}
                </div>

                {cleaningDone && (
                  <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-emerald-800 block">
                        Người xác nhận hoàn thành: {cleaningConfirmedBy}
                      </span>
                      <span className="font-mono text-[11px] text-slate-600">
                        Thời gian: {formatViTime(cleaningConfirmedAt)}
                      </span>
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  </div>
                )}
              </div>
            </div>

            {/* PHẦN 3: BỘ PHẬN XE NÂNG */}
            <div className="rounded-xl border border-slate-300 bg-white overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-100 px-4 py-2.5">
                <div className="flex items-center gap-2 font-black text-slate-900 text-xs uppercase">
                  <MapPin className="h-4 w-4 text-emerald-600" />
                  <span>PHẦN 3: BỘ PHẬN XE NÂNG (VỊ TRÍ BÃI)</span>
                </div>
                {forkliftDone ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    ✓ ĐÃ XÁC NHẬN HOÀN THÀNH
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                    <Clock className="h-3.5 w-3.5" />
                    Đang chờ Xe nâng cập nhật vị trí
                  </span>
                )}
              </div>

              <div className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-slate-600">
                    Vị trí lưu bãi hiện tại:{' '}
                    <strong className="font-mono text-sm text-blue-700">
                      {container?.currentBlock
                        ? container.currentBay
                          ? `${container.currentBlock} / Bay ${container.currentBay} - Row ${container.currentRow} - Tier ${container.currentTier}`
                          : `${container.currentBlock} (Cấp Block)`
                        : container?.status === 'GATED_OUT'
                        ? 'Đã cấp vỏ / Xuất khỏi bãi'
                        : 'Chờ Xe nâng hạ vỏ'}
                    </strong>
                  </p>
                  {latestLocation && (
                    <p className="mt-0.5 text-[11px] text-slate-500">
                      Tác nghiệp gần nhất: {latestLocation.fromLocation} →{' '}
                      {latestLocation.toLocation} ({latestLocation.reason})
                    </p>
                  )}
                </div>

                {forkliftDone && (
                  <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-emerald-800 block">
                        Người xác nhận hoàn thành: {forkliftConfirmedBy}
                      </span>
                      <span className="font-mono text-[11px] text-slate-600">
                        Thời gian: {formatViTime(forkliftConfirmedAt)}
                      </span>
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  </div>
                )}
              </div>
            </div>

            {/* PHẦN 4: BỘ PHẬN BÁO GIÁ - SỬA CHỮA */}
            <div className="rounded-xl border border-slate-300 bg-white overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-100 px-4 py-2.5">
                <div className="flex items-center gap-2 font-black text-slate-900 text-xs uppercase">
                  <Wrench className="h-4 w-4 text-indigo-600" />
                  <span>PHẦN 4: BỘ PHẬN BÁO GIÁ - SỬA CHỮA</span>
                </div>
                {repairDone && quotationDone ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 border border-emerald-300">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    ✓ ĐÃ XÁC NHẬN HOÀN THÀNH
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-800">
                    <Clock className="h-3.5 w-3.5" />
                    {container?.needsQuotation
                      ? 'Đang chờ Báo giá'
                      : 'Đang chờ Sửa chữa'}
                  </span>
                )}
              </div>

              <div className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  {!hadDamage ? (
                    <p className="text-emerald-700 font-semibold">
                      Container đạt chuẩn AV ngay từ đầu vào — Không phát sinh Báo giá / Sửa chữa.
                    </p>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-slate-700">
                        Hạng mục hư hỏng / sửa chữa:{' '}
                        <strong>
                          {(
                            repairWo?.items ||
                            inspectionWo?.items ||
                            damageRemarks
                          ).join(', ') || 'Đã nghiệm thu sửa chữa đạt AV'}
                        </strong>
                      </p>
                      {(repairWo?.estimateCost || container?.quotationAmount) && (
                        <p className="text-slate-700">
                          Chi phí báo giá M&amp;R:{' '}
                          <strong className="font-mono text-emerald-700">
                            {formatVnd(
                              repairWo?.estimateCost ||
                                container?.quotationAmount ||
                                0
                            )}
                          </strong>
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {repairDone && quotationDone && (
                  <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/70 px-3 py-2">
                    <div>
                      <span className="text-[10px] font-bold uppercase text-emerald-800 block">
                        Người xác nhận hoàn thành:{' '}
                        {hadDamage ? repairConfirmedBy : inspectorName}
                      </span>
                      <span className="font-mono text-[11px] text-slate-600">
                        Thời gian:{' '}
                        {formatViTime(
                          hadDamage ? repairConfirmedAt : inspectorTime
                        )}
                      </span>
                    </div>
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================================================================ */}
        {/* DÒNG CUỐI CÙNG: 3 NÚT TÁC NGHIỆP ĐỐI VỚI HỒ SƠ ĐÓ */}
        {/* IN ĐIỀU ĐỘNG (PHIẾU K80) • IN EEIR • IN PHIẾU THU */}
        {/* ================================================================ */}
        <div className="border-t-2 border-slate-800 pt-3.5">
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
            <button
              type="button"
              onClick={handlePrintDieuDongK80}
              className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-xs font-black text-white shadow-xs hover:bg-blue-700"
            >
              <QrCode className="h-4 w-4" />
              IN ĐIỀU ĐỘNG (PHIẾU K80)
            </button>

            <button
              type="button"
              onClick={() => {
                setShowReceiptPrintView(false);
                setTimeout(() => window.print(), 100);
              }}
              className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-xs font-black text-white shadow-xs hover:bg-slate-800"
            >
              <FileSpreadsheet className="h-4 w-4" />
              IN EEIR ({masterDossierCode})
            </button>

            <button
              type="button"
              onClick={() => setShowReceiptPrintView(true)}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-xs font-black text-white shadow-xs hover:bg-emerald-700"
            >
              <Receipt className="h-4 w-4" />
              IN PHIẾU THU
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
