import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { formatBackupFileName, validateBackupStructure } from "./backupPure";
import { getDb } from "./firebase";
import type {
  Activity,
  ActivityComment,
  Member,
  Place,
  Room,
  TripBackup,
  TripBackupCounts,
} from "./types";

export { formatBackupFileName, validateBackupStructure };

/**
 * ดึงข้อมูลทริปทั้งหมดจาก Firestore ออกมาเป็นโครงสร้าง TripBackup
 * หาก collection ใดเกิดข้อผิดพลาด จะ Throw Error ทันที (ห้ามสร้าง Partial Backup)
 */
export async function exportTripBackup(roomId: string): Promise<TripBackup> {
  const db = getDb();

  // 1. ตรวจสอบและดึงข้อมูลห้องทริปหลัก
  const roomSnap = await getDoc(doc(db, "rooms", roomId));
  if (!roomSnap.exists()) {
    throw new Error(`ไม่พบห้องทริป #${roomId} บนระบบ`);
  }
  const roomData = { ...(roomSnap.data() as Room) };

  // 2. ดึงข้อมูล Subcollections ทั้งหมดแบบขนาน (หากอันใดพัง Promise.all จะ reject ทันที)
  const [
    membersSnap,
    placesSnap,
    votesSnap,
    settingsSnap,
    planSnap,
    activitiesSnap,
    activityCommentsSnap,
  ] = await Promise.all([
    getDocs(collection(db, "rooms", roomId, "members")),
    getDocs(collection(db, "rooms", roomId, "places")),
    getDocs(collection(db, "rooms", roomId, "votes")),
    getDocs(collection(db, "rooms", roomId, "settings")),
    getDocs(collection(db, "rooms", roomId, "plan")),
    getDocs(collection(db, "rooms", roomId, "activities")),
    getDocs(collection(db, "rooms", roomId, "activityComments")),
  ]);

  const members = membersSnap.docs.map((d) => ({
    ...(d.data() as Omit<Member, "id">),
    id: d.id,
  }));
  const places = placesSnap.docs.map((d) => ({
    ...(d.data() as Omit<Place, "id">),
    id: d.id,
  }));
  const votes = votesSnap.docs.map((d) => ({
    ...(d.data() as Record<string, unknown>),
    id: d.id,
  }));
  const settings = settingsSnap.docs.map((d) => ({
    ...(d.data() as Record<string, unknown>),
    id: d.id,
  }));
  const plan = planSnap.docs.map((d) => ({
    ...(d.data() as Record<string, unknown>),
    id: d.id,
  }));
  const activities = activitiesSnap.docs.map((d) => ({
    ...(d.data() as Omit<Activity, "id">),
    id: d.id,
  }));
  const activityComments = activityCommentsSnap.docs.map((d) => ({
    ...(d.data() as Omit<ActivityComment, "id">),
    id: d.id,
  }));

  const counts: TripBackupCounts = {
    members: members.length,
    places: places.length,
    votes: votes.length,
    settings: settings.length,
    plan: plan.length,
    activities: activities.length,
    activityComments: activityComments.length,
  };

  const backup: TripBackup = {
    format: "honeytrip-backup",
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    roomId,
    data: {
      room: roomData,
      members,
      places,
      votes,
      settings,
      plan,
      activities,
      activityComments,
    },
    counts,
  };

  return backup;
}

/**
 * ดาวน์โหลด JSON Backup ผ่าน Web Browser เป็นไฟล์ .json
 */
export function downloadBackupJson(backup: TripBackup): void {
  if (typeof window === "undefined") return;

  const jsonStr = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const fileName = formatBackupFileName(backup.roomId, new Date(backup.exportedAt));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
