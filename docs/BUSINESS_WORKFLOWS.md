# MATRAN DEPOT — BUSINESS WORKFLOWS

## 1. Mục đích

Mô tả các quy trình vận hành bãi container rỗng. Đây là tài liệu nghiệp vụ đầu vào cho thiết kế database, phân quyền, giao diện và kiểm thử.

## 2. Các đối tượng tham gia

- Khách hàng.
- Hãng tàu hoặc chủ sở hữu container.
- Bên yêu cầu dịch vụ.
- Bên chịu phí và bên thực tế thanh toán.
- Nhân viên cổng.
- Nhân viên hiện trường.
- Nhân viên văn phòng.
- Nhân viên xe nâng.
- Nhân viên vệ sinh.
- Nhân viên giám định và sửa chữa.
- Kế toán.
- Quản trị hệ thống.

Danh sách vai trò và quyền chi tiết sẽ được xác định trong tài liệu riêng.

## 3. Quy trình Gate In — Nhập bãi

1. Tiếp nhận yêu cầu hoặc xác định loại lượt nhập bãi.
2. Ghi nhận số container và thông tin liên quan.
3. Nhân viên hiện trường chụp ảnh cửa container, ưu tiên ảnh nhìn rõ số container.
4. Nhân viên hiện trường xác nhận container đến bãi.
5. Văn phòng tiếp nhận và kiểm tra thông tin, ảnh.
6. Xác định dịch vụ và khoản phí phải thu.
7. Ghi nhận giao dịch thanh toán.
8. Chỉ hoàn tất Gate In sau khi phí bắt buộc đã được xác nhận thanh toán.
9. Điều phối việc dỡ container và bố trí vị trí.
10. Ghi nhận vị trí hiện tại, trạng thái và lịch sử nghiệp vụ.

Các trạng thái trung gian, trường hợp từ chối, hủy, thanh toán lỗi và container chưa dỡ phải được đặc tả riêng.

## 4. Quy trình quản lý tồn bãi

1. Tra cứu container theo số container.
2. Xem vị trí hiện tại và trạng thái.
3. Ghi nhận các lần di chuyển trong bãi.
4. Kiểm tra tính hợp lệ trước khi di chuyển.
5. Cập nhật vị trí hiện tại và lưu lịch sử.
6. Ngăn hai thao tác đồng thời tạo ra hai vị trí hiện tại cho cùng một container.

Quy tắc đặt tên khu, block, bay, row, tier và sức chứa chưa được chốt.

## 5. Quy trình vệ sinh container

1. Tiếp nhận yêu cầu vệ sinh.
2. Kiểm tra container và điều kiện thực hiện.
3. Phân công nhân viên.
4. Ghi nhận công việc, kết quả và hình ảnh nếu cần.
5. Xác nhận hoàn thành hoặc yêu cầu làm lại.
6. Ghi nhận phí và trạng thái thanh toán theo chính sách dịch vụ.
7. Lưu lịch sử công việc.

Chi tiết các loại vệ sinh và tiêu chuẩn nghiệm thu sẽ được xác định sau.

## 6. Quy trình giám định

1. Tiếp nhận yêu cầu giám định.
2. Phân công người thực hiện.
3. Kiểm tra container và ghi nhận tình trạng.
4. Lưu hình ảnh, vị trí hư hỏng và kết quả.
5. Hoàn thiện báo cáo giám định.
6. Gửi kết quả cho bên có thẩm quyền.
7. Lưu lịch sử và các tài liệu liên quan.

## 7. Quy trình sửa chữa M&R

1. Tiếp nhận yêu cầu hoặc chỉ định sửa chữa.
2. Liên kết với kết quả giám định nếu có.
3. Lập công việc và dự toán sửa chữa.
4. Trình duyệt theo thẩm quyền.
5. Chỉ thực hiện công việc khi đáp ứng điều kiện phê duyệt.
6. Ghi nhận vật tư, nhân công, hình ảnh và chi phí.
7. Nghiệm thu và xác nhận kết quả.
8. Lưu lịch sử sửa chữa.

