-- pgTAP — W-SURVEY hiển thị "GIÁM ĐỊNH SAU" trong nhật ký / thông báo (mã dữ liệu giữ W-SURVEY).
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d1', 'gd@matrandepot.local');
insert into public.staff (id, staff_code, username, full_name) values ('00000000-0000-0000-0000-0000000000d1', 'S1', 'gd.s', 'Giám định S');
insert into public.staff_roles values ('00000000-0000-0000-0000-0000000000d1', 'INSPECTOR');
insert into public.partners (code, name, is_shipping_line) values ('MSK', 'MSK', true);
insert into public.container_sizes (code) values ('20') on conflict do nothing;
insert into public.container_types (code) values ('DC') on conflict do nothing;
create or replace function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');

select public.record_gate_in_field_step(gen_random_uuid(), 'ANH-GATE-IN/door.jpg', 'W-SURVEY', array['KHÔNG VỆ SINH'], p_shipping_line_code => 'MSK');
select is((select condition_class::text from public.gate_in_orders limit 1), 'W-SURVEY', 'Mã dữ liệu giữ W-SURVEY');
select ok((select summary like '%GIÁM ĐỊNH SAU (LÊN KỆ)%' from public.audit_logs where action_code = 'GIAM_DINH_HA_VO' order by created_at desc limit 1), 'Nhật ký ghi GIÁM ĐỊNH SAU');

insert into public.containers (dossier_code, container_no, size, type, shipping_line_code, status, condition_class, stuffing_class, manufacture_year, cleaning_items, active_qr_code)
values ('HV-T', 'MSKU0000099', '20', 'DC', 'MSK', 'WAITING_PLACEMENT', 'AV', null, 2019, array['KHÔNG VỆ SINH'], 'QR-HV-T');
select throws_like($$ select public.complete_rack_inspection(gen_random_uuid(), (select id from public.containers where container_no = 'MSKU0000099'), 'AV', null, 2019) $$,
  '%không ở trạng thái GIÁM ĐỊNH SAU%', 'Thông báo lỗi ghi GIÁM ĐỊNH SAU');

select * from finish();
rollback;
