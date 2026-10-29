import React, { useCallback, useEffect, useState } from 'react';
import { AlertOctagon, AlertTriangle, CheckCircle2, Database, HardDrive, Info, RefreshCw, Save, Settings2, Table2, Timer } from 'lucide-react';
import {
  BUCKET_LABELS, CRON_LABELS, CRON_WHEN, DbHealthSnapshot, evaluateDbHealth, formatBytes, formatCount, healthAlertCount, HealthCheck,
  HealthLevel, storageBytes, TABLE_LABELS, usage, USAGE_DANGER_PCT, USAGE_WARN_PCT,
} from '../../services/dbHealth';
import { dbHealthActive, fetchDbHealth, saveDbHealthLimits } from '../../services/remote/dbHealthSource';
import { formatDateTime } from '../../services/datetime';
import { CELL_MAX, CellText, Feedback, inputCls, labelCls, primaryBtn, secondaryBtn, SectionCard } from '../../components/shared';

const TABLE_TOP = 15; // bảng dữ liệu lớn nhất

const LEVEL_TEXT: Record<HealthLevel, string> = { ok: 'Tốt', warn: 'Cần chú ý', danger: 'Nguy hiểm', info: 'Thông tin' };
const LEVEL_BAR: Record<HealthLevel, string> = { ok: 'bg-emerald-500', warn: 'bg-amber-500', danger: 'bg-danger-fg', info: 'bg-line-strong' };

const LevelIcon: React.FC<{ level: HealthLevel; className?: string }> = ({ level, className = 'h-4 w-4' }) =>
  level === 'ok' ? (
    <CheckCircle2 className={`${className} text-emerald-600`} aria-label="Tốt" />
  ) : level === 'warn' ? (
    <AlertTriangle className={`${className} text-amber-500`} aria-label="Cần chú ý" />
  ) : level === 'danger' ? (
    <AlertOctagon className={`${className} text-danger-fg`} aria-label="Nguy hiểm" />
  ) : (
    <Info className={`${className} text-ink-muted`} aria-label="Thông tin" />
  );

const worst = (checks: HealthCheck[]): HealthLevel =>
  checks.some((c) => c.level === 'danger') ? 'danger' : checks.some((c) => c.level === 'warn') ? 'warn' : 'ok';
const usageLevel = (p: number): HealthLevel => (p >= USAGE_DANGER_PCT ? 'danger' : p >= USAGE_WARN_PCT ? 'warn' : 'ok');

