"use client";

import React, { useState, useRef, useEffect, useId } from "react";

interface TooltipProps {
  content: React.ReactNode;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  children: React.ReactElement<any>;
  position?: "top" | "bottom" | "left" | "right";
  delayMs?: number;
  className?: string;
}

/**
 * Hallmark-compliant Tooltip / Hover Hint:
 * - Accessible: role="tooltip", aria-describedby linkage
 * - Microinteraction: 150ms ease-out opacity, 150ms delay on hover, 0ms on keyboard focus
 * - Mobile friendly: tap toggles visibility, click outside dismisses
 * - Dismissible via Escape key
 */
export function Tooltip({
  content,
  children,
  position = "top",
  delayMs = 150,
  className = "",
}: TooltipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const tooltipId = useId();

  const show = (immediate = false) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (immediate) {
      setIsOpen(true);
    } else {
      timeoutRef.current = setTimeout(() => setIsOpen(true), delayMs);
    }
  };

  const hide = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setIsOpen(false);
  };

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        hide();
      }
    }
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        hide();
      }
    }

    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      window.addEventListener("click", handleClickOutside);
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("click", handleClickOutside);
    };
  }, [isOpen]);

  const posClasses = {
    top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
    bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
    left: "right-full top-1/2 -translate-y-1/2 mr-2",
    right: "left-full top-1/2 -translate-y-1/2 ml-2",
  };

  return (
    <div
      ref={wrapperRef}
      className={`relative inline-flex items-center justify-center ${className}`}
      onMouseEnter={() => show(false)}
      onMouseLeave={hide}
      onClick={(e) => {
        // Allow mobile tap-to-inspect
        if (typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0)) {
          if (!isOpen) {
            e.stopPropagation();
            show(true);
          }
        }
      }}
    >
      {React.cloneElement(children, {
        "aria-describedby": isOpen ? tooltipId : undefined,
        onFocus: (e: React.FocusEvent) => {
          show(true); // Instant 0ms on keyboard focus
          children.props?.onFocus?.(e);
        },
        onBlur: (e: React.FocusEvent) => {
          hide();
          children.props?.onBlur?.(e);
        },
      })}

      {isOpen && (
        <div
          id={tooltipId}
          role="tooltip"
          className={`pointer-events-none absolute z-50 whitespace-normal rounded-xl border border-amber-200/80 bg-stone-900 px-2.5 py-1.5 text-xs font-normal text-amber-50 shadow-lg backdrop-blur-sm transition-opacity duration-150 max-w-[260px] text-center ${posClasses[position]}`}
          style={{
            animation: "fadeIn 150ms cubic-bezier(0.16, 1, 0.3, 1) forwards",
          }}
        >
          {content}
          {/* Subtle pointer tip */}
          <div
            className={`absolute h-1.5 w-1.5 rotate-45 border-stone-900 bg-stone-900 ${
              position === "top"
                ? "-bottom-0.5 left-1/2 -translate-x-1/2"
                : position === "bottom"
                ? "-top-0.5 left-1/2 -translate-x-1/2"
                : position === "left"
                ? "-right-0.5 top-1/2 -translate-y-1/2"
                : "-left-0.5 top-1/2 -translate-y-1/2"
            }`}
          />
        </div>
      )}
    </div>
  );
}
