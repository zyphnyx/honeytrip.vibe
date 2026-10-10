"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import { MotionToggle } from "./MotionToggle";
import "./animated-background.css";

const MOTION_STORAGE_KEY = "honeytrip_motion_enabled";

function getMotionSnapshot(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const saved = localStorage.getItem(MOTION_STORAGE_KEY);
    if (saved !== null) {
      return saved === "true";
    }
    return !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return true;
  }
}

function getMotionServerSnapshot(): boolean {
  return true;
}

function subscribeToMotion(callback: () => void): () => void {
  const handleStorage = (e: StorageEvent) => {
    if (e.key === MOTION_STORAGE_KEY) {
      callback();
    }
  };

  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  const handleMedia = () => {
    try {
      if (localStorage.getItem(MOTION_STORAGE_KEY) === null) {
        callback();
      }
    } catch {}
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener("honeytrip-motion-change", callback);
  mql.addEventListener?.("change", handleMedia);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener("honeytrip-motion-change", callback);
    mql.removeEventListener?.("change", handleMedia);
  };
}

/**
 * Tiny Travel World + Honey Bee Animated Background
 * Reusable animated background component faithfully ported from prototype demo.
 *
 * Features:
 * - Cute animated bees with flapping wings
 * - Slowly drifting fluffy clouds
 * - Swooping paper airplane
 * - Soft breathing sun with ambient glows
 * - Rolling hills and distant mountains
 * - Gently swaying flower gardens
 * - Subtle mouse-driven parallax (on desktop >= 1024px)
 * - Accessible motion toggle persisted to localStorage
 * - Lightweight static pastel background on mobile (< 1024px) with 0 animation overhead
 * - Native SVG and CSS animations (no external libraries or API costs)
 */
