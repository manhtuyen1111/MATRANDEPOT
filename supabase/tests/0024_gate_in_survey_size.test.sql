-- pgTAP — DEC-203: SIZE CONT bắt buộc trước khi giám định; cont 20' chỉ 5 ô.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d1', 'gd@matrandepot.local');
insert into public.staff (id, staff_code, username, full_name) values ('00000000-0000-0000-0000-0000000000d1', 'S1', 'gd.s', 'Giám định S');
insert into public.staff_roles values ('00000000-0000-0000-0000-0000000000d1', 'INSPECTOR');
insert into public.partners (code, name, is_shipping_line) values ('MSK', 'MSK', true);
insert into public.stuffing_classes (shipping_line_code, code, sort_order) values ('MSK', 'E', 1) on conflict do nothing;
select set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000000d1', 'role', 'authenticated')::text, true);

create temp table t as select
  (public.record_gate_in_field_step(gen_random_uuid(), 'ANH-GATE-IN/door.jpg', 'AV', array['KHÔNG VỆ SINH'], '{}', 'E', 2019, p_shipping_line_code => 'MSK')->>'id')::uuid as av,
  (public.record_gate_in_field_step(gen_random_uuid(), 'ANH-GATE-IN/door.jpg', 'DAMAGE', array['KHÔNG VỆ SINH'], array['LT56 Bẩn'], 'E', 2019, p_shipping_line_code => 'MSK')->>'id')::uuid as dmg;
grant select on t to authenticated;

select throws_like($$ select public.record_gate_in_survey((select av from t), '{"noDamagePhotos":[],"wearTearPhotos":[],"damages":[]}') $$,
  '%chọn SIZE CONT%', 'Thiếu size → chặn');
select lives_ok($$ select public.record_gate_in_survey((select av from t), '{"size":"20","noDamagePhotos":[],"wearTearPhotos":[],"damages":[]}') $$, 'Có size 20 → lưu');
select throws_like($$ select public.record_gate_in_survey((select dmg from t),
  '{"size":"20","noDamagePhotos":[],"wearTearPhotos":[],"damages":[{"side":"L","location":"LT56","damageType":1,"source":2,"photos":["ANH-GATE-IN/x.jpg"]}]}') $$,
  '%cont 20'' chỉ có 5 ô%', 'Cont 20: cột 6 không có');
select lives_ok($$ select public.record_gate_in_survey((select dmg from t),
  '{"size":"40","noDamagePhotos":[],"wearTearPhotos":[],"damages":[{"side":"L","location":"LT56","damageType":1,"source":2,"photos":["ANH-GATE-IN/x.jpg"]}]}') $$,
  'Cont 40: cột 5–6 hợp lệ');

select * from finish();
rollback;
