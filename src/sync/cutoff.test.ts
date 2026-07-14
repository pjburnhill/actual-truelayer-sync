import { describe, expect, it } from 'vitest'
import type { TrueLayerTransaction } from '../truelayer/types'
import { filterTransactionsByStartDate } from './cutoff'

function transaction(transactionId: string, date: string): TrueLayerTransaction {
  return {
    transaction_id: transactionId,
    timestamp: `${date}T12:00:00Z`,
    description: 'Test transaction',
    amount: 1,
    currency: 'GBP',
    transaction_type: 'DEBIT',
    transaction_category: 'PURCHASE',
    transaction_classification: [],
  }
}

describe('filterTransactionsByStartDate', () => {
  it('keeps transactions on and after the inclusive import date', () => {
    const transactions = [
      transaction('before-boundary', '2026-07-14'),
      transaction('on-boundary', '2026-07-15'),
      transaction('after-boundary', '2026-07-16'),
    ]

    expect(filterTransactionsByStartDate(transactions, '2026-07-15').map((item) => item.transaction_id)).toEqual([
      'on-boundary',
      'after-boundary',
    ])
  })

  it('returns an empty array for an empty provider response', () => {
    expect(filterTransactionsByStartDate([], '2026-07-15')).toEqual([])
  })
})
