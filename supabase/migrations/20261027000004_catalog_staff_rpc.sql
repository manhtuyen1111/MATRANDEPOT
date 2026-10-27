-- ============================================================================
-- MATRAN DEPOT — Migration 1/5 (phần 4): RPC DANH MỤC + NHÂN VIÊN (chỉ Admin)
-- Hợp đồng nghiệp vụ: src/services/depotOperations.ts (add*/delete*CatalogItem, setYardBlockInspectionRack,
-- updateCompanyProfile, addStaffUser / updateStaffUser). Ghi nhật ký mọi thay đổi.
-- Xóa danh mục = tắt (is_active = false) để không mất liên kết với hồ sơ cũ.
-- ============================================================================

create or replace function public.catalog_upsert_partner(
  p_code text, p_name text, p_is_shipping_line boolean, p_is_customer boolean, p_allow_tts boolean
) returns public.partners
language plpgsql security definer set search_path = public as $$
declare
  v_code text := upper(trim(p_code));
  v_row public.partners;
begin
  perform public.assert_admin();
  if v_code = '' or trim(coalesce(p_name, '')) = '' then
    raise exception 'Vui lòng nhập đầy đủ Mã và Tên đối tác.';
  end if;
  if not (p_is_shipping_line or p_is_customer) then
    raise exception 'Đối tác phải là Hãng tàu hoặc Khách hàng.';
  end if;
  insert into public.partners as t (code, name, is_shipping_line, is_customer, allow_tts)
  values (v_code, trim(p_name), p_is_shipping_line, p_is_customer, coalesce(p_allow_tts, false))
  on conflict (code) do update set name = excluded.name, is_shipping_line = excluded.is_shipping_line,
    is_customer = excluded.is_customer, allow_tts = excluded.allow_tts, is_active = true
  returning t.* into v_row;
  perform public.write_audit('ADMIN_UPSERT_PARTNER', 'CATALOG', v_code, format('[Admin Danh mục chung] Lưu đối tác [%s] %s', v_code, v_row.name));
  return v_row;
end $$;

