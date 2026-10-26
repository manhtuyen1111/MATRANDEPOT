-- ============================================================================
-- MATRAN DEPOT — Migration 1/5 (phần 5): RLS NỀN + QUYỀN GỌI HÀM
-- Thiết kế: docs/DATABASE_SCHEMA.md mục 7.
--   - Bật RLS mọi bảng; KHÔNG cấp insert / update / delete trực tiếp — chỉ RPC (security definer) được ghi.
--   - Đọc: nhân viên đang hoạt động; bảng nhạy cảm giới hạn thêm.
--   - Hàm nội bộ (cấp mã, ghi nhật ký, chống lặp, tạo partition, đăng ký nhân viên) không cho client gọi.
-- ============================================================================

alter table public.staff enable row level security;
alter table public.staff_roles enable row level security;
alter table public.company_profile enable row level security;
alter table public.partners enable row level security;
alter table public.container_sizes enable row level security;
alter table public.container_types enable row level security;
alter table public.yard_blocks enable row level security;
alter table public.fee_catalog enable row level security;
alter table public.repair_teams enable row level security;
alter table public.repair_team_members enable row level security;
alter table public.code_counters enable row level security;
alter table public.request_log enable row level security;
alter table public.audit_logs enable row level security;
alter table public.role_permissions enable row level security;

-- Chặn ghi trực tiếp từ client (kể cả khi lỡ tạo policy sau này)
revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;
revoke all on all tables in schema public from anon;

-- Danh mục: mọi nhân viên đang hoạt động đọc được
create policy catalog_read on public.company_profile for select to authenticated using (public.is_active_staff());
create policy catalog_read on public.partners for select to authenticated using (public.is_active_staff());
create policy catalog_read on public.container_sizes for select to authenticated using (public.is_active_staff());
create policy catalog_read on public.container_types for select to authenticated using (public.is_active_staff());
create policy catalog_read on public.yard_blocks for select to authenticated using (public.is_active_staff());
create policy catalog_read on public.fee_catalog for select to authenticated using (public.is_active_staff());
create policy catalog_read on public.repair_teams for select to authenticated using (public.is_active_staff());
create policy catalog_read on public.repair_team_members for select to authenticated using (public.is_active_staff());
create policy catalog_read on public.role_permissions for select to authenticated using (public.is_active_staff());

-- Nhân viên: tự đọc hồ sơ của mình (kể cả khi đã khóa, để giao diện báo "tài khoản đã khóa"); Admin đọc tất cả.
-- Người khác chỉ cần tên → dùng view staff_directory bên dưới.
create policy staff_self_or_admin on public.staff for select to authenticated
  using (id = auth.uid() or public.has_any_role(array[]::public.app_role[]));
create policy staff_roles_self_or_admin on public.staff_roles for select to authenticated
  using (staff_id = auth.uid() or public.has_any_role(array[]::public.app_role[]));

create view public.staff_directory with (security_barrier) as
  select s.id, s.staff_code, s.full_name, s.is_active from public.staff s where public.is_active_staff();
grant select on public.staff_directory to authenticated;

-- Nhật ký: Quản lý / Admin
create policy audit_read on public.audit_logs for select to authenticated
  using (public.has_any_role(array['MANAGER']::public.app_role[]));

-- code_counters, request_log: không policy select → client không đọc được (chỉ RPC dùng)

-- ---------------------------------------------------------------------------
-- QUYỀN GỌI HÀM
-- ---------------------------------------------------------------------------
-- Supabase mặc định cấp execute mọi hàm cho anon / authenticated → thu hồi hết rồi cấp lại từng hàm
revoke execute on all functions in schema public from public, anon, authenticated;

-- Hàm nội bộ: chỉ gọi từ trong RPC khác (security definer chạy với quyền chủ sở hữu)
revoke execute on function public.next_code(text) from authenticated;
revoke execute on function public.write_audit(text, text, text, text, text) from authenticated;
revoke execute on function public.idem_put(uuid, text, jsonb) from authenticated;
revoke execute on function public.ensure_audit_partition(date) from authenticated;
-- Gọi bởi Edge Function bằng service_role (đã xác minh JWT Admin ở Edge Function)
revoke execute on function public.register_staff(uuid, uuid, text, text, text, public.app_role[]) from authenticated;
revoke execute on function public.mark_password_reset(uuid, uuid) from authenticated;
grant execute on function public.register_staff(uuid, uuid, text, text, text, public.app_role[]) to service_role;
grant execute on function public.mark_password_reset(uuid, uuid) to service_role;

-- RPC client được gọi (tự kiểm quyền bên trong)
grant execute on function public.is_active_staff() to authenticated;
grant execute on function public.has_any_role(public.app_role[]) to authenticated;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.catalog_upsert_partner(text, text, boolean, boolean, boolean) to authenticated;
grant execute on function public.catalog_set_partner_active(text, boolean) to authenticated;
grant execute on function public.catalog_add_size(text) to authenticated;
grant execute on function public.catalog_add_type(text) to authenticated;
grant execute on function public.catalog_upsert_yard_block(text, text, int, int, int, int, text, boolean) to authenticated;
grant execute on function public.catalog_set_inspection_rack(text, boolean) to authenticated;
grant execute on function public.catalog_set_yard_block_active(text, boolean) to authenticated;
grant execute on function public.catalog_add_fee(public.fee_category, bigint, text, text, text, text) to authenticated;
grant execute on function public.catalog_set_fee_active(uuid, boolean) to authenticated;
grant execute on function public.catalog_update_company(text, text, text, text, text, text, text) to authenticated;
grant execute on function public.catalog_upsert_repair_team(text, text, boolean) to authenticated;
grant execute on function public.catalog_upsert_repair_member(uuid, text, uuid, boolean, uuid) to authenticated;
grant execute on function public.admin_update_staff(uuid, text, text, public.app_role[], boolean) to authenticated;
grant execute on function public.staff_password_changed() to authenticated;

-- Hàm tạo sau này mặc định không ai gọi được cho tới khi grant rõ ràng
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema public revoke insert, update, delete, truncate on tables from anon, authenticated;
