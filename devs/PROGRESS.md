# PROGRESS — Theo dõi tiến độ MATRAN DEPOT

> Agent cập nhật file này sau mỗi việc (skill `matran-docs-sync`). Bạn chỉ cần đọc mục A, B và F.
> Ký hiệu: ✅ Xong • 🔄 Đang làm • ⏸ Chờ bạn • ⏳ Chưa làm • ❌ Lỗi

Cập nhật lần cuối: 2026-10-27 (tối) — Claude Code
Trạng thái chung (cập nhật 2026-10-27): **GĐ 4 Database ĐANG LÀM** trên nhánh **`agent/claude/p4-database`** (DEC-149 → DEC-153, đã push): Supabase Singapore; thiết kế `docs/DATABASE_SCHEMA.md` đã duyệt; **toàn bộ migration (5 bước + app_support + đồng bộ) + Edge Function xong, chạy thử trên Supabase local (Docker) — pgTAP 180/180, Edge Function 16/16**; **nối app với database N1 → N8 xong phần code** (docs/APP_DB_INTEGRATION.md): đăng nhập, ghi qua hàng chờ RPC, báo cáo theo khoảng lọc (DEC-157), dữ liệu làm việc 7 ngày + chỉ tải phần thay đổi + báo mất mạng (DEC-158), ảnh giữ 2 tháng (DEC-159), Nhập tàu không chụp ảnh (DEC-156) — chạy thật toàn luồng trên local pass; **tiếp theo: bạn thử tay toàn bộ trên database → reset → import tồn vỏ ban đầu (Q-044)**. Bản Demo trước database lưu ở tag `demo-truoc-database-2026-10-26` / nhánh `backup/demo-truoc-database`. — Trước đó: nhánh **`agent/claude/ui-design-v2`** (chứa toàn bộ `agent/claude/p4-prep-xlsx` + DEC-142 → **DEC-148**), **đã push đầy đủ lên GitHub 2026-10-26**, chưa merge vào `main`. Ngày 26/10 (tối): **giao diện mới v2** navy + Be Vietnam Pro, chuẩn ở `docs/DESIGN_SYSTEM.md` (145); bảng chi tiết tàu không gộp cột (146); **W-SURVEY (LÊN KỆ)** + giám định bổ sung trên kệ (147); **dữ liệu test** MSK / 10 khách / công ty MATRAN / biểu giá mới + danh sách lớn (148); hoàn tác đăng nhập Demo, quy tắc tài khoản để GĐ 4 (143, 144). Ngày 25/10: phiếu thu TT / TTR / TTS + mã `PT-TT-` / `PT-TTR-` (097 → 100, 103); Tồn vỏ cột Hình thức TT + MÃ PHIẾU THU có link (099, 104, 105); lọc nhanh thời gian (102); Phiếu thu bỏ chứng từ (107); **dữ liệu test đầy đủ + nút Nạp / Xóa dữ liệu** (106, 108); **Hạ kệ giám định** (109); **Xem trước chứng từ** (110); **xuất hóa đơn từ phiếu thu**: mã bảo mật 12 ký tự, trang khách `#/hoa-don`, trạng thái CHƯA / YÊU CẦU / ĐÃ XHD, **thêm lại vai trò Kế toán**, người thu tiền luôn là nhân viên (111 → 114); **Đảo chuyển mobile 2 dòng**, bỏ ghi chú tác nghiệp (115, 116); **ô nhập mobile chữ 16px** (không tự phóng to vỡ khung — 116); **mọi mã có hồ sơ đều là link, cùng kiểu Mã hồ sơ** (117, 118). Ngày 26/10: **bỏ mã CT-** (số chứng từ = mã hồ sơ — 119); **Góp ý** (nút góc phải + Báo cáo → Góp ý chỉ Admin — 120, 123); phiếu thu trả trước **một mã PT-TTR-** (bỏ PTT- — 124), cột Mã hồ sơ chỉ tóm tắt (121, 122), **hóa đơn theo từng lượt, khách tự gộp** (130); **chọn vị trí từng bước** (125); báo cáo Hạ / Cấp vỏ có Thanh toán + Mã phiếu thu, bỏ ký hiệu (126, 127); Tồn vỏ Phân loại / AGE / Tiến độ, **mỗi cont 1 dòng**, Excel khớp màn hình (128, 129, 132); **Xuất tàu tự khóa + ghi chú, duyệt tàu khi chưa đủ** (131). Ngày 24/10 (phiên 2): EEIR Nhập / Xuất tàu (081); form Giám định dùng chung (UI-02); **vị trí theo cấu hình Block, chỉ chặn trùng khi đủ 4 phần** (082, 087); nhãn + ô tác nghiệp ở Vệ sinh / Xe nâng, số cont thẳng cột (083, 085, 089); **Báo giá**: bảng như Tồn vỏ, 2 bước cập nhật → xác nhận, hàng loạt (084, 086, 088); **Đảo chuyển** gọn: ô trạng thái, vị trí thẳng cột, tiến độ, ghi chú (090 → 096); **khách hàng gõ tay + gợi ý** (093). Tư vấn database: `docs/DATABASE_PLATFORM_ADVICE.md`.

**Điểm dừng 2026-10-27 (tối):** nhánh `agent/claude/p4-database` (HEAD `ca46c39`, đã push). **Đọc mục I.5 trước khi làm việc tiếp theo.** (Quyết định tạm hoãn GĐ 4 ngày 25/10 đã được mở lại bằng DEC-149.)
Kiểm thử mới nhất (2026-10-27): `npm test` **163 pass, 3 bỏ qua** (test chạy thật cần Supabase local — chạy riêng: pass) • `npm run build` **PASS** • pgTAP 180/180, Edge Function 16/16 (local) • đo tốc độ 45.000 lượt: mở app 6,8 giây, đồng bộ ~2 KB • chưa thử tay trên trình duyệt ở chế độ database.

## A. CẦN BẠN QUYẾT ĐỊNH
| # | Nội dung | Ảnh hưởng |
|---|---|---|
| 1 | Nhánh **`agent/claude/ui-design-v2`** **đã push đầy đủ** (DEC-050 → DEC-148, 2026-10-26 — bao gồm cả `p4-prep-xlsx`). **Thử trên trình duyệt + in giấy thật** (mục F → F5) rồi tạo Pull Request merge vào `main` | https://github.com/manhtuyen1111/MATRANDEPOT/pull/new/agent/claude/ui-design-v2 |
| 1a | ~~Sửa tên hạng mục vệ sinh trong dữ liệu test~~ — đã sửa 2026-10-27 (người dùng đồng ý) | — |
| 1b | ~~Q-042~~ — đã chốt: W-SURVEY không cấp vỏ (DEC-150) | — |
| 1c | Tên thật 10 khách hàng test (đang để "Khách hàng 01…10"); phí rác cont 40 dùng LV1 hay LV2 (đang LV1) | Chỉ dữ liệu test |
| 2 | **OPEN-003: gửi danh mục TRẠNG THÁI chính thức** (container, Hạ vỏ, Cấp vỏ, vệ sinh, sửa chữa, booking, thanh toán). Block: Admin tự cấu hình (đã chốt DEC-050) | **Chặn P4-01 Database** |
| 3 | OPEN-008: quy trình hoàn tiền / hủy lệnh cấp đã thu phí | Hiện đang chặn hủy |
| 4 | OPEN-004 còn lại: ai được hủy Hạ vỏ / Cấp vỏ đã hoàn tất; Quản lý có làm thay Báo giá / Sửa chữa không | Quyền hủy, ngoại lệ |
| 5 | Điểm A.5 đã xác nhận 2026-10-24 (a, b, d, e đúng; f đã làm — DEC-081). **Còn (c)**: sắp xếp danh sách tàu theo size trước (20 → 40) rồi số cont A→Z — đúng chưa? | Đổi được nhanh nếu bạn muốn khác |
| 6 | **Nền tảng database (Q-040)**: đề xuất **Supabase vùng Singapore, gói Pro + PITR, 3 môi trường dev / staging / production**; hỏi pháp chế có bắt buộc lưu dữ liệu tại Việt Nam không (nếu có → Postgres trên cloud VN, lược đồ dùng lại được). **Sao lưu (Q-039)**: PITR 7 ngày + dump mã hóa hằng đêm ra kho ngoài + diễn tập khôi phục mỗi quý. Còn Q-037 (ảnh), Q-038 (số người dùng cùng lúc) | ⏸ **Tạm hoãn theo quyết định 2026-10-25** — trả lời khi muốn mở GĐ 4. Chi tiết `docs/DATABASE_PLATFORM_ADVICE.md` |

## B. VIỆC TIẾP THEO (đề xuất theo thứ tự)
| Mã | Việc | Giao cho | Ghi chú |
|---|---|---|---|
| P3-T | Bạn chạy `npm run dev`, thử các luồng ở mục F + F2 (**Tồn vỏ hàng loạt, Nhập / Xuất tàu, in EEIR + phiếu thu A4, phiếu thu trước, chi tiết trượt phải**), **in thử giấy thật**, báo lỗi | Bạn | Agent chưa thử được trên trình duyệt |
| P4-01 | Viết lại schema Supabase (bảng, bộ đếm mã, RLS, **index theo bộ lọc, phân trang con trỏ, partition nhật ký**) | Claude Code | ⏸ **Tạm hoãn (2026-10-25)** — người dùng test Demo trước; khi mở lại chờ A.2 (trạng thái) + A.6 (nền tảng); làm theo DEC-066 (DATABASE_CONTRACT mục 10) + DATABASE_PLATFORM_ADVICE (11 tình huống vận hành) |
| P4-02 | RPC Hạ vỏ + thanh toán + pgTAP | Claude Code | Sau P4-01 |
| P7-DB | Bảng `vessel_lists` / `vessel_list_items` + RPC Nhập tàu / Xuất tàu (DATABASE_CONTRACT mục 8) | Claude Code | Làm cùng P4-01 |
| UI-01 | Rà soát giao diện mobile các màn hiện trường | Antigravity | Không đụng `src/services/` |
| DB-OPS | Dựng staging, tác vụ dump hằng đêm ra kho ngoài, diễn tập khôi phục lần đầu | Bạn + Claude Code | Sau khi chốt A.6; agent chỉ viết script / hướng dẫn, bạn tạo project và giữ khóa |

