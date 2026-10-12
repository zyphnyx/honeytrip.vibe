"use client";

import { useState } from "react";
import { bahtToSatang, satangToBaht } from "@/lib/financeTypes";
import { createDue } from "@/lib/finance";
import type { Member } from "@/lib/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  members: Member[];
  activities?: Array<{ id: string; title: string }>;
  onCreated?: () => void;
}

export function DueCreateModal({
  isOpen,
  onClose,
  roomId,
  members,
  activities = [],
  onCreated,
}: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [linkedActivityId, setLinkedActivityId] = useState("");
  const [totalBaht, setTotalBaht] = useState("");
  const [selectedUids, setSelectedUids] = useState<Set<string>>(
    () => new Set(members.filter((m) => m.status !== "out").map((m) => m.id))
  );
  const [customAllocations, setCustomAllocations] = useState<Record<string, string>>({});
  const [isCustomAllocation, setIsCustomAllocation] = useState(false);
  const [saving, setSaving] = useState(false);

  if (!isOpen) return null;

  const totalSatang = bahtToSatang(Number(totalBaht) || 0);
  const activeMembers = members.filter((m) => selectedUids.has(m.id));

  // Compute even split satang per member
  const evenSplitSatang =
    activeMembers.length > 0 ? Math.floor(totalSatang / activeMembers.length) : 0;
  const remainderSatang =
    activeMembers.length > 0 ? totalSatang - evenSplitSatang * activeMembers.length : 0;

  function handleToggleMember(uid: string) {
    const next = new Set(selectedUids);
    if (next.has(uid)) next.delete(uid);
    else next.add(uid);
    setSelectedUids(next);
  }

  function handleSelectAll() {
    setSelectedUids(new Set(members.map((m) => m.id)));
  }

  async function handleSave() {
    if (!title.trim()) {
      alert("กรุณาระบุชื่อรายการเรียกเก็บ");
      return;
    }
    if (totalSatang <= 0) {
      alert("กรุณาระบุยอดรวมที่ถูกต้อง");
      return;
    }
    if (selectedUids.size === 0) {
      alert("กรุณาเลือกสมาชิกอย่างน้อย 1 คน");
      return;
    }

    const allocations: Record<string, number> = {};

    if (isCustomAllocation) {
      let sumCustomSatang = 0;
      for (const m of activeMembers) {
        const satang = bahtToSatang(Number(customAllocations[m.id]) || 0);
        allocations[m.id] = satang;
        sumCustomSatang += satang;
      }
      if (sumCustomSatang !== totalSatang) {
        if (
          !confirm(
            `ยอดรวมที่ระบุรายคน (฿${satangToBaht(sumCustomSatang)}) ไม่ตรงกับยอดรวม (฿${satangToBaht(totalSatang)}) คุณต้องการดำเนินการต่อหรือไม่?`
          )
        ) {
          return;
        }
      }
    } else {
      // Deterministic integer satang split (remainder to first members)
      activeMembers.forEach((m, idx) => {
        allocations[m.id] = evenSplitSatang + (idx < remainderSatang ? 1 : 0);
      });
    }

    setSaving(true);
    try {
      await createDue(roomId, {
        title: title.trim(),
        description: description.trim(),
        dueDate: dueDate || null,
        totalAmountSatang: totalSatang,
        allocations,
        linkedActivityId: linkedActivityId || null,
      });

      onCreated?.();
      onClose();
    } catch (err) {
      alert("เกิดข้อผิดพลาดในการสร้างรายการ: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-lg border-amber-300/80 bg-white shadow-2xl p-4 sm:p-6 space-y-4 my-auto max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-xl shadow-xs">
              ➕
            </span>
            <div>
              <h2 className="text-base font-bold text-stone-900">สร้างรายการเรียกเก็บเงิน</h2>
              <p className="text-xs text-stone-500">กำหนดรายการหารค่าใช้จ่ายและวันครบกำหนด</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label">ชื่อรายการเรียกเก็บ</label>
            <input
              type="text"
              placeholder="เช่น มัดจำที่พัก 50%, ค่ารถตู้, กองกลางทริป"
              className="input text-base"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">ยอดรวมทั้งหมด (บาท)</label>
              <input
                type="number"
                step="0.01"
                min="1"
                placeholder="เช่น 2400"
                className="input text-base font-bold tabular-nums"
                value={totalBaht}
                onChange={(e) => setTotalBaht(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label">วันครบกำหนดชำระ</label>
              <input
                type="date"
                className="input text-sm"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label">คำอธิบายหรือรายละเอียด</label>
            <input
              type="text"
              placeholder="เช่น โอนก่อนวันศุกร์นี้เพื่อจองที่พัก"
              className="input text-sm"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {activities.length > 0 && (
            <div>
              <label className="label">เชื่อมโยงกับกิจกรรมในแผนเที่ยว (ถ้ามี)</label>
              <select
                className="input text-sm bg-white"
                value={linkedActivityId}
                onChange={(e) => setLinkedActivityId(e.target.value)}
              >
                <option value="">(ไม่ระบุ)</option>
                {activities.map((act) => (
                  <option key={act.id} value={act.id}>
                    {act.title}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Members allocation section */}
          <div className="space-y-2 pt-2 border-t border-stone-100">
            <div className="flex items-center justify-between">
              <label className="label !mb-0">สมาชิกที่ต้องร่วมจ่าย ({activeMembers.length} คน)</label>
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-amber-700 hover:underline cursor-pointer"
                >
                  เลือกทุกคน
                </button>
                <span>·</span>
                <button
                  type="button"
                  onClick={() => setIsCustomAllocation(!isCustomAllocation)}
                  className="text-amber-700 hover:underline cursor-pointer"
                >
                  {isCustomAllocation ? "หารเท่ากัน" : "ระบุรายคน"}
                </button>
              </div>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-xl border border-stone-200 bg-stone-50/50 p-2">
              {members.map((m) => {
                const isSelected = selectedUids.has(m.id);
                return (
                  <div
                    key={m.id}
                    className={`flex items-center justify-between p-2 rounded-lg transition-colors ${
                      isSelected ? "bg-white shadow-2xs border border-stone-200" : "opacity-60"
                    }`}
                  >
                    <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleMember(m.id)}
                        className="rounded border-stone-300 text-amber-500 focus:ring-amber-400"
                      />
                      <span className="text-base">{m.emoji}</span>
                      <span className="text-xs font-semibold text-stone-800 truncate">{m.name}</span>
                    </label>

                    {isSelected && (
                      <div className="shrink-0 text-xs tabular-nums font-bold text-amber-900">
                        {isCustomAllocation ? (
                          <input
                            type="number"
                            step="0.01"
                            placeholder="฿"
                            value={customAllocations[m.id] || ""}
                            onChange={(e) =>
                              setCustomAllocations({
                                ...customAllocations,
                                [m.id]: e.target.value,
                              })
                            }
                            className="w-20 text-right px-2 py-1 rounded border border-stone-300 text-xs"
                          />
                        ) : (
                          `~฿${satangToBaht(evenSplitSatang).toLocaleString()}`
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 pt-3 border-t border-stone-100">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="btn-secondary flex-1 !py-2.5 text-xs font-semibold"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex-1 !py-2.5 text-xs font-bold shadow-sm"
          >
            {saving ? "กำลังบันทึก…" : "✓ สร้างรายการเรียกเก็บ"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default DueCreateModal;
