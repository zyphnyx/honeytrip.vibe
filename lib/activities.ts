import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { ensureWritableUser, getDb } from "./firebase";
import type {
  Activity,
  ActivityComment,
  ActivityInput,
  ActivityStatus,
  TripPlanMeta,
} from "./types";

/**
 * ทำความสะอาด Object ก่อนส่งไป Firestore โดยตัด undefined ออกทั้งหมด
 */
export function sanitizeFirestorePayload<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) {
      if (val && typeof val === "object" && !Array.isArray(val) && !(val instanceof Date)) {
        result[key] = sanitizeFirestorePayload(val as Record<string, unknown>);
      } else {
        result[key] = val;
      }
    }
  }
  return result as T;
}

// ==========================================
// 1. Trip Plan Metadata (rooms/{roomId}/plan/meta)
// ==========================================

export function subscribePlanMeta(
  roomId: string,
  onData: (meta: TripPlanMeta | null) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(getDb(), "rooms", roomId, "plan", "meta"),
    (snap) => {
      onData(snap.exists() ? (snap.data() as TripPlanMeta) : null);
    },
    onError,
  );
}

export async function savePlanMeta(
  roomId: string,
  metaInput: Partial<TripPlanMeta>,
  userUid: string,
): Promise<void> {
  await ensureWritableUser();
  const db = getDb();
  const metaRef = doc(db, "rooms", roomId, "plan", "meta");
  const payload = sanitizeFirestorePayload({
    startDate: metaInput.startDate ?? null,
    endDate: metaInput.endDate ?? null,
    timezone: "Asia/Bangkok" as const,
    status: metaInput.status ?? "confirmed",
    updatedBy: userUid,
    updatedAt: Date.now(),
  });
  await setDoc(metaRef, payload, { merge: true });
}

// ==========================================
// 2. Activities (rooms/{roomId}/activities/{activityId})
// ==========================================

export function subscribeActivities(
  roomId: string,
  onData: (activities: Activity[]) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "rooms", roomId, "activities"),
    (snap) => {
      const list = snap.docs.map((d) => ({
        ...(d.data() as Omit<Activity, "id">),
        id: d.id,
        participantUids: d.data().participantUids || [],
        likedByUids: d.data().likedByUids || [],
      })) as Activity[];
      onData(list);
    },
    onError,
  );
}

export async function saveActivity(
  roomId: string,
  input: ActivityInput,
  activityId?: string,
  userUid?: string,
): Promise<string> {
  await ensureWritableUser();
  const db = getDb();
  const now = Date.now();
  const targetId = activityId || doc(collection(db, "rooms", roomId, "activities")).id;

  const payload = sanitizeFirestorePayload({
    title: input.title.trim(),
    description: (input.description || "").trim(),
    category: input.category,
    status: input.status,
    date: input.date ?? null,
    startTime: input.startTime ?? null,
    endTime: input.endTime ?? null,
    placeId: input.placeId ?? null,
    placeSnapshot: input.placeSnapshot ?? null,
    transport: input.transport ?? null,
    cost: {
      mode: input.cost?.mode || "unknown",
      amount: input.cost?.amount !== null && input.cost?.amount !== undefined ? Math.max(0, Number(input.cost.amount)) : null,
      currency: "THB" as const,
    },
    participantUids: Array.isArray(input.participantUids) ? Array.from(new Set(input.participantUids.filter(Boolean))) : [],
    // ถ้าสร้างใหม่ likedByUids เป็น array เปล่า ถ้าอัปเดตไม่ทับ likedByUids
    ...(activityId ? {} : { likedByUids: [], createdAt: now, createdBy: userUid || input.createdBy }),
    updatedAt: now,
  });

  const targetRef = doc(db, "rooms", roomId, "activities", targetId);
  await setDoc(targetRef, payload, { merge: true });
  return targetId;
}

export async function updateActivityStatus(
  roomId: string,
  activityId: string,
  status: ActivityStatus,
): Promise<void> {
  await ensureWritableUser();
  const ref = doc(getDb(), "rooms", roomId, "activities", activityId);
  await updateDoc(ref, {
    status,
    updatedAt: Date.now(),
  });
}

export async function toggleActivityLike(
  roomId: string,
  activityId: string,
  userUid: string,
  isCurrentlyLiked: boolean,
): Promise<void> {
  await ensureWritableUser();
  const ref = doc(getDb(), "rooms", roomId, "activities", activityId);
  await updateDoc(ref, {
    likedByUids: isCurrentlyLiked ? arrayRemove(userUid) : arrayUnion(userUid),
    updatedAt: Date.now(),
  });
}

export async function deleteActivity(roomId: string, activityId: string): Promise<void> {
  await ensureWritableUser();
  const db = getDb();

  // ลบคอมเมนต์ที่ผูกกับกิจกรรมนี้ออกด้วย
  try {
    const commentsQ = query(
      collection(db, "rooms", roomId, "activityComments"),
      where("activityId", "==", activityId),
    );
    const commentsSnap = await getDocs(commentsQ);
    if (!commentsSnap.empty) {
      const batch = writeBatch(db);
      commentsSnap.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  } catch (err) {
    console.error("Failed to delete related comments:", err);
  }

  // ลบตัวเอกสารกิจกรรม
  await deleteDoc(doc(db, "rooms", roomId, "activities", activityId));
}

// ==========================================
// 3. Activity Comments (rooms/{roomId}/activityComments/{commentId})
// ==========================================

export function subscribeActivityComments(
  roomId: string,
  activityId: string,
  onData: (comments: ActivityComment[]) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(getDb(), "rooms", roomId, "activityComments"),
    where("activityId", "==", activityId),
  );
  return onSnapshot(
    q,
    (snap) => {
      const list = snap.docs.map((d) => ({
        ...(d.data() as Omit<ActivityComment, "id">),
        id: d.id,
      }));
      // เรียงตามลำดับเวลาเขียนคอมเมนต์เก่า -> ใหม่
      list.sort((a, b) => a.createdAt - b.createdAt);
      onData(list);
    },
    onError,
  );
}

export async function addActivityComment(
  roomId: string,
  activityId: string,
  body: string,
  authorUid: string,
  authorName?: string,
  authorEmoji?: string,
): Promise<string> {
  await ensureWritableUser();
  const trimmed = body.trim();
  if (!trimmed) throw new Error("ข้อความคอมเมนต์ต้องไม่ว่างเปล่า");
  if (trimmed.length > 500) throw new Error("ข้อความคอมเมนต์ต้องไม่เกิน 500 ตัวอักษร");

  const db = getDb();
  const commentRef = doc(collection(db, "rooms", roomId, "activityComments"));
  const payload = sanitizeFirestorePayload({
    activityId,
    authorUid,
    authorName: authorName || "",
    authorEmoji: authorEmoji || "🐝",
    body: trimmed,
    createdAt: Date.now(),
  });

  await setDoc(commentRef, payload);
  return commentRef.id;
}

export async function deleteActivityComment(
  roomId: string,
  commentId: string,
): Promise<void> {
  await ensureWritableUser();
  await deleteDoc(doc(getDb(), "rooms", roomId, "activityComments", commentId));
}
