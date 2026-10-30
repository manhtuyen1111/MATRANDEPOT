-- pgTAP — DEC-198: Giám định chụp ảnh cấp vỏ cont MSK trước khi Văn phòng trả chứng từ.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'gd@matrandepot.local'),
  ('00000000-0000-0000-0000-0000000000d2', 'vp@matrandepot.local'),
  ('00000000-0000-0000-0000-0000000000d3', 'xn@matrandepot.local');
insert into public.staff (id, staff_code, username, full_name) values
  ('00000000-0000-0000-0000-0000000000d1', 'S1', 'gd.s', 'Giám định S'),
  ('00000000-0000-0000-0000-0000000000d2', 'S2', 'vp.s', 'Văn phòng S'),
  ('00000000-0000-0000-0000-0000000000d3', 'S3', 'xn.s', 'Xe nâng S');
insert into public.staff_roles values
  ('00000000-0000-0000-0000-0000000000d1', 'INSPECTOR'), ('00000000-0000-0000-0000-0000000000d2', 'OFFICE'), ('00000000-0000-0000-0000-0000000000d3', 'FORKLIFT');
insert into public.container_sizes (code) values ('20') on conflict do nothing;
insert into public.container_types (code) values ('DC') on conflict do nothing;
insert into public.yard_blocks (code, name) values ('BLOCK-B', 'Khu B');
insert into public.partners (code, name, is_shipping_line) values ('MSK', 'MSK', true), ('ONE', 'ONE', true);
insert into public.stuffing_classes (shipping_line_code, code, sort_order) values ('MSK', 'E', 1), ('ONE', 'E', 1) on conflict do nothing;
insert into public.partners (code, name, is_customer, allow_tts) values ('KH01', 'Khách hàng 01', true, true);
insert into public.fee_catalog (id, code, name, category, amount) values ('00000000-0000-0000-0000-0000000000f1', 'LOLO', 'Nâng hạ', 'NANG_HA', 1000000);

create or replace function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
-- Hạ vỏ → lập lệnh cấp + thu tiền → Xe nâng cấp ra
create or replace function pg_temp.released(no text, line text) returns uuid language plpgsql as $$
declare v_g uuid; v_o uuid;
begin
  perform pg_temp.login('00000000-0000-0000-0000-0000000000d1');
  v_g := (public.record_gate_in_field_step(gen_random_uuid(), 'door.jpg', 'AV', array['KHÔNG VỆ SINH'], '{}', 'E', 2019, p_shipping_line_code => line)->>'id')::uuid;
  perform pg_temp.login('00000000-0000-0000-0000-0000000000d2');
  perform public.verify_gate_in_office(v_g, no, '20', 'DC', '15C-1', '0912345678', 'Khách hàng 01', line, '', array['00000000-0000-0000-0000-0000000000f1'::uuid]);
  perform public.confirm_gate_in_payment(gen_random_uuid(), v_g, 'TTTT', null, null, 'CASH');
  perform public.update_container_location(gen_random_uuid(), 'BLOCK-B', null, null, null, '', no);
  perform public.create_release_order(gen_random_uuid(), 'BK-' || no, 'Khách hàng 01', no, '15H-1', '0912345678', array['00000000-0000-0000-0000-0000000000f1'::uuid]);
  select id into v_o from public.gate_out_orders where container_no = no;
  perform public.confirm_release_payment(gen_random_uuid(), v_o, 'TTTT', null, null, 'CASH');
  perform pg_temp.login('00000000-0000-0000-0000-0000000000d3');
  perform public.execute_gate_out(gen_random_uuid(), no);
  return v_o;
end $$;

create temp table t as select pg_temp.released('MSKU4100001', 'MSK') as msk, pg_temp.released('ONEU4100002', 'ONE') as other;
grant select on t to authenticated;
select is((select status::text from public.gate_out_orders where id = (select msk from t)), 'GATE_OUT_OK', 'Cont MSK đã cấp ra');

-- Chưa chụp → Văn phòng không trả chứng từ được
select pg_temp.login('00000000-0000-0000-0000-0000000000d2');
select throws_like($$ select public.mark_documents_returned('CAP_VO', (select code from public.gate_out_orders where id = (select msk from t))) $$,
  '%GIÁM ĐỊNH — Chụp ảnh cấp vỏ%', 'Cont MSK chưa có ảnh cấp vỏ → chặn trả chứng từ');
select lives_ok($$ select public.mark_documents_returned('CAP_VO', (select code from public.gate_out_orders where id = (select other from t))) $$,
  'Hãng khác không phải chụp — trả chứng từ như cũ');

-- Quyền + dữ liệu sai
select throws_like($$ select public.record_release_photos((select msk from t), array['ANH-CAP-VO/a.jpg']) $$, '%Không đủ quyền%', 'Văn phòng không chụp ảnh cấp vỏ');
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select throws_like($$ select public.record_release_photos((select msk from t), '{}') $$, '%ít nhất 1 ảnh%', 'Bắt buộc ≥ 1 ảnh');
select throws_like($$ select public.record_release_photos((select msk from t), array['ANH-GATE-IN/a.jpg']) $$, '%không hợp lệ%', 'Chỉ nhận ảnh thư mục ANH-CAP-VO');
select throws_like($$ select public.record_release_photos((select msk from t), array_fill('ANH-CAP-VO/a.jpg'::text, array[31])) $$, '%Tối đa 30%', 'Tối đa 30 ảnh');

-- Giám định chụp → Văn phòng trả chứng từ được
select lives_ok($$ select public.record_release_photos((select msk from t), array['ANH-CAP-VO/2026/10/30/CV-1-a-01.jpg']) $$, 'Giám định chụp ảnh cấp vỏ');
select is((select release_photo_container_no || '|' || release_photos_by_name from public.gate_out_orders where id = (select msk from t)),
  'MSKU4100001|Giám định S', 'Lưu ảnh gắn với số cont + người chụp');
select throws_like($$ select public.record_release_photos((select msk from t), array['ANH-CAP-VO/b.jpg']) $$, '%Đã chụp ảnh cấp vỏ%', 'Không chụp trùng');
select pg_temp.login('00000000-0000-0000-0000-0000000000d2');
select lives_ok($$ select public.mark_documents_returned('CAP_VO', (select code from public.gate_out_orders where id = (select msk from t))) $$,
  'Có ảnh → trả chứng từ được');

select * from finish();
rollback;
