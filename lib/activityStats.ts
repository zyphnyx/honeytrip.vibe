import type {
  Activity,
  ActivityCategory,
  Member,
  PlanBudgetSummary,
  TripPlanMeta,
} from "./types";
import {
  calculateInclusiveDays,
  formatThaiDateShort,
  getDayNumber,
  sortActivitiesChronologically,
} from "./activityDates.ts";

export interface ActivityCostBreakdown {
  totalCost: number;
  costPerParticipant: number;
  participantCount: number;
  isUnknown: boolean;
  isFree: boolean;
}

/**
 * คำนวณค่าใช้จ่ายของกิจกรรมเดี่ยวอย่างแม่นยำและปลอดภัย
 */
export function calculateActivityCost(activity: Activity): ActivityCostBreakdown {
  const mode = activity.cost?.mode || "unknown";
  const rawAmount = activity.cost?.amount;
  const rawParticipants = Array.isArray(activity.participantUids)
    ? activity.participantUids
    : [];
  // กรอง UIDs ที่ซ้ำกัน
  const uniqueParticipants = Array.from(new Set(rawParticipants.filter(Boolean)));
  const participantCount = uniqueParticipants.length;

  if (mode === "free") {
    return {
      totalCost: 0,
      costPerParticipant: 0,
      participantCount,
      isUnknown: false,
      isFree: true,
    };
  }

  if (mode === "unknown" || rawAmount === null || rawAmount === undefined || isNaN(rawAmount)) {
    return {
      totalCost: 0,
      costPerParticipant: 0,
      participantCount,
      isUnknown: true,
      isFree: false,
    };
  }

  // ป้องกันค่าติดลบ
  const amount = Math.max(0, Number(rawAmount) || 0);

  if (mode === "per_person") {
    const totalCost = amount * participantCount;
    const costPerParticipant = amount;
    return {
      totalCost,
      costPerParticipant,
      participantCount,
      isUnknown: false,
      isFree: amount === 0,
    };
  }

  if (mode === "split_total") {
    const totalCost = amount;
    const costPerParticipant = participantCount > 0 ? totalCost / participantCount : 0;
    return {
      totalCost,
      costPerParticipant,
      participantCount,
      isUnknown: false,
      isFree: amount === 0,
    };
  }

  return {
    totalCost: 0,
    costPerParticipant: 0,
    participantCount,
    isUnknown: true,
    isFree: false,
  };
}

/**
 * คำนวณสรุปงบประมาณรวมทั้งทริป (เฉพาะกิจกรรมที่ confirmed หรือ completed)
 */
export function calculatePlanBudget(
  activities: Activity[],
  members: Member[] = [],
): PlanBudgetSummary {
  let totalEstimated = 0;
  let confirmedCount = 0;
  let completedCount = 0;
  let proposedCount = 0;
  let cancelledCount = 0;
  let unknownCostCount = 0;
  let freeCostCount = 0;

  const byParticipant: Record<string, number> = {};
  const byDate: Record<string, number> = {};

  // เริ่มต้นค่าให้สมาชิกทุกคนเป็น 0
  for (const m of members) {
    byParticipant[m.id] = 0;
  }

  for (const act of activities) {
    if (act.status === "proposed") {
      proposedCount++;
      continue;
    }
    if (act.status === "cancelled") {
      cancelledCount++;
      continue;
    }

    if (act.status === "confirmed") confirmedCount++;
    if (act.status === "completed") completedCount++;

    const costInfo = calculateActivityCost(act);

    if (costInfo.isUnknown) {
      unknownCostCount++;
      continue;
    }
    if (costInfo.isFree) {
      freeCostCount++;
    }

    totalEstimated += costInfo.totalCost;

    // สะสมยอดตามวัน
    if (act.date) {
      byDate[act.date] = (byDate[act.date] || 0) + costInfo.totalCost;
    }

    // สะสมยอดตามผู้เข้าร่วม
    const uniqueParticipants = Array.from(new Set(act.participantUids || []));
    for (const uid of uniqueParticipants) {
      byParticipant[uid] = (byParticipant[uid] || 0) + costInfo.costPerParticipant;
    }
  }

  return {
    totalEstimated,
    totalActivitiesCount: activities.length,
    confirmedCount,
    completedCount,
    proposedCount,
    cancelledCount,
    unknownCostCount,
    freeCostCount,
    byParticipant,
    byDate,
  };
}

