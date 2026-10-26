# MATRAN DEPOT — DATABASE CONTRACT

## 1. Mục đích

Định nghĩa các nhóm dữ liệu, quan hệ và quy tắc nhất quán cho database PostgreSQL trên Supabase.

Đây là đặc tả ban đầu. Chưa tạo bảng hoặc SQL cho đến khi các quy tắc nghiệp vụ liên quan được xác nhận.

## 2. Nguyên tắc thiết kế

- Dùng PostgreSQL làm cơ sở dữ liệu chính.
- Mỗi bảng nghiệp vụ có khóa chính ổn định.
- Khai báo khóa ngoại cho các quan hệ cần bảo đảm toàn vẹn.
- Dùng ràng buộc database để ngăn dữ liệu không hợp lệ.
- Lưu thời điểm tạo, cập nhật và người thực hiện khi phù hợp.
- Lưu lịch sử nghiệp vụ, trạng thái và vị trí container.
- Không dùng xóa vật lý để thay thế cho hủy nghiệp vụ.
- Ngăn cấp trùng container và xử lý trùng yêu cầu thanh toán.
- Dùng transaction hoặc hàm database cho các bước cần cập nhật đồng bộ.
- Áp dụng Row Level Security (RLS) cho dữ liệu cần phân quyền.
- Mọi thay đổi cấu trúc database phải có migration được quản lý bằng Git.

## 3. Các nhóm dữ liệu dự kiến

### 3.1. Tài khoản và phân quyền

Quản lý:
- Hồ sơ nhân viên.
- Tài khoản liên kết với Supabase Auth.
- Vai trò và quyền.
- Trạng thái hoạt động của tài khoản.
- Phạm vi dữ liệu được phép truy cập.

Không lưu mật khẩu người dùng trực tiếp trong bảng hồ sơ nhân viên.

### 3.2. Danh mục và cấu hình bãi

Quản lý:
- Thông tin bãi.
- Khu vực lưu container.
- Cấu trúc vị trí.
- Loại container rỗng được tiếp nhận.
- Danh mục dịch vụ.
- Danh mục trạng thái và lý do nghiệp vụ.

Cấu trúc vị trí cụ thể phải được xác nhận trước khi thiết kế bảng.

### 3.3. Khách hàng và đối tác

Quản lý:
- Khách hàng.
- Hãng tàu.
- Chủ sở hữu container.
- Bên yêu cầu dịch vụ.
- Bên chịu phí.
- Bên thực tế thanh toán.
- Thông tin liên hệ và trạng thái hợp tác.

Một tổ chức có thể giữ nhiều vai trò khác nhau. Không mặc định các vai trò này luôn thuộc cùng một bên.

### 3.4. Container

Quản lý:
- Số container.
- Thông tin nhận dạng và đặc tính (`SIZE`, `TYPE`...).
- Chủ sở hữu.
- Trạng thái nghiệp vụ.
- Vị trí hiện tại (hỗ trợ ghi nhận ở cấp `Block` khi chưa có `Bay/Row/Tier` và cập nhật vị trí chi tiết `Bay/Row/Tier` sau).
- Trạng thái có thể cấp hoặc không thể cấp.
- Trạng thái tạm giữ hoặc khóa xuất theo yêu cầu.
- Thời gian lưu bãi.
- Lịch sử vị trí.
- Lịch sử trạng thái và các nghiệp vụ liên quan.

Quy tắc:
- Một container đang nằm trong bãi chỉ có một vị trí hiện tại hợp lệ.
- Không coi `Block` là một vị trí độc quyền khiến các container khác không thể cùng nằm trong `Block` đó; khi bổ sung vị trí chi tiết hơn (`Bay/Row/Tier`), cập nhật vị trí hiện tại và giữ lịch sử.

### 3.5. Booking và cấp container

Quản lý:
- Booking hoặc yêu cầu cấp.
- Bên yêu cầu và bên nhận.
- Điều kiện cấp.
- Container được phân bổ.
- Thời điểm khóa phân bổ.
- Thay đổi, hủy và giải phóng phân bổ.
- Lịch sử cấp container.

