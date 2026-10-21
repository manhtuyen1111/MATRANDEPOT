# MATRAN DEPOT — BUSINESS WORKFLOWS

## 1. Mục đích

Mô tả các quy trình vận hành bãi container rỗng xuyên suốt toàn bộ thời gian ở bãi. Đây là tài liệu nghiệp vụ đầu vào cho thiết kế database, phân quyền, giao diện và kiểm thử.

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

### 3.1. Các trường hợp container vào bãi đã xác nhận
- **Khách hàng trả container rỗng về bãi** theo lệnh của hãng tàu.
- **`NHẬP TÀU`**: bãi tổ chức xe kéo của bãi vận chuyển số lượng lớn container từ cảng về. Đây là nghiệp vụ riêng, sẽ xây dựng module tương ứng sau.
- Các loại tiếp nhận khác chỉ được ghi nhận khi đã được xác nhận; không tự bổ sung như quy tắc chính thức.

### 3.2. Luồng thực hiện Gate In
1. Tiếp nhận yêu cầu hoặc xác định loại lượt nhập bãi.
2. Nhân viên cổng/hiện trường chụp ảnh cửa container, ảnh phải nhìn rõ số container.
3. Nhân viên hiện trường ghi nhận thông tin ban đầu và xác nhận container đến bãi. Các trường thông tin hiện trường đã xác nhận gồm:
   - **Phân loại**: `DAMAGE`, `AV`.
   - **Phân loại đóng hàng**: `M`, `K`, `E`.
   - **Tình trạng vệ sinh**: `KHÔNG VỆ SINH`, `QUÉT`, `RỬA NƯỚC`, `VỆ SINH CÔNG NGHIỆP`, `NHỔ ĐINH`, `BÓC TEM`.
4. Văn phòng tiếp nhận, kiểm tra lệnh/chứng từ, hình ảnh và bổ sung các trường đã xác nhận:
   - `SỐ CONTAINER`
   - `SIZE`
   - `TYPE`
   - `SỐ XE`
   - `ĐẠI DIỆN KHÁCH HÀNG`
5. Văn phòng xác định dịch vụ, khoản phí phải thu và xác nhận phương thức thanh toán thuộc 1 trong 3 loại:
   - **`TTT` (Thanh toán trước):** Quét mã QR thanh toán của Phiếu thu mẹ vào chứng từ; nếu hợp lệ thì thông báo và trừ dần vào Phiếu thu mẹ.
   - **`TTS` (Thanh toán sau):** Kiểm tra thông tin `TTS` ở các nguồn; nếu xác nhận đủ điều kiện thì ghi chú (`note`) ở chứng từ là `TTS`.
   - **`TTTT` (Thanh toán trực tiếp):** Thanh toán chuyển khoản (API) hoặc Thanh toán tiền mặt.
6. Ghi nhận giao dịch/xác nhận chứng từ thanh toán (việc tạo yêu cầu thanh toán không đồng nghĩa đã hoàn tất thanh toán).
7. Chỉ sau khi thanh toán/xác nhận hợp lệ mới được cập nhật trạng thái `GATE IN OK` (hoàn tất Gate In).
8. Sau `GATE IN OK`, chuyển sang hàng chờ **Xe nâng / Hạ bãi** để bố trí vị trí; đồng thời nếu phân loại là `DAMAGE` hoặc có yêu cầu vệ sinh (khác `KHÔNG VỆ SINH`) thì tự động tạo phiếu **Giám định / Vệ sinh** tương ứng.
9. Ghi nhận vị trí hiện tại (cấp `Block` hoặc chi tiết `Bay/Row/Tier`), trạng thái và lịch sử nghiệp vụ khi container được bố trí vào bãi.

Các trạng thái trung gian, bộ phận nhận chuyển tiếp sau `GATE IN OK`, trường hợp từ chối, hủy, thanh toán lỗi và container chưa dỡ phải được đặc tả riêng.

## 4. Quy trình quản lý tồn bãi và các hoạt động phát sinh tại bãi

### 4.1. Các hoạt động có thể phát sinh khi container nằm tại bãi
- Lưu bãi và theo dõi tồn/thời gian lưu.
- Giám định, ghi nhận tình trạng.
- Vệ sinh container.
- Sửa chữa container.
- Di chuyển, đảo chuyển trong bãi.
- Tạm giữ hoặc khóa xuất theo yêu cầu.
- Xử lý chứng từ, lệnh hãng tàu và yêu cầu khách hàng.

**Nguyên tắc:** Không mặc định tất cả container đều phải thực hiện mọi dịch vụ.

