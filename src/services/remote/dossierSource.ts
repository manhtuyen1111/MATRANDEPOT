// ============================================================================
// HỒ SƠ CONTAINER TẢI KHI BẤM MỞ (DEC-178). Demo: hồ sơ chạy trên state sẵn có.
// Database: mở app chỉ tải việc đang làm → bấm mở hồ sơ mới tải đủ các bước của lượt đó (loadDossierState),
// ghép vào dữ liệu đang có theo id (thao tác trong hồ sơ vẫn chạy trên dữ liệu đầy đủ).
// ============================================================================
import type { DepotState } from '../depotStore';

type DossierLoader = (state: DepotState, code: string) => Promise<DepotState>;
let loader: DossierLoader | null = null;

// RemoteApp đăng ký khi đăng nhập, gỡ khi đăng xuất
export function setDossierLoader(fn: DossierLoader | null): void {
  loader = fn;
}

export const dossierLoaderActive = () => loader !== null;

// Các danh sách có trong hồ sơ — ghép theo id, dòng vừa tải ghi đè dòng cũ
const KEYS = [
  'containers', 'gateInOrders', 'gateOutOrders', 'bookings', 'vouchers', 'paymentTransactions', 'paymentReceipts', 'masterReceipts',
  'receiptDeductions', 'k80Tickets', 'workOrders', 'locationHistory', 'vesselLists',
] as const;

export function mergeDossier(state: DepotState, extra: DepotState | null): DepotState {
  if (!extra) return state;
  const next: DepotState = { ...state };
  for (const key of KEYS) {
    const fresh = (extra[key] || []) as { id: string }[];
    if (!fresh.length) continue;
    const ids = new Set(fresh.map((x) => x.id));
    (next[key] as unknown as { id: string }[]) = [...fresh, ...((state[key] || []) as { id: string }[]).filter((x) => !ids.has(x.id))];
  }
  return next;
}

// Tải hồ sơ (database) — Demo trả về null
export async function loadDossier(state: DepotState, code: string): Promise<DepotState | null> {
  return loader ? loader(state, code) : null;
}
