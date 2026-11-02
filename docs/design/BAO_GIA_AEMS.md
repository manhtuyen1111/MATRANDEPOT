# Báo giá theo AEMS Maersk — phân tích ảnh (người dùng gửi 2026-11-02)

> Trạng thái: **ĐỀ XUẤT — CHƯA CODE.** Danh mục mã đã có (DEC-206 — Danh mục chung → Sửa chữa → CODE CEDEX).
> Mục tiêu người dùng: **nối tình trạng Giám định (eEIR) sang Báo giá / Sửa chữa**.

## 1. AEMS (Advanced Equipment Maintenance System) — màn Work Orders

- Danh sách: Work Order Number • Equipment Number • Total Value (USD) • Total Value (Shop Currency, VND) • **Mode** (03 / 23…) • Status (Draft, Rejected, Declared as TTL, **Pending Approval**, **Suspend for TTL check**, **Approved**…) • Status Duration • Created On / By • Shop ID (3HY) • Location (VNHPHVI).
- Tạo phiếu (Create Single):
  - Đầu phiếu: **Shop Code** (3HY MATRAN) • **Equipment Number** • **Mode** (VD `03 REPAIRS, STEEL DRY CONTAINER IN SERVICE`) • Vendor Ref No. (tùy chọn) • **Cause** (VD `1 - Wear And Tear`) • tiền tệ VND.
  - **Equipment Details** (Maersk tự điền theo số cont): Type DRY/CONT • In Service • Production Year • Profile • Size 40/9'6" • PTI Date • Damage • **Grade Code** (E) • Material STL • Shop Location VNHPHVI • CurrMove GATE-IN • For Sale • Container/PTI Status • Owner • Leasing Company / Contract • On Global Hunt • Gate In Date • Present Location • At Off Hire Loc • Empty.
  - **Attachments**: tối đa 20 file (ảnh / pdf / doc), ≤ 5 MB / file.
  - **Dòng sửa chữa** (Add repair item), mỗi dòng: **Damage Code** (BR, CU…) • **Repair Code** (0912, 6620…) • **Repair Loc code** (= vị trí CEDEX: IXXX, BR5N…) • **TPI** (W = hao mòn / T = bên thứ 3) • **Pcs** • **Man Hrs/pc** • **Material cost/pc** • Item Total • Images.
  - Giờ công: **Ordinary Hours** • OT1 • OT2 • OT3 • **Preparation Time** (VD 0.1) • **Total Man Hours**.
  - **Calculation Summary** (USD + VND): Total Labor Cost • Total Material Cost • Total Part Cost • **Responsibility Code Totals** (Wear and Tear / Third Party) • Total cost excluding / including Tax/VAT.
  - Ghi chú 0/255 ("general condition of box, main damage, wear and tear share…"). Nút Save as draft / Submit.

## 2. Đối chiếu số liệu ảnh với bảng mã (DEC-206)

- Đơn giá giờ công = dòng **DR001 "Man hour rate for dry repair"** (Material Rate 28,000): 0.9 giờ × 28,000 = **25,200** = Total Labor Cost ✅.
- **Preparation Time** lấy từ các dòng DR002 → DR006 ("PREPARATION — FOR TOTAL REPAIR TIME …" theo khoảng tổng giờ sửa): ảnh 0.8 giờ sửa → chuẩn bị 0.1 → tổng 0.9.
- Item Total = Pcs × Material cost/pc (dòng CU 6620 BR5N: 1 × 6,000) → Total Material Cost 6,000; TPI T → cộng vào Third Party.

## 3. Ánh xạ sang MATRAN

| AEMS | MATRAN hiện có | Ghi chú |
|---|---|---|
| Repair Loc code | vị trí CEDEX Giám định chọn trên lưới (DEC-203) | có sẵn cho chỗ hư bên thứ 3 |
| TPI W / T | Hao mòn / Hư bên thứ 3 (eEIR) | Giám định đã phân loại |
| Damage Code | **MÃ HƯ HỎNG** (DEC-206) | eEIR dùng loại hư 1–16 (Maersk) — cần bảng đổi loại hư eEIR → Damage Code AEMS |
| Repair Code + Mode | **MÃ SỬA CHỮA** (DEC-206) | Báo giá chọn theo dòng hư |
| Man Hrs/pc, Material cost/pc | Fixed man hour + Material Rate của mã sửa chữa | tự điền, sửa được? |
| Equipment Details | khung "Lấy thông tin từ hãng tàu" (DEC-204) | khi có khóa API |
| Total Labor | giờ công × đơn giá DR001 | MATRAN đang có giờ công Báo giá (DEC-086) + bậc thợ (DEC-173) |

## 4. Cần người dùng chốt trước khi code

1. Báo giá MATRAN **thay hẳn** bằng dạng dòng AEMS (Damage / Repair / Loc / TPI / Pcs / giờ / vật liệu) cho cont MSK, hay giữ màn cũ + thêm khối AEMS?
2. Mỗi chỗ hư Giám định (bên thứ 3) **tự tạo 1 dòng** Báo giá (Loc + TPI T sẵn) để Báo giá chọn Damage Code + Repair Code? Hao mòn (W) có tạo dòng không?
3. Preparation Time: **tự tính** theo bảng DR002 → DR006 hay Báo giá nhập tay?
4. OT1 / OT2 / OT3: có dùng không, đơn giá thế nào?
5. Tiền: chỉ VND, hay cần cả USD (tỷ giá lấy đâu)? VAT bao nhiêu?
6. Trạng thái phiếu (Draft / Pending Approval / Approved / Rejected / Suspend for TTL check) — MATRAN có theo dõi trạng thái duyệt của Maersk không (nhập tay hay API)?
7. Có gửi phiếu sang AEMS qua API không (cần tài liệu API AEMS), hay Báo giá vẫn nhập tay trên AEMS và MATRAN chỉ lưu bản tính?
