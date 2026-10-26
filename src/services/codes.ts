import type { DepotState } from './depotStore';

// ============================================================================
// CẤP MÃ HỒ SƠ / PHIẾU (CR-07, DEC-032, DEC-037)
// DEC-068: ký tự đầu mã = viết tắt tác nghiệp
//   Hồ sơ HẠ VỎ    : HV-YYMMDD-NNN   (đánh số lại mỗi ngày)
//   Hồ sơ CẤP VỎ   : CV-YYMMDD-NNN   (đánh số lại mỗi ngày)
//   Phiếu thu      : PT-TT-YYMMDD-NNNN (TT trực tiếp) / PT-TTR-YYMMDD-NNNN (nạp quỹ thu trước) — DEC-098
//                    (dữ liệu cũ PT-YYYY-NNNNNN giữ nguyên)
//   Phiếu thu trước: KHÔNG còn PTT- — dùng PT-TTR-YYMMDD-NNNN cấp ngay khi tạo (DEC-124); PTT- chỉ còn ở dữ liệu cũ
//   Góp ý          : GY-YYMMDD-NNN (DEC-120)
//   Chứng từ       : KHÔNG cấp mã riêng — số chứng từ = mã hồ sơ tác nghiệp (HV- / CV-) (DEC-119)
// Mã cũ (IN-/HS-, OUT-/GO-, PTM-) được đổi khi nạp dữ liệu: renameLegacyCodes
// Chế độ Demo: bộ đếm nằm trong state và chỉ an toàn trong một phiên trình duyệt.
// Chế độ Supabase: bắt buộc cấp trong database (bảng bộ đếm + khóa dòng trong cùng transaction).
// ============================================================================

// DEC-098: phiếu thu theo hình thức + ngày — PT-TT-YYMMDD-NNNN (TT trực tiếp), PT-TTR-YYMMDD-NNNN (nạp quỹ thu trước).
// Dãy PT (PT-YYYY-NNNNNN) giữ cho dữ liệu cũ, không cấp mới.
export type CodeSeries = 'HV' | 'CV' | 'NT' | 'XT' | 'PT' | 'PT-TT' | 'PT-TTR' | 'PTT' | 'GY';

const SERIES_FORMAT: Record<CodeSeries, { period: 'day' | 'year'; digits: number }> = {
  HV: { period: 'day', digits: 3 },
  CV: { period: 'day', digits: 3 },
  NT: { period: 'day', digits: 3 },
  XT: { period: 'day', digits: 3 },
  PT: { period: 'year', digits: 6 },
  'PT-TT': { period: 'day', digits: 4 },
  'PT-TTR': { period: 'day', digits: 4 },
  PTT: { period: 'year', digits: 3 },
  GY: { period: 'day', digits: 3 }, // DEC-120: góp ý
};

function periodKey(series: CodeSeries, at: Date): string {
  const yyyy = String(at.getFullYear());
  if (SERIES_FORMAT[series].period === 'year') return yyyy;
  const yy = yyyy.slice(-2);
  const mm = String(at.getMonth() + 1).padStart(2, '0');
  const dd = String(at.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

function existingCodes(state: DepotState, series: CodeSeries): string[] {
  switch (series) {
    case 'HV':
      return state.gateInOrders.map((o) => o.masterDossierCode);
    case 'CV':
      return state.gateOutOrders.map((o) => o.gateOutCode);
    case 'NT':
    case 'XT':
      return (state.vesselLists || []).flatMap((l) => l.items.map((i) => i.dossierCode || '')).filter((c) => c.startsWith(series));
    case 'PT':
    case 'PT-TT':
    case 'PT-TTR':
      // DEC-124: mã PT-TTR- có thể đã nằm ở phiếu thu trả trước đang chờ thanh toán
      return [...(state.paymentReceipts || []).map((r) => r.receiptNo), ...state.masterReceipts.map((m) => m.receiptCode)];
    case 'PTT':
      return state.masterReceipts.map((r) => r.receiptCode);
    case 'GY':
      return (state.feedbacks || []).map((f) => f.code);
  }
}

function format(series: CodeSeries, key: string, seq: number): string {
  return `${series}-${key}-${String(seq).padStart(SERIES_FORMAT[series].digits, '0')}`;
}

// Xem trước mã kế tiếp (chỉ để hiển thị, KHÔNG bảo đảm — mã thật được cấp khi xác nhận)
export function peekNextCode(state: DepotState, series: CodeSeries, at = new Date()): string {
  return allocateCode(state, series, at).code;
}

export function allocateCode(
  state: DepotState,
  series: CodeSeries,
  at = new Date()
): { code: string; state: DepotState } {
  const key = periodKey(series, at);
  const counterKey = `${series}-${key}`;
  const used = new Set(existingCodes(state, series));
  // Đồng bộ bộ đếm với mã lớn nhất đã có (dữ liệu cũ chưa có bộ đếm)
  let seq = state.codeCounters?.[counterKey] ?? 0;
  const prefix = `${counterKey}-`;
  for (const code of used) {
    if (code?.startsWith(prefix)) {
      const n = Number(code.slice(prefix.length));
      if (Number.isFinite(n) && n > seq) seq = n;
    }
  }
  let code = format(series, key, ++seq);
  while (used.has(code)) code = format(series, key, ++seq);
  return {
    code,
    state: { ...state, codeCounters: { ...(state.codeCounters || {}), [counterKey]: seq } },
  };
}

// DEC-068: đổi mã cũ sang tiền tố mới trên toàn bộ dữ liệu (mã, QR, nội dung nhật ký, khóa bộ đếm)
const LEGACY_CODE_RULES: [RegExp, string][] = [
  [/\b(?:IN|HS)-(\d{6}-\d{3})\b/g, 'HV-$1'],
  [/\b(?:OUT|GO)-(\d{6}-\d{3})\b/g, 'CV-$1'],
  [/\bPTM-(\d{4}-\d{3})\b/g, 'PTT-$1'],
  [/"IN-(\d{6})"/g, '"HV-$1"'],
  [/"OUT-(\d{6})"/g, '"CV-$1"'],
  [/"PTM-(\d{4})"/g, '"PTT-$1"'],
];

export function renameLegacyCodes<T>(data: T): T {
  const json = JSON.stringify(data);
  let out = json;
  for (const [re, to] of LEGACY_CODE_RULES) out = out.replace(re, to);
  return out === json ? data : (JSON.parse(out) as T);
}
