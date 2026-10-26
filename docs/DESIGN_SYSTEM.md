# DESIGN SYSTEM — MATRAN DEPOT (v2, DEC-145)

Chuẩn giao diện bắt buộc cho mọi màn mới và mọi lần sửa giao diện. Người dùng đã duyệt ngày 2026-10-26.

- Bản xem trực quan (Claude Design): https://claude.ai/artifact/EvcTG1G1NN8EmHAp8j5t8E
- Bản lưu trong repo: `docs/design/` (`tokens.json`, `README.md`, mẫu thành phần và 2 màn mẫu ở `docs/design/components/*/preview.html` — mở bằng trình duyệt chỉ để tham khảo bố cục; màu thật lấy từ `src/index.css`).
- Token chạy thật: khối `@theme` trong `src/index.css`. **Đổi màu / font → sửa ở đó và ở `docs/design/tokens.json` cùng lúc.**

## 1. Tinh thần

Tối giản, thân thiện: nền trắng, nhiều khoảng trắng, **một màu chính navy đậm**, **một màu nhấn xanh ngọc dùng rất ít**. Lấy cảm hứng bố cục từ cổng tài khoản ngành vận tải biển, nhưng là bản sắc riêng của MATRAN: không dùng logo, font hay màu nhận diện của thương hiệu khác.

1. **Một màn, một việc chính.** Mỗi vùng thao tác chỉ một nút chính (`primaryBtn`); còn lại là nút phụ (`secondaryBtn`).
2. **Khoảng trắng thay khung.** Tách khối bằng khoảng cách và viền `border-line`. Không lồng thẻ trong thẻ. Không bóng đổ (trừ `DetailDrawer` / menu nổi).
3. **Chữ thường, dễ đọc.** Tiêu đề, nhãn viết chữ thường. IN HOA chỉ ở nhãn tác nghiệp (`OperationBadge`).
4. **Màu có nghĩa.** `accent` = focus / đang mở / tiến độ; `op-*` = tác nghiệp; `success-*` / `danger-*` = trạng thái. Không dùng màu cho trang trí.
5. **Lỗi đặt cạnh chỗ sai**, một câu nói rõ cách sửa.

## 2. Màu — chỉ dùng token

| Token (class Tailwind) | Giá trị | Dùng cho |
|---|---|---|
| `canvas` (`bg-canvas`) | #f5f7fa | Nền trang, tiêu đề cột bảng, rê chuột dòng |
| `surface` (`bg-surface` / `bg-white`) | #ffffff | Thẻ, bảng, ô nhập |
| `line` (`border-line`, `divide-line`) | #e4e9ef | Viền thẻ, kẻ ngang bảng |
| `line-strong` (`border-line-strong`) | #c8d1dc | Viền ô nhập, nút phụ |
| `ink` (`text-ink`) | #0f1f30 | Chữ chính, số container |
| `ink-muted` (`text-ink-muted`) | #5a6a7b | Chữ phụ, nhãn, tiêu đề cột |
| `navy-900` (`bg-navy-900`) | #0b2545 | Nút chính, mục menu đang mở, khung quét Xe nâng |
| `navy-700` (`text-navy-700`, `hover:bg-navy-700`) | #1f4673 | Link dữ liệu (`linkCls`), nút chính khi rê chuột |
| `navy-50` (`bg-navy-50`) | #eaf0f7 | Dòng đang chọn, rê chuột menu, khung thêm mới |
| `accent` (`ring-accent`, `border-accent`) | #2bb3c0 | Focus, đang mở, thanh tiến độ. **Không làm màu chữ** |
| `accent-soft` (`bg-accent-soft`) | #e3f6f8 | Chip bộ lọc đang bật |
| `op-ha-vo` / `op-cap-vo` / `op-nhap-tau` / `op-xuat-tau` | #2c66a8 / #6650a8 / #1f7a5c / #e2a43b | Chỉ nhãn tác nghiệp (DEC-083). Xuất tàu chữ `text-ink`, còn lại chữ trắng |
| `success-bg` / `success-fg` | #e8f5ee / #17603f | Thông báo thành công |
| `danger-bg` / `danger-fg` | #fdecec / #a1262b | Lỗi, icon khóa container |

Còn giữ màu Tailwind có sẵn cho trạng thái phụ (`emerald-*`, `red-*`, `rose-*`, `amber-*` — ví dụ số đếm việc chờ `amber-500` nhấp nháy, DEC-075).

