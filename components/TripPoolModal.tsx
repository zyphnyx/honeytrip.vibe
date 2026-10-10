"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { Tooltip } from "./Tooltip";

/* Hallmark · component: trip-pool-modal · genre: editorial · theme: amber-honey
 * states: default · hover · focus · active · disabled
 * contrast: WCAG AA pass
 */

interface TripPoolModalProps {
  isOpen: boolean;
  onClose: () => void;
  qrUrl?: string;
  accountName?: string;
  bankName?: string;
  note?: string;
}

export function TripPoolModal({
  isOpen,
  onClose,
  qrUrl = "/qr/mktamzgvgb.jpg",
  accountName = "น.ส. กานต์พิชชา สุริยนต์",
  bankName = "MAKE by KBank (PromptPay)",
  note = "ไปเที่ยวกันครับ",
}: TripPoolModalProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCopyAccount = async () => {
    try {
      await navigator.clipboard.writeText(accountName);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-xs animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="QR Code บัญชีกองกลางทริป"
    >
      <div
        className="w-full max-w-sm rounded-3xl border border-amber-200/80 bg-white p-5 shadow-2xl transition-all max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100 text-base">
              💸
            </span>
            <div>
              <h2 className="text-sm font-bold text-stone-900">
                บัญชีกองกลาง / ค่าทริป
              </h2>
              <p className="text-[11px] text-stone-500 font-medium">
                {bankName}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors cursor-pointer"
            aria-label="ปิดหน้าต่าง"
          >
            ✕
          </button>
        </div>

        {/* QR Image Display */}
        <div className="mt-3 flex flex-col items-center">
          <div className="relative flex items-center justify-center overflow-hidden rounded-2xl border-2 border-amber-200/90 bg-stone-50 p-2 shadow-xs w-full max-w-[220px] h-[240px]">
            <Image
              src={qrUrl}
              alt="QR Code โอนเงินกองกลางทริป MAKE by KBank"
              width={400}
              height={700}
              className="h-full w-auto object-contain rounded-xl"
              priority
            />
          </div>

          {/* Account Detail Box */}
          <div className="mt-3 w-full rounded-2xl border border-amber-200/60 bg-amber-50/50 px-3 py-2 text-center">
            <p className="text-[11px] font-semibold text-stone-500">
              ชื่อบัญชีผู้รับเงิน
            </p>
            <p className="text-sm font-bold text-stone-900 mt-0.5">
              {accountName}
            </p>
            {note && (
              <p className="text-xs text-amber-900 mt-0.5 font-medium">
                💬 ข้อความ: &ldquo;{note}&rdquo;
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 pt-3 border-t border-stone-100">
          <Tooltip content="คัดลอกชื่อบัญชีสำหรับตรวจสอบในแอปธนาคาร" className="w-full">
            <button
              type="button"
              onClick={handleCopyAccount}
              className="w-full flex items-center justify-center gap-1.5 rounded-2xl border border-stone-200 bg-stone-50 py-3 px-3 text-xs font-bold text-stone-700 hover:bg-stone-100 active:scale-95 transition-all cursor-pointer"
            >
              <span className="text-sm">📋</span>
              <span>{copied ? "คัดลอกแล้ว" : "คัดลอกชื่อ"}</span>
            </button>
          </Tooltip>

          <Tooltip content="เปิดหรือดาวน์โหลดรูปภาพ QR Code เต็มจอ" className="w-full">
            <a
              href={qrUrl}
              download="honeytrip-qr-pool.jpg"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center justify-center gap-1.5 rounded-2xl bg-amber-500 py-3 px-3 text-xs font-bold text-white shadow-xs hover:bg-amber-600 active:scale-95 transition-all cursor-pointer"
            >
              <span className="text-sm">📥</span>
              <span>บันทึกรูป QR</span>
            </a>
          </Tooltip>
        </div>

        <p className="mt-3 text-center text-[10px] text-stone-400">
          💡 สแกนผ่านแอปธนาคารใดก็ได้ (รองรับ PromptPay ทุกธนาคาร)
        </p>
      </div>
    </div>
  );
}
