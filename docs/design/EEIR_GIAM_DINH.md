# Thiết kế màn GIÁM ĐỊNH theo eEIR Maersk (Hạ vỏ → sau đó Cấp vỏ)

> Nguồn: **Electronic EIR v3.3 User Guide** (app eEIR của Maersk, người dùng gửi 2026-11-01) + **eEIR External API v4.3** (`docs/EDI_MAERSK.md` mục 12, 19).
> Phạm vi: chỉ cont **MSK loại DRY** (DEC-201). Hãng khác / loại khác giữ màn Giám định hiện tại.
> Trạng thái: **ĐỀ XUẤT — chờ người dùng chốt mục 5** rồi mới code.

## 1. Luồng app eEIR Maersk (User Guide trang 7) và cách MATRAN làm theo

| # | App eEIR Maersk | MATRAN — Giám định Hạ vỏ (cont MSK DRY) |
|---|---|---|
| 1 | Chọn Operator (Maersk / Other) | Chọn **hãng tàu** (đã có, mặc định hãng Ưu tiên — DEC-166). MSK + DRY → bật form eEIR |
| 2 | Nhập số container (có OCR) | **Nhập / quét số container** (`ScanField`) — bắt buộc với cont MSK (mục 5 câu 1) |
| 3 | Lấy Container Details + eEIR cũ (≤ 7 ngày) | Khung **THÔNG TIN MAERSK** (API 1) — khi có khóa; chưa có khóa / lỗi → báo "Không lấy được thông tin Maersk", làm tiếp |
| 4 | Capture gate move details | Tự có: IN (Hạ vỏ) / OUT (Cấp vỏ) — không phải chọn |
| 5 | **Capture damage details** (3 mục) | **Màn TÌNH TRẠNG / HƯ HỎNG** — mục 2 bên dưới |
| 6 | Capture trucker details | Lấy từ Văn phòng (số xe, SĐT). Giám định không nhập lại |
| 7 | Capture email | Cấu hình chung (email depot nhận PDF — Q-060) |
| 8 | Preview eEIR + chữ ký lái xe | **Màn XEM LẠI** trước khi gửi (bước 3 hiện có) + ghi chú (≤ 255 ký tự). Chữ ký: mục 5 |
| 9 | Submit (online / offline) | Lưu như hiện nay (hàng chờ đồng bộ); phiếu eEIR sinh **sau khi Văn phòng GATE IN OK** (đủ số xe, booking) |

## 2. Màn TÌNH TRẠNG / HƯ HỎNG (User Guide trang 16–18) — chia đúng 3 mục

```
┌ GIÁM ĐỊNH HẠ VỎ — MSKU1234565  •  40DC (40DRY 45G1) ─────┐
│ THÔNG TIN MAERSK  (API 1 — khi có khóa)                   │
│  Năm SX 2019 • Hạng E • Sở hữu OWN                        │
│  ⚠ Cấm dùng (Do not move/use) / Đánh dấu bán / Trả hãng  │
├────────────────────────────────────────────────────────────┤
│ 1. KHÔNG HƯ                    [ + THÊM ẢNH ]   ảnh 0/10  │
│ 2. HAO MÒN (Wear & Tear)       [ + THÊM ẢNH ]   ảnh 0/20  │
│ 3. HƯ DO BÊN THỨ 3 / XẾP DỠ (3P & Handling)               │
│    [+] Cửa (D)            0     [+] Mặt trước (F)     0    │
│    [+] Vách trái (L)      2     [+] Vách phải (R)     0    │
│        • LT89  Bẩn (Dirty)            [X]                 │
│        • LB34  Móp (Dented)           [X]                 │
│    [+] Nóc (T)            0     [+] Khung đáy (U)     0    │
│    [+] Sàn (B)            0                                │
├────────────────────────────────────────────────────────────┤
│                 [ TIẾP TỤC ]                               │
└────────────────────────────────────────────────────────────┘
```

