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

### DEC-017 — Quy tắc Booking nhiều container và phân quyền tác nghiệp

- Trạng thái: CONFIRMED
- Quyết định:
  - Một Booking / Lệnh cấp có thể cấp nhiều container (theo số lượng và kích cỡ yêu cầu); từng container được khóa phân bổ ngay khi được chọn gắn vào Booking.
  - Sử dụng 10 vai trò hệ thống (cho phép kiêm nhiệm); nhân viên tác nghiệp văn phòng (`OFFICE`) xác nhận loại khoản thu (`TTT`, `TTS`, `TTTT`); `MANAGER` và `OFFICE` được đặt/gỡ lệnh tạm giữ hoặc khóa xuất (`Hold`).

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

### DEC-013 — Quản lý thay đổi database

- Trạng thái: CONFIRMED
- Quyết định: Sử dụng SQL migration trong `supabase/migrations/` được quản lý bằng Git.

## 4. Các quyết định còn mở

### OPEN-001 — Danh mục loại Gate In bổ sung và chi tiết nghiệp vụ NHẬP TÀU

- Trạng thái: OPEN
- Đã xác nhận: Khách hàng trả container rỗng theo lệnh hãng tàu và `NHẬP TÀU` (module riêng xây dựng sau).
- Cần xác nhận: Còn loại tiếp nhận nào khác cần hỗ trợ trong giai đoạn đầu không và quy trình chi tiết của module `NHẬP TÀU` khi triển khai.

### OPEN-002 — Mô hình vị trí bãi chi tiết

- Trạng thái: OPEN
- Đã xác nhận: Cho phép ghi nhận vị trí ở cấp `Block` (không độc quyền cho một container) khi chưa có `Bay/Row/Tier` và cập nhật chi tiết sau.
- Cần xác nhận: Danh mục tên `Block`, quy tắc mã hóa `Bay/Row/Tier`, sức chứa thực tế và ràng buộc vị trí chi tiết.

### OPEN-003 — Trạng thái nghiệp vụ và luồng chuyển tiếp sau GATE IN OK

- Trạng thái: OPEN
- Đã xác nhận: Trạng thái `GATE IN OK` chỉ được cập nhật sau khi thanh toán thành công; các phân loại hiện trường (`DAMAGE`, `AV`; `M`, `K`, `E`; tình trạng vệ sinh).
- Cần xác nhận: Bộ phận tiếp theo nhận xử lý sau `GATE IN OK` được xác định theo quy tắc nào; danh mục đầy đủ các trạng thái của container, Gate In, Gate Out, booking, tạm giữ/khóa xuất, vệ sinh, giám định, sửa chữa và thanh toán.

### OPEN-004 — Phân quyền

- Trạng thái: OPEN
- Cần xác nhận: Vai trò thực tế, quyền thao tác và các bước phê duyệt.

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

- Quyết định nghiệp vụ: đã ghi nhận các nội dung xác nhận.
- Quyết định kỹ thuật: một số mục còn ở mức đề xuất.
- Các mục OPEN: cần giải quyết trước khi chốt thiết kế database.
