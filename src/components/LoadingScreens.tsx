import React from 'react';

// GIAO DIỆN CHỜ dùng chung (màu theo token DEC-145):
//   AppLoading     — mở app / tải dữ liệu lần đầu: logo + bước đang làm + thanh chạy
//   ScreenLoading  — mở 1 màn lần đầu (đang tải file màn hình): khung xương giống bảng
//   SavingIndicator — đang lưu vào database: viên nhỏ góc dưới + thanh chạy trên cùng (chỉ hiện nếu > 300 ms)
//   TopProgress    — thanh chạy mỏng trên cùng (tự làm mới / tải lại)

const Spinner: React.FC<{ className?: string }> = ({ className = 'h-5 w-5' }) => (
  <span className={`inline-block animate-spin rounded-full border-2 border-line-strong border-t-navy-900 ${className}`} aria-hidden="true" />
);

export const TopProgress: React.FC = () => (
  <div className="fixed inset-x-0 top-0 z-[90] h-1 overflow-hidden bg-navy-50" role="progressbar" aria-label="Đang tải">
    <div className="h-full w-1/3 animate-[loadbar_1.1s_ease-in-out_infinite] bg-navy-900" />
  </div>
);

export const AppLoading: React.FC<{ step?: string }> = ({ step = 'Đang tải dữ liệu…' }) => (
  <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-canvas px-4" role="status" data-testid="app-loading">
    <TopProgress />
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-navy-900 text-xl font-black text-white shadow-[0_8px_32px_rgba(11,37,69,0.16)]">M</div>
    <div className="text-center">
      <p className="text-base font-extrabold text-ink">MATRAN DEPOT</p>
      <p className="mt-1 flex items-center justify-center gap-2 text-sm text-ink-muted">
        <Spinner className="h-4 w-4" />
        {step}
      </p>
    </div>
  </div>
);

export const ScreenLoading: React.FC = () => (
  <div className="space-y-3" role="status" aria-label="Đang mở màn hình" data-testid="screen-loading">
    <TopProgress />
    <div className="h-24 animate-pulse rounded-lg border border-line bg-white" />
    <div className="overflow-hidden rounded-lg border border-line bg-white">
      <div className="h-9 animate-pulse bg-canvas" />
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="flex gap-3 border-t border-line px-3 py-3">
          <div className="h-3 w-24 animate-pulse rounded bg-navy-50" />
          <div className="h-3 w-32 animate-pulse rounded bg-navy-50" />
          <div className="h-3 flex-1 animate-pulse rounded bg-navy-50" />
        </div>
      ))}
    </div>
  </div>
);

// Chỉ hiện khi đang lưu lâu hơn 300 ms → thao tác nhanh không bị nháy màn
export const SavingIndicator: React.FC<{ active: boolean }> = ({ active }) => {
  const [visible, setVisible] = React.useState(false);
  React.useEffect(() => {
    if (!active) return setVisible(false);
    const t = setTimeout(() => setVisible(true), 300);
    return () => clearTimeout(t);
  }, [active]);
  if (!active) return null;
  return (
    // Lớp trong suốt chặn bấm tiếp trong lúc lưu (tránh gửi trùng); chỉ làm mờ nhẹ khi lưu lâu
    <div className={`fixed inset-0 z-[60] ${visible ? 'bg-navy-900/10' : ''}`} role="status" data-testid="saving-overlay">
      {visible && (
        <>
          <TopProgress />
          <div className="fixed bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-2 rounded-full bg-navy-900 px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_32px_rgba(11,37,69,0.25)]">
            <Spinner className="h-4 w-4 border-white/30 border-t-white" />
            Đang lưu vào database…
          </div>
        </>
      )}
    </div>
  );
};
