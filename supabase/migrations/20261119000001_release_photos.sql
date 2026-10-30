-- ============================================================================
-- MATRAN DEPOT — DEC-198: GIÁM ĐỊNH CHỤP ẢNH CẤP VỎ (cont hãng MSK) TRƯỚC KHI TRẢ CHỨNG TỪ
-- Hợp đồng: src/services/releasePhoto.ts (recordReleasePhotos — 1 đến 30 ảnh), src/services/driverRoute.ts (bước GIÁM ĐỊNH),
--           src/services/api.ts (record_release_photos), src/services/photo.ts (releasePhotoPath).
--   - Ảnh ở kho door-photos (đã cho Giám định tải lên — GATE_IN_FIELD), thư mục ANH-CAP-VO/<năm>/<tháng>/<ngày>/.
--   - gate_out_orders.release_photo_paths + release_photo_container_no: ảnh gắn với SỐ CONT đã chụp
--     → đổi container (DEC-185 / DEC-192) thì ảnh cũ không tính, cont mới phải chụp lại (không cần sửa hàm đổi cont).
--   - mark_documents_returned: thêm chặn CẤP VỎ cont MSK chưa có ảnh (phần còn lại giữ nguyên bản 20261101000001).
-- Chỉ THÊM cột / hàm mới; mark_documents_returned thay nội dung, giữ chữ ký + quyền cũ.
-- ============================================================================

alter table public.gate_out_orders
  add column release_photo_paths text[] not null default '{}',
  add column release_photo_container_no text,
  add column release_photos_at timestamptz,
  add column release_photos_by uuid references public.staff (id),
  add column release_photos_by_name text;

-- Hãng phải chụp ảnh cấp vỏ (khớp RELEASE_PHOTO_LINES ở releasePhoto.ts)
create or replace function public.release_photo_lines() returns text[]
language sql immutable as $$ select array['MSK']::text[] $$;

-- Lệnh cấp này còn thiếu ảnh cấp vỏ (cont MSK, chưa có ảnh của đúng cont đang cấp)
create or replace function public.release_photo_missing(o public.gate_out_orders) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select c.shipping_line_code from public.containers c where c.id = o.container_id), '') = any (public.release_photo_lines())
    and (cardinality(o.release_photo_paths) = 0 or o.release_photo_container_no is distinct from o.container_no);
$$;

create or replace function public.record_release_photos(p_gate_out_id uuid, p_photo_paths text[]) returns void
language plpgsql security definer set search_path = public as $$
declare
  me public.staff;
  o public.gate_out_orders;
  v_count int := coalesce(array_length(p_photo_paths, 1), 0);
