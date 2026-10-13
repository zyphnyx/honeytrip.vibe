import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";

export type LinkStatus = "pending" | "approved" | "consumed" | "denied" | "expired";
export interface LinkRequest {
  targetTemporaryUid: string;
  claimSecretHash: string;
  code: string;
  status: LinkStatus;
  approvedSourceUid: string | null;
  createdAt: number;
  expiresAt: number;
  approvedAt: number | null;
  consumedAt: number | null;
  deviceDescription: string;
}
export interface LinkTransaction {
  get(path: string): Promise<Record<string, unknown> | undefined>;
  set(path: string, value: object): void;
}
export interface LinkDependencies {
  transaction<T>(fn: (tx: LinkTransaction) => Promise<T>): Promise<T>;
  mintToken(uid: string): Promise<string>;
  userCreatedAt(uid: string): Promise<number>;
  cleanSince: number;
  now(): number;
}
export class LinkError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}
export const hashSecret = (value: string) => createHash("sha256").update(value).digest("hex");
export const identityTag = (uid: string) => hashSecret(uid).slice(0, 12);
const requestPath = (id: string) => `deviceLinkRequests/${id}`;
const guardPath = (uid: string) => `identityGuards/${uid}`;
const TTL = 5 * 60_000;

function validateId(id: unknown): asserts id is string {
  if (typeof id !== "string" || !/^[a-f0-9]{48}$/.test(id)) throw new LinkError("ไม่พบคำขอเชื่อมต่อ", 404);
}
function validateSecret(secret: unknown): asserts secret is string {
  if (typeof secret !== "string" || !/^[a-f0-9]{64}$/.test(secret)) throw new LinkError("ยืนยันเครื่องที่ขอเชื่อมต่อไม่สำเร็จ", 403);
}
function owned(r: LinkRequest, uid: string, secret: string) {
  validateSecret(secret);
  if (r.targetTemporaryUid !== uid || !timingSafeEqual(Buffer.from(r.claimSecretHash, "hex"), Buffer.from(hashSecret(secret), "hex"))) {
    throw new LinkError("ยืนยันเครื่องที่ขอเชื่อมต่อไม่สำเร็จ", 403);
  }
}
function active(r: LinkRequest, now: number) {
  if (r.expiresAt <= now) throw new LinkError("รหัสเชื่อมต่อหมดอายุแล้ว กรุณาสร้างใหม่", 410);
  if (r.status !== "pending" && r.status !== "approved") throw new LinkError("คำขอนี้สิ้นสุดแล้ว กรุณาสร้างใหม่", 409);
}
async function read(tx: LinkTransaction, id: string): Promise<LinkRequest> {
  validateId(id);
  const r = await tx.get(requestPath(id));
  if (!r) throw new LinkError("ไม่พบคำขอเชื่อมต่อ", 404);
  return r as unknown as LinkRequest;
}
function publicRequest(id: string, r: LinkRequest, now: number) {
  return { requestId: id, code: r.code, deviceDescription: r.deviceDescription,
    expiresAt: r.expiresAt, serverNow: now, status: r.expiresAt <= now && r.status !== "consumed" ? "expired" : r.status };
}

