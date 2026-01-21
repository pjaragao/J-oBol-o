// Service Worker for Push Notifications
// Handles push events and notification clicks

const SW_VERSION = '2.0.0'

self.addEventListener('install', (event) => {
    console.log(`[SW ${SW_VERSION}] Installing...`)
    self.skipWaiting()
})

self.addEventListener('activate', (event) => {
    console.log(`[SW ${SW_VERSION}] Activated`)
    event.waitUntil(clients.claim())
})

// Handle push notifications
self.addEventListener('push', (event) => {
    console.log('[SW] Push received:', event)

    let data = {
        title: 'JãoBolão',
        body: 'Nova notificação!',
        url: '/'
    }

    try {
        if (event.data) {
            const payload = event.data.json()
            data = { ...data, ...payload }
            console.log('[SW] Payload:', data)
        }
    } catch (err) {
        console.error('[SW] Error parsing push data:', err)
        // Try as text
        if (event.data) {
            data.body = event.data.text()
        }
    }

    const options = {
        body: data.body,
        icon: '/logo-new.png',
        badge: '/logo-circle.png',
        vibrate: [100, 50, 100],
        data: { url: data.url || '/' },
        actions: [
            { action: 'open', title: 'Abrir' },
            { action: 'close', title: 'Fechar' }
        ]
    }

    event.waitUntil(
        self.registration.showNotification(data.title, options)
    )
})

// Handle notification click
self.addEventListener('notificationclick', (event) => {
    event.notification.close()

    const url = event.notification.data?.url || '/'
    const action = event.action

    if (action === 'close') {
        return
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Try to focus existing window
                for (const client of clientList) {
                    if (client.url.includes(self.location.origin) && 'focus' in client) {
                        return client.navigate(url).then(() => client.focus())
                    }
                }
                // Open new window if none exists
                return clients.openWindow(url)
            })
    )
})

// Handle notification close
self.addEventListener('notificationclose', (event) => {
    console.log('[SW] Notification closed')
})
