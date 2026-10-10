"use client";

import Image from "next/image";
import { useState } from "react";
import { Tooltip } from "./Tooltip";
import { TripPoolModal } from "./TripPoolModal";

/* Hallmark · component: trip-pool-card · genre: editorial · theme: amber-honey
 * states: default · hover · focus · active · disabled
 * contrast: WCAG AA pass
 */

interface TripPoolCardProps {
  qrUrl?: string;
  accountName?: string;
  bankName?: string;
  note?: string;
  className?: string;
}

export function TripPoolCard({
  qrUrl = "/qr/mktamzgvgb.jpg",
  accountName = "น.ส. กานต์พิชชา สุริยนต์",
  bankName = "MAKE by KBank",
  note = "ไปเที่ยวกันครับ",
  className = "",
}: TripPoolCardProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div
        onClick={() => setIsOpen(true)}
        className={`group relative flex items-center justify-between gap-3 rounded-2xl border border-amber-200/80 bg-linear-to-r from-amber-50/70 via-white to-amber-50/40 p-3.5 shadow-xs transition-all hover:border-amber-300 hover:shadow-sm cursor-pointer active:scale-99 ${className}`}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsOpen(true);
          }
        }}
        aria-label="เปิด QR Code บัญชีกองกลางทริป"
      >
        <div className="flex items-center gap-3 min-w-0">
          {/* Mini QR Thumbnail Preview */}
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-amber-200 bg-white p-0.5 shadow-2xs group-hover:border-amber-400 transition-colors">
            <Image
              src={qrUrl}
              alt="QR Code กองกลาง"
              width={80}
              height={140}
              className="h-full w-full object-cover rounded-lg"
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="rounded-md bg-teal-50 px-1.5 py-0.2 text-[10px] font-bold text-teal-800 border border-teal-200/60">
                {bankName}
              </span>
              <span className="text-[10px] text-stone-400 font-medium">PromptPay</span>
            </div>
            <h4 className="mt-1 truncate text-xs font-bold text-stone-900 group-hover:text-amber-900 transition-colors">
              💳 บัญชีกองกลาง / ค่าทริป
            </h4>
            <p className="truncate text-[11px] text-stone-600 mt-0.5">
              {accountName}
            </p>
          </div>
        </div>

        {/* Action Button Indicator */}
        <div className="shrink-0">
          <Tooltip content="กดเพื่อเปิด QR Code สแกนโอนเงิน">
            <span className="flex items-center gap-1 rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-white shadow-2xs group-hover:bg-amber-600 transition-colors">
              <span>สแกน QR</span>
              <span className="text-[10px]">↗</span>
            </span>
          </Tooltip>
        </div>
      </div>

      <TripPoolModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        qrUrl={qrUrl}
        accountName={accountName}
        bankName={`${bankName} (PromptPay)`}
        note={note}
      />
    </>
  );
}
