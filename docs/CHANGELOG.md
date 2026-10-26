# CHANGELOG — MATRAN DEPOT

Ghi lại những thay đổi quan trọng của tài liệu, thiết kế, database và chức năng dự án.

## [0.4.1] — 2026-10-23 (nhánh `agent/claude/p4-prep-xlsx`)

### Changed
- Xuất Excel Báo cáo Tổng hợp / Sửa chữa chi tiết sang **.xlsx chuẩn** (`exceljs`, tải khi cần) — DEC-050.
- Block bãi do Admin cấu hình, không gán cứng trong database — DEC-050.

### Added
- Test đọc lại file .xlsx (5 sheet, tiêu đề cột). Kiểm thử: 43/43 pass, build PASS.

### Added (2026-10-23)
- Phiếu thu ghi rõ tác nghiệp (HẠ VỎ / CẤP VỎ / THU TRƯỚC), lọc theo tác nghiệp; hồ sơ container có khung Thu tiền nổi bật và link thẳng về Văn phòng → Phiếu thu (DEC-051). Kiểm thử: 45/45 pass.

### Added (2026-10-23, tiếp)
- Phiếu K80 bố cục mới: thông tin chung + LỘ TRÌNH các bước (ô ☐ tích tay, ✓ khi xem trên app) + QR (DEC-052).
- Menu **Văn phòng → Trả chứng từ**: quét QR K80 khi lái xe quay về → in EEIR + phiếu thu (DEC-052).
- Xe nâng – Chờ cấp vỏ: khung nổi bật số container + vị trí (DEC-053). Kiểm thử: 48/48 pass.

### Changed (2026-10-23, tiếp)
- Thời gian toàn app thống nhất dd/MM/yyyy HH:mm:ss; bộ lọc thời gian nhập theo định dạng này (DEC-054).
- Nút Xuất Excel theo bộ lọc ở Phiếu thu và mọi báo cáo; file .xlsx có tiêu đề nền, viền, bộ lọc cột (DEC-055). Kiểm thử: 50/50 pass.

### Changed (2026-10-23, tiếp)
- Bộ lọc thời gian Phiếu thu / báo cáo mặc định 1 ngày trước → hiện tại (DEC-056). Kiểm thử: 52/52 pass.

### Fixed (2026-10-23)
- Mã QR phiếu K80 bị trùng giữa các lượt lưu bãi / lệnh cấp lại (tạo theo số container) → tạo theo mã hồ sơ; mã đóng sau khi trả chứng từ (DEC-057).

### Changed (2026-10-23, tiếp)
- Hồ sơ container bố cục thống nhất: thông tin container ở đầu, bộ phận theo thứ tự, xác nhận ✓ HOÀN THÀNH bên phải, Thanh toán 1 mục riêng dưới Văn phòng có link phiếu thu (DEC-058). Kiểm thử: 53/53 pass.

### Added (2026-10-23, tiếp)
- Giám định xóa hồ sơ hạ vỏ khi Văn phòng chưa thao tác (DEC-059).
- Văn phòng Hạ vỏ: báo trùng Tồn vỏ ngay khi nhập số container và chặn các bước tiếp (DEC-060). Kiểm thử: 56/56 pass.

### Changed (2026-10-23, tiếp)
- Xe nâng Chờ hạ vỏ / Chờ cấp vỏ: khung nổi bật thống nhất (số cont, size/type, trạng thái/đóng hàng hoặc vị trí), bỏ dòng trùng, tối ưu mobile (DEC-061). Kiểm thử: 56/56 pass.

### Added (2026-10-23, tiếp)
- Danh mục chung → Công ty; mẫu in phiếu thu thống nhất có thông tin công ty + tác nghiệp (DEC-062).
- Theo dõi số lần in phiếu thu: cột Đã in, lịch sử in, xác nhận In lại, nhãn BẢN IN LẠI (DEC-063).
- Trả chứng từ chia 2 phần HẠ VỎ / CẤP VỎ (DEC-064). Kiểm thử: 59/59 pass.

### Changed (2026-10-23, DEC-065)
- Khóa container: nội dung bắt buộc là Remark Văn phòng. Cấp vỏ hiển thị cả cont đang khóa, phải mở khóa trước khi cấp. Tồn vỏ có Xuất Excel. Kiểm thử: 60/60 pass.

