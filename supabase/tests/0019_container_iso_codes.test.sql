-- pgTAP — DEC-195: mã ISO 6346 theo Size + Type (catalog_set_iso_code) — chỉ Admin sửa; mọi nhân viên đọc.
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000e1', 'admin@matrandepot.local'),
  ('00000000-0000-0000-0000-0000000000e2', 'vp@matrandepot.local');
insert into public.staff (id, staff_code, username, full_name) values
  ('00000000-0000-0000-0000-0000000000e1', 'I1', 'admin.i', 'Admin I'),
  ('00000000-0000-0000-0000-0000000000e2', 'I2', 'vp.i', 'Văn phòng I');
insert into public.staff_roles values ('00000000-0000-0000-0000-0000000000e1', 'ADMIN'), ('00000000-0000-0000-0000-0000000000e2', 'OFFICE');
insert into public.container_sizes (code) values ('20'), ('40'), ('45') on conflict do nothing;
insert into public.container_types (code) values ('DC'), ('HC') on conflict do nothing;

create or replace function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

select has_table('public', 'container_iso_codes', 'Có bảng mã ISO 6346');
select has_column('public', 'containers', 'iso_code', 'Cont có mã ISO riêng');

select pg_temp.login('00000000-0000-0000-0000-0000000000e2');
select throws_like($$ select public.catalog_set_iso_code('40', 'HC', '45G1') $$, '%chỉ Admin%', 'Văn phòng không sửa mã ISO');

select pg_temp.login('00000000-0000-0000-0000-0000000000e1');
select throws_like($$ select public.catalog_set_iso_code('40', 'XX', '45G1') $$, '%có trong Danh mục%', 'Type phải có trong Danh mục');
select throws_like($$ select public.catalog_set_iso_code('40', 'HC', '45G') $$, '%đúng 4 ký tự%', 'Mã đúng 4 ký tự');
select lives_ok($$ select public.catalog_set_iso_code('40', 'hc', '45g1') $$, 'Admin đặt mã (chuẩn hóa chữ hoa)');
select is((select iso_code from public.container_iso_codes where size = '40' and type = 'HC'), '45G1', 'Đã lưu 40HC = 45G1');
select public.catalog_set_iso_code('40', 'HC', '');
select is((select count(*)::int from public.container_iso_codes where size = '40' and type = 'HC'), 0, 'Mã trống = bỏ');

select * from finish();
rollback;
