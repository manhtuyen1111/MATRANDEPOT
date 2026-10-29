-- pgTAP — DEC-189: sức khỏe database (db_health / set_db_health_limits) — chỉ Admin, không lộ thông tin đăng nhập / khóa.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000b1', 'admin@matrandepot.local'),
  ('00000000-0000-0000-0000-0000000000b2', 'vp@matrandepot.local');
insert into public.staff (id, staff_code, username, full_name) values
  ('00000000-0000-0000-0000-0000000000b1', 'A1', 'admin.test', 'Admin Test'),
  ('00000000-0000-0000-0000-0000000000b2', 'V1', 'vp.test', 'Văn phòng Test');
insert into public.staff_roles values ('00000000-0000-0000-0000-0000000000b1', 'ADMIN'), ('00000000-0000-0000-0000-0000000000b2', 'MANAGER');

create or replace function pg_temp.login(uid uuid) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', uid, 'role', 'authenticated')::text, true);
$$;

-- Quản lý (không phải Admin) bị chặn
select pg_temp.login('00000000-0000-0000-0000-0000000000b2');
select throws_like($$ select public.db_health() $$, '%chỉ Admin%', 'Quản lý không xem được sức khỏe database');
select throws_like($$ select public.set_db_health_limits(1000, 1000) $$, '%chỉ Admin%', 'Quản lý không sửa được giới hạn');

-- Admin xem được đủ các nhóm số liệu
select pg_temp.login('00000000-0000-0000-0000-0000000000b1');
select ok((public.db_health()->'database'->>'sizeBytes')::bigint > 0, 'Có dung lượng database');
select ok((public.db_health()->'connections'->>'max')::int > 0, 'Có giới hạn kết nối');
select ok(jsonb_array_length(public.db_health()->'tables') > 10, 'Có danh sách bảng');
select ok(jsonb_typeof(public.db_health()->'storage') = 'array', 'Có số liệu kho ảnh');
select is(jsonb_array_length(public.db_health()->'partitions'), 2, 'Partition nhật ký + lịch sử vị trí');
select is((public.db_health()->'limits'->>'dbMb')::int, 8192, 'Giới hạn mặc định gói Pro 8 GB');
-- Không lộ thông tin đăng nhập / khóa / câu truy vấn
select ok(public.db_health()::text !~* '(password|secret|api_key|jwt|postgres://|select )', 'Không có mật khẩu / khóa / chuỗi kết nối / câu truy vấn');

-- Sửa giới hạn
select throws_like($$ select public.set_db_health_limits(0, 1000) $$, '%lớn hơn 0 MB%', 'Giới hạn phải > 0');
select lives_ok($$ select public.set_db_health_limits(500, 1024) $$, 'Admin đổi sang giới hạn gói Free');
select is((public.db_health()->'limits'->>'storageMb')::int, 1024, 'Đã lưu giới hạn kho ảnh');

select * from finish();
rollback;
