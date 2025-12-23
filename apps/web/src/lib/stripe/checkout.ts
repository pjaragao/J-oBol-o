'use client'

import { createClient } from '@/lib/supabase/client'

export async function createCheckoutSession(tier: 'premium' | 'pro', period: 'monthly' | 'yearly') {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) throw new Error('Not authenticated')

    const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/create-checkout`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
            tier,
            billing_period: period,
            success_url: window.location.origin + '/dashboard?success=true',
            cancel_url: window.location.origin + '/subscription',
        })
    })

    if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create checkout session')
    }

    const data = await response.json()
    return data
}
