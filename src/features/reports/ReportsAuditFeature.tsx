import React from 'react';
import { BarChart3, ShieldCheck, Users } from 'lucide-react';
import { ROLE_LABELS } from '../../types/depot';
import { DepotState, formatVnd } from '../../services/depotStore';

interface Props {
  state: DepotState;
  onUpdateState: (next: DepotState) => void;
}

export const ReportsAuditFeature: React.FC<Props> = ({ state, onUpdateState }) => {
  const inYardCount = state.containers.filter(
    (c) => c.status === 'IN_YARD' || c.status === 'ALLOCATED'
  ).length;
  const waitingPlacementCount = state.containers.filter(
    (c) => c.status === 'WAITING_PLACEMENT'
  ).length;
  const damageCount = state.containers.filter(
    (c) => c.status !== 'GATED_OUT' && c.conditionClass === 'DAMAGE'
  ).length;
  const holdCount = state.containers.filter(
    (c) => c.status !== 'GATED_OUT' && c.isOnHold
  ).length;
  const confirmedRevenue = state.vouchers
    .filter((v) => v.status === 'CONFIRMED')
    .reduce((acc, v) => acc + v.amount, 0);

  return (
    <div className="space-y-6">
      {/* CHỈ SỐ BÁO CÁO VẬN HÀNH */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-xs text-slate-500">Tồn bãi hiện tại</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{inYardCount} cont</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-xs text-slate-500">Chờ xe nâng xếp vị trí</p>
          <p className="mt-1 text-2xl font-bold text-blue-700">{waitingPlacementCount} cont</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-xs text-slate-500">Container phân loại DAMAGE</p>
          <p className="mt-1 text-2xl font-bold text-rose-600">{damageCount} cont</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-xs text-slate-500">Đang tạm giữ / Khóa xuất</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{holdCount} cont</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs col-span-2 lg:col-span-1">
          <p className="text-xs text-slate-500">Tổng chứng từ đã xác nhận</p>
          <p className="mt-1 text-lg font-bold text-emerald-700">{formatVnd(confirmedRevenue)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* DANH SÁCH NHÂN SỰ & KIỂM THỬ PHÂN QUYỀN */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <Users className="h-4 w-4 text-blue-600" />
            Nhân Sự & Chuyển Đổi Vai Trò Kiểm Thử (RBAC)
          </h3>
          <p className="text-xs text-slate-500">
            Mọi thao tác đều được kiểm tra quyền tại tầng dịch vụ/backend. Bạn có thể chọn tài khoản
            bất kỳ để kiểm thử quyền hạn tương ứng.
          </p>

          <div className="space-y-2">
            {state.staffUsers.map((u) => {
              const isCurrent = u.id === state.currentUser.id;
              return (
                <div
                  key={u.id}
                  onClick={() => onUpdateState({ ...state, currentUser: u })}
                  className={`cursor-pointer rounded-xl border p-3 text-xs transition ${
                    isCurrent
                      ? 'border-blue-600 bg-blue-50/70 ring-1 ring-blue-600'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      {u.fullName} ({u.staffCode})
                    </span>
                    {isCurrent && (
                      <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        Đang đăng nhập
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {u.roles.map((r) => (
                      <span
                        key={r}
                        className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700"
                      >
                        {r} — {ROLE_LABELS[r]}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* NHẬT KÝ KIỂM TOÁN BẤT BIẾN (AUDIT LOGS - AUD-001, AUD-002) */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Nhật Ký Kiểm Toán Hệ Thống (Audit Logs — AUD-001 / AUD-002)
            </h3>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
              Chỉ đọc (Chống xóa/sửa)
            </span>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {state.auditLogs.map((log) => (
              <div
                key={log.id}
                className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs space-y-1"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="rounded bg-blue-100 px-2 py-0.5 font-mono font-bold text-blue-800">
                      {log.actionCode}
                    </span>
                    <span className="font-mono font-semibold text-slate-700">
                      [{log.entityType}: {log.entityCode}]
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-400">
                    {new Date(log.createdAt).toLocaleString('vi-VN')}
                  </span>
                </div>
                <p className="text-slate-800">{log.summary}</p>
                <p className="text-[11px] text-slate-500">
                  Người thực hiện: <strong>{log.actorName}</strong> ({log.actorRole})
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* BẢNG TỔNG HỢP VÒNG ĐỜI CONTAINER */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-slate-900">
          <BarChart3 className="h-4 w-4 text-indigo-600" />
          Báo Cáo Vòng Đời Toàn Bộ Container Rỗng
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="px-3 py-2">Số Container</th>
                <th className="px-3 py-2">Size/Type</th>
                <th className="px-3 py-2">Hãng tàu</th>
                <th className="px-3 py-2">Phân loại / Đóng hàng / Vệ sinh</th>
                <th className="px-3 py-2">Vị trí hiện tại</th>
                <th className="px-3 py-2">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {state.containers.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2 font-mono font-bold text-slate-900">{c.containerNo}</td>
                  <td className="px-3 py-2">
                    {c.size}&apos;{c.type}
                  </td>
                  <td className="px-3 py-2 font-semibold">{c.shippingLineCode}</td>
                  <td className="px-3 py-2">
                    {c.conditionClass} / {c.stuffingClass} / {c.cleaningItems.join(', ')}
                  </td>
                  <td className="px-3 py-2 font-mono">
                    {c.currentBlock
                      ? c.currentBay
                        ? `${c.currentBlock}-${c.currentBay}-${c.currentRow}-${c.currentTier}`
                        : `${c.currentBlock} (Cấp Block)`
                      : '—'}
                  </td>
                  <td className="px-3 py-2 font-semibold">{c.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