## C. LOGIC ĐÃ CHỐT (tóm tắt — chi tiết ở `docs/DECISIONS.md`)
| Chủ đề | Quy tắc | DEC |
|---|---|---|
| Vai trò | **8 vai trò**: Giám định, Văn phòng, Xe nâng, Vệ sinh, Báo giá, Quản lý, Admin, Sửa chữa. Bỏ Kế toán (Văn phòng thay), nhân viên cổng/hiện trường = Giám định, **bỏ QC Sửa chữa** | 045, 047, 049 |
| Menu | Mỗi vai trò chỉ thấy màn của mình; Văn phòng / Quản lý thấy khối văn phòng, báo cáo, danh mục (xem); Admin thấy tất cả | 045 |
| User | Danh mục chung → User - Phân quyền (Admin): thêm, sửa vai trò, khóa; luôn còn ≥ 1 Admin | 045 |
| Hạ vỏ | Giám định (mobile; được xóa hồ sơ khi Văn phòng chưa thao tác) → Văn phòng (số cont trùng Tồn vỏ bị chặn ngay khi nhập; SĐT lái xe, khách hàng, chi phí từ biểu giá, TTT/TTS/TTTT) → GATE IN OK → (Vệ sinh nếu có) → Xe nâng hạ vỏ → **Văn phòng trả chứng từ** (in EEIR + phiếu thu) | 020–025, 052, 059, 060 |
| Phiếu K80 | Thông tin chung ở đầu → LỘ TRÌNH các bước (ô ☐ tích tay) → QR; lái xe đi theo thứ tự, quét mã tại từng bộ phận; Văn phòng → Trả chứng từ: 1 ô quét chung, danh sách chờ chia **2 cột HẠ VỎ / CẤP VỎ** (có số lượt) | 052, 064 |
| Thanh toán | **TT — TRỰC TIẾP** (đứng đầu, chọn sẵn) / **TTR — TRẢ TRƯỚC** / **TTS — THANH TOÁN SAU** (DEC-097, 100). Chỉ TT mới phát hành phiếu thu `PT-TT-YYMMDD-NNNN`; nạp trước dùng `PT-TTR-…`; TTS chỉ có `CT-`. Tồn vỏ có cột Hình thức TT + MÃ PHIẾU THU, TTS để trống, không hiện chứng từ (098, 099, 104) | 031, 032, 098–100 |
| Phiếu thu | Văn phòng tạo phiếu thu TTT và xác nhận tiền mặt; phiếu thu ghi rõ **tác nghiệp** (Hạ vỏ / Cấp vỏ / Thu trước); hồ sơ container link thẳng về Phiếu thu; **mẫu in thống nhất** (thông tin công ty + tác nghiệp); **đếm số lần in**, in lại phải xác nhận + nhãn BẢN IN LẠI ; **EEIR cùng khung với phiếu thu**, in từ hồ sơ (In EEIR / In EEIR + phiếu thu) ; nút **Tạo phiếu thu TTT** cùng hàng Tra cứu; **in EEIR + phiếu thu = 1 tờ A4** (mỗi phiếu A5), EEIR ghi tình trạng vỏ Giám định ; danh sách full chiều ngang; **phiếu thu trước**: Khách hàng → Chi phí (**biểu giá × số lượng**) → Hình thức; in **PHIẾU THU TRƯỚC (TTT)** có khung PTT- nổi bật ; phiếu thu trả trước hiện **số lượt đã dùng / còn lại** + bảng từng lần trừ (chứng từ, hồ sơ) | 032, 047, 051, 062, 063, 072, 076, 077, 079 |
| DAMAGE | Báo giá (**cập nhật tình trạng sửa chữa + giờ công → xác nhận chờ sửa chữa**, DEC-086) → Sửa chữa (chọn tổ, mặc định chọn hết nhân viên) → **AV** (không có QC) | 040–043, 049 |
| Tổ sửa chữa | Danh mục chung → Sửa chữa: thêm tổ; thêm **user Sửa chữa có sẵn** hoặc nhập tên; ngưng thay vì xóa | 042, 048 |
| Danh mục Công ty | Admin cấu hình tên, MST, địa chỉ, ĐT, email, TK ngân hàng — in ở đầu phiếu thu / EEIR / K80 | 062 |
| Cấp vỏ | Nhập booking (tự đếm), chọn cont (AV mặc định, DAMAGE được), số xe + SĐT, chi phí, thanh toán tại Văn phòng → Xe nâng OUT (khung nổi số cont, size/type, vị trí) → **Văn phòng trả chứng từ** | 027, 033, 034, 052, 061 |
| Vị trí / Khóa / Tồn vỏ | **Vị trí theo cấu hình Block thực tế** (mã BLOCK-…, chiều Bay/Row/Tier để trống = không dùng, có cấu hình thì bắt buộc đủ, **chỉ chặn trùng khi đủ Block – Bay – Row – Tier**, thiếu chiều thì nhiều cont chung 1 vị trí — DEC-082, 087); Đảo chuyển (Xe nâng, có lịch sử); Sửa vị trí = bút ở cột Vị trí (Văn phòng, không lịch sử); **Khóa tại icon cạnh số cont** (đỏ = khóa, xám mờ = không), bắt buộc ghi chú → ghi vào cột **GHI CHÚ** (nền vàng); không có cột Thao tác; cột **DATE IN** (giữa Hãng tàu và Trạng thái) và **LƯU BÃI** = số ngày từ gate in (ngày hạ = 0); **tìm / khóa / ghi chú hàng loạt**; cont khóa vẫn hiện ở Cấp vỏ nhưng phải mở khóa trước; Excel Tồn vỏ đủ cột; Block do Admin cấu hình | 030, 036, 050, 065, 067, 074, 082 |
| Mã hồ sơ / QR | Ký tự đầu = tác nghiệp: **HV-** Hạ vỏ, **CV-** Cấp vỏ, **NT-** Nhập tàu, **XT-** Xuất tàu (`XX-YYMMDD-NNN`), **PT-** Phiếu thu, **PTT-** Phiếu thu trước (`XX-YYYY-…`); mã cũ IN- / OUT- / PTM- tự đổi khi nạp; QR K80 = `QR-<mã hồ sơ>` (duy nhất), **đóng sau khi trả chứng từ** | 037, 057, 068 |
| Hồ sơ container | Đầu: thông tin container (số cont lớn) → các bộ phận theo thứ tự, xác nhận ✓ HOÀN THÀNH bên phải → **Thanh toán 1 mục riêng dưới Văn phòng**, link phiếu thu | 058 |
| Báo cáo | Hạ vỏ, Cấp vỏ, Nhập tàu, Xuất tàu, Sửa chữa chi tiết, Tổng hợp 5 sheet — bắt buộc lọc, phân trang; **Xuất Excel .xlsx theo bộ lọc** ở mọi báo cáo + Phiếu thu ; **chi tiết mở cửa sổ trượt bên phải, chọn 20 / 50 / 100 dòng** (docs/UI_DATA_LIST_STANDARD.md) | 044, 046, 050, 055, 080 |
| Thời gian | Toàn app **dd/MM/yyyy HH:mm:ss** (hiển thị, bộ lọc, in, Excel); bộ lọc mặc định **1 ngày trước → hiện tại** | 054, 056 |
| Mobile | **10 màn**: Giám định – Hạ vỏ / Nhập tàu / Xuất tàu, Vệ sinh – Chờ vệ sinh (gồm cont Nhập tàu), Xe nâng (Chờ hạ vỏ / Chờ cấp vỏ / Đảo chuyển / Nhập tàu / Xuất tàu), Sửa chữa: khung mobile, biểu tượng điện thoại trên menu; Xe nâng quét mã: khung nền đậm thống nhất (số cont, size/type, trạng thái/đóng hàng hoặc vị trí) | 012, 049, 061 |
| Dữ liệu lớn | Lọc báo cáo tối đa **3 tháng**; Excel > **20.000 dòng** xuất phía máy chủ; giữ dữ liệu **10 năm**, không xóa; lọc / phân trang trên database | 066 |
| Nhập tàu | Văn phòng lập danh sách (tên tàu, thời gian, **hãng tàu**, số xe, cont – size – type) → **Giám định** xác nhận cont thực tế, chọn xe, DAMAGE/AV, M/K/E, vệ sinh, AGE → mã **NT-** → **Vệ sinh → Chờ vệ sinh** (nếu có, chung hàng chờ Hạ vỏ) → Xe nâng hạ + vị trí → **tồn vỏ ngay, cấp vỏ được**; DAMAGE như Hạ vỏ; hết danh sách → Văn phòng / Quản lý **duyệt**. Không thu phí, không K80 | 069, 070 |
| Xuất tàu | Văn phòng lập danh sách **chọn từ Tồn vỏ** (có **Tìm hàng loạt** như Tồn vỏ — DEC-073) (mọi cont tồn bãi trừ cont khóa / đã lập lệnh cấp / đã trong danh sách khác) → mã **XT-** từng cont, cont không cấp vỏ được → **Giám định / Xe nâng** chọn cont + gán xe → OUT → **duyệt**. Không thu phí, không K80 | 069, 070, 073 |
| Danh sách tàu (Văn phòng) | Màn chính = danh sách đang thực hiện, nút **Lập danh sách** bên phải tiêu đề, bấm dòng → chi tiết; **chưa duyệt** thì sửa thông tin (hãng tàu chỉ đổi khi chưa giám định), thêm cont, bỏ cont chờ, **xóa** (khi chưa tác nghiệp cont nào); cont luôn xếp **size 20 → 40, số cont A→Z**; Giám định / Xe nâng tìm cont lọc ngay khi gõ như Tồn vỏ | 070 |
| Màn hiện trường tàu | Giám định / Xe nâng × Nhập / Xuất tàu dùng 1 mẫu: **tiến độ trên cùng** (xong/tổng, chờ làm, chưa tới lượt, **bạn đã làm**, số cont theo xe), tab **Chờ làm / Đã xong / Tất cả**, thẻ ✓ kèm xe + người + giờ, **gõ trúng cont đã làm → báo, không làm lại**, dải "Vừa xong" ; **menu báo việc chờ màu cam nhấp nháy** cho mọi việc hiện trường | 071, 075 |

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
| P4-pre11 | Tồn vỏ: Lưu bãi, bỏ cột Thao tác (khóa tại icon), bút vị trí canh cột, Ghi chú nền vàng, tìm / khóa / ghi chú hàng loạt, Excel đủ cột | 2026-10-24 | DEC-067 | 62/62 • build PASS | agent/claude/p4-prep-xlsx |
| P4-pre12 | Mã hồ sơ HV- / CV- / PTT- (+ NT- / XT-), đổi mã cũ khi nạp dữ liệu | 2026-10-24 | DEC-068 | 63/63 • build PASS | agent/claude/p4-prep-xlsx |
| P7-01 | **Nhập tàu / Xuất tàu** bản Demo: nghiệp vụ `vessel.ts`, Văn phòng lập / duyệt, mobile Giám định / Vệ sinh / Xe nâng, hồ sơ NT- / XT-, Báo cáo + Tổng hợp | 2026-10-24 | DEC-069 | **68/68 • build PASS**; **chưa thử trên trình duyệt / điện thoại** | agent/claude/p4-prep-xlsx |
| P7-02 | Nhập / Xuất tàu: bỏ menu Vệ sinh → Nhập tàu; Văn phòng danh sách → chi tiết, sửa / thêm cont / xóa khi chưa duyệt; sắp xếp size → số cont; tìm như Tồn vỏ | 2026-10-24 | DEC-070 | **72/72 • build PASS**; chưa thử trên trình duyệt | agent/claude/p4-prep-xlsx |
| P7-03 | Màn hiện trường Nhập / Xuất tàu: theo dõi đã làm / chờ làm, chống làm trùng; Xe nâng Nhập tàu dùng chung mẫu | 2026-10-24 | DEC-071 | **73/73 • build PASS**; chưa thử trên điện thoại | agent/claude/p4-prep-xlsx |
| P7-04 | Sửa In hồ sơ (trang trắng) → In EEIR / EEIR + phiếu thu từng lượt; EEIR và phiếu thu chung 1 khung in; lớp in PrintPortal | 2026-10-24 | DEC-072 | **74/74 • build PASS**; **chưa thử in giấy thật** | agent/claude/p4-prep-xlsx |
| P7-05 | Lập danh sách Xuất tàu / Thêm cont: Tìm hàng loạt như Tồn vỏ | 2026-10-24 | DEC-073 | **75/75 • build PASS** | agent/claude/p4-prep-xlsx |
| P4-pre13 | Tồn vỏ: cột Date in, Excel DATE IN + VÀO BÃI BẰNG, sắp lại độ rộng cột | 2026-10-24 | DEC-074 | **75/75 • build PASS** | agent/claude/p4-prep-xlsx |
| P7-06 | Menu báo việc chờ: số đếm Nhập / Xuất tàu cho Giám định, Xe nâng; việc hiện trường đang chờ tô cam + nhấp nháy | 2026-10-24 | DEC-075 | **75/75 • build PASS** | agent/claude/p4-prep-xlsx |
| P7-07 | Phiếu thu: nút Tạo phiếu thu TTT cùng hàng Tra cứu; in EEIR + phiếu thu khổ A5 trên 1 tờ A4, EEIR thêm tình trạng vỏ Giám định | 2026-10-24 | DEC-076 | **76/76 • build PASS**; **chưa thử in giấy thật** | agent/claude/p4-prep-xlsx |
| P7-08 | Phiếu thu: danh sách full màn hình; phiếu thu trước theo bố cục thanh toán, biểu giá × số lượng, bản in PHIẾU THU TRƯỚC | 2026-10-24 | DEC-077 | **78/78 • build PASS**; chưa thử in giấy | agent/claude/p4-prep-xlsx |
| P7-09 | Menu: biểu tượng mobile + số đếm thẳng hàng (3 cột cố định) | 2026-10-24 | DEC-078 | **78/78 • build PASS** | agent/claude/p4-prep-xlsx |
| P7-10 | Phiếu thu: sắp lại cột (Phương thức TT, Thời gian / Nhân viên, Trạng thái cạnh Đã in); phiếu thu trả trước liên kết từng lần trừ (chứng từ, hồ sơ, số lượt, còn lại) | 2026-10-24 | DEC-079 | **81/81 • build PASS** | agent/claude/p4-prep-xlsx |
| P7-11 | Quy chuẩn trang nhiều dữ liệu (docs/UI_DATA_LIST_STANDARD.md): chi tiết trượt phải, chọn 20 / 50 / 100 dòng; áp dụng Phiếu thu, Tồn vỏ, Nhập / Xuất tàu, Báo cáo, Hồ sơ | 2026-10-24 | DEC-080 | **83/83 • build PASS**; chưa thử trên trình duyệt | agent/claude/p4-prep-xlsx |
| P7-12 | EEIR cho hồ sơ Nhập tàu / Xuất tàu + nút in trong hồ sơ | 2026-10-24 | DEC-081 | **84/84 • build PASS**; chưa thử in giấy | agent/claude/p4-prep-xlsx |
| UI-02 | Form Giám định dùng chung `InspectionFields` (Hạ vỏ + Nhập tàu) | 2026-10-24 | — (chỉ giao diện) | **85/85 • build PASS** | agent/claude/p4-prep-xlsx |
| P4-pre14 | Vị trí theo cấu hình thực tế của Block; form thêm vị trí BLOCK- + mô tả | 2026-10-24 | DEC-082 | **87/87 • build PASS** | agent/claude/p4-prep-xlsx |
| P7-13 | Vệ sinh / Xe nâng: nhãn tác nghiệp (Hạ vỏ / Cấp vỏ / Nhập tàu + tàu / Xuất tàu + tàu) | 2026-10-24 | DEC-083 | **89/89 • build PASS** | agent/claude/p4-prep-xlsx |
| P7-14 | Báo giá → Chờ báo giá: bảng như Tồn vỏ + cửa sổ trượt nhập báo giá | 2026-10-24 | DEC-084 | **90/90 • build PASS** | agent/claude/p4-prep-xlsx |
| P7-15 | Danh sách chờ Vệ sinh / Xe nâng: số cont thẳng cột, nhãn tác nghiệp tầng 2 | 2026-10-24 | DEC-085 | 90/90 • build PASS; **chưa có test hiển thị dòng** (danh sách thu gọn mặc định) | agent/claude/p4-prep-xlsx |
| P7-16 | Báo giá 2 bước: cột Tình trạng sửa chữa / Giờ công / Tác nghiệp; lưu nháp → xác nhận chờ sửa chữa | 2026-10-24 | DEC-086 | **91/91 • build PASS** | agent/claude/p4-prep-xlsx |
| P4-pre15 | Vị trí: chỉ chặn trùng khi đủ 4 phần | 2026-10-24 | DEC-087 | **91/91 • build PASS** | agent/claude/p4-prep-xlsx |
| P7-17 | Chờ báo giá: tìm hàng loạt + xác nhận chờ sửa chữa hàng loạt | 2026-10-24 | DEC-088 | **92/92 • build PASS** | agent/claude/p4-prep-xlsx |
| P7-18 | Danh sách chờ Vệ sinh / Xe nâng: ô tác nghiệp riêng bên trái, tên tàu tách riêng | 2026-10-24 | DEC-089 | **93/93 • build PASS** | agent/claude/p4-prep-xlsx |
| P7-19 | Đảo chuyển: vị trí thẳng cột | 2026-10-24 | DEC-090 | **94/94 • build PASS** | agent/claude/p4-prep-xlsx |
| P7-20 | Đảo chuyển: vị trí tách cột Block / Bay / Row / Tier | 2026-10-24 | DEC-091 | **94/94 • build PASS** | agent/claude/p4-prep-xlsx |
| P7-21 | Đảo chuyển: cont + size/type + vị trí 1 dòng, vị trí thẳng cột | 2026-10-24 | DEC-092 | **94/94 • build PASS** | agent/claude/p4-prep-xlsx |
| P7-22 | Khách hàng gõ tay / chọn + gợi ý; khách ngoài Danh mục chỉ thanh toán trực tiếp | 2026-10-24 | DEC-093 | **96/96 • build PASS** | agent/claude/p4-prep-xlsx |
| P7-23 | Đảo chuyển: ô trạng thái đầu dòng, tiến độ cuối ô | 2026-10-24 | DEC-094 | **96/96 • build PASS** | agent/claude/p4-prep-xlsx |
| P7-24 | Đảo chuyển: tiến độ bên phải vị trí, dòng 2 ghi chú | 2026-10-24 | DEC-095 | **96/96 • build PASS** | agent/claude/p4-prep-xlsx |
| P7-25 | Đảo chuyển: ô AV / DAMAGE đồng bộ kích thước ô tác nghiệp | 2026-10-24 | DEC-096 | **96/96 • build PASS** | agent/claude/p4-prep-xlsx |
| P7-26 | Hình thức thanh toán: TTTT đứng đầu, chọn sẵn | 2026-10-25 | DEC-097 | **97/97 • build PASS** | agent/claude/p4-prep-xlsx |
| P7-27 | Mã phiếu thu PT-TT / PT-TTR; Tồn vỏ có cột thanh toán; ký hiệu TT / TTR / TTS; menu "Sửa chữa" | 2026-10-25 | DEC-098 → 101 | **99/99 • build PASS** | agent/claude/p4-prep-xlsx |
| P7-28 | Ô lọc nhanh thời gian cho mọi bộ lọc (mặc định Hôm nay, tuần từ Thứ Hai) | 2026-10-25 | DEC-102 | **100/100 • build PASS** | agent/claude/p4-prep-xlsx |

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
1. **Giám định** → (+) tạo hạ vỏ → mã `HV-...`.
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
## F2. THỬ CÁC TÍNH NĂNG MỚI 2026-10-24
11. **Tồn vỏ**: cột Lưu bãi; bấm icon khóa xám cạnh số cont → khóa (icon đỏ); bút ở cột Vị trí; **Tìm hàng loạt** (dán nhiều số cont) → tick chọn → Khóa / Mở khóa / Ghi chú hàng loạt; Xuất Excel.
12. **Nhập tàu**: Văn phòng → Nhập tàu: bấm **Lập danh sách NHẬP TÀU** (bên phải tiêu đề), nhập tên tàu, hãng tàu, số xe, dán danh sách cont (SỐ CONT  SIZE  TYPE) → Lập → **Giám định → Nhập tàu** (thu nhỏ trình duyệt): nhập số cont, chọn xe, AV/DAMAGE, M/K/E, vệ sinh, AGE → **Vệ sinh → Chờ vệ sinh** (nếu có) → **Xe nâng → Nhập tàu** hạ cont → xem cont trong Tồn vỏ, thử Cấp vỏ → Văn phòng → Nhập tàu: **Duyệt**. Thử bấm vào danh sách → **Sửa thông tin / Thêm cont / Xóa danh sách** trước khi duyệt; ở Giám định gõ vài số cuối để lọc cont.
13. **Xuất tàu**: Văn phòng → Xuất tàu: chọn cont từ tồn vỏ (cont khóa không chọn được) → Lập → **Xe nâng / Giám định → Xuất tàu**: chọn cont, chọn xe → xác nhận → cont OUT → Văn phòng **Duyệt**. Xem **Báo cáo → Nhập tàu / Xuất tàu** và Excel.

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
- 2026-10-23 — Claude Code: chốt DEC-066 (dữ liệu lớn) — DECISIONS + DATABASE_CONTRACT mục 10.
- 2026-10-23 — Claude Code: Tồn vỏ — Thao tác = 1 nút Khóa / Mở khóa. 60/60 • build PASS.
- 2026-10-23 — Claude Code: điểm dừng — cập nhật tiến độ chung, ROADMAP GĐ 4, OPEN_QUESTIONS Q-036 → Q-039; push GitHub.
- 2026-10-24 — Claude Code: P4-pre11 (DEC-067 Tồn vỏ), P4-pre12 (DEC-068 mã hồ sơ), P7-01 (DEC-069 Nhập tàu / Xuất tàu). 68/68 • build PASS. 

