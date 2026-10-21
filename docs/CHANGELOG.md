# CHANGELOG — MATRAN DEPOT

Ghi lại những thay đổi quan trọng của tài liệu, thiết kế, database và chức năng dự án.

## [0.3.0] — 2026-10-21

### Added
- Khởi tạo cấu trúc mã nguồn ứng dụng ERP MATRAN DEPOT (`React + TypeScript + Vite + Tailwind CSS`) theo `PROJECT_STRUCTURE.md`.
- Tạo SQL migration `supabase/migrations/20261021000001_init_matran_depot_schema.sql` định nghĩa toàn bộ bảng, ràng buộc toàn vẹn, Row Level Security (RLS) và các hàm RPC nguyên tử.
- Xây dựng đầy đủ các phân hệ nghiệp vụ: Gate In (Cổng/Hiện trường & Văn phòng), Quản lý Tồn bãi & Xe nâng (cấp `Block` và chi tiết `Bay/Row/Tier`, Tạm giữ/Khóa xuất), Dịch vụ kỹ thuật (Vệ sinh, Giám định, Sửa chữa M&R), Booking & Cấp container (khóa phân bổ chống cấp trùng), Gate Out (kiểm tra 5 điều kiện bắt buộc), Tài chính & Thanh toán (`TTT` Phiếu thu mẹ + QR code trừ dần, `TTS` ghi chú chứng từ, `TTTT` Chuyển khoản API & Tiền mặt), Báo cáo & Nhật ký kiểm toán.

### Changed
- Cập nhật `DECISIONS.md` và `BUSINESS_WORKFLOWS.md` với quy tắc 3 loại thanh toán (`TTT`, `TTS`, `TTTT`), thẩm quyền xác nhận khoản thu của nhân viên tác nghiệp văn phòng, luồng chuyển tiếp sau `GATE IN OK` và xác nhận bộ công nghệ triển khai (`DEC-010` → `DEC-013`, `DEC-017`).
- Bổ sung hoàn chỉnh mục 12 trong `API_RPC_CONTRACT.md`.

## [0.2.0] — 2026-10-20

### Changed
- Cập nhật `DECISIONS.md` (`DEC-001`, `DEC-002`, `DEC-004`, `DEC-005`, `DEC-007`), bổ sung quyết định đã xác nhận (`DEC-014`, `DEC-015`, `DEC-016`) và làm rõ các mục còn mở (`OPEN-001`, `OPEN-002`, `OPEN-003`).
- Cập nhật `BUSINESS_WORKFLOWS.md` với luồng Gate In chi tiết, các hoạt động phát sinh khi lưu bãi, quy tắc vị trí cấp `Block` và chi tiết `Bay/Row/Tier`, các trường hợp ra khỏi bãi và 5 điều kiện kiểm tra trước khi xuất container.
- Cập nhật `DATABASE_CONTRACT.md` để phản ánh các trường dữ liệu Gate In đã xác nhận (nhóm hiện trường và nhóm văn phòng), trạng thái `GATE IN OK`, trạng thái tạm giữ/khóa xuất và quy tắc vị trí cấp `Block` không độc quyền.
- Cập nhật `OPEN_QUESTIONS.md` để ghi nhận các phần đã xác nhận ở `Q-001`, `Q-002`, `Q-006`, `Q-007`, `Q-014` và bổ sung `Q-030` (bộ phận tiếp theo sau `GATE IN OK`), `Q-031` (thẩm quyền tạm giữ/khóa xuất).

