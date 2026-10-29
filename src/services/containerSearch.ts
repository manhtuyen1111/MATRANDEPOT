// ============================================================================
// TÌM SỐ CONTAINER (DEC-178) — dùng cho MỌI ô tìm số cont (màn hiện trường, Tồn vỏ, Văn phòng, báo cáo).
// Số cont = 4 chữ (hãng) + 7 số seri. Người dùng gõ 7 số seri (hoặc đủ 11 ký tự) → tìm CHÍNH XÁC;
// đang gõ dở → GỢI Ý các cont có seri BẮT ĐẦU bằng các số đã gõ (gõ 12345 → MSKU1234567, TCLU1234501).
// Database dùng cùng quy tắc: cột containers.container_serial + chỉ mục tiền tố (migration DEC-178).
// ============================================================================

export const SERIAL_LENGTH = 7;
export const CONTAINER_SEARCH_HINT = '7 số seri / số cont'; // chữ gợi ý trong ô tìm

// Bỏ dấu cách / gạch / chấm, viết hoa
export const normalizeContainerQuery = (q?: string | null): string => (q || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

// 7 số seri của số cont (phần sau 4 chữ hãng)
export const containerSerial = (containerNo?: string | null): string => normalizeContainerQuery(containerNo).replace(/^[A-Z]+/, '');

// Cont có khớp ô tìm không: chỉ số → so đầu seri (đủ 7 số = chính xác); có chữ → so đầu số cont (đủ 11 ký tự = chính xác)
export function matchContainerNo(containerNo: string | null | undefined, query?: string | null): boolean {
  const q = normalizeContainerQuery(query);
  if (!q) return true;
  const no = normalizeContainerQuery(containerNo);
  if (!no) return false;
  if (/^\d+$/.test(q)) return containerSerial(no).startsWith(q);
  return no.startsWith(q);
}

// Đã gõ đủ để là tìm chính xác (7 số seri hoặc 4 chữ + 7 số)
export function isExactContainerQuery(query?: string | null): boolean {
  const q = normalizeContainerQuery(query);
  return new RegExp(`^(\\d{${SERIAL_LENGTH}}|[A-Z]{4}\\d{${SERIAL_LENGTH}})$`).test(q);
}
