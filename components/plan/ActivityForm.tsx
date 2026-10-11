"use client";

import { useEffect, useMemo, useState } from "react";
import { ACTIVITY_CATEGORIES, COST_MODES } from "@/lib/constants";
import { getDateRangeArray } from "@/lib/activityDates";
import type {
  Activity,
  ActivityCategory,
  ActivityCostMode,
  ActivityInput,
  ActivityStatus,
  Member,
  Place,
  TripPlanMeta,
} from "@/lib/types";

export function ActivityForm({
  isOpen,
  initialActivity,
  initialDate,
  initialMode = "proposed",
  meta,
  places = [],
  members = [],
  uid,
  onClose,
  onSave,
}: {
  isOpen: boolean;
  initialActivity?: Activity | null;
  initialDate?: string;
  initialMode?: "proposed" | "confirmed";
  meta: TripPlanMeta | null | undefined;
  places?: Place[];
  members?: Member[];
  uid: string | null;
  onClose: () => void;
  onSave: (input: ActivityInput, activityId?: string) => Promise<void>;
}) {
  const isEditing = Boolean(initialActivity);

  const defaultParticipants =
    initialActivity?.participantUids ||
    (members.length > 0 ? members.map((m) => m.id) : uid ? [uid] : []);

  const targetMode =
    initialMode === "confirmed"
      ? "confirmed"
      : initialActivity
      ? initialActivity.status === "proposed"
        ? "proposed"
        : "confirmed"
      : initialMode;

  // Form State
  const [formMode, setFormMode] = useState<"proposed" | "confirmed">(targetMode);
  const [title, setTitle] = useState(initialActivity?.title || "");
  const [category, setCategory] = useState<ActivityCategory>(
    initialActivity?.category || "attraction",
  );
  const [description, setDescription] = useState(initialActivity?.description || "");
  const [date, setDate] = useState(
    initialActivity?.date || initialDate || meta?.startDate || "",
  );
  const [startTime, setStartTime] = useState(initialActivity?.startTime || "");
  const [endTime, setEndTime] = useState(initialActivity?.endTime || "");
  const [costMode, setCostMode] = useState<ActivityCostMode>(
    initialActivity?.cost?.mode || "unknown",
  );
  const [costAmount, setCostAmount] = useState(
    initialActivity?.cost?.amount !== null && initialActivity?.cost?.amount !== undefined
      ? String(initialActivity.cost.amount)
      : "",
  );
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>(defaultParticipants);
  const [selectedPlaceId, setSelectedPlaceId] = useState(initialActivity?.placeId || "");
  const [customLocation, setCustomLocation] = useState(
    initialActivity?.placeSnapshot?.location || "",
  );
  const [externalUrl, setExternalUrl] = useState(
    initialActivity?.placeSnapshot?.externalUrl || "",
  );
  const [transport, setTransport] = useState(initialActivity?.transport || "");
  const [showAdvanced, setShowAdvanced] = useState(
    Boolean(
      initialActivity?.endTime ||
        initialActivity?.placeSnapshot ||
        initialActivity?.transport ||
        initialActivity?.description,
    ),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Snapshot for dirty checking
  const initialSnapshot = useMemo(() => {
    return {
      title: initialActivity?.title || "",
      description: initialActivity?.description || "",
      category: initialActivity?.category || "attraction",
      date: initialActivity?.date || initialDate || meta?.startDate || "",
      startTime: initialActivity?.startTime || "",
      endTime: initialActivity?.endTime || "",
      costMode: initialActivity?.cost?.mode || "unknown",
      costAmount:
        initialActivity?.cost?.amount !== null && initialActivity?.cost?.amount !== undefined
          ? String(initialActivity.cost.amount)
          : "",
      selectedPlaceId: initialActivity?.placeId || "",
      customLocation: initialActivity?.placeSnapshot?.location || "",
      externalUrl: initialActivity?.placeSnapshot?.externalUrl || "",
      transport: initialActivity?.transport || "",
    };
  }, [initialActivity, initialDate, meta?.startDate]);

  // Check if user has made meaningful edits (Requirement 6 & Edge Case 18)
  const isDirty = useMemo(() => {
    return (
      title !== initialSnapshot.title ||
      description !== initialSnapshot.description ||
      category !== initialSnapshot.category ||
      date !== initialSnapshot.date ||
      startTime !== initialSnapshot.startTime ||
      endTime !== initialSnapshot.endTime ||
      costMode !== initialSnapshot.costMode ||
      costAmount !== initialSnapshot.costAmount ||
      selectedPlaceId !== initialSnapshot.selectedPlaceId ||
      customLocation !== initialSnapshot.customLocation ||
      externalUrl !== initialSnapshot.externalUrl ||
      transport !== initialSnapshot.transport
    );
  }, [
    title,
    description,
    category,
    date,
    startTime,
    endTime,
    costMode,
    costAmount,
    selectedPlaceId,
    customLocation,
    externalUrl,
    transport,
    initialSnapshot,
  ]);

  // Prevent accidental page refresh / navigation when editing (Edge Case 18)
  useEffect(() => {
    if (!isOpen || !isDirty) return;
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isOpen, isDirty]);

  // Safe close with confirmation when dirty (Requirement 6)
  const handleSafeClose = () => {
    if (isDirty) {
      if (!window.confirm("คุณมีข้อมูลที่ยังไม่ได้บันทึก ต้องการยกเลิกและละทิ้งการแก้ไขใช่หรือไม่?")) {
        return;
      }
    }
    onClose();
  };

  // Close with Escape key
  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleSafeClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, isDirty]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const tripDates = getDateRangeArray(meta?.startDate, meta?.endDate);

  const handlePlaceSelect = (placeId: string) => {
    setSelectedPlaceId(placeId);
    if (!placeId) return;
    const pl = places.find((p) => p.id === placeId);
    if (pl) {
      if (!title) setTitle(pl.name);
      if (pl.location) setCustomLocation(pl.location);
      if (pl.externalUrl) setExternalUrl(pl.externalUrl);
    }
  };

  const toggleParticipant = (memberId: string) => {
    setSelectedParticipants((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId],
    );
  };

  const handleSelectAllParticipants = () => {
    setSelectedParticipants(members.map((m) => m.id));
  };

  const handleClearParticipants = () => {
    setSelectedParticipants([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError("กรุณากรอกชื่อกิจกรรม");
      return;
    }

    // ถ้าเป็นโหมด Confirmed: ต้องระบุวันและเวลาเริ่มต้น
    if (formMode === "confirmed") {
      if (!date) {
        setError("กิจกรรมที่เพิ่มลงตารางเที่ยวต้องระบุวันเดินทาง");
        return;
      }
      if (!startTime) {
        setError("กิจกรรมที่เพิ่มลงตารางเที่ยวต้องระบุเวลาเริ่มต้น");
        return;
      }
    }

    // ตรวจสอบเวลาสิ้นสุดไม่ให้มาก่อนเวลาเริ่มต้น
    if (startTime && endTime && endTime < startTime) {
      setError("เวลาสิ้นสุดต้องไม่มาก่อนเวลาเริ่มต้น");
      return;
    }

    // เตรียม Place Snapshot
    let placeSnapshot = null;
    const linkedPlace = places.find((p) => p.id === selectedPlaceId);
    if (linkedPlace) {
      placeSnapshot = {
        name: linkedPlace.name,
        location: customLocation || linkedPlace.location || "",
        externalUrl: externalUrl || linkedPlace.externalUrl || "",
      };
    } else if (customLocation || externalUrl) {
      placeSnapshot = {
        name: trimmedTitle,
        location: customLocation || "",
        externalUrl: externalUrl || "",
      };
    } else if (initialActivity?.placeSnapshot) {
      placeSnapshot = initialActivity.placeSnapshot;
    }

    // คำนวณราคา
    const parsedAmount =
      costMode === "free"
        ? 0
        : costMode === "unknown"
        ? null
        : costAmount
        ? Math.max(0, Number(costAmount))
        : null;

    let nextStatus: ActivityStatus = "proposed";
    if (formMode === "confirmed") {
      nextStatus = initialActivity?.status === "completed" ? "completed" : "confirmed";
    }

    const payload: ActivityInput = {
      title: trimmedTitle,
      description: description.trim(),
      category,
      status: nextStatus,
      date: date || null,
      startTime: startTime || null,
      endTime: endTime || null,
      placeId: selectedPlaceId || null,
      placeSnapshot,
      transport: transport.trim() || null,
      cost: {
        mode: costMode,
        amount: parsedAmount,
        currency: "THB",
      },
      participantUids: selectedParticipants,
      createdBy: initialActivity?.createdBy || uid || "",
    };

    setIsSubmitting(true);
    try {
      await onSave(payload, initialActivity?.id);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="activity-form-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 p-3 sm:p-4 backdrop-blur-xs"
      onClick={handleSafeClose}
    >
      <div
        className="w-full max-w-lg max-h-[92vh] sm:max-h-[90vh] rounded-3xl bg-white shadow-2xl flex flex-col overflow-hidden border border-stone-200/80 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header & Mode Switcher - Fixed at the top, never scrolled away */}
        <div className="p-4 sm:p-5 pb-3 border-b border-stone-100 shrink-0 space-y-3 bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">
                {formMode === "confirmed" ? "🗓️" : "💡"}
              </span>
              <h2 id="activity-form-title" className="text-base font-bold text-stone-900">
                {isEditing ? "แก้ไขกิจกรรม" : "สร้างกิจกรรมใหม่"}
              </h2>
            </div>
            <button
              type="button"
              onClick={handleSafeClose}
              className="rounded-xl p-1.5 text-stone-400 hover:bg-stone-100 transition-colors cursor-pointer"
              aria-label="ปิด"
            >
              ✕
            </button>
          </div>

          {/* Mode Toggle (Proposed vs Confirmed) - Available both in create and edit */}
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-stone-200 bg-stone-100 p-1">
            <button
              type="button"
              onClick={() => setFormMode("proposed")}
              className={`rounded-xl py-2 text-xs font-bold transition-all cursor-pointer ${
                formMode === "proposed"
                  ? "bg-white text-stone-950 shadow-xs border border-stone-200/60"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              💡 เสนอไอเดีย (ไว้โหวต/คุย)
            </button>
            <button
              type="button"
              onClick={() => setFormMode("confirmed")}
              className={`rounded-xl py-2 text-xs font-bold transition-all cursor-pointer ${
                formMode === "confirmed"
                  ? "bg-white text-stone-950 shadow-xs border border-stone-200/60"
                  : "text-stone-500 hover:text-stone-800"
              }`}
            >
              ✅ ลงตารางเที่ยว (ล็อกเวลา)
            </button>
          </div>
        </div>

        {/* Form with scrollable body and sticky action footer */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs">
          {/* Title */}
          <div className="space-y-1">
            <label htmlFor="act-title" className="font-semibold text-stone-700">
              ชื่อกิจกรรม / ที่ที่จะไป <span className="text-rose-500">*</span>
            </label>
            <input
              id="act-title"
              type="text"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setError(null);
              }}
              placeholder="เช่น ดำน้ำเกาะล้าน, กินส้มตำป้าณี, คาเฟ่ริมหาด"
              maxLength={120}
              required
              className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-base sm:text-sm text-stone-900 focus:border-amber-400 focus:bg-white focus:outline-hidden"
            />
          </div>

          {/* Category Chips */}
          <div className="space-y-1">
            <label className="font-semibold text-stone-700">หมวดหมู่กิจกรรม</label>
            <div className="flex flex-wrap gap-1.5">
              {ACTIVITY_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id as ActivityCategory)}
                  className={`rounded-xl px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer border ${
                    category === c.id
                      ? "border-amber-400 bg-amber-100 text-stone-950 shadow-2xs font-bold"
                      : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  <span>{c.icon}</span> <span>{c.short}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Date & Time Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Date */}
            <div className="space-y-1">
              <label htmlFor="act-date" className="font-semibold text-stone-700">
                วันที่ {formMode === "confirmed" && <span className="text-rose-500">*</span>}
              </label>
              {tripDates.length > 0 ? (
                <select
                  id="act-date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-base sm:text-sm text-stone-900 focus:border-amber-400 focus:bg-white focus:outline-hidden"
                >
                  <option value="">-- ยังไม่ระบุวัน --</option>
                  {tripDates.map((d, i) => (
                    <option key={d} value={d}>
                      DAY {i + 1} ({d})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="act-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-base sm:text-sm text-stone-900 focus:border-amber-400 focus:bg-white focus:outline-hidden"
                />
              )}
            </div>

            {/* Start Time */}
            <div className="space-y-1">
              <label htmlFor="act-start-time" className="font-semibold text-stone-700">
                เวลาเริ่ม {formMode === "confirmed" && <span className="text-rose-500">*</span>}
              </label>
              <input
                id="act-start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-xl border border-stone-200 bg-stone-50 px-3 py-2 text-base sm:text-sm text-stone-900 focus:border-amber-400 focus:bg-white focus:outline-hidden"
              />
            </div>
          </div>

          {/* Cost Mode & Amount */}
          <div className="space-y-2 rounded-2xl border border-stone-200 bg-stone-50/60 p-3">
            <label className="font-semibold text-stone-700">ประมาณการค่าใช้จ่าย</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {COST_MODES.map((cm) => (
                <button
                  key={cm.id}
                  type="button"
                  onClick={() => {
                    setCostMode(cm.id as ActivityCostMode);
                    if (cm.id === "free" || cm.id === "unknown") setCostAmount("");
                  }}
                  className={`rounded-xl px-2 py-1.5 text-[11px] font-semibold transition-all cursor-pointer border ${
                    costMode === cm.id
                      ? "border-amber-400 bg-amber-400 text-stone-950 font-bold shadow-2xs"
                      : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                  }`}
                >
                  {cm.label}
                </button>
              ))}
            </div>

            {(costMode === "per_person" || costMode === "split_total") && (
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="จำนวนเงิน (บาท)"
                  value={costAmount}
                  onChange={(e) => setCostAmount(e.target.value)}
                  className="flex-1 rounded-xl border border-stone-200 bg-white px-3 py-2 text-base sm:text-sm text-stone-900 focus:border-amber-400 focus:outline-hidden"
                />
                <span className="font-bold text-stone-600 shrink-0">
                  {costMode === "per_person" ? "บาท / คน" : "บาท (ยอดรวม)"}
                </span>
              </div>
            )}
          </div>

          {/* Participants */}
          {members.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-stone-700">
                  ใครเข้าร่วมกิจกรรมนี้บ้าง ({selectedParticipants.length}/{members.length} คน)
                </label>
                <div className="flex gap-2 text-[11px]">
                  <button
                    type="button"
                    onClick={handleSelectAllParticipants}
                    className="text-amber-700 hover:underline cursor-pointer"
                  >
                    ทุกคน
                  </button>
                  <button
                    type="button"
                    onClick={handleClearParticipants}
                    className="text-stone-400 hover:underline cursor-pointer"
                  >
                    ล้าง
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {members.map((m) => {
                  const isSelected = selectedParticipants.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleParticipant(m.id)}
                      className={`flex items-center gap-1 rounded-xl px-2.5 py-1 text-xs transition-all cursor-pointer border ${
                        isSelected
                          ? "border-amber-300 bg-amber-100 text-stone-900 font-bold"
                          : "border-stone-200 bg-white text-stone-400 hover:bg-stone-50"
                      }`}
                    >
                      <span>{m.emoji}</span>
                      <span className="truncate max-w-[80px]">{m.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Progressive Disclosure Toggle */}
          <div className="border-t border-stone-100 pt-2">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex items-center gap-1.5 font-bold text-amber-800 hover:text-amber-950 transition-colors cursor-pointer"
            >
              <span>{showAdvanced ? "▲" : "▼"}</span>
              <span>{showAdvanced ? "ซ่อนรายละเอียดเพิ่มเติม" : "รายละเอียดเพิ่มเติม (สถานที่จากที่โหวต, เวลาสิ้นสุด, การเดินทาง)"}</span>
            </button>
          </div>

          {/* Advanced Fields */}
          {showAdvanced && (
            <div className="space-y-3 rounded-2xl border border-stone-200 bg-stone-50/70 p-3.5 animate-in fade-in duration-150">
              {/* Shortlist Place Selector */}
              {places.length > 0 && (
                <div className="space-y-1">
                  <label htmlFor="act-linked-place" className="font-semibold text-stone-700">
                    เลือกจากสถานที่ที่มีคนเสนอไว้ในทริป
                  </label>
                  <select
                    id="act-linked-place"
                    value={selectedPlaceId}
                    onChange={(e) => handlePlaceSelect(e.target.value)}
                    className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-base sm:text-sm text-stone-900 focus:border-amber-400 focus:outline-hidden"
                  >
                    <option value="">-- ไม่ได้เลือกจากรายการเสนอ --</option>
                    {places.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.category === "stay" ? "🏡 ที่พัก" : "🎡 ที่เที่ยว"}: {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* End Time */}
              <div className="space-y-1">
                <label htmlFor="act-end-time" className="font-semibold text-stone-700">
                  เวลาสิ้นสุด (ถ้ามี)
                </label>
                <input
                  id="act-end-time"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-base sm:text-sm text-stone-900 focus:border-amber-400 focus:outline-hidden"
                />
              </div>

              {/* Custom Location */}
              <div className="space-y-1">
                <label htmlFor="act-custom-location" className="font-semibold text-stone-700">
                  พิกัด / ที่อยู่ / จุดนัดพบ
                </label>
                <input
                  id="act-custom-location"
                  type="text"
                  value={customLocation}
                  onChange={(e) => setCustomLocation(e.target.value)}
                  placeholder="เช่น ท่าเรือแหลมบาลีฮาย, ล็อบบี้โรงแรม"
                  className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-base sm:text-sm text-stone-900 focus:border-amber-400 focus:outline-hidden"
                />
              </div>

              {/* Map link */}
              <div className="space-y-1">
                <label htmlFor="act-ext-url" className="font-semibold text-stone-700">
                  ลิงก์ Google Maps หรือข้อมูลภายนอก
                </label>
                <input
                  id="act-ext-url"
                  type="url"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://maps.google.com/..."
                  className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-base sm:text-sm text-stone-900 focus:border-amber-400 focus:outline-hidden"
                />
              </div>

              {/* Transport */}
              <div className="space-y-1">
                <label htmlFor="act-transport" className="font-semibold text-stone-700">
                  วิธีเดินทาง / ข้อมูลรถ
                </label>
                <input
                  id="act-transport"
                  type="text"
                  value={transport}
                  onChange={(e) => setTransport(e.target.value)}
                  placeholder="เช่น รถคันพี่กานต์, ข้ามเรือเฟอร์รี่, เดิน 5 นาที"
                  className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-base sm:text-sm text-stone-900 focus:border-amber-400 focus:outline-hidden"
                />
              </div>

              {/* Notes / Description */}
              <div className="space-y-1">
                <label htmlFor="act-desc" className="font-semibold text-stone-700">
                  หมายเหตุ / รายละเอียดกิจกรรม
                </label>
                <textarea
                  id="act-desc"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="เขียนข้อความประกอบ เช่น ต้องจองล่วงหน้า 3 วัน, แต่งตัวโทนขาว..."
                  maxLength={500}
                  className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-base sm:text-sm text-stone-900 focus:border-amber-400 focus:outline-hidden"
                />
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
              {error}
            </div>
          )}
        </div>

        {/* Sticky Form Actions Footer - Fixed at bottom */}
        <div className="flex gap-2 p-4 sm:p-5 border-t border-stone-100 shrink-0 bg-stone-50/90 rounded-b-3xl">
          <button
            type="button"
            onClick={handleSafeClose}
            disabled={isSubmitting}
            className="btn-ghost flex-1 !py-2.5 !text-xs font-semibold cursor-pointer"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="btn-primary flex-1 !py-2.5 !text-xs font-bold shadow-xs cursor-pointer"
          >
            {isSubmitting ? "กำลังบันทึก…" : isEditing ? "บันทึกการแก้ไข" : "สร้างกิจกรรม"}
          </button>
        </div>
      </form>
    </div>
  </div>
);
}
