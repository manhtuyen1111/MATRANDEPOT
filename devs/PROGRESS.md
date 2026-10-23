# PROGRESS — Theo dõi tiến độ MATRAN DEPOT

> Agent cập nhật file này sau mỗi việc (skill `matran-docs-sync`). Bạn chỉ cần đọc mục A, B và F.
> Ký hiệu: ✅ Xong • 🔄 Đang làm • ⏸ Chờ bạn • ⏳ Chưa làm • ❌ Lỗi

Cập nhật lần cuối: 2026-10-23 — Claude Code
Trạng thái chung: **GĐ 3 xong** (nhánh `feature/cr-2026-10-batch1` đã push). Hôm nay (nhánh `agent/claude/p4-prep-xlsx`): Excel .xlsx; phiếu thu ghi tác nghiệp; K80 có lộ trình + Trả chứng từ; thời gian dd/MM/yyyy HH:mm:ss; Xuất Excel mọi báo cáo. **GĐ 4 Database chờ bạn gửi danh mục trạng thái.**
Kiểm thử mới nhất: `npm test` **60/60 pass** • `npm run build` **PASS** • chưa kiểm thử thao tác trên trình duyệt • chưa có database.

## A. CẦN BẠN QUYẾT ĐỊNH
| # | Nội dung | Ảnh hưởng |
|---|---|---|
| 1 | Nhánh `agent/claude/p4-prep-xlsx` **đã push lên GitHub** (2026-10-23, gồm DEC-050 → DEC-065). Tạo Pull Request và merge vào `main` khi bạn đã thử xong | https://github.com/manhtuyen1111/MATRANDEPOT/pull/new/agent/claude/p4-prep-xlsx |
| 5 | Tối ưu dữ liệu lớn (5–10 năm, ~10.000 hồ sơ/tháng): chốt **giới hạn 1 lần lọc báo cáo** (đề xuất 3 tháng), **ngưỡng xuất Excel phía máy chủ** (đề xuất 20.000 dòng), **thời gian lưu** (đề xuất 10 năm) | Ghi thành DEC-066 khi làm P4-01 |
| 2 | **OPEN-003: gửi danh mục TRẠNG THÁI chính thức** (container, Hạ vỏ, Cấp vỏ, vệ sinh, sửa chữa, booking, thanh toán). Block: Admin tự cấu hình (đã chốt DEC-050) | **Chặn P4-01 Database** |
| 3 | OPEN-008: quy trình hoàn tiền / hủy lệnh cấp đã thu phí | Hiện đang chặn hủy |
| 4 | OPEN-004 còn lại: ai được hủy Hạ vỏ / Cấp vỏ đã hoàn tất; Quản lý có làm thay Báo giá / Sửa chữa không | Quyền hủy, ngoại lệ |

## B. VIỆC TIẾP THEO (đề xuất theo thứ tự)
| Mã | Việc | Giao cho | Ghi chú |
|---|---|---|---|
| P3-T | Bạn chạy `npm run dev`, thử các luồng ở mục F, báo lỗi | Bạn | Agent chưa thử được trên trình duyệt |
| P4-01 | Viết lại schema Supabase (bảng, bộ đếm mã, RLS, **index theo bộ lọc, phân trang con trỏ, partition nhật ký**) | Claude Code | ⏸ Chờ danh mục trạng thái (A.2) + A.5 |
| P4-02 | RPC Hạ vỏ + thanh toán + pgTAP | Claude Code | Sau P4-01 |
| UI-01 | Rà soát giao diện mobile các màn hiện trường | Antigravity | Không đụng `src/services/` |

