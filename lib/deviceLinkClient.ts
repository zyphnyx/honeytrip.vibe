import { getClientAuth } from "./firebase";

export interface Pairing {
  requestId: string;
  code: string;
  claimSecret: string;
  targetUid: string;
  expiresAt: number;
  serverNow: number;
  receivedAt: number;
  deviceDescription: string;
  status: string;
  sourceIdentityTag?: string;
  approvedAccount?: { name: string; emoji: string; identityTag: string };
}
export class PairingClientError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}
export async function linkApi<T>(action: string, body: object, expectedUid?: string): Promise<T> {
  const auth = getClientAuth();
  await auth.authStateReady();
  const user = auth.currentUser;
  // Approval never creates an anonymous identity and calls it the original account.
  if (!user || (expectedUid && user.uid !== expectedUid)) throw new PairingClientError("ตัวตนในเบราว์เซอร์เปลี่ยนไป กรุณาเริ่มเชื่อมต่อใหม่", 401);
  const token = await user.getIdToken();
  const response = await fetch(`/api/device-link/${action}`, {
    method: "POST", cache: "no-store", credentials: "same-origin", referrerPolicy: "no-referrer",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body), signal: AbortSignal.timeout(20_000),
  });
  let data: ({ error?: string } & T) | null = null;
  try {
    data = await response.json();
  } catch {
    throw new PairingClientError("เซิร์ฟเวอร์ขัดข้องชั่วคราว กรุณาลองใหม่อีกครั้ง", response.status || 500);
  }
  if (!response.ok || !data) throw new PairingClientError(data?.error || "เชื่อมต่อไม่สำเร็จ กรุณาลองใหม่", response.status);
  return data;
}
