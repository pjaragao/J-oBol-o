import { createClient } from '@/lib/supabase/server'
import { sendPushToUser } from '@/lib/push'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { title = 'Teste de Notificação', message = 'Se você recebeu isso, as notificações estão funcionando! 🚀' } = body

        const result = await sendPushToUser(user.id, title, message, '/notifications')

        console.log('[Test Push] Result:', JSON.stringify(result, null, 2))

        return NextResponse.json(result)
    } catch (error: any) {
        console.error('Test Push Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
