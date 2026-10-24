# AGENTS.md — Luật chung cho mọi AI agent làm việc trên MATRAN DEPOT

Áp dụng cho Claude Code, Antigravity và mọi agent khác. Đọc file này trước khi sửa bất cứ thứ gì.

## 1. Dự án là gì, đang ở đâu

- ERP quản lý **bãi container rỗng**. React 19 + TypeScript + Vite + Tailwind; backend dự kiến Supabase/PostgreSQL.
- **Hiện trạng thật:** ứng dụng chạy **chế độ Demo** — dữ liệu ở localStorage, mọi quy tắc nghiệp vụ và kiểm tra quyền nằm trong `src/services/`. **Chưa có database thật.** Migration trong `supabase/migrations/` là **bản nháp chưa áp dụng, không khớp nghiệp vụ** — không được apply.
- Ngôn ngữ nghiệp vụ, giao diện, tài liệu: **tiếng Việt**.

## 2. Nguồn sự thật (theo thứ tự ưu tiên)

1. `docs/DECISIONS.md` — mục **CONFIRMED** là luật. Mục **OPEN** là chưa được làm theo suy đoán.
2. `docs/BUSINESS_WORKFLOWS.md`, `docs/ROLE_PERMISSION_MATRIX.md` (mục 2A), `docs/DATABASE_CONTRACT.md`, `docs/API_RPC_CONTRACT.md`.
3. Code trong `src/services/` (hợp đồng nghiệp vụ đang chạy) và test trong `tests/`.
4. Code giao diện.

Code mâu thuẫn với DECISIONS → báo lại, không tự chọn bên nào.

## 3. Luật bắt buộc

- **Không tự suy đoán quy tắc nghiệp vụ.** Thiếu thông tin → hỏi người dùng hoặc ghi vào `docs/OPEN_QUESTIONS.md`.
- **Không tạo dữ liệu giả** để giao diện "có vẻ chạy" (không mặc định số tiền, tên nhân viên, biển số, booking, ảnh mẫu).
- **Không đọc / in / commit** `.env` hay bất kỳ khóa bí mật nào. Không đưa service role key vào frontend.
- **Không kết nối, ghi dữ liệu hay chạy migration** lên bất kỳ project Supabase nào. Agent chỉ được viết file migration; người dùng mới là người apply.
- **Không cài / gỡ / nâng cấp package** khi chưa được người dùng đồng ý.
- **Không xóa chức năng đang hoạt động** khi chưa xác định ảnh hưởng (kiểm tra import / tham chiếu trước).
- **Không commit thẳng vào `main`, không `push --force`, không `reset --hard`.** Mỗi việc một nhánh, qua PR.
- Tạo yêu cầu thanh toán / mã QR **không phải** là đã thu tiền. Không bao giờ ghi nhận đã thanh toán khi chưa có xác nhận hợp lệ (DEC-031).

## 4. Kiến trúc phải giữ

- **Mọi quy tắc nghiệp vụ và kiểm tra quyền nằm trong `src/services/`.** Giao diện chỉ gọi hàm service và hiển thị lỗi; không tự kiểm tra điều kiện thay service.
- **Quyền:** chỉ khai báo trong `src/services/permissions.ts` (`PERMISSIONS`, `MENU_ACCESS`). Đổi quyền → cập nhật `docs/ROLE_PERMISSION_MATRIX.md` mục 2A.
- **Mã hồ sơ / phiếu:** chỉ cấp qua `src/services/codes.ts` (`HV-`, `CV-`, `NT-`, `XT-`, `PT-`, `PTT-`, `CT-` — DEC-068). Không sinh mã ở giao diện.
- **Thanh toán:** đi qua `src/services/payments.ts` (chứng từ → giao dịch → phiếu thu).
- Mỗi lượt lưu bãi là một bản ghi container riêng; tìm container đang trong bãi bằng `findActiveContainer`, cập nhật bằng `updateContainerById` (không cập nhật theo số container).
- Thành phần giao diện dùng chung ở `src/components/shared.tsx` (Chi phí, Thanh toán, Chọn vị trí, Phân trang, Thông báo) — tái sử dụng, không chép khối code.
- Danh sách lớn / báo cáo: không tự tải toàn bộ; bắt buộc bộ lọc; có phân trang.

