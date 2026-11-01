-- ============================================================================
-- MATRAN DEPOT — DEC-203 (người dùng 2026-11-01): Giám định NHẬP TÀU cont MSK ghi tình trạng eEIR như Hạ vỏ.
--   - vessel_list_items.survey (jsonb) — cùng cấu trúc gate_in_orders.survey; size = size của dòng danh sách tàu.
--   - eeir_survey_check: kiểm tra chung (size, số ảnh, mặt, CEDEX, loại hư, bên gây hư, ảnh, có hư ↔ DAMAGE);
--     p_door = số ảnh cửa tính vào KHÔNG HƯ (Nhập tàu 0 — DEC-156).
--   - record_vessel_import_survey: gọi ngay sau inspect_vessel_import_item (app tải ảnh lên trước).
-- Chỉ THÊM — không sửa record_gate_in_survey. Hợp đồng: src/services/vessel.ts (inspectVesselImportItem), inspectionSurvey.ts.
-- ============================================================================

alter table public.vessel_list_items add column survey jsonb;

create or replace function public.eeir_survey_check(p_survey jsonb, p_condition text, p_door int) returns void
language plpgsql immutable set search_path = public as $$
declare
  d jsonb;
  v_no int := coalesce(jsonb_array_length(p_survey->'noDamagePhotos'), 0);
  v_wt int := coalesce(jsonb_array_length(p_survey->'wearTearPhotos'), 0);
  v_dmg int := coalesce(jsonb_array_length(p_survey->'damages'), 0);
  v_loc text;
  v_side text;
  v_photos int;
begin
  if jsonb_typeof(p_survey) <> 'object' then raise exception 'Tình trạng eEIR không hợp lệ.'; end if;
  if coalesce(p_survey->>'size', '') not in ('20', '40', '45') then raise exception 'Vui lòng chọn SIZE CONT (20 / 40 / 45) trước khi giám định.'; end if;
  if v_no + p_door > 20 then raise exception 'KHÔNG HƯ: tối đa 20 ảnh.'; end if;
  if v_wt > 20 then raise exception 'HAO MÒN: tối đa 20 ảnh.'; end if;
  if exists (
    select 1 from jsonb_array_elements_text(coalesce(p_survey->'noDamagePhotos', '[]') || coalesce(p_survey->'wearTearPhotos', '[]')) p
    where p not like 'ANH-GATE-IN/%'
  ) then raise exception 'Đường dẫn ảnh tình trạng eEIR không hợp lệ.'; end if;
  for d in select * from jsonb_array_elements(coalesce(p_survey->'damages', '[]')) loop
    v_side := d->>'side';
    v_loc := upper(coalesce(d->>'location', ''));
    v_photos := coalesce(jsonb_array_length(d->'photos'), 0);
    if v_side is null or v_side not in ('D', 'F', 'L', 'R', 'T', 'U', 'B', 'E', 'I', 'N', 'X') then raise exception 'Chỗ hư: mặt container không hợp lệ.'; end if;
    if v_side in ('E', 'I', 'N', 'X') and v_loc <> v_side || 'XXX' then raise exception 'Chỗ hư: mặt % có vị trí cố định %XXX.', v_side, v_side; end if;
    if v_loc !~ '^[A-Z0-9]{4}$' or left(v_loc, 1) <> v_side then raise exception 'Chỗ hư %: vị trí CEDEX phải 4 ký tự, bắt đầu bằng %.', v_loc, v_side; end if;
    if p_survey->>'size' = '20' and v_side in ('L', 'R', 'T', 'U', 'B') and v_loc !~ '^.{2}[1-5][1-5N]$' then
      raise exception 'Chỗ hư %: cont 20'' chỉ có 5 ô (cột 1–5).', v_loc;
    end if;
    if (d->>'damageType')::int not in (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16) then raise exception 'Chỗ hư %: loại hư không hợp lệ.', v_loc; end if;
    if (d->>'source')::int not between 1 and 4 then raise exception 'Chỗ hư %: bên gây hư không hợp lệ.', v_loc; end if;
    if length(coalesce(d->>'description', '')) > 255 then raise exception 'Chỗ hư %: mô tả tối đa 255 ký tự.', v_loc; end if;
    if v_photos < 1 or v_photos > 3 then raise exception 'Chỗ hư %: cần 1–3 ảnh.', v_loc; end if;
    if exists (select 1 from jsonb_array_elements_text(d->'photos') p where p not like 'ANH-GATE-IN/%') then
      raise exception 'Đường dẫn ảnh chỗ hư % không hợp lệ.', v_loc;
    end if;
  end loop;
  if (v_dmg > 0) <> (p_condition = 'DAMAGE') then
    raise exception 'Trạng thái phải là % theo tình trạng eEIR (có hư do bên thứ 3 → DAMAGE, còn lại → AV).', case when v_dmg > 0 then 'DAMAGE' else 'AV' end;
  end if;
end $$;

create or replace function public.record_vessel_import_survey(p_item_id uuid, p_survey jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  me public.staff;
  i public.vessel_list_items;
  l public.vessel_lists;
begin
  me := public.assert_permission('VESSEL_IMPORT_INSPECT', 'chỉ Bộ phận Giám định / Quản lý được ghi tình trạng eEIR.');
  select * into i from public.vessel_list_items where id = p_item_id for update;
  if i.id is null then raise exception 'Không tìm thấy container trong danh sách tàu.'; end if;
  select * into l from public.vessel_lists where id = i.list_id;
  if l.mode <> 'NHAP_TAU' then raise exception 'Chỉ danh sách NHẬP TÀU ghi tình trạng eEIR.'; end if;
  if i.status <> 'INSPECTED' then raise exception 'Container % chưa Giám định nhập tàu hoặc đã hạ bãi.', i.container_no; end if;
  if coalesce(l.shipping_line_code, '') <> all (public.maersk_line_codes()) then raise exception 'Chỉ cont hãng Maersk ghi tình trạng eEIR.'; end if;
  if coalesce(p_survey->>'size', '') <> i.size then raise exception 'Size phải theo danh sách tàu (%).', i.size; end if;
  perform public.eeir_survey_check(p_survey, i.condition_class::text, 0);
  update public.vessel_list_items set survey = p_survey where id = i.id;
  perform public.write_audit('VESSEL_IMPORT_SURVEY', 'VESSEL', coalesce(i.dossier_code, i.container_no),
    format('[Hồ sơ %s] Giám định nhập tàu ghi tình trạng eEIR: %s ảnh không hư, %s ảnh hao mòn, %s chỗ hư bên thứ 3', i.dossier_code,
      coalesce(jsonb_array_length(p_survey->'noDamagePhotos'), 0), coalesce(jsonb_array_length(p_survey->'wearTearPhotos'), 0),
      coalesce(jsonb_array_length(p_survey->'damages'), 0)), i.dossier_code);
end $$;

revoke execute on function public.eeir_survey_check(jsonb, text, int) from public, anon;
revoke execute on function public.record_vessel_import_survey(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.record_vessel_import_survey(uuid, jsonb) to authenticated;
