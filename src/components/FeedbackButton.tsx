import React, { useState } from 'react';
import { MessageSquarePlus, Send, X } from 'lucide-react';
import type { DepotState } from '../services/depotStore';
import { FEEDBACK_MAX_LENGTH, FEEDBACK_OTHER_MENU, FEEDBACK_STATUS_LABELS, myFeedbacks, submitFeedback } from '../services/feedback';
import { formatDateTime } from '../services/datetime';
import { Feedback, inputCls, labelCls, primaryBtn } from './shared';
import type { FeedbackStatus } from '../types/depot';

export interface FeedbackMenuOption {
  id: string;
  label: string;
}

export const FEEDBACK_STATUS_STYLE: Record<FeedbackStatus, string> = {
  MOI: 'bg-blue-100 text-blue-800',
  DANG_XU_LY: 'bg-amber-100 text-amber-800',
  DA_XU_LY: 'bg-emerald-100 text-emerald-800',
  KHONG_AP_DUNG: 'bg-slate-200 text-slate-700',
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
  const options = [...menuOptions, { id: FEEDBACK_OTHER_MENU, label: 'Khác' }];
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
          <span className={labelCls}>Menu / tính năng *</span>
          <select value={menuId} onChange={(e) => setMenuId(e.target.value)} className={inputCls} aria-label="Menu góp ý">
            <option value="">-- Chọn --</option>
            {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className={labelCls}>Nội dung góp ý *</span>
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} maxLength={FEEDBACK_MAX_LENGTH} className={inputCls} placeholder="Mô tả vấn đề hoặc đề xuất của bạn" />
        </label>
        <button type="submit" disabled={!menuId || !content.trim()} className={`${primaryBtn} w-full py-2.5`}>
          <Send className="h-4 w-4" />
          Gửi góp ý
        </button>
      </form>
      <div className="border-t border-slate-200 pt-3">
        <p className="mb-2 font-bold text-slate-800">Góp ý của tôi ({mine.length})</p>
        {mine.length === 0 ? (
          <p className="text-slate-500">Chưa có góp ý nào.</p>
        ) : (
          <ul className="max-h-64 space-y-2 overflow-y-auto">
            {mine.map((f) => (
              <li key={f.id} className="rounded-md border border-slate-200 p-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono font-bold">{f.code}</span>
                  <FeedbackStatusBadge status={f.status} />
                </div>
                <p className="text-[11px] text-slate-500">{f.menuLabel} • {formatDateTime(f.createdAt)}</p>
                <p className="mt-1 whitespace-pre-wrap text-slate-800">{f.content}</p>
                {f.response && <p className="mt-1 rounded bg-slate-50 p-1.5 text-slate-700"><strong>Phản hồi:</strong> {f.response}</p>}
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
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-1 font-semibold text-blue-700 hover:bg-blue-100" data-testid="feedback-button">
        <MessageSquarePlus className="h-3.5 w-3.5" />
        Góp ý
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-black/40 p-3" role="dialog" aria-modal="true" aria-label="Góp ý">
          <div className="w-full max-w-md space-y-3 rounded-lg bg-white p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-sm font-bold"><MessageSquarePlus className="h-4 w-4 text-blue-700" />Góp ý xây dựng hệ thống</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="Đóng" className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
            </div>
            <FeedbackPanel {...props} />
          </div>
        </div>
      )}
    </>
  );
};
