import { createClient } from '@supabase/supabase-js'
import { loadLocalEnv } from '../load_env.mjs'

async function main() {
  loadLocalEnv()
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY
  const supabase = createClient(url, key)

  const { data, error } = await supabase.rpc('check_liabilities_publication')
  if (error) {
    console.error('Error checking publication:', error)
  } else {
    console.log('Publication status:', data)
  }
}

main()
