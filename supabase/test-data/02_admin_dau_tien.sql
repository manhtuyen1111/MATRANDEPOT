-- ============================================================================
-- TẠO ADMIN ĐẦU TIÊN (chạy 1 lần cho mỗi project — test hoặc production).
-- Bước 1 (trang Supabase): Authentication → Users → Add user → Create new user
--   Email:    admin@matrandepot.local
--   Password: <mật khẩu bạn chọn>::matran     ← BẮT BUỘC thêm "::matran" ở cuối (DEC-153)
--             VD chọn 123456 → gõ 123456::matran. Trên app chỉ gõ 123456.
--   Tích "Auto Confirm User".
-- Bước 2: SQL Editor → dán file này → Run. Không cần copy id.
-- Bước 3: mở app → đăng nhập tên "admin" + mật khẩu bạn chọn (không gõ ::matran).
--   Từ đây Admin tạo nhân viên khác trên app (User - Role).
-- ============================================================================
insert into public.staff (id, staff_code, username, full_name, must_change_password)
select id, 'NV001', 'admin', 'Quản trị hệ thống', false
from auth.users where email = 'admin@matrandepot.local'
on conflict (id) do nothing;

insert into public.staff_roles (staff_id, role)
select id, 'ADMIN' from auth.users where email = 'admin@matrandepot.local'
on conflict do nothing;

-- Kiểm tra: phải ra 1 dòng "admin | ADMIN". Ra 0 dòng → chưa làm Bước 1 hoặc gõ sai email.
select s.username, r.role from public.staff s join public.staff_roles r on r.staff_id = s.id where s.username = 'admin';
