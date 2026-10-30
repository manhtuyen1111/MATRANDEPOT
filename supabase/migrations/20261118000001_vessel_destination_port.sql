-- ============================================================================
-- DEC-196 — XUẤT TÀU: MÃ CẢNG ĐẾN (tùy tàu, VD VNHPHTM) — gửi EDI CODECO gate-out (RFF+BN). Nhập tàu không dùng.
-- Định nghĩa lại create_vessel_list / update_vessel_list (migration 4) — thêm p_destination_port (có mặc định), giữ nguyên phần còn lại.
-- Hợp đồng nghiệp vụ: vessel.ts — cleanDestinationPort / createVesselList / updateVesselList.
-- ============================================================================
alter table public.vessel_lists add column if not exists destination_port text check (destination_port is null or destination_port ~ '^[A-Z0-9]{5,10}$');

create or replace function public.vessel_destination_port(p_mode public.vessel_mode, p_port text) returns text
language plpgsql immutable as $$
declare
  v text := upper(trim(coalesce(p_port, '')));
begin
  if p_mode <> 'XUAT_TAU' then return null; end if;
  if v !~ '^[A-Z0-9]{5,10}$' then raise exception 'Vui lòng nhập MÃ CẢNG ĐẾN 5–10 ký tự chữ / số (VD: VNHPHTM).'; end if;
  return v;
end $$;

-- Thêm tham số → bỏ bản cũ để không có 2 hàm trùng tên (PostgREST báo "không duy nhất")
drop function if exists public.create_vessel_list(public.vessel_mode, text, timestamptz, text[], text, jsonb, uuid[]);
drop function if exists public.update_vessel_list(uuid, public.vessel_mode, text, timestamptz, text[], text);

create or replace function public.create_vessel_list(
  p_mode public.vessel_mode, p_vessel_name text, p_planned_at timestamptz, p_truck_nos text[],
  p_shipping_line_code text default null, p_import_items jsonb default null, p_export_container_ids uuid[] default null,
  p_destination_port text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me public.staff;
  h record;
  v_line text;
  v_id uuid;
  v_n int;
  v_port text := public.vessel_destination_port(p_mode, p_destination_port);
begin
  me := public.assert_permission('VESSEL_LIST_MANAGE', format('chỉ Văn phòng / Quản lý được lập danh sách %s.', public.vessel_label(p_mode)));
  select * into h from public.vessel_validate_header(p_mode, p_vessel_name, p_planned_at, p_truck_nos);
  if p_mode = 'NHAP_TAU' then
    select code into v_line from public.partners where is_shipping_line and is_active and code = p_shipping_line_code;
    if v_line is null then raise exception 'Bắt buộc chọn HÃNG TÀU theo Danh mục chung.'; end if;
  end if;
  insert into public.vessel_lists (mode, vessel_name, shipping_line_code, destination_port, planned_at, truck_nos, created_by, created_by_name)
  values (p_mode, h.o_name, v_line, v_port, p_planned_at, h.o_trucks, me.id, me.full_name) returning id into v_id;
  v_n := case when p_mode = 'NHAP_TAU' then public.vessel_add_import_items(v_id, p_import_items)
              else public.vessel_add_export_items(v_id, p_export_container_ids, h.o_name) end;
  perform public.write_audit(case when p_mode = 'NHAP_TAU' then 'NHAP_TAU_LAP_DANH_SACH' else 'XUAT_TAU_LAP_DANH_SACH' end, 'VESSEL', h.o_name,
    format('Văn phòng lập danh sách %s tàu %s (%s): %s container, xe %s', public.vessel_label(p_mode), h.o_name,
      to_char(p_planned_at at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI:SS'), v_n, array_to_string(h.o_trucks, ', ')));
  return v_id;
end $$;

-- Sửa thông tin chung; hãng tàu Nhập tàu chỉ đổi khi chưa giám định cont nào; DEC-196: + mã cảng đến (Xuất tàu)
create or replace function public.update_vessel_list(
  p_list_id uuid, p_mode public.vessel_mode, p_vessel_name text, p_planned_at timestamptz, p_truck_nos text[], p_shipping_line_code text default null,
  p_destination_port text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  l public.vessel_lists;
  h record;
  v_line text;
  v_cid uuid;
  v_port text := public.vessel_destination_port(p_mode, p_destination_port);
begin
  perform public.assert_permission('VESSEL_LIST_MANAGE', format('chỉ Văn phòng / Quản lý được sửa danh sách %s.', public.vessel_label(p_mode)));
  l := public.lock_open_vessel_list(p_list_id, p_mode);
  select * into h from public.vessel_validate_header(p_mode, p_vessel_name, p_planned_at, p_truck_nos);
  v_line := l.shipping_line_code;
  if p_mode = 'NHAP_TAU' then
    select code into v_line from public.partners where is_shipping_line and is_active and code = p_shipping_line_code;
    if v_line is null then raise exception 'Bắt buộc chọn HÃNG TÀU theo Danh mục chung.'; end if;
    if v_line <> l.shipping_line_code and exists (select 1 from public.vessel_list_items where list_id = l.id and status <> 'PENDING') then
      raise exception 'Đã có container được giám định — không đổi HÃNG TÀU được.';
    end if;
  elsif h.o_name <> l.vessel_name then
    for v_cid in select container_id from public.vessel_list_items where list_id = l.id and status = 'PENDING' and container_id is not null loop
      perform public.vessel_lock(v_cid, h.o_name); -- DEC-131: ghi chú theo tên tàu mới
    end loop;
  end if;
  update public.vessel_lists set vessel_name = h.o_name, planned_at = p_planned_at, truck_nos = h.o_trucks, shipping_line_code = v_line, destination_port = v_port where id = l.id;
  perform public.write_audit('VESSEL_UPDATE_LIST', 'VESSEL', h.o_name,
    format('Sửa danh sách %s: tàu %s → %s, %s, xe %s%s', public.vessel_label(p_mode), l.vessel_name, h.o_name,
      to_char(p_planned_at at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI:SS'), array_to_string(h.o_trucks, ', '), coalesce(', hãng ' || v_line, '') || coalesce(', cảng đến ' || v_port, '')));
end $$;

revoke execute on function public.vessel_destination_port(public.vessel_mode, text) from public, anon, authenticated;
revoke execute on function public.create_vessel_list(public.vessel_mode, text, timestamptz, text[], text, jsonb, uuid[], text) from public, anon, authenticated;
grant execute on function public.create_vessel_list(public.vessel_mode, text, timestamptz, text[], text, jsonb, uuid[], text) to authenticated;
revoke execute on function public.update_vessel_list(uuid, public.vessel_mode, text, timestamptz, text[], text, text) from public, anon, authenticated;
grant execute on function public.update_vessel_list(uuid, public.vessel_mode, text, timestamptz, text[], text, text) to authenticated;
