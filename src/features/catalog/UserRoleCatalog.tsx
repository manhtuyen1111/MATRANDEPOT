import React, { useState } from 'react';
import { ShieldCheck, UserPlus } from 'lucide-react';
import { AppRole, ROLE_LABELS, StaffUser, WorkspaceMenuId } from '../../types/depot';
import { DepotState } from '../../services/depotStore';
import { addStaffUser, updateStaffUser } from '../../services/depotOperations';
import { ASSIGNABLE_ROLES, MENU_ACCESS } from '../../services/permissions';
import { Feedback, inputCls, labelCls, primaryBtn, secondaryBtn, SectionCard } from '../../components/shared';

const MENU_LABELS: Partial<Record<WorkspaceMenuId, string>> = {
  TON_VO: 'Tồn vỏ',
  GD_HA_VO: 'Giám định – Hạ vỏ',
  VP_HA_VO: 'VP – Hạ vỏ',
  VP_CAP_VO: 'VP – Cấp vỏ',
  VP_PHIEU_THU: 'VP – Phiếu thu',
  VP_TRA_CHUNG_TU: 'VP – Trả chứng từ',
  VS_CHO_VE_SINH: 'Vệ sinh',
  XN_CHO_HA_VO: 'XN – Chờ hạ vỏ',
  XN_CHO_CAP_VO: 'XN – Chờ cấp vỏ',
  XN_DAO_CHUYEN: 'XN – Đảo chuyển',
  BG_CHO_BAO_GIA: 'Báo giá',
  SC_CHO_SUA_CHUA: 'Sửa chữa',
  BC_HA_VO: 'Báo cáo',
  BC_TONG_HOP: 'BC Tổng hợp',
  BC_SUA_CHUA: 'BC Sửa chữa',
  DM_KHACH_HANG: 'Danh mục (xem)',
};

// Màn hình mỗi vai trò được vào — lấy từ MENU_ACCESS để luôn khớp thực tế
function screensOf(role: AppRole): string {
  if (role === 'ADMIN') return 'Toàn bộ + cấu hình Danh mục, User';
  return (Object.keys(MENU_LABELS) as WorkspaceMenuId[])
    .filter((m) => MENU_ACCESS[m].includes(role))
    .map((m) => MENU_LABELS[m])
    .join(', ') || 'Chưa có màn hình';
}

const RoleChecks: React.FC<{ value: AppRole[]; onChange: (r: AppRole[]) => void }> = ({ value, onChange }) => (
  <div className="flex flex-wrap gap-1.5">
    {ASSIGNABLE_ROLES.map((r) => (
      <label key={r} className={`flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-[11px] ${value.includes(r) ? 'border-blue-600 bg-blue-50 text-blue-800' : 'border-slate-200'}`}>
        <input type="checkbox" className="h-3 w-3" checked={value.includes(r)} onChange={(e) => onChange(e.target.checked ? [...value, r] : value.filter((x) => x !== r))} />
        {ROLE_LABELS[r]}
      </label>
    ))}
  </div>
);

// DANH MỤC CHUNG — USER & PHÂN QUYỀN (DEC-045). Chỉ ADMIN mở được màn này.
export const UserRoleCatalog: React.FC<{ state: DepotState; onUpdateState: (next: DepotState) => void }> = ({ state, onUpdateState }) => {
  const [form, setForm] = useState<{ fullName: string; email: string; roles: AppRole[] }>({ fullName: '', email: '', roles: [] });
  const [editing, setEditing] = useState<{ id: string; roles: AppRole[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const run = (fn: () => DepotState, msg: string) => {
    setError(null);
    setSuccess(null);
    try {
      onUpdateState(fn());
      setSuccess(msg);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thao tác thất bại');
      return false;
    }
  };

  return (
    <div className="space-y-4">
      <Feedback error={error} success={success} onClose={() => (setError(null), setSuccess(null))} />

      <SectionCard title="Thêm user" icon={<UserPlus className="h-4 w-4 text-slate-500" />}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (run(() => addStaffUser(state, form), `Đã thêm user ${form.fullName}.`)) setForm({ fullName: '', email: '', roles: [] });
          }}
          className="space-y-3"
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <label>
              <span className={labelCls}>Họ tên *</span>
              <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} className={inputCls} />
            </label>
            <label>
              <span className={labelCls}>Email đăng nhập *</span>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
            </label>
          </div>
          <div>
            <span className={labelCls}>Vai trò * (được chọn nhiều)</span>
            <RoleChecks value={form.roles} onChange={(roles) => setForm({ ...form, roles })} />
          </div>
          <button type="submit" disabled={!form.fullName.trim() || !form.email.trim() || form.roles.length === 0} className={primaryBtn}>
            Thêm user
          </button>
        </form>
      </SectionCard>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full min-w-[720px] text-left text-xs">
          <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase text-slate-600">
            <tr>
              <th className="px-3 py-2">Mã</th>
              <th className="px-3 py-2">Họ tên</th>
              <th className="px-3 py-2">Email</th>
              <th className="px-3 py-2">Vai trò</th>
              <th className="px-3 py-2">Trạng thái</th>
              <th className="px-3 py-2 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {state.staffUsers.map((u: StaffUser) => (
              <tr key={u.id} className={u.isActive ? '' : 'text-slate-400'}>
                <td className="px-3 py-2 font-mono">{u.staffCode}</td>
                <td className="px-3 py-2 font-semibold">{u.fullName}</td>
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2">
                  {editing?.id === u.id ? (
                    <div className="space-y-2">
                      <RoleChecks value={editing.roles} onChange={(roles) => setEditing({ id: u.id, roles })} />
                      <div className="flex gap-1">
                        <button type="button" className={primaryBtn} onClick={() => run(() => updateStaffUser(state, { userId: u.id, roles: editing.roles }), 'Đã cập nhật vai trò.') && setEditing(null)}>
                          Lưu
                        </button>
                        <button type="button" className={secondaryBtn} onClick={() => setEditing(null)}>Hủy</button>
                      </div>
                    </div>
                  ) : (
                    u.roles.map((r) => ROLE_LABELS[r]).join(', ')
                  )}
                </td>
                <td className="px-3 py-2">{u.isActive ? 'Hoạt động' : 'Đã khóa'}</td>
                <td className="px-3 py-2 text-right">
                  <div className="inline-flex gap-1">
                    <button type="button" className={secondaryBtn} onClick={() => setEditing({ id: u.id, roles: u.roles })}>Sửa vai trò</button>
                    <button type="button" className={secondaryBtn} onClick={() => run(() => updateStaffUser(state, { userId: u.id, isActive: !u.isActive }), u.isActive ? 'Đã khóa user.' : 'Đã mở khóa user.')}>
                      {u.isActive ? 'Khóa' : 'Mở khóa'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SectionCard title="Vai trò & màn hình được truy cập" icon={<ShieldCheck className="h-4 w-4 text-slate-500" />}>
        <table className="w-full text-left text-xs">
          <tbody className="divide-y divide-slate-100">
            {ASSIGNABLE_ROLES.map((r) => (
              <tr key={r}>
                <td className="w-32 py-1.5 pr-2 font-semibold">{ROLE_LABELS[r]}</td>
                <td className="py-1.5 text-slate-700">{screensOf(r)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] text-slate-500">
          Chế độ Demo: user là hồ sơ nhân viên, đổi người dùng ở góc phải để thử. Khi nối Supabase, tài khoản đăng nhập được tạo qua Supabase Auth và quyền được kiểm tra ở database.
        </p>
      </SectionCard>
    </div>
  );
};
