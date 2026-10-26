import React, { useState } from 'react';
import { KeyRound, LogIn } from 'lucide-react';
import { DepotState } from '../../services/depotStore';
import { changePassword, DEFAULT_PASSWORD, login, logout, PASSWORD_MIN_LENGTH } from '../../services/auth';
import { Feedback, inputCls, labelCls, primaryBtn, secondaryBtn } from '../../components/shared';

// DEC-143: màn ĐĂNG NHẬP — tài khoản do Admin tạo (Danh mục → User). Khung một cột dùng được trên điện thoại.
export const LoginScreen: React.FC<{ state: DepotState; onUpdateState: (next: DepotState) => void; demo?: boolean }> = ({ state, onUpdateState, demo }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          try { onUpdateState(login(state, { username, password })); } catch (err) { setError(err instanceof Error ? err.message : 'Đăng nhập thất bại'); }
        }}
        className="mx-auto w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        data-testid="login-screen"
      >
        <div>
          <p className="text-[11px] font-semibold uppercase text-slate-500">MATRAN DEPOT</p>
          <h1 className="text-lg font-black text-slate-900">Đăng nhập</h1>
        </div>
        <Feedback error={error} success={null} onClose={() => setError(null)} />
        <label className="block">
          <span className={labelCls}>Tên đăng nhập</span>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoComplete="username" className={`${inputCls} font-mono`} />
        </label>
        <label className="block">
          <span className={labelCls}>Mật khẩu</span>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className={inputCls} />
        </label>
        <button type="submit" className={`${primaryBtn} w-full py-3`}>
          <LogIn className="h-4 w-4" />
          Đăng nhập
        </button>
        <p className="text-[11px] text-slate-500">Chưa có tài khoản / quên mật khẩu: liên hệ Admin để được cấp hoặc đặt lại.</p>
        {demo && (
          <p className="rounded bg-amber-50 px-2 py-1.5 text-[11px] text-amber-800" data-testid="login-demo-note">
            DEMO — tài khoản có sẵn: {state.staffUsers.filter((u) => u.isActive).map((u) => u.username).join(', ')}. Tài khoản chưa đổi mật khẩu dùng <span className="font-mono font-bold">{DEFAULT_PASSWORD}</span>.
          </p>
        )}
      </form>
    </div>
  );
};

// DEC-143: ĐỔI MẬT KHẨU — bắt buộc ở lần đăng nhập đầu tiên (forced) hoặc tự đổi từ menu người dùng
export const ChangePasswordScreen: React.FC<{ state: DepotState; onUpdateState: (next: DepotState) => void; forced?: boolean; onClose?: () => void }> = ({ state, onUpdateState, forced, onClose }) => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <div className={forced ? 'flex min-h-screen items-center justify-center bg-slate-100 p-4' : 'fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4'}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          try {
            onUpdateState(changePassword(state, { currentPassword: current, newPassword: next, confirmPassword: confirm }));
            onClose?.();
          } catch (err) { setError(err instanceof Error ? err.message : 'Đổi mật khẩu thất bại'); }
        }}
        className="mx-auto w-full max-w-sm space-y-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
        data-testid="change-password-screen"
      >
        <div>
          <p className="text-[11px] font-semibold uppercase text-slate-500">{state.currentUser.fullName} • <span className="font-mono">{state.currentUser.username}</span></p>
          <h1 className="text-lg font-black text-slate-900">Đổi mật khẩu</h1>
          {forced && <p className="mt-1 text-xs text-amber-800">Lần đăng nhập đầu tiên (hoặc Admin vừa đặt lại): bắt buộc đổi mật khẩu trước khi làm việc.</p>}
        </div>
        <Feedback error={error} success={null} onClose={() => setError(null)} />
        <label className="block">
          <span className={labelCls}>Mật khẩu hiện tại {forced && <span className="font-normal normal-case text-slate-500">(mặc định {DEFAULT_PASSWORD})</span>}</span>
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Mật khẩu mới * (tối thiểu {PASSWORD_MIN_LENGTH} ký tự)</span>
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" className={inputCls} />
        </label>
        <label className="block">
          <span className={labelCls}>Nhập lại mật khẩu mới *</span>
          <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" className={inputCls} />
        </label>
        <button type="submit" className={`${primaryBtn} w-full py-3`}>
          <KeyRound className="h-4 w-4" />
          Lưu mật khẩu mới
        </button>
        {forced ? (
          <button type="button" onClick={() => onUpdateState(logout(state))} className={`${secondaryBtn} w-full`}>Đăng xuất</button>
        ) : (
          <button type="button" onClick={onClose} className={`${secondaryBtn} w-full`}>Hủy</button>
        )}
      </form>
    </div>
  );
};
