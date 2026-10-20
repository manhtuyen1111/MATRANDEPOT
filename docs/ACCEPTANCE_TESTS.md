# MATRAN DEPOT — ACCEPTANCE TESTS

## 1. Mục đích

Danh sách kiểm thử nghiệm thu nghiệp vụ và kỹ thuật cho ERP MATRAN DEPOT.

Mỗi bài kiểm thử phải có dữ liệu đầu vào, thao tác, kết quả mong đợi và kết quả thực tế.

## 2. Quy ước kết quả

- NOT_RUN: Chưa chạy.
- PASS: Đạt yêu cầu.
- FAIL: Không đạt yêu cầu.
- BLOCKED: Chưa thể kiểm thử do phụ thuộc chưa sẵn sàng.

Không đánh dấu PASS nếu chưa thực hiện kiểm thử và xác minh kết quả.

## 3. Xác thực và phân quyền

### AUTH-001 — Người dùng đăng nhập hợp lệ
- Thao tác: Đăng nhập bằng tài khoản hợp lệ.
- Mong đợi: Truy cập được các chức năng thuộc quyền.

### AUTH-002 — Người chưa đăng nhập
- Thao tác: Truy cập dữ liệu nội bộ khi chưa xác thực.
- Mong đợi: Bị từ chối truy cập.

### AUTH-003 — Người dùng không đủ quyền
- Thao tác: Gọi trực tiếp thao tác backend ngoài quyền được cấp.
- Mong đợi: Backend hoặc database từ chối thao tác.

### AUTH-004 — Tài khoản bị vô hiệu hóa
- Thao tác: Tài khoản không còn hoạt động gửi yêu cầu nghiệp vụ.
- Mong đợi: Không được thực hiện thao tác trái chính sách.

## 4. Gate In

### GIN-001 — Tiếp nhận hợp lệ
- Thao tác: Tạo lượt Gate In với dữ liệu hợp lệ.
- Mong đợi: Tạo được lượt tiếp nhận và mã nghiệp vụ duy nhất.

### GIN-002 — Chụp và lưu ảnh
- Thao tác: Nhân viên hiện trường tải ảnh cửa container lên.
- Mong đợi: Ảnh được lưu và liên kết đúng lượt Gate In.

### GIN-003 — Văn phòng kiểm tra hồ sơ
- Thao tác: Văn phòng mở lượt Gate In và kiểm tra thông tin.
- Mong đợi: Xem đúng thông tin và thực hiện được bước thuộc quyền.

### GIN-004 — Chưa thanh toán
- Thao tác: Thử hoàn tất Gate In khi phí bắt buộc chưa thanh toán.
- Mong đợi: Không được hoàn tất.

### GIN-005 — Thanh toán hợp lệ
- Thao tác: Xác nhận khoản phí đã thanh toán thành công.
- Mong đợi: Có thể tiếp tục hoàn tất khi các điều kiện khác đều hợp lệ.

### GIN-006 — Gửi yêu cầu trùng
- Thao tác: Gửi lặp cùng yêu cầu tạo hoặc xác nhận Gate In.
- Mong đợi: Không tạo dữ liệu trùng ngoài quy tắc nghiệp vụ.

### GIN-007 — Hủy hoặc từ chối
- Thao tác: Hủy lượt theo đúng quyền và điều kiện.
- Mong đợi: Lưu trạng thái, người thực hiện, thời điểm và lý do.

## 5. Tồn bãi và vị trí

### YARD-001 — Ghi nhận vị trí hiện tại
- Thao tác: Đưa container vào vị trí hợp lệ.
- Mong đợi: Container có đúng một vị trí hiện tại.

### YARD-002 — Di chuyển container
- Thao tác: Xác nhận di chuyển từ vị trí A sang B.
- Mong đợi: Vị trí hiện tại là B và lịch sử ghi nhận việc di chuyển.

### YARD-003 — Vị trí đích không hợp lệ
- Thao tác: Chuyển container tới vị trí không hợp lệ hoặc không khả dụng.
- Mong đợi: Thao tác bị từ chối.

### YARD-004 — Hai thao tác đồng thời
- Thao tác: Hai người cùng cố gắng thay đổi vị trí của một container.
- Mong đợi: Dữ liệu cuối cùng nhất quán; không phát sinh hai vị trí hiện tại.

## 6. Booking và cấp container

### REL-001 — Cấp container hợp lệ
- Thao tác: Chọn container đủ điều kiện và xác nhận gắn với lượt cấp.
- Mong đợi: Container được phân bổ cho đúng lượt cấp.

### REL-002 — Ngăn cấp trùng
- Thao tác: Hai booking đồng thời yêu cầu cùng một container.
- Mong đợi: Không thể xác nhận cả hai lượt cấp cùng sử dụng container đó.

### REL-003 — Đổi container
- Thao tác: Đổi container đã phân bổ theo quy trình được phép.
- Mong đợi: Phân bổ cũ và mới được cập nhật nhất quán.

### REL-004 — Hủy lượt cấp
- Thao tác: Hủy lượt cấp hợp lệ.
- Mong đợi: Lưu lịch sử và giải phóng phân bổ theo chính sách.

## 7. Gate Out

### GOUT-001 — Xuất bãi hợp lệ
- Thao tác: Hoàn tất xuất container khi đủ điều kiện.
- Mong đợi: Lưu thời điểm xuất và cập nhật tồn bãi.

### GOUT-002 — Chưa đủ điều kiện
- Thao tác: Xuất container chưa đáp ứng điều kiện bắt buộc.
- Mong đợi: Không được hoàn tất Gate Out.