## F3. THỬ CÁC TÍNH NĂNG MỚI 2026-10-25
Mở app lần đầu sẽ tự nạp **dữ liệu test** (nút **Nạp dữ liệu test** / **Xóa dữ liệu** ở đầu trang). Cont mẫu: `MSKU1000011` → `MSKU1000122`, cấp vỏ `MSKU2000011/22`, nhập tàu `MSKU4000011/22/33`, xuất tàu `MSKU3000011/22`.
14. **Tồn vỏ**: cột **Hình thức TT** (TT — TRỰC TIẾP / TTR — TRẢ TRƯỚC / TTS — THANH TOÁN SAU) và **Mã phiếu thu** — bấm mã → mở đúng phiếu ở Văn phòng → Phiếu thu; TTS để trống. Xuất Excel kiểm cột.
15. **Văn phòng → Hạ vỏ**: Hình thức thanh toán **TT đứng đầu, chọn sẵn**; thu tiền mặt → phiếu thu `PT-TT-YYMMDD-0001`.
16. **Văn phòng → Phiếu thu**: ô **Lọc nhanh** (Hôm nay … Năm nay / Tùy chọn); cột Số cont cạnh Tác nghiệp; không còn chứng từ; Tạo phiếu thu TTR (trả trước) → `PT-TTR-…`; gọi là **PHIẾU THU TRẢ TRƯỚC**.
17. **Hạ kệ giám định**: Giám định → Hạ vỏ tích **HẠ KỆ GIÁM ĐỊNH** → Văn phòng thu phí → Xe nâng → Chờ hạ vỏ thấy dải vàng, chỉ chọn được Kệ giám định (BLOCK-DAMAGE; Admin đổi ở Danh mục → Vị trí) → Đảo chuyển về bay. Cont mẫu: `MSKU1000111` (đã lên kệ), `MSKU1000122` (chờ vệ sinh rồi hạ kệ).
18. **Văn phòng → Trả chứng từ**: nút **Xem trước** (bên trái Trả chứng từ) — chỉ xem EEIR + phiếu thu, không in, không trả.
19. **Báo cáo → Sửa chữa** (đổi tên từ "Sửa chữa chi tiết").
21. **Mobile (DEC-115, 116)**: Xe nâng → Đảo chuyển trên điện thoại — mỗi cont 2 dòng; chọn cont → không còn ô Ghi chú tác nghiệp. Chạm vào các ô nhập (tìm cont, chọn Block, quét mã) — **màn hình không được tự phóng to**.
23. **Góp ý (DEC-120)**: bấm **Góp ý** góc trên bên phải → chọn menu, nhập nội dung → Gửi → xem "Góp ý của tôi". Đổi sang Admin → **Báo cáo → Góp ý** → Tra cứu → bấm dòng → đổi trạng thái + phản hồi → đổi lại người góp ý xem phản hồi.
22. **Link mã (DEC-117, 118)**: Tồn vỏ bấm Mã hồ sơ / Mã phiếu thu; Phiếu thu bấm Mã phiếu thu, Mã hồ sơ, mã phiếu thu trả trước; Báo giá, Trả chứng từ bấm mã hồ sơ — tất cả cùng kiểu chữ xanh, gạch chân khi rê chuột.
20. **Xuất hóa đơn (DEC-111 → 114)**: Văn phòng → Phiếu thu → mở 1 phiếu → khối **Xuất hóa đơn** có đường link + mã bảo mật; in phiếu → khung "Yêu cầu xuất hóa đơn" + ô ký **Người thu tiền = nhân viên** (kể cả chuyển khoản). Mở link `…/#/hoa-don` (cùng trình duyệt), dán mã → nhập MST / Gmail / Tên công ty / Địa chỉ → Gửi. Đổi người dùng sang **Đỗ Thị Thu (Kế toán)** → Phiếu thu, lọc Hóa đơn = YÊU CẦU XHD → mở phiếu → nhập số HĐ → **Đã xuất hóa đơn**. Dữ liệu test: phiếu của `MSKU1000011` đang YÊU CẦU XHD, `MSKU1000022` ĐÃ XHD.

