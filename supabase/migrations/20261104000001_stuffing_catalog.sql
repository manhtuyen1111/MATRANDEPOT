-- ============================================================================
-- MATRAN DEPOT — DEC-166: DANH MỤC PHÂN LOẠI ĐÓNG HÀNG THEO HÃNG TÀU
-- Hợp đồng: src/services/stuffing.ts (resolveStuffing), depotOperations.ts (addStuffingClassCatalogItem,
-- setStuffingClassActive, recordGateInFieldStep + shippingLineCode, verifyGateInOfficeAndCreatePayment + stuffingClass,
-- completeRackInspection), vessel.ts (inspectVesselImportItem).
--   - Bảng stuffing_classes: mỗi hãng tàu 1 bộ mã (mặc định M / K / E — tạo sẵn cho mọi hãng hiện có).
--   - Hãng không có mã đang dùng → không hỏi Đóng hàng, lưu trống.
--   - Bỏ enum cố định stuffing_class → cột text; bỏ ràng buộc "AV / DAMAGE bắt buộc có đóng hàng".
--   - Giám định Hạ vỏ chọn HÃNG TÀU trước (gate_in_orders.shipping_line_code ghi ngay từ bước Giám định).
-- ============================================================================

create table public.stuffing_classes (
  id uuid primary key default gen_random_uuid(),
  shipping_line_code text not null references public.partners (code) on update cascade,
  code text not null check (code ~ '^[A-Z0-9]{1,5}$'),
  description text,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (shipping_line_code, code)
);
alter table public.stuffing_classes enable row level security;
create policy catalog_read on public.stuffing_classes for select to authenticated using (public.is_active_staff());
revoke insert, update, delete, truncate on public.stuffing_classes from anon, authenticated;
revoke all on public.stuffing_classes from anon;

-- Giữ đúng hành vi cũ: mọi hãng tàu hiện có dùng M / K / E
insert into public.stuffing_classes (shipping_line_code, code, sort_order)
select p.code, x.code, x.ord from public.partners p
cross join (values ('M', 1), ('K', 2), ('E', 3)) as x (code, ord)
where p.is_shipping_line
on conflict do nothing;

-- Kiểm mã đóng hàng theo hãng: hãng dùng → bắt buộc + đúng Danh mục; hãng không dùng → null (= resolveStuffing)
create or replace function public.resolve_stuffing(p_line text, p_value text) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v text := nullif(upper(trim(coalesce(p_value, ''))), '');
  v_opts text;
begin
  select string_agg(code, ' / ' order by sort_order, created_at) into v_opts
  from public.stuffing_classes where shipping_line_code = p_line and is_active;
  if v_opts is null then return null; end if;
  if v is null then raise exception 'Vui lòng chọn PHÂN LOẠI ĐÓNG HÀNG (%) — hãng tàu %.', v_opts, p_line; end if;
  if not exists (select 1 from public.stuffing_classes where shipping_line_code = p_line and code = v and is_active) then
    raise exception 'PHÂN LOẠI ĐÓNG HÀNG "%" không có trong Danh mục của hãng tàu % (%).', v, p_line, v_opts;
  end if;
  return v;
end $$;

-- Cột enum → text (giữ dữ liệu); bỏ ràng buộc bắt buộc đóng hàng (AGE vẫn bắt buộc)
alter table public.gate_in_orders alter column stuffing_class type text using stuffing_class::text;
alter table public.containers alter column stuffing_class type text using stuffing_class::text;
alter table public.k80_tickets alter column stuffing_class type text using stuffing_class::text;
alter table public.vessel_list_items alter column stuffing_class type text using stuffing_class::text;
do $$
declare r record;
begin
  for r in
    select conrelid::regclass as tbl, conname from pg_constraint
    where contype = 'c' and conrelid in ('public.gate_in_orders'::regclass, 'public.containers'::regclass)
      and pg_get_constraintdef(oid) ilike '%stuffing_class IS NOT NULL%'
  loop
    execute format('alter table %s drop constraint %I', r.tbl, r.conname);
  end loop;
