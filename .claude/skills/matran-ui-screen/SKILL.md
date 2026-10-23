---
name: matran-ui-screen
description: Tạo hoặc sửa màn hình giao diện MATRAN DEPOT (React + Tailwind) theo chuẩn UI chung, chỉ gọi service, có smoke test. Dùng khi sửa src/features/**, src/components/**, menu App.tsx.
---

# Màn hình giao diện

## Luật
- Giao diện KHÔNG tự đặt quy tắc nghiệp vụ. Mọi kiểm tra nằm trong `src/services/`; UI gọi hàm, `try/catch`, hiển thị `err.message` bằng `<Feedback>`.
- Ẩn/hiện nút theo quyền dùng `can(state.currentUser, 'KEY')` — chỉ để hiển thị.
- Tái sử dụng `src/components/shared.tsx`: `SectionCard`, `Feedback`, `FeeLinesEditor`, `PaymentPanel`, `PendingTransferPanel`, `SlotPicker`, `Pager`, `ContainerNo` (có biểu tượng khóa), `inputCls/labelCls/primaryBtn/secondaryBtn`.
- Phong cách: nền trắng/slate, 1 màu nhấn xanh `blue-600`, chữ `text-xs`, không emoji trang trí. Màn hiện trường tối ưu mobile (`max-w-lg`).
- Danh sách lớn: có lọc, phân trang; báo cáo không tự tải trước khi bấm Tra cứu.
- Hiển thị đủ trạng thái: rỗng, lỗi, thành công.

## Thêm màn hình mới
1. Tạo `src/features/<nhóm>/<Ten>Workspace.tsx`.
2. Thêm `WorkspaceMenuId` trong `src/types/depot.ts`, quyền trong `MENU_ACCESS` (`permissions.ts`).
3. Thêm mục vào mảng `MENU` và nhánh render trong `src/app/App.tsx`.
4. Thêm 1 dòng render vào `tests/ui-smoke.test.tsx`.

## Kiểm chứng
- `matran-quality-gate` pass.
- Ghi vào báo cáo: "chưa kiểm thử thao tác trên trình duyệt" nếu không mở được trình duyệt.
