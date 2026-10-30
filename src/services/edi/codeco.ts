// ============================================================================
// EDI CODECO (UN/EDIFACT D.95B, ITG14 của Maersk) — CHẠY THỬ (OPEN-009, DEC-197). Chưa gửi hãng tàu.
// Tạo đúng mẫu file app cũ (ERPVINASHIP) gửi mỗi giờ — chi tiết từng dòng: docs/EDI_MAERSK.md mục 3.
//   Gate-in (BGM 34)  : Hạ vỏ cont của hãng — RFF+BN:GRADE<hạng> + DAM+1+<2 hư / 6 tốt>
//   Gate-out (BGM 36) : Cấp vỏ theo booking (EQD ++2+4, RFF+BN:<booking>)
//                       Cấp sale (EQD ++8+4, RFF+BN:<Sale code> — DEC-194)
//                       Xuất tàu (EQD ++8+4, RFF+BN:<mã cảng đến> — DEC-196), giờ thực tế từng cont
// Chưa gửi: Nhập tàu (chưa rõ có gửi — Q-050), tin hủy / sửa khi đổi container sau khi đã lên xe (Q-052).
// ============================================================================
import type { DepotState } from '../depotStore';
import { containerIsoCode } from '../depotOperations';

export type CodecoCodeSet = 'LEGACY' | 'ISO'; // DEC-195: mã size/type app cũ (chạy song song) / ISO 6346

export interface CodecoConfig {
  partnerCode: string;   // hãng trong Danh mục (MSK)
  sender: string;        // UNB người gửi (mã bãi)
  receiver: string;      // UNB người nhận (MAEU)
  location: string;      // LOC+165
  terminal: string;      // LOC … :TER
  truckCarrier: string;  // TDT
  codeSet: CodecoCodeSet;
  legacySizeType: Record<string, string>; // size + type → mã app cũ
  lineBreak: string;
}

// Cấu hình Maersk lấy từ file mẫu app cũ (docs/EDI_MAERSK.md 3.1, 3.5)
export const MAERSK_CODECO: CodecoConfig = {
  partnerCode: 'MSK',
  sender: 'VNHPHVI',
  receiver: 'MAEU',
  location: 'VNHPHVI',
  terminal: 'HPHVI',
  truckCarrier: 'HPHTRK',
  codeSet: 'LEGACY',
  legacySizeType: { '20DC': '2200', '40DC': '4200', '40HC': '4200', '45HC': '4500' },
  lineBreak: '\n',
};

export type CodecoSource = 'HA_VO' | 'CAP_VO' | 'CAP_SALE' | 'XUAT_TAU';
export const CODECO_SOURCE_LABELS: Record<CodecoSource, string> = {
  HA_VO: 'Hạ vỏ (gate-in)',
  CAP_VO: 'Cấp vỏ (gate-out)',
  CAP_SALE: 'Cấp sale (gate-out)',
  XUAT_TAU: 'Xuất tàu (gate-out)',
};

export interface CodecoEvent {
  key: string;
  source: CodecoSource;
  gateIn: boolean;
  containerNo: string;
  size: string;
  type: string;
  isoCode: string;
  at: string;           // giờ thực tế (ISO)
  ref: string;          // RFF+BN
  eqdStatus: '' | '2' | '8';
  damage?: '2' | '6';   // chỉ gate-in
  dossierCode: string;  // mã hồ sơ MATRAN (HV- / CV- / XT-) để mở xem
  problem?: string;     // thiếu dữ liệu → không đưa vào file
}

// Giờ Việt Nam (UTC+7, không đổi giờ) — EDI ghi giờ địa phương
const VN_OFFSET_MS = 7 * 3600 * 1000;
const pad = (n: number) => String(n).padStart(2, '0');
function vnParts(iso: string | Date) {
  const d = new Date(new Date(iso).getTime() + VN_OFFSET_MS);
  return { y: d.getUTCFullYear(), mo: pad(d.getUTCMonth() + 1), d: pad(d.getUTCDate()), h: pad(d.getUTCHours()), mi: pad(d.getUTCMinutes()) };
}
export const ediDateTime = (iso: string | Date) => { const p = vnParts(iso); return `${p.y}${p.mo}${p.d}${p.h}${p.mi}`; };

// Mã size/type gửi đi theo bộ mã của hãng
export function codecoSizeType(ev: Pick<CodecoEvent, 'size' | 'type' | 'isoCode'>, cfg: CodecoConfig): string {
  return cfg.codeSet === 'ISO' ? ev.isoCode : cfg.legacySizeType[`${ev.size}${ev.type}`] || '';
}

const inRange = (at: string | undefined, from: Date, to: Date) => Boolean(at) && new Date(at!) >= from && new Date(at!) < to;

