// ============================================================================
// CHẾ ĐỘ DATABASE — tải "dữ liệu đang làm việc" thành DepotState để giao diện dùng như bản Demo (DEC-155).
// N1: danh mục + nhân viên + công ty. Dữ liệu tác nghiệp (container, hồ sơ, phiếu thu…) nối dần từ N3.
// ============================================================================
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AppRole, DepotFeeCatalogItem, Partner, RepairTeam, StaffUser, StuffingClassItem, YardBlock } from '../../types/depot';
import { createCleanState, type DepotState } from '../depotStore';
import type { StaffSession } from './session';

async function rows<T>(query: PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const { data, error } = await query;
  if (error) throw new Error(`Không tải được dữ liệu: ${error.message}`);
  return data || [];
}

export async function loadCatalogState(client: SupabaseClient, me: StaffSession): Promise<DepotState> {
  const [partners, sizes, types, blocks, fees, teams, company, staff, stuffing] = await Promise.all([
    rows<{ id: string; code: string; name: string; is_shipping_line: boolean; is_customer: boolean; allow_tts: boolean }>(
      client.from('partners').select('id, code, name, is_shipping_line, is_customer, allow_tts').eq('is_active', true).order('code')
    ),
    rows<{ code: string }>(client.from('container_sizes').select('code').eq('is_active', true).order('sort_order')),
    rows<{ code: string }>(client.from('container_types').select('code').eq('is_active', true).order('sort_order')),
    rows<{ code: string; name: string; max_bay: number; max_row: number; max_tier: number; capacity: number; description: string; is_inspection_rack: boolean }>(
      client.from('yard_blocks').select('code, name, max_bay, max_row, max_tier, capacity, description, is_inspection_rack').eq('is_active', true).order('code')
    ),
    rows<{ id: string; code: string; name: string; category: DepotFeeCatalogItem['category']; size: string | null; type: string | null; shipping_line_code: string | null; amount: number }>(
      client.from('fee_catalog').select('id, code, name, category, size, type, shipping_line_code, amount').eq('is_active', true).order('code')
    ),
    rows<{ id: string; code: string; name: string; is_active: boolean; repair_team_members: { id: string; full_name: string; is_active: boolean; staff_id: string | null }[] }>(
      client.from('repair_teams').select('id, code, name, is_active, repair_team_members(id, full_name, is_active, staff_id)').order('code')
    ),
    rows<{ name: string; short_name: string; address: string; phone: string; email: string; tax_code: string; bank_account: string }>(
      client.from('company_profile').select('name, short_name, address, phone, email, tax_code, bank_account')
    ),
    // Admin đọc được toàn bộ nhân viên (RLS); người khác chỉ thấy chính mình
    rows<{ id: string; staff_code: string; username: string; full_name: string; email: string | null; is_active: boolean; staff_roles: { role: AppRole }[] }>(
      client.from('staff').select('id, staff_code, username, full_name, email, is_active, staff_roles(role)').order('staff_code')
    ),
    // DEC-166: Phân loại đóng hàng theo hãng tàu (cả mã ngừng dùng — màn Danh mục hiện để mở lại)
    rows<{ id: string; shipping_line_code: string; code: string; description: string | null; is_active: boolean }>(
      client.from('stuffing_classes').select('id, shipping_line_code, code, description, is_active').order('shipping_line_code').order('sort_order')
    ),
  ]);

  const currentUser: StaffUser = { id: me.id, staffCode: me.staffCode, fullName: me.fullName, email: me.email, roles: me.roles, isActive: me.isActive };
  const base = createCleanState();
  return {
    ...base,
    currentUser,
    staffUsers: staff.length
      ? staff.map((s) => ({ id: s.id, staffCode: s.staff_code, fullName: s.full_name, email: s.email || `${s.username}@matrandepot.local`, roles: (s.staff_roles || []).map((r) => r.role), isActive: s.is_active }))
      : [currentUser],
    partners: partners.map((p): Partner => ({ id: p.id, code: p.code, name: p.name, isShippingLine: p.is_shipping_line, isCustomer: p.is_customer, allowTts: p.allow_tts })),
    containerSizes: sizes.map((s) => s.code),
    containerTypes: types.map((t) => t.code),
    stuffingClasses: stuffing.map((s): StuffingClassItem => ({ id: s.id, shippingLineCode: s.shipping_line_code, code: s.code, description: s.description || undefined, isActive: s.is_active })),
    yardBlocks: blocks.map((b): YardBlock => ({
      blockCode: b.code, blockName: b.name, maxBay: b.max_bay, maxRow: b.max_row, maxTier: b.max_tier, capacity: b.capacity,
      description: b.description, isInspectionRack: b.is_inspection_rack,
    })),
    feeCatalog: fees.map((f): DepotFeeCatalogItem => ({
      id: f.id, code: f.code, name: f.name, category: f.category, size: f.size || undefined, type: f.type || undefined,
      shippingLineCode: f.shipping_line_code || 'ALL', defaultAmountInclVat: Number(f.amount),
    })),
    repairTeams: teams.map((t): RepairTeam => ({
      id: t.id, code: t.code, name: t.name, isActive: t.is_active,
      members: (t.repair_team_members || []).map((m) => ({ id: m.id, fullName: m.full_name, isActive: m.is_active, staffUserId: m.staff_id || undefined })),
    })),
    companyProfile: company[0]
      ? { name: company[0].name, shortName: company[0].short_name, address: company[0].address, phone: company[0].phone, email: company[0].email, taxCode: company[0].tax_code, bankAccount: company[0].bank_account }
      : base.companyProfile,
  };
}
