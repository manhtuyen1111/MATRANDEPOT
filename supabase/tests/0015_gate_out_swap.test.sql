-- pgTAP — DEC-185 / DEC-186: ĐỔI CONTAINER khi chờ trả chứng từ cấp vỏ (swap_gate_out_container) + Xe nâng hạ lại (update_container_location).
begin;
create extension if not exists pgtap with schema extensions;
select plan(27);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'gd@matrandepot.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'vp@matrandepot.local'),
  ('00000000-0000-0000-0000-0000000000a4', 'xn@matrandepot.local');
insert into public.staff (id, staff_code, username, full_name) values
  ('00000000-0000-0000-0000-0000000000a1', 'T1', 'gd.test', 'Giám định Test'),
  ('00000000-0000-0000-0000-0000000000a2', 'T2', 'vp.test', 'Văn phòng Test'),
  ('00000000-0000-0000-0000-0000000000a4', 'T4', 'xn.test', 'Xe nâng Test');
insert into public.staff_roles values
  ('00000000-0000-0000-0000-0000000000a1', 'INSPECTOR'), ('00000000-0000-0000-0000-0000000000a2', 'OFFICE'),
  ('00000000-0000-0000-0000-0000000000a4', 'FORKLIFT');
insert into public.container_sizes (code) values ('20'), ('40') on conflict do nothing;
insert into public.container_types (code) values ('DC'), ('HC') on conflict do nothing;
insert into public.yard_blocks (code, name) values ('BLOCK-B', 'Khu B'), ('BLOCK-SC', 'Khu sửa chữa');
insert into public.partners (code, name, is_shipping_line) values ('MSK', 'MSK', true);
insert into public.stuffing_classes (shipping_line_code, code, sort_order) values ('MSK', 'M', 1), ('MSK', 'K', 2), ('MSK', 'E', 3) on conflict do nothing;
insert into public.partners (code, name, is_customer, allow_tts) values ('KH01', 'Khách hàng 01', true, true);
insert into public.fee_catalog (id, code, name, category, amount) values
  ('00000000-0000-0000-0000-0000000000f1', 'LOLO', 'Nâng hạ', 'NANG_HA', 1000000);

create or replace function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
-- Hạ vỏ đủ luồng → cont AV tồn bãi BLOCK-B
create or replace function pg_temp.in_yard(no text) returns void language plpgsql as $$
declare v_g uuid;
begin
  perform pg_temp.login('00000000-0000-0000-0000-0000000000a1');
  v_g := (public.record_gate_in_field_step(gen_random_uuid(), 'door.jpg', 'AV', array['KHÔNG VỆ SINH'], '{}', 'E', 2019, p_shipping_line_code => 'MSK')->>'id')::uuid;
  perform pg_temp.login('00000000-0000-0000-0000-0000000000a2');
  perform public.verify_gate_in_office(v_g, no, '20', 'DC', '15C-1', '0912345678', 'Khách hàng 01', 'MSK', '', array['00000000-0000-0000-0000-0000000000f1'::uuid]);
  perform public.confirm_gate_in_payment(gen_random_uuid(), v_g, 'TTTT', null, null, 'CASH');
  perform pg_temp.login('00000000-0000-0000-0000-0000000000a4');
  perform public.update_container_location(gen_random_uuid(), 'BLOCK-B', null, null, null, '', no);
end $$;
-- Lập lệnh cấp + thu tiền mặt + Xe nâng OUT → trả về id lệnh (đang chờ trả chứng từ)
create or replace function pg_temp.gated_out(no text, booking text) returns uuid language plpgsql as $$
declare v_go uuid;
begin
  perform pg_temp.login('00000000-0000-0000-0000-0000000000a2');
  v_go := (public.create_release_order(gen_random_uuid(), booking, 'Khách hàng 01', no, '15H-1', '0912345678', array['00000000-0000-0000-0000-0000000000f1'::uuid])->>'gate_out_id')::uuid;
  perform public.confirm_release_payment(gen_random_uuid(), v_go, 'TTTT', null, null, 'CASH');
  perform pg_temp.login('00000000-0000-0000-0000-0000000000a4');
  perform public.execute_gate_out(gen_random_uuid(), no);
  return v_go;
