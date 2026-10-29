-- pgTAP — DEC-175: VƯỢT GIỜ SỬA CHỮA (mốc giờ công + đơn giá vượt giờ)
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'ad10@matrandepot.local'),
  ('00000000-0000-0000-0000-0000000000e2', 'vp10@matrandepot.local');
insert into public.staff (id, staff_code, username, full_name) values
  ('00000000-0000-0000-0000-0000000000e1', 'S101', 'ad10.test', 'Admin Test'),
  ('00000000-0000-0000-0000-0000000000e2', 'S102', 'vp10.test', 'Văn phòng Test');
insert into public.staff_roles values
  ('00000000-0000-0000-0000-0000000000e1', 'ADMIN'),
  ('00000000-0000-0000-0000-0000000000e2', 'OFFICE');
create or replace function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Giá trị ban đầu người dùng chốt: trên 200 giờ — 3.000 đ / giờ
select is((select threshold_hours::int from public.repair_overtime_settings), 200, 'Mốc ban đầu 200 giờ');
select is((select hourly_rate::int from public.repair_overtime_settings), 3000, 'Đơn giá ban đầu 3.000 đ / giờ');

-- Chỉ Admin sửa; số phải > 0
select pg_temp.login('00000000-0000-0000-0000-0000000000e2');
select throws_like($$ select public.catalog_update_repair_overtime(100, 5000) $$, '%chỉ Admin%', 'Văn phòng không sửa vượt giờ');
select pg_temp.login('00000000-0000-0000-0000-0000000000e1');
select throws_like($$ select public.catalog_update_repair_overtime(0, 5000) $$, '%MỐC GIỜ CÔNG%', 'Mốc phải > 0');
select throws_like($$ select public.catalog_update_repair_overtime(200, 0) $$, '%VƯỢT GIỜ%', 'Đơn giá phải > 0');
select lives_ok($$ select public.catalog_update_repair_overtime(180, 4000) $$, 'Admin sửa vượt giờ');
select is((select array[threshold_hours::int, hourly_rate::int] from public.repair_overtime_settings), array[180, 4000], 'Đã lưu, vẫn 1 dòng');
select is((select count(*)::int from public.audit_logs where action_code = 'ADMIN_UPDATE_REPAIR_OVERTIME'), 1, 'Ghi nhật ký');

select * from finish();
rollback;
