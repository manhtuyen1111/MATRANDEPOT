# Skills — hướng dẫn cho agent

Skills nằm ở `.claude/skills/<tên>/SKILL.md`. Claude Code tự nạp; **Antigravity**: đọc trực tiếp file SKILL.md tương ứng rồi làm theo (nội dung là markdown thuần, không phụ thuộc công cụ).

## Danh sách

| Skill | Khi nào dùng | Đầu ra phải có |
|---|---|---|
| `matran-business-rule-check` | Trước mọi thay đổi chạm nghiệp vụ / Change Request mới | Bảng ý yêu cầu ↔ mã DEC; dừng hỏi nếu có mục chưa xác nhận |
| `matran-domain-change` | Sửa `src/services/**`, `src/types/**` | Hàm có kiểm tra quyền + trạng thái + audit; test đúng & bị từ chối |
| `matran-ui-screen` | Sửa `src/features/**`, `src/components/**`, `App.tsx` | Dùng component chung; dòng smoke test mới |
| `matran-quality-gate` | Trước khi báo xong / commit | Kết quả `npm test`, `npm run build` thật |
| `matran-docs-sync` | Người dùng xác nhận quy tắc; xong một việc | DECISIONS / OPEN_QUESTIONS / CHANGELOG / `devs/PROGRESS.md` cập nhật |
| `matran-supabase-migration` | Giai đoạn database, sửa `supabase/**` | File migration + pgTAP theo checklist; **không apply** |

## Chuỗi chuẩn cho một việc

```
business-rule-check → (domain-change | ui-screen) → quality-gate → docs-sync
```

- Việc chỉ sửa giao diện thuần (màu, bố cục) có thể bỏ `business-rule-check`.
- Việc database: `business-rule-check → supabase-migration → quality-gate → docs-sync`.

## Thêm / sửa skill
- Chỉ thêm skill khi một loại việc lặp lại ≥ 3 lần và có quy trình kiểm chứng rõ.
- Mỗi skill: frontmatter `name`, `description` (nêu rõ khi nào kích hoạt), các bước, mục "Kiểm chứng".
- Cập nhật bảng trên khi thêm skill.
