-- ============================================================================
-- MATRAN DEPOT — Migration 2/5 (phần 2): RPC HIỆN TRƯỜNG / BÃI
-- Hợp đồng nghiệp vụ (giữ đúng thông báo lỗi tiếng Việt): src/services/depotOperations.ts, core.ts
--   recordGateInFieldStep, deleteGateInFieldRecord, completeRackInspection, updateContainerLocation,
--   shiftContainer, correctContainerLocation, completeCleaningTask, saveQuotationDraft,
--   confirmQuotationToRepair, completeRepairTask, toggleContainerHold, updateContainerOfficeNote.
-- Văn phòng Hạ vỏ + thanh toán + GATE IN OK (tạo lượt lưu bãi, K80) ở migration 3 vì cần chứng từ.
-- Mỗi RPC: kiểm quyền → khóa dòng (FOR UPDATE) → kiểm trạng thái → ghi → nhật ký, trong 1 giao dịch.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- HỖ TRỢ VỊ TRÍ
-- ---------------------------------------------------------------------------
-- formatLocation (core.ts): BLOCK-A / 01-02-03; thiếu chiều → ghi nhãn từng chiều
create or replace function public.format_location(p_block text, p_bay text, p_row text, p_tier text) returns text
language sql immutable as $$
  select case
    when p_block is null then '-'
    when p_bay is not null and p_row is not null and p_tier is not null then p_block || ' / ' || p_bay || '-' || p_row || '-' || p_tier
    when coalesce(p_bay, p_row, p_tier) is null then p_block
    else p_block || ' / ' || concat_ws(' • ', 'Bay ' || p_bay, 'Row ' || p_row, 'Tier ' || p_tier)
  end;
$$;

-- validateTargetSlot (core.ts, DEC-082, DEC-087): chiều có cấu hình bắt buộc nhập, trong 1 → tối đa; chống trùng ô khi đủ 3 chiều
create or replace function public.validate_target_slot(
  p_container_id uuid, p_block text, p_bay text, p_row text, p_tier text,
  out slot_block text, out slot_bay text, out slot_row text, out slot_tier text
)
language plpgsql stable security definer set search_path = public as $$
declare
  b public.yard_blocks;
  v_missing text[] := '{}';
  v_dims text[] := '{}';
  v_occupied text;
begin
  select * into b from public.yard_blocks where code = p_block and is_active;
  if b.code is null then raise exception 'Block "%" không hợp lệ (YARD-003).', p_block; end if;
  slot_bay := nullif(trim(coalesce(p_bay, '')), '');
  slot_row := nullif(trim(coalesce(p_row, '')), '');
  slot_tier := nullif(trim(coalesce(p_tier, '')), '');
  if b.max_bay > 0 then
    v_dims := array_append(v_dims, 'Bay');
    if slot_bay is null then v_missing := array_append(v_missing, 'Bay'); end if;
  else
    slot_bay := null;
  end if;
  if b.max_row > 0 then
    v_dims := array_append(v_dims, 'Row');
    if slot_row is null then v_missing := array_append(v_missing, 'Row'); end if;
  else
    slot_row := null;
  end if;
  if b.max_tier > 0 then
    v_dims := array_append(v_dims, 'Tier');
    if slot_tier is null then v_missing := array_append(v_missing, 'Tier'); end if;
  else
    slot_tier := null;
  end if;
  if array_length(v_missing, 1) > 0 then
    raise exception 'Block % có cấu hình % — vui lòng nhập đủ: % (YARD-003).', b.code, array_to_string(v_dims, ' / '), array_to_string(v_missing, ', ');
  end if;
  if slot_bay is not null and (slot_bay !~ '^[0-9]+$' or slot_bay::int < 1 or slot_bay::int > b.max_bay) then
    raise exception 'Bay % nằm ngoài cấu hình của % (1 → %) (YARD-003).', slot_bay, b.code, b.max_bay;
  end if;
  if slot_row is not null and (slot_row !~ '^[0-9]+$' or slot_row::int < 1 or slot_row::int > b.max_row) then
    raise exception 'Row % nằm ngoài cấu hình của % (1 → %) (YARD-003).', slot_row, b.code, b.max_row;
  end if;
  if slot_tier is not null and (slot_tier !~ '^[0-9]+$' or slot_tier::int < 1 or slot_tier::int > b.max_tier) then
    raise exception 'Tier % nằm ngoài cấu hình của % (1 → %) (YARD-003).', slot_tier, b.code, b.max_tier;
  end if;
  slot_block := b.code;
  if slot_bay is not null and slot_row is not null and slot_tier is not null then
    select c.container_no into v_occupied from public.containers c
    where c.id <> p_container_id and c.status <> 'GATED_OUT'
      and c.current_block = slot_block and c.current_bay = slot_bay and c.current_row = slot_row and c.current_tier = slot_tier
    limit 1;
    if v_occupied is not null then
      raise exception 'Ô vị trí % đang có container % (YARD-003).', public.format_location(slot_block, slot_bay, slot_row, slot_tier), v_occupied;
    end if;
  end if;
