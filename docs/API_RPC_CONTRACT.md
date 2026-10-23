# MATRAN DEPOT — API & RPC CONTRACT

## 1. Mục đích

Quy định nguyên tắc giao tiếp giữa frontend, Supabase và các dịch vụ bên ngoài.

Tài liệu này là hợp đồng kỹ thuật dự kiến. Tên API, RPC, tham số và cấu trúc trả về chỉ được chốt sau khi schema và nghiệp vụ tương ứng được xác nhận.

## 2. Kiến trúc giao tiếp

- Frontend sử dụng Supabase client để xác thực và truy cập các chức năng được phép.
- Supabase Auth quản lý danh tính người dùng.
- PostgreSQL lưu dữ liệu nghiệp vụ.
- RLS kiểm soát quyền truy cập dữ liệu.
- Database function hoặc RPC xử lý các thao tác cần tính nguyên tử.
- Edge Functions hoặc backend phù hợp xử lý webhook, tích hợp bên ngoài và tác vụ cần bí mật.
- Supabase Storage lưu ảnh và tài liệu.
- Không đưa secret key hoặc khóa quản trị vào frontend.

## 3. Quy tắc chung cho API và RPC

Mỗi thao tác cần xác định:

- Mục đích nghiệp vụ.
- Người được phép thực hiện.
- Điều kiện đầu vào.
- Trạng thái hiện tại hợp lệ.
- Quy tắc kiểm tra dữ liệu.
- Tác động lên dữ liệu.
- Kết quả trả về.
- Các lỗi nghiệp vụ có thể xảy ra.
- Cách xử lý khi yêu cầu được gửi lại.
- Nhật ký cần ghi nhận.

Không cho phép frontend tự quyết định một nghiệp vụ đã hoàn tất chỉ dựa trên giao diện.

## 4. Nhóm thao tác xác thực và phân quyền

Chức năng dự kiến:

- Đăng nhập và đăng xuất.
- Lấy thông tin người dùng hiện tại.
- Kiểm tra trạng thái tài khoản.
- Lấy các vai trò và quyền được cấp.
- Kiểm tra quyền truy cập trước khi thực hiện nghiệp vụ.

Quy tắc:

- Người dùng chưa xác thực không được truy cập dữ liệu nội bộ.
- Tài khoản bị vô hiệu hóa không được tiếp tục thực hiện nghiệp vụ.
- Backend phải tự xác minh danh tính và quyền.
- Không tin vai trò hoặc user ID do frontend tự khai báo.

## 5. Nhóm thao tác Gate In

Các thao tác dự kiến:

- Tạo lượt Gate In.
- Ghi nhận thông tin container.
- Tải ảnh lên Storage và liên kết ảnh với lượt nghiệp vụ.
- Xác nhận container đã đến bãi.
- Tiếp nhận và kiểm tra hồ sơ tại văn phòng.
- Tạo khoản phí và yêu cầu thanh toán.
- Xác nhận thanh toán hợp lệ.
- Hoàn tất Gate In khi đủ điều kiện.
- Ghi nhận vị trí và lịch sử container.
- Hủy hoặc xử lý ngoại lệ theo quyền được cấp.

Quy tắc:

- Không hoàn tất Gate In khi chưa đáp ứng điều kiện thanh toán bắt buộc.
- Không cho phép hai yêu cầu đồng thời tạo ra hai lượt nghiệp vụ không hợp lệ cho cùng một sự kiện tiếp nhận.
- Phải kiểm tra số container và trạng thái trước khi cập nhật.
- Không coi việc tải ảnh thành công là bằng chứng duy nhất để hoàn tất Gate In.
- Việc xác nhận đến bãi và việc hoàn tất nhập bãi là hai bước có thể khác nhau.

## 6. Nhóm thao tác tồn bãi và di chuyển

Các thao tác dự kiến:

- Tra cứu container.
- Tra cứu vị trí hiện tại.
- Tạo lệnh di chuyển.
- Xác nhận bắt đầu và hoàn thành di chuyển.
- Ghi nhận vị trí mới.
- Xem lịch sử vị trí.

Quy tắc:

