import React, { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { ChangePasswordScreen, LoginScreen } from '../features/auth/LoginScreen';
import { changePassword, loadStaffSession, signIn, signOut, type StaffSession } from '../services/remote/session';
import { loadCatalogState } from '../services/remote/loadState';
import type { DepotState } from '../services/depotStore';
import { App } from './App';

// ============================================================================
// CHẾ ĐỘ DATABASE (DEC-155): đăng nhập → (bắt buộc đổi mật khẩu) → tải dữ liệu đang làm việc → App.
// Không cấu hình Supabase thì main.tsx dùng thẳng <App /> (Demo) — file này không chạy.
// ============================================================================
const ENV = import.meta.env.VITE_APP_ENV as string | undefined;

type Phase =
  | { kind: 'loading' }
  | { kind: 'signedOut'; error?: string | null }
  | { kind: 'mustChange'; me: StaffSession }
  | { kind: 'ready'; me: StaffSession; state: DepotState };

export const RemoteApp: React.FC = () => {
  const client = supabase!;
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' });
  const [changing, setChanging] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const me = await loadStaffSession(client);
      if (!me) return setPhase({ kind: 'signedOut' });
      if (me.mustChangePassword) return setPhase({ kind: 'mustChange', me });
      setPhase({ kind: 'ready', me, state: await loadCatalogState(client, me) });
    } catch (err) {
      setPhase({ kind: 'signedOut', error: err instanceof Error ? err.message : 'Không tải được phiên đăng nhập.' });
    }
  }, [client]);

  useEffect(() => {
    void refresh();
    // Phiên hết hạn / đăng xuất ở tab khác → quay về màn đăng nhập
    const { data } = client.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') setPhase({ kind: 'signedOut' });
    });
    return () => data.subscription.unsubscribe();
  }, [client, refresh]);

  const doSignOut = async () => {
    await signOut(client);
    setPhase({ kind: 'signedOut' });
  };

  if (phase.kind === 'loading') {
    return <div className="flex min-h-screen items-center justify-center bg-canvas text-sm text-ink-muted">Đang tải…</div>;
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
        remote={{ fullName: phase.me.fullName, username: phase.me.username, onSignOut: doSignOut, onChangePassword: () => setChanging(true) }}
      />
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
