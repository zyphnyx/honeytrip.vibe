import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  runTransaction,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { ensureWritableUser, getDb } from "./firebase";
import {
  formatSatang,
  type Due,
  type Expense,
  type FinanceSettings,
  type LedgerEntry,
  type Payment,
  type PaymentStatus,
} from "./financeTypes";

export function generateFinanceId(prefix = "fin"): string {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const str = Array.from(bytes, (b) => chars[b % chars.length]).join("");
  return `${prefix}_${str}`;
}

export interface FinanceData {
  settings: FinanceSettings | null;
  dues: Due[];
  payments: Payment[];
  expenses: Expense[];
  ledgerEntries: LedgerEntry[];
  loading: boolean;
}

/**
 * Subscribes in real-time to all finance subcollections for a given room.
 */
export function subscribeFinance(
  roomId: string,
  onData: (data: Partial<FinanceData>) => void,
  onError?: (err: Error) => void
): Unsubscribe {
  const db = getDb();
  const unsubs: Unsubscribe[] = [];

  // 1. Settings
  const settingsUnsub = onSnapshot(
    doc(db, "rooms", roomId, "financeSettings", "main"),
    (snap) => {
      onData({ settings: snap.exists() ? (snap.data() as FinanceSettings) : null });
    },
    onError
  );
  unsubs.push(settingsUnsub);

  // 2. Dues
  const duesUnsub = onSnapshot(
    collection(db, "rooms", roomId, "dues"),
    (snap) => {
      const list = snap.docs.map((d) => ({ ...(d.data() as Omit<Due, "id">), id: d.id }));
      list.sort((a, b) => b.createdAt - a.createdAt);
      onData({ dues: list });
    },
    onError
  );
  unsubs.push(duesUnsub);

  // 3. Payments
  const paymentsUnsub = onSnapshot(
    collection(db, "rooms", roomId, "payments"),
    (snap) => {
      const list = snap.docs.map((d) => ({ ...(d.data() as Omit<Payment, "id">), id: d.id }));
      list.sort((a, b) => b.createdAt - a.createdAt);
      onData({ payments: list });
    },
    onError
  );
  unsubs.push(paymentsUnsub);

  // 4. Expenses
  const expensesUnsub = onSnapshot(
    collection(db, "rooms", roomId, "expenses"),
    (snap) => {
      const list = snap.docs.map((d) => ({ ...(d.data() as Omit<Expense, "id">), id: d.id }));
      list.sort((a, b) => b.createdAt - a.createdAt);
      onData({ expenses: list });
    },
    onError
  );
  unsubs.push(expensesUnsub);

  // 5. Ledger Entries
  const ledgerUnsub = onSnapshot(
    collection(db, "rooms", roomId, "ledgerEntries"),
    (snap) => {
      const list = snap.docs.map((d) => ({ ...(d.data() as Omit<LedgerEntry, "id">), id: d.id }));
      list.sort((a, b) => b.createdAt - a.createdAt);
      onData({ ledgerEntries: list });
    },
    onError
  );
  unsubs.push(ledgerUnsub);

  return () => {
    unsubs.forEach((u) => u());
  };
}

/**
 * Saves or updates finance settings (manager appointment, receiving account)
 */
export async function saveFinanceSettings(
  roomId: string,
  settings: Partial<FinanceSettings>
): Promise<void> {
  const user = await ensureWritableUser();
  const db = getDb();
  const data: Partial<FinanceSettings> = {
    ...settings,
    updatedBy: user.uid,
    updatedAt: Date.now(),
  };
  await setDoc(doc(db, "rooms", roomId, "financeSettings", "main"), data, { merge: true });
}

/**
 * Creates a new Due (Payment Request)
 */
