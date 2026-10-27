// ============================================================================
// N8 — ĐO TỐC ĐỘ tải dữ liệu đang làm việc với quy mô thật (DEC-150: ~15.000 cont / tháng).
// CHỈ chạy với Supabase LOCAL và khi bật MATRAN_PERF=1 (nạp ~45.000 lượt giả lập — dọn bằng `npx supabase db reset`).
//   MATRAN_PERF=1 MATRAN_LOCAL_SUPABASE_URL=… MATRAN_LOCAL_ANON_KEY=… MATRAN_LOCAL_SERVICE_KEY=… npx vitest run tests/perf.local.test.ts
// Tùy chọn: MATRAN_PERF_PER_DAY (mặc định 500), MATRAN_PERF_DAYS (mặc định 90), MATRAN_PERF_SEED=0 (không nạp thêm).
// ============================================================================
import { beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadStaffSession, signIn } from '../src/services/remote/session';
import { createWorkingSync } from '../src/services/remote/loadWorking';
import { toAuthPassword, usernameToEmail } from '../src/services/authPassword';

const ENV = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env || {};
const URL = ENV.MATRAN_LOCAL_SUPABASE_URL;
const ANON = ENV.MATRAN_LOCAL_ANON_KEY;
const SERVICE = ENV.MATRAN_LOCAL_SERVICE_KEY;
const run = ENV.MATRAN_PERF === '1' && Boolean(URL && ANON && SERVICE && /127\.0\.0\.1|localhost/.test(URL || ''));
const PER_DAY = Number(ENV.MATRAN_PERF_PER_DAY || 500);
const DAYS = Number(ENV.MATRAN_PERF_DAYS || 90);
const SEED = ENV.MATRAN_PERF_SEED !== '0'; // MATRAN_PERF_SEED=0: đo lại trên dữ liệu đã nạp
const IN_YARD_DAYS = 10; // cont vào trong 10 ngày gần nhất còn trong bãi (~5.000 cont tồn)
const DAY = 86_400_000;

