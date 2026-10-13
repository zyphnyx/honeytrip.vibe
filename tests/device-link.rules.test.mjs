import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";

test("real Firestore rules: private pairing data, UID usage guard and existing authorization", async () => {
  const env = await initializeTestEnvironment({ projectId: "demo-honeytrip-link", firestore: { rules: await readFile("firestore.rules", "utf8") } });
  try {
    const target = env.authenticatedContext("target").firestore();
    const source = env.authenticatedContext("source").firestore();
    const other = env.authenticatedContext("other").firestore();
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      await setDoc(doc(db, "identityGuards/target"), { used: false, lockedUntil: Date.now() + 300000, requestId: "request" });
      await setDoc(doc(db, "identityGuards/source"), { used: true, lockedUntil: 0 });
      await setDoc(doc(db, "rooms/one"), { title: "ทริป", emoji: "🐝", createdAt: 1, ownerUid: "source", archived: false });
      await setDoc(doc(db, "deviceLinkRequests/request"), { claimSecretHash: "secret" });
    });
    for (const collection of ["deviceLinkRequests", "deviceLinkCodes", "deviceLinkLimits"]) {
      await assertFails(getDoc(doc(source, collection, "request")));
      await assertFails(setDoc(doc(source, collection, "request"), { status: "approved" }));
    }
    await assertFails(setDoc(doc(target, "identityGuards/target"), { used: true, lockedUntil: 0 }));
    await assertFails(setDoc(doc(target, "rooms/new"), { title: "ใหม่", emoji: "🐝", createdAt: 1, ownerUid: "target" }));
    await assertFails(setDoc(doc(target, "rooms/one/votes/target"), { stayId: "x" }));
    await assertFails(setDoc(doc(target, "rooms/one/financeSettings/main"), { updatedBy: "target" }));
    await assertSucceeds(setDoc(doc(other, "identityGuards/other"), { used: true, lockedUntil: 0 }));
    await assertFails(setDoc(doc(other, "identityGuards/other"), { used: false, lockedUntil: 0 }));
    await assertFails(deleteDoc(doc(other, "identityGuards/other")));
    await assertSucceeds(updateDoc(doc(source, "rooms/one"), { archived: true, archivedBy: "source", archivedAt: 100 }));
    await assertFails(updateDoc(doc(other, "rooms/one"), { archived: false, archivedBy: null, archivedAt: null }));
    await assertFails(deleteDoc(doc(source, "rooms/one")));
    await assertFails(setDoc(doc(source, "rooms/one/votes/source"), { stayId: "x" }));
    await assertSucceeds(updateDoc(doc(source, "rooms/one"), { archived: false, archivedBy: null, archivedAt: null }));
    await assertSucceeds(setDoc(doc(source, "rooms/one/votes/source"), { stayId: "x" }));
    await assertFails(setDoc(doc(other, "rooms/one/votes/source"), { stayId: "y" }));
    await assertSucceeds(setDoc(doc(source, "users/source"), { displayName: "เจม", emoji: "🐻", recentRooms: [], updatedAt: 1 }));
    await assertFails(getDoc(doc(other, "users/source")));
    await assertFails(setDoc(doc(other, "users/source"), { displayName: "ปลอม", emoji: "🐻", recentRooms: [], updatedAt: 2 }));
    await env.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), "identityGuards/target"), { used: false, lockedUntil: 0 }));
    await assertSucceeds(setDoc(doc(target, "identityGuards/target"), { used: true, lockedUntil: 0 }));
    assert.equal((await getDoc(doc(target, "identityGuards/target"))).data().used, true);
  } finally { await env.cleanup(); }
});
