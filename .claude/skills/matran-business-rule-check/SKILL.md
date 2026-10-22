---
name: matran-business-rule-check
description: Đối chiếu một yêu cầu/thay đổi với quy tắc nghiệp vụ MATRAN DEPOT (DECISIONS.md) TRƯỚC khi sửa code. Dùng khi yêu cầu chạm tới Hạ vỏ, Cấp vỏ, thanh toán, phiếu thu, vị trí bãi, khóa container, quyền, mã hồ sơ, hoặc khi người dùng đưa Change Request mới.
---

# Kiểm tra quy tắc nghiệp vụ trước khi làm

## Các bước
1. Tóm tắt yêu cầu thành các ý nhỏ (mỗi ý 1 dòng).
2. Với mỗi ý, tìm trong `docs/DECISIONS.md` (dùng Grep theo từ khóa, KHÔNG đọc cả file nếu không cần):
   - Có DEC CONFIRMED khớp → ghi mã DEC.
   - Mâu thuẫn DEC CONFIRMED → đánh dấu MÂU THUẪN.
   - Thuộc OPEN-xxx / Q-xxx hoặc không có → đánh dấu CHƯA XÁC NHẬN.
3. Xuất bảng:

| # | Ý yêu cầu | Căn cứ | Trạng thái | Ghi chú |
|---|---|---|---|---|

4. Quyết định:
   - Toàn bộ có căn cứ → tiếp tục bằng skill `matran-domain-change` / `matran-ui-screen`.
   - Có MÂU THUẪN hoặc CHƯA XÁC NHẬN → DỪNG, hỏi người dùng (tối đa 4 câu, có phương án đề xuất). Không tự suy đoán.
5. Sau khi người dùng trả lời → dùng `matran-docs-sync` để ghi quyết định mới.

## Kiểm chứng đầu ra
- Mọi dòng trong bảng có cột "Căn cứ" (mã DEC, OPEN, Q hoặc "không có").
- Không có dòng nào được code khi trạng thái ≠ có căn cứ.
