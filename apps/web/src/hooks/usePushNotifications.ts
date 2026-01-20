import { useState, useEffect } from 'react'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

function urlB64ToUint8Array(base64String: string) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
}

export function usePushNotifications() {
    const [isSupported, setIsSupported] = useState(false)
    const [subscription, setSubscription] = useState<PushSubscription | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        console.log('[Push Hook] Initializing...')

        const handleMessage = (event: MessageEvent) => {
            if (event.data?.type === 'PUSH_RECEIVED') {
                console.log('%c[Push Hook] RECEIVED FROM SW:', 'background: #222; color: #bada55; padding: 2px 5px; border-radius: 3px;', event.data.payload)
                // Optional: show a local toast if the browser notification failed to show
            }
            if (event.data?.type === 'PONG') {
                console.log('%c[Push Hook] SW RESPONSE: PONG! Communication is OK.', 'background: #222; color: #34d399; padding: 2px 5px; border-radius: 3px;')
                alert('Service Worker respondeu: PONG! A comunicação interna está funcionando.')
            }
        }

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', handleMessage)
        }

        if ('serviceWorker' in navigator && 'PushManager' in window) {
            console.log('[Push Hook] Push is supported.')

            if (!window.isSecureContext) {
                console.error('[Push Hook] NOT SECURE CONTEXT! Push will likely fail. Use HTTPS or localhost.')
                alert('Atenção: Notificações Push requerem HTTPS. Se estiver no celular via IP, não vai funcionar.')
            }

            setIsSupported(true)
            registerServiceWorker()
        } else {
            console.warn('[Push Hook] Push notifications not supported')
            setLoading(false)
        }

        return () => {
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.removeEventListener('message', handleMessage)
            }
        }
    }, [])

    const registerServiceWorker = async () => {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js', {
                scope: '/',
                updateViaCache: 'none'
            })
            const sub = await registration.pushManager.getSubscription()
            setSubscription(sub)
        } catch (err) {
            console.error('Service Worker registration failed:', err)
            setError('Service Worker registration failed')
        } finally {
            setLoading(false)
        }
    }

    const pingSW = async () => {
        console.log('[Push Hook] Pinging Service Worker...')
        const registration = await navigator.serviceWorker.ready
        if (registration.active) {
            registration.active.postMessage('PING')
        } else {
            console.error('[Push Hook] SW not active yet.')
            alert('Service Worker ainda não está ativo.')
        }
    }

    const subscribeToPush = async () => {
        console.log('[Push Hook] Starting subscription...')
        setLoading(true)
        setError(null)
        try {
            const rawKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
            if (!rawKey) throw new Error('VAPID Public Key not found in env')

            const vapidKey = rawKey.trim()
            console.log('[Push Hook] Using formatted VAPID Key:', vapidKey.substring(0, 10) + '...' + vapidKey.slice(-5))

            const registration = await navigator.serviceWorker.ready
            console.log('[Push Hook] Service Worker ready.')

            const sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlB64ToUint8Array(vapidKey)
            })

            const subJson = sub.toJSON()
            console.log('[Push Hook] Subscription created:', subJson)
            setSubscription(sub)

            // Send subscription to server
            console.log('[Push Hook] Sending subscription to server...')
            const res = await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(subJson)
            })

            if (!res.ok) {
                const errorData = await res.json()
                throw new Error(errorData.error || 'Failed to save subscription')
            }

            console.log('[Push Hook] Subscription saved successfully.')
            return true
        } catch (err: any) {
            console.error('[Push Hook] Failed to subscribe:', err)
            setError(err.message)
            return false
        } finally {
            setLoading(false)
        }
    }

    const testPush = async (isDiagnostic: boolean = false) => {
        console.log('[Push Hook] Clicking test button, isDiagnostic:', isDiagnostic, 'sub:', !!subscription)
        if (!subscription) {
            console.warn('[Push Hook] No subscription found to test')
            return
        }
        setLoading(true)
        setError(null)
        try {
            console.log(`[Push Hook] Calling /api/push/send-test (diagnostic=${isDiagnostic})...`)
            const res = await fetch('/api/push/send-test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: 'Isso é um teste do JãoBolão!',
                    isDiagnostic
                })
            })
            const data = await res.json()
            console.log('[Push Hook] Test result details:')
            if (data.results) {
                console.table(data.results)
            }
            console.log('[Push Hook] Summary:', data)
            if (data.success) {
                alert(`Teste enviado com sucesso para ${data.sentCount} dispositivo(s)!`)
            } else {
                const errorMsg = data.error || (data.totalSubscriptions === 0 ? 'Nenhuma assinatura encontrada no servidor.' : 'Falha na entrega para os dispositivos registrados.')
                setError('Erro: ' + errorMsg)
            }
        } catch (err: any) {
            console.error('[Push Hook] Failed to send test push:', err)
            setError('Erro de rede: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    const unsubscribeFromPush = async () => {
        console.log('[Push Hook] Unsubscribing totally (Browser + Server)...')
        setLoading(true)
        try {
            // 1. Unsubscribe from browser push manager
            if (subscription) {
                await subscription.unsubscribe()
                setSubscription(null)
                console.log('[Push Hook] Browser subscription removed.')
            }

            // 2. Call server to clear all records for this user (force fresh start)
            console.log('[Push Hook] Requesting server to clear all subscriptions...')
            const res = await fetch('/api/push/unsubscribe', { method: 'POST' })
            if (!res.ok) {
                console.warn('[Push Hook] Server failed to clear subscriptions, but browser is unsubscribed.')
            } else {
                console.log('[Push Hook] All subscriptions cleared from server.')
            }

            return true
        } catch (err: any) {
            console.error('[Push Hook] Failed to unsubscribe:', err)
            setError(err.message)
            return false
        } finally {
            setLoading(false)
        }
    }

    const showLocalNotification = async () => {
        console.log('[Push Hook] Simulating local notification...')
        const registration = await navigator.serviceWorker.ready
        await registration.showNotification('Simulação JãoBolão', {
            body: 'Isso é uma simulação interna para testar o visual! 🚀',
            icon: '/logo-new.png',
            badge: '/logo-circle.png',
            data: { url: '/notifications' }
        })
    }

    return {
        isSupported,
        subscription,
        subscribeToPush,
        unsubscribeFromPush,
        testPush,
        pingSW,
        showLocalNotification,
        loading,
        error
    }
}
