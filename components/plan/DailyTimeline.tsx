"use client";

import { useMemo, useState } from "react";
import {
  formatThaiDateShort,
  getBangkokCurrentTime,
  getBangkokTodayKey,
  getConfirmedActivitiesOutsideRange,
  getDateRangeArray,
  getDayNumber,
  sortActivitiesChronologically,
} from "@/lib/activityDates";
import type { Activity, ActivityStatus, Member, TripPlanMeta } from "@/lib/types";
import { TimelineActivityCard } from "./TimelineActivityCard";
import type { ActivityConflict } from "@/lib/activityStats";

export function DailyTimeline({
  meta,
  activities = [],
  members = [],
  conflicts,
  onOpenDateSetup,
  onOpenDetail,
  onAddActivity,
  onEditActivity,
  onDeleteActivity,
  onUpdateStatus,
}: {
  meta: TripPlanMeta | null | undefined;
  activities?: Activity[];
  members?: Member[];
  conflicts: Map<string, ActivityConflict[]>;
  onOpenDateSetup: () => void;
  onOpenDetail?: (act: Activity) => void;
  onAddActivity: (defaultDate?: string) => void;
  onEditActivity: (act: Activity) => void;
  onDeleteActivity: (actId: string) => void;
  onUpdateStatus: (actId: string, status: ActivityStatus) => void;
}) {
  const dates = useMemo(() => {
    return getDateRangeArray(meta?.startDate, meta?.endDate);
  }, [meta?.startDate, meta?.endDate]);

  const todayKey = useMemo(() => getBangkokTodayKey(), []);
  const currentTime = useMemo(() => getBangkokCurrentTime(), []);

  // Today mode default: ถ้าวันนี้อยู่ในช่วงทริป ให้เลือกวันนี้ก่อน
  const defaultDate = useMemo(() => {
    if (dates.includes(todayKey)) return todayKey;
    return dates.length > 0 ? dates[0] : "";
  }, [dates, todayKey]);

  const [selectedDate, setSelectedDate] = useState<string>(defaultDate);

  // อัปเดต selectedDate ถ้าก่อนหน้าว่างเปล่า
  const activeDate = selectedDate || defaultDate || (dates.length > 0 ? dates[0] : "");

  // กรองเฉพาะกิจกรรมที่ confirmed หรือ completed ในวันที่เลือก
  const timelineActivities = useMemo(() => {
    const list = activities.filter(
      (a) => (a.status === "confirmed" || a.status === "completed") && a.date === activeDate,
    );
    return sortActivitiesChronologically(list);
  }, [activities, activeDate]);

  // ตรวจหากิจกรรมที่ confirmed แล้วแต่หลุดออกนอกช่วงวันเดินทาง (Edge Case 4 & 23)
  const outsideActivities = useMemo(() => {
    if (!meta?.startDate || !meta?.endDate) return [];
    return getConfirmedActivitiesOutsideRange(activities, meta.startDate, meta.endDate);
  }, [activities, meta]);

  // คำนวณงบประมาณของวันที่เลือก
  const dailyTotal = useMemo(() => {
    return timelineActivities.reduce((acc, act) => {
      const mode = act.cost?.mode;
      const amt = Number(act.cost?.amount) || 0;
      if (mode === "per_person") {
        const pCount = (act.participantUids || []).length;
        return acc + amt * pCount;
      }
      if (mode === "split_total") {
        return acc + amt;
      }
      return acc;
    }, 0);
  }, [timelineActivities]);

  if (dates.length === 0) {
    return (
      <div className="card py-10 text-center space-y-3">
        <div className="text-3xl">📅</div>
        <h3 className="font-bold text-sm text-stone-800">ยังไม่ได้กำหนดวันเดินทางของทริป</h3>
        <p className="text-xs text-stone-500 max-w-sm mx-auto leading-relaxed">
          กำหนดวันเริ่มต้นและวันสิ้นสุด เพื่อให้ระบบสร้างตารางเที่ยว Day 1, Day 2... และเรียงลำดับเวลาให้คุณ
        </p>
        <div className="pt-2">
          <button
            type="button"
            onClick={onOpenDateSetup}
            className="btn-primary !text-xs !py-2.5 font-bold shadow-xs cursor-pointer"
          >
            ปักหมุดวันเดินทางจริง
          </button>
        </div>
      </div>
    );
  }

  const currentDayNum = getDayNumber(activeDate, meta?.startDate);
  const isTodayActive = activeDate === todayKey;

  return (
    <div className="space-y-4">
      {/* Orphaned Activities Warning (Edge Case 4 & 23) */}
      {outsideActivities.length > 0 && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50/90 p-3 text-xs text-amber-900 flex items-start justify-between gap-2 shadow-2xs">
          <div className="space-y-0.5 min-w-0">
            <div className="font-bold flex items-center gap-1.5 text-amber-950">
              <span>⚠️</span>
              <span>มี {outsideActivities.length} กิจกรรมที่ระบุวันอยู่นอกช่วงทริปปัจจุบัน</span>
            </div>
            <p className="text-[11px] text-stone-600 leading-relaxed truncate">
              เช่น: {outsideActivities.map((a) => a.title).slice(0, 2).join(", ")}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenDateSetup}
            className="rounded-xl bg-amber-200/80 hover:bg-amber-300 px-2.5 py-1 text-[11px] font-bold text-amber-950 shrink-0 cursor-pointer"
          >
            ขยายวันทริป
          </button>
        </div>
      )}

      {/* Day Selector Ribbon */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {dates.map((d, index) => {
          const isSelected = d === activeDate;
          const isToday = d === todayKey;
          const dayActs = activities.filter(
            (a) => (a.status === "confirmed" || a.status === "completed") && a.date === d,
          );

          return (
            <button
              key={d}
              type="button"
              onClick={() => setSelectedDate(d)}
              className={`flex min-w-[76px] flex-col items-center rounded-2xl p-2 transition-all active:scale-95 cursor-pointer border ${
                isSelected
                  ? "border-amber-400 bg-amber-400 text-stone-950 shadow-xs font-bold"
                  : "border-stone-200/70 bg-white text-stone-600 hover:border-amber-300"
              }`}
            >
              <div className="flex items-center gap-1">
                <span className="text-[11px]">DAY {index + 1}</span>
                {isToday && (
                  <span className="rounded-full bg-rose-500 px-1 py-0.2 text-[8px] font-bold text-white leading-none">
                    วันนี้
                  </span>
                )}
              </div>
              <span className="text-xs mt-0.5">{formatThaiDateShort(d, false)}</span>
              <span
                className={`text-[9px] mt-1 rounded-full px-1.5 py-0.2 ${
                  isSelected ? "bg-amber-500/40 text-stone-950" : "bg-stone-100 text-stone-500"
                }`}
              >
                {dayActs.length} กิจกรรม
              </span>
            </button>
          );
        })}
      </div>

      {/* Day Header Info */}
      <div className="flex items-center justify-between rounded-2xl border border-stone-200/70 bg-white p-3 shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-stone-900">
              DAY {currentDayNum} · {formatThaiDateShort(activeDate)}
            </h3>
            {isTodayActive && (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                📍 กำลังเที่ยววันนี้
              </span>
            )}
          </div>
          <p className="text-[11px] text-stone-400 mt-0.5">
            {timelineActivities.length} กิจกรรม · ยอดประมาณการวันนี้{" "}
            <span className="font-bold text-stone-700">~฿{dailyTotal.toLocaleString("th-TH")}</span>
          </p>
        </div>

        <button
          type="button"
          onClick={() => onAddActivity(activeDate)}
          className="btn-primary !text-xs !py-1.5 !px-3 font-bold shadow-2xs shrink-0 cursor-pointer"
        >
          + เพิ่มกิจกรรม
        </button>
      </div>

      {/* Timeline Items */}
      {timelineActivities.length === 0 ? (
        <div className="card py-10 text-center space-y-2">
          <div className="text-2xl">🏖️</div>
          <p className="font-semibold text-xs text-stone-700">ยังไม่มีกิจกรรมในวันนี้</p>
          <p className="text-[11px] text-stone-400">
            แตะที่ &ldquo;+ เพิ่มกิจกรรม&rdquo; ด้านบน เพื่อลงกิจกรรมในตารางเที่ยว
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {timelineActivities.map((act) => (
            <TimelineActivityCard
              key={act.id}
              activity={act}
              members={members}
              conflicts={conflicts.get(act.id) || []}
              isToday={isTodayActive}
              currentTime={currentTime}
              onOpenDetail={onOpenDetail}
              onEdit={onEditActivity}
              onDelete={onDeleteActivity}
              onUpdateStatus={onUpdateStatus}
            />
          ))}
        </div>
      )}
    </div>
  );
}
