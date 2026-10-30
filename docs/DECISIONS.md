# MATRAN DEPOT — DECISIONS LOG

## 1. Mục đích

Lưu các quyết định nghiệp vụ và kỹ thuật ảnh hưởng đến thiết kế, phát triển và vận hành MATRAN DEPOT.

Quy ước trạng thái:
- CONFIRMED: Đã được người dùng xác nhận.
- PROPOSED: Đề xuất, chưa được xác nhận.
- OPEN: Đang chờ quyết định.
- SUPERSEDED: Đã được thay thế bằng quyết định mới.

## 2. Quyết định nghiệp vụ đã xác nhận

### DEC-001 — Phạm vi container

- Trạng thái: CONFIRMED
- Quyết định: Phạm vi hệ thống chỉ quản lý container rỗng xuyên suốt toàn bộ thời gian ở bãi.
- Ảnh hưởng: Quy trình Gate In, tồn bãi, dịch vụ, booking, cấp container và Gate Out.

### DEC-002 — Phạm vi dịch vụ và hoạt động tại bãi

- Trạng thái: CONFIRMED
- Quyết định: Hệ thống cần quản lý:
  - Lưu bãi và theo dõi tồn/thời gian lưu.
  - Gate In và Gate Out.
  - Booking và cấp container.
  - Vệ sinh container.
  - Giám định, ghi nhận tình trạng và sửa chữa M&R.
  - Di chuyển, đảo chuyển trong bãi.
  - Tạm giữ hoặc khóa xuất theo yêu cầu.
  - Xử lý chứng từ, lệnh hãng tàu và yêu cầu khách hàng.
  - Phí dịch vụ, thanh toán và đối soát.
  - Không mặc định tất cả container đều phải thực hiện mọi dịch vụ.
- Ảnh hưởng: Phải hoàn thiện toàn bộ quy trình bắt buộc trước khi đưa vào vận hành; luồng dữ liệu phải cho phép container phát sinh dịch vụ linh hoạt theo nhu cầu thực tế thay vì ép buộc đi qua mọi bước dịch vụ.

### DEC-003 — Quan hệ giữa các bên

- Trạng thái: CONFIRMED
- Quyết định: Chủ sở hữu container, bên yêu cầu dịch vụ và bên trả phí có thể là các bên khác nhau.
- Ảnh hưởng: Không gộp các vai trò này thành một trường khách hàng duy nhất.

### DEC-004 — Chính sách thanh toán và hoàn tất Gate In

- Trạng thái: CONFIRMED
- Quyết định:
  - Hệ thống hỗ trợ **3 loại hình thanh toán** trên chứng từ nghiệp vụ:
    1. **THANH TOÁN TRƯỚC (`TTT`)**: Khách hàng đóng thanh toán 1 lô trước đó. Hệ thống cho tạo **Phiếu thu mẹ** trước cho khách hàng và cấp một **mã QR thanh toán** (mã code thanh toán thay phiếu thu). Khi văn phòng yêu cầu thanh toán, khách hàng quét mã này vào **CHỨNG TỪ**; nếu hợp lệ hệ thống sẽ thông báo và trừ dần số tiền trong Phiếu thu mẹ.
    2. **THANH TOÁN SAU (`TTS`)**: Nhân viên văn phòng kiểm tra thông tin `TTS` ở các nguồn; nếu xác nhận `TTS` thì ghi chú (note) ở **CHỨNG TỪ** là `TTS`.
    3. **THANH TOÁN TRỰC TIẾP (`TTTT`)**: Gồm **Thanh toán chuyển khoản (API)** và **Thanh toán tiền mặt**.
  - Nhân viên tác nghiệp văn phòng (`OFFICE`) là người xác nhận khoản thu thuộc trường hợp nào (`TTT`, `TTS`, hay `TTTT`).
  - Việc tạo yêu cầu thanh toán không đồng nghĩa đã hoàn tất nghĩa vụ thanh toán.
  - Chỉ sau khi thanh toán/xác nhận chứng từ thanh toán hợp lệ (đã trừ quỹ `TTT`, hoặc xác nhận `TTS` hợp lệ, hoặc thu `TTTT` thành công) mới được cập nhật trạng thái `GATE IN OK` (hoàn tất Gate In).
- Ảnh hưởng: Database và giao diện thanh toán phải quản lý Phiếu thu mẹ (`TTT`) kèm mã QR và lịch sử trừ dần, ghi chú xác nhận `TTS` trên chứng từ, và giao dịch `TTTT` (Tiền mặt / API chuyển khoản).

### DEC-005 — Vị trí container

- Trạng thái: CONFIRMED
- Quyết định:
  - Mỗi container đang nằm trong bãi chỉ có một vị trí hiện tại.
  - Lịch sử di chuyển phải được lưu.
  - Có thể ghi nhận vị trí ở cấp `Block` khi chưa xác định `Bay/Row/Tier`; không coi `Block` là một vị trí độc quyền khiến các container khác không thể cùng nằm trong `Block` đó.
  - Khi bổ sung vị trí chi tiết hơn (`Bay/Row/Tier`), cập nhật vị trí hiện tại và giữ lịch sử.
- Ảnh hưởng: Thiết kế ràng buộc vị trí trong database phải phân biệt vị trí cấp `Block` (nhiều container cùng thuộc một `Block`) với vị trí ô chi tiết (`Bay/Row/Tier`), đồng thời lưu đầy đủ lịch sử khi cập nhật chi tiết hoặc di chuyển.

### DEC-006 — Chống cấp container trùng

- Trạng thái: CONFIRMED
- Quyết định: Khóa phân bổ khi container cụ thể được chọn và xác nhận gắn với lượt cấp.
- Ảnh hưởng: Phải xử lý việc đổi, hủy và giải phóng phân bổ an toàn.

### DEC-007 — Các trường hợp container vào bãi (Loại tiếp nhận)

- Trạng thái: CONFIRMED
- Quyết định:
  - Hỗ trợ nhiều loại lượt tiếp nhận vào bãi, đã xác nhận gồm:
    1. Khách hàng trả container rỗng về bãi theo lệnh của hãng tàu.
    2. `NHẬP TÀU`: bãi tổ chức xe kéo của bãi vận chuyển số lượng lớn container từ cảng về (đây là nghiệp vụ riêng, sẽ xây dựng module tương ứng sau).
  - Các loại tiếp nhận khác chỉ được ghi nhận khi đã được xác nhận; không tự bổ sung như quy tắc chính thức.
- Ảnh hưởng: Loại tiếp nhận được quản lý theo danh mục đã xác nhận; tách riêng module `NHẬP TÀU` theo lộ trình mà không làm ảnh hưởng cấu trúc chung.

### DEC-008 — Cách xây dựng hệ thống

- Trạng thái: CONFIRMED
- Quyết định: Xây dựng ERP đầy đủ theo phạm vi nghiệp vụ đã thống nhất. Có thể triển khai theo từng giai đoạn, nhưng không đưa vào vận hành chính thức khi các quy trình bắt buộc chưa hoàn thiện và nghiệm thu.
- Ảnh hưởng: Phải có đặc tả, kiểm thử và nghiệm thu cho toàn bộ phạm vi.

### DEC-009 — Cách làm việc với mã nguồn

- Trạng thái: CONFIRMED
- Quyết định: Thực hiện từng file một trong VS Code; hướng dẫn cụ thể cách tạo file, nhập nội dung và lưu.
- Ảnh hưởng: Mỗi bước chỉ tập trung vào file hoặc nhiệm vụ đang thực hiện.

### DEC-014 — Các trường hợp container ra khỏi bãi

- Trạng thái: CONFIRMED
- Quyết định: Các trường hợp xuất container ra khỏi bãi gồm:
  1. `CẤP VỎ` cho khách hàng hoặc xe khách theo lệnh cấp của hãng tàu.
  2. `XUẤT TÀU`: bãi tổ chức xe kéo đưa container từ bãi ra cảng.
  3. Trả container cho hãng tàu hoặc đơn vị khác theo lệnh riêng.
- Ảnh hưởng: Quy trình cấp container và Gate Out phải hỗ trợ đúng các loại lệnh xuất này.

### DEC-015 — Điều kiện kiểm tra trước khi xuất container

- Trạng thái: CONFIRMED
- Quyết định: Trước khi xuất container khỏi bãi, phải kiểm tra thỏa mãn các điều kiện:
  - Có lệnh cấp/lệnh xuất hợp lệ.
  - Container không bị tạm giữ hoặc khóa xuất.
  - Đúng số container được phép xuất.
  - Đã thanh toán các khoản phí bắt buộc theo quy định.
  - Chứng từ và thủ tục đã hoàn tất.
- Ảnh hưởng: Backend/database phải kiểm tra toàn bộ điều kiện trên trước khi cho phép hoàn tất Gate Out.

### DEC-016 — Luồng thực hiện và trường dữ liệu Gate In

- Trạng thái: CONFIRMED
- Quyết định:
  - Nhân viên cổng/hiện trường chụp ảnh cửa container, ảnh phải nhìn rõ số container.
  - Nhân viên hiện trường ghi nhận thông tin ban đầu với các trường đã xác nhận:
    - Phân loại: `DAMAGE`, `AV`.
    - Phân loại đóng hàng: `M`, `K`, `E`.
    - Tình trạng vệ sinh (cho phép chọn nhiều giá trị cùng lúc, trừ khi chọn `KHÔNG VỆ SINH`): `KHÔNG VỆ SINH`, `QUÉT`, `RỬA NƯỚC`, `VỆ SINH CÔNG NGHIỆP`, `NHỔ ĐINH`, `BÓC TEM`.
  - Văn phòng kiểm tra lệnh/chứng từ và bổ sung các trường:
    - `SỐ CONTAINER`
    - `SIZE`
    - `TYPE`
    - `SỐ XE`
    - `ĐẠI DIỆN KHÁCH HÀNG`
  - Nhân viên tác nghiệp văn phòng xác nhận khoản thu thuộc loại `TTT`, `TTS` hoặc `TTTT`; chỉ sau khi thanh toán/xác nhận hợp lệ mới được cập nhật `GATE IN OK`.
  - Sau `GATE IN OK`, container chuyển sang hàng chờ **Xe nâng / Hạ bãi** (xếp vị trí), đồng thời nếu phân loại là `DAMAGE` hoặc có yêu cầu vệ sinh (khác `KHÔNG VỆ SINH`) thì tự động tạo phiếu **Giám định / Vệ sinh** tương ứng.
- Ảnh hưởng: Cấu trúc dữ liệu và giao diện Gate In phải tách rõ nhóm trường hiện trường (với mảng tình trạng vệ sinh), nhóm trường văn phòng, 3 hình thức thanh toán (`TTT`, `TTS`, `TTTT`), trạng thái `GATE IN OK` và tự động sinh lệnh hạ bãi / dịch vụ sau `GATE IN OK`.
- Điều chỉnh 2026-10-22 (người dùng xác nhận, CR-04):
  - Cũ: Văn phòng bổ sung `ĐẠI DIỆN KHÁCH HÀNG`. Mới: ô này đổi thành `SĐT LÁI XE` (bắt buộc). Thông tin khách hàng vẫn được giữ thành trường `KHÁCH HÀNG` (chọn theo Danh mục chung) vì cần cho chứng từ, phiếu thu và hồ sơ (nhóm C — CR-07).
  - Tên hạng mục vệ sinh được chuẩn hóa theo DEC-021.
  - Luồng sau `GATE IN OK` được chi tiết hóa ở DEC-024.

### DEC-017 — Quy tắc Booking nhiều container và phân quyền tác nghiệp

- Trạng thái: CONFIRMED
- Quyết định:
  - Một Booking / Lệnh cấp có thể cấp nhiều container (theo số lượng và kích cỡ yêu cầu); từng container được khóa phân bổ ngay khi được chọn gắn vào Booking.
  - Sử dụng 10 vai trò hệ thống (cho phép kiêm nhiệm); nhân viên tác nghiệp văn phòng (`OFFICE`) xác nhận loại khoản thu (`TTT`, `TTS`, `TTTT`); `MANAGER` và `OFFICE` được đặt/gỡ lệnh tạm giữ hoặc khóa xuất (`Hold`).
- Điều chỉnh 2026-10-22: bổ sung vai trò thứ 11 `QUOTATION` (Bộ phận Báo giá) — xem DEC-026. Cách nhập booking chi tiết ở DEC-034.

### DEC-018 — Thuật ngữ và các bộ phận tác nghiệp

- Trạng thái: CONFIRMED (2026-10-22 — quy tắc đã có trong code, người dùng xác nhận là ý của mình)
- Quyết định:
  - `HẠ VỎ` = Gate In (khách trả container rỗng). `CẤP VỎ` = Gate Out cấp rỗng theo booking. `NHẬP TÀU` / `XUẤT TÀU` = luồng xe kéo bãi với cảng (DEC-038).
  - Các bộ phận trên menu: Tồn vỏ, Giám định (Hạ vỏ — mobile), Văn phòng (Hạ vỏ, Cấp vỏ, Phiếu thu, Nhập tàu, Xuất tàu), Vệ sinh, Xe nâng (Chờ hạ vỏ, Chờ cấp vỏ, Đảo chuyển), Báo giá, Sửa chữa, Báo cáo, Danh mục chung.
  - Phiếu K80 = phiếu tác nghiệp nội bộ in nhiệt 80mm, có mã QR để các bộ phận quét xác nhận.

### DEC-019 — Hồ sơ lượt lưu bãi

- Trạng thái: CONFIRMED
- Quyết định: Mỗi lần container vào bãi tạo một hồ sơ (lượt lưu bãi) do Giám định khởi tạo ở bước đầu; hồ sơ đi theo container đến khi OUT. Lượt đã OUT được giữ nguyên làm lịch sử, container quay lại bãi sẽ có hồ sơ mới. Mã hồ sơ theo DEC-037.

### DEC-020 — Trình tự Giám định Hạ vỏ (mobile)

- Trạng thái: CONFIRMED
- Quyết định: Ảnh cửa container (bắt buộc) → Trạng thái `DAMAGE`/`AV` (nếu `DAMAGE` thì ghi chú hư hỏng, có gợi ý nhanh) → Phân loại đóng hàng `M`/`K`/`E` → Tình trạng vệ sinh (chọn nhiều; `KHÔNG VỆ SINH` chỉ chọn riêng) → AGE (năm sản xuất, 4 chữ số) → Xác nhận. Đủ từng mục mới mở mục tiếp theo.

### DEC-021 — Mã hạng mục vệ sinh

- Trạng thái: CONFIRMED (2026-10-22)
- Quyết định: `KHÔNG VỆ SINH`, `WP - QUÉT`, `WW - RỬA NƯỚC`, `CC - HÓA CHẤT`, `RM - NHỔ ĐINH`, `ML - BÓC TEM`. `CC - HÓA CHẤT` chính là `VỆ SINH CÔNG NGHIỆP` trong tài liệu cũ (người dùng xác nhận). Dữ liệu cũ dùng tên cũ được tự động quy đổi.

### DEC-022 — Văn phòng Hạ vỏ

- Trạng thái: CONFIRMED (2026-10-22)
- Quyết định:
  - Mục 1 — Thông tin hồ sơ: `SỐ CONTAINER` (4 chữ cái + 7 chữ số), `SIZE`, `TYPE`, `HÃNG TÀU`, `KHÁCH HÀNG` (chọn theo Danh mục chung), số lệnh/chứng từ (không bắt buộc), `SỐ XE`, `SĐT LÁI XE`.
  - Mục 2 — `CHI PHÍ (ĐÃ BAO GỒM VAT)`: chỉ chọn từ Biểu giá trong Danh mục chung; không nhập tay số tiền; không có mức phí mặc định theo DAMAGE/AV. Hệ thống gợi ý biểu giá Nâng hạ theo Size–Type–Hãng tàu. Đơn giá được chụp lại vào chứng từ tại thời điểm lập.
  - Mục 3 — Hình thức thanh toán (DEC-031), chỉ hiện khi đã có ít nhất 1 khoản chi phí.

### DEC-023 — Phiếu K80

- Trạng thái: CONFIRMED
- Quyết định: Phiếu K80 được in khi `GATE IN OK` (Hạ vỏ) và khi lệnh CẤP VỎ đã thanh toán / xác nhận thanh toán (Cấp vỏ). Phiếu thể hiện trạng thái thanh toán (✓ đã thu / ✗ chưa thu, ví dụ TTS), số container, size, type, AGE, trạng thái, đóng hàng, vệ sinh, số xe, SĐT lái xe, mã hồ sơ và mã QR.

### DEC-024 — Chuyển tiếp sau GATE IN OK (giải quyết Q-030)

- Trạng thái: CONFIRMED (2026-10-22, CR-03)
- Quyết định:
  - Có yêu cầu vệ sinh (khác `KHÔNG VỆ SINH`) → vào hàng chờ **Vệ sinh**; chỉ sau khi Vệ sinh xác nhận hoàn tất container mới vào hàng chờ **Xe nâng — Chờ hạ vỏ**. Ràng buộc này được kiểm tra ở tầng nghiệp vụ, không chỉ ẩn trên giao diện.
  - Không có yêu cầu vệ sinh → vào thẳng **Xe nâng — Chờ hạ vỏ**.
  - `DAMAGE` → đồng thời vào hàng chờ **Báo giá**.
  - Mọi hàng chờ xếp FIFO; làm xong thì tự ẩn.

### DEC-025 — Xe nâng hạ vỏ

- Trạng thái: CONFIRMED
- Quyết định: Xe nâng quét QR K80, bắt buộc chọn `Block`; `Bay/Row/Tier` nhập đủ cả 3 hoặc bỏ trống cả 3. Ô chi tiết phải nằm trong cấu hình Block và không trùng container khác.

### DEC-026 — Luồng DAMAGE: Báo giá → Sửa chữa

- Trạng thái: CONFIRMED (2026-10-22)
- Quyết định: Báo giá do **vai trò riêng `QUOTATION` (Bộ phận Báo giá)** thực hiện (nhập hạng mục và số tiền). Xác nhận báo giá xong container chuyển sang **Chờ sửa chữa**. Bộ phận Sửa chữa xác nhận hoàn tất → container chuyển sang `AV`.
- Ghi chú: việc hãng tàu duyệt báo giá trước khi sửa chưa được xác nhận (xem OPEN-007); hiện tại báo giá xong là chuyển sửa ngay.

### DEC-027 — Điều kiện CẤP VỎ

- Trạng thái: CONFIRMED (2026-10-22, CR-05)
- Quyết định:
  - Container `AV` chỉ được cấp khi đã xác nhận hết quy trình: đang tồn bãi, đã vệ sinh xong (nếu có), không còn báo giá/sửa chữa đang mở, không bị khóa.
  - Container còn chờ vệ sinh **không** được cấp (không phải AV hoàn chỉnh).
  - Container `DAMAGE` vẫn được cấp theo yêu cầu chỉ định riêng, **không cần ghi chú** (người dùng xác nhận); khi OUT, các việc Báo giá/Sửa chữa còn mở của lượt lưu bãi được đóng với ghi chú "cấp vỏ DAMAGE theo chỉ định".
  - Danh sách sẵn sàng cấp vỏ có bộ lọc Hãng tàu – Size – Type – Trạng thái (`ALL`/`DAMAGE`/`AV`, mặc định `AV`) và hiển thị Phân loại đóng hàng.

### DEC-028 — Danh mục chung

- Trạng thái: CONFIRMED
- Quyết định: Chỉ `ADMIN` cấu hình; các vai trò khác xem. Gồm: Khách hàng, Hãng tàu (có cờ cho phép TTS), Vị trí bãi (Block với Bay/Row/Tier tối đa), Container (Size, Type), Biểu giá (Nâng hạ theo Size–Type–Hãng tàu, Thu gom rác, Khác — giá đã gồm VAT). Mỗi mục là một mục con trên menu Danh mục chung (CR-06).

### DEC-029 — Ghi chú Tồn vỏ

- Trạng thái: CONFIRMED
- Quyết định: Văn phòng / Quản lý thêm ghi chú trên từng container tồn vỏ; container có ghi chú được làm nổi bật và đưa lên đầu danh sách.

### DEC-030 — KHÓA CONTAINER (tạm giữ / khóa xuất) — giải quyết Q-031

- Trạng thái: CONFIRMED (2026-10-22, CR-02)
- Quyết định: `OFFICE` và `MANAGER` được khóa/mở khóa; bắt buộc nhập ghi chú khi khóa (mở khóa cũng ghi chú). Container bị khóa có biểu tượng khóa cạnh số container; **không được CẤP VỎ / XUẤT VỎ**; **vẫn được ĐẢO CHUYỂN và SỬA VỊ TRÍ**. Lưu người khóa, thời điểm, ghi chú; thao tác được ghi nhật ký kiểm toán.

### DEC-031 — Trạng thái của 3 trường hợp thanh toán

- Trạng thái: CONFIRMED (2026-10-22, CR-04)
- Quyết định (không coi 3 trường hợp có cùng thời điểm thu tiền / cùng trạng thái):
  - `TTT`: quét QR Phiếu thu mẹ đang hiệu lực, trừ dần số dư → chứng từ **Đã thanh toán**. Không phát hành phiếu thu mới (tiền đã thu khi nạp Phiếu thu mẹ — người dùng xác nhận). Phiếu thu mẹ chỉ dùng được sau khi tiền nạp đã thu thực tế.
  - `TTS`: ghi chú TTS trên chứng từ → chứng từ **Thanh toán sau (công nợ)**, chưa thu tiền, không phát hành phiếu thu; vẫn đủ điều kiện hoàn tất nghiệp vụ.
  - `TTTT — Tiền mặt`: người có quyền bấm xác nhận đã nhận tiền → giao dịch thành công → phát hành phiếu thu → chứng từ **Đã thanh toán**.
  - `TTTT — Chuyển khoản (API QR)`: tạo yêu cầu thanh toán QR (trạng thái **Chờ thanh toán**, chưa phải đã thu); chỉ khi nhận kết quả hợp lệ từ ngân hàng mới thành công → phát hành phiếu thu → hoàn tất nghiệp vụ tự động. Kết quả gửi lặp (cùng mã giao dịch ngân hàng) không được ghi nhận lại; sai số tiền bị từ chối. Đang chờ chuyển khoản thì phải hủy yêu cầu trước khi đổi hình thức.
- Ảnh hưởng: `GATE IN OK` và chuyển Xe nâng chờ cấp vỏ chỉ xảy ra khi chứng từ Đã thanh toán hoặc TTS hợp lệ.

### DEC-032 — PHIẾU THU

- Trạng thái: CONFIRMED (2026-10-22, CR-04)
- Quyết định:
  - Mỗi giao dịch thu tiền thực tế thành công có đúng một phiếu thu; mã `PT-YYYY-NNNNNN` (đánh số liên tục theo năm — người dùng chọn), duy nhất, không tái sử dụng, do hệ thống cấp (không sinh ở giao diện).
  - Không tạo phiếu thu khi mới có chi phí, yêu cầu thanh toán hoặc mã QR.
  - Menu PHIẾU THU (Kế toán, Văn phòng, Quản lý): lọc theo khoảng ngày, tìm theo mã phiếu thu / số container / mã hồ sơ, lọc hình thức và trạng thái; không tự tải toàn bộ; có phân trang; xem chi tiết và truy ngược hồ sơ.
  - Kế toán (`ACCOUNTANT`) tạo **phiếu thu TTT** (nạp Phiếu thu mẹ) tại menu PHIẾU THU, chọn đối tác, số tiền, hình thức Tiền mặt hoặc Chuyển khoản API QR. Phiếu ở trạng thái Chờ thanh toán cho tới khi Kế toán xác nhận tiền mặt hoặc ngân hàng xác nhận chuyển khoản.

### DEC-033 — Thu phí CẤP VỎ

- Trạng thái: CONFIRMED (2026-10-22)
- Quyết định: Cấp vỏ thu phí tại **Văn phòng** khi lập lệnh, quy trình như Hạ vỏ (Chi phí từ biểu giá → TTT/TTS/TTTT). Chỉ khi đã thanh toán / TTS hợp lệ mới in phiếu K80 cấp vỏ và chuyển sang Xe nâng — Chờ cấp vỏ. Xe nâng không tự ghi nhận phí.
- Hủy lệnh cấp: được hủy khi chưa ghi nhận thanh toán (giải phóng khóa phân bổ, lưu lý do); đã ghi nhận thanh toán thì chặn cho tới khi có quy trình hoàn tiền / điều chỉnh công nợ (OPEN-006).

### DEC-034 — Booking khi cấp vỏ

- Trạng thái: CONFIRMED (2026-10-22, giải quyết Q-010)
- Quyết định: Văn phòng chỉ cần nhập **số booking**; số lượng xem trên chứng từ booking. Hệ thống tự đếm và hiển thị số container đã cấp theo booking (chờ thanh toán / chờ xe nâng / đã OUT, tách riêng số đã hủy) và cho mở danh sách. Booking chưa có trong hệ thống được tạo ở lần lập lệnh đầu tiên, không gán số lượng.

### DEC-035 — Quyền hoàn tất công việc các bộ phận

- Trạng thái: CONFIRMED (2026-10-22)
- Quyết định: Không tách người làm và người duyệt. Vệ sinh: bộ phận Vệ sinh và **Văn phòng**. Xe nâng (hạ vỏ, đảo chuyển): bộ phận Xe nâng và **Văn phòng** (giữ thêm Hiện trường, Quản lý như hiện có). Báo giá: chỉ Bộ phận Báo giá. Sửa chữa: chỉ Bộ phận Sửa chữa. `ADMIN` có toàn quyền.

### DEC-036 — ĐẢO CHUYỂN và SỬA VỊ TRÍ

- Trạng thái: CONFIRMED (2026-10-22, CR-01, CR-02)
- Quyết định:
  - **ĐẢO CHUYỂN** (Xe nâng): tác nghiệp vận hành cho bất kỳ container đang tồn bãi; màn hình có tìm số container, lọc SIZE và TIẾN ĐỘ (gồm Chờ sửa chữa); lưu lịch sử gồm tên tác nghiệp, thời gian, nhân sự, vị trí trước/sau. Thay cho hai mục cũ HẠ SỬA CHỮA / HẠ KỆ GIÁM ĐỊNH (đã gỡ khỏi menu).
  - **SỬA VỊ TRÍ** (Văn phòng / Quản lý, tại Tồn vỏ): điều chỉnh hành chính, không tạo lịch sử tác nghiệp ĐẢO CHUYỂN, không ghi là hoạt động Xe nâng; chỉ ghi nhật ký kiểm toán hệ thống.
  - Vị trí chính thức chỉ đến từ HẠ VỎ, ĐẢO CHUYỂN hoặc SỬA VỊ TRÍ; chưa có thì hiển thị `-`. Chỉ sửa vị trí / đảo chuyển container đã có vị trí chính thức.

### DEC-037 — Mã hồ sơ HẠ VỎ / CẤP VỎ

- Trạng thái: CONFIRMED (2026-10-22, CR-07)
- Quyết định: Hồ sơ HẠ VỎ `IN-YYMMDD-NNN`, hồ sơ CẤP VỎ `OUT-YYMMDD-NNN` (ví dụ `IN-261022-005`, `OUT-261022-001`); duy nhất, do hệ thống cấp. Hồ sơ cũ mang mã `HS-...` / `GO-...` được giữ nguyên, không đổi mã. Ở chế độ Supabase, số thứ tự phải được cấp trong database (an toàn khi thao tác đồng thời).

### DEC-038 — NHẬP TÀU / XUẤT TÀU

- Trạng thái: SUPERSEDED bởi DEC-069 (2026-10-24)
- Quyết định: Để giai đoạn sau. Menu vẫn hiển thị nhưng màn hình không ghi nhận dữ liệu cho tới khi quy trình chi tiết được xác nhận (OPEN-001).

### DEC-040 — Báo giá chỉ cần REMARK SỬA CHỮA (giải quyết OPEN-007)

- Trạng thái: CONFIRMED (2026-10-22)
- Quyết định: Hiện chưa có API với hãng tàu nên **không cần bước hãng tàu duyệt**. Nhân viên Báo giá chỉ nhập **REMARK SỬA CHỮA** và có quyền cập nhật container sang **Chờ sửa chữa**. Số tiền báo giá không bắt buộc.
- Đồng thời xác nhận: giữ trường KHÁCH HÀNG ở Hạ vỏ / Cấp vỏ bên cạnh SĐT LÁI XE (DEC-016 điều chỉnh); sheet XUẤT VỎ = XUẤT TÀU + trả theo lệnh riêng, NHẬP VỎ = NHẬP TÀU (Q-033).

### DEC-041 — Giờ công sửa chữa

- Trạng thái: CONFIRMED (2026-10-22)
- Quyết định: Khi chuyển container sang Chờ sửa chữa, Bộ phận Báo giá **bắt buộc** nhập REMARK SỬA CHỮA và **GIỜ CÔNG SỬA CHỮA** (số > 0, cho phép số lẻ như 2.5). Bộ phận Sửa chữa thấy remark + giờ công trong chi tiết công việc.

### DEC-042 — Danh mục chung: SỬA CHỮA (tổ sửa chữa)

- Trạng thái: CONFIRMED (2026-10-22)
- Quyết định: Danh mục chung có mục **Sửa chữa** để chia tổ sửa chữa và thêm nhân viên vào từng tổ. Chỉ ADMIN cấu hình. Tổ / nhân viên **ngưng hoạt động** thay vì xóa để giữ lịch sử. Nhân viên trong tổ nhập theo họ tên, không bắt buộc có tài khoản đăng nhập (giả định — báo lại nếu cần liên kết tài khoản).

### DEC-043 — Xác nhận hoàn tất sửa chữa

- Trạng thái: CONFIRMED (2026-10-22)
- Quyết định: Khi xác nhận sửa chữa phải chọn **TỔ SỬA CHỮA**; chọn tổ thì hiển thị nhân viên đang hoạt động trong tổ, **mặc định chọn hết**, người dùng được bỏ chọn bất kỳ ai; phải còn ít nhất 1 nhân viên. Lưu tổ + danh sách nhân viên thực hiện vào công việc sửa chữa.

### DEC-044 — Báo cáo Sửa chữa chi tiết

- Trạng thái: CONFIRMED (2026-10-22)
- Quyết định: Menu Báo cáo có **Sửa chữa chi tiết**: lọc số container / khoảng thời gian (bắt buộc ít nhất 1), tổ sửa chữa, hãng tàu, trạng thái; phân trang; tổng giờ công; xuất Excel. Cột: mã hồ sơ, số cont, size, type, hãng tàu, remark, giờ công, trạng thái, người/ngày báo giá, tổ, nhân viên, người/ngày hoàn tất.
- Kèm theo: Xe nâng – Chờ cấp vỏ hiển thị SỐ XE, SĐT LÁI XE, booking trong chi tiết công việc; Giám định – Hạ vỏ bỏ nhãn "Mới nhất".

### DEC-045 — USER - PHÂN QUYỀN và giới hạn màn hình theo vai trò