// Các lượt ra / vào của hãng trong khoảng [from, to) — dữ liệu thực tế (DEC-196)
export function codecoEvents(state: DepotState, range: { from: Date; to: Date }, cfg: CodecoConfig = MAERSK_CODECO): CodecoEvent[] {
  const { from, to } = range;
  const out: CodecoEvent[] = [];
  const iso = (c: { size: string; type: string; isoCode?: string }) => containerIsoCode(state, c);
  const mine = (line?: string) => line === cfg.partnerCode;

  // Gate-in: Hạ vỏ (GATE IN OK — giờ vào bãi)
  for (const c of state.containers) {
    if (!c.masterDossierCode.startsWith('HV-') || !mine(c.shippingLineCode) || !inRange(c.gateInAt, from, to)) continue;
    const damaged = c.conditionClass === 'DAMAGE';
    const grade = damaged ? 'D' : c.stuffingClass || '';
    out.push({
      key: `IN-${c.id}`, source: 'HA_VO', gateIn: true, containerNo: c.containerNo, size: c.size, type: c.type, isoCode: iso(c),
      at: c.gateInAt, ref: `GRADE${grade}`, eqdStatus: '', damage: damaged ? '2' : '6', dossierCode: c.masterDossierCode,
      problem: c.conditionClass === 'W-SURVEY' ? 'Chưa giám định (W-SURVEY) — chưa có hạng vỏ' : !grade ? 'Thiếu phân loại (hạng vỏ)' : undefined,
    });
  }

  // Gate-out: Cấp vỏ / Cấp sale (Xe nâng cấp — giờ ra bãi)
  for (const o of state.gateOutOrders) {
    if (o.status !== 'GATE_OUT_OK' || !inRange(o.confirmedAt, from, to)) continue;
    const c = state.containers.find((x) => x.masterDossierCode === o.masterDossierCode && x.containerNo === o.containerNo);
    if (!c || !mine(c.shippingLineCode)) continue;
    const sale = o.releasePurpose === 'SALE';
    out.push({
      key: `OUT-${o.id}`, source: sale ? 'CAP_SALE' : 'CAP_VO', gateIn: false, containerNo: c.containerNo, size: c.size, type: c.type, isoCode: iso(c),
      at: o.confirmedAt!, ref: sale ? o.saleCode || '' : o.bookingNo, eqdStatus: sale ? '8' : '2', dossierCode: o.gateOutCode,
      problem: sale && !o.saleCode ? 'Thiếu Sale code' : undefined,
    });
  }

  // Gate-out: Xuất tàu — giờ thực tế từng cont (DEC-196)
  for (const l of state.vesselLists || []) {
    if (l.mode !== 'XUAT_TAU') continue;
    for (const i of l.items) {
      if (i.status !== 'DONE' || !inRange(i.doneAt, from, to)) continue;
      const c = state.containers.find((x) => x.id === i.containerId);
      if (!c || !mine(c.shippingLineCode)) continue;
      out.push({
        key: `XT-${i.id}`, source: 'XUAT_TAU', gateIn: false, containerNo: i.containerNo, size: c.size, type: c.type, isoCode: iso(c),
        at: i.doneAt!, ref: l.destinationPort || '', eqdStatus: '8', dossierCode: i.dossierCode || c.masterDossierCode,
        problem: l.destinationPort ? undefined : `Danh sách tàu ${l.vesselName} chưa có mã cảng đến`,
      });
    }
  }

  // Theo giờ; cùng cont cùng giờ thì gate-in trước gate-out
  return out.sort((a, b) => a.at.localeCompare(b.at) || Number(b.gateIn) - Number(a.gateIn));
}

// Tạo file CODECO của 1 giờ. stamp = giờ tạo file (tên file + mã tham chiếu yyyyMMddHHmm). Tin thiếu dữ liệu / thiếu mã size-type bị bỏ ra.
export function buildCodecoFile(events: CodecoEvent[], stamp: Date, cfg: CodecoConfig = MAERSK_CODECO) {
  const ref = ediDateTime(stamp);
  const p = vnParts(stamp);
  const skipped: { event: CodecoEvent; reason: string }[] = [];
  const lines: string[] = [`UNB+UNOA:1+${cfg.sender}+${cfg.receiver}+${String(p.y).slice(2)}${p.mo}${p.d}:${p.h}${p.mi}+${ref}'`];
  let n = 0;
  for (const ev of events) {
    const st = codecoSizeType(ev, cfg);
    const reason = ev.problem || (!st ? `Chưa có mã ${cfg.codeSet === 'ISO' ? 'ISO' : 'EDI'} cho ${ev.size}${ev.type}` : !ev.ref ? 'Thiếu RFF+BN' : '');
    if (reason) {
      skipped.push({ event: ev, reason });
      continue;
    }
    n += 1;
    const msg = [
      `UNH+${n}+CODECO:D:95B:UN:ITG14'`,
      `BGM+${ev.gateIn ? '34' : '36'}+${ref}-${n}'`,
      `NAD+CF+${cfg.partnerCode}'`,
      `GID+1'`,
      ev.gateIn ? `EQD+CN+${ev.containerNo}+${st}:102:5+++4'` : `EQD+CN+${ev.containerNo}+${st}:102:5++${ev.eqdStatus}+4'`,
      `RFF+BN:${ev.ref}'`,
      `DTM+7:${ediDateTime(ev.at)}:203'`,
      `LOC+165+${cfg.location}:139:6+${cfg.terminal}:TER:ZZZ'`,
      ...(ev.gateIn ? [`DAM+1+${ev.damage}'`] : []),
      `TDT+1++3++${cfg.truckCarrier}:172:20'`,
      `CNT+16:1'`,
    ];
    lines.push(...msg, `UNT+${msg.length + 1}+${n}'`);
  }
  lines.push(`UNZ+${n}+${ref}'`);
  return { fileName: `${ref}.txt`, content: lines.join(cfg.lineBreak) + cfg.lineBreak, count: n, skipped };
}
