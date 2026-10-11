"use client";

import Link from "next/link";
import { Lilita_One } from "next/font/google";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArchiveTripModal } from "@/components/ArchiveTripModal";
import { Tooltip } from "@/components/Tooltip";
import { ROOM_EMOJIS } from "@/lib/constants";
import { ensureUser, isFirebaseConfigured } from "@/lib/firebase";
import { createRoom, restoreRoom } from "@/lib/rooms";
import { useAllRooms } from "@/lib/useAllRooms";
import { useProfile } from "@/store/profile";

const lilitaOne = Lilita_One({
  subsets: ["latin"],
  weight: "400",
});

export default function Home() {
  const router = useRouter();
  const { rooms, error: roomsError } = useAllRooms();
  const [currentUid, setCurrentUid] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [emoji, setEmoji] = useState(ROOM_EMOJIS[0]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showArchivedSection, setShowArchivedSection] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<{
    id: string;
    title: string;
    emoji: string;
  } | null>(null);

  const recent = useProfile((s) => s.recentRooms);
  const recentIds = new Set(recent.map((r) => r.id));

  useEffect(() => {
    if (isFirebaseConfigured) {
      ensureUser()
        .then((user) => setCurrentUid(user.uid))
        .catch(() => {});
    }
  }, []);

  const activeRooms = useMemo(
    () => rooms?.filter((r) => !r.archived),
    [rooms],
  );
  const archivedRooms = useMemo(
    () => rooms?.filter((r) => r.archived),
    [rooms],
  );

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
    <main className="mx-auto w-full max-w-xl flex-1 px-3.5 sm:px-4 py-6 sm:py-12 pb-24 sm:pb-16 space-y-6 sm:space-y-8">
      {/* Brand & Value Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-amber-100 border border-amber-200 shadow-sm text-4xl">
          🍯
        </div>
        <h1 className={`${lilitaOne.className} text-3xl tracking-normal text-stone-900`}>
          HoneyTrip
        </h1>
        <p className="text-sm font-medium text-stone-600 max-w-sm mx-auto">
          นัดเที่ยวกับแก๊งเพื่อน · ไม่ต้องล็อกอิน · อัปเดตแบบ Real-time
        </p>

        <div className="pt-1 flex flex-wrap justify-center gap-2">
          <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-medium text-stone-600">
            ⚡ ใช้งานง่าย
          </span>
          <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-[11px] font-medium text-stone-600">
            🛡️ คุ้มครองข้อมูล ปลอดภัย
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

      {/* ACTIVE TRIPS SECTION */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-1">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-stone-900">
              🏖️ ทริปที่กำลังใช้งาน
            </h2>
            {activeRooms && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-900">
                {activeRooms.length} ทริป
              </span>
            )}
          </div>
          <span className="text-[11px] font-medium text-stone-500">
            อัปเดตสดอัตโนมัติ
          </span>
        </div>

        {roomsError && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3.5 text-xs text-amber-900">
            ⚠️ <b>คำแนะนำ:</b> หากไม่เห็นรายการทริป โปรดตรวจสอบว่าได้อัปเดต Rules บน Firebase Console แล้วหรือยัง
          </div>
        )}

        {rooms === undefined ? (
          <div className="card py-8 text-center text-stone-500">
            <div className="text-2xl animate-pulse mb-1">🍯</div>
            <p className="text-xs font-medium">กำลังโหลดรายการทริป…</p>
          </div>
        ) : activeRooms && activeRooms.length === 0 ? (
          <div className="card py-8 text-center text-stone-500 space-y-2">
            <p className="text-2xl">🌴</p>
            <p className="text-sm font-semibold text-stone-800">ยังไม่มีทริปที่กำลังใช้งาน</p>
            <p className="text-xs text-stone-500">
              เป็นผู้นำทริปคนแรก สร้างห้องด้านล่างแล้วชวนเพื่อนมาวางแผนเที่ยวได้เลย!
            </p>
            {!showCreateForm && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(true)}
                  className="btn-primary !py-2 !px-4 text-xs font-bold shadow-xs inline-flex items-center gap-1.5 cursor-pointer active:scale-98"
                >
                  <span>➕ สร้างทริปแรกเลย</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2.5">
            {activeRooms?.map((r) => {
              const isRecent = recentIds.has(r.id);
              const isOwner = Boolean(r.ownerUid && currentUid && r.ownerUid === currentUid);
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
                  className="card group flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-3.5 !p-3.5 sm:!p-4 transition-all hover:border-amber-300 hover:shadow-md"
                >
                  {/* Top Level on Mobile (<sm), Left Column on Desktop (sm:) */}
                  <Link
                    href={`/t/${r.id}`}
                    className="flex items-start sm:items-center gap-3 sm:gap-3.5 min-w-0 flex-1 cursor-pointer"
                  >
                    <span className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 border border-amber-200 text-2xl group-hover:scale-105 group-hover:bg-amber-200/60 transition-transform mt-0.5 sm:mt-0">
                      {r.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <h3 className="line-clamp-2 sm:line-clamp-1 text-sm font-bold text-stone-900 group-hover:text-amber-800 break-words leading-snug">
                          {r.title}
                        </h3>
                        {isRecent && (
                          <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200/60">
                            เข้าล่าสุด
                          </span>
                        )}
                        {isOwner && (
                          <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-300">
                            👑 ผู้ดูแล
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone-500 mt-1 sm:mt-0.5">
                        <span className="font-mono font-semibold text-stone-600 bg-stone-100 px-1.5 py-0.5 rounded text-[11px]">
                          #{r.id}
                        </span>
                        {dateStr && (
                          <span className="text-[11px] text-stone-500">
                            สร้างเมื่อ {dateStr}
                          </span>
                        )}
                      </div>
                    </div>
                  </Link>

                  {/* Bottom Level on Mobile (<sm), Right Column on Desktop (sm:) */}
                  <div className="flex items-center gap-2 pt-2 border-t border-stone-100 sm:border-t-0 sm:pt-0 sm:shrink-0">
                    <Link
                      href={`/t/${r.id}`}
                      className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-white sm:bg-stone-50 sm:text-stone-700 sm:hover:bg-amber-100 sm:hover:text-amber-900 sm:border sm:border-stone-200/80 px-3.5 py-2.5 sm:py-2 text-xs font-bold transition-all shadow-xs min-h-[44px] sm:min-h-[36px]"
                    >
                      <span>เข้าห้องทริป</span>
                      <span className="text-xs">→</span>
                    </Link>

                    {isOwner && (
                      <Tooltip content="จัดเก็บทริปนี้เข้าคลัง (ข้อมูลไม่สูญหาย)">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setArchiveTarget({ id: r.id, title: r.title, emoji: r.emoji });
                          }}
                          className="flex h-11 w-11 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-xl text-stone-400 hover:bg-amber-50 hover:text-amber-800 hover:border-amber-300 border border-stone-200/60 sm:border-transparent transition-all cursor-pointer active:scale-95"
                          aria-label={`จัดเก็บทริป ${r.title}`}
                        >
                          📦
                        </button>
                      </Tooltip>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ARCHIVED TRIPS SECTION */}
      {archivedRooms && archivedRooms.length > 0 && (
        <section className="space-y-3 pt-1">
          <div className="flex items-center justify-between px-1">
            <button
              type="button"
              onClick={() => setShowArchivedSection((prev) => !prev)}
              className="flex items-center gap-2 text-sm font-bold text-stone-700 hover:text-stone-900 transition-colors cursor-pointer"
            >
              <span>📦 คลังทริปที่จัดเก็บไว้</span>
              <span className="rounded-full bg-stone-200 px-2 py-0.5 text-xs font-semibold text-stone-700">
                {archivedRooms.length}
              </span>
              <span className="text-xs text-amber-700 font-semibold underline underline-offset-2">
                {showArchivedSection ? "ซ่อน ▲" : "เปิดดู ▼"}
              </span>
            </button>
            <span className="text-[11px] text-stone-400">โหมดอ่านอย่างเดียว</span>
          </div>

          {showArchivedSection && (
            <div className="space-y-2.5 animate-in fade-in duration-150">
              {archivedRooms.map((r) => {
                const isOwner = Boolean(r.ownerUid && currentUid && r.ownerUid === currentUid);
                const dateStr = r.createdAt
                  ? new Date(r.createdAt).toLocaleDateString("th-TH", {
                      day: "numeric",
                      month: "short",
                      year: "2-digit",
                    })
                  : "";
                const archivedDateStr = r.archivedAt
                  ? new Date(r.archivedAt).toLocaleDateString("th-TH", {
                      day: "numeric",
                      month: "short",
                      year: "2-digit",
                    })
                  : null;

                return (
                  <div
                    key={r.id}
                    className="card flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-3.5 !p-3.5 sm:!p-4 bg-stone-50/70 border-stone-200/90 hover:bg-white transition-all"
                  >
                    <Link
                      href={`/t/${r.id}`}
                      className="flex items-start sm:items-center gap-3 sm:gap-3.5 min-w-0 flex-1 cursor-pointer"
                    >
                      <span className="flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center rounded-2xl bg-stone-100 border border-stone-200 text-2xl mt-0.5 sm:mt-0 opacity-80">
                        {r.emoji}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <h3 className="line-clamp-2 sm:line-clamp-1 text-sm font-bold text-stone-700 break-words leading-snug">
                            {r.title}
                          </h3>
                          <span className="shrink-0 rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-semibold text-stone-600 border border-stone-300/60">
                            📦 จัดเก็บแล้ว
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-stone-400 mt-1 sm:mt-0.5">
                          <span className="font-mono text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded text-[11px]">
                            #{r.id}
                          </span>
                          {archivedDateStr ? (
                            <span className="text-[11px]">จัดเก็บเมื่อ {archivedDateStr}</span>
                          ) : dateStr ? (
                            <span className="text-[11px]">สร้างเมื่อ {dateStr}</span>
                          ) : null}
                        </div>
                      </div>
                    </Link>

                    <div className="flex items-center gap-2 pt-2 border-t border-stone-100 sm:border-t-0 sm:pt-0 sm:shrink-0">
                      <Link
                        href={`/t/${r.id}`}
                        className="flex-1 sm:flex-initial flex items-center justify-center gap-1 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 px-3 py-2 text-xs font-semibold transition-all min-h-[44px] sm:min-h-[36px]"
                      >
                        <span>ดูข้อมูล</span>
                        <span>→</span>
                      </Link>

                      {isOwner && (
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await restoreRoom(r.id);
                            } catch (err) {
                              alert(err instanceof Error ? err.message : "กู้คืนทริปไม่สำเร็จ");
                            }
                          }}
                          className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white px-3 py-2 text-xs font-bold transition-all shadow-xs min-h-[44px] sm:min-h-[36px] cursor-pointer active:scale-98"
                        >
                          <span>↩️ กู้คืนทริป</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* CREATE ROOM CARD (COLLAPSIBLE) */}
      <section className="space-y-3 pt-2">
        {!showCreateForm ? (
          <button
            type="button"
            onClick={() => setShowCreateForm(true)}
            className="card group w-full flex items-center justify-between gap-3 border-2 border-dashed border-amber-300/80 bg-amber-50/40 hover:bg-amber-100/60 hover:border-amber-400 !p-3.5 sm:!p-4 transition-all text-left cursor-pointer active:scale-99 shadow-xs"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-200/80 border border-amber-300/80 text-xl group-hover:scale-105 transition-transform shadow-xs">
                ➕
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-stone-900 group-hover:text-amber-950">
                  สร้างห้องทริปใหม่
                </h3>
                <p className="text-xs text-stone-500 truncate mt-0.5">
                  ตั้งชื่อทริปใหม่แล้วชวนเพื่อนๆ เข้ามาร่วมลงชื่อ
                </p>
              </div>
            </div>
            <span className="shrink-0 flex items-center gap-1.5 rounded-xl bg-amber-400 hover:bg-amber-500 text-stone-900 font-bold text-xs px-3 py-2 shadow-xs transition-all group-hover:bg-amber-500">
              <span>เปิดฟอร์ม</span>
              <span className="text-[10px]">▼</span>
            </span>
          </button>
        ) : (
          <form
            onSubmit={submit}
            className="card space-y-4 border-amber-200/90 shadow-sm animate-in fade-in duration-150"
          >
            <div className="flex items-start justify-between border-b border-stone-100 pb-2.5 gap-2">
              <div>
                <h2 className="text-base font-bold text-stone-900">➕ สร้างห้องทริปใหม่</h2>
                <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">
                  ตั้งชื่อทริปใหม่แล้วระบบจะพาไปยังหน้าแดชบอร์ดเพื่อให้เพื่อนๆ เข้ามาร่วมลงชื่อ
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setShowCreateForm(false);
                }}
                className="shrink-0 flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-stone-800 bg-stone-100 hover:bg-stone-200 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer"
                title="ย่อฟอร์มเก็บ"
              >
                <span>ย่อเก็บ</span>
                <span className="text-[10px]">▲</span>
              </button>
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
                autoFocus
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

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setShowCreateForm(false);
                }}
                className="btn-secondary !py-3 text-sm font-semibold shrink-0"
              >
                ย่อเก็บ
              </button>
              <Tooltip
                content={
                  !isFirebaseConfigured
                    ? "กรุณาใส่ Firebase Config ใน .env.local ก่อนสร้างห้อง"
                    : "สร้างห้องทริปใหม่ และเข้าสู่แดชบอร์ดทันที"
                }
                className="flex-1"
              >
                <button
                  type="submit"
                  className="btn-primary w-full !py-3 text-sm font-bold shadow-md"
                  disabled={busy || !isFirebaseConfigured}
                >
                  {busy ? "กำลังสร้างห้องทริป…" : "🍯 สร้างห้องทริป แล้วเริ่มนัดเพื่อน"}
                </button>
              </Tooltip>
            </div>
          </form>
        )}
      </section>

      {/* Archive Trip Confirmation Modal */}
      <ArchiveTripModal
        roomId={archiveTarget?.id ?? null}
        roomTitle={archiveTarget?.title}
        roomEmoji={archiveTarget?.emoji}
        onClose={() => setArchiveTarget(null)}
      />
    </main>
  );
}