- Trạng thái: CONFIRMED (2026-10-22) — một phần chờ xác nhận (OPEN-009)
- Quyết định:
  - Danh mục chung có mục **User - Phân quyền** (chỉ ADMIN): thêm user (họ tên, email, vai trò — chọn nhiều), sửa vai trò, khóa / mở khóa. Luôn còn ≥ 1 ADMIN hoạt động; không tự khóa tài khoản đang dùng.
  - Vai trò: GIÁM ĐỊNH, VĂN PHÒNG, XE NÂNG, VỆ SINH, BÁO GIÁ, QUẢN LÝ, ADMIN, SỬA CHỮA, **QC SỬA CHỮA** (mới, `REPAIR_QC`).
  - **Mỗi vai trò chỉ thấy màn làm việc của mình**: Giám định → Hạ vỏ; Xe nâng → Chờ hạ vỏ / Chờ cấp vỏ / Đảo chuyển; Vệ sinh → Chờ vệ sinh; Báo giá → Chờ báo giá; Sửa chữa → Chờ sửa chữa. Văn phòng / Quản lý: các màn văn phòng, Tồn vỏ, Báo cáo, Danh mục (xem) và các màn được làm thay theo DEC-035. ADMIN: tất cả.
  - Danh mục chung đổi nhãn: "Container", "Sửa chữa".
- Điều chỉnh bởi DEC-047: bỏ Kế toán (Văn phòng thay), bỏ GATE_STAFF / YARD_STAFF (là Giám định), QC Sửa chữa được nghiệm thu.

### DEC-046 — Báo cáo Hạ vỏ

- Trạng thái: CONFIRMED (2026-10-22)
- Quyết định: Menu Báo cáo có **Hạ vỏ**, giao diện và cách lọc như Cấp vỏ (số container / khoảng thời gian bắt buộc, hãng tàu, size, phân trang), dữ liệu lấy từ hồ sơ HẠ VỎ: mã hồ sơ, số cont, size/type, hãng tàu, khách hàng, số xe, SĐT lái xe, trạng thái cont, trạng thái hồ sơ, thời gian giám định, GATE IN OK, chi phí (chỉ khối văn phòng).

### DEC-047 — Chốt vai trò: bỏ Kế toán, gộp Cổng/Hiện trường vào Giám định, QC nghiệm thu (giải quyết OPEN-009)

- Trạng thái: CONFIRMED (2026-10-22)
- Quyết định:
  - **Bỏ vai trò Kế toán.** Văn phòng tạo phiếu thu TTT, xác nhận thu tiền mặt, xem Phiếu thu (thay DEC-032 phần "Kế toán"). Quản lý xem được Phiếu thu.
  - **Nhân viên cổng / hiện trường chính là Giám định** → bỏ `GATE_STAFF`, `YARD_STAFF`; chỉ Giám định (và Quản lý) làm tác nghiệp Giám định – Hạ vỏ.
  - ~~QC SỬA CHỮA: xem Báo cáo sửa chữa và nghiệm thu~~ — **đã bỏ theo DEC-049**. Luồng DAMAGE: Báo giá → Sửa chữa hoàn tất → **Chờ nghiệm thu** (container vẫn DAMAGE, chưa cấp như AV) → QC **Nghiệm thu đạt** → `AV`. Menu riêng "QC sửa chữa → Chờ nghiệm thu" (mobile).
  - 9 vai trò chính thức: Giám định, Văn phòng, Xe nâng, Vệ sinh, Báo giá, Quản lý, Admin, Sửa chữa, QC Sửa chữa.
  - Dữ liệu cũ tự quy đổi: GATE_STAFF / YARD_STAFF → Giám định; ACCOUNTANT → Văn phòng.
- (Q-035 không còn hiệu lực — DEC-049.)

### DEC-049 — Bỏ vai trò và menu QC Sửa chữa; Đảo chuyển là tác nghiệp mobile

- Trạng thái: CONFIRMED (2026-10-22) — **thay phần QC của DEC-047**
- Quyết định:
  - Bỏ vai trò **QC Sửa chữa** và menu **QC sửa chữa → Chờ nghiệm thu**. Vai trò **Sửa chữa** là đủ: Sửa chữa chọn tổ + nhân viên, xác nhận hoàn tất → container chuyển **AV** ngay (không còn bước nghiệm thu). Q-035 không còn cần trả lời.
  - Còn **8 vai trò**: Giám định, Văn phòng, Xe nâng, Vệ sinh, Báo giá, Quản lý, Admin, Sửa chữa.
  - Báo cáo Sửa chữa chi tiết: khối Văn phòng / Quản lý (và Admin).
  - **Xe nâng → Đảo chuyển là tác nghiệp mobile**: khung mobile như các màn hiện trường, danh sách dạng thẻ, container đang chọn hiển thị trên cùng, "Xem thêm" thay phân trang, lịch sử thu gọn.
  - Dữ liệu cũ: user QC → Sửa chữa; container đang "chờ nghiệm thu" → AV.

### DEC-048 — Thêm user có sẵn vào tổ sửa chữa

- Trạng thái: CONFIRMED (2026-10-22)
- Quyết định: Danh mục chung → Sửa chữa cho **chọn user đang hoạt động có vai trò Sửa chữa** để thêm vào tổ (liên kết tài khoản, gắn nhãn "user"); vẫn cho nhập họ tên nhân viên không có tài khoản. Không thêm trùng một user vào cùng tổ; user bị khóa không thêm được.

### DEC-050 — Excel .xlsx; Block do Admin cấu hình (giải quyết Q-034, Q-006)

- Trạng thái: CONFIRMED (2026-10-23)
- Quyết định:
  - Báo cáo Tổng hợp và Sửa chữa chi tiết xuất **Excel `.xlsx` chuẩn** (thư viện `exceljs`, chỉ tải khi bấm "Tải Excel"; dòng tiêu đề đậm, cố định, tự giãn cột).
  - **Block bãi không gán cứng trong database**: Admin tự cấu hình ở Danh mục chung → Vị trí bãi. Block mẫu (BLOCK-A/B/CLEAN/DAMAGE) chỉ dùng cho dữ liệu chạy thử.
- Ghi chú kỹ thuật: `npm audit` báo 2 cảnh báo mức trung bình từ `uuid` (phụ thuộc của `exceljs`); lỗi nằm ở hàm ghi vào buffer của `uuid`, ứng dụng không dùng. Theo dõi khi `exceljs` ra bản mới.
- Còn chờ: **danh mục trạng thái chính thức** (OPEN-003) — người dùng sẽ gửi danh sách; chặn việc viết schema database (P4-01).

### DEC-051 — Phiếu thu ghi rõ tác nghiệp; hồ sơ link về Phiếu thu

- Trạng thái: CONFIRMED (2026-10-23)
- Quyết định:
  - Mỗi phiếu thu ghi rõ **TÁC NGHIỆP**: `HẠ VỎ`, `CẤP VỎ`, `THU TRƯỚC (TTT)` (nạp Phiếu thu mẹ). Hiển thị ở danh sách, ở chi tiết phiếu thu (dòng "TÁC NGHIỆP" nổi bật để in), và có bộ lọc "Tác nghiệp" khi tra cứu.
  - Trong **hồ sơ container**, mỗi chứng từ (Hạ vỏ, Cấp vỏ) có khung **"Thu tiền — <tác nghiệp>"** nổi bật theo màu trạng thái: đã thu (TTTT → link phiếu thu; TTT → Phiếu thu mẹ + link phiếu thu gốc), công nợ TTS, đang chờ chuyển khoản (link yêu cầu), chưa thanh toán, đã hủy. Mục "Phiếu thu" cuối hồ sơ hiển thị nhãn tác nghiệp và link.
  - Bấm link → đóng hồ sơ, mở **Văn phòng → Phiếu thu** và mở đúng phiếu đó. Chỉ hiện link với người được vào menu Phiếu thu (Văn phòng, Quản lý, Admin); vai trò khác chỉ thấy chữ.

### DEC-052 — Phiếu K80 có LỘ TRÌNH; Văn phòng quét mã trả chứng từ

- Trạng thái: CONFIRMED (2026-10-23)
- Quyết định:
  - **Phiếu K80** bố cục: (1) **thông tin chung ở đầu** — loại tác nghiệp HẠ VỎ / CẤP VỎ, mã hồ sơ, số cont, size/type/AGE, **số xe**, **SĐT lái xe**, trạng thái, vệ sinh, thanh toán; (2) **LỘ TRÌNH** các bước đánh số, mỗi bước ghi bộ phận + việc phải làm, có **ô ☐ để tích bằng bút**; (3) mã QR. Xem trên app thì bước đã xong hiện ✓ + giờ, bước kế tiếp được tô nổi.
  - Lộ trình: **HẠ VỎ** = Văn phòng thu phí → Vệ sinh (nếu có) → Xe nâng hạ vỏ → **Văn phòng trả chứng từ**. **CẤP VỎ** = Văn phòng thu phí → Xe nâng cấp vỏ → **Văn phòng trả chứng từ**.
  - **Bước cuối mới — Văn phòng → Trả chứng từ:** lái xe quay về Văn phòng, quét QR phiếu K80 → hệ thống ghi nhận trả chứng từ và **tự mở lệnh in EEIR + phiếu thu (nếu có)**. Chỉ trả được khi đã qua đủ các bộ phận trước; mỗi phiếu trả 1 lần. Quyền: Văn phòng / Quản lý.
  - EEIR in kèm bảng các bước đã xác nhận (người, giờ) và chỗ ký lái xe / đại diện bãi. TTT / TTS không có phiếu thu (ghi chú trên bộ chứng từ).

### DEC-053 — Xe nâng – Chờ cấp vỏ: làm nổi số container + vị trí (THAY BỞI DEC-061)

- Trạng thái: CONFIRMED (2026-10-23)
- Quyết định: Khi quét phiếu ở **Xe nâng → Chờ cấp vỏ**, **SỐ CONTAINER** và **VỊ TRÍ HIỆN TẠI** hiển thị trong khung nền đậm, chữ lớn, ở trên cùng chi tiết công việc.

### DEC-054 — Định dạng thời gian thống nhất: dd/MM/yyyy HH:mm:ss

- Trạng thái: CONFIRMED (2026-10-23)
- Quyết định: **Mọi chỗ liên quan tới thời gian trong app** (hiển thị, bộ lọc báo cáo / phiếu thu, phiếu K80, EEIR, file Excel, thông báo lỗi) dùng **Ngày/Tháng/Năm Giờ:Phút:Giây**, 24 giờ, ví dụ `23/10/2026 07:05:09`.
  - Bộ lọc thời gian là ô nhập `dd/mm/yyyy hh:mm:ss` (tự chèn dấu khi gõ số, viền đỏ khi sai, từ chối ngày không tồn tại). Nhập thiếu giờ thì TỪ = 00:00:00, ĐẾN = 23:59:59. Mặc định: 1 ngày trước → hiện tại (DEC-056).
  - Kỹ thuật: chỉ dùng `src/services/datetime.ts` (`formatDateTime`, `parseDateTime`) và component `DateTimeField`; không dùng `toLocaleString` / `<input type="date">` trực tiếp.

### DEC-055 — Xuất Excel theo bộ lọc ở Phiếu thu và mọi báo cáo

- Trạng thái: CONFIRMED (2026-10-23)
- Quyết định: **Văn phòng → Phiếu thu** và **tất cả báo cáo** (Hạ vỏ, Cấp vỏ, Nhập tàu, Xuất tàu, Sửa chữa chi tiết, Tổng hợp) có nút **Xuất Excel** — xuất **toàn bộ kết quả theo bộ lọc đang áp dụng** (mọi trang), file `.xlsx`.
  - Kiểu file: basic, chuyên nghiệp — 1 dòng tiêu đề đậm nền xám, viền mỏng, cố định dòng tiêu đề, bộ lọc cột, số tiền có dấu phân cách, tự giãn cột; **đủ các cột** của hồ sơ (cùng bộ cột với sheet tương ứng của báo cáo Tổng hợp; Phiếu thu có thêm cột Tác nghiệp, chứng từ, phiếu thu mẹ, mã giao dịch ngân hàng, người/giờ xác nhận).
  - Tên file: `MATRAN_<LOẠI>_<dd-MM-yyyy_HHmmss>.xlsx`.

### DEC-056 — Mặc định khoảng thời gian bộ lọc

- Trạng thái: CONFIRMED (2026-10-23)
- Quyết định: Phiếu thu và mọi báo cáo, khi mở lần đầu, bộ lọc thời gian **mặc định = 1 ngày trước → thời điểm hiện tại** (ví dụ `22/10/2026 10:10:10` → `23/10/2026 10:10:10`). Người dùng sửa được; thay cho mặc định "hôm nay 00:00:00 → 23:59:59" của DEC-054. Kỹ thuật: `defaultLastDayRange()` trong `src/services/datetime.ts`. **Đã thay bằng DEC-102 (2026-10-25): mặc định Hôm nay.**

### DEC-057 — Mã QR phiếu K80 duy nhất; đóng mã sau khi trả chứng từ

- Trạng thái: CONFIRMED (2026-10-23)
- Quyết định:
  - Mã QR tạo theo **mã hồ sơ**: `QR-IN-YYMMDD-NNN` (Hạ vỏ), `QR-OUT-YYMMDD-NNN` (Cấp vỏ) — không theo số container. Container quay lại bãi hoặc lập lệnh cấp lại sau khi hủy đều có mã mới, không trùng phiếu cũ. (Sửa lỗi: trước đây `QR-K80-<số cont>` bị trùng giữa các lượt.)
  - Hủy lệnh cấp → container quay về mã QR của phiếu Hạ vỏ của lượt lưu bãi.
  - Phiếu đã đi hết lộ trình và **trả chứng từ** → mã QR **đóng**: không in lại phiếu K80, không trả chứng từ lần 2, quét ở bộ phận khác báo "mã đã đóng".

### DEC-058 — Cấu trúc hồ sơ container thống nhất (Hạ vỏ – Cấp vỏ)

- Trạng thái: CONFIRMED (2026-10-23)
- Quyết định:
  - **Mở đầu: thông tin cơ bản container**, nền đậm, **số container chữ lớn**; kèm mã hồ sơ IN / OUT, trạng thái, khóa, size/type, hãng tàu, trạng thái / đóng hàng, AGE, vị trí, khách hàng, vệ sinh, giờ gate in.
  - Sau đó **từng bộ phận – tác nghiệp theo thứ tự từ trên xuống**, đánh số: HẠ VỎ = Giám định → Văn phòng → **Thanh toán** → Vệ sinh (nếu có) → Xe nâng (hạ vỏ + đảo chuyển) → Báo giá → Sửa chữa (nếu DAMAGE) → Văn phòng trả chứng từ; CẤP VỎ = Văn phòng → **Thanh toán** → Xe nâng → Văn phòng trả chứng từ.
  - **Xác nhận bên phải mỗi khối**: tích xanh **HOÀN THÀNH** + người xác nhận + thời gian; chưa xong thì hiện việc đang chờ.
  - **Thanh toán là mục riêng, ngay dưới Văn phòng, chỉ 1 lần mỗi tác nghiệp**: dòng chi phí, chứng từ, tổng, bên thanh toán, trạng thái rõ ràng (ĐÃ THANH TOÁN / TTS công nợ / CHỜ CHUYỂN KHOẢN / CHƯA THANH TOÁN), **link phiếu thu đầy đủ** (TTTT: phiếu thu; TTT: phiếu thu gốc của Phiếu thu mẹ; chờ chuyển khoản: link yêu cầu), xác nhận người + giờ.

### DEC-059 — Giám định xóa hồ sơ hạ vỏ khi Văn phòng chưa thao tác

- Trạng thái: CONFIRMED (2026-10-23)
- Quyết định: Giám định (và Quản lý, Admin) được **xóa hẳn** hồ sơ hạ vỏ khi hồ sơ còn ở trạng thái chờ Văn phòng (Văn phòng chưa bổ sung thông tin, chưa lập chứng từ). **Không lưu lịch sử, không ghi nhật ký** (người dùng xác nhận). Xác nhận 2 bước trên màn hình. Mã hồ sơ đã cấp **không được cấp lại** cho hồ sơ khác. Văn phòng đã thao tác thì không xóa được.

### DEC-060 — Văn phòng Hạ vỏ: kiểm tra Tồn vỏ ngay khi nhập số container

- Trạng thái: CONFIRMED (2026-10-23)
- Quyết định: Ngay khi nhập đủ **SỐ CONTAINER** (4 chữ + 7 số), hệ thống kiểm tra: container đang có trong **TỒN VỎ** (chưa OUT) hoặc đang có hồ sơ Hạ vỏ khác chưa hoàn tất → báo đỏ ngay dưới ô (kèm mã hồ sơ + vị trí) và **chặn** không mở các bước tiếp (chi phí, thanh toán). Cùng một hàm `gateInContainerConflict` dùng cho giao diện và kiểm tra khi xác nhận.

### DEC-061 — Khung nổi bật thống nhất ở Xe nâng (Chờ hạ vỏ / Chờ cấp vỏ)

- Trạng thái: CONFIRMED (2026-10-23) — thay DEC-053
- Quyết định: Sau khi quét mã ở **Xe nâng → Chờ hạ vỏ** và **Xe nâng → Chờ cấp vỏ**, thông tin chính nằm trong **một khung nền đậm giống nhau**, chữ lớn, tối ưu đọc trên điện thoại:
  - Dòng 1: **SỐ CONTAINER** (rất lớn; có nhãn ĐANG KHÓA nếu bị khóa).
  - Dòng 2: **SIZE / TYPE** + (Chờ hạ vỏ: **TRẠNG THÁI / ĐÓNG HÀNG**; Chờ cấp vỏ: **VỊ TRÍ HIỆN TẠI**).
  - Các dòng chi tiết bên dưới bỏ phần trùng với khung (chỉ còn AGE, vệ sinh, số xe / SĐT, hồ sơ...).

### DEC-062 — Danh mục CÔNG TY; mẫu in phiếu thu thống nhất

- Trạng thái: CONFIRMED (2026-10-23)
- Quyết định:
  - Danh mục chung có mục **Công ty** (chỉ Admin sửa): tên công ty, tên viết tắt, mã số thuế, địa chỉ, điện thoại, email, tài khoản ngân hàng. Thông tin này in ở đầu **phiếu thu, EEIR, phiếu K80**.
  - **Một mẫu in phiếu thu duy nhất** dùng ở Văn phòng → Phiếu thu và Văn phòng → Trả chứng từ: thông tin công ty, PHIẾU THU + số phiếu, **TÁC NGHIỆP (HẠ VỎ / CẤP VỎ / THU TRƯỚC)**, bên thanh toán, mã hồ sơ, số cont, chứng từ, hình thức, thời gian thu, các dòng chi phí, tổng thu, chỗ ký người nộp / người thu.
  - Khi in chỉ in phần giấy tờ (không in menu / màn hình).

### DEC-063 — Theo dõi số lần in phiếu thu

- Trạng thái: CONFIRMED (2026-10-23)
- Quyết định: Mỗi lần in phiếu thu được ghi nhận (người + giờ) và ghi nhật ký kiểm toán. Danh sách Phiếu thu có cột **Đã in**; chi tiết có **Lịch sử in**; Excel có cột SỐ LẦN IN / IN GẦN NHẤT. Từ lần in thứ 2 phải **xác nhận "In lại"** (hiện số lần đã in, lần gần nhất), bản in ghi **"BẢN IN LẠI — LẦN N"**. In tự động khi Trả chứng từ cũng tính là 1 lần in. Quyền in: Văn phòng / Quản lý.

### DEC-064 — Trả chứng từ chia 2 phần HẠ VỎ / CẤP VỎ

- Trạng thái: CONFIRMED (2026-10-23)
- Quyết định (sửa 2026-10-23): Văn phòng → Trả chứng từ chỉ có **1 ô quét mã chung** (nhận cả phiếu Hạ vỏ và Cấp vỏ). Danh sách **Đang chờ trả chứng từ chia 2 cột HẠ VỎ / CẤP VỎ**, mỗi cột có số lượt đang chờ.

### DEC-065 — Khóa = Remark Văn phòng; cont khóa vẫn hiện ở Cấp vỏ; Excel Tồn vỏ

- Trạng thái: CONFIRMED (2026-10-23) — bổ sung DEC-030
- Quyết định:
  - Khi KHÓA container, nội dung bắt buộc là **REMARK VĂN PHÒNG** (ghi thẳng vào cột Ghi chú văn phòng ở Tồn vỏ), không phải một ghi chú riêng.
  - Văn phòng → Cấp vỏ: container **đang khóa vẫn hiển thị** trong danh sách (chỉ hiện biểu tượng khóa), danh sách có cột **Ghi chú văn phòng**, nhưng **không chọn để cấp được** — phải mở khóa ở Tồn vỏ trước.
  - Tồn vỏ có nút **Xuất Excel** (theo bộ lọc đang chọn; gồm cột khóa, người khóa, Remark Văn phòng).

### DEC-066 — Dữ liệu lớn: hiệu năng báo cáo, xuất Excel, thời gian lưu

- Trạng thái: CONFIRMED (2026-10-23) — áp dụng khi làm P4-01 Database
- Bối cảnh: ~5.000 Hạ vỏ + ~5.000 Cấp vỏ mỗi tháng, chạy 5–10 năm (~1,2 triệu hồ sơ; nhật ký kiểm toán ~12 triệu dòng). Báo cáo 1 tháng có thể 3.000–5.000 dòng.
- Quyết định:
  - **Giới hạn 1 lần lọc báo cáo / Phiếu thu: tối đa 3 tháng.** Số liệu dài hơn xem ở Báo cáo Tổng hợp (số liệu tính sẵn theo ngày).
  - **Xuất Excel:** ≤ 20.000 dòng xuất trực tiếp trên trình duyệt (lấy dữ liệu từ database theo lô 1.000 dòng); > 20.000 dòng xuất **phía máy chủ** (Edge Function tạo file, báo "đang chuẩn bị file").
  - **Thời gian lưu: giữ đủ 10 năm, không xóa.** Chỉ chuyển nhật ký kiểm toán cũ sang kho lưu trữ khi thật cần; vẫn tra cứu được.
  - Lọc, phân trang, đếm, tổng hợp chạy **trên database** (RPC), không tải toàn bộ về trình duyệt. Phân trang con trỏ (keyset), không dùng OFFSET.
  - Ảnh giám định / sửa chữa lưu ở Storage; database chỉ lưu đường dẫn.
- Chi tiết kỹ thuật: `docs/DATABASE_CONTRACT.md` mục 10.

### DEC-067 — Tồn vỏ: cột LƯU BÃI, khóa tại icon, ghi chú, thao tác hàng loạt

- Trạng thái: CONFIRMED (2026-10-24)
- Quyết định:
  - Cột **LƯU BÃI** ngay bên phải cột Trạng thái = **số ngày lịch** từ ngày gate in đến hôm nay, số nguyên; **ngày hạ vỏ = 0** (`storageDays`). Excel Tồn vỏ có cột này và đủ thông tin (AGE, tiến độ, khách hàng, số xe, khóa, ghi chú + người / giờ ghi chú).
  - **Bỏ cột Thao tác.** Khóa / mở khóa bằng **icon khóa cạnh số container**: đang khóa = icon khóa **đỏ**; không khóa (mặc định khi gate in) = icon khóa mở **xám mờ**. Bấm icon (người có quyền) để khóa / mở khóa — vẫn bắt buộc ghi chú (DEC-065).
  - Cột **Vị trí**: icon bút Sửa vị trí canh thẳng cột bên phải ô (giống cột Ghi chú).
  - "Ghi chú văn phòng" đổi tên hiển thị thành **GHI CHÚ**; ô có ghi chú **tô nền vàng**. Bỏ dấu ghim ở Mã hồ sơ. Dòng có ghi chú vẫn xếp lên đầu.
  - **Tìm hàng loạt**: dán danh sách số container → lọc đúng các cont đó, báo các số không có trong tồn vỏ. **Chọn nhiều** (ô chọn từng dòng / chọn tất cả theo bộ lọc) → **Khóa / Mở khóa / Ghi chú hàng loạt** (`bulkToggleContainerHold`, `bulkUpdateOfficeNote`): áp dụng từng cont qua đúng hàm đơn lẻ (quyền, nhật ký), cont đã ở trạng thái đích được bỏ qua và báo lại.

### DEC-068 — Tiền tố mã hồ sơ = viết tắt tác nghiệp (thay DEC-037 phần tiền tố)

- Trạng thái: CONFIRMED (2026-10-24)
- Quyết định: Ký tự đầu của mọi mã = viết tắt tác nghiệp, một quy chuẩn duy nhất:

  | Tác nghiệp | Mã | Đánh số |
  |---|---|---|
  | HẠ VỎ | `HV-YYMMDD-NNN` | lại từ 001 mỗi ngày |
  | CẤP VỎ | `CV-YYMMDD-NNN` | lại từ 001 mỗi ngày |
  | NHẬP TÀU (mỗi container) | `NT-YYMMDD-NNN` | lại từ 001 mỗi ngày |
  | XUẤT TÀU (mỗi container) | `XT-YYMMDD-NNN` | lại từ 001 mỗi ngày |
  | PHIẾU THU | `PT-YYYY-NNNNNN` | liên tục theo năm |
  | PHIẾU THU TRƯỚC (phiếu thu mẹ TTT) | `PTT-YYYY-NNN` | liên tục theo năm |
  | Chứng từ | `CT-…` | giữ nguyên |

  - **Đổi cả mã cũ** (người dùng chọn): khi nạp dữ liệu, `IN-`/`HS-` → `HV-`, `OUT-`/`GO-` → `CV-`, `PTM-` → `PTT-` trên toàn bộ dữ liệu (mã, QR `QR-<mã>`, nội dung nhật ký, bộ đếm) — `renameLegacyCodes` trong `src/services/codes.ts`. Phần số giữ nguyên.
  - Mã chỉ cấp qua `allocateCode` (`codes.ts`). Tác nghiệp mới phải thêm tiền tố vào bảng này trước.

### DEC-069 — NHẬP TÀU / XUẤT TÀU (thay DEC-038, giải quyết phần NHẬP TÀU của OPEN-001)

- Trạng thái: CONFIRMED (2026-10-24)
- Chung:
  - Tác nghiệp theo **danh sách tàu** do **Văn phòng / Quản lý** lập: TÊN TÀU, THỜI GIAN NHẬP / XUẤT TÀU, DANH SÁCH SỐ XE, danh sách container.
  - **Mỗi container 1 hồ sơ**: `NT-YYMMDD-NNN` / `XT-YYMMDD-NNN` (DEC-068); hồ sơ hiển thị cùng cấu trúc Hạ vỏ / Cấp vỏ (DEC-058).
  - **Không thu phí, không phiếu thu, không phiếu K80, không Trả chứng từ.**
  - Mọi bộ phận liên quan có menu riêng và **theo dõi tiến độ** danh sách (xong / chờ). Hết danh sách → **Văn phòng / Quản lý DUYỆT thành công** (chỉ duyệt khi đã xong 100%). Danh sách đã duyệt không thao tác thêm.
  - Văn phòng được **bỏ container còn chờ** khỏi danh sách (chưa tác nghiệp).
  - Màn hiện trường tối ưu mobile (`max-w-lg`, nút lớn, "Xem thêm").
- **NHẬP TÀU** — bộ phận: Văn phòng, Giám định, Vệ sinh, Xe nâng.
  - Văn phòng lập danh sách: tên tàu, thời gian, **HÃNG TÀU bắt buộc (1 hãng / danh sách)**, số xe, container (SỐ CONT – SIZE – TYPE; dán từ Excel được). Chặn cont đang tồn bãi / đang có hồ sơ Hạ vỏ / đang chờ ở danh sách nhập tàu khác.
  - **Giám định** (mobile): xác nhận **số cont về thực tế** (phải khớp danh sách), **chọn số xe** (trong danh sách xe), **TRẠNG THÁI DAMAGE / AV***, **ĐÓNG HÀNG M / K / E***, **TÌNH TRẠNG VỆ SINH*** (1 hoặc nhiều), **AGE*** → cấp mã NT-, tạo lượt lưu bãi.
  - **Vệ sinh** (nếu có) → **Xe nâng hạ cont + cập nhật vị trí** — dùng chung hàng chờ và hàm của Hạ vỏ (menu "Nhập tàu" của Vệ sinh / Xe nâng chỉ lọc cont NT-).
  - Cont xong bước Xe nâng → **có trong Tồn vỏ ngay**, Văn phòng **Cấp vỏ được ngay**.
  - **DAMAGE như Hạ vỏ**: vào hàng chờ Báo giá → Sửa chữa → AV.
- **XUẤT TÀU** — bộ phận: Văn phòng, Giám định, Xe nâng.
  - Văn phòng lập danh sách **chọn từ Tồn vỏ**, hiển thị đủ: số cont, size, type, hãng tàu, trạng thái, phân loại, vị trí hiện tại, lưu bãi, ghi chú. Được chọn **mọi cont đang tồn bãi**, trừ: cont **đang khóa**, đã lập lệnh cấp vỏ, đã nằm trong danh sách xuất tàu khác (hiện lý do, không chọn được).
  - Cont đã vào danh sách xuất tàu thì **không Cấp vỏ được** cho tới khi bỏ khỏi danh sách.
  - **Giám định / Xe nâng** (mobile): chọn container → **gán số xe** (trong danh sách xe) → cont **OUT khỏi bãi** (lịch sử vị trí "XUẤT TÀU <tàu> (<xe>)"); các việc Vệ sinh / Báo giá / Sửa chữa còn mở của lượt lưu bãi được đóng. Cont bị khóa sau khi lập danh sách → phải mở khóa trước khi xuất.
- Báo cáo: **Báo cáo → Nhập tàu / Xuất tàu** (lọc theo thời gian nhập / xuất tàu, tên tàu, số cont; phân trang; Excel). Báo cáo Tổng hợp: sheet NHẬP VỎ / XUẤT VỎ lấy từ dữ liệu này.
- Code: `src/services/vessel.ts`; quyền `VESSEL_LIST_MANAGE`, `VESSEL_IMPORT_INSPECT`, `VESSEL_EXPORT_EXECUTE`.

### DEC-070 — Hoàn thiện Nhập tàu / Xuất tàu: menu, màn Văn phòng, sửa danh sách, sắp xếp, tìm kiếm

- Trạng thái: CONFIRMED (2026-10-24) — bổ sung DEC-069
- Quyết định:
  - **Bỏ menu Vệ sinh → Nhập tàu.** Cont nhập tàu có yêu cầu vệ sinh nằm chung trong **Vệ sinh → Chờ vệ sinh** (cùng mục đích, tác nghiệp, kết quả). Còn **10** màn mobile.
  - **Văn phòng → Nhập tàu / Xuất tàu**: màn chính là **danh sách đang thực hiện** (bảng: tên tàu, thời gian, hãng tàu, số cont, tiến độ, số xe, người lập); **nút Lập danh sách ở bên phải tiêu đề**; bấm một dòng → **chi tiết**.
  - **Khi chưa DUYỆT thành công**, Văn phòng / Quản lý được:
    - **Sửa thông tin**: tên tàu, thời gian, danh sách số xe; **hãng tàu** chỉ đổi được khi chưa có cont nào được giám định.
    - **Thêm cont**: nhập tàu dán từ Excel, xuất tàu chọn từ tồn vỏ (cùng kiểm tra như lúc lập; xuất tàu cấp mã XT- mới).
    - **Bỏ cont** còn chờ.
    - **Xóa cả danh sách**: chỉ khi **chưa có cont nào được tác nghiệp** (tránh mất hồ sơ NT- / cont đã OUT); xóa danh sách xuất tàu thì cont mở lại cho cấp vỏ.
    - Danh sách đã duyệt: chỉ xem.
  - **Sắp xếp**: danh sách container luôn theo **size 20 → 40 → 45, cùng size thì số cont A→Z** (`sortVesselItems`) — ở màn Giám định / Xe nâng, chi tiết Văn phòng, chọn từ tồn vỏ.
  - **Tìm kiếm** ở màn Giám định / Xe nâng giống Tồn vỏ: **lọc ngay khi gõ** (số cont chứa chuỗi đã nhập); bấm tìm khi chỉ còn 1 cont khớp thì chọn luôn.

