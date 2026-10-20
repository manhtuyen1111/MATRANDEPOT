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

## 5. Trạng thái

Cấu trúc này là bản đề xuất ban đầu. Chỉ triển khai sau khi xác nhận công nghệ và phạm vi từng giai đoạn.