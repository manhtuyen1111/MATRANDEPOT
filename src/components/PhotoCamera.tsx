import React from 'react';
import { Camera, X, Zap, ZapOff } from 'lucide-react';
import { blobToDataUrl, compressToJpeg, fileToPhoto } from '../services/photo';

// ============================================================================
// MÀN CHỤP ẢNH TÁC NGHIỆP (DEC-176) — bố cục theo Camera iPhone:
//   trên: đèn (trái) • số ảnh (giữa) • đóng (phải)
//   giữa: khung ngắm toàn màn, chụm 2 ngón để zoom
//   dưới: ống kính 0.5 / 1× / 2× / 3× → ảnh vừa chụp (trái) • nút chụp tròn trắng (giữa) • Xong (phải)
// Chụp liên tục: mỗi lần bấm lấy khung hình ngay, nén < 200 KB chạy ngầm (không chặn nút chụp).
// Zoom xa 0.5: camera có zoom < 1 (Android) hoặc có camera góc siêu rộng (iPhone) — không có thì ẩn nút 0.5.
// Đèn: bật đèn liên tục khi máy / trình duyệt hỗ trợ (trình duyệt web không điều khiển được đèn nháy lúc chụp).
// ============================================================================

type ZoomCaps = { min: number; max: number; step?: number };
type TrackCaps = MediaTrackCapabilities & { zoom?: ZoomCaps; torch?: boolean };
type Constraint = MediaTrackConstraintSet & { zoom?: number; torch?: boolean };

const DIGITAL_MAX = 4; // zoom số khi camera không hỗ trợ zoom thật
const WIDE_LABEL = /ultra|siêu rộng|sieu rong|0[.,]5/i;

