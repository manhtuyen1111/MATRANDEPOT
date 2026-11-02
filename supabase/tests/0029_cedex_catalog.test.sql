-- pgTAP — DEC-206: CODE CEDEX + MÃ SỬA CHỮA theo hãng tàu (chỉ Admin lưu, nhân viên đọc).
begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@matrandepot.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'vp@matrandepot.local');
insert into public.staff (id, staff_code, username, full_name) values
  ('00000000-0000-0000-0000-0000000000a1', 'A1', 'admin.t', 'Admin T'),
  ('00000000-0000-0000-0000-0000000000a2', 'A2', 'vp.t', 'Văn phòng T');
insert into public.staff_roles values ('00000000-0000-0000-0000-0000000000a1', 'ADMIN'), ('00000000-0000-0000-0000-0000000000a2', 'OFFICE');
insert into public.partners (code, name, is_shipping_line) values ('MSK', 'MSK', true);
create or replace function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
set local role authenticated;

select is(public.catalog_upsert_cedex_codes('MSK', 'DAMAGE', '[{"code":"br","name":"Broken"},{"code":"CU","name":"Cut","note":"Cắt"}]'), 2, 'Admin lưu 2 mã hư hỏng');
select is(public.catalog_upsert_cedex_codes('MSK', 'DAMAGE', '[{"code":"BR","name":"Bent","isActive":false}]'), 1, 'Lưu lại cùng mã → cập nhật');
select is((select name || '/' || is_active from public.cedex_codes where code = 'BR'), 'Bent/false', 'Cập nhật tên + ngừng dùng');
select is(public.catalog_upsert_repair_codes('MSK',
  '[{"itemName":"DR001","repairMode":"-","repairName":"Man hour rate for dry repair","manHour":1,"repairCode":"-","materialRate":28000},
    {"itemName":"DR008","repairMode":"03","repairName":"Replace missing rivets","maxQty":7,"manHour":0.1,"repairCode":"0804","materialRate":9215.85}]'), 2, 'Admin lưu MÃ SỬA CHỮA');
select is((select repair_code || '/' || material_rate::text from public.repair_codes where item_name = 'DR008'), '0804/9215.85', 'Giữ số 0 đầu + 2 số lẻ');
select throws_like($$ select public.catalog_upsert_repair_codes('MSK', '[{"itemName":"DR009","repairMode":"03","repairName":"x","manHour":0.123,"repairCode":"0806","materialRate":0}]') $$,
  '%2 số lẻ%', 'Giờ công 3 số lẻ → chặn');
select throws_like($$ select public.catalog_upsert_cedex_codes('MSK', 'DAMAGE', '[{"code":"BR","name":"a"},{"code":"br","name":"b"}]') $$, '%trùng%', 'Trùng mã trong lô → chặn');

select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select throws_like($$ select public.catalog_upsert_cedex_codes('MSK', 'DAMAGE', '[{"code":"XX","name":"x"}]') $$, '%chỉ Admin%', 'Văn phòng không lưu được');
select is((select count(*)::int from public.repair_codes), 2, 'Văn phòng đọc được danh mục');

select * from finish();
rollback;