### Changed (2026-10-23, DEC-065 bổ sung)
- Cấp vỏ: cont khóa chỉ hiện biểu tượng khóa; thêm cột Ghi chú văn phòng.

### Changed (2026-10-23, DEC-064 sửa)
- Trả chứng từ: 1 ô quét chung; danh sách đang chờ chia 2 cột Hạ vỏ / Cấp vỏ kèm số lượt.

### Changed (2026-10-23)
- Tồn vỏ: các thao tác (Sửa vị trí, Khóa / Mở khóa) gom vào 1 ô sổ xuống trên mỗi dòng.

### Changed (2026-10-23)
- Tồn vỏ: ô Thao tác chỉ còn Khóa / Mở khóa; Sửa vị trí bằng biểu tượng bút ở cột Vị trí (giống Ghi chú văn phòng).

### Decided (2026-10-23)
- DEC-066: lọc báo cáo tối đa 3 tháng; Excel > 20.000 dòng xuất phía máy chủ; giữ dữ liệu 10 năm; thiết kế index / phân trang — DATABASE_CONTRACT mục 10.

### Changed (2026-10-23)
- Tồn vỏ: cột Thao tác trở lại 1 nút Khóa / Mở khóa (bỏ sổ xuống).

### Changed (2026-10-24, DEC-067)
- Tồn vỏ: cột Lưu bãi; bỏ cột Thao tác, khóa bằng icon cạnh số cont (đỏ = khóa, xám = không khóa); bút sửa vị trí canh cột; Ghi chú tô nền vàng, bỏ ghim; tìm / khóa / ghi chú hàng loạt; Excel đủ cột. Kiểm thử: 62/62 pass.

### Changed (2026-10-24, DEC-068)
- Mã hồ sơ theo viết tắt tác nghiệp: HV- / CV- / NT- / XT- / PT- / PTT-; dữ liệu cũ IN- / HS- / OUT- / GO- / PTM- được đổi khi nạp.

### Added (2026-10-24, DEC-069)
- NHẬP TÀU / XUẤT TÀU: Văn phòng lập danh sách theo tàu (tên tàu, thời gian, số xe, container) và duyệt khi xong; Giám định xác nhận cont nhập tàu (mobile); Vệ sinh / Xe nâng có menu Nhập tàu; Giám định / Xe nâng xuất tàu (mobile); hồ sơ NT- / XT-; Báo cáo Nhập tàu / Xuất tàu + sheet NHẬP VỎ / XUẤT VỎ của Tổng hợp. Không thu phí, không K80. Kiểm thử: 68/68 pass.

### Changed (2026-10-24, DEC-070)
- Bỏ menu Vệ sinh → Nhập tàu (cont nhập tàu vào Chờ vệ sinh). Văn phòng → Nhập tàu / Xuất tàu: danh sách đang thực hiện → chi tiết; sửa thông tin / thêm cont / xóa danh sách khi chưa duyệt. Danh sách cont xếp size 20 → 40, số cont A→Z; ô tìm ở Giám định / Xe nâng lọc ngay khi gõ như Tồn vỏ. Kiểm thử: 72/72 pass.

### Changed (2026-10-24, DEC-071)
- Màn hiện trường Nhập tàu / Xuất tàu (Giám định, Xe nâng): khung tiến độ (xong/tổng, chờ làm, bạn đã làm, theo xe), tab Chờ làm / Đã xong / Tất cả, báo cont đã làm để chống làm trùng, dải Vừa xong. Xe nâng → Nhập tàu dùng chung mẫu màn này. Kiểm thử: 73/73 pass.

### Fixed (2026-10-24, DEC-072)
- Hồ sơ container: "In hồ sơ" in ra trang trắng → thay bằng In EEIR / In EEIR + phiếu thu cho từng lượt Hạ vỏ / Cấp vỏ. EEIR và phiếu thu dùng chung khung in (công ty, Số, Tác nghiệp, chữ ký, In lúc). In kèm phiếu thu vẫn đếm số lần in. Trả chứng từ: "In lại EEIR" không in lại phiếu thu. Kiểm thử: 74/74 pass.

### Added (2026-10-24, DEC-073)
- Văn phòng → Xuất tàu → Lập danh sách / Thêm cont: nút Tìm hàng loạt như Tồn vỏ (dán nhiều số cont, chọn tất cả cont tìm được, báo số không có trong tồn vỏ). Kiểm thử: 75/75 pass.

