import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInAnonymously, type User } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

// NEXT_PUBLIC_* ต้องอ้างแบบ static เพื่อให้ Next inline ค่าตอน build
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = Boolean(config.apiKey && config.projectId && config.appId);

function app(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(config);
}

export function getDb(): Firestore {
  return getFirestore(app());
}

/** ล็อกอินแบบ anonymous เงียบๆ แล้วคืน user (uid คงที่ต่อ browser) */
export function ensureUser(): Promise<User> {
  const auth = getAuth(app());
  return new Promise((resolve, reject) => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      if (user) {
        unsub();
        resolve(user);
        return;
      }
      try {
        await signInAnonymously(auth);
      } catch (e) {
        unsub();
        reject(e);
      }
    });
  });
}
