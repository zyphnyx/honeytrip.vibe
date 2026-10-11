import test from "node:test";
import assert from "node:assert/strict";

import {
  formatBackupFileName,
  validateBackupStructure,
} from "../lib/backupPure.ts";

/**
 * Pure simulation of Firestore Security Rules logic for rooms and subcollections
 */
function simulateRoomCreateRule(authUid, data) {
  if (!authUid) return { allowed: false, reason: "Unauthenticated" };
  const allowedKeys = new Set([
    "title",
    "emoji",
    "createdAt",
    "ownerUid",
    "archived",
    "archivedAt",
    "archivedBy",
  ]);
  for (const k of Object.keys(data)) {
    if (!allowedKeys.has(k)) return { allowed: false, reason: `Unknown key ${k}` };
  }
  if (typeof data.title !== "string" || data.title.length === 0 || data.title.length > 60) {
    return { allowed: false, reason: "Invalid title length" };
  }
  if (typeof data.emoji !== "string" || data.emoji.length > 8) {
    return { allowed: false, reason: "Invalid emoji" };
  }
  if (typeof data.createdAt !== "number") {
    return { allowed: false, reason: "Invalid createdAt" };
  }
  if (data.ownerUid !== authUid) {
    return { allowed: false, reason: "ownerUid must match authenticated user" };
  }
  return { allowed: true };
}

function simulateRoomUpdateRule(authUid, existingDoc, updateData) {
  if (!authUid) return { allowed: false, reason: "Unauthenticated" };
  if (!existingDoc.ownerUid || existingDoc.ownerUid !== authUid) {
    return { allowed: false, reason: "Only verified owner can update room" };
  }

  // Check affected keys: only archived, archivedAt, archivedBy
  const affected = Object.keys(updateData);
  const allowedUpdateKeys = new Set(["archived", "archivedAt", "archivedBy"]);
  for (const k of affected) {
    if (!allowedUpdateKeys.has(k)) {
      return { allowed: false, reason: `Field ${k} is immutable` };
    }
  }

  // Check immutable fields cannot be overwritten
  if ("ownerUid" in updateData && updateData.ownerUid !== existingDoc.ownerUid) {
    return { allowed: false, reason: "Cannot change ownerUid" };
  }
  if ("title" in updateData && updateData.title !== existingDoc.title) {
    return { allowed: false, reason: "Cannot change title through archive update" };
  }

  if (typeof updateData.archived !== "boolean") {
    return { allowed: false, reason: "archived must be boolean" };
  }

  if (updateData.archived === true) {
    if (updateData.archivedBy !== authUid) {
      return { allowed: false, reason: "archivedBy must match user" };
    }
  } else {
    if (updateData.archivedAt !== null || updateData.archivedBy !== null) {
      return { allowed: false, reason: "restore must clear archive metadata" };
    }
  }

  return { allowed: true };
}

function simulateRoomDeleteRule(authUid) {
  void authUid;
  // allow delete: if false;
  return { allowed: false, reason: "Room deletion is permanently forbidden from client SDK" };
}

function simulateSubcollectionMutationRule(authUid, roomDoc, action, itemOwnerUid) {
  if (!authUid) return { allowed: false, reason: "Unauthenticated" };
  if (roomDoc.archived === true) {
    return { allowed: false, reason: "Room is archived (read-only)" };
  }
  if (action === "delete_member") {
    if (itemOwnerUid !== authUid) return { allowed: false, reason: "Cannot delete other members" };
  }
  if (action === "delete_comment") {
    if (itemOwnerUid !== authUid && roomDoc.ownerUid !== authUid) {
      return { allowed: false, reason: "Only author or room owner can delete comment" };
    }
  }
  return { allowed: true };
}

