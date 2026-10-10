import { MAX_DAYS } from "./constants";
import { addDays, formatRange, todayKey } from "./dates";
import type { Member, Room } from "./types";

export interface BestWindow {
  start: string;
  days: number;
  available: Member[];
  unavailable: Member[];
}

export interface Stats {
  total: number;
  going: Member[];
  maybe: Member[];
  out: Member[];
  active: Member[]; // going + maybe
  dateCounts: Record<string, number>;
  membersByDate: Record<string, string[]>;
  durationCounts: number[]; // index = จำนวนวัน (1..MAX_DAYS)
  membersByDuration: Record<number, string[]>;
  bestDuration: number | null;
  budget: { value: number; covered: number; of: number; all: boolean } | null;
  window: BestWindow | null;
  cars: {
    seats: number;
    needRide: number;
    drivers: { name: string; emoji: string; seats: number }[];
    riders: { name: string; emoji: string }[];
  };
}

export function computeStats(members: Member[]): Stats {
  const going = members.filter((m) => m.status === "going");
  const maybe = members.filter((m) => m.status === "maybe");
  const out = members.filter((m) => m.status === "out");
  const active = [...going, ...maybe];

  // --- จำนวนคนว่างและรายชื่อคนว่างต่อวัน ---
  const dateCounts: Record<string, number> = {};
  const membersByDate: Record<string, string[]> = {};
  for (const m of active) {
    for (const d of m.availableDates) {
      dateCounts[d] = (dateCounts[d] ?? 0) + 1;
      if (!membersByDate[d]) membersByDate[d] = [];
      membersByDate[d].push(m.name);
    }
  }

  // --- จำนวนวัน: ค่าที่คนรับได้เยอะสุด พร้อมรายชื่อ ---
  const durationCounts = Array<number>(MAX_DAYS + 1).fill(0);
  const membersByDuration: Record<number, string[]> = {};
  for (let d = 1; d <= MAX_DAYS; d++) {
    membersByDuration[d] = [];
  }
  for (const m of active) {
    for (let d = 1; d <= MAX_DAYS; d++) {
      if (m.durationMin <= d && d <= m.durationMax) {
        durationCounts[d]++;
        membersByDuration[d].push(m.name);
      }
    }
  }
  const maxDur = Math.max(...durationCounts.slice(1));
  const tied: number[] = [];
  for (let d = 1; d <= MAX_DAYS; d++) if (durationCounts[d] === maxDur) tied.push(d);
  const bestDuration = active.length && maxDur > 0 ? tied[Math.floor(tied.length / 2)] : null;

  // --- งบ: จุดที่ครอบคลุมคนมากที่สุด (ถ้าเสมอ เอาถูกสุด) ---
  const withBudget = active.filter((m) => m.budgetMax > 0);
  let budget: Stats["budget"] = null;
  if (withBudget.length) {
    const candidates = withBudget.flatMap((m) => [m.budgetMin, m.budgetMax]);
    let best = { value: 0, covered: -1 };
    for (const c of [...new Set(candidates)].sort((a, b) => a - b)) {
      const covered = withBudget.filter((m) => m.budgetMin <= c && c <= m.budgetMax).length;
      if (covered > best.covered) best = { value: c, covered };
    }
    budget = {
      value: best.value,
      covered: best.covered,
      of: withBudget.length,
      all: best.covered === withBudget.length,
    };
  }

  // --- ช่วงวันที่ดีที่สุด: หน้าต่าง N วันติดกันที่ว่างพร้อมกันมากสุด ---
  let window: BestWindow | null = null;
  if (bestDuration && active.length) {
    const sets = active.map((m) => new Set(m.availableDates));
    const today = todayKey();
    const starts = Object.keys(dateCounts)
      .filter((d) => d >= today)
      .sort();
    let bestCount = 0;
    for (const start of starts) {
      const days = Array.from({ length: bestDuration }, (_, i) => addDays(start, i));
      const avail = active.filter((_, i) => days.every((d) => sets[i].has(d)));
      if (avail.length > bestCount) {
        bestCount = avail.length;
        window = {
          start,
          days: bestDuration,
          available: avail,
          unavailable: active.filter((m) => !avail.includes(m)),
        };
      }
    }
  }

  const drivers = going
    .filter((m) => m.transport === "own_car" && m.seats > 0)
    .map((m) => ({ name: m.name, emoji: m.emoji, seats: m.seats }));

  const riders = going
    .filter((m) => m.transport === "need_ride")
    .map((m) => ({ name: m.name, emoji: m.emoji }));

  const cars = {
    seats: drivers.reduce((s, d) => s + d.seats, 0),
    needRide: riders.length,
    drivers,
    riders,
  };

  return {
    total: members.length,
    going,
    maybe,
    out,
    active,
    dateCounts,
    membersByDate,
    durationCounts,
    membersByDuration,
    bestDuration,
    budget,
    window,
    cars,
  };
}

export const baht = (n: number) => `฿${n.toLocaleString("th-TH")}`;

/** ข้อความสรุปสำหรับ copy ไปวางใน LINE */
export function buildSummary(
  room: Room,
  stats: Stats,
  url: string,
  votingSummary?: {
    leadingStay?: string;
    leadingAttractions?: string[];
  },
): string {
  const lines = [`${room.emoji} ${room.title}`];
  lines.push(
    `👥 ไปแน่ ${stats.going.length} · ลังเล ${stats.maybe.length} · ไม่ไป ${stats.out.length}`,
  );
  if (stats.going.length) lines.push(`✅ ${stats.going.map((m) => m.name).join(", ")}`);
  if (stats.window) {
    lines.push(
      `📅 วันที่ดีที่สุด: ${formatRange(stats.window.start, stats.window.days)} ` +
        `(ว่าง ${stats.window.available.length}/${stats.active.length} คน)`,
    );
  }
  if (stats.budget) {
    lines.push(
      `💰 งบที่ลงตัว ~${baht(stats.budget.value)}/คน ` +
        `(รับได้ ${stats.budget.covered}/${stats.budget.of} คน)`,
    );
  }
  if (stats.bestDuration) lines.push(`⏱ ${stats.bestDuration} วัน`);

  if (votingSummary?.leadingStay) {
    lines.push(`🏡 ที่พักคะแนนนำ: ${votingSummary.leadingStay}`);
  }
  if (votingSummary?.leadingAttractions && votingSummary.leadingAttractions.length > 0) {
    lines.push(`📍 ที่เที่ยวคะแนนนำ: ${votingSummary.leadingAttractions.join(", ")}`);
  }

  lines.push("", `กรอกข้อมูลที่นี่ 👉 ${url}`);
  return lines.join("\n");
}
