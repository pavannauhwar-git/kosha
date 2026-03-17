/**
 * useBudgets
 *
 * Manages per-category monthly spend limits.
 * Budgets are stored once and apply to every month — set it, forget it.
 *
 * Returns: { budgets: { [categoryId]: amount }, loading, setBudget, removeBudget }
 *
 * setBudget(category, amount) — upserts via Supabase ON CONFLICT
 * removeBudget(category)      — deletes the row for that category
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ── Simple module-level cache ─────────────────────────────────────────────
// Budgets change very rarely — 5 min TTL is generous
const CACHE_KEY = 'budgets'
const TTL_MS    = 5 * 60_000
let   _cache    = null   // { map: { [category]: amount }, ts: number } | null

function getCached()      { return _cache && Date.now() - _cache.ts < TTL_MS ? _cache : null }
function setCached(map)   { _cache = { map, ts: Date.now() } }
function invalidate()     { _cache = null }

// ── Session helper ────────────────────────────────────────────────────────
async function getUserId() {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.id) throw new Error('Not signed in')
  return session.user.id
}

// ── Hook ──────────────────────────────────────────────────────────────────
export function useBudgets() {
  const [budgets, setBudgetsState] = useState(() => getCached()?.map || {})
  const [loading, setLoading]      = useState(() => !getCached())

  const fetch = useCallback(async (force = false) => {
    const cached = getCached()
    if (cached) {
      setBudgetsState(cached.map)
      setLoading(false)
      if (!force) return
    } else {
      setLoading(true)
    }

    try {
      const { data: rows } = await supabase
        .from('budgets')
        .select('category, amount')

      if (rows) {
        const map = Object.fromEntries(rows.map(r => [r.category, +r.amount]))
        setCached(map)
        setBudgetsState(map)
      }
    } catch {
      // Network failure — cached data stays, no spinner
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetch() }, [fetch])

  // Re-fetch when app returns from background
  useEffect(() => {
    const handler = () => { if (document.visibilityState === 'visible') fetch() }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [fetch])

  // ── setBudget: upsert a category budget ───────────────────────────────
  const setBudget = useCallback(async (category, amount) => {
    const user_id = await getUserId()

    // Optimistic update
    setBudgetsState(prev => ({ ...prev, [category]: amount }))
    invalidate()

    const { error } = await supabase
      .from('budgets')
      .upsert({ user_id, category, amount }, { onConflict: 'user_id,category' })

    if (error) {
      // Roll back optimistic update on failure
      fetch(true)
      throw error
    }

    fetch(true)  // re-sync to confirm
  }, [fetch])

  // ── removeBudget: delete a category budget ────────────────────────────
  const removeBudget = useCallback(async (category) => {
    const user_id = await getUserId()

    // Optimistic update
    setBudgetsState(prev => {
      const next = { ...prev }
      delete next[category]
      return next
    })
    invalidate()

    await supabase
      .from('budgets')
      .delete()
      .eq('category', category)
      .eq('user_id', user_id)

    fetch(true)
  }, [fetch])

  return { budgets, loading, setBudget, removeBudget }
}
