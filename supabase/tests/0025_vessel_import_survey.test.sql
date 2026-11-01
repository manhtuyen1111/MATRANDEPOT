-- pgTAP — DEC-203: Giám định NHẬP TÀU cont MSK ghi tình trạng eEIR (size theo danh sách, không ảnh cửa).
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'gd@matrandepot.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'vp@matrandepot.local');
insert into public.staff (id, staff_code, username, full_name) values
  ('00000000-0000-0000-0000-0000000000a1', 'S1', 'gd.s', 'Giám định S'),
  ('00000000-0000-0000-0000-0000000000a2', 'S2', 'vp.s', 'Văn phòng S');
insert into public.staff_roles values ('00000000-0000-0000-0000-0000000000a1', 'INSPECTOR'), ('00000000-0000-0000-0000-0000000000a2', 'OFFICE');
insert into public.container_sizes (code) values ('20'), ('40') on conflict do nothing;
insert into public.container_types (code) values ('DC'), ('HC') on conflict do nothing;
insert into public.partners (code, name, is_shipping_line) values ('MSK', 'MSK', true);
insert into public.stuffing_classes (shipping_line_code, code, sort_order) values ('MSK', 'E', 1) on conflict do nothing;

create or replace function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select public.create_vessel_list('NHAP_TAU', 'MSK ALPHA', now(), array['15C-1'], 'MSK',
  '[{"container_no":"MSKU3000001","size":"20","type":"DC"},{"container_no":"MSKU3000002","size":"40","type":"HC"}]'::jsonb) as nt \gset
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select public.inspect_vessel_import_item(gen_random_uuid(), :'nt', (select id from public.vessel_list_items where container_no = 'MSKU3000001'),
  'MSKU3000001', '15C-1', 'AV', 'E', array['KHÔNG VỆ SINH'], 2019) is not null as ok1;
select public.inspect_vessel_import_item(gen_random_uuid(), :'nt', (select id from public.vessel_list_items where container_no = 'MSKU3000002'),
  'MSKU3000002', '15C-1', 'DAMAGE', 'E', array['KHÔNG VỆ SINH'], 2019, array['DB2N Móp']) is not null as ok2;

select lives_ok($$ select public.record_vessel_import_survey((select id from public.vessel_list_items where container_no = 'MSKU3000001'),
  jsonb_build_object('size', '20', 'noDamagePhotos', (select jsonb_agg('ANH-GATE-IN/' || g || '.jpg') from generate_series(1, 20) g), 'wearTearPhotos', '[]'::jsonb, 'damages', '[]'::jsonb)) $$,
  'AV: 20 ảnh không hư (không có ảnh cửa)');
select is((select survey->>'size' from public.vessel_list_items where container_no = 'MSKU3000001'), '20', 'Lưu tình trạng eEIR vào dòng danh sách tàu');
select throws_like($$ select public.record_vessel_import_survey((select id from public.vessel_list_items where container_no = 'MSKU3000002'),
  '{"size":"20","noDamagePhotos":[],"wearTearPhotos":[],"damages":[{"side":"D","location":"DB2N","damageType":5,"source":3,"photos":["ANH-GATE-IN/x.jpg"]}]}') $$,
  '%theo danh sách tàu%', 'Size phải theo danh sách tàu');
select lives_ok($$ select public.record_vessel_import_survey((select id from public.vessel_list_items where container_no = 'MSKU3000002'),
  '{"size":"40","noDamagePhotos":[],"wearTearPhotos":[],"damages":[{"side":"D","location":"DB2N","damageType":5,"source":3,"photos":["ANH-GATE-IN/x.jpg"]}]}') $$,
  'DAMAGE: lưu chỗ hư bên thứ 3');
select throws_like($$ select public.record_vessel_import_survey((select id from public.vessel_list_items where container_no = 'MSKU3000002'),
  '{"size":"40","noDamagePhotos":[],"wearTearPhotos":[],"damages":[]}') $$, '%phải là AV%', 'Cont DAMAGE mà không có hư bên thứ 3 → chặn');
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select throws_like($$ select public.record_vessel_import_survey((select id from public.vessel_list_items where container_no = 'MSKU3000001'),
  '{"size":"20","noDamagePhotos":[],"wearTearPhotos":[],"damages":[]}') $$, '%Không đủ quyền%', 'Văn phòng không ghi tình trạng eEIR');

select * from finish();
rollback;
