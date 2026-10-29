-- ============================================================================
-- DEC-178 (bước 4b) — BÁO CÁO PHÂN TRANG Ở DATABASE
-- App không tải cả khoảng thời gian về máy nữa: database lọc + đếm + trả đúng 1 trang (Excel lấy theo đợt 2.000 dòng).
-- Cột sinh (tự tính, không ghi tay):
--   report_at        = thời điểm dùng để lọc / sắp xếp báo cáo (giống hàm báo cáo trong src/services/reports.ts)
--   container_serial = 7 số seri (bỏ 4 chữ hãng) — tìm theo đầu seri (containerSearch.ts)
-- Không đổi dữ liệu, không đổi quyền. Không sửa migration cũ.
-- ============================================================================

-- HẠ VỎ / NHẬP TÀU: GATE IN OK lúc, chưa OK thì lúc Giám định
alter table public.gate_in_orders
  add column report_at timestamptz generated always as (coalesce(gate_in_ok_at, field_at)) stored,
  add column container_serial text generated always as (substr(container_no, 5)) stored;
create index gate_in_orders_report on public.gate_in_orders (gate_in_type, report_at desc);
create index gate_in_orders_serial on public.gate_in_orders (container_serial text_pattern_ops);
create index gate_in_orders_no_prefix on public.gate_in_orders (container_no text_pattern_ops);

-- CẤP VỎ / XUẤT TÀU: OUT lúc, chưa OUT thì lúc lập lệnh
alter table public.gate_out_orders
  add column report_at timestamptz generated always as (coalesce(confirmed_at, created_at)) stored,
  add column container_serial text generated always as (substr(container_no, 5)) stored;
create index gate_out_orders_report on public.gate_out_orders (gate_out_type, report_at desc);
create index gate_out_orders_serial on public.gate_out_orders (container_serial text_pattern_ops);
create index gate_out_orders_no_prefix on public.gate_out_orders (container_no text_pattern_ops);

-- SỬA CHỮA (vệ sinh / báo giá dùng chung bảng): hoàn tất lúc, chưa xong thì lúc tạo
alter table public.work_orders
  add column report_at timestamptz generated always as (coalesce(completed_at, created_at)) stored,
  add column container_serial text generated always as (substr(container_no, 5)) stored;
create index work_orders_report on public.work_orders (category, report_at desc);
create index work_orders_serial on public.work_orders (container_serial text_pattern_ops);
create index work_orders_no_prefix on public.work_orders (container_no text_pattern_ops);

-- Tồn vỏ / hồ sơ: tìm theo đầu seri
alter table public.containers add column container_serial text generated always as (substr(container_no, 5)) stored;
create index containers_serial on public.containers (container_serial text_pattern_ops);

-- Cột Thanh toán / Mã phiếu thu của từng dòng báo cáo: giao dịch theo chứng từ
create index if not exists payment_transactions_voucher on public.payment_transactions (voucher_id) where voucher_id is not null;