### DEC-071 — Màn hiện trường Nhập tàu / Xuất tàu: theo dõi đã làm / chờ làm

- Trạng thái: CONFIRMED (2026-10-24) — bổ sung DEC-069, DEC-070
- Bối cảnh: màn cũ chỉ hiện cont đang chờ; cont làm xong biến mất → người tác nghiệp không biết đã làm những cont nào, khó kiểm soát.
- Quyết định — **một mẫu màn chung** cho Giám định → Nhập tàu, Xe nâng → Nhập tàu, Giám định → Xuất tàu, Xe nâng → Xuất tàu:
  - **Khung tiến độ luôn ở trên**: tàu (chọn tàu nếu có nhiều, kèm xong/tổng), **ĐÃ XONG / TỔNG** chữ lớn + thanh tiến độ, số **chờ làm**, số **chưa tới lượt**, **"Bạn đã làm"**, và **số cont theo từng xe**.
  - **Tab Chờ làm / Đã xong / Tất cả.** Mỗi thẻ có biểu tượng trạng thái: ○ chờ làm, ⏱ chưa tới lượt (xám), ✓ đã xong (xanh, kèm **số xe, người làm — "Bạn" nếu là mình, giờ**). Thẻ đã xong bấm vào mở hồ sơ, không làm lại được.
  - **Chống làm trùng**: tìm / gõ trúng cont đã làm → báo **"ĐÃ <bước> — người, giờ, xe. Không làm lại."**; cont chưa tới lượt → báo lý do; cont không có trong danh sách → báo rõ "KHÔNG có trong danh sách tàu".
  - Dải **"Vừa <bước>"**: 5 cont vừa xác nhận gần nhất (số cont, xe, giờ, link hồ sơ).
  - Trạng thái từng bước do service tính (`vesselStepInfo`, `vesselStepSummary`):
    - Giám định Nhập tàu: chờ làm = chưa giám định; xong = đã giám định.
    - Xe nâng Nhập tàu: **chưa tới lượt** = chưa giám định hoặc còn chờ Vệ sinh; chờ làm = đã giám định, xong vệ sinh (nếu có); xong = đã hạ bãi. Hạ cont dùng chung hàm và bộ chọn vị trí của Hạ vỏ.
    - Xuất tàu (Giám định / Xe nâng dùng chung tiến độ): chờ làm = chưa xuất; xong = đã xuất.
  - Xe nâng → Nhập tàu chuyển sang mẫu màn này (bỏ màn hàng chờ lọc `vesselOnly`).

### DEC-072 — In EEIR từ hồ sơ; mẫu EEIR và Phiếu thu đồng bộ

- Trạng thái: CONFIRMED (2026-10-24) — bổ sung DEC-052, DEC-062, DEC-063
- Lỗi đã sửa: nút "In hồ sơ" ở Tồn vỏ → hồ sơ container in ra **trang trắng** (CSS in chỉ in vùng `print-area`, hồ sơ không có vùng này).
- Quyết định:
  - Giấy in từ hồ sơ là **EEIR** (thông tin Hạ vỏ / Cấp vỏ chi tiết gửi khách hàng **kèm phiếu thu**). Hồ sơ có thanh in cho **từng lượt**: **In EEIR HẠ VỎ / CẤP VỎ** và **In EEIR + phiếu thu**. Bỏ nút "In hồ sơ".
  - **EEIR và Phiếu thu dùng chung một khung in** (`src/components/ReceiptPrint.tsx`): đầu CÔNG TY → tiêu đề + **Số** (mã hồ sơ / số phiếu) → nhãn **TÁC NGHIỆP** → bảng thông tin → bảng chi tiết → chữ ký 2 bên → "In lúc …". Cùng cỡ chữ, viền, bố cục.
  - EEIR gồm: số cont, size/type, hãng tàu, trạng thái • đóng hàng, AGE, hư hỏng, vệ sinh, khách hàng, booking (Cấp vỏ) / số lệnh (Hạ vỏ), số xe • SĐT, thời gian GATE IN / OUT, vị trí hạ / lấy, thanh toán, lộ trình các bộ phận đã xác nhận.
  - In kèm phiếu thu **vẫn đếm số lần in**: đã in trước đó → hỏi xác nhận "In lại", bản in có nhãn BẢN IN LẠI (DEC-063). Văn phòng → Trả chứng từ: lần in tự động = EEIR + phiếu thu; nút "In lại EEIR" chỉ in EEIR.
  - Kỹ thuật: lệnh in đi qua `PrintPortal` (gắn vào `<body>`, không bị cửa sổ đang mở cắt); khi có lệnh in này, các vùng in khác trên trang bị ẩn — mỗi lần in đúng 1 bộ giấy tờ.

### DEC-073 — Lập danh sách XUẤT TÀU: Tìm hàng loạt như Tồn vỏ

- Trạng thái: CONFIRMED (2026-10-24) — bổ sung DEC-069, DEC-070
- Quyết định: Bộ chọn container từ tồn vỏ (Văn phòng → Xuất tàu: **Lập danh sách** và **Thêm cont**) có nút **Tìm hàng loạt** giống Tồn vỏ (DEC-067): dán danh sách số cont (mỗi dòng / dấu phẩy / khoảng trắng) → lọc đúng các cont đó, báo số tìm thấy / chọn được, nút **Chọn tất cả cont tìm được**, báo các số **không có trong tồn vỏ**. Cont không đưa vào xuất tàu được (khóa, đã lập lệnh cấp, đã trong danh sách khác) vẫn hiện lý do, không chọn được.

### DEC-074 — Tồn vỏ: cột DATE IN, sắp lại độ rộng cột

- Trạng thái: CONFIRMED (2026-10-24) — bổ sung DEC-067
- Quyết định:
  - Thêm cột **DATE IN** = thời gian container vào bãi (Hạ vỏ hoặc Nhập tàu — `gateInAt`), đặt **giữa HÃNG TÀU và TRẠNG THÁI**. Hiển thị 2 dòng: ngày `dd/MM/yyyy`, giờ `HH:mm:ss` chữ nhỏ.
  - Excel Tồn vỏ: **DATE IN** ngay sau HÃNG TÀU (thay cột GATE IN cũ ở cuối) và thêm cột **VÀO BÃI BẰNG** (HẠ VỎ / NHẬP TÀU).
  - Độ rộng cột: Mã hồ sơ, Số cont không xuống dòng; Size, Type, Trạng thái hẹp và căn giữa; Lưu bãi căn phải; Vị trí, Tiến độ vừa; **Ghi chú rộng nhất**; khoảng đệm ô gọn hơn.

### DEC-075 — Menu báo việc đang chờ cho Nhập tàu / Xuất tàu và mọi việc hiện trường

- Trạng thái: CONFIRMED (2026-10-24) — bổ sung DEC-071
- Bối cảnh: có việc Nhập tàu / Xuất tàu đang chờ nhưng menu Giám định / Xe nâng không có số đếm, ô đếm của các mục khác màu xám nhạt → bộ phận không thấy việc.
- Quyết định:
  - Menu có **số đếm việc chờ** cho: Giám định → Nhập tàu (cont chờ giám định), Xe nâng → Nhập tàu (cont chờ hạ bãi, đã xong vệ sinh), Giám định / Xe nâng → Xuất tàu (cont chờ xuất) — cộng mọi tàu đang mở, cùng cách tính với tab "Chờ làm" (`vesselStepSummary`). Văn phòng → Nhập tàu / Xuất tàu: số danh sách đang thực hiện.
  - **Mọi mục tác nghiệp hiện trường (mục có biểu tượng điện thoại) đang có việc chờ**: ô đếm **màu cam + chấm nhấp nháy** ("Có việc đang chờ"); nhóm menu chứa mục đó cũng hiện số **màu cam** (cả khi thu gọn / thanh biểu tượng). Không có việc thì không hiện số.

### DEC-076 — Phiếu thu: nút Tạo phiếu thu TTT; in EEIR + Phiếu thu trên 1 tờ A4 (mỗi phiếu A5)

- Trạng thái: CONFIRMED (2026-10-24) — bổ sung DEC-062, DEC-072
- Quyết định:
  - Văn phòng → Phiếu thu: **"Tạo phiếu thu TTT (thanh toán trước)" là nút tác nghiệp cùng hàng với TRA CỨU – XUẤT EXCEL**; bấm nút mở form tạo phiếu (1 hàng ngang) ngay dưới khung tra cứu, tạo xong tự đóng. Bỏ khung tạo phiếu ở cột phải.
  - **Khổ in**: mỗi phiếu (EEIR, Phiếu thu) chiếm **nửa tờ A4 = khổ A5 (210 × 148 mm)**; **EEIR + Phiếu thu = 1 tờ A4** (đường cắt giữa 2 nửa), 2 phiếu thì sang trang mới. Khổ giấy dùng tên riêng (`@page a4sheet`) — **không ảnh hưởng phiếu K80 in nhiệt 80mm**.
  - **EEIR không in các bộ phận / lộ trình**; thay bằng khối **TÌNH TRẠNG VỎ (GIÁM ĐỊNH)**: trạng thái DAMAGE / AV, đóng hàng, hư hỏng, vệ sinh, AGE, người giám định + giờ.
  - Nội dung quá dài so với nửa tờ (VD rất nhiều dòng chi phí) sẽ bị cắt — cần thử in thực tế để chỉnh nếu gặp.

### DEC-077 — Phiếu thu: danh sách full màn hình; Phiếu thu trước theo bố cục thanh toán, biểu giá × số lượng, bản in riêng

- Trạng thái: CONFIRMED (2026-10-24) — bổ sung DEC-032, DEC-076
- Quyết định:
  - **Danh sách phiếu thu chiếm toàn bộ chiều ngang** khi tra cứu, đủ cột: mã phiếu thu, tác nghiệp, trạng thái, số tiền, trường hợp • hình thức, bên thanh toán, mã hồ sơ, số cont, chứng từ, tạo lúc • bởi, xác nhận thu, đã in. Chi tiết phiếu hiện **bên dưới** danh sách.
  - **Tạo phiếu thu TRƯỚC (TTT)** theo bố cục màn thanh toán Hạ vỏ / Cấp vỏ: **1. Khách hàng** (+ diễn giải lô) → **2. Chi phí** (chọn từ BIỂU GIÁ) → **3. Hình thức thanh toán** (Tiền mặt / Chuyển khoản API QR) → tổng thu trước → tạo (chờ thanh toán).
  - **Chọn biểu giá có SỐ LƯỢNG** (số nguyên 1–9999). **Tổng tiền do hệ thống tính** = Σ đơn giá × số lượng; lưu dòng chi phí (đơn giá, số lượng, thành tiền) vào Phiếu thu mẹ. Hạ vỏ / Cấp vỏ giữ như cũ (mỗi dòng 1).
  - **Bản in Phiếu thu trước**: cùng khung với phiếu thu Hạ vỏ / Cấp vỏ nhưng **tên "PHIẾU THU TRƯỚC (TTT)"** và **khung viền đôi nổi bật**: mã Phiếu thu mẹ PTT-, mã QR trừ dần, diễn giải lô, **SỐ TIỀN NẠP TRƯỚC**; bảng chi phí có **SL / Đơn giá / Thành tiền**; dòng tổng "TỔNG THU TRƯỚC".

### DEC-078 — Menu: biểu tượng tác nghiệp mobile thẳng hàng

- Trạng thái: CONFIRMED (2026-10-24) — bổ sung DEC-012, DEC-075
- Quyết định: Mỗi dòng menu chia **3 cột cố định**: **tên mục** (giãn, quá dài thì "…") | **cột biểu tượng điện thoại** (rộng cố định; mục không phải mobile để trống) | **cột số đếm** (rộng cố định, canh phải). Nhờ vậy biểu tượng mobile của mọi mục **thẳng hàng** theo chiều dọc, số đếm cũng thẳng hàng.

### DEC-079 — Phiếu thu: sắp lại cột; Phiếu thu mẹ (TTT) liên kết từng lần trừ tiền

- Trạng thái: CONFIRMED (2026-10-24) — bổ sung DEC-077
- Quyết định:
  - Danh sách phiếu thu: **bỏ cột Xác nhận thu**; cột **Trạng thái** đặt **ngay bên trái cột Đã in**; "Trường hợp • Hình thức" đổi thành **PHƯƠNG THỨC TT** (chỉ **Tiền mặt / Chuyển khoản**); "Tạo lúc • bởi" tách thành **Thời gian** và **Nhân viên**. Thứ tự: Mã phiếu thu | Tác nghiệp | Số tiền | Phương thức TT | Bên thanh toán | Mã hồ sơ / Phiếu thu mẹ | Số cont | Chứng từ | Thời gian | Nhân viên | Trạng thái | Đã in.
  - **Phiếu thu trước (TTT)**: dòng danh sách hiện mã Phiếu thu mẹ **PTT-** kèm **"Dùng N lượt • còn X đ"**. Chi tiết có khối **Sử dụng phiếu thu mẹ**: Tổng nạp, **Số lượt đã dùng**, Đã trừ, **Còn lại** + bảng **từng lần trừ tiền**: thời gian, tác nghiệp (Hạ vỏ / Cấp vỏ), **mã hồ sơ (bấm mở hồ sơ)**, số cont, **chứng từ**, số tiền trừ, số dư sau, nhân viên (`masterReceiptUsage` trong `payments.ts`).
  - Excel Phiếu thu: cột **PHƯƠNG THỨC TT**, thêm **SỐ LƯỢT ĐÃ DÙNG (TTT)**, **CÒN LẠI (TTT)**.

### DEC-080 — Quy chuẩn trang nhiều dữ liệu: danh sách full màn hình, chi tiết mở cửa sổ trượt bên phải, người dùng chọn số dòng

- Trạng thái: CONFIRMED (2026-10-24)
- Quyết định (chi tiết: `docs/UI_DATA_LIST_STANDARD.md` — mọi trang nhiều dữ liệu phải theo):
  - Danh sách **chiếm toàn bộ chiều ngang**, đủ cột; thời gian / nhân viên tách cột; trạng thái gần cuối.
  - **Bấm một dòng → chi tiết mở trong CỬA SỔ TRƯỢT BÊN PHẢI** (`DetailDrawer`), danh sách vẫn thấy phía sau; đóng bằng X / Esc / bấm ra ngoài. **Không** hiện chi tiết bên dưới / bên cạnh, không thay cả trang. Hồ sơ container cũng mở dạng trượt bên phải.
  - **Người dùng chọn số dòng / trang: 20 / 50 / 100**, nhớ theo từng màn trên trình duyệt (`usePageSize`); hàm tra cứu nhận `pageSize`.
  - Nút tác nghiệp cùng hàng nút Tra cứu; form tác nghiệp mở dưới khung lọc khi bấm.
  - Áp dụng ngay: Phiếu thu, Tồn vỏ, Văn phòng → Nhập tàu / Xuất tàu, mọi Báo cáo, Hồ sơ container.

### DEC-081 — EEIR cho hồ sơ Nhập tàu / Xuất tàu; xác nhận các điểm A.5 (2026-10-24)

- Trạng thái: CONFIRMED (2026-10-24) — bổ sung DEC-069, DEC-072, DEC-076
- Quyết định:
  - Hồ sơ **NT-** và **XT-** có **EEIR đầy đủ**, cùng khung với EEIR Hạ vỏ / Cấp vỏ (khổ A5): đầu công ty, **Số = mã NT- / XT-**, **TÁC NGHIỆP: NHẬP TÀU / XUẤT TÀU**; số cont, size/type, hãng tàu, **tên tàu**, thời gian nhập / xuất tàu, **số xe**, thời gian vào bãi (NT) / thời gian OUT + Date in (XT), vị trí hạ / lấy, "Không thu phí (tác nghiệp tàu)"; khối **TÌNH TRẠNG VỎ (GIÁM ĐỊNH)** — NT: kết quả Giám định lượt này; XT: tình trạng hiện tại + Giám định lúc cont vào bãi; chữ ký Lái xe / Đại diện công ty (`VesselEeirPrintSheet`).
  - In từ hồ sơ container: nút **In EEIR NHẬP TÀU** (từ khi Giám định xác nhận) / **In EEIR XUẤT TÀU** (khi cont đã OUT).
  - Người dùng **xác nhận** các điểm agent đặt ở DEC-070 / DEC-077: (a) xóa danh sách tàu chỉ khi chưa tác nghiệp cont nào; (b) đổi hãng tàu Nhập tàu chỉ khi chưa giám định; (d) Giám định Nhập tàu không bắt buộc chụp ảnh; (e) cột số lượng chỉ ở phiếu thu trước. Điểm (c) sắp xếp size → số cont: **chưa có ý kiến**, đang giữ như DEC-070.

### DEC-082 — Vị trí theo cấu hình thực tế của Block (thay phần "đặt cấp Block trước" của DEC-005 / DEC-036)

- Trạng thái: CONFIRMED (2026-10-24)
- Quyết định:
  - Danh mục chung → Vị trí: **Mã vị trí luôn bắt đầu bằng `BLOCK-`** — Admin chỉ gõ phần sau (A, B, C…); bên dưới là **Mô tả thông tin**. Tên khu vực không bắt buộc (mặc định "Khu A").
  - **Số Bay / Row / Tier tối đa** để trống = **không dùng chiều đó** (lưu 0). Mỗi chiều độc lập (VD chỉ có Bay).
  - **Mọi tác vụ vị trí** (Xe nâng hạ vỏ, Nhập tàu, Đảo chuyển, Sửa vị trí…): chỉ **hiện và bắt buộc nhập đúng các chiều Block có cấu hình**; chiều không cấu hình không hiện, không yêu cầu, không lưu.
  - Block **có cấu hình** chiều nào thì **bắt buộc nhập đủ** các chiều đó — **bỏ cách đặt cấp Block trước rồi cập nhật sau** (người dùng chọn).
  - Block **chỉ có BLOCK** (không Bay / Row / Tier): nhiều cont đặt chung, **không giới hạn** số cont.
  - Chống trùng ô **chỉ khi đủ 4 phần Block – Bay – Row – Tier (DEC-087)**; hiển thị vị trí: đủ 3 chiều `BLOCK-A / 04-02-01`, thiếu chiều thì ghi nhãn (VD `BLOCK-D / Bay 03`).
  - Dữ liệu mẫu: BLOCK-B chuyển thành Block chỉ có BLOCK. Dữ liệu đã lưu trên trình duyệt giữ cấu hình cũ tới khi Reset demo.
  - Code: `blockDimensions`, `validateTargetSlot`, `formatLocation` (`src/services/core.ts`); `SlotPicker` / `isSlotComplete(slot, state)` (`shared.tsx`); `addYardBlockCatalogItem`.

### DEC-083 — Vệ sinh / Xe nâng: hiện rõ tác nghiệp đang làm (kèm tên tàu)

- Trạng thái: CONFIRMED (2026-10-24)
- Quyết định: Mọi cont đến Vệ sinh / Xe nâng có **nhãn TÁC NGHIỆP** (mỗi loại 1 màu): **HẠ VỎ**, **CẤP VỎ**, **NHẬP TÀU • Tàu …**, **XUẤT TÀU • Tàu …** — ở khung cont vừa quét (nhãn lớn, đầu khung) và từng dòng danh sách chờ (Chờ vệ sinh, Chờ hạ vỏ, Chờ cấp vỏ). 4 màn Nhập / Xuất tàu ghi "Đang tác nghiệp: NHẬP TÀU / XUẤT TÀU • Tàu …".
  - Xác định trong service `containerOperation` (`vessel.ts`): đang trong danh sách xuất tàu → XUẤT TÀU; đã lập lệnh cấp → CẤP VỎ; mã NT- → NHẬP TÀU; còn lại → HẠ VỎ.

### DEC-084 — Báo giá → Chờ báo giá hiển thị như Tồn vỏ

- Trạng thái: CONFIRMED (2026-10-24) — bổ sung DEC-040, DEC-041, DEC-080
- Quyết định: Danh sách cont CHỜ BÁO GIÁ là **bảng full chiều ngang giống Tồn vỏ**: Mã hồ sơ (mở hồ sơ), Số container (icon khóa), Size, Type, Hãng tàu, Date in, Trạng thái, Lưu bãi, Vị trí, **Hư hỏng (giám định)**, Ghi chú (nền vàng). Có lọc số cont / size / type, chọn 20 / 50 / 100 dòng, Xuất Excel. **Bấm dòng → cửa sổ trượt bên phải** nhập **Remark sửa chữa + Giờ công** → "Cập nhật sang Chờ sửa chữa" (cùng hàm `approveDamageQuotation`, quy tắc DEC-040 / 041 không đổi).

### DEC-085 — Danh sách chờ Vệ sinh / Xe nâng: số cont thẳng cột

- Trạng thái: CONFIRMED (2026-10-24) — bổ sung DEC-083
- Quyết định: Mỗi dòng danh sách chờ (Chờ vệ sinh, Chờ hạ vỏ, Chờ cấp vỏ, Chờ sửa chữa) gồm **2 tầng**: tầng 1 các **cột cố định** — **Số container** (cột rộng cố định bên trái, luôn thẳng hàng dọc) | Size / Type | Vị trí (canh phải); tầng 2 chữ nhỏ — **nhãn tác nghiệp + tên tàu** | thông tin phụ (số xe • SĐT, giờ công). Tên tàu dài / ngắn không làm lệch cột số cont.

### DEC-086 — Báo giá 2 bước: cập nhật tình trạng sửa chữa + giờ công → xác nhận chờ sửa chữa

- Trạng thái: CONFIRMED (2026-10-24) — bổ sung DEC-040, DEC-041, DEC-084
- Quyết định:
  - Danh sách Chờ báo giá: **bỏ cột Hư hỏng (giám định)**, thay bằng **TÌNH TRẠNG SỬA CHỮA** (Báo giá nhập tình trạng sửa chữa thực tế) + cột **Giờ công**; thêm cột **TÁC NGHIỆP** ở cuối. Hư hỏng do Giám định ghi vẫn xem được trong cửa sổ chi tiết.
  - Bước 1 — **Cập nhật** (cửa sổ trượt): nhập Tình trạng sửa chữa * + Giờ công * → **Lưu cập nhật báo giá** — cont **vẫn ở Chờ báo giá**, lưu người / giờ cập nhật, sửa lại được nhiều lần.
  - Bước 2 — **Xác nhận chờ sửa chữa** (nút ở cột Tác nghiệp hoặc trong cửa sổ): chỉ bấm được khi đã cập nhật đủ; chuyển cont sang **bộ phận Sửa chữa** với đúng tình trạng + giờ công đã lưu.
  - Code: `saveQuotationDraft`, `confirmQuotationToRepair` (`depotOperations.ts`, gọi lại `approveDamageQuotation`).

### DEC-087 — Chặn trùng vị trí chỉ khi đủ BLOCK – BAY – ROW – TIER (sửa DEC-082)

- Trạng thái: CONFIRMED (2026-10-24)
- Quyết định: **Chỉ khi vị trí đầy đủ 4 phần BLOCK – BAY – ROW – TIER** mới chặn 2 cont trùng 1 ô. Vị trí **không đủ 4 phần** (Block chỉ có tên, chỉ Bay, Bay + Row…) → **1 vị trí gán được cho nhiều cont** (1 Block / 1 Bay / 1 Row chứa được nhiều đơn vị cont). Quy tắc bắt buộc nhập đủ các chiều đã cấu hình (DEC-082) không đổi.

### DEC-088 — Chờ báo giá: tìm hàng loạt + xác nhận chờ sửa chữa hàng loạt

- Trạng thái: CONFIRMED (2026-10-24) — bổ sung DEC-086
- Quyết định: Chờ báo giá có **Tìm hàng loạt** giống Tồn vỏ (dán danh sách số cont, báo số không có trong Chờ báo giá) và **ô chọn từng dòng / chọn tất cả theo bộ lọc** → **Xác nhận chờ sửa chữa hàng loạt**. Áp dụng từng cont qua `confirmQuotationToRepair` (`bulkConfirmQuotationToRepair`); cont **chưa cập nhật tình trạng sửa chữa / giờ công được bỏ qua và báo lại**, không chặn cả lô.

### DEC-089 — Danh sách chờ Vệ sinh / Xe nâng: ô tác nghiệp riêng bên trái, tên tàu tách riêng

- Trạng thái: CONFIRMED (2026-10-24) — thay bố cục DEC-085
- Quyết định: Mỗi dòng danh sách chờ (`QueueListRow`):
  - **Bên trái**: 1 **ô TÁC NGHIỆP** cố định (HẠ VỎ / CẤP VỎ / NHẬP TÀU / XUẤT TÀU — chỉ tên tác nghiệp, mỗi loại 1 màu).
  - **Bên phải** — thông tin của tác nghiệp: tầng 1 **Số container** (cột cố định, thẳng hàng) | Size / Type | Vị trí; tầng 2 **Tàu …** (tách khỏi nhãn tác nghiệp) | thông tin phụ (số xe • SĐT, giờ công).

### DEC-090 — Xe nâng → Đảo chuyển: vị trí thẳng cột

- Trạng thái: CONFIRMED (2026-10-24) — bổ sung DEC-089
- Quyết định: Mỗi thẻ danh sách Đảo chuyển dùng **cột cố định** như danh sách chờ: tầng 1 **Số container** | Size / Type | **VỊ TRÍ canh trái** (mọi dòng bắt đầu cùng 1 cột dọc, không còn canh phải theo độ dài vị trí); tầng 2 Trạng thái | Tiến độ.

### DEC-091 — Đảo chuyển: vị trí tách cột BLOCK | BAY | ROW | TIER

- Trạng thái: CONFIRMED (2026-10-24) — thay bố cục vị trí của DEC-090
- Quyết định: Danh sách Đảo chuyển có **hàng tiêu đề cột cố định** BLOCK | BAY | ROW | TIER; mỗi thẻ tầng 1 Số container | Size / Type | Trạng thái • Tiến độ, tầng 2 **4 ô vị trí** cùng lưới với tiêu đề → **Block thẳng Block, Bay thẳng Bay, Row thẳng Row, Tier thẳng Tier** từ trên xuống; chiều nào không có (Block chỉ có tên, chưa có vị trí) thì **để trống ô đó**.

### DEC-092 — Đảo chuyển: số cont, size/type và vị trí trên 1 dòng (thay bố cục DEC-091)

- Trạng thái: CONFIRMED (2026-10-24)
- Quyết định: Mỗi thẻ Đảo chuyển: **1 dòng SỐ CONT | SIZE / TYPE | VỊ TRÍ** dạng `BLOCK-A / 17-02-02` (người dùng xác nhận); dòng 2 Trạng thái | Tiến độ. Bỏ hàng tiêu đề BLOCK | BAY | ROW | TIER. Để vẫn **Block thẳng Block, Bay thẳng Bay**: ô tên Block rộng cố định bằng mã Block dài nhất trong danh mục (chữ đều nét), phần `/ Bay-Row-Tier` đi sau; chiều không có thì bỏ (Block chỉ có tên → chỉ hiện tên Block).
- Lưu ý: máy rất hẹp (~360px) với mã Block dài (VD BLOCK-DAMAGE) có thể cắt "…" ở cuối vị trí.

### DEC-093 — Khách hàng (Hạ vỏ / Cấp vỏ): gõ tay hoặc chọn, có gợi ý từ Danh mục

- Trạng thái: CONFIRMED (2026-10-24) — sửa DEC-016 / DEC-033 phần "chọn khách theo Danh mục"
- Quyết định:
  - Ô **Khách hàng** ở Văn phòng → Hạ vỏ và → Cấp vỏ: **gõ tay hoặc chọn**; khi gõ hiện **gợi ý khách trong Danh mục** (theo tên; gõ đúng mã khách → tự điền tên).
  - Tên trùng khách Danh mục (không phân biệt hoa thường) → lưu đúng tên Danh mục. **Tên không có trong Danh mục vẫn lưu được** (người dùng chọn).
  - **Khách ngoài Danh mục chỉ được thanh toán TRỰC TIẾP (Tiền mặt / Chuyển khoản)** — **không TTS, không TTT** (TTS / TTT dựa trên khách trong Danh mục). Ô nhập hiện cảnh báo khi gõ tên mới; service chặn khi thanh toán.
  - Code: `normalizeCustomer`, `isCatalogCustomer` (`depotOperations.ts`); kiểm tra trong `settleVoucher` (`payments.ts`); ô `CustomerInput` (`shared.tsx`).

### DEC-094 — Đảo chuyển: cấu trúc như danh sách Xe nâng — ô TRẠNG THÁI đầu, Tiến độ cuối

- Trạng thái: CONFIRMED (2026-10-24) — thay bố cục thẻ của DEC-092 (giữ vị trí thẳng cột)
- Quyết định: Mỗi thẻ Đảo chuyển giống dòng danh sách Xe nâng (DEC-089), nhưng **ô đầu bên trái là TRẠNG THÁI** (AV xanh / DAMAGE đỏ) thay cho tác nghiệp. Bên phải: dòng 1 **Số container | Vị trí** (`BLOCK-A / 17-02-02`, ô Block rộng cố định → thẳng cột); dòng cuối **Size / Type** (thẳng dưới số cont) | **Tiến độ** dạng nhãn nhỏ (Sẵn sàng xanh, các việc chờ màu vàng).

### DEC-095 — Đảo chuyển: tiến độ bên phải vị trí; dòng 2 là GHI CHÚ

- Trạng thái: CONFIRMED (2026-10-24) — sửa bố cục DEC-094
- Quyết định: Thẻ Đảo chuyển: ô TRẠNG THÁI bên trái (giữ); **dòng 1 Số container | Vị trí (ô rộng cố định → thẳng cột) | Tiến độ** (bên phải vị trí; máy hẹp thiếu chỗ thì tiến độ xuống ngay dưới, vẫn canh phải); **dòng 2 Size / Type | GHI CHÚ** (Remark Văn phòng — nền vàng khi có, "-" khi không).

### DEC-096 — Đảo chuyển: ô AV / DAMAGE cùng kích thước ô tác nghiệp danh sách Xe nâng

- Trạng thái: CONFIRMED (2026-10-24) — bổ sung DEC-094
- Quyết định: Ô TRẠNG THÁI (AV / DAMAGE) ở Đảo chuyển dùng **đúng kích thước UI của ô tác nghiệp** ở Xe nâng → Chờ hạ vỏ (`QueueListRow`): cột 5rem, chữ 10px đậm in hoa, đệm px-1.5 py-1, bo góc, không kéo dài hết chiều cao thẻ.

### DEC-097 — Hình thức thanh toán: TTTT — Trực tiếp đứng đầu và chọn sẵn

