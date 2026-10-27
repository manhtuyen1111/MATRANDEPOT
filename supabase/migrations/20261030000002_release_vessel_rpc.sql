-- ============================================================================
-- MATRAN DEPOT — Migration 4/5 (phần 2): RPC CẤP VỎ + XUẤT BÃI + NHẬP / XUẤT TÀU
-- Hợp đồng nghiệp vụ (giữ đúng thông báo lỗi): depotOperations.ts (releaseBlocker, createReleaseOrder,
-- confirmReleasePayment, completeReleasePayment, releaseAllocatedContainer, executeGateOut),
-- vessel.ts (createVesselList … approveVesselList, markVesselImportPlaced, vesselExportBlocker).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ĐIỀU KIỆN CẤP VỎ (releaseBlocker, DEC-027, DEC-131, DEC-147/150)
-- ---------------------------------------------------------------------------
create or replace function public.release_blocker(c public.containers) returns text
language sql stable as $$
  select case
    when c.status <> 'IN_YARD' then case when c.status = 'ALLOCATED' then 'Đã lập lệnh cấp' else 'Chưa tồn bãi (chờ hạ vỏ)' end
    when c.vessel_export_item_id is not null then 'Đang trong danh sách XUẤT TÀU'
    when c.is_on_hold then 'Container đang bị KHÓA'
    when c.needs_cleaning then 'Chưa xác nhận vệ sinh'
    when c.condition_class = 'W-SURVEY' then 'Chưa giám định (W-SURVEY)'
    when c.condition_class = 'AV' and (c.needs_quotation or c.needs_repair) then 'Chưa hoàn tất báo giá / sửa chữa'
    else null
  end;
$$;

-- Nhãn hình thức thanh toán (paymentLabelOf)
create or replace function public.payment_label(v public.vouchers) returns text
language sql stable as $$
  select case
    when v.status = 'DEFERRED' then 'TTS (' || coalesce(v.tts_note, 'Thanh toán sau') || ')'
    when v.payment_category = 'TTT' then trim('TTT (Đã trừ Phiếu thu trả trước ' || coalesce(v.prepaid_code, '') || ')')
    when v.payment_category = 'TTTT' then case when v.direct_method = 'BANK_TRANSFER_API' then 'TTTT (Chuyển khoản API)' else 'TTTT (Tiền mặt)' end
    else 'Chưa thanh toán'
  end;
$$;

-- ---------------------------------------------------------------------------
-- 1. LẬP LỆNH CẤP VỎ (createReleaseOrder) — chưa thu tiền
-- ---------------------------------------------------------------------------
create or replace function public.create_release_order(
  p_request_id uuid, p_booking_no text, p_customer_name text, p_container_no text, p_truck_no text,
  p_driver_phone text, p_fee_ids uuid[]
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
begin
  if v_prev is not null then return v_prev; end if;
  me := public.assert_permission('RELEASE_ORDER', 'chỉ Văn phòng / Quản lý được lập lệnh CẤP VỎ.');
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
    receiver_name, fee_amount, voucher_id, created_by, created_by_name)
  values (v_code, b.id, v_booking_no, c.id, c.dossier_code, c.container_no, v_truck, v_phone, v_customer, v_amount, v.id, me.id, me.full_name)
  returning * into o;
  update public.containers set status = 'ALLOCATED', out_dossier_code = v_code, allocated_gate_out_id = o.id where id = c.id;
  perform public.write_audit('RELEASE_ORDER_CREATED', 'GATE_OUT', v_code,
    format('[Hồ sơ %s] Lập lệnh CẤP VỎ %s (%s) theo booking %s, xe %s; chứng từ %s: %s', v_code, c.container_no, c.condition_class,
      v_booking_no, v_truck, v_code, public.vnd(v_amount)), c.dossier_code);
  return public.idem_put(p_request_id, 'create_release_order', jsonb_build_object('gate_out_id', o.id, 'code', v_code, 'amount', v_amount));
end $$;

-- Thanh toán xong → K80 CẤP VỎ (QR-CV-…) → Xe nâng chờ cấp (completeReleasePayment)
create or replace function public.complete_release_payment(p_gate_out_id uuid, p_actor_id uuid, p_actor_name text) returns void
language plpgsql security definer set search_path = public as $$
declare
  o public.gate_out_orders;
  v public.vouchers;
  c public.containers;
  v_qr text;
begin
  select * into o from public.gate_out_orders where id = p_gate_out_id for update;
  if o.id is null then raise exception 'Không tìm thấy hồ sơ CẤP VỎ.'; end if;
  if o.status <> 'PAYMENT_PENDING' then return; end if;
  select * into v from public.vouchers where id = o.voucher_id;
  if v.status is null or v.status not in ('CONFIRMED', 'DEFERRED') then raise exception 'Chưa thanh toán / xác nhận thanh toán hợp lệ.'; end if;
  select * into c from public.containers where id = o.container_id and status <> 'GATED_OUT' for update;
  if c.id is null then raise exception 'Không tìm thấy container của hồ sơ CẤP VỎ.'; end if;
  v_qr := 'QR-' || o.code; -- DEC-057
  insert into public.k80_tickets (code, dossier_code, out_dossier_code, qr_code, operation_mode, is_paid, payment_label, container_no, size, type,
    condition_class, damage_remarks, stuffing_class, cleaning_items, manufacture_year, truck_no, driver_phone, customer_name, target_block, issued_by, issued_by_name)
  values ('K80-' || o.code, c.dossier_code, o.code, v_qr, 'CAP_VO', v.status = 'CONFIRMED', public.payment_label(v), c.container_no, c.size, c.type,
    c.condition_class, c.damage_remarks, c.stuffing_class, c.cleaning_items, c.manufacture_year, o.truck_no, o.driver_phone, o.receiver_name,
    c.current_block, p_actor_id, p_actor_name);
  update public.gate_out_orders set status = 'PENDING_FORKLIFT', chk_payment_settled = true, k80_qr_code = v_qr where id = o.id;
  update public.containers set active_qr_code = v_qr where id = c.id;
  insert into public.audit_logs (actor_id, actor_name, actor_role, action_code, entity_type, entity_code, dossier_code, summary)
  values (p_actor_id, p_actor_name, case when p_actor_id is null then 'SYSTEM' else public.staff_primary_role(p_actor_id) end,
    'RELEASE_ORDER_PAID', 'GATE_OUT', o.code, c.dossier_code,
    format('[Hồ sơ %s] %s -> In phiếu K80 [%s] -> XE NÂNG - CHỜ CẤP VỎ', o.code, public.payment_label(v), v_qr));