Một container đã được xác nhận gắn với lượt cấp không được đồng thời phân bổ cho một lượt cấp khác đang còn hiệu lực.

### 3.6. Gate In và Gate Out

Quản lý:
- Mã lượt nghiệp vụ.
- Loại tiếp nhận vào bãi (Khách hàng trả container rỗng theo lệnh hãng tàu; `NHẬP TÀU` làm module riêng sau; các loại khác chỉ bổ sung khi được xác nhận) hoặc loại xuất bãi (`CẤP VỎ`, `XUẤT TÀU`, trả container theo lệnh riêng).
- Container liên quan.
- Bên yêu cầu dịch vụ.
- Ảnh cửa container nhìn rõ số container và tài liệu/chứng từ liên quan.
- Các trường thông tin hiện trường Gate In đã xác nhận:
  - Phân loại: `DAMAGE`, `AV`.
  - Phân loại đóng hàng: `M`, `K`, `E`.
  - Tình trạng vệ sinh: `KHÔNG VỆ SINH`, `QUÉT`, `RỬA NƯỚC`, `VỆ SINH CÔNG NGHIỆP`, `NHỔ ĐINH`, `BÓC TEM`.
- Các trường thông tin văn phòng bổ sung tại Gate In đã xác nhận:
  - `SỐ CONTAINER`, `SIZE`, `TYPE`, `SỐ XE`, `ĐẠI DIỆN KHÁCH HÀNG`.
- Nhân viên thực hiện.
- Trạng thái quy trình (bao gồm trạng thái `GATE IN OK` chỉ đạt được sau khi thanh toán thành công).
- Thời điểm xác nhận.
- Điều kiện hoàn tất.
- Lý do hủy hoặc từ chối.

Gate In: Việc tạo yêu cầu thanh toán không đồng nghĩa đã thu tiền thành công; chỉ sau khi thanh toán thành công mới được cập nhật `GATE IN OK`.

Gate Out: Phải kiểm tra đủ 5 điều kiện đã xác nhận trước khi xuất (có lệnh cấp/lệnh xuất hợp lệ; không bị tạm giữ hoặc khóa xuất; đúng số container được phép xuất; đã thanh toán các khoản phí bắt buộc theo quy định; chứng từ và thủ tục đã hoàn tất).

### 3.7. Vệ sinh, giám định và sửa chữa

Quản lý:
- Yêu cầu dịch vụ.
- Công việc được giao.
- Kết quả thực hiện.
- Hình ảnh và tài liệu.
- Dự toán và phê duyệt sửa chữa.
- Vật tư, nhân công và chi phí.
- Nghiệm thu.
- Lịch sử thực hiện.

Mỗi dịch vụ phải liên kết đúng container và lượt nghiệp vụ tương ứng.

### 3.8. Tài chính và thanh toán

Quản lý:
- Danh mục phí và bảng giá.
- Khoản phải thu.
- Chi tiết phí theo dịch vụ.
- Giao dịch thanh toán.
- Phương thức thanh toán.
- Trạng thái giao dịch.
- Mã tham chiếu từ cổng thanh toán.
- Hoàn tiền.
- Đối soát.
- Lịch sử điều chỉnh.

Phân biệt khoản phải thu với giao dịch thanh toán. Một khoản phải thu không đồng nghĩa với việc tiền đã được nhận.

### 3.9. Nhật ký và kiểm soát

Quản lý:
- Người thực hiện.
- Hành động.
- Đối tượng bị tác động.
- Thời điểm.
- Dữ liệu thay đổi cần kiểm toán.
- Kết quả thành công hoặc thất bại khi phù hợp.

Không cho phép người dùng thông thường sửa hoặc xóa nhật ký kiểm toán.

## 4. Quan hệ dữ liệu dự kiến

