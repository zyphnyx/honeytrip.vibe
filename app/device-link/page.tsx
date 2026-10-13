"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { browserLocalPersistence, setPersistence, signInWithCustomToken } from "firebase/auth";
import { ensureUser, ensureWritableUser, getClientAuth, isFirebaseConfigured } from "@/lib/firebase";
import { linkApi, PairingClientError, type Pairing } from "@/lib/deviceLinkClient";
import { loadSharedProfile, restoreRoomIdentity, saveSharedProfile } from "@/lib/sharedProfile";
import { useProfile } from "@/store/profile";

const STORAGE = "honeytrip-pairing"; // Tab-local destination secret, never a Firebase token.
type Preview = Omit<Pairing, "claimSecret" | "targetUid">;
type Stage = "idle" | "creating" | "waiting" | "approved" | "signing" | "success" | "denied" | "expired" | "error";

export default function DeviceLinkPage() {
  return <Suspense fallback={<main className="card mx-auto my-8">กำลังเตรียมการเชื่อมต่อ…</main>}><DeviceLinkView /></Suspense>;
}

function DeviceLinkView() {
  const router = useRouter();
  const params = useSearchParams();
  const requestedReturn = params.get("returnTo") ?? "/";
  const returnTo = /^\/t\/[a-z0-9]{1,64}(\/(plan|finance))?$/.test(requestedReturn) ? requestedReturn : "/";
  const profile = useProfile();
  const [stage, setStage] = useState<Stage>("idle");
  const [pair, setPair] = useState<Pairing | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [code, setCode] = useState("");
  const [qr, setQr] = useState("");
  const [remaining, setRemaining] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [targetConfirmed, setTargetConfirmed] = useState(false);
  const [approvedAccount, setApprovedAccount] = useState<Pairing["approvedAccount"]>();
  const [approvalResult, setApprovalResult] = useState("");
  const mounted = useRef(true);
  const claiming = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const roomId = /^\/t\/([a-z0-9]{1,64})/.exec(returnTo)?.[1];
    const user = isFirebaseConfigured ? getClientAuth().currentUser : null;
    if (user && roomId) void restoreRoomIdentity(user.uid, roomId).catch(() => {});
  }, [returnTo]);

  useEffect(() => {
    mounted.current = true;
    async function readApprovalHash() {
      if (!isFirebaseConfigured) return;
      await getClientAuth().authStateReady();
      if (!mounted.current) return;
      const match = /^#approve=([a-f0-9]{48})$/.exec(window.location.hash);
      if (match) {
        window.history.replaceState(null, "", window.location.pathname + window.location.search);
        try {
          const found = await linkApi<Preview>("lookup", { code: match[1] });
          if (mounted.current) { setCode(found.code); setPreview(found); }
        } catch (e) { if (mounted.current) setError(message(e)); }
      }
    }
    window.addEventListener("hashchange", readApprovalHash);
    void (async () => {
      if (!isFirebaseConfigured) return;
      await readApprovalHash();
      try {
        const raw = sessionStorage.getItem(STORAGE);
        if (!raw) return;
        const saved: Pairing = JSON.parse(raw);
        if (saved.targetUid === getClientAuth().currentUser?.uid && Number.isFinite(saved.receivedAt) && saved.receivedAt + saved.expiresAt - saved.serverNow > Date.now()) {
          if (mounted.current) { setPair(saved); setStage("waiting"); }
        } else sessionStorage.removeItem(STORAGE);
      } catch { /* Storage restrictions do not prevent a fresh pairing. */ }
    })();
    return () => { mounted.current = false; window.removeEventListener("hashchange", readApprovalHash); };
  }, []);

  useEffect(() => {
    if (pair && !["idle", "success"].includes(stage)) dialog.current?.showModal();
  }, [pair, stage]);

  useEffect(() => {
    if (!pair) return;
    let stopped = false;
    const url = `${window.location.origin}/device-link#approve=${pair.requestId}`;
    void import("qrcode").then(q => q.toDataURL(url, { width: 256, margin: 2, errorCorrectionLevel: "M" }))
      .then(value => { if (!stopped) setQr(value); }).catch(() => { if (!stopped) setError("แสดง QR ไม่สำเร็จ ใช้รหัสเชื่อมต่อด้านล่างได้เลย"); });
    const deadline = pair.receivedAt + Math.max(0, pair.expiresAt - pair.serverNow);
    function tick() {
      const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(seconds);
      if (!seconds && !claiming.current) { setStage("expired"); clearStored(); }
    }
    tick();
    const timer = setInterval(tick, 1000);
    return () => { stopped = true; clearInterval(timer); };
  }, [pair]);

  function clearStored() { try { sessionStorage.removeItem(STORAGE); } catch {} }
  function message(e: unknown) {
    return e instanceof PairingClientError ? e.message : "เครือข่ายขัดข้อง กรุณาลองใหม่ หากคำขอถูกใช้แล้วให้สร้างรหัสใหม่";
  }

  async function claim(p: Pairing) {
    if (claiming.current || !targetConfirmed || !approvedAccount) return;
    claiming.current = true;
    setStage("signing");
    try {
      const result = await linkApi<{ customToken: string; approvedUid: string }>("claim", { requestId: p.requestId, claimSecret: p.claimSecret, expectedIdentityTag: approvedAccount.identityTag }, p.targetUid);
      if (getClientAuth().currentUser?.uid !== p.targetUid) throw new PairingClientError("ตัวตนเปลี่ยนไป กรุณาเริ่มใหม่", 409);
      setStage("signing");
      await setPersistence(getClientAuth(), browserLocalPersistence);
      const credential = await signInWithCustomToken(getClientAuth(), result.customToken);
      if (credential.user.uid !== result.approvedUid) throw new PairingClientError("ยืนยันตัวตนหลังเชื่อมต่อไม่สำเร็จ", 409);
      clearStored();
      // Clear target preferences only AFTER successful authentication; no server member writes.
      useProfile.setState({ identityUid: result.approvedUid, name: "", emoji: "🐻", recentRooms: [] });
      try { await loadSharedProfile(result.approvedUid, true); } catch { /* Member subscriptions remain authoritative. */ }
      const roomId = /^\/t\/([a-z0-9]{1,64})/.exec(returnTo)?.[1];
      if (roomId) { try { await restoreRoomIdentity(result.approvedUid, roomId); } catch {} }
      window.dispatchEvent(new Event("honeytrip-device-linked"));
      if (mounted.current) setStage("success");
      router.replace(returnTo);
    } catch (e) {
      if (mounted.current) { setError(message(e)); setStage("error"); }
    } finally { claiming.current = false; }
  }

  useEffect(() => {
    if (stage !== "waiting" || !pair) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      if (stopped) return;
      if (document.visibilityState !== "hidden") {
        try {
          const status = await linkApi<Preview>("status", { requestId: pair!.requestId, claimSecret: pair!.claimSecret }, pair!.targetUid);
          if (stopped) return;
          setError("");
          if (status.status === "approved" && status.approvedAccount) {
            setApprovedAccount(status.approvedAccount); setTargetConfirmed(false); setStage("approved"); return;
          }
          if (["denied", "expired", "consumed"].includes(status.status)) {
            clearStored();
            setStage(status.status === "consumed" ? "error" : status.status as Stage);
            if (status.status === "consumed") setError("คำขอถูกใช้แล้ว หากยังไม่เชื่อมต่อ กรุณาสร้างรหัสใหม่");
            return;
          }
        } catch (e) {
          if (stopped) return;
          setError(message(e));
          if (e instanceof PairingClientError && [401, 403, 404, 429].includes(e.status)) { setStage("error"); return; }
        }
      }
      timer = setTimeout(poll, 7000);
    }
    timer = setTimeout(poll, 1000);
    return () => { stopped = true; clearTimeout(timer); };
  }, [stage, pair]);

  async function create() {
    setError(""); setStage("creating"); setPreview(null); setApprovedAccount(undefined); setTargetConfirmed(false);
    try {
      if (useProfile.getState().name.trim()) throw new PairingClientError("เครื่องนี้มีโปรไฟล์ HoneyTrip อยู่แล้ว กรุณาใช้เบราว์เซอร์ใหม่ที่ไม่มีข้อมูล ห้ามแทนที่หรือรวมตัวตนอัตโนมัติ", 409);
      const user = await ensureUser();
      const deviceDescription = /Android|iPhone|iPad/i.test(navigator.userAgent) ? "Mobile Browser" : "Desktop Browser";
      const data = await linkApi<Omit<Pairing, "targetUid">>("create", { deviceDescription }, user.uid);
      const pairing = { ...data, targetUid: user.uid, receivedAt: Date.now() };
      try { sessionStorage.setItem(STORAGE, JSON.stringify(pairing)); } catch { /* Works without refresh recovery. */ }
      if (mounted.current) { setPair(pairing); setStage("waiting"); }
    } catch (e) { setError(message(e)); setStage("error"); }
  }

  async function lookup(value = code) {
    setBusy(true); setError(""); setPreview(null); setApprovalResult(""); setConfirmed(false);
    try {
      const result = await linkApi<Preview>("lookup", { code: value });
      setPreview(result); setCode(result.code);
    } catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  }

  async function approve(allow: boolean) {
    if (!preview || (allow && !confirmed)) return;
    setBusy(true); setError("");
    try {
      const source = getClientAuth().currentUser;
      if (!source) throw new PairingClientError("ไม่พบตัวตนเดิม กรุณาเปิดเบราว์เซอร์ที่เคยใช้", 401);
      if (allow) {
        await ensureWritableUser();
        await saveSharedProfile(source.uid);
      }
      await linkApi("approve", { requestId: preview.requestId, allow }, source.uid);
      setPreview(null);
      setApprovalResult(allow ? `อนุญาตแล้ว · รหัสตัวตน ${formatIdentityTag(preview.sourceIdentityTag)} · เปรียบเทียบรหัสนี้บนเครื่องใหม่ เครื่องเดิมยังใช้งานได้ตามปกติ` : "ปฏิเสธคำขอแล้ว");
    } catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  }

  async function cancel() {
    if (claiming.current || !pair) return;
    setBusy(true); setError("");
    try {
      if (stage === "waiting" || stage === "approved" || stage === "error") {
        try { await linkApi("cancel", { requestId: pair.requestId, claimSecret: pair.claimSecret }, pair.targetUid); }
        catch (e) {
          // A consumed/expired request cannot be cancelled; closing never revives it.
          if (!(e instanceof PairingClientError && [403, 409, 410].includes(e.status))) throw e;
        }
      }
      clearStored(); setPair(null); setStage("idle"); dialog.current?.close();
    } catch (e) { setError(message(e)); }
    finally { setBusy(false); }
  }

  async function scan(file?: File) {
    if (!file) return;
    setBusy(true); setError("");
    try {
      const decoded = await decodeQrImage(file);
      const link = new URL(decoded);
      const cur = new URL(window.location.origin);
      const isLoopback = (h: string) => h === "localhost" || h === "127.0.0.1";
      const sameOrigin = link.origin === cur.origin || (link.protocol === cur.protocol && link.port === cur.port && isLoopback(link.hostname) && isLoopback(cur.hostname));
      if (!sameOrigin || link.pathname !== "/device-link" || !/^#approve=[a-f0-9]{48}$/.test(link.hash)) throw new Error("invalid");
      const id = link.hash.slice(9);
      setCode(id); await lookup(id);
    } catch { setError("อ่าน QR ไม่สำเร็จ กรุณากรอกรหัส 6 หลักแทน"); }
    finally { setBusy(false); }
  }

  const minutes = String(Math.floor(remaining / 60)).padStart(2, "0");
  const seconds = String(remaining % 60).padStart(2, "0");
  return <main className="mx-auto w-full max-w-xl flex-1 space-y-5 px-4 py-6 pb-16">
    <Link href={returnTo} className="btn-ghost">‹ กลับ HoneyTrip</Link>
    <header className="space-y-1.5">
      <h1 className="text-2xl font-bold">🐝 ย้ายหรือเชื่อมข้อมูลข้ามอุปกรณ์</h1>
      <p className="text-sm text-stone-600">ใช้ข้อมูลทริป ชื่อ วันว่าง และโหวตเดิมต่อได้ทันที โดยไม่ต้องกรอกใหม่</p>
    </header>
    {!isFirebaseConfigured ? <p role="alert">ยังไม่ได้ตั้งค่า Firebase กรุณาติดต่อผู้ดูแล</p> : <>
      <section className="card space-y-3">
        <div className="space-y-3">
          <span className="inline-block rounded-full bg-amber-200 px-2.5 py-1 text-xs font-bold text-amber-900">ขั้นตอนที่ 1 · กดจากเครื่องใหม่</span>
          <h2 className="text-base font-bold">🆕 เครื่องนี้ยังไม่มีข้อมูล (ต้องการดึงข้อมูลมาที่นี่)</h2>
        </div>
        <p className="text-sm text-stone-600 leading-relaxed">
          หากคุณเพิ่งเปิดเว็บใน <strong>มือถือใหม่ คอมเครื่องใหม่ หรือเบราว์เซอร์ใหม่</strong> กดปุ่มด้านล่างเพื่อรับ <strong>รหัส 6 หลัก / QR Code</strong> แล้วนำไปกรอกในเครื่องเดิมของคุณ
        </p>
        <button className="btn-primary" disabled={stage === "creating" || !!pair} onClick={() => void create()}>
          {stage === "creating" ? "กำลังสร้างรหัส…" : "📲 ขอรหัสเชื่อมต่อ (ทำบนเครื่องใหม่)"}
        </button>
      </section>

      <section className="card space-y-3">
        <div className="space-y-3">
          <span className="inline-block rounded-full bg-stone-200 px-2.5 py-1 text-xs font-bold text-stone-800">ขั้นตอนที่ 2 · กดจากเครื่องเดิม</span>
          <h2 className="text-base font-bold">📱 เครื่องนี้มีข้อมูลทริปอยู่แล้ว (ใช้ยืนยันให้เครื่องใหม่)</h2>
        </div>
        <p className="text-sm text-stone-600 leading-relaxed">
          เปิดหน้านี้ใน <strong>เครื่องหรือเบราว์เซอร์ที่คุณเคยกรอกชื่อไว้</strong> แล้วนำรหัส 6 หลัก  <br />(หรือรูป QR Code) ที่แสดงอยู่บนหน้าจอเครื่องใหม่มาใส่ด้านล่าง
        </p>
        <form onSubmit={e => { e.preventDefault(); void lookup(); }} className="flex gap-2">
          <label className="min-w-0 flex-1">
            <span className="text-xs font-medium">กรอกรหัส 6 หลักจากเครื่องใหม่</span>
            <input className="input mt-1 text-lg tabular-nums" inputMode="numeric" autoComplete="off" value={code} maxLength={49} onChange={e => { setCode(e.target.value); setPreview(null); }} placeholder="เช่น 123-456" />
          </label>
          <button className="btn-ghost self-end" disabled={busy || !code || !!pair}>ตรวจสอบรหัส</button>
        </form>
        <label className="btn-ghost cursor-pointer">
          📷 สแกน / เลือกรูปภาพ QR Code
          <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={busy || !!pair} onChange={e => { void scan(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
       
      </section>

      {preview && <section className="card border-amber-300 space-y-3">
        <h2 className="font-bold">🔐 ยืนยันอนุญาตให้เครื่องใหม่ใช้งาน?</h2>
        <p>โปรไฟล์ที่จะส่งไป: <strong>{profile.emoji} {profile.name || "ตัวตนเดิมในเบราว์เซอร์นี้ · ยังไม่ได้ตั้งชื่อ"}</strong></p>
        <p className="text-sm">อุปกรณ์ที่ขอเชื่อม: {preview.deviceDescription}</p>
        <p className="text-sm">รหัสตัวตนของคุณ: <strong className="font-mono">{formatIdentityTag(preview.sourceIdentityTag)}</strong></p>
        <p className="font-mono text-xl">รหัสเชื่อมต่อ: {preview.code.slice(0, 3)}-{preview.code.slice(3)}</p>
        <p className="text-sm text-amber-900">เครื่องใหม่จะเข้าถึงข้อมูลทริปและสิทธิ์ผู้ดูแล/การเงินของบัญชีนี้ได้ทั้งหมด กรุณาอนุญาตเฉพาะเครื่องที่คุณกดขอรหัสด้วยตัวเองเท่านั้น</p>
        <label className="flex gap-2 text-sm cursor-pointer"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />ฉันเป็นคนเปิดขอรหัสบนเครื่องใหม่ด้วยตัวเอง และข้อมูลข้างต้นถูกต้อง</label>
        <div className="flex flex-wrap gap-2"><button className="btn-ghost" disabled={busy} onClick={() => void approve(false)}>ปฏิเสธคำขอ</button><button className="btn-primary" disabled={busy || !confirmed} onClick={() => void approve(true)}>✅ อนุญาตให้เชื่อมต่อ</button></div>
      </section>}
    </>}
    {approvalResult && <p role="status" className="card bg-emerald-50">{approvalResult}</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <p className="text-xs text-stone-600">หมายเหตุ: หากล้างข้อมูลเบราว์เซอร์หรือทำเครื่องเดิมหายโดยยังไม่ได้เชื่อมเครื่องสำรองไว้ จะไม่สามารถกู้คืนตัวตนเดิมได้</p>
    <dialog ref={dialog} onCancel={e => { e.preventDefault(); void cancel(); }} className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-sm overflow-y-auto rounded-2xl border border-amber-200 bg-amber-50 p-5 text-stone-900 shadow-xl backdrop:bg-stone-900/40" aria-labelledby="pairing-title">
      <div className="space-y-3 text-center"><h2 id="pairing-title" className="text-lg font-bold">📲 นำรหัสนี้ไปใส่ในเครื่องเดิม</h2><p className="text-sm">เปิดหน้า <strong>เชื่อมต่ออุปกรณ์</strong> บนเครื่องเดิมที่มีข้อมูลทริปของคุณ แล้วสแกน QR หรือกรอกรหัส 6 หลักนี้</p>
        {qr && stage === "waiting" && <div className="mx-auto w-fit rounded-xl bg-white p-2"><Image src={qr} unoptimized width={256} height={256} alt="QR คำขอเชื่อมต่อ ไม่มีข้อมูลเข้าสู่ระบบ" /></div>}
        {pair && <p className="text-sm">รหัสเชื่อมต่อ 6 หลัก: <strong className="block text-3xl font-mono">{pair.code.slice(0, 3)}-{pair.code.slice(3)}</strong></p>}
        {(stage === "waiting" || stage === "approved") && <><p className="tabular-nums text-sm">หมดอายุใน {minutes}:{seconds} นาที</p><progress className="w-full accent-amber-500" max={300} value={remaining} aria-label="เวลาเชื่อมต่อที่เหลือ" /><p className="text-xs text-stone-600">กรอกรหัสนี้ในกล่อง &ldquo;ขั้นตอนที่ 2 · กดจากเครื่องเดิม&rdquo; บนอุปกรณ์เดิมของคุณ</p></>}
        {stage === "approved" && approvedAccount && <div className="space-y-3 rounded-xl border border-amber-300 bg-white p-3 text-left">
          <p className="font-bold">🎉 เครื่องเดิมอนุญาตแล้ว! ยืนยันการรับข้อมูล</p>
          <p>โปรไฟล์: <strong>{approvedAccount.emoji} {approvedAccount.name || "ตัวตนที่ยังไม่ได้ตั้งชื่อ"}</strong></p>
          <p className="text-sm">รหัสตัวตน: <strong className="font-mono">{formatIdentityTag(approvedAccount.identityTag)}</strong></p>
          <p className="text-xs text-stone-600">ตรวจสอบว่าชื่อและรหัสตัวตนตรงกับที่แสดงบนเครื่องเดิมของคุณ แล้วกดปุ่มด้านล่างเพื่อเริ่มใช้งานทันที</p>
          <label className="flex gap-2 text-sm cursor-pointer"><input type="checkbox" checked={targetConfirmed} onChange={e => setTargetConfirmed(e.target.checked)} />ใช่ นี่คือบัญชีของฉันเอง และรหัสตัวตนตรงกับเครื่องเดิม</label>
          <button className="btn-primary w-full" disabled={!targetConfirmed} onClick={() => pair && void claim(pair)}>🚀 เริ่มใช้บัญชีนี้บนเครื่องนี้เลย</button>
        </div>}
        <p role="status" className="font-medium">{({ idle: "", creating: "กำลังสร้างรหัส…", waiting: "กำลังรอการกดอนุญาตจากเครื่องเดิม…", approved: "ได้รับอนุญาตจากเครื่องเดิมแล้ว!", signing: "กำลังซิงก์ข้อมูลเข้าเครื่องนี้…", success: "✅ เชื่อมต่อสำเร็จ", denied: "คำขอถูกปฏิเสธ", expired: "รหัสหมดอายุ กรุณาสร้างใหม่", error: "เชื่อมต่อไม่สำเร็จ" })[stage]}</p>
        {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
        <button className="btn-ghost w-full" disabled={busy || stage === "signing"} onClick={() => void cancel()}>{stage === "waiting" || stage === "approved" ? "ยกเลิกคำขอ" : "ปิด"}</button>
      </div>
    </dialog>
  </main>;
}

function formatIdentityTag(tag?: string) { return tag?.match(/.{1,4}/g)?.join("-") ?? ""; }

async function decodeQrImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new window.Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("load"));
      el.src = url;
    });
    const DetectorCtor = (window as unknown as { BarcodeDetector?: new (opts: { formats: string[] }) => { detect(src: ImageBitmapSource): Promise<Array<{ rawValue?: string }>> } }).BarcodeDetector;
    if (DetectorCtor) {
      try {
        const codes = await new DetectorCtor({ formats: ["qr_code"] }).detect(img);
        if (codes[0]?.rawValue) return codes[0].rawValue;
      } catch { /* Fall back to ZXing */ }
    }
    const zxing = await import("@zxing/library");
    const reader = new zxing.QRCodeReader();
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    const s = Math.min(w, h);
    const regions: Array<[number, number, number, number]> = [
      [0, 0, w, h],
      [w * 0.16, h * 0.18, w * 0.68, h * 0.38],
      [w * 0.12, h * 0.14, w * 0.76, h * 0.46],
      [(w - s) / 2, (h - s) * 0.25, s, s],
      [(w - s) / 2, (h - s) / 2, s, s],
    ];
    const hintSets = [
      new Map([[zxing.DecodeHintType.PURE_BARCODE, true]]),
      new Map([[zxing.DecodeHintType.TRY_HARDER, true]]),
    ];
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) throw new Error("canvas");
    for (const [rx, ry, rw, rh] of regions) {
      const cw = Math.max(1, Math.floor(rw));
      const ch = Math.max(1, Math.floor(rh));
      canvas.width = cw;
      canvas.height = ch;
      ctx.drawImage(img, Math.max(0, Math.floor(rx)), Math.max(0, Math.floor(ry)), cw, ch, 0, 0, cw, ch);
      const source = new zxing.HTMLCanvasElementLuminanceSource(canvas);
      for (const hints of hintSets) {
        try {
          const bitmap = new zxing.BinaryBitmap(new zxing.HybridBinarizer(source));
          return reader.decode(bitmap, hints).getText();
        } catch { /* Try next region/hint */ }
      }
    }
    throw new Error("not-found");
  } finally {
    URL.revokeObjectURL(url);
  }
}

