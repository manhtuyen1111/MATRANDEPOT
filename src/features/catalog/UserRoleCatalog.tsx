import React, { useState } from 'react';
import { addStaffUser, resetStaffPassword, updateStaffProfile, updateStaffUser } from '../../services/api';
import { isSupabaseConfigured } from '../../lib/env';
import { DEFAULT_PASSWORD, LOGIN_EMAIL_DOMAIN, normalizeUsername, suggestUsername, usernameToEmail, USERNAME_PATTERN } from '../../services/authPassword';
import { CheckCircle2, Search, ShieldCheck, UserPlus, X } from 'lucide-react';
import { AppRole, ROLE_LABELS, STAFF_GENDER_LABELS, StaffGender, StaffUser, WorkspaceMenuId } from '../../types/depot';
import { DepotState } from '../../services/depotStore';
import { staffProfileMissing } from '../../services/depotOperations';
import { ASSIGNABLE_ROLES, MENU_ACCESS } from '../../services/permissions';
import { CELL_MAX, CellText, DetailDrawer, Feedback, inputCls, labelCls, Pager, primaryBtn, secondaryBtn, SectionCard, usePageSize } from '../../components/shared';

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
  if (role === 'ADMIN') return 'Toàn bộ + cấu hình Danh mục, User, Database';
  return (Object.keys(MENU_LABELS) as WorkspaceMenuId[])
    .filter((m) => MENU_ACCESS[m].includes(role))
    .map((m) => MENU_LABELS[m])
    .join(', ') || 'Chưa có màn hình';
}

const RoleChecks: React.FC<{ value: AppRole[]; onChange: (r: AppRole[]) => void }> = ({ value, onChange }) => (
  <div className="flex flex-wrap gap-1.5">
    {ASSIGNABLE_ROLES.map((r) => (
      <label key={r} className={`flex cursor-pointer items-center gap-1 rounded border px-2 py-1 text-[11px] ${value.includes(r) ? 'border-navy-900 bg-navy-50 text-navy-900' : 'border-line'}`}>
        <input type="checkbox" className="h-3 w-3" checked={value.includes(r)} onChange={(e) => onChange(e.target.checked ? [...value, r] : value.filter((x) => x !== r))} />
        {ROLE_LABELS[r]}
      </label>
    ))}
  </div>
);

const DepartmentSelect: React.FC<{ value: AppRole | ''; onChange: (r: AppRole | '') => void; id?: string }> = ({ value, onChange, id }) => (
  <select id={id} value={value} onChange={(e) => onChange(e.target.value as AppRole | '')} className={inputCls}>
    <option value="">— Chưa gán —</option>
    {ASSIGNABLE_ROLES.map((r) => (
      <option key={r} value={r}>{ROLE_LABELS[r]}</option>
    ))}
  </select>
);

const usernameOf = (u: StaffUser) => (u.email.endsWith(`@${LOGIN_EMAIL_DOMAIN}`) ? u.email.split('@')[0] : u.email);

type Tab = 'NHAN_VIEN' | 'VAI_TRO';
const TABS: { key: Tab; label: string }[] = [
  { key: 'NHAN_VIEN', label: 'DANH SÁCH NHÂN VIÊN' },
  { key: 'VAI_TRO', label: 'VAI TRÒ & QUYỀN' },
];

// DANH MỤC CHUNG — USER - ROLE (DEC-045, DEC-191): tab giống trang Báo cáo bộ phận. Chỉ ADMIN mở được màn này.
export const UserRoleCatalog: React.FC<{ state: DepotState; onUpdateState: (next: DepotState) => void }> = ({ state, onUpdateState }) => {
  const [tab, setTab] = useState<Tab>('NHAN_VIEN');
  return (
    <div className="space-y-4">
      <div className="inline-flex flex-wrap overflow-hidden rounded-lg border border-line bg-white text-xs font-bold" role="tablist" aria-label="User - Role">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 ${tab === t.key ? 'bg-navy-900 text-white' : 'text-ink-muted hover:bg-canvas'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'NHAN_VIEN' ? <StaffListTab state={state} onUpdateState={onUpdateState} /> : <RolesTab />}
    </div>
  );
};

