import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readSecretFile } from './secrets'

describe('readSecretFile', () => {
  let directory: string

  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'actual-truelayer-secrets-'))
  })

  afterEach(async () => {
    await fs.rm(directory, { recursive: true, force: true })
  })

  it('reads and trims a regular mode 0600 file', async () => {
    const secretPath = path.join(directory, 'secret')
    await fs.writeFile(secretPath, 'secret-value\n', { mode: 0o600 })

    await expect(readSecretFile(secretPath, 'Actual session token')).resolves.toBe('secret-value')
  })

  it('rejects an empty file', async () => {
    const emptyPath = path.join(directory, 'empty')
    await fs.writeFile(emptyPath, '\n', { mode: 0o600 })

    await expect(readSecretFile(emptyPath, 'Actual session token')).rejects.toThrow('is empty')
  })

  it('rejects a directory', async () => {
    const directoryPath = path.join(directory, 'nested')
    await fs.mkdir(directoryPath, { mode: 0o600 })

    await expect(readSecretFile(directoryPath, 'Actual session token')).rejects.toThrow('must be a regular file')
  })

  it('rejects a symlink', async () => {
    const targetPath = path.join(directory, 'target')
    const symlinkPath = path.join(directory, 'link')
    await fs.writeFile(targetPath, 'secret-value', { mode: 0o600 })
    await fs.symlink(targetPath, symlinkPath)

    await expect(readSecretFile(symlinkPath, 'Actual session token')).rejects.toThrow('must be a regular file')
  })

  it('rejects a group-readable file', async () => {
    const groupReadablePath = path.join(directory, 'group-readable')
    await fs.writeFile(groupReadablePath, 'secret-value', { mode: 0o640 })

    await expect(readSecretFile(groupReadablePath, 'Actual session token')).rejects.toThrow('must have mode 0600')
  })
})
