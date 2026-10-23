# Tối ưu token — chỉ đọc đúng thứ cần

## 1. Luôn đọc (ngắn)
- `AGENTS.md`
- Mục việc được giao trong `devs/PROGRESS.md`

## 2. Đọc theo loại việc

| Loại việc | Đọc | Không cần đọc |
|---|---|---|
| Sửa logic nghiệp vụ | Grep `docs/DECISIONS.md` theo từ khóa; file service liên quan; test liên quan | Toàn bộ docs, các màn UI không liên quan |
| Sửa giao diện | `src/components/shared.tsx` (phần export), màn hình đó, `docs/agents/` skill ui | DECISIONS (trừ khi đổi hành vi) |
| Báo cáo / tra cứu | `src/services/reports.ts`, `ReportsWorkspace.tsx` | Payments, inspector |
| Thanh toán / phiếu thu | `src/services/payments.ts`, DEC-031/032/033 | Yard, catalog |
| Quyền | `src/services/permissions.ts`, `ROLE_PERMISSION_MATRIX.md` mục 2A | — |
| Database | `DATABASE_CONTRACT.md` mục 8–9, `API_RPC_CONTRACT.md` mục 13, migration hiện có | UI |

## 3. Cách đọc
- Ưu tiên Grep/tìm kiếm trước, đọc theo khoảng dòng (`offset/limit`) với file lớn: `depotOperations.ts` (~1.100 dòng), `MasterCatalogWorkspace.tsx`, `InspectorHaVoMobile.tsx`, `OfficeWorkspaces.tsx`.
- Không đọc `package-lock.json`, `dist/`, `node_modules/`.
- Không in lại toàn bộ file vào câu trả lời; dẫn `đường-dẫn:dòng`.
- Kết quả lệnh dài: lọc bằng `tail` / `grep` (ví dụ `npx vitest run | tail -5`).

## 4. Viết
- Sửa bằng Edit đúng chỗ, không Write lại file lớn khi chỉ đổi vài dòng.
- Báo cáo theo mẫu `WORKFLOW.md` mục 4 — ngắn, có số liệu thật.
- Không lặp lại nội dung đã có trong tài liệu; dẫn mã DEC.
