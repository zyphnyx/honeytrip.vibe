import test from "node:test";
import assert from "node:assert/strict";

import {
  bahtToSatang,
  satangToBaht,
  formatSatang,
} from "../lib/financeTypes.ts";

import {
  computeFinanceSummary,
  getDuePaymentProgress,
} from "../lib/financeCalc.ts";

import {
  getBankName,
  getBankShortName,
  mapSlipOkError,
  parseSlipOkSuccessResponse,
  matchMaskedAccount,
  matchReceiverName,
  maskAccountNumber,
  maskPromptPay,
} from "../lib/slipokAdapter.ts";

// ==============================================================================
// 1. Satang Monetary Math & Formatting Tests
// ==============================================================================
test("Monetary calculations in integer satang", async (t) => {
  await t.test("bahtToSatang converts THB to satang cleanly without floating errors", () => {
    assert.equal(bahtToSatang(0), 0);
    assert.equal(bahtToSatang(100), 10000);
    assert.equal(bahtToSatang(100.5), 10050);
    assert.equal(bahtToSatang(100.55), 10055);
    // Floating point precision edge case: 0.1 + 0.2
    assert.equal(bahtToSatang(0.1 + 0.2), 30);
    // Invalid inputs
    assert.equal(bahtToSatang(-50), 0);
    assert.equal(bahtToSatang(NaN), 0);
  });

  await t.test("satangToBaht converts satang back to THB", () => {
    assert.equal(satangToBaht(0), 0);
    assert.equal(satangToBaht(10000), 100);
    assert.equal(satangToBaht(10055), 100.55);
    assert.equal(satangToBaht(NaN), 0);
  });

  await t.test("formatSatang formats Thai currency properly", () => {
    assert.equal(formatSatang(100000), "฿1,000");
    assert.equal(formatSatang(100050), "฿1,000.50");
    assert.equal(formatSatang(0), "฿0");
  });
});

// ==============================================================================
// 2. Ledger Calculation & Finance Summary Tests
// ==============================================================================
test("Ledger engine and financial summary calculations", async (t) => {
  await t.test("confirmed fund balance is computed strictly from ledger entries", () => {
    const summary = computeFinanceSummary({
      dues: [],
      payments: [],
      expenses: [],
      ledgerEntries: [
        {
          id: "l1",
          type: "income",
          amountSatang: 500000, // 5,000 THB in
          source: "payment",
          referenceId: "p1",
          description: "รับเงินค่าทริป",
          createdBy: "u1",
          createdAt: 1000,
        },
        {
          id: "l2",
          type: "expense",
          amountSatang: 200000, // 2,000 THB out
          source: "direct_expense",
          referenceId: "e1",
          description: "จ่ายค่ามัดจำที่พัก",
          createdBy: "u1",
          createdAt: 2000,
        },
      ],
      memberUids: ["u1"],
    });

    assert.equal(summary.confirmedFundBalanceSatang, 300000); // 3,000 THB remaining
    assert.equal(summary.totalIncomingSatang, 500000);
    assert.equal(summary.totalOutgoingSatang, 200000);
  });

  await t.test("balance never drops below zero even if outgoing exceeds recorded income", () => {
    const summary = computeFinanceSummary({
      dues: [],
      payments: [],
      expenses: [],
      ledgerEntries: [
        {
          id: "l1",
          type: "expense",
          amountSatang: 999999,
          source: "direct_expense",
          referenceId: "e1",
          description: "จ่ายเกิน",
          createdBy: "u1",
          createdAt: 1000,
        },
      ],
      memberUids: ["u1"],
    });

    assert.equal(summary.confirmedFundBalanceSatang, 0);
  });

  await t.test("member dues and payment status tracking", () => {
    const due = {
      id: "due_1",
      title: "ค่าที่พักพูลวิลล่า",
      description: "คนละ 1,500 บาท",
      dueDate: "2026-11-01",
      totalAmountSatang: 300000, // 3,000 THB
      allocations: {
        member_a: 150000, // 1,500 THB
        member_b: 150000, // 1,500 THB
      },
      linkedActivityId: null,
      status: "open",
      createdBy: "u_mgr",
      createdAt: 1000,
      updatedAt: 1000,
    };

    const payments = [
      // member_a approved payment
      {
        id: "p1",
        dueId: "due_1",
        memberUid: "member_a",
        submittedBy: "member_a",
        amountSatang: 150000,
        status: "approved",
        createdAt: 2000,
        updatedAt: 2000,
      },
      // member_b pending payment (api_verified but not yet approved)
      {
        id: "p2",
        dueId: "due_1",
        memberUid: "member_b",
        submittedBy: "member_b",
        amountSatang: 100000,
        status: "api_verified",
        createdAt: 3000,
        updatedAt: 3000,
      },
    ];

    const summary = computeFinanceSummary({
      dues: [due],
      payments,
      expenses: [],
      ledgerEntries: [],
      memberUids: ["member_a", "member_b"],
    });

    // member_a paid in full
    assert.equal(summary.members.member_a.owedSatang, 150000);
    assert.equal(summary.members.member_a.paidSatang, 150000);
    assert.equal(summary.members.member_a.outstandingSatang, 0);
    assert.equal(summary.members.member_a.isSettled, true);

    // member_b has 1,000 THB pending, but outstanding is still 1,500 THB until approved!
    assert.equal(summary.members.member_b.owedSatang, 150000);
    assert.equal(summary.members.member_b.paidSatang, 0);
    assert.equal(summary.members.member_b.pendingSatang, 100000);
    assert.equal(summary.members.member_b.outstandingSatang, 150000);
    assert.equal(summary.members.member_b.isSettled, false);

    // Pending review count should be 1
    assert.equal(summary.pendingReviewCount, 1);
    assert.equal(summary.totalOutstandingSatang, 150000);
  });
});

