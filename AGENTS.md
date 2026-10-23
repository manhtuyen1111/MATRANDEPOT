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
- **Mã hồ sơ / phiếu:** chỉ cấp qua `src/services/codes.ts` (`IN-`, `OUT-`, `PT-`, `PTM-`, `CT-`). Không sinh mã ở giao diện.
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
- **Tác nghiệp mobile** (hiện trường dùng điện thoại): Giám định – Hạ vỏ, Vệ sinh, Xe nâng (Chờ hạ vỏ / Chờ cấp vỏ / **Đảo chuyển**), Sửa chữa.
  - Tiêu đề thống nhất: dòng nhỏ "Bộ phận ..." + tên màn + ô số lượng đang chờ (không thêm mô tả dài).
  - Khung `mx-auto w-full max-w-lg`, một cột, nút lớn, danh sách dạng thẻ (không dùng bảng rộng), "Xem thêm" thay phân trang, phần đang thao tác đặt trên cùng.
  - Đánh dấu `mobile: true` ở mục menu trong `src/app/App.tsx` (hiện biểu tượng điện thoại).
  - Smoke test `tests/ui-smoke.test.tsx` kiểm tra số biểu tượng mobile và `max-w-lg` — thêm màn mobile mới thì cập nhật test này.
- **Màn văn phòng / báo cáo** (máy tính): bảng được, bắt buộc bộ lọc trước khi tải dữ liệu, có phân trang.
- **Văn phòng làm phần tài chính** (phiếu thu TTT, xác nhận tiền mặt) — không còn Kế toán (DEC-047).
- **Luồng DAMAGE:** Báo giá (remark + giờ công) → Sửa chữa (chọn tổ, mặc định chọn hết nhân viên) → AV. Không có bước QC (DEC-049).
- Tóm tắt toàn bộ logic đã chốt: `devs/PROGRESS.md` mục C.
