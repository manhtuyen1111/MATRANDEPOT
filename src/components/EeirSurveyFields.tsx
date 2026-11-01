import React, { useState } from 'react';
import { Camera, Plus, X } from 'lucide-react';
import { EEIR_DAMAGE_SIDES, EEIR_DAMAGE_SOURCES, EEIR_DAMAGE_TYPES, EeirDamageSide, InspectionDamageItem, InspectionSurvey } from '../types/depot';
import {
  DAMAGE_NOTE_MAX,
  DAMAGE_PHOTO_MAX,
  damageItemProblem,
  damageSideLabel,
  cedexGrid,
  cedexLocation,
  ContainerLength,
  SURVEY_SIZES,
  surveyLength,
  damageTypeLabel,
  DEFAULT_DAMAGE_SOURCE,
  DEFAULT_DAMAGE_TYPE,
  fixedDamageLocation,
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

// SƠ ĐỒ LƯỚI VỊ TRÍ (như app eEIR): chạm ô để chọn / bỏ — mã CEDEX tự tính (cedexLocation, services/inspectionSurvey.ts).
//   Vách / nóc / đáy / sàn: số ô theo SIZE CONT Giám định chọn trước (20' → 5 ô, 40' / 45' → 10 ô).
export const CedexGridPicker: React.FC<{ side: EeirDamageSide; location: string; length?: ContainerLength; onChange: (location: string) => void }> = ({
  side,
  location,
  length = '40',
  onChange,
}) => {
  const [cells, setCells] = useState<string[]>([]); // "hàng:cột"
  const grid = cedexGrid(side, length);
  if (!grid) return null;
  const toggle = (row: string, col: number) => {
    const key = `${row}:${col}`;
    const next = cells.includes(key) ? cells.filter((c) => c !== key) : [...cells, key];
    setCells(next);
    onChange(cedexLocation(side, next.map((c) => c.split(':')[0]), next.map((c) => Number(c.split(':')[1]))) || side);
  };
  const doorCols = side === 'D' || side === 'F';
  const colTemplate = doorCols ? '1fr 3fr 3fr 1fr' : `repeat(${grid.cols}, minmax(0, 1fr))`;
  return (
    <div className="space-y-1.5" data-testid="cedex-grid">
      <div className="grid gap-px border border-ink bg-ink" style={{ gridTemplateColumns: colTemplate }}>
        {grid.rows.map((r) =>
          Array.from({ length: grid.cols }, (_, i) => {
            const col = i + 1;
            const on = cells.includes(`${r.code}:${col}`);
            return (
              <button
                key={`${r.code}${col}`}
                type="button"
                onClick={() => toggle(r.code, col)}
                aria-label={`Ô ${r.code}${col % 10}`}
                aria-pressed={on}
                className={`${r.thin ? 'h-5' : 'h-11'} text-[9px] font-mono ${on ? 'bg-accent text-white' : 'bg-white text-ink-muted'}`}
              >
                {r.thin ? '' : `${r.code}${col % 10}`}
              </button>
            );
          })
        )}
      </div>
      <div className="rounded-lg border border-line bg-canvas px-3 py-2">
        <span className={labelCls}>Vị trí hư *</span>
        <span className="font-mono text-sm font-bold" data-testid="cedex-location">{location.length === 4 ? location : 'Chạm ô trên sơ đồ'}</span>
      </div>
    </div>
  );
};

type CameraTarget = 'NO_DAMAGE' | 'WEAR_TEAR' | 'DAMAGE' | null;
// Như app eEIR: mặc định Bẩn (Dirty) + Khách hàng; mặt E / I / N / X vị trí cố định <mặt>XXX
const emptyDamage = (side: EeirDamageSide): InspectionDamageItem => ({
  id: '', side, location: fixedDamageLocation(side) || side, damageType: DEFAULT_DAMAGE_TYPE, source: DEFAULT_DAMAGE_SOURCE, description: '', photos: [],
});

export const EeirSurveyFields: React.FC<{
  value: InspectionSurvey;
  onChange: (s: InspectionSurvey) => void;
  hasDoorPhoto?: boolean; // ảnh cửa cont đã chụp ở bước 1 → tính vào nhóm KHÔNG HƯ (Nhập tàu: không có — DEC-156)
  fixedSize?: string;     // Nhập tàu: size theo danh sách tàu — không cho chọn
}> = ({ value: v, onChange, hasDoorPhoto = true, fixedSize }) => {
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

      {/* Người dùng 2026-11-01: chọn SIZE CONT trước khi giám định — quyết định số ô sơ đồ (20' 5 ô, 40' / 45' 10 ô) */}
      <Group title="SIZE CONT *" testId="eeir-size">
        {fixedSize ? (
          <p className="font-mono text-sm font-bold text-ink" data-testid="eeir-fixed-size">{fixedSize}' <span className="font-sans text-[11px] font-normal text-ink-muted">(theo danh sách tàu)</span></p>
        ) : (
        <div className="grid grid-cols-3 gap-2">
          {SURVEY_SIZES.map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => onChange({ ...v, size })}
              aria-pressed={v.size === size}
              className={`rounded-lg border py-2.5 text-sm font-bold ${v.size === size ? 'border-navy-900 bg-navy-900 text-white' : 'border-line-strong bg-white text-ink hover:bg-canvas'}`}
            >
              {size}'
            </button>
          ))}
        </div>
        )}
        {!v.size && <p className="text-[11px] text-ink-muted">Chọn size cont trước để giám định.</p>}
      </Group>

      {v.size && (
      <>
      <Group title="1. KHÔNG HƯ" count={`${(hasDoorPhoto ? 1 : 0) + v.noDamagePhotos.length}/${NO_DAMAGE_PHOTO_MAX} ảnh`} testId="eeir-no-damage">
        <p className="text-[11px] text-ink-muted">{hasDoorPhoto ? 'Ảnh cửa cont đã chụp được tính vào mục này. ' : ''}Chụp ảnh cont tốt (VD cửa, bên trong) làm bằng chứng.</p>
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
      </>
      )}

      {/* Màn CHI TIẾT HƯ (User Guide trang 17) — mỗi lần lưu 1 chỗ hư */}
      {draft && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" role="dialog" aria-label={`Chi tiết hư ${damageSideLabel(draft.side)}`}>
          <div className="mx-auto w-full max-w-lg space-y-3 rounded-t-xl bg-white p-4 sm:rounded-xl" data-testid="eeir-damage-editor">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-ink">{damageSideLabel(draft.side)}</span>
              <button type="button" onClick={() => setDraft(null)} aria-label="Đóng" className="text-ink-muted"><X className="h-5 w-5" /></button>
            </div>
            {fixedDamageLocation(draft.side) ? (
              <div className="rounded-lg border border-line bg-canvas px-3 py-2">
                <span className={labelCls}>Vị trí hư</span>
                <span className="font-mono text-sm font-bold" data-testid="eeir-fixed-location">{draft.location}</span>
              </div>
            ) : (
              <CedexGridPicker side={draft.side} location={draft.location} length={surveyLength(v.size)} onChange={(location) => setDraft({ ...draft, location })} />
            )}
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
              <textarea value={draft.description || ''} onChange={(e) => setDraft({ ...draft, description: e.target.value })} maxLength={DAMAGE_NOTE_MAX} rows={3} className={inputCls} />
              <span className="block text-right font-mono text-[11px] text-ink-muted">{(draft.description || '').length}/{DAMAGE_NOTE_MAX}</span>
            </label>
            {/* Như app eEIR: 3 ô ảnh — ô trống bấm để chụp, ô có ảnh bấm X để xóa */}
            <div className="space-y-1.5">
              <span className={labelCls}>Ảnh chỗ hư * ({draft.photos.length}/{DAMAGE_PHOTO_MAX})</span>
              <div className="grid grid-cols-3 gap-1.5" data-testid="eeir-damage-photos">
                {Array.from({ length: DAMAGE_PHOTO_MAX }, (_, i) =>
                  draft.photos[i] ? (
                    <div key={i} className="relative aspect-square overflow-hidden rounded border border-line bg-canvas">
                      <img src={draft.photos[i]} alt={`Ảnh chỗ hư ${i + 1}`} className="h-full w-full object-cover" />
                      <button type="button" onClick={() => setDraft({ ...draft, photos: draft.photos.filter((_, k) => k !== i) })} aria-label={`Xóa ảnh chỗ hư ${i + 1}`} className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button key={i} type="button" onClick={() => setCamera('DAMAGE')} aria-label={`Chụp ảnh chỗ hư ${i + 1}`} className="flex aspect-square items-center justify-center rounded border border-line-strong bg-white text-ink-muted hover:bg-canvas">
                      <Camera className="h-7 w-7" />
                    </button>
                  )
                )}
              </div>
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
