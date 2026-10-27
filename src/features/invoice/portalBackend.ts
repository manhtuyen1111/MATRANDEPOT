// ============================================================================
// TRANG HÓA ĐƠN CỦA KHÁCH (#/hoa-don, DEC-111, DEC-130) — nguồn dữ liệu:
//   - Demo: đọc / ghi DepotState trên máy (invoice.ts) như cũ.
//   - Database: gọi RPC công khai (anon) — chỉ trả đúng phiếu khớp mã bảo mật (DEC-154).
// ============================================================================
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { InvoiceGroup, InvoiceStatus } from '../../types/depot';
import { type DepotState, loadDepotState, saveDepotState } from '../../services/depotStore';
import { createDemoState } from '../../services/demoData';
import {
  cancelPrepaidInvoiceGroup, type InvoicePortalView, type InvoiceRequestInput, lookupInvoicePortal,
  submitInvoiceRequest, submitPrepaidInvoiceGroup,
} from '../../services/invoice';

export interface PortalInfo {
  taxCode: string;
  email: string;
  companyName: string;
  address: string;
  note: string;
}

export interface PortalBackend {
  company(): Promise<{ name: string; phone: string }>;
  lookup(secret: string): Promise<InvoicePortalView>;
  submitRequest(secret: string, info: PortalInfo): Promise<void>;
  submitGroup(secret: string, deductionIds: string[], info: PortalInfo, groupId?: string): Promise<void>;
  cancelGroup(secret: string, groupId: string): Promise<void>;
}

// ---- Demo ----
export function demoBackend(): PortalBackend {
  let state: DepotState = loadDepotState(createDemoState);
  const save = (next: DepotState) => {
    state = next;
    saveDepotState(next);
  };
  return {
    company: async () => ({ name: state.companyProfile.name, phone: state.companyProfile.phone }),
    lookup: async (secret) => lookupInvoicePortal(state, secret),
    submitRequest: async (secret, info) => save(submitInvoiceRequest(state, { secret, ...info } as InvoiceRequestInput)),
    submitGroup: async (secret, deductionIds, info, groupId) => save(submitPrepaidInvoiceGroup(state, { secret, deductionIds, groupId, ...info })),
    cancelGroup: async (secret, groupId) => save(cancelPrepaidInvoiceGroup(state, { secret, groupId })),
  };
}

// ---- Database ----
async function call(client: SupabaseClient, name: string, params: Record<string, unknown> = {}): Promise<any> {
  const { data, error } = await client.rpc(name, params);
  if (error) throw new Error(error.message);
  return data;
}

const opName = (code: string): 'HẠ VỎ' | 'CẤP VỎ' | 'KHÁC' => (code?.startsWith('HV-') ? 'HẠ VỎ' : code?.startsWith('CV-') ? 'CẤP VỎ' : 'KHÁC');

export function mapPortalView(v: any): InvoicePortalView {
  const groups: InvoiceGroup[] = (v.prepaid?.groups || []).map((g: any) => ({
    id: g.id, deductionIds: g.deduction_ids || [], amount: Number(g.amount), taxCode: g.tax_code, email: g.email, companyName: g.company_name,
    address: g.address, note: g.note || undefined, status: g.status, requestedAt: g.requested_at, updatedAt: g.updated_at, invoiceNo: g.invoice_no || undefined,
  }));
  return {
    receiptNo: v.receipt_no, issuedAt: v.issued_at, amount: Number(v.amount), payerName: v.payer_name, containerNo: v.container_no || undefined,
    status: v.status as InvoiceStatus, invoiceNo: v.invoice_no || undefined,
    request: v.request
      ? { taxCode: v.request.tax_code, email: v.request.email, companyName: v.request.company_name, address: v.request.address, note: v.request.note || undefined, requestedAt: '', updatedAt: '' }
      : undefined,
    prepaid: v.prepaid
      ? {
          remainingAmount: Number(v.prepaid.remaining_amount),
          groups,
          lots: (v.prepaid.lots || []).map((l: any) => ({
            deductionId: l.deduction_id, dossierCode: l.dossier_code, operation: opName(l.dossier_code), containerNo: l.container_no, amount: Number(l.amount),
            performedAt: l.performed_at, groupId: l.group_id || undefined, status: l.status as InvoiceStatus, invoiceNo: l.invoice_no || undefined,
          })),
        }
      : undefined,
  } as InvoicePortalView;
}

export function remoteBackend(client: SupabaseClient): PortalBackend {
  const info = (i: PortalInfo) => ({ p_tax_code: i.taxCode, p_email: i.email, p_company: i.companyName, p_address: i.address, p_note: i.note || null });
  return {
    company: async () => {
      const c = await call(client, 'invoice_portal_company');
      return { name: c?.name || '', phone: c?.phone || '' };
    },
    lookup: async (secret) => mapPortalView(await call(client, 'invoice_portal_lookup', { p_secret: secret })),
    submitRequest: async (secret, i) => {
      await call(client, 'invoice_submit_request', { p_secret: secret, ...info(i) });
    },
    submitGroup: async (secret, deductionIds, i, groupId) => {
      await call(client, 'invoice_submit_group', { p_secret: secret, p_deduction_ids: deductionIds, ...info(i), p_group_id: groupId || null });
    },
    cancelGroup: async (secret, groupId) => {
      await call(client, 'invoice_cancel_group', { p_secret: secret, p_group_id: groupId });
    },
  };
}
