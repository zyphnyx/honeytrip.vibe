"use client";

import { useState } from "react";
import { ACTIVITY_CATEGORIES, ACTIVITY_STATUSES } from "@/lib/constants";
import { formatThaiDateShort } from "@/lib/activityDates";
import { calculateActivityCost } from "@/lib/activityStats";
import type { Activity, ActivityStatus, Member } from "@/lib/types";
import { ActivityComments } from "./ActivityComments";

export function ActivityPostCard({
  activity,
  roomId,
  uid,
  members = [],
  onOpenDetail,
  onEdit,
  onDelete,
  onUpdateStatus,
  onToggleLike,
  onConfirmSchedule,
}: {
  activity: Activity;
  roomId: string;
  uid: string | null;
  members?: Member[];
  onOpenDetail?: (act: Activity) => void;
  onEdit: (act: Activity) => void;
  onDelete: (actId: string) => void;
  onUpdateStatus: (actId: string, status: ActivityStatus) => void;
  onToggleLike: (actId: string) => void;
  onConfirmSchedule: (act: Activity) => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [commentsCount, setCommentsCount] = useState<number | null>(null);
  const [isLiking, setIsLiking] = useState(false);

  const author = members.find((m) => m.id === activity.createdBy);
  const authorName = author?.name || "เพื่อนร่วมทริป";
  const authorEmoji = author?.emoji || "🍯";

  const categoryInfo = ACTIVITY_CATEGORIES.find((c) => c.id === activity.category) || {
    icon: "📌",
    short: "อื่นๆ",
  };
  const statusInfo = ACTIVITY_STATUSES.find((s) => s.id === activity.status) || {
    label: activity.status,
    badgeClass: "bg-stone-100 text-stone-700",
  };

  const costInfo = calculateActivityCost(activity);
  const isLiked = uid ? activity.likedByUids?.includes(uid) : false;
  const likeCount = activity.likedByUids?.length || 0;

  const handleLikeClick = async () => {
    if (!uid || isLiking) return;
    setIsLiking(true);
    try {
      await onToggleLike(activity.id);
    } finally {
      setIsLiking(false);
    }
  };

  const participants = members.filter((m) => activity.participantUids?.includes(m.id));
  const formerCount = Math.max(0, (activity.participantUids?.length || 0) - participants.length);

  return (
    <article className="card border-stone-200/80 bg-white p-4 space-y-3 shadow-xs hover:border-amber-300 transition-colors">
      {/* Author & Status Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-base border border-amber-200/60 shrink-0">
            {authorEmoji}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-xs text-stone-900 truncate">{authorName}</span>
              {activity.createdBy === uid && (
                <span className="rounded-full bg-amber-100 px-1.5 text-[9px] font-bold text-amber-800">
                  เรา
                </span>
              )}
            </div>
            <div className="text-[10px] text-stone-400">
              {new Date(activity.createdAt).toLocaleDateString("th-TH", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => onOpenDetail?.(activity)}
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold border transition-colors cursor-pointer ${statusInfo.badgeClass}`}
            title="คลิกเพื่อดูรายละเอียด"
          >
            {statusInfo.label}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="space-y-1.5">
        <div className="flex items-start gap-1.5">
          <span className="text-base shrink-0">{categoryInfo.icon}</span>
          <button
            type="button"
            onClick={() => onOpenDetail?.(activity)}
            className="text-left group cursor-pointer flex-1"
          >
            <h3 className="font-bold text-sm text-stone-900 leading-snug break-words group-hover:text-amber-800 transition-colors">
              {activity.title}
            </h3>
          </button>
        </div>

        {activity.description && (
          <p
            onClick={() => onOpenDetail?.(activity)}
            className="text-xs text-stone-600 leading-relaxed whitespace-pre-wrap pl-6 cursor-pointer"
          >
            {activity.description}
          </p>
        )}
      </div>

      {/* Meta Pills (Date, Place, Cost, Transport) */}
      <div className="flex flex-wrap gap-1.5 text-[11px] pt-1">
        {/* Date & Time */}
        <span className="inline-flex items-center gap-1 rounded-lg bg-stone-100 px-2 py-1 text-stone-700">
          <span>📅</span>
          {activity.date ? (
            <span>
              {formatThaiDateShort(activity.date, false)}
              {activity.startTime && ` · ${activity.startTime}`}
              {activity.endTime && ` - ${activity.endTime}`}
            </span>
          ) : (
            <span className="text-stone-400">ยังไม่ระบุวัน</span>
          )}
        </span>

        {/* Place */}
        {activity.placeSnapshot && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2 py-1 text-amber-900 border border-amber-200/50">
            <span>📍</span>
            <span className="truncate max-w-[140px] font-medium">{activity.placeSnapshot.name}</span>
            {activity.placeSnapshot.externalUrl && (
              <a
                href={activity.placeSnapshot.externalUrl}
                target="_blank"
                rel="noreferrer"
                className="text-amber-700 hover:text-amber-950 font-bold ml-0.5"
                title="เปิดแผนที่"
              >
                ↗
              </a>
            )}
          </span>
        )}

        {/* Cost */}
        <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-emerald-900 border border-emerald-200/50">
          <span>💰</span>
          {costInfo.isFree ? (
            <span className="font-bold text-emerald-700">ฟรี</span>
          ) : costInfo.isUnknown ? (
            <span className="text-stone-400">ไม่ระบุราคา</span>
          ) : activity.cost.mode === "per_person" ? (
            <span>
              ฿{costInfo.costPerParticipant.toLocaleString("th-TH")}/คน (รวม ฿{costInfo.totalCost.toLocaleString("th-TH")})
            </span>
          ) : (
            <span>
              ฿{costInfo.totalCost.toLocaleString("th-TH")} (หาร {costInfo.participantCount} คน ~฿{Math.round(costInfo.costPerParticipant).toLocaleString("th-TH")})
            </span>
          )}
        </span>

        {/* Transport */}
        {activity.transport && (
          <span className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2 py-1 text-blue-900 border border-blue-200/50">
            <span>🚗</span>
            <span className="truncate max-w-[120px]">{activity.transport}</span>
          </span>
        )}
      </div>

      {/* Participants preview */}
      {activity.participantUids && activity.participantUids.length > 0 && (
        <div className="flex items-center gap-1.5 text-[11px] text-stone-500 pt-0.5">
          <span className="text-stone-400">ผู้ร่วม:</span>
          <div className="flex -space-x-1 overflow-hidden">
            {participants.slice(0, 5).map((p) => (
              <span
                key={p.id}
                className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-amber-100 text-[10px] ring-1 ring-white"
                title={p.name}
              >
                {p.emoji}
              </span>
            ))}
          </div>
          {participants.length > 5 && (
            <span className="text-[10px] text-stone-400">+{participants.length - 5}</span>
          )}
          {formerCount > 0 && (
            <span className="text-[10px] text-stone-400">+{formerCount} อดีตสมาชิก</span>
          )}
        </div>
      )}

      {/* Bottom Action Bar */}
      <div className="flex items-center justify-between border-t border-stone-100 pt-2 text-xs">
        <div className="flex items-center gap-2">
          {/* Like Button */}
          <button
            type="button"
            onClick={handleLikeClick}
            disabled={!uid}
            className={`flex items-center gap-1 rounded-xl px-2.5 py-1 transition-all active:scale-95 cursor-pointer ${
              isLiked
                ? "bg-rose-50 text-rose-600 font-bold border border-rose-200"
                : "bg-stone-50 text-stone-600 hover:bg-stone-100"
            }`}
          >
            <span>{isLiked ? "❤️" : "🤍"}</span>
            <span className="tabular-nums">{likeCount}</span>
          </button>

          {/* Comments Toggle */}
          <button
            type="button"
            onClick={() => setShowComments((v) => !v)}
            className="flex items-center gap-1 rounded-xl bg-stone-50 px-2.5 py-1 text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            <span>💬</span>
            <span>ความคิดเห็น</span>
            {commentsCount !== null && (
              <span className="rounded-full bg-stone-200 px-1 text-[10px] font-bold text-stone-700">
                {commentsCount}
              </span>
            )}
          </button>
        </div>

        {/* Quick Promote / Status actions / Edit / Delete */}
        <div className="flex items-center gap-1.5">
          {activity.status === "proposed" && (
            <>
              <button
                type="button"
                onClick={() => onConfirmSchedule(activity)}
                className="btn-primary !text-[11px] !py-1 !px-2.5 font-bold shadow-2xs cursor-pointer"
              >
                ✅ ลงตาราง
              </button>
              <button
                type="button"
                onClick={() => onUpdateStatus(activity.id, "cancelled")}
                className="rounded-lg p-1 text-stone-400 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer text-[11px]"
                title="ยกเลิกไอเดียนี้"
              >
                ✕
              </button>
            </>
          )}

          {activity.status === "confirmed" && (
            <>
              <button
                type="button"
                onClick={() => onUpdateStatus(activity.id, "completed")}
                className="rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-0.5 font-bold text-[10px] hover:bg-emerald-100 cursor-pointer"
                title="เช็กอินว่าไปแล้ว"
              >
                ✓ ไปแล้ว
              </button>
              <button
                type="button"
                onClick={() => onUpdateStatus(activity.id, "cancelled")}
                className="rounded-lg p-1 text-stone-400 hover:bg-rose-50 hover:text-rose-600 transition-colors cursor-pointer text-[11px]"
                title="ยกเลิกกิจกรรม"
              >
                ✕
              </button>
            </>
          )}

          {activity.status === "completed" && (
            <button
              type="button"
              onClick={() => onUpdateStatus(activity.id, "confirmed")}
              className="rounded-lg bg-stone-100 text-stone-600 px-2 py-0.5 text-[10px] hover:bg-stone-200 cursor-pointer"
              title="ย้อนกลับเป็นยังไม่ไป"
            >
              ↩️
            </button>
          )}

          {activity.status === "cancelled" && (
            <button
              type="button"
              onClick={() => onUpdateStatus(activity.id, "proposed")}
              className="btn-ghost !text-[11px] !py-1 !px-2 font-medium cursor-pointer"
              title="กู้คืนเป็นไอเดียที่เสนอไว้"
            >
              🔄 กู้คืน
            </button>
          )}

          <button
            type="button"
            onClick={() => onOpenDetail?.(activity)}
            className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors cursor-pointer"
            title="ดูรายละเอียดฉบับเต็ม"
          >
            🔍
          </button>

          <button
            type="button"
            onClick={() => onEdit(activity)}
            className="rounded-lg p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors cursor-pointer"
            title="แก้ไขกิจกรรม"
          >
            ✏️
          </button>

          <button
            type="button"
            onClick={() => onDelete(activity.id)}
            className="rounded-lg p-1 text-stone-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
            title="ลบกิจกรรม"
          >
            🗑️
          </button>
        </div>
      </div>

      {/* Inline Comments */}
      {showComments && (
        <ActivityComments
          roomId={roomId}
          activityId={activity.id}
          uid={uid}
          members={members}
          onCountChange={(cnt) => setCommentsCount(cnt)}
        />
      )}
    </article>
  );
}
