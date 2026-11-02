-- ============================================================================
-- MATRAN DEPOT — DEC-207 (người dùng 2026-11-02): BÁO GIÁ THEO AEMS cho hãng bật aemsQuotation (MSK).
--   containers.aems_quote (jsonb, cùng cấu trúc AemsQuote ở app) — database TÍNH LẠI toàn bộ từ dòng + Danh mục CODE CEDEX:
--     Damage Code ∈ cedex_codes (DAMAGE) • Repair Code ∈ repair_codes (theo Mode, trừ mã giờ công / PREPARATION) • Loc 4 ký tự •
--     TPI W / T • Pcs ≤ Max Qty • giờ sửa = Σ Pcs × Man Hrs • Preparation theo khoảng giờ trong tên mã PREPARATION •
--     tiền công = tổng giờ × đơn giá mã "Man hour rate" • VND, VAT 0.
--   set_aems_approval: trạng thái duyệt Maersk (nhập tay — sau này API). Trigger chặn chuyển Sửa chữa khi chưa Approved.
-- Hợp đồng: src/services/carriers/maersk/aems.ts (computeAemsQuote), src/services/aemsQuotation.ts.
-- Danh sách hãng khớp CarrierProfile.features.aemsQuotation: aems_quotation_lines().
-- ============================================================================

alter table public.containers add column aems_quote jsonb;

create or replace function public.aems_quotation_lines() returns text[]
language sql immutable as $$ select array['MSK'] $$;

-- Giờ chuẩn bị theo tổng giờ sửa: khoảng (min, max] đọc từ tên mã PREPARATION
create or replace function public.aems_preparation(p_line text, p_hours numeric) returns numeric
language plpgsql stable set search_path = public as $$
declare
  r public.repair_codes;
  m text[];
  v_min numeric;
  v_max numeric;
begin
  if coalesce(p_hours, 0) <= 0 then return 0; end if;
  for r in select * from public.repair_codes where shipping_line_code = p_line and is_active and repair_name ~* '^\s*preparation\M' order by item_name loop
    v_min := null; v_max := null;
    m := regexp_match(r.repair_name, '(?:less than or equal to|up to|not exceeding)\s*(\d+(?:\.\d+)?)', 'i');
    if m is not null then v_min := -1; v_max := m[1]::numeric; end if;
    if v_max is null then
      m := regexp_match(r.repair_name, 'between\s*(\d+(?:\.\d+)?)\s*(?:&|and|-|to)\s*(\d+(?:\.\d+)?)', 'i');
      if m is not null then v_min := m[1]::numeric; v_max := m[2]::numeric; end if;
    end if;
    if v_max is null then
      m := regexp_match(r.repair_name, '(?:exceeding|more than|over|above)\s*(\d+(?:\.\d+)?)', 'i');
      if m is not null then v_min := m[1]::numeric; v_max := 1e9; end if;
    end if;
    if v_max is not null and p_hours > v_min and p_hours <= v_max then return r.man_hour; end if;
  end loop;
  return 0;
end $$;

