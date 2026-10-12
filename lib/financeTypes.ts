/**
 * 💸 HoneyTrip Finance & SlipOK Types
 * Represents money in integer satang (1 THB = 100 satang) to eliminate floating point errors.
 */

export type PaymentStatus =
  | "submitted"
  | "verification_pending"
  | "api_verified"
  | "manual_review"
  | "rejected"
  | "approved";

export type DueStatus = "open" | "completed" | "cancelled";
export type ExpenseStatus = "planned" | "partially_paid" | "paid";
export type LedgerEntryType = "income" | "expense" | "reversal";

export interface FinanceSettings {
  managerUid: string | null;
  receivingBank: string; // 3-digit bank code e.g. "004" (KBANK), "014" (SCB), "002" (BBL)
  receivingBankName?: string;
  receivingAccount: string; // Stored account number for verification matching
  receivingName: string; // Account holder name
  promptPayId?: string | null; // Phone or Citizen ID
  qrUrl?: string | null; // Custom PromptPay QR URL
  autoVerifyEnabled: boolean; // Toggle for SlipOK verification
  updatedBy: string;
  updatedAt: number;
}

export interface Due {
  id: string;
  title: string;
  description: string;
  dueDate: string | null; // YYYY-MM-DD
  totalAmountSatang: number;
  allocations: Record<string, number>; // memberUid -> amount in satang
  linkedActivityId: string | null;
  status: DueStatus;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface SlipSenderInfo {
  displayName?: string | null;
  name?: string | null;
  accountValue?: string | null; // Masked e.g. xxx-x-x0209-x
  proxyValue?: string | null; // Masked e.g. 086xxx7894
  proxyType?: string | null;
}

export interface SlipReceiverInfo {
  displayName?: string | null;
  name?: string | null;
  accountValue?: string | null; // Masked e.g. xxx-x-x3109-x
  proxyValue?: string | null; // Masked e.g. 086xxx0000
  proxyType?: string | null;
}

export interface SlipVerificationResult {
  success: boolean;
  transRef: string;
  transDate: string; // yyyyMMdd
  transTime: string; // HH:mm:ss
  transTimestamp?: string; // ISO 8601
  sendingBank: string; // 3-digit code
  receivingBank: string; // 3-digit code
  amount: number; // in THB from SlipOK
  amountSatang: number; // integer satang
  sender?: SlipSenderInfo;
  receiver?: SlipReceiverInfo;
  rawMessage?: string;
  isDuplicate?: boolean;
  receiverMatched?: boolean;
  matchNotes?: string;
  bankDelayMins?: number | null;
}

export interface Payment {
  id: string;
  dueId: string;
  memberUid: string;
  submittedBy: string;
  amountSatang: number;
  status: PaymentStatus;
  qrData?: string | null;
  slipResult?: SlipVerificationResult | null;
  manualNote?: string | null;
  rejectedReason?: string | null;
  approvedBy?: string | null;
  approvedAt?: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface Expense {
  id: string;
  title: string;
  category: string;
  vendor: string;
  totalCostSatang: number;
  paidAmountSatang: number;
  date: string | null; // YYYY-MM-DD
  linkedActivityId: string | null;
  status: ExpenseStatus;
  notes: string;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export interface LedgerEntry {
  id: string;
  type: LedgerEntryType;
  amountSatang: number;
  source: "payment" | "direct_expense" | "reversal";
  referenceId: string; // paymentId or expenseId
  description: string;
  memberUid?: string | null;
  createdBy: string;
  createdAt: number;
}

export interface SlipOkQuota {
  quota: number;
  overQuota: number;
  specialQuota: number;
  endDate: string;
  specialEndDate?: string | null;
}

/**
 * Monetary calculations in Integer Satang
 */
export function bahtToSatang(baht: number): number {
  if (isNaN(baht) || baht < 0) return 0;
  return Math.round(baht * 100);
}

export function satangToBaht(satang: number): number {
  if (isNaN(satang) || satang === 0) return 0;
  return satang / 100;
}

export function formatSatang(satang: number, showDecimals = false): string {
  const baht = satangToBaht(satang);
  if (showDecimals || satang % 100 !== 0) {
    return `฿${baht.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `฿${baht.toLocaleString("th-TH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
