-- ============================================================================
-- DEC-179 — BÁO CÁO THEO BỘ PHẬN: Giám định / Vệ sinh / Xe nâng — CHI TIẾT (phân trang ở database như DEC-178 bước 4b)
-- Chỉ thêm chỉ mục cho cột thời gian lọc / sắp xếp. Không đổi dữ liệu, không đổi quyền (đọc vẫn theo RLS staff_read).
--   Giám định: gate_in_orders.field_at (lúc giám định)
--   Xe nâng  : location_history.performed_at (partition theo tháng — chỉ mục tạo trên bảng cha, tự áp cho mọi partition)
--   Vệ sinh  : work_orders (category, report_at) — đã có từ migration 20261109000001
-- ============================================================================
create index if not exists gate_in_orders_field_at on public.gate_in_orders (field_at desc);
create index if not exists location_history_performed on public.location_history (performed_at desc);
create index if not exists location_history_action on public.location_history (action, performed_at desc);
