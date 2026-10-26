# DANH MỤC TRẠNG THÁI — chuẩn cho database (OPEN-003, DEC-149)

Nguồn: bản Demo đang chạy (`src/types/depot.ts`, `src/services/`), mốc `demo-truoc-database-2026-10-26`. Người dùng chọn "lấy theo bản Demo" (2026-10-26).

**Trạng thái: ĐÃ DUYỆT 2026-10-26 (DEC-150) — dùng các mã ✅, bỏ hết mã ⚪.** Sau khi người dùng duyệt, mỗi bảng dưới đây thành một kiểu `enum` (hoặc bảng tra cứu) trong Postgres, giữ nguyên **mã**.

Cột **Dùng ở Demo**:
- ✅ = có luồng nghiệp vụ đặt giá trị này.
- ⚪ = chỉ khai báo, chưa luồng nào đặt. Đề xuất mặc định: **bỏ** khi tạo database, trừ khi người dùng muốn giữ cho nghiệp vụ sau này. Các dòng ⚪ đều cần người dùng xác nhận.

## 1. Container — lượt lưu bãi (`ContainerStatus`)

| Mã | Ý nghĩa | Dùng ở Demo |
|---|---|---|
| `WAITING_PLACEMENT` | Đã GATE IN OK, chờ (vệ sinh nếu có rồi) Xe nâng hạ vỏ | ✅ |
| `IN_YARD` | Đang tồn bãi | ✅ |
| `ALLOCATED` | Đã lập lệnh Cấp vỏ, giữ cho lệnh | ✅ |
| `GATED_OUT` | Đã ra khỏi bãi (lượt đóng, giữ làm lịch sử) | ✅ |
| `PENDING_GATE_IN` | Đang làm thủ tục Hạ vỏ | ⚪ (Demo chỉ tạo lượt bãi khi GATE IN OK) |

Cờ đi kèm container (không phải trạng thái, là cột riêng):
- `needsCleaning`, `needsQuotation`, `needsRepair`.
- `isOnHold` + `holdSource` (`VESSEL_EXPORT`).
- `forkliftShiftTask`:
  - `NONE` ✅ / `HA_KE_GIAM_DINH` ✅
  - `HA_SUA_CHUA` ⚪

## 2. Tình trạng vỏ (`FieldConditionClass`) và Đóng hàng (`FieldStuffingClass`)

| Mã | Ý nghĩa | Dùng |
|---|---|---|
| `AV` | Vỏ tốt | ✅ |
| `DAMAGE` | Hư hỏng → Báo giá → Sửa chữa | ✅ |
| `W-SURVEY` | Chưa giám định, hạ kệ, giám định bổ sung sau (DEC-147) | ✅ |
| `M` / `K` / `E` | Phân loại đóng hàng | ✅ |

## 3. Hạ vỏ (`GateInStatus`)

| Mã | Ý nghĩa | Dùng |
|---|---|---|
| `FIELD_RECORDED` | Giám định đã gửi, chờ Văn phòng | ✅ |
| `PAYMENT_PENDING` | Văn phòng đã lập chứng từ, chờ thanh toán | ✅ |
| `GATE_IN_OK` | Đã thanh toán / xác nhận hợp lệ, in K80 | ✅ |
| `CANCELLED` | Đã hủy | ✅ (xóa hồ sơ chưa thao tác — DEC-059) |
| `OFFICE_VERIFIED` | Văn phòng đã kiểm tra, chưa lập chứng từ | ⚪ (Demo đi thẳng sang PAYMENT_PENDING) |

Loại Hạ vỏ (`GateInType`): `CUSTOMER_RETURN` ✅, `VESSEL_IMPORT` ✅ (Nhập tàu).

## 4. Cấp vỏ — lệnh (`GateOutOrder.status`) và Booking

| Mã | Ý nghĩa | Dùng |
|---|---|---|
| `PAYMENT_PENDING` | Đã lập lệnh, chờ thanh toán | ✅ |
| `PENDING_FORKLIFT` | Đã thanh toán / TTS, chờ Xe nâng cấp | ✅ |
| `GATE_OUT_OK` | Đã xuất bãi | ✅ |
| `CANCELLED` | Hủy lệnh (trả cont về bãi) | ✅ |

Loại Cấp vỏ (`GateOutType`):
- `EMPTY_RELEASE` ✅
- `VESSEL_EXPORT` ✅
- `SPECIAL_RETURN` ⚪

Booking: `OPEN` ✅, `FULLY_ALLOCATED` ✅, `COMPLETED` ✅, `CANCELLED` ✅.

## 5. Vệ sinh / Báo giá / Sửa chữa (`ServiceWorkOrder`)

