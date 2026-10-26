# THIẾT KẾ DATABASE v1 — MATRAN DEPOT (P4-01, DEC-149 → DEC-151)

**Trạng thái: ĐÃ DUYỆT 2026-10-26 (DEC-152).** Migration viết vào `supabase/migrations/` theo mục 11 — tiến độ ở `supabase/README.md`. Agent không apply; người dùng tự apply lên project của mình.

Nguồn: bản Demo (mốc `demo-truoc-database-2026-10-26`), `docs/STATUS_CATALOG.md` (đã duyệt), `docs/DATABASE_CONTRACT.md`, `docs/API_RPC_CONTRACT.md`.

## 0. Nền tảng và quy mô

| Mục | Chốt |
|---|---|
| Nền tảng | Supabase vùng Singapore, gói Pro + PITR; 3 môi trường dev / staging / production (DEC-149) |
| Người dùng | 50–70 nhân viên dùng cùng lúc (DEC-150) |
| Tải | 10.000–15.000 container ra vào / tháng ≈ 500 lượt / ngày, cao điểm ~60 lượt / giờ |
| Dữ liệu trực tuyến | 3 năm; quá hạn chuyển kho lưu trữ theo tháng (DEC-150) |
| Ảnh | ~200 KB / ảnh, giữ 24 tháng (DEC-150) |
| Đăng nhập | Tên đăng nhập → email nội bộ; không khóa, không tự đăng xuất (DEC-151) |
| Mất mạng | Không lưu tạm; báo lỗi, chờ có mạng (DEC-151) |

**Ước tính 3 năm trực tuyến** (mức cao 15.000 / tháng):

| Bảng | 3 năm |
|---|---|
| Hồ sơ Hạ vỏ + Cấp vỏ | ~550.000 dòng |
| Lượt lưu bãi | ~300.000 |
| Chứng từ + giao dịch + phiếu thu | ~1,5 triệu |
| Lịch sử vị trí | ~1 triệu |
| Nhật ký | ~6 triệu |

Tổng ~3–6 GB dữ liệu, ~50 GB ảnh. Mức này là nhỏ với Postgres (gói Pro có 8 GB database, mở rộng được). Nút thắt không phải dung lượng mà là **truy vấn danh sách có bộ lọc** → giải bằng chỉ mục đúng bộ lọc và phân trang con trỏ (mục 5).

## 1. Quy ước

- Tên bảng / cột: `snake_case`, tiếng Anh như code Demo. Nhãn tiếng Việt chỉ ở giao diện.
- Khóa chính `id uuid default gen_random_uuid()`. Mã nghiệp vụ (HV-, CV-, NT-, XT-, PT-TT-, PT-TTR-, GY-) là cột `code text unique`.
- Thời gian `timestamptz` (lưu UTC, hiển thị `dd/MM/yyyy HH:mm:ss` giờ Việt Nam ở giao diện — DEC-054).
- Tiền: `bigint` đơn vị đồng, đã gồm VAT. Không dùng số thực.
- Trạng thái: kiểu `enum` Postgres, đúng mã trong `STATUS_CATALOG.md`.
- Mảng nhỏ cố định (lỗi hư hỏng, hạng mục vệ sinh): `text[]`. Danh sách có thuộc tính riêng (dòng chi phí, thành viên tổ, cont trong danh sách tàu): bảng con.
- Mọi bảng tác nghiệp có `created_at`, `created_by` (FK `staff`), và `updated_at`. Bảng cần sửa đồng thời có thêm `version int` để chống ghi đè.
- Người thực hiện lưu cả `*_by` (FK `staff`) và tên tại thời điểm làm (`*_by_name`), để báo cáo / in không đổi khi nhân viên đổi tên.

## 2. Kiểu enum

