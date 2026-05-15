/**
 * Subscribe the current device to Web Push notifications.
 * Call only after the user explicitly opts in — never auto-prompt.
 */

async function getReadyRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  const regs = await navigator.serviceWorker.getRegistrations();
  if (regs.length === 0) return null;
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Service worker not ready')), 5000)
      ),
    ]);
  } catch {
    return null;
  }
}

export async function subscribeToPush(jwt: string): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

  const reg = await getReadyRegistration();
  if (!reg) return false;

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string;
  if (!vapidKey) {
    console.error('[Push] VITE_VAPID_PUBLIC_KEY not set');
    return false;
  }

  // applicationServerKey accepts a base64url string directly (Push API spec)
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: vapidKey,
  });

  const keys = sub.toJSON().keys as { p256dh: string; auth: string } | undefined;
  if (!keys) return false;

  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${jwt}`,
    },
    body: JSON.stringify({
      endpoint: sub.endpoint,
      keys,
      deviceLabel: navigator.userAgent.slice(0, 100),
    }),
  });

  return res.ok;
}

/**
 * Unsubscribe from push notifications on the current device.
 */
export async function unsubscribeFromPush(): Promise<void> {
  const reg = await getReadyRegistration();
  if (!reg) return;
  const sub = await reg.pushManager.getSubscription();
  if (sub) await sub.unsubscribe();
}

/**
 * Returns true if the current device is subscribed to push notifications.
 */
export async function isPushSubscribed(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  const reg = await getReadyRegistration();
  if (!reg) return false;
  const sub = await reg.pushManager.getSubscription();
  return sub !== null;
}
