import crypto from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { consumeInviteToken } from '../src/lib/invites.js'
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

async function signIn(client, email, password, label) {
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) throw new Error(`${label} sign-in failed: ${error.message}`)
  if (!data?.user?.id) throw new Error(`${label} sign-in returned no user id`)
  return data.user
}

async function main() {
  loadLocalEnv()

  const url = requireEnv('VITE_SUPABASE_URL')
  const anonKey = requireEnv('VITE_SUPABASE_ANON_KEY')
  const creatorEmail = requireEnv('E2E_CREATOR_EMAIL')
  const creatorPassword = requireEnv('E2E_CREATOR_PASSWORD')
  const joinerEmail = requireEnv('E2E_JOINER_EMAIL')
  const joinerPassword = requireEnv('E2E_JOINER_PASSWORD')

  const creatorClient = makeClient(url, anonKey)
  const joinerClient = makeClient(url, anonKey)

  console.log('Signing in creator account...')
  const creatorUser = await signIn(creatorClient, creatorEmail, creatorPassword, 'Creator')

  console.log('Signing in joiner account...')
  const joinerUser = await signIn(joinerClient, joinerEmail, joinerPassword, 'Joiner')

  if (creatorUser.id === joinerUser.id) {
    throw new Error('Creator and joiner must be different users for a valid join-flow test')
  }

  const inviteToken = `e2e-${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`
  const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:5173'
  const joinUrl = `${appBaseUrl}/join/${inviteToken}`

  console.log('Creating invite token...')
  const { error: createError } = await creatorClient
    .from('invites')
    .insert({ token: inviteToken, created_by: creatorUser.id })

  if (createError) throw new Error(`Invite insert failed: ${createError.message}`)

  console.log(`Join URL generated: ${joinUrl}`)
  console.log('Simulating onboarding invite consumption with joiner session...')

  const consumeResult = await consumeInviteToken({
    supabaseClient: joinerClient,
    inviteToken,
    userId: joinerUser.id,
  })

  if (!consumeResult.consumed) {
    throw new Error(`Invite token was not consumed: ${consumeResult.reason}`)
  }

  const { data: inviteRow, error: verifyError } = await joinerClient
    .from('invites')
    .select('token, used_by, used_at')
    .eq('token', inviteToken)
    .single()

  if (verifyError) throw new Error(`Invite verification failed: ${verifyError.message}`)
  if (inviteRow.used_by !== joinerUser.id) {
    throw new Error(`Invite used_by mismatch. Expected ${joinerUser.id}, got ${inviteRow.used_by}`)
  }
  if (!inviteRow.used_at) {
    throw new Error('Invite used_at was not set')
  }

  await Promise.all([
    creatorClient.auth.signOut(),
    joinerClient.auth.signOut(),
  ])

  console.log('PASS: Join flow invite was consumed and marked used by joiner.')
}

main().catch((error) => {
  console.error('FAIL: test:join-flow')
  console.error(error.message)
  process.exit(1)
})