test("Data Protection & Authorization Rules Simulation", async (t) => {
  await t.test("Room creation enforces ownerUid matching creator UID", () => {
    const valid = simulateRoomCreateRule("user_123", {
      title: "ทริปหัวหิน",
      emoji: "🏖️",
      createdAt: 1700000000,
      ownerUid: "user_123",
      archived: false,
      archivedAt: null,
      archivedBy: null,
    });
    assert.equal(valid.allowed, true);

    const forgedOwner = simulateRoomCreateRule("user_123", {
      title: "ทริปหัวหิน",
      emoji: "🏖️",
      createdAt: 1700000000,
      ownerUid: "hacker_999", // Attempting to spoof owner
    });
    assert.equal(forgedOwner.allowed, false);
  });

  await t.test("Room deletion is rejected for all browser clients", () => {
    assert.equal(simulateRoomDeleteRule("user_123").allowed, false);
    assert.equal(simulateRoomDeleteRule("admin_owner").allowed, false);
    assert.equal(simulateRoomDeleteRule(null).allowed, false);
  });

  await t.test("Owner can archive and restore room", () => {
    const activeRoom = {
      title: "ทริปพัทยา",
      emoji: "🌊",
      createdAt: 1700000000,
      ownerUid: "owner_abc",
      archived: false,
    };

    // Owner archives
    const archiveResult = simulateRoomUpdateRule("owner_abc", activeRoom, {
      archived: true,
      archivedAt: Date.now(),
      archivedBy: "owner_abc",
    });
    assert.equal(archiveResult.allowed, true);

    // Non-owner attempts to archive
    const nonOwnerResult = simulateRoomUpdateRule("guest_xyz", activeRoom, {
      archived: true,
      archivedAt: Date.now(),
      archivedBy: "guest_xyz",
    });
    assert.equal(nonOwnerResult.allowed, false);

    // Owner restores
    const restoreResult = simulateRoomUpdateRule("owner_abc", activeRoom, {
      archived: false,
      archivedAt: null,
      archivedBy: null,
    });
    assert.equal(restoreResult.allowed, true);
  });

  await t.test("Legacy room without ownerUid cannot be archived or hijacked by client", () => {
    const legacyRoom = {
      title: "ทริปเชียงใหม่ดั้งเดิม",
      emoji: "⛰️",
      createdAt: 1690000000,
      // no ownerUid
    };

    // Any random user tries to archive or assign themselves as owner
    const hijackResult = simulateRoomUpdateRule("first_viewer", legacyRoom, {
      archived: true,
      archivedAt: Date.now(),
      archivedBy: "first_viewer",
    });
    assert.equal(hijackResult.allowed, false);
  });

  await t.test("Malicious client cannot modify immutable core fields during archive", () => {
    const room = {
      title: "ทริปเดิม",
      emoji: "🏖️",
      createdAt: 1700000000,
      ownerUid: "owner_abc",
      archived: false,
    };

    const attempt = simulateRoomUpdateRule("owner_abc", room, {
      archived: true,
      archivedAt: Date.now(),
      archivedBy: "owner_abc",
      title: "ทริปเปลี่ยนชื่อแอบแฝง", // Immutable!
    });
    assert.equal(attempt.allowed, false);
  });

  await t.test("Archived room rejects all subcollection mutations (read-only mode)", () => {
    const archivedRoom = { ownerUid: "owner_abc", archived: true };
    const activeRoom = { ownerUid: "owner_abc", archived: false };

    // Mutation in archived room
    const blocked = simulateSubcollectionMutationRule("user_1", archivedRoom, "add_activity");
    assert.equal(blocked.allowed, false);
    assert.match(blocked.reason, /archived/);

    // Mutation in active room
    const allowed = simulateSubcollectionMutationRule("user_1", activeRoom, "add_activity");
    assert.equal(allowed.allowed, true);
  });

  await t.test("Members cannot delete other users' documents", () => {
    const activeRoom = { ownerUid: "owner_abc", archived: false };

    // User A tries to delete User B
    const badDelete = simulateSubcollectionMutationRule("user_A", activeRoom, "delete_member", "user_B");
    assert.equal(badDelete.allowed, false);

    // User A deletes own profile (leaving room)
    const selfDelete = simulateSubcollectionMutationRule("user_A", activeRoom, "delete_member", "user_A");
    assert.equal(selfDelete.allowed, true);
  });
});

