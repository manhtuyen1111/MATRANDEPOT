-- ============================================================================
-- DEC-178 — TỐC ĐỘ KHI DỮ LIỆU LỚN (thử tải 2026-10-29: 200.000 lượt vào – ra + 200.000 lượt sửa chữa)
-- Lỗi: đăng nhập → "canceling statement due to statement timeout" (quá 8 giây).
-- 1. RLS viết `using (public.is_active_staff())`: hàm security definer → Postgres gọi lại CHO TỪNG DÒNG
--    (200.000 dòng = 200.000 lần tra bảng staff). Bọc `(select …)` → gọi 1 lần / truy vấn (initPlan) — cách Supabase khuyến nghị.
--    Quyền KHÔNG đổi: cùng hàm, cùng điều kiện; chỉ đổi cách Postgres tính.
-- 2. Thêm chỉ mục cho các cột app lọc khi mở app / báo cáo (cửa sổ thời gian, theo cont, theo trạng thái).
-- Không sửa migration cũ (đã apply lên matran-test).
-- ============================================================================

-- 1. Bọc (select …) cho mọi policy trong schema public có gọi hàm kiểm tra quyền
do $$
declare
  p record;
  fn constant text := '(public\.)?(is_active_staff|has_permission|has_any_role)\(([^()]*)\)';
  q text;
  c text;
begin
  for p in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and (coalesce(qual, '') ~ '(is_active_staff|has_permission|has_any_role)\(' or coalesce(with_check, '') ~ '(is_active_staff|has_permission|has_any_role)\(')
  loop
    -- Đã bọc rồi (chạy lại) → bỏ qua
    continue when coalesce(p.qual, '') ~* 'select' or coalesce(p.with_check, '') ~* 'select';
    q := regexp_replace(p.qual, fn, '(select public.\2(\3))', 'g');
    c := regexp_replace(p.with_check, fn, '(select public.\2(\3))', 'g');
    if q is not null then
      execute format('alter policy %I on %I.%I using (%s)', p.policyname, p.schemaname, p.tablename, q);
    end if;
    if c is not null then
      execute format('alter policy %I on %I.%I with check (%s)', p.policyname, p.schemaname, p.tablename, c);
    end if;
  end loop;
end $$;

-- 2. Chỉ mục
-- Mở app / báo cáo: lọc theo khoảng thời gian (loadWorking.ts — fetchRaw)
create index if not exists containers_gate_in_at on public.containers (gate_in_at);
create index if not exists gate_in_orders_created on public.gate_in_orders (created_at);
create index if not exists gate_out_orders_created on public.gate_out_orders (created_at);
create index if not exists release_bookings_created on public.release_bookings (created_at);
create index if not exists vouchers_created on public.vouchers (created_at);
create index if not exists payment_transactions_created on public.payment_transactions (created_at);
create index if not exists prepaid_receipts_created on public.prepaid_receipts (created_at);
create index if not exists prepaid_deductions_performed on public.prepaid_deductions (performed_at);
create index if not exists k80_tickets_issued on public.k80_tickets (issued_at);
create index if not exists vessel_lists_created on public.vessel_lists (created_at);
-- Hồ sơ đang làm dở (lọc theo trạng thái)
create index if not exists gate_in_orders_open on public.gate_in_orders (status) where status in ('FIELD_RECORDED', 'PAYMENT_PENDING');
create index if not exists payment_transactions_prepaid on public.payment_transactions (prepaid_id) where prepaid_id is not null;
-- Sửa chữa / vệ sinh / báo giá của từng lượt lưu bãi (byIds theo container_id)
create index if not exists work_orders_container on public.work_orders (container_id);
