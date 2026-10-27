-- pgTAP — Migration 4: Cấp vỏ (lập lệnh, thanh toán, hủy, xuất bãi 5 điều kiện) + Nhập / Xuất tàu.
begin;
create extension if not exists pgtap with schema extensions;
select plan(40);

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
insert into public.yard_blocks (code, name) values ('BLOCK-B', 'Khu B');
insert into public.partners (code, name, is_shipping_line) values ('MSK', 'MSK', true);
insert into public.partners (code, name, is_customer, allow_tts) values ('KH01', 'Khách hàng 01', true, true);
insert into public.fee_catalog (id, code, name, category, amount) values
  ('00000000-0000-0000-0000-0000000000f1', 'LOLO', 'Nâng hạ', 'NANG_HA', 1000000);

create or replace function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
-- Hạ vỏ đủ luồng (Giám định → Văn phòng → tiền mặt → Xe nâng hạ BLOCK-B) → cont tồn bãi
create or replace function pg_temp.in_yard(no text, cond public.condition_class default 'AV') returns uuid language plpgsql as $$
declare v_g uuid;
begin
  perform pg_temp.login('00000000-0000-0000-0000-0000000000a1');
  v_g := (public.record_gate_in_field_step(gen_random_uuid(), 'door.jpg', cond, array['KHÔNG VỆ SINH'],
    case when cond = 'DAMAGE' then array['Móp'] else '{}' end, 'E', 2019)->>'id')::uuid;
  perform pg_temp.login('00000000-0000-0000-0000-0000000000a2');
  perform public.verify_gate_in_office(v_g, no, '20', 'DC', '15C-1', '0912345678', 'Khách hàng 01', 'MSK', '', array['00000000-0000-0000-0000-0000000000f1'::uuid]);
  perform public.confirm_gate_in_payment(gen_random_uuid(), v_g, 'TTTT', null, null, 'CASH');
  perform pg_temp.login('00000000-0000-0000-0000-0000000000a4');
  perform public.update_container_location(gen_random_uuid(), 'BLOCK-B', null, null, null, '', no);
  return (select id from public.containers where container_no = no and status = 'IN_YARD');
end $$;

select pg_temp.in_yard('MSKU2000001');
select pg_temp.in_yard('MSKU2000002');
select pg_temp.in_yard('MSKU2000003', 'DAMAGE');

-- ==== 1. Lập lệnh cấp vỏ ====
select pg_temp.login('00000000-0000-0000-0000-0000000000a4');
select throws_like($$ select public.create_release_order(gen_random_uuid(), 'BK1', 'Khách hàng 01', 'MSKU2000001', '15H-1', '0912345678', array['00000000-0000-0000-0000-0000000000f1'::uuid]) $$,
  '%Không đủ quyền%', 'Xe nâng không lập lệnh cấp');
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select throws_like($$ select public.create_release_order(gen_random_uuid(), ' ', 'Khách hàng 01', 'MSKU2000001', '15H-1', '0912345678', array['00000000-0000-0000-0000-0000000000f1'::uuid]) $$,
  '%SỐ BOOKING%', 'Bắt buộc booking');
-- DEC-027: DAMAGE được cấp theo chỉ định; chỉ AV còn dở báo giá / sửa chữa mới bị chặn
select is((select public.release_blocker(c) from public.containers c where container_no = 'MSKU2000003'), null, 'DAMAGE chờ báo giá vẫn cấp được (DEC-027)');
select is((select public.release_blocker(jsonb_populate_record(c, '{"condition_class": "AV"}')) from public.containers c where container_no = 'MSKU2000003'),
  'Chưa hoàn tất báo giá / sửa chữa', 'AV còn chờ báo giá thì chặn');
select public.toggle_container_hold('MSKU2000002', true, 'Hãng giữ vỏ');
select throws_like($$ select public.create_release_order(gen_random_uuid(), 'BK1', 'Khách hàng 01', 'MSKU2000002', '15H-1', '0912345678', array['00000000-0000-0000-0000-0000000000f1'::uuid]) $$,
  '%đang bị KHÓA%', 'Cont khóa không cấp được');
select matches((public.create_release_order('33333333-3333-3333-3333-333333333333', 'bk1', 'Khách hàng 01', 'MSKU2000001', '15h-1', '0912345678',
  array['00000000-0000-0000-0000-0000000000f1'::uuid])->>'code'), '^CV-\d{6}-001$', 'Lập lệnh, mã CV-');
select public.create_release_order('33333333-3333-3333-3333-333333333333', 'bk1', 'Khách hàng 01', 'MSKU2000001', '15h-1', '0912345678',
  array['00000000-0000-0000-0000-0000000000f1'::uuid]);
