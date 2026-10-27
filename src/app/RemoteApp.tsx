import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ChangePasswordScreen, LoginScreen } from '../features/auth/LoginScreen';
import { changePassword, loadStaffSession, signIn, signOut, type StaffSession } from '../services/remote/session';
import { createWorkingSync, loadWorkingState, type WorkingSync } from '../services/remote/loadWorking';
import { clearIdMap, friendlyError, isOffline, setRemoteSink, type RemoteOp } from '../services/remote/sync';
import { setReportLoader } from '../services/remote/reportSource';
import type { DepotState } from '../services/depotStore';
import { App } from './App';

// ============================================================================
// CHẾ ĐỘ DATABASE (DEC-155): đăng nhập → (bắt buộc đổi mật khẩu) → tải dữ liệu đang làm việc → App.
// Thao tác ghi: hàm bọc (services/api.ts) xếp RPC vào hàng chờ → khóa màn "Đang lưu…" → gửi lần lượt →
// tải lại dữ liệu thật. Database từ chối → báo lỗi đỏ + tải lại. 30 giây tự làm mới khi rảnh (thấy thao tác người khác).
// ============================================================================
const ENV = import.meta.env.VITE_APP_ENV as string | undefined;
const AUTO_REFRESH_MS = 30_000;

type Phase =
  | { kind: 'loading' }
  | { kind: 'signedOut'; error?: string | null }
  | { kind: 'mustChange'; me: StaffSession }
  | { kind: 'ready'; me: StaffSession; state: DepotState };

