-- ============================================================================
-- MATRAN DEPOT — DEC-203 (người dùng 2026-11-01): SIZE cont do Giám định chọn (cont MSK, giám định eEIR).
--   Văn phòng (verify_gate_in_office) không được ghi size khác gate_in_orders.survey->>'size'.
-- Trigger trước khi cập nhật gate_in_orders — không sửa verify_gate_in_office. Hợp đồng: verifyGateInOfficeAndCreatePayment.
-- ============================================================================

create or replace function public.gate_in_survey_size_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.survey ? 'size' and new.size is not null and new.size <> new.survey->>'size' then
    raise exception 'SIZE cont do Giám định chọn (%'') — Văn phòng không đổi được.', new.survey->>'size';
  end if;
  return new;
end $$;

create trigger gate_in_survey_size_guard
  before update of size, survey on public.gate_in_orders
  for each row execute function public.gate_in_survey_size_guard();