### Business Rules
- Phạm vi hệ thống quản lý container rỗng xuyên suốt thời gian ở bãi.
- Các trường hợp vào bãi đã xác nhận: Khách hàng trả container rỗng về bãi theo lệnh hãng tàu; và `NHẬP TÀU` (bãi tổ chức xe kéo vận chuyển số lượng lớn từ cảng về — module riêng xây dựng sau). Không tự bổ sung loại tiếp nhận khác khi chưa xác nhận.
- Các trường hợp ra khỏi bãi đã xác nhận: `CẤP VỎ` cho khách hàng/xe khách theo lệnh hãng tàu; `XUẤT TÀU` (bãi tổ chức xe kéo đưa container ra cảng); và trả container cho hãng tàu/đơn vị khác theo lệnh riêng.
- Các hoạt động phát sinh tại bãi gồm lưu bãi, giám định, vệ sinh, sửa chữa, di chuyển/đảo chuyển, tạm giữ/khóa xuất, xử lý chứng từ/lệnh hãng tàu; không mặc định mọi container đều phải thực hiện tất cả dịch vụ.
- Điều kiện trước khi xuất container: có lệnh cấp/lệnh xuất hợp lệ, không bị tạm giữ/khóa xuất, đúng số container được phép xuất, đã thanh toán phí bắt buộc, hoàn tất chứng từ và thủ tục.
- Luồng Gate In: Hiện trường chụp ảnh cửa container rõ số cont và ghi nhận Phân loại (`DAMAGE`, `AV`), Phân loại đóng hàng (`M`, `K`, `E`), Tình trạng vệ sinh (`KHÔNG VỆ SINH`, `QUÉT`, `RỬA NƯỚC`, `VỆ SINH CÔNG NGHIỆP`, `NHỔ ĐINH`, `BÓC TEM`); Văn phòng kiểm tra lệnh/chứng từ, bổ sung `SỐ CONTAINER`, `SIZE`, `TYPE`, `SỐ XE`, `ĐẠI DIỆN KHÁCH HÀNG` và tạo thanh toán; chỉ khi thanh toán thành công mới cập nhật `GATE IN OK` và chuyển tiếp cho bộ phận tiếp theo (chưa tự kết luận bộ phận tiếp theo).
- Vị trí container: Hỗ trợ ghi nhận vị trí ở cấp `Block` khi chưa có `Bay/Row/Tier` (`Block` không độc quyền cho một container); khi bổ sung vị trí chi tiết hơn thì cập nhật vị trí hiện tại và lưu lịch sử.

### Pending
- Xác nhận bộ phận tiếp theo và quy tắc điều phối sau `GATE IN OK`.
- Chốt danh mục cấu hình `Block`, `Bay/Row/Tier` và sức chứa chi tiết.
- Chốt danh mục trạng thái đầy đủ của container và từng nghiệp vụ.
- Chốt ma trận phân quyền chính thức và thẩm quyền tạm giữ/khóa xuất.
- Chốt biểu phí, chính sách thu trước/thu sau/công nợ và quy tắc xử lý ngoại lệ.

## [0.1.0] — 2026-10-20

### Added
- Tạo tài liệu đặc tả tổng thể dự án trong `MASTER_SPEC.md`.
- Xây dựng tài liệu quy trình nghiệp vụ trong `BUSINESS_WORKFLOWS.md`.
- Xây dựng ma trận vai trò và quyền dự kiến trong `ROLE_PERMISSION_MATRIX.md`.
- Xác định các nhóm dữ liệu và nguyên tắc toàn vẹn trong `DATABASE_CONTRACT.md`.
- Xác định nguyên tắc API/RPC trong `API_RPC_CONTRACT.md`.
- Xây dựng bộ kiểm thử nghiệm thu ban đầu trong `ACCEPTANCE_TESTS.md`.
- Ghi nhận các quyết định và vấn đề chưa chốt trong `DECISIONS.md`.

### Business Rules
- Phạm vi hệ thống là quản lý container rỗng.
- Phí Gate In phải được thanh toán trước khi hoàn tất Gate In.
- Phân biệt tạo giao dịch thanh toán với xác nhận thanh toán thành công.
- Mỗi container đang ở trong bãi có một vị trí hiện tại; lịch sử vị trí phải được lưu.
- Container được khóa cấp khi đã chọn và xác nhận gắn với lượt cấp cụ thể.
- Chủ container, khách yêu cầu dịch vụ, bên chịu phí và người thanh toán có thể khác nhau.

### Pending
- Chốt danh sách loại Gate In.
- Chốt mô hình vị trí bãi.
- Chốt trạng thái của container và các lượt nghiệp vụ.
- Chốt ma trận quyền chính thức.
- Chốt chính sách phí và xử lý ngoại lệ.
- Chốt công nghệ triển khai trước khi bắt đầu viết code và SQL.

## Quy tắc cập nhật

- Ghi lại những thay đổi quan trọng, không cần ghi từng dòng code nhỏ.
- Mỗi phiên bản cần có ngày cập nhật.
- Phân loại thay đổi thành `Added`, `Changed`, `Fixed`, `Removed` hoặc `Pending`.
- Không ghi một đề xuất chưa được duyệt thành quyết định chính thức.
