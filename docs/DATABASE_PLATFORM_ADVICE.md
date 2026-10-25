# MATRAN DEPOT — TƯ VẤN NỀN TẢNG DATABASE, SAO LƯU & TÌNH HUỐNG VẬN HÀNH

> Trạng thái: **ĐỀ XUẤT — chờ người dùng chốt** (2026-10-24). Khi chốt, ghi thành DEC mới và cập nhật `DATABASE_CONTRACT.md`.
> Cơ sở: quy mô dữ liệu và hiệu năng đã chốt ở DEC-066 (`DATABASE_CONTRACT.md` mục 10): khoảng 10.000 hồ sơ / tháng, 5–15 GB / 10 năm (chưa tính ảnh), lưu đủ 10 năm.
> Giá trong tài liệu là **mức tham khảo**. Kiểm tra lại giá hiện hành trước khi đăng ký.

## 1. Kết luận ngắn

| Hạng mục | Đề xuất |
|---|---|
| Loại database | **PostgreSQL**: dữ liệu quan hệ chặt chẽ (cont, hồ sơ, chứng từ, phiếu thu), cần transaction và ràng buộc chống trùng. Đúng hướng đã chọn từ đầu. |
| Nơi đặt | **Supabase (Postgres được quản lý), vùng Singapore** — gần Việt Nam nhất trong các vùng của Supabase, độ trễ khoảng 30–60 ms. |
| Gói | **Pro** (khoảng 25 USD / tháng / project) + **PITR** (khôi phục về đúng thời điểm, khoảng 100 USD / tháng, lưu 7 ngày) khi chạy thật. |
| Môi trường | **3 project riêng**: `dev` (agent và lập trình), `staging` (thử nghiệm, nghiệm thu), `production` (dữ liệu thật). **Không bao giờ thử trên production.** |
| Sao lưu | Quy tắc **3-2-1**: Supabase tự sao lưu + PITR, **bản dump hằng đêm ra kho ngoài Supabase**, ảnh sao lưu riêng. Diễn tập khôi phục mỗi quý. |
| Phương án dự phòng | Lược đồ viết bằng **Postgres chuẩn**: nếu sau này cần đặt dữ liệu tại Việt Nam (pháp lý / khách hàng yêu cầu), chuyển sang Postgres trên cloud trong nước (Viettel IDC, FPT Cloud, CMC…) mà **không phải viết lại app**. |

## 2. So sánh nơi đặt database

| Phương án | Ưu | Nhược | Hợp khi |
|---|---|---|---|
| **A. Supabase Singapore (đề xuất)** | Có sẵn đăng nhập, phân quyền theo dòng (RLS), lưu ảnh (Storage), hàm máy chủ (Edge Function); sao lưu tự động + PITR; không cần đội vận hành | Dữ liệu đặt ở Singapore; thanh toán bằng USD; phụ thuộc nhà cung cấp | Giai đoạn đầu → vài năm; đội nhỏ, không có người quản trị server |
| B. Postgres trên cloud Việt Nam (tự quản) | Dữ liệu ở Việt Nam; hóa đơn VNĐ | Phải tự lo cập nhật, sao lưu, bảo mật, đăng nhập, lưu ảnh → cần người quản trị hệ thống | Có yêu cầu pháp lý / khách hàng về đặt dữ liệu trong nước, hoặc đã có đội IT |
| C. Máy chủ đặt tại bãi | Toàn quyền | Mất điện / mất mạng là dừng toàn bãi; sao lưu thủ công; rủi ro cao nhất | **Không khuyến nghị** |

**Lưu ý pháp lý:** Nghị định 53/2022 có yêu cầu lưu trữ dữ liệu tại Việt Nam đối với một số loại dịch vụ. ERP nội bộ thường không thuộc diện bắt buộc, nhưng **nên hỏi bộ phận pháp chế / kế toán** trước khi chọn A. Nếu bắt buộc thì chọn B, lược đồ vẫn dùng lại được.

