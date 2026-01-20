import webpush from 'web-push'
import { createClient } from '@/lib/supabase/server'

const VAPID_MAILTO = 'mailto:suporte@jaobolao.com.br'

export async function sendPushToUser(userId: string, title: string, message: string, url: string = '/', isDiagnostic: boolean = false) {
    // Ensure VAPID is set up with current process.env (Next.js runtime safety)
    const pubKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const privKey = process.env.VAPID_PRIVATE_KEY

    if (pubKey && privKey) {
        webpush.setVapidDetails(VAPID_MAILTO, pubKey, privKey)
    } else {
        console.error('[Push] CRITICAL: VAPID keys missing in runtime environment!')
        return { success: false, error: 'VAPID keys missing' }
    }

    const supabase = await createClient()

    // 1. Get subscriptions
    const { data: subs } = await supabase
        .from('push_subscriptions')
        .select('*')
        .eq('user_id', userId)

    if (!subs || subs.length === 0) return { success: false, error: 'No subscriptions found' }

    const payload = JSON.stringify({ title, body: message, url })
    console.log('[Push] Sending with keys:', {
        pub: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.substring(0, 10),
        priv: process.env.VAPID_PRIVATE_KEY ? 'Set' : 'Missing'
    })

    const results = []
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
            if (isDiagnostic) {
                console.log(`[Push] Diagnostic: Sending Tickle (null payload) to ${sub.endpoint.substring(0, 30)}...`)
                await webpush.sendNotification(pushSubscription, null, { TTL: 3600 })

                console.log(`[Push] Diagnostic: Sending Simple ASCII Test to ${sub.endpoint.substring(0, 30)}...`)
                await webpush.sendNotification(pushSubscription, 'Simple ASCII Test Payload', { TTL: 3600 })

                console.log('[Push] Diagnostic messages sent successfully.')
            }

            console.log(`[Push] Sending Real Payload to ${sub.endpoint.substring(0, 30)}...`)
            await webpush.sendNotification(pushSubscription, payload, { TTL: 3600 })
            results.push({ endpoint: sub.endpoint, status: 'sent' })
            sentCount++
        } catch (error: any) {
            console.error('[Push] Error details:', {
                endpoint: sub.endpoint.substring(0, 50),
                statusCode: error.statusCode,
                message: error.message,
                body: error.body // Raw response from WNS/FCM
            })

            results.push({
                endpoint: sub.endpoint,
                status: 'failed',
                error: error.statusCode,
                message: error.message,
                rawBody: error.body
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