**Cấm ở code mới:** `bg-blue-600`, `text-blue-700`, `bg-slate-900`, `text-slate-900/700/500`, `border-slate-200/300`, `bg-slate-50`. Test `DEC-145` trong `tests/ui-smoke.test.tsx` sẽ báo lỗi nếu thấy các class này trong `src/`.

## 3. Chữ

- Giao diện: **Be Vietnam Pro** (`font-sans`, mặc định). Số container, mã: **JetBrains Mono** (`font-mono`). Tải từ Google Fonts trong `index.html`, có font hệ thống dự phòng.
- Cỡ: thành phần dùng chung (nút, ô nhập, thông báo) `text-sm` 14px; bảng dày dữ liệu hiện vẫn `text-xs` — giữ cho thống nhất trong một bảng. Nhãn `text-xs font-medium text-ink-muted`. Tiêu đề thẻ `text-base font-semibold`.
- Điện thoại: ô nhập luôn 16px (DEC-116, quy tắc trong `src/index.css`).

## 4. Kích thước, bo góc

- Nút / ô nhập cao tối thiểu 40px (`min-h-10`); trên điện thoại nút chính full chiều ngang, cao 48px (`h-12`).
- Bo: nút / ô nhập `rounded-lg` (8px); thẻ / thông báo / khung quét `rounded-xl` (12px); nhãn tác nghiệp `rounded` (4px); chip / số đếm `rounded-full`.
- Khoảng cách: 4 / 8 / 12 / 16 / 24px (`gap-1`, `gap-2`, `gap-3`, `p-4`, `p-6`).

## 5. Thành phần — luôn dùng bản dùng chung

| Cần | Dùng (`src/components/shared.tsx`) |
|---|---|
| Nút | `primaryBtn`, `secondaryBtn` |
| Ô nhập + nhãn | `inputCls`, `labelCls` |
| Thẻ nhóm | `SectionCard` |
| Thông báo | `Feedback` |
| Link mã hồ sơ / phiếu | `linkCls` (DEC-117) |
| Số container | `ContainerNo` |
| Vị trí | `LocationText`, `SlotPicker` |
| Ô chữ dài trong bảng | `CellText` + `CELL_MAX` |
| Phân trang, chi tiết | `Pager` + `usePageSize`, `DetailDrawer` |
| Thời gian | `DateTimeField`, `DateRangeFilter` |
| Nhãn tác nghiệp | `OperationBadge` (`src/features/vessel/VesselShared.tsx`) |

Không tự viết lại màu / bo / cỡ chữ cho các phần trên. Cần biến thể mới → thêm vào `shared.tsx` rồi dùng chung.

## 6. Mẫu màn

**Văn phòng / báo cáo (máy tính)** — theo `docs/UI_DATA_LIST_STANDARD.md` (DEC-080): tiêu đề màn + số lượng; thẻ bộ lọc (ô tìm, chọn, nút Tra cứu chính); bảng `whitespace-nowrap` trong `overflow-x-auto`, tiêu đề cột `bg-canvas text-ink-muted`, chỉ kẻ ngang `border-line`, rê chuột `hover:bg-canvas`; `Pager` dưới bảng; bấm dòng mở `DetailDrawer`. Mẫu: `docs/design/components/YardStockPage/preview.html`.

**Hiện trường (điện thoại)** — khung `mx-auto w-full max-w-lg`, một cột: dòng nhỏ "Bộ phận …" + tên màn + ô số đếm; phần đang thao tác trên cùng (khung quét `bg-navy-900 text-white rounded-xl`, số cont mono rất lớn); chọn vị trí bằng nút lớn; nút xác nhận full chiều ngang; danh sách chờ dạng thẻ (`QueueListRow`); "Xem thêm" thay phân trang. Mẫu: `docs/design/components/ForkliftScanPage/preview.html`.

**Giấy tờ in** — chữ `text-ink` trên nền trắng, hạn chế nền đậm để in rõ; khung theo DEC-062 / DEC-072 / DEC-076.

## 7. Biểu tượng

`lucide-react`, 16px ở máy tính, 20px ở điện thoại. Không dùng emoji trang trí. Không có logo: tên MATRAN DEPOT viết bằng chữ.

## 8. Khi thay đổi design system

1. Người dùng duyệt (trên Claude Design hoặc trong chat) → ghi DEC mới.
2. Sửa `src/index.css` (`@theme`) + `docs/design/tokens.json` + file này.
3. Cập nhật bản Claude Design để hai nơi khớp nhau.
