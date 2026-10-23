import React, { useState } from 'react';
import { CheckCircle2, Search, X } from 'lucide-react';
import {
  CLEANING_ITEM_OPTIONS,
  DAMAGE_QUICK_SUGGESTIONS,
  FieldCleaningItem,
  FieldConditionClass,
  FieldStuffingClass,
  VesselListItem,
  VesselMode,
} from '../../types/depot';
import { DepotState } from '../../services/depotStore';
import { executeVesselExport, inspectVesselImportItem, openVesselLists } from '../../services/vessel';
import { Feedback, inputCls, labelCls, primaryBtn } from '../../components/shared';
import { ChoiceButtons, VesselProgressPanel } from './VesselShared';

export type VesselFieldMode = 'GD_NHAP_TAU' | 'GD_XUAT_TAU' | 'XN_XUAT_TAU';

const TITLES: Record<VesselFieldMode, { dept: string; name: string; mode: VesselMode }> = {
  GD_NHAP_TAU: { dept: 'Bộ phận Giám định', name: 'Nhập tàu', mode: 'NHAP_TAU' },
  GD_XUAT_TAU: { dept: 'Bộ phận Giám định', name: 'Xuất tàu', mode: 'XUAT_TAU' },
  XN_XUAT_TAU: { dept: 'Bộ phận Xe nâng', name: 'Xuất tàu', mode: 'XUAT_TAU' },
};
const QUICK_YEARS = [2005, 2008, 2010, 2012, 2015, 2017, 2018, 2019, 2020, 2021, 2022, 2023];
const PAGE = 10;

