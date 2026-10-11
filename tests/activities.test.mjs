import test from "node:test";
import assert from "node:assert/strict";

import {
  calculateInclusiveDays,
  getDateRangeArray,
  getDayNumber,
  isDateInRange,
  isValidDateKey,
  validateTripDateRange,
  getBangkokTodayKey,
  sortActivitiesChronologically,
  getConfirmedActivitiesOutsideRange,
} from "../lib/activityDates.ts";

import {
  calculateActivityCost,
  calculatePlanBudget,
  detectScheduleConflicts,
  generateLineItinerarySummary,
} from "../lib/activityStats.ts";

test("Activity Dates & Timezone Logic", async (t) => {
  await t.test("isValidDateKey validates standard date strings", () => {
    assert.equal(isValidDateKey("2026-11-08"), true);
    assert.equal(isValidDateKey("2026-02-28"), true);
    assert.equal(isValidDateKey("2026-02-31"), false); // Invalid date
    assert.equal(isValidDateKey("invalid"), false);
    assert.equal(isValidDateKey(null), false);
    assert.equal(isValidDateKey(undefined), false);
  });

  await t.test("getBangkokTodayKey returns valid YYYY-MM-DD", () => {
    const today = getBangkokTodayKey();
    assert.equal(isValidDateKey(today), true);
  });

  await t.test("validateTripDateRange handles edge cases", () => {
    assert.deepEqual(validateTripDateRange("2026-11-08", "2026-11-11"), { valid: true });
    assert.deepEqual(validateTripDateRange("2026-11-08", "2026-11-08"), { valid: true });
    assert.equal(validateTripDateRange("2026-11-11", "2026-11-08").valid, false);
    assert.equal(validateTripDateRange(null, "2026-11-08").valid, false);
    assert.equal(validateTripDateRange("2026-11-08", null).valid, false);
  });

  await t.test("calculateInclusiveDays computes inclusive duration correctly", () => {
    assert.equal(calculateInclusiveDays("2026-11-08", "2026-11-08"), 1);
    assert.equal(calculateInclusiveDays("2026-11-08", "2026-11-10"), 3);
    assert.equal(calculateInclusiveDays("2026-11-08", "2026-11-11"), 4);
    assert.equal(calculateInclusiveDays("2026-11-10", "2026-11-08"), 0);
  });

  await t.test("getDateRangeArray generates full array of dates", () => {
    const dates = getDateRangeArray("2026-11-08", "2026-11-10");
    assert.deepEqual(dates, ["2026-11-08", "2026-11-09", "2026-11-10"]);
    assert.deepEqual(getDateRangeArray("2026-11-08", "2026-11-08"), ["2026-11-08"]);
    assert.deepEqual(getDateRangeArray(null, null), []);
  });

  await t.test("getDayNumber calculates 1-indexed day correctly", () => {
    assert.equal(getDayNumber("2026-11-08", "2026-11-08"), 1);
    assert.equal(getDayNumber("2026-11-09", "2026-11-08"), 2);
    assert.equal(getDayNumber("2026-11-11", "2026-11-08"), 4);
    assert.equal(getDayNumber("2026-11-08", null), null);
  });

  await t.test("isDateInRange verifies boundaries correctly", () => {
    assert.equal(isDateInRange("2026-11-08", "2026-11-08", "2026-11-11"), true);
    assert.equal(isDateInRange("2026-11-10", "2026-11-08", "2026-11-11"), true);
    assert.equal(isDateInRange("2026-11-11", "2026-11-08", "2026-11-11"), true);
    assert.equal(isDateInRange("2026-11-07", "2026-11-08", "2026-11-11"), false);
    assert.equal(isDateInRange("2026-11-12", "2026-11-08", "2026-11-11"), false);
  });

  await t.test("getConfirmedActivitiesOutsideRange warns about orphaned activities", () => {
    const activities = [
      { id: "1", date: "2026-11-05", status: "confirmed" },
      { id: "2", date: "2026-11-09", status: "confirmed" },
      { id: "3", date: "2026-11-15", status: "confirmed" },
      { id: "4", date: "2026-11-05", status: "proposed" }, // proposed should be ignored
    ];
    const outside = getConfirmedActivitiesOutsideRange(activities, "2026-11-08", "2026-11-11");
    assert.equal(outside.length, 2);
    assert.equal(outside[0].id, "1");
    assert.equal(outside[1].id, "3");
  });

  await t.test("sortActivitiesChronologically preserves stable order", () => {
    const list = [
      { id: "3", date: "2026-11-09", startTime: "14:00", createdAt: 100 },
      { id: "1", date: "2026-11-08", startTime: "10:00", createdAt: 100 },
      { id: "2", date: "2026-11-08", startTime: "12:00", createdAt: 100 },
      { id: "4", date: "2026-11-08", startTime: "10:00", createdAt: 200 }, // same time, later createdAt
      { id: "5", date: null, startTime: null, createdAt: 50 },
    ];
    const sorted = sortActivitiesChronologically(list);
    assert.equal(sorted[0].id, "1");
    assert.equal(sorted[1].id, "4");
    assert.equal(sorted[2].id, "2");
    assert.equal(sorted[3].id, "3");
    assert.equal(sorted[4].id, "5");
  });
});

