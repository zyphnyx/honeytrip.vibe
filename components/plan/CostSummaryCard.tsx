"use client";

import { useState } from "react";
import type { Member, PlanBudgetSummary } from "@/lib/types";

export function CostSummaryCard({
  budget,
  members = [],
}: {
  budget: PlanBudgetSummary;
  members?: Member[];
}) {
  const [showBreakdown, setShowBreakdown] = useState(false);

  const activeActivitiesCount = budget.confirmedCount + budget.completedCount;

  return (
    <div className="card border-amber-200/80 bg-white p-4 space-y-3 shadow-xs">
      <div className="flex items-center justify-between border-b border-stone-100 pb-2">
        <div className="flex items-center gap-1.5 font-bold text-stone-900 text-sm">
          <span>💰</span>
          <span>ประมาณการงบประมาณทริป</span>
        </div>
        <span className="text-[11px] text-stone-400 font-medium">
          {activeActivitiesCount} กิจกรรมที่คำนวณ
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl bg-amber-50/70 p-3 border border-amber-200/60">
          <div className="text-[11px] text-amber-800 font-medium">ยอดรวมทั้งทริป (กลุ่ม)</div>
          <div className="mt-1 text-2xl font-extrabold text-stone-900 tabular-nums">
            ~฿{budget.totalEstimated.toLocaleString("th-TH")}
          </div>
          <div className="mt-0.5 text-[10px] text-amber-700/80">
            เฉพาะกิจกรรมที่ยืนยันแล้ว
          </div>
        </div>

        <div className="rounded-2xl bg-stone-50 p-3 border border-stone-200/70">
          <div className="text-[11px] text-stone-500 font-medium">สถานะราคา</div>
          <div className="mt-1 text-xs font-semibold text-stone-800 space-y-1">
            <div className="flex justify-between items-center">
              <span>ฟรี:</span>
              <span className="tabular-nums font-bold text-emerald-700">{budget.freeCostCount} รายการ</span>
            </div>
            <div className="flex justify-between items-center">
              <span>ยังไม่ระบุราคา:</span>
              <span className={`tabular-nums font-bold ${budget.unknownCostCount > 0 ? "text-amber-700" : "text-stone-400"}`}>
                {budget.unknownCostCount} รายการ
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Member Cost Breakdown Toggle */}
      {members.length > 0 && budget.totalEstimated > 0 && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowBreakdown((v) => !v)}
            className="flex w-full items-center justify-between text-xs font-semibold text-stone-600 hover:text-stone-900 py-1 transition-colors"
          >
            <span>👥 ดูประมาณการแยกตามเพื่อนแต่ละคน ({members.length} คน)</span>
            <span>{showBreakdown ? "▲" : "▼"}</span>
          </button>

          {showBreakdown && (
            <div className="mt-2 space-y-1.5 rounded-2xl border border-stone-200/70 bg-stone-50/60 p-2.5 text-xs animate-in fade-in duration-100">
              {members.map((m) => {
                const amount = budget.byParticipant[m.id] || 0;
                return (
                  <div key={m.id} className="flex items-center justify-between py-1 border-b border-stone-100 last:border-0">
                    <div className="flex items-center gap-1.5 truncate">
                      <span>{m.emoji}</span>
                      <span className="font-medium text-stone-800 truncate">{m.name}</span>
                    </div>
                    <span className="font-bold text-stone-900 tabular-nums shrink-0">
                      ~฿{Math.round(amount).toLocaleString("th-TH")}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Non-monetary disclaimer */}
      <div className="rounded-xl bg-stone-50 p-2 text-[10px] text-stone-500 border border-stone-200/60 leading-relaxed">
        ℹ️ <span className="font-semibold text-stone-600">คำชี้แจง:</span> ตัวเลขงบประมาณนี้เป็นเพียงการคำนวณล่วงหน้าจากการวางแผนร่วมกัน ไม่ใช่ยอดที่มีการเก็บเงินจริง หากต้องการโอนกองกลาง โปรดใช้ปุ่มโอนเงินกองกลางที่หน้าภาพรวม
      </div>
    </div>
  );
}
