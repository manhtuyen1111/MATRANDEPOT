-- ============================================================================
-- MATRAN DEPOT — Migration 4/5 (phần 1): BẢNG CẤP VỎ (booking, lệnh cấp) + NHẬP / XUẤT TÀU
-- Thiết kế: docs/DATABASE_SCHEMA.md mục 3.6, 3.8. Hợp đồng: types ReleaseBooking, GateOutOrder, VesselList, VesselListItem.
-- Danh sách cont đã cấp / đã ra của booking không lưu mảng — tính từ gate_out_orders.
-- ============================================================================

create table public.release_bookings (
  id uuid primary key default gen_random_uuid(),
  booking_no text not null unique check (booking_no = upper(booking_no) and length(booking_no) > 0),
  release_type public.gate_out_type not null default 'EMPTY_RELEASE',
  shipping_line_code text not null default '',
  requester_name text not null,
  receiver_name text not null,
  size text not null references public.container_sizes (code),
  type text not null references public.container_types (code),
  requested_qty int check (requested_qty > 0),
  status public.booking_status not null default 'OPEN',
  created_at timestamptz not null default now()
);

create table public.gate_out_orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                           -- CV-YYMMDD-NNN
  gate_out_type public.gate_out_type not null default 'EMPTY_RELEASE',
  booking_id uuid not null references public.release_bookings (id),
  booking_no text not null,
  container_id uuid not null references public.containers (id),
  dossier_code text not null,                          -- mã hồ sơ Hạ vỏ của lượt lưu bãi
  container_no text not null,
  truck_no text not null,
  driver_phone text,
  receiver_name text not null,
  fee_amount bigint not null default 0,
  voucher_id uuid references public.vouchers (id),
  k80_qr_code text,
  chk_valid_order boolean not null default true,
  chk_not_on_hold boolean not null default true,
  chk_correct_container boolean not null default true,
  chk_payment_settled boolean not null default false,
  chk_documents_completed boolean not null default true,
  status public.gate_out_status not null default 'PAYMENT_PENDING',
  created_by uuid references public.staff (id),
  created_by_name text not null,
  created_at timestamptz not null default now(),
  confirmed_by uuid references public.staff (id),
  confirmed_by_name text,
  confirmed_at timestamptz,
  cancel_reason text,
  cancelled_by_name text,
  cancelled_at timestamptz,
  documents_returned_by uuid references public.staff (id),
  documents_returned_by_name text,
  documents_returned_at timestamptz
);
-- Mỗi lượt lưu bãi chỉ 1 lệnh cấp đang hiệu lực
create unique index gate_out_orders_one_active on public.gate_out_orders (container_id) where status in ('PAYMENT_PENDING', 'PENDING_FORKLIFT');
create index gate_out_orders_booking on public.gate_out_orders (booking_id, status);
create index gate_out_orders_confirmed on public.gate_out_orders (confirmed_at desc) where status = 'GATE_OUT_OK';
create index gate_out_orders_status on public.gate_out_orders (status, created_at desc);
create index gate_out_orders_container on public.gate_out_orders (container_no);
alter table public.containers add constraint containers_allocated_fk foreign key (allocated_gate_out_id) references public.gate_out_orders (id);

-- NHẬP / XUẤT TÀU (DEC-069) — danh sách theo tàu, mỗi cont 1 hồ sơ NT- / XT-; không thu phí, không K80
create table public.vessel_lists (
  id uuid primary key default gen_random_uuid(),
  mode public.vessel_mode not null,
  vessel_name text not null check (vessel_name = upper(vessel_name) and length(vessel_name) > 0),
  shipping_line_code text,                             -- Nhập tàu: bắt buộc, 1 hãng / danh sách
  planned_at timestamptz not null,
  truck_nos text[] not null check (array_length(truck_nos, 1) > 0),
  status public.vessel_list_status not null default 'OPEN',
  approve_note text,
  created_by uuid references public.staff (id),
  created_by_name text not null,
  created_at timestamptz not null default now(),
  approved_by uuid references public.staff (id),
  approved_by_name text,
  approved_at timestamptz,
  check (mode = 'XUAT_TAU' or shipping_line_code is not null)
);
create index vessel_lists_status on public.vessel_lists (mode, status, planned_at desc);

create table public.vessel_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references public.vessel_lists (id) on delete cascade,
  container_no text not null check (container_no ~ '^[A-Z]{4}[0-9]{7}$'),
  size text not null references public.container_sizes (code),
  type text not null references public.container_types (code),
  status public.vessel_item_status not null default 'PENDING',
  dossier_code text unique,                            -- NT- (cấp khi Giám định) / XT- (cấp khi lập danh sách)
  container_id uuid references public.containers (id),
  truck_no text,
  -- Xuất tàu: chụp lại lúc lập danh sách
  location_at_list text,
  -- Nhập tàu: kết quả Giám định
  condition_class public.condition_class,
  stuffing_class public.stuffing_class,
  cleaning_items text[],
  manufacture_year int,
  damage_remarks text[] not null default '{}',
  door_photo_path text,
  inspected_by uuid references public.staff (id),
  inspected_by_name text,
  inspected_at timestamptz,
  done_by uuid references public.staff (id),
  done_by_name text,
  done_at timestamptz,
  created_at timestamptz not null default now(),
  unique (list_id, container_no)
);
create index vessel_list_items_list on public.vessel_list_items (list_id, status);
create index vessel_list_items_container on public.vessel_list_items (container_id) where container_id is not null;
create index vessel_list_items_no on public.vessel_list_items (container_no) where status = 'PENDING';
alter table public.containers add constraint containers_vessel_item_fk foreign key (vessel_export_item_id) references public.vessel_list_items (id);

alter table public.release_bookings enable row level security;
alter table public.gate_out_orders enable row level security;
alter table public.vessel_lists enable row level security;
alter table public.vessel_list_items enable row level security;
create policy staff_read on public.release_bookings for select to authenticated using (public.is_active_staff());
create policy staff_read on public.gate_out_orders for select to authenticated using (public.is_active_staff());
create policy staff_read on public.vessel_lists for select to authenticated using (public.is_active_staff());
create policy staff_read on public.vessel_list_items for select to authenticated using (public.is_active_staff());
revoke insert, update, delete, truncate on public.release_bookings, public.gate_out_orders, public.vessel_lists, public.vessel_list_items from anon, authenticated;
revoke all on public.release_bookings, public.gate_out_orders, public.vessel_lists, public.vessel_list_items from anon;
