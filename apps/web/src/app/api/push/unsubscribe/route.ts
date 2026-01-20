import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST() {
    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Delete all subscriptions for this user to start fresh
        const { error } = await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', user.id)

        if (error) throw error

        return NextResponse.json({ success: true, message: 'All subscriptions cleared' })
    } catch (error: any) {
        console.error('[Push Unsubscribe API] Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
