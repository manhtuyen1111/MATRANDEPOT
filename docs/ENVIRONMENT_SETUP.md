# ENVIRONMENT SETUP — MATRAN DEPOT

## 1. Mục tiêu

Chuẩn hóa môi trường phát triển để các thành viên có thể chạy, kiểm tra và phát triển MATRAN DEPOT một cách nhất quán.

Tài liệu này là kế hoạch chuẩn bị ban đầu. Các phiên bản công cụ và cấu hình chính thức sẽ được xác nhận trước khi triển khai.

## 2. Công cụ dự kiến

- Visual Studio Code: viết và quản lý mã nguồn.
- Node.js và npm: chạy công cụ phát triển frontend.
- Git: quản lý phiên bản mã nguồn.
- GitHub: lưu trữ repository.
- Supabase: PostgreSQL, xác thực người dùng, lưu trữ file và các dịch vụ backend.
- Trình duyệt Chrome hoặc trình duyệt tương thích: kiểm tra ứng dụng.
- Công cụ quản lý PostgreSQL: hỗ trợ kiểm tra cấu trúc và dữ liệu khi cần.

## 3. Kiểm tra công cụ trên Windows

Mở Terminal trong VS Code hoặc Command Prompt và chạy lần lượt:

```bash
node --version
npm --version
git --version
```

Ghi lại kết quả và xử lý lỗi trước khi tiếp tục.

Không cài lại công cụ nếu máy đã có phiên bản phù hợp.

## 4. Repository và môi trường

Phân biệt các môi trường:

- Local: môi trường phát triển trên máy cá nhân.
- Test: môi trường kiểm thử.
- Production: môi trường vận hành chính thức.

Không dùng dữ liệu thật hoặc thực hiện thao tác phá hủy trên production để thử nghiệm.

Không để cấu hình bí mật của production trong mã nguồn.

## 5. Biến môi trường

Khi triển khai ứng dụng, cần xác định các biến môi trường thực sự cần thiết.

Quy tắc:

- Chỉ đưa tên biến và giá trị mẫu không nhạy cảm vào `.env.example`.
- Không đưa file `.env` chứa bí mật lên GitHub.
- Frontend chỉ được sử dụng các khóa được phép công khai.
- Không đặt Supabase service role key trong frontend.
- Bí mật dùng phía máy chủ phải được lưu trong môi trường máy chủ hoặc hệ thống quản lý secrets phù hợp.

## 6. Kiểm tra trước khi phát triển

- [ ] Node.js và npm hoạt động.
- [ ] Git hoạt động.
- [ ] Repository GitHub đúng và có quyền truy cập.
- [ ] Đã xác nhận công nghệ frontend.
- [ ] Đã xác nhận cấu hình Supabase.
- [ ] Đã có phương án quản lý biến môi trường.
- [ ] Đã xác định cách chạy kiểm thử.
- [ ] Đã kiểm tra `.gitignore` để tránh đưa file nhạy cảm lên GitHub.

## 7. Nguyên tắc thay đổi môi trường

- Ghi lại các phiên bản công cụ quan trọng khi dự án bắt đầu.
- Không nâng cấp hàng loạt thư viện mà không kiểm tra tính tương thích.
- Đọc hướng dẫn chính thức khi cấu hình dịch vụ bên ngoài.
- Kiểm tra ứng dụng sau mỗi thay đổi cấu hình quan trọng.

## 8. Trạng thái

Chưa chốt phiên bản framework, thư viện và cấu hình triển khai chính thức.

Chỉ xác nhận các lựa chọn này sau khi rà soát yêu cầu và môi trường hiện tại.