## H. BÀN GIAO AGENT (2026-10-24 — Claude Code)
- **Nhánh:** `agent/claude/p4-prep-xlsx`. Commit hôm nay: `7adcfd1` Tồn vỏ → `de14560` mã hồ sơ → `1d3745e` nghiệp vụ tàu → `f83fbfa` giao diện tàu → commit tài liệu. Đã push 2026-10-24.
- **Đọc trước khi sửa:** `docs/DECISIONS.md` DEC-067 → DEC-069; `AGENTS.md` mục 8 (lưu ý Nhập tàu / Xuất tàu, mã hồ sơ, Tồn vỏ).
- **File mới:** `src/services/vessel.ts` (toàn bộ nghiệp vụ tàu), `src/features/vessel/*` (Văn phòng, mobile, khối dùng chung), `src/features/reports/VesselReport.tsx`, `tests/vessel.test.ts`.
- **Điểm nối vào luồng cũ (cẩn thận khi sửa):** `updateContainerLocation` gọi `markVesselImportPlaced`; `releaseBlocker` chặn cont có `vesselExportItemId`; `normalizeDepotState` gọi `renameLegacyCodes`; `FieldQueueWorkspaces` có prop `vesselOnly`; `MasterDossierModal` dùng `renderYardSteps` cho cả HV và NT.
- **Chưa làm / chưa kiểm thử:** chưa thử trên trình duyệt và điện thoại; form Giám định Nhập tàu đang lặp lại khối của Hạ vỏ (việc UI-02); chưa có database cho tàu (P7-DB); chưa giới hạn 3 tháng cho bộ lọc báo cáo ở bản Demo (DEC-066 áp dụng khi có database).
- 2026-10-24 — Claude Code: push nhánh agent/claude/p4-prep-xlsx lên GitHub (DEC-067 → DEC-069); cập nhật tiến độ, bàn giao.
- 2026-10-24 — Claude Code: P7-02 (DEC-070) hoàn thiện Nhập tàu / Xuất tàu. 72/72 • build PASS.
- **Bàn giao bổ sung (P7-02):** hàm mới trong `src/services/vessel.ts`: `updateVesselList`, `addVesselListItems`, `deleteVesselList`, `sortVesselItems` (dùng chung `buildImportItems` / `buildExportItems` với `createVesselList`). Màn `OfficeVesselWorkspace` có 3 chế độ LIST / CREATE / DETAIL. Menu `VS_NHAP_TAU` đã gỡ (10 màn mobile). Test xlsx Tổng hợp nâng timeout 20s (trước đây lâu lâu quá 5s).
- 2026-10-24 — Claude Code: P7-03 (DEC-071) theo dõi tác nghiệp hiện trường Nhập / Xuất tàu. 73/73 • build PASS.
- **Bàn giao bổ sung (P7-03):** `VesselFieldMobile` phục vụ 4 menu `GD_NHAP_TAU`, `XN_NHAP_TAU`, `GD_XUAT_TAU`, `XN_XUAT_TAU` (bước `NT_INSPECT` / `NT_PLACE` / `XT_EXPORT`). Trạng thái thẻ lấy từ `vesselStepInfo`; tổng hợp từ `vesselStepSummary` (`src/services/vessel.ts`). Đã gỡ `vesselOnly` khỏi `FieldQueueWorkspaces` và `VesselProgressPanel`.
- 2026-10-24 — Claude Code: P7-04 (DEC-072) sửa in hồ sơ → In EEIR, đồng bộ mẫu in EEIR / phiếu thu. 74/74 • build PASS.
- **Bàn giao bổ sung (P7-04):** mẫu in chung ở `src/components/ReceiptPrint.tsx` (`PrintFrame`, `EeirPrintSheet`, `ReceiptPrintSheet`, `PrintPortal`). Hồ sơ: `DossierPrintBar` trong `MasterDossierModal.tsx` (cần prop `onUpdateState` để đếm lần in phiếu thu). CSS `index.css`: `.print-job` ẩn các vùng in khác khi đang in.
- 2026-10-24 — Claude Code: P7-05 (DEC-073) Tìm hàng loạt ở Lập danh sách Xuất tàu. 75/75 • build PASS.
- 2026-10-24 — Claude Code: P4-pre13 (DEC-074) Tồn vỏ cột Date in. 75/75 • build PASS.
- 2026-10-24 — Claude Code: P7-06 (DEC-075) menu báo việc chờ hiện trường. 75/75 • build PASS.
- 2026-10-24 — Claude Code: P7-07 (DEC-076) nút Tạo phiếu thu TTT; in EEIR + phiếu thu A5 trên 1 tờ A4. 76/76 • build PASS.
- 2026-10-24 — Claude Code: P7-08 (DEC-077) Phiếu thu full màn hình, phiếu thu trước biểu giá × số lượng, bản in riêng. 78/78 • build PASS.
- 2026-10-24 — Claude Code: P7-09 (DEC-078) menu mobile thẳng hàng. 78/78 • build PASS.
- 2026-10-24 — Claude Code: P7-10 (DEC-079) phiếu thu sắp lại cột, phiếu thu trả trước liên kết từng lần trừ. 81/81 • build PASS.
- 2026-10-24 — Claude Code: P7-11 (DEC-080) quy chuẩn trang nhiều dữ liệu + áp dụng. 83/83 • build PASS.
- 2026-10-24 (tối) — Claude Code: kiểm tra cuối (83/83 test, build, typecheck, quét khóa bí mật) → push đầy đủ DEC-050 → DEC-080; cập nhật tiến độ, bàn giao, mục I lưu ý.
- **Bàn giao cuối ngày 2026-10-24:** commit trên nhánh từ `a226e64` → mới nhất, mỗi DEC 2 commit (code + tài liệu). Điểm nối quan trọng xem mục H và các dòng "Bàn giao bổ sung" phía trên. File mới hôm nay: `src/services/vessel.ts`, `src/features/vessel/*`, `src/features/reports/VesselReport.tsx`, `src/components/ReceiptPrint.tsx` (mẫu in chung), `docs/UI_DATA_LIST_STANDARD.md`, `tests/vessel.test.ts`.

## I. LƯU Ý TRƯỚC KHI BẮT ĐẦU VIỆC TIẾP THEO (đọc trước mỗi phiên)

**Cho bạn (người giao việc):**
1. **Lấy đúng nhánh**: code mới nhất ở `agent/claude/p4-prep-xlsx`, **chưa có trên `main`**. Mở dự án trên máy khác → `git pull` nhánh này trước.
2. **Dữ liệu Demo lưu trên trình duyệt** (localStorage). Mã cũ IN- / OUT- / PTM- tự đổi sang HV- / CV- / PTT- khi mở app. Muốn làm lại từ đầu → bấm **Reset demo** (góc phải).
3. **Chưa thử trên trình duyệt / điện thoại / máy in thật**. Ưu tiên thử: in EEIR + phiếu thu trên 1 tờ A4 (có bị cắt nội dung không), màn Nhập / Xuất tàu trên điện thoại, cửa sổ trượt chi tiết. Gửi ảnh nếu lỗi.
4. **Xác nhận mục A.5** (6 điểm agent tự đặt hôm nay) — nếu khác ý thì báo để sửa.
5. Muốn làm **Database (P4-01)** → cần gửi **danh mục trạng thái chính thức (OPEN-003)**; nên trả lời luôn Q-037 (ảnh), Q-038 (số người dùng cùng lúc), Q-039 (sao lưu).
6. Giao việc theo mẫu `devs/GIAO_VIEC.md`; mỗi yêu cầu mới agent sẽ ghi thành 1 DEC (hiện tới **DEC-080**).

