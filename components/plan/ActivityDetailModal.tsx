"use client";

import { useEffect } from "react";
import { ACTIVITY_CATEGORIES, ACTIVITY_STATUSES } from "@/lib/constants";
import { formatThaiDateFull } from "@/lib/activityDates";
import { calculateActivityCost, type ActivityConflict } from "@/lib/activityStats";
import type { Activity, ActivityStatus, Member } from "@/lib/types";
import { ActivityComments } from "./ActivityComments";

interface ActivityDetailModalProps {
  activity: Activity | null;
  isOpen: boolean;
  roomId: string;
  uid: string | null;
  members?: Member[];
  conflicts?: ActivityConflict[];
  allActivities?: Activity[];
  onClose: () => void;
  onEdit: (activity: Activity) => void;
  onDelete: (activityId: string) => void;
  onUpdateStatus: (activityId: string, status: ActivityStatus) => void;
}

export function ActivityDetailModal({
  activity,
  isOpen,
  roomId,
  uid,
  members = [],
  conflicts = [],
  allActivities = [],
  onClose,
  onEdit,
  onDelete,
  onUpdateStatus,
}: ActivityDetailModalProps) {
  // Edge Case 15: ตรวจจับว่ากิจกรรมถูกลบออกจาก Firestore หรือไม่ขณะที่ Modal เปิดอยู่
  const isDeletedInBackground =
    Boolean(activity) &&
    allActivities.length > 0 &&
    !allActivities.some((a) => a.id === activity?.id);

  // ปิดด้วยปุ่ม Escape
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) {
      window.addEventListener("keydown", onKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen || !activity) return null;

  if (isDeletedInBackground) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="deleted-activity-title"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/40 backdrop-blur-xs animate-in fade-in"
        onClick={onClose}
      >
        <div
          className="relative w-full max-w-sm rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl text-center space-y-3"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-3xl">🗑️</div>
          <h3 id="deleted-activity-title" className="text-base font-bold text-stone-900">
            กิจกรรมนี้ถูกลบแล้ว
          </h3>
          <p className="text-xs text-stone-500 leading-relaxed">
            กิจกรรมนี้ถูกลบออกจากทริปโดยเพื่อนร่วมทริป หรือถูกลบจากเครื่องอื่น
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-primary w-full !text-xs !py-2.5 font-bold"
            >
              รับทราบและปิด
            </button>
          </div>
        </div>
      </div>
    );
  }

  const categoryInfo = ACTIVITY_CATEGORIES.find((c) => c.id === activity.category) || {
    icon: "📌",
    short: "อื่นๆ",
  };
  const statusInfo = ACTIVITY_STATUSES.find((s) => s.id === activity.status) || {
    label: activity.status,
    badgeClass: "bg-stone-100 text-stone-700",
  };

  const costInfo = calculateActivityCost(activity);
  const author = members.find((m) => m.id === activity.createdBy);
  const authorName = author?.name || "เพื่อนร่วมทริป";
  const authorEmoji = author?.emoji || "🍯";

  const participants = members.filter((m) => activity.participantUids?.includes(m.id));
  const formerParticipantsCount = Math.max(
    0,
    (activity.participantUids?.length || 0) - participants.length,
  );

  const handleDeleteClick = () => {
    if (confirm(`คุณต้องการลบกิจกรรม "${activity.title}" ใช่หรือไม่?`)) {
      onDelete(activity.id);
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="activity-detail-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/50 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl border border-stone-200/80 bg-white p-5 sm:p-6 shadow-2xl transition-transform space-y-4 my-auto animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-xl text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors cursor-pointer"
          aria-label="ปิดหน้าต่าง"
        >
          ✕
        </button>

        {/* Header: Icon, Category, Title, Status */}
        <div className="flex items-start gap-3 border-b border-stone-100 pb-3 pr-8">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 border border-amber-200 text-2xl shadow-xs">
            {categoryInfo.icon}
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${statusInfo.badgeClass}`}>
                {statusInfo.label}
              </span>
              <span className="text-[11px] text-stone-400">
                โดย {authorEmoji} {authorName}
              </span>
            </div>
            <h2 id="activity-detail-title" className="text-base sm:text-lg font-bold text-stone-900 leading-snug break-words">
              {activity.title}
            </h2>
          </div>
        </div>

        {/* Schedule Conflicts Warning Box */}
        {conflicts.length > 0 && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-3 text-xs text-amber-900 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-amber-900">
              <span>⚠️</span>
              <span>แจ้งเตือน: เวลาทับซ้อนกับกิจกรรมอื่น</span>
            </div>
            <div className="space-y-1 pt-0.5">
              {conflicts.map((c, i) => (
                <div key={i} className="text-[11px] leading-relaxed">
                  • <strong>{c.conflictingTitle}</strong> ({c.timeSpan})
                  {c.sharedParticipantCount > 0 && (
                    <span className="text-amber-800 font-semibold">
                      {" "}· มีเพื่อนร่วมทับซ้อน {c.sharedParticipantCount} คน
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Date, Time & Transport Grid */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-2xl border border-stone-100 bg-stone-50/80 p-3">
            <div className="text-[11px] font-medium text-stone-400">📅 วันที่</div>
            <div className="mt-0.5 font-bold text-stone-800">
              {activity.date ? formatThaiDateFull(activity.date) : "ยังไม่ระบุวัน"}
            </div>
          </div>

          <div className="rounded-2xl border border-stone-100 bg-stone-50/80 p-3">
            <div className="text-[11px] font-medium text-stone-400">⏰ เวลา</div>
            <div className="mt-0.5 font-bold text-stone-800 tabular-nums">
              {activity.startTime ? (
                <span>
                  {activity.startTime}
                  {activity.endTime ? ` - ${activity.endTime}` : ""}
                </span>
              ) : (
                "ยังไม่ระบุเวลา"
              )}
            </div>
          </div>
        </div>

        {/* Place & Location */}
        {activity.placeSnapshot && (
          <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-3 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-amber-900 flex items-center gap-1">
                <span>📍</span>
                <span>{activity.placeSnapshot.name}</span>
              </span>
              {activity.placeSnapshot.externalUrl && (
                <a
                  href={activity.placeSnapshot.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-amber-800 hover:text-amber-950 underline text-[11px]"
                >
                  เปิด Google Maps ↗
                </a>
              )}
            </div>
            {activity.placeSnapshot.location && (
              <p className="text-[11px] text-stone-600 pl-5">
                {activity.placeSnapshot.location}
              </p>
            )}
          </div>
        )}

        {/* Transport */}
        {activity.transport && (
          <div className="rounded-xl border border-stone-100 bg-stone-50/60 p-2.5 text-xs text-stone-700 flex items-center gap-2">
            <span className="text-base">🚗</span>
            <div>
              <span className="font-semibold text-stone-800">การเดินทาง:</span>{" "}
              <span>{activity.transport}</span>
            </div>
          </div>
        )}

        {/* Description / Notes */}
        {activity.description && (
          <div className="space-y-1">
            <div className="text-[11px] font-semibold text-stone-500">📝 รายละเอียด / หมายเหตุ</div>
            <div className="rounded-2xl border border-stone-100 bg-stone-50/80 p-3 text-xs text-stone-800 whitespace-pre-wrap leading-relaxed">
              {activity.description}
            </div>
          </div>
        )}

        {/* Cost Breakdown */}
        <div className="rounded-2xl border border-emerald-200/70 bg-emerald-50/40 p-3 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-emerald-950 flex items-center gap-1">
              <span>💰</span>
              <span>ประมาณการค่าใช้จ่าย</span>
            </span>
            <span className="text-[11px] font-semibold text-emerald-800">
              {costInfo.isFree
                ? "กิจกรรมนี้ฟรี"
                : costInfo.isUnknown
                ? "ยังไม่ระบุราคา"
                : activity.cost.mode === "per_person"
                ? "คิดราคาต่อคน"
                : "หารเท่ากันทุกคน"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-emerald-100">
            <div>
              <div className="text-[10px] text-emerald-700 font-medium">ยอดรวมกิจกรรม</div>
              <div className="font-extrabold text-sm text-stone-900 tabular-nums">
                {costInfo.isFree
                  ? "฿0"
                  : costInfo.isUnknown
                  ? "ไม่ระบุ"
                  : `฿${costInfo.totalCost.toLocaleString("th-TH")}`}
              </div>
            </div>
            <div>
              <div className="text-[10px] text-emerald-700 font-medium">เฉลี่ยต่อคน ({costInfo.participantCount} คน)</div>
              <div className="font-extrabold text-sm text-stone-900 tabular-nums">
                {costInfo.isFree
                  ? "฿0"
                  : costInfo.isUnknown
                  ? "ไม่ระบุ"
                  : `~฿${Math.round(costInfo.costPerParticipant).toLocaleString("th-TH")}`}
              </div>
            </div>
          </div>
        </div>

        {/* Participants */}
        <div className="space-y-1.5 text-xs">
          <div className="font-semibold text-stone-700 flex items-center justify-between">
            <span>👥 ผู้เข้าร่วมกิจกรรม ({activity.participantUids?.length || 0} คน)</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {participants.map((m) => (
              <span
                key={m.id}
                className="inline-flex items-center gap-1 rounded-xl border border-stone-200 bg-stone-50 px-2 py-1 text-xs text-stone-800"
              >
                <span>{m.emoji}</span>
                <span className="font-medium">{m.name}</span>
                {m.id === uid && (
                  <span className="rounded-full bg-amber-200 px-1 text-[9px] font-bold text-amber-900">
                    คุณ
                  </span>
                )}
              </span>
            ))}
            {formerParticipantsCount > 0 && (
              <span className="inline-flex items-center rounded-xl border border-stone-200 bg-stone-50 px-2 py-1 text-[11px] text-stone-400">
                +{formerParticipantsCount} อดีตสมาชิก
              </span>
            )}
            {activity.participantUids?.length === 0 && (
              <span className="text-stone-400 text-xs">ยังไม่มีผู้เข้าร่วม</span>
            )}
          </div>
        </div>

        {/* Quick Status Change Actions */}
        <div className="space-y-1.5 pt-1 border-t border-stone-100 text-xs">
          <div className="font-semibold text-stone-700">🔄 ปรับสถานะกิจกรรม</div>
          <div className="flex flex-wrap gap-1.5">
            {activity.status === "proposed" && (
              <button
                type="button"
                onClick={() => {
                  onUpdateStatus(activity.id, "confirmed");
                  onClose();
                }}
                className="btn-primary !text-xs !py-1.5 !px-3 font-bold"
              >
                ✅ ยืนยันลงตารางเที่ยว
              </button>
            )}

            {activity.status === "confirmed" && (
              <>
                <button
                  type="button"
                  onClick={() => onUpdateStatus(activity.id, "completed")}
                  className="rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-colors cursor-pointer"
                >
                  ✓ เช็กอินไปแล้ว
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateStatus(activity.id, "proposed")}
                  className="rounded-xl border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  💡 ถอยกลับเป็นไอเดีย
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateStatus(activity.id, "cancelled")}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                >
                  ❌ ยกเลิกกิจกรรม
                </button>
              </>
            )}

            {activity.status === "completed" && (
              <>
                <button
                  type="button"
                  onClick={() => onUpdateStatus(activity.id, "confirmed")}
                  className="rounded-xl border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  ↩️ เปลี่ยนกลับเป็นยังไม่ไป
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateStatus(activity.id, "cancelled")}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
                >
                  ❌ ยกเลิกกิจกรรม
                </button>
              </>
            )}

            {activity.status === "cancelled" && (
              <button
                type="button"
                onClick={() => onUpdateStatus(activity.id, "proposed")}
                className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 transition-colors cursor-pointer"
              >
                🔄 กู้คืนเป็นไอเดียที่เสนอไว้
              </button>
            )}
          </div>
        </div>

        {/* Real-time Comments Embedded */}
        <div className="pt-2 border-t border-stone-100">
          <ActivityComments
            roomId={roomId}
            activityId={activity.id}
            uid={uid}
            members={members}
          />
        </div>

        {/* Bottom Actions: Edit & Delete */}
        <div className="flex gap-2 pt-2 border-t border-stone-100">
          <button
            type="button"
            onClick={handleDeleteClick}
            className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors cursor-pointer"
          >
            🗑️ ลบกิจกรรม
          </button>
          <button
            type="button"
            onClick={() => {
              onEdit(activity);
              onClose();
            }}
            className="btn-primary flex-1 !text-xs !py-2.5 font-bold shadow-xs"
          >
            ✏️ แก้ไขข้อมูลกิจกรรม
          </button>
        </div>
      </div>
    </div>
  );
}