end $$;

-- findActiveContainer / findActiveContainerByCode — khóa dòng để sửa
create or replace function public.lock_active_container(p_container_no text, p_code text default null) returns public.containers
language plpgsql security definer set search_path = public as $$
declare
  c public.containers;
  v_no text := upper(trim(coalesce(p_container_no, '')));
  v_code text := upper(trim(coalesce(p_code, '')));
begin
  if v_no <> '' then
    select * into c from public.containers where container_no = v_no and status <> 'GATED_OUT' for update;
  end if;
  if c.id is null and v_code <> '' then
    select * into c from public.containers
    where status <> 'GATED_OUT'
      and (upper(active_qr_code) = v_code or upper(dossier_code) = v_code or upper(coalesce(out_dossier_code, '')) = v_code or container_no = v_code)
    limit 1 for update;
  end if;
  return c;
end $$;

create or replace function public.lock_container_by_id(p_id uuid) returns public.containers
language sql security definer set search_path = public as $$
  select * from public.containers where id = p_id for update;
$$;

create or replace function public.add_location_history(
  c public.containers, p_from text, p_to text, p_action public.location_action, p_reason text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  me public.staff := public.current_staff();
begin
  perform public.ensure_location_partition(current_date);
  insert into public.location_history (container_id, dossier_code, container_no, from_location, to_location, action, reason, performed_by, performed_by_name)
  values (c.id, c.dossier_code, c.container_no, p_from, p_to, p_action, p_reason, me.id, me.full_name);
end $$;

-- ---------------------------------------------------------------------------
-- 1. GIÁM ĐỊNH — HẠ VỎ (recordGateInFieldStep, DEC-147 W-SURVEY)
-- ---------------------------------------------------------------------------
create or replace function public.record_gate_in_field_step(
  p_request_id uuid,
  p_door_photo_path text,
  p_condition public.condition_class,
  p_cleaning_items text[],
  p_damage_remarks text[] default '{}',
  p_stuffing public.stuffing_class default null,
  p_manufacture_year int default null,
  p_container_hint text default null
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
  g public.gate_in_orders;
begin
  if v_prev is not null then return v_prev; end if;
  me := public.assert_permission('GATE_IN_FIELD', 'chỉ Bộ phận Giám định / Hiện trường / Quản lý mới được xác nhận tác nghiệp Hạ vỏ.');
  if trim(coalesce(p_door_photo_path, '')) = '' then
    raise exception 'Bắt buộc phải chụp 1 ảnh cửa container nhìn rõ số container.';
  end if;
  if not v_deferred then
    if p_stuffing is null then raise exception 'Vui lòng chọn PHÂN LOẠI ĐÓNG HÀNG (M / K / E).'; end if;
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
    code, door_photo_path, photo_expires_at, initial_container_hint, condition_class, damage_remarks,
    stuffing_class, cleaning_items, manufacture_year, to_inspection_rack, field_by, field_by_name
  ) values (
    v_code, trim(p_door_photo_path), (current_date + interval '24 months')::date,
    case when v_hint <> '' and v_hint !~ '^(HS|GD|IN)-' then v_hint end,
    p_condition, v_remarks, case when v_deferred then null else p_stuffing end, v_cleaning,
    case when v_deferred then null else p_manufacture_year end, v_deferred, me.id, me.full_name
  ) returning * into g;

  perform public.write_audit('GIAM_DINH_HA_VO', 'GATE_IN', v_code,
    case when v_deferred
      then format('[Hồ sơ %s] Giám định xác nhận Hạ vỏ: W-SURVEY (LÊN KỆ), Vệ sinh [%s] — HẠ KỆ GIÁM ĐỊNH', v_code, array_to_string(v_cleaning, ', '))
      else format('[Hồ sơ %s] Giám định xác nhận Hạ vỏ: Trạng thái %s%s, Đóng hàng %s, Vệ sinh [%s], AGE %s', v_code, p_condition,
        case when array_length(v_remarks, 1) > 0 then ' (' || array_to_string(v_remarks, ', ') || ')' else '' end,
        p_stuffing, array_to_string(v_cleaning, ', '), p_manufacture_year)
    end, v_code);
  return public.idem_put(p_request_id, 'record_gate_in_field_step', jsonb_build_object('id', g.id, 'code', g.code));
end $$;

-- Giám định xóa hồ sơ khi Văn phòng chưa thao tác (DEC-059)
create or replace function public.delete_gate_in_field_record(p_gate_in_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  g public.gate_in_orders;
begin
  perform public.assert_permission('GATE_IN_FIELD', 'chỉ Giám định / Quản lý được xóa hồ sơ hạ vỏ.');
  select * into g from public.gate_in_orders where id = p_gate_in_id for update;
  if g.id is null then raise exception 'Không tìm thấy hồ sơ hạ vỏ.'; end if;
  if g.status <> 'FIELD_RECORDED' or g.office_at is not null or g.voucher_id is not null or g.container_no is not null then
    raise exception 'Hồ sơ % đã được Văn phòng xử lý — Giám định không được xóa.', g.code;
  end if;
  delete from public.gate_in_orders where id = g.id;
  perform public.write_audit('DELETE_GATE_IN_FIELD', 'GATE_IN', g.code, format('[Hồ sơ %s] Giám định xóa hồ sơ (Văn phòng chưa thao tác)', g.code), g.code);
end $$;

-- ---------------------------------------------------------------------------
-- 2. GIÁM ĐỊNH BỔ SUNG TRÊN KỆ (completeRackInspection, DEC-147)
-- ---------------------------------------------------------------------------
create or replace function public.complete_rack_inspection(
  p_request_id uuid, p_container_id uuid, p_condition public.condition_class,
  p_stuffing public.stuffing_class, p_manufacture_year int, p_damage_remarks text[] default '{}'
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me public.staff;
  v_prev jsonb := public.idem_get(p_request_id);
  c public.containers;
  v_remarks text[];
  v_damage boolean := p_condition = 'DAMAGE';
begin
  if v_prev is not null then return v_prev; end if;
  me := public.assert_permission('GATE_IN_FIELD', 'chỉ Bộ phận Giám định / Hiện trường / Quản lý mới được giám định bổ sung trên kệ.');
  c := public.lock_container_by_id(p_container_id);
  if c.id is null or c.status = 'GATED_OUT' then raise exception 'Không tìm thấy container đang lưu bãi.'; end if;
  if c.condition_class <> 'W-SURVEY' then raise exception 'Container % không ở trạng thái W-SURVEY (đã giám định).', c.container_no; end if;
  if c.status <> 'IN_YARD' then raise exception 'Container % chưa được Xe nâng hạ lên kệ — chưa giám định bổ sung được.', c.container_no; end if;
  if p_condition not in ('AV', 'DAMAGE') then raise exception 'Vui lòng chọn TRẠNG THÁI AV hoặc DAMAGE.'; end if;
  if p_stuffing is null then raise exception 'Vui lòng chọn PHÂN LOẠI ĐÓNG HÀNG (M / K / E).'; end if;
  if p_manufacture_year is null or p_manufacture_year < 1980 or p_manufacture_year > extract(year from now())::int + 1 then
    raise exception 'Năm sinh container (AGE) phải theo định dạng 4 chữ số hợp lệ (VD: 2001, 2002...).';
  end if;
  v_remarks := case when v_damage then array(select trim(x) from unnest(coalesce(p_damage_remarks, '{}')) x where trim(x) <> '') else '{}' end;
  if v_damage and coalesce(array_length(v_remarks, 1), 0) = 0 then
    raise exception 'Container DAMAGE: chọn ít nhất 1 lỗi hư hỏng hoặc nhập ghi chú.';
  end if;

  update public.containers set condition_class = p_condition, damage_remarks = v_remarks, stuffing_class = p_stuffing,
    manufacture_year = p_manufacture_year, needs_quotation = v_damage
  where id = c.id;
  update public.gate_in_orders set condition_class = p_condition, damage_remarks = v_remarks, stuffing_class = p_stuffing,
    manufacture_year = p_manufacture_year, rack_inspected_by = me.id, rack_inspected_by_name = me.full_name, rack_inspected_at = now()
  where code = c.dossier_code;
  update public.k80_tickets set condition_class = p_condition, damage_remarks = v_remarks, stuffing_class = p_stuffing, manufacture_year = p_manufacture_year
  where dossier_code = c.dossier_code;
  if v_damage then
    insert into public.work_orders (code, container_id, dossier_code, container_no, category, items, assigned_to)
    values ('INSP-' || c.dossier_code, c.id, c.dossier_code, c.container_no, 'INSPECTION', v_remarks, 'Bộ phận Báo giá');
  end if;
  perform public.write_audit('GIAM_DINH_TREN_KE', 'GATE_IN', c.dossier_code,
    format('[Hồ sơ %s] Giám định bổ sung trên kệ %s: Trạng thái %s%s, Đóng hàng %s, AGE %s%s', c.dossier_code, c.container_no, p_condition,
      case when v_damage then ' (' || array_to_string(v_remarks, ', ') || ')' else '' end, p_stuffing, p_manufacture_year,
      case when v_damage then ' → BÁO GIÁ - CHỜ BÁO GIÁ' else '' end), c.dossier_code);
  return public.idem_put(p_request_id, 'complete_rack_inspection', jsonb_build_object('id', c.id));
end $$;

-- ---------------------------------------------------------------------------
-- 3. XE NÂNG — CHỜ HẠ VỎ (updateContainerLocation)
-- ---------------------------------------------------------------------------
create or replace function public.update_container_location(
  p_request_id uuid, p_block text, p_bay text default null, p_row text default null, p_tier text default null,
  p_reason text default '', p_container_no text default null, p_scanned_code text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_prev jsonb := public.idem_get(p_request_id);
  c public.containers;
  s record;
  v_racks text[];
  v_to text;
begin
  if v_prev is not null then return v_prev; end if;
  perform public.assert_permission('FORKLIFT_OPS', 'chỉ Bộ phận Xe nâng / Hiện trường / Văn phòng / Quản lý mới được hạ vỏ.');
  c := public.lock_active_container(p_container_no, p_scanned_code);
  if c.id is null then raise exception 'Không tìm thấy container tương ứng với mã QR / Mã hồ sơ / số container vừa quét.'; end if;
  if c.status <> 'WAITING_PLACEMENT' then
    raise exception 'Container % không nằm trong hàng chờ HẠ VỎ (dùng ĐẢO CHUYỂN cho container đã tồn bãi).', c.container_no;
  end if;
  if c.needs_cleaning then
    raise exception 'Container % có yêu cầu vệ sinh — Bộ phận Vệ sinh phải xác nhận hoàn tất trước khi Xe nâng hạ vỏ (CR-03).', c.container_no;
  end if;
  if c.forklift_task = 'HA_KE_GIAM_DINH' then
    v_racks := array(select code from public.yard_blocks where is_inspection_rack and is_active order by code);
    if coalesce(array_length(v_racks, 1), 0) = 0 then
      raise exception 'Chưa có KỆ GIÁM ĐỊNH trong Danh mục Vị trí — Admin cần đánh dấu block Kệ giám định.';
    end if;
    if not (p_block = any (v_racks)) then
      raise exception 'Container % phải HẠ KỆ GIÁM ĐỊNH (%), không hạ về bay.', c.container_no, array_to_string(v_racks, ' / ');
    end if;
  end if;
  select * into s from public.validate_target_slot(c.id, p_block, p_bay, p_row, p_tier);
  v_to := public.format_location(s.slot_block, s.slot_bay, s.slot_row, s.slot_tier);
  update public.containers set status = 'IN_YARD', current_block = s.slot_block, current_bay = s.slot_bay, current_row = s.slot_row, current_tier = s.slot_tier
  where id = c.id;
  perform public.add_location_history(c, 'Chờ hạ vỏ (GATE IN)', v_to, 'INITIAL_BLOCK', coalesce(nullif(trim(p_reason), ''), 'Xe nâng hạ vỏ'));
  perform public.write_audit('YARD_PLACEMENT', 'CONTAINER', c.dossier_code,
    format('[Hồ sơ %s] Xe nâng hạ vỏ %s vào %s', c.dossier_code, c.container_no, v_to), c.dossier_code);
  -- DEC-069: cont NHẬP TÀU được hạ → hoàn thành trong danh sách tàu (migration 4 thêm bước này)
  return public.idem_put(p_request_id, 'update_container_location', jsonb_build_object('id', c.id, 'location', v_to));
end $$;

-- ---------------------------------------------------------------------------
-- 4. ĐẢO CHUYỂN (shiftContainer) & SỬA VỊ TRÍ hành chính (correctContainerLocation)
-- ---------------------------------------------------------------------------
create or replace function public.shift_container(
  p_request_id uuid, p_container_id uuid, p_block text, p_bay text default null, p_row text default null,
  p_tier text default null, p_note text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_prev jsonb := public.idem_get(p_request_id);
  c public.containers;
  s record;
  v_from text;
  v_to text;
begin
  if v_prev is not null then return v_prev; end if;
  perform public.assert_permission('FORKLIFT_OPS', 'chỉ Bộ phận Xe nâng / Hiện trường / Văn phòng / Quản lý mới được đảo chuyển.');
  c := public.lock_container_by_id(p_container_id);
  if c.id is null then raise exception 'Không tìm thấy container đang tồn bãi.'; end if;
  if c.status not in ('IN_YARD', 'ALLOCATED') or c.current_block is null then
    raise exception 'Container % chưa có vị trí chính thức trong bãi.', c.container_no;
  end if;
  select * into s from public.validate_target_slot(c.id, p_block, p_bay, p_row, p_tier);
  v_from := public.format_location(c.current_block, c.current_bay, c.current_row, c.current_tier);
  v_to := public.format_location(s.slot_block, s.slot_bay, s.slot_row, s.slot_tier);
  if v_from = v_to then raise exception 'Vị trí mới trùng với vị trí hiện tại.'; end if;
  update public.containers set current_block = s.slot_block, current_bay = s.slot_bay, current_row = s.slot_row, current_tier = s.slot_tier,
    forklift_task = 'NONE'
  where id = c.id;
  perform public.add_location_history(c, v_from, v_to, 'YARD_SHIFT', coalesce(nullif(trim(p_note), ''), 'ĐẢO CHUYỂN'));
  perform public.write_audit('YARD_SHIFT', 'CONTAINER', c.dossier_code,
    format('[Hồ sơ %s] ĐẢO CHUYỂN %s: %s -> %s', c.dossier_code, c.container_no, v_from, v_to), c.dossier_code);
  return public.idem_put(p_request_id, 'shift_container', jsonb_build_object('id', c.id, 'location', v_to));
end $$;

create or replace function public.correct_container_location(
  p_container_id uuid, p_block text, p_bay text default null, p_row text default null, p_tier text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  c public.containers;
  s record;
  v_from text;
  v_to text;
begin
  perform public.assert_permission('YARD_LOCATION_CORRECT', 'chỉ Văn phòng / Quản lý được sửa vị trí bãi.');
  c := public.lock_container_by_id(p_container_id);
  if c.id is null then raise exception 'Không tìm thấy container đang tồn bãi.'; end if;
  if c.status not in ('IN_YARD', 'ALLOCATED') or c.current_block is null then
    raise exception 'Container % chưa có vị trí chính thức trong bãi.', c.container_no;
  end if;
  select * into s from public.validate_target_slot(c.id, p_block, p_bay, p_row, p_tier);
  v_from := public.format_location(c.current_block, c.current_bay, c.current_row, c.current_tier);
  v_to := public.format_location(s.slot_block, s.slot_bay, s.slot_row, s.slot_tier);
  if v_from = v_to then raise exception 'Vị trí mới trùng với vị trí hiện tại.'; end if;
  update public.containers set current_block = s.slot_block, current_bay = s.slot_bay, current_row = s.slot_row, current_tier = s.slot_tier
  where id = c.id;
  -- CR-02: chỉ nhật ký hệ thống, không phải lịch sử tác nghiệp Xe nâng
  perform public.write_audit('YARD_LOCATION_CORRECTION', 'CONTAINER', c.dossier_code,
    format('[Hồ sơ %s] Văn phòng SỬA VỊ TRÍ %s: %s -> %s', c.dossier_code, c.container_no, v_from, v_to), c.dossier_code);
  return jsonb_build_object('id', c.id, 'location', v_to);
end $$;

-- ---------------------------------------------------------------------------
-- 5. VỆ SINH (completeCleaningTask — Văn phòng làm thay được, DEC-035)
-- ---------------------------------------------------------------------------
create or replace function public.complete_cleaning_task(
  p_request_id uuid, p_container_no text default null, p_scanned_code text default null, p_notes text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me public.staff;
  v_prev jsonb := public.idem_get(p_request_id);
  c public.containers;
begin
  if v_prev is not null then return v_prev; end if;
  me := public.assert_permission('CLEANING_COMPLETE', 'chỉ Bộ phận Vệ sinh / Văn phòng được xác nhận hoàn tất vệ sinh.');
  c := public.lock_active_container(p_container_no, p_scanned_code);
  if c.id is null or not c.needs_cleaning then
    raise exception 'Không tìm thấy container đang chờ vệ sinh khớp với mã QR / Mã hồ sơ / số container.';
  end if;
  update public.containers set needs_cleaning = false where id = c.id;
  update public.work_orders set work_status = 'COMPLETED', completed_at = now(), completed_by = me.id, completed_by_name = me.full_name,
    result_notes = coalesce(nullif(trim(p_notes), ''), 'Đã xác nhận hoàn thành vệ sinh')
  where container_id = c.id and category = 'CLEANING' and work_status = 'OPEN';
  perform public.write_audit('COMPLETE_CLEANING', 'CLEANING', c.dossier_code,
    format('[Hồ sơ %s] Hoàn tất vệ sinh [%s] cho %s', c.dossier_code, array_to_string(c.cleaning_items, ', '), c.container_no), c.dossier_code);
  return public.idem_put(p_request_id, 'complete_cleaning_task', jsonb_build_object('id', c.id));
end $$;

-- ---------------------------------------------------------------------------
-- 6. BÁO GIÁ 2 bước (DEC-086): cập nhật → xác nhận chờ sửa chữa
-- ---------------------------------------------------------------------------
create or replace function public.save_quotation_draft(p_container_no text, p_items text[], p_labor_hours numeric) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me public.staff;
  c public.containers;
  v_items text[] := array(select trim(x) from unnest(coalesce(p_items, '{}')) x where trim(x) <> '');
begin
  me := public.assert_permission('QUOTATION', 'chỉ Bộ phận Báo giá được cập nhật báo giá.');
  c := public.lock_active_container(p_container_no);
  if c.id is null or not c.needs_quotation then raise exception 'Container không nằm trong hàng chờ Báo giá.'; end if;
  if coalesce(array_length(v_items, 1), 0) = 0 then raise exception 'Vui lòng nhập TÌNH TRẠNG SỬA CHỮA.'; end if;
  if p_labor_hours is null or p_labor_hours <= 0 or p_labor_hours > 1000 then raise exception 'Vui lòng nhập GIỜ CÔNG SỬA CHỮA lớn hơn 0.'; end if;
  update public.containers set quotation_items = v_items, quotation_labor_hours = p_labor_hours, quotation_by_name = me.full_name, quotation_at = now()
  where id = c.id;
  perform public.write_audit('SAVE_QUOTATION', 'QUOTATION', c.dossier_code,
    format('[Hồ sơ %s] Báo giá cập nhật %s: TÌNH TRẠNG SỬA CHỮA [%s] • %s giờ công (chưa chuyển sửa chữa)', c.dossier_code, c.container_no,
      array_to_string(v_items, ', '), p_labor_hours), c.dossier_code);
  return jsonb_build_object('id', c.id);
end $$;

create or replace function public.confirm_quotation_to_repair(p_container_no text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me public.staff;
  c public.containers;
begin
  me := public.assert_permission('QUOTATION', 'chỉ Bộ phận Báo giá được xác nhận báo giá.');
  c := public.lock_active_container(p_container_no);
  if c.id is null or not c.needs_quotation then raise exception 'Container không nằm trong hàng chờ Báo giá.'; end if;
  if coalesce(array_length(c.quotation_items, 1), 0) = 0 or coalesce(c.quotation_labor_hours, 0) <= 0 then
    raise exception 'Chưa cập nhật TÌNH TRẠNG SỬA CHỮA / GIỜ CÔNG cho % — bấm "Cập nhật" trước.', c.container_no;
  end if;
  update public.containers set needs_quotation = false, needs_repair = true where id = c.id;
  update public.work_orders set work_status = 'COMPLETED', completed_at = now(), completed_by = me.id, completed_by_name = me.full_name
  where container_id = c.id and category = 'INSPECTION' and work_status = 'OPEN';
  insert into public.work_orders (code, container_id, dossier_code, container_no, category, items, approval_status, approved_by_name, assigned_to, labor_hours)
  values ('MNR-' || c.dossier_code, c.id, c.dossier_code, c.container_no, 'REPAIR', c.quotation_items, 'APPROVED', me.full_name, 'Bộ phận Sửa chữa', c.quotation_labor_hours);
  perform public.write_audit('APPROVE_QUOTATION', 'QUOTATION', c.dossier_code,
    format('[Hồ sơ %s] Báo giá %s: REMARK [%s] • %s giờ công -> CHỜ SỬA CHỮA', c.dossier_code, c.container_no,
      array_to_string(c.quotation_items, ', '), c.quotation_labor_hours), c.dossier_code);
  return jsonb_build_object('id', c.id);
end $$;

-- ---------------------------------------------------------------------------
-- 7. SỬA CHỮA → AV (completeRepairTask, DEC-043, DEC-049)
-- ---------------------------------------------------------------------------
create or replace function public.complete_repair_task(
  p_request_id uuid, p_team_id uuid, p_member_ids uuid[], p_container_no text default null,
  p_scanned_code text default null, p_notes text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me public.staff;
  v_prev jsonb := public.idem_get(p_request_id);
  c public.containers;
  t public.repair_teams;
  v_wo uuid;
  v_names text[];
  v_count int;
begin
  if v_prev is not null then return v_prev; end if;
  me := public.assert_permission('REPAIR', 'chỉ Bộ phận Sửa chữa được xác nhận hoàn tất sửa chữa.');
  c := public.lock_active_container(p_container_no, p_scanned_code);
  if c.id is null or not c.needs_repair then
    raise exception 'Không tìm thấy container đang chờ sửa chữa khớp với mã QR / Mã hồ sơ / số container.';
  end if;
  select * into t from public.repair_teams where id = p_team_id and is_active;
  if t.id is null then raise exception 'Vui lòng chọn TỔ SỬA CHỮA.'; end if;
  select count(*), array_agg(full_name order by full_name) into v_count, v_names
  from public.repair_team_members where team_id = t.id and is_active and id = any (coalesce(p_member_ids, '{}'));
  if v_count = 0 then raise exception 'Phải chọn ít nhất 1 nhân viên trong tổ sửa chữa.'; end if;
  if v_count <> (select count(distinct x) from unnest(p_member_ids) x) then
    raise exception 'Có nhân viên không thuộc tổ đã chọn hoặc đã ngưng hoạt động.';
  end if;
  update public.containers set needs_repair = false, condition_class = 'AV', damage_remarks = '{}' where id = c.id;
  update public.work_orders set work_status = 'COMPLETED', completed_at = now(), completed_by = me.id, completed_by_name = me.full_name,
    result_notes = coalesce(nullif(trim(p_notes), ''), 'Đã sửa chữa hoàn tất -> AV'), repair_team_id = t.id, repair_team_code = t.code, repair_team_name = t.name
  where container_id = c.id and category = 'REPAIR' and work_status = 'OPEN'
  returning id into v_wo;
  if v_wo is not null then
    insert into public.work_order_members (work_order_id, member_id, member_name)
    select v_wo, m.id, m.full_name from public.repair_team_members m where m.team_id = t.id and m.is_active and m.id = any (p_member_ids);
  end if;
  perform public.write_audit('COMPLETE_REPAIR_TO_AV', 'REPAIR', c.dossier_code,
    format('[Hồ sơ %s] Hoàn tất sửa chữa %s -> AV • %s: %s', c.dossier_code, c.container_no, t.name, array_to_string(v_names, ', ')), c.dossier_code);
  return public.idem_put(p_request_id, 'complete_repair_task', jsonb_build_object('id', c.id));
end $$;

-- ---------------------------------------------------------------------------
-- 8. KHÓA CONTAINER (toggleContainerHold, DEC-030, DEC-065, DEC-131) & GHI CHÚ TỒN VỎ
-- ---------------------------------------------------------------------------
create or replace function public.toggle_container_hold(p_container_no text, p_hold boolean, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me public.staff;
  c public.containers;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  me := public.assert_permission('CONTAINER_LOCK', 'chỉ Văn phòng / Quản lý được khóa / mở khóa container.');
  if v_reason = '' then
    raise exception '%', case when p_hold then 'Bắt buộc nhập REMARK VĂN PHÒNG khi khóa container.' else 'Bắt buộc nhập ghi chú khi mở khóa container.' end;
  end if;
  c := public.lock_active_container(p_container_no);
  if c.id is null then raise exception 'Không tìm thấy container đang tồn bãi.'; end if;
  if c.hold_source = 'VESSEL_EXPORT' then
    raise exception 'Container % đang khóa do % — bỏ khỏi danh sách Xuất tàu để mở khóa.', c.container_no, c.hold_reason;
  end if;
  if c.is_on_hold = p_hold then
    raise exception '%', case when p_hold then 'Container đã đang bị khóa.' else 'Container hiện không bị khóa.' end;
  end if;
  if p_hold then
    update public.containers set is_on_hold = true, hold_reason = v_reason, hold_by_name = me.full_name, hold_at = now(),
      office_note = v_reason, office_note_by_name = me.full_name, office_note_at = now()
    where id = c.id;
  else
    update public.containers set is_on_hold = false, hold_reason = null, hold_by_name = null, hold_at = null where id = c.id;
  end if;
  perform public.write_audit(case when p_hold then 'CONTAINER_LOCK' else 'CONTAINER_UNLOCK' end, 'CONTAINER', c.dossier_code,
    format('[Hồ sơ %s] %s container %s: %s', c.dossier_code, case when p_hold then 'KHÓA' else 'MỞ KHÓA' end, c.container_no, v_reason), c.dossier_code);
  return jsonb_build_object('id', c.id);
end $$;

create or replace function public.update_container_office_note(p_container_id uuid, p_note text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me public.staff;
  c public.containers;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
begin
  me := public.assert_permission('OFFICE_NOTE', 'chỉ Văn phòng / Quản lý được ghi chú tồn vỏ.');
  c := public.lock_container_by_id(p_container_id);
  if c.id is null then raise exception 'Không tìm thấy container.'; end if;
  if c.hold_source = 'VESSEL_EXPORT' then
    raise exception 'Container % đang khóa do % — ghi chú do danh sách Xuất tàu quản lý.', c.container_no, c.hold_reason;
  end if;
  update public.containers set office_note = v_note,
    office_note_by_name = case when v_note is null then null else me.full_name end,
    office_note_at = case when v_note is null then null else now() end
  where id = c.id;
  perform public.write_audit('UPDATE_TON_VO_NOTE', 'CONTAINER', c.dossier_code,
    case when v_note is null then format('[Hồ sơ %s] Văn phòng xóa Ghi chú tồn vỏ cho %s', c.dossier_code, c.container_no)
         else format('[Hồ sơ %s] Văn phòng thêm Ghi chú tồn vỏ cho %s: "%s"', c.dossier_code, c.container_no, v_note) end, c.dossier_code);
  return jsonb_build_object('id', c.id);
end $$;

-- Danh mục: không ngừng dùng block đang có container (định nghĩa lại hàm ở migration 1)
create or replace function public.catalog_set_yard_block_active(p_code text, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  if not p_active and exists (select 1 from public.containers where current_block = upper(trim(p_code)) and status <> 'GATED_OUT') then
    raise exception 'Block % đang có container trong bãi, không ngừng dùng được.', upper(trim(p_code));
  end if;
  update public.yard_blocks set is_active = p_active where code = upper(trim(p_code));
  if not found then raise exception 'Không tìm thấy block %.', p_code; end if;
  perform public.write_audit('ADMIN_SET_YARD_BLOCK_ACTIVE', 'CATALOG', upper(trim(p_code)),
    format('[Admin Danh mục chung] %s vị trí %s', case when p_active then 'Mở lại' else 'Ngừng dùng' end, upper(trim(p_code))));
end $$;

-- ---------------------------------------------------------------------------
-- QUYỀN GỌI — thu hồi hết rồi cấp lại từng hàm (Supabase mặc định cấp execute cho anon / authenticated)
-- ---------------------------------------------------------------------------
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.is_active_staff() to authenticated;
grant execute on function public.has_any_role(public.app_role[]) to authenticated;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.format_location(text, text, text, text) to authenticated;
grant execute on function public.catalog_upsert_partner(text, text, boolean, boolean, boolean) to authenticated;
grant execute on function public.catalog_set_partner_active(text, boolean) to authenticated;
grant execute on function public.catalog_add_size(text) to authenticated;
grant execute on function public.catalog_add_type(text) to authenticated;
grant execute on function public.catalog_upsert_yard_block(text, text, int, int, int, int, text, boolean) to authenticated;
grant execute on function public.catalog_set_inspection_rack(text, boolean) to authenticated;
grant execute on function public.catalog_set_yard_block_active(text, boolean) to authenticated;
grant execute on function public.catalog_add_fee(public.fee_category, bigint, text, text, text, text) to authenticated;
grant execute on function public.catalog_set_fee_active(uuid, boolean) to authenticated;
grant execute on function public.catalog_update_company(text, text, text, text, text, text, text) to authenticated;
grant execute on function public.catalog_upsert_repair_team(text, text, boolean) to authenticated;
grant execute on function public.catalog_upsert_repair_member(uuid, text, uuid, boolean, uuid) to authenticated;
grant execute on function public.admin_update_staff(uuid, text, text, public.app_role[], boolean) to authenticated;
grant execute on function public.staff_password_changed() to authenticated;
grant execute on function public.register_staff(uuid, uuid, text, text, text, public.app_role[]) to service_role;
grant execute on function public.mark_password_reset(uuid, uuid) to service_role;
-- Bước 2
grant execute on function public.record_gate_in_field_step(uuid, text, public.condition_class, text[], text[], public.stuffing_class, int, text) to authenticated;
grant execute on function public.delete_gate_in_field_record(uuid) to authenticated;
grant execute on function public.complete_rack_inspection(uuid, uuid, public.condition_class, public.stuffing_class, int, text[]) to authenticated;
grant execute on function public.update_container_location(uuid, text, text, text, text, text, text, text) to authenticated;
grant execute on function public.shift_container(uuid, uuid, text, text, text, text, text) to authenticated;
grant execute on function public.correct_container_location(uuid, text, text, text, text) to authenticated;
grant execute on function public.complete_cleaning_task(uuid, text, text, text) to authenticated;
grant execute on function public.save_quotation_draft(text, text[], numeric) to authenticated;
grant execute on function public.confirm_quotation_to_repair(text) to authenticated;
grant execute on function public.complete_repair_task(uuid, uuid, uuid[], text, text, text) to authenticated;
grant execute on function public.toggle_container_hold(text, boolean, text) to authenticated;
grant execute on function public.update_container_office_note(uuid, text) to authenticated;