**Cho agent (Claude Code / Antigravity) — bắt buộc:**
1. `git status` sạch, đang ở nhánh `agent/claude/p4-prep-xlsx` (hoặc nhánh mới tách từ đây), đã `git pull`.
2. Đọc `AGENTS.md` mục 8 (lưu ý đã chốt) + `docs/DECISIONS.md` DEC liên quan. Trang danh sách / báo cáo → `docs/UI_DATA_LIST_STANDARD.md`.
3. **Sửa file bằng Edit / Write**, không dùng perl / sed với chuỗi có `|`, `||`, `` ` ``, `${…}` — hôm nay đã 3 lần làm hỏng file (chèn nhầm lên đầu file, mất `${…}`), phải khôi phục. Dùng heredoc thì **không** để `;` sau chuỗi lệnh (đã từng chạy nhầm nội dung .md như lệnh shell).
4. Quy tắc nghiệp vụ chỉ ở `src/services/` (vessel.ts, payments.ts, depotOperations.ts…); giao diện chỉ gọi hàm. In giấy tờ chỉ qua `ReceiptPrint.tsx` + `PrintPortal`. Mã hồ sơ chỉ qua `codes.ts`.
5. Màn mobile mới → thêm `mobile: true`, số đếm việc chờ (`badges`), cập nhật smoke test (hiện **10** biểu tượng mobile).
6. Xong việc: `npm test` + `npm run build` pass → ghi DEC + CHANGELOG + PROGRESS (C, D, G) + AGENTS.md mục 8 nếu là lưu ý chung → commit 2 nhóm (code / tài liệu) → **hỏi trước khi push**.
7. Test xlsx Tổng hợp đã nâng timeout 20s; nếu vẫn lỗi lẻ tẻ thì chạy lại trước khi kết luận.
- 2026-10-24 — Claude Code: P7-12 (DEC-081) EEIR Nhập / Xuất tàu; ghi nhận xác nhận A.5. 84/84 • build PASS.
- 2026-10-24 — Claude Code: UI-02 form Giám định dùng chung. 85/85 • build PASS.
- 2026-10-24 — Claude Code: P4-pre14 (DEC-082) vị trí theo cấu hình Block. 87/87 • build PASS.
- 2026-10-24 — Claude Code: P7-13 (DEC-083) nhãn tác nghiệp Vệ sinh / Xe nâng. 89/89 • build PASS.
- 2026-10-24 — Claude Code: P7-14 (DEC-084) Chờ báo giá như Tồn vỏ. 90/90 • build PASS.
- 2026-10-24 — Claude Code: P7-15 (DEC-085) danh sách chờ số cont thẳng cột.
- 2026-10-24 — Claude Code: P7-16 (DEC-086) Báo giá 2 bước. 91/91 • build PASS.
- 2026-10-24 — Claude Code: P4-pre15 (DEC-087) chặn trùng vị trí chỉ khi đủ 4 phần.
- 2026-10-24 — Claude Code: P7-17 (DEC-088) Chờ báo giá hàng loạt. 92/92 • build PASS.
- 2026-10-24 — Claude Code: P7-18 (DEC-089) ô tác nghiệp riêng trong danh sách chờ. 93/93 • build PASS.
- 2026-10-24 — Claude Code: P7-19 (DEC-090) Đảo chuyển vị trí thẳng cột. 94/94 • build PASS.
- 2026-10-24 — Claude Code: P7-20 (DEC-091) Đảo chuyển tách cột vị trí. 94/94 • build PASS.
- 2026-10-24 — Claude Code: P7-21 (DEC-092) Đảo chuyển 1 dòng.
- 2026-10-24 — Claude Code: P7-22 (DEC-093) khách hàng gõ tay + gợi ý.
- 2026-10-24 — Claude Code: P7-23 (DEC-094) Đảo chuyển ô trạng thái + tiến độ.
- 2026-10-24 — Claude Code: P7-24 (DEC-095) Đảo chuyển tiến độ + ghi chú.
- 2026-10-24 — Claude Code: P7-25 (DEC-096) đồng bộ ô trạng thái Đảo chuyển.

### I.5 — DATABASE GĐ 4 (cập nhật 2026-10-27 trưa — đọc trước — mới nhất)

**MÔI TRƯỜNG TEST NHIỀU NGƯỜI — ĐÃ DỰNG XONG (2026-10-27 chiều):**
- Supabase cloud project **`matran-test`** (Singapore, ref `rtbpmnfwkzndujjzxuxf`): `db push` đủ migration, đủ 3 Edge Function, đã chạy danh mục test + Admin đầu tiên (`admin` / `123456`).
- App: **Vercel**, build nhánh **`main`** (đã merge PR #15 — commit `ed60761`), 3 biến `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` / `VITE_APP_ENV=test`. Đăng nhập Admin OK. Cloudflare Pages để dành khi chạy thật.
- `main` đã merge PR #16 (`04a303a`).

**ĐỢT SỬA SAU TEST 1 (2026-10-28):**
1. Biểu giá THU GOM RÁC / KHÁC lỗi "Hãng tàu không có" → migration `20261103000001` (pgTAP 184/184 local) — **bạn chạy `npx supabase db push --linked`** lên `matran-test` rồi thử lại.
2. Danh mục chung → Sửa chữa: bảng mỗi tổ 1 dòng, bấm dòng → cửa sổ chi tiết + gán nhân viên.
3. Văn phòng Hạ vỏ + Hồ sơ container: kính lúp khi rê chuột, bấm ảnh → xem toàn màn hình, phóng to 1× → 4×.
4. **Tốc độ + giao diện chờ:** tải dữ liệu theo đợt song song (thay ~25 lượt nối tiếp); tách file theo màn hình (file đầu 1.013 → 260 KB); màn chờ hiện ngay khi mở trang, có bước "đang kiểm tra đăng nhập / đang tải dữ liệu bãi"; mở màn lần đầu có khung xương; "Đang lưu" chỉ hiện khi lâu > 300 ms; thanh chạy khi bấm Tải lại. Thành phần chờ dùng chung: `src/components/LoadingScreens.tsx` — màn mới thêm vào `App.tsx` theo kiểu `named(() => import(...), 'Ten')` (tải khi cần).
- Giao diện (2, 3, 4) lên Vercel khi tạo PR merge `agent/claude/p4-database` → `main`.

**PHIÊN SAU — BẠN CẦN CHÚ Ý:**
1. **Đang test:** tạo tài khoản người test (User - Role → Thêm — lần đầu thử hàm `admin-create-staff` trên cloud), cả nhóm thử theo Bước 7 `docs/HUONG_DAN_TEST_NHIEU_NGUOI.md`. Ghi lỗi bằng nút **Góp ý** (Admin xem Báo cáo → Góp ý) hoặc chụp màn hình → mở phiên mới gửi Claude.
2. **Code mới phải đi qua `main`** (Vercel build `main`): agent làm trên nhánh → bạn tạo PR → merge → Vercel tự build lại. Có migration mới → bạn chạy `npx supabase db push --linked` (đúng project `matran-test`) **trước** khi merge.
3. **Ổ C gần đầy** (từng còn 4 MB → Docker hỏng). Giữ trống ≥ 5 GB. Supabase local đang dừng — cần thì `npx supabase start` (mở Docker Desktop trước).
4. **Deploy Edge Function:** dùng `npx supabase functions deploy <tên> --use-api` từng hàm (cách thường bị "request timed out").
5. **Terminal PowerShell:** dán lệnh bằng **chuột phải**, mỗi lần 1 lệnh; thấy `>>` → Ctrl + C. Không gõ `<…>` trong lệnh mẫu — thay bằng giá trị thật.
6. **Mật khẩu tạo tay trên trang Supabase** luôn thêm `::matran` (DEC-153); trên app thì không.
7. **Song song:** điền `docs/IMPORT_TON_VO_BAN_DAU.md` (Q-044) + gửi 1 file Excel tồn vỏ mẫu.
8. Khi test xong: Claude viết script xóa dữ liệu test + công cụ import tồn đầu → import thử trên `matran-test` → tạo project production → chạy thật.

**PHIÊN SAU (agent):** đọc mục này → sửa lỗi người dùng báo từ đợt test (đọc góp ý / ảnh chụp). Không link / push project thật (người dùng tự làm). Đổi database → migration MỚI (đã apply lên `matran-test`, không sửa file cũ). Q-044 chốt → script xóa dữ liệu test + công cụ import.

**Trạng thái thật (đã kiểm lại code + chạy test):**
- Nhánh `agent/claude/p4-database` — **đã push đầy đủ 2026-10-27 chiều**; `main` đã merge (PR #15). Mốc Demo cũ: tag `demo-truoc-database-2026-10-26`.
- Database: migration 5 bước + `20261101000001_app_support.sql` + `20261102000001_sync_delta.sql` (đồng bộ — DEC-158) xong. pgTAP 180/180, Edge Function 16/16 (đều trên Supabase local).
- Nối app (DEC-155, `docs/APP_DB_INTEGRATION.md`): **N1 → N8 xong phần code**. Hàm ghi đi qua `src/services/api.ts` + hàng chờ `remote/sync.ts` (mất mạng → báo lỗi ngay). Dữ liệu: `remote/loadWorking.ts` — `createWorkingSync`: mở app tải đủ (trong bãi + 7 ngày), sau đó chỉ tải phần thay đổi; báo cáo xa hơn tải riêng (`reportSource.ts`).
- `npm test`: 163 pass, 3 bỏ qua (`tests/remote*.local.test.ts` chạy khi bật Supabase local; `tests/perf.local.test.ts` khi thêm `MATRAN_PERF=1`). `npm run build`: PASS (cảnh báo file JS > 500 kB, chưa ảnh hưởng).

**Cho bạn:**
- Mỗi lần làm database: mở **Docker Desktop** trước, đợi báo **Engine running**.
- Supabase trên máy chỉ để chạy thử, không phải database thật.
- **Chưa** tạo project Supabase thật / test. Bạn tự tạo theo `supabase/README.md`; agent không giữ khóa.
- Còn chờ bạn:
  - **Thử tay toàn bộ trên trình duyệt ở chế độ database** (chưa ai thử) — kế hoạch của bạn: thử hết → reset → import tồn vỏ ban đầu → chạy thật.
  - **Q-044:** gửi file mẫu tồn vỏ ban đầu + trả lời 5 ý trong `docs/OPEN_QUESTIONS.md` để Claude làm công cụ import.
  - A.1c (tên khách test), Q-032 (ngân hàng — làm sau), OPEN-008 (hoàn tiền — giữ chặn).

**Việc còn lại (theo thứ tự đề xuất):**
1. ~~N7~~ ✅ (DEC-157) • ~~Ảnh Nhập tàu~~ ✅ không chụp (DEC-156) • ~~N8~~ ✅ (DEC-158) • ảnh giữ 2 tháng (DEC-159).
2. **Dựng môi trường TEST nhiều người** theo `docs/HUONG_DAN_TEST_NHIEU_NGUOI.md` (bạn làm: Supabase project test + Cloudflare Pages; script danh mục test + Admin đầu tiên ở `supabase/test-data/`). Rồi cả nhóm thử tay toàn bộ; lỗi → Claude sửa. (Supabase local đã có sẵn danh mục test + `admin` / `123456`.)
3. **Import tồn vỏ ban đầu** — trả lời bộ câu hỏi `docs/IMPORT_TON_VO_BAN_DAU.md` (Q-044) + gửi file mẫu; Claude làm công cụ import + script xóa dữ liệu test khi test xong.
4. Hướng dẫn bạn tạo project Supabase thật, apply migration, reset sạch → import tồn vỏ → chạy thật.
- Đã biết: mở Hồ sơ cont đã OUT quá 7 ngày từ màn báo cáo có thể không thấy; phiếu thu cũ hơn 7 ngày chỉ xem (DEC-157, DEC-158).

**Cho agent:**
1. Thiết kế `docs/DATABASE_SCHEMA.md`, trạng thái `docs/STATUS_CATALOG.md`, tiến độ từng bước ở bảng trong `supabase/README.md`, kế hoạch nối app `docs/APP_DB_INTEGRATION.md`.
2. **Chạy thử:** `npx supabase start`, `npx supabase db reset`, `npx supabase test db` — chỉ local. **Không** `supabase link` / `db push`.
3. **Test chạy thật:** đặt `MATRAN_LOCAL_SUPABASE_URL` / `MATRAN_LOCAL_ANON_KEY` / `MATRAN_LOCAL_SERVICE_KEY` từ `npx supabase status -o env` (API_URL, ANON_KEY, SERVICE_ROLE_KEY) rồi chạy `tests/remote*.local.test.ts`.
4. **Quy ước SQL:**
   - Mọi ghi chỉ qua RPC `security definer set search_path = public`; đầu RPC gọi `assert_permission('<KEY>', '…')` hoặc `assert_admin()`.
   - Bảng `role_permissions` mirror `PERMISSIONS` trong `permissions.ts` — đổi phải sửa cả 2.
   - Khóa dòng `lock_active_container` / `lock_container_by_id`; mã qua `next_code('HV')`; nhật ký `write_audit(...)`; chống bấm lặp `idem_get` / `idem_put`.
   - Mỗi file RPC kết thúc bằng `revoke execute … from public, anon, authenticated` rồi grant lại từng hàm client gọi. RPC mới → thêm dòng grant.
   - Biến PL/pgSQL đặt `v_*` / `p_*` / `slot_*`, tránh `row`; nối mảng text bằng `array_append`.
5. **App:** giao diện không gọi thẳng hàm ghi của service — phải qua `api.ts` (có test chặn, DEC-155).
6. **Bẫy sửa file (đã làm hỏng file 2 lần):**
   - Chỉ sửa bằng công cụ Edit / Write.
   - Không dùng sed / perl / heredoc với chuỗi có dấu gạch chéo ngược, `${…}`, dấu backtick.
   - Không dùng `String.replace` khi chuỗi thay thế có ký hiệu đô-la (`$` + backtick / nháy đơn / `&`): JavaScript hiểu đó là "chèn phần trước / sau / chỗ khớp". Lỗi này đã làm `devs/PROGRESS.md` phình từ 400 lên 1.890 dòng (sửa lại 2026-10-27). Nếu buộc dùng thì truyền hàm: `s.replace(a, () => b)`.
   - Sau khi sửa bằng script: luôn xem `git diff --stat` xem số dòng có hợp lý không.

### I.4 — Bổ sung 2026-10-26 (đọc trước — mới nhất)
**Cho bạn:** thử theo F4 + **F5** bên dưới (dữ liệu test tự nạp lại — **khóa lưu v14**, dữ liệu cũ trong trình duyệt sẽ được thay). Còn chờ bạn: Q-032 (ngân hàng), Q-037 → Q-040 (database, đang tạm hoãn), có bỏ ký hiệu TT/TTR/TTS ở khối chọn thanh toán + Excel Phiếu thu không, cont Nhập tàu có cần ô "Hạ kệ giám định" không.

**F4. THỬ TÍNH NĂNG 26/10**
1. Văn phòng → Hạ vỏ: số chứng từ / nội dung chuyển khoản = mã hồ sơ HV- (không còn CT-).
2. **Góp ý** (góc phải): chọn Menu chính → Tính năng → Nội dung → Gửi; Admin → Báo cáo → Góp ý → bấm dòng → trạng thái + phản hồi.
3. Phiếu thu trả trước: tạo → có ngay `PT-TTR-…` (chờ thanh toán) → thu → cùng mã; cột Mã hồ sơ "Dùng N lượt • còn X" (bấm xem chi tiết).
4. Hóa đơn theo lượt: lấy mã bảo mật phiếu PT-TTR (khối Xuất hóa đơn) → `#/hoa-don` → chọn lượt → gửi; Kế toán (Đỗ Thị Thu) → Phiếu thu → mở phiếu → "Đã xuất hóa đơn" từng yêu cầu.
5. Xe nâng / Tồn vỏ sửa vị trí: chọn Block → Bay → Row → Tier bằng nút, tóm tắt ở trên.
6. Báo cáo Hạ vỏ / Cấp vỏ: cột Thanh toán + Mã phiếu thu (Excel cũng có).
7. Tồn vỏ: cột AGE, Phân loại, Tiến độ sau Mã phiếu thu; mỗi cont 1 dòng; Excel cùng thứ tự.
8. Xuất tàu MAERSK SEMARANG: `MSKU3000022` đang khóa "XUẤT TÀU MAERSK SEMARANG" ở Tồn vỏ (không cấp vỏ được) → Duyệt khi chưa đủ → nhập lý do → cont bị gạch, tự mở khóa.
9. Phiếu thu → mở phiếu PT-TTR- → bảng "Sử dụng phiếu thu trả trước" có cột **HÓA ĐƠN** từng lượt → bấm vào ô trạng thái → xem yêu cầu khách + nút Đã xuất hóa đơn (DEC-133).
10. Phiếu thu, Báo cáo Hạ vỏ / Cấp vỏ / Nhập tàu / Xuất tàu / Sửa chữa: mỗi thông tin 1 dòng, bảng rộng thì cuộn ngang (DEC-134); chữ dài bị cắt "…", rê chuột xem đủ (DEC-135).
11. Vị trí trên màn hình: icon định vị đỏ thay chữ "BLOCK-" (VD [icon] A / 17-02-02); Danh mục → Vị trí, Excel, giấy in vẫn ghi BLOCK-… (DEC-136).
12. Văn phòng → Cấp vỏ: bấm chọn cont ở danh sách bên trái → khối "Container được chọn" tự điền 6 ô (Số container, Size/Type, Hãng tàu, Trạng thái, Đóng hàng, Vị trí) (DEC-137).
13. Tồn vỏ → bấm bút ở ô Vị trí → khung SỬA VỊ TRÍ gọn như Đảo chuyển, nằm bên trái kể cả khi cuộn ngang bảng; nút **Lưu vị trí** full chiều rộng luôn thấy (DEC-138).
14. Tồn vỏ + Báo cáo Hạ vỏ / Cấp vỏ / Sửa chữa (bấm Tra cứu): 5 cột đầu **Mã hồ sơ | Số container | Size | Type | Hãng tàu**; Báo cáo Nhập / Xuất tàu: **Tên tàu** + 5 cột đó, cột **Trạng thái** và **Phân loại** riêng. Kéo ngang thì cả bảng cuộn (không cố định cột). Tải Excel → cùng thứ tự cột (DEC-139 → DEC-141).

