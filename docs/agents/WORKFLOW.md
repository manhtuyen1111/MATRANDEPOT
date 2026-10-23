# Quy trình làm việc & chia việc giữa Claude Code và Antigravity

## 1. Vai trò mặc định

| Vùng | Agent chính | Ghi chú |
|---|---|---|
| Nghiệp vụ `src/services/**`, `src/types/**`, `tests/acceptance.test.ts` | **Claude Code** | Logic, quyền, thanh toán, mã hồ sơ |
| Database `supabase/**` | **Claude Code** | Chỉ viết file, người dùng apply |
| Tài liệu quy tắc `docs/DECISIONS.md`, `OPEN_QUESTIONS.md` | **Claude Code** | Chỉ ghi khi người dùng xác nhận |
| Giao diện `src/features/**`, `src/components/**`, style | **Antigravity** (hoặc Claude) | Không thêm quy tắc nghiệp vụ mới |
| `src/app/App.tsx` (menu) | Ai được giao | File dễ xung đột — một agent một lúc |
| `devs/PROGRESS.md`, `docs/CHANGELOG.md` | Agent vừa làm xong việc | Thêm dòng, không viết lại |

Người giao việc có thể đổi vai trò trong từng yêu cầu; khi đó ghi rõ trong yêu cầu.

## 2. Vòng đời một việc

1. **Nhận việc**: đọc `AGENTS.md` → `devs/PROGRESS.md` (mục việc được giao) → chỉ các tài liệu liên quan (xem `TOKEN_BUDGET.md`).
2. **Nhánh**: `agent/<claude|antigravity>/<mã-việc>` từ nhánh mới nhất. `git status` phải sạch.
3. **Phân tích**: skill `matran-business-rule-check`. Có điểm chưa rõ → hỏi, dừng.
4. **Làm**: từng nhóm nhỏ, mỗi nhóm một commit có ý nghĩa.
5. **Kiểm tra**: skill `matran-quality-gate`.
6. **Ghi nhận**: skill `matran-docs-sync` (cập nhật `devs/PROGRESS.md`).
7. **Bàn giao**: báo cáo theo mẫu mục 4. Không merge vào `main` — người dùng duyệt.

## 3. Tránh xung đột giữa 2 agent

- Không chạy 2 agent trên **cùng thư mục làm việc cùng lúc**. Mỗi agent dùng nhánh riêng (khuyến nghị: thư mục clone/worktree riêng).
- Việc giao diện cần hàm nghiệp vụ mới → Antigravity dừng, ghi yêu cầu vào PROGRESS ("Cần service: ..."), Claude làm phần service trước.
- Sửa file của vùng agent kia → chỉ đề xuất trong mô tả PR.
- Trước khi bắt đầu việc phụ thuộc: kiểm tra việc trước đã merge chưa trong `devs/PROGRESS.md`.

## 4. Mẫu báo cáo bàn giao

```
VIỆC: <mã> — <tên>
NHÁNH: agent/<...>/<...>
ĐÃ LÀM: <gạch đầu dòng theo yêu cầu>
FILE: tạo / sửa / xóa
KIỂM TRA: npm test x/y • build PASS/FAIL • chưa kiểm thử: ...
TÀI LIỆU: <file đã cập nhật>
CẦN XÁC NHẬN: <câu hỏi, có phương án đề xuất>
VIỆC TIẾP THEO ĐỀ XUẤT: <1–3 việc>
```

## 5. Khi nào phải dừng và hỏi
- Quy tắc OPEN / chưa có DEC; mâu thuẫn với DEC CONFIRMED.
- Cần cài package, đổi cấu trúc dữ liệu lớn, xóa chức năng, chạm database thật.
- Yêu cầu bị cắt / thiếu (ví dụ nội dung dán không đầy đủ).
