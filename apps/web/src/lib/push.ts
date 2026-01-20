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

    const payload = JSON.stringify({ title, body: message, url })
    const results = []

    // 2. Send to all endpoints
    for (const sub of subs) {
        const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
                p256dh: sub.p256dh,
                auth: sub.auth
            }
        }

        try {
            await webpush.sendNotification(pushSubscription, payload)
            results.push({ endpoint: sub.endpoint, status: 'sent' })
        } catch (error: any) {
            console.error('Error sending push:', error)
            results.push({ endpoint: sub.endpoint, status: 'failed', error: error.statusCode })

            if (error.statusCode === 410 || error.statusCode === 404) {
                // Subscription is gone, delete it to clean up DB
                await supabase.from('push_subscriptions').delete().eq('id', sub.id)
            }
        }
    }

    return { success: true, results }
}
