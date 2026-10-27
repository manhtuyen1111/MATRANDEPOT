-- pgTAP — Migration 3: Văn phòng Hạ vỏ, thanh toán TT / TTS / TTR, chuyển khoản, GATE IN OK, phiếu thu trả trước, in, hóa đơn.
begin;
create extension if not exists pgtap with schema extensions;
select plan(57);

-- ---- Dữ liệu thử ----
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'gd@matrandepot.local'),
  ('00000000-0000-0000-0000-0000000000a2', 'vp@matrandepot.local'),
  ('00000000-0000-0000-0000-0000000000a3', 'kt@matrandepot.local'),
  ('00000000-0000-0000-0000-0000000000a4', 'xn@matrandepot.local');
insert into public.staff (id, staff_code, username, full_name) values
  ('00000000-0000-0000-0000-0000000000a1', 'T1', 'gd.test', 'Giám định Test'),
  ('00000000-0000-0000-0000-0000000000a2', 'T2', 'vp.test', 'Văn phòng Test'),
  ('00000000-0000-0000-0000-0000000000a3', 'T3', 'kt.test', 'Kế toán Test'),
  ('00000000-0000-0000-0000-0000000000a4', 'T4', 'xn.test', 'Xe nâng Test');
insert into public.staff_roles values
  ('00000000-0000-0000-0000-0000000000a1', 'INSPECTOR'), ('00000000-0000-0000-0000-0000000000a2', 'OFFICE'),
  ('00000000-0000-0000-0000-0000000000a3', 'ACCOUNTANT'), ('00000000-0000-0000-0000-0000000000a4', 'FORKLIFT');
insert into public.container_sizes (code) values ('20'), ('40') on conflict do nothing;
insert into public.container_types (code) values ('DC'), ('HC') on conflict do nothing;
insert into public.partners (code, name, is_shipping_line) values ('MSK', 'MSK', true);
insert into public.partners (code, name, is_customer, allow_tts) values ('KH01', 'Khách hàng 01', true, true);
insert into public.fee_catalog (id, code, name, category, size, type, amount) values
  ('00000000-0000-0000-0000-0000000000f1', 'LOLO_20', 'Nâng hạ 20DC', 'NANG_HA', '20', 'DC', 1000000),
  ('00000000-0000-0000-0000-0000000000f2', 'RAC_1', 'THU GOM RÁC LV1', 'THU_GOM_RAC', null, null, 200000);

create or replace function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
-- Giám định + Văn phòng lập chứng từ → trả id hồ sơ Hạ vỏ
create or replace function pg_temp.new_gate(no text, customer text, cond public.condition_class default 'AV',
  cleaning text[] default array['KHÔNG VỆ SINH']) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  perform pg_temp.login('00000000-0000-0000-0000-0000000000a1');
  v_id := (public.record_gate_in_field_step(gen_random_uuid(), 'door.jpg', cond, cleaning,
    case when cond = 'DAMAGE' then array['Móp vách'] else '{}' end, 'E', 2019)->>'id')::uuid;
  perform pg_temp.login('00000000-0000-0000-0000-0000000000a2');
  perform public.verify_gate_in_office(v_id, no, '20', 'DC', '15c-123.45', '0912 345 678', customer, 'MSK', 'BK1',
    array['00000000-0000-0000-0000-0000000000f1'::uuid, '00000000-0000-0000-0000-0000000000f2'::uuid]);
  return v_id;
end $$;

-- ==== 1. Văn phòng lập chứng từ ====
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select (public.record_gate_in_field_step(gen_random_uuid(), 'door.jpg', 'AV', array['KHÔNG VỆ SINH'], '{}', 'E', 2019)->>'id') as g1 \gset
select throws_like(format($$ select public.verify_gate_in_office(%L, 'MSKU1000001', '20', 'DC', '15C', '0912345678', 'X', 'MSK', '', array['00000000-0000-0000-0000-0000000000f1'::uuid]) $$, :'g1'),
  '%Không đủ quyền%', 'Giám định không lập chứng từ');
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select throws_like(format($$ select public.verify_gate_in_office(%L, 'MSKU1000001', '20', 'DC', '15C', '0912345678', 'X', 'MSK', '', '{}') $$, :'g1'),
  '%ít nhất 1 khoản CHI PHÍ%', 'Bắt buộc chọn biểu giá');
