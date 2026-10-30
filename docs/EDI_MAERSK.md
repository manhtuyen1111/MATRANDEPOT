# EDI hãng tàu — MAERSK (CODECO)

> Trạng thái: **ĐANG THU THẬP DỮ LIỆU** (OPEN-009). Chưa viết code gửi EDI. Tài liệu này ghi những gì đã biết từ file mẫu của app cũ (ERPVINASHIP) + thiết kế đề xuất. Khi đủ thông tin ở mục 9 → chốt DEC, rồi mới làm.
>
> Liên quan: `DECISIONS.md` (DEC-027 / 033 / 034 cấp vỏ, DEC-069 nhập / xuất tàu, DEC-166 phân loại đóng hàng, DEC-185 / 192 đổi container, **DEC-194 Release for sale**), `BUSINESS_WORKFLOWS.md`, `DATABASE_SCHEMA.md`, `DATABASE_PLATFORM_ADVICE.md`, `OPEN_QUESTIONS.md` (Q-046 → Q-055).

## 1. Mục tiêu

- Mỗi lần container **vào / ra bãi** của hãng **MSK (Maersk)**, hệ thống tự gửi báo cáo **CODECO** cho Maersk — thay việc ERPVINASHIP đang làm.
- Gửi qua **1 trong 2 kênh**: **SFTP** hoặc **Gmail** (đính kèm file). Kênh cấu hình được, không sửa code.
- Theo dõi được: file nào gửi lúc nào, gồm cont nào, thành công / lỗi, gửi lại được; cảnh báo trước khi trễ / lỗi.

## 2. App cũ đang làm gì (từ file mẫu 30/10/2026)

- Mỗi **giờ :00** tạo 1 file `yyyyMMddHHmm.txt` (VD `202610300400.txt`) chứa các lượt ra / vào **trong giờ trước đó** (file 04:00 chứa lượt 03:02 → 03:59).
- Tải file lên FTP (log: `Thời gian UPLOAD FTP: 30/10/2026 04:00 file đính kèm: D:\ERPVINASHIP\Debug\EDI_MSK\202610300400.txt`).
- File 00:00 → 03:00 có trong log nhưng **chưa có mẫu** (chưa rõ giờ không có cont thì có gửi file rỗng không — Q-049).

## 3. Cấu trúc file (UN/EDIFACT D.95B — CODECO, ITG14 của Maersk)

Mỗi file = 1 phong bì (`UNB … UNZ`); mỗi container = 1 tin (`UNH … UNT`).

```
UNB+UNOA:1+VNHPHVI+MAEU+261030:0400+202610300400'      ← phong bì: bãi gửi → Maersk, ngày giờ, mã tham chiếu = tên file
UNH+1+CODECO:D:95B:UN:ITG14'                              ← tin số 1, loại CODECO
BGM+36+202610300400-1'                                    ← 36 = GATE-OUT (34 = GATE-IN); mã tin = mã file + số thứ tự
NAD+CF+MSK'                                               ← hãng tàu
GID+1'
EQD+CN+SUDU7780021+2200:102:5++2+4'                       ← số cont, mã ISO size/type, 2 = xuất khẩu (chỉ gate-out), 4 = rỗng
RFF+BN:280453398'                                         ← gate-out: SỐ BOOKING; gate-in: GRADE + chữ (GRADED / GRADEK / GRADEM)
DTM+7:202610300351:203'                                   ← giờ thực tế (yyyyMMddHHmm)
LOC+165+VNHPHVI:139:6+HPHVI:TER:ZZZ'                      ← mã bãi (cố định)
DAM+1+2'                                                  ← chỉ gate-in: 2 (đi với GRADED) / 6 (đi với GRADEK, GRADEM)
TDT+1++3++HPHTRK:172:20'                                  ← đường bộ, mã xe chung (không có biển số)
CNT+16:1'                                                 ← 1 container
UNT+11+1'                                                 ← số dòng của tin (11 gate-out / 12 gate-in), số tin
UNZ+15+202610300400'                                      ← tổng số tin trong file
```

### 3.1 Bảng ánh xạ sang dữ liệu MATRAN DEPOT