- Một container có thể có nhiều lượt Gate In và Gate Out theo lịch sử.
- Một container có nhiều bản ghi lịch sử vị trí.
- Một container có thể có nhiều yêu cầu vệ sinh, giám định hoặc sửa chữa.
- Một booking có thể phân bổ container theo quy tắc cấp đã được phê duyệt.
- Một dịch vụ có thể phát sinh một hoặc nhiều khoản phí.
- Một khoản phải thu có thể được thanh toán bằng một hoặc nhiều giao dịch tùy chính sách.
- Một tổ chức có thể đồng thời là chủ sở hữu, bên yêu cầu dịch vụ hoặc bên chịu phí.
- Một nghiệp vụ có thể có nhiều ảnh và tài liệu.
- Một người dùng có thể được cấp nhiều vai trò nếu chính sách phân quyền cho phép.

Các quan hệ một-nhiều, nhiều-nhiều và điều kiện bắt buộc phải được cụ thể hóa khi thiết kế schema.

## 5. Quy tắc toàn vẹn dữ liệu

- Số container phải được chuẩn hóa và kiểm tra tính hợp lệ.
- Không cho phép một container có hai vị trí hiện tại cùng lúc.
- Không cho phép phân bổ trùng container trong các lượt cấp còn hiệu lực.
- Không hoàn tất Gate In khi chưa đáp ứng điều kiện thanh toán bắt buộc.
- Không xuất container khi chưa đủ điều kiện Gate Out.
- Không đánh dấu giao dịch thanh toán thành công chỉ vì đã tạo yêu cầu thanh toán.
- Có cơ chế chống ghi nhận trùng callback hoặc yêu cầu thanh toán.
- Các thao tác chuyển trạng thái quan trọng phải kiểm tra trạng thái trước đó.
- Các cập nhật liên quan phải được thực hiện nguyên tử khi cần.
- Hủy nghiệp vụ phải giữ lại lịch sử và lý do.
- Không tin dữ liệu quyền do frontend tự gửi lên.

## 6. Quy ước triển khai

- Dùng UUID cho khóa chính khi phù hợp.
- Dùng `timestamptz` cho thời điểm.
- Dùng kiểu số chính xác cho tiền, không dùng số thực dấu phẩy động.
- Khai báo `NOT NULL`, `UNIQUE`, `CHECK` và khóa ngoại khi phù hợp.
- Tạo index theo các truy vấn thực tế.
- Lưu ảnh trong Supabase Storage và lưu metadata, đường dẫn cùng quyền truy cập trong database.
- Không lưu nội dung ảnh nhị phân trực tiếp trong bảng nghiệp vụ.
- Quản lý thay đổi schema bằng migration có thứ tự.
- Kiểm thử quyền RLS và các tình huống đồng thời.

## 7. Các nội dung cần chốt trước khi viết SQL

- Cấu trúc vị trí bãi.
- Danh mục và trạng thái container.
- Danh mục loại Gate In và Gate Out.
- Quy tắc cấp, khóa và giải phóng container.
- Quy trình phê duyệt vệ sinh, giám định và M&R.
- Biểu phí và chính sách công nợ.
- Cấu trúc khoản phải thu, thanh toán và hoàn tiền.
- Ma trận quyền và chính sách RLS.
- Quy tắc lưu ảnh, thời hạn lưu và quyền truy cập.

## 8. Bổ sung từ Change Request 2026-10-22 (phải có trong schema chính thức)