- Trạng thái: CONFIRMED (2026-10-25)
- Quyết định: Khối Hình thức thanh toán (Văn phòng → Hạ vỏ; dùng chung với Cấp vỏ) xếp **TTTT — Trực tiếp đầu tiên** → TTT → TTS, và **mặc định chọn sẵn TTTT + Tiền mặt** (hình thức dùng nhiều nhất). Quy tắc thanh toán không đổi (DEC-031, DEC-093).

### DEC-098 — Mã phiếu thu theo hình thức + ngày, duy nhất

- Trạng thái: CONFIRMED (2026-10-25)
- Quyết định: Mã phiếu thu mới có dạng `PT-<hình thức>-YYMMDD-NNNN`, đánh số lại từ 0001 mỗi ngày và cấp duy nhất qua `codes.ts`. **`PT-TT-…`** là phiếu thu trực tiếp (tiền mặt hoặc chuyển khoản). **`PT-TTR-…`** là phiếu nạp tiền trước (TTT; phiếu thu mẹ vẫn là `PTT-`). Nhìn mã là biết hình thức và ngày thu. TTS **không** có phiếu thu, chỉ có chứng từ `CT-` (công nợ, DEC-031). Mã cũ `PT-YYYY-NNNNNN` giữ nguyên, không đổi.

### DEC-099 — Tồn vỏ: thông tin thanh toán của lượt vào bãi

- Trạng thái: CONFIRMED (2026-10-25)
- Quyết định: Tồn vỏ (màn và Excel) có thêm cột **Hình thức TT** và **Phiếu thu** (`containerPaymentInfo`, `payments.ts`). Bên trong hệ thống vẫn giữ 2 mã: chứng từ `CT-` là khoản phải thu, phiếu thu `PT-` là tiền đã thu. Giao diện **chỉ hiện 1 ô Phiếu thu**:
  - TT: hiện `PT-TT-…`.
  - TTR: hiện phiếu thu mẹ `PTT-…`.
  - TTS: hiện `Công nợ (CT-…)`.
  - Nhập tàu: hiện "Không thu phí".
  - Chưa thanh toán: hiện đúng chữ "Chưa thanh toán".

### DEC-100 — Hình thức thanh toán: TRỰC TIẾP / TRẢ TRƯỚC / THANH TOÁN SAU (ký hiệu TT / TTR / TTS)

- Trạng thái: CONFIRMED (2026-10-25; sửa trong ngày — bỏ ký hiệu TL / TR)
- Quyết định: Hình thức thanh toán hiển thị và ký hiệu như sau:
  - **TT — TRỰC TIẾP**: tiền mặt hoặc chuyển khoản. Mã phiếu thu `PT-TT-YYMMDD-NNNN`.
  - **TTR — TRẢ TRƯỚC**: dùng tiền khách đã nạp trước. Phiếu nạp tiền có mã `PT-TTR-YYMMDD-NNNN`; lượt cont trừ vào phiếu thu mẹ `PTT-`.
  - **TTS — THANH TOÁN SAU**: công nợ. **Không cấp mã phiếu thu** (người dùng xác nhận lại 2026-10-25), chỉ có chứng từ `CT-` (DEC-031).
- Mã nội bộ trong code / dữ liệu vẫn là TTTT / TTT / TTS, chỉ đổi phần hiển thị và tiền tố mã phiếu thu.

### DEC-101 — Menu Báo cáo: "Sửa chữa chi tiết" → "Sửa chữa"

- Trạng thái: CONFIRMED (2026-10-25)
- Quyết định: Mục menu Báo cáo đổi tên thành **Sửa chữa**, tiêu đề màn là "Báo cáo Sửa chữa". Nội dung báo cáo không đổi (DEC-044).

### DEC-102 — Lọc nhanh thời gian cho mọi bộ lọc

- Trạng thái: CONFIRMED (2026-10-25)
- Quyết định: Mọi bộ lọc thời gian (Phiếu thu, các báo cáo, báo cáo Nhập / Xuất tàu) dùng chung ô **Lọc nhanh** (`DateRangeFilter`, `shared.tsx`; mốc tính bằng `quickRange`, `datetime.ts`). Các mục chọn:
  - Hôm nay / Tuần này / Tháng này / Năm nay: từ 00:00:00 đầu kỳ → hiện tại.
  - Hôm qua / Tuần trước / Tháng trước: trọn kỳ, đến 23:59:59 ngày cuối.
  - Tùy chọn: chỉ khi chọn mục này mới hiện 2 ô Từ - Đến (`dd/mm/yyyy hh:mm:ss`).
- **Tuần bắt đầu Thứ Hai.** Khi mở màn lần đầu chọn sẵn **Hôm nay** (thay mặc định 24 giờ của DEC-056).

### DEC-103 — Gọi tên "PHIẾU THU TRẢ TRƯỚC" thay cho "Phiếu thu mẹ"

- Trạng thái: CONFIRMED (2026-10-25)
- Quyết định: Mọi chữ hiển thị (màn hình, giấy in, Excel, thông báo) dùng **PHIẾU THU TRẢ TRƯỚC** thay cho "Phiếu thu mẹ". Mã `PTT-`, cách trừ dần và quy tắc thanh toán không đổi. Các mục DEC cũ còn chữ "Phiếu thu mẹ" được hiểu là Phiếu thu trả trước.

### DEC-104 — Tồn vỏ: cột MÃ PHIẾU THU, không hiện chứng từ

- Trạng thái: CONFIRMED (2026-10-25) — thay phần hiển thị của DEC-099
- Quyết định: Cột "Phiếu thu" ở Tồn vỏ (màn và Excel) đổi thành **MÃ PHIẾU THU**, chỉ hiện mã phiếu thu tương ứng với tác nghiệp đó:
  - TT: hiện `PT-TT-…`.
  - TTR: hiện mã phiếu thu trả trước `PTT-…`.
  - TTS, chưa thanh toán, Nhập tàu: **để trống**.
- **Không hiện chứng từ `CT-`** ở Tồn vỏ. Chứng từ vẫn tồn tại bên trong hệ thống (công nợ, đối soát), chỉ không hiển thị ở đây.

### DEC-105 — Tồn vỏ: MÃ PHIẾU THU là link sang phiếu thu thực tế

- Trạng thái: CONFIRMED (2026-10-25)
- Quyết định: Bấm mã phiếu thu ở Tồn vỏ sẽ mở **Văn phòng → Phiếu thu** đúng phiếu đó, giống link trong hồ sơ container (DEC-051).
  - TT: mở phiếu `PT-TT-…` của lượt.
  - TTR: mở phiếu nạp tiền `PT-TTR-…` của phiếu thu trả trước.
  - Chỉ hiện link khi người dùng được vào menu Phiếu thu; người không có quyền chỉ thấy mã, không bấm được.

### DEC-106 — Xóa dữ liệu tác nghiệp để test lại từ đầu

- Trạng thái: CONFIRMED (2026-10-25)
- Quyết định: Ứng dụng Demo mở với **dữ liệu sạch** (`createCleanState`):
  - **Giữ danh mục:** nhân viên, khách hàng / hãng tàu, block, size / type, biểu phí, tổ sửa chữa, thông tin công ty.
  - **Xóa toàn bộ:** container, lệnh Hạ vỏ / Cấp vỏ, booking, chứng từ, giao dịch, phiếu thu, phiếu thu trả trước, K80, danh sách tàu, nhật ký và bộ đếm mã (mã bắt đầu lại từ 001 / 0001).
- Đổi khóa lưu trình duyệt (v7 → v8), nên mọi máy tự bắt đầu lại từ dữ liệu sạch; dữ liệu cũ bị xóa khi mở app.
- Nút đầu trang đổi thành **"Xóa dữ liệu"**, có hỏi xác nhận trước khi xóa.
- Dữ liệu mẫu (`createInitialState`) chỉ còn dùng trong test.

### DEC-107 — Văn phòng → Phiếu thu: bỏ thông tin chứng từ, số container cạnh tác nghiệp

- Trạng thái: CONFIRMED (2026-10-25)
- Quyết định:
  - **Bỏ hẳn thông tin chứng từ `CT-`** ở màn Phiếu thu (bảng, cửa sổ chi tiết, bảng sử dụng phiếu thu trả trước) và ở Excel phiếu thu.
  - **Số container đứng ngay sau Tác nghiệp**, cả trên bảng và trong Excel.
  - Cột Excel "TRƯỜNG HỢP" đổi thành **HÌNH THỨC TT** và ghi chữ (TT — TRỰC TIẾP / TTR — TRẢ TRƯỚC).
  - Cột "PHIẾU THU MẸ" đổi thành **PHIẾU THU TRẢ TRƯỚC**; "(TTT)" đổi thành "(TTR)".

### DEC-108 — Dữ liệu test đầy đủ trường hợp

- Trạng thái: CONFIRMED (2026-10-25) — bổ sung DEC-106
- Quyết định: Bản Demo có bộ **dữ liệu test** (`createDemoState`, `src/services/demoData.ts`). Dữ liệu được tạo bằng cách chạy đúng các hàm nghiệp vụ theo đúng vai trò, nên mã hồ sơ, phiếu thu, chứng từ và K80 đều khớp quy tắc. Bộ dữ liệu gồm:
  - **Chung:** hãng tàu MAERSK (MSK); size 20 / 40 / 45.
  - **Hạ vỏ / Tồn vỏ:**
    - Hình thức thanh toán: TT tiền mặt, TT chuyển khoản, TTR, TTS, và 1 lượt chờ thanh toán.
    - Vị trí: Block có Bay / Row / Tier và Block chỉ quản lý theo Block.
    - Có 1 cont bị khóa.
    - DAMAGE: chờ báo giá, chờ sửa chữa, đã sửa xong.
    - Cont đang chờ vệ sinh, cont chờ Xe nâng hạ.
  - **Phiếu thu:** `PT-TT-…`, phiếu thu trả trước đã thu (`PT-TTR-…`), phiếu thu trả trước chờ chuyển khoản.
  - **Cấp vỏ:** 1 lượt đã xuất bãi, 1 lượt chờ Xe nâng.
  - **Nhập tàu:** đã hạ / chờ vệ sinh / chưa giám định.
  - **Xuất tàu:** đã xuất / chờ xuất.
- Lần đầu mở app, dữ liệu cũ trên trình duyệt được thay bằng dữ liệu test (đổi khóa lưu trình duyệt lên v9).
- Đầu trang có 2 nút: **Xóa dữ liệu** (dữ liệu sạch, giữ danh mục) và **Nạp dữ liệu test**, cả hai đều hỏi xác nhận.

### DEC-109 — Hạ vỏ: HẠ KỆ GIÁM ĐỊNH khi chưa giám định được ngay

- Trạng thái: CONFIRMED (2026-10-25). **Điểm 1 và 6 được thay bởi DEC-147** (lựa chọn W-SURVEY thay ô tích; có bước giám định bổ sung trên kệ trong hệ thống).
- Tình huống: Giám định kiểm tra cont, chụp ảnh và gửi thông tin vào Văn phòng, nhưng chưa thể giám định ngay.
- Quyết định:
  1. **Giám định:** chọn AV / DAMAGE như thường (tình trạng mô phỏng ban đầu), rồi tích ô **HẠ KỆ GIÁM ĐỊNH**.
  2. **Văn phòng:** làm thủ tục, thu phí, in EEIR / K80 như bình thường, dùng tình trạng ban đầu. Màn Văn phòng hiện nhãn "HẠ KỆ GIÁM ĐỊNH".
  3. **Phiếu K80:** bước Xe nâng ghi "Quét mã • HẠ KỆ GIÁM ĐỊNH".
  4. **Vệ sinh:** làm như thường (nếu có). Xe nâng chỉ hạ sau khi vệ sinh xong.
  5. **Xe nâng – Chờ hạ vỏ:** cont có nhãn **HẠ KỆ GIÁM ĐỊNH — không hạ về bay**; ô Block chỉ cho chọn các block là Kệ giám định. Service chặn mọi vị trí khác. Nếu chưa có block nào là Kệ giám định, hệ thống báo Admin cấu hình.
  6. **Giám định xong:** Giám định thông báo ngoài hệ thống; Xe nâng dùng **ĐẢO CHUYỂN** để đưa cont về vị trí phù hợp, khi đó cờ Hạ kệ được xóa. Không có bước giám định lại trong hệ thống.
- **Danh mục Vị trí:** Admin đánh dấu block nào là **Kệ giám định** (ô tích khi thêm mới và trong danh sách). Mặc định BLOCK-DAMAGE là Kệ giám định.
- Kỹ thuật:
  - `GateInOrder.toInspectionRack`.
  - `ContainerRecord.forkliftShiftTask = 'HA_KE_GIAM_DINH'` (dùng lại cờ cũ, xóa khi Đảo chuyển).
  - `YardBlock.isInspectionRack`, `setYardBlockInspectionRack`.

### DEC-110 — Trả chứng từ: nút XEM TRƯỚC

- Trạng thái: CONFIRMED (2026-10-25)
- Quyết định: Ở Văn phòng → Trả chứng từ có nút **Xem trước** nằm **bên trái** nút "Trả chứng từ" (từng dòng chờ) và nút "Xác nhận & in" (ô quét).
- Bấm Xem trước sẽ mở bộ chứng từ (EEIR + phiếu thu) để xem trên màn hình, và:
  - **không** ghi nhận trả chứng từ;
  - **không** in;
  - **không** tăng số lần in phiếu thu.
- Xem được cả khi lái xe chưa đi hết lộ trình. Chỉ Văn phòng / Quản lý được xem (`previewDocumentPack`, `driverRoute.ts`).

### DEC-111 — Phiếu thu: mã bảo mật + khách yêu cầu xuất hóa đơn; thêm lại vai trò Kế toán

- Trạng thái: CONFIRMED (2026-10-25). Giải quyết Q-041. **Thay một phần DEC-047:** thêm lại vai trò **Kế toán**, nay là vai trò thứ 9 (DEC-047 đã bỏ vai trò này).
- **Mã bảo mật:**
  - Mỗi phiếu thu (`PT-TT-…`, `PT-TTR-…`) có mã bảo mật **12 ký tự** gồm chữ hoa, chữ thường và số.
  - Mã sinh ngẫu nhiên bằng nguồn ngẫu nhiên mật mã (`crypto.getRandomValues`), có khoảng 3,2 × 10^21 khả năng nên không đoán được, và không trùng.
  - Mã **in trên phiếu thu** kèm đường link trang yêu cầu hóa đơn. Mã không có trong Excel. *(Phần "không hiện trên màn nội bộ" đã được DEC-112 thay.)*
  - Phiếu thu cũ được tự bổ sung mã khi nạp dữ liệu.
- **Trang khách hàng** (`#/hoa-don`, không cần đăng nhập):
  - Khách dán mã (phân biệt chữ hoa / thường) và thấy thông tin tối thiểu: số phiếu, ngày, số tiền, bên thanh toán, số cont, trạng thái.
  - Khách nhập **MÃ SỐ THUẾ** (10 số, hoặc 10 số + "-" + 3 số), **GMAIL NHẬN HÓA ĐƠN**, **TÊN CÔNG TY**, **ĐỊA CHỈ** (đều bắt buộc) và **GHI CHÚ** (không bắt buộc).
  - Sửa được khi chưa xuất hóa đơn.
- **Trạng thái phiếu thu:**
  - **CHƯA XHD:** mặc định.
  - **YÊU CẦU XHD:** khách đã gửi.
  - **ĐÃ XHD:** **Kế toán** cập nhật sau khi xuất trên MISA, kèm số hóa đơn (không bắt buộc). Chỉ chuyển được khi đã có yêu cầu. Sau khi ĐÃ XHD, khách không sửa được.
- **Kế toán (ACCOUNTANT):** chỉ thấy menu Văn phòng → Phiếu thu (xem, lọc, xuất Excel) và cập nhật ĐÃ XHD.
- **Màn Phiếu thu:** thêm cột / bộ lọc **Hóa đơn**; cửa sổ chi tiết có khối "Xuất hóa đơn". Excel thêm các cột TRẠNG THÁI HĐ, MÃ SỐ THUẾ, GMAIL NHẬN HĐ, TÊN CÔNG TY, ĐỊA CHỈ, GHI CHÚ HĐ, SỐ HÓA ĐƠN, CẬP NHẬT XHD.
- **Giới hạn bản Demo:**
  - Trang khách hàng chỉ dùng chung dữ liệu với **cùng trình duyệt** (localStorage).
  - Khi có database, trang này phải gọi RPC công khai có **giới hạn số lần thử** theo IP / thiết bị (chống dò mã), và gửi email thông báo cho Kế toán.
  - Kết nối API MISA làm sau.

### DEC-112 — Phiếu thu: hiện mã bảo mật ở khối "Xuất hóa đơn"

- Trạng thái: CONFIRMED (2026-10-25). Thay một phần DEC-111.
- Quyết định: Ở Văn phòng → Phiếu thu, cửa sổ chi tiết phiếu, khối **Xuất hóa đơn** luôn hiện **mã bảo mật** của phiếu, ở mọi trạng thái, để Văn phòng / Kế toán dễ theo dõi và đối soát.
- Người thấy mã: những ai được xem Phiếu thu (Văn phòng, Quản lý, Kế toán, Admin).
- Mã vẫn **không** có trong Excel.

### DEC-113 — Người thu tiền trên phiếu là nhân viên; hướng dẫn xuất hóa đơn cho khách; khối Xuất hóa đơn có link

- Trạng thái: CONFIRMED (2026-10-25)
- **Người thu tiền:** ô ký "Người thu tiền" trên phiếu thu luôn là **nhân viên Văn phòng tác nghiệp**. Ngân hàng / hệ thống chỉ là công cụ xác nhận tiền về.
  - Khi chuyển khoản được ngân hàng báo có, phiếu thu ghi nhân viên đã lập yêu cầu thu (`tx.createdBy`), không ghi "HỆ THỐNG (Ngân hàng)".
  - Phiếu cũ đã ghi "HỆ THỐNG" vẫn in tên nhân viên (`receiptCollectorName`).
  - Mã giao dịch ngân hàng vẫn in ở dòng Hình thức.
- **Trang yêu cầu xuất hóa đơn** có khung **Hướng dẫn xuất hóa đơn**, mở sẵn và thu gọn được:
  1. Tìm mã 12 ký tự trên phiếu.
  2. Nhập đúng mã (phân biệt hoa / thường) và kiểm tra số phiếu, số tiền.
  3. Điền thông tin đúng như Giấy đăng ký kinh doanh.
  4. Nhận hóa đơn qua Gmail; tra cứu lại bằng mã để xem trạng thái.
- Nội dung hướng dẫn cho các trường hợp:
  - **Sai thông tin khi chưa xuất:** nhập lại mã → sửa → Cập nhật yêu cầu.
  - **Đã xuất:** trang khóa; khách liên hệ Kế toán (SĐT / email lấy từ Danh mục → Công ty) và báo số phiếu thu để được hướng dẫn điều chỉnh hóa đơn.
  - Nhắc khách giữ kín mã.
- **Văn phòng → Phiếu thu → khối Xuất hóa đơn:** hiện cả **Đường link** và **Mã bảo mật**.
- Chưa có trong hệ thống: quy trình điều chỉnh / thay thế hóa đơn đã xuất. Kế toán xử lý trên MISA theo quy định.

### DEC-114 — Trang yêu cầu xuất hóa đơn: hướng dẫn ngắn, đặt dưới ô Mã bảo mật

- Trạng thái: CONFIRMED (2026-10-25). Thay phần trình bày hướng dẫn của DEC-113.
- Quyết định: Hướng dẫn rút gọn còn **3 bước**:
  1. Nhập mã bảo mật trên phiếu thu → Tra cứu.
  2. Điền Mã số thuế, Tên công ty, Địa chỉ, Gmail → Gửi.
  3. Nhận hóa đơn qua Gmail.
- Thêm 1 dòng **"Ghi sai?"**: chưa xuất thì tra cứu lại → sửa → Cập nhật yêu cầu; đã xuất thì liên hệ Kế toán (SĐT công ty).
- Khung hướng dẫn đặt **ngay dưới ô "Mã bảo mật trên phiếu thu (12 ký tự)"**.

### DEC-115 — Xe nâng → Đảo chuyển: mỗi cont đúng 2 dòng trên mobile

- Trạng thái: CONFIRMED (2026-10-25). Thay bố cục dòng của DEC-095. Giữ ô trạng thái của DEC-094 / DEC-096 và vị trí thẳng cột của DEC-092.
- Vấn đề: trên điện thoại, 1 cont chiếm 3 dòng, vì dòng 1 (số cont + vị trí + tiến độ) rộng hơn màn hình.
- Quyết định:
  - **Dòng 1:** SỐ CONT | SIZE/TYPE | TIẾN ĐỘ (bên phải).
  - **Dòng 2:** VỊ TRÍ `BLOCK-A / 17-02-02` (ô Block rộng cố định, thẳng cột) | GHI CHÚ (nền vàng khi có, cắt bớt nếu dài, để trống khi không có).
  - Hai dòng **không xuống dòng**: phần dư bị cắt, không đẩy sang dòng thứ 3.

### DEC-116 — Mobile: chạm ô nhập không phóng to vỡ khung; Đảo chuyển bỏ ô ghi chú

- Trạng thái: CONFIRMED (2026-10-25)
- **Ô nhập trên điện thoại:**
  - Vấn đề: iPhone / Safari tự phóng to màn hình khi chạm vào ô nhập có chữ nhỏ hơn 16px, làm vỡ khung.
  - Quyết định: trên màn hình < 640px, mọi `input` / `select` / `textarea` dùng chữ **16px** (`src/index.css`). Màn máy tính giữ cỡ chữ cũ.
  - **Không** chặn người dùng tự phóng to bằng hai ngón tay.
- **Xe nâng → Đảo chuyển:** bỏ ô "Ghi chú tác nghiệp". Xe nâng chỉ chọn vị trí mới rồi xác nhận. Lịch sử đảo chuyển vẫn ghi đủ vị trí trước / sau, người làm và thời gian.

### DEC-117 — Kiểu hiển thị thống nhất cho mọi link dữ liệu

- Trạng thái: CONFIRMED (2026-10-25)
- Quyết định: Mọi mã bấm được để mở dữ liệu liên quan dùng **cùng một kiểu, giống Mã hồ sơ ở Tồn vỏ**: chữ đều nét, màu xanh, gạch chân khi rê chuột, không in đậm. Khai báo duy nhất: hằng `linkCls` trong `src/components/shared.tsx`.
- Áp dụng cho: mã hồ sơ HV- / CV- / NT- / XT-, mã phiếu thu, phiếu thu trả trước.
- Đã áp ở: Tồn vỏ (cột MÃ PHIẾU THU, cùng định dạng ô Mã hồ sơ), hồ sơ container (link phiếu thu), Văn phòng Hạ vỏ / Cấp vỏ, Phiếu thu (hồ sơ nghiệp vụ, bảng sử dụng phiếu thu trả trước), Báo cáo (Hạ vỏ, Cấp vỏ, Sửa chữa, Nhập / Xuất tàu), Nhập / Xuất tàu (Văn phòng, mobile), Xe nâng (hồ sơ sau khi quét).
- Không áp cho nút thao tác (Tìm hàng loạt, Xem thêm, Chọn tất cả…) và số điện thoại gọi được.

### DEC-118 — Mọi MÃ có hồ sơ lưu trữ đều hiển thị dạng link

- Trạng thái: CONFIRMED (2026-10-25). Bổ sung DEC-117.
- Quyết định: Mã nào có hồ sơ / phiếu để mở thì **luôn bấm được** và dùng kiểu `linkCls`. Đã chuyển các mã đang là chữ thường:
  - **Phiếu thu:** cột Mã phiếu thu (mở chi tiết phiếu); cột Mã hồ sơ / Phiếu thu trả trước (mở hồ sơ container, hoặc mở phiếu nạp tiền của phiếu thu trả trước); mã phiếu thu trả trước trong cửa sổ chi tiết.
  - **Tồn vỏ:** cột Mã hồ sơ.
  - **Báo giá:** mã hồ sơ trong bảng và trong cửa sổ chi tiết.
  - **Trả chứng từ:** mã hồ sơ HV- / CV- của lái xe đang chờ.
- Không chuyển:
  - Mã đang là **tiêu đề của chính hồ sơ / phiếu** đang mở.
  - Giấy tờ in (phiếu thu, EEIR, K80) và trang khách hàng.
  - Danh sách chờ ở Văn phòng Hạ vỏ (bấm dòng để chọn; khung chi tiết bên phải đã có link hồ sơ).
  - Màn Giám định Hạ vỏ mobile (hồ sơ chưa qua Văn phòng).

### DEC-119 — Bỏ mã chứng từ CT-: số chứng từ = MÃ HỒ SƠ của tác nghiệp

- Trạng thái: CONFIRMED (2026-10-26). **Thay phần "giữ 2 mã bên trong" của DEC-099 / DEC-104.**
- Quyết định:
  - Không cấp mã chứng từ `CT-…` riêng nữa. **Số chứng từ = mã hồ sơ của tác nghiệp**: Hạ vỏ `HV-…`, Cấp vỏ `CV-…`. Mã này cũng là **mã tham chiếu / nội dung chuyển khoản**.
  - Tiền đã thu thì chứng từ là **MÃ PHIẾU THU** (`PT-TT-…` / `PT-TTR-…`).
  - TTS (công nợ) theo dõi bằng mã hồ sơ.
- Vì mỗi lượt Hạ vỏ / Cấp vỏ chỉ có 1 chứng từ chi phí, mã hồ sơ đủ duy nhất. Khớp tiền ngân hàng chỉ tìm giao dịch đang chờ, nên hủy và tạo lại yêu cầu chuyển khoản vẫn đúng.
- Đã bỏ các chỗ hiển thị trùng:
  - Dòng "Chứng từ" trên phiếu thu in (đã có Mã hồ sơ).
  - Ô "Chứng từ" trong hồ sơ container.
  - Cột "SỐ CHỨNG TỪ" ở Excel báo cáo Hạ vỏ / Cấp vỏ.
  - Giữ cột "SỐ LỆNH / CHỨNG TỪ": đây là số EIR / lệnh của khách, không phải mã nội bộ.
- Dữ liệu trình duyệt được nạp lại dữ liệu test mới (khóa lưu v11).

### DEC-120 — GÓP Ý xây dựng hệ thống

- Trạng thái: CONFIRMED (2026-10-26)
- **Gửi góp ý:** nút **Góp ý** ở góc trên bên phải, mọi người dùng đều thấy. Cửa sổ góp ý gồm:
  - Chọn **Menu / tính năng**: các menu người dùng được thấy, cộng mục "Khác".
  - **Nội dung**: 5 → 2000 ký tự.
  - Gửi xong cấp mã **GY-YYMMDD-NNN** (qua `codes.ts`).
  - Phía dưới là **Góp ý của tôi**: chỉ góp ý của chính mình, kèm trạng thái và phản hồi của Admin.
- **Báo cáo → Góp ý** (chỉ **Admin** — `FEEDBACK_MANAGE`): lọc thời gian (lọc nhanh), trạng thái, menu, từ khóa; phân trang; xuất Excel. Bấm dòng mở cửa sổ chi tiết để cập nhật **trạng thái + phản hồi**:
  - Trạng thái: **MỚI → ĐANG XỬ LÝ → ĐÃ XỬ LÝ / KHÔNG ÁP DỤNG**.
  - Khi chuyển sang Đã xử lý / Không áp dụng thì bắt buộc ghi phản hồi.
- Góp ý được **giữ lại khi bấm "Xóa dữ liệu"**. Dữ liệu test có 2 góp ý mẫu (1 MỚI, 1 ĐÃ XỬ LÝ).
- Kỹ thuật: `src/services/feedback.ts`, `queryFeedback` / `feedbackSheet` (`reports.ts`), `src/components/FeedbackButton.tsx`, `src/features/reports/FeedbackReport.tsx`.

### DEC-121 — Phiếu thu trả trước: cột MÃ HỒ SƠ = các tác nghiệp đã dùng phiếu

- Trạng thái: CONFIRMED (2026-10-26)
- Quyết định: Ở Văn phòng → Phiếu thu, dòng phiếu nạp tiền trả trước (`PT-TTR-…`) có cột **Mã hồ sơ** hiện **mã hồ sơ của các tác nghiệp đã dùng phiếu thu trả trước đó** (HV- / CV-).
  - Mỗi mã là link mở hồ sơ.
  - Hiện tối đa 3 mã, còn lại ghi "+N".
  - Chưa dùng thì ghi "Chưa dùng"; vẫn kèm "Dùng N lượt • còn X".
- Không hiện mã `PTT-…` ở cột này. Mã PTT vẫn có trong cửa sổ chi tiết, bảng sử dụng và cột Excel **PHIẾU THU TRẢ TRƯỚC**.
- Excel: cột MÃ HỒ SƠ của phiếu nạp = danh sách mã hồ sơ đã dùng, ngăn cách bằng dấu phẩy.
- Tên cột đổi từ "Mã hồ sơ / Phiếu thu trả trước" thành **"Mã hồ sơ"**.

### DEC-122 — Phiếu thu trả trước: cột Mã hồ sơ chỉ hiện tóm tắt, bấm để xem chi tiết

- Trạng thái: CONFIRMED (2026-10-26). Thay phần hiển thị trên màn của DEC-121.
- Quyết định: Dòng THU TRƯỚC (TTR) ở cột **Mã hồ sơ** **không liệt kê các mã hồ sơ**. Chỉ hiện một dòng tóm tắt **"Dùng N lượt • còn X ₫"** dạng link (`linkCls`).
- Bấm vào tóm tắt sẽ mở cửa sổ chi tiết phiếu, có bảng **Sử dụng phiếu thu trả trước**: từng lượt, mã hồ sơ (link), số cont, số tiền trừ, số dư.
- **Excel giữ như DEC-121:** cột MÃ HỒ SƠ ghi đủ các mã hồ sơ đã dùng phiếu.

### DEC-123 — Góp ý: chọn Menu chính → Tính năng → Nội dung

- Trạng thái: CONFIRMED (2026-10-26). Bổ sung DEC-120.
- Quyết định: Form góp ý đi theo **3 bước**, bước sau chỉ hiện khi bước trước đã chọn:
  1. **Menu chính** (Văn phòng, Xe nâng, Báo cáo…, và "Khác").
  2. **Tính năng** trong menu đó. Menu chỉ có 1 tính năng (VD: Khác) thì chọn sẵn.
  3. **Nội dung góp ý**.
- Báo cáo vẫn lưu và hiển thị dạng "Menu chính → Tính năng".

### DEC-124 — Phiếu thu trả trước chỉ có MỘT mã: PT-TTR-YYMMDD-NNNN (bỏ PTT-)

- Trạng thái: CONFIRMED (2026-10-26). **Thay mã `PTT-YYYY-NNN` của DEC-068 / DEC-077** cho phiếu thu trả trước.
- Quyết định:
  - Văn phòng **tạo phiếu thu trả trước** → hệ thống cấp ngay **`PT-TTR-YYMMDD-NNNN`**, trạng thái **CHỜ THANH TOÁN**: chưa in, QR chưa dùng được (DEC-031).
  - Thu tiền xong (tiền mặt hoặc ngân hàng báo có) → **chính mã đó** là số phiếu thu, không cấp thêm mã khác.
  - Mã QR trừ dần = `QR-<mã PT-TTR>`. Nội dung chuyển khoản = mã PT-TTR.
  - Không còn cấp mã `PTT-`. Phiếu đã có mã PTT- trong dữ liệu cũ vẫn dùng được (thu tiền sẽ cấp PT-TTR mới).
