-- ============================================================================
-- MATRAN DEPOT — Migration 3/5 (phần 2): RPC VĂN PHÒNG HẠ VỎ + THANH TOÁN + PHIẾU THU + TRẢ TRƯỚC + HÓA ĐƠN
-- Hợp đồng nghiệp vụ (giữ đúng thông báo lỗi): src/services/depotOperations.ts (verifyGateInOfficeAndCreatePayment,
-- gateInContainerConflict, confirmGateInPaymentAndComplete, completeGateIn, processBankTransferCallback,
-- recordReceiptPrint), payments.ts (settleVoucher, applyBankCallback, cancelPendingTransaction,
-- createMasterPrepaidReceipt, confirmPrepaidCash), invoice.ts.
-- DEC-031: tạo yêu cầu / QR KHÔNG phải đã thu tiền. Chỉ thành công khi xác nhận tiền mặt / ngân hàng báo /
-- Văn phòng hoặc Quản lý xác nhận tay sau khi đối chiếu sao kê (DEC-152, DEC-154).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- HỖ TRỢ
-- ---------------------------------------------------------------------------
create or replace function public.vnd(p bigint) returns text
language sql immutable as $$ select to_char(p, 'FM999G999G999G999') || 'đ' $$;

-- Mã bảo mật hóa đơn 12 ký tự A-Z a-z 0-9 (DEC-111), sinh bằng bộ sinh ngẫu nhiên mật mã
create or replace function public.gen_invoice_secret() returns text
language plpgsql volatile security definer set search_path = public, extensions as $$
declare
  v_alphabet text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  v_out text;
  v_bytes bytea;
  v_i int;
begin
  loop
    v_out := '';
    while length(v_out) < 12 loop
      v_bytes := gen_random_bytes(32);
      for v_i in 0..31 loop
        -- 248 = 62 × 4 → bỏ giá trị lớn để không lệch phân bố
        if get_byte(v_bytes, v_i) < 248 and length(v_out) < 12 then
          v_out := v_out || substr(v_alphabet, (get_byte(v_bytes, v_i) % 62) + 1, 1);
        end if;
      end loop;
    end loop;
    exit when not exists (select 1 from public.payment_receipts where invoice_secret = v_out);
  end loop;
  return v_out;
end $$;

-- SĐT lái xe (normalizeDriverPhone)
create or replace function public.normalize_driver_phone(p text) returns text
language plpgsql immutable as $$
declare
  v text := regexp_replace(trim(coalesce(p, '')), '[\s.-]', '', 'g');
begin
  if v like '+84%' then v := '0' || substr(v, 4); end if;
  if v !~ '^[0-9]{9,11}$' then raise exception 'SĐT LÁI XE không hợp lệ (9–11 chữ số, ví dụ 0912345678).'; end if;
  return v;
end $$;

-- Khách hàng (normalizeCustomer, DEC-093): trùng tên Danh mục → tên Danh mục; ngoài Danh mục vẫn lưu
create or replace function public.normalize_customer(p text) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v text := regexp_replace(trim(coalesce(p, '')), '\s+', ' ', 'g');
  v_known text;
begin
  if v = '' then raise exception 'Vui lòng nhập hoặc chọn KHÁCH HÀNG.'; end if;
  if length(v) > 120 then raise exception 'Tên KHÁCH HÀNG tối đa 120 ký tự.'; end if;
  select name into v_known from public.partners where is_customer and is_active and lower(name) = lower(v) limit 1;
  return coalesce(v_known, v);
end $$;

create or replace function public.is_catalog_customer(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.partners where is_customer and is_active and lower(name) = lower(trim(coalesce(p, ''))));
$$;

-- Dòng chi phí từ Biểu giá (buildFeeLines): bắt buộc ≥ 1, chụp tên + đơn giá; trả tổng tiền
create or replace function public.write_fee_lines(p_owner_type text, p_owner_id uuid, p_fee_ids uuid[]) returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v_total bigint := 0;
  v_id uuid;
  v_ord int;
  f public.fee_catalog;
begin
  if coalesce(array_length(p_fee_ids, 1), 0) = 0 then
    raise exception 'Vui lòng thêm ít nhất 1 khoản CHI PHÍ (đã bao gồm VAT) từ biểu giá.';
  end if;
  delete from public.fee_lines where owner_type = p_owner_type and owner_id = p_owner_id;
  for v_id, v_ord in select x, o from unnest(p_fee_ids) with ordinality as t(x, o) loop
    select * into f from public.fee_catalog where id = v_id and is_active;
    if f.id is null then raise exception 'Biểu giá đã chọn không còn trong Danh mục chung. Vui lòng chọn lại.'; end if;
    insert into public.fee_lines (owner_type, owner_id, catalog_code, name, quantity, unit_amount, amount, sort_order)
    values (p_owner_type, p_owner_id, f.code, f.name, 1, f.amount, f.amount, v_ord);
    v_total := v_total + f.amount;
  end loop;
  return v_total;
end $$;

-- gateInContainerConflict (DEC-060): dùng cả khi gõ (giao diện) và khi xác nhận
create or replace function public.gate_in_container_conflict(p_container_no text, p_gate_in_id uuid default null) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  v_no text := upper(trim(coalesce(p_container_no, '')));
  c public.containers;
  v_dup text;
begin
  if v_no !~ '^[A-Z]{4}[0-9]{7}$' then return null; end if;
  select * into c from public.containers where container_no = v_no and status <> 'GATED_OUT';
  if c.id is not null then
    return format('Container %s đang có trong TỒN VỎ (hồ sơ %s, vị trí %s) — không thể Hạ vỏ trùng.', v_no, c.dossier_code,
      public.format_location(c.current_block, c.current_bay, c.current_row, c.current_tier));
  end if;
  select code into v_dup from public.gate_in_orders
  where container_no = v_no and status in ('FIELD_RECORDED', 'PAYMENT_PENDING') and id is distinct from p_gate_in_id limit 1;
  if v_dup is not null then
    return format('Container %s đang có hồ sơ Hạ vỏ khác chưa hoàn tất (%s) (GIN-006).', v_no, v_dup);
  end if;
  return null;
end $$;

