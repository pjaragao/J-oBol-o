
import { createClient } from '@/lib/supabase/server'
import { footballData } from '@/lib/api-football/client'
import { syncLogger } from '@/lib/sync-logger'
import { localizeExternalImage } from '@/lib/supabase/storage-utils'

// Helper function from update-matches
function mapStatus(apiStatus: string): string {
    const statusMap: Record<string, string> = {
        'SCHEDULED': 'scheduled', 'TIMED': 'scheduled', 'IN_PLAY': 'live', 'PAUSED': 'live',
        'FINISHED': 'finished', 'FT': 'finished', 'AET': 'finished', 'PEN': 'finished',
        'POSTPONED': 'postponed', 'CANCELLED': 'cancelled', 'SUSPENDED': 'postponed'
    }
    return statusMap[apiStatus] || 'scheduled'
}

export async function updateMatches(isLive: boolean = false) {
    // If it's live, we loop for ~50 seconds with 10s intervals
    const iterations = isLive ? 5 : 1
    const delay = 10000 // 10 seconds

    const results = []

    for (let i = 0; i < iterations; i++) {
        const iterationStart = Date.now()

        try {
            const res = await performUpdate()
            results.push({ iteration: i + 1, ...res })
        } catch (error: any) {
            results.push({ iteration: i + 1, error: error.message })
        }

        // Wait for next 10s interval if looping
        if (isLive && i < iterations - 1) {
            const elapsed = Date.now() - iterationStart
            const waitTime = Math.max(0, delay - elapsed)
            if (waitTime > 0) await new Promise(resolve => setTimeout(resolve, waitTime))
        }
    }

    return { success: true, isLive, results }
}