begin
  me := public.assert_permission('GATE_IN_FIELD', 'chỉ Giám định / Quản lý được chụp ảnh cấp vỏ.');
  select * into o from public.gate_out_orders where id = p_gate_out_id for update;
  if o.id is null then raise exception 'Không tìm thấy lệnh cấp vỏ.'; end if;
  if o.documents_returned_at is not null then raise exception 'Lệnh % đã trả chứng từ — không chụp thêm.', o.code; end if;
  if o.status <> 'GATE_OUT_OK' then raise exception 'Xe nâng chưa cấp cont % lên xe — chưa chụp ảnh cấp vỏ được.', o.container_no; end if;
  if coalesce((select c.shipping_line_code from public.containers c where c.id = o.container_id), '') <> all (public.release_photo_lines()) then
    raise exception 'Cont % không thuộc hãng phải chụp ảnh cấp vỏ.', o.container_no;
  end if;
  if not public.release_photo_missing(o) then
    raise exception 'Đã chụp ảnh cấp vỏ cont % lúc % (%).', o.container_no,
      to_char(o.release_photos_at at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI:SS'), o.release_photos_by_name;
  end if;
  if v_count < 1 then raise exception 'Vui lòng CHỤP ẢNH CẤP VỎ (ít nhất 1 ảnh).'; end if;
  if v_count > 30 then raise exception 'Tối đa 30 ảnh cấp vỏ / container.'; end if;
  if exists (select 1 from unnest(p_photo_paths) p where p is null or p not like 'ANH-CAP-VO/%') then
    raise exception 'Đường dẫn ảnh cấp vỏ không hợp lệ.';
  end if;
  update public.gate_out_orders
     set release_photo_paths = p_photo_paths, release_photo_container_no = o.container_no, release_photos_at = now(),
         release_photos_by = me.id, release_photos_by_name = me.full_name
   where id = o.id;
  perform public.write_audit('RELEASE_PHOTOS', 'GATE_OUT', o.code,
    format('[Hồ sơ %s] Giám định chụp %s ảnh cấp vỏ cont %s', o.code, v_count, o.container_no), o.dossier_code);
end $$;

-- TRẢ CHỨNG TỪ (DEC-052) + DEC-198: cấp vỏ cont MSK phải có ảnh cấp vỏ của Giám định
create or replace function public.mark_documents_returned(p_operation text, p_code text) returns void
language plpgsql security definer set search_path = public as $$
declare
  me public.staff;
  v_done timestamptz;
  v_status text;
  o public.gate_out_orders;
begin
  me := public.assert_permission('GATE_IN_OFFICE', 'chỉ Văn phòng / Quản lý được trả chứng từ.');
  if p_operation = 'CAP_VO' then
    select * into o from public.gate_out_orders where code = p_code for update;
    if o.id is null then raise exception 'Không tìm thấy hồ sơ của phiếu K80.'; end if;
    if o.status <> 'GATE_OUT_OK' then raise exception 'Chưa hoàn tất bước XE NÂNG — cấp vỏ. Lái xe cần đến bộ phận này trước.'; end if;
    if public.release_photo_missing(o) then raise exception 'Chưa hoàn tất bước GIÁM ĐỊNH — Chụp ảnh cấp vỏ. Lái xe cần đến bộ phận này trước.'; end if;
    if o.documents_returned_at is not null then
      raise exception 'Đã trả chứng từ cho phiếu này lúc %.', to_char(o.documents_returned_at at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI:SS');
    end if;
    update public.gate_out_orders set documents_returned_at = now(), documents_returned_by = me.id, documents_returned_by_name = me.full_name where code = p_code;
  else
    select documents_returned_at, status::text into v_done, v_status from public.gate_in_orders where code = p_code for update;
    if v_status is null then raise exception 'Không tìm thấy hồ sơ của phiếu K80.'; end if;
    if v_status <> 'GATE_IN_OK' then raise exception 'Hồ sơ % chưa GATE IN OK.', p_code; end if;
    if v_done is not null then raise exception 'Đã trả chứng từ cho phiếu này lúc %.', to_char(v_done at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI:SS'); end if;
    update public.gate_in_orders set documents_returned_at = now(), documents_returned_by = me.id, documents_returned_by_name = me.full_name where code = p_code;
  end if;
  perform public.write_audit('DOCUMENTS_RETURNED', case when p_operation = 'CAP_VO' then 'GATE_OUT' else 'GATE_IN' end, p_code,
    format('[Hồ sơ %s] Văn phòng trả chứng từ cho lái xe', p_code), p_code);
end $$;

-- Hàng chờ Giám định → Cấp vỏ tải theo lệnh đã OUT chưa trả chứng từ (loadWorking)
create index gate_out_orders_awaiting_return on public.gate_out_orders (confirmed_at) where status = 'GATE_OUT_OK' and documents_returned_at is null;

revoke execute on function public.record_release_photos(uuid, text[]) from public, anon, authenticated;
grant execute on function public.record_release_photos(uuid, text[]) to authenticated;
revoke execute on function public.release_photo_missing(public.gate_out_orders) from public, anon, authenticated;
