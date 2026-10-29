-- ============================================================================
-- MATRAN DEPOT — DEC-176: ẢNH HOÀN THÀNH SỬA CHỮA + ẢNH KHÔNG TỰ XÓA
-- Hợp đồng: src/services/depotOperations.ts (completeRepairTask — 1 đến 30 ảnh), src/services/api.ts, src/services/photo.ts.
--   - Kho riêng tư repair-photos: mỗi file < 200 KB (chặn ở kho), chỉ JPEG.
--     Đường dẫn: ANH-SUA-CHUA/<năm>/<tháng>/<ngày>/<mã tổ>/<số cont>/<số cont>-<giờ phút giây>-<n>.jpg
--     (Supabase Storage không nhận chữ có dấu → "ẢNH SỬA CHỮA" viết ANH-SUA-CHUA). Ảnh Gate in: door-photos/ANH-GATE-IN/<năm>/<tháng>/<ngày>/.
--   - work_orders.photo_paths: đường dẫn ảnh theo thứ tự chụp.
--   - complete_repair_with_photos: kiểm 1–30 ảnh → gọi lại complete_repair_task (không sửa hàm cũ) → gắn ảnh, cùng 1 giao dịch.
--   - ẢNH KHÔNG TỰ XÓA (người dùng chốt 2026-10-29, thay DEC-159): expired_photo_paths() trả rỗng → Edge Function
--     purge-expired-photos không xóa gì. Quản trị tải về backup rồi tự xóa trên Supabase.
-- Chỉ THÊM, không sửa bảng / hàm cũ (riêng expired_photo_paths thay nội dung để tắt tự xóa).
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('repair-photos', 'repair-photos', false, 204800, array['image/jpeg']) -- < 200 KB / ảnh
on conflict (id) do nothing;

create policy repair_photos_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'repair-photos' and public.has_permission('REPAIR'));
create policy repair_photos_read on storage.objects for select to authenticated
  using (bucket_id = 'repair-photos' and public.is_active_staff());

alter table public.work_orders add column photo_paths text[] not null default '{}';

create or replace function public.complete_repair_with_photos(
  p_request_id uuid, p_team_id uuid, p_member_ids uuid[], p_photo_paths text[],
  p_container_no text default null, p_scanned_code text default null, p_notes text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_prev jsonb := public.idem_get(p_request_id);
  v_res jsonb;
  v_wo uuid;
  v_count int := coalesce(array_length(p_photo_paths, 1), 0);
begin
  if v_prev is not null then return v_prev; end if;
  perform public.assert_permission('REPAIR', 'chỉ Bộ phận Sửa chữa được xác nhận hoàn tất sửa chữa.');
  if v_count < 1 then raise exception 'Vui lòng CHỤP ẢNH HOÀN THÀNH SỬA CHỮA (ít nhất 1 ảnh).'; end if;
  if v_count > 30 then raise exception 'Tối đa 30 ảnh hoàn thành sửa chữa / container.'; end if;
  if exists (select 1 from unnest(p_photo_paths) p where p is null or p not like 'ANH-SUA-CHUA/%') then
    raise exception 'Đường dẫn ảnh sửa chữa không hợp lệ.';
  end if;
  v_res := public.complete_repair_task(p_request_id, p_team_id, p_member_ids, p_container_no, p_scanned_code, p_notes);
  select id into v_wo from public.work_orders
  where container_id = (v_res->>'id')::uuid and category = 'REPAIR' and work_status = 'COMPLETED'
  order by completed_at desc limit 1;
  update public.work_orders set photo_paths = p_photo_paths where id = v_wo;
  return v_res;
end $$;

-- Tắt tự xóa ảnh (giữ tên hàm để Edge Function cũ vẫn chạy, không xóa gì)
create or replace function public.expired_photo_paths(p_limit int default 500) returns table (path text)
language sql stable security definer set search_path = public as $$
  select null::text where false;
$$;

revoke execute on function public.complete_repair_with_photos(uuid, uuid, uuid[], text[], text, text, text) from public, anon, authenticated;
grant execute on function public.complete_repair_with_photos(uuid, uuid, uuid[], text[], text, text, text) to authenticated;
revoke execute on function public.expired_photo_paths(int) from public, anon, authenticated;
grant execute on function public.expired_photo_paths(int) to service_role;
