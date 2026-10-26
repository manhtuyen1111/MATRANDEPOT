-- ============================================================================
-- MATRAN DEPOT — Migration 1/5 (phần 3): HÀM HỖ TRỢ — quyền, mã hồ sơ, nhật ký, chống bấm lặp
-- Quyền mirror src/services/permissions.ts (PERMISSIONS). Đổi quyền → sửa cả 2 nơi + ROLE_PERMISSION_MATRIX.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- MA TRẬN QUYỀN — 1 dòng / (quyền, vai trò). ADMIN luôn có toàn quyền (không cần dòng).
-- ---------------------------------------------------------------------------
create table public.role_permissions (
  permission text not null,
  role public.app_role not null,
  primary key (permission, role)
);

insert into public.role_permissions (permission, role) values
  ('GATE_IN_FIELD', 'INSPECTOR'), ('GATE_IN_FIELD', 'MANAGER'),
  ('GATE_IN_OFFICE', 'OFFICE'), ('GATE_IN_OFFICE', 'MANAGER'),
  ('PAYMENT_CONFIRM', 'OFFICE'), ('PAYMENT_CONFIRM', 'MANAGER'),
  ('CLEANING_COMPLETE', 'CLEANING'), ('CLEANING_COMPLETE', 'OFFICE'),
  ('FORKLIFT_OPS', 'FORKLIFT'), ('FORKLIFT_OPS', 'OFFICE'), ('FORKLIFT_OPS', 'MANAGER'),
  ('QUOTATION', 'QUOTATION'),
  ('REPAIR', 'REPAIR_STAFF'),
  ('YARD_LOCATION_CORRECT', 'OFFICE'), ('YARD_LOCATION_CORRECT', 'MANAGER'),
  ('CONTAINER_LOCK', 'OFFICE'), ('CONTAINER_LOCK', 'MANAGER'),
  ('OFFICE_NOTE', 'OFFICE'), ('OFFICE_NOTE', 'MANAGER'),
  ('RELEASE_ORDER', 'OFFICE'), ('RELEASE_ORDER', 'MANAGER'),
  ('GATE_OUT_CONFIRM', 'FORKLIFT'), ('GATE_OUT_CONFIRM', 'OFFICE'), ('GATE_OUT_CONFIRM', 'MANAGER'),
  ('RECEIPT_VIEW', 'OFFICE'), ('RECEIPT_VIEW', 'MANAGER'), ('RECEIPT_VIEW', 'ACCOUNTANT'),
  ('INVOICE_ISSUE', 'ACCOUNTANT'),
  ('PREPAID_RECEIPT_CREATE', 'OFFICE'),
  ('PREPAID_CASH_CONFIRM', 'OFFICE'),
  ('REPORT_FINANCE', 'OFFICE'), ('REPORT_FINANCE', 'MANAGER'),
  ('VESSEL_LIST_MANAGE', 'OFFICE'), ('VESSEL_LIST_MANAGE', 'MANAGER'),
  ('VESSEL_IMPORT_INSPECT', 'INSPECTOR'), ('VESSEL_IMPORT_INSPECT', 'MANAGER'),
  ('VESSEL_EXPORT_EXECUTE', 'INSPECTOR'), ('VESSEL_EXPORT_EXECUTE', 'FORKLIFT'), ('VESSEL_EXPORT_EXECUTE', 'MANAGER');
-- CATALOG_EDIT, FEEDBACK_MANAGE: chỉ ADMIN (không có dòng). DEMO_BANK_SIMULATOR: không có ở chế độ thật.

-- Nhân viên đang đăng nhập — chỉ khi tài khoản đang hoạt động
create or replace function public.current_staff() returns public.staff
language sql stable security definer set search_path = public as $$
  select s.* from public.staff s where s.id = auth.uid() and s.is_active;
$$;

create or replace function public.is_active_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff s where s.id = auth.uid() and s.is_active);
$$;

create or replace function public.has_any_role(roles public.app_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff s join public.staff_roles r on r.staff_id = s.id
    where s.id = auth.uid() and s.is_active and (r.role = 'ADMIN' or r.role = any (roles))
  );
$$;

create or replace function public.has_permission(perm text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.staff s join public.staff_roles r on r.staff_id = s.id
    where s.id = auth.uid() and s.is_active
      and (r.role = 'ADMIN' or exists (select 1 from public.role_permissions p where p.permission = perm and p.role = r.role))
  );
$$;

-- Ném lỗi tiếng Việt khi không đủ quyền (dùng đầu mọi RPC)
create or replace function public.assert_permission(perm text, message text) returns public.staff
language plpgsql stable security definer set search_path = public as $$
declare
  me public.staff;
