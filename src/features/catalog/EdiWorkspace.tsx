import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Download, FileText, Search, TriangleAlert } from 'lucide-react';
import { DepotState } from '../../services/depotStore';
import { formatDateTime, parseDateTime } from '../../services/datetime';
import { buildCodecoFile, CODECO_SOURCE_LABELS, CodecoCodeSet, codecoEvents, codecoSizeType, CodecoSource, MAERSK_CODECO } from '../../services/edi/codeco';
import { ediStateFor } from '../../services/remote/ediSource';
import { DateTimeField, Feedback, inputCls, labelCls, linkCls, primaryBtn, secondaryBtn, SectionCard } from '../../components/shared';

const HOUR = 3600 * 1000;
const hourStart = (d: Date) => new Date(Math.floor(d.getTime() / HOUR) * HOUR);

// DANH MỤC CHUNG → EDI (DEC-197, chỉ Admin): CHẠY THỬ EDI CODECO Maersk — tạo file của 1 giờ để so với app cũ. CHƯA GỬI hãng tàu.
// File giờ HH:00 gồm các lượt từ (HH-1):00 đến trước HH:00 (như app cũ). Nghiệp vụ ở services/edi/codeco.ts.
export const EdiWorkspace: React.FC<{ state: DepotState; onOpenDossier?: (code: string) => void }> = ({ state, onOpenDossier }) => {
  const [stampText, setStampText] = useState(() => formatDateTime(hourStart(new Date())));
  const [codeSet, setCodeSet] = useState<CodecoCodeSet>('LEGACY');
  const [result, setResult] = useState<{ stamp: Date; data: DepotState } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = (text = stampText) => {
    setError(null);
    const parsed = parseDateTime(text, 'start');
    if (!parsed) return setError('Nhập giờ file dạng dd/MM/yyyy HH:mm:ss.');
    const stamp = hourStart(parsed);
    setStampText(formatDateTime(stamp));
    setLoading(true);
    ediStateFor(state, { from: new Date(stamp.getTime() - HOUR), to: stamp })
      .then((data) => setResult({ stamp, data }))
      .catch((err) => setError(err instanceof Error ? err.message : 'Không tải được dữ liệu'))
      .finally(() => setLoading(false));
  };
  const shift = (hours: number) => {
    const parsed = parseDateTime(stampText, 'start');
    if (parsed) run(formatDateTime(new Date(hourStart(parsed).getTime() + hours * HOUR)));
  };

  const cfg = { ...MAERSK_CODECO, codeSet };
  const events = result ? codecoEvents(result.data, { from: new Date(result.stamp.getTime() - HOUR), to: result.stamp }, cfg) : [];
  const file = result ? buildCodecoFile(events, result.stamp, cfg) : null;
  const counts = events.reduce((m, e) => ({ ...m, [e.source]: (m[e.source] || 0) + 1 }), {} as Partial<Record<CodecoSource, number>>);
  const skippedKeys = new Set(file?.skipped.map((s) => s.event.key));

  const download = () => {
    if (!file) return;
    const url = URL.createObjectURL(new Blob([file.content], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = file.fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <Feedback error={error} onClose={() => setError(null)} />
      <div className="rounded-lg border border-line bg-accent-soft px-4 py-2.5 text-xs text-ink" data-testid="edi-dry-run">
        <strong>CHẠY THỬ</strong> — tạo file EDI CODECO giống app cũ để so khớp. <strong>Chưa gửi Maersk.</strong> Hãng {cfg.partnerCode} • {cfg.sender} → {cfg.receiver} • mỗi giờ 1 file.
      </div>

      {/* Bộ lọc + Tạo file cùng hàng (DEC-080) */}
      <div className="flex flex-wrap items-end gap-2 rounded-lg border border-line bg-white p-3">
        <div className="w-56"><DateTimeField label="Giờ file (HH:00)" value={stampText} onChange={setStampText} /></div>
        <button type="button" onClick={() => shift(-1)} className={secondaryBtn} aria-label="Giờ trước"><ChevronLeft className="h-3.5 w-3.5" /></button>
        <button type="button" onClick={() => shift(1)} className={secondaryBtn} aria-label="Giờ sau"><ChevronRight className="h-3.5 w-3.5" /></button>
        <label className="w-52">
          <span className={labelCls}>Bộ mã Size / Type</span>
          <select value={codeSet} onChange={(e) => setCodeSet(e.target.value as CodecoCodeSet)} className={inputCls}>
            <option value="LEGACY">Mã app cũ (2200 / 4200 / 4500)</option>
            <option value="ISO">ISO 6346 (22G1 / 45G1…)</option>
          </select>
        </label>
        <button type="button" onClick={() => run()} disabled={loading} className={primaryBtn}><Search className="h-3.5 w-3.5" />{loading ? 'Đang tải…' : 'Tạo file'}</button>
        {file && <button type="button" onClick={download} className={`${secondaryBtn} ml-auto`}><Download className="h-3.5 w-3.5" />Tải {file.fileName}</button>}
      </div>

      {result && file && (
        <>
          <p className="text-xs text-ink-muted" data-testid="edi-summary">
            Lượt từ {formatDateTime(new Date(result.stamp.getTime() - HOUR))} đến trước {formatDateTime(result.stamp)}: <strong className="text-ink">{file.count} tin</strong> trong file
            {(Object.keys(counts) as CodecoSource[]).map((k) => <span key={k}> • {CODECO_SOURCE_LABELS[k]} {counts[k]}</span>)}
            {file.skipped.length > 0 && <span className="font-semibold text-danger-fg"> • {file.skipped.length} tin bị bỏ ra (thiếu dữ liệu)</span>}
          </p>

          {file.skipped.length > 0 && (
            <SectionCard title="Tin bị bỏ ra (sửa dữ liệu rồi tạo lại)" icon={<TriangleAlert className="h-4 w-4 text-danger-fg" />}>
              <ul className="divide-y divide-line text-xs">
                {file.skipped.map((s) => (
                  <li key={s.event.key} className="flex items-center gap-2 whitespace-nowrap py-1.5">
                    <span className="font-mono font-bold">{s.event.containerNo}</span>
                    <span className="text-ink-muted">{CODECO_SOURCE_LABELS[s.event.source]}</span>
                    <span className="text-danger-fg">{s.reason}</span>
                  </li>
                ))}
              </ul>
            </SectionCard>
          )}

          <SectionCard title={`Danh sách tin (${events.length})`} icon={<FileText className="h-4 w-4 text-ink-muted" />}>
            <div className="overflow-x-auto">
              <table className="data-table w-full whitespace-nowrap text-left text-xs" data-testid="edi-events">
                <thead className="bg-canvas text-[11px] font-semibold text-ink-muted">
                  <tr>
                    <th className="px-3 py-2">Mã hồ sơ</th>
                    <th className="px-3 py-2">Số container</th>
                    <th className="px-3 py-2">Size / Type</th>
                    <th className="px-3 py-2">Mã EDI</th>
                    <th className="px-3 py-2">Tác nghiệp</th>
                    <th className="px-3 py-2">Giờ thực tế</th>
                    <th className="px-3 py-2">RFF+BN</th>
                    <th className="px-3 py-2">Trong file</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {events.length === 0 ? (
                    <tr><td colSpan={8} className="px-3 py-3 text-center text-ink-muted">Không có lượt ra / vào của hãng {cfg.partnerCode} trong giờ này.</td></tr>
                  ) : (
                    events.map((e) => (
                      <tr key={e.key}>
                        <td className="px-3 py-2">
                          {onOpenDossier ? <button type="button" onClick={() => onOpenDossier(e.dossierCode)} className={linkCls}>{e.dossierCode}</button> : <span className="font-mono">{e.dossierCode}</span>}
                        </td>
                        <td className="px-3 py-2 font-mono font-bold">{e.containerNo}</td>
                        <td className="px-3 py-2">{e.size}{e.type}</td>
                        <td className="px-3 py-2 font-mono">{codecoSizeType(e, cfg) || '-'}</td>
                        <td className="px-3 py-2">{CODECO_SOURCE_LABELS[e.source]}</td>
                        <td className="px-3 py-2 font-mono">{formatDateTime(e.at)}</td>
                        <td className="px-3 py-2 font-mono">{e.ref || '-'}</td>
                        <td className="px-3 py-2">{skippedKeys.has(e.key) ? <span className="font-semibold text-danger-fg">Bỏ ra</span> : 'Có'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard title={`Nội dung file ${file.fileName}`} icon={<FileText className="h-4 w-4 text-ink-muted" />}>
            <pre className="max-h-96 overflow-auto rounded-md bg-canvas p-3 font-mono text-[11px] leading-5 text-ink" data-testid="edi-file">{file.content}</pre>
          </SectionCard>
        </>
      )}
    </div>
  );
};