| Dòng EDI | Gate-in (BGM 34) | Gate-out (BGM 36) | Lấy từ hệ thống | Đã chắc? |
|---|---|---|---|---|
| `NAD+CF` | MSK | MSK | Hãng tàu của cont (Danh mục, mã MSK) | ✓ |
| `EQD` số cont | ✓ | ✓ | `containerNo` | ✓ |
| `EQD` size/type | 2200 / 4200 | 2200 / 4200 | `size` + `type` → bảng mã ISO (20DC = 2200, 40DC = 4200; **40HC / 45HC / RF chưa có mẫu** — Q-047) | một phần |
| `EQD` …`++2` | không có | có (xuất khẩu) | cố định theo loại tin | ✓ |
| `RFF+BN` | `GRADE` + hạng | số booking | gate-in: hạng vỏ (Q-048); gate-out: `bookingNo` lệnh Cấp vỏ | gate-out ✓ |
| `DTM+7` | giờ vào | giờ ra | gate-in: giờ GATE IN OK? / Xe nâng hạ? (Q-051); gate-out: giờ Xe nâng cấp (`confirmedAt`) | chưa |
| `DAM+1+…` | 2 / 6 | không có | DAMAGE / AV? (Q-048) | chưa |
| `LOC`, `TDT`, mã gửi `VNHPHVI`, mã nhận `MAEU` | cố định | cố định | cấu hình EDI của hãng | ✓ (lấy từ mẫu) |

### 3.2 Ghi nhận từ dữ liệu mẫu

- Có cont **hạ rồi cấp ra ngay**: MRSU6421317 hạ 05:21 → cấp 05:22 (cùng file 06:00); TRHU4951840 hạ 05:57 (file 06:00) → cấp 06:03 (file 07:00); MRSU3056416 hạ 03:44 → cấp 07:04. → Trong 1 file, **gate-in phải đứng trước gate-out** của cùng cont; giữa 2 file thì theo giờ.
- Số tin mỗi giờ: 4 → 16; một ngày cỡ 100–300 tin — nhẹ, không cần lo tải.

### 3.3 Release for sale (cấp sale) — từ file mẫu `202610291500.txt` (người dùng gửi 2026-10-30, cont PONU1771369)

```
BGM+36+202610291500-2'                     ← vẫn là GATE-OUT (36)
NAD+CF+MSK'
GID+1'
EQD+CN+PONU1771369+4200:102:5++8+4'        ← khác cấp thường: trạng thái 8 (cấp thường = 2), 4 = rỗng
RFF+BN:SALEO26VN51'                        ← ô BOOKING ghi SALE CODE (cấp thường = số booking)
DTM+7:202610291416:203'
LOC+165+VNHPHVI:139:6+HPHVI:TER:ZZZ'
TDT+1++3++HPHTRK:172:20'
CNT+16:1'
UNT+11+2'                                  ← 11 dòng như cấp thường, không có DAM
```

- **Cấp sale = gate-out (36) + `EQD …++8+4` + `RFF+BN:<Sale code>`.** Ánh xạ MATRAN: lệnh Cấp vỏ `releasePurpose = SALE` (DEC-194) → `RFF+BN` lấy **`saleCode`**, `EQD` trạng thái **8**; cấp thường (`CUSTOMER`) → booking + trạng thái **2**.
- Mẫu Sale code: `SALEO26VN51` (11 ký tự, chữ + số).
- File 15:00 có **48 cont sale cùng 1 Sale code, cùng giờ 14:16** (cấp cả lô) + 3 gate-out thường + 1 gate-in → 1 file có thể tới 50+ tin, bình thường.
- Gate-in trong file này: `MRSU0011444 2200 … GRADEK DAM+1+6` — giống mẫu trước.

## 4. Sự kiện cần gửi (tác nghiệp → EDI)

