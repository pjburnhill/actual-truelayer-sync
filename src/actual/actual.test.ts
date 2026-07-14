import { beforeEach, describe, expect, it, vi } from 'vitest'
import actual from '@actual-app/api'
import { initActual, importTransactions } from './actual'
import { logError } from '../utils/logger'

vi.mock('@actual-app/api', () => ({
  default: {
    init: vi.fn(),
    downloadBudget: vi.fn(),
    importTransactions: vi.fn(),
  },
}))
vi.mock('../utils/logger', () => ({ logError: vi.fn() }))

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

describe('importTransactions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reports only the rejected count and throws a safe error class', async () => {
    vi.mocked(actual.importTransactions).mockResolvedValueOnce({
      added: [],
      updated: [],
      errors: [
        {
          account: 'account-123',
          transaction_id: 'transaction-456',
          payee: 'Sensitive Payee',
          amount: 12345,
        },
      ],
    } as never)

    await expect(importTransactions('account-123', [])).rejects.toThrow('ActualImportError')
    expect(logError).toHaveBeenCalledWith(['Actual'], 'Rejected 1 transaction record.')
    expect(JSON.stringify(vi.mocked(logError).mock.calls)).not.toContain('account-123')
    expect(JSON.stringify(vi.mocked(logError).mock.calls)).not.toContain('transaction-456')
    expect(JSON.stringify(vi.mocked(logError).mock.calls)).not.toContain('Sensitive Payee')
    expect(JSON.stringify(vi.mocked(logError).mock.calls)).not.toContain('12345')
  })
})
