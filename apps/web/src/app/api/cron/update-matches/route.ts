import { NextRequest, NextResponse } from 'next/server'
import { updateMatches } from '@/lib/cron'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    const isLive = request.nextUrl.searchParams.get('type') === 'live'

    try {
        const result = await updateMatches(isLive)
        return NextResponse.json(result)
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
