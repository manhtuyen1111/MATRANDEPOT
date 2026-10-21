import React, { useState } from 'react';
import {
  Check,
  MessageSquarePlus,
  Pencil,
  Pin,
  Search,
  X,
} from 'lucide-react';
import {
  DepotState,
  INITIAL_CONTAINER_SIZES,
  INITIAL_CONTAINER_TYPES,
} from '../../services/depotStore';
import { updateContainerOfficeNote } from '../../services/depotOperations';
import {
  ContainerRecord,
  ContainerSize,
  ContainerType,
  FieldConditionClass,
  K80InternalTicket,
} from '../../types/depot';

interface Props {
  state: DepotState;
  onUpdateState: (next: DepotState) => void;
  onOpenDossier?: (masterDossierCode: string) => void;
  onOpenK80Ticket?: (ticket: K80InternalTicket) => void;
}

export const YardFeature: React.FC<Props> = ({
  state,
  onUpdateState,
  onOpenDossier,
}) => {
  const [searchContNo, setSearchContNo] = useState<string>('');
  const [filterSize, setFilterSize] = useState<'ALL' | ContainerSize>('ALL');
  const [filterType, setFilterType] = useState<'ALL' | ContainerType>('ALL');
  const [filterCondition, setFilterCondition] = useState<
    'ALL' | FieldConditionClass
  >('ALL');

  // Chỉnh sửa cột Ghi chú trực tiếp trên dòng TỒN VỎ
  const [editingNoteContId, setEditingNoteContId] = useState<string | null>(
    null
  );
  const [noteDraft, setNoteDraft] = useState<string>('');

  const containerSizes =
    state.containerSizes && state.containerSizes.length > 0
      ? state.containerSizes
      : INITIAL_CONTAINER_SIZES;
  const containerTypes =
    state.containerTypes && state.containerTypes.length > 0
      ? state.containerTypes
      : INITIAL_CONTAINER_TYPES;

  // Danh sách các container đang tồn vỏ thực tế trên hệ thống
  const activeContainers = state.containers.filter(
    (c) => c.status !== 'GATED_OUT'
  );

  // Sắp xếp ưu tiên các container có Ghi chú (focus hơn) lên đầu hoặc làm nổi bật
  const filteredContainers = activeContainers
    .filter((c) => {
      if (
        searchContNo.trim() &&
        !c.containerNo.toUpperCase().includes(searchContNo.trim().toUpperCase())
      ) {
        return false;
      }
      if (filterSize !== 'ALL' && c.size !== filterSize) return false;
      if (filterType !== 'ALL' && c.type !== filterType) return false;
      if (filterCondition !== 'ALL' && c.conditionClass !== filterCondition)
        return false;
      return true;
    })
    .sort((a, b) => {
      const aHasNote = Boolean(a.officeNote?.trim());
      const bHasNote = Boolean(b.officeNote?.trim());
      if (aHasNote !== bHasNote) return aHasNote ? -1 : 1;
      return new Date(b.gateInAt).getTime() - new Date(a.gateInAt).getTime();
    });

  const handleStartEditNote = (e: React.MouseEvent, c: ContainerRecord) => {
    e.stopPropagation();
    setEditingNoteContId(c.id);
    setNoteDraft(c.officeNote || '');
  };

  const handleSaveNote = (e: React.MouseEvent, containerId: string) => {
    e.stopPropagation();
    const next = updateContainerOfficeNote(state, {
      containerId,
      officeNote: noteDraft,
    });
    onUpdateState(next);
    setEditingNoteContId(null);
    setNoteDraft('');
  };

  return (
    <div className="w-full space-y-3">
      {/* THANH TIÊU ĐỀ, TÌM KIẾM SỐ CONT & BỘ LỌC SIZE - TYPE - TRẠNG THÁI */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-xs">
        <div>
          <h2 className="text-sm font-bold text-slate-900">
            TỒN VỎ HIỆN TẠI ({filteredContainers.length} /{' '}
            {activeContainers.length} cont)
          </h2>
          <p className="text-[11px] text-slate-500">
            Kích vào dòng container để mở toàn bộ <strong>Hồ sơ Phiếu EEIR</strong> (In Điều Động K80 • In EEIR • In Phiếu Thu) • Cont có <strong>Ghi chú</strong> được focus nổi bật
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Ô TÌM KIẾM SỐ CONTAINER */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchContNo}
              onChange={(e) => setSearchContNo(e.target.value.toUpperCase())}
              placeholder="Tìm kiếm số cont..."
              className="w-48 rounded border border-blue-300 bg-blue-50/30 pl-8 pr-2.5 py-1.5 font-mono text-xs font-bold uppercase text-slate-900 placeholder:font-sans placeholder:font-normal placeholder:normal-case placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-hidden"
            />
          </div>

          {/* LỌC SIZE */}
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-600">SIZE:</span>
            <select
              value={filterSize}
              onChange={(e) =>
                setFilterSize(e.target.value as 'ALL' | ContainerSize)
              }
              className="rounded border border-slate-300 bg-white px-2.5 py-1.5 font-semibold text-slate-800"
            >
              <option value="ALL">Tất cả</option>
              {containerSizes.map((sz) => (
                <option key={sz} value={sz}>
                  {sz}
                </option>
              ))}
            </select>
          </div>

          {/* LỌC TYPE */}
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-600">TYPE:</span>
            <select
              value={filterType}
              onChange={(e) =>
                setFilterType(e.target.value as 'ALL' | ContainerType)
              }
              className="rounded border border-slate-300 bg-white px-2.5 py-1.5 font-semibold text-slate-800"
            >
              <option value="ALL">Tất cả</option>
              {containerTypes.map((tp) => (
                <option key={tp} value={tp}>
                  {tp}
                </option>
              ))}
            </select>
          </div>

          {/* LỌC TRẠNG THÁI */}
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-slate-600">TRẠNG THÁI:</span>
            <select
              value={filterCondition}
              onChange={(e) =>
                setFilterCondition(
                  e.target.value as 'ALL' | FieldConditionClass
                )
              }
              className="rounded border border-slate-300 bg-white px-2.5 py-1.5 font-semibold text-slate-800"
            >
              <option value="ALL">Tất cả</option>
              <option value="AV">AV</option>
              <option value="DAMAGE">DAMAGE</option>
            </select>
          </div>

          {(searchContNo.trim() !== '' ||
            filterSize !== 'ALL' ||
            filterType !== 'ALL' ||
            filterCondition !== 'ALL') && (
            <button
              type="button"
              onClick={() => {
                setSearchContNo('');
                setFilterSize('ALL');
                setFilterType('ALL');
                setFilterCondition('ALL');
              }}
              className="rounded border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-medium text-slate-600 hover:bg-slate-100"
            >
              Xóa lọc
            </button>
          )}
        </div>
      </div>

      {/* DANH SÁCH CONTAINER TỒN VỎ HIỆN TẠI (CONT CÓ GHI CHÚ SẼ ĐƯỢC FOCUS HƠN) */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-100 font-bold text-slate-700">
              <th className="px-3.5 py-2.5">Mã Hồ Sơ (Phiếu EEIR)</th>
              <th className="px-3.5 py-2.5">Số Container</th>
              <th className="px-3.5 py-2.5">Size</th>
              <th className="px-3.5 py-2.5">Type</th>
              <th className="px-3.5 py-2.5">Trạng thái</th>
              <th className="px-3.5 py-2.5">Vị trí (Xe nâng)</th>
              <th className="px-3.5 py-2.5">Tiến độ các bộ phận</th>
              <th className="px-3.5 py-2.5 w-72">Ghi chú (Văn phòng)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {filteredContainers.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-8 text-center text-xs text-slate-400"
                >
                  Không có container tồn vỏ nào khớp với tìm kiếm / bộ lọc hiện tại.
                </td>
              </tr>
            ) : (
              filteredContainers.map((c) => {
                const hasCleaningPlan = c.cleaningItems.some(
                  (i) => i !== 'KHÔNG VỆ SINH'
                );
                const hasNote = Boolean(c.officeNote?.trim());
                const isEditingNote = editingNoteContId === c.id;

                return (
                  <tr
                    key={c.id}
                    onClick={() => onOpenDossier?.(c.masterDossierCode)}
                    className={`cursor-pointer transition ${
                      hasNote
                        ? 'bg-amber-50/95 hover:bg-amber-100/80 border-l-4 border-l-amber-500 shadow-xs'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <td className="px-3.5 py-3 font-mono font-bold text-blue-700">
                      <div className="flex items-center gap-1.5">
                        {hasNote && (
                          <span
                            title="Container đang có Ghi chú cần chú ý"
                            className="inline-flex items-center justify-center rounded bg-amber-500 p-0.5 text-white"
                          >
                            <Pin className="h-3 w-3" />
                          </span>
                        )}
                        <span>{c.masterDossierCode}</span>
                      </div>
                    </td>
                    <td className="px-3.5 py-3 font-mono text-sm font-black text-slate-900">
                      {c.containerNo}
                    </td>
                    <td className="px-3.5 py-3 font-mono font-semibold text-slate-800">
                      {c.size}
                    </td>
                    <td className="px-3.5 py-3 font-mono font-semibold text-slate-800">
                      {c.type}
                    </td>
                    <td className="px-3.5 py-3">
                      <span
                        className={`inline-block rounded px-2.5 py-0.5 font-bold ${
                          c.conditionClass === 'DAMAGE'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-emerald-100 text-emerald-700'
                        }`}
                      >
                        {c.conditionClass}
                      </span>
                    </td>
                    <td className="px-3.5 py-3 font-mono text-slate-700">
                      {c.currentBlock ? (
                        <span className="font-bold text-slate-900">
                          {c.currentBay
                            ? `${c.currentBlock} / ${c.currentBay}-${c.currentRow}-${c.currentTier}`
                            : c.currentBlock}
                        </span>
                      ) : (
                        <span className="text-amber-700 font-semibold">
                          Chờ Xe nâng hạ vỏ
                        </span>
                      )}
                    </td>
                    <td className="px-3.5 py-3">
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        {hasCleaningPlan ? (
                          c.needsCleaning ? (
                            <span className="rounded bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">
                              Chờ vệ sinh
                            </span>
                          ) : (
                            <span className="rounded bg-emerald-100 px-2 py-0.5 font-semibold text-emerald-800">
                              ✓ Đã vệ sinh
                            </span>
                          )
                        ) : (
                          <span className="rounded bg-slate-100 px-2 py-0.5 text-slate-600">
                            Không VS
                          </span>
                        )}

                        {c.needsQuotation && (
                          <span className="rounded bg-purple-100 px-2 py-0.5 font-semibold text-purple-800">
                            Chờ báo giá
                          </span>
                        )}
                        {c.needsRepair && (
                          <span className="rounded bg-rose-100 px-2 py-0.5 font-semibold text-rose-800">
                            Chờ sửa chữa
                          </span>
                        )}
                        {c.forkliftShiftTask !== 'NONE' && (
                          <span className="rounded bg-indigo-100 px-2 py-0.5 font-semibold text-indigo-800">
                            Xe nâng:{' '}
                            {c.forkliftShiftTask === 'HA_SUA_CHUA'
                              ? 'Chờ hạ sửa chữa'
                              : 'Chờ hạ kệ GĐ'}
                          </span>
                        )}
                        {c.status === 'ALLOCATED' && (
                          <span className="rounded bg-blue-100 px-2 py-0.5 font-bold text-blue-800">
                            Chờ Xe nâng cấp vỏ
                          </span>
                        )}
                      </div>
                    </td>

                    {/* CỘT GHI CHÚ: NHÂN VIÊN VĂN PHÒNG THÊM GHI CHÚ VÀO KHU VỰC NÀY */}
                    <td
                      className="px-3.5 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {isEditingNote ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={noteDraft}
                            onChange={(e) => setNoteDraft(e.target.value)}
                            placeholder="Nhập ghi chú văn phòng..."
                            autoFocus
                            className="flex-1 rounded border border-amber-400 bg-white px-2 py-1 text-xs font-semibold text-slate-900 focus:outline-hidden"
                          />
                          <button
                            type="button"
                            onClick={(e) => handleSaveNote(e, c.id)}
                            className="rounded bg-emerald-600 p-1.5 text-white hover:bg-emerald-700"
                            title="Lưu ghi chú"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingNoteContId(null);
                            }}
                            className="rounded border border-slate-300 bg-white p-1.5 text-slate-600 hover:bg-slate-100"
                            title="Hủy"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ) : hasNote ? (
                        <div className="flex items-start justify-between gap-2 rounded-lg border border-amber-400 bg-amber-100/90 px-2.5 py-1.5 text-amber-950">
                          <div className="min-w-0">
                            <span className="block text-[10px] font-black uppercase text-amber-800">
                              📌 GHI CHÚ FOCUS:
                            </span>
                            <p className="font-bold text-xs break-words">
                              {c.officeNote}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => handleStartEditNote(e, c)}
                            className="shrink-0 rounded bg-white/80 p-1 text-amber-900 hover:bg-white"
                            title="Sửa / Xóa ghi chú"
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => handleStartEditNote(e, c)}
                          className="inline-flex items-center gap-1 rounded border border-dashed border-slate-300 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:border-amber-400 hover:bg-amber-50 hover:text-amber-900"
                        >
                          <MessageSquarePlus className="h-3.5 w-3.5" />
                          + Thêm ghi chú
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
