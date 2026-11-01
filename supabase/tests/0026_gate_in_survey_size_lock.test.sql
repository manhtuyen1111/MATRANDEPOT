-- pgTAP — DEC-203: Văn phòng không đổi size Giám định chọn.
begin;
create extension if not exists pgtap with schema extensions;
select plan(2);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'gd@matrandepot.local'),
  ('00000000-0000-0000-0000-0000000000d2', 'vp@matrandepot.local');
insert into public.staff (id, staff_code, username, full_name) values
  ('00000000-0000-0000-0000-0000000000d1', 'S1', 'gd.s', 'Giám định S'),
  ('00000000-0000-0000-0000-0000000000d2', 'S2', 'vp.s', 'Văn phòng S');
insert into public.staff_roles values ('00000000-0000-0000-0000-0000000000d1', 'INSPECTOR'), ('00000000-0000-0000-0000-0000000000d2', 'OFFICE');
insert into public.container_sizes (code) values ('20'), ('40') on conflict do nothing;
insert into public.container_types (code) values ('DC') on conflict do nothing;
insert into public.partners (code, name, is_shipping_line) values ('MSK', 'MSK', true);
insert into public.stuffing_classes (shipping_line_code, code, sort_order) values ('MSK', 'E', 1) on conflict do nothing;
insert into public.partners (code, name, is_customer, allow_tts) values ('KH01', 'Khách hàng 01', true, true);
insert into public.fee_catalog (id, code, name, category, amount) values ('00000000-0000-0000-0000-0000000000f1', 'LOLO', 'Nâng hạ', 'NANG_HA', 1000000);

create or replace function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
create temp table t as select (public.record_gate_in_field_step(gen_random_uuid(), 'ANH-GATE-IN/door.jpg', 'AV', array['KHÔNG VỆ SINH'], '{}', 'E', 2019, p_shipping_line_code => 'MSK')->>'id')::uuid as g;
grant select on t to authenticated;
select public.record_gate_in_survey((select g from t), '{"size":"20","noDamagePhotos":[],"wearTearPhotos":[],"damages":[]}');
select pg_temp.login('00000000-0000-0000-0000-0000000000d2');

select throws_like($$ select public.verify_gate_in_office((select g from t), 'MSKU7700123', '40', 'DC', '15C-1', '0912345678', 'Khách hàng 01', 'MSK', '',
  array['00000000-0000-0000-0000-0000000000f1'::uuid]) $$, '%do Giám định chọn (20'')%', 'Văn phòng nhập 40 khác Giám định 20 → chặn');
select lives_ok($$ select public.verify_gate_in_office((select g from t), 'MSKU7700123', '20', 'DC', '15C-1', '0912345678', 'Khách hàng 01', 'MSK', '',
  array['00000000-0000-0000-0000-0000000000f1'::uuid]) $$, 'Đúng size Giám định → qua');

select * from finish();
rollback;
