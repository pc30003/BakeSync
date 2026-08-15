/**
 * Push notification helpers — browser-side (client only).
 * Call requestPushPermission() after user logs in.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding  = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64   = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData  = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

export async function requestPushPermission(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window))    return false;
  if (!("serviceWorker" in navigator)) return false;

  const permission = await Notification.requestPermission();
  return permission === "granted";
}

export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (typeof window === "undefined") return null;
  if (!VAPID_PUBLIC_KEY) {
    console.warn("[BakeSync] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set.");
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const existing     = await registration.pushManager.getSubscription();
    if (existing) return existing;

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    // Send subscription to your API to persist it
    await fetch("/api/push/subscribe", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(subscription.toJSON()),
    });

    return subscription;
  } catch (err) {
    console.error("[BakeSync] Push subscription failed:", err);
    return null;
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (typeof window === "undefined") return;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      await subscription.unsubscribe();
    }
  } catch (err) {
    console.error("[BakeSync] Push unsubscribe failed:", err);
  }
}
