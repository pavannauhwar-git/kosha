import fs from 'node:fs'
import path from 'node:path'

function parseValue(raw) {
  const value = raw.trim()
  if (!value) return ''

  const quote = value[0]
  if ((quote === '"' || quote === "'") && value[value.length - 1] === quote) {
    return value.slice(1, -1)
  }

  return value
}

function applyEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return

  const content = fs.readFileSync(filePath, 'utf8')

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue

    const idx = trimmed.indexOf('=')
    if (idx <= 0) continue

    const key = trimmed.slice(0, idx).trim()
    const rawValue = trimmed.slice(idx + 1)

    if (!key || process.env[key] != null) continue
    process.env[key] = parseValue(rawValue)
  }
}

export function loadLocalEnv(cwd = process.cwd()) {
  applyEnvFile(path.join(cwd, '.env'))
  applyEnvFile(path.join(cwd, '.env.local'))
}
