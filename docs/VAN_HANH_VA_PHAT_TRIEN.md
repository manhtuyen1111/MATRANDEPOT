# VẬN HÀNH & PHÁT TRIỂN — rà soát dự án, khuyến nghị (2026-10-28)

Viết cho: chủ dự án (không cần biết lập trình) + agent làm tiếp. Đây là **tư vấn**, chưa phải quyết định —
mục nào đồng ý thì ghi thành DEC trong `docs/DECISIONS.md`.

---

## 1. Rà soát hiện trạng

| Hạng mục | Tình trạng | Ghi chú |
|---|---|---|
| Cấu trúc code | Tốt | Nghiệp vụ tập trung `src/services/`; giao diện chỉ gọi hàm; ghi database đi 1 cửa `api.ts` → hàng chờ RPC |
| Database | Tốt | Chỉ ghi qua RPC (security definer, khóa `search_path` đủ 107/107 hàm); RLS bật mọi bảng; chống bấm trùng (`request_id`); nhật ký thao tác |
| Bí mật | Tốt | Frontend chỉ có khóa anon (công khai theo thiết kế Supabase); service role chỉ trong Edge Function; `.env*` không lên Git |
| Kiểm thử | Tốt | 167 test app + 184 test database (pgTAP) + đo tốc độ ở 45.000 dòng |
| Tốc độ | Tốt | Mở app ~7 s ở quy mô thật; đồng bộ phần thay đổi ~0,1 s; lưu ngầm không chặn màn (DEC-160) |
| Gói thư viện | Chấp nhận | `npm audit`: 2 lỗi mức trung bình trong `uuid` (qua `exceljs`) — app không dùng hàm bị lỗi; **không** chạy `npm audit fix --force` (hạ exceljs, hỏng Excel) |

### Điểm cần chú ý (rủi ro thật)

1. **Quy tắc nghiệp vụ viết 2 nơi** — TypeScript (`src/services/`, kiểm ngay trên máy) và SQL (RPC, kiểm lại ở database).
   Sửa quy tắc mà quên 1 bên → app cho qua nhưng database từ chối (hoặc ngược lại). **Mỗi lần đổi quy tắc: sửa cả 2 + test cả 2.**
2. **Database test và database thật phải là 2 project khác nhau.** `matran-test` chỉ để test. Chạy thật → tạo project mới
   (VD `matran-prod`), không dùng chung khóa, không cho người test vào.
3. **Gói Supabase Free không đủ chạy thật** (xem mục 2): 500 MB database, 1 GB ảnh, tự tạm dừng khi 7 ngày không dùng, không có bản sao lưu.
4. **Mật khẩu:** DEC-143 cho phép độ dài tùy ý (chỉ cấm 123456). Khuyên tối thiểu 6–8 ký tự cho tài khoản Admin / Văn phòng / Kế toán (cần bạn duyệt).
5. **Nghỉ việc:** khóa tài khoản ngay (User - Role → tắt hoạt động). Không xóa — để giữ lịch sử ai làm gì.
6. **Trang khách `#/hoa-don`** mở công khai (bảo vệ bằng mã bảo mật 12 ký tự). Khi chạy thật nên bật giới hạn số lần thử ở Supabase (Auth / API rate limit) và theo dõi log.

---

## 2. Vận hành: 10.000–15.000 lượt in / out mỗi tháng, 50–60 nhân viên, 15–25 người dùng liên tục

### Ước lượng tải

| Chỉ số | Ước tính | Đánh giá |
|---|---|---|
| Lượt / ngày | ~350–500 (cao điểm ~80 / giờ) | Nhẹ với Postgres. Đã thử 45.000 dòng: vẫn nhanh |
| Dòng dữ liệu mới | ~150.000–250.000 / tháng (hồ sơ, phí, phiếu, nhật ký) | ~2–3 triệu / năm → database ~2–4 GB / năm |
| Ảnh cửa cont (DEC-159 cũ: giữ 2 tháng — **từ DEC-176 không tự xóa**: ~3 GB / tháng ảnh cửa + ảnh sửa chữa, quản trị tải backup rồi xóa tay để giữ dưới mức gói) | 500 ảnh × ~200 KB ≈ 100 MB / ngày → **~6 GB thường trực** | Vượt gói Free (1 GB) |
| Người dùng đồng thời 25 | mỗi máy hỏi thay đổi 30 giây / lần | ~1 triệu lượt hỏi nhỏ / ngày — Supabase Pro chịu được; tốn băng thông nhỏ |
| Tài khoản | 60 | Thoải mái (Pro: 100.000 tài khoản) |