| Enum | Giá trị |
|---|---|
| `app_role` | ADMIN, MANAGER, OFFICE, FORKLIFT, CLEANING, INSPECTOR, QUOTATION, REPAIR_STAFF, ACCOUNTANT |
| `condition_class` | AV, DAMAGE, W-SURVEY |
| `stuffing_class` | M, K, E |
| `container_status` | WAITING_PLACEMENT, IN_YARD, ALLOCATED, GATED_OUT |
| `forklift_task` | NONE, HA_KE_GIAM_DINH |
| `gate_in_type` | CUSTOMER_RETURN, VESSEL_IMPORT |
| `gate_in_status` | FIELD_RECORDED, PAYMENT_PENDING, GATE_IN_OK, CANCELLED |
| `gate_out_type` | EMPTY_RELEASE, VESSEL_EXPORT |
| `gate_out_status` | PAYMENT_PENDING, PENDING_FORKLIFT, GATE_OUT_OK, CANCELLED |
| `booking_status` | OPEN, FULLY_ALLOCATED, COMPLETED, CANCELLED |
| `work_category` | CLEANING, INSPECTION, REPAIR |
| `work_status` | OPEN, COMPLETED, CANCELLED |
| `approval_status` | NOT_REQUIRED, PENDING_APPROVAL, APPROVED |
| `voucher_status` | PENDING, CONFIRMED, DEFERRED, FAILED, CANCELLED |
| `payment_category` | TTTT, TTT, TTS |
| `direct_method` | CASH, BANK_TRANSFER_API |
| `tx_status` | PENDING, SUCCEEDED, FAILED, CANCELLED |
| `receipt_purpose` | VOUCHER, PREPAID_TOPUP |
| `prepaid_status` | PENDING_PAYMENT, ACTIVE, EXHAUSTED, CANCELLED |
| `invoice_status` | CHUA_XHD, YEU_CAU_XHD, DA_XHD |
| `vessel_mode` | NHAP_TAU, XUAT_TAU |
| `vessel_list_status` | OPEN, APPROVED |
| `vessel_item_status` | PENDING, INSPECTED, DONE, SKIPPED |
| `location_action` | INITIAL_BLOCK, DETAIL_SLOT_UPDATE, YARD_SHIFT, GATE_OUT_CLEAR |
| `feedback_status` | MOI, DANG_XU_LY, DA_XU_LY, KHONG_AP_DUNG |
| `fee_category` | NANG_HA, THU_GOM_RAC, KHAC |

Size / Type container **không** là enum (Admin thêm được) → bảng danh mục.

## 3. Bảng

### 3.1. Nhân viên và quyền

| Bảng | Cột chính | Ghi chú |
|---|---|---|
| `staff` | id (= `auth.users.id`), staff_code, username unique, full_name, email, is_active, must_change_password, created_at | Đăng nhập: `username` → `username@matrandepot.local` (DEC-151) |
| `staff_roles` | staff_id, role `app_role` — PK (staff_id, role) | Nhiều vai trò / người |

Quyền chi tiết (`PERMISSIONS`, `MENU_ACCESS`) giữ trong code như Demo và lặp lại trong hàm SQL `has_permission(perm text)` — một nguồn khai báo cho cả hai: file `supabase/permissions.sql` sinh từ `src/services/permissions.ts`.

### 3.2. Danh mục (Admin cấu hình)

| Bảng | Cột chính |
|---|---|
| `company_profile` | 1 dòng: name, short_name, address, phone, email, tax_code, bank_account |
| `partners` | code unique, name, is_shipping_line, is_customer, allow_tts, is_active |
| `container_sizes` / `container_types` | code unique, sort_order |
| `yard_blocks` | code unique (`BLOCK-…`), name, max_bay, max_row, max_tier, capacity, is_inspection_rack, description |
| `fee_catalog` | code unique, name, category, size?, type?, shipping_line_code? (null = mọi hãng), amount, is_active |
| `repair_teams`, `repair_team_members` | team: code, name, is_active · member: team_id, full_name, staff_id?, is_active |

Xóa danh mục đã dùng: không xóa cứng, đặt `is_active = false`.

