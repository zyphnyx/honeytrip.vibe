"use client";

import { useState } from "react";
import type { FinanceSettings } from "@/lib/financeTypes";
import { saveFinanceSettings } from "@/lib/finance";
import { THAI_BANK_CODES } from "@/lib/slipokAdapter";
import type { Member } from "@/lib/types";

interface FinanceSettingsModalProps {
  roomId: string;
  isOpen: boolean;
  onClose: () => void;
  settings: FinanceSettings | null;
  members: Member[];
  isOwner?: boolean;
}

export default function FinanceSettingsModal({
  roomId,
  isOpen,
  onClose,
  settings,
  members,
}: FinanceSettingsModalProps) {
  if (!isOpen) return null;

  return (
    <FinanceSettingsModalContent
      key={settings?.updatedAt || "settings-modal"}
      roomId={roomId}
      onClose={onClose}
      settings={settings}
      members={members}
    />
  );
}

function FinanceSettingsModalContent({
  roomId,
  onClose,
  settings,
  members,
}: Omit<FinanceSettingsModalProps, "isOpen" | "isOwner">) {
  const [managerUid, setManagerUid] = useState<string>(() => settings?.managerUid || "");
  const [receivingBank, setReceivingBank] = useState(() => settings?.receivingBank || "004");
  const [receivingAccount, setReceivingAccount] = useState(() => settings?.receivingAccount || "");
  const [receivingName, setReceivingName] = useState(() => settings?.receivingName || "");
  const [promptPayId, setPromptPayId] = useState(() => settings?.promptPayId || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hideAccountInput, setHideAccountInput] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await saveFinanceSettings(roomId, {
        managerUid: managerUid || null,
        receivingBank,
        receivingBankName: THAI_BANK_CODES[receivingBank]?.fullName || receivingBank,
        receivingAccount: receivingAccount.trim(),
        receivingName: receivingName.trim(),
        promptPayId: promptPayId.trim() || null,
      });
      onClose();
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "บันทึกการตั้งค่าไม่สำเร็จ");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-orange-300/80 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header — Soft Sunset Orange Gradient */}
        <div className="bg-gradient-to-br from-orange-200 via-amber-200 to-orange-300 border-b border-orange-300/70 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/80 backdrop-blur-xs text-xl shadow-2xs border border-white/90">
              ⚙️
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-stone-900">ตั้งค่าบัญชีและการเงินทริป</h2>
              <p className="text-xs text-orange-950/80 font-medium">กำหนดผู้ดูแลบัญชีและบัญชีรับโอนเงินของทริป</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-black/10 transition-colors text-stone-600 hover:text-stone-900 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-sm rounded-xl">
              ⚠️ {error}
            </div>
          )}

          {/* Manager Assignment */}
          <div>
            <label className="block text-xs font-semibold text-stone-600 mb-1">
              ผู้รับผิดชอบการเงิน (เหรัญญิกทริป)
            </label>
            <select
              value={managerUid}
              onChange={(e) => setManagerUid(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-stone-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
            >
              <option value="">(ทุกคนในห้องช่วยกันดูแล - สิทธิ์เปิดสำหรับทุกคน)</option>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.emoji} {m.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-stone-400 mt-1">
              💡 สมาชิกในห้องทุกคนสามารถช่วยกันตั้งค่า บันทึกรายจ่าย และตรวจสอบสลิปได้
            </p>
          </div>

          <hr className="border-stone-100" />

          {/* Receiving Account Info */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold text-amber-800 uppercase tracking-wider">
                  🏦 ข้อมูลบัญชีรับเงินของทริป
                </h3>
                <p className="text-[11px] text-stone-500">
                  (สำหรับรับโอนเงินกองกลาง — บัญชี <strong>MAKE by KBank</strong> ให้เลือกกสิกรไทย 004)
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setReceivingBank("004");
                  setReceivingName("น.ส. กานต์พิชชา สุริยนต์");
                }}
                className="px-2.5 py-1 rounded-xl bg-amber-100 hover:bg-amber-200 text-amber-900 text-[11px] font-bold transition-colors shadow-2xs"
              >
                ✨ ดึงชื่อจากกองกลาง
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1">
                ธนาคารรับเงิน
              </label>
              <select
                value={receivingBank}
                onChange={(e) => setReceivingBank(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-stone-200 text-stone-800 bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
              >
                {Object.entries(THAI_BANK_CODES).map(([code, info]) => (
                  <option key={code} value={code}>
                    [{info.shortName}] {info.fullName} {code === "004" ? "· MAKE by KBank" : ""} ({code})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">
                  เลขที่บัญชีรับเงิน <span className="text-[10px] text-stone-400 font-normal">(ไม่บังคับ)</span>
                </label>
                <div className="relative">
                  <input
                    type={hideAccountInput ? "password" : "text"}
                    value={receivingAccount}
                    onChange={(e) => setReceivingAccount(e.target.value)}
                    placeholder="เช่น 1234567890 (10 หลัก)"
                    className="w-full pl-3.5 pr-10 py-2 rounded-xl border border-stone-200 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setHideAccountInput(!hideAccountInput)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-700 text-xs p-1"
                    title={hideAccountInput ? "แสดงเลขบัญชี" : "ซ่อนเลขบัญชี"}
                  >
                    {hideAccountInput ? "👁️" : "🙈"}
                  </button>
                </div>
                <p className="text-[10px] text-stone-400 mt-1 flex items-center gap-1">
                  <span>🔒</span> ระบบจะเซ็นเซอร์เป็น xxx-x-xx933 บนหน้าจอแจ้งโอนเงินให้อัตโนมัติ
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1">
                  ชื่อเจ้าของบัญชีรับเงิน <span className="text-[10px] text-stone-400 font-normal">(ไม่บังคับ)</span>
                </label>
                <input
                  type="text"
                  value={receivingName}
                  onChange={(e) => setReceivingName(e.target.value)}
                  placeholder="เช่น น.ส. กานต์พิชชา สุริยนต์"
                  className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-600 mb-1">
                PromptPay ID (เบอร์โทร / เลข ปชช.) สำหรับสร้าง QR
              </label>
              <input
                type="text"
                value={promptPayId}
                onChange={(e) => setPromptPayId(e.target.value)}
                placeholder="เช่น 0812345678"
                className="w-full px-3.5 py-2 rounded-xl border border-stone-200 text-stone-800 focus:outline-none focus:ring-2 focus:ring-amber-500 text-sm"
              />
            </div>
          </div>



          {/* Footer buttons */}
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
              {submitting ? "กำลังบันทึก..." : "บันทึกการตั้งค่า"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
