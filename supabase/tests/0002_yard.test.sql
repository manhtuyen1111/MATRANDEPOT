-- pgTAP — Migration 2: Giám định Hạ vỏ, W-SURVEY, hạ vỏ / đảo chuyển / sửa vị trí, vệ sinh, báo giá, sửa chữa, khóa.
-- Lượt lưu bãi được tạo trực tiếp làm dữ liệu thử (GATE IN OK thật làm ở migration 3).
begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'gd.test@matrandepot.local'),
  ('00000000-0000-0000-0000-00000000000b', 'xn.test@matrandepot.local'),
  ('00000000-0000-0000-0000-00000000000c', 'vp.test@matrandepot.local'),
  ('00000000-0000-0000-0000-00000000000d', 'bg.test@matrandepot.local'),
  ('00000000-0000-0000-0000-00000000000e', 'sc.test@matrandepot.local');
insert into public.staff (id, staff_code, username, full_name) values
  ('00000000-0000-0000-0000-00000000000a', 'T01', 'gd.test', 'Giám định Test'),
  ('00000000-0000-0000-0000-00000000000b', 'T02', 'xn.test', 'Xe nâng Test'),
  ('00000000-0000-0000-0000-00000000000c', 'T03', 'vp.test', 'Văn phòng Test'),
  ('00000000-0000-0000-0000-00000000000d', 'T04', 'bg.test', 'Báo giá Test'),
  ('00000000-0000-0000-0000-00000000000e', 'T05', 'sc.test', 'Sửa chữa Test');
insert into public.staff_roles values
  ('00000000-0000-0000-0000-00000000000a', 'INSPECTOR'), ('00000000-0000-0000-0000-00000000000b', 'FORKLIFT'),
  ('00000000-0000-0000-0000-00000000000c', 'OFFICE'), ('00000000-0000-0000-0000-00000000000d', 'QUOTATION'),
  ('00000000-0000-0000-0000-00000000000e', 'REPAIR_STAFF');
insert into public.container_sizes (code) values ('40') on conflict do nothing;
insert into public.container_types (code) values ('HC') on conflict do nothing;
insert into public.yard_blocks (code, name, max_bay, max_row, max_tier) values
  ('BLOCK-A', 'Khu A', 20, 6, 5), ('BLOCK-B', 'Khu B', 0, 0, 0);
insert into public.yard_blocks (code, name, max_bay, max_row, max_tier, is_inspection_rack) values ('BLOCK-DAMAGE', 'Kệ', 10, 4, 3, true);
insert into public.repair_teams (id, code, name) values ('00000000-0000-0000-0000-0000000000f1', 'TO1', 'Tổ 1');
insert into public.repair_team_members (id, team_id, full_name) values
  ('00000000-0000-0000-0000-0000000000f2', '00000000-0000-0000-0000-0000000000f1', 'Thợ A');

create or replace function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
-- Lượt lưu bãi thử
create or replace function pg_temp.cont(no text, cond public.condition_class, opts jsonb default '{}') returns uuid language sql as $$
  insert into public.containers (dossier_code, container_no, size, type, condition_class, damage_remarks, stuffing_class, manufacture_year,
    cleaning_items, active_qr_code, needs_cleaning, needs_quotation, forklift_task)
  values ('HV-' || no, no, '40', 'HC', cond, case when cond = 'DAMAGE' then array['Móp vách'] else '{}' end,
    case when cond = 'W-SURVEY' then null else 'E'::public.stuffing_class end, case when cond = 'W-SURVEY' then null else 2019 end,
    coalesce((select array_agg(x) from jsonb_array_elements_text(opts->'cleaning') x), array['KHÔNG VỆ SINH']), 'QR-HV-' || no,
    coalesce((opts->>'needs_cleaning')::boolean, false), cond = 'DAMAGE',
    case when cond = 'W-SURVEY' then 'HA_KE_GIAM_DINH' else 'NONE' end::public.forklift_task)
  returning id;
$$;
insert into public.containers (dossier_code, container_no, size, type, condition_class, stuffing_class, manufacture_year, cleaning_items, active_qr_code)
select 'x', 'XXXX0000000', '40', 'HC', 'AV', 'E', 2019, array['KHÔNG VỆ SINH'], 'x' where false; -- kiểm cú pháp bảng

-- ==== 1. Giám định Hạ vỏ ====
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select matches((public.record_gate_in_field_step(gen_random_uuid(), 'door/1.jpg', 'AV', array['WP - QUÉT'], '{}', 'E', 2019)->>'code'),
  '^HV-\d{6}-001$', 'Giám định tạo HV- tự cấp mã');
