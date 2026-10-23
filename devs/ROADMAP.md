# ROADMAP — MATRAN DEPOT

Mục tiêu: ERP bãi container rỗng hoàn chỉnh, vận hành thật trên Supabase, phát triển lâu dài.
Trạng thái chi tiết từng việc: `devs/PROGRESS.md`.

| GĐ | Tên | Mục tiêu | Tiêu chí nghiệm thu | Trạng thái |
|---|---|---|---|---|
| 0 | Khảo sát | Hiểu hiện trạng repo | Báo cáo khảo sát | ✅ Xong |
| 1 | Nền nghiệp vụ & tài liệu | Ghi đủ quy tắc vào DECISIONS | Không còn quy tắc trong code thiếu mã DEC | ✅ Xong (DEC-018 → 049) |
| 2 | Harness AI | AGENTS/CLAUDE, settings, skills, quy trình 2 agent | Chặn `.env`/db push; 6 skill; docs/agents | ✅ Xong |
| 3 | Change Request (Demo) | CR-01 → CR-09 + bổ sung: giờ công, tổ sửa chữa, user - phân quyền, báo cáo Hạ vỏ / Sửa chữa, tối ưu mobile (DEC-040 → 049) | 42 test pass, build pass | ✅ Xong — chờ bạn thử trên trình duyệt & commit / merge |
| 4 | Database Supabase | Viết lại schema, RPC, RLS, pgTAP; hiệu năng dữ liệu lớn theo DEC-066 (DATABASE_CONTRACT mục 10) | `supabase db reset` + `test db` xanh trên máy local | 🔄 Chuẩn bị xong tài liệu (DEC-050 → 066) — ⏸ chờ danh mục trạng thái (OPEN-003) |
| 5 | Nối Supabase | Lớp gateway Demo/Supabase, đăng nhập, ảnh lên Storage | Luồng Hạ vỏ → Cấp vỏ chạy trên project test | ⏳ |
| 6 | Thanh toán thật | Webhook ngân hàng (Edge Function), đối soát, hoàn tiền (OPEN-008) | PAY-003 → 007 đạt ở database | ⏳ |
| 7 | Nhập tàu / Xuất tàu | Đặc tả + làm phân hệ (DEC-069) | Quy trình được xác nhận + test | 🔄 Xong bản Demo (2026-10-24) — chờ bạn thử trên trình duyệt; phần database làm cùng GĐ 4 |
| 8 | Nghiệm thu người dùng | Chạy thử với nhân viên thật trên môi trường test | Bạn ký nghiệm thu từng phân hệ | ⏳ |
| 9 | Vận hành | Production, sao lưu/khôi phục, CI GitHub Actions | Diễn tập khôi phục thành công | ⏳ |

Sau GĐ 9: mỗi tính năng mới đi theo chuỗi **DEC → service + test → (RPC + pgTAP) → UI → nghiệm thu**.

## Phụ thuộc
- GĐ 5 cần GĐ 4. GĐ 6 cần GĐ 5 + quyết định ngân hàng (Q-032). GĐ 7 cần đặc tả từ bạn.
- Câu hỏi chặn GĐ 4: OPEN-003 (danh mục trạng thái), Q-006 (Block thực tế). Quyền xác nhận thanh toán đã chốt: Văn phòng / Quản lý (DEC-047).
