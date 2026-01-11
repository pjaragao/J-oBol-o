import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { footballData } from '@/lib/api-football/client'
import { syncLogger } from '@/lib/sync-logger'

export async function POST(req: NextRequest) {
    let eventId: string | undefined

    try {
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        // Check admin permission
        const { data: profile } = await supabase
            .from('profiles')
            .select('is_admin')
            .eq('id', user?.id)
            .single()

        if (!profile?.is_admin) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const body = await req.json()
        eventId = body.eventId

        if (!eventId) {
            return NextResponse.json({ error: 'eventId is required' }, { status: 400 })
        }

        // 1. Get Event Details
        const { data: event, error: eventError } = await supabase
            .from('events')
            .select('*')
            .eq('id', eventId)
            .single()

        if (eventError || !event) throw new Error('Campionato não encontrado')

        // Parse code from description "TYPE - CODE"
        const codeMatch = event.description?.match(/- ([A-Z0-9]+)$/)
        const competitionCode = codeMatch ? codeMatch[1] : null

        if (!competitionCode) {
            throw new Error('Código do campeonato não configurado. Reimporte o campeonato.')
        }

        await syncLogger.log({
            resourceType: 'fixtures',
            status: 'running',
            details: { competitionCode, eventId, step: 'single_event_update' }
        })

        // Determine Date Range for smart sync
        // Look for oldest pending match (not finished/cancelled) that already happened
        let dateFrom = new Date().toISOString().split('T')[0]

        const { data: pendingMatches } = await supabase
            .from('matches')
            .select('match_date')
            .eq('event_id', eventId)
            .not('status', 'in', '("finished","cancelled")')
            .lt('match_date', new Date().toISOString())
            .order('match_date', { ascending: true })
            .limit(1)

        if (pendingMatches && pendingMatches.length > 0) {
            dateFrom = pendingMatches[0].match_date.split('T')[0]
        } else {
            // Look back 3 days to catch any recently finished
            const threeDaysAgo = new Date()
            threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
            dateFrom = threeDaysAgo.toISOString().split('T')[0]
        }

        // Always look ahead 7 days
        const sevenDaysFromNow = new Date()
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
        const dateTo = sevenDaysFromNow.toISOString().split('T')[0]

        // 2. Fetch matches from API
        console.log(`[Update Event] ${event.name}: Fetching from ${dateFrom} to ${dateTo}`)
        const matches = await footballData.getMatchesByDateRange(competitionCode, dateFrom, dateTo)
        console.log(`[Update Event] ${event.name}: Got ${matches.length} matches`)

        if (matches.length === 0) {
            return NextResponse.json({ success: true, message: 'Nenhuma alteração encontrada.' })
        }

        // Get teams for mapping - handle both string and number api_id
        const { data: localTeams } = await supabase.from('teams').select('id, api_id')
        const teamMap = new Map<number, string>()
        localTeams?.forEach(t => {
            const numericId = typeof t.api_id === 'string' ? parseInt(t.api_id, 10) : t.api_id
            if (!isNaN(numericId)) {
                teamMap.set(numericId, t.id)
            }
        })

        // 3. Map and Upsert Matches
        const matchesToUpsert = matches.map(m => ({
            event_id: event.id,
            home_team_id: teamMap.get(m.homeTeam.id),
            away_team_id: teamMap.get(m.awayTeam.id),
            match_date: m.utcDate,
            status: mapStatus(m.status),
            home_score: m.score?.fullTime?.home ?? null,
            away_score: m.score?.fullTime?.away ?? null,
            api_id: m.id,
            round: m.matchday ? `Rodada ${m.matchday}` : m.stage,
            group_name: m.group,
            updated_at: new Date().toISOString()
        })).filter(m => m.home_team_id && m.away_team_id)

        if (matchesToUpsert.length > 0) {
            const { data: upsertedMatches, error: upsertError } = await supabase
                .from('matches')
                .upsert(matchesToUpsert, { onConflict: 'api_id' })
                .select('id, status, home_score, away_score')

            if (upsertError) throw upsertError

            // Recalculate points for finished matches
            const finishedMatches = upsertedMatches?.filter(m =>
                m.status === 'finished' && m.home_score !== null && m.away_score !== null
            ) || []

            let pointsRecalculated = 0
            for (const match of finishedMatches) {
                const { data: count } = await supabase.rpc('recalculate_match_points', { p_match_id: match.id })
                pointsRecalculated += count || 0
            }

            await syncLogger.log({
                resourceType: 'fixtures',
                status: 'success',
                details: { event: event.name, count: matchesToUpsert.length, pointsRecalculated }
            })

            return NextResponse.json({
                success: true,
                message: `✅ ${event.name} atualizado! ${matchesToUpsert.length} matches processadas.`
            })
        }

        return NextResponse.json({ success: true, message: 'Nada para atualizar.' })

    } catch (error: any) {
        console.error('Update event error:', error)

        await syncLogger.log({
            resourceType: 'fixtures',
            status: 'error',
            errorMessage: error.message,
            details: { eventId }
        })

        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}

function mapStatus(apiStatus: string): string {
    const statusMap: Record<string, string> = {
        'SCHEDULED': 'scheduled', 'TIMED': 'scheduled', 'IN_PLAY': 'live', 'PAUSED': 'live',
        'FINISHED': 'finished', 'FT': 'finished', 'AET': 'finished', 'PEN': 'finished',
        'POSTPONED': 'postponed', 'CANCELLED': 'cancelled', 'SUSPENDED': 'postponed'
    }
    return statusMap[apiStatus] || 'scheduled'
}
