# MATRAN DEPOT

Hệ thống ERP quản lý vận hành bãi container rỗng của MATRAN DEPOT.

## 1. Mục tiêu dự án

Xây dựng hệ thống quản lý tập trung, thay thế các quy trình rời rạc, hỗ trợ nhân viên hiện trường và văn phòng phối hợp trên cùng một hệ thống.

## 2. Phạm vi nghiệp vụ

- Gate In — tiếp nhận container vào bãi.
- Quản lý tồn bãi và vị trí container.
- Booking và cấp container.
- Gate Out — xuất container khỏi bãi.
- Vệ sinh container.
- Giám định container.
- Sửa chữa và theo dõi tiến độ sửa chữa.
- Quản lý phí, thanh toán, công nợ và đối soát.
- Quản lý người dùng, phân quyền và nhật ký hoạt động.
- Báo cáo vận hành.

## 3. Nguyên tắc quan trọng

- Chỉ quản lý container rỗng.
- Mỗi container đang ở trong bãi có một vị trí hiện tại; lịch sử phải được lưu.
- Phí Gate In phải được thanh toán trước khi hoàn tất Gate In.
- Tạo giao dịch thanh toán không đồng nghĩa với thanh toán thành công.
- Ngăn cấp trùng container khi nhiều nhân viên thao tác đồng thời.
- Kiểm tra quyền tại backend/database, không chỉ tại giao diện.
- Các quy tắc nghiệp vụ chưa xác nhận phải được làm rõ trước khi triển khai.

## 4. Công nghệ (DEC-010 → DEC-013)

- Frontend: React 19 + TypeScript + Vite + Tailwind CSS.
- Backend/database: Supabase và PostgreSQL (chưa triển khai — xem mục 6).
- Xác thực: Supabase Auth (chưa triển khai).
- Lưu trữ ảnh: Supabase Storage (chưa triển khai).
- Quản lý mã nguồn: Git và GitHub.

## 4A. Chạy và kiểm tra

```bash
npm install        # chỉ khi chưa có node_modules
npm run dev        # chạy ứng dụng (http://localhost:5173)
npm test           # chạy test tự động (Vitest)
npm run build      # kiểm tra TypeScript + build production
```

Không có file `.env` → ứng dụng chạy chế độ **Demo** (dữ liệu mẫu lưu trên trình duyệt, nhãn `DEMO` trên thanh tiêu đề, có thể đổi người dùng để thử quyền).

## 5. Tài liệu dự án

Các tài liệu nghiệp vụ và kỹ thuật nằm trong thư mục `docs/`.

| File | Nội dung |
|---|---|
| `MASTER_SPEC.md` | Đặc tả tổng thể |
| `BUSINESS_WORKFLOWS.md` | Quy trình nghiệp vụ |
| `ROLE_PERMISSION_MATRIX.md` | Vai trò và phân quyền dự kiến |
| `DATABASE_CONTRACT.md` | Nguyên tắc thiết kế dữ liệu |
| `API_RPC_CONTRACT.md` | Nguyên tắc API/RPC |
| `ACCEPTANCE_TESTS.md` | Kiểm thử nghiệm thu |
| `DECISIONS.md` | Quyết định đã ghi nhận |
| `CHANGELOG.md` | Lịch sử thay đổi |
| `OPEN_QUESTIONS.md` | Câu hỏi nghiệp vụ còn mở |
| `PROJECT_STRUCTURE.md` | Cấu trúc thư mục dự kiến |
| `DEVELOPMENT_RULES.md` | Quy tắc phát triển |
| `ENVIRONMENT_SETUP.md` | Chuẩn bị môi trường |

## 6. Trạng thái hiện tại (2026-10-22)

- Giao diện và tầng nghiệp vụ chạy ở **chế độ Demo** (`src/services/`, lưu localStorage). Quy tắc nghiệp vụ và quyền được kiểm tra trong tầng nghiệp vụ; **chưa có kiểm tra ở database**.
- Database Supabase: chỉ có migration bản nháp, chưa áp dụng, không khớp nghiệp vụ hiện tại — sẽ viết lại (xem `docs/DATABASE_CONTRACT.md` mục 8–9).
- Nhập tàu / Xuất tàu: để giai đoạn sau (DEC-038).
- Kết quả kiểm thử: `docs/ACCEPTANCE_TESTS.md` mục 13 (42/42 test tự động pass). Tiến độ & logic đã chốt: `devs/PROGRESS.md`.
- Không đưa vào vận hành chính thức cho tới khi hoàn thành database, phân quyền backend và nghiệm thu (DEC-008).

## 6A. Làm việc với AI agent

Mọi AI agent (Claude Code, Antigravity, ...) phải đọc `AGENTS.md` trước khi làm việc.

**Người giao việc: bắt đầu từ `devs/README.md`** (tiến độ, lộ trình, mẫu giao việc). Tài liệu cho agent: `docs/README.md`.

## 7. Quy trình bắt đầu công việc

1. Đọc `docs/MASTER_SPEC.md`.
2. Đọc `docs/DECISIONS.md` và `docs/OPEN_QUESTIONS.md`.
3. Đọc tài liệu nghiệp vụ liên quan đến nhiệm vụ.
4. Kiểm tra code và cấu trúc repository hiện có.
5. Xác định thay đổi cần thực hiện trước khi viết code.
6. Triển khai và kiểm thử từng bước.
7. Cập nhật tài liệu khi có quyết định mới.

## 8. Quy tắc bảo mật

- Không commit mật khẩu, token hoặc khóa bí mật.
- Không đưa dữ liệu khách hàng thật lên repository công khai.
- Không đưa Supabase service role key vào frontend.
- Không chạy thao tác phá hủy dữ liệu khi chưa kiểm tra ảnh hưởng và phương án khôi phục.