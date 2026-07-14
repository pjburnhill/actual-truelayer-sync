import path from 'node:path'
import { assertHealthy } from './runtime/health'

export async function runHealthcheck(healthPath: string): Promise<void> {
  await assertHealthy(healthPath)
}

if (require.main === module) {
  const healthPath = process.argv[2] ?? path.resolve(__dirname, '..', 'data', 'health.json')
  void runHealthcheck(healthPath).catch(() => {
    process.exitCode = 1
  })
}
