import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'
import { log, logError } from './logger'

vi.mock('axios')

describe('log — text format', () => {
  beforeEach(() => {
    process.env.LOG_FORMAT = 'text'
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => {
    delete process.env.LOG_FORMAT
    vi.restoreAllMocks()
  })

  it('includes a HH:MM:SS timestamp', () => {
    log([], 'hello')
    const output = vi.mocked(console.log).mock.calls[0][0] as string
    expect(output).toMatch(/^\d{2}:\d{2}:\d{2} hello$/)
  })

  it('formats a single prefix', () => {
    log(['My Bank'], 'Authenticating...')
    const output = vi.mocked(console.log).mock.calls[0][0] as string
    expect(output).toMatch(/\[My Bank] Authenticating\.\.\.$/)
  })

  it('formats multiple prefixes', () => {
    log(['My Bank', 'Current Account'], 'Fetching...')
    const output = vi.mocked(console.log).mock.calls[0][0] as string
    expect(output).toMatch(/\[My Bank]\[Current Account] Fetching\.\.\.$/)
  })
})

describe('log — json format', () => {
  beforeEach(() => {
    process.env.LOG_FORMAT = 'json'
    vi.spyOn(console, 'log').mockImplementation(() => {})
  })
  afterEach(() => {
    delete process.env.LOG_FORMAT
    vi.restoreAllMocks()
  })

  it('outputs a JSON object with level info', () => {
    log(['My Bank'], 'Authenticating...')
    const output = JSON.parse(vi.mocked(console.log).mock.calls[0][0] as string)
    expect(output).toMatchObject({ level: 'info', context: ['My Bank'], message: 'Authenticating...' })
  })

  it('includes an ISO timestamp', () => {
    log([], 'hello')
    const output = JSON.parse(vi.mocked(console.log).mock.calls[0][0] as string)
    expect(output.time).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })
})

describe('logError — text format', () => {
  beforeEach(() => {
    process.env.LOG_FORMAT = 'text'
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    delete process.env.LOG_FORMAT
    vi.restoreAllMocks()
  })

  it('logs message with prefix and no error', () => {
    logError(['My Bank'], 'Something failed')
    const output = vi.mocked(console.error).mock.calls[0][0] as string
    expect(output).toMatch(/\[My Bank] Something failed$/)
  })

  it('logs only the safe axios status and error class', () => {
    const sensitiveValues = [
      'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
      'account-123',
      'transaction-456',
      'Bearer secret-token',
      'Sensitive Payee',
      '123.45',
    ]
    const axiosError = Object.assign(new Error(sensitiveValues.join(' ')), {
      isAxiosError: true,
      response: {
        status: 400,
        data: { error: 'invalid_client', detail: sensitiveValues.join(' ') },
      },
    })
    vi.mocked(axios.isAxiosError).mockReturnValueOnce(true)

    logError(['My Bank'], 'Authentication failed:', axiosError)

    expect(console.error).toHaveBeenCalledWith(
      expect.stringMatching(/\[My Bank] Authentication failed:$/),
      '400:invalid_client',
    )
    const output = JSON.stringify(vi.mocked(console.error).mock.calls)
    for (const value of sensitiveValues) expect(output).not.toContain(value)
  })

  it('logs only an Error class, not its message', () => {
    vi.mocked(axios.isAxiosError).mockReturnValueOnce(false)
    logError(['My Bank'], 'Failed:', new Error('Bearer secret-token account-123'))
    expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/\[My Bank] Failed:$/), 'Error')
  })

  it('classifies unknown errors without logging their value', () => {
    vi.mocked(axios.isAxiosError).mockReturnValueOnce(false)
    logError(['My Bank'], 'Failed:', 'some string error')
    expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/\[My Bank] Failed:$/), 'unknown_error')
  })
})

describe('logError — json format', () => {
  beforeEach(() => {
    process.env.LOG_FORMAT = 'json'
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => {
    delete process.env.LOG_FORMAT
    vi.restoreAllMocks()
  })

  it('outputs a JSON object with level error', () => {
    logError(['My Bank'], 'Something failed')
    const output = JSON.parse(vi.mocked(console.error).mock.calls[0][0] as string)
    expect(output).toMatchObject({ level: 'error', context: ['My Bank'], message: 'Something failed' })
    expect(output.error).toBeUndefined()
  })

  it('includes only the error class when provided', () => {
    vi.mocked(axios.isAxiosError).mockReturnValueOnce(false)
    logError(['My Bank'], 'Failed:', new Error('transaction-456 Sensitive Payee 123.45'))
    const output = JSON.parse(vi.mocked(console.error).mock.calls[0][0] as string)
    expect(output).toMatchObject({ level: 'error', message: 'Failed:', error: 'Error' })
    expect(JSON.stringify(output)).not.toContain('transaction-456')
    expect(JSON.stringify(output)).not.toContain('Sensitive Payee')
    expect(JSON.stringify(output)).not.toContain('123.45')
  })
})
