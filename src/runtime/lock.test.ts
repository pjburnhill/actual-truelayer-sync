import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { acquireLock } from './lock'

describe('acquireLock', () => {
  let directory: string
  let lockPath: string

  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'actual-truelayer-lock-'))
    lockPath = path.join(directory, 'sync.lock')
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await fs.rm(directory, { recursive: true, force: true })
  })

  it('rejects a second acquisition while the owner is alive', async () => {
    const release = await acquireLock(lockPath)

    await expect(acquireLock(lockPath)).rejects.toThrow('LockBusyError')

    await release()
  })

  it('replaces a lock owned by a demonstrably dead PID', async () => {
    await fs.writeFile(lockPath, '999999', { mode: 0o600 })
    vi.spyOn(process, 'kill').mockImplementation(() => {
      throw Object.assign(new Error('No such process'), { code: 'ESRCH' })
    })

    const release = await acquireLock(lockPath)

    expect(await fs.readFile(lockPath, 'utf8')).toBe(String(process.pid))
    await release()
  })

  it('removes its lock on release', async () => {
    const release = await acquireLock(lockPath)

    await release()

    await expect(fs.access(lockPath)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
