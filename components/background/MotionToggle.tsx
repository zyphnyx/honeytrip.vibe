"use client";

import { Tooltip } from "@/components/Tooltip";

export interface MotionToggleProps {
  motionEnabled: boolean;
  onToggle: () => void;
}

/**
 * Accessible toggle control for enabling/pausing background motion.
 * - Respects manual localStorage preference and prefers-reduced-motion.
 * - Uses instant CSS-based text synchronization to eliminate hydration mismatch and flashing.
 * - Provides full keyboard access and accessible ARIA attributes.
 */
export function MotionToggle({ motionEnabled, onToggle }: MotionToggleProps) {
  return (
    <div className="fixed bottom-4 right-4 z-40 max-sm:bottom-3 max-sm:right-3 pointer-events-auto">
      <Tooltip
        content={
          motionEnabled
            ? "พักการเคลื่อนไหวพื้นหลัง (หยุดแอนิเมชัน)"
            : "เปิดการเคลื่อนไหวพื้นหลัง (เล่นแอนิเมชัน)"
        }
        position="top"
      >
      <button
        id="h-motion"
        type="button"
        onClick={onToggle}
        className="h-motion-toggle"
        aria-pressed={motionEnabled}
        aria-label={motionEnabled ? "หยุดภาพเคลื่อนไหวพื้นหลัง" : "เปิดภาพเคลื่อนไหวพื้นหลัง"}
      >
        <span className="h-motion-icon" aria-hidden="true">
          🐝
        </span>
        <span className="h-motion-indicator h-motion-on" aria-hidden="true">
          ◉
        </span>
        <span className="h-motion-indicator h-motion-off" aria-hidden="true">
          ○
        </span>
        <span className="h-motion-label h-motion-on">แอนิเมชัน เปิด</span>
        <span className="h-motion-label h-motion-off">แอนิเมชัน ปิด</span>
      </button>
    </Tooltip>
  </div>
  );
}
