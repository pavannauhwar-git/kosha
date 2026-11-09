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

// Live tests sign in and write real rows. They refuse to run unless
// E2E_EXPECTED_PROJECT_REF names the Supabase project VITE_SUPABASE_URL
// points at, so a stray .env can't aim them at the wrong database.
export function assertExpectedSupabaseProject() {
  const expected = String(process.env.E2E_EXPECTED_PROJECT_REF || '').trim()
  if (!expected) {
    throw new Error('Missing env var: E2E_EXPECTED_PROJECT_REF (the Supabase project ref these live tests may use)')
  }
  let host = ''
  try {
    host = new URL(process.env.VITE_SUPABASE_URL || '').hostname
  } catch {
    host = ''
  }
  if (host.split('.')[0] !== expected) {
    throw new Error(`VITE_SUPABASE_URL (${host || 'invalid'}) is not project ${expected}. Refusing to run live tests.`)
  }
}

export function loadLocalEnv(cwd = process.cwd()) {
  // First value wins, so .env.local overrides .env.
  applyEnvFile(path.join(cwd, '.env.local'))
  applyEnvFile(path.join(cwd, '.env'))
  assertExpectedSupabaseProject()
}
