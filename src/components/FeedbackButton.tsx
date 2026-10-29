import React, { useState } from 'react';
import { submitFeedback } from '../services/api';
import { MessageSquarePlus, Send, X } from 'lucide-react';
import type { DepotState } from '../services/depotStore';
import { FEEDBACK_MAX_LENGTH, FEEDBACK_OTHER_MENU, FEEDBACK_STATUS_LABELS, myFeedbacks } from '../services/feedback';
import { formatDateTime } from '../services/datetime';
import { Feedback, inputCls, labelCls, primaryBtn } from './shared';
import type { FeedbackStatus } from '../types/depot';

export interface FeedbackMenuOption {
  id: string;
  label: string;   // "Menu chính → Tính năng" (dùng cho báo cáo / lưu)
  group?: string;  // DEC-123: MENU CHÍNH
  item?: string;   // DEC-123: TÍNH NĂNG trong menu
}

const OTHER_GROUP = 'Khác';

export const FEEDBACK_STATUS_STYLE: Record<FeedbackStatus, string> = {
  MOI: 'bg-navy-50 text-navy-900',
  DANG_XU_LY: 'bg-amber-100 text-amber-800',
  DA_XU_LY: 'bg-emerald-100 text-emerald-800',
  KHONG_AP_DUNG: 'bg-line text-ink',
};

export const FeedbackStatusBadge: React.FC<{ status: FeedbackStatus }> = ({ status }) => (
  <span className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold ${FEEDBACK_STATUS_STYLE[status]}`}>{FEEDBACK_STATUS_LABELS[status]}</span>
);

// DEC-120: form góp ý + danh sách "Góp ý của tôi" (trạng thái + phản hồi của Admin)
export const FeedbackPanel: React.FC<{
  state: DepotState;
  onUpdateState: (next: DepotState) => void;
  menuOptions: FeedbackMenuOption[];
}> = ({ state, onUpdateState, menuOptions }) => {
  const options: FeedbackMenuOption[] = [...menuOptions, { id: FEEDBACK_OTHER_MENU, label: OTHER_GROUP, group: OTHER_GROUP, item: OTHER_GROUP }];
  // DEC-123: chọn MENU CHÍNH trước → TÍNH NĂNG trong menu → mới nhập nội dung
  const groups = Array.from(new Set(options.map((o) => o.group || o.label)));
  const [group, setGroup] = useState('');
  const items = options.filter((o) => (o.group || o.label) === group);
  const [menuId, setMenuId] = useState('');
  const [content, setContent] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const mine = myFeedbacks(state);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      const label = options.find((o) => o.id === menuId)?.label || '';
      const next = submitFeedback(state, { menuId, menuLabel: label, content });
      onUpdateState(next);
      setSuccess(`Đã gửi góp ý ${next.feedbacks[0].code}. Cảm ơn bạn!`);
      setContent('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không gửi được góp ý.');
    }
  };

  return (
    <div className="space-y-3 text-xs">
      <Feedback error={error} success={success} onClose={() => (setError(null), setSuccess(null))} />
      <form onSubmit={submit} className="space-y-2">
        <label className="block">
          <span className={labelCls}>1. Menu chính *</span>
          <select
            value={group}
            onChange={(e) => {
              const g = e.target.value;
              setGroup(g);
              const only = options.filter((o) => (o.group || o.label) === g);
              setMenuId(only.length === 1 ? only[0].id : ''); // menu chỉ có 1 tính năng (VD: Khác) → chọn sẵn
            }}
            className={inputCls}
            aria-label="Menu góp ý"
          >
            <option value="">-- Chọn menu --</option>
            {groups.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        {group && (
          <label className="block">
            <span className={labelCls}>2. Tính năng *</span>
            <select value={menuId} onChange={(e) => setMenuId(e.target.value)} className={inputCls} aria-label="Tính năng góp ý">
              <option value="">-- Chọn tính năng --</option>
              {items.map((o) => <option key={o.id} value={o.id}>{o.item || o.label}</option>)}
            </select>
          </label>
        )}
        {menuId && (
          <label className="block">
            <span className={labelCls}>3. Nội dung góp ý *</span>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} maxLength={FEEDBACK_MAX_LENGTH} className={inputCls} placeholder="Mô tả vấn đề hoặc đề xuất của bạn" />
          </label>
        )}
        <button type="submit" disabled={!menuId || !content.trim()} className={`${primaryBtn} w-full py-2.5`}>
          <Send className="h-4 w-4" />
          Gửi góp ý
        </button>
      </form>
      <div className="border-t border-line pt-3">
        <p className="mb-2 font-bold text-ink">Góp ý của tôi ({mine.length})</p>
        {mine.length === 0 ? (
          <p className="text-ink-muted">Chưa có góp ý nào.</p>
        ) : (
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {mine.map((f) => (
              <li key={f.id} className="rounded-md border border-line p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold">{f.code}</span>
                  <FeedbackStatusBadge status={f.status} />
                </div>
                <p className="text-[11px] text-ink-muted">{f.menuLabel} • {formatDateTime(f.createdAt)}</p>
                <p className="mt-1 whitespace-pre-wrap text-ink">{f.content}</p>
                {f.response && <p className="mt-1 rounded bg-canvas p-1.5 text-ink"><strong>Phản hồi:</strong> {f.response}</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

// Nút "Góp ý" góc trên bên phải → mở cửa sổ góp ý
export const FeedbackButton: React.FC<{
  state: DepotState;
  onUpdateState: (next: DepotState) => void;
  menuOptions: FeedbackMenuOption[];
}> = (props) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Góp ý" title="Góp ý" className="inline-flex h-8 min-w-8 items-center justify-center gap-1 rounded-md border border-line-strong bg-navy-50 px-2 font-semibold text-navy-700 hover:bg-navy-50" data-testid="feedback-button">
        <MessageSquarePlus className="h-4 w-4" />
        <span className="hidden sm:inline">Góp ý</span>
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40 p-3" role="dialog" aria-modal="true" aria-label="Góp ý">
          <div className="w-full max-w-md space-y-3 rounded-lg bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-sm font-bold"><MessageSquarePlus className="h-4 w-4 text-navy-700" />Góp ý xây dựng hệ thống</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Đóng" className="text-ink-muted hover:text-ink"><X className="h-4 w-4" /></button>
            </div>
            <FeedbackPanel {...props} />
          </div>
        </div>
      )}
    </>
  );
};