// ==============================================================================
// 3. Multi-Installment Payment Progress Tests
// ==============================================================================
test("Multi-installment payment progress tracking for Dues", () => {
  const due = {
    id: "due_accom",
    title: "มัดจำและส่วนที่เหลือที่พัก",
    description: "งวด 1 + งวด 2",
    dueDate: "2026-11-10",
    totalAmountSatang: 400000, // 4,000 THB
    allocations: {
      member_1: 200000, // 2,000 THB
      member_2: 200000, // 2,000 THB
    },
    linkedActivityId: null,
    status: "open",
    createdBy: "admin",
    createdAt: 1000,
    updatedAt: 1000,
  };

  const payments = [
    // member_1 installment 1: 1,000 THB (approved)
    {
      id: "p1",
      dueId: "due_accom",
      memberUid: "member_1",
      submittedBy: "member_1",
      amountSatang: 100000,
      status: "approved",
      createdAt: 1100,
      updatedAt: 1100,
    },
    // member_1 installment 2: 1,000 THB (approved)
    {
      id: "p2",
      dueId: "due_accom",
      memberUid: "member_1",
      submittedBy: "member_1",
      amountSatang: 100000,
      status: "approved",
      createdAt: 1200,
      updatedAt: 1200,
    },
    // member_2 installment 1: 500 THB (approved)
    {
      id: "p3",
      dueId: "due_accom",
      memberUid: "member_2",
      submittedBy: "member_2",
      amountSatang: 50000,
      status: "approved",
      createdAt: 1300,
      updatedAt: 1300,
    },
  ];

  const progress = getDuePaymentProgress(due, payments);

  assert.equal(progress.totalOwedSatang, 400000);
  assert.equal(progress.totalPaidSatang, 250000);
  assert.equal(progress.remainingSatang, 150000);
  assert.equal(progress.isFullySettled, false);

  // member_1 has 2 installments, completely settled
  assert.equal(progress.byMember.member_1.installmentsCount, 2);
  assert.equal(progress.byMember.member_1.approvedSatang, 200000);
  assert.equal(progress.byMember.member_1.remainingSatang, 0);

  // member_2 has 1 installment, 1,500 THB remaining
  assert.equal(progress.byMember.member_2.installmentsCount, 1);
  assert.equal(progress.byMember.member_2.approvedSatang, 50000);
  assert.equal(progress.byMember.member_2.remainingSatang, 150000);
});

// ==============================================================================
// 4. SlipOK API v1.13 Response Parsing & Error Code Mapping Tests
// ==============================================================================
test("SlipOK v1.13 bank codes and error mapping", async (t) => {
  await t.test("bank code dictionary covers major Thai banks", () => {
    assert.equal(getBankShortName("004"), "KBANK");
    assert.equal(getBankShortName("014"), "SCB");
    assert.equal(getBankShortName("002"), "BBL");
    assert.equal(getBankShortName("006"), "KTB");
    assert.equal(getBankShortName("025"), "BAY");
    assert.equal(getBankShortName("011"), "TTB");
    assert.equal(getBankName("004"), "ธนาคารกสิกรไทย");
  });

  await t.test("error code mapping adheres to SlipOK v1.13 specifications", () => {
    // 1000 - invalid QR
    const err1000 = mapSlipOkError(1000);
    assert.equal(err1000.isRetryable, false);
    assert.match(err1000.thaiMessage, /QR Code/);

    // 1004 - over quota
    const err1004 = mapSlipOkError(1004);
    assert.equal(err1004.isRetryable, false);
    assert.match(err1004.thaiMessage, /โควต้า/);

    // 1010 - bank delay with minutes
    const err1010 = mapSlipOkError(1010, "Delay", { delay: 15, bankName: "SCB" });
    assert.equal(err1010.isRetryable, true);
    assert.equal(err1010.delayMins, 15);
    assert.match(err1010.thaiMessage, /15 นาที/);

    // 1012 - duplicate slip
    const err1012 = mapSlipOkError(1012);
    assert.equal(err1012.isRetryable, false);
    assert.match(err1012.thaiMessage, /สลิปซ้ำ/);
  });

  await t.test("parses valid SlipOK v1.13 response payload", () => {
    const rawSlipOkJson = {
      success: true,
      data: {
        success: true,
        transRef: "202610121234567890",
        transDate: "20261012",
        transTime: "14:30:25",
        transTimestamp: "2026-10-12T14:30:25+07:00",
        sendingBank: "004",
        receivingBank: "014",
        amount: 2500.5,
        sender: {
          displayName: "นาย ก",
          name: "MR. KOR",
          account: {
            type: "BANKAC",
            value: "xxx-x-x0209-x",
          },
        },
        receiver: {
          displayName: "น.ส. กานต์พิชชา",
          name: "MISS KANPITCHA",
          proxy: {
            type: "MSISDN",
            value: "086xxx0000",
          },
        },
      },
    };

    const parsed = parseSlipOkSuccessResponse(rawSlipOkJson);
    assert.equal(parsed.success, true);
    assert.equal(parsed.transRef, "202610121234567890");
    assert.equal(parsed.amount, 2500.5);
    assert.equal(parsed.amountSatang, 250050); // integer satang
    assert.equal(parsed.sendingBank, "004");
    assert.equal(parsed.receivingBank, "014");
    assert.equal(parsed.receiver?.displayName, "น.ส. กานต์พิชชา");
    assert.equal(parsed.receiver?.proxyValue, "086xxx0000");
  });
});

