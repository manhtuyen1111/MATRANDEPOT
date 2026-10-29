// Kiểm thử THẬT DEC-176 với Supabase LOCAL (Docker): ảnh HOÀN THÀNH SỬA CHỮA tải lên kho repair-photos → hoàn tất qua hàng chờ RPC
// → tải lại thấy link ảnh mở được; kho chặn ảnh ≥ 200 KB; ảnh Gate in vào thư mục ANH-GATE-IN/năm/tháng/ngày.
// Chỉ chạy khi có MATRAN_LOCAL_SUPABASE_URL / MATRAN_LOCAL_ANON_KEY / MATRAN_LOCAL_SERVICE_KEY (trỏ 127.0.0.1). KHÔNG trỏ vào project thật.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import * as api from '../src/services/api';
import { setRemoteSink, type RemoteOp } from '../src/services/remote/sync';
import { loadStaffSession, signIn } from '../src/services/remote/session';
import { createWorkingSync, type WorkingSync } from '../src/services/remote/loadWorking';
import { toAuthPassword, usernameToEmail } from '../src/services/authPassword';
import { photoUrl, setPhotoClient } from '../src/services/remote/photoLink';
import type { DepotState } from '../src/services/depotStore';

const ENV = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env || {};
const URL = ENV.MATRAN_LOCAL_SUPABASE_URL;
const ANON = ENV.MATRAN_LOCAL_ANON_KEY;
const SERVICE = ENV.MATRAN_LOCAL_SERVICE_KEY;
const run = Boolean(URL && ANON && SERVICE && /127\.0\.0\.1|localhost/.test(URL || ''));

// Ảnh JPEG giả lập đã nén (kho chỉ kiểm loại + dung lượng)
const jpeg = (bytes: number) => `data:image/jpeg;base64,${Buffer.alloc(bytes, 7).toString('base64')}`;

describe.skipIf(!run)('DEC-176 — ảnh hoàn thành sửa chữa chạy thật', () => {
  const admin = run ? createClient(URL!, SERVICE!, { auth: { persistSession: false } }) : null!;
  const stamp = Date.now().toString(36).toUpperCase();
  const username = `sc.${stamp.toLowerCase()}`;
  const containerNo = `RPTU${String(Date.now()).slice(-7)}`;
  const teamCode = `TO-E${stamp.slice(-4)}`;
  let client: SupabaseClient;
  let queue: RemoteOp[] = [];
  let sync: WorkingSync | null = null;

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
    const userId = created.data.user!.id;
    await admin.from('staff').insert({ id: userId, staff_code: `R${stamp}`.slice(0, 12), username, full_name: 'Thử Sửa Chữa', must_change_password: false });
    await admin.from('staff_roles').insert([{ staff_id: userId, role: 'REPAIR_STAFF' }, { staff_id: userId, role: 'INSPECTOR' }]);
    await admin.from('partners').upsert({ code: 'MSK', name: 'MAERSK', is_shipping_line: true, is_customer: true, allow_tts: true }, { onConflict: 'code' });
    const team = (await admin.from('repair_teams').insert({ code: teamCode, name: 'TỔ THỬ ẢNH' }).select('id').single()).data!;
    await admin.from('repair_team_members').insert({ team_id: team.id, full_name: 'Thợ Thử Ảnh' });
    const cont = (
      await admin
        .from('containers')
        .insert({
          dossier_code: `HV-${stamp}`, container_no: containerNo, size: '40', type: 'HC', condition_class: 'DAMAGE', damage_remarks: ['Móp vách'],
          stuffing_class: 'E', manufacture_year: 2019, cleaning_items: ['KHÔNG VỆ SINH'], active_qr_code: `QR-HV-${stamp}`, needs_repair: true,
        })
        .select('id')
        .single()
    ).data!;
    await admin.from('work_orders').insert({
      code: `MNR-HV-${stamp}`, container_id: cont.id, dossier_code: `HV-${stamp}`, container_no: containerNo, category: 'REPAIR', work_status: 'OPEN',
      assigned_to: 'Sửa chữa', labor_hours: 2,
    });
    client = createClient(URL!, ANON!, { auth: { persistSession: false } });
    await signIn(client, username, 'e2e');
    setRemoteSink((op) => queue.push(op));
  }, 30000);

  afterAll(() => {
    setRemoteSink(null);
    setPhotoClient(null);
  });

  it('tải 3 ảnh → hoàn tất → hồ sơ có 3 link ảnh xem được, đúng thư mục ANH-SUA-CHUA/năm/tháng/ngày/tổ/số cont', async () => {
    let s = await flush();
    const team = s.repairTeams.find((t) => t.code === teamCode)!;
    s = api.completeRepairTask(s, { containerNo, teamId: team.id, memberIds: team.members.map((m) => m.id), photos: [jpeg(150_000), jpeg(120_000), jpeg(5_000)] });
    s = await flush();
    const wo = s.workOrders.find((w) => w.containerNo === containerNo && w.category === 'REPAIR')!;
    expect(wo.workStatus).toBe('COMPLETED');
    expect(wo.repairPhotos).toHaveLength(3);
    // DEC-178: dữ liệu chỉ giữ đường dẫn — bấm XEM ẢNH mới xin link
    expect(wo.repairPhotos![0]).toMatch(/^ANH-SUA-CHUA\//);
    setPhotoClient(client);
    const res = await fetch(await photoUrl(wo.repairPhotos![0]));
    expect(res.status).toBe(200);
    expect((await res.arrayBuffer()).byteLength).toBe(150_000);
    const { data } = await admin.from('work_orders').select('photo_paths').eq('container_no', containerNo).eq('category', 'REPAIR').single();
    const d = new Date();
    const day = `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
    expect(data!.photo_paths[0]).toMatch(new RegExp(`^ANH-SUA-CHUA/${day}/${teamCode}/${containerNo}/${containerNo}-\\d{6}-01\\.jpg$`));
  }, 60000);

  it('kho repair-photos chặn ảnh ≥ 200 KB', async () => {
    const big = await client.storage.from('repair-photos').upload(`ANH-SUA-CHUA/test/${stamp}-big.jpg`, new Blob([Buffer.alloc(210_000)], { type: 'image/jpeg' }));
    expect(big.error).toBeTruthy();
  });

  it('ảnh cửa Gate in vào thư mục ANH-GATE-IN/năm/tháng/ngày', async () => {
    let s = await flush();
    s = api.recordGateInFieldStep(s, {
      gateInType: 'CUSTOMER_RETURN', shippingLineCode: 'MSK', doorPhotoUrl: jpeg(80_000), conditionClass: 'AV', stuffingClass: 'E',
      cleaningItems: ['KHÔNG VỆ SINH'], manufactureYear: 2019,
    });
    await flush();
    const { data } = await admin.from('gate_in_orders').select('door_photo_path').like('door_photo_path', 'ANH-GATE-IN/%').order('created_at', { ascending: false }).limit(1);
    expect(data![0].door_photo_path).toMatch(/^ANH-GATE-IN\/\d{4}\/\d{2}\/\d{2}\/HV-.+\.jpg$/);
  }, 60000);
});