// ---------------------------------------------------------------------------
// TAB VAI TRÒ & QUYỀN — màn hình mỗi vai trò được vào (lấy từ MENU_ACCESS)
// ---------------------------------------------------------------------------
const RolesTab: React.FC = () => (
  <SectionCard title="Vai trò & màn hình được truy cập" icon={<ShieldCheck className="h-4 w-4 text-ink-muted" />}>
    <table className="data-table w-full text-left text-xs">
      <tbody className="divide-y divide-line">
        {ASSIGNABLE_ROLES.map((r) => (
          <tr key={r}>
            <td className="w-32 py-1.5 pr-2 font-semibold">{ROLE_LABELS[r]}</td>
            <td className="py-1.5 text-ink">{screensOf(r)}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <p className="mt-2 text-[11px] text-ink-muted">
      Vai trò (role) là phân quyền màn hình — một nhân viên có thể có nhiều vai trò. Phòng ban là thông tin hồ sơ (1 phòng), không quyết định quyền.
    </p>
  </SectionCard>
);

// ---------------------------------------------------------------------------
// TAB DANH SÁCH NHÂN VIÊN — tạo nhân viên (chỉ cần Họ và tên + vai trò), tìm / lọc, bấm dòng mở chi tiết
// ---------------------------------------------------------------------------
const StaffListTab: React.FC<{ state: DepotState; onUpdateState: (next: DepotState) => void }> = ({ state, onUpdateState }) => {
  const remote = isSupabaseConfigured; // DEC-143 / DEC-155: database — đăng nhập bằng TÊN ĐĂNG NHẬP tự gợi ý
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<{ fullName: string; email: string; roles: AppRole[]; department: AppRole | '' }>({ fullName: '', email: '', roles: [], department: '' });
  const [username, setUsername] = useState('');
  const [usernameEdited, setUsernameEdited] = useState(false);
  const takenUsernames = state.staffUsers.map((u) => (u.email.endsWith(`@${LOGIN_EMAIL_DOMAIN}`) ? u.email.split('@')[0] : '')).filter(Boolean);
  const [query, setQuery] = useState('');
  const [dept, setDept] = useState<AppRole | ''>('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = usePageSize('staff-list', 20);
  const [openId, setOpenId] = useState<string | null>(null);
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

  const q = query.trim().toLowerCase();
  const rows = state.staffUsers.filter(
    (u) => (!dept || u.department === dept) && (!q || u.fullName.toLowerCase().includes(q) || u.staffCode.toLowerCase().includes(q) || usernameOf(u).includes(q))
  );
  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pageCount);
  const shown = rows.slice((current - 1) * pageSize, current * pageSize);
  const opened = state.staffUsers.find((u) => u.id === openId) || null;

  const submitAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (remote && !USERNAME_PATTERN.test(normalizeUsername(username))) {
      setError('Tên đăng nhập 3–30 ký tự: chữ thường không dấu, số, dấu . _ -');
      return;
    }
    const base = { fullName: form.fullName, roles: form.roles, department: form.department || undefined };
    const input = remote
      ? { ...base, email: form.email.trim() || usernameToEmail(username), username: normalizeUsername(username) }
      : { ...base, email: form.email };
    const msg = remote
      ? `Đã tạo tài khoản ${normalizeUsername(username)} — mật khẩu ban đầu ${DEFAULT_PASSWORD}, nhân viên phải đổi ở lần đăng nhập đầu. Thông tin chi tiết cập nhật sau.`
      : `Đã thêm nhân viên ${form.fullName}. Thông tin chi tiết cập nhật sau.`;
    if (run(() => addStaffUser(state, input), msg)) {
      setForm({ fullName: '', email: '', roles: [], department: '' });
      setUsername('');
      setUsernameEdited(false);
      setAdding(false);
    }
  };

  return (
    <div className="space-y-4">
      <Feedback error={error} success={success} onClose={() => (setError(null), setSuccess(null))} />

      {/* Bộ lọc + nút thêm cùng hàng (DEC-080) */}
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-line bg-white p-3">
        <label className="w-64">
          <span className={labelCls}>Tìm nhân viên</span>
          <span className="relative block">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-muted" />
            <input value={query} onChange={(e) => { setQuery(e.target.value); setPage(1); }} placeholder="Mã NV / họ tên / tên đăng nhập" className={`${inputCls} pl-7`} />
          </span>
        </label>
        <label className="w-48">
          <span className={labelCls}>Phòng ban</span>
          <DepartmentSelect value={dept} onChange={(v) => { setDept(v); setPage(1); }} />
        </label>
        <button type="button" onClick={() => setAdding((v) => !v)} className={`${primaryBtn} ml-auto`}>
          <UserPlus className="h-3.5 w-3.5" />
          THÊM NHÂN VIÊN
        </button>
      </div>

      {adding && (
        <SectionCard title="Thêm nhân viên" icon={<UserPlus className="h-4 w-4 text-ink-muted" />} right={<button type="button" aria-label="Đóng" onClick={() => setAdding(false)} className={secondaryBtn}><X className="h-3.5 w-3.5" /></button>}>
          <form onSubmit={submitAdd} className="space-y-3">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <label>
                <span className={labelCls}>Họ và tên *</span>
                <input
                  value={form.fullName}
                  onChange={(e) => {
                    setForm({ ...form, fullName: e.target.value });
                    if (remote && !usernameEdited) setUsername(suggestUsername(e.target.value, takenUsernames));
                  }}
                  className={inputCls}
                />
              </label>
              {remote ? (
                <label>
                  <span className={labelCls}>Tên đăng nhập * (tự tạo, sửa được)</span>
                  <input
                    value={username}
                    onChange={(e) => {
                      setUsernameEdited(true);
                      setUsername(e.target.value.replace(/\s/g, '').toLowerCase());
                    }}
                    autoCapitalize="none"
                    placeholder="VD: tuan.lv"
                    className={`${inputCls} font-mono`}
                    data-testid="new-username"
                  />
                </label>
              ) : (
                <label>
                  <span className={labelCls}>Email đăng nhập *</span>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
                </label>
              )}
              <label>
                <span className={labelCls}>Phòng ban</span>
                <DepartmentSelect value={form.department} onChange={(department) => setForm({ ...form, department })} />
              </label>
            </div>
            <div>
              <span className={labelCls}>Vai trò * (phân quyền, được chọn nhiều)</span>
              <RoleChecks value={form.roles} onChange={(roles) => setForm({ ...form, roles })} />
            </div>
            <p className="text-xs text-ink-muted">
              Giới tính, CCCD, năm sinh, quê quán cập nhật sau (bấm vào nhân viên trong danh sách).
              {remote && <> Mật khẩu ban đầu: <strong className="font-mono">{DEFAULT_PASSWORD}</strong> — nhân viên bắt buộc đổi ở lần đăng nhập đầu.</>}
            </p>
            <button type="submit" disabled={!form.fullName.trim() || !(remote ? username.trim() : form.email.trim()) || form.roles.length === 0} className={primaryBtn}>
              Tạo nhân viên
            </button>
          </form>
        </SectionCard>
      )}

      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        <table className="data-table w-full whitespace-nowrap text-left text-xs" data-testid="staff-list">
          <thead className="border-b border-line bg-canvas text-[11px] text-ink-muted">
            <tr>
              <th className="px-3 py-2">Mã NV</th>
              <th className="px-3 py-2">Họ và tên</th>
              <th className="px-3 py-2">Phòng ban</th>
              <th className="px-3 py-2">Vai trò</th>
              <th className="px-3 py-2">Tên đăng nhập</th>
              <th className="px-3 py-2">Thông tin chi tiết</th>
              <th className="px-3 py-2">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.length === 0 ? (
              <tr><td colSpan={7} className="px-3 py-4 text-center text-ink-muted">Không có nhân viên phù hợp.</td></tr>
            ) : (
              shown.map((u) => {
                const missing = staffProfileMissing(u);
                return (
                  <tr key={u.id} onClick={() => setOpenId(u.id)} className={`cursor-pointer hover:bg-canvas ${u.isActive ? '' : 'text-ink-muted'}`}>
                    <td className="px-3 py-2 font-mono">{u.staffCode}</td>
                    <td className="px-3 py-2 font-semibold"><CellText text={u.fullName} max={CELL_MAX.MEDIUM} /></td>
                    <td className="px-3 py-2">{u.department ? ROLE_LABELS[u.department] : <span className="text-ink-muted">Chưa gán</span>}</td>
                    <td className="px-3 py-2"><CellText text={u.roles.map((r) => ROLE_LABELS[r]).join(', ')} max={CELL_MAX.LONG} /></td>
                    <td className="px-3 py-2 font-mono">{usernameOf(u)}</td>
                    <td className="px-3 py-2">
                      {missing.length === 0 ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" />Đủ</span>
                      ) : (
                        <span className="text-amber-700" title={`Chưa cập nhật: ${missing.join(', ')}`}>Thiếu {missing.length} mục</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{u.isActive ? 'Hoạt động' : 'Đã khóa'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      <Pager page={current} pageCount={pageCount} total={rows.length} onPage={setPage} pageSize={pageSize} onPageSize={(n) => { setPageSize(n); setPage(1); }} />

      <DetailDrawer open={Boolean(opened)} title={opened ? `${opened.staffCode} — ${opened.fullName}` : ''} onClose={() => setOpenId(null)}>
        {opened && (
          <StaffDetail
            key={opened.id}
            state={state}
            user={opened}
            remote={remote}
            run={run}
            onReset={async () => {
              setError(null);
              setSuccess(null);
              try {
                await resetStaffPassword(opened.id);
                setSuccess(`Đã đặt lại mật khẩu ${opened.fullName} về ${DEFAULT_PASSWORD} — nhân viên phải đổi ở lần đăng nhập tới.`);
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Không đặt lại được mật khẩu.');
              }
            }}
          />
        )}
      </DetailDrawer>
    </div>
  );
};

// Chi tiết 1 nhân viên (cửa sổ trượt phải): thông tin chi tiết + phòng ban + vai trò + khóa / đặt lại mật khẩu
const StaffDetail: React.FC<{
  state: DepotState;
  user: StaffUser;
  remote: boolean;
  run: (fn: () => DepotState, msg: string) => boolean;
  onReset: () => void;
}> = ({ state, user, remote, run, onReset }) => {
  const [p, setP] = useState({
    department: (user.department || '') as AppRole | '',
    gender: (user.gender || '') as StaffGender | '',
    idNumber: user.idNumber || '',
    birthYear: user.birthYear ? String(user.birthYear) : '',
    hometown: user.hometown || '',
  });
  const [roles, setRoles] = useState<AppRole[]>(user.roles);

  const save = () => {
    const rolesChanged = roles.length !== user.roles.length || roles.some((r) => !user.roles.includes(r));
    run(() => {
      let next = updateStaffProfile(state, {
        userId: user.id,
        department: p.department || null,
        gender: p.gender || null,
        idNumber: p.idNumber || null,
        birthYear: p.birthYear ? Number(p.birthYear) : null,
        hometown: p.hometown || null,
      });
      if (rolesChanged) next = updateStaffUser(next, { userId: user.id, roles });
      return next;
    }, `Đã lưu thông tin nhân viên ${user.fullName}.`);
  };

  return (
    <div className="space-y-4 text-xs">
      <dl className="grid grid-cols-2 gap-2 rounded-md border border-line bg-canvas p-3">
        <div><dt className={labelCls}>Mã nhân viên</dt><dd className="font-mono font-semibold">{user.staffCode}</dd></div>
        <div><dt className={labelCls}>Tên đăng nhập</dt><dd className="font-mono font-semibold">{usernameOf(user)}</dd></div>
        <div className="col-span-2"><dt className={labelCls}>Họ và tên</dt><dd className="text-sm font-semibold">{user.fullName}</dd></div>
      </dl>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <label>
          <span className={labelCls}>Giới tính</span>
          <select value={p.gender} onChange={(e) => setP({ ...p, gender: e.target.value as StaffGender | '' })} className={inputCls}>
            <option value="">— Chưa cập nhật —</option>
            {(Object.keys(STAFF_GENDER_LABELS) as StaffGender[]).map((g) => <option key={g} value={g}>{STAFF_GENDER_LABELS[g]}</option>)}
          </select>
        </label>
        <label>
          <span className={labelCls}>CCCD (12 số)</span>
          <input value={p.idNumber} inputMode="numeric" maxLength={12} onChange={(e) => setP({ ...p, idNumber: e.target.value.replace(/\D/g, '') })} className={`${inputCls} font-mono`} />
        </label>
        <label>
          <span className={labelCls}>Năm sinh</span>
          <input value={p.birthYear} inputMode="numeric" maxLength={4} onChange={(e) => setP({ ...p, birthYear: e.target.value.replace(/\D/g, '') })} className={`${inputCls} font-mono`} />
        </label>
        <label>
          <span className={labelCls}>Quê quán</span>
          <input value={p.hometown} onChange={(e) => setP({ ...p, hometown: e.target.value })} className={inputCls} />
        </label>
        <label className="sm:col-span-2">
          <span className={labelCls}>Phòng ban (1 phòng — không quyết định quyền)</span>
          <DepartmentSelect value={p.department} onChange={(department) => setP({ ...p, department })} />
        </label>
      </div>

      <div>
        <span className={labelCls}>Vai trò (phân quyền màn hình)</span>
        <RoleChecks value={roles} onChange={setRoles} />
      </div>

      <div className="flex flex-wrap gap-2 border-t border-line pt-3">
        <button type="button" onClick={save} disabled={roles.length === 0} className={primaryBtn}>Lưu</button>
        <button type="button" className={secondaryBtn} onClick={() => run(() => updateStaffUser(state, { userId: user.id, isActive: !user.isActive }), user.isActive ? 'Đã khóa nhân viên.' : 'Đã mở khóa nhân viên.')}>
          {user.isActive ? 'Khóa tài khoản' : 'Mở khóa'}
        </button>
        {/* DEC-143: Admin không xem được mật khẩu — chỉ đặt lại về 123456 */}
        {remote && user.id !== state.currentUser.id && (
          <button type="button" className={secondaryBtn} data-testid="reset-password" onClick={onReset}>Đặt lại mật khẩu</button>
        )}
      </div>
      <p className="text-[11px] text-ink-muted">Thông tin chi tiết chỉ Admin và chính nhân viên xem được. Nhân viên xem của mình ở icon khiên → Thông tin chi tiết.</p>
    </div>
  );
};
