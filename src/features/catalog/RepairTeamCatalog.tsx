import React, { useState } from 'react';
import { addRepairTeam, addRepairTeamMember, setRepairTeamActive, setRepairTeamMemberActive } from '../../services/api';
import { Plus, Users, Wrench } from 'lucide-react';
import { DepotState } from '../../services/depotStore';
import type { RepairTeam } from '../../types/depot';

import { hasRolePermission } from '../../services/permissions';
import { CellText, CELL_MAX, DetailDrawer, Feedback, inputCls, labelCls, primaryBtn, secondaryBtn, SectionCard } from '../../components/shared';

// DANH MỤC CHUNG — SỬA CHỮA: tổ sửa chữa & thành viên (DEC-042). Chỉ ADMIN cấu hình, vai trò khác xem.
// Danh sách theo chuẩn chung (DEC-080, DEC-134): mỗi tổ 1 dòng, bấm dòng → chi tiết + gán nhân viên ở cửa sổ trượt phải.
export const RepairTeamCatalog: React.FC<{ state: DepotState; onUpdateState: (next: DepotState) => void }> = ({
  state,
  onUpdateState,
}) => {
  const isAdmin = hasRolePermission(state.currentUser, ['ADMIN']);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  const selected = state.repairTeams.find((t) => t.id === selectedId) || null;

  return (
    <div className="space-y-4">
      <Feedback error={error} success={success} onClose={() => (setError(null), setSuccess(null))} />
      {!isAdmin && <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">Chế độ chỉ xem — chỉ Admin cấu hình tổ sửa chữa.</p>}

      {isAdmin && (
        <SectionCard title="Thêm tổ sửa chữa" icon={<Wrench className="h-4 w-4 text-ink-muted" />}>
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

      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        {state.repairTeams.length === 0 ? (
          <p className="p-8 text-center text-xs text-ink-muted">Chưa có tổ sửa chữa.</p>
        ) : (
          <table className="w-full whitespace-nowrap text-left text-xs">
            <thead className="border-b border-line bg-canvas text-[11px] uppercase text-ink-muted">
              <tr>
                <th className="px-3 py-2">Mã tổ</th>
                <th className="px-3 py-2">Tên tổ</th>
                <th className="px-3 py-2 text-right">Nhân viên</th>
                <th className="px-3 py-2">Thành viên</th>
                <th className="px-3 py-2">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {state.repairTeams.map((t) => {
                const active = t.members.filter((m) => m.isActive);
                return (
                  <tr key={t.id} onClick={() => setSelectedId(t.id)} className={`cursor-pointer hover:bg-canvas ${selectedId === t.id ? 'bg-navy-50' : ''}`}>
                    <td className="px-3 py-2 font-mono font-bold">{t.code}</td>
                    <td className="px-3 py-2"><CellText text={t.name} max={CELL_MAX.MEDIUM} /></td>
                    <td className="px-3 py-2 text-right font-mono">{active.length}</td>
                    <td className="px-3 py-2"><CellText text={active.map((m) => m.fullName).join(', ') || '-'} max={CELL_MAX.LONG} /></td>
                    <td className="px-3 py-2">{t.isActive ? 'Đang hoạt động' : 'Ngưng'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <DetailDrawer open={Boolean(selected)} title={selected ? `Tổ ${selected.code} — ${selected.name}` : ''} onClose={() => setSelectedId(null)}>
        {selected && <RepairTeamDetail key={selected.id} team={selected} state={state} isAdmin={isAdmin} run={run} />}
      </DetailDrawer>
    </div>
  );
};

// Chi tiết 1 tổ: thông tin, danh sách nhân viên (ngưng / kích hoạt), gán user Sửa chữa hoặc nhập tên
const RepairTeamDetail: React.FC<{
  team: RepairTeam;
  state: DepotState;
  isAdmin: boolean;
  run: (fn: () => DepotState, message: string) => boolean;
}> = ({ team: t, state, isAdmin, run }) => {
  const [picked, setPicked] = useState('');
  const [memberName, setMemberName] = useState('');
  // User đang hoạt động có vai trò Sửa chữa, chưa có trong tổ (DEC-048)
  const candidates = state.staffUsers.filter(
    (u) => u.isActive && u.roles.includes('REPAIR_STAFF') && !t.members.some((m) => m.isActive && m.staffUserId === u.id)
  );

  return (
    <div className="space-y-4 text-xs">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md border border-line px-3 py-2">
          <span className={labelCls}>Mã tổ</span>
          <span className="font-mono font-bold text-ink">{t.code}</span>
        </div>
        <div className="rounded-md border border-line px-3 py-2">
          <span className={labelCls}>Trạng thái</span>
          <span className="text-ink">{t.isActive ? 'Đang hoạt động' : 'Ngưng'}</span>
        </div>
      </div>
      {isAdmin && (
        <button type="button" onClick={() => run(() => setRepairTeamActive(state, { teamId: t.id, isActive: !t.isActive }), 'Đã cập nhật tổ.')} className={secondaryBtn}>
          {t.isActive ? 'Ngưng tổ' : 'Kích hoạt tổ'}
        </button>
      )}

      <SectionCard title={`Nhân viên (${t.members.filter((m) => m.isActive).length})`} icon={<Users className="h-4 w-4 text-ink-muted" />}>
        <ul className="divide-y divide-line">
          {t.members.length === 0 && <li className="py-2 text-ink-muted">Chưa có nhân viên.</li>}
          {t.members.map((m) => (
            <li key={m.id} className="flex items-center justify-between py-1.5">
              <span className={m.isActive ? 'text-ink' : 'text-ink-muted line-through'}>
                {m.fullName}
                {m.staffUserId && <span className="ml-1 rounded bg-navy-50 px-1 text-[10px] text-navy-700">user</span>}
              </span>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => run(() => setRepairTeamMemberActive(state, { teamId: t.id, memberId: m.id, isActive: !m.isActive }), 'Đã cập nhật nhân viên.')}
                  className="text-[11px] text-ink-muted hover:text-ink"
                >
                  {m.isActive ? 'Ngưng' : 'Kích hoạt'}
                </button>
              )}
            </li>
          ))}
        </ul>
      </SectionCard>

      {isAdmin && (
        <SectionCard title="Gán thêm nhân viên vào tổ" icon={<Plus className="h-4 w-4 text-ink-muted" />}>
          <div className="space-y-2">
            <div className="flex gap-2">
              <select value={picked} onChange={(e) => setPicked(e.target.value)} className={inputCls} aria-label="Chọn user sửa chữa">
                <option value="">{candidates.length ? '-- Chọn user Sửa chữa --' : 'Không còn user Sửa chữa chưa vào tổ'}</option>
                {candidates.map((u) => <option key={u.id} value={u.id}>{u.staffCode} — {u.fullName}</option>)}
              </select>
              <button
                type="button"
                disabled={!picked}
                onClick={() => {
                  if (run(() => addRepairTeamMember(state, { teamId: t.id, staffUserId: picked }), 'Đã thêm user vào tổ.')) setPicked('');
                }}
                className={`${secondaryBtn} shrink-0`}
              >
                <Plus className="h-3.5 w-3.5" />
                Thêm user
              </button>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (run(() => addRepairTeamMember(state, { teamId: t.id, fullName: memberName }), 'Đã thêm nhân viên.')) setMemberName('');
              }}
              className="flex gap-2"
            >
              <input value={memberName} onChange={(e) => setMemberName(e.target.value)} placeholder="Hoặc nhập họ tên nhân viên không có tài khoản..." className={inputCls} />
              <button type="submit" disabled={!memberName.trim()} className={`${secondaryBtn} shrink-0`}>
                <Plus className="h-3.5 w-3.5" />
                Thêm
              </button>
            </form>
          </div>
        </SectionCard>
      )}
    </div>
  );
};
