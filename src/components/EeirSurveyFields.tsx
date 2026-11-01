import React, { useState } from 'react';
import { Camera, Plus, X } from 'lucide-react';
import { EEIR_DAMAGE_SIDES, EEIR_DAMAGE_SOURCES, EEIR_DAMAGE_TYPES, EeirDamageSide, InspectionDamageItem, InspectionSurvey } from '../types/depot';
import {
  DAMAGE_NOTE_MAX,
  DAMAGE_PHOTO_MAX,
  damageItemProblem,
  damageSideLabel,
  damageTypeLabel,
  NO_DAMAGE_PHOTO_MAX,
  surveyCondition,
  WEAR_TEAR_PHOTO_MAX,
} from '../services/inspectionSurvey';
import { PhotoCamera } from './PhotoCamera';
import { inputCls, labelCls, primaryBtn, secondaryBtn } from './shared';

// ============================================================================
// DEC-203: TÌNH TRẠNG / HƯ HỎNG theo app eEIR Maersk (User Guide v3.3 trang 16–18) — dùng ở Giám định (cont MSK).
//   1 KHÔNG HƯ (ảnh) • 2 HAO MÒN (ảnh) • 3 HƯ DO BÊN THỨ 3 / XẾP DỠ: 7 mặt, mỗi chỗ hư = CEDEX + loại + bên gây hư + 1–3 ảnh.
// Chỉ là giao diện nhập — kiểm tra ở services/inspectionSurvey.ts (validateSurvey khi lưu).
// ============================================================================

