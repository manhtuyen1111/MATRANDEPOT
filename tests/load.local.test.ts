// ============================================================================
// THỬ TẢI QUY MÔ LỚN (2026-10-29): ~2.000 cont tồn, 200.000 lượt vào – ra, 200.000 lượt sửa chữa.
// CHỈ chạy với Supabase LOCAL và khi bật MATRAN_LOAD=1. Dọn bằng `npx supabase db reset`.
//   MATRAN_LOAD=1 MATRAN_LOCAL_SUPABASE_URL=… MATRAN_LOCAL_ANON_KEY=… MATRAN_LOCAL_SERVICE_KEY=… npx vitest run tests/load.local.test.ts
// Tùy chọn: MATRAN_LOAD_TOTAL (mặc định 200000), MATRAN_LOAD_DAYS (400 → 500 lượt / ngày), MATRAN_LOAD_IN_YARD (2000),
//           MATRAN_LOAD_SEED=0 (đo lại trên dữ liệu đã nạp, không nạp thêm).
// Tạo sẵn tài khoản đăng nhập trình duyệt: admin / 123456 (chỉ local).
// ============================================================================
import { beforeAll, describe, expect, it } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadStaffSession, signIn } from '../src/services/remote/session';
import { createWorkingSync, loadDossierState, loadWorkingState } from '../src/services/remote/loadWorking';
import { toAuthPassword, usernameToEmail } from '../src/services/authPassword';
import { formatDateTime } from '../src/services/datetime';
import { collectAllPages, gateInSheet, queryGateInReport, queryRepairOutput, repairOutputSheets } from '../src/services/reports';

const ENV = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env || {};
const URL = ENV.MATRAN_LOCAL_SUPABASE_URL;
const ANON = ENV.MATRAN_LOCAL_ANON_KEY;
const SERVICE = ENV.MATRAN_LOCAL_SERVICE_KEY;
const run = ENV.MATRAN_LOAD === '1' && Boolean(URL && ANON && SERVICE && /127\.0\.0\.1|localhost/.test(URL || ''));
const TOTAL = Number(ENV.MATRAN_LOAD_TOTAL || 200_000);
const DAYS = Number(ENV.MATRAN_LOAD_DAYS || 400);
const IN_YARD = Number(ENV.MATRAN_LOAD_IN_YARD || 2_000);
const SEED = ENV.MATRAN_LOAD_SEED !== '0';
const PER_DAY = Math.ceil(TOTAL / DAYS);
const DAY = 86_400_000;
const LOGIN = { username: 'admin', password: '123456' };