| Tác nghiệp MATRAN | Khi nào ghi sự kiện | Loại tin | Ghi chú |
|---|---|---|---|
| **Hạ vỏ** (cont MSK) | GATE IN OK (hoặc lúc Xe nâng hạ — Q-051) | Gate-in (34) | hạng vỏ theo Giám định |
| **Cấp vỏ — Release for customer** | Xe nâng cấp xong (GATE_OUT_OK) | Gate-out (36) | `RFF+BN` = booking |
| **Cấp vỏ — Release for sale** (DEC-194) | Xe nâng cấp xong | Gate-out (36) | ✓ đã có mẫu (mục 3.3): `EQD …++8+4`, `RFF+BN:<Sale code>` |
| **Xuất tàu** (DEC-069) | Xe nâng xuất (cont OUT ra cảng) | Gate-out? | người dùng xác nhận cần gửi; mã / booking dùng gì — Q-050 |
| **Nhập tàu** (DEC-069) | Xe nâng hạ (cont vào bãi) | Gate-in? | chưa xác nhận có gửi không — Q-050 |
| **Đổi container sau khi đã lên xe** (DEC-185) | Văn phòng đổi | **Hủy / sửa** gate-out cont cũ (nếu đã gửi) + gate-out cont mới khi Xe nâng cấp | app cũ xử lý thế nào — Q-052 |
| **Đổi container chưa nâng hạ** (DEC-192) | — | không gửi gì thêm (chưa có gate-out) | |
| Hủy lệnh cấp (chưa thu tiền) | — | không gửi (chưa ra bãi) | |

**Dữ liệu đã có sẵn trong hệ thống:** số cont, size / type, hãng, booking, giờ gate in / gate out, AV / DAMAGE, phân loại M / K / E (DEC-166), tác nghiệp Release for customer / sale + Sale code (DEC-194), đổi container (`swaps`). Thiếu: **bảng mã ISO đầy đủ, ý nghĩa GRADE / DAM, quy tắc tin hủy / sửa**.

## 5. Thiết kế đề xuất

```
Hạ vỏ GATE IN OK ─┐
Cấp vỏ / sale OUT ├─► database tự ghi 1 dòng edi_events (PENDING) — trong cùng giao dịch với tác nghiệp
Xuất tàu OUT ─────┘   (không phụ thuộc giao diện; thiếu dữ liệu → trạng thái THIẾU DỮ LIỆU)
        │ mỗi giờ :00 (tác vụ định kỳ)
        ▼
Gom sự kiện PENDING của giờ trước (theo giờ thực tế, gate-in trước gate-out)
→ tạo file CODECO đúng mẫu → lưu edi_batches (nội dung file, tên file, số tin)
→ gửi qua kênh của hãng (SFTP / Gmail) → ĐÃ GỬI / LỖI (lưu thông báo lỗi)
→ lỗi: tự gửi lại 3 lần (5 / 15 / 30 phút) → vẫn lỗi → cảnh báo đỏ
```

### 5.1 Bảng dữ liệu (dự kiến — viết migration khi chốt)

| Bảng | Nội dung chính |
|---|---|
| `edi_partners` | Hãng (MSK), mã gửi `VNHPHVI`, mã nhận `MAEU`, `LOC` / `TDT` cố định, kênh (SFTP / GMAIL), địa chỉ / thư mục / người nhận, lịch gửi, bật / tắt, **chế độ CHẠY THỬ (không gửi)**. **Không** lưu mật khẩu / khóa ở đây. |
| `edi_size_type_map` | size + type → mã ISO (2200, 4200, …) theo hãng |
| `edi_events` | container, lượt lưu bãi, lệnh, loại tin, giờ thực tế, booking / sale code / grade, trạng thái PENDING / SENT / ERROR / CANCELLED / MISSING_DATA, `batch_id` |
| `edi_batches` | tên file, nội dung file, số tin, kênh, giờ tạo / gửi, kết quả, số lần thử, lỗi |

### 5.2 Gửi file — nơi chạy

| Kênh | Đề xuất | Ghi chú |
|---|---|---|
| **Gmail** | Gmail API hoặc SMTP bằng **mật khẩu ứng dụng** (App Password) | Dễ nhất. Phải kiểm tra Supabase Edge Function có mở được cổng SMTP — nếu không, chạy ở máy chủ Node (dưới). |
| **SFTP** | Hàm Node nhỏ (VD Vercel Cron + `ssh2-sftp-client`) gọi database lấy file → đẩy SFTP → báo kết quả | Edge Function (Deno) có thể không kết nối cổng 22 — thử trước khi chốt. |

