"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { Tooltip } from "@/components/Tooltip";

function DeviceLinkEntryInner({ returnTo }: { returnTo?: string }) {
  const pathname = usePathname();
  if (pathname?.startsWith("/device-link")) {
    return null;
  }

  const targetReturnTo = returnTo ?? (pathname && pathname.startsWith("/t/") ? pathname : "/");

  return (
    <Tooltip content="ย้ายหรือเชื่อมข้อมูลทริปข้ามอุปกรณ์" position="top">
      <Link
        href={`/device-link?returnTo=${encodeURIComponent(targetReturnTo)}`}
        className="h-motion-toggle no-underline"
        aria-label="เชื่อมต่ออุปกรณ์"
      >
        <span className="h-motion-icon" aria-hidden="true">
          🔗
        </span>
        <span>เชื่อมต่ออุปกรณ์</span>
      </Link>
    </Tooltip>
  );
}

export function DeviceLinkEntry({ returnTo }: { returnTo?: string }) {
  return (
    <Suspense fallback={null}>
      <DeviceLinkEntryInner returnTo={returnTo} />
    </Suspense>
  );
}
