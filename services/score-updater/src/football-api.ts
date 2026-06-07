// ============================================
// Football-Data.org API Client
// Ported from apps/web/src/lib/api-football/client.ts
// Standalone — no Next.js dependencies
// ============================================

import { config } from './config.js'
import { logger } from './logger.js'

const API_BASE_URL = 'https://api.football-data.org/v4'

// ---------- Types ----------

export interface Score {
  winner: string | null
  duration: string
  fullTime: { home: number | null; away: number | null }
  halfTime: { home: number | null; away: number | null }
  extraTime?: { home: number | null; away: number | null }
  penalties?: { home: number | null; away: number | null }
}

export interface ApiTeam {
  id: number
  name: string
  shortName: string
  tla: string
  crest: string
  venue?: string
}

export interface ApiMatch {
  id: number
  utcDate: string
  status: string
  matchday: number
  stage: string
  group: string | null
  lastUpdated: string
  homeTeam: ApiTeam
  awayTeam: ApiTeam
  score: Score
  venue?: string
}

// ---------- Rate Limiter ----------

class RateLimiter {
  private timestamps: number[] = []
  private readonly maxRequests = 9  // Stay under 10/min for safety
  private readonly windowMs = 60_000

  async waitForSlot(): Promise<void> {
    const now = Date.now()

    // Remove timestamps outside the window
    this.timestamps = this.timestamps.filter(t => now - t < this.windowMs)

    if (this.timestamps.length >= this.maxRequests) {
      const oldestInWindow = this.timestamps[0]
      const waitMs = this.windowMs - (now - oldestInWindow) + 100 // +100ms buffer
      logger.warn('Rate limit reached, waiting', { waitMs })
      await new Promise(resolve => setTimeout(resolve, waitMs))
    }

    this.timestamps.push(Date.now())
  }
}

// ---------- Client ----------

const rateLimiter = new RateLimiter()

async function apiFetch<T>(endpoint: string): Promise<T> {
  await rateLimiter.waitForSlot()

  const url = `${API_BASE_URL}${endpoint}`
  logger.debug('API fetch', { url })

  const response = await fetch(url, {
    headers: { 'X-Auth-Token': config.footballApiKey },
  })

  if (response.status === 429) {
    // Rate limited by API — wait 60s and retry once
    logger.warn('429 Too Many Requests — waiting 60s')
    await new Promise(resolve => setTimeout(resolve, 60_000))

    const retry = await fetch(url, {
      headers: { 'X-Auth-Token': config.footballApiKey },
    })
    if (!retry.ok) {
      const text = await retry.text()
      throw new Error(`API error after retry: ${retry.status} - ${text}`)
    }
    return retry.json() as Promise<T>
  }

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Football-Data API error: ${response.status} - ${text}`)
  }

  return response.json() as Promise<T>
}

// ---------- Public API ----------

export async function getMatchesByDateRange(
  competitionCode: string,
  dateFrom: string,
  dateTo: string,
): Promise<ApiMatch[]> {
  const data = await apiFetch<{ matches: ApiMatch[] }>(
    `/competitions/${competitionCode}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`
  )
  return data.matches || []
}

export async function getAllMatches(competitionCode: string): Promise<ApiMatch[]> {
  const data = await apiFetch<{ matches: ApiMatch[] }>(
    `/competitions/${competitionCode}/matches`
  )
  return data.matches || []
}
