# Supabase — MATRAN DEPOT (Giai đoạn 4)

Thiết kế: `docs/DATABASE_SCHEMA.md`. **Agent chỉ viết file. Người dùng tự apply.** Không đưa khóa `service_role` vào frontend hay vào Git.

## Trạng thái các migration

| Bước | File | Nội dung | Trạng thái |
|---|---|---|---|
| 1 | `20261027000001` → `000005` | enum, nhân viên, danh mục, bộ đếm mã, nhật ký, chống bấm lặp, quyền, RPC Danh mục / nhân viên, RLS nền | **Đã chạy thử local 2026-10-27: apply OK, pgTAP 18/18** |
| 2 | `20261028000001` → `000002` | Bảng Hạ vỏ, lượt lưu bãi, K80, lịch sử vị trí (partition tháng), vệ sinh / báo giá / sửa chữa; RPC Giám định (W-SURVEY), giám định trên kệ, hạ vỏ, đảo chuyển, sửa vị trí, vệ sinh, báo giá 2 bước, sửa chữa, khóa, ghi chú | **Đã chạy thử local 2026-10-27: pgTAP 32/32** (cộng bước 1: 50/50). Văn phòng Hạ vỏ + GATE IN OK chuyển sang bước 3 (cần chứng từ) |
| 3 | `20261029000001` → `000002` | Văn phòng Hạ vỏ, chứng từ, thanh toán TT / TTS / TTR, chuyển khoản (callback + xác nhận tay), GATE IN OK, phiếu thu, in phiếu, phiếu thu trả trước, hóa đơn | **Đã chạy thử local 2026-10-27: pgTAP 57/57** (tổng 107/107) |
| 4 | `20261030000001` → `000002` | Booking, lệnh cấp vỏ, thanh toán cấp vỏ + K80, hủy lệnh (chưa thu tiền), xuất bãi 5 điều kiện; Nhập / Xuất tàu (lập / sửa / thêm / bỏ / xóa danh sách, Giám định nhập tàu, xuất tàu, duyệt khi chưa đủ, tự khóa DEC-131) | **Đã chạy thử local 2026-10-27: pgTAP 40/40** (tổng 147/147) |
| 5a | `20261031000001` | Lịch tự động (pg_cron): tạo partition trước 2 tháng, dọn request_log; kho ảnh riêng tư door-photos (Giám định tải lên, nhân viên xem); liệt kê / đánh dấu ảnh quá hạn (2 tháng — DEC-159) | **Đã chạy thử local 2026-10-27: pgTAP 11/11** (tổng 158/158) |
| 5b | `supabase/functions/*` | Edge Function `admin-create-staff`, `admin-reset-password`, `purge-expired-photos` (+ `_shared/auth.ts`) | **Đã chạy thử local 2026-10-27: 16/16** (`supabase/tests/edge-functions.local.cjs`) |
| 6 | `20261102000001` | Đồng bộ phần thay đổi: cột `sync_at` + trigger cho 20 bảng app tải, `sync_deletions`, `server_now()` (DEC-158) | **Đã chạy thử local 2026-10-27: pgTAP 10/10** (tổng 180/180) |
| 7 | `20261103000001` | Sửa `catalog_add_fee`: không chọn hãng tàu (THU GOM RÁC / KHÁC) bị báo sai "Hãng tàu không có" | **pgTAP 184/184 local 2026-10-28** — chờ bạn `db push` lên `matran-test` |
| 8 | `20261104000001` | DEC-166: bảng `stuffing_classes` (phân loại đóng hàng theo hãng, tạo sẵn M / K / E cho hãng đang có), `resolve_stuffing`, `partners.is_priority`; bỏ enum `stuffing_class` → text; Giám định Hạ vỏ nhận hãng tàu; Văn phòng nhận phân loại khi đổi hãng | **pgTAP 201/201 local 2026-10-28** — đã `db push` lên `matran-test` |
| 9 | `20261105000001` | DEC-173 / DEC-174: bậc thợ sửa chữa, gán tổ + bậc, chốt đơn giá lúc sửa xong | **pgTAP 213/213 local 2026-10-28** — đã `db push` lên `matran-test` |
| 10 | `20261106000001` | DEC-175: bảng 1 dòng `repair_overtime_settings` (trên 200 giờ — 3.000 đ / giờ), RPC `catalog_update_repair_overtime`; pgTAP `0010_repair_overtime.test.sql` (8 kiểm tra) | **pgTAP 231/231 local 2026-10-29** — đã `db push` lên `matran-test` |
| 11 | `20261107000001` | DEC-176: kho `repair-photos` (< 200 KB / ảnh), `work_orders.photo_paths`, RPC `complete_repair_with_photos` (1–30 ảnh); **tắt tự xóa ảnh** (`expired_photo_paths` trả rỗng — thay DEC-159); pgTAP `0011_repair_photos.test.sql` (10 kiểm tra) | **pgTAP 231/231 + chạy thật 5/5 local 2026-10-29** — đã `db push` lên `matran-test` |
| 12 | `20261108000001` | DEC-178: RLS bọc `(select …)` cho mọi policy `public` (gọi hàm quyền 1 lần / truy vấn — sửa lỗi quá 8 giây khi dữ liệu lớn), chỉ mục cột lọc khi mở app; pgTAP `0012_rls_initplan.test.sql` | **pgTAP 239/239 local 2026-10-29** — đã `db push` lên `matran-test` 2026-10-29 |
| 13 | `20261109000001` | DEC-178 bước 4b: cột sinh `report_at` + `container_serial` (gate_in_orders / gate_out_orders / work_orders; containers chỉ `container_serial`) + chỉ mục — báo cáo phân trang ở database; chỉ mục giao dịch theo chứng từ; pgTAP `0013_report_paging.test.sql` (10 kiểm tra) | **pgTAP 249/249 + chạy thật 5/5 local 2026-10-29** — đã `db push` lên `matran-test` 2026-10-29 |
| 18 | `20261114000001` | DEC-191: thông tin chi tiết nhân viên — cột `staff.gender / id_number / birth_year / hometown / department` (CCCD duy nhất), RPC `admin_update_staff_profile`; khôi phục `assert_admin()` bản gốc (sửa lỗi bản đầu 17 ghi đè); pgTAP `0017_staff_profile.test.sql` (13 kiểm tra) | **pgTAP 304/304 local 2026-10-29** — chờ bạn `db push --linked` |
| 17 | `20261113000001` | DEC-189: sức khỏe database — bảng `db_health_settings` (giới hạn dung lượng, 1 dòng), RPC `db_health` (chỉ Admin, chỉ số kỹ thuật — không lộ đăng nhập / khóa / câu truy vấn), `set_db_health_limits`, `assert_admin`; pgTAP `0016_db_health.test.sql` (12 kiểm tra) | **pgTAP 291/291 local 2026-10-29** — chờ bạn `db push --linked` |
| 16 | `20261112000001` | DEC-186: `execute_gate_out` chặn cấp cont thay thế khi cont đổi chưa được Xe nâng hạ lại; pgTAP `0015` thêm 1 kiểm tra (27) | **pgTAP 279/279 local 2026-10-29** — chờ bạn `db push --linked` |
| 15 | `20261111000001` | DEC-185: ĐỔI CONTAINER khi chờ trả chứng từ cấp vỏ — RPC `swap_gate_out_container`; `update_container_location` thêm nhánh hạ lại (`SWAP_RETURN`, hư hỏng → việc Báo giá); cột `containers.swap_return` / `release_damage`, `gate_out_orders.swaps` + chỉ mục GIN; pgTAP `0015_gate_out_swap.test.sql` (26 kiểm tra) | **pgTAP 278/278 local 2026-10-29** — chờ bạn `db push --linked` |
| 14 | `20261110000001` | DEC-179: chỉ mục báo cáo theo bộ phận — `gate_in_orders.field_at` (Giám định), `location_history.performed_at` / `action` (Xe nâng); pgTAP `0014_department_reports.test.sql` | **pgTAP 252/252 + chạy thật 5/5 local 2026-10-29** — chờ bạn `db push --linked` |
| — | — | Chuyển kho > 36 tháng | Làm khi có dữ liệu đủ 3 năm (2029) |
| — | — | Nhận báo có ngân hàng (callback) | Chờ Q-032 chọn ngân hàng; hiện Văn phòng xác nhận tay |

