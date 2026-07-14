import { z } from 'zod'
import { readJSON, writeJSON } from '../utils/file'

export type HealthReason = 'ok' | 'sync_failed' | 'auth_expired' | 'consent_expired' | 'lock_busy'

const HealthSchema = z
  .object({
    status: z.enum(['healthy', 'unhealthy']),
    checkedAt: z.iso.datetime(),
    reason: z.enum(['ok', 'sync_failed', 'auth_expired', 'consent_expired', 'lock_busy']),
  })
  .strict()

const MAX_HEALTH_AGE = 7 * 60 * 60 * 1000

export async function writeHealth(path: string, status: 'healthy' | 'unhealthy', reason: HealthReason): Promise<void> {
  await writeJSON(path, { status, checkedAt: new Date().toISOString(), reason })
}

export async function assertHealthy(path: string, now = Date.now()): Promise<void> {
  try {
    const health = HealthSchema.parse(await readJSON<unknown>(path))
    const checkedAt = Date.parse(health.checkedAt)
    if (health.status !== 'healthy' || health.reason !== 'ok' || checkedAt > now || now - checkedAt > MAX_HEALTH_AGE) {
      throw new Error('HealthCheckError')
    }
  } catch {
    throw new Error('HealthCheckError')
  }
}
