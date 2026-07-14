import axios from 'axios'
import { importTransactions } from '../actual/actual'
import { getAccountTransactions, getCardTransactions } from '../truelayer/truelayer'
import { transformTransactions } from '../transform/transform'
import { computeFromDate } from '../utils/date'
import { resolveIsCard } from '../utils/account'
import { buildImportSummary } from '../utils/logging'
import { log, logError } from '../utils/logger'
import { filterTransactionsByStartDate } from './cutoff'
import type { Account, Connection } from '../config/schema'
import type { HealthReason } from '../runtime/health'
import type { TrueLayerAccount, TrueLayerCard, TrueLayerTransaction } from '../truelayer/types'

interface SyncAccountOptions {
  configAccount: Account
  connection: Connection
  accessToken: string
  trueLayerAccountsById: Map<string, TrueLayerAccount | TrueLayerCard>
  includeCategoryInNotes: boolean
  lookbackDays: number
  lastSyncDate?: string
  dryRun?: boolean
  onFailure: (reason: HealthReason) => void
}

export async function syncAccount({
  configAccount,
  connection,
  accessToken,
  trueLayerAccountsById,
  includeCategoryInNotes,
  lookbackDays,
  lastSyncDate,
  dryRun = false,
  onFailure,
}: SyncAccountOptions): Promise<boolean> {
  const prefix = [connection.name, configAccount.friendlyName]
  const fromDate = lastSyncDate ? computeFromDate(lastSyncDate, lookbackDays) : undefined

  log(prefix, `Fetching transactions${fromDate ? ` since ${fromDate}` : ''}...`)

  let trueLayerTransactions: TrueLayerTransaction[]
  try {
    const isCard = resolveIsCard(configAccount, connection)
    trueLayerTransactions = isCard
      ? await getCardTransactions(accessToken, configAccount.trueLayerId, fromDate)
      : await getAccountTransactions(accessToken, configAccount.trueLayerId, fromDate)
  } catch (err) {
    logError(prefix, 'Failed to fetch transactions:', err)
    const status = axios.isAxiosError(err) ? err.response?.status : undefined
    onFailure(status === 401 || status === 403 ? 'consent_expired' : 'sync_failed')
    return false
  }

  const eligibleTransactions = filterTransactionsByStartDate(trueLayerTransactions, configAccount.importStartDate)
  const trueLayerAccount = trueLayerAccountsById.get(configAccount.trueLayerId)
  const transactions = transformTransactions(
    eligibleTransactions,
    configAccount,
    trueLayerAccount,
    includeCategoryInNotes,
  )

  if (transactions.length === 0) {
    log(prefix, '└ No transactions.')
    return false
  }

  log(prefix, `└ Found ${transactions.length} transactions.`)
  const dates = eligibleTransactions.map((t) => t.timestamp).sort()
  const from = dates[0].slice(0, 10)
  const to = dates[dates.length - 1].slice(0, 10)

  if (dryRun) {
    log(prefix, `└ [DRY RUN] Would import ${transactions.length} transactions (${from} → ${to}).`)
    return false
  }

  try {
    const result = await importTransactions(configAccount.actualId, transactions)
    log(prefix, `└ ${buildImportSummary(result.added.length, result.updated.length)} (${from} → ${to}).`)
  } catch (err) {
    logError(prefix, 'Failed to import transactions:', err)
    onFailure('sync_failed')
    return false
  }

  return true
}
