# MẪU GIAO VIỆC — copy, sửa phần <...>, dán cho agent

## 1. Việc tiếp theo trong PROGRESS (dùng nhiều nhất)
```
Làm việc <mã> trong devs/PROGRESS.md.
Phạm vi: <chỉ ...>. Không làm ngoài phạm vi.
Xong thì chạy quality gate, cập nhật PROGRESS, báo cáo theo mẫu WORKFLOW mục 4. Chưa commit.
```

## 2. Thay đổi / thêm quy tắc nghiệp vụ (Claude Code)
```
Yêu cầu nghiệp vụ: <mô tả>.
Dùng skill matran-business-rule-check trước. Có điểm chưa rõ thì hỏi, chưa code.
Sau khi tôi xác nhận: sửa services + test, ghi DEC mới, cập nhật PROGRESS.
```

## 3. Sửa giao diện (Antigravity)
```
Đọc AGENTS.md, docs/agents/WORKFLOW.md và .claude/skills/matran-ui-screen/SKILL.md trước.
Nhánh: agent/antigravity/<mã>.
Màn hình: <tên màn / file>. Yêu cầu: <mô tả>.
KHÔNG sửa src/services/, src/types/, docs/DECISIONS.md. Cần logic mới thì ghi vào PROGRESS mục B và dừng.
Xong: npm test, npm run build, cập nhật PROGRESS, báo cáo theo mẫu.
```

## 4. Báo lỗi
```
Lỗi: <màn hình> — <các bước tái hiện> — <kết quả thấy> — <kết quả mong muốn>. Người dùng đang chọn: <tên>.
Tìm nguyên nhân, viết test tái hiện lỗi trước rồi mới sửa. Ghi vào PROGRESS.
```

## 5. Database (Claude Code — GĐ 4)
```
Làm <P4-xx>. Dùng skill matran-supabase-migration. Chỉ viết file, không apply, không link Supabase.
Liệt kê lệnh để tôi tự chạy local.
```

## 6. Tiếp tục ở phiên chat mới (tiết kiệm token)
```
Tiếp tục việc <mã> theo devs/PROGRESS.md. Không cần khảo sát lại toàn dự án.
```

## 7. Commit / merge
```
Commit nhánh hiện tại thành các commit theo nhóm (nghiệp vụ / giao diện / tài liệu). Chạy quality gate trước. Không push.
```
