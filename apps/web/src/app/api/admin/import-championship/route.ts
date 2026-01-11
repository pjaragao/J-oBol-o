import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { footballData } from '@/lib/api-football/client'
import { syncLogger } from '@/lib/sync-logger'

export async function POST(req: NextRequest) {
    let competitionCode: string | undefined
    let season: number | undefined

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
        competitionCode = body.competitionCode

        if (!competitionCode) {
            return NextResponse.json({ error: 'competitionCode is required' }, { status: 400 })
        }

        await syncLogger.log({
            resourceType: 'league',
            status: 'running',
            details: { competitionCode, step: 'start_all_in_one' }
        })

        // 1. Fetch Competition
        console.log(`[Import Championship] Fetching competition: ${competitionCode}`)
        const competition = await footballData.getCompetition(competitionCode)
        season = new Date(competition.currentSeason.startDate).getFullYear()

        // Upsert Event
        // description format: "TYPE - CODE" (needed for parsing in updates)
        const eventDescription = `${competition.type.toUpperCase()} - ${competitionCode}`

        const { data: event, error: eventError } = await supabase
            .from('events')
            .upsert({
                api_id: competition.id, // Fixed: Integer, no .toString()
                name: competition.name,
                description: eventDescription,
                season: season,
                is_active: true
            }, { onConflict: 'api_id' })
            .select()
            .single()

        if (eventError) throw eventError

        // 2. Fetch Teams
        console.log(`[Import Championship] Fetching teams for ${competitionCode}`)
        const apiTeams = await footballData.getTeams(competitionCode)

        for (const team of apiTeams) {
            await supabase
                .from('teams')
                .upsert({
                    api_id: team.id, // Fixed: Integer
                    name: team.name,
                    short_name: team.shortName,
                    code: team.tla,
                    logo_url: team.crest
                }, { onConflict: 'api_id' })
        }

        // 3. Fetch Matches (Fixtures)
        console.log(`[Import Championship] Fetching matches for ${competitionCode}`)
        const apiMatches = await footballData.getMatches(competitionCode)

        // Map teams to local IDs
        const { data: localTeams } = await supabase.from('teams').select('id, api_id')
        const teamMap = new Map(localTeams?.map(t => [t.api_id, t.id]) || [])

        const matchesToUpsert = apiMatches.map(m => ({
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

        if (matchesToUpsert.length > 0) {
            const { error: matchesError } = await supabase
                .from('matches')
                .upsert(matchesToUpsert, { onConflict: 'api_id' })

            if (matchesError) throw matchesError
        }

        await syncLogger.log({
            resourceType: 'league',
            status: 'success',
            details: {
                competitionCode,
                event: event.name,
                teamsCount: apiTeams.length,
                matchesCount: matchesToUpsert.length
            }
        })

        return NextResponse.json({
            success: true,
            message: `⚽ ${competition.name} importado completa! (${apiTeams.length} times, ${matchesToUpsert.length} jogos)`
        })

    } catch (error: any) {
        console.error('Import championship error:', error)

        await syncLogger.log({
            resourceType: 'league',
            status: 'error',
            errorMessage: error.message,
            details: { competitionCode }
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
