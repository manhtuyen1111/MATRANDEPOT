import React, { useState } from 'react';
import { Eye, EyeOff, KeyRound, LogIn, LogOut } from 'lucide-react';
import { Feedback, inputCls, labelCls, primaryBtn, secondaryBtn } from '../../components/shared';
import { DEFAULT_PASSWORD, environmentLabel, readRememberedUsername, writeRememberedUsername } from '../../services/authPassword';

// ============================================================================
// MÀN ĐĂNG NHẬP + ĐỔI MẬT KHẨU (DEC-143, DEC-151, DEC-153) — chỉ dùng ở chế độ database.
// Bố cục chia đôi (máy tính): trái navy tên MATRAN DEPOT + khối container; phải ô đăng nhập. Điện thoại: chỉ ô đăng nhập.
// Giao diện chỉ gọi hàm được truyền vào (session.ts); quy tắc mật khẩu ở authPassword.ts.
// ============================================================================

// Khối container — giống ảnh bìa design system (docs/design/components/Cover)
const BrandPanel: React.FC = () => (
  <div className="relative hidden flex-1 flex-col justify-end overflow-hidden bg-navy-900 p-10 text-white lg:flex" aria-hidden="true">
    <svg viewBox="0 0 480 288" className="absolute right-0 top-10 w-[78%] max-w-[560px]">
      <rect x="40" y="24" width="180" height="64" rx="4" className="fill-navy-50/15" />
      <rect x="228" y="24" width="280" height="64" rx="4" className="fill-navy-700" />
      <rect x="0" y="96" width="340" height="64" rx="4" className="fill-navy-700/70" />
      <rect x="348" y="96" width="88" height="64" rx="4" className="fill-accent" />
      <rect x="444" y="96" width="60" height="64" rx="4" className="fill-navy-50/15" />
      <rect x="96" y="168" width="200" height="96" rx="4" className="fill-navy-700" />
      <rect x="304" y="168" width="200" height="96" rx="4" className="fill-navy-50/10" />
    </svg>
    <div className="relative max-w-md">
      <p className="text-6xl font-bold leading-[0.95] tracking-tight">MATRAN<br />DEPOT</p>
      <p className="mt-4 text-sm text-white/70">Quản lý bãi container rỗng — gọn gàng từ văn phòng tới hiện trường.</p>
    </div>
  </div>
);

const PasswordInput: React.FC<{
  id: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}> = ({ id, value, onChange, autoComplete }) => {
  const [show, setShow] = useState(false);
  return (
    <span className="relative block">
      <input id={id} type={show ? 'text' : 'password'} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} className={`${inputCls} pr-10`} />
      <button
        type="button"
        onClick={() => setShow(!show)}
        aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-ink-muted hover:text-ink"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </span>
  );
};

const Shell: React.FC<{ children: React.ReactNode; env?: string }> = ({ children, env }) => (
  <div className="flex min-h-screen bg-canvas">
    <BrandPanel />
    <div className="flex w-full flex-col lg:w-[480px] lg:shrink-0">
      {/* Điện thoại: dải navy mỏng trên cùng thay cho nửa trái */}
      <div className="bg-navy-900 px-4 py-3 text-sm font-bold tracking-wide text-white lg:hidden">MATRAN DEPOT</div>
      <div className="flex flex-1 items-center justify-center px-4 py-8 sm:px-8">
        <div className="w-full max-w-sm">{children}</div>
      </div>
      <p className="px-4 pb-4 text-center text-xs text-ink-muted" data-testid="login-env">{environmentLabel(env)}</p>
    </div>
  </div>
);