**F5. THỬ TÍNH NĂNG 26/10 (tối)**
15. **Giao diện mới (DEC-145):** menu / nút chính navy, font Be Vietnam Pro (cần mạng), ô nhập cao hơn, tiêu đề chữ thường. Xem lệch màu / chữ ở màn nào thì báo. **In thử** phiếu thu / K80 / EEIR xem còn rõ không.
16. Văn phòng → Nhập tàu / Xuất tàu → mở 1 tàu: bảng cont mỗi cột 1 thông tin (Size | Type | Hãng tàu | Trạng thái | Phân loại | … | Người thực hiện | Thời gian), 1 dòng (DEC-146).
17. **W-SURVEY (DEC-147):** Giám định → Hạ vỏ → (+) → chụp ảnh → mục 1 chọn **W-SURVEY (LÊN KỆ)** → chỉ còn Vệ sinh → gửi. Văn phòng làm như thường → EEIR ghi W-SURVEY. Xe nâng chỉ hạ được vào Kệ giám định. Giám định → tab **Chờ giám định trên kệ** → chọn cont → AV / DAMAGE + Đóng hàng + AGE → xác nhận; DAMAGE sang Chờ báo giá. Cấp vỏ không chọn được cont W-SURVEY (Q-042).
18. **Dữ liệu test (DEC-148):** Danh mục → Công ty = CÔNG TY CỔ PHẦN MATRAN; Đối tác = 1 hãng MSK + 10 khách; Biểu giá 6 dòng. Tồn vỏ / Phiếu thu / Báo cáo có nhiều dòng → thử bộ lọc, phân trang 20 / 50 / 100, Excel. Nhập tàu: 4 tàu (MSK ALPHA xong, BRAVO dở, CHARLIE chưa làm); Xuất tàu MSK DELTA làm một nửa.

**Cho agent:**
1. Hiện tới **DEC-153**. **GĐ 4 đã mở lại** (DEC-149) trên nhánh `agent/claude/p4-database`; mốc Demo ở tag `demo-truoc-database-2026-10-26`. Bước đầu: người dùng duyệt `docs/STATUS_CATALOG.md`, rồi mới viết schema (P4-01).
2. **Mã:** không còn `CT-` (số chứng từ = mã hồ sơ — DEC-119) và `PTT-` (phiếu trả trước = `PT-TTR-` cấp ngay khi tạo — DEC-124); thêm `GY-` (góp ý).
3. **Hóa đơn:** trạng thái phiếu luôn lấy `receiptInvoiceStatus` / `receiptInvoiceLabel`; phiếu trả trước dùng `invoiceGroups` (`submitPrepaidInvoiceGroup`, `cancelPrepaidInvoiceGroup`, `markInvoiceIssued({ groupId })`).
4. **Thanh toán hiển thị:** `PaymentInfoCells` + `containerPaymentInfo` / `voucherPaymentInfo`; nhãn ngắn `PAYMENT_CATEGORY_SHORT_LABELS` (TRỰC TIẾP / TRẢ TRƯỚC / THANH TOÁN SAU).
5. **Excel khớp màn hình (DEC-129):** đổi cột trên màn → sửa sheet; Tồn vỏ có test so thứ tự cột. Test đọc ô Excel phải dùng `columns.indexOf`, không dùng chỉ số cố định.
6. **Xuất tàu (DEC-131):** `holdSource = 'VESSEL_EXPORT'` — chỉ `vesselLock` / `vesselUnlock` trong `vessel.ts` được đặt / gỡ; `toggleContainerHold` / `updateContainerOfficeNote` từ chối loại khóa này.
7. **SlotPicker (DEC-125)** là component chọn từng bước — giữ nguyên props (state, value, onChange, onlyBlocks).
8. Bẫy đã gặp hôm nay: chèn `import` vào giữa khối import nhiều dòng; chèn comment `//` giữa dòng mảng làm mất phần tử phía sau; đổi `const` → `let` bằng sed áp cho mọi dòng giống nhau — luôn kiểm `git diff` sau khi sửa bằng script. Thêm: heredoc của shell làm mất dấu `\` trong regex — viết script bằng công cụ Write.
9. **Bảng / danh sách (DEC-134, DEC-135):** `<table>` có `whitespace-nowrap` trong `overflow-x-auto`; ô chữ tự do dùng `<CellText text max={CELL_MAX.SHORT|MEDIUM|LONG} />` (20 / 30 / 40 ký tự) — không tự viết `truncate`. Smoke test kiểm `whitespace-nowrap` ở Phiếu thu + 5 báo cáo.
10. **Vị trí (DEC-136):** giao diện dùng `<LocationText loc />` / `BlockIcon` / `blockLabel`; chỉ dữ liệu lưu, Danh mục, Excel, in, thông báo mới dùng `formatLocation` (có chữ BLOCK-).
11. **Hóa đơn theo lượt (DEC-133):** `MasterUsagePanel` nhận prop `invoice` (view, canIssue, onIssue); chi tiết 1 yêu cầu = `InvoiceGroupDetail`.
12. **Thông tin tự điền (DEC-137):** khu vực hiển thị thông tin được chọn từ danh sách (VD "Container được chọn" ở Cấp vỏ) phải chia **ô có nhãn, chỉ đọc** (nền xám nhạt), không nối chữ bằng "•".
13. **Khung thao tác trong dòng bảng rộng (DEC-138):** thẻ gọn `sticky left-4 max-w-lg` (giống Đảo chuyển), nút chính `w-full` ở cuối — không trải theo chiều rộng bảng. SSR test không mở được khung này (cần bấm) → kiểm tay trên trình duyệt.
15. **Giao diện v2 (DEC-145):** chuẩn ở `docs/DESIGN_SYSTEM.md`, token trong `src/index.css` (`@theme`) — màu dùng `bg-navy-900`, `text-ink`, `text-ink-muted`, `border-line`, `bg-canvas`, `bg-op-*`. Test DEC-145 quét `src/**/*.tsx` và **báo lỗi nếu có `bg-blue-600`, `text-blue-700`, `bg-slate-900`, `text-slate-900/700/500`, `border-slate-200/300`, `bg-slate-50`**. Bản Claude Design: https://claude.ai/artifact/EvcTG1G1NN8EmHAp8j5t8E (bản sao ở `docs/design/`).
16. **W-SURVEY (DEC-147):** giá trị `FieldConditionClass` = `'W-SURVEY'` (`CONDITION_DEFERRED`); khi đó `stuffingClass` / `manufactureYear` trống (kiểu đã là optional ở GateInOrder / ContainerRecord / K80). Hàm: `pendingRackInspections`, `completeRackInspection`; `releaseBlocker` chặn Cấp vỏ (Q-042). `InspectionFields`: `allowDeferred` chỉ ở Hạ vỏ, `hideCleaning` cho form bổ sung. Hiển thị Đóng hàng / AGE trong chuỗi phải có `|| '-'`.
17. **Dữ liệu test (DEC-148):** `seedCatalog` (xóa danh mục mặc định rồi thêm MSK, KH01–KH10, công ty, 6 biểu giá bằng hàm Admin) + `bulkData` (khối lớn). ID biểu giá sinh ngẫu nhiên → lấy qua `FEES` sau khi seed. Test tự động vẫn dùng `createInitialState()` (danh mục cũ: MAERSK, VIETLOG…) — đừng nhầm.
 hãy dùng `split().join()` hoặc công cụ Edit. sed / heredoc trong Bash làm mất `\` và vỡ dấu ` → luôn viết script bằng Write rồi chạy node; lệnh `&&` vẫn commit dù build lỗi nếu build không nằm trong chuỗi — chạy test + build trước, commit sau.
14. **Thứ tự cột (DEC-139 → DEC-141):** bảng có container bắt đầu **Mã hồ sơ | Số container | Size | Type | Hãng tàu** (tàu: Tên tàu trước); Excel cùng thứ tự (test so `columns.slice`). **Không** làm cố định cột (sticky) — người dùng đã bỏ (DEC-141). Bảng báo cáo chỉ hiện sau khi bấm Tra cứu → SSR test không thấy bảng; kiểm tay.

### I.3 — Bổ sung 2026-10-25
**Cho bạn:** test theo mục F3 với dữ liệu test; ghi lại lỗi / chỗ chưa hợp lý; khi thấy ổn thì báo để mở GĐ 4 (trả lời Q-037 → Q-040) và tạo PR merge vào `main`.

