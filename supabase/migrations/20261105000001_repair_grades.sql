-- ============================================================================
-- MATRAN DEPOT — DEC-173: BẬC THỢ SỬA CHỮA + gán TỔ / BẬC THỢ cho nhân viên Sửa chữa
-- Hợp đồng: src/services/depotOperations.ts (upsertRepairGrade, setRepairGradeActive, assignRepairStaff,
-- addRepairTeamsByCount — tạo tổ gọi lại catalog_upsert_repair_team từng tổ).
--   - Bảng repair_grades: tên bậc + đơn giá tiền / 1 giờ công (hourly_rate).
--   - repair_team_members.grade_id: bậc thợ của nhân viên trong tổ.
--   - Nhân viên Sửa chữa = staff có vai trò REPAIR_STAFF; mỗi người thuộc đúng 1 tổ đang hoạt động
--     (gán tổ mới → dòng ở tổ cũ bị ngưng, giữ lịch sử).
-- Chỉ THÊM, không sửa bảng / hàm cũ.
-- ============================================================================

create table public.repair_grades (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  hourly_rate numeric(14, 0) not null check (hourly_rate > 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index repair_grades_name_uq on public.repair_grades (lower(name));
alter table public.repair_grades enable row level security;
create policy catalog_read on public.repair_grades for select to authenticated using (public.is_active_staff());
revoke insert, update, delete, truncate on public.repair_grades from anon, authenticated;
revoke all on public.repair_grades from anon;

alter table public.repair_team_members add column grade_id uuid references public.repair_grades (id);

-- Thêm / sửa bậc thợ (p_id null = thêm mới, mã BT-nn tự cấp)
create or replace function public.catalog_upsert_repair_grade(
  p_name text, p_hourly_rate numeric, p_active boolean default true, p_id uuid default null
) returns public.repair_grades
language plpgsql security definer set search_path = public as $$
declare
  v_row public.repair_grades;
  v_name text := trim(coalesce(p_name, ''));
  v_code text;
begin
  perform public.assert_admin();
  if v_name = '' then raise exception 'Vui lòng nhập tên BẬC THỢ.'; end if;
  if p_hourly_rate is null or p_hourly_rate <= 0 then raise exception 'GIỜ CÔNG BẬC THỢ (đơn giá / giờ) phải lớn hơn 0.'; end if;
  if exists (select 1 from public.repair_grades where lower(name) = lower(v_name) and id is distinct from p_id) then
    raise exception 'Bậc thợ "%" đã tồn tại.', v_name;
  end if;
  if p_id is null then
    select 'BT-' || lpad((count(*) + 1)::text, 2, '0') into v_code from public.repair_grades;
    while exists (select 1 from public.repair_grades where code = v_code) loop
      v_code := 'BT-' || lpad((substr(v_code, 4)::int + 1)::text, 2, '0');
    end loop;
    insert into public.repair_grades (code, name, hourly_rate, is_active)
    values (v_code, v_name, round(p_hourly_rate), coalesce(p_active, true)) returning * into v_row;
  else
    update public.repair_grades set name = v_name, hourly_rate = round(p_hourly_rate), is_active = coalesce(p_active, true)
    where id = p_id returning * into v_row;
    if v_row.id is null then raise exception 'Không tìm thấy bậc thợ.'; end if;
  end if;
  perform public.write_audit('ADMIN_UPSERT_REPAIR_GRADE', 'CATALOG', v_row.code,
    format('[Admin Danh mục chung] Lưu BẬC THỢ %s — %s đ / giờ (%s)', v_row.name, v_row.hourly_rate, case when v_row.is_active then 'đang dùng' else 'ngưng' end));
  return v_row;
end $$;

-- Gán nhân viên Sửa chữa vào TỔ + BẬC THỢ (bắt buộc cả 2)
create or replace function public.catalog_assign_repair_staff(p_staff_id uuid, p_team_id uuid, p_grade_id uuid) returns public.repair_team_members
language plpgsql security definer set search_path = public as $$
declare
  v_staff public.staff;
  v_team public.repair_teams;
  v_grade public.repair_grades;
  v_row public.repair_team_members;
begin
  perform public.assert_admin();
  select * into v_staff from public.staff where id = p_staff_id and is_active;
  if v_staff.id is null or not exists (select 1 from public.staff_roles where staff_id = p_staff_id and role = 'REPAIR_STAFF') then
    raise exception 'Chỉ gán được user đang hoạt động có vai trò SỬA CHỮA.';
  end if;
  select * into v_team from public.repair_teams where id = p_team_id and is_active;
  if v_team.id is null then raise exception 'Vui lòng chọn TỔ SỬA CHỮA.'; end if;
  select * into v_grade from public.repair_grades where id = p_grade_id and is_active;
  if v_grade.id is null then raise exception 'Vui lòng chọn BẬC THỢ.'; end if;

  -- Rời tổ cũ (ngưng, giữ lịch sử)
  update public.repair_team_members set is_active = false
  where staff_id = p_staff_id and is_active and team_id <> p_team_id;

  update public.repair_team_members set grade_id = p_grade_id, full_name = v_staff.full_name
  where staff_id = p_staff_id and is_active and team_id = p_team_id
  returning * into v_row;
  if v_row.id is null then
    insert into public.repair_team_members (team_id, full_name, staff_id, is_active, grade_id)
    values (p_team_id, v_staff.full_name, p_staff_id, true, p_grade_id) returning * into v_row;
  end if;
  perform public.write_audit('ADMIN_ADD_REPAIR_MEMBER', 'CATALOG', v_team.code,
    format('[Admin Danh mục chung] Gán %s → %s, bậc thợ %s (%s đ / giờ)', v_staff.full_name, v_team.name, v_grade.name, v_grade.hourly_rate));
  return v_row;
end $$;

revoke execute on function public.catalog_upsert_repair_grade(text, numeric, boolean, uuid) from public, anon, authenticated;
revoke execute on function public.catalog_assign_repair_staff(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.catalog_upsert_repair_grade(text, numeric, boolean, uuid) to authenticated;
grant execute on function public.catalog_assign_repair_staff(uuid, uuid, uuid) to authenticated;
