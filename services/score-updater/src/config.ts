// ============================================
// Configuration — validated env vars
// ============================================

function required(key: string): string {
  const value = process.env[key]
  if (!value) {
    console.error(`[FATAL] Missing required env var: ${key}`)
    process.exit(1)
  }
  return value
}

function int(key: string, fallback: number): number {
  const raw = process.env[key]
  if (!raw) return fallback
  const parsed = parseInt(raw, 10)
  return isNaN(parsed) ? fallback : parsed
}

function bool(key: string, fallback: boolean): boolean {
  const raw = process.env[key]
  if (!raw) return fallback
  return raw === 'true' || raw === '1'
}

export const config = {
  // Supabase Cloud
  supabaseUrl: required('SUPABASE_URL'),
  supabaseServiceKey: required('SUPABASE_SERVICE_ROLE_KEY'),

  // Football-Data.org
  footballApiKey: required('FOOTBALL_DATA_API_KEY'),

  // Polling: 7 seconds (≈8.5 req/min, under 10/min free limit)
  pollIntervalMs: int('POLL_INTERVAL_MS', 7_000),

  // Smart schedule: only poll when there are games today
  smartSchedule: bool('SMART_SCHEDULE', true),

  // Hour (UTC) for the daily full sync (teams + all matches)
  fullSyncHourUtc: int('FULL_SYNC_HOUR_UTC', 6),

  // Idle polling: how often to check when no games (ms) — default 5 min
  idlePollIntervalMs: int('IDLE_POLL_INTERVAL_MS', 300_000),
} as const

export type Config = typeof config
