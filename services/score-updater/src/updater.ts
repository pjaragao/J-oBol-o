// ============================================
// Score Updater — Core sync logic
// Ported from apps/web/src/lib/cron.ts
// ============================================

import { supabase } from './supabase.js'
import { getMatchesByDateRange, getAllMatches, type ApiMatch, type ApiTeam } from './football-api.js'
import { logger } from './logger.js'

// ---------- Status Mapping ----------

function mapStatus(apiStatus: string): string {
  const statusMap: Record<string, string> = {
    'SCHEDULED': 'scheduled',
    'TIMED': 'scheduled',
    'IN_PLAY': 'live',
    'PAUSED': 'live',
    'FINISHED': 'finished',
    'FT': 'finished',
    'AET': 'finished',
    'PEN': 'finished',
    'POSTPONED': 'postponed',
    'CANCELLED': 'cancelled',
    'SUSPENDED': 'postponed',
  }
  return statusMap[apiStatus] || 'scheduled'
}

// ---------- Types ----------

interface ActiveEvent {
  id: string
  name: string
  description: string | null
  is_active: boolean
}

interface TeamRow {
  id: string
  api_id: number
}

export interface SyncResult {
  event: string
  matchesFromApi: number
  upserted: number
  newTeams: number
  errors: string[]
  score_changes?: any[]
  status_changes?: any[]
}

// ---------- State ----------

let lastSyncTime: Date | null = null
let lastSyncResult: SyncResult | null = null

export function getLastSync() {
  return { time: lastSyncTime, result: lastSyncResult }
}

// ---------- Helpers ----------

function extractCompetitionCode(description: string | null): string | null {
  if (!description) return null
  const match = description.match(/- ([A-Z0-9]+)$/)
  return match ? match[1] : null
}

function todayDateStr(): string {
  return new Date().toISOString().split('T')[0]
}

// ---------- Check if games today ----------

export async function hasGamesToday(): Promise<boolean> {
  const today = todayDateStr()
  const startOfDay = `${today}T00:00:00Z`
  const endOfDay = `${today}T23:59:59Z`

  const { data, error } = await supabase
    .from('matches')
    .select('id', { count: 'exact', head: true })
    .gte('match_date', startOfDay)
    .lte('match_date', endOfDay)
    .in('status', ['scheduled', 'live', 'TIMED', 'IN_PLAY', 'PAUSED'])

  if (error) {
    logger.error('Error checking games today', { error: error.message })
    return true // Fail-open: assume there are games
  }

  return (data?.length ?? 0) > 0
}

// ---------- Live Tick (every 7s during games) ----------

export async function liveTick(): Promise<SyncResult[]> {
  const results: SyncResult[] = []

  try {
    // 1. Get active events from DB
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, name, description, is_active')
      .eq('is_active', true)

    if (eventsError) {
      logger.error('Failed to fetch events', { error: eventsError.message })
      return results
    }

    if (!events || events.length === 0) {
      logger.debug('No active events')
      return results
    }

    // 2. For each event, sync today's matches
    const today = todayDateStr()

    for (const event of events as ActiveEvent[]) {
      const code = extractCompetitionCode(event.description)
      if (!code) {
        logger.warn('No competition code in event description', { event: event.name })
        continue
      }

      const result = await syncEventMatches(event, code, today, today, false)
      results.push(result)
    }

    // 3. Log to sync_logs
    await logSync('success', results)

    lastSyncTime = new Date()
    lastSyncResult = results[0] || null

  } catch (err: any) {
    logger.error('Live tick failed', { error: err.message })
    await logSync('error', results, err.message)
  }

  return results
}

// ---------- Full Sync (daily — includes team creation + wider date range) ----------

export async function fullSync(): Promise<SyncResult[]> {
  const results: SyncResult[] = []

  try {
    logger.info('Starting daily full sync')

    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('id, name, description, is_active')
      .eq('is_active', true)

    if (eventsError || !events || events.length === 0) {
      logger.warn('No active events for full sync')
      return results
    }

    for (const event of events as ActiveEvent[]) {
      const code = extractCompetitionCode(event.description)
      if (!code) continue

      // Wider date range: -7 days to +30 days
      const dateFrom = new Date()
      dateFrom.setDate(dateFrom.getDate() - 7)
      const dateTo = new Date()
      dateTo.setDate(dateTo.getDate() + 30)

      const result = await syncEventMatches(
        event,
        code,
        dateFrom.toISOString().split('T')[0],
        dateTo.toISOString().split('T')[0],
        true, // includeTeamCreation
      )
      results.push(result)
    }

    await logSync('success', results)

    lastSyncTime = new Date()
    lastSyncResult = results[0] || null

    logger.info('Full sync completed', {
      events: results.length,
      totalUpserted: results.reduce((sum, r) => sum + r.upserted, 0),
    })

  } catch (err: any) {
    logger.error('Full sync failed', { error: err.message })
    await logSync('error', results, err.message)
  }

  return results
}

// ---------- Core Sync Logic ----------

