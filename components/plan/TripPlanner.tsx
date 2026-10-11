"use client";

import { useMemo, useState } from "react";
import { CostSummaryCard } from "./CostSummaryCard";
import { DailyTimeline } from "./DailyTimeline";
import { PlanDateSetup } from "./PlanDateSetup";
import { PlanHeader } from "./PlanHeader";
import { ActivityForm } from "./ActivityForm";
import { ActivityPostCard } from "./ActivityPostCard";
import { ActivityDetailModal } from "./ActivityDetailModal";
import type { UseActivitiesReturn } from "@/lib/useActivities";
import type { Activity, Member, Place, Room } from "@/lib/types";

export function TripPlanner({
  roomId,
  room,
  members = [],
  uid,
  places = [],
  planner,
}: {
  roomId: string;
  room: Room;
  members?: Member[];
  uid: string | null;
  places?: Place[];
  planner: UseActivitiesReturn;
}) {
  const {
    meta,
    activities = [],
    budget,
    conflicts,
    onSaveMeta,
    onSaveActivity,
    onUpdateStatus,
    onToggleLike,
    onDeleteActivity,
  } = planner;

  const [activeTab, setActiveTab] = useState<"feed" | "timeline">("timeline");
  const [showDateSetup, setShowDateSetup] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null);
  const [selectedDetailActivity, setSelectedDetailActivity] = useState<Activity | null>(null);
  const [formDefaultDate, setFormDefaultDate] = useState<string | undefined>(undefined);
  const [formDefaultMode, setFormDefaultMode] = useState<"proposed" | "confirmed">("proposed");

  // Keep selectedDetailActivity synced with latest state from activities
  const activeDetailActivity = useMemo(() => {
    if (!selectedDetailActivity) return null;
    return activities.find((a) => a.id === selectedDetailActivity.id) || selectedDetailActivity;
  }, [activities, selectedDetailActivity]);

  // Feed filter
  const [feedFilter, setFeedFilter] = useState<"all" | "proposed" | "confirmed">("all");

  // Activities for Social Feed: Newest created first
  const feedActivities = useMemo(() => {
    let list = [...activities];
    if (feedFilter === "proposed") {
      list = list.filter((a) => a.status === "proposed");
    } else if (feedFilter === "confirmed") {
      list = list.filter((a) => a.status === "confirmed" || a.status === "completed");
    }
    // เรียงตามสร้างล่าสุดก่อน
    return list.sort((a, b) => b.createdAt - a.createdAt);
  }, [activities, feedFilter]);

  const handleOpenAdd = (mode: "proposed" | "confirmed" = "proposed", date?: string) => {
    setEditingActivity(null);
    setFormDefaultMode(mode);
    setFormDefaultDate(date);
    setFormOpen(true);
  };

  const handleEdit = (act: Activity) => {
    setEditingActivity(act);
    setFormDefaultMode(act.status === "proposed" ? "proposed" : "confirmed");
    setFormOpen(true);
  };

  const handleDelete = async (actId: string) => {
    if (!confirm("คุณต้องการลบกิจกรรมนี้ออกจากทริปใช่หรือไม่?")) return;
    try {
      await onDeleteActivity(actId);
      if (selectedDetailActivity?.id === actId) {
        setSelectedDetailActivity(null);
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "ลบไม่สำเร็จ");
    }
  };

  const handleConfirmSchedule = async (act: Activity) => {
    // หากมีวันและเวลาเริ่มครบแล้ว สามารถยืนยันได้ทันที
    if (act.date && act.startTime) {
      await onUpdateStatus(act.id, "confirmed");
    } else {
      // หากยังไม่มีวันหรือเวลา ให้เปิดแบบฟอร์มแก้ไขในโหมด Confirmed เพื่อให้ระบุวัน/เวลา
      setEditingActivity(act);
      setFormDefaultMode("confirmed");
      setFormOpen(true);
    }
  };

  const proposedCount = budget.proposedCount;
  const confirmedCount = budget.confirmedCount + budget.completedCount;

  return (
    <div className="space-y-4">
      {/* Header */}
      <PlanHeader
        room={room}
        roomId={roomId}
        meta={meta}
        activities={activities}
        members={members}
        onOpenDateSetup={() => setShowDateSetup(true)}
      />

      {/* Main Mode Tabs Switcher */}
      <div className="flex items-center justify-between gap-2">
        <div className="grid grid-cols-2 gap-1 rounded-2xl border border-stone-200/80 bg-stone-100/70 p-1 flex-1">
          <button
            type="button"
            onClick={() => setActiveTab("timeline")}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "timeline"
                ? "bg-white text-stone-950 shadow-xs border border-stone-200/60"
                : "text-stone-500 hover:text-stone-800"
            }`}
          >
            <span>🗓️ ตารางเที่ยว</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                activeTab === "timeline"
                  ? "bg-amber-100 text-amber-900"
                  : "bg-stone-200 text-stone-600"
              }`}
            >
              {confirmedCount}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("feed")}
            className={`flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-bold transition-all cursor-pointer ${
              activeTab === "feed"
                ? "bg-white text-stone-950 shadow-xs border border-stone-200/60"
                : "text-stone-500 hover:text-stone-800"
            }`}
          >
            <span>💡 ไอเดียจากเพื่อน</span>
            <span
              className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                activeTab === "feed"
                  ? "bg-amber-100 text-amber-900"
                  : "bg-stone-200 text-stone-600"
              }`}
            >
              {activities.length}
            </span>
          </button>
        </div>

        {/* Global Add Button */}
        <button
          type="button"
          onClick={() => handleOpenAdd(activeTab === "timeline" ? "confirmed" : "proposed")}
          className="btn-primary !py-2 !px-3 !text-xs font-bold shadow-xs shrink-0 flex items-center gap-1 cursor-pointer"
        >
          <span>+</span>
          <span>{activeTab === "timeline" ? "เพิ่มกิจกรรม" : "เสนอไอเดีย"}</span>
        </button>
      </div>

      {/* View Content */}
      {activeTab === "timeline" ? (
        <DailyTimeline
          meta={meta}
          activities={activities}
          members={members}
          conflicts={conflicts}
          onOpenDateSetup={() => setShowDateSetup(true)}
          onOpenDetail={(act) => setSelectedDetailActivity(act)}
          onAddActivity={(defaultDate) => handleOpenAdd("confirmed", defaultDate)}
          onEditActivity={handleEdit}
          onDeleteActivity={handleDelete}
          onUpdateStatus={onUpdateStatus}
        />
      ) : (
        <div className="space-y-3">
          {/* Feed Filter Chips */}
          <div className="flex items-center justify-between gap-2 border-b border-stone-100 pb-2">
            <div className="flex gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setFeedFilter("all")}
                className={`rounded-xl px-2.5 py-1 text-xs font-semibold cursor-pointer border ${
                  feedFilter === "all"
                    ? "border-amber-400 bg-amber-100 text-stone-950 font-bold"
                    : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                }`}
              >
                ทั้งหมด ({activities.length})
              </button>
              <button
                type="button"
                onClick={() => setFeedFilter("proposed")}
                className={`rounded-xl px-2.5 py-1 text-xs font-semibold cursor-pointer border ${
                  feedFilter === "proposed"
                    ? "border-amber-400 bg-amber-100 text-stone-950 font-bold"
                    : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                }`}
              >
                💡 เสนอไว้ ({proposedCount})
              </button>
              <button
                type="button"
                onClick={() => setFeedFilter("confirmed")}
                className={`rounded-xl px-2.5 py-1 text-xs font-semibold cursor-pointer border ${
                  feedFilter === "confirmed"
                    ? "border-amber-400 bg-amber-100 text-stone-950 font-bold"
                    : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                }`}
              >
                ✅ คอนเฟิร์มแล้ว ({confirmedCount})
              </button>
            </div>
          </div>

          {/* Social Feed List */}
          {feedActivities.length === 0 ? (
            <div className="card py-12 text-center space-y-2">
              <div className="text-3xl">🍯</div>
              <h3 className="font-bold text-sm text-stone-800">ยังไม่มีโพสต์ไอเดียกิจกรรม</h3>
              <p className="text-xs text-stone-400 max-w-xs mx-auto">
                ชวนเพื่อนๆ เสนอกิจกรรมที่อยากทำ ร้านที่อยากกิน หรือที่เที่ยวที่อยากแวะได้เลย!
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => handleOpenAdd("proposed")}
                  className="btn-primary !text-xs !py-2 font-bold cursor-pointer"
                >
                  💡 โพสต์เสนอไอเดียแรก
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {feedActivities.map((act) => (
                <ActivityPostCard
                  key={act.id}
                  activity={act}
                  roomId={roomId}
                  uid={uid}
                  members={members}
                  onOpenDetail={(a) => setSelectedDetailActivity(a)}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onUpdateStatus={onUpdateStatus}
                  onToggleLike={onToggleLike}
                  onConfirmSchedule={handleConfirmSchedule}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Estimated Cost Summary Card */}
      <CostSummaryCard budget={budget} members={members} />

      {/* Date Setup Modal */}
      {showDateSetup && (
        <PlanDateSetup
          key={`${meta?.startDate}-${meta?.endDate}`}
          isOpen={showDateSetup}
          onClose={() => setShowDateSetup(false)}
          meta={meta}
          activities={activities}
          onSave={async ({ startDate, endDate }) => {
            await onSaveMeta({ startDate, endDate, status: "confirmed" });
          }}
        />
      )}

      {/* Activity Creation/Edit Modal */}
      {formOpen && (
        <ActivityForm
          key={editingActivity ? editingActivity.id : `new-${formDefaultMode}-${formDefaultDate || ""}`}
          isOpen={formOpen}
          initialActivity={editingActivity}
          initialDate={formDefaultDate}
          initialMode={formDefaultMode}
          meta={meta}
          places={places}
          members={members}
          uid={uid}
          onClose={() => {
            setFormOpen(false);
            setEditingActivity(null);
          }}
          onSave={async (input, actId) => {
            await onSaveActivity(input, actId);
          }}
        />
      )}

      {/* Activity Detail Modal */}
      <ActivityDetailModal
        isOpen={Boolean(selectedDetailActivity)}
        activity={activeDetailActivity}
        roomId={roomId}
        uid={uid}
        members={members}
        conflicts={activeDetailActivity ? conflicts.get(activeDetailActivity.id) || [] : []}
        allActivities={activities}
        onClose={() => setSelectedDetailActivity(null)}
        onEdit={(act) => handleEdit(act)}
        onDelete={(actId) => handleDelete(actId)}
        onUpdateStatus={onUpdateStatus}
      />
    </div>
  );
}
