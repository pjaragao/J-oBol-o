self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('push', function (event) {
    console.log('[Service Worker] Push Received.');

    let notificationData = {
        title: 'JãoBolão',
        body: 'Você tem uma nova atualização!',
        url: '/'
    };

    try {
        if (event.data) {
            const rawText = event.data.text();
            console.log('[Service Worker] Raw Push Text:', rawText);

            try {
                const parsed = JSON.parse(rawText);
                notificationData = {
                    title: parsed.title || notificationData.title,
                    body: parsed.body || notificationData.body,
                    url: parsed.url || notificationData.url
                };
            } catch (jsonErr) {
                console.warn('[Service Worker] Push data is not JSON, using as body');
                notificationData.body = rawText;
            }
        }
    } catch (err) {
        console.error('[Service Worker] Error extracting push data:', err);
    }

    const options = {
        body: notificationData.body,
        icon: '/logo-circle.png',
        badge: '/logo-circle.png',
        vibrate: [100, 50, 100],
        data: {
            dateOfArrival: Date.now(),
            url: notificationData.url
        }
    };

    event.waitUntil(
        self.registration.showNotification(notificationData.title, options)
    );
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
