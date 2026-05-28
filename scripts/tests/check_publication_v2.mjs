/**
 * check_publication_v2.mjs
 *
 * Verifies that the required tables are published to supabase_realtime.
 *
 * Run: node scripts/tests/check_publication_v2.mjs
 */

import { createClient } from '@supabase/supabase-js'
import assert from 'assert'

const supabaseUrl = process.env.VITE_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('SKIP: Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env')
  process.exit(process.env.CI ? 1 : 0)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const REQUIRED_TABLES = [
  'transactions',
  'liabilities',
  'loans',
  'split_groups',
  'split_group_members',
  'split_expenses',
  'split_settlements'
]

async function run() {
  console.log('Checking supabase_realtime publication...')

  const { data, error } = await supabase
    .from('pg_publication_tables')
    .select('tablename')
    .eq('pubname', 'supabase_realtime')

  if (error) {
    console.error('FAIL:', error.message)
    process.exit(1)
  }

  const publishedTables = data.map(r => r.tablename)
  const missing = REQUIRED_TABLES.filter(t => !publishedTables.includes(t))

  if (missing.length > 0) {
    console.error(`FAIL: Missing tables in realtime publication: ${missing.join(', ')}`)
    process.exit(1)
  }

  console.log('PASS: All required tables are published to realtime')
}

run()
