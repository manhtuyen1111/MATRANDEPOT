# PROJECT STRUCTURE — MATRAN DEPOT

## 1. Nguyên tắc

- Tách giao diện, nghiệp vụ, dữ liệu và tài liệu.
- Không đặt toàn bộ nghiệp vụ trong một file.
- Không để thông tin bí mật trong mã nguồn hoặc GitHub.
- Chỉ tạo thư mục và file khi bắt đầu triển khai phần tương ứng.
- Mục 2–3 là khung ban đầu; **cấu trúc thật xem mục 5**, kiến trúc nhiều hãng tàu xem mục 6.

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

## 5. Cấu trúc thực tế (cập nhật 2026-11-02 — luôn sửa mục này khi thêm / chuyển / xóa file)

```text
AGENTS.md / CLAUDE.md          Luật chung cho agent / riêng Claude Code
.claude/settings.json          Quyền + chặn lệnh nguy hiểm (db push, …)
index.html                     Trang gốc + manifest PWA (DEC-205)
public/
├── manifest.webmanifest       PWA: tên, icon, màu (DEC-205)
├── sw.js                      Service worker: chỉ lưu vỏ ứng dụng, KHÔNG lưu dữ liệu Supabase
└── icons/                     Icon 192 / 512 / maskable / apple-touch / favicon
src/
├── main.tsx                   Khởi động: Demo (App) / database (RemoteApp) / trang hóa đơn khách (#/hoa-don); đăng ký PWA
├── app/
│   ├── App.tsx                Khung app: MENU, quyền menu, số đếm việc chờ, điều hướng màn
│   └── RemoteApp.tsx          Chế độ database: đăng nhập, tải dữ liệu, đồng bộ 30 giây
├── components/                Thành phần giao diện DÙNG CHUNG (không chứa quy tắc nghiệp vụ)
│   ├── shared.tsx             Nút / ô nhập / bảng: Feedback, Pager, DetailDrawer, SlotPicker, CellText, ExportExcelButton…
│   ├── InspectionFields.tsx   Form Giám định dùng chung (Hạ vỏ, Nhập tàu, trên kệ)
│   ├── EeirSurveyFields.tsx   Phần Tình trạng eEIR (Không hư / Hao mòn / Hư bên thứ 3 + lưới CEDEX — DEC-203)
│   ├── EeirMoveLine.tsx       Dòng CURRENT MOVE • LOCATION (chỉ đọc)
│   ├── K80TicketModal.tsx     Phiếu EEIR K80, phiếu trả khách hàng
│   ├── ReceiptPrint.tsx       Phiếu thu K80, xem trước → in · printNow.ts: lệnh in duy nhất
│   ├── MasterDossierModal.tsx Hồ sơ container (lịch sử từ dossierHistory)
│   ├── PhotoCamera.tsx · Qr.tsx  Chụp ảnh tác nghiệp · mã QR + quét
│   ├── AccountMenu.tsx · FeedbackButton.tsx · LoadingScreens.tsx · PaymentInfoCells.tsx
│   └── usePagedReport.ts · useReportState.ts   Báo cáo phân trang ở database / chạy theo bộ lọc
├── features/<bộ phận>/        Màn hình theo bộ phận — chỉ gọi services, hiển thị lỗi
│   ├── inspector/             Giám định: Hạ vỏ (3 bước, trên kệ), Cấp vỏ (ảnh)
│   ├── office/                Văn phòng: Hạ vỏ, Cấp vỏ, Trả chứng từ, Đổi container
│   ├── field-queues/          Hàng chờ Vệ sinh, Xe nâng, Sửa chữa (mobile)
│   ├── forklift/              Xe nâng — Đảo chuyển
│   ├── vessel/                Nhập / Xuất tàu (văn phòng + hiện trường)
│   ├── quotation/             Báo giá (QuotationWorkspace; AemsQuoteForm — form AEMS cho hãng bật aemsQuotation)
│   ├── receipts/              Phiếu thu
│   ├── invoice/               Trang khách yêu cầu xuất hóa đơn
│   ├── yard/                  Tồn vỏ
│   ├── reports/               Báo cáo theo bộ phận (tab), Góp ý
│   ├── catalog/               Danh mục chung (Khách / Hãng tàu / Vị trí / Container / Phân loại / Biểu giá / Công ty /
│   │                          Sửa chữa + CODE CEDEX / User - Role / Database / EDI)
│   └── auth/                  Màn đăng nhập (chế độ database)
├── lib/                       env.ts (cấu hình môi trường) · supabase.ts (client) · pwa.ts (cài ứng dụng)
├── types/depot.ts             Kiểu dữ liệu toàn app
└── services/                  TẦNG NGHIỆP VỤ — mọi quy tắc + kiểm tra quyền
    ├── api.ts                 CỬA GHI DUY NHẤT cho giao diện: gọi hàm nghiệp vụ, chế độ database thì gửi RPC tương ứng
    ├── depotOperations.ts     Hạ vỏ, vị trí, vệ sinh, báo giá, sửa chữa, cấp vỏ, đổi cont, danh mục
    ├── payments.ts · invoice.ts · codes.ts      Chứng từ → giao dịch → phiếu thu · xuất hóa đơn · cấp mã hồ sơ / phiếu
    ├── vessel.ts              Nhập / Xuất tàu
    ├── inspectionSurvey.ts    Quy tắc Tình trạng eEIR (CEDEX, ảnh, AV/DAMAGE tự suy)
    ├── releasePhoto.ts        Ảnh cấp vỏ (hãng bật releasePhoto)
    ├── cedexCatalog.ts        Danh mục CODE CEDEX + mã sửa chữa, đọc / xuất Excel (DEC-206)
    ├── aemsQuotation.ts       Báo giá AEMS: dòng tạo sẵn từ Giám định, lưu, trạng thái duyệt hãng, chặn chưa Approved (DEC-207)
    ├── stuffing.ts · yardStatus.ts · containerSearch.ts · photo.ts · datetime.ts · driverRoute.ts · dossierHistory.ts
    ├── permissions.ts         Ma trận quyền + MENU_ACCESS (nguồn duy nhất)
    ├── core.ts · depotStore.ts · demoData.ts · reports.ts · feedback.ts · dbHealth.ts · authPassword.ts
    ├── carriers/              ★ TÍCH HỢP HÃNG TÀU (xem mục 6)
    │   ├── types.ts           CarrierProfile: hãng bật chức năng nào, quy tắc booking, nguồn API, cấu hình EDI
    │   ├── registry.ts        CARRIERS + carrierOf / carrierUses / linesWith / carrierBookingProblem
    │   ├── equipment.ts       Lấy thông tin cont từ API hãng (lookupEquipment, equipmentPrefill — DEC-204)
    │   ├── standards/
    │   │   └── codeco.ts      Chuẩn UN/EDIFACT CODECO dùng chung, chạy theo CodecoConfig của từng hãng (DEC-197)
    │   └── maersk/            Mọi thứ RIÊNG Maersk
    │       ├── profile.ts     Hồ sơ MAERSK (MSK): eEIR form, ảnh cấp vỏ, booking 9–11, API (chưa kết nối), CODECO
    │       ├── rules.ts       Mã hãng, quy tắc booking
    │       ├── config.ts      MAERSK_CODECO, MAERSK_EEIR (mã shop 3HY…) — không chứa khóa
    │       ├── eeir.ts        Phiếu eEIR chạy thử (API v4.3), Current Move theo tác nghiệp
    │       └── aems.ts        Tính phiếu Báo giá AEMS (Preparation, giờ công × đơn giá, W / T) — hàm thuần (DEC-207)
    └── remote/                Chế độ database: session, sync (hàng chờ ghi + tải ảnh), loadState / loadWorking (tải dữ liệu),
                               reportPaging / reportSource / dossierSource / ediSource / dbHealthSource, photoLink, edge
supabase/
├── migrations/                Migration theo thứ tự thời gian (bảng tiến độ ở supabase/README.md) — người dùng tự db push
├── tests/                     pgTAP 00xx_*.test.sql (+ edge-functions.local.cjs)
├── functions/                 Edge Function: admin-create-staff, admin-reset-password, purge-expired-photos, _shared
├── scripts/                   Script chạy tay (reset_operational_data.sql — người dùng tự chạy)
└── test-data/                 Dữ liệu danh mục test + Admin đầu tiên
tests/                         acceptance (nghiệp vụ) · ui-smoke (màn hình) · edi-codeco · vessel · invoice · feedback · auth ·
                               demo-data · *.local.test.ts (chạy thật trên Supabase local)
docs/                          Tài liệu (DECISIONS là luật) · docs/design/ thiết kế màn · docs/agents/ quy trình agent
devs/                          PROGRESS (tiến độ + bàn giao) · ROADMAP
```