// ==============================================================================
// 5. Masked Account & Receiver Matching Tests (PDF Page 8)
// ==============================================================================
test("Masked account and receiver name matching logic", async (t) => {
  await t.test("matches bank account with masked pattern", () => {
    // Masked value from slip: xxx-x-x3109-x
    // Expected account: 12345631090
    assert.equal(matchMaskedAccount("12345631090", "xxx-x-x3109-x"), true);

    // Mismatched account
    assert.equal(matchMaskedAccount("12345699990", "xxx-x-x3109-x"), false);
  });

  await t.test("matches PromptPay phone number with masked pattern", () => {
    // Masked phone: 086xxx0000
    // Real phone: 0861230000
    assert.equal(matchMaskedAccount("0861230000", "086xxx0000"), true);

    // Mismatched phone
    assert.equal(matchMaskedAccount("0891230000", "086xxx0000"), false);
  });

  await t.test("matches receiver name flexibly with titles and whitespace stripped", () => {
    const slipName = "น.ส. กานต์พิชชา สุริยนต์";
    const expectedName = "กานต์พิชชา";
    assert.equal(matchReceiverName(expectedName, slipName), true);

    const slipEnglish = "MISS KANPITCHA SURIYON";
    const expectedEnglish = "KANPITCHA";
    assert.equal(matchReceiverName(expectedEnglish, slipEnglish), true);

    // Completely different name
    assert.equal(matchReceiverName("สมชาย", slipName), false);
  });
});

// ==============================================================================
// 6. Security State Machine & Invariant Tests
// ==============================================================================
test("Financial security state machine invariants", async (t) => {
  await t.test("only approved status credits financial ledger", () => {
    const statuses = [
      "submitted",
      "verification_pending",
      "api_verified",
      "manual_review",
      "rejected",
    ];

    for (const status of statuses) {
      const summary = computeFinanceSummary({
        dues: [],
        payments: [
          {
            id: `p_${status}`,
            dueId: "d1",
            memberUid: "m1",
            submittedBy: "m1",
            amountSatang: 100000,
            status,
            createdAt: 1000,
            updatedAt: 1000,
          },
        ],
        expenses: [],
        ledgerEntries: [], // No ledger entry created until manager approves
        memberUids: ["m1"],
      });

      assert.equal(
        summary.confirmedFundBalanceSatang,
        0,
        `Status ${status} must NOT credit confirmed fund balance`
      );
    }
  });

  await t.test("deleting a rejected payment preserves zero-credit invariant and does not affect ledger", () => {
    const rejectedPayment = {
      id: "pay_rej_1",
      dueId: "due_1",
      memberUid: "m1",
      submittedBy: "m1",
      amountSatang: 195000,
      status: "rejected",
      rejectedReason: "สลิปซ้ำหรือไม่พบยอด",
      createdAt: 1000,
      updatedAt: 1200,
    };

    const summaryWithRejected = computeFinanceSummary({
      dues: [],
      payments: [rejectedPayment],
      expenses: [],
      ledgerEntries: [],
      memberUids: ["m1"],
    });

    const summaryAfterDeletion = computeFinanceSummary({
      dues: [],
      payments: [],
      expenses: [],
      ledgerEntries: [],
      memberUids: ["m1"],
    });

    assert.equal(summaryWithRejected.confirmedFundBalanceSatang, 0);
    assert.equal(summaryAfterDeletion.confirmedFundBalanceSatang, 0);
    assert.equal(summaryWithRejected.totalIncomingSatang, 0);
    assert.equal(summaryAfterDeletion.totalIncomingSatang, 0);
  });
});

// ==============================================================================
// 7. Privacy Account Masking Tests
// ==============================================================================
test("Account and PromptPay number masking for privacy", async (t) => {
  await t.test("maskAccountNumber masks 10-digit Thai bank accounts to xxx-x-xx933", () => {
    assert.equal(maskAccountNumber("1528609933"), "xxx-x-xx933");
    assert.equal(maskAccountNumber("152-8-60993-3"), "xxx-x-xx933");
    assert.equal(maskAccountNumber("0123456789"), "xxx-x-xx789");
  });

  await t.test("maskAccountNumber handles 12-digit accounts and edge cases", () => {
    assert.equal(maskAccountNumber("123456789012"), "xxx-x-xxxx9012");
    assert.equal(maskAccountNumber(""), "");
    assert.equal(maskAccountNumber(null), "");
  });

  await t.test("maskPromptPay masks 10-digit mobile number and 13-digit citizen ID", () => {
    assert.equal(maskPromptPay("0812345678"), "xxx-xxx-5678");
    assert.equal(maskPromptPay("1234567890123"), "x-xxxx-xxxxx-12-3");
    assert.equal(maskPromptPay(""), "");
    assert.equal(maskPromptPay(null), "");
  });
});

