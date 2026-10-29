-- ============================================================================
-- MATRAN DEPOT — DEC-175: VƯỢT GIỜ SỬA CHỮA (báo cáo SẢN LƯỢNG SỬA CHỮA)
-- Hợp đồng: src/services/depotOperations.ts (updateRepairOvertime), src/services/reports.ts (queryRepairOutput).
--   - Bảng 1 dòng repair_overtime_settings: mốc giờ công (threshold_hours) + đơn giá vượt giờ (hourly_rate, đ / giờ).
--   - Giá trị ban đầu người dùng chốt: trên 200 giờ — 3.000 đ / giờ. Admin sửa ở Danh mục chung → Sửa chữa.
--   - Báo cáo tính trên app: GIỜ VƯỢT GIỜ = giờ công trong khoảng lọc − mốc; SẢN PHẨM VƯỢT GIỜ = giờ vượt × đơn giá.
-- Chỉ THÊM, không sửa bảng / hàm cũ.
-- ============================================================================

create table public.repair_overtime_settings (
  id boolean primary key default true check (id), -- đúng 1 dòng
  threshold_hours numeric(8, 2) not null check (threshold_hours > 0),
  hourly_rate numeric(14, 0) not null check (hourly_rate > 0),
  updated_at timestamptz not null default now()
);
insert into public.repair_overtime_settings (id, threshold_hours, hourly_rate) values (true, 200, 3000);
create trigger repair_overtime_touch before update on public.repair_overtime_settings for each row execute function public.touch_updated_at();

alter table public.repair_overtime_settings enable row level security;
create policy catalog_read on public.repair_overtime_settings for select to authenticated using (public.is_active_staff());
revoke insert, update, delete, truncate on public.repair_overtime_settings from anon, authenticated;
revoke all on public.repair_overtime_settings from anon;

create or replace function public.catalog_update_repair_overtime(p_threshold_hours numeric, p_hourly_rate numeric)
returns public.repair_overtime_settings
language plpgsql security definer set search_path = public as $$
declare
  v_row public.repair_overtime_settings;
begin
  perform public.assert_admin();
  if p_threshold_hours is null or p_threshold_hours <= 0 then raise exception 'MỐC GIỜ CÔNG phải lớn hơn 0.'; end if;
  if p_hourly_rate is null or p_hourly_rate <= 0 then raise exception 'ĐƠN GIÁ VƯỢT GIỜ (đ / giờ) phải lớn hơn 0.'; end if;
  insert into public.repair_overtime_settings as t (id, threshold_hours, hourly_rate)
  values (true, round(p_threshold_hours, 2), round(p_hourly_rate))
  on conflict (id) do update set threshold_hours = excluded.threshold_hours, hourly_rate = excluded.hourly_rate
  returning t.* into v_row;
  perform public.write_audit('ADMIN_UPDATE_REPAIR_OVERTIME', 'CATALOG', 'REPAIR_OVERTIME',
    format('[Admin Danh mục chung] VƯỢT GIỜ: trên %s giờ — %s đ / giờ', v_row.threshold_hours, v_row.hourly_rate));
  return v_row;
end $$;

revoke execute on function public.catalog_update_repair_overtime(numeric, numeric) from public, anon, authenticated;
grant execute on function public.catalog_update_repair_overtime(numeric, numeric) to authenticated;