### Changed (2026-10-24, DEC-074)
- Tồn vỏ: cột Date in (thời gian vào bãi) giữa Hãng tàu và Trạng thái; Excel thêm DATE IN + VÀO BÃI BẰNG; sắp lại độ rộng cột. Kiểm thử: 75/75 pass.

### Changed (2026-10-24, DEC-075)
- Menu: số đếm việc chờ cho Giám định / Xe nâng → Nhập tàu, Xuất tàu; mọi việc hiện trường đang chờ hiện ô đếm màu cam + chấm nhấp nháy, nhóm menu cũng báo màu cam. Kiểm thử: 75/75 pass.

### Changed (2026-10-24, DEC-076)
- Phiếu thu: nút Tạo phiếu thu TTT cùng hàng Tra cứu / Xuất Excel. In EEIR + phiếu thu: mỗi phiếu nửa tờ A4 (A5), 2 phiếu 1 tờ; EEIR bỏ bảng bộ phận, thêm tình trạng vỏ Giám định. Kiểm thử: 76/76 pass.

### Changed (2026-10-24, DEC-077)
- Phiếu thu: danh sách full chiều ngang, đủ cột; tạo phiếu thu trước theo bố cục Khách hàng → Chi phí (biểu giá × số lượng, tổng do hệ thống tính) → Hình thức thanh toán; bản in PHIẾU THU TRƯỚC (TTT) có khung nổi bật PTT-, SL / đơn giá. Kiểm thử: 78/78 pass.

### Changed (2026-10-24, DEC-078)
- Menu: biểu tượng tác nghiệp mobile và số đếm nằm trong cột cố định → thẳng hàng.

### Changed (2026-10-24, DEC-079)
- Phiếu thu: bỏ cột Xác nhận thu, Trạng thái sát cột Đã in, cột Phương thức TT (Tiền mặt / Chuyển khoản), tách Thời gian / Nhân viên; phiếu thu trước hiện số lượt đã dùng / còn lại và bảng từng lần trừ (chứng từ, hồ sơ); Excel thêm cột tương ứng. Kiểm thử: 81/81 pass.

### Added (2026-10-24, DEC-080)
- Quy chuẩn trang nhiều dữ liệu (docs/UI_DATA_LIST_STANDARD.md): danh sách full màn hình, chi tiết mở cửa sổ trượt bên phải (DetailDrawer), chọn 20 / 50 / 100 dòng / trang. Áp dụng: Phiếu thu, Tồn vỏ, Nhập / Xuất tàu (Văn phòng), Báo cáo, Hồ sơ container. Kiểm thử: 83/83 pass.

### Added (2026-10-24, DEC-081)
- EEIR cho hồ sơ Nhập tàu / Xuất tàu (cùng khung EEIR Hạ vỏ / Cấp vỏ, có tình trạng vỏ Giám định, tên tàu, số xe); nút In EEIR NHẬP TÀU / XUẤT TÀU trong hồ sơ. Kiểm thử: 84/84 pass.

### Changed (2026-10-24, UI-02)
- Gom form Giám định (Trạng thái / Đóng hàng / Vệ sinh / AGE) của Giám định → Hạ vỏ và → Nhập tàu thành 1 component dùng chung `InspectionFields` (Hạ vỏ giữ cách hiện lần lượt từng mục). Không đổi nghiệp vụ. Kiểm thử: 85/85 pass.

### Changed (2026-10-24, DEC-082)
- Vị trí theo cấu hình thực tế: mã luôn BLOCK- (chỉ gõ A, B, C), mô tả bên dưới; Bay / Row / Tier tối đa để trống = không dùng; mọi tác vụ vị trí chỉ hiện / bắt buộc chiều đã cấu hình; bỏ đặt cấp Block trước. Kiểm thử: 87/87 pass.

### Added (2026-10-24, DEC-083)
- Vệ sinh / Xe nâng: nhãn tác nghiệp (Hạ vỏ / Cấp vỏ / Nhập tàu + tàu / Xuất tàu + tàu) ở khung cont vừa quét và danh sách chờ. Kiểm thử: 89/89 pass.