select is((select count(*)::int from public.gate_out_orders), 1, 'Bấm lặp không tạo 2 lệnh');
select is((select status::text from public.containers where container_no = 'MSKU2000001'), 'ALLOCATED', 'Cont giữ cho lệnh');
select is((select booking_no from public.release_bookings), 'BK1', 'Tạo booking (viết hoa)');
select (select id from public.gate_out_orders where container_no = 'MSKU2000001') as go1 \gset

-- ==== 2. Xuất bãi trước khi thanh toán bị chặn; thanh toán → K80 → xuất bãi ====
select pg_temp.login('00000000-0000-0000-0000-0000000000a4');
select throws_like($$ select public.execute_gate_out(gen_random_uuid(), 'MSKU2000001') $$, '%Điều kiện 4%', 'Chưa thanh toán không xuất bãi');
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select is((public.confirm_release_payment(gen_random_uuid(), :'go1', 'TTTT', null, null, 'CASH')->>'outcome'), 'SETTLED', 'Thu tiền cấp vỏ');
select is((select status::text from public.gate_out_orders where id = :'go1'), 'PENDING_FORKLIFT', 'Chờ Xe nâng cấp');
select is((select active_qr_code from public.containers where container_no = 'MSKU2000001'), 'QR-' || (select code from public.gate_out_orders where id = :'go1'),
  'QR chuyển sang QR-CV-');
select is((select count(*)::int from public.k80_tickets where operation_mode = 'CAP_VO'), 1, 'Phát hành K80 cấp vỏ');
select is((select operation from public.payment_receipts where voucher_no = (select code from public.gate_out_orders where id = :'go1')), 'CAP_VO',
  'Phiếu thu ghi tác nghiệp Cấp vỏ');
select throws_like(format($$ select public.release_allocated_container('MSKU2000001', 'Đổi cont') $$), '%đã ghi nhận thanh toán%', 'Đã thu tiền thì không hủy lệnh (OPEN-008)');
select pg_temp.login('00000000-0000-0000-0000-0000000000a4');
select lives_ok($$ select public.execute_gate_out(gen_random_uuid(), null, (select active_qr_code from public.containers where container_no = 'MSKU2000001')) $$, 'Quét QR xuất bãi');
select is((select status::text from public.containers where container_no = 'MSKU2000001'), 'GATED_OUT', 'Cont ra khỏi bãi');
select is((select status::text from public.gate_out_orders where id = :'go1'), 'GATE_OUT_OK', 'Lệnh GATE OUT OK');
select is((select count(*)::int from public.location_history where container_no = 'MSKU2000001' and action = 'GATE_OUT_CLEAR'), 1, 'Ghi lịch sử ra bãi');
select throws_like($$ select public.execute_gate_out(gen_random_uuid(), 'MSKU2000001') $$, '%GOUT-003%', 'Không xuất 2 lần');

-- ==== 3. Hủy lệnh khi chưa thu tiền; booking sai size ====
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select public.toggle_container_hold('MSKU2000002', false, 'Mở');
select public.create_release_order(gen_random_uuid(), 'BK2', 'Khách hàng 01', 'MSKU2000002', '15H-2', '0912345678', array['00000000-0000-0000-0000-0000000000f1'::uuid]);
select throws_like($$ select public.release_allocated_container('MSKU2000002', ' ') $$, '%lý do%', 'Hủy lệnh bắt buộc lý do');
select public.release_allocated_container('MSKU2000002', 'Khách đổi booking');
select is((select status::text || '|' || active_qr_code from public.containers where container_no = 'MSKU2000002'),
  'IN_YARD|QR-' || (select dossier_code from public.containers where container_no = 'MSKU2000002'), 'Hủy lệnh → cont về tồn bãi, QR Hạ vỏ');
select is((select status::text from public.vouchers where voucher_no = (select code from public.gate_out_orders where booking_no = 'BK2')), 'CANCELLED', 'Chứng từ cấp vỏ bị hủy');
update public.release_bookings set size = '40' where booking_no = 'BK2';
select throws_like($$ select public.create_release_order(gen_random_uuid(), 'BK2', 'Khách hàng 01', 'MSKU2000002', '15H-2', '0912345678', array['00000000-0000-0000-0000-0000000000f1'::uuid]) $$,
  '%không khớp Booking%', 'Size / Type phải khớp booking');

-- ==== 4. Xuất tàu: tự khóa + ghi chú; chặn cấp vỏ; xuất; duyệt khi chưa đủ ====
select public.create_vessel_list('XUAT_TAU', 'msk delta', now(), array['15c-901'], null, null,
  array[(select id from public.containers where container_no = 'MSKU2000002')]) as xt \gset
select is((select office_note || '|' || is_on_hold::text from public.containers where container_no = 'MSKU2000002'), 'XUẤT TÀU MSK DELTA|true',
  'Cont xuất tàu tự khóa + ghi chú (DEC-131)');