const Thumbs: React.FC<{ photos: string[]; alt: string; onRemove: (i: number) => void }> = ({ photos, alt, onRemove }) =>
  photos.length ? (
    <div className="grid grid-cols-5 gap-1.5">
      {photos.map((p, i) => (
        <div key={i} className="relative aspect-square overflow-hidden rounded border border-line bg-canvas">
          <img src={p} alt={`${alt} ${i + 1}`} className="h-full w-full object-cover" />
          <button type="button" onClick={() => onRemove(i)} aria-label={`Xóa ${alt} ${i + 1}`} className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  ) : null;

const Group: React.FC<{ title: string; count?: string; children: React.ReactNode; testId?: string }> = ({ title, count, children, testId }) => (
  <div className="space-y-2 rounded-lg border border-line bg-white p-3" data-testid={testId}>
    <div className="flex items-center justify-between">
      <span className="text-xs font-bold text-ink">{title}</span>
      {count && <span className="font-mono text-[11px] text-ink-muted">{count}</span>}
    </div>
    {children}
  </div>
);

type CameraTarget = 'NO_DAMAGE' | 'WEAR_TEAR' | 'DAMAGE' | null;
const emptyDamage = (side: EeirDamageSide): InspectionDamageItem => ({ id: '', side, location: side, damageType: 0, source: 0, description: '', photos: [] });

export const EeirSurveyFields: React.FC<{
  value: InspectionSurvey;
  onChange: (s: InspectionSurvey) => void;
  hasDoorPhoto?: boolean; // ảnh cửa cont đã chụp ở bước 1 → tính vào nhóm KHÔNG HƯ
}> = ({ value: v, onChange, hasDoorPhoto = true }) => {
  const [camera, setCamera] = useState<CameraTarget>(null);
  const [draft, setDraft] = useState<InspectionDamageItem | null>(null);
  const noDamageMax = NO_DAMAGE_PHOTO_MAX - (hasDoorPhoto ? 1 : 0);
  const problem = draft ? damageItemProblem(draft) : null;
  const condition = surveyCondition(v);

  const saveDraft = () => {
    if (!draft || problem) return;
    const item = { ...draft, location: draft.location.toUpperCase(), id: draft.id || `dmg-${Date.now()}` };
    onChange({ ...v, damages: draft.id ? v.damages.map((d) => (d.id === draft.id ? item : d)) : [...v.damages, item] });
    setDraft(null);
  };

  return (
    <div className="space-y-2.5" data-testid="eeir-survey">
      <p className="rounded-md border border-line bg-canvas px-2.5 py-1.5 text-[11px] text-ink-muted">
        Ghi tình trạng theo eEIR Maersk. Trạng thái tự tính:{' '}
        <strong className={condition === 'DAMAGE' ? 'text-danger-fg' : 'text-success-fg'} data-testid="eeir-condition">{condition}</strong>
        {condition === 'AV' ? ' (không có hư do bên thứ 3)' : ' (có hư do bên thứ 3 → Báo giá)'}
      </p>

      <Group title="1. KHÔNG HƯ" count={`${(hasDoorPhoto ? 1 : 0) + v.noDamagePhotos.length}/${NO_DAMAGE_PHOTO_MAX} ảnh`} testId="eeir-no-damage">
        <p className="text-[11px] text-ink-muted">Ảnh cửa cont đã chụp được tính vào mục này. Chụp thêm ảnh cont tốt (VD bên trong) làm bằng chứng.</p>
        <Thumbs photos={v.noDamagePhotos} alt="Ảnh không hư" onRemove={(i) => onChange({ ...v, noDamagePhotos: v.noDamagePhotos.filter((_, k) => k !== i) })} />
        <button type="button" onClick={() => setCamera('NO_DAMAGE')} disabled={v.noDamagePhotos.length >= noDamageMax} className={`${secondaryBtn} w-full`}>
          <Camera className="h-4 w-4" />THÊM ẢNH
        </button>
      </Group>

      <Group title="2. HAO MÒN (Wear & Tear)" count={`${v.wearTearPhotos.length}/${WEAR_TEAR_PHOTO_MAX} ảnh`} testId="eeir-wear-tear">
        <p className="text-[11px] text-ink-muted">Hư do hao mòn tự nhiên — chỉ cần chụp ảnh, không ghi chi tiết.</p>
        <Thumbs photos={v.wearTearPhotos} alt="Ảnh hao mòn" onRemove={(i) => onChange({ ...v, wearTearPhotos: v.wearTearPhotos.filter((_, k) => k !== i) })} />
        <button type="button" onClick={() => setCamera('WEAR_TEAR')} disabled={v.wearTearPhotos.length >= WEAR_TEAR_PHOTO_MAX} className={`${secondaryBtn} w-full`}>
          <Camera className="h-4 w-4" />THÊM ẢNH
        </button>
      </Group>

      <Group title="3. HƯ DO BÊN THỨ 3 / XẾP DỠ" count={`${v.damages.length} chỗ hư`} testId="eeir-third-party">
        <ul className="divide-y divide-line rounded-md border border-line">
          {EEIR_DAMAGE_SIDES.map((s) => {
            const list = v.damages.filter((d) => d.side === s.code);
            return (
              <li key={s.code} className="px-2.5 py-1.5">
                <button type="button" onClick={() => setDraft(emptyDamage(s.code))} className="flex w-full items-center justify-between py-1 text-left text-xs font-semibold text-ink" aria-label={`Thêm hư ${s.label}`}>
                  <span className="inline-flex items-center gap-1.5"><Plus className="h-4 w-4 text-navy-700" />{s.label}</span>
                  <span className="font-mono text-ink-muted">{list.length}</span>
                </button>
                {list.map((d) => (
                  <div key={d.id} className="mt-1 flex items-center justify-between gap-2 rounded bg-danger-bg px-2 py-1 text-[11px]" data-testid="eeir-damage-item">
                    <button type="button" onClick={() => setDraft(d)} className="min-w-0 text-left">
                      <span className="font-mono font-bold text-danger-fg">{d.location}</span> {damageTypeLabel(d.damageType)} • {d.photos.length} ảnh
                    </button>
                    <button type="button" onClick={() => onChange({ ...v, damages: v.damages.filter((x) => x.id !== d.id) })} aria-label={`Xóa hư ${d.location}`} className="text-danger-fg">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </li>
            );
          })}
        </ul>
      </Group>

      {/* Màn CHI TIẾT HƯ (User Guide trang 17) — mỗi lần lưu 1 chỗ hư */}
      {draft && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-label={`Chi tiết hư ${damageSideLabel(draft.side)}`}>
          <div className="mx-auto w-full max-w-lg space-y-3 rounded-t-xl bg-white p-4 sm:rounded-xl" data-testid="eeir-damage-editor">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-ink">{damageSideLabel(draft.side)}</span>
              <button type="button" onClick={() => setDraft(null)} aria-label="Đóng" className="text-ink-muted"><X className="h-5 w-5" /></button>
            </div>
            <label className="block">
              <span className={labelCls}>Vị trí hư (CEDEX 4 ký tự) *</span>
              <div className="flex items-center gap-1">
                <span className="rounded-lg border border-line-strong bg-canvas px-3 py-2 font-mono text-sm font-bold">{draft.side}</span>
                <input
                  value={draft.location.slice(1)}
                  onChange={(e) => setDraft({ ...draft, location: draft.side + e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3) })}
                  maxLength={3}
                  placeholder="VD T89"
                  className={`${inputCls} font-mono uppercase`}
                />
              </div>
            </label>
            <label className="block">
              <span className={labelCls}>Loại hư *</span>
              <select value={draft.damageType || ''} onChange={(e) => setDraft({ ...draft, damageType: Number(e.target.value) })} className={inputCls}>
                <option value="">-- Chọn loại hư --</option>
                {EEIR_DAMAGE_TYPES.map((t) => <option key={t.code} value={t.code}>{t.code} — {t.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={labelCls}>Bên gây hư *</span>
              <select value={draft.source || ''} onChange={(e) => setDraft({ ...draft, source: Number(e.target.value) })} className={inputCls}>
                <option value="">-- Chọn bên gây hư --</option>
                {EEIR_DAMAGE_SOURCES.map((t) => <option key={t.code} value={t.code}>{t.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className={labelCls}>Mô tả</span>
              <input value={draft.description || ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} maxLength={DAMAGE_NOTE_MAX} className={inputCls} />
            </label>
            <div className="space-y-1.5">
              <span className={labelCls}>Ảnh chỗ hư * ({draft.photos.length}/{DAMAGE_PHOTO_MAX})</span>
              <Thumbs photos={draft.photos} alt="Ảnh chỗ hư" onRemove={(i) => setDraft({ ...draft, photos: draft.photos.filter((_, k) => k !== i) })} />
              <button type="button" onClick={() => setCamera('DAMAGE')} disabled={draft.photos.length >= DAMAGE_PHOTO_MAX} className={`${secondaryBtn} w-full`}>
                <Camera className="h-4 w-4" />CHỤP ẢNH CHỖ HƯ
              </button>
            </div>
            {problem && <p className="text-[11px] text-danger-fg">{problem}</p>}
            <button type="button" onClick={saveDraft} disabled={Boolean(problem)} className={`${primaryBtn} w-full py-3`}>LƯU CHỖ HƯ</button>
          </div>
        </div>
      )}

      {camera && (
        <PhotoCamera
          title={camera === 'NO_DAMAGE' ? 'Không hư' : camera === 'WEAR_TEAR' ? 'Hao mòn' : `Chỗ hư ${draft?.location || ''}`}
          count={camera === 'NO_DAMAGE' ? v.noDamagePhotos.length : camera === 'WEAR_TEAR' ? v.wearTearPhotos.length : draft?.photos.length || 0}
          max={camera === 'NO_DAMAGE' ? noDamageMax : camera === 'WEAR_TEAR' ? WEAR_TEAR_PHOTO_MAX : DAMAGE_PHOTO_MAX}
          onAdd={(p) => {
            if (camera === 'NO_DAMAGE') onChange({ ...v, noDamagePhotos: v.noDamagePhotos.length >= noDamageMax ? v.noDamagePhotos : [...v.noDamagePhotos, p] });
            else if (camera === 'WEAR_TEAR') onChange({ ...v, wearTearPhotos: v.wearTearPhotos.length >= WEAR_TEAR_PHOTO_MAX ? v.wearTearPhotos : [...v.wearTearPhotos, p] });
            else setDraft((d) => (d && d.photos.length < DAMAGE_PHOTO_MAX ? { ...d, photos: [...d.photos, p] } : d));
          }}
          onClose={() => setCamera(null)}
        />
      )}
    </div>
  );
};
