-- ============================================================================
-- DEC-189 — DANH MỤC CHUNG → DATABASE: theo dõi SỨC KHỎE DATABASE (chỉ Admin).
--   * db_health(): số liệu kỹ thuật — dung lượng, kho ảnh, kết nối, truy vấn chậm, bộ nhớ đệm, bảng lớn, tác vụ định kỳ, partition.
--     KHÔNG trả tên đăng nhập, mật khẩu, khóa, chuỗi kết nối, nội dung câu truy vấn, tên người dùng database.
--   * Giới hạn dung lượng (theo gói Supabase) do Admin nhập — db_health_settings (1 dòng), sửa qua set_db_health_limits.
--   * Ngưỡng cảnh báo (vàng 70% / đỏ 85%…) tính ở app: src/services/dbHealth.ts.
-- ============================================================================

create table if not exists public.db_health_settings (
  id int primary key default 1 check (id = 1),
  db_limit_mb int not null default 8192 check (db_limit_mb > 0),            -- gói Pro: 8 GB database
  storage_limit_mb int not null default 102400 check (storage_limit_mb > 0), -- gói Pro: 100 GB kho file
  updated_by_name text,
  updated_at timestamptz not null default now()
);
insert into public.db_health_settings (id) values (1) on conflict do nothing;
alter table public.db_health_settings enable row level security;
revoke all on public.db_health_settings from anon, authenticated; -- chỉ đọc / ghi qua RPC bên dưới

create or replace function public.assert_admin() returns public.staff
language plpgsql stable security definer set search_path = public as $$
declare
  me public.staff := public.current_staff();
begin
  if me.id is null then
    raise exception 'Phiên đăng nhập không hợp lệ hoặc tài khoản đã bị khóa.' using errcode = '42501';
  end if;
  if not public.has_any_role(array[]::public.app_role[]) then -- has_any_role luôn gồm ADMIN
    raise exception 'Không đủ quyền: chỉ Admin xem được sức khỏe database.' using errcode = '42501';
  end if;
  return me;
end $$;

-- ---------------------------------------------------------------------------
-- SỐ LIỆU SỨC KHỎE (chỉ đọc)
-- ---------------------------------------------------------------------------
create or replace function public.db_health() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  s public.db_health_settings;
  v_db jsonb;
  v_conn jsonb;
  v_storage jsonb;
  v_tables jsonb;
  v_cron jsonb;
  v_parts jsonb;
  v_next text := to_char(date_trunc('month', now()) + interval '1 month', 'YYYY_MM');
