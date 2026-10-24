import React from 'react';
import {
  CLEANING_ITEM_OPTIONS,
  DAMAGE_QUICK_SUGGESTIONS,
  FieldCleaningItem,
  FieldConditionClass,
  FieldStuffingClass,
} from '../types/depot';
import { normalizeCleaningItems } from '../services/depotOperations';

// ============================================================================
// FORM GIÁM ĐỊNH DÙNG CHUNG (UI-02): Trạng thái DAMAGE / AV → Đóng hàng M / K / E → Vệ sinh → AGE
// Dùng ở Giám định → Hạ vỏ và Giám định → Nhập tàu. Chỉ là giao diện nhập liệu —
// quy tắc bắt buộc vẫn do service kiểm tra (recordGateInFieldStep, inspectVesselImportItem).
// ============================================================================
export interface InspectionValue {
  condition: FieldConditionClass | '';
  damage: string[];      // lỗi chọn nhanh
  damageNote: string;    // ghi chú thêm (phân cách dấu phẩy)
  stuffing: FieldStuffingClass | '';
  cleaning: FieldCleaningItem[];
  year: string;          // AGE — 4 chữ số
}

export const EMPTY_INSPECTION: InspectionValue = { condition: '', damage: [], damageNote: '', stuffing: '', cleaning: [], year: '' };

const QUICK_YEARS = [2001, 2002, 2005, 2008, 2010, 2012, 2015, 2017, 2018, 2019, 2020, 2022];

// Danh sách hư hỏng gửi service (lỗi chọn nhanh + ghi chú thêm)
export function inspectionRemarks(v: InspectionValue): string[] {
  return [...v.damage, ...v.damageNote.split(',').map((s) => s.trim()).filter(Boolean)];
}

export function isInspectionYearValid(year: string): boolean {
  const n = Number(year);
  return /^\d{4}$/.test(year.trim()) && n >= 1980 && n <= new Date().getFullYear() + 1;
}

export function isInspectionDamageValid(v: InspectionValue): boolean {
  return v.condition !== 'DAMAGE' || inspectionRemarks(v).length > 0;
}

// Đã nhập đủ 4 mục bắt buộc (để bật nút tiếp tục) — service vẫn kiểm tra lại khi xác nhận
export function isInspectionComplete(v: InspectionValue): boolean {
  return Boolean(v.condition && isInspectionDamageValid(v) && v.stuffing && v.cleaning.length > 0 && isInspectionYearValid(v.year));
}

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-1.5 rounded-lg border border-slate-200 bg-white p-3">
    <span className="block text-xs font-bold text-slate-800">{title}</span>
    {children}
  </div>
);

const choiceCls = (on: boolean, onCls = 'border-blue-600 bg-blue-600 text-white') =>
  `rounded-lg border py-2.5 text-sm font-bold transition ${on ? onCls : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`;

export const InspectionFields: React.FC<{
  value: InspectionValue;
  onChange: (v: InspectionValue) => void;
  // true: hiện lần lượt — xong mục trước mới hiện mục sau (Giám định → Hạ vỏ)
  progressive?: boolean;
}> = ({ value: v, onChange, progressive }) => {
  const set = (patch: Partial<InspectionValue>) => onChange({ ...v, ...patch });
  const toggleCleaning = (item: FieldCleaningItem) => {
    if (item === 'KHÔNG VỆ SINH') return set({ cleaning: ['KHÔNG VỆ SINH'] });
    const rest = v.cleaning.filter((x) => x !== 'KHÔNG VỆ SINH');
    set({ cleaning: rest.includes(item) ? rest.filter((x) => x !== item) : normalizeCleaningItems([...rest, item]) });
  };
  const step1 = Boolean(v.condition && isInspectionDamageValid(v));
  const show2 = !progressive || step1;
  const show3 = !progressive || (step1 && Boolean(v.stuffing));
  const show4 = !progressive || (step1 && Boolean(v.stuffing) && v.cleaning.length > 0);

  return (
    <div className="space-y-3">
      <Section title="1. TRẠNG THÁI : DAMAGE / AV *">
        <div className="grid grid-cols-2 gap-2">
          {(['AV', 'DAMAGE'] as FieldConditionClass[]).map((cls) => (
            <button
              key={cls}
              type="button"
              onClick={() => set({ condition: cls })}
              className={choiceCls(v.condition === cls, cls === 'DAMAGE' ? 'border-rose-600 bg-rose-600 text-white' : 'border-emerald-600 bg-emerald-600 text-white')}
            >
              {cls}
            </button>
          ))}
        </div>
        {v.condition === 'DAMAGE' && (
          <div className="mt-2 space-y-2 rounded-lg border border-rose-200 bg-rose-50/40 p-2.5">
            <p className="text-xs font-semibold text-rose-900">Chọn lỗi hư hỏng hoặc nhập ghi chú *:</p>
            <div className="flex flex-wrap gap-1.5">
              {DAMAGE_QUICK_SUGGESTIONS.map((d) => {
                const on = v.damage.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => set({ damage: on ? v.damage.filter((x) => x !== d) : [...v.damage, d] })}
                    className={`rounded border px-2 py-1 text-xs font-medium ${on ? 'border-rose-600 bg-rose-600 text-white' : 'border-slate-300 bg-white text-slate-700'}`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={v.damageNote}
              onChange={(e) => set({ damageNote: e.target.value })}
              placeholder="Ghi chú thêm hư hỏng..."
              className="w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs"
            />
          </div>
        )}
      </Section>

      {show2 && (
        <Section title="2. PHÂN LOẠI ĐÓNG HÀNG : M / K / E *">
          <div className="grid grid-cols-3 gap-2">
            {(['M', 'K', 'E'] as FieldStuffingClass[]).map((s) => (
              <button key={s} type="button" onClick={() => set({ stuffing: s })} className={choiceCls(v.stuffing === s)}>
                {s}
              </button>
            ))}
          </div>
        </Section>
      )}

      {show3 && (
        <Section title="3. TÌNH TRẠNG VỆ SINH (chọn 1 hoặc nhiều phương án) *">
          <div className="grid grid-cols-2 gap-1.5">
            {CLEANING_ITEM_OPTIONS.map((item) => {
              const on = v.cleaning.includes(item);
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleCleaning(item)}
                  className={`flex items-center justify-between rounded-lg border px-2.5 py-2 text-left text-xs font-semibold transition ${
                    on ? 'border-blue-600 bg-blue-50 text-blue-900' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span>{item}</span>
                  {on && <span className="font-bold text-blue-600">✓</span>}
                </button>
              );
            })}
          </div>
        </Section>
      )}

      {show4 && (
        <Section title="4. AGE (Năm sản xuất cont: 2001, 2002...) *">
          <input
            type="number"
            inputMode="numeric"
            min={1980}
            value={v.year}
            onChange={(e) => set({ year: e.target.value })}
            placeholder="Chọn nhanh bên dưới hoặc nhập 4 chữ số..."
            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm font-bold text-slate-900"
          />
          <div className="grid grid-cols-6 gap-1">
            {QUICK_YEARS.map((yr) => (
              <button
                key={yr}
                type="button"
                onClick={() => set({ year: String(yr) })}
                className={`rounded border py-1.5 font-mono text-xs font-semibold ${
                  Number(v.year) === yr ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-slate-50 text-slate-700'
                }`}
              >
                {yr}
              </button>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
};
