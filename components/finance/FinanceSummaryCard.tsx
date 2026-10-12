"use client";

import Link from "next/link";
import { formatSatang } from "@/lib/financeTypes";
import type { FinanceSummary } from "@/lib/financeCalc";

export function FinanceSummaryCard({
  roomId,
  summary,
  isManager,
}: {
  roomId: string;
  summary: FinanceSummary;
  isManager: boolean;
}) {
  const fundBalance = formatSatang(summary.confirmedFundBalanceSatang);
  const pendingCount = summary.pendingReviewCount;
  const outstanding = formatSatang(summary.totalOutstandingSatang);

  return (
    <div className="card border-amber-200/80 bg-gradient-to-br from-amber-50/70 via-white to-amber-50/40 p-4 space-y-3 shadow-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-400 text-base shadow-xs">
            💸
          </span>
          <div>
            <h2 className="text-sm font-bold text-stone-900 tracking-tight">การเงินทริป</h2>
            <p className="text-[11px] text-stone-500">
              กองกลาง · ยอดค้างชำระ · ตรวจสลิปโอนเงิน
            </p>
          </div>
        </div>

        {pendingCount > 0 && isManager && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-300 animate-pulse">
            ⏳ รอตรวจ {pendingCount} สลิป
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-xl border border-stone-200/70 bg-white/90 p-2.5">
          <div className="text-[11px] text-stone-400 font-medium">เงินกองกลางที่ยืนยันแล้ว</div>
          <div className="mt-0.5 font-bold text-stone-900 text-sm tabular-nums">
            {fundBalance}
          </div>
        </div>

        <div className="rounded-xl border border-stone-200/70 bg-white/90 p-2.5">
          <div className="text-[11px] text-stone-400 font-medium">ยอดคงค้างทั้งหมด</div>
          <div className="mt-0.5 font-bold text-amber-700 text-sm tabular-nums">
            {summary.totalOutstandingSatang > 0 ? outstanding : "✓ ชำระครบแล้ว"}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-stone-100">
        <span className="text-[11px] text-stone-500">
          {summary.totalIncomingSatang > 0
            ? `รับเข้าแล้ว ${formatSatang(summary.totalIncomingSatang)}`
            : "ยังไม่มีรายการชำระ"}
        </span>
        <Link
          href={`/t/${roomId}/finance`}
          className="inline-flex items-center gap-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs px-3 py-1.5 shadow-xs transition-transform active:scale-95"
        >
          <span>เปิดการเงินทริป</span>
          <span>→</span>
        </Link>
      </div>
    </div>
  );
}
