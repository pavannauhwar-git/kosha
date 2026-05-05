import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { queryClient } from '../lib/queryClient'
import { getAuthUserId } from '../lib/authStore'
import { traceQuery } from '../lib/queryTrace'
import { registerCustomCategories } from '../lib/categories'

const QUERY_KEY = ['userCategories']
const COLUMNS = 'id, type, label, slug, icon, color, bg, archived, created_at'
const MAX_CUSTOM_CATEGORIES = 15

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
    dbId: row.id,
  }
}

function generateSlug(label) {
  return 'custom_' + label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 30)
}

/**
 * Fetches the current user's custom categories and registers them
 * into the module-level store so getCategory() / getCategoriesForType()
 * resolve them everywhere in the app.
 */
export function useUserCategories({ enabled = true } = {}) {
  const { data, isLoading, error } = useQuery({
    queryKey: QUERY_KEY,
    enabled,
    queryFn: () =>
      traceQuery('userCategories', async () => {
        const userId = getAuthUserId()
        const { data: rows, error: queryError } = await supabase
          .from('user_categories')
          .select(COLUMNS)
          .eq('user_id', userId)
          .eq('archived', false)
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

  const categories = data || []

  // Keep module-level store in sync so getCategory() works outside React
  useEffect(() => {
    registerCustomCategories(categories)
  }, [categories])

  return { customCategories: categories, loading: isLoading, error }
}

export const USER_CATEGORIES_QUERY_KEY = QUERY_KEY

/**
 * Create a new custom category for the current user.
 * Returns the category object (with .id = slug).
 */
export async function createUserCategory({ label, type, icon = 'Tag' }) {
  const userId = getAuthUserId()
  const trimmed = label.trim()

  if (trimmed.length < 2 || trimmed.length > 30) {
    throw new Error('Category name must be 2–30 characters')
  }

  const slug = generateSlug(trimmed)
  if (!slug || slug === 'custom_') {
    throw new Error('Invalid category name')
  }

  const prev = queryClient.getQueryData(QUERY_KEY) || []
  if (prev.length >= MAX_CUSTOM_CATEGORIES) {
    throw new Error(`Maximum ${MAX_CUSTOM_CATEGORIES} custom categories allowed`)
  }

  const palette = CUSTOM_COLORS_BY_TYPE[type] || FALLBACK_CUSTOM_COLORS
  const sameTypeCount = prev.filter((cat) => cat?.type === type).length
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
    dbId: `temp-${slug}`,
  }
  const optimisticList = [...prev, optimistic]
  queryClient.setQueryData(QUERY_KEY, optimisticList)
  registerCustomCategories(optimisticList)

  try {
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
      })
      .select(COLUMNS)
      .single()

    if (error) throw error

    const created = toCategory(data)
    const afterCreate = (queryClient.getQueryData(QUERY_KEY) || []).map((cat) => (
      cat.id === slug ? created : cat
    ))
    queryClient.setQueryData(QUERY_KEY, afterCreate)
    registerCustomCategories(afterCreate)

    return created
  } catch (e) {
    queryClient.setQueryData(QUERY_KEY, prev)
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
  const userId = getAuthUserId()
  const trimmed = label.trim()

  if (!dbId) {
    throw new Error('Category id is required')
  }

  if (trimmed.length < 2 || trimmed.length > 30) {
    throw new Error('Category name must be 2–30 characters')
  }

  const prev = queryClient.getQueryData(QUERY_KEY) || []
  const optimistic = prev.map((cat) => (
    cat.dbId === dbId
      ? { ...cat, label: trimmed, icon: icon || cat.icon || 'Tag' }
      : cat
  ))
  queryClient.setQueryData(QUERY_KEY, optimistic)
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
    const next = (queryClient.getQueryData(QUERY_KEY) || []).map((cat) => (
      cat.dbId === dbId ? updated : cat
    ))
    queryClient.setQueryData(QUERY_KEY, next)
    registerCustomCategories(next)

    return updated
  } catch (e) {
    queryClient.setQueryData(QUERY_KEY, prev)
    registerCustomCategories(prev)

    const message = String(e?.message || '')
    const code = String(e?.code || '')

    if (message.includes('duplicate') || code === '23505') {
      throw new Error('A category with this name already exists')
    }

    throw e
  }
}

/**
 * Soft-delete (archive) a custom category. Existing transactions keep their
 * category value; the category just stops appearing in pickers.
 */
export async function archiveUserCategory(dbId) {
  const userId = getAuthUserId()
  const prev = queryClient.getQueryData(QUERY_KEY) || []
  const next = prev.filter(c => c.dbId !== dbId)
  queryClient.setQueryData(QUERY_KEY, next)
  registerCustomCategories(next)

  try {
    const { error } = await supabase
      .from('user_categories')
      .update({ archived: true })
      .eq('id', dbId)
      .eq('user_id', userId)

    if (error) throw error

  } catch (e) {
    queryClient.setQueryData(QUERY_KEY, prev)
    registerCustomCategories(prev)
    throw e
  }
}