### 3.3. Bộ đếm mã

`code_counters (prefix text, day date, last_no int, PK (prefix, day))`.

Hàm `next_code(prefix)`:
- Chạy `insert … on conflict do update set last_no = last_no + 1 returning last_no` trong cùng giao dịch với tác nghiệp.
- Hai người bấm cùng lúc vẫn ra 2 mã khác nhau.
- Mã chỉ cấp khi tác nghiệp thành công; giao dịch lỗi thì mã không bị chiếm.

### 3.4. Hạ vỏ, lượt lưu bãi, K80

| Bảng | Cột chính |
|---|---|
| `gate_in_orders` | code (HV-/NT-), gate_in_type, status, door_photo_path, photo_expires_at, condition_class, damage_remarks text[], stuffing_class?, cleaning_items text[], manufacture_year?, to_inspection_rack, rack_inspected_by?/at?, field_by/at · container_no?, size?, type?, truck_no?, driver_phone?, customer_code?, customer_name, shipping_line_code?, order_doc_no?, office_by/at? · fee_amount, voucher_id? · gate_in_ok_by/at?, documents_returned_by/at?, cancel_reason? |
| `containers` (lượt lưu bãi) | gate_in_id, container_no, size, type, manufacture_year?, shipping_line_code, customer_name, status, condition_class, damage_remarks, stuffing_class?, cleaning_items, active_qr_code, is_paid · current_block?/bay?/row?/tier? · needs_cleaning, needs_quotation, needs_repair, forklift_task · is_on_hold, hold_source?, hold_reason?, hold_by/at? · office_note?, office_note_by/at? · quotation_items text[], quotation_labor_hours?, quotation_by/at? · allocated_gate_out_id?, vessel_export_item_id? · gate_in_at, gate_out_at? · version |
| `k80_tickets` | code (K80-…), dossier_code, out_dossier_code?, qr_code unique, operation_mode, is_paid, payment_label, snapshot (size, type, tình trạng…), issued_by/at |
| `location_history` | container_id, dossier_code, container_no, from_location, to_location, action, reason, performed_by/at |

Ràng buộc quan trọng:
- **Một container chỉ một lượt đang trong bãi:** `unique (container_no) where status <> 'GATED_OUT'`.
- **Một ô bãi chỉ một container** khi đủ Block + Bay + Row + Tier (DEC-087): `unique (current_block, current_bay, current_row, current_tier) where status <> 'GATED_OUT' and current_tier is not null`.
- W-SURVEY: `condition_class = 'W-SURVEY'` thì `stuffing_class`, `manufacture_year` được trống; ngược lại bắt buộc (`check`).

### 3.5. Vệ sinh / Báo giá / Sửa chữa

| Bảng | Cột chính |
|---|---|
| `work_orders` | code, container_id, dossier_code, category, items text[], approval_status, work_status, assigned_to, labor_hours?, repair_team_id?, result_notes?, completed_by/at? |
| `work_order_members` | work_order_id, member_id — thành viên tổ đã làm (DEC-043) |

### 3.6. Cấp vỏ

| Bảng | Cột chính |
|---|---|
| `release_bookings` | booking_no unique, release_type, shipping_line_code, requester_name, receiver_name, size, type, requested_qty?, status |
| `gate_out_orders` | code (CV-/XT-), gate_out_type, booking_id, container_id, container_no, truck_no, driver_phone?, receiver_name, fee_amount, voucher_id?, 5 cột `chk_*`, status, confirmed_by/at?, cancel_reason?, cancelled_at?, documents_returned_by/at? |

Danh sách cont đã cấp / đã ra của booking **không lưu mảng** như Demo; tính từ `gate_out_orders` (tránh lệch số liệu).

### 3.7. Thanh toán

