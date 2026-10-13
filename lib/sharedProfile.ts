import { doc, getDoc, runTransaction } from "firebase/firestore";
import { getClientAuth, getDb } from "./firebase";
import { useProfile, type RecentRoom } from "@/store/profile";

function rooms(value: unknown): RecentRoom[] {
  if (!Array.isArray(value)) return [];
  return value.filter((r): r is RecentRoom => r && typeof r.id === "string" && /^[a-z0-9]{1,64}$/.test(r.id)
    && typeof r.title === "string" && r.title.length <= 300 && typeof r.emoji === "string"
    && typeof r.visitedAt === "number").slice(0, 10);
}

export async function loadSharedProfile(uid: string, replace = false) {
  const local = useProfile.getState();
  if (replace || (local.identityUid && local.identityUid !== uid)) {
    useProfile.setState({ name: "", emoji: "🐻", recentRooms: [], identityUid: uid });
  } else useProfile.setState({ identityUid: uid });
  const snap = await getDoc(doc(getDb(), "users", uid));
  if (getClientAuth().currentUser?.uid !== uid) return;
  if (snap.exists()) {
    const p = snap.data();
    useProfile.setState({ name: typeof p.displayName === "string" ? p.displayName : "",
      emoji: typeof p.emoji === "string" ? p.emoji : "🐻", recentRooms: rooms(p.recentRooms), identityUid: uid });
  }
}

/** Bounded recovery from a known room; never search all rooms or write an empty member. */
export async function restoreRoomIdentity(uid: string, roomId: string) {
  if (useProfile.getState().name || !/^[a-z0-9]{1,64}$/.test(roomId)) return;
  const snap = await getDoc(doc(getDb(), "rooms", roomId, "members", uid));
  const member = snap.data();
  if (getClientAuth().currentUser?.uid === uid && typeof member?.name === "string" && member.name.trim()) {
    useProfile.setState({ name: member.name, emoji: typeof member.emoji === "string" ? member.emoji : "🐻" });
  }
}

/** Publishes only a used identity's preferences. Viewing a room never makes a clean target dirty. */
export async function saveSharedProfile(uid: string) {
  const local = useProfile.getState();
  if (getClientAuth().currentUser?.uid !== uid || local.identityUid !== uid) return;
  const profile = { name: local.name, emoji: local.emoji, recentRooms: rooms(local.recentRooms) };
  await runTransaction(getDb(), async tx => {
    const guard = await tx.get(doc(getDb(), "identityGuards", uid));
    if (guard.data()?.used !== true) return;
    const ref = doc(getDb(), "users", uid);
    const snap = await tx.get(ref);
    const old = snap.data();
    const merged = [...profile.recentRooms, ...rooms(old?.recentRooms)]
      .sort((a, b) => b.visitedAt - a.visitedAt)
      .filter((r, i, list) => list.findIndex(other => other.id === r.id) === i).slice(0, 10);
    tx.set(ref, { displayName: profile.name || old?.displayName || "", emoji: profile.name ? profile.emoji : old?.emoji || profile.emoji,
      recentRooms: merged, updatedAt: Date.now() });
  });
}
