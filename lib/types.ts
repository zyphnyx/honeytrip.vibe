export type MemberStatus = "going" | "maybe" | "out";
export type Transport = "own_car" | "need_ride" | "any";

export interface Room {
  title: string;
  emoji: string;
  createdAt: number;
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

