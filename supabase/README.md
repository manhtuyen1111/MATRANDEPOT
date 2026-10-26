# Supabase — MATRAN DEPOT (Giai đoạn 4)

Thiết kế: `docs/DATABASE_SCHEMA.md`. **Agent chỉ viết file. Người dùng tự apply.** Không đưa khóa `service_role` vào frontend hay vào Git.

## Trạng thái các migration

| Bước | File | Nội dung | Trạng thái |
|---|---|---|---|
| 1 | `20261027000001` → `000005` | enum, nhân viên, danh mục, bộ đếm mã, nhật ký, chống bấm lặp, quyền, RPC Danh mục / nhân viên, RLS nền | **Đã viết, chưa chạy thử** |
| 2 | — | Hạ vỏ, lượt lưu bãi, K80, vị trí, vệ sinh / báo giá / sửa chữa, W-SURVEY | Chưa làm |
| 3 | — | Thanh toán, phiếu thu, trả trước, hóa đơn | Chưa làm |
| 4 | — | Cấp vỏ, booking, Nhập / Xuất tàu | Chưa làm |
| 5 | — | lịch partition nhật ký, xóa ảnh hết hạn, chuyển kho, chỉ mục báo cáo | Chưa làm |

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
   - đặt độ dài mật khẩu tối thiểu = 1 (DEC-143: bao nhiêu ký tự cũng được).
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
