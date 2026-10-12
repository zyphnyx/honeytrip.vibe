"use client";

import { useState } from "react";
import { bahtToSatang, satangToBaht, type Expense } from "@/lib/financeTypes";
import { createExpense, updateExpense } from "@/lib/finance";

interface ExpenseModalProps {
  roomId: string;
  isOpen: boolean;
  onClose: () => void;
  activities?: Array<{ id: string; title: string }>;
  initialExpense?: Expense | null;
}

const CATEGORIES = [
  { id: "accommodation", label: "🏡 ที่พัก / โรงแรม" },
  { id: "transport", label: "🚗 การเดินทาง / ค่าน้ำมัน / ค่ารถ" },
  { id: "food", label: "🍜 อาหารและเครื่องดื่ม" },
  { id: "activity", label: "🎟️ ค่าเข้าชม / กิจกรรม" },
  { id: "shopping", label: "🛍️ ของกองกลาง / ช้อปปิ้ง" },
  { id: "other", label: "📦 อื่นๆ" },
];

export default function ExpenseModal(props: ExpenseModalProps) {
  if (!props.isOpen) return null;

  return (
    <ExpenseModalContent
      key={props.initialExpense?.id || "new-expense"}
      {...props}
    />
  );
}

function ExpenseModalContent({
  roomId,
  onClose,
  activities = [],
  initialExpense,
}: ExpenseModalProps) {
  const isEditing = Boolean(initialExpense);

  const [title, setTitle] = useState(() => initialExpense?.title || "");
  const [category, setCategory] = useState(() => initialExpense?.category || "accommodation");
  const [vendor, setVendor] = useState(() => initialExpense?.vendor || "");
  const [totalCostBaht, setTotalCostBaht] = useState(() =>
    initialExpense ? satangToBaht(initialExpense.totalCostSatang).toString() : ""
  );
  const [paidBaht, setPaidBaht] = useState(() =>
    initialExpense ? satangToBaht(initialExpense.paidAmountSatang).toString() : ""
  );
  const [date, setDate] = useState(() =>
    initialExpense?.date || new Date().toISOString().split("T")[0]
  );
  const [linkedActivityId, setLinkedActivityId] = useState(() =>
    initialExpense?.linkedActivityId || ""
  );
  const [notes, setNotes] = useState(() => initialExpense?.notes || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const totalVal = parseFloat(totalCostBaht);
    if (!title.trim()) {
      setError("กรุณาระบุชื่อรายการรายจ่าย");
      return;
    }
    if (isNaN(totalVal) || totalVal <= 0) {
      setError("กรุณากรอกยอดเงินรวมที่ถูกต้อง (มากกว่า 0)");
      return;
    }

    const paidVal = paidBaht.trim() ? parseFloat(paidBaht) : totalVal;
    if (isNaN(paidVal) || paidVal < 0) {
      setError("กรุณากรอกยอดเงินที่จ่ายแล้วให้ถูกต้อง");
      return;
    }
    if (paidVal > totalVal) {
      setError("ยอดเงินที่จ่ายแล้ว ไม่สามารถมากกว่ายอดเงินรวมได้");
      return;
    }

    setSubmitting(true);
    try {
      if (initialExpense) {
        await updateExpense(roomId, initialExpense.id, initialExpense, {
          title: title.trim(),
          category,
          vendor: vendor.trim(),
          totalCostSatang: bahtToSatang(totalVal),
          paidAmountSatang: bahtToSatang(paidVal),
          date: date || null,
          linkedActivityId: linkedActivityId || null,
          notes: notes.trim(),
        });
      } else {
        await createExpense(roomId, {
          title: title.trim(),
          category,
          vendor: vendor.trim(),
          totalCostSatang: bahtToSatang(totalVal),
          paidAmountSatang: bahtToSatang(paidVal),
          date: date || null,
          linkedActivityId: linkedActivityId || null,
          notes: notes.trim(),
        });
      }
      onClose();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "บันทึกรายจ่ายไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  const parsedTotal = parseFloat(totalCostBaht) || 0;
  const parsedPaid = parseFloat(paidBaht) || 0;
  const remainingBaht = Math.max(0, parsedTotal - parsedPaid);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-orange-300/80 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header — Soft Sunset Orange Gradient */}
        <div className="bg-gradient-to-br from-orange-200 via-amber-200 to-orange-300 border-b border-orange-300/70 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 backdrop-blur-xs text-xl shadow-2xs border border-white/90">
              🧾
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-stone-900">
                {isEditing ? "แก้ไข / อัปเดตรายจ่ายทริป" : "บันทึกรายจ่ายทริป"}
              </h2>
              <p className="text-xs text-orange-950/80 font-medium">
                {isEditing
                  ? "ปรับปรุงข้อมูลหรืออัปเดตยอดที่จ่ายเพิ่ม/จ่ายครบแล้ว"
                  : "บันทึกค่าใช้จ่ายจริงที่จ่ายออกจากกองกลาง"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-black/10 transition-colors text-stone-600 hover:text-stone-900 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl">
              ⚠️ {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">
              ชื่อรายการค่าใช้จ่าย *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="เช่น มัดจำพูลวิลล่า, เหมาเรือหางยาว, ค่าหมูกระทะ"
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1">
                หมวดหมู่
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-200 text-stone-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1">
                ผู้รับเงิน / ร้านค้า
              </label>
              <input
                type="text"
                value={vendor}
                onChange={(e) => setVendor(e.target.value)}
                placeholder="เช่น เจ้าของพูลวิลล่า, ปั๊ม ปตท."
                className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1">
                ยอดรวมทั้งหมด (บาท) *
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={totalCostBaht}
                onChange={(e) => setTotalCostBaht(e.target.value)}
                placeholder="0.00"
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                required
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-stone-600">
                  จ่ายออกแล้วจริง (บาท)
                </label>
                {parsedTotal > 0 && remainingBaht > 0 && (
                  <button
                    type="button"
                    onClick={() => setPaidBaht(parsedTotal.toString())}
                    className="text-[11px] font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded-lg transition-colors cursor-pointer shadow-2xs"
                  >
                    ✨ ปรับเป็นจ่ายครบ
                  </button>
                )}
              </div>
              <input
                type="number"
                step="any"
                min="0"
                value={paidBaht}
                onChange={(e) => setPaidBaht(e.target.value)}
                placeholder={totalCostBaht || "0.00"}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
              />
              <p className="text-[11px] text-stone-500 mt-1">
                {paidBaht === ""
                  ? "(ถ้าเว้นว่าง ระบบจะถือว่าจ่ายเต็มจำนวนแล้ว)"
                  : remainingBaht > 0
                  ? `ค้างจ่าย: ฿${remainingBaht.toLocaleString()}`
                  : "✓ จ่ายครบถ้วนแล้ว"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1">
                วันที่จ่ายเงิน
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
              />
            </div>

            {activities.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">
                  เชื่อมกับกิจกรรมในแผน
                </label>
                <select
                  value={linkedActivityId}
                  onChange={(e) => setLinkedActivityId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 text-stone-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                >
                  <option value="">(ไม่ระบุ)</option>
                  {activities.map((act) => (
                    <option key={act.id} value={act.id}>
                      {act.title}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">
              หมายเหตุ / รายละเอียดเพิ่มเติม
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="เช่น เลขที่อ้างอิงใบเสร็จ, มัดจำงวดที่ 1"
              className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-stone-600 hover:bg-stone-100 text-sm font-medium transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {submitting
                ? "กำลังบันทึก..."
                : isEditing
                ? "อัปเดตรายจ่าย"
                : "บันทึกรายจ่าย"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
