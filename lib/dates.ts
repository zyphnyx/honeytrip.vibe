// ใช้ local time ทั้งหมด (key = YYYY-MM-DD) กัน timezone เพี้ยนจาก toISOString

const pad = (n: number) => String(n).padStart(2, "0");

export function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(): string {
  return toKey(new Date());
}

export function addDays(key: string, n: number): string {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

export function formatShort(key: string): string {
  return parseKey(key).toLocaleDateString("th-TH", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function formatRange(startKey: string, days: number): string {
  if (days <= 1) return formatShort(startKey);
  return `${formatShort(startKey)} – ${formatShort(addDays(startKey, days - 1))}`;
}
