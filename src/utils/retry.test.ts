import { describe, expect, it, vi } from 'vitest'
import { withTransientRetry } from './retry'

function httpError(status: number): Error {
  return Object.assign(new Error(`HTTP ${status}`), {
    isAxiosError: true,
    response: { status },
  })
}

function networkError(code: string): Error {
  return Object.assign(new Error(code), {
    isAxiosError: true,
    code,
  })
}

describe('withTransientRetry', () => {
  it.each([429, 503])('retries transient HTTP %s responses', async (status) => {
    const operation = vi.fn().mockRejectedValueOnce(httpError(status)).mockResolvedValueOnce('ok')

    await expect(withTransientRetry(operation, [0])).resolves.toBe('ok')
    expect(operation).toHaveBeenCalledTimes(2)
  })

  it.each(['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED'])('retries transient network error %s', async (code) => {
    const operation = vi.fn().mockRejectedValueOnce(networkError(code)).mockResolvedValueOnce('ok')

    await expect(withTransientRetry(operation, [0])).resolves.toBe('ok')
    expect(operation).toHaveBeenCalledTimes(2)
  })

  it.each([400, 401, 403])('does not retry non-transient HTTP %s responses', async (status) => {
    const error = httpError(status)
    const operation = vi.fn().mockRejectedValue(error)

    await expect(withTransientRetry(operation, [0, 0])).rejects.toBe(error)
    expect(operation).toHaveBeenCalledTimes(1)
  })

  it('makes no more than three attempts', async () => {
    const error = httpError(503)
    const operation = vi.fn().mockRejectedValue(error)

    await expect(withTransientRetry(operation, [0, 0])).rejects.toBe(error)
    expect(operation).toHaveBeenCalledTimes(3)
  })
})
