-- pgTAP — DEC-203 bổ sung: 20 ảnh không hư, 4 mặt E / I / N / X vị trí cố định <mặt>XXX.
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
  (public.record_gate_in_field_step(gen_random_uuid(), 'ANH-GATE-IN/door.jpg', 'DAMAGE', array['KHÔNG VỆ SINH'], array['XXXX Bẩn'], 'E', 2019, p_shipping_line_code => 'MSK')->>'id')::uuid as dmg;
grant select on t to authenticated;

select lives_ok($$ select public.record_gate_in_survey((select av from t),
  jsonb_build_object('noDamagePhotos', (select jsonb_agg('ANH-GATE-IN/' || g || '.jpg') from generate_series(1, 19) g), 'wearTearPhotos', '[]'::jsonb, 'damages', '[]'::jsonb)) $$,
  'Không hư: 19 ảnh thêm + ảnh cửa = 20 ảnh');
select throws_like($$ select public.record_gate_in_survey((select av from t),
  jsonb_build_object('noDamagePhotos', (select jsonb_agg('ANH-GATE-IN/' || g || '.jpg') from generate_series(1, 20) g), 'wearTearPhotos', '[]'::jsonb, 'damages', '[]'::jsonb)) $$,
  '%tối đa 20 ảnh%', 'Quá 20 ảnh không hư → chặn');
select lives_ok($$ select public.record_gate_in_survey((select dmg from t),
  '{"noDamagePhotos":[],"wearTearPhotos":[],"damages":[{"side":"X","location":"XXXX","damageType":1,"source":2,"photos":["ANH-GATE-IN/x.jpg"]}]}') $$,
  'Mặt X (toàn bộ cont): vị trí XXXX');
select throws_like($$ select public.record_gate_in_survey((select dmg from t),
  '{"noDamagePhotos":[],"wearTearPhotos":[],"damages":[{"side":"E","location":"E123","damageType":1,"source":2,"photos":["ANH-GATE-IN/x.jpg"]}]}') $$,
  '%vị trí cố định EXXX%', 'Mặt E phải là EXXX');

select * from finish();
rollback;
