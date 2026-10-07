"use client";

import { useEffect, useState } from "react";
import { ensureUser, isFirebaseConfigured } from "@/lib/firebase";
import { subscribeMembers, subscribeRoom } from "@/lib/rooms";
import type { Member, Room } from "@/lib/types";

interface RoomState {
  uid: string | null;
  room: Room | null | undefined; // undefined = กำลังโหลด, null = ไม่พบห้อง
  members: Member[] | undefined;
  error: string | null;
}

/** ล็อกอิน anonymous แล้ว subscribe ห้อง + สมาชิกแบบ real-time */
export function useRoom(roomId: string): RoomState {
  const [uid, setUid] = useState<string | null>(null);
  const [room, setRoom] = useState<Room | null | undefined>(undefined);
  const [members, setMembers] = useState<Member[] | undefined>(undefined);
  const [error, setError] = useState<string | null>(
    isFirebaseConfigured ? null : "ยังไม่ได้ตั้งค่า Firebase (.env.local)",
  );

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let cancelled = false;
    const unsubs: Array<() => void> = [];
    const fail = (e: Error) => setError(e.message);

    ensureUser()
      .then((user) => {
        if (cancelled) return;
        setUid(user.uid);
        unsubs.push(subscribeRoom(roomId, setRoom, fail));
        unsubs.push(subscribeMembers(roomId, setMembers, fail));
      })
      .catch(fail);

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, [roomId]);

  return { uid, room, members, error };
}
