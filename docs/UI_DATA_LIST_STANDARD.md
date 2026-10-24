# MATRAN DEPOT — QUY CHUẨN TRANG NHIỀU DỮ LIỆU (DEC-080)

Áp dụng cho **mọi màn văn phòng / báo cáo / tra cứu** có danh sách dài (máy tính). Màn hiện trường mobile theo quy chuẩn riêng ở `AGENTS.md` mục 8 (thẻ, "Xem thêm", `max-w-lg`).

Đang áp dụng: Văn phòng → Phiếu thu, Tồn vỏ, Báo giá → Chờ báo giá, Văn phòng → Nhập tàu / Xuất tàu, Báo cáo (Hạ vỏ, Cấp vỏ, Nhập tàu, Xuất tàu, Sửa chữa chi tiết), Hồ sơ container.

## 1. Bố cục màn

Thứ tự từ trên xuống:

1. **Khung bộ lọc**. Hàng nút tác nghiệp nằm **cùng dòng** với nút Tra cứu: `Tra cứu` → `Xuất Excel` → các nút tác nghiệp của màn (ví dụ `Tạo phiếu thu TTT`, `Tìm hàng loạt`, `Lập danh sách`).
2. **Form tác nghiệp** (nếu có, ví dụ tạo phiếu): mở ngay dưới khung lọc khi bấm nút, có nút đóng. Mặc định không mở sẵn.
3. **Danh sách**: chiếm **toàn bộ chiều ngang** màn hình. Không chia cột trái / phải với khung chi tiết.

## 2. Danh sách (bảng)

- **Bắt buộc bộ lọc** trước khi tải dữ liệu. Bộ lọc thời gian mặc định là 1 ngày trước → hiện tại (DEC-056), tối đa 3 tháng khi có database (DEC-066).
- **Đủ cột** thông tin cần đối chiếu. Thứ tự cột:
  - Đầu bảng: mã định danh (mã phiếu / mã hồ sơ / số cont).
  - Giữa bảng: thông tin nghiệp vụ.
  - Cuối bảng: thời gian → nhân viên → **trạng thái** → cột đếm (ví dụ Đã in).
- **Thời gian và nhân viên là 2 cột riêng**, không gộp kiểu "lúc • bởi".
- **Độ rộng cột**:
  - Mã, số cont, thời gian **không xuống dòng** (`whitespace-nowrap`).
  - Cột ngắn (size, type, trạng thái) hẹp, canh giữa. Số tiền và số đếm canh phải.
  - Cột ghi chú hoặc tên dài là cột rộng nhất.
  - Bảng đặt `min-w-[…]` và cuộn ngang khi màn hẹp. Không bóp chữ.
- **Ghi chú / cảnh báo** nổi bật bằng nền màu ở ô đó (ví dụ Ghi chú nền vàng — DEC-067), không tô cả dòng.
- **Một dòng = một bản ghi.** Bấm vào dòng → mở chi tiết (mục 3). Dòng đang mở chi tiết được tô nền xanh nhạt.
- **Phân trang** bằng `Pager`, có ô **chọn số dòng / trang: 20 / 50 / 100**:
  - Lưu theo từng màn qua `usePageSize(screenKey, mặc định)`. Đây là tiện ích của trình duyệt, không phải dữ liệu nghiệp vụ.
  - Hàm tra cứu trong `src/services/reports.ts` nhận tham số `pageSize`. Giá trị khác 20 / 50 / 100 tự về 50.
- **Xuất Excel** (DEC-055): toàn bộ kết quả theo bộ lọc (`collectAllPages`), đủ cột như bảng, thêm cột chi tiết nếu cần.

## 3. Chi tiết một bản ghi — CỬA SỔ TRƯỢT BÊN PHẢI

- Dùng **`DetailDrawer`** (`src/components/shared.tsx`). **Không** hiện chi tiết bên dưới hay bên cạnh danh sách, **không** thay cả trang.
- Kích thước: mặc định khoảng 60% màn hình (tối đa 760px). Thêm `wide` (khoảng 75%, tối đa 960px) khi chi tiết có bảng con.
- Phần đầu khung: tiêu đề (mã bản ghi) + **các nút tác nghiệp** của bản ghi (In, Hủy, Duyệt…) + nút đóng.
- **Đóng** bằng: nút X, phím Esc, hoặc bấm ra vùng tối bên ngoài.
- **Thông báo lỗi / thành công** của thao tác trong khung chi tiết phải hiện **bên trong khung**, không để bị che phía sau.
- **Hồ sơ container** (`MasterDossierModal`) cũng mở dạng trượt bên phải, rộng tối đa 960px.
- **In từ trong khung chi tiết**: vùng in đặt trong `PrintPortal` (DEC-072). Không để vùng `print-area` bên trong khung trượt.

## 4. Kiểm tra khi làm màn mới / sửa màn

- [ ] Danh sách full chiều ngang, đủ cột, thời gian và nhân viên tách riêng, trạng thái gần cuối.
- [ ] `Pager` có `pageSize` + `onPageSize`; hàm service nhận `pageSize`.
- [ ] Bấm dòng → `DetailDrawer`; Esc / X / bấm ngoài đều đóng được.
- [ ] Nút tác nghiệp cùng hàng nút Tra cứu.
- [ ] Có nút Xuất Excel theo bộ lọc.
- [ ] Smoke test trong `tests/ui-smoke.test.tsx`.
