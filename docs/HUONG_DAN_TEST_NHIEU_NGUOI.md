# Hướng dẫn dựng môi trường TEST cho nhiều người

Mục tiêu: nhiều nhân viên cùng thử app trên **một database chung**, từ máy tính và điện thoại.

- Database: **Supabase project TEST** (không phải production).
- App: **Cloudflare Pages**, có HTTPS (điện thoại cần HTTPS mới chụp ảnh được).

Bạn tự làm các bước dưới. Agent không giữ khóa và không kết nối project thật (AGENTS.md).

Thời gian: khoảng 30–45 phút cho lần đầu.

---

## Bước 1 — Tạo project Supabase TEST

1. Vào https://supabase.com → **New project**.
   - Tên: `matran-test`.
   - Region: **Southeast Asia (Singapore)** (DEC-149).
   - Đặt **Database password**, lưu vào nơi an toàn. Không gửi cho ai, không dán vào chat.
2. Gói **Free** đủ để test.
   - Project Free tự tạm dừng nếu 7 ngày không ai dùng. Vào trang Supabase bấm **Restore** là chạy lại.
3. **Authentication → Sign In / Providers → Email:**
   - **tắt** "Confirm email";
   - giữ độ dài mật khẩu tối thiểu **6**.

## Bước 2 — Đưa cấu trúc database lên (migration)

Mở terminal trong thư mục dự án (nhánh `agent/claude/p4-database`), rồi chạy:

```bash
npx supabase login                               # mở trình duyệt để đăng nhập Supabase
npx supabase link --project-ref <mã-project>     # mã ở Project Settings → General → Reference ID
npx supabase db push                             # chạy toàn bộ migration lên project TEST
npx supabase functions deploy                    # đưa 3 Edge Function (tạo nhân viên, đặt lại mật khẩu, xóa ảnh hết hạn)
```

- `db push` hỏi xác nhận thì gõ `y`.
- **Kiểm tra trước khi gõ `y`:** cuối dòng `link` phải hiện đúng tên `matran-test`, không phải production.

## Bước 3 — Danh mục test + Admin đầu tiên

1. **SQL Editor → New query:** dán toàn bộ `supabase/test-data/01_danh_muc_test.sql`, bấm **Run**.
   - Kết quả: hãng tàu MSK, khách KH01–KH10, biểu giá, 4 Block, tổ sửa chữa, thông tin công ty.
2. **Authentication → Users → Add user → Create new user:**
   - Email `admin@matrandepot.local`.
   - Password **`<mật khẩu>::matran`**. Ví dụ muốn dùng `123456` thì gõ `123456::matran` (DEC-153).
   - Tích **Auto Confirm User**.
3. **SQL Editor:** dán `supabase/test-data/02_admin_dau_tien.sql`, bấm **Run**.
   - Phải ra 1 dòng `admin | ADMIN`.

## Bước 4 — Lịch xóa ảnh hết hạn (2 tháng — DEC-159)

Làm theo mục **"Lịch xóa ảnh hết hạn"** trong `supabase/README.md` (Vault + 1 câu SQL).

Có thể để sau. Trong thời gian test chưa có ảnh nào quá 2 tháng.

## Bước 5A — Đưa app lên Vercel (dùng cho giai đoạn TEST — bạn đã có tài khoản)

1. Vào https://vercel.com → **Add New → Project** → chọn repo `MATRANDEPOT` (đã nối GitHub).
2. Cấu hình:
   - Framework Preset: **Vite** (Vercel tự nhận).
   - Build Command `npm run build`, Output Directory `dist` (để mặc định).
   - App dùng địa chỉ dạng `#/…` nên **không cần** cấu hình chuyển hướng.
3. **Environment Variables**: 3 biến `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_APP_ENV=test`, giống bảng ở Bước 5 bên dưới. **Không** dán khóa service_role / secret.
4. Bấm **Deploy**.
   - Vercel build nhánh mặc định (`main`). Muốn test nhánh `agent/claude/p4-database`, vào **Settings → Git → Production Branch**, đổi thành `agent/claude/p4-database`, rồi bấm **Redeploy**.
   - Mỗi lần push nhánh, Vercel tự build lại.