**Cho agent:**
1. Hiện tới **DEC-132**; mỗi yêu cầu mới → 1 DEC, 2 commit (code / tài liệu). **GĐ 4 đang tạm hoãn theo người dùng — không tự viết migration.**
2. **Thanh toán:** hiển thị TT / TTR / TTS, mã nội bộ vẫn TTTT / TTT / TTS (DEC-100). Mã phiếu thu `PT-TT-YYMMDD-NNNN` / `PT-TTR-YYMMDD-NNNN` (DEC-098); TTS không cấp phiếu thu. Không hiển thị chứng từ `CT-` ở Tồn vỏ / Phiếu thu (DEC-104, 107). Viết **"Phiếu thu trả trước"**, không viết "phiếu thu mẹ" (DEC-103).
3. **Dữ liệu test:** `src/services/demoData.ts` (`createDemoState`) tạo bằng hàm service thật; thêm trường hợp mới → thêm vào đây + `tests/demo-data.test.ts`. Đổi cấu trúc dữ liệu → tăng `STORAGE_KEY` (hiện v9) để máy người dùng nạp lại dữ liệu test.
4. **Hạ kệ giám định (DEC-109):** cờ `forkliftShiftTask = 'HA_KE_GIAM_DINH'`; kiểm tra ở `updateContainerLocation`; `SlotPicker onlyBlocks`; Đảo chuyển xóa cờ.
5. **Bộ lọc thời gian:** chỉ dùng `DateRangeFilter` (DEC-102).
6. **Shell trên máy này làm mất dấu gạch chéo ngược và đổi ký tự xuống dòng** khi chèn qua node -e / sed → viết script vào file scratchpad bằng heredoc, hoặc dùng Edit; regex có chữ d / dấu / thoát thì sửa bằng Edit. Máy không có Python.
7. **Xuất hóa đơn (DEC-111 → 114):** nghiệp vụ ở `src/services/invoice.ts` (`generateInvoiceSecret`, `lookupInvoicePortal`, `submitInvoiceRequest`, `markInvoiceIssued`); trang khách `src/features/invoice/InvoicePortal.tsx`, mở bằng hash `#/hoa-don` (định tuyến ở `src/main.tsx`, không qua `App`). Mã bảo mật: in trên phiếu + hiện ở khối Xuất hóa đơn, **không** vào Excel. Vai trò **ACCOUNTANT** (Kế toán) đã thêm lại: chỉ menu Phiếu thu + `INVOICE_ISSUE`. Người thu tiền trên phiếu: `receiptCollectorName`. Khi lên database: trang khách phải là RPC công khai có **giới hạn số lần thử** (chống dò mã) + email báo Kế toán; điều chỉnh / thay thế hóa đơn đã xuất chưa có quy trình (Kế toán xử lý trên MISA).
8. `STORAGE_KEY` hiện **v13** (tăng mỗi khi dữ liệu test đổi cấu trúc).
10. **Link dữ liệu (DEC-117, 118):** mã nào có hồ sơ / phiếu lưu trữ thì phải là link, dùng `linkCls` (`shared.tsx`); trong dòng bảng có `onClick` thì nút link gọi `e.stopPropagation()`. Phiếu thu có hàm `openMaster(code)` mở phiếu nạp của phiếu thu trả trước.
11. **Mobile (DEC-115, 116):** ô nhập / chọn chữ 16px trên màn < 640px (`src/index.css`) — đừng ghi đè. Danh sách Đảo chuyển đúng 2 dòng (`overflow-hidden whitespace-nowrap`); đã bỏ ghi chú tác nghiệp khi đảo chuyển. Test không nạp được CSS (Vite trả rỗng) — quy tắc CSS kiểm bằng tay trên điện thoại.
12. **Không cài được `@types/node`** (không tự cài package) → test không dùng `node:fs`.
9. Tư vấn API ngân hàng (2026-10-25, chưa ghi tài liệu riêng): cần GĐ 4 trước; đề xuất cổng trung gian (payOS / Casso / SePay) + VietQR nội dung = mã tham chiếu + webhook trên Edge Function có kiểm chữ ký + chống trùng + danh sách chờ đối soát; người dùng chưa chốt (Q-032).

### I.2 — Bổ sung sau phiên 2 (2026-10-24)

**Cho bạn:**
1. **Bấm Reset demo** trước khi thử: dữ liệu mẫu đã đổi (BLOCK-B thành Block chỉ có tên — DEC-082). Dữ liệu cũ trên trình duyệt vẫn giữ cấu hình Block cũ.
2. Ưu tiên thử trên **điện thoại thật**: Xe nâng → Đảo chuyển (DEC-094 → 096), danh sách chờ Vệ sinh / Xe nâng (DEC-089), Giám định / Xe nâng → Nhập / Xuất tàu. Máy rất hẹp (~360px) với mã Block dài có thể bị dồn dòng — chụp ảnh gửi nếu thấy rối.
3. Thử **Báo giá 2 bước** (Cập nhật → Xác nhận chờ sửa chữa, cả hàng loạt) và **khách hàng gõ tay** ở Hạ vỏ / Cấp vỏ (khách ngoài Danh mục chỉ thanh toán Tiền mặt / Chuyển khoản).
4. In thử **EEIR Nhập / Xuất tàu** từ hồ sơ NT- / XT-.
5. Đọc `docs/DATABASE_PLATFORM_ADVICE.md` và trả lời **A.2 + A.6** để mở GĐ 4 Database.

