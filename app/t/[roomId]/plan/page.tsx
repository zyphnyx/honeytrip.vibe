"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense } from "react";
import { TripPlanner } from "@/components/plan/TripPlanner";
import { useActivities } from "@/lib/useActivities";
import { usePlaces } from "@/lib/usePlaces";
import { useRoom } from "@/lib/useRoom";

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="card mt-6 py-8 text-center text-stone-600 space-y-2">
      {children}
    </div>
  );
}

export default function TripPlanPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-xl flex-1 px-4 pt-6">
          <Notice>
            <div className="text-3xl animate-pulse">🗓️</div>
            <p className="text-sm font-medium">กำลังเตรียมข้อมูลแผนเที่ยว…</p>
          </Notice>
        </main>
      }
    >
      <TripPlanView />
    </Suspense>
  );
}

function TripPlanView() {
  const { roomId } = useParams<{ roomId: string }>();
  const { uid, room, members, error: roomError } = useRoom(roomId);
  const { places } = usePlaces(roomId, members || [], uid);
  const planner = useActivities(roomId, members || [], uid);

  let body: React.ReactNode;

  if (roomError || planner.error) {
    body = (
      <Notice>
        <p className="text-3xl">😵</p>
        <p className="text-sm font-semibold text-stone-900">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
        <p className="text-xs text-stone-500 break-words px-4">
          {roomError || planner.error}
        </p>
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
  } else if (!room || !members || !uid || planner.isLoading) {
    body = (
      <Notice>
        <div className="text-3xl animate-pulse">🍯</div>
        <p className="text-sm font-medium text-stone-700">กำลังเชื่อมต่อข้อมูลแผนเที่ยวแบบ Real-time…</p>
      </Notice>
    );
  } else {
    body = (
      <TripPlanner
        roomId={roomId}
        room={room}
        members={members}
        uid={uid}
        places={places || []}
        planner={planner}
      />
    );
  }

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-16 pt-3">
      {body}
    </main>
  );
}
