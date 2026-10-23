---
name: matran-quality-gate
description: Cổng chất lượng bắt buộc trước khi báo xong việc hoặc commit trong MATRAN DEPOT — chạy test, build, kiểm tra git và báo cáo kết quả thật.
---

# Cổng chất lượng

## Chạy
```bash
npm test
npm run build
git status --short
```

## Báo cáo (dán vào câu trả lời / mô tả PR)
```
KIỂM TRA
- npm test: <số pass>/<tổng> (dán dòng "Tests ...")
- npm run build: PASS | FAIL (lỗi đầu tiên)
- File thay đổi: <danh sách ngắn>
- Chưa kiểm thử: <ví dụ: thao tác trình duyệt, database>
```

## Luật
- FAIL → sửa, không báo xong. Không bao giờ ghi PASS khi chưa chạy.
- Không sửa/xóa test cho "xanh" trừ khi test sai so với DEC — phải nói rõ lý do.
- Sau khi pass → chạy `matran-docs-sync` cập nhật `devs/PROGRESS.md`.