select throws_like(format($$ select public.verify_gate_in_office(%L, 'MSKU1000001', '20', 'DC', '15C', '12', 'X', 'MSK', '', array['00000000-0000-0000-0000-0000000000f1'::uuid]) $$, :'g1'),
  '%SĐT LÁI XE%', 'SĐT sai');
select throws_like(format($$ select public.verify_gate_in_office(%L, 'MSKU1000001', '20', 'DC', '15C', '0912345678', 'X', 'ZZZ', '', array['00000000-0000-0000-0000-0000000000f1'::uuid]) $$, :'g1'),
  '%HÃNG TÀU%', 'Hãng tàu phải trong Danh mục');
select is((public.verify_gate_in_office(:'g1', 'MSKU1000001', '20', 'DC', '15c-1', '+84 912 345 678', 'khách hàng 01', 'MSK', 'BK1',
  array['00000000-0000-0000-0000-0000000000f1'::uuid, '00000000-0000-0000-0000-0000000000f2'::uuid])->>'amount')::bigint, 1200000::bigint, 'Tổng chi phí = tổng biểu giá');
select is((select payer_name || '|' || voucher_no from public.vouchers v join public.gate_in_orders g on g.voucher_id = v.id where g.id = :'g1'),
  'Khách hàng 01|' || (select code from public.gate_in_orders where id = :'g1'), 'Tên khách chuẩn theo Danh mục; số chứng từ = mã hồ sơ');
select is((select driver_phone from public.gate_in_orders where id = :'g1'), '0912345678', 'SĐT chuẩn hóa +84');
-- Trùng số cont đang có hồ sơ khác
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select (public.record_gate_in_field_step(gen_random_uuid(), 'door.jpg', 'AV', array['KHÔNG VỆ SINH'], '{}', 'E', 2019)->>'id') as g2 \gset
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select throws_like(format($$ select public.verify_gate_in_office(%L, 'MSKU1000001', '20', 'DC', '15C', '0912345678', 'X', 'MSK', '', array['00000000-0000-0000-0000-0000000000f1'::uuid]) $$, :'g2'),
  '%hồ sơ Hạ vỏ khác chưa hoàn tất%', 'Chặn trùng số cont (GIN-006)');

-- ==== 2. TT tiền mặt → phiếu thu + GATE IN OK ====
select throws_like(format($$ select public.confirm_gate_in_payment(gen_random_uuid(), %L, 'TTTT') $$, :'g1'), '%Phải chọn Chuyển khoản%', 'TT phải chọn cách thu');
select is((public.confirm_gate_in_payment('22222222-2222-2222-2222-222222222222', :'g1', 'TTTT', null, null, 'CASH')->>'outcome'), 'SETTLED', 'Thu tiền mặt xong');
select is((public.confirm_gate_in_payment('22222222-2222-2222-2222-222222222222', :'g1', 'TTTT', null, null, 'CASH')->>'outcome'), 'SETTLED', 'Bấm lặp cùng request_id trả kết quả cũ');
select is((select count(*)::int from public.payment_receipts), 1, 'Chỉ 1 phiếu thu');
select matches((select receipt_no from public.payment_receipts), '^PT-TT-\d{6}-0001$', 'Mã phiếu thu PT-TT-');
select matches((select invoice_secret from public.payment_receipts), '^[A-Za-z0-9]{12}$', 'Có mã bảo mật 12 ký tự');
select is((select status::text from public.gate_in_orders where id = :'g1'), 'GATE_IN_OK', 'GATE IN OK');
select is((select status::text || '|' || active_qr_code from public.containers where container_no = 'MSKU1000001'),
  'WAITING_PLACEMENT|QR-' || (select code from public.gate_in_orders where id = :'g1'), 'Tạo lượt lưu bãi, QR = QR-<mã hồ sơ>');
