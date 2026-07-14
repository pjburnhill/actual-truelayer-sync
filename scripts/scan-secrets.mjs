import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
  encoding: 'utf8',
})
  .split('\0')
  .filter((file) => file && fs.existsSync(file))
const uuid = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i
const privateKey = /-----BEGIN [A-Z ]*PRIVATE KEY-----/
const jwtBearer = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/
const secretAssignment =
  /\b(?:TRUELAYER_CLIENT_SECRET|ACTUAL_SESSION_TOKEN|ACTUAL_SERVER_PASSWORD|ACTUAL_TOKEN|ACTUAL_PASSWORD)(?!_FILE)\b["']?\s*[:=]\s*(.+)/

const findings = []
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8')
  const allowsDummyValues = /(?:^|\/)(?:[^/]*\.test\.[^/]+|[^/]*example[^/]*)$/i.test(file)

  if (privateKey.test(content)) findings.push(`${file}: private key header`)
  if (jwtBearer.test(content)) findings.push(`${file}: JWT-like bearer value`)
  if (!allowsDummyValues && uuid.test(content)) findings.push(`${file}: UUID value`)

  if (!allowsDummyValues) {
    for (const line of content.split('\n')) {
      const match = line.match(secretAssignment)
      if (!match) continue
      const value = match[1].trim().replace(/^['"]|['"],?$/g, '')
      if (value && !value.startsWith('$') && !value.startsWith('[') && !value.startsWith('<')) {
        findings.push(`${file}: credential assignment`)
        break
      }
    }
  }
}

if (findings.length > 0) {
  console.error(findings.join('\n'))
  process.exit(1)
}

console.log(`Secret scan passed for ${files.length} repository files.`)
