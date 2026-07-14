import fs from 'node:fs/promises'

function hasCode(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && error.code === code
}

async function createLock(lockPath: string): Promise<void> {
  const handle = await fs.open(lockPath, 'wx', 0o600)
  try {
    await handle.writeFile(String(process.pid), 'utf8')
    await handle.close()
    await fs.chmod(lockPath, 0o600)
  } catch (error) {
    await handle.close().catch(() => {})
    await fs.unlink(lockPath).catch(() => {})
    throw error
  }
}

export async function acquireLock(lockPath: string): Promise<() => Promise<void>> {
  try {
    await createLock(lockPath)
  } catch (error) {
    if (!hasCode(error, 'EEXIST')) throw error

    let owner: number
    try {
      owner = Number.parseInt((await fs.readFile(lockPath, 'utf8')).trim(), 10)
    } catch (readError) {
      if (hasCode(readError, 'ENOENT')) return acquireLock(lockPath)
      throw new Error('LockBusyError')
    }

    if (!Number.isSafeInteger(owner) || owner <= 0) throw new Error('LockBusyError')

    try {
      process.kill(owner, 0)
      throw new Error('LockBusyError')
    } catch (ownerError) {
      if (!hasCode(ownerError, 'ESRCH')) throw new Error('LockBusyError')
    }

    await fs.unlink(lockPath)
    try {
      await createLock(lockPath)
    } catch (retryError) {
      if (hasCode(retryError, 'EEXIST')) throw new Error('LockBusyError')
      throw retryError
    }
  }

  return async () => {
    try {
      const owner = (await fs.readFile(lockPath, 'utf8')).trim()
      if (owner === String(process.pid)) await fs.unlink(lockPath)
    } catch (error) {
      if (!hasCode(error, 'ENOENT')) throw error
    }
  }
}
