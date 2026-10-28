-- pgTAP — DEC-166: Danh mục PHÂN LOẠI ĐÓNG HÀNG theo hãng tàu
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'ad8@matrandepot.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'gd8@matrandepot.local');
insert into public.staff (id, staff_code, username, full_name) values
  ('00000000-0000-0000-0000-0000000000b1', 'S1', 'ad8.test', 'Admin Test'),
  ('00000000-0000-0000-0000-0000000000b2', 'S2', 'gd8.test', 'Giám định Test');
insert into public.staff_roles values ('00000000-0000-0000-0000-0000000000b1', 'ADMIN'), ('00000000-0000-0000-0000-0000000000b2', 'INSPECTOR');
insert into public.partners (code, name, is_shipping_line) values ('LN1', 'Hãng 1', true), ('LN2', 'Hãng 2', true);
create or replace function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Danh mục: chỉ Admin; chặn trùng / mã sai; ngừng dùng
select pg_temp.login('00000000-0000-0000-0000-0000000000b2');
select throws_like($$ select public.catalog_upsert_stuffing_class('LN1', 'M') $$, '%chỉ Admin%', 'Giám định không sửa danh mục');
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select lives_ok($$ select public.catalog_upsert_stuffing_class('LN1', 'm') $$, 'Admin thêm M cho LN1');
select lives_ok($$ select public.catalog_upsert_stuffing_class('LN1', 'X', 'Đặc biệt') $$, 'Admin thêm X cho LN1');
select throws_like($$ select public.catalog_upsert_stuffing_class('LN1', 'M') $$, '%đã có%', 'Chặn trùng');
select throws_like($$ select public.catalog_upsert_stuffing_class('LN1', 'A B') $$, '%1–5 chữ%', 'Chặn mã sai');
select throws_like($$ select public.catalog_upsert_stuffing_class('ZZZ', 'M') $$, '%HÃNG TÀU%', 'Chặn hãng ngoài danh mục');
select lives_ok($$ select public.catalog_set_stuffing_class_active('LN1', 'X', false) $$, 'Admin ngừng dùng X');

-- Giám định Hạ vỏ: bắt buộc hãng; hãng dùng → bắt buộc + đúng bộ; hãng không dùng → trống
select pg_temp.login('00000000-0000-0000-0000-0000000000b2');
select throws_like($$ select public.record_gate_in_field_step(gen_random_uuid(), 'p', 'AV', array['WP - QUÉT'], '{}', 'M', 2019) $$,
  '%HÃNG TÀU%', 'Thiếu hãng tàu bị từ chối');
select throws_like($$ select public.record_gate_in_field_step(gen_random_uuid(), 'p', 'AV', array['WP - QUÉT'], '{}', null, 2019, null, 'LN1') $$,
  '%PHÂN LOẠI ĐÓNG HÀNG (M)%', 'LN1 bắt buộc đóng hàng');
select throws_like($$ select public.record_gate_in_field_step(gen_random_uuid(), 'p', 'AV', array['WP - QUÉT'], '{}', 'X', 2019, null, 'LN1') $$,
  '%không có trong Danh mục%', 'Mã đã ngừng dùng bị từ chối');
select public.record_gate_in_field_step(gen_random_uuid(), 'p', 'AV', array['WP - QUÉT'], '{}', 'm', 2019, null, 'LN1');
select public.record_gate_in_field_step(gen_random_uuid(), 'p', 'AV', array['WP - QUÉT'], '{}', 'M', 2019, null, 'LN2');
select is((select stuffing_class from public.gate_in_orders where shipping_line_code = 'LN1'), 'M', 'LN1 lưu M + hãng');
select is((select count(*)::int from public.gate_in_orders where shipping_line_code = 'LN2' and stuffing_class is null), 1, 'LN2 không dùng phân loại → lưu trống');
select throws_like($$ select public.record_gate_in_field_step(gen_random_uuid(), 'p', 'AV', array['WP - QUÉT'], '{}', null, null, null, 'LN2') $$,
  '%AGE%', 'AGE vẫn bắt buộc');
select is((select count(*)::int from public.stuffing_classes where shipping_line_code = 'LN2'), 0, 'Hãng mới không tự có mã');

-- Hãng ưu tiên: chỉ Admin, chỉ 1 hãng
select throws_like($$ select public.catalog_set_partner_priority('LN1', true) $$, '%chỉ Admin%', 'Giám định không đặt ưu tiên');
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select public.catalog_set_partner_priority('LN1', true);
select public.catalog_set_partner_priority('LN2', true);
select is((select array_agg(code) from public.partners where is_priority), array['LN2'], 'Chỉ 1 hãng ưu tiên');
select throws_like($$ select public.catalog_set_partner_priority('ZZZ', true) $$, '%HÃNG TÀU%', 'Hãng ngoài danh mục');

select * from finish();
rollback;
