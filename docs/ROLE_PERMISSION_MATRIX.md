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
| ~~GATE_STAFF~~ | (Đã bỏ — DEC-047) | Gộp vào INSPECTOR |
| ~~YARD_STAFF~~ | (Đã bỏ — DEC-047) | Gộp vào INSPECTOR |
| FORKLIFT | Nhân viên xe nâng | Nhận lệnh và xác nhận thao tác di chuyển container |
| CLEANING | Nhân viên vệ sinh | Thực hiện và cập nhật kết quả vệ sinh |
| INSPECTOR | Nhân viên giám định | Giám định Hạ vỏ (chụp ảnh, phân loại, vệ sinh, AGE) |
| QUOTATION | Bộ phận Báo giá | Báo giá container DAMAGE (DEC-026) — bổ sung 2026-10-22 |
| ~~REPAIR_QC~~ | (Đã bỏ — DEC-049) | Gộp vào REPAIR_STAFF |
| REPAIR_STAFF | Nhân viên sửa chữa | Thực hiện và cập nhật công việc M&R |
| ~~ACCOUNTANT~~ | (Đã bỏ — DEC-047) | Quyền chuyển sang OFFICE |

## 2A. Quyền thao tác đang áp dụng trong code (2026-10-22)

Nguồn duy nhất trong code: `src/services/permissions.ts` (`PERMISSIONS`, `MENU_ACCESS`). `ADMIN` có toàn quyền. Ở chế độ Supabase, cùng ma trận này phải được kiểm tra trong RPC/RLS.

| Thao tác | Vai trò được phép | Căn cứ |
|---|---|---|
| Giám định Hạ vỏ | INSPECTOR, MANAGER | DEC-020 |
| Xóa hồ sơ hạ vỏ (Văn phòng chưa thao tác) | INSPECTOR, MANAGER | DEC-059 |
| Văn phòng Hạ vỏ (bổ sung hồ sơ, lập chi phí) | OFFICE, MANAGER | DEC-022 |
| Xác nhận thanh toán Hạ vỏ / Cấp vỏ | OFFICE, MANAGER | DEC-004, DEC-047 |
| Hoàn tất vệ sinh | CLEANING, OFFICE | DEC-035 |
| Xe nâng hạ vỏ, đảo chuyển | FORKLIFT, OFFICE, MANAGER | DEC-035, DEC-036 |
| Báo giá (remark + giờ công) | QUOTATION | DEC-026, DEC-035, DEC-041 |
| Hoàn tất sửa chữa (chọn tổ + nhân viên) | REPAIR_STAFF | DEC-035, DEC-043 |
| Thêm user Sửa chữa vào tổ | ADMIN | DEC-048 |
| Sửa vị trí hành chính | OFFICE, MANAGER | DEC-036 |
| Khóa / mở khóa container | OFFICE, MANAGER | DEC-017, DEC-030 |
| Ghi chú tồn vỏ | OFFICE, MANAGER | DEC-029 |
| Lập / hủy lệnh cấp vỏ | OFFICE, MANAGER | DEC-033 |
| Xe nâng xác nhận OUT | FORKLIFT, OFFICE, MANAGER | DEC-015 |
| Xem PHIẾU THU | OFFICE, MANAGER | DEC-032, DEC-047 |
| Tạo phiếu thu TTT, xác nhận tiền mặt TTT | OFFICE | DEC-047 |
| Báo cáo Tổng hợp, cột chi phí trong báo cáo | OFFICE, MANAGER | Mục 5 (dữ liệu tài chính) |
| Giả lập ngân hàng (chỉ Demo) | OFFICE, MANAGER | DEC-039 |
| Cấu hình Danh mục chung (kể cả tổ sửa chữa, công ty) | ADMIN | DEC-028, DEC-042, DEC-062 |
| In / in lại phiếu thu (đếm số lần in) | OFFICE, MANAGER | DEC-063 |
| Khóa / mở khóa, ghi chú hàng loạt ở Tồn vỏ | OFFICE, MANAGER | DEC-067 |
| Lập / sửa thông tin / thêm cont / bỏ cont chờ / xóa (chưa tác nghiệp) / duyệt danh sách NHẬP TÀU, XUẤT TÀU — chỉ khi chưa duyệt | OFFICE, MANAGER (`VESSEL_LIST_MANAGE`) | DEC-069, DEC-070 |
| Giám định NHẬP TÀU (xác nhận cont về) | INSPECTOR, MANAGER (`VESSEL_IMPORT_INSPECT`) | DEC-069 |
| Tác nghiệp XUẤT TÀU (gán xe, OUT) | INSPECTOR, FORKLIFT, MANAGER (`VESSEL_EXPORT_EXECUTE`) | DEC-069 |
| Vệ sinh / Xe nâng hạ cont NHẬP TÀU | như Chờ vệ sinh / Chờ hạ vỏ (`CLEANING_COMPLETE`, `FORKLIFT_OPS`) | DEC-069 |
| Menu: Giám định → Nhập tàu, Xuất tàu; Xe nâng → Nhập tàu, Xuất tàu (mobile). Vệ sinh không có menu Nhập tàu (dùng Chờ vệ sinh) | theo `MENU_ACCESS` | DEC-069, DEC-070 |
| Quản lý User - Phân quyền | ADMIN | DEC-045 |
| Hiển thị menu | Theo `MENU_ACCESS`: mỗi vai trò chỉ thấy màn của mình | DEC-045 |

## 3. Quy ước quyền

- VIEW: Xem dữ liệu.
- CREATE: Tạo bản ghi hoặc yêu cầu.
- UPDATE: Sửa dữ liệu trong phạm vi được phép.
- CONFIRM: Xác nhận một bước nghiệp vụ.
- APPROVE: Phê duyệt theo thẩm quyền.
- CANCEL: Hủy nghiệp vụ theo quy trình.
- MANAGE: Quản lý cấu hình hoặc tài nguyên được giao.

Có quyền xem không đồng nghĩa với có quyền sửa hoặc xác nhận.

## 4. Ma trận quyền dự kiến (bản tham khảo ban đầu — đã được thay bởi mục 2A và DEC-045, DEC-047)

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

- Danh sách vai trò: 11 vai trò đã xác nhận (DEC-017, DEC-026).
- Quyền thao tác: mục 2A đã áp dụng ở tầng nghiệp vụ chế độ Demo; ma trận mục 4 vẫn là bản tham khảo cho các phân hệ chưa làm.
- Quy tắc phân tách nhiệm vụ: không tách người làm / người duyệt cho Vệ sinh, Xe nâng, Báo giá, Sửa chữa (DEC-035); các thao tác khác chưa chốt.
- Cấu hình RLS và quyền backend Supabase: chưa triển khai (migration 0001 là bản nháp, sẽ viết lại).
