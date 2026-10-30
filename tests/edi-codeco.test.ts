import { describe, expect, it } from 'vitest';
import { createInitialState, DepotState } from '../src/services/depotStore';
import { createDemoState } from '../src/services/demoData';
import { buildCodecoFile, codecoEvents, CodecoEvent, ediDateTime, MAERSK_CODECO } from '../src/services/edi/codeco';

// DEC-197: EDI CODECO chạy thử — tạo đúng mẫu file app cũ (docs/EDI_MAERSK.md mục 3)

// File mẫu app cũ gửi Maersk lúc 29/10/2026 05:00 (người dùng gửi 2026-10-30)
const SAMPLE_0500 = `UNB+UNOA:1+VNHPHVI+MAEU+261029:0500+202610290500'
UNH+1+CODECO:D:95B:UN:ITG14'
BGM+36+202610290500-1'
NAD+CF+MSK'
GID+1'
EQD+CN+MSKU4773745+4500:102:5++2+4'
RFF+BN:276949930'
DTM+7:202610290425:203'
LOC+165+VNHPHVI:139:6+HPHVI:TER:ZZZ'
TDT+1++3++HPHTRK:172:20'
CNT+16:1'
UNT+11+1'
UNH+2+CODECO:D:95B:UN:ITG14'
BGM+36+202610290500-2'
NAD+CF+MSK'
GID+1'
EQD+CN+MRKU9445623+2200:102:5++2+4'
RFF+BN:280144478'
DTM+7:202610290430:203'
LOC+165+VNHPHVI:139:6+HPHVI:TER:ZZZ'
TDT+1++3++HPHTRK:172:20'
CNT+16:1'
UNT+11+2'
UNH+3+CODECO:D:95B:UN:ITG14'
BGM+36+202610290500-3'
NAD+CF+MSK'
GID+1'
EQD+CN+MRSU7403637+4200:102:5++2+4'
RFF+BN:279470383'
DTM+7:202610290404:203'
LOC+165+VNHPHVI:139:6+HPHVI:TER:ZZZ'
TDT+1++3++HPHTRK:172:20'
CNT+16:1'
UNT+11+3'
UNH+4+CODECO:D:95B:UN:ITG14'
BGM+36+202610290500-4'
NAD+CF+MSK'
GID+1'
EQD+CN+GCXU5592986+4200:102:5++2+4'
RFF+BN:279271622'
DTM+7:202610290400:203'
LOC+165+VNHPHVI:139:6+HPHVI:TER:ZZZ'
TDT+1++3++HPHTRK:172:20'
CNT+16:1'
UNT+11+4'
UNH+5+CODECO:D:95B:UN:ITG14'
BGM+34+202610290500-5'
NAD+CF+MSK'
GID+1'
EQD+CN+MRKU7458447+2200:102:5+++4'
RFF+BN:GRADED'
DTM+7:202610290402:203'
LOC+165+VNHPHVI:139:6+HPHVI:TER:ZZZ'
DAM+1+2'
TDT+1++3++HPHTRK:172:20'
CNT+16:1'
UNT+12+5'
UNH+6+CODECO:D:95B:UN:ITG14'
BGM+34+202610290500-6'
NAD+CF+MSK'
GID+1'
EQD+CN+TCKU2321628+2200:102:5+++4'
RFF+BN:GRADEK'
DTM+7:202610290449:203'
LOC+165+VNHPHVI:139:6+HPHVI:TER:ZZZ'
DAM+1+6'
TDT+1++3++HPHTRK:172:20'
CNT+16:1'
UNT+12+6'
UNH+7+CODECO:D:95B:UN:ITG14'
BGM+34+202610290500-7'
NAD+CF+MSK'
GID+1'
EQD+CN+MRSU3714482+4200:102:5+++4'
RFF+BN:GRADEK'
DTM+7:202610290454:203'
LOC+165+VNHPHVI:139:6+HPHVI:TER:ZZZ'
DAM+1+6'
TDT+1++3++HPHTRK:172:20'
CNT+16:1'
UNT+12+7'
UNH+8+CODECO:D:95B:UN:ITG14'
BGM+36+202610290500-8'
NAD+CF+MSK'
GID+1'
EQD+CN+MRSU3714482+4200:102:5++2+4'
RFF+BN:279257381'
DTM+7:202610290456:203'
LOC+165+VNHPHVI:139:6+HPHVI:TER:ZZZ'
TDT+1++3++HPHTRK:172:20'
CNT+16:1'
UNT+11+8'
UNZ+8+202610290500'`;

// Giờ Việt Nam → ISO (UTC)
const vn = (hhmm: string) => new Date(`2026-10-29T${hhmm}:00+07:00`).toISOString();
const ev = (p: Partial<CodecoEvent> & Pick<CodecoEvent, 'containerNo' | 'size' | 'type' | 'at' | 'ref'>): CodecoEvent => ({
  key: p.containerNo + p.at, source: p.gateIn ? 'HA_VO' : 'CAP_VO', gateIn: false, isoCode: '', eqdStatus: p.gateIn ? '' : '2', dossierCode: '', ...p,
});