export async function createDue(
  roomId: string,
  input: {
    title: string;
    description: string;
    dueDate: string | null;
    totalAmountSatang: number;
    allocations: Record<string, number>;
    linkedActivityId?: string | null;
  }
): Promise<string> {
  const user = await ensureWritableUser();
  const db = getDb();
  const id = generateDueId();
  const now = Date.now();

  const due: Due = {
    id,
    title: input.title.trim(),
    description: input.description.trim(),
    dueDate: input.dueDate || null,
    totalAmountSatang: input.totalAmountSatang,
    allocations: input.allocations,
    linkedActivityId: input.linkedActivityId || null,
    status: "open",
    createdBy: user.uid,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(db, "rooms", roomId, "dues", id), due);
  return id;
}

export function generateDueId(): string {
  return generateFinanceId("due");
}

/**
 * Cancels or deletes a Due (Payment Request).
 * - If no payments exist, it deletes the document permanently from Firestore.
 * - If payments exist, it marks status as 'cancelled' to preserve transaction history.
 */
export async function cancelDue(
  roomId: string,
  dueId: string,
  hasPayments = false
): Promise<void> {
  await ensureWritableUser();
  const db = getDb();
  if (!hasPayments) {
    try {
      await deleteDoc(doc(db, "rooms", roomId, "dues", dueId));
      return;
    } catch (err) {
      console.warn("Delete due doc failed, falling back to cancel status:", err);
      await updateDoc(doc(db, "rooms", roomId, "dues", dueId), {
        status: "cancelled",
        updatedAt: Date.now(),
      });
      return;
    }
  }

  await updateDoc(doc(db, "rooms", roomId, "dues", dueId), {
    status: "cancelled",
    updatedAt: Date.now(),
  });
}

/**
 * Deletes a Due document permanently from Firestore
 */
export async function deleteDue(roomId: string, dueId: string): Promise<void> {
  await ensureWritableUser();
  const db = getDb();
  await deleteDoc(doc(db, "rooms", roomId, "dues", dueId));
}

/**
 * Submits a payment evidence from a member.
 * For manual submissions, payment enters 'manual_review' status waiting for manager confirmation.
 */
export async function submitPayment(
  roomId: string,
  input: {
    paymentId?: string;
    dueId: string;
    memberUid: string;
    amountSatang: number;
    transferDate?: string | null;
    transferTime?: string | null;
    evidence?: Payment["evidence"];
    evidenceType?: Payment["evidenceType"];
    qrData?: string | null;
    slipResult?: Payment["slipResult"];
    manualNote?: string | null;
    status?: PaymentStatus;
  }
): Promise<string> {
  const user = await ensureWritableUser();
  const db = getDb();
  const id = input.paymentId || generateFinanceId("pay");
  const now = Date.now();

  const payment: Payment = {
    id,
    dueId: input.dueId,
    memberUid: input.memberUid,
    submittedBy: user.uid,
    amountSatang: input.amountSatang,
    status: input.status || (input.slipResult?.success ? "api_verified" : "manual_review"),
    transferDate: input.transferDate || null,
    transferTime: input.transferTime || null,
    evidence: input.evidence || null,
    evidenceType: input.evidenceType || (input.evidence ? "manual_slip" : "manual_no_image"),
    qrData: input.qrData || null,
    slipResult: input.slipResult || null,
    manualNote: input.manualNote || null,
    rejectedReason: null,
    approvedBy: null,
    approvedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(db, "rooms", roomId, "payments", id), payment);
  return id;
}

/**
 * Approves a payment by finance manager using an atomic Firestore transaction.
 * 
 * Idempotency & Concurrency:
 * - Reads latest payment state inside the transaction (never stale React state).
 * - If already approved, exits idempotently without creating duplicate ledger entries.
 * - Commits payment status and deterministic income ledger entry (`led_app_${paymentId}_${cycle}`) atomically.
 * - Under concurrent double approval requests, Firestore concurrency control causes the second
 *   transaction to retry, read the approved state, and exit idempotently.
 */
