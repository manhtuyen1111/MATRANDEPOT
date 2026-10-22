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
- Nhân viên cổng / hiện trường = Giám định; không còn vai trò Kế toán — Văn phòng đảm nhận (DEC-047).
- Quản trị hệ thống.

Danh sách vai trò và quyền chi tiết sẽ được xác định trong tài liệu riêng.

## 3. Quy trình Gate In — Nhập bãi

### 3.1. Các trường hợp container vào bãi đã xác nhận
- **Khách hàng trả container rỗng về bãi** theo lệnh của hãng tàu.
- **`NHẬP TÀU`**: bãi tổ chức xe kéo của bãi vận chuyển số lượng lớn container từ cảng về. Đây là nghiệp vụ riêng, sẽ xây dựng module tương ứng sau.
- Các loại tiếp nhận khác chỉ được ghi nhận khi đã được xác nhận; không tự bổ sung như quy tắc chính thức.

### 3.2. Luồng thực hiện Gate In (HẠ VỎ)
1. **Giám định (mobile)** bấm (+) tạo tác nghiệp, chụp ảnh cửa container nhìn rõ số container, rồi lần lượt ghi nhận (DEC-020):
   - **Trạng thái**: `DAMAGE` (kèm ghi chú hư hỏng) hoặc `AV`.
   - **Phân loại đóng hàng**: `M`, `K`, `E`.
   - **Tình trạng vệ sinh** (chọn nhiều, `KHÔNG VỆ SINH` chọn riêng): `KHÔNG VỆ SINH`, `WP - QUÉT`, `WW - RỬA NƯỚC`, `CC - HÓA CHẤT` (= vệ sinh công nghiệp), `RM - NHỔ ĐINH`, `ML - BÓC TEM` (DEC-021).
   - **AGE**: năm sản xuất container.
   Hệ thống cấp mã hồ sơ `IN-YYMMDD-NNN` khi xác nhận (DEC-037) và chuyển sang Văn phòng.
2. **Văn phòng — Hạ vỏ** (DEC-022):
   - Mục 1: `SỐ CONTAINER`, `SIZE`, `TYPE`, `HÃNG TÀU`, `KHÁCH HÀNG`, số lệnh/chứng từ, `SỐ XE`, `SĐT LÁI XE`.
   - Mục 2: `CHI PHÍ (ĐÃ BAO GỒM VAT)` — chỉ chọn từ Biểu giá.
   - Mục 3: Hình thức thanh toán (DEC-031):
     - **`TTT` — Thanh toán trước:** quét QR Phiếu thu mẹ đang hiệu lực, trừ dần → đã thanh toán (không phát hành phiếu thu mới).
     - **`TTS` — Thanh toán sau:** ghi chú TTS trên chứng từ → công nợ, chưa thu tiền.
     - **`TTTT` — Trực tiếp:** Tiền mặt (người có quyền xác nhận đã nhận → phát hành phiếu thu) hoặc Chuyển khoản API QR (chờ ngân hàng xác nhận → phát hành phiếu thu).
3. Việc tạo yêu cầu thanh toán / mã QR không đồng nghĩa đã thu tiền. Chỉ khi chứng từ đã thanh toán hoặc TTS hợp lệ mới cập nhật `GATE IN OK` và in phiếu K80 (DEC-023).
4. Sau `GATE IN OK` (DEC-024):
   - Có yêu cầu vệ sinh → **Vệ sinh — Chờ vệ sinh**; vệ sinh xong mới vào **Xe nâng — Chờ hạ vỏ**.
   - Không yêu cầu vệ sinh → **Xe nâng — Chờ hạ vỏ**.
   - `DAMAGE` → thêm **Báo giá — Chờ báo giá**.
5. **Xe nâng** quét QR K80, chọn vị trí (Block bắt buộc; Bay/Row/Tier đủ cả 3 hoặc bỏ trống) → vị trí chính thức đầu tiên, lưu lịch sử (DEC-025).

Các trường hợp từ chối, hủy Hạ vỏ đã thanh toán và sửa sai số container sau GATE IN OK còn mở (Q-003, Q-005, OPEN-008).

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

