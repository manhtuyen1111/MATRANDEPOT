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
- [ ] Q-012: Đổi container đã lập lệnh và đã thu phí xử lý thế nào? (Hiện: chỉ hủy được khi chưa thanh toán — OPEN-008.) **Một phần đã giải quyết (DEC-185):** cont đã cấp ra, chờ trả chứng từ → ĐỔI CONTAINER cùng hãng / size / type, giữ chứng từ + phiếu thu. Còn mở: đổi khác size / type (chênh phí), đổi khi lệnh chưa cấp ra mà đã thu tiền.
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
- [ ] Q-032: **(DEC-152: làm sau — tạm xác nhận tay; 2026-10-28 người dùng: dự định nối SePay, quyết sau khi test xong — agent không làm trước)** Ngân hàng / cổng thanh toán nào dùng cho chuyển khoản API QR, và định dạng nội dung chuyển khoản?

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
- [x] Q-037: **ĐÃ CHỐT 2026-10-26 (DEC-150).** Ảnh giám định / sửa chữa — số ảnh mỗi lượt, giữ ảnh gốc bao lâu (ảnh hưởng dung lượng Storage).
- [x] Q-038: **ĐÃ CHỐT 2026-10-26 (DEC-150).** Số người dùng đồng thời giờ cao điểm (chọn gói Supabase).
- [x] Q-039: **ĐÃ CHỐT 2026-10-26 (DEC-152): PITR 7 ngày + bản sao mã hóa hằng đêm (giữ 30) + diễn tập quý.** Chính sách sao lưu — khôi phục về bao lâu trước, có cần bản sao ngoài Supabase. **Đề xuất:** PITR 7 ngày (mất tối đa ~5 phút dữ liệu) + dump mã hóa hằng đêm ra kho ngoài (30 ngày / 12 tháng / 10 năm) + diễn tập khôi phục mỗi quý — `docs/DATABASE_PLATFORM_ADVICE.md` mục 4.
- [x] Q-040: **ĐÃ CHỐT 2026-10-26 (DEC-149): Supabase Singapore** (người dùng chọn). Nơi đặt database và ngân sách tháng — **đề xuất** Supabase vùng Singapore, gói Pro + PITR, 3 môi trường dev / staging / production; cần xác nhận có yêu cầu lưu dữ liệu tại Việt Nam không (Nghị định 53/2022) — `docs/DATABASE_PLATFORM_ADVICE.md` mục 1–3.
- [x] Q-041 (ĐÃ CHỐT — DEC-111: mã bảo mật + trang khách hàng + Kế toán cập nhật ĐÃ XHD; API MISA làm sau): Xuất hóa đơn từ phiếu thu (công ty đang viết phiếu thu giấy). Kế toán xuất hóa đơn khi khách mang phiếu thu đến, tổng hóa đơn phải đủ tiền phiếu thu.
  - **Đề xuất:**
    - Mỗi phiếu thu có mục "Hóa đơn đã xuất" (số, ngày, số tiền).
    - Chặn tổng hóa đơn vượt số tiền phiếu thu.
    - Tra cứu phiếu thu bằng mã / QR in trên phiếu.
    - Phiếu đã xuất đủ thì ghi rõ "ĐÃ XUẤT HĐ" để tránh xuất trùng.
    - Kết nối API MISA làm sau.
  - Chưa làm, chờ xác nhận.

## 9. Quy tắc quản lý câu hỏi

- Chỉ đánh dấu hoàn thành sau khi nghiệp vụ được xác nhận.
- Câu trả lời đã xác nhận phải được cập nhật vào `DECISIONS.md`.
- Nếu câu trả lời làm thay đổi tài liệu khác, phải cập nhật tài liệu liên quan.
- Không tự suy đoán quy tắc nghiệp vụ để bắt đầu viết SQL hoặc code.
- Ưu tiên giải quyết các câu hỏi ảnh hưởng đến cấu trúc database và tính đúng đắn của giao dịch trước.
- [x] Q-041: **ĐÃ CHỐT 2026-10-26 (DEC-151): tên đăng nhập → email nội bộ @matrandepot.local; không khóa, không tự đăng xuất.** (GĐ 4) Khi chuyển sang Supabase Auth: tài khoản đăng nhập bằng tên đăng nhập (Supabase cần email nội bộ dạng `<tên>@matrandepot.local`?), có cần khóa tạm sau nhiều lần đăng nhập sai, thời gian tự đăng xuất? Bản Demo hiện chưa giới hạn (DEC-143).

