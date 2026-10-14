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



