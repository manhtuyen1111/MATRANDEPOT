-- ============================================================================
-- MATRAN DEPOT — Giám định TRÊN KỆ cont MSK ghi tình trạng eEIR (người dùng 2026-11-02, DEC-204).
--   GIÁM ĐỊNH SAU (W-SURVEY, DEC-147) → Xe nâng hạ lên kệ → Giám định bổ sung bằng form eEIR như GIÁM ĐỊNH TRỰC TIẾP.
--   record_rack_survey: gọi ngay sau complete_rack_inspection (app tải ảnh lên trước).
--   Size = size cont Văn phòng đã nhập; ảnh cửa cont lúc hạ vỏ tính vào KHÔNG HƯ (p_door = 1).
-- Chỉ THÊM — dùng lại eeir_survey_check (20261123000001), không sửa complete_rack_inspection.
-- Hợp đồng: src/services/depotOperations.ts (completeRackInspection), inspectionSurvey.ts.
-- ============================================================================

create or replace function public.record_rack_survey(p_container_id uuid, p_survey jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  me public.staff;
  c public.containers;
  g public.gate_in_orders;
begin
  me := public.assert_permission('GATE_IN_FIELD', 'chỉ Bộ phận Giám định / Quản lý được ghi tình trạng eEIR.');
  select * into c from public.containers where id = p_container_id;
  if c.id is null then raise exception 'Không tìm thấy container.'; end if;
  select * into g from public.gate_in_orders where code = c.dossier_code for update;
  if g.id is null or not g.to_inspection_rack then raise exception 'Container % không phải cont giám định trên kệ.', c.container_no; end if;
  if g.rack_inspected_at is null then raise exception 'Container % chưa giám định bổ sung trên kệ.', c.container_no; end if;
  if g.survey is not null then raise exception 'Container % đã ghi tình trạng eEIR.', c.container_no; end if;
  if coalesce(c.shipping_line_code, '') <> all (public.maersk_line_codes()) then raise exception 'Chỉ cont hãng Maersk ghi tình trạng eEIR.'; end if;
  if jsonb_typeof(p_survey) <> 'object' then raise exception 'Tình trạng eEIR không hợp lệ.'; end if;
  if coalesce(p_survey->>'size', '') <> c.size then raise exception 'Size phải theo container (%).', c.size; end if;
  perform public.eeir_survey_check(p_survey, c.condition_class::text, 1);
  update public.gate_in_orders set survey = p_survey where id = g.id;
  perform public.write_audit('GATE_IN_SURVEY', 'GATE_IN', g.code,
    format('[Hồ sơ %s] Giám định trên kệ ghi tình trạng eEIR: %s ảnh không hư, %s ảnh hao mòn, %s chỗ hư bên thứ 3', g.code,
      1 + coalesce(jsonb_array_length(p_survey->'noDamagePhotos'), 0), coalesce(jsonb_array_length(p_survey->'wearTearPhotos'), 0),
      coalesce(jsonb_array_length(p_survey->'damages'), 0)), g.code);
end $$;

revoke execute on function public.record_rack_survey(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.record_rack_survey(uuid, jsonb) to authenticated;
