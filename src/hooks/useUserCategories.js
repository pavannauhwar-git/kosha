import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { queryClient } from '../lib/queryClient'
import { getAuthUserId } from '../lib/authStore'
import { useActiveWallet, getActiveWalletUserId } from '../lib/walletStore'
import { traceQuery } from '../lib/queryTrace'
import { getCategory, registerCustomCategories } from '../lib/categories'
import { buildCategorySlug, categoryLabelError, categoryLabelKey, normalizeCategoryLabel } from '../lib/categorySlug'

const categoryQueryKey = (userId) => ['userCategories', userId]
const COLUMNS = 'id, type, label, slug, icon, color, bg, archived, created_at'
const MAX_CUSTOM_CATEGORIES = 15
const NO_CATEGORIES = []

const isActive = (category) => !category?.archived

// Type-aware palettes keep custom categories aligned with semantic color intent.
const CUSTOM_COLORS_BY_TYPE = {
  expense: [
    { color: '#E11D48', bg: '#FFF1F2' },
    { color: '#EA580C', bg: '#FFF7ED' },
    { color: '#DC2626', bg: '#FEF2F2' },
    { color: '#B45309', bg: '#FFFBEB' },
    { color: '#BE185D', bg: '#FDF2F8' },
    { color: '#C2410C', bg: '#FFF7ED' },
  ],
  income: [
    { color: '#059669', bg: '#ECFDF5' },
    { color: '#16A34A', bg: '#F0FDF4' },
    { color: '#0D9488', bg: '#F0FDFA' },
    { color: '#15803D', bg: '#ECFDF5' },
    { color: '#10B981', bg: '#ECFDF5' },
    { color: '#047857', bg: '#ECFDF5' },
  ],
  investment: [
    { color: '#2563EB', bg: '#EFF6FF' },
    { color: '#0EA5E9', bg: '#E0F2FE' },
    { color: '#4F46E5', bg: '#EEF2FF' },
    { color: '#7C3AED', bg: '#F5F3FF' },
    { color: '#6D28D9', bg: '#F5F3FF' },
    { color: '#3B82F6', bg: '#EFF6FF' },
  ],
}

const FALLBACK_CUSTOM_COLORS = [
  { color: '#6366F1', bg: '#EEF2FF' },
  { color: '#14B8A6', bg: '#F0FDFA' },
  { color: '#F97316', bg: '#FFF7ED' },
]

/** Convert DB row → category object compatible with the rest of the app */
function toCategory(row) {
  return {
    id: row.slug,
    label: row.label,
    icon: row.icon || 'Tag',
    color: row.color || '#6B7280',
    bg: row.bg || '#F3F4F6',
    type: row.type,
    isCustom: true,
    archived: !!row.archived,
    dbId: row.id,
  }
}

/**
 * Fetches the current user's custom categories and registers them
 * into the module-level store so getCategory() / getCategoriesForType()
 * resolve them everywhere in the app. Archived categories are loaded too, so
 * older entries still show their name; pickers only offer active ones.
 */
export function useUserCategories({ enabled = true } = {}) {
  const activeUserId = useActiveWallet()
  const { data, isLoading, error } = useQuery({
    queryKey: categoryQueryKey(activeUserId),
    enabled: enabled && !!activeUserId,
    queryFn: () =>
      traceQuery('userCategories', async () => {
        const userId = activeUserId
        const { data: rows, error: queryError } = await supabase
          .from('user_categories')
          .select(COLUMNS)
          .eq('user_id', userId)
          .order('created_at', { ascending: true })

        if (queryError) {
          // Table may not exist yet — treat as empty rather than crashing
          const msg = String(queryError?.message || '').toLowerCase()
          const code = String(queryError?.code || '')
          if (
            msg.includes('does not exist') ||
            msg.includes('user_categories') ||
            code === '42P01' ||
            code === 'PGRST204' ||
            code === 'PGRST116'
          ) {
            return []
          }
          throw queryError
        }
        return (rows || []).map(toCategory)
      }),
    placeholderData: (prev) => prev,
    // Don't retry if the table simply doesn't exist
    retry: false,
  })

  const allCategories = data || NO_CATEGORIES
  const customCategories = useMemo(() => allCategories.filter(isActive), [allCategories])

  // Keep module-level store in sync so getCategory() works outside React
  useEffect(() => {
    if (!activeUserId) {
      registerCustomCategories([])
      return
    }
    registerCustomCategories(data || [])
  }, [data, activeUserId])

  return { customCategories, allCategories, loading: isLoading, error }
}

