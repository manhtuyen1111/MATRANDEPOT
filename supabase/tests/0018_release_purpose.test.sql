-- pgTAP — DEC-194: cấp vỏ Release for customer (mặc định) / Release for sale (bắt buộc Sale code).
begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'gd@matrandepot.local'),
  ('00000000-0000-0000-0000-0000000000d2', 'vp@matrandepot.local');
insert into public.staff (id, staff_code, username, full_name) values
  ('00000000-0000-0000-0000-0000000000d1', 'S1', 'gd.s', 'Giám định S'),
  ('00000000-0000-0000-0000-0000000000d2', 'S2', 'vp.s', 'Văn phòng S');
insert into public.staff_roles values ('00000000-0000-0000-0000-0000000000d1', 'INSPECTOR'), ('00000000-0000-0000-0000-0000000000d2', 'OFFICE');
insert into public.container_sizes (code) values ('20') on conflict do nothing;
insert into public.container_types (code) values ('DC') on conflict do nothing;
insert into public.yard_blocks (code, name) values ('BLOCK-B', 'Khu B');
insert into public.partners (code, name, is_shipping_line) values ('MSK', 'MSK', true);
insert into public.stuffing_classes (shipping_line_code, code, sort_order) values ('MSK', 'E', 1) on conflict do nothing;
insert into public.partners (code, name, is_customer, allow_tts) values ('KH01', 'Khách hàng 01', true, true);
insert into public.fee_catalog (id, code, name, category, amount) values ('00000000-0000-0000-0000-0000000000f1', 'LOLO', 'Nâng hạ', 'NANG_HA', 1000000);

create or replace function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
create or replace function pg_temp.in_yard(no text) returns void language plpgsql as $$
declare v_g uuid;
begin
  perform pg_temp.login('00000000-0000-0000-0000-0000000000d1');
  v_g := (public.record_gate_in_field_step(gen_random_uuid(), 'door.jpg', 'AV', array['KHÔNG VỆ SINH'], '{}', 'E', 2019, p_shipping_line_code => 'MSK')->>'id')::uuid;
  perform pg_temp.login('00000000-0000-0000-0000-0000000000d2');
  perform public.verify_gate_in_office(v_g, no, '20', 'DC', '15C-1', '0912345678', 'Khách hàng 01', 'MSK', '', array['00000000-0000-0000-0000-0000000000f1'::uuid]);
  perform public.confirm_gate_in_payment(gen_random_uuid(), v_g, 'TTTT', null, null, 'CASH');
  perform set_config('request.jwt.claims', json_build_object('sub', '00000000-0000-0000-0000-0000000000d2', 'role', 'authenticated')::text, true);
  perform public.update_container_location(gen_random_uuid(), 'BLOCK-B', null, null, null, '', no);
end $$;
select pg_temp.in_yard('MSKU4000001');
select pg_temp.in_yard('MSKU4000002');
select pg_temp.login('00000000-0000-0000-0000-0000000000d2');

-- Mặc định (gọi kiểu cũ 7 tham số) = Release for customer
select lives_ok($$ select public.create_release_order(gen_random_uuid(), 'BK-C1', 'Khách hàng 01', 'MSKU4000001', '15H-1', '0912345678', array['00000000-0000-0000-0000-0000000000f1'::uuid]) $$,
  'Gọi kiểu cũ vẫn chạy (Release for customer)');
select is((select release_purpose || '|' || coalesce(sale_code, '-') from public.gate_out_orders where container_no = 'MSKU4000001'), 'CUSTOMER|-', 'Mặc định Release for customer, không sale code');

-- Release for sale
select throws_like($$ select public.create_release_order(gen_random_uuid(), 'BK-S1', 'Khách hàng 01', 'MSKU4000002', '15H-1', '0912345678',
  array['00000000-0000-0000-0000-0000000000f1'::uuid], 'SALE', '  ') $$, '%SALE CODE%', 'Release for sale bắt buộc Sale code');
select throws_like($$ select public.create_release_order(gen_random_uuid(), 'BK-S1', 'Khách hàng 01', 'MSKU4000002', '15H-1', '0912345678',
  array['00000000-0000-0000-0000-0000000000f1'::uuid], 'X', null) $$, '%không hợp lệ%', 'Tác nghiệp chỉ CUSTOMER / SALE');
select lives_ok($$ select public.create_release_order(gen_random_uuid(), 'BK-S1', 'Khách hàng 01', 'MSKU4000002', '15H-1', '0912345678',
  array['00000000-0000-0000-0000-0000000000f1'::uuid], 'sale', ' sl-2026-001 ') $$, 'Lập lệnh Release for sale');
select is((select release_purpose || '|' || sale_code || '|' || gate_out_type::text from public.gate_out_orders where container_no = 'MSKU4000002'),
  'SALE|SL-2026-001|EMPTY_RELEASE', 'Lưu SALE + sale code viết hoa; vẫn là cấp vỏ (báo cáo Cấp vỏ gồm cấp sale)');
select ok((select summary from public.audit_logs where action_code = 'RELEASE_ORDER_CREATED' and summary like '%MSKU4000002%') like '%Sale code SL-2026-001%', 'Nhật ký ghi Sale code');
select throws_like($$ update public.gate_out_orders set sale_code = null where container_no = 'MSKU4000002' $$, '%sale_code_required%', 'Ràng buộc: SALE phải có sale code');

select * from finish();
rollback;
