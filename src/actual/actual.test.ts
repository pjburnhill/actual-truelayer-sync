import { beforeEach, describe, expect, it, vi } from 'vitest'
import actual from '@actual-app/api'
import { initActual } from './actual'

vi.mock('@actual-app/api', () => ({
  default: {
    init: vi.fn(),
    downloadBudget: vi.fn(),
  },
}))

describe('initActual', () => {
  beforeEach(() => vi.clearAllMocks())

  it('initializes Actual with a session token and no password', async () => {
    await initActual({
      serverURL: 'http://localhost:5006',
      auth: { sessionToken: 'session-token' },
      syncId: 'sync-id',
      verbose: false,
    })

    expect(actual.init).toHaveBeenCalledWith({
      serverURL: 'http://localhost:5006',
      sessionToken: 'session-token',
      verbose: false,
      dataDir: './data',
    })
    expect(actual.downloadBudget).toHaveBeenCalledWith('sync-id')
  })

  it('initializes Actual with a password and no session token', async () => {
    await initActual({
      serverURL: 'http://localhost:5006',
      auth: { password: 'password' },
      syncId: 'sync-id',
      verbose: false,
    })

    expect(actual.init).toHaveBeenCalledWith({
      serverURL: 'http://localhost:5006',
      password: 'password',
      verbose: false,
      dataDir: './data',
    })
  })
})
