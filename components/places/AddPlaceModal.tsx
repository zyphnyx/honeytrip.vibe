"use client";

import { useState } from "react";
import type { Member, Place, PlaceCategory, PlaceInput } from "@/lib/types";

interface AddPlaceModalProps {
  isOpen: boolean;
  initialCategory?: PlaceCategory;
  initialPlace?: Place | null;
  me: Member | undefined;
  uid: string | null;
  onClose: () => void;
  onSave: (input: PlaceInput, placeId?: string) => Promise<string>;
}

export function AddPlaceModal({
  isOpen,
  initialCategory = "stay",
  initialPlace,
  me,
  uid,
  onClose,
  onSave,
}: AddPlaceModalProps) {
  const [category, setCategory] = useState<PlaceCategory>(
    initialPlace?.category ?? initialCategory,
  );
  const [name, setName] = useState(initialPlace?.name ?? "");
  const [location, setLocation] = useState(initialPlace?.location ?? "");
  const [externalUrl, setExternalUrl] = useState(initialPlace?.externalUrl ?? "");
  const [price, setPrice] = useState(
    initialPlace?.price !== undefined && initialPlace?.price !== null
      ? String(initialPlace.price)
      : "",
  );
  const [priceUnit, setPriceUnit] = useState(
    initialPlace?.priceUnit ?? (initialCategory === "stay" ? "บาท/คืน" : "บาท/คน"),
  );
  const [capacity, setCapacity] = useState(
    initialPlace?.capacity !== undefined && initialPlace?.capacity !== null
      ? String(initialPlace.capacity)
      : "",
  );
  const [estimatedDuration, setEstimatedDuration] = useState(
    initialPlace?.estimatedDuration ?? "",
  );
  const [notes, setNotes] = useState(initialPlace?.notes ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);


  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("กรุณากรอกชื่อสถานที่");
      return;
    }
    if (!uid) {
      setError("ไม่พบข้อมูลผู้ใช้ กรุณาลองใหม่อีกครั้ง");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const input: PlaceInput = {
        name: name.trim(),
        category,
        source: initialPlace?.source || "manual",
        ...(initialPlace?.providerPlaceId ? { providerPlaceId: initialPlace.providerPlaceId } : {}),
        location: location.trim() || null,
        externalUrl: externalUrl.trim() || null,
        price: price ? parseFloat(price) : null,
        priceUnit: priceUnit.trim() || null,
        capacity: capacity ? parseInt(capacity, 10) : null,
        estimatedDuration: estimatedDuration.trim() || null,
        notes: notes.trim() || null,
        createdBy: initialPlace?.createdBy || uid,
        createdByName: initialPlace?.createdByName || me?.name || "เพื่อนร่วมทริป",
        createdByEmoji: initialPlace?.createdByEmoji || me?.emoji || "👤",
        coords: initialPlace?.coords || null,
      };

      await onSave(input, initialPlace?.id);
      onClose();
    } catch (err: unknown) {
      console.error("Save place error:", err);
      setError((err as Error).message || "เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setIsSubmitting(false);
    }
  };

  const isStay = category === "stay";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-md rounded-3xl border border-stone-200/80 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <h2 className="text-base font-bold text-stone-900">
            {initialPlace ? "✏️ แก้ไขข้อมูลสถานที่" : "💡 เสนอสถานที่ใหม่ให้เพื่อนๆ"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {error && (
          <div className="mt-3 rounded-xl bg-red-50 p-2.5 text-xs font-semibold text-red-600 border border-red-200">
            ⚠️ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Category Toggle */}
          <div>
            <label className="text-xs font-bold text-stone-700 block mb-1.5">
              หมวดหมู่สถานที่
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setCategory("stay");
                  if (!priceUnit || priceUnit === "บาท/คน") setPriceUnit("บาท/คืน");
                }}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-colors border cursor-pointer ${
                  isStay
                    ? "border-amber-400 bg-amber-50 text-amber-950 shadow-xs"
                    : "border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100"
                }`}
              >
                <span>🏡</span>
                <span>ที่พัก</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCategory("attraction");
                  if (!priceUnit || priceUnit === "บาท/คืน") setPriceUnit("บาท/คน");
                }}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-colors border cursor-pointer ${
                  !isStay
                    ? "border-teal-400 bg-teal-50 text-teal-950 shadow-xs"
                    : "border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100"
                }`}
              >
                <span>📍</span>
                <span>ที่เที่ยว</span>
              </button>
            </div>
          </div>

          {/* Place Name */}
          <div>
            <label className="text-xs font-bold text-stone-700 block mb-1">
              ชื่อสถานที่ <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isStay ? "เช่น The Sea Resort Hua Hin" : "เช่น อุทยานแห่งชาติ, คาเฟ่ริมหาด"}
              className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-2 text-xs font-medium text-stone-900 focus:border-amber-400 focus:bg-white focus:outline-hidden"
            />
          </div>

          {/* Location / Area */}
          <div>
            <label className="text-xs font-bold text-stone-700 block mb-1">
              ทำเล / ตำแหน่งที่ตั้ง
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="เช่น หาดเขาตะเกียบ, ตัวเมืองเชียงใหม่"
              className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-2 text-xs font-medium text-stone-900 focus:border-amber-400 focus:bg-white focus:outline-hidden"
            />
          </div>

          {/* Price & Unit */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">
                {isStay ? "ราคาโดยประมาณ" : "ค่าเข้า / ค่าใช้จ่ายเฉลี่ย"}
              </label>
              <input
                type="number"
                min="0"
                step="50"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="เช่น 1500"
                className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-2 text-xs font-medium text-stone-900 focus:border-amber-400 focus:bg-white focus:outline-hidden"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">
                หน่วยราคา
              </label>
              <input
                type="text"
                value={priceUnit}
                onChange={(e) => setPriceUnit(e.target.value)}
                placeholder={isStay ? "บาท/คืน หรือ บาท/คน" : "บาท/คน"}
                className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-2 text-xs font-medium text-stone-900 focus:border-amber-400 focus:bg-white focus:outline-hidden"
              />
            </div>
          </div>

          {/* Stay Capacity or Attraction Duration */}
          {isStay ? (
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">
                จำนวนคนที่รองรับได้ (Capacity)
              </label>
              <input
                type="number"
                min="1"
                value={capacity}
                onChange={(e) => setCapacity(e.target.value)}
                placeholder="เช่น พักได้ 4 คน หรือ 10 คน"
                className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-2 text-xs font-medium text-stone-900 focus:border-amber-400 focus:bg-white focus:outline-hidden"
              />
            </div>
          ) : (
            <div>
              <label className="text-xs font-bold text-stone-700 block mb-1">
                ระยะเวลาที่ใช้เที่ยวโดยประมาณ
              </label>
              <input
                type="text"
                value={estimatedDuration}
                onChange={(e) => setEstimatedDuration(e.target.value)}
                placeholder="เช่น 1 - 2 ชม., ครึ่งวัน"
                className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-2 text-xs font-medium text-stone-900 focus:border-amber-400 focus:bg-white focus:outline-hidden"
              />
            </div>
          )}

          {/* External URL (Google Maps or Booking) */}
          <div>
            <label className="text-xs font-bold text-stone-700 block mb-1">
              ลิงก์ Google Maps หรือเว็บจอง / รีวิว
            </label>
            <input
              type="url"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="https://maps.app.goo.gl/... หรือ agoda.com/..."
              className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-2 text-xs font-medium text-stone-900 focus:border-amber-400 focus:bg-white focus:outline-hidden"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-bold text-stone-700 block mb-1">
              หมายเหตุ / ป้ายยาเพื่อน
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="เช่น มีสระว่ายน้ำส่วนตัว, วิวสวยมาก, แนะนำไปช่วงเย็น"
              className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-2 text-xs font-medium text-stone-900 focus:border-amber-400 focus:bg-white focus:outline-hidden"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-xl border border-stone-200 px-4 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50 cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="rounded-xl bg-amber-500 px-5 py-2 text-xs font-bold text-white shadow-xs hover:bg-amber-600 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? "กำลังบันทึก…" : initialPlace ? "บันทึกการแก้ไข" : "เสนอสถานที่"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
