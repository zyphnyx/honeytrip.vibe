import "server-only";
import { firebaseAdmin } from "./firebaseAdmin";

export interface VerifiedUser {
  uid: string;
}

/**
 * Extracts and verifies Firebase ID Token from request headers.
 */
export async function authenticateServerRequest(request: Request): Promise<VerifiedUser> {
  const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new Error("Missing or invalid Authorization header");
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    throw new Error("Missing Bearer token");
  }

  try {
    const { auth } = firebaseAdmin();
    const decoded = await auth.verifyIdToken(token);
    return { uid: decoded.uid };
  } catch (err: unknown) {
    // Development fallback if FIREBASE_SERVICE_ACCOUNT_JSON is not configured in local environment
    if (process.env.NODE_ENV !== "production") {
      try {
        const parts = token.split(".");
        if (parts.length === 3) {
          const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
          if (payload.user_id || payload.sub) {
            return { uid: String(payload.user_id || payload.sub) };
          }
        }
      } catch {
        // Fall through to throw original error
      }
    }
    throw new Error("Invalid or expired session token: " + (err instanceof Error ? err.message : String(err)));
  }
}

/**
 * Validates that a room exists, is not archived, and that the requester is a member or owner.
 */
export async function validateRoomAccess(
  roomId: string,
  userUid: string,
  requireActive = true
): Promise<{ title: string; ownerUid?: string; isManager: boolean }> {
  const { db } = firebaseAdmin();
  const roomDoc = await db.doc(`rooms/${roomId}`).get();

  if (!roomDoc.exists) {
    throw new Error("ไม่พบห้องทริปนี้ในระบบ");
  }

  const roomData = roomDoc.data() || {};
  if (requireActive && roomData.archived === true) {
    throw new Error("ทริปนี้อยู่ในสถานะจัดเก็บแล้ว (Read-Only) ไม่สามารถเพิ่มหรือแก้ไขข้อมูลได้");
  }

  // Check membership
  const memberDoc = await db.doc(`rooms/${roomId}/members/${userUid}`).get();
  const isOwner = roomData.ownerUid === userUid;
  const isMember = memberDoc.exists;

  // In HoneyTrip, any member can view finance and manager has managerUid
  if (!isMember && !isOwner) {
    throw new Error("คุณไม่ได้เป็นสมาชิกของทริปนี้");
  }

  const settingsDoc = await db.doc(`rooms/${roomId}/financeSettings/main`).get();
  const settingsData = settingsDoc.data();
  const isManager = isOwner || settingsData?.managerUid === userUid || !settingsData?.managerUid;

  return {
    title: roomData.title || "HoneyTrip",
    ownerUid: roomData.ownerUid,
    isManager: Boolean(isManager),
  };
}
