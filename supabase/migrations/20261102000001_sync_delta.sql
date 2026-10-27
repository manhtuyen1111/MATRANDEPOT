-- ============================================================================
-- N8 — ĐỒNG BỘ PHẦN THAY ĐỔI (DEC-158). Chỉ thêm cột / bảng kỹ thuật, KHÔNG đổi nghiệp vụ.
--   * sync_at: thời điểm dòng được tạo / sửa gần nhất (trigger tự đặt). App chỉ tải các dòng có sync_at mới.
--     Cột riêng — không dùng updated_at vì vài bảng có updated_at mang nghĩa nghiệp vụ (VD invoice_groups).
--   * sync_deletions: ghi lại dòng bị xóa để app bỏ khỏi bộ nhớ (giữ 7 ngày).
--   * server_now(): giờ máy chủ làm mốc đồng bộ (không tin giờ máy người dùng).
-- ============================================================================

create or replace function public.touch_sync_at() returns trigger
language plpgsql as $$
begin
  new.sync_at := now();
  return new;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'containers', 'gate_in_orders', 'gate_out_orders', 'release_bookings', 'k80_tickets', 'work_orders', 'work_order_members',
    'location_history', 'vouchers', 'fee_lines', 'prepaid_receipts', 'payment_transactions', 'payment_receipts', 'prepaid_deductions',
    'receipt_prints', 'invoice_groups', 'invoice_group_items', 'vessel_lists', 'vessel_list_items', 'feedbacks'
  ] loop
    execute format('alter table public.%I add column sync_at timestamptz not null default now()', t);
    execute format('create index %I on public.%I (sync_at)', t || '_sync_at', t);
    execute format('create trigger %I before update on public.%I for each row execute function public.touch_sync_at()', t || '_sync_touch', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Dòng bị xóa. Bảng con không có id riêng (work_order_members, invoice_group_items) ghi id cha
-- → app bỏ các dòng con của cha đó rồi tải lại theo cha.
-- ---------------------------------------------------------------------------
create table public.sync_deletions (
  id bigint generated always as identity primary key,
  table_name text not null,
  row_id uuid not null,
  deleted_at timestamptz not null default now()
);
create index sync_deletions_deleted_at on public.sync_deletions (deleted_at);

alter table public.sync_deletions enable row level security;
create policy staff_read on public.sync_deletions for select to authenticated using (public.is_active_staff());
revoke insert, update, delete, truncate on public.sync_deletions from anon, authenticated;
revoke all on public.sync_deletions from anon;

create or replace function public.log_sync_deletion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.sync_deletions (table_name, row_id)
  values (tg_table_name, (to_jsonb(old) ->> case tg_table_name
    when 'work_order_members' then 'work_order_id'
    when 'invoice_group_items' then 'group_id'
    else 'id' end)::uuid);
  return old;
end $$;

do $$
declare
  t text;
begin
  foreach t in array array['gate_in_orders', 'fee_lines', 'invoice_groups', 'invoice_group_items', 'vessel_lists', 'vessel_list_items', 'work_order_members'] loop
    execute format('create trigger %I after delete on public.%I for each row execute function public.log_sync_deletion()', t || '_sync_delete', t);
  end loop;
end $$;

create or replace function public.purge_sync_deletions() returns int
language sql security definer set search_path = public as $$
  with d as (delete from public.sync_deletions where deleted_at < now() - interval '7 days' returning 1) select count(*)::int from d;
$$;
select cron.schedule('matran-purge-sync-deletions', '40 18 * * *', $$select public.purge_sync_deletions()$$);

create or replace function public.server_now() returns timestamptz
language sql stable as $$ select now() $$;

-- QUYỀN GỌI: client chỉ gọi server_now
revoke execute on function public.touch_sync_at(), public.log_sync_deletion(), public.purge_sync_deletions(), public.server_now()
  from public, anon, authenticated;
grant execute on function public.server_now() to authenticated;
