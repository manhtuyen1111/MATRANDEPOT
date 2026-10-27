-- pgTAP — Migration 5a: lịch tự động, partition, dọn request_log, ảnh hết hạn, quyền kho ảnh.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'gd@matrandepot.local'),
  ('00000000-0000-0000-0000-0000000000a4', 'xn@matrandepot.local');
insert into public.staff (id, staff_code, username, full_name) values
  ('00000000-0000-0000-0000-0000000000a1', 'T1', 'gd.test', 'Giám định Test'),
  ('00000000-0000-0000-0000-0000000000a4', 'T4', 'xn.test', 'Xe nâng Test');
insert into public.staff_roles values ('00000000-0000-0000-0000-0000000000a1', 'INSPECTOR'), ('00000000-0000-0000-0000-0000000000a4', 'FORKLIFT');

-- 1. Lịch tự động + partition
select ok(exists (select 1 from cron.job where jobname = 'matran-ensure-partitions'), 'Có lịch tạo partition hằng tháng');
select ok(exists (select 1 from cron.job where jobname = 'matran-purge-request-log'), 'Có lịch dọn request_log');
select lives_ok($$ select public.ensure_future_partitions(); select public.ensure_future_partitions(); $$, 'Tạo partition gọi nhiều lần không lỗi');
select ok(to_regclass('public.audit_logs_' || to_char(current_date + interval '2 month', 'YYYY_MM')) is not null, 'Đã có partition nhật ký 2 tháng tới');
select ok(to_regclass('public.location_history_' || to_char(current_date + interval '2 month', 'YYYY_MM')) is not null, 'Đã có partition vị trí 2 tháng tới');

-- 2. Dọn request_log > 7 ngày
insert into public.request_log (request_id, staff_id, rpc_name, result, created_at) values
  (gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1', 'x', '{}', now() - interval '8 days'),
  (gen_random_uuid(), '00000000-0000-0000-0000-0000000000a1', 'x', '{}', now());
select is(public.purge_request_log(), 1, 'Chỉ xóa bản ghi quá 7 ngày');

-- 3. Ảnh hết hạn
insert into public.gate_in_orders (code, door_photo_path, photo_expires_at, condition_class, stuffing_class, cleaning_items, manufacture_year, field_by, field_by_name)
values ('HV-OLD-001', '2024/10/HV-OLD-001.jpg', current_date - 1, 'AV', 'E', array['KHÔNG VỆ SINH'], 2019, '00000000-0000-0000-0000-0000000000a1', 'x'),
       ('HV-NEW-001', '2026/10/HV-NEW-001.jpg', current_date + 30, 'AV', 'E', array['KHÔNG VỆ SINH'], 2019, '00000000-0000-0000-0000-0000000000a1', 'x');
select is((select array_agg(path) from public.expired_photo_paths()), array['2024/10/HV-OLD-001.jpg'], 'Chỉ liệt kê ảnh quá hạn');
select is(public.mark_photos_purged(array['2024/10/HV-OLD-001.jpg']), 1, 'Đánh dấu đã xóa ảnh');
select is((select door_photo_path from public.gate_in_orders where code = 'HV-OLD-001'), null, 'Hồ sơ vẫn giữ, chỉ bỏ đường dẫn ảnh');

-- 4. Quyền kho ảnh: Giám định được tải lên, Xe nâng thì không
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000000a4', 'role', 'authenticated')::text, true);
set local role authenticated;
select throws_ok($$ insert into storage.objects (bucket_id, name, owner) values ('door-photos', 't/x.jpg', auth.uid()) $$, '42501', null, 'Xe nâng không tải ảnh lên được');
reset role;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000000a1', 'role', 'authenticated')::text, true);
set local role authenticated;
select lives_ok($$ insert into storage.objects (bucket_id, name, owner) values ('door-photos', 't/y.jpg', auth.uid()) $$, 'Giám định tải ảnh lên được');
reset role;

select * from finish();
rollback;
