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

- Trạng thái: CONFIRMED (2026-10-27, người dùng). **Sửa DEC-150** (24 tháng → 2 tháng).
- Ảnh chụp cửa cont khi Gate in (Hạ vỏ) lưu 2 tháng rồi tự xóa (lịch pg_cron + Edge Function `purge-expired-photos` đã có). Hồ sơ vẫn giữ, ghi "ảnh đã hết hạn lưu".
- Sửa trực tiếp trong migration gốc (chưa apply lên database thật nào): `photo_expires_at = ngày chụp + 2 tháng`.

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

- Quyết định nghiệp vụ: DEC-001 → DEC-155 đã xác nhận (cập nhật 2026-10-26).
- Quyết định kỹ thuật: DEC-010 → DEC-013 đã xác nhận.
- Các mục OPEN: OPEN-001 → OPEN-008; cần giải quyết các mục ảnh hưởng schema trước khi viết lại migration database.