Loại (`category`): `CLEANING` ✅, `INSPECTION` (= hàng chờ Báo giá) ✅, `REPAIR` ✅.

| `workStatus` | Ý nghĩa | Dùng |
|---|---|---|
| `OPEN` | Đang chờ làm | ✅ |
| `COMPLETED` | Đã xong | ✅ |
| `CANCELLED` | Hủy | ✅ |
| `IN_PROGRESS` | Đang làm | ⚪ |
| `REWORK_REQUIRED` | Phải làm lại (QC) | ⚪ — đã bỏ bước QC (DEC-049) |

| `approvalStatus` | Dùng |
|---|---|
| `NOT_REQUIRED` | ✅ |
| `PENDING_APPROVAL` | ✅ (ít) |
| `APPROVED` | ✅ |
| `REJECTED` | ⚪ |

## 6. Thanh toán

Chứng từ (`Voucher.status`):

| Mã | Ý nghĩa | Dùng |
|---|---|---|
| `PENDING` | Chưa thanh toán | ✅ |
| `CONFIRMED` | Đã thu / đã trừ phiếu trả trước | ✅ |
| `DEFERRED` | Thanh toán sau (TTS — công nợ) | ✅ |
| `FAILED` | Thất bại | ✅ |
| `CANCELLED` | Hủy | ✅ |
| `REFUNDED` | Đã hoàn tiền | ⚪ — chờ OPEN-008 (quy trình hoàn tiền) |

Giao dịch (`PaymentTransactionStatus`): `PENDING`, `SUCCEEDED`, `FAILED`, `CANCELLED` ✅.

Hình thức (`PaymentCategory`): `TTTT` (TRỰC TIẾP — hiển thị TT), `TTT` (TRẢ TRƯỚC — TTR), `TTS` (THANH TOÁN SAU).

Phương thức trực tiếp: `CASH`, `BANK_TRANSFER_API`.

Phiếu thu trả trước (`MasterPrepaidReceipt.status`): `PENDING_PAYMENT`, `ACTIVE`, `EXHAUSTED`, `CANCELLED` ✅.

Mục đích phiếu thu (`purpose`): `VOUCHER`, `PREPAID_TOPUP` ✅.

## 7. Hóa đơn (`InvoiceStatus`)

| Mã | Hiển thị | Dùng |
|---|---|---|
| `CHUA_XHD` | CHƯA XHD | ✅ |
| `YEU_CAU_XHD` | YÊU CẦU XHD (khách gửi) | ✅ |
| `DA_XHD` | ĐÃ XHD (Kế toán) | ✅ |

Yêu cầu hóa đơn theo lượt (`invoiceGroups.status`): `YEU_CAU_XHD`, `DA_XHD`.

## 8. Nhập tàu / Xuất tàu

- Danh sách (`VesselListStatus`): `OPEN` ✅, `APPROVED` ✅.
- Loại (`VesselMode`): `NHAP_TAU`, `XUAT_TAU`.

| Cont trong danh sách (`VesselItemStatus`) | Ý nghĩa | Dùng |
|---|---|---|
| `PENDING` | Chưa tác nghiệp | ✅ |
| `INSPECTED` | NT: Giám định xong, chờ hạ | ✅ |
| `DONE` | NT đã hạ bãi / XT đã xuất | ✅ |
| `SKIPPED` | Duyệt khi chưa đủ — gạch đi (DEC-131) | ✅ |

## 9. Lịch sử vị trí (`LocationActionType`)

- Dùng ở Demo: `INITIAL_BLOCK` ✅, `DETAIL_SLOT_UPDATE` ✅, `YARD_SHIFT` ✅ (Đảo chuyển), `GATE_OUT_CLEAR` ✅.
- Chưa dùng: `YARD_MOVE` ⚪, `SHIFT_REPAIR` ⚪, `SHIFT_INSPECTION_RACK` ⚪.

## 10. Góp ý (`FeedbackStatus`)

`MOI` ✅, `DANG_XU_LY` ✅, `DA_XU_LY` ✅, `KHONG_AP_DUNG` ✅ (Admin chọn khi phản hồi — `FEEDBACK_STATUS_LABELS`).

## Cần người dùng duyệt

1. Đồng ý toàn bộ mã ✅ như trên.
2. Các mã ⚪: **bỏ** hay **giữ**?
   - `PENDING_GATE_IN`, `OFFICE_VERIFIED`
   - `SPECIAL_RETURN`
   - `IN_PROGRESS`, `REWORK_REQUIRED`, `REJECTED`
   - `REFUNDED`
   - `HA_SUA_CHUA`
   - `YARD_MOVE`, `SHIFT_REPAIR`, `SHIFT_INSPECTION_RACK`
