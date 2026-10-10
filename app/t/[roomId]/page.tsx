"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Dashboard } from "@/components/Dashboard";
import { DeleteTripModal } from "@/components/DeleteTripModal";
import { MemberForm } from "@/components/MemberForm";
import { PlacesBoard } from "@/components/places/PlacesBoard";
import { Tooltip } from "@/components/Tooltip";
import { useRoom } from "@/lib/useRoom";
import { useProfile } from "@/store/profile";

type Tab = "dashboard" | "places" | "me";

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
  const router = useRouter();
  const { roomId } = useParams<{ roomId: string }>();
  const { uid, room, members, error } = useRoom(roomId);
  const addRecent = useProfile((s) => s.addRecent);
  const [tab, setTab] = useState<Tab | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

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
  } else if (active === "places") {
    body = (
      <PlacesBoard
        roomId={roomId}
        room={room}
        members={members}
        uid={uid}
        me={me}
      />
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

        {/* Room Code Badge & Delete Button */}
        <div className="flex items-center gap-1.5 shrink-0">
          <Tooltip content="รหัสห้องทริป (ใช้แชร์ให้เพื่อน)">
            <span className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-mono font-semibold text-amber-800">
              #{roomId}
            </span>
          </Tooltip>
          <Tooltip content="ลบห้องทริปนี้ถาวร">
            <button
              type="button"
              onClick={() => setShowDeleteModal(true)}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-stone-400 hover:bg-red-50 hover:text-red-600 border border-transparent hover:border-red-200 transition-colors cursor-pointer"
              aria-label="ลบห้องทริปนี้"
            >
              🗑️
            </button>
          </Tooltip>
        </div>
      </header>

      {/* Navigation Tab Bar (3 Tabs: ภาพรวม, สถานที่, ข้อมูลฉัน) */}
      {room && members && uid && (
        <nav className="mb-4 grid grid-cols-3 gap-1 rounded-2xl border border-stone-200/80 bg-stone-100/70 p-1">
          <Tooltip content="ดูภาพรวม วันที่ว่างตรงกัน งบ และความพร้อมของแก๊ง">
            <button
              onClick={() => setTab("dashboard")}
              className={`w-full rounded-xl py-2 text-xs font-bold transition-colors cursor-pointer ${
                active === "dashboard"
                  ? "bg-white text-stone-950 shadow-xs border border-stone-200/60"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              📊 ภาพรวม
            </button>
          </Tooltip>

          <Tooltip content="ค้นหา เสนอ และโหวตที่พักและที่เที่ยวกับเพื่อนๆ">
            <button
              onClick={() => setTab("places")}
              className={`w-full rounded-xl py-2 text-xs font-bold transition-colors cursor-pointer ${
                active === "places"
                  ? "bg-white text-stone-950 shadow-xs border border-stone-200/60"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              📍 สถานที่
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
              {me ? "✏️ ข้อมูลฉัน" : "➕ เข้าร่วม"}
            </button>
          </Tooltip>
        </nav>
      )}


      {body}

      {/* Delete Confirmation Modal */}
      <DeleteTripModal
        roomId={showDeleteModal ? roomId : null}
        roomTitle={room?.title}
        roomEmoji={room?.emoji}
        onClose={() => setShowDeleteModal(false)}
        onDeleted={() => router.push("/")}
      />
    </main>
  );
}