Nguyên tắc: giao diện (`features/`, `components/`) không tự đặt quy tắc nghiệp vụ; chỉ gọi hàm trong `services/` (ghi qua `services/api.ts`).

## 6. Kiến trúc nhiều hãng tàu / nhiều API (người dùng yêu cầu 2026-11-02)

**Mục tiêu:** sau này kết nối thêm hãng (ONE, CMA, Evergreen…) và nhiều API khác nhau mà **không sửa nghiệp vụ chung**.

1. **Nghiệp vụ chung không kiểm tra cứng mã hãng.** Không viết `line === 'MSK'` hay `isMaerskLine` ngoài `carriers/maersk/`. Hỏi registry:
   - `carrierUses(line, 'inspectionSurvey')` — Giám định theo form eEIR (DEC-203)
   - `carrierUses(line, 'releasePhoto')` / `linesWith('releasePhoto')` — ảnh cấp vỏ (DEC-198)
   - `carrierBookingProblem(line, booking)` — quy tắc booking riêng (DEC-199)
   - `carrierOf(line)?.equipment` — API thông tin cont (DEC-204); `carrierOf(line)?.codeco` — cấu hình EDI CODECO (DEC-197)
   - `carrierUses(line, 'aemsQuotation')` — Báo giá theo AEMS + chờ hãng duyệt (DEC-207; database `aems_quotation_lines()`)
