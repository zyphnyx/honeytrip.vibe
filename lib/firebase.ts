import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { browserLocalPersistence, connectAuthEmulator, getAuth, setPersistence, signInAnonymously, type User } from "firebase/auth";
import { connectFirestoreEmulator, doc, getFirestore, runTransaction, type Firestore } from "firebase/firestore";

// NEXT_PUBLIC_* ต้องอ้างแบบ static เพื่อให้ Next inline ค่าตอน build
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);

function app(): FirebaseApp {
  const existing = getApps().find(a => a.name === "[DEFAULT]");
  if (existing) return getApp();
  const instance = initializeApp(config);
  // Explicit demo-only development opt-in; never redirect production credentials to an emulator.
  if (process.env.NODE_ENV === "development" && process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATORS === "true" && config.projectId?.startsWith("demo-")) {
    connectAuthEmulator(getAuth(instance), "http://127.0.0.1:19099", { disableWarnings: true });
    connectFirestoreEmulator(getFirestore(instance), "127.0.0.1", 18080);
  }
  return instance;
}

export function getDb(): Firestore {
  return getFirestore(app());
}

/** ล็อกอินแบบ anonymous เงียบๆ แล้วคืน user (uid คงที่ต่อ browser) */
export function getClientAuth() { return getAuth(app()); }
let pendingUser: Promise<User> | undefined;
export async function ensureUser(): Promise<User> {
  const auth = getClientAuth();
  await auth.authStateReady();
  if (auth.currentUser) return auth.currentUser;
  pendingUser ??= (async () => {
    await setPersistence(auth, browserLocalPersistence);
    return (await signInAnonymously(auth)).user;
  })().finally(() => { pendingUser = undefined; });
  return pendingUser;
}

/** Irreversible usage marker. Rules require it before ALL room mutations. */
export async function ensureWritableUser(): Promise<User> {
  const user = await ensureUser();
  const ref = doc(getDb(), "identityGuards", user.uid);
  await runTransaction(getDb(), async tx => {
    const snap = await tx.get(ref);
    const guard = snap.data();
    if (Number(guard?.lockedUntil ?? 0) > Date.now()) throw new Error("กำลังเชื่อมต่ออุปกรณ์ กรุณายกเลิกหรือรอให้รหัสหมดอายุก่อนแก้ไขข้อมูล");
    if (!guard?.used) tx.set(ref, { used: true, lockedUntil: 0 });
  });
  return user;
}
