import React, { useState } from 'react';
import { CheckCircle2, Circle, Clock, Search, Truck, X } from 'lucide-react';
import {
  FieldConditionClass,
  FieldStuffingClass,
  VesselListItem,
  VesselMode,
} from '../../types/depot';
import { DepotState } from '../../services/depotStore';
import { updateContainerLocation } from '../../services/depotOperations';
import {
  executeVesselExport,
  inspectVesselImportItem,
  openVesselLists,
  sortVesselItems,
  VesselFieldStep,
  vesselStepInfo,
  vesselStepSummary,
} from '../../services/vessel';
import { formatDateTime } from '../../services/datetime';
import { linkCls, EMPTY_SLOT, Feedback, inputCls, isSlotComplete, labelCls, primaryBtn, SlotPicker, SlotValue } from '../../components/shared';
import { ChoiceButtons } from './VesselShared';
import { EMPTY_INSPECTION, InspectionFields, InspectionValue, inspectionRemarks, isInspectionComplete } from '../../components/InspectionFields';

export type VesselFieldMode = 'GD_NHAP_TAU' | 'GD_XUAT_TAU' | 'XN_NHAP_TAU' | 'XN_XUAT_TAU';

const TITLES: Record<VesselFieldMode, { dept: string; name: string; mode: VesselMode; step: VesselFieldStep; action: string; doneWord: string }> = {
  GD_NHAP_TAU: { dept: 'Bộ phận Giám định', name: 'Nhập tàu', mode: 'NHAP_TAU', step: 'NT_INSPECT', action: 'Xác nhận cont nhập tàu', doneWord: 'giám định' },
  XN_NHAP_TAU: { dept: 'Bộ phận Xe nâng', name: 'Nhập tàu', mode: 'NHAP_TAU', step: 'NT_PLACE', action: 'Xác nhận hạ bãi', doneWord: 'hạ bãi' },
  GD_XUAT_TAU: { dept: 'Bộ phận Giám định', name: 'Xuất tàu', mode: 'XUAT_TAU', step: 'XT_EXPORT', action: 'Xác nhận xuất tàu', doneWord: 'xuất tàu' },
  XN_XUAT_TAU: { dept: 'Bộ phận Xe nâng', name: 'Xuất tàu', mode: 'XUAT_TAU', step: 'XT_EXPORT', action: 'Xác nhận xuất tàu', doneWord: 'xuất tàu' },
};
const PAGE = 15;
type Tab = 'TODO' | 'DONE' | 'ALL';

