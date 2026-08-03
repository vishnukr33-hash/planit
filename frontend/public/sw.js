// TVS DOT Service Worker — handles push notifications with sound on mobile

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()))

// Handle push notifications from server
self.addEventListener('push', (event) => {
  if (!event.data) return
  const data = event.data.json()

  const options = {
    body: data.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: [200, 100, 200],
    tag: data.tag || 'tvsdot-notification',
    renotify: true,
    data: { url: data.url || '/dashboard' },
    silent: false,
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'TVS DOT', options)
  )
})

// Handle notification click — open app
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/dashboard'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
      const existing = clients.find(c => c.url.includes(self.location.origin))
      if (existing) {
        existing.focus()
        existing.navigate(url)
      } else {
        self.clients.openWindow(url)
      }
    })
  )
})

// Listen for messages from the app (in-app sound trigger)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'PLAY_SOUND') {
    // Notify all clients to play sound
    self.clients.matchAll().then(clients => {
      clients.forEach(client => client.postMessage({ type: 'PLAY_SOUND' }))
    })
  }
})