## Q-042 — Cont W-SURVEY có được Cấp vỏ trước khi giám định bổ sung? (DEC-147)

- Trạng thái: **ĐÃ CHỐT 2026-10-26 (DEC-150): không cho Cấp vỏ.**
- Hiện code **chặn Cấp vỏ** cho đến khi Giám định bổ sung trên kệ xong (Claude đề xuất, vì chưa biết AV / DAMAGE). Người dùng xác nhận giữ hay bỏ.

## Q-043 — Booking cấp vỏ có số lượng cont yêu cầu không?

- Trạng thái: **ĐÃ CHỐT 2026-10-27: giữ như hiện tại** — Văn phòng chỉ nhập số booking, không nhập số lượng; booking không tự chuyển Hoàn thành. Database đã có sẵn cột `release_bookings.requested_qty` (để trống) — bật lại sau chỉ cần thêm ô nhập ở giao diện.

## Q-044 — Import tồn vỏ ban đầu trước khi chạy thật

- Trạng thái: **MỞ** (2026-10-27). Người dùng: test toàn bộ trên database → reset → import tồn vỏ ban đầu rồi mới làm thật.
- **Bộ câu hỏi đầy đủ (7 nhóm, có đề xuất + cột trả lời): `docs/IMPORT_TON_VO_BAN_DAU.md`** — các ý dưới là tóm tắt.
- Cần chốt trước khi làm công cụ import:
  1. File nguồn: Excel theo mẫu Tồn vỏ hiện tại (cùng cột, DEC-129) hay file xuất từ phần mềm cũ? Gửi 1 file mẫu.
  2. Cột bắt buộc: số cont, size, type, hãng tàu, ngày vào bãi (Date in), trạng thái AV / DAMAGE, vị trí (Block – Bay – Row – Tier)… Có Đóng hàng / năm sản xuất / khách hàng không?
  3. Mã hồ sơ cho cont tồn cũ: cấp mới `HV-` theo ngày import hay giữ mã cũ? Cont tồn cũ có tính là "đã thanh toán" không?
  4. Cont DAMAGE tồn cũ: có tạo việc Báo giá / Sửa chữa không?
  5. Ai chạy import (Admin, 1 lần) và có cần xem trước + báo lỗi từng dòng trước khi ghi không?

- ~~**Q-045 (2026-10-28) — EEIR Nhập tàu / Xuất tàu có đổi sang khổ K80 không?**~~ **ĐÃ CHỐT 2026-10-28: có — khổ K80 (DEC-161).** DEC-161 đổi Hạ vỏ / Cấp vỏ sang Phiếu EEIR (K80). Nhập / Xuất tàu không có phiếu K80 (DEC-069) nên EEIR tàu vẫn in nửa A4 (DEC-081). Cần chốt: giữ nửa A4, hay làm mẫu EEIR tàu khổ K80 (giữ thông tin tàu + tình trạng vỏ Giám định)?

## EDI hãng tàu MAERSK (OPEN-009 — chi tiết `docs/EDI_MAERSK.md`, mở 2026-10-30)

