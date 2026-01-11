import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { footballData } from '@/lib/api-football/client'
import { syncLogger } from '@/lib/sync-logger'

export async function POST(req: NextRequest) {
    let competitionCode: string | undefined
    let season: number | undefined

    try {
        const supabase = createClient()
        const { data: { user } } = await (await supabase).auth.getUser()

        // Check admin permission
        const { data: profile } = await (await supabase)
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
            details: { competitionCode }
        })

        // 1. Fetch Competition
        const competition = await footballData.getCompetition(competitionCode)
        season = new Date(competition.currentSeason.startDate).getFullYear()

        // Upsert Event
        const { data: event, error: eventError } = await (await supabase)
            .from('events')
            .upsert({
                api_id: competition.id,
                name: competition.name,
                description: `${competition.type.toUpperCase()} - ${competitionCode}`,
                season: season,
                is_active: true
            }, { onConflict: 'api_id' })
            .select()
            .single()

        if (eventError) throw eventError

        // 2. Fetch Teams
        const teams = await footballData.getTeams(competitionCode)

        for (const team of teams) {
            await (await supabase)
                .from('teams')
                .upsert({
                    api_id: team.id.toString(),
                    name: team.name,
                    short_name: team.shortName,
                    code: team.tla,
                    logo_url: team.crest
                }, { onConflict: 'api_id' })
        }

        await syncLogger.log({
            resourceType: 'league',
            status: 'success',
            details: { competitionCode, season, teamsCount: teams.length }
        })

        return NextResponse.json({ success: true, message: `Imported ${competition.name} and ${teams.length} teams` })

    } catch (error: any) {
        console.error('Import error:', error)

        await syncLogger.log({
            resourceType: 'league',
            status: 'error',
            errorMessage: error.message,
            details: { competitionCode, season }
        })

        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