select is((select count(*)::int from public.gate_in_orders), 1, 'Có 1 hồ sơ');
select throws_like($$ select public.record_gate_in_field_step(gen_random_uuid(), '', 'AV', array['WP - QUÉT'], '{}', 'E', 2019) $$,
  '%chụp 1 ảnh%', 'Bắt buộc ảnh cửa cont');
select throws_like($$ select public.record_gate_in_field_step(gen_random_uuid(), 'p', 'AV', array['WP - QUÉT'], '{}', null, 2019) $$,
  '%ĐÓNG HÀNG%', 'AV bắt buộc Đóng hàng');
select throws_like($$ select public.record_gate_in_field_step(gen_random_uuid(), 'p', 'DAMAGE', array['KHÔNG VỆ SINH'], array['Móp'], 'E', 19) $$,
  '%AGE%', 'AGE sai bị chặn');
-- W-SURVEY: chỉ cần ảnh + vệ sinh, tự hạ kệ
select lives_ok($$ select public.record_gate_in_field_step(gen_random_uuid(), 'p', 'W-SURVEY', array['WW - RỬA NƯỚC']) $$, 'W-SURVEY không cần Đóng hàng / AGE');
select ok((select to_inspection_rack and stuffing_class is null from public.gate_in_orders where condition_class = 'W-SURVEY'), 'W-SURVEY tự HẠ KỆ GIÁM ĐỊNH');
-- Bấm lặp cùng request_id không tạo trùng
select public.record_gate_in_field_step('11111111-1111-1111-1111-111111111111', 'p', 'AV', array['KHÔNG VỆ SINH'], '{}', 'K', 2018);
select public.record_gate_in_field_step('11111111-1111-1111-1111-111111111111', 'p', 'AV', array['KHÔNG VỆ SINH'], '{}', 'K', 2018);
select is((select count(*)::int from public.gate_in_orders), 3, 'Gửi lặp cùng request_id không tạo hồ sơ thứ hai');
-- Vệ sinh: KHÔNG VỆ SINH bị bỏ khi có mục khác
select public.record_gate_in_field_step(gen_random_uuid(), 'p', 'AV', array['KHÔNG VỆ SINH', 'RM - NHỔ ĐINH'], '{}', 'E', 2020);
select is((select cleaning_items from public.gate_in_orders order by field_at desc, code desc limit 1), array['RM - NHỔ ĐINH'], 'Chuẩn hóa hạng mục vệ sinh');
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select throws_like($$ select public.record_gate_in_field_step(gen_random_uuid(), 'p', 'AV', array['WP - QUÉT'], '{}', 'E', 2019) $$,
  '%Không đủ quyền%', 'Xe nâng không được Giám định');
-- Xóa hồ sơ chưa xử lý
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select lives_ok($$ select public.delete_gate_in_field_record((select id from public.gate_in_orders where stuffing_class = 'K')) $$, 'Giám định xóa hồ sơ chưa xử lý');
update public.gate_in_orders set container_no = 'MSKU1234565' where condition_class = 'W-SURVEY';
select throws_like($$ select public.delete_gate_in_field_record((select id from public.gate_in_orders where condition_class = 'W-SURVEY')) $$,
  '%đã được Văn phòng xử lý%', 'Không xóa hồ sơ Văn phòng đã làm');

-- ==== 2. Xe nâng hạ vỏ ====
select pg_temp.cont('MSKU0000001', 'AV');
select pg_temp.cont('MSKU0000002', 'AV', '{"needs_cleaning": true, "cleaning": ["WP - QUÉT"]}');
select pg_temp.cont('MSKU0000003', 'W-SURVEY');
select pg_temp.cont('MSKU0000004', 'DAMAGE');
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select lives_ok($$ select public.update_container_location(gen_random_uuid(), 'BLOCK-A', '01', '01', '01', 'Hạ vỏ', 'MSKU0000001') $$, 'Hạ vỏ vào ô trống');
select is((select status::text from public.containers where container_no = 'MSKU0000001'), 'IN_YARD', 'Chuyển IN_YARD');
select is((select count(*)::int from public.location_history where container_no = 'MSKU0000001' and action = 'INITIAL_BLOCK'), 1, 'Ghi lịch sử vị trí');
select throws_like($$ select public.update_container_location(gen_random_uuid(), 'BLOCK-A', '01', '01', '01', '', 'MSKU0000004') $$,
  '%đang có container MSKU0000001%', 'Chặn trùng ô đủ 4 phần');