test("Backup & Export Engine Tests", async (t) => {
  await t.test("formatBackupFileName generates correct sanitized filename", () => {
    const fixedDate = new Date("2026-10-11T12:00:00Z");
    const filename = formatBackupFileName("mktamzgvgb", fixedDate);
    assert.equal(filename, "honeytrip-backup-mktamzgvgb-2026-10-11.json");

    // Special characters sanitized
    const complexId = formatBackupFileName("room/../abc#123", fixedDate);
    assert.equal(complexId, "honeytrip-backup-roomabc123-2026-10-11.json");
  });

  await t.test("validateBackupStructure verifies valid complete backup", () => {
    const validBackup = {
      format: "honeytrip-backup",
      schemaVersion: 1,
      exportedAt: "2026-10-11T12:00:00Z",
      roomId: "mktamzgvgb",
      data: {
        room: { title: "ทริปเกาะล้าน", emoji: "🏝️", createdAt: 1700000000 },
        members: [{ id: "u1", name: "กานต์", emoji: "🐱" }],
        places: [{ id: "p1", name: "หาดตาแหวน" }],
        votes: [{ id: "u1", stayId: "p1" }],
        settings: [{ id: "general", destination: "เกาะล้าน" }],
        plan: [{ id: "meta", startDate: "2026-11-08", endDate: "2026-11-10" }],
        activities: [{ id: "a1", title: "นั่งเรือข้ามฟาก" }],
        activityComments: [{ id: "c1", body: "เจอกันที่ท่าเรือ" }],
      },
    };

    const res = validateBackupStructure(validBackup);
    assert.equal(res.valid, true);
    assert.deepEqual(res.counts, {
      members: 1,
      places: 1,
      votes: 1,
      settings: 1,
      plan: 1,
      activities: 1,
      activityComments: 1,
    });
  });

  await t.test("validateBackupStructure detects invalid or partial backups", () => {
    assert.equal(validateBackupStructure(null).valid, false);
    assert.equal(validateBackupStructure({}).valid, false);
    assert.equal(validateBackupStructure({ format: "wrong-format" }).valid, false);

    // Missing required subcollection array
    const partial = {
      format: "honeytrip-backup",
      schemaVersion: 1,
      roomId: "abc",
      data: {
        room: { title: "Test" },
        members: [],
        // places missing!
      },
    };
    const res = validateBackupStructure(partial);
    assert.equal(res.valid, false);
    assert.match(res.error, /places/);
  });

  await t.test("validateBackupStructure handles empty collections safely", () => {
    const emptyBackup = {
      format: "honeytrip-backup",
      schemaVersion: 1,
      exportedAt: "2026-10-11T12:00:00Z",
      roomId: "new_room",
      data: {
        room: { title: "ห้องว่างใหม่", emoji: "🍯", createdAt: 1700000000 },
        members: [],
        places: [],
        votes: [],
        settings: [],
        plan: [],
        activities: [],
        activityComments: [],
      },
    };

    const res = validateBackupStructure(emptyBackup);
    assert.equal(res.valid, true);
    assert.deepEqual(res.counts, {
      members: 0,
      places: 0,
      votes: 0,
      settings: 0,
      plan: 0,
      activities: 0,
      activityComments: 0,
    });
  });
});

test("Room Partitioning Logic (Active vs Archived)", async (t) => {
  await t.test("Correctly separates active trips and archived trips with legacy support", () => {
    const allRooms = [
      { id: "r1", title: "ทริป 1", archived: false },
      { id: "r2", title: "ทริป 2 (Legacy)", createdAt: 1690000000 }, // No archived field -> active
      { id: "r3", title: "ทริป 3 (Archived)", archived: true, archivedAt: 1700000000 },
      { id: "r4", title: "ทริป 4 (Archived)", archived: true, archivedAt: 1700000500 },
    ];

    const active = allRooms.filter((r) => !r.archived);
    const archived = allRooms.filter((r) => r.archived);

    assert.equal(active.length, 2);
    assert.equal(active[0].id, "r1");
    assert.equal(active[1].id, "r2"); // Legacy room preserved in active list!

    assert.equal(archived.length, 2);
    assert.equal(archived[0].id, "r3");
    assert.equal(archived[1].id, "r4");
  });
});
