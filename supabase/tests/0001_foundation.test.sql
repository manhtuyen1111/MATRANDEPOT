-- pgTAP — Migration 1: quyền, mã hồ sơ, danh mục, RLS nền.
-- Chạy LOCAL (người dùng tự chạy, cần Docker): npx supabase db reset && npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

-- Tạo 2 user Auth giả + hồ sơ nhân viên (chạy với quyền postgres trong giao dịch test)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin.test@matrandepot.local'),
  ('00000000-0000-0000-0000-0000000000b1', 'office.test@matrandepot.local'),
  ('00000000-0000-0000-0000-0000000000c1', 'locked.test@matrandepot.local');
insert into public.staff (id, staff_code, username, full_name, is_active) values
  ('00000000-0000-0000-0000-0000000000a1', 'NV901', 'admin.test', 'Admin Test', true),
  ('00000000-0000-0000-0000-0000000000b1', 'NV902', 'office.test', 'Văn phòng Test', true),
  ('00000000-0000-0000-0000-0000000000c1', 'NV903', 'locked.test', 'Đã khóa Test', false);
insert into public.staff_roles values
  ('00000000-0000-0000-0000-0000000000a1', 'ADMIN'),
  ('00000000-0000-0000-0000-0000000000b1', 'OFFICE'),
  ('00000000-0000-0000-0000-0000000000c1', 'OFFICE');

create or replace function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- 1. Mã hồ sơ: định dạng + tăng dần trong ngày
select matches(public.next_code('HV'), '^HV-\d{6}-001$', 'HV- đầu ngày = 001');
select matches(public.next_code('HV'), '^HV-\d{6}-002$', 'HV- tăng dần');
select matches(public.next_code('PT-TTR'), '^PT-TTR-\d{6}-0001$', 'PT-TTR- 4 chữ số');
select throws_like($$ select public.next_code('CT') $$, '%Loại mã không hợp lệ%', 'không cấp mã CT- (DEC-119)');

-- 2. Quyền
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select ok(public.has_permission('GATE_IN_OFFICE'), 'Văn phòng có GATE_IN_OFFICE');
select ok(not public.has_permission('QUOTATION'), 'Văn phòng không có QUOTATION');
select ok(not public.has_permission('CATALOG_EDIT'), 'Văn phòng không sửa Danh mục');
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select ok(public.has_permission('QUOTATION') and public.has_permission('CATALOG_EDIT'), 'Admin có mọi quyền');
select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
select ok(not public.has_permission('GATE_IN_OFFICE'), 'Tài khoản đã khóa mất mọi quyền');

-- 3. Danh mục: Admin được, Văn phòng bị từ chối
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$ select public.catalog_upsert_partner('msk', 'MSK', true, false, true) $$, 'Admin thêm hãng tàu');
select is((select code from public.partners where code = 'MSK'), 'MSK', 'Mã đối tác viết hoa');
select lives_ok($$ select public.catalog_add_fee('NANG_HA', 1000000, null, null, null, 'MSK') $$, 'Admin thêm biểu giá');
select throws_like($$ select public.catalog_add_fee('NANG_HA', -1) $$, '%đơn giá%', 'Chặn đơn giá âm');
select is((select count(*)::int from public.audit_logs where action_code = 'ADMIN_UPSERT_PARTNER'), 1, 'Ghi nhật ký');
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select throws_like($$ select public.catalog_upsert_partner('X', 'X', false, true, false) $$, '%chỉ Admin%', 'Văn phòng không sửa Danh mục');
select throws_like($$ select public.admin_update_staff('00000000-0000-0000-0000-0000000000b1', 'X', null, array['ADMIN']::public.app_role[], true) $$,
  '%chỉ Admin%', 'Văn phòng không tự cấp quyền Admin');

-- 4. RLS: client không ghi trực tiếp, không gọi hàm nội bộ
set local role authenticated;
select throws_ok($$ insert into public.partners (code, name, is_customer) values ('KH99', 'X', true) $$, '42501', null, 'Không insert trực tiếp');
select throws_ok($$ select public.next_code('HV') $$, '42501', null, 'Client không tự cấp mã');
reset role;

select * from finish();
rollback;
