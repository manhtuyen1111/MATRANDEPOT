-- pgTAP — DEC-196: Xuất tàu bắt buộc MÃ CẢNG ĐẾN (tùy tàu); Nhập tàu không dùng. (Luồng lập danh sách đầy đủ: 0004)
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

select has_column('public', 'vessel_lists', 'destination_port', 'Danh sách tàu có mã cảng đến');
select is(public.vessel_destination_port('XUAT_TAU', ' vnhphtm '), 'VNHPHTM', 'Chuẩn hóa chữ hoa, bỏ khoảng trắng');
select throws_like($$ select public.vessel_destination_port('XUAT_TAU', '') $$, '%MÃ CẢNG ĐẾN%', 'Xuất tàu bắt buộc mã cảng đến');
select throws_like($$ select public.vessel_destination_port('XUAT_TAU', 'VN HP') $$, '%MÃ CẢNG ĐẾN%', 'Mã cảng 5–10 chữ / số');
select is(public.vessel_destination_port('NHAP_TAU', 'VNHPHTM'), null, 'Nhập tàu không lưu mã cảng');
select is((select destination_port from public.vessel_lists where false), null, 'Cột cho phép trống (danh sách Nhập tàu / cũ)');

select * from finish();
rollback;
