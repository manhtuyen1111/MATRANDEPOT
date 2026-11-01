-- ============================================================================
-- MATRAN DEPOT — DEC-203: GIÁM ĐỊNH HẠ VỎ CONT MSK — TÌNH TRẠNG / HƯ HỎNG THEO eEIR MAERSK
-- Hợp đồng: src/services/inspectionSurvey.ts (validateSurvey, surveyCondition), src/services/api.ts (recordGateInFieldStep).
--   - gate_in_orders.survey (jsonb): { noDamagePhotos[], wearTearPhotos[], damages[{ id, side, location, damageType, source, description, photos[] }] }
--     — đường dẫn ảnh ở kho door-photos, thư mục ANH-GATE-IN/ (Giám định đã có quyền tải lên).
--   - record_gate_in_survey: gọi ngay sau record_gate_in_field_step (app tải ảnh lên trước). Kiểm tra như app:
--     KHÔNG HƯ ≤ 9 ảnh thêm (+ ảnh cửa = 10), HAO MÒN ≤ 20, mỗi chỗ hư: mặt D/F/L/R/T/U/B, CEDEX 4 ký tự bắt đầu bằng mặt,
--     loại hư (1–14, 16), bên gây hư (1–4), mô tả ≤ 255, 1–3 ảnh; có chỗ hư ↔ trạng thái DAMAGE.
-- Chỉ THÊM cột / hàm mới — không sửa record_gate_in_field_step.
-- ============================================================================

alter table public.gate_in_orders add column survey jsonb;

-- Hãng Maersk (khớp MAERSK_LINE_CODES ở src/services/edi/maersk.ts)
create or replace function public.maersk_line_codes() returns text[]
language sql immutable as $$ select array['MSK']::text[] $$;

create or replace function public.record_gate_in_survey(p_gate_in_id uuid, p_survey jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  me public.staff;
  g public.gate_in_orders;
  d jsonb;
  v_no int := coalesce(jsonb_array_length(p_survey->'noDamagePhotos'), 0);
  v_wt int := coalesce(jsonb_array_length(p_survey->'wearTearPhotos'), 0);
  v_dmg int := coalesce(jsonb_array_length(p_survey->'damages'), 0);
  v_loc text;
  v_side text;
  v_photos int;
begin
  me := public.assert_permission('GATE_IN_FIELD', 'chỉ Bộ phận Giám định / Quản lý được ghi tình trạng eEIR.');
  select * into g from public.gate_in_orders where id = p_gate_in_id for update;
  if g.id is null then raise exception 'Không tìm thấy hồ sơ Hạ vỏ.'; end if;
  if g.status <> 'FIELD_RECORDED' then raise exception 'Hồ sơ % đã chuyển Văn phòng — không sửa tình trạng eEIR.', g.code; end if;
  if g.condition_class = 'W-SURVEY' then raise exception 'Cont W-SURVEY (lên kệ) chưa ghi tình trạng eEIR.'; end if;
  if coalesce(g.shipping_line_code, '') <> all (public.maersk_line_codes()) then raise exception 'Chỉ cont hãng Maersk ghi tình trạng eEIR.'; end if;
  if jsonb_typeof(p_survey) <> 'object' then raise exception 'Tình trạng eEIR không hợp lệ.'; end if;
  if v_no + 1 > 10 then raise exception 'KHÔNG HƯ: tối đa 10 ảnh (tính cả ảnh cửa cont).'; end if;
  if v_wt > 20 then raise exception 'HAO MÒN: tối đa 20 ảnh.'; end if;
  if exists (
    select 1 from jsonb_array_elements_text(coalesce(p_survey->'noDamagePhotos', '[]') || coalesce(p_survey->'wearTearPhotos', '[]')) p
    where p not like 'ANH-GATE-IN/%'
  ) then raise exception 'Đường dẫn ảnh tình trạng eEIR không hợp lệ.'; end if;
  for d in select * from jsonb_array_elements(coalesce(p_survey->'damages', '[]')) loop
    v_side := d->>'side';
    v_loc := upper(coalesce(d->>'location', ''));
    v_photos := coalesce(jsonb_array_length(d->'photos'), 0);
    if v_side is null or v_side not in ('D', 'F', 'L', 'R', 'T', 'U', 'B') then raise exception 'Chỗ hư: mặt container không hợp lệ.'; end if;
    if v_loc !~ '^[A-Z0-9]{4}$' or left(v_loc, 1) <> v_side then raise exception 'Chỗ hư %: vị trí CEDEX phải 4 ký tự, bắt đầu bằng %.', v_loc, v_side; end if;
    if (d->>'damageType')::int not in (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16) then raise exception 'Chỗ hư %: loại hư không hợp lệ.', v_loc; end if;
    if (d->>'source')::int not between 1 and 4 then raise exception 'Chỗ hư %: bên gây hư không hợp lệ.', v_loc; end if;
    if length(coalesce(d->>'description', '')) > 255 then raise exception 'Chỗ hư %: mô tả tối đa 255 ký tự.', v_loc; end if;
    if v_photos < 1 or v_photos > 3 then raise exception 'Chỗ hư %: cần 1–3 ảnh.', v_loc; end if;
    if exists (select 1 from jsonb_array_elements_text(d->'photos') p where p not like 'ANH-GATE-IN/%') then
      raise exception 'Đường dẫn ảnh chỗ hư % không hợp lệ.', v_loc;
    end if;
  end loop;
  if (v_dmg > 0) <> (g.condition_class = 'DAMAGE') then
    raise exception 'Trạng thái phải là % theo tình trạng eEIR (có hư do bên thứ 3 → DAMAGE, còn lại → AV).', case when v_dmg > 0 then 'DAMAGE' else 'AV' end;
  end if;
  update public.gate_in_orders set survey = p_survey where id = g.id;
  perform public.write_audit('GATE_IN_SURVEY', 'GATE_IN', g.code,
    format('[Hồ sơ %s] Giám định ghi tình trạng eEIR: %s ảnh không hư, %s ảnh hao mòn, %s chỗ hư bên thứ 3', g.code, v_no + 1, v_wt, v_dmg), g.code);
end $$;

revoke execute on function public.record_gate_in_survey(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.record_gate_in_survey(uuid, jsonb) to authenticated;
