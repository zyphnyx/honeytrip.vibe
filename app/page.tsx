"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { DeleteTripModal } from "@/components/DeleteTripModal";
import { Tooltip } from "@/components/Tooltip";
import { ROOM_EMOJIS } from "@/lib/constants";
import { isFirebaseConfigured } from "@/lib/firebase";
import { createRoom } from "@/lib/rooms";
import { useAllRooms } from "@/lib/useAllRooms";
import { useProfile } from "@/store/profile";

export default function Home() {
  const router = useRouter();
  const { rooms, error: roomsError } = useAllRooms();
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState(ROOM_EMOJIS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    title: string;
    emoji: string;
  } | null>(null);

  const recent = useProfile((s) => s.recentRooms);
  const recentIds = new Set(recent.map((r) => r.id));

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
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-8 sm:py-12 space-y-8">
      {/* Brand & Value Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-100 border border-amber-200 shadow-sm text-4xl">
          🍯
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight text-stone-900">
          HoneyTrip
        </h1>
        <p className="text-sm font-medium text-stone-600 max-w-sm mx-auto">
          นัดเที่ยวกับแก๊งเพื่อนแบบไร้รอยต่อ · ไม่ต้องล็อกอิน · อัปเดตสดแบบ Real-time
        </p>

        <div className="pt-1 flex flex-wrap justify-center gap-2">
          <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-medium text-stone-600">
            ⚡ ซิงก์สด Real-time
          </span>
          <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-medium text-stone-600">
            👥 เห็นทริปทุกคนในกลุ่ม
          </span>
          <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-medium text-stone-600">
            🆓 ฟรี 100%
          </span>
        </div>
      </div>

      {!isFirebaseConfigured && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 space-y-1.5">
          <div className="font-bold flex items-center gap-1.5 text-sm">
            <span>⚙️</span> ยังไม่ได้ตั้งค่า Firebase
          </div>
          <p>
            คัดลอกไฟล์ <code>.env.example</code> เป็น <code>.env.local</code> แล้วใส่ค่า Config จาก Firebase Console (ดูขั้นตอนใน README.md)
          </p>
        </div>
      )}

      {/* ALL TRIPS LIST SECTION */}
      <section className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-stone-900">
              🏖️ ทริปทั้งหมดในกลุ่ม
            </h2>
            {rooms && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">
                {rooms.length} ทริป
              </span>
            )}
          </div>
          <span className="text-[11px] text-stone-400">อัปเดตสดอัตโนมัติ</span>
        </div>

        {roomsError && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
            ⚠️ <b>คำแนะนำ:</b> หากไม่เห็นรายการทริป โปรดตรวจสอบว่าได้อัปเดต Rules บน Firebase Console ให้เป็น <code>allow read, delete: if signedIn();</code> แล้ว Publish หรือยัง
          </div>
        )}

        {rooms === undefined ? (
          <div className="card py-8 text-center text-stone-500">
            <div className="text-2xl animate-pulse mb-1">🍯</div>
            <p className="text-xs font-medium">กำลังโหลดรายการทริปทั้งหมด…</p>
          </div>
        ) : rooms.length === 0 ? (
          <div className="card py-8 text-center text-stone-500 space-y-2">
            <p className="text-2xl">🌴</p>
            <p className="text-sm font-semibold text-stone-800">ยังไม่มีทริปที่ถูกสร้าง</p>
            <p className="text-xs text-stone-400">
              เป็นผู้นำทริปคนแรก สร้างห้องด้านล่างแล้วชวนเพื่อนมาโหวตได้เลย!
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {rooms.map((r) => {
              const isRecent = recentIds.has(r.id);
              const dateStr = r.createdAt
                ? new Date(r.createdAt).toLocaleDateString("th-TH", {
                    day: "numeric",
                    month: "short",
                    year: "2-digit",
                  })
                : "";

              return (
                <div
                  key={r.id}
                  className="card group flex items-center justify-between gap-3.5 !p-3.5 transition-all hover:border-amber-300 hover:shadow-md"
                >
                  <Link
                    href={`/t/${r.id}`}
                    className="flex items-center gap-3.5 min-w-0 flex-1 cursor-pointer"
                  >
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 border border-amber-200 text-2xl group-hover:scale-105 group-hover:bg-amber-200/60 transition-transform">
                      {r.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-sm font-bold text-stone-900 group-hover:text-amber-800">
                          {r.title}
                        </h3>
                        {isRecent && (
                          <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.2 text-[9px] font-bold text-emerald-800">
                            เข้าล่าสุด
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-stone-400 mt-0.5">
                        <span className="font-mono text-stone-500">#{r.id}</span>
                        {dateStr && <span>· สร้างเมื่อ {dateStr}</span>}
                      </div>
                    </div>
                  </Link>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <Link
                      href={`/t/${r.id}`}
                      className="rounded-xl bg-stone-50 group-hover:bg-amber-100 group-hover:text-amber-900 border border-stone-200/80 px-2.5 py-1.5 text-xs font-semibold text-stone-600 transition-colors"
                    >
                      เข้าห้อง →
                    </Link>

                    <Tooltip content="ลบห้องทริปนี้ถาวร">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDeleteTarget({ id: r.id, title: r.title, emoji: r.emoji });
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-xl text-stone-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 border border-transparent transition-colors cursor-pointer"
                        aria-label={`ลบทริป ${r.title}`}
                      >
                        🗑️
                      </button>
                    </Tooltip>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* CREATE ROOM CARD */}
      <section className="space-y-3 pt-2">
        <form onSubmit={submit} className="card space-y-4 border-amber-200/90 shadow-sm">
          <div className="border-b border-stone-100 pb-2">
            <h2 className="text-base font-bold text-stone-900">➕ สร้างห้องทริปใหม่</h2>
            <p className="text-xs text-stone-400 mt-0.5">
              ตั้งชื่อทริปใหม่แล้วระบบจะพาไปยังหน้าแดชบอร์ดเพื่อให้เพื่อนๆ เข้ามาร่วมลงชื่อ
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
      </section>

      {/* Delete Trip Confirmation Modal */}
      <DeleteTripModal
        roomId={deleteTarget?.id ?? null}
        roomTitle={deleteTarget?.title}
        roomEmoji={deleteTarget?.emoji}
        onClose={() => setDeleteTarget(null)}
      />
    </main>
  );
}
