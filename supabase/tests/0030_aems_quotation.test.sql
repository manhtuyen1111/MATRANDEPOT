-- pgTAP — DEC-207: Báo giá AEMS (database tính lại từ dòng + Danh mục; chỉ Approved mới chuyển Sửa chữa).
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'bg@matrandepot.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'vp@matrandepot.local');
insert into public.staff (id, staff_code, username, full_name) values
  ('00000000-0000-0000-0000-0000000000b1', 'B1', 'bg.t', 'Báo giá T'),
  ('00000000-0000-0000-0000-0000000000b2', 'B2', 'vp.t', 'Văn phòng T');
insert into public.staff_roles values ('00000000-0000-0000-0000-0000000000b1', 'QUOTATION'), ('00000000-0000-0000-0000-0000000000b2', 'OFFICE');
insert into public.partners (code, name, is_shipping_line) values ('MSK', 'MSK', true);
insert into public.container_sizes (code) values ('40') on conflict do nothing;
insert into public.container_types (code) values ('HC') on conflict do nothing;
insert into public.yard_blocks (code, name) values ('BLOCK-DAMAGE', 'Kệ') on conflict do nothing;
insert into public.repair_codes (shipping_line_code, item_name, repair_mode, repair_name, max_qty, man_hour, repair_code, material_rate) values
  ('MSK', 'DR001', '-', 'Man hour rate for dry repair', null, 1, '-', 28000),
  ('MSK', 'DR002', '03', 'PREPARATION - FOR TOTAL REPAIR TIME LESS THAN OR EQUAL TO 2 HRS.', 1, 0.1, '0003', 0),
  ('MSK', 'DR003', '03', 'PREPARATION - FOR TOTAL REPAIR TIME BETWEEN 2 & 8 HRS.', 1, 0.2, '0005', 0),
  ('MSK', 'DR006', '03', 'Preparation - For total repair time exceeding 40 hrs.', 1, 0.8, '0014', 0),
  ('MSK', 'DR008', '03', 'General - Replace missing rivets or huckbolts', 7, 0.1, '0804', 9215.85);
insert into public.cedex_codes (shipping_line_code, kind, code, name) values ('MSK', 'DAMAGE', 'CU', 'Cut');
insert into public.containers (dossier_code, container_no, size, type, shipping_line_code, status, current_block, condition_class, damage_remarks,
  stuffing_class, manufacture_year, cleaning_items, active_qr_code, needs_quotation)
values ('HV-AEMS', 'MSKU0000123', '40', 'HC', 'MSK', 'IN_YARD', 'BLOCK-DAMAGE', 'DAMAGE', array['LB34 Móp'], 'E', 2019, array['KHÔNG VỆ SINH'], 'QR-HV-AEMS', true);

create or replace function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');

select is(array[public.aems_preparation('MSK', 0.8), public.aems_preparation('MSK', 2), public.aems_preparation('MSK', 2.5), public.aems_preparation('MSK', 41)],
  array[0.1, 0.1, 0.2, 0.8]::numeric[], 'Preparation theo khoảng giờ trong tên mã');
select throws_like($$ select public.save_aems_quotation('MSKU0000123', '03', null, '[{"damageCode":"ZZ","repairCode":"0804","locCode":"LB34","tpi":"T","pcs":1}]') $$,
  '%Damage Code ZZ%', 'Mã hư không có trong danh mục → chặn');
select throws_like($$ select public.save_aems_quotation('MSKU0000123', '03', null, '[{"damageCode":"CU","repairCode":"0804","locCode":"LB34","tpi":"T","pcs":8}]') $$,
  '%tối đa 7%', 'Vượt Max Qty → chặn');
select throws_like($$ select public.save_aems_quotation('MSKU0000123', '03', null, '[{"damageCode":"CU","repairCode":"0003","locCode":"LB34","tpi":"T","pcs":1}]') $$,
  '%Repair Code 0003%', 'Mã PREPARATION không chọn tay');
select lives_ok($$ select public.save_aems_quotation('MSKU0000123', '03', 'Móp vách', '[{"damageCode":"cu","repairCode":"0804","locCode":"lb34","tpi":"T","pcs":2,"manHours":null,"materialCost":null}]') $$,
  'Lưu phiếu AEMS');
select is((select array[(aems_quote->>'repairHours')::numeric, (aems_quote->>'preparationHours')::numeric, (aems_quote->>'totalHours')::numeric,
  (aems_quote->>'laborCost')::numeric, (aems_quote->>'materialCost')::numeric, (aems_quote->>'totalExclVat')::numeric] from public.containers where container_no = 'MSKU0000123'),
  array[0.2, 0.1, 0.3, 8400, 18431.7, 26831.7]::numeric[], 'Database tính: 0.2 + 0.1 = 0.3 giờ × 28,000 + 2 × 9,215.85');
select is((select quotation_labor_hours || '/' || (aems_quote->>'approval') || '/' || quotation_items[1] from public.containers where container_no = 'MSKU0000123'),
  '0.30/DRAFT/LB34 CU 0804 ×2 (T)', 'Giờ công + Draft + tình trạng sửa chữa');
select throws_like($$ select public.confirm_quotation_to_repair('MSKU0000123') $$, '%chưa duyệt%', 'Chưa Approved → chưa chuyển Sửa chữa');
select lives_ok($$ select public.set_aems_approval('MSKU0000123', 'APPROVED', '513325391') $$, 'Cập nhật Maersk Approved + WO');
select lives_ok($$ select public.confirm_quotation_to_repair('MSKU0000123') $$, 'Approved → chuyển Sửa chữa');

select pg_temp.login('00000000-0000-0000-0000-0000000000b2');
select throws_like($$ select public.set_aems_approval('MSKU0000123', 'APPROVED') $$, '%Báo giá%', 'Văn phòng không cập nhật trạng thái duyệt');

select * from finish();
rollback;