async function performUpdate() {
    try {
        const supabase = await createClient()

        // 1. Get Active Events
        const { data: events } = await supabase
            .from('events')
            .select('*')
            .eq('is_active', true)

        if (!events || events.length === 0) {
            console.log('[Update] No active events found.')
            return { message: 'No active events found' }
        }

        console.log(`[Update] Found ${events.length} active events: ${events.map(e => e.name).join(', ')}`)

        const today = new Date().toISOString().split('T')[0]
        const eventResults = []

        // 2. For each event, fetch matches
        for (const event of events) {
            const codeMatch = event.description?.match(/- ([A-Z0-9]+)$/)
            const code = codeMatch ? codeMatch[1] : null

            if (!code) {
                console.log(`[Update] Skipping ${event.name}: No competition code found in description.`)
                continue
            }

            try {
                // Determine Date Range
                // Find oldest match that is NOT finished/canceled and should have happened (date < now)
                const { data: pendingMatches, error: pendingError } = await supabase
                    .from('matches')
                    .select('match_date, status')
                    .eq('event_id', event.id)
                    .neq('status', 'finished')
                    .neq('status', 'cancelled')
                    .lt('match_date', new Date().toISOString())
                    .order('match_date', { ascending: true })
                    .limit(1)

                if (pendingError) {
                    console.error(`[Update] Error finding pending matches for ${event.name}:`, pendingError)
                }

                let dateFrom = today
                let dateTo = today

                if (pendingMatches && pendingMatches.length > 0) {
                    const pendingDate = pendingMatches[0].match_date.split('T')[0]
                    console.log(`[Update] Found pending match for ${event.name} on ${pendingDate} (Status: ${pendingMatches[0].status})`)
                    dateFrom = pendingDate
                } else {
                    console.log(`[Update] No pending matches found for ${event.name}. Using today: ${today}`)
                }

                // Check API limit (max 10 days range usually)
                const d1 = new Date(dateFrom)
                const d2 = new Date(dateTo)
                const diffTime = Math.abs(d2.getTime() - d1.getTime())
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

                if (diffDays > 10) {
                    console.log(`[Update] Range too large (${diffDays} days). Clamping to last 10 days.`)
                    // Clamp start date to 10 days ago from today
                    const newFrom = new Date(d2)
                    newFrom.setDate(d2.getDate() - 9)
                    dateFrom = newFrom.toISOString().split('T')[0]
                }

                console.log(`[Update] Fetching ${event.name} (${code}) from ${dateFrom} to ${dateTo}`)

                const matches = await footballData.getMatchesByDateRange(code, dateFrom, dateTo)

                if (matches.length === 0) {
                    console.log(`[Update] No matches returned from API for ${event.name}`)
                    eventResults.push({ event: event.name, status: 'no_matches', range: `${dateFrom} to ${dateTo}` })
                    continue
                }

                console.log(`[Update] API returned ${matches.length} matches for ${event.name}`)

                // 3. Update Teams & Localize Logos
                const { data: existingTeams } = await supabase.from('teams').select('id, api_id, logo_url')
                const teamMap = new Map(existingTeams?.map(t => [t.api_id, t.id]) || [])
                console.log(`[Update] Loaded ${existingTeams?.length} existing teams into map.`)

                // Check for new teams or teams missing localized logos
                for (const match of matches) {
                    const teams = [match.homeTeam, match.awayTeam]
                    for (const apiTeam of teams) {
                        if (!teamMap.has(apiTeam.id)) {
                            console.log(`[Update] Team ${apiTeam.name} (${apiTeam.id}) not in map. Attempting insert...`)
                            // New team found!
                            const { data: newTeam, error } = await supabase
                                .from('teams')
                                .insert({
                                    name: apiTeam.name,
                                    short_name: apiTeam.shortName,
                                    logo_url: apiTeam.crest,
                                    api_id: apiTeam.id
                                })
                                .select()
                                .single()

                            if (newTeam) {
                                console.log(`[Update] Created team ${newTeam.name} (${newTeam.id})`)
                                teamMap.set(apiTeam.id, newTeam.id)
                                // Localize logo asynchronously or immediately for new teams
                                const fileName = `${newTeam.id}.${apiTeam.crest?.split('.').pop() || 'png'}`
                                const localizedUrl = await localizeExternalImage(apiTeam.crest, 'team-logos', fileName)
                                if (localizedUrl) {
                                    await supabase.from('teams').update({ logo_url: localizedUrl }).eq('id', newTeam.id)
                                }
                            } else {
                                console.error(`[Update] Failed to insert team ${apiTeam.name}:`, error)
                            }
                        }
                    }
                }

                // 4. Map and Upsert Matches
                const matchesToUpsert = matches.map(m => {
                    const homeId = teamMap.get(m.homeTeam.id)
                    const awayId = teamMap.get(m.awayTeam.id)

                    if (!homeId) console.warn(`[Update] Missing Home Team ID for match ${m.id} (Home API ID: ${m.homeTeam.id})`)
                    if (!awayId) console.warn(`[Update] Missing Away Team ID for match ${m.id} (Away API ID: ${m.awayTeam.id})`)

                    return {
                        event_id: event.id,
                        home_team_id: homeId,
                        away_team_id: awayId,
                        match_date: m.utcDate,
                        status: mapStatus(m.status),
                        home_score: m.score?.fullTime?.home ?? null,
                        away_score: m.score?.fullTime?.away ?? null,
                        api_id: m.id,
                        round: m.matchday ? `Rodada ${m.matchday}` : m.stage,
                        group_name: m.group,
                        updated_at: new Date().toISOString()
                    }
                }).filter(m => m.home_team_id && m.away_team_id)

                console.log(`[Update] Prepared ${matchesToUpsert.length} matches to upsert.`)

                if (matchesToUpsert.length > 0) {
                    const { error: upsertError } = await supabase
                        .from('matches')
                        .upsert(matchesToUpsert, { onConflict: 'api_id' })

                    if (upsertError) {
                        console.error('[Update] Error upserting matches:', upsertError)
                        throw new Error(`Upsert failed: ${upsertError.message}`)
                    }

                    console.log(`[Update] Successfully upserted ${matchesToUpsert.length} matches.`)

                    eventResults.push({ event: event.name, updated: matchesToUpsert.length, range: `${dateFrom} to ${dateTo}` })

                    await syncLogger.log({
                        resourceType: 'cron_matches',
                        status: 'success',
                        details: { event: event.name, count: matchesToUpsert.length, range: `${dateFrom} to ${dateTo}` }
                    })
                } else {
                    console.log(`[Update] No matches to upsert for ${event.name} (maybe teams missing?)`)
                    eventResults.push({ event: event.name, updated: 0, message: 'Matches found but none upserted (teams missing?)' })
                }

            } catch (err: any) {
                console.error(`[Update] Error processing ${event.name}:`, err)
                eventResults.push({ event: event.name, error: err.message })
                await syncLogger.log({ resourceType: 'cron_matches', status: 'error', errorMessage: err.message, details: { event: event.name } })
            }
        }

        return { eventResults }

    } catch (error: any) {
        throw error
    }
}

