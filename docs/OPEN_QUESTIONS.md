# OPEN QUESTIONS — MATRAN DEPOT

Danh sách các vấn đề nghiệp vụ cần xác nhận. Câu đã trả lời ghi rõ quyết định tương ứng trong `DECISIONS.md`.

Cập nhật lần cuối: 2026-10-22.

## 1. Gate In — Nhập container vào bãi

- [ ] Q-001: *(Đã xác nhận 2 trường hợp; NHẬP TÀU để sau — DEC-038)* Còn loại tiếp nhận nào khác cần hỗ trợ, và quy trình chi tiết của `NHẬP TÀU`?
- [x] Q-002: Tình trạng vệ sinh chọn nhiều giá trị (DEC-016, DEC-020); danh mục SIZE/TYPE cấu hình tại Danh mục chung (DEC-028); văn phòng ghi nhận hãng tàu, khách hàng, số lệnh (DEC-022).
- [ ] Q-003: Xử lý thế nào nếu ảnh không rõ hoặc nhập sai số container sau khi đã GATE IN OK?
- [x] Q-004: Văn phòng / Quản lý xác nhận thanh toán tại Văn phòng (DEC-047 — bỏ Kế toán).
- [ ] Q-005: Khách đã thanh toán nhưng Gate In bị hủy thì hoàn tiền / chuyển tiền thế nào? (OPEN-008)
- [x] Q-030: Bộ phận tiếp theo sau `GATE IN OK` (DEC-024).

## 2. Vị trí và tồn bãi

- [x] Q-006: Block do Admin tự cấu hình ở Danh mục chung, không gán cứng trong database (DEC-050).
- [x] Q-007: Từ `GATE IN OK` đến khi Xe nâng hạ vỏ, container ở trạng thái Chờ hạ vỏ, vị trí hiển thị `-` (DEC-036).
- [x] Q-008: Xe nâng / Hiện trường / Văn phòng / Quản lý được ĐẢO CHUYỂN; Văn phòng / Quản lý được SỬA VỊ TRÍ hành chính (DEC-035, DEC-036).
- [ ] Q-009: Quy trình khi vị trí hệ thống và thực tế không khớp (ngoài SỬA VỊ TRÍ) — có cần kiểm kê định kỳ không?
- [x] Q-031: Văn phòng / Quản lý khóa / mở khóa, bắt buộc ghi chú (DEC-030).

## 3. Booking và cấp container

- [x] Q-010: Một booking cấp nhiều container; chỉ nhập số booking, hệ thống tự đếm (DEC-017, DEC-034).
- [x] Q-011: Văn phòng / Quản lý chọn container để cấp (DEC-027, DEC-033).
- [ ] Q-012: Đổi container đã lập lệnh và đã thu phí xử lý thế nào? (Hiện: chỉ hủy được khi chưa thanh toán — OPEN-008.)
- [x] Q-013: Hệ thống chặn lập lệnh lần 2 cho container đã lập lệnh (DEC-006). Ở chế độ Supabase cần ràng buộc database.

## 4. Gate Out — Xuất container khỏi bãi

- [ ] Q-014: Khoản phí và bộ chứng từ bắt buộc riêng cho `XUẤT TÀU` và trả container theo lệnh riêng.
- [x] Q-015: TTS là hình thức thanh toán sau hợp lệ để cấp vỏ (DEC-031, DEC-033).
- [ ] Q-016: Ai được phép hủy hoặc sửa một lượt Gate Out đã xác nhận OUT?

## 5. Dịch vụ và sửa chữa

- [ ] Q-017: Trạng thái chi tiết của quy trình vệ sinh (hiện: Chờ vệ sinh → Hoàn tất).
- [x] Q-018: Báo giá lưu REMARK SỬA CHỮA; số tiền không bắt buộc (DEC-040).
- [x] Q-019: Báo giá do vai trò Báo giá riêng, chỉ nhập remark, không cần hãng tàu duyệt (DEC-026, DEC-040).
- [ ] Q-020: Ảnh bắt buộc khi hoàn tất sửa chữa.

## 6. Thanh toán và đối soát

- [x] Q-021: TTT / TTS / TTTT (tiền mặt, chuyển khoản API QR) và trạng thái từng loại (DEC-031).
- [ ] Q-022: Dịch vụ nào thu trước, thu sau hoặc miễn phí (ngoài Hạ vỏ, Cấp vỏ)?
- [ ] Q-023: Công nợ TTS quản lý theo khách hàng, hãng tàu hay bên chịu phí? Quy trình thu nợ TTS phát hành phiếu thu như thế nào?
- [ ] Q-024: Quy trình xử lý giao dịch thất bại / hoàn tiền (OPEN-008).
- [ ] Q-025: Ai được điều chỉnh giao dịch đã ghi nhận?
- [ ] Q-032: Ngân hàng / cổng thanh toán nào dùng cho chuyển khoản API QR, và định dạng nội dung chuyển khoản?

## 7. Người dùng và phân quyền

- [x] Q-026: 11 vai trò (DEC-017, DEC-026).
- [x] Q-027: Cho phép kiêm nhiệm (DEC-017).
- [ ] Q-028: Ai được tạo tài khoản và cấp quyền?
- [ ] Q-029: Danh sách thao tác bắt buộc lưu nhật ký kiểm toán (hiện: mọi thao tác ghi dữ liệu đều ghi nhật ký).

## 8. Báo cáo

- [x] Q-033: (Xác nhận — DEC-040) Sheet `XUẤT VỎ` / `NHẬP VỎ` của báo cáo Tổng hợp hiện được hiểu là XUẤT TÀU (+ trả theo lệnh riêng) / NHẬP TÀU. Đúng chưa?
- [x] Q-034: Xuất Excel .xlsx chuẩn (DEC-050).
- [x] Q-035: Không còn hiệu lực — đã bỏ bước QC (DEC-049).
- [x] Q-036: Giới hạn lọc báo cáo, ngưỡng xuất Excel phía máy chủ, thời gian lưu dữ liệu (DEC-066).
- [ ] Q-037: Ảnh giám định / sửa chữa — số ảnh mỗi lượt, giữ ảnh gốc bao lâu (ảnh hưởng dung lượng Storage).
- [ ] Q-038: Số người dùng đồng thời giờ cao điểm (chọn gói Supabase).
- [ ] Q-039: Chính sách sao lưu — khôi phục về bao lâu trước, có cần bản sao ngoài Supabase.

## 9. Quy tắc quản lý câu hỏi

- Chỉ đánh dấu hoàn thành sau khi nghiệp vụ được xác nhận.
- Câu trả lời đã xác nhận phải được cập nhật vào `DECISIONS.md`.
- Nếu câu trả lời làm thay đổi tài liệu khác, phải cập nhật tài liệu liên quan.
- Không tự suy đoán quy tắc nghiệp vụ để bắt đầu viết SQL hoặc code.
- Ưu tiên giải quyết các câu hỏi ảnh hưởng đến cấu trúc database và tính đúng đắn của giao dịch trước.
