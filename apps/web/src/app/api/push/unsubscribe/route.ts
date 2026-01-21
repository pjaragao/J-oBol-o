import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Delete all push tokens for this user
        const { error } = await supabase
            .from('push_tokens')
            .delete()
            .eq('user_id', user.id)

        if (error) {
            console.error('[Unsubscribe API] Error:', error)
            throw error
        }

        return NextResponse.json({ success: true, message: 'All tokens cleared' })

    } catch (error: any) {
        console.error('[Unsubscribe API] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
