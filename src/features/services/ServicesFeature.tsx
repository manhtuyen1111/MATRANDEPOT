import React, { useState } from 'react';
import { CheckCircle2, Hammer, PlusCircle, ShieldAlert, Sparkles, Wrench } from 'lucide-react';
import { DepotState, formatVnd, hasRolePermission } from '../../services/depotStore';

interface Props {
  state: DepotState;
  onUpdateState: (next: DepotState) => void;
}

export const ServicesFeature: React.FC<Props> = ({ state, onUpdateState }) => {
  const activeContainers = state.containers.filter((c) => c.status !== 'GATED_OUT');
  const [containerNo, setContainerNo] = useState(activeContainers[0]?.containerNo || 'MSKU4089123');
  const [category, setCategory] = useState<'CLEANING' | 'INSPECTION' | 'REPAIR'>('REPAIR');
  const [itemsText, setItemsText] = useState('Hàn dặm vách trái 15cm, thay gioăng cửa');
  const [estimateCost, setEstimateCost] = useState<number>(1500000);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleCreateWorkOrder = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (
      !hasRolePermission(state.currentUser, [
        'OFFICE',
        'INSPECTOR',
        'CLEANING',
        'REPAIR_STAFF',
        'MANAGER',
      ])
    ) {
      setErrorMsg('Không đủ quyền tạo yêu cầu dịch vụ.');
      return;
    }

    const targetCont = state.containers.find((c) => c.containerNo === containerNo);
    const prefix = category === 'CLEANING' ? 'CLN' : category === 'INSPECTION' ? 'INSP' : 'MNR';
    const workOrderCode = `${prefix}-${Date.now().toString().slice(-6)}`;
    const newWo = {
      id: `wo-${Date.now()}`,
      masterDossierCode: targetCont?.masterDossierCode || 'HS-261021-001',
      workOrderCode,
      containerNo,
      category,
      items: itemsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      estimateCost: category === 'REPAIR' ? Number(estimateCost) : 0,
      approvalStatus:
        category === 'REPAIR' ? ('PENDING_APPROVAL' as const) : ('NOT_REQUIRED' as const),
      workStatus: 'OPEN' as const,
      assignedTo: 'Võ Kỹ Thuật (Giám định/VS/M&R)',
      createdAt: new Date().toISOString(),
    };

    onUpdateState({
      ...state,
      workOrders: [newWo, ...state.workOrders],
      auditLogs: [
        {
          id: `aud-${Date.now()}`,
          actorName: state.currentUser.fullName,
          actorRole: state.currentUser.roles[0] || 'OFFICE',
          actionCode: `CREATE_${category}`,
          entityType: 'SERVICE',
          entityCode: workOrderCode,
          summary: `Tạo công việc ${category} (${workOrderCode}) cho container ${containerNo}`,
          createdAt: new Date().toISOString(),
        },
        ...state.auditLogs,
      ],
    });
    setSuccessMsg(`Đã tạo phiếu công việc ${workOrderCode} cho container ${containerNo}.`);
  };

  const handleApproveRepair = (woId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    if (!hasRolePermission(state.currentUser, ['MANAGER', 'OFFICE'])) {
      setErrorMsg('Không đủ quyền: Chỉ Quản lý bãi / Văn phòng được phê duyệt dự toán sửa chữa M&R.');
      return;
    }

    const target = state.workOrders.find((w) => w.id === woId);
    if (!target) return;

    onUpdateState({
      ...state,
      workOrders: state.workOrders.map((w) =>
        w.id === woId
          ? {
              ...w,
              approvalStatus: 'APPROVED',
              approvedBy: state.currentUser.fullName,
            }
          : w
      ),
      auditLogs: [
        {
          id: `aud-${Date.now()}`,
          actorName: state.currentUser.fullName,
          actorRole: state.currentUser.roles[0] || 'MANAGER',
          actionCode: 'APPROVE_REPAIR_ESTIMATE',
          entityType: 'SERVICE',
          entityCode: target.workOrderCode,
          summary: `Phê duyệt dự toán sửa chữa M&R ${target.workOrderCode} (${formatVnd(target.estimateCost)}) cho ${target.containerNo}`,
          createdAt: new Date().toISOString(),
        },
        ...state.auditLogs,
      ],
    });
    setSuccessMsg(`Đã phê duyệt dự toán M&R ${target.workOrderCode}.`);
  };

  const handleCompleteWorkOrder = (woId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    const target = state.workOrders.find((w) => w.id === woId);
    if (!target) return;

    // SRV-004: Chặn hoàn tất sửa chữa M&R khi chưa phê duyệt dự toán
    if (target.category === 'REPAIR' && target.approvalStatus !== 'APPROVED') {
      setErrorMsg(
        `Chặn thao tác (SRV-004): Phiếu sửa chữa M&R ${target.workOrderCode} chưa được phê duyệt dự toán (${target.approvalStatus}).`
      );
      return;
    }

    onUpdateState({
      ...state,
      workOrders: state.workOrders.map((w) =>
        w.id === woId
          ? {
              ...w,
              workStatus: 'COMPLETED',
              completedAt: new Date().toISOString(),
              resultNotes: 'Đã hoàn thành và nghiệm thu đạt tiêu chuẩn cấp vỏ (AV)',
            }
          : w
      ),
      // Nếu hoàn tất sửa chữa M&R thì cập nhật phân loại container sang AV
      containers:
        target.category === 'REPAIR'
          ? state.containers.map((c) =>
              c.containerNo === target.containerNo ? { ...c, conditionClass: 'AV' } : c
            )
          : state.containers,
      auditLogs: [
        {
          id: `aud-${Date.now()}`,
          actorName: state.currentUser.fullName,
          actorRole: state.currentUser.roles[0] || 'INSPECTOR',
          actionCode: 'COMPLETE_SERVICE_WO',
          entityType: 'SERVICE',
          entityCode: target.workOrderCode,
          summary: `Nghiệm thu hoàn thành công việc ${target.workOrderCode} cho container ${target.containerNo}`,
          createdAt: new Date().toISOString(),
        },
        ...state.auditLogs,
      ],
    });
    setSuccessMsg(`Đã nghiệm thu hoàn thành công việc ${target.workOrderCode}.`);
  };

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <p className="font-semibold">Vi phạm điều kiện quy trình dịch vụ</p>
            <p>{errorMsg}</p>
          </div>
        </div>
      )}

      {successMsg && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
          <div>
            <p className="font-semibold">Thành công</p>
            <p>{successMsg}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="mb-4 flex items-center gap-2.5 border-b border-slate-100 pb-3">
            <div className="rounded-lg bg-indigo-50 p-2 text-indigo-600">
              <PlusCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Tạo Yêu Cầu Dịch Vụ Phát Sinh (DEC-002)
              </h2>
              <p className="text-xs text-slate-500">
                Không mặc định mọi cont đều làm mọi dịch vụ; chỉ tạo khi có nhu cầu
              </p>
            </div>
          </div>

          <form onSubmit={handleCreateWorkOrder} className="space-y-4 text-sm">
            <div>
              <label className="mb-1 block font-medium text-slate-700">Chọn Container</label>
              <select
                value={containerNo}
                onChange={(e) => setContainerNo(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs font-bold"
              >
                {activeContainers.map((c) => (
                  <option key={c.id} value={c.containerNo}>
                    {c.containerNo} ({c.size}&apos;{c.type} — {c.conditionClass})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block font-medium text-slate-700">Loại dịch vụ</label>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as 'CLEANING' | 'INSPECTION' | 'REPAIR')
                }
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value="CLEANING">Vệ sinh container (CLEANING)</option>
                <option value="INSPECTION">Giám định tình trạng (INSPECTION)</option>
                <option value="REPAIR">Sửa chữa M&R (REPAIR — cần duyệt dự toán)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block font-medium text-slate-700">
                Hạng mục thực hiện / Vị trí hư hỏng (cách nhau bởi dấu phẩy)
              </label>
              <textarea
                rows={3}
                value={itemsText}
                onChange={(e) => setItemsText(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
                required
              />
            </div>

            {category === 'REPAIR' && (
              <div>
                <label className="mb-1 block font-medium text-slate-700">
                  Dự toán chi phí sửa chữa M&R (VNĐ)
                </label>
                <input
                  type="number"
                  value={estimateCost}
                  onChange={(e) => setEstimateCost(Number(e.target.value))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-semibold"
                />
              </div>
            )}

            <button
              type="submit"
              className="w-full rounded-xl bg-indigo-600 px-4 py-2.5 font-semibold text-white hover:bg-indigo-700 transition"
            >
              Tạo Phiếu Công Việc Dịch Vụ
            </button>
          </form>
        </div>

        <div className="lg:col-span-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Wrench className="h-4 w-4 text-indigo-600" />
              Danh Sách Công Việc Vệ Sinh, Giám Định & Sửa Chữa M&R
            </h3>
            <span className="text-xs text-slate-500">
              Quy tắc SRV-004: Sửa chữa M&R bắt buộc được duyệt dự toán trước khi hoàn tất
            </span>
          </div>

          <div className="space-y-3">
            {state.workOrders.map((wo) => (
              <div
                key={wo.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs sm:flex-row sm:items-center"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-bold text-slate-900">{wo.workOrderCode}</span>
                    <span className="font-mono font-bold text-blue-700">{wo.containerNo}</span>
                    <span
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-bold ${
                        wo.category === 'REPAIR'
                          ? 'bg-rose-100 text-rose-700'
                          : wo.category === 'CLEANING'
                          ? 'bg-sky-100 text-sky-700'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {wo.category === 'CLEANING' && <Sparkles className="h-3 w-3" />}
                      {wo.category === 'REPAIR' && <Hammer className="h-3 w-3" />}
                      {wo.category}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 font-semibold ${
                        wo.workStatus === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {wo.workStatus}
                    </span>
                  </div>
                  <p className="text-slate-700 font-medium">
                    Hạng mục: {wo.items.join(' • ')}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Phụ trách: {wo.assignedTo}
                    {wo.estimateCost > 0 && ` | Dự toán: ${formatVnd(wo.estimateCost)}`}
                    {wo.category === 'REPAIR' && ` | Trạng thái duyệt: ${wo.approvalStatus}`}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {wo.category === 'REPAIR' && wo.approvalStatus === 'PENDING_APPROVAL' && (
                    <button
                      type="button"
                      onClick={() => handleApproveRepair(wo.id)}
                      className="rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white hover:bg-amber-700"
                    >
                      Phê duyệt dự toán
                    </button>
                  )}

                  {wo.workStatus !== 'COMPLETED' && (
                    <button
                      type="button"
                      onClick={() => handleCompleteWorkOrder(wo.id)}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 font-semibold text-white hover:bg-emerald-700"
                    >
                      Nghiệm thu hoàn thành
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
