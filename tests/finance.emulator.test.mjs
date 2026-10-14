import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, runTransaction } from "firebase/firestore";
import { computeFinanceSummary } from "../lib/financeCalc.ts";

test("Firestore Emulator: Real Atomic Transactions, Idempotency & Concurrency", async () => {
  const env = await initializeTestEnvironment({
    projectId: "demo-honeytrip-finance",
    firestore: { rules: await readFile("firestore.rules", "utf8") },
  });

  try {
    const managerContext = env.authenticatedContext("manager_uid");
    const managerDb = managerContext.firestore();
    const roomId = "room_finance_test";

    // Setup base room and identity guards with rules disabled
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "identityGuards/manager_uid"), { used: true, lockedUntil: 0 });
      await setDoc(doc(db, "identityGuards/member_uid"), { used: true, lockedUntil: 0 });
      await setDoc(doc(db, `rooms/${roomId}`), {
        title: "ทริปทดสอบระบบเงิน",
        emoji: "🍯",
        createdAt: Date.now(),
        ownerUid: "manager_uid",
        archived: false,
      });
    });

    // Pure transaction approval logic identical to lib/finance.ts
    async function txApprove(db, pId, dueTitle = "ทริป") {
      const paymentRef = doc(db, `rooms/${roomId}/payments/${pId}`);
      await runTransaction(db, async (tx) => {
        const paymentSnap = await tx.get(paymentRef);
        if (!paymentSnap.exists()) throw new Error("ไม่พบรายการแจ้งโอนเงิน");
        const current = paymentSnap.data();
        if (current.status === "approved") return;

        const nextCycle = (current.approvalCycle || 0) + 1;
        const ledgerEntryId = `led_app_${pId}_${nextCycle}`;
        const ledgerRef = doc(db, `rooms/${roomId}/ledgerEntries/${ledgerEntryId}`);

        const ledgerSnap = await tx.get(ledgerRef);
        if (ledgerSnap.exists()) return;

        const now = Date.now();
        tx.update(paymentRef, {
          status: "approved",
          approvalCycle: nextCycle,
          approvedBy: "manager_uid",
          approvedAt: now,
          updatedAt: now,
        });

        tx.set(ledgerRef, {
          id: ledgerEntryId,
          type: "income",
          amountSatang: current.amountSatang,
          source: "payment",
          referenceId: pId,
          description: `รับเงินค่า${dueTitle} จากสมาชิก`,
          memberUid: current.memberUid,
          createdBy: "manager_uid",
          createdAt: now,
        });
      });
    }

    async function txRevoke(db, pId, reason = "ยกเลิกการอนุมัติ") {
      const paymentRef = doc(db, `rooms/${roomId}/payments/${pId}`);
      await runTransaction(db, async (tx) => {
        const paymentSnap = await tx.get(paymentRef);
        if (!paymentSnap.exists()) throw new Error("ไม่พบรายการแจ้งโอนเงิน");
        const current = paymentSnap.data();
        if (current.status !== "approved") return;

        const currentCycle = current.approvalCycle || 1;
        const reversalEntryId = `led_rev_${pId}_${currentCycle}`;
        const ledgerRef = doc(db, `rooms/${roomId}/ledgerEntries/${reversalEntryId}`);

        const ledgerSnap = await tx.get(ledgerRef);
        if (ledgerSnap.exists()) return;

        const now = Date.now();
        tx.update(paymentRef, {
          status: "rejected",
          rejectedReason: reason,
          updatedAt: now,
        });

        tx.set(ledgerRef, {
          id: reversalEntryId,
          type: "reversal",
          amountSatang: current.amountSatang,
          source: "payment",
          referenceId: pId,
          description: `ยกเลิกการอนุมัติยอดโอน: ${reason}`,
          memberUid: current.memberUid,
          createdBy: "manager_uid",
          createdAt: now,
        });
      });
    }

    async function txUpdateAmount(db, pId, newSatang, reason = "") {
      const paymentRef = doc(db, `rooms/${roomId}/payments/${pId}`);
      await runTransaction(db, async (tx) => {
        const paymentSnap = await tx.get(paymentRef);
        if (!paymentSnap.exists()) throw new Error("ไม่พบรายการแจ้งโอนเงิน");
        const current = paymentSnap.data();
        if (newSatang === current.amountSatang) return;

        const isApproved = current.status === "approved";
        const nextSeq = (current.editSeq || 0) + 1;
        const adjustmentEntryId = `led_adj_${pId}_${nextSeq}`;
        const ledgerRef = doc(db, `rooms/${roomId}/ledgerEntries/${adjustmentEntryId}`);

        if (isApproved) {
          const adjustmentSnap = await tx.get(ledgerRef);
          if (adjustmentSnap.exists()) return;
        }

        const now = Date.now();
        tx.update(paymentRef, {
          amountSatang: newSatang,
          editSeq: nextSeq,
          updatedAt: now,
        });

        if (isApproved) {
          const delta = newSatang - current.amountSatang;
          if (delta < 0) {
            tx.set(ledgerRef, {
              id: adjustmentEntryId,
              type: "reversal",
              amountSatang: Math.abs(delta),
              source: "payment",
              referenceId: pId,
              description: `ปรับปรุงลดยอดเงินโอน: ${reason}`,
              memberUid: current.memberUid,
              createdBy: "manager_uid",
              createdAt: now,
            });
          } else if (delta > 0) {
            tx.set(ledgerRef, {
              id: adjustmentEntryId,
              type: "income",
              amountSatang: delta,
              source: "payment",
              referenceId: pId,
              description: `ปรับปรุงเพิ่มยอดเงินโอน: ${reason}`,
              memberUid: current.memberUid,
              createdBy: "manager_uid",
              createdAt: now,
            });
          }
        }
      });
    }

    const memberContext = env.authenticatedContext("member_uid");
    const memberDb = memberContext.firestore();

    // --------------------------------------------------------------------------
    // 1. Normal Approval
    // --------------------------------------------------------------------------
    await setDoc(doc(memberDb, `rooms/${roomId}/payments/pay_1`), {
      id: "pay_1",
      dueId: "due_1",
      memberUid: "member_uid",
      submittedBy: "member_uid",
      amountSatang: 100000, // 1,000 THB
      status: "submitted",
      createdAt: 1000,
      updatedAt: 1000,
    });

    await txApprove(managerDb, "pay_1", "ค่าที่พัก");

    const paySnap1 = await getDoc(doc(managerDb, `rooms/${roomId}/payments/pay_1`));
    assert.equal(paySnap1.data().status, "approved");
    assert.equal(paySnap1.data().approvalCycle, 1);

    const ledSnap1 = await getDoc(doc(managerDb, `rooms/${roomId}/ledgerEntries/led_app_pay_1_1`));
    assert.ok(ledSnap1.exists());
    assert.equal(ledSnap1.data().amountSatang, 100000);
    assert.equal(ledSnap1.data().type, "income");

    // --------------------------------------------------------------------------
    // 2. Double-Click Idempotency on Real Firestore
    // --------------------------------------------------------------------------
    await txApprove(managerDb, "pay_1", "ค่าที่พัก");
    await txApprove(managerDb, "pay_1", "ค่าที่พัก");

    // Verify no duplicate cycle 2 ledger entry exists
    const ledSnapDup = await getDoc(doc(managerDb, `rooms/${roomId}/ledgerEntries/led_app_pay_1_2`));
    assert.equal(ledSnapDup.exists(), false);

    // --------------------------------------------------------------------------
    // 3. Concurrent Double Approval on Real Firestore
    // --------------------------------------------------------------------------
    await setDoc(doc(memberDb, `rooms/${roomId}/payments/pay_conc`), {
      id: "pay_conc",
      dueId: "due_1",
      memberUid: "member_uid",
      submittedBy: "member_uid",
      amountSatang: 150000,
      status: "submitted",
      createdAt: 1000,
      updatedAt: 1000,
    });

    // Run 2 transactions simultaneously against Firestore
    await Promise.all([
      txApprove(managerDb, "pay_conc", "ค่ากิจกรรม"),
      txApprove(managerDb, "pay_conc", "ค่ากิจกรรม"),
    ]);

    const payConcSnap = await getDoc(doc(managerDb, `rooms/${roomId}/payments/pay_conc`));
    assert.equal(payConcSnap.data().status, "approved");
    assert.equal(payConcSnap.data().approvalCycle, 1);

    const ledConc1 = await getDoc(doc(managerDb, `rooms/${roomId}/ledgerEntries/led_app_pay_conc_1`));
    assert.ok(ledConc1.exists());
    const ledConc2 = await getDoc(doc(managerDb, `rooms/${roomId}/ledgerEntries/led_app_pay_conc_2`));
    assert.equal(ledConc2.exists(), false);

    // --------------------------------------------------------------------------
    // 4. Revocation & Re-approval Cycle
    // --------------------------------------------------------------------------
    await txRevoke(managerDb, "pay_1", "ยกเลิกเพื่อแก้ไข");
    const payRevSnap = await getDoc(doc(managerDb, `rooms/${roomId}/payments/pay_1`));
    assert.equal(payRevSnap.data().status, "rejected");

    const ledRev1 = await getDoc(doc(managerDb, `rooms/${roomId}/ledgerEntries/led_rev_pay_1_1`));
    assert.ok(ledRev1.exists());
    assert.equal(ledRev1.data().type, "reversal");
    assert.equal(ledRev1.data().amountSatang, 100000);

    // Repeated Revocation Idempotency
    await txRevoke(managerDb, "pay_1", "กดย้ำ");

    // Re-approval (Cycle 2)
    await txApprove(managerDb, "pay_1", "อนุมัติซ้ำรอบสอง");
    const payReappSnap = await getDoc(doc(managerDb, `rooms/${roomId}/payments/pay_1`));
    assert.equal(payReappSnap.data().status, "approved");
    assert.equal(payReappSnap.data().approvalCycle, 2);

    const ledReapp = await getDoc(doc(managerDb, `rooms/${roomId}/ledgerEntries/led_app_pay_1_2`));
    assert.ok(ledReapp.exists());
    assert.equal(ledReapp.data().amountSatang, 100000);

    // --------------------------------------------------------------------------
    // 5. Approved Payment Amount Editing (Increase, No-op, Decrease)
    // --------------------------------------------------------------------------
    // Increase from 1,000 to 1,200 THB (+200 THB delta)
    await txUpdateAmount(managerDb, "pay_1", 120000, "เพิ่มยอด");
    const adj1 = await getDoc(doc(managerDb, `rooms/${roomId}/ledgerEntries/led_adj_pay_1_1`));
    assert.ok(adj1.exists());
    assert.equal(adj1.data().type, "income");
    assert.equal(adj1.data().amountSatang, 20000);

    // No-op edit to 1,200 THB
    await txUpdateAmount(managerDb, "pay_1", 120000, "กดแก้ซ้ำเลขเดิม");
    const adjNoop = await getDoc(doc(managerDb, `rooms/${roomId}/ledgerEntries/led_adj_pay_1_2`));
    assert.equal(adjNoop.exists(), false);

    // Decrease from 1,200 to 900 THB (-300 THB delta)
    await txUpdateAmount(managerDb, "pay_1", 90000, "ลดยอด");
    const adj2 = await getDoc(doc(managerDb, `rooms/${roomId}/ledgerEntries/led_adj_pay_1_2`));
    assert.ok(adj2.exists());
    assert.equal(adj2.data().type, "reversal");
    assert.equal(adj2.data().amountSatang, 30000);

    // --------------------------------------------------------------------------
    // 6. Ledger Total Consistency Check
    // --------------------------------------------------------------------------
    const currentPay1 = (await getDoc(doc(managerDb, `rooms/${roomId}/payments/pay_1`))).data();
    assert.equal(currentPay1.amountSatang, 90000);

    // Fetch all entries for pay_1:
    // led_app_pay_1_1 (+1,000)
    // led_rev_pay_1_1 (-1,000)
    // led_app_pay_1_2 (+1,000)
    // led_adj_pay_1_1 (+200)
    // led_adj_pay_1_2 (-300)
    // Net: 900 THB (90,000 satang)
    const summary = computeFinanceSummary({
      dues: [],
      payments: [currentPay1],
      expenses: [],
      ledgerEntries: [
        (await getDoc(doc(managerDb, `rooms/${roomId}/ledgerEntries/led_app_pay_1_1`))).data(),
        (await getDoc(doc(managerDb, `rooms/${roomId}/ledgerEntries/led_rev_pay_1_1`))).data(),
        (await getDoc(doc(managerDb, `rooms/${roomId}/ledgerEntries/led_app_pay_1_2`))).data(),
        (await getDoc(doc(managerDb, `rooms/${roomId}/ledgerEntries/led_adj_pay_1_1`))).data(),
        (await getDoc(doc(managerDb, `rooms/${roomId}/ledgerEntries/led_adj_pay_1_2`))).data(),
      ],
      memberUids: ["member_uid"],
    });

    assert.equal(summary.confirmedFundBalanceSatang, 90000);
    assert.equal(summary.totalIncomingSatang, 90000);
  } finally {
    await env.cleanup();
  }
});
