# MATRAN DEPOT — MASTER SPEC

## 1. Mục tiêu

Xây dựng hệ thống ERP quản lý toàn bộ hoạt động bãi container rỗng, từ tiếp nhận, lưu bãi, vệ sinh, giám định, sửa chữa đến cấp container và xuất bãi.

## 2. Phạm vi hệ thống

- Đăng nhập, nhân sự và phân quyền.
- Quản lý khách hàng, hãng tàu và đối tác.
- Booking và cấp container.
- Gate In và Gate Out.
- Quản lý tồn bãi, vị trí và lịch sử container.
- Điều phối và quản lý công việc xe nâng.
- Vệ sinh container.
- Giám định và sửa chữa M&R.
- Quản lý phí dịch vụ, thanh toán, hoàn tiền và đối soát.
- Báo cáo, nhật ký và quản trị hệ thống.

## 3. Nguyên tắc nghiệp vụ

- Phạm vi hiện tại chỉ bao gồm container rỗng.
- Container chủ yếu thuộc khách hàng hoặc hãng tàu.
- Chủ sở hữu, bên yêu cầu dịch vụ và bên trả phí có thể khác nhau.
- Phí được tính theo từng dịch vụ và lượt nghiệp vụ.
- Mỗi container đang nằm trong bãi chỉ có một vị trí hiện tại.
- Lưu lịch sử thay đổi vị trí, trạng thái và các nghiệp vụ quan trọng.
- Ngăn cấp trùng container và xử lý trùng giao dịch thanh toán.
- Kiểm tra quyền ở backend, không chỉ ở giao diện.
- Gate In phải thanh toán phí trước khi hoàn tất.
- Không xóa lịch sử nghiệp vụ để thay đổi trạng thái hiện tại.

## 4. Công nghệ dự kiến

- Frontend: React + TypeScript + Vite.
- Giao diện: responsive, hỗ trợ PWA.
- Backend: Supabase.
- Database: PostgreSQL.
- Xác thực: Supabase Auth.
- Phân quyền dữ liệu: PostgreSQL Row Level Security (RLS).
- Quản lý mã nguồn: Git và GitHub.
- Thay đổi database được quản lý bằng migration.

## 5. Quy tắc phát triển

- Xác định nghiệp vụ tổng thể trước khi thiết kế database.
- Mỗi lần thực hiện một file hoặc một nhiệm vụ rõ ràng.
- Không tự suy đoán quy tắc nghiệp vụ chưa được xác nhận.
- Mọi thay đổi database phải có migration.
- Kiểm thử từng quy trình từ giao diện đến database.
- Chỉ đưa hệ thống vào vận hành khi toàn bộ phạm vi bắt buộc đã được nghiệm thu.

## 6. Trạng thái đặc tả

- Phạm vi sản phẩm: đã xác định ở mức tổng thể.
- Danh mục loại Gate In: chưa chốt.
- Mô hình vị trí bãi: chưa chốt.
- Ma trận phân quyền: chưa chốt.
- Quy tắc chi tiết các trạng thái: chưa chốt.
- Chính sách phí từng dịch vụ: chưa chốt.
