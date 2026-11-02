-- ============================================================================
-- MATRAN DEPOT — DEC-206 (người dùng 2026-11-02): Danh mục chung → Sửa chữa → tab CODE CEDEX theo hãng tàu.
--   cedex_codes: MÃ VỊ TRÍ / MÃ HƯ HỎNG / MÃ VẬT LIỆU (mã, tên, ghi chú, trạng thái)
--   repair_codes: MÃ SỬA CHỮA theo mẫu bảng giá hãng (Item Name, Repair Mode, Repair Name, Max Qty, Fixed man hour,
--                 Repair Code, Material Rate excl. VAT)
--   RPC upsert theo lô (1 dòng / nhập Excel nhiều dòng) — chỉ Admin; mọi nhân viên đang làm được đọc (app chỉ tải cho khối Văn phòng).
-- Hợp đồng: src/services/cedexCatalog.ts (upsertCedexCodes / upsertRepairCodes — cùng quy tắc kiểm tra).
-- ============================================================================

create table public.cedex_codes (
  id uuid primary key default gen_random_uuid(),
  shipping_line_code text not null references public.partners (code) on update cascade,
  kind text not null check (kind in ('LOCATION', 'DAMAGE', 'MATERIAL')),
  code text not null check (code ~ '^[A-Z0-9]{1,10}$'),
  name text not null check (length(trim(name)) between 1 and 255),
  note text check (note is null or length(note) <= 255),
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (shipping_line_code, kind, code)
);

create table public.repair_codes (
  id uuid primary key default gen_random_uuid(),
  shipping_line_code text not null references public.partners (code) on update cascade,
  item_name text not null check (item_name ~ '^[A-Z0-9-]{1,20}$'),
  repair_mode text not null check (repair_mode ~ '^([A-Z0-9]{1,10}|-)$'),
  repair_name text not null check (length(trim(repair_name)) between 1 and 255),
  max_qty int check (max_qty is null or max_qty >= 1),
  man_hour numeric(10, 2) not null check (man_hour >= 0),
  repair_code text not null check (repair_code ~ '^([A-Z0-9]{1,10}|-)$'),
  material_rate numeric(14, 2) not null check (material_rate >= 0),
  is_active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (shipping_line_code, item_name)
);

alter table public.cedex_codes enable row level security;
alter table public.repair_codes enable row level security;
create policy catalog_read on public.cedex_codes for select to authenticated using ((select public.is_active_staff()));
create policy catalog_read on public.repair_codes for select to authenticated using ((select public.is_active_staff()));
revoke insert, update, delete, truncate on public.cedex_codes, public.repair_codes from anon, authenticated;
revoke all on public.cedex_codes, public.repair_codes from anon;

