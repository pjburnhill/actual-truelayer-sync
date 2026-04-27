const LOOKBACK_DAYS = 14

export function dateTimeToYMD(dateTime: string): string {
  return dateTime.slice(0, 10)
}

export function currentDate(): string {
  return dateTimeToYMD(new Date().toISOString())
}

export function computeFromDate(lastSyncDate: string): string {
  const d = new Date(lastSyncDate)
  d.setDate(d.getDate() - LOOKBACK_DAYS)
  return dateTimeToYMD(d.toISOString())
}