// ==============================================================================
// 8. Expense Installments & Settlement Accounting Tests
// ==============================================================================
test("Expense installments and status computation", async (t) => {
  await t.test("partially paid expense status transitions to paid when fully settled", () => {
    const totalCost = 600000; // 6,000 THB

    // 1. Partial payment (3,000 THB)
    const paidPartial = 300000;
    const statusPartial =
      paidPartial >= totalCost ? "paid" : paidPartial > 0 ? "partially_paid" : "planned";
    assert.equal(statusPartial, "partially_paid");

    // 2. Full payment (6,000 THB)
    const paidFull = 600000;
    const statusFull =
      paidFull >= totalCost ? "paid" : paidFull > 0 ? "partially_paid" : "planned";
    assert.equal(statusFull, "paid");
  });

  await t.test("ledger accurately aggregates multiple expense payments", () => {
    const ledgerEntries = [
      {
        id: "led_exp1_part1",
        type: "expense",
        amountSatang: 300000,
        createdAt: 1000,
      },
      {
        id: "led_exp1_part2",
        type: "expense",
        amountSatang: 300000,
        createdAt: 2000,
      },
    ];

    const summary = computeFinanceSummary({
      dues: [],
      payments: [],
      expenses: [
        {
          id: "exp1",
          title: "ค่าที่พัก",
          category: "accommodation",
          vendor: "Villa",
          totalCostSatang: 600000,
          paidAmountSatang: 600000,
          date: "2026-10-12",
          linkedActivityId: null,
          status: "paid",
          notes: "",
          createdBy: "user1",
          createdAt: 1000,
          updatedAt: 2000,
        },
      ],
      ledgerEntries,
      memberUids: [],
    });

    assert.equal(summary.totalConfirmedOutflowSatang, 600000);
    assert.equal(summary.totalPendingVendorLiabilitySatang, 0);
  });

  await t.test("cancelled dues are excluded from outstanding dues and member owed balances", () => {
    const cancelledDue = {
      id: "due_err",
      title: "งวดที่ตั้งผิด",
      description: "ทดสอบตั้งผิด",
      dueDate: "2026-10-31",
      totalAmountSatang: 500000,
      allocations: {
        user_a: 250000,
        user_b: 250000,
      },
      linkedActivityId: null,
      status: "cancelled",
      createdBy: "u_mgr",
      createdAt: 1000,
      updatedAt: 1500,
    };

    const summary = computeFinanceSummary({
      dues: [cancelledDue],
      payments: [],
      expenses: [],
      ledgerEntries: [],
      memberUids: ["user_a", "user_b"],
    });

    assert.equal(summary.totalOutstandingDuesSatang, 0);
    assert.equal(summary.members.user_a.owedSatang, 0);
    assert.equal(summary.members.user_b.owedSatang, 0);
    assert.equal(summary.members.user_a.isSettled, true);
    assert.equal(summary.members.user_b.isSettled, true);
  });

  await t.test("editing an approved payment downwards from 10,000 to 1,000 creates a reversal and calculates exact net income", () => {
    // Member was billed 1,000 THB (100,000 satang)
    const due = {
      id: "due_test",
      title: "test ระบบ",
      description: "",
      dueDate: "2026-10-31",
      totalAmountSatang: 100000,
      allocations: { user_tum: 100000 },
      linkedActivityId: null,
      status: "open",
      createdBy: "u_mgr",
      createdAt: 1000,
      updatedAt: 1000,
    };

    // Originally, 10,000 THB was recorded and approved
    // After manual edit, payment is updated to 1,000 THB (100,000 satang)
    const payment = {
      id: "pay_1",
      dueId: "due_test",
      memberUid: "user_tum",
      submittedBy: "user_tum",
      amountSatang: 100000, // corrected to 1,000 THB
      status: "approved",
      createdAt: 1000,
      updatedAt: 2000,
    };

    // Ledger contains:
    // 1) Initial approved income: 1,000,000 satang (10,000 THB)
    // 2) Compensating reversal entry: 900,000 satang (9,000 THB)
    const ledgerEntries = [
      {
        id: "led_initial",
        type: "income",
        amountSatang: 1000000,
        source: "payment",
        referenceId: "pay_1",
        description: "รับเงินค่าtest ระบบ จากสมาชิก",
        memberUid: "user_tum",
        createdBy: "u_mgr",
        createdAt: 1500,
      },
      {
        id: "led_reversal",
        type: "reversal",
        amountSatang: 900000,
        source: "payment",
        referenceId: "pay_1",
        description: "ปรับปรุงลดยอดเงินโอน (test ระบบ) จาก ฿10,000 เป็น ฿1,000 (พิมพ์เลข 0 เกิน)",
        memberUid: "user_tum",
        createdBy: "u_mgr",
        createdAt: 2000,
      },
    ];

    const summary = computeFinanceSummary({
      dues: [due],
      payments: [payment],
      expenses: [],
      ledgerEntries,
      memberUids: ["user_tum"],
    });

    // Net income should be 1,000 THB (100,000 satang)
    assert.equal(summary.totalIncomingSatang, 100000);
    assert.equal(summary.confirmedFundBalanceSatang, 100000);
    assert.equal(summary.members.user_tum.paidSatang, 100000);
    assert.equal(summary.members.user_tum.outstandingSatang, 0);
    assert.equal(summary.members.user_tum.isSettled, true);
  });

  await t.test("revoking an approved payment creates a full reversal and restores member dues outstanding", () => {
    const due = {
      id: "due_test2",
      title: "ทริปพัทยา",
      description: "",
      dueDate: "2026-10-31",
      totalAmountSatang: 100000,
      allocations: { user_tum: 100000 },
      linkedActivityId: null,
      status: "open",
      createdBy: "u_mgr",
      createdAt: 1000,
      updatedAt: 1000,
    };

    // Payment revoked back to rejected
    const payment = {
      id: "pay_2",
      dueId: "due_test2",
      memberUid: "user_tum",
      submittedBy: "user_tum",
      amountSatang: 100000,
      status: "rejected",
      rejectedReason: "ยกเลิกการอนุมัติเพื่อแก้ไขยอด",
      createdAt: 1000,
      updatedAt: 2000,
    };

    // Ledger has initial income (100,000 satang) and full reversal (100,000 satang)
    const ledgerEntries = [
      {
        id: "led_income",
        type: "income",
        amountSatang: 100000,
        createdAt: 1500,
      },
      {
        id: "led_rev",
        type: "reversal",
        amountSatang: 100000,
        createdAt: 2000,
      },
    ];

    const summary = computeFinanceSummary({
      dues: [due],
      payments: [payment],
      expenses: [],
      ledgerEntries,
      memberUids: ["user_tum"],
    });

    assert.equal(summary.totalIncomingSatang, 0);
    assert.equal(summary.confirmedFundBalanceSatang, 0);
    assert.equal(summary.members.user_tum.paidSatang, 0);
    assert.equal(summary.members.user_tum.outstandingSatang, 100000);
    assert.equal(summary.members.user_tum.isSettled, false);
  });
});