## 3. Chọn gói và cấu hình (phương án A)

- **Gói Pro** cho staging và production. Dev có thể dùng gói Free.
- **Compute:** bắt đầu cỡ nhỏ (Small / Micro). Quy mô khoảng 10.000 hồ sơ / tháng là nhẹ với Postgres. Nâng cấp khi đo thấy chậm, không cần nâng sẵn.
- **Dung lượng:** database khoảng 1–2 GB / năm. **Ảnh** mới là phần lớn (xem Q-037). Nên nén ảnh về khoảng 200–400 KB khi chụp.
- **Bảo mật:**
  - Bật RLS cho mọi bảng. Ghi dữ liệu nghiệp vụ **chỉ qua RPC**, theo đúng ma trận quyền của `src/services/permissions.ts`.
  - Service role key chỉ đặt trên máy chủ / Edge Function, **không bao giờ đặt trong app**.
  - Bật xác thực 2 lớp (2FA) cho tài khoản quản trị Supabase. Chỉ 1–2 người giữ quyền Owner.
- **Theo dõi:** bật cảnh báo dung lượng, CPU, lỗi đăng nhập; xem log hằng tuần.

## 4. Sao lưu & khôi phục (đề xuất trả lời Q-039)

| Lớp | Cách làm | Giữ bao lâu | Khôi phục |
|---|---|---|---|
| 1. Supabase tự động | Sao lưu hằng ngày của gói Pro | 7 ngày | Từ trang quản trị Supabase |
| 2. **PITR** | Khôi phục về đúng thời điểm (tới từng phút) | 7 ngày | Ví dụ: lỡ chạy sai lúc 10:15 → quay về 10:14 |
| 3. **Bản dump ngoài Supabase** | Hằng đêm `pg_dump`, **mã hóa**, đẩy sang kho khác (ví dụ Backblaze B2 / AWS S3 / Google Cloud Storage của công ty) bằng tác vụ tự động (GitHub Actions hoặc máy chủ nhỏ) | 30 bản ngày + 12 bản tháng + 10 bản năm | Khôi phục vào project mới khi Supabase gặp sự cố lớn / tài khoản bị khóa |
| 4. **Ảnh (Storage)** | Sao chép tăng dần hằng tuần sang kho ngoài | Theo chính sách giữ ảnh (Q-037) | Tải lại vào Storage |

- **Mục tiêu đề xuất:**
  - Mất tối đa **5 phút** dữ liệu (RPO, nhờ PITR); không có PITR thì tối đa 24 giờ.
  - Chạy lại hệ thống trong **4 giờ** (RTO).
- **Diễn tập khôi phục mỗi quý:** khôi phục bản dump vào staging, đếm số hồ sơ / phiếu thu khớp production, ghi biên bản. Bản sao lưu chưa từng khôi phục thử thì **coi như chưa có**.
- **Trước mọi lần chạy migration trên production:** tạo bản sao lưu thủ công, chạy trên staging trước, đúng quy trình người dùng apply (AGENTS.md).

## 5. Tình huống vận hành thực tế (study case) và cách xử lý

