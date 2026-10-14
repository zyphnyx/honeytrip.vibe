"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { submitPayment, generateFinanceId } from "@/lib/finance";
import { ensureUser } from "@/lib/firebase";
import {
  bahtToSatang,
  formatSatang,
  satangToBaht,
  type Due,
  type FinanceSettings,
  type ManualSlipEvidence,
} from "@/lib/financeTypes";
import { getBankName, maskAccountNumber, maskPromptPay } from "@/lib/slipokAdapter";
import { compressSlipImage, formatFileSize, type CompressedImageResult } from "@/lib/browserImageCompress";
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

function getLocalThailandDate(): string {
  const now = new Date();
  const d = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return d.toISOString().split("T")[0];
}

function getLocalThailandTime(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
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

  // Form fields
  const currentDue = dues.find((d) => d.id === selectedDueId);
  const userAllocatedSatang =
    selectedMemberUid && currentDue ? currentDue.allocations?.[selectedMemberUid] || 0 : 0;

  const [amountBaht, setAmountBaht] = useState<string>(() =>
    userAllocatedSatang > 0 ? String(satangToBaht(userAllocatedSatang)) : ""
  );
  const [transferDate, setTransferDate] = useState<string>(getLocalThailandDate);
  const [transferTime, setTransferTime] = useState<string>(getLocalThailandTime);
  const [manualNote, setManualNote] = useState<string>("");

  // Slip image compression & upload states
  const [compressedResult, setCompressedResult] = useState<CompressedImageResult | null>(null);
  const [compressing, setCompressing] = useState(false);
  const [compressError, setCompressError] = useState<string | null>(null);

  // Submission states
  const [submitting, setSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [allowNoImageFallback, setAllowNoImageFallback] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (compressedResult?.previewUrl) {
        URL.revokeObjectURL(compressedResult.previewUrl);
      }
    };
  }, [compressedResult]);

  async function handleImageSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (compressedResult?.previewUrl) {
      URL.revokeObjectURL(compressedResult.previewUrl);
    }
    setCompressedResult(null);
    setCompressError(null);
    setUploadError(null);
    setAllowNoImageFallback(false);

    setCompressing(true);
    try {
      const result = await compressSlipImage(file, 1600, 0.82);
      setCompressedResult(result);
    } catch (err: unknown) {
      console.error("Compression error:", err);
      setCompressError(err instanceof Error ? err.message : "ไม่สามารถประมวลผลรูปภาพได้");
    } finally {
      setCompressing(false);
    }
  }

  function handleRemoveImage() {
    if (compressedResult?.previewUrl) {
      URL.revokeObjectURL(compressedResult.previewUrl);
    }
    setCompressedResult(null);
    setCompressError(null);
    setUploadError(null);
    setAllowNoImageFallback(false);
  }

  async function handleSubmitPayment(forceNoImage = false) {
    if (!selectedMemberUid) {
      alert("กรุณาเลือกสมาชิกผู้โอน");
      return;
    }

    const numBaht = parseFloat(amountBaht);
    if (isNaN(numBaht) || numBaht <= 0) {
      alert("กรุณาระบุจำนวนเงินที่โอนจริงให้ถูกต้อง (ต้องมากกว่า 0 บาท)");
      return;
    }

    const amountSatang = bahtToSatang(numBaht);
    setSubmitting(true);
    setUploadError(null);

    // Stable payment ID across retry attempts
    const paymentId = generateFinanceId("pay");

    try {
      let evidence: ManualSlipEvidence | null = null;
      let evidenceType: "manual_slip" | "manual_no_image" = "manual_no_image";

      // 1. Upload compressed image if attached and not forced to skip
      if (compressedResult && !forceNoImage) {
        try {
          const user = await ensureUser();
          const token = await user.getIdToken();

          const formData = new FormData();
          formData.append("roomId", roomId);
          formData.append("paymentId", paymentId);
          formData.append("file", compressedResult.file);

          const uploadRes = await fetch("/api/finance/upload-slip", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            body: formData,
          });

          const uploadData = await uploadRes.json();
          if (!uploadRes.ok || !uploadData.success) {
            throw new Error(uploadData.message || "อัปโหลดรูปภาพสลิปไม่สำเร็จ");
          }

          evidence = uploadData.evidence;
          evidenceType = "manual_slip";
        } catch (uploadErr: unknown) {
          console.warn("Slip upload failed:", uploadErr);
          const msg = uploadErr instanceof Error ? uploadErr.message : "อัปโหลดภาพไม่สำเร็จ";
          setUploadError(`⚠️ ${msg}`);
          setAllowNoImageFallback(true);
          setSubmitting(false);
          return;
        }
      }

      // 2. Submit payment to Firestore
      const noteToSave = forceNoImage && compressedResult
        ? `[ไม่ได้แนบรูปสลิปในระบบ ส่งทางแชท/LINE] ${manualNote.trim()}`.trim()
        : manualNote.trim() || null;

      await submitPayment(roomId, {
        paymentId,
        dueId: selectedDueId || "general",
        memberUid: selectedMemberUid,
        amountSatang,
        transferDate: transferDate || null,
        transferTime: transferTime || null,
        evidence,
        evidenceType,
        manualNote: noteToSave,
        status: "manual_review",
      });

      setSuccessMsg("✅ แจ้งโอนเงินสำเร็จ รอผู้ดูแลตรวจสอบ");
      setTimeout(() => {
        onPaymentSubmitted?.();
        onClose();
      }, 1500);
    } catch (err: unknown) {
      console.error(err);
      alert("เกิดข้อผิดพลาดในการบันทึกข้อมูล: " + (err instanceof Error ? err.message : String(err)));
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
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-xl shadow-xs">
              💸
            </span>
            <div>
              <h2 className="text-base font-bold text-stone-900">แจ้งโอนเงินเข้ากองกลาง</h2>
              <p className="text-xs text-stone-500">กรอกยอดเงิน วันที่โอน และแนบรูปสลิป</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Transfer instructions banner */}
        {settings && (settings.receivingAccount || settings.promptPayId) && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-3.5 text-xs space-y-2">
            <div className="font-bold text-amber-900 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <span>💳</span> บัญชีรับโอนเงินของทริป
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

        {/* Form Body */}
        <div className="space-y-3.5">
          {/* Select Payment Request (Due) */}
          <div>
            <label className="label">รายการที่ต้องการชำระ</label>
            <select
              className="input text-sm cursor-pointer"
              value={selectedDueId}
              onChange={(e) => {
                setSelectedDueId(e.target.value);
                const due = dues.find((d) => d.id === e.target.value);
                const satang = due && selectedMemberUid ? due.allocations?.[selectedMemberUid] || 0 : 0;
                if (satang > 0) {
                  setAmountBaht(String(satangToBaht(satang)));
                }
              }}
            >
              <option value="">-- สมทบกองกลางทั่วไป (ไม่ระบุงวด) --</option>
              {dues
                .filter((d) => d.status === "open")
                .map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title} ({formatSatang(d.totalAmountSatang)})
                  </option>
                ))}
            </select>
          </div>

          {/* Select Member paying */}
          <div>
            <label className="label">สมาชิกผู้โอน</label>
            <select
              className="input text-sm cursor-pointer"
              value={selectedMemberUid}
              onChange={(e) => {
                setSelectedMemberUid(e.target.value);
                if (currentDue) {
                  const satang = currentDue.allocations?.[e.target.value] || 0;
                  if (satang > 0) {
                    setAmountBaht(String(satangToBaht(satang)));
                  }
                }
              }}
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.emoji} {m.name} {m.id === currentUid ? "(คุณ)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Transferred Amount */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label !mb-0">
                จำนวนเงินที่โอนจริง (บาท) <span className="text-rose-500">*</span>
              </label>
              {userAllocatedSatang > 0 && (
                <button
                  type="button"
                  onClick={() => setAmountBaht(String(satangToBaht(userAllocatedSatang)))}
                  className="text-[11px] text-amber-700 hover:underline cursor-pointer font-medium"
                >
                  ⚡ ใส่ตามยอดงวด ({formatSatang(userAllocatedSatang)})
                </button>
              )}
            </div>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 font-bold text-sm">
                ฿
              </span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                inputMode="decimal"
                placeholder="0.00"
                className="input !pl-8 text-base font-bold text-stone-900"
                value={amountBaht}
                onChange={(e) => setAmountBaht(e.target.value)}
              />
            </div>
            {userAllocatedSatang > 0 &&
              Number(amountBaht) >= satangToBaht(userAllocatedSatang) * 5 && (
                <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 flex items-center gap-1.5">
                  <span>⚠️</span>
                  <span>
                    ยอดที่กรอก (฿{Number(amountBaht).toLocaleString()}) สูงกว่ายอดงวด (฿{satangToBaht(userAllocatedSatang).toLocaleString()}) มาก โปรดตรวจสอบจำนวนเลข 0 อีกครั้ง
                  </span>
                </div>
              )}
          </div>

          {/* Transfer Date and Time */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label">
                วันที่โอน <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                className="input text-sm"
                value={transferDate}
                onChange={(e) => setTransferDate(e.target.value)}
              />
            </div>
            <div>
              <label className="label">เวลาที่โอน</label>
              <input
                type="time"
                className="input text-sm"
                value={transferTime}
                onChange={(e) => setTransferTime(e.target.value)}
              />
            </div>
          </div>

          {/* Attach Slip Image */}
          <div className="space-y-2">
            <label className="label">แนบหลักฐานสลิปการโอน</label>

            {!compressedResult && (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-stone-200 bg-stone-50/70 p-4 transition-colors hover:border-amber-400 text-center">
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  className="hidden"
                  id="slip-image-input"
                  disabled={compressing}
                  onChange={handleImageSelected}
                />
                <label
                  htmlFor="slip-image-input"
                  className="flex flex-col items-center gap-1.5 cursor-pointer w-full"
                >
                  <span className="text-3xl">📤</span>
                  <span className="text-xs font-bold text-amber-800">
                    {compressing ? "กำลังบีบอัดรูปภาพ..." : "แตะเพื่อเลือกรูปสลิปจากเครื่อง"}
                  </span>
                  <span className="text-[11px] text-stone-400">
                    รูปจะถูกบีบอัดและเก็บเป็นข้อมูลส่วนตัว (Private) ให้ผู้ดูแลตรวจเท่านั้น
                  </span>
                </label>
              </div>
            )}

            {compressing && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-800 flex items-center justify-center gap-2 animate-pulse">
                <span>🔄</span> กำลังบีบอัดรูปภาพให้อ่านตัวหนังสือชัดเจนและประหยัดพื้นที่...
              </div>
            )}

            {compressError && (
              <div className="p-2.5 bg-rose-50 rounded-xl border border-rose-200 text-rose-700 text-xs">
                ⚠️ {compressError}
              </div>
            )}

            {/* Compressed Image Preview Card */}
            {compressedResult && (
              <div className="rounded-2xl border border-stone-200 bg-white p-3 space-y-2.5">
                <div className="flex items-center gap-3">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-stone-200 bg-stone-100 shadow-2xs">
                    <Image
                      src={compressedResult.previewUrl}
                      alt="ตัวอย่างรูปสลิป"
                      width={80}
                      height={80}
                      className="h-full w-full object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="min-w-0 flex-1 text-xs space-y-1">
                    <div className="font-bold text-stone-800 truncate">
                      {compressedResult.file.name}
                    </div>
                    <div className="text-[11px] text-stone-500">
                      ขนาด:{" "}
                      <span className="font-semibold text-emerald-700">
                        {formatFileSize(compressedResult.compressedSizeBytes)}
                      </span>
                      {compressedResult.originalSizeBytes > compressedResult.compressedSizeBytes && (
                        <span className="text-stone-400 line-through ml-1.5">
                          {formatFileSize(compressedResult.originalSizeBytes)}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-stone-400">
                      ความละเอียด: {compressedResult.width} × {compressedResult.height} px
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1 border-t border-stone-100">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                    className="hidden"
                    id="slip-image-replace"
                    onChange={handleImageSelected}
                  />
                  <label
                    htmlFor="slip-image-replace"
                    className="px-2.5 py-1 text-xs text-amber-700 hover:bg-amber-50 rounded-lg cursor-pointer font-medium transition-colors"
                  >
                    เปลี่ยนรูป
                  </label>
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer font-medium transition-colors"
                  >
                    ลบรูป
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Upload Fallback Alert */}
          {uploadError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs space-y-2 text-rose-800">
              <p>{uploadError}</p>
              {allowNoImageFallback && (
                <div className="pt-1 flex items-center justify-between gap-2 border-t border-rose-200/60">
                  <span className="text-[11px] text-stone-600">
                    หรือส่งเฉพาะยอดเงิน แล้วส่งสลิปผ่าน LINE แทน:
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSubmitPayment(true)}
                    disabled={submitting}
                    className="px-3 py-1 bg-amber-600 text-white font-bold rounded-lg hover:bg-amber-700 text-xs shadow-2xs cursor-pointer"
                  >
                    แจ้งโอนโดยไม่แนบรูป
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="label">หมายเหตุเพิ่มเติม (ถ้ามี)</label>
            <input
              type="text"
              placeholder="เช่น โอนมัดจำงวดแรกแล้ว, โอนร่วมกับเพื่อน"
              maxLength={150}
              className="input text-sm"
              value={manualNote}
              onChange={(e) => setManualNote(e.target.value)}
            />
          </div>

          {/* Trust Notice */}
          <div className="rounded-xl bg-amber-50/70 border border-amber-200/70 p-2.5 text-[11px] text-amber-900 flex items-start gap-1.5">
            <span className="text-base leading-none">ℹ️</span>
            <span>
              ผู้ดูแลจะตรวจสอบยอดเงินเข้าบัญชีจริงก่อนยืนยันเข้ากองกลาง ยอดเงินยังไม่ถูกนับจนกว่าผู้ดูแลจะอนุมัติ
            </span>
          </div>
        </div>

        {/* Success Banner */}
        {successMsg && (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 text-center animate-in fade-in">
            {successMsg}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2 border-t border-stone-100">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="btn-secondary flex-1 !py-2.5 text-xs font-semibold cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            type="button"
            onClick={() => handleSubmitPayment(false)}
            disabled={submitting || compressing}
            className="btn-primary flex-1 !py-2.5 text-xs font-bold shadow-sm cursor-pointer disabled:opacity-50"
          >
            {submitting ? "กำลังส่งข้อมูล…" : "📤 ส่งหลักฐานการโอนเงิน"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default PaymentUploadModal;
