import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runHealthcheck } from './healthcheck'

describe('runHealthcheck', () => {
  let directory: string
  let healthPath: string

  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'actual-truelayer-healthcheck-'))
    healthPath = path.join(directory, 'health.json')
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await fs.rm(directory, { recursive: true, force: true })
  })

  it('rejects invalid state without printing its contents', async () => {
    await fs.writeFile(healthPath, '{sensitive invalid content', { mode: 0o600 })

    await expect(runHealthcheck(healthPath)).rejects.toThrow('HealthCheckError')
    expect(console.log).not.toHaveBeenCalled()
    expect(console.error).not.toHaveBeenCalled()
  })
})