## 5. Kiểm tra trước khi báo xong

```bash
npm test          # phải pass toàn bộ
npm run build     # phải pass (bao gồm kiểm tra TypeScript)
```

Một việc chỉ "xong" khi:
1. Đúng quy tắc CONFIRMED; thay đổi nghiệp vụ mới đã được người dùng xác nhận.
2. Có test cho trường hợp thành công **và** bị từ chối (quyền, trạng thái, dữ liệu sai) ở `tests/`.
3. `npm test` và `npm run build` pass — báo kết quả thật, không đoán.
4. Đã cập nhật tài liệu liên quan: `DECISIONS.md` (quyết định mới), `OPEN_QUESTIONS.md`, `CHANGELOG.md`, và các file trong `docs/` bị ảnh hưởng.
5. Báo cáo rõ: file đã sửa, kết quả kiểm tra, điểm chưa xác nhận / chưa kiểm thử.

## 6. Phối hợp nhiều agent

- Mỗi agent làm trên nhánh riêng: `agent/<tên-agent>/<việc>` (ví dụ `agent/antigravity/menu-icons`). Không hai agent cùng sửa một file trong cùng thời điểm.
- **Vùng do một bên giữ** (agent khác chỉ đề xuất trong PR):
  - `docs/DECISIONS.md`, `docs/OPEN_QUESTIONS.md`, `supabase/**`, `src/services/**`, `src/types/**` — chỉ sửa khi được người dùng giao rõ.
- Agent làm giao diện (`src/features/**`, `src/components/**`) **không thêm quy tắc nghiệp vụ mới**; cần quy tắc mới → đề xuất để người dùng xác nhận rồi mới thêm vào `src/services/`.
- File dễ xung đột: `src/services/depotOperations.ts`, `src/app/App.tsx` — báo trước khi sửa lớn.
- Không agent nào giữ thông tin đăng nhập Supabase.
- Trước khi bắt đầu: `git status` sạch, đã pull nhánh mới nhất; ghi tóm tắt bàn giao trong mô tả PR.

## 7. Tài liệu quy trình & theo dõi

- Quy trình, chia việc Claude / Antigravity, mẫu bàn giao: `docs/agents/WORKFLOW.md`.
- Skills (`.claude/skills/`) và khi nào dùng: `docs/agents/SKILLS.md`. Antigravity đọc trực tiếp các file `SKILL.md`.
- Đọc gì cho từng loại việc (tiết kiệm token): `docs/agents/TOKEN_BUDGET.md`.
- **Tiến độ dự án: `devs/PROGRESS.md`** — đọc mục việc được giao trước khi làm; cập nhật sau khi xong. Lộ trình: `devs/ROADMAP.md`.
- `devs/` là tài liệu cho người giao việc; agent chỉ cập nhật `PROGRESS.md` (và `ROADMAP.md` khi đổi trạng thái giai đoạn).

## 8. Lưu ý chung đã chốt (đọc trước khi sửa giao diện / quyền)