export async function approvePayment(
  roomId: string,
  paymentOrId: Payment | string,
  dueTitle?: string
): Promise<void> {
  const user = await ensureWritableUser();
  const db = getDb();
  const paymentId = typeof paymentOrId === "string" ? paymentOrId : paymentOrId.id;
  const paymentRef = doc(db, "rooms", roomId, "payments", paymentId);

  await runTransaction(db, async (tx) => {
    // 1. Transactional reads (ALL reads must occur before ALL writes)
    const paymentSnap = await tx.get(paymentRef);
    if (!paymentSnap.exists()) {
      throw new Error("ไม่พบรายการแจ้งโอนเงิน");
    }

    const currentPayment = paymentSnap.data() as Payment;

    // Idempotent guard: if already approved, do not double-approve or write duplicate ledger entry
    if (currentPayment.status === "approved") {
      return;
    }

    const nextCycle = (currentPayment.approvalCycle || 0) + 1;
    const ledgerEntryId = `led_app_${paymentId}_${nextCycle}`;
    const ledgerRef = doc(db, "rooms", roomId, "ledgerEntries", ledgerEntryId);

    const ledgerSnap = await tx.get(ledgerRef);
    if (ledgerSnap.exists()) {
      return;
    }

    // 2. Transactional writes
    const now = Date.now();

    tx.update(paymentRef, {
      status: "approved",
      approvalCycle: nextCycle,
      approvedBy: user.uid,
      approvedAt: now,
      updatedAt: now,
    });

    const entry: LedgerEntry = {
      id: ledgerEntryId,
      type: "income",
      amountSatang: currentPayment.amountSatang,
      source: "payment",
      referenceId: paymentId,
      description: `รับเงินค่า${dueTitle || "ทริป"} จากสมาชิก`,
      memberUid: currentPayment.memberUid,
      createdBy: user.uid,
      createdAt: now,
    };

    tx.set(ledgerRef, entry);
  });
}

/**
 * Manually updates the amount of a payment using an atomic Firestore transaction.
 * 
 * - If the payment is already approved:
 *   Calculates delta using latest stored amount (never stale React state).
 *   Atomically updates the payment amount and appends a deterministic adjustment ledger entry
 *   (`led_adj_${paymentId}_${nextSeq}`):
 *   - If increased: creates an 'income' entry for the positive difference.
 *   - If decreased: creates a 'reversal' entry for the negative difference.
 *   - If same amount: no-op (exits without writes).
 * - If the payment is not approved:
 *   Updates the payment amount and note without creating any ledger entry.
 */
