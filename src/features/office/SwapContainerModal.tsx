import React, { useMemo, useState } from 'react';
import { Repeat, X } from 'lucide-react';
import { SWAP_REASON_LABELS, SwapReason } from '../../types/depot';
import { DepotState } from '../../services/depotStore';
import { swapGateOutContainer } from '../../services/api';
import { swapCandidates } from '../../services/depotOperations';
import { CONTAINER_SEARCH_HINT, matchContainerNo } from '../../services/containerSearch';
import { ContainerNo, inputCls, labelCls, LocationText, primaryBtn, secondaryBtn } from '../../components/shared';

const SHOW_MAX = 20; // danh sách cont thay thế: gõ số seri để lọc, chỉ hiện 20 cont đầu

// DEC-185: ĐỔI CONTAINER — cont đã cấp ra, đang chờ TRẢ CHỨNG TỪ CẤP VỎ. Bắt buộc chọn 1 trong 2 lý do + cont thay thế.
// Giữ lệnh CV-, chứng từ, phiếu thu, QR phiếu K80; cont cũ về hàng chờ Xe nâng HẠ LẠI.
export const SwapContainerModal: React.FC<{
  state: DepotState;
  gateOutOrderId: string;
  onClose: () => void;
  onDone: (next: DepotState, message: string) => void;
}> = ({ state, gateOutOrderId, onClose, onDone }) => {
  const order = state.gateOutOrders.find((o) => o.id === gateOutOrderId);
  const [reason, setReason] = useState<SwapReason | null>(null);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const candidates = useMemo(() => swapCandidates(state, gateOutOrderId), [state, gateOutOrderId]);
  const shown = candidates.filter((c) => matchContainerNo(c.containerNo, query)).slice(0, SHOW_MAX);
  if (!order) return null;

  const submit = () => {
    setError(null);
    if (!reason) return setError('Vui lòng chọn lý do ĐỔI CONTAINER.');
    if (!picked) return setError('Vui lòng chọn container thay thế.');
    try {
      const next = swapGateOutContainer(state, { gateOutOrderId, reason, newContainerNo: picked, note });
      onDone(
        next,
        `Đã đổi ${order.containerNo} → ${picked} (${order.gateOutCode}). Xe nâng: hạ lại ${order.containerNo}${reason === 'DAMAGE' ? ' (khu sửa chữa)' : ''} và cấp ${picked}.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không đổi được container');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4" role="dialog" aria-modal="true" aria-label="Đổi container">
      <div className="my-4 w-full max-w-xl space-y-4 rounded-lg bg-white p-5 text-xs shadow-xl">
        <div className="flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
            <Repeat className="h-4 w-4" />
            Đổi container — {order.gateOutCode}
          </h2>
          <button type="button" onClick={onClose} aria-label="Đóng" className={secondaryBtn}><X className="h-3.5 w-3.5" /></button>
        </div>

        <dl className="grid grid-cols-3 gap-2 rounded-md border border-line bg-canvas p-3">
          <div><dt className={labelCls}>Container đang cấp</dt><dd><ContainerNo no={order.containerNo} /></dd></div>
          <div><dt className={labelCls}>Booking</dt><dd className="font-mono font-semibold">{order.bookingNo}</dd></div>
          <div><dt className={labelCls}>Số xe</dt><dd className="font-semibold">{order.truckNo}</dd></div>
        </dl>

        <fieldset className="space-y-2">
          <legend className={labelCls}>Lý do (bắt buộc chọn 1)</legend>
          {(Object.keys(SWAP_REASON_LABELS) as SwapReason[]).map((r, i) => (
            <label key={r} className={`flex cursor-pointer items-start gap-2 rounded-md border px-3 py-2 ${reason === r ? 'border-navy-700 bg-navy-50' : 'border-line'}`}>
              <input type="radio" name="swap-reason" checked={reason === r} onChange={() => setReason(r)} className="mt-0.5" />
              <span>
                <span className="font-bold text-ink">{i + 1}. {SWAP_REASON_LABELS[r]}</span>
                <span className="block text-ink-muted">
                  {r === 'KEN_VO'
                    ? 'Xe nâng hạ lại cont, chọn vị trí mới — cont tồn bãi, cấp được cho khách khác.'
                    : 'Cont chuyển DAMAGE (PHÁT SINH CẤP VỎ) — Xe nâng hạ khu sửa chữa, hạ xong vào Chờ báo giá.'}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className="space-y-2">
          <label className={labelCls} htmlFor="swap-search">Container thay thế (cùng hãng tàu / size / type — {candidates.length} cont sẵn sàng)</label>
          <input id="swap-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={CONTAINER_SEARCH_HINT} className={`${inputCls} font-mono uppercase`} />
          {shown.length === 0 ? (
            <p className="text-ink-muted">Không có container sẵn sàng phù hợp.</p>
          ) : (
            <ul className="max-h-56 divide-y divide-line overflow-y-auto rounded-md border border-line">
              {shown.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => setPicked(c.containerNo)}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-canvas ${picked === c.containerNo ? 'bg-navy-50 font-bold' : ''}`}
                  >
                    <ContainerNo no={c.containerNo} />
                    <span className="text-ink-muted">{c.size}{c.type} • {c.conditionClass}{c.stuffingClass ? ` • ${c.stuffingClass}` : ''}</span>
                    <LocationText loc={c} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <label className={labelCls} htmlFor="swap-note">Ghi chú (không bắt buộc)</label>
          <input id="swap-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={reason === 'DAMAGE' ? 'VD: thủng sàn, rách vách…' : ''} className={inputCls} />
        </div>

        {error && <p className="rounded-md bg-danger-bg px-3 py-2 font-semibold text-danger-fg">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={secondaryBtn}>Hủy</button>
          <button type="button" onClick={submit} disabled={!reason || !picked} className={primaryBtn}>
            <Repeat className="h-3.5 w-3.5" />
            XÁC NHẬN ĐỔI CONTAINER{picked ? ` → ${picked}` : ''}
          </button>
        </div>
      </div>
    </div>
  );
};