create or replace function public.catalog_upsert_cedex_codes(p_shipping_line_code text, p_kind text, p_rows jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_line text := upper(trim(coalesce(p_shipping_line_code, '')));
  r jsonb;
  v_code text;
  v_name text;
  v_note text;
  n int := 0;
begin
  perform public.assert_admin();
  if not exists (select 1 from public.partners where is_shipping_line and is_active and code = v_line) then
    raise exception 'Vui lòng chọn HÃNG TÀU theo Danh mục chung.';
  end if;
  if coalesce(p_kind, '') not in ('LOCATION', 'DAMAGE', 'MATERIAL') then raise exception 'Loại mã không hợp lệ.'; end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then raise exception 'Không có dòng nào để lưu.'; end if;
  if (select count(distinct upper(trim(x->>'code'))) from jsonb_array_elements(p_rows) x) <> jsonb_array_length(p_rows) then
    raise exception 'Mã bị trùng trong danh sách lưu.';
  end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    n := n + 1;
    v_code := upper(trim(coalesce(r->>'code', '')));
    v_name := trim(coalesce(r->>'name', ''));
    v_note := nullif(trim(coalesce(r->>'note', '')), '');
    if v_code !~ '^[A-Z0-9]{1,10}$' then raise exception 'Dòng % (%): Mã gồm 1–10 chữ / số (không dấu cách).', n, coalesce(v_code, '-'); end if;
    if v_name = '' then raise exception 'Dòng % (%): Thiếu tên.', n, v_code; end if;
    if length(v_name) > 255 or length(coalesce(v_note, '')) > 255 then raise exception 'Dòng % (%): Tên / ghi chú tối đa 255 ký tự.', n, v_code; end if;
    insert into public.cedex_codes (shipping_line_code, kind, code, name, note, is_active)
    values (v_line, p_kind, v_code, v_name, v_note, coalesce((r->>'isActive')::boolean, true))
    on conflict (shipping_line_code, kind, code) do update
      set name = excluded.name, note = excluded.note, is_active = excluded.is_active, updated_at = now();
  end loop;
  perform public.write_audit('ADMIN_UPSERT_CEDEX', 'CATALOG', v_line || '-' || p_kind,
    format('[Admin Danh mục chung] CODE CEDEX %s hãng %s: lưu %s mã', p_kind, v_line, n));
  return n;
end $$;

create or replace function public.catalog_upsert_repair_codes(p_shipping_line_code text, p_rows jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare
  v_line text := upper(trim(coalesce(p_shipping_line_code, '')));
  r jsonb;
  v_item text;
  v_mode text;
  v_code text;
  v_name text;
  v_qty int;
  v_hour numeric;
  v_rate numeric;
  n int := 0;
begin
  perform public.assert_admin();
  if not exists (select 1 from public.partners where is_shipping_line and is_active and code = v_line) then
    raise exception 'Vui lòng chọn HÃNG TÀU theo Danh mục chung.';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) = 0 then raise exception 'Không có dòng nào để lưu.'; end if;
  if (select count(distinct upper(trim(x->>'itemName'))) from jsonb_array_elements(p_rows) x) <> jsonb_array_length(p_rows) then
    raise exception 'Item Name bị trùng trong danh sách lưu.';
  end if;
  for r in select * from jsonb_array_elements(p_rows) loop
    n := n + 1;
    v_item := upper(trim(coalesce(r->>'itemName', '')));
    v_mode := upper(trim(coalesce(r->>'repairMode', '')));
    v_code := upper(trim(coalesce(r->>'repairCode', '')));
    v_name := trim(coalesce(r->>'repairName', ''));
    v_qty := (r->>'maxQty')::int;
    v_hour := (r->>'manHour')::numeric;
    v_rate := (r->>'materialRate')::numeric;
    if v_item !~ '^[A-Z0-9-]{1,20}$' then raise exception 'Dòng % (%): Item Name gồm 1–20 chữ / số / gạch (VD DR001).', n, coalesce(v_item, '-'); end if;
    if v_mode !~ '^([A-Z0-9]{1,10}|-)$' then raise exception 'Dòng % (%): Repair Mode là mã 1–10 chữ / số hoặc "-".', n, v_item; end if;
    if v_name = '' or length(v_name) > 255 then raise exception 'Dòng % (%): Repair Name bắt buộc, tối đa 255 ký tự.', n, v_item; end if;
    if v_qty is not null and v_qty < 1 then raise exception 'Dòng % (%): Max Qty là số nguyên ≥ 1.', n, v_item; end if;
    if v_hour is null or v_hour < 0 or v_hour <> round(v_hour, 2) then raise exception 'Dòng % (%): Fixed man hour là số ≥ 0, tối đa 2 số lẻ.', n, v_item; end if;
    if v_code !~ '^([A-Z0-9]{1,10}|-)$' then raise exception 'Dòng % (%): Repair Code là mã 1–10 chữ / số hoặc "-".', n, v_item; end if;
    if v_rate is null or v_rate < 0 or v_rate <> round(v_rate, 2) then raise exception 'Dòng % (%): Material Rate là số ≥ 0, tối đa 2 số lẻ.', n, v_item; end if;
    insert into public.repair_codes (shipping_line_code, item_name, repair_mode, repair_name, max_qty, man_hour, repair_code, material_rate, is_active)
    values (v_line, v_item, v_mode, v_name, v_qty, v_hour, v_code, v_rate, coalesce((r->>'isActive')::boolean, true))
    on conflict (shipping_line_code, item_name) do update
      set repair_mode = excluded.repair_mode, repair_name = excluded.repair_name, max_qty = excluded.max_qty, man_hour = excluded.man_hour,
          repair_code = excluded.repair_code, material_rate = excluded.material_rate, is_active = excluded.is_active, updated_at = now();
  end loop;
  perform public.write_audit('ADMIN_UPSERT_REPAIR_CODE', 'CATALOG', v_line || '-REPAIR',
    format('[Admin Danh mục chung] MÃ SỬA CHỮA hãng %s: lưu %s mã', v_line, n));
  return n;
end $$;

revoke execute on function public.catalog_upsert_cedex_codes(text, text, jsonb), public.catalog_upsert_repair_codes(text, jsonb) from public, anon, authenticated;
grant execute on function public.catalog_upsert_cedex_codes(text, text, jsonb) to authenticated;
grant execute on function public.catalog_upsert_repair_codes(text, jsonb) to authenticated;
