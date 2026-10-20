# OPEN QUESTIONS — MATRAN DEPOT

Danh sách các vấn đề nghiệp vụ cần xác nhận trước khi triển khai database và chức năng chính thức.

## 1. Gate In — Nhập container vào bãi

- [ ] Q-001: Có những loại Gate In nào?
- [ ] Q-002: Những thông tin nào bắt buộc khi tạo yêu cầu Gate In?
- [ ] Q-003: Nhân viên hiện trường chụp ảnh cửa container có số container, sau đó xác nhận vào bãi. Cần quy định xử lý thế nào nếu ảnh không rõ hoặc nhập sai số container?
- [ ] Q-004: Thu phí trước khi hoàn tất Gate In. Ai được xác nhận thanh toán thủ công?
- [ ] Q-005: Nếu khách đã thanh toán nhưng Gate In bị hủy, xử lý hoàn tiền hoặc chuyển tiền thế nào?

## 2. Vị trí và tồn bãi

- [ ] Q-006: Vị trí bãi gồm những cấp nào? Ví dụ: Block, Bay, Row, Tier.
- [ ] Q-007: Có cho phép container vào bãi nhưng chưa có vị trí chính thức không?
- [ ] Q-008: Ai được phép thay đổi vị trí container?
- [ ] Q-009: Quy trình xử lý khi hệ thống và vị trí thực tế không khớp là gì?

## 3. Booking và cấp container

- [ ] Q-010: Một booking có thể cấp nhiều container không?
- [ ] Q-011: Ai được quyền chọn container để cấp cho khách?
- [ ] Q-012: Khi đổi container đã giữ chỗ, điều kiện mở khóa container cũ là gì?
- [ ] Q-013: Nếu hai nhân viên đồng thời chọn cùng một container, hệ thống cần xử lý thế nào?

## 4. Gate Out — Xuất container khỏi bãi

- [ ] Q-014: Điều kiện bắt buộc để hoàn tất Gate Out là gì?
- [ ] Q-015: Có trường hợp được xuất container khi chưa thanh toán đủ không?
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