describe('DEC-197: EDI CODECO chạy thử', () => {
  it('dựng lại ĐÚNG TỪNG KÝ TỰ file mẫu app cũ 202610290500.txt (45HC, 40HC, 20DC, hạ hư / tốt, cont vừa hạ đã cấp)', () => {
    const events: CodecoEvent[] = [
      ev({ containerNo: 'MSKU4773745', size: '45', type: 'HC', ref: '276949930', at: vn('04:25') }),
      ev({ containerNo: 'MRKU9445623', size: '20', type: 'DC', ref: '280144478', at: vn('04:30') }),
      ev({ containerNo: 'MRSU7403637', size: '40', type: 'HC', ref: '279470383', at: vn('04:04') }),
      ev({ containerNo: 'GCXU5592986', size: '40', type: 'DC', ref: '279271622', at: vn('04:00') }),
      ev({ containerNo: 'MRKU7458447', size: '20', type: 'DC', ref: 'GRADED', at: vn('04:02'), gateIn: true, damage: '2' }),
      ev({ containerNo: 'TCKU2321628', size: '20', type: 'DC', ref: 'GRADEK', at: vn('04:49'), gateIn: true, damage: '6' }),
      ev({ containerNo: 'MRSU3714482', size: '40', type: 'HC', ref: 'GRADEK', at: vn('04:54'), gateIn: true, damage: '6' }),
      ev({ containerNo: 'MRSU3714482', size: '40', type: 'HC', ref: '279257381', at: vn('04:56') }),
    ];
    const file = buildCodecoFile(events, new Date(vn('05:00')));
    expect(file.fileName).toBe('202610290500.txt');
    expect(file.count).toBe(8);
    expect(file.content.trim()).toBe(SAMPLE_0500);
  });

  it('cấp sale (++8+4, Sale code) và xuất tàu (++8+4, mã cảng đến) đúng mẫu; tin thiếu dữ liệu bị bỏ ra, có lý do', () => {
    const file = buildCodecoFile([
      ev({ containerNo: 'PONU1771369', size: '40', type: 'HC', ref: 'SALEO26VN51', at: vn('14:16'), eqdStatus: '8', source: 'CAP_SALE' }),
      ev({ containerNo: 'HASU1040690', size: '20', type: 'DC', ref: 'VNHPHTM', at: vn('10:56'), eqdStatus: '8', source: 'XUAT_TAU' }),
      ev({ containerNo: 'ABCU1234567', size: '20', type: 'OT', ref: '123456789', at: vn('10:00') }),
      ev({ containerNo: 'ABCU7654321', size: '20', type: 'DC', ref: '', at: vn('10:00'), source: 'XUAT_TAU', problem: 'Danh sách tàu X chưa có mã cảng đến' }),
    ], new Date(vn('15:00')));
    expect(file.content).toContain("EQD+CN+PONU1771369+4200:102:5++8+4'\nRFF+BN:SALEO26VN51'");
    expect(file.content).toContain("EQD+CN+HASU1040690+2200:102:5++8+4'\nRFF+BN:VNHPHTM'");
    expect(file.count).toBe(2);
    expect(file.skipped.map((s) => s.reason)).toEqual(['Chưa có mã EDI cho 20OT', 'Danh sách tàu X chưa có mã cảng đến']);
    // DEC-195: bộ mã ISO 6346
    const isoFile = buildCodecoFile([ev({ containerNo: 'MSKU4773745', size: '45', type: 'HC', isoCode: 'L5G1', ref: '276949930', at: vn('04:25') })], new Date(vn('05:00')), { ...MAERSK_CODECO, codeSet: 'ISO' });
    expect(isoFile.content).toContain('EQD+CN+MSKU4773745+L5G1:102:5++2+4');
  });

  it('giờ EDI theo giờ Việt Nam', () => {
    expect(ediDateTime('2026-10-28T21:25:00.000Z')).toBe('202610290425');
  });

  it('lấy dữ liệu thực tế từ app: chỉ cont MSK trong khoảng giờ; sắp theo giờ, cùng giờ gate-in trước', () => {
    const s: DepotState = createDemoState();
    const all = codecoEvents(s, { from: new Date('2000-01-01'), to: new Date('2100-01-01') });
    expect(all.length).toBeGreaterThan(0);
    for (const e of all) {
      const c = s.containers.find((x) => x.containerNo === e.containerNo);
      expect(c?.shippingLineCode).toBe('MSK');
    }
    expect([...all].map((e) => e.at)).toEqual([...all].map((e) => e.at).sort());
    const gin = all.find((e) => e.gateIn)!;
    expect(gin.ref).toMatch(/^GRADE/);
    expect(['2', '6']).toContain(gin.damage);
    expect(codecoEvents(s, { from: new Date('2000-01-01'), to: new Date('2000-01-02') })).toEqual([]);
    expect(codecoEvents(createInitialState(), { from: new Date('2000-01-01'), to: new Date('2100-01-01') }, { ...MAERSK_CODECO, partnerCode: 'XXX' })).toEqual([]);
  });
});
