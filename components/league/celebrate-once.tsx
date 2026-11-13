"use client";

import { useEffect } from "react";
import { celebrate } from "@/lib/confetti";

/** Fires confetti once per device for a given key (e.g. a week you won). */
export function CelebrateOnce({
  storageKey,
  kind = "champion",
}: {
  storageKey: string;
  kind?: "first" | "champion";
}) {
  useEffect(() => {
    try {
      if (localStorage.getItem(storageKey)) return;
      localStorage.setItem(storageKey, "1");
    } catch {
      /* storage blocked: still celebrate */
    }
    void celebrate(kind);
  }, [storageKey, kind]);
  return null;
}
