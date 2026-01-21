
import { createClient } from '@/lib/supabase/server'
import { footballData } from '@/lib/api-football/client'
import { syncLogger } from '@/lib/sync-logger'
import { localizeExternalImage } from '@/lib/supabase/storage-utils'

// Send push notification via Edge Function
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

async function sendPushNotification(userId: string, title: string, body: string, url: string = '/') {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        console.warn('[Push] Missing Supabase config for Edge Function')
        return { success: false, error: 'Missing config' }
    }

    try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/send-push`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
            },
            body: JSON.stringify({ user_id: userId, title, body, url })
        })

        const result = await response.json()
        console.log(`[Push] Sent to ${userId}:`, result.success ? 'OK' : result.error)
        return result
    } catch (error: any) {
        console.error('[Push] Error calling Edge Function:', error.message)
        return { success: false, error: error.message }
    }
}

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
    const supabase = await createClient()

    // 0. THROTTLING CHECK
    // Prevent updates if a successful one happened less than 2 minutes ago
    const THROTTLE_MINUTES = 2
    const twoMinutesAgo = new Date(Date.now() - THROTTLE_MINUTES * 60 * 1000).toISOString()

    const { data: recentLogs } = await supabase
        .from('sync_logs')
        .select('created_at, status')
        .eq('reosurce_type', 'cron_matches') // Note: using the typo 'reosurce_type' as per existing schema
        .eq('status', 'success')
        .gt('created_at', twoMinutesAgo)
        .limit(1)

    if (recentLogs && recentLogs.length > 0) {
        console.log(`[Update] Throttled: A successful update occurred recently (${recentLogs[0].created_at}). Skipping.`)
        return { success: true, throttled: true, message: 'Throttled: Data is fresh.' }
    }

    // If it's live, we loop for ~50 seconds with 10s intervals
    const iterations = isLive ? 5 : 1
    const delay = 10000 // 10 seconds

    const results = []

    for (let i = 0; i < iterations; i++) {
        const iterationStart = Date.now()

        try {
            const res = await performUpdate(isLive) // Pass the flag
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

async function performUpdate(onlyLive: boolean = false) {
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

        console.log(`[Update] Found ${events.length} active events. Mode: ${onlyLive ? 'LIVE' : 'FULL'}`)

        const today = new Date().toISOString().split('T')[0]
        const eventResults = []

        // 2. For each event, fetch matches
        for (const event of events) {
            const codeMatch = event.description?.match(/- ([A-Z0-9]+)$/)
            const code = codeMatch ? codeMatch[1] : null

            if (!code) continue

            try {
                let dateFrom = today
                let dateTo = today
                let statusFilter = undefined

                if (onlyLive) {
                    // Optimized for live games: just fetch today's LIVE/IN_PLAY matches if the API supports it
                    // For now, let's fetch today with status filter PD or similar if the API client uses it
                    // Actually, competition/matches endpoint with status PD seems to work in some versions
                    statusFilter = undefined // We'll filter in code or just fetch a tight range
                } else {
                    // Determine Date Range for full sync
                    // Look for oldest pending match (not finished/cancelled) that already happened
                    const { data: pendingMatches } = await supabase
                        .from('matches')
                        .select('match_date')
                        .eq('event_id', event.id)
                        .not('status', 'in', '("finished","cancelled")')
                        .lt('match_date', new Date().toISOString())
                        .order('match_date', { ascending: true })
                        .limit(1)

                    if (pendingMatches && pendingMatches.length > 0) {
                        dateFrom = pendingMatches[0].match_date.split('T')[0]
                    } else {
                        // If no pending past matches, look back 3 days to catch any recently finished
                        const threeDaysAgo = new Date()
                        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)
                        dateFrom = threeDaysAgo.toISOString().split('T')[0]
                    }

                    // Always look ahead 7 days for upcoming matches
                    const sevenDaysFromNow = new Date()
                    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)
                    dateTo = sevenDaysFromNow.toISOString().split('T')[0]
                }

                // Fetch
                console.log(`[Update] ${event.name} (${code}): Fetching from ${dateFrom} to ${dateTo}`)
                const matches = await footballData.getMatchesByDateRange(code, dateFrom, dateTo, statusFilter)
                console.log(`[Update] ${event.name}: Found ${matches.length} matches from API`)

                if (matches.length === 0) {
                    eventResults.push({ event: event.name, status: 'no_matches' })
                    continue
                }

                // 3. Update Teams & Localize Logos (SKIP localization if onlyLive to be faster)
                const { data: existingTeams } = await supabase.from('teams').select('id, api_id')
                // Handle both string and number api_id
                const teamMap = new Map<number, string>()
                existingTeams?.forEach(t => {
                    const numericId = typeof t.api_id === 'string' ? parseInt(t.api_id, 10) : t.api_id
                    if (!isNaN(numericId)) {
                        teamMap.set(numericId, t.id)
                    }
                })

                // Check for new teams
                if (!onlyLive) {
                    for (const match of matches) {
                        const teams = [match.homeTeam, match.awayTeam]
                        for (const apiTeam of teams) {
                            if (!teamMap.has(apiTeam.id)) {
                                const { data: newTeam } = await supabase
                                    .from('teams')
                                    .insert({
                                        name: apiTeam.name,
                                        short_name: apiTeam.shortName,
                                        tla: apiTeam.tla,
                                        logo_url: apiTeam.crest,
                                        api_id: apiTeam.id
                                    })
                                    .select()
                                    .single()

                                if (newTeam) {
                                    teamMap.set(apiTeam.id, newTeam.id)
                                    const fileName = `${newTeam.id}.${apiTeam.crest?.split('.').pop() || 'png'}`
                                    const localizedUrl = await localizeExternalImage(apiTeam.crest, 'team-logos', fileName)
                                    if (localizedUrl) {
                                        await supabase.from('teams').update({ logo_url: localizedUrl }).eq('id', newTeam.id)
                                    }
                                }
                            }
                        }
                    }
                }

                // 4. Map and Upsert Matches
                const matchesToUpsert = matches
                    .filter(m => teamMap.has(m.homeTeam.id) && teamMap.has(m.awayTeam.id)) // Only matches with known teams
                    .map(m => ({
                        event_id: event.id,
                        home_team_id: teamMap.get(m.homeTeam.id),
                        away_team_id: teamMap.get(m.awayTeam.id),
                        match_date: m.utcDate,
                        venue: m.venue || null,
                        round: m.matchday ? `Rodada ${m.matchday}` : m.stage,
                        group_name: m.group || null,
                        status: mapStatus(m.status),
                        home_score: m.score?.fullTime?.home ?? null,
                        away_score: m.score?.fullTime?.away ?? null,
                        score_detailed: m.score, // Store full score JSON
                        api_id: m.id,
                        updated_at: new Date().toISOString()
                    }))

                if (matchesToUpsert.length > 0) {
                    const { data: upsertedMatches } = await supabase
                        .from('matches')
                        .upsert(matchesToUpsert, { onConflict: 'api_id' })
                        .select('id, status, home_score, away_score')

                    // Recalculate points for finished matches (trigger may not fire on upsert)
                    const finishedMatches = upsertedMatches?.filter(m =>
                        m.status === 'finished' && m.home_score !== null && m.away_score !== null
                    ) || []

                    let pointsRecalculated = 0
                    for (const match of finishedMatches) {
                        const { data: count } = await supabase.rpc('recalculate_match_points', { p_match_id: match.id })
                        pointsRecalculated += count || 0
                    }

                    eventResults.push({
                        event: event.name,
                        updated: matchesToUpsert.length,
                        pointsRecalculated
                    })

                    await syncLogger.log({
                        resourceType: 'cron_matches',
                        status: 'success',
                        details: { event: event.name, count: matchesToUpsert.length, onlyLive, pointsRecalculated }
                    })
                }
            } catch (err: any) {
                eventResults.push({ event: event.name, error: err.message })
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

                    // Send Push Notification via Edge Function
                    await sendPushNotification(
                        member.user_id,
                        'Lembrete de Palpite! ⏳',
                        `O jogo ${homeName} x ${awayName} começa em breve!`,
                        `/groups/${group.id}`
                    )

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
