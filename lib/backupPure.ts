import type { TripBackup, TripBackupCounts } from "./types.ts";

/**
 * จัดรูปแบบชื่อไฟล์ JSON สำหรับดาวน์โหลดสำรองข้อมูล
 * รูปแบบ: honeytrip-backup-[roomId]-[YYYY-MM-DD].json
 */
export function formatBackupFileName(roomId: string, date: Date = new Date()): string {
  const safeId = roomId.replace(/[^a-zA-Z0-9_-]/g, "");
  const dateStr = date.toISOString().slice(0, 10);
  return `honeytrip-backup-${safeId}-${dateStr}.json`;
}

/**
 * ตรวจสอบความสมบูรณ์ของโครงสร้างไฟล์สำรองข้อมูล (Pure Validation)
 */
export function validateBackupStructure(
  backup: unknown,
): { valid: boolean; error?: string; counts?: TripBackupCounts } {
  if (!backup || typeof backup !== "object") {
    return { valid: false, error: "ข้อมูลสำรองไม่ถูกต้อง (ต้องเป็น JSON Object)" };
  }

  const b = backup as Partial<TripBackup>;

  if (b.format !== "honeytrip-backup") {
    return { valid: false, error: "ฟอร์แมตไฟล์สำรองไม่ถูกต้อง (ไม่ใช่ honeytrip-backup)" };
  }

  if (typeof b.schemaVersion !== "number" || b.schemaVersion < 1) {
    return { valid: false, error: "schemaVersion ของข้อมูลสำรองไม่ถูกต้อง" };
  }

  if (!b.roomId || typeof b.roomId !== "string") {
    return { valid: false, error: "ไม่พบ roomId ในข้อมูลสำรอง" };
  }

  if (!b.data || typeof b.data !== "object") {
    return { valid: false, error: "ไม่พบโครงสร้างข้อมูล data ในไฟล์สำรอง" };
  }

  const { data } = b;
  const requiredArrays = [
    "members",
    "places",
    "votes",
    "settings",
    "plan",
    "activities",
    "activityComments",
  ] as const;

  for (const key of requiredArrays) {
    if (!Array.isArray(data[key])) {
      return { valid: false, error: `ข้อมูลหมวด ${key} ต้องเป็น Array` };
    }
  }

  if (!data.room || typeof data.room !== "object") {
    return { valid: false, error: "ข้อมูล room ต้องเป็น Object" };
  }

  const counts: TripBackupCounts = {
    members: data.members.length,
    places: data.places.length,
    votes: data.votes.length,
    settings: data.settings.length,
    plan: data.plan.length,
    activities: data.activities.length,
    activityComments: data.activityComments.length,
  };

  return { valid: true, counts };
}
