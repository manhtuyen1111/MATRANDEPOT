-- pgTAP — N8 đồng bộ phần thay đổi (DEC-158): sync_at, sync_deletions, server_now.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000b1', 'sy@matrandepot.local');
insert into public.staff (id, staff_code, username, full_name) values ('00000000-0000-0000-0000-0000000000b1', 'S1', 'sy.test', 'Đồng bộ Test');
insert into public.staff_roles values ('00000000-0000-0000-0000-0000000000b1', 'ADMIN');

select has_column('public', 'containers', 'sync_at', 'containers có sync_at');
select has_column('public', 'location_history', 'sync_at', 'bảng partition location_history có sync_at');
select has_column('public', 'feedbacks', 'sync_at', 'feedbacks có sync_at');

-- Sửa dòng → sync_at đổi (giả lập lần sửa ở giao dịch sau bằng cách lùi mốc cũ)
insert into public.feedbacks (code, menu_id, menu_label, content, created_by, created_by_name)
values ('GY-TEST-001', 'TON_VO', 'Tồn vỏ', 'Nội dung thử đồng bộ', '00000000-0000-0000-0000-0000000000b1', 'x');
alter table public.feedbacks disable trigger feedbacks_sync_touch;
update public.feedbacks set sync_at = now() - interval '1 hour' where code = 'GY-TEST-001';
alter table public.feedbacks enable trigger feedbacks_sync_touch;
update public.feedbacks set response = 'đã xem' where code = 'GY-TEST-001';
select ok((select sync_at > now() - interval '1 minute' from public.feedbacks where code = 'GY-TEST-001'), 'Sửa dòng → sync_at cập nhật');

-- Xóa dòng → ghi sync_deletions (bảng có id, và bảng con ghi id cha)
insert into public.gate_in_orders (id, code, status, condition_class, stuffing_class, cleaning_items, manufacture_year, field_by, field_by_name)
values ('00000000-0000-0000-0000-00000000c001', 'HV-SYNC-001', 'FIELD_RECORDED', 'AV', 'E', array['KHÔNG VỆ SINH'], 2019, '00000000-0000-0000-0000-0000000000b1', 'x');
delete from public.gate_in_orders where code = 'HV-SYNC-001';
select is((select row_id from public.sync_deletions where table_name = 'gate_in_orders'), '00000000-0000-0000-0000-00000000c001'::uuid, 'Xóa hồ sơ Hạ vỏ → ghi sync_deletions');

-- Quyền: nhân viên đọc được, không ghi được; anon không đọc được; server_now chỉ authenticated
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000000b1', 'role', 'authenticated')::text, true);
set local role authenticated;
select is((select count(*)::int from public.sync_deletions), 1, 'Nhân viên đọc sync_deletions');
select throws_ok($$ insert into public.sync_deletions (table_name, row_id) values ('x', gen_random_uuid()) $$, '42501', null, 'Nhân viên không ghi sync_deletions');
select ok(public.server_now() is not null, 'Nhân viên gọi server_now');
reset role;
set local role anon;
select throws_ok($$ select count(*) from public.sync_deletions $$, '42501', null, 'anon không đọc sync_deletions');
select throws_ok($$ select public.server_now() $$, '42501', null, 'anon không gọi server_now');
reset role;

select * from finish();
rollback;
