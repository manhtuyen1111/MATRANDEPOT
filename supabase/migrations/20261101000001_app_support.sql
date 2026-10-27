-- ============================================================================
-- MATRAN DEPOT — Bổ sung khi nối app (DEC-155): Góp ý, Trả chứng từ, ngừng dùng Size / Type
-- Hợp đồng: src/services/feedback.ts (submitFeedback, respondFeedback), driverRoute.ts (confirmDocumentsReturn),
-- depotOperations.ts (deleteContainerSizeCatalogItem / deleteContainerTypeCatalogItem → ngừng dùng).
-- ============================================================================

-- GÓP Ý (DEC-120) — mọi nhân viên gửi; chỉ Admin xử lý
create table public.feedbacks (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                          -- GY-YYMMDD-NNN
  menu_id text not null,
  menu_label text not null,
  content text not null check (length(content) between 5 and 2000),
  status public.feedback_status not null default 'MOI',
  created_by uuid not null references public.staff (id),
  created_by_name text not null,
  created_at timestamptz not null default now(),
  response text,
  responded_by_name text,
  responded_at timestamptz
);
create index feedbacks_created on public.feedbacks (created_at desc);
alter table public.feedbacks enable row level security;
-- Người gửi xem góp ý của mình; Admin xem tất cả
create policy feedback_read on public.feedbacks for select to authenticated
  using (created_by = auth.uid() or public.has_permission('FEEDBACK_MANAGE'));
revoke insert, update, delete, truncate on public.feedbacks from anon, authenticated;
revoke all on public.feedbacks from anon;