## C. LOGIC ĐÃ CHỐT (tóm tắt — chi tiết ở `docs/DECISIONS.md`)
| Chủ đề | Quy tắc | DEC |
|---|---|---|
| Vai trò | **8 vai trò**: Giám định, Văn phòng, Xe nâng, Vệ sinh, Báo giá, Quản lý, Admin, Sửa chữa. Bỏ Kế toán (Văn phòng thay), nhân viên cổng/hiện trường = Giám định, **bỏ QC Sửa chữa** | 045, 047, 049 |
| Menu | Mỗi vai trò chỉ thấy màn của mình; Văn phòng / Quản lý thấy khối văn phòng, báo cáo, danh mục (xem); Admin thấy tất cả | 045 |
| User | Danh mục chung → User - Phân quyền (Admin): thêm, sửa vai trò, khóa; luôn còn ≥ 1 Admin | 045 |
| Hạ vỏ | Giám định (mobile; được xóa hồ sơ khi Văn phòng chưa thao tác) → Văn phòng (số cont trùng Tồn vỏ bị chặn ngay khi nhập; SĐT lái xe, khách hàng, chi phí từ biểu giá, TTT/TTS/TTTT) → GATE IN OK → (Vệ sinh nếu có) → Xe nâng hạ vỏ → **Văn phòng trả chứng từ** (in EEIR + phiếu thu) | 020–025, 052, 059, 060 |
| Phiếu K80 | Thông tin chung ở đầu → LỘ TRÌNH các bước (ô ☐ tích tay) → QR; lái xe đi theo thứ tự, quét mã tại từng bộ phận; Văn phòng → Trả chứng từ: 1 ô quét chung, danh sách chờ chia **2 cột HẠ VỎ / CẤP VỎ** (có số lượt) | 052, 064 |
| Thanh toán | TTT trừ dần Phiếu thu mẹ; TTS = công nợ; Tiền mặt / Chuyển khoản mới phát hành phiếu thu `PT-YYYY-NNNNNN` | 031, 032 |
| Phiếu thu | Văn phòng tạo phiếu thu TTT và xác nhận tiền mặt; phiếu thu ghi rõ **tác nghiệp** (Hạ vỏ / Cấp vỏ / Thu trước); hồ sơ container link thẳng về Phiếu thu; **mẫu in thống nhất** (thông tin công ty + tác nghiệp); **đếm số lần in**, in lại phải xác nhận + nhãn BẢN IN LẠI | 032, 047, 051, 062, 063 |
| DAMAGE | Báo giá (remark + giờ công) → Sửa chữa (chọn tổ, mặc định chọn hết nhân viên) → **AV** (không có QC) | 040–043, 049 |
| Tổ sửa chữa | Danh mục chung → Sửa chữa: thêm tổ; thêm **user Sửa chữa có sẵn** hoặc nhập tên; ngưng thay vì xóa | 042, 048 |
| Danh mục Công ty | Admin cấu hình tên, MST, địa chỉ, ĐT, email, TK ngân hàng — in ở đầu phiếu thu / EEIR / K80 | 062 |
| Cấp vỏ | Nhập booking (tự đếm), chọn cont (AV mặc định, DAMAGE được), số xe + SĐT, chi phí, thanh toán tại Văn phòng → Xe nâng OUT (khung nổi số cont, size/type, vị trí) → **Văn phòng trả chứng từ** | 027, 033, 034, 052, 061 |
| Vị trí / Khóa | Đảo chuyển (Xe nâng, có lịch sử); Sửa vị trí (Văn phòng, không lịch sử); **Khóa bắt buộc ghi Remark Văn phòng**; cont khóa vẫn hiện ở Cấp vỏ (chỉ icon khóa, có cột Ghi chú văn phòng) nhưng phải mở khóa trước khi cấp; Tồn vỏ có Xuất Excel; Block do Admin cấu hình | 030, 036, 050, 065 |
| Mã hồ sơ / QR | `IN-YYMMDD-NNN`, `OUT-YYMMDD-NNN` do hệ thống cấp; QR phiếu K80 = `QR-<mã hồ sơ>` (duy nhất), **đóng sau khi trả chứng từ** | 037, 057 |
| Hồ sơ container | Đầu: thông tin container (số cont lớn) → các bộ phận theo thứ tự, xác nhận ✓ HOÀN THÀNH bên phải → **Thanh toán 1 mục riêng dưới Văn phòng**, link phiếu thu | 058 |
| Báo cáo | Hạ vỏ, Cấp vỏ, Nhập tàu, Xuất tàu, Sửa chữa chi tiết, Tổng hợp 5 sheet — bắt buộc lọc, phân trang; **Xuất Excel .xlsx theo bộ lọc** ở mọi báo cáo + Phiếu thu | 044, 046, 050, 055 |
| Thời gian | Toàn app **dd/MM/yyyy HH:mm:ss** (hiển thị, bộ lọc, in, Excel); bộ lọc mặc định **1 ngày trước → hiện tại** | 054, 056 |
| Mobile | Giám định – Hạ vỏ, Vệ sinh, Xe nâng (Chờ hạ vỏ / Chờ cấp vỏ / **Đảo chuyển**), Sửa chữa: khung mobile, biểu tượng điện thoại trên menu; Xe nâng quét mã: khung nền đậm thống nhất (số cont, size/type, trạng thái/đóng hàng hoặc vị trí) | 012, 049, 061 |
| Nhập / Xuất tàu | Để giai đoạn sau | 038 |

