// Kiểm thử THẬT luồng nối app (DEC-155) với Supabase LOCAL (Docker) — chạy giống RemoteApp:
//   gọi hàm ghi từ services/api.ts (kiểm quy tắc trên máy) → RPC xếp hàng → chạy lần lượt lên database → tải lại dữ liệu đang làm việc.
// Chỉ chạy khi có MATRAN_LOCAL_SUPABASE_URL / MATRAN_LOCAL_ANON_KEY / MATRAN_LOCAL_SERVICE_KEY (trỏ 127.0.0.1). KHÔNG trỏ vào project thật.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as api from '../src/services/api';
import { requestId, rpc, setRemoteSink, type RemoteOp } from '../src/services/remote/sync';
import { loadStaffSession, signIn } from '../src/services/remote/session';
import { createWorkingSync, loadWorkingState, type WorkingSync } from '../src/services/remote/loadWorking';
import { toAuthPassword, usernameToEmail } from '../src/services/authPassword';
import type { DepotState } from '../src/services/depotStore';

const ENV = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env || {};
const URL = ENV.MATRAN_LOCAL_SUPABASE_URL;
const ANON = ENV.MATRAN_LOCAL_ANON_KEY;
const SERVICE = ENV.MATRAN_LOCAL_SERVICE_KEY;
const run = Boolean(URL && ANON && SERVICE && /127\.0\.0\.1|localhost/.test(URL || ''));