export function AnimatedBackground({ children }: { children?: React.ReactNode }) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const motionEnabled = useSyncExternalStore(
    subscribeToMotion,
    getMotionSnapshot,
    getMotionServerSnapshot,
  );

  // Sync DOM classes with current motion state
  useEffect(() => {
    if (!motionEnabled) {
      document.documentElement.classList.add("h-paused");
      document.body.classList.add("h-paused");
      if (sceneRef.current) {
        sceneRef.current.style.setProperty("--mx", "0px");
        sceneRef.current.style.setProperty("--my", "0px");
      }
    } else {
      document.documentElement.classList.remove("h-paused");
      document.body.classList.remove("h-paused");
    }
  }, [motionEnabled]);

  // Parallax pointer tracking for desktop (>= 1024px)
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    let rafId: number | null = null;
    let isScheduled = false;

    const handlePointerMove = (e: PointerEvent) => {
      if (
        isScheduled ||
        window.innerWidth < 1024 ||
        document.documentElement.classList.contains("h-paused") ||
        window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        return;
      }

      const clientX = e.clientX;
      const clientY = e.clientY;

      isScheduled = true;
      rafId = requestAnimationFrame(() => {
        const dx = (clientX / window.innerWidth - 0.5) * 18;
        const dy = (clientY / window.innerHeight - 0.5) * 12;
        scene.style.setProperty("--mx", `${dx.toFixed(2)}px`);
        scene.style.setProperty("--my", `${dy.toFixed(2)}px`);
        isScheduled = false;
      });
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (scene) {
        scene.style.setProperty("--mx", "0px");
        scene.style.setProperty("--my", "0px");
      }
    };
  }, []);

  const handleToggle = () => {
    const next = !motionEnabled;
    try {
      localStorage.setItem(MOTION_STORAGE_KEY, String(next));
    } catch {}
    window.dispatchEvent(new Event("honeytrip-motion-change"));
  };

  return (
    <>
      {/* Hidden reusable SVG symbols */}
      <svg
        aria-hidden="true"
        width="0"
        height="0"
        style={{ position: "absolute", overflow: "hidden" }}
      >
        <defs>
          <symbol id="h-svg-cloud" viewBox="0 0 240 105">
            <path
              d="M35 81C17 80 7 68 11 52c4-16 17-25 33-23 7-24 28-35 49-29 15 4 24 14 30 30 21-16 50-8 57 14 26-3 45 13 46 31 0 19-20 30-39 29H40Z"
              fill="#fff"
            />
            <path
              d="M36 81h155"
              stroke="#d4e8ec"
              strokeWidth="5"
              strokeLinecap="round"
              opacity="0.5"
            />
          </symbol>

          <symbol id="h-svg-bee" viewBox="0 0 115 99">
            <g className="wing left">
              <ellipse
                cx="39"
                cy="28"
                rx="19"
                ry="24"
                fill="#c5eaff"
                stroke="#80cddd"
                strokeWidth="3"
                transform="rotate(-24 39 28)"
              />
            </g>
            <g className="wing right">
              <ellipse
                cx="77"
                cy="25"
                rx="20"
                ry="25"
                fill="#dcf5fc"
                stroke="#80cddd"
                strokeWidth="3"
                transform="rotate(25 77 25)"
              />
            </g>
            <ellipse
              cx="58"
              cy="59"
              rx="43"
              ry="34"
              fill="#ffcd59"
              stroke="#a7682b"
              strokeWidth="3"
            />
            <path
              d="M37 32c-8 15-9 35-2 50M57 25c-5 20-5 46 1 67"
              stroke="#7a4c2b"
              strokeWidth="13"
              fill="none"
            />
            <ellipse
              cx="58"
              cy="59"
              rx="43"
              ry="34"
              fill="none"
              stroke="#ad762f"
              strokeWidth="3"
            />
            <path
              d="M35 30c-8-15-13-18-20-18M68 26c0-14 7-20 14-20"
              stroke="#654526"
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
            />
            <circle cx="15" cy="12" r="5" fill="#654526" />
            <circle cx="82" cy="6" r="5" fill="#654526" />
            <circle cx="78" cy="57" r="4" fill="#403028" />
            <circle cx="97" cy="57" r="4" fill="#403028" />
            <path
              d="M82 67q5 7 11 0"
              stroke="#6d3e2c"
              strokeWidth="3"
              strokeLinecap="round"
              fill="none"
            />
            <ellipse cx="72" cy="65" rx="6" ry="4" fill="#f7a2a7" />
            <ellipse cx="101" cy="65" rx="6" ry="4" fill="#f7a2a7" />
          </symbol>

          <symbol id="h-svg-plane" viewBox="0 0 120 85">
            <path
              d="M2 38 119 3 71 81 50 55Z"
              fill="#fffef9"
              stroke="#d99b52"
              strokeWidth="3"
              strokeLinejoin="round"
            />
            <path
              d="M119 3 50 55 71 81 76 41Z"
              fill="#ffda9d"
              stroke="#d99b52"
              strokeWidth="2"
            />
            <path d="M2 38 76 41 119 3Z" fill="#fff" />
          </symbol>

          <symbol id="h-svg-flower" viewBox="0 0 210 210">
            <g stroke="#5e9b73" strokeWidth="5" fill="none">
              <path d="M40 195q-16-55-2-124M85 199q-6-60 8-125M142 201q14-40 13-92" />
            </g>
            <g fill="#8dc9a2">
              <ellipse cx="27" cy="130" rx="13" ry="27" transform="rotate(-55 27 130)" />
              <ellipse cx="52" cy="149" rx="12" ry="24" transform="rotate(45 52 149)" />
              <ellipse cx="73" cy="135" rx="10" ry="25" transform="rotate(-45 73 135)" />
              <ellipse cx="108" cy="153" rx="12" ry="27" transform="rotate(42 108 153)" />
              <ellipse cx="129" cy="171" rx="13" ry="29" transform="rotate(-50 129 171)" />
            </g>
            <g transform="translate(39 71)">
              <g fill="#fffdfa">
                <ellipse cx="0" cy="-17" rx="11" ry="19" />
                <ellipse cx="0" cy="17" rx="11" ry="19" />
                <ellipse cx="-17" cy="0" rx="19" ry="11" />
                <ellipse cx="17" cy="0" rx="19" ry="11" />
                <ellipse cx="12" cy="12" rx="11" ry="17" transform="rotate(-45 12 12)" />
                <ellipse cx="-12" cy="-12" rx="11" ry="17" transform="rotate(-45 -12 -12)" />
                <ellipse cx="-12" cy="12" rx="11" ry="17" transform="rotate(45 -12 12)" />
                <ellipse cx="12" cy="-12" rx="11" ry="17" transform="rotate(45 12 -12)" />
              </g>
              <circle r="13" fill="#f7bd44" />
            </g>
            <g transform="translate(94 72) scale(.78)">
              <g fill="#fffdfa">
                <ellipse cy="-17" rx="12" ry="19" />
                <ellipse cy="17" rx="12" ry="19" />
                <ellipse cx="-17" rx="19" ry="12" />
                <ellipse cx="17" rx="19" ry="12" />
              </g>
              <circle r="13" fill="#ffb44f" />
            </g>
            <g transform="translate(154 108) scale(.85)">
              <g fill="#fff0c9">
                <ellipse cy="-17" rx="12" ry="19" />
                <ellipse cy="17" rx="12" ry="19" />
                <ellipse cx="-17" rx="19" ry="12" />
                <ellipse cx="17" rx="19" ry="12" />
              </g>
              <circle r="13" fill="#ffa94a" />
            </g>
          </symbol>

          <symbol id="h-svg-mountain" viewBox="0 0 240 145">
            <path d="M0 145 66 56l40 48 40-84 94 125Z" fill="#acd1cd" />
            <path d="M111 86 146 20l40 59-25-10-14-28-20 41Z" fill="#f5fcfa" />
            <path d="M42 90 66 56l24 30-23-13Z" fill="#eef6f2" />
          </symbol>
        </defs>
      </svg>

      {/* Decorative animated scene (always behind UI, pointer-events: none) */}
      <div
        id="h-scene"
        ref={sceneRef}
        className={`h-scene ${!motionEnabled ? "h-paused" : ""}`}
        aria-hidden="true"
      >
        <div className="h-glow one" />
        <div className="h-glow two" />
        <div className="h-sun h-onlymotion" />

        <div className="h-cloud c1">
          <svg viewBox="0 0 240 105">
            <use href="#h-svg-cloud" />
          </svg>
        </div>
        <div className="h-cloud c2">
          <svg viewBox="0 0 240 105">
            <use href="#h-svg-cloud" />
          </svg>
        </div>
        <div className="h-cloud c3">
          <svg viewBox="0 0 240 105">
            <use href="#h-svg-cloud" />
          </svg>
        </div>
        <div className="h-cloud c4">
          <svg viewBox="0 0 240 105">
            <use href="#h-svg-cloud" />
          </svg>
        </div>

        <svg className="h-route" viewBox="0 0 1440 900" preserveAspectRatio="none">
          <path d="M-40 400 Q260 150 500 360 T1050 250 T1500 310" />
        </svg>

        <div className="h-plane">
          <svg viewBox="0 0 120 85">
            <use href="#h-svg-plane" />
          </svg>
        </div>

        <div className="h-bee b1">
          <svg viewBox="0 0 115 99">
            <use href="#h-svg-bee" />
          </svg>
        </div>
        <div className="h-bee b2">
          <svg viewBox="0 0 115 99">
            <use href="#h-svg-bee" />
          </svg>
        </div>
        <div className="h-bee b3">
          <svg viewBox="0 0 115 99">
            <use href="#h-svg-bee" />
          </svg>
        </div>

        <div className="h-spark s1">✦</div>
        <div className="h-spark s2">✧</div>
        <div className="h-spark s3">✦</div>

        <div className="h-hill back h-onlymotion" />
        <div className="h-hill left h-onlymotion" />
        <div className="h-hill right h-onlymotion" />

        <div className="h-mountain l h-onlymotion">
          <svg viewBox="0 0 240 145">
            <use href="#h-svg-mountain" />
          </svg>
        </div>
        <div className="h-mountain r h-onlymotion">
          <svg viewBox="0 0 240 145">
            <use href="#h-svg-mountain" />
          </svg>
        </div>

        <div className="h-garden left">
          <svg viewBox="0 0 210 210">
            <use href="#h-svg-flower" />
          </svg>
        </div>
        <div className="h-garden right">
          <svg viewBox="0 0 210 210">
            <use href="#h-svg-flower" />
          </svg>
        </div>
      </div>

      {/* Page content & controls in foreground stacking context (above .h-scene, with modals at z-50 above MotionToggle at z-40) */}
      <div className="relative z-1 flex-1 flex flex-col">
        {children}
        <MotionToggle
          motionEnabled={motionEnabled}
          onToggle={handleToggle}
        />
      </div>
    </>
  );
}