begin
  perform public.assert_admin();
  select * into s from public.db_health_settings where id = 1;

  select jsonb_build_object(
    'sizeBytes', pg_database_size(current_database()),
    'version', split_part(current_setting('server_version'), ' ', 1),
    'startedAt', pg_postmaster_start_time(),
    'cacheHitPct', round(100.0 * d.blks_hit / nullif(d.blks_hit + d.blks_read, 0), 2),
    'deadlocks', d.deadlocks,
    'xidAge', (select age(datfrozenxid) from pg_database where datname = current_database()),
    'lastActivityAt', (select max(sync_at) from public.containers)
  ) into v_db
  from pg_stat_database d where d.datname = current_database();

  -- Kết nối: chỉ đếm (không trả tên người dùng / địa chỉ / câu truy vấn)
  select jsonb_build_object(
    'total', count(*),
    'active', count(*) filter (where state = 'active'),
    'idleInTx', count(*) filter (where state like 'idle in transaction%'),
    'waitingLock', count(*) filter (where wait_event_type = 'Lock'),
    'slowQueries', count(*) filter (where state = 'active' and pid <> pg_backend_pid() and now() - query_start > interval '60 seconds'),
    'longestQuerySec', coalesce(max(extract(epoch from now() - query_start)) filter (where state = 'active' and pid <> pg_backend_pid()), 0)::int,
    'max', current_setting('max_connections')::int
  ) into v_conn
  from pg_stat_activity where datname = current_database() and backend_type = 'client backend';

  -- Kho ảnh (Supabase Storage) theo kho
  if to_regclass('storage.objects') is not null then
    select coalesce(jsonb_agg(jsonb_build_object('bucket', bucket_id, 'files', n, 'bytes', b) order by b desc), '[]'::jsonb) into v_storage
    from (select bucket_id, count(*) as n, coalesce(sum((metadata->>'size')::bigint), 0) as b from storage.objects group by bucket_id) x;
  else
    v_storage := '[]'::jsonb;
  end if;

  -- Bảng dữ liệu (bảng chia partition cộng gộp các partition)
  select coalesce(jsonb_agg(t order by (t->>'bytes')::bigint desc), '[]'::jsonb) into v_tables
  from (
    select jsonb_build_object(
      'name', c.relname,
      'bytes', (select coalesce(sum(pg_total_relation_size(p.relid)), 0) from pg_partition_tree(c.oid) p),
      'rows', (select coalesce(sum(st.n_live_tup), 0) from pg_partition_tree(c.oid) p join pg_stat_user_tables st on st.relid = p.relid),
      'deadRows', (select coalesce(sum(st.n_dead_tup), 0) from pg_partition_tree(c.oid) p join pg_stat_user_tables st on st.relid = p.relid),
      'vacuumedAt', (select max(greatest(st.last_autovacuum, st.last_vacuum)) from pg_partition_tree(c.oid) p join pg_stat_user_tables st on st.relid = p.relid)
    ) as t
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relispartition
  ) x;

  -- Tác vụ định kỳ (pg_cron): lần chạy gần nhất + số lần lỗi 7 ngày (không trả câu lệnh)
  if to_regclass('cron.job') is not null then
    select coalesce(jsonb_agg(jsonb_build_object(
      'name', j.jobname, 'schedule', j.schedule, 'active', j.active,
      'lastStatus', r.status, 'lastStartAt', r.start_time,
      'failed7d', (select count(*) from cron.job_run_details f where f.jobid = j.jobid and f.status = 'failed' and f.start_time > now() - interval '7 days')
    ) order by j.jobname), '[]'::jsonb) into v_cron
    from cron.job j
    left join lateral (select status, start_time from cron.job_run_details d where d.jobid = j.jobid order by start_time desc limit 1) r on true;
  else
    v_cron := '[]'::jsonb;
  end if;

  -- Partition tháng sau đã tạo sẵn chưa + số dòng rơi vào partition mặc định (default)
  select jsonb_agg(jsonb_build_object(
    'table', t, 'nextMonthReady', to_regclass('public.' || t || '_' || v_next) is not null,
    'defaultRows', coalesce((select n_live_tup from pg_stat_user_tables where relname = t || '_default' and schemaname = 'public'), 0)
  )) into v_parts
  from unnest(array['audit_logs', 'location_history']) t;

  return jsonb_build_object(
    'checkedAt', now(),
    'database', v_db,
    'connections', v_conn,
    'storage', v_storage,
    'tables', v_tables,
    'cron', v_cron,
    'partitions', v_parts,
    'limits', jsonb_build_object('dbMb', s.db_limit_mb, 'storageMb', s.storage_limit_mb, 'updatedBy', s.updated_by_name, 'updatedAt', s.updated_at)
  );
end $$;

-- ---------------------------------------------------------------------------
-- GIỚI HẠN DUNG LƯỢNG theo gói Supabase (Admin nhập)
-- ---------------------------------------------------------------------------
create or replace function public.set_db_health_limits(p_db_mb int, p_storage_mb int) returns void
language plpgsql security definer set search_path = public as $$
declare
  me public.staff := public.assert_admin();
begin
  if coalesce(p_db_mb, 0) <= 0 or coalesce(p_storage_mb, 0) <= 0 then
    raise exception 'Giới hạn dung lượng phải lớn hơn 0 MB.';
  end if;
  update public.db_health_settings set db_limit_mb = p_db_mb, storage_limit_mb = p_storage_mb, updated_by_name = me.full_name, updated_at = now()
  where id = 1;
  perform public.write_audit('DB_HEALTH_LIMITS', 'CATALOG', 'DATABASE', format('Giới hạn dung lượng: database %s MB, kho ảnh %s MB', p_db_mb, p_storage_mb));
end $$;

revoke execute on function public.assert_admin() from public, anon, authenticated;
revoke execute on function public.db_health() from public, anon, authenticated;
grant execute on function public.db_health() to authenticated;
revoke execute on function public.set_db_health_limits(int, int) from public, anon, authenticated;
grant execute on function public.set_db_health_limits(int, int) to authenticated;
