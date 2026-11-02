// ============================================================================
// PWA (DEC-205): cài MATRAN DEPOT lên điện thoại như 1 ứng dụng; mở bằng đường link trên máy tính vẫn như cũ.
//   - Đăng ký service worker (public/sw.js) chỉ ở bản build thật (không chạy khi dev / test).
//   - Android / Chrome / Edge: giữ sự kiện beforeinstallprompt → nút "Cài ứng dụng" trong menu Quản trị hệ thống.
//   - iPhone (Safari) không có nút cài tự động → hiện hướng dẫn Chia sẻ → Thêm vào Màn hình chính.
// ============================================================================
import { useSyncExternalStore } from 'react';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function registerPwa(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // không tự bật hộp cài — người dùng chủ động bấm trong menu
    deferred = e as InstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    notify();
  });
  if (import.meta.env.PROD && 'serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* không đăng ký được (trình duyệt cũ / chế độ riêng tư) → app vẫn chạy như trang web */
      });
    });
  }
}

// Đang mở dạng ứng dụng đã cài (không có thanh địa chỉ)
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { standalone?: boolean };
  return Boolean(window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone);
}

export function isIosSafari(ua: string = typeof navigator === 'undefined' ? '' : navigator.userAgent): boolean {
  return /iPhone|iPad|iPod/i.test(ua) && !/CriOS|FxiOS|EdgiOS/i.test(ua);
}

export async function promptInstall(): Promise<boolean> {
  if (!deferred) return false;
  const e = deferred;
  deferred = null;
  notify();
  await e.prompt();
  return (await e.userChoice).outcome === 'accepted';
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

// 'INSTALL' = có nút cài • 'IOS' = hướng dẫn iPhone • null = đã cài / trình duyệt không hỗ trợ
export function useInstallOption(): 'INSTALL' | 'IOS' | null {
  const canPrompt = useSyncExternalStore(subscribe, () => deferred !== null, () => false);
  if (isStandalone()) return null;
  if (canPrompt) return 'INSTALL';
  return isIosSafari() ? 'IOS' : null;
}
