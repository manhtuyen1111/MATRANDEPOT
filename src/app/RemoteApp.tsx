import React, { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ChangePasswordScreen, LoginScreen } from '../features/auth/LoginScreen';
import { changePassword, loadStaffSession, signIn, signOut, type StaffSession } from '../services/remote/session';
import { createWorkingSync, loadDossierState, loadEdiState, loadRepairOutputState, loadReportAll, loadReportPage, loadWorkingState, type WorkingSync } from '../services/remote/loadWorking';
import { clearIdMap, friendlyError, isOffline, setRemoteSink, takeCatalogTouched, type RemoteOp } from '../services/remote/sync';
import { setReportLoader } from '../services/remote/reportSource';
import { setPhotoClient } from '../services/remote/photoLink';
import { setDossierLoader } from '../services/remote/dossierSource';
import { setReportPager } from '../services/remote/reportPaging';
import { setDbHealthClient } from '../services/remote/dbHealthSource';
import { setEdiLoader } from '../services/remote/ediSource';
import type { DepotState } from '../services/depotStore';
import { App } from './App';
import { AppLoading, SavingIndicator, StatusPill } from '../components/LoadingScreens';

// ============================================================================
// CHẾ ĐỘ DATABASE (DEC-155): đăng nhập → (bắt buộc đổi mật khẩu) → tải dữ liệu đang làm việc → App.
// Thao tác ghi: hàm bọc (services/api.ts) xếp RPC vào hàng chờ → khóa màn "Đang lưu…" → gửi lần lượt →
// tải lại dữ liệu thật. Database từ chối → báo lỗi đỏ + tải lại. 30 giây tự làm mới khi rảnh (thấy thao tác người khác).
// ============================================================================
const ENV = import.meta.env.VITE_APP_ENV as string | undefined;
const AUTO_REFRESH_MS = 30_000;

type Phase =
  | { kind: 'loading'; step?: string }
  | { kind: 'signedOut'; error?: string | null }
  | { kind: 'mustChange'; me: StaffSession }
  | { kind: 'ready'; me: StaffSession; state: DepotState };

export const RemoteApp: React.FC = () => {
  const client = supabase!;
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [changing, setChanging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reloading, setReloading] = useState(false); // bấm Tải lại → thanh chạy trên cùng
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
      setPhase({ kind: 'loading', step: `Xin chào ${me.fullName} — đang tải dữ liệu bãi…` });
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
      // Lưu ngầm (DEC-160): người dùng bấm tiếp trong lúc lưu → thao tác mới nối vào hàng, chạy luôn trong vòng này.
      // Chỉ thay dữ liệu màn hình khi hàng đã trống (không ghi đè thao tác vừa bấm bằng dữ liệu cũ).
      for (;;) {
        while (queue.current.length) {
          const op = queue.current.shift()!;
          try {
            await op(client);
          } catch (err) {
            failed = friendlyError(err instanceof Error ? err.message : 'Không lưu được vào database.');
            queue.current = [];
          }
        }
        const sync = syncRef.current;
        const state = sync ? await sync.refresh({ catalog: takeCatalogTouched() }) : null;
        if (queue.current.length && !failed) continue;
        if (state) setPhase((p) => (p.kind === 'ready' ? { ...p, state } : p));
        break;
      }
      reloaded = true;
    } catch (err) {
      failed = failed || friendlyError(err instanceof Error ? err.message : 'Không tải lại được dữ liệu.');
    } finally {
      running.current = false;
      if (queue.current.length) {
        setTimeout(() => void flush(), 0); // thao tác bấm đúng lúc vừa xong vòng lưu
      } else {
        clearIdMap();
        setBusy(false);
      }
      if (failed) setSyncError({ message: failed, reloaded });
    }
  }, [client]);

  useEffect(() => {
    setRemoteSink((op) => {
      queue.current.push(op);
      setTimeout(() => void flush(), 0); // gom các thao tác trong cùng 1 lần bấm
    });
    return () => setRemoteSink(null);
  }, [flush]);

  // Báo cáo lọc ngoài 90 ngày → tải riêng theo khoảng lọc (N7)
  useEffect(() => {
    setReportLoader(async (range, kind) => {
      const me = meRef.current;
      if (!me) throw new Error('Phiên đăng nhập đã hết, vui lòng đăng nhập lại.');
      return kind === 'REPAIR_OUTPUT' ? loadRepairOutputState(client, me, range) : loadWorkingState(client, me, range);
    });
    return () => setReportLoader(null);
  }, [client]);

  // Ảnh: bấm XEM ẢNH mới xin link; hồ sơ container tải đủ khi bấm mở (DEC-178)
  useEffect(() => {
    setPhotoClient(client);
    setDbHealthClient(client); // DEC-189: sức khỏe database (Admin)
    setEdiLoader((state, range) => loadEdiState(client, state, range)); // DEC-197: EDI CODECO chạy thử
    setDossierLoader((state, code) => loadDossierState(client, state, code));
    // Báo cáo Hạ vỏ / Cấp vỏ / Sửa chữa: database trả từng trang (DEC-178 bước 4b)
    setReportPager({
      page: (state, kind, f, page, size) => loadReportPage(client, state, kind, f, page, size),
      all: (state, kind, f, onProgress) => loadReportAll(client, state, kind, f, onProgress),
    });
    return () => {
      setPhotoClient(null);
      setDbHealthClient(null);
      setEdiLoader(null);
      setDossierLoader(null);
      setReportPager(null);
    };
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
    return <AppLoading step={phase.step || 'Đang kiểm tra đăng nhập…'} />;
  }
  if (phase.kind === 'signedOut') {
    return (
      <LoginScreen
        env={ENV}
        initialError={phase.error}
        onSignIn={async (u, p) => {
          await signIn(client, u, p);
          setPhase({ kind: 'loading', step: 'Đăng nhập thành công — đang tải dữ liệu…' });
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
          onReload: () => {
            setReloading(true);
            void reloadData('full').catch(() => {}).finally(() => setReloading(false));
          },
        }}
      />
      <SavingIndicator active={busy} />
      <StatusPill active={reloading && !busy} label="Đang tải lại dữ liệu…" />
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