- **Thông tin đăng nhập SFTP / Gmail do người dùng giữ**, đặt ở biến môi trường máy chủ (Vercel / Supabase secrets). Agent không cầm, không đưa vào app / git (AGENTS mục 3).
- Chạy song song ERPVINASHIP trong giai đoạn thử để đối chiếu.

### 5.3 Màn theo dõi (đề xuất)

- **Danh mục chung → EDI** (Admin) hoặc **Văn phòng → EDI** (Q-054):
  - **Danh sách file**: giờ, tên file, hãng, số cont, kênh, trạng thái ✓ / ✗ (icon), Xem nội dung, Tải file, **Gửi lại**; lọc thời gian (DateRangeFilter), phân trang (DEC-080), 1 dòng / file.
  - **Sự kiện**: cont, loại tin, giờ, file đã gửi, trạng thái; lọc THIẾU DỮ LIỆU / LỖI.
  - **Cấu hình hãng**: bật / tắt, chạy thử, kênh, mã cố định, bảng size/type.
- **Hồ sơ container → Lịch sử hồ sơ**: thêm dòng bộ phận **EDI** (Gửi gate-in / gate-out — file, giờ, trạng thái).
- **Cảnh báo trước** (gắn DEC-189 Database / số đỏ trên menu): quá 1 giờ chưa gửi được; có file lỗi; có sự kiện THIẾU DỮ LIỆU.

## 6. Triển khai 3 bước

1. **Chạy thử, không gửi** (`edi_partners.dry_run`): mỗi giờ tạo file, so từng tin với file ERPVINASHIP cùng giờ (số cont, loại tin, booking, size/type, grade, giờ). Lệch → sửa ánh xạ.
2. **Gửi thử**: tới hộp thư / thư mục thử (nếu Maersk có) hoặc gửi cho chính depot.
3. **Chuyển hẳn**: tắt EDI ở ERPVINASHIP → bật gửi thật ở MATRAN → theo dõi 1–2 tuần (màn EDI + cảnh báo).

## 7. Bảo mật

- Không lưu mật khẩu SFTP / Gmail trong database / frontend / git — chỉ ở biến môi trường máy chủ do người dùng tạo.
- File EDI chỉ có dữ liệu container (không tên khách, không tiền) — vẫn chỉ Admin / Văn phòng xem.
- Nhật ký gửi giữ lâu dài (đối chiếu với hãng khi có tranh chấp).

## 8. Liên quan nghiệp vụ đã có

- **DEC-194 — Release for sale**: Văn phòng → Cấp vỏ chọn Tác nghiệp (mặc định Release for customer); Release for sale bắt buộc Sale code. Lưu ở lệnh cấp (`releasePurpose`, `saleCode`) — sẵn cho EDI.
- **DEC-185 / 186 / 192 — Đổi container**: lệnh giữ mã CV-, đổi số cont; `swaps` ghi cont cũ / mới, đã / chưa nâng hạ → dùng để quyết định có gửi tin hủy / sửa.
- **DEC-166 — Phân loại đóng hàng M / K / E theo hãng**: có thể chính là GRADE (Q-048).

## 9. Cần bổ sung trước khi làm (câu hỏi — chi tiết ở `OPEN_QUESTIONS.md`)

| Mã | Cần gì |
|---|---|
| Q-046 | **Tài liệu ITG14 (CODECO) của Maersk** hoặc tài liệu / mã nguồn module EDI của ERPVINASHIP |
| Q-047 | Bảng mã ISO size/type đầy đủ (40HC, 45HC, RF, OT, FR…) |
| Q-048 | Ý nghĩa GRADE D / K / M (/ E?) và `DAM+1+2` / `DAM+1+6`; lấy từ đâu khi Giám định |
| Q-049 | File giờ không có cont: có gửi file rỗng không; file 00:00 → 03:00 mẫu |
| Q-050 | Release for sale / Xuất tàu / Nhập tàu gửi loại tin gì, `RFF` gì (Sale code, tên tàu?) — gửi file mẫu |
| Q-051 | Giờ ghi `DTM+7`: giờ xe vào cổng / Văn phòng GATE IN OK / Xe nâng hạ — app cũ lấy giờ nào |
| Q-052 | Tin hủy / sửa (đổi container sau khi đã gửi gate-out, nhập sai): app cũ làm thế nào, có file mẫu không |
| Q-053 | Kênh gửi: SFTP (máy chủ, cổng, thư mục, đăng nhập mật khẩu hay khóa) hay Gmail (gửi tới đâu, tiêu đề, đính kèm); Maersk có trả xác nhận / báo lỗi không |
| Q-054 | Ai xem / gửi lại EDI: Admin hay cả Văn phòng |
| Q-055 | Lượt nhập muộn (VD hạ 03:50, 04:10 mới nhập): đưa vào file giờ nào; Maersk có chấp nhận gửi trễ / trùng không |

