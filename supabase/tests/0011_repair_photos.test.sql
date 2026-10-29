-- pgTAP — DEC-176: ẢNH HOÀN THÀNH SỬA CHỮA (1–30 ảnh, kho repair-photos < 200 KB) + ảnh không tự xóa
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000001a1', 'sc11@matrandepot.local'),
  ('00000000-0000-0000-0000-0000000001a2', 'vp11@matrandepot.local');
insert into public.staff (id, staff_code, username, full_name) values
  ('00000000-0000-0000-0000-0000000001a1', 'S111', 'sc11.test', 'Sửa chữa Test'),
  ('00000000-0000-0000-0000-0000000001a2', 'S112', 'vp11.test', 'Văn phòng Test');
insert into public.staff_roles values
  ('00000000-0000-0000-0000-0000000001a1', 'REPAIR_STAFF'),
  ('00000000-0000-0000-0000-0000000001a2', 'OFFICE');
insert into public.container_sizes (code) values ('40') on conflict do nothing;
insert into public.container_types (code) values ('HC') on conflict do nothing;
insert into public.repair_teams (id, code, name) values ('00000000-0000-0000-0000-0000000001b1', 'TO-SC-91', 'TỔ SỬA CHỮA 91');
insert into public.repair_team_members (id, team_id, full_name) values
  ('00000000-0000-0000-0000-0000000001b2', '00000000-0000-0000-0000-0000000001b1', 'Thợ 11');
-- Cont chờ sửa chữa + việc sửa chữa đang mở
insert into public.containers (id, dossier_code, container_no, size, type, condition_class, damage_remarks, stuffing_class, manufacture_year,
  cleaning_items, active_qr_code, needs_repair)
values ('00000000-0000-0000-0000-0000000001c1', 'HV-TEST11', 'TSTU1100001', '40', 'HC', 'DAMAGE', array['Móp vách'], 'E', 2019,
  array['KHÔNG VỆ SINH'], 'QR-HV-TEST11', true);
insert into public.work_orders (code, container_id, dossier_code, container_no, category, work_status, assigned_to, labor_hours)
values ('MNR-HV-TEST11', '00000000-0000-0000-0000-0000000001c1', 'HV-TEST11', 'TSTU1100001', 'REPAIR', 'OPEN', 'Sửa chữa', 2);
create or replace function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.done(paths text[]) returns jsonb language sql as $$
  select public.complete_repair_with_photos(gen_random_uuid(), '00000000-0000-0000-0000-0000000001b1',
    array['00000000-0000-0000-0000-0000000001b2'::uuid], paths, 'TSTU1100001');
$$;

select is((select file_size_limit::int from storage.buckets where id = 'repair-photos'), 204800, 'Kho repair-photos chặn ảnh ≥ 200 KB');

select pg_temp.login('00000000-0000-0000-0000-0000000001a2');
select throws_like($$ select pg_temp.done(array['ANH-SUA-CHUA/2026/10/29/TO-SC-91/TSTU1100001/a.jpg']) $$, '%Không đủ quyền%', 'Văn phòng không hoàn tất sửa chữa');

select pg_temp.login('00000000-0000-0000-0000-0000000001a1');
select throws_like($$ select pg_temp.done('{}') $$, '%ít nhất 1 ảnh%', 'Bắt buộc ít nhất 1 ảnh');
select throws_like($$ select pg_temp.done(array_fill('ANH-SUA-CHUA/x.jpg'::text, array[31])) $$, '%Tối đa 30%', 'Tối đa 30 ảnh');
select throws_like($$ select pg_temp.done(array['ANH-GATE-IN/2026/10/29/x.jpg']) $$, '%không hợp lệ%', 'Đường dẫn phải thuộc ANH-SUA-CHUA');
select ok((select needs_repair from public.containers where container_no = 'TSTU1100001'), 'Bị từ chối → cont vẫn chờ sửa chữa');
select lives_ok($$ select pg_temp.done(array['ANH-SUA-CHUA/2026/10/29/TO-SC-91/TSTU1100001/TSTU1100001-080000-01.jpg',
  'ANH-SUA-CHUA/2026/10/29/TO-SC-91/TSTU1100001/TSTU1100001-080000-02.jpg']) $$, 'Hoàn tất kèm 2 ảnh');
select is((select condition_class::text from public.containers where container_no = 'TSTU1100001'), 'AV', 'Sửa xong → AV');
select is((select cardinality(photo_paths) from public.work_orders where dossier_code = 'HV-TEST11' and category = 'REPAIR'), 2, 'Lưu đủ 2 đường dẫn ảnh');

-- Ảnh không tự xóa: hồ sơ Gate in quá hạn cũ vẫn không bị liệt kê để xóa
select is((select count(*)::int from public.expired_photo_paths(500)), 0, 'Không còn ảnh nào bị tự xóa');

select * from finish();
rollback;