**Cho agent:**
1. Hiện tới **DEC-096**; mỗi yêu cầu mới → 1 DEC, 2 commit (code / tài liệu).
2. File hay sửa phiên này: `src/features/forklift/YardShiftWorkspace.tsx`, `src/features/field-queues/FieldQueueWorkspaces.tsx` (`QueueListRow`), `src/features/quotation/QuotationWorkspace.tsx`, `src/components/InspectionFields.tsx`, `src/components/ReceiptPrint.tsx` (`VesselEeirPrintSheet`, `ConditionBox`), `src/services/core.ts` (`blockDimensions`, `validateTargetSlot`).
3. **Vị trí:** chỉ dùng `SlotPicker` / `isSlotComplete(slot, state)` / `blockDimensions`. Chỉ chặn trùng khi đủ 4 phần (DEC-087).
4. **Danh sách mobile:** số cont và vị trí phải thẳng cột. Ô nhãn bên trái cùng kích thước (`5rem`, `px-1.5 py-1 text-[10px]` — DEC-096).
5. **Đã gặp lại 3 lần** lỗi khi sửa bằng perl / sed: mất `\` trong regex (`\s` → `s`), mất `${…}`, chèn lên đầu file khi dùng dấu phân cách `|`. Một số file dùng **CRLF**, nên chỉ mục / regex có thể không khớp. → **Dùng Edit / Write**; nếu bắt buộc dùng perl thì kiểm tra lại dòng vừa sửa bằng `grep` / `sed -n` ngay sau đó.
6. **Database:** đọc `DATABASE_CONTRACT.md` mục 8–10 + `DATABASE_PLATFORM_ADVICE.md` mục 5 (11 tình huống: mất mạng hiện trường, thao tác đồng thời, webhook lặp, chuyển Demo → thật…) trước khi viết P4-01. **Chỉ viết migration, không apply.**
- 2026-10-24 (phiên 2, tối) — Claude Code: tư vấn nền tảng database (docs/DATABASE_PLATFORM_ADVICE.md, Q-040); cập nhật tiến độ, bàn giao, mục I.2; kiểm tra + push đầy đủ (DEC-050 → DEC-096).
- 2026-10-25 — Claude Code: P7-26 (DEC-097) TTTT đứng đầu. 97/97 • build PASS.
- 2026-10-25 — Claude Code: P7-27 (DEC-098 → 101) mã phiếu thu, Tồn vỏ thanh toán, ký hiệu TT/TTR/TTS, menu Sửa chữa; Q-041 hóa đơn. 99/99 • build PASS.
- 2026-10-25 — Claude Code: P7-28 (DEC-102) lọc nhanh thời gian. 100/100 • build PASS.
- 2026-10-25 — Claude Code: sửa DEC-100 (TT / TTR / TTS); DEC-103 "Phiếu thu mẹ" → PHIẾU THU TRẢ TRƯỚC. 100/100 • build PASS.
- 2026-10-25 — Claude Code: DEC-104 Tồn vỏ chỉ hiện MÃ PHIẾU THU. 100/100 • build PASS.
- 2026-10-25 — Claude Code: DEC-105 link mã phiếu thu ở Tồn vỏ; DEC-106 dữ liệu sạch + nút Xóa dữ liệu; DEC-107 Phiếu thu bỏ chứng từ, số cont cạnh tác nghiệp. 102/102 • build PASS.
- 2026-10-25 — Claude Code: DEC-108 dữ liệu test đầy đủ trường hợp + nút Nạp dữ liệu test. 103/103 • build PASS.
- 2026-10-25 — Claude Code: DEC-109 Hạ kệ giám định (Giám định tích → Xe nâng chỉ hạ kệ → Đảo chuyển). 106/106 • build PASS.
- 2026-10-25 — Claude Code: DEC-110 Trả chứng từ — nút Xem trước. 107/107 • build PASS.

- 2026-10-25 — Claude Code: DEC-111 mã bảo mật phiếu thu + trang khách yêu cầu xuất hóa đơn + vai trò Kế toán. 115/115 • build PASS.
- 2026-10-25 — Claude Code: DEC-112 hiện mã bảo mật ở khối Xuất hóa đơn. 115/115 • build PASS.
- 2026-10-25 — Claude Code: DEC-113 người thu tiền là nhân viên; hướng dẫn xuất hóa đơn; link ở khối Xuất hóa đơn. 116/116 • build PASS.
- 2026-10-25 — Claude Code: DEC-114 hướng dẫn xuất hóa đơn rút gọn, đặt dưới ô mã. 116/116 • build PASS.
- 2026-10-25 — Claude Code: quyết định tạm hoãn GĐ 4 (người dùng test Demo trước); cập nhật tiến độ, F3, bàn giao I.3; kiểm tra + push đầy đủ (DEC-050 → DEC-110).
- 2026-10-25 (tối) — Claude Code: DEC-118 mọi mã có hồ sơ đều là link. 117/117 • build PASS.
- 2026-10-25 (tối) — Claude Code: DEC-117 link dữ liệu thống nhất kiểu Mã hồ sơ (`linkCls`). 117/117 • build PASS.
- 2026-10-25 (tối) — Claude Code: DEC-116 ô nhập mobile không phóng to; Đảo chuyển bỏ ghi chú. 117/117 • build PASS.
- 2026-10-25 (tối) — Claude Code: DEC-115 Đảo chuyển mobile 2 dòng. 116/116 • build PASS.
- 2026-10-25 (tối) — Claude Code: cập nhật tiến độ, F3.20, bàn giao I.3 (xuất hóa đơn, Kế toán, STORAGE_KEY v10); kiểm tra + push đầy đủ (DEC-050 → DEC-114).
- 2026-10-25 (khuya) — Claude Code: cập nhật tiến độ, F3.21–22, bàn giao I.3 (mục 10–12); kiểm tra + push đầy đủ (DEC-050 → DEC-118).
- 2026-10-26 — Claude Code: DEC-119 bỏ mã CT-, số chứng từ = mã hồ sơ. 118/118 • build PASS.
- 2026-10-26 — Claude Code: DEC-120 Góp ý (nút header + Báo cáo → Góp ý chỉ Admin). 124/124 • build PASS.
- 2026-10-26 — Claude Code: DEC-121 phiếu thu trả trước — cột Mã hồ sơ = tác nghiệp đã dùng phiếu. 125/125 • build PASS.
- 2026-10-26 — Claude Code: DEC-122 phiếu thu trả trước — cột Mã hồ sơ chỉ hiện tóm tắt, bấm xem chi tiết. 125/125 • build PASS.
- 2026-10-26 — Claude Code: DEC-123 Góp ý chọn Menu chính → Tính năng → Nội dung. 125/125 • build PASS.
- 2026-10-26 — Claude Code: DEC-124 phiếu thu trả trước một mã PT-TTR- (bỏ PTT-). 125/125 • build PASS.
- 2026-10-26 — Claude Code: DEC-125 chọn vị trí từng bước (SlotPicker). 126/126 • build PASS.
- 2026-10-26 — Claude Code: DEC-126 báo cáo Hạ vỏ / Cấp vỏ có cột Thanh toán + Mã phiếu thu; đổi tên cột. 127/127 • build PASS.
- 2026-10-26 — Claude Code: DEC-127 cột Thanh toán bỏ ký hiệu. 127/127 • build PASS.
- 2026-10-26 — Claude Code: DEC-128 Tồn vỏ cột Phân loại. 127/127 • build PASS.
- 2026-10-26 — Claude Code: DEC-129 Tồn vỏ AGE / Tiến độ đổi chỗ; Excel khớp màn hình. 128/128 • build PASS.
- 2026-10-26 — Claude Code: DEC-130 hóa đơn phiếu thu trả trước theo từng lượt (khách tự gộp). 129/129 • build PASS.
- 2026-10-26 — Claude Code: DEC-131 Xuất tàu tự khóa + ghi chú; duyệt tàu khi chưa đủ (gạch cont không kịp). 130/130 • build PASS.
- 2026-10-26 — Claude Code: DEC-132 Tồn vỏ mỗi cont 1 dòng. 130/130 • build PASS.
- 2026-10-26 — Claude Code: cập nhật tiến độ, F4, bàn giao I.4; kiểm tra + push đầy đủ (DEC-050 → DEC-132).
- 2026-10-26 — Claude Code: DEC-133 cột HÓA ĐƠN từng lượt ở bảng Sử dụng phiếu thu trả trước (`InvoiceGroupDetail`). 130/130 • build PASS.
- 2026-10-26 — Claude Code: DEC-134 bảng / danh sách mỗi thông tin 1 dòng (Phiếu thu + 5 báo cáo), ghi thành quy tắc chung. 131/131 • build PASS.
- 2026-10-26 — Claude Code: DEC-135 giới hạn chữ mỗi ô bảng (`CellText`, `CELL_MAX` 20/30/40). 132/132 • build PASS.
- 2026-10-26 — Claude Code: DEC-136 vị trí hiển thị icon định vị thay chữ BLOCK- (`LocationText`). 133/133 • build PASS.
- 2026-10-26 (tối) — Claude Code: cập nhật tiến độ, F4 (bước 9–11), bàn giao I.4 (mục 9–11); kiểm tra + push đầy đủ (DEC-050 → DEC-136).
- 2026-10-26 — Claude Code: DEC-137 Cấp vỏ — Container được chọn chia 6 ô. 134/134 • build PASS.
- 2026-10-26 (tối) — Claude Code: cập nhật tiến độ, F4 bước 12, bàn giao I.4 mục 12, AGENTS (DEC-137); kiểm tra + push đầy đủ (DEC-050 → DEC-137).
- 2026-10-26 — Claude Code: DEC-138 Tồn vỏ → Sửa vị trí gọn như Đảo chuyển (nút Lưu luôn thấy). 134/134 • build PASS.
- 2026-10-26 (tối) — Claude Code: cập nhật tiến độ, F4 bước 13, bàn giao I.4 mục 13 (DEC-138); kiểm tra + push đầy đủ (DEC-050 → DEC-138).
- 2026-10-26 — Claude Code: DEC-139 cố định cột đầu (Tồn vỏ + 5 báo cáo), Excel cùng thứ tự. 137/137 • build PASS.
- 2026-10-26 — Claude Code: DEC-140 báo cáo tàu tách cột Trạng thái / Phân loại. 138/138 • build PASS.
- 2026-10-26 — Claude Code: DEC-141 bỏ cố định cột (giữ thứ tự cột DEC-139). 137/137 • build PASS.
- 2026-10-26 (tối) — Claude Code: cập nhật tiến độ, F4 bước 14, bàn giao I.4 mục 14 (DEC-139 → DEC-141); kiểm tra + push đầy đủ (DEC-050 → DEC-141).
- 2026-10-26 — Claude Code: DEC-142 Chờ báo giá mỗi cont 1 dòng như Tồn vỏ. 138/138 • build PASS.
- 2026-10-26 — Claude Code: DEC-143 tài khoản do Admin tạo, đăng nhập, mật khẩu mặc định 123456 + bắt buộc đổi lần đầu. 144/144 • build PASS.
- 2026-10-26 — Claude Code: DEC-144 User - Role (tên đăng nhập tuan.lv, mật khẩu độ dài tùy ý, bộ lọc + nút Thêm). 147/147 • build PASS.
- 2026-10-26 — Claude Code: hoàn tác đăng nhập Demo (DEC-143/144) — giữ tài khoản demo + tên menu User - Role; quy tắc tài khoản chuyển thành việc của GĐ 4. 138/138 • build PASS.
- 2026-10-26 — Claude Code: DEC-145 design system v2 bước 1/5 (token + font + thành phần dùng chung), nhánh `agent/claude/ui-design-v2`. Còn: khung App / menu, Tồn vỏ, màn mobile, các màn khác. 139/139 • build PASS.
- 2026-10-26 — Claude Code: DEC-145 xong 5/5 bước (App, Tồn vỏ, mobile, văn phòng / báo cáo / in). 139/139 • build PASS. Chưa xem trực quan trên trình duyệt.
- 2026-10-26 — Claude Code: lưu design system vào repo (`docs/DESIGN_SYSTEM.md`, `docs/design/`), skill UI + test chặn màu cũ. 140/140 • build PASS.
- 2026-10-26 — Claude Code: DEC-146 bảng chi tiết tàu không gộp cột, 1 dòng. 141/141 • build PASS.
- 2026-10-26 — Claude Code: DEC-147 W-SURVEY (LÊN KỆ) + giám định bổ sung trên kệ; Q-042 mở (chặn Cấp vỏ). 145/145 • build PASS.
- 2026-10-26 — Claude Code: DEC-148 dữ liệu test (MSK, 10 khách, công ty MATRAN, biểu giá mới, danh sách lớn ~96 Hạ vỏ / 26 Cấp vỏ / 6 tàu). 147/147 • build PASS.
- 2026-10-26 (khuya) — Claude Code: cập nhật tiến độ, A (1b, 1c), F5, bàn giao I.4 mục 15–18, khóa lưu v14; kiểm tra + push đầy đủ nhánh `agent/claude/ui-design-v2` (DEC-050 → DEC-148).
- 2026-10-26 (khuya) — Claude Code: lưu mốc Demo (nhánh backup + tag), mở GĐ 4 (DEC-149: Supabase Singapore, trạng thái theo Demo), viết `docs/STATUS_CATALOG.md` chờ duyệt.
- 2026-10-26 (khuya) — Claude Code: DEC-150 chốt quy mô / ảnh / thời gian lưu / trạng thái / W-SURVEY; bắt đầu P4-01 thiết kế schema.
- 2026-10-26 (khuya) — Claude Code: DEC-151 (đăng nhập, mất mạng, partition); viết `docs/DATABASE_SCHEMA.md` v1 chờ duyệt (P4-01 phần thiết kế).
- 2026-10-26 (khuya) — Claude Code: DEC-152; P4-01 migration bước 1/5 (`supabase/migrations/20261027000001` → `000005`, pgTAP 0001, seed, README). Chưa chạy thử SQL (chưa có Docker / Postgres). npm test / build không đổi.
- 2026-10-27 — Claude Code: Docker + Supabase local; migration bước 1 apply OK, pgTAP 18/18 (DEC-153). Tiếp: bước 2.
- 2026-10-27 — Claude Code: migration bước 2/5 (Hạ vỏ hiện trường, bãi, vệ sinh / báo giá / sửa chữa, W-SURVEY) — pgTAP 50/50 trên Supabase local. Tiếp: bước 3 (Văn phòng Hạ vỏ, thanh toán, phiếu thu, trả trước, hóa đơn).
- 2026-10-27 (tối) — Claude Code: cập nhật tiến độ, A.1a, bàn giao I.5 (database); push đầy đủ nhánh `agent/claude/p4-database` (bước 1 + 2, pgTAP 50/50).
- 2026-10-27 — Claude Code: migration bước 3/5 (thanh toán, phiếu thu, trả trước, hóa đơn, Văn phòng Hạ vỏ + GATE IN OK) — DEC-154; pgTAP 107/107 local. Tiếp: bước 4.
- 2026-10-27 — Claude Code: migration bước 4/5 (Cấp vỏ, booking, xuất bãi, Nhập / Xuất tàu) — pgTAP 147/147 local. Tiếp: bước 5.
- 2026-10-27 — Claude Code: migration bước 5a (pg_cron, kho ảnh, ảnh hết hạn) — pgTAP 158/158 local; Q-043 giữ booking không số lượng.
- 2026-10-27 — Claude Code: bước 5b Edge Function (tạo tài khoản, đặt lại mật khẩu, xóa ảnh hết hạn) — 16/16 local; cả database 158/158. Tiếp: nối app với database.
- 2026-10-27 — Claude Code: DEC-155 cách nối app với database (giữ màn hình, cửa chung runAction, 8 giai đoạn N1 → N8 — docs/APP_DB_INTEGRATION.md). Bắt đầu N1.
- 2026-10-27 — Claude Code: nối app N1 — màn đăng nhập / đổi mật khẩu / đăng xuất, tải danh mục từ database; test thật local OK. 156 test + build PASS.
- 2026-10-27 (tối) — Claude Code: sửa PROGRESS.md bị nhân bản 5 lần (lỗi String.replace từ commit d01b08b, 1.890 → ~430 dòng, không mất nội dung); viết lại I.5 theo trạng thái thật. 157 test (2 bỏ qua) • build PASS.
- 2026-10-27 (tối) — Claude Code: N7 báo cáo theo khoảng lọc (DEC-157), Nhập tàu không chụp ảnh (DEC-156). 160 test (2 bỏ qua, chạy thật local pass) • build PASS.
- 2026-10-27 (khuya) — Claude Code: N8 (DEC-158) đồng bộ phần thay đổi + mất mạng + đo tốc độ quy mô thật; DEC-159 ảnh giữ 2 tháng; Q-044 import tồn vỏ. 163 test (3 bỏ qua, chạy thật local pass) • pgTAP 180/180 • build PASS.
- 2026-10-27 (khuya) — Claude Code: hướng dẫn môi trường TEST nhiều người, script danh mục test + Admin đầu tiên (chạy thử local OK, sửa lỗi hướng dẫn thiếu ::matran), bộ câu hỏi import tồn vỏ (Q-044). 163 test • pgTAP 180/180.
- 2026-10-27 (trưa) — Claude Code: thêm Bước 5A Vercel cho giai đoạn test (giữ Cloudflare cho chạy thật); bàn giao I.5 "phiên sau làm gì đầu tiên"; push đầy đủ nhánh.
- 2026-10-27 (chiều) — Claude Code + bạn: dựng môi trường TEST trên cloud (Supabase `matran-test` + Vercel từ `main`), đăng nhập Admin OK; sửa script danh mục test thiếu Size / Type; ghi chú phiên sau (I.5).
- 2026-10-28 — Claude Code: sửa 3 điểm từ đợt test 1 (biểu giá rác / khác, danh mục tổ sửa chữa, kính lúp ảnh). 165 test • pgTAP 184/184 • build PASS.
- 2026-10-28 — Claude Code: tốc độ mở app + giao diện chờ (tải song song, tách file theo màn, màn chờ ngay từ HTML). 165 test • test thật local pass • build PASS.