### Changed (2026-10-24, DEC-084)
- Báo giá → Chờ báo giá: bảng giống Tồn vỏ (thêm cột Hư hỏng), bấm dòng mở cửa sổ trượt nhập remark + giờ công. Kiểm thử: 90/90 pass.

### Changed (2026-10-24, DEC-085)
- Danh sách chờ Vệ sinh / Xe nâng: số cont ở cột cố định (thẳng hàng), nhãn tác nghiệp + tên tàu xuống dòng 2.

### Changed (2026-10-24, DEC-086)
- Chờ báo giá: cột Tình trạng sửa chữa + Giờ công thay Hư hỏng giám định; cột Tác nghiệp (Cập nhật / Xác nhận chờ sửa chữa); báo giá lưu nháp trước, xác nhận mới chuyển Sửa chữa. Kiểm thử: 91/91 pass.

### Changed (2026-10-24, DEC-087)
- Vị trí: chỉ chặn trùng khi đủ Block – Bay – Row – Tier; thiếu chiều thì nhiều cont chung 1 vị trí.

### Added (2026-10-24, DEC-088)
- Chờ báo giá: Tìm hàng loạt, chọn nhiều, Xác nhận chờ sửa chữa hàng loạt (bỏ qua cont chưa cập nhật). Kiểm thử: 92/92 pass.

### Changed (2026-10-24, DEC-089)
- Danh sách chờ Vệ sinh / Xe nâng: ô tác nghiệp riêng bên trái, bên phải số cont / size-type / vị trí, tầng 2 tên tàu tách riêng + thông tin phụ. Kiểm thử: 93/93 pass.

### Changed (2026-10-24, DEC-090)
- Xe nâng → Đảo chuyển: vị trí thẳng cột (lưới cột cố định số cont / size-type / vị trí canh trái). Kiểm thử: 94/94 pass.

### Changed (2026-10-24, DEC-091)
- Đảo chuyển: vị trí tách cột Block / Bay / Row / Tier thẳng hàng với hàng tiêu đề, thiếu thì để trống.

### Changed (2026-10-24, DEC-092)
- Đảo chuyển: số cont / size-type / vị trí trên 1 dòng (BLOCK-A / 17-02-02), ô Block rộng cố định để vị trí thẳng cột; bỏ hàng tiêu đề cột.

### Changed (2026-10-24, DEC-093)
- Hạ vỏ / Cấp vỏ: ô Khách hàng gõ tay hoặc chọn, gợi ý từ Danh mục; khách ngoài Danh mục chỉ thanh toán Tiền mặt / Chuyển khoản. Kiểm thử: 96/96 pass.

### Changed (2026-10-24, DEC-094)
- Đảo chuyển: ô trạng thái (AV / DAMAGE) đầu dòng, số cont + vị trí, dòng cuối size/type + nhãn tiến độ. Kiểm thử: 96/96 pass.

### Changed (2026-10-24, DEC-095)
- Đảo chuyển: tiến độ sang bên phải vị trí; dòng 2 hiện Ghi chú (Remark Văn phòng, nền vàng khi có).

### Changed (2026-10-24, DEC-096)
- Đảo chuyển: ô AV / DAMAGE cùng kích thước ô tác nghiệp ở danh sách Xe nâng.

### Docs (2026-10-24, phiên 2)
- Tư vấn nền tảng database: docs/DATABASE_PLATFORM_ADVICE.md (Supabase Singapore + PITR, 3 môi trường, sao lưu 3-2-1, 11 tình huống vận hành, lộ trình); Q-040 mới.

### Changed (2026-10-25, DEC-097)
- Hình thức thanh toán (Hạ vỏ / Cấp vỏ): TTTT — Trực tiếp đứng đầu, chọn sẵn + Tiền mặt. Kiểm thử: 97/97 pass.

### Changed (2026-10-25, DEC-098 → DEC-101)
- Mã phiếu thu mới: `PT-TT-YYMMDD-NNNN` (trực tiếp) và `PT-TTR-YYMMDD-NNNN` (nạp trước), duy nhất, đánh số theo ngày. Mã cũ giữ nguyên (DEC-098).
- Tồn vỏ: thêm cột Hình thức TT và Phiếu thu, cả trên màn và trong Excel (DEC-099).
- Ký hiệu hình thức thanh toán đổi thành TT / TTR / TTS (DEC-100).
- Menu Báo cáo: "Sửa chữa chi tiết" → "Sửa chữa" (DEC-101).
- Đề xuất xuất hóa đơn từ phiếu thu: Q-041. Kiểm thử: 99/99 pass, build PASS.

