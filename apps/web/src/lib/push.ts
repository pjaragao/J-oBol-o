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

    // const payloadObj = { title, body: message, url }
    // const payload = JSON.stringify(payloadObj)
    const payload = message // Testing plain text payload
    console.log('[Push] Payload to send (Plain Text):', payload)

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
            console.log(`[Push] Sending to ${sub.endpoint.substring(0, 50)}...`)
            // TTL 1 hour (3600 seconds) for faster expiration and WNS compliance
            await webpush.sendNotification(pushSubscription, payload, { TTL: 3600 })
            results.push({ endpoint: sub.endpoint, status: 'sent' })
            sentCount++
        } catch (error: any) {
            console.error('[Push] Error details:', {
                endpoint: sub.endpoint.substring(0, 50),
                statusCode: error.statusCode,
                message: error.message,
                body: error.body
            })

            results.push({
                endpoint: sub.endpoint,
                status: 'failed',
                error: error.statusCode,
                message: error.body,
                internalError: error.message
            })

            if (error.statusCode === 410 || error.statusCode === 404) {
                console.log(`[Push] Cleanup: Endpoint expired or not found (${error.statusCode}). Deleting...`)
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
