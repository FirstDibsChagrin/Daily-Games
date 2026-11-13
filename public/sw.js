// Minimal service worker: makes the app installable. Network-first, no caching of
// pages (scores must always be live); shows a tiny offline page if the network is down.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (event) => {
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    fetch(event.request).catch(
      () =>
        new Response(
          '<!doctype html><meta name="viewport" content="width=device-width"><body style="font-family:system-ui;background:#090c16;color:#e9ecf8;display:grid;place-items:center;height:100vh;margin:0"><div style="text-align:center"><h1>You\'re offline</h1><p>Daily League needs a connection to load live scores.</p></div>',
          { headers: { "Content-Type": "text/html" } },
        ),
    ),
  );
});
