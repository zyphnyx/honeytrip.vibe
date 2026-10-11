"use client";

import { useEffect, useMemo, useState } from "react";
import { isFirebaseConfigured } from "./firebase";
import {
  deleteActivity,
  saveActivity,
  savePlanMeta,
  subscribeActivities,
  subscribePlanMeta,
  toggleActivityLike,
  updateActivityStatus,
} from "./activities";
import type {
  Activity,
  ActivityInput,
  ActivityStatus,
  Member,
  PlanBudgetSummary,
  TripPlanMeta,
} from "./types";
import {
  calculatePlanBudget,
  detectScheduleConflicts,
  type ActivityConflict,
} from "./activityStats.ts";

export interface UseActivitiesReturn {
  meta: TripPlanMeta | null | undefined;
  activities: Activity[] | undefined;
  isLoading: boolean;
  error: string | null;
  budget: PlanBudgetSummary;
  conflicts: Map<string, ActivityConflict[]>;

  // Actions
  onSaveMeta: (metaInput: Partial<TripPlanMeta>) => Promise<void>;
  onSaveActivity: (input: ActivityInput, activityId?: string) => Promise<string>;
  onUpdateStatus: (activityId: string, status: ActivityStatus) => Promise<void>;
  onToggleLike: (activityId: string) => Promise<void>;
  onDeleteActivity: (activityId: string) => Promise<void>;
}

export function useActivities(
  roomId: string,
  members: Member[] = [],
  uid: string | null,
): UseActivitiesReturn {
  const [meta, setMeta] = useState<TripPlanMeta | null | undefined>(undefined);
  const [activities, setActivities] = useState<Activity[] | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFirebaseConfigured || !roomId) return;
    let cancelled = false;
    const unsubs: Array<() => void> = [];

    const fail = (e: Error) => {
      if (!cancelled) setError(e.message);
    };

    unsubs.push(
      subscribePlanMeta(
        roomId,
        (m) => {
          if (!cancelled) setMeta(m);
        },
        fail,
      ),
    );

    unsubs.push(
      subscribeActivities(
        roomId,
        (acts) => {
          if (!cancelled) setActivities(acts);
        },
        fail,
      ),
    );

    return () => {
      cancelled = true;
      unsubs.forEach((u) => u());
    };
  }, [roomId]);

  const budget = useMemo(() => {
    return calculatePlanBudget(activities || [], members);
  }, [activities, members]);

  const conflicts = useMemo(() => {
    return detectScheduleConflicts(activities || []);
  }, [activities]);

  const handleSaveMeta = async (metaInput: Partial<TripPlanMeta>) => {
    if (!uid) throw new Error("กรุณารอระบบระบุตัวตนสักครู่");
    await savePlanMeta(roomId, metaInput, uid);
  };

  const handleSaveActivity = async (input: ActivityInput, activityId?: string) => {
    if (!uid) throw new Error("กรุณารอระบบระบุตัวตนสักครู่");
    return await saveActivity(roomId, input, activityId, uid);
  };

  const handleUpdateStatus = async (activityId: string, status: ActivityStatus) => {
    await updateActivityStatus(roomId, activityId, status);
  };

  const handleToggleLike = async (activityId: string) => {
    if (!uid) return;
    const act = activities?.find((a) => a.id === activityId);
    if (!act) return;
    const isLiked = act.likedByUids?.includes(uid) ?? false;
    await toggleActivityLike(roomId, activityId, uid, isLiked);
  };

  const handleDeleteActivity = async (activityId: string) => {
    await deleteActivity(roomId, activityId);
  };

  const isLoading = activities === undefined || meta === undefined;

  return {
    meta,
    activities,
    isLoading,
    error,
    budget,
    conflicts,
    onSaveMeta: handleSaveMeta,
    onSaveActivity: handleSaveActivity,
    onUpdateStatus: handleUpdateStatus,
    onToggleLike: handleToggleLike,
    onDeleteActivity: handleDeleteActivity,
  };
}
