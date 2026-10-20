# MATRAN DEPOT — DECISIONS LOG

## 1. Mục đích

Lưu các quyết định nghiệp vụ và kỹ thuật ảnh hưởng đến thiết kế, phát triển và vận hành MATRAN DEPOT.

Quy ước trạng thái:
- CONFIRMED: Đã được người dùng xác nhận.
- PROPOSED: Đề xuất, chưa được xác nhận.
- OPEN: Đang chờ quyết định.
- SUPERSEDED: Đã được thay thế bằng quyết định mới.

## 2. Quyết định nghiệp vụ đã xác nhận

### DEC-001 — Phạm vi container

- Trạng thái: CONFIRMED
- Quyết định: Phạm vi vận hành hiện tại chỉ bao gồm container rỗng.
- Ảnh hưởng: Quy trình Gate In, tồn bãi, dịch vụ, booking, cấp container và Gate Out.

### DEC-002 — Phạm vi dịch vụ

- Trạng thái: CONFIRMED
- Quyết định: Hệ thống cần quản lý:
  - Lưu bãi và tồn bãi.
  - Gate In và Gate Out.
  - Booking và cấp container.
  - Vệ sinh.
  - Giám định và sửa chữa M&R.
  - Phí dịch vụ, thanh toán và đối soát.
- Ảnh hưởng: Phải hoàn thiện toàn bộ quy trình bắt buộc trước khi đưa vào vận hành.

### DEC-003 — Quan hệ giữa các bên

- Trạng thái: CONFIRMED
- Quyết định: Chủ sở hữu container, bên yêu cầu dịch vụ và bên trả phí có thể là các bên khác nhau.
- Ảnh hưởng: Không gộp các vai trò này thành một trường khách hàng duy nhất.

### DEC-004 — Chính sách thanh toán Gate In

- Trạng thái: CONFIRMED
- Quyết định: Phí Gate In bắt buộc phải được thanh toán trước khi hoàn tất Gate In.
- Ảnh hưởng: Phải phân biệt việc tạo giao dịch thanh toán với việc xác nhận thanh toán thành công.

### DEC-005 — Vị trí container

- Trạng thái: CONFIRMED
- Quyết định: Mỗi container đang nằm trong bãi chỉ có một vị trí hiện tại.
- Ảnh hưởng: Phải lưu lịch sử di chuyển và bảo đảm tính nhất quán khi cập nhật vị trí.

### DEC-006 — Chống cấp container trùng

- Trạng thái: CONFIRMED
- Quyết định: Khóa phân bổ khi container cụ thể được chọn và xác nhận gắn với lượt cấp.
- Ảnh hưởng: Phải xử lý việc đổi, hủy và giải phóng phân bổ an toàn.

### DEC-007 — Phạm vi loại Gate In

- Trạng thái: CONFIRMED
- Quyết định: Gate In hỗ trợ nhiều loại lượt tiếp nhận.
- Ảnh hưởng: Loại Gate In cần được quản lý bằng danh mục thay vì giả định chỉ có một loại.

### DEC-008 — Cách xây dựng hệ thống

- Trạng thái: CONFIRMED
- Quyết định: Xây dựng ERP đầy đủ theo phạm vi nghiệp vụ đã thống nhất. Có thể triển khai theo từng giai đoạn, nhưng không đưa vào vận hành chính thức khi các quy trình bắt buộc chưa hoàn thiện và nghiệm thu.
- Ảnh hưởng: Phải có đặc tả, kiểm thử và nghiệm thu cho toàn bộ phạm vi.

### DEC-009 — Cách làm việc với mã nguồn

- Trạng thái: CONFIRMED
- Quyết định: Thực hiện từng file một trong VS Code; hướng dẫn cụ thể cách tạo file, nhập nội dung và lưu.
- Ảnh hưởng: Mỗi bước chỉ tập trung vào file hoặc nhiệm vụ đang thực hiện.

## 3. Quyết định kỹ thuật dự kiến

### DEC-010 — Database

- Trạng thái: PROPOSED
- Đề xuất: PostgreSQL trên Supabase.
- Ghi chú: Chưa tạo schema hoặc migration.

### DEC-011 — Frontend

- Trạng thái: PROPOSED
- Đề xuất: React, TypeScript và Vite.
- Ghi chú: Chưa khởi tạo ứng dụng.

### DEC-012 — Giao diện

- Trạng thái: PROPOSED
- Đề xuất: Responsive web app có khả năng hỗ trợ PWA.
- Ghi chú: Chưa triển khai.

### DEC-013 — Quản lý thay đổi database

- Trạng thái: PROPOSED
- Đề xuất: Sử dụng migration được quản lý bằng Git.
- Ghi chú: Chưa tạo migration.

## 4. Các quyết định còn mở

### OPEN-001 — Danh mục loại Gate In

- Trạng thái: OPEN
- Cần xác nhận: Danh sách đầy đủ các loại tiếp nhận.

### OPEN-002 — Mô hình vị trí bãi

- Trạng thái: OPEN
- Cần xác nhận: Cấu trúc khu vực, block, bay, row, tier và sức chứa thực tế.

### OPEN-003 — Trạng thái nghiệp vụ

- Trạng thái: OPEN
- Cần xác nhận: Các trạng thái container, Gate In, Gate Out, booking, vệ sinh, giám định, sửa chữa và thanh toán.

### OPEN-004 — Phân quyền

- Trạng thái: OPEN
- Cần xác nhận: Vai trò thực tế, quyền thao tác và các bước phê duyệt.

### OPEN-005 — Chính sách tài chính

- Trạng thái: OPEN
- Cần xác nhận: Biểu phí, công nợ, thời điểm thu phí, hoàn tiền và đối soát cho từng dịch vụ.

### OPEN-006 — Ngoại lệ nghiệp vụ

- Trạng thái: OPEN
- Cần xác nhận: Quy tắc hủy, sửa sai, từ chối, xử lý trùng và khôi phục sau lỗi.

## 5. Quy tắc cập nhật

- Không sửa quyết định CONFIRMED nếu chưa có xác nhận thay đổi.
- Khi quyết định thay đổi, ghi rõ quyết định cũ, quyết định mới, lý do và ngày thay đổi.
- Không chuyển PROPOSED thành CONFIRMED nếu chưa được xác nhận.
- Các thay đổi phải được đồng bộ vào tài liệu và code liên quan.
- Không coi đề xuất kỹ thuật là kiến trúc đã chốt.

## 6. Trạng thái tài liệu

- Quyết định nghiệp vụ: đã ghi nhận các nội dung xác nhận.
- Quyết định kỹ thuật: một số mục còn ở mức đề xuất.
- Các mục OPEN: cần giải quyết trước khi chốt thiết kế database.
