-- ============================================================================
-- SỬA LỖI: thêm biểu giá THU GOM RÁC / KHÁC báo "Hãng tàu không có trong Danh mục chung".
-- Nguyên nhân: không truyền hãng tàu → coalesce(null, '') = '' → nullif('', 'ALL') vẫn là '' (không null)
-- → kiểm tra hãng tàu '' thất bại. Sửa: chuỗi rỗng và 'ALL' đều = mọi hãng tàu (null).
-- Giữ nguyên chữ ký hàm (quyền gọi đã grant giữ nguyên).
-- ============================================================================
create or replace function public.catalog_add_fee(
  p_category public.fee_category, p_amount bigint, p_name text default null, p_size text default null,
  p_type text default null, p_shipping_line_code text default null
) returns public.fee_catalog
language plpgsql security definer set search_path = public as $$
declare
  v_seq text := lpad(((select count(*) from public.fee_catalog) + 1)::text, 2, '0');
  v_line text := nullif(nullif(upper(trim(coalesce(p_shipping_line_code, ''))), ''), 'ALL');
  v_size text := nullif(trim(coalesce(p_size, '')), '');
  v_type text := nullif(trim(coalesce(p_type, '')), '');
  v_name text := nullif(trim(coalesce(p_name, '')), '');
  v_code text;
  v_row public.fee_catalog;
begin
  perform public.assert_admin();
  if p_amount is null or p_amount < 0 then raise exception 'Vui lòng nhập đơn giá (đã bao gồm VAT) hợp lệ.'; end if;
  if v_line is not null and not exists (select 1 from public.partners where code = v_line and is_shipping_line) then
    raise exception 'Hãng tàu % không có trong Danh mục chung.', v_line;
  end if;
  if p_category = 'NANG_HA' then
    v_code := format('LOLO_%s_%s_%s_%s', coalesce(v_size, 'ALL'), coalesce(v_type, 'ALL'), coalesce(v_line, 'ALL'), v_seq);
    v_name := coalesce(v_name, regexp_replace(format('Nâng hạ vỏ %s %s — Hãng tàu %s (Đã gồm VAT)',
      coalesce(v_size || '''', ''), coalesce(v_type, ''), coalesce(v_line, 'Tất cả')), '\s+', ' ', 'g'));
  elsif p_category = 'THU_GOM_RAC' then
    v_code := format('RAC_%s_%s', coalesce(v_size, 'CHUNG'), v_seq);
    v_name := coalesce(v_name, format('Phí thu gom rác %s (Đã gồm VAT)', coalesce('cont ' || v_size || '''', 'tiêu chuẩn bãi')));
  else
    v_code := format('DV_%s', v_seq);
    if v_name is null then raise exception 'Vui lòng nhập tên biểu giá dịch vụ.'; end if;
  end if;
  insert into public.fee_catalog (code, name, category, size, type, shipping_line_code, amount)
  values (v_code, v_name, p_category, v_size, v_type, v_line, p_amount)
  returning * into v_row;
  perform public.write_audit('ADMIN_ADD_FEE_CATALOG', 'FEE_CATALOG', v_code,
    format('[Admin Danh mục chung] Thêm BIỂU GIÁ: %s (%sđ — Đã gồm VAT)', v_name, to_char(p_amount, 'FM999G999G999G999')));
  return v_row;
end $$;