export async function updatePaymentAmount(
  roomId: string,
  paymentOrId: Payment | string,
  newAmountSatang: number,
  dueTitle?: string,
  reason?: string
): Promise<void> {
  const user = await ensureWritableUser();
  const db = getDb();
  const paymentId = typeof paymentOrId === "string" ? paymentOrId : paymentOrId.id;
  const paymentRef = doc(db, "rooms", roomId, "payments", paymentId);

  if (newAmountSatang <= 0) {
    throw new Error("จำนวนเงินต้องมากกว่า 0 บาท");
  }

  await runTransaction(db, async (tx) => {
    // 1. Transactional reads
    const paymentSnap = await tx.get(paymentRef);
    if (!paymentSnap.exists()) {
      throw new Error("ไม่พบรายการแจ้งโอนเงิน");
    }

    const currentPayment = paymentSnap.data() as Payment;

    if (newAmountSatang === currentPayment.amountSatang) {
      return;
    }

    const isApproved = currentPayment.status === "approved";
    const nextSeq = (currentPayment.editSeq || 0) + 1;
    const adjustmentEntryId = `led_adj_${paymentId}_${nextSeq}`;
    const adjustmentRef = doc(db, "rooms", roomId, "ledgerEntries", adjustmentEntryId);

    if (isApproved) {
      const adjustmentSnap = await tx.get(adjustmentRef);
      if (adjustmentSnap.exists()) {
        return;
      }
    }

    // 2. Transactional writes
    const now = Date.now();
    const noteSuffix = reason
      ? ` [แก้ไขยอดเป็น ${formatSatang(newAmountSatang)}: ${reason.trim()}]`
      : ` [แก้ไขยอดเป็น ${formatSatang(newAmountSatang)}]`;
    const updatedNote = currentPayment.manualNote
      ? `${currentPayment.manualNote}${noteSuffix}`
      : noteSuffix.trim();

    tx.update(paymentRef, {
      amountSatang: newAmountSatang,
      manualNote: updatedNote,
      editSeq: nextSeq,
      updatedAt: now,
    });

    if (isApproved) {
      const deltaSatang = newAmountSatang - currentPayment.amountSatang;
      if (deltaSatang < 0) {
        const entry: LedgerEntry = {
          id: adjustmentEntryId,
          type: "reversal",
          amountSatang: Math.abs(deltaSatang),
          source: "payment",
          referenceId: paymentId,
          description: `ปรับปรุงลดยอดเงินโอน${dueTitle ? ` (${dueTitle})` : ""} จาก ${formatSatang(currentPayment.amountSatang)} เป็น ${formatSatang(newAmountSatang)}${reason ? `: ${reason.trim()}` : ""}`,
          memberUid: currentPayment.memberUid,
          createdBy: user.uid,
          createdAt: now,
        };
        tx.set(adjustmentRef, entry);
      } else if (deltaSatang > 0) {
        const entry: LedgerEntry = {
          id: adjustmentEntryId,
          type: "income",
          amountSatang: deltaSatang,
          source: "payment",
          referenceId: paymentId,
          description: `ปรับปรุงเพิ่มยอดเงินโอน${dueTitle ? ` (${dueTitle})` : ""} จาก ${formatSatang(currentPayment.amountSatang)} เป็น ${formatSatang(newAmountSatang)}${reason ? `: ${reason.trim()}` : ""}`,
          memberUid: currentPayment.memberUid,
          createdBy: user.uid,
          createdAt: now,
        };
        tx.set(adjustmentRef, entry);
      }
    }
  });
}

/**
 * Revokes an approved payment by appending a full reversal ledger entry
 * and changing payment status back to 'rejected' in an atomic Firestore transaction.
 * 
 * Idempotency & Cycles:
 * - Reads latest payment state inside the transaction.
 * - If not approved (already rejected or revoked), exits idempotently without duplicate reversals.
 * - Appends a deterministic reversal ledger entry (`led_rev_${paymentId}_${cycle}`)
 *   and updates payment status to 'rejected' atomically.
 * - Supports legitimate approval -> revoke -> re-approve cycles with unique deterministic ledger IDs.
 */
export async function revokeApprovedPayment(
  roomId: string,
  paymentOrId: Payment | string,
  reason: string
): Promise<void> {
  const user = await ensureWritableUser();
  const db = getDb();
  const paymentId = typeof paymentOrId === "string" ? paymentOrId : paymentOrId.id;
  const paymentRef = doc(db, "rooms", roomId, "payments", paymentId);

  await runTransaction(db, async (tx) => {
    // 1. Transactional reads
    const paymentSnap = await tx.get(paymentRef);
    if (!paymentSnap.exists()) {
      throw new Error("ไม่พบรายการแจ้งโอนเงิน");
    }

    const currentPayment = paymentSnap.data() as Payment;

    if (currentPayment.status !== "approved") {
      return;
    }

    const currentCycle = currentPayment.approvalCycle || 1;
    const reversalEntryId = `led_rev_${paymentId}_${currentCycle}`;
    const ledgerRef = doc(db, "rooms", roomId, "ledgerEntries", reversalEntryId);

    const ledgerSnap = await tx.get(ledgerRef);
    if (ledgerSnap.exists()) {
      return;
    }

    // 2. Transactional writes
    const now = Date.now();

    tx.update(paymentRef, {
      status: "rejected",
      rejectedReason: reason.trim() || "ยกเลิกการอนุมัติเพื่อแก้ไขยอด",
      updatedAt: now,
    });

    const entry: LedgerEntry = {
      id: reversalEntryId,
      type: "reversal",
      amountSatang: currentPayment.amountSatang,
      source: "payment",
      referenceId: paymentId,
      description: `ยกเลิกการอนุมัติยอดโอน: ${reason.trim() || "แก้ไขข้อผิดพลาด"}`,
      memberUid: currentPayment.memberUid,
      createdBy: user.uid,
      createdAt: now,
    };

    tx.set(ledgerRef, entry);
  });
}

