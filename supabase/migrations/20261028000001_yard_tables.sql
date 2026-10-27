-- ============================================================================
-- MATRAN DEPOT — Migration 2/5 (phần 1): BẢNG HẠ VỎ, LƯỢT LƯU BÃI, K80, VỊ TRÍ, VỆ SINH / BÁO GIÁ / SỬA CHỮA
-- Thiết kế: docs/DATABASE_SCHEMA.md mục 3.4, 3.5. Hợp đồng: src/types/depot.ts (GateInOrder, ContainerRecord,
-- K80InternalTicket, LocationHistoryItem, ServiceWorkOrder).
-- Cột voucher_id chưa có khóa ngoại — migration 3 (thanh toán) thêm.
-- ============================================================================

-- Hạng mục vệ sinh hợp lệ (CLEANING_ITEM_OPTIONS)
create or replace function public.valid_cleaning_items(items text[]) returns boolean
language sql immutable as $$
  select coalesce(array_length(items, 1), 0) > 0
     and items <@ array['KHÔNG VỆ SINH', 'WP - QUÉT', 'WW - RỬA NƯỚC', 'CC - HÓA CHẤT', 'RM - NHỔ ĐINH', 'ML - BÓC TEM']
     and not ('KHÔNG VỆ SINH' = any (items) and array_length(items, 1) > 1);
$$;

-- ---------------------------------------------------------------------------
-- HỒ SƠ HẠ VỎ (HV- / NT-)
-- ---------------------------------------------------------------------------
create table public.gate_in_orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                          -- HV-YYMMDD-NNN
  gate_in_type public.gate_in_type not null default 'CUSTOMER_RETURN',
  status public.gate_in_status not null default 'FIELD_RECORDED',
  -- Giám định
  door_photo_path text,                               -- Storage door-photos/yyyy/mm/<code>.jpg; null khi hết hạn lưu
  photo_expires_at date,                              -- DEC-159: 2 tháng
  initial_container_hint text,
  condition_class public.condition_class not null,
  damage_remarks text[] not null default '{}',
  stuffing_class public.stuffing_class,
  cleaning_items text[] not null check (public.valid_cleaning_items(cleaning_items)),
  manufacture_year int check (manufacture_year between 1980 and 2100),
  to_inspection_rack boolean not null default false,  -- DEC-147: = W-SURVEY
  rack_inspected_by uuid references public.staff (id),
  rack_inspected_by_name text,
  rack_inspected_at timestamptz,
  field_by uuid not null references public.staff (id),
  field_by_name text not null,
  field_at timestamptz not null default now(),
  -- Văn phòng
  container_no text check (container_no ~ '^[A-Z]{4}[0-9]{7}$'),
  size text references public.container_sizes (code),
  type text references public.container_types (code),
  truck_no text,
  driver_phone text,
  customer_name text,
  shipping_line_code text,
  order_doc_no text,
  office_by uuid references public.staff (id),
  office_by_name text,
  office_at timestamptz,
  fee_amount bigint not null default 0 check (fee_amount >= 0),
  voucher_id uuid,
  -- Hoàn tất
  gate_in_ok_by uuid references public.staff (id),
  gate_in_ok_by_name text,
  gate_in_ok_at timestamptz,
  next_departments text[] not null default '{}',
  documents_returned_by uuid references public.staff (id),
  documents_returned_by_name text,
  documents_returned_at timestamptz,
  cancel_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- DEC-147: W-SURVEY được trống Đóng hàng / AGE; AV / DAMAGE bắt buộc
  check (condition_class = 'W-SURVEY' or (stuffing_class is not null and manufacture_year is not null)),
  check (condition_class <> 'W-SURVEY' or to_inspection_rack),
  check (condition_class = 'DAMAGE' or damage_remarks = '{}')
);
create index gate_in_orders_status on public.gate_in_orders (status, field_at desc);
create index gate_in_orders_ok_at on public.gate_in_orders (gate_in_ok_at desc) where gate_in_ok_at is not null;
create index gate_in_orders_container on public.gate_in_orders (container_no);
-- Một container chỉ 1 hồ sơ Hạ vỏ đang làm dở (GIN-006)
create unique index gate_in_orders_one_open on public.gate_in_orders (container_no)
  where container_no is not null and status in ('FIELD_RECORDED', 'PAYMENT_PENDING');
