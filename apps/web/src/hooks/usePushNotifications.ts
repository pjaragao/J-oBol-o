import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// TEMPORÁRIO: Chave hardcoded para teste
// TODO: Remover após confirmar que funciona e usar env var
const VAPID_PUBLIC_KEY = 'BC3-DbQMB_JBg1w9Ea-7E0orSo4AfdCfKo8Qezpr4RyAKP6xxxK2iQsU8nUUvELVlK9ASfrDZ0agpQP47EwUK6LE'

/**
 * Convert VAPID public key from base64url to Uint8Array
 */
function urlB64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray
}

/**
 * Get device info for token registration
 */
function getDeviceInfo(): Record<string, string> {
    if (typeof window === 'undefined') return {}

    const ua = navigator.userAgent
    return {
        browser: ua.includes('Chrome') ? 'Chrome' :
            ua.includes('Firefox') ? 'Firefox' :
                ua.includes('Safari') ? 'Safari' :
                    ua.includes('Edge') ? 'Edge' : 'Unknown',
        platform: navigator.platform || 'Unknown',
        language: navigator.language || 'pt-BR',
    }
}

export interface UsePushNotificationsReturn {
    /** Whether browser supports push notifications */
    isSupported: boolean
    /** Current push subscription (null if not subscribed) */
    subscription: PushSubscription | null
    /** Whether an operation is in progress */
    loading: boolean
    /** Last error message */
    error: string | null
    /** Subscribe to push notifications */
    subscribe: () => Promise<boolean>
    /** Unsubscribe from push notifications */
    unsubscribe: () => Promise<boolean>
    /** Send a test notification to current user */
    testPush: () => Promise<void>
}

export function usePushNotifications(): UsePushNotificationsReturn {
    const [isSupported, setIsSupported] = useState(false)
    const [subscription, setSubscription] = useState<PushSubscription | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    const supabase = createClient()

    // Check support and get existing subscription on mount
    useEffect(() => {
        const init = async () => {
            // Check if push is supported
            if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
                console.warn('[Push] Not supported in this browser')
                setLoading(false)
                return
            }

            // Check secure context
            if (!window.isSecureContext) {
                console.error('[Push] Requires HTTPS')
                setError('Push notifications require HTTPS')
                setLoading(false)
                return
            }

            setIsSupported(true)

            try {
                // Register service worker
                const registration = await navigator.serviceWorker.register('/sw.js', {
                    scope: '/',
                    updateViaCache: 'none'
                })
                console.log('[Push] Service Worker registered')

                // Check for existing subscription
                const existingSub = await registration.pushManager.getSubscription()
                setSubscription(existingSub)
            } catch (err: any) {
                console.error('[Push] Init error:', err)
                setError(err.message)
            } finally {
                setLoading(false)
            }
        }

        init()
    }, [])

    /**
     * Subscribe to push notifications
     */
    const subscribe = useCallback(async (): Promise<boolean> => {
        if (!isSupported || !VAPID_PUBLIC_KEY) {
            setError('Push not supported or VAPID key missing')
            return false
        }

        setLoading(true)
        setError(null)

        try {
            // Get current user
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) {
                throw new Error('User not authenticated')
            }

            // Get SW registration
            const registration = await navigator.serviceWorker.ready
            console.log('[Push] Service Worker ready')

            // Subscribe to push
            const sub = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: urlB64ToUint8Array(VAPID_PUBLIC_KEY)
            })
            console.log('[Push] Subscribed:', sub.endpoint.substring(0, 50))

            // Save to database
            const subJson = sub.toJSON()
            const { error: dbError } = await supabase
                .from('push_tokens')
                .upsert({
                    user_id: user.id,
                    endpoint: subJson.endpoint,
                    p256dh: subJson.keys?.p256dh,
                    auth: subJson.keys?.auth,
                    device_info: getDeviceInfo(),
                    last_used_at: new Date().toISOString()
                }, { onConflict: 'endpoint' })

            if (dbError) {
                throw new Error(`Failed to save token: ${dbError.message}`)
            }

            console.log('[Push] Token saved to database')
            setSubscription(sub)
            return true

        } catch (err: any) {
            console.error('[Push] Subscribe error:', err)
            setError(err.message)
            return false
        } finally {
            setLoading(false)
        }
    }, [isSupported, supabase])

    /**
     * Unsubscribe from push notifications
     */
    const unsubscribe = useCallback(async (): Promise<boolean> => {
        setLoading(true)
        setError(null)

        try {
            // Unsubscribe from browser
            if (subscription) {
                await subscription.unsubscribe()
                console.log('[Push] Unsubscribed from browser')
            }

            // Get current user
            const { data: { user } } = await supabase.auth.getUser()
            if (user) {
                // Delete all tokens for this user
                await supabase
                    .from('push_tokens')
                    .delete()
                    .eq('user_id', user.id)
                console.log('[Push] Tokens deleted from database')
            }

            setSubscription(null)
            return true

        } catch (err: any) {
            console.error('[Push] Unsubscribe error:', err)
            setError(err.message)
            return false
        } finally {
            setLoading(false)
        }
    }, [subscription, supabase])

    /**
     * Send a test push notification
     */
    const testPush = useCallback(async (): Promise<void> => {
        setLoading(true)
        setError(null)

        try {
            const res = await fetch('/api/push/send-test', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: 'Teste JãoBolão 🎉',
                    body: 'Se você recebeu isso, as notificações estão funcionando!'
                })
            })

            const data = await res.json()

            if (data.success) {
                console.log('[Push] Test sent successfully:', data)
            } else {
                throw new Error(data.error || 'Failed to send test')
            }

        } catch (err: any) {
            console.error('[Push] Test error:', err)
            setError(err.message)
        } finally {
            setLoading(false)
        }
    }, [])

    return {
        isSupported,
        subscription,
        loading,
        error,
        subscribe,
        unsubscribe,
        testPush
    }
}