select throws_like($$ select public.update_container_location(gen_random_uuid(), 'BLOCK-A', '01', null, null, '', 'MSKU0000004') $$,
  '%vui lòng nhập đủ%', 'Block có Bay/Row/Tier bắt buộc nhập đủ');
select throws_like($$ select public.update_container_location(gen_random_uuid(), 'BLOCK-A', '99', '01', '01', '', 'MSKU0000004') $$,
  '%nằm ngoài cấu hình%', 'Bay ngoài cấu hình');
select throws_like($$ select public.update_container_location(gen_random_uuid(), 'BLOCK-A', '02', '01', '01', '', 'MSKU0000002') $$,
  '%yêu cầu vệ sinh%', 'Chưa vệ sinh thì chưa hạ');
select throws_like($$ select public.update_container_location(gen_random_uuid(), 'BLOCK-A', '02', '01', '01', '', 'MSKU0000003') $$,
  '%HẠ KỆ GIÁM ĐỊNH%', 'W-SURVEY chỉ hạ vào kệ');
select lives_ok($$ select public.update_container_location(gen_random_uuid(), 'BLOCK-DAMAGE', '01', '01', '01', '', null, 'QR-HV-MSKU0000003') $$, 'Quét QR hạ lên kệ');
select lives_ok($$ select public.update_container_location(gen_random_uuid(), 'BLOCK-B', null, null, null, '', 'MSKU0000004') $$, 'Block chỉ quản lý theo tên');

-- ==== 3. Vệ sinh ====
select throws_like($$ select public.complete_cleaning_task(gen_random_uuid(), 'MSKU0000002') $$, '%Không đủ quyền%', 'Xe nâng không xác nhận vệ sinh');
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select lives_ok($$ select public.complete_cleaning_task(gen_random_uuid(), 'MSKU0000002') $$, 'Văn phòng xác nhận vệ sinh thay (DEC-035)');

-- ==== 4. Giám định bổ sung trên kệ ====
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select throws_like($$ select public.complete_rack_inspection(gen_random_uuid(), (select id from public.containers where container_no = 'MSKU0000003'), 'DAMAGE', 'M', 2018) $$,
  '%lỗi hư hỏng%', 'DAMAGE bắt buộc lỗi');
select public.complete_rack_inspection(gen_random_uuid(), (select id from public.containers where container_no = 'MSKU0000003'), 'DAMAGE', 'M', 2018, array['Thủng sàn']);
select ok((select needs_quotation and condition_class = 'DAMAGE' from public.containers where container_no = 'MSKU0000003'), 'Bổ sung DAMAGE → Chờ báo giá');

-- ==== 5. Báo giá → Sửa chữa ====
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select throws_like($$ select public.confirm_quotation_to_repair('MSKU0000004') $$, '%Chưa cập nhật%', 'Phải cập nhật trước khi xác nhận');
select public.save_quotation_draft('MSKU0000004', array['Gò vách'], 2);
select public.confirm_quotation_to_repair('MSKU0000004');
select ok((select needs_repair and not needs_quotation from public.containers where container_no = 'MSKU0000004'), 'Chuyển Chờ sửa chữa');
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select throws_like($$ select public.complete_repair_task(gen_random_uuid(), '00000000-0000-0000-0000-0000000000f1', '{}', 'MSKU0000004') $$,
  '%ít nhất 1 nhân viên%', 'Bắt buộc chọn nhân viên tổ');
select public.complete_repair_task(gen_random_uuid(), '00000000-0000-0000-0000-0000000000f1', array['00000000-0000-0000-0000-0000000000f2'::uuid], 'MSKU0000004');
select is((select condition_class::text from public.containers where container_no = 'MSKU0000004'), 'AV', 'Sửa xong → AV');

-- ==== 6. Đảo chuyển xóa cờ kệ; khóa container ====
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select public.shift_container(gen_random_uuid(), (select id from public.containers where container_no = 'MSKU0000003'), 'BLOCK-B');
select is((select forklift_task::text from public.containers where container_no = 'MSKU0000003'), 'NONE', 'Đảo chuyển xóa cờ Hạ kệ');
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select throws_like($$ select public.toggle_container_hold('MSKU0000001', true, ' ') $$, '%REMARK VĂN PHÒNG%', 'Khóa bắt buộc remark');

select * from finish();
rollback;