describe.skipIf(!run)('N8 — đo tốc độ tải dữ liệu với quy mô thật', () => {
  const admin = run ? createClient(URL!, SERVICE!, { auth: { persistSession: false } }) : null!;
  const stamp = Date.now().toString(36).toUpperCase();
  const username = `perf.${stamp.toLowerCase()}`;
  // 3 chữ cái ngẫu nhiên / lần chạy → số cont 'P' + 3 chữ + 7 số (đúng định dạng, không trùng lần trước)
  const letters = Array.from({ length: 3 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join('');
  const block = `BLOCK-PF${letters}`;
  let client: SupabaseClient;
  let bytes = 0;

  const insert = async (table: string, rows: Record<string, unknown>[]) => {
    for (let i = 0; i < rows.length; i += 1000) {
      const { error } = await admin.from(table).insert(rows.slice(i, i + 1000));
      if (error) throw new Error(`${table}: ${error.message}`);
    }
  };

  beforeAll(async () => {
    const created = await admin.auth.admin.createUser({ email: usernameToEmail(username), password: toAuthPassword('perf'), email_confirm: true });
    const staffId = created.data.user!.id;
    await admin.from('staff').insert({ id: staffId, staff_code: `P${stamp}`.slice(0, 12), username, full_name: 'Đo Tốc Độ', must_change_password: false });
    await admin.from('staff_roles').insert({ staff_id: staffId, role: 'ADMIN' });
    const by = 'Đo Tốc Độ';
    await admin.from('yard_blocks').insert({ code: block, name: 'Block đo tốc độ', capacity: 100000 });

    for (let d = 0; SEED && d < DAYS; d++) {
      const at = (h: number) => new Date(Date.now() - d * DAY - h * 60_000).toISOString();
      const gateIns: Record<string, unknown>[] = [];
      const conts: Record<string, unknown>[] = [];
      const vouchers: Record<string, unknown>[] = [];
      const txs: Record<string, unknown>[] = [];
      const receipts: Record<string, unknown>[] = [];
      const tickets: Record<string, unknown>[] = [];
      const bookings: Record<string, unknown>[] = [];
      const outs: Record<string, unknown>[] = [];
      const fees: Record<string, unknown>[] = [];
      const inYard = d < IN_YARD_DAYS;
      for (let n = 0; n < PER_DAY; n++) {
        const seq = String(d * 1000 + n).padStart(7, '0');
        const key = `${letters}${seq}`;
        const code = `HV-PF${key}`;
        const no = `P${letters}${seq}`;
        const gi = crypto.randomUUID();
        const ci = crypto.randomUUID();
        const vi = crypto.randomUUID();
        const ti = crypto.randomUUID();
        const common = { condition_class: 'AV', damage_remarks: [], cleaning_items: ['KHÔNG VỆ SINH'], stuffing_class: 'E', manufacture_year: 2018 };
        gateIns.push({
          id: gi, code, ...common, field_by: staffId, field_by_name: by, field_at: at(n), next_departments: [], status: 'GATE_IN_OK',
          container_no: no, size: '40', type: 'HC', customer_name: 'KHÁCH ĐO TỐC ĐỘ', truck_no: '15C-000.00', voucher_id: vi, fee_amount: 1500000,
          created_at: at(n), gate_in_ok_at: at(n),
        });
        conts.push({
          id: ci, dossier_code: code, gate_in_id: gi, container_no: no, size: '40', type: 'HC', ...common, quotation_items: [], active_qr_code: `QR-${code}`,
          status: inYard ? 'IN_YARD' : 'GATED_OUT', current_block: inYard ? block : null, gate_in_at: at(n), gate_out_at: inYard ? null : at(n - 600), customer_name: 'KHÁCH ĐO TỐC ĐỘ',
        });
        vouchers.push({ id: vi, voucher_no: code, service_type: 'GATE_IN', dossier_code: code, container_no: no, payer_name: 'KHÁCH ĐO TỐC ĐỘ', amount: 1500000, created_by_name: by, created_at: at(n) });
        fees.push({ owner_type: 'VOUCHER', owner_id: vi, catalog_code: 'PF-40HC', name: 'NÂNG HẠ 40HC', unit_amount: 1500000, amount: 1500000 });
        txs.push({ id: ti, payment_ref: `PF${key}`, purpose: 'VOUCHER', voucher_id: vi, payer_name: 'KHÁCH ĐO TỐC ĐỘ', method: 'CASH', payment_category: 'TTTT', amount: 1500000, status: 'SUCCEEDED', created_by_name: by, created_at: at(n) });
        receipts.push({ receipt_no: `PT-TT-PF${key}`, transaction_id: ti, purpose: 'VOUCHER', operation: 'HA_VO', amount: 1500000, method: 'CASH', payment_category: 'TTTT', payer_name: 'KHÁCH ĐO TỐC ĐỘ', issued_by_name: by, invoice_secret: `PF${key}`.padEnd(12, 'X').slice(0, 12), issued_at: at(n) });
        tickets.push({ code: `K80-${code}`, dossier_code: code, qr_code: `QR-${code}`, operation_mode: 'HA_VO', is_paid: true, payment_label: 'TT', container_no: no, size: '40', type: 'HC', ...common, issued_by_name: by, issued_at: at(n) });
        if (!inYard) {
          const bi = crypto.randomUUID();
          bookings.push({ id: bi, booking_no: `BK-PF${key}`, requester_name: 'MSK', receiver_name: 'KHÁCH ĐO TỐC ĐỘ', size: '40', type: 'HC', created_at: at(n - 600) });
          outs.push({ code: `CV-PF${key}`, booking_id: bi, booking_no: `BK-PF${key}`, container_id: ci, dossier_code: code, container_no: no, truck_no: '15C-999.99', receiver_name: 'KHÁCH ĐO TỐC ĐỘ', created_by_name: by, status: 'GATE_OUT_OK', created_at: at(n - 600) });
        }
      }
      await insert('vouchers', vouchers);
      await insert('fee_lines', fees);
      await insert('gate_in_orders', gateIns);
      await insert('containers', conts);
      await insert('payment_transactions', txs);
      await insert('payment_receipts', receipts);
      await insert('k80_tickets', tickets);
      await insert('release_bookings', bookings);
      await insert('gate_out_orders', outs);
    }

    // Đếm số byte tải về (đo băng thông)
    const counted: typeof fetch = async (input, init) => {
      const res = await fetch(input, init);
      bytes += (await res.clone().arrayBuffer()).byteLength;
      return res;
    };
    client = createClient(URL!, ANON!, { auth: { persistSession: false }, global: { fetch: counted } });
    await signIn(client, username, 'perf');
  }, 1_800_000);

  it('Đo: mở app (tải đủ 7 ngày) → đồng bộ khi không đổi → đồng bộ sau 1 thao tác', async () => {
    const me = (await loadStaffSession(client))!;
    const sync = createWorkingSync(client, me);
    const measure = async (label: string, run: () => Promise<{ containers: unknown[] }>) => {
      bytes = 0;
      const t0 = performance.now();
      const s = await run();
      const ms = Math.round(performance.now() - t0);
      console.log(`[N8] ${label}: ${ms} ms, tải về ~${(bytes / 1024).toFixed(0)} KB, ${s.containers.length} cont trong dữ liệu`);
      return s;
    };
    const first = await measure('Mở app (tải đủ)', () => sync.full());
    const idle = await measure('Đồng bộ — không có thay đổi', () => sync.refresh());
    const target = (await admin.from('containers').select('id').eq('status', 'IN_YARD').limit(1)).data![0].id;
    await admin.from('containers').update({ office_note: 'ĐO TỐC ĐỘ' }).eq('id', target);
    await measure('Đồng bộ — sau 1 thao tác', () => sync.refresh());
    expect(idle.containers.length).toBe(first.containers.length);
  }, 600_000);
});