| # | Tình huống | Rủi ro | Cách hệ thống xử lý (đưa vào thiết kế P4) |
|---|---|---|---|
| 1 | **Hiện trường mất mạng / sóng yếu** (Giám định, Xe nâng) | Không lưu được, nhân viên bấm lại nhiều lần | App lưu tạm trên điện thoại, tự gửi lại khi có mạng. Mỗi thao tác có **mã thao tác duy nhất** (idempotency key) để gửi lại không bị ghi 2 lần. Hiện rõ "Đang chờ đồng bộ" trên màn. |
| 2 | **2 xe nâng cùng hạ / cùng xuất 1 cont** | Ghi đè, sai vị trí | Mỗi thao tác chạy trong 1 **transaction có khóa dòng**, kèm kiểm tra phiên bản bản ghi. Người đến sau nhận lỗi "Cont đã được … xử lý lúc …". Đúng tinh thần chống làm trùng đã có ở DEC-071. |
| 3 | **Nhiều máy cùng tạo hồ sơ** | Trùng mã HV- / PT- | Cấp mã bằng **bảng bộ đếm + khóa dòng trong database** và ràng buộc UNIQUE (đã ghi trong hợp đồng database). Không cấp mã ở app. |
| 4 | **Ngân hàng gửi xác nhận chuyển khoản 2 lần** | Ghi nhận thu tiền 2 lần | UNIQUE theo mã giao dịch ngân hàng; lần thứ 2 bỏ qua. Không ghi đã thu khi chưa có xác nhận hợp lệ (DEC-031). |
| 5 | **Nhân viên thao tác nhầm** (khóa nhầm, đảo sai vị trí, duyệt nhầm) | Mất dấu vết | Không xóa cứng dữ liệu nghiệp vụ. Mọi thay đổi ghi **nhật ký kiểm toán**. Có thao tác hủy / sửa theo quyền. Trường hợp nặng dùng PITR trên bản sao, không quay ngược cả production. |
| 6 | **Supabase gián đoạn / mất kết nối diện rộng** | Bãi dừng làm việc | Hiện thông báo rõ trên app. Hiện trường tiếp tục lưu tạm (case 1). Nếu kéo dài: in danh sách giấy dự phòng từ bản Excel / dump gần nhất. Khôi phục từ bản dump ngoài (lớp 3) nếu cần. |
| 7 | **Chạy migration sai trên production** | Hỏng cấu trúc / dữ liệu | Bắt buộc staging trước. Sao lưu thủ công trước khi chạy. Có kịch bản rollback. Dùng PITR về trước thời điểm chạy. |
| 8 | **Nhân viên nghỉ việc / lộ mật khẩu / lộ khóa** | Truy cập trái phép | Khóa user ngay (đã có ở Danh mục → User). Đổi khóa API. RLS chặn theo vai trò. Rà nhật ký đăng nhập. |
| 9 | **Chuyển từ bản Demo sang database thật** | Mất / lệch dữ liệu đang chạy thử | Chọn **ngày chốt sổ**: kiểm kê tồn bãi thực tế, nhập tồn đầu kỳ bằng file Excel qua script 1 lần, đối chiếu số lượng trước khi mở dùng thật. Dữ liệu Demo trên trình duyệt **không** chuyển tự động. |
| 10 | **Tồn vỏ trên app lệch với thực tế bãi** | Cấp nhầm cont không có | Kiểm kê định kỳ (gợi ý: hằng tuần theo Block). Lệch thì dùng Sửa vị trí / ghi chú, có nhật ký. |
| 11 | **Dữ liệu tăng sau nhiều năm** | Chậm báo cáo | Đã chốt ở DEC-066: index, phân trang con trỏ, giới hạn lọc 3 tháng, tổng hợp theo ngày, chia bảng nhật ký theo năm. |

## 6. Lộ trình đề xuất tới khi chạy thật

1. **Chốt:**
   - Danh mục trạng thái (OPEN-003).
   - Q-037 (ảnh), Q-038 (số người dùng cùng lúc), Q-039 (sao lưu, mục 4).
   - Q-040: nơi đặt database và ngân sách tháng.
2. **P4-01:** agent viết migration lược đồ đầy đủ (bảng, index, RLS, bộ đếm mã) + test pgTAP. **Chỉ viết file**, người dùng apply.
3. **P4-02, P5:** viết RPC cho từng tác nghiệp. App chuyển từ lưu trên trình duyệt sang gọi RPC, mỗi lần một phân hệ, theo thứ tự Danh mục → Hạ vỏ → Cấp vỏ → Thanh toán → Nhập / Xuất tàu → Báo cáo.
4. **Staging:** dựng project, thiết lập sao lưu lớp 3, diễn tập khôi phục lần đầu.
5. **Nghiệm thu với nhân viên thật** trên staging (GĐ 8).
6. **Ngày chốt sổ** (case 9) → mở production.
