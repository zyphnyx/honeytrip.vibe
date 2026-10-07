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