/** Real Firestore transactions in production; the same service runs against an isolated transactional test store. */
export function deviceLinkService(d: LinkDependencies) {
  async function verifySource(tx: LinkTransaction, uid: string) {
    if (!Number.isFinite(d.cleanSince) || d.cleanSince <= 0 || d.cleanSince > d.now()) throw new LinkError("ระบบเชื่อมต่อยังไม่พร้อม กรุณาติดต่อผู้ดูแล", 503);
    const guard = await tx.get(guardPath(uid));
    const born = await d.userCreatedAt(uid);
    if (!Number.isFinite(born) || Number(guard?.lockedUntil ?? 0) > d.now() || (born >= d.cleanSince && guard?.used !== true)) {
      throw new LinkError("เบราว์เซอร์นี้ยังไม่มีตัวตนเดิม กรุณาเปิดในเบราว์เซอร์ที่เคยใช้ HoneyTrip", 403);
    }
  }
  return {
    async rateLimit(uid: string, action: string) {
      const now = d.now();
      const day = Math.floor(now / 86_400_000);
      const bucket = Math.floor(now / 600_000);
      const globalPath = `deviceLinkLimits/global-${day}`;
      const uidPath = `deviceLinkLimits/${hashSecret(uid)}-${bucket}`;
      const allowed = await d.transaction(async tx => {
        const global = await tx.get(globalPath) ?? {};
        const local = await tx.get(uidPath) ?? {};
        const total = Number(global.total ?? 0);
        const count = Number(local[action] ?? 0);
        // Durable global budget bounds this feature's accepted traffic on Spark.
        const dailyAction = Number(global[action] ?? 0);
        const limit = action === "create" ? 3 : action === "lookup" || action === "approve" ? 10 : 125;
        if (total >= 3000 || count >= limit || (action === "create" && dailyAction >= 25) || (action === "lookup" && dailyAction >= 400)) return false;
        tx.set(globalPath, { ...global, total: total + 1, [action]: dailyAction + 1, purgeAfter: now + 86_400_000 });
        tx.set(uidPath, { ...local, [action]: count + 1, purgeAfter: now + 86_400_000 });
        return true;
      });
      if (!allowed) throw new LinkError("ขอเชื่อมต่อบ่อยเกินไป กรุณาลองใหม่ภายหลัง", 429);
    },

    async create(uid: string, anonymous: boolean, description: string) {
      const now = d.now();
      const born = await d.userCreatedAt(uid);
      if (!Number.isFinite(d.cleanSince) || d.cleanSince <= 0 || d.cleanSince > now) throw new LinkError("ระบบเชื่อมต่อยังไม่พร้อม กรุณาติดต่อผู้ดูแล", 503);
      // Legacy accounts cannot be proven empty without enumerating production data. Never replace them.
      if (!anonymous || !Number.isFinite(born) || born < d.cleanSince) throw new LinkError("เครื่องนี้มีตัวตนเดิมหรือยังยืนยันว่าเป็นเครื่องว่างไม่ได้ กรุณาใช้เบราว์เซอร์ใหม่ที่ไม่มีข้อมูล HoneyTrip", 409);
      const id = randomBytes(24).toString("hex");
      const secret = randomBytes(32).toString("hex");
      for (let attempt = 0; attempt < 5; attempt++) {
        const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
        const r: LinkRequest = { targetTemporaryUid: uid, claimSecretHash: hashSecret(secret), code,
          status: "pending", approvedSourceUid: null, createdAt: now, expiresAt: now + TTL,
          approvedAt: null, consumedAt: null, deviceDescription: description.slice(0, 80) };
        const created = await d.transaction(async tx => {
          const guard = await tx.get(guardPath(uid));
          const existingCode = await tx.get(`deviceLinkCodes/${code}`);
          if (guard?.used === true) throw new LinkError("เครื่องนี้มีข้อมูล HoneyTrip อยู่แล้ว ห้ามแทนที่ตัวตน กรุณาใช้เบราว์เซอร์ใหม่", 409);
          if (Number(guard?.lockedUntil ?? 0) > now) throw new LinkError("เครื่องนี้มีคำขอเชื่อมต่ออยู่แล้ว กรุณายกเลิกหรือรอหมดอายุ", 409);
          if (Number(existingCode?.expiresAt ?? 0) > now) return false;
          tx.set(requestPath(id), r);
          tx.set(`deviceLinkCodes/${code}`, { requestId: id, expiresAt: r.expiresAt });
          // Rules require used=true for every room write, and prohibit setting it during this lock.
          tx.set(guardPath(uid), { used: false, lockedUntil: r.expiresAt, requestId: id });
          return true;
        });
        if (created) return { ...publicRequest(id, r, now), claimSecret: secret };
      }
      throw new LinkError("สร้างรหัสไม่สำเร็จ กรุณาลองใหม่", 503);
    },

    async lookup(uid: string, value: string) {
      return d.transaction(async tx => {
        let id = value;
        if (/^\d{6}$/.test(value)) {
          const index = await tx.get(`deviceLinkCodes/${value}`);
          if (!index || Number(index.expiresAt) <= d.now()) throw new LinkError("รหัสไม่ถูกต้องหรือหมดอายุแล้ว", 404);
          id = String(index.requestId);
        }
        const r = await read(tx, id);
        active(r, d.now());
        if (r.targetTemporaryUid === uid) throw new LinkError("ต้องอนุญาตจากเบราว์เซอร์ที่มีตัวตนเดิม", 403);
        await verifySource(tx, uid);
        return { ...publicRequest(id, r, d.now()), sourceIdentityTag: identityTag(uid) };
      });
    },

    async status(uid: string, id: string, secret: string) {
      return d.transaction(async tx => {
        const r = await read(tx, id);
        owned(r, uid, secret);
        let approvedAccount;
        if (r.status === "approved" && r.expiresAt > d.now() && r.approvedSourceUid) {
          const profile = await tx.get(`users/${r.approvedSourceUid}`);
          approvedAccount = { name: typeof profile?.displayName === "string" ? profile.displayName.slice(0, 150) : "",
            emoji: typeof profile?.emoji === "string" ? profile.emoji.slice(0, 32) : "🐻", identityTag: identityTag(r.approvedSourceUid) };
        }
        return { ...publicRequest(id, r, d.now()), ...(approvedAccount ? { approvedAccount } : {}) };
      });
    },

    async approve(uid: string, id: string, allow: boolean) {
      return d.transaction(async tx => {
        const r = await read(tx, id);
        active(r, d.now());
        if (r.status !== "pending") throw new LinkError("คำขอนี้ได้รับการตอบกลับแล้ว", 409);
        if (r.targetTemporaryUid === uid) throw new LinkError("ไม่สามารถอนุญาตให้เครื่องตัวเองได้", 403);
        const targetGuard = !allow ? await tx.get(guardPath(r.targetTemporaryUid)) : undefined;
        await verifySource(tx, uid);
        active(r, d.now());
        tx.set(requestPath(id), { ...r, status: allow ? "approved" : "denied",
          approvedSourceUid: allow ? uid : null, approvedAt: d.now() });
        if (!allow && targetGuard?.requestId === id) tx.set(guardPath(r.targetTemporaryUid), { used: false, lockedUntil: 0 });
        return { status: allow ? "approved" : "denied" };
      });
    },

    async cancel(uid: string, id: string, secret: string) {
      return d.transaction(async tx => {
        const r = await read(tx, id);
        owned(r, uid, secret);
        active(r, d.now());
        const guard = await tx.get(guardPath(uid));
        active(r, d.now());
        tx.set(requestPath(id), { ...r, status: "denied" });
        if (guard?.requestId === id) tx.set(guardPath(uid), { used: false, lockedUntil: 0 });
        return { status: "denied" };
      });
    },

    async claim(uid: string, id: string, secret: string, expectedIdentityTag: string) {
      // Mint only in memory, before the consuming transaction. A failed signer leaves approval retryable.
      // Concurrent callers may mint; ONLY the winner of the transaction receives a token.
      const r = await d.transaction(async tx => {
        const r = await read(tx, id);
        owned(r, uid, secret); active(r, d.now());
        if (r.status !== "approved" || !r.approvedSourceUid || r.approvedSourceUid === uid) throw new LinkError("ยังไม่ได้รับอนุญาตจากเครื่องเดิม", 409);
        if (typeof expectedIdentityTag !== "string" || expectedIdentityTag !== identityTag(r.approvedSourceUid)) throw new LinkError("รหัสตัวตนไม่ตรงกับเครื่องเดิม กรุณายกเลิกคำขอ", 409);
        return r;
      });
      const token = await d.mintToken(r.approvedSourceUid!);
      await d.transaction(async tx => {
        const current = await read(tx, id);
        owned(current, uid, secret); active(current, d.now());
        const guard = await tx.get(guardPath(uid));
        active(current, d.now());
        if (current.status !== "approved" || current.approvedSourceUid !== r.approvedSourceUid || guard?.used === true || guard?.requestId !== id) throw new LinkError("คำขอนี้ใช้ไม่ได้แล้ว กรุณาสร้างใหม่", 409);
        tx.set(requestPath(id), { ...current, status: "consumed", consumedAt: d.now(), claimSecretHash: hashSecret(randomBytes(32).toString("hex")) });
        // Keep the target locked to its expiry; do not delete either Auth account.
      });
      return { customToken: token, approvedUid: r.approvedSourceUid };
    },
  };
}
