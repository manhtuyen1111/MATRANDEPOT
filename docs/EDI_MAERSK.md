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

## 4. Sự kiện cần gửi (tác nghiệp → EDI)

| Tác nghiệp MATRAN | Khi nào ghi sự kiện | Loại tin | Ghi chú |
|---|---|---|---|
| **Hạ vỏ** (cont MSK) | GATE IN OK (hoặc lúc Xe nâng hạ — Q-051) | Gate-in (34) | hạng vỏ theo Giám định |
| **Cấp vỏ — Release for customer** | Xe nâng cấp xong (GATE_OUT_OK) | Gate-out (36) | `RFF+BN` = booking |
| **Cấp vỏ — Release for sale** (DEC-194) | Xe nâng cấp xong | Gate-out (36)? | có **Sale code**; Maersk ghi ở đâu (RFF khác? BGM khác?) — Q-050 |
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
