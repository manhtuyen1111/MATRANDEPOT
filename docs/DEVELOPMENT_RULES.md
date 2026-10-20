# DEVELOPMENT RULES — MATRAN DEPOT

## 1. Nguyên tắc làm việc

- Đọc tài liệu trong thư mục `docs/` trước khi triển khai chức năng.
- Không tự suy đoán nghiệp vụ chưa được xác nhận.
- Nếu yêu cầu mới mâu thuẫn với quyết định đã chốt, phải nêu rõ điểm mâu thuẫn trước khi sửa.
- Làm từng bước nhỏ, kiểm tra kết quả rồi mới chuyển bước tiếp theo.
- Ưu tiên tính đúng đắn của nghiệp vụ và dữ liệu hơn tốc độ viết code.

## 2. Quy trình thực hiện một nhiệm vụ

1. Xác định yêu cầu và tiêu chí hoàn thành.
2. Đọc các file tài liệu liên quan.
3. Kiểm tra code và cấu trúc hiện tại trước khi sửa.
4. Xác định những file cần tạo hoặc thay đổi.
5. Giải thích ngắn gọn kế hoạch thực hiện.
6. Triển khai từng phần nhỏ.
7. Chạy kiểm tra phù hợp.
8. Báo cáo file đã thay đổi, kết quả kiểm tra và vấn đề còn tồn tại.
9. Cập nhật tài liệu nếu có thay đổi về nghiệp vụ hoặc thiết kế.

## 3. Quy tắc database

- Database phải bảo vệ tính toàn vẹn dữ liệu bằng khóa, ràng buộc và giao dịch phù hợp.
- Không chỉ dựa vào frontend để kiểm soát quyền hoặc chống ghi trùng.
- Những thao tác quan trọng phải xử lý an toàn khi có nhiều người dùng đồng thời.
- Thay đổi schema phải được quản lý bằng migration có thứ tự.
- Không tự ý xóa bảng, cột, dữ liệu hoặc migration đã áp dụng.
- Trước thao tác phá hủy dữ liệu phải đánh giá ảnh hưởng và có phương án khôi phục.

## 4. Quy tắc bảo mật

- Không đưa mật khẩu, token hoặc khóa bí mật vào mã nguồn.
- Không công khai Supabase service role key.
- Kiểm tra quyền truy cập ở backend/database.
- Thiết kế và kiểm thử Row Level Security (RLS) trước khi đưa dữ liệu thật vào sử dụng.
- Không tin tưởng dữ liệu gửi từ trình duyệt mà chưa kiểm tra.
- Ghi nhật ký các thao tác quan trọng theo yêu cầu nghiệp vụ.

## 5. Quy tắc thanh toán

- Phân biệt yêu cầu thanh toán, giao dịch thanh toán và trạng thái nghiệp vụ.
- Không đánh dấu đã thanh toán chỉ vì đã tạo giao dịch.
- Chỉ xác nhận kết quả thanh toán trực tuyến sau khi kiểm tra thông báo đáng tin cậy từ nhà cung cấp.
- Có cơ chế chống xử lý trùng khi nhận lại cùng một thông báo.
- Lưu thông tin cần thiết để đối soát và xử lý hoàn tiền.
- Không tự ý bỏ qua điều kiện thanh toán đã được nghiệp vụ xác nhận.

## 6. Quy tắc giao diện

- Giao diện cần sử dụng được trên máy tính và điện thoại.
- Hiển thị rõ trạng thái đang xử lý, thành công và lỗi.
- Với thao tác quan trọng, cần xác nhận phù hợp và ngăn gửi lặp.
- Không báo thành công khi backend chưa xác nhận.
- Ưu tiên quy trình thao tác ngắn gọn cho nhân viên hiện trường.

## 7. Quy tắc Git

- Kiểm tra `git status` trước khi commit.
- Không ghi đè hoặc xóa thay đổi của người khác khi chưa kiểm tra.
- Commit theo từng nhóm thay đổi có ý nghĩa.
- Không đưa file bí mật hoặc dữ liệu khách hàng thật lên GitHub.
- Không dùng `git push --force` tùy tiện.
- Kiểm tra diff trước khi commit.

## 8. Quy tắc kiểm thử

- Kiểm thử trường hợp thành công, thất bại và dữ liệu không hợp lệ.
- Kiểm thử phân quyền và truy cập trái phép.
- Kiểm thử thao tác đồng thời với nghiệp vụ cấp container.
- Kiểm thử thanh toán trùng, thanh toán thất bại và hủy nghiệp vụ.
- Không coi chức năng hoàn thành chỉ vì giao diện hiển thị đúng.
- Ghi nhận các bài kiểm thử chưa chạy hoặc chưa đạt.

## 9. Tiêu chí hoàn thành

Một nhiệm vụ chỉ được coi là hoàn thành khi:
- Đạt yêu cầu nghiệp vụ đã xác nhận.
- Không làm hỏng chức năng hiện có.
- Các kiểm tra phù hợp đã được thực hiện.
- Quyền truy cập và tính toàn vẹn dữ liệu được xem xét.
- Tài liệu liên quan đã được cập nhật.
- Các giới hạn hoặc lỗi còn tồn tại được thông báo rõ ràng.