import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { ensureUser, getDb } from "./firebase";
import type {
  Place,
  PlaceInput,
  PlaceSettings,
  VoteDoc,
} from "./types";


export { calculateVotingResults, isMemberEligibleToVote } from "./voting";


// --- Firestore CRUD & Real-time Subscriptions ---

export function subscribePlaces(
  roomId: string,
  onData: (places: Place[]) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "rooms", roomId, "places"),
    (snap) => {
      const list = snap.docs.map((d) => ({
        ...(d.data() as Omit<Place, "id">),
        id: d.id,
      }));
      // เรียงตามเวลาที่สร้าง
      list.sort((a, b) => a.createdAt - b.createdAt);
      onData(list);
    },
    onError,
  );
}

export function subscribeVotes(
  roomId: string,
  onData: (votes: VoteDoc[]) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "rooms", roomId, "votes"),
    (snap) => {
      const list = snap.docs.map((d) => ({
        ...(d.data() as Omit<VoteDoc, "id">),
        id: d.id,
      }));
      onData(list);
    },
    onError,
  );
}

export function subscribePlaceSettings(
  roomId: string,
  onData: (settings: PlaceSettings | null) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(getDb(), "rooms", roomId, "settings", "places"),
    (snap) => {
      onData(snap.exists() ? (snap.data() as PlaceSettings) : null);
    },
    onError,
  );
}

/** ทำความสะอาด Object ก่อนบันทึกลง Firestore — ตัด key ที่เป็น undefined ออก ป้องกัน Firestore โยน error */
function sanitizeFirestorePayload<T extends Record<string, unknown>>(obj: T): T {
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

export async function savePlace(
  roomId: string,
  input: PlaceInput,
  placeId?: string,
): Promise<string> {
  await ensureUser();
  const db = getDb();
  const now = Date.now();
  const targetId = placeId || doc(collection(db, "rooms", roomId, "places")).id;
  
  const payload = sanitizeFirestorePayload({
    ...input,
    createdAt: input.source === "geoapify" ? now : (input as Partial<Place>).createdAt || now,
    updatedAt: now,
  });

  await setDoc(doc(db, "rooms", roomId, "places", targetId), payload, { merge: true });
  return targetId;
}

export async function deletePlace(roomId: string, placeId: string): Promise<void> {
  await ensureUser();
  const db = getDb();
  await deleteDoc(doc(db, "rooms", roomId, "places", placeId));
}

export async function updatePlaceSettings(
  roomId: string,
  settings: Partial<PlaceSettings>,
): Promise<void> {
  await ensureUser();
  const db = getDb();
  const payload = sanitizeFirestorePayload({
    ...settings,
    updatedAt: Date.now(),
  });
  await setDoc(doc(db, "rooms", roomId, "settings", "places"), payload, { merge: true });
}

export async function toggleStayVote(
  roomId: string,
  uid: string,
  stayId: string,
  currentStayIds: string[],
): Promise<void> {
  await ensureUser();
  const db = getDb();
  const exists = currentStayIds.includes(stayId);
  let newIds: string[];

  if (exists) {
    // ถอนโหวต
    newIds = currentStayIds.filter((id) => id !== stayId);
  } else {
    // โหวตเพิ่ม (ไม่เกิน 3 ที่)
    if (currentStayIds.length >= 3) {
      throw new Error("โหวตที่พักได้สูงสุด 3 ที่ต่อคนเท่านั้น");
    }
    newIds = [...currentStayIds, stayId];
  }

  const voteRef = doc(db, "rooms", roomId, "votes", uid);
  await setDoc(
    voteRef,
    {
      stayIds: newIds,
      stayId: newIds[0] ?? null, // backward compatibility
      updatedAt: Date.now(),
    },
    { merge: true },
  );
}

export async function castStayVote(
  roomId: string,
  uid: string,
  stayId: string | null,
): Promise<void> {
  await ensureUser();
  const db = getDb();
  const voteRef = doc(db, "rooms", roomId, "votes", uid);
  await setDoc(
    voteRef,
    {
      stayId,
      stayIds: stayId ? [stayId] : [],
      updatedAt: Date.now(),
    },
    { merge: true },
  );
}


export async function toggleAttractionVote(
  roomId: string,
  uid: string,
  attractionId: string,
  currentAttractionIds: string[],
): Promise<void> {
  await ensureUser();
  const db = getDb();
  const exists = currentAttractionIds.includes(attractionId);
  let newIds: string[];

  if (exists) {
    // ถอนโหวต
    newIds = currentAttractionIds.filter((id) => id !== attractionId);
  } else {
    // โหวตเพิ่ม (ไม่เกิน 10 ที่)
    if (currentAttractionIds.length >= 10) {
      throw new Error("โหวตที่เที่ยวได้สูงสุด 10 ที่ต่อคนเท่านั้น");
    }
    newIds = [...currentAttractionIds, attractionId];
  }

  const voteRef = doc(db, "rooms", roomId, "votes", uid);
  await setDoc(
    voteRef,
    {
      attractionIds: newIds,
      updatedAt: Date.now(),
    },
    { merge: true },
  );
}
