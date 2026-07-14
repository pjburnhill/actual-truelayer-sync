import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readJSON, writeJSON } from './file'

describe('writeJSON', () => {
  let directory: string
  let target: string

  beforeEach(async () => {
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'actual-truelayer-state-'))
    target = path.join(directory, 'state.json')
  })

  afterEach(async () => {
    await fs.rm(directory, { recursive: true, force: true })
  })

  it('creates valid JSON with mode 0600 and no temporary file', async () => {
    await writeJSON(target, { value: 'first' })

    expect(await readJSON(target)).toEqual({ value: 'first' })
    expect((await fs.stat(target)).mode & 0o777).toBe(0o600)
    await expect(fs.access(`${target}.tmp`)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('atomically replaces an existing file and enforces mode 0600', async () => {
    await fs.writeFile(target, '{"value":"old"}', { mode: 0o644 })

    await writeJSON(target, { value: 'replacement' })

    expect(await readJSON(target)).toEqual({ value: 'replacement' })
    expect((await fs.stat(target)).mode & 0o777).toBe(0o600)
    await expect(fs.access(`${target}.tmp`)).rejects.toMatchObject({ code: 'ENOENT' })
  })
})