## Chạy thử trên máy (khuyên làm trước khi đưa lên Supabase thật)

Cần Docker Desktop. Agent sẽ hỏi trước khi cài bất cứ gì.

```bash
npx supabase start          # dựng Supabase local bằng Docker
npx supabase db reset       # chạy toàn bộ migration + seed.sql
npx supabase test db        # chạy test pgTAP trong supabase/tests/

# Edge Function: mở 1 cửa sổ chạy máy chủ hàm, cửa sổ khác chạy test
npx supabase functions serve
node supabase/tests/edge-functions.local.cjs .
```

## Đưa lên project thật (bạn tự làm)

1. Tạo project trên supabase.com, vùng **Singapore**. Làm cho đủ 3 project: dev, staging, production. Bật PITR cho production (DEC-152).
2. **Authentication → Providers → Email:**
   - tắt "Confirm email";
   - độ dài mật khẩu tối thiểu giữ **6** (giới hạn của Supabase). App tự ghép chuỗi cố định để nhân viên đặt mật khẩu ngắn hơn được (DEC-153).
3. Apply migration theo thứ tự tên file:
   - dùng `npx supabase link` rồi `npx supabase db push`;
   - hoặc dán từng file vào SQL Editor.
4. **Tạo Admin đầu tiên:**
   - Vào **Authentication → Users → Add user**: email `admin@matrandepot.local`, mật khẩu **`<mật khẩu>::matran`** (bắt buộc thêm `::matran` — DEC-153), tích Auto Confirm.
   - Chạy `supabase/test-data/02_admin_dau_tien.sql` trong SQL Editor (tự lấy id, chạy lại được).