### GOUT-003 — Xuất trùng
- Thao tác: Hai người đồng thời xác nhận xuất cùng container.
- Mong đợi: Chỉ một thao tác hợp lệ được ghi nhận.

### GOUT-004 — Kiểm tra lịch sử
- Thao tác: Tra cứu container đã xuất.
- Mong đợi: Xem được lịch sử nhập, xuất và vị trí trước đó.

## 8. Vệ sinh, giám định và M&R

### SRV-001 — Tạo và phân công công việc
- Thao tác: Tạo yêu cầu dịch vụ và giao cho nhân viên.
- Mong đợi: Công việc liên kết đúng container và người thực hiện.

### SRV-002 — Hoàn thành vệ sinh
- Thao tác: Nhân viên ghi nhận kết quả vệ sinh.
- Mong đợi: Lưu đúng kết quả và lịch sử.

### SRV-003 — Giám định
- Thao tác: Ghi nhận tình trạng container và hình ảnh.
- Mong đợi: Kết quả liên kết đúng lượt giám định.

### SRV-004 — Phê duyệt sửa chữa
- Thao tác: Thử thực hiện bước yêu cầu phê duyệt khi chưa được duyệt.
- Mong đợi: Không được vượt qua điều kiện phê duyệt bắt buộc.

### SRV-005 — Nghiệm thu sửa chữa
- Thao tác: Hoàn tất và nghiệm thu công việc hợp lệ.
- Mong đợi: Lưu kết quả, người xác nhận và lịch sử.

## 9. Thanh toán và đối soát

### PAY-001 — Tạo khoản phải thu
- Thao tác: Ghi nhận phí cho một dịch vụ.
- Mong đợi: Khoản phải thu liên kết đúng dịch vụ và bên chịu phí.

### PAY-002 — Thanh toán thủ công
- Thao tác: Nhân viên có quyền ghi nhận thanh toán.
- Mong đợi: Lưu số tiền, phương thức, người ghi nhận và chứng từ theo quy định.

### PAY-003 — Thanh toán thất bại
- Thao tác: Nhà cung cấp báo giao dịch thất bại.
- Mong đợi: Không đánh dấu khoản tiền là đã nhận.

### PAY-004 — Webhook gửi lặp
- Thao tác: Gửi lại cùng sự kiện thanh toán.
- Mong đợi: Không ghi nhận thanh toán hai lần.

### PAY-005 — Webhook không hợp lệ
- Thao tác: Gửi thông báo không xác minh được.
- Mong đợi: Không được phép cập nhật giao dịch thành công.

### PAY-006 — Đối soát
- Thao tác: Đối chiếu giao dịch với khoản phải thu.
- Mong đợi: Hiển thị đúng trạng thái khớp, thiếu, thừa hoặc chưa xác định theo quy tắc.

### PAY-007 — Hoàn tiền
- Thao tác: Thực hiện hoàn tiền theo quy trình được cấp quyền.
- Mong đợi: Lưu giao dịch hoàn tiền và lịch sử liên quan.

## 10. Nhật ký và bảo mật

### AUD-001 — Ghi nhận thao tác
- Thao tác: Thực hiện một nghiệp vụ quan trọng.
- Mong đợi: Có thông tin người thực hiện, thời điểm và đối tượng liên quan.

### AUD-002 — Không cho sửa nhật ký trái phép
- Thao tác: Người dùng thông thường cố sửa hoặc xóa nhật ký.
- Mong đợi: Bị từ chối.

### AUD-003 — Truy cập ảnh trái phép
- Thao tác: Người không có quyền truy cập ảnh nghiệp vụ.
- Mong đợi: Không đọc được ảnh bị hạn chế.

## 11. Kiểm thử tích hợp và vận hành

### SYS-001 — Mất kết nối khi cập nhật
- Thao tác: Mô phỏng mất kết nối trong quá trình xử lý.
- Mong đợi: Có thể tra cứu trạng thái và không tạo dữ liệu trùng khi thử lại.

### SYS-002 — Kiểm tra migration
- Thao tác: Triển khai migration trên môi trường kiểm thử sạch.
- Mong đợi: Database được tạo đúng phiên bản và các ràng buộc hoạt động.

### SYS-003 — Kiểm tra phục hồi
- Thao tác: Thực hiện quy trình phục hồi dữ liệu đã được thiết lập.
- Mong đợi: Dữ liệu được khôi phục theo mục tiêu phục hồi đã phê duyệt.

### SYS-004 — Kiểm thử luồng hoàn chỉnh
- Thao tác: Chạy quy trình từ Gate In, lưu bãi, dịch vụ đến cấp và Gate Out.
- Mong đợi: Dữ liệu, trạng thái, vị trí, phí và lịch sử nhất quán.

## 12. Điều kiện nghiệm thu

- Tất cả bài kiểm thử bắt buộc phải có kết quả thực tế.
- Không còn lỗi nghiêm trọng hoặc lỗi bảo mật chưa xử lý.
- Các trường hợp đồng thời và gửi yêu cầu lặp phải được kiểm thử.
- Phân quyền phải được kiểm thử trực tiếp ở backend/database.
- Quy trình nghiệp vụ phải được người phụ trách xác nhận.
- Phải kiểm thử trên môi trường riêng trước khi vận hành thật.

## 13. Trạng thái

- Danh sách kiểm thử ban đầu: đã tạo.
- Kết quả chạy thực tế: chưa có.
- Người nghiệm thu và ngày nghiệm thu: chưa xác định.