// Ô số liệu chính: tên, số lớn, thanh % (nếu có), dòng phụ
const Tile: React.FC<{ icon: React.ReactNode; label: string; value: string; sub: string; pct?: number; level: HealthLevel }> = ({ icon, label, value, sub, pct, level }) => (
  <div className="rounded-xl border border-line bg-surface p-3">
    <div className="flex items-center justify-between gap-2 text-xs font-semibold text-ink-muted">
      <span className="flex items-center gap-1.5">{icon}{label}</span>
      <LevelIcon level={level} />
    </div>
    <p className="mt-1 whitespace-nowrap font-mono text-xl font-bold text-ink">{value}</p>
    {pct !== undefined && (
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-canvas" aria-label={`${pct}%`}>
        <div className={`h-full rounded-full ${LEVEL_BAR[level]}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    )}
    <p className="mt-1 truncate text-[11px] text-ink-muted" title={sub}>{sub}</p>
  </div>
);

// DANH MỤC CHUNG → DATABASE (DEC-189): sức khỏe database — chỉ Admin (MENU_ACCESS + RPC kiểm tra Admin).
// Không hiển thị tên đăng nhập, mật khẩu, khóa — chỉ số đo kỹ thuật. Mỗi thông tin 1 dòng (DEC-134).
export const DatabaseHealthWorkspace: React.FC<{ onAlertCount?: (n: number) => void }> = ({ onAlertCount }) => {
  const remote = dbHealthActive();
  const [data, setData] = useState<{ snapshot: DbHealthSnapshot; latencyMs: number } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [limits, setLimits] = useState({ dbMb: '', storageMb: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchDbHealth();
      setData(res);
      setLimits({ dbMb: String(res.snapshot.limits.dbMb), storageMb: String(res.snapshot.limits.storageMb) });
      onAlertCount?.(healthAlertCount(evaluateDbHealth(res.snapshot, res.latencyMs)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lấy được số liệu database');
    } finally {
      setLoading(false);
    }
  }, [onAlertCount]);

  useEffect(() => {
    if (remote) void load();
  }, [remote, load]);

  const saveLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      await saveDbHealthLimits(Number(limits.dbMb), Number(limits.storageMb));
      setSuccess('Đã lưu giới hạn dung lượng.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Không lưu được giới hạn');
    }
  };

  if (!remote) {
    return (
      <SectionCard title="Sức khỏe database" icon={<Database className="h-4 w-4 text-ink-muted" />}>
        <p className="text-sm text-ink-muted" data-testid="db-health-demo">
          Đang chạy chế độ Demo (dữ liệu trên máy, không có database) — màn này chỉ có số liệu khi đăng nhập hệ thống thật (Supabase).
        </p>
      </SectionCard>
    );
  }

  const s = data?.snapshot;
  const checks = s ? evaluateDbHealth(s, data!.latencyMs) : [];
  const alerts = checks.filter((c) => c.level === 'warn' || c.level === 'danger').sort((a, b) => (a.level === b.level ? 0 : a.level === 'danger' ? -1 : 1));
  const u = s ? usage(s) : null;
  const overall = worst(checks);
  const level = (key: string) => checks.find((c) => c.key === key)?.level || 'info';

  return (
    <div className="space-y-4">
      <Feedback error={error} success={success} onClose={() => { setError(null); setSuccess(null); }} />

      {/* TRẠNG THÁI CHUNG + làm mới */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
        <div className="flex items-center gap-2">
          <LevelIcon level={s ? overall : 'info'} className="h-6 w-6" />
          <div>
            <p className="text-base font-bold text-ink" data-testid="db-health-overall">
              {s ? (overall === 'ok' ? 'Database hoạt động tốt' : `${LEVEL_TEXT[overall]} — ${alerts.length} mục cần xem`) : loading ? 'Đang kiểm tra…' : 'Chưa có số liệu'}
            </p>
            {s && (
              <p className="text-[11px] text-ink-muted">
                Kiểm tra lúc {formatDateTime(s.checkedAt)} • PostgreSQL {s.database.version} • chạy từ {formatDateTime(s.database.startedAt)}
                {s.database.lastActivityAt && <> • ghi dữ liệu gần nhất {formatDateTime(s.database.lastActivityAt)}</>}
              </p>
            )}
          </div>
        </div>
        <button type="button" onClick={() => void load()} disabled={loading} className={secondaryBtn}>
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          Làm mới
        </button>
      </div>

      {/* CẢNH BÁO — mỗi mục 1 dòng, đỏ trước */}
      {alerts.length > 0 && (
        <SectionCard title="Cảnh báo" icon={<AlertTriangle className="h-4 w-4 text-amber-500" />}>
          <ul className="divide-y divide-line text-xs" data-testid="db-health-alerts">
            {alerts.map((c) => (
              <li key={c.key} className={`flex items-center gap-2 whitespace-nowrap py-2 ${c.level === 'danger' ? 'text-danger-fg' : 'text-ink'}`}>
                <LevelIcon level={c.level} />
                <span className="font-semibold">{c.label}:</span>
                <span className="font-mono"><CellText text={c.value} max={CELL_MAX.LONG} /></span>
                <span className="text-ink-muted">— <CellText text={c.advice} max={70} /></span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      {s && u && (
        <>
          {/* SỐ LIỆU CHÍNH */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile icon={<Database className="h-3.5 w-3.5" />} label="Database" value={`${u.dbPct}%`} pct={u.dbPct} level={usageLevel(u.dbPct)}
              sub={`${formatBytes(s.database.sizeBytes)} / ${formatBytes(s.limits.dbMb * 1024 * 1024)}`} />
            <Tile icon={<HardDrive className="h-3.5 w-3.5" />} label="Kho ảnh" value={`${u.storagePct}%`} pct={u.storagePct} level={usageLevel(u.storagePct)}
              sub={`${formatBytes(storageBytes(s))} / ${formatBytes(s.limits.storageMb * 1024 * 1024)}`} />
            <Tile icon={<Settings2 className="h-3.5 w-3.5" />} label="Kết nối" value={`${s.connections.total} / ${s.connections.max}`} pct={u.connPct} level={usageLevel(u.connPct)}
              sub={`Đang chạy ${s.connections.active} • chờ khóa ${s.connections.waitingLock}`} />
            <Tile icon={<Timer className="h-3.5 w-3.5" />} label="Phản hồi" value={`${Math.round(data!.latencyMs)} ms`} level={level('latency')}
              sub={`Bộ nhớ đệm ${s.database.cacheHitPct ?? '-'}%`} />
          </div>

          {/* CHỈ SỐ SỨC KHỎE */}
          <SectionCard title="Chỉ số sức khỏe" icon={<CheckCircle2 className="h-4 w-4 text-ink-muted" />}>
            <div className="overflow-x-auto">
              <table className="data-table w-full whitespace-nowrap text-left text-xs" data-testid="db-health-checks">
                <thead className="bg-canvas text-[11px] font-semibold text-ink-muted">
                  <tr>
                    <th className="px-3 py-2">Nhóm</th>
                    <th className="px-3 py-2">Chỉ số</th>
                    <th className="px-3 py-2">Giá trị</th>
                    <th className="px-3 py-2">Ngưỡng cảnh báo</th>
                    <th className="px-3 py-2 text-center">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {checks.map((c) => (
                    <tr key={c.key}>
                      <td className="px-3 py-2 text-ink-muted">{c.group}</td>
                      <td className="px-3 py-2 font-semibold text-ink">{c.label}</td>
                      <td className="px-3 py-2 font-mono"><CellText text={c.value} max={CELL_MAX.LONG + 20} /></td>
                      <td className="px-3 py-2 text-ink-muted">{c.threshold}</td>
                      <td className="px-3 py-2 text-center"><span title={LEVEL_TEXT[c.level]} className="inline-flex"><LevelIcon level={c.level} /></span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            {/* BẢNG DỮ LIỆU LỚN NHẤT */}
            <SectionCard title={`Bảng dữ liệu lớn nhất (${Math.min(TABLE_TOP, s.tables.length)})`} icon={<Table2 className="h-4 w-4 text-ink-muted" />}>
              <div className="overflow-x-auto">
                <table className="data-table w-full whitespace-nowrap text-left text-xs" data-testid="db-health-tables">
                  <thead className="bg-canvas text-[11px] font-semibold text-ink-muted">
                    <tr>
                      <th className="px-3 py-2">Bảng</th>
                      <th className="px-3 py-2 text-right">Số dòng</th>
                      <th className="px-3 py-2 text-right">Dung lượng</th>
                      <th className="px-3 py-2 text-right">Dòng chờ dọn</th>
                      <th className="px-3 py-2">Dọn dẹp gần nhất</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {s.tables.slice(0, TABLE_TOP).map((t) => (
                      <tr key={t.name}>
                        <td className="px-3 py-2" title={t.name}><CellText text={TABLE_LABELS[t.name] || t.name} max={CELL_MAX.LONG} /></td>
                        <td className="px-3 py-2 text-right font-mono">{formatCount(t.rows)}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatBytes(t.bytes)}</td>
                        <td className="px-3 py-2 text-right font-mono">{formatCount(t.deadRows)}</td>
                        <td className="px-3 py-2 font-mono text-ink-muted">{t.vacuumedAt ? formatDateTime(t.vacuumedAt) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>

            <div className="space-y-4">
              {/* KHO ẢNH */}
              <SectionCard title="Kho ảnh" icon={<HardDrive className="h-4 w-4 text-ink-muted" />}>
                <div className="overflow-x-auto">
                  <table className="data-table w-full whitespace-nowrap text-left text-xs">
                    <thead className="bg-canvas text-[11px] font-semibold text-ink-muted">
                      <tr>
                        <th className="px-3 py-2">Kho</th>
                        <th className="px-3 py-2 text-right">Số ảnh</th>
                        <th className="px-3 py-2 text-right">Dung lượng</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {s.storage.length === 0 ? (
                        <tr><td colSpan={3} className="px-3 py-2 text-ink-muted">Chưa có ảnh.</td></tr>
                      ) : (
                        s.storage.map((b) => (
                          <tr key={b.bucket}>
                            <td className="px-3 py-2"><CellText text={BUCKET_LABELS[b.bucket] || b.bucket} max={CELL_MAX.LONG} /></td>
                            <td className="px-3 py-2 text-right font-mono">{formatCount(b.files)}</td>
                            <td className="px-3 py-2 text-right font-mono">{formatBytes(b.bytes)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </SectionCard>

              {/* TÁC VỤ ĐỊNH KỲ */}
              <SectionCard title="Tác vụ định kỳ" icon={<Timer className="h-4 w-4 text-ink-muted" />}>
                <div className="overflow-x-auto">
                  <table className="data-table w-full whitespace-nowrap text-left text-xs" data-testid="db-health-cron">
                    <thead className="bg-canvas text-[11px] font-semibold text-ink-muted">
                      <tr>
                        <th className="px-3 py-2">Tác vụ</th>
                        <th className="px-3 py-2">Lịch</th>
                        <th className="px-3 py-2">Lần chạy gần nhất</th>
                        <th className="px-3 py-2 text-right">Lỗi 7 ngày</th>
                        <th className="px-3 py-2 text-center">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {s.cron.length === 0 ? (
                        <tr><td colSpan={5} className="px-3 py-2 text-ink-muted">Không có tác vụ định kỳ.</td></tr>
                      ) : (
                        s.cron.map((j) => {
                          const lv: HealthLevel = j.lastStatus === 'failed' || j.failed7d > 0 ? 'danger' : !j.active ? 'warn' : j.lastStatus ? 'ok' : 'info';
                          return (
                            <tr key={j.name}>
                              <td className="px-3 py-2"><CellText text={CRON_LABELS[j.name] || j.name} max={CELL_MAX.LONG} /></td>
                              <td className="px-3 py-2 text-ink-muted">{CRON_WHEN[j.name] || j.schedule}</td>
                              <td className="px-3 py-2 font-mono">{j.lastStartAt ? formatDateTime(j.lastStartAt) : 'Chưa chạy'}</td>
                              <td className="px-3 py-2 text-right font-mono">{j.failed7d}</td>
                              <td className="px-3 py-2 text-center"><span title={LEVEL_TEXT[lv]} className="inline-flex"><LevelIcon level={lv} /></span></td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </SectionCard>
            </div>
          </div>

          {/* GIỚI HẠN DUNG LƯỢNG (theo gói Supabase) — Admin nhập */}
          <SectionCard title="Giới hạn dung lượng theo gói Supabase" icon={<Settings2 className="h-4 w-4 text-ink-muted" />}>
            <form onSubmit={saveLimits} className="flex flex-wrap items-end gap-3 text-xs">
              <label className="w-44">
                <span className={labelCls}>Database (MB)</span>
                <input type="number" min={1} value={limits.dbMb} onChange={(e) => setLimits((l) => ({ ...l, dbMb: e.target.value }))} className={`${inputCls} font-mono`} />
              </label>
              <label className="w-44">
                <span className={labelCls}>Kho ảnh (MB)</span>
                <input type="number" min={1} value={limits.storageMb} onChange={(e) => setLimits((l) => ({ ...l, storageMb: e.target.value }))} className={`${inputCls} font-mono`} />
              </label>
              <button type="submit" className={primaryBtn}><Save className="h-3.5 w-3.5" />Lưu</button>
              <p className="basis-full text-[11px] text-ink-muted">
                Gói Pro: database 8 GB (8192 MB), kho file 100 GB (102400 MB). Gói Free: 500 MB / 1024 MB. Cảnh báo vàng từ {USAGE_WARN_PCT}%, đỏ từ {USAGE_DANGER_PCT}%.
                {s.limits.updatedBy && <> Sửa lần cuối: {s.limits.updatedBy}, {formatDateTime(s.limits.updatedAt || undefined)}.</>}
              </p>
            </form>
          </SectionCard>
        </>
      )}
    </div>
  );
};
