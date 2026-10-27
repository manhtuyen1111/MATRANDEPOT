import React from 'react';
import { Camera, Flashlight, Image as ImageIcon, X } from 'lucide-react';
import { inputCls, primaryBtn } from './shared';

// MÃ QR TÁC NGHIỆP (DEC-057): mã QR THẬT (không phải hình minh họa) + quét bằng camera / súng quét cầm tay.
//   QrImage   — vẽ mã QR từ chuỗi (VD QR-HV-261028-001). Mã ngắn → ô QR thưa, to → quét rất nhanh.
//   ScanField — ô nhập + nút camera (không có nút Quét: súng quét gõ + Enter là tự tra). Quét được (camera hoặc súng quét gõ + Enter) → tự tra mã ngay.
// Thư viện chỉ tải khi cần (không làm chậm mở app).

export const QrImage: React.FC<{ value: string; size?: number; className?: string }> = ({ value, size = 128, className = '' }) => {
  const [src, setSrc] = React.useState('');
  React.useEffect(() => {
    let alive = true;
    import('qrcode')
      .then((qr) => qr.toDataURL(value, { errorCorrectionLevel: 'M', margin: 1, width: size * 2, color: { dark: '#000000', light: '#ffffff' } }))
      .then((url) => alive && setSrc(url))
      .catch(() => alive && setSrc(''));
    return () => {
      alive = false;
    };
  }, [value, size]);
  return src ? (
    <img src={src} alt={`Mã QR ${value}`} width={size} height={size} className={`block [image-rendering:pixelated] ${className}`} data-testid="qr-image" />
  ) : (
    <span style={{ width: size, height: size }} className={`block bg-white ${className}`} aria-label={`Mã QR ${value}`} />
  );
};

// Bíp ngắn + rung khi bắt được mã (người dùng biết ngay đã quét xong)
function feedback() {
  try {
    navigator.vibrate?.(60);
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 1800;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.08);
    osc.onended = () => void ctx.close();
  } catch {
    /* thiết bị không hỗ trợ âm thanh / rung — bỏ qua */
  }
}

