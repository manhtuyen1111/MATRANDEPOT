import React, { useState } from 'react';
import { Database, IdCard, KeyRound, LogOut, RefreshCw, ShieldCheck, UserCheck, X } from 'lucide-react';
import { ROLE_LABELS, STAFF_GENDER_LABELS, StaffUser } from '../types/depot';

// Icon QUẢN TRỊ HỆ THỐNG góc phải header: bấm mở danh mục THÔNG TIN NHÂN VIÊN + thao tác tài khoản
// (Tải lại, Đổi mật khẩu, Đăng xuất) — gọn 1 dòng cho màn tác nghiệp mobile.
export interface AccountMenuProps {
  currentUser: StaffUser;
  /** Chế độ database: tài khoản đăng nhập thật */
  remote?: { fullName: string; username: string; onSignOut: () => void; onChangePassword: () => void; onReload?: () => void };
  /** Chế độ Demo: chọn người dùng + nạp / xóa dữ liệu */
  demo?: { users: StaffUser[]; onSelectUser: (id: string) => void; onClearData: () => void; onLoadTestData: () => void };
  defaultOpen?: boolean;
}

const itemCls = 'flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm text-ink hover:bg-navy-50';

export const AccountMenu: React.FC<AccountMenuProps> = ({ currentUser, remote, demo, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  const [showProfile, setShowProfile] = useState(false); // DEC-191: Thông tin chi tiết của chính mình
  const act = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  const roles = currentUser.roles.map((r) => ROLE_LABELS[r]).join(', ');

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Quản trị hệ thống"
        aria-expanded={open}
        title="Quản trị hệ thống"
        className={`flex h-8 w-8 items-center justify-center rounded-md border ${open ? 'border-navy-900 bg-navy-900 text-white' : 'border-line bg-white text-ink-muted hover:bg-navy-50'}`}
        data-testid="account-menu"
      >
        <ShieldCheck className="h-4 w-4" />
      </button>
      {open && (
        <>
          <button type="button" aria-label="Đóng menu quản trị" className="fixed inset-0 z-30 cursor-default" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 top-full z-40 mt-1 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-line bg-white p-1.5 shadow-xl" data-testid="account-menu-panel">
            <div className="rounded-md bg-canvas px-3 py-2.5" data-testid="session-user">
              <p className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">Thông tin nhân viên</p>
              {remote ? (
                <>
                  <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-ink">
                    <UserCheck className="h-4 w-4 text-ink-muted" />
                    {remote.fullName}
                  </p>
                  <p className="font-mono text-xs text-ink-muted">{remote.username}</p>
                </>
              ) : (
                demo && (
                  <label className="mt-1 flex items-center gap-1.5">
                    <UserCheck className="h-4 w-4 shrink-0 text-ink-muted" />
                    <span className="sr-only">Người dùng (Demo)</span>
                    <select value={currentUser.id} onChange={(e) => demo.onSelectUser(e.target.value)} className="w-full min-w-0 bg-transparent text-sm font-semibold text-ink focus:outline-hidden">
                      {demo.users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.fullName} ({u.roles.map((r) => ROLE_LABELS[r]).join(', ')})
                        </option>
                      ))}
                    </select>
                  </label>
                )
              )}
              {roles && <p className="mt-0.5 text-xs text-ink-muted">{roles}</p>}
            </div>
            <div className="mt-1 space-y-0.5">
              <button type="button" role="menuitem" onClick={act(() => setShowProfile(true))} className={itemCls} data-testid="my-profile">
                <IdCard className="h-4 w-4 text-ink-muted" />
                Thông tin chi tiết
              </button>
              {remote?.onReload && (
                <button type="button" role="menuitem" onClick={act(remote.onReload)} className={itemCls} data-testid="reload-data">
                  <RefreshCw className="h-4 w-4 text-ink-muted" />
                  Tải lại
                </button>
              )}
              {remote && (
                <button type="button" role="menuitem" onClick={act(remote.onChangePassword)} className={itemCls}>
                  <KeyRound className="h-4 w-4 text-ink-muted" />
                  Đổi mật khẩu
                </button>
              )}
              {demo && (
                <>
                  <button type="button" role="menuitem" onClick={act(demo.onClearData)} className={itemCls}>
                    <RefreshCw className="h-4 w-4 text-ink-muted" />
                    Xóa dữ liệu
                  </button>
                  <button type="button" role="menuitem" onClick={act(demo.onLoadTestData)} className={itemCls}>
                    <Database className="h-4 w-4 text-ink-muted" />
                    Nạp dữ liệu test
                  </button>
                </>
              )}
              {remote && (
                <button type="button" role="menuitem" onClick={act(remote.onSignOut)} className={`${itemCls} border-t border-line text-danger-fg hover:bg-danger-bg`} data-testid="sign-out">
                  <LogOut className="h-4 w-4" />
                  Đăng xuất
                </button>
              )}
            </div>
          </div>
        </>
      )}
      {showProfile && <MyProfile user={currentUser} username={remote?.username} onClose={() => setShowProfile(false)} />}
    </div>
  );
};

// DEC-191: THÔNG TIN CHI TIẾT của chính nhân viên — chỉ xem; ô trống ghi "Chưa cập nhật" (Admin cập nhật / xác minh)
export const MyProfile: React.FC<{ user: StaffUser; username?: string; onClose: () => void }> = ({ user, username, onClose }) => {
  const rows: [string, string | undefined][] = [
    ['Mã nhân viên', user.staffCode],
    ['Họ và tên', user.fullName],
    ['Tên đăng nhập', username],
    ['Giới tính', user.gender ? STAFF_GENDER_LABELS[user.gender] : undefined],
    ['CCCD', user.idNumber],
    ['Năm sinh', user.birthYear ? String(user.birthYear) : undefined],
    ['Quê quán', user.hometown],
    ['Phòng ban', user.department ? ROLE_LABELS[user.department] : undefined],
    ['Vai trò', user.roles.map((r) => ROLE_LABELS[r]).join(', ') || undefined],
  ];
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Thông tin chi tiết nhân viên" onClick={onClose}>
      <div className="my-8 w-full max-w-md rounded-lg bg-white p-5 text-xs shadow-xl" onClick={(e) => e.stopPropagation()} data-testid="my-profile-panel">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-ink"><IdCard className="h-4 w-4" />Thông tin chi tiết</h2>
          <button type="button" onClick={onClose} aria-label="Đóng" className="rounded-md border border-line p-1 text-ink-muted hover:bg-canvas"><X className="h-4 w-4" /></button>
        </div>
        <dl className="divide-y divide-line rounded-md border border-line">
          {rows.filter(([, v], i) => i !== 2 || v).map(([label, value]) => (
            <div key={label} className="grid grid-cols-[120px_1fr] gap-2 px-3 py-2">
              <dt className="text-ink-muted">{label}</dt>
              <dd className={value ? 'font-semibold text-ink' : 'italic text-amber-700'}>{value || 'Chưa cập nhật'}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[11px] text-ink-muted">Thông tin sai hoặc còn thiếu: báo Admin cập nhật. Thông tin này chỉ bạn và Admin xem được.</p>
      </div>
    </div>
  );
};
