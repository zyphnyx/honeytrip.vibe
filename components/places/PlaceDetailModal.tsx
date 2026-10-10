"use client";

import { useState } from "react";
import { Tooltip } from "@/components/Tooltip";
import { baht } from "@/lib/stats";
import type { PlaceVoteItem } from "@/lib/types";

interface PlaceDetailModalProps {
  item: PlaceVoteItem | null;
  uid: string | null;
  onClose: () => void;
  onEdit: () => void;
  onDelete: (placeId: string) => Promise<void>;
  onVote: () => void;
  isEligible: boolean;
  isVotedByMe: boolean;
  canVoteMore: boolean;
}

export function PlaceDetailModal({
  item,
  uid,
  onClose,
  onEdit,
  onDelete,
  onVote,
  isEligible,
  isVotedByMe,
  canVoteMore,
}: PlaceDetailModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!item) return null;
  const { place, votesCount, voters, isLeading } = item;
  const isStay = place.category === "stay";
  const canModify = uid === place.createdBy;

  const handleDelete = async () => {
    if (!confirm(`คุณต้องการลบ "${place.name}" ออกจากรายการใช่หรือไม่?`)) return;
    setIsDeleting(true);
    try {
      await onDelete(place.id);
      onClose();
    } catch (err) {
      console.error("Delete place error:", err);
      alert("เกิดข้อผิดพลาดในการลบสถานที่");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleVoteClick = () => {
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-md rounded-3xl border border-stone-200/80 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-stone-100 pb-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className={`rounded-lg px-2 py-0.5 text-[10px] font-bold ${
                  isStay
                    ? "bg-amber-100 text-amber-900 border border-amber-200/80"
                    : "bg-teal-50 text-teal-800 border border-teal-200/80"
                }`}
              >
                {isStay ? "🏡 ที่พัก" : "📍 ที่เที่ยว"}
              </span>
              {isLeading && votesCount > 0 && (
                <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs">
                  👑 คะแนนนำ
                </span>
              )}
            </div>
            <h2 className="mt-1 text-base font-bold text-stone-900 break-words">
              {place.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content Details */}
        <div className="mt-4 space-y-3.5 text-xs">
          {/* Location */}
          {place.location && (
            <div className="flex items-start gap-2 text-stone-700">
              <span className="text-sm shrink-0">📍</span>
              <div>
                <span className="font-semibold text-stone-900">ทำเล / ที่อยู่:</span>{" "}
                {place.location}
              </div>
            </div>
          )}

          {/* Price */}
          {place.price !== undefined && place.price !== null && place.price > 0 && (
            <div className="flex items-center gap-2 text-stone-700">
              <span className="text-sm shrink-0">💰</span>
              <div>
                <span className="font-semibold text-stone-900">
                  {isStay ? "ราคาที่พัก:" : "ค่าเข้า / ค่าใช้จ่าย:"}
                </span>{" "}
                <span className="font-bold text-amber-950">{baht(place.price)}</span>{" "}
                <span className="text-stone-500">{place.priceUnit || (isStay ? "/คืน" : "/คน")}</span>
              </div>
            </div>
          )}

          {/* Capacity or Estimated Duration */}
          {isStay && place.capacity && (
            <div className="flex items-center gap-2 text-stone-700">
              <span className="text-sm shrink-0">👥</span>
              <div>
                <span className="font-semibold text-stone-900">รองรับได้:</span>{" "}
                {place.capacity} คน
              </div>
            </div>
          )}

          {!isStay && place.estimatedDuration && (
            <div className="flex items-center gap-2 text-stone-700">
              <span className="text-sm shrink-0">⏱️</span>
              <div>
                <span className="font-semibold text-stone-900">เวลาเที่ยวโดยประมาณ:</span>{" "}
                {place.estimatedDuration}
              </div>
            </div>
          )}

          {/* Submitter Info */}
          <div className="flex items-center gap-2 text-stone-700">
            <span className="text-sm shrink-0">💡</span>
            <div>
              <span className="font-semibold text-stone-900">เสนอโดย:</span>{" "}
              {place.createdByEmoji} {place.createdByName}
            </div>
          </div>

          {/* Notes */}
          {place.notes && (
            <div className="rounded-2xl bg-amber-50/50 border border-amber-200/50 p-3 text-stone-800 leading-relaxed">
              <p className="font-bold text-[11px] text-amber-950 mb-1">📝 โน้ตจากเพื่อน:</p>
              <p className="text-xs">&ldquo;{place.notes}&rdquo;</p>
            </div>
          )}

          {/* Outbound Link */}
          {place.externalUrl && (
            <div className="pt-1">
              <a
                href={place.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border border-stone-200 bg-stone-50 py-2.5 font-bold text-stone-800 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-950 transition-colors"
              >
                <span>🌐 ดูบน Google Maps / เว็บภายนอก</span>
                <span className="text-xs">↗</span>
              </a>
            </div>
          )}

          {/* Voters List */}
          <div className="rounded-2xl border border-stone-200/80 bg-stone-50/50 p-3">
            <div className="flex items-center justify-between text-xs font-bold text-stone-800">
              <span>🗳️ รายชื่อเพื่อนที่โหวต ({votesCount} คน)</span>
            </div>
            {voters.length === 0 ? (
              <p className="mt-2 text-[11px] text-stone-400 italic">
                ยังไม่มีใครโหวตสถานที่นี้ เป็นคนแรกที่โหวตเลย!
              </p>
            ) : (
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {voters.map((v) => (
                  <span
                    key={v.uid}
                    className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2 py-1 text-[11px] font-medium text-stone-800"
                  >
                    <span>{v.emoji}</span>
                    <span>{v.name}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-5 flex items-center justify-between gap-2 border-t border-stone-100 pt-3">
          <div className="flex items-center gap-1.5">
            {canModify && (
              <>
                <Tooltip content="แก้ไขข้อมูลสถานที่นี้">
                  <button
                    type="button"
                    onClick={onEdit}
                    className="rounded-xl border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-50 cursor-pointer"
                  >
                    ✏️ แก้ไข
                  </button>
                </Tooltip>
                <Tooltip content="ลบสถานที่นี้ออกจากทริป">
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isDeleting}
                    className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 cursor-pointer"
                  >
                    {isDeleting ? "…" : "🗑️ ลบ"}
                  </button>
                </Tooltip>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={handleVoteClick}
            className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-bold shadow-xs transition-all cursor-pointer ${
              isVotedByMe
                ? "bg-amber-500 text-white hover:bg-amber-600"
                : "bg-stone-900 text-white hover:bg-stone-800"
            }`}
          >
            <span>{isVotedByMe ? "✓ โหวตแล้ว (กดเพื่อยกเลิก)" : "👍 ร่วมโหวต"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