create or replace function public.submit_feedback(p_menu_id text, p_menu_label text, p_content text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me public.staff := public.current_staff();
  v_content text := trim(coalesce(p_content, ''));
  v_code text;
begin
  if me.id is null then raise exception 'Tài khoản không hoạt động — không gửi được góp ý.'; end if;
  if trim(coalesce(p_menu_id, '')) = '' or trim(coalesce(p_menu_label, '')) = '' then raise exception 'Vui lòng chọn MENU / TÍNH NĂNG cần góp ý.'; end if;
  if length(v_content) < 5 then raise exception 'Nội dung góp ý quá ngắn (tối thiểu 5 ký tự).'; end if;
  if length(v_content) > 2000 then raise exception 'Nội dung góp ý tối đa 2000 ký tự.'; end if;
  v_code := public.next_code('GY');
  insert into public.feedbacks (code, menu_id, menu_label, content, created_by, created_by_name)
  values (v_code, trim(p_menu_id), trim(p_menu_label), v_content, me.id, me.full_name);
  perform public.write_audit('FEEDBACK_SUBMIT', 'FEEDBACK', v_code, format('[Góp ý %s] %s góp ý về "%s"', v_code, me.full_name, trim(p_menu_label)));
  return jsonb_build_object('code', v_code);
end $$;

create or replace function public.respond_feedback(p_id uuid, p_status public.feedback_status, p_response text default null) returns void
language plpgsql security definer set search_path = public as $$
declare
  me public.staff;
  f public.feedbacks;
  v_resp text := nullif(trim(coalesce(p_response, '')), '');
begin
  me := public.assert_permission('FEEDBACK_MANAGE', 'chỉ Quản trị viên (Admin) được xử lý góp ý.');
  select * into f from public.feedbacks where id = p_id for update;
  if f.id is null then raise exception 'Không tìm thấy góp ý.'; end if;
  if p_status in ('DA_XU_LY', 'KHONG_AP_DUNG') and v_resp is null then
    raise exception 'Vui lòng ghi PHẢN HỒI cho người góp ý khi kết thúc (Đã xử lý / Không áp dụng).';
  end if;
  update public.feedbacks set status = p_status, response = v_resp, responded_by_name = me.full_name, responded_at = now() where id = f.id;
  perform public.write_audit('FEEDBACK_RESPOND', 'FEEDBACK', f.code,
    format('[Góp ý %s] Admin cập nhật %s%s', f.code, p_status, coalesce(' — ' || v_resp, '')));
end $$;

-- TRẢ CHỨNG TỪ (DEC-052): mỗi hồ sơ 1 lần. Kiểm các bước lộ trình đã xong làm ở app (getDriverRoute) trước khi gọi;
-- database chặn: sai quyền, hồ sơ chưa GATE IN OK / GATE OUT OK, đã trả rồi.
create or replace function public.mark_documents_returned(p_operation text, p_code text) returns void
language plpgsql security definer set search_path = public as $$
declare
  me public.staff;
  v_done timestamptz;
  v_status text;
begin
  me := public.assert_permission('GATE_IN_OFFICE', 'chỉ Văn phòng / Quản lý được trả chứng từ.');
  if p_operation = 'CAP_VO' then
    select documents_returned_at, status::text into v_done, v_status from public.gate_out_orders where code = p_code for update;
    if v_status is null then raise exception 'Không tìm thấy hồ sơ của phiếu K80.'; end if;
    if v_status <> 'GATE_OUT_OK' then raise exception 'Chưa hoàn tất bước XE NÂNG — cấp vỏ. Lái xe cần đến bộ phận này trước.'; end if;
    if v_done is not null then raise exception 'Đã trả chứng từ cho phiếu này lúc %.', to_char(v_done at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI:SS'); end if;
    update public.gate_out_orders set documents_returned_at = now(), documents_returned_by = me.id, documents_returned_by_name = me.full_name where code = p_code;
  else
    select documents_returned_at, status::text into v_done, v_status from public.gate_in_orders where code = p_code for update;
    if v_status is null then raise exception 'Không tìm thấy hồ sơ của phiếu K80.'; end if;
    if v_status <> 'GATE_IN_OK' then raise exception 'Hồ sơ % chưa GATE IN OK.', p_code; end if;
    if v_done is not null then raise exception 'Đã trả chứng từ cho phiếu này lúc %.', to_char(v_done at time zone 'Asia/Ho_Chi_Minh', 'DD/MM/YYYY HH24:MI:SS'); end if;
    update public.gate_in_orders set documents_returned_at = now(), documents_returned_by = me.id, documents_returned_by_name = me.full_name where code = p_code;
  end if;
  perform public.write_audit('DOCUMENTS_RETURNED', case when p_operation = 'CAP_VO' then 'GATE_OUT' else 'GATE_IN' end, p_code,
    format('[Hồ sơ %s] Văn phòng trả chứng từ cho lái xe', p_code), p_code);
end $$;

-- Ngừng dùng / mở lại Size, Type (thay xóa cứng — đã dùng trong hồ sơ cũ)
create or replace function public.catalog_set_size_active(p_code text, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  update public.container_sizes set is_active = p_active where code = trim(p_code);
  if not found then raise exception 'Không tìm thấy SIZE %.', p_code; end if;
  perform public.write_audit('ADMIN_SET_SIZE_ACTIVE', 'CATALOG', trim(p_code),
    format('[Admin Danh mục chung] %s SIZE %s', case when p_active then 'Mở lại' else 'Ngừng dùng' end, trim(p_code)));
end $$;

create or replace function public.catalog_set_type_active(p_code text, p_active boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.assert_admin();
  update public.container_types set is_active = p_active where code = upper(trim(p_code));
  if not found then raise exception 'Không tìm thấy TYPE %.', p_code; end if;
  perform public.write_audit('ADMIN_SET_TYPE_ACTIVE', 'CATALOG', upper(trim(p_code)),
    format('[Admin Danh mục chung] %s TYPE %s', case when p_active then 'Mở lại' else 'Ngừng dùng' end, upper(trim(p_code))));
end $$;

revoke execute on function public.submit_feedback(text, text, text), public.respond_feedback(uuid, public.feedback_status, text),
  public.mark_documents_returned(text, text), public.catalog_set_size_active(text, boolean), public.catalog_set_type_active(text, boolean)
  from public, anon, authenticated;
grant execute on function public.submit_feedback(text, text, text) to authenticated;
grant execute on function public.respond_feedback(uuid, public.feedback_status, text) to authenticated;
grant execute on function public.mark_documents_returned(text, text) to authenticated;
grant execute on function public.catalog_set_size_active(text, boolean) to authenticated;
grant execute on function public.catalog_set_type_active(text, boolean) to authenticated;
