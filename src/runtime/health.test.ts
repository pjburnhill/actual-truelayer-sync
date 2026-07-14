import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { assertHealthy, writeHealth } from './health'

describe('health state', () => {
  let directory: string
  let healthPath: string

  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'actual-truelayer-health-'))
    healthPath = path.join(directory, 'health.json')
  })

  afterEach(async () => {
    await fs.rm(directory, { recursive: true, force: true })
  })

  it('writes only safe unhealthy fields with mode 0600', async () => {
    await writeHealth(healthPath, 'unhealthy', 'sync_failed')

    const raw = await fs.readFile(healthPath, 'utf8')
    const health = JSON.parse(raw)
    expect(Object.keys(health).sort()).toEqual(['checkedAt', 'reason', 'status'])
    expect(health).toMatchObject({ status: 'unhealthy', reason: 'sync_failed' })
    expect(raw).not.toContain('caller error')
    expect((await fs.stat(healthPath)).mode & 0o777).toBe(0o600)
  })

  it('accepts fresh healthy state', async () => {
    const now = new Date('2026-07-14T12:00:00.000Z')
    await fs.writeFile(healthPath, JSON.stringify({ status: 'healthy', checkedAt: now.toISOString(), reason: 'ok' }), {
      mode: 0o600,
    })

    await expect(assertHealthy(healthPath, now.getTime())).resolves.toBeUndefined()
  })

  it('rejects unhealthy, invalid, and stale health state without exposing content', async () => {
    const now = new Date('2026-07-14T12:00:00.000Z')
    const cases = [
      JSON.stringify({ status: 'unhealthy', checkedAt: now.toISOString(), reason: 'sync_failed' }),
      '{invalid caller error text',
      JSON.stringify({
        status: 'healthy',
        checkedAt: new Date(now.getTime() - 7 * 60 * 60 * 1000 - 1).toISOString(),
        reason: 'ok',
      }),
    ]

    for (const contents of cases) {
      await fs.writeFile(healthPath, contents, { mode: 0o600 })
      await expect(assertHealthy(healthPath, now.getTime())).rejects.toThrow('HealthCheckError')
    }
  })
})