## 10. API Maersk (người dùng gửi 2026-10-30) — có thay được EDI không?

Tài liệu nhận được: **API License Terms** (sửa 31/08/2026) + OpenAPI **Empty Container Assignment API** (`container-export-steering`, v1.0.0).

**Kết luận: CHƯA thay được EDI CODECO.** API này chỉ lo phần **chọn cont rỗng cho booking (trước khi cấp vỏ)**, không có lệnh báo gate-in / gate-out.

| Endpoint | Việc | Dùng ở MATRAN |
|---|---|---|
| `GET …/maintenance-shops/{shop}/booking-equipment` | Danh sách booking giao cho depot | Văn phòng → Cấp vỏ: gợi ý booking |
| `GET …/bookings/{booking}` | Chi tiết booking: số cont cần theo loại (DRY / REEF, 20 / 40, 8'6 / 9'6), đã gán bao nhiêu, nơi giao hàng, cont gợi ý | kiểm tra booking + số lượng (thay tự đếm — Q-043) |
| `POST …/bookings/{booking}/equipment/{cont}/assignment-audits` | **Kiểm tra cont có hợp lệ cho booking** (đúng loại, hạng `containerGradeCode` S / M = cao cấp, cont sale / trả thuê, tổn thất toàn bộ) → hợp lệ / cảnh báo / lỗi | khi Văn phòng chọn cont cấp vỏ / đổi cont (DEC-185 / 192) / **Release for sale** (`isSaleEligible` — DEC-194) |
| `DELETE …/assignment-audits` | Bỏ gán cont khỏi booking (khi cont **chưa** gate-out) | hủy lệnh cấp / đổi cont trước nâng hạ |
| `POST …/bookings/{booking}/booking-equipment` | Nộp danh sách cont đã gán cho booking | sau khi lập lệnh cấp |

- Báo **gate-in / gate-out** (thay CODECO) nằm ở bộ khác: **eEIR External API** (`eir-external-api-documentation_v4.3-5.pdf`, 34 trang — link trong OpenAPI). Agent tải được file nhưng **không đọc được nội dung** (PDF nén / font riêng, máy không có công cụ đọc PDF) → cần người dùng gửi bản chữ hoặc chụp các trang endpoint (Q-056).
- Hướng dẫn tích hợp chọn cont: `eir-container-assignment-integration-guide_v1-6.pdf` (Q-056).
- **Điều kiện được dùng:** chỉ đơn vị **đã được Maersk duyệt** (nhà cung cấp dùng hệ thống AEMS), đăng ký app trên developer.maersk.com bằng email công ty → **Consumer-Key** + **OAuth 2.0** (token Bearer); cần **mã depot 3 ký tự** (`maintenanceShopCode`, VD `9AA`) — Q-057.
- **Giới hạn:** 200 lần gọi / giờ, 120 lần / phút / key (vượt → lỗi 429). Một ngày ~100–300 lượt ra / vào → đủ nếu mỗi lượt gọi 1–2 lần; phải xếp hàng + gọi lại khi 429.
- **Điều khoản cần lưu ý:**
  - giữ key bí mật, **chỉ 1 bộ key**, lộ thì báo Maersk + đổi ngay → key chỉ đặt ở máy chủ (Edge Function / Vercel), **không** đặt ở trình duyệt;
  - không chia sẻ / bán dữ liệu Maersk cho bên thứ ba;
  - chấm dứt hợp đồng → xóa dữ liệu Maersk;
  - Maersk có thể đổi điều khoản, tính phí, công khai tên depot là đơn vị dùng API;
  - luật Đan Mạch.
