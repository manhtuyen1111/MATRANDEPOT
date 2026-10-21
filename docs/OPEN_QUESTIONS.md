# OPEN QUESTIONS — MATRAN DEPOT

Danh sách các vấn đề nghiệp vụ cần xác nhận trước khi triển khai database và chức năng chính thức.

## 1. Gate In — Nhập container vào bãi

- [ ] Q-001: *(Đã xác nhận 2 trường hợp: Khách hàng trả rỗng theo lệnh hãng tàu; và `NHẬP TÀU` làm module riêng sau)* — Còn loại tiếp nhận nào khác cần hỗ trợ trong giai đoạn đầu không, và quy trình chi tiết của `NHẬP TÀU` như thế nào?
- [ ] Q-002: *(Đã xác nhận trường hiện trường: Phân loại `DAMAGE`/`AV`, Phân loại đóng hàng `M`/`K`/`E`, Tình trạng vệ sinh `KHÔNG VỆ SINH`/`QUÉT`/`RỬA NƯỚC`/`VỆ SINH CÔNG NGHIỆP`/`NHỔ ĐINH`/`BÓC TEM`; và trường văn phòng: `SỐ CONTAINER`, `SIZE`, `TYPE`, `SỐ XE`, `ĐẠI DIỆN KHÁCH HÀNG`)* — Danh mục giá trị chuẩn của `SIZE`, `TYPE` là gì? Trường `Tình trạng vệ sinh` chọn một hay chọn nhiều giá trị cùng lúc? Có bắt buộc ghi nhận thêm hãng tàu/chủ vỏ hoặc số lệnh ở bước văn phòng không?
- [ ] Q-003: Nhân viên hiện trường chụp ảnh cửa container có số container, sau đó xác nhận vào bãi. Cần quy định xử lý thế nào nếu ảnh không rõ hoặc nhập sai số container?
- [ ] Q-004: Thu phí trước khi hoàn tất Gate In (`GATE IN OK`). Ai được xác nhận thanh toán thủ công để chuyển sang `GATE IN OK`?
- [ ] Q-005: Nếu khách đã thanh toán nhưng Gate In bị hủy, xử lý hoàn tiền hoặc chuyển tiền thế nào?
- [ ] Q-030: Sau khi cập nhật `GATE IN OK`, bộ phận tiếp theo nhận xử lý là bộ phận nào (xe nâng, giám định, vệ sinh...) và quy tắc điều phối sang bộ phận tiếp theo dựa trên tiêu chí gì?

## 2. Vị trí và tồn bãi

- [ ] Q-006: *(Đã xác nhận có cấp `Block` và cấp chi tiết `Bay/Row/Tier`; `Block` không phải vị trí độc quyền của một container)* — Danh mục tên các `Block`, quy ước mã hóa `Bay/Row/Tier` và sức chứa tối đa của từng vị trí cụ thể như thế nào?
- [ ] Q-007: *(Đã xác nhận cho phép ghi nhận vị trí ở cấp `Block` khi chưa có `Bay/Row/Tier`)* — Trong khoảng thời gian từ lúc `GATE IN OK` đến trước khi xếp vào `Block`, trạng thái vị trí của container được ghi nhận như thế nào?
- [ ] Q-008: Ai được phép thay đổi vị trí container (cập nhật `Block` hoặc cập nhật chi tiết `Bay/Row/Tier`)?
- [ ] Q-009: Quy trình xử lý khi hệ thống và vị trí thực tế không khớp là gì?
- [ ] Q-031: Ai có thẩm quyền đặt và gỡ trạng thái tạm giữ / khóa xuất container, và cần lưu những thông tin bắt buộc nào khi khóa/mở khóa?

## 3. Booking và cấp container

- [ ] Q-010: Một booking/lệnh cấp có thể cấp nhiều container không?
- [ ] Q-011: Ai được quyền chọn container để cấp cho khách?
- [ ] Q-012: Khi đổi container đã giữ chỗ, điều kiện mở khóa container cũ là gì?
- [ ] Q-013: Nếu hai nhân viên đồng thời chọn cùng một container, hệ thống cần xử lý thế nào?

## 4. Gate Out — Xuất container khỏi bãi

- [ ] Q-014: *(Đã xác nhận 3 trường hợp xuất: `CẤP VỎ`, `XUẤT TÀU`, trả theo lệnh riêng; và 5 điều kiện kiểm tra: có lệnh hợp lệ, không bị tạm giữ/khóa xuất, đúng số container, đã thanh toán phí bắt buộc, hoàn tất chứng từ/thủ tục)* — Chi tiết các khoản phí bắt buộc và bộ chứng từ bắt buộc đối với từng trường hợp (`CẤP VỎ`, `XUẤT TÀU`, trả theo lệnh riêng) khác nhau như thế nào?
- [ ] Q-015: Có trường hợp được xuất container khi chưa thanh toán đủ (ví dụ theo diện công nợ) không?
- [ ] Q-016: Ai được phép hủy hoặc sửa một lượt Gate Out đã xác nhận?

## 5. Dịch vụ và sửa chữa

- [ ] Q-017: Quy trình vệ sinh container gồm những trạng thái nào?
- [ ] Q-018: Quy trình giám định cần lưu những thông tin nào?
- [ ] Q-019: Khi nào tạo yêu cầu sửa chữa và ai được duyệt?
- [ ] Q-020: Những ảnh nào bắt buộc phải lưu khi hoàn tất sửa chữa?

## 6. Thanh toán và đối soát

- [ ] Q-021: Các hình thức thanh toán cần hỗ trợ là gì?
- [ ] Q-022: Những dịch vụ nào thu phí trước, thu phí sau hoặc được miễn phí?
- [ ] Q-023: Cần quản lý công nợ theo khách hàng, hãng tàu hay bên chịu phí nào khác?
- [ ] Q-024: Quy trình xử lý giao dịch thanh toán trùng, thất bại hoặc hoàn tiền là gì?
- [ ] Q-025: Ai được phép xác nhận thanh toán thủ công và điều chỉnh giao dịch?

## 7. Người dùng và phân quyền

- [ ] Q-026: Những vai trò chính thức nào cần có?
- [ ] Q-027: Nhân viên có thể kiêm nhiều vai trò không?
- [ ] Q-028: Ai được tạo tài khoản và cấp quyền?
- [ ] Q-029: Những thao tác nào bắt buộc lưu nhật ký kiểm toán?

## 8. Quy tắc quản lý câu hỏi

- Chỉ đánh dấu hoàn thành sau khi nghiệp vụ được xác nhận.
- Câu trả lời đã xác nhận phải được cập nhật vào `DECISIONS.md`.
- Nếu câu trả lời làm thay đổi tài liệu khác, phải cập nhật tài liệu liên quan.
- Không tự suy đoán quy tắc nghiệp vụ để bắt đầu viết SQL hoặc code.
- Ưu tiên giải quyết các câu hỏi ảnh hưởng đến cấu trúc database và tính đúng đắn của giao dịch trước.