create trigger gate_in_orders_touch before update on public.gate_in_orders for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- LƯỢT LƯU BÃI — mỗi lần hạ vỏ 1 dòng; lượt đã OUT giữ làm lịch sử
-- ---------------------------------------------------------------------------
create table public.containers (
  id uuid primary key default gen_random_uuid(),
  dossier_code text not null unique,                  -- mã hồ sơ HV- / NT- của lượt
  gate_in_id uuid references public.gate_in_orders (id),
  container_no text not null check (container_no ~ '^[A-Z]{4}[0-9]{7}$'),
  size text not null references public.container_sizes (code),
  type text not null references public.container_types (code),
  manufacture_year int check (manufacture_year between 1980 and 2100),
  shipping_line_code text not null default '',
  customer_name text not null default '',
  truck_no text,
  driver_phone text,
  status public.container_status not null default 'WAITING_PLACEMENT',
  condition_class public.condition_class not null,
  damage_remarks text[] not null default '{}',
  stuffing_class public.stuffing_class,
  cleaning_items text[] not null check (public.valid_cleaning_items(cleaning_items)),
  active_qr_code text not null,
  is_paid boolean not null default false,
  current_block text references public.yard_blocks (code),
  current_bay text,
  current_row text,
  current_tier text,
  needs_cleaning boolean not null default false,
  needs_quotation boolean not null default false,
  needs_repair boolean not null default false,
  forklift_task public.forklift_task not null default 'NONE',
  is_on_hold boolean not null default false,
  hold_source text check (hold_source in ('VESSEL_EXPORT')),
  hold_reason text,
  hold_by_name text,
  hold_at timestamptz,
  office_note text,
  office_note_by_name text,
  office_note_at timestamptz,
  quotation_items text[] not null default '{}',
  quotation_labor_hours numeric(6, 2) check (quotation_labor_hours > 0 and quotation_labor_hours <= 1000),
  quotation_by_name text,
  quotation_at timestamptz,
  out_dossier_code text,                              -- CV- / XT- khi đã lập lệnh cấp
  allocated_gate_out_id uuid,
  vessel_export_item_id uuid,
  gate_in_at timestamptz not null default now(),
  gate_out_at timestamptz,
  version int not null default 1,
  updated_at timestamptz not null default now(),
  check (condition_class = 'W-SURVEY' or (stuffing_class is not null and manufacture_year is not null)),
  check (status = 'WAITING_PLACEMENT' or status = 'GATED_OUT' or current_block is not null)
);
-- Một container chỉ 1 lượt đang trong bãi
create unique index containers_one_active on public.containers (container_no) where status <> 'GATED_OUT';
-- Một ô bãi đủ Block + Bay + Row + Tier chỉ 1 container (DEC-087)
create unique index containers_one_per_slot on public.containers (current_block, current_bay, current_row, current_tier)
  where status <> 'GATED_OUT' and current_bay is not null and current_row is not null and current_tier is not null;
create index containers_stock on public.containers (gate_in_at desc) where status <> 'GATED_OUT';
create index containers_line on public.containers (shipping_line_code) where status <> 'GATED_OUT';
create index containers_block on public.containers (current_block) where status <> 'GATED_OUT';
create index containers_no_trgm on public.containers using gin (container_no gin_trgm_ops);
create index containers_qr on public.containers (active_qr_code) where status <> 'GATED_OUT';
-- Hàng chờ hiện trường
create index containers_wait_place on public.containers (gate_in_at) where status = 'WAITING_PLACEMENT';
create index containers_wait_clean on public.containers (gate_in_at) where needs_cleaning and status <> 'GATED_OUT';
create index containers_wait_quote on public.containers (gate_in_at) where needs_quotation and status <> 'GATED_OUT';
create index containers_wait_repair on public.containers (gate_in_at) where needs_repair and status <> 'GATED_OUT';
create index containers_wait_survey on public.containers (gate_in_at) where condition_class = 'W-SURVEY' and status <> 'GATED_OUT';

-- Tăng version + updated_at mỗi lần sửa (chống ghi đè khi 2 người cùng thao tác)
create or replace function public.bump_version() returns trigger
language plpgsql as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end $$;
create trigger containers_bump before update on public.containers for each row execute function public.bump_version();

-- ---------------------------------------------------------------------------
-- PHIẾU K80 (DEC-052, DEC-057: QR = QR-<mã hồ sơ>)
-- ---------------------------------------------------------------------------
create table public.k80_tickets (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                          -- K80-<mã hồ sơ>
  dossier_code text not null,
  out_dossier_code text,
  qr_code text not null unique,
  operation_mode text not null check (operation_mode in ('HA_VO', 'CAP_VO')),
  is_paid boolean not null,
  payment_label text not null,
  container_no text not null,
  size text not null,
  type text not null,
  condition_class public.condition_class not null,
  damage_remarks text[] not null default '{}',
  stuffing_class public.stuffing_class,
  cleaning_items text[] not null default '{}',
  manufacture_year int,
  truck_no text,
  driver_phone text,
  customer_name text,
  target_block text,
  issued_by uuid references public.staff (id),
  issued_by_name text not null,
  issued_at timestamptz not null default now()
);
create index k80_tickets_dossier on public.k80_tickets (dossier_code);