### Added (2026-10-25, DEC-102)
- Ô lọc nhanh thời gian cho mọi bộ lọc: Hôm nay / Hôm qua / Tuần này / Tuần trước / Tháng này / Tháng trước / Năm nay / Tùy chọn. Mặc định Hôm nay, tuần tính từ Thứ Hai; chọn Tùy chọn mới hiện ô Từ - Đến. Đổi nốt nhãn TTT → TTR. Kiểm thử: 100/100 pass, build PASS.
- Sửa DEC-100 trong ngày: hình thức thanh toán là TRỰC TIẾP / TRẢ TRƯỚC / THANH TOÁN SAU, ký hiệu TT / TTR / TTS. Mã phiếu thu `PT-TT-…` / `PT-TTR-…` (bỏ TL / TR).
- Đổi tên hiển thị "Phiếu thu mẹ" → **PHIẾU THU TRẢ TRƯỚC** trên màn hình, giấy in, Excel và thông báo (DEC-103). Kiểm thử: 100/100 pass, build PASS.
- Tồn vỏ: cột **MÃ PHIẾU THU** chỉ hiện mã của lượt (TT `PT-TT-…`, TTR `PTT-…`); TTS / chưa thanh toán để trống; bỏ thông tin chứng từ (DEC-104).
- Tồn vỏ: bấm MÃ PHIẾU THU mở đúng phiếu thu ở Văn phòng → Phiếu thu (DEC-105).
- Ứng dụng mở với dữ liệu sạch (giữ danh mục, xóa dữ liệu tác nghiệp, mã đếm lại từ đầu); nút "Xóa dữ liệu" có xác nhận (DEC-106).
- Văn phòng → Phiếu thu: bỏ chứng từ, số container ngay sau Tác nghiệp; Excel phiếu thu cùng thứ tự, cột HÌNH THỨC TT ghi chữ (DEC-107). Kiểm thử: 102/102 pass, build PASS.
- Dữ liệu test đầy đủ trường hợp (MSK; 20 / 40 / 45; đủ hình thức thanh toán, khóa, DAMAGE, vệ sinh, cấp vỏ, nhập / xuất tàu), tạo bằng hàm nghiệp vụ thật; nút "Nạp dữ liệu test" (DEC-108). Kiểm thử: 103/103 pass, build PASS.
- Hạ vỏ: ô tích **HẠ KỆ GIÁM ĐỊNH** ở Giám định → Xe nâng chỉ được hạ vào block Kệ giám định (Admin đánh dấu trong Danh mục Vị trí), K80 ghi rõ bước; giám định xong thì Đảo chuyển về vị trí phù hợp (DEC-109). Kiểm thử: 106/106 pass, build PASS.
- Trả chứng từ: nút **Xem trước** bên trái nút Trả chứng từ — xem EEIR + phiếu thu, không ghi trả, không in, không tính lần in (DEC-110). Kiểm thử: 107/107 pass, build PASS.
- Phiếu thu có **mã bảo mật 12 ký tự** + đường link in trên phiếu; trang khách hàng `#/hoa-don` để gửi MST / Gmail / Tên công ty / Địa chỉ / Ghi chú; trạng thái CHƯA XHD → YÊU CẦU XHD → ĐÃ XHD; **thêm lại vai trò Kế toán** cập nhật ĐÃ XHD (số hóa đơn MISA tùy chọn); cột / lọc / Excel Hóa đơn; dữ liệu test có đủ 3 trạng thái (DEC-111, Q-041). Kiểm thử: 115/115 pass, build PASS.
- Phiếu thu: khối Xuất hóa đơn hiện **mã bảo mật** để đối soát (DEC-112). Kiểm thử: 115/115 pass, build PASS.
- Phiếu thu in: "Người thu tiền" là nhân viên Văn phòng (không còn "HỆ THỐNG (Ngân hàng)"); trang yêu cầu xuất hóa đơn có **hướng dẫn từng bước** + cách xử lý khi sai thông tin / đã xuất; khối Xuất hóa đơn hiện cả đường link (DEC-113). Kiểm thử: 116/116 pass, build PASS.
- Trang yêu cầu xuất hóa đơn: hướng dẫn rút gọn 3 bước + 1 dòng "Ghi sai?", đặt dưới ô Mã bảo mật (DEC-114).
- Xe nâng → Đảo chuyển: mỗi cont đúng 2 dòng trên mobile — dòng 1 số cont | size/type | tiến độ; dòng 2 vị trí | ghi chú (DEC-115). Kiểm thử: 116/116 pass, build PASS.
- Mobile: ô nhập / chọn dùng chữ 16px trên màn nhỏ để điện thoại không tự phóng to làm vỡ khung; Đảo chuyển bỏ ô Ghi chú tác nghiệp (DEC-116). Kiểm thử: 117/117 pass, build PASS.
- Link dữ liệu thống nhất kiểu Mã hồ sơ toàn app (`linkCls`); Tồn vỏ cột MÃ PHIẾU THU cùng định dạng Mã hồ sơ (DEC-117). Kiểm thử: 117/117 pass, build PASS.
- Mọi mã có hồ sơ lưu trữ đều là link: Phiếu thu (mã phiếu thu, mã hồ sơ, phiếu thu trả trước), Tồn vỏ (mã hồ sơ), Báo giá, Trả chứng từ (DEC-118). Kiểm thử: 117/117 pass, build PASS.

