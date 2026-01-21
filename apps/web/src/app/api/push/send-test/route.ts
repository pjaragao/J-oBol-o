import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import webpush from 'web-push'

const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!
const VAPID_MAILTO = 'mailto:suporte@jaobolao.com.br'

export async function POST(request: Request) {
    console.log('[Send Test API] ===== START (DIRECT) =====')

    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            console.error('[Send Test API] User not authenticated')
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        console.log('[Send Test API] User:', user.id)

        const body = await request.json()
        const { title = 'Teste de Notificação', message = 'Se você recebeu isso, as notificações estão funcionando! 🚀' } = body

        // Check environment variables
        if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
            console.error('[Send Test API] VAPID keys missing!')
            return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 })
        }

        // Configure web-push
        webpush.setVapidDetails(
            VAPID_MAILTO,
            VAPID_PUBLIC_KEY,
            VAPID_PRIVATE_KEY
        )

        // Get user's push tokens from database
        const { data: tokens, error: fetchError } = await supabase
            .from('push_tokens')
            .select('*')
            .eq('user_id', user.id)

        if (fetchError) {
            console.error('[Send Test API] Error fetching tokens:', fetchError)
            return NextResponse.json({ error: 'Failed to fetch tokens' }, { status: 500 })
        }

        if (!tokens || tokens.length === 0) {
            console.log('[Send Test API] No tokens found for user')
            return NextResponse.json({
                success: false,
                error: 'No push tokens found. Please subscribe first.'
            })
        }

        console.log(`[Send Test API] Found ${tokens.length} token(s)`)

        // Prepare payload
        const payload = JSON.stringify({
            title,
            body: message,
            url: '/notifications'
        })

        // Send to all tokens
        let successCount = 0
        let failCount = 0
        const results = []

        for (const token of tokens) {
            try {
                const pushSubscription = {
                    endpoint: token.endpoint,
                    keys: {
                        p256dh: token.p256dh,
                        auth: token.auth
                    }
                }

                await webpush.sendNotification(pushSubscription, payload)
                console.log(`[Send Test API] ✅ Sent to ${token.endpoint.substring(0, 50)}...`)
                successCount++
                results.push({ endpoint: token.endpoint.substring(0, 30) + '...', success: true })
            } catch (error: any) {
                console.error(`[Send Test API] ❌ Failed:`, error.message)
                failCount++
                results.push({ endpoint: token.endpoint.substring(0, 30) + '...', success: false, error: error.message })
            }
        }

        console.log(`[Send Test API] Complete: ${successCount} sent, ${failCount} failed`)

        return NextResponse.json({
            success: successCount > 0,
            sent_count: successCount,
            failed_count: failCount,
            results
        })

    } catch (error: any) {
        console.error('[Send Test API] Exception:', error.message)
        console.error('[Send Test API] Stack:', error.stack)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
