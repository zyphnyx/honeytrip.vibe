"use client";

import { useCallback, useEffect, useState } from "react";
import { downloadBackupJson, exportTripBackup } from "@/lib/backup";
import type { Room } from "@/lib/types";

interface Props {
  isOpen: boolean;
  roomId: string;
  room: Room;
  uid: string | null;
  onClose: () => void;
  onOpenArchiveModal: () => void;
  onRestoreTrip: () => Promise<void>;
}

export function TripProtectionModal({
  isOpen,
  roomId,
  room,
  uid,
  onClose,
  onOpenArchiveModal,
  onRestoreTrip,
}: Props) {
  const [downloading, setDownloading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const isOwner = Boolean(room.ownerUid && uid && room.ownerUid === uid);
  const isLegacy = !room.ownerUid;
  const isArchived = Boolean(room.archived);

  const handleClose = useCallback(() => {
    if (!downloading && !restoring) {
      setStatusMsg(null);
      onClose();
    }
  }, [downloading, restoring, onClose]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !downloading && !restoring) handleClose();
    }
    if (isOpen) {
      window.addEventListener("keydown", onKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [isOpen, downloading, restoring, handleClose]);

  if (!isOpen) return null;

  async function handleDownloadBackup() {
    setDownloading(true);
    setStatusMsg(null);
    try {
      const backup = await exportTripBackup(roomId);
      downloadBackupJson(backup);
      setStatusMsg({
        type: "success",
        text: `ดาวน์โหลดข้อมูลสำรองเรียบร้อยแล้ว (${backup.counts.activities} กิจกรรม, ${backup.counts.places} สถานที่, ${backup.counts.members} สมาชิก)`,
      });
    } catch (err) {
      setStatusMsg({
        type: "error",
        text: err instanceof Error ? err.message : "ไม่สามารถดาวน์โหลดข้อมูลสำรองได้",
      });
    } finally {
      setDownloading(false);
    }
  }

  async function handleRestore() {
    if (!isOwner || restoring) return;
    setRestoring(true);
    setStatusMsg(null);
    try {
      await onRestoreTrip();
      setStatusMsg({
        type: "success",
        text: "กู้คืนทริปกลับสู่สถานะพร้อมใช้งานเรียบร้อยแล้ว!",
      });
    } catch (err) {
      setStatusMsg({
        type: "error",
        text: err instanceof Error ? err.message : "กู้คืนทริปไม่สำเร็จ",
      });
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="protection-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/50 backdrop-blur-xs animate-in fade-in"
      onClick={handleClose}
    >
      <div
        className="relative w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-3xl border border-stone-200/80 bg-white p-5 sm:p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-100 border border-amber-300 text-xl shadow-xs">
              🛡️
            </span>
            <div>
              <h2 id="protection-modal-title" className="text-base font-bold text-stone-900">
                การป้องกันข้อมูลทริป
              </h2>
              <p className="text-[11px] text-stone-500 truncate mt-0.5">
                {room.emoji} {room.title} (#{roomId})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={downloading || restoring}
            className="rounded-xl p-1.5 text-stone-400 hover:bg-stone-100 transition-colors cursor-pointer"
            aria-label="ปิด"
          >
            ✕
          </button>
        </div>

        {statusMsg && (
          <div
            className={`rounded-2xl p-3 text-xs leading-relaxed border ${
              statusMsg.type === "success"
                ? "bg-emerald-50 text-emerald-900 border-emerald-200"
                : "bg-red-50 text-red-900 border-red-200"
            }`}
          >
            {statusMsg.type === "success" ? "✓ " : "⚠️ "}
            {statusMsg.text}
          </div>
        )}

        <div className="space-y-3.5 text-xs">
          {/* Invariant 1: Permanent Delete Protected */}
          <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/50 p-3.5 space-y-1">
            <div className="font-bold flex items-center gap-1.5 text-emerald-900">
              <span>✅</span>
              <span>ป้องกันการลบถาวร (Permanent Deletion Protected)</span>
            </div>
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              ห้องทริปนี้ได้รับการปกป้องโดย Firestore Security Rules ข้อมูลทริปไม่สามารถถูกลบถาวรผ่านหน้าเว็บได้ เพื่อป้องกันข้อผิดพลาดหรือการลบโดยไม่ตั้งใจ 100%
            </p>
          </div>

          {/* Section 2: Ownership Status */}
          <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-3.5 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-stone-800 flex items-center gap-1.5">
                <span>👤</span>
                <span>สถานะผู้ดูแลทริป (Trip Ownership)</span>
              </span>
              {isOwner ? (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-900 border border-amber-300">
                  👑 คุณคือผู้ดูแล
                </span>
              ) : isLegacy ? (
                <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-semibold text-stone-700">
                  ทริปแบบเดิม
                </span>
              ) : (
                <span className="rounded-full bg-stone-200 px-2 py-0.5 text-[10px] font-semibold text-stone-700">
                  สมาชิกทั่วไป
                </span>
              )}
            </div>

            {isOwner ? (
              <p className="text-[11px] text-stone-600 leading-relaxed">
                คุณมีสิทธิ์ในการจัดเก็บทริป (Archive) เข้าสู่คลัง และกู้คืนทริปกลับมาใช้งานใหม่ได้ทุกเมื่อ
              </p>
            ) : isLegacy ? (
              <div className="text-[11px] text-stone-600 leading-relaxed space-y-1">
                <p>
                  ทริปนี้สร้างขึ้นก่อนระบบผู้ดูแล (Legacy Room) เพื่อความปลอดภัยสูงสุด ระบบจะไม่อนุญาตให้อ้างสิทธิ์เองผ่านหน้าเว็บ
                </p>
                <p className="text-[10px] text-stone-500">
                  💡 หากต้องการแต่งตั้งผู้ดูแล โปรดให้ผู้ดูแลระบบโปรเจกต์ระบุ <code>ownerUid</code> ผ่าน Firebase Console
                </p>
              </div>
            ) : (
              <p className="text-[11px] text-stone-600 leading-relaxed">
                ผู้ดูแลทริปนี้คือ UID: <code className="bg-white px-1 py-0.5 rounded border border-stone-200 text-[10px]">#{room.ownerUid?.slice(0, 8)}...</code> (เฉพาะผู้ดูแลเท่านั้นที่สามารถสั่งจัดเก็บหรือกู้คืนทริปได้)
              </p>
            )}
          </div>

          {/* Section 3: JSON Backup Export */}
          <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-stone-800 flex items-center gap-1.5">
                <span>💾</span>
                <span>ดาวน์โหลดข้อมูลสำรอง (JSON Backup)</span>
              </span>
              <span className="text-[10px] text-emerald-700 font-bold bg-emerald-100/70 px-2 py-0.5 rounded-full">
                ฟรี 100%
              </span>
            </div>
            <p className="text-[11px] text-stone-600 leading-relaxed">
              สำรองข้อมูลทริปทั้งหมด (สมาชิก, สถานที่, ผลโหวต, แผนเที่ยว, กิจกรรม, ค่าใช้จ่าย และความคิดเห็น) เป็นไฟล์ JSON ดาวน์โหลดเก็บไว้ในเครื่องของคุณได้โดยตรง
            </p>
            <button
              type="button"
              disabled={downloading}
              onClick={handleDownloadBackup}
              className="btn-primary w-full !py-2.5 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-xs active:scale-98"
            >
              <span>{downloading ? "⏳ กำลังดึงข้อมูลจากระบบ…" : "💾 ดาวน์โหลดข้อมูลสำรอง (.json)"}</span>
            </button>
            <p className="text-[10px] text-stone-400">
              * ข้อมูลจะถูกดึงสดจาก Firestore และดาวน์โหลดตรงลงเครื่อง ไม่ผ่าน Server เสียเงินใดๆ
            </p>
          </div>

          {/* Section 4: Archive / Restore Management */}
          <div className="rounded-2xl border border-stone-200 bg-stone-50/70 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-stone-800 flex items-center gap-1.5">
                <span>📦</span>
                <span>การจัดเก็บทริป (Trip Archive)</span>
              </span>
              {isArchived ? (
                <span className="rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-900">
                  📦 จัดเก็บอยู่
                </span>
              ) : (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                  กำลังใช้งาน
                </span>
              )}
            </div>

            <p className="text-[11px] text-stone-600 leading-relaxed">
              {isArchived
                ? "ทริปนี้ถูกจัดเก็บเข้าคลังแล้ว ข้อมูลทั้งหมดอยู่ในสถานะอ่านอย่างเดียว (Read-only) โดยไม่มีการลบข้อมูลใดๆ"
                : "เมื่อทริปสิ้นสุดลง สามารถย้ายทริปเข้าสู่คลังจัดเก็บได้ ข้อมูลทั้งหมดจะถูกล็อกเป็นอ่านอย่างเดียว แต่ยังคงดูย้อนหลังได้เสมอ"}
            </p>

            {isArchived ? (
              isOwner ? (
                <button
                  type="button"
                  disabled={restoring}
                  onClick={handleRestore}
                  className="btn-primary w-full !py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <span>{restoring ? "กำลังกู้คืน…" : "↩️ กู้คืนทริปกลับมาใช้งานใหม่"}</span>
                </button>
              ) : (
                <div className="text-[11px] text-stone-500 bg-white p-2 rounded-xl border border-stone-200 text-center">
                  🔒 ทริปนี้ถูกจัดเก็บแล้ว (เฉพาะผู้ดูแลทริปเท่านั้นที่สามารถกู้คืนได้)
                </div>
              )
            ) : isOwner ? (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenArchiveModal();
                }}
                className="w-full rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-950 font-bold py-2.5 text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>📦 จัดเก็บทริปนี้เข้าคลัง…</span>
              </button>
            ) : isLegacy ? (
              <div className="text-[11px] text-stone-500 bg-white p-2 rounded-xl border border-stone-200 text-center">
                🔒 ทริปแบบเดิมยังไม่มีผู้ดูแล จึงไม่สามารถจัดเก็บได้จนกว่าจะกำหนด Owner UID
              </div>
            ) : (
              <div className="text-[11px] text-stone-500 bg-white p-2 rounded-xl border border-stone-200 text-center">
                🔒 เฉพาะผู้ดูแลทริปเท่านั้นที่สามารถจัดเก็บทริปได้
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-stone-100 flex justify-end">
          <button
            type="button"
            onClick={handleClose}
            className="btn-ghost !py-2 !px-4 text-xs font-semibold cursor-pointer"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}
