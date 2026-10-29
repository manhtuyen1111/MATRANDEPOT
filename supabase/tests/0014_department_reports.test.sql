-- pgTAP — DEC-179: chỉ mục báo cáo theo bộ phận (Giám định / Xe nâng)
begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

select has_index('public', 'gate_in_orders', 'gate_in_orders_field_at', 'Chỉ mục báo cáo Giám định theo lúc giám định');
select has_index('public', 'location_history', 'location_history_performed', 'Chỉ mục báo cáo Xe nâng theo thời gian');
select has_index('public', 'location_history', 'location_history_action', 'Chỉ mục báo cáo Xe nâng theo loại tác nghiệp');

select * from finish();
rollback;