describe.skipIf(!run)('Thử tải: 200.000 lượt vào – ra + 200.000 lượt sửa chữa', () => {
  const admin = run ? createClient(URL!, SERVICE!, { auth: { persistSession: false } }) : null!;
  const letters = Array.from({ length: 3 }, () => String.fromCharCode(65 + Math.floor(Math.random() * 26))).join('');
  const block = `BLOCK-LD${letters}`;
  let client: SupabaseClient;
  let counter: typeof fetch = fetch; // fetch đếm số byte tải về
  let bytes = 0;
  const byPath = new Map<string, number>(); // KB theo bảng / RPC — tìm chỗ tải nặng
  let sampleNo = '';

  const insert = async (table: string, rows: Record<string, unknown>[]) => {
    const parts: Record<string, unknown>[][] = [];
    for (let i = 0; i < rows.length; i += 1000) parts.push(rows.slice(i, i + 1000));
    for (let i = 0; i < parts.length; i += 4) {
      const res = await Promise.all(parts.slice(i, i + 4).map((p) => admin.from(table).insert(p)));
      const err = res.find((r) => r.error);
      if (err) throw new Error(`${table}: ${err.error!.message}`);
    }
  };

  // Tài khoản đăng nhập trình duyệt (tạo 1 lần, chạy lại không lỗi): admin / 123456 và Xe nâng xn.load / 123456 (đo vai trò hiện trường)
  const ensureUser = async (username: string, code: string, fullName: string, role: string): Promise<string> => {
    const found = await admin.from('staff').select('id').eq('username', username).maybeSingle();
    if (found.data) return found.data.id;
    const created = await admin.auth.admin.createUser({ email: usernameToEmail(username), password: toAuthPassword(LOGIN.password), email_confirm: true });
    if (created.error) throw new Error(created.error.message);
    const id = created.data.user!.id;
    await admin.from('staff').insert({ id, staff_code: code, username, full_name: fullName, must_change_password: false });
    await admin.from('staff_roles').insert({ staff_id: id, role });
    return id;
  };
  const ensureLogin = async (): Promise<string> => {
    await ensureUser('xn.load', 'NV002', 'Xe nâng thử tải', 'FORKLIFT');
    return ensureUser(LOGIN.username, 'NV001', 'Quản trị hệ thống', 'ADMIN');
  };

  beforeAll(async () => {
    const staffId = await ensureLogin();
    const by = 'Quản trị hệ thống';
    if (SEED) {
      await admin.from('yard_blocks').insert({ code: block, name: 'Block thử tải', capacity: 1_000_000 });
      const grade = (await admin.from('repair_grades').insert({ code: `B${letters}`, name: `BẬC THỬ TẢI ${letters}`, hourly_rate: 30000 }).select('id').single()).data!;
      const team = (await admin.from('repair_teams').insert({ code: `TO-LD${letters}`, name: `TỔ THỬ TẢI ${letters}` }).select('id, code, name').single()).data!;
      const members = (
        await admin
          .from('repair_team_members')
          .insert(Array.from({ length: 6 }, (_, i) => ({ team_id: team.id, full_name: `Thợ thử tải ${letters} ${i + 1}`, grade_id: grade.id })))
          .select('id, full_name')
      ).data!;

      let seq = 0;
      const t0 = performance.now();
      for (let d = 0; d < DAYS && seq < TOTAL; d++) {
        const at = (minutes: number) => new Date(Date.now() - d * DAY - minutes * 60_000).toISOString();
        const rows: Record<string, Record<string, unknown>[]> = {
          vouchers: [], fee_lines: [], gate_in_orders: [], containers: [], payment_transactions: [], payment_receipts: [], k80_tickets: [],
          release_bookings: [], gate_out_orders: [], work_orders: [], work_order_members: [],
        };
        for (let n = 0; n < PER_DAY && seq < TOTAL; n++, seq++) {
          const key = `${letters}${String(seq).padStart(7, '0')}`;
          const code = `HV-LD${key}`;
          const no = `L${letters}${String(seq).padStart(7, '0')}`;
          if (seq === Math.floor(TOTAL / 2)) sampleNo = no;
          const inYard = seq < IN_YARD;
          const [gi, ci, vi, ti, wi] = Array.from({ length: 5 }, () => crypto.randomUUID());
          const common = { condition_class: 'AV', damage_remarks: [], cleaning_items: ['KHÔNG VỆ SINH'], stuffing_class: 'E', manufacture_year: 2018 };
          const payer = 'KHÁCH THỬ TẢI';
          rows.gate_in_orders.push({
            id: gi, code, ...common, field_by: staffId, field_by_name: by, field_at: at(n), next_departments: [], status: 'GATE_IN_OK',
            container_no: no, size: '40', type: 'HC', customer_name: payer, truck_no: '15C-000.00', voucher_id: vi, fee_amount: 1500000,
            created_at: at(n), gate_in_ok_at: at(n),
          });
          rows.containers.push({
            id: ci, dossier_code: code, gate_in_id: gi, container_no: no, size: '40', type: 'HC', ...common, quotation_items: [], active_qr_code: `QR-${code}`,
            status: inYard ? 'IN_YARD' : 'GATED_OUT', current_block: inYard ? block : null, gate_in_at: at(n), gate_out_at: inYard ? null : at(n - 600), customer_name: payer,
          });
          rows.vouchers.push({ id: vi, voucher_no: code, service_type: 'GATE_IN', dossier_code: code, container_no: no, payer_name: payer, amount: 1500000, created_by_name: by, created_at: at(n) });
          rows.fee_lines.push({ owner_type: 'VOUCHER', owner_id: vi, catalog_code: 'LD-40HC', name: 'NÂNG HẠ 40HC', unit_amount: 1500000, amount: 1500000 });
          rows.payment_transactions.push({ id: ti, payment_ref: `LD${key}`, purpose: 'VOUCHER', voucher_id: vi, payer_name: payer, method: 'CASH', payment_category: 'TTTT', amount: 1500000, status: 'SUCCEEDED', created_by_name: by, created_at: at(n) });
          rows.payment_receipts.push({ receipt_no: `PT-TT-LD${key}`, transaction_id: ti, purpose: 'VOUCHER', operation: 'HA_VO', amount: 1500000, method: 'CASH', payment_category: 'TTTT', payer_name: payer, issued_by_name: by, invoice_secret: `LD${key}`.padEnd(12, 'X').slice(0, 12), issued_at: at(n) });
          rows.k80_tickets.push({ code: `K80-${code}`, dossier_code: code, qr_code: `QR-${code}`, operation_mode: 'HA_VO', is_paid: true, payment_label: 'TT', container_no: no, size: '40', type: 'HC', ...common, issued_by_name: by, issued_at: at(n) });
          // Mỗi lượt 1 lần sửa chữa đã xong (2 thợ, 2 giờ công)
          rows.work_orders.push({
            id: wi, code: `MNR-${code}`, container_id: ci, dossier_code: code, container_no: no, category: 'REPAIR', work_status: 'COMPLETED', assigned_to: 'Sửa chữa',
            labor_hours: 2, repair_team_id: team.id, repair_team_code: team.code, repair_team_name: team.name, completed_by: staffId, completed_by_name: by,
            completed_at: at(n - 60), created_at: at(n),
          });
          for (const m of [members[seq % 6], members[(seq + 1) % 6]]) rows.work_order_members.push({ work_order_id: wi, member_id: m.id, member_name: m.full_name });
          if (!inYard) {
            const bi = crypto.randomUUID();
            rows.release_bookings.push({ id: bi, booking_no: `BK-LD${key}`, requester_name: 'MSK', receiver_name: payer, size: '40', type: 'HC', created_at: at(n - 600) });
            rows.gate_out_orders.push({ code: `CV-LD${key}`, booking_id: bi, booking_no: `BK-LD${key}`, container_id: ci, dossier_code: code, container_no: no, truck_no: '15C-999.99', receiver_name: payer, created_by_name: by, status: 'GATE_OUT_OK', created_at: at(n - 600) });
          }
        }
        // Thứ tự theo khóa ngoại
        await Promise.all([insert('vouchers', rows.vouchers), insert('release_bookings', rows.release_bookings)]);
        await Promise.all([insert('fee_lines', rows.fee_lines), insert('gate_in_orders', rows.gate_in_orders), insert('payment_transactions', rows.payment_transactions)]);
        await Promise.all([insert('containers', rows.containers), insert('payment_receipts', rows.payment_receipts), insert('k80_tickets', rows.k80_tickets)]);
        await Promise.all([insert('gate_out_orders', rows.gate_out_orders), insert('work_orders', rows.work_orders)]);
        await insert('work_order_members', rows.work_order_members);
        if (d % 20 === 0) console.log(`[LOAD] đã nạp ${seq.toLocaleString('en')} / ${TOTAL.toLocaleString('en')} lượt — ${Math.round((performance.now() - t0) / 1000)} giây`);
      }
    }
    if (!sampleNo) sampleNo = (await admin.from('containers').select('container_no').like('container_no', 'L%').limit(1).single()).data!.container_no;

    counter = async (input, init) => {
      const res = await fetch(input, init);
      const size = (await res.clone().arrayBuffer()).byteLength;
      bytes += size;
      const path = new globalThis.URL(String(input instanceof Request ? input.url : input)).pathname.replace(/^\/(rest|storage|auth)\/v1\//, '');
      byPath.set(path, (byPath.get(path) || 0) + size);
      return res;
    };
    client = createClient(URL!, ANON!, { auth: { persistSession: false }, global: { fetch: counter } });
    await signIn(client, LOGIN.username, LOGIN.password);
  }, 7_200_000);

  const measure = async <T,>(label: string, fn: () => Promise<T> | T): Promise<T> => {
    bytes = 0;
    byPath.clear();
    const t0 = performance.now();
    const out = await fn();
    console.log(`[LOAD] ${label}: ${Math.round(performance.now() - t0)} ms${bytes ? `, tải về ~${(bytes / 1024 / 1024).toFixed(1)} MB` : ''}`);
    const top = [...byPath].sort((a, b) => b[1] - a[1]).slice(0, 4).filter(([, n]) => n > 512 * 1024);
    if (top.length) console.log(`[LOAD]   nặng nhất: ${top.map(([p, n]) => `${p} ${(n / 1024 / 1024).toFixed(1)} MB`).join(', ')}`);
    return out;
  };

  it('Mở app + đồng bộ', async () => {
    const me = (await loadStaffSession(client))!;
    const sync = createWorkingSync(client, me);
    const s = await measure('Mở app — Admin (tồn bãi + việc hôm nay)', () => sync.full());
    console.log(`[LOAD]   → ${s.containers.length} cont, ${s.workOrders.length} phiếu sửa chữa, ${s.paymentReceipts.length} phiếu thu trong dữ liệu`);
    await measure('Đồng bộ (không có thay đổi)', () => sync.refresh());
    expect(s.containers.filter((c) => c.status === 'IN_YARD').length).toBeGreaterThanOrEqual(Math.min(IN_YARD, TOTAL));

    // Vai trò hiện trường: không tải phiếu thu / giao dịch (DEC-178)
    const field = createClient(URL!, ANON!, { auth: { persistSession: false }, global: { fetch: counter } });
    await signIn(field, 'xn.load', LOGIN.password);
    const fs = await measure('Mở app — Xe nâng', async () => createWorkingSync(field, (await loadStaffSession(field))!).full());
    console.log(`[LOAD]   → ${fs.containers.length} cont, ${fs.paymentReceipts.length} phiếu thu, ${fs.vouchers.length} chứng từ trong dữ liệu`);
    expect(fs.paymentReceipts).toHaveLength(0);
  }, 1_800_000);

  it('Mở hồ sơ container (tải khi bấm mở)', async () => {
    const me = (await loadStaffSession(client))!;
    const base = await createWorkingSync(client, me).full();
    const code = (await admin.from('containers').select('dossier_code').eq('container_no', sampleNo).single()).data!.dossier_code;
    const d = await measure(`Mở hồ sơ ${code}`, () => loadDossierState(client, base, code));
    expect(d.containers.some((c) => c.masterDossierCode === code)).toBe(true);
    expect(d.gateInOrders.some((g) => g.masterDossierCode === code)).toBe(true);
    expect(d.workOrders.some((w) => w.masterDossierCode === code)).toBe(true);
  }, 300_000);

  it('Tra số container trong toàn bộ lịch sử', async () => {
    const exact = await measure(`Tìm đúng số ${sampleNo}`, () => client.from('containers').select('*').eq('container_no', sampleNo));
    expect(exact.data!.length).toBe(1);
    const part = sampleNo.slice(-6);
    const like = await measure(`Tìm một phần số "${part}"`, () => client.from('containers').select('id, container_no').ilike('container_no', `%${part}%`).limit(50));
    expect(like.data!.length).toBeGreaterThan(0);
  }, 300_000);

  for (const days of [30, 92]) {
    it(`Báo cáo ${days === 30 ? '1 tháng' : '3 tháng'}: tải + Hạ vỏ + Sản lượng sửa chữa + Excel`, async () => {
      const me = (await loadStaffSession(client))!;
      const from = new Date(Date.now() - days * DAY);
      const to = new Date();
      const s = await measure(`Tải dữ liệu ${days} ngày`, () => loadWorkingState(client, me, { from: from.toISOString(), to: to.toISOString() }));
      console.log(`[LOAD]   → ${s.gateInOrders.length} hồ sơ hạ vỏ, ${s.workOrders.length} phiếu sửa chữa`);
      const filter = { dateFrom: formatDateTime(from), dateTo: formatDateTime(to) };
      const page = await measure('Báo cáo Hạ vỏ — trang 1', () => queryGateInReport(s, 'CUSTOMER_RETURN', filter, 1, 50));
      await measure('Excel Hạ vỏ (toàn bộ kết quả)', () => gateInSheet('HẠ VỎ', collectAllPages((p) => queryGateInReport(s, 'CUSTOMER_RETURN', filter, p)), s));
      const out = await measure('Báo cáo Sản lượng sửa chữa', () => queryRepairOutput(s, filter));
      await measure('Excel Sản lượng sửa chữa', () => repairOutputSheets(out));
      expect(page.total).toBeGreaterThan(0);
    }, 1_800_000);
  }
});
