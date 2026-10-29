-- ============================================================================
-- DEC-191 — DANH MỤC CHUNG → USER - ROLE: thông tin chi tiết nhân viên.
--   * Thêm vào staff: giới tính, CCCD, năm sinh, quê quán, PHÒNG BAN (1 phòng — độc lập với vai trò / role phân quyền).
--   * Ai xem: Admin (mọi người) + chính nhân viên (của mình) — RLS staff_self_or_admin sẵn có; người khác chỉ thấy
--     mã + tên qua staff_directory (không có các cột mới).
--   * Chỉ Admin sửa (admin_update_staff_profile). Nhân viên chỉ xem; quy trình tự cập nhật + xác minh làm sau.
--   * Nhật ký không ghi số CCCD.
-- Kèm sửa lỗi DEC-189: migration 20261113000001 (bản đầu) đã ghi đè assert_admin() bằng câu báo của màn Database
--   → khôi phục đúng bản gốc (migration 20261027000003). Bản đã sửa của 20261113000001 dùng assert_db_admin() riêng.
-- ============================================================================

create or replace function public.assert_admin() returns public.staff
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_any_role(array[]::public.app_role[]) then
    raise exception 'Không đủ quyền: chỉ Admin được cấu hình Danh mục.' using errcode = '42501';
  end if;
  return public.current_staff();
end $$;

alter table public.staff
  add column if not exists gender text check (gender in ('NAM', 'NU')),
  add column if not exists id_number text check (id_number ~ '^[0-9]{12}$'),          -- CCCD 12 số
  add column if not exists birth_year int check (birth_year between 1940 and 2100),
  add column if not exists hometown text,
  add column if not exists department public.app_role;                              -- phòng ban (1)
create unique index if not exists staff_id_number_unique on public.staff (id_number) where id_number is not null;

-- ---------------------------------------------------------------------------
-- Admin cập nhật thông tin chi tiết (để trống = chưa cập nhật)
-- ---------------------------------------------------------------------------
create or replace function public.admin_update_staff_profile(
  p_staff_id uuid, p_department public.app_role, p_gender text, p_id_number text, p_birth_year int, p_hometown text
) returns public.staff
language plpgsql security definer set search_path = public as $$
declare
  me public.staff := public.assert_admin();
  v_id text := nullif(regexp_replace(coalesce(p_id_number, ''), '\s', '', 'g'), '');
  v_gender text := nullif(upper(trim(coalesce(p_gender, ''))), '');
  v_row public.staff;
begin
  if v_gender is not null and v_gender not in ('NAM', 'NU') then raise exception 'Giới tính chỉ là Nam hoặc Nữ.'; end if;
  if v_id is not null and v_id !~ '^[0-9]{12}$' then raise exception 'Số CCCD phải gồm đúng 12 chữ số.'; end if;
  if p_birth_year is not null and (p_birth_year < 1940 or p_birth_year > extract(year from now())::int - 15) then
    raise exception 'Năm sinh không hợp lệ (1940 → %).', extract(year from now())::int - 15;
  end if;
  if v_id is not null and exists (select 1 from public.staff where id_number = v_id and id <> p_staff_id) then
    raise exception 'Số CCCD đã có ở nhân viên khác.';
  end if;
  update public.staff set department = p_department, gender = v_gender, id_number = v_id, birth_year = p_birth_year,
    hometown = nullif(trim(coalesce(p_hometown, '')), '')
  where id = p_staff_id returning * into v_row;
  if v_row.id is null then raise exception 'Không tìm thấy nhân viên.'; end if;
  perform public.write_audit('ADMIN_UPDATE_STAFF_PROFILE', 'STAFF', v_row.username,
    format('Admin cập nhật thông tin chi tiết %s (%s)', v_row.full_name, v_row.staff_code)); -- không ghi CCCD
  return v_row;
end $$;

revoke execute on function public.admin_update_staff_profile(uuid, public.app_role, text, text, int, text) from public, anon, authenticated;
grant execute on function public.admin_update_staff_profile(uuid, public.app_role, text, text, int, text) to authenticated;
