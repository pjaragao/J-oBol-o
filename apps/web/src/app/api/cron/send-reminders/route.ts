import { NextRequest, NextResponse } from 'next/server'
import { sendReminders } from '@/lib/cron'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
        // 1. Authorization Check
        const authHeader = request.headers.get('authorization')
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}` && process.env.NODE_ENV !== 'development') {
            if (process.env.NODE_ENV === 'production') {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
            }
        }

        const result = await sendReminders()
        return NextResponse.json(result)

    } catch (error: any) {
        console.error('Cron Error:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