create or replace function public.save_aems_quotation(p_container_no text, p_mode text, p_remark text, p_lines jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me public.staff;
  c public.containers;
  v_mode text := upper(trim(coalesce(nullif(p_mode, ''), '03')));
  v_remark text := nullif(trim(coalesce(p_remark, '')), '');
  v_rate numeric;
  l jsonb;
  rc public.repair_codes;
  n int := 0;
  v_dmg text; v_code text; v_loc text; v_tpi text; v_pcs int; v_hrs numeric; v_mat numeric;
  v_lines jsonb := '[]';
  v_texts text[] := '{}';
  v_repair numeric := 0; v_material numeric := 0; v_w numeric := 0; v_t numeric := 0;
  v_prep numeric; v_total numeric; v_labor numeric;
  v_quote jsonb;
begin
  me := public.assert_permission('QUOTATION', 'chỉ Bộ phận Báo giá được cập nhật báo giá.');
  c := public.lock_active_container(p_container_no);
  if c.id is null or not c.needs_quotation then raise exception 'Container không nằm trong hàng chờ Báo giá.'; end if;
  if c.shipping_line_code <> all (public.aems_quotation_lines()) then raise exception 'Hãng % không báo giá theo AEMS.', c.shipping_line_code; end if;
  if c.aems_quote->>'approval' = 'APPROVED' then
    raise exception '%: Maersk đã duyệt (Approved) — không sửa phiếu; bấm XÁC NHẬN CHỜ SỬA CHỮA.', c.container_no;
  end if;
  select material_rate into v_rate from public.repair_codes
  where shipping_line_code = c.shipping_line_code and is_active and repair_name ~* 'man\s*hour\s*rate' order by item_name limit 1;
  if v_rate is null then raise exception 'Danh mục CODE CEDEX chưa có mã đơn giá giờ công ("Man hour rate…") — Admin nhập MÃ SỬA CHỮA trước.'; end if;
  if jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then raise exception 'Phiếu báo giá cần ít nhất 1 dòng sửa chữa.'; end if;
  if length(coalesce(v_remark, '')) > 255 then raise exception 'Ghi chú tối đa 255 ký tự.'; end if;

  for l in select * from jsonb_array_elements(p_lines) loop
    n := n + 1;
    v_dmg := upper(trim(coalesce(l->>'damageCode', '')));
    v_code := upper(trim(coalesce(l->>'repairCode', '')));
    v_loc := upper(trim(coalesce(l->>'locCode', '')));
    v_tpi := l->>'tpi';
    if v_dmg = '' then raise exception 'Dòng %: chọn Damage Code.', n; end if;
    if not exists (select 1 from public.cedex_codes where shipping_line_code = c.shipping_line_code and kind = 'DAMAGE' and code = v_dmg and is_active) then
      raise exception 'Dòng %: Damage Code % không có trong Danh mục CODE CEDEX (MÃ HƯ HỎNG).', n, v_dmg;
    end if;
    if v_code = '' then raise exception 'Dòng %: chọn Repair Code.', n; end if;
    select * into rc from public.repair_codes
    where shipping_line_code = c.shipping_line_code and is_active and repair_code = v_code and repair_mode = v_mode
      and repair_name !~* 'man\s*hour\s*rate' and repair_name !~* '^\s*preparation\M'
    order by item_name limit 1;
    if rc.id is null then raise exception 'Dòng %: Repair Code % (Mode %) không có trong Danh mục MÃ SỬA CHỮA.', n, v_code, v_mode; end if;
    if v_loc !~ '^[A-Z0-9]{4}$' then raise exception 'Dòng %: Repair Loc code phải 4 ký tự chữ / số (VD BR5N, IXXX).', n; end if;
    if coalesce(v_tpi, '') not in ('W', 'T') then raise exception 'Dòng %: chọn TPI (W hao mòn / T bên thứ 3).', n; end if;
    if coalesce(l->>'pcs', '') !~ '^[0-9]+$' or (l->>'pcs')::int < 1 then raise exception 'Dòng %: Pcs là số nguyên ≥ 1.', n; end if;
    v_pcs := (l->>'pcs')::int;
    if rc.max_qty is not null and v_pcs > rc.max_qty then raise exception 'Dòng %: Repair Code % tối đa % / work order.', n, rc.repair_code, rc.max_qty; end if;
    v_hrs := coalesce((l->>'manHours')::numeric, rc.man_hour);
    v_mat := coalesce((l->>'materialCost')::numeric, rc.material_rate);
    if v_hrs < 0 or v_hrs <> round(v_hrs, 2) then raise exception 'Dòng %: Man Hrs/pc là số ≥ 0, tối đa 2 số lẻ.', n; end if;
    if v_mat < 0 or v_mat <> round(v_mat, 2) then raise exception 'Dòng %: Material cost/pc là số ≥ 0, tối đa 2 số lẻ.', n; end if;
    v_repair := v_repair + v_pcs * v_hrs;
    v_material := v_material + round(v_pcs * v_mat, 2);
    if v_tpi = 'W' then v_w := v_w + round(v_pcs * v_mat, 2); else v_t := v_t + round(v_pcs * v_mat, 2); end if;
    v_lines := v_lines || jsonb_build_object('id', gen_random_uuid(), 'damageCode', v_dmg, 'repairCode', rc.repair_code, 'locCode', v_loc, 'tpi', v_tpi,
      'pcs', v_pcs, 'manHours', v_hrs, 'materialCost', v_mat, 'itemTotal', round(v_pcs * v_mat, 2));
    v_texts := v_texts || format('%s %s %s ×%s (%s)', v_loc, v_dmg, rc.repair_code, v_pcs, v_tpi);
  end loop;

  v_repair := round(v_repair, 2);
  v_prep := public.aems_preparation(c.shipping_line_code, v_repair);
  v_total := round(v_repair + v_prep, 2);
  if v_total <= 0 then raise exception 'Tổng giờ công phải lớn hơn 0 (kiểm tra Man Hrs/pc).'; end if;
  if v_total > 1000 then raise exception 'Tổng giờ công tối đa 1000.'; end if;
  v_labor := round(v_total * v_rate, 2);

  v_quote := jsonb_build_object(
    'mode', v_mode, 'cause', case when v_t > 0 or exists (select 1 from jsonb_array_elements(v_lines) x where x->>'tpi' = 'T') then 'Third Party' else '1 - Wear And Tear' end,
    'remark', v_remark, 'lines', v_lines,
    'repairHours', v_repair, 'preparationHours', v_prep, 'totalHours', v_total, 'laborRate', v_rate, 'laborCost', v_labor,
    'materialCost', round(v_material, 2), 'wearTearTotal', round(v_w, 2), 'thirdPartyTotal', round(v_t, 2),
    'totalExclVat', round(v_labor + v_material, 2), 'totalInclVat', round(v_labor + v_material, 2),
    'approval', 'DRAFT', 'workOrderNo', c.aems_quote->>'workOrderNo', 'savedAt', now(), 'savedBy', me.full_name);
  update public.containers set aems_quote = jsonb_strip_nulls(v_quote), quotation_items = v_texts, quotation_labor_hours = v_total,
    quotation_by_name = me.full_name, quotation_at = now()
  where id = c.id;
  perform public.write_audit('SAVE_AEMS_QUOTATION', 'QUOTATION', c.dossier_code,
    format('[Hồ sơ %s] Báo giá AEMS %s: %s dòng • %s giờ (chuẩn bị %s) • %sđ — Draft', c.dossier_code, c.container_no, n, v_total, v_prep,
      round(v_labor + v_material, 2)), c.dossier_code);
  return jsonb_build_object('id', c.id);
end $$;

create or replace function public.set_aems_approval(p_container_no text, p_status text, p_work_order_no text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me public.staff;
  c public.containers;
  v_wo text := nullif(trim(coalesce(p_work_order_no, '')), '');
  v_label text := case p_status when 'PENDING_APPROVAL' then 'Pending Approval' when 'APPROVED' then 'Approved' when 'REJECTED' then 'Rejected'
    when 'SUSPEND_TTL' then 'Suspend for TTL check' when 'DECLARED_TTL' then 'Declared as TTL' end;
begin
  me := public.assert_permission('QUOTATION', 'chỉ Bộ phận Báo giá được cập nhật trạng thái duyệt.');
  c := public.lock_active_container(p_container_no);
  if c.id is null or not c.needs_quotation then raise exception 'Container không nằm trong hàng chờ Báo giá.'; end if;
  if c.aems_quote is null then raise exception '%: chưa LƯU phiếu báo giá AEMS.', c.container_no; end if;
  if v_label is null then raise exception 'Trạng thái duyệt không hợp lệ.'; end if;
  v_wo := coalesce(v_wo, c.aems_quote->>'workOrderNo');
  if v_wo is not null and v_wo !~* '^[A-Z0-9-]{1,20}$' then raise exception 'Số Work Order AEMS gồm 1–20 chữ / số.'; end if;
  update public.containers set aems_quote = aems_quote || jsonb_strip_nulls(jsonb_build_object(
    'approval', p_status, 'approvalAt', now(), 'approvalBy', me.full_name, 'workOrderNo', v_wo))
  where id = c.id;
  perform public.write_audit('SET_AEMS_APPROVAL', 'QUOTATION', c.dossier_code,
    format('[Hồ sơ %s] Báo giá AEMS %s: Maersk %s%s', c.dossier_code, c.container_no, v_label, coalesce(' (WO ' || v_wo || ')', '')), c.dossier_code);
  return jsonb_build_object('id', c.id);
end $$;

-- Chuyển Sửa chữa (needs_quotation → needs_repair) cont hãng AEMS: bắt buộc Maersk Approved (không sửa confirm_quotation_to_repair)
create or replace function public.containers_aems_repair_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.needs_repair and not old.needs_repair and old.needs_quotation and new.shipping_line_code = any (public.aems_quotation_lines())
     and coalesce(new.aems_quote->>'approval', '') <> 'APPROVED' then
    raise exception '%: Maersk chưa duyệt (Approved) — chưa chuyển Sửa chữa.', new.container_no;
  end if;
  return new;
end $$;
create trigger containers_aems_repair_guard before update of needs_repair on public.containers
  for each row execute function public.containers_aems_repair_guard();

revoke execute on function public.save_aems_quotation(text, text, text, jsonb), public.set_aems_approval(text, text, text),
  public.aems_preparation(text, numeric), public.aems_quotation_lines() from public, anon;
revoke execute on function public.save_aems_quotation(text, text, text, jsonb), public.set_aems_approval(text, text, text) from authenticated;
grant execute on function public.save_aems_quotation(text, text, text, jsonb) to authenticated;
grant execute on function public.set_aems_approval(text, text, text) to authenticated;
