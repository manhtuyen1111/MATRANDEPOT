# MATRAN DEPOT — DATABASE CONTRACT

## 1. Mục đích

Định nghĩa các nhóm dữ liệu, quan hệ và quy tắc nhất quán cho database PostgreSQL trên Supabase.

Đây là đặc tả ban đầu. Chưa tạo bảng hoặc SQL cho đến khi các quy tắc nghiệp vụ liên quan được xác nhận.

## 2. Nguyên tắc thiết kế

- Dùng PostgreSQL làm cơ sở dữ liệu chính.
- Mỗi bảng nghiệp vụ có khóa chính ổn định.
- Khai báo khóa ngoại cho các quan hệ cần bảo đảm toàn vẹn.
- Dùng ràng buộc database để ngăn dữ liệu không hợp lệ.
- Lưu thời điểm tạo, cập nhật và người thực hiện khi phù hợp.
- Lưu lịch sử nghiệp vụ, trạng thái và vị trí container.
- Không dùng xóa vật lý để thay thế cho hủy nghiệp vụ.
- Ngăn cấp trùng container và xử lý trùng yêu cầu thanh toán.
- Dùng transaction hoặc hàm database cho các bước cần cập nhật đồng bộ.
- Áp dụng Row Level Security (RLS) cho dữ liệu cần phân quyền.
- Mọi thay đổi cấu trúc database phải có migration được quản lý bằng Git.

## 3. Các nhóm dữ liệu dự kiến

### 3.1. Tài khoản và phân quyền

Quản lý:
- Hồ sơ nhân viên.
- Tài khoản liên kết với Supabase Auth.
- Vai trò và quyền.
- Trạng thái hoạt động của tài khoản.
- Phạm vi dữ liệu được phép truy cập.

Không lưu mật khẩu người dùng trực tiếp trong bảng hồ sơ nhân viên.

### 3.2. Danh mục và cấu hình bãi

Quản lý:
- Thông tin bãi.
- Khu vực lưu container.
- Cấu trúc vị trí.
- Loại container rỗng được tiếp nhận.
- Danh mục dịch vụ.
- Danh mục trạng thái và lý do nghiệp vụ.

Cấu trúc vị trí cụ thể phải được xác nhận trước khi thiết kế bảng.

### 3.3. Khách hàng và đối tác

Quản lý:
- Khách hàng.
- Hãng tàu.
- Chủ sở hữu container.
- Bên yêu cầu dịch vụ.
- Bên chịu phí.
- Bên thực tế thanh toán.
- Thông tin liên hệ và trạng thái hợp tác.

Một tổ chức có thể giữ nhiều vai trò khác nhau. Không mặc định các vai trò này luôn thuộc cùng một bên.

### 3.4. Container

Quản lý:
- Số container.
- Thông tin nhận dạng và đặc tính.
- Chủ sở hữu.
- Trạng thái nghiệp vụ.
- Vị trí hiện tại.
- Trạng thái có thể cấp hoặc không thể cấp.
- Lịch sử vị trí.
- Lịch sử trạng thái và các nghiệp vụ liên quan.

Quy tắc: một container đang nằm trong bãi chỉ có một vị trí hiện tại hợp lệ.

### 3.5. Booking và cấp container

Quản lý:
- Booking hoặc yêu cầu cấp.
- Bên yêu cầu và bên nhận.
- Điều kiện cấp.
- Container được phân bổ.
- Thời điểm khóa phân bổ.
- Thay đổi, hủy và giải phóng phân bổ.
- Lịch sử cấp container.

Một container đã được xác nhận gắn với lượt cấp không được đồng thời phân bổ cho một lượt cấp khác đang còn hiệu lực.

### 3.6. Gate In và Gate Out

Quản lý:
- Mã lượt nghiệp vụ.
- Loại tiếp nhận hoặc xuất bãi.
- Container liên quan.
- Bên yêu cầu dịch vụ.
- Ảnh và tài liệu.
- Nhân viên thực hiện.
- Trạng thái quy trình.
- Thời điểm xác nhận.
- Điều kiện hoàn tất.
- Lý do hủy hoặc từ chối.

Gate In phải đáp ứng điều kiện thanh toán bắt buộc trước khi hoàn tất.

Gate Out phải kiểm tra quyền nhận container, trạng thái container và các điều kiện xuất đã được xác định.

### 3.7. Vệ sinh, giám định và sửa chữa

Quản lý:
- Yêu cầu dịch vụ.
- Công việc được giao.
- Kết quả thực hiện.
- Hình ảnh và tài liệu.
- Dự toán và phê duyệt sửa chữa.
- Vật tư, nhân công và chi phí.
- Nghiệm thu.
- Lịch sử thực hiện.

