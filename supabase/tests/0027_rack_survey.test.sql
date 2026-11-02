-- pgTAP — DEC-204: Giám định trên kệ cont MSK ghi tình trạng eEIR (record_rack_survey).
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'gd@matrandepot.local'),
  ('00000000-0000-0000-0000-0000000000d2', 'vp@matrandepot.local');
insert into public.staff (id, staff_code, username, full_name) values
  ('00000000-0000-0000-0000-0000000000d1', 'S1', 'gd.s', 'Giám định S'),
  ('00000000-0000-0000-0000-0000000000d2', 'S2', 'vp.s', 'Văn phòng S');
insert into public.staff_roles values ('00000000-0000-0000-0000-0000000000d1', 'INSPECTOR'), ('00000000-0000-0000-0000-0000000000d2', 'OFFICE');
insert into public.container_sizes (code) values ('20'), ('40') on conflict do nothing;
insert into public.container_types (code) values ('DC') on conflict do nothing;
insert into public.yard_blocks (code, name, is_inspection_rack) values ('BLOCK-DAMAGE', 'Kệ', true) on conflict do nothing;
insert into public.partners (code, name, is_shipping_line) values ('MSK', 'MSK', true), ('ONE', 'ONE', true);
insert into public.stuffing_classes (shipping_line_code, code, sort_order) values ('MSK', 'E', 1), ('ONE', 'E', 1) on conflict do nothing;

-- Lượt W-SURVEY đã lên kệ (dữ liệu thử)
create or replace function pg_temp.rack(no text, line text) returns uuid language sql as $$
  insert into public.gate_in_orders (code, condition_class, cleaning_items, to_inspection_rack, shipping_line_code, field_by, field_by_name, size)
  values ('HV-' || no, 'W-SURVEY', array['KHÔNG VỆ SINH'], true, line, '00000000-0000-0000-0000-0000000000d1', 'Giám định S', '20');
  insert into public.containers (dossier_code, container_no, size, type, shipping_line_code, status, current_block, condition_class, cleaning_items, active_qr_code, forklift_task)
  values ('HV-' || no, no, '20', 'DC', line, 'IN_YARD', 'BLOCK-DAMAGE', 'W-SURVEY', array['KHÔNG VỆ SINH'], 'QR-HV-' || no, 'NONE')
  returning id;
$$;
create temp table t as select pg_temp.rack('MSKU0000011', 'MSK') as av, pg_temp.rack('MSKU0000022', 'MSK') as dmg, pg_temp.rack('ONEU0000033', 'ONE') as one;
grant select on t to authenticated;
create temp table j as select
  '{"size":"20","noDamagePhotos":["ANH-GATE-IN/a.jpg"],"wearTearPhotos":[],"damages":[]}'::jsonb as ok_av,
  '{"size":"20","noDamagePhotos":[],"wearTearPhotos":[],"damages":[{"id":"d1","side":"L","location":"LT34","damageType":5,"source":2,"photos":["ANH-GATE-IN/b.jpg"]}]}'::jsonb as ok_dmg;
grant select on j to authenticated;

create or replace function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');

select throws_like($$ select public.record_rack_survey((select av from t), (select ok_av from j)) $$, '%chưa giám định bổ sung%', 'Chưa giám định trên kệ → chặn');
select public.complete_rack_inspection(gen_random_uuid(), (select av from t), 'AV', 'E', 2018);
select public.complete_rack_inspection(gen_random_uuid(), (select dmg from t), 'DAMAGE', 'E', 2018, array['LT34 Móp']);
select public.complete_rack_inspection(gen_random_uuid(), (select one from t), 'AV', 'E', 2018);

select throws_like($$ select public.record_rack_survey((select av from t), (select ok_dmg from j)) $$, '%phải là DAMAGE%', 'Có hư bên thứ 3 mà AV → chặn');
select throws_like($$ select public.record_rack_survey((select av from t), '{"size":"40","noDamagePhotos":[],"wearTearPhotos":[],"damages":[]}') $$,
  '%Size phải theo container%', 'Size khác cont → chặn');
select lives_ok($$ select public.record_rack_survey((select dmg from t), (select ok_dmg from j)) $$, 'DAMAGE: lưu chỗ hư bên thứ 3');
select is((select survey->'damages'->0->>'location' from public.gate_in_orders where code = 'HV-MSKU0000022'), 'LT34', 'Lưu vị trí CEDEX vào hồ sơ Hạ vỏ');
select throws_like($$ select public.record_rack_survey((select one from t), '{"size":"20","noDamagePhotos":[],"wearTearPhotos":[],"damages":[]}') $$,
  '%hãng Maersk%', 'Hãng khác không ghi tình trạng eEIR');
select pg_temp.login('00000000-0000-0000-0000-0000000000d2');
select throws_like($$ select public.record_rack_survey((select av from t), (select ok_av from j)) $$, '%Không đủ quyền%', 'Văn phòng không ghi');

select * from finish();
rollback;