- **Hướng đề xuất:**
  - (1) giữ **CODECO EDI** cho báo ra / vào — như app cũ, đang chạy được;
  - (2) thêm **API chọn cont** vào Văn phòng → Cấp vỏ để kiểm tra cont hợp lệ trước khi lập lệnh (giảm cấp sai, nhất là cấp sale);
  - (3) khi có tài liệu eEIR External API và Maersk xác nhận cho depot dùng thì cân nhắc thay CODECO bằng API.
- Câu hỏi thêm:
  - **Q-056** — bản đọc được của eEIR External API v4.3 + Integration Guide v1.6;
  - **Q-057** — depot đã được Maersk duyệt / có tài khoản developer + `maintenanceShopCode` chưa; Maersk yêu cầu dùng API hay vẫn nhận EDI.

## 11. Hướng mới (người dùng 2026-10-30): đồng bộ API Maersk cho toàn app

- Trả lời Q-057: xin Maersk duyệt được; đã có tài khoản developer.maersk.com; đã có mã depot 3 ký tự. Người dùng muốn **dùng API cho toàn bộ app** thay EDI.
- Chưa chốt DEC — chờ đọc tài liệu dưới đây rồi đề xuất phạm vi (gate-in / gate-out, chọn cont cho booking, sửa chữa…).
- **Tài liệu agent cần** (người dùng tải → **đính kèm thẳng vào tin nhắn** — PDF đính kèm đọc được; key / mật khẩu không gửi):
  1. eEIR External API Documentation v4.3 — https://edpmediastorage.blob.core.windows.net/media/eir-external-api-documentation_v4.3-5.pdf
  2. eEIR Container Assignment Integration Guide v1.6 — https://edpmediastorage.blob.core.windows.net/media/eir-container-assignment-integration-guide_v1-6.pdf
  3. Authorisation Guide (OAuth 2.0) — https://developer.maersk.com/support/authorisation
  4. Getting Started — https://developer.maersk.com/support/getting-started-api
  5. Trong developer.maersk.com → danh mục API: tải **file OpenAPI (JSON)** của mỗi API depot được mở (eEIR gate-in / gate-out, Empty Container Assignment — đã có, sửa chữa / AEMS nếu có).
  6. Danh sách API product đang bật cho app của depot (ảnh chụp trang My Apps — che Consumer Key / Secret).
- Điều khoản đã đọc: `API License Terms` (31/08/2026) — mục 10.

## 12. eEIR External API v4.3 (đã đọc 2026-10-30) — phần thay được EDI gate-in / gate-out

> Tài liệu có kèm **client id / secret môi trường thử (staging)** công khai của Maersk — **không chép vào repo / code**; khi cần thì người dùng tự nhập vào cấu hình máy chủ.

### 12.1 Tóm tắt

- **eEIR** = phiếu giao nhận container điện tử (Equipment Interchange Report) của Maersk — đúng việc depot làm ở mỗi lượt **gate-in / gate-out**. Depot có hệ thống riêng (như MATRAN) gửi qua API thay cho app điện thoại eEIR của Maersk.
- **Đăng nhập:** `POST https://api.maersk.com/customer-identity/oauth/v2/access_token` (form: `client_id`, `client_secret`, `grant_type=client_credentials`) → dùng **`id_token`** (không phải `access_token`), hạn **2 giờ**.
  - Mọi lệnh gọi kèm header `Authorization: Bearer <id_token>`, `consumer-key: <client_id>`, `user-type: EXTERNAL`.
  - **Client id / secret cấp riêng cho depot** — xin qua email `eEIRSupport@maersk.com` (và người phụ trách eEIR trong tài liệu). **Khác** Consumer-Key của developer portal (API chọn cont ở mục 10) → depot có **2 bộ khóa**.
- **Môi trường thử:** `api-stage.maersk.com` (có danh sách cont thử: lạnh / khô / open-top). Thử xong Maersk mới cấp khóa thật.