/**
 * Rejects an unapproved payment with a reason.
 * If the payment is already approved, throws to prevent inconsistent ledger state
 * (must use revokeApprovedPayment instead).
 */
export async function rejectPayment(
  roomId: string,
  paymentId: string,
  reason: string
): Promise<void> {
  await ensureWritableUser();
  const db = getDb();
  const paymentRef = doc(db, "rooms", roomId, "payments", paymentId);

  await runTransaction(db, async (tx) => {
    const snap = await tx.get(paymentRef);
    if (!snap.exists()) return;
    const currentPayment = snap.data() as Payment;
    if (currentPayment.status === "approved") {
      throw new Error("รายการนี้ได้รับการอนุมัติแล้ว หากต้องการยกเลิกกรุณาใช้ปุ่มยกเลิกการอนุมัติ");
    }
    tx.update(paymentRef, {
      status: "rejected",
      rejectedReason: reason.trim(),
      updatedAt: Date.now(),
    });
  });
}

/**
 * Deletes a payment document (e.g. for cleaning up rejected slips)
 */
export async function deletePayment(roomId: string, paymentId: string): Promise<void> {
  await ensureWritableUser();
  const db = getDb();
  await deleteDoc(doc(db, "rooms", roomId, "payments", paymentId));
}

/**
 * Records a vendor expense disbursement atomically.
 * If paidAmountSatang > 0, creates the expense document and its outgoing ledger entry
 * (`led_exp_${expenseId}_1`) in a single atomic transaction.
 */
export async function createExpense(
  roomId: string,
  input: {
    title: string;
    category: string;
    vendor: string;
    totalCostSatang: number;
    paidAmountSatang: number;
    date: string | null;
    linkedActivityId?: string | null;
    notes?: string;
  }
): Promise<string> {
  const user = await ensureWritableUser();
  const db = getDb();
  const expenseId = generateFinanceId("exp");
  const expenseRef = doc(db, "rooms", roomId, "expenses", expenseId);
  const ledgerEntryId = `led_exp_${expenseId}_1`;
  const ledgerRef = doc(db, "rooms", roomId, "ledgerEntries", ledgerEntryId);

  const status =
    input.paidAmountSatang >= input.totalCostSatang
      ? "paid"
      : input.paidAmountSatang > 0
      ? "partially_paid"
      : "planned";

  await runTransaction(db, async (tx) => {
    // 1. Transactional reads
    if (input.paidAmountSatang > 0) {
      const ledgerSnap = await tx.get(ledgerRef);
      if (ledgerSnap.exists()) return;
    }

    // 2. Transactional writes
    const now = Date.now();
    const expense: Expense = {
      id: expenseId,
      title: input.title.trim(),
      category: input.category || "other",
      vendor: input.vendor.trim(),
      totalCostSatang: input.totalCostSatang,
      paidAmountSatang: input.paidAmountSatang,
      date: input.date || null,
      linkedActivityId: input.linkedActivityId || null,
      status,
      notes: input.notes?.trim() || "",
      paidSeq: input.paidAmountSatang > 0 ? 1 : 0,
      createdBy: user.uid,
      createdAt: now,
      updatedAt: now,
    };

    tx.set(expenseRef, expense);

    if (input.paidAmountSatang > 0) {
      const entry: LedgerEntry = {
        id: ledgerEntryId,
        type: "expense",
        amountSatang: input.paidAmountSatang,
        source: "direct_expense",
        referenceId: expenseId,
        description: `จ่ายค่า${input.title.trim()} ให้ ${input.vendor.trim() || "ผู้ให้บริการ"}`,
        createdBy: user.uid,
        createdAt: now,
      };
      tx.set(ledgerRef, entry);
    }
  });

  return expenseId;
}

