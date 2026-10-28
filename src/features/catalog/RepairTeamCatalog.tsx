import React, { useState } from 'react';
import { addRepairTeamsByCount, assignRepairStaff, setRepairGradeActive, setRepairTeamActive, setRepairTeamMemberActive, upsertRepairGrade } from '../../services/api';
import { repairStaffAssignment, repairTeamsToCreate } from '../../services/depotOperations';
import { Award, Plus, Users, Wrench } from 'lucide-react';
import { DepotState, formatVnd } from '../../services/depotStore';
import type { RepairGrade, RepairTeam, StaffUser } from '../../types/depot';

import { hasRolePermission } from '../../services/permissions';
import { CellText, CELL_MAX, DetailDrawer, Feedback, inputCls, labelCls, primaryBtn, secondaryBtn, SectionCard } from '../../components/shared';

type Tab = 'STAFF' | 'TEAM' | 'GRADE';
type Run = (fn: () => DepotState, message: string) => boolean;

// DANH MỤC CHUNG — SỬA CHỮA (DEC-042, DEC-173). Chỉ ADMIN cấu hình, vai trò khác xem.
//   NHÂN VIÊN SỬA CHỮA: user có vai trò Sửa chữa — bắt buộc cấu hình TỔ + BẬC THỢ (giờ công bậc thợ tự lấy theo bậc)
//   TỔ SỬA CHỮA: tạo theo số lượng (TỔ SỬA CHỮA 1, 2, 3…)
//   BẬC THỢ: tên + giờ công bậc thợ (đơn giá tiền / 1 giờ)
export const RepairTeamCatalog: React.FC<{ state: DepotState; onUpdateState: (next: DepotState) => void }> = ({ state, onUpdateState }) => {
  const isAdmin = hasRolePermission(state.currentUser, ['ADMIN']);
  const [tab, setTab] = useState<Tab>('STAFF');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const run: Run = (fn, message) => {
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
      {!isAdmin && <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">Chế độ chỉ xem — chỉ Admin cấu hình sửa chữa.</p>}
      <div className="inline-flex overflow-hidden rounded-lg border border-line bg-white text-xs font-bold">
        {([['STAFF', 'NHÂN VIÊN SỬA CHỮA'], ['TEAM', 'TỔ SỬA CHỮA'], ['GRADE', 'BẬC THỢ']] as const).map(([k, t]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={`px-4 py-2 ${tab === k ? 'bg-navy-900 text-white' : 'text-ink-muted hover:bg-canvas'}`}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'STAFF' && <StaffTab state={state} isAdmin={isAdmin} run={run} />}
      {tab === 'TEAM' && <TeamTab state={state} isAdmin={isAdmin} run={run} />}
      {tab === 'GRADE' && <GradeTab state={state} isAdmin={isAdmin} run={run} />}
    </div>
  );
};

// ---------------------------------------------------------------------------
// NHÂN VIÊN SỬA CHỮA (user có vai trò Sửa chữa)
// ---------------------------------------------------------------------------
const StaffTab: React.FC<{ state: DepotState; isAdmin: boolean; run: Run }> = ({ state, isAdmin, run }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const staff = state.staffUsers.filter((u) => u.roles.includes('REPAIR_STAFF')).sort((a, b) => a.staffCode.localeCompare(b.staffCode));
  const selected = staff.find((u) => u.id === selectedId) || null;
  const missing = staff.filter((u) => u.isActive && !repairStaffAssignment(state, u.id).grade).length;

  return (
    <>
      {missing > 0 && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Còn <strong>{missing}</strong> nhân viên chưa cấu hình đủ TỔ SỬA CHỮA + BẬC THỢ — bấm dòng để cấu hình.
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        {staff.length === 0 ? (
          <p className="p-8 text-center text-xs text-ink-muted">Chưa có user vai trò Sửa chữa — tạo ở Danh mục chung → User - Role.</p>
        ) : (
          <table className="data-table w-full whitespace-nowrap text-left text-xs">
            <thead className="border-b border-line bg-canvas text-[11px] uppercase text-ink-muted">
              <tr>
                <th className="px-3 py-2">Mã NV</th>
                <th className="px-3 py-2">Họ tên</th>
                <th className="px-3 py-2">Tổ sửa chữa</th>
                <th className="px-3 py-2">Bậc thợ</th>
                <th className="px-3 py-2 text-right">Giờ công bậc thợ (đ / giờ)</th>
                <th className="px-3 py-2">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {staff.map((u) => {
                const a = repairStaffAssignment(state, u.id);
                const ok = Boolean(a.team && a.grade);
                return (
                  <tr key={u.id} onClick={() => setSelectedId(u.id)} className={`cursor-pointer hover:bg-canvas ${selectedId === u.id ? 'bg-navy-50' : ''} ${u.isActive ? '' : 'text-ink-muted'}`}>
                    <td className="px-3 py-2 font-mono">{u.staffCode}</td>
                    <td className="px-3 py-2 font-semibold">{u.fullName}</td>
                    <td className="px-3 py-2">{a.team?.name || '-'}</td>
                    <td className="px-3 py-2">{a.grade?.name || '-'}</td>
                    <td className="px-3 py-2 text-right font-mono">{a.grade ? formatVnd(a.grade.hourlyRate) : '-'}</td>
                    <td className="px-3 py-2">
                      {!u.isActive ? 'Đã khóa' : ok ? 'Đủ cấu hình' : <span className="rounded bg-amber-100 px-1.5 py-0.5 font-bold text-amber-800">Thiếu cấu hình</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <DetailDrawer open={Boolean(selected)} title={selected ? `${selected.staffCode} — ${selected.fullName}` : ''} onClose={() => setSelectedId(null)}>
        {selected && <StaffDetail key={selected.id} user={selected} state={state} isAdmin={isAdmin} run={run} />}
      </DetailDrawer>
    </>
  );
};

const StaffDetail: React.FC<{ user: StaffUser; state: DepotState; isAdmin: boolean; run: Run }> = ({ user, state, isAdmin, run }) => {
  const a = repairStaffAssignment(state, user.id);
  const [teamId, setTeamId] = useState(a.team?.id || '');
  const [gradeId, setGradeId] = useState(a.grade?.id || '');
  const teams = state.repairTeams.filter((t) => t.isActive);
  const grades = (state.repairGrades || []).filter((g) => g.isActive);
  const grade = grades.find((g) => g.id === gradeId);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => assignRepairStaff(state, { staffUserId: user.id, teamId, gradeId }), `Đã cấu hình ${user.fullName}.`);
      }}
      className="space-y-3 text-xs"
    >
      <label className="block">
        <span className={labelCls}>1. Tổ sửa chữa *</span>
        <select value={teamId} onChange={(e) => setTeamId(e.target.value)} disabled={!isAdmin} className={inputCls}>
          <option value="">{teams.length ? '-- Chọn tổ --' : 'Chưa có tổ — tạo ở tab TỔ SỬA CHỮA'}</option>
          {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </label>
      <label className="block">
        <span className={labelCls}>2. Bậc thợ *</span>
        <select value={gradeId} onChange={(e) => setGradeId(e.target.value)} disabled={!isAdmin} className={inputCls}>
          <option value="">{grades.length ? '-- Chọn bậc thợ --' : 'Chưa có bậc thợ — tạo ở tab BẬC THỢ'}</option>
          {grades.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </label>
      <div>
        <span className={labelCls}>3. Giờ công bậc thợ (tự lấy theo bậc)</span>
        <div className="rounded-md border border-line bg-canvas px-3 py-2 font-mono font-bold text-ink">{grade ? `${formatVnd(grade.hourlyRate)} / giờ` : '-'}</div>
      </div>
      {isAdmin && (
        <button type="submit" disabled={!user.isActive || !teamId || !gradeId} className={primaryBtn}>
          Lưu cấu hình
        </button>
      )}
      {!user.isActive && <p className="text-ink-muted">User đã bị khóa — không cấu hình được.</p>}
    </form>
  );
};

// ---------------------------------------------------------------------------
// TỔ SỬA CHỮA — tạo theo số lượng
// ---------------------------------------------------------------------------
const TeamTab: React.FC<{ state: DepotState; isAdmin: boolean; run: Run }> = ({ state, isAdmin, run }) => {
  const [count, setCount] = useState('1');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = state.repairTeams.find((t) => t.id === selectedId) || null;
  const n = Number(count);
  let preview = '';
  try {
    preview = repairTeamsToCreate(state, n).map((t) => t.name).join(', ');
  } catch {
    preview = '';
  }
  return (
    <>
      {isAdmin && (
        <SectionCard title="Tạo tổ sửa chữa theo số lượng" icon={<Wrench className="h-4 w-4 text-ink-muted" />}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (run(() => addRepairTeamsByCount(state, { count: n }), `Đã tạo ${n} tổ: ${preview}.`)) setCount('1');
            }}
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
          >
            <label>
              <span className={labelCls}>Số lượng tổ *</span>
              <input type="number" min={1} max={50} value={count} onChange={(e) => setCount(e.target.value)} className={`${inputCls} w-28 font-mono`} />
            </label>
            <p className="flex-1 pb-2 text-[11px] text-ink-muted">{preview ? `Sẽ tạo: ${preview}` : 'Nhập số từ 1 đến 50.'}</p>
            <button type="submit" disabled={!preview} className={primaryBtn}>
              <Plus className="h-4 w-4" />
              Tạo tổ
            </button>
          </form>
        </SectionCard>
      )}
      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        {state.repairTeams.length === 0 ? (
          <p className="p-8 text-center text-xs text-ink-muted">Chưa có tổ sửa chữa.</p>
        ) : (
          <table className="data-table w-full whitespace-nowrap text-left text-xs">
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
        {selected && <TeamDetail key={selected.id} team={selected} state={state} isAdmin={isAdmin} run={run} />}
      </DetailDrawer>
    </>
  );
};

// Chi tiết 1 tổ: nhân viên (gán ở tab NHÂN VIÊN SỬA CHỮA), ngưng / kích hoạt tổ và nhân viên
const TeamDetail: React.FC<{ team: RepairTeam; state: DepotState; isAdmin: boolean; run: Run }> = ({ team: t, state, isAdmin, run }) => (
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
        {t.members.length === 0 && <li className="py-2 text-ink-muted">Chưa có nhân viên — gán ở tab NHÂN VIÊN SỬA CHỮA.</li>}
        {t.members.map((m) => {
          const g = (state.repairGrades || []).find((x) => x.id === m.gradeId);
          return (
            <li key={m.id} className="flex items-center justify-between py-1.5">
              <span className={m.isActive ? 'text-ink' : 'text-ink-muted line-through'}>
                {m.fullName}
                {g && <span className="ml-1 rounded bg-navy-50 px-1 text-[10px] text-navy-700">{g.name}</span>}
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
          );
        })}
      </ul>
    </SectionCard>
  </div>
);

// ---------------------------------------------------------------------------
// BẬC THỢ — tên + giờ công bậc thợ (đơn giá / giờ)
// ---------------------------------------------------------------------------
const GradeTab: React.FC<{ state: DepotState; isAdmin: boolean; run: Run }> = ({ state, isAdmin, run }) => {
  const [name, setName] = useState('');
  const [rate, setRate] = useState('');
  const [editing, setEditing] = useState<RepairGrade | null>(null);
  const grades = state.repairGrades || [];
  const used = (id: string) => state.repairTeams.reduce((s, t) => s + t.members.filter((m) => m.isActive && m.gradeId === id).length, 0);
  return (
    <>
      {isAdmin && (
        <SectionCard title="Thêm bậc thợ" icon={<Award className="h-4 w-4 text-ink-muted" />}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (run(() => upsertRepairGrade(state, { name, hourlyRate: Number(rate) }), `Đã thêm bậc thợ ${name}.`)) {
                setName('');
                setRate('');
              }
            }}
            className="flex flex-col gap-2 sm:flex-row sm:items-end"
          >
            <label className="flex-1">
              <span className={labelCls}>Bậc thợ *</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Bậc 1" className={inputCls} />
            </label>
            <label>
              <span className={labelCls}>Giờ công bậc thợ (đ / giờ) *</span>
              <input type="number" min={1} value={rate} onChange={(e) => setRate(e.target.value)} placeholder="30000" className={`${inputCls} font-mono`} />
            </label>
            <button type="submit" disabled={!name.trim() || !(Number(rate) > 0)} className={primaryBtn}>
              <Plus className="h-4 w-4" />
              Thêm
            </button>
          </form>
        </SectionCard>
      )}
      <div className="overflow-x-auto rounded-lg border border-line bg-white">
        {grades.length === 0 ? (
          <p className="p-8 text-center text-xs text-ink-muted">Chưa có bậc thợ.</p>
        ) : (
          <table className="data-table w-full whitespace-nowrap text-left text-xs">
            <thead className="border-b border-line bg-canvas text-[11px] uppercase text-ink-muted">
              <tr>
                <th className="px-3 py-2">Mã</th>
                <th className="px-3 py-2">Bậc thợ</th>
                <th className="px-3 py-2 text-right">Giờ công bậc thợ (đ / giờ)</th>
                <th className="px-3 py-2 text-right">Nhân viên</th>
                <th className="px-3 py-2">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {grades.map((g) => (
                <tr key={g.id} onClick={() => setEditing(g)} className={`cursor-pointer hover:bg-canvas ${g.isActive ? '' : 'text-ink-muted'}`}>
                  <td className="px-3 py-2 font-mono">{g.code}</td>
                  <td className="px-3 py-2 font-semibold">{g.name}</td>
                  <td className="px-3 py-2 text-right font-mono">{formatVnd(g.hourlyRate)}</td>
                  <td className="px-3 py-2 text-right font-mono">{used(g.id)}</td>
                  <td className="px-3 py-2">{g.isActive ? 'Đang dùng' : 'Ngưng'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <DetailDrawer open={Boolean(editing)} title={editing ? `Bậc thợ ${editing.name}` : ''} onClose={() => setEditing(null)}>
        {editing && <GradeDetail key={editing.id} grade={editing} state={state} isAdmin={isAdmin} run={run} usedBy={used(editing.id)} />}
      </DetailDrawer>
    </>
  );
};

const GradeDetail: React.FC<{ grade: RepairGrade; state: DepotState; isAdmin: boolean; run: Run; usedBy: number }> = ({ grade: g, state, isAdmin, run, usedBy }) => {
  const [name, setName] = useState(g.name);
  const [rate, setRate] = useState(String(g.hourlyRate));
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        run(() => upsertRepairGrade(state, { id: g.id, name, hourlyRate: Number(rate) }), `Đã lưu bậc thợ ${name}.`);
      }}
      className="space-y-3 text-xs"
    >
      <label className="block">
        <span className={labelCls}>Bậc thợ *</span>
        <input value={name} onChange={(e) => setName(e.target.value)} disabled={!isAdmin} className={inputCls} />
      </label>
      <label className="block">
        <span className={labelCls}>Giờ công bậc thợ (đ / giờ) *</span>
        <input type="number" min={1} value={rate} onChange={(e) => setRate(e.target.value)} disabled={!isAdmin} className={`${inputCls} font-mono`} />
      </label>
      {usedBy > 0 && <p className="text-ink-muted">Đổi đơn giá áp dụng cho {usedBy} nhân viên đang ở bậc này.</p>}
      {isAdmin && (
        <div className="flex gap-2">
          <button type="submit" disabled={!name.trim() || !(Number(rate) > 0)} className={primaryBtn}>Lưu</button>
          <button type="button" onClick={() => run(() => setRepairGradeActive(state, { id: g.id, isActive: !g.isActive }), 'Đã cập nhật bậc thợ.')} className={secondaryBtn}>
            {g.isActive ? 'Ngưng' : 'Kích hoạt'}
          </button>
        </div>
      )}
    </form>
  );
};
