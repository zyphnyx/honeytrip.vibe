"use client";

import { Tooltip } from "@/components/Tooltip";
import type { VotingResults } from "@/lib/types";

interface VoteProgressProps {
  category: "stay" | "attraction";
  results: VotingResults;
}

export function VoteProgress({ category, results }: VoteProgressProps) {
  const isStay = category === "stay";
  const votersCount = isStay ? results.stayVotersCount : results.attractionVotersCount;
  const totalEligible = results.eligibleVotersCount;
  const percent = totalEligible > 0 ? Math.round((votersCount / totalEligible) * 100) : 0;
  const isTie = isStay ? results.isStayTie : results.isAttractionTie;
  const leadingCount = isStay ? results.leadingStays.length : results.leadingAttractions.length;

  return (
    <div className="rounded-2xl border border-amber-200/70 bg-linear-to-r from-amber-50/80 to-amber-100/40 p-3 shadow-xs">
      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1.5 font-bold text-amber-950">
          <span>{isStay ? "🗳️ การโหวตที่พัก (เลือกได้สูงสุด 3 ที่)" : "🗳️ การโหวตที่เที่ยว (เลือกได้สูงสุด 10 ที่)"}</span>
        </div>
        <div className="font-semibold text-amber-900">
          โหวตแล้ว {votersCount}/{totalEligible} คน ({percent}%)
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-amber-200/50">
        <div
          className="h-full rounded-full bg-amber-500 transition-all duration-300"
          style={{ width: `${percent}%` }}
        />
      </div>

      {/* Tie Alert / Leader Status */}
      {leadingCount > 0 && (
        <div className="mt-2.5 flex items-center justify-between text-[11px] text-amber-900">
          {isTie ? (
            <Tooltip content="มีสถานที่ได้คะแนนสูงสุดเท่ากัน ทุกคนสามารถช่วยกันตัดสินใจหรือเปลี่ยนโหวตได้ครับ">
              <span className="flex items-center gap-1 font-semibold text-amber-800">
                <span>⚖️ คะแนนเสมอกัน {leadingCount} แห่ง</span>
              </span>
            </Tooltip>
          ) : (
            <span className="flex items-center gap-1 font-semibold text-amber-900">
              <span>👑 มีที่นำอยู่ {leadingCount} แห่ง</span>
            </span>
          )}
          <span className="text-stone-500">{isStay ? "คนละไม่เกิน 3 โหวต" : "คนละไม่เกิน 10 โหวต"}</span>
        </div>
      )}
    </div>
  );
}