5. Từ đó Admin tạo nhân viên khác trên app (Edge Function `admin-create-staff`).
6. Project TEST: chạy thêm `supabase/test-data/01_danh_muc_test.sql` (danh mục giống bản Demo). Production **không** chạy file này.

Hướng dẫn đầy đủ cho môi trường test nhiều người (kèm đưa app lên Cloudflare Pages): `docs/HUONG_DAN_TEST_NHIEU_NGUOI.md`.

## Lưu ý

- Migration nào đã apply ở bất kỳ môi trường nào thì **không sửa nữa**; thay đổi viết thành file mới.
- **Từ 2026-10-27 toàn bộ migration đã apply lên project `matran-test`** → không sửa file cũ nữa; mọi thay đổi database viết thành file migration MỚI.
- **Đăng nhập:** tên đăng nhập `tuan.lv` ứng với email `tuan.lv@matrandepot.local` (DEC-151).

## Lịch xóa ảnh hết hạn (làm sau khi tạo project thật)

Edge Function `purge-expired-photos` cần được gọi mỗi đêm. Khóa `service_role` **không** ghi vào migration hay Git — bạn lưu trong **Vault** của project:

1. **Project Settings → Edge Functions:** deploy 3 hàm. Dùng `npx supabase functions deploy`, hoặc làm trên trang quản trị.
2. **Database → Vault:** thêm 2 secret:
   - `project_url` = `https://<mã-project>.supabase.co`
   - `service_role_key` = khóa service_role của project. Dùng khóa dạng **JWT** (Project Settings → API Keys → tab *Legacy API keys* → `service_role`, bắt đầu bằng `eyJ`), **không** dùng khóa `sb_secret_…` — Edge Function mặc định kiểm JWT.
3. **SQL Editor**, chạy 1 lần:

   ```sql
   create extension if not exists pg_net;
   select cron.schedule('matran-purge-photos', '0 19 * * *', $$
     select net.http_post(
       url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/purge-expired-photos',
       headers := jsonb_build_object('Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key'))
     );
   $$);
   ```

## Mật khẩu (DEC-153)

- App **luôn ghép `::matran`** vào cuối mật khẩu người dùng gõ trước khi gửi Supabase. Áp dụng cho đăng nhập, đổi mật khẩu, đặt lại.
- Hằng số nằm ở `supabase/functions/_shared/auth.ts` (`PASSWORD_SUFFIX`, `toAuthPassword`). Frontend phải dùng đúng hằng này.
- Đây không phải bí mật. Đổi hằng số thì mọi mật khẩu cũ sẽ không đăng nhập được.