test("Budget Engine & Cost Calculation Tests", async (t) => {
  await t.test("calculateActivityCost handles per_person mode", () => {
    const act = {
      id: "a1",
      cost: { mode: "per_person", amount: 250, currency: "THB" },
      participantUids: ["u1", "u2", "u3", "u4"],
    };
    const res = calculateActivityCost(act);
    assert.equal(res.totalCost, 1000);
    assert.equal(res.costPerParticipant, 250);
    assert.equal(res.participantCount, 4);
    assert.equal(res.isUnknown, false);
    assert.equal(res.isFree, false);
  });

  await t.test("calculateActivityCost handles split_total mode", () => {
    const act = {
      id: "a2",
      cost: { mode: "split_total", amount: 2400, currency: "THB" },
      participantUids: ["u1", "u2", "u3", "u4", "u5", "u6"],
    };
    const res = calculateActivityCost(act);
    assert.equal(res.totalCost, 2400);
    assert.equal(res.costPerParticipant, 400);
    assert.equal(res.participantCount, 6);
  });

  await t.test("calculateActivityCost handles split_total with 0 participants safely", () => {
    const act = {
      id: "a3",
      cost: { mode: "split_total", amount: 2400, currency: "THB" },
      participantUids: [],
    };
    const res = calculateActivityCost(act);
    assert.equal(res.totalCost, 2400);
    assert.equal(res.costPerParticipant, 0);
  });

  await t.test("calculateActivityCost handles duplicate participants correctly", () => {
    const act = {
      id: "a4",
      cost: { mode: "per_person", amount: 100, currency: "THB" },
      participantUids: ["u1", "u1", "u2", "u2"],
    };
    const res = calculateActivityCost(act);
    assert.equal(res.participantCount, 2);
    assert.equal(res.totalCost, 200);
    assert.equal(res.costPerParticipant, 100);
  });

  await t.test("calculateActivityCost handles free and unknown modes", () => {
    const freeAct = {
      id: "a5",
      cost: { mode: "free", amount: null, currency: "THB" },
      participantUids: ["u1"],
    };
    assert.equal(calculateActivityCost(freeAct).isFree, true);
    assert.equal(calculateActivityCost(freeAct).totalCost, 0);

    const unknownAct = {
      id: "a6",
      cost: { mode: "unknown", amount: null, currency: "THB" },
      participantUids: ["u1"],
    };
    assert.equal(calculateActivityCost(unknownAct).isUnknown, true);
    assert.equal(calculateActivityCost(unknownAct).totalCost, 0);
  });

  await t.test("calculatePlanBudget aggregates only confirmed & completed activities", () => {
    const members = [{ id: "u1" }, { id: "u2" }, { id: "u3" }];
    const activities = [
      {
        id: "1",
        status: "confirmed",
        date: "2026-11-08",
        cost: { mode: "per_person", amount: 100, currency: "THB" },
        participantUids: ["u1", "u2"],
      },
      {
        id: "2",
        status: "completed",
        date: "2026-11-08",
        cost: { mode: "split_total", amount: 600, currency: "THB" },
        participantUids: ["u1", "u2", "u3"],
      },
      {
        id: "3",
        status: "proposed", // ignored
        date: "2026-11-09",
        cost: { mode: "per_person", amount: 500, currency: "THB" },
        participantUids: ["u1"],
      },
      {
        id: "4",
        status: "cancelled", // ignored
        date: "2026-11-09",
        cost: { mode: "per_person", amount: 500, currency: "THB" },
        participantUids: ["u1"],
      },
      {
        id: "5",
        status: "confirmed",
        date: "2026-11-09",
        cost: { mode: "unknown", amount: null, currency: "THB" },
        participantUids: ["u1"],
      },
    ];

    const budget = calculatePlanBudget(activities, members);
    // Act 1: 100 * 2 = 200 (u1: 100, u2: 100)
    // Act 2: 600 total (u1: 200, u2: 200, u3: 200)
    // Total = 800
    assert.equal(budget.totalEstimated, 800);
    assert.equal(budget.confirmedCount, 2);
    assert.equal(budget.completedCount, 1);
    assert.equal(budget.proposedCount, 1);
    assert.equal(budget.cancelledCount, 1);
    assert.equal(budget.unknownCostCount, 1);

    // byParticipant
    assert.equal(budget.byParticipant["u1"], 300);
    assert.equal(budget.byParticipant["u2"], 300);
    assert.equal(budget.byParticipant["u3"], 200);

    // byDate
    assert.equal(budget.byDate["2026-11-08"], 800);
    assert.equal(budget.byDate["2026-11-09"] || 0, 0);
  });
});

