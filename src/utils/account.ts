import { Account, Connection } from '../config/schema'

export function resolveIsCard(configAccount: Account, connection: Connection): boolean {
  return configAccount.isCard ?? connection.isCard ?? false
}
