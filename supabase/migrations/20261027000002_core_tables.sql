-- ============================================================================
-- MATRAN DEPOT — Migration 1/5 (phần 2): BẢNG NỀN — nhân viên, danh mục, bộ đếm mã, nhật ký, chống bấm lặp
-- Thiết kế: docs/DATABASE_SCHEMA.md mục 3.1 → 3.3, 3.9; DEC-151.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 3.1 NHÂN VIÊN — id = auth.users.id; đăng nhập username → username@matrandepot.local (DEC-151)
-- ---------------------------------------------------------------------------
create table public.staff (
  id uuid primary key references auth.users (id) on delete restrict,
  staff_code text not null unique,
  username text not null unique check (username ~ '^[a-z0-9._-]{3,30}$'),
  full_name text not null check (length(trim(full_name)) > 0),
  email text,
  is_active boolean not null default true,
  must_change_password boolean not null default true, -- DEC-143: lần đầu / sau khi đặt lại phải đổi
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.staff_roles (
  staff_id uuid not null references public.staff (id) on delete cascade,
  role public.app_role not null,
  primary key (staff_id, role)
);

-- ---------------------------------------------------------------------------
-- 3.2 DANH MỤC — Admin cấu hình; đã dùng thì tắt (is_active = false), không xóa cứng
-- ---------------------------------------------------------------------------
create table public.company_profile (
  id boolean primary key default true check (id), -- đúng 1 dòng
  name text not null,
  short_name text not null,
  address text not null default '',
  phone text not null default '',
  email text not null default '',
  tax_code text not null default '',
  bank_account text not null default '',
  updated_at timestamptz not null default now()
);

create table public.partners (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code = upper(code) and length(code) > 0),
  name text not null check (length(trim(name)) > 0),
  is_shipping_line boolean not null default false,
  is_customer boolean not null default false,
  allow_tts boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (is_shipping_line or is_customer)
);
create index partners_name_trgm on public.partners using gin (name gin_trgm_ops);

create table public.container_sizes (
  code text primary key,
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table public.container_types (
  code text primary key,
  sort_order int not null default 0,
  is_active boolean not null default true
);

create table public.yard_blocks (
  code text primary key check (code ~ '^BLOCK-[A-Z0-9_-]+$'),
  name text not null,
  max_bay int not null default 0 check (max_bay >= 0), -- 0 = không dùng (DEC-082)
  max_row int not null default 0 check (max_row >= 0),
  max_tier int not null default 0 check (max_tier >= 0),
  capacity int not null default 0 check (capacity >= 0),
  is_inspection_rack boolean not null default false, -- DEC-109
  description text not null default '',
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create table public.fee_catalog (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category public.fee_category not null,
  size text references public.container_sizes (code),
  type text references public.container_types (code),
  shipping_line_code text, -- null = mọi hãng tàu
  amount bigint not null check (amount >= 0), -- đồng, đã gồm VAT
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.repair_teams (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  is_active boolean not null default true
);

create table public.repair_team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.repair_teams (id) on delete cascade,
  full_name text not null,
  staff_id uuid references public.staff (id),
  is_active boolean not null default true
);

-- ---------------------------------------------------------------------------
-- 3.3 BỘ ĐẾM MÃ — cấp trong cùng giao dịch với tác nghiệp (next_code)
-- ---------------------------------------------------------------------------
create table public.code_counters (
  prefix text not null,       -- HV / CV / NT / XT / PT-TT / PT-TTR / GY
  period text not null,       -- YYMMDD theo giờ Việt Nam
  last_no int not null default 0,
  primary key (prefix, period)
);

-- ---------------------------------------------------------------------------
-- CHỐNG BẤM LẶP (DEC-151): mỗi lần bấm gửi request_id; gửi lại cùng request_id → trả kết quả cũ
-- ---------------------------------------------------------------------------
create table public.request_log (
  request_id uuid primary key,
  staff_id uuid not null references public.staff (id),
  rpc_name text not null,
  result jsonb not null,
  created_at timestamptz not null default now()
);
create index request_log_created_at on public.request_log (created_at);

-- ---------------------------------------------------------------------------
-- 3.9 NHẬT KÝ — partition theo tháng (DEC-151); tạo partition bằng ensure_audit_partition()
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid,
  actor_name text not null,
  actor_role text not null,
  action_code text not null,
  entity_type text not null,
  entity_code text not null,
  dossier_code text,
  summary text not null,
  primary key (id, created_at)
) partition by range (created_at);
create index audit_logs_entity on public.audit_logs (entity_code, created_at desc);
create index audit_logs_dossier on public.audit_logs (dossier_code, created_at desc) where dossier_code is not null;
create table public.audit_logs_default partition of public.audit_logs default;

-- updated_at tự cập nhật
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger staff_touch before update on public.staff for each row execute function public.touch_updated_at();
create trigger partners_touch before update on public.partners for each row execute function public.touch_updated_at();
create trigger fee_catalog_touch before update on public.fee_catalog for each row execute function public.touch_updated_at();
create trigger yard_blocks_touch before update on public.yard_blocks for each row execute function public.touch_updated_at();
create trigger company_touch before update on public.company_profile for each row execute function public.touch_updated_at();