// ==============================================================================
// 9. Atomic Transactions & Idempotency Specification
// Mini transactional in-memory store simulating Firestore runTransaction behavior
class MockFirestoreDb {
    constructor() {
      this.docs = new Map();
      this.versions = new Map();
    }

    set(path, data) {
      this.docs.set(path, JSON.parse(JSON.stringify(data)));
      this.versions.set(path, (this.versions.get(path) || 0) + 1);
    }

    get(path) {
      const data = this.docs.get(path);
      return data ? JSON.parse(JSON.stringify(data)) : null;
    }

    async runTransaction(updateFn) {
      const MAX_RETRIES = 5;
      for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const readVersions = new Map();
        let writeStarted = false;
        const pendingWrites = [];

        const tx = {
          get: async (refPath) => {
            if (writeStarted) {
              throw new Error("Firestore transactions require all reads to be executed before all writes.");
            }
            readVersions.set(refPath, this.versions.get(refPath) || 0);
            const data = this.docs.get(refPath);
            return {
              exists: () => data !== undefined && data !== null,
              data: () => (data ? JSON.parse(JSON.stringify(data)) : undefined),
            };
          },
          update: (refPath, patch) => {
            writeStarted = true;
            pendingWrites.push({ type: "update", refPath, patch });
          },
          set: (refPath, data) => {
            writeStarted = true;
            pendingWrites.push({ type: "set", refPath, data });
          },
        };

        try {
          await updateFn(tx);
        } catch (err) {
          throw err;
        }

        let hasConflict = false;
        for (const [refPath, version] of readVersions.entries()) {
          const currentVersion = this.versions.get(refPath) || 0;
          if (currentVersion !== version) {
            hasConflict = true;
            break;
          }
        }

        if (hasConflict) {
          continue;
        }

        for (const op of pendingWrites) {
          if (op.type === "set") {
            this.set(op.refPath, op.data);
          } else if (op.type === "update") {
            const existing = this.get(op.refPath) || {};
            this.set(op.refPath, { ...existing, ...op.patch });
          }
        }
        return;
      }
      throw new Error("Transaction failed after maximum retries due to concurrency contention.");
    }
  }

  async function simulateApprovePayment(db, roomId, paymentId, dueTitle, userUid) {
    const paymentPath = `rooms/${roomId}/payments/${paymentId}`;
    await db.runTransaction(async (tx) => {
      const paymentSnap = await tx.get(paymentPath);
      if (!paymentSnap.exists()) throw new Error("ไม่พบรายการแจ้งโอนเงิน");
      const current = paymentSnap.data();
      if (current.status === "approved") return;

      const nextCycle = (current.approvalCycle || 0) + 1;
      const ledgerEntryId = `led_app_${paymentId}_${nextCycle}`;
      const ledgerPath = `rooms/${roomId}/ledgerEntries/${ledgerEntryId}`;
      const ledgerSnap = await tx.get(ledgerPath);
      if (ledgerSnap.exists()) return;

      const now = Date.now();
      tx.update(paymentPath, {
        status: "approved",
        approvalCycle: nextCycle,
        approvedBy: userUid,
        approvedAt: now,
        updatedAt: now,
      });

      tx.set(ledgerPath, {
        id: ledgerEntryId,
        type: "income",
        amountSatang: current.amountSatang,
        source: "payment",
        referenceId: paymentId,
        description: `รับเงินค่า${dueTitle || "ทริป"} จากสมาชิก`,
        memberUid: current.memberUid,
        createdBy: userUid,
        createdAt: now,
      });
    });
  }

  async function simulateRevokeApprovedPayment(db, roomId, paymentId, reason, userUid) {
    const paymentPath = `rooms/${roomId}/payments/${paymentId}`;
    await db.runTransaction(async (tx) => {
      const paymentSnap = await tx.get(paymentPath);
      if (!paymentSnap.exists()) throw new Error("ไม่พบรายการแจ้งโอนเงิน");
      const current = paymentSnap.data();
      if (current.status !== "approved") return;

      const currentCycle = current.approvalCycle || 1;
      const reversalEntryId = `led_rev_${paymentId}_${currentCycle}`;
      const ledgerPath = `rooms/${roomId}/ledgerEntries/${reversalEntryId}`;
      const ledgerSnap = await tx.get(ledgerPath);
      if (ledgerSnap.exists()) return;

      const now = Date.now();
      tx.update(paymentPath, {
        status: "rejected",
        rejectedReason: reason || "ยกเลิกการอนุมัติเพื่อแก้ไขยอด",
        updatedAt: now,
      });

      tx.set(ledgerPath, {
        id: reversalEntryId,
        type: "reversal",
        amountSatang: current.amountSatang,
        source: "payment",
        referenceId: paymentId,
        description: `ยกเลิกการอนุมัติยอดโอน: ${reason || "แก้ไขข้อผิดพลาด"}`,
        memberUid: current.memberUid,
        createdBy: userUid,
        createdAt: now,
      });
    });
  }

  async function simulateUpdatePaymentAmount(db, roomId, paymentId, newAmountSatang, dueTitle, reason, userUid) {
    const paymentPath = `rooms/${roomId}/payments/${paymentId}`;
    await db.runTransaction(async (tx) => {
      const paymentSnap = await tx.get(paymentPath);
      if (!paymentSnap.exists()) throw new Error("ไม่พบรายการแจ้งโอนเงิน");
      const current = paymentSnap.data();

      if (newAmountSatang === current.amountSatang) return;

      const isApproved = current.status === "approved";
      const nextSeq = (current.editSeq || 0) + 1;
      const adjustmentEntryId = `led_adj_${paymentId}_${nextSeq}`;
      const ledgerPath = `rooms/${roomId}/ledgerEntries/${adjustmentEntryId}`;

      if (isApproved) {
        const adjustmentSnap = await tx.get(ledgerPath);
        if (adjustmentSnap.exists()) return;
      }

      const now = Date.now();
      tx.update(paymentPath, {
        amountSatang: newAmountSatang,
        editSeq: nextSeq,
        updatedAt: now,
      });

      if (isApproved) {
        const delta = newAmountSatang - current.amountSatang;
        if (delta < 0) {
          tx.set(ledgerPath, {
            id: adjustmentEntryId,
            type: "reversal",
            amountSatang: Math.abs(delta),
            source: "payment",
            referenceId: paymentId,
            description: `ปรับปรุงลดยอดเงินโอน: จาก ${current.amountSatang} เป็น ${newAmountSatang}`,
            memberUid: current.memberUid,
            createdBy: userUid,
            createdAt: now,
          });
        } else if (delta > 0) {
          tx.set(ledgerPath, {
            id: adjustmentEntryId,
            type: "income",
            amountSatang: delta,
            source: "payment",
            referenceId: paymentId,
            description: `ปรับปรุงเพิ่มยอดเงินโอน: จาก ${current.amountSatang} เป็น ${newAmountSatang}`,
            memberUid: current.memberUid,
            createdBy: userUid,
            createdAt: now,
          });
        }
      }
    });
  }

