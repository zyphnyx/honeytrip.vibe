import type {
  Due,
  Expense,
  LedgerEntry,
  Payment,
} from "./financeTypes.ts";

export interface MemberFinancialStatus {
  memberUid: string;
  owedSatang: number;
  paidSatang: number;
  pendingSatang: number;
  outstandingSatang: number;
  isSettled: boolean;
}

export interface FinanceSummary {
  confirmedFundBalanceSatang: number;
  totalIncomingSatang: number;
  totalOutgoingSatang: number;
  totalConfirmedInflowSatang: number;
  totalConfirmedOutflowSatang: number;
  pendingReviewCount: number;
  totalOutstandingSatang: number;
  totalOutstandingDuesSatang: number;
  vendorRemainingSatang: number;
  totalPendingVendorLiabilitySatang: number;
  members: Record<string, MemberFinancialStatus>;
  memberBalances: Record<
    string,
    {
      allocatedSatang: number;
      approvedPaidSatang: number;
      outstandingSatang: number;
      pendingSatang: number;
    }
  >;
}

/**
 * Calculates complete financial status using append-only ledger entries and approved payments.
 */
export function computeFinanceSummary({
  dues = [],
  payments = [],
  expenses = [],
  ledgerEntries = [],
  memberUids = [],
}: {
  dues: Due[];
  payments: Payment[];
  expenses: Expense[];
  ledgerEntries: LedgerEntry[];
  memberUids: string[];
}): FinanceSummary {
  // 1. Confirmed Fund Balance from Ledger
  let totalIncomingSatang = 0;
  let totalOutgoingSatang = 0;

  for (const entry of ledgerEntries) {
    if (entry.type === "income") {
      totalIncomingSatang += entry.amountSatang;
    } else if (entry.type === "expense") {
      totalOutgoingSatang += entry.amountSatang;
    } else if (entry.type === "reversal") {
      // Reversals reduce income
      totalIncomingSatang -= entry.amountSatang;
    }
  }

  const confirmedFundBalanceSatang = Math.max(0, totalIncomingSatang - totalOutgoingSatang);

  // 2. Pending Review Count
  const pendingReviewCount = payments.filter((p) =>
    ["submitted", "verification_pending", "api_verified", "manual_review"].includes(p.status)
  ).length;

  // 3. Vendor remaining liability
  let vendorRemainingSatang = 0;
  for (const exp of expenses) {
    if (exp.status !== "paid") {
      const remaining = Math.max(0, exp.totalCostSatang - (exp.paidAmountSatang || 0));
      vendorRemainingSatang += remaining;
    }
  }

  // 4. Member-level dues and payments
  const membersMap: Record<string, MemberFinancialStatus> = {};
  const allUids = new Set<string>(memberUids);

  // Collect member allocations from active dues
  for (const due of dues) {
    if (due.status === "cancelled") continue;
    for (const [mUid, amount] of Object.entries(due.allocations || {})) {
      allUids.add(mUid);
      if (!membersMap[mUid]) {
        membersMap[mUid] = {
          memberUid: mUid,
          owedSatang: 0,
          paidSatang: 0,
          pendingSatang: 0,
          outstandingSatang: 0,
          isSettled: false,
        };
      }
      membersMap[mUid].owedSatang += amount;
    }
  }

  // Initialize any remaining members
  for (const mUid of allUids) {
    if (!membersMap[mUid]) {
      membersMap[mUid] = {
        memberUid: mUid,
        owedSatang: 0,
        paidSatang: 0,
        pendingSatang: 0,
        outstandingSatang: 0,
        isSettled: true,
      };
    }
  }

  // Account for payments
  for (const p of payments) {
    const mUid = p.memberUid;
    if (!membersMap[mUid]) {
      membersMap[mUid] = {
        memberUid: mUid,
        owedSatang: 0,
        paidSatang: 0,
        pendingSatang: 0,
        outstandingSatang: 0,
        isSettled: false,
      };
    }

    if (p.status === "approved") {
      membersMap[mUid].paidSatang += p.amountSatang;
    } else if (["submitted", "verification_pending", "api_verified", "manual_review"].includes(p.status)) {
      membersMap[mUid].pendingSatang += p.amountSatang;
    }
  }

  // Calculate final outstanding and settlement per member
  let totalOutstandingSatang = 0;
  const memberBalances: FinanceSummary["memberBalances"] = {};

  for (const status of Object.values(membersMap)) {
    status.outstandingSatang = Math.max(0, status.owedSatang - status.paidSatang);
    status.isSettled = status.outstandingSatang === 0;
    totalOutstandingSatang += status.outstandingSatang;

    memberBalances[status.memberUid] = {
      allocatedSatang: status.owedSatang,
      approvedPaidSatang: status.paidSatang,
      outstandingSatang: status.outstandingSatang,
      pendingSatang: status.pendingSatang,
    };
  }

  return {
    confirmedFundBalanceSatang,
    totalIncomingSatang,
    totalOutgoingSatang,
    totalConfirmedInflowSatang: totalIncomingSatang,
    totalConfirmedOutflowSatang: totalOutgoingSatang,
    pendingReviewCount,
    totalOutstandingSatang,
    totalOutstandingDuesSatang: totalOutstandingSatang,
    vendorRemainingSatang,
    totalPendingVendorLiabilitySatang: vendorRemainingSatang,
    members: membersMap,
    memberBalances,
  };
}

/**
 * Breakdown for a single payment request (Due), supporting multiple installments per member
 */
export function getDuePaymentProgress(due: Due, payments: Payment[]) {
  const duePayments = payments.filter((p) => p.dueId === due.id);
  const byMember: Record<
    string,
    {
      owedSatang: number;
      approvedSatang: number;
      pendingSatang: number;
      remainingSatang: number;
      installmentsCount: number;
    }
  > = {};

  let totalPaidSatang = 0;
  let totalPendingSatang = 0;

  for (const [mUid, owed] of Object.entries(due.allocations || {})) {
    byMember[mUid] = {
      owedSatang: owed,
      approvedSatang: 0,
      pendingSatang: 0,
      remainingSatang: owed,
      installmentsCount: 0,
    };
  }

  for (const p of duePayments) {
    if (!byMember[p.memberUid]) {
      byMember[p.memberUid] = {
        owedSatang: 0,
        approvedSatang: 0,
        pendingSatang: 0,
        remainingSatang: 0,
        installmentsCount: 0,
      };
    }

    if (p.status === "approved") {
      byMember[p.memberUid].approvedSatang += p.amountSatang;
      byMember[p.memberUid].installmentsCount += 1;
      totalPaidSatang += p.amountSatang;
    } else if (["submitted", "verification_pending", "api_verified", "manual_review"].includes(p.status)) {
      byMember[p.memberUid].pendingSatang += p.amountSatang;
      totalPendingSatang += p.amountSatang;
    }
  }

  for (const row of Object.values(byMember)) {
    row.remainingSatang = Math.max(0, row.owedSatang - row.approvedSatang);
  }

  const isFullySettled = totalPaidSatang >= due.totalAmountSatang && due.totalAmountSatang > 0;

  return {
    totalOwedSatang: due.totalAmountSatang,
    totalSatang: due.totalAmountSatang,
    totalPaidSatang,
    collectedSatang: totalPaidSatang,
    totalPendingSatang,
    remainingSatang: Math.max(0, due.totalAmountSatang - totalPaidSatang),
    isFullySettled,
    byMember,
    payments: duePayments,
  };
}
