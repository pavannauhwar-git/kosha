import { useState, useCallback, useMemo } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Wallet } from '@phosphor-icons/react'
import { EXPENSE_CATEGORIES } from '../../lib/categories'
import { upsertBudget, deleteBudget } from '../../hooks/useBudgets'
import CategoryIcon from './CategoryIcon'
import { fmt } from '../../lib/utils'

export default function BudgetSheet({ open, onClose, budgets = [], byCategory = {} }) {
  const [saving, setSaving] = useState(null)
  const [error, setError] = useState('')

  const budgetMap = useMemo(() => {
    const map = new Map()
    for (const b of budgets) map.set(b.category, b)
    return map
  }, [budgets])

  const [drafts, setDrafts] = useState({})

  const categories = useMemo(() => {
    return EXPENSE_CATEGORIES.filter((c) => c.id !== 'other').map((cat) => {
      const existing = budgetMap.get(cat.id)
      const spent = Number(byCategory[cat.id] || 0)
      return { ...cat, budget: existing, spent }
    })
  }, [budgetMap, byCategory])

  const getDraftValue = useCallback(
    (catId) => {
      if (catId in drafts) return drafts[catId]
      const existing = budgetMap.get(catId)
      return existing ? String(existing.monthly_limit) : ''
    },
    [drafts, budgetMap]
  )

  function handleDraftChange(catId, value) {
    const cleaned = value.replace(/[^0-9.]/g, '')
    setDrafts((prev) => ({ ...prev, [catId]: cleaned }))
  }

  async function handleSave(catId) {
    const raw = getDraftValue(catId)
    const limit = Number(raw)
    if (!Number.isFinite(limit) || limit <= 0) {
      setError('Enter a valid amount greater than 0.')
      setTimeout(() => setError(''), 2500)
      return
    }

    setSaving(catId)
    setError('')
    try {
      await upsertBudget(catId, limit)
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
    }
  }

  async function handleDelete(catId) {
    const existing = budgetMap.get(catId)
    if (!existing) return

    setSaving(catId)
    setError('')
    try {
      await deleteBudget(existing.id)
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
    }
  }

  const activeBudgetCount = budgets.filter((b) => b.monthly_limit > 0).length

  return (
    <Dialog.Root open={open} onOpenChange={(v) => !v && onClose()}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 bg-ink/30 z-50"
                style={{ backdropFilter: 'blur(2px)' }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.div
                className="fixed inset-x-0 bottom-0 z-50 bg-kosha-surface rounded-t-hero shadow-card-lg"
                style={{
                  maxWidth: 560,
                  margin: '0 auto',
                  maxHeight: '85dvh',
                  paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                }}
                initial={{ y: '100%' }}
                animate={{ y: 0, transition: { type: 'spring', stiffness: 400, damping: 36 } }}
                exit={{ y: '100%', transition: { duration: 0.22 } }}
              >
                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-kosha-border">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-brand-container flex items-center justify-center">
                      <Wallet size={16} className="text-brand" weight="duotone" />
                    </div>
                    <div>
                      <Dialog.Title className="text-[15px] font-bold text-ink">
                        Category Budgets
                      </Dialog.Title>
                      <p className="text-[11px] text-ink-3">
                        {activeBudgetCount > 0
                          ? `${activeBudgetCount} budget${activeBudgetCount > 1 ? 's' : ''} active`
                          : 'Set monthly spending limits per category'}
                      </p>
                    </div>
                  </div>
                  <Dialog.Close asChild>
                    <button className="w-8 h-8 rounded-full bg-kosha-surface-2 flex items-center justify-center">
                      <X size={16} className="text-ink-3" />
                    </button>
                  </Dialog.Close>
                </div>

                {error && (
                  <div className="px-5 pt-2">
                    <p className="text-[12px] text-expense-text">{error}</p>
                  </div>
                )}

                {/* Category list */}
                <div className="overflow-y-auto px-5 py-3 space-y-1.5" style={{ maxHeight: 'calc(85dvh - 80px)' }}>
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
                          <div
                            className="w-7 h-7 rounded-full border border-kosha-border flex items-center justify-center shrink-0"
                            style={{ background: cat.bg }}
                          >
                            <CategoryIcon categoryId={cat.id} size={13} />
                          </div>
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
                            <span className="text-[11px] text-ink-3">₹</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              placeholder="—"
                              value={draft}
                              onChange={(e) => handleDraftChange(cat.id, e.target.value)}
                              disabled={isSaving}
                              className="w-[72px] h-7 rounded-chip border border-kosha-border bg-kosha-surface
                                         text-[12px] font-semibold text-ink tabular-nums text-right px-2
                                         focus:outline-none focus:ring-1 focus:ring-brand/40
                                         disabled:opacity-50 placeholder:text-ink-4"
                            />
                            {(isModified || (!hasBudget && draft)) && (
                              <button
                                type="button"
                                onClick={() => handleSave(cat.id)}
                                disabled={isSaving}
                                className="h-7 px-2 rounded-chip bg-brand text-white text-[10px] font-semibold
                                           disabled:opacity-50 active:scale-95 transition-transform"
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
                                           disabled:opacity-50 active:scale-95 transition-transform"
                              >
                                {isSaving ? '…' : '×'}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Progress bar when budget is set */}
                        {hasBudget && budgetNum > 0 && (
                          <div className="mt-2 h-1.5 rounded-pill bg-kosha-border overflow-hidden">
                            <div
                              className={`h-full rounded-pill transition-all ${
                                pct >= 100
                                  ? 'bg-expense-text'
                                  : pct >= 80
                                    ? 'bg-warning-text'
                                    : 'bg-brand'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  )
}