test("Schedule Conflict Detection", async (t) => {
  await t.test("detects overlapping activities with time spans", () => {
    const activities = [
      {
        id: "a1",
        title: "ดำน้ำเกาะล้าน",
        status: "confirmed",
        date: "2026-11-08",
        startTime: "10:00",
        endTime: "12:00",
        participantUids: ["u1", "u2"],
      },
      {
        id: "a2",
        title: "กินข้าวริมหาด",
        status: "confirmed",
        date: "2026-11-08",
        startTime: "11:00",
        endTime: "13:00",
        participantUids: ["u1", "u3"],
      },
      {
        id: "a3",
        title: "คาเฟ่ชมวิว",
        status: "confirmed",
        date: "2026-11-08",
        startTime: "14:00",
        endTime: "15:00",
        participantUids: ["u1"],
      },
    ];

    const conflicts = detectScheduleConflicts(activities);
    assert.equal(conflicts.has("a1"), true);
    assert.equal(conflicts.has("a2"), true);
    assert.equal(conflicts.has("a3"), false);

    const a1Conflicts = conflicts.get("a1");
    assert.equal(a1Conflicts.length, 1);
    assert.equal(a1Conflicts[0].conflictingActivityId, "a2");
    assert.equal(a1Conflicts[0].sharedParticipantCount, 1); // u1 is shared
  });

  await t.test("does not report conflict for different dates", () => {
    const activities = [
      {
        id: "a1",
        title: "กิจกรรม 1",
        status: "confirmed",
        date: "2026-11-08",
        startTime: "10:00",
        endTime: "12:00",
      },
      {
        id: "a2",
        title: "กิจกรรม 2",
        status: "confirmed",
        date: "2026-11-09",
        startTime: "10:00",
        endTime: "12:00",
      },
    ];
    const conflicts = detectScheduleConflicts(activities);
    assert.equal(conflicts.size, 0);
  });
});

