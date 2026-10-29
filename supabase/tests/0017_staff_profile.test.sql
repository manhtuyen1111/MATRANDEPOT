-- pgTAP — DEC-191: thông tin chi tiết nhân viên (admin_update_staff_profile) — chỉ Admin sửa; chỉ Admin + chính nhân viên đọc.
-- Kèm: assert_admin() đúng câu báo gốc (sửa lỗi DEC-189 ghi đè).
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'admin@matrandepot.local'),
  ('00000000-0000-0000-0000-0000000000c2', 'xn@matrandepot.local'),
  ('00000000-0000-0000-0000-0000000000c3', 'vp@matrandepot.local');
insert into public.staff (id, staff_code, username, full_name) values
  ('00000000-0000-0000-0000-0000000000c1', 'P1', 'admin.p', 'Admin P'),
  ('00000000-0000-0000-0000-0000000000c2', 'P2', 'xn.p', 'Xe nâng P'),
  ('00000000-0000-0000-0000-0000000000c3', 'P3', 'vp.p', 'Văn phòng P');
insert into public.staff_roles values
  ('00000000-0000-0000-0000-0000000000c1', 'ADMIN'), ('00000000-0000-0000-0000-0000000000c2', 'FORKLIFT'), ('00000000-0000-0000-0000-0000000000c3', 'MANAGER');

create or replace function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Quản lý không sửa được; câu báo Admin chung đã khôi phục
select pg_temp.login('00000000-0000-0000-0000-0000000000c3');
select throws_like($$ select public.admin_update_staff_profile('00000000-0000-0000-0000-0000000000c2', 'FORKLIFT', 'NAM', null, null, null) $$,
  '%chỉ Admin được cấu hình Danh mục%', 'Quản lý không sửa thông tin chi tiết; assert_admin đúng câu gốc');

-- Admin sửa: kiểm dữ liệu
select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
select throws_like($$ select public.admin_update_staff_profile('00000000-0000-0000-0000-0000000000c2', null, null, '12345', null, null) $$, '%12 chữ số%', 'CCCD phải 12 số');
select throws_like($$ select public.admin_update_staff_profile('00000000-0000-0000-0000-0000000000c2', null, 'X', null, null, null) $$, '%Nam hoặc Nữ%', 'Giới tính Nam / Nữ');
select throws_like($$ select public.admin_update_staff_profile('00000000-0000-0000-0000-0000000000c2', null, null, null, 1900, null) $$, '%Năm sinh không hợp lệ%', 'Năm sinh hợp lệ');
select lives_ok($$ select public.admin_update_staff_profile('00000000-0000-0000-0000-0000000000c2', 'CLEANING', 'nam', '031 095 012 345', 1995, ' Hải Phòng ') $$,
  'Admin cập nhật đủ (phòng ban độc lập với vai trò)');
select is((select department::text || '|' || gender || '|' || id_number || '|' || birth_year || '|' || hometown from public.staff where id = '00000000-0000-0000-0000-0000000000c2'),
  'CLEANING|NAM|031095012345|1995|Hải Phòng', 'Lưu đúng, chuẩn hóa CCCD / giới tính / quê quán');
select is((select array_agg(role::text) from public.staff_roles where staff_id = '00000000-0000-0000-0000-0000000000c2'), array['FORKLIFT'], 'Vai trò không đổi theo phòng ban');
select throws_like($$ select public.admin_update_staff_profile('00000000-0000-0000-0000-0000000000c3', null, null, '031095012345', null, null) $$, '%đã có ở nhân viên khác%', 'CCCD không trùng');
select ok((select summary from public.audit_logs where action_code = 'ADMIN_UPDATE_STAFF_PROFILE' limit 1) !~ '031095012345', 'Nhật ký không ghi số CCCD');

-- Quyền đọc: chính nhân viên đọc được của mình; người khác không thấy CCCD
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000c2');
select is((select id_number from public.staff where id = '00000000-0000-0000-0000-0000000000c2'), '031095012345', 'Nhân viên đọc được thông tin của mình');
select pg_temp.login('00000000-0000-0000-0000-0000000000c3');
select is((select count(*)::int from public.staff where id = '00000000-0000-0000-0000-0000000000c2'), 0, 'Quản lý không đọc được hồ sơ nhân viên khác');
select ok(not exists (select 1 from information_schema.columns where table_name = 'staff_directory' and column_name in ('id_number', 'birth_year', 'hometown', 'gender')),
  'Danh bạ nhân viên (staff_directory) không có thông tin cá nhân');
select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
select is((select count(*)::int from public.staff where id_number is not null), 1, 'Admin đọc được thông tin chi tiết mọi người');
reset role;

select * from finish();
rollback;
