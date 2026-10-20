# DATABASE DESIGN PLAN — MATRAN DEPOT

## 1. Mục tiêu

Thiết kế database PostgreSQL cho hệ thống ERP quản lý bãi container rỗng.

Database phải hỗ trợ toàn bộ nghiệp vụ đã xác định, bảo đảm tính toàn vẹn dữ liệu, phân quyền, lịch sử và khả năng mở rộng.

## 2. Nguyên tắc

- Chưa tạo bảng chính thức khi các quy tắc nghiệp vụ liên quan còn chưa rõ.
- Không tự suy đoán tên bảng, cột hoặc trạng thái.
- Mỗi container có một vị trí hiện tại tại một thời điểm khi đang ở trong bãi.
- Lịch sử nhập, xuất, di chuyển và thay đổi trạng thái phải được lưu.
- Các thao tác có thể gây ghi trùng hoặc tranh chấp phải được xử lý an toàn phía database/backend.
- Thiết kế thanh toán phải hỗ trợ thanh toán thủ công, tích hợp API, đối soát và hoàn tiền.
- Phân quyền phải được kiểm soát phía backend/database.
- Mọi thay đổi cấu trúc database phải được quản lý bằng migration.

## 3. Thứ tự thiết kế

### Giai đoạn 1 — Xác nhận nghiệp vụ
- Chốt loại Gate In và Gate Out.
- Chốt mô hình vị trí bãi.
- Chốt trạng thái container và các lượt nghiệp vụ.
- Chốt quy tắc booking và cấp container.
- Chốt điều kiện thu phí, thanh toán và hủy nghiệp vụ.
- Chốt vai trò và quyền truy cập.

### Giai đoạn 2 — Thiết kế mô hình dữ liệu
- Xác định các thực thể nghiệp vụ.
- Xác định quan hệ giữa các thực thể.
- Xác định khóa chính, khóa ngoại và ràng buộc.
- Xác định quy tắc duy nhất và chống ghi trùng.
- Xác định lịch sử và nhật ký kiểm toán.

### Giai đoạn 3 — Thiết kế bảo mật
- Xác định cách liên kết tài khoản với nhân viên.
- Xác định quyền theo vai trò và nghiệp vụ.
- Thiết kế Row Level Security (RLS).
- Kiểm thử quyền truy cập hợp lệ và trái phép.

### Giai đoạn 4 — Triển khai database
- Thiết lập môi trường phát triển Supabase.
- Tạo migration theo thứ tự phụ thuộc.
- Tạo khóa, ràng buộc và index.
- Tạo hàm database khi thực sự cần.
- Kiểm thử trên dữ liệu mẫu.

### Giai đoạn 5 — Nghiệm thu
- Kiểm tra các quy trình nghiệp vụ đầu-cuối.
- Kiểm tra giao dịch đồng thời.
- Kiểm tra phân quyền.
- Kiểm tra thanh toán và đối soát.
- Kiểm tra phương án sao lưu và khôi phục.

## 4. Điều kiện bắt đầu viết SQL

Chỉ bắt đầu tạo schema chính thức khi:
- Các quyết định ảnh hưởng trực tiếp đến cấu trúc dữ liệu đã được xác nhận.
- Các câu hỏi nghiệp vụ quan trọng đã được giải quyết hoặc có phương án tạm thời được chấp thuận.
- Mô hình dữ liệu đã được rà soát.
- Đã xác định môi trường database dùng để phát triển và kiểm thử.

## 5. Trạng thái hiện tại

Đang ở giai đoạn chuẩn bị và xác nhận nghiệp vụ.

Chưa coi schema PostgreSQL hoặc migration nào là chính thức.