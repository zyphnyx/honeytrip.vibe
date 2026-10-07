"use client";

import { useState } from "react";
import { AVATARS, MAX_DAYS, PREFS, STATUSES, TRANSPORTS } from "@/lib/constants";
import { removeMember, saveMember } from "@/lib/rooms";
import type { Member, MemberInput } from "@/lib/types";
import { useProfile } from "@/store/profile";
import { Calendar } from "./Calendar";
import { Tooltip } from "./Tooltip";

interface Props {
  roomId: string;
  uid: string;
  initial?: Member;
  onSaved: () => void;
}

const DAY_OPTIONS = Array.from({ length: MAX_DAYS }, (_, i) => i + 1);

export function MemberForm({ roomId, uid, initial, onSaved }: Props) {
  const profile = useProfile();
  const [name, setName] = useState(initial?.name ?? profile.name);
  const [emoji, setEmoji] = useState(initial?.emoji ?? profile.emoji);
  const [status, setStatus] = useState(initial?.status ?? "going");
  const [durationMin, setDurationMin] = useState(initial?.durationMin ?? 2);
  const [durationMax, setDurationMax] = useState(initial?.durationMax ?? 3);
  const [budgetMin, setBudgetMin] = useState(initial ? String(initial.budgetMin) : "");
  const [budgetMax, setBudgetMax] = useState(initial ? String(initial.budgetMax) : "");
  const [dates, setDates] = useState(() => new Set(initial?.availableDates ?? []));
  const [origin, setOrigin] = useState(initial?.origin ?? "");
  const [transport, setTransport] = useState(initial?.transport ?? "any");
  const [seats, setSeats] = useState(initial?.seats ?? 3);
  const [prefs, setPrefs] = useState(() => new Set(initial?.prefs ?? []));
  const [note, setNote] = useState(initial?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = <T,>(set: Set<T>, v: T, apply: (s: Set<T>) => void) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    apply(next);
  };

  const setMin = (v: number) => {
    setDurationMin(v);
    if (v > durationMax) setDurationMax(v);
  };
  const setMax = (v: number) => {
    setDurationMax(v);
    if (v < durationMin) setDurationMin(v);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const bMin = Number(budgetMin) || 0;
    const bMax = Number(budgetMax) || 0;
    if (!name.trim()) return setError("กรุณาระบุชื่อของคุณก่อนนะ");
    if (bMax && bMin > bMax) return setError("งบประมาณต่ำสุดต้องไม่มากกว่างบสูงสุด");
    setError(null);
    setSaving(true);
    const data: MemberInput = {
      name: name.trim().slice(0, 30),
      emoji,
      status,
      durationMin,
      durationMax,
      budgetMin: bMin,
      budgetMax: bMax,
      availableDates: [...dates].sort(),
      origin: origin.trim().slice(0, 40),
      transport,
      seats: transport === "own_car" ? seats : 0,
      prefs: [...prefs],
      note: note.trim().slice(0, 200),
    };
    try {
      await saveMember(roomId, uid, data);
      profile.setProfile(data.name, data.emoji);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "บันทึกข้อมูลไม่สำเร็จ");
    } finally {
      setSaving(false);
    }
  }

  async function leave() {
    if (!confirm("ต้องการลบข้อมูลของคุณออกจากห้องทริปนี้หรือไม่?")) return;
    await removeMember(roomId, uid);
    onSaved();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* Identity & Status */}
      <section className="card space-y-4">
        <div>
          <label className="label">ชื่อของคุณ</label>
          <input
            className="input"
            value={name}
            maxLength={30}
            required
            onChange={(e) => setName(e.target.value)}
            placeholder="เช่น นอ, แจน, บอย"
          />
        </div>

        <div>
          <label className="label">เลือก Avatar ประจำตัว</label>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {AVATARS.map((a) => (
              <Tooltip key={a} content={`เลือก avatar ${a}`}>
                <button
                  type="button"
                  onClick={() => setEmoji(a)}
                  className={`flex h-11 w-11 items-center justify-center rounded-xl text-xl transition-transform active:scale-90 cursor-pointer ${
                    emoji === a
                      ? "bg-amber-300 ring-2 ring-amber-500 scale-105 shadow-xs"
                      : "bg-stone-50 hover:bg-stone-100 border border-stone-200/60"
                  }`}
                >
                  {a}
                </button>
              </Tooltip>
            ))}
          </div>
        </div>

        <div>
          <label className="label">สถานะการร่วมทริป</label>
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => (
              <Tooltip
                key={s.id}
                content={
                  s.id === "going"
                    ? "ไปแน่นอน: นำวันที่และงบของคุณไปคำนวณในระบบ"
                    : s.id === "maybe"
                    ? "ลังเล: ยังไม่ชัวร์แต่อยากดูวันว่างตรงกัน"
                    : "ไปไม่ได้: ไม่นำข้อมูลไปคำนวณวันทริป"
                }
              >
                <button
                  type="button"
                  onClick={() => setStatus(s.id)}
                  className={`chip ${status === s.id ? "chip-on" : ""}`}
                >
                  {s.label}
                </button>
              </Tooltip>
            ))}
          </div>
        </div>
      </section>

      {/* Days & Budget */}
      <section className="card space-y-4">
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="label !mb-0">จำนวนวันที่สะดวกเที่ยว</label>
            <span className="text-xs text-stone-400">เลือกช่วงได้ถ้ายืดหยุ่น</span>
          </div>
          <div className="flex items-center gap-2 text-sm pt-1">
            <select
              className="input !w-auto cursor-pointer"
              value={durationMin}
              onChange={(e) => setMin(Number(e.target.value))}
            >
              {DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} วัน
                </option>
              ))}
            </select>
            <span className="text-stone-400 font-medium">ถึง</span>
            <select
              className="input !w-auto cursor-pointer"
              value={durationMax}
              onChange={(e) => setMax(Number(e.target.value))}
            >
              {DAY_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} วัน
                </option>
              ))}
            </select>
            <span className="text-xs text-stone-500 pl-1">
              (เช่น 3 วัน = 3 วัน 2 คืน)
            </span>
          </div>
        </div>

        <div>
          <label className="label">งบประมาณต่อคน (ทั้งทริป, บาท)</label>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">
                ฿
              </span>
              <input
                className="input !pl-7 tabular-nums"
                inputMode="numeric"
                placeholder="ต่ำสุด (เช่น 2000)"
                value={budgetMin}
                onChange={(e) => setBudgetMin(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <span className="text-stone-400 font-medium">–</span>
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-stone-400">
                ฿
              </span>
              <input
                className="input !pl-7 tabular-nums"
                inputMode="numeric"
                placeholder="สูงสุด (เช่น 5000)"
                value={budgetMax}
                onChange={(e) => setBudgetMax(e.target.value.replace(/\D/g, ""))}
              />
            </div>
          </div>
          <p className="mt-1 text-xs text-stone-400">
            ระบบจะนำไปหาจุดกึ่งกลางงบที่ทุกคนในกลุ่มสามารถรับได้
          </p>
        </div>
      </section>

      {/* Calendar for Available Dates */}
      <section className="card space-y-2">
        <div className="flex items-center justify-between">
          <label className="label !mb-0">เลือกวันที่คุณว่าง</label>
          <span className="text-xs font-semibold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/80">
            เลือกแล้ว {dates.size} วัน
          </span>
        </div>
        <p className="text-xs text-stone-400">
          แตะเลือกได้หลายวัน ทุกวันที่คุณสามารถลางานหรือออกทริปได้
        </p>

        <div className="pt-2">
          <Calendar selected={dates} onToggle={(k) => toggle(dates, k, setDates)} />
        </div>
      </section>

      {/* Logistics & Vibe */}
      <section className="card space-y-4">
        <div>
          <label className="label">เดินทางออกจาก (จังหวัด / พิกัด)</label>
          <input
            className="input"
            value={origin}
            maxLength={40}
            onChange={(e) => setOrigin(e.target.value)}
            placeholder="เช่น กรุงเทพฯ, ขอนแก่น, รังสิต"
          />
        </div>

        <div>
          <label className="label">การเดินทาง</label>
          <div className="flex flex-wrap gap-2">
            {TRANSPORTS.map((t) => (
              <Tooltip
                key={t.id}
                content={
                  t.id === "own_car"
                    ? "คุณมีรถส่วนตัว และสามารถรับเพื่อนร่วมทางได้"
                    : t.id === "need_ride"
                    ? "คุณต้องการขอติดรถเพื่อนไปด้วย"
                    : "คุณสามารถเดินทางเองได้หรือไม่มีปัญหาเรื่องรถ"
                }
              >
                <button
                  type="button"
                  onClick={() => setTransport(t.id)}
                  className={`chip ${transport === t.id ? "chip-on" : ""}`}
                >
                  {t.label}
                </button>
              </Tooltip>
            ))}
          </div>

          {transport === "own_car" && (
            <div className="mt-3 flex items-center gap-2 rounded-xl bg-amber-50/60 p-2.5 text-xs text-stone-700 border border-amber-200/60">
              <span>สามารถรับเพื่อนได้อีก:</span>
              <input
                className="input !w-16 !py-1 text-center font-bold tabular-nums"
                inputMode="numeric"
                value={seats}
                onChange={(e) =>
                  setSeats(Math.min(9, Number(e.target.value.replace(/\D/g, "")) || 0))
                }
              />
              <span>ที่นั่ง</span>
            </div>
          )}
        </div>

        <div>
          <label className="label">สไตล์ทริปที่อยากไป (เลือกได้หลายข้อ)</label>
          <div className="flex flex-wrap gap-2 pt-0.5">
            {PREFS.map((p) => (
              <Tooltip key={p.id} content={`คลิกเพื่อเลือกหรือยกเลิกสไตล์ ${p.label}`}>
                <button
                  type="button"
                  onClick={() => toggle(prefs, p.id, setPrefs)}
                  className={`chip ${prefs.has(p.id) ? "chip-on" : ""}`}
                >
                  {p.label}
                </button>
              </Tooltip>
            ))}
          </div>
        </div>

        <div>
          <label className="label">หมายเหตุเพิ่มเติม (ข้อจำกัด / แพ้อาหาร)</label>
          <textarea
            className="input resize-none"
            rows={2}
            maxLength={200}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="เช่น แพ้อาหารทะเล, ขอไม่ขึ้นเขาทางชัน, ขอตื่นสาย ฯลฯ"
          />
        </div>
      </section>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-700">
          ⚠️ {error}
        </div>
      )}

      {/* Buttons */}
      <div className="flex gap-2 pt-2">
        <button type="submit" disabled={saving} className="btn-primary flex-1 !py-3">
          {saving
            ? "กำลังบันทึกข้อมูล…"
            : initial
            ? "✓ อัปเดตข้อมูลของฉัน"
            : "🍯 ยืนยันเข้าร่วมทริป"}
        </button>

        {initial && (
          <Tooltip content="ลบข้อมูลการเข้าร่วมทริปนี้ออกจากระบบ">
            <button type="button" onClick={leave} className="btn-danger !py-3">
              ลบข้อมูล
            </button>
          </Tooltip>
        )}
      </div>
    </form>
  );
}