- [ ] Q-046: Tài liệu **ITG14 (CODECO D.95B) của Maersk**, hoặc tài liệu / mã nguồn module EDI của ERPVINASHIP (`D:\ERPVINASHIP\…\EDI_MSK`).
- [ ] Q-047: Bảng mã size/type app cũ dùng — 2026-10-30: **20DC = 2200, 40HC = 4200, 45HC = 4500** (người dùng xác nhận); **còn 40DC** (người dùng đang tìm), RF / OT / FR khi gặp.
- [ ] Q-048: Ý nghĩa `RFF+BN:GRADED / GRADEK / GRADEM` (có E?) và `DAM+1+2` / `DAM+1+6`; có khớp Phân loại M / K / E (DEC-166) + AV / DAMAGE không.
- [ ] Q-049: Giờ không có cont có gửi file rỗng không; xin file mẫu 00:00 → 03:00.
- [ ] Q-050: Release for sale (Sale code), Xuất tàu, Nhập tàu gửi loại tin gì, `RFF` gì — xin file mẫu từng loại. — 2026-10-30: **Release for sale đã có mẫu** (`EQD …++8+4`, `RFF+BN:<Sale code>` — `docs/EDI_MAERSK.md` 3.3). **Xuất tàu đã có mẫu** (`EQD …++8+4`, `RFF+BN:VNHPHTM` — 3.4). **Còn Nhập tàu** (có gửi không).
- [ ] Q-051: Giờ ghi `DTM+7`: giờ xe vào / ra cổng, giờ Văn phòng GATE IN OK hay giờ Xe nâng — app cũ lấy giờ nào.
- [ ] Q-052: Tin hủy / sửa (đổi container sau khi đã gửi gate-out, nhập sai số cont): app cũ làm thế nào; file mẫu.
- [ ] Q-053: Kênh gửi — SFTP (máy chủ, cổng, thư mục, mật khẩu hay khóa) hay Gmail (gửi tới đâu, tiêu đề, đính kèm); Maersk có trả xác nhận / báo lỗi không. **Không gửi mật khẩu cho agent.**
- [ ] Q-054: Ai xem / gửi lại EDI: chỉ Admin hay cả Văn phòng.
- [ ] Q-055: Lượt nhập muộn (hạ 03:50, 04:10 mới nhập) đưa vào file giờ nào; Maersk có chấp nhận gửi trễ / trùng không.
- [ ] Q-056: ~~eEIR External API v4.3~~ — **đã nhận + đọc 2026-10-30** (`docs/EDI_MAERSK.md` mục 12). Còn: **eEIR Container Assignment Integration Guide v1.6** + **file mẫu `inspectionDetails` JSON** (Maersk gửi qua email khi cấp khóa).
- [x] Q-057: Depot đã được Maersk duyệt dùng API chưa…? → **Trả lời 2026-10-30:** xin duyệt được; **đã có tài khoản developer**; **đã có mã depot 3 ký tự**; người dùng muốn **đồng bộ API cho toàn bộ app** (thay EDI). Còn chờ tài liệu API (Q-056 + danh sách ở `docs/EDI_MAERSK.md` mục 11).
- [ ] Q-058: eEIR `moveType` (1 POS / 2 IMP / 3 EXP) cho từng tác nghiệp: Hạ vỏ khách trả, Cấp vỏ theo booking, Release for sale, Nhập tàu, Xuất tàu, đổi container.
- [ ] Q-059: eEIR bắt buộc ≥ 1 ảnh mỗi lượt → Cấp vỏ (hiện chưa chụp ảnh) chụp ở bước nào (Xe nâng / Giám định / Văn phòng), bao nhiêu ảnh.
- [ ] Q-060: Email depot nhận PDF eEIR (`emails[].email`, bắt buộc).
- [ ] Q-061: Maersk (EMR / eEIRSupport) xác nhận: gửi eEIR qua API có **thay** CODECO EDI không, hay phải gửi cả hai. — 2026-10-30: Devy (developer portal) không trả lời được, portal không có sản phẩm "gate-in / gate-out equipment move" → cần **support ticket** / eEIRSupport.
- [ ] Q-062: Depot có xác định **hư do bên thứ 3** (mã CEDEX vị trí, loại hư, bên gây hư) không; danh mục hư nhanh có cần đổi sang mã CEDEX.
- [ ] Q-063: Booking Maersk luôn 9–11 ký tự chữ số? Có chặn nhập sai ở Cấp vỏ cho cont MSK không.
- [ ] Q-064: Xuất tàu — `RFF+BN` = mã cảng / terminal đến (mẫu `VNHPHTM`): **luôn cố định** hay **tùy tàu / cảng**? Nếu tùy → thêm ô "Mã cảng đến" khi Văn phòng lập danh sách Xuất tàu.
