// Retired service worker.
// An earlier version intercepted page loads, which some browsers (notably Safari) can
// refuse when a page redirects. This version has no fetch handler: it unregisters itself
// and reloads any open tabs so they load straight from the network.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      await self.registration.unregister();
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) client.navigate(client.url);
    })(),
  );
});