### 4.3. ĐẢO CHUYỂN, SỬA VỊ TRÍ và KHÓA CONTAINER (DEC-030, DEC-036)
- **ĐẢO CHUYỂN** (menu Xe nâng): tìm bất kỳ container đang tồn bãi, lọc SIZE / TIẾN ĐỘ (Chờ vệ sinh, Chờ báo giá, Chờ sửa chữa, Đã lập lệnh cấp, Sẵn sàng), chọn vị trí mới; hệ thống lưu lịch sử tác nghiệp (tên tác nghiệp, thời gian, nhân sự, vị trí trước/sau).
- **SỬA VỊ TRÍ** (menu Tồn vỏ, Văn phòng / Quản lý): chỉnh vị trí hành chính; không tạo lịch sử ĐẢO CHUYỂN, chỉ ghi nhật ký kiểm toán.
- Vị trí chính thức chỉ đến từ HẠ VỎ, ĐẢO CHUYỂN, SỬA VỊ TRÍ; chưa có thì hiển thị `-`.
- **KHÓA CONTAINER** (Tồn vỏ, Văn phòng / Quản lý): bắt buộc ghi chú; container bị khóa có biểu tượng khóa, không được CẤP VỎ / XUẤT VỎ, vẫn được ĐẢO CHUYỂN và SỬA VỊ TRÍ.

## 5. Quy trình vệ sinh container

1. Tiếp nhận yêu cầu vệ sinh.
2. Kiểm tra container và điều kiện thực hiện.
3. Phân công nhân viên.
4. Ghi nhận công việc, kết quả và hình ảnh nếu cần.
5. Xác nhận hoàn thành hoặc yêu cầu làm lại.
6. Ghi nhận phí và trạng thái thanh toán theo chính sách dịch vụ.
7. Lưu lịch sử công việc.

Các phân loại tình trạng vệ sinh ghi nhận tại Gate In (DEC-021): `KHÔNG VỆ SINH`, `WP - QUÉT`, `WW - RỬA NƯỚC`, `CC - HÓA CHẤT` (vệ sinh công nghiệp), `RM - NHỔ ĐINH`, `ML - BÓC TEM`. Bộ phận Vệ sinh hoặc Văn phòng xác nhận hoàn tất (DEC-035); container có yêu cầu vệ sinh chỉ vào hàng chờ Xe nâng hạ vỏ sau khi vệ sinh xong (DEC-024). Tiêu chuẩn nghiệm thu và trạng thái chi tiết sẽ được xác định sau (Q-017).

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

### 7.1. Luồng DAMAGE hiện áp dụng (DEC-026)
1. Container `DAMAGE` sau `GATE IN OK` vào hàng chờ **Báo giá**.
2. **Bộ phận Báo giá** (vai trò `QUOTATION`) nhập hạng mục và số tiền → xác nhận → container chuyển **Chờ sửa chữa**.
3. **Bộ phận Sửa chữa** chọn tổ + nhân viên, xác nhận hoàn tất → container chuyển **AV** (DEC-049, không còn bước QC).
4. Xe nâng dùng ĐẢO CHUYỂN (lọc TIẾN ĐỘ = Chờ sửa chữa) để hạ container tới khu sửa chữa.
5. Không cần hãng tàu duyệt (DEC-040). Báo giá nhập remark + giờ công (DEC-041); Sửa chữa chọn tổ + nhân viên khi hoàn tất (DEC-043).

## 8. Quy trình Booking và cấp container

1. Tiếp nhận booking hoặc yêu cầu cấp container.
2. Xác minh bên yêu cầu, bên nhận, chủ sở hữu và điều kiện cấp.
3. Kiểm tra container phù hợp.
4. Chọn container cụ thể.
5. Khi container được xác nhận gắn với lượt cấp, khóa phân bổ để tránh cấp trùng.
6. Nếu đổi hoặc hủy, xử lý việc giải phóng khóa theo quy tắc được phê duyệt.
7. Điều phối lấy container và kiểm tra trước khi xuất.
8. Lưu container đã cấp và lịch sử liên quan.

