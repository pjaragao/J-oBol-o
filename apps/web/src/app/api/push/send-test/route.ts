import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function POST(request: Request) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { title = 'Teste de Notificação', message = 'Se você recebeu isso, as notificações estão funcionando! 🚀' } = body

        // Call Edge Function to send push
        const edgeFunctionUrl = `${SUPABASE_URL}/functions/v1/send-push`

        const response = await fetch(edgeFunctionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            },
            body: JSON.stringify({
                user_id: user.id,
                title,
                body: message,
                url: '/notifications'
            })
        })

        const result = await response.json()
        console.log('[Send Test API] Result:', result)

        return NextResponse.json(result)

    } catch (error: any) {
        console.error('[Send Test API] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
