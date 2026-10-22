---
name: matran-supabase-migration
description: Viết migration / RPC / RLS / pgTAP cho Supabase của MATRAN DEPOT theo checklist bảo mật. Chỉ VIẾT file, không bao giờ apply. Dùng ở giai đoạn database (roadmap GĐ 4) hoặc khi sửa supabase/**.
---

# Migration Supabase (chỉ viết, không apply)

## Cấm
- `supabase db push`, `supabase migration up`, `supabase link`, `psql` lên môi trường thật — người dùng tự apply.
- Đọc `.env`, ghi khóa bí mật vào file.

## Quy tắc
- `0001` chưa từng apply → được viết lại. Sau khi người dùng báo đã apply ở bất kỳ đâu → chỉ thêm file mới, không sửa file cũ.
- Tách file theo thứ tự: enum → bảng → hàm hỗ trợ/bộ đếm mã → RPC theo phân hệ → RLS → seed dev.
- Bám `docs/DATABASE_CONTRACT.md` mục 8 và bảng RPC `docs/API_RPC_CONTRACT.md` mục 13; hợp đồng nghiệp vụ = hàm tương ứng trong `src/services/`.

## Checklist mỗi RPC
- [ ] `SECURITY DEFINER` + `SET search_path = public`.
- [ ] Kiểm tra quyền bằng `has_any_role(...)` theo `src/services/permissions.ts`; lấy người thực hiện từ `auth.uid()`, không nhận staff_id từ client.
- [ ] `SELECT ... FOR UPDATE` các dòng bị đổi; kiểm tra trạng thái trước.
- [ ] Chống lặp: UNIQUE / idempotency key (provider_tx_ref, transaction_id, 1 lượt lưu bãi mở / container, 1 phân bổ hiệu lực / container).
- [ ] Ghi `audit_logs`.
- [ ] Bảng có RLS bật + policy SELECT theo vai trò; không cấp INSERT/UPDATE trực tiếp cho `authenticated`.

## Kiểm chứng
- Viết pgTAP trong `supabase/tests/` cho ca đúng, sai quyền, sai trạng thái, gửi lặp.
- Đề xuất người dùng chạy local: `npx supabase db reset && npx supabase test db` (cần Docker; hỏi trước khi cài).
