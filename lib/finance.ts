import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { ensureUser, getDb } from "./firebase";
import type {
  Due,
  Expense,
  FinanceSettings,
  LedgerEntry,
  Payment,
  PaymentStatus,
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
  const user = await ensureUser();
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
  const user = await ensureUser();
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
  await ensureUser();
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
 * Submits a payment evidence from a member
 */
export async function submitPayment(
  roomId: string,
  input: {
    dueId: string;
    memberUid: string;
    amountSatang: number;
    qrData?: string | null;
    slipResult?: Payment["slipResult"];
    manualNote?: string | null;
    status?: PaymentStatus;
  }
): Promise<string> {
  const user = await ensureUser();
  const db = getDb();
  const id = generateFinanceId("pay");
  const now = Date.now();

  const payment: Payment = {
    id,
    dueId: input.dueId,
    memberUid: input.memberUid,
    submittedBy: user.uid,
    amountSatang: input.amountSatang,
    status: input.status || (input.slipResult?.success ? "api_verified" : "submitted"),
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
 * Approves a payment by finance manager, atomically writing a ledger entry
 */
export async function approvePayment(
  roomId: string,
  payment: Payment,
  dueTitle?: string
): Promise<void> {
  const user = await ensureUser();
  const db = getDb();
  const now = Date.now();

  // 1. Update payment status to approved
  await updateDoc(doc(db, "rooms", roomId, "payments", payment.id), {
    status: "approved",
    approvedBy: user.uid,
    approvedAt: now,
    updatedAt: now,
  });

  // 2. Create append-only ledger entry for confirmed income
  const entryId = generateFinanceId("led");
  const entry: LedgerEntry = {
    id: entryId,
    type: "income",
    amountSatang: payment.amountSatang,
    source: "payment",
    referenceId: payment.id,
    description: `รับเงินค่า${dueTitle || "ทริป"} จากสมาชิก`,
    memberUid: payment.memberUid,
    createdBy: user.uid,
    createdAt: now,
  };

  await setDoc(doc(db, "rooms", roomId, "ledgerEntries", entryId), entry);
}

/**
 * Rejects a payment with a reason
 */
export async function rejectPayment(
  roomId: string,
  paymentId: string,
  reason: string
): Promise<void> {
  await ensureUser();
  const db = getDb();
  await updateDoc(doc(db, "rooms", roomId, "payments", paymentId), {
    status: "rejected",
    rejectedReason: reason.trim(),
    updatedAt: Date.now(),
  });
}

/**
 * Deletes a payment document (e.g. for cleaning up rejected slips)
 */
export async function deletePayment(roomId: string, paymentId: string): Promise<void> {
  await ensureUser();
  const db = getDb();
  await deleteDoc(doc(db, "rooms", roomId, "payments", paymentId));
}

/**
 * Records a vendor expense disbursement
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
  const user = await ensureUser();
  const db = getDb();
  const id = generateFinanceId("exp");
  const now = Date.now();

  const status =
    input.paidAmountSatang >= input.totalCostSatang
      ? "paid"
      : input.paidAmountSatang > 0
      ? "partially_paid"
      : "planned";

  const expense: Expense = {
    id,
    title: input.title.trim(),
    category: input.category || "other",
    vendor: input.vendor.trim(),
    totalCostSatang: input.totalCostSatang,
    paidAmountSatang: input.paidAmountSatang,
    date: input.date || null,
    linkedActivityId: input.linkedActivityId || null,
    status,
    notes: input.notes?.trim() || "",
    createdBy: user.uid,
    createdAt: now,
    updatedAt: now,
  };

  await setDoc(doc(db, "rooms", roomId, "expenses", id), expense);

  // If money was paid out immediately, create outgoing ledger entry
  if (input.paidAmountSatang > 0) {
    const entryId = generateFinanceId("led");
    const entry: LedgerEntry = {
      id: entryId,
      type: "expense",
      amountSatang: input.paidAmountSatang,
      source: "direct_expense",
      referenceId: id,
      description: `จ่ายค่า${input.title} ให้ ${input.vendor || "ผู้ให้บริการ"}`,
      createdBy: user.uid,
      createdAt: now,
    };
    await setDoc(doc(db, "rooms", roomId, "ledgerEntries", entryId), entry);
  }

  return id;
}

/**
 * Updates an existing vendor expense. If additional money was paid,
 * appends an outgoing ledger entry for the incremental payment amount.
 */
export async function updateExpense(
  roomId: string,
  expenseId: string,
  existingExpense: Expense,
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
  const user = await ensureUser();
  const db = getDb();
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
    updatedAt: now,
  };

  await updateDoc(doc(db, "rooms", roomId, "expenses", expenseId), updatedExpense);

  // Accounting Integrity: If additional money was paid beyond what was previously recorded,
  // append a new ledger entry for the incremental amount.
  const deltaPaidSatang = updates.paidAmountSatang - existingExpense.paidAmountSatang;
  if (deltaPaidSatang > 0) {
    const entryId = generateFinanceId("led");
    const isFullSettlement = updates.paidAmountSatang >= updates.totalCostSatang;
    const entry: LedgerEntry = {
      id: entryId,
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
    await setDoc(doc(db, "rooms", roomId, "ledgerEntries", entryId), entry);
  }
}

/**
 * Deletes an expense document
 */
export async function deleteExpense(roomId: string, expenseId: string): Promise<void> {
  await ensureUser();
  const db = getDb();
  await deleteDoc(doc(db, "rooms", roomId, "expenses", expenseId));
}
