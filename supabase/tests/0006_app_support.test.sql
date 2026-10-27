-- pgTAP — bổ sung khi nối app: Góp ý, Trả chứng từ, ngừng dùng Size / Type.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'ad@matrandepot.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'vp@matrandepot.local');
insert into public.staff (id, staff_code, username, full_name) values
  ('00000000-0000-0000-0000-0000000000a1', 'T1', 'ad.test', 'Admin Test'),
  ('00000000-0000-0000-0000-0000000000a2', 'T2', 'vp.test', 'Văn phòng Test');
insert into public.staff_roles values ('00000000-0000-0000-0000-0000000000a1', 'ADMIN'), ('00000000-0000-0000-0000-0000000000a2', 'OFFICE');
insert into public.container_sizes (code) values ('20') on conflict do nothing;
create or replace function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Góp ý
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select throws_like($$ select public.submit_feedback('TON_VO', 'Tồn vỏ', 'ngắn') $$, '%quá ngắn%', 'Góp ý tối thiểu 5 ký tự');
select matches(public.submit_feedback('TON_VO', 'Văn phòng → Tồn vỏ', 'Muốn lọc theo khách hàng')->>'code', '^GY-\d{6}-001$', 'Gửi góp ý cấp mã GY-');
select throws_like(format($$ select public.respond_feedback(%L, 'DA_XU_LY', 'ok') $$, (select id from public.feedbacks)), '%chỉ Quản trị viên%', 'Văn phòng không xử lý góp ý');
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select throws_like(format($$ select public.respond_feedback(%L, 'DA_XU_LY') $$, (select id from public.feedbacks)), '%PHẢN HỒI%', 'Kết thúc phải có phản hồi');
select lives_ok(format($$ select public.respond_feedback(%L, 'DA_XU_LY', 'Đã thêm bộ lọc') $$, (select id from public.feedbacks)), 'Admin phản hồi');
select is((select status::text from public.feedbacks), 'DA_XU_LY', 'Trạng thái cập nhật');

-- Trả chứng từ
insert into public.gate_in_orders (code, status, condition_class, stuffing_class, cleaning_items, manufacture_year, field_by, field_by_name)
values ('HV-TEST-001', 'GATE_IN_OK', 'AV', 'E', array['KHÔNG VỆ SINH'], 2019, '00000000-0000-0000-0000-0000000000a1', 'x'),
       ('HV-TEST-002', 'PAYMENT_PENDING', 'AV', 'E', array['KHÔNG VỆ SINH'], 2019, '00000000-0000-0000-0000-0000000000a1', 'x');
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select throws_like($$ select public.mark_documents_returned('HA_VO', 'HV-TEST-002') $$, '%chưa GATE IN OK%', 'Chưa GATE IN OK thì chưa trả');
select lives_ok($$ select public.mark_documents_returned('HA_VO', 'HV-TEST-001') $$, 'Trả chứng từ');
select throws_like($$ select public.mark_documents_returned('HA_VO', 'HV-TEST-001') $$, '%Đã trả chứng từ%', 'Không trả 2 lần');

-- Size / Type
select throws_like($$ select public.catalog_set_size_active('20', false) $$, '%chỉ Admin%', 'Văn phòng không ngừng dùng Size');
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select lives_ok($$ select public.catalog_set_size_active('20', false) $$, 'Admin ngừng dùng Size');
select is((select is_active from public.container_sizes where code = '20'), false, 'Size ngừng dùng');

select * from finish();
rollback;