- **Vai trò (8):** Giám định, Văn phòng, Xe nâng, Vệ sinh, Báo giá, Quản lý, Admin, Sửa chữa. **Không** thêm lại Kế toán, Nhân viên cổng, Nhân viên hiện trường, QC Sửa chữa (DEC-047, DEC-049). Vai trò mới phải được người dùng xác nhận.
- **Mỗi vai trò chỉ thấy màn của mình** — cấu hình duy nhất ở `MENU_ACCESS` (`src/services/permissions.ts`). Văn phòng / Quản lý là khối văn phòng; Admin thấy tất cả (DEC-045).
- **Tác nghiệp mobile** (hiện trường dùng điện thoại): Giám định – Hạ vỏ / **Nhập tàu** / **Xuất tàu**, Vệ sinh – Chờ vệ sinh (gồm cả cont Nhập tàu), Xe nâng (Chờ hạ vỏ / Chờ cấp vỏ / **Đảo chuyển** / **Nhập tàu** / **Xuất tàu**), Sửa chữa — tổng **10** biểu tượng mobile.
  - Tiêu đề thống nhất: dòng nhỏ "Bộ phận ..." + tên màn + ô số lượng đang chờ (không thêm mô tả dài).
  - Màn quét mã của Xe nâng (Chờ hạ vỏ / Chờ cấp vỏ) dùng chung **một khung nền đậm**: số container chữ rất lớn → Size / Type + (Trạng thái / Đóng hàng hoặc Vị trí hiện tại). Không lặp lại các thông tin này ở bên dưới (DEC-061).
  - Khung `mx-auto w-full max-w-lg`, một cột, nút lớn, danh sách dạng thẻ (không dùng bảng rộng), "Xem thêm" thay phân trang, phần đang thao tác đặt trên cùng.
  - Đánh dấu `mobile: true` ở mục menu trong `src/app/App.tsx` (hiện biểu tượng điện thoại). Mục mobile có số đếm việc chờ (`badges` trong App) → tự tô **cam + nhấp nháy** khi có việc (DEC-075); thêm màn hiện trường mới thì phải thêm số đếm. Dòng menu 3 cột cố định (tên | biểu tượng mobile | số đếm) để biểu tượng thẳng hàng (DEC-078).
  - Smoke test `tests/ui-smoke.test.tsx` kiểm tra số biểu tượng mobile và `max-w-lg` — thêm màn mobile mới thì cập nhật test này.
- **Màn văn phòng / báo cáo / tra cứu nhiều dữ liệu** (máy tính): theo **`docs/UI_DATA_LIST_STANDARD.md` (DEC-080)** — danh sách full chiều ngang, bắt buộc bộ lọc, `Pager` có chọn 20 / 50 / 100 dòng (`usePageSize`), **bấm dòng mở chi tiết bằng `DetailDrawer` (cửa sổ trượt bên phải)** — không hiện chi tiết bên dưới, nút tác nghiệp cùng hàng nút Tra cứu.
- **Văn phòng làm phần tài chính** (phiếu thu TTT, xác nhận tiền mặt) — không còn Kế toán (DEC-047).
- **Luồng DAMAGE:** Báo giá (remark + giờ công) → Sửa chữa (chọn tổ, mặc định chọn hết nhân viên) → AV. Không có bước QC (DEC-049).
- Tóm tắt toàn bộ logic đã chốt: `devs/PROGRESS.md` mục C.
- **Phiếu K80 = tờ hướng dẫn lái xe** (DEC-052): thông tin chung ở đầu (số cont, số xe, SĐT, thanh toán) → LỘ TRÌNH các bước đánh số có ô ☐ → mã QR. Lộ trình tính trong `src/services/driverRoute.ts` — thêm bộ phận mới vào luồng thì cập nhật `getDriverRoute`. Bước cuối luôn là **Văn phòng → Trả chứng từ** (in EEIR + phiếu thu).
- **Thời gian (DEC-054):** mọi chỗ hiển thị / nhập / lọc / in / Excel đều theo **`dd/MM/yyyy HH:mm:ss`** (24 giờ). Chỉ dùng `formatDateTime` / `parseDateTime` (`src/services/datetime.ts`) và `DateTimeField` (`shared.tsx`). **Cấm** `toLocaleString`, `toLocaleTimeString`, `<input type="date">` trực tiếp.
  - Bộ lọc thời gian ở Phiếu thu / mọi báo cáo **mặc định 1 ngày trước → hiện tại** khi mở lần đầu (`defaultLastDayRange`, DEC-056).
