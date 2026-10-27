# IMPORT TỒN VỎ BAN ĐẦU — bộ câu hỏi (Q-044)

**Mục đích:** ngày chạy thật, database đã reset sạch. Phải đưa toàn bộ container **đang nằm trong bãi** vào hệ thống một lần, đúng trạng thái và vị trí, để từ hôm đó nhân viên làm tiếp trên app.

**Cách làm việc:**
- Mỗi câu có **Đề xuất của Claude**.
- Bạn ghi vào cột **Trả lời của bạn**: "Đồng ý", hoặc sửa lại.
- Câu nào chưa rõ thì để trống, mình sẽ bàn tiếp.
- Khi đủ câu trả lời, Claude ghi thành DEC rồi mới viết công cụ import.

Trạng thái: **ĐANG HỎI** (mở 2026-10-27).

---

## A. File dữ liệu nguồn

| # | Câu hỏi | Đề xuất của Claude | Trả lời của bạn |
|---|---|---|---|
| A1 | Dữ liệu tồn vỏ hiện đang nằm ở đâu? (Excel tự quản lý / phần mềm cũ / sổ tay) | — | |
| A2 | Có xuất được ra **Excel (.xlsx)** không? Gửi Claude **1 file mẫu thật** (có thể xóa bớt dòng, giữ đủ cột). | Dùng Excel. Claude làm **file mẫu chuẩn** (giống cột Tồn vỏ — DEC-129) để bạn chép dữ liệu vào nếu file cũ khác cột | |
| A3 | Khoảng bao nhiêu cont tồn tại thời điểm chuyển đổi? | (DEC-150 ước tính vài nghìn) | |
| A4 | Một cont có thể nằm ở **nhiều dòng** trong file cũ không (VD lịch sử ra vào)? | File import chỉ chứa cont **đang trong bãi**, mỗi cont đúng 1 dòng | |

## B. Thông tin từng container

| # | Câu hỏi | Đề xuất của Claude | Trả lời của bạn |
|---|---|---|---|
| B1 | Cột **bắt buộc** | Số cont (chuẩn ISO `ABCD1234567`), Size, Type, Hãng tàu, **Ngày vào bãi (Date in)**, Tình trạng **AV / DAMAGE** | |
| B2 | Cột **nên có** (trống vẫn import được) | Vị trí (Block – Bay – Row – Tier), Đóng hàng (M / K / E), Năm sản xuất (AGE), Khách hàng hạ, Số xe hạ, Ghi chú Văn phòng | |
| B3 | Số cont sai định dạng / sai chữ số kiểm tra thì sao? | **Báo lỗi dòng đó, không import**; bạn sửa file rồi chạy lại | |
| B4 | Size / Type / Hãng tàu không có trong Danh mục thì sao? | Báo lỗi. Bạn thêm vào Danh mục trước rồi import lại (không tự tạo danh mục) | |
| B5 | Ngày vào bãi: lấy ngày thật trong file cũ hay ngày import? | **Ngày thật** → cột LƯU BÃI tính đúng số ngày | |

## C. Vị trí trong bãi

| # | Câu hỏi | Đề xuất của Claude | Trả lời của bạn |
|---|---|---|---|
| C1 | Danh sách **Block thật** của bãi + kích thước Bay / Row / Tier từng Block? | Bạn nhập Block thật vào Danh mục trước khi import (DEC-050, DEC-082) | |
| C2 | File cũ có vị trí đủ Bay – Row – Tier không? | Có thì import đủ. Thiếu thì chỉ ghi Block (giống BLOCK-B — DEC-087) | |
| C3 | Hai cont trùng đúng 1 ô (đủ 4 phần) thì sao? | Báo lỗi cả 2 dòng, không import, để bạn kiểm tra lại thực tế | |
| C4 | Cont không rõ vị trí? | Cho phép import vào **1 Block tạm** (VD `BLOCK-CHUA-XEP`); Xe nâng đảo chuyển sau | |

## D. Mã hồ sơ, tiền, chứng từ

