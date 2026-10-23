@AGENTS.md

# Riêng cho Claude Code

- Trả lời và viết tài liệu bằng tiếng Việt.
- Trước khi sửa logic nghiệp vụ: dẫn được mã DEC tương ứng trong `docs/DECISIONS.md`; gặp mục OPEN thì dừng và hỏi.
- Tầng nghiệp vụ là `src/services/`; test tương ứng ở `tests/acceptance.test.ts`. Màn hình mới → thêm một dòng vào `tests/ui-smoke.test.tsx`.
- Kiểm tra cuối: `npm test` và `npm run build`. Không có quyền chạy lệnh Supabase ghi dữ liệu (đã chặn trong `.claude/settings.json`).
- Người dùng làm từng bước nhỏ, kiểm tra được bằng Git (DEC-009): chia thay đổi lớn thành nhiều commit có ý nghĩa và báo rõ từng nhóm.
- Chuỗi skill chuẩn: `matran-business-rule-check` → `matran-domain-change` / `matran-ui-screen` → `matran-quality-gate` → `matran-docs-sync`.
