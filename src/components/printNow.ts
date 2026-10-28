// LỆNH IN DÙNG CHUNG (DEC-161). Gọi printNow() thay window.print().
// Phiếu khổ K80 (.k80-sheet): đo chiều dài từng phiếu ở bề rộng 72mm rồi đặt khổ giấy riêng "80mm × chiều dài"
// → bản xem trước của trình duyệt hiện đúng dải giấy K80 (không phải tờ A4), mỗi phiếu 1 trang → máy in nhiệt cắt giữa.

const PX_TO_MM = 25.4 / 96;
const STYLE_ID = 'k80-page-sizes';

function sizeK80Pages(): void {
  document.getElementById(STYLE_ID)?.remove();
  // Lệnh in đang chạy: lớp in riêng (PrintPortal) nếu có, không thì vùng in đang hiện
  const root = document.querySelector('.print-job') || document.querySelector('.print-area');
  // Vùng in có thể CHÍNH LÀ phiếu (cửa sổ phiếu tác nghiệp) hoặc chứa nhiều phiếu (Trả chứng từ, hồ sơ)
  const sheets = !root ? [] : root.matches('.k80-sheet') ? [root as HTMLElement] : Array.from(root.querySelectorAll<HTMLElement>('.k80-sheet'));
  if (!sheets.length) return;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:-10000px;top:0;visibility:hidden;width:80mm';
  document.body.appendChild(probe);
  const rules = sheets.map((sheet, i) => {
    const clone = sheet.cloneNode(true) as HTMLElement;
    clone.style.cssText = 'max-width:none;margin:0'; // bề rộng theo --k80-width; giữ khung nét đứt + lề như bản xem
    probe.appendChild(clone);
    const mm = Math.ceil(clone.offsetHeight * PX_TO_MM) + 1; // vừa đủ phiếu (+1mm an toàn) → không thừa giấy
    probe.removeChild(clone);
    sheet.style.setProperty('page', `k80p${i}`);
    return `@page k80p${i} { size: 80mm ${mm}mm; margin: 0; }`;
  });
  probe.remove();
  const style = document.createElement('style');
  style.id = STYLE_ID;
  // Lề trang mặc định = 0 → trình duyệt không còn chỗ in "đầu trang / chân trang" (ngày giờ, tên trang, địa chỉ web)
  style.textContent = ['@page { margin: 0; }', ...rules].join('\n');
  document.head.appendChild(style);
}

export function printNow(): void {
  try {
    sizeK80Pages();
  } catch {
    /* đo lỗi → vẫn in theo khổ mặc định */
  }
  window.print();
}

// XUẤT PDF: tải thẳng file .pdf (jspdf + html2canvas-pro, chỉ tải thư viện khi bấm).
// Chụp bản xem trong cửa sổ đang mở (vùng in .print-job bị ẩn trên màn hình nên không chụp được):
//   - phiếu K80 (.k80-sheet): mỗi phiếu 1 trang 80mm × chiều dài phiếu
//   - hồ sơ A4 (.dossier-a4): khổ A4 dọc, lề 10mm, dài thì tự sang trang
export async function exportPdf(fileName: string): Promise<void> {
  const dialogs = document.querySelectorAll<HTMLElement>('[role="dialog"]');
  const scope: ParentNode = dialogs[dialogs.length - 1] || document;
  const k80 = Array.from(scope.querySelectorAll<HTMLElement>('.k80-sheet'));
  const a4 = scope.querySelector<HTMLElement>('.dossier-a4');
  if (!k80.length && !a4) throw new Error('Không tìm thấy giấy tờ để xuất PDF');
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([import('jspdf'), import('html2canvas-pro')]);
  const shot = (el: HTMLElement) => html2canvas(el, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
  let pdf: InstanceType<typeof jsPDF> | undefined;
  if (a4) {
    const canvas = await shot(a4);
    pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
    const margin = 10;
    const w = 210 - margin * 2;
    const pageH = 297 - margin * 2;
    const pxPerMm = canvas.width / w;
    const slicePx = Math.floor(pageH * pxPerMm);
    for (let y = 0, page = 0; y < canvas.height; y += slicePx, page++) {
      const h = Math.min(slicePx, canvas.height - y);
      const part = document.createElement('canvas');
      part.width = canvas.width;
      part.height = h;
      part.getContext('2d')!.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
      if (page > 0) pdf.addPage('a4', 'portrait');
      pdf.addImage(part.toDataURL('image/jpeg', 0.92), 'JPEG', margin, margin, w, h / pxPerMm);
    }
  } else {
    for (const sheet of k80) {
      const canvas = await shot(sheet);
      const w = 76; // khung phiếu 76mm giữa giấy 80mm như bản in
      const h = (canvas.height / canvas.width) * w;
      const size: [number, number] = [80, Math.ceil(h) + 4];
      if (!pdf) pdf = new jsPDF({ unit: 'mm', format: size, orientation: 'portrait' });
      else pdf.addPage(size, 'portrait');
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 2, 2, w, h);
    }
  }
  pdf!.save(`${fileName.replace(/[\/:*?"<>|]+/g, '-')}.pdf`);
}
