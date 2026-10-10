import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  setDoc,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { ensureUser, getDb } from "./firebase";
import type { Member, MemberInput, Room } from "./types";

// ตัด 0/O/1/I/l ออก อ่านง่ายเวลาส่งต่อกัน
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function generateRoomId(length = 10): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export async function createRoom(title: string, emoji: string): Promise<string> {
  await ensureUser();
  const id = generateRoomId();
  const room: Room = { title: title.trim(), emoji, createdAt: Date.now() };
  await setDoc(doc(getDb(), "rooms", id), room);
  return id;
}

export interface RoomWithId extends Room {
  id: string;
}

export function subscribeAllRooms(
  onData: (rooms: RoomWithId[]) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "rooms"),
    (snap) => {
      const list = snap.docs.map((d) => ({ ...(d.data() as Room), id: d.id }));
      list.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      onData(list);
    },
    onError,
  );
}

export function subscribeRoom(
  roomId: string,
  onData: (room: Room | null) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    doc(getDb(), "rooms", roomId),
    (snap) => onData(snap.exists() ? (snap.data() as Room) : null),
    onError,
  );
}

export function subscribeMembers(
  roomId: string,
  onData: (members: Member[]) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  return onSnapshot(
    collection(getDb(), "rooms", roomId, "members"),
    (snap) => {
      const list = snap.docs.map((d) => ({ ...(d.data() as Omit<Member, "id">), id: d.id }));
      list.sort((a, b) => a.updatedAt - b.updatedAt);
      onData(list);
    },
    onError,
  );
}

export async function saveMember(roomId: string, uid: string, input: MemberInput): Promise<void> {
  const data: Omit<Member, "id"> = { ...input, updatedAt: Date.now() };
  await setDoc(doc(getDb(), "rooms", roomId, "members", uid), data);
}

export async function removeMember(roomId: string, uid: string): Promise<void> {
  await deleteDoc(doc(getDb(), "rooms", roomId, "members", uid));
}

export async function deleteRoom(roomId: string): Promise<void> {
  await ensureUser();
  const db = getDb();

  // Cascade delete all subcollections: members, places, votes, settings
  const subcollections = ["members", "places", "votes", "settings"];

  for (const sub of subcollections) {
    const snap = await getDocs(collection(db, "rooms", roomId, sub));
    if (!snap.empty) {
      const batch = writeBatch(db);
      snap.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    }
  }

  // Delete root room doc
  await deleteDoc(doc(db, "rooms", roomId));
}