- **Không hư:** 1–10 ảnh (app Maersk cho tối đa 10). Ảnh cửa cont (bắt buộc hiện nay — DEC-182) là ảnh đầu tiên.
- **Hao mòn:** 1–20 ảnh, không cần mô tả chi tiết.
- **Bên thứ 3 / xếp dỡ:** 7 mặt **D Cửa • F Mặt trước • L Vách trái • R Vách phải • T Nóc • U Khung đáy • B Sàn**; mỗi mặt bấm [+] mở **màn CHI TIẾT HƯ** (mục 3); danh sách hư hiện dưới từng mặt kèm số đếm; xóa bằng nút [X] (app Maersk vuốt trái).
- Không mục nào bắt buộc riêng, nhưng **phải có ít nhất 1 ảnh** ở 1 trong 3 mục (eEIR bắt buộc ≥ 1 ảnh).
- **Gắn với AV / DAMAGE hiện có** (mục 5 câu 2): có ≥ 1 chỗ hư bên thứ 3 → DAMAGE; chỉ Không hư / Hao mòn → AV.

## 3. Màn CHI TIẾT HƯ (User Guide trang 17) — mỗi chỗ hư 1 lần

```
┌ Vách trái (L) ─────────────────────────────┐
│ [ Sơ đồ mặt L — chọn ô hư ]  (mục 5 câu 3) │
│ Vị trí hư (CEDEX)   L T 8 9   ← tự điền     │
│ Loại hư *           [ 5 Móp (Dented)  ▾ ]   │
│ Mô tả               [ ............... ]     │
│ Bên gây hư *        [ Khách hàng ▾ ]        │
│ Ảnh chỗ hư * (1–3)  [📷] [📷] [📷]          │
│                 [ LƯU ]                     │
└─────────────────────────────────────────────┘
```

- **Loại hư (16 mã — API v4.3 6.1.2):** 1 Bẩn (Dirty) • 2 Gãy / nứt toác (Broken/Split) • 3 Rách / cắt (Cut) • 4 Gỉ sét (Corroded/Rusty) • 5 Móp (Dented) • 6 Mất (Missing/Lost) • 7 Lỏng (Loose) • 8 Hao mòn (Wear and Tear) • 9 Vết dầu (Oil Stains) • 10 Nhãn / ký hiệu (Markings/Labels) • 11 Nứt (Cracked) • 12 Rác / hư (Debris/Damage) • 13 Cong (Bowed) • 14 Bong tách (Delaminated) • 16 Khác (Others).
- **Bên gây hư (4):** 1 Lái xe (Trucker) • 2 Khách hàng (Customer) • 3 Xếp dỡ (Handling) • 4 Không rõ (Unknown).
- **Ảnh:** 1–3 ảnh mỗi chỗ hư (API v4.3), chụp bằng `PhotoCamera`, nén < 200 KB (DEC-176).
- Gửi Maersk: `damageLocation` (4 ký tự), `panelIndicatorCode` (chữ đầu), `damageType`, `damageCarrierCode`, `tpIndicator` 2, `isDamage` true, ảnh (tên không đuôi, chữ / số / gạch dưới).

## 4. Màn XEM LẠI (User Guide trang 22) — trước khi gửi

Số cont, hãng, size / type (ISO), năm SX, hạng Maersk • tóm tắt 3 mục hư + số ảnh • Phân loại / Vệ sinh / AGE (giữ của MATRAN) • **Ghi chú** (≤ 255 ký tự — trường `comments`) • nút XÁC NHẬN.

## 5. Cần người dùng chốt trước khi code

1. **Số container** với cont MSK: Giám định **bắt buộc nhập / quét** ở bước đầu (để tra Maersk + làm eEIR) — hiện tại chỉ Văn phòng nhập.
2. **AV / DAMAGE**: tự suy từ 3 mục (có hư bên thứ 3 → DAMAGE) hay Giám định vẫn chọn AV / DAMAGE như cũ.
3. **Vị trí CEDEX**: app Maersk chọn trên **sơ đồ lưới** từng mặt (VD `LT89`, `DB2N`, `LB34`) — MATRAN cần **bảng lưới CEDEX** (hàng, cột từng mặt) để vẽ đúng. Chưa có bảng → tạm: chọn mặt (chữ đầu tự điền) + gõ 3 ký tự còn lại.
4. **Chữ ký lái xe** trên điện thoại Giám định (app Maersk có, API không bắt buộc): làm hay bỏ.