| Bảng | Cột chính |
|---|---|
| `vouchers` (chứng từ) | voucher_no (= mã hồ sơ, DEC-119), service_type, dossier_code, container_no, shipping_line_code, payer_name, amount, payment_category?, direct_method?, prepaid_id?, tts_note?, status, confirmed_by/at? |
| `fee_lines` | owner_type (VOUCHER / PREPAID / GATE_IN / GATE_OUT), owner_id, catalog_code, name, quantity, unit_amount, amount |
| `payment_transactions` | payment_ref unique, purpose, voucher_id?, prepaid_id?, dossier_code?, container_no?, payer_name, method, payment_category, amount, status, qr_payload?, provider_tx_ref unique?, confirmed_by/at?, cancel_reason?, receipt_id? |
| `payment_receipts` (phiếu thu) | receipt_no unique (PT-TT- / PT-TTR-), transaction_id, purpose, operation, amount, method, payment_category, voucher_id?, prepaid_id?, dossier_code?, container_no?, payer_name, provider_tx_ref?, issued_by/at, invoice_secret_hash, invoice_status |
| `receipt_prints` | receipt_id, printed_by, printed_at (DEC-063) |
| `prepaid_receipts` (phiếu thu trả trước) | code (PT-TTR-), qr_code unique, customer_code?, customer_name, lot_description, total_amount, remaining_amount (`check >= 0`), status, payment_method?, activated_at? |
| `prepaid_deductions` | prepaid_id, voucher_id, container_no, amount, balance_before, balance_after, performed_by/at |
| `invoice_requests` | receipt_id, group_no?, tax_code, email, company_name, address, note?, amount, status, requested_at, invoice_no?, issued_by/at? |
| `invoice_request_items` | request_id, deduction_id unique — 1 lượt chỉ thuộc 1 yêu cầu (DEC-130) |

Bảo mật:
- **Mã bảo mật hóa đơn** (12 ký tự, DEC-111) chỉ lưu **băm** (`invoice_secret_hash`). Mã gốc chỉ in trên phiếu.
- Trang khách `#/hoa-don` gọi RPC công khai `request_invoice(secret, …)`. RPC này chỉ trả đúng phiếu khớp mã băm.
- **Chống ghi nhận tiền hai lần:** `provider_tx_ref` là unique. Callback ngân hàng lặp lại thì bỏ qua (DEC-031).

### 3.8. Nhập tàu / Xuất tàu

| Bảng | Cột chính |
|---|---|
| `vessel_lists` | mode, vessel_name, shipping_line_code?, planned_at, status, approve_note?, approved_by/at? |
| `vessel_list_trucks` | list_id, truck_no |
| `vessel_list_items` | list_id, container_no, size, type, status, dossier_code?, container_id?, truck_no?, kết quả giám định (condition, stuffing, cleaning, year, damage, photo_path), location_at_list?, inspected_by/at?, done_by/at? — `unique (list_id, container_no)` |

### 3.9. Góp ý, nhật ký

| Bảng | Cột chính |
|---|---|
| `feedbacks` | code (GY-), menu_id, menu_label, content, status, created_by, response?, responded_by/at? |
| `audit_logs` | created_at, actor_id, actor_name, actor_role, action_code, entity_type, entity_code, dossier_code?, summary — **chia partition theo tháng** |

## 4. Chia partition và lưu kho (DEC-150, chỉnh ở DEC-151)

- Với quy mô thật (mục 0), chỉ **2 bảng ghi thêm liên tục** là `audit_logs` và `location_history` cần **partition theo tháng**.
- Các bảng nghiệp vụ còn lại (vài trăm nghìn dòng / 3 năm) **không cần partition**: chỉ mục theo thời gian đã đủ nhanh, và tránh rắc rối khóa ngoại với bảng partition.
- **Chuyển kho hằng tháng** (tác vụ định kỳ `pg_cron` + Edge Function):
  - Dữ liệu có thời điểm đóng quá **36 tháng**: hồ sơ đã GATE OUT / hủy, chứng từ, phiếu thu, nhật ký.
  - Tác vụ xuất ra file nén, mã hóa, lưu ở kho ngoài (bucket riêng hoặc nhà cung cấp khác).
  - Kiểm tra số dòng khớp rồi mới xóa khỏi database. Partition nhật ký cũ thì tách ra (`detach`) rồi xóa.
