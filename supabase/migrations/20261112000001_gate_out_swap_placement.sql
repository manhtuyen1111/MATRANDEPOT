-- ============================================================================
-- DEC-186 — ĐỔI CONTAINER: Xe nâng phải HẠ cont cũ (Chờ hạ vỏ) xong mới được CẤP cont thay thế.
-- Định nghĩa lại execute_gate_out (migration 4) — chỉ thêm 1 bước kiểm tra sau điều kiện 1, giữ nguyên phần còn lại.
-- Hợp đồng nghiệp vụ: depotOperations.ts — swapPlacementBlocker / executeGateOut.
-- ============================================================================
create or replace function public.execute_gate_out(
  p_request_id uuid, p_container_no text default null, p_scanned_code text default null, p_pickup_block text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me public.staff;
  v_prev jsonb := public.idem_get(p_request_id);
  c public.containers;
  o public.gate_out_orders;
  b public.release_bookings;
  v public.vouchers;
  v_prev_loc text;
  v_out int;
  v_wait text;
begin
  if v_prev is not null then return v_prev; end if;
  me := public.assert_permission('GATE_OUT_CONFIRM', 'không được xác nhận xuất bãi / cấp vỏ.');
  c := public.lock_active_container(p_container_no, p_scanned_code);
  if c.id is null then raise exception 'Không tìm thấy container đang trong bãi (có thể đã xuất trước đó — GOUT-003).'; end if;
  if c.status <> 'ALLOCATED' then raise exception 'Container % chưa có lệnh CẤP VỎ hợp lệ.', c.container_no; end if;
  select * into o from public.gate_out_orders where container_id = c.id and status in ('PAYMENT_PENDING', 'PENDING_FORKLIFT') for update;
  if o.id is not null then select * into b from public.release_bookings where id = o.booking_id for update; end if;
  if o.id is null or b.id is null or b.status = 'CANCELLED' then
    raise exception 'Điều kiện 1 thất bại: Không có lệnh cấp / booking hợp lệ (GOUT-002).';
  end if;
  -- DEC-186: lệnh đã ĐỔI CONTAINER — phải HẠ cont cũ (Xe nâng — Chờ hạ vỏ) xong mới cấp cont mới
  select x.container_no into v_wait
  from jsonb_array_elements(o.swaps) s
  join public.containers x on x.id = (s->>'fromContainerId')::uuid
  where x.swap_return is not null and x.status = 'WAITING_PLACEMENT'
  limit 1;
  if v_wait is not null then
    raise exception 'Phải HẠ container % (đổi cont) ở Xe nâng — Chờ hạ vỏ trước khi cấp %.', v_wait, c.container_no;
  end if;
  if c.is_on_hold then raise exception 'Điều kiện 2 thất bại: Container % đang bị KHÓA (%).', c.container_no, c.hold_reason; end if;
  if o.booking_no <> b.booking_no then
    raise exception 'Điều kiện 3 thất bại: Container % không thuộc booking %.', c.container_no, b.booking_no;
  end if;
  select * into v from public.vouchers where id = o.voucher_id;
  if o.status <> 'PENDING_FORKLIFT' or v.status is null or v.status not in ('CONFIRMED', 'DEFERRED') then
    raise exception 'Điều kiện 4 thất bại: Chưa thanh toán / xác nhận thanh toán phí cấp vỏ tại Văn phòng.';
  end if;
  if coalesce(o.truck_no, '') = '' or coalesce(o.driver_phone, '') = '' then
    raise exception 'Điều kiện 5 thất bại: Thiếu SỐ XE / SĐT LÁI XE trên hồ sơ cấp vỏ.';
  end if;

  v_prev_loc := public.format_location(c.current_block, c.current_bay, c.current_row, c.current_tier);
  update public.gate_out_orders set status = 'GATE_OUT_OK', chk_valid_order = true, chk_not_on_hold = true, chk_correct_container = true,
    chk_payment_settled = true, chk_documents_completed = true, confirmed_by = me.id, confirmed_by_name = me.full_name, confirmed_at = now()
  where id = o.id;
  select count(*) into v_out from public.gate_out_orders where booking_id = b.id and status = 'GATE_OUT_OK';
  if b.requested_qty is not null and v_out >= b.requested_qty then update public.release_bookings set status = 'COMPLETED' where id = b.id; end if;
  -- DAMAGE cấp theo chỉ định: đóng việc Báo giá / Sửa chữa còn mở
  if c.condition_class = 'DAMAGE' then
    update public.work_orders set work_status = 'CANCELLED', result_notes = 'Đóng do cấp vỏ DAMAGE theo chỉ định'
    where container_id = c.id and category in ('INSPECTION', 'REPAIR') and work_status = 'OPEN';
  end if;
  perform public.add_location_history(c, v_prev_loc, 'OUT KHỎI BÃI (' || o.truck_no || ')', 'GATE_OUT_CLEAR',
    format('Cấp vỏ theo booking %s (%s)', b.booking_no, o.code));
  update public.containers set status = 'GATED_OUT', current_block = null, current_bay = null, current_row = null, current_tier = null,
    needs_quotation = false, needs_repair = false, forklift_task = 'NONE', gate_out_at = now()
  where id = c.id;
  perform public.write_audit('GATE_OUT_OK', 'GATE_OUT', o.code,
    format('[Hồ sơ %s] Xuất bãi %s (%s) từ %s%s theo booking %s, xe %s', o.code, c.container_no, c.condition_class, v_prev_loc,
      coalesce(' (xác nhận lấy tại ' || nullif(trim(p_pickup_block), '') || ')', ''), b.booking_no, o.truck_no), c.dossier_code);
  return public.idem_put(p_request_id, 'execute_gate_out', jsonb_build_object('gate_out_id', o.id));
end $$;

revoke execute on function public.execute_gate_out(uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.execute_gate_out(uuid, text, text, text) to authenticated;