export const LoginScreen: React.FC<{
  onSignIn: (username: string, password: string) => Promise<void>;
  env?: string;
  initialError?: string | null;
}> = ({ onSignIn, env, initialError = null }) => {
  const remembered = readRememberedUsername();
  const [username, setUsername] = useState(remembered);
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(Boolean(remembered));
  const [error, setError] = useState<string | null>(initialError);
  const [busy, setBusy] = useState(false);
  return (
    <Shell env={env}>
      <form
        data-testid="login-screen"
        className="space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          setError(null);
          setBusy(true);
          try {
            await onSignIn(username, password);
            writeRememberedUsername(remember ? username : null);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Đăng nhập thất bại.');
            setPassword('');
          } finally {
            setBusy(false);
          }
        }}
      >
        <div>
          <h1 className="text-2xl font-semibold text-ink">Đăng nhập</h1>
          <p className="mt-1 text-sm text-ink-muted">Dùng tài khoản Admin đã cấp cho bạn.</p>
        </div>
        <Feedback error={error} success={null} onClose={() => setError(null)} />
        <label className="block" htmlFor="login-username">
          <span className={labelCls}>Tên đăng nhập</span>
          <input
            id="login-username"
            value={username}
            onChange={(e) => setUsername(e.target.value.replace(/\s/g, '').toLowerCase())}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            placeholder="VD: tuan.lv"
            className={`${inputCls} font-mono`}
          />
        </label>
        <label className="block" htmlFor="login-password">
          <span className={labelCls}>Mật khẩu</span>
          <PasswordInput id="login-password" value={password} onChange={setPassword} autoComplete="current-password" />
        </label>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} className="h-4 w-4 accent-navy-900" data-testid="remember-username" />
          Nhớ tên đăng nhập trên máy này
        </label>
        <button type="submit" disabled={busy} className={`${primaryBtn} h-12 w-full text-base`}>
          <LogIn className="h-4 w-4" />
          {busy ? 'Đang đăng nhập…' : 'Đăng nhập'}
        </button>
        <p className="text-sm text-ink-muted">Quên mật khẩu? Liên hệ Admin để được đặt lại.</p>
      </form>
    </Shell>
  );
};

// Bắt buộc ở lần đăng nhập đầu / sau khi Admin đặt lại (forced), hoặc tự đổi từ header
export const ChangePasswordScreen: React.FC<{
  fullName: string;
  username: string;
  forced?: boolean;
  env?: string;
  onSubmit: (input: { current: string; next: string; confirm: string }) => Promise<void>;
  onCancel?: () => void;
  onSignOut?: () => void;
}> = ({ fullName, username, forced, env, onSubmit, onCancel, onSignOut }) => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const form = (
    <form
      data-testid="change-password-screen"
      className="space-y-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setError(null);
        setBusy(true);
        try {
          await onSubmit({ current, next, confirm });
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Đổi mật khẩu thất bại.');
        } finally {
          setBusy(false);
        }
      }}
    >
      <div>
        <p className="text-sm text-ink-muted">{fullName} · <span className="font-mono">{username}</span></p>
        <h1 className="text-2xl font-semibold text-ink">Đổi mật khẩu</h1>
        {forced && (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Lần đăng nhập đầu tiên (hoặc Admin vừa đặt lại): bạn cần đổi mật khẩu trước khi làm việc.
          </p>
        )}
      </div>
      <Feedback error={error} success={null} onClose={() => setError(null)} />
      <label className="block" htmlFor="pw-current">
        <span className={labelCls}>Mật khẩu hiện tại{forced ? ` (mặc định ${DEFAULT_PASSWORD})` : ''}</span>
        <PasswordInput id="pw-current" value={current} onChange={setCurrent} autoComplete="current-password" />
      </label>
      <label className="block" htmlFor="pw-next">
        <span className={labelCls}>Mật khẩu mới</span>
        <PasswordInput id="pw-next" value={next} onChange={setNext} autoComplete="new-password" />
      </label>
      <label className="block" htmlFor="pw-confirm">
        <span className={labelCls}>Nhập lại mật khẩu mới</span>
        <PasswordInput id="pw-confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" />
      </label>
      <p className="text-xs text-ink-muted">Bao nhiêu ký tự cũng được, nhưng không dùng {DEFAULT_PASSWORD}.</p>
      <button type="submit" disabled={busy} className={`${primaryBtn} h-12 w-full text-base`}>
        <KeyRound className="h-4 w-4" />
        {busy ? 'Đang lưu…' : 'Lưu mật khẩu mới'}
      </button>
      {forced ? (
        <button type="button" onClick={onSignOut} className={`${secondaryBtn} w-full`}>
          <LogOut className="h-4 w-4" />
          Đăng xuất
        </button>
      ) : (
        <button type="button" onClick={onCancel} className={`${secondaryBtn} w-full`}>Hủy</button>
      )}
    </form>
  );
  if (forced) return <Shell env={env}>{form}</Shell>;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-900/40 p-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-xl border border-line bg-surface p-6 shadow-[0_8px_32px_rgba(11,37,69,0.16)]">{form}</div>
    </div>
  );
};
