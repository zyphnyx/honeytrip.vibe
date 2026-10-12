"use client";

import { useState } from "react";
import Link from "next/link";
import { formatSatang, type Due, type Expense } from "@/lib/financeTypes";
import { useFinance } from "@/lib/useFinance";
import { getDuePaymentProgress } from "@/lib/financeCalc";
import { cancelDue } from "@/lib/finance";
import type { Member, Room } from "@/lib/types";

// Modals & subcomponents
import PaymentUploadModal from "./PaymentUploadModal";
import DueCreateModal from "./DueCreateModal";
import ExpenseModal from "./ExpenseModal";
import FinanceSettingsModal from "./FinanceSettingsModal";
import ManagerReviewQueue from "./ManagerReviewQueue";
import FinanceReportExport from "./FinanceReportExport";

interface TripFinanceProps {
  roomId: string;
  room: Room;
  members: Member[];
  uid: string;
  activities?: Array<{ id: string; title: string }>;
}

export function TripFinance({
  roomId,
  room,
  members,
  uid,
  activities = [],
}: TripFinanceProps) {
  const {
    settings,
    dues,
    payments,
    expenses,
    ledgerEntries,
    summary,
    loading,
    isOwner,
    isManager,
  } = useFinance(roomId, room, members, uid);

  // Active Tab
  const [activeTab, setActiveTab] = useState<
    "my_dues" | "all_dues" | "reviews" | "expenses" | "ledger"
  >("my_dues");

  // Modal controls
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedDueForPayment, setSelectedDueForPayment] = useState<Due | null>(null);
  const [isDueCreateOpen, setIsDueCreateOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSettledDuesOpen, setIsSettledDuesOpen] = useState(true);
  const [isCancelledDuesOpen, setIsCancelledDuesOpen] = useState(false);
  const [cancellingDueId, setCancellingDueId] = useState<string | null>(null);

  const getMemberName = (memberUid: string) => {
    const m = members.find((mem) => mem.id === memberUid);
    return m ? m.name : "สมาชิก";
  };

  const handleOpenPayment = (due?: Due) => {
    setSelectedDueForPayment(due || null);
    setIsPaymentModalOpen(true);
  };

  const handleOpenNewExpense = () => {
    setEditingExpense(null);
    setIsExpenseModalOpen(true);
  };

  const handleEditExpense = (exp: Expense) => {
    setEditingExpense(exp);
    setIsExpenseModalOpen(true);
  };

  const handleQuickPayFull = (exp: Expense) => {
    // Pre-fill with remaining amount paid to mark fully paid
    setEditingExpense({
      ...exp,
      paidAmountSatang: exp.totalCostSatang,
    });
    setIsExpenseModalOpen(true);
  };

  const handleCancelDue = async (due: Due) => {
    const relatedPayments = payments.filter((p) => p.dueId === due.id);
    const approvedPayments = relatedPayments.filter((p) => p.status === "approved");
    const approvedTotal = approvedPayments.reduce((sum, p) => sum + p.amountSatang, 0);

    let confirmMsg = "";
    if (approvedPayments.length > 0) {
      confirmMsg = `⚠️ งวด "${due.title}" มีรายการโอนที่อนุมัติเข้ากองกลางแล้ว ${approvedPayments.length} รายการ (รวม ${formatSatang(approvedTotal)})\n\nหากยกเลิก งวดนี้จะถูกปรับสถานะเป็น "ยกเลิก" เพื่อคงยอดเงินจริงในสมุดบัญชีกองกลางไว้\n\nคุณแน่ใจหรือไม่ว่าต้องการยกเลิกงวดนี้?`;
    } else if (relatedPayments.length > 0) {
      confirmMsg = `⚠️ งวด "${due.title}" มีรายการแจ้งโอนที่รอตรวจสอบ ${relatedPayments.length} รายการ\n\nต้องการยืนยันการยกเลิกงวดนี้ใช่หรือไม่?`;
    } else {
      confirmMsg = `ต้องการยกเลิกงวดเก็บเงิน "${due.title}" (กรณีตั้งผิด/ไม่ใช้แล้ว) ใช่หรือไม่?`;
    }

    if (!window.confirm(confirmMsg)) return;

    try {
      setCancellingDueId(due.id);
      await cancelDue(roomId, due.id, relatedPayments.length > 0);
    } catch (err) {
      console.error("Failed to cancel due:", err);
      alert("เกิดข้อผิดพลาดในการยกเลิกงวดเก็บเงิน กรุณาลองใหม่อีกครั้ง");
    } finally {
      setCancellingDueId(null);
    }
  };

  // My Dues calculation
  const myDuesList = dues.filter(
    (d) => d.status !== "cancelled" && d.allocations && d.allocations[uid] !== undefined
  );

  if (loading) {
    return (
      <div className="card py-12 text-center text-stone-600 space-y-3">
        <div className="text-3xl animate-pulse">💸</div>
        <p className="text-sm font-semibold">กำลังเชื่อมต่อระบบการเงินทริป...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href={`/t/${roomId}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 hover:text-amber-700 bg-white/80 px-3 py-1.5 rounded-xl border border-stone-200/80 shadow-2xs transition-colors"
        >
          <span>←</span> กลับห้องทริป
        </Link>
        <div className="flex items-center gap-2">
          <FinanceReportExport
            roomId={roomId}
            room={room}
            summary={summary}
            dues={dues}
            payments={payments}
            expenses={expenses}
            ledgerEntries={ledgerEntries}
            members={members}
          />
        </div>
      </div>

      {/* Header — Floating Centered Hero (Hallmark Anti-slop: borderless floating canvas with generous breathing room) */}
      <div className="pt-3 sm:pt-4 pb-2 text-center">
        {/* Title */}
        <div className="inline-flex items-center justify-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-100/80 text-xl border border-amber-200/80 shadow-2xs">
            💸
          </span>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-stone-900">
            การเงินทริป
          </h1>
        </div>

        {/* Quick Actions Bar — Centered below title with generous breathing room */}
        <div className="mt-4 sm:mt-5 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3.5">
          <button
            onClick={() => handleOpenPayment()}
            className="px-4.5 sm:px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-amber-300 text-xs sm:text-[13px] font-bold shadow-xs hover:shadow-sm transition-all active:scale-95 flex items-center gap-2 cursor-pointer"
          >
            <span>📤</span> แจ้งโอนเงิน
          </button>
          {isManager && (
            <>
              <button
                onClick={() => setIsDueCreateOpen(true)}
                className="px-4 py-2.5 rounded-xl bg-white hover:bg-stone-50 text-stone-900 text-xs sm:text-[13px] font-bold border border-stone-200/90 shadow-2xs hover:shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <span>➕</span> สร้างงวดเก็บเงิน
              </button>
              <button
                onClick={() => handleOpenNewExpense()}
                className="px-4 py-2.5 rounded-xl bg-white hover:bg-stone-50 text-stone-900 text-xs sm:text-[13px] font-bold border border-stone-200/90 shadow-2xs hover:shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <span>🧾</span> บันทึกรายจ่าย
              </button>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="px-3.5 sm:px-4 py-2.5 rounded-xl bg-white hover:bg-stone-50 text-stone-900 text-xs sm:text-[13px] font-bold border border-stone-200/90 shadow-2xs hover:shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                title="ตั้งค่าบัญชี & SlipOK"
              >
                <span>⚙️</span>
                <span className="hidden sm:inline">ตั้งค่าบัญชี</span>
              </button>
            </>
          )}
        </div>

        {/* Hero Balance & Metrics Cards — Floating Clean Grid with comfortable top separation */}
        <div className="mt-7 sm:mt-8 grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5 text-left">
          <div className="bg-white/90 backdrop-blur-xs rounded-2xl p-3.5 border border-stone-200/80 shadow-2xs hover:border-amber-300/80 transition-colors">
            <div className="text-[11px] text-stone-600 font-bold flex items-center gap-1">
              <span>💰</span> กองกลางคงเหลือ
            </div>
            <div className="text-lg sm:text-xl font-black text-stone-900 mt-1 tracking-tight">
              {formatSatang(summary.confirmedFundBalanceSatang)}
            </div>
            <div className="text-[10px] text-stone-500 mt-0.5 font-medium">เงินที่เข้าบัญชีจริง</div>
          </div>

          <div className="bg-white/90 backdrop-blur-xs rounded-2xl p-3.5 border border-stone-200/80 shadow-2xs hover:border-emerald-300/80 transition-colors">
            <div className="text-[11px] text-emerald-800 font-bold flex items-center gap-1">
              <span>📥</span> รับเข้าแล้วทั้งหมด
            </div>
            <div className="text-base sm:text-lg font-black text-emerald-700 mt-1 tracking-tight">
              {formatSatang(summary.totalConfirmedInflowSatang)}
            </div>
            <div className="text-[10px] text-emerald-700/80 mt-0.5 font-medium">จากเงินโอนที่อนุมัติแล้ว</div>
          </div>

          <div className="bg-white/90 backdrop-blur-xs rounded-2xl p-3.5 border border-stone-200/80 shadow-2xs hover:border-rose-300/80 transition-colors">
            <div className="text-[11px] text-rose-800 font-bold flex items-center gap-1">
              <span>📤</span> จ่ายออกแล้วทั้งหมด
            </div>
            <div className="text-base sm:text-lg font-black text-rose-700 mt-1 tracking-tight">
              {formatSatang(summary.totalConfirmedOutflowSatang)}
            </div>
            <div className="text-[10px] text-rose-700/80 mt-0.5 font-medium">รวมค่าใช้จ่ายทั้งหมด</div>
          </div>

          <div className="bg-white/90 backdrop-blur-xs rounded-2xl p-3.5 border border-stone-200/80 shadow-2xs hover:border-amber-300/80 transition-colors">
            <div className="text-[11px] text-amber-900 font-bold flex items-center gap-1">
              <span>⏳</span> ยอดรอสมาชิกโอน
            </div>
            <div className="text-base sm:text-lg font-black text-amber-900 mt-1 tracking-tight">
              {formatSatang(summary.totalOutstandingDuesSatang)}
            </div>
            <div className="text-[10px] text-amber-800/80 mt-0.5 font-medium">
              {summary.pendingReviewCount > 0
                ? `⚡ รอตรวจ ${summary.pendingReviewCount} รายการ`
                : "ครบถ้วน"}
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="-mx-4 px-4 sm:mx-0 sm:px-0 flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none border-b border-stone-200">
        <button
          onClick={() => setActiveTab("my_dues")}
          className={`px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 whitespace-nowrap transition-all cursor-pointer ${
            activeTab === "my_dues"
              ? "bg-amber-500 text-white shadow-xs"
              : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
          }`}
        >
          👤 ภาระของฉัน
        </button>
        <button
          onClick={() => setActiveTab("all_dues")}
          className={`px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 whitespace-nowrap transition-all cursor-pointer ${
            activeTab === "all_dues"
              ? "bg-amber-500 text-white shadow-xs"
              : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
          }`}
        >
          📋 งวดเก็บเงิน ({dues.filter((d) => d.status !== "cancelled").length})
        </button>
        <button
          onClick={() => setActiveTab("reviews")}
          className={`px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
            activeTab === "reviews"
              ? "bg-amber-500 text-white shadow-xs"
              : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
          }`}
        >
          <span>⏳ ตรวจสอบสลิป</span>
          {summary.pendingReviewCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-500 text-white font-bold">
              {summary.pendingReviewCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("expenses")}
          className={`px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 whitespace-nowrap transition-all cursor-pointer ${
            activeTab === "expenses"
              ? "bg-amber-500 text-white shadow-xs"
              : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
          }`}
        >
          🧾 รายจ่าย ({expenses.length})
        </button>
        <button
          onClick={() => setActiveTab("ledger")}
          className={`px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold shrink-0 whitespace-nowrap transition-all cursor-pointer ${
            activeTab === "ledger"
              ? "bg-amber-500 text-white shadow-xs"
              : "text-stone-600 hover:text-stone-900 hover:bg-stone-100"
          }`}
        >
          📒 สมุดบัญชีกองกลาง ({ledgerEntries.length})
        </button>
        {/* Trailing spacer so rightmost tab never collides with container edge on scroll */}
        <div className="w-4 shrink-0 sm:hidden" aria-hidden="true" />
      </div>

      {/* Tab 1: My Dues */}
      {activeTab === "my_dues" && (() => {
        const myDuesWithStatus = myDuesList.map((due) => {
          const myAllocated = due.allocations[uid] || 0;
          const myApproved = payments
            .filter((p) => p.dueId === due.id && p.memberUid === uid && p.status === "approved")
            .reduce((sum, p) => sum + p.amountSatang, 0);
          const myPending = payments
            .filter(
              (p) =>
                p.dueId === due.id &&
                p.memberUid === uid &&
                ["submitted", "verification_pending", "api_verified", "manual_review"].includes(p.status)
            )
            .reduce((sum, p) => sum + p.amountSatang, 0);
          const myRemaining = Math.max(0, myAllocated - myApproved);
          const isSettled = myRemaining === 0;

          return {
            due,
            myAllocated,
            myApproved,
            myPending,
            myRemaining,
            isSettled,
          };
        });

        const myActiveDues = myDuesWithStatus.filter((d) => !d.isSettled);
        const mySettledDues = myDuesWithStatus.filter((d) => d.isSettled);

        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-stone-800">
                  ยอดที่ฉันต้องชำระในทริปนี้
                </h2>
                <p className="text-[11px] text-stone-500">
                  ตรวจสอบยอดคงค้างและส่งสลิปโอนเงินเข้ากองกลาง
                </p>
              </div>
              <button
                onClick={() => handleOpenPayment()}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-2xs flex items-center gap-1 cursor-pointer active:scale-95"
              >
                <span>📤</span> แจ้งโอนเงิน
              </button>
            </div>

            {myDuesList.length === 0 ? (
              <div className="card py-10 text-center text-stone-400 text-xs">
                <span className="text-3xl block mb-2">🎉</span>
                คุณไม่มีรายการเรียกเก็บเงินในทริปนี้
              </div>
            ) : (
              <>
                {/* Active / Unsettled Section */}
                {myActiveDues.length > 0 ? (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-amber-800">
                        📌 รายการที่ฉันยังค้างชำระ
                      </span>
                      <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">
                        {myActiveDues.length} รายการ
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5">
                      {myActiveDues.map(({ due, myAllocated, myPending, myRemaining }) => (
                        <div
                          key={due.id}
                          className="card p-4 border border-amber-200/90 shadow-2xs transition-all space-y-2.5 bg-white"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-bold text-stone-900 text-sm">{due.title}</h3>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                                  ค้างชำระ {formatSatang(myRemaining)}
                                </span>
                              </div>
                              {due.description && (
                                <p className="text-xs text-stone-500 mt-0.5">{due.description}</p>
                              )}
                              {due.dueDate && (
                                <p className="text-[11px] text-stone-400 mt-1">
                                  ⏰ กำหนดชำระ: {due.dueDate}
                                </p>
                              )}
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-stone-100">
                              <div className="text-right">
                                <div className="text-[11px] text-stone-400">ยอดที่ต้องจ่าย</div>
                                <div className="font-bold text-sm text-stone-800">
                                  {formatSatang(myAllocated)}
                                </div>
                              </div>

                              <button
                                onClick={() => handleOpenPayment(due)}
                                className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1 cursor-pointer active:scale-95"
                              >
                                <span>📤</span> โอนงวดนี้
                              </button>
                            </div>
                          </div>

                          {/* Pending notification */}
                          {myPending > 0 && (
                            <div className="p-2 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-[11px] flex items-center gap-1.5">
                              <span>⏳</span> แจ้งโอนไปแล้ว {formatSatang(myPending)} (กำลังรอผู้ดูแลตรวจสอบ)
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="card p-4 bg-emerald-50/50 border border-emerald-200/80 rounded-2xl flex items-center gap-3">
                    <span className="text-2xl">🎉</span>
                    <div>
                      <div className="text-xs font-bold text-emerald-800">
                        คุณไม่มีรายการค้างชำระ!
                      </div>
                      <div className="text-[11px] text-emerald-700">
                        ชำระครบถ้วนทุกรายการเรียบร้อยแล้ว ยอดเยี่ยมมาก
                      </div>
                    </div>
                  </div>
                )}

                {/* Settled Section */}
                {mySettledDues.length > 0 && (
                  <div className="pt-2 space-y-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-emerald-800">
                        ✅ รายการที่ฉันชำระครบแล้ว
                      </span>
                      <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {mySettledDues.length} รายการ
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5">
                      {mySettledDues.map(({ due, myAllocated }) => (
                        <div
                          key={due.id}
                          className="card p-3.5 border border-emerald-200/70 bg-emerald-50/20 rounded-2xl shadow-2xs transition-all opacity-95"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold text-stone-800 text-sm">{due.title}</h3>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                  ✓ ชำระครบแล้ว
                                </span>
                              </div>
                              {due.dueDate && (
                                <p className="text-[10px] text-stone-400 mt-0.5">ครบกำหนด: {due.dueDate}</p>
                              )}
                            </div>

                            <div className="text-right">
                              <span className="text-xs font-bold text-stone-700">
                                {formatSatang(myAllocated)}
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()}

      {/* Tab 2: All Dues */}
      {activeTab === "all_dues" && (() => {
        const activeDuesList = dues.filter((d) => d.status !== "cancelled");
        const cancelledDues = dues.filter((d) => d.status === "cancelled");

        const duesWithProgress = activeDuesList.map((due) => {
          const progress = getDuePaymentProgress(due, payments);
          const percent =
            progress.totalSatang > 0
              ? Math.min(100, Math.round((progress.collectedSatang / progress.totalSatang) * 100))
              : 0;
          return {
            due,
            progress,
            percent,
            isSettled: progress.isFullySettled,
          };
        });

        const activeDues = duesWithProgress.filter((d) => !d.isSettled);
        const settledDues = duesWithProgress.filter((d) => d.isSettled);

        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-stone-800">งวดเรียกเก็บเงินทั้งหมด</h2>
                <p className="text-[11px] text-stone-500">
                  แยกงวดที่กำลังรอเก็บเงิน และงวดที่สมาชิกจ่ายครบ 100% แล้ว
                </p>
              </div>
              {isManager && (
                <button
                  onClick={() => setIsDueCreateOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-2xs flex items-center gap-1 cursor-pointer active:scale-95"
                >
                  <span>➕</span> สร้างงวดใหม่
                </button>
              )}
            </div>

            {activeDuesList.length === 0 && cancelledDues.length === 0 ? (
              <div className="card py-10 text-center text-stone-400 text-xs">
                <span className="text-3xl block mb-2">📋</span>
                ยังไม่มีการสร้างงวดเรียกเก็บเงินในทริปนี้
              </div>
            ) : (
              <>
                {/* Active / Unsettled Dues Section */}
                {activeDues.length > 0 ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-amber-800">
                        📌 งวดที่รอเก็บเงิน / ค้างชำระ
                      </span>
                      <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900">
                        {activeDues.length} งวด
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {activeDues.map(({ due, progress, percent }) => {
                        const myAlloc = due.allocations?.[uid] || 0;
                        const myApproved = payments
                          .filter((p) => p.dueId === due.id && p.memberUid === uid && p.status === "approved")
                          .reduce((sum, p) => sum + p.amountSatang, 0);
                        const userNeedsToPay = myAlloc > myApproved;

                        return (
                          <div key={due.id} className="card p-4 space-y-3 border border-amber-200/90 shadow-2xs bg-white">
                            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-1">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-bold text-stone-900 text-sm">{due.title}</h3>
                                  <span className="text-xs font-bold text-amber-700">
                                    {formatSatang(due.totalAmountSatang)}
                                  </span>
                                </div>
                                {due.description && (
                                  <p className="text-xs text-stone-500 mt-0.5">{due.description}</p>
                                )}
                                {due.dueDate && (
                                  <p className="text-[11px] text-stone-400 mt-0.5">ครบกำหนด: {due.dueDate}</p>
                                )}
                              </div>

                              <div className="text-left sm:text-right shrink-0">
                                <div className="text-xs font-semibold text-emerald-700">
                                  เก็บได้ {percent}% ({formatSatang(progress.collectedSatang)} / {formatSatang(due.totalAmountSatang)})
                                </div>
                                {progress.remainingSatang > 0 && (
                                  <div className="text-[10px] font-bold text-amber-700">
                                    ยังขาดอีก {formatSatang(progress.remainingSatang)}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Progress Bar */}
                            <div className="w-full bg-stone-100 h-2 rounded-full overflow-hidden">
                              <div
                                className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                                style={{ width: `${percent}%` }}
                              />
                            </div>

                            {/* Members Breakdown Chips */}
                            <div className="pt-0.5">
                              <div className="mb-1.5">
                                <span className="text-[11px] font-semibold text-stone-500">
                                  สถานะสมาชิก ({Object.keys(due.allocations).length} คน):
                                </span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {Object.entries(due.allocations).map(([mUid, allocSatang]) => {
                                  const mApproved = payments
                                    .filter(
                                      (p) =>
                                        p.dueId === due.id &&
                                        p.memberUid === mUid &&
                                        p.status === "approved"
                                    )
                                    .reduce((sum, p) => sum + p.amountSatang, 0);
                                  const isDone = mApproved >= allocSatang;

                                  return (
                                    <span
                                      key={mUid}
                                      className={`px-2 py-0.5 rounded-lg text-[10px] font-medium border ${
                                        isDone
                                          ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                                          : "bg-amber-50/60 border-amber-200 text-amber-900"
                                      }`}
                                    >
                                      {getMemberName(mUid)}: {isDone ? "✓ ชำระแล้ว" : `รอชำระ ${formatSatang(allocSatang)}`}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Actions Footer Bar */}
                            <div className="pt-2.5 border-t border-stone-100 flex items-center justify-between text-xs">
                              <div className="text-[11px] text-stone-400">
                                {due.dueDate ? `⏰ ครบกำหนด: ${due.dueDate}` : ""}
                              </div>

                              <div className="flex items-center gap-2">
                                {isManager && (
                                  <button
                                    type="button"
                                    disabled={cancellingDueId === due.id}
                                    onClick={() => handleCancelDue(due)}
                                    className="px-2.5 py-1 rounded-xl bg-stone-100 hover:bg-rose-50 text-stone-600 hover:text-rose-700 border border-stone-200/80 hover:border-rose-200 text-xs font-semibold transition-all shadow-2xs active:scale-95 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                    title="ยกเลิกงวดเก็บเงินนี้ (กรณีตั้งผิด)"
                                  >
                                    <span>🗑️</span> {cancellingDueId === due.id ? "กำลังยกเลิก..." : "ยกเลิกงวดนี้"}
                                  </button>
                                )}
                                {userNeedsToPay && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenPayment(due)}
                                    className="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-2xs flex items-center gap-1 cursor-pointer active:scale-95"
                                  >
                                    <span>📤</span> โอนงวดนี้
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : activeDuesList.length > 0 ? (
                  <div className="card p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl flex items-center gap-3">
                    <span className="text-2xl">🎉</span>
                    <div>
                      <div className="text-xs font-bold text-emerald-800">
                        เก็บเงินครบทุกงวดเรียบร้อยแล้ว!
                      </div>
                      <div className="text-[11px] text-emerald-700">
                        สมาชิกทุกคนชำระเงินครบ 100% ไม่มีรายการค้างชำระ
                      </div>
                    </div>
                  </div>
                ) : null}

                {/* Settled / Completed Dues Section */}
                {settledDues.length > 0 && (
                  <div className="pt-2 space-y-3">
                    <div className="flex items-center justify-between border-t border-stone-200/80 pt-3">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-emerald-800">
                          ✅ งวดที่เก็บครบแล้ว
                        </span>
                        <span className="px-2 py-0.2 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          {settledDues.length} งวด
                        </span>
                      </div>
                      <button
                        onClick={() => setIsSettledDuesOpen(!isSettledDuesOpen)}
                        className="text-[11px] font-semibold text-stone-500 hover:text-stone-800 transition-colors cursor-pointer"
                      >
                        {isSettledDuesOpen ? "▲ ซ่อนงวดที่จบแล้ว" : "▼ ดูงวดที่จบแล้ว"}
                      </button>
                    </div>

                    {isSettledDuesOpen && (
                      <div className="grid grid-cols-1 gap-2.5">
                        {settledDues.map(({ due, progress }) => (
                          <div
                            key={due.id}
                            className="card p-3.5 space-y-2.5 border border-emerald-200/80 bg-emerald-50/20 rounded-2xl shadow-2xs opacity-95"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold text-stone-800 text-sm">{due.title}</h3>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    ✓ เก็บครบ 100% ({formatSatang(due.totalAmountSatang)})
                                  </span>
                                </div>
                                {due.dueDate && (
                                  <p className="text-[10px] text-stone-400 mt-0.5">ครบกำหนด: {due.dueDate}</p>
                                )}
                              </div>
                              <div className="text-right">
                                <span className="text-xs font-semibold text-emerald-700">
                                  ได้รับยอดครบ {formatSatang(progress.collectedSatang)}
                                </span>
                              </div>
                            </div>

                            {/* Full Progress Bar */}
                            <div className="w-full bg-stone-100 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-emerald-500 h-full rounded-full w-full" />
                            </div>

                            {/* Members Summary & Actions */}
                            <div className="flex items-center justify-between pt-0.5">
                              <div className="flex flex-wrap gap-1.5">
                                {Object.keys(due.allocations).map((mUid) => (
                                  <span
                                    key={mUid}
                                    className="px-2 py-0.5 rounded-lg text-[10px] font-medium bg-emerald-100/70 text-emerald-800 border border-emerald-200/50"
                                  >
                                    {getMemberName(mUid)}: ✓ ชำระแล้ว
                                  </span>
                                ))}
                              </div>

                              {isManager && (
                                <button
                                  type="button"
                                  disabled={cancellingDueId === due.id}
                                  onClick={() => handleCancelDue(due)}
                                  className="text-[11px] font-medium text-stone-400 hover:text-rose-600 transition-colors flex items-center gap-1 cursor-pointer shrink-0 ml-2"
                                  title="ยกเลิกงวดนี้"
                                >
                                  <span>🗑️</span> ยกเลิกงวด
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Cancelled Dues Section */}
                {cancelledDues.length > 0 && (
                  <div className="pt-2 space-y-2 border-t border-stone-200/80">
                    <button
                      type="button"
                      onClick={() => setIsCancelledDuesOpen(!isCancelledDuesOpen)}
                      className="text-[11px] font-semibold text-stone-400 hover:text-stone-600 flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <span>{isCancelledDuesOpen ? "▲ ซ่อนงวดที่ยกเลิกแล้ว" : "▼ ดูงวดที่ยกเลิกแล้ว"}</span>
                      <span className="px-1.5 py-0.2 rounded-md bg-stone-200/70 text-stone-600 text-[10px] font-bold">
                        {cancelledDues.length}
                      </span>
                    </button>
                    {isCancelledDuesOpen && (
                      <div className="grid grid-cols-1 gap-2">
                        {cancelledDues.map((due) => (
                          <div
                            key={due.id}
                            className="card p-3 border border-stone-200/60 bg-stone-50/60 rounded-xl text-stone-500 text-xs flex items-center justify-between opacity-80"
                          >
                            <div>
                              <span className="line-through font-bold text-stone-700">{due.title}</span>
                              <span className="ml-2 text-[11px] text-stone-400">
                                {formatSatang(due.totalAmountSatang)}
                              </span>
                              {due.description && (
                                <p className="text-[10px] text-stone-400 mt-0.5">{due.description}</p>
                              )}
                            </div>
                            <span className="px-2 py-0.5 rounded-lg text-[10px] bg-rose-50 text-rose-700 border border-rose-200/70 font-bold shrink-0">
                              ยกเลิกแล้ว
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        );
      })()}

      {/* Tab 3: Reviews Queue */}
      {activeTab === "reviews" && (
        <ManagerReviewQueue
          roomId={roomId}
          payments={payments}
          dues={dues}
          members={members}
          isManager={isManager}
          currentUid={uid}
        />
      )}

      {/* Tab 4: Expenses */}
      {activeTab === "expenses" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-stone-800">รายจ่ายของทริป (จ่ายให้ร้านค้า)</h2>
              <p className="text-[11px] text-stone-500">
                ยอดที่จ่ายจริงจากเงินกองกลาง เช่น มัดจำที่พัก ค่ารถ ค่าอาหาร
              </p>
            </div>
            {isManager && (
              <button
                onClick={() => handleOpenNewExpense()}
                className="px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-2xs flex items-center gap-1 cursor-pointer active:scale-95"
              >
                <span>➕</span> บันทึกรายจ่าย
              </button>
            )}
          </div>

          {expenses.length === 0 ? (
            <div className="card py-10 text-center text-stone-400 text-xs">
              <span className="text-3xl block mb-2">🧾</span>
              ยังไม่มีการบันทึกรายจ่ายของทริป
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {expenses.map((exp) => (
                <div
                  key={exp.id}
                  className="card p-4 border border-stone-200/90 hover:border-amber-300 transition-all space-y-3"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-stone-900 text-sm">{exp.title}</span>
                        {exp.vendor && (
                          <span className="text-xs text-stone-500 font-medium">({exp.vendor})</span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            exp.status === "paid"
                              ? "bg-emerald-100 text-emerald-800"
                              : exp.status === "partially_paid"
                              ? "bg-amber-100 text-amber-900"
                              : "bg-stone-100 text-stone-700"
                          }`}
                        >
                          {exp.status === "paid"
                            ? "✓ จ่ายครบแล้ว"
                            : exp.status === "partially_paid"
                            ? "⏳ จ่ายบางส่วน"
                            : "📋 วางแผนไว้"}
                        </span>
                      </div>
                      {exp.notes && <p className="text-xs text-stone-500 mt-1">{exp.notes}</p>}
                      {exp.date && (
                        <p className="text-[11px] text-stone-400 mt-0.5">วันที่: {exp.date}</p>
                      )}
                    </div>

                    <div className="text-left sm:text-right shrink-0">
                      <div className="text-sm font-black text-stone-900">
                        ยอดรวม: {formatSatang(exp.totalCostSatang)}
                      </div>
                      <div className="text-xs text-emerald-700 font-bold mt-0.5">
                        จ่ายแล้ว: {formatSatang(exp.paidAmountSatang)}
                      </div>
                      {exp.totalCostSatang > exp.paidAmountSatang && (
                        <div className="text-[11px] text-rose-600 font-bold mt-0.5">
                          ค้างจ่ายร้านค้า:{" "}
                          {formatSatang(exp.totalCostSatang - exp.paidAmountSatang)}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar for Expense */}
                  <div className="pt-2 border-t border-stone-100 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[11px]">
                      {exp.status === "partially_paid" && (
                        <span className="text-amber-800 font-medium">
                          💡 ยอดค้างชำระ: {formatSatang(exp.totalCostSatang - exp.paidAmountSatang)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 ml-auto">
                      {exp.status === "partially_paid" && isManager && (
                        <button
                          type="button"
                          onClick={() => handleQuickPayFull(exp)}
                          className="px-2.5 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition-all shadow-2xs active:scale-95 flex items-center gap-1 cursor-pointer"
                        >
                          <span>✓</span> บันทึกจ่ายครบแล้ว
                        </button>
                      )}
                      {isManager && (
                        <button
                          type="button"
                          onClick={() => handleEditExpense(exp)}
                          className="px-2.5 py-1 rounded-xl bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold transition-all shadow-2xs active:scale-95 flex items-center gap-1 cursor-pointer"
                        >
                          <span>✏️</span> {exp.status === "paid" ? "แก้ไข" : "แก้ไข / อัปเดต"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 5: Ledger Entries */}
      {activeTab === "ledger" && (
        <div className="space-y-3">
          <div>
            <h2 className="text-sm font-bold text-stone-800">สมุดบัญชีกองกลาง (Ledger)</h2>
            <p className="text-[11px] text-stone-500">
              บันทึกการเคลื่อนไหวของเงินเข้า-ออกกองกลางแบบ Append-Only โปร่งใส ตรวจสอบได้
            </p>
          </div>

          {ledgerEntries.length === 0 ? (
            <div className="card py-10 text-center text-stone-400 text-xs">
              <span className="text-3xl block mb-2">📒</span>
              ยังไม่มีการบันทึกรายการในสมุดบัญชี
            </div>
          ) : (
            <div className="card p-0 overflow-hidden border border-stone-200">
              <div className="divide-y divide-stone-100">
                {ledgerEntries.map((entry) => {
                  const isIncome = entry.type === "income";
                  return (
                    <div
                      key={entry.id}
                      className="p-3.5 flex items-center justify-between hover:bg-stone-50/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                            isIncome
                              ? "bg-emerald-100 text-emerald-700"
                              : "bg-rose-100 text-rose-700"
                          }`}
                        >
                          {isIncome ? "↓" : "↑"}
                        </span>
                        <div>
                          <div className="text-xs font-semibold text-stone-800">
                            {entry.description}
                          </div>
                          <div className="text-[10px] text-stone-400">
                            {new Date(entry.createdAt).toLocaleString("th-TH")} • โดย{" "}
                            {entry.memberUid ? getMemberName(entry.memberUid) : "ผู้ดูแล"}
                          </div>
                        </div>
                      </div>

                      <div
                        className={`font-bold text-sm ${
                          isIncome ? "text-emerald-700" : "text-rose-700"
                        }`}
                      >
                        {isIncome ? "+" : "-"}
                        {formatSatang(entry.amountSatang)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      <PaymentUploadModal
        roomId={roomId}
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setSelectedDueForPayment(null);
        }}
        settings={settings}
        dues={dues}
        members={members}
        currentUid={uid}
        initialDueId={selectedDueForPayment?.id || null}
      />

      <DueCreateModal
        roomId={roomId}
        isOpen={isDueCreateOpen}
        onClose={() => setIsDueCreateOpen(false)}
        members={members}
        activities={activities}
      />

      <ExpenseModal
        roomId={roomId}
        isOpen={isExpenseModalOpen}
        onClose={() => {
          setIsExpenseModalOpen(false);
          setEditingExpense(null);
        }}
        activities={activities}
        initialExpense={editingExpense}
      />

      <FinanceSettingsModal
        roomId={roomId}
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        members={members}
        isOwner={isOwner}
      />
    </div>
  );
}
