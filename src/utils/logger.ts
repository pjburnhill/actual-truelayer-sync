import axios from 'axios'
import { currentTime } from './date'

function isJson(): boolean {
  return process.env.LOG_FORMAT !== 'text'
}

function formatPrefixes(prefixes: string[]): string {
  return prefixes.map((prefix) => `[${prefix}]`).join('')
}

function extractError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status
    const rawCode = typeof err.response?.data?.error === 'string' ? err.response.data.error : ''
    const code = /^[a-z][a-z0-9_-]{0,63}$/.test(rawCode) ? rawCode : 'request_failed'
    return `${status ?? 'network'}:${code}`
  }
  return err instanceof Error ? err.name : 'unknown_error'
}

export function log(prefixes: string[], message: string): void {
  if (isJson()) {
    console.log(JSON.stringify({ time: new Date().toISOString(), level: 'info', context: prefixes, message }))
    return
  }
  const prefix = prefixes.length > 0 ? `${formatPrefixes(prefixes)} ` : ''
  console.log(`${currentTime()} ${prefix}${message}`)
}

export function logError(prefixes: string[], message: string, err?: unknown): void {
  if (isJson()) {
    const entry: Record<string, unknown> = {
      time: new Date().toISOString(),
      level: 'error',
      context: prefixes,
      message,
    }
    if (err !== undefined) {
      entry.error = extractError(err)
    }
    console.error(JSON.stringify(entry))
    return
  }
  const prefix = prefixes.length > 0 ? `${formatPrefixes(prefixes)} ` : ''
  if (err === undefined) {
    console.error(`${currentTime()} ${prefix}${message}`)
    return
  }
  console.error(`${currentTime()} ${prefix}${message}`, extractError(err))
}
