"use client";

import { useMemo, useState } from "react";
import { Tooltip } from "@/components/Tooltip";
import { usePlaces } from "@/lib/usePlaces";
import type { Member, Place, PlaceCategory, PlaceVoteItem, Room } from "@/lib/types";
import { AddPlaceModal } from "./AddPlaceModal";
import { DestinationHeader } from "./DestinationHeader";
import { PlaceCard } from "./PlaceCard";
import { PlaceDetailModal } from "./PlaceDetailModal";
import { PlaceSearchDialog } from "./PlaceSearchDialog";
import { VoteProgress } from "./VoteProgress";

interface PlacesBoardProps {
  roomId: string;
  room: Room;
  members: Member[];
  uid: string | null;
  me: Member | undefined;
}

export function PlacesBoard({ roomId, members, uid, me }: PlacesBoardProps) {
  const [activeCategory, setActiveCategory] = useState<PlaceCategory>("stay");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<PlaceVoteItem | null>(null);
  const [editingPlace, setEditingPlace] = useState<Place | null>(null);

  const {
    places,
    settings,
    results,
    myVote,
    isLoading,
    error,
    onSavePlace,
    onDeletePlace,
    onUpdateSettings,
    onVoteStay,
    onVoteAttraction,
  } = usePlaces(roomId, members, uid);

  const isStay = activeCategory === "stay";
  const items = isStay ? results.stays : results.attractions;
  const isEligible = Boolean(me && (me.status === "going" || me.status === "maybe"));

  // สถานะการโหวตของฉัน (ทั้งที่พักและที่เที่ยว โหวตได้สูงสุดคนละ 3 ที่)
  const myStayVoteIds = useMemo(
    () => new Set(myVote?.stayIds ?? (myVote?.stayId ? [myVote.stayId] : [])),
    [myVote],
  );
  const myAttractionVoteIds = useMemo(
    () => new Set(myVote?.attractionIds || []),
    [myVote],
  );
  const canVoteMoreStays = myStayVoteIds.size < 3;
  const canVoteMoreAttractions = myAttractionVoteIds.size < 10;

  const handleOpenEdit = (place: Place) => {
    setEditingPlace(place);
    setIsAddModalOpen(true);
  };

  const handleUpdateDestination = async (destination: string) => {
    await onUpdateSettings({ destination });
  };

  if (isLoading) {
    return (
      <div className="card mt-4 py-12 text-center text-stone-500 space-y-2">
        <div className="text-3xl animate-pulse">📍</div>
        <p className="text-xs font-semibold">กำลังโหลดสถานที่และผลโหวต…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card mt-4 p-6 text-center text-red-600 bg-red-50/50 border border-red-200">
        <p className="text-2xl mb-1">⚠️</p>
        <p className="text-xs font-bold">เกิดข้อผิดพลาดในการโหลดข้อมูลสถานที่</p>
        <p className="text-[11px] text-stone-500 mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 1. Trip Destination Bar */}
      <DestinationHeader
        settings={settings}
        onUpdateDestination={handleUpdateDestination}
      />

      {/* 2. Sub-Category Selector (ที่พัก vs ที่เที่ยว) */}
      <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-stone-200/80 bg-stone-100/70 p-1">
        <button
          type="button"
          onClick={() => setActiveCategory("stay")}
          className={`flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-bold transition-all cursor-pointer ${
            isStay
              ? "bg-white text-stone-900 shadow-xs border border-stone-200/60"
              : "text-stone-500 hover:text-stone-800"
          }`}
        >
          <span>🏡 ที่พัก</span>
          <span
            className={`rounded-md px-1.5 py-0.2 text-[10px] ${
              isStay ? "bg-amber-100 text-amber-900" : "bg-stone-200 text-stone-600"
            }`}
          >
            {results.stays.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategory("attraction")}
          className={`flex items-center justify-center gap-2 rounded-xl py-2 text-xs font-bold transition-all cursor-pointer ${
            !isStay
              ? "bg-white text-stone-900 shadow-xs border border-stone-200/60"
              : "text-stone-500 hover:text-stone-800"
          }`}
        >
          <span>📍 ที่เที่ยว</span>
          <span
            className={`rounded-md px-1.5 py-0.2 text-[10px] ${
              !isStay ? "bg-teal-100 text-teal-900" : "bg-stone-200 text-stone-600"
            }`}
          >
            {results.attractions.length}
          </span>
        </button>
      </div>

      {/* 3. Participation & Voting Progress Indicator */}
      <VoteProgress category={activeCategory} results={results} />

      {/* 4. Action Buttons (Search & Manual Add) */}
      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        <Tooltip content="ค้นหาสถานที่รอบปลายทางผ่าน OpenStreetMap / แผนที่" className="w-full">
          <button
            type="button"
            onClick={() => setIsSearchOpen(true)}
            className="w-full flex items-center justify-center gap-2 rounded-2xl border border-stone-200/90 bg-white py-3 px-3 text-xs font-bold text-stone-800 shadow-2xs hover:border-amber-300 hover:bg-amber-50/60 hover:text-amber-950 transition-all cursor-pointer active:scale-98"
          >
            <span className="text-sm">🔍</span>
            <span className="truncate">ค้นหา{isStay ? "ที่พัก" : "ที่เที่ยว"}</span>
          </button>
        </Tooltip>

        <Tooltip content="กรอกชื่อสถานที่หรือแปะลิงก์ที่เพื่อนแนะนำมาด้วยตนเอง" className="w-full">
          <button
            type="button"
            onClick={() => {
              setEditingPlace(null);
              setIsAddModalOpen(true);
            }}
            className="w-full flex items-center justify-center gap-2 rounded-2xl bg-amber-500 py-3 px-3 text-xs font-bold text-white shadow-xs hover:bg-amber-600 transition-all cursor-pointer active:scale-98"
          >
            <span className="text-sm">➕</span>
            <span className="truncate">เสนอ{isStay ? "ที่พัก" : "ที่เที่ยว"}เอง</span>
          </button>
        </Tooltip>
      </div>

      {/* 5. Warning banner if user is not eligible to vote */}
      {!isEligible && (
        <div className="rounded-2xl border border-stone-200 bg-stone-50 p-3 text-xs text-stone-600 flex items-center gap-2">
          <span>ℹ️</span>
          <span>
            {me?.status === "out"
              ? "คุณได้ตั้งสถานะเป็น 'ไม่ไป' จึงไม่มีสิทธิ์ร่วมโหวตสถานที่"
              : "กรุณากรอกข้อมูลเข้าร่วมทริปในแท็บ 'ข้อมูลของฉัน' เพื่อร่วมโหวตสถานที่กับเพื่อนๆ"}
          </span>
        </div>
      )}

      {/* 6. Places Cards Grid */}
      {items.length === 0 ? (
        <div className="card py-12 text-center text-stone-400 space-y-3">
          <p className="text-4xl">{isStay ? "🏡" : "🏖️"}</p>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-stone-700">
              ยังไม่มีใครเสนอ{isStay ? "ที่พัก" : "ที่เที่ยว"}ในทริปนี้
            </h4>
            <p className="text-xs text-stone-400 max-w-xs mx-auto">
              กดปุ่มค้นหาหรือเสนอสถานที่ที่เล็งไว้ เพื่อให้เพื่อนๆ ในแก๊งช่วยกันกดโหวตได้เลย!
            </p>
          </div>
          <div className="pt-1 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => setIsSearchOpen(true)}
              className="btn-primary !text-xs !py-2"
            >
              🔍 ค้นหาสถานที่
            </button>
            <button
              type="button"
              onClick={() => {
                setEditingPlace(null);
                setIsAddModalOpen(true);
              }}
              className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-xs font-bold text-stone-700 hover:bg-stone-50 cursor-pointer"
            >
              + เสนอเอง
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {items.map((item) => {
            const isVotedByMe = isStay
              ? myStayVoteIds.has(item.place.id)
              : myAttractionVoteIds.has(item.place.id);
            const canVoteMore = isStay ? canVoteMoreStays : canVoteMoreAttractions;

            return (
              <PlaceCard
                key={item.place.id}
                item={item}
                uid={uid}
                isEligible={isEligible}
                isVotedByMe={isVotedByMe}
                canVoteMore={canVoteMore}
                onVote={() => {
                  if (isStay) {
                    onVoteStay(item.place.id);
                  } else {
                    onVoteAttraction(item.place.id);
                  }
                }}
                onOpenDetail={() => setSelectedItem(item)}
              />
            );
          })}
        </div>
      )}

      {/* 7. Modals */}
      <AddPlaceModal
        key={editingPlace?.id ?? (isAddModalOpen ? `open-${activeCategory}` : "closed")}
        isOpen={isAddModalOpen}
        initialCategory={activeCategory}
        initialPlace={editingPlace}
        me={me}
        uid={uid}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingPlace(null);
        }}
        onSave={onSavePlace}
      />

      <PlaceDetailModal
        item={selectedItem}
        uid={uid}
        onClose={() => setSelectedItem(null)}
        onEdit={() => {
          if (selectedItem) {
            handleOpenEdit(selectedItem.place);
            setSelectedItem(null);
          }
        }}
        onDelete={onDeletePlace}
        onVote={() => {
          if (!selectedItem) return;
          if (selectedItem.place.category === "stay") {
            onVoteStay(selectedItem.place.id);
          } else {
            onVoteAttraction(selectedItem.place.id);
          }
        }}
        isEligible={isEligible}
        isVotedByMe={
          selectedItem?.place.category === "stay"
            ? myStayVoteIds.has(selectedItem.place.id)
            : Boolean(selectedItem && myAttractionVoteIds.has(selectedItem.place.id))
        }
        canVoteMore={
          selectedItem?.place.category === "stay"
            ? canVoteMoreStays
            : canVoteMoreAttractions
        }
      />

      <PlaceSearchDialog
        key={isSearchOpen ? `search-${settings?.destination || "new"}` : "search-closed"}
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        category={activeCategory}
        destination={settings?.destination || ""}
        settings={settings}
        existingPlaces={places || []}
        members={members}
        me={me}
        uid={uid}
        onAddPlace={onSavePlace}
        onOpenManualAdd={() => {
          setEditingPlace(null);
          setIsAddModalOpen(true);
        }}
      />
    </div>
  );
}
