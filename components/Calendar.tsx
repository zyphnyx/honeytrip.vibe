"use client";

import { useState } from "react";
import { parseKey, toKey, todayKey, formatShort } from "@/lib/dates";
import { Tooltip } from "./Tooltip";

const WEEK = ["อา", "จ", "อ", "พ", "พฤ", "ศ", "ส"];
const MONTHS_AHEAD = 11;

interface Props {
  /** โหมดเลือกวัน: ส่ง selected + onToggle */
  selected?: Set<string>;
  onToggle?: (key: string) => void;
  /** โหมด heatmap: จำนวนคนว่างต่อวัน */
  counts?: Record<string, number>;
  total?: number;
  /** ไฮไลต์ช่วงวันที่ดีที่สุด */
  highlight?: Set<string>;
  /** รายชื่อเพื่อนที่ว่างในแต่ละวัน key = YYYY-MM-DD -> ['นนท์', 'มิ้น'] */
  membersByDate?: Record<string, string[]>;
}

function heatColorStyle(ratio: number): string {
  if (ratio <= 0) return "bg-stone-100/60 text-stone-400 border-transparent";
  if (ratio < 0.34) return "bg-amber-100 text-stone-800 border-amber-200/80 font-medium";
  if (ratio < 0.67) return "bg-amber-200 text-stone-900 border-amber-300 font-semibold";
  if (ratio < 1) return "bg-amber-300 text-stone-950 border-amber-400 font-bold";
  return "bg-amber-400 text-stone-950 border-amber-500 font-extrabold shadow-sm";
}

export function Calendar({
  selected,
  onToggle,
  counts,
  total = 0,
  highlight,
  membersByDate,
}: Props) {
  const [cursor, setCursor] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const base = parseKey(todayKey());
  const baseMonth = new Date(base.getFullYear(), base.getMonth(), 1);
  const offset =
    (cursor.getFullYear() - baseMonth.getFullYear()) * 12 +
    cursor.getMonth() -
    baseMonth.getMonth();

  const today = todayKey();
  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const blanks = cursor.getDay();
  const move = (n: number) =>
    setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + n, 1));

  return (
    <div className="select-none">
      {/* Month Navigation */}
      <div className="mb-3 flex items-center justify-between px-1">
        <Tooltip content="ดูเดือนก่อนหน้า">
          <button
            type="button"
            className="btn-ghost !h-8 !w-8 !p-0 rounded-lg text-sm"
            disabled={offset <= 0}
            onClick={() => move(-1)}
            aria-label="เดือนก่อนหน้า"
          >
            ‹
          </button>
        </Tooltip>
        <span className="text-sm font-bold tracking-tight text-stone-800">
          {cursor.toLocaleDateString("th-TH", { month: "long", year: "numeric" })}
        </span>
        <Tooltip content="ดูเดือนถัดไป">
          <button
            type="button"
            className="btn-ghost !h-8 !w-8 !p-0 rounded-lg text-sm"
            disabled={offset >= MONTHS_AHEAD}
            onClick={() => move(1)}
            aria-label="เดือนถัดไป"
          >
            ›
          </button>
        </Tooltip>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-stone-400 mb-1">
        {WEEK.map((w, idx) => (
          <div key={w} className={idx === 0 || idx === 6 ? "text-amber-700/70" : ""}>
            {w}
          </div>
        ))}
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: blanks }, (_, i) => (
          <div key={`blank-${i}`} />
        ))}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const key = toKey(new Date(cursor.getFullYear(), cursor.getMonth(), day));
          const past = key < today;
          const count = counts?.[key] ?? 0;
          const isSelected = selected?.has(key) ?? false;
          const isBest = highlight?.has(key) ?? false;
          const availableFriends = membersByDate?.[key] ?? [];

          // Tooltip content logic
          let hintText: React.ReactNode = null;
          if (past) {
            hintText = <span>{formatShort(key)} (วันที่ผ่านมาแล้ว)</span>;
          } else if (onToggle) {
            hintText = (
              <span>
                {formatShort(key)} — {isSelected ? "แตะเพื่อยกเลิก" : "แตะเพื่อเลือกว่างวันนี้"}
              </span>
            );
          } else if (counts) {
            hintText = (
              <div className="space-y-1">
                <div className="font-semibold text-amber-200">
                  {formatShort(key)} {isBest && "⭐ ช่วงแนะนำ"}
                </div>
                <div className="text-stone-300">
                  {count > 0 ? (
                    <>
                      ว่าง <span className="font-bold text-white">{count}</span> / {total} คน
                      {availableFriends.length > 0 && (
                        <div className="mt-1 border-t border-stone-800 pt-1 text-[11px] text-amber-100">
                          {availableFriends.join(", ")}
                        </div>
                      )}
                    </>
                  ) : (
                    "ยังไม่มีใครเลือกว่างวันนี้"
                  )}
                </div>
              </div>
            );
          }

          let tone = "";
          if (past) {
            tone = "bg-stone-50/50 text-stone-300 border-transparent cursor-not-allowed";
          } else if (selected) {
            tone = isSelected
              ? "bg-amber-400 text-stone-950 font-bold border-amber-500 shadow-sm"
              : "bg-white text-stone-700 border-stone-200 hover:border-amber-300 hover:bg-amber-50/40";
          } else {
            tone = heatColorStyle(total ? count / total : 0);
          }

          const cell = (
            <button
              type="button"
              disabled={past || !onToggle}
              onClick={() => onToggle?.(key)}
              aria-label={`${formatShort(key)} ${count ? `${count} คนว่าง` : ""}`}
              className={`relative flex aspect-square w-full flex-col items-center justify-center rounded-xl border text-sm transition-transform duration-100 ${tone} ${
                isBest ? "ring-2 ring-emerald-500 ring-offset-1 ring-offset-white" : ""
              } ${onToggle && !past ? "active:scale-95 cursor-pointer" : !onToggle && !past ? "cursor-default" : ""}`}
            >
              <span className="leading-tight">{day}</span>
              {counts && !past && count > 0 && (
                <span className="tabular-nums text-[10px] leading-none opacity-85 font-medium">
                  {count}
                </span>
              )}
            </button>
          );

          return hintText ? (
            <Tooltip key={key} content={hintText} delayMs={150} className="w-full">
              {cell}
            </Tooltip>
          ) : (
            <div key={key} className="w-full">
              {cell}
            </div>
          );
        })}
      </div>
    </div>
  );
}
