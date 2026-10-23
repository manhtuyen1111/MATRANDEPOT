---
name: matran-domain-change
description: Thêm hoặc sửa một bước nghiệp vụ trong tầng src/services/ của MATRAN DEPOT (kiểm tra quyền, trạng thái, chống lặp, audit) kèm test. Dùng khi thay đổi logic Hạ vỏ, Cấp vỏ, thanh toán, phiếu thu, vị trí, dịch vụ, quyền.
---

# Thay đổi tầng nghiệp vụ

Điều kiện: đã chạy `matran-business-rule-check`, mọi ý có căn cứ DEC.

## Chỗ đặt code
| Loại | File |
|---|---|
| Bước nghiệp vụ | `src/services/depotOperations.ts` |
| Thanh toán / phiếu thu | `src/services/payments.ts` |
| Quyền | `src/services/permissions.ts` (`PERMISSIONS`, `MENU_ACCESS`) |
| Cấp mã | `src/services/codes.ts` |
| Tiện ích (audit, vị trí, tiến độ) | `src/services/core.ts` |
| Báo cáo / tra cứu | `src/services/reports.ts` |
| Kiểu dữ liệu | `src/types/depot.ts` (+ `normalizeDepotState` nếu thêm trường state) |

## Mẫu một hàm nghiệp vụ
1. `assertPermission(state, 'KEY', 'thông báo')` — thêm KEY vào `PERMISSIONS` nếu mới.
2. Tìm bản ghi: container đang trong bãi dùng `findActiveContainer` / `findActiveContainerByCode`.
3. Kiểm tra trạng thái trước; sai → `throw new Error('tiếng Việt, nêu điều kiện thất bại')`.
4. Cập nhật bất biến: `updateContainerById`, không map theo số container.
5. Mã mới: `allocateCode(state, 'HV' | 'CV' | 'NT' | 'XT' | 'PT' | 'PTT' | 'CT')`.
6. Kết thúc bằng `appendAudit(...)`.
7. Không gán dữ liệu mặc định giả (tiền, tên, biển số).

## Test bắt buộc (`tests/acceptance.test.ts`)
- 1 test thành công + ít nhất 1 test bị từ chối (sai quyền / sai trạng thái / dữ liệu sai).
- Tên test bắt đầu bằng mã ACCEPTANCE (GIN-, YARD-, REL-, GOUT-, PAY-...) hoặc mã CR/DEC.

## Kiểm chứng
- Chạy skill `matran-quality-gate`.
- Nếu đổi quyền → cập nhật `docs/ROLE_PERMISSION_MATRIX.md` mục 2A.
- Nếu là thao tác sẽ thành RPC → thêm dòng vào `docs/API_RPC_CONTRACT.md` mục 13.