end $$;
alter table public.gate_in_orders add constraint gate_in_orders_age_required check (condition_class = 'W-SURVEY' or manufacture_year is not null);
alter table public.containers add constraint containers_age_required check (condition_class = 'W-SURVEY' or manufacture_year is not null);

-- Hàm cũ nhận kiểu enum → bỏ, tạo lại nhận text
drop function public.record_gate_in_field_step(uuid, text, public.condition_class, text[], text[], public.stuffing_class, int, text);
drop function public.complete_rack_inspection(uuid, uuid, public.condition_class, public.stuffing_class, int, text[]);
drop function public.inspect_vessel_import_item(uuid, uuid, uuid, text, text, public.condition_class, public.stuffing_class, text[], int, text[], text);
drop function public.verify_gate_in_office(uuid, text, text, text, text, text, text, text, text, uuid[]);
drop type public.stuffing_class;

-- ---------------------------------------------------------------------------
-- Giám định — Hạ vỏ (DEC-166: + hãng tàu)
-- ---------------------------------------------------------------------------
create or replace function public.record_gate_in_field_step(
  p_request_id uuid,
  p_door_photo_path text,
  p_condition public.condition_class,
  p_cleaning_items text[],
  p_damage_remarks text[] default '{}',
  p_stuffing text default null,
  p_manufacture_year int default null,
  p_container_hint text default null,
  p_shipping_line_code text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me public.staff;
  v_prev jsonb := public.idem_get(p_request_id);
  v_deferred boolean := p_condition = 'W-SURVEY';
  v_remarks text[];
  v_cleaning text[];
  v_hint text := upper(trim(coalesce(p_container_hint, '')));
  v_code text;
  v_line text := upper(trim(coalesce(p_shipping_line_code, '')));
  v_stuffing text;
  g public.gate_in_orders;
begin
  if v_prev is not null then return v_prev; end if;
  me := public.assert_permission('GATE_IN_FIELD', 'chỉ Bộ phận Giám định / Hiện trường / Quản lý mới được xác nhận tác nghiệp Hạ vỏ.');
  if trim(coalesce(p_door_photo_path, '')) = '' then
    raise exception 'Bắt buộc phải chụp 1 ảnh cửa container nhìn rõ số container.';
  end if;
  -- DEC-166: Giám định chọn HÃNG TÀU trước → kiểm Phân loại đóng hàng theo Danh mục của hãng
  if not exists (select 1 from public.partners where is_shipping_line and is_active and code = v_line) then
    raise exception 'Vui lòng chọn HÃNG TÀU theo Danh mục chung.';
  end if;
  if not v_deferred then
    v_stuffing := public.resolve_stuffing(v_line, p_stuffing);
    if p_manufacture_year is null or p_manufacture_year < 1980 or p_manufacture_year > extract(year from now())::int + 1 then
      raise exception 'Năm sinh container (AGE) phải theo định dạng 4 chữ số hợp lệ (VD: 2001, 2002...).';
    end if;
  end if;
  -- normalizeCleaningItems: rỗng → KHÔNG VỆ SINH; có mục khác thì bỏ KHÔNG VỆ SINH; bỏ trùng
  v_cleaning := array(select distinct x from unnest(coalesce(p_cleaning_items, '{}')) x where trim(x) <> '');
  if coalesce(array_length(v_cleaning, 1), 0) = 0 then v_cleaning := array['KHÔNG VỆ SINH']; end if;
  if array_length(v_cleaning, 1) > 1 then v_cleaning := array_remove(v_cleaning, 'KHÔNG VỆ SINH'); end if;
  if not public.valid_cleaning_items(v_cleaning) then raise exception 'Hạng mục vệ sinh không hợp lệ.'; end if;
  v_remarks := case when p_condition = 'DAMAGE'
    then array(select trim(x) from unnest(coalesce(p_damage_remarks, '{}')) x where trim(x) <> '') else '{}' end;

  v_code := public.next_code('HV');
  insert into public.gate_in_orders (
    code, door_photo_path, photo_expires_at, initial_container_hint, shipping_line_code, condition_class, damage_remarks,
    stuffing_class, cleaning_items, manufacture_year, to_inspection_rack, field_by, field_by_name
  ) values (
    v_code, trim(p_door_photo_path), (current_date + interval '2 months')::date,
    case when v_hint <> '' and v_hint !~ '^(HS|GD|IN)-' then v_hint end, v_line,
    p_condition, v_remarks, v_stuffing, v_cleaning,
    case when v_deferred then null else p_manufacture_year end, v_deferred, me.id, me.full_name
  ) returning * into g;

  perform public.write_audit('GIAM_DINH_HA_VO', 'GATE_IN', v_code,
    case when v_deferred
      then format('[Hồ sơ %s] Giám định xác nhận Hạ vỏ: W-SURVEY (LÊN KỆ), Vệ sinh [%s] — HẠ KỆ GIÁM ĐỊNH', v_code, array_to_string(v_cleaning, ', '))
      else format('[Hồ sơ %s] Giám định xác nhận Hạ vỏ: Trạng thái %s%s, Hãng %s, Đóng hàng %s, Vệ sinh [%s], AGE %s', v_code, p_condition,
        case when array_length(v_remarks, 1) > 0 then ' (' || array_to_string(v_remarks, ', ') || ')' else '' end,
        v_line, coalesce(v_stuffing, '-'), array_to_string(v_cleaning, ', '), p_manufacture_year)
    end, v_code);
  return public.idem_put(p_request_id, 'record_gate_in_field_step', jsonb_build_object('id', g.id, 'code', g.code));
end $$;

-- ---------------------------------------------------------------------------
-- Giám định bổ sung trên kệ (DEC-166: theo hãng của cont)
-- ---------------------------------------------------------------------------
create or replace function public.complete_rack_inspection(
  p_request_id uuid, p_container_id uuid, p_condition public.condition_class,
  p_stuffing text, p_manufacture_year int, p_damage_remarks text[] default '{}'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me public.staff;
  v_prev jsonb := public.idem_get(p_request_id);
  c public.containers;
  v_remarks text[];
  v_damage boolean := p_condition = 'DAMAGE';
  v_stuffing text;
begin
  if v_prev is not null then return v_prev; end if;
  me := public.assert_permission('GATE_IN_FIELD', 'chỉ Bộ phận Giám định / Hiện trường / Quản lý mới được giám định bổ sung trên kệ.');
  c := public.lock_container_by_id(p_container_id);
  if c.id is null or c.status = 'GATED_OUT' then raise exception 'Không tìm thấy container đang lưu bãi.'; end if;
  if c.condition_class <> 'W-SURVEY' then raise exception 'Container % không ở trạng thái W-SURVEY (đã giám định).', c.container_no; end if;
  if c.status <> 'IN_YARD' then raise exception 'Container % chưa được Xe nâng hạ lên kệ — chưa giám định bổ sung được.', c.container_no; end if;
  if p_condition not in ('AV', 'DAMAGE') then raise exception 'Vui lòng chọn TRẠNG THÁI AV hoặc DAMAGE.'; end if;
  v_stuffing := public.resolve_stuffing(c.shipping_line_code, p_stuffing); -- DEC-166
  if p_manufacture_year is null or p_manufacture_year < 1980 or p_manufacture_year > extract(year from now())::int + 1 then
    raise exception 'Năm sinh container (AGE) phải theo định dạng 4 chữ số hợp lệ (VD: 2001, 2002...).';
  end if;
  v_remarks := case when v_damage then array(select trim(x) from unnest(coalesce(p_damage_remarks, '{}')) x where trim(x) <> '') else '{}' end;
  if v_damage and coalesce(array_length(v_remarks, 1), 0) = 0 then
    raise exception 'Container DAMAGE: chọn ít nhất 1 lỗi hư hỏng hoặc nhập ghi chú.';
  end if;

  update public.containers set condition_class = p_condition, damage_remarks = v_remarks, stuffing_class = v_stuffing,
    manufacture_year = p_manufacture_year, needs_quotation = v_damage
  where id = c.id;
  update public.gate_in_orders set condition_class = p_condition, damage_remarks = v_remarks, stuffing_class = v_stuffing,
    manufacture_year = p_manufacture_year, rack_inspected_by = me.id, rack_inspected_by_name = me.full_name, rack_inspected_at = now()
  where code = c.dossier_code;
  update public.k80_tickets set condition_class = p_condition, damage_remarks = v_remarks, stuffing_class = v_stuffing, manufacture_year = p_manufacture_year
  where dossier_code = c.dossier_code;
  if v_damage then
    insert into public.work_orders (code, container_id, dossier_code, container_no, category, items, assigned_to)
    values ('INSP-' || c.dossier_code, c.id, c.dossier_code, c.container_no, 'INSPECTION', v_remarks, 'Bộ phận Báo giá');
  end if;
  perform public.write_audit('GIAM_DINH_TREN_KE', 'GATE_IN', c.dossier_code,
    format('[Hồ sơ %s] Giám định bổ sung trên kệ %s: Trạng thái %s%s, Đóng hàng %s, AGE %s%s', c.dossier_code, c.container_no, p_condition,
      case when v_damage then ' (' || array_to_string(v_remarks, ', ') || ')' else '' end, coalesce(v_stuffing, '-'), p_manufacture_year,
      case when v_damage then ' → BÁO GIÁ - CHỜ BÁO GIÁ' else '' end), c.dossier_code);
  return public.idem_put(p_request_id, 'complete_rack_inspection', jsonb_build_object('id', c.id));
end $$;

-- ---------------------------------------------------------------------------
-- Văn phòng — Hạ vỏ (DEC-166: kiểm lại theo hãng chốt, + p_stuffing khi đổi hãng)
-- ---------------------------------------------------------------------------
create or replace function public.verify_gate_in_office(
  p_gate_in_id uuid, p_container_no text, p_size text, p_type text, p_truck_no text, p_driver_phone text,
  p_customer_name text, p_shipping_line_code text, p_order_doc_no text, p_fee_ids uuid[], p_stuffing text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me public.staff;
  g public.gate_in_orders;
  v public.vouchers;
  v_no text := upper(trim(coalesce(p_container_no, '')));
  v_truck text := upper(trim(coalesce(p_truck_no, '')));
  v_phone text;
  v_customer text;
  v_conflict text;
  v_amount bigint;
  v_stuffing text;
begin
  me := public.assert_permission('GATE_IN_OFFICE', 'chỉ Bộ phận Văn phòng / Quản lý mới được kiểm tra chứng từ và lập chi phí.');
  select * into g from public.gate_in_orders where id = p_gate_in_id for update;
  if g.id is null then raise exception 'Không tìm thấy lượt Hạ vỏ.'; end if;
  if g.status in ('GATE_IN_OK', 'CANCELLED') then raise exception 'Lượt Hạ vỏ đang ở trạng thái %, không thể lập lại chứng từ.', g.status; end if;
  if g.voucher_id is not null then
    select * into v from public.vouchers where id = g.voucher_id for update;
    if v.status <> 'PENDING' then raise exception 'Chứng từ % đã được xử lý thanh toán, không thể sửa chi phí.', v.voucher_no; end if;
    if exists (select 1 from public.payment_transactions where voucher_id = v.id and status = 'PENDING') then
      raise exception 'Chứng từ đang chờ kết quả chuyển khoản. Hủy yêu cầu chuyển khoản trước khi sửa hồ sơ.';
    end if;
  end if;
  if v_no !~ '^[A-Z]{4}[0-9]{7}$' then raise exception 'SỐ CONTAINER không hợp lệ (chuẩn 4 chữ cái + 7 chữ số, ví dụ MSKU4089123).'; end if;
  if not exists (select 1 from public.container_sizes where code = p_size and is_active) then raise exception 'SIZE không có trong Danh mục chung.'; end if;
  if not exists (select 1 from public.container_types where code = p_type and is_active) then raise exception 'TYPE không có trong Danh mục chung.'; end if;
  if not exists (select 1 from public.partners where is_shipping_line and is_active and code = p_shipping_line_code) then
    raise exception 'Vui lòng chọn HÃNG TÀU theo Danh mục chung.';
  end if;
  -- DEC-166: Phân loại đóng hàng theo hãng Văn phòng chốt (W-SURVEY bổ sung trên kệ)
  if g.condition_class <> 'W-SURVEY' then
    v_stuffing := public.resolve_stuffing(p_shipping_line_code, coalesce(nullif(trim(coalesce(p_stuffing, '')), ''), g.stuffing_class));
  end if;
  v_customer := public.normalize_customer(p_customer_name);
  if v_truck = '' then raise exception 'Văn phòng bắt buộc nhập SỐ XE.'; end if;
  v_phone := public.normalize_driver_phone(p_driver_phone);
  v_conflict := public.gate_in_container_conflict(v_no, g.id);
  if v_conflict is not null then raise exception '%', v_conflict; end if;

  if v.id is null then
    insert into public.vouchers (voucher_no, service_type, dossier_code, container_no, shipping_line_code, payer_name, amount, created_by, created_by_name)
    values (g.code, 'GATE_IN', g.code, v_no, p_shipping_line_code, v_customer, 0, me.id, me.full_name)
    returning * into v;
  end if;
  v_amount := public.write_fee_lines('VOUCHER', v.id, p_fee_ids);
  update public.vouchers set container_no = v_no, shipping_line_code = p_shipping_line_code, payer_name = v_customer, amount = v_amount where id = v.id;
  update public.gate_in_orders set container_no = v_no, size = p_size, type = p_type, truck_no = v_truck, driver_phone = v_phone,
    customer_name = v_customer, shipping_line_code = p_shipping_line_code, stuffing_class = v_stuffing, order_doc_no = trim(coalesce(p_order_doc_no, '')),
    office_by = me.id, office_by_name = me.full_name, office_at = now(), fee_amount = v_amount, voucher_id = v.id, status = 'PAYMENT_PENDING'
  where id = g.id;
  perform public.write_audit('GATE_IN_OFFICE_VERIFY', 'GATE_IN', g.code,
    format('[Hồ sơ %s] Văn phòng bổ sung cont %s (%s%s, Xe %s, SĐT %s) & lập chứng từ %s: %s', g.code, v_no, p_size, p_type, v_truck, v_phone,
      g.code, public.vnd(v_amount)), g.code);
  return jsonb_build_object('gate_in_id', g.id, 'voucher_id', v.id, 'amount', v_amount);
end $$;

-- ---------------------------------------------------------------------------
-- Giám định — Nhập tàu (DEC-166: theo hãng của danh sách)
-- ---------------------------------------------------------------------------
create or replace function public.inspect_vessel_import_item(
  p_request_id uuid, p_list_id uuid, p_item_id uuid, p_actual_container_no text, p_truck_no text,
  p_condition public.condition_class, p_stuffing text, p_cleaning_items text[], p_manufacture_year int,
  p_damage_remarks text[] default '{}', p_door_photo_path text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me public.staff;
  v_prev jsonb := public.idem_get(p_request_id);
  l public.vessel_lists;
  i public.vessel_list_items;
  v_actual text := upper(trim(coalesce(p_actual_container_no, '')));
  v_truck text := upper(trim(coalesce(p_truck_no, '')));
  v_cleaning text[];
  v_remarks text[];
  v_conflict text;
  v_code text;
  v_cid uuid;
  v_damage boolean := p_condition = 'DAMAGE';
  v_clean boolean;
  v_stuffing text;
begin
  if v_prev is not null then return v_prev; end if;
  me := public.assert_permission('VESSEL_IMPORT_INSPECT', 'chỉ Bộ phận Giám định / Quản lý được xác nhận container NHẬP TÀU.');
  l := public.lock_open_vessel_list(p_list_id, 'NHAP_TAU');
  select * into i from public.vessel_list_items where id = p_item_id and list_id = l.id for update;
  if i.id is null then raise exception 'Không tìm thấy container trong danh sách.'; end if;
  if i.status <> 'PENDING' then raise exception 'Container % đã được Giám định xác nhận.', i.container_no; end if;
  if v_actual !~ '^[A-Z]{4}[0-9]{7}$' then raise exception 'SỐ CONTAINER không hợp lệ (chuẩn 4 chữ cái + 7 chữ số, ví dụ MSKU4089123).'; end if;
  if v_actual <> i.container_no then
    raise exception 'Số cont thực tế % không khớp danh sách (%). Kiểm tra lại hoặc báo Văn phòng sửa danh sách.', v_actual, i.container_no;
  end if;
  if not (v_truck = any (l.truck_nos)) then raise exception 'Bắt buộc chọn SỐ XE trong danh sách xe nhập tàu.'; end if;
  if p_condition not in ('AV', 'DAMAGE') then raise exception 'Bắt buộc chọn TRẠNG THÁI: DAMAGE / AV.'; end if; -- W-SURVEY chỉ ở Hạ vỏ
  v_stuffing := public.resolve_stuffing(l.shipping_line_code, p_stuffing); -- DEC-166
  v_cleaning := array(select distinct x from unnest(coalesce(p_cleaning_items, '{}')) x where trim(x) <> '');
  if coalesce(array_length(v_cleaning, 1), 0) = 0 then raise exception 'Bắt buộc chọn TÌNH TRẠNG VỆ SINH (1 hoặc nhiều phương án).'; end if;
  if array_length(v_cleaning, 1) > 1 then v_cleaning := array_remove(v_cleaning, 'KHÔNG VỆ SINH'); end if;
  if not public.valid_cleaning_items(v_cleaning) then raise exception 'Hạng mục vệ sinh không hợp lệ.'; end if;
  if p_manufacture_year is null or p_manufacture_year < 1980 or p_manufacture_year > extract(year from now())::int + 1 then
    raise exception 'Năm sinh container (AGE) phải theo định dạng 4 chữ số hợp lệ (VD: 2001, 2002...).';
  end if;
  v_conflict := public.gate_in_container_conflict(v_actual);
  if v_conflict is not null then raise exception '%', v_conflict; end if;

  v_code := public.next_code('NT');
  v_remarks := case when v_damage then array(select trim(x) from unnest(coalesce(p_damage_remarks, '{}')) x where trim(x) <> '') else '{}' end;
  v_clean := exists (select 1 from unnest(v_cleaning) x where x <> 'KHÔNG VỆ SINH');
  insert into public.containers (dossier_code, container_no, size, type, manufacture_year, shipping_line_code, customer_name, truck_no, status,
    condition_class, damage_remarks, stuffing_class, cleaning_items, active_qr_code, is_paid, needs_cleaning, needs_quotation)
  values (v_code, v_actual, i.size, i.type, p_manufacture_year, coalesce(l.shipping_line_code, ''), '', v_truck, 'WAITING_PLACEMENT',
    p_condition, v_remarks, v_stuffing, v_cleaning, 'QR-' || v_code, false, v_clean, v_damage)
  returning id into v_cid;
  if v_damage then
    insert into public.work_orders (code, container_id, dossier_code, container_no, category, items, assigned_to)
    values ('INSP-' || v_code, v_cid, v_code, v_actual, 'INSPECTION',
      case when array_length(v_remarks, 1) > 0 then v_remarks else array['Hư hỏng ghi nhận khi Nhập tàu'] end, 'Bộ phận Báo giá');
  end if;
  if v_clean then
    insert into public.work_orders (code, container_id, dossier_code, container_no, category, items, assigned_to)
    values ('CLN-' || v_code, v_cid, v_code, v_actual, 'CLEANING', v_cleaning, 'Bộ phận Vệ sinh');
  end if;
  update public.vessel_list_items set status = 'INSPECTED', dossier_code = v_code, container_id = v_cid, truck_no = v_truck,
    condition_class = p_condition, stuffing_class = v_stuffing, cleaning_items = v_cleaning, damage_remarks = v_remarks,
    manufacture_year = p_manufacture_year, door_photo_path = nullif(trim(coalesce(p_door_photo_path, '')), ''),
    inspected_by = me.id, inspected_by_name = me.full_name, inspected_at = now()
  where id = i.id;
  perform public.write_audit('NHAP_TAU_GIAM_DINH', 'VESSEL', v_code,
    format('[Hồ sơ %s] Giám định xác nhận NHẬP TÀU %s (tàu %s, xe %s): %s%s, Đóng hàng %s, Vệ sinh [%s], AGE %s -> %s', v_code, v_actual,
      l.vessel_name, v_truck, p_condition, case when array_length(v_remarks, 1) > 0 then ' (' || array_to_string(v_remarks, ', ') || ')' else '' end,
      coalesce(v_stuffing, '-'), array_to_string(v_cleaning, ', '), p_manufacture_year, case when v_clean then 'Chờ vệ sinh' else 'Chờ hạ vỏ' end), v_code);
  return public.idem_put(p_request_id, 'inspect_vessel_import_item', jsonb_build_object('container_id', v_cid, 'code', v_code));
end $$;

-- ---------------------------------------------------------------------------
-- Danh mục (Admin): thêm / mở lại, ngừng dùng — không xóa cứng (hồ sơ cũ còn dùng mã)
-- ---------------------------------------------------------------------------
create or replace function public.catalog_upsert_stuffing_class(p_shipping_line_code text, p_code text, p_description text default null)
returns public.stuffing_classes
language plpgsql security definer set search_path = public as $$
declare
  v_line text := upper(trim(coalesce(p_shipping_line_code, '')));
  v_code text := upper(trim(coalesce(p_code, '')));
  v_row public.stuffing_classes;
begin
  perform public.assert_admin();
  if not exists (select 1 from public.partners where is_shipping_line and is_active and code = v_line) then
    raise exception 'Vui lòng chọn HÃNG TÀU theo Danh mục chung.';
  end if;
  if v_code !~ '^[A-Z0-9]{1,5}$' then raise exception 'Mã PHÂN LOẠI ĐÓNG HÀNG gồm 1–5 chữ / số (VD: M, K, E).'; end if;
  select * into v_row from public.stuffing_classes where shipping_line_code = v_line and code = v_code for update;
  if v_row.id is not null and v_row.is_active then raise exception 'Hãng tàu % đã có phân loại đóng hàng %.', v_line, v_code; end if;
  if v_row.id is null then
    insert into public.stuffing_classes (shipping_line_code, code, description, sort_order)
    values (v_line, v_code, nullif(trim(coalesce(p_description, '')), ''),
      (select coalesce(max(sort_order), 0) + 1 from public.stuffing_classes where shipping_line_code = v_line))
    returning * into v_row;
  else
    update public.stuffing_classes set is_active = true, description = coalesce(nullif(trim(coalesce(p_description, '')), ''), description)
    where id = v_row.id returning * into v_row;
  end if;
  perform public.write_audit('ADMIN_ADD_STUFFING', 'CATALOG', v_line || '-' || v_code,
    format('[Admin Danh mục chung] Thêm / mở lại PHÂN LOẠI ĐÓNG HÀNG %s cho hãng tàu %s', v_code, v_line));
  return v_row;
end $$;

create or replace function public.catalog_set_stuffing_class_active(p_shipping_line_code text, p_code text, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  update public.stuffing_classes set is_active = p_active where shipping_line_code = upper(trim(p_shipping_line_code)) and code = upper(trim(p_code));
  if not found then raise exception 'Không tìm thấy phân loại % của hãng tàu %.', p_code, p_shipping_line_code; end if;
  perform public.write_audit('ADMIN_SET_STUFFING_ACTIVE', 'CATALOG', upper(trim(p_shipping_line_code)) || '-' || upper(trim(p_code)),
    format('[Admin Danh mục chung] %s PHÂN LOẠI ĐÓNG HÀNG %s của hãng tàu %s', case when p_active then 'Mở lại' else 'Ngừng dùng' end,
      upper(trim(p_code)), upper(trim(p_shipping_line_code))));
end $$;

-- ---------------------------------------------------------------------------
-- Hãng tàu ƯU TIÊN: Giám định Hạ vỏ chọn sẵn — tối đa 1 hãng
-- ---------------------------------------------------------------------------
alter table public.partners add column is_priority boolean not null default false;
create unique index partners_one_priority on public.partners (is_priority) where is_priority;

create or replace function public.catalog_set_partner_priority(p_code text, p_priority boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_code text := upper(trim(coalesce(p_code, '')));
begin
  perform public.assert_admin();
  if not exists (select 1 from public.partners where is_shipping_line and is_active and code = v_code) then
    raise exception 'Không tìm thấy HÃNG TÀU trong Danh mục chung.';
  end if;
  if p_priority then update public.partners set is_priority = false where is_priority and code <> v_code; end if;
  update public.partners set is_priority = p_priority where code = v_code;
  perform public.write_audit('ADMIN_SET_LINE_PRIORITY', 'CATALOG', v_code,
    format('[Admin Danh mục chung] %s ƯU TIÊN hãng tàu %s', case when p_priority then 'Đặt' else 'Bỏ' end, v_code));
end $$;

revoke execute on function
  public.catalog_set_partner_priority(text, boolean),
  public.resolve_stuffing(text, text),
  public.record_gate_in_field_step(uuid, text, public.condition_class, text[], text[], text, int, text, text),
  public.complete_rack_inspection(uuid, uuid, public.condition_class, text, int, text[]),
  public.verify_gate_in_office(uuid, text, text, text, text, text, text, text, text, uuid[], text),
  public.inspect_vessel_import_item(uuid, uuid, uuid, text, text, public.condition_class, text, text[], int, text[], text),
  public.catalog_upsert_stuffing_class(text, text, text),
  public.catalog_set_stuffing_class_active(text, text, boolean)
  from public, anon, authenticated;
grant execute on function public.record_gate_in_field_step(uuid, text, public.condition_class, text[], text[], text, int, text, text) to authenticated;
grant execute on function public.complete_rack_inspection(uuid, uuid, public.condition_class, text, int, text[]) to authenticated;
grant execute on function public.verify_gate_in_office(uuid, text, text, text, text, text, text, text, text, uuid[], text) to authenticated;
grant execute on function public.inspect_vessel_import_item(uuid, uuid, uuid, text, text, public.condition_class, text, text[], int, text[], text) to authenticated;
grant execute on function public.catalog_set_partner_priority(text, boolean) to authenticated;
grant execute on function public.catalog_upsert_stuffing_class(text, text, text) to authenticated;
grant execute on function public.catalog_set_stuffing_class_active(text, text, boolean) to authenticated;
