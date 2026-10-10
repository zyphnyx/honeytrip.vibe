"use client";

import { Tooltip } from "@/components/Tooltip";
import { baht } from "@/lib/stats";
import type { PlaceVoteItem } from "@/lib/types";

interface PlaceCardProps {
  item: PlaceVoteItem;
  uid: string | null;
  isEligible: boolean;
  isVotedByMe: boolean;
  canVoteMore: boolean;
  onVote: () => void;
  onOpenDetail: () => void;
}

export function PlaceCard({
  item,
  isEligible,
  isVotedByMe,
  canVoteMore,
  onVote,
  onOpenDetail,
}: PlaceCardProps) {
  const { place, votesCount, voters, isLeading } = item;
  const isStay = place.category === "stay";

  const handleVoteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isEligible) {
      alert("เฉพาะสมาชิกที่สถานะ 'ไปแน่' หรือ 'ลังเล' เท่านั้นที่มีสิทธิ์โหวตครับ");
      return;
    }
    if (!isVotedByMe && !canVoteMore) {
      const maxLimit = isStay ? 3 : 10;
      alert(`คุณโหวต${isStay ? "ที่พัก" : "ที่เที่ยว"}ครบโควต้า ${maxLimit} ที่แล้ว กรุณาถอนโหวตที่อื่นก่อนครับ`);
      return;
    }
    onVote();
  };

  return (
    <div
      onClick={onOpenDetail}
      className={`group relative flex flex-col justify-between rounded-2xl border p-4 transition-all duration-200 cursor-pointer ${
        isVotedByMe
          ? "border-amber-400 bg-amber-50/40 shadow-xs ring-1 ring-amber-300"
          : isLeading && votesCount > 0
            ? "border-amber-300/80 bg-amber-50/20 shadow-xs"
            : "border-stone-200/80 bg-white hover:border-amber-200 hover:shadow-xs"
      }`}
    >
      <div>
        {/* Top Badges & Leading Indicator */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${
                isStay
                  ? "bg-amber-100 text-amber-900 border border-amber-200/80"
                  : "bg-teal-50 text-teal-800 border border-teal-200/80"
              }`}
            >
              {isStay ? "🏡 ที่พัก" : "📍 ที่เที่ยว"}
            </span>
            {place.source === "geoapify" && (
              <span className="rounded-lg bg-stone-100 px-1.5 py-0.5 text-[9px] font-medium text-stone-500 border border-stone-200/60">
                Discovery
              </span>
            )}
          </div>

          {isLeading && votesCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
              👑 คะแนนนำ
            </span>
          )}
        </div>

        {/* Place Title */}
        <h3 className="mt-2 text-sm font-bold text-stone-900 line-clamp-1 group-hover:text-amber-800 transition-colors">
          {place.name}
        </h3>

        {/* Location / Area */}
        {place.location && (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-stone-500 line-clamp-1">
            <span>📍</span>
            <span>{place.location}</span>
          </p>
        )}

        {/* Meta: Price / Capacity / Duration */}
        <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[11px]">
          {place.price !== undefined && place.price !== null && place.price > 0 && (
            <span className="rounded-md bg-stone-100 px-2 py-0.5 font-bold text-stone-800">
              {baht(place.price)}
              <span className="font-normal text-stone-500 text-[10px]">
                {" "}
                {place.priceUnit || (isStay ? "/คืน" : "/คน")}
              </span>
            </span>
          )}

          {isStay && place.capacity && place.capacity > 0 && (
            <span className="rounded-md bg-amber-50 px-1.5 py-0.5 font-medium text-amber-800 border border-amber-200/50 text-[10px]">
              👥 รับได้ {place.capacity} คน
            </span>
          )}

          {!isStay && place.estimatedDuration && (
            <span className="rounded-md bg-stone-100 px-1.5 py-0.5 font-medium text-stone-600 text-[10px]">
              ⏱️ {place.estimatedDuration}
            </span>
          )}
        </div>

        {/* Notes if available */}
        {place.notes && (
          <p className="mt-2 text-[11px] text-stone-600 line-clamp-2 italic bg-stone-50 rounded-lg p-1.5 border border-stone-200/40">
            &ldquo;{place.notes}&rdquo;
          </p>
        )}
      </div>

      {/* Footer: Submitter info & Voting Controls */}
      <div className="mt-3.5 pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
        {/* Submitter */}
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs">{place.createdByEmoji || "👤"}</span>
          <span className="truncate text-[10px] text-stone-400">
            โดย {place.createdByName}
          </span>
        </div>

        {/* Voting & Voters */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Voter Avatars */}
          {voters.length > 0 && (
            <div className="flex -space-x-1.5 overflow-hidden">
              {voters.slice(0, 3).map((v) => (
                <Tooltip key={v.uid} content={`${v.emoji} ${v.name}`}>
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white bg-amber-100 text-[10px]">
                    {v.emoji}
                  </span>
                </Tooltip>
              ))}
              {voters.length > 3 && (
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-white bg-stone-100 text-[9px] font-bold text-stone-500">
                  +{voters.length - 3}
                </span>
              )}
            </div>
          )}

          {/* Interactive Vote Button */}
          <Tooltip
            content={
              !isEligible
                ? "คุณต้องเข้าร่วมทริปและเลือกสถานะ 'ไปแน่' หรือ 'ลังเล' ก่อนถึงจะโหวตได้"
                : isVotedByMe
                  ? "กดเพื่อยกเลิกโหวต"
                  : canVoteMore
                    ? `กดเพื่อโหวต${isStay ? "ที่พักนี้ (สูงสุด 3 ที่)" : "ที่เที่ยวนี้ (สูงสุด 10 ที่)"}`
                    : `โควต้าโหวตครบ ${isStay ? 3 : 10} ที่แล้ว (กดถอนที่อื่นก่อนได้)`
            }
          >
            <button
              type="button"
              onClick={handleVoteClick}
              className={`flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                isVotedByMe
                  ? "bg-amber-500 text-white shadow-xs hover:bg-amber-600 active:scale-95"
                  : "border border-stone-200 bg-stone-50 text-stone-700 hover:border-amber-300 hover:bg-amber-50 hover:text-amber-900 active:scale-95"
              }`}
            >
              <span>{isVotedByMe ? "✓ โหวตแล้ว" : "👍 โหวต"}</span>
              <span
                className={`rounded-md px-1 py-0.2 text-[10px] font-extrabold ${
                  isVotedByMe
                    ? "bg-amber-600 text-white"
                    : "bg-stone-200/80 text-stone-700"
                }`}
              >
                {votesCount}
              </span>
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
