---
name: matran-ui-screen
description: Tạo hoặc sửa màn hình giao diện MATRAN DEPOT (React + Tailwind) theo chuẩn UI chung, chỉ gọi service, có smoke test. Dùng khi sửa src/features/**, src/components/**, menu App.tsx.
---

# Màn hình giao diện

## Luật
- Giao diện KHÔNG tự đặt quy tắc nghiệp vụ. Mọi kiểm tra nằm trong `src/services/`; UI gọi hàm, `try/catch`, hiển thị `err.message` bằng `<Feedback>`.
- Ẩn/hiện nút theo quyền dùng `can(state.currentUser, 'KEY')` — chỉ để hiển thị.
- Tái sử dụng `src/components/shared.tsx`: `SectionCard`, `Feedback`, `FeeLinesEditor`, `PaymentPanel`, `PendingTransferPanel`, `SlotPicker`, `Pager`, `DetailDrawer`, `usePageSize`, `ContainerNo` (có biểu tượng khóa), `inputCls/labelCls/primaryBtn/secondaryBtn`.
- **Phong cách: theo `docs/DESIGN_SYSTEM.md` (DEC-145) — đọc trước khi làm màn.** Màu chỉ dùng token (`bg-navy-900`, `text-ink`, `text-ink-muted`, `border-line`, `bg-canvas`, `bg-op-*`…); cấm `blue-600` / `slate-*` cũ (test DEC-145 chặn). Chữ thường cho tiêu đề / nhãn, IN HOA chỉ ở nhãn tác nghiệp. Không emoji trang trí. Màn hiện trường theo mẫu mobile (`max-w-lg`), màn văn phòng theo mẫu danh sách; mẫu ở `docs/design/components/*Page/preview.html`.
- Danh sách lớn: theo **`docs/UI_DATA_LIST_STANDARD.md` (DEC-080)** — full chiều ngang, có lọc, `Pager` chọn 20 / 50 / 100 dòng (`usePageSize`), bấm dòng mở `DetailDrawer` (trượt bên phải, không hiện chi tiết bên dưới); báo cáo không tự tải trước khi bấm Tra cứu.
- Hiển thị đủ trạng thái: rỗng, lỗi, thành công.

## Thêm màn hình mới
1. Tạo `src/features/<nhóm>/<Ten>Workspace.tsx`.
2. Thêm `WorkspaceMenuId` trong `src/types/depot.ts`, quyền trong `MENU_ACCESS` (`permissions.ts`).
3. Thêm mục vào mảng `MENU` và nhánh render trong `src/app/App.tsx`.
4. Thêm 1 dòng render vào `tests/ui-smoke.test.tsx`.

## Kiểm chứng
- `matran-quality-gate` pass.
- Ghi vào báo cáo: "chưa kiểm thử thao tác trên trình duyệt" nếu không mở được trình duyệt.