test("LINE Itinerary Summary Generator", async (t) => {
  await t.test("formats readable Thai summary correctly", () => {
    const meta = {
      startDate: "2026-11-08",
      endDate: "2026-11-09",
      timezone: "Asia/Bangkok",
      status: "confirmed",
      updatedBy: "u1",
      updatedAt: 1234,
    };
    const activities = [
      {
        id: "1",
        title: "ออกเดินทาง",
        category: "transport",
        status: "confirmed",
        date: "2026-11-08",
        startTime: "08:00",
        cost: { mode: "free", amount: null, currency: "THB" },
      },
      {
        id: "2",
        title: "กินส้มตำแซ่บ",
        category: "food",
        status: "confirmed",
        date: "2026-11-08",
        startTime: "12:00",
        cost: { mode: "split_total", amount: 600, currency: "THB" },
        participantUids: ["u1", "u2"],
      },
      {
        id: "3",
        title: "ไอเดียที่ยังไม่คอนเฟิร์ม",
        category: "attraction",
        status: "proposed", // should be excluded
        date: "2026-11-08",
        startTime: "15:00",
        cost: { mode: "unknown", amount: null, currency: "THB" },
      },
    ];

    const summary = generateLineItinerarySummary({
      roomTitle: "พัทยาพาเพลิน",
      meta,
      activities,
      planUrl: "https://honeytrip.app/t/room123/plan",
    });

    assert.match(summary, /HoneyTrip — แผนเที่ยวพัทยาพาเพลิน/);
    assert.match(summary, /DAY 1/);
    assert.match(summary, /08:00 🚗 ออกเดินทาง/);
    assert.match(summary, /12:00 🍜 กินส้มตำแซ่บ/);
    assert.doesNotMatch(summary, /ไอเดียที่ยังไม่คอนเฟิร์ม/);
    assert.match(summary, /งบประมาณโดยประมาณ/);
    assert.match(summary, /https:\/\/honeytrip.app\/t\/room123\/plan/);
  });
});

