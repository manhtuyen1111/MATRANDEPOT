-- ============================================================================
-- MATRAN DEPOT — Migration 3/5 (phần 1): BẢNG THANH TOÁN — chứng từ, dòng chi phí, giao dịch, phiếu thu,
-- phiếu thu trả trước, lượt trừ, hóa đơn (DEC-031, DEC-098 → DEC-130)
-- Hợp đồng: src/services/payments.ts, invoice.ts, types PaymentVoucher / PaymentTransaction / PaymentReceipt /
-- MasterPrepaidReceipt / MasterReceiptDeduction / InvoiceGroup.
-- DEC-154: mã bảo mật hóa đơn lưu bản gốc (cần in lại phiếu) nhưng chỉ người có quyền xem phiếu thu đọc được.
-- ============================================================================

-- CHỨNG TỪ PHẢI THU — số chứng từ = mã hồ sơ tác nghiệp (DEC-119)
create table public.vouchers (
  id uuid primary key default gen_random_uuid(),
  voucher_no text not null unique,
  service_type text not null check (service_type in ('GATE_IN', 'GATE_OUT')),
  dossier_code text not null,
  container_no text not null,
  shipping_line_code text not null default '',
  payer_name text not null,
  amount bigint not null check (amount >= 0),
  payment_category public.payment_category,
  direct_method public.direct_method,
  scanned_qr_code text,
  prepaid_code text,                                   -- PT-TTR- đã trừ (TTR)
  tts_note text,
  provider_tx_ref text,
  status public.voucher_status not null default 'PENDING',
  confirmed_by uuid references public.staff (id),
  confirmed_by_name text,
  confirmed_at timestamptz,
  created_by uuid references public.staff (id),
  created_by_name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index vouchers_dossier on public.vouchers (dossier_code);
create trigger vouchers_touch before update on public.vouchers for each row execute function public.touch_updated_at();

-- DÒNG CHI PHÍ — chụp tên + đơn giá biểu giá lúc lập (đã gồm VAT)
create table public.fee_lines (
  id uuid primary key default gen_random_uuid(),
  owner_type text not null check (owner_type in ('VOUCHER', 'PREPAID')),
  owner_id uuid not null,
  catalog_code text not null,
  name text not null,
  quantity int not null default 1 check (quantity between 1 and 9999),
  unit_amount bigint not null check (unit_amount >= 0),
  amount bigint not null check (amount = unit_amount * quantity),
  sort_order int not null default 0
);
create index fee_lines_owner on public.fee_lines (owner_type, owner_id);

-- PHIẾU THU TRẢ TRƯỚC (PT-TTR- cấp ngay khi tạo — DEC-124)
create table public.prepaid_receipts (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  qr_code text not null unique,                        -- QR-<mã>
  customer_code text not null,
  customer_name text not null,
  lot_description text not null,
  total_amount bigint not null check (total_amount > 0),
  remaining_amount bigint not null default 0 check (remaining_amount >= 0 and remaining_amount <= total_amount),
  status public.prepaid_status not null default 'PENDING_PAYMENT',
  payment_method public.direct_method not null,
  created_by uuid references public.staff (id),
  created_by_name text not null,
  created_at timestamptz not null default now(),
  activated_at timestamptz
);

-- GIAO DỊCH THU TIỀN — tạo yêu cầu / QR KHÔNG phải đã thu tiền (DEC-031)
create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),
  payment_ref text not null,                           -- nội dung chuyển khoản = mã chứng từ / mã PT-TTR-
  purpose public.receipt_purpose not null,
  voucher_id uuid references public.vouchers (id),
  prepaid_id uuid references public.prepaid_receipts (id),
  dossier_code text,
  container_no text,
  payer_name text not null,
  method public.direct_method not null,
  payment_category public.payment_category not null check (payment_category in ('TTTT', 'TTT')),
  amount bigint not null check (amount > 0),
  status public.tx_status not null default 'PENDING',
  qr_payload text,
  provider_tx_ref text unique,                         -- chống ghi nhận 2 lần cùng giao dịch ngân hàng
  created_by uuid references public.staff (id),
  created_by_name text not null,
  created_at timestamptz not null default now(),
  confirmed_by uuid references public.staff (id),
  confirmed_by_name text,
  confirmed_at timestamptz,
  cancel_reason text,
  check ((purpose = 'VOUCHER') = (voucher_id is not null)),
  check ((purpose = 'PREPAID_TOPUP') = (prepaid_id is not null))
);
-- Mỗi chứng từ / phiếu trả trước chỉ 1 yêu cầu đang chờ
create unique index payment_tx_one_pending_voucher on public.payment_transactions (voucher_id) where status = 'PENDING' and voucher_id is not null;
create unique index payment_tx_one_pending_prepaid on public.payment_transactions (prepaid_id) where status = 'PENDING' and prepaid_id is not null;
create index payment_tx_pending on public.payment_transactions (created_at desc) where status = 'PENDING';
create index payment_tx_ref on public.payment_transactions (payment_ref);

