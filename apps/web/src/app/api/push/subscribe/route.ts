import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const subscription = await request.json()

        if (!subscription || !subscription.endpoint || !subscription.keys) {
            return NextResponse.json({ error: 'Invalid subscription data' }, { status: 400 })
        }

        // Get device info from headers
        const userAgent = request.headers.get('user-agent') || ''
        const deviceInfo = {
            browser: userAgent.includes('Chrome') ? 'Chrome' :
                userAgent.includes('Firefox') ? 'Firefox' :
                    userAgent.includes('Safari') ? 'Safari' : 'Unknown',
            userAgent: userAgent.substring(0, 200)
        }

        // Upsert to push_tokens table
        const { error } = await supabase
            .from('push_tokens')
            .upsert({
                user_id: user.id,
                endpoint: subscription.endpoint,
                p256dh: subscription.keys.p256dh,
                auth: subscription.keys.auth,
                device_info: deviceInfo,
                last_used_at: new Date().toISOString()
            }, { onConflict: 'endpoint' })

        if (error) {
            console.error('[Subscribe API] Error:', error)
            throw error
        }

        return NextResponse.json({ success: true })

    } catch (error: any) {
        console.error('[Subscribe API] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
