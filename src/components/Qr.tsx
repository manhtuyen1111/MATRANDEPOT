import React from 'react';
import { Camera, Flashlight, X } from 'lucide-react';
import { inputCls, primaryBtn } from './shared';

// MÃ QR TÁC NGHIỆP (DEC-057): mã QR THẬT (không phải hình minh họa) + quét bằng camera / súng quét cầm tay.
//   QrImage   — vẽ mã QR từ chuỗi (VD QR-HV-261028-001). Mã ngắn → ô QR thưa, to → quét rất nhanh.
//   ScanField — ô nhập + nút camera. Quét được (camera hoặc súng quét gõ + Enter) → tự tra mã ngay.
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

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-black" role="dialog" aria-modal="true" aria-label="Quét mã QR">
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <span className="text-sm font-semibold">Đưa mã QR vào khung</span>
        <div className="flex gap-2">
          {flash.available && (
            <button
              type="button"
              aria-label={flash.on ? 'Tắt đèn' : 'Bật đèn'}
              onClick={async () => {
                await scannerRef.current?.toggleFlash();
                setFlash((f) => ({ ...f, on: !f.on }));
              }}
              className={`rounded-md p-2 ${flash.on ? 'bg-white text-black' : 'bg-white/15'}`}
            >
              <Flashlight className="h-5 w-5" />
            </button>
          )}
          <button type="button" onClick={onClose} aria-label="Đóng camera" className="rounded-md bg-white/15 p-2">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      <div className="relative flex-1 overflow-hidden">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        {/* Khung ngắm */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-[min(65vw,260px)] w-[min(65vw,260px)] rounded-2xl border-4 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
        </div>
        {error && <p className="absolute inset-x-4 bottom-6 rounded-md bg-danger-bg px-3 py-2 text-center text-sm text-danger-fg">{error}</p>}
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
  submitLabel?: string;
}> = ({ value, onChange, onSubmit, placeholder, autoFocus, submitLabel = 'Quét' }) => {
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
        <button type="submit" className={`${primaryBtn} shrink-0`}>{submitLabel}</button>
        <CameraScanButton onResult={onResult} />
      </form>
  );
};