create or replace function public.catalog_set_partner_active(p_code text, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  update public.partners set is_active = p_active where code = upper(trim(p_code));
  if not found then raise exception 'Không tìm thấy đối tác %.', p_code; end if;
  perform public.write_audit('ADMIN_SET_PARTNER_ACTIVE', 'CATALOG', upper(trim(p_code)),
    format('[Admin Danh mục chung] %s đối tác %s', case when p_active then 'Mở lại' else 'Ngừng dùng' end, upper(trim(p_code))));
end $$;

create or replace function public.catalog_add_size(p_code text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  if trim(coalesce(p_code, '')) = '' then raise exception 'Vui lòng nhập SIZE.'; end if;
  insert into public.container_sizes (code, sort_order) values (trim(p_code), (select coalesce(max(sort_order), 0) + 1 from public.container_sizes))
  on conflict (code) do update set is_active = true;
  perform public.write_audit('ADMIN_ADD_SIZE', 'CATALOG', trim(p_code), format('[Admin Danh mục chung] Thêm SIZE %s', trim(p_code)));
end $$;

create or replace function public.catalog_add_type(p_code text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  if trim(coalesce(p_code, '')) = '' then raise exception 'Vui lòng nhập TYPE.'; end if;
  insert into public.container_types (code, sort_order) values (upper(trim(p_code)), (select coalesce(max(sort_order), 0) + 1 from public.container_types))
  on conflict (code) do update set is_active = true;
  perform public.write_audit('ADMIN_ADD_TYPE', 'CATALOG', upper(trim(p_code)), format('[Admin Danh mục chung] Thêm TYPE %s', upper(trim(p_code))));
end $$;

create or replace function public.catalog_upsert_yard_block(
  p_code text, p_name text, p_max_bay int, p_max_row int, p_max_tier int, p_capacity int, p_description text, p_is_inspection_rack boolean
) returns public.yard_blocks
language plpgsql security definer set search_path = public as $$
declare
  v_code text := upper(trim(p_code));
  v_row public.yard_blocks;
begin
  perform public.assert_admin();
  if v_code !~ '^BLOCK-' then v_code := 'BLOCK-' || v_code; end if; -- mã vị trí luôn BLOCK-… (DEC-082)
  if least(coalesce(p_max_bay, 0), coalesce(p_max_row, 0), coalesce(p_max_tier, 0), coalesce(p_capacity, 0)) < 0 then
    raise exception 'Bay / Row / Tier / Sức chứa không được âm.';
  end if;
  insert into public.yard_blocks as t (code, name, max_bay, max_row, max_tier, capacity, description, is_inspection_rack)
  values (v_code, coalesce(nullif(trim(p_name), ''), v_code), coalesce(p_max_bay, 0), coalesce(p_max_row, 0), coalesce(p_max_tier, 0),
          coalesce(p_capacity, 0), coalesce(p_description, ''), coalesce(p_is_inspection_rack, false))
  on conflict (code) do update set name = excluded.name, max_bay = excluded.max_bay, max_row = excluded.max_row,
    max_tier = excluded.max_tier, capacity = excluded.capacity, description = excluded.description,
    is_inspection_rack = excluded.is_inspection_rack, is_active = true
  returning t.* into v_row;
  perform public.write_audit('ADMIN_UPSERT_YARD_BLOCK', 'CATALOG', v_code, format('[Admin Danh mục chung] Lưu vị trí %s', v_code));
  return v_row;
end $$;

-- DEC-109: đánh dấu Kệ giám định
create or replace function public.catalog_set_inspection_rack(p_code text, p_is_rack boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  update public.yard_blocks set is_inspection_rack = p_is_rack where code = upper(trim(p_code));
  if not found then raise exception 'Không tìm thấy block %.', p_code; end if;
  perform public.write_audit('ADMIN_SET_INSPECTION_RACK', 'CATALOG', upper(trim(p_code)),
    format('[Admin Danh mục chung] %s Kệ giám định: %s', case when p_is_rack then 'Đánh dấu' else 'Bỏ đánh dấu' end, upper(trim(p_code))));
end $$;

create or replace function public.catalog_set_yard_block_active(p_code text, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  -- Migration 2 định nghĩa lại hàm này để chặn tắt block đang có container (bảng containers có từ migration 2)
  update public.yard_blocks set is_active = p_active where code = upper(trim(p_code));
  if not found then raise exception 'Không tìm thấy block %.', p_code; end if;
  perform public.write_audit('ADMIN_SET_YARD_BLOCK_ACTIVE', 'CATALOG', upper(trim(p_code)),
    format('[Admin Danh mục chung] %s vị trí %s', case when p_active then 'Mở lại' else 'Ngừng dùng' end, upper(trim(p_code))));
end $$;

-- Biểu giá (đã gồm VAT). Mã tự sinh như addDepotFeeCatalogItem.
create or replace function public.catalog_add_fee(
  p_category public.fee_category, p_amount bigint, p_name text default null, p_size text default null,
  p_type text default null, p_shipping_line_code text default null
) returns public.fee_catalog
language plpgsql security definer set search_path = public as $$
declare
  v_seq text := lpad(((select count(*) from public.fee_catalog) + 1)::text, 2, '0');
  v_line text := nullif(upper(trim(coalesce(p_shipping_line_code, ''))), 'ALL');
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_code text;
  v_row public.fee_catalog;
begin
  perform public.assert_admin();
  if p_amount is null or p_amount < 0 then raise exception 'Vui lòng nhập đơn giá (đã bao gồm VAT) hợp lệ.'; end if;
  if v_line is not null and not exists (select 1 from public.partners where code = v_line and is_shipping_line) then
    raise exception 'Hãng tàu % không có trong Danh mục chung.', v_line;
  end if;
  if p_category = 'NANG_HA' then
    v_code := format('LOLO_%s_%s_%s_%s', coalesce(p_size, 'ALL'), coalesce(p_type, 'ALL'), coalesce(v_line, 'ALL'), v_seq);
    v_name := coalesce(v_name, regexp_replace(format('Nâng hạ vỏ %s %s — Hãng tàu %s (Đã gồm VAT)',
      coalesce(p_size || '''', ''), coalesce(p_type, ''), coalesce(v_line, 'Tất cả')), '\s+', ' ', 'g'));
  elsif p_category = 'THU_GOM_RAC' then
    v_code := format('RAC_%s_%s', coalesce(p_size, 'CHUNG'), v_seq);
    v_name := coalesce(v_name, format('Phí thu gom rác %s (Đã gồm VAT)', coalesce('cont ' || p_size || '''', 'tiêu chuẩn bãi')));
  else
    v_code := format('DV_%s', v_seq);
    if v_name is null then raise exception 'Vui lòng nhập tên biểu giá dịch vụ.'; end if;
  end if;
  insert into public.fee_catalog (code, name, category, size, type, shipping_line_code, amount)
  values (v_code, v_name, p_category, p_size, p_type, v_line, p_amount)
  returning * into v_row;
  perform public.write_audit('ADMIN_ADD_FEE_CATALOG', 'FEE_CATALOG', v_code,
    format('[Admin Danh mục chung] Thêm BIỂU GIÁ: %s (%sđ — Đã gồm VAT)', v_name, to_char(p_amount, 'FM999G999G999G999')));
  return v_row;
end $$;

create or replace function public.catalog_set_fee_active(p_id uuid, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_code text;
begin
  perform public.assert_admin();
  update public.fee_catalog set is_active = p_active where id = p_id returning code into v_code;
  if v_code is null then raise exception 'Không tìm thấy biểu giá.'; end if;
  perform public.write_audit('ADMIN_SET_FEE_ACTIVE', 'FEE_CATALOG', v_code,
    format('[Admin Danh mục chung] %s biểu giá %s', case when p_active then 'Mở lại' else 'Ngừng dùng' end, v_code));
end $$;

create or replace function public.catalog_update_company(
  p_name text, p_short_name text, p_address text, p_phone text, p_email text, p_tax_code text, p_bank_account text
) returns public.company_profile
language plpgsql security definer set search_path = public as $$
declare
  v_row public.company_profile;
begin
  perform public.assert_admin();
  if trim(coalesce(p_name, '')) = '' then raise exception 'Vui lòng nhập TÊN CÔNG TY.'; end if;
  insert into public.company_profile as t (id, name, short_name, address, phone, email, tax_code, bank_account)
  values (true, trim(p_name), coalesce(nullif(trim(p_short_name), ''), trim(p_name)), trim(coalesce(p_address, '')),
          trim(coalesce(p_phone, '')), trim(coalesce(p_email, '')), trim(coalesce(p_tax_code, '')), trim(coalesce(p_bank_account, '')))
  on conflict (id) do update set name = excluded.name, short_name = excluded.short_name, address = excluded.address,
    phone = excluded.phone, email = excluded.email, tax_code = excluded.tax_code, bank_account = excluded.bank_account
  returning t.* into v_row;
  perform public.write_audit('ADMIN_UPDATE_COMPANY', 'CATALOG', 'COMPANY', format('[Admin Danh mục chung] Cập nhật thông tin công ty: %s', v_row.name));
  return v_row;
end $$;

-- Tổ sửa chữa (DEC-042, DEC-043, DEC-048) — CHỈ ADMIN cấu hình (khối văn phòng chỉ xem — như depotOperations.addRepairTeam)
create or replace function public.catalog_upsert_repair_team(p_code text, p_name text, p_active boolean default true) returns public.repair_teams
language plpgsql security definer set search_path = public as $$
declare
  v_row public.repair_teams;
begin
  perform public.assert_admin();
  if trim(coalesce(p_code, '')) = '' or trim(coalesce(p_name, '')) = '' then raise exception 'Vui lòng nhập mã và tên tổ.'; end if;
  insert into public.repair_teams as t (code, name, is_active) values (upper(trim(p_code)), trim(p_name), coalesce(p_active, true))
  on conflict (code) do update set name = excluded.name, is_active = excluded.is_active
  returning t.* into v_row;
  perform public.write_audit('UPSERT_REPAIR_TEAM', 'CATALOG', v_row.code, format('Lưu tổ sửa chữa [%s] %s', v_row.code, v_row.name));
  return v_row;
end $$;

create or replace function public.catalog_upsert_repair_member(
  p_team_id uuid, p_full_name text, p_staff_id uuid default null, p_active boolean default true, p_member_id uuid default null
) returns public.repair_team_members
language plpgsql security definer set search_path = public as $$
declare
  v_row public.repair_team_members;
begin
  perform public.assert_admin();
  if trim(coalesce(p_full_name, '')) = '' then raise exception 'Vui lòng nhập tên thành viên.'; end if;
  if p_member_id is null then
    insert into public.repair_team_members (team_id, full_name, staff_id, is_active)
    values (p_team_id, trim(p_full_name), p_staff_id, coalesce(p_active, true)) returning * into v_row;
  else
    update public.repair_team_members set full_name = trim(p_full_name), staff_id = p_staff_id, is_active = coalesce(p_active, true)
    where id = p_member_id and team_id = p_team_id returning * into v_row;
    if v_row.id is null then raise exception 'Không tìm thấy thành viên tổ.'; end if;
  end if;
  perform public.write_audit('UPSERT_REPAIR_MEMBER', 'CATALOG', v_row.id::text, format('Lưu thành viên tổ sửa chữa: %s', v_row.full_name));
  return v_row;
end $$;

-- ---------------------------------------------------------------------------
-- NHÂN VIÊN (DEC-143, DEC-151). Tạo tài khoản đăng nhập do Edge Function admin_create_staff làm
-- (cần service_role để tạo auth.users) — hàm dưới chỉ ghi hồ sơ, gọi bởi Edge Function, kiểm Admin theo p_actor_id.
-- ---------------------------------------------------------------------------
create or replace function public.register_staff(
  p_actor_id uuid, p_auth_id uuid, p_username text, p_full_name text, p_email text, p_roles public.app_role[]
) returns public.staff
language plpgsql security definer set search_path = public as $$
declare
  v_row public.staff;
  v_code text;
begin
  if not exists (select 1 from public.staff s join public.staff_roles r on r.staff_id = s.id where s.id = p_actor_id and s.is_active and r.role = 'ADMIN') then
    raise exception 'Không đủ quyền: chỉ Admin được tạo tài khoản.' using errcode = '42501';
  end if;
  if coalesce(array_length(p_roles, 1), 0) = 0 then raise exception 'Vui lòng chọn ít nhất 1 vai trò.'; end if;
  if lower(trim(p_username)) !~ '^[a-z0-9._-]{3,30}$' then
    raise exception 'Tên đăng nhập 3–30 ký tự: chữ thường không dấu, số, dấu . _ -';
  end if;
  -- Mã nhân viên = số lớn nhất hiện có + 1 (không dùng đếm số dòng — tránh trùng khi có mã lẻ)
  v_code := 'NV' || lpad((coalesce((select max(substring(staff_code from '^NV([0-9]+)$')::int) from public.staff), 0) + 1)::text, 3, '0');
  insert into public.staff (id, staff_code, username, full_name, email, must_change_password)
  values (p_auth_id, v_code, lower(trim(p_username)), trim(p_full_name), nullif(trim(coalesce(p_email, '')), ''), true)
  returning * into v_row;
  insert into public.staff_roles (staff_id, role) select v_row.id, unnest(p_roles);
  insert into public.audit_logs (actor_id, actor_name, actor_role, action_code, entity_type, entity_code, summary)
  select p_actor_id, s.full_name, 'ADMIN', 'ADMIN_CREATE_STAFF', 'STAFF', v_row.username,
         format('Admin tạo tài khoản %s (%s) — vai trò %s; mật khẩu ban đầu, bắt buộc đổi lần đầu', v_row.username, v_row.full_name, array_to_string(p_roles, ', '))
  from public.staff s where s.id = p_actor_id;
  return v_row;
end $$;

create or replace function public.admin_update_staff(
  p_staff_id uuid, p_full_name text, p_email text, p_roles public.app_role[], p_active boolean
) returns public.staff
language plpgsql security definer set search_path = public as $$
declare
  me public.staff := public.assert_admin();
  v_row public.staff;
begin
  if coalesce(array_length(p_roles, 1), 0) = 0 then raise exception 'Vui lòng chọn ít nhất 1 vai trò.'; end if;
  if p_staff_id = me.id and (not p_active or not ('ADMIN' = any (p_roles))) then
    raise exception 'Không tự khóa hoặc tự bỏ quyền Admin của chính mình.';
  end if;
  update public.staff set full_name = trim(p_full_name), email = nullif(trim(coalesce(p_email, '')), ''), is_active = p_active
  where id = p_staff_id returning * into v_row;
  if v_row.id is null then raise exception 'Không tìm thấy nhân viên.'; end if;
  delete from public.staff_roles where staff_id = p_staff_id;
  insert into public.staff_roles (staff_id, role) select p_staff_id, unnest(p_roles);
  perform public.write_audit('ADMIN_UPDATE_STAFF', 'STAFF', v_row.username,
    format('Admin cập nhật %s: vai trò %s, %s', v_row.full_name, array_to_string(p_roles, ', '), case when p_active then 'hoạt động' else 'đã khóa' end));
  return v_row;
end $$;

-- Gọi sau khi nhân viên tự đổi mật khẩu thành công trên Supabase Auth (client đổi mật khẩu, rồi báo đã đổi)
create or replace function public.staff_password_changed() returns void
language plpgsql security definer set search_path = public as $$
declare
  me public.staff := public.current_staff();
begin
  if me.id is null then raise exception 'Phiên đăng nhập không hợp lệ.'; end if;
  update public.staff set must_change_password = false where id = me.id;
  perform public.write_audit('STAFF_CHANGE_PASSWORD', 'STAFF', me.username, format('%s đổi mật khẩu', me.full_name));
end $$;

-- Edge Function admin_reset_password đặt lại mật khẩu 123456 trên Auth rồi gọi hàm này
create or replace function public.mark_password_reset(p_actor_id uuid, p_staff_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_user text;
begin
  if not exists (select 1 from public.staff s join public.staff_roles r on r.staff_id = s.id where s.id = p_actor_id and s.is_active and r.role = 'ADMIN') then
    raise exception 'Không đủ quyền: chỉ Admin được đặt lại mật khẩu.' using errcode = '42501';
  end if;
  update public.staff set must_change_password = true where id = p_staff_id returning username into v_user;
  if v_user is null then raise exception 'Không tìm thấy nhân viên.'; end if;
  insert into public.audit_logs (actor_id, actor_name, actor_role, action_code, entity_type, entity_code, summary)
  select p_actor_id, s.full_name, 'ADMIN', 'ADMIN_RESET_PASSWORD', 'STAFF', v_user, format('Admin đặt lại mật khẩu cho %s', v_user)
  from public.staff s where s.id = p_actor_id;
end $$;