| # | Câu hỏi | Đề xuất của Claude | Trả lời của bạn |
|---|---|---|---|
| D1 | Mã hồ sơ cho cont tồn cũ? | Cấp mã `HV-` mới theo **ngày import** qua bộ đếm chuẩn (DEC-068); ghi chú "TỒN ĐẦU KỲ". Không giữ mã phần mềm cũ (nếu cần tra thì lưu vào ghi chú) | |
| D2 | Cont tồn cũ tính là **đã thanh toán** phí hạ chưa? | Coi là **đã xong phần Hạ vỏ**, không tạo chứng từ / phiếu thu, không thu lại. Phí cấp vỏ thu bình thường khi xuất | |
| D3 | Có cont nào đang **nợ phí** (TTS) cần theo dõi? | Nếu có: thêm cột "Còn nợ" → Claude hỏi tiếp cách ghi nhận | |
| D4 | Có cần K80 / QR cho cont tồn cũ không? | **Không** (K80 dành cho lái xe lúc hạ). Lúc cấp vỏ hệ thống cấp K80 mới như thường | |

## E. Cont đang dở việc

| # | Câu hỏi | Đề xuất của Claude | Trả lời của bạn |
|---|---|---|---|
| E1 | Cont **DAMAGE** tồn cũ: tạo việc Báo giá / Sửa chữa không? | Có cột "Đã báo giá chưa": chưa → vào hàng chờ **Báo giá**; đã báo giá → vào hàng chờ **Sửa chữa** | |
| E2 | Cont cần **vệ sinh** chưa làm? | Có cột Vệ sinh (WP / WW / CC / RM / ML); có giá trị → vào hàng chờ Vệ sinh | |
| E3 | Cont đang **khóa** (giữ theo yêu cầu hãng / khách)? | Có cột "Khóa" + lý do → import thành cont khóa (DEC-030, DEC-065) | |
| E4 | Cont đã có **booking cấp vỏ** nhưng chưa ra bãi? | Không import booking. Văn phòng nhập lại booking trên app ngày đầu | |
| E5 | Cont nằm trong danh sách **Xuất tàu** sắp làm? | Không import. Văn phòng lập danh sách Xuất tàu trên app sau khi import | |

## F. Cách chạy import

| # | Câu hỏi | Đề xuất của Claude | Trả lời của bạn |
|---|---|---|---|
| F1 | Ai chạy import? | Chỉ **Admin**, 1 lần, trên màn riêng (Danh mục chung → Import tồn đầu) | |
| F2 | Có xem trước trước khi ghi không? | Có: tải file → hiện **bảng kiểm tra** (dòng hợp lệ / dòng lỗi + lý do) → bấm **Ghi vào hệ thống** khi 0 lỗi | |
| F3 | Import một phần (chỉ các dòng đúng) hay tất cả hoặc không? | **Tất cả hoặc không**: còn 1 dòng lỗi thì không ghi, tránh lệch số tồn | |
| F4 | Sau import cần đối chiếu thế nào? | Màn Tồn vỏ + Excel Tồn vỏ: tổng số cont theo Size / Hãng tàu / Block khớp file. Bạn ký xác nhận số tồn đầu | |
| F5 | Làm thử trước trên project TEST? | Có: import thử trên TEST → đối chiếu → reset → import thật trên production | |
| F6 | Ngày giờ chốt số tồn (cut-off)? | Chốt cuối ngày D, import trong đêm, sáng D+1 chạy app. Cont ra / vào trong ngày D phải ghi đủ vào file | |

## G. Dữ liệu khác cần nhập trước ngày chạy

| # | Câu hỏi | Đề xuất của Claude | Trả lời của bạn |
|---|---|---|---|
| G1 | Danh mục thật: hãng tàu, khách hàng (mã + tên + được TTS?), biểu giá, Block, tổ sửa chữa, thông tin công ty | Nhập tay trên app hoặc Claude làm thêm import Excel cho khách hàng / biểu giá nếu nhiều | |
| G2 | Danh sách nhân viên + vai trò | Admin tạo trên app (User - Role) | |
| G3 | Phiếu thu **trả trước (TTR)** khách đang còn số dư? | Nếu có: liệt kê khách + số dư → Claude hỏi tiếp cách nhập số dư đầu kỳ | |
