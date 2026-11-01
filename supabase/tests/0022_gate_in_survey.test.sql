-- pgTAP — DEC-203: Giám định Hạ vỏ cont MSK ghi tình trạng / hư hỏng theo eEIR.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'gd@matrandepot.local'),
  ('00000000-0000-0000-0000-0000000000d2', 'vp@matrandepot.local');
insert into public.staff (id, staff_code, username, full_name) values
  ('00000000-0000-0000-0000-0000000000d1', 'S1', 'gd.s', 'Giám định S'),
  ('00000000-0000-0000-0000-0000000000d2', 'S2', 'vp.s', 'Văn phòng S');
insert into public.staff_roles values ('00000000-0000-0000-0000-0000000000d1', 'INSPECTOR'), ('00000000-0000-0000-0000-0000000000d2', 'OFFICE');
insert into public.partners (code, name, is_shipping_line) values ('MSK', 'MSK', true), ('ONE', 'ONE', true);
insert into public.stuffing_classes (shipping_line_code, code, sort_order) values ('MSK', 'E', 1), ('ONE', 'E', 1) on conflict do nothing;

create or replace function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.field(cond public.condition_class, line text) returns uuid language plpgsql as $$
begin
  perform pg_temp.login('00000000-0000-0000-0000-0000000000d1');
  return (public.record_gate_in_field_step(gen_random_uuid(), 'ANH-GATE-IN/door.jpg', cond, array['KHÔNG VỆ SINH'],
    case when cond = 'DAMAGE' then array['LT89 Móp'] else '{}' end, 'E', 2019, p_shipping_line_code => line)->>'id')::uuid;
end $$;
create temp table t as select pg_temp.field('AV', 'MSK') as av, pg_temp.field('DAMAGE', 'MSK') as dmg, pg_temp.field('AV', 'ONE') as one;
grant select on t to authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');

create temp table j as select
  '{"size":"40","noDamagePhotos":["ANH-GATE-IN/a.jpg"],"wearTearPhotos":[],"damages":[]}'::jsonb as ok_av,
  '{"size":"40","noDamagePhotos":[],"wearTearPhotos":[],"damages":[{"id":"d1","side":"L","location":"LT89","damageType":5,"source":2,"photos":["ANH-GATE-IN/b.jpg"]}]}'::jsonb as ok_dmg;
grant select on j to authenticated;

select lives_ok($$ select public.record_gate_in_survey((select av from t), (select ok_av from j)) $$, 'AV: lưu ảnh không hư');
select lives_ok($$ select public.record_gate_in_survey((select dmg from t), (select ok_dmg from j)) $$, 'DAMAGE: lưu chỗ hư bên thứ 3');
select is((select survey->'damages'->0->>'location' from public.gate_in_orders where id = (select dmg from t)), 'LT89', 'Lưu vị trí CEDEX');
select throws_like($$ select public.record_gate_in_survey((select av from t), (select ok_dmg from j)) $$, '%phải là DAMAGE%', 'Có hư bên thứ 3 mà trạng thái AV → chặn');
select throws_like($$ select public.record_gate_in_survey((select dmg from t),
  '{"size":"40","noDamagePhotos":[],"wearTearPhotos":[],"damages":[{"side":"L","location":"DX2N","damageType":5,"source":2,"photos":["ANH-GATE-IN/b.jpg"]}]}') $$,
  '%bắt đầu bằng L%', 'CEDEX phải bắt đầu bằng mặt');
select throws_like($$ select public.record_gate_in_survey((select dmg from t),
  '{"size":"40","noDamagePhotos":[],"wearTearPhotos":[],"damages":[{"side":"L","location":"LT89","damageType":15,"source":2,"photos":["ANH-GATE-IN/b.jpg"]}]}') $$,
  '%loại hư không hợp lệ%', 'Loại hư 15 không cho chọn');
select throws_like($$ select public.record_gate_in_survey((select dmg from t),
  '{"size":"40","noDamagePhotos":[],"wearTearPhotos":[],"damages":[{"side":"L","location":"LT89","damageType":5,"source":2,"photos":[]}]}') $$,
  '%1–3 ảnh%', 'Chỗ hư cần 1–3 ảnh');
select throws_like($$ select public.record_gate_in_survey((select av from t), '{"size":"40","noDamagePhotos":["x.jpg"],"wearTearPhotos":[],"damages":[]}') $$,
  '%không hợp lệ%', 'Chỉ nhận ảnh thư mục ANH-GATE-IN');
select throws_like($$ select public.record_gate_in_survey((select one from t), (select ok_av from j)) $$, '%hãng Maersk%', 'Hãng khác không ghi tình trạng eEIR');
select pg_temp.login('00000000-0000-0000-0000-0000000000d2');
select throws_like($$ select public.record_gate_in_survey((select av from t), (select ok_av from j)) $$, '%Không đủ quyền%', 'Văn phòng không ghi tình trạng eEIR');

select * from finish();
rollback;