/**
 * Updates an existing vendor expense atomically using runTransaction.
 * If additional money was paid beyond current stored paid amount,
 * appends an outgoing ledger entry (`led_exp_${expenseId}_${nextPaidSeq}`)
 * for the incremental payment amount atomically.
 */
export async function updateExpense(
  roomId: string,
  expenseId: string,
  existingExpense: Expense, // Kept for signature compatibility; latest state is read from Firestore
  updates: {
    title: string;
    category: string;
    vendor: string;
    totalCostSatang: number;
    paidAmountSatang: number;
    date: string | null;
    linkedActivityId?: string | null;
    notes?: string;
  }
): Promise<void> {
  const user = await ensureWritableUser();
  const db = getDb();
  const expenseRef = doc(db, "rooms", roomId, "expenses", expenseId);

  await runTransaction(db, async (tx) => {
    // 1. Transactional reads
    const expenseSnap = await tx.get(expenseRef);
    if (!expenseSnap.exists()) {
      throw new Error("ไม่พบรายการค่าใช้จ่าย");
    }

    const currentExpense = expenseSnap.data() as Expense;
    const currentPaidSatang = currentExpense.paidAmountSatang || 0;
    const deltaPaidSatang = updates.paidAmountSatang - currentPaidSatang;

    const nextPaidSeq = (currentExpense.paidSeq || 1) + 1;
    const ledgerEntryId = `led_exp_${expenseId}_${nextPaidSeq}`;
    const ledgerRef = doc(db, "rooms", roomId, "ledgerEntries", ledgerEntryId);

    if (deltaPaidSatang > 0) {
      const ledgerSnap = await tx.get(ledgerRef);
      if (ledgerSnap.exists()) return;
    }

    // 2. Transactional writes
    const now = Date.now();
    const status =
      updates.paidAmountSatang >= updates.totalCostSatang
        ? "paid"
        : updates.paidAmountSatang > 0
        ? "partially_paid"
        : "planned";

    const updatedExpense: Partial<Expense> = {
      title: updates.title.trim(),
      category: updates.category || "other",
      vendor: updates.vendor.trim(),
      totalCostSatang: updates.totalCostSatang,
      paidAmountSatang: updates.paidAmountSatang,
      date: updates.date || null,
      linkedActivityId: updates.linkedActivityId || null,
      status,
      notes: updates.notes?.trim() || "",
      paidSeq: deltaPaidSatang > 0 ? nextPaidSeq : currentExpense.paidSeq || 1,
      updatedAt: now,
    };

    tx.update(expenseRef, updatedExpense);

    if (deltaPaidSatang > 0) {
      const isFullSettlement = updates.paidAmountSatang >= updates.totalCostSatang;
      const entry: LedgerEntry = {
        id: ledgerEntryId,
        type: "expense",
        amountSatang: deltaPaidSatang,
        source: "direct_expense",
        referenceId: expenseId,
        description: isFullSettlement
          ? `จ่ายค่า${updates.title.trim()} (ส่วนที่เหลือ) ให้ ${updates.vendor.trim() || "ผู้ให้บริการ"}`
          : `จ่ายค่า${updates.title.trim()} (เพิ่มเติม) ให้ ${updates.vendor.trim() || "ผู้ให้บริการ"}`,
        createdBy: user.uid,
        createdAt: now,
      };
      tx.set(ledgerRef, entry);
    }
  });
}

/**
 * Deletes an expense document
 */
export async function deleteExpense(roomId: string, expenseId: string): Promise<void> {
  await ensureWritableUser();
  const db = getDb();
  await deleteDoc(doc(db, "rooms", roomId, "expenses", expenseId));
}
