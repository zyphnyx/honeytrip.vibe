import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

export function firebaseAdmin() {
  if (process.env.NODE_ENV === "production" && (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST)) {
    throw new Error("Emulator configuration is forbidden in production");
  }
  const existing = getApps().find(a => a.name === "honeytrip-server");
  if (existing) return { auth: getAuth(existing), db: getFirestore(existing) };
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (process.env.NODE_ENV === "development" && projectId?.startsWith("demo-")
      && process.env.FIREBASE_AUTH_EMULATOR_HOST === "127.0.0.1:19099"
      && process.env.FIRESTORE_EMULATOR_HOST === "127.0.0.1:18080") {
    const app = initializeApp({ projectId }, "honeytrip-server");
    return { auth: getAuth(app), db: getFirestore(app) };
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("Admin credentials unavailable");
  const account = JSON.parse(raw);
  if (!account.project_id || !account.private_key || !account.client_email || account.project_id !== process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) throw new Error("Invalid Admin configuration");
  const app = initializeApp({ credential: cert(account) }, "honeytrip-server");
  return { auth: getAuth(app), db: getFirestore(app) };
}
