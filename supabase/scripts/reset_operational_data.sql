-- ============================================================================
-- MATRAN DEPOT — XÓA DỮ LIỆU TÁC NGHIỆP (reset về ban đầu, giữ tài khoản + Danh mục)
-- Người dùng yêu cầu 2026-11-02. KHÔNG phải migration — chỉ chạy tay khi muốn làm sạch dữ liệu thử.
--
-- CÁCH CHẠY: Supabase Dashboard → đúng project → SQL Editor → dán toàn bộ file → Run.
-- ⚠ XÓA VĨNH VIỄN, không khôi phục được (trừ bản sao lưu / PITR). Kiểm tra đúng project trước khi chạy.
--
-- XÓA: Hạ vỏ, Cấp vỏ (lệnh + booking), lượt lưu bãi + lịch sử vị trí, phiếu K80, chứng từ / chi phí,
--      giao dịch, phiếu thu (trực tiếp + trả trước + trừ trả trước + lần in), yêu cầu xuất hóa đơn,
--      Nhập / Xuất tàu, Báo giá / Sửa chữa / Vệ sinh (work orders), nhật ký, góp ý, chống bấm lặp, đồng bộ xóa,
--      bộ đếm mã (HV- / CV- / NT- / XT- / PT- / GY- đánh số lại từ 0001).
-- GIỮ: nhân viên + vai trò + quyền, công ty, hãng tàu / khách hàng, biểu giá, Size / Type / ISO, Block,
--      Phân loại, tổ / bậc thợ sửa chữa, cài đặt giờ công, ngưỡng database.
-- ẢNH: script này không xóa file ảnh — làm ở Dashboard → Storage (xem cuối file).
--
-- Không dùng CASCADE: nếu một bảng giữ lại còn trỏ tới bảng bị xóa, lệnh sẽ báo lỗi và KHÔNG xóa gì (an toàn).
-- ============================================================================
begin;

truncate table
  public.receipt_prints,
  public.invoice_group_items,
  public.invoice_groups,
  public.prepaid_deductions,
  public.payment_receipts,
  public.payment_transactions,
  public.fee_lines,
  public.vouchers,
  public.prepaid_receipts,
  public.work_order_members,
  public.work_orders,
  public.k80_tickets,
  public.location_history,
  public.vessel_list_items,
  public.vessel_lists,
  public.gate_out_orders,
  public.release_bookings,
  public.containers,
  public.gate_in_orders,
  public.feedbacks,
  public.audit_logs,
  public.request_log,
  public.sync_deletions,
  public.code_counters
restart identity;

commit;

-- KIỂM TRA SAU KHI CHẠY (tất cả phải = 0; nhân viên / hãng tàu phải > 0):
select 'Hạ vỏ' as bang, count(*) from public.gate_in_orders
union all select 'Lượt lưu bãi', count(*) from public.containers
union all select 'Cấp vỏ', count(*) from public.gate_out_orders
union all select 'Phiếu thu', count(*) from public.payment_receipts
union all select 'Nhật ký', count(*) from public.audit_logs
union all select '(giữ) Nhân viên', count(*) from public.staff
union all select '(giữ) Hãng tàu / khách', count(*) from public.partners;

-- XÓA ẢNH (làm tay ở Dashboard, Supabase không cho xóa file ảnh bằng SQL):
--   Storage → bucket "door-photos" → menu ⋯ → Empty bucket → xác nhận
--   Storage → bucket "repair-photos" → menu ⋯ → Empty bucket → xác nhận
--   (door-photos gồm ảnh cửa cont, ảnh eEIR, ảnh cấp vỏ; repair-photos là ảnh sửa chữa hoàn thành)
