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
        if ('serviceWorker' in navigator && 'PushManager' in window) {
            setIsSupported(true)
            registerServiceWorker()
        } else {
            console.warn('Push notifications not supported')
            setLoading(false)
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

    const subscribeToPush = async () => {
        setLoading(true)
        setError(null)
        try {
            const registration = await navigator.serviceWorker.ready
            const sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY!)
            })

            setSubscription(sub)

            // Send subscription to server
            const res = await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sub.toJSON ? sub.toJSON() : sub)
            })

            if (!res.ok) throw new Error('Failed to save subscription')

            return true
        } catch (err: any) {
            console.error('Failed to subscribe:', err)
            setError(err.message)
            return false
        } finally {
            setLoading(false)
        }
    }

    const testPush = async () => {
        if (!subscription) return
        setLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/push/send-test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: 'Isso é um teste do JãoBolão!' })
            })
            const data = await res.json()
            if (data.success) {
                alert(`Teste enviado com sucesso para ${data.sentCount} dispositivo(s)!`)
            } else {
                const errorMsg = data.error || (data.totalSubscriptions === 0 ? 'Nenhuma assinatura encontrada no servidor.' : 'Falha na entrega para os dispositivos registrados.')
                setError('Erro: ' + errorMsg)
                console.error('Test push delivery failed:', data)
            }
        } catch (err: any) {
            console.error('Failed to send test push:', err)
            setError('Erro de rede: ' + err.message)
        } finally {
            setLoading(false)
        }
    }

    return {
        isSupported,
        subscription,
        subscribeToPush,
        testPush,
        loading,
        error
    }
}
