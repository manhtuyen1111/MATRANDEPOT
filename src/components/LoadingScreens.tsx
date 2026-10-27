import React from 'react';

// GIAO DIỆN CHỜ dùng chung (màu theo token DEC-145). Nguyên tắc: nhẹ nhàng, không nhấp nháy,
// không thanh chạy; thao tác nhanh (< 300 ms) thì không hiện gì.
//   AppLoading      — mở app / tải dữ liệu lần đầu: logo + vòng xoay chậm + bước đang làm
//   ScreenLoading   — mở 1 màn chưa tải xong: khung tĩnh mờ + "Đang mở…" (chỉ hiện nếu > 300 ms)
//   StatusPill      — viên nhỏ dưới màn hình: "Đang lưu…" / "Đang tải lại…" (chỉ hiện nếu > 300 ms)
//   SavingIndicator — đang lưu vào database: chặn bấm trùng + StatusPill

const SHOW_AFTER_MS = 300;

// Chỉ bật sau một khoảng ngắn → thao tác nhanh không bị nháy màn
function useDelayed(active: boolean, ms = SHOW_AFTER_MS): boolean {
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    if (!active) return setVisible(false);
    const t = setTimeout(() => setVisible(true), ms);
    return () => clearTimeout(t);
  }, [active, ms]);
  return active && visible;
}

const Spinner: React.FC<{ className?: string }> = ({ className = 'h-5 w-5 border-line-strong border-t-navy-700' }) => (
  <span className={`inline-block animate-[spin_1.4s_linear_infinite] rounded-full border-2 ${className}`} aria-hidden="true" />
);

export const AppLoading: React.FC<{ step?: string }> = ({ step = 'Đang tải dữ liệu…' }) => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-canvas px-4" role="status" data-testid="app-loading">
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-navy-900 text-xl font-black text-white shadow-[0_8px_32px_rgba(11,37,69,0.16)]">M</div>
    <div className="text-center">
      <p className="text-base font-extrabold text-ink">MATRAN DEPOT</p>
      <p className="mt-2 flex items-center justify-center gap-2 text-sm text-ink-muted">
        <Spinner className="h-4 w-4 border-line-strong border-t-navy-700" />
        {step}
      </p>
    </div>
  </div>
);

export const ScreenLoading: React.FC = () => {
  const visible = useDelayed(true);
  if (!visible) return null;
  return (
    <div className="space-y-3" role="status" aria-label="Đang mở màn hình" data-testid="screen-loading">
      <p className="flex items-center gap-2 text-xs text-ink-muted">
        <Spinner className="h-3.5 w-3.5 border-line-strong border-t-navy-700" />
        Đang mở…
      </p>
      <div className="h-20 rounded-lg border border-line bg-white" />
      <div className="overflow-hidden rounded-lg border border-line bg-white">
        <div className="h-9 bg-canvas" />
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex gap-3 border-t border-line px-3 py-3">
            <div className="h-3 w-24 rounded bg-canvas" />
            <div className="h-3 w-32 rounded bg-canvas" />
            <div className="h-3 flex-1 rounded bg-canvas" />
          </div>
        ))}
      </div>
    </div>
  );
};

export const StatusPill: React.FC<{ active: boolean; label: string }> = ({ active, label }) => {
  const visible = useDelayed(active);
  if (!visible) return null;
  return (
    <div
      className="pointer-events-none fixed bottom-4 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-2 rounded-full border border-line bg-white/95 px-4 py-2 text-xs font-semibold text-ink-muted shadow-[0_8px_32px_rgba(11,37,69,0.12)]"
      role="status"
    >
      <Spinner className="h-3.5 w-3.5 border-line-strong border-t-navy-700" />
      {label}
    </div>
  );
};

export const SavingIndicator: React.FC<{ active: boolean }> = ({ active }) => {
  if (!active) return null;
  return (
    // Lớp trong suốt chặn bấm tiếp trong lúc lưu (tránh gửi trùng) — không làm tối màn hình
    <div className="fixed inset-0 z-[60]" data-testid="saving-overlay">
      <StatusPill active label="Đang lưu…" />
    </div>
  );
};
