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

// Color palette auto-assigned to new custom categories
const CUSTOM_COLORS = [
  { color: '#6366F1', bg: '#EEF2FF' },
  { color: '#EC4899', bg: '#FDF2F8' },
  { color: '#14B8A6', bg: '#F0FDFA' },
  { color: '#F97316', bg: '#FFF7ED' },
  { color: '#8B5CF6', bg: '#F5F3FF' },
  { color: '#EF4444', bg: '#FEF2F2' },
  { color: '#06B6D4', bg: '#ECFEFF' },
  { color: '#84CC16', bg: '#F7FEE7' },
  { color: '#D946EF', bg: '#FDF4FF' },
  { color: '#F59E0B', bg: '#FFFBEB' },
  { color: '#0EA5E9', bg: '#E0F2FE' },
  { color: '#10B981', bg: '#ECFDF5' },
  { color: '#E11D48', bg: '#FFF1F2' },
  { color: '#7C3AED', bg: '#F5F3FF' },
  { color: '#2563EB', bg: '#EFF6FF' },
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
    return () => registerCustomCategories([])
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

  const colorIndex = prev.length % CUSTOM_COLORS.length
  const { color, bg } = CUSTOM_COLORS[colorIndex]

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
  queryClient.setQueryData(QUERY_KEY, [...prev, optimistic])

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

    queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    return toCategory(data)
  } catch (e) {
    queryClient.setQueryData(QUERY_KEY, prev)
    if (e.message?.includes('duplicate') || e.code === '23505') {
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
  queryClient.setQueryData(QUERY_KEY, prev.filter(c => c.dbId !== dbId))

  try {
    const { error } = await supabase
      .from('user_categories')
      .update({ archived: true })
      .eq('id', dbId)
      .eq('user_id', userId)

    if (error) throw error

    queryClient.invalidateQueries({ queryKey: QUERY_KEY })
  } catch (e) {
    queryClient.setQueryData(QUERY_KEY, prev)
    throw e
  }
}
