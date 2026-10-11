"use client";

import { useCallback, useEffect, useState } from "react";
import { archiveRoom } from "@/lib/rooms";

interface Props {
  roomId: string | null;
  roomTitle?: string;
  roomEmoji?: string;
  onClose: () => void;
  onArchived?: () => void;
}

export function ArchiveTripModal({
  roomId,
  roomTitle,
  roomEmoji,
  onClose,
  onArchived,
}: Props) {
  const [confirmInput, setConfirmInput] = useState("");
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = useCallback(() => {
    if (!archiving) {
      setConfirmInput("");
      setError(null);
      onClose();
    }
  }, [archiving, onClose]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !archiving) handleClose();
    }
    if (roomId) {
      window.addEventListener("keydown", onKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [roomId, archiving, handleClose]);

  if (!roomId) return null;

  const targetTitle = (roomTitle || "").trim();
  const isMatch = confirmInput.trim() === targetTitle;

  async function handleArchive() {
    if (!roomId || !isMatch || archiving) return;
    setArchiving(true);
    setError(null);
    try {
      await archiveRoom(roomId);
      handleClose();
      onArchived?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "จัดเก็บทริปไม่สำเร็จ");
      setArchiving(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="archive-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/50 backdrop-blur-xs animate-in fade-in"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-md max-h-[92vh] overflow-y-auto rounded-3xl border border-amber-200/90 bg-white p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-100 border border-amber-300 text-2xl shadow-xs">
              📦
            </span>
            <div className="min-w-0">
              <h3 id="archive-dialog-title" className="text-base font-bold text-stone-900">
                จัดเก็บทริปนี้เข้าคลัง?
              </h3>
              <p className="text-xs text-stone-500 truncate mt-0.5">
                {roomEmoji} {roomTitle || `#${roomId}`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={archiving}
            className="rounded-xl p-1.5 text-stone-400 hover:bg-stone-100 transition-colors cursor-pointer"
            aria-label="ปิด"
          >
            ✕
          </button>
        </div>

        {/* Informative Explanation */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs text-amber-950 space-y-2 leading-relaxed">
          <div className="font-bold flex items-center gap-1.5 text-amber-900">
            <span>🛡️</span>
            <span>ข้อมูลไม่สูญหาย 100%</span>
          </div>
          <p>
            ข้อมูลสมาชิก, สถานที่ที่โหวต, แผนเที่ยว, ค่าใช้จ่าย และความคิดเห็นทั้งหมด<b>จะยังคงอยู่ครบถ้วน</b> และทริปจะถูกย้ายไปอยู่ในส่วน &ldquo;คลังทริปที่จัดเก็บไว้&rdquo; ในสถานะอ่านอย่างเดียว
          </p>
          <p className="text-[11px] text-amber-800/90">
            💡 ผู้ดูแลทริปสามารถกู้คืนทริปกลับมาใช้งานใหม่ได้ทุกเมื่อ
          </p>
        </div>

        {/* Confirmation Input Safeguard */}
        <div className="space-y-1.5 pt-1">
          <label htmlFor="confirm-archive-title" className="text-xs font-semibold text-stone-700 block">
            พิมพ์ชื่อทริป <span className="font-bold text-amber-950 select-all">&ldquo;{targetTitle}&rdquo;</span> เพื่อยืนยัน:
          </label>
          <input
            id="confirm-archive-title"
            type="text"
            disabled={archiving}
            value={confirmInput}
            onChange={(e) => setConfirmInput(e.target.value)}
            placeholder={targetTitle}
            className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-base sm:text-sm text-stone-900 focus:border-amber-400 focus:bg-white focus:outline-hidden"
          />
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
            ⚠️ {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 pt-2 border-t border-stone-100">
          <button
            type="button"
            disabled={archiving}
            onClick={handleClose}
            className="btn-ghost flex-1 !py-2.5 text-xs font-semibold cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={!isMatch || archiving}
            onClick={handleArchive}
            className={`flex-1 !py-2.5 text-xs font-bold rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 ${
              isMatch && !archiving
                ? "bg-amber-500 hover:bg-amber-600 text-white cursor-pointer active:scale-98"
                : "bg-stone-100 text-stone-400 border border-stone-200 cursor-not-allowed"
            }`}
          >
            {archiving ? "กำลังจัดเก็บ…" : "📦 ยืนยันจัดเก็บทริป"}
          </button>
        </div>
      </div>
    </div>
  );
}