select throws_like($$ select public.toggle_container_hold('MSKU2000002', false, 'x') $$, '%bỏ khỏi danh sách Xuất tàu%', 'Không mở khóa tay khóa Xuất tàu');
select throws_like($$ select public.create_release_order(gen_random_uuid(), 'BK3', 'Khách hàng 01', 'MSKU2000002', '15H', '0912345678', array['00000000-0000-0000-0000-0000000000f1'::uuid]) $$,
  '%XUẤT TÀU%', 'Cont trong danh sách Xuất tàu không cấp vỏ');
select pg_temp.in_yard('MSKU2000004');
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select public.add_vessel_list_items(:'xt', 'XUAT_TAU', null, array[(select id from public.containers where container_no = 'MSKU2000004')]);
select pg_temp.login('00000000-0000-0000-0000-0000000000a4');
select throws_like(format($$ select public.execute_vessel_export(gen_random_uuid(), %L, (select id from public.vessel_list_items where container_no = 'MSKU2000002'), '15C-999') $$, :'xt'),
  '%SỐ XE%', 'Số xe phải trong danh sách');
select public.execute_vessel_export(gen_random_uuid(), :'xt', (select id from public.vessel_list_items where container_no = 'MSKU2000002'), '15c-901');
select is((select status::text from public.containers where container_no = 'MSKU2000002'), 'GATED_OUT', 'Xuất tàu → ra khỏi bãi');
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select throws_like(format($$ select public.approve_vessel_list(%L, 'XUAT_TAU') $$, :'xt'), '%bắt buộc ghi LÝ DO%', 'Chưa đủ phải ghi lý do');
select public.approve_vessel_list(:'xt', 'XUAT_TAU', 'Tàu chạy sớm');
select is((select status::text from public.vessel_list_items where container_no = 'MSKU2000004'), 'SKIPPED', 'Cont không kịp bị gạch');
select is((select is_on_hold::text || '|' || coalesce(office_note, '-') from public.containers where container_no = 'MSKU2000004'), 'false|-', 'Cont không kịp tự mở khóa');
select throws_like(format($$ select public.add_vessel_list_items(%L, 'XUAT_TAU', null, '{}') $$, :'xt'), '%đã được duyệt%', 'Đã duyệt không thao tác thêm');

-- ==== 5. Nhập tàu: lập danh sách → Giám định → Xe nâng hạ → hoàn thành ====
select throws_like($$ select public.create_vessel_list('NHAP_TAU', 'MSK ALPHA', now(), array['15C-1'], null, '[{"container_no":"MSKU3000001","size":"20","type":"DC"}]'::jsonb) $$,
  '%HÃNG TÀU%', 'Nhập tàu bắt buộc hãng tàu');
select throws_like($$ select public.create_vessel_list('NHAP_TAU', 'MSK ALPHA', now(), array['15C-1'], 'MSK', '[{"container_no":"MSKU2000004","size":"20","type":"DC"}]'::jsonb) $$,
  '%đang có trong TỒN VỎ%', 'Không nhập tàu cont đang tồn bãi');
select public.create_vessel_list('NHAP_TAU', 'MSK ALPHA', now(), array['15C-1'], 'MSK',
  '[{"container_no":"MSKU3000001","size":"20","type":"DC"},{"container_no":"MSKU3000002","size":"40","type":"HC"}]'::jsonb) as nt \gset
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select throws_like(format($$ select public.inspect_vessel_import_item(gen_random_uuid(), %L, (select id from public.vessel_list_items where container_no = 'MSKU3000001'),
  'MSKU3000009', '15C-1', 'AV', 'E', array['KHÔNG VỆ SINH'], 2019) $$, :'nt'), '%không khớp danh sách%', 'Số cont thực tế phải khớp');
select throws_like(format($$ select public.inspect_vessel_import_item(gen_random_uuid(), %L, (select id from public.vessel_list_items where container_no = 'MSKU3000001'),
  'MSKU3000001', '15C-1', 'W-SURVEY', 'E', array['KHÔNG VỆ SINH'], 2019) $$, :'nt'), '%DAMAGE / AV%', 'Nhập tàu không có W-SURVEY');
select matches((public.inspect_vessel_import_item(gen_random_uuid(), :'nt', (select id from public.vessel_list_items where container_no = 'MSKU3000001'),
  'MSKU3000001', '15c-1', 'AV', 'E', array['KHÔNG VỆ SINH'], 2019)->>'code'), '^NT-\d{6}-001$', 'Giám định cấp mã NT-');
select pg_temp.login('00000000-0000-0000-0000-0000000000a4');
select public.update_container_location(gen_random_uuid(), 'BLOCK-B', null, null, null, '', 'MSKU3000001');
select is((select status::text from public.vessel_list_items where container_no = 'MSKU3000001'), 'DONE', 'Xe nâng hạ → cont Nhập tàu hoàn thành');

select * from finish();
rollback;