end $$;

-- Tiền về sau (ngân hàng / xác nhận tay): hoàn tất Hạ vỏ hoặc Cấp vỏ (định nghĩa lại hàm của migration 3)
create or replace function public.complete_by_voucher(p_voucher_id uuid, p_actor_id uuid, p_actor_name text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  select id into v_id from public.gate_in_orders where voucher_id = p_voucher_id;
  if v_id is not null then perform public.complete_gate_in(v_id, p_actor_id, p_actor_name); return; end if;
  select id into v_id from public.gate_out_orders where voucher_id = p_voucher_id;
  if v_id is not null then perform public.complete_release_payment(v_id, p_actor_id, p_actor_name); end if;
end $$;

create or replace function public.confirm_release_payment(
  p_request_id uuid, p_gate_out_id uuid, p_category public.payment_category, p_scanned_qr text default null,
  p_tts_note text default null, p_method public.direct_method default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me public.staff;
  v_prev jsonb := public.idem_get(p_request_id);
  o public.gate_out_orders;
  v public.vouchers;
  v_outcome text := 'SETTLED';
begin
  if v_prev is not null then return v_prev; end if;
  me := public.assert_permission('PAYMENT_CONFIRM', 'chỉ Văn phòng / Quản lý được xác nhận khoản thu.');
  select * into o from public.gate_out_orders where id = p_gate_out_id for update;
  if o.id is null then raise exception 'Không tìm thấy hồ sơ CẤP VỎ.'; end if;
  if o.status <> 'PAYMENT_PENDING' then raise exception 'Hồ sơ % không ở trạng thái chờ thanh toán.', o.code; end if;
  select * into v from public.vouchers where id = o.voucher_id;
  if v.id is null then raise exception 'Không tìm thấy chứng từ thanh toán.'; end if;
  if v.status = 'PENDING' then
    v_outcome := public.settle_voucher(v.id, p_category, p_scanned_qr, p_tts_note, p_method);
  elsif v.status not in ('CONFIRMED', 'DEFERRED') then
    raise exception 'Chứng từ % ở trạng thái %.', v.voucher_no, v.status;
  end if;
  if v_outcome = 'SETTLED' then perform public.complete_release_payment(o.id, me.id, me.full_name); end if;
  return public.idem_put(p_request_id, 'confirm_release_payment', jsonb_build_object('outcome', v_outcome));
end $$;

-- ---------------------------------------------------------------------------
-- 2. HỦY LỆNH CẤP (releaseAllocatedContainer) — chỉ khi chưa ghi nhận thanh toán (OPEN-008: hoàn tiền giữ chặn)
-- ---------------------------------------------------------------------------
create or replace function public.release_allocated_container(p_container_no text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  me public.staff;
  c public.containers;
  o public.gate_out_orders;
  v public.vouchers;
  v_reason text := trim(coalesce(p_reason, ''));
  v_tx uuid;
begin
  me := public.assert_permission('RELEASE_ORDER', 'chỉ Văn phòng / Quản lý được hủy lệnh cấp vỏ.');
  if v_reason = '' then raise exception 'Bắt buộc nhập lý do đổi/hủy lệnh cấp container (REL-003/REL-004).'; end if;
  c := public.lock_active_container(p_container_no);
  if c.id is null or c.status <> 'ALLOCATED' then raise exception 'Container không ở trạng thái đã lập lệnh cấp vỏ.'; end if;
  select * into o from public.gate_out_orders where container_id = c.id and status in ('PAYMENT_PENDING', 'PENDING_FORKLIFT') for update;
  if o.id is null then raise exception 'Không tìm thấy hồ sơ CẤP VỎ đang hiệu lực của container.'; end if;
  select * into v from public.vouchers where id = o.voucher_id for update;
  if v.status in ('CONFIRMED', 'DEFERRED') then
    raise exception 'Hồ sơ % đã ghi nhận thanh toán (%). Hủy lệnh cần quy trình hoàn tiền / điều chỉnh công nợ chưa được xác nhận (OPEN-006).',
      o.code, public.payment_label(v);
  end if;
  select id into v_tx from public.payment_transactions where voucher_id = v.id and status = 'PENDING';
  if v_tx is not null then perform public.cancel_pending_transaction(v_tx, v_reason); end if;
  update public.vouchers set status = 'CANCELLED' where id = v.id;
  update public.gate_out_orders set status = 'CANCELLED', cancel_reason = v_reason, cancelled_by_name = me.full_name, cancelled_at = now() where id = o.id;
  update public.release_bookings set status = 'OPEN' where id = o.booking_id and status = 'FULLY_ALLOCATED';
  -- Quay về QR phiếu Hạ vỏ của lượt lưu bãi
  update public.containers set status = 'IN_YARD', active_qr_code = 'QR-' || c.dossier_code, out_dossier_code = null, allocated_gate_out_id = null
  where id = c.id;
  perform public.write_audit('RELEASE_ORDER_CANCELLED', 'GATE_OUT', o.code,
    format('[Hồ sơ %s] Hủy lệnh cấp %s khỏi booking %s. Lý do: %s', o.code, c.container_no, o.booking_no, v_reason), c.dossier_code);
end $$;

-- ---------------------------------------------------------------------------
-- 3. XE NÂNG — CHỜ CẤP VỎ: kiểm 5 điều kiện (DEC-015) rồi xuất bãi (executeGateOut)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 4. NHẬP / XUẤT TÀU (vessel.ts)
-- ---------------------------------------------------------------------------
create or replace function public.vessel_label(m public.vessel_mode) returns text
language sql immutable as $$ select case when m = 'NHAP_TAU' then 'NHẬP TÀU' else 'XUẤT TÀU' end $$;

-- Danh sách đang mở, đúng loại (findList)
create or replace function public.lock_open_vessel_list(p_list_id uuid, p_mode public.vessel_mode) returns public.vessel_lists
language plpgsql security definer set search_path = public as $$
declare
  l public.vessel_lists;
begin
  select * into l from public.vessel_lists where id = p_list_id for update;
  if l.id is null or l.mode <> p_mode then raise exception 'Không tìm thấy danh sách %.', public.vessel_label(p_mode); end if;
  if l.status = 'APPROVED' then
    raise exception 'Danh sách % tàu % đã được duyệt — không thao tác thêm.', public.vessel_label(p_mode), l.vessel_name;
  end if;
  return l;
end $$;

-- DEC-131: cont trong danh sách XUẤT TÀU tự khóa + ghi chú tên tàu; bỏ khỏi danh sách / không kịp → mở khóa + xóa ghi chú
create or replace function public.vessel_lock(p_container_id uuid, p_vessel text) returns void
language plpgsql security definer set search_path = public as $$
declare
  me public.staff := public.current_staff();
  v_note text := 'XUẤT TÀU ' || p_vessel;
begin
  update public.containers set is_on_hold = true, hold_source = 'VESSEL_EXPORT', hold_reason = v_note, hold_by_name = me.full_name, hold_at = now(),
    office_note = v_note, office_note_by_name = me.full_name, office_note_at = now()
  where id = p_container_id;
end $$;

create or replace function public.vessel_unlock(p_container_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.containers set vessel_export_item_id = null, is_on_hold = false, hold_source = null, hold_reason = null, hold_by_name = null,
    hold_at = null, office_note = null, office_note_by_name = null, office_note_at = null
  where id = p_container_id;
$$;

create or replace function public.vessel_validate_header(p_mode public.vessel_mode, p_name text, p_planned_at timestamptz, p_trucks text[],
  out o_name text, out o_trucks text[])
language plpgsql immutable as $$
begin
  o_name := upper(trim(coalesce(p_name, '')));
  if o_name = '' then raise exception 'Bắt buộc nhập TÊN TÀU.'; end if;
  if p_planned_at is null then raise exception 'Bắt buộc nhập THỜI GIAN % hợp lệ (dd/MM/yyyy HH:mm:ss).', public.vessel_label(p_mode); end if;
  o_trucks := array(select distinct upper(trim(x)) from unnest(coalesce(p_trucks, '{}')) x where trim(x) <> '');
  if coalesce(array_length(o_trucks, 1), 0) = 0 then raise exception 'Bắt buộc nhập DANH SÁCH SỐ XE %.', public.vessel_label(p_mode); end if;
end $$;

-- Thêm dòng NHẬP TÀU (buildImportItems). p_items: [{"container_no":"…","size":"40","type":"HC"}]
create or replace function public.vessel_add_import_items(p_list_id uuid, p_items jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare
  it jsonb;
  v_no text;
  v_conflict text;
  v_other text;
  v_n int := 0;
begin
  if p_items is null or jsonb_array_length(p_items) = 0 then raise exception 'Danh sách nhập tàu chưa có container nào.'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    v_no := upper(trim(coalesce(it->>'container_no', '')));
    if v_no !~ '^[A-Z]{4}[0-9]{7}$' then raise exception 'SỐ CONTAINER không hợp lệ (chuẩn 4 chữ cái + 7 chữ số, ví dụ MSKU4089123).'; end if;
    if exists (select 1 from public.vessel_list_items where list_id = p_list_id and container_no = v_no) then
      raise exception 'Container % bị trùng trong danh sách.', v_no;
    end if;
    if not exists (select 1 from public.container_sizes where code = it->>'size' and is_active) then
      raise exception 'Size "%" của % không có trong Danh mục.', it->>'size', v_no;
    end if;
    if not exists (select 1 from public.container_types where code = it->>'type' and is_active) then
      raise exception 'Type "%" của % không có trong Danh mục.', it->>'type', v_no;
    end if;
    v_conflict := public.gate_in_container_conflict(v_no);
    if v_conflict is not null then raise exception '%', v_conflict; end if;
    select l.vessel_name into v_other from public.vessel_list_items i join public.vessel_lists l on l.id = i.list_id
    where l.mode = 'NHAP_TAU' and l.status = 'OPEN' and l.id <> p_list_id and i.container_no = v_no and i.status = 'PENDING' limit 1;
    if v_other is not null then raise exception 'Container % đang chờ nhập ở danh sách tàu %.', v_no, v_other; end if;
    insert into public.vessel_list_items (list_id, container_no, size, type) values (p_list_id, v_no, it->>'size', it->>'type');
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

-- Thêm dòng XUẤT TÀU (buildExportItems): chọn từ tồn vỏ, cấp XT-, tự khóa
create or replace function public.vessel_add_export_items(p_list_id uuid, p_container_ids uuid[], p_vessel text) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  c public.containers;
  v_blocker text;
  v_item uuid;
  v_n int := 0;
begin
  if coalesce(array_length(p_container_ids, 1), 0) = 0 then raise exception 'Danh sách xuất tàu chưa có container nào (chọn từ tồn vỏ).'; end if;
  for v_id in select distinct x from unnest(p_container_ids) x loop
    c := public.lock_container_by_id(v_id);
    if c.id is null or c.status = 'GATED_OUT' then raise exception 'Có container không còn tồn bãi — tải lại danh sách.'; end if;
    v_blocker := case
      when c.status <> 'IN_YARD' then case when c.status = 'ALLOCATED' then 'Đã lập lệnh cấp vỏ' else 'Chưa tồn bãi (chờ hạ vỏ)' end
      when c.vessel_export_item_id is not null then 'Đã trong danh sách Xuất tàu khác'
      when c.is_on_hold then 'Container đang bị KHÓA' end;
    if v_blocker is not null then raise exception 'Container % không đưa vào XUẤT TÀU được: %.', c.container_no, v_blocker; end if;
    insert into public.vessel_list_items (list_id, container_no, size, type, dossier_code, container_id, condition_class, stuffing_class, location_at_list)
    values (p_list_id, c.container_no, c.size, c.type, public.next_code('XT'), c.id, c.condition_class, c.stuffing_class,
      public.format_location(c.current_block, c.current_bay, c.current_row, c.current_tier))
    returning id into v_item;
    update public.containers set vessel_export_item_id = v_item where id = c.id;
    perform public.vessel_lock(c.id, p_vessel);
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

create or replace function public.create_vessel_list(
  p_mode public.vessel_mode, p_vessel_name text, p_planned_at timestamptz, p_truck_nos text[],
  p_shipping_line_code text default null, p_import_items jsonb default null, p_export_container_ids uuid[] default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  me public.staff;
  h record;
  v_line text;
  v_id uuid;
  v_n int;
begin
  me := public.assert_permission('VESSEL_LIST_MANAGE', format('chỉ Văn phòng / Quản lý được lập danh sách %s.', public.vessel_label(p_mode)));
  select * into h from public.vessel_validate_header(p_mode, p_vessel_name, p_planned_at, p_truck_nos);
  if p_mode = 'NHAP_TAU' then
    select code into v_line from public.partners where is_shipping_line and is_active and code = p_shipping_line_code;
    if v_line is null then raise exception 'Bắt buộc chọn HÃNG TÀU theo Danh mục chung.'; end if;
  end if;
  insert into public.vessel_lists (mode, vessel_name, shipping_line_code, planned_at, truck_nos, created_by, created_by_name)
  values (p_mode, h.o_name, v_line, p_planned_at, h.o_trucks, me.id, me.full_name) returning id into v_id;
  v_n := case when p_mode = 'NHAP_TAU' then public.vessel_add_import_items(v_id, p_import_items)
              else public.vessel_add_export_items(v_id, p_export_container_ids, h.o_name) end;
  perform public.write_audit(case when p_mode = 'NHAP_TAU' then 'NHAP_TAU_LAP_DANH_SACH' else 'XUAT_TAU_LAP_DANH_SACH' end, 'VESSEL', h.o_name,
    format('Văn phòng lập danh sách %s tàu %s (%s): %s container, xe %s', public.vessel_label(p_mode), h.o_name,
      to_char(p_planned_at at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI:SS'), v_n, array_to_string(h.o_trucks, ', ')));
  return v_id;
end $$;

-- Sửa thông tin chung; hãng tàu Nhập tàu chỉ đổi khi chưa giám định cont nào
create or replace function public.update_vessel_list(
  p_list_id uuid, p_mode public.vessel_mode, p_vessel_name text, p_planned_at timestamptz, p_truck_nos text[], p_shipping_line_code text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  l public.vessel_lists;
  h record;
  v_line text;
  v_cid uuid;
begin
  perform public.assert_permission('VESSEL_LIST_MANAGE', format('chỉ Văn phòng / Quản lý được sửa danh sách %s.', public.vessel_label(p_mode)));
  l := public.lock_open_vessel_list(p_list_id, p_mode);
  select * into h from public.vessel_validate_header(p_mode, p_vessel_name, p_planned_at, p_truck_nos);
  v_line := l.shipping_line_code;
  if p_mode = 'NHAP_TAU' then
    select code into v_line from public.partners where is_shipping_line and is_active and code = p_shipping_line_code;
    if v_line is null then raise exception 'Bắt buộc chọn HÃNG TÀU theo Danh mục chung.'; end if;
    if v_line <> l.shipping_line_code and exists (select 1 from public.vessel_list_items where list_id = l.id and status <> 'PENDING') then
      raise exception 'Đã có container được giám định — không đổi HÃNG TÀU được.';
    end if;
  elsif h.o_name <> l.vessel_name then
    for v_cid in select container_id from public.vessel_list_items where list_id = l.id and status = 'PENDING' and container_id is not null loop
      perform public.vessel_lock(v_cid, h.o_name); -- DEC-131: ghi chú theo tên tàu mới
    end loop;
  end if;
  update public.vessel_lists set vessel_name = h.o_name, planned_at = p_planned_at, truck_nos = h.o_trucks, shipping_line_code = v_line where id = l.id;
  perform public.write_audit('VESSEL_UPDATE_LIST', 'VESSEL', h.o_name,
    format('Sửa danh sách %s: tàu %s → %s, %s, xe %s%s', public.vessel_label(p_mode), l.vessel_name, h.o_name,
      to_char(p_planned_at at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI:SS'), array_to_string(h.o_trucks, ', '), coalesce(', hãng ' || v_line, '')));
end $$;

create or replace function public.add_vessel_list_items(
  p_list_id uuid, p_mode public.vessel_mode, p_import_items jsonb default null, p_export_container_ids uuid[] default null
) returns int
language plpgsql security definer set search_path = public as $$
declare
  l public.vessel_lists;
  v_n int;
begin
  perform public.assert_permission('VESSEL_LIST_MANAGE', format('chỉ Văn phòng / Quản lý được sửa danh sách %s.', public.vessel_label(p_mode)));
  l := public.lock_open_vessel_list(p_list_id, p_mode);
  v_n := case when p_mode = 'NHAP_TAU' then public.vessel_add_import_items(l.id, p_import_items)
              else public.vessel_add_export_items(l.id, p_export_container_ids, l.vessel_name) end;
  perform public.write_audit('VESSEL_ADD_ITEMS', 'VESSEL', l.vessel_name,
    format('Thêm %s container vào danh sách %s tàu %s', v_n, public.vessel_label(p_mode), l.vessel_name));
  return v_n;
end $$;

-- Xóa cả danh sách: chỉ khi chưa có cont nào tác nghiệp
create or replace function public.delete_vessel_list(p_list_id uuid, p_mode public.vessel_mode) returns void
language plpgsql security definer set search_path = public as $$
declare
  l public.vessel_lists;
  v_worked int;
  v_total int;
  v_cid uuid;
begin
  perform public.assert_permission('VESSEL_LIST_MANAGE', format('chỉ Văn phòng / Quản lý được xóa danh sách %s.', public.vessel_label(p_mode)));
  l := public.lock_open_vessel_list(p_list_id, p_mode);
  select count(*) filter (where status <> 'PENDING'), count(*) into v_worked, v_total from public.vessel_list_items where list_id = l.id;
  if v_worked > 0 then
    raise exception 'Đã có % container được tác nghiệp — không xóa danh sách được (chỉ bỏ được cont còn chờ).', v_worked;
  end if;
  if p_mode = 'XUAT_TAU' then
    for v_cid in select container_id from public.vessel_list_items where list_id = l.id and container_id is not null loop
      perform public.vessel_unlock(v_cid);
    end loop;
  end if;
  delete from public.vessel_lists where id = l.id;
  perform public.write_audit('VESSEL_DELETE_LIST', 'VESSEL', l.vessel_name,
    format('Xóa danh sách %s tàu %s (%s container chưa tác nghiệp)', public.vessel_label(p_mode), l.vessel_name, v_total));
end $$;

create or replace function public.remove_vessel_list_item(p_list_id uuid, p_item_id uuid, p_mode public.vessel_mode) returns void
language plpgsql security definer set search_path = public as $$
declare
  l public.vessel_lists;
  i public.vessel_list_items;
begin
  perform public.assert_permission('VESSEL_LIST_MANAGE', format('chỉ Văn phòng / Quản lý được sửa danh sách %s.', public.vessel_label(p_mode)));
  l := public.lock_open_vessel_list(p_list_id, p_mode);
  select * into i from public.vessel_list_items where id = p_item_id and list_id = l.id for update;
  if i.id is null then raise exception 'Không tìm thấy container trong danh sách.'; end if;
  if i.status <> 'PENDING' then raise exception 'Container % đã tác nghiệp — không bỏ khỏi danh sách được.', i.container_no; end if;
  if p_mode = 'XUAT_TAU' and i.container_id is not null then perform public.vessel_unlock(i.container_id); end if;
  delete from public.vessel_list_items where id = i.id;
  perform public.write_audit('VESSEL_REMOVE_ITEM', 'VESSEL', l.vessel_name,
    format('Bỏ %s khỏi danh sách %s tàu %s', i.container_no, public.vessel_label(p_mode), l.vessel_name), i.dossier_code);
end $$;

-- Giám định NHẬP TÀU: xác nhận cont về thực tế → lượt lưu bãi NT- (chờ vệ sinh / hạ vỏ như Hạ vỏ)
create or replace function public.inspect_vessel_import_item(
  p_request_id uuid, p_list_id uuid, p_item_id uuid, p_actual_container_no text, p_truck_no text,
  p_condition public.condition_class, p_stuffing public.stuffing_class, p_cleaning_items text[], p_manufacture_year int,
  p_damage_remarks text[] default '{}', p_door_photo_path text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me public.staff;
  v_prev jsonb := public.idem_get(p_request_id);
  l public.vessel_lists;
  i public.vessel_list_items;
  v_actual text := upper(trim(coalesce(p_actual_container_no, '')));
  v_truck text := upper(trim(coalesce(p_truck_no, '')));
  v_cleaning text[];
  v_remarks text[];
  v_conflict text;
  v_code text;
  v_cid uuid;
  v_damage boolean := p_condition = 'DAMAGE';
  v_clean boolean;
begin
  if v_prev is not null then return v_prev; end if;
  me := public.assert_permission('VESSEL_IMPORT_INSPECT', 'chỉ Bộ phận Giám định / Quản lý được xác nhận container NHẬP TÀU.');
  l := public.lock_open_vessel_list(p_list_id, 'NHAP_TAU');
  select * into i from public.vessel_list_items where id = p_item_id and list_id = l.id for update;
  if i.id is null then raise exception 'Không tìm thấy container trong danh sách.'; end if;
  if i.status <> 'PENDING' then raise exception 'Container % đã được Giám định xác nhận.', i.container_no; end if;
  if v_actual !~ '^[A-Z]{4}[0-9]{7}$' then raise exception 'SỐ CONTAINER không hợp lệ (chuẩn 4 chữ cái + 7 chữ số, ví dụ MSKU4089123).'; end if;
  if v_actual <> i.container_no then
    raise exception 'Số cont thực tế % không khớp danh sách (%). Kiểm tra lại hoặc báo Văn phòng sửa danh sách.', v_actual, i.container_no;
  end if;
  if not (v_truck = any (l.truck_nos)) then raise exception 'Bắt buộc chọn SỐ XE trong danh sách xe nhập tàu.'; end if;
  if p_condition not in ('AV', 'DAMAGE') then raise exception 'Bắt buộc chọn TRẠNG THÁI: DAMAGE / AV.'; end if; -- W-SURVEY chỉ ở Hạ vỏ
  if p_stuffing is null then raise exception 'Bắt buộc chọn PHÂN LOẠI ĐÓNG HÀNG: M / K / E.'; end if;
  v_cleaning := array(select distinct x from unnest(coalesce(p_cleaning_items, '{}')) x where trim(x) <> '');
  if coalesce(array_length(v_cleaning, 1), 0) = 0 then raise exception 'Bắt buộc chọn TÌNH TRẠNG VỆ SINH (1 hoặc nhiều phương án).'; end if;
  if array_length(v_cleaning, 1) > 1 then v_cleaning := array_remove(v_cleaning, 'KHÔNG VỆ SINH'); end if;
  if not public.valid_cleaning_items(v_cleaning) then raise exception 'Hạng mục vệ sinh không hợp lệ.'; end if;
  if p_manufacture_year is null or p_manufacture_year < 1980 or p_manufacture_year > extract(year from now())::int + 1 then
    raise exception 'Năm sinh container (AGE) phải theo định dạng 4 chữ số hợp lệ (VD: 2001, 2002...).';
  end if;
  v_conflict := public.gate_in_container_conflict(v_actual);
  if v_conflict is not null then raise exception '%', v_conflict; end if;

  v_code := public.next_code('NT');
  v_remarks := case when v_damage then array(select trim(x) from unnest(coalesce(p_damage_remarks, '{}')) x where trim(x) <> '') else '{}' end;
  v_clean := exists (select 1 from unnest(v_cleaning) x where x <> 'KHÔNG VỆ SINH');
  insert into public.containers (dossier_code, container_no, size, type, manufacture_year, shipping_line_code, customer_name, truck_no, status,
    condition_class, damage_remarks, stuffing_class, cleaning_items, active_qr_code, is_paid, needs_cleaning, needs_quotation)
  values (v_code, v_actual, i.size, i.type, p_manufacture_year, coalesce(l.shipping_line_code, ''), '', v_truck, 'WAITING_PLACEMENT',
    p_condition, v_remarks, p_stuffing, v_cleaning, 'QR-' || v_code, false, v_clean, v_damage)
  returning id into v_cid;
  if v_damage then
    insert into public.work_orders (code, container_id, dossier_code, container_no, category, items, assigned_to)
    values ('INSP-' || v_code, v_cid, v_code, v_actual, 'INSPECTION',
      case when array_length(v_remarks, 1) > 0 then v_remarks else array['Hư hỏng ghi nhận khi Nhập tàu'] end, 'Bộ phận Báo giá');
  end if;
  if v_clean then
    insert into public.work_orders (code, container_id, dossier_code, container_no, category, items, assigned_to)
    values ('CLN-' || v_code, v_cid, v_code, v_actual, 'CLEANING', v_cleaning, 'Bộ phận Vệ sinh');
  end if;
  update public.vessel_list_items set status = 'INSPECTED', dossier_code = v_code, container_id = v_cid, truck_no = v_truck,
    condition_class = p_condition, stuffing_class = p_stuffing, cleaning_items = v_cleaning, damage_remarks = v_remarks,
    manufacture_year = p_manufacture_year, door_photo_path = nullif(trim(coalesce(p_door_photo_path, '')), ''),
    inspected_by = me.id, inspected_by_name = me.full_name, inspected_at = now()
  where id = i.id;
  perform public.write_audit('NHAP_TAU_GIAM_DINH', 'VESSEL', v_code,
    format('[Hồ sơ %s] Giám định xác nhận NHẬP TÀU %s (tàu %s, xe %s): %s%s, Đóng hàng %s, Vệ sinh [%s], AGE %s -> %s', v_code, v_actual,
      l.vessel_name, v_truck, p_condition, case when array_length(v_remarks, 1) > 0 then ' (' || array_to_string(v_remarks, ', ') || ')' else '' end,
      p_stuffing, array_to_string(v_cleaning, ', '), p_manufacture_year, case when v_clean then 'Chờ vệ sinh' else 'Chờ hạ vỏ' end), v_code);
  return public.idem_put(p_request_id, 'inspect_vessel_import_item', jsonb_build_object('container_id', v_cid, 'code', v_code));
end $$;

-- Xe nâng hạ cont NHẬP TÀU → hoàn thành trong danh sách (markVesselImportPlaced)
create or replace function public.mark_vessel_import_placed(p_container_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  me public.staff := public.current_staff();
begin
  update public.vessel_list_items i set status = 'DONE', done_by = me.id, done_by_name = me.full_name, done_at = now()
  from public.vessel_lists l
  where i.list_id = l.id and l.mode = 'NHAP_TAU' and i.container_id = p_container_id and i.status = 'INSPECTED';
end $$;

-- Xuất tàu: chọn cont + số xe → OUT khỏi bãi (executeVesselExport)
create or replace function public.execute_vessel_export(p_request_id uuid, p_list_id uuid, p_item_id uuid, p_truck_no text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me public.staff;
  v_prev jsonb := public.idem_get(p_request_id);
  l public.vessel_lists;
  i public.vessel_list_items;
  c public.containers;
  v_truck text := upper(trim(coalesce(p_truck_no, '')));
  v_prev_loc text;
begin
  if v_prev is not null then return v_prev; end if;
  me := public.assert_permission('VESSEL_EXPORT_EXECUTE', 'chỉ Bộ phận Giám định / Xe nâng / Quản lý được tác nghiệp XUẤT TÀU.');
  l := public.lock_open_vessel_list(p_list_id, 'XUAT_TAU');
  select * into i from public.vessel_list_items where id = p_item_id and list_id = l.id for update;
  if i.id is null then raise exception 'Không tìm thấy container trong danh sách.'; end if;
  if i.status <> 'PENDING' then raise exception 'Container % đã xuất tàu.', i.container_no; end if;
  if not (v_truck = any (l.truck_nos)) then raise exception 'Bắt buộc chọn SỐ XE trong danh sách xe xuất tàu.'; end if;
  c := public.lock_container_by_id(i.container_id);
  if c.id is null or c.status = 'GATED_OUT' then raise exception 'Container % không còn tồn bãi.', i.container_no; end if;
  -- DEC-131: khóa do chính danh sách Xuất tàu không chặn; khóa thường phải mở trước
  if c.is_on_hold and coalesce(c.hold_source, '') <> 'VESSEL_EXPORT' then
    raise exception 'Container % đang bị KHÓA (%) — Văn phòng phải mở khóa trước khi xuất tàu.', c.container_no, coalesce(c.hold_reason, '');
  end if;
  if c.status <> 'IN_YARD' then raise exception 'Container % không ở trạng thái tồn bãi.', c.container_no; end if;
  v_prev_loc := public.format_location(c.current_block, c.current_bay, c.current_row, c.current_tier);
  update public.work_orders set work_status = 'CANCELLED', result_notes = 'Đóng do XUẤT TÀU (' || i.dossier_code || ')'
  where container_id = c.id and work_status = 'OPEN';
  perform public.add_location_history(c, v_prev_loc, 'XUẤT TÀU ' || l.vessel_name || ' (' || v_truck || ')', 'GATE_OUT_CLEAR',
    'Xuất tàu ' || l.vessel_name || ' (' || i.dossier_code || ')');
  update public.containers set status = 'GATED_OUT', current_block = null, current_bay = null, current_row = null, current_tier = null,
    needs_cleaning = false, needs_quotation = false, needs_repair = false, forklift_task = 'NONE', out_dossier_code = i.dossier_code,
    vessel_export_item_id = null, is_on_hold = false, hold_source = null, gate_out_at = now()
  where id = c.id;
  update public.vessel_list_items set status = 'DONE', truck_no = v_truck, done_by = me.id, done_by_name = me.full_name, done_at = now() where id = i.id;
  perform public.write_audit('XUAT_TAU_OK', 'VESSEL', i.dossier_code,
    format('[Hồ sơ %s] XUẤT TÀU %s (%s) từ %s — tàu %s, xe %s', i.dossier_code, c.container_no, c.condition_class, v_prev_loc, l.vessel_name, v_truck),
    c.dossier_code);
  return public.idem_put(p_request_id, 'execute_vessel_export', jsonb_build_object('item_id', i.id));
end $$;

-- Duyệt danh sách (DEC-131: chưa đủ thì bắt buộc lý do; cont chưa tác nghiệp → SKIPPED; Xuất tàu mở khóa cont không kịp)
create or replace function public.approve_vessel_list(p_list_id uuid, p_mode public.vessel_mode, p_reason text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  me public.staff;
  l public.vessel_lists;
  v_total int;
  v_done int;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
  v_skipped text[];
  v_cid uuid;
begin
  me := public.assert_permission('VESSEL_LIST_MANAGE', format('chỉ Văn phòng / Quản lý được duyệt %s.', public.vessel_label(p_mode)));
  l := public.lock_open_vessel_list(p_list_id, p_mode);
  select count(*), count(*) filter (where status = 'DONE') into v_total, v_done from public.vessel_list_items where list_id = l.id;
  if v_total = 0 then raise exception 'Danh sách không có container nào.'; end if;
  if v_done < v_total and v_reason is null then
    raise exception 'Chưa % đủ (%/%) — bắt buộc ghi LÝ DO khi duyệt.', public.vessel_label(p_mode), v_done, v_total;
  end if;
  v_skipped := array(select container_no from public.vessel_list_items where list_id = l.id and status = 'PENDING' order by container_no);
  if p_mode = 'XUAT_TAU' then
    for v_cid in select container_id from public.vessel_list_items where list_id = l.id and status = 'PENDING' and container_id is not null loop
      perform public.vessel_unlock(v_cid);
    end loop;
  end if;
  update public.vessel_list_items set status = 'SKIPPED' where list_id = l.id and status = 'PENDING';
  update public.vessel_lists set status = 'APPROVED', approved_by = me.id, approved_by_name = me.full_name, approved_at = now(),
    approve_note = case when v_done < v_total then v_reason end
  where id = l.id;
  perform public.write_audit(case when p_mode = 'NHAP_TAU' then 'NHAP_TAU_DUYET' else 'XUAT_TAU_DUYET' end, 'VESSEL', l.vessel_name,
    case when v_done < v_total
      then format('Duyệt %s tàu %s CHƯA ĐỦ: %s/%s container%s. Lý do: %s', public.vessel_label(p_mode), l.vessel_name, v_done, v_total,
        case when array_length(v_skipped, 1) > 0 then format(', gạch %s cont không kịp (%s)', array_length(v_skipped, 1), array_to_string(v_skipped, ', ')) else '' end,
        v_reason)
      else format('Duyệt %s thành công tàu %s: %s container', public.vessel_label(p_mode), l.vessel_name, v_total)
    end);
end $$;

-- ---------------------------------------------------------------------------
-- XE NÂNG HẠ VỎ: thêm bước Nhập tàu hoàn thành (định nghĩa lại hàm của migration 2, giữ nguyên phần còn lại)
-- ---------------------------------------------------------------------------
create or replace function public.update_container_location(
  p_request_id uuid, p_block text, p_bay text default null, p_row text default null, p_tier text default null,
  p_reason text default '', p_container_no text default null, p_scanned_code text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_prev jsonb := public.idem_get(p_request_id);
  c public.containers;
  s record;
  v_racks text[];
  v_to text;
begin
  if v_prev is not null then return v_prev; end if;
  perform public.assert_permission('FORKLIFT_OPS', 'chỉ Bộ phận Xe nâng / Hiện trường / Văn phòng / Quản lý mới được hạ vỏ.');
  c := public.lock_active_container(p_container_no, p_scanned_code);
  if c.id is null then raise exception 'Không tìm thấy container tương ứng với mã QR / Mã hồ sơ / số container vừa quét.'; end if;
  if c.status <> 'WAITING_PLACEMENT' then
    raise exception 'Container % không nằm trong hàng chờ HẠ VỎ (dùng ĐẢO CHUYỂN cho container đã tồn bãi).', c.container_no;
  end if;
  if c.needs_cleaning then
    raise exception 'Container % có yêu cầu vệ sinh — Bộ phận Vệ sinh phải xác nhận hoàn tất trước khi Xe nâng hạ vỏ (CR-03).', c.container_no;
  end if;
  if c.forklift_task = 'HA_KE_GIAM_DINH' then
    v_racks := array(select code from public.yard_blocks where is_inspection_rack and is_active order by code);
    if coalesce(array_length(v_racks, 1), 0) = 0 then
      raise exception 'Chưa có KỆ GIÁM ĐỊNH trong Danh mục Vị trí — Admin cần đánh dấu block Kệ giám định.';
    end if;
    if not (p_block = any (v_racks)) then
      raise exception 'Container % phải HẠ KỆ GIÁM ĐỊNH (%), không hạ về bay.', c.container_no, array_to_string(v_racks, ' / ');
    end if;
  end if;
  select * into s from public.validate_target_slot(c.id, p_block, p_bay, p_row, p_tier);
  v_to := public.format_location(s.slot_block, s.slot_bay, s.slot_row, s.slot_tier);
  update public.containers set status = 'IN_YARD', current_block = s.slot_block, current_bay = s.slot_bay, current_row = s.slot_row, current_tier = s.slot_tier
  where id = c.id;
  perform public.add_location_history(c, 'Chờ hạ vỏ (GATE IN)', v_to, 'INITIAL_BLOCK', coalesce(nullif(trim(p_reason), ''), 'Xe nâng hạ vỏ'));
  perform public.write_audit('YARD_PLACEMENT', 'CONTAINER', c.dossier_code,
    format('[Hồ sơ %s] Xe nâng hạ vỏ %s vào %s', c.dossier_code, c.container_no, v_to), c.dossier_code);
  perform public.mark_vessel_import_placed(c.id); -- DEC-069
  return public.idem_put(p_request_id, 'update_container_location', jsonb_build_object('id', c.id, 'location', v_to));
end $$;

-- ---------------------------------------------------------------------------
-- QUYỀN GỌI
-- ---------------------------------------------------------------------------
revoke execute on function public.release_blocker(public.containers), public.payment_label(public.vouchers),
  public.create_release_order(uuid, text, text, text, text, text, uuid[]), public.complete_release_payment(uuid, uuid, text),
  public.complete_by_voucher(uuid, uuid, text),
  public.confirm_release_payment(uuid, uuid, public.payment_category, text, text, public.direct_method),
  public.release_allocated_container(text, text), public.execute_gate_out(uuid, text, text, text),
  public.vessel_label(public.vessel_mode), public.lock_open_vessel_list(uuid, public.vessel_mode), public.vessel_lock(uuid, text),
  public.vessel_unlock(uuid), public.vessel_validate_header(public.vessel_mode, text, timestamptz, text[]),
  public.vessel_add_import_items(uuid, jsonb), public.vessel_add_export_items(uuid, uuid[], text),
  public.create_vessel_list(public.vessel_mode, text, timestamptz, text[], text, jsonb, uuid[]),
  public.update_vessel_list(uuid, public.vessel_mode, text, timestamptz, text[], text),
  public.add_vessel_list_items(uuid, public.vessel_mode, jsonb, uuid[]), public.delete_vessel_list(uuid, public.vessel_mode),
  public.remove_vessel_list_item(uuid, uuid, public.vessel_mode),
  public.inspect_vessel_import_item(uuid, uuid, uuid, text, text, public.condition_class, public.stuffing_class, text[], int, text[], text),
  public.mark_vessel_import_placed(uuid), public.execute_vessel_export(uuid, uuid, uuid, text),
  public.approve_vessel_list(uuid, public.vessel_mode, text),
  public.update_container_location(uuid, text, text, text, text, text, text, text)
  from public, anon, authenticated;

grant execute on function public.create_release_order(uuid, text, text, text, text, text, uuid[]) to authenticated;
grant execute on function public.confirm_release_payment(uuid, uuid, public.payment_category, text, text, public.direct_method) to authenticated;
grant execute on function public.release_allocated_container(text, text) to authenticated;
grant execute on function public.execute_gate_out(uuid, text, text, text) to authenticated;
grant execute on function public.create_vessel_list(public.vessel_mode, text, timestamptz, text[], text, jsonb, uuid[]) to authenticated;
grant execute on function public.update_vessel_list(uuid, public.vessel_mode, text, timestamptz, text[], text) to authenticated;
grant execute on function public.add_vessel_list_items(uuid, public.vessel_mode, jsonb, uuid[]) to authenticated;
grant execute on function public.delete_vessel_list(uuid, public.vessel_mode) to authenticated;
grant execute on function public.remove_vessel_list_item(uuid, uuid, public.vessel_mode) to authenticated;
grant execute on function public.inspect_vessel_import_item(uuid, uuid, uuid, text, text, public.condition_class, public.stuffing_class, text[], int, text[], text) to authenticated;
grant execute on function public.execute_vessel_export(uuid, uuid, uuid, text) to authenticated;
grant execute on function public.approve_vessel_list(uuid, public.vessel_mode, text) to authenticated;
grant execute on function public.update_container_location(uuid, text, text, text, text, text, text, text) to authenticated;
