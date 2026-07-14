import path from 'path'
import { z } from 'zod'
import { log, logError } from '../utils/logger'
import { Config, EnvSchema, FileConfig, FileConfigSchema, State, StateSchema } from './schema'
import { readJSON, writeJSON } from '../utils/file'
import { readSecretFile } from './secrets'

const CONFIG_PATH = path.resolve(__dirname, '..', '..', 'data', 'config.json')
const STATE_PATH = path.resolve(__dirname, '..', '..', 'data', 'state.json')
const CURRENT_CONFIG_VERSION = 2

export async function loadConfig(): Promise<Config> {
  // Validate environment variables
  const envResult = EnvSchema.safeParse(process.env)
  if (!envResult.success) {
    const issues = envResult.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Missing or invalid environment variables:\n${issues}`)
  }

  // Load and validate config file
  const rawConfig = await readJSON<FileConfig>(CONFIG_PATH)
  const fileResult = FileConfigSchema.safeParse(rawConfig)
  if (!fileResult.success) {
    const issues = fileResult.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Invalid config file:\n${issues}\n\nSee config.example.json for the expected format.`)
  }

  // Verify versions
  if (fileResult.data.version !== CURRENT_CONFIG_VERSION) {
    throw new Error(
      `Config version mismatch: found v${fileResult.data.version}, expected v${CURRENT_CONFIG_VERSION}.\n` +
        `See MIGRATION.md for upgrade instructions.`,
    )
  }

  // Load and validate state file
  const rawState = await readJSON<State>(STATE_PATH)
  const stateResult = StateSchema.safeParse(rawState)
  if (!stateResult.success) {
    const issues = stateResult.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Invalid state file:\n${issues}\n\nSee state.example.json for the expected format.`)
  }

  // Warn about connections with no state entry
  for (const connection of fileResult.data.connections) {
    if (!stateResult.data.connections[connection.name]) {
      logError(['Config'], `No state entry for connection "${connection.name}" — it will be skipped during sync.`)
    }
  }

  const trueLayerClientSecret = await readSecretFile(
    envResult.data.TRUELAYER_CLIENT_SECRET_FILE,
    'TrueLayer client secret',
  )
  const actualSyncId = await readSecretFile(envResult.data.ACTUAL_SYNC_ID_FILE, 'Actual Sync ID')
  const actualAuth = envResult.data.ACTUAL_SESSION_TOKEN_FILE
    ? {
        sessionToken: await readSecretFile(envResult.data.ACTUAL_SESSION_TOKEN_FILE, 'Actual session token'),
      }
    : { password: await readSecretFile(envResult.data.ACTUAL_PASSWORD_FILE!, 'Actual password') }

  return {
    ...fileResult.data,
    env: envResult.data,
    state: stateResult.data,
    secrets: {
      trueLayerClientSecret,
      actualAuth,
      actualSyncId: z.uuid().parse(actualSyncId),
    },
  }
}

export async function writeState(config: Config): Promise<void> {
  await writeJSON(STATE_PATH, config.state)
  log(['Config'], 'State saved.')
}
