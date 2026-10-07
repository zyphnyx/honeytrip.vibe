"use client";

import { useMemo, useState } from "react";
import { PREFS, STATUSES, MAX_DAYS } from "@/lib/constants";
import { addDays, formatRange } from "@/lib/dates";
import { baht, buildSummary, computeStats } from "@/lib/stats";
import type { Member, Room } from "@/lib/types";
import { Calendar } from "./Calendar";
import { Tooltip } from "./Tooltip";

function MemberAvatar({ m, isCurrent }: { m: Member; isCurrent: boolean }) {
  const prefLabels = m.prefs
    .map((p) => PREFS.find((item) => item.id === p)?.label.split(" ")[1])
    .filter(Boolean)
    .join(", ");

  const tooltipInfo = (
    <div className="text-left space-y-1.5 p-0.5">
      <div className="flex items-center gap-1.5 border-b border-stone-800 pb-1">
        <span className="text-lg">{m.emoji}</span>
        <div>
          <div className="font-bold text-amber-200">
            {m.name} {isCurrent && "(คุณ)"}
          </div>
          <div className="text-[11px] text-stone-400">
            {m.status === "going"
              ? "✅ ไปแน่นอน"
              : m.status === "maybe"
              ? "🤔 ยังไม่แน่ใจ"
              : "❌ ไปไม่ได้"}
          </div>
        </div>
      </div>

      <div className="text-[11px] text-stone-300 space-y-0.5">
        <div>
          ⏱ สะดวก: <span className="text-white font-medium">{m.durationMin}–{m.durationMax} วัน</span>
        </div>
        {m.budgetMax > 0 && (
          <div>
            💰 งบ: <span className="text-white font-medium">{baht(m.budgetMin)}–{baht(m.budgetMax)}</span>
          </div>
        )}
        {m.origin && (
          <div>
            📍 ต้นทาง: <span className="text-white font-medium">{m.origin}</span>
          </div>
        )}
        <div>
          🚗 เดินทาง:{" "}
          <span className="text-white font-medium">
            {m.transport === "own_car"
              ? `มีรถ (รับได้ ${m.seats} ที่)`
              : m.transport === "need_ride"
              ? "ขอติดรถไปด้วย"
              : "แบบไหนก็ได้"}
          </span>
        </div>
        {prefLabels && (
          <div>
            🎯 สไตล์: <span className="text-amber-100">{prefLabels}</span>
          </div>
        )}
        {m.note && (
          <div className="mt-1 border-t border-stone-800 pt-1 text-stone-300 italic">
            &ldquo;{m.note}&rdquo;
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Tooltip content={tooltipInfo} delayMs={100}>
      <button
        type="button"
        className={`group relative flex w-14 flex-col items-center gap-1 rounded-2xl p-1 transition-transform duration-100 hover:scale-105 active:scale-95 focus-visible:outline-2 focus-visible:outline-amber-400 cursor-pointer ${
          m.status === "out" ? "opacity-50 grayscale" : ""
        }`}
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-2xl shadow-xs border border-amber-200/60 group-hover:border-amber-400 transition-colors">
          {m.emoji}
        </span>
        <span className="w-full truncate text-center text-xs font-medium text-stone-800 group-hover:text-amber-800">
          {m.name}
        </span>
        {isCurrent && (
          <span className="absolute -right-0.5 -top-0.5 rounded-full bg-amber-400 px-1.5 py-0.2 text-[9px] font-bold text-stone-950 shadow-xs">
            เรา
          </span>
        )}
      </button>
    </Tooltip>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="card space-y-3">
      <div className="flex items-center justify-between border-b border-stone-100 pb-2">
        <h2 className="text-sm font-bold tracking-tight text-stone-800">{title}</h2>
        {subtitle && <div className="text-xs text-stone-500">{subtitle}</div>}
      </div>
      {children}
    </section>
  );
}

export function Dashboard({
  room,
  roomId,
  members,
  uid,
}: {
  room: Room;
  roomId: string;
  members: Member[];
  uid: string;
}) {
  const stats = useMemo(() => computeStats(members), [members]);
  const [copied, setCopied] = useState<"link" | "summary" | null>(null);

  const url = typeof window === "undefined" ? "" : `${window.location.origin}/t/${roomId}`;
  const summary = buildSummary(room, stats, url);

  const highlight = useMemo(() => {
    if (!stats.window) return undefined;
    return new Set(
      Array.from({ length: stats.window.days }, (_, i) => addDays(stats.window!.start, i)),
    );
  }, [stats.window]);

  async function copy(text: string, kind: "link" | "summary") {
    await navigator.clipboard.writeText(text);
    setCopied(kind);
    setTimeout(() => setCopied(null), 2000);
  }

  const maxDur = Math.max(1, ...stats.durationCounts.slice(1));
  const prefCounts = PREFS.map((p) => ({
    ...p,
    n: stats.active.filter((m) => m.prefs.includes(p.id)).length,
  }))
    .filter((p) => p.n > 0)
    .sort((a, b) => b.n - a.n);

  const recent = [...members].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Quick Action Bar */}
      <div className="grid grid-cols-2 gap-2">
        <Tooltip content="คัดลอกลิงก์ห้องทริป เพื่อส่งให้เพื่อนในแชท" className="w-full">
          <button className="btn-ghost w-full" onClick={() => copy(url, "link")}>
            {copied === "link" ? "✓ คัดลอกแล้ว" : "🔗 คัดลอกลิงก์"}
          </button>
        </Tooltip>

        <Tooltip content="เปิด LINE พร้อมส่งลิงก์ห้องทริปทันที" className="w-full">
          <a
            className="btn-ghost w-full"
            target="_blank"
            rel="noreferrer"
            href={`https://line.me/R/msg/text/?${encodeURIComponent(
              `${room.emoji} ${room.title}\n${url}`,
            )}`}
          >
            💬 ส่งเข้า LINE
          </a>
        </Tooltip>
      </div>

      {members.length === 0 ? (
        <div className="card py-12 text-center text-stone-500">
          <div className="text-4xl mb-2">🍯</div>
          <p className="font-semibold text-stone-800">ยังไม่มีใครเข้าร่วมทริปนี้</p>
          <p className="text-xs text-stone-400 mt-1">
            แตะที่แท็บ &ldquo;➕ เข้าร่วม&rdquo; เพื่อเป็นคนแรกที่ลงชื่อเลย!
          </p>
        </div>
      ) : (
        <>
          {/* Who is going */}
          <Section
            title="👥 ใครไปบ้าง"
            subtitle={`${stats.going.length} ไปแน่ · ${stats.maybe.length} ลังเล · ${stats.out.length} ไม่ไป`}
          >
            <div className="space-y-3 pt-1">
              {STATUSES.map((s) => {
                const list = members.filter((m) => m.status === s.id);
                if (!list.length) return null;
                return (
                  <div key={s.id} className="space-y-2">
                    <div className="flex items-center gap-1.5">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${s.color}`}>
                        {s.short} ({list.length})
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {list.map((m) => (
                        <MemberAvatar key={m.id} m={m} isCurrent={m.id === uid} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-stone-400 pt-1">
              💡 แตะหรือเอาเมาส์ชี้ที่โปรไฟล์เพื่อน เพื่อดูงบ วันที่สะดวก และสไตล์
            </p>
          </Section>

          {/* Calendar Heatmap & Best Window */}
          <Section
            title="📅 วันไหนว่างกันบ้าง"
            subtitle={stats.window ? "คำนวณช่วงที่ดีที่สุดให้อัตโนมัติ" : undefined}
          >
            {stats.window ? (
              <Tooltip
                content={`คำนวณจากคนที่สะดวก ${stats.window.days} วัน และมีวันว่างตรงกันมากที่สุด`}
                className="w-full mb-3 block"
              >
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-sm text-left">
                  <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                    <span>✨ วันที่ลงตัวที่สุด:</span>
                    <span>{formatRange(stats.window.start, stats.window.days)}</span>
                  </div>
                  <div className="mt-1 text-xs text-emerald-700">
                    ว่างพร้อมกัน{" "}
                    <span className="font-bold">{stats.window.available.length}</span> /{" "}
                    {stats.active.length} คน ({stats.window.available.map((m) => m.name).join(", ")})
                    {stats.window.unavailable.length > 0 && (
                      <span className="text-emerald-800/80">
                        {" "}
                        · ติดอยู่: {stats.window.unavailable.map((m) => m.name).join(", ")}
                      </span>
                    )}
                  </div>
                </div>
              </Tooltip>
            ) : (
              <p className="mb-3 text-xs text-stone-500">
                ยังไม่มีช่วงวันที่ลงตัว — ให้ทุกคนเลือกวันว่างในปฏิทินก่อนนะ
              </p>
            )}

            <Calendar
              counts={stats.dateCounts}
              total={stats.active.length}
              highlight={highlight}
              membersByDate={stats.membersByDate}
            />

            <div className="mt-3 flex items-center justify-between text-[11px] text-stone-400 border-t border-stone-100 pt-2">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full border border-emerald-500 bg-emerald-100" />
                กรอบเขียว = ช่วงแนะนำ
              </span>
              <span>ชี้ที่วันเพื่อดูรายชื่อเพื่อนที่ว่าง</span>
            </div>
          </Section>

          {/* Budget & Duration Grid */}
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Budget */}
            <Section title="💰 งบประมาณที่ลงตัว">
              {stats.budget ? (
                <Tooltip
                  content={
                    stats.budget.all
                      ? "งบนี้ทุกคนในกลุ่มสามารถรับได้สบายๆ"
                      : `มีเพื่อน ${stats.budget.covered} จาก ${stats.budget.of} คนที่งบครอบคลุมราคานี้`
                  }
                  className="w-full block"
                >
                  <div className="p-1 cursor-help">
                    <div className="text-3xl font-extrabold text-stone-900 tabular-nums">
                      ~{baht(stats.budget.value)}
                    </div>
                    <div className="mt-1 text-xs text-stone-500">
                      เฉลี่ยต่อคน · รองรับได้{" "}
                      <span className="font-semibold text-stone-800">
                        {stats.budget.covered}/{stats.budget.of} คน
                      </span>
                    </div>
                    {!stats.budget.all && (
                      <div className="mt-2 text-[11px] font-medium text-amber-800 bg-amber-50 rounded-lg p-1.5 border border-amber-200/60">
                        ⚠️ งบของทุกคนยังไม่ซ้อนทับกันทั้งหมด ลองคุยปรับงบกันดูนะ
                      </div>
                    )}
                  </div>
                </Tooltip>
              ) : (
                <p className="text-xs text-stone-500 py-3">ยังไม่มีใครระบุงบประมาณ</p>
              )}
            </Section>

            {/* Duration Histogram */}
            <Section title="⏱ จำนวนวันที่สะดวก">
              <div className="pt-2">
                <div className="flex h-20 items-end gap-2 px-1">
                  {Array.from({ length: MAX_DAYS }, (_, i) => i + 1).map((d) => {
                    const n = stats.durationCounts[d];
                    const voters = stats.membersByDuration[d] ?? [];
                    const isBest = d === stats.bestDuration;
                    const heightPercent = maxDur > 0 ? (n / maxDur) * 100 : 0;

                    const barContent = (
                      <div className="flex flex-1 flex-col items-center gap-1 group cursor-help">
                        <div
                          className={`w-full rounded-t-lg transition-colors ${
                            isBest
                              ? "bg-amber-400 group-hover:bg-amber-500"
                              : n > 0
                              ? "bg-amber-200 group-hover:bg-amber-300"
                              : "bg-stone-100"
                          }`}
                          style={{
                            height: `${heightPercent}%`,
                            minHeight: n > 0 ? "8px" : "4px",
                          }}
                        />
                        <span
                          className={`text-xs tabular-nums ${
                            isBest ? "font-bold text-stone-900" : "text-stone-500"
                          }`}
                        >
                          {d} วัน
                        </span>
                      </div>
                    );

                    return voters.length > 0 ? (
                      <Tooltip
                        key={d}
                        content={
                          <div>
                            <div className="font-bold text-amber-200">{d} วัน ({n} คน)</div>
                            <div className="text-[11px] text-stone-300 mt-0.5">
                              {voters.join(", ")}
                            </div>
                          </div>
                        }
                        className="flex-1"
                      >
                        {barContent}
                      </Tooltip>
                    ) : (
                      <div key={d} className="flex-1">
                        {barContent}
                      </div>
                    );
                  })}
                </div>

                <p className="mt-3 text-xs text-stone-600 border-t border-stone-100 pt-2">
                  {stats.bestDuration ? (
                    <span>
                      🎯 คนส่วนใหญ่สะดวกที่{" "}
                      <span className="font-bold text-stone-900">{stats.bestDuration} วัน</span>{" "}
                      (เช่น {stats.bestDuration} วัน {stats.bestDuration - 1} คืน)
                    </span>
                  ) : (
                    "ยังไม่มีข้อมูลจำนวนวัน"
                  )}
                </p>
              </div>
            </Section>
          </div>

          {/* Preferences & Carpool */}
          {(prefCounts.length > 0 || stats.cars.seats > 0 || stats.cars.needRide > 0) && (
            <Section title="🎯 สไตล์ทริป & 🚗 รถ">
              <div className="space-y-3">
                {prefCounts.length > 0 && (
                  <div>
                    <div className="text-xs text-stone-500 mb-2 font-medium">สไตล์ยอดนิยม:</div>
                    <div className="flex flex-wrap gap-1.5">
                      {prefCounts.map((p) => (
                        <Tooltip
                          key={p.id}
                          content={`มีเพื่อนอยากไปสไตล์นี้ ${p.n} คน`}
                        >
                          <span className="chip !text-xs !py-1 !px-2.5 cursor-help">
                            {p.label} · <span className="font-bold tabular-nums">{p.n}</span>
                          </span>
                        </Tooltip>
                      ))}
                    </div>
                  </div>
                )}

                {(stats.cars.seats > 0 || stats.cars.needRide > 0) && (
                  <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-3 text-xs space-y-2">
                    <div className="flex items-center justify-between font-semibold text-stone-800">
                      <span>สถานะที่นั่งในรถ</span>
                      <span>
                        ว่าง {stats.cars.seats} ที่ · ขอติดรถ {stats.cars.needRide} คน
                      </span>
                    </div>

                    {stats.cars.drivers.length > 0 && (
                      <div className="text-stone-600 space-y-1">
                        <div className="font-medium text-stone-700">คนที่มีรถ:</div>
                        <div className="flex flex-wrap gap-1.5">
                          {stats.cars.drivers.map((d, i) => (
                            <span
                              key={i}
                              className="rounded-lg border border-stone-200 bg-white px-2 py-1 text-[11px]"
                            >
                              🚗 {d.emoji} {d.name} (รับได้ {d.seats} ที่)
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {stats.cars.needRide > stats.cars.seats && (
                      <div className="text-amber-800 font-medium">
                        ⚠️ ที่นั่งยังไม่พอสำหรับทุกคน (ขาดอีก {stats.cars.needRide - stats.cars.seats} ที่)
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Recent Activity */}
          <Section title="⚡ ความเคลื่อนไหวล่าสุด">
            <ul className="divide-y divide-stone-100 text-xs text-stone-600">
              {recent.map((m) => (
                <li key={m.id} className="py-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{m.emoji}</span>
                    <span className="font-semibold text-stone-900">{m.name}</span>
                    <span className="text-stone-400">อัปเดตข้อมูล</span>
                  </div>
                  <span className="text-stone-400 tabular-nums">
                    {new Date(m.updatedAt).toLocaleTimeString("th-TH", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </Section>

          {/* Master Copy Summary CTA */}
          <Tooltip
            content="สรุปเนื้อหาทริปทั้งหมดจัดเป็นข้อความเรียบร้อย สามารถส่งลงในกลุ่ม LINE ได้ทันที"
            className="w-full"
          >
            <button
              className="btn-primary w-full !py-3 text-sm font-bold shadow-md"
              onClick={() => copy(summary, "summary")}
            >
              {copied === "summary" ? "✓ คัดลอกแล้ว วางใน LINE ได้เลย!" : "📋 คัดลอกสรุปส่ง LINE"}
            </button>
          </Tooltip>
        </>
      )}
    </div>
  );
}
