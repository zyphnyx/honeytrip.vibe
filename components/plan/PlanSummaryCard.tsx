"use client";

import Link from "next/link";
import { formatTripRangeHeader } from "@/lib/activityDates";
import type { Activity, PlanBudgetSummary, TripPlanMeta } from "@/lib/types";

export function PlanSummaryCard({
  roomId,
  meta,
  activities = [],
  budget,
}: {
  roomId: string;
  meta: TripPlanMeta | null | undefined;
  activities?: Activity[];
  budget: PlanBudgetSummary;
}) {
  const hasDates = Boolean(meta?.startDate && meta?.endDate);
  const confirmedCount = budget.confirmedCount + budget.completedCount;
  const totalCount = activities.length;

  return (
    <div className="card border-amber-200/80 bg-gradient-to-br from-amber-50/60 via-white to-amber-50/30 p-4 space-y-3 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400 text-base shadow-xs">
            🗓️
          </span>
          <div>
            <h2 className="text-sm font-bold text-stone-900 tracking-tight">แผนเที่ยวของเรา</h2>
            <p className="text-[11px] text-stone-500">
              {hasDates ? formatTripRangeHeader(meta?.startDate, meta?.endDate) : "ยังไม่ได้ระบุวันเดินทางจริง"}
            </p>
          </div>
        </div>

        {hasDates && (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 border border-emerald-200">
            ✓ ล็อกวันแล้ว
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl border border-stone-200/70 bg-white/90 p-2.5">
          <div className="text-[11px] text-stone-400 font-medium">กิจกรรมในแผน</div>
          <div className="mt-0.5 font-bold text-stone-800">
            {confirmedCount > 0 ? (
              <span className="text-emerald-700">{confirmedCount} กิจกรรม</span>
            ) : (
              <span className="text-stone-400">ยังไม่มี</span>
            )}
            {totalCount > confirmedCount && (
              <span className="text-[10px] text-stone-400 font-normal">
                {" "}
                (เสนอ {totalCount - confirmedCount})
              </span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-stone-200/70 bg-white/90 p-2.5">
          <div className="text-[11px] text-stone-400 font-medium">งบประมาณโดยประมาณ</div>
          <div className="mt-0.5 font-bold text-stone-800 tabular-nums">
            {budget.totalEstimated > 0 ? (
              `~฿${budget.totalEstimated.toLocaleString("th-TH")}`
            ) : (
              <span className="text-stone-400">ยังไม่ระบุ</span>
            )}
          </div>
        </div>
      </div>

      <Link
        href={`/t/${roomId}/plan`}
        className="btn-primary w-full flex items-center justify-center gap-1.5 !py-2.5 !text-xs font-bold shadow-xs hover:shadow-sm"
      >
        <span>เปิดแผนเที่ยว & ไอเดียเพื่อน</span>
        <span>→</span>
      </Link>
    </div>
  );
}