- **Ảnh:**
  - Bucket riêng tư `door-photos`, đường dẫn `yyyy/mm/<mã hồ sơ>.jpg`.
  - Tác vụ hằng ngày xóa ảnh có `photo_expires_at` < hôm nay, rồi đặt `door_photo_path = null`. Giao diện ghi "ảnh đã hết hạn lưu".

## 5. Chỉ mục và truy vấn

Chỉ mục theo đúng bộ lọc trên màn hình:

| Màn / truy vấn | Chỉ mục |
|---|---|
| Tồn vỏ | `containers (status, gate_in_at desc) where status <> 'GATED_OUT'`; `containers (shipping_line_code, …)`, `(current_block)` |
| Tìm số cont | `containers (container_no)`, `gate_in_orders (container_no)`, `gate_out_orders (container_no)` (+ `pg_trgm` cho tìm một phần) |
| Hàng chờ hiện trường | chỉ mục một phần: `where needs_cleaning`, `where needs_quotation`, `where needs_repair`, `where status = 'WAITING_PLACEMENT'`, `where condition_class = 'W-SURVEY'` |
| Báo cáo Hạ / Cấp vỏ | `gate_in_orders (gate_in_ok_at, status)`, `gate_out_orders (confirmed_at, status)` |
| Phiếu thu | `payment_receipts (issued_at)`, `(invoice_status, issued_at)`, `(payer_name)` |
| Giao dịch chờ | `payment_transactions (status, created_at) where status = 'PENDING'` |
| Nhật ký | partition tháng + `(entity_code)`, `(dossier_code)` |

Quy tắc truy vấn (giữ DEC-066):
- Danh sách và báo cáo chạy qua RPC.
- **Bắt buộc lọc thời gian, tối đa 3 tháng một lần.**
- Phân trang con trỏ theo `(thời gian, id)`, không dùng `OFFSET`; 20 / 50 / 100 dòng.
- Excel lấy theo lô 1.000 dòng.

## 6. Ghi dữ liệu: RPC và an toàn đồng thời

- **Mọi thao tác ghi đi qua RPC** (hàm Postgres `security definer`). Mỗi RPC tương ứng một hàm trong `src/services/` (ví dụ `record_gate_in_field_step`, `complete_rack_inspection`, `settle_voucher`). Danh sách ở `docs/API_RPC_CONTRACT.md` sẽ cập nhật.
- Mỗi RPC:
  1. kiểm tra quyền (`has_permission`);
  2. khóa dòng cần sửa (`select … for update`);
  3. kiểm tra trạng thái như service;
  4. ghi, rồi cấp mã;
  5. ghi `audit_logs`.

  Toàn bộ nằm trong **một giao dịch**: lỗi ở bước nào thì không ghi gì.
- **Hai người làm cùng một cont:** khóa dòng + cột `version` → người thứ hai nhận lỗi "Container vừa được người khác cập nhật, tải lại", không ghi đè.
- **Mất mạng (DEC-151):**
  - Không có hàng đợi tạm. Nút bấm chờ máy chủ trả lời; mất mạng thì báo lỗi, dữ liệu trên màn giữ nguyên để bấm lại.
  - Mỗi lần bấm gửi kèm `request_id`. Bấm lại cùng `request_id` thì RPC trả kết quả cũ, không tạo hồ sơ thứ hai (chống bấm 2 lần khi mạng chập chờn).

## 7. Quyền truy cập (RLS)

- Bật RLS mọi bảng. **Không cấp `insert / update / delete` trực tiếp** cho người dùng; chỉ RPC ghi.
- `select`: nhân viên đăng nhập và đang hoạt động đọc được dữ liệu tác nghiệp (giống Demo: mỗi vai trò thấy màn của mình do giao diện, dữ liệu dùng chung). Bảng nhạy cảm giới hạn thêm:
  - `staff`, `staff_roles`: chỉ Admin đọc đầy đủ; người khác đọc tên.
  - `invoice_requests`: Văn phòng, Kế toán, Admin.
  - `audit_logs`: Quản lý, Admin.
