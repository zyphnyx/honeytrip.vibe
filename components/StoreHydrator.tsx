"use client";

import { useEffect } from "react";
import { useProfile } from "@/store/profile";

export function StoreHydrator() {
  useEffect(() => {
    void useProfile.persist.rehydrate();
  }, []);
  return null;
}
