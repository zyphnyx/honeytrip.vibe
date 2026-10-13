import test from "node:test";
import assert from "node:assert/strict";
import { deviceLinkService, hashSecret, identityTag } from "../lib/deviceLinkService.ts";
import { deviceLinkHttp } from "../lib/deviceLinkHttp.ts";

function fixture(options = {}) {
  let now = 2_000_000;
  const data = new Map();
  const minted = [];
  let queue = Promise.resolve();
  const dependencies = {
    cleanSince: 1_000_000, now: () => now,
    userCreatedAt: async uid => uid === "source" || uid === "legacy" ? 100 : 1_500_000,
    mintToken: async uid => { minted.push(uid); return `test-custom-token:${uid}`; },
    // Serializable, rollback-capable store. Exercises production service code, not copied predicates.
    transaction(fn) {
      const result = queue.then(async () => {
        const writes = new Map();
        const result = await fn({ get: async path => structuredClone(data.get(path)), set: (path, value) => writes.set(path, structuredClone(value)) });
        for (const [path, value] of writes) data.set(path, value);
        return result;
      });
      queue = result.catch(() => {});
      return result;
    }, ...options,
  };
  const service = deviceLinkService(dependencies);
  return { service, data, minted, restart: () => deviceLinkService(dependencies), advance: ms => { now += ms; } };
}
const rejects = (promise, status) => assert.rejects(promise, error => error.status === status);
async function approved(f) {
  const r = await f.service.create("target", true, "Desktop Browser");
  await f.service.approve("source", r.requestId, true);
  return r;
}

test("same approved UID on destination; source data and permissions remain byte-for-byte unchanged", async () => {
  const f = fixture();
  const records = {
    "rooms/one": { ownerUid: "source", archived: false },
    "rooms/one/members/source": { name: "เจม", emoji: "🐻", availableDates: ["2026-11-01"] },
    "rooms/two/members/source": { name: "เจม", budgetMax: 3000 },
    "rooms/one/votes/source": { stayId: "place" },
    "rooms/one/activities/post": { createdBy: "source" },
    "rooms/one/activityComments/comment": { authorUid: "source" },
    "rooms/one/financeSettings/main": { managerUids: ["source"] },
    "rooms/one/payments/payment": { submittedBy: "source", status: "approved" },
    "rooms/one/ledgerEntries/entry": { approvedBy: "source", amountSatang: 12300 },
  };
  for (const entry of Object.entries(records)) f.data.set(...entry);
  const r = await approved(f);
  const result = await f.service.claim("target", r.requestId, r.claimSecret, identityTag("source"));
  assert.equal(result.approvedUid, "source");
  assert.equal(result.customToken, "test-custom-token:source");
  assert.deepEqual(f.minted, ["source"]);
  for (const [path, value] of Object.entries(records)) assert.deepEqual(f.data.get(path), value);
  assert.equal(f.data.has("rooms/one/members/target"), false);
});

test("QR lookup and status expose no secret, custom token, or source UID", async () => {
  const f = fixture();
  const r = await f.service.create("target", true, "Browser");
  assert.match(r.requestId, /^[a-f0-9]{48}$/);
  assert.match(r.claimSecret, /^[a-f0-9]{64}$/);
  assert.equal(r.expiresAt - r.serverNow, 300000);
  const internal = f.data.get(`deviceLinkRequests/${r.requestId}`);
  assert.equal(internal.claimSecret, undefined);
  assert.equal(internal.claimSecretHash, hashSecret(r.claimSecret));
  for (const response of [await f.service.lookup("source", r.code), await f.service.lookup("source", r.requestId), await f.service.status("target", r.requestId, r.claimSecret)]) {
    for (const field of ["claimSecret", "claimSecretHash", "targetTemporaryUid", "approvedSourceUid", "customToken"]) assert.equal(response[field], undefined);
  }
});

test("invalid request, incorrect code and non-source session do not authorize", async () => {
  const f = fixture();
  await rejects(f.service.lookup("source", "bad"), 404);
  await rejects(f.service.lookup("source", "999999"), 404);
  const r = await f.service.create("target", true, "Browser");
  await rejects(f.service.approve("target", r.requestId, true), 403);
  await rejects(f.service.approve("fresh-empty", r.requestId, true), 403);
  await rejects(f.service.lookup("fresh-empty", r.code), 403);
  await rejects(f.service.claim("target", r.requestId, r.claimSecret), 409);
});