export const RemoteApp: React.FC = () => {
  const client = supabase!;
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [changing, setChanging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [syncError, setSyncError] = useState<{ message: string; reloaded: boolean } | null>(null);
  const [offline, setOffline] = useState(isOffline());
  const queue = useRef<RemoteOp[]>([]);
  const running = useRef(false);
  const meRef = useRef<StaffSession | null>(null);
  const syncRef = useRef<WorkingSync | null>(null); // N8: mở app tải đủ, sau đó chỉ tải phần thay đổi

  const refresh = useCallback(async () => {
    try {
      const me = await loadStaffSession(client);
      meRef.current = me;
      if (!me) return setPhase({ kind: 'signedOut' });
      if (me.mustChangePassword) return setPhase({ kind: 'mustChange', me });
      syncRef.current = createWorkingSync(client, me);
      setPhase({ kind: 'ready', me, state: await syncRef.current.full() });
    } catch (err) {
      setPhase({ kind: 'signedOut', error: err instanceof Error ? err.message : 'Không tải được phiên đăng nhập.' });
    }
  }, [client]);

  // Tải lại dữ liệu thật (giữ phiên): sau mỗi lần lưu và theo lịch chỉ lấy phần thay đổi; bấm Tải lại → tải đủ
  const reloadData = useCallback(async (mode: 'delta' | 'full' = 'delta') => {
    const sync = syncRef.current;
    if (!sync) return;
    const state = mode === 'full' ? await sync.full() : await sync.refresh();
    setPhase((p) => (p.kind === 'ready' ? { ...p, state } : p));
  }, []);

  // Chạy hàng chờ ghi: lần lượt, dừng ở lỗi đầu tiên (các thao tác sau có thể phụ thuộc thao tác lỗi)
  const flush = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setBusy(true);
    let failed: string | null = null;
    let reloaded = false;
    try {
      while (queue.current.length) {
        const op = queue.current.shift()!;
        try {
          await op(client);
        } catch (err) {
          failed = friendlyError(err instanceof Error ? err.message : 'Không lưu được vào database.');
          queue.current = [];
        }
      }
      await reloadData();
      reloaded = true;
    } catch (err) {
      failed = failed || friendlyError(err instanceof Error ? err.message : 'Không tải lại được dữ liệu.');
    } finally {
      clearIdMap();
      running.current = false;
      setBusy(false);
      if (failed) setSyncError({ message: failed, reloaded });
    }
  }, [client, reloadData]);

  useEffect(() => {
    setRemoteSink((op) => {
      queue.current.push(op);
      setTimeout(() => void flush(), 0); // gom các thao tác trong cùng 1 lần bấm
    });
    return () => setRemoteSink(null);
  }, [flush]);

  // Báo cáo lọc ngoài 90 ngày → tải riêng theo khoảng lọc (N7)
  useEffect(() => {
    setReportLoader(async (range) => {
      const me = meRef.current;
      if (!me) throw new Error('Phiên đăng nhập đã hết, vui lòng đăng nhập lại.');
      return loadWorkingState(client, me, range);
    });
    return () => setReportLoader(null);
  }, [client]);

  useEffect(() => {
    void refresh();
    const { data } = client.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setPhase({ kind: 'signedOut' });
    });
    return () => data.subscription.unsubscribe();
  }, [client, refresh]);

  // Mất mạng / có mạng lại (DEC-151): hiện dải báo; có mạng lại → tải lại dữ liệu thật
  useEffect(() => {
    const goOffline = () => setOffline(true);
    const goOnline = () => {
      setOffline(false);
      if (!running.current) void reloadData().then(() => setSyncError(null)).catch(() => {});
    };
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, [reloadData]);

  // Tự làm mới khi rảnh (không đang lưu, tab đang mở)
  useEffect(() => {
    if (phase.kind !== 'ready') return;
    const t = setInterval(() => {
      if (!running.current && !queue.current.length && !isOffline() && document.visibilityState === 'visible') void reloadData().catch(() => {});
    }, AUTO_REFRESH_MS);
    return () => clearInterval(t);
  }, [phase.kind, reloadData]);

  const doSignOut = async () => {
    await signOut(client);
    meRef.current = null;
    syncRef.current = null;
    setPhase({ kind: 'signedOut' });
  };

  if (phase.kind === 'loading') {
    return <div className="flex min-h-screen items-center justify-center bg-canvas text-sm text-ink-muted">Đang tải dữ liệu…</div>;
  }
  if (phase.kind === 'signedOut') {
    return (
      <LoginScreen
        env={ENV}
        initialError={phase.error}
        onSignIn={async (u, p) => {
          await signIn(client, u, p);
          await refresh();
        }}
      />
    );
  }
  if (phase.kind === 'mustChange') {
    return (
      <ChangePasswordScreen
        forced
        env={ENV}
        fullName={phase.me.fullName}
        username={phase.me.username}
        onSignOut={doSignOut}
        onSubmit={async (input) => {
          await changePassword(client, phase.me.username, input);
          await refresh();
        }}
      />
    );
  }
  return (
    <>
      <App
        key={phase.me.id}
        initialState={phase.state}
        remote={{
          fullName: phase.me.fullName,
          username: phase.me.username,
          onSignOut: doSignOut,
          onChangePassword: () => setChanging(true),
          onReload: () => void reloadData('full'),
        }}
      />
      {busy && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-navy-900/30" role="status" data-testid="saving-overlay">
          <div className="rounded-xl bg-surface px-6 py-4 text-sm font-semibold text-ink shadow-[0_8px_32px_rgba(11,37,69,0.16)]">Đang lưu vào database…</div>
        </div>
      )}
      {offline && (
        <div className="fixed inset-x-0 bottom-0 z-[70] bg-danger-bg px-4 py-2 text-center text-sm font-semibold text-danger-fg" role="alert" data-testid="offline-banner">
          Mất kết nối mạng — thao tác sẽ không được lưu. Có mạng lại, dữ liệu tự tải lại.
        </div>
      )}
      {syncError && (
        <div className="fixed inset-x-0 top-0 z-[70] flex justify-center p-3" data-testid="sync-error">
          <div className="flex max-w-xl items-start gap-3 rounded-xl border border-danger-bg bg-danger-bg px-4 py-3 text-sm text-danger-fg shadow-[0_8px_32px_rgba(11,37,69,0.16)]">
            <span>
              <strong>Không lưu được:</strong> {syncError.message}{' '}
              {syncError.reloaded ? 'Dữ liệu đã được tải lại từ database.' : 'Dữ liệu trên màn có thể chưa đúng — bấm Tải lại khi có mạng.'}
            </span>
            <button type="button" onClick={() => setSyncError(null)} className="font-bold" aria-label="Đóng thông báo">×</button>
          </div>
        </div>
      )}
      {changing && (
        <ChangePasswordScreen
          fullName={phase.me.fullName}
          username={phase.me.username}
          onCancel={() => setChanging(false)}
          onSubmit={async (input) => {
            await changePassword(client, phase.me.username, input);
            setChanging(false);
          }}
        />
      )}
    </>
  );
};