export const PhotoCamera: React.FC<{
  title: string;
  count: number; // số ảnh đã có
  max: number;
  lastPhoto?: string;
  onAdd: (dataUrl: string) => void;
  onClose: () => void;
}> = ({ title, count, max, lastPhoto, onAdd, onClose }) => {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);
  const [hwZoom, setHwZoom] = React.useState<ZoomCaps | null>(null);
  const [torch, setTorch] = React.useState<{ available: boolean; on: boolean }>({ available: false, on: false });
  const [wideId, setWideId] = React.useState<string | null>(null);
  const [usingWide, setUsingWide] = React.useState(false);
  const [zoom, setZoom] = React.useState(1);
  const [pinching, setPinching] = React.useState(false);
  const [pending, setPending] = React.useState(0);
  const [blink, setBlink] = React.useState(false);
  const total = count + pending;
  const full = total >= max;

  const stop = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };
  const track = () => streamRef.current?.getVideoTracks()[0];

  const start = React.useCallback(async (deviceId?: string) => {
    stop();
    setReady(false);
    const size = { width: { ideal: 1920 }, height: { ideal: 1440 } };
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: deviceId ? { deviceId: { exact: deviceId }, ...size } : { facingMode: { ideal: 'environment' }, ...size },
    });
    streamRef.current = stream;
    const v = videoRef.current;
    if (v) {
      v.srcObject = stream;
      await v.play().catch(() => undefined);
    }
    const caps = (stream.getVideoTracks()[0]?.getCapabilities?.() || {}) as TrackCaps;
    setHwZoom(caps.zoom && caps.zoom.max > caps.zoom.min ? caps.zoom : null);
    setTorch({ available: Boolean(caps.torch), on: false });
    setReady(true);
    return caps;
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('no-camera');
      const caps = await start();
      if (cancelled) return;
      // Không có zoom < 1 → tìm camera góc siêu rộng (iPhone tách riêng từng ống kính); tên chỉ đọc được sau khi cho phép camera
      if (!(caps.zoom && caps.zoom.min < 1)) {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const wide = devices.find((d) => d.kind === 'videoinput' && WIDE_LABEL.test(d.label) && !/front|trước|truoc/i.test(d.label));
        if (!cancelled && wide) setWideId(wide.deviceId);
      }
    })().catch(() => !cancelled && setError('Không mở được camera trong app. Kiểm tra quyền camera của trình duyệt, hoặc bấm "Dùng camera của máy".'));
    return () => {
      cancelled = true;
      stop();
    };
  }, [start]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Zoom: < 1 → ống kính siêu rộng; ≥ 1 → zoom thật của camera, không có thì zoom số (cắt giữa khung)
  const hwWide = Boolean(hwZoom && hwZoom.min < 1); // camera tự có zoom < 1 (Android nhiều ống kính)
  const minZoom = hwWide ? hwZoom!.min : wideId ? 0.5 : 1;
  const maxZoom = hwZoom ? Math.min(hwZoom.max, 10) : DIGITAL_MAX;
  const applyZoom = async (z: number) => {
    const next = Math.min(maxZoom, Math.max(minZoom, z));
    try {
      if (next < 1 && !hwWide && wideId) {
        if (!usingWide) {
          await start(wideId);
          setUsingWide(true);
        }
        setZoom(0.5);
        return;
      }
      if (usingWide && next >= 1) {
        await start();
        setUsingWide(false);
      }
      const t = track();
      const caps = (t?.getCapabilities?.() || {}) as TrackCaps;
      if (t && caps.zoom) await t.applyConstraints({ advanced: [{ zoom: Math.min(caps.zoom.max, Math.max(caps.zoom.min, next)) } as Constraint] });
      setZoom(next);
    } catch {
      /* máy không nhận mức zoom này — giữ mức cũ */
    }
  };
  const digital = !hwZoom && !usingWide && zoom > 1 ? zoom : 1;

  // Chụm 2 ngón để zoom (như iPhone)
  const pinch = React.useRef<{ dist: number; zoom: number } | null>(null);
  const raf = React.useRef(0);
  const distOf = (t: React.TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      pinch.current = { dist: distOf(e.touches), zoom };
      setPinching(true);
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!pinch.current || e.touches.length !== 2) return;
    const z = Math.round(pinch.current.zoom * (distOf(e.touches) / pinch.current.dist) * 10) / 10;
    cancelAnimationFrame(raf.current);
    // Chụm xuống dưới 1× chỉ khi camera tự zoom được (đổi sang ống kính siêu rộng thì bấm nút .5)
    raf.current = requestAnimationFrame(() => void applyZoom(hwWide ? z : Math.max(1, z)));
  };
  const onTouchEnd = () => {
    pinch.current = null;
    setPinching(false);
  };

  const toggleTorch = async () => {
    const t = track();
    if (!t || !torch.available) return;
    try {
      await t.applyConstraints({ advanced: [{ torch: !torch.on } as Constraint] });
      setTorch((x) => ({ ...x, on: !x.on }));
    } catch {
      setTorch({ available: false, on: false });
    }
  };

  // Chụp: lấy khung hình ngay (đồng bộ), nén ngầm → thêm ảnh
  const shoot = () => {
    const v = videoRef.current;
    if (!v || !v.videoWidth || full) return;
    navigator.vibrate?.(12);
    setBlink(true);
    window.setTimeout(() => setBlink(false), 90);
    const w = v.videoWidth;
    const h = v.videoHeight;
    const frame = document.createElement('canvas');
    frame.width = Math.round(w / digital);
    frame.height = Math.round(h / digital);
    frame.getContext('2d')!.drawImage(v, (w - frame.width) / 2, (h - frame.height) / 2, frame.width, frame.height, 0, 0, frame.width, frame.height);
    setPending((n) => n + 1);
    compressToJpeg(frame, frame.width, frame.height)
      .then(blobToDataUrl)
      .then(onAdd)
      .catch(() => setError('Không lưu được ảnh vừa chụp — chụp lại.'))
      .finally(() => setPending((n) => n - 1));
  };

  // Dự phòng: mở camera của hệ điều hành (máy không cho trình duyệt dùng camera)
  const onFiles = async (files: FileList | null) => {
    for (const f of Array.from(files || []).slice(0, Math.max(0, max - total))) {
      setPending((n) => n + 1);
      try {
        onAdd(await fileToPhoto(f));
      } catch {
        setError('Không đọc được ảnh vừa chụp — chụp lại.');
      } finally {
        setPending((n) => n - 1);
      }
    }
  };

  const lenses = [...(minZoom < 1 ? [0.5] : []), 1, 2, ...(maxZoom >= 3 ? [3] : [])];
  const activeLens = lenses.reduce((a, b) => (Math.abs(b - zoom) < Math.abs(a - zoom) ? b : a), 1);
  const zoomLabel = (z: number) => String(Math.round(z * 10) / 10).replace(/^0\./, '.');

  return (
    <div className="fixed inset-0 z-[80] flex select-none flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex items-center justify-between px-4 pb-2 pt-[max(12px,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={toggleTorch}
          disabled={!torch.available}
          aria-label={torch.on ? 'Tắt đèn' : 'Bật đèn'}
          className={`flex h-9 w-9 items-center justify-center rounded-full ${torch.on ? 'bg-amber-300 text-black' : 'bg-white/15'} disabled:opacity-30`}
        >
          {torch.on ? <Zap className="h-5 w-5" /> : <ZapOff className="h-5 w-5" />}
        </button>
        <span className="text-center leading-tight">
          <span className="block text-[11px] font-semibold uppercase text-white/70">{title}</span>
          <span className={`font-mono text-sm font-bold ${full ? 'text-amber-300' : ''}`} data-testid="photo-count">{total}/{max}</span>
        </span>
        <button type="button" onClick={onClose} aria-label="Đóng camera" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex-1 touch-none overflow-hidden" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" style={digital > 1 ? { transform: `scale(${digital})` } : undefined} />
        {blink && <span className="pointer-events-none absolute inset-0 bg-black/60" />}
        {pinching && (
          <span className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-black/50 px-3 py-1 font-mono text-lg font-bold text-amber-300">
            {zoom.toFixed(1)}×
          </span>
        )}
        {full && <p className="absolute inset-x-4 top-3 rounded-md bg-black/60 px-3 py-2 text-center text-sm font-semibold text-amber-300">Đã đủ {max} ảnh — bấm Xong.</p>}
        {error && (
          <div className="absolute inset-x-4 top-3 space-y-2 rounded-md bg-danger-bg px-3 py-2 text-center text-sm text-danger-fg">
            <p>{error}</p>
            {!ready && (
              <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-md bg-navy-900 px-3 py-2 text-xs font-bold text-white">
                <Camera className="h-4 w-4" />
                Dùng camera của máy
              </button>
            )}
          </div>
        )}
        {ready && (
          <div className="absolute inset-x-0 bottom-3 flex justify-center">
            <div className="flex items-center gap-1.5 rounded-full bg-black/40 p-1" aria-label="Ống kính">
              {lenses.map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => void applyZoom(z)}
                  aria-label={`Zoom ${z}x`}
                  className={`flex h-9 w-9 items-center justify-center rounded-full font-mono text-[11px] font-bold ${
                    z === activeLens ? 'bg-white/25 text-amber-300' : 'bg-black/30 text-white'
                  }`}
                >
                  {z === activeLens ? `${zoomLabel(zoom)}×` : zoomLabel(z)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 items-center px-6 pb-[max(20px,env(safe-area-inset-bottom))] pt-4">
        <button type="button" onClick={onClose} aria-label="Xem ảnh đã chụp" className="relative h-12 w-12 justify-self-start overflow-hidden rounded-lg border border-white/40 bg-white/10">
          {lastPhoto && <img src={lastPhoto} alt="Ảnh vừa chụp" className="h-full w-full object-cover" />}
          {total > 0 && <span className="absolute right-0 top-0 rounded-bl-md bg-amber-300 px-1 font-mono text-[10px] font-bold text-black">{total}</span>}
        </button>
        <button
          type="button"
          onClick={ready ? shoot : () => fileRef.current?.click()}
          disabled={full}
          aria-label="Chụp ảnh"
          className="flex h-[76px] w-[76px] items-center justify-center justify-self-center rounded-full border-4 border-white disabled:opacity-40"
        >
          <span className="h-[60px] w-[60px] rounded-full bg-white transition-transform active:scale-90" />
        </button>
        <button type="button" onClick={onClose} disabled={pending > 0} className="justify-self-end text-base font-semibold text-amber-300 disabled:opacity-60">
          {pending > 0 ? 'Đang lưu…' : 'Xong'}
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const files = e.target.files;
          void onFiles(files).finally(() => (e.target.value = ''));
        }}
      />
    </div>
  );
};
