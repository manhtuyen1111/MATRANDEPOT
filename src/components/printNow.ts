// LỆNH IN DÙNG CHUNG (DEC-161). Gọi printNow() thay window.print().
// Phiếu khổ K80 (.k80-sheet): đo chiều dài từng phiếu ở bề rộng 72mm rồi đặt khổ giấy riêng "80mm × chiều dài"
// → bản xem trước của trình duyệt hiện đúng dải giấy K80 (không phải tờ A4), mỗi phiếu 1 trang → máy in nhiệt cắt giữa.

const PX_TO_MM = 25.4 / 96;
const STYLE_ID = 'k80-page-sizes';

function sizeK80Pages(): void {
  document.getElementById(STYLE_ID)?.remove();
  // Lệnh in đang chạy: lớp in riêng (PrintPortal) nếu có, không thì vùng in đang hiện
  const root = document.querySelector('.print-job') || document.querySelector('.print-area');
  const sheets = root ? Array.from(root.querySelectorAll<HTMLElement>('.k80-sheet')) : [];
  if (!sheets.length) return;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:-10000px;top:0;visibility:hidden;width:72mm';
  document.body.appendChild(probe);
  const rules = sheets.map((sheet, i) => {
    const clone = sheet.cloneNode(true) as HTMLElement;
    clone.style.cssText = 'width:72mm;max-width:none;margin:0'; // giữ khung nét đứt + lề như bản xem
    probe.appendChild(clone);
    const mm = Math.ceil(clone.scrollHeight * PX_TO_MM) + 4;
    probe.removeChild(clone);
    sheet.style.setProperty('page', `k80p${i}`);
    return `@page k80p${i} { size: 80mm ${mm}mm; margin: 0; }`;
  });
  probe.remove();
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = rules.join('\n');
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
