-- pgTAP — DEC-178 bước 4b: cột sinh report_at / container_serial cho báo cáo phân trang ở database
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000003a1', 'gd13@matrandepot.local');
insert into public.staff (id, staff_code, username, full_name) values ('00000000-0000-0000-0000-0000000003a1', 'S131', 'gd13.test', 'Giám định Test');
insert into public.staff_roles values ('00000000-0000-0000-0000-0000000003a1', 'INSPECTOR');
insert into public.container_sizes (code) values ('40') on conflict do nothing;
insert into public.container_types (code) values ('HC') on conflict do nothing;

insert into public.gate_in_orders (code, condition_class, stuffing_class, cleaning_items, manufacture_year, field_by, field_by_name, field_at, container_no, gate_in_ok_at)
values ('HV-T13-1', 'AV', 'E', array['KHÔNG VỆ SINH'], 2019, '00000000-0000-0000-0000-0000000003a1', 'x', '2026-10-01 08:00+07', 'MSKU1234567', null),
       ('HV-T13-2', 'AV', 'E', array['KHÔNG VỆ SINH'], 2019, '00000000-0000-0000-0000-0000000003a1', 'x', '2026-10-01 08:00+07', 'TCLU7654321', '2026-10-02 09:00+07');

-- 1. Thời điểm báo cáo = GATE IN OK, chưa OK thì lúc Giám định (giống reports.ts)
select is((select report_at from public.gate_in_orders where code = 'HV-T13-1'), '2026-10-01 08:00+07'::timestamptz, 'Chưa GATE IN OK → report_at = lúc Giám định');
select is((select report_at from public.gate_in_orders where code = 'HV-T13-2'), '2026-10-02 09:00+07'::timestamptz, 'Đã GATE IN OK → report_at = GATE IN OK');
-- 2. 7 số seri
select is((select container_serial from public.gate_in_orders where code = 'HV-T13-1'), '1234567', 'container_serial = 7 số seri');
select is((select count(*)::int from public.gate_in_orders where container_serial like '12345%'), 1, 'Tìm theo đầu seri');
-- 3. Cập nhật GATE IN OK → report_at tự đổi
update public.gate_in_orders set gate_in_ok_at = '2026-10-05 10:00+07' where code = 'HV-T13-1';
select is((select report_at from public.gate_in_orders where code = 'HV-T13-1'), '2026-10-05 10:00+07'::timestamptz, 'report_at tự tính lại khi GATE IN OK');
-- 4. Từ chối ghi tay vào cột sinh
select throws_ok($$ update public.gate_in_orders set report_at = now() where code = 'HV-T13-1' $$, '428C9', null, 'Không ghi tay được report_at');
-- 5. Chỉ mục
select has_index('public', 'gate_in_orders', 'gate_in_orders_report', 'Chỉ mục báo cáo Hạ vỏ');
select has_index('public', 'gate_out_orders', 'gate_out_orders_report', 'Chỉ mục báo cáo Cấp vỏ');
select has_index('public', 'work_orders', 'work_orders_report', 'Chỉ mục báo cáo Sửa chữa');
select has_index('public', 'containers', 'containers_serial', 'Chỉ mục tìm đầu seri Tồn vỏ');

select * from finish();
rollback;