describe.skipIf(!run)('N2–N6 — luồng Hạ vỏ → Bãi → Cấp vỏ chạy thật qua hàng chờ RPC', () => {
  const admin = run ? createClient(URL!, SERVICE!, { auth: { persistSession: false } }) : null!;
  const stamp = Date.now().toString(36).toUpperCase();
  const username = `e2e.${stamp.toLowerCase()}`;
  const block = `BLOCK-E${stamp.slice(-4)}`;
  const containerNo = `TSTU${String(Date.now()).slice(-7)}`;
  let client: SupabaseClient;
  let userId = '';
  let queue: RemoteOp[] = [];
  let sync: WorkingSync | null = null;

  // Giống RemoteApp.flush: chạy lần lượt, rồi tải lại — lần đầu tải đủ, sau đó chỉ tải phần thay đổi (N8)
  const flush = async (): Promise<DepotState> => {
    const ops = queue;
    queue = [];
    for (const op of ops) await op(client);
    if (!sync) {
      sync = createWorkingSync(client, (await loadStaffSession(client))!);
      return sync.full();
    }
    return sync.refresh();
  };

  beforeAll(async () => {
    const created = await admin.auth.admin.createUser({ email: usernameToEmail(username), password: toAuthPassword('e2e'), email_confirm: true });
    userId = created.data.user!.id;
    await admin.from('staff').insert({ id: userId, staff_code: `E${stamp}`.slice(0, 12), username, full_name: 'Thử Luồng', must_change_password: false });
    await admin.from('staff_roles').insert({ staff_id: userId, role: 'ADMIN' });
    // Danh mục tối thiểu cho luồng (chỉ trên Docker local)
    await admin.from('partners').upsert({ code: 'MSK', name: 'MAERSK', is_shipping_line: true, is_customer: true, allow_tts: true }, { onConflict: 'code' });
    await admin.from('yard_blocks').insert({ code: block, name: 'Block thử', capacity: 50 });
    await admin.from('fee_catalog').upsert({ code: 'E2E-40HC', name: 'NÂNG HẠ 40HC (thử)', category: 'NANG_HA', size: '40', type: 'HC', amount: 1500000 }, { onConflict: 'code' });
    client = createClient(URL!, ANON!, { auth: { persistSession: false } });
    await signIn(client, username, 'e2e');
    setRemoteSink((op) => queue.push(op));
  }, 30000);

  afterAll(() => setRemoteSink(null));

  it('Giám định → Văn phòng (TTS) → Xe nâng hạ bãi → Cấp vỏ (TTS) → Gate out; database từ chối thì báo lỗi tiếng Việt', async () => {
    let s = await flush();
    const fee = s.feeCatalog.find((f) => f.code === 'E2E-40HC')!.id;

    // 0. N8: hồ sơ bị xóa trên database → lần đồng bộ sau biến mất khỏi dữ liệu (sync_deletions)
    s = api.recordGateInFieldStep(s, {
      gateInType: 'CUSTOMER_RETURN', shippingLineCode: 'MSK', doorPhotoUrl: 'https://example.invalid/door.jpg', conditionClass: 'AV', stuffingClass: 'E',
      cleaningItems: ['KHÔNG VỆ SINH'], manufactureYear: 2019,
    });
    s = await flush();
    const draftOrder = s.gateInOrders.find((o) => !o.containerNo && o.status === 'FIELD_RECORDED')!;
    s = api.deleteGateInFieldRecord(s, { gateInId: draftOrder.id });
    s = await flush();
    expect(s.gateInOrders.some((o) => o.id === draftOrder.id)).toBe(false);

    // 1. Giám định: ảnh dạng link (không cần nén), AV, không vệ sinh
    s = api.recordGateInFieldStep(s, {
      gateInType: 'CUSTOMER_RETURN', shippingLineCode: 'MSK', doorPhotoUrl: 'https://example.invalid/door.jpg', conditionClass: 'AV', stuffingClass: 'E',
      cleaningItems: ['KHÔNG VỆ SINH'], manufactureYear: 2019,
    });
    expect(queue).toHaveLength(1);
    s = await flush();
    const order = s.gateInOrders.find((o) => !o.containerNo && o.status !== 'GATE_IN_OK')!;
    expect(order.masterDossierCode).toMatch(/^HV-/);

    // 2. Văn phòng xác nhận + TTS
    s = api.verifyGateInOfficeAndCreatePayment(s, {
      gateInId: order.id, containerNo, size: '40', type: 'HC', truckNo: '15C-123.45', driverPhone: '0912345678',
      customerName: 'MAERSK', shippingLineCode: 'MSK', orderDocNo: `EIR-${stamp}`, feeCatalogIds: [fee],
    });
    s = api.confirmGateInPaymentAndComplete(s, { gateInId: order.id, paymentCategory: 'TTS', ttsNote: 'Thử luồng' });
    s = await flush();
    expect(s.gateInOrders.find((o) => o.id === order.id)!.status).toBe('GATE_IN_OK');
    const cont = s.containers.find((c) => c.containerNo === containerNo && !c.gateOutAt)!;
    expect(cont).toBeTruthy();

    // 3. Xe nâng hạ vào block
    s = api.updateContainerLocation(s, { containerNo, blockCode: block, reason: 'Hạ vỏ' });
    s = await flush();
    expect(s.containers.find((c) => c.id === cont.id)!.currentBlock).toBe(block);

    // 4. Database kiểm lại độc lập: container không có trong bãi → lỗi tiếng Việt, không ghi gì
    queue.push((c) => rpc(c, 'update_container_location', { p_request_id: requestId(), p_container_no: 'KHONG0000000', p_block: block, p_bay: null, p_row: null, p_tier: null, p_reason: 'x' }));
    await expect(flush()).rejects.toThrow(/container/i);

    // 5. Cấp vỏ: lập lệnh + TTS trong cùng 1 lần bấm (id tạm → id thật) → xe nâng cấp → GATE OUT
    s = api.createReleaseOrder(s, { bookingNo: `BK-${stamp}`, customerName: 'MAERSK', containerNo, truckNo: '15C-999.99', driverPhone: '0912000000', feeCatalogIds: [fee] });
    const localOut = s.gateOutOrders.find((o) => o.containerNo === containerNo)!;
    s = api.confirmReleasePayment(s, { gateOutOrderId: localOut.id, paymentCategory: 'TTS', ttsNote: 'Thử luồng' });
    expect(queue).toHaveLength(2);
    s = await flush();
    const out = s.gateOutOrders.find((o) => o.containerNo === containerNo)!;
    expect(out.gateOutCode).toMatch(/^CV-/);
    s = api.executeGateOut(s, { containerNo });
    s = await flush();
    expect(s.gateOutOrders.find((o) => o.id === out.id)!.status).toBe('GATE_OUT_OK');
    expect(s.containers.find((c) => c.id === cont.id)?.gateOutAt).toBeTruthy();

    // N7: tải theo khoảng lọc — khoảng cũ không có cont đã OUT hôm nay, khoảng có hôm nay thì có
    const me = (await loadStaffSession(client))!;
    const day = 86_400_000;
    const old = await loadWorkingState(client, me, { from: new Date(Date.now() - 200 * day).toISOString(), to: new Date(Date.now() - 150 * day).toISOString() });
    expect(old.containers.some((c) => c.id === cont.id)).toBe(false);
    expect(old.gateOutOrders.some((o) => o.id === out.id)).toBe(false);
    const recent = await loadWorkingState(client, me, { from: new Date(Date.now() - day).toISOString(), to: new Date(Date.now() + day).toISOString() });
    expect(recent.containers.some((c) => c.id === cont.id)).toBe(true);
    expect(recent.gateOutOrders.some((o) => o.id === out.id)).toBe(true);
  }, 60000);
});