// MOBILE — NHẬP TÀU / XUẤT TÀU (DEC-069, DEC-071): tiến độ + "đã làm / chờ làm" rõ ràng cho từng bộ phận
export const VesselFieldMobile: React.FC<{
  kind: VesselFieldMode;
  state: DepotState;
  onUpdateState: (next: DepotState) => void;
  onOpenDossier?: (code: string) => void;
}> = ({ kind, state, onUpdateState, onOpenDossier }) => {
  const t = TITLES[kind];
  const isInspect = t.step === 'NT_INSPECT';
  const isPlace = t.step === 'NT_PLACE';
  const lists = openVesselLists(state, t.mode);
  const [listId, setListId] = useState('');
  const list = lists.find((l) => l.id === listId) || lists[0];
  const rows = list ? sortVesselItems(list.items).map((item) => ({ item, info: vesselStepInfo(state, t.step, item) })) : [];
  const sum = list ? vesselStepSummary(state, t.step, list) : undefined;

  const [tab, setTab] = useState<Tab>('TODO');
  const [code, setCode] = useState('');
  const [itemId, setItemId] = useState('');
  const [shown, setShown] = useState(PAGE);
  const [recent, setRecent] = useState<{ no: string; truck?: string; at: string; code?: string }[]>([]);
  const [truckNo, setTruckNo] = useState('');
  const [insp, setInsp] = useState<InspectionValue>(EMPTY_INSPECTION); // UI-02: form Giám định dùng chung
  const [slot, setSlot] = useState<SlotValue>(EMPTY_SLOT);
  const [error, setError] = useState<string | null>(null);

  const active = rows.find((r) => r.item.id === itemId && r.info.status === 'TODO');
  const item = active?.item;
  // Tìm như Tồn vỏ: lọc ngay khi gõ (số cont chứa chuỗi)
  const q = code.trim().toUpperCase();
  const tabRows = rows.filter((r) => tab === 'ALL' || (tab === 'DONE' ? r.info.status === 'DONE' : r.info.status !== 'DONE'));
  const shownRows = q && !item ? tabRows.filter((r) => r.item.containerNo.includes(q)) : tabRows;

  const resetForm = () => {
    setItemId('');
    setCode('');
    setTruckNo('');
    setInsp(EMPTY_INSPECTION);
    setSlot(EMPTY_SLOT);
  };

  const pick = (i: VesselListItem) => {
    resetForm();
    setError(null);
    setItemId(i.id);
    setCode(i.containerNo);
  };

  // Bấm tìm: đúng 1 cont khớp → mở; cont đã làm / chưa tới lượt → báo rõ, không cho làm trùng
  const lookup = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!q) return;
    const matches = rows.filter((r) => r.item.containerNo.includes(q) || r.item.dossierCode === q);
    const exact = rows.find((r) => r.item.containerNo === q || r.item.dossierCode === q);
    const hit = exact || (matches.length === 1 ? matches[0] : undefined);
    if (!hit) {
      setItemId('');
      if (matches.length > 1) {
        setTab('ALL');
        return setError(`Có ${matches.length} container khớp "${q}" — chọn trong danh sách bên dưới.`);
      }
      return setError(`Container "${q}" KHÔNG có trong danh sách tàu ${list?.vesselName || ''}. Kiểm tra lại số cont hoặc báo Văn phòng.`);
    }
    if (hit.info.status === 'DONE') {
      setItemId('');
      setTab('DONE');
      return setError(`${hit.item.containerNo} ĐÃ ${t.doneWord.toUpperCase()} — ${hit.info.by || ''} lúc ${formatDateTime(hit.info.at)}${hit.info.truckNo ? `, xe ${hit.info.truckNo}` : ''}. Không làm lại.`);
    }
    if (hit.info.status === 'WAIT') {
      setItemId('');
      return setError(`${hit.item.containerNo}: ${hit.info.note} — chưa tới lượt ${t.doneWord}.`);
    }
    pick(hit.item);
  };

  const remarks = inspectionRemarks(insp);
  const ready = Boolean(
    item &&
      (isPlace
        ? isSlotComplete(slot, state)
        : truckNo && (!isInspect || isInspectionComplete(insp)))
  );

  const confirm = () => {
    if (!item || !list) return;
    setError(null);
    try {
      let next: DepotState;
      if (isInspect) {
        next = inspectVesselImportItem(state, {
          listId: list.id, itemId: item.id, actualContainerNo: code, truckNo,
          conditionClass: insp.condition as FieldConditionClass, damageRemarks: remarks, stuffingClass: insp.stuffing as FieldStuffingClass,
          cleaningItems: insp.cleaning, manufactureYear: Number(insp.year),
        });
      } else if (isPlace) {
        next = updateContainerLocation(state, { containerNo: item.containerNo, ...slot, reason: `Xe nâng hạ cont NHẬP TÀU (tàu ${list.vesselName})` });
      } else {
        next = executeVesselExport(state, { listId: list.id, itemId: item.id, truckNo });
      }
      onUpdateState(next);
      const after = next.vesselLists.find((l) => l.id === list.id)!.items.find((i) => i.id === item.id)!;
      const info = vesselStepInfo(next, t.step, after);
      setRecent((prev) => [{ no: item.containerNo, truck: info.truckNo, at: info.at || new Date().toISOString(), code: after.dossierCode }, ...prev].slice(0, 5));
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi xác nhận');
    }
  };

  const pct = sum && sum.total ? Math.round((sum.done / sum.total) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-lg space-y-3 pb-16">
      <div className="flex items-center justify-between rounded-lg border border-line bg-white px-4 py-2.5">
        <div>
          <span className="block text-[11px] font-semibold uppercase text-ink-muted">{t.dept}</span>
          <h2 className="text-sm font-bold text-ink">{t.name}</h2>
        </div>
        <span className="rounded bg-navy-900 px-2.5 py-1 text-xs font-bold text-white" title="Số cont chờ làm">{sum?.todo ?? 0}</span>
      </div>

      {!list || !sum ? (
        <p className="rounded-lg border border-dashed border-line-strong bg-white p-8 text-center text-xs text-ink-muted">
          Chưa có danh sách {t.name.toLowerCase()} nào — chờ Văn phòng lập danh sách.
        </p>
      ) : (
        <>
          {/* TIẾN ĐỘ — luôn ở trên: tàu, xong / tổng, bạn đã làm, theo xe */}
          <div className="space-y-2 rounded-lg border border-line bg-white p-3 text-xs">
            {lists.length > 1 ? (
              <select value={list.id} onChange={(e) => { setListId(e.target.value); resetForm(); setError(null); }} className={`${inputCls} py-2 text-sm font-black`} aria-label="Chọn tàu">
                {lists.map((l) => {
                  const s = vesselStepSummary(state, t.step, l);
                  return <option key={l.id} value={l.id}>{l.vesselName} — xong {s.done}/{s.total}</option>;
                })}
              </select>
            ) : (
              <p className="text-sm font-black text-ink">Tàu {list.vesselName} <span className="font-mono text-[11px] font-normal text-ink-muted">{formatDateTime(list.plannedAt)}</span></p>
            )}
            <div className="flex items-end justify-between">
              <p>
                <span className="font-mono text-2xl font-black text-emerald-700">{sum.done}</span>
                <span className="font-mono text-base font-bold text-ink-muted"> / {sum.total}</span>
                <span className="ml-1 text-[11px] text-ink-muted">đã {t.doneWord}</span>
              </p>
              <p className="text-right text-[11px] text-ink-muted">
                Chờ làm <strong className="text-ink">{sum.todo}</strong>
                {sum.wait > 0 && <> • chưa tới lượt <strong className="text-amber-700">{sum.wait}</strong></>}
                <br />
                Bạn đã làm <strong className="text-navy-700">{sum.mine}</strong>
              </p>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-line">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
            </div>
            {!isPlace && sum.byTruck.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {sum.byTruck.map((b) => (
                  <span key={b.truckNo} className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] font-semibold ${b.count ? 'border-emerald-300 bg-emerald-50 text-emerald-800' : 'border-line text-ink-muted'}`}>
                    <Truck className="h-3 w-3" />
                    {b.truckNo}: {b.count}
                  </span>
                ))}
              </div>
            )}
          </div>

          {recent.length > 0 && (
            <div className="rounded-lg border border-emerald-300 bg-emerald-50 p-2.5 text-[11px] text-emerald-900">
              <p className="mb-1 font-bold uppercase">Vừa {t.doneWord}</p>
              <ul className="space-y-0.5">
                {recent.map((r, i) => (
                  <li key={`${r.no}-${i}`} className="flex flex-wrap items-center justify-between gap-1">
                    <span className="flex items-center gap-1 font-mono text-sm font-black"><CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />{r.no}</span>
                    <span>{r.truck ? `xe ${r.truck} • ` : ''}{formatDateTime(r.at).slice(11)}</span>
                    {r.code && <button type="button" onClick={() => onOpenDossier?.(r.code!)} className={linkCls}>{r.code}</button>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Feedback error={error} onClose={() => setError(null)} />

          <form onSubmit={lookup} className="space-y-2 rounded-lg border border-line bg-white p-3">
            <span className={labelCls}>{isInspect ? 'Số container về thực tế *' : 'Tìm số container'} (gõ vài số cuối để lọc)</span>
            <div className="flex gap-2">
              <input value={code} onChange={(e) => { setCode(e.target.value.toUpperCase()); if (item) setItemId(''); }} placeholder="TCLU1234567" className={`${inputCls} py-2.5 font-mono text-base font-bold uppercase`} />
              <button type="submit" className={`${primaryBtn} shrink-0`} aria-label="Tìm"><Search className="h-4 w-4" /></button>
            </div>
          </form>

          {item && (
            <div className="space-y-3 rounded-lg border-2 border-navy-900 bg-white p-3 text-xs">
              <div className="relative rounded-lg bg-navy-900 px-4 py-3 text-white">
                <button type="button" onClick={resetForm} aria-label="Bỏ chọn" className="absolute right-2 top-2 text-slate-300 hover:text-white"><X className="h-4 w-4" /></button>
                <p className="text-[11px] font-black uppercase text-amber-300">Đang tác nghiệp: {t.name} • Tàu {list.vesselName}</p>
                <p className="font-mono text-3xl font-black tracking-wider">{item.containerNo}</p>
                <p className="mt-1 text-sm font-bold">
                  {item.size} / {item.type}
                  {t.mode === 'XUAT_TAU' && <> • {item.conditionClass} • {item.stuffingClass} • <span className="font-mono">{item.locationAtList}</span></>}
                  {isPlace && <> • {item.conditionClass} • xe {item.truckNo}</>}
                </p>
              </div>

              {isPlace ? (
                <div className="space-y-1.5">
                  <span className="block text-xs font-bold text-ink">VỊ TRÍ HẠ *</span>
                  <SlotPicker state={state} value={slot} onChange={setSlot} />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <span className="block text-xs font-bold text-ink">SỐ XE *</span>
                  <ChoiceButtons options={list.truckNos} value={truckNo} onChange={setTruckNo} />
                </div>
              )}

              {isInspect && <InspectionFields value={insp} onChange={setInsp} />}

              <button type="button" onClick={confirm} disabled={!ready} className={`${primaryBtn} w-full py-3 text-sm`}>
                <CheckCircle2 className="h-4 w-4" />
                {t.action}
              </button>
            </div>
          )}

          {/* DANH SÁCH: Chờ làm / Đã xong / Tất cả — xếp size 20 → 40, số cont A→Z */}
          <div className="overflow-hidden rounded-lg border border-line bg-white">
            <div className="grid grid-cols-3 border-b border-line text-xs font-bold" role="tablist">
              {([
                ['TODO', `Chờ làm (${sum.todo + sum.wait})`],
                ['DONE', `Đã xong (${sum.done})`],
                ['ALL', `Tất cả (${sum.total})`],
              ] as [Tab, string][]).map(([k, lbl]) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => { setTab(k); setShown(PAGE); }}
                  className={`py-2.5 ${tab === k ? 'border-b-2 border-navy-900 text-navy-700' : 'text-ink-muted'}`}>
                  {lbl}
                </button>
              ))}
            </div>
            {shownRows.length === 0 ? (
              <p className="p-6 text-center text-xs text-ink-muted">
                {q ? `Không có cont khớp "${q}" trong mục này.` : tab === 'TODO' ? `Đã ${t.doneWord} hết danh sách — chờ Văn phòng duyệt.` : 'Chưa có cont nào.'}
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {shownRows.slice(0, shown).map(({ item: i, info }) => {
                  const mine = info.status === 'DONE' && info.by === state.currentUser.fullName;
                  const Icon = info.status === 'DONE' ? CheckCircle2 : info.status === 'WAIT' ? Clock : Circle;
                  return (
                    <li key={i.id}>
                      <button
                        type="button"
                        onClick={() => (info.status === 'TODO' ? pick(i) : i.dossierCode && info.status === 'DONE' ? onOpenDossier?.(i.dossierCode) : undefined)}
                        className={`flex w-full items-center gap-3 px-3 py-2.5 text-left text-xs ${
                          i.id === itemId ? 'bg-navy-50' : info.status === 'DONE' ? 'bg-emerald-50/50' : info.status === 'WAIT' ? 'bg-canvas text-ink-muted' : 'hover:bg-canvas'
                        }`}
                      >
                        <Icon className={`h-5 w-5 shrink-0 ${info.status === 'DONE' ? 'text-emerald-600' : info.status === 'WAIT' ? 'text-amber-500' : 'text-slate-300'}`} />
                        <span className="min-w-0 flex-1">
                          <span className={`block font-mono text-sm font-black ${info.status === 'DONE' ? 'text-emerald-800' : 'text-ink'}`}>{i.containerNo}</span>
                          <span className="block text-[11px] text-ink-muted">
                            {i.size}/{i.type}
                            {t.mode === 'XUAT_TAU' && i.locationAtList && info.status !== 'DONE' ? ` • ${i.locationAtList}` : ''}
                            {' • '}{info.note}
                          </span>
                        </span>
                        {info.status === 'DONE' && (
                          <span className="shrink-0 text-right text-[11px]">
                            {info.truckNo && <span className="block font-bold text-ink">{info.truckNo}</span>}
                            <span className={`block ${mine ? 'font-bold text-navy-700' : 'text-ink-muted'}`}>{mine ? 'Bạn' : info.by} • {formatDateTime(info.at).slice(11, 16)}</span>
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
            {shownRows.length > shown && (
              <button type="button" onClick={() => setShown(shown + PAGE)} className="w-full border-t border-line py-2.5 text-xs font-semibold text-navy-700">
                Xem thêm ({shownRows.length - shown})
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
};
