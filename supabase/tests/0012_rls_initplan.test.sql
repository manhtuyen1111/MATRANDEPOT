-- pgTAP — DEC-178: RLS gọi hàm kiểm tra quyền 1 lần / truy vấn (bọc select) + chỉ mục cho dữ liệu lớn; quyền đọc KHÔNG đổi
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000002a1', 'gd12@matrandepot.local'),
  ('00000000-0000-0000-0000-0000000002a2', 'xn12@matrandepot.local'),
  ('00000000-0000-0000-0000-0000000002a3', 'ngoai12@matrandepot.local');
insert into public.staff (id, staff_code, username, full_name) values
  ('00000000-0000-0000-0000-0000000002a1', 'S121', 'gd12.test', 'Giám định Test'),
  ('00000000-0000-0000-0000-0000000002a2', 'S122', 'xn12.test', 'Xe nâng Test');
insert into public.staff_roles values
  ('00000000-0000-0000-0000-0000000002a1', 'INSPECTOR'),
  ('00000000-0000-0000-0000-0000000002a2', 'FORKLIFT');
insert into public.container_sizes (code) values ('40') on conflict do nothing;
insert into public.container_types (code) values ('HC') on conflict do nothing;
insert into public.containers (dossier_code, container_no, size, type, condition_class, damage_remarks, stuffing_class, manufacture_year, cleaning_items, active_qr_code)
values ('HV-TEST12', 'TSTU1200001', '40', 'HC', 'AV', '{}', 'E', 2019, array['KHÔNG VỆ SINH'], 'QR-HV-TEST12');
create or replace function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- 1. Không còn policy nào gọi hàm quyền cho từng dòng
select is(
  (select count(*)::int from pg_policies
   where schemaname = 'public'
     and (coalesce(qual, '') || coalesce(with_check, '')) ~ '(is_active_staff|has_permission|has_any_role)\('
     and (coalesce(qual, '') || coalesce(with_check, '')) !~* 'select'),
  0, 'Mọi policy public gọi hàm quyền đều bọc (select …)');

-- 2. Chỉ mục mới
select has_index('public', 'work_orders', 'work_orders_container', 'Chỉ mục work_orders theo container_id');
select has_index('public', 'containers', 'containers_gate_in_at', 'Chỉ mục containers theo gate_in_at');
select has_index('public', 'gate_in_orders', 'gate_in_orders_created', 'Chỉ mục gate_in_orders theo created_at');

-- 3. Quyền đọc không đổi
select pg_temp.login('00000000-0000-0000-0000-0000000002a1');
set local role authenticated;
select is((select count(*)::int from public.containers where container_no = 'TSTU1200001'), 1, 'Nhân viên đang hoạt động đọc được container');
select is((select count(*)::int from public.payment_receipts), 0, 'Giám định không có RECEIPT_VIEW → không thấy phiếu thu');
reset role;
select pg_temp.login('00000000-0000-0000-0000-0000000002a3');
set local role authenticated;
select is((select count(*)::int from public.containers), 0, 'Tài khoản không phải nhân viên → không đọc được gì');
reset role;
update public.staff set is_active = false where id = '00000000-0000-0000-0000-0000000002a2';
select pg_temp.login('00000000-0000-0000-0000-0000000002a2');
set local role authenticated;
select is((select count(*)::int from public.containers), 0, 'Nhân viên đã khóa → không đọc được gì');
reset role;

select * from finish();
rollback;
