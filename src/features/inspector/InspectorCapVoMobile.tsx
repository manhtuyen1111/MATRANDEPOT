import React, { useState } from 'react';
import { Camera, CheckCircle2, X } from 'lucide-react';
import { recordReleasePhotos } from '../../services/api';
import { DepotState } from '../../services/depotStore';
import { formatDateTime } from '../../services/datetime';
import { pendingReleasePhotos, RELEASE_PHOTO_MAX, RELEASE_PHOTO_MIN, releaseContainerOf } from '../../services/releasePhoto';
import { PhotoCamera } from '../../components/PhotoCamera';
import { ContainerNo, Feedback, labelCls, linkCls, primaryBtn } from '../../components/shared';
import { QueueHeader, QueueListRow } from '../field-queues/FieldQueueWorkspaces';

// GIÁM ĐỊNH → CẤP VỎ (DEC-198): cont MSK Xe nâng đã cấp lên xe → chụp 1–30 ảnh cấp vỏ → Văn phòng mới trả chứng từ.
export const InspectorCapVoMobile: React.FC<{
  state: DepotState;
  onUpdateState: (s: DepotState) => void;
  onOpenDossier?: (code: string) => void;
}> = ({ state, onUpdateState, onOpenDossier }) => {
  const queue = pendingReleasePhotos(state);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const order = queue.find((o) => o.id === selectedId);
  const container = order ? releaseContainerOf(state, order) : undefined;

  const select = (id: string) => {
    setSelectedId(id);
    setPhotos([]);
    setError(null);
    setSuccess(null);
  };

  const confirm = () => {
    if (!order) return;
    try {
      onUpdateState(recordReleasePhotos(state, { gateOutOrderId: order.id, photos }));
      setSuccess(`Đã chụp ${photos.length} ảnh cấp vỏ cont ${order.containerNo}. Lái xe về Văn phòng trả chứng từ.`);
      setSelectedId(null);
      setPhotos([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được ảnh cấp vỏ.');
    }
  };

  return (
    <div className="mx-auto w-full max-w-lg space-y-3 pb-16">
      <QueueHeader dept="Bộ phận Giám định" name="Cấp vỏ" count={queue.length} />
      <Feedback error={error} success={success} onClose={() => (setError(null), setSuccess(null))} />

      {order && (
        <div className="space-y-3 rounded-lg border border-line bg-white p-4" data-testid="release-photo-form">
          <div className="flex items-start justify-between gap-2">
            <ContainerNo no={order.containerNo} className="text-2xl" />
            <button type="button" onClick={() => setSelectedId(null)} aria-label="Đóng" className="rounded p-1 text-ink-muted hover:bg-canvas">
              <X className="h-5 w-5" />
            </button>
          </div>
          <dl className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md border border-line bg-canvas px-3 py-2">
              <dt className="text-ink-muted">Size / Type</dt>
              <dd className="font-semibold">{container ? `${container.size}/${container.type}` : '-'}</dd>
            </div>
            <div className="rounded-md border border-line bg-canvas px-3 py-2">
              <dt className="text-ink-muted">Số xe</dt>
              <dd className="font-semibold">{order.truckNo || '-'}</dd>
            </div>
            <div className="rounded-md border border-line bg-canvas px-3 py-2">
              <dt className="text-ink-muted">{order.releasePurpose === 'SALE' ? 'Sale code' : 'Booking'}</dt>
              <dd className="font-mono font-semibold">{(order.releasePurpose === 'SALE' ? order.saleCode : order.bookingNo) || '-'}</dd>
            </div>
            <div className="rounded-md border border-line bg-canvas px-3 py-2">
              <dt className="text-ink-muted">Hồ sơ</dt>
              <dd>
                <button type="button" onClick={() => onOpenDossier?.(order.gateOutCode)} className={linkCls}>{order.gateOutCode}</button>
              </dd>
            </div>
          </dl>

          <span className={labelCls}>Ảnh cấp vỏ * ({photos.length}/{RELEASE_PHOTO_MAX})</span>
          <button type="button" onClick={() => setCameraOpen(true)} disabled={photos.length >= RELEASE_PHOTO_MAX} className={`${primaryBtn} w-full py-3`}>
            <Camera className="h-5 w-5" />
            CHỤP ẢNH CẤP VỎ
          </button>
          {photos.length > 0 && (
            <div className="grid grid-cols-4 gap-1.5">
              {photos.map((p, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded border border-line bg-canvas">
                  <img src={p} alt={`Ảnh cấp vỏ ${i + 1}`} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setPhotos((prev) => prev.filter((_, k) => k !== i))}
                    aria-label={`Xóa ảnh ${i + 1}`}
                    className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
          {cameraOpen && (
            <PhotoCamera
              title="Cấp vỏ"
              count={photos.length}
              max={RELEASE_PHOTO_MAX}
              lastPhoto={photos[photos.length - 1]}
              onAdd={(p) => setPhotos((prev) => (prev.length >= RELEASE_PHOTO_MAX ? prev : [...prev, p]))}
              onClose={() => setCameraOpen(false)}
            />
          )}
          <button type="button" onClick={confirm} disabled={photos.length < RELEASE_PHOTO_MIN} className={`${primaryBtn} w-full py-3`}>
            <CheckCircle2 className="h-4 w-4" />
            Xác nhận đã chụp
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-line bg-white">
        <p className="px-4 py-3 text-xs font-bold text-ink">Chờ chụp ảnh cấp vỏ ({queue.length})</p>
        <ul className="divide-y divide-line border-t border-line" data-testid="release-photo-queue">
          {queue.length === 0 ? (
            <li className="p-6 text-center text-xs text-ink-muted">Không có cont nào chờ chụp ảnh cấp vỏ.</li>
          ) : (
            queue.map((o) => {
              const c = releaseContainerOf(state, o);
              return c ? (
                <li key={o.id}>
                  <QueueListRow state={state} container={c} label="CẤP VỎ" extra={`Xe ${o.truckNo || '-'} • OUT ${formatDateTime(o.confirmedAt)}`} onClick={() => select(o.id)} />
                </li>
              ) : null;
            })
          )}
        </ul>
      </div>
    </div>
  );
};
