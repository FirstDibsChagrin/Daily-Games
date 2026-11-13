"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * Keeps server data fresh without getting in the way:
 * - refreshes every `seconds` while the tab is visible,
 * - refreshes once when you come back to the tab (not on every focus/visibility event),
 * - never refreshes while you're typing in a field, and never more than once per 10s.
 */
export function AutoRefresh({ seconds = 60 }: { seconds?: number }) {
  const router = useRouter();
  const last = useRef(0);
  useEffect(() => {
    last.current = Date.now();
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      const el = document.activeElement;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        el instanceof HTMLSelectElement
      ) {
        return; // don't refresh under someone mid-entry
      }
      if (Date.now() - last.current < 10_000) return;
      last.current = Date.now();
      router.refresh();
    };
    const id = window.setInterval(refresh, seconds * 1000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, seconds]);
  return null;
}