### Changed (2026-10-26, DEC-119)
- Bỏ mã chứng từ `CT-`: số chứng từ = mã hồ sơ tác nghiệp (HV- / CV-), cũng là mã tham chiếu chuyển khoản; bỏ dòng / ô / cột "Chứng từ" trùng ở phiếu thu in, hồ sơ, Excel Hạ vỏ / Cấp vỏ. Kiểm thử: 118/118 pass, build PASS.

### Added (2026-10-26, DEC-120)
- **Góp ý**: nút ở góc trên bên phải (chọn menu / tính năng + nội dung, xem "Góp ý của tôi"); **Báo cáo → Góp ý** chỉ Admin — lọc, Excel, cập nhật trạng thái MỚI / ĐANG XỬ LÝ / ĐÃ XỬ LÝ / KHÔNG ÁP DỤNG + phản hồi. Kiểm thử: 124/124 pass, build PASS.
- Phiếu thu trả trước: cột **Mã hồ sơ** hiện mã các tác nghiệp đã dùng phiếu (link hồ sơ), không còn hiện PTT-; Excel cùng quy tắc (DEC-121). Kiểm thử: 125/125 pass, build PASS.
- Phiếu thu trả trước: cột Mã hồ sơ chỉ hiện "Dùng N lượt • còn X ₫" (link) — bấm mở chi tiết các lượt đã dùng; Excel vẫn ghi đủ mã hồ sơ (DEC-122).
- Góp ý: chọn Menu chính → Tính năng → mới hiện ô Nội dung (DEC-123). Kiểm thử: 125/125 pass, build PASS.
- Phiếu thu trả trước chỉ còn **một mã** `PT-TTR-YYMMDD-NNNN` (cấp ngay khi tạo, chờ thanh toán; thu xong là số phiếu thu; QR = `QR-<mã>`); bỏ mã PTT- (DEC-124). Kiểm thử: 125/125 pass, build PASS.
- Chọn / sửa vị trí từng bước Block → Bay → Row → Tier bằng nút lớn, tóm tắt giá trị đã chọn ở trên (bấm để chọn lại) — áp dụng Xe nâng, Đảo chuyển, Nhập tàu, Tồn vỏ (DEC-125). Kiểm thử: 126/126 pass, build PASS.
- Báo cáo Hạ vỏ / Cấp vỏ (màn + Excel) thêm cột Thanh toán + Mã phiếu thu như Tồn vỏ; đổi "Hình thức TT" → "Thanh toán"; sửa khoảng đệm ô Mã hồ sơ ở báo cáo (DEC-126). Kiểm thử: 127/127 pass, build PASS.
- Cột Thanh toán chỉ ghi TRỰC TIẾP / TRẢ TRƯỚC / THANH TOÁN SAU / Không thu phí (bỏ ký hiệu TT —, TTR —, TTS —) (DEC-127).
- Tồn vỏ: cột Phân loại (đóng hàng) bên phải Trạng thái; Excel đổi ĐÓNG HÀNG → PHÂN LOẠI, đặt ngay sau TRẠNG THÁI (DEC-128). Kiểm thử: 127/127 pass, build PASS.
- Tồn vỏ: cột AGE sau Hãng tàu, Tiến độ sau Mã phiếu thu (màn hình + Excel cùng thứ tự); quy tắc "đổi cột màn hình → sửa Excel tương ứng" + test tự động cho Tồn vỏ (DEC-129). Kiểm thử: 128/128 pass, build PASS.
- Phiếu thu trả trước: khách yêu cầu hóa đơn **theo từng lượt đã dùng**, tự gộp nhiều lượt / tách riêng (mỗi yêu cầu 1 MST, 1 địa chỉ), sửa / hủy khi chưa xuất; Kế toán xuất theo từng yêu cầu; trạng thái "đã xuất x/y lượt"; Excel ghép theo yêu cầu (DEC-130). Kiểm thử: 129/129 pass, build PASS.
- Xuất tàu: cont vào danh sách tự khóa + ghi chú "XUẤT TÀU <tàu>" (chặn cấp vỏ, vẫn xuất tàu được); bỏ khỏi danh sách / không kịp → tự mở khóa, xóa ghi chú. Duyệt Nhập / Xuất tàu khi chưa đủ (bắt buộc lý do), cont không kịp bị gạch (DEC-131). Kiểm thử: 130/130 pass, build PASS.