-- PHIẾU THU — tối đa 1 phiếu / giao dịch thành công
create table public.payment_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_no text not null unique,                     -- PT-TT- / PT-TTR-
  transaction_id uuid not null unique references public.payment_transactions (id),
  purpose public.receipt_purpose not null,
  operation text not null check (operation in ('HA_VO', 'CAP_VO', 'THU_TRUOC', 'KHAC')),
  amount bigint not null check (amount > 0),
  method public.direct_method not null,
  payment_category public.payment_category not null,
  voucher_id uuid references public.vouchers (id),
  voucher_no text,
  prepaid_id uuid references public.prepaid_receipts (id),
  prepaid_code text,
  dossier_code text,
  container_no text,
  payer_name text not null,
  provider_tx_ref text,
  issued_by uuid references public.staff (id),
  issued_by_name text not null,                        -- DEC-113: luôn là nhân viên
  issued_at timestamptz not null default now(),
  -- Hóa đơn (DEC-111) — phiếu thường; phiếu trả trước theo invoice_groups
  invoice_secret text not null unique check (invoice_secret ~ '^[A-Za-z0-9]{12}$'),
  invoice_status public.invoice_status not null default 'CHUA_XHD',
  invoice_tax_code text,
  invoice_email text,
  invoice_company text,
  invoice_address text,
  invoice_note text,
  invoice_requested_at timestamptz,
  invoice_updated_at timestamptz,
  invoice_no text,
  invoice_issued_by_name text,
  invoice_issued_at timestamptz
);
create index payment_receipts_issued on public.payment_receipts (issued_at desc);
create index payment_receipts_invoice on public.payment_receipts (invoice_status, issued_at desc);
create index payment_receipts_payer_trgm on public.payment_receipts using gin (payer_name gin_trgm_ops);
create index payment_receipts_dossier on public.payment_receipts (dossier_code);

create table public.receipt_prints (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.payment_receipts (id),
  printed_by uuid references public.staff (id),
  printed_by_name text not null,
  printed_at timestamptz not null default now()
);
create index receipt_prints_receipt on public.receipt_prints (receipt_id, printed_at);

-- LƯỢT TRỪ PHIẾU THU TRẢ TRƯỚC
create table public.prepaid_deductions (
  id uuid primary key default gen_random_uuid(),
  prepaid_id uuid not null references public.prepaid_receipts (id),
  voucher_id uuid not null unique references public.vouchers (id),  -- 1 chứng từ chỉ trừ 1 lần
  container_no text not null,
  amount bigint not null check (amount > 0),
  balance_before bigint not null,
  balance_after bigint not null check (balance_after >= 0 and balance_after = balance_before - amount),
  performed_by uuid references public.staff (id),
  performed_by_name text not null,
  performed_at timestamptz not null default now()
);
create index prepaid_deductions_prepaid on public.prepaid_deductions (prepaid_id, performed_at desc);

-- HÓA ĐƠN THEO LƯỢT cho phiếu thu trả trước (DEC-130): khách tự gộp lượt; 1 lượt chỉ thuộc 1 yêu cầu
create table public.invoice_groups (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.payment_receipts (id),
  tax_code text not null,
  email text not null,
  company_name text not null,
  address text not null,
  note text,
  amount bigint not null check (amount > 0),
  status public.invoice_status not null default 'YEU_CAU_XHD' check (status in ('YEU_CAU_XHD', 'DA_XHD')),
  requested_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  invoice_no text,
  issued_by_name text,
  issued_at timestamptz
);
create index invoice_groups_receipt on public.invoice_groups (receipt_id);

create table public.invoice_group_items (
  group_id uuid not null references public.invoice_groups (id) on delete cascade,
  deduction_id uuid not null unique references public.prepaid_deductions (id),
  primary key (group_id, deduction_id)
);

-- Khóa ngoại còn thiếu từ migration 2
alter table public.gate_in_orders add constraint gate_in_orders_voucher_fk foreign key (voucher_id) references public.vouchers (id);

-- RLS: đọc theo vai trò; ghi chỉ qua RPC
alter table public.vouchers enable row level security;
alter table public.fee_lines enable row level security;
alter table public.prepaid_receipts enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.payment_receipts enable row level security;
alter table public.receipt_prints enable row level security;
alter table public.prepaid_deductions enable row level security;
alter table public.invoice_groups enable row level security;
alter table public.invoice_group_items enable row level security;
-- Chứng từ / chi phí: mọi nhân viên (Hạ vỏ / Cấp vỏ hiện thanh toán); tiền: người xem phiếu thu
create policy staff_read on public.vouchers for select to authenticated using (public.is_active_staff());
create policy staff_read on public.fee_lines for select to authenticated using (public.is_active_staff());
create policy receipt_read on public.prepaid_receipts for select to authenticated using (public.has_permission('RECEIPT_VIEW') or public.has_permission('PAYMENT_CONFIRM'));
create policy receipt_read on public.payment_transactions for select to authenticated using (public.has_permission('RECEIPT_VIEW') or public.has_permission('PAYMENT_CONFIRM'));
create policy receipt_read on public.payment_receipts for select to authenticated using (public.has_permission('RECEIPT_VIEW'));
create policy receipt_read on public.receipt_prints for select to authenticated using (public.has_permission('RECEIPT_VIEW'));
create policy receipt_read on public.prepaid_deductions for select to authenticated using (public.has_permission('RECEIPT_VIEW') or public.has_permission('PAYMENT_CONFIRM'));
create policy receipt_read on public.invoice_groups for select to authenticated using (public.has_permission('RECEIPT_VIEW'));
create policy receipt_read on public.invoice_group_items for select to authenticated using (public.has_permission('RECEIPT_VIEW'));
revoke insert, update, delete, truncate on public.vouchers, public.fee_lines, public.prepaid_receipts, public.payment_transactions,
  public.payment_receipts, public.receipt_prints, public.prepaid_deductions, public.invoice_groups, public.invoice_group_items from anon, authenticated;
revoke all on public.vouchers, public.fee_lines, public.prepaid_receipts, public.payment_transactions,
  public.payment_receipts, public.receipt_prints, public.prepaid_deductions, public.invoice_groups, public.invoice_group_items from anon;