| # | API | Việc | Dùng ở MATRAN |
|---|---|---|---|
| 1 | `GET /eir/equipment/getEquipmentDetails?containerNo=…&userId=<client_id>` | **BẮT BUỘC** gọi trước: thông tin cont từ hệ thống Maersk (RKEM) | Giám định Hạ vỏ (gõ số cont MSK) + Văn phòng Cấp vỏ (chọn cont) |
| 2 | `POST /eir/inspection/save` (**multipart/form-data**: `inspectionDetails` JSON + `files` ảnh) | **Gửi eEIR** của 1 lượt gate-in / gate-out → trả `inspectionId` | sau GATE IN OK / Xe nâng cấp vỏ (thay tin CODECO) |
| 3 | `PUT /eir/inspection/updateAdditionalDamages/{inspectionId}` | Thêm ảnh cho eEIR đã gửi | bổ sung ảnh sau |

### 12.2 API 1 trả về gì (dùng ngay được)

- `containerSize`, `equipmentSubType` (DRY / REEF / FLAT / OPEN), `equipmentISOCode` (VD 22G1, 45G1), chiều cao `eqouthgu` ("8 6" / "9 6") → **tự điền size / type đúng mã ISO** (giải Q-047).
- `productionYear` → **AGE** (năm sản xuất).
- **`smokeTested` = HẠNG VỎ (grade):** M food grade • S flexi-bag / premium food • K general cargo sạch / premium • E general cargo • Q scrap cargo • N chưa phân loại → khớp **Phân loại M / K / E** (DEC-166); giải một phần Q-048.
- `sTSELSCR` (cont **đánh dấu bán** — liên quan Release for sale DEC-194), `stBlock` (**cấm di chuyển / cấm dùng**), `stSound` (Maersk ghi nhận hư), `globalHuntStatus` / `globalHuntRedeliveryLocation` (cont thuê phải trả hãng cho thuê), `damage`, lần ra / vào gần nhất ở Maersk (`move`, `activityLocation`, ngày giờ), PTI / bảo hành máy lạnh.
- Lỗi (không phải cont Maersk / chưa có dữ liệu) → **bỏ qua, làm tiếp** quy trình depot (không chặn tác nghiệp).

### 12.3 API 2 — dữ liệu gửi mỗi eEIR (ánh xạ MATRAN)

| Trường | Bắt buộc | Lấy từ MATRAN | Ghi chú |
|---|---|---|---|
| `createdLocalDate` / `submittedLocalDate` (`YYYY-MM-DD HH:MM:SS`), `createdUtcDate` | ✓ | giờ GATE IN OK / Xe nâng cấp vỏ | gửi trễ được trong **24 giờ** |
| `user.surveyorId` | ✓ | client id của depot | |
| `container.containerStatus` | ✓ | 1 = rỗng | depot cont rỗng |
| `container.operator` | ✓ | 1 = Maersk | chỉ cont MSK |
| `container.moveType` | ✓ | 1 POS / 2 IMP / 3 EXP | **cần Maersk xác nhận ánh xạ** từng tác nghiệp (Q-058) |
| `container.moveStatus` | ✓ | 1 IN (Hạ vỏ, Nhập tàu) / 2 OUT (Cấp vỏ, Xuất tàu) | |
| `container.containerTypeSize` | ✓ | `containerSize + subType + " " + ISO` (VD `40DRY 45G1`) từ API 1 | không có thì `99XXX 99X9` |
| `container.bookingNo` | ✓ khi **gate-out xuất rỗng theo booking** | Booking lệnh Cấp vỏ | **9–11 ký tự chữ số** — booking nhập tay phải đúng độ dài |
| `container.grade` | ✓ | `smokeTested` từ API 1 (không có → `N`) | đối chiếu Phân loại MATRAN |
| `container.containerNo`, `sealNo`, `productionYear`… | containerNo ✓ | | |
| `damages[]` | ✓ (luôn có ít nhất 1 mục) | không hư / hao mòn → 1 mục `damageLocation=0000`, `tpIndicator` 0 / 3, **1–20 ảnh**; hư do bên thứ 3 → mỗi hư 1 mục mã **CEDEX** + loại hư + bên gây hư + 1–3 ảnh | hư do bên thứ 3 → Maersk tự mở hồ sơ đòi bồi thường (DERT) |
| `images[]` + file | ✓ | **ít nhất 1 ảnh / eEIR** (jpg / png) | Hạ vỏ có ảnh cửa ✓; **Cấp vỏ hiện chưa chụp ảnh** (Q-059) |
| `truckers.truckerRegno` | ✓ (≤ 11 ký tự) | Số xe (Hạ vỏ / Cấp vỏ) ✓ | SĐT, tên lái xe tùy chọn |
| `emails[].email` | ✓ | email depot nhận PDF eEIR | cấu hình (Q-060) |