test("Edge Cases & Robustness Tests", async (t) => {
  await t.test("handles fractional division cleanly in split_total", () => {
    const act = {
      id: "split-uneven",
      cost: { mode: "split_total", amount: 1000, currency: "THB" },
      participantUids: ["u1", "u2", "u3"],
    };
    const breakdown = calculateActivityCost(act);
    assert.equal(breakdown.totalCost, 1000);
    assert.equal(Math.round(breakdown.costPerParticipant), 333);
  });

  await t.test("handles negative amount or NaN by sanitizing to 0", () => {
    const act = {
      id: "neg",
      cost: { mode: "per_person", amount: -500, currency: "THB" },
      participantUids: ["u1"],
    };
    const breakdown = calculateActivityCost(act);
    assert.equal(breakdown.totalCost, 0);
  });

  await t.test("preserves place snapshot information when placeId is orphan", () => {
    const act = {
      id: "act-orphan-place",
      title: "ร้านกาแฟริมทะเล",
      placeId: "deleted-place-id-999",
      placeSnapshot: {
        name: "คาเฟ่ลับริมหาด",
        location: "พัทยาเหนือ ซอย 5",
        externalUrl: "https://maps.google.com/test",
      },
    };
    assert.equal(act.placeSnapshot.name, "คาเฟ่ลับริมหาด");
    assert.equal(act.placeSnapshot.location, "พัทยาเหนือ ซอย 5");
  });

  await t.test("generates LINE summary safely even with long Thai text and empty meta", () => {
    const summary = generateLineItinerarySummary({
      roomTitle: "ทริปเที่ยวทั่วไทยที่มีชื่อห้องยาวมากๆ เพื่อทดสอบว่าระบบจะทำงานได้ปกติหรือไม่โดยไม่มีข้อผิดพลาด",
      meta: null,
      activities: [],
      planUrl: "https://honeytrip.app/t/room/plan",
    });
    assert.match(summary, /HoneyTrip — แผนเที่ยว/);
    assert.match(summary, /ยังไม่กำหนดวันเดินทาง/);
    assert.match(summary, /ยังไม่มีกิจกรรมที่ยืนยันในตารางเที่ยว/);
  });

  await t.test("prioritizes shared participant conflicts over disjoint conflicts", () => {
    const activities = [
      {
        id: "a1",
        title: "เล่นสวนน้ำ",
        status: "confirmed",
        date: "2026-11-08",
        startTime: "10:00",
        endTime: "13:00",
        participantUids: ["u1", "u2"],
      },
      {
        id: "a2",
        title: "ช้อปปิ้งตลาด",
        status: "confirmed",
        date: "2026-11-08",
        startTime: "11:00",
        endTime: "12:00",
        participantUids: ["u3", "u4"], // Disjoint: 0 shared
      },
      {
        id: "a3",
        title: "ขับเจ็ตสกี",
        status: "confirmed",
        date: "2026-11-08",
        startTime: "11:30",
        endTime: "12:30",
        participantUids: ["u1"], // Shared with a1: 1 shared
      },
    ];

    const conflicts = detectScheduleConflicts(activities);
    const a1Conflicts = conflicts.get("a1");
    assert.equal(a1Conflicts.length, 2);
    // The conflict with shared participants (a3) must come first!
    assert.equal(a1Conflicts[0].conflictingActivityId, "a3");
    assert.equal(a1Conflicts[0].sharedParticipantCount, 1);
    assert.equal(a1Conflicts[1].conflictingActivityId, "a2");
    assert.equal(a1Conflicts[1].sharedParticipantCount, 0);
  });

  await t.test("ignores invalid end time when endTime <= startTime", () => {
    const activities = [
      {
        id: "b1",
        title: "กิจกรรมผิดเวลา",
        status: "confirmed",
        date: "2026-11-08",
        startTime: "14:00",
        endTime: "12:00", // invalid end time earlier than start
      },
      {
        id: "b2",
        title: "กิจกรรมปกติ",
        status: "confirmed",
        date: "2026-11-08",
        startTime: "15:00",
        endTime: "16:00",
      },
    ];
    const conflicts = detectScheduleConflicts(activities);
    // Because b1's end time is invalid, it is treated as null, so b1 (14:00) does not conflict with b2 (15:00)
    assert.equal(conflicts.has("b1"), false);
  });

  await t.test("correctly excludes non-participants from activity cost allocations", () => {
    const members = [{ id: "u1" }, { id: "u2" }, { id: "u3" }];
    const activities = [
      {
        id: "p1",
        status: "confirmed",
        date: "2026-11-08",
        cost: { mode: "split_total", amount: 1200, currency: "THB" },
        participantUids: ["u1", "u2"], // u3 does NOT participate
      },
    ];
    const budget = calculatePlanBudget(activities, members);
    assert.equal(budget.byParticipant["u1"], 600);
    assert.equal(budget.byParticipant["u2"], 600);
    assert.equal(budget.byParticipant["u3"], 0); // Excluded!
  });

  await t.test("validates leap years and non-leap years accurately", () => {
    assert.equal(isValidDateKey("2028-02-29"), true); // 2028 is leap year
    assert.equal(isValidDateKey("2026-02-29"), false); // 2026 is NOT leap year
  });

  await t.test("handles custom emoji without duplicating 🍯 in LINE summary", () => {
    const summaryWithCustom = generateLineItinerarySummary({
      roomTitle: "เกาะช้าง",
      roomEmoji: "🏝️",
      meta: null,
      activities: [],
      planUrl: "https://test.com",
    });
    assert.match(summaryWithCustom, /🏝️ HoneyTrip — แผนเที่ยวเกาะช้าง/);

    const summaryWithHoney = generateLineItinerarySummary({
      roomTitle: "เกาะช้าง",
      roomEmoji: "🍯",
      meta: null,
      activities: [],
      planUrl: "https://test.com",
    });
    assert.match(summaryWithHoney, /🍯 HoneyTrip — แผนเที่ยวเกาะช้าง/);
    assert.doesNotMatch(summaryWithHoney, /🍯 🍯/);
  });
});

