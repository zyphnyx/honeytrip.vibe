import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateVotingResults, isMemberEligibleToVote } from "../lib/voting.ts";

describe("Voting Logic Tests", () => {
  const members = [
    {
      id: "u1",
      name: "สมชาย",
      emoji: "🦁",
      status: "going",
      durationMin: 2,
      durationMax: 3,
      budgetMin: 1000,
      budgetMax: 3000,
      availableDates: ["2026-11-01"],
      origin: "กทม",
      transport: "own_car",
      seats: 4,
      prefs: ["sea"],
      note: "",
      updatedAt: 1,
    },
    {
      id: "u2",
      name: "สมหญิง",
      emoji: "🌸",
      status: "maybe",
      durationMin: 2,
      durationMax: 4,
      budgetMin: 1500,
      budgetMax: 3500,
      availableDates: ["2026-11-01"],
      origin: "กทม",
      transport: "need_ride",
      seats: 0,
      prefs: ["cafe"],
      note: "",
      updatedAt: 2,
    },
    {
      id: "u3",
      name: "สมศักดิ์",
      emoji: "🚀",
      status: "out", // ไม่ไป -> ไม่มีสิทธิ์โหวต
      durationMin: 1,
      durationMax: 2,
      budgetMin: 500,
      budgetMax: 1000,
      availableDates: [],
      origin: "นนทบุรี",
      transport: "any",
      seats: 0,
      prefs: [],
      note: "",
      updatedAt: 3,
    },
  ];

  const places = [
    {
      id: "s1",
      category: "stay",
      source: "manual",
      name: "โรงแรมริมเล",
      createdBy: "u1",
      createdByName: "สมชาย",
      createdAt: 10,
      updatedAt: 10,
    },
    {
      id: "s2",
      category: "stay",
      source: "manual",
      name: "พูลวิลล่าภูเขา",
      createdBy: "u2",
      createdByName: "สมหญิง",
      createdAt: 20,
      updatedAt: 20,
    },
    {
      id: "a1",
      category: "attraction",
      source: "manual",
      name: "จุดชมวิวพระอาทิตย์ตก",
      createdBy: "u1",
      createdByName: "สมชาย",
      createdAt: 30,
      updatedAt: 30,
    },
    {
      id: "a2",
      category: "attraction",
      source: "manual",
      name: "คาเฟ่ริมหาด",
      createdBy: "u2",
      createdByName: "สมหญิง",
      createdAt: 40,
      updatedAt: 40,
    },
    {
      id: "a3",
      category: "attraction",
      source: "manual",
      name: "น้ำตก",
      createdBy: "u1",
      createdByName: "สมชาย",
      createdAt: 50,
      updatedAt: 50,
    },
    {
      id: "a4",
      category: "attraction",
      source: "manual",
      name: "ตลาดโต้รุ่ง",
      createdBy: "u2",
      createdByName: "สมหญิง",
      createdAt: 60,
      updatedAt: 60,
    },
  ];

  it("should check member eligibility correctly", () => {
    assert.equal(isMemberEligibleToVote(members[0]), true); // going
    assert.equal(isMemberEligibleToVote(members[1]), true); // maybe
    assert.equal(isMemberEligibleToVote(members[2]), false); // out
    assert.equal(isMemberEligibleToVote(null), false);
  });

  it("should calculate stay votes and exclude votes from 'out' members", () => {
    const votes = [
      { id: "u1", stayId: "s1", attractionIds: [], updatedAt: 100 },
      { id: "u2", stayId: "s1", attractionIds: [], updatedAt: 101 },
      { id: "u3", stayId: "s2", attractionIds: [], updatedAt: 102 }, // u3 is 'out' -> must be ignored!
    ];

    const results = calculateVotingResults(places, votes, members);

    assert.equal(results.eligibleVotersCount, 2);
    assert.equal(results.stayVotersCount, 2);
    assert.equal(results.stays[0].place.id, "s1");
    assert.equal(results.stays[0].votesCount, 2);
    assert.equal(results.stays[1].place.id, "s2");
    assert.equal(results.stays[1].votesCount, 0); // u3 was ignored
    assert.equal(results.isStayTie, false);
    assert.equal(results.leadingStays.length, 1);
    assert.equal(results.leadingStays[0].id, "s1");
  });

  it("should handle tie-breaking for stays correctly", () => {
    const votes = [
      { id: "u1", stayId: "s1", attractionIds: [], updatedAt: 100 },
      { id: "u2", stayId: "s2", attractionIds: [], updatedAt: 101 },
    ];

    const results = calculateVotingResults(places, votes, members);

    assert.equal(results.stayVotersCount, 2);
    assert.equal(results.isStayTie, true);
    assert.equal(results.leadingStays.length, 2);
    assert.deepEqual(
      results.leadingStays.map((s) => s.id),
      ["s1", "s2"],
    );
  });

  it("should enforce attraction voting up to 10 votes per member and count correctly", () => {
    const placesWith11Attrs = [
      ...places,
      { id: "a5", category: "attraction", source: "manual", name: "จุดชมวิว 5", createdBy: "u1", createdByName: "สมชาย", createdAt: 61, updatedAt: 61 },
      { id: "a6", category: "attraction", source: "manual", name: "จุดชมวิว 6", createdBy: "u1", createdByName: "สมชาย", createdAt: 62, updatedAt: 62 },
      { id: "a7", category: "attraction", source: "manual", name: "จุดชมวิว 7", createdBy: "u1", createdByName: "สมชาย", createdAt: 63, updatedAt: 63 },
      { id: "a8", category: "attraction", source: "manual", name: "จุดชมวิว 8", createdBy: "u1", createdByName: "สมชาย", createdAt: 64, updatedAt: 64 },
      { id: "a9", category: "attraction", source: "manual", name: "จุดชมวิว 9", createdBy: "u1", createdByName: "สมชาย", createdAt: 65, updatedAt: 65 },
      { id: "a10", category: "attraction", source: "manual", name: "จุดชมวิว 10", createdBy: "u1", createdByName: "สมชาย", createdAt: 66, updatedAt: 66 },
      { id: "a11", category: "attraction", source: "manual", name: "จุดชมวิว 11", createdBy: "u1", createdByName: "สมชาย", createdAt: 67, updatedAt: 67 },
    ];

    const votes = [
      // u1 โหวต a1 ถึง a11 (11 ที่ เกิน 10 -> โดน slice เหลือ 10 ที่แรก a1..a10)
      { id: "u1", stayId: null, attractionIds: ["a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9", "a10", "a11"], updatedAt: 100 },
      // u2 โหวต a1, a2
      { id: "u2", stayId: null, attractionIds: ["a1", "a2"], updatedAt: 101 },
    ];

    const results = calculateVotingResults(placesWith11Attrs, votes, members);

    assert.equal(results.attractionVotersCount, 2);
    
    // a1, a2 ได้คนละ 2 โหวต (u1, u2)
    const a1 = results.attractions.find((a) => a.place.id === "a1");
    const a2 = results.attractions.find((a) => a.place.id === "a2");
    assert.equal(a1.votesCount, 2);
    assert.equal(a2.votesCount, 2);

    // a3..a10 ได้คนละ 1 โหวต (u1)
    const a10 = results.attractions.find((a) => a.place.id === "a10");
    assert.equal(a10.votesCount, 1);

    // a11 เกิน 10 โหวต -> โดนตัด ได้ 0 โหวต
    const a11 = results.attractions.find((a) => a.place.id === "a11");
    assert.equal(a11.votesCount, 0);

    assert.equal(results.isAttractionTie, true);
    assert.equal(results.leadingAttractions.length, 2); // a1, a2
  });

  it("should ignore votes referencing non-existent or deleted places", () => {
    const votes = [
      { id: "u1", stayId: "deleted_stay", attractionIds: ["deleted_attr", "a1"], updatedAt: 100 },
    ];

    const results = calculateVotingResults(places, votes, members);

    assert.equal(results.stayVotersCount, 0);
    assert.equal(results.attractionVotersCount, 1); // because a1 is valid
    const a1 = results.attractions.find((a) => a.place.id === "a1");
    assert.equal(a1.votesCount, 1);
  });

  it("should support multiple stay votes up to 3 per member and handle backward compatibility", () => {
    const placesWithMoreStays = [
      ...places,
      { id: "s3", category: "stay", source: "manual", name: "วิลล่า 3", createdBy: "u1", createdByName: "สมชาย", createdAt: 70, updatedAt: 70 },
      { id: "s4", category: "stay", source: "manual", name: "วิลล่า 4", createdBy: "u2", createdByName: "สมหญิง", createdAt: 80, updatedAt: 80 },
    ];

    const votes = [
      // u1 โหวต s1, s2, s3, s4 (เกิน 3 -> ระบบต้อง slice เหลือ s1, s2, s3)
      { id: "u1", stayIds: ["s1", "s2", "s3", "s4"], attractionIds: [], updatedAt: 100 },
      // u2 โหวตแบบเดิม (stayId: "s2") -> backward compatibility เช็คว่า s2 ได้รับ 1 โหวต
      { id: "u2", stayId: "s2", attractionIds: [], updatedAt: 101 },
    ];

    const results = calculateVotingResults(placesWithMoreStays, votes, members);

    assert.equal(results.stayVotersCount, 2);
    const s1 = results.stays.find((s) => s.place.id === "s1");
    const s2 = results.stays.find((s) => s.place.id === "s2");
    const s3 = results.stays.find((s) => s.place.id === "s3");
    const s4 = results.stays.find((s) => s.place.id === "s4");

    // s2 ได้ 2 โหวต (u1, u2)
    assert.equal(s2.votesCount, 2);
    // s1 ได้ 1 โหวต (u1)
    assert.equal(s1.votesCount, 1);
    // s3 ได้ 1 โหวต (u1)
    assert.equal(s3.votesCount, 1);
    // s4 ได้ 0 โหวต (โดนตัดเพราะเกิน 3 ที่)
    assert.equal(s4.votesCount, 0);

    // s2 เป็นตัวนำเดี่ยว
    assert.equal(results.leadingStays.length, 1);
    assert.equal(results.leadingStays[0].id, "s2");
    assert.equal(results.isStayTie, false);
  });
});

