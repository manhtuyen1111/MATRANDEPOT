-- ============================================================================
-- DEC-194 — CẤP VỎ: TÁC NGHIỆP Release for customer (mặc định) / Release for sale (CẤP SALE, bắt buộc Sale code).
--   Các bước sau giống nhau (thanh toán, Xe nâng, trả chứng từ, đổi cont). Dùng cho EDI hãng tàu sau này (docs/EDI_MAERSK.md).
--   gate_out_type giữ nguyên (EMPTY_RELEASE) → báo cáo Cấp vỏ vẫn gồm cấp sale.
-- Hợp đồng nghiệp vụ: depotOperations.ts — createReleaseOrder.
-- ============================================================================
alter table public.gate_out_orders
  add column if not exists release_purpose text not null default 'CUSTOMER' check (release_purpose in ('CUSTOMER', 'SALE')),
  add column if not exists sale_code text check (sale_code is null or length(sale_code) <= 40);
alter table public.gate_out_orders drop constraint if exists gate_out_orders_sale_code_required;
alter table public.gate_out_orders add constraint gate_out_orders_sale_code_required check (release_purpose = 'CUSTOMER' or sale_code is not null);

-- Thêm 2 tham số (có mặc định) → bỏ bản cũ trước để không có 2 hàm trùng tên (PostgREST báo "không duy nhất")
drop function if exists public.create_release_order(uuid, text, text, text, text, text, uuid[]);

create or replace function public.create_release_order(
  p_request_id uuid, p_booking_no text, p_customer_name text, p_container_no text, p_truck_no text,
  p_driver_phone text, p_fee_ids uuid[], p_purpose text default 'CUSTOMER', p_sale_code text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me public.staff;
  v_prev jsonb := public.idem_get(p_request_id);
  v_booking_no text := upper(trim(coalesce(p_booking_no, '')));
  v_customer text;
  v_truck text := upper(trim(coalesce(p_truck_no, '')));
  v_phone text;
  v_blocker text;
  v_issued int;
  v_code text;
  v_amount bigint;
  c public.containers;
  b public.release_bookings;
  v public.vouchers;
  o public.gate_out_orders;
  v_purpose text := upper(coalesce(nullif(trim(p_purpose), ''), 'CUSTOMER'));
  v_sale text := upper(trim(coalesce(p_sale_code, '')));
begin
  if v_prev is not null then return v_prev; end if;
  me := public.assert_permission('RELEASE_ORDER', 'chỉ Văn phòng / Quản lý được lập lệnh CẤP VỎ.');
  if v_purpose not in ('CUSTOMER', 'SALE') then raise exception 'Tác nghiệp cấp vỏ không hợp lệ.'; end if;
  if v_purpose = 'SALE' and v_sale = '' then raise exception 'Release for sale: vui lòng nhập SALE CODE.'; end if;
  if length(v_sale) > 40 then raise exception 'SALE CODE tối đa 40 ký tự.'; end if;
  if v_booking_no = '' then raise exception 'Vui lòng nhập SỐ BOOKING.'; end if;
  v_customer := public.normalize_customer(p_customer_name);
  c := public.lock_active_container(p_container_no);
  if c.id is null then raise exception 'Không tìm thấy container đang tồn bãi.'; end if;
  v_blocker := public.release_blocker(c);
  if v_blocker is not null then raise exception 'Container % chưa đủ điều kiện CẤP VỎ: %.', c.container_no, v_blocker; end if;
  if v_truck = '' then raise exception 'Vui lòng nhập SỐ XE.'; end if;
  v_phone := public.normalize_driver_phone(p_driver_phone);
  if coalesce(array_length(p_fee_ids, 1), 0) = 0 then raise exception 'Vui lòng thêm ít nhất 1 khoản CHI PHÍ (đã bao gồm VAT) từ biểu giá.'; end if;

  select * into b from public.release_bookings where booking_no = v_booking_no for update;
  if b.id is not null then
    if b.status = 'CANCELLED' then raise exception 'Booking % đã bị hủy.', v_booking_no; end if;
    if b.size <> c.size or b.type <> c.type then
      raise exception 'Kích cỡ/Loại container (%) không khớp Booking % (%).', c.size || c.type, v_booking_no, b.size || b.type;
    end if;
    select count(*) into v_issued from public.gate_out_orders where booking_id = b.id and status <> 'CANCELLED';
    if b.requested_qty is not null and v_issued >= b.requested_qty then
      raise exception 'Booking % đã cấp đủ % container.', v_booking_no, b.requested_qty;
    end if;
  else
    insert into public.release_bookings (booking_no, shipping_line_code, requester_name, receiver_name, size, type)
    values (v_booking_no, c.shipping_line_code, v_customer, v_customer, c.size, c.type) returning * into b;
  end if;

  v_code := public.next_code('CV');
  insert into public.vouchers (voucher_no, service_type, dossier_code, container_no, shipping_line_code, payer_name, amount, created_by, created_by_name)
  values (v_code, 'GATE_OUT', v_code, c.container_no, c.shipping_line_code, v_customer, 0, me.id, me.full_name) returning * into v;
  v_amount := public.write_fee_lines('VOUCHER', v.id, p_fee_ids);
  update public.vouchers set amount = v_amount where id = v.id;
  insert into public.gate_out_orders (code, booking_id, booking_no, container_id, dossier_code, container_no, truck_no, driver_phone,
    receiver_name, fee_amount, voucher_id, created_by, created_by_name, release_purpose, sale_code)
  values (v_code, b.id, v_booking_no, c.id, c.dossier_code, c.container_no, v_truck, v_phone, v_customer, v_amount, v.id, me.id, me.full_name,
    v_purpose, case when v_purpose = 'SALE' then v_sale end)
  returning * into o;
  update public.containers set status = 'ALLOCATED', out_dossier_code = v_code, allocated_gate_out_id = o.id where id = c.id;
  perform public.write_audit('RELEASE_ORDER_CREATED', 'GATE_OUT', v_code,
    format('[Hồ sơ %s] Lập lệnh CẤP VỎ %s (%s) theo booking %s, xe %s%s; chứng từ %s: %s', v_code, c.container_no, c.condition_class,
      v_booking_no, v_truck, case when v_purpose = 'SALE' then ', Release for sale — Sale code ' || v_sale else '' end, v_code, public.vnd(v_amount)), c.dossier_code);
  return public.idem_put(p_request_id, 'create_release_order', jsonb_build_object('gate_out_id', o.id, 'code', v_code, 'amount', v_amount));
end $$;

revoke execute on function public.create_release_order(uuid, text, text, text, text, text, uuid[], text, text) from public, anon, authenticated;
grant execute on function public.create_release_order(uuid, text, text, text, text, text, uuid[], text, text) to authenticated;
