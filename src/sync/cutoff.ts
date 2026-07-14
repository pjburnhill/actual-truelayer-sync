import type { TrueLayerTransaction } from '../truelayer/types'

export function filterTransactionsByStartDate(
  transactions: TrueLayerTransaction[],
  importStartDate: string,
): TrueLayerTransaction[] {
  return transactions.filter((transaction) => transaction.timestamp.slice(0, 10) >= importStartDate)
}