- Người chưa đăng nhập (`anon`) chỉ gọi được 2 RPC công khai: tra phiếu theo mã bảo mật và gửi yêu cầu hóa đơn.
- Khóa `service_role` chỉ dùng ở Edge Function (ngân hàng, xuất Excel lớn, lưu kho); **không bao giờ ở frontend**.

## 8. Đăng nhập (DEC-143, DEC-151)

- Admin tạo nhân viên qua Edge Function `admin_create_staff` (dùng `service_role` phía máy chủ):
  - tạo `auth.users` với email `username@matrandepot.local`, mật khẩu `123456`, `must_change_password = true`;
  - tạo dòng `staff`, `staff_roles`.
- Đăng nhập lần đầu bắt buộc đổi mật khẩu. Mật khẩu mới không trống, khác 123456; độ dài tùy ý.
  - **Lưu ý:** Supabase mặc định đòi tối thiểu 6 ký tự. Phải chỉnh cài đặt Auth của project về tối thiểu 1.
- **Không khóa** khi nhập sai nhiều lần; **không tự đăng xuất** (DEC-151). Phiên được làm mới tự động.
- Admin không xem được mật khẩu; chỉ **Đặt lại** về 123456.
- Tài khoản khóa (`is_active = false`) thì RPC từ chối mọi thao tác dù phiên còn hạn.

## 9. Sao lưu (Q-039 — ĐÃ CHỐT, DEC-152)

PITR 7 ngày (mất tối đa ~5 phút dữ liệu) + bản dump mã hóa hằng đêm ra kho ngoài Supabase + diễn tập khôi phục mỗi quý trên staging.

## 10. Chuyển từ Demo sang database

- Bản Demo vẫn giữ (tag `demo-truoc-database-2026-10-26`).
- App đọc biến môi trường: có cấu hình Supabase thì chạy chế độ thật, không có thì chạy Demo như cũ (`isSupabaseConfigured` đã có sẵn).
- Lớp `src/services/` giữ nguyên tên hàm. Mỗi hàm có 2 cách chạy: Demo (localStorage) hoặc gọi RPC. Giao diện không phải sửa nhiều.
- **Dữ liệu chạy thật bắt đầu sạch.** Danh mục nhập lại hoặc nhập từ file Excel. Không chuyển dữ liệu test.

## 11. Thứ tự làm sau khi duyệt

1. Migration 1: enum, danh mục, nhân viên, bộ đếm mã, RLS nền, `has_permission`.
2. Migration 2: Hạ vỏ, lượt lưu bãi, K80, vị trí, vệ sinh / báo giá / sửa chữa, W-SURVEY.
3. Migration 3: Thanh toán, phiếu thu, trả trước, hóa đơn.
4. Migration 4: Cấp vỏ, booking; Nhập / Xuất tàu.
5. Migration 5: nhật ký partition, tác vụ ảnh / lưu kho, chỉ mục báo cáo.

Mỗi bước có kèm test pgTAP: trường hợp thành công và bị từ chối (quyền, trạng thái, dữ liệu sai). Migration nháp cũ `20261021000001_init_matran_depot_schema.sql` (không khớp nghiệp vụ) sẽ được thay, **không apply**.

## 12. Còn chờ

- **Q-032:** ngân hàng — **làm sau** (DEC-152): Migration 3 làm khung nhận thông báo ngân hàng chung; tạm thời Văn phòng xác nhận tay tiền chuyển khoản.
- **OPEN-008:** hoàn tiền — **chưa làm, giữ chặn** (DEC-152): lệnh đã thu phí không hủy trên hệ thống; hoàn tiền xử lý ngoài hệ thống.
