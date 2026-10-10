"use client";

import { useState } from "react";
import { Tooltip } from "@/components/Tooltip";
import type { PlaceSettings } from "@/lib/types";

interface DestinationHeaderProps {
  settings: PlaceSettings | null | undefined;
  onUpdateDestination: (destination: string) => Promise<void>;
}

export function DestinationHeader({
  settings,
  onUpdateDestination,
}: DestinationHeaderProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(settings?.destination || "");
  const [isSaving, setIsSaving] = useState(false);

  const currentDestination = settings?.destination?.trim() || "";

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!value.trim()) return;
    setIsSaving(true);
    try {
      await onUpdateDestination(value.trim());
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to update destination:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200/80 bg-white p-3 shadow-xs">
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-base border border-amber-200/60">
          🗺️
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-stone-400">
            จุดหมายปลายทางของทริป (Trip Destination)
          </p>
          {isEditing ? (
            <form onSubmit={handleSave} className="mt-1 flex items-center gap-1.5">
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="เช่น หัวหิน, เชียงใหม่, เขาใหญ่"
                className="rounded-lg border border-amber-300 bg-amber-50/40 px-2 py-1 text-xs font-bold text-stone-900 focus:outline-hidden focus:ring-2 focus:ring-amber-400"
                autoFocus
              />
              <button
                type="submit"
                disabled={isSaving || !value.trim()}
                className="rounded-lg bg-amber-500 px-2.5 py-1 text-xs font-bold text-white hover:bg-amber-600 disabled:opacity-50 cursor-pointer"
              >
                {isSaving ? "…" : "บันทึก"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setValue(currentDestination);
                  setIsEditing(false);
                }}
                className="rounded-lg border border-stone-200 px-2 py-1 text-xs text-stone-500 hover:bg-stone-50 cursor-pointer"
              >
                ยกเลิก
              </button>
            </form>
          ) : (
            <p className="truncate text-sm font-bold text-stone-900">
              {currentDestination ? (
                <span>📍 {currentDestination}</span>
              ) : (
                <span className="text-stone-400 italic font-normal">ยังไม่ได้ระบุปลายทาง</span>
              )}
            </p>
          )}
        </div>
      </div>

      {!isEditing && (
        <Tooltip content="เปลี่ยนจุดหมายปลายทางของทริปนี้">
          <button
            type="button"
            onClick={() => {
              setValue(currentDestination);
              setIsEditing(true);
            }}
            className="shrink-0 rounded-xl border border-stone-200 bg-stone-50 px-2.5 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-100 transition-colors cursor-pointer"
          >
            ✏️ {currentDestination ? "เปลี่ยนปลายทาง" : "ระบุปลายทาง"}
          </button>
        </Tooltip>
      )}
    </div>
  );
}
