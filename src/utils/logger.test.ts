import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'
import { log, logError } from './logger'

vi.mock('axios')

describe('log', () => {
  beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}))
  afterEach(() => vi.restoreAllMocks())

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

describe('logError', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => {}))
  afterEach(() => vi.restoreAllMocks())

  it('logs message with prefix and no error', () => {
    logError(['My Bank'], 'Something failed')
    const output = vi.mocked(console.error).mock.calls[0][0] as string
    expect(output).toMatch(/\[My Bank] Something failed$/)
  })

  it('logs axios error response data', () => {
    const axiosError = Object.assign(new Error('Bad Request'), {
      isAxiosError: true,
      response: { data: { error: 'invalid_client' } },
    })
    vi.mocked(axios.isAxiosError).mockReturnValueOnce(true)

    logError(['My Bank'], 'Authentication failed:', axiosError)

    expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/\[My Bank] Authentication failed:$/), {
      error: 'invalid_client',
    })
  })

  it('logs Error message', () => {
    vi.mocked(axios.isAxiosError).mockReturnValueOnce(false)

    logError(['My Bank'], 'Failed:', new Error('Network error'))

    expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/\[My Bank] Failed:$/), 'Network error')
  })

  it('logs unknown errors directly', () => {
    vi.mocked(axios.isAxiosError).mockReturnValueOnce(false)

    logError(['My Bank'], 'Failed:', 'some string error')

    expect(console.error).toHaveBeenCalledWith(expect.stringMatching(/\[My Bank] Failed:$/), 'some string error')
  })
})