-- ---------------------------------------------------------------------------
-- PHIẾU THU (issueReceipt): tối đa 1 phiếu / giao dịch; người thu luôn là nhân viên (DEC-113)
-- ---------------------------------------------------------------------------
create or replace function public.issue_receipt(p_tx_id uuid, p_issuer_id uuid, p_issuer_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  t public.payment_transactions;
  p public.prepaid_receipts;
  v public.vouchers;
  v_no text;
  v_id uuid;
  v_op text;
begin
  select * into t from public.payment_transactions where id = p_tx_id for update;
  if t.id is null or t.status <> 'SUCCEEDED' then raise exception 'Chỉ phát hành phiếu thu cho giao dịch đã thanh toán thành công.'; end if;
  select id into v_id from public.payment_receipts where transaction_id = t.id;
  if v_id is not null then return v_id; end if;
  if t.prepaid_id is not null then select * into p from public.prepaid_receipts where id = t.prepaid_id; end if;
  if t.voucher_id is not null then select * into v from public.vouchers where id = t.voucher_id; end if;
  -- DEC-124: phiếu nạp trả trước dùng lại mã PT-TTR- đã cấp khi tạo
  v_no := case when t.purpose = 'PREPAID_TOPUP' then p.code else public.next_code('PT-TT') end;
  v_op := case when t.purpose = 'PREPAID_TOPUP' then 'THU_TRUOC' when v.service_type = 'GATE_IN' then 'HA_VO'
               when v.service_type = 'GATE_OUT' then 'CAP_VO' else 'KHAC' end;
  insert into public.payment_receipts (receipt_no, transaction_id, purpose, operation, amount, method, payment_category,
    voucher_id, voucher_no, prepaid_id, prepaid_code, dossier_code, container_no, payer_name, provider_tx_ref,
    issued_by, issued_by_name, invoice_secret)
  values (v_no, t.id, t.purpose, v_op, t.amount, t.method, t.payment_category, v.id, v.voucher_no, p.id, p.code,
    t.dossier_code, t.container_no, t.payer_name, t.provider_tx_ref,
    coalesce(p_issuer_id, t.created_by), coalesce(p_issuer_name, t.created_by_name), public.gen_invoice_secret())
  returning id into v_id;
  return v_id;
end $$;

-- applySucceededTransaction: phát hành phiếu thu + cập nhật chứng từ / kích hoạt phiếu trả trước
create or replace function public.apply_succeeded_tx(p_tx_id uuid, p_actor_id uuid, p_actor_name text) returns void
language plpgsql security definer set search_path = public as $$
declare
  t public.payment_transactions;
begin
  select * into t from public.payment_transactions where id = p_tx_id;
  perform public.issue_receipt(t.id, p_actor_id, p_actor_name);
  if t.purpose = 'VOUCHER' then
    update public.vouchers set payment_category = 'TTTT', direct_method = t.method, provider_tx_ref = t.provider_tx_ref,
      status = 'CONFIRMED', confirmed_by = p_actor_id, confirmed_by_name = p_actor_name, confirmed_at = now()
    where id = t.voucher_id;
  else
    update public.prepaid_receipts set status = 'ACTIVE', remaining_amount = total_amount, activated_at = now()
    where id = t.prepaid_id and status = 'PENDING_PAYMENT';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- THANH TOÁN CHỨNG TỪ (settleVoucher): TTR trừ phiếu trả trước / TTS ghi công nợ / TT tiền mặt hoặc chuyển khoản
-- Trả về 'SETTLED' hoặc 'AWAITING_TRANSFER'
-- ---------------------------------------------------------------------------
create or replace function public.settle_voucher(
  p_voucher_id uuid, p_category public.payment_category, p_scanned_qr text default null,
  p_tts_note text default null, p_method public.direct_method default null
) returns text
language plpgsql security definer set search_path = public as $$
declare
  me public.staff;
  v public.vouchers;
  p public.prepaid_receipts;
  v_qr text := upper(trim(coalesce(p_scanned_qr, '')));
  v_note text := trim(coalesce(p_tts_note, ''));
  v_after bigint;
  v_tx uuid;
begin
  me := public.assert_permission('PAYMENT_CONFIRM', 'chỉ Văn phòng / Quản lý được xác nhận khoản thu.');
  select * into v from public.vouchers where id = p_voucher_id for update;
  if v.id is null then raise exception 'Không tìm thấy chứng từ thanh toán.'; end if;
  if v.status <> 'PENDING' then raise exception 'Chứng từ % đang ở trạng thái %, không thể thanh toán lại.', v.voucher_no, v.status; end if;
  if exists (select 1 from public.payment_transactions where voucher_id = v.id and status = 'PENDING') then
    raise exception 'Chứng từ % đang chờ kết quả chuyển khoản. Hủy yêu cầu chuyển khoản trước khi đổi hình thức thanh toán.', v.voucher_no;
  end if;
  if v.amount <= 0 then raise exception 'Chứng từ chưa có chi phí hợp lệ (phải chọn ít nhất 1 biểu giá).'; end if;
  -- DEC-093: khách ngoài Danh mục chỉ thanh toán trực tiếp
  if p_category in ('TTT', 'TTS') and not public.is_catalog_customer(v.payer_name) then
    raise exception 'Khách hàng "%" chưa có trong Danh mục — chỉ thanh toán TRỰC TIẾP (Tiền mặt / Chuyển khoản), không dùng %.', v.payer_name, p_category;
  end if;

  if p_category = 'TTT' then
    if v_qr = '' then raise exception 'TRẢ TRƯỚC (TTR): Vui lòng quét mã QR của Phiếu thu trả trước vào chứng từ.'; end if;
    select * into p from public.prepaid_receipts where upper(qr_code) = v_qr for update;
    if p.id is null then raise exception 'Mã QR "%" không tồn tại.', v_qr; end if;
    if p.status = 'PENDING_PAYMENT' then raise exception 'Phiếu thu trả trước % chưa được thu tiền nạp quỹ, chưa thể trừ dần.', p.code; end if;
    if p.status <> 'ACTIVE' then raise exception 'Phiếu thu trả trước % không còn hiệu lực.', p.code; end if;
    if p.remaining_amount < v.amount then
      raise exception 'Số dư Phiếu thu trả trước % (%) không đủ để trừ khoản thu (%).', p.code, public.vnd(p.remaining_amount), public.vnd(v.amount);
    end if;
    v_after := p.remaining_amount - v.amount;
    update public.prepaid_receipts set remaining_amount = v_after, status = case when v_after = 0 then 'EXHAUSTED'::public.prepaid_status else 'ACTIVE' end
    where id = p.id;
    insert into public.prepaid_deductions (prepaid_id, voucher_id, container_no, amount, balance_before, balance_after, performed_by, performed_by_name)
    values (p.id, v.id, v.container_no, v.amount, p.remaining_amount, v_after, me.id, me.full_name);
    update public.vouchers set payment_category = 'TTT', direct_method = null, scanned_qr_code = v_qr, prepaid_code = p.code,
      status = 'CONFIRMED', confirmed_by = me.id, confirmed_by_name = me.full_name, confirmed_at = now()
    where id = v.id;
    return 'SETTLED';
  end if;

  if p_category = 'TTS' then
    if v_note = '' then raise exception 'THANH TOÁN SAU (TTS): Phải ghi chú (Note) xác nhận TTS trên chứng từ.'; end if;
    update public.vouchers set payment_category = 'TTS', direct_method = null, tts_note = 'TTS - ' || v_note,
      status = 'DEFERRED', confirmed_by = me.id, confirmed_by_name = me.full_name, confirmed_at = now()
    where id = v.id;
    return 'SETTLED';
  end if;

  -- TTTT — trực tiếp
  if p_method is null then raise exception 'TRỰC TIẾP (TT): Phải chọn Chuyển khoản (API QR) hoặc Tiền mặt.'; end if;
  if p_method = 'CASH' then
    -- Người có quyền bấm xác nhận đã nhận tiền mặt là căn cứ thu tiền
    insert into public.payment_transactions (payment_ref, purpose, voucher_id, dossier_code, container_no, payer_name, method,
      payment_category, amount, status, created_by, created_by_name, confirmed_by, confirmed_by_name, confirmed_at)
    values (v.voucher_no, 'VOUCHER', v.id, v.dossier_code, v.container_no, v.payer_name, 'CASH', 'TTTT', v.amount, 'SUCCEEDED',
      me.id, me.full_name, me.id, me.full_name, now())
    returning id into v_tx;
    perform public.apply_succeeded_tx(v_tx, me.id, me.full_name);
    return 'SETTLED';
  end if;
  insert into public.payment_transactions (payment_ref, purpose, voucher_id, dossier_code, container_no, payer_name, method,
    payment_category, amount, status, qr_payload, created_by, created_by_name)
  values (v.voucher_no, 'VOUCHER', v.id, v.dossier_code, v.container_no, v.payer_name, 'BANK_TRANSFER_API', 'TTTT', v.amount, 'PENDING',
    'MATRANDEPOT|' || v.voucher_no || '|' || v.amount, me.id, me.full_name);
  update public.vouchers set payment_category = 'TTTT', direct_method = 'BANK_TRANSFER_API' where id = v.id;
  perform public.write_audit('PAYMENT_TRANSFER_REQUESTED', 'FINANCE', v.voucher_no,
    format('Tạo yêu cầu chuyển khoản QR cho chứng từ %s (%s) — chờ ngân hàng xác nhận', v.voucher_no, public.vnd(v.amount)), v.dossier_code);
  return 'AWAITING_TRANSFER';
end $$;

-- ---------------------------------------------------------------------------
-- GATE IN OK (completeGateIn): tạo lượt lưu bãi + K80 + việc Vệ sinh / Báo giá. Chỉ khi chứng từ CONFIRMED / DEFERRED
-- ---------------------------------------------------------------------------
create or replace function public.complete_gate_in(p_gate_in_id uuid, p_actor_id uuid, p_actor_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  g public.gate_in_orders;
  v public.vouchers;
  v_damage boolean;
  v_clean boolean;
  v_next text[];
  v_qr text;
  v_label text;
  v_cid uuid;
begin
  select * into g from public.gate_in_orders where id = p_gate_in_id for update;
  if g.id is null or g.container_no is null or g.size is null or g.type is null then
    raise exception 'Hồ sơ Hạ vỏ chưa đủ thông tin để hoàn tất.';
  end if;
  if g.status = 'GATE_IN_OK' then return (select id from public.containers where dossier_code = g.code); end if;
  select * into v from public.vouchers where id = g.voucher_id;
  if v.status is null or v.status not in ('CONFIRMED', 'DEFERRED') then
    raise exception 'Không thể cập nhật GATE IN OK khi chưa thanh toán / xác nhận thanh toán hợp lệ (GIN-004).';
  end if;
  if exists (select 1 from public.containers where container_no = g.container_no and status <> 'GATED_OUT') then
    raise exception 'Container % đang có lượt lưu bãi chưa OUT.', g.container_no;
  end if;
  v_damage := g.condition_class = 'DAMAGE';
  v_clean := exists (select 1 from unnest(g.cleaning_items) x where x <> 'KHÔNG VỆ SINH');
  -- DEC-024 & CR-03: có vệ sinh thì xong vệ sinh mới vào hàng chờ Xe nâng
  v_next := case when v_clean
    then array['VỆ SINH - CHỜ VỆ SINH (' || array_to_string(g.cleaning_items, ', ') || ')', 'XE NÂNG - CHỜ HẠ VỎ (sau khi vệ sinh xong)']
    else array['XE NÂNG - CHỜ HẠ VỎ'] end;
  if v_damage then v_next := array_append(v_next, 'BÁO GIÁ - CHỜ BÁO GIÁ'); end if;
  v_qr := 'QR-' || g.code; -- DEC-057
  v_label := case when v.status = 'DEFERRED' then 'TTS (' || coalesce(v.tts_note, 'Thanh toán sau') || ')'
                  when v.payment_category = 'TTT' then trim('TTT (Đã trừ Phiếu thu trả trước ' || coalesce(v.prepaid_code, '') || ')')
                  when v.direct_method = 'BANK_TRANSFER_API' then 'TTTT (Chuyển khoản API)' else 'TTTT (Tiền mặt)' end;

  insert into public.containers (dossier_code, gate_in_id, container_no, size, type, manufacture_year, shipping_line_code, customer_name,
    truck_no, driver_phone, status, condition_class, damage_remarks, stuffing_class, cleaning_items, active_qr_code, is_paid,
    needs_cleaning, needs_quotation, forklift_task)
  values (g.code, g.id, g.container_no, g.size, g.type, g.manufacture_year, coalesce(g.shipping_line_code, ''), coalesce(g.customer_name, ''),
    g.truck_no, g.driver_phone, 'WAITING_PLACEMENT', g.condition_class, g.damage_remarks, g.stuffing_class, g.cleaning_items, v_qr,
    v.status = 'CONFIRMED', v_clean, v_damage, case when g.to_inspection_rack then 'HA_KE_GIAM_DINH' else 'NONE' end::public.forklift_task)
  returning id into v_cid;
  if v_damage then
    insert into public.work_orders (code, container_id, dossier_code, container_no, category, items, assigned_to)
    values ('INSP-' || g.code, v_cid, g.code, g.container_no, 'INSPECTION',
      case when array_length(g.damage_remarks, 1) > 0 then g.damage_remarks else array['Hư hỏng ghi nhận khi Hạ vỏ'] end, 'Bộ phận Báo giá');
  end if;
  if v_clean then
    insert into public.work_orders (code, container_id, dossier_code, container_no, category, items, assigned_to)
    values ('CLN-' || g.code, v_cid, g.code, g.container_no, 'CLEANING', g.cleaning_items, 'Bộ phận Vệ sinh');
  end if;
  insert into public.k80_tickets (code, dossier_code, qr_code, operation_mode, is_paid, payment_label, container_no, size, type,
    condition_class, damage_remarks, stuffing_class, cleaning_items, manufacture_year, truck_no, driver_phone, customer_name, issued_by, issued_by_name)
  values ('K80-' || g.code, g.code, v_qr, 'HA_VO', v.status = 'CONFIRMED', v_label, g.container_no, g.size, g.type,
    g.condition_class, g.damage_remarks, g.stuffing_class, g.cleaning_items, g.manufacture_year, g.truck_no, g.driver_phone, g.customer_name,
    p_actor_id, p_actor_name);
  update public.gate_in_orders set status = 'GATE_IN_OK', gate_in_ok_at = now(), gate_in_ok_by = p_actor_id, gate_in_ok_by_name = p_actor_name,
    next_departments = v_next
  where id = g.id;
  insert into public.audit_logs (actor_id, actor_name, actor_role, action_code, entity_type, entity_code, dossier_code, summary)
  values (p_actor_id, p_actor_name, case when p_actor_id is null then 'SYSTEM' else public.staff_primary_role(p_actor_id) end,
    'GATE_IN_OK_' || coalesce(v.payment_category::text, 'PAID'), 'GATE_IN', g.code, g.code,
    format('[Hồ sơ %s] GATE IN OK cho %s (%s) -> In phiếu K80 [%s] -> %s', g.code, g.container_no, v_label, v_qr, array_to_string(v_next, ' + ')));
  return v_cid;
end $$;

-- Sau khi tiền về (ngân hàng / xác nhận tay): hoàn tất tác nghiệp của chứng từ. Cấp vỏ: migration 4 bổ sung.
create or replace function public.complete_by_voucher(p_voucher_id uuid, p_actor_id uuid, p_actor_name text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_gate_in uuid;
begin
  select id into v_gate_in from public.gate_in_orders where voucher_id = p_voucher_id;
  if v_gate_in is not null then perform public.complete_gate_in(v_gate_in, p_actor_id, p_actor_name); end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. VĂN PHÒNG — HẠ VỎ: bổ sung hồ sơ + lập chứng từ (chưa thu tiền)
-- ---------------------------------------------------------------------------
create or replace function public.verify_gate_in_office(
  p_gate_in_id uuid, p_container_no text, p_size text, p_type text, p_truck_no text, p_driver_phone text,
  p_customer_name text, p_shipping_line_code text, p_order_doc_no text, p_fee_ids uuid[]
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me public.staff;
  g public.gate_in_orders;
  v public.vouchers;
  v_no text := upper(trim(coalesce(p_container_no, '')));
  v_truck text := upper(trim(coalesce(p_truck_no, '')));
  v_phone text;
  v_customer text;
  v_conflict text;
  v_amount bigint;
begin
  me := public.assert_permission('GATE_IN_OFFICE', 'chỉ Bộ phận Văn phòng / Quản lý mới được kiểm tra chứng từ và lập chi phí.');
  select * into g from public.gate_in_orders where id = p_gate_in_id for update;
  if g.id is null then raise exception 'Không tìm thấy lượt Hạ vỏ.'; end if;
  if g.status in ('GATE_IN_OK', 'CANCELLED') then raise exception 'Lượt Hạ vỏ đang ở trạng thái %, không thể lập lại chứng từ.', g.status; end if;
  if g.voucher_id is not null then
    select * into v from public.vouchers where id = g.voucher_id for update;
    if v.status <> 'PENDING' then raise exception 'Chứng từ % đã được xử lý thanh toán, không thể sửa chi phí.', v.voucher_no; end if;
    if exists (select 1 from public.payment_transactions where voucher_id = v.id and status = 'PENDING') then
      raise exception 'Chứng từ đang chờ kết quả chuyển khoản. Hủy yêu cầu chuyển khoản trước khi sửa hồ sơ.';
    end if;
  end if;
  if v_no !~ '^[A-Z]{4}[0-9]{7}$' then raise exception 'SỐ CONTAINER không hợp lệ (chuẩn 4 chữ cái + 7 chữ số, ví dụ MSKU4089123).'; end if;
  if not exists (select 1 from public.container_sizes where code = p_size and is_active) then raise exception 'SIZE không có trong Danh mục chung.'; end if;
  if not exists (select 1 from public.container_types where code = p_type and is_active) then raise exception 'TYPE không có trong Danh mục chung.'; end if;
  if not exists (select 1 from public.partners where is_shipping_line and is_active and code = p_shipping_line_code) then
    raise exception 'Vui lòng chọn HÃNG TÀU theo Danh mục chung.';
  end if;
  v_customer := public.normalize_customer(p_customer_name);
  if v_truck = '' then raise exception 'Văn phòng bắt buộc nhập SỐ XE.'; end if;
  v_phone := public.normalize_driver_phone(p_driver_phone);
  v_conflict := public.gate_in_container_conflict(v_no, g.id);
  if v_conflict is not null then raise exception '%', v_conflict; end if;

  if v.id is null then
    insert into public.vouchers (voucher_no, service_type, dossier_code, container_no, shipping_line_code, payer_name, amount, created_by, created_by_name)
    values (g.code, 'GATE_IN', g.code, v_no, p_shipping_line_code, v_customer, 0, me.id, me.full_name)
    returning * into v;
  end if;
  v_amount := public.write_fee_lines('VOUCHER', v.id, p_fee_ids);
  update public.vouchers set container_no = v_no, shipping_line_code = p_shipping_line_code, payer_name = v_customer, amount = v_amount where id = v.id;
  update public.gate_in_orders set container_no = v_no, size = p_size, type = p_type, truck_no = v_truck, driver_phone = v_phone,
    customer_name = v_customer, shipping_line_code = p_shipping_line_code, order_doc_no = trim(coalesce(p_order_doc_no, '')),
    office_by = me.id, office_by_name = me.full_name, office_at = now(), fee_amount = v_amount, voucher_id = v.id, status = 'PAYMENT_PENDING'
  where id = g.id;
  perform public.write_audit('GATE_IN_OFFICE_VERIFY', 'GATE_IN', g.code,
    format('[Hồ sơ %s] Văn phòng bổ sung cont %s (%s%s, Xe %s, SĐT %s) & lập chứng từ %s: %s', g.code, v_no, p_size, p_type, v_truck, v_phone,
      g.code, public.vnd(v_amount)), g.code);
  return jsonb_build_object('gate_in_id', g.id, 'voucher_id', v.id, 'amount', v_amount);
end $$;

-- ---------------------------------------------------------------------------
-- 2. VĂN PHÒNG — THANH TOÁN + GATE IN OK (confirmGateInPaymentAndComplete)
-- ---------------------------------------------------------------------------
create or replace function public.confirm_gate_in_payment(
  p_request_id uuid, p_gate_in_id uuid, p_category public.payment_category, p_scanned_qr text default null,
  p_tts_note text default null, p_method public.direct_method default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me public.staff;
  v_prev jsonb := public.idem_get(p_request_id);
  g public.gate_in_orders;
  v public.vouchers;
  v_outcome text := 'SETTLED';
  v_cid uuid;
begin
  if v_prev is not null then return v_prev; end if;
  me := public.assert_permission('PAYMENT_CONFIRM', 'chỉ Văn phòng / Quản lý được xác nhận khoản thu.');
  select * into g from public.gate_in_orders where id = p_gate_in_id for update;
  if g.id is null then raise exception 'Không tìm thấy lượt Hạ vỏ.'; end if;
  if g.status = 'GATE_IN_OK' then raise exception 'Lượt Hạ vỏ này đã ở trạng thái GATE IN OK.'; end if;
  if g.status = 'CANCELLED' then raise exception 'Lượt Hạ vỏ đã bị hủy.'; end if;
  if g.container_no is null or g.voucher_id is null then
    raise exception 'Chưa hoàn tất bước Văn phòng kiểm tra chứng từ và lập chi phí (GIN-004).';
  end if;
  select * into v from public.vouchers where id = g.voucher_id;
  if v.status = 'PENDING' then
    v_outcome := public.settle_voucher(v.id, p_category, p_scanned_qr, p_tts_note, p_method);
  elsif v.status not in ('CONFIRMED', 'DEFERRED') then
    raise exception 'Chứng từ % ở trạng thái %, không thể hoàn tất Hạ vỏ.', v.voucher_no, v.status;
  end if;
  if v_outcome = 'SETTLED' then v_cid := public.complete_gate_in(g.id, me.id, me.full_name); end if;
  return public.idem_put(p_request_id, 'confirm_gate_in_payment', jsonb_build_object('outcome', v_outcome, 'container_id', v_cid));
end $$;

-- ---------------------------------------------------------------------------
-- 3. KẾT QUẢ CHUYỂN KHOẢN
-- ---------------------------------------------------------------------------
-- Dùng chung cho callback ngân hàng và Văn phòng xác nhận tay (DEC-152). Gửi lặp cùng mã ngân hàng → không ghi nhận lại.
create or replace function public.apply_transfer_result(
  p_payment_ref text, p_provider_tx_ref text, p_amount bigint, p_success boolean, p_actor_id uuid, p_actor_name text
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  t public.payment_transactions;
  v_ref text := trim(coalesce(p_provider_tx_ref, ''));
  v_done uuid;
begin
  if v_ref = '' then raise exception 'Thiếu mã giao dịch ngân hàng.'; end if;
  select id into v_done from public.payment_transactions where provider_tx_ref = v_ref;
  if v_done is not null then return jsonb_build_object('already_processed', true, 'transaction_id', v_done); end if;
  select * into t from public.payment_transactions
  where payment_ref = p_payment_ref and method = 'BANK_TRANSFER_API' and status = 'PENDING' for update;
  if t.id is null then raise exception 'Không có yêu cầu chuyển khoản đang chờ cho mã %.', p_payment_ref; end if;
  if p_amount <> t.amount then
    raise exception 'Số tiền ngân hàng báo (%) không khớp yêu cầu (%).', public.vnd(p_amount), public.vnd(t.amount);
  end if;
  update public.payment_transactions set status = case when p_success then 'SUCCEEDED'::public.tx_status else 'FAILED' end,
    provider_tx_ref = v_ref, confirmed_by = p_actor_id, confirmed_by_name = p_actor_name, confirmed_at = now()
  where id = t.id;
  if p_success then
    -- DEC-113: người thu trên phiếu = nhân viên đã lập yêu cầu khi ngân hàng tự báo
    perform public.apply_succeeded_tx(t.id, coalesce(p_actor_id, t.created_by), coalesce(case when p_actor_id is null then t.created_by_name end, p_actor_name));
    if t.purpose = 'VOUCHER' then perform public.complete_by_voucher(t.voucher_id, p_actor_id, p_actor_name); end if;
  end if;
  insert into public.audit_logs (actor_id, actor_name, actor_role, action_code, entity_type, entity_code, dossier_code, summary)
  values (p_actor_id, p_actor_name, case when p_actor_id is null then 'SYSTEM' else public.staff_primary_role(p_actor_id) end,
    case when p_success then 'PAYMENT_TRANSFER_SUCCEEDED' else 'PAYMENT_TRANSFER_FAILED' end, 'FINANCE', t.payment_ref, t.dossier_code,
    format('%s báo %s giao dịch %s cho %s (%s)', p_actor_name, case when p_success then 'THÀNH CÔNG' else 'THẤT BẠI' end, v_ref, t.payment_ref, public.vnd(t.amount)));
  return jsonb_build_object('already_processed', false, 'transaction_id', t.id, 'success', p_success);
end $$;

-- Ngân hàng gọi qua Edge Function (đã xác minh chữ ký) bằng service_role
create or replace function public.bank_transfer_callback(p_payment_ref text, p_provider_tx_ref text, p_amount bigint, p_success boolean) returns jsonb
language sql security definer set search_path = public as $$
  select public.apply_transfer_result(p_payment_ref, p_provider_tx_ref, p_amount, p_success, null, 'HỆ THỐNG (Ngân hàng)');
$$;

-- DEC-152 / DEC-154: chưa nối ngân hàng → Văn phòng / Quản lý đối chiếu sao kê rồi xác nhận tay (mã giao dịch ngân hàng tùy chọn).
-- Phiếu thu trả trước: chỉ Văn phòng (PREPAID_CASH_CONFIRM) như xác nhận tiền mặt.
create or replace function public.confirm_transfer_manually(p_transaction_id uuid, p_bank_ref text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me public.staff;
  t public.payment_transactions;
begin
  select * into t from public.payment_transactions where id = p_transaction_id;
  if t.id is null then raise exception 'Không tìm thấy giao dịch.'; end if;
  if t.purpose = 'PREPAID_TOPUP' then
    me := public.assert_permission('PREPAID_CASH_CONFIRM', 'chỉ Văn phòng được xác nhận tiền nạp phiếu thu trả trước.');
  else
    me := public.assert_permission('PAYMENT_CONFIRM', 'chỉ Văn phòng / Quản lý được xác nhận khoản thu.');
  end if;
  if t.method <> 'BANK_TRANSFER_API' then raise exception 'Giao dịch này không phải chuyển khoản.'; end if;
  if t.status <> 'PENDING' then raise exception 'Giao dịch không còn ở trạng thái chờ thanh toán.'; end if;
  -- DEC-154: mã giao dịch ngân hàng KHÔNG bắt buộc; bỏ trống → ghi mã nội bộ theo giao dịch.
  -- Có nhập thì 1 mã ngân hàng chỉ dùng xác nhận được 1 lần (provider_tx_ref unique).
  return public.apply_transfer_result(t.payment_ref,
    'TAY-' || coalesce(nullif(trim(coalesce(p_bank_ref, '')), ''), t.id::text), t.amount, true, me.id, me.full_name);
end $$;

-- Hủy yêu cầu thu tiền đang chờ (cancelPendingTransaction)
create or replace function public.cancel_pending_transaction(p_transaction_id uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  t public.payment_transactions;
begin
  select * into t from public.payment_transactions where id = p_transaction_id for update;
  if t.id is null then raise exception 'Không tìm thấy giao dịch.'; end if;
  if t.purpose = 'PREPAID_TOPUP' then
    perform public.assert_permission('PREPAID_CASH_CONFIRM', 'không được hủy yêu cầu thanh toán này.');
  else
    perform public.assert_permission('PAYMENT_CONFIRM', 'không được hủy yêu cầu thanh toán này.');
  end if;
  if t.status <> 'PENDING' then raise exception 'Chỉ hủy được giao dịch đang chờ thanh toán.'; end if;
  if trim(coalesce(p_reason, '')) = '' then raise exception 'Bắt buộc nhập lý do hủy yêu cầu thanh toán.'; end if;
  update public.payment_transactions set status = 'CANCELLED', cancel_reason = trim(p_reason) where id = t.id;
  if t.purpose = 'VOUCHER' then
    update public.vouchers set payment_category = null, direct_method = null where id = t.voucher_id;
  else
    update public.prepaid_receipts set status = 'CANCELLED' where id = t.prepaid_id;
  end if;
  perform public.write_audit('PAYMENT_REQUEST_CANCELLED', 'FINANCE', t.payment_ref,
    format('Hủy yêu cầu thanh toán %s (%s). Lý do: %s', t.payment_ref, public.vnd(t.amount), trim(p_reason)), t.dossier_code);
end $$;

-- ---------------------------------------------------------------------------
-- 4. PHIẾU THU TRẢ TRƯỚC (createMasterPrepaidReceipt, confirmPrepaidCash) — DEC-077, DEC-124
-- p_fee_items: [{"catalog_id": "...", "quantity": 2}, ...] — có thì tổng = đơn giá × số lượng; không có thì dùng p_total_amount
-- ---------------------------------------------------------------------------
create or replace function public.create_prepaid_receipt(
  p_customer_code text, p_lot_description text, p_method public.direct_method,
  p_total_amount bigint default null, p_fee_items jsonb default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me public.staff;
  pa public.partners;
  v_code text;
  v_id uuid;
  v_amount bigint := 0;
  it jsonb;
  f public.fee_catalog;
  v_qty int;
  v_ord int := 0;
begin
  me := public.assert_permission('PREPAID_RECEIPT_CREATE', 'chỉ Văn phòng được tạo phiếu thu TTR (Trả trước).');
  select * into pa from public.partners where code = upper(trim(coalesce(p_customer_code, ''))) and is_active;
  if pa.id is null then raise exception 'Vui lòng chọn khách hàng / đối tác thanh toán từ Danh mục chung.'; end if;
  if p_method is null then raise exception 'Chọn hình thức thanh toán: Chuyển khoản (API QR) hoặc Tiền mặt.'; end if;
  v_code := public.next_code('PT-TTR');
  -- tạm tổng 1 để qua ràng buộc > 0, cập nhật đúng sau khi tính
  insert into public.prepaid_receipts (code, qr_code, customer_code, customer_name, lot_description, total_amount, payment_method, created_by, created_by_name)
  values (v_code, 'QR-' || v_code, pa.code, pa.name, coalesce(nullif(trim(p_lot_description), ''), 'Thanh toán trước 1 lô container'),
    1, p_method, me.id, me.full_name)
  returning id into v_id;
  if p_fee_items is not null and jsonb_array_length(p_fee_items) > 0 then
    for it in select * from jsonb_array_elements(p_fee_items) loop
      v_ord := v_ord + 1;
      select * into f from public.fee_catalog where id = (it->>'catalog_id')::uuid and is_active;
      if f.id is null then raise exception 'Biểu giá đã chọn không còn trong Danh mục chung. Vui lòng chọn lại.'; end if;
      v_qty := (it->>'quantity')::int;
      if v_qty is null or v_qty < 1 or v_qty > 9999 then raise exception 'Số lượng của "%" phải là số nguyên từ 1 đến 9999.', f.name; end if;
      insert into public.fee_lines (owner_type, owner_id, catalog_code, name, quantity, unit_amount, amount, sort_order)
      values ('PREPAID', v_id, f.code, f.name, v_qty, f.amount, f.amount * v_qty, v_ord);
      v_amount := v_amount + f.amount * v_qty;
    end loop;
  else
    v_amount := coalesce(p_total_amount, 0);
  end if;
  if v_amount <= 0 then raise exception 'Số tiền nạp trước phải lớn hơn 0.'; end if;
  update public.prepaid_receipts set total_amount = v_amount where id = v_id;
  insert into public.payment_transactions (payment_ref, purpose, prepaid_id, payer_name, method, payment_category, amount, status, qr_payload, created_by, created_by_name)
  values (v_code, 'PREPAID_TOPUP', v_id, pa.name, p_method, 'TTT', v_amount, 'PENDING',
    case when p_method = 'BANK_TRANSFER_API' then 'MATRANDEPOT|' || v_code || '|' || v_amount end, me.id, me.full_name);
  perform public.write_audit('CREATE_MASTER_RECEIPT_TTT', 'FINANCE', v_code,
    format('Tạo phiếu thu TTR %s cho %s: %s (%s) — Chờ thanh toán', v_code, pa.name, public.vnd(v_amount),
      case when p_method = 'CASH' then 'Tiền mặt' else 'Chuyển khoản QR' end));
  return jsonb_build_object('id', v_id, 'code', v_code, 'amount', v_amount);
end $$;

create or replace function public.confirm_prepaid_cash(p_transaction_id uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me public.staff;
  t public.payment_transactions;
begin
  me := public.assert_permission('PREPAID_CASH_CONFIRM', 'chỉ Văn phòng được xác nhận đã thu tiền mặt.');
  select * into t from public.payment_transactions where id = p_transaction_id for update;
  if t.id is null or t.purpose <> 'PREPAID_TOPUP' then raise exception 'Không tìm thấy phiếu thu TTR cần xác nhận.'; end if;
  if t.method <> 'CASH' then raise exception 'Phiếu chuyển khoản chỉ được xác nhận bằng kết quả từ ngân hàng.'; end if;
  if t.status <> 'PENDING' then raise exception 'Giao dịch không còn ở trạng thái chờ thanh toán.'; end if;
  update public.payment_transactions set status = 'SUCCEEDED', confirmed_by = me.id, confirmed_by_name = me.full_name, confirmed_at = now() where id = t.id;
  perform public.apply_succeeded_tx(t.id, me.id, me.full_name);
  perform public.write_audit('PREPAID_CASH_CONFIRMED', 'FINANCE', t.payment_ref,
    format('Văn phòng xác nhận đã thu tiền mặt %s cho %s', public.vnd(t.amount), t.payment_ref));
  return jsonb_build_object('transaction_id', t.id);
end $$;

-- ---------------------------------------------------------------------------
-- 5. IN PHIẾU THU (recordReceiptPrint, DEC-063) — mỗi lần in ghi người + giờ
-- ---------------------------------------------------------------------------
create or replace function public.record_receipt_print(p_receipt_no text) returns int
language plpgsql security definer set search_path = public as $$
declare
  me public.staff := public.current_staff();
  r public.payment_receipts;
  v_count int;
begin
  if not public.has_any_role(array['OFFICE', 'MANAGER']::public.app_role[]) then
    raise exception 'Không đủ quyền: chỉ Văn phòng / Quản lý được in phiếu thu.' using errcode = '42501';
  end if;
  select * into r from public.payment_receipts where receipt_no = p_receipt_no;
  if r.id is null then raise exception 'Không tìm thấy phiếu thu %.', p_receipt_no; end if;
  insert into public.receipt_prints (receipt_id, printed_by, printed_by_name) values (r.id, me.id, me.full_name);
  select count(*) into v_count from public.receipt_prints where receipt_id = r.id;
  perform public.write_audit(case when v_count = 1 then 'RECEIPT_PRINT' else 'RECEIPT_REPRINT' end, 'FINANCE', r.receipt_no,
    format('In phiếu thu %s lần %s%s', r.receipt_no, v_count, case when v_count > 1 then ' (IN LẠI)' else '' end), r.dossier_code);
  return v_count;
end $$;

-- ---------------------------------------------------------------------------
-- 6. HÓA ĐƠN (invoice.ts) — trang khách #/hoa-don (anon, chỉ cần đúng mã bảo mật) + Kế toán
-- ---------------------------------------------------------------------------
create or replace function public.find_receipt_by_secret(p_secret text) returns public.payment_receipts
language plpgsql stable security definer set search_path = public as $$
declare
  r public.payment_receipts;
begin
  if trim(coalesce(p_secret, '')) ~ '^[A-Za-z0-9]{12}$' then
    select * into r from public.payment_receipts where invoice_secret = trim(p_secret); -- phân biệt hoa / thường
  end if;
  if r.id is null then
    raise exception 'Mã bảo mật không đúng. Vui lòng kiểm tra lại mã in trên phiếu thu (phân biệt chữ hoa / thường).';
  end if;
  return r;
end $$;

-- Trạng thái hóa đơn (receiptInvoiceStatus): phiếu trả trước tính theo các lượt
create or replace function public.receipt_invoice_status(p_receipt_id uuid) returns public.invoice_status
language plpgsql stable security definer set search_path = public as $$
declare
  r public.payment_receipts;
  v_lots int;
  v_done int;
begin
  select * into r from public.payment_receipts where id = p_receipt_id;
  if r.purpose <> 'PREPAID_TOPUP' or r.prepaid_id is null then return r.invoice_status; end if;
  if exists (select 1 from public.invoice_groups where receipt_id = r.id and status = 'YEU_CAU_XHD') then return 'YEU_CAU_XHD'; end if;
  select count(*) into v_lots from public.prepaid_deductions where prepaid_id = r.prepaid_id;
  select count(*) into v_done from public.prepaid_deductions d join public.invoice_group_items i on i.deduction_id = d.id
    join public.invoice_groups g on g.id = i.group_id and g.status = 'DA_XHD' where d.prepaid_id = r.prepaid_id;
  return case when v_lots > 0 and v_done = v_lots then 'DA_XHD'::public.invoice_status else 'CHUA_XHD' end;
end $$;

create or replace function public.check_invoice_info(p_tax_code text, p_email text, p_company text, p_address text) returns void
language plpgsql immutable as $$
begin
  if regexp_replace(coalesce(p_tax_code, ''), '\s+', '', 'g') !~ '^[0-9]{10}(-[0-9]{3})?$' then
    raise exception 'MÃ SỐ THUẾ phải gồm 10 chữ số, hoặc 10 chữ số + "-" + 3 chữ số (chi nhánh).';
  end if;
  if lower(trim(coalesce(p_email, ''))) !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$' then raise exception 'GMAIL NHẬN HÓA ĐƠN không hợp lệ.'; end if;
  if trim(coalesce(p_company, '')) = '' then raise exception 'Vui lòng nhập TÊN CÔNG TY.'; end if;
  if trim(coalesce(p_address, '')) = '' then raise exception 'Vui lòng nhập ĐỊA CHỈ.'; end if;
end $$;

create or replace function public.customer_audit(p_action text, p_receipt public.payment_receipts, p_summary text) returns void
language sql security definer set search_path = public as $$
  insert into public.audit_logs (actor_name, actor_role, action_code, entity_type, entity_code, dossier_code, summary)
  values ('Khách hàng (trang hóa đơn)', 'SYSTEM', p_action, 'PAYMENT', p_receipt.receipt_no, p_receipt.dossier_code, p_summary);
$$;

-- Khách xem phiếu (chỉ thông tin cần cho hóa đơn)
create or replace function public.invoice_portal_lookup(p_secret text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  r public.payment_receipts := public.find_receipt_by_secret(p_secret);
begin
  return jsonb_build_object(
    'receipt_no', r.receipt_no, 'issued_at', r.issued_at, 'amount', r.amount, 'payer_name', r.payer_name, 'container_no', r.container_no,
    'status', public.receipt_invoice_status(r.id), 'invoice_no', r.invoice_no,
    'request', case when r.invoice_tax_code is null then null else jsonb_build_object('tax_code', r.invoice_tax_code, 'email', r.invoice_email,
      'company_name', r.invoice_company, 'address', r.invoice_address, 'note', r.invoice_note) end,
    'prepaid', case when r.purpose = 'PREPAID_TOPUP' and r.prepaid_id is not null then (
      select jsonb_build_object(
        'remaining_amount', (select remaining_amount from public.prepaid_receipts where id = r.prepaid_id),
        -- Các yêu cầu hóa đơn khách đã gửi (để sửa / hủy — DEC-130)
        'groups', coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'amount', g.amount, 'tax_code', g.tax_code, 'email', g.email,
            'company_name', g.company_name, 'address', g.address, 'note', g.note, 'status', g.status, 'invoice_no', g.invoice_no,
            'requested_at', g.requested_at, 'updated_at', g.updated_at,
            'deduction_ids', (select coalesce(jsonb_agg(i.deduction_id), '[]'::jsonb) from public.invoice_group_items i where i.group_id = g.id))
          order by g.requested_at) from public.invoice_groups g where g.receipt_id = r.id), '[]'::jsonb),
        'lots', coalesce(jsonb_agg(jsonb_build_object('deduction_id', d.id, 'dossier_code', v.dossier_code, 'container_no', d.container_no,
          'amount', d.amount, 'performed_at', d.performed_at, 'group_id', i.group_id, 'status', coalesce(g.status, 'CHUA_XHD'), 'invoice_no', g.invoice_no)
          order by d.performed_at desc), '[]'::jsonb))
      from public.prepaid_deductions d join public.vouchers v on v.id = d.voucher_id
      left join public.invoice_group_items i on i.deduction_id = d.id left join public.invoice_groups g on g.id = i.group_id
      where d.prepaid_id = r.prepaid_id) end);
end $$;

-- Phiếu thường: gửi / sửa yêu cầu
create or replace function public.invoice_submit_request(
  p_secret text, p_tax_code text, p_email text, p_company text, p_address text, p_note text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  r public.payment_receipts := public.find_receipt_by_secret(p_secret);
  v_update boolean;
begin
  if r.purpose = 'PREPAID_TOPUP' and r.prepaid_id is not null then
    raise exception 'Phiếu thu trả trước: chọn các LƯỢT đã dùng để yêu cầu hóa đơn (không xuất hóa đơn cho cả phiếu).';
  end if;
  if r.invoice_status = 'DA_XHD' then
    raise exception 'Phiếu thu % đã xuất hóa đơn — không sửa được yêu cầu. Liên hệ Văn phòng nếu cần.', r.receipt_no;
  end if;
  perform public.check_invoice_info(p_tax_code, p_email, p_company, p_address);
  v_update := r.invoice_status = 'YEU_CAU_XHD';
  update public.payment_receipts set invoice_status = 'YEU_CAU_XHD', invoice_tax_code = regexp_replace(p_tax_code, '\s+', '', 'g'),
    invoice_email = lower(trim(p_email)), invoice_company = trim(p_company), invoice_address = trim(p_address), invoice_note = nullif(trim(coalesce(p_note, '')), ''),
    invoice_requested_at = coalesce(invoice_requested_at, now()), invoice_updated_at = now()
  where id = r.id;
  perform public.customer_audit(case when v_update then 'INVOICE_REQUEST_UPDATE' else 'INVOICE_REQUEST' end, r,
    format('[Phiếu thu %s] Khách hàng %s yêu cầu xuất hóa đơn: MST %s, %s, %s', r.receipt_no, case when v_update then 'sửa' else 'gửi' end,
      regexp_replace(p_tax_code, '\s+', '', 'g'), trim(p_company), lower(trim(p_email))));
end $$;

-- Phiếu trả trước: gửi mới (p_group_id null) / sửa 1 yêu cầu cho các lượt chọn (DEC-130)
create or replace function public.invoice_submit_group(
  p_secret text, p_deduction_ids uuid[], p_tax_code text, p_email text, p_company text, p_address text,
  p_note text default null, p_group_id uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  r public.payment_receipts := public.find_receipt_by_secret(p_secret);
  g public.invoice_groups;
  v_ids uuid[] := array(select distinct x from unnest(coalesce(p_deduction_ids, '{}')) x);
  v_id uuid;
  v_bad text;
  v_amount bigint;
begin
  if r.purpose <> 'PREPAID_TOPUP' or r.prepaid_id is null then raise exception 'Phiếu thu này không phải phiếu thu trả trước.'; end if;
  if coalesce(array_length(v_ids, 1), 0) = 0 then raise exception 'Vui lòng chọn ít nhất 1 LƯỢT để yêu cầu hóa đơn.'; end if;
  if p_group_id is not null then
    select * into g from public.invoice_groups where id = p_group_id and receipt_id = r.id for update;
    if g.id is null then raise exception 'Không tìm thấy yêu cầu hóa đơn cần sửa.'; end if;
    if g.status = 'DA_XHD' then raise exception 'Yêu cầu này đã xuất hóa đơn — không sửa được. Liên hệ Kế toán nếu cần.'; end if;
  end if;
  foreach v_id in array v_ids loop
    if not exists (select 1 from public.prepaid_deductions where id = v_id and prepaid_id = r.prepaid_id) then
      raise exception 'Có lượt không thuộc phiếu thu này (hoặc chưa phát sinh).';
    end if;
    select v.dossier_code into v_bad from public.invoice_group_items i join public.prepaid_deductions d on d.id = i.deduction_id
      join public.vouchers v on v.id = d.voucher_id
    where i.deduction_id = v_id and i.group_id is distinct from g.id;
    if v_bad is not null then raise exception 'Lượt % đã nằm trong một yêu cầu hóa đơn khác.', v_bad; end if;
  end loop;
  perform public.check_invoice_info(p_tax_code, p_email, p_company, p_address);
  select sum(amount) into v_amount from public.prepaid_deductions where id = any (v_ids);
  if g.id is null then
    insert into public.invoice_groups (receipt_id, tax_code, email, company_name, address, note, amount)
    values (r.id, regexp_replace(p_tax_code, '\s+', '', 'g'), lower(trim(p_email)), trim(p_company), trim(p_address), nullif(trim(coalesce(p_note, '')), ''), v_amount)
    returning * into g;
  else
    update public.invoice_groups set tax_code = regexp_replace(p_tax_code, '\s+', '', 'g'), email = lower(trim(p_email)), company_name = trim(p_company),
      address = trim(p_address), note = nullif(trim(coalesce(p_note, '')), ''), amount = v_amount, updated_at = now()
    where id = g.id;
    delete from public.invoice_group_items where group_id = g.id;
  end if;
  insert into public.invoice_group_items (group_id, deduction_id) select g.id, unnest(v_ids);
  update public.payment_receipts set invoice_status = public.receipt_invoice_status(r.id) where id = r.id;
  perform public.customer_audit(case when p_group_id is null then 'INVOICE_REQUEST' else 'INVOICE_REQUEST_UPDATE' end, r,
    format('[Phiếu thu %s] Khách hàng %s yêu cầu hóa đơn cho %s lượt: MST %s, %s', r.receipt_no, case when p_group_id is null then 'gửi' else 'sửa' end,
      array_length(v_ids, 1), regexp_replace(p_tax_code, '\s+', '', 'g'), trim(p_company)));
  return g.id;
end $$;

create or replace function public.invoice_cancel_group(p_secret text, p_group_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare
  r public.payment_receipts := public.find_receipt_by_secret(p_secret);
  g public.invoice_groups;
  v_n int;
begin
  select * into g from public.invoice_groups where id = p_group_id and receipt_id = r.id for update;
  if g.id is null then raise exception 'Không tìm thấy yêu cầu hóa đơn.'; end if;
  if g.status = 'DA_XHD' then raise exception 'Yêu cầu này đã xuất hóa đơn — không hủy được. Liên hệ Kế toán nếu cần.'; end if;
  select count(*) into v_n from public.invoice_group_items where group_id = g.id;
  delete from public.invoice_groups where id = g.id;
  update public.payment_receipts set invoice_status = public.receipt_invoice_status(r.id) where id = r.id;
  perform public.customer_audit('INVOICE_REQUEST_CANCEL', r, format('[Phiếu thu %s] Khách hàng hủy yêu cầu hóa đơn %s lượt', r.receipt_no, v_n));
end $$;

-- Kế toán cập nhật ĐÃ XHD (markInvoiceIssued): phiếu trả trước theo từng yêu cầu (p_group_id)
create or replace function public.mark_invoice_issued(p_receipt_no text, p_invoice_no text default null, p_group_id uuid default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  me public.staff;
  r public.payment_receipts;
  g public.invoice_groups;
  v_no text := nullif(trim(coalesce(p_invoice_no, '')), '');
  v_n int;
begin
  me := public.assert_permission('INVOICE_ISSUE', 'chỉ Kế toán được cập nhật trạng thái hóa đơn.');
  select * into r from public.payment_receipts where receipt_no = p_receipt_no for update;
  if r.id is null then raise exception 'Không tìm thấy phiếu thu.'; end if;
  if r.purpose = 'PREPAID_TOPUP' and r.prepaid_id is not null then
    select * into g from public.invoice_groups where id = p_group_id and receipt_id = r.id for update;
    if g.id is null then raise exception 'Phiếu thu trả trước: chọn YÊU CẦU hóa đơn (nhóm lượt) cần cập nhật.'; end if;
    if g.status = 'DA_XHD' then raise exception 'Yêu cầu này đã ở trạng thái ĐÃ XHD.'; end if;
    update public.invoice_groups set status = 'DA_XHD', invoice_no = v_no, issued_at = now(), issued_by_name = me.full_name where id = g.id;
    update public.payment_receipts set invoice_status = public.receipt_invoice_status(r.id) where id = r.id;
    select count(*) into v_n from public.invoice_group_items where group_id = g.id;
    perform public.write_audit('INVOICE_ISSUED', 'PAYMENT', r.receipt_no,
      format('[Phiếu thu %s] Kế toán cập nhật ĐÃ XHD cho %s lượt%s', r.receipt_no, v_n, coalesce(' — số hóa đơn ' || v_no, '')), r.dossier_code);
    return;
  end if;
  if r.invoice_status = 'DA_XHD' then raise exception 'Phiếu thu % đã ở trạng thái ĐÃ XHD.', r.receipt_no; end if;
  if r.invoice_status <> 'YEU_CAU_XHD' or r.invoice_tax_code is null then
    raise exception 'Phiếu thu % chưa có yêu cầu xuất hóa đơn của khách hàng.', r.receipt_no;
  end if;
  update public.payment_receipts set invoice_status = 'DA_XHD', invoice_no = v_no, invoice_issued_at = now(), invoice_issued_by_name = me.full_name where id = r.id;
  perform public.write_audit('INVOICE_ISSUED', 'PAYMENT', r.receipt_no,
    format('[Phiếu thu %s] Kế toán cập nhật ĐÃ XHD%s', r.receipt_no, coalesce(' — số hóa đơn ' || v_no, '')), r.dossier_code);
end $$;

-- ---------------------------------------------------------------------------
-- QUYỀN GỌI (bổ sung — các hàm bước 1, 2 đã grant ở file trước)
-- ---------------------------------------------------------------------------
revoke execute on function public.vnd(bigint), public.gen_invoice_secret(), public.normalize_driver_phone(text), public.normalize_customer(text),
  public.is_catalog_customer(text), public.write_fee_lines(text, uuid, uuid[]), public.issue_receipt(uuid, uuid, text),
  public.apply_succeeded_tx(uuid, uuid, text), public.settle_voucher(uuid, public.payment_category, text, text, public.direct_method),
  public.complete_gate_in(uuid, uuid, text), public.complete_by_voucher(uuid, uuid, text),
  public.apply_transfer_result(text, text, bigint, boolean, uuid, text), public.bank_transfer_callback(text, text, bigint, boolean),
  public.find_receipt_by_secret(text), public.receipt_invoice_status(uuid), public.check_invoice_info(text, text, text, text),
  public.customer_audit(text, public.payment_receipts, text),
  public.verify_gate_in_office(uuid, text, text, text, text, text, text, text, text, uuid[]),
  public.confirm_gate_in_payment(uuid, uuid, public.payment_category, text, text, public.direct_method),
  public.gate_in_container_conflict(text, uuid), public.confirm_transfer_manually(uuid, text), public.cancel_pending_transaction(uuid, text),
  public.create_prepaid_receipt(text, text, public.direct_method, bigint, jsonb), public.confirm_prepaid_cash(uuid),
  public.record_receipt_print(text), public.invoice_portal_lookup(text),
  public.invoice_submit_request(text, text, text, text, text, text),
  public.invoice_submit_group(text, uuid[], text, text, text, text, text, uuid), public.invoice_cancel_group(text, uuid),
  public.mark_invoice_issued(text, text, uuid)
  from public, anon, authenticated;

-- Nhân viên
grant execute on function public.gate_in_container_conflict(text, uuid) to authenticated;
grant execute on function public.verify_gate_in_office(uuid, text, text, text, text, text, text, text, text, uuid[]) to authenticated;
grant execute on function public.confirm_gate_in_payment(uuid, uuid, public.payment_category, text, text, public.direct_method) to authenticated;
grant execute on function public.confirm_transfer_manually(uuid, text) to authenticated;
grant execute on function public.cancel_pending_transaction(uuid, text) to authenticated;
grant execute on function public.create_prepaid_receipt(text, text, public.direct_method, bigint, jsonb) to authenticated;
grant execute on function public.confirm_prepaid_cash(uuid) to authenticated;
grant execute on function public.record_receipt_print(text) to authenticated;
grant execute on function public.mark_invoice_issued(text, text, uuid) to authenticated;
grant execute on function public.receipt_invoice_status(uuid) to authenticated;
-- Trang khách (không đăng nhập) — chỉ với đúng mã bảo mật
grant execute on function public.invoice_portal_lookup(text) to anon, authenticated;
grant execute on function public.invoice_submit_request(text, text, text, text, text, text) to anon, authenticated;
grant execute on function public.invoice_submit_group(text, uuid[], text, text, text, text, text, uuid) to anon, authenticated;
grant execute on function public.invoice_cancel_group(text, uuid) to anon, authenticated;
-- Ngân hàng (Edge Function, service_role)
grant execute on function public.bank_transfer_callback(text, text, bigint, boolean) to service_role;
