import webpush from 'web-push'
import { createClient } from '@/lib/supabase/server'

if (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        'mailto:suporte@jaobolao.com.br',
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    )
} else {
    console.warn('VAPID keys not found. Push notifications will not work.')
}

export async function sendPushToUser(userId: string, title: string, message: string, url: string = '/') {
    const supabase = await createClient()

    // 1. Get subscriptions
    const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId)

    if (!subs || subs.length === 0) return { success: false, error: 'No subscriptions found' }

    const payloadObj = { title, body: message, url }
    const payload = JSON.stringify(payloadObj)
    console.log('[Push] Payload to send:', payload)

    const results = []

    // 2. Send to all endpoints
    let sentCount = 0
    for (const sub of subs) {
        const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
                p256dh: sub.p256dh,
                auth: sub.auth
            }
        }

        try {
            console.log(`[Push] Sending to ${sub.endpoint.substring(0, 30)}...`)
            await webpush.sendNotification(pushSubscription, payload)
            results.push({ endpoint: sub.endpoint, status: 'sent' })
            sentCount++
        } catch (error: any) {
            console.error('[Push] Error sending push to endpoint:', sub.endpoint, 'Status:', error.statusCode, 'Body:', error.body)
            results.push({ endpoint: sub.endpoint, status: 'failed', error: error.statusCode, message: error.body })

            if (error.statusCode === 410 || error.statusCode === 404) {
                // Subscription is gone, delete it to clean up DB
                console.log(`[Push] Cleaning up expired subscription: ${sub.id}`)
                await supabase.from('push_subscriptions').delete().eq('id', sub.id)
            }
        }
    }

    const success = sentCount > 0
    return {
        success,
        sentCount,
        totalSubscriptions: subs.length,
        results
    }
}
