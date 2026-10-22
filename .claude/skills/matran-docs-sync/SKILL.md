---
name: matran-docs-sync
description: Đồng bộ tài liệu sau mỗi việc ở MATRAN DEPOT — ghi quyết định mới, câu hỏi mở, changelog, kết quả kiểm thử và tiến độ trong devs/PROGRESS.md. Dùng khi người dùng xác nhận quy tắc mới hoặc khi hoàn tất một việc.
---

# Đồng bộ tài liệu

| Khi nào | Cập nhật |
|---|---|
| Người dùng xác nhận quy tắc | `docs/DECISIONS.md` — DEC mới (số tiếp theo), trạng thái CONFIRMED, ngày; quyết định cũ bị thay → ghi "Điều chỉnh <ngày>: cũ / mới" |
| Câu hỏi được trả lời / phát sinh | `docs/OPEN_QUESTIONS.md` — `[x]` kèm mã DEC; câu mới số tiếp theo |
| Đổi quy trình | `docs/BUSINESS_WORKFLOWS.md` mục tương ứng |
| Đổi quyền | `docs/ROLE_PERMISSION_MATRIX.md` mục 2A |
| Đổi dữ liệu | `docs/DATABASE_CONTRACT.md` mục 8 |
| Có kết quả test | `docs/ACCEPTANCE_TESTS.md` mục 13 |
| Xong một việc | `docs/CHANGELOG.md` (Added/Changed/Fixed/Removed/Pending) **và** `devs/PROGRESS.md` (trạng thái, kết quả, cách kiểm thử, việc tiếp theo) |

## Luật
- Không chuyển PROPOSED/OPEN thành CONFIRMED nếu người dùng chưa xác nhận.
- Sửa bằng Edit đúng mục, không viết lại cả file.
- Không tạo tài liệu mới trùng nội dung đã có.

## Kiểm chứng
- `grep` mã DEC mới xuất hiện ở DECISIONS và ở chỗ được tham chiếu.
- `devs/PROGRESS.md` có dòng cập nhật kèm ngày.
