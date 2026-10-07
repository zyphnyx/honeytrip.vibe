import type { MemberStatus, Transport } from "./types";

export const AVATARS = [
  "🐻", "🐼", "🦊", "🐱", "🐶", "🐰", "🐯", "🦁",
  "🐸", "🐵", "🦄", "🐙", "🦋", "🐝", "🐧", "🦖",
];

export const ROOM_EMOJIS = ["🏖️", "⛰️", "🏕️", "🌴", "🍯", "🚗", "🎉", "🍜"];

export const STATUSES: { id: MemberStatus; label: string; short: string; color: string }[] = [
  { id: "going", label: "✅ ไปแน่นอน", short: "ไปแน่", color: "bg-emerald-100 text-emerald-800" },
  { id: "maybe", label: "🤔 ยังไม่แน่ใจ", short: "ลังเล", color: "bg-amber-100 text-amber-800" },
  { id: "out", label: "❌ ไปไม่ได้", short: "ไม่ไป", color: "bg-stone-100 text-stone-500" },
];

export const TRANSPORTS: { id: Transport; label: string }[] = [
  { id: "own_car", label: "🚗 มีรถ" },
  { id: "need_ride", label: "🙋 ขอติดรถ" },
  { id: "any", label: "👌 ไหนก็ได้" },
];

export const PREFS = [
  { id: "sea", label: "🏖️ ทะเล" },
  { id: "mountain", label: "⛰️ ภูเขา" },
  { id: "nature", label: "🌿 ธรรมชาติ" },
  { id: "cafe", label: "☕ คาเฟ่" },
  { id: "city", label: "🏙️ เมือง" },
  { id: "food", label: "🍜 สายกิน" },
  { id: "chill", label: "😌 ชิลล์" },
  { id: "adventure", label: "🧗 ผจญภัย" },
  { id: "party", label: "🎉 ปาร์ตี้" },
  { id: "photo", label: "📸 ถ่ายรูป" },
];

export const MAX_DAYS = 7;