### 8.1. Luồng CẤP VỎ tại Văn phòng (DEC-027, DEC-033, DEC-034)
1. Nhập **số booking** → hệ thống hiển thị số container đã cấp theo booking (chờ thanh toán / chờ xe nâng / đã OUT, tách riêng đã hủy) và cho mở danh sách. Chọn **khách hàng nhận vỏ**.
2. Chọn container từ danh sách sẵn sàng cấp vỏ (lọc Hãng tàu – Size – Type – Trạng thái `ALL`/`DAMAGE`/`AV`, mặc định `AV`; hiển thị Phân loại đóng hàng). Container bị khóa hoặc còn chờ vệ sinh không xuất hiện.
3. Nhập `SỐ XE`, `SĐT LÁI XE`.
4. `CHI PHÍ (ĐÃ BAO GỒM VAT)` từ biểu giá → Hình thức thanh toán (TTT / TTS / TTTT như Hạ vỏ).
5. Hệ thống cấp mã hồ sơ `OUT-YYMMDD-NNN`, khóa phân bổ container. Đã thanh toán / TTS hợp lệ → in phiếu K80 cấp vỏ, chuyển **Xe nâng — Chờ cấp vỏ**. Chuyển khoản đang chờ → hồ sơ nằm ở "Hồ sơ cấp vỏ chờ thanh toán".
6. Xe nâng quét QR → hệ thống kiểm tra đủ 5 điều kiện (DEC-015) → OUT.

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

### 10.3. PHIẾU THU (DEC-032)
- Phiếu thu chỉ phát hành khi có **giao dịch thu tiền thực tế thành công** (tiền mặt được xác nhận, hoặc chuyển khoản được ngân hàng xác nhận); mã `PT-YYYY-NNNNNN`; mỗi giao dịch một phiếu.
- TTT khi Hạ vỏ / Cấp vỏ chỉ ghi lần trừ dần, liên kết về Phiếu thu mẹ; TTS không phát hành phiếu thu.
- **Văn phòng tạo phiếu thu TTT** (nạp Phiếu thu mẹ — DEC-047) tại menu PHIẾU THU: chọn đối tác, số tiền, Tiền mặt hoặc Chuyển khoản API QR → Chờ thanh toán → khi thu thành công thì phát hành phiếu thu và Phiếu thu mẹ mới dùng được để trừ dần.
- Tra cứu phiếu thu theo khoảng ngày, mã phiếu thu, số container, mã hồ sơ, hình thức, trạng thái; xem chi tiết và truy ngược hồ sơ.

## 11. Báo cáo và kiểm soát

- Tồn bãi theo vị trí và trạng thái.
- Lịch sử nhập, xuất và di chuyển.
- Công việc vệ sinh, giám định và sửa chữa.
- Booking, cấp container và xuất bãi.
- Phí dịch vụ, thanh toán, công nợ và đối soát.
- Nhật ký thao tác và các trường hợp ngoại lệ.

### 11.1. Menu BÁO CÁO hiện hành (CR-08)
- **Hạ vỏ** (DEC-046), **Cấp vỏ**, **Nhập tàu**, **Xuất tàu**: tìm theo số container hoặc lọc theo khoảng thời gian (+ hãng tàu, size). Không tự tải dữ liệu khi mở trang; giới hạn 50 dòng / trang. Cột chi phí chỉ hiện với Văn phòng / Quản lý.
- **Tổng hợp**: bắt buộc chọn khoảng thời gian (tối đa 366 ngày) trước khi tạo; xuất Excel 5 sheet: HẠ VỎ, CẤP VỎ (theo khoảng thời gian), XUẤT VỎ, NHẬP VỎ (theo quy tắc từng loại hồ sơ — xem Q-033), TỒN VỎ (tại thời điểm lập). Chỉ Văn phòng / Quản lý.
- Ba mục báo cáo cũ (TỒN VỎ / HẠ VỎ / CẤP VỎ) đã gỡ khỏi menu; dữ liệu và chức năng tác nghiệp không bị xóa.

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
