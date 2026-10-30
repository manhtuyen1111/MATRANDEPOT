-- ============================================================================
-- DEC-192 — ĐỔI CONTAINER cả khi CHƯA NÂNG HẠ (lái xe ra kiểm tra, yêu cầu đổi trước khi Xe nâng cấp).
-- Định nghĩa lại swap_gate_out_container (migration 20261111000001):
--   * Lệnh PENDING_FORKLIFT (đã thu tiền, Xe nâng chưa cấp): cont cũ giữ nguyên vị trí, bỏ khóa phân bổ (IN_YARD);
--     hư hỏng → DAMAGE + PHÁT SINH CẤP VỎ + Chờ báo giá ngay (người dùng chọn — không tạo việc Xe nâng). Lệnh vẫn chờ Xe nâng, sang cont mới.
--   * Lệnh GATE_OUT_OK (đã nâng lên xe): giữ như cũ — cont cũ về Chờ hạ vỏ (hạ lại).
-- Hợp đồng nghiệp vụ: depotOperations.ts — canSwapGateOut / swapGateOutContainer.
-- ============================================================================
create or replace function public.swap_gate_out_container(
  p_request_id uuid, p_gate_out_id uuid, p_reason text, p_new_container_no text, p_note text default null
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me public.staff;
  v_prev jsonb := public.idem_get(p_request_id);
  v_label text;
  v_note text := nullif(trim(coalesce(p_note, '')), '');
  v_blocker text;
  o public.gate_out_orders;
  old public.containers;
  fresh public.containers;
  b public.release_bookings;
  v_lifted boolean;
begin
  if v_prev is not null then return v_prev; end if;
  me := public.assert_permission('RELEASE_ORDER', 'chỉ Văn phòng / Quản lý được đổi container.');
  v_label := case p_reason
    when 'KEN_VO' then 'Khách kén vỏ, yêu cầu đổi cont khác'
    when 'DAMAGE' then 'Container phát sinh hư hỏng, không đủ điều kiện cấp khách'
  end;
  if v_label is null then raise exception 'Vui lòng chọn lý do ĐỔI CONTAINER.'; end if;
  select * into o from public.gate_out_orders where id = p_gate_out_id for update;
  if o.id is null then raise exception 'Không tìm thấy hồ sơ CẤP VỎ.'; end if;
  if o.status not in ('GATE_OUT_OK', 'PENDING_FORKLIFT') or o.documents_returned_at is not null then
    raise exception 'Hồ sơ %: chỉ ĐỔI CONTAINER khi lệnh đã thu tiền và đang chờ trả chứng từ.', o.code;
  end if;
  v_lifted := o.status = 'GATE_OUT_OK'; -- DEC-192: chưa nâng hạ → cont cũ vẫn trong bãi (ALLOCATED)
  select * into old from public.containers where id = o.container_id
    and status = case when v_lifted then 'GATED_OUT' else 'ALLOCATED' end::public.container_status for update;
  if old.id is null then raise exception 'Không tìm thấy lượt lưu bãi của container %.', o.container_no; end if;
  if v_lifted and exists (select 1 from public.containers where container_no = old.container_no and status <> 'GATED_OUT') then
    raise exception 'Container % đang có lượt lưu bãi khác — không đổi được.', old.container_no;
  end if;
  fresh := public.lock_active_container(p_new_container_no);
  if fresh.id is null then raise exception 'Không tìm thấy container thay thế đang tồn bãi.'; end if;
  v_blocker := public.release_blocker(fresh);
  if v_blocker is not null then raise exception 'Container % chưa đủ điều kiện CẤP VỎ: %.', fresh.container_no, v_blocker; end if;
  select * into b from public.release_bookings where id = o.booking_id for update;
  if b.id is null then raise exception 'Không tìm thấy booking %.', o.booking_no; end if;
  if fresh.size <> b.size or fresh.type <> b.type or fresh.shipping_line_code <> old.shipping_line_code then
    raise exception 'Container thay thế phải cùng hãng tàu / size / type với booking % (% %).', o.booking_no, old.shipping_line_code, b.size || b.type;
  end if;

  -- Lệnh CV- chuyển sang cont thay thế, quay về chờ Xe nâng cấp; ghi lại lần đổi
  update public.gate_out_orders set
    container_id = fresh.id, dossier_code = fresh.dossier_code, container_no = fresh.container_no,
    status = 'PENDING_FORKLIFT', confirmed_by = null, confirmed_by_name = null, confirmed_at = null,
    swaps = swaps || jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
      'fromContainerId', old.id, 'fromContainerNo', old.container_no, 'fromMasterDossierCode', old.dossier_code,
      'toContainerNo', fresh.container_no, 'toMasterDossierCode', fresh.dossier_code, 'reason', p_reason, 'note', v_note, 'lifted', v_lifted,
      'gatedOutBy', o.confirmed_by_name, 'gatedOutAt', o.confirmed_at, 'swappedBy', me.full_name, 'swappedAt', now())))
  where id = o.id;
  -- Chứng từ / giao dịch / phiếu thu / phiếu K80 giữ nguyên mã — chỉ đổi số cont
  update public.vouchers set container_no = fresh.container_no where id = o.voucher_id;
  update public.payment_transactions set container_no = fresh.container_no where voucher_id = o.voucher_id;
  update public.payment_receipts set container_no = fresh.container_no where voucher_id = o.voucher_id;
  update public.k80_tickets set dossier_code = fresh.dossier_code, container_no = fresh.container_no, size = fresh.size, type = fresh.type,
    condition_class = fresh.condition_class, damage_remarks = fresh.damage_remarks, stuffing_class = fresh.stuffing_class,
    cleaning_items = fresh.cleaning_items, manufacture_year = fresh.manufacture_year, target_block = fresh.current_block
  where out_dossier_code = o.code;
  update public.release_bookings set status = 'OPEN' where id = b.id and status = 'COMPLETED';

  if not v_lifted then
    -- DEC-192: chưa nâng hạ → cont cũ giữ nguyên vị trí, bỏ khóa phân bổ; hư hỏng → Chờ báo giá ngay (không việc Xe nâng)
    update public.containers set
      status = 'IN_YARD', out_dossier_code = null, allocated_gate_out_id = null, active_qr_code = 'QR-' || old.dossier_code,
      condition_class = case when p_reason = 'DAMAGE' then 'DAMAGE'::public.condition_class else condition_class end,
      damage_remarks = case when p_reason = 'DAMAGE' and v_note is not null then array[v_note] else damage_remarks end,
      release_damage = release_damage or p_reason = 'DAMAGE',
      needs_quotation = needs_quotation or p_reason = 'DAMAGE'
    where id = old.id returning * into old;
    if p_reason = 'DAMAGE' then
      insert into public.work_orders (code, container_id, dossier_code, container_no, category, items, assigned_to)
      values ('INSP-' || old.dossier_code || '-PS', old.id, old.dossier_code, old.container_no, 'INSPECTION',
        case when coalesce(array_length(old.damage_remarks, 1), 0) > 0 then old.damage_remarks else array['Hư hỏng phát sinh khi cấp vỏ'] end,
        'Bộ phận Báo giá');
    end if;
  else
  -- Cont cũ: về hàng chờ Xe nâng HẠ LẠI (giữ hồ sơ HV- + ngày hạ gốc)
  update public.containers set
    status = 'WAITING_PLACEMENT', gate_out_at = null, out_dossier_code = null, allocated_gate_out_id = null,
    active_qr_code = 'QR-' || old.dossier_code,
    swap_return = jsonb_strip_nulls(jsonb_build_object('gateOutCode', o.code, 'reason', p_reason, 'note', v_note,
      'toContainerNo', fresh.container_no, 'requestedBy', me.full_name, 'requestedAt', now())),
    condition_class = case when p_reason = 'DAMAGE' then 'DAMAGE'::public.condition_class else condition_class end,
    damage_remarks = case when p_reason = 'DAMAGE' and v_note is not null then array[v_note] else damage_remarks end,
    release_damage = release_damage or p_reason = 'DAMAGE'
  where id = old.id;
  end if;
  -- Cont thay thế: giữ cho lệnh CV- (QR phiếu K80 giữ nguyên)
  update public.containers set status = 'ALLOCATED', out_dossier_code = o.code, allocated_gate_out_id = o.id, active_qr_code = 'QR-' || o.code
  where id = fresh.id;

  perform public.write_audit('GATE_OUT_SWAP', 'GATE_OUT', o.code,
    format('[Hồ sơ %s] ĐỔI CONTAINER %s → %s (%s). Lý do: %s%s', o.code, old.container_no, fresh.container_no,
      case when v_lifted then 'đã nâng lên xe' else 'chưa nâng hạ' end, v_label, coalesce(' — ' || v_note, '')),
    old.dossier_code);
  return public.idem_put(p_request_id, 'swap_gate_out_container', jsonb_build_object('gate_out_id', o.id));
end $$;

revoke execute on function public.swap_gate_out_container(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.swap_gate_out_container(uuid, uuid, text, text, text) to authenticated;
