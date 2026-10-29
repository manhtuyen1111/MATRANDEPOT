-- ============================================================================
-- DEC-185 — ĐỔI CONTAINER khi cont đã cấp ra (Xe nâng OUT) và đang chờ TRẢ CHỨNG TỪ CẤP VỎ.
-- Hợp đồng nghiệp vụ (giữ đúng thông báo lỗi): depotOperations.ts — swapGateOutContainer, placeSwapReturn (trong updateContainerLocation).
--   * Giữ nguyên lệnh CV-, chứng từ, phiếu thu, QR phiếu K80 → lệnh chuyển sang cont thay thế (Xe nâng cấp lại).
--   * Cont cũ quay về hàng chờ Xe nâng HẠ LẠI (giữ hồ sơ HV- + ngày hạ gốc), vị trí mới do Xe nâng chọn.
--   * KEN_VO: giữ trạng thái → hạ xong cấp được khách khác. DAMAGE: chuyển DAMAGE + PHÁT SINH CẤP VỎ → hạ xong vào Chờ báo giá.
-- ============================================================================

alter type public.location_action add value if not exists 'SWAP_RETURN';

-- Cột mới (jsonb giữ đúng tên trường của app — không cần đổi tên khi đọc)
alter table public.containers
  add column if not exists swap_return jsonb,                          -- chờ Xe nâng hạ lại: {gateOutCode, reason, note, toContainerNo, requestedBy, requestedAt}
  add column if not exists release_damage boolean not null default false; -- nhãn PHÁT SINH CẤP VỎ
alter table public.gate_out_orders
  add column if not exists swaps jsonb not null default '[]'::jsonb;   -- các lần đổi: [{fromContainerId, fromContainerNo, fromMasterDossierCode, toContainerNo, …}]
-- Mở hồ sơ cont cũ phải tìm được lệnh đã đổi đi (loadDossierState: swaps @> [{fromMasterDossierCode}])
create index if not exists gate_out_orders_swaps on public.gate_out_orders using gin (swaps jsonb_path_ops) where swaps <> '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- 1. ĐỔI CONTAINER (swapGateOutContainer) — Văn phòng / Quản lý
-- ---------------------------------------------------------------------------
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
  if o.status <> 'GATE_OUT_OK' or o.documents_returned_at is not null then
    raise exception 'Hồ sơ %: chỉ ĐỔI CONTAINER khi cont đã cấp ra và đang chờ trả chứng từ.', o.code;
  end if;
  select * into old from public.containers where id = o.container_id and status = 'GATED_OUT' for update;
  if old.id is null then raise exception 'Không tìm thấy lượt lưu bãi của container %.', o.container_no; end if;
  if exists (select 1 from public.containers where container_no = old.container_no and status <> 'GATED_OUT') then
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
      'toContainerNo', fresh.container_no, 'toMasterDossierCode', fresh.dossier_code, 'reason', p_reason, 'note', v_note,
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
  -- Cont thay thế: giữ cho lệnh CV- (QR phiếu K80 giữ nguyên)
  update public.containers set status = 'ALLOCATED', out_dossier_code = o.code, allocated_gate_out_id = o.id, active_qr_code = 'QR-' || o.code
  where id = fresh.id;

  perform public.write_audit('GATE_OUT_SWAP', 'GATE_OUT', o.code,
    format('[Hồ sơ %s] ĐỔI CONTAINER %s → %s. Lý do: %s%s', o.code, old.container_no, fresh.container_no, v_label, coalesce(' — ' || v_note, '')),
    old.dossier_code);
  return public.idem_put(p_request_id, 'swap_gate_out_container', jsonb_build_object('gate_out_id', o.id));
end $$;

-- ---------------------------------------------------------------------------
-- 2. XE NÂNG HẠ VỎ: thêm nhánh HẠ LẠI cont đổi container (định nghĩa lại hàm của migration 4, giữ nguyên phần còn lại)
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
  v_swap_reason text;
  v_swap_code text;
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

  -- DEC-185: HẠ LẠI cont đổi container — kén vỏ → tồn bãi; hư hỏng → Chờ báo giá (PHÁT SINH CẤP VỎ)
  if c.swap_return is not null then
    v_swap_reason := c.swap_return->>'reason';
    v_swap_code := c.swap_return->>'gateOutCode';
    update public.containers set status = 'IN_YARD', current_block = s.slot_block, current_bay = s.slot_bay, current_row = s.slot_row,
      current_tier = s.slot_tier, swap_return = null, needs_quotation = needs_quotation or v_swap_reason = 'DAMAGE'
    where id = c.id;
    perform public.add_location_history(c, format('Đổi container (%s)', v_swap_code), v_to, 'SWAP_RETURN',
      coalesce(nullif(trim(p_reason), ''),
        case when v_swap_reason = 'DAMAGE' then 'Container phát sinh hư hỏng, không đủ điều kiện cấp khách' else 'Khách kén vỏ, yêu cầu đổi cont khác' end));
    if v_swap_reason = 'DAMAGE' then
      insert into public.work_orders (code, container_id, dossier_code, container_no, category, items, assigned_to)
      values ('INSP-' || c.dossier_code || '-PS', c.id, c.dossier_code, c.container_no, 'INSPECTION',
        case when coalesce(array_length(c.damage_remarks, 1), 0) > 0 then c.damage_remarks else array['Hư hỏng phát sinh khi cấp vỏ'] end,
        'Bộ phận Báo giá');
    end if;
    perform public.write_audit('SWAP_RETURN_PLACEMENT', 'CONTAINER', c.dossier_code,
      format('[Hồ sơ %s] Xe nâng hạ lại %s (đổi container %s) vào %s%s', c.dossier_code, c.container_no, v_swap_code, v_to,
        case when v_swap_reason = 'DAMAGE' then ' → CHỜ BÁO GIÁ (PHÁT SINH CẤP VỎ)' else '' end), c.dossier_code);
    return public.idem_put(p_request_id, 'update_container_location', jsonb_build_object('id', c.id, 'location', v_to));
  end if;

  update public.containers set status = 'IN_YARD', current_block = s.slot_block, current_bay = s.slot_bay, current_row = s.slot_row, current_tier = s.slot_tier
  where id = c.id;
  perform public.add_location_history(c, 'Chờ hạ vỏ (GATE IN)', v_to, 'INITIAL_BLOCK', coalesce(nullif(trim(p_reason), ''), 'Xe nâng hạ vỏ'));
  perform public.write_audit('YARD_PLACEMENT', 'CONTAINER', c.dossier_code,
    format('[Hồ sơ %s] Xe nâng hạ vỏ %s vào %s', c.dossier_code, c.container_no, v_to), c.dossier_code);
  perform public.mark_vessel_import_placed(c.id); -- DEC-069
  return public.idem_put(p_request_id, 'update_container_location', jsonb_build_object('id', c.id, 'location', v_to));
end $$;

revoke execute on function public.swap_gate_out_container(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.swap_gate_out_container(uuid, uuid, text, text, text) to authenticated;
revoke execute on function public.update_container_location(uuid, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.update_container_location(uuid, text, text, text, text, text, text, text) to authenticated;