### Pending
- P4-01 Database: chờ danh mục trạng thái chính thức (OPEN-003).

## [0.4.0] — 2026-10-22 (Change Request đợt 1 — nhánh `feature/cr-2026-10-batch1`)

Phạm vi: frontend + tầng nghiệp vụ chế độ Demo (localStorage). **Chưa thay đổi database / Supabase.**

### Added
- Vai trò `QUOTATION` (Bộ phận Báo giá) và nhân sự mẫu.
- Menu **Xe nâng → Đảo chuyển** (CR-01): tìm / lọc SIZE, TIẾN ĐỘ; lưu lịch sử ĐẢO CHUYỂN.
- **Tồn vỏ**: SỬA VỊ TRÍ hành chính, KHÓA / MỞ KHÓA container có ghi chú bắt buộc, biểu tượng khóa, vị trí chưa chính thức hiển thị `-` (CR-02).
- Menu **Văn phòng → Phiếu thu** (CR-04): tra cứu có lọc và phân trang; Kế toán tạo phiếu thu TTT (Tiền mặt / Chuyển khoản API QR); mã `PT-YYYY-NNNNNN`.
- Giao dịch thu tiền và phiếu thu tách khỏi chứng từ; chuyển khoản chờ ngân hàng xác nhận, chống xử lý lặp; nút giả lập ngân hàng chỉ ở chế độ Demo.
- **Cấp vỏ** (CR-05): theo dõi booking (đếm đã cấp, mở danh sách), SỐ XE + SĐT LÁI XE, CHI PHÍ + thanh toán tại Văn phòng như Hạ vỏ, bộ lọc Hãng tàu–Size–Type–Trạng thái, cột Phân loại đóng hàng, cho phép cấp DAMAGE.
- Mã hồ sơ `IN-YYMMDD-NNN` / `OUT-YYMMDD-NNN` do hệ thống cấp (CR-07); hồ sơ cấp vỏ xem được cả khi container đã OUT.
- **Báo cáo** (CR-08): Cấp vỏ, Nhập tàu, Xuất tàu (tra cứu bắt buộc lọc, phân trang), Tổng hợp xuất Excel 5 sheet.
- Menu mới có icon, nhóm thu gọn / mở rộng, thu thành thanh icon, ngăn kéo trên điện thoại, hiển thị theo quyền (CR-06, CR-09); Danh mục chung tách mục con trên menu.
- `AGENTS.md`, `CLAUDE.md`, `.claude/settings.json` (harness cho AI agent).
- 34 test tự động (nghiệp vụ + smoke render UI).

