import { importTransactions } from '../actual/actual'
import { getAccountTransactions, getCardTransactions } from '../truelayer/truelayer'
import { transformTransactions } from '../transform/transform'
import { computeFromDate, dateTimeToYMD } from '../utils/date'
import { resolveIsCard } from '../utils/account'
import { buildImportSummary, logNetworkError } from '../utils/logging'
import type { Account, Connection } from '../config/schema'
import type { TrueLayerAccount, TrueLayerCard, TrueLayerTransaction } from '../truelayer/types'

export async function syncAccount(
  configAccount: Account,
  connection: Connection,
  accessToken: string,
  trueLayerAccountsById: Map<string, TrueLayerAccount | TrueLayerCard>,
  includeCategoryInNotes: boolean,
): Promise<boolean> {
  const prefix = `[${connection.name}][${configAccount.friendlyName}]`
  const fromDate = configAccount.lastSyncDate ? computeFromDate(configAccount.lastSyncDate) : undefined

  console.log(`${prefix} Fetching transactions${fromDate ? ` since ${fromDate}` : ''}...`)

  const isCard = resolveIsCard(configAccount, connection)
  let trueLayerTransactions: TrueLayerTransaction[]
  try {
    trueLayerTransactions = isCard
      ? await getCardTransactions(accessToken, configAccount.trueLayerId, fromDate)
      : await getAccountTransactions(accessToken, configAccount.trueLayerId, fromDate)
  } catch (err) {
    logNetworkError(`${prefix} Failed to fetch transactions:`, err)
    return false
  }

  const trueLayerAccount = trueLayerAccountsById.get(configAccount.trueLayerId)
  const transactions = transformTransactions(
    trueLayerTransactions,
    configAccount,
    trueLayerAccount,
    includeCategoryInNotes,
  )

  if (transactions.length === 0) {
    console.log(`${prefix} └ No transactions.`)
    return false
  }

  console.log(`${prefix} └ Found ${transactions.length} transactions.`)
  const dates = trueLayerTransactions.map((t) => t.timestamp).sort()
  const from = dateTimeToYMD(dates[0])
  const to = dateTimeToYMD(dates[dates.length - 1])

  try {
    const result = await importTransactions(configAccount.actualId, transactions)
    console.log(`${prefix} └ ${buildImportSummary(result.added.length, result.updated.length)} (${from} → ${to}).`)
  } catch (err) {
    logNetworkError(`${prefix} Failed to import transactions:`, err)
    return false
  }

  return true
}