// Label for any stored category id, built-in or custom (archived included).
// Changes identity when custom categories load, so memos that use it recompute.
export function useCategoryLabel() {
  const { allCategories } = useUserCategories()
  return useCallback((id) => (
    allCategories.find((category) => category.id === id)?.label || getCategory(id)?.label || id
  ), [allCategories])
}

export const USER_CATEGORIES_QUERY_KEY = categoryQueryKey // factory: USER_CATEGORIES_QUERY_KEY(userId)

/**
 * Create a new custom category for the current user.
 * Returns the category object (with .id = slug).
 */
export async function createUserCategory({ label, type, icon = 'Tag' }) {
  const authUserId = getAuthUserId()
  const userId = getActiveWalletUserId()

  if (userId !== authUserId) {
    throw new Error('Shared wallets are view-only. You cannot create categories here.')
  }

  const labelError = categoryLabelError(label)
  if (labelError) throw new Error(labelError)
  const trimmed = normalizeCategoryLabel(label)
  const slug = buildCategorySlug(trimmed)

  const prev = queryClient.getQueryData(categoryQueryKey(userId)) || []
  const active = prev.filter(isActive)
  if (active.some(c => categoryLabelKey(c.label) === categoryLabelKey(trimmed))) {
    throw new Error('A category with this name already exists')
  }

  if (active.length >= MAX_CUSTOM_CATEGORIES) {
    throw new Error(`Maximum ${MAX_CUSTOM_CATEGORIES} custom categories allowed`)
  }

  const palette = CUSTOM_COLORS_BY_TYPE[type] || FALLBACK_CUSTOM_COLORS
  const sameTypeCount = active.filter((cat) => cat?.type === type).length
  const colorIndex = sameTypeCount % palette.length
  const { color, bg } = palette[colorIndex]

  // Optimistic update
  const optimistic = {
    id: slug,
    label: trimmed,
    icon,
    color,
    bg,
    type,
    isCustom: true,
    archived: false,
    dbId: `temp-${slug}`,
  }
  const optimisticList = [...prev, optimistic]
  queryClient.setQueryData(categoryQueryKey(userId), optimisticList)
  registerCustomCategories(optimisticList)

  try {
    // Insert, never upsert: the slug is new each time, so an archived
    // category with a similar name is left as it is.
    const { data, error } = await supabase
      .from('user_categories')
      .insert({
        user_id: userId,
        type,
        label: trimmed,
        slug,
        icon,
        color,
        bg,
        archived: false,
      })
      .select(COLUMNS)
      .single()

    if (error) throw error

    const created = toCategory(data)
    const afterCreate = (queryClient.getQueryData(categoryQueryKey(userId)) || []).map((cat) => (
      cat.id === slug ? created : cat
    ))
    queryClient.setQueryData(categoryQueryKey(userId), afterCreate)
    registerCustomCategories(afterCreate)

    return created
  } catch (e) {
    queryClient.setQueryData(categoryQueryKey(userId), prev)
    registerCustomCategories(prev)
    const message = String(e?.message || '')
    const code = String(e?.code || '')

    if (message.includes('duplicate') || code === '23505') {
      throw new Error('A category with this name already exists')
    }

    if (message.includes('user_categories_type_check') || code === '23514') {
      throw new Error('Category type is not supported by your current database schema. Apply the latest schema migration and retry.')
    }

    throw e
  }
}

