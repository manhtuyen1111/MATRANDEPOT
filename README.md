# MATRAN DEPOT

ERP quản lý vận hành **bãi container rỗng**: Giám định, Văn phòng, Xe nâng, Vệ sinh, Báo giá, Sửa chữa, Kế toán cùng làm trên một hệ thống. Nhân viên hiện trường dùng điện thoại, văn phòng dùng máy tính.

- Bản chạy thử: https://matrandepot.vercel.app/ (database Supabase `matran-test`, **dữ liệu test**)
- Ngôn ngữ giao diện và tài liệu: tiếng Việt

## 1. Chức năng chính

| Nhóm | Nội dung |
|---|---|
| **Hạ vỏ** | Giám định (ảnh cửa cont, hãng tàu, trạng thái AV / DAMAGE / W-SURVEY, phân loại đóng hàng, vệ sinh, AGE) → Văn phòng lập chứng từ + thu phí → Xe nâng hạ bãi |
| **Cấp vỏ** | Booking, lệnh cấp vỏ, thanh toán, xuất bãi |
| **Nhập tàu / Xuất tàu** | Danh sách theo tàu, Giám định / Xe nâng theo từng cont, Văn phòng duyệt |
| **Bãi** | Tồn vỏ, vị trí Block-Bay-Row-Tier, đảo chuyển, khóa cont, kệ giám định |
| **Vệ sinh / Báo giá / Sửa chữa** | Hàng chờ theo bộ phận, báo giá 2 bước, giao tổ sửa chữa |
| **Thanh toán** | Trực tiếp (TT), trả trước (TTR), thanh toán sau (TTS); phiếu thu `PT-TT-` / `PT-TTR-`; yêu cầu xuất hóa đơn qua trang khách `#/hoa-don` |
| **Giấy tờ in** | Khổ K80 (phiếu EEIR tác nghiệp, phiếu trả khách hàng, phiếu thu), Hồ sơ container A4 / PDF; mã QR quét bằng camera điện thoại |
| **Báo cáo** | Hạ vỏ, Cấp vỏ, Tồn vỏ, Nhập / Xuất tàu (chi tiết / theo tàu), Sửa chữa, Tổng hợp; xuất Excel |
| **Danh mục** | Khách hàng, Hãng tàu (có hãng ưu tiên), Vị trí bãi, Container, Phân loại (đóng hàng theo hãng), Biểu giá, Công ty, Sửa chữa, User - Role |

9 vai trò: Giám định, Văn phòng, Xe nâng, Vệ sinh, Báo giá, Sửa chữa, Kế toán, Quản lý, Admin. Mỗi vai trò chỉ thấy màn của mình.

## 2. Công nghệ

- **Frontend:** React 19 + TypeScript + Vite + Tailwind CSS. Deploy: Vercel (tự build khi merge vào `main`).
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Edge Functions). Mọi thao tác ghi đi qua RPC có kiểm quyền; bảng bật RLS.
- **Quy tắc nghiệp vụ:** `src/services/` (chạy được cả không có database — chế độ Demo).

## 3. Chạy trên máy

```bash
npm install        # lần đầu
npm run dev        # http://localhost:5173
npm test           # test tự động (Vitest)
npm run build      # kiểm tra TypeScript + build
```

- **Không có `.env.local`** → chế độ **Demo**: dữ liệu mẫu trong trình duyệt, chọn người dùng ở góc phải để thử quyền.
- **Có `.env.local`** (địa chỉ + khóa anon Supabase) → chế độ **Database**: đăng nhập tài khoản thật.

## 4. Database (Supabase)

- Migration: `supabase/migrations/` — tiến độ từng bước ở `supabase/README.md`.
- **Chỉ người dùng** chạy lệnh lên cloud:
  ```bash
  npx supabase db push --dry-run   # xem migration sẽ chạy
  npx supabase db push             # áp dụng lên matran-test
  ```
- Chạy thử local (cần Docker, **ổ C trống ≥ 15 GB**) — chỉ khi sửa database:
  ```bash
  npx supabase start -x edge-runtime,postgres-meta,studio
  npx supabase test db             # pgTAP
  npx supabase stop
  ```
- Sửa giao diện / logic app **không cần** Docker.

## 5. Cấu trúc thư mục

```
src/
  app/          App.tsx (menu, điều hướng), RemoteApp (chế độ database)
  features/     màn hình theo nghiệp vụ (inspector, office, yard, vessel, reports, catalog…)
  components/   thành phần dùng chung (shared.tsx, Qr.tsx, in ấn K80…)
  services/     quy tắc nghiệp vụ + quyền (depotOperations, payments, vessel, stuffing…), api.ts (cửa ghi chung)
  types/        kiểu dữ liệu
supabase/       migrations, tests (pgTAP), functions (Edge)
tests/          Vitest: nghiệp vụ (acceptance), giao diện (ui-smoke), tàu, hóa đơn…
docs/           đặc tả, quyết định, chuẩn giao diện
devs/           tiến độ (PROGRESS.md), lộ trình (ROADMAP.md)
```

## 6. Tài liệu

| File | Nội dung |
|---|---|
| `devs/PROGRESS.md` | **Tiến độ, bàn giao, việc đầu ca** — đọc đầu tiên |
| `docs/DECISIONS.md` | Quyết định nghiệp vụ đã chốt (DEC-001 → DEC-166) — là luật |
| `docs/OPEN_QUESTIONS.md` | Câu hỏi còn mở |
| `docs/BUSINESS_WORKFLOWS.md` | Quy trình nghiệp vụ |
| `docs/ROLE_PERMISSION_MATRIX.md` | Vai trò và quyền |
| `docs/DATABASE_SCHEMA.md`, `docs/APP_DB_INTEGRATION.md` | Thiết kế database, cách app nối database |
| `docs/DESIGN_SYSTEM.md`, `docs/UI_DATA_LIST_STANDARD.md` | Chuẩn giao diện, chuẩn màn danh sách |
| `docs/VAN_HANH_VA_PHAT_TRIEN.md` | Tư vấn vận hành / phát triển |
| `docs/HUONG_DAN_TEST_NHIEU_NGUOI.md` | Hướng dẫn test nhiều người |
| `docs/CHANGELOG.md` | Lịch sử thay đổi |

## 7. Trạng thái (2026-10-28)

- Giai đoạn 4 (database): **xong code**, đang chạy thử trên `matran-test` + Vercel. Chưa vận hành thật.
- Việc chờ: thử in K80 / quét QR trên máy thật, import tồn vỏ ban đầu (Q-044), chốt gói Supabase Pro + project `matran-prod`.
- Chi tiết: `devs/PROGRESS.md` mục I.5.

## 8. Làm việc với AI agent

Mọi agent (Claude Code, Antigravity…) đọc `AGENTS.md` trước khi làm. Luật chính: không tự suy đoán nghiệp vụ, không tạo dữ liệu giả, không đụng `.env` / khóa bí mật, không chạy lệnh ghi lên Supabase cloud, mỗi việc một nhánh, **hỏi trước khi push**.