export async function sendReminders() {
    try {
        const supabase = await createClient()

        // 2. Find users who haven't bet on matches starting in the next 2 hours
        const now = new Date()
        const twoHoursFromNow = new Date(now.getTime() + 2 * 60 * 60 * 1000)

        const { data: upcomingMatches, error: matchesError } = await supabase
            .from('matches')
            .select(`
                id, 
                match_date, 
                home_team:teams!home_team_id(name), 
                away_team:teams!away_team_id(name),
                event:events(id, name)
            `)
            .eq('status', 'scheduled')
            .gt('match_date', now.toISOString())
            .lt('match_date', twoHoursFromNow.toISOString())

        if (matchesError) throw matchesError
        if (!upcomingMatches || upcomingMatches.length === 0) {
            return { message: 'No upcoming matches to remind about.' }
        }

        const results = []

        for (const match of upcomingMatches) {
            // Find all groups for this event
            const { data: groups } = await supabase
                .from('groups')
                .select('id, name')
                .eq('event_id', (match.event as any).id)

            if (!groups) continue

            for (const group of groups) {
                // Find members who HAVEN'T bet
                const { data: bettors } = await supabase
                    .from('bets')
                    .select('user_id')
                    .eq('match_id', match.id)
                    .eq('group_id', group.id)

                const bettorIds = bettors?.map(b => b.user_id) || []

                const { data: members } = await supabase
                    .from('group_members')
                    .select('user_id, profiles!inner(notification_settings)')
                    .eq('group_id', group.id)
                    .not('user_id', 'in', `(${bettorIds.join(',') || 'NULL'})`)

                if (!members) continue

                for (const member of members) {
                    const settings = (member.profiles as any)?.notification_settings || {}
                    if (settings.bet_reminder === false) continue

                    const { data: existing } = await supabase
                        .from('notifications')
                        .select('id')
                        .eq('user_id', member.user_id)
                        .eq('type', 'bet_reminder')
                        .contains('data', { match_id: match.id })
                        .limit(1)

                    if (existing && existing.length > 0) continue

                    const homeName = (match.home_team as any).name
                    const awayName = (match.away_team as any).name

                    await supabase
                        .from('notifications')
                        .insert({
                            user_id: member.user_id,
                            title: 'Lembrete de Palpite! ⏳',
                            message: `Não esqueça! O jogo ${homeName} x ${awayName} começa em breve e você ainda não deu seu palpite no grupo ${group.name}.`,
                            type: 'warning',
                            data: {
                                match_id: match.id,
                                group_id: group.id,
                                type: 'bet_reminder'
                            }
                        })

                    results.push({ user: member.user_id, match: match.id, group: group.id })
                }
            }
        }

        return {
            success: true,
            reminders_sent: results.length,
            details: results
        }

    } catch (error: any) {
        console.error('Cron Error:', error)
        throw error
    }
}
