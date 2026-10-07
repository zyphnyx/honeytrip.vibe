"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Tooltip } from "@/components/Tooltip";
import { ROOM_EMOJIS } from "@/lib/constants";
import { isFirebaseConfigured } from "@/lib/firebase";
import { createRoom } from "@/lib/rooms";
import { useProfile } from "@/store/profile";

export default function Home() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState(ROOM_EMOJIS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hydrated = useProfile((s) => s.hydrated);
  const recent = useProfile((s) => s.recentRooms);
  const forget = useProfile((s) => s.forgetRoom);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("กรุณาตั้งชื่อทริปก่อนนะ");
    setError(null);
    setBusy(true);
    try {
      const id = await createRoom(title, emoji);
      router.push(`/t/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "สร้างห้องไม่สำเร็จ");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8 sm:py-12">
      {/* Brand & Value Header */}
      <div className="mb-8 text-center space-y-2">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-100 border border-amber-200 shadow-sm text-4xl">
          🍯
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-stone-900">
          HoneyTrip
        </h1>
        <p className="text-sm font-medium text-stone-600 max-w-sm mx-auto">
          นัดเที่ยวกับเพื่อนแบบไร้รอยต่อ · ไม่ต้องล็อกอิน · คำนวณวันว่างและงบแบบ Real-time
        </p>

        <div className="pt-1 flex flex-wrap justify-center gap-2">
          <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-medium text-stone-600">
            ⚡ ซิงก์สด Real-time
          </span>
          <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-medium text-stone-600">
            🔒 เก็บข้อมูลในเครื่อง
          </span>
          <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-medium text-stone-600">
            🆓 ฟรี 100%
          </span>
        </div>
      </div>

      {!isFirebaseConfigured && (
        <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 space-y-1.5">
          <div className="font-bold flex items-center gap-1.5 text-sm">
            <span>⚙️</span> ยังไม่ได้ตั้งค่า Firebase
          </div>
          <p>
            คัดลอกไฟล์ <code>.env.example</code> เป็น <code>.env.local</code> แล้วใส่ค่า Config จาก Firebase Console (ดูขั้นตอนใน README.md)
          </p>
        </div>
      )}

      {/* Create Room Card */}
      <form onSubmit={submit} className="card space-y-4">
        <div>
          <h2 className="text-base font-bold text-stone-900">สร้างห้องทริปใหม่</h2>
          <p className="text-xs text-stone-400 mt-0.5">
            ตั้งชื่อทริปแล้วแชร์ลิงก์ให้เพื่อนใน LINE เข้ามาร่วมโหวตวันและงบ
          </p>
        </div>

        <div>
          <label className="label">ชื่อทริป</label>
          <input
            className="input text-base"
            placeholder="เช่น ปลายฝนต้นหนาวเขาใหญ่, ภูเก็ตแก๊งมอ"
            maxLength={60}
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div>
          <label className="label">เลือกสัญลักษณ์ทริป</label>
          <div className="flex flex-wrap gap-1.5">
            {ROOM_EMOJIS.map((em) => (
              <Tooltip key={em} content={`เลือกไอคอน ${em}`}>
                <button
                  type="button"
                  onClick={() => setEmoji(em)}
                  className={`flex h-11 w-11 items-center justify-center rounded-xl text-xl transition-transform active:scale-90 cursor-pointer ${
                    emoji === em
                      ? "bg-amber-300 ring-2 ring-amber-500 scale-105 shadow-xs"
                      : "bg-stone-50 hover:bg-stone-100 border border-stone-200/60"
                  }`}
                >
                  {em}
                </button>
              </Tooltip>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
            ⚠️ {error}
          </div>
        )}

        <Tooltip
          content={
            !isFirebaseConfigured
              ? "กรุณาใส่ Firebase Config ใน .env.local ก่อนสร้างห้อง"
              : "สร้างห้องทริปใหม่ และเข้าสู่แดชบอร์ดทันที"
          }
          className="w-full"
        >
          <button
            type="submit"
            className="btn-primary w-full !py-3 text-sm font-bold shadow-md"
            disabled={busy || !isFirebaseConfigured}
          >
            {busy ? "กำลังสร้างห้องทริป…" : "🍯 สร้างห้องทริป แล้วเริ่มนัดเพื่อน"}
          </button>
        </Tooltip>
      </form>

      {/* Recent Visited Rooms */}
      {hydrated && recent.length > 0 && (
        <section className="mt-8 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-bold uppercase tracking-wider text-stone-500">
              ห้องทริปที่คุณเคยเข้าล่าสุด
            </h2>
            <span className="text-[11px] text-stone-400">จำไว้ในเครื่องนี้</span>
          </div>

          <ul className="space-y-2">
            {recent.map((r) => (
              <li
                key={r.id}
                className="card flex items-center justify-between gap-3 !p-3 transition-colors hover:border-amber-300/80"
              >
                <Link
                  href={`/t/${r.id}`}
                  className="flex flex-1 items-center gap-3 truncate group cursor-pointer"
                >
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-xl border border-amber-200/60">
                    {r.emoji}
                  </span>
                  <div className="truncate">
                    <div className="truncate text-sm font-bold text-stone-800 group-hover:text-amber-800">
                      {r.title}
                    </div>
                    <div className="text-[11px] font-mono text-stone-400">
                      #{r.id}
                    </div>
                  </div>
                </Link>

                <Tooltip content="ลบออกจากรายการประวัติของเครื่องนี้">
                  <button
                    onClick={() => forget(r.id)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-red-500 transition-colors"
                    aria-label="ลบออกจากประวัติ"
                  >
                    ✕
                  </button>
                </Tooltip>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
