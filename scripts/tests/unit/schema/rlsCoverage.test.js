import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../../../..')
const schema = fs.readFileSync(path.join(ROOT, 'supabase/schema.sql'), 'utf8')
const migrationsDir = path.join(ROOT, 'supabase/migrations')

const tables = [...schema.matchAll(/^CREATE TABLE IF NOT EXISTS public\.(\w+) \(/gm)].map((m) => m[1]).sort()

function tablesCreatedByMigrations() {
  const dropped = new Set()
  const created = new Set()
  for (const file of fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8')
    for (const m of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?"?(\w+)"?/gi)) created.add(m[1])
    for (const m of sql.matchAll(/DROP TABLE (?:IF EXISTS )?(?:public\.)?"?(\w+)"?/gi)) dropped.add(m[1])
  }
  return [...created].filter((name) => !dropped.has(name))
}

describe('row level security in schema.sql', () => {
  it('finds the app tables', () => {
    expect(tables.length).toBeGreaterThan(15)
  })

  it.each(tables)('%s has row level security on', (name) => {
    const rls = new RegExp(`^ALTER TABLE (?:ONLY )?public\\.${name} ENABLE ROW LEVEL SECURITY;$`, 'm')
    expect(schema).toMatch(rls)
  })

  it.each(tables)('%s has at least one policy', (name) => {
    const policy = new RegExp(`^CREATE POLICY "[^"]+" ON public\\.${name} `, 'm')
    expect(schema).toMatch(policy)
  })

  it('includes every table a migration creates', () => {
    expect(tablesCreatedByMigrations().filter((name) => !tables.includes(name))).toEqual([])
  })
})