select is((select count(*)::int from public.k80_tickets where container_no = 'MSKU1000001'), 1, 'Phát hành K80');
select throws_like(format($$ select public.confirm_gate_in_payment(gen_random_uuid(), %L, 'TTTT', null, null, 'CASH') $$, :'g1'),
  '%đã ở trạng thái GATE IN OK%', 'Không thanh toán lại');

-- ==== 3. TTS ====
select pg_temp.new_gate('MSKU1000002', 'Khách hàng 01', 'DAMAGE', array['WP - QUÉT']) as g3 \gset
select throws_like(format($$ select public.confirm_gate_in_payment(gen_random_uuid(), %L, 'TTS') $$, :'g3'), '%Phải ghi chú%', 'TTS bắt buộc ghi chú');
select public.confirm_gate_in_payment(gen_random_uuid(), :'g3', 'TTS', null, 'Hãng tàu duyệt công nợ');
select is((select v.status::text from public.vouchers v join public.gate_in_orders g on g.voucher_id = v.id where g.id = :'g3'), 'DEFERRED', 'TTS → công nợ');
select is((select count(*)::int from public.payment_receipts), 1, 'TTS không phát hành phiếu thu');
select ok((select needs_cleaning and needs_quotation from public.containers where container_no = 'MSKU1000002'), 'DAMAGE + vệ sinh → chờ Vệ sinh và Báo giá');
select is((select count(*)::int from public.work_orders where container_no = 'MSKU1000002'), 2, 'Tạo việc Vệ sinh + Báo giá');
-- Khách ngoài Danh mục chỉ được TT
select pg_temp.new_gate('MSKU1000003', 'Khách lẻ ngoài danh mục') as g4 \gset
select throws_like(format($$ select public.confirm_gate_in_payment(gen_random_uuid(), %L, 'TTS', null, 'x') $$, :'g4'),
  '%chưa có trong Danh mục%', 'Khách ngoài Danh mục không được TTS (DEC-093)');

-- ==== 4. Chuyển khoản: tạo yêu cầu KHÔNG phải đã thu (DEC-031) ====
select is((public.confirm_gate_in_payment(gen_random_uuid(), :'g4', 'TTTT', null, null, 'BANK_TRANSFER_API')->>'outcome'), 'AWAITING_TRANSFER', 'Chuyển khoản → chờ ngân hàng');
select is((select status::text from public.gate_in_orders where id = :'g4'), 'PAYMENT_PENDING', 'Chưa GATE IN OK khi chưa có tiền');
select is((select count(*)::int from public.payment_receipts), 1, 'Chưa phát hành phiếu thu');
select throws_like(format($$ select public.confirm_gate_in_payment(gen_random_uuid(), %L, 'TTTT', null, null, 'CASH') $$, :'g4'),
  '%đang chờ kết quả chuyển khoản%', 'Không đổi hình thức khi đang chờ chuyển khoản');
