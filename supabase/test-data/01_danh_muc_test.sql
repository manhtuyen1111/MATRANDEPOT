-- ============================================================================
-- DANH MỤC TEST (giống bản Demo — DEC-148). CHỈ dùng cho project TEST / local.
-- KHÔNG chạy trên production: production nhập danh mục thật.
-- Chạy lại nhiều lần được (bỏ qua dòng đã có).
-- Cách chạy trên project test: Supabase → SQL Editor → dán toàn bộ file → Run.
-- Local: dán vào Studio (http://127.0.0.1:54323 → SQL Editor).
-- ============================================================================

-- Size / Type container (giống seed.sql — `db push` lên cloud không chạy seed.sql)
insert into public.container_sizes (code, sort_order) values ('20', 1), ('40', 2), ('45', 3) on conflict do nothing;
insert into public.container_types (code, sort_order) values ('DC', 1), ('HC', 2), ('OT', 3), ('FR', 4), ('RF', 5) on conflict do nothing;

-- Công ty (in ở đầu phiếu thu / EEIR / K80)
insert into public.company_profile (id, name, short_name, address, phone, email)
values (true, 'CÔNG TY CỔ PHẦN MATRAN', 'MATRAN DEPOT', 'Số 189, đường Đình Vũ, phường Hải An, thành phố Hải Phòng.', '0912907980', 'Matran@gmail.com')
on conflict (id) do update set name = excluded.name, short_name = excluded.short_name, address = excluded.address,
  phone = excluded.phone, email = excluded.email;

-- Hãng tàu + 10 khách hàng test (KH09, KH10 không được TTS — để thử chặn)
insert into public.partners (code, name, is_shipping_line, allow_tts) values ('MSK', 'MSK', true, true) on conflict (code) do nothing;
insert into public.partners (code, name, is_customer, allow_tts)
select 'KH' || lpad(i::text, 2, '0'), 'Khách hàng ' || lpad(i::text, 2, '0'), true, i <= 8
from generate_series(1, 10) as i
on conflict (code) do nothing;

-- Biểu giá nâng hạ (mọi hãng tàu) + thu gom rác
insert into public.fee_catalog (code, name, category, size, type, amount) values
  ('NH-20DC', 'NÂNG HẠ 20DC', 'NANG_HA', '20', 'DC', 1000000),
  ('NH-40DC', 'NÂNG HẠ 40DC', 'NANG_HA', '40', 'DC', 1500000),
  ('NH-40HC', 'NÂNG HẠ 40HC', 'NANG_HA', '40', 'HC', 1500000),
  ('NH-45HC', 'NÂNG HẠ 45HC', 'NANG_HA', '45', 'HC', 1500000),
  ('RAC-LV1', 'THU GOM RÁC LV1', 'THU_GOM_RAC', null, null, 200000),
  ('RAC-LV2', 'THU GOM RÁC LV2', 'THU_GOM_RAC', null, null, 500000)
on conflict (code) do nothing;

-- Block bãi (giống bản Demo; BLOCK-DAMAGE là kệ giám định — DEC-109)
insert into public.yard_blocks (code, name, max_bay, max_row, max_tier, capacity, is_inspection_rack, description) values
  ('BLOCK-A', 'Khu A — Container AV Sẵn sàng Cấp vỏ', 20, 6, 5, 300, false, 'Lưu bãi container rỗng đạt chuẩn cấp vỏ (AV)'),
  ('BLOCK-B', 'Khu B — Container Lưu bãi chung (chỉ Block)', 0, 0, 0, 0, false, 'Chỉ quản lý theo Block — không cần Bay / Row / Tier'),
  ('BLOCK-CLEAN', 'Khu Vệ Sinh (WP / WW / CC / RM / ML)', 8, 4, 3, 60, false, 'Khu vực Quét, Rửa nước, Hóa chất, Nhổ đinh, Bóc tem'),
  ('BLOCK-DAMAGE', 'Khu Kệ Giám Định & Xưởng Sửa Chữa M&R', 10, 4, 3, 80, true, 'Container DAMAGE chờ Báo giá và Sửa chữa')
on conflict (code) do nothing;

-- Tổ sửa chữa (thêm nhân viên Sửa chữa vào tổ trên app: Danh mục chung → Sửa chữa)
insert into public.repair_teams (code, name) values ('TO-SC-01', 'Tổ sửa chữa 1') on conflict (code) do nothing;
