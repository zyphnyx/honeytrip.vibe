"use client";

import { useEffect, useState } from "react";
import { ensureUser, isFirebaseConfigured } from "./firebase";
import { subscribeAllRooms, type RoomWithId } from "./rooms";

export function useAllRooms() {
  const [rooms, setRooms] = useState<RoomWithId[] | undefined>(undefined);
  const [error, setError] = useState<string | null>(
    isFirebaseConfigured ? null : "ยังไม่ได้ตั้งค่า Firebase (.env.local)",
  );

  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let cancelled = false;
    let unsub: (() => void) | null = null;

    ensureUser()
      .then(() => {
        if (cancelled) return;
        unsub = subscribeAllRooms(
          (list) => setRooms(list),
          (err) => setError(err.message),
        );
      })
      .catch((err) => setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด"));

    return () => {
      cancelled = true;
      if (unsub) unsub();
    };
  }, []);

  return { rooms, error };
}