test("an owner who has not chosen a display name can authorize its existing identity", async () => {
  const f = fixture();
  f.data.set("identityGuards/owner", { used: true, lockedUntil: 0 });
  const r = await f.service.create("target", true, "Browser");
  assert.equal((await f.service.lookup("owner", r.code)).code, r.code);
  await f.service.approve("owner", r.requestId, true);
  assert.equal((await f.service.claim("target", r.requestId, r.claimSecret, identityTag("owner"))).approvedUid, "owner");
});

test("destination must bind claim to the source identity label it reviewed", async () => {
  const f = fixture(); const r = await approved(f);
  const status = await f.service.status("target", r.requestId, r.claimSecret);
  assert.equal(status.approvedAccount.identityTag, identityTag("source"));
  await rejects(f.service.claim("target", r.requestId, r.claimSecret, identityTag("attacker")), 409);
  await rejects(f.service.claim("target", r.requestId, r.claimSecret), 409);
  assert.deepEqual(f.minted, []);
  const h = httpFixture(f);
  assert.equal((await h.call("claim", "target", { requestId: r.requestId, claimSecret: r.claimSecret })).status, 400);
  assert.equal((await f.service.claim("target", r.requestId, r.claimSecret, status.approvedAccount.identityTag)).approvedUid, "source");
});

test("destination UID AND secret required for status, cancel and claim", async () => {
  const f = fixture(); const r = await approved(f);
  for (const action of ["status", "cancel", "claim"]) {
    await rejects(f.service[action]("other", r.requestId, r.claimSecret), 403);
    await rejects(f.service[action]("target", r.requestId, "a".repeat(64)), 403);
    await rejects(f.service[action]("target", r.requestId, undefined), 403);
  }
  assert.deepEqual(f.minted, []);
});

test("expiration enforced at exactly five minutes, including after approval", async () => {
  const f = fixture(); const r = await approved(f); f.advance(300000);
  await rejects(f.service.claim("target", r.requestId, r.claimSecret), 410);
  assert.equal((await f.service.status("target", r.requestId, r.claimSecret)).status, "expired");
  await rejects(f.service.lookup("source", r.code), 404);
});

test("cancelled and denied requests never mint tokens", async () => {
  for (const cancel of [true, false]) {
    const f = fixture(); const r = await f.service.create("target", true, "Browser");
    if (cancel) await f.service.cancel("target", r.requestId, r.claimSecret);
    else await f.service.approve("source", r.requestId, false);
    await rejects(f.service.claim("target", r.requestId, r.claimSecret), 409);
    await rejects(f.service.approve("source", r.requestId, true), 409);
    assert.deepEqual(f.minted, []);
  }
});

test("two concurrent claims return exactly one token; replay and reapproval blocked", async () => {
  const f = fixture(); const r = await approved(f);
  const outcomes = await Promise.allSettled([f.service.claim("target", r.requestId, r.claimSecret, identityTag("source")), f.service.claim("target", r.requestId, r.claimSecret, identityTag("source"))]);
  assert.equal(outcomes.filter(o => o.status === "fulfilled").length, 1);
  assert.equal(outcomes.filter(o => o.status === "rejected").length, 1);
  await assert.rejects(f.service.claim("target", r.requestId, r.claimSecret, identityTag("source")));
  await rejects(f.service.approve("source", r.requestId, true), 409);
  assert.equal(f.data.get(`deviceLinkRequests/${r.requestId}`).status, "consumed");
});

test("signer failure is retryable; network loss AFTER consume requires a new request", async () => {
  let fail = true;
  const f = fixture({ mintToken: async () => { if (fail) throw new Error("private credential error"); return "token"; } });
  const r = await approved(f);
  await assert.rejects(f.service.claim("target", r.requestId, r.claimSecret, identityTag("source")));
  assert.equal(f.data.get(`deviceLinkRequests/${r.requestId}`).status, "approved");
  fail = false; await f.service.claim("target", r.requestId, r.claimSecret, identityTag("source"));
  await assert.rejects(f.service.claim("target", r.requestId, r.claimSecret));
});

test("used identity, legacy destination, non-anonymous session and missing safety cutoff fail closed", async () => {
  const f = fixture();
  f.data.set("identityGuards/target", { used: true, lockedUntil: 0 });
  await rejects(f.service.create("target", true, "Browser"), 409);
  await rejects(f.service.create("legacy", true, "Browser"), 409);
  await rejects(f.service.create("new", false, "Browser"), 409);
  await rejects(fixture({ cleanSince: NaN }).service.create("new", true, "Browser"), 503);
  assert.equal(f.data.has("deviceLinkRequests"), false);
});