## D. ĐÃ HOÀN THÀNH
| Mã | Việc | Ngày | Kết quả | Kiểm thử | Nhánh |
|---|---|---|---|---|---|
| P0 | Khảo sát repo | 2026-10-22 | Báo cáo khảo sát | — | — |
| P1 | Quy tắc nghiệp vụ DEC-018 → 040 | 2026-10-22 | `docs/DECISIONS.md` | Đối chiếu code | feature/cr-2026-10-batch1 |
| P2 | Harness: AGENTS, CLAUDE, settings, 6 skill, docs/agents, devs/ | 2026-10-22 | Đủ file | settings.json hợp lệ | feature/cr-2026-10-batch1 |
| P3 | CR-01 → CR-09 (Demo) + sửa lỗi cũ | 2026-10-22 | Xem `docs/CHANGELOG.md` 0.4.0 | 34/34 • build PASS | feature/cr-2026-10-batch1 |
| P3-a | Báo giá chỉ cần remark → Chờ sửa chữa | 2026-10-22 | DEC-040 | pass | feature/cr-2026-10-batch1 |
| P3-b | Biểu tượng điện thoại cho tác nghiệp mobile | 2026-10-22 | Menu + nhãn Mobile | smoke test đếm icon | feature/cr-2026-10-batch1 |
| P3-c | Màn Giám định – Hạ vỏ hiển thị khung mobile | 2026-10-22 | max-w-lg, nút (+) bám khung | build PASS | feature/cr-2026-10-batch1 |
| P3-d | Giờ công, Tổ sửa chữa, chọn nhân viên, BC Sửa chữa chi tiết, số xe/SĐT ở Chờ cấp vỏ, bỏ "Mới nhất" | 2026-10-22 | DEC-041 → 044 | 35/35 | feature/cr-2026-10-batch1 |
| P3-e | Báo cáo Hạ vỏ, User - Phân quyền, menu theo vai trò, đổi nhãn danh mục | 2026-10-22 | DEC-045, 046 | 38/38 | feature/cr-2026-10-batch1 |
| P3-f | Bỏ Kế toán (Văn phòng thay), gộp Cổng/Hiện trường vào Giám định, **QC nghiệm thu** (menu Chờ nghiệm thu), **thêm user có sẵn vào tổ sửa chữa** | 2026-10-22 | DEC-047, 048 | **41/41 • build PASS** | feature/cr-2026-10-batch1 |
| P3-g | **Bỏ vai trò + menu QC Sửa chữa** (Sửa chữa xong → AV); **Đảo chuyển tối ưu mobile** (thẻ, chọn ở trên cùng, Xem thêm, lịch sử thu gọn); thêm Lưu ý chung vào AGENTS.md | 2026-10-22 | DEC-049 | **42/42 • build PASS** | feature/cr-2026-10-batch1 |
| P3-h | Tiêu đề Giám định – Hạ vỏ đồng bộ đơn giản như các màn mobile khác (Bộ phận • tên màn • số đang chờ) | 2026-10-22 | — | 42/42 • build PASS | feature/cr-2026-10-batch1 |
| P4-pre | Xuất Excel .xlsx chuẩn (exceljs, tải khi cần); chốt Block do Admin cấu hình | 2026-10-23 | DEC-050 | **43/43 • build PASS** | agent/claude/p4-prep-xlsx |
| P4-pre2 | Phiếu thu ghi rõ tác nghiệp + lọc; hồ sơ container: khung Thu tiền nổi bật, link về Văn phòng → Phiếu thu | 2026-10-23 | DEC-051 | **45/45 • build PASS** | agent/claude/p4-prep-xlsx |
| P4-pre3 | Phiếu K80 có LỘ TRÌNH; menu Văn phòng → Trả chứng từ (quét QR → in EEIR + phiếu thu); Xe nâng – Chờ cấp vỏ nổi số cont + vị trí | 2026-10-23 | DEC-052, 053 | **48/48 • build PASS** | agent/claude/p4-prep-xlsx |
| P4-pre4 | Thời gian thống nhất dd/MM/yyyy HH:mm:ss (ô nhập chuẩn cho mọi bộ lọc); nút Xuất Excel theo bộ lọc ở Phiếu thu + mọi báo cáo | 2026-10-23 | DEC-054, 055 | **50/50 • build PASS** | agent/claude/p4-prep-xlsx |
| P4-pre5 | Bộ lọc thời gian mặc định 1 ngày trước → hiện tại (Phiếu thu + mọi báo cáo) | 2026-10-23 | DEC-056 | **52/52 • build PASS** | agent/claude/p4-prep-xlsx |
| P4-pre6 | **Sửa lỗi QR trùng** (QR theo mã hồ sơ, đóng sau trả chứng từ); hồ sơ container cấu trúc thống nhất Hạ vỏ – Cấp vỏ | 2026-10-23 | DEC-057, 058 | **53/53 • build PASS** | agent/claude/p4-prep-xlsx |
| P4-pre7 | Giám định xóa hồ sơ khi Văn phòng chưa thao tác; Văn phòng Hạ vỏ báo + chặn trùng Tồn vỏ ngay khi nhập số cont | 2026-10-23 | DEC-059, 060 | **56/56 • build PASS** | agent/claude/p4-prep-xlsx |
| P4-pre8 | Xe nâng Chờ hạ vỏ / Chờ cấp vỏ: khung nổi bật thống nhất, bỏ dòng trùng, tối ưu mobile | 2026-10-23 | DEC-061 | 56/56 • build PASS; **chưa test hiển thị sau khi quét** (cần thử trên điện thoại) | agent/claude/p4-prep-xlsx |
| P4-pre9 | Trả chứng từ 2 phần Hạ vỏ / Cấp vỏ; mẫu in phiếu thu thống nhất + thông tin công ty; đếm số lần in phiếu thu; Danh mục Công ty | 2026-10-23 | DEC-062, 063, 064 | **59/59 • build PASS**; chưa thử in giấy thật | agent/claude/p4-prep-xlsx |
| P4-pre10 | Khóa = Remark Văn phòng; Cấp vỏ hiện cont khóa (phải mở khóa trước); Excel Tồn vỏ | 2026-10-23 | DEC-065 | **60/60 • build PASS** | agent/claude/p4-prep-xlsx |