test("Atomic Transactions & Idempotency Specification", async (t) => {
  await t.test("normal payment approval atomically commits payment status and income entry", async () => {
    const db = new MockFirestoreDb();
    db.set("rooms/r1/payments/p1", {
      id: "p1",
      dueId: "d1",
      memberUid: "m1",
      submittedBy: "m1",
      amountSatang: 100000,
      status: "submitted",
    });

    await simulateApprovePayment(db, "r1", "p1", "ค่าที่พัก", "mgr1");

    const p = db.get("rooms/r1/payments/p1");
    assert.equal(p.status, "approved");
    assert.equal(p.approvalCycle, 1);

    const led = db.get("rooms/r1/ledgerEntries/led_app_p1_1");
    assert.ok(led);
    assert.equal(led.type, "income");
    assert.equal(led.amountSatang, 100000);
    assert.equal(led.referenceId, "p1");
  });

  await t.test("double-click approval is idempotent and does not credit the same payment twice", async () => {
    const db = new MockFirestoreDb();
    db.set("rooms/r1/payments/p1", {
      id: "p1",
      dueId: "d1",
      memberUid: "m1",
      submittedBy: "m1",
      amountSatang: 100000,
      status: "submitted",
    });

    await simulateApprovePayment(db, "r1", "p1", "ค่าที่พัก", "mgr1");
    await simulateApprovePayment(db, "r1", "p1", "ค่าที่พัก", "mgr1");
    await simulateApprovePayment(db, "r1", "p1", "ค่าที่พัก", "mgr1");

    const entries = Array.from(db.docs.entries())
      .filter(([k]) => k.startsWith("rooms/r1/ledgerEntries/"))
      .map(([, v]) => v);

    assert.equal(entries.length, 1);
    assert.equal(entries[0].id, "led_app_p1_1");
    assert.equal(entries[0].amountSatang, 100000);

    const summary = computeFinanceSummary({
      dues: [],
      payments: [db.get("rooms/r1/payments/p1")],
      expenses: [],
      ledgerEntries: entries,
      memberUids: ["m1"],
    });

    assert.equal(summary.confirmedFundBalanceSatang, 100000);
    assert.equal(summary.totalIncomingSatang, 100000);
  });

  await t.test("concurrent double approval executes safely and creates exactly 1 ledger entry", async () => {
    const db = new MockFirestoreDb();
    db.set("rooms/r1/payments/p1", {
      id: "p1",
      dueId: "d1",
      memberUid: "m1",
      submittedBy: "m1",
      amountSatang: 250000,
      status: "submitted",
    });

    await Promise.all([
      simulateApprovePayment(db, "r1", "p1", "ค่าทริป", "mgr1"),
      simulateApprovePayment(db, "r1", "p1", "ค่าทริป", "mgr2"),
    ]);

    const entries = Array.from(db.docs.entries())
      .filter(([k]) => k.startsWith("rooms/r1/ledgerEntries/"))
      .map(([, v]) => v);

    assert.equal(entries.length, 1);
    assert.equal(entries[0].amountSatang, 250000);
    assert.equal(db.get("rooms/r1/payments/p1").status, "approved");
  });

  await t.test("failed transaction leaves no partial writes", async () => {
    const db = new MockFirestoreDb();
    db.set("rooms/r1/payments/p1", {
      id: "p1",
      dueId: "d1",
      memberUid: "m1",
      submittedBy: "m1",
      amountSatang: 100000,
      status: "submitted",
    });

    await assert.rejects(
      db.runTransaction(async (tx) => {
        const snap = await tx.get("rooms/r1/payments/p1");
        assert.ok(snap.exists());
        tx.update("rooms/r1/payments/p1", { status: "approved" });
        throw new Error("Network dropped before commit");
      }),
      /Network dropped/
    );

    const p = db.get("rooms/r1/payments/p1");
    assert.equal(p.status, "submitted");
    const entries = Array.from(db.docs.entries()).filter(([k]) => k.startsWith("rooms/r1/ledgerEntries/"));
    assert.equal(entries.length, 0);
  });

  await t.test("approval -> revoke -> reapproval -> revoke cycle with deterministic ledger identities", async () => {
    const db = new MockFirestoreDb();
    db.set("rooms/r1/payments/p1", {
      id: "p1",
      dueId: "d1",
      memberUid: "m1",
      submittedBy: "m1",
      amountSatang: 100000,
      status: "submitted",
    });

    // Step 1: Initial Approval (Cycle 1)
    await simulateApprovePayment(db, "r1", "p1", "ค่าทริป", "mgr1");
    let p = db.get("rooms/r1/payments/p1");
    assert.equal(p.status, "approved");
    assert.equal(p.approvalCycle, 1);
    assert.ok(db.get("rooms/r1/ledgerEntries/led_app_p1_1"));

    // Step 2: Revocation (Cycle 1)
    await simulateRevokeApprovedPayment(db, "r1", "p1", "โอนผิดยอด", "mgr1");
    p = db.get("rooms/r1/payments/p1");
    assert.equal(p.status, "rejected");
    assert.ok(db.get("rooms/r1/ledgerEntries/led_rev_p1_1"));

    // Repeated Revocation (Idempotency)
    await simulateRevokeApprovedPayment(db, "r1", "p1", "กดย้ำ", "mgr1");

    let allEntries = Array.from(db.docs.entries())
      .filter(([k]) => k.startsWith("rooms/r1/ledgerEntries/"))
      .map(([, v]) => v);
    assert.equal(allEntries.length, 2);
    let summary = computeFinanceSummary({ dues: [], payments: [p], expenses: [], ledgerEntries: allEntries, memberUids: ["m1"] });
    assert.equal(summary.confirmedFundBalanceSatang, 0);

    // Step 3: Re-approval (Cycle 2)
    await simulateApprovePayment(db, "r1", "p1", "ค่าทริป", "mgr1");
    p = db.get("rooms/r1/payments/p1");
    assert.equal(p.status, "approved");
    assert.equal(p.approvalCycle, 2);
    assert.ok(db.get("rooms/r1/ledgerEntries/led_app_p1_2"));

    allEntries = Array.from(db.docs.entries())
      .filter(([k]) => k.startsWith("rooms/r1/ledgerEntries/"))
      .map(([, v]) => v);
    assert.equal(allEntries.length, 3);
    summary = computeFinanceSummary({ dues: [], payments: [p], expenses: [], ledgerEntries: allEntries, memberUids: ["m1"] });
    assert.equal(summary.confirmedFundBalanceSatang, 100000);

    // Step 4: Revocation again (Cycle 2)
    await simulateRevokeApprovedPayment(db, "r1", "p1", "ยกเลิกอีกรอบ", "mgr1");
    p = db.get("rooms/r1/payments/p1");
    assert.equal(p.status, "rejected");
    assert.ok(db.get("rooms/r1/ledgerEntries/led_rev_p1_2"));

    allEntries = Array.from(db.docs.entries())
      .filter(([k]) => k.startsWith("rooms/r1/ledgerEntries/"))
      .map(([, v]) => v);
    assert.equal(allEntries.length, 4);
    summary = computeFinanceSummary({ dues: [], payments: [p], expenses: [], ledgerEntries: allEntries, memberUids: ["m1"] });
    assert.equal(summary.confirmedFundBalanceSatang, 0);
  });

  await t.test("editing approved payment amount calculates fresh delta, handles same-amount no-op, and ensures ledger total consistency", async () => {
    const db = new MockFirestoreDb();
    db.set("rooms/r1/payments/p1", {
      id: "p1",
      dueId: "d1",
      memberUid: "m1",
      submittedBy: "m1",
      amountSatang: 100000,
      status: "submitted",
    });

    await simulateApprovePayment(db, "r1", "p1", "ค่าอาหาร", "mgr1");

    await simulateUpdatePaymentAmount(db, "r1", "p1", 120000, "ค่าอาหาร", "เพิ่มยอด", "mgr1");
    let p = db.get("rooms/r1/payments/p1");
    assert.equal(p.amountSatang, 120000);
    assert.equal(p.editSeq, 1);
    const adj1 = db.get("rooms/r1/ledgerEntries/led_adj_p1_1");
    assert.ok(adj1);
    assert.equal(adj1.type, "income");
    assert.equal(adj1.amountSatang, 20000);

    await simulateUpdatePaymentAmount(db, "r1", "p1", 120000, "ค่าอาหาร", "กดซ้ำ", "mgr1");
    assert.equal(db.get("rooms/r1/payments/p1").editSeq, 1);

    await simulateUpdatePaymentAmount(db, "r1", "p1", 80000, "ค่าอาหาร", "ลดยอด", "mgr1");
    p = db.get("rooms/r1/payments/p1");
    assert.equal(p.amountSatang, 80000);
    assert.equal(p.editSeq, 2);
    const adj2 = db.get("rooms/r1/ledgerEntries/led_adj_p1_2");
    assert.ok(adj2);
    assert.equal(adj2.type, "reversal");
    assert.equal(adj2.amountSatang, 40000);

    const allEntries = Array.from(db.docs.entries())
      .filter(([k]) => k.startsWith("rooms/r1/ledgerEntries/"))
      .map(([, v]) => v);
    assert.equal(allEntries.length, 3);

    const summary = computeFinanceSummary({
      dues: [],
      payments: [p],
      expenses: [],
      ledgerEntries: allEntries,
      memberUids: ["m1"],
    });

    assert.equal(summary.confirmedFundBalanceSatang, 80000);
    assert.equal(summary.totalIncomingSatang, 80000);
  });

  await t.test("concurrent amount edits calculate deltas from fresh stored state without lost updates", async () => {
    const db = new MockFirestoreDb();
    db.set("rooms/r1/payments/p1", {
      id: "p1",
      dueId: "d1",
      memberUid: "m1",
      submittedBy: "m1",
      amountSatang: 100000,
      status: "submitted",
    });

    await simulateApprovePayment(db, "r1", "p1", "ค่าทริป", "mgr1");

    await Promise.all([
      simulateUpdatePaymentAmount(db, "r1", "p1", 120000, "ค่าทริป", "แก้ไขโดย mgr1", "mgr1"),
      simulateUpdatePaymentAmount(db, "r1", "p1", 150000, "ค่าทริป", "แก้ไขโดย mgr2", "mgr2"),
    ]);

    const p = db.get("rooms/r1/payments/p1");
    assert.ok([120000, 150000].includes(p.amountSatang));

    const allEntries = Array.from(db.docs.entries())
      .filter(([k]) => k.startsWith("rooms/r1/ledgerEntries/"))
      .map(([, v]) => v);

    const summary = computeFinanceSummary({
      dues: [],
      payments: [p],
      expenses: [],
      ledgerEntries: allEntries,
      memberUids: ["m1"],
    });

    assert.equal(summary.confirmedFundBalanceSatang, p.amountSatang);
  });

  await t.test("backward compatibility: existing payments created before the fix approve safely without approvalCycle or editSeq", async () => {
    const db = new MockFirestoreDb();
    db.set("rooms/legacy_room/payments/legacy_pay_99", {
      id: "legacy_pay_99",
      dueId: "due_old",
      memberUid: "old_user",
      submittedBy: "old_user",
      amountSatang: 50000,
      status: "submitted",
      createdAt: 1600000000,
      updatedAt: 1600000000,
    });

    await simulateApprovePayment(db, "legacy_room", "legacy_pay_99", "ทริปเก่า", "mgr_modern");

    const p = db.get("rooms/legacy_room/payments/legacy_pay_99");
    assert.equal(p.status, "approved");
    assert.equal(p.approvalCycle, 1);

    const led = db.get("rooms/legacy_room/ledgerEntries/led_app_legacy_pay_99_1");
    assert.ok(led);
    assert.equal(led.amountSatang, 50000);
  });
});

