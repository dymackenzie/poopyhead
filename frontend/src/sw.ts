/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute((self as any).__WB_MANIFEST ?? []);

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {};
  const title = data.title ?? "It's your turn";
  const body = data.body ?? 'Tap to play your move';
  const url = data.url ?? '/';
  const notifOpts = {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url },
    tag: data.tag ?? 'poopyhead-turn',
    renotify: true,
  };
  event.waitUntil(
    self.registration.showNotification(title, notifOpts as unknown as NotificationOptions)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data?.url ?? '/') as string;
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const existing = clients.find((c) => 'focus' in c);
      if (existing) {
        (existing as WindowClient).focus();
        return;
      }
      self.clients.openWindow(url);
    })
  );
});