- Kiểm tra vị trí hiện tại trước khi di chuyển.
- Kiểm tra tính hợp lệ của vị trí đích.
- Cập nhật vị trí hiện tại và lịch sử trong cùng transaction khi cần.
- Chặn thao tác đồng thời gây ra hai vị trí hiện tại.
- Không cho phép nhân viên xác nhận một lệnh ngoài phạm vi được giao.

## 7. Nhóm thao tác Booking và cấp container

Các thao tác dự kiến:

- Tạo và cập nhật booking.
- Kiểm tra điều kiện cấp.
- Tìm container đủ điều kiện.
- Gắn container vào lượt cấp.
- Khóa phân bổ.
- Thay đổi hoặc hủy lượt cấp.
- Giải phóng phân bổ theo quy tắc.
- Xác nhận hoàn tất cấp container.

Quy tắc:

- Container được xác nhận gắn với lượt cấp phải được khóa chống cấp trùng.
- Việc chọn container và tạo phân bổ phải được xử lý an toàn trước các yêu cầu đồng thời.
- Không giải phóng khóa nếu lượt cấp vẫn còn hiệu lực.
- Việc đổi container phải xử lý phân bổ cũ và mới nhất quán.

## 8. Nhóm thao tác Gate Out

Các thao tác dự kiến:

- Tạo yêu cầu xuất bãi.
- Kiểm tra booking hoặc quyền nhận.
- Kiểm tra trạng thái và điều kiện xuất.
- Kiểm tra phí hoặc điều kiện tài chính bắt buộc.
- Xác nhận xuất bãi.
- Cập nhật trạng thái và lịch sử.
- Hủy hoặc xử lý trường hợp ngoại lệ theo quyền.

Quy tắc:

- Không xuất container nếu không đáp ứng điều kiện nghiệp vụ.
- Không cho phép hai yêu cầu hoàn tất xuất bãi cho cùng một container.
- Ghi nhận người xác nhận và thời điểm thực hiện.
- Cập nhật tồn bãi và lịch sử nhất quán.

## 9. Nhóm thao tác vệ sinh, giám định và M&R

Các thao tác dự kiến:

- Tạo yêu cầu dịch vụ.
- Phân công người thực hiện.
- Ghi nhận kết quả và ảnh.
- Gửi kết quả kiểm tra.
- Lập dự toán sửa chữa.
- Phê duyệt hoặc từ chối dự toán.
- Xác nhận thực hiện và nghiệm thu.
- Ghi nhận phí phát sinh.

Quy tắc:

- Kiểm tra quyền và trạng thái công việc trước khi cập nhật.
- Lưu lịch sử thay đổi kết quả và phê duyệt.
- Không cho phép nhân viên tự vượt qua bước phê duyệt bắt buộc.
- Các thao tác tài chính phải liên kết đúng dịch vụ và container.

## 10. Nhóm thao tác thanh toán

Các thao tác dự kiến:

- Tạo khoản phải thu.
- Tạo yêu cầu thanh toán.
- Ghi nhận thanh toán thủ công.
- Khởi tạo giao dịch qua cổng thanh toán.
- Nhận và xác minh webhook.
- Cập nhật trạng thái giao dịch.
- Đối soát giao dịch với khoản phải thu.
- Thực hiện hoàn tiền theo quyền và quy trình.

Quy tắc:

- Phân biệt khoản phải thu, yêu cầu thanh toán và giao dịch thực tế.
- Chỉ xác nhận thanh toán thành công dựa trên bằng chứng hợp lệ.
- Xác minh chữ ký webhook theo cơ chế của nhà cung cấp.
- Chống xử lý lặp cùng một sự kiện thanh toán.
- Không cho phép callback chưa xác minh thay đổi trạng thái tài chính.
- Lưu mã tham chiếu từ nhà cung cấp và lịch sử đối soát.
- Không lưu thông tin bí mật thanh toán trong log hoặc frontend.

## 11. Quy tắc lỗi

Lỗi cần phân biệt theo nhóm:

