# PROJECT STRUCTURE — MATRAN DEPOT

## 1. Nguyên tắc

- Tách giao diện, nghiệp vụ, dữ liệu và tài liệu.
- Không đặt toàn bộ nghiệp vụ trong một file.
- Không để thông tin bí mật trong mã nguồn hoặc GitHub.
- Chỉ tạo thư mục và file khi bắt đầu triển khai phần tương ứng.
- Cấu trúc dưới đây là dự kiến, chưa phải cấu trúc code chính thức.

## 2. Cấu trúc thư mục dự kiến

```text
MATRAN_DEPOT/
├── docs/
│   ├── MASTER_SPEC.md
│   ├── BUSINESS_WORKFLOWS.md
│   ├── ROLE_PERMISSION_MATRIX.md
│   ├── DATABASE_CONTRACT.md
│   ├── API_RPC_CONTRACT.md
│   ├── ACCEPTANCE_TESTS.md
│   ├── DECISIONS.md
│   ├── CHANGELOG.md
│   ├── OPEN_QUESTIONS.md
│   └── PROJECT_STRUCTURE.md
│
├── src/
│   ├── app/
│   ├── components/
│   ├── features/
│   ├── hooks/
│   ├── lib/
│   ├── services/
│   ├── types/
│   └── utils/
│
├── supabase/
│   ├── migrations/
│   ├── functions/
│   └── tests/
│
├── public/
├── tests/
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## 3. Trách nhiệm các thư mục

### docs/
Chứa tài liệu nghiệp vụ, quyết định thiết kế, quy tắc database và kiểm thử.

### src/app/
Chứa phần khởi tạo ứng dụng, định tuyến và cấu hình màn hình chính.

### src/components/
Chứa các thành phần giao diện có thể tái sử dụng.

### src/features/
Chứa chức năng theo nghiệp vụ, ví dụ:
- gate-in
- gate-out
- yard
- booking
- cleaning
- inspection
- repair
- payments
- reports
- users

### src/lib/
Chứa cấu hình và các thư viện dùng chung, ví dụ kết nối Supabase.

### src/services/
Chứa lớp gọi API hoặc các thao tác dữ liệu dùng chung.

### src/types/
Chứa định nghĩa kiểu dữ liệu TypeScript.

### supabase/migrations/
Chứa các file SQL thay đổi cấu trúc database theo phiên bản.

### supabase/functions/
Chứa Edge Functions khi nghiệp vụ thực sự cần xử lý phía máy chủ.

### tests/
Chứa các bài kiểm thử ứng dụng.

## 4. Quy tắc quan trọng

- Không tự tạo bảng database chỉ vì cần một màn hình giao diện.
- Không đặt quy tắc quan trọng chỉ ở frontend.
- Các nghiệp vụ có thể phát sinh ghi trùng hoặc tranh chấp phải được kiểm soát phía database/backend.
- Không đưa mật khẩu, service role key hoặc thông tin bí mật vào GitHub.
- Không sửa trực tiếp database production mà không có kế hoạch migration và kiểm thử.
- Mọi thay đổi lớn phải cập nhật tài liệu liên quan.

## 5. Cấu trúc thực tế (2026-10-22)

```text
AGENTS.md                      Luật chung cho mọi AI agent
CLAUDE.md                      Hướng dẫn riêng cho Claude Code (import AGENTS.md)
.claude/settings.json          Quyền / chặn thao tác nguy hiểm cho Claude Code
src/
├── app/App.tsx                Khung ứng dụng, menu theo quyền, điều hướng
├── components/
│   ├── shared.tsx             Thành phần dùng chung: Chi phí, Thanh toán, Chọn vị trí, Phân trang, Thông báo
│   ├── MasterDossierModal.tsx Hồ sơ container (HV-/CV-/NT-/XT-)
│   └── K80TicketModal.tsx     Phiếu K80
├── features/
│   ├── inspector/             Giám định — Hạ vỏ (mobile)
│   ├── office/                Văn phòng — Hạ vỏ, Cấp vỏ, Nhập/Xuất tàu (chờ)
│   ├── receipts/              Văn phòng — Phiếu thu
│   ├── field-queues/          Hàng chờ Vệ sinh, Xe nâng (hạ / cấp), Báo giá, Sửa chữa
│   ├── forklift/              Xe nâng — Đảo chuyển
│   ├── yard/                  Tồn vỏ (sửa vị trí, khóa, ghi chú)
│   ├── reports/               Báo cáo
│   └── catalog/               Danh mục chung
├── services/                  TẦNG NGHIỆP VỤ — mọi quy tắc và kiểm tra quyền nằm ở đây
│   ├── depotOperations.ts     Các bước nghiệp vụ (Hạ vỏ, vị trí, dịch vụ, cấp vỏ, danh mục)
│   ├── payments.ts            Chứng từ → giao dịch thu tiền → phiếu thu
│   ├── reports.ts             Truy vấn báo cáo / phiếu thu có lọc, phân trang, xuất Excel
│   ├── permissions.ts         Ma trận quyền (nguồn duy nhất cho nghiệp vụ và menu)
│   ├── codes.ts               Cấp mã HV- / CV- / NT- / XT- / PT- / PTT- / CT-
│   ├── core.ts                Audit, kiểm tra vị trí, tiến độ, chuẩn hóa dữ liệu
│   └── depotStore.ts          State Demo, dữ liệu mẫu, chuẩn hóa dữ liệu localStorage cũ
├── lib/env.ts, lib/supabase.ts  Cấu hình môi trường / client Supabase (chưa dùng)
└── types/depot.ts             Kiểu dữ liệu
supabase/migrations/           Migration bản nháp (CHƯA ÁP DỤNG — sẽ viết lại)
tests/                         acceptance.test.ts (nghiệp vụ), ui-smoke.test.tsx (render màn hình)
```

Nguyên tắc: giao diện (`features/`, `components/`) không tự đặt quy tắc nghiệp vụ; chỉ gọi hàm trong `services/`. Khi có Supabase, `services/` sẽ được thay bằng lớp gọi RPC với cùng hợp đồng.