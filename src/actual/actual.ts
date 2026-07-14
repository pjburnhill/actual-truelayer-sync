import actual from '@actual-app/api'
import type { ActualAuth } from '../config/schema'
import { logError } from '../utils/logger'

interface InitOptions {
  serverURL: string
  auth: ActualAuth
  syncId: string
  verbose: boolean
}

export async function initActual(options: InitOptions): Promise<void> {
  await (
    actual.init as (options: {
      serverURL: string
      password?: string
      sessionToken?: string
      verbose: boolean
      dataDir: string
    }) => Promise<void>
  )({
    serverURL: options.serverURL,
    ...options.auth,
    verbose: options.verbose,
    dataDir: './data',
  })
  await actual.downloadBudget(options.syncId)
}

export async function importTransactions(
  accountId: string,
  transactions: Parameters<typeof actual.importTransactions>[1],
): Promise<{ added: string[]; updated: string[] }> {
  const result = await actual.importTransactions(accountId, transactions)
  if (result.errors.length > 0) {
    logError(['Actual'], `Rejected ${result.errors.length} transaction record${result.errors.length === 1 ? '' : 's'}.`)
    throw new Error('ActualImportError')
  }
  return { added: result.added, updated: result.updated }
}

export async function getAccounts(): Promise<Array<{ id: string; name: string; closed: boolean }>> {
  return actual.getAccounts()
}

export async function shutdownActual(): Promise<void> {
  await actual.shutdown()
}