5. Nhận địa chỉ dạng `https://matrandepot.vercel.app`, có sẵn HTTPS nên điện thoại chụp ảnh được.
6. **Lưu ý:** gói Hobby (miễn phí) của Vercel chỉ cho dùng **phi thương mại**. Dùng để test thì được. Khi chạy thật cho công ty, chuyển sang Cloudflare Pages (Bước 5) hoặc Vercel Pro.

## Bước 5 — Đưa app lên Cloudflare Pages (dùng khi chạy thật)

1. Vào https://dash.cloudflare.com, tạo tài khoản miễn phí.
2. Vào **Workers & Pages → Create → Pages → Connect to Git**, chọn repo `MATRANDEPOT`.
3. Cấu hình:
   - Production branch: `agent/claude/p4-database`. Khi đã merge vào `main` thì đổi sang `main`.
   - Framework preset: **Vite**.
   - Build command: `npm run build`.
   - Output directory: `dist`.
4. **Environment variables** (lấy ở Supabase → Project Settings → API):

   | Tên | Giá trị |
   |---|---|
   | `VITE_SUPABASE_URL` | `https://<mã-project>.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | khóa **anon / publishable** |
   | `VITE_APP_ENV` | `test` (màn đăng nhập hiện nhãn môi trường) |

   **Tuyệt đối không** dán khóa `service_role` / `secret` vào đây. Khóa đó chỉ nằm trong Supabase.
5. Bấm **Save and Deploy**, đợi khoảng 2 phút. Bạn nhận được địa chỉ dạng `https://matran-test.pages.dev`.
6. Mỗi lần nhánh có commit mới, Cloudflare tự build lại.

## Bước 6 — Tạo tài khoản cho người test

1. Mở địa chỉ app, đăng nhập **admin** với mật khẩu đã chọn (không gõ `::matran`).
2. **Danh mục chung → User - Role → Thêm:** tạo mỗi người 1 tài khoản đúng vai trò.
   - Mật khẩu ban đầu `123456`, lần đầu đăng nhập bắt buộc đổi (DEC-143).
   - Nên có đủ vai trò: Giám định, Văn phòng, Xe nâng, Vệ sinh, Báo giá, Sửa chữa, Kế toán, Quản lý.
3. **Danh mục chung → Sửa chữa:** thêm nhân viên Sửa chữa vào **Tổ sửa chữa 1**.
4. Gửi địa chỉ app + tên đăng nhập cho từng người. Người hiện trường mở bằng **điện thoại**.

## Bước 7 — Kịch bản test gợi ý

| Nhóm | Thử gì |
|---|---|
| Hạ vỏ | Giám định chụp ảnh (AV / DAMAGE / W-SURVEY) → Văn phòng lập chứng từ (TT / TTR / TTS) → Vệ sinh → Xe nâng hạ → Trả chứng từ (in EEIR + phiếu thu) |
| DAMAGE | Báo giá cập nhật → xác nhận → Sửa chữa → AV |
| Cấp vỏ | Booking → chọn cont → thanh toán → Xe nâng OUT → Trả chứng từ |
| Tàu | Lập danh sách Nhập / Xuất tàu → Giám định / Xe nâng làm từng cont → duyệt |
| Nhiều người | 2 người mở cùng màn: một người thao tác, người kia thấy cập nhật trong ≤ 30 giây; 2 người bấm cùng 1 cont → chỉ 1 người thành công |
| Mất mạng | Tắt Wi-Fi rồi bấm lưu → báo lỗi, giữ dữ liệu; bật lại → tự tải lại |
| Báo cáo | Lọc "Hôm nay", lọc tháng trước (tải riêng), xuất Excel |

Lỗi gặp phải: bấm nút **Góp ý** ở góc phải app (Admin xem ở Báo cáo → Góp ý), hoặc chụp màn hình gửi Claude.

## Bước 8 — Xong giai đoạn test

1. Xóa dữ liệu test.
2. Import tồn vỏ ban đầu (`docs/IMPORT_TON_VO_BAN_DAU.md`).
3. Tạo project **production** riêng, làm lại Bước 1 → 6 (bỏ file danh mục test, nhập danh mục thật).

Claude sẽ viết script xóa dữ liệu test + công cụ import khi tới bước này.
