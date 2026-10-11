"use client";

import Link from "next/link";
import { useState } from "react";
import { formatTripRangeHeader } from "@/lib/activityDates";
import { generateLineItinerarySummary } from "@/lib/activityStats";
import type { Activity, Member, Room, TripPlanMeta } from "@/lib/types";
import { Tooltip } from "../Tooltip";

export function PlanHeader({
  room,
  roomId,
  meta,
  activities = [],
  members = [],
  onOpenDateSetup,
}: {
  room: Room;
  roomId: string;
  meta: TripPlanMeta | null | undefined;
  activities?: Activity[];
  members?: Member[];
  onOpenDateSetup: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const hasDates = Boolean(meta?.startDate && meta?.endDate);

  const planUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/t/${roomId}/plan`
      : `https://honeytrip.app/t/${roomId}/plan`;

  const handleShareLine = async () => {
    const text = generateLineItinerarySummary({
      roomTitle: room.title,
      roomEmoji: room.emoji,
      meta: meta || null,
      activities,
      members,
      planUrl,
    });

    try {
      // 1. ลองเปิด LINE Intent URL สำหรับแชร์โดยตรง
      const lineUrl = `https://line.me/R/msg/text/?${encodeURIComponent(text)}`;
      window.open(lineUrl, "_blank");
    } catch {
      // Fallback
    }

    // 2. คัดลอกข้อความลง Clipboard สำรองไว้เสมอ
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // ignore
    }
  };

  return (
    <header className="mb-4 space-y-3 border-b border-stone-200/60 pb-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Tooltip content="กลับหน้าห้องทริปหลัก">
            <Link
              href={`/t/${roomId}`}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-stone-200 bg-white text-stone-600 transition-colors hover:bg-stone-50 active:scale-95"
              aria-label="กลับหน้าห้องทริป"
            >
              ‹
            </Link>
          </Tooltip>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-lg">{room.emoji}</span>
              <h1 className="truncate text-base sm:text-lg font-bold text-stone-900 tracking-tight">
                {room.title}
              </h1>
            </div>
            <p className="text-[11px] text-stone-400 font-medium">
              🗓️ แผนเที่ยว & ไอเดียกลุ่ม · อัปเดตสด
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <Tooltip content="รหัสห้องทริป">
            <span className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-mono font-semibold text-amber-800">
              #{roomId}
            </span>
          </Tooltip>
        </div>
      </div>

      {/* Date Bar & Quick Share */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-amber-200/70 bg-amber-50/50 p-2.5">
        <button
          type="button"
          onClick={onOpenDateSetup}
          className="group flex items-center gap-1.5 rounded-xl border border-amber-200/80 bg-white px-2.5 py-1.5 text-xs font-semibold text-stone-800 transition-colors hover:bg-amber-100/60 cursor-pointer text-left"
        >
          <span className="text-amber-500">📅</span>
          <span>
            {hasDates ? (
              <span className="font-bold text-amber-950">
                {formatTripRangeHeader(meta?.startDate, meta?.endDate)}
              </span>
            ) : (
              <span className="text-stone-500 font-normal">แตะเพื่อกำหนดวันเดินทางจริง</span>
            )}
          </span>
          <span className="text-[10px] text-amber-600 group-hover:translate-x-0.5 transition-transform">
            ✏️
          </span>
        </button>

        <button
          type="button"
          onClick={handleShareLine}
          className="btn-ghost !text-xs !py-1.5 !px-3 border-emerald-300/80 bg-emerald-50/80 text-emerald-900 font-bold hover:bg-emerald-100 transition-colors shrink-0"
        >
          {copied ? "✓ คัดลอกสรุปแล้ว!" : "💬 ส่งแผนเข้า LINE"}
        </button>
      </div>
    </header>
  );
}
