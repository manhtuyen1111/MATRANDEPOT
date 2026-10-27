# NỐI APP VỚI DATABASE (GĐ 4 — DEC-155)

Cách làm đã chốt: **giữ màn hình, đổi lớp dữ liệu.**

- Không có cấu hình Supabase → app chạy **Demo** như cũ (localStorage).
- Có cấu hình → app chạy **database thật**.

## Nguyên tắc

1. **Giao diện gần như giữ nguyên.** Màn hình vẫn đọc `DepotState` và vẫn có `onUpdateState`. Chỗ gọi hàm nghiệp vụ đổi sang gọi qua một cửa chung `runAction(...)`.
2. **Một cửa chung cho mọi thao tác** (`src/services/actions.ts`):
   - **Demo:** chạy đúng hàm nghiệp vụ hiện có trong `src/services/` rồi lưu localStorage.
   - **Database:** gọi RPC tương ứng (cùng tên, cùng quy tắc — đã có test pgTAP), rồi **tải lại dữ liệu đang làm việc**.
   - Lỗi từ database là câu tiếng Việt giống hệt bản Demo, nên `Feedback` hiển thị như cũ.
3. **Dữ liệu đang làm việc** (tải khi mở app và sau mỗi thao tác) gồm:
   - danh mục;
   - container **đang trong bãi**;
   - hồ sơ Hạ vỏ / Cấp vỏ **chưa xong** và của **hôm nay**;
   - danh sách tàu đang mở;
   - phiếu thu / giao dịch đang chờ.

   Không tải toàn bộ lịch sử (DEC-066).
4. **Báo cáo, tra cứu lịch sử, Phiếu thu nhiều ngày:**
   - lấy theo trang từ database;
   - bắt buộc lọc thời gian, tối đa 3 tháng;
   - phân trang 20 / 50 / 100;
   - Excel lấy theo lô 1.000 dòng.
5. **Mỗi lần bấm gửi kèm `request_id`.** Mạng chập chờn bấm lại không tạo trùng. Mất mạng thì báo lỗi, giữ dữ liệu trên màn (DEC-151).
6. **Không đổi quy tắc nghiệp vụ** trong lúc nối. Phát hiện chỗ Demo khác database → báo người dùng.

## Các giai đoạn (mỗi giai đoạn: làm → thử trên Supabase local → commit → báo)

| GĐ | Nội dung | Kiểm tra |
|---|---|---|
| N1 ✅ (2026-10-27) | **Nền:** chế độ chạy, đăng nhập bằng tên đăng nhập, bắt buộc đổi mật khẩu lần đầu (ghép `::matran` — DEC-153), đăng xuất, tải hồ sơ nhân viên + vai trò; cửa chung `runAction`; tải danh mục | Đăng nhập / đổi mật khẩu / đăng xuất trên local; app Demo không đổi (148 test) |
| N2 | **Danh mục + User - Role:** đọc / sửa Danh mục, tạo tài khoản / đặt lại mật khẩu qua Edge Function | Admin tạo nhân viên, nhân viên đăng nhập |
| N3 | **Hạ vỏ:** Giám định (ảnh lên kho `door-photos`, nén ~200 KB), W-SURVEY, Văn phòng Hạ vỏ + thanh toán, K80 / EEIR / phiếu thu in | Đi đủ 1 lượt Hạ vỏ trên local |
| N4 | **Hiện trường:** Vệ sinh, Xe nâng (hạ vỏ, đảo chuyển), Báo giá, Sửa chữa, giám định trên kệ, Tồn vỏ (khóa, ghi chú, sửa vị trí, hàng loạt) | Đủ luồng DAMAGE → AV |
| N5 | **Cấp vỏ + xuất bãi; Nhập / Xuất tàu** | Đủ luồng cấp vỏ, 1 tàu nhập, 1 tàu xuất |
| N6 | **Phiếu thu, phiếu thu trả trước, xác nhận tay chuyển khoản, trang hóa đơn `#/hoa-don`, Kế toán** | Thu TT / TTR / TTS, hóa đơn theo lượt |
| N7 | **Báo cáo + Excel** theo trang từ database; Góp ý; Trả chứng từ | Lọc 3 tháng, 100 dòng / trang, Excel |
| N8 | **Hoàn thiện:** làm mới dữ liệu khi người khác thao tác (Realtime hoặc tải lại định kỳ), thông báo mất mạng, đo tốc độ với dữ liệu lớn | 50–70 người dùng giả lập |

Còn thiếu ở database (sẽ bổ sung trong giai đoạn tương ứng, kèm test): Góp ý (`feedbacks`), Trả chứng từ (`documents_returned_*`), RPC đọc báo cáo theo trang.

## Thử trên máy

- `.env.local` (Git bỏ qua) chỉ chứa địa chỉ `http://127.0.0.1:54321` + khóa **anon** local mặc định (DEC-155).
- Không bao giờ ghi khóa service_role hay khóa project thật vào file.
- Bật: Docker Desktop → `npx supabase start` → `npm run dev`.
- Xóa / đổi tên `.env.local` thì app quay về Demo.

## Đã làm

- **N1 (2026-10-27):** `src/main.tsx` chọn chế độ; `src/app/RemoteApp.tsx` (đăng nhập → bắt buộc đổi mật khẩu → tải dữ liệu → App); màn `src/features/auth/LoginScreen.tsx` (chia đôi, hiện / ẩn mật khẩu, nhớ tên đăng nhập, quên mật khẩu → Admin, nhãn môi trường); quy tắc `src/services/authPassword.ts`; phiên `src/services/remote/session.ts`; tải danh mục `src/services/remote/loadState.ts`. App chế độ database: header có tên + Đổi mật khẩu + Đăng xuất, ẩn chọn người dùng demo, dòng báo màn tác nghiệp chưa lưu.
  - Kiểm thử: `tests/auth.test.tsx` (7) + `tests/remote.local.test.ts` (chạy thật với Supabase local khi đặt biến MATRAN_LOCAL_*).
  - Cửa chung `runAction` để sang N3 (khi nối thao tác đầu tiên).
