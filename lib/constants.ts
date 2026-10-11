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

export const ACTIVITY_CATEGORIES = [
  { id: "attraction", label: "🎡 เที่ยว / จุดเช็กอิน", icon: "🎡", short: "ที่เที่ยว" },
  { id: "food", label: "🍜 ร้านอาหาร / คาเฟ่", icon: "🍜", short: "ของกิน" },
  { id: "stay", label: "🏡 ที่พัก / เช็กอิน", icon: "🏡", short: "ที่พัก" },
  { id: "transport", label: "🚗 เดินทาง / รถรับส่ง", icon: "🚗", short: "เดินทาง" },
  { id: "other", label: "📌 อื่นๆ", icon: "📌", short: "อื่นๆ" },
] as const;

export const ACTIVITY_STATUSES = [
  { id: "proposed", label: "💡 เสนอไว้", short: "เสนอ", badgeClass: "bg-amber-100 text-amber-800 border-amber-200" },
  { id: "confirmed", label: "✅ ยืนยันแล้ว", short: "ยืนยัน", badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { id: "completed", label: "🏁 ไปแล้ว", short: "เสร็จสิ้น", badgeClass: "bg-blue-100 text-blue-800 border-blue-200" },
  { id: "cancelled", label: "❌ ยกเลิก", short: "ยกเลิก", badgeClass: "bg-stone-100 text-stone-500 border-stone-200" },
] as const;

export const COST_MODES = [
  { id: "per_person", label: "ต่อคน", suffix: "/คน", desc: "คูณตามจำนวนคนเข้าร่วม" },
  { id: "split_total", label: "หารเท่ากัน", suffix: "รวม", desc: "หารตามจำนวนคนเข้าร่วม" },
  { id: "free", label: "ฟรี (0 บาท)", suffix: "ฟรี", desc: "ไม่มีค่าใช้จ่าย" },
  { id: "unknown", label: "ยังไม่ทราบ", suffix: "?", desc: "ยังไม่กำหนดราคา" },
] as const;
