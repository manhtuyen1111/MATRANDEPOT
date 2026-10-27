-- ============================================================================
-- MATRAN DEPOT — Migration 5/5 (phần 1): VẬN HÀNH — lịch tự động (pg_cron), kho ảnh, dọn dữ liệu tạm
-- Thiết kế: docs/DATABASE_SCHEMA.md mục 4 (partition, ảnh 24 tháng — DEC-150, DEC-151).
--   - Partition tháng cho audit_logs / location_history được tạo TRƯỚC 2 tháng (ngày 25 hằng tháng).
--   - request_log (chống bấm lặp) chỉ cần vài ngày → xóa bản ghi > 7 ngày (mỗi đêm).
--   - Ảnh cửa container: bucket riêng tư door-photos. Xóa FILE ảnh hết hạn phải qua Storage API → Edge Function
--     purge-expired-photos (bước 5b) gọi expired_photo_paths() rồi mark_photos_purged().
--   - Chuyển kho > 36 tháng: chưa làm (dữ liệu đủ 3 năm từ 2029) — kế hoạch ở DATABASE_SCHEMA mục 4.
-- ============================================================================

create extension if not exists pg_cron;

-- Tạo partition cho tháng hiện tại + 2 tháng tới (gọi được nhiều lần, không lỗi)
create or replace function public.ensure_future_partitions() returns void
language plpgsql security definer set search_path = public as $$
declare
  i int;
begin
  for i in 0..2 loop
    perform public.ensure_audit_partition((date_trunc('month', current_date) + make_interval(months => i))::date);
    perform public.ensure_location_partition((date_trunc('month', current_date) + make_interval(months => i))::date);
  end loop;
end $$;
select public.ensure_future_partitions();

create or replace function public.purge_request_log() returns int
language sql security definer set search_path = public as $$
  with d as (delete from public.request_log where created_at < now() - interval '7 days' returning 1) select count(*)::int from d;
$$;

-- Lịch chạy (giờ UTC; 18:00 UTC = 01:00 giờ Việt Nam)
select cron.schedule('matran-ensure-partitions', '0 18 25 * *', $$select public.ensure_future_partitions()$$);
select cron.schedule('matran-purge-request-log', '30 18 * * *', $$select public.purge_request_log()$$);

-- ---------------------------------------------------------------------------
-- KHO ẢNH CỬA CONTAINER (Supabase Storage) — riêng tư; đường dẫn yyyy/mm/<mã hồ sơ>-<ngẫu nhiên>.jpg
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('door-photos', 'door-photos', false, 1048576, array['image/jpeg', 'image/webp']) -- ảnh đã nén ~200 KB; chặn > 1 MB
on conflict (id) do nothing;

-- Giám định (Hạ vỏ / Nhập tàu) tải ảnh lên; nhân viên đang hoạt động xem được; không ai sửa / xóa từ app
create policy door_photos_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'door-photos' and (public.has_permission('GATE_IN_FIELD') or public.has_permission('VESSEL_IMPORT_INSPECT')));
create policy door_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'door-photos' and public.is_active_staff());

-- Ảnh đã quá hạn lưu (Hạ vỏ: photo_expires_at; Nhập tàu: 24 tháng sau Giám định)
create or replace function public.expired_photo_paths(p_limit int default 500) returns table (path text)
language sql stable security definer set search_path = public as $$
  select door_photo_path from public.gate_in_orders where door_photo_path is not null and photo_expires_at < current_date
  union all
  select door_photo_path from public.vessel_list_items where door_photo_path is not null and inspected_at < now() - interval '24 months'
  limit p_limit;
$$;

-- Edge Function báo đã xóa file → bỏ đường dẫn khỏi hồ sơ (hồ sơ vẫn giữ; giao diện ghi "ảnh đã hết hạn lưu")
create or replace function public.mark_photos_purged(p_paths text[]) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_a int;
  v_b int;
begin
  update public.gate_in_orders set door_photo_path = null where door_photo_path = any (p_paths);
  get diagnostics v_a = row_count;
  update public.vessel_list_items set door_photo_path = null where door_photo_path = any (p_paths);
  get diagnostics v_b = row_count;
  if v_a + v_b > 0 then
    insert into public.audit_logs (actor_name, actor_role, action_code, entity_type, entity_code, summary)
    values ('HỆ THỐNG', 'SYSTEM', 'PURGE_EXPIRED_PHOTOS', 'STORAGE', 'door-photos',
      format('Xóa %s ảnh cửa container đã quá 24 tháng (DEC-150)', v_a + v_b));
  end if;
  return v_a + v_b;
end $$;

revoke execute on function public.ensure_future_partitions(), public.purge_request_log(), public.expired_photo_paths(int),
  public.mark_photos_purged(text[]) from public, anon, authenticated;
grant execute on function public.expired_photo_paths(int) to service_role;
grant execute on function public.mark_photos_purged(text[]) to service_role;