- Bộ đếm PT-TTR tính cả phiếu đang chờ thanh toán, nên mã không bị trùng.
- Dữ liệu trình duyệt được nạp lại dữ liệu test mới (khóa lưu v12).

### DEC-125 — Chọn / sửa vị trí từng bước: Block → Bay → Row → Tier

- Trạng thái: CONFIRMED (2026-10-26). Áp dụng cho mọi tác nghiệp có vị trí, vì tất cả dùng chung `SlotPicker`: Xe nâng (Chờ hạ vỏ, Đảo chuyển, Nhập tàu), Tồn vỏ (sửa vị trí).
- Quyết định:
  - Chỉ hiện **bước đang chọn**, với **toàn bộ giá trị dạng nút lớn**.
    - Bước đầu là tất cả Block (theo `onlyBlocks` nếu có, VD Kệ giám định).
    - Chọn xong mới hiện bước tiếp theo, chỉ các chiều Block có cấu hình (DEC-082).
  - **Dòng tóm tắt ở trên cùng** luôn hiện giá trị đã chọn, VD `BLOCK-A / 05 - Row - Tier`.
    - Bấm vào một phần để **chọn lại** phần đó; các phần sau tự xóa để chọn lại cho đủ.
    - Đủ thì hiện "✓ Đủ vị trí".
  - Nút xác nhận vẫn chỉ bấm được khi `isSlotComplete`, nên người dùng **bắt buộc chọn đủ**.
  - Chiều nào có hơn 60 giá trị thì dùng ô chọn thả xuống thay cho nút.

### DEC-126 — Báo cáo Hạ vỏ / Cấp vỏ có cột THANH TOÁN + MÃ PHIẾU THU; đổi "Hình thức TT" thành "Thanh toán"

- Trạng thái: CONFIRMED (2026-10-26)
- Quyết định:
  - **Báo cáo Hạ vỏ** và **Báo cáo Cấp vỏ** (màn hình và Excel) thêm 2 cột **Thanh toán** | **Mã phiếu thu**, cùng quy tắc với Tồn vỏ (DEC-099, DEC-104, DEC-105).
    - TT: hiện `PT-TT-…`.
    - TTR: hiện mã phiếu thu trả trước `PT-TTR-…`.
    - TTS: để trống.
    - Mã phiếu thu là link mở phiếu.
  - Cấp vỏ lấy theo chứng từ của lệnh cấp (`voucherPaymentInfo`). Excel Cấp vỏ thay cột cũ "HÌNH THỨC THANH TOÁN" (đang ghi mã kỹ thuật) bằng 2 cột này.
  - **Đổi tên cột "Hình thức TT" → "Thanh toán"** (Excel: "THANH TOÁN") ở Tồn vỏ, Hạ vỏ, Cấp vỏ, để không viết tắt.
- Kỹ thuật: 2 ô dùng chung `PaymentInfoCells` (`src/components/PaymentInfoCells.tsx`).
- Sửa kèm: ô Mã hồ sơ ở bảng Báo cáo Hạ vỏ / Cấp vỏ bị mất khoảng đệm, do lần đổi kiểu link ở DEC-117 gắn nhầm class vào ô thay vì vào nút.

### DEC-127 — Cột THANH TOÁN chỉ ghi tên hình thức, không kèm ký hiệu

- Trạng thái: CONFIRMED (2026-10-26)
- Quyết định: Cột **Thanh toán** ở Tồn vỏ, Báo cáo Hạ vỏ, Báo cáo Cấp vỏ (màn hình và Excel) chỉ ghi một trong các giá trị:
  - **TRỰC TIẾP**
  - **TRẢ TRƯỚC**
  - **THANH TOÁN SAU**
  - **Không thu phí** (Nhập tàu)
  - **Chưa thanh toán** / **Chưa lập chứng từ** (khi chưa có thanh toán)
- Bỏ ký hiệu đứng trước ("TT —", "TTR —", "TTS —") cho gọn.
- Các chỗ khác giữ ký hiệu: khối chọn hình thức thanh toán, Excel Phiếu thu.
- Kỹ thuật: `PAYMENT_CATEGORY_SHORT_LABELS` (`payments.ts`), dùng trong `voucherPaymentInfo`.

### DEC-128 — Tồn vỏ: cột PHÂN LOẠI (đóng hàng) bên phải Trạng thái

- Trạng thái: CONFIRMED (2026-10-26)
- Quyết định:
  - Bảng Tồn vỏ thêm cột **Phân loại** (phân loại đóng hàng M / K / E) **ngay bên phải cột Trạng thái** (AV / DAMAGE).
  - Excel Tồn vỏ: cột "ĐÓNG HÀNG" đổi tên thành **PHÂN LOẠI** và chuyển về ngay sau TRẠNG THÁI. Thứ tự: TRẠNG THÁI → PHÂN LOẠI → LƯU BÃI.

### DEC-129 — Tồn vỏ: cột AGE sau Hãng tàu, TIẾN ĐỘ sau Mã phiếu thu; Excel luôn khớp màn hình

- Trạng thái: CONFIRMED (2026-10-26)
- **Thứ tự cột Tồn vỏ** (màn hình và Excel):
  - Màn hình: Mã hồ sơ | Số container | Size | Type | Hãng tàu | **AGE** | Date in | Trạng thái | Phân loại | Lưu bãi | Vị trí | Thanh toán | Mã phiếu thu | **Tiến độ** | Ghi chú.
  - Excel cùng thứ tự, thêm các cột chỉ có ở Excel (Vào bãi bằng, Khách hàng, Số xe hạ, Khóa…).
- **Quy tắc chung (người dùng yêu cầu):** khi thêm, bớt hoặc đổi thứ tự cột trên màn hình danh sách / báo cáo thì **phải sửa file Excel xuất ra cho tương xứng**.
  - Riêng Tồn vỏ có test tự động so thứ tự cột màn hình với cột Excel.

### DEC-130 — Phiếu thu trả trước: hóa đơn theo TỪNG LƯỢT, khách tự gộp

- Trạng thái: CONFIRMED (2026-10-26). Bổ sung DEC-111 cho phiếu `PT-TTR-…`.
- Quyết định:
  - **Mã bảo mật:** khách dùng **một** mã của phiếu thu trả trước và thấy **mọi lượt đã dùng** (ngày, mã hồ sơ, số cont, tác nghiệp, số tiền trừ).
  - **Gửi yêu cầu:** khách **tự chọn 1 hoặc nhiều lượt** → gửi **1 yêu cầu hóa đơn** với MST / Gmail / Tên công ty / Địa chỉ / Ghi chú riêng. Số tiền = tổng các lượt đã chọn. Gửi được nhiều yêu cầu (gộp hoặc tách tùy ý), có nút "Dùng lại thông tin yêu cầu trước".
  - **Chống xuất trùng:** mỗi lượt chỉ thuộc **1** yêu cầu. Phiếu trả trước **không** yêu cầu hóa đơn cho cả phiếu.
  - **Số dư chưa dùng: chưa xuất được.** Dùng tiếp thì lượt mới tự hiện để yêu cầu.
  - **Sửa / hủy:** khi yêu cầu chưa xuất, khách được sửa (đổi lượt, đổi thông tin) hoặc **hủy để gộp / tách lại**. Đã xuất thì khóa.
  - **Kế toán:** cập nhật **ĐÃ XHD theo từng yêu cầu**, kèm số hóa đơn MISA (không bắt buộc).
  - **Trạng thái phiếu** (tính lại mỗi lần, vì có thể phát sinh lượt mới), nhãn kèm "đã xuất x/y lượt":
    - YÊU CẦU XHD khi còn yêu cầu chờ Kế toán.
    - ĐÃ XHD khi mọi lượt đã dùng đều đã xuất.
    - Còn lại là CHƯA XHD.
- **Excel Phiếu thu:** các cột hóa đơn của phiếu trả trước ghép theo từng yêu cầu, ngăn cách "; ". Bộ lọc "Hóa đơn" dùng trạng thái tính lại.
- Kỹ thuật:
  - `PaymentReceipt.invoiceGroups` (`InvoiceGroup`).
  - `prepaidInvoiceView`, `submitPrepaidInvoiceGroup`, `cancelPrepaidInvoiceGroup`, `receiptInvoiceStatus` / `receiptInvoiceLabel`, `markInvoiceIssued({ groupId })` trong `invoice.ts`.
  - Dữ liệu trình duyệt nạp lại (khóa lưu v13).

### DEC-131 — Xuất tàu tự khóa + ghi chú tên tàu; duyệt Nhập / Xuất tàu khi chưa đủ (gạch cont không kịp)

- Trạng thái: CONFIRMED (2026-10-26). Bổ sung DEC-069.
- **Khóa xuất tàu tự động:**
  - Khi cont được đưa vào danh sách **XUẤT TÀU** (lập mới hoặc thêm cont), cont **tự KHÓA** và **Ghi chú = "XUẤT TÀU <tên tàu>"**. Ghi chú cũ bị thay hẳn.
  - **Không cấp vỏ được, chỉ xuất tàu được**: Xuất tàu cho phép cont đang mang khóa xuất tàu; cont có khóa thường thì vẫn phải mở khóa trước.
  - Văn phòng **không tự mở khóa / sửa ghi chú** loại khóa này. Muốn gỡ thì bỏ cont khỏi danh sách.
  - Đổi tên tàu thì ghi chú các cont đang chờ đổi theo.
  - **Bỏ cont khỏi danh sách / xóa danh sách / duyệt mà cont chưa kịp xuất** → cont **tự mở khóa + xóa ghi chú**, trở lại tồn bãi bình thường. Nhật ký vẫn ghi lại.
- **Duyệt khi chưa đủ:**
  - Nút Duyệt bấm được cả khi chưa xuất / nhập đủ; khi đó **bắt buộc ghi lý do**.
  - Cont chưa tác nghiệp chuyển trạng thái **KHÔNG KỊP** và hiện **gạch ngang** trong danh sách, báo cáo, Excel.
  - Nhập tàu: cont đã Giám định (đang chờ hạ) vẫn tiếp tục luồng hạ bãi; chỉ cont chưa về bị gạch.
  - Lý do được lưu (`approveNote`) và hiện ở đầu danh sách.
- Kỹ thuật: `ContainerRecord.holdSource = 'VESSEL_EXPORT'`, `vesselLock` / `vesselUnlock` (`vessel.ts`), `VesselItemStatus 'SKIPPED'`, `approveVesselList({ reason })`.

### DEC-132 — Tồn vỏ: mỗi cont đúng 1 dòng

- Trạng thái: CONFIRMED (2026-10-26)
- Quyết định:
  - Cả dòng cont **không xuống dòng**.
  - **Date in** ghi ngày + giờ trên cùng 1 dòng (giờ màu nhạt).
  - Các cột **Date in, Vị trí, Tiến độ** rộng ra cho đủ một dòng.
  - **Ghi chú** dài thì cắt bớt (tối đa khoảng 18rem), rê chuột vào xem đủ.
  - Bảng rộng hơn màn hình thì cuộn ngang.
- Không đổi thứ tự / số cột, nên Excel giữ nguyên (DEC-129).

### DEC-133 — Phiếu thu trả trước: cột HÓA ĐƠN gắn với từng lượt sử dụng

- Trạng thái: CONFIRMED (2026-10-26). Bổ sung DEC-130.
- Bảng **Sử dụng phiếu thu trả trước** trong chi tiết phiếu PT-TTR- có thêm cột **HÓA ĐƠN**: trạng thái của từng lượt (CHƯA XHD / YÊU CẦU XHD / ĐÃ XHD).
- **Bấm vào ô trạng thái** → mở chi tiết ngay dưới dòng:
  - yêu cầu khách đã gửi (các lượt được gộp chung, MST, Gmail, công ty, địa chỉ, ghi chú, số hóa đơn);
  - nút **Đã xuất hóa đơn** cho Kế toán.
  - Lượt chưa có yêu cầu thì báo "Khách hàng chưa gửi yêu cầu".
- Khối **Xuất hóa đơn** của phiếu trả trước chỉ còn mã bảo mật + đường link + dòng tóm tắt; không liệt kê các yêu cầu nữa.
- Excel không đổi.

### DEC-134 — Bảng / danh sách: mỗi thông tin chỉ hiển thị 1 dòng (quy tắc chung)

- Trạng thái: CONFIRMED (2026-10-26). Mở rộng DEC-132 cho toàn ứng dụng.
- Mọi bảng / danh sách (màn văn phòng, báo cáo, tra cứu): mỗi ô **không xuống dòng**; bảng rộng hơn màn hình thì **cuộn ngang**.
- Ô chữ dài (ghi chú, remark, nội dung, danh sách tên): **cắt bớt** (`max-w-[…] truncate`), rê chuột xem đủ (`title`).
- Áp dụng ngay: Văn phòng → Phiếu thu; Báo cáo Hạ vỏ, Cấp vỏ, Nhập tàu, Xuất tàu, Sửa chữa (và Góp ý). Tồn vỏ đã làm ở DEC-132.
- Màn / bảng mới phải theo quy tắc này. Danh sách thẻ trên mobile theo quy tắc riêng (DEC-089, DEC-115).

### DEC-135 — Giới hạn số chữ mỗi ô bảng

- Trạng thái: CONFIRMED (2026-10-26). Bổ sung DEC-134.
- Mỗi ô chữ tự do chỉ hiển thị **tối đa N ký tự**. Dư thì cắt và thêm "…"; rê chuột xem đủ. **Dữ liệu lưu vẫn đầy đủ**, Excel xuất đủ.
- Công thức chung (`shared.tsx`): `clipText(text, max)`, `<CellText text max />`, mức `CELL_MAX`:
  - **SHORT = 20**: mã, số xe, tên ngắn.
  - **MEDIUM = 30** (mặc định): tên khách hàng, người nhận, nhân viên, phản hồi.
  - **LONG = 40**: ghi chú, remark, nội dung.
- Đã áp dụng:
  - Báo cáo Hạ vỏ / Cấp vỏ: khách hàng.
  - Báo cáo Sửa chữa: remark, nhân viên.
  - Báo cáo Góp ý: nội dung, phản hồi.
  - Tồn vỏ: ghi chú.
- Ô chữ tự do mới trong bảng phải dùng `CellText` (không tự viết `truncate`).

### DEC-136 — Vị trí: icon định vị thay chữ "BLOCK-"

- Trạng thái: CONFIRMED (2026-10-26). Bổ sung DEC-082, DEC-092.
- Khi **hiển thị** vị trí trên màn hình, bỏ chữ `BLOCK-` vì tốn chỗ, thay bằng **icon định vị** (đỏ). Ví dụ `BLOCK-A / 17-02-02` hiện là [icon] `A / 17-02-02`. Rê chuột xem mã đầy đủ.
- Áp dụng:
  - Tồn vỏ;
  - Xe nâng: Chờ hạ vỏ / Chờ cấp vỏ, Đảo chuyển (ô Block vẫn rộng cố định để thẳng cột);
  - Chọn vị trí `SlotPicker`: nút Block và tóm tắt;
  - Báo giá, Văn phòng, danh sách Xuất tàu.
- **Không đổi:**
  - Mã lưu vẫn là `BLOCK-…`.
  - **Danh mục → Vị trí** (cấu hình) vẫn ghi đủ `BLOCK-…`.
  - Excel, giấy in, hồ sơ container, nhật ký và thông báo vẫn ghi đủ.
- Kỹ thuật (`shared.tsx`): `<LocationText loc />`, `BlockIcon`, `blockLabel(code)`. Màn mới hiển thị vị trí phải dùng `LocationText`, không in thẳng `formatLocation`.

### DEC-137 — Văn phòng → Cấp vỏ: "Container được chọn" chia ô rõ ràng

- Trạng thái: CONFIRMED (2026-10-26).
- Khu vực **Container được chọn** (khối 1. Booking & container) hiển thị thành **6 ô có nhãn**, chỉ đọc: **Số container | Size/Type | Hãng tàu | Trạng thái | Đóng hàng | Vị trí**. Trước đây là một dòng chữ nối bằng "•".
- Các ô **tự điền** khi bấm chọn container ở danh sách bên trái; không gõ tay. Chưa chọn thì ô hiện "-" kèm nhắc "bấm chọn ở danh sách bên trái".
- Không đổi nghiệp vụ chọn container: cont khóa vẫn không chọn được.

### DEC-138 — Tồn vỏ → Sửa vị trí: khung làm việc giống Đảo chuyển

- Trạng thái: CONFIRMED (2026-10-26).
- Lỗi cũ: khung SỬA VỊ TRÍ trải theo chiều rộng bảng Tồn vỏ (rất rộng), nên nút **Lưu vị trí** bị đẩy ra ngoài màn hình.
- Nay khung là **thẻ gọn** (tối đa `max-w-lg`), **dính bên trái** khi bảng cuộn ngang, bố cục giống Đảo chuyển, từ trên xuống:
  - số container (có nút đóng ✕);
  - Size / Type, Trạng thái + tiến độ, Vị trí hiện tại;
  - khối **Vị trí mới \*** (`SlotPicker`);
  - nút **Lưu vị trí** full chiều rộng ở cuối.
- Nghiệp vụ không đổi: vẫn là sửa vị trí hành chính (`correctContainerLocation`), không ghi nhận là Đảo chuyển.

### DEC-139 — Thứ tự 5 cột đầu thống nhất (Tồn vỏ + báo cáo)

- Trạng thái: CONFIRMED (2026-10-26). **Phần cố định cột đã bỏ theo DEC-141**; thứ tự cột giữ nguyên.
- **5 cột đầu bắt buộc**, theo đúng thứ tự: **Mã hồ sơ | Số container | Size | Type | Hãng tàu**. Các cột này luôn **cố định** bên trái; kéo ngang chỉ cuộn các cột còn lại.
  - Áp dụng: **Tồn vỏ** (ô chọn hàng loạt cũng cố định), **Báo cáo Hạ vỏ, Cấp vỏ, Sửa chữa**.
  - Báo cáo Hạ vỏ tách Size/Type thành 2 cột. Báo cáo Cấp vỏ thêm Size, Type, Hãng tàu (lấy từ container). Báo cáo Sửa chữa thêm Size, Type.
- **Báo cáo Nhập tàu / Xuất tàu:** cố định **6 cột**: **Tên tàu** | Mã hồ sơ | Số container | Size | Type | Hãng tàu. Thời gian nhập / xuất chuyển ra sau.
- **Excel cùng thứ tự** (DEC-129): sheet Hạ vỏ, Cấp vỏ, Sửa chữa, Tồn vỏ bắt đầu bằng 5 cột trên (Cấp vỏ: MÃ HỒ SƠ CẤP); sheet Nhập / Xuất tàu bắt đầu bằng 6 cột.
- Kỹ thuật (`shared.tsx`): `frozenCols(keys)`, `FROZEN_W` (độ rộng px từng cột cố định), `FROZEN_STANDARD`. Dòng bảng cần class `group` để ô cố định đổi màu khi rê chuột. Bảng mới có các cột này phải dùng `frozenCols`.

### DEC-140 — Báo cáo Nhập / Xuất tàu: tách cột Trạng thái và Phân loại

- Trạng thái: CONFIRMED (2026-10-26).
- Cột gộp "Trạng thái • Phân loại" tách thành 2 cột riêng: **Trạng thái** (AV / DAMAGE) | **Phân loại** (đóng hàng).
- Excel: cột "ĐÓNG HÀNG" đổi tên thành **PHÂN LOẠI**, đứng ngay sau TRẠNG THÁI, cho khớp màn hình (DEC-129).

### DEC-141 — Bỏ cố định cột khi kéo ngang

- Trạng thái: CONFIRMED (2026-10-26). Sửa DEC-139.
- **Bỏ** hiển thị cố định (sticky) các cột đầu ở Tồn vỏ và các báo cáo Hạ vỏ, Cấp vỏ, Sửa chữa, Nhập tàu, Xuất tàu. Kéo ngang thì cả bảng cuộn.
- **Giữ nguyên** thứ tự cột đồng bộ của DEC-139 (5 cột đầu Mã hồ sơ | Số container | Size | Type | Hãng tàu; báo cáo tàu thêm Tên tàu đầu tiên), cả trên màn hình lẫn Excel.
- Đã gỡ `frozenCols` / `FROZEN_W` / `FROZEN_STANDARD` khỏi `shared.tsx`.

### DEC-142 — Báo giá → Chờ báo giá: mỗi cont 1 dòng như Tồn vỏ

- Trạng thái: CONFIRMED (2026-10-26). Áp DEC-132, DEC-134, DEC-135 cho menu Báo giá.
- Cả dòng **không xuống dòng**; bảng rộng thì cuộn ngang.
- **Date in**: ngày + giờ trên cùng 1 dòng.
- **Tình trạng sửa chữa** và **Ghi chú** dài: cắt bớt (`CellText`, tối đa 40 ký tự), rê chuột xem đủ.
- Thứ tự cột không đổi, nên Excel giữ nguyên.

### DEC-143 — Tài khoản / đăng nhập: QUY TẮC CHO GIAI ĐOẠN 4 (chưa làm ở bản Demo)

- Trạng thái: CONFIRMED (2026-10-26) — **chỉ thực hiện khi tạo database (GĐ 4, Supabase Auth)**.
- Bản Demo **giữ nguyên tài khoản demo** (chọn người dùng ở góc phải, không có màn đăng nhập). Đã thử làm đăng nhập ở Demo rồi người dùng yêu cầu **hoàn tác** (commit `ffb341e`).
- **Quy tắc sẽ làm ở GĐ 4:**
  - **Admin** (Danh mục → User - Role) tạo tài khoản cho nhân viên: họ tên, **tên đăng nhập**, **vai trò**; email không bắt buộc. Nhân viên chỉ nhận tài khoản và tác nghiệp, không tự đăng ký.
  - **Tên đăng nhập tự tạo** khi nhập họ tên, dạng `ten.hoten`: **tên + "." + chữ cái đầu của họ và tên đệm**, không dấu.
    - Ví dụ: "Lê Văn Tuấn" → `tuan.lv`; "Đỗ Thị Thu" → `thu.dt`.
    - Trùng thì thêm số: `tuan.lv2`…
    - Admin **sửa được**. Ràng buộc: 3–30 ký tự, chữ thường không dấu, số và `. _ -`, không trùng.
  - **Mật khẩu ban đầu = 123456** cho tài khoản mới và sau khi Admin **Đặt lại mật khẩu**.
  - **Lần đăng nhập đầu tiên** (hoặc sau khi đặt lại): **bắt buộc đổi mật khẩu**.
    - Bao nhiêu ký tự cũng được, không để trống.
    - **Không được dùng 123456**, khác mật khẩu hiện tại, nhập lại phải khớp.
  - Nhân viên tự đổi mật khẩu lúc nào cũng được; có nút **Đăng xuất**.
  - Tài khoản bị khóa không đăng nhập được. Báo lỗi chung "Sai tên đăng nhập hoặc mật khẩu".
  - Nhật ký ghi: đăng nhập, đăng xuất, đổi mật khẩu, đặt lại mật khẩu.
  - **Không** cho Admin xem mật khẩu người dùng; người dùng đã cân nhắc và quyết định bỏ. Quên thì Admin đặt lại.
  - Màn User - Role khi đó có thêm: **bộ lọc** (tìm kiếm họ tên / tên đăng nhập / mã NV, vai trò, trạng thái, mật khẩu mặc định / đã đổi) và nút **Thêm nhân viên mới (+)**; bấm mới mở khung thêm (giống Văn phòng → Phiếu thu).
  - Câu hỏi mở cho GĐ 4: Q-041 (email nội bộ cho Supabase Auth, khóa khi sai nhiều lần, tự đăng xuất).
- Code tham khảo (đã hoàn tác, xem lại bằng git):
  - `07dc5f9`: `src/services/auth.ts`, `LoginScreen.tsx`, test `tests/auth.test.ts`;
  - `40b1edb`: `suggestUsername` và màn User - Role có bộ lọc.

### DEC-144 — Đổi tên menu "User - Phân quyền" thành "User - Role"

- Trạng thái: CONFIRMED (2026-10-26). **Đã áp dụng** ở bản Demo (chỉ đổi tên hiển thị menu).
- Các quy tắc tài khoản khác (tên đăng nhập `tuan.lv`, mật khẩu…) gộp vào DEC-143, chờ GĐ 4.

### DEC-145 — Giao diện: design system v2 (tối giản, navy + một màu nhấn)