- Chưa xác thực.
- Không đủ quyền.
- Dữ liệu đầu vào không hợp lệ.
- Không tìm thấy dữ liệu.
- Trạng thái hiện tại không cho phép thao tác.
- Xung đột dữ liệu hoặc thao tác đồng thời.
- Yêu cầu trùng lặp.
- Dịch vụ bên ngoài thất bại.
- Lỗi hệ thống chưa xác định.

Thông báo cho người dùng phải dễ hiểu; log kỹ thuật không được làm lộ thông tin bí mật.

## 12. Giao dịch và tính lặp an toàn

- Các thao tác cập nhật nhiều bảng liên quan cần transaction khi phù hợp.
- Dùng ràng buộc database để bảo vệ các điều kiện quan trọng.
- Xác định cơ chế idempotency (chống xử lý lặp) cho các thao tác tạo giao dịch, trừ quỹ Phiếu thu mẹ (`TTT`), xác nhận webhook chuyển khoản API (`TTTT`) và hoàn tất nghiệp vụ (`GATE IN OK`, `Gate Out`).

## 13. Ánh xạ thao tác nghiệp vụ → RPC dự kiến (2026-10-22)

Các hàm ở cột "Demo" đang là hợp đồng nghiệp vụ chạy thật trong `src/services/`. Khi làm database, mỗi dòng trở thành một RPC (`SECURITY DEFINER`, `SET search_path`, kiểm tra quyền theo `permissions.ts`, kiểm tra trạng thái trước, khóa dòng, ghi audit) với cùng điều kiện và thông báo lỗi. Tên RPC là đề xuất.

| Nghiệp vụ | Hàm Demo | RPC dự kiến | Chống lặp / đồng thời |
|---|---|---|---|
| Giám định Hạ vỏ | `recordGateInFieldStep` | `rpc_gate_in_record_field` | Cấp mã IN trong DB |
| Văn phòng lập chứng từ | `verifyGateInOfficeAndCreatePayment` | `rpc_gate_in_office_verify` | 1 hồ sơ mở / container |
| Thanh toán Hạ vỏ → GATE IN OK | `confirmGateInPaymentAndComplete` | `rpc_gate_in_settle` | Khóa chứng từ; 1 lượt lưu bãi mở / container |
| Xe nâng hạ vỏ | `updateContainerLocation` | `rpc_yard_place` | Unique ô chi tiết |
| Đảo chuyển | `shiftContainer` | `rpc_yard_shift` | Unique ô chi tiết |
| Sửa vị trí | `correctContainerLocation` | `rpc_yard_correct_location` | Unique ô chi tiết |
| Khóa / mở khóa | `toggleContainerHold` | `rpc_container_set_lock` | — |
| Vệ sinh / Báo giá / Sửa chữa | `completeCleaningTask`, `approveDamageQuotation`, `completeRepairTask` | `rpc_service_*` | Kiểm tra trạng thái công việc |
| Lập lệnh cấp vỏ | `createReleaseOrder` | `rpc_release_create` | Unique phân bổ hiệu lực / container; cấp mã OUT |
| Thanh toán cấp vỏ | `confirmReleasePayment` | `rpc_release_settle` | Khóa chứng từ |
| Hủy lệnh cấp | `releaseAllocatedContainer` | `rpc_release_cancel` | Chặn khi đã thanh toán |
| Xe nâng OUT | `executeGateOut` | `rpc_gate_out_confirm` | 5 điều kiện DEC-015; 1 lần OUT |
| Kết quả chuyển khoản | `processBankTransferCallback` | Edge Function webhook → `rpc_payment_bank_callback` | Xác minh chữ ký; `UNIQUE(provider_tx_ref)` |
| Tạo phiếu thu TTT | `createMasterPrepaidReceipt` | `rpc_prepaid_create` | — |
| Xác nhận tiền mặt TTT | `confirmPrepaidCash` | `rpc_prepaid_confirm_cash` | `UNIQUE(transaction_id)` trên phiếu thu |
| Hủy yêu cầu thanh toán | `cancelPendingTransaction` | `rpc_payment_cancel` | Chỉ khi PENDING |
| Tra cứu báo cáo / phiếu thu | `queryGateOutReport`, `queryGateInReport`, `queryReceipts` | View + `range()` có giới hạn | Bắt buộc bộ lọc |