- **Xuất Excel (DEC-055):** màn Phiếu thu và mọi báo cáo phải có nút `ExportExcelButton`, xuất **toàn bộ kết quả theo bộ lọc** (dùng `collectAllPages`), file `.xlsx` qua `toXlsxBuffer`. Báo cáo / danh sách tra cứu mới cũng phải có nút này và đủ cột dữ liệu.
- **Mã QR (DEC-057):** QR phiếu K80 = `QR-<mã hồ sơ>` (HV-/CV-/NT-/XT-), **không bao giờ** tạo theo số container. Phiếu đã trả chứng từ là **đã đóng** (`isTicketClosed`): không in lại, không dùng lại.
- **Hồ sơ container (DEC-058):** đầu trang là thông tin container (số cont chữ lớn); các bộ phận xếp theo thứ tự tác nghiệp, mỗi khối có xác nhận bên phải (✓ HOÀN THÀNH + người + giờ); **Thanh toán** là mục riêng ngay dưới Văn phòng, chỉ 1 lần, có link phiếu thu. Thêm bộ phận mới vào luồng → thêm khối `Step` đúng thứ tự trong `MasterDossierModal.tsx` và cập nhật `getDriverRoute`.
- **Giấy tờ in (DEC-062, DEC-063):** đầu mọi giấy tờ in dùng `CompanyHeader` (thông tin Danh mục → Công ty). Phiếu thu **chỉ** in bằng `ReceiptPrintSheet` + `PrintReceiptButton` (`src/components/ReceiptPrint.tsx`) — mỗi lần in phải gọi `recordReceiptPrint` để đếm số lần in; không tự viết mẫu phiếu thu khác. Vùng in đặt class `print-area` (chỉ vùng này được in). **EEIR** chỉ in bằng `EeirPrintSheet` (Hạ vỏ / Cấp vỏ) và `VesselEeirPrintSheet` (Nhập / Xuất tàu — DEC-081), cùng khung với phiếu thu (DEC-072); khối tình trạng vỏ dùng chung `ConditionBox`. Mỗi phiếu = nửa tờ A4 (khổ A5, class `print-sheet`, `@page a4sheet`); EEIR ghi tình trạng vỏ Giám định, không in bộ phận (DEC-076). Giấy tờ in từ trong cửa sổ (modal) phải đi qua `PrintPortal`, không gọi `window.print()` khi chưa có vùng in.
- **Khóa container (DEC-030, DEC-065):** nội dung khóa = Remark Văn phòng (`officeNote`). Cấp vỏ hiển thị cả cont khóa (`blockedOnlyByHold`) nhưng không cho chọn — phải mở khóa trước.
- **Tồn vỏ (DEC-067):** không có cột Thao tác — khóa tại icon cạnh số cont (đỏ / xám mờ); sửa vị trí, ghi chú bằng bút canh phải trong ô; LƯU BÃI = `storageDays` (ngày hạ = 0); cột **Date in** (`gateInAt`) giữa Hãng tàu và Trạng thái (DEC-074). Thao tác hàng loạt phải đi qua hàm `bulk…` trong service (gọi lại hàm đơn lẻ), không tự lặp ở giao diện.
- **Mã hồ sơ (DEC-068):** `HV-` Hạ vỏ, `CV-` Cấp vỏ, `NT-` Nhập tàu, `XT-` Xuất tàu, `PT-` Phiếu thu, `PTT-` Phiếu thu trước. Mã cũ được đổi tự động khi nạp dữ liệu (`renameLegacyCodes`). Không viết cứng tiền tố ở giao diện.
- **Nhập tàu / Xuất tàu (DEC-069):** nghiệp vụ chỉ ở `src/services/vessel.ts`. Không thu phí, không K80, không Trả chứng từ. Cont NHẬP TÀU sau Giám định đi **chung hàng chờ Vệ sinh / Xe nâng của Hạ vỏ** (không viết luồng riêng); Vệ sinh **không** có menu Nhập tàu (cont NT- nằm trong Chờ vệ sinh). 4 màn hiện trường tàu (Giám định / Xe nâng × Nhập / Xuất) dùng **một** component `VesselFieldMobile`: tiến độ trên cùng, tab Chờ làm / Đã xong / Tất cả, chống làm trùng; trạng thái từng bước chỉ lấy từ `vesselStepInfo` / `vesselStepSummary` (DEC-071). Danh sách cont luôn xếp bằng `sortVesselItems` (size 20 → 40, số cont A→Z — DEC-070); sửa / thêm cont / xóa danh sách chỉ qua `updateVesselList` / `addVesselListItems` / `deleteVesselList` khi chưa duyệt. Bước hạ cont gọi `markVesselImportPlaced` trong `updateContainerLocation`. Cont trong danh sách XUẤT TÀU bị `releaseBlocker` chặn cấp vỏ. Hồ sơ NT- / XT- hiển thị trong `MasterDossierModal` (bước sau khi vào bãi dùng chung `renderYardSteps`).
