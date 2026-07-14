import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Config } from './config/schema'
import { initActual, shutdownActual } from './actual/actual'
import { loadConfig } from './config/config'
import { acquireLock } from './runtime/lock'
import { writeHealth } from './runtime/health'
import { syncConnection } from './sync/connection'
import { mainTask, run } from './sync'

vi.mock('./actual/actual')
vi.mock('./config/config')
vi.mock('./runtime/lock')
vi.mock('./runtime/health')
vi.mock('./sync/connection')
vi.mock('./utils/logger')

const config: Config = {
  version: 2,
  includeCategoryInNotes: false,
  lookbackDays: 14,
  connections: [{ name: 'My Bank', accounts: [] }],
  env: {
    TRUELAYER_CLIENT_ID: 'client-id',
    TRUELAYER_CLIENT_SECRET_FILE: '/run/secrets/truelayer-client-secret',
    ACTUAL_SERVER_URL: 'http://localhost:5006',
    ACTUAL_SESSION_TOKEN_FILE: '/run/secrets/actual-session-token',
    ACTUAL_SYNC_ID_FILE: '/run/secrets/actual-sync-id',
    LOG_FORMAT: 'json',
  },
  secrets: {
    trueLayerClientSecret: 'client-secret',
    actualAuth: { sessionToken: 'session-token' },
    actualSyncId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  },
  state: {
    connections: { 'My Bank': { refreshToken: 'refresh-token', accounts: {} } },
  },
}

describe('sync runtime', () => {
  const release = vi.fn(async () => {})

  beforeEach(() => {
    vi.clearAllMocks()
    process.exitCode = undefined
    vi.mocked(acquireLock).mockResolvedValue(release)
    vi.mocked(initActual).mockResolvedValue(undefined)
    vi.mocked(shutdownActual).mockResolvedValue(undefined)
    vi.mocked(syncConnection).mockResolvedValue(config.state.connections['My Bank'])
    vi.mocked(writeHealth).mockResolvedValue(undefined)
    vi.mocked(loadConfig).mockResolvedValue(config)
  })

  afterEach(() => {
    process.exitCode = undefined
  })

  it('reports healthy only after a successful locked cycle', async () => {
    await expect(mainTask(config)).resolves.toBe(true)

    expect(acquireLock).toHaveBeenCalledTimes(1)
    expect(release).toHaveBeenCalledTimes(1)
    expect(writeHealth).toHaveBeenLastCalledWith(expect.any(String), 'healthy', 'ok')
    expect(vi.mocked(writeHealth).mock.invocationCallOrder[0]).toBeLessThan(release.mock.invocationCallOrder[0])
  })

  it('reports an unhealthy cycle when downstream work signals failure', async () => {
    vi.mocked(syncConnection).mockImplementationOnce(async (_connection, _config, options) => {
      options.onFailure('consent_expired')
      return config.state.connections['My Bank']
    })

    await expect(mainTask(config)).resolves.toBe(false)

    expect(writeHealth).toHaveBeenLastCalledWith(expect.any(String), 'unhealthy', 'consent_expired')
  })

  it('reports lock contention without initializing Actual', async () => {
    vi.mocked(acquireLock).mockRejectedValueOnce(new Error('LockBusyError'))

    await expect(mainTask(config)).resolves.toBe(false)

    expect(initActual).not.toHaveBeenCalled()
    expect(writeHealth).toHaveBeenCalledWith(expect.any(String), 'unhealthy', 'lock_busy')
  })

  it('sets a failed exit status for an unsuccessful one-shot run', async () => {
    vi.mocked(initActual).mockRejectedValueOnce(new Error('ActualInitError'))

    await run()

    expect(process.exitCode).toBe(1)
    expect(writeHealth).toHaveBeenLastCalledWith(expect.any(String), 'unhealthy', 'sync_failed')
  })
})
