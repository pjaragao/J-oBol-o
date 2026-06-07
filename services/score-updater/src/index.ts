// ============================================
// Entry Point — Scheduler + Graceful Shutdown
// ============================================

import { config } from './config.js'
import { logger } from './logger.js'
import { liveTick, fullSync, hasGamesToday, getLastSync } from './updater.js'

// ---------- State ----------

let isRunning = true
let currentTimer: ReturnType<typeof setTimeout> | null = null
let isFullSyncDone = false
let lastFullSyncDate = ''
let tickCount = 0

// ---------- Smart Scheduler ----------

async function schedulerLoop() {
  if (!isRunning) return

  tickCount++

  try {
    // Check if it's time for daily full sync
    const nowUtc = new Date()
    const todayStr = nowUtc.toISOString().split('T')[0]
    const currentHourUtc = nowUtc.getUTCHours()

    if (currentHourUtc === config.fullSyncHourUtc && lastFullSyncDate !== todayStr) {
      logger.info('Daily full sync triggered', { hour: currentHourUtc })
      await fullSync()
      lastFullSyncDate = todayStr
      isFullSyncDone = true
    }

    // Smart schedule: check if there are games today
    let interval = config.pollIntervalMs // Default: 7s

    if (config.smartSchedule) {
      // Only check every ~100 ticks (~700s ≈ 12min) to avoid spamming DB
      const shouldCheckGames = tickCount % 100 === 1

      if (shouldCheckGames) {
        const gamesToday = await hasGamesToday()

        if (!gamesToday) {
          logger.info('No games today — switching to idle polling', {
            intervalMs: config.idlePollIntervalMs,
          })
          interval = config.idlePollIntervalMs // 5 min
        } else {
          logger.debug('Games today — active polling', { intervalMs: config.pollIntervalMs })
        }
      }
    }

    // Run live tick
    const results = await liveTick()

    const totalUpserted = results.reduce((sum, r) => sum + r.upserted, 0)
    if (totalUpserted > 0) {
      logger.info('Tick completed', {
        tick: tickCount,
        events: results.length,
        upserted: totalUpserted,
      })
    } else {
      // Only log every 50 ticks when nothing is happening
      if (tickCount % 50 === 0) {
        logger.debug('Tick — no updates', { tick: tickCount })
      }
    }

    // Schedule next tick
    if (isRunning) {
      currentTimer = setTimeout(schedulerLoop, interval)
    }

  } catch (err: any) {
    logger.error('Scheduler error', { error: err.message, tick: tickCount })

    // Continue running despite errors — retry after the normal interval
    if (isRunning) {
      currentTimer = setTimeout(schedulerLoop, config.pollIntervalMs)
    }
  }
}

// ---------- Graceful Shutdown ----------

function shutdown(signal: string) {
  logger.info('Shutdown signal received', { signal, totalTicks: tickCount })
  isRunning = false

  if (currentTimer) {
    clearTimeout(currentTimer)
    currentTimer = null
  }

  // Give in-flight requests 5s to complete
  setTimeout(() => {
    logger.info('Goodbye!')
    process.exit(0)
  }, 2_000)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

// ---------- Startup ----------

async function main() {
  logger.info('=== JãoBolão Score Updater ===')
  logger.info('Configuration', {
    pollInterval: `${config.pollIntervalMs}ms`,
    smartSchedule: config.smartSchedule,
    fullSyncHour: `${config.fullSyncHourUtc}:00 UTC`,
    idleInterval: `${config.idlePollIntervalMs}ms`,
    supabaseUrl: config.supabaseUrl,
  })

  // Run initial full sync on startup
  logger.info('Running initial full sync...')
  await fullSync()
  lastFullSyncDate = new Date().toISOString().split('T')[0]

  // Start scheduler
  logger.info('Scheduler started', { intervalMs: config.pollIntervalMs })
  schedulerLoop()
}

main().catch(err => {
  logger.error('Fatal startup error', { error: err.message })
  process.exit(1)
})
