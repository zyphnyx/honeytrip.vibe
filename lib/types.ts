export type MemberStatus = "going" | "maybe" | "out";
export type Transport = "own_car" | "need_ride" | "any";

export interface Room {
  title: string;
  emoji: string;
  createdAt: number;
  ownerUid?: string;
  archived?: boolean;
  archivedAt?: number | null;
  archivedBy?: string | null;
}

export interface Member {
  id: string; // = auth uid
  name: string;
  emoji: string;
  status: MemberStatus;
  durationMin: number; // วัน
  durationMax: number;
  budgetMin: number; // บาท/คน ทั้งทริป
  budgetMax: number;
  availableDates: string[]; // YYYY-MM-DD
  origin: string;
  transport: Transport;
  seats: number;
  prefs: string[];
  note: string;
  updatedAt: number;
}

export type MemberInput = Omit<Member, "id" | "updatedAt">;

// --- Place Discovery & Voting Types ---

export type PlaceCategory = "stay" | "attraction";
export type PlaceSource = "manual" | "geoapify";

export interface PlaceCoords {
  lat: number;
  lon: number;
}

export interface Place {
  id: string;
  category: PlaceCategory;
  source: PlaceSource;
  providerPlaceId?: string | null;
  name: string;
  location?: string | null;
  coords?: PlaceCoords | null;
  externalUrl?: string | null;
  price?: number | null;
  priceUnit?: string | null;
  capacity?: number | null;
  estimatedDuration?: string | null;
  notes?: string | null;
  createdBy: string;
  createdByName: string;
  createdByEmoji?: string | null;
  createdAt: number;
  updatedAt: number;
}

export type PlaceInput = Omit<Place, "id" | "createdAt" | "updatedAt">;

export interface PlaceSettings {
  destination: string;
  destinationCoords?: PlaceCoords | null;
  stayVotingStatus?: "open" | "closed";
  attractionVotingStatus?: "open" | "closed";
  finalizedStayId?: string | null;
  finalizedAttractionIds?: string[];
  updatedAt: number;
}

export interface VoteDoc {
  id: string; // uid ของผู้โหวต
  stayId?: string | null; // รองรับข้อมูลเดิม (backward compatible)
  stayIds?: string[]; // เลือกที่พักได้มากกว่า 1 ที่ (สูงสุด 3 ที่)
  attractionIds: string[]; // เลือกที่เที่ยวได้สูงสุด 3 ที่
  updatedAt: number;
}

export interface PlaceVoteItem {
  place: Place;
  votesCount: number;
  voterUids: string[];
  voters: { uid: string; name: string; emoji: string }[];
  isLeading: boolean;
}

export interface VotingResults {
  eligibleVotersCount: number;
  stayVotersCount: number;
  attractionVotersCount: number;
  stays: PlaceVoteItem[];
  attractions: PlaceVoteItem[];
  leadingStays: Place[];
  leadingAttractions: Place[];
  isStayTie: boolean;
  isAttractionTie: boolean;
}

// --- Trip Timeline & Social Planner Types ---

export interface TripPlanMeta {
  startDate: string | null; // YYYY-MM-DD
  endDate: string | null;   // YYYY-MM-DD
  timezone: "Asia/Bangkok";
  status: "draft" | "confirmed";
  updatedBy: string;
  updatedAt: number;
}

export type ActivityStatus =
  | "proposed"
  | "confirmed"
  | "completed"
  | "cancelled";

export type ActivityCategory =
  | "attraction"
  | "food"
  | "stay"
  | "transport"
  | "other";

export type ActivityCostMode =
  | "per_person"
  | "split_total"
  | "free"
  | "unknown";

export interface ActivityCost {
  mode: ActivityCostMode;
  amount: number | null;
  currency: "THB";
}

export interface ActivityPlaceSnapshot {
  name: string;
  location?: string;
  externalUrl?: string;
}

export interface Activity {
  id: string;

  title: string;
  description: string;

  category: ActivityCategory;
  status: ActivityStatus;

  date: string | null;      // YYYY-MM-DD
  startTime: string | null; // HH:mm
  endTime: string | null;   // HH:mm

  placeId: string | null;
  placeSnapshot: ActivityPlaceSnapshot | null;

  transport: string | null;

  cost: ActivityCost;
  participantUids: string[];

  likedByUids: string[];

  createdBy: string;
  createdAt: number;
  updatedAt: number;
}

export type ActivityInput = Omit<Activity, "id" | "createdAt" | "updatedAt" | "likedByUids">;

export interface ActivityComment {
  id: string;
  activityId: string;
  authorUid: string;
  authorName?: string;
  authorEmoji?: string;
  body: string;
  createdAt: number;
}

export interface PlanBudgetSummary {
  totalEstimated: number;
  totalActivitiesCount: number;
  confirmedCount: number;
  completedCount: number;
  proposedCount: number;
  cancelledCount: number;
  unknownCostCount: number;
  freeCostCount: number;
  byParticipant: Record<string, number>;
  byDate: Record<string, number>;
}

export interface TripBackupCounts {
  members: number;
  places: number;
  votes: number;
  settings: number;
  plan: number;
  activities: number;
  activityComments: number;
}

export interface TripBackup {
  format: "honeytrip-backup";
  schemaVersion: number;
  exportedAt: string;
  roomId: string;
  data: {
    room: Room;
    members: Member[];
    places: Place[];
    votes: Array<{ id: string; [key: string]: unknown }>;
    settings: Array<{ id: string; [key: string]: unknown }>;
    plan: Array<{ id: string; [key: string]: unknown }>;
    activities: Activity[];
    activityComments: ActivityComment[];
  };
  counts: TripBackupCounts;
}