- Lỗi 400 / 404 / **412 (sai mã depot)** / 500 → **lưu lại, gửi lại khi API chạy lại** (đúng thiết kế hàng chờ ở mục 5).

### 12.4 Kết luận

- **Đủ thông tin kỹ thuật** để làm: đăng nhập, lấy thông tin cont, gửi eEIR gate-in / gate-out kèm ảnh, thêm ảnh.
- **Chưa chắc eEIR thay hoàn toàn CODECO:** tài liệu không nói rõ gửi eEIR có tự cập nhật lượt ra / vào trong hệ thống Maersk (RKEM) hay vẫn phải gửi CODECO song song (sơ đồ vẫn có "TOS gửi EDI cho Merc+ để tạo lệnh sửa chữa") → **hỏi Maersk (Q-061)** trước khi tắt EDI.
- **Thay đổi nghiệp vụ cần chốt trước khi code:**
  - (a) Cấp vỏ phải có **≥ 1 ảnh** (ai chụp: Xe nâng hay Giám định — Q-059);
  - (b) ánh xạ moveType cho Hạ vỏ / Cấp vỏ / Release for sale / Nhập tàu / Xuất tàu (Q-058);
  - (c) Giám định có ghi **hư do bên thứ 3** theo mã CEDEX không (Q-062) — nếu không, chỉ gửi "không hư / hao mòn" + ảnh;
  - (d) booking phải 9–11 ký tự (kiểm tra ở Cấp vỏ với cont MSK — Q-063).

### 12.5 Câu hỏi mới

| Mã | Câu hỏi |
|---|---|
| Q-058 | moveType POS / IMP / EXP cho từng tác nghiệp: Hạ vỏ khách trả, Cấp vỏ theo booking, Release for sale, Nhập tàu, Xuất tàu, đổi container |
| Q-059 | Cấp vỏ bắt buộc ≥ 1 ảnh eEIR: chụp ở bước nào (Xe nâng khi cấp / Giám định / Văn phòng), bao nhiêu ảnh |
| Q-060 | Email depot nhận PDF eEIR (`emails[].email`) |
| Q-061 | Maersk (EMR / eEIRSupport) xác nhận: gửi eEIR qua API có **thay** CODECO EDI không, hay phải gửi cả hai |
| Q-062 | Depot có xác định **hư do bên thứ 3** (mã CEDEX vị trí, loại hư, bên gây hư) không; danh mục hư nhanh có cần đổi sang mã CEDEX |
| Q-063 | Booking Maersk luôn 9–11 ký tự chữ số? Có chặn nhập sai ở Cấp vỏ cho cont MSK không |
| Q-056 (còn) | Integration Guide v1.6 (chọn cont) + **file mẫu `inspectionDetails` JSON** Maersk gửi qua email khi cấp khóa |

### 12.6 Hỏi Devy (trợ lý developer.maersk.com) — 2026-10-30

- Devy xác nhận: API và EDI **không thay 1-đổi-1**, tùy sản phẩm; có sản phẩm chỉ API, sản phẩm cũ vẫn EDI.
- Với 3 câu (eEIR có thay CODECO không; API nào là gate-in / gate-out cho depot; API nhận booking release / release for sale), Devy trả lời: **portal không có tài liệu nào nói rõ**, và trong danh sách sản phẩm **không thấy sản phẩm "depot gate-in / gate-out equipment move" hay "booking release"** → đề nghị mở **support ticket**.
- **Đánh giá tạm:** hiện **chưa có API công khai thay CODECO** cho lượt ra / vào → **EDI CODECO vẫn là kênh báo ra / vào**; eEIR API là phiếu giao nhận bổ sung (ảnh, hạng vỏ, hư hỏng). Chờ ticket / eEIRSupport trả lời Q-061.

