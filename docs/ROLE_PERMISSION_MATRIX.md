# MATRAN DEPOT — ROLE & PERMISSION MATRIX

## 1. Mục đích

Xác định vai trò nhân sự và nguyên tắc phân quyền cho toàn bộ ERP MATRAN DEPOT.

Đây là bản phân quyền dự kiến. Quyền chính thức phải được người phụ trách nghiệp vụ xác nhận trước khi triển khai.

## 2. Danh sách vai trò dự kiến

| Mã vai trò | Tên vai trò | Phạm vi công việc |
|---|---|---|
| ADMIN | Quản trị hệ thống | Cấu hình, tài khoản, phân quyền và quản trị kỹ thuật |
| MANAGER | Quản lý bãi | Giám sát vận hành, xử lý ngoại lệ và phê duyệt theo thẩm quyền |
| OFFICE | Nhân viên văn phòng | Hồ sơ container, booking và điều phối nghiệp vụ |
| GATE_STAFF | Nhân viên cổng | Tiếp nhận, kiểm tra và xác nhận các bước tại cổng |
| YARD_STAFF | Nhân viên hiện trường | Chụp ảnh, kiểm tra và xác nhận công việc tại bãi |
| FORKLIFT | Nhân viên xe nâng | Nhận lệnh và xác nhận thao tác di chuyển container |
| CLEANING | Nhân viên vệ sinh | Thực hiện và cập nhật kết quả vệ sinh |
| INSPECTOR | Nhân viên giám định | Kiểm tra tình trạng và lập kết quả giám định |
| REPAIR_STAFF | Nhân viên sửa chữa | Thực hiện và cập nhật công việc M&R |
| ACCOUNTANT | Nhân viên kế toán | Phí, khoản phải thu, thanh toán và đối soát |

## 3. Quy ước quyền

- VIEW: Xem dữ liệu.
- CREATE: Tạo bản ghi hoặc yêu cầu.
- UPDATE: Sửa dữ liệu trong phạm vi được phép.
- CONFIRM: Xác nhận một bước nghiệp vụ.
- APPROVE: Phê duyệt theo thẩm quyền.
- CANCEL: Hủy nghiệp vụ theo quy trình.
- MANAGE: Quản lý cấu hình hoặc tài nguyên được giao.

Có quyền xem không đồng nghĩa với có quyền sửa hoặc xác nhận.

## 4. Ma trận quyền dự kiến

| Nghiệp vụ | ADMIN | MANAGER | OFFICE | GATE_STAFF | YARD_STAFF | FORKLIFT | CLEANING | INSPECTOR | REPAIR_STAFF | ACCOUNTANT |
|---|---|---|---|---|---|---|---|---|---|---|
| Quản lý tài khoản, quyền | MANAGE | VIEW | - | - | - | - | - | - | - | - |
| Danh mục và cấu hình bãi | MANAGE | APPROVE | VIEW | - | VIEW | VIEW | - | - | - | - |
| Hồ sơ container | MANAGE | VIEW | UPDATE | VIEW | UPDATE | VIEW | VIEW | VIEW | VIEW | VIEW |
| Gate In | MANAGE | APPROVE | UPDATE | CONFIRM | CONFIRM | - | - | - | - | VIEW |
| Tồn bãi và vị trí | MANAGE | APPROVE | VIEW | VIEW | UPDATE | CONFIRM | - | VIEW | VIEW | - |
| Booking và cấp container | MANAGE | APPROVE | UPDATE | VIEW | VIEW | VIEW | - | - | - | VIEW |
| Vệ sinh | MANAGE | APPROVE | VIEW | - | VIEW | - | UPDATE | VIEW | - | VIEW |
| Giám định | MANAGE | APPROVE | VIEW | - | VIEW | - | - | UPDATE | VIEW | VIEW |
| Sửa chữa M&R | MANAGE | APPROVE | VIEW | - | VIEW | - | - | VIEW | UPDATE | VIEW |
| Gate Out | MANAGE | APPROVE | UPDATE | CONFIRM | CONFIRM | CONFIRM | - | - | - | VIEW |
| Phí và khoản phải thu | MANAGE | VIEW | VIEW | - | - | - | - | - | - | UPDATE |
| Thanh toán và đối soát | MANAGE | VIEW | VIEW | - | - | - | - | - | - | UPDATE |
| Báo cáo vận hành | MANAGE | VIEW | VIEW | VIEW | VIEW | VIEW | VIEW | VIEW | VIEW | VIEW |
| Nhật ký kiểm toán | MANAGE | VIEW | - | - | - | - | - | - | - | - |

Dấu `-` nghĩa là chưa đề xuất cấp quyền.

Ma trận trên là bản nháp để thảo luận, không phải cấu hình quyền có thể đưa thẳng vào production.

## 5. Nguyên tắc bảo mật

- Mặc định không cấp quyền nếu chưa được phê duyệt.
- Mỗi người dùng phải được xác thực.
- Phân quyền được kiểm tra tại backend và database.
- Dữ liệu nhạy cảm về tài chính chỉ hiển thị cho người có thẩm quyền.
- Nhân viên chỉ được xác nhận công việc thuộc phạm vi được giao.
- Không cho phép tự phê duyệt giao dịch nếu quy trình yêu cầu người phê duyệt khác.
- Không cho phép sửa hoặc xóa nhật ký kiểm toán thông qua giao diện thông thường.
- Các hành động quan trọng phải lưu người thực hiện và thời điểm thực hiện.

## 6. Các quyết định cần xác nhận

- Có cần tách người tạo và người phê duyệt không?
- Nhân viên văn phòng có được sửa số container sau khi Gate In xác nhận không?
- Ai được xác nhận thanh toán thủ công?
- Ai được hủy Gate In hoặc Gate Out?
- Ai được điều chỉnh vị trí container ngoài quy trình xe nâng?
- Ai được duyệt dự toán và nghiệm thu sửa chữa?
- Quản lý có được quyền xem và điều chỉnh toàn bộ dữ liệu tài chính không?

## 7. Trạng thái

- Danh sách vai trò: dự kiến.
- Ma trận quyền: dự kiến.
- Quy tắc phân tách nhiệm vụ: chưa chốt.
- Cấu hình RLS và quyền backend: chưa triển khai.