select (select id from public.payment_transactions where status = 'PENDING' and container_no = 'MSKU1000003') as tx4 \gset
select pg_temp.login('00000000-0000-0000-0000-0000000000a4');
select throws_like(format($$ select public.confirm_transfer_manually(%L, 'FT123') $$, :'tx4'), '%Không đủ quyền%', 'Xe nâng không xác nhận tiền');
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select lives_ok(format($$ select public.confirm_transfer_manually(%L, null) $$, :'tx4'), 'Văn phòng xác nhận tay (không bắt buộc mã ngân hàng)');
select is((select status::text from public.gate_in_orders where id = :'g4'), 'GATE_IN_OK', 'Tiền về → GATE IN OK');
select is((select count(*)::int from public.payment_receipts), 2, 'Phát hành phiếu thu');
select throws_like(format($$ select public.confirm_transfer_manually(%L, null) $$, :'tx4'), '%không còn ở trạng thái chờ%', 'Không xác nhận 2 lần');
-- Ngân hàng báo lặp cùng mã giao dịch → bỏ qua; sai số tiền → từ chối
select pg_temp.new_gate('MSKU1000004', 'Khách hàng 01') as g5 \gset
select public.confirm_gate_in_payment(gen_random_uuid(), :'g5', 'TTTT', null, null, 'BANK_TRANSFER_API');
select (select code from public.gate_in_orders where id = :'g5') as code5 \gset
select throws_like(format($$ select public.bank_transfer_callback(%L, 'BANK-1', 1, true) $$, :'code5'), '%không khớp%', 'Sai số tiền bị từ chối');
select public.bank_transfer_callback(:'code5', 'BANK-1', 1200000, true);
select ok((public.bank_transfer_callback(:'code5', 'BANK-1', 1200000, true)->>'already_processed')::boolean, 'Ngân hàng gửi lặp → không ghi nhận lại');
select is((select count(*)::int from public.payment_receipts), 3, 'Mỗi giao dịch 1 phiếu thu');

-- ==== 5. Phiếu thu trả trước (TTR) ====
select throws_like($$ select public.create_prepaid_receipt('KH99', 'Lô', 'CASH', 1000) $$, '%từ Danh mục chung%', 'Phiếu trả trước phải chọn khách Danh mục');
select (public.create_prepaid_receipt('KH01', 'Lô tháng', 'CASH', null,
  '[{"catalog_id": "00000000-0000-0000-0000-0000000000f1", "quantity": 2}]'::jsonb)->>'code') as ttr \gset
select is((select total_amount from public.prepaid_receipts where code = :'ttr'), 2000000::bigint, 'Tổng = đơn giá × số lượng');
select pg_temp.new_gate('MSKU1000005', 'Khách hàng 01') as g6 \gset
select throws_like(format($$ select public.confirm_gate_in_payment(gen_random_uuid(), %L, 'TTT', %L) $$, :'g6', 'QR-' || :'ttr'),
  '%chưa được thu tiền nạp quỹ%', 'Chưa thu tiền nạp thì chưa trừ được');
select public.confirm_prepaid_cash((select id from public.payment_transactions where payment_ref = :'ttr'));
select is((select receipt_no from public.payment_receipts where purpose = 'PREPAID_TOPUP'), :'ttr', 'Phiếu nạp dùng lại mã PT-TTR- (DEC-124)');
select public.confirm_gate_in_payment(gen_random_uuid(), :'g6', 'TTT', 'qr-' || :'ttr');
select is((select remaining_amount from public.prepaid_receipts where code = :'ttr'), 800000::bigint, 'Trừ dần số dư');
select pg_temp.new_gate('MSKU1000006', 'Khách hàng 01') as g7 \gset
select throws_like(format($$ select public.confirm_gate_in_payment(gen_random_uuid(), %L, 'TTT', %L) $$, :'g7', 'QR-' || :'ttr'),
  '%không đủ%', 'Không đủ số dư bị chặn');

-- ==== 6. In phiếu thu + hóa đơn ====
select (select receipt_no from public.payment_receipts where operation = 'HA_VO' order by issued_at limit 1) as rno \gset
select (select invoice_secret from public.payment_receipts where receipt_no = :'rno') as secret \gset
select is(public.record_receipt_print(:'rno') + public.record_receipt_print(:'rno'), 3, 'Đếm lần in (1 + 2)');
select throws_like($$ select public.invoice_portal_lookup('AAAAAAAAAAAA') $$, '%Mã bảo mật không đúng%', 'Sai mã bảo mật');
select throws_like(format($$ select public.invoice_submit_request(%L, '123', 'a@b.vn', 'Cty', 'HP') $$, :'secret'), '%MÃ SỐ THUẾ%', 'MST sai');
select public.invoice_submit_request(:'secret', '0101234567', 'KT@Cty.vn', 'Công ty A', 'Hải Phòng');
select throws_like(format($$ select public.mark_invoice_issued(%L, '001') $$, :'rno'), '%chỉ Kế toán%', 'Văn phòng không cập nhật ĐÃ XHD');
select pg_temp.login('00000000-0000-0000-0000-0000000000a3');
select public.mark_invoice_issued(:'rno', '0000123');
select is((select invoice_status::text from public.payment_receipts where receipt_no = :'rno'), 'DA_XHD', 'Kế toán cập nhật ĐÃ XHD');
select throws_like(format($$ select public.invoice_submit_request(%L, '0101234567', 'a@b.vn', 'Cty', 'HP') $$, :'secret'),
  '%đã xuất hóa đơn%', 'Đã xuất thì khách không sửa được');

