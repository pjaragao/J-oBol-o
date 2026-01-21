import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function POST(request: Request) {
    console.log('[Send Test API] ===== START =====')

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
        if (!SUPABASE_URL) {
            console.error('[Send Test API] SUPABASE_URL is missing!')
            return NextResponse.json({ error: 'Server configuration error: SUPABASE_URL missing' }, { status: 500 })
        }

        if (!SUPABASE_SERVICE_ROLE_KEY) {
            console.error('[Send Test API] SUPABASE_SERVICE_ROLE_KEY is missing!')
            return NextResponse.json({ error: 'Server configuration error: SERVICE_ROLE_KEY missing' }, { status: 500 })
        }

        // Call Edge Function to send push
        const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/send-push`
        console.log('[Send Test API] Calling Edge Function:', edgeFunctionUrl)

        const payload = {
            user_id: user.id,
            title,
            body: message,
            url: '/notifications'
        }
        console.log('[Send Test API] Payload:', JSON.stringify(payload))

        const response = await fetch(edgeFunctionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            },
            body: JSON.stringify(payload)
        })

        console.log('[Send Test API] Response status:', response.status)
        console.log('[Send Test API] Response ok:', response.ok)

        const result = await response.json()
        console.log('[Send Test API] Result:', JSON.stringify(result, null, 2))

        if (!response.ok) {
            console.error('[Send Test API] Edge Function returned error')
            return NextResponse.json({
                error: 'Edge Function error',
                details: result,
                status: response.status
            }, { status: response.status })
        }

        return NextResponse.json(result)

    } catch (error: any) {
        console.error('[Send Test API] Exception:', error.message)
        console.error('[Send Test API] Stack:', error.stack)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
