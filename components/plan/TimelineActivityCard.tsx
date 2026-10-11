"use client";

import { ACTIVITY_CATEGORIES } from "@/lib/constants";
import { calculateActivityCost, type ActivityConflict } from "@/lib/activityStats";
import type { Activity, ActivityStatus, Member } from "@/lib/types";

export function TimelineActivityCard({
  activity,
  members = [],
  conflicts = [],
  isToday = false,
  currentTime,
  onOpenDetail,
  onEdit,
  onDelete,
  onUpdateStatus,
}: {
  activity: Activity;
  members?: Member[];
  conflicts?: ActivityConflict[];
  isToday?: boolean;
  currentTime?: string;
  onOpenDetail?: (act: Activity) => void;
  onEdit: (act: Activity) => void;
  onDelete: (actId: string) => void;
  onUpdateStatus: (actId: string, status: ActivityStatus) => void;
}) {
  const categoryInfo = ACTIVITY_CATEGORIES.find((c) => c.id === activity.category) || {
    icon: "📌",
    short: "อื่นๆ",
  };
  const costInfo = calculateActivityCost(activity);
  const isCompleted = activity.status === "completed";

  // เช็กว่าช่วงเวลานี้ผ่านไปแล้วหรือยังถ้าเป็นวันนี้
  let isPast = false;
  let isCurrent = false;
  let isUpcoming = false;

  if (isToday && currentTime && activity.startTime) {
    const end = activity.endTime || activity.startTime;
    if (currentTime > end) {
      isPast = true;
    } else if (currentTime >= activity.startTime && currentTime <= end) {
      isCurrent = true;
    } else if (currentTime < activity.startTime) {
      isUpcoming = true;
    }
  }

  const participants = members.filter((m) => activity.participantUids?.includes(m.id));
  const formerCount = Math.max(0, (activity.participantUids?.length || 0) - participants.length);

  return (
    <div
      className={`relative flex gap-3 rounded-2xl border p-3.5 transition-all ${
        isCompleted
          ? "border-stone-200 bg-stone-50/70 opacity-75"
          : isCurrent
          ? "border-amber-400 bg-amber-50/70 shadow-sm ring-2 ring-amber-300/50"
          : isPast
          ? "border-stone-200 bg-stone-50/50 opacity-85"
          : "border-stone-200/90 bg-white shadow-xs hover:border-amber-300"
      }`}
    >
      {/* Time column */}
      <div className="flex flex-col items-center justify-start w-14 shrink-0 pt-0.5 text-center">
        <span className="font-extrabold text-sm text-stone-900 tabular-nums">
          {activity.startTime || "--:--"}
        </span>
        {activity.endTime && (
          <span className="text-[10px] text-stone-400 tabular-nums">
            {activity.endTime}
          </span>
        )}
        <span className="mt-2 flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100/80 text-base border border-amber-200/50">
          {categoryInfo.icon}
        </span>
      </div>

      {/* Main details */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-start justify-between gap-1.5">
          <div className="space-y-0.5 min-w-0 flex-1">
            {/* Today Mode Status Badge */}
            {isToday && (
              <div className="flex items-center gap-1.5 flex-wrap">
                {isCompleted ? (
                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800 border border-emerald-200">
                    ✓ เสร็จสิ้นแล้ว
                  </span>
                ) : isCurrent ? (
                  <span className="rounded-full bg-amber-400 px-2 py-0.2 text-[9px] font-extrabold text-stone-950 animate-pulse shadow-2xs">
                    ⚡ กำลังดำเนินอยู่
                  </span>
                ) : isUpcoming ? (
                  <span className="rounded-full bg-blue-100 px-1.5 py-0.2 text-[9px] font-bold text-blue-800 border border-blue-200">
                    ⏳ กิจกรรมถัดไป
                  </span>
                ) : isPast ? (
                  <span className="rounded-full bg-stone-100 px-1.5 py-0.2 text-[9px] font-medium text-stone-500">
                    ⏱️ ผ่านเวลาเริ่มแล้ว
                  </span>
                ) : null}
              </div>
            )}

            <button
              type="button"
              onClick={() => onOpenDetail?.(activity)}
              className="text-left w-full group cursor-pointer"
            >
              <h4
                className={`font-bold text-sm leading-snug break-words group-hover:text-amber-800 transition-colors ${
                  isCompleted ? "line-through text-stone-500" : "text-stone-900"
                }`}
              >
                {activity.title}
              </h4>
            </button>
          </div>

          {/* Quick complete toggle */}
          <button
            type="button"
            onClick={() => onUpdateStatus(activity.id, isCompleted ? "confirmed" : "completed")}
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold border transition-colors cursor-pointer shrink-0 ${
              isCompleted
                ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                : "bg-stone-100 text-stone-500 hover:bg-emerald-50 hover:text-emerald-700 border-stone-200"
            }`}
          >
            {isCompleted ? "✓ ไปแล้ว" : "○ เช็กอิน"}
          </button>
        </div>

        {/* Schedule Conflict Warning */}
        {conflicts.length > 0 && (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-900 space-y-0.5">
            {conflicts.map((c, i) => (
              <div key={i} className="flex items-start gap-1 font-medium">
                <span className="shrink-0">⚠️</span>
                <span>
                  เวลาทับซ้อนกับ: <strong>{c.conflictingTitle}</strong> ({c.timeSpan})
                  {c.sharedParticipantCount > 0 && (
                    <span className="text-amber-800 font-semibold">
                      {" "}· เพื่อนร่วมทับซ้อน {c.sharedParticipantCount} คน
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        )}

        {activity.description && (
          <p
            onClick={() => onOpenDetail?.(activity)}
            className="text-xs text-stone-600 leading-relaxed whitespace-pre-wrap cursor-pointer"
          >
            {activity.description}
          </p>
        )}

        {/* Place & Location */}
        {activity.placeSnapshot && (
          <div className="flex items-center gap-1 text-xs text-stone-700 pt-0.5">
            <span className="text-amber-500">📍</span>
            <span className="font-medium truncate">{activity.placeSnapshot.name}</span>
            {activity.placeSnapshot.externalUrl && (
              <a
                href={activity.placeSnapshot.externalUrl}
                target="_blank"
                rel="noreferrer"
                className="text-amber-700 hover:text-amber-950 font-bold ml-1 text-[11px]"
              >
                ดูแผนที่ ↗
              </a>
            )}
          </div>
        )}

        {/* Bottom meta row: Cost, Transport, Participants, Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-stone-100 text-[11px]">
          <div className="flex flex-wrap items-center gap-2">
            {/* Cost pill */}
            <span className="font-semibold text-emerald-800 tabular-nums">
              {costInfo.isFree
                ? "ฟรี"
                : costInfo.isUnknown
                ? "ไม่ระบุราคา"
                : `฿${costInfo.totalCost.toLocaleString("th-TH")}`}
            </span>

            {/* Transport */}
            {activity.transport && (
              <span className="text-stone-500">🚗 {activity.transport}</span>
            )}

            {/* Participants */}
            {participants.length > 0 && (
              <div className="flex items-center gap-1 text-stone-500">
                <span>👥 {participants.length + (formerCount > 0 ? formerCount : 0)} คน</span>
              </div>
            )}
          </div>

          {/* Details / Edit / Delete */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => onOpenDetail?.(activity)}
              className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors cursor-pointer text-xs"
              title="ดูรายละเอียดฉบับเต็ม"
            >
              🔍
            </button>
            <button
              type="button"
              onClick={() => onEdit(activity)}
              className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors cursor-pointer"
              title="แก้ไข"
            >
              ✏️
            </button>
            <button
              type="button"
              onClick={() => onDelete(activity.id)}
              className="rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
              title="ลบ"
            >
              🗑️
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
