import { createClient } from '@supabase/supabase-js'
import { loadLocalEnv } from '../load_env.mjs'

async function ensureWebSocket() {
  if (typeof WebSocket !== 'undefined') return
  const wsModule = await import('ws')
  globalThis.WebSocket = wsModule.WebSocket || wsModule.default
}

async function test() {
  loadLocalEnv()
  await ensureWebSocket()

  const url = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY

  console.log('Connecting to', url)
  const client = createClient(url, anonKey, {
    auth: { persistSession: false },
    realtime: {
      log_level: 'debug',
      params: {
        eventsPerSecond: 10
      }
    },
    global: {
      headers: { 'x-my-custom-header': 'my-app-name' }
    }
  })

  // enable verbose logging for realtime socket
  if (client.realtime.conn) {
    // some internal inspection
  }

  const channel = client.channel('test-channel')
  console.log('Subscribing...')

  channel.subscribe((status, err) => {
    console.log('Status:', status, err ? 'Error: ' + JSON.stringify(err) : '')

    if (status === 'SUBSCRIBED') {
      console.log('Success! Connected to realtime.')
      process.exit(0)
    }
  })

  setTimeout(() => {
    console.log('Timed out after 10s')
    process.exit(1)
  }, 10000)
}

test()
