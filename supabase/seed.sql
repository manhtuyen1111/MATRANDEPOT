-- Dữ liệu nền cho môi trường DEV / STAGING (giá trị mặc định của bản Demo — Admin sửa được trong Danh mục).
-- KHÔNG có dữ liệu tác nghiệp, khách hàng, biểu giá — production nhập thật.
insert into public.container_sizes (code, sort_order) values ('20', 1), ('40', 2), ('45', 3) on conflict do nothing;
insert into public.container_types (code, sort_order) values ('DC', 1), ('HC', 2), ('OT', 3), ('FR', 4), ('RF', 5) on conflict do nothing;
insert into public.company_profile (id, name, short_name) values (true, 'CÔNG TY CỔ PHẦN MATRAN', 'MATRAN DEPOT') on conflict do nothing;
