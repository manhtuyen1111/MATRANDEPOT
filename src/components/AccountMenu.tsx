import React, { useState } from 'react';
import { Database, KeyRound, LogOut, RefreshCw, ShieldCheck, UserCheck } from 'lucide-react';
import { ROLE_LABELS, StaffUser } from '../types/depot';

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
    </div>
  );
};
