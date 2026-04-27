import fs from 'fs/promises'
import path from 'path'
import { Config, EnvSchema, FileConfigSchema } from './schema'

const CONFIG_PATH = path.join(__dirname, '..', 'data', 'config.json')

export async function loadConfig(): Promise<Config> {
  // Validate environment variables
  const envResult = EnvSchema.safeParse(process.env)
  if (!envResult.success) {
    const issues = envResult.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')
    throw new Error(`Missing or invalid environment variables:\n${issues}`)
  }

  // Validate config file
  let raw: unknown
  try {
    const text = await fs.readFile(CONFIG_PATH, 'utf-8')
    raw = JSON.parse(text)
  } catch (err) {
    throw new Error(`Failed to read config at ${CONFIG_PATH}: ${String(err)}`)
  }

  const fileResult = FileConfigSchema.safeParse(raw)
  if (!fileResult.success) {
    throw new Error(`Invalid config file:\n${fileResult.error.toString()}`)
  }

  return { ...fileResult.data, env: envResult.data }
}

export async function writeConfig(config: Config): Promise<void> {
  const { env: _, ...fileConfig } = config
  const tmpPath = `${CONFIG_PATH}.tmp`
  await fs.writeFile(tmpPath, JSON.stringify(fileConfig, null, 2), 'utf-8')
  await fs.rename(tmpPath, CONFIG_PATH)
  console.log('Config saved.')
}
