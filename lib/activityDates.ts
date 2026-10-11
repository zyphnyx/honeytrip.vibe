import { parseKey, toKey, addDays } from "./dates.ts";

const BANGKOK_TZ = "Asia/Bangkok";

/**
 * ตรวจสอบรูปแบบวันที่ YYYY-MM-DD
 */
export function isValidDateKey(key: string | null | undefined): boolean {
  if (!key || typeof key !== "string") return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const d = parseKey(key);
  return !isNaN(d.getTime()) && toKey(d) === key;
}

/**
 * ดึงวันที่ปัจจุบันตามโซนเวลา Asia/Bangkok ในรูปแบบ YYYY-MM-DD
 */
export function getBangkokTodayKey(): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: BANGKOK_TZ,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(new Date());
  } catch {
    // Fallback ถ้า runtime ไม่รองรับ timezone
    const now = new Date();
    return toKey(now);
  }
}

/**
 * ดึงเวลาปัจจุบันตามโซนเวลา Asia/Bangkok ในรูปแบบ HH:mm
 */
export function getBangkokCurrentTime(): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: BANGKOK_TZ,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return formatter.format(new Date());
  } catch {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  }
}

/**
 * ตรวจสอบความถูกต้องของช่วงวันที่ทริป
 */
export function validateTripDateRange(
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): { valid: boolean; error?: string } {
  if (!startDate || !isValidDateKey(startDate)) {
    return { valid: false, error: "กรุณาระบุวันเริ่มต้นทริปให้ถูกต้อง" };
  }
  if (!endDate || !isValidDateKey(endDate)) {
    return { valid: false, error: "กรุณาระบุวันสิ้นสุดทริปให้ถูกต้อง" };
  }
  if (endDate < startDate) {
    return { valid: false, error: "วันสิ้นสุดทริปต้องไม่มาก่อนวันเริ่มต้น" };
  }
  return { valid: true };
}

/**
 * คำนวณจำนวนวันรวมของทริป (นับรวมวันแรกและวันสุดท้ายแบบ Inclusive)
 */
export function calculateInclusiveDays(startDate: string, endDate: string): number {
  if (!isValidDateKey(startDate) || !isValidDateKey(endDate) || endDate < startDate) {
    return 0;
  }
  const start = parseKey(startDate);
  const end = parseKey(endDate);
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1;
}

/**
 * สร้าง Array ของวันที่ทั้งหมดในทริปตั้งแต่ startDate ถึง endDate
 */
export function getDateRangeArray(startDate: string | null | undefined, endDate: string | null | undefined): string[] {
  if (!startDate || !endDate || !isValidDateKey(startDate) || !isValidDateKey(endDate) || endDate < startDate) {
    return startDate && isValidDateKey(startDate) ? [startDate] : [];
  }
  const totalDays = calculateInclusiveDays(startDate, endDate);
  // จำกัดไม่ให้ยาวเกิน 60 วันเพื่อความปลอดภัย
  const safeDays = Math.min(totalDays, 60);
  const result: string[] = [];
  for (let i = 0; i < safeDays; i++) {
    result.push(addDays(startDate, i));
  }
  return result;
}

/**
 * คำนวณลำดับวันของทริป (เช่น Day 1, Day 2) โดยนับ 1-indexed จาก startDate
 */
export function getDayNumber(dateKey: string, startDate: string | null | undefined): number | null {
  if (!startDate || !isValidDateKey(startDate) || !isValidDateKey(dateKey)) {
    return null;
  }
  const start = parseKey(startDate);
  const current = parseKey(dateKey);
  const diffTime = current.getTime() - start.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  return diffDays + 1;
}

/**
 * ตรวจสอบว่าวันที่อยู่ในช่วงทริปหรือไม่
 */
export function isDateInRange(
  dateKey: string | null | undefined,
  startDate: string | null | undefined,
  endDate: string | null | undefined,
): boolean {
  if (!dateKey || !startDate || !endDate) return false;
  return dateKey >= startDate && dateKey <= endDate;
}

/**
 * จัดรูปแบบวันที่แบบสั้นภาษาไทย เช่น "พ. 8 พ.ย." หรือ "8 พ.ย."
 */
export function formatThaiDateShort(dateKey: string, includeWeekday = true): string {
  if (!isValidDateKey(dateKey)) return dateKey;
  const d = parseKey(dateKey);
  return d.toLocaleDateString("th-TH", {
    ...(includeWeekday ? { weekday: "short" } : {}),
    day: "numeric",
    month: "short",
  });
}

/**
 * จัดรูปแบบวันที่แบบมีปี พ.ศ. เช่น "8 พ.ย. 2569"
 */
export function formatThaiDateFull(dateKey: string): string {
  if (!isValidDateKey(dateKey)) return dateKey;
  const d = parseKey(dateKey);
  return d.toLocaleDateString("th-TH", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * แสดงช่วงวันเดินทาง เช่น "8 – 11 พ.ย. (4 วัน)"
 */
export function formatTripRangeHeader(startDate: string | null | undefined, endDate: string | null | undefined): string {
  if (!startDate || !endDate || !isValidDateKey(startDate) || !isValidDateKey(endDate)) {
    return "ยังไม่ได้ระบุวันเดินทาง";
  }
  const days = calculateInclusiveDays(startDate, endDate);
  if (startDate === endDate) {
    return `${formatThaiDateShort(startDate, false)} (${days} วัน)`;
  }
  return `${formatThaiDateShort(startDate, false)} – ${formatThaiDateShort(endDate, false)} (${days} วัน)`;
}

/**
 * ตรวจหากิจกรรมที่ confirmed แล้วแต่จะหลุดออกนอกช่วงวันใหม่
 */
export function getConfirmedActivitiesOutsideRange<T extends { date: string | null; status: string }>(
  activities: T[],
  newStart: string,
  newEnd: string,
): T[] {
  return activities.filter((act) => {
    if (act.status !== "confirmed" && act.status !== "completed") return false;
    if (!act.date) return true; // confirmed แต่ไม่มีวัน
    return act.date < newStart || act.date > newEnd;
  });
}

/**
 * ฟังก์ชันเรียงลำดับกิจกรรมตามเวลาอย่างมีเสถียรภาพ (Deterministic Sort)
 * 1. date ascending (nulls last)
 * 2. startTime ascending (nulls last)
 * 3. createdAt ascending
 */
export function sortActivitiesChronologically<T extends {
  date: string | null;
  startTime: string | null;
  createdAt: number;
}>(list: T[]): T[] {
  return [...list].sort((a, b) => {
    // 1. วันที่
    if (a.date && b.date) {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
    } else if (a.date && !b.date) {
      return -1;
    } else if (!a.date && b.date) {
      return 1;
    }

    // 2. เวลาเริ่มต้น
    if (a.startTime && b.startTime) {
      if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
    } else if (a.startTime && !b.startTime) {
      return -1;
    } else if (!a.startTime && b.startTime) {
      return 1;
    }

    // 3. เวลาที่สร้าง (createdAt)
    return a.createdAt - b.createdAt;
  });
}