/**
 * แปลงเวลา "HH:mm" เป็นนาทีนับจากเที่ยงคืน
 */
export function timeToMinutes(timeStr: string | null | undefined): number | null {
  if (!timeStr || !/^\d{1,2}:\d{2}$/.test(timeStr)) return null;
  const [h, m] = timeStr.split(":").map(Number);
  if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

export interface ActivityConflict {
  conflictingActivityId: string;
  conflictingTitle: string;
  timeSpan: string;
  sharedParticipantCount: number;
}

/**
 * ตรวจสอบความซ้ำซ้อนของเวลา (Schedule Conflicts) สำหรับกิจกรรมที่ยืนยันแล้วในวันเดียวกัน
 * โดยไม่นับกิจกรรมที่ไม่มี end time เป็น conflict ที่แน่นอน
 */
export function detectScheduleConflicts(activities: Activity[]): Map<string, ActivityConflict[]> {
  const conflictsMap = new Map<string, ActivityConflict[]>();

  // พิจารณาเฉพาะกิจกรรมที่ confirmed หรือ completed และมีวันที่และเวลาเริ่มต้น
  const activeActivities = activities.filter(
    (a) => (a.status === "confirmed" || a.status === "completed") && a.date && a.startTime,
  );

  // จัดกลุ่มตามวันที่
  const byDate = new Map<string, Activity[]>();
  for (const act of activeActivities) {
    const list = byDate.get(act.date!) || [];
    list.push(act);
    byDate.set(act.date!, list);
  }

  for (const [, dayList] of byDate.entries()) {
    for (let i = 0; i < dayList.length; i++) {
      for (let j = i + 1; j < dayList.length; j++) {
        const a = dayList[i];
        const b = dayList[j];

        const startA = timeToMinutes(a.startTime);
        let endA = timeToMinutes(a.endTime);
        const startB = timeToMinutes(b.startTime);
        let endB = timeToMinutes(b.endTime);

        if (startA === null || startB === null) continue;

        // ถ้าเวลาสิ้นสุดน้อยกว่าหรือเท่ากับเวลาเริ่ม ถือว่าไม่มี end time ที่ถูกต้อง
        if (endA !== null && endA <= startA) endA = null;
        if (endB !== null && endB <= startB) endB = null;

        let hasOverlap = false;

        // หากมี end time ทั้งสองอัน: startA < endB && startB < endA
        if (endA !== null && endB !== null) {
          hasOverlap = startA < endB && startB < endA;
        } else if (endA !== null && endB === null) {
          // A มี end time, B ไม่มี: B เริ่มระหว่างช่วงของ A หรือเวลาเริ่มตรงกัน
          hasOverlap = startB >= startA && startB < endA;
        } else if (endA === null && endB !== null) {
          // B มี end time, A ไม่มี: A เริ่มระหว่างช่วงของ B หรือเวลาเริ่มตรงกัน
          hasOverlap = startA >= startB && startA < endB;
        } else {
          // ทั้งคู่ไม่มี end time: เริ่มเวลาเดียวกันเป๊ะ
          hasOverlap = startA === startB;
        }

        if (hasOverlap) {
          const partsA = new Set(a.participantUids || []);
          const sharedCount = (b.participantUids || []).filter((uid) => partsA.has(uid)).length;

          const conflictForA: ActivityConflict = {
            conflictingActivityId: b.id,
            conflictingTitle: b.title,
            timeSpan: `${b.startTime}${b.endTime ? ` - ${b.endTime}` : ""}`,
            sharedParticipantCount: sharedCount,
          };

          const conflictForB: ActivityConflict = {
            conflictingActivityId: a.id,
            conflictingTitle: a.title,
            timeSpan: `${a.startTime}${a.endTime ? ` - ${a.endTime}` : ""}`,
            sharedParticipantCount: sharedCount,
          };

          const listA = conflictsMap.get(a.id) || [];
          listA.push(conflictForA);
          // เรียงให้ข้อขัดแย้งที่มีเพื่อนร่วมทับซ้อนขึ้นก่อน (Prioritize shared participants)
          listA.sort((x, y) => y.sharedParticipantCount - x.sharedParticipantCount);
          conflictsMap.set(a.id, listA);

          const listB = conflictsMap.get(b.id) || [];
          listB.push(conflictForB);
          listB.sort((x, y) => y.sharedParticipantCount - x.sharedParticipantCount);
          conflictsMap.set(b.id, listB);
        }
      }
    }
  }

  return conflictsMap;
}

export const CATEGORY_EMOJIS: Record<ActivityCategory, string> = {
  attraction: "🎡",
  food: "🍜",
  stay: "🏡",
  transport: "🚗",
  other: "📌",
};

/**
 * ฟังก์ชันจัดข้อความสรุปแผนเที่ยวเพื่อส่งเข้า LINE ตามฟอร์แมตในข้อ 14
 */
export function generateLineItinerarySummary({
  roomTitle,
  roomEmoji,
  meta,
  activities,
  members = [],
  planUrl,
}: {
  roomTitle: string;
  roomEmoji?: string;
  meta: TripPlanMeta | null;
  activities: Activity[];
  members?: Member[];
  planUrl: string;
}): string {
  const confirmedActs = sortActivitiesChronologically(
    activities.filter((a) => a.status === "confirmed" || a.status === "completed"),
  );

  const lines: string[] = [];
  const headerEmoji = roomEmoji && roomEmoji !== "🍯" ? `${roomEmoji} ` : "🍯 ";
  lines.push(`${headerEmoji}HoneyTrip — แผนเที่ยว${roomTitle}`);

  if (meta?.startDate && meta?.endDate) {
    const days = calculateInclusiveDays(meta.startDate, meta.endDate);
    lines.push(`📅 ${formatThaiDateShort(meta.startDate, false)} – ${formatThaiDateShort(meta.endDate, false)} (${days} วัน)`);
  } else {
    lines.push(`📅 ยังไม่กำหนดวันเดินทาง`);
  }

  lines.push("");

  if (confirmedActs.length === 0) {
    lines.push("DAY 1");
    lines.push("(ยังไม่มีกิจกรรมที่ยืนยันในตารางเที่ยว)");
    lines.push("");
  } else {
    // จัดกลุ่มกิจกรรมตามวันที่
    const actsByDate = new Map<string, Activity[]>();
    for (const act of confirmedActs) {
      const d = act.date || "no-date";
      const list = actsByDate.get(d) || [];
      list.push(act);
      actsByDate.set(d, list);
    }

    let dayCounter = 1;
    for (const [dateKey, dayActs] of actsByDate.entries()) {
      if (dateKey !== "no-date") {
        const dayNum = meta?.startDate ? getDayNumber(dateKey, meta.startDate) : dayCounter++;
        lines.push(`DAY ${dayNum || dayCounter++} — ${formatThaiDateShort(dateKey, false)}`);
      } else {
        lines.push("กิจกรรมที่รอยืนยันวัน");
      }

      for (const act of dayActs) {
        const emoji = CATEGORY_EMOJIS[act.category] || "📌";
        const timePrefix = act.startTime ? `${act.startTime} ` : "";
        const loc = act.placeSnapshot?.name ? ` (@ ${act.placeSnapshot.name})` : "";
        lines.push(`${timePrefix}${emoji} ${act.title}${loc}`);
      }
      lines.push("");
    }
  }

  // ส่วนงบประมาณ
  const budget = calculatePlanBudget(activities, members);
  lines.push("💰 งบประมาณโดยประมาณ");
  lines.push(`รวมทั้งทริป: ฿${budget.totalEstimated.toLocaleString("th-TH")}`);
  if (budget.unknownCostCount > 0) {
    lines.push(`(มี ${budget.unknownCostCount} กิจกรรมที่ยังไม่ระบุราคา)`);
  }
  lines.push("ต่อคน: แตกต่างตามกิจกรรมที่เข้าร่วม");
  lines.push("");

  lines.push("🔗 ดูแผนเที่ยวฉบับเต็ม:");
  lines.push(planUrl);

  return lines.join("\n");
}