end $$;

select pg_temp.in_yard('MSKU3000001');
select pg_temp.in_yard('MSKU3000002');
select pg_temp.in_yard('MSKU3000003');
select pg_temp.in_yard('MSKU3000004');
select pg_temp.gated_out('MSKU3000001', 'BK-SWAP-1') as go1 \gset
select code as cv1 from public.gate_out_orders where id = :'go1' \gset

-- ==== 1. Từ chối ====
select pg_temp.login('00000000-0000-0000-0000-0000000000a4');
select throws_like(format($$ select public.swap_gate_out_container(gen_random_uuid(), %L, 'KEN_VO', 'MSKU3000002') $$, :'go1'),
  '%Không đủ quyền%', 'Xe nâng không đổi container');
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select throws_like(format($$ select public.swap_gate_out_container(gen_random_uuid(), %L, 'X', 'MSKU3000002') $$, :'go1'),
  '%chọn lý do%', 'Bắt buộc chọn 1 trong 2 lý do');
select public.toggle_container_hold('MSKU3000003', true, 'Hãng giữ vỏ');
select throws_like(format($$ select public.swap_gate_out_container(gen_random_uuid(), %L, 'KEN_VO', 'MSKU3000003') $$, :'go1'),
  '%chưa đủ điều kiện CẤP VỎ%', 'Cont thay thế đang khóa thì chặn');
select public.toggle_container_hold('MSKU3000003', false, 'Mở khóa');
select throws_like(format($$ select public.swap_gate_out_container(gen_random_uuid(), %L, 'KEN_VO', 'MSKU3999999') $$, :'go1'),
  '%Không tìm thấy container thay thế%', 'Cont thay thế phải đang tồn bãi');

-- ==== 2. Khách kén vỏ: lệnh CV- chuyển sang cont mới, giữ chứng từ / phiếu thu / QR ====
select lives_ok(format($$ select public.swap_gate_out_container('44444444-4444-4444-4444-444444444444', %L, 'KEN_VO', 'msku3000002') $$, :'go1'),
  'Văn phòng đổi container (kén vỏ)');
select lives_ok(format($$ select public.swap_gate_out_container('44444444-4444-4444-4444-444444444444', %L, 'KEN_VO', 'MSKU3000002') $$, :'go1'),
  'Bấm lặp (cùng request) không đổi lần 2');
select is((select container_no from public.gate_out_orders where id = :'go1'), 'MSKU3000002', 'Lệnh chuyển sang cont mới');
select is((select code from public.gate_out_orders where id = :'go1'), :'cv1', 'Giữ nguyên mã CV-');
select is((select status::text from public.gate_out_orders where id = :'go1'), 'PENDING_FORKLIFT', 'Lệnh quay về chờ Xe nâng cấp');
select is((select jsonb_array_length(swaps) from public.gate_out_orders where id = :'go1'), 1, 'Ghi 1 lần đổi');
select is((select container_no from public.vouchers where voucher_no = :'cv1'), 'MSKU3000002', 'Chứng từ giữ mã, đổi số cont');
select is((select container_no from public.payment_receipts where voucher_no = :'cv1'), 'MSKU3000002', 'Phiếu thu giữ nguyên, đổi số cont');
select is((select container_no from public.k80_tickets where out_dossier_code = :'cv1'), 'MSKU3000002', 'Phiếu K80 (QR-CV-) chuyển sang cont mới');
select is((select status::text || '|' || active_qr_code from public.containers where container_no = 'MSKU3000002' and status <> 'GATED_OUT'),
  'ALLOCATED|QR-' || :'cv1', 'Cont mới giữ cho lệnh, QR phiếu K80 cũ');
