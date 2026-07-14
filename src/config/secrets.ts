import fs from 'node:fs/promises'

export async function readSecretFile(file: string, label: string): Promise<string> {
  const stat = await fs.lstat(file)
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`${label} must be a regular file`)
  }
  if ((stat.mode & 0o777) !== 0o600) {
    throw new Error(`${label} must have mode 0600`)
  }

  const value = (await fs.readFile(file, 'utf8')).trim()
  if (!value) {
    throw new Error(`${label} is empty`)
  }
  return value
}
