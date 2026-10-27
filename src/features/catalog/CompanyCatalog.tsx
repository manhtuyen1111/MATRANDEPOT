import React, { useState } from 'react';
import { updateCompanyProfile } from '../../services/api';
import { Building2 } from 'lucide-react';
import { CompanyProfile } from '../../types/depot';
import { DepotState } from '../../services/depotStore';

import { hasRolePermission } from '../../services/permissions';
import { Feedback, inputCls, labelCls, primaryBtn, SectionCard } from '../../components/shared';
import { CompanyHeader } from '../../components/ReceiptPrint';

const FIELDS: { key: keyof CompanyProfile; label: string; placeholder: string; wide?: boolean }[] = [
  { key: 'name', label: 'Tên công ty *', placeholder: 'CÔNG TY CỔ PHẦN ...', wide: true },
  { key: 'shortName', label: 'Tên viết tắt', placeholder: 'MATRAN DEPOT' },
  { key: 'taxCode', label: 'Mã số thuế', placeholder: '0123456789' },
  { key: 'address', label: 'Địa chỉ', placeholder: 'Số nhà, đường, phường, quận, tỉnh/thành', wide: true },
  { key: 'phone', label: 'Điện thoại / Hotline', placeholder: '0225 xxx xxxx' },
  { key: 'email', label: 'Email', placeholder: 'contact@...' },
  { key: 'bankAccount', label: 'Tài khoản ngân hàng', placeholder: 'STK — Ngân hàng — Chi nhánh', wide: true },
];

// DANH MỤC CHUNG — CÔNG TY (DEC-062): thông tin in trên phiếu thu, EEIR, phiếu K80. Chỉ Admin sửa.
export const CompanyCatalog: React.FC<{ state: DepotState; onUpdateState: (next: DepotState) => void }> = ({ state, onUpdateState }) => {
  const isAdmin = hasRolePermission(state.currentUser, ['ADMIN']);
  const [form, setForm] = useState<CompanyProfile>(state.companyProfile);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    try {
      onUpdateState(updateCompanyProfile(state, form));
      setSuccess('Đã lưu thông tin công ty — áp dụng cho mọi giấy tờ in từ bây giờ.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi lưu thông tin');
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
      <div className="space-y-3 lg:col-span-7">
        <Feedback error={error} success={success} onClose={() => (setError(null), setSuccess(null))} />
        {!isAdmin && <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">Chế độ chỉ xem — chỉ Admin cấu hình thông tin công ty.</p>}
        <SectionCard title="Thông tin công ty" icon={<Building2 className="h-4 w-4 text-ink-muted" />}>
          <form onSubmit={save} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FIELDS.map((f) => (
              <label key={f.key} className={f.wide ? 'sm:col-span-2' : ''}>
                <span className={labelCls}>{f.label}</span>
                <input
                  value={form[f.key]}
                  disabled={!isAdmin}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  placeholder={f.placeholder}
                  className={inputCls}
                />
              </label>
            ))}
            {isAdmin && (
              <div className="sm:col-span-2">
                <button type="submit" className={primaryBtn}>Lưu thông tin công ty</button>
              </div>
            )}
          </form>
        </SectionCard>
      </div>
      <div className="lg:col-span-5">
        <SectionCard title="Xem trước phần đầu giấy tờ in">
          <div className="border border-dashed border-line-strong p-3 text-xs">
            <CompanyHeader company={{ ...form, shortName: form.shortName || form.name }} title="PHIẾU THU" subtitle={<p className="font-mono">Số: PT-TT-YYMMDD-NNNN</p>} />
          </div>
        </SectionCard>
      </div>
    </div>
  );
};
