import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { footballData } from '@/lib/api-football/client'
import { syncLogger } from '@/lib/sync-logger'

export async function POST(request: NextRequest) {
    let competitionCode: string | undefined
    let eventId: string | undefined

    try {
        const supabase = await createClient()

        // Verify admin
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', user.id)
            .single()

        if (!profile?.is_admin) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        const body = await request.json()
        competitionCode = body.competitionCode
        eventId = body.eventId

        if (!competitionCode || !eventId) {
            return NextResponse.json({ error: 'competitionCode and eventId are required' }, { status: 400 })
        }

        await syncLogger.log({
            resourceType: 'fixtures',
            status: 'running',
            details: { competitionCode, eventId }
        })

        // Get event from our database
        const { data: event } = await supabase
            .from('events')
            .select('id, api_id')
            .eq('id', eventId)
            .single()

        if (!event) {
            throw new Error('Event not found')
        }

        // Fetch matches from API
        const matches = await footballData.getMatches(competitionCode)

        console.log(`[Import Fixtures] Got ${matches.length} matches from API`)

        // Get all teams from our database (to map api_id to our id)
        const { data: teams } = await supabase
            .from('teams')
            .select('id, api_id')

        // Handle both string and number api_id
        const teamMap = new Map<number, string>()
        teams?.forEach(t => {
            const numericId = typeof t.api_id === 'string' ? parseInt(t.api_id, 10) : t.api_id
            if (!isNaN(numericId)) {
                teamMap.set(numericId, t.id)
            }
        })

        // Map matches to our format
        const matchesToUpsert = matches.map(m => ({
            event_id: event.id,
            home_team_id: teamMap.get(m.homeTeam.id),
            away_team_id: teamMap.get(m.awayTeam.id),
            match_date: m.utcDate,
            venue: m.venue || null,
            round: m.matchday ? `Rodada ${m.matchday}` : m.stage,
            status: mapStatus(m.status),
            home_score: m.score?.fullTime?.home ?? null,
            away_score: m.score?.fullTime?.away ?? null,
            api_id: m.id
        })).filter(m => m.home_team_id && m.away_team_id)

        console.log(`[Import Fixtures] Upserting ${matchesToUpsert.length} matches`)

        if (matchesToUpsert.length === 0) {
            throw new Error('Nenhuma partida importada. Verifique se os times estão cadastrados.')
        }

        // Upsert matches
        const { error: matchesError } = await supabase
            .from('matches')
            .upsert(matchesToUpsert, { onConflict: 'api_id' })

        if (matchesError) {
            throw matchesError
        }

        await syncLogger.log({
            resourceType: 'fixtures',
            status: 'success',
            details: { matchesImported: matchesToUpsert.length, competitionCode }
        })

        return NextResponse.json({
            success: true,
            matchesImported: matchesToUpsert.length,
            message: `✅ Importados ${matchesToUpsert.length} jogos`
        })

    } catch (error: any) {
        console.error('Import fixtures error:', error)

        await syncLogger.log({
            resourceType: 'fixtures',
            status: 'error',
            errorMessage: error.message,
            details: { competitionCode, eventId }
        })

        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

function mapStatus(apiStatus: string): string {
    const statusMap: Record<string, string> = {
        'SCHEDULED': 'scheduled',
        'TIMED': 'scheduled',
        'IN_PLAY': 'live',
        'PAUSED': 'live',
        'FINISHED': 'finished',
        'POSTPONED': 'postponed',
        'CANCELLED': 'cancelled',
        'SUSPENDED': 'postponed'
    }
    return statusMap[apiStatus] || 'scheduled'
}
