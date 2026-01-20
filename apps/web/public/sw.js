self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('push', function (event) {
    console.log('[Service Worker] Push Received.');

    try {
        if (!event.data) {
            console.warn('[Service Worker] Push event but no data');
            return;
        }

        const data = event.data.json();
        console.log('[Service Worker] Push Data:', data);

        const options = {
            body: data.body || 'Nova notificação',
            icon: '/logo-circle.png',
            badge: '/logo-circle.png',
            vibrate: [100, 50, 100],
            data: {
                dateOfArrival: Date.now(),
                url: data.url || '/'
            }
        };

        event.waitUntil(
            self.registration.showNotification(data.title || 'JãoBolão', options)
        );
    } catch (err) {
        console.error('[Service Worker] Error handling push event:', err);

        // Fallback notification if JSON parsing fails but data exists
        const fallbackOptions = {
            body: 'Você recebeu uma nova atualização no JãoBolão.',
            icon: '/logo-circle.png'
        };
        event.waitUntil(
            self.registration.showNotification('JãoBolão', fallbackOptions)
        );
    }
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    const url = event.notification.data?.url || '/';

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
            if (clientList.length > 0) {
                let client = clientList[0];
                for (let i = 0; i < clientList.length; i++) {
                    if (clientList[i].focused) {
                        client = clientList[i];
                    }
                }
                if (client.url === url) return client.focus();
                return client.navigate(url).then(c => c.focus());
            }
            return clients.openWindow(url);
        })
    );
});