### Khuyến nghị khi chạy thật

1. **Supabase Pro (~25 USD / tháng)**: 8 GB database, 100 GB ảnh, sao lưu hằng ngày 7 ngày, không tự tạm dừng.
   Thêm **PITR** (khôi phục tới từng phút — DEC-152 đã chọn) là gói thêm, xem giá trên trang Supabase trước khi bật.
2. **Sao lưu ngoài Supabase** mỗi tuần: tải bản sao (`supabase db dump`) về máy / ổ đám mây công ty (quy tắc 3-2-1 trong `DATABASE_PLATFORM_ADVICE.md`).
3. **Mạng hiện trường:** wifi bãi phải phủ đủ khu xe nâng / giám định; mất mạng app báo ngay, thao tác chưa lưu (DEC-151). Nên có 4G dự phòng.
4. **Điện thoại hiện trường:** Android Chrome / iPhone Safari bản mới; camera sau tốt; ốp không che đèn.
5. **Theo dõi hằng tuần** (Supabase → Reports / Usage): dung lượng database, dung lượng ảnh, lỗi API (Logs). Gần 80% hạn mức → báo nâng gói.
6. **Khi > 25 người hoặc thấy chậm:** chuyển "hỏi thay đổi 30 giây" sang **Supabase Realtime** (database tự báo khi có thay đổi) — giảm tải + cập nhật tức thì. Đã ghi ở PROGRESS I.5 mục 7.
7. **Báo cáo dài hạn:** báo cáo > 92 ngày đang bị chặn (N7). Khi cần báo cáo năm → làm bảng tổng hợp theo tháng ở database, không tải chi tiết.
8. **Nhật ký thao tác** lớn nhanh nhất — đã chia theo tháng (partition); sau 1–2 năm có thể chuyển tháng cũ ra kho lưu trữ.

---

## 3. Phát triển / nâng cấp sau này

1. **Quy trình không đổi:** quyết định (DEC) trước → sửa `src/services/` + test → sửa RPC SQL + pgTAP → giao diện → tài liệu.
   Gặp mục OPEN → hỏi, không đoán.
2. **Migration sau khi chạy thật: chỉ THÊM file mới, không sửa file cũ** (file cũ đã chạy trên database thật). Lần này sửa thẳng
   file gốc (ảnh 2 tháng) được là vì chưa apply nơi nào — sau này không làm vậy nữa.
3. **Thử trên Supabase local / `matran-test` trước**, rồi mới `db push` lên database thật. Đổi cấu trúc bảng lớn → làm ngoài giờ, sao lưu trước.
4. **3 môi trường:** máy cá nhân (Docker) → `matran-test` (Vercel, người test) → `matran-prod` (Cloudflare Pages, chạy thật).
   Bản sửa đi đúng thứ tự, không sửa thẳng trên thật.
5. **Mỗi việc 1 nhánh, 1 PR, commit nhỏ** (DEC-009). Không commit thẳng `main`.
6. **Gói thư viện:** nâng cấp theo đợt (3–6 tháng / lần), có test; không nâng khi đang cao điểm.
7. **Tính năng dự kiến cần chuẩn bị:**
   - Ngân hàng tự xác nhận chuyển khoản (Q-032): Edge Function nhận webhook, kiểm chữ ký, chống trùng — tạo QR **không** phải đã thu (DEC-031).
   - Hóa đơn điện tử: nối nhà cung cấp HĐĐT qua Edge Function, không gọi thẳng từ trình duyệt.
   - App cài trên điện thoại (PWA) nếu cần biểu tượng ngoài màn hình chính.
8. **Tài liệu là "trí nhớ" của dự án:** mọi thay đổi ghi CHANGELOG + PROGRESS; agent mới đọc `AGENTS.md` → `devs/PROGRESS.md` mục I.5 trước.