test("durable limits survive service instances and bound create and lookup abuse", async () => {
  const f = fixture();
  for (let i = 0; i < 3; i++) await f.service.rateLimit("target", "create");
  await rejects(f.restart().rateLimit("target", "create"), 429);
  for (let i = 0; i < 10; i++) await f.service.rateLimit("source", "lookup");
  await rejects(f.service.rateLimit("source", "lookup"), 429);
  f.advance(600000); await f.service.rateLimit("target", "create");
  assert.ok([...f.data.keys()].some(k => k.startsWith("deviceLinkLimits/")));
});

test("global daily budget cannot be bypassed with new anonymous UIDs", async () => {
  const f = fixture();
  for (let i = 0; i < 25; i++) await f.service.rateLimit(`new-${i}`, "create");
  await rejects(f.restart().rateLimit("new-26", "create"), 429);
  f.data.set("deviceLinkLimits/global-0", { total: 3000 });
  await rejects(f.service.rateLimit("new-session", "status"), 429);
});

function httpFixture(f = fixture()) {
  const backend = () => ({ service: f.service, verify: async token => {
    if (!["source", "target"].includes(token)) throw new Error("sensitive ID token");
    return { uid: token, anonymous: true };
  } });
  const request = (action, token, body = {}, headers = {}) => new Request(`https://honeytrip.test/api/device-link/${action}`, {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...headers }, body: JSON.stringify(body),
  });
  return { request, call: (action, token, body, headers) => deviceLinkHttp(action, backend)(request(action, token, body, headers)) };
}

test("HTTP token validation, cross-origin rejection, no-cache, malformed input and sanitized backend failures", async () => {
  const h = httpFixture();
  assert.equal((await h.call("create", "invalid")).status, 401);
  assert.equal((await h.call("create", "target", {}, { Origin: "https://evil.test" })).status, 403);
  assert.equal((await h.call("create", "target", {}, { "Sec-Fetch-Site": "cross-site" })).status, 403);
  assert.equal((await h.call("create", "target", [], {})).status, 400);
  assert.equal((await h.call("create", "target", { padding: "x".repeat(3000) })).status, 413);
  const missing = await deviceLinkHttp("create", () => { throw new Error("PRIVATE_KEY=secret"); })(h.request("create", "target"));
  assert.equal(missing.status, 503); assert.ok(!(await missing.text()).includes("PRIVATE_KEY"));
  assert.equal(missing.headers.get("cache-control"), "no-store, private");
  const broken = httpFixture(fixture({ transaction: async () => { throw new Error("private Firestore backend details"); } }));
  const failed = await broken.call("create", "target");
  assert.equal(failed.status, 503); assert.ok(!(await failed.text()).includes("private Firestore"));
  const noAuth = h.request("create", "target"); noAuth.headers.delete("authorization");
  assert.equal((await deviceLinkHttp("create", () => { throw new Error(); })(noAuth)).status, 401);
});

test("HTTP forged uid is ignored; tokens issued only for authenticated approving identity", async () => {
  const h = httpFixture();
  const r = await (await h.call("create", "target", { uid: "victim" })).json();
  const approved = await h.call("approve", "source", { requestId: r.requestId, allow: true, uid: "victim", approvedSourceUid: "victim" });
  assert.equal(approved.status, 200);
  const claim = await h.call("claim", "target", { requestId: r.requestId, claimSecret: r.claimSecret, expectedIdentityTag: identityTag("source"), uid: "victim" });
  assert.equal(claim.status, 200);
  const result = await claim.json(); assert.equal(result.approvedUid, "source");
});

test("origin check uses actual request host when Next normalizes a loopback URL", async () => {
  const h = httpFixture();
  const good = await h.call("lookup", "source", { code: "bad" }, { Host: "127.0.0.1:3108", Origin: "https://127.0.0.1:3108" });
  assert.equal(good.status, 404); // Passed origin validation; invalid lookup remained unauthorized.
  const bad = await h.call("lookup", "source", { code: "bad" }, { Host: "127.0.0.1:3108", Origin: "https://honeytrip.test" });
  assert.equal(bad.status, 403);
});