select is((select status::text || '|' || (swap_return->>'reason') || '|' || condition_class::text from public.containers where container_no = 'MSKU3000001' and status <> 'GATED_OUT'),
  'WAITING_PLACEMENT|KEN_VO|AV', 'Cont cũ về chờ hạ lại, giữ AV');
select is((select gate_out_at from public.containers where container_no = 'MSKU3000001' and status <> 'GATED_OUT'), null, 'Bỏ giờ OUT của cont cũ');
select throws_like(format($$ select public.swap_gate_out_container(gen_random_uuid(), %L, 'KEN_VO', 'MSKU3000003') $$, :'go1'),
  '%chờ trả chứng từ%', 'Lệnh chưa cấp ra lại thì không đổi tiếp');

-- Xe nâng cấp cont mới bằng QR phiếu đang cầm; hạ lại cont cũ → tồn bãi, cấp được khách khác
select pg_temp.login('00000000-0000-0000-0000-0000000000a4');
-- DEC-186: chưa hạ cont cũ thì không cấp được cont mới
select throws_like(format($$ select public.execute_gate_out(gen_random_uuid(), null, %L) $$, 'QR-' || :'cv1'),
  '%Phải HẠ container MSKU3000001%', 'Chưa hạ cont cũ → chặn cấp cont mới');
select lives_ok($$ select public.update_container_location(gen_random_uuid(), 'BLOCK-B', null, null, null, '', 'MSKU3000001') $$, 'Xe nâng hạ lại cont cũ');
select lives_ok(format($$ select public.execute_gate_out(gen_random_uuid(), null, %L) $$, 'QR-' || :'cv1'), 'Hạ xong → quét QR-CV- cũ cấp cont mới');
select is((select count(*)::int from public.location_history where container_no = 'MSKU3000001' and action = 'SWAP_RETURN'), 1, 'Lịch sử vị trí: Hạ lại (đổi container)');
select is((select public.release_blocker(c) from public.containers c where container_no = 'MSKU3000001' and status <> 'GATED_OUT'), null,
  'Kén vỏ: hạ xong cấp được khách khác');

-- ==== 3. Phát sinh hư hỏng: DAMAGE + PHÁT SINH CẤP VỎ → hạ xong vào Chờ báo giá ====
select pg_temp.gated_out('MSKU3000003', 'BK-SWAP-2') as go2 \gset
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select lives_ok(format($$ select public.swap_gate_out_container(gen_random_uuid(), %L, 'DAMAGE', 'MSKU3000004', 'Thủng sàn') $$, :'go2'),
  'Văn phòng đổi container (hư hỏng)');
select is((select condition_class::text || '|' || release_damage::text || '|' || needs_quotation::text from public.containers where container_no = 'MSKU3000003' and status <> 'GATED_OUT'),
  'DAMAGE|true|false', 'Cont cũ DAMAGE + PHÁT SINH CẤP VỎ, chưa hạ thì chưa vào Báo giá');
select pg_temp.login('00000000-0000-0000-0000-0000000000a4');
select lives_ok($$ select public.update_container_location(gen_random_uuid(), 'BLOCK-SC', null, null, null, '', 'MSKU3000003') $$, 'Xe nâng hạ khu sửa chữa');
select is((select needs_quotation::text || '|' || release_damage::text from public.containers where container_no = 'MSKU3000003' and status <> 'GATED_OUT'),
  'true|true', 'Hạ xong → Chờ báo giá, giữ nhãn PHÁT SINH CẤP VỎ');
select is((select items from public.work_orders where container_no = 'MSKU3000003' and category = 'INSPECTION' and work_status = 'OPEN'),
  array['Thủng sàn'], 'Tạo việc Báo giá với ghi chú hư hỏng');

select * from finish();
rollback;
