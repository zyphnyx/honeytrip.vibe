"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Dashboard } from "@/components/Dashboard";
import { MemberForm } from "@/components/MemberForm";
import { Tooltip } from "@/components/Tooltip";
import { useRoom } from "@/lib/useRoom";
import { useProfile } from "@/store/profile";

type Tab = "dashboard" | "me";

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="card mt-6 py-8 text-center text-stone-600 space-y-2">
      {children}
    </div>
  );
}

export default function RoomPage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto w-full max-w-xl flex-1 px-4 pt-6">
          <Notice>
            <div className="text-3xl animate-pulse">🍯</div>
            <p className="text-sm font-medium">กำลังเตรียมข้อมูลห้องทริป…</p>
          </Notice>
        </main>
      }
    >
      <RoomView />
    </Suspense>
  );
}

function RoomView() {
  const { roomId } = useParams<{ roomId: string }>();
  const { uid, room, members, error } = useRoom(roomId);
  const addRecent = useProfile((s) => s.addRecent);
  const [tab, setTab] = useState<Tab | null>(null);

  useEffect(() => {
    if (room) addRecent({ id: roomId, title: room.title, emoji: room.emoji });
  }, [room, roomId, addRecent]);

  const me = members?.find((m) => m.id === uid);
  // ยังไม่เคยกรอก → แสดงหน้ากรอกก่อน
  const active: Tab = tab ?? (me ? "dashboard" : "me");

  let body: React.ReactNode;
  if (error) {
    body = (
      <Notice>
        <p className="text-3xl">😵</p>
        <p className="text-sm font-semibold text-stone-900">เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
        <p className="text-xs text-stone-500 break-words px-4">{error}</p>
      </Notice>
    );
  } else if (room === null) {
    body = (
      <Notice>
        <p className="text-3xl">🔍</p>
        <p className="text-sm font-bold text-stone-800">ไม่พบห้องทริปนี้</p>
        <p className="text-xs text-stone-500">
          รหัสห้องอาจจะไม่ถูกต้อง หรือห้องถูกลบไปแล้ว
        </p>
        <div className="pt-2">
          <Link href="/" className="btn-primary !text-xs !py-2">
            กลับหน้าแรกเพื่อสร้างห้องใหม่
          </Link>
        </div>
      </Notice>
    );
  } else if (!room || !members || !uid) {
    body = (
      <Notice>
        <div className="text-3xl animate-pulse">🍯</div>
        <p className="text-sm font-medium text-stone-700">กำลังเชื่อมต่อห้องทริปแบบ Real-time…</p>
      </Notice>
    );
  } else if (active === "me") {
    body = (
      <>
        {!me && (
          <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50/70 p-3.5 text-xs text-amber-900 leading-relaxed">
            <span className="font-bold">👋 ยินดีต้อนรับสู่ทริปนี้!</span>{" "}
            กรอกวันว่าง งบ และสไตล์ของคุณ เพื่อให้ระบบนำไปคำนวณวันและงบที่ลงตัวที่สุดสำหรับกลุ่มเพื่อน
          </div>
        )}
        <MemberForm
          key={me?.updatedAt ?? "new"}
          roomId={roomId}
          uid={uid}
          initial={me}
          onSaved={() => setTab("dashboard")}
        />
      </>
    );
  } else {
    body = <Dashboard room={room} roomId={roomId} members={members} uid={uid} />;
  }

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 pb-16 pt-3">
      {/* App Header */}
      <header className="mb-4 flex items-center justify-between gap-3 border-b border-stone-200/60 pb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Tooltip content="กลับหน้าแรก HoneyTrip">
            <Link
              href="/"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600 transition-colors hover:bg-stone-50 active:scale-95"
              aria-label="กลับหน้าแรก"
            >
              ‹
            </Link>
          </Tooltip>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-bold text-stone-900 tracking-tight">
              {room ? `${room.emoji} ${room.title}` : "HoneyTrip"}
            </h1>
            {members && (
              <p className="text-[11px] text-stone-400 font-medium">
                👥 ผู้เข้าร่วม {members.length} คน · อัปเดตสดแบบ Real-time
              </p>
            )}
          </div>
        </div>

        {/* Room Code Badge */}
        <Tooltip content="รหัสห้องทริป (ใช้แชร์ให้เพื่อน)">
          <span className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-mono font-semibold text-amber-800">
            #{roomId}
          </span>
        </Tooltip>
      </header>

      {/* Navigation Tab Bar */}
      {room && members && uid && (
        <nav className="mb-4 grid grid-cols-2 gap-1 rounded-2xl border border-stone-200/80 bg-stone-100/70 p-1">
          <Tooltip content="ดูภาพรวม วันที่ว่างตรงกัน งบ และความพร้อมของแก๊ง">
            <button
              onClick={() => setTab("dashboard")}
              className={`w-full rounded-xl py-2 text-xs font-bold transition-colors cursor-pointer ${
                active === "dashboard"
                  ? "bg-white text-stone-950 shadow-xs border border-stone-200/60"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              📊 ภาพรวมทริป
            </button>
          </Tooltip>

          <Tooltip
            content={
              me
                ? "แก้ไขวันว่าง งบ หรือข้อมูลของตัวคุณเอง"
                : "กรอกข้อมูลของคุณเพื่อเข้าร่วมทริปนี้"
            }
          >
            <button
              onClick={() => setTab("me")}
              className={`w-full rounded-xl py-2 text-xs font-bold transition-colors cursor-pointer ${
                active === "me"
                  ? "bg-white text-stone-950 shadow-xs border border-stone-200/60"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              {me ? "✏️ ข้อมูลของฉัน" : "➕ เข้าร่วมทริป"}
            </button>
          </Tooltip>
        </nav>
      )}

      {body}
    </main>
  );
}
