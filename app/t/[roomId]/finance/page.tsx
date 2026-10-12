"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense } from "react";
import { TripFinance } from "@/components/finance/TripFinance";
import { useActivities } from "@/lib/useActivities";
import { useRoom } from "@/lib/useRoom";

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="card mt-6 py-8 text-center text-stone-600 space-y-2">
      {children}
    </div>
  );
}

export default function TripFinancePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-xl sm:max-w-2xl flex-1 px-4 pt-6">
          <Notice>
            <div className="text-3xl animate-pulse">💸</div>
            <p className="text-sm font-medium">กำลังเตรียมข้อมูลการเงินทริป…</p>
          </Notice>
        </main>
      }
    >
      <TripFinanceView />
    </Suspense>
  );
}

function TripFinanceView() {
  const { roomId } = useParams<{ roomId: string }>();
  const { uid, room, members, error: roomError } = useRoom(roomId);
  const planner = useActivities(roomId, members || [], uid);

  let body: React.ReactNode;

  if (roomError) {
    body = (
      <Notice>
        <p className="text-3xl">😵</p>
        <p className="text-sm font-semibold text-stone-900">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
        <p className="text-xs text-stone-500 break-words px-4">{roomError}</p>
      </Notice>
    );
  } else if (room === null) {
    body = (
      <Notice>
        <p className="text-3xl">🔍</p>
        <p className="text-sm font-bold text-stone-800">ไม่พบห้องทริปนี้</p>
        <p className="text-xs text-stone-500">รหัสห้องอาจจะไม่ถูกต้อง หรือห้องถูกลบไปแล้ว</p>
        <div className="pt-2">
          <Link href="/" className="btn-primary !text-xs !py-2">
            กลับหน้าแรก
          </Link>
        </div>
      </Notice>
    );
  } else if (!room || !members || !uid) {
    body = (
      <Notice>
        <div className="text-3xl animate-pulse">🍯</div>
        <p className="text-sm font-medium text-stone-700">กำลังเชื่อมต่อข้อมูลห้องทริปแบบ Real-time…</p>
      </Notice>
    );
  } else {
    const activitiesList = (planner.activities || []).map((a) => ({ id: a.id, title: a.title }));
    body = (
      <TripFinance
        roomId={roomId}
        room={room}
        members={members}
        uid={uid}
        activities={activitiesList}
      />
    );
  }

  return (
    <main className="mx-auto w-full max-w-xl sm:max-w-2xl flex-1 px-4 pb-16 pt-3">
      {body}
    </main>
  );
}
