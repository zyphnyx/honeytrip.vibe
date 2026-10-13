import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { ensureWritableUser, getDb } from "./firebase";
import type { Member, MemberInput, Room } from "./types";

// ตัด 0/O/1/I/l ออก อ่านง่ายเวลาส่งต่อกัน
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function generateRoomId(length = 10): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

export async function createRoom(title: string, emoji: string): Promise<string> {
  const user = await ensureWritableUser();
  const id = generateRoomId();
  const room: Room = {
    title: title.trim(),
    emoji,
    createdAt: Date.now(),
    ownerUid: user.uid,
    archived: false,
  };
  await setDoc(doc(getDb(), "rooms", id), room);
  return id;
}

export async function archiveRoom(roomId: string): Promise<void> {
  const user = await ensureWritableUser();
  const db = getDb();
  await updateDoc(doc(db, "rooms", roomId), {
    archived: true,
    archivedAt: Date.now(),
    archivedBy: user.uid,
  });
}

export async function restoreRoom(roomId: string): Promise<void> {
  await ensureWritableUser();
  const db = getDb();
  await updateDoc(doc(db, "rooms", roomId), {
    archived: false,
    archivedAt: null,
    archivedBy: null,
  });
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
  await ensureWritableUser();
  const data: Omit<Member, "id"> = { ...input, updatedAt: Date.now() };
  await setDoc(doc(getDb(), "rooms", roomId, "members", uid), data);
}

export async function removeMember(roomId: string, uid: string): Promise<void> {
  await ensureWritableUser();
  await deleteDoc(doc(getDb(), "rooms", roomId, "members", uid));
}

/**
 * @deprecated การลบห้องทริปถาวรถูกปิดใช้งานอย่างเด็ดขาดเพื่อความปลอดภัยของข้อมูล
 * ห้ามลบข้อมูลทริปถาวรผ่าน Client SDK โดยให้ใช้ฟังก์ชัน archiveRoom() แทน
 */
export async function deleteRoom(_roomId?: string): Promise<void> {
  void _roomId;
  throw new Error(
    "ไม่อนุญาตให้ลบห้องทริปถาวรผ่านหน้าเว็บ เพื่อความปลอดภัยของข้อมูล กรุณาใช้ฟังก์ชันจัดเก็บทริป (Archive) แทน",
  );
}