Các cấp phê duyệt và quy tắc tính giá chưa được chốt.

## 8. Quy trình Booking và cấp container

1. Tiếp nhận booking hoặc yêu cầu cấp container.
2. Xác minh bên yêu cầu, bên nhận, chủ sở hữu và điều kiện cấp.
3. Kiểm tra container phù hợp.
4. Chọn container cụ thể.
5. Khi container được xác nhận gắn với lượt cấp, khóa phân bổ để tránh cấp trùng.
6. Nếu đổi hoặc hủy, xử lý việc giải phóng khóa theo quy tắc được phê duyệt.
7. Điều phối lấy container và kiểm tra trước khi xuất.
8. Lưu container đã cấp và lịch sử liên quan.

## 9. Quy trình Gate Out — Xuất bãi

1. Tiếp nhận yêu cầu xuất container.
2. Kiểm tra booking hoặc quyền nhận container.
3. Kiểm tra container, trạng thái và điều kiện xuất.
4. Kiểm tra phí và các điều kiện bắt buộc.
5. Xác nhận container được đưa ra khỏi vị trí lưu bãi.
6. Ghi nhận thời điểm xuất, người thực hiện và bằng chứng liên quan.
7. Cập nhật tồn bãi và lịch sử.
8. Chặn xuất trùng hoặc xuất khi chưa đủ điều kiện.

## 10. Quy trình tài chính và thanh toán

1. Xác định dịch vụ phát sinh phí.
2. Xác định bên chịu phí và bên thực tế thanh toán.
3. Tạo khoản phải thu và giao dịch thanh toán tương ứng.
4. Hỗ trợ ghi nhận thanh toán thủ công và tích hợp cổng thanh toán khi được triển khai.
5. Ghi nhận trạng thái chờ, thành công, thất bại hoặc hoàn tiền.
6. Đối soát giao dịch với khoản phải thu.
7. Lưu lịch sử điều chỉnh và người thực hiện.
8. Ngăn ghi nhận trùng giao dịch khi hệ thống nhận lại cùng một yêu cầu.

Chính sách thu trước, thu sau, công nợ và hoàn tiền phải được xác định riêng cho từng dịch vụ. Quy tắc Gate In hiện tại yêu cầu thanh toán trước khi hoàn tất.

## 11. Báo cáo và kiểm soát

- Tồn bãi theo vị trí và trạng thái.
- Lịch sử nhập, xuất và di chuyển.
- Công việc vệ sinh, giám định và sửa chữa.
- Booking, cấp container và xuất bãi.
- Phí dịch vụ, thanh toán, công nợ và đối soát.
- Nhật ký thao tác và các trường hợp ngoại lệ.

## 12. Nguyên tắc dữ liệu

- Mỗi container đang ở trong bãi chỉ có một vị trí hiện tại.
- Các thay đổi quan trọng phải có lịch sử.
- Không cho phép cấp trùng container.
- Các thao tác quan trọng phải kiểm tra quyền tại backend.
- Các bước cập nhật liên quan phải đảm bảo tính nhất quán dữ liệu.
- Không xóa lịch sử để thay thế cho việc hủy hoặc điều chỉnh nghiệp vụ.
- Các quy trình phải được kiểm thử cả trường hợp thành công và thất bại.

## 13. Các nội dung cần chốt trước khi thiết kế database

- Danh mục loại Gate In.
- Cấu trúc vị trí bãi và sức chứa.
- Danh mục trạng thái của container và từng nghiệp vụ.
- Vai trò, quyền hạn và các bước phê duyệt.
- Điều kiện Gate Out và quy tắc khóa container.
- Biểu phí và chính sách thanh toán từng dịch vụ.
- Quy tắc xử lý hủy, sửa sai, hoàn tiền và đối soát.