-- ==== 7. Hóa đơn theo lượt — phiếu thu trả trước (DEC-130) ====
select (select invoice_secret from public.payment_receipts where receipt_no = :'ttr') as ttr_secret \gset
select (select id from public.prepaid_deductions limit 1) as ded \gset
select throws_like(format($$ select public.invoice_submit_request(%L, '0101234567', 'a@b.vn', 'Cty', 'HP') $$, :'ttr_secret'),
  '%chọn các LƯỢT%', 'Phiếu trả trước phải yêu cầu theo lượt');
select public.invoice_submit_group(:'ttr_secret', array[:'ded'::uuid], '0101234567', 'a@b.vn', 'Cty', 'HP') as grp \gset
select throws_like(format($$ select public.invoice_submit_group(%L, array[%L::uuid], '0101234567', 'a@b.vn', 'Cty', 'HP') $$, :'ttr_secret', :'ded'),
  '%đã nằm trong một yêu cầu hóa đơn khác%', '1 lượt chỉ thuộc 1 yêu cầu');
select is(public.receipt_invoice_status((select id from public.payment_receipts where receipt_no = :'ttr'))::text, 'YEU_CAU_XHD', 'Có yêu cầu chờ → YÊU CẦU XHD');
select public.mark_invoice_issued(:'ttr', null, :'grp');
select is(public.receipt_invoice_status((select id from public.payment_receipts where receipt_no = :'ttr'))::text, 'DA_XHD', 'Mọi lượt đã xuất → ĐÃ XHD');

-- ==== 8. Hủy yêu cầu thanh toán đang chờ ====
select pg_temp.login('00000000-0000-0000-0000-0000000000a2');
select pg_temp.new_gate('MSKU1000007', 'Khách hàng 01') as g8 \gset
select public.confirm_gate_in_payment(gen_random_uuid(), :'g8', 'TTTT', null, null, 'BANK_TRANSFER_API');
select (select id from public.payment_transactions where status = 'PENDING' and container_no = 'MSKU1000007') as tx8 \gset
select throws_like(format($$ select public.cancel_pending_transaction(%L, ' ') $$, :'tx8'), '%lý do%', 'Hủy bắt buộc lý do');
select public.cancel_pending_transaction(:'tx8', 'Khách đổi sang tiền mặt');
select is((public.confirm_gate_in_payment(gen_random_uuid(), :'g8', 'TTTT', null, null, 'CASH')->>'outcome'), 'SETTLED', 'Hủy chờ chuyển khoản rồi thu tiền mặt được');

-- ==== 9. Khách chưa đăng nhập (anon) ====
set local role anon;
select throws_ok($$ select public.verify_gate_in_office(gen_random_uuid(), 'X', '20', 'DC', 'X', 'X', 'X', 'MSK', '', '{}') $$, '42501', null, 'anon không gọi được hàm nội bộ');
select throws_ok($$ select * from public.payment_receipts $$, '42501', null, 'anon không đọc bảng phiếu thu');
select lives_ok(format($$ select public.invoice_portal_lookup(%L) $$, :'secret'), 'anon tra được phiếu bằng đúng mã bảo mật');
reset role;

select * from finish();
rollback;
