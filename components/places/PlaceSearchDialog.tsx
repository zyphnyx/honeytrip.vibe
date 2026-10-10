"use client";

import { useMemo, useState } from "react";
import { Tooltip } from "@/components/Tooltip";
import { PREFS } from "@/lib/constants";
import type { Member, Place, PlaceCategory, PlaceInput, PlaceSettings } from "@/lib/types";

interface SearchResultItem {
  providerPlaceId: string;
  name: string;
  category: PlaceCategory;
  location?: string;
  coords?: { lat: number; lon: number } | null;
  externalUrl?: string;
}

interface PlaceSearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  category: PlaceCategory;
  destination: string;
  settings: PlaceSettings | null | undefined;
  existingPlaces: Place[];
  members: Member[];
  me: Member | undefined;
  uid: string | null;
  onAddPlace: (input: PlaceInput) => Promise<string>;
  onOpenManualAdd: () => void;
}

export function PlaceSearchDialog({
  isOpen,
  onClose,
  category,
  destination,
  settings,
  existingPlaces,
  members,
  me,
  uid,
  onAddPlace,
  onOpenManualAdd,
}: PlaceSearchDialogProps) {
  const [query, setQuery] = useState("");
  const [destInput, setDestInput] = useState(destination);
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [apiDisabledMessage, setApiDisabledMessage] = useState<string | null>(null);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [attributions, setAttributions] = useState<{
    geoapify: string;
    geoapifyUrl: string;
    osm: string;
    osmUrl: string;
  } | null>(null);

  // คำนวณความชอบยอดนิยมของเพื่อนในกลุ่ม (Top Preferences) เพื่อทำเป็น Quick Chips
  const popularPrefs = (() => {
    const counts: Record<string, number> = {};
    for (const m of members) {
      for (const p of m.prefs || []) {
        counts[p] = (counts[p] || 0) + 1;
      }
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => PREFS.find((p) => p.id === id))
      .filter(Boolean)
      .slice(0, 4);
  })();

  // คำนวณ ID ของสถานที่ที่มีอยู่แล้วจาก existingPlaces
  const existingProviderIds = useMemo(() => {
    return new Set(
      existingPlaces
        .filter((p) => p.providerPlaceId)
        .map((p) => p.providerPlaceId!),
    );
  }, [existingPlaces]);


  if (!isOpen) return null;

  const handleSearch = async (overrideQuery?: string) => {
    const q = (overrideQuery !== undefined ? overrideQuery : query).trim();
    const dest = destInput.trim();

    if (!dest && !q) {
      alert("กรุณาระบุจุดหมายปลายทางหรือคำค้นหา");
      return;
    }

    setIsSearching(true);
    setApiDisabledMessage(null);

    try {
      const params = new URLSearchParams({
        category,
        destination: dest,
        query: q,
      });

      if (settings?.destinationCoords) {
        params.set("lat", String(settings.destinationCoords.lat));
        params.set("lon", String(settings.destinationCoords.lon));
      }

      const res = await fetch(`/api/places/search?${params.toString()}`);
      const data = await res.json();

      if (!data.enabled) {
        setApiDisabledMessage(
          data.message ||
            "ระบบค้นหาภายนอกยังไม่พร้อมใช้งาน สามารถเสนอสถานที่ด้วยตนเองหรือเปิดค้นหาบน Google Maps ได้เลยครับ",
        );
        setResults([]);
      } else {
        setResults(data.places || []);
        if (data.attributions) {
          setAttributions(data.attributions);
        }
      }
    } catch (err) {
      console.error("Search fetch error:", err);
      setApiDisabledMessage("เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง");
      setResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleAddSearchResult = async (item: SearchResultItem) => {
    if (!uid) return;
    try {
      const input: PlaceInput = {
        name: item.name,
        category: item.category,
        source: "geoapify",
        providerPlaceId: item.providerPlaceId,
        location: item.location || null,
        coords: item.coords || null,
        externalUrl: item.externalUrl || null,
        createdBy: uid,
        createdByName: me?.name || "เพื่อนร่วมทริป",
        createdByEmoji: me?.emoji || "👤",
      };

      await onAddPlace(input);
      setAddedIds((prev) => new Set([...prev, item.providerPlaceId]));
    } catch (err) {
      console.error("Failed to add search place:", err);
      alert("เกิดข้อผิดพลาดในการเพิ่มสถานที่เข้ากลุ่ม");
    }
  };

  const isStay = category === "stay";
  const googleMapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    (destInput || "ที่เที่ยว") + " " + (isStay ? "ที่พัก โรงแรม" : "สถานที่ท่องเที่ยว"),
  )}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-xs animate-fade-in">
      <div className="w-full max-w-lg rounded-3xl border border-stone-200/80 bg-white p-6 shadow-xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-stone-100 pb-3">
          <div>
            <h2 className="text-base font-bold text-stone-900">
              🔍 ค้นหา{isStay ? "ที่พัก" : "ที่เที่ยว"} (Discovery)
            </h2>
            <p className="text-[11px] text-stone-500">
              ค้นหาจาก OpenStreetMap / Geoapify หรือเปิดดูใน Google Maps
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-stone-400 hover:bg-stone-100 hover:text-stone-700 transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Search Inputs */}
        <div className="mt-4 space-y-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-bold text-stone-700 block mb-1">
                📍 จุดหมายปลายทาง
              </label>
              <input
                type="text"
                value={destInput}
                onChange={(e) => setDestInput(e.target.value)}
                placeholder="เช่น หัวหิน, เชียงใหม่, เขาใหญ่"
                className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-2 text-xs font-medium text-stone-900 focus:border-amber-400 focus:bg-white focus:outline-hidden"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-stone-700 block mb-1">
                🔎 คำค้นหาเพิ่มเติม (ถ้ามี)
              </label>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="เช่น ริมทะเล, วิลล่า, คาเฟ่"
                className="w-full rounded-xl border border-stone-200 bg-stone-50/50 px-3 py-2 text-xs font-medium text-stone-900 focus:border-amber-400 focus:bg-white focus:outline-hidden"
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              />
            </div>
          </div>

          {/* Quick Pref Chips from Gang */}
          {popularPrefs.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-[10px] font-bold text-stone-400">สไตล์แก๊งเรา:</span>
              {popularPrefs.map((pref) => {
                if (!pref) return null;
                // ตัด emoji ออกเพื่อเอาแค่คำค้น เช่น "ทะเล", "คาเฟ่"
                const cleanKeyword = pref.label.replace(/^[^\s]+\s*/, "");
                return (
                  <button
                    key={pref.id}
                    type="button"
                    onClick={() => {
                      setQuery(cleanKeyword);
                      handleSearch(cleanKeyword);
                    }}
                    className="rounded-lg border border-amber-200/80 bg-amber-50/70 px-2 py-0.5 text-[10px] font-semibold text-amber-900 hover:bg-amber-100 transition-colors cursor-pointer"
                  >
                    {pref.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Submit Search Button */}
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              disabled={isSearching}
              onClick={() => handleSearch()}
              className="flex-1 rounded-xl bg-amber-500 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-amber-600 active:scale-95 disabled:opacity-50 transition-all cursor-pointer"
            >
              {isSearching ? "⏳ กำลังค้นหาข้อมูล…" : "🚀 ค้นหาเลย"}
            </button>
            <Tooltip content="เปิดค้นหาบน Google Maps ในแท็บใหม่">
              <a
                href={googleMapsSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs font-semibold text-stone-700 hover:bg-stone-100 transition-colors shrink-0"
              >
                <span>🗺️ Google Maps</span>
                <span className="text-[10px]">↗</span>
              </a>
            </Tooltip>
          </div>
        </div>

        {/* Results Area */}
        <div className="mt-4 flex-1 overflow-y-auto min-h-[180px] space-y-2 pr-0.5">
          {/* API Disabled or Error Banner */}
          {apiDisabledMessage && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-center">
              <p className="text-xl mb-1.5">💡</p>
              <p className="text-xs font-bold text-amber-950">{apiDisabledMessage}</p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenManualAdd();
                  }}
                  className="rounded-xl bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600 cursor-pointer"
                >
                  ➕ เสนอสถานที่ด้วยตนเอง
                </button>
                <a
                  href={googleMapsSearchUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-xl border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50"
                >
                  เปิด Google Maps ↗
                </a>
              </div>
            </div>
          )}

          {/* Zero results but completed */}
          {!isSearching && !apiDisabledMessage && results.length === 0 && (
            <div className="py-10 text-center text-stone-400 space-y-2">
              <p className="text-3xl">🧭</p>
              <p className="text-xs font-medium">
                ระบุปลายทางและกดค้นหา หรือเสนอสถานที่ด้วยตนเองได้ทันที
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenManualAdd();
                }}
                className="mt-1 text-xs font-bold text-amber-600 hover:underline cursor-pointer"
              >
                + เสนอสถานที่ด้วยตนเอง
              </button>
            </div>
          )}

          {/* Results List */}
          {results.map((item) => {
            const isAlreadyAdded =
              addedIds.has(item.providerPlaceId) ||
              existingProviderIds.has(item.providerPlaceId);
            return (
              <div
                key={item.providerPlaceId}
                className="flex items-center justify-between gap-3 rounded-2xl border border-stone-200/80 bg-stone-50/50 p-3 hover:bg-white hover:border-amber-200 transition-all"
              >
                <div className="min-w-0">
                  <h4 className="truncate text-xs font-bold text-stone-900">
                    {item.name}
                  </h4>
                  {item.location && (
                    <p className="truncate text-[11px] text-stone-500 mt-0.5">
                      📍 {item.location}
                    </p>
                  )}
                  {item.externalUrl && (
                    <a
                      href={item.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-0.5 text-[10px] text-amber-700 hover:underline"
                    >
                      ดูแผนที่ ↗
                    </a>
                  )}
                </div>

                <div className="shrink-0">
                  {isAlreadyAdded ? (
                    <span className="rounded-xl border border-stone-200 bg-stone-100 px-3 py-1.5 text-[11px] font-bold text-stone-400">
                      ✓ เสนอแล้ว
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAddSearchResult(item)}
                      className="rounded-xl bg-stone-900 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-amber-600 active:scale-95 transition-all cursor-pointer"
                    >
                      + เสนอให้กลุ่ม
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer Attributions & Direct Entry Link */}
        <div className="mt-3 border-t border-stone-100 pt-2.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-stone-400">
          <div className="flex items-center gap-2">
            <span>
              {attributions ? (
                <>
                  <a
                    href={attributions.geoapifyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {attributions.geoapify}
                  </a>{" "}
                  ·{" "}
                  <a
                    href={attributions.osmUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:underline"
                  >
                    {attributions.osm}
                  </a>
                </>
              ) : (
                "OpenStreetMap & Geoapify Discovery"
              )}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenManualAdd();
            }}
            className="font-bold text-amber-700 hover:underline cursor-pointer"
          >
            ไม่พบที่ถูกใจ? เสนอเองเลย ✍️
          </button>
        </div>
      </div>
    </div>
  );
}