-- ---------------------------------------------------------------------------
-- LỊCH SỬ VỊ TRÍ (tác nghiệp Xe nâng — CR-02) — partition theo tháng (DEC-151)
-- ---------------------------------------------------------------------------
create table public.location_history (
  id uuid not null default gen_random_uuid(),
  performed_at timestamptz not null default now(),
  container_id uuid not null,
  dossier_code text not null,
  container_no text not null,
  from_location text not null,
  to_location text not null,
  action public.location_action not null,
  reason text not null,
  performed_by uuid,
  performed_by_name text not null,
  primary key (id, performed_at)
) partition by range (performed_at);
create index location_history_container on public.location_history (container_id, performed_at desc);
create index location_history_no on public.location_history (container_no, performed_at desc);
create table public.location_history_default partition of public.location_history default;

create or replace function public.ensure_location_partition(month_start date) returns void
language plpgsql security definer set search_path = public as $$
declare
  m date := date_trunc('month', month_start)::date;
  name text := 'location_history_' || to_char(m, 'YYYY_MM');
begin
  if to_regclass('public.' || name) is null then
    execute format('create table public.%I partition of public.location_history for values from (%L) to (%L)',
                   name, m, (m + interval '1 month')::date);
  end if;
end $$;
select public.ensure_location_partition(current_date);
select public.ensure_location_partition((current_date + interval '1 month')::date);
select public.ensure_location_partition((current_date + interval '2 month')::date);

-- ---------------------------------------------------------------------------
-- VỆ SINH / BÁO GIÁ / SỬA CHỮA
-- ---------------------------------------------------------------------------
create table public.work_orders (
  id uuid primary key default gen_random_uuid(),
  code text not null,                                 -- CLN- / INSP- / MNR- + mã hồ sơ
  container_id uuid not null references public.containers (id),
  dossier_code text not null,
  container_no text not null,
  category public.work_category not null,
  items text[] not null default '{}',
  approval_status public.approval_status not null default 'NOT_REQUIRED',
  approved_by_name text,
  work_status public.work_status not null default 'OPEN',
  assigned_to text not null,
  labor_hours numeric(6, 2),
  repair_team_id uuid references public.repair_teams (id),
  repair_team_code text,
  repair_team_name text,
  result_notes text,
  completed_by uuid references public.staff (id),
  completed_by_name text,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
-- Mỗi lượt lưu bãi chỉ 1 việc đang mở mỗi loại
create unique index work_orders_one_open on public.work_orders (container_id, category) where work_status = 'OPEN';
create index work_orders_completed on public.work_orders (category, completed_at desc) where work_status = 'COMPLETED';

create table public.work_order_members (
  work_order_id uuid not null references public.work_orders (id) on delete cascade,
  member_id uuid not null references public.repair_team_members (id),
  member_name text not null,
  primary key (work_order_id, member_id)
);

-- RLS: đọc = nhân viên đang hoạt động; ghi chỉ qua RPC
alter table public.gate_in_orders enable row level security;
alter table public.containers enable row level security;
alter table public.k80_tickets enable row level security;
alter table public.location_history enable row level security;
alter table public.work_orders enable row level security;
alter table public.work_order_members enable row level security;
create policy staff_read on public.gate_in_orders for select to authenticated using (public.is_active_staff());
create policy staff_read on public.containers for select to authenticated using (public.is_active_staff());
create policy staff_read on public.k80_tickets for select to authenticated using (public.is_active_staff());
create policy staff_read on public.location_history for select to authenticated using (public.is_active_staff());
create policy staff_read on public.work_orders for select to authenticated using (public.is_active_staff());
create policy staff_read on public.work_order_members for select to authenticated using (public.is_active_staff());
revoke insert, update, delete, truncate on public.gate_in_orders, public.containers, public.k80_tickets,
  public.location_history, public.work_orders, public.work_order_members from anon, authenticated;
revoke all on public.gate_in_orders, public.containers, public.k80_tickets,
  public.location_history, public.work_orders, public.work_order_members from anon;
revoke execute on function public.ensure_location_partition(date) from public, anon, authenticated;
