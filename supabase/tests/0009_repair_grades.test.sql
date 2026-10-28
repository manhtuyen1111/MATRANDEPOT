-- pgTAP — DEC-173: BẬC THỢ SỬA CHỮA + gán TỔ / BẬC THỢ cho nhân viên Sửa chữa
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'ad9@matrandepot.local'),
  ('00000000-0000-0000-0000-0000000000c2', 'sc9@matrandepot.local'),
  ('00000000-0000-0000-0000-0000000000c3', 'vp9@matrandepot.local');
insert into public.staff (id, staff_code, username, full_name) values
  ('00000000-0000-0000-0000-0000000000c1', 'S91', 'ad9.test', 'Admin Test'),
  ('00000000-0000-0000-0000-0000000000c2', 'S92', 'sc9.test', 'Thợ Sửa Test'),
  ('00000000-0000-0000-0000-0000000000c3', 'S93', 'vp9.test', 'Văn phòng Test');
insert into public.staff_roles values
  ('00000000-0000-0000-0000-0000000000c1', 'ADMIN'),
  ('00000000-0000-0000-0000-0000000000c2', 'REPAIR_STAFF'),
  ('00000000-0000-0000-0000-0000000000c3', 'OFFICE');
insert into public.repair_teams (id, code, name) values
  ('00000000-0000-0000-0000-0000000000d1', 'T9-01', 'TỔ SỬA CHỮA 91'),
  ('00000000-0000-0000-0000-0000000000d2', 'T9-02', 'TỔ SỬA CHỮA 92');
create or replace function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Bậc thợ: chỉ Admin; tên + đơn giá > 0; không trùng tên
select pg_temp.login('00000000-0000-0000-0000-0000000000c3');
select throws_like($$ select public.catalog_upsert_repair_grade('Bậc 9', 30000) $$, '%chỉ Admin%', 'Văn phòng không sửa bậc thợ');
select pg_temp.login('00000000-0000-0000-0000-0000000000c1');
select throws_like($$ select public.catalog_upsert_repair_grade('Bậc 9', 0) $$, '%lớn hơn 0%', 'Đơn giá phải > 0');
select lives_ok($$ select public.catalog_upsert_repair_grade('Bậc 9', 30000) $$, 'Admin thêm bậc thợ');
select throws_like($$ select public.catalog_upsert_repair_grade('bậc 9', 40000) $$, '%đã tồn tại%', 'Chặn trùng tên');
select lives_ok($$ select public.catalog_upsert_repair_grade('Bậc 9', 45000, true, (select id from public.repair_grades where name = 'Bậc 9')) $$, 'Sửa đơn giá');
select is((select hourly_rate::int from public.repair_grades where name = 'Bậc 9'), 45000, 'Đơn giá đã đổi');

-- Gán tổ + bậc: chỉ user Sửa chữa; bắt buộc cả 2; đổi tổ → rời tổ cũ
select throws_like($$ select public.catalog_assign_repair_staff('00000000-0000-0000-0000-0000000000c3', '00000000-0000-0000-0000-0000000000d1',
  (select id from public.repair_grades where name = 'Bậc 9')) $$, '%SỬA CHỮA%', 'Không gán user không phải Sửa chữa');
select throws_like($$ select public.catalog_assign_repair_staff('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000d1', gen_random_uuid()) $$,
  '%BẬC THỢ%', 'Bậc thợ không hợp lệ bị từ chối');
select lives_ok($$ select public.catalog_assign_repair_staff('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000d1',
  (select id from public.repair_grades where name = 'Bậc 9')) $$, 'Gán vào tổ 91');
select lives_ok($$ select public.catalog_assign_repair_staff('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-0000000000d2',
  (select id from public.repair_grades where name = 'Bậc 9')) $$, 'Chuyển sang tổ 92');
select is((select array_agg(t.code) from public.repair_team_members m join public.repair_teams t on t.id = m.team_id
  where m.staff_id = '00000000-0000-0000-0000-0000000000c2' and m.is_active), array['T9-02'], 'Chỉ còn 1 tổ đang hoạt động');
select is((select count(*)::int from public.repair_team_members where staff_id = '00000000-0000-0000-0000-0000000000c2'), 2, 'Giữ lịch sử tổ cũ');

select * from finish();
rollback;
