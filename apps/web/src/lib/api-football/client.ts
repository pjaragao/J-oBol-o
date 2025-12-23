/**
 * Football-Data.org API Client
 * Documentation: https://www.football-data.org/documentation/quickstart
 * 
 * Competition Codes (Free Tier):
 * - PL: Premier League (England)
 * - BL1: Bundesliga (Germany)
 * - SA: Serie A (Italy)
 * - PD: La Liga (Spain)
 * - FL1: Ligue 1 (France)
 * - ELC: Championship (England)
 * - PPL: Primeira Liga (Portugal)
 * - DED: Eredivisie (Netherlands)
 * - BSA: Brasileirão (Brazil)
 * - CL: Champions League
 * - EC: European Championship
 * - WC: FIFA World Cup
 */

const API_BASE_URL = 'https://api.football-data.org/v4'

interface Competition {
    id: number
    name: string
    code: string
    type: string
    emblem: string
    currentSeason: {
        id: number
        startDate: string
        endDate: string
        currentMatchday: number
    }
}

interface Team {
    id: number
    name: string
    shortName: string
    tla: string
    crest: string
    venue: string
}

interface Match {
    id: number
    utcDate: string
    status: string
    matchday: number
    stage: string
    venue: string | null
    homeTeam: { id: number; name: string; shortName: string; crest: string }
    awayTeam: { id: number; name: string; shortName: string; crest: string }
    group: string | null
    score: {
        winner: string | null
        fullTime: { home: number | null; away: number | null }
        halfTime: { home: number | null; away: number | null }
    }
}

class FootballDataClient {
    private apiKey: string
    private requestCount = 0
    private lastResetTime = Date.now()

    constructor() {
        const key = process.env.FOOTBALL_DATA_API_KEY
        if (!key) {
            throw new Error('FOOTBALL_DATA_API_KEY not set in environment')
        }
        this.apiKey = key
    }

    private async fetch<T>(endpoint: string): Promise<T> {
        // Rate limiting: 10 requests per minute for free tier
        const now = Date.now()
        if (now - this.lastResetTime > 60000) {
            this.requestCount = 0
            this.lastResetTime = now
        }

        if (this.requestCount >= 10) {
            throw new Error('Taxa de requisições excedida. Aguarde 1 minuto.')
        }

        const url = `${API_BASE_URL}${endpoint}`

        console.log(`[Football-Data] Fetching: ${url}`)

        const response = await fetch(url, {
            headers: {
                'X-Auth-Token': this.apiKey,
            },
        })

        this.requestCount++

        if (!response.ok) {
            const errorText = await response.text()
            console.error('[Football-Data] Error:', errorText)
            throw new Error(`Football-Data API error: ${response.status} - ${errorText}`)
        }

        return response.json()
    }

    /**
     * Get competition info by code
     */
    async getCompetition(code: string): Promise<Competition> {
        const data = await this.fetch<Competition>(`/competitions/${code}`)
        return data
    }

    /**
     * Get all teams for a competition
     */
    async getTeams(competitionCode: string): Promise<Team[]> {
        const data = await this.fetch<{ teams: Team[] }>(`/competitions/${competitionCode}/teams`)
        return data.teams
    }

    /**
     * Get all matches for a competition (optionally for a specific season)
     */
    async getMatches(competitionCode: string, season?: number): Promise<Match[]> {
        let endpoint = `/competitions/${competitionCode}/matches`
        if (season) {
            endpoint += `?season=${season}`
        }
        const data = await this.fetch<{ matches: Match[] }>(endpoint)
        return data.matches
    }

    /**
     * Get matches for a specific matchday
     */
    async getMatchesByMatchday(competitionCode: string, matchday: number): Promise<Match[]> {
        const data = await this.fetch<{ matches: Match[] }>(
            `/competitions/${competitionCode}/matches?matchday=${matchday}`
        )
        return data.matches
    }

    /**
     * Get matches for a date range
     */
    async getMatchesByDateRange(competitionCode: string, dateFrom: string, dateTo: string): Promise<Match[]> {
        const data = await this.fetch<{ matches: Match[] }>(
            `/competitions/${competitionCode}/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`
        )
        return data.matches
    }
}

export const footballData = new FootballDataClient()
export type { Competition, Team, Match }
