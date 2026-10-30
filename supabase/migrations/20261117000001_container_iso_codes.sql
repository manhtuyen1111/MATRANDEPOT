-- ============================================================================
-- DEC-195 — MÃ ISO 6346 theo Size + Type (Danh mục Container). Màn hình / phiếu / biểu giá vẫn dùng 20DC, 40HC…
--   * container_iso_codes: 1 mã cho mỗi tổ hợp size + type (Admin sửa qua catalog_set_iso_code; mã trống = bỏ).
--   * containers.iso_code: mã riêng của từng cont (VD lấy từ Maersk eEIR) — trống = theo Danh mục.
-- Hợp đồng nghiệp vụ: depotOperations.ts — setContainerIsoCode / containerIsoCode.
-- ============================================================================

create table if not exists public.container_iso_codes (
  size text not null references public.container_sizes (code),
  type text not null references public.container_types (code),
  iso_code text not null check (iso_code ~ '^[0-9A-Z]{4}$'),
  updated_at timestamptz not null default now(),
  primary key (size, type)
);
alter table public.container_iso_codes enable row level security;
create policy catalog_read on public.container_iso_codes for select to authenticated using ((select public.is_active_staff()));
revoke insert, update, delete, truncate on public.container_iso_codes from anon, authenticated;

-- Mã thường dùng (chỉ cho size / type đã có trong Danh mục)
insert into public.container_iso_codes (size, type, iso_code)
select v.size, v.type, v.iso
from (values ('20', 'DC', '22G1'), ('40', 'DC', '42G1'), ('40', 'HC', '45G1'), ('45', 'HC', 'L5G1'), ('20', 'RF', '22R1'),
             ('40', 'RF', '45R1'), ('20', 'OT', '22U1'), ('40', 'OT', '42U1'), ('20', 'FR', '22P1'), ('40', 'FR', '42P1')) v(size, type, iso)
where exists (select 1 from public.container_sizes s where s.code = v.size)
  and exists (select 1 from public.container_types t where t.code = v.type)
on conflict do nothing;

alter table public.containers add column if not exists iso_code text check (iso_code is null or iso_code ~ '^[0-9A-Z]{4}$');

create or replace function public.catalog_set_iso_code(p_size text, p_type text, p_iso_code text) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_size text := upper(trim(coalesce(p_size, '')));
  v_type text := upper(trim(coalesce(p_type, '')));
  v_iso text := upper(trim(coalesce(p_iso_code, '')));
begin
  perform public.assert_admin();
  if not exists (select 1 from public.container_sizes where code = v_size and is_active)
     or not exists (select 1 from public.container_types where code = v_type and is_active) then
    raise exception 'Vui lòng chọn SIZE và TYPE có trong Danh mục Container.';
  end if;
  if v_iso <> '' and v_iso !~ '^[0-9A-Z]{4}$' then raise exception 'Mã ISO 6346 gồm đúng 4 ký tự chữ / số (VD: 22G1, 45G1, L5G1).'; end if;
  if v_iso = '' then
    delete from public.container_iso_codes where size = v_size and type = v_type;
  else
    insert into public.container_iso_codes (size, type, iso_code) values (v_size, v_type, v_iso)
    on conflict (size, type) do update set iso_code = excluded.iso_code, updated_at = now();
  end if;
  perform public.write_audit('ADMIN_SET_ISO_CODE', 'CATALOG', v_size || v_type,
    format('[Admin Danh mục chung] Mã ISO 6346 %s%s: %s', v_size, v_type, coalesce(nullif(v_iso, ''), '(bỏ)')));
end $$;

revoke execute on function public.catalog_set_iso_code(text, text, text) from public, anon, authenticated;
grant execute on function public.catalog_set_iso_code(text, text, text) to authenticated;