## E. TÀI KHOẢN DEMO (đổi ở góc phải)
| User | Vai trò | Màn hình thấy |
|---|---|---|
| Nguyễn Quản Trị | Admin + Quản lý | Tất cả |
| Trần Thị Minh, Đỗ Thị Thu | Văn phòng | Tồn vỏ, Văn phòng (Hạ vỏ / Cấp vỏ / Phiếu thu…), Vệ sinh, Xe nâng, Báo cáo, Danh mục (xem) |
| Lê Hoàng Giám Định | Giám định | Giám định – Hạ vỏ |
| Phạm Hoàng Xe Nâng | Xe nâng | Chờ hạ vỏ, Chờ cấp vỏ, Đảo chuyển |
| Vũ Văn Vệ Sinh | Vệ sinh | Chờ vệ sinh |
| Ngô Thị Báo Giá | Báo giá | Chờ báo giá |
| Đặng Kỹ Thuật Sửa Chữa | Sửa chữa | Chờ sửa chữa |

> Dữ liệu demo cũ trong trình duyệt được tự quy đổi vai trò. Nếu thấy lạ, bấm **Reset demo**.

## F. CÁCH TỰ KIỂM TRA (trên trình duyệt)
Chạy `npm run dev`, đổi người dùng ở góc phải:
1. **Giám định** → (+) tạo hạ vỏ → mã `IN-...`.
2. **Văn phòng** → Hạ vỏ: nhập SĐT lái xe, thêm chi phí, thử TTS / Tiền mặt / Chuyển khoản (bấm "Giả lập ngân hàng").
3. Container có vệ sinh: chưa thấy ở **Xe nâng → Chờ hạ vỏ** cho tới khi **Vệ sinh** xác nhận.
4. DAMAGE: **Báo giá** nhập remark + giờ công → **Sửa chữa** chọn tổ (mặc định chọn hết, bỏ chọn được) → AV.
5. **Admin → Danh mục chung → Sửa chữa**: chọn user Sửa chữa có sẵn để thêm vào tổ. **User - Phân quyền**: thêm user, sửa vai trò, khóa.
6. Đổi sang từng user ở mục E → kiểm tra mỗi người chỉ thấy đúng màn hình của mình.
7. **Tồn vỏ**: Khóa (bắt buộc ghi chú), Sửa vị trí. **Xe nâng → Đảo chuyển** (mở trên điện thoại hoặc thu nhỏ trình duyệt): tìm cont, lọc Chờ sửa chữa, chọn thẻ → vị trí mới.
8. **Văn phòng → Cấp vỏ**: booking, chọn cont, số xe + SĐT, chi phí, thanh toán → xem phiếu K80 (lộ trình) → **Xe nâng → Chờ cấp vỏ** (khung đậm số cont + vị trí, số xe, SĐT) → OUT → **Văn phòng → Trả chứng từ** quét mã → in EEIR (+ phiếu thu).
9. **Văn phòng → Phiếu thu**: tạo phiếu thu TTT tiền mặt → xác nhận → mã `PT-...`, cột **Tác nghiệp**. Mở hồ sơ một container đã thu tiền → bấm link phiếu thu trong khung "Thu tiền" → nhảy thẳng tới phiếu đó.
   - Bấm **In phiếu thu** 2 lần → lần 2 phải xác nhận "In lại", bản in có nhãn BẢN IN LẠI, cột **Đã in** tăng.
   - **Admin → Danh mục chung → Công ty**: nhập thông tin → in lại phiếu thu thấy thông tin công ty ở đầu.