2. **Mỗi hãng 1 thư mục** `src/services/carriers/<hãng>/`: `profile.ts` (bật chức năng) · `rules.ts` (quy tắc riêng) · `config.ts` (thông số kết nối, không khóa) · file theo API (`eeir.ts`, …).
3. **Chuẩn dùng chung** đặt ở `carriers/standards/` (CODECO EDIFACT). Hãng chỉ khai báo cấu hình; định dạng riêng (khác chuẩn) mới viết trong thư mục hãng.
4. **Khóa / mật khẩu API không bao giờ ở frontend / repo:** gọi API hãng qua Edge Function (`supabase/functions/<hãng>-…`), khóa ở `supabase secrets` do người dùng đặt. Frontend chỉ thấy `connected: true/false`.
5. **Danh mục theo hãng** (Phân loại DEC-166, CODE CEDEX DEC-206, Biểu giá) đã có cột hãng tàu — thêm hãng chỉ cần nhập dữ liệu, không sửa code.
6. **Database khớp với hồ sơ hãng:** các hàm `maersk_line_codes()`, `release_photo_lines()` (migration) phải cùng danh sách với `profile.lineCodes` / `linesWith(...)`. Đổi hồ sơ hãng → viết migration cập nhật hàm tương ứng.

### Thêm hãng tàu / API mới — các bước

1. Thêm hãng trong **Danh mục chung → Hãng tàu** (mã, ví dụ `ONE`) + Phân loại + CODE CEDEX (Excel) cho hãng.
2. Tạo `src/services/carriers/<hãng>/profile.ts` (`CarrierProfile`): `lineCodes`, `features`, `bookingRule?`, `equipment?`, `codeco?`.
3. Thêm hồ sơ vào `CARRIERS` trong `carriers/registry.ts`.
4. Có API riêng → file `carriers/<hãng>/<api>.ts` (dựng dữ liệu, kiểm tra thiếu) + Edge Function gọi API (khóa ở máy chủ); có EDI CODECO → `config.ts` khai báo `CodecoConfig`.
5. Bật chức năng ở database nếu cần (migration cập nhật `release_photo_lines()` / hàm tương ứng) + pgTAP.
6. Test: `tests/acceptance.test.ts` mục "Hồ sơ hãng tàu" (mỗi mã hãng chỉ thuộc 1 hồ sơ) + test riêng của hãng.
7. Ghi quyết định vào `docs/DECISIONS.md`, tài liệu hãng (như `docs/EDI_MAERSK.md`), và **cập nhật cây thư mục mục 5 ở file này**.