- Trạng thái: CONFIRMED (2026-10-26). Người dùng duyệt phương án trên Claude Design "MATRAN DEPOT" (https://claude.ai/artifact/EvcTG1G1NN8EmHAp8j5t8E).
- Phong cách tối giản, thân thiện, lấy cảm hứng bố cục từ cổng tài khoản ngành vận tải biển; **không** dùng logo / font / màu nhận diện của thương hiệu khác.
- **Token** khai báo một chỗ ở `src/index.css` (`@theme`), dùng bằng class Tailwind: `canvas`, `surface`, `line`, `line-strong`, `ink`, `ink-muted`, `navy-900/700/50`, `accent`, `accent-soft`, `op-ha-vo`, `op-cap-vo`, `op-nhap-tau`, `op-xuat-tau`, `success-*`, `danger-*`.
  - Màu chính `navy-900` (nút chính, menu, khung quét Xe nâng); link dữ liệu `navy-700`.
  - `accent` dùng ít: focus, mục đang mở, tiến độ — không làm màu chữ.
  - Màu tác nghiệp giữ nguyên nghĩa (DEC-083), chỉ đổi tông.
- **Chữ:** Be Vietnam Pro (giao diện), JetBrains Mono (số cont, mã) — tải từ Google Fonts, có font dự phòng của hệ thống. Cỡ mặc định máy tính 14px; ô nhập điện thoại vẫn 16px (DEC-116).
- **Chữ thường** cho tiêu đề thẻ và nhãn ô nhập; IN HOA chỉ còn ở nhãn tác nghiệp.
- Nút / ô nhập cao tối thiểu 40px, bo 8px; thẻ bo 12px, không bóng đổ.
- **Áp dần theo từng bước** (mỗi bước một commit): (1) token + font + thành phần dùng chung; (2) khung App / menu; (3) Tồn vỏ; (4) màn mobile hiện trường; (5) văn phòng, báo cáo, danh mục, phiếu thu, giấy tờ in — **đã làm cả 5 bước** (đổi class slate / blue sang token). Còn giữ ~20 chỗ màu slate trên nền đậm (chữ / viền phụ).
- **Lưu vào code làm chuẩn bắt buộc:** `docs/DESIGN_SYSTEM.md` + `docs/design/` (tokens, mẫu thành phần, 2 màn mẫu); skill `matran-ui-screen` trỏ tới; test chặn class màu cũ trong `src/`. Màn mới phải dùng token, không viết thêm `blue-600` / `slate-*` cho màu chính.

### DEC-146 — Văn phòng → Nhập / Xuất tàu: bảng chi tiết tàu không gộp cột

- Trạng thái: CONFIRMED (2026-10-26). Áp quy tắc chung DEC-134 / DEC-139.
- Bảng cont trong chi tiết tàu: **# | Mã hồ sơ | Số container | Size | Type | Hãng tàu | Trạng thái | Phân loại | Vệ sinh (NT) / Vị trí lúc lập (XT) | Số xe | Tiến độ | Người thực hiện | Thời gian**; mỗi ô 1 thông tin, `whitespace-nowrap`, chữ dài dùng `CellText`.
- Bỏ cột gộp: Size/Type, "Giám định" / "Trạng thái • Phân loại", "Người / giờ". Hãng tàu: NT lấy của danh sách, XT lấy từ lượt lưu bãi.
- Danh sách tàu: tách "Lập bởi" và "Thời gian lập". Khung dán cont: tách Size | Type.
- Vị trí lúc lập hiển thị icon định vị thay chữ BLOCK- (DEC-136).

### DEC-147 — Giám định → Hạ vỏ: W-SURVEY (LÊN KỆ) + giám định bổ sung trên kệ

- Trạng thái: CONFIRMED (2026-10-26). Thay điểm 1 và 6 của DEC-109.
- Tên hiển thị và giá trị lưu: **W-SURVEY** (người dùng đổi từ "GIÁM ĐỊNH SAU" cho chuyên nghiệp); nút ghi "W-SURVEY (LÊN KỆ)".
- **Giám định:** mục 1 TRẠNG THÁI có 3 lựa chọn **DAMAGE / AV / W-SURVEY (LÊN KỆ)**; bỏ ô tích "HẠ KỆ GIÁM ĐỊNH".
  - Chọn W-SURVEY → bỏ qua mục 2 (Đóng hàng) và 4 (AGE), chỉ chọn **mục 3 Vệ sinh** (1 hoặc nhiều) rồi gửi.
  - Hệ thống tự đánh dấu HẠ KỆ GIÁM ĐỊNH.
- **Văn phòng / Vệ sinh:** làm như thường (Văn phòng nhập Số cont, Size, Type…, thu phí, in K80 / EEIR). **EEIR ghi Trạng thái "W-SURVEY"**; Đóng hàng / AGE để trống ("-").
- **Xe nâng:** sau Vệ sinh, chỉ hạ vào block Kệ giám định (như DEC-109).
- **Giám định bổ sung:** màn Giám định → Hạ vỏ có tab **"Chờ giám định trên kệ (N)"**.
  - Danh sách phiếu W-SURVEY, đã có Số cont + Size + Type từ Văn phòng.
  - Cont chưa hạ lên kệ hiện "Chờ Xe nâng hạ kệ", chưa giám định được.
  - Giám định nhập **AV / DAMAGE (+ lỗi) + Đóng hàng + AGE** (không hỏi lại Vệ sinh).
  - Hệ thống cập nhật hồ sơ Hạ vỏ, K80 (EEIR in lại sẽ có thông tin mới), lượt lưu bãi.
- **Sau giám định bổ sung — như Hạ vỏ thường:** DAMAGE → hàng chờ Báo giá → Sửa chữa; Xe nâng **Đảo chuyển** đưa cont khỏi kệ (xóa cờ kệ). AV → chỉ Đảo chuyển.
- Số đếm menu Giám định – Hạ vỏ (DEC-075) tính cả phiếu trên kệ đã hạ.
- **Đã xác nhận (DEC-150):** cont đang W-SURVEY **không cho Cấp vỏ** (`releaseBlocker`: "Chưa giám định (W-SURVEY)"). Ghi ở Q-042.
- Kỹ thuật:
  - `FieldConditionClass` thêm `'W-SURVEY'` (`CONDITION_DEFERRED`).
  - `stuffingClass` / `manufactureYear` được để trống khi W-SURVEY.
  - `pendingRackInspections`, `completeRackInspection` (`depotOperations.ts`); `GateInOrder.rackInspectedBy / rackInspectedAt`.
  - Nhật ký `GIAM_DINH_TREN_KE`.
  - `InspectionFields` prop `allowDeferred` (chỉ Hạ vỏ, không có ở Nhập tàu), `hideCleaning`.

### DEC-148 — Dữ liệu test (Demo): danh mục theo người dùng + danh sách lớn

- Trạng thái: CONFIRMED (2026-10-26). Bổ sung DEC-106 / DEC-108.
  - Chỉ áp cho `createDemoState()` (nút Nạp dữ liệu test).
  - `createCleanState()` và `createInitialState()` (dùng cho test) không đổi.
- **Danh mục** (tạo bằng hàm Danh mục của Admin):
  - Hãng tàu: chỉ **MSK**.
  - Khách hàng: **10 khách** `KH01` → `KH10`, tên "Khách hàng 01…10" (tên chung — người dùng chưa cung cấp tên thật). KH09, KH10 không cho TTS để thử chặn.
  - Công ty: **CÔNG TY CỔ PHẦN MATRAN** / MATRAN DEPOT / Số 189, đường Đình Vũ, phường Hải An, thành phố Hải Phòng. / 0912907980 / Matran@gmail.com. MST và tài khoản ngân hàng để trống (chưa có).
  - Biểu giá (đã gồm VAT, mọi hãng tàu):

    | Mục | Giá (đồng) |
    |---|---|
    | 20DC | 1.000.000 |
    | 40DC | 1.500.000 |
    | 40HC | 1.500.000 |
    | 45HC | 1.500.000 |
    | THU GOM RÁC LV1 | 200.000 |
    | THU GOM RÁC LV2 | 500.000 |

  - Phí rác: cont 20 / 40 dùng LV1, cont 45 dùng LV2.
- **Danh sách lớn** cho mọi tác nghiệp (`bulkData`):
  - Hạ vỏ: thêm 80 lượt, đủ size / type / khách / thanh toán (TT tiền mặt, chuyển khoản, TTS), DAMAGE, vệ sinh, W-SURVEY, chờ thanh toán.
  - Vệ sinh; Xe nâng hạ vào Block A / B / DAMAGE; một số chờ hạ.
  - Báo giá → Sửa chữa → AV; Giám định trên kệ.
  - Khóa container; Đảo chuyển.
  - Cấp vỏ: 24 lệnh (đã xuất / TTS chờ Xe nâng / chờ thanh toán).
  - Nhập tàu: 3 tàu × 20 cont (xong / dở / chưa làm). Xuất tàu: 1 tàu 12 cont, xuất một nửa.
  - Góp ý: nhiều màn.

### DEC-149 — Mở Giai đoạn 4 (Database): nền tảng Supabase Singapore; trạng thái theo bản Demo

- Trạng thái: CONFIRMED (2026-10-26). Trả lời Q-040 và cách chốt OPEN-003.
- **Mốc lưu bản Demo** (chưa có database), để quay lại khi cần:
  - nhánh `backup/demo-truoc-database`;
  - tag `demo-truoc-database-2026-10-26` (commit `33584bd`).
- **Nền tảng:** **Supabase vùng Singapore**, gói Pro + PITR, 3 môi trường dev / staging / production (theo `docs/DATABASE_PLATFORM_ADVICE.md`).
  - Người dùng tự tạo project và giữ khóa.
  - Agent chỉ viết migration, không apply.
- **Danh mục trạng thái (OPEN-003):** lấy theo bản Demo. Bảng ở `docs/STATUS_CATALOG.md` — **chờ người dùng duyệt** các mã ⚪ (chưa dùng) trước khi viết schema.
- Việc database làm trên nhánh `agent/claude/p4-database`.
- Vẫn mở: Q-037 (lưu ảnh), Q-038 (số người dùng cùng lúc), Q-039 (sao lưu — đã có đề xuất), Q-041 (tài khoản), Q-042.

### DEC-150 — Database: quy mô, ảnh, thời gian lưu, trạng thái, W-SURVEY

- Trạng thái: CONFIRMED (2026-10-26). Trả lời Q-037, Q-038, Q-042 và duyệt `docs/STATUS_CATALOG.md`. **Sửa DEC-066 mục 10.5** (thời gian lưu).
- **Quy mô (Q-038):** **50–70 nhân viên** dùng đồng thời; **10.000–15.000 container ra vào / tháng** (~500 lượt / ngày, 120–180 nghìn lượt / năm).
- **Trạng thái:** dùng các mã ✅ trong `STATUS_CATALOG.md`; **bỏ hết 12 mã ⚪**:
  - `PENDING_GATE_IN`, `OFFICE_VERIFIED`, `SPECIAL_RETURN`;
  - `IN_PROGRESS`, `REWORK_REQUIRED`, `REJECTED`, `REFUNDED`, `HA_SUA_CHUA`;
  - `YARD_MOVE`, `SHIFT_REPAIR`, `SHIFT_INSPECTION_RACK`.
  - Cần thì thêm sau bằng migration.
- **Ảnh cửa container (Q-037):**
  - Nén trên thiết bị còn ~200 KB / ảnh trước khi gửi (~2 GB / tháng).
  - Lưu Supabase Storage ~~24 tháng~~ → **2 tháng** (sửa bởi DEC-159), quá hạn tự xóa ảnh. Hồ sơ vẫn giữ, ghi "ảnh đã hết hạn lưu".
- **Dữ liệu tác nghiệp:**
  - Giữ **trực tuyến 3 năm** (tra cứu / báo cáo trên app).
  - Quá 3 năm → **chuyển ra kho lưu trữ** (file nén + mã hóa, ngoài database) và xóa khỏi bảng trực tuyến.
  - Phần lưu kho vẫn giữ đủ thời hạn chứng từ kế toán theo luật; không tra trên app, khôi phục khi cần.
  - Chuyển kho theo từng tháng (phạm vi partition chỉnh ở DEC-151).
- **W-SURVEY (Q-042):** **không được Cấp vỏ** khi chưa giám định bổ sung — chưa có tình trạng thì không cấp (giữ chặn ở `releaseBlocker`, DEC-147).

### DEC-151 — Database: đăng nhập, mất mạng hiện trường; chỉnh phạm vi partition

- Trạng thái: CONFIRMED (2026-10-26). Trả lời Q-041.
- **Đăng nhập:** nhân viên gõ **tên đăng nhập** (`tuan.lv`); hệ thống đổi thành email nội bộ `tuan.lv@matrandepot.local` cho Supabase Auth (không cần email thật).
- **Không khóa** tài khoản khi nhập sai mật khẩu nhiều lần; **không tự đăng xuất**.
- **Mất mạng ở hiện trường:**
  - Không lưu tạm trên điện thoại. Thao tác chỉ thành công khi máy chủ xác nhận; mất mạng thì báo lỗi, giữ dữ liệu trên màn để bấm lại.
  - Mỗi thao tác gửi kèm `request_id` để bấm lại không tạo trùng.
- **Chỉnh DEC-150 về partition** (Claude rà lại theo quy mô thật, ~3–6 GB / 3 năm):
  - Chỉ `audit_logs` và `location_history` chia partition theo tháng.
  - Bảng nghiệp vụ dùng chỉ mục thời gian; chuyển kho theo tháng bằng truy vấn ngày đóng.
- Thiết kế đầy đủ: `docs/DATABASE_SCHEMA.md` (chờ duyệt).

### DEC-152 — Duyệt thiết kế database v1; sao lưu; ngân hàng làm sau; hoàn tiền giữ chặn

- Trạng thái: CONFIRMED (2026-10-26).
- **Duyệt `docs/DATABASE_SCHEMA.md` v1.** Viết migration theo 5 bước (mục 11). Tiến độ ở `supabase/README.md`.
- **Sao lưu (Q-039):**
  - PITR 7 ngày (khôi phục về thời điểm bất kỳ, mất tối đa ~5 phút).
  - Mỗi đêm 1 bản sao mã hóa ra ngoài Supabase, giữ 30 bản.
  - Diễn tập khôi phục mỗi quý trên staging.
- **Ngân hàng (Q-032): làm sau.** Migration 3 làm khung nhận thông báo ngân hàng chung (chống xử lý lặp theo mã giao dịch). Tạm thời Văn phòng xác nhận tay tiền chuyển khoản.
- **Hoàn tiền (OPEN-008): chưa làm, giữ chặn.** Lệnh đã thu phí không hủy được trên hệ thống; hoàn tiền xử lý ngoài hệ thống.
- **Bước 1 đã viết** (`supabase/migrations/20261027000001` → `000005`, test `supabase/tests/0001_foundation.test.sql`, `supabase/seed.sql`, `supabase/README.md`).
  - Gồm: enum, nhân viên, danh mục, bộ đếm mã, nhật ký partition tháng, chống bấm lặp, ma trận quyền, RPC Danh mục / nhân viên, RLS nền.
  - Thay bản nháp cũ `20261021000001` (chưa từng apply, không khớp nghiệp vụ).
  - **Chưa chạy thử**: máy chưa có Docker / Postgres.

### DEC-153 — Mật khẩu ngắn hơn 6 ký tự trên Supabase; kết quả chạy thử bước 1

- Trạng thái: CONFIRMED (2026-10-27).
- **Vấn đề:** Supabase Auth bắt buộc mật khẩu **tối thiểu 6 ký tự** (không chỉnh xuống thấp hơn). Điều này trái DEC-143 ("bao nhiêu ký tự cũng được").
- **Người dùng chọn giữ DEC-143.** App tự ghép thêm một **chuỗi cố định** vào sau mật khẩu người dùng gõ, rồi mới gửi Supabase (cả lúc đăng nhập và lúc đổi mật khẩu), nên luôn đủ 6 ký tự.
  - Nhân viên chỉ thấy và gõ mật khẩu của mình.
  - Chuỗi ghép là hằng số trong code frontend, không phải bí mật.
  - Kiểm tra "không được dùng 123456" làm trên mật khẩu **trước khi ghép**.
  - Claude đã cảnh báo: mật khẩu ngắn dễ bị dò hơn. Người dùng chấp nhận.
- Làm ở phần đăng nhập frontend GĐ 4 (chưa làm).
- **Cách ghép (chốt kỹ thuật 2026-10-27):** luôn nối `::matran` vào cuối mật khẩu (`PASSWORD_SUFFIX` / `toAuthPassword` trong `supabase/functions/_shared/auth.ts`). Edge Function tạo tài khoản / đặt lại mật khẩu đã dùng; frontend phải dùng đúng hằng này.
- **Chạy thử migration bước 1 trên Supabase local (Docker, 2026-10-27):** 5 file apply không lỗi; pgTAP **18/18 PASS**. Thêm `supabase/config.toml` (cấu hình local, không chứa khóa bí mật).

### DEC-154 — Database bước 3: mã bảo mật hóa đơn, xác nhận tay tiền chuyển khoản

- Trạng thái: CONFIRMED (2026-10-27). Người dùng trả lời 3 câu hỏi khi làm migration bước 3.
- **Mã bảo mật hóa đơn:** lưu **mã gốc** (không băm), để in lại phiếu thu vẫn có mã.
  - Chỉ người có quyền xem phiếu thu (Văn phòng / Quản lý / Kế toán) đọc được.
  - Trang khách `#/hoa-don` chỉ tra đúng mã khớp, phân biệt hoa / thường.
  - Sửa `docs/DATABASE_SCHEMA.md` mục 3.7 (trước ghi "chỉ lưu băm").
- **Xác nhận tay tiền chuyển khoản** (khi chưa nối ngân hàng — DEC-152):
  - **Văn phòng + Quản lý** (quyền `PAYMENT_CONFIRM`). Phiếu thu trả trước: chỉ Văn phòng (`PREPAID_CASH_CONFIRM`), như xác nhận tiền mặt.
  - **Mã giao dịch ngân hàng không bắt buộc.** Bỏ trống thì hệ thống ghi mã nội bộ theo giao dịch.
  - Có nhập thì 1 mã ngân hàng chỉ xác nhận được 1 lần.
  - Giao dịch phải đang chờ (không xác nhận 2 lần).
- **Migration bước 3 đã viết + chạy thử local:** pgTAP 57/57 (tổng 3 bước 107/107).
  - Gồm: chứng từ, dòng chi phí, giao dịch, phiếu thu, in phiếu, phiếu thu trả trước + lượt trừ, hóa đơn (phiếu thường + theo lượt).
  - RPC: Văn phòng Hạ vỏ, thanh toán TT / TTS / TTR, chuyển khoản (callback ngân hàng + xác nhận tay), hủy yêu cầu, GATE IN OK (tạo lượt lưu bãi + K80 + việc Vệ sinh / Báo giá), phiếu thu trả trước, in phiếu, trang hóa đơn, Kế toán ĐÃ XHD.

### DEC-155 — Nối app với database: giữ màn hình, đổi lớp dữ liệu; .env.local cho Supabase local

- Trạng thái: CONFIRMED (2026-10-27).
- **Cách nối:** giữ giao diện; mọi thao tác đi qua một cửa chung `runAction`.
  - Demo: chạy hàm nghiệp vụ hiện có.
  - Database: gọi RPC cùng quy tắc rồi tải lại dữ liệu đang làm việc.
  - Báo cáo / lịch sử lấy theo trang từ database (DEC-066).
- Làm theo 8 giai đoạn N1 → N8 ở `docs/APP_DB_INTEGRATION.md`; mỗi giai đoạn thử trên Supabase local rồi mới sang giai đoạn sau.
- **Ngoại lệ AGENTS.md (file .env):** người dùng cho phép agent tạo `.env.local` **chỉ** với địa chỉ Supabase local (127.0.0.1) và khóa **anon** local mặc định.
  - Không ghi khóa service_role, không ghi khóa project thật, không commit (Git đã bỏ qua `.env.*`).
  - Agent vẫn không đọc / in `.env` khác.

### DEC-156 — Nhập tàu không chụp ảnh cửa container

- Trạng thái: CONFIRMED (2026-10-27, người dùng).
- Giám định Nhập tàu **không** chụp ảnh cửa (giống bản Demo). Chỉ Hạ vỏ bắt buộc ảnh.
- Database giữ nguyên: `p_door_photo_path` của RPC Nhập tàu là tùy chọn, app gửi `null`. Không cần migration.

### DEC-157 — Báo cáo chế độ database: tải riêng theo khoảng lọc (N7)

- Trạng thái: CONFIRMED (2026-10-27, người dùng chọn cách "tải theo khoảng lọc").
- App vẫn giữ dữ liệu đang làm việc (trong bãi + 90 ngày). Báo cáo / Phiếu thu / Góp ý lọc có ngày bắt đầu **cũ hơn 90 ngày** → app tải riêng dữ liệu trong khoảng lọc rồi chạy **cùng hàm báo cáo + Excel** trong `reports.ts`. Không viết RPC báo cáo riêng, không migration mới.
- Khi tải riêng: mỗi lần tối đa **3 tháng** (92 ngày). Bản Demo giữ giới hạn cũ (366 ngày).
- Code: `src/services/remote/reportSource.ts` (quy tắc), `loadWorkingState(client, me, range)`, hook giao diện `src/components/useReportState.ts`.
- Phiếu thu / Góp ý: dữ liệu tải riêng **chỉ để xem danh sách + Excel**; thao tác ghi (xác nhận tiền, xuất hóa đơn, trả lời) luôn chạy trên dữ liệu đang làm việc.
- Giới hạn đã biết (cửa sổ nay là 7 ngày — DEC-158): phiếu thu cũ hơn cửa sổ xem được nhưng thao tác ghi có thể báo không tìm thấy; Báo cáo Sửa chữa ở khoảng cũ chỉ thấy cont có ngày vào bãi trong khoảng đó. Nếu chạy chính thức thấy chậm → chuyển sang RPC phân trang.

### DEC-158 — Chế độ database: dữ liệu làm việc 7 ngày, chỉ tải phần thay đổi (N8)

- Trạng thái: CONFIRMED (2026-10-27, người dùng chọn "chỉ tải phần thay đổi").
- **Lý do (đo thật, 45.000 lượt / 90 ngày, 5.000 cont tồn):** tải lại 90 ngày mất 206 giây / 171 MB mỗi lần; 60 máy × 30 giây ≈ hàng chục TB băng thông / tháng → không dùng được.
- **Dữ liệu đang làm việc:** cont trong bãi + việc đang mở + **7 ngày** gần nhất (thay 90 ngày). Báo cáo / Phiếu thu / Góp ý lọc xa hơn tự tải riêng (DEC-157).
- **Làm mới:** mở app / bấm Tải lại → tải đủ; sau mỗi lần lưu và mỗi 30 giây → chỉ tải dòng có `sync_at` mới + dòng bị xóa (`sync_deletions`), mốc thời gian lấy giờ máy chủ (`server_now`), lấy chồng 1 phút.
- **Chỉ tải dữ liệu dạng bảng** (người dùng yêu cầu): ảnh cửa chỉ ký link xem tạm, trình duyệt tải ảnh khi mở hồ sơ.
- Kết quả đo sau khi làm: mở app 6,8 giây; đồng bộ 30 giây ~0,08 giây / ~2 KB.
- Migration kỹ thuật `20261102000001_sync_delta.sql` (không đổi nghiệp vụ); pgTAP `0007_sync`.
- **Mất mạng (DEC-151):** báo lỗi ngay khi bấm, không xếp hàng, màn hình giữ dữ liệu để bấm lại; dải đỏ "Mất kết nối mạng"; có mạng lại tự tải lại.
- Giới hạn đã biết: mở Hồ sơ container của cont đã OUT quá 7 ngày từ màn báo cáo có thể không thấy (hồ sơ đọc dữ liệu đang làm việc).

### DEC-159 — Ảnh cửa container Hạ vỏ giữ 2 tháng

- Trạng thái: **ĐÃ THAY bởi DEC-176** (2026-10-29: ảnh không tự xóa). CONFIRMED (2026-10-27, người dùng). **Sửa DEC-150** (24 tháng → 2 tháng).
- Ảnh chụp cửa cont khi Gate in (Hạ vỏ) lưu 2 tháng rồi tự xóa (lịch pg_cron + Edge Function `purge-expired-photos` đã có). Hồ sơ vẫn giữ, ghi "ảnh đã hết hạn lưu".
- Sửa trực tiếp trong migration gốc (chưa apply lên database thật nào): `photo_expires_at = ngày chụp + 2 tháng`.

### DEC-160 — Lưu ngầm, không chặn màn hình (chế độ database)

- Trạng thái: CONFIRMED (2026-10-28, người dùng yêu cầu lưu mượt + nhanh hơn).
- Bấm Lưu → hàm nghiệp vụ kiểm trên máy, màn hình đổi ngay; RPC ghi ngầm theo hàng chờ (`RemoteApp.flush`). Không có lớp chặn bấm; chỉ viên "Đang lưu…" khi > 300 ms. Chống bấm trùng = kiểm trạng thái trong hàm nghiệp vụ + database kiểm lại.
- Thao tác bấm trong lúc lưu nối vào hàng, chạy cùng vòng; chỉ thay dữ liệu màn hình khi hàng đã trống.
- Sau khi lưu chỉ tải phần thay đổi, dùng lại danh mục đã tải; RPC `catalog_*` / `admin_*` → tải lại danh mục (`takeCatalogTouched`). Tự làm mới 30 giây vẫn tải cả danh mục.
- Database từ chối → dải đỏ báo lỗi + tải lại dữ liệu thật (như cũ).

### DEC-161 — Phiếu EEIR (K80) + Phiếu thu (K80); In hồ sơ container A4

- Trạng thái: CONFIRMED (2026-10-28, người dùng). **Sửa DEC-072, DEC-076** (EEIR / phiếu thu nửa A4) cho Hạ vỏ / Cấp vỏ.
- **Bỏ EEIR A4** Hạ vỏ / Cấp vỏ. Phiếu tác nghiệp K80 **là** phiếu EEIR giao khách, tên trên phiếu: **"PHIẾU EEIR TÁC NGHIỆP"**, đặt dưới khối thông tin depot (tên, địa chỉ, ĐT, MST — cùng mẫu Phiếu thu (K80); sửa 2026-10-28: bỏ tên depot khỏi tiêu đề vì đã có ở trên). Giữ nguyên toàn bộ thông tin, lộ trình, QR (DEC-052, DEC-057).
- **Phiếu thu đổi sang khổ K80**, giữ đủ thông tin (công ty, Số, tác nghiệp, bảng phí, mã xuất hóa đơn, chữ ký, BẢN IN LẠI).
- **Trả chứng từ** tự in liền 1 lệnh: Phiếu EEIR (K80) + Phiếu thu (K80); mỗi phiếu 1 trang → máy in nhiệt **tự cắt giữa các phiếu** (driver máy in đặt cắt sau mỗi trang).
- Tên gọi thống nhất trên giao diện: **Phiếu EEIR (K80)**, **Phiếu thu (K80)**. Hạ vỏ và Cấp vỏ vẫn mỗi tác nghiệp 1 bộ phiếu riêng.
- Hồ sơ container có nút **HỒ SƠ CONTAINER** (A4): toàn bộ hồ sơ tới thời điểm in — mở cửa sổ xem, trong đó chọn **IN** hoặc **XUẤT PDF** (bổ sung 2026-10-29; PDF qua hộp thoại in "Lưu dưới dạng PDF", không thêm thư viện).
- EEIR **Nhập tàu / Xuất tàu** cũng **khổ K80** (bổ sung 2026-10-28, đóng Q-045) — giữ nguyên thông tin tàu + tình trạng vỏ Giám định. Không còn giấy tờ nửa A4.
- **Bản in giống hệt bản xem** (bổ sung 2026-10-28): mọi phiếu K80 (EEIR Hạ vỏ / Cấp vỏ / Nhập tàu / Xuất tàu, Phiếu thu) cùng bề rộng 72mm trên màn hình và khi in, **giữ khung nét đứt**; khổ giấy xem trước = 80mm × chiều dài phiếu (`printNow`), không còn tờ A4.
- **Quy trình Xem → In** (bổ sung 2026-10-28): nút trên hồ sơ / Phiếu thu mở **cửa sổ xem phiếu**, nút In nằm trong cửa sổ xem (`PrintPreviewModal`). Trả chứng từ vẫn tự in (mục trên).
- **Tên nút IN HOA, thống nhất:** EEIR HẠ VỎ / PHIẾU THU • EEIR CẤP VỎ / PHIẾU THU • EEIR NHẬP TÀU • EEIR XUẤT TÀU • HỒ SƠ CONTAINER • PHIẾU THU (đúng chữ người dùng gửi).

### DEC-162 — PHIẾU TRẢ KHÁCH HÀNG "MATRAN EEIR - PHIẾU THU" (gộp EEIR + phiếu thu)

- Trạng thái: CONFIRMED (2026-10-29, người dùng). **Sửa DEC-161** phần Trả chứng từ (trước: in liền EEIR (K80) + Phiếu thu (K80)).
- Phiếu giao khách khi **Trả chứng từ** là **1 phiếu K80** tên **"MATRAN EEIR - PHIẾU THU"** (`CustomerSlipK80`):
  - Phần đầu giống **PHIẾU EEIR TÁC NGHIỆP**: thông tin depot → (tên phiếu / Số / TÁC NGHIỆP | mã QR tác nghiệp) → thông tin cont.
  - **Bỏ LỘ TRÌNH — QUÉT MÃ**, thay bằng **THÔNG TIN THANH TOÁN** + **YÊU CẦU XUẤT HÓA ĐƠN** như Phiếu thu (Số phiếu thu, bên thanh toán, hình thức, thời gian thu, bảng phí, tổng thu, mã bảo mật + QR link xuất hóa đơn) — dùng chung khối `ReceiptPaymentBody`.
  - Không có phiếu thu (TTS / trừ phiếu trả trước) → ghi hình thức thanh toán, "không phát hành phiếu thu lượt này".
- **Hồ sơ container**: mỗi tác nghiệp có **PHIẾU EEIR HẠ VỎ / CẤP VỎ** (phiếu tác nghiệp) + **PHIẾU TRẢ KHÁCH HÀNG** (Xem → IN); tàu: **PHIẾU EEIR NHẬP TÀU / XUẤT TÀU**. Bỏ nút "Xem / in phiếu EEIR (K80)" (trùng).
- Sửa 2026-10-29: phiếu trả khách hàng **không có tiêu đề** — đầu bên trái chỉ "Số" + "TÁC NGHIỆP", bên phải QR; khối thanh toán tên **PHIẾU THU**; dòng **Khách hàng** (thay "Bên thanh toán"); **BẢN IN LẠI — LẦN n** nằm dưới khối PHIẾU THU.
- **Số lần in** (người dùng chọn 2026-10-29): **chỉ dùng bộ đếm phiếu thu** (`recordReceiptPrint`, DEC-063) — in phiếu trả khách hàng = ghi 1 lần in cho mỗi phiếu thu kèm theo; từ lần 2 hỏi xác nhận + nhãn BẢN IN LẠI. Không đổi database. Phiếu EEIR tác nghiệp và phiếu trả khách không có phiếu thu **không đếm**.
- **Phiếu thu lẻ** giữ nguyên ở Văn phòng → Phiếu thu (in / in lại có đếm).

### DEC-163 — PHIẾU EEIR NHẬP TÀU / XUẤT TÀU có mã QR + LỘ TRÌNH như phiếu tác nghiệp

- Trạng thái: CONFIRMED (2026-10-29, người dùng). **Bổ sung DEC-069 / DEC-081**: tác nghiệp tàu vẫn không thu phí, không tạo phiếu K80 riêng, không Trả chứng từ — chỉ **phiếu EEIR tàu** đổi mẫu.
- PHIẾU EEIR NHẬP TÀU / XUẤT TÀU (`VesselEeirPrintSheet`, khổ K80) **cùng mẫu PHIẾU EEIR TÁC NGHIỆP Hạ vỏ / Cấp vỏ**: thông tin depot → "PHIẾU EEIR TÁC NGHIỆP / Số / TÁC NGHIỆP" + **mã QR** → thông tin cont + tàu + tình trạng vỏ → **LỘ TRÌNH — QUÉT MÃ TẠI TỪNG BỘ PHẬN** → Văn phòng xác nhận (người lập danh sách).
- Mã QR = `QR-<mã hồ sơ NT- / XT->` (`vesselQrCode`, theo DEC-057). Quét được ở Vệ sinh / Xe nâng (cont NT- đã mang mã này) và màn Nhập / Xuất tàu (bỏ tiền tố QR- rồi tra như mã hồ sơ).
- Lộ trình (`getVesselRoute`, chỉ đọc dữ liệu): **Nhập tàu** = Giám định → Vệ sinh (nếu có) → Xe nâng hạ vỏ → Văn phòng duyệt nhập tàu; **Xuất tàu** = Văn phòng lập danh sách → Xe nâng xuất cont → Văn phòng duyệt xuất tàu. Bước đã xong có ✓ + giờ.
- Thời điểm xem / in giữ như cũ: Nhập tàu từ khi Giám định xác nhận; Xuất tàu khi cont đã OUT. *(Xuất tàu đổi theo DEC-167.)*

### DEC-167 — EEIR XUẤT TÀU in ngay khi lập danh sách + in cả danh sách; XUẤT PDF tải thẳng file

- Trạng thái: CONFIRMED (2026-10-28, người dùng). **Sửa DEC-163** (thời điểm in Xuất tàu).
- PHIẾU EEIR XUẤT TÀU in được **ngay khi cont có mã XT-** (lập danh sách), không chờ OUT; cont **Không kịp** (SKIPPED) không in. Nhập tàu giữ như cũ.
- Văn phòng → Xuất tàu → chi tiết danh sách: nút **PHIẾU EEIR XUẤT TÀU — CẢ DANH SÁCH (n)** (mỗi cont 1 phiếu K80, máy cắt sau mỗi phiếu) + nút in từng dòng. Cửa sổ xem có **IN** và **XUẤT PDF**.
- **XUẤT PDF tải thẳng file** (`exportPdf` trong `src/components/printNow.ts`, thư viện `jspdf` + `html2canvas-pro`, chỉ tải khi bấm): chụp bản xem trong cửa sổ đang mở — K80 mỗi phiếu 1 trang 80mm × chiều dài; Hồ sơ container khổ A4, dài tự sang trang.
- Độ dài mật khẩu tối thiểu: **giữ logic cũ** (người dùng chốt, không đổi).

### DEC-168 — Bỏ in EEIR cả danh sách; mộc KHÔNG XUẤT TÀU trong hồ sơ

- Trạng thái: CONFIRMED (2026-10-28, người dùng). **Sửa DEC-167**: bỏ nút in EEIR **cả danh sách** ở Văn phòng → Xuất tàu (giữ nút in từng cont).
- Hồ sơ container: cont trong danh sách Xuất tàu nhưng **không xuất được** (SKIPPED — Không kịp, DEC-131) → nút PHIẾU EEIR XUẤT TÀU **không mở được** + **mộc đỏ "KHÔNG XUẤT TÀU"** bên trái nút.
- Dòng tác nghiệp tàu trong hồ sơ ghi `XUẤT TÀU — XT-… • tàu …` / `NHẬP TÀU — NT-… • tàu …` (bỏ chữ "EEIR (K80)").

### DEC-169 — Hồ sơ container: bước VĂN PHÒNG — DUYỆT XUẤT TÀU có tiến độ thực tế

- Trạng thái: CONFIRMED (2026-10-28, người dùng). Nội dung bước duyệt của cont Xuất tàu trong hồ sơ: "Xác nhận hoàn thành danh sách xuất tàu <tên tàu>" + "Tiến độ thực tế : <đã xuất>/<tổng cont danh sách>" (`vesselListProgress`). Bỏ dòng "Duyệt cả danh sách… Không thu phí, không phiếu EEIR (K80)". Nhập tàu giữ như cũ.

### DEC-170 — Báo cáo SẢN LƯỢNG SỬA CHỮA (giờ công từng nhân viên)

- Trạng thái: CONFIRMED (2026-10-28, người dùng). Báo cáo → Sửa chữa có 2 tab **CHI TIẾT** / **SẢN LƯỢNG SỬA CHỮA**.
- Chỉ tính cont **đã sửa xong**, theo thời gian hoàn tất. Giờ công cont chia đều cho số nhân viên tác nghiệp: 1 người nhận cả, 2 người chia 2, 3 người chia 3… (làm tròn 2 số lẻ).
- Bộ lọc: **thời gian** (bắt buộc), **tổ sửa chữa**, **nhân viên sửa chữa**. Bảng mỗi nhân viên 1 dòng (tổ, số cont, giờ công) + dòng tổng; bấm dòng → cửa sổ trượt từng cont (giờ công cont, số người, giờ chia). Excel 2 sheet (tổng hợp + chi tiết). Quy tắc ở `queryRepairOutput` (`src/services/reports.ts`).

### DEC-171 — Nhãn đầu dòng danh sách CHỜ SỬA CHỮA

- Trạng thái: CONFIRMED (2026-10-28, người dùng). Sửa chữa → Chờ sửa chữa: ô nhãn đầu mỗi dòng (và khung cont vừa quét) ghi **CHỜ SỬA CHỮA**, không ghi tác nghiệp (HẠ VỎ / NHẬP TÀU…). Các danh sách chờ khác giữ nhãn tác nghiệp (DEC-089).

### DEC-196 — Xuất tàu: Mã cảng đến (tùy tàu)

- Trạng thái: CONFIRMED (2026-10-30, người dùng — trả lời Q-064).
- Văn phòng lập / sửa danh sách **Xuất tàu** bắt buộc nhập **Mã cảng đến** (5–10 chữ hoa / số, VD `VNHPHTM`) — **tùy tàu**. Nhập tàu không dùng.
- Dùng cho EDI CODECO gate-out xuất tàu: `RFF+BN:<mã cảng đến>` (`docs/EDI_MAERSK.md` 3.4).
- Giờ gửi EDI cho cont xuất tàu = **giờ thực tế từng cont ra bãi** (Xe nâng xuất — `doneAt`), không lấy giờ cả lô như app cũ (người dùng chọn — Q-051 phần xuất tàu).
- Code: `cleanDestinationPort`, `VesselList.destinationPort` (`vessel.ts`). Database: migration `20261118000001_vessel_destination_port.sql` (cột `vessel_lists.destination_port`, hàm `vessel_destination_port`, `create_vessel_list` / `update_vessel_list` thêm `p_destination_port`), pgTAP `0020`.

### DEC-195 — Mã ISO 6346 cho Size / Type (giữ tên 20DC, 40HC…)

- Trạng thái: CONFIRMED (2026-10-30, người dùng chọn phương án A).
- **Màn hình, phiếu in, biểu giá giữ cách gọi 20DC / 40DC / 40HC / 45HC…** — không bắt nhân viên học mã mới.
- **Danh mục Container** thêm khung **Mã ISO 6346 theo Size - Type** (Admin sửa; mã trống = bỏ). Mặc định:
  - 20DC 22G1 • 40DC 42G1 • 40HC 45G1 • 45HC L5G1;
  - 20RF 22R1 • 40RF 45R1 • 20OT 22U1 • 40OT 42U1 • 20FR 22P1 • 40FR 42P1.
- **Mỗi cont có thể có mã riêng** (`isoCode`, VD lấy từ Maersk eEIR API khi Giám định — làm ở bước eEIR); không có thì theo Danh mục (`containerIsoCode`).
- Hồ sơ container hiện **Size / Type (ISO)**.
- **EDI:** công tắc "Bộ mã gửi" theo hãng — **mã app cũ** (2200 / 4200 / 4500 — chạy song song để so khớp) hoặc **ISO 6346** (khi Maersk xác nhận). Làm ở bước EDI.
- Lý do: app cũ gửi mã không đúng chuẩn (40DC và 40HC cùng `4200`, 45HC `4500`); Maersk eEIR API dùng ISO 6346 (`equipmentISOCode`).
- Database: migration `20261117000001_container_iso_codes.sql` (bảng `container_iso_codes`, cột `containers.iso_code`, RPC `catalog_set_iso_code`), pgTAP `0019`.

### DEC-194 — Cấp vỏ: Tác nghiệp Release for customer / Release for sale (Sale code)

- Trạng thái: CONFIRMED (2026-10-30, người dùng).
- Văn phòng → Cấp vỏ, khối 1 có ô **Tác nghiệp**: **Release for customer** (mặc định) / **Release for sale** (cấp sale).
- Chọn Release for sale → bắt buộc nhập **Sale code** (viết hoa, tối đa 40 ký tự). Release for customer không lưu sale code.
- **Các bước sau giống nhau:** thanh toán, Xe nâng cấp vỏ, trả chứng từ, đổi container. Loại cấp vỏ (`gateOutType`) giữ `EMPTY_RELEASE` → báo cáo Cấp vỏ vẫn gồm cấp sale.
- Tác nghiệp + Sale code ghi ở lệnh cấp (`releasePurpose`, `saleCode`), hiện ở Lịch sử hồ sơ (dòng Văn phòng — Cấp vỏ) và nhật ký. Chuẩn bị cho EDI hãng tàu (`docs/EDI_MAERSK.md`, OPEN-009).
- Tác nghiệp + Sale code giữ lại khi lập nhiều cont cùng booking (như số booking / khách hàng).
- Database: migration `20261116000001_release_purpose.sql`:
  - cột `gate_out_orders.release_purpose`, `sale_code` + ràng buộc SALE phải có sale code;
  - `create_release_order` thêm `p_purpose`, `p_sale_code` (có mặc định — gọi kiểu cũ vẫn chạy);
  - pgTAP `0018` (8 kiểm tra).

### DEC-193 — Icon nâng hạ (Trả chứng từ cấp vỏ) dùng màu token

- Trạng thái: CONFIRMED (2026-10-30, người dùng). Sửa DEC-192 phần màu.
- Icon xe nâng ở Văn phòng → Trả chứng từ → Đang chờ TRẢ CHỨNG TỪ CẤP VỎ dùng màu token của DESIGN_SYSTEM, không dùng xanh / vàng Tailwind:
  - **Đã nâng hạ:** `bg-success-bg text-success-fg` (viền `success-fg/30`).
  - **Chưa nâng hạ:** trung tính `bg-canvas text-ink-muted border-line-strong` (cùng kiểu nút phụ).
  - Khung `rounded-md border`, 24px.

### DEC-192 — Đổi container cả khi CHƯA NÂNG HẠ; Trả chứng từ cấp vỏ hiện đủ lệnh + icon nâng hạ

- Trạng thái: CONFIRMED (2026-10-30, người dùng — yêu cầu + trả lời câu hỏi). Bổ sung DEC-185 / 186; sửa DEC-188 (icon chờ).
- Tình huống mới: lái xe ra kiểm tra cont, yêu cầu đổi **trước khi Xe nâng nâng hạ lên xe**. Trường hợp đổi khi đã lên xe giữ nguyên như DEC-185 / 186.
- **Văn phòng → Trả chứng từ, cột CẤP VỎ hiện đủ** các lệnh đã thu tiền, chưa trả chứng từ (trước đây chỉ hiện lệnh đã nâng hạ). Mỗi dòng có **icon nâng hạ**:
  - **xanh** (token success — DEC-193) = ĐÃ NÂNG HẠ lên xe;
  - **xám trung tính** (DEC-193; ban đầu vàng) = CHƯA NÂNG HẠ → nút **Trả chứng từ khóa**, nhưng **vẫn ĐỔI CONTAINER được**.
- **Đổi khi chưa nâng hạ (icon vàng):**
  - lệnh CV- (giữ mã, chứng từ, phiếu thu, QR) chuyển sang cont mới và **vẫn ở Xe nâng — Chờ cấp vỏ**, mang nhãn **ĐỔI CONT**;
  - cont cũ **giữ nguyên vị trí**, bỏ khóa phân bổ, tồn bãi; không có việc Xe nâng hạ lại.
  - **Kén vỏ:** cấp được cho khách khác ngay.
  - **Hư hỏng:** DAMAGE + nhãn PHÁT SINH CẤP VỎ + **vào Chờ báo giá ngay** (người dùng chọn — cần chuyển khu sửa chữa thì Xe nâng Đảo chuyển như thường).
- Lệnh chưa thu tiền vẫn không đổi được (hủy lệnh như cũ).
- Lịch sử hồ sơ cont cũ: dòng ĐỔI CONT ghi "Chưa nâng hạ — cont giữ vị trí cũ"; không có dòng Xe nâng cấp vỏ.
- **Icon chờ trong Lịch sử hồ sơ:** dòng ĐANG CHỜ dùng **đồng hồ** như cũ (bỏ đồng hồ cát — DEC-188).
- Code:
  - `canSwapGateOut` (thêm `PENDING_FORKLIFT`), `isGateOutLifted`, `swapGateOutContainer` (nhánh chưa nâng hạ), `releaseDamageWorkOrder` (`depotOperations.ts`);
  - `releaseTicketsInProgress` (`driverRoute.ts`);
  - `GateOutSwap.lifted`.
- Database: migration `20261115000001_gate_out_swap_before_lift.sql` (định nghĩa lại `swap_gate_out_container`), pgTAP `0015` (35 kiểm tra).

### DEC-191 — User - Role dạng tab; thông tin chi tiết nhân viên

- Trạng thái: CONFIRMED (2026-10-29, người dùng — yêu cầu + trả lời câu hỏi).
- **Danh mục chung → User - Role** chia tab như trang Báo cáo bộ phận: **DANH SÁCH NHÂN VIÊN** (mặc định) | **VAI TRÒ & QUYỀN** (bảng vai trò → màn hình, giữ như cũ).
- **Danh sách nhân viên:**
  - bộ lọc (tìm Mã NV / họ tên / tên đăng nhập, Phòng ban) + nút **THÊM NHÂN VIÊN** cùng hàng;
  - bảng 1 dòng / nhân viên: Mã NV | Họ và tên | Phòng ban | Vai trò | Tên đăng nhập | Thông tin chi tiết (Đủ / Thiếu n mục) | Trạng thái; có phân trang;
  - bấm dòng → cửa sổ trượt phải: sửa thông tin chi tiết, phòng ban, vai trò, khóa / mở khóa, đặt lại mật khẩu.
- **Thông tin chi tiết:**
  - Mã nhân viên (hệ thống cấp), Họ và tên, Giới tính (Nam / Nữ), CCCD (12 số, không trùng), Năm sinh (1940 → năm nay − 15), Quê quán, **Phòng ban** (1 phòng, chọn trong các vai trò hiện có).
  - **Phòng ban độc lập với vai trò** (người dùng chọn): role là phân quyền (nhiều), phòng ban chỉ là thông tin hồ sơ.
- **Tạo nhân viên chỉ cần Họ và tên** (+ vai trò để có quyền; tên đăng nhập tự tạo theo DEC-143; phòng ban tùy chọn). Thông tin chi tiết để trống = "Chưa cập nhật" — yêu cầu cập nhật / xác minh làm sau.
- **Ai xem:** Admin (mọi người) + **chính nhân viên** (của mình) — người khác chỉ thấy mã + tên (`staff_directory`). Chỉ Admin sửa. Nhật ký không ghi số CCCD.
- **Header — icon khiên → Thông tin chi tiết:** nhân viên **chỉ xem** hồ sơ của mình (ô trống ghi "Chưa cập nhật", sai / thiếu báo Admin).
- Code:
  - `updateStaffProfile`, `staffProfileMissing` (`depotOperations.ts`);
  - `UserRoleCatalog.tsx` (tab), `MyProfile` (`AccountMenu.tsx`).
- Database: migration `20261114000001_staff_profile.sql`:
  - cột `staff.gender / id_number / birth_year / hometown / department`, CCCD duy nhất;
  - RPC `admin_update_staff_profile`;
  - pgTAP `0017` (13 kiểm tra).
- **Kèm sửa lỗi DEC-189:**
  - bản đầu migration `20261113000001` ghi đè hàm dùng chung `assert_admin()`, làm các thao tác Admin khác báo nhầm câu "chỉ Admin xem được sức khỏe database" (quyền vẫn đúng);
  - nay `20261113000001` dùng hàm riêng `assert_db_admin()`, và `20261114000001` khôi phục `assert_admin()` đúng bản gốc.

### DEC-190 — Menu: chỉ mở 1 bộ phận một lúc

- Trạng thái: CONFIRMED (2026-10-29, người dùng).
- Menu bên trái: bấm mở bộ phận khác → bộ phận đang mở **tự thu gọn**; chỉ 1 bộ phận mở tại một thời điểm. Bấm lại tiêu đề bộ phận đang mở → thu gọn.
- Mở màn từ nơi khác (link phiếu thu, hồ sơ…) → menu tự mở đúng bộ phận chứa màn đó.
- Không còn ghi nhớ nhóm thu gọn trong trình duyệt (bỏ `collapsedGroups`); thanh menu thu nhỏ (rail) giữ nguyên.
- Code: `openGroup` / `toggleGroup` (`App.tsx`); nhóm thu gọn ẩn bằng `hidden`.

### DEC-189 — Danh mục chung → Database: theo dõi sức khỏe database (chỉ Admin)

- Trạng thái: CONFIRMED (2026-10-29, người dùng — yêu cầu + trả lời câu hỏi).
- Menu **Danh mục chung → Database**, **chỉ Admin** (`MENU_ACCESS DM_DATABASE: []`; RPC kiểm tra Admin lần nữa).
- Dashboard gọn: trạng thái chung + nút Làm mới → khối **Cảnh báo** (mỗi mục 1 dòng, đỏ trước) → 4 ô số liệu (Database, Kho ảnh, Kết nối, Phản hồi) có thanh % → bảng **Chỉ số sức khỏe** → **Bảng dữ liệu lớn nhất** (15) → **Kho ảnh** → **Tác vụ định kỳ** → **Giới hạn dung lượng**. Mọi bảng 1 dòng / thông tin (`data-table`, `whitespace-nowrap`, `CellText`).
- **Chỉ số theo dõi:**
  - **Dung lượng:** dung lượng database; kho ảnh (theo kho, số ảnh).
  - **Kết nối & truy vấn:** kết nối đang mở / tối đa; truy vấn chạy > 60 giây; kết nối chờ khóa / treo trong giao dịch.
  - **Hiệu năng:** thời gian phản hồi đo từ máy đang mở; tỉ lệ đọc từ bộ nhớ đệm.
  - **Bảo trì:** dòng chờ dọn (bảng ≥ 10.000 dòng); tác vụ định kỳ pg_cron (lần chạy gần nhất, lỗi 7 ngày); partition tháng sau của nhật ký / lịch sử vị trí; tuổi giao dịch (chống tràn bộ đếm).
  - **Thông tin chung:** phiên bản PostgreSQL, chạy từ lúc, lần ghi dữ liệu gần nhất.
- **Không** có tên đăng nhập, mật khẩu, khóa, chuỗi kết nối, tên người dùng database, nội dung câu truy vấn.
- **Ngưỡng (người dùng chọn):**
  - Vàng ≥ 70%, Đỏ ≥ 85% cho dung lượng database / kho ảnh / kết nối.
  - Phản hồi: vàng ≥ 1 giây, đỏ ≥ 3 giây.
  - Bộ nhớ đệm: vàng < 99%, đỏ < 95%.
  - Truy vấn chậm: vàng khi có, đỏ khi > 5 phút.
  - Tác vụ định kỳ: đỏ khi lỗi, vàng khi tắt.
  - Tuổi giao dịch: vàng ≥ 1 tỉ, đỏ ≥ 1,5 tỉ.
- **Giới hạn dung lượng do Admin nhập** (người dùng chọn), mặc định gói Pro 8 GB database / 100 GB kho file; đổi gói thì sửa số, không sửa code.
- **Cảnh báo trước:** số đếm **đỏ** trên menu Danh mục chung → Database (số mục vàng + đỏ) — kiểm tra khi Admin mở app và mỗi 15 phút; trong màn: khối Cảnh báo trên cùng kèm việc cần làm.
- Demo (không có database): màn hiện thông báo, không số liệu giả.
- Code:
  - `src/services/dbHealth.ts` (ngưỡng, `evaluateDbHealth`);
  - `src/services/remote/dbHealthSource.ts`;
  - `src/features/catalog/DatabaseHealthWorkspace.tsx`.
- Database: migration `20261113000001_db_health.sql`:
  - bảng `db_health_settings`;
  - RPC `db_health`, `set_db_health_limits`, `assert_admin`;
  - pgTAP `0016` (12 kiểm tra).

### DEC-188 — Lịch sử hồ sơ: cột TRẠNG THÁI (chỉ icon) bên phải Nhân viên

- Trạng thái: CONFIRMED (2026-10-29, người dùng).
- Bảng LỊCH SỬ HỒ SƠ: Thời gian | Bộ phận | Tác nghiệp | Nội dung | Chi tiết | Nhân viên | **Trạng thái**.
- Cột Trạng thái **chỉ có icon**: **tích xanh** = hoàn thành (mọi dòng lịch sử), **đồng hồ cát** (vàng, nhấp nháy) = đang chờ (dòng ĐANG CHỜ). Icon đồng hồ ở cột Thời gian của dòng chờ chuyển sang cột này.
- Code: `DoneIcon` / `WaitIcon` (`MasterDossierModal.tsx`).

### DEC-187 — Lịch sử hồ sơ: thêm cột TÁC NGHIỆP bên phải BỘ PHẬN; ĐỔI CONT ghi rõ

- Trạng thái: CONFIRMED (2026-10-29, người dùng). Bổ sung DEC-184.
- Bảng LỊCH SỬ HỒ SƠ: **THỜI GIAN | BỘ PHẬN | TÁC NGHIỆP | NỘI DUNG | CHI TIẾT | NHÂN VIÊN**. TÁC NGHIỆP là việc bên trong bộ phận, VD:
  - Văn phòng: Hạ vỏ, Thanh toán Hạ vỏ, GATE IN OK, Trả chứng từ Cấp vỏ;
  - Xe nâng: Hạ vỏ, Đảo chuyển, Cấp vỏ;
  - Vệ sinh / Sửa chữa: tên bộ phận.
- Dòng ĐANG CHỜ cũng có cột Tác nghiệp.
- **Đổi container ghi rõ tác nghiệp ĐỔI CONT** (nhãn đỏ), không ghi Trả chứng từ / Cấp vỏ / Hạ vỏ thường:
  - Văn phòng — **ĐỔI CONT**;
  - Xe nâng hạ cont cũ — **ĐỔI CONT — Hạ lại**;
  - Xe nâng cấp cont mới — **ĐỔI CONT — Cấp vỏ** (cả dòng chờ).
- Dòng chi tiết bỏ tên tác nghiệp ở đầu (đã có cột). Code: `task` / `SWAP_TASK` (`dossierHistory.ts`), `TaskText` (`MasterDossierModal.tsx`).

### DEC-186 — Đổi container: Chờ cấp vỏ nhãn ĐỔI CONT; phải hạ cont cũ trước khi cấp cont mới

- Trạng thái: CONFIRMED (2026-10-29, người dùng). Bổ sung DEC-185 — trường hợp cont đã lên xe, phát sinh vấn đề phải đổi.
- Xe nâng — **Chờ cấp vỏ**: cont cấp thay mang nhãn tác nghiệp **ĐỔI CONT** (như cont chờ hạ lại ở Chờ hạ vỏ).
- **Bắt buộc Xe nâng xác nhận HẠ cont cần đổi** ở Chờ hạ vỏ trước. Chưa hạ thì **không cấp được** cont mới:
  - thông báo "Phải HẠ container … (đổi cont) ở Xe nâng — Chờ hạ vỏ trước khi cấp …";
  - danh sách ghi "CHỜ HẠ CONT CŨ TRƯỚC";
  - khung quét hiện cảnh báo đỏ;
  - hồ sơ ĐANG CHỜ ghi "Chờ xe nâng hạ … rồi cấp vỏ …".
- Code: `swapPlacementBlocker` (`depotOperations.ts`, kiểm trong `executeGateOut`). Database: migration `20261112000001_gate_out_swap_placement.sql` (`execute_gate_out` thêm bước kiểm tra), pgTAP `0015` (27 kiểm tra).

### DEC-185 — ĐỔI CONTAINER khi chờ trả chứng từ cấp vỏ

- Trạng thái: CONFIRMED (2026-10-29, người dùng — yêu cầu + trả lời câu hỏi). Giải quyết một phần Q-012 (đổi cont sau khi đã thu phí, cùng hãng / size / type → không cần hoàn tiền).
- **Khi nào:** cont đã cấp ra (Xe nâng OUT), đang ở **Văn phòng → Trả chứng từ → Đang chờ TRẢ CHỨNG TỪ CẤP VỎ**. Nút **ĐỔI CONTAINER** (Văn phòng / Quản lý — quyền RELEASE_ORDER).
- **Bắt buộc chọn 1 trong 2 lý do:**
  1. **Khách kén vỏ, yêu cầu đổi cont khác:**
     - Xe nâng nhận yêu cầu **hạ lại**, đủ thông tin đổi container + lý do.
     - Xe nâng **chọn vị trí mới**.
     - Hạ xong cont tồn bãi, **cấp được cho khách khác**.
  2. **Container phát sinh hư hỏng, không đủ điều kiện cấp khách:**
     - Cùng quy trình trên; cont chuyển **DAMAGE**, mang nhãn **PHÁT SINH CẤP VỎ**.
     - Xe nâng được nhắc "HẠ KHU SỬA CHỮA" (không chặn block — người dùng chọn Xe nâng tự chọn).
     - Hạ xong → **Chờ báo giá** → cập nhật tình trạng, giờ công → Sửa chữa như luồng thường. Nhãn giữ cho cả lượt lưu bãi.
     - Ghi chú hư hỏng **không bắt buộc**.
- **Cont thay thế chọn ngay** trong cửa sổ Đổi container:
  - danh sách cont sẵn sàng **cùng hãng tàu / size / type** với booking (`swapCandidates`), đủ điều kiện cấp vỏ;
  - khác size / type thì không đổi được (chênh phí → OPEN-008).
- **Giữ nguyên mã CV-, chứng từ, phiếu thu, QR phiếu K80** (người dùng chọn):
  - lệnh chuyển sang cont mới, quay về Xe nâng — Chờ cấp vỏ;
  - lái xe dùng luôn phiếu đang cầm (quét `QR-CV-…` ra cont mới);
  - Trả chứng từ in đúng cont mới; không thu thêm, không hoàn tiền.
- **Ngày hạ gốc giữ nguyên**: cont cũ quay lại cùng hồ sơ HV-, Date in / lưu bãi tính tiếp.
- **Lịch sử hồ sơ:**
  - cont cũ có dòng Văn phòng — Đổi container (SỬA, lý do → cont mới) + Xe nâng — Hạ lại (đổi container);
  - cont mới có dòng Văn phòng — Đổi container (TẠO MỚI, cấp thay cont cũ);
  - ĐANG CHỜ: "Chờ xe nâng hạ lại".
- **Xe nâng — Chờ hạ vỏ:**
  - nhãn tác nghiệp **ĐỔI CONT**;
  - khung quét hiện "ĐỔI CONTAINER — HẠ LẠI, CHỌN VỊ TRÍ MỚI" hoặc "— HẠ KHU SỬA CHỮA" + lý do;
  - lịch sử vị trí loại mới **Hạ lại (đổi container)** (`SWAP_RETURN`).
- Code:
  - `swapGateOutContainer`, `swapCandidates`, `canSwapGateOut`, `placeSwapReturn` (`depotOperations.ts`);
  - `SwapContainerModal.tsx`.
- Database: migration `20261111000001_gate_out_swap.sql`:
  - RPC `swap_gate_out_container`; `update_container_location` thêm nhánh hạ lại;
  - cột `containers.swap_return` / `release_damage`, `gate_out_orders.swaps`; enum `SWAP_RETURN`;
  - pgTAP `0015`.

### DEC-184 — Lịch sử hồ sơ: cột BỘ PHẬN; ĐANG CHỜ mỗi việc 1 dòng

- Trạng thái: CONFIRMED (2026-10-29, người dùng). Sửa DEC-181 / DEC-183.
- Cột **TÁC NGHIỆP đổi thành BỘ PHẬN**, chỉ ghi tên bộ phận làm việc đó: Giám định / Văn phòng / Vệ sinh / Xe nâng / Báo giá / Sửa chữa.
  - Thanh toán, GATE IN OK, trả chứng từ, lập / duyệt danh sách tàu, cấp vỏ, hủy lệnh → **Văn phòng**.
  - Tên tác nghiệp cụ thể (VD "Xe nâng — Đảo chuyển", "Thanh toán — Hạ vỏ") ghi ở đầu dòng chi tiết và khi rê chuột vào ô bộ phận.
- **ĐANG CHỜ**: mỗi việc chờ là **1 dòng riêng** cuối bảng — icon đồng hồ (nhấp nháy) | bộ phận phụ trách | nhãn ĐANG CHỜ | nội dung chờ.
- Code: `dept` / `DossierPending` trong `src/services/dossierHistory.ts`.

### DEC-183 — Lịch sử hồ sơ: mỗi tác nghiệp 1 dòng, chi tiết ẩn (nút mắt)

- Trạng thái: CONFIRMED (2026-10-29, người dùng). Bổ sung DEC-181.
- Bảng LỊCH SỬ HỒ SƠ: **mỗi tác nghiệp đúng 1 dòng** (không xuống dòng).
- Cột CHI TIẾT **luôn ở trạng thái ẩn** (icon mắt gạch). Bấm mắt → mở dòng chi tiết ngay bên dưới (nội dung, vị trí, link phiếu thu, ảnh); bấm lại để ẩn.
- Nút **MỞ TOÀN BỘ CHI TIẾT** / **ẨN TOÀN BỘ CHI TIẾT** cạnh tiêu đề "Lịch sử hồ sơ".
- Ảnh cửa cont (DEC-182) trong hồ sơ hiện ngay khi mở chi tiết dòng Giám định (không cần bấm XEM ẢNH). Mở hồ sơ chưa mở chi tiết thì không tải ảnh nào.
- Bản in A4 / PDF HỒ SƠ CONTAINER luôn in **đủ chi tiết** (không có nút mắt).
- Code: `HistoryTable` trong `MasterDossierModal.tsx`.

### DEC-182 — Ảnh cửa cont Giám định hiện luôn, không cần bấm XEM ẢNH

- Trạng thái: CONFIRMED (2026-10-29, người dùng). **Sửa DEC-178** cho riêng ảnh cửa cont.
- Ảnh cửa container do Giám định chụp (1 ảnh) **hiện ngay** khi mở:
  - Hồ sơ container — dòng Giám định — Hạ vỏ / Nhập tàu;
  - chi tiết hồ sơ ở Giám định – Hạ vỏ;
  - chi tiết Văn phòng – Hạ vỏ.
- Không còn nút XEM ẢNH ở các chỗ này (`PhotoGallery autoShow`).
- Giữ nút **XEM ẢNH (n)** cho:
  - ảnh hoàn thành sửa chữa (1–30 ảnh);
  - cột ảnh trong danh sách báo cáo nhiều dòng (Báo cáo Giám định — Chi tiết) — mở danh sách không tải hàng loạt ảnh (DEC-178).

### DEC-181 — Hồ sơ container: LỊCH SỬ HỒ SƠ dạng bảng

- Trạng thái: CONFIRMED (2026-10-29, người dùng — yêu cầu + trả lời câu hỏi). **Sửa DEC-058** phần thân hồ sơ (bỏ các khối bộ phận có ô ✓ HOÀN THÀNH bên phải; Thanh toán không còn là khối riêng mà là 1 dòng lịch sử).
- **Đầu trang giữ nguyên** thông tin cơ bản container (DEC-058): số cont chữ lớn, mã HV- / NT- / CV- / XT-, trạng thái, khóa, size / type, hãng tàu, trạng thái • đóng hàng, AGE, vị trí, khách hàng / tàu, vệ sinh, gate in; ghi chú văn phòng.
- Bên dưới là bảng **LỊCH SỬ HỒ SƠ**: **THỜI GIAN | TÁC NGHIỆP | NỘI DUNG | CHI TIẾT | NHÂN VIÊN**.
  - NỘI DUNG: **TẠO MỚI / SỬA / XÓA**.
  - Sắp **cũ trên, mới dưới**.
- **Nguồn dữ liệu (người dùng chọn): dựng từ dữ liệu tác nghiệp**, không đọc nhật ký audit, không cần migration. Hàm `resolveDossier` / `dossierHistory` (`src/services/dossierHistory.ts`); giao diện chỉ hiển thị.
  - TẠO MỚI: Giám định, Văn phòng, Thanh toán (có link phiếu thu), GATE IN OK, Vệ sinh, Xe nâng hạ vỏ / hạ kệ, Báo giá (cập nhật + xác nhận), Sửa chữa (ảnh XEM ẢNH — DEC-178), trả chứng từ, lập / duyệt danh sách tàu, cấp vỏ, xuất tàu.
  - SỬA: giám định trên kệ (W-SURVEY → kết quả), đảo chuyển / cập nhật vị trí (vị trí cũ → mới), ghi chú văn phòng, khóa container.
  - XÓA: hủy lệnh cấp, đóng báo giá / sửa chữa khi cấp vỏ DAMAGE.
  - Giới hạn đã biết: chỉ ghi được những gì dữ liệu tác nghiệp có lưu thời gian. Văn phòng sửa thông tin hạ vỏ, sửa vị trí hành chính (CR-02), mở khóa và hủy chứng từ chưa lưu giờ / người → không có dòng. Ghi chú / khóa chỉ có lần gần nhất. Muốn đủ cần đọc nhật ký audit — phải thêm migration và mở quyền đọc (hiện chỉ Quản lý / Admin).
- Việc chưa làm (chờ Văn phòng, chờ thanh toán / chuyển khoản, chờ vệ sinh, chờ xe nâng, chờ báo giá, chờ sửa chữa, chờ trả chứng từ, chờ duyệt tàu…) gom vào **1 dòng ĐANG CHỜ** nền vàng cuối bảng.
- Bản in A4 HỒ SƠ CONTAINER (DEC-161) dùng cùng bảng; không cắt đôi dòng khi sang trang.

### DEC-180 — Menu Báo cáo chỉ có bộ phận; báo cáo con là tab trong trang bộ phận

- Trạng thái: CONFIRMED (2026-10-29, người dùng). **Sửa DEC-179** phần menu.
- Menu **Báo cáo** chỉ còn 5 mục bộ phận: **Giám định, Văn phòng, Vệ sinh, Xe nâng, Sửa chữa** (+ **Góp ý** chỉ Admin thấy). Không hiện báo cáo con trên thanh menu.
- Bấm bộ phận → trang báo cáo của bộ phận (`DepartmentReportPage` trong `ReportsWorkspace.tsx`), báo cáo con là **tab**:
  - Giám định: CHI TIẾT · Văn phòng: HẠ VỎ, CẤP VỎ, XUẤT VỎ, NHẬP VỎ, **TỔNG HỢP** (chuyển từ menu vào Văn phòng) · Vệ sinh: CHI TIẾT · Xe nâng: CHI TIẾT · Sửa chữa: CHI TIẾT, SẢN LƯỢNG SỬA CHỮA.
- Quyền: mục bộ phận `BC_BP_*` trong `MENU_ACCESS`; tab chỉ hiện khi xem được báo cáo đó (mã báo cáo DEC-179 — VD Tổng hợp chỉ Văn phòng / Quản lý).

### DEC-179 — Báo cáo tách theo bộ phận; bộ phận xem báo cáo của mình

- Trạng thái: CONFIRMED (2026-10-29, người dùng — yêu cầu + trả lời câu hỏi).
- Menu **Báo cáo** chia theo bộ phận (**DEC-180:** menu chỉ còn bộ phận, báo cáo con thành tab trong trang bộ phận):
  - **Giám định** → Chi tiết (mới): mọi lượt giám định Hạ vỏ + Nhập tàu — Mã hồ sơ | Số cont | Size | Type | Hãng tàu | Tác nghiệp | Trạng thái | Ghi chú hư hỏng | Đóng hàng | AGE | Giám định | Thời gian | Ảnh (bấm XEM ẢNH). Lọc thời gian giám định, số cont, hãng tàu, tác nghiệp, trạng thái.
  - **Văn phòng** → Hạ vỏ, Cấp vỏ, **Xuất vỏ** (= Xuất tàu, DEC-040), **Nhập vỏ** (= Nhập tàu).
  - **Vệ sinh** → Chi tiết (mới): phiếu vệ sinh — Mã hồ sơ | Số cont | Size | Type | Hãng tàu | Tác nghiệp | Hạng mục vệ sinh | Trạng thái | Người làm | Hoàn tất lúc. Lọc thời gian (hoàn tất, chưa xong thì lúc tạo), số cont, hãng tàu, trạng thái.
  - **Xe nâng** → Chi tiết (mới): lịch sử vị trí — Mã hồ sơ | Số cont | Size | Type | Hãng tàu | Loại (Hạ bãi / Đảo chuyển / Lấy ra cấp vỏ – xuất tàu / Cập nhật vị trí) | Vị trí cũ | Vị trí mới | Người lái | Thời gian | Ghi chú. Lọc thời gian, số cont, loại (lịch sử vị trí không nối được bảng container trong database → không lọc hãng tàu, cột hãng vẫn hiện).
  - **Sửa chữa** → Chi tiết, Sản lượng sửa chữa (trước là 2 tab của 1 mục).
  - **Tổng hợp** (Văn phòng / Quản lý) và **Góp ý** (Admin) giữ riêng ở cuối.
- **Quyền** (`MENU_ACCESS`): bộ phận nào xem báo cáo của bộ phận đó (Giám định / Vệ sinh / Xe nâng / Sửa chữa); Văn phòng / Quản lý (+ Admin) xem tất cả. Sửa chữa xem được Sản lượng (gồm lương sản phẩm của cả bộ phận).
- Cả 3 báo cáo mới phân trang ở database như DEC-178 bước 4b (`usePagedReport`, Excel theo đợt, tối đa 1 năm / lần); migration `20261110000001_department_reports.sql` (chỉ mục `gate_in_orders.field_at`, `location_history.performed_at` / `action`).

### DEC-178 — Dữ liệu lớn: RLS 1 lần / truy vấn, tải theo nhu cầu, báo cáo tính ở database

- Trạng thái: CONFIRMED (2026-10-29, người dùng — sau thử tải 200.000 lượt vào – ra + 200.000 lượt sửa chữa, 2.000 cont tồn trên Supabase local).
- **Lỗi phát hiện:** đăng nhập → "canceling statement due to statement timeout". RLS `using (public.is_active_staff())` gọi hàm cho từng dòng. **Đã sửa:** migration `20261108000001_rls_initplan_indexes.sql` bọc `(select …)` cho mọi policy `public` (quyền không đổi) + chỉ mục cho cột lọc khi mở app; pgTAP `0012_rls_initplan.test.sql` (chặn policy mới quên bọc). Giữ giới hạn 8 giây của database làm "chuông báo" truy vấn chậm.
- **Nguyên tắc tải dữ liệu** (làm dần, đo bằng `tests/load.local.test.ts`):
  - Mở app chỉ tải **chữ** của Tồn vỏ + việc đang chờ; chỉ lấy cột màn hình cần; tải theo vai trò (hiện trường chỉ hàng chờ của mình).
  - **Bỏ tải sẵn lịch sử 7 ngày.** Màn hiện trường **không cần** xem việc đã xong gần đây — cần thì tìm số cont ở Tồn vỏ / tra cứu → mở hồ sơ. (Tab Đã xong / Tất cả của màn tàu thuộc danh sách tàu đang mở — giữ.)
  - Hồ sơ container tải khi bấm mở.
  - **Ảnh chỉ lưu đường dẫn**; mở app **và mở hồ sơ** đều không tải ảnh — chỉ hiện nút **XEM ẢNH (n)**, bấm mới xin link + tải ảnh (`PhotoGallery` trong `shared.tsx`, `src/services/remote/photoLink.ts` gom link 1 lượt / kho, nhớ 50 phút). **Không làm ảnh thu nhỏ**: mỗi ảnh vẫn 1 file < 200 KB (DEC-176).
  - **Đã làm (2026-10-29):** ảnh theo yêu cầu ở Hồ sơ container (cửa Gate in + sửa chữa), chi tiết Văn phòng Hạ vỏ, chi tiết Giám định.
  - **Đã làm (2026-10-29) — mở app:** cửa sổ làm việc **7 ngày → từ 00:00 hôm nay** (`workingWindowStart`; lọc trước hôm nay → tải theo khoảng); bỏ tải trùng (đợt sau chỉ tải phần chưa có); vai trò không có RECEIPT_VIEW / PAYMENT_CONFIRM (`seesPayments`) không tải phiếu thu / giao dịch / phiếu trả trước, chứng từ chỉ của hồ sơ đang làm dở; **hồ sơ container tải đủ khi bấm mở** (`loadDossierState` + `dossierSource.ts`, ghép theo id). Chưa làm: chỉ lấy cột cần (select theo cột) — đo lại sau khi chạy thử thật.
  - **Báo cáo tính ở database** (lọc, phân trang, tổng, Excel tải theo đợt) → **bỏ giới hạn 3 tháng** (thay DEC-157 phần giới hạn).
- **Tìm số container (mọi ô tìm):** tìm theo **7 số seri** và tìm **chính xác**; khi đang gõ hiện **gợi ý các cont có seri bắt đầu bằng các số đã gõ** (VD gõ `12345` → `MSKU1234567`, `TCLU1234501`). **Đã làm (2026-10-29):** một hàm chung `matchContainerNo` (`src/services/containerSearch.ts`) cho Sửa chữa, Đảo chuyển, Cấp vỏ (chọn cont), Báo giá, Văn phòng tàu, Nhập / Xuất tàu hiện trường, Tồn vỏ và báo cáo (Hạ vỏ / Cấp vỏ / Sửa chữa / tàu); gõ chữ → so đầu số cont; bỏ kiểu "chứa chuỗi" (gõ số giữa / đuôi seri không còn khớp). Ô tìm ghi "7 số seri / số cont".
- **Kết quả đo 2026-10-29** (50.000 lượt, 2.000 cont tồn, Supabase local): mở app Admin 1,7 giây / 10,9 MB (trước 11,7 giây / 38,6 MB hoặc bị ngắt); Xe nâng 1,0 giây / 8,4 MB, 0 phiếu thu; đồng bộ 0,15 giây; mở hồ sơ 0,09 giây; tìm đúng số 14 ms, theo đầu seri 0,13 giây; Excel Hạ vỏ 3 tháng 68 giây → 0,2 giây; Sản lượng sửa chữa 3 tháng 38 giây → 0,3 giây (bỏ dò lồng nhau). **Còn nặng:** tải dữ liệu báo cáo theo khoảng (1 tháng 8 giây / 113 MB; 3 tháng 16–20 giây / 350 MB).
- **Bước 4b — đã làm (2026-10-29):** báo cáo **Hạ vỏ, Cấp vỏ, Sửa chữa (chi tiết)** phân trang ở database: migration `20261109000001_report_paging.sql` thêm cột sinh `report_at` (= thời điểm báo cáo như `reports.ts`: GATE IN OK / Giám định; OUT / lập lệnh; hoàn tất / tạo) + `container_serial` + chỉ mục; `loadReportPage` / `loadReportAll` (`loadWorking.ts`), `reportPaging.ts`, hook `usePagedReport`. Xem = database lọc + đếm + trả 1 trang (kèm container / chứng từ / giao dịch / phiếu thu của trang), dòng vẫn dựng bằng hàm trong `reports.ts`; Excel lấy theo đợt 1.000 dòng. **Bỏ giới hạn 3 tháng** cho 3 báo cáo này — mỗi lần tối đa 366 ngày (như Demo). Đo 50.000 lượt: mỗi trang 40–140 ms / ~0,2 MB với mọi khoảng; Excel Hạ vỏ 3 tháng (46.000 dòng) ~9 giây. **Sản lượng sửa chữa** lọc trước hôm nay chỉ tải phiếu sửa chữa đã xong trong khoảng + thợ + container (`loadRepairOutputState`): 3 tháng 6 giây / 104 MB (trước 17 giây / 367 MB). **Sửa lỗi số liệu (bản database):** cách tải cũ chỉ lấy phiếu sửa chữa của cont HẠ trong khoảng lọc → báo cáo Sửa chữa / Sản lượng **thiếu** phiếu sửa xong trong khoảng của cont hạ trước đó (thử: thiếu 57 / 15.002 phiếu trong 30 ngày) — nay đúng. Mở hồ sơ cũ nay tải cả giao dịch theo chứng từ (cột Thanh toán / Mã phiếu thu).
- **Còn giữ giới hạn 3 tháng / tải theo khoảng:** Phiếu thu, Sản lượng sửa chữa, Tổng hợp, báo cáo tàu, Góp ý (lượng dữ liệu nhỏ hơn hoặc lọc thường theo tháng). Làm phân trang ở database cho Phiếu thu khi cần (bộ lọc Hóa đơn / Tác nghiệp đang tính trên máy).
- Mục tiêu: mở app hiện trường < 2 giây / < 0,3 MB; Văn phòng < 4 giây / < 2 MB; báo cáo trang đầu < 2 giây; tìm số cont < 0,5 giây; mở hồ sơ < 1 giây.

### DEC-177 — Header 1 dòng: icon QUẢN TRỊ HỆ THỐNG gộp tài khoản; Góp ý cùng dòng tên màn

- Trạng thái: CONFIRMED (2026-10-29, người dùng). Mục đích: tối ưu hiển thị màn tác nghiệp mobile (Giám định, Vệ sinh, Xe nâng, Sửa chữa).
- Header mọi màn **chỉ 1 dòng**: nút menu | tên màn (VD "Giám định / Hạ vỏ", cắt "…" khi dài) | biểu tượng Mobile → bên phải: DEMO (nếu có) | **Góp ý** (điện thoại chỉ hiện icon) | icon **Quản trị hệ thống**.
- Bấm icon **Quản trị hệ thống** (`AccountMenu`, `src/components/AccountMenu.tsx`) mở danh mục: **THÔNG TIN NHÂN VIÊN** (họ tên, tên đăng nhập, vai trò) → **Tải lại** → **Đổi mật khẩu** → **Đăng xuất**. Bản Demo: ô chọn người dùng nằm trong khối Thông tin nhân viên, kèm **Xóa dữ liệu** / **Nạp dữ liệu test** (không có Đăng xuất).
- Không còn nút Tải lại / Đổi mật khẩu / Đăng xuất rời trên header. Màn mới không thêm nút tài khoản ra header — thêm vào `AccountMenu`.

### DEC-176 — Chờ sửa chữa: tìm theo số cont + CHỤP ẢNH HOÀN THÀNH SỬA CHỮA; ảnh không tự xóa

- Trạng thái: CONFIRMED (2026-10-29, người dùng — yêu cầu + trả lời câu hỏi). **Thay DEC-159** (ảnh cửa giữ 2 tháng).
- **Chờ sửa chữa không quét mã QR**: ô **Tìm theo số container** — gõ một phần số cont, danh sách chờ lọc ngay, bấm dòng để chọn (Enter khi chỉ còn 1 cont).
- Trình tự: chọn **Tổ sửa chữa** → xác nhận **Nhân viên thực hiện** → **CHỤP ẢNH HOÀN THÀNH SỬA CHỮA** → Xác nhận hoàn tất. **Tối thiểu 1, tối đa 30 ảnh / cont** (kiểm ở `completeRepairTask` + RPC `complete_repair_with_photos`).
- Màn chụp theo bố cục Camera iPhone (`src/components/PhotoCamera.tsx`): chụp liên tục (nén chạy ngầm, không chặn nút chụp), ống kính **.5 / 1× / 2× / 3×** + chụm 2 ngón, **đèn** (đèn liên tục — trình duyệt không điều khiển được đèn nháy lúc chụp), đếm n/30, ảnh vừa chụp góc trái, Xong góc phải. Máy không cho trình duyệt dùng camera → nút "Dùng camera của máy". Zoom xa .5 chỉ có khi máy / trình duyệt đưa ra camera góc siêu rộng hoặc zoom < 1 — không có thì ẩn nút.
- **Mỗi ảnh < 200 KB**: nén trên máy (`compressToJpeg`, cạnh dài ≤ 1600 px, hạ chất lượng / kích thước tới khi < 200 KB); kho `repair-photos` chặn file ≥ 200 KB. Áp dụng cả ảnh cửa Gate in.
- **Thư mục ảnh** (Supabase không nhận chữ có dấu trong đường dẫn → viết không dấu): ảnh sửa chữa `repair-photos/ANH-SUA-CHUA/<năm>/<tháng>/<ngày>/<mã tổ>/<số cont>/<số cont>-<giờphútgiây>-<n>.jpg`; ảnh Gate in `door-photos/ANH-GATE-IN/<năm>/<tháng>/<ngày>/<mã hồ sơ>-….jpg` (ảnh cũ giữ đường dẫn cũ).
- **Ảnh không tự xóa** (cả Gate in và Sửa chữa): `expired_photo_paths()` trả rỗng → Edge Function `purge-expired-photos` không xóa gì. **Quản trị tải về backup rồi tự xóa** trên Supabase.
- Lưu nhanh: bấm Xác nhận → màn đổi ngay (DEC-160); ảnh tải lên ngầm song song 4 ảnh / lượt, xong mới gọi RPC (hoàn tất + gắn ảnh trong 1 giao dịch). Hồ sơ container — bước Sửa chữa hiện ảnh (bấm phóng to).
- Database: migration `20261107000001_repair_photos.sql` (bucket `repair-photos`, `work_orders.photo_paths`, RPC `complete_repair_with_photos` gọi lại `complete_repair_task` — không sửa hàm cũ); pgTAP `0011_repair_photos.test.sql`; test chạy thật `tests/remote.repair.local.test.ts`. Đã chạy thử Supabase local 2026-10-29: pgTAP **231/231**, chạy thật 5/5.

### DEC-175 — Báo cáo SẢN LƯỢNG SỬA CHỮA: VƯỢT GIỜ

- Trạng thái: CONFIRMED (2026-10-29, người dùng). **Sửa DEC-174** phần Tổng tiền sản phẩm.
- Thêm 3 cột (giữ đúng chữ người dùng gửi), đặt giữa **Nhân công bậc thợ (đ / giờ)** và **Tổng tiền sản phẩm (VND)**:
  - **LƯƠNG SẢN PHẨM** = Tổng tiền sản phẩm cũ (tổng giờ chia × đơn giá bậc thợ đã chốt từng cont — DEC-174).
  - **GIỜ VƯỢT GIỜ** = giờ công của nhân viên **trong khoảng đang lọc** trên mốc (ban đầu **200 giờ**) → phần vượt; đúng bằng mốc = 0.
  - **SẢN PHẨM VƯỢT GIỜ** = đơn giá vượt giờ (ban đầu **3.000 đ / giờ**) × GIỜ VƯỢT GIỜ.
  - **TỔNG TIỀN SẢN PHẨM (VND)** = LƯƠNG SẢN PHẨM + SẢN PHẨM VƯỢT GIỜ.
- Người dùng chọn (trả lời câu hỏi): mốc tính **theo khoảng đang lọc** (không chia theo tháng); mốc + đơn giá **Admin sửa ở Danh mục chung → Sửa chữa → BẬC THỢ** (khối **Vượt giờ**), dùng giá trị hiện tại khi xem báo cáo (không chốt theo kỳ).
- Tính theo từng dòng báo cáo (tổ + nhân viên). Nhân viên chưa có bậc thợ vẫn tính sản phẩm vượt giờ. Cửa sổ chi tiết + sheet Excel CHI TIẾT (từng cont) ghi **Lương sản phẩm**; vượt giờ chỉ ở bảng / sheet tổng hợp.
- Code: `updateRepairOvertime` (`depotOperations.ts`), `queryRepairOutput` / `repairOutputSheets` (`reports.ts`). Database: migration `20261106000001_repair_overtime.sql` (bảng 1 dòng `repair_overtime_settings`, RPC `catalog_update_repair_overtime`); pgTAP `0010_repair_overtime.test.sql`.

### DEC-174 — Đơn giá bậc thợ CHỐT lúc sửa xong (đơn giá cũ tính theo giá cũ)

- Trạng thái: CONFIRMED (2026-10-28, người dùng). **Sửa DEC-173** phần Thành tiền.
- Hoàn tất sửa chữa → lưu **bậc thợ + đơn giá (đ / giờ)** của từng nhân viên vào cont đó (`ServiceWorkOrder.repairMemberRates`; database: `work_order_members.grade_name / hourly_rate`, trigger `work_order_member_rate` tự điền — không sửa `complete_repair_task`).
- Báo cáo Sản lượng: Thành tiền = tổng (giờ chia × **đơn giá đã chốt** của từng cont). Đổi đơn giá bậc thợ sau đó **không** đổi kỳ cũ. Cont sửa **trước khi có bậc thợ** (chưa chốt) → lấy đơn giá hiện tại. Nhân viên có nhiều mức trong kỳ → cột đơn giá ghi "Nhiều mức", bậc ghi "Nhiều bậc"; chi tiết từng cont ở cửa sổ trượt + Excel sheet CHI TIẾT.
- **Tên cột (người dùng chốt, giữ nguyên chữ):** **Bậc thợ** / **Nhân công bậc thợ (đ / giờ)** / **Tổng tiền sản phẩm (VND)** = Nhân công bậc thợ × Giờ công. Excel: BẬC THỢ / NHÂN CÔNG BẬC THỢ (Đ/GIỜ) / TỔNG TIỀN SẢN PHẨM (VND).
- Đã chạy thử Supabase local 2026-10-28: migration `20261105000001` áp dụng OK, pgTAP **213/213**, test chạy thật N1–N6 pass, trigger chốt giá thử bằng SQL (50.000 → đổi 80.000, dòng cũ giữ 50.000).

### DEC-173 — Danh mục SỬA CHỮA: nhân viên, tổ theo số lượng, BẬC THỢ

- Trạng thái: CONFIRMED (2026-10-28, người dùng). **Sửa DEC-048** (bỏ thêm nhân viên gõ tên tay).
- Danh mục chung → Sửa chữa có 3 tab: **NHÂN VIÊN SỬA CHỮA** / **TỔ SỬA CHỮA** / **BẬC THỢ**.
- **Danh sách nhân viên sửa chữa** = user có vai trò Sửa chữa. Admin bắt buộc cấu hình 3 mục: (1) **Tổ sửa chữa**, (2) **Bậc thợ**, (3) **Giờ công bậc thợ** — **tự lấy theo bậc**, không sửa riêng. Thiếu → dòng ghi "Thiếu cấu hình". Mỗi nhân viên thuộc đúng 1 tổ; đổi tổ → ngưng ở tổ cũ (giữ lịch sử).
- **Tạo tổ theo số lượng**: nhập N → tạo TỔ SỬA CHỮA n (mã TO-SC-0n), đánh số tiếp, bỏ mã đã có.
- **Bậc thợ**: tên + **giờ công bậc thợ = đơn giá tiền / 1 giờ** (> 0). Sửa đơn giá = đổi cho mọi nhân viên cùng bậc. Ngưng thay vì xóa.
- Báo cáo SẢN LƯỢNG SỬA CHỮA (DEC-170) thêm cột **Bậc thợ**, **Giờ công bậc thợ (đ / giờ)**, **Thành tiền = giờ công chia × đơn giá** (theo bậc **hiện tại** của nhân viên — đổi đơn giá thì báo cáo kỳ cũ tính lại theo giá mới).
- Database: migration `20261105000001_repair_grades.sql` (bảng `repair_grades`, cột `repair_team_members.grade_id`, RPC `catalog_upsert_repair_grade`, `catalog_assign_repair_staff`); pgTAP `0009_repair_grades.test.sql`.

### DEC-166 — Danh mục PHÂN LOẠI ĐÓNG HÀNG theo hãng tàu + hãng tàu ƯU TIÊN

- Trạng thái: CONFIRMED (2026-10-28, người dùng — trả lời câu hỏi). **Thay** bộ cố định M / K / E (DEC-016, DEC-128 giữ nguyên chỗ hiển thị).
- Danh mục chung → **Phân loại đóng hàng** (menu `DM_PHAN_LOAI`): **mỗi hãng tàu 1 bộ mã riêng** (mã 1–5 chữ / số + mô tả). Chỉ Admin thêm / ngừng dùng / mở lại — **không xóa cứng** (hồ sơ cũ còn dùng mã). Văn phòng / Quản lý xem.
- Hãng **không có mã nào đang dùng** → Giám định **ẩn hẳn** mục Đóng hàng, lưu trống; Tồn vỏ / báo cáo / phiếu hiện "-".
- **Giám định Hạ vỏ chọn HÃNG TÀU trước** (ô sổ xuống chọn 1, **mặc định hãng ƯU TIÊN**) → hiện đúng bộ mã của hãng. Văn phòng chốt hãng khác thì phân loại được kiểm lại; hãng mới không có mã cũ → Văn phòng chọn lại; hãng mới không dùng → xóa phân loại. W-SURVEY: bổ sung trên kệ theo hãng của cont.
- Nhập tàu: theo hãng của danh sách tàu.
- **Hãng tàu ƯU TIÊN**: Danh mục → Hãng tàu có ô tích "Ưu tiên", **tối đa 1 hãng** (tích hãng khác → hãng cũ tự bỏ).
- Dữ liệu cũ / database hiện có: tạo sẵn M / K / E cho **mọi hãng tàu đang có** (giữ hành vi cũ). Hãng thêm mới **không** tự có mã — Admin thêm nếu hãng dùng.
- Nghiệp vụ: `src/services/stuffing.ts` (`stuffingOptions`, `resolveStuffing`, `priorityShippingLine`), `addStuffingClassCatalogItem` / `setStuffingClassActive` / `setShippingLinePriority`. Database: migration `20261104000001_stuffing_catalog.sql` (bảng `stuffing_classes`, `resolve_stuffing`, cột `partners.is_priority`, bỏ enum `stuffing_class`).

### DEC-165 — Văn phòng DANH SÁCH NHẬP / XUẤT TÀU dạng bảng + Báo cáo tàu 2 chế độ xem

- Trạng thái: CONFIRMED (2026-10-28, người dùng).
- Văn phòng → Nhập tàu / Xuất tàu: khối "Đã duyệt gần đây" đổi thành **DANH SÁCH NHẬP TÀU / XUẤT TÀU** dạng bảng (DEC-164): TÊN TÀU / HÃNG TÀU / SỐ LƯỢNG / THỜI GIAN BẮT ĐẦU / TIẾN ĐỘ / TRẠNG THÁI / NGƯỜI TẠO / NGƯỜI DUYỆT; gồm **mọi danh sách** (mới nhất trước, phân trang); bấm dòng mở chi tiết.
- Trạng thái (`vesselListStatusLabel`): ĐANG THỰC HIỆN / ĐÃ DUYỆT / DUYỆT THIẾU (duyệt khi còn cont không kịp — DEC-131). Tiến độ trong bảng 1 dòng (`VesselProgressInline`).
- Báo cáo Nhập tàu / Xuất tàu: 2 chế độ **CHI TIẾT** (từng cont, như cũ) / **TÊN TÀU** (mỗi tàu 1 dòng: số lượng, 20' / 40'+, đã xong, chờ, không kịp, trạng thái, người tạo / duyệt — `queryVesselSummaryReport`); cùng bộ lọc; Excel theo chế độ đang xem (`vesselSummarySheet`).

### DEC-164 — Chiều cao dòng bảng danh sách đồng bộ, mốc = Tồn vỏ

- Trạng thái: CONFIRMED (2026-10-29, người dùng — màn Chờ báo giá dòng cao hơn các màn khác).
- Mọi bảng danh sách / báo cáo / tra cứu / danh mục dùng **cùng chiều cao dòng = Tồn vỏ (40px)**, kể cả dòng có nút tác nghiệp, ô nhập, ô chọn.
- Cách làm: class **`data-table`** trên `<table>`; CSS chung (`src/index.css`) đặt chiều cao ô 40px, đệm 6px, căn giữa dọc; nút / ô trong bảng thu gọn (chữ 12px, đệm 2px, bỏ `min-h-10` của `primaryBtn` / `secondaryBtn`). Dòng thông báo trống (`colSpan`) không bị ép.
- Bảng **không** phải danh sách (bảng phí trên phiếu in, bảng con trong hồ sơ, ô Chi phí, bảng con trong một ô) không dùng class này.
- Test `DEC-164` (`tests/ui-smoke.test.tsx`) chặn `<table>` mới thiếu `data-table`. Đã đo bằng Edge: Tồn vỏ 40px, Chờ báo giá 53 → 40px.

### DEC-039 — Giả lập ngân hàng ở chế độ Demo

- Trạng thái: CONFIRMED (2026-10-22)
- Quyết định: Khi chưa cấu hình Supabase / API ngân hàng, cho phép nút "Giả lập ngân hàng báo có (DEMO)" cho Văn phòng / Kế toán / Quản lý. Nút đi qua đúng cơ chế xử lý kết quả ngân hàng (chống trùng theo mã giao dịch) và tự ẩn khi cấu hình Supabase.

## 3. Quyết định kỹ thuật đã xác nhận

### DEC-010 — Database

- Trạng thái: CONFIRMED
- Quyết định: PostgreSQL trên Supabase, kèm chế độ Local/Demo dự phòng khi chưa cấu hình biến môi trường `.env` để hỗ trợ chạy và kiểm thử trực tiếp.

### DEC-011 — Frontend

- Trạng thái: CONFIRMED
- Quyết định: React, TypeScript, Vite và Tailwind CSS.

### DEC-012 — Giao diện

- Trạng thái: CONFIRMED
- Quyết định: Responsive web app hỗ trợ cả máy tính (Văn phòng/Kế toán/Quản lý) và điện thoại/tablet (Cổng/Hiện trường/Xe nâng/Vệ sinh/Giám định/M&R).
- Bổ sung 2026-10-22: các mục menu tác nghiệp mobile (Giám định – Hạ vỏ, Vệ sinh, Xe nâng – Chờ hạ vỏ / Chờ cấp vỏ / Đảo chuyển, Sửa chữa) có biểu tượng điện thoại để phân biệt.

### DEC-013 — Quản lý thay đổi database

- Trạng thái: CONFIRMED
- Quyết định: Sử dụng SQL migration trong `supabase/migrations/` được quản lý bằng Git.

## 4. Các quyết định còn mở

### OPEN-001 — Danh mục loại Gate In bổ sung và chi tiết nghiệp vụ NHẬP TÀU

- Trạng thái: OPEN
- Đã xác nhận: Khách hàng trả container rỗng theo lệnh hãng tàu và `NHẬP TÀU` (module riêng xây dựng sau). **Quy trình NHẬP TÀU đã chốt ở DEC-069 (2026-10-24).**
- Cần xác nhận: Còn loại tiếp nhận nào khác cần hỗ trợ trong giai đoạn đầu không và quy trình chi tiết của module `NHẬP TÀU` khi triển khai.

### OPEN-002 — Mô hình vị trí bãi chi tiết

- Trạng thái: OPEN
- Đã xác nhận: Cho phép ghi nhận vị trí ở cấp `Block` (không độc quyền cho một container) khi chưa có `Bay/Row/Tier` và cập nhật chi tiết sau.
- Cần xác nhận: Danh mục tên `Block`, quy tắc mã hóa `Bay/Row/Tier`, sức chứa thực tế và ràng buộc vị trí chi tiết.

### OPEN-003 — Trạng thái nghiệp vụ và luồng chuyển tiếp sau GATE IN OK

- Trạng thái: OPEN (một phần đã giải quyết)
- Đã xác nhận: Trạng thái `GATE IN OK` chỉ được cập nhật sau khi thanh toán thành công; các phân loại hiện trường; bộ phận tiếp theo sau `GATE IN OK` (DEC-024); trạng thái thanh toán (DEC-031).
- Cần xác nhận: Danh mục trạng thái đầy đủ và chính thức của container, booking, vệ sinh, sửa chữa để chốt schema database.

### OPEN-004 — Phân quyền

- Trạng thái: OPEN (một phần đã giải quyết)
- Đã xác nhận: 8 vai trò (DEC-045, DEC-047, DEC-049); quyền hoàn tất từng bộ phận (DEC-035); khóa container (DEC-030); Văn phòng / Quản lý xác nhận thanh toán, Văn phòng làm phiếu thu TTT (DEC-047); menu theo vai trò (DEC-045).
- Cần xác nhận: ai được hủy Hạ vỏ / Cấp vỏ đã hoàn tất; Quản lý có được làm thay Báo giá / Sửa chữa không.

### OPEN-007 — Hãng tàu duyệt báo giá (ĐÃ GIẢI QUYẾT — DEC-040)

- Trạng thái: OPEN
- Cần xác nhận: Có cần bước hãng tàu / chủ vỏ duyệt báo giá trước khi Sửa chữa thực hiện không? Hiện tại báo giá xong chuyển sửa ngay.

### OPEN-009 — Vai trò Kế toán và QC Sửa chữa (ĐÃ GIẢI QUYẾT — DEC-047)

- Trạng thái: OPEN
- Cần xác nhận: (1) Danh sách vai trò mới không có KẾ TOÁN — ai tạo phiếu thu TTT và xác nhận tiền mặt (hiện là Kế toán)? Gộp vào Văn phòng hay giữ Kế toán? (2) QC SỬA CHỮA làm gì trong quy trình (nghiệm thu sau sửa? có được trả lại sửa lại?) và vào màn nào? (3) Bỏ hẳn GATE_STAFF / YARD_STAFF?

### OPEN-009 — EDI hãng tàu MAERSK (CODECO)

- Trạng thái: OPEN (2026-10-30) — đang thu thập dữ liệu từ app cũ ERPVINASHIP.
- Mục tiêu: tự gửi CODECO gate-in / gate-out (Hạ vỏ, Cấp vỏ — kể cả Release for sale, Xuất tàu…) cho Maersk mỗi giờ, qua SFTP hoặc Gmail; màn theo dõi + cảnh báo.
- Phân tích file mẫu + thiết kế đề xuất: `docs/EDI_MAERSK.md`. Cần trả lời Q-046 → Q-055 trước khi chốt DEC và viết code.

### OPEN-008 — Hủy lệnh cấp đã thanh toán / hoàn tiền

- Trạng thái: OPEN
- Cần xác nhận: Quy trình hoàn tiền (TTTT), hoàn lại số dư Phiếu thu mẹ (TTT) hoặc hủy công nợ (TTS) khi hủy lệnh cấp hoặc hủy Hạ vỏ đã thanh toán.

### OPEN-005 — Chính sách tài chính

- Trạng thái: OPEN
- Cần xác nhận: Biểu phí, công nợ, thời điểm thu phí, hoàn tiền và đối soát cho từng dịch vụ.

### OPEN-006 — Ngoại lệ nghiệp vụ

- Trạng thái: OPEN
- Cần xác nhận: Quy tắc hủy, sửa sai, từ chối, xử lý trùng và khôi phục sau lỗi.

## 5. Quy tắc cập nhật

- Không sửa quyết định CONFIRMED nếu chưa có xác nhận thay đổi.
- Khi quyết định thay đổi, ghi rõ quyết định cũ, quyết định mới, lý do và ngày thay đổi.
- Không chuyển PROPOSED thành CONFIRMED nếu chưa được xác nhận.
- Các thay đổi phải được đồng bộ vào tài liệu và code liên quan.
- Không coi đề xuất kỹ thuật là kiến trúc đã chốt.

## 6. Trạng thái tài liệu

- Quyết định nghiệp vụ: DEC-001 → DEC-196 đã xác nhận (cập nhật 2026-10-29).
- Quyết định kỹ thuật: DEC-010 → DEC-013 đã xác nhận.
- Các mục OPEN: OPEN-001 → OPEN-008; cần giải quyết các mục ảnh hưởng schema trước khi viết lại migration database.
