import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountSchema, ConnectionSchema, EnvSchema, FileConfigSchema, StateSchema } from './schema'
import { loadConfig } from './config'
import { readSecretFile } from './secrets'
import { readJSON } from '../utils/file'

vi.mock('./secrets', () => ({ readSecretFile: vi.fn() }))
vi.mock('../utils/file', () => ({ readJSON: vi.fn(), writeJSON: vi.fn() }))

describe('AccountSchema', () => {
  const validAccount = {
    trueLayerId: 'tl-acc-1',
    actualId: 'actual-acc-1',
    friendlyName: 'My Account',
    importStartDate: '2026-07-15',
  }

  it('accepts a minimal valid account', () => {
    expect(AccountSchema.safeParse(validAccount).success).toBe(true)
  })

  it('accepts optional isCard and flip', () => {
    const result = AccountSchema.safeParse({ ...validAccount, isCard: true, flip: false })
    expect(result.success).toBe(true)
  })

  it('rejects missing trueLayerId', () => {
    const { trueLayerId: _, ...rest } = validAccount
    expect(AccountSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects empty trueLayerId', () => {
    expect(AccountSchema.safeParse({ ...validAccount, trueLayerId: '' }).success).toBe(false)
  })

  it('rejects missing actualId', () => {
    const { actualId: _, ...rest } = validAccount
    expect(AccountSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing friendlyName', () => {
    const { friendlyName: _, ...rest } = validAccount
    expect(AccountSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects a missing or invalid importStartDate', () => {
    const { importStartDate: _, ...rest } = validAccount
    expect(AccountSchema.safeParse(rest).success).toBe(false)
    expect(AccountSchema.safeParse({ ...validAccount, importStartDate: '15-07-2026' }).success).toBe(false)
  })

  it('rejects a non-boolean flip', () => {
    expect(AccountSchema.safeParse({ ...validAccount, flip: 'yes' }).success).toBe(false)
  })
})

describe('ConnectionSchema', () => {
  const validConnection = {
    name: 'My Bank',
    accounts: [],
  }

  it('accepts a valid connection with empty accounts', () => {
    expect(ConnectionSchema.safeParse(validConnection).success).toBe(true)
  })

  it('accepts isCard at connection level', () => {
    expect(ConnectionSchema.safeParse({ ...validConnection, isCard: true }).success).toBe(true)
  })

  it('accepts a connection with accounts', () => {
    const result = ConnectionSchema.safeParse({
      ...validConnection,
      accounts: [{ trueLayerId: 'tl-1', actualId: 'a-1', friendlyName: 'Acc', importStartDate: '2026-07-15' }],
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing name', () => {
    const { name: _, ...rest } = validConnection
    expect(ConnectionSchema.safeParse(rest).success).toBe(false)
  })
})

describe('FileConfigSchema', () => {
  const validFileConfig = {
    version: 2,
    connections: [{ name: 'My Bank', accounts: [] }],
  }

  it('accepts a valid file config', () => {
    expect(FileConfigSchema.safeParse(validFileConfig).success).toBe(true)
  })

  it('defaults includeCategoryInNotes to false', () => {
    const result = FileConfigSchema.safeParse(validFileConfig)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.includeCategoryInNotes).toBe(false)
  })

  it('accepts includeCategoryInNotes: true', () => {
    const result = FileConfigSchema.safeParse({ ...validFileConfig, includeCategoryInNotes: true })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.includeCategoryInNotes).toBe(true)
  })

  it('rejects empty connections array', () => {
    expect(FileConfigSchema.safeParse({ ...validFileConfig, connections: [] }).success).toBe(false)
  })

  it('rejects missing connections', () => {
    expect(FileConfigSchema.safeParse({}).success).toBe(false)
  })

  it('rejects duplicate connection names', () => {
    const result = FileConfigSchema.safeParse({
      ...validFileConfig,
      connections: [
        { name: 'My Bank', accounts: [] },
        { name: 'My Bank', accounts: [] },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('accepts connections with unique names', () => {
    const result = FileConfigSchema.safeParse({
      ...validFileConfig,
      connections: [
        { name: 'My Bank', accounts: [] },
        { name: 'My Credit Card', accounts: [] },
      ],
    })
    expect(result.success).toBe(true)
  })
})

describe('StateSchema', () => {
  it('defaults to empty connections when not provided', () => {
    const result = StateSchema.safeParse({})
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.connections).toEqual({})
  })

  it('accepts a valid state with connections', () => {
    const result = StateSchema.safeParse({
      connections: {
        'My Bank': {
          refreshToken: 'live-token',
          accounts: {
            'tl-acc-1': { lastSyncDate: '2026-04-27' },
          },
        },
      },
    })
    expect(result.success).toBe(true)
  })

  it('defaults accounts to empty object when not provided', () => {
    const result = StateSchema.safeParse({
      connections: { 'My Bank': { refreshToken: 'token' } },
    })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.connections['My Bank']?.accounts).toEqual({})
  })

  it('rejects a connection with missing refreshToken', () => {
    const result = StateSchema.safeParse({
      connections: { 'My Bank': { accounts: {} } },
    })
    expect(result.success).toBe(false)
  })

  it('rejects an invalid lastSyncDate format', () => {
    const result = StateSchema.safeParse({
      connections: {
        'My Bank': {
          refreshToken: 'token',
          accounts: { 'tl-acc-1': { lastSyncDate: '24-04-2026' } },
        },
      },
    })
    expect(result.success).toBe(false)
  })
})

describe('EnvSchema', () => {
  const validEnv = {
    TRUELAYER_CLIENT_ID: 'client-id',
    TRUELAYER_CLIENT_SECRET_FILE: '/run/secrets/truelayer-client-secret',
    ACTUAL_SERVER_URL: 'http://localhost:5006',
    ACTUAL_SESSION_TOKEN_FILE: '/run/secrets/actual-session-token',
    ACTUAL_SYNC_ID_FILE: '/run/secrets/actual-sync-id',
  }

  it('accepts valid minimal env', () => {
    expect(EnvSchema.safeParse(validEnv).success).toBe(true)
  })

  it('accepts optional CRON_SCHEDULE, DEBUG, and TZ', () => {
    const result = EnvSchema.safeParse({
      ...validEnv,
      CRON_SCHEDULE: '0 */4 * * *',
      DEBUG: 'true',
      TZ: 'Europe/London',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an invalid ACTUAL_SERVER_URL', () => {
    expect(EnvSchema.safeParse({ ...validEnv, ACTUAL_SERVER_URL: 'not-a-url' }).success).toBe(false)
  })

  it('accepts an Actual password file instead of a session token file', () => {
    const { ACTUAL_SESSION_TOKEN_FILE: _, ...withoutSessionToken } = validEnv
    expect(
      EnvSchema.safeParse({ ...withoutSessionToken, ACTUAL_PASSWORD_FILE: '/run/secrets/actual-password' }).success,
    ).toBe(true)
  })

  it('rejects an invalid CRON_SCHEDULE', () => {
    expect(EnvSchema.safeParse({ ...validEnv, CRON_SCHEDULE: 'not-a-cron' }).success).toBe(false)
  })

  it('rejects missing TRUELAYER_CLIENT_ID', () => {
    const { TRUELAYER_CLIENT_ID: _, ...rest } = validEnv
    expect(EnvSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing TRUELAYER_CLIENT_SECRET_FILE', () => {
    const { TRUELAYER_CLIENT_SECRET_FILE: _, ...rest } = validEnv
    expect(EnvSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects missing Actual credential files', () => {
    const { ACTUAL_SESSION_TOKEN_FILE: _, ...rest } = validEnv
    expect(EnvSchema.safeParse(rest).success).toBe(false)
  })

  it('rejects both Actual credential files', () => {
    expect(EnvSchema.safeParse({ ...validEnv, ACTUAL_PASSWORD_FILE: '/run/secrets/actual-password' }).success).toBe(
      false,
    )
  })
})

describe('loadConfig secret hydration', () => {
  const originalEnv = process.env
  const fileConfig = {
    version: 2,
    connections: [{ name: 'My Bank', accounts: [] }],
  }
  const state = {
    connections: { 'My Bank': { refreshToken: 'refresh-token', accounts: {} } },
  }

  beforeEach(() => {
    process.env = {
      TRUELAYER_CLIENT_ID: 'client-id',
      TRUELAYER_CLIENT_SECRET_FILE: '/run/secrets/truelayer-client-secret',
      ACTUAL_SERVER_URL: 'http://localhost:5006',
      ACTUAL_SESSION_TOKEN_FILE: '/run/secrets/actual-session-token',
      ACTUAL_SYNC_ID_FILE: '/run/secrets/actual-sync-id',
    }
    vi.mocked(readJSON)
      .mockResolvedValueOnce(fileConfig as never)
      .mockResolvedValueOnce(state as never)
    vi.mocked(readSecretFile).mockImplementation(async (file) => {
      if (file.endsWith('truelayer-client-secret')) return 'client-secret'
      if (file.endsWith('actual-sync-id')) return 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
      return 'session-token'
    })
  })

  afterEach(() => {
    process.env = originalEnv
    vi.clearAllMocks()
  })

  it('hydrates a TrueLayer secret, Sync ID, and Actual session token', async () => {
    const config = await loadConfig()

    expect(config.secrets).toEqual({
      trueLayerClientSecret: 'client-secret',
      actualAuth: { sessionToken: 'session-token' },
      actualSyncId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    })
    expect(readSecretFile).toHaveBeenCalledTimes(3)
  })

  it('hydrates an Actual password when its protected file is configured', async () => {
    delete process.env.ACTUAL_SESSION_TOKEN_FILE
    process.env.ACTUAL_PASSWORD_FILE = '/run/secrets/actual-password'
    vi.mocked(readSecretFile).mockImplementation(async (file) => {
      if (file.endsWith('truelayer-client-secret')) return 'client-secret'
      if (file.endsWith('actual-sync-id')) return 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'
      return 'password'
    })

    const config = await loadConfig()

    expect(config.secrets.actualAuth).toEqual({ password: 'password' })
  })

  it('rejects an invalid Sync ID read from the protected file', async () => {
    vi.mocked(readSecretFile).mockImplementation(async (file) => {
      if (file.endsWith('actual-sync-id')) return 'not-a-uuid'
      return 'secret-value'
    })

    await expect(loadConfig()).rejects.toThrow('Invalid UUID')
  })
})
