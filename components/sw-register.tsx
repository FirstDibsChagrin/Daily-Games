"use client";

import { useEffect } from "react";

/**
 * Removes any service worker left over from earlier versions of the site.
 * The app doesn't need one: it installs to the home screen from its manifest alone.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => Promise.all(regs.map((r) => r.unregister())))
      .catch(() => {});
  }, []);
  return null;
}