### Changed
- Hạ vỏ: `ĐẠI DIỆN KHÁCH HÀNG` → `SĐT LÁI XE` (giữ trường Khách hàng); tiêu đề `CHI PHÍ (ĐÃ BAO GỒM VAT)`; bỏ phần giải thích dài; chi phí chỉ từ biểu giá.
- TTS ghi nhận là công nợ (`DEFERRED`), không còn ghi là đã thanh toán; dữ liệu demo cũ được quy đổi tự động.
- Container có yêu cầu vệ sinh chỉ vào hàng chờ Xe nâng hạ vỏ sau khi vệ sinh xong (CR-03).
- Quyền: Vệ sinh và Xe nâng thêm Văn phòng; Báo giá chỉ `QUOTATION`; Sửa chữa chỉ `REPAIR_STAFF`; ghi chú tồn vỏ chỉ Văn phòng / Quản lý.
- Xe nâng Chờ cấp vỏ chỉ xác nhận OUT; không còn tự ghi phí 0đ / TTS.
- Hồ sơ container bố trí lại nhóm A/B/C và 2 cột cho từng bộ phận (CR-07).
- Mỗi lượt lưu bãi là một bản ghi riêng; lượt đã OUT được giữ lại.
- Nhập tàu / Xuất tàu thành màn hình chờ (không ghi dữ liệu) theo DEC-038.

### Fixed
- `npm run build` lỗi TypeScript ở `ReportsWorkspace` (`releaseBookings`).
- Container đã OUT có thể bị "giải phóng" về tồn bãi.
- Hồ sơ Hạ vỏ đã hủy vẫn có thể GATE IN OK; hai hồ sơ đang mở cho cùng số container.
- Lập lệnh cấp vỏ tự tạo booking với số lượng gán cứng 5.
- Danh sách cấp vỏ hiển thị container còn chờ vệ sinh.
- Mã hồ sơ / phiếu sinh theo số lượng bản ghi hoặc `Date.now()` có thể trùng.
- Phí Hạ vỏ gán cứng 1.150.000 / 850.000đ; dữ liệu "giả" dự phòng trong hồ sơ.
- Xóa Block đang có container tồn bãi.

### Removed
- Menu HẠ SỬA CHỮA, HẠ KỆ GIÁM ĐỊNH (thay bằng Đảo chuyển); ba mục báo cáo TỒN VỎ / HẠ VỎ / CẤP VỎ.
- 5 file giao diện không được sử dụng: `BookingGateOutFeature`, `GateInFeature`, `PaymentsFeature`, `ServicesFeature`, `ReportsAuditFeature`.

### Added (bổ sung 2026-10-22)
- Giờ công sửa chữa (Báo giá), danh mục Tổ sửa chữa, chọn tổ + nhân viên khi hoàn tất sửa chữa, báo cáo Sửa chữa chi tiết, số xe + SĐT lái xe ở Xe nâng – Chờ cấp vỏ, bỏ nhãn "Mới nhất" ở Giám định (DEC-041 → 044).

### Added (bổ sung 2026-10-22, đợt 3)
- Báo cáo Hạ vỏ; Danh mục USER - PHÂN QUYỀN; vai trò QC SỬA CHỮA; menu giới hạn theo vai trò; đổi nhãn Danh mục Container / Sửa chữa (DEC-045, DEC-046).

### Changed (bổ sung 2026-10-22, đợt 4)
- Bỏ vai trò Kế toán (Văn phòng tạo phiếu thu TTT, xác nhận tiền mặt); gộp nhân viên cổng / hiện trường vào Giám định; dữ liệu cũ tự quy đổi (DEC-047).
- Sửa chữa hoàn tất → Chờ nghiệm thu; thêm menu QC sửa chữa → Chờ nghiệm thu, QC nghiệm thu đạt → AV (DEC-047).
- Danh mục Sửa chữa: thêm user Sửa chữa có sẵn vào tổ (DEC-048).

### Changed (bổ sung 2026-10-22, đợt 5)
- Bỏ vai trò và menu QC Sửa chữa — Sửa chữa hoàn tất chuyển AV (DEC-049).
- Xe nâng → Đảo chuyển tối ưu cho điện thoại.
- Giám định → Hạ vỏ: tiêu đề đơn giản đồng bộ các màn mobile.
- Kiểm thử: 42/42 test pass, build PASS.

### Pending
- Database Supabase (viết lại migration, RPC, RLS, pgTAP) — kiểm tra quyền và khóa container ở database.
- Câu hỏi còn mở: OPEN-001, 002, 003, 005, 006, 008; Q-034 (định dạng Excel). Xem `devs/PROGRESS.md` mục A.

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