- **Lượt lưu bãi**: mỗi lần container vào bãi là một bản ghi riêng (mã hồ sơ `HV-...` / `NT-...`); tối đa 1 lượt đang mở cho mỗi số container (unique index có điều kiện); lượt đã OUT giữ làm lịch sử (DEC-019).
- **Bộ đếm mã**: `HV-YYMMDD-NNN`, `CV-YYMMDD-NNN`, `PT-YYYY-NNNNNN` cấp trong database bằng bảng bộ đếm + khóa dòng trong cùng transaction; ràng buộc `UNIQUE` trên từng mã (DEC-032, DEC-037).
- **Chứng từ phải thu** (`payment_vouchers`): trạng thái `PENDING` / `CONFIRMED` (đã thanh toán) / `DEFERRED` (TTS — công nợ) / `CANCELLED`; lưu dòng chi phí chụp từ biểu giá.
- **Giao dịch thu tiền** (`payment_transactions`, mới): phương thức (tiền mặt / chuyển khoản), mục đích (chứng từ / nạp Phiếu thu mẹ), trạng thái `PENDING` / `SUCCEEDED` / `FAILED` / `CANCELLED`, mã giao dịch ngân hàng `UNIQUE` (chống xử lý lặp).
- **Phiếu thu** (`payment_receipts`, mới): `UNIQUE(transaction_id)` — mỗi giao dịch tối đa 1 phiếu; liên kết chứng từ / Phiếu thu mẹ / hồ sơ.
- **Phiếu thu mẹ**: thêm trạng thái `PENDING_PAYMENT` (chưa dùng được để trừ dần cho tới khi thu tiền nạp).
- **Hồ sơ cấp vỏ** (`gate_out_orders`): thêm `PAYMENT_PENDING`, SĐT lái xe, dòng chi phí; một container chỉ có tối đa 1 hồ sơ cấp vỏ đang hiệu lực.
- **Booking**: `requested_qty` có thể rỗng; số đã cấp đếm từ hồ sơ cấp vỏ.
- **Vai trò** thêm `QUOTATION`. **Gate In** thêm `driver_phone`.
- **Vị trí bãi (DEC-082)**: `yard_blocks.max_bay / max_row / max_tier` cho phép 0 hoặc NULL = không dùng chiều đó; mã `BLOCK-…`; ràng buộc chống trùng ô **chỉ khi đủ Block + Bay + Row + Tier** (DEC-087), thiếu chiều thì nhiều cont chung 1 vị trí; Block không có chiều nào không giới hạn số cont.
- **Lịch sử vị trí**: thêm loại `YARD_SHIFT` (ĐẢO CHUYỂN). SỬA VỊ TRÍ hành chính không ghi lịch sử vị trí, chỉ ghi `audit_logs`.
- **Nhập tàu / Xuất tàu (DEC-069)**: bảng `vessel_lists` (mode `NHAP_TAU`/`XUAT_TAU`, tên tàu, `planned_at`, hãng tàu — bắt buộc với NHAP_TAU, danh sách số xe, `status` OPEN/APPROVED, người / giờ lập, duyệt) và `vessel_list_items` (số cont, size, type, `status` PENDING/INSPECTED/DONE, `dossier_code` `NT-`/`XT-` UNIQUE, `container_id`, số xe, kết quả giám định, ảnh chụp trạng thái / vị trí lúc lập, người / giờ thực hiện). Ràng buộc: 1 cont chỉ ở 1 danh sách XUẤT TÀU đang mở; cont NHẬP TÀU không trùng lượt đang tồn bãi. Duyệt chỉ khi mọi dòng DONE. Không có chứng từ / phiếu thu.
- **Mã hồ sơ (DEC-068)**: tiền tố `HV-`, `CV-`, `NT-`, `XT-` (theo ngày), `PT-`, `PTT-` (theo năm). Migration dữ liệu cũ: `IN-`/`HS-` → `HV-`, `OUT-`/`GO-` → `CV-`, `PTM-` → `PTT-`.

## 9. Trạng thái

- Nhóm dữ liệu: đã phác thảo; bổ sung mục 8.
- Quan hệ dữ liệu: đã hiện thực ở tầng nghiệp vụ chế độ Demo (`src/services/`), chưa có ở database.
- SQL và migration: có bản nháp `supabase/migrations/20261021000001_init_matran_depot_schema.sql` — **chưa áp dụng lên Supabase nào** (người dùng xác nhận 2026-10-22), **không khớp** với mục 8 và có lỗ hổng bảo mật (RPC `SECURITY DEFINER` không kiểm tra quyền, RLS thiếu policy). Không được apply; sẽ viết lại toàn bộ ở giai đoạn database.
- Chính sách RLS: chưa triển khai.

## 10. Hiệu năng & lưu trữ dữ liệu lớn (DEC-066 — bắt buộc khi viết schema P4-01)