/**
 * Edit a custom category (label/icon).
 * Slug is intentionally preserved so existing transactions keep their category id.
 */
export async function updateUserCategory({ dbId, label, icon = 'Tag' }) {
  const authUserId = getAuthUserId()
  const userId = getActiveWalletUserId()

  if (userId !== authUserId) {
    throw new Error('Shared wallets are view-only. You cannot edit categories here.')
  }

  if (!dbId) {
    throw new Error('Category id is required')
  }

  const labelError = categoryLabelError(label)
  if (labelError) throw new Error(labelError)
  const trimmed = normalizeCategoryLabel(label)

  const prev = queryClient.getQueryData(categoryQueryKey(userId)) || []
  if (prev.some(c => isActive(c) && c.dbId !== dbId && categoryLabelKey(c.label) === categoryLabelKey(trimmed))) {
    throw new Error('A category with this name already exists')
  }
  const optimistic = prev.map((cat) => (
    cat.dbId === dbId
      ? { ...cat, label: trimmed, icon: icon || cat.icon || 'Tag' }
      : cat
  ))
  queryClient.setQueryData(categoryQueryKey(userId), optimistic)
  registerCustomCategories(optimistic)

  try {
    const { data, error } = await supabase
      .from('user_categories')
      .update({
        label: trimmed,
        icon,
      })
      .eq('id', dbId)
      .eq('user_id', userId)
      .select(COLUMNS)
      .single()

    if (error) throw error

    const updated = toCategory(data)
    const next = (queryClient.getQueryData(categoryQueryKey(userId)) || []).map((cat) => (
      cat.dbId === dbId ? updated : cat
    ))
    queryClient.setQueryData(categoryQueryKey(userId), next)
    registerCustomCategories(next)

    return updated
  } catch (e) {
    queryClient.setQueryData(categoryQueryKey(userId), prev)
    registerCustomCategories(prev)

    const message = String(e?.message || '')
    const code = String(e?.code || '')

    if (message.includes('duplicate') || code === '23505') {
      throw new Error('A category with this name already exists')
    }

    throw e
  }
}

async function setCategoryArchived(dbId, archived) {
  const authUserId = getAuthUserId()
  const userId = getActiveWalletUserId()

  if (userId !== authUserId) {
    throw new Error('Shared wallets are view-only. You cannot change categories here.')
  }

  const prev = queryClient.getQueryData(categoryQueryKey(userId)) || []
  const target = prev.find(c => c.dbId === dbId)
  if (!archived && target) {
    const active = prev.filter(isActive)
    if (active.length >= MAX_CUSTOM_CATEGORIES) {
      throw new Error(`Maximum ${MAX_CUSTOM_CATEGORIES} custom categories allowed`)
    }
    if (active.some(c => categoryLabelKey(c.label) === categoryLabelKey(target.label))) {
      throw new Error('Another category already uses this name. Rename it first.')
    }
  }

  const next = prev.map(c => (c.dbId === dbId ? { ...c, archived } : c))
  queryClient.setQueryData(categoryQueryKey(userId), next)
  registerCustomCategories(next)

  try {
    const { error } = await supabase
      .from('user_categories')
      .update({ archived })
      .eq('id', dbId)
      .eq('user_id', userId)

    if (error) throw error
    return target ? { ...target, archived } : null
  } catch (e) {
    queryClient.setQueryData(categoryQueryKey(userId), prev)
    registerCustomCategories(prev)
    if (!archived && (String(e?.message || '').includes('duplicate') || String(e?.code || '') === '23505')) {
      throw new Error('Another category already uses this name. Rename it first.')
    }
    throw e
  }
}

/**
 * Soft-delete (archive) a custom category. Existing transactions keep their
 * category value and name; the category just stops appearing in pickers.
 */
export function archiveUserCategory(dbId) {
  return setCategoryArchived(dbId, true)
}

export function restoreUserCategory(dbId) {
  return setCategoryArchived(dbId, false)
}
