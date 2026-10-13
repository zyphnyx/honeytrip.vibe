import test from "node:test";
import assert from "node:assert/strict";
import { initializeApp as adminApp, deleteApp as deleteAdminApp } from "firebase-admin/app";
import { getAuth as adminAuth } from "firebase-admin/auth";
import { getFirestore as adminFirestore } from "firebase-admin/firestore";
import { initializeApp, deleteApp } from "firebase/app";
import { getAuth, connectAuthEmulator, signInAnonymously, signInWithCustomToken } from "firebase/auth";
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";
import { deviceLinkService, identityTag } from "../lib/deviceLinkService.ts";

test("Auth + Firestore emulators: two sessions share exact UID without changing records or source session", async () => {
  assert.ok(process.env.FIREBASE_AUTH_EMULATOR_HOST, "Run via npm run test:emulator; never production");
  assert.ok(process.env.FIRESTORE_EMULATOR_HOST);
  const projectId = "demo-honeytrip-link";
  const admin = adminApp({ projectId }, "link-integration");
  const db = adminFirestore(admin); const auth = adminAuth(admin);
  const clients = ["source", "destination"].map(name => {
    const app = initializeApp({ projectId, apiKey: "fake-emulator-key", authDomain: "localhost" }, name);
    const auth = getAuth(app); connectAuthEmulator(auth, `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`, { disableWarnings: true });
    const db = getFirestore(app); const [host, port] = process.env.FIRESTORE_EMULATOR_HOST.split(":");
    connectFirestoreEmulator(db, host, Number(port));
    return { app, auth, db };
  });
  try {
    const [source, target] = clients;
    const sourceUser = (await signInAnonymously(source.auth)).user;
    const targetUser = (await signInAnonymously(target.auth)).user;
    assert.notEqual(sourceUser.uid, targetUser.uid);
    await db.doc(`identityGuards/${sourceUser.uid}`).set({ used: true, lockedUntil: 0 });
    const roomId = "integration";
    const root = `rooms/${roomId}`;
    const member = { name: "เจม", emoji: "🐻", status: "going", durationMin: 2, durationMax: 3,
      budgetMin: 500, budgetMax: 1000, availableDates: ["2026-11-01"], origin: "กทม", transport: "any", seats: 0, prefs: [], note: "ข้อมูลเดิม", updatedAt: 1 };
    const records = {
      [root]: { title: "ทดสอบ", emoji: "🐝", createdAt: 1, ownerUid: sourceUser.uid, archived: false },
      [`${root}/members/${sourceUser.uid}`]: member,
      [`${root}/votes/${sourceUser.uid}`]: { stayId: "stay" },
      [`${root}/activities/post`]: { createdBy: sourceUser.uid, title: "โพสต์เดิม" },
      [`${root}/activityComments/comment`]: { authorUid: sourceUser.uid, body: "คอมเมนต์เดิม" },
      [`${root}/financeSettings/main`]: { managerUids: [sourceUser.uid] },
      [`${root}/payments/payment`]: { submittedBy: sourceUser.uid, status: "approved", amountSatang: 12300 },
      [`${root}/ledgerEntries/entry`]: { approvedBy: sourceUser.uid, amountSatang: 12300, type: "income" },
      [`users/${sourceUser.uid}`]: { displayName: "เจม", emoji: "🐻", recentRooms: [{ id: roomId, title: "ทดสอบ", emoji: "🐝", visitedAt: 1 }], updatedAt: 1 },
    };
    const batch = db.batch(); for (const [path, value] of Object.entries(records)) batch.set(db.doc(path), value); await batch.commit();
    const service = deviceLinkService({ cleanSince: Date.now() - 60000, now: Date.now,
      userCreatedAt: async uid => Date.parse((await auth.getUser(uid)).metadata.creationTime),
      mintToken: uid => auth.createCustomToken(uid),
      transaction: fn => db.runTransaction(tx => fn({ get: async path => (await tx.get(db.doc(path))).data(), set: (path, value) => tx.set(db.doc(path), value) })),
    });
    const request = await service.create(targetUser.uid, true, "Desktop Browser");
    await assert.rejects(setDoc(doc(target.db, `${root}/votes/${targetUser.uid}`), { stayId: "new" }));
    const token = await sourceUser.getIdToken(); assert.equal((await auth.verifyIdToken(token)).uid, sourceUser.uid);
    await service.approve(sourceUser.uid, request.requestId, true);
    const result = await service.claim(targetUser.uid, request.requestId, request.claimSecret, identityTag(sourceUser.uid));
    const linked = await signInWithCustomToken(target.auth, result.customToken);
    assert.equal(linked.user.uid, sourceUser.uid);
    assert.equal(source.auth.currentUser.uid, sourceUser.uid);
    const loaded = await new Promise((resolve, reject) => {
      const unsubscribe = onSnapshot(doc(target.db, `${root}/members/${linked.user.uid}`), snapshot => { unsubscribe(); resolve(snapshot.data()); }, reject);
    });
    assert.deepEqual(loaded, member);
    assert.equal((await getDoc(doc(target.db, `users/${linked.user.uid}`))).data().displayName, "เจม");
    for (const [path, value] of Object.entries(records)) assert.deepEqual((await db.doc(path).get()).data(), value);
    // The linked UID can still archive and restore with existing owner rules.
    const { updateDoc } = await import("firebase/firestore");
    await updateDoc(doc(target.db, root), { archived: true, archivedAt: 123, archivedBy: sourceUser.uid });
    await updateDoc(doc(target.db, root), { archived: false, archivedAt: null, archivedBy: null });
    assert.ok(await auth.getUser(targetUser.uid)); // Temporary Auth account was never deleted.
    await assert.rejects(service.claim(targetUser.uid, request.requestId, request.claimSecret));
  } finally {
    await Promise.all(clients.map(c => deleteApp(c.app)));
    await db.terminate(); await deleteAdminApp(admin);
  }
});
