"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { decodeSlipQrFromImage } from "@/lib/qrDecode";
import { submitPayment } from "@/lib/finance";
import {
  bahtToSatang,
  formatSatang,
  satangToBaht,
  type Due,
  type FinanceSettings,
  type SlipVerificationResult,
} from "@/lib/financeTypes";
import { getBankName, maskAccountNumber, maskPromptPay } from "@/lib/slipokAdapter";
import type { Member } from "@/lib/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  dues: Due[];
  members: Member[];
  currentUid: string | null;
  settings: FinanceSettings | null;
  initialDueId?: string | null;
  onPaymentSubmitted?: () => void;
}

export function PaymentUploadModal(props: Props) {
  if (!props.isOpen) return null;

  return (
    <PaymentUploadModalContent
      key={`${props.initialDueId || "none"}-${props.currentUid || "none"}`}
      {...props}
    />
  );
}

function PaymentUploadModalContent({
  onClose,
  roomId,
  dues,
  members,
  currentUid,
  settings,
  initialDueId,
  onPaymentSubmitted,
}: Props) {
  const [selectedDueId, setSelectedDueId] = useState<string>(() => initialDueId || dues[0]?.id || "");
  const [selectedMemberUid, setSelectedMemberUid] = useState<string>(() => currentUid || members[0]?.id || "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [qrPayload, setQrPayload] = useState<string | null>(null);
  const [decoding, setDecoding] = useState(false);
  const [decodeError, setDecodeError] = useState<string | null>(null);

  const [verifying, setVerifying] = useState(false);
  const [slipResult, setSlipResult] = useState<SlipVerificationResult | null>(null);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);

  const [manualAmountBaht, setManualAmountBaht] = useState<string>("");
  const [manualNote, setManualNote] = useState<string>("");
  const [isManualMode, setIsManualMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    // Clean up preview object url on unmount or file change
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const currentDue = dues.find((d) => d.id === selectedDueId);
  const userAllocatedSatang =
    selectedMemberUid && currentDue ? currentDue.allocations?.[selectedMemberUid] || 0 : 0;

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    const prevUrl = URL.createObjectURL(file);
    setImageFile(file);
    setImagePreviewUrl(prevUrl);
    setDecodeError(null);
    setSlipResult(null);
    setVerifyMessage(null);
    setQrPayload(null);

    // Auto-attempt QR decode in browser via ZXing
    setDecoding(true);
    try {
      const decoded = await decodeSlipQrFromImage(file);
      if (decoded.success && decoded.payload) {
        setQrPayload(decoded.payload);
        // Automatically verify
        await runVerifySlip(decoded.payload);
      } else {
        setDecodeError(decoded.error || "ไม่พบ QR Code ในภาพสลิป");
      }
    } catch {
      setDecodeError("เกิดข้อผิดพลาดในการอ่านภาพสลิป");
    } finally {
      setDecoding(false);
    }
  }

  async function runVerifySlip(qr: string) {
    setVerifying(true);
    setVerifyMessage(null);
    try {
      const claimedSatang = manualAmountBaht
        ? bahtToSatang(Number(manualAmountBaht))
        : userAllocatedSatang;

      const res = await fetch("/api/finance/verify-slip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomId,
          dueId: selectedDueId || "general",
          qrData: qr,
          claimedAmountSatang: claimedSatang,
          memberUid: selectedMemberUid,
          expectedSettings: settings
            ? {
                receivingBank: settings.receivingBank,
                receivingAccount: settings.receivingAccount,
                promptPayId: settings.promptPayId,
                receivingName: settings.receivingName,
                autoVerifyEnabled: settings.autoVerifyEnabled,
              }
            : undefined,
          mockMode: false,
        }),
      });

      const data = await res.json();
      if (res.ok && data.verified && data.result) {
        setSlipResult(data.result);
        setVerifyMessage(data.result.matchNotes || "สลิปผ่านการตรวจสอบแล้ว");
      } else {
        // Fallback or warning from API
        if (data.warning) {
          setVerifyMessage(`⚠️ ${data.warning}`);
          if (data.result) setSlipResult(data.result);
        } else {
          setDecodeError(data.error || data.message || "การตรวจสอบสลิปไม่สำเร็จ");
        }
      }
    } catch {
      setDecodeError("ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ตรวจสลิปได้");
    } finally {
      setVerifying(false);
    }
  }

  async function handleSubmitPayment() {
    if (!selectedMemberUid) {
      alert("กรุณาเลือกสมาชิกผู้โอน");
      return;
    }

    let amountSatang = 0;
    if (slipResult && slipResult.amountSatang > 0) {
      amountSatang = slipResult.amountSatang;
    } else if (manualAmountBaht) {
      amountSatang = bahtToSatang(Number(manualAmountBaht));
    } else if (userAllocatedSatang > 0) {
      amountSatang = userAllocatedSatang;
    }

    if (amountSatang <= 0) {
      alert("กรุณาระบุจำนวนเงินที่โอน");
      return;
    }

    setSubmitting(true);
    try {
      await submitPayment(roomId, {
        dueId: selectedDueId || "general",
        memberUid: selectedMemberUid,
        amountSatang,
        qrData: qrPayload,
        slipResult: slipResult || null,
        manualNote: manualNote.trim() || null,
        status: slipResult?.receiverMatched ? "api_verified" : "manual_review",
      });

      setSuccessMsg("ส่งหลักฐานโอนเงินสำเร็จแล้ว! ผู้ดูแลทริปจะตรวจสอบและยืนยันยอดเงิน");
      setTimeout(() => {
        onPaymentSubmitted?.();
        onClose();
      }, 1500);
    } catch (err) {
      alert("เกิดข้อผิดพลาดในการบันทึก: " + (err instanceof Error ? err.message : String(err)));
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-3 sm:p-4 backdrop-blur-xs overflow-y-auto animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="card w-full max-w-lg border-amber-300/80 bg-white shadow-2xl p-4 sm:p-6 space-y-4 my-auto max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-xl shadow-xs">
              📤
            </span>
            <div>
              <h2 className="text-base font-bold text-stone-900">แจ้งโอนเงินเข้ากองกลาง</h2>
              <p className="text-xs text-stone-500">อัปโหลดสลิปธนาคารเพื่อตรวจสอบและบันทึกยอด</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Transfer instructions banner */}
        {settings && (settings.receivingAccount || settings.promptPayId) && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs space-y-2">
            <div className="font-bold text-amber-900 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span>💳</span> ข้อมูลโอนเงินของทริป
              </span>
              {settings.receivingBank && (
                <span className="font-mono text-[11px] font-semibold bg-amber-200/90 px-2 py-0.5 rounded-lg text-amber-950 shadow-2xs">
                  {getBankName(settings.receivingBank)}
                </span>
              )}
            </div>

            {settings.receivingAccount && (
              <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-amber-200/60 text-stone-700">
                <div className="flex items-center gap-1.5">
                  <span className="text-stone-600 font-medium">เลขบัญชี:</span>
                  <span className="font-mono font-bold text-stone-900 bg-white/90 px-2 py-0.5 rounded-md border border-amber-200/70 shadow-2xs">
                    {maskAccountNumber(settings.receivingAccount)}
                  </span>
                </div>
                {settings.receivingName && (
                  <span className="text-stone-600 font-medium text-[11px]">
                    ({settings.receivingName})
                  </span>
                )}
              </div>
            )}

            {settings.promptPayId && (
              <div className="flex items-center gap-1.5 pt-1 border-t border-amber-200/60 text-stone-700">
                <span className="text-stone-600 font-medium">พร้อมเพย์:</span>
                <span className="font-mono font-bold text-stone-900 bg-white/90 px-2 py-0.5 rounded-md border border-amber-200/70 shadow-2xs">
                  {maskPromptPay(settings.promptPayId)}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Select Payment Request (Due) */}
        <div>
          <label className="label">รายการที่ต้องการชำระ</label>
          <select
            className="input text-sm cursor-pointer"
            value={selectedDueId}
            onChange={(e) => setSelectedDueId(e.target.value)}
          >
            <option value="">-- สมทบกองกลางทั่วไป (ไม่ระบุรายการ) --</option>
            {dues
              .filter((d) => d.status === "open")
              .map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title} ({formatSatang(d.totalAmountSatang)})
                </option>
              ))}
          </select>
          {currentDue && selectedMemberUid && userAllocatedSatang > 0 && (
            <p className="text-[11px] text-amber-800 mt-1">
              ยอดจัดสรรของคุณในรายการนี้: <b>{formatSatang(userAllocatedSatang)}</b>
            </p>
          )}
        </div>

        {/* Select Member paying */}
        <div>
          <label className="label">สมาชิกผู้โอน</label>
          <select
            className="input text-sm cursor-pointer"
            value={selectedMemberUid}
            onChange={(e) => setSelectedMemberUid(e.target.value)}
          >
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.emoji} {m.name} {m.id === currentUid ? "(คุณ)" : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Upload Slip Image */}
        <div className="space-y-2">
          <label className="label">สลิปการโอนเงิน (สแกน QR อัตโนมัติ)</label>
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50/60 p-4 transition-colors hover:border-amber-400 text-center">
            <input
              type="file"
              accept="image/*"
              className="hidden"
              id="slip-upload-input"
              onChange={handleFileSelected}
            />
            <label
              htmlFor="slip-upload-input"
              className="flex flex-col items-center gap-1.5 cursor-pointer w-full"
            >
              <span className="text-3xl">📷</span>
              <span className="text-xs font-bold text-amber-800">
                {imageFile ? "เปลี่ยนรูปภาพสลิป" : "แตะเพื่อเลือกรูปภาพสลิป"}
              </span>
              <span className="text-[11px] text-stone-400">
                รองรับ JPG, PNG, WEBP (ระบบจะอ่าน QR Code ให้ทันที)
              </span>
            </label>
          </div>

          {/* Image preview & Decoding status */}
          {imagePreviewUrl && (
            <div className="flex items-center gap-3 rounded-xl border border-stone-200 bg-white p-2.5">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-stone-200 bg-stone-100">
                <Image
                  src={imagePreviewUrl}
                  alt="สลิปที่เลือก"
                  width={64}
                  height={64}
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="min-w-0 flex-1 text-xs">
                <div className="font-semibold text-stone-800 truncate">
                  {imageFile?.name || "ภาพสลิป"}
                </div>
                {decoding && (
                  <div className="text-amber-700 animate-pulse mt-0.5">
                    🔍 กำลังอ่าน QR Code ด้วย ZXing…
                  </div>
                )}
                {verifying && (
                  <div className="text-amber-700 animate-pulse mt-0.5">
                    ⚡ กำลังตรวจสอบสลิป…
                  </div>
                )}
                {decodeError && (
                  <div className="text-red-600 mt-0.5 text-[11px]">
                    ⚠️ {decodeError}
                  </div>
                )}
                {verifyMessage && (
                  <div className="text-emerald-700 font-semibold mt-0.5 text-[11px]">
                    {verifyMessage}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Verification Result Badge */}
        {slipResult && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-xs space-y-1.5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between font-bold text-emerald-900">
              <span className="flex items-center gap-1">
                <span>✅ สลิปถูกต้อง</span>
                <span className="text-[10px] bg-emerald-200/80 px-1.5 py-0.2 rounded">
                  {slipResult.rawMessage}
                </span>
              </span>
              <span className="text-sm font-extrabold tabular-nums">
                {formatSatang(slipResult.amountSatang)}
              </span>
            </div>
            <div className="text-[11px] text-stone-600 grid grid-cols-2 gap-1 pt-1 border-t border-emerald-200/50">
              <div>
                รหัสอ้างอิง: <span className="font-mono">{slipResult.transRef}</span>
              </div>
              <div>
                เวลาโอน: <span className="tabular-nums">{slipResult.transTime}</span>
              </div>
              {slipResult.receiver?.displayName && (
                <div className="col-span-2 truncate">
                  ผู้รับ: <b>{slipResult.receiver.displayName}</b>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Manual Amount fallback toggle */}
        {(decodeError || !slipResult || isManualMode) && (
          <div className="space-y-3 pt-1 border-t border-stone-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-stone-700">
                ระบุยอดเงินด้วยตนเอง
              </span>
              <button
                type="button"
                onClick={() => setIsManualMode(!isManualMode)}
                className="text-xs text-amber-700 hover:underline cursor-pointer"
              >
                {isManualMode ? "ย่อเก็บ" : "เปิดกรอกเอง"}
              </button>
            </div>

            {(isManualMode || decodeError) && (
              <div className="space-y-2">
                <div>
                  <label className="label">จำนวนเงินที่โอน (บาท)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder={
                      userAllocatedSatang > 0
                        ? `${satangToBaht(userAllocatedSatang)}`
                        : "เช่น 500"
                    }
                    className="input text-base"
                    value={manualAmountBaht}
                    onChange={(e) => setManualAmountBaht(e.target.value)}
                  />
                </div>
                <div>
                  <label className="label">หมายเหตุเพิ่มเติม (ถ้ามี)</label>
                  <input
                    type="text"
                    placeholder="เช่น โอนมัดจำรอบแรก, โอนรวมกับเพื่อน"
                    maxLength={100}
                    className="input text-sm"
                    value={manualNote}
                    onChange={(e) => setManualNote(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {successMsg && (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 text-center animate-in fade-in">
            ✓ {successMsg}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-stone-100">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="btn-secondary flex-1 !py-2.5 text-xs font-semibold"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={handleSubmitPayment}
            disabled={submitting || decoding || verifying}
            className="btn-primary flex-1 !py-2.5 text-xs font-bold shadow-sm"
          >
            {submitting ? "กำลังส่งข้อมูล…" : "📤 ยืนยันแจ้งโอนเงิน"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PaymentUploadModal;
