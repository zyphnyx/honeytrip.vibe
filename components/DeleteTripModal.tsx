"use client";

import { useEffect, useState } from "react";
import { deleteRoom } from "@/lib/rooms";
import { useProfile } from "@/store/profile";

interface Props {
  roomId: string | null;
  roomTitle?: string;
  roomEmoji?: string;
  onClose: () => void;
  onDeleted?: () => void;
}

export function DeleteTripModal({
  roomId,
  roomTitle,
  roomEmoji,
  onClose,
  onDeleted,
}: Props) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const forgetRoom = useProfile((s) => s.forgetRoom);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !deleting) onClose();
    }
    if (roomId) {
      window.addEventListener("keydown", onKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [roomId, deleting, onClose]);

  if (!roomId) return null;

  async function handleDelete() {
    if (!roomId) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteRoom(roomId);
      forgetRoom(roomId);
      onClose();
      onDeleted?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "ลบห้องทริปไม่สำเร็จ");
      setDeleting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-dialog-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/40 backdrop-blur-xs animate-fadeIn"
      onClick={() => {
        if (!deleting) onClose();
      }}
    >
      <div
        className="relative w-full max-w-sm rounded-3xl border border-stone-200 bg-white p-5 sm:p-6 shadow-2xl transition-transform"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 border border-red-200/80 text-2xl text-red-600">
            🗑️
          </span>
          <div className="min-w-0 flex-1">
            <h3 id="delete-dialog-title" className="text-base font-bold text-stone-900">
              ลบห้องทริปนี้?
            </h3>
            <p className="text-xs text-stone-500 truncate mt-0.5">
              {roomEmoji} {roomTitle || `#${roomId}`}
            </p>
          </div>
        </div>

        <div className="mt-3.5 rounded-2xl border border-red-100 bg-red-50/50 p-3 text-xs text-red-900 leading-relaxed">
          ⚠️ <b>คำเตือน:</b> การลบห้องทริปจะลบข้อมูลสมาชิก วันว่าง งบ และข้อคิดเห็นทั้งหมดในห้องนี้อย่างถาวร ไม่สามารถกู้คืนได้
        </div>

        {error && (
          <div className="mt-2 text-xs text-red-600 font-medium">
            เกิดข้อผิดพลาด: {error}
          </div>
        )}

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={deleting}
            onClick={onClose}
            className="btn-ghost flex-1 !py-2.5 text-xs font-semibold"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={handleDelete}
            className="btn-danger flex-1 !py-2.5 text-xs font-bold shadow-xs"
          >
            {deleting ? "กำลังลบ…" : "ยืนยันลบทริป"}
          </button>
        </div>
      </div>
    </div>
  );
}