async function syncEventMatches(
  event: ActiveEvent,
  competitionCode: string,
  dateFrom: string,
  dateTo: string,
  includeTeamCreation: boolean,
): Promise<SyncResult> {
  const result: SyncResult = {
    event: event.name,
    matchesFromApi: 0,
    upserted: 0,
    newTeams: 0,
    errors: [],
  }

  try {
    // Fetch matches from API
    const apiMatches = await getMatchesByDateRange(competitionCode, dateFrom, dateTo)
    result.matchesFromApi = apiMatches.length

    if (apiMatches.length === 0) {
      logger.debug('No matches from API', { event: event.name, dateFrom, dateTo })
      return result
    }

    // Load existing teams map
    const { data: existingTeams } = await supabase.from('teams').select('id, api_id')
    const teamMap = new Map<number, string>()
    existingTeams?.forEach((t: TeamRow) => {
      const numericId = typeof t.api_id === 'string' ? parseInt(t.api_id as unknown as string, 10) : t.api_id
      if (!isNaN(numericId)) {
        teamMap.set(numericId, t.id)
      }
    })

    // Create missing teams if full sync
    if (includeTeamCreation) {
      for (const match of apiMatches) {
        for (const apiTeam of [match.homeTeam, match.awayTeam]) {
          if (!teamMap.has(apiTeam.id)) {
            const { data: newTeam, error: teamErr } = await supabase
              .from('teams')
              .upsert({
                name: apiTeam.name,
                short_name: apiTeam.shortName,
                tla: apiTeam.tla,
                logo_url: apiTeam.crest,
                api_id: apiTeam.id,
              }, { onConflict: 'api_id' })
              .select('id')
              .single()

            if (newTeam) {
              teamMap.set(apiTeam.id, newTeam.id)
              result.newTeams++
            } else if (teamErr) {
              result.errors.push(`Team ${apiTeam.name}: ${teamErr.message}`)
            }
          }
        }
      }
    }

    // Map API matches to DB rows (only ones with known teams)
    const matchRows = apiMatches
      .filter(m => teamMap.has(m.homeTeam.id) && teamMap.has(m.awayTeam.id))
      .map(m => ({
        event_id: event.id,
        home_team_id: teamMap.get(m.homeTeam.id)!,
        away_team_id: teamMap.get(m.awayTeam.id)!,
        match_date: m.utcDate,
        venue: m.venue || null,
        round: m.matchday ? `Rodada ${m.matchday}` : m.stage,
        group_name: m.group || null,
        status: mapStatus(m.status),
        home_score: m.score?.duration === 'PENALTY_SHOOTOUT'
          ? (m.score.regularTime?.home ?? 0) + (m.score.extraTime?.home ?? 0)
          : (m.score?.fullTime?.home ?? null),
        away_score: m.score?.duration === 'PENALTY_SHOOTOUT'
          ? (m.score.regularTime?.away ?? 0) + (m.score.extraTime?.away ?? 0)
          : (m.score?.fullTime?.away ?? null),
        score_detailed: m.score,
        api_id: m.id,
        updated_at: new Date().toISOString(),
      }))

    // Batch upsert
    if (matchRows.length > 0) {
      // Compare scores before upserting to detect changes
      const apiIds = matchRows.map(m => m.api_id)
      const { data: existingMatches } = await supabase
        .from('matches')
        .select('api_id, home_score, away_score, status')
        .in('api_id', apiIds)

      const existingMap = new Map(existingMatches?.map(m => [m.api_id, m]) || [])
      const scoreChanges: any[] = []
      const statusChanges: any[] = []

      for (const m of matchRows) {
        const existing = existingMap.get(m.api_id)
        if (existing) {
          const scoreChanged = existing.home_score !== m.home_score || existing.away_score !== m.away_score
          const statusChanged = existing.status !== m.status

          const apiMatch = apiMatches.find(am => am.id === m.api_id)
          const teams = apiMatch ? `${apiMatch.homeTeam.name} vs ${apiMatch.awayTeam.name}` : `Match ${m.api_id}`

          if (scoreChanged) {
            scoreChanges.push({
              match_id: m.api_id,
              teams,
              old_score: `${existing.home_score}x${existing.away_score}`,
              new_score: `${m.home_score}x${m.away_score}`
            })
          }
          if (statusChanged) {
            statusChanges.push({
              match_id: m.api_id,
              teams,
              old_status: existing.status,
              new_status: m.status
            })
          }
        }
      }

      const { error: upsertErr } = await supabase
        .from('matches')
        .upsert(matchRows, { onConflict: 'api_id' })

      if (upsertErr) {
        result.errors.push(`Upsert: ${upsertErr.message}`)
        logger.error('Upsert failed', { event: event.name, error: upsertErr.message })
      } else {
        result.upserted = matchRows.length
        if (scoreChanges.length > 0) {
          result.score_changes = scoreChanges
        }
        if (statusChanges.length > 0) {
          result.status_changes = statusChanges
        }
      }
    }

    const skippedTeams = apiMatches.length - matchRows.length
    if (skippedTeams > 0) {
      logger.warn('Matches skipped (unknown teams)', { count: skippedTeams, event: event.name })
    }

  } catch (err: any) {
    result.errors.push(err.message)
    logger.error('Event sync error', { event: event.name, error: err.message })
  }

  return result
}

// ---------- Sync Log to DB ----------

async function logSync(status: string, results: SyncResult[], errorMessage?: string) {
  try {
    const hasScoreChanges = results.some(r => r.score_changes && r.score_changes.length > 0)
    await supabase.from('sync_logs').insert({
      reosurce_type: 'cron_matches', // Keeping legacy typo from existing schema
      status,
      details: {
        source: 'score-updater-docker',
        results,
        has_score_changes: hasScoreChanges
      },
      error_message: errorMessage || null,
    })
  } catch (err: any) {
    // Don't throw on logging failure
    logger.error('Failed to write sync_log', { error: err.message })
  }
}
