# MATRAN DEPOT

Hệ thống thiết kế của ERP bãi container rỗng MATRAN DEPOT. **Tối giản, thân thiện:** nền trắng, nhiều khoảng trắng, một màu chính navy đậm, một màu nhấn xanh ngọc dùng rất ít. Phục vụ **văn phòng trên máy tính** (bảng dày dữ liệu) và **hiện trường trên điện thoại** (nút lớn, một cột).

Phiên bản 2 lấy cảm hứng bố cục từ các cổng tài khoản ngành vận tải biển; bản sắc là của MATRAN, không dùng logo, font hay màu nhận diện của thương hiệu khác.

## Nguyên tắc

1. **Một màn, một việc chính.** Một nút chính `navy-900` mỗi vùng thao tác; còn lại là nút phụ viền.
2. **Khoảng trắng thay khung.** Tách khối bằng khoảng cách `space-6` và viền `line`; không lồng khung trong khung, không bóng đổ (trừ `shadow-drawer`).
3. **Chữ thường, dễ đọc.** Tiêu đề và nhãn viết chữ thường (`title`, `caption`). IN HOA chỉ còn ở nhãn tác nghiệp (`badge`).
4. **Màu có nghĩa.** `accent` cho focus / đang mở / tiến độ; 4 màu `op-*` chỉ cho tác nghiệp; `danger-*`, `success-*` chỉ cho trạng thái.
5. **Lỗi đặt cạnh chỗ sai.** Lỗi của ô nhập hiện ngay dưới ô, chữ `danger-fg`, một câu nói rõ cách sửa.

## Nội dung

- Tiếng Việt, giữ thuật ngữ bãi: Hạ vỏ, Cấp vỏ, Nhập tàu, Xuất tàu, EEIR, LOLO, Tồn vỏ.
- Thời gian `dd/MM/yyyy HH:mm:ss`.
- Mã có hồ sơ (HV-, CV-, NT-, XT-, PT-TT-, PT-TTR-) luôn là link kiểu `code` màu `navy-700`.
- Ô bảng một dòng; chữ dài cắt 20 / 30 / 40 ký tự kèm "…".

## Màu

| Vai trò | Token |
|---|---|
| Nền trang / thẻ | `canvas` / `surface` |
| Viền | `line` (thẻ, bảng), `line-strong` (ô nhập) |
| Chữ | `ink`, `ink-muted` |
| Chính | `navy-900`, rê chuột `navy-700`, nền chọn `navy-50` |
| Nhấn | `accent` (không làm chữ), `accent-soft` |
| Tác nghiệp | `op-ha-vo`, `op-cap-vo`, `op-nhap-tau`, `op-xuat-tau` |

## Chữ

**Be Vietnam Pro** (Google Fonts, dấu tiếng Việt chuẩn) cho giao diện; **JetBrains Mono** cho số container và mã. Máy tính cỡ `body` 14px; điện thoại ô nhập 16px.

## Kích thước

Nút / ô nhập cao `control-h` 40px (máy tính), `control-h-touch` 48px (điện thoại). Bo `radius-md` cho nút, `radius-lg` cho thẻ.

## Bảng (màn văn phòng)

Dòng cao ~44px, chỉ kẻ ngang `line`, không kẻ dọc. Tiêu đề cột `caption` màu `ink-muted` trên `canvas`. Rê chuột: nền `canvas`. Bấm dòng mở DetailDrawer bên phải.

## Mobile

Khung tối đa 512px giữa màn, lề `space-4`. Thẻ thay bảng. Phần đang thao tác ở trên cùng. Nút full chiều ngang.

## Biểu tượng

lucide-react, nét 1.75–2px, 16px (máy tính) / 20px (điện thoại). Không có logo: tên MATRAN DEPOT viết bằng chữ.

## Chưa đồng bộ

- Đây là hướng thiết kế mới, **chưa áp vào code**. Thành phần là bản vẽ tĩnh.
- Chưa có: SlotPicker, Pager, DetailDrawer, DateRangeFilter, PaymentPanel, phiếu in.
- Chưa có chế độ tối.
