"use client";

import { useEffect, useMemo, useState } from "react";
import { subscribeFinance } from "./finance";
import { computeFinanceSummary, type FinanceSummary } from "./financeCalc";
import type {
  Due,
  Expense,
  FinanceSettings,
  LedgerEntry,
  Payment,
} from "./financeTypes";
import type { Member, Room } from "./types";

export function useFinance(roomId: string, room: Room | null, members: Member[], uid: string | null) {
  const [settings, setSettings] = useState<FinanceSettings | null>(null);
  const [dues, setDues] = useState<Due[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!roomId) return;

    const unsub = subscribeFinance(roomId, (data) => {
      if (data.settings !== undefined) setSettings(data.settings);
      if (data.dues !== undefined) setDues(data.dues);
      if (data.payments !== undefined) setPayments(data.payments);
      if (data.expenses !== undefined) setExpenses(data.expenses);
      if (data.ledgerEntries !== undefined) setLedgerEntries(data.ledgerEntries);
      setLoading(false);
    });

    return () => unsub();
  }, [roomId]);

  const memberUids = useMemo(() => members.map((m) => m.id), [members]);

  const summary: FinanceSummary = useMemo(() => {
    return computeFinanceSummary({
      dues,
      payments,
      expenses,
      ledgerEntries,
      memberUids,
    });
  }, [dues, payments, expenses, ledgerEntries, memberUids]);

  const isOwner = Boolean(room?.ownerUid && uid && room.ownerUid === uid);
  // สิทธิ์การเงินแบบ Collaborative: ในกลุ่มเพื่อน ทุกคนในห้องทริปสามารถช่วยกันดูแล ตั้งค่า และตรวจสลิปได้
  const isManager = Boolean(uid);

  return {
    settings,
    dues,
    payments,
    expenses,
    ledgerEntries,
    summary,
    loading,
    isOwner,
    isManager,
  };
}