10. **Báo cáo** + **Phiếu thu**: nhập thời gian dạng 23/10/2026 00:00:00 (gõ số liên tục cũng được) → Tra cứu → **Xuất Excel** (toàn bộ kết quả lọc).

## G. NHẬT KÝ CẬP NHẬT
- 2026-10-22 — Claude Code: tạo file; ghi P0 → P3-e.
- 2026-10-22 — Claude Code: P3-f (DEC-047, 048); thêm mục C (logic đã chốt) và E (tài khoản demo).
- 2026-10-22 — Claude Code: P3-g (DEC-049) — bỏ QC, Đảo chuyển mobile, thêm "Lưu ý chung" (AGENTS.md mục 8).
- 2026-10-22 — Claude Code: P3-h (tiêu đề Giám định – Hạ vỏ); đồng bộ ROADMAP, ACCEPTANCE_TESTS, CHANGELOG, README với kết quả 42/42.
- 2026-10-22 — Claude Code: commit 4 nhóm (services / ui / docs / harness) và push nhánh lên GitHub. Chưa merge `main`.
- 2026-10-23 — Claude Code: P4-pre (DEC-050) — Excel .xlsx; chờ danh mục trạng thái để làm P4-01.
- 2026-10-23 — Claude Code: P4-pre2 (DEC-051) — tác nghiệp trên phiếu thu, link từ hồ sơ.
- 2026-10-23 — Claude Code: P4-pre3 (DEC-052, 053) — K80 lộ trình, Trả chứng từ, nổi số cont ở Chờ cấp vỏ.
- 2026-10-23 — Claude Code: P4-pre4 (DEC-054, 055) — định dạng thời gian thống nhất, Xuất Excel mọi báo cáo + Phiếu thu.
- 2026-10-23 — Claude Code: P4-pre5 (DEC-056) — mặc định bộ lọc 24 giờ gần nhất.
- 2026-10-23 — Claude Code: P4-pre6 (DEC-057, 058) — QR duy nhất + đóng mã; hồ sơ container thống nhất.
- 2026-10-23 — Claude Code: P4-pre7 (DEC-059, 060).
- 2026-10-23 — Claude Code: P4-pre8 (DEC-061) — khung nổi bật Xe nâng.
- 2026-10-23 — Claude Code: P4-pre9 (DEC-062, 063, 064).
- 2026-10-23 — Claude Code: P4-pre10 (DEC-065).
- 2026-10-23 — Claude Code: Cấp vỏ — chỉ icon khóa, thêm cột Ghi chú văn phòng (DEC-065).
- 2026-10-23 — Claude Code: cập nhật tiến độ chung; push nhánh agent/claude/p4-prep-xlsx lên GitHub.
- 2026-10-23 — Claude Code: Trả chứng từ 1 ô quét, danh sách chờ 2 cột Hạ vỏ / Cấp vỏ (DEC-064 sửa). 60/60 • build PASS.
- 2026-10-23 — Claude Code: Tồn vỏ — thao tác dạng sổ xuống (UI). 60/60 • build PASS.
- 2026-10-23 — Claude Code: Tồn vỏ — Thao tác chỉ Khóa / Mở khóa; bút sửa vị trí ở cột Vị trí. 60/60 • build PASS.
