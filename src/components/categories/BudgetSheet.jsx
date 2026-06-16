import { useState, useCallback, useMemo, useRef } from 'react'
import { Wallet } from '@phosphor-icons/react'
import { useUserCategories } from '../../hooks/useUserCategories'
import { getCategoriesForType } from '../../lib/categories'
import { upsertBudget as upsertBudgetApi, deleteBudget as deleteBudgetApi } from '../../hooks/useBudgets'
import { useAppMutation } from '../../hooks/useAppMutation'
import CategoryIcon from './CategoryIcon'
import { fmt } from '../../lib/utils'
import { validateAmount } from '../../lib/validateAmount.js'
import FormField from '../ui/FormField'
import Sheet from '../ui/Sheet'

export default function BudgetSheet({ open, onClose, budgets = [], byCategory = {} }) {
  const [saving, setSaving] = useState(null)
  const [error, setError] = useState('')
  const isSubmitting = useRef(false)

  const saveBudget = useAppMutation(
    ({ category, limit }) => upsertBudgetApi(category, limit),
    { context: 'budgets:save' }
  )
  const removeBudget = useAppMutation(deleteBudgetApi, { context: 'budgets:remove' })

  const { customCategories } = useUserCategories()

  const budgetMap = useMemo(() => {
    const map = new Map()
    for (const b of budgets) map.set(b.category, b)
    return map
  }, [budgets])

  const [drafts, setDrafts] = useState({})

  const categories = useMemo(() => {
    void customCategories
    const allExpenses = getCategoriesForType('expense')
    return allExpenses.filter((c) => c.id !== 'other').map((cat) => {
      const existing = budgetMap.get(cat.id)
      const spent = Number(byCategory[cat.id] || 0)
      return { ...cat, budget: existing, spent }
    })
  }, [budgetMap, byCategory, customCategories])

  const getDraftValue = useCallback(
    (catId) => {
      if (catId in drafts) return drafts[catId]
      const existing = budgetMap.get(catId)
      return existing ? String(existing.monthly_limit) : ''
    },
    [drafts, budgetMap]
  )

  function handleDraftChange(catId, value) {
    if (value === '' || /^[0-9]*\.?[0-9]*$/.test(value)) {
      setDrafts((prev) => ({ ...prev, [catId]: value }))
    }
  }

  async function handleSave(catId) {
    if (saving || isSubmitting.current) return
    isSubmitting.current = true
    
    const raw = getDraftValue(catId)
    const amountValidation = validateAmount(raw, { allowZero: false })
    if (!amountValidation.ok) {
      setError(amountValidation.error)
      setTimeout(() => setError(''), 2500)
      isSubmitting.current = false
      return
    }
    const limit = Number(amountValidation.paise) / 100

    setSaving(catId)
    setError('')
    try {
      await saveBudget.mutateAsync({ category: catId, limit })
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[catId]
        return next
      })
    } catch (e) {
      setError(e?.message || 'Could not save budget.')
      setTimeout(() => setError(''), 3000)
    } finally {
      setSaving(null)
      isSubmitting.current = false
    }
  }

  async function handleDelete(catId) {
    if (saving || isSubmitting.current) return
    isSubmitting.current = true
    
    const existing = budgetMap.get(catId)
    if (!existing) {
      isSubmitting.current = false
      return
    }

    setSaving(catId)
    setError('')
    try {
      await removeBudget.mutateAsync(existing.id)
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[catId]
        return next
      })
    } catch (e) {
      setError(e?.message || 'Could not remove budget.')
      setTimeout(() => setError(''), 3000)
    } finally {
      setSaving(null)
      isSubmitting.current = false
    }
  }

  const activeBudgetCount = budgets.filter((b) => b.monthly_limit > 0).length

  return (
    <Sheet open={open} onClose={onClose} title="Category Budgets">
      <div className="px-5 pt-1 pb-3 -mt-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-brand-container flex items-center justify-center">
            <Wallet size={16} className="text-accent-text" weight="duotone" />
          </div>
          <div>
            <p className="text-[11px] text-ink-3">
              {activeBudgetCount > 0
                ? `${activeBudgetCount} budget${activeBudgetCount > 1 ? 's' : ''} active`
                : 'Set monthly spending limits per category'}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="px-5 pt-2">
          <p className="text-[12px] text-expense-text">{error}</p>
        </div>
      )}

      {/* Category list */}
      <div className="overflow-y-auto px-5 py-3 space-y-1.5" style={{ maxHeight: 'calc(85dvh - 120px)' }}>
        {categories.map((cat) => {
          const draft = getDraftValue(cat.id)
          const hasBudget = budgetMap.has(cat.id)
          const isModified = cat.id in drafts
          const isSaving = saving === cat.id
          const budgetNum = Number(draft || 0)
          const pct = budgetNum > 0 ? Math.round((cat.spent / budgetNum) * 100) : 0

          return (
            <div
              key={cat.id}
              className="rounded-card border border-kosha-border bg-kosha-surface-2 px-3 py-2.5"
            >
              <div className="flex items-center gap-2.5">
                {/* Radial gauge icon when budget is set, else static icon */}
                {hasBudget && budgetNum > 0 ? (
                  <div className="w-9 h-9 shrink-0 relative">
                    <svg viewBox="0 0 36 36" className="w-9 h-9">
                      <circle
                        cx="18" cy="18" r="15"
                        fill="none"
                        stroke="rgba(17,19,24,0.05)"
                        strokeWidth="3"
                      />
                      <circle
                        cx="18" cy="18" r="15"
                        fill="none"
                        stroke={pct >= 100 ? '#E8453C' : pct >= 80 ? '#F9A825' : '#007FFF'}
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeDasharray={`${Math.min(100, pct) * 0.9425} 94.25`}
                        transform="rotate(-90 18 18)"
                        style={{ transition: 'stroke-dasharray 0.4s ease' }}
                      />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold tabular-nums text-ink">
                      {Math.min(pct, 999)}%
                    </span>
                  </div>
                ) : (
                <CategoryIcon categoryId={cat.id} size={13} className="shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-ink truncate">{cat.label}</p>
                  {cat.spent > 0 && (
                    <p className="text-[10px] text-ink-3 tabular-nums">
                      Spent {fmt(cat.spent)}
                      {budgetNum > 0 && ` · ${pct}%`}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[11px] text-ink-3 mt-1.5">₹</span>
                  <FormField error={isSaving ? error : ''}>
                    <input
                      type="text"
                      inputMode="decimal"
                      pattern="[0-9.]*"
                      name={`budget-${cat.id}`}
                      placeholder="—"
                      value={draft}
                      onChange={(e) => {
                        let raw = e.target.value
                        if (raw.startsWith('+')) raw = raw.slice(1)
                        if (raw.toLowerCase().includes('e')) return
                        handleDraftChange(cat.id, raw)
                      }}
                      disabled={isSaving}
                      className="w-[72px] h-7 rounded-chip border border-kosha-border bg-kosha-surface
                                 text-[12px] font-semibold text-ink tabular-nums text-right px-2
                                 focus:outline-none focus:ring-1 focus:ring-brand/40
                                 disabled:opacity-50 placeholder:text-ink-4"
                    />
                  </FormField>
                  {(isModified || (!hasBudget && draft)) && (
                    <button
                      type="button"
                      onClick={() => handleSave(cat.id)}
                      disabled={isSaving}
                      className="h-7 px-2 rounded-chip bg-brand text-white text-[10px] font-semibold
                                 disabled:opacity-50 active:scale-95 transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)]"
                    >
                      {isSaving ? '…' : 'Set'}
                    </button>
                  )}
                  {hasBudget && !isModified && (
                    <button
                      type="button"
                      onClick={() => handleDelete(cat.id)}
                      disabled={isSaving}
                      className="h-7 px-2 rounded-chip bg-expense-bg text-expense-text text-[10px] font-semibold
                                 disabled:opacity-50 active:scale-95 transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)]"
                    >
                      {isSaving ? '…' : '×'}
                    </button>
                  )}
                </div>
              </div>

              {/* Gauge status bar when budget is set */}
              {hasBudget && budgetNum > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-pill bg-kosha-border overflow-hidden">
                    <div
                      className={`h-full rounded-pill transition-[width] duration-400 ease-[cubic-bezier(0.05,0.7,0.1,1)] ${
                        pct >= 100
                          ? 'bg-expense-text'
                          : pct >= 80
                            ? 'bg-warning-text'
                            : 'bg-brand'
                      }`}
                      style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                    />
                  </div>
                  <span className={`text-[9px] font-semibold shrink-0 ${
                    pct >= 100 ? 'text-expense-text' : pct >= 80 ? 'text-warning-text' : 'text-ink-3'
                  }`}>
                    {pct >= 100 ? 'Over budget' : pct >= 80 ? 'Near limit' : 'On track'}
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Sheet>
  )
}
