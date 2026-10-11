"use client";

import { useEffect, useState } from "react";
import {
  calculateInclusiveDays,
  getConfirmedActivitiesOutsideRange,
  validateTripDateRange,
} from "@/lib/activityDates";
import type { Activity, TripPlanMeta } from "@/lib/types";

export function PlanDateSetup({
  isOpen,
  onClose,
  meta,
  activities = [],
  onSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  meta: TripPlanMeta | null | undefined;
  activities?: Activity[];
  onSave: (data: { startDate: string; endDate: string }) => Promise<void>;
}) {
  const [startDate, setStartDate] = useState(meta?.startDate || "");
  const [endDate, setEndDate] = useState(meta?.endDate || "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);


  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const validation = validateTripDateRange(startDate, endDate);
  const days = calculateInclusiveDays(startDate, endDate);

  // ตรวจกิจกรรมที่อาจหลุดช่วงถ้าเปลี่ยนวัน
  const orphanedActivities =
    validation.valid && startDate && endDate
      ? getConfirmedActivitiesOutsideRange(activities, startDate, endDate)
      : [];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validation.valid) {
      setError(validation.error || "กรุณากรอกวันที่ให้ถูกต้อง");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSave({ startDate, endDate });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="date-setup-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-4 backdrop-blur-xs animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-3xl bg-white p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">📅</span>
            <h2 id="date-setup-title" className="text-base font-bold text-stone-900">
              กำหนดวันเดินทางจริง
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-stone-400 hover:bg-stone-100 transition-colors cursor-pointer"
            aria-label="ปิดหน้าต่าง"
          >
            ✕
          </button>
        </div>

        <p className="text-xs text-stone-500 leading-relaxed">
          เมื่อทุกคนเลือกวันว่างใน Dashboard จนสรุปได้แล้ว ให้ปักหมุดวันเดินทางจริงที่นี่
          เพื่อใช้สร้างตารางเที่ยว Day 1, Day 2...
        </p>

        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="plan-start-date" className="text-xs font-semibold text-stone-700">
                วันเริ่มต้น
              </label>
              <input
                id="plan-start-date"
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  if (!endDate || endDate < e.target.value) setEndDate(e.target.value);
                  setError(null);
                }}
                required
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-base sm:text-sm text-stone-900 focus:border-amber-400 focus:bg-white focus:outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="plan-end-date" className="text-xs font-semibold text-stone-700">
                วันสิ้นสุด
              </label>
              <input
                id="plan-end-date"
                type="date"
                value={endDate}
                min={startDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setError(null);
                }}
                required
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-base sm:text-sm text-stone-900 focus:border-amber-400 focus:bg-white focus:outline-hidden"
              />
            </div>
          </div>

          {validation.valid && days > 0 && (
            <div className="rounded-xl bg-amber-50 p-2.5 text-xs text-amber-900 flex items-center justify-between border border-amber-200/60 font-medium">
              <span>ความยาวทริปทั้งหมด:</span>
              <span className="font-bold">{days} วัน {Math.max(0, days - 1)} คืน</span>
            </div>
          )}

          {orphanedActivities.length > 0 && (
            <div className="rounded-2xl border border-amber-300 bg-amber-50/80 p-3 text-xs text-amber-900 space-y-1">
              <div className="font-bold flex items-center gap-1 text-amber-800">
                <span>⚠️</span>
                <span>คำเตือน: มีกิจกรรมที่อยู่นอกช่วงวันใหม่</span>
              </div>
              <p className="text-[11px] leading-relaxed">
                พบ {orphanedActivities.length} กิจกรรมที่ระบุวันไว้เดิมแต่จะอยู่นอกช่วงวันที่เลือกใหม่
                (ระบบจะไม่ลบกิจกรรมของคุณ แต่กิจกรรมเหล่านั้นจะไม่ปรากฏในตารางเที่ยวจนกว่าจะแก้ไขวัน)
              </p>
              <ul className="list-disc pl-4 text-[11px] text-stone-700 pt-1">
                {orphanedActivities.slice(0, 3).map((act) => (
                  <li key={act.id} className="truncate">
                    {act.title} ({act.date})
                  </li>
                ))}
                {orphanedActivities.length > 3 && (
                  <li>และอีก {orphanedActivities.length - 3} รายการ...</li>
                )}
              </ul>
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="btn-ghost flex-1 !text-xs !py-2.5 cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSaving || !startDate || !endDate}
              className="btn-primary flex-1 !text-xs !py-2.5 font-bold cursor-pointer"
            >
              {isSaving ? "กำลังบันทึก…" : "บันทึกวันเดินทาง"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