### 4.2. Quản lý vị trí và di chuyển trong bãi
1. Tra cứu container theo số container.
2. Xem vị trí hiện tại và trạng thái.
3. Mỗi container đang trong bãi chỉ có một vị trí hiện tại; lịch sử di chuyển phải được lưu.
4. Có thể ghi nhận vị trí ở cấp `Block` khi chưa xác định `Bay/Row/Tier`; không coi `Block` là một vị trí độc quyền khiến các container khác không thể cùng nằm trong `Block` đó.
5. Khi bổ sung vị trí chi tiết hơn (`Bay/Row/Tier`), cập nhật vị trí hiện tại và giữ lịch sử.
6. Ghi nhận các lần di chuyển, đảo chuyển trong bãi; kiểm tra tính hợp lệ trước khi di chuyển.
7. Cập nhật vị trí hiện tại và lưu lịch sử.
8. Ngăn hai thao tác đồng thời tạo ra hai vị trí hiện tại cho cùng một container.

Quy tắc đặt tên khu, block, bay, row, tier chi tiết và sức chứa chưa được chốt.

## 5. Quy trình vệ sinh container

1. Tiếp nhận yêu cầu vệ sinh.
2. Kiểm tra container và điều kiện thực hiện.
3. Phân công nhân viên.
4. Ghi nhận công việc, kết quả và hình ảnh nếu cần.
5. Xác nhận hoàn thành hoặc yêu cầu làm lại.
6. Ghi nhận phí và trạng thái thanh toán theo chính sách dịch vụ.
7. Lưu lịch sử công việc.

Các phân loại tình trạng vệ sinh ghi nhận tại Gate In đã xác nhận gồm: `KHÔNG VỆ SINH`, `QUÉT`, `RỬA NƯỚC`, `VỆ SINH CÔNG NGHIỆP`, `NHỔ ĐINH`, `BÓC TEM`. Tiêu chuẩn nghiệm thu và quy trình xử lý chi tiết sẽ được xác định sau.

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

### 9.1. Các trường hợp container ra khỏi bãi đã xác nhận
- **`CẤP VỎ`** cho khách hàng hoặc xe khách theo lệnh cấp của hãng tàu.
- **`XUẤT TÀU`**: bãi tổ chức xe kéo đưa container từ bãi ra cảng.
- **Trả container** cho hãng tàu hoặc đơn vị khác theo lệnh riêng.

### 9.2. Điều kiện kiểm tra bắt buộc trước khi xuất container
- Có lệnh cấp/lệnh xuất hợp lệ.
- Không bị tạm giữ hoặc khóa xuất.
- Đúng số container được phép xuất.
- Đã thanh toán các khoản phí bắt buộc theo quy định.
- Chứng từ và thủ tục đã hoàn tất.

### 9.3. Luồng thực hiện Gate Out
1. Tiếp nhận yêu cầu xuất container.
2. Kiểm tra lệnh cấp/lệnh xuất, booking hoặc quyền nhận container.
3. Kiểm tra đúng số container được phép xuất, trạng thái container và đảm bảo container không bị tạm giữ hoặc khóa xuất.
4. Kiểm tra đã thanh toán các khoản phí bắt buộc và hoàn tất chứng từ, thủ tục.
5. Xác nhận container được đưa ra khỏi vị trí lưu bãi.
6. Ghi nhận thời điểm xuất, người thực hiện và bằng chứng liên quan.
7. Cập nhật tồn bãi và lịch sử.
8. Chặn xuất trùng hoặc xuất khi chưa đủ điều kiện.

## 10. Quy trình tài chính và thanh toán

### 10.1. Ba loại hình thanh toán đã xác nhận
1. **THANH TOÁN TRƯỚC (`TTT`) — Phiếu thu mẹ & Mã QR:**
   - Khách hàng đóng thanh toán 1 lô trước đó. Hệ thống cho tạo **Phiếu thu mẹ** trước cho khách hàng.
   - Khách hàng nhận được một **mã QR thanh toán** (mã QR này là code thanh toán thay phiếu thu).
   - Khi văn phòng yêu cầu thanh toán, khách hàng quét mã này vào **CHỨNG TỪ**. Nếu chứng từ và số dư hợp lệ, hệ thống thông báo và trừ dần trong Phiếu thu mẹ.
2. **THANH TOÁN SAU (`TTS`):**
   - Nhân viên văn phòng kiểm tra thông tin `TTS` ở các nguồn.
   - Nếu xác nhận `TTS` thì ghi chú (`note`) ở **CHỨNG TỪ** là `TTS`.
3. **THANH TOÁN TRỰC TIẾP (`TTTT`):**
   - Thanh toán chuyển khoản (API).
   - Thanh toán tiền mặt.

### 10.2. Luồng xử lý tài chính
1. Xác định dịch vụ phát sinh phí.
2. Xác định bên chịu phí và bên thực tế thanh toán.
3. Nhân viên tác nghiệp văn phòng xác nhận khoản thu thuộc trường hợp nào (`TTT`, `TTS`, hay `TTTT`).
4. Tạo khoản phải thu, chứng từ và giao dịch thanh toán tương ứng (trừ quỹ `TTT`, ghi nhận `TTS`, hoặc thu `TTTT` qua Tiền mặt / API Chuyển khoản).
5. Ghi nhận trạng thái chờ, thành công, thất bại hoặc hoàn tiền.
6. Đối soát giao dịch với khoản phải thu và theo dõi số dư Phiếu thu mẹ (`TTT`) / công nợ (`TTS`).
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