## 5b. Đối chiếu ảnh app eEIR thật (người dùng gửi 2026-11-01, 18 ảnh)

| Màn app | Nội dung | MATRAN |
|---|---|---|
| Container Search | Cont Type/Size `40DRY 45G1`, Production Year, Global Hunt Flag, Redelivery Loc, Marked For Sale, **Grade (sửa được — bút chì)**, Do not move/use, Sound, Ownership Type, Sub-sub Code, Container Warranty | khung Thông tin Maersk — khi có khóa API 1 |
| Moves | Last Move / Last Location (API 1); **Current Move** chọn (VD `IN-EMPTY-IMPORT_RETURN`); Booking No. (gợi ý 9 số); Commodity; Brand; Seal Number (Full Containers) | Hạ vỏ = IMPORT_RETURN (IMP) ✅; booking / seal: chưa |
| Damage Report | No Damage • Wear & Tear • **Floor Cleaning** • 3P & Handling **11 mặt** (D F L R T U B **E I N X**) | ✅ 3 phần + 11 mặt; Floor Cleaning: không làm mục riêng |
| No Damage / Wear & Tear Images | "You can add **20** more Images" | ✅ 20 |
| Floor Cleaning | **Cleaning needs** (mặc định Not required), 1 ô ảnh, Damage type = Dirty (cố định), Description 0/255 | **Không làm mục riêng** (người dùng 2026-11-01): ảnh sàn bẩn ghi ở mặt Sàn (B), loại Bẩn; nhu cầu vệ sinh theo mục Vệ sinh MATRAN |
| Chi tiết mặt D / F | lưới **4 cột** (hẹp – rộng – rộng – hẹp) × **4 hàng** (mỏng – cao – cao – mỏng) | ✅ lưới chạm chọn (hàng H/T/B/G hoặc L/R, nhiều hàng = X; cột 1…0; 40' 10 ô / 20' 5 ô) |
| Chi tiết mặt L / R | lưới **10 cột × 4 hàng** | ✅ lưới chạm chọn (hàng H/T/B/G hoặc L/R, nhiều hàng = X; cột 1…0; 40' 10 ô / 20' 5 ô) |
| Chi tiết mặt T / U / B | lưới **10 cột × 2 hàng** | ✅ lưới chạm chọn (hàng H/T/B/G hoặc L/R, nhiều hàng = X; cột 1…0; 40' 10 ô / 20' 5 ô) |
| Chi tiết mặt E / I / N | không lưới, vị trí `EXXX` / `IXXX` / `NXXX` | ✅ |
| Chi tiết chung | Damage location (tự điền) • Damage type (mặc định Dirty) • Description 0/255 • Damage source (mặc định Customer) • 3 ô ảnh • Save | ✅ |
| Trucker Details | Name • EDI Carrier Code • Company Name • **Vehicle Registration No.*** • Contact Number • Contact Email | lấy từ Văn phòng (số xe, SĐT) |

## 6. Lưu ý cho eEIR API sau này

- Trùng phiếu: Maersk tự gộp phiếu cùng cont / cùng shop trong **7 ngày** (User Guide trang 24) — MATRAN chỉ gửi 1 phiếu / lượt; thêm ảnh sau dùng API 3.
- Offline: MATRAN đã có hàng chờ đồng bộ — phiếu eEIR vào hàng chờ gửi, lỗi thì gửi lại (API v4.3 mục 8).
- Cấp vỏ (DEC-198) dùng **cùng khối Tình trạng / Hư hỏng** (`EeirDamageFields`), gate move OUT.
- Thiết lập shop (User Guide trang 10–11): **Shop code 3HY**, **RKEM location code** (7–8 ký tự — cần người dùng cung cấp), email shop, EDI carrier code của nhà xe — để ở cấu hình máy chủ / Danh mục, không viết cứng.
