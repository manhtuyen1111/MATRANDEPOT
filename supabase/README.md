# Supabase — MATRAN DEPOT (Giai đoạn 4)

Thiết kế: `docs/DATABASE_SCHEMA.md`. **Agent chỉ viết file. Người dùng tự apply.** Không đưa khóa `service_role` vào frontend hay vào Git.

## Trạng thái các migration

| Bước | File | Nội dung | Trạng thái |
|---|---|---|---|
| 1 | `20261027000001` → `000005` | enum, nhân viên, danh mục, bộ đếm mã, nhật ký, chống bấm lặp, quyền, RPC Danh mục / nhân viên, RLS nền | **Đã chạy thử local 2026-10-27: apply OK, pgTAP 18/18** |
| 2 | `20261028000001` → `000002` | Bảng Hạ vỏ, lượt lưu bãi, K80, lịch sử vị trí (partition tháng), vệ sinh / báo giá / sửa chữa; RPC Giám định (W-SURVEY), giám định trên kệ, hạ vỏ, đảo chuyển, sửa vị trí, vệ sinh, báo giá 2 bước, sửa chữa, khóa, ghi chú | **Đã chạy thử local 2026-10-27: pgTAP 32/32** (cộng bước 1: 50/50). Văn phòng Hạ vỏ + GATE IN OK chuyển sang bước 3 (cần chứng từ) |
| 3 | `20261029000001` → `000002` | Văn phòng Hạ vỏ, chứng từ, thanh toán TT / TTS / TTR, chuyển khoản (callback + xác nhận tay), GATE IN OK, phiếu thu, in phiếu, phiếu thu trả trước, hóa đơn | **Đã chạy thử local 2026-10-27: pgTAP 57/57** (tổng 107/107) |
| 4 | `20261030000001` → `000002` | Booking, lệnh cấp vỏ, thanh toán cấp vỏ + K80, hủy lệnh (chưa thu tiền), xuất bãi 5 điều kiện; Nhập / Xuất tàu (lập / sửa / thêm / bỏ / xóa danh sách, Giám định nhập tàu, xuất tàu, duyệt khi chưa đủ, tự khóa DEC-131) | **Đã chạy thử local 2026-10-27: pgTAP 40/40** (tổng 147/147) |
| 5a | `20261031000001` | Lịch tự động (pg_cron): tạo partition trước 2 tháng, dọn request_log; kho ảnh riêng tư door-photos (Giám định tải lên, nhân viên xem); liệt kê / đánh dấu ảnh quá 24 tháng | **Đã chạy thử local 2026-10-27: pgTAP 11/11** (tổng 158/158) |
| 5b | — | Edge Function: admin tạo tài khoản / đặt lại mật khẩu, xóa file ảnh hết hạn | Chưa làm |
| — | — | Chuyển kho > 36 tháng | Làm khi có dữ liệu đủ 3 năm (2029) |
| — | — | Nhận báo có ngân hàng (callback) | Chờ Q-032 chọn ngân hàng; hiện Văn phòng xác nhận tay |

## Chạy thử trên máy (khuyên làm trước khi đưa lên Supabase thật)

Cần Docker Desktop. Agent sẽ hỏi trước khi cài bất cứ gì.

```bash
npx supabase start          # dựng Supabase local bằng Docker
npx supabase db reset       # chạy toàn bộ migration + seed.sql
npx supabase test db        # chạy test pgTAP trong supabase/tests/
```

## Đưa lên project thật (bạn tự làm)

1. Tạo project trên supabase.com, vùng **Singapore**. Làm cho đủ 3 project: dev, staging, production. Bật PITR cho production (DEC-152).
2. **Authentication → Providers → Email:**
   - tắt "Confirm email";
   - độ dài mật khẩu tối thiểu giữ **6** (giới hạn của Supabase). App tự ghép chuỗi cố định để nhân viên đặt mật khẩu ngắn hơn được (DEC-153).
3. Apply migration theo thứ tự tên file:
   - dùng `npx supabase link` rồi `npx supabase db push`;
   - hoặc dán từng file vào SQL Editor.
4. **Tạo Admin đầu tiên:**
   - Vào **Authentication → Users → Add user**: email `admin@matrandepot.local`, đặt mật khẩu.
   - Copy `id` của user vừa tạo, rồi chạy trong SQL Editor (thay `<id>`):

     ```sql
     insert into public.staff (id, staff_code, username, full_name, must_change_password)
     values ('<id>', 'NV001', 'admin', 'Quản trị hệ thống', false);
     insert into public.staff_roles (staff_id, role) values ('<id>', 'ADMIN');
     ```
5. Từ đó Admin tạo nhân viên khác trên app. Việc tạo nhân viên đi qua Edge Function `admin_create_staff`, sẽ viết ở bước sau.

## Lưu ý

- Migration nào đã apply ở bất kỳ môi trường nào thì **không sửa nữa**; thay đổi viết thành file mới.
- Các file bước 1 chưa apply ở đâu, nên còn sửa được.
- **Đăng nhập:** tên đăng nhập `tuan.lv` ứng với email `tuan.lv@matrandepot.local` (DEC-151).
