-- ============================================================================
-- MATRAN DEPOT — Người dùng 2026-11-02: trạng thái W-SURVEY HIỂN THỊ là "GIÁM ĐỊNH SAU" (đồng bộ app).
--   Mã condition_class 'W-SURVEY' GIỮ NGUYÊN (dữ liệu / kiểm tra không đổi) — chỉ đổi chữ trong nhật ký + thông báo lỗi.
--   Chép nguyên 2 hàm từ 20261104000001_stuffing_catalog.sql (bản mới nhất), chỉ thay chữ; cùng chữ ký → quyền giữ nguyên.
-- Hợp đồng: conditionLabel / DEFERRED_LABEL (src/types/depot.ts), recordGateInFieldStep, completeRackInspection.
-- ============================================================================

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
      then format('[Hồ sơ %s] Giám định xác nhận Hạ vỏ: GIÁM ĐỊNH SAU (LÊN KỆ), Vệ sinh [%s] — HẠ KỆ GIÁM ĐỊNH', v_code, array_to_string(v_cleaning, ', '))
      else format('[Hồ sơ %s] Giám định xác nhận Hạ vỏ: Trạng thái %s%s, Hãng %s, Đóng hàng %s, Vệ sinh [%s], AGE %s', v_code, p_condition,
        case when array_length(v_remarks, 1) > 0 then ' (' || array_to_string(v_remarks, ', ') || ')' else '' end,
        v_line, coalesce(v_stuffing, '-'), array_to_string(v_cleaning, ', '), p_manufacture_year)
    end, v_code);
  return public.idem_put(p_request_id, 'record_gate_in_field_step', jsonb_build_object('id', g.id, 'code', g.code));
end $$;

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
  if c.condition_class <> 'W-SURVEY' then raise exception 'Container % không ở trạng thái GIÁM ĐỊNH SAU (đã giám định).', c.container_no; end if;
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
