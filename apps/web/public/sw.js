self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activated and ready.');
    event.waitUntil(clients.claim());
});

self.addEventListener('push', (event) => {
    console.log('[Service Worker] Push Event received!', event);

    let data = {
        title: 'JãoBolão',
        body: 'Nova notificação!',
        url: '/'
    };

    try {
        if (event.data) {
            console.log('[Service Worker] Push data exists. Type:', typeof event.data);
            const rawText = event.data.text();
            console.log('[Service Worker] Raw Push Text:', rawText);

            try {
                const parsed = JSON.parse(rawText);
                data = { ...data, ...parsed };
                console.log('[Service Worker] Parsed JSON:', data);
            } catch (e) {
                console.warn('[Service Worker] Push data is not JSON, using as body');
                data.body = rawText;
            }
        } else {
            console.warn('[Service Worker] Push event has no data!');
        }
    } catch (err) {
        console.error('[Service Worker] Error processing push data:', err);
    }

    const options = {
        body: data.body,
        data: {
            url: data.url || '/'
        }
    };

    event.waitUntil(
        self.registration.showNotification(data.title, options)
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
