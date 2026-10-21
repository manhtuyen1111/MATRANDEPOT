import React, { useState } from 'react';
import {
  CheckCircle2,
  CreditCard,
  History,
  PlusCircle,
  QrCode,
  Receipt,
  ShieldAlert,
} from 'lucide-react';
import { DepotState, formatVnd } from '../../services/depotStore';
import { createMasterPrepaidReceipt } from '../../services/depotOperations';

interface Props {
  state: DepotState;
  onUpdateState: (next: DepotState) => void;
}

export const PaymentsFeature: React.FC<Props> = ({ state, onUpdateState }) => {
  const [customerName, setCustomerName] = useState('Công ty Tiếp Vận Việt (VietLog)');
  const [lotDescription, setLotDescription] = useState('Đóng trước lô 30 container rỗng');
  const [totalAmount, setTotalAmount] = useState<number>(20000000);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleCreateMasterReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const next = createMasterPrepaidReceipt(state, {
        customerName,
        lotDescription,
        totalAmount: Number(totalAmount),
      });
      onUpdateState(next);
      const created = next.masterReceipts[0];
      setSuccessMsg(
        `Đã tạo Phiếu thu mẹ ${created.receiptCode} và cấp Mã QR thanh toán: ${created.qrCode} (Số dư: ${formatVnd(created.totalAmount)}).`
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi tạo Phiếu thu mẹ');
    }
  };

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <p className="font-semibold">Từ chối thao tác tài chính</p>
            <p>{errorMsg}</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-semibold">Thành công</p>
            <p>{successMsg}</p>
          </div>
        </div>
      )}

      {/* TÓM TẮT 3 HÌNH THỨC THANH TOÁN ĐÃ XÁC NHẬN */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
          <div className="flex items-center gap-2 font-bold text-blue-950 text-sm">
            <QrCode className="h-5 w-5 text-blue-600" />
            1. THANH TOÁN TRƯỚC (TTT)
          </div>
          <p className="mt-1.5 text-xs text-blue-800">
            Khách đóng trước 1 lô → Tạo <strong>Phiếu thu mẹ</strong> và cấp{' '}
            <strong>Mã QR thanh toán</strong> (thay phiếu thu). Khi văn phòng yêu cầu thanh toán,
            quét mã QR vào chứng từ để thông báo và trừ dần trong Phiếu thu mẹ.
          </p>
        </div>

        <div className="rounded-2xl border border-purple-200 bg-purple-50/60 p-4">
          <div className="flex items-center gap-2 font-bold text-purple-950 text-sm">
            <Receipt className="h-5 w-5 text-purple-600" />
            2. THANH TOÁN SAU (TTS)
          </div>
          <p className="mt-1.5 text-xs text-purple-800">
            Nhân viên văn phòng kiểm tra thông tin TTS ở các nguồn. Nếu xác nhận đủ điều kiện TTS
            thì <strong>ghi chú (Note) ở CHỨNG TỪ là TTS</strong> để đối soát công nợ.
          </p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
          <div className="flex items-center gap-2 font-bold text-amber-950 text-sm">
            <CreditCard className="h-5 w-5 text-amber-600" />
            3. THANH TOÁN TRỰC TIẾP (TTTT)
          </div>
          <p className="mt-1.5 text-xs text-amber-800">
            Nhân viên tác nghiệp văn phòng xác nhận khoản thu trực tiếp qua{' '}
            <strong>Thanh toán chuyển khoản (API)</strong> hoặc{' '}
            <strong>Thanh toán tiền mặt</strong>.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* TẠO PHIẾU THU MẸ & MÃ QR (TTT) */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="mb-4 flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <PlusCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Tạo Phiếu Thu Mẹ & Cấp Mã QR (TTT)
              </h2>
              <p className="text-xs text-slate-500">
                Dành cho khách hàng đóng trước 1 lô để quét trừ dần vào chứng từ
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateMasterReceipt} className="space-y-4 text-sm">
            <div>
              <label className="mb-1 block font-medium text-slate-700">Khách hàng đóng lô *</label>
              <input
                type="text"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="mb-1 block font-medium text-slate-700">Nội dung lô đóng trước</label>
              <input
                type="text"
                value={lotDescription}
                onChange={(e) => setLotDescription(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </div>

            <div>
              <label className="mb-1 block font-medium text-slate-700">
                Tổng tiền Phiếu thu mẹ (VNĐ) *
              </label>
              <input
                type="number"
                min={100000}
                step={50000}
                value={totalAmount}
                onChange={(e) => setTotalAmount(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-bold text-blue-700"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-xl bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 transition"
            >
              Phát Hành Phiếu Thu Mẹ & Sinh Mã QR Thanh Toán
            </button>
          </form>
        </div>

        {/* DANH SÁCH PHIẾU THU MẸ & MÃ QR ĐANG HOẠT ĐỘNG */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <QrCode className="h-4 w-4 text-blue-600" />
            Danh Sách Phiếu Thu Mẹ (TTT) & Số Dư Trừ Dần
          </h3>

          <div className="space-y-3">
            {state.masterReceipts.map((r) => {
              const pct = Math.round((r.remainingAmount / r.totalAmount) * 100);
              return (
                <div
                  key={r.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs space-y-2"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-mono font-bold text-slate-900 text-sm">
                        {r.receiptCode}
                      </span>{' '}
                      — <span className="font-semibold text-slate-700">{r.customerName}</span>
                      <p className="text-[11px] text-slate-500">{r.lotDescription}</p>
                    </div>
                    <div className="flex items-center gap-2 rounded-lg border border-blue-300 bg-blue-50 px-3 py-1.5 font-mono font-bold text-blue-800">
                      <QrCode className="h-4 w-4 text-blue-600" />
                      {r.qrCode}
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-1">
                    <span>
                      Tổng đóng lô: <strong>{formatVnd(r.totalAmount)}</strong>
                    </span>
                    <span className="text-emerald-700 font-bold">
                      Số dư còn lại: {formatVnd(r.remainingAmount)} ({pct}%)
                    </span>
                  </div>

                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full bg-emerald-600 transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* LỊCH SỬ QUÉT QR TRỪ DẦN TRONG PHIẾU THU MẸ */}
          <div className="border-t border-slate-200 pt-3">
            <h4 className="mb-2 flex items-center gap-1.5 text-xs font-bold text-slate-700">
              <History className="h-3.5 w-3.5 text-blue-600" />
              Lịch sử quét mã QR trừ dần trong Phiếu thu mẹ:
            </h4>
            <div className="space-y-1.5 max-h-40 overflow-y-auto">
              {state.receiptDeductions.map((d) => (
                <div
                  key={d.id}
                  className="flex flex-wrap items-center justify-between rounded-lg bg-slate-100 px-3 py-1.5 text-[11px]"
                >
                  <span>
                    <strong>{d.receiptCode}</strong> ({d.qrCode}) → Chứng từ{' '}
                    <strong>{d.voucherNo}</strong> (Cont {d.containerNo})
                  </span>
                  <span className="font-bold text-rose-700">
                    -{formatVnd(d.deductedAmount)} (Còn: {formatVnd(d.balanceAfter)})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* DANH SÁCH CHỨNG TỪ & ĐỐI SOÁT */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
          <Receipt className="h-4 w-4 text-emerald-600" />
          Danh Sách Chứng Từ Thanh Toán & Đối Soát (TTT / TTS / TTTT)
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="px-3 py-2">Số Chứng Từ</th>
                <th className="px-3 py-2">Nghiệp Vụ</th>
                <th className="px-3 py-2">Container</th>
                <th className="px-3 py-2">Số Tiền</th>
                <th className="px-3 py-2">Loại Hình (Văn phòng xác nhận)</th>
                <th className="px-3 py-2">Chi Tiết QR / Note TTS / Mã GD API</th>
                <th className="px-3 py-2">Trạng Thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.vouchers.map((v) => (
                <tr key={v.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 font-mono font-bold text-slate-900">{v.voucherNo}</td>
                  <td className="px-3 py-2.5">
                    {v.serviceType} ({v.referenceCode})
                  </td>
                  <td className="px-3 py-2.5 font-mono font-semibold text-blue-700">
                    {v.containerNo}
                  </td>
                  <td className="px-3 py-2.5 font-bold text-slate-900">{formatVnd(v.amount)}</td>
                  <td className="px-3 py-2.5">
                    {v.paymentCategory ? (
                      <span
                        className={`rounded-md px-2 py-0.5 font-bold ${
                          v.paymentCategory === 'TTT'
                            ? 'bg-blue-100 text-blue-800'
                            : v.paymentCategory === 'TTS'
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {v.paymentCategory}
                      </span>
                    ) : (
                      <span className="text-slate-400">Chờ văn phòng xác nhận</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">
                    {v.paymentCategory === 'TTT' && `Mã QR: ${v.scannedQrCode} (${v.masterReceiptCode})`}
                    {v.paymentCategory === 'TTS' && `Note: ${v.ttsNote}`}
                    {v.paymentCategory === 'TTTT' &&
                      `${v.directMethod === 'BANK_TRANSFER_API' ? 'Chuyển khoản API' : 'Tiền mặt'} ${
                        v.providerTxRef ? `(${v.providerTxRef})` : ''
                      }`}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-bold ${
                        v.status === 'CONFIRMED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {v.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