> Nơi đặt database, gói, sao lưu 3-2-1, tình huống vận hành (mất mạng hiện trường, thao tác đồng thời, chuyển từ Demo sang thật…): xem `docs/DATABASE_PLATFORM_ADVICE.md` (đề xuất, chờ chốt Q-037 → Q-040).

### 10.1. Quy mô thiết kế

> **Cập nhật DEC-150:** 50–70 nhân viên; 10.000–15.000 container ra vào / tháng. Các con số dưới đây nhân ~1,5 cho mức cao.
| Bảng | Mỗi tháng | 10 năm |
|---|---|---|
| Hồ sơ Hạ vỏ + Cấp vỏ | ~10.000 | ~1,2 triệu |
| Container (mỗi lượt lưu bãi 1 dòng) | ~5.000 | ~600.000 |
| Chứng từ / giao dịch / phiếu thu | ~10–20.000 | ~2 triệu |
| K80, bước lộ trình, vệ sinh, sửa chữa | ~30–50.000 | ~5 triệu |
| Nhật ký kiểm toán | ~100.000 | ~12 triệu |

Dung lượng dữ liệu (không ảnh) ước 5–15 GB / 10 năm.

### 10.2. Index bắt buộc
- Ghép theo bộ lọc báo cáo: `gate_in_orders (gate_in_at, status)`, `gate_out_orders (gate_out_at, status)`, `payment_receipts (issued_at)`, `payment_transactions (created_at, status)`, `audit_logs (created_at)`.
- Tra cứu: số container, mã hồ sơ (HV-/CV-/NT-/XT-), booking, hãng tàu, khách hàng, mã phiếu thu.
- Index một phần cho Tồn vỏ: `containers (...) WHERE status <> 'GATED_OUT'`.
- Ràng buộc duy nhất: một container chỉ một lượt đang trong bãi (`UNIQUE (container_no) WHERE status <> 'GATED_OUT'`); mã hồ sơ / phiếu duy nhất.

### 10.3. Truy vấn & phân trang
- Lọc, đếm, tổng hợp chạy trong RPC trên database; client không tải toàn bộ.
- **Bắt buộc bộ lọc thời gian; tối đa 3 tháng / lần lọc** (RPC từ chối nếu vượt). Mặc định 1 ngày (DEC-056).
- Phân trang **con trỏ (keyset)** theo `(thời gian, id)`, 50 dòng/trang; không dùng `OFFSET`.
- Đếm tổng chỉ chạy khi đổi bộ lọc.
- Danh sách chỉ trả cột cần hiển thị; chi tiết (dòng chi phí, lịch sử, ảnh) tải khi mở hồ sơ.
- Báo cáo Tổng hợp nhiều tháng / năm: bảng tổng hợp theo ngày hoặc materialized view, làm mới hằng đêm.

### 10.4. Xuất Excel
- ≤ 20.000 dòng: xuất trên trình duyệt (exceljs), lấy dữ liệu từ RPC theo lô 1.000 dòng.
- > 20.000 dòng: Edge Function tạo file `.xlsx` phía máy chủ, lưu tạm ở Storage, trả link tải; giao diện báo "đang chuẩn bị file".
- Thay `collectAllPages` (Demo) bằng hàm lấy theo lô từ RPC; giữ nguyên cột của các hàm `*Sheet` trong `src/services/reports.ts`.

### 10.5. Lưu trữ
- **Sửa theo DEC-150:**
  - Dữ liệu trực tuyến **3 năm**; quá 3 năm chuyển ra kho lưu trữ (file nén, mã hóa) theo từng tháng, vẫn đủ thời hạn chứng từ kế toán.
  - Chỉ `audit_logs` và `location_history` **chia partition theo tháng** (DEC-151); bảng khác dùng chỉ mục thời gian. Thiết kế: `docs/DATABASE_SCHEMA.md`.
- Ảnh lưu ở Supabase Storage, nén ~200 KB, **giữ 24 tháng** rồi tự xóa; database chỉ lưu đường dẫn + ngày hết hạn.
- Chế độ Demo (localStorage ~5 MB) chỉ để chạy thử — không dùng cho dữ liệu thật.
