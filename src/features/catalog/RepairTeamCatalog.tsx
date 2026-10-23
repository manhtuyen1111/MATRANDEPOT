import React, { useState } from 'react';
import { Plus, Users, Wrench } from 'lucide-react';
import { DepotState } from '../../services/depotStore';
import {
  addRepairTeam,
  addRepairTeamMember,
  setRepairTeamActive,
  setRepairTeamMemberActive,
} from '../../services/depotOperations';
import { hasRolePermission } from '../../services/permissions';
import { Feedback, inputCls, labelCls, primaryBtn, secondaryBtn, SectionCard } from '../../components/shared';

// DANH MỤC CHUNG — SỬA CHỮA: tổ sửa chữa & thành viên (DEC-042). Chỉ ADMIN cấu hình, vai trò khác xem.
export const RepairTeamCatalog: React.FC<{ state: DepotState; onUpdateState: (next: DepotState) => void }> = ({
  state,
  onUpdateState,
}) => {
  const isAdmin = hasRolePermission(state.currentUser, ['ADMIN']);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [memberDraft, setMemberDraft] = useState<Record<string, string>>({});
  const [userDraft, setUserDraft] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const run = (fn: () => DepotState, message: string): boolean => {
    setError(null);
    setSuccess(null);
    try {
      onUpdateState(fn());
      setSuccess(message);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Thao tác thất bại');
      return false;
    }
  };

  return (
    <div className="space-y-4">
      <Feedback error={error} success={success} onClose={() => (setError(null), setSuccess(null))} />
      {!isAdmin && <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">Chế độ chỉ xem — chỉ Admin cấu hình tổ sửa chữa.</p>}

      {isAdmin && (
        <SectionCard title="Thêm tổ sửa chữa" icon={<Wrench className="h-4 w-4 text-slate-500" />}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              run(() => addRepairTeam(state, { code, name }), `Đã thêm tổ ${name}.`);
              setCode('');
              setName('');
            }}
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
          >
            <label>
              <span className={labelCls}>Mã tổ *</span>
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="TO-SC-02" className={`${inputCls} font-mono uppercase`} />
            </label>
            <label className="flex-1">
              <span className={labelCls}>Tên tổ *</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tổ sửa chữa 2" className={inputCls} />
            </label>
            <button type="submit" disabled={!code.trim() || !name.trim()} className={primaryBtn}>
              <Plus className="h-4 w-4" />
              Thêm tổ
            </button>
          </form>
        </SectionCard>
      )}

      {state.repairTeams.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-xs text-slate-500">Chưa có tổ sửa chữa.</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {state.repairTeams.map((t) => (
            <SectionCard
              key={t.id}
              title={`${t.code} — ${t.name}${t.isActive ? '' : ' (ngưng)'}`}
              icon={<Users className="h-4 w-4 text-slate-500" />}
              right={
                isAdmin && (
                  <button type="button" onClick={() => run(() => setRepairTeamActive(state, { teamId: t.id, isActive: !t.isActive }), 'Đã cập nhật tổ.')} className={secondaryBtn}>
                    {t.isActive ? 'Ngưng tổ' : 'Kích hoạt'}
                  </button>
                )
              }
            >
              <ul className="divide-y divide-slate-100 text-xs">
                {t.members.length === 0 && <li className="py-2 text-slate-500">Chưa có nhân viên.</li>}
                {t.members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between py-1.5">
                    <span className={m.isActive ? 'text-slate-900' : 'text-slate-400 line-through'}>
                      {m.fullName}
                      {m.staffUserId && <span className="ml-1 rounded bg-blue-50 px-1 text-[10px] text-blue-700">user</span>}
                    </span>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => run(() => setRepairTeamMemberActive(state, { teamId: t.id, memberId: m.id, isActive: !m.isActive }), 'Đã cập nhật nhân viên.')}
                        className="text-[11px] text-slate-500 hover:text-slate-900"
                      >
                        {m.isActive ? 'Ngưng' : 'Kích hoạt'}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
              {isAdmin && (
                <div className="mt-2 space-y-2">
                  {(() => {
                    // User đang hoạt động có vai trò Sửa chữa, chưa có trong tổ (DEC-048)
                    const candidates = state.staffUsers.filter(
                      (u) => u.isActive && u.roles.includes('REPAIR_STAFF') && !t.members.some((m) => m.isActive && m.staffUserId === u.id)
                    );
                    const picked = userDraft[t.id] || '';
                    return (
                      <div className="flex gap-2">
                        <select value={picked} onChange={(e) => setUserDraft((p) => ({ ...p, [t.id]: e.target.value }))} className={inputCls} aria-label="Chọn user sửa chữa">
                          <option value="">{candidates.length ? '-- Chọn user Sửa chữa --' : 'Không còn user Sửa chữa chưa vào tổ'}</option>
                          {candidates.map((u) => <option key={u.id} value={u.id}>{u.staffCode} — {u.fullName}</option>)}
                        </select>
                        <button
                          type="button"
                          disabled={!picked}
                          onClick={() => {
                            if (run(() => addRepairTeamMember(state, { teamId: t.id, staffUserId: picked }), 'Đã thêm user vào tổ.')) setUserDraft((p) => ({ ...p, [t.id]: '' }));
                          }}
                          className={`${secondaryBtn} shrink-0`}
                        >
                          <Plus className="h-3.5 w-3.5" />
                          Thêm user
                        </button>
                      </div>
                    );
                  })()}
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (run(() => addRepairTeamMember(state, { teamId: t.id, fullName: memberDraft[t.id] || '' }), 'Đã thêm nhân viên.')) setMemberDraft((p) => ({ ...p, [t.id]: '' }));
                    }}
                    className="flex gap-2"
                  >
                    <input
                      value={memberDraft[t.id] || ''}
                      onChange={(e) => setMemberDraft((p) => ({ ...p, [t.id]: e.target.value }))}
                      placeholder="Hoặc nhập họ tên nhân viên không có tài khoản..."
                      className={inputCls}
                    />
                    <button type="submit" disabled={!(memberDraft[t.id] || '').trim()} className={`${secondaryBtn} shrink-0`}>
                      <Plus className="h-3.5 w-3.5" />
                      Thêm
                    </button>
                  </form>
                </div>
              )}
            </SectionCard>
          ))}
        </div>
      )}
    </div>
  );
};
