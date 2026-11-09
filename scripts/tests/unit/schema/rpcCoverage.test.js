import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../../../..')
const schema = fs.readFileSync(path.join(ROOT, 'supabase/schema.sql'), 'utf8')

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(full)
    return /\.(js|jsx)$/.test(entry.name) ? [full] : []
  })
}

function rpcNamesCalledByApp() {
  const names = new Set()
  for (const file of sourceFiles(path.join(ROOT, 'src'))) {
    const text = fs.readFileSync(file, 'utf8')
    for (const match of text.matchAll(/\.rpc\(\s*['"]([a-z0-9_]+)['"]/g)) names.add(match[1])
  }
  return [...names].sort()
}

const names = rpcNamesCalledByApp()

describe('RPCs the app calls', () => {
  it('finds the app RPC calls', () => {
    expect(names.length).toBeGreaterThan(20)
  })

  it.each(names)('%s is defined in schema.sql', (name) => {
    expect(schema).toContain(`CREATE OR REPLACE FUNCTION public.${name}(`)
  })

  it.each(names)('%s is granted to authenticated', (name) => {
    const grant = new RegExp(`^GRANT ALL ON FUNCTION public\\.${name}\\(.*\\) TO authenticated;$`, 'm')
    expect(schema).toMatch(grant)
  })
})