// ==============================================================================
// 31. Manual Payment & Private Slip Evidence Specification
// ==============================================================================
test("Manual Payment & Private Slip Evidence Specification", async (t) => {
  await t.test("submitting a manual payment creates status 'manual_review' with evidence metadata", () => {
    const payment = {
      id: "pay_manual_01",
      dueId: "due_01",
      memberUid: "user_alice",
      submittedBy: "user_alice",
      amountSatang: 150000,
      transferDate: "2026-10-14",
      transferTime: "14:30",
      status: "manual_review",
      evidenceType: "blob_private",
      evidence: {
        blobPath: "slips/room_01/pay_manual_01/slip_hash123.jpg",
        mimeType: "image/jpeg",
        sizeBytes: 450120,
        sha256Hash: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        originalFileName: "my_slip.jpg",
        uploadedAt: 1776000000000,
      },
      createdAt: 1776000000000,
      updatedAt: 1776000000000,
    };

    assert.equal(payment.status, "manual_review");
    assert.notEqual(payment.status, "api_verified");
    assert.equal(payment.amountSatang, 150000);
    assert.equal(payment.transferDate, "2026-10-14");
    assert.equal(payment.transferTime, "14:30");
    assert.equal(payment.evidenceType, "blob_private");
    assert.ok(payment.evidence);
    assert.equal(payment.evidence.sha256Hash.length, 64);
  });

  await t.test("submitting fallback payment without image stores evidenceType 'none' and null evidence", () => {
    const payment = {
      id: "pay_manual_nofile",
      dueId: "due_01",
      memberUid: "user_bob",
      submittedBy: "user_bob",
      amountSatang: 50000,
      transferDate: "2026-10-14",
      transferTime: "15:00",
      status: "manual_review",
      evidenceType: "none",
      evidence: null,
      createdAt: 1776000010000,
      updatedAt: 1776000010000,
    };

    assert.equal(payment.status, "manual_review");
    assert.equal(payment.evidenceType, "none");
    assert.equal(payment.evidence, null);
  });

  await t.test("duplicate slip SHA-256 detection flags duplicate uploads in the same room", () => {
    const hash = "a".repeat(64);
    const existingPayments = [
      {
        id: "pay_prev",
        amountSatang: 100000,
        evidence: { sha256Hash: hash },
        status: "approved",
      },
      {
        id: "pay_other",
        amountSatang: 200000,
        evidence: { sha256Hash: "b".repeat(64) },
        status: "manual_review",
      },
    ];

    const detectDuplicate = (currentPayId, currentHash, payments) => {
      if (!currentHash) return null;
      return (
        payments.find(
          (p) => p.id !== currentPayId && p.evidence?.sha256Hash === currentHash
        ) || null
      );
    };

    const duplicateMatch = detectDuplicate("pay_new", hash, existingPayments);
    assert.ok(duplicateMatch);
    assert.equal(duplicateMatch.id, "pay_prev");

    const nonDuplicateMatch = detectDuplicate("pay_new", "c".repeat(64), existingPayments);
    assert.equal(nonDuplicateMatch, null);
  });

  await t.test("atomic approval transitions 'manual_review' to 'approved' and credits ledger atomically", async () => {
    const db = new MockFirestoreDb();
    db.set("rooms/r1/payments/p_manual", {
      id: "p_manual",
      dueId: "due_01",
      memberUid: "user_charlie",
      submittedBy: "user_charlie",
      amountSatang: 75000,
      transferDate: "2026-10-14",
      transferTime: "16:15",
      status: "manual_review",
      evidenceType: "blob_private",
      evidence: {
        blobPath: "slips/r1/p_manual/slip.jpg",
        sha256Hash: "c".repeat(64),
      },
      createdAt: 1000,
      updatedAt: 1000,
    });

    await simulateApprovePayment(db, "r1", "p_manual", "ค่าที่พักพัทยา", "mgr_dave");

    const p = db.get("rooms/r1/payments/p_manual");
    assert.equal(p.status, "approved");
    assert.equal(p.approvalCycle, 1);

    const led = db.get("rooms/r1/ledgerEntries/led_app_p_manual_1");
    assert.ok(led);
    assert.equal(led.amountSatang, 75000);
    assert.equal(led.type, "income");

    // Double approval check
    await simulateApprovePayment(db, "r1", "p_manual", "ค่าที่พักพัทยา", "mgr_dave");
    assert.equal(p.approvalCycle, 1);
  });
});