begin
  me := public.current_staff();
  if me.id is null then
    raise exception 'Phiên đăng nhập không hợp lệ hoặc tài khoản đã bị khóa.' using errcode = '42501';
  end if;
  if not public.has_permission(perm) then
    raise exception 'Không đủ quyền: %', message using errcode = '42501';
  end if;
  return me;
end $$;

create or replace function public.assert_admin() returns public.staff
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_any_role(array[]::public.app_role[]) then
    raise exception 'Không đủ quyền: chỉ Admin được cấu hình Danh mục.' using errcode = '42501';
  end if;
  return public.current_staff();
end $$;

-- Vai trò hiển thị trong nhật ký (vai trò đầu tiên theo thứ tự enum)
create or replace function public.staff_primary_role(staff_id uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select r.role::text from public.staff_roles r where r.staff_id = staff_primary_role.staff_id order by r.role limit 1), 'SYSTEM');
$$;

-- ---------------------------------------------------------------------------
-- MÃ HỒ SƠ / PHIẾU (codes.ts): HV- CV- NT- XT- GY- = YYMMDD-NNN; PT-TT- PT-TTR- = YYMMDD-NNNN
-- Đánh số lại mỗi ngày theo giờ Việt Nam. Cấp trong giao dịch của tác nghiệp → lỗi thì không chiếm mã.
-- ---------------------------------------------------------------------------
-- (tên biến v_* để không trùng tên cột trong ON CONFLICT)
create or replace function public.next_code(p_prefix text) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_period text := to_char(now() at time zone 'Asia/Ho_Chi_Minh', 'YYMMDD');
  v_digits int;
  v_no int;
begin
  v_digits := case p_prefix
    when 'HV' then 3 when 'CV' then 3 when 'NT' then 3 when 'XT' then 3 when 'GY' then 3
    when 'PT-TT' then 4 when 'PT-TTR' then 4
    else null end;
  if v_digits is null then
    raise exception 'Loại mã không hợp lệ: %', p_prefix;
  end if;
  insert into public.code_counters as c (prefix, period, last_no) values (p_prefix, v_period, 1)
  on conflict on constraint code_counters_pkey do update set last_no = c.last_no + 1
  returning c.last_no into v_no;
  if v_no >= power(10, v_digits) then
    raise exception 'Đã hết số mã % trong ngày %.', p_prefix, v_period;
  end if;
  return p_prefix || '-' || v_period || '-' || lpad(v_no::text, v_digits, '0');
end $$;

-- ---------------------------------------------------------------------------
-- NHẬT KÝ
-- ---------------------------------------------------------------------------
create or replace function public.write_audit(
  action_code text, entity_type text, entity_code text, summary text, dossier_code text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  me public.staff := public.current_staff();
begin
  insert into public.audit_logs (actor_id, actor_name, actor_role, action_code, entity_type, entity_code, dossier_code, summary)
  values (me.id, coalesce(me.full_name, 'HỆ THỐNG'), case when me.id is null then 'SYSTEM' else public.staff_primary_role(me.id) end,
          action_code, entity_type, entity_code, dossier_code, summary);
end $$;

-- Partition nhật ký theo tháng: tạo trước cho tháng của ngày truyền vào (gọi định kỳ — migration 5 đặt lịch)
create or replace function public.ensure_audit_partition(month_start date) returns void
language plpgsql security definer set search_path = public as $$
declare
  m date := date_trunc('month', month_start)::date;
  name text := 'audit_logs_' || to_char(m, 'YYYY_MM');
begin
  if to_regclass('public.' || name) is null then
    execute format('create table public.%I partition of public.audit_logs for values from (%L) to (%L)',
                   name, m, (m + interval '1 month')::date);
  end if;
end $$;

select public.ensure_audit_partition(current_date);
select public.ensure_audit_partition((current_date + interval '1 month')::date);
select public.ensure_audit_partition((current_date + interval '2 month')::date);

-- ---------------------------------------------------------------------------
-- CHỐNG BẤM LẶP: RPC gọi idem_get trước, idem_put sau khi ghi xong (cùng giao dịch)
-- ---------------------------------------------------------------------------
create or replace function public.idem_get(request_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select l.result from public.request_log l where l.request_id = idem_get.request_id and l.staff_id = auth.uid();
$$;

create or replace function public.idem_put(request_id uuid, rpc_name text, result jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if request_id is not null then
    insert into public.request_log (request_id, staff_id, rpc_name, result) values (request_id, auth.uid(), rpc_name, result);
  end if;
  return result;
end $$;
