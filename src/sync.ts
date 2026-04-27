import cron from 'node-cron'
import { loadConfig, writeConfig } from './config/config'
import { initActual, shutdownActual } from './actual/actual'
import { syncConnection } from './sync/connection'
import { log, logError } from './utils/logger'
import type { Config } from './config/schema'

const dryRun = process.argv.includes('--dry-run')

async function mainTask(config: Config): Promise<void> {
  try {
    await initActual({
      serverURL: config.env.ACTUAL_SERVER_URL,
      password: config.env.ACTUAL_SERVER_PASSWORD,
      syncId: config.env.ACTUAL_SYNC_ID,
      verbose: !!config.env.DEBUG,
    })

    for (let i = 0; i < config.connections.length; i++) {
      const connection = config.connections[i]
      const updated = await syncConnection(connection, config, dryRun)
      if (updated) {
        if (dryRun) {
          // Save config back for refresh token changes during a dry run
          config.connections[i] = { ...connection, refreshToken: updated.refreshToken }
        } else {
          config.connections[i] = updated
        }
        await writeConfig(config)
      }
    }
  } catch (e) {
    logError(['Sync'], 'Global sync error:', e)
  } finally {
    await shutdownActual()
    log(['Sync'], 'Sync cycle finished. Sleeping...')
  }
}

void (async () => {
  let config: Config
  try {
    config = await loadConfig()
  } catch (err) {
    logError(['Sync'], 'Failed to load config:', err)
    process.exit(1)
  }

  if (dryRun) {
    log(['DRY RUN'], 'No transactions will be imported and no runs will be scheduled.')
  }

  await mainTask(config)

  if (dryRun) {
    if (config.env.CRON_SCHEDULE) {
      log(['DRY RUN'], `Would have scheduled: ${config.env.CRON_SCHEDULE}`)
    }
    return
  }

  if (config.env.CRON_SCHEDULE) {
    const timezone = config.env.TZ
    log(
      ['Sync'],
      `Scheduler initialized with pattern: ${config.env.CRON_SCHEDULE}${timezone ? ` (timezone: ${timezone})` : ''}`,
    )
    cron.schedule(
      config.env.CRON_SCHEDULE,
      () => {
        mainTask(config).catch((err) => logError(['Sync'], 'Unhandled task error:', err))
      },
      {
        noOverlap: true,
        ...(timezone ? { timezone } : {}),
      },
    )
  }
})()

process.on('SIGTERM', () => {
  log(['Sync'], 'SIGTERM received, shutting down...')
  shutdownActual()
    .catch((err) => logError(['Sync'], 'Error during shutdown:', err))
    .finally(() => process.exit(0))
})
