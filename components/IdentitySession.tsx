"use client";

import { Fragment, useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { ensureUser, getClientAuth, isFirebaseConfigured } from "@/lib/firebase";
import { loadSharedProfile, saveSharedProfile } from "@/lib/sharedProfile";
import { useProfile } from "@/store/profile";

/** UID key resets auth-dependent subscriptions and unsaved forms across every route. */
export function IdentitySession({ children }: { children: React.ReactNode }) {
  const [uid, setUid] = useState<string | null>(null);
  const [ready, setReady] = useState(!isFirebaseConfigured);
  const [linked, setLinked] = useState(false);
  useEffect(() => {
    const success = () => setLinked(true);
    window.addEventListener("honeytrip-device-linked", success);
    return () => window.removeEventListener("honeytrip-device-linked", success);
  }, []);
  useEffect(() => {
    if (!isFirebaseConfigured) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopProfile: (() => void) | undefined;
    const stopAuth = onAuthStateChanged(getClientAuth(), async user => {
      stopProfile?.();
      clearTimeout(timer);
      if (!user) { setUid(null); return; }
      setReady(false);
      await useProfile.persist.rehydrate();
      try { await loadSharedProfile(user.uid); } catch { /* Existing guests still work when shared profile is unavailable. */ }
      if (stopped || getClientAuth().currentUser?.uid !== user.uid) return;
      setUid(user.uid);
      setReady(true);
      // Sync on actual edits, and seed legacy preferences after their first marked write.
      stopProfile = useProfile.subscribe((state, previous) => {
        if (state.name === previous.name && state.emoji === previous.emoji && state.recentRooms === previous.recentRooms) return;
        clearTimeout(timer);
        timer = setTimeout(() => { void saveSharedProfile(user.uid).catch(() => {}); }, 1000);
      });
    });
    void ensureUser().catch(() => { if (!stopped) setReady(true); });
    return () => { stopped = true; stopAuth(); stopProfile?.(); clearTimeout(timer); };
  }, []);
  // Render route segments for Next's instant-navigation validation while keeping inputs inert until ready.
  return <>
    {!ready && <main role="status" className="card mx-auto my-8 w-full max-w-xl text-center text-sm text-stone-600">🐝 กำลังเตรียมตัวตน HoneyTrip…</main>}
    {linked && <div role="status" className="mx-auto mt-3 flex w-full max-w-xl items-center justify-between rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900">✅ เชื่อมต่อสำเร็จ · ใช้ตัวตนเดิมแล้ว<button className="btn-ghost" onClick={() => setLinked(false)}>ปิด</button></div>}
    <div className={ready ? "contents" : "hidden"} inert={!ready} aria-hidden={!ready || undefined}>
      <Fragment key={uid ?? "guest-loading"}>{children}</Fragment>
    </div>
  </>;
}
