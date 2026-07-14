import path from 'node:path'
import cron from 'node-cron'
import { loadConfig, writeState } from './config/config'
import { initActual, shutdownActual } from './actual/actual'
import { syncConnection } from './sync/connection'
import { log, logError } from './utils/logger'
import { acquireLock } from './runtime/lock'
import { writeHealth, type HealthReason } from './runtime/health'
import type { Config } from './config/schema'

const DATA_DIR = path.resolve(__dirname, '..', 'data')
const LOCK_PATH = path.join(DATA_DIR, 'sync.lock')
const HEALTH_PATH = path.join(DATA_DIR, 'health.json')
const dryRun = process.argv.includes('--dry-run')

function preferredFailure(current: HealthReason, next: HealthReason): HealthReason {
  if (current === 'auth_expired' || current === 'consent_expired') return current
  return next
}

export async function mainTask(config: Config): Promise<boolean> {
  let release: (() => Promise<void>) | undefined
  try {
    release = await acquireLock(LOCK_PATH)
  } catch (error) {
    logError(['Sync'], 'Another sync owns the persistent lock.', error)
    try {
      await writeHealth(HEALTH_PATH, 'unhealthy', 'lock_busy')
    } catch (healthError) {
      logError(['Sync'], 'Failed to update health state.', healthError)
    }
    return false
  }

  let success = true
  let reason: HealthReason = 'ok'
  let initializationAttempted = false

  try {
    initializationAttempted = true
    await initActual({
      serverURL: config.env.ACTUAL_SERVER_URL,
      auth: config.secrets.actualAuth,
      syncId: config.secrets.actualSyncId,
      verbose: !!config.env.DEBUG,
    })

    for (const connection of config.connections) {
      const result = await syncConnection(connection, config, {
        dryRun,
        onFailure: (failureReason) => {
          success = false
          reason = preferredFailure(reason, failureReason)
        },
        onRefreshToken: async (refreshToken) => {
          const connectionState = config.state.connections[connection.name]
          if (!connectionState) return
          config.state.connections[connection.name] = { ...connectionState, refreshToken }
          await writeState(config)
        },
      })
      if (result) {
        config.state.connections[connection.name] = result
        await writeState(config)
      }
    }
  } catch (error) {
    success = false
    reason = preferredFailure(reason, 'sync_failed')
    logError(['Sync'], 'Global sync error:', error)
  } finally {
    if (initializationAttempted) {
      try {
        await shutdownActual()
      } catch (error) {
        success = false
        reason = preferredFailure(reason, 'sync_failed')
        logError(['Sync'], 'Actual shutdown failed:', error)
      }
    }

    try {
      await release()
    } catch (error) {
      success = false
      reason = preferredFailure(reason, 'sync_failed')
      logError(['Sync'], 'Failed to release persistent lock.', error)
    }

    try {
      await writeHealth(HEALTH_PATH, success ? 'healthy' : 'unhealthy', success ? 'ok' : reason)
    } catch (error) {
      success = false
      logError(['Sync'], 'Failed to update health state.', error)
    }

    log(['Sync'], 'Sync cycle finished.')
  }

  return success
}

export async function run(): Promise<void> {
  let config: Config
  try {
    config = await loadConfig()
  } catch (error) {
    logError(['Sync'], 'Failed to load config:', error)
    try {
      await writeHealth(HEALTH_PATH, 'unhealthy', 'sync_failed')
    } catch (healthError) {
      logError(['Sync'], 'Failed to update health state.', healthError)
    }
    process.exitCode = 1
    return
  }

  if (dryRun) {
    log(['DRY RUN'], 'No transactions will be imported and no runs will be scheduled.')
  }

  const initialSuccess = await mainTask(config)

  if (dryRun) {
    if (config.env.CRON_SCHEDULE) log(['DRY RUN'], `Would have scheduled: ${config.env.CRON_SCHEDULE}`)
    if (!initialSuccess) process.exitCode = 1
    return
  }

  if (!config.env.CRON_SCHEDULE) {
    if (!initialSuccess) process.exitCode = 1
    return
  }

  const timezone = config.env.TZ
  log(
    ['Sync'],
    `Scheduler initialized with pattern: ${config.env.CRON_SCHEDULE}${timezone ? ` (timezone: ${timezone})` : ''}`,
  )
  cron.schedule(
    config.env.CRON_SCHEDULE,
    async () => {
      await mainTask(config)
    },
    {
      noOverlap: true,
      ...(timezone ? { timezone } : {}),
    },
  )

  process.on('SIGTERM', () => {
    log(['Sync'], 'SIGTERM received, shutting down...')
    shutdownActual()
      .catch((error) => logError(['Sync'], 'Error during shutdown:', error))
      .finally(() => process.exit(0))
  })
}

if (require.main === module) {
  void run().catch((error) => {
    logError(['Sync'], 'Unhandled sync error:', error)
    process.exitCode = 1
  })
}
