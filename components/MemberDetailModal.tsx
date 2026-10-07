"use client";

import { useEffect } from "react";
import { PREFS, STATUSES } from "@/lib/constants";
import { formatShort } from "@/lib/dates";
import { baht } from "@/lib/stats";
import type { Member } from "@/lib/types";

interface Props {
  member: Member | null;
  isCurrent: boolean;
  onClose: () => void;
}

export function MemberDetailModal({ member, isCurrent, onClose }: Props) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (member) {
      window.addEventListener("keydown", onKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [member, onClose]);

  if (!member) return null;

  const statusObj = STATUSES.find((s) => s.id === member.status);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="member-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/40 backdrop-blur-xs animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-3xl border border-stone-200/80 bg-white p-5 sm:p-6 shadow-2xl transition-transform"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-xl text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors"
          aria-label="ปิดหน้าต่าง"
        >
          ✕
        </button>

        {/* Member Header */}
        <div className="flex items-center gap-3.5 border-b border-stone-100 pb-4">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-amber-100 border border-amber-200 text-3xl shadow-xs">
            {member.emoji}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 id="member-modal-title" className="truncate text-xl font-bold text-stone-900">
                {member.name}
              </h2>
              {isCurrent && (
                <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-bold text-stone-950">
                  เรา
                </span>
              )}
            </div>
            <div className="mt-1">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusObj?.color || "bg-stone-100 text-stone-600"}`}>
                {statusObj?.label || member.status}
              </span>
            </div>
          </div>
        </div>

        {/* Info Grid */}
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {/* Days */}
          <div className="rounded-2xl border border-stone-100 bg-stone-50/70 p-3">
            <div className="text-[11px] font-medium text-stone-500">⏱ สะดวกเที่ยว</div>
            <div className="mt-1 text-sm font-bold text-stone-900">
              {member.durationMin === member.durationMax
                ? `${member.durationMin} วัน`
                : `${member.durationMin}–${member.durationMax} วัน`}
            </div>
            <div className="text-[10px] text-stone-400 mt-0.5">
              ({member.durationMin} วัน {Math.max(1, member.durationMin - 1)} คืน)
            </div>
          </div>

          {/* Budget */}
          <div className="rounded-2xl border border-stone-100 bg-stone-50/70 p-3">
            <div className="text-[11px] font-medium text-stone-500">💰 งบประมาณต่อคน</div>
            <div className="mt-1 text-sm font-bold text-stone-900 tabular-nums truncate">
              {member.budgetMax > 0
                ? `${baht(member.budgetMin)}–${baht(member.budgetMax)}`
                : "ไม่ได้ระบุงบ"}
            </div>
            <div className="text-[10px] text-stone-400 mt-0.5">รวมทั้งทริป</div>
          </div>

          {/* Origin */}
          <div className="rounded-2xl border border-stone-100 bg-stone-50/70 p-3">
            <div className="text-[11px] font-medium text-stone-500">📍 จุดออกเดินทาง</div>
            <div className="mt-1 text-xs font-bold text-stone-900 line-clamp-2" title={member.origin}>
              {member.origin || "ไม่ได้ระบุ"}
            </div>
          </div>

          {/* Transport */}
          <div className="rounded-2xl border border-stone-100 bg-stone-50/70 p-3">
            <div className="text-[11px] font-medium text-stone-500">🚗 การเดินทาง</div>
            <div className="mt-1 text-xs font-bold text-stone-900">
              {member.transport === "own_car"
                ? `มีรถ (รับได้ ${member.seats} ที่)`
                : member.transport === "need_ride"
                ? "ขอติดรถไปด้วย"
                : "แบบไหนก็ได้"}
            </div>
          </div>
        </div>

        {/* Preferences */}
        {member.prefs.length > 0 && (
          <div className="mt-4">
            <div className="text-xs font-bold text-stone-700 mb-2">🎯 สไตล์ที่อยากไป</div>
            <div className="flex flex-wrap gap-1.5">
              {member.prefs.map((pId) => {
                const item = PREFS.find((p) => p.id === pId);
                return (
                  <span
                    key={pId}
                    className="rounded-full border border-amber-200/80 bg-amber-50 px-2.5 py-1 text-xs font-medium text-stone-800"
                  >
                    {item?.label || pId}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Available Dates */}
        {member.availableDates.length > 0 && (
          <div className="mt-4 border-t border-stone-100 pt-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold text-stone-700">📅 วันที่เลือกว่าง</span>
              <span className="text-[11px] font-medium text-stone-400">
                รวม {member.availableDates.length} วัน
              </span>
            </div>
            <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
              {member.availableDates.map((dateKey) => (
                <span
                  key={dateKey}
                  className="rounded-lg bg-stone-100 px-2 py-0.5 text-[11px] font-mono text-stone-700"
                >
                  {formatShort(dateKey)}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Note / Constraints */}
        {member.note && (
          <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-3 text-xs">
            <div className="font-bold text-amber-900 mb-0.5">💬 ข้อจำกัด / หมายเหตุ:</div>
            <p className="text-stone-700 leading-relaxed italic">&ldquo;{member.note}&rdquo;</p>
          </div>
        )}

        {/* Close CTA */}
        <div className="mt-5">
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost w-full !py-2.5 text-xs font-semibold"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}