// MOBILE — NHẬP TÀU (Giám định xác nhận cont về) / XUẤT TÀU (Giám định, Xe nâng chọn cont + gán xe) — DEC-069
export const VesselFieldMobile: React.FC<{
  kind: VesselFieldMode;
  state: DepotState;
  onUpdateState: (next: DepotState) => void;
  onOpenDossier?: (code: string) => void;
}> = ({ kind, state, onUpdateState, onOpenDossier }) => {
  const title = TITLES[kind];
  const isImport = title.mode === 'NHAP_TAU';
  const lists = openVesselLists(state, title.mode);
  const [listId, setListId] = useState('');
  const list = lists.find((l) => l.id === listId) || lists[0];
  const pending = list ? list.items.filter((i) => i.status === 'PENDING') : [];
  const [code, setCode] = useState('');
  const [itemId, setItemId] = useState('');
  const item = pending.find((i) => i.id === itemId);
  const [shown, setShown] = useState(PAGE);
  const [truckNo, setTruckNo] = useState('');
  const [condition, setCondition] = useState<FieldConditionClass | ''>('');
  const [damage, setDamage] = useState<string[]>([]);
  const [damageNote, setDamageNote] = useState('');
  const [stuffing, setStuffing] = useState<FieldStuffingClass | ''>('');
  const [cleaning, setCleaning] = useState<FieldCleaningItem[]>([]);
  const [year, setYear] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const reset = () => {
    setItemId('');
    setCode('');
    setTruckNo('');
    setCondition('');
    setDamage([]);
    setDamageNote('');
    setStuffing('');
    setCleaning([]);
    setYear('');
  };

  const pick = (i: VesselListItem) => {
    reset();
    setError(null);
    setSuccess(null);
    setItemId(i.id);
    setCode(i.containerNo);
  };

  const lookup = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    const no = code.trim().toUpperCase();
    const found = pending.find((i) => i.containerNo === no || i.dossierCode === no);
    if (!found) {
      setItemId('');
      return setError(`Container "${no}" không có trong danh sách ${title.name.toLowerCase()} đang chờ${list ? ` của tàu ${list.vesselName}` : ''}.`);
    }
    pick(found);
  };

  const toggleCleaning = (c: FieldCleaningItem) => {
    if (c === 'KHÔNG VỆ SINH') return setCleaning(['KHÔNG VỆ SINH']);
    const rest = cleaning.filter((x) => x !== 'KHÔNG VỆ SINH');
    setCleaning(rest.includes(c) ? rest.filter((x) => x !== c) : [...rest, c]);
  };

  const remarks = [...damage, ...damageNote.split(',').map((s) => s.trim()).filter(Boolean)];
  const ready = Boolean(
    item && truckNo && (!isImport || (condition && (condition === 'AV' || remarks.length > 0) && stuffing && cleaning.length > 0 && /^\d{4}$/.test(year)))
  );

  const confirm = () => {
    if (!item || !list) return;
    setError(null);
    setSuccess(null);
    try {
      const next = isImport
        ? inspectVesselImportItem(state, {
            listId: list.id,
            itemId: item.id,
            actualContainerNo: code,
            truckNo,
            conditionClass: condition as FieldConditionClass,
            damageRemarks: remarks,
            stuffingClass: stuffing as FieldStuffingClass,
            cleaningItems: cleaning,
            manufactureYear: Number(year),
          })
        : executeVesselExport(state, { listId: list.id, itemId: item.id, truckNo });
      onUpdateState(next);
      const done = next.vesselLists.find((l) => l.id === list.id)!.items.find((i) => i.id === item.id)!;
      setSuccess(
        isImport
          ? `Đã xác nhận ${item.containerNo} — hồ sơ ${done.dossierCode} → ${cleaning.some((c) => c !== 'KHÔNG VỆ SINH') ? 'chờ VỆ SINH' : 'chờ XE NÂNG hạ'}.`
          : `Đã XUẤT TÀU ${item.containerNo} (xe ${truckNo}) — cont đã OUT khỏi bãi.`
      );
      reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi xác nhận');
    }
  };

  return (
    <div className="mx-auto w-full max-w-lg space-y-3 pb-16">
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-2.5">
        <div>
          <span className="block text-[11px] font-semibold uppercase text-slate-500">{title.dept}</span>
          <h2 className="text-sm font-bold text-slate-900">{title.name}</h2>
        </div>
        <span className="rounded bg-slate-900 px-2.5 py-1 text-xs font-bold text-white">{pending.length}</span>
      </div>
      <Feedback error={error} success={success} onClose={() => (setError(null), setSuccess(null))} />

      {!list ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-xs text-slate-500">
          Chưa có danh sách {title.name.toLowerCase()} nào — chờ Văn phòng lập danh sách.
        </p>
      ) : (
        <>
          {lists.length > 1 && (
            <label className="block rounded-lg border border-slate-200 bg-white p-3">
              <span className={labelCls}>Tàu</span>
              <select value={list.id} onChange={(e) => { setListId(e.target.value); reset(); }} className={`${inputCls} py-2.5 text-sm font-bold`}>
                {lists.map((l) => <option key={l.id} value={l.id}>{l.vesselName}</option>)}
              </select>
            </label>
          )}

          <form onSubmit={lookup} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
            <span className={labelCls}>{isImport ? 'Số container về thực tế *' : 'Số container xuất tàu'} — tàu {list.vesselName}</span>
            <div className="flex gap-2">
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="TCLU1234567" className={`${inputCls} py-2.5 font-mono text-base font-bold uppercase`} />
              <button type="submit" className={`${primaryBtn} shrink-0`}><Search className="h-4 w-4" /></button>
            </div>
          </form>

          {item && (
            <div className="space-y-3 rounded-lg border-2 border-blue-600 bg-white p-3 text-xs">
              <div className="relative rounded-lg bg-slate-900 px-4 py-3 text-white">
                <button type="button" onClick={reset} aria-label="Bỏ chọn" className="absolute right-2 top-2 text-slate-300 hover:text-white"><X className="h-4 w-4" /></button>
                <p className="font-mono text-3xl font-black tracking-wider">{item.containerNo}</p>
                <p className="mt-1 text-sm font-bold">
                  {item.size} / {item.type}
                  {!isImport && <> • {item.conditionClass} • {item.stuffingClass} • <span className="font-mono">{item.locationAtList}</span></>}
                </p>
              </div>

              <div className="space-y-1.5">
                <span className="block text-xs font-bold text-slate-800">SỐ XE *</span>
                <ChoiceButtons options={list.truckNos} value={truckNo} onChange={setTruckNo} />
              </div>

              {isImport && (
                <>
                  <div className="space-y-1.5">
                    <span className="block text-xs font-bold text-slate-800">TRẠNG THÁI : DAMAGE / AV *</span>
                    <ChoiceButtons
                      options={['AV', 'DAMAGE'] as const}
                      value={condition}
                      onChange={setCondition}
                      tone={(v) => (v === 'DAMAGE' ? 'border-rose-600 bg-rose-600 text-white' : 'border-emerald-600 bg-emerald-600 text-white')}
                    />
                    {condition === 'DAMAGE' && (
                      <div className="space-y-2 rounded-lg border border-rose-200 bg-rose-50/40 p-2.5">
                        <div className="flex flex-wrap gap-1.5">
                          {DAMAGE_QUICK_SUGGESTIONS.map((d) => (
                            <button key={d} type="button" onClick={() => setDamage(damage.includes(d) ? damage.filter((x) => x !== d) : [...damage, d])}
                              className={`rounded border px-2 py-1 text-xs font-medium ${damage.includes(d) ? 'border-rose-600 bg-rose-600 text-white' : 'border-slate-300 bg-white text-slate-700'}`}>
                              {d}
                            </button>
                          ))}
                        </div>
                        <input value={damageNote} onChange={(e) => setDamageNote(e.target.value)} placeholder="Ghi chú thêm hư hỏng..." className={inputCls} />
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <span className="block text-xs font-bold text-slate-800">PHÂN LOẠI ĐÓNG HÀNG : M / K / E *</span>
                    <ChoiceButtons options={['M', 'K', 'E'] as const} value={stuffing} onChange={setStuffing} cols={3} />
                  </div>
                  <div className="space-y-1.5">
                    <span className="block text-xs font-bold text-slate-800">TÌNH TRẠNG VỆ SINH (chọn 1 hoặc nhiều) *</span>
                    <div className="grid grid-cols-2 gap-1.5">
                      {CLEANING_ITEM_OPTIONS.map((c) => {
                        const on = cleaning.includes(c);
                        return (
                          <button key={c} type="button" onClick={() => toggleCleaning(c)}
                            className={`flex items-center justify-between rounded-lg border px-2.5 py-2 text-left text-xs font-semibold ${on ? 'border-blue-600 bg-blue-50 text-blue-900' : 'border-slate-300 bg-white text-slate-700'}`}>
                            <span>{c}</span>{on && <span className="font-bold text-blue-600">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <span className="block text-xs font-bold text-slate-800">AGE (năm sản xuất: 2001, 2002...) *</span>
                    <input type="number" inputMode="numeric" value={year} onChange={(e) => setYear(e.target.value)} placeholder="Nhập 4 chữ số..." className={`${inputCls} py-2.5 font-mono text-sm font-bold`} />
                    <div className="grid grid-cols-6 gap-1">
                      {QUICK_YEARS.map((y) => (
                        <button key={y} type="button" onClick={() => setYear(String(y))}
                          className={`rounded border py-1.5 font-mono text-[11px] font-bold ${year === String(y) ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white text-slate-700'}`}>
                          {y}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              <button type="button" onClick={confirm} disabled={!ready} className={`${primaryBtn} w-full py-3 text-sm`}>
                <CheckCircle2 className="h-4 w-4" />
                {isImport ? 'Xác nhận cont nhập tàu' : 'Xác nhận xuất tàu'}
              </button>
            </div>
          )}

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            <p className="border-b border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700">Đang chờ ({pending.length})</p>
            {pending.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-500">Đã xong hết danh sách — chờ Văn phòng duyệt.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {pending.slice(0, shown).map((i) => (
                  <li key={i.id}>
                    <button type="button" onClick={() => pick(i)} className={`flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-xs ${i.id === itemId ? 'bg-blue-50' : 'hover:bg-slate-50'}`}>
                      <span className="font-mono text-sm font-bold text-slate-900">{i.containerNo}</span>
                      <span className="text-slate-600">{i.size}/{i.type}</span>
                      {!isImport && <span className="font-mono text-[11px] text-slate-500">{i.locationAtList}</span>}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {pending.length > shown && (
              <button type="button" onClick={() => setShown(shown + PAGE)} className="w-full border-t border-slate-200 py-2.5 text-xs font-semibold text-blue-700">
                Xem thêm ({pending.length - shown})
              </button>
            )}
          </div>

          {isImport && list.items.some((i) => i.dossierCode) && (
            <div className="rounded-lg border border-slate-200 bg-white p-3 text-[11px] text-slate-600">
              <p className="mb-1 font-bold uppercase">Đã giám định</p>
              <ul className="space-y-0.5">
                {list.items.filter((i) => i.dossierCode).slice(0, 5).map((i) => (
                  <li key={i.id} className="flex justify-between gap-2">
                    <button type="button" onClick={() => onOpenDossier?.(i.dossierCode!)} className="font-mono text-blue-700 hover:underline">{i.dossierCode}</button>
                    <span className="font-mono">{i.containerNo}</span>
                    <span>{i.status === 'DONE' ? 'Đã hạ bãi' : 'Chờ vệ sinh / hạ'}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}

      <VesselProgressPanel lists={lists} mode={title.mode} selectedId={list?.id} onSelect={(id) => { setListId(id); reset(); }} />
    </div>
  );
};
