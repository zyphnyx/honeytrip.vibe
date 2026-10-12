"use client";

import { useState } from "react";
import type { Due, Payment } from "@/lib/financeTypes";
import { formatSatang } from "@/lib/financeTypes";
import { approvePayment, rejectPayment, deletePayment } from "@/lib/finance";
import { getBankShortName } from "@/lib/slipokAdapter";
import type { Member } from "@/lib/types";

interface ManagerReviewQueueProps {
  roomId: string;
  payments: Payment[];
  dues: Due[];
  members: Member[];
  isManager: boolean;
  currentUid?: string;
}

export default function ManagerReviewQueue({
  roomId,
  payments,
  dues,
  members,
  isManager,
  currentUid,
}: ManagerReviewQueueProps) {
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected">("pending");
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [rejectingPayment, setRejectingPayment] = useState<Payment | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const getMemberName = (uid: string) => {
    const m = members.find((mem) => mem.id === uid);
    return m ? m.name : "สมาชิกนิรนาม";
  };

  const getDue = (dueId: string) => {
    return dues.find((d) => d.id === dueId);
  };

  // Filter payments
  const filteredPayments = payments.filter((p) => {
    if (filter === "pending") {
      return (
        p.status === "submitted" ||
        p.status === "verification_pending" ||
        p.status === "api_verified" ||
        p.status === "manual_review"
      );
    }
    if (filter === "approved") return p.status === "approved";
    if (filter === "rejected") return p.status === "rejected";
    return true;
  });

  const handleApprove = async (payment: Payment) => {
    if (!isManager) return;
    setProcessingId(payment.id);
    setActionError(null);
    try {
      const due = getDue(payment.dueId);
      await approvePayment(roomId, payment, due?.title);
    } catch (err: unknown) {
      console.error(err);
      setActionError(err instanceof Error ? err.message : "อนุมัติรายการไม่สำเร็จ");
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingPayment || !isManager) return;
    setProcessingId(rejectingPayment.id);
    setActionError(null);
    try {
      await rejectPayment(roomId, rejectingPayment.id, rejectReason || "ไม่พบยอดเงินในบัญชี");
      setRejectingPayment(null);
      setRejectReason("");
    } catch (err: unknown) {
      console.error(err);
      setActionError(err instanceof Error ? err.message : "ปฏิเสธรายการไม่สำเร็จ");
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeletePayment = async (payment: Payment) => {
    const canDelete = isManager || (currentUid && payment.submittedBy === currentUid);
    if (!canDelete) return;

    const confirmed = window.confirm(
      `ยืนยันการลบรายการแจ้งโอนที่ถูกปฏิเสธนี้ (${formatSatang(payment.amountSatang)}) หรือไม่?`
    );
    if (!confirmed) return;

    setProcessingId(payment.id);
    setActionError(null);
    try {
      await deletePayment(roomId, payment.id);
    } catch (err: unknown) {
      console.error(err);
      setActionError(err instanceof Error ? err.message : "ลบรายการไม่สำเร็จ");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-4">
      {actionError && (
        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl">
          ⚠️ {actionError}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-stone-200 pb-2">
        <button
          onClick={() => setFilter("pending")}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            filter === "pending"
              ? "bg-amber-500 text-white shadow-xs"
              : "bg-stone-100 text-stone-600 hover:bg-stone-200"
          }`}
        >
          ⏳ รอตรวจสอบ (
          {
            payments.filter(
              (p) =>
                p.status === "submitted" ||
                p.status === "verification_pending" ||
                p.status === "api_verified" ||
                p.status === "manual_review"
            ).length
          }
          )
        </button>
        <button
          onClick={() => setFilter("approved")}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            filter === "approved"
              ? "bg-emerald-600 text-white shadow-xs"
              : "bg-stone-100 text-stone-600 hover:bg-stone-200"
          }`}
        >
          ✅ อนุมัติแล้ว ({payments.filter((p) => p.status === "approved").length})
        </button>
        <button
          onClick={() => setFilter("rejected")}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            filter === "rejected"
              ? "bg-rose-600 text-white shadow-xs"
              : "bg-stone-100 text-stone-600 hover:bg-stone-200"
          }`}
        >
          ❌ ปฏิเสธแล้ว ({payments.filter((p) => p.status === "rejected").length})
        </button>
      </div>

      {/* Payment Cards List */}
      {filteredPayments.length === 0 ? (
        <div className="text-center py-10 bg-stone-50/50 rounded-2xl border border-dashed border-stone-200 text-stone-400 text-sm">
          ไม่มีรายการแจ้งโอนในหมวดนี้
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filteredPayments.map((p) => {
            const due = getDue(p.dueId);
            const slip = p.slipResult;
            const isPending =
              p.status === "submitted" ||
              p.status === "verification_pending" ||
              p.status === "api_verified" ||
              p.status === "manual_review";

            return (
              <div
                key={p.id}
                className={`bg-white rounded-2xl p-4 border transition-all ${
                  p.status === "approved"
                    ? "border-emerald-200 bg-emerald-50/10"
                    : p.status === "rejected"
                    ? "border-rose-200 bg-rose-50/10"
                    : "border-amber-200 shadow-sm"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">
                      {p.status === "approved"
                        ? "✅"
                        : p.status === "rejected"
                        ? "❌"
                        : slip?.success
                        ? "⚡"
                        : "⏳"}
                    </span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-stone-800 text-sm">
                          {getMemberName(p.memberUid)}
                        </span>
                        <span className="text-xs text-stone-400">แจ้งโอน</span>
                        <span className="font-semibold text-stone-700 text-xs">
                          {due?.title || "รายการเรียกเก็บเงิน"}
                        </span>
                      </div>
                      <span className="text-[11px] text-stone-400">
                        {new Date(p.createdAt).toLocaleString("th-TH")}
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {p.status === "api_verified" && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        ⚡ SlipOK ตรวจสอบผ่าน
                      </span>
                    )}
                    {p.status === "manual_review" && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
                        🔍 ต้องตรวจสอบเอง
                      </span>
                    )}
                    {p.status === "submitted" && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
                        📨 รอผู้ดูแลตรวจสอบ
                      </span>
                    )}
                    {p.status === "approved" && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        🎉 เข้ากองกลางแล้ว
                      </span>
                    )}
                    {p.status === "rejected" && (
                      <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-300">
                        ❌ ปฏิเสธแล้ว
                      </span>
                    )}
                    <span className="text-base font-bold text-amber-700">
                      {formatSatang(p.amountSatang)}
                    </span>
                  </div>
                </div>

                {/* Slip verification details */}
                {slip && (
                  <div className="mt-3 p-3 bg-stone-50 rounded-xl border border-stone-200/80 text-xs text-stone-700 space-y-1.5">
                    <div className="flex items-center justify-between text-stone-900 font-semibold border-b border-stone-200 pb-1">
                      <span>
                        รายละเอียดจากสลิป ({getBankShortName(slip.sendingBank)} →{" "}
                        {getBankShortName(slip.receivingBank)})
                      </span>
                      <span className="font-mono text-[11px] text-stone-500">
                        Ref: {slip.transRef}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-[11px]">
                      <div>
                        ผู้โอน:{" "}
                        <strong>{slip.sender?.displayName || slip.sender?.name || "-"}</strong>{" "}
                        <span className="text-stone-400 font-mono">
                          ({slip.sender?.accountValue || slip.sender?.proxyValue || ""})
                        </span>
                      </div>
                      <div>
                        ผู้รับเงิน:{" "}
                        <strong>{slip.receiver?.displayName || slip.receiver?.name || "-"}</strong>{" "}
                        <span className="text-stone-400 font-mono">
                          ({slip.receiver?.accountValue || slip.receiver?.proxyValue || ""})
                        </span>
                      </div>
                      <div>
                        เวลาที่โอน:{" "}
                        <strong>
                          {slip.transDate} {slip.transTime}
                        </strong>
                      </div>
                      <div>
                        ยอดตรวจพบ:{" "}
                        <strong className="text-emerald-700 font-semibold">
                          ฿{slip.amount.toLocaleString()}
                        </strong>
                      </div>
                    </div>

                    {/* Match Notes & Flags */}
                    <div className="pt-1 flex flex-wrap gap-1.5">
                      {slip.receiverMatched !== undefined && (
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                            slip.receiverMatched
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {slip.receiverMatched ? "✓ บัญชีตรงกับกองกลาง" : "⚠️ บัญชีรับไม่ตรงเป๊ะ"}
                        </span>
                      )}
                      {slip.isDuplicate && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-rose-100 text-rose-800 font-bold">
                          🚨 ตรวจพบสลิปซ้ำ!
                        </span>
                      )}
                      {slip.matchNotes && (
                        <span className="text-[10px] text-stone-500 italic">
                          ({slip.matchNotes})
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Manual Note if any */}
                {p.manualNote && (
                  <p className="mt-2 text-xs text-stone-600 bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                    💬 โน้ตจากสมาชิก: &ldquo;{p.manualNote}&rdquo;
                  </p>
                )}

                {/* Rejection reason if any */}
                {p.rejectedReason && (
                  <p className="mt-2 text-xs text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-100">
                    เหตุผลที่ปฏิเสธ: {p.rejectedReason}
                  </p>
                )}

                {/* Manager Actions Bar */}
                {isPending && isManager && (
                  <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setRejectingPayment(p)}
                      disabled={processingId === p.id}
                      className="px-3 py-1.5 rounded-xl border border-rose-300 text-rose-700 text-xs font-semibold hover:bg-rose-50 transition-colors disabled:opacity-50"
                    >
                      ปฏิเสธรายการ
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprove(p)}
                      disabled={processingId === p.id}
                      className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-colors flex items-center gap-1 disabled:opacity-50"
                    >
                      {processingId === p.id
                        ? "กำลังบันทึก..."
                        : "✓ ตรวจสอบแล้ว อนุมัติเข้ากองกลาง"}
                    </button>
                  </div>
                )}

                {/* Actions Bar for Rejected Payment */}
                {p.status === "rejected" && (isManager || (currentUid && p.submittedBy === currentUid)) && (
                  <div className="mt-3 pt-2.5 border-t border-rose-100/80 flex items-center justify-end">
                    <button
                      type="button"
                      onClick={() => handleDeletePayment(p)}
                      disabled={processingId === p.id}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold transition-all shadow-2xs active:scale-95 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      title="ลบรายการสลิปที่ถูกปฏิเสธนี้"
                    >
                      <span>🗑️</span> {processingId === p.id ? "กำลังลบ..." : "ลบรายการนี้"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Reject Modal */}
      {rejectingPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-white rounded-3xl p-5 shadow-2xl border border-rose-100 space-y-4">
            <div className="flex items-center gap-2 text-rose-600 font-bold">
              <span className="text-xl">⚠️</span>
              <h3>ระบุเหตุผลการปฏิเสธยอดโอน</h3>
            </div>
            <p className="text-xs text-stone-600">
              แจ้งสมาชิก {getMemberName(rejectingPayment.memberUid)} ยอด{" "}
              {formatSatang(rejectingPayment.amountSatang)}
            </p>
            <input
              type="text"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="เช่น ยอดเงินไม่เข้าบัญชี, สลิปซ้ำ, ยอดไม่ตรง"
              className="w-full px-3 py-2 rounded-xl border border-stone-200 text-xs focus:ring-2 focus:ring-rose-500 focus:outline-none"
            />
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectingPayment(null)}
                className="px-3 py-1.5 rounded-xl text-stone-600 text-xs hover:bg-stone-100"
              >
                ยกเลิก
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                className="px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
              >
                ยืนยันปฏิเสธ
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
