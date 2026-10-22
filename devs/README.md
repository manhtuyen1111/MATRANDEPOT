# HƯỚNG DẪN DEV — MATRAN DEPOT (dành cho người giao việc)

> File duy nhất cần mở đầu tiên. Mọi hướng dẫn cho bạn đều dẫn từ đây.
> Tài liệu cho AI agent nằm ở `docs/` (xem `docs/README.md`).

## Mục lục
1. [Mỗi ngày bắt đầu thế nào](#1-mỗi-ngày-bắt-đầu-thế-nào)
2. [Các file trong devs/](#2-các-file-trong-devs)
3. [Giao việc cho Claude Code / Antigravity](#3-giao-việc-cho-claude-code--antigravity)
4. [Kiểm tra kết quả agent trả về](#4-kiểm-tra-kết-quả-agent-trả-về)
5. [Tiết kiệm token](#5-tiết-kiệm-token)
6. [Lệnh thường dùng](#6-lệnh-thường-dùng)
7. [Những điều agent KHÔNG được làm](#7-những-điều-agent-không-được-làm)

---

## 1. Mỗi ngày bắt đầu thế nào
1. Mở `devs/PROGRESS.md` → xem mục **"VIỆC TIẾP THEO"** và **"CẦN BẠN QUYẾT ĐỊNH"**.
2. Chọn 1 việc → copy mẫu ở `devs/GIAO_VIEC.md` → dán cho agent phù hợp (mục 3).
3. Agent trả báo cáo → kiểm tra theo mục 4 → duyệt / yêu cầu sửa.
4. Agent tự cập nhật `PROGRESS.md`; bạn chỉ cần đọc lại.

## 2. Các file trong devs/
| File | Dùng để |
|---|---|
| `README.md` | (file này) Hướng dẫn tổng |
| `PROGRESS.md` | **Bảng theo dõi tiến độ**: việc nào xong, kết quả, kiểm thử, việc tiếp theo |
| `ROADMAP.md` | Lộ trình các giai đoạn, tiêu chí nghiệm thu từng giai đoạn |
| `GIAO_VIEC.md` | Mẫu câu giao việc copy-dán, theo từng loại việc |

## 3. Giao việc cho Claude Code / Antigravity

| Loại việc | Giao cho | Lý do |
|---|---|---|
| Quy tắc nghiệp vụ, quyền, thanh toán, phiếu thu, mã hồ sơ | **Claude Code** | Cần đối chiếu DECISIONS + viết test |
| Database Supabase (migration, RPC, RLS) | **Claude Code** | Có checklist bảo mật, không được apply |
| Cập nhật tài liệu nghiệp vụ, Change Request lớn | **Claude Code** | Ghi quyết định chuẩn |
| Giao diện: bố cục, màu, icon, responsive, màn hình mới chỉ hiển thị | **Antigravity** | Không đụng logic |
| Màn hình mới cần logic mới | Claude làm service trước → Antigravity làm UI sau | Tránh UI tự đặt quy tắc |

Quy tắc an toàn khi dùng cả 2:
- **Không chạy 2 agent cùng lúc trên cùng thư mục.** Xong việc agent này (đã commit) mới giao agent kia; hoặc mỗi agent một bản clone riêng.
- Mỗi việc một nhánh `agent/<claude|antigravity>/<mã-việc>`. Bạn merge vào `main` sau khi duyệt.
- Với Antigravity, luôn mở đầu yêu cầu bằng: *"Đọc AGENTS.md và docs/agents/WORKFLOW.md trước."* (Claude Code tự đọc qua `CLAUDE.md`).

## 4. Kiểm tra kết quả agent trả về
Báo cáo hợp lệ phải có (mẫu ở `docs/agents/WORKFLOW.md` mục 4):
- [ ] `npm test` x/y pass và `npm run build` PASS — số liệu thật.
- [ ] Danh sách file đã sửa; không có file `.env`, không có `supabase` apply.
- [ ] Mục "Chưa kiểm thử" và "Cần xác nhận" (nếu trống mà việc lớn → hỏi lại).
- [ ] `devs/PROGRESS.md` đã cập nhật.
Tự kiểm tra nhanh: `npm run dev` → mở http://localhost:5173 → đổi người dùng ở góc phải để thử quyền.

## 5. Tiết kiệm token
- **Một yêu cầu = một việc** trong PROGRESS (ghi mã việc, ví dụ `P2-03`). Tránh dán Change Request rất dài nhiều mảng cùng lúc.
- Nêu rõ phạm vi: "chỉ sửa màn Cấp vỏ", "không đụng services".
- Trả lời câu hỏi của agent ngắn theo số thứ tự (1 → đúng, 2 → không...).
- Phiên chat quá dài → mở phiên mới, chỉ nói: *"Tiếp tục việc <mã> trong devs/PROGRESS.md"* — agent sẽ đọc lại trạng thái từ file, không cần kể lại.
- Không yêu cầu agent "đọc toàn bộ dự án" trừ khi khảo sát lại.

## 6. Lệnh thường dùng
```bash
npm run dev       # chạy app
npm test          # test tự động
npm run build     # kiểm tra build
git status        # xem thay đổi
git log --oneline -10
```

## 7. Những điều agent KHÔNG được làm
Đọc/in `.env` • chạy migration hay ghi dữ liệu lên Supabase • cài package khi chưa hỏi • commit vào `main` / force push • tự đặt quy tắc nghiệp vụ chưa có trong `docs/DECISIONS.md` • tạo dữ liệu giả. Nếu thấy agent làm các việc này → dừng và báo lại. (Claude Code đã bị chặn kỹ thuật một phần qua `.claude/settings.json`.)
