import { create } from "zustand";
import { persist } from "zustand/middleware";

interface RecentRoom {
  id: string;
  title: string;
  emoji: string;
  visitedAt: number;
}

interface ProfileState {
  hydrated: boolean;
  name: string;
  emoji: string;
  recentRooms: RecentRoom[];
  setProfile: (name: string, emoji: string) => void;
  addRecent: (room: Omit<RecentRoom, "visitedAt">) => void;
  forgetRoom: (id: string) => void;
}

/**
 * เก็บข้อมูลเฉพาะเครื่องนี้ใน localStorage (ชื่อ, avatar, ห้องที่เคยเข้า)
 * skipHydration: กัน hydration mismatch กับ SSR — rehydrate ผ่าน <StoreHydrator />
 */
export const useProfile = create<ProfileState>()(
  persist(
    (set) => ({
      hydrated: false,
      name: "",
      emoji: "🐻",
      recentRooms: [],
      setProfile: (name, emoji) => set({ name, emoji }),
      addRecent: (room) =>
        set((s) => {
          const existing = s.recentRooms.find((r) => r.id === room.id);
          if (existing && existing.title === room.title && existing.emoji === room.emoji) {
            return s;
          }
          return {
            recentRooms: [
              { ...room, visitedAt: Date.now() },
              ...s.recentRooms.filter((r) => r.id !== room.id),
            ].slice(0, 10),
          };
        }),
      forgetRoom: (id) => set((s) => ({ recentRooms: s.recentRooms.filter((r) => r.id !== id) })),
    }),
    {
      name: "honeytrip-profile",
      skipHydration: true,
      partialize: (s) => ({ name: s.name, emoji: s.emoji, recentRooms: s.recentRooms }),
      onRehydrateStorage: () => () => useProfile.setState({ hydrated: true }),
    },
  ),
);
