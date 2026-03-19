import { createClient } from '@supabase/supabase-js'
import { loadLocalEnv } from './load_env.mjs'

function requireEnv(name) {
  const value = process.env[name]
  if (!value) throw new Error(`Missing env var: ${name}`)
  return value
}

function makeClient(url, anonKey) {
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

async function ensureWebSocket() {
  if (typeof WebSocket !== 'undefined') return

  try {
    const wsModule = await import('ws')
    globalThis.WebSocket = wsModule.WebSocket || wsModule.default
  } catch {
    throw new Error('WebSocket is not available. Use Node 22+ or add the ws package.')
  }
}

async function signIn(client, email, password, label) {
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`${label} sign-in failed: ${error.message}`)
  if (!data?.user?.id) throw new Error(`${label} sign-in returned no user id`)
  return data.user
}

function waitForSubscribed(channel, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timed out waiting for realtime channel subscription'))
    }, timeoutMs)

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        clearTimeout(timer)
        resolve()
      }
      if (status === 'TIMED_OUT' || status === 'CHANNEL_ERROR' || status === 'CLOSED') {
        clearTimeout(timer)
        reject(new Error(`Realtime channel status: ${status}`))
      }
    })
  })
}

async function main() {
  loadLocalEnv()

  await ensureWebSocket()

  const MAX_ATTEMPTS = 3
  const EVENT_TIMEOUT_MS = 30000

  const url = requireEnv('VITE_SUPABASE_URL')
  const anonKey = requireEnv('VITE_SUPABASE_ANON_KEY')
  const email = requireEnv('E2E_SESSION_EMAIL')
  const password = requireEnv('E2E_SESSION_PASSWORD')

  const actorClient = makeClient(url, anonKey)
  const listenerClient = makeClient(url, anonKey)

  console.log('Signing in actor and listener sessions...')
  const actorUser = await signIn(actorClient, email, password, 'Actor session')
  await signIn(listenerClient, email, password, 'Listener session')

  const channelName = `e2e-liabilities-${Date.now()}`
  let realtimeChannel = null
  let insertedLiabilityId = null

  try {
    let delivered = false

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      let attemptChannel = null
      let attemptLiabilityId = null

      try {
        const eventPromise = new Promise((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error(`No liabilities realtime event received within ${EVENT_TIMEOUT_MS / 1000} seconds`))
          }, EVENT_TIMEOUT_MS)

          attemptChannel = listenerClient
            .channel(`${channelName}-${attempt}`)
            .on(
              'postgres_changes',
              { event: 'INSERT', schema: 'public', table: 'liabilities' },
              (payload) => {
                const payloadId = payload?.new?.id
                if (!attemptLiabilityId || payloadId !== attemptLiabilityId) return
                clearTimeout(timer)
                resolve(payload)
              }
            )
        })

        console.log(`Subscribing to liabilities realtime events (attempt ${attempt}/${MAX_ATTEMPTS})...`)
        await waitForSubscribed(attemptChannel)

        const description = `E2E realtime liability ${Date.now()}-${attempt}`
        const dueDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

        console.log('Inserting liability from actor session...')
        const { data: liability, error: insertError } = await actorClient
          .from('liabilities')
          .insert([{
            description,
            amount: 1,
            due_date: dueDate,
            is_recurring: false,
            paid: false,
            user_id: actorUser.id,
          }])
          .select('id')
          .single()

        if (insertError) throw new Error(`Liability insert failed: ${insertError.message}`)

        attemptLiabilityId = liability.id
        await eventPromise

        realtimeChannel = attemptChannel
        insertedLiabilityId = attemptLiabilityId
        delivered = true
        break
      } catch (error) {
        if (attemptLiabilityId) {
          await actorClient.from('liabilities').delete().eq('id', attemptLiabilityId)
        }
        if (attemptChannel) {
          await listenerClient.removeChannel(attemptChannel)
        }

        if (attempt === MAX_ATTEMPTS) {
          throw new Error(`${error.message} after ${MAX_ATTEMPTS} attempts`)
        }

        console.log(`Attempt ${attempt} failed: ${error.message}. Retrying...`)
      }
    }

    if (!delivered) {
      throw new Error('Realtime liabilities event was not delivered')
    }

    console.log('PASS: Realtime liabilities event was received by second session.')
  } finally {
    if (insertedLiabilityId) {
      await actorClient.from('liabilities').delete().eq('id', insertedLiabilityId)
    }

    if (realtimeChannel) {
      await listenerClient.removeChannel(realtimeChannel)
    }

    await Promise.all([
      actorClient.auth.signOut(),
      listenerClient.auth.signOut(),
    ])
  }
}

main().catch((error) => {
  console.error('FAIL: test:liabilities-realtime')
  console.error(error.message)
  process.exit(1)
})
