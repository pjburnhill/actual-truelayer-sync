import axios from 'axios'

const TRANSIENT_STATUSES = new Set([429, 500, 502, 503, 504])
const TRANSIENT_CODES = new Set(['ECONNRESET', 'ETIMEDOUT', 'ECONNABORTED'])

function isTransient(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false
  return TRANSIENT_STATUSES.has(error.response?.status ?? 0) || TRANSIENT_CODES.has(error.code ?? '')
}

export async function withTransientRetry<T>(operation: () => Promise<T>, delays = [250, 1000]): Promise<T> {
  let lastError: unknown
  for (let attempt = 0; attempt <= delays.length; attempt += 1) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      if (!isTransient(error) || attempt === delays.length) throw error
      await new Promise((resolve) => setTimeout(resolve, delays[attempt]))
    }
  }
  throw lastError
}