Mỗi dịch vụ phải liên kết đúng container và lượt nghiệp vụ tương ứng.

### 3.8. Tài chính và thanh toán

Quản lý:
- Danh mục phí và bảng giá.
- Khoản phải thu.
- Chi tiết phí theo dịch vụ.
- Giao dịch thanh toán.
- Phương thức thanh toán.
- Trạng thái giao dịch.
- Mã tham chiếu từ cổng thanh toán.
- Hoàn tiền.
- Đối soát.
- Lịch sử điều chỉnh.

Phân biệt khoản phải thu với giao dịch thanh toán. Một khoản phải thu không đồng nghĩa với việc tiền đã được nhận.

### 3.9. Nhật ký và kiểm soát

Quản lý:
- Người thực hiện.
- Hành động.
- Đối tượng bị tác động.
- Thời điểm.
- Dữ liệu thay đổi cần kiểm toán.
- Kết quả thành công hoặc thất bại khi phù hợp.

Không cho phép người dùng thông thường sửa hoặc xóa nhật ký kiểm toán.

## 4. Quan hệ dữ liệu dự kiến

- Một container có thể có nhiều lượt Gate In và Gate Out theo lịch sử.
- Một container có nhiều bản ghi lịch sử vị trí.
- Một container có thể có nhiều yêu cầu vệ sinh, giám định hoặc sửa chữa.
- Một booking có thể phân bổ container theo quy tắc cấp đã được phê duyệt.
- Một dịch vụ có thể phát sinh một hoặc nhiều khoản phí.
- Một khoản phải thu có thể được thanh toán bằng một hoặc nhiều giao dịch tùy chính sách.
- Một tổ chức có thể đồng thời là chủ sở hữu, bên yêu cầu dịch vụ hoặc bên chịu phí.
- Một nghiệp vụ có thể có nhiều ảnh và tài liệu.
- Một người dùng có thể được cấp nhiều vai trò nếu chính sách phân quyền cho phép.

Các quan hệ một-nhiều, nhiều-nhiều và điều kiện bắt buộc phải được cụ thể hóa khi thiết kế schema.

## 5. Quy tắc toàn vẹn dữ liệu

- Số container phải được chuẩn hóa và kiểm tra tính hợp lệ.
- Không cho phép một container có hai vị trí hiện tại cùng lúc.
- Không cho phép phân bổ trùng container trong các lượt cấp còn hiệu lực.
- Không hoàn tất Gate In khi chưa đáp ứng điều kiện thanh toán bắt buộc.
- Không xuất container khi chưa đủ điều kiện Gate Out.
- Không đánh dấu giao dịch thanh toán thành công chỉ vì đã tạo yêu cầu thanh toán.
- Có cơ chế chống ghi nhận trùng callback hoặc yêu cầu thanh toán.
- Các thao tác chuyển trạng thái quan trọng phải kiểm tra trạng thái trước đó.
- Các cập nhật liên quan phải được thực hiện nguyên tử khi cần.
- Hủy nghiệp vụ phải giữ lại lịch sử và lý do.
- Không tin dữ liệu quyền do frontend tự gửi lên.

## 6. Quy ước triển khai

- Dùng UUID cho khóa chính khi phù hợp.
- Dùng `timestamptz` cho thời điểm.
- Dùng kiểu số chính xác cho tiền, không dùng số thực dấu phẩy động.
- Khai báo `NOT NULL`, `UNIQUE`, `CHECK` và khóa ngoại khi phù hợp.
- Tạo index theo các truy vấn thực tế.
- Lưu ảnh trong Supabase Storage và lưu metadata, đường dẫn cùng quyền truy cập trong database.
- Không lưu nội dung ảnh nhị phân trực tiếp trong bảng nghiệp vụ.
- Quản lý thay đổi schema bằng migration có thứ tự.
- Kiểm thử quyền RLS và các tình huống đồng thời.

## 7. Các nội dung cần chốt trước khi viết SQL

- Cấu trúc vị trí bãi.
- Danh mục và trạng thái container.
- Danh mục loại Gate In và Gate Out.
- Quy tắc cấp, khóa và giải phóng container.
- Quy trình phê duyệt vệ sinh, giám định và M&R.
- Biểu phí và chính sách công nợ.
- Cấu trúc khoản phải thu, thanh toán và hoàn tiền.
- Ma trận quyền và chính sách RLS.
- Quy tắc lưu ảnh, thời hạn lưu và quyền truy cập.

## 8. Trạng thái

- Nhóm dữ liệu: đã phác thảo.
- Quan hệ dữ liệu: mới ở mức khái niệm.
- Tên bảng và tên cột: chưa chốt.
- SQL và migration: chưa tạo.
- Chính sách RLS: chưa triển khai.
