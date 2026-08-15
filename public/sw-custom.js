/**
 * BakeSync Custom Service Worker
 *
 * This file is merged with the workbox-generated SW by next-pwa.
 * It handles push notifications and custom offline fallback logic.
 *
 * The main caching strategy is managed by next-pwa / Workbox in sw.js.
 */

// ─── Push Notifications ────────────────────────────────────────────────────

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: "BakeSync", body: event.data.text() };
  }

  const options = {
    body:    payload.body    ?? "You have a new notification",
    icon:    payload.icon    ?? "/icons/icon-192x192.png",
    badge:   payload.badge   ?? "/icons/icon-96x96.png",
    tag:     payload.tag     ?? "bakesync-default",
    data:    payload.data    ?? {},
    actions: payload.actions ?? [],
    vibrate: [200, 100, 200],
    requireInteraction: payload.requireInteraction ?? false,
  };

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "BakeSync", options)
  );
});

// ─── Notification Click ────────────────────────────────────────────────────

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url ?? "/dashboard";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Focus an existing window if one is open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// ─── Background Sync (future: queue failed API calls) ──────────────────────

self.addEventListener("sync", (event) => {
  if (event.tag === "bakesync-retry-failed") {
    // TODO: replay queued requests from IndexedDB when connectivity restores
    console.log("[BakeSync SW] Background sync triggered:", event.tag);
  }
});