// Màn camera toàn màn hình: camera sau, khung ngắm giữa, đèn flash; bắt được mã → đóng + trả mã
const CameraScanner: React.FC<{ onResult: (code: string) => void; onClose: () => void }> = ({ onResult, onClose }) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [flash, setFlash] = React.useState<{ available: boolean; on: boolean }>({ available: false, on: false });
  const scannerRef = React.useRef<import('qr-scanner').default | null>(null);
  const done = React.useRef(false);

  React.useEffect(() => {
    let stopped = false;
    import('qr-scanner')
      .then(async ({ default: QrScanner }) => {
        if (stopped || !videoRef.current) return;
        const scanner = new QrScanner(
          videoRef.current,
          (result) => {
            if (done.current) return;
            done.current = true;
            feedback();
            scanner.stop();
            onResult(result.data.trim().toUpperCase());
          },
          { preferredCamera: 'environment', maxScansPerSecond: 25, highlightScanRegion: false, returnDetailedScanResult: true }
        );
        scannerRef.current = scanner;
        await scanner.start();
        if (!stopped) setFlash({ available: await scanner.hasFlash(), on: false });
      })
      .catch(() => setError('Không mở được camera. Kiểm tra quyền camera của trình duyệt, hoặc nhập mã / dùng súng quét.'));
    return () => {
      stopped = true;
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, [onResult]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Chọn ảnh có mã QR trong máy (ảnh chụp màn hình, ảnh Zalo…)
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [picking, setPicking] = React.useState(false);
  const scanFile = async (file: File) => {
    setPicking(true);
    setError(null);
    try {
      const { default: QrScanner } = await import('qr-scanner');
      const r = await QrScanner.scanImage(file, { returnDetailedScanResult: true });
      if (done.current) return;
      done.current = true;
      feedback();
      onResult(r.data.trim().toUpperCase());
    } catch {
      setError('Không tìm thấy mã QR trong ảnh. Chọn ảnh rõ hơn, mã QR không bị che / mờ.');
    } finally {
      setPicking(false);
    }
  };

  const ctrlBtn = 'flex flex-col items-center gap-1.5 text-xs font-semibold text-white disabled:opacity-50';
  const ctrlIcon = (on = false) => `flex h-14 w-14 items-center justify-center rounded-full ${on ? 'bg-white text-black' : 'bg-white/15'}`;

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label="Quét mã QR">
      {/* Đầu màn */}
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(12px,env(safe-area-inset-top))]">
        <button type="button" onClick={onClose} aria-label="Đóng camera" className="rounded-full bg-white/15 p-2">
          <X className="h-5 w-5" />
        </button>
        <span className="text-base font-bold">Quét mã QR</span>
        <span className="w-9" />
      </div>

      {/* Vùng camera: khung ngắm ở giữa vùng này (trùng vùng máy đọc mã), lệch lên trên màn hình → dễ lia máy */}
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="relative h-[min(68vw,280px)] w-[min(68vw,280px)] rounded-3xl shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]">
            {/* 4 góc khung */}
            <span className="absolute -left-1 -top-1 h-10 w-10 rounded-tl-3xl border-l-4 border-t-4 border-white" />
            <span className="absolute -right-1 -top-1 h-10 w-10 rounded-tr-3xl border-r-4 border-t-4 border-white" />
            <span className="absolute -bottom-1 -left-1 h-10 w-10 rounded-bl-3xl border-b-4 border-l-4 border-white" />
            <span className="absolute -bottom-1 -right-1 h-10 w-10 rounded-br-3xl border-b-4 border-r-4 border-white" />
            {/* Đường quét chạy lên xuống — báo máy đang quét */}
            {!error && <span className="qr-scan-line absolute inset-x-4 h-0.5 rounded-full bg-white shadow-[0_0_12px_2px_rgba(255,255,255,0.7)]" />}
          </div>
          <p className="mt-6 px-6 text-center text-sm font-semibold drop-shadow">Đưa mã QR trên phiếu vào trong khung</p>
          <p className="mt-1 px-6 text-center text-xs text-white/75 drop-shadow">Máy tự nhận mã — không cần bấm chụp</p>
        </div>
        {error && <p className="absolute inset-x-4 top-4 rounded-md bg-danger-bg px-3 py-2 text-center text-sm text-danger-fg">{error}</p>}
      </div>

      {/* Hướng dẫn + nút */}
      <div className="space-y-4 px-6 pb-[max(20px,env(safe-area-inset-bottom))] pt-4">
        <ul className="space-y-1 text-xs text-white/80">
          <li>• Giữ máy cách phiếu khoảng 15–25 cm, mã QR nằm trọn trong khung.</li>
          <li>• Chỗ tối: bật <b>Đèn</b>. Mã trong ảnh đã lưu: bấm <b>Chọn ảnh</b>.</li>
          <li>• Nhận được mã: máy bíp + rung, tự mở đúng cont / phiếu.</li>
        </ul>
        <div className="flex justify-center gap-12">
          <button
            type="button"
            disabled={!flash.available}
            aria-label={flash.on ? 'Tắt đèn' : 'Bật đèn'}
            onClick={async () => {
              await scannerRef.current?.toggleFlash();
              setFlash((f) => ({ ...f, on: !f.on }));
            }}
            className={ctrlBtn}
          >
            <span className={ctrlIcon(flash.on)}><Flashlight className="h-6 w-6" /></span>
            {flash.available ? (flash.on ? 'Tắt đèn' : 'Đèn') : 'Không có đèn'}
          </button>
          <button type="button" disabled={picking} onClick={() => fileRef.current?.click()} aria-label="Chọn ảnh có mã QR" className={ctrlBtn}>
            <span className={ctrlIcon()}><ImageIcon className="h-6 w-6" /></span>
            {picking ? 'Đang đọc…' : 'Chọn ảnh'}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void scanFile(f);
          }}
        />
      </div>
    </div>
  );
};

// Nút camera đứng riêng (dùng trong form có sẵn — VD ô mã QR trả trước ở thanh toán)
export const CameraScanButton: React.FC<{ onResult: (code: string) => void; className?: string }> = ({ onResult, className }) => {
  const [camera, setCamera] = React.useState(false);
  const handle = React.useCallback(
    (code: string) => {
      setCamera(false);
      onResult(code);
    },
    [onResult]
  );
  const close = React.useCallback(() => setCamera(false), []);
  return (
    <>
      <button type="button" onClick={() => setCamera(true)} aria-label="Mở camera quét QR" className={className || `${primaryBtn} shrink-0 px-3`}>
        <Camera className="h-5 w-5" />
      </button>
      {camera && <CameraScanner onResult={handle} onClose={close} />}
    </>
  );
};

export const ScanField: React.FC<{
  value: string;
  onChange: (v: string) => void;
  onSubmit: (code: string) => void;
  placeholder: string;
  autoFocus?: boolean;
}> = ({ value, onChange, onSubmit, placeholder, autoFocus }) => {
  const onResult = React.useCallback(
    (code: string) => {
      onChange(code);
      onSubmit(code);
    },
    [onChange, onSubmit]
  );
  return (
    <form
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(value);
        }}
        className="flex gap-2"
      >
        <input
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          placeholder={placeholder}
          autoFocus={autoFocus}
          autoComplete="off"
          enterKeyHint="search"
          className={`${inputCls} font-mono uppercase`}
        />
        <CameraScanButton onResult={onResult} />
      </form>
  );
};
