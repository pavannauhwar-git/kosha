import { Trash, Receipt, ArrowsLeftRight } from '@phosphor-icons/react'
import Button from '../ui/Button'
import SecureAvatar from '../ui/SecureAvatar'

export default function ActiveGroupView({
  activeBanner,
  activeGroup,
  isGroupAdmin,
  setShowBannerPicker,
  selfNet,
  totalExpenses,
  members,
  balances,
  authUserId,
  roleByUserId,
  saving,
  resolveMemberAvatar,
  resolveMemberName,
  memberInitial,
  fmt,
  handleSetMemberRole,
  handleDeleteMember,
  memberSpendingStats,
  setShowAddMember,
  setShowAddExpense,
  canManageGroup,
  handleSettleUpClick,
  suggestedTransfers,
  applySuggestedTransfer,
  transactions,
  handleExportLedger,
  loading,
  txnsListRef,
  txnsTopPadding,
  renderedTransactions,
  txnsStartIndex,
  measureTxnElement,
  memberById,
  fmtDate,
  openEditExpense,
  handleDeleteExpense,
  openEditSettlement,
  handleDeleteSettlement,
  round2,
  txnsBottomPadding,
}) {
  return (
    <div className="page-stack">
      <div className="relative overflow-hidden rounded-card">
        <div className="h-40 w-full bg-kosha-surface-2">
          <img src={activeBanner.src} alt={activeBanner.name} className="h-full w-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent" />
        </div>
        <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
          <div className="text-white overflow-hidden max-w-[70%]">
            <p className="text-[10px] opacity-80 uppercase tracking-widest truncate">{activeBanner.name}</p>
            <h2 className="text-[22px] font-bold truncate">{activeGroup.name}</h2>
          </div>
          {!activeGroup.is_archived && isGroupAdmin && (
            <button
              onClick={() => setShowBannerPicker(true)}
              className="rounded-pill bg-white/20 backdrop-blur-md border border-white/20 px-2.5 py-1 text-[11px] text-white hover:bg-white/30"
            >
              Change Cover
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        <div className="card p-3">
          <p className="text-[10px] text-ink-3">You owe</p>
          <p className="mt-1 text-[15px] font-semibold amt-expense tabular-nums">{fmt(Math.max(0, -selfNet))}</p>
        </div>
        <div className="card p-3">
          <p className="text-[10px] text-ink-3">You are owed</p>
          <p className="mt-1 text-[15px] font-semibold amt-income tabular-nums">{fmt(Math.max(0, selfNet))}</p>
        </div>
        <div className="card p-3">
          <p className="text-[10px] text-ink-3">Total expenses</p>
          <p className="mt-1 text-[15px] font-semibold text-ink tabular-nums">{fmt(totalExpenses)}</p>
        </div>
      </div>

      <div className="card p-3.5">
        <div className="flex items-center justify-between gap-2 mb-2">
          <p className="section-label">Members</p>
          {isGroupAdmin && !activeGroup?.is_archived && (
            <button
              onClick={() => setShowAddMember(true)}
              className="rounded-pill bg-kosha-surface-2 px-2 py-0.5 text-[11px] font-semibold text-brand hover:bg-brand hover:text-white transition-colors"
            >
              + Add Member
            </button>
          )}
        </div>

        {members.length === 0 ? (
          <p className="text-[12px] text-ink-3">No members yet.</p>
        ) : (
          <div className="space-y-2">
            {members.map((member) => {
              const netRow = balances.find((entry) => entry?.member?.id === member.id)
              const net = round2(netRow?.net || 0)
              const isSelfMember = member.linked_user_id === authUserId

              let memberRole = 'guest'
              if (member.linked_user_id === activeGroup?.user_id) {
                memberRole = 'admin'
              } else if (member.linked_user_id) {
                const role = roleByUserId.get(member.linked_user_id)
                memberRole = role ? role : 'left'
              } else if (member.user_id) {
                const creatorHasAccess = roleByUserId.has(member.user_id)
                if (!creatorHasAccess) {
                  memberRole = 'left'
                }
              }

              const roleBusy = saving === `member-role-${member.id}`
              const avatarUrl = resolveMemberAvatar(member)
              const displayName = resolveMemberName(member)
              return (
                <div key={member.id} className="mini-panel px-2.5 py-2 flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <div
                      className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-kosha-surface-2 flex items-center justify-center"
                      style={{ border: '1px solid var(--ds-border)' }}
                    >
                      {avatarUrl ? (
                        <SecureAvatar
                          src={avatarUrl}
                          alt={displayName}
                          fallbackInitial={memberInitial(displayName)}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-[11px] font-semibold text-ink">{memberInitial(displayName)}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-[12px] font-semibold text-ink truncate">
                          {displayName} {isSelfMember ? '(You)' : ''}
                        </p>
                        {memberRole === 'left' && (
                          <span className="rounded bg-rose-500/10 px-1.5 py-[1px] text-[9px] font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400">
                            Left
                          </span>
                        )}
                      </div>
                      <p className="text-[12px] font-medium text-ink-2 mb-0.5 leading-none">
                        {memberRole === 'admin' ? 'Admin' : memberRole === 'member' ? 'Member' : memberRole === 'viewer' ? 'Viewer' : memberRole === 'left' ? 'Left Group' : 'Guest'}
                      </p>
                      <p className={`text-[11px] tabular-nums ${net > 0.01 ? 'amt-income' : net < -0.01 ? 'amt-expense' : 'text-ink-3'}`}>
                        {net > 0.01 ? `gets ${fmt(net)}` : net < -0.01 ? `owes ${fmt(Math.abs(net))}` : 'settled'}
                      </p>
                    </div>
                  </div>
                  {isGroupAdmin && !isSelfMember && !activeGroup.is_archived && (
                    <div className="flex items-center gap-1.5 shrink-0">
                      {!!member.linked_user_id && (
                        <button
                          type="button"
                          onClick={() => {
                            void handleSetMemberRole(member, memberRole === 'admin' ? 'member' : 'admin')
                          }}
                          className="rounded-pill border border-kosha-border bg-kosha-surface px-2 py-1 text-[11px] text-ink-3"
                          disabled={!!saving}
                        >
                          {roleBusy ? '...' : memberRole === 'admin' ? 'Make Member' : 'Make Admin'}
                        </button>
                      )}
                      {(isGroupAdmin && activeGroup?.user_id === authUserId) && (
                        <button
                          type="button"
                          onClick={() => { void handleDeleteMember(member.id) }}
                          className="rounded-full h-7 w-7 flex items-center justify-center text-danger/80 hover:bg-danger/10 hover:text-danger border border-transparent hover:border-danger/20 transition-[background-color,border-color,color] duration-150"
                          disabled={!!saving}
                          title="Remove member"
                        >
                          <Trash size={13} />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="card p-3.5">
        <p className="section-label mb-2">Who Paid For What</p>
        {memberSpendingStats.length === 0 ? (
          <p className="text-[12px] text-ink-3">No members to show.</p>
        ) : (
          <div className="space-y-4 pt-1">
            {memberSpendingStats.map(({ member, spent, percent }) => (
              <div key={member.id} className="w-full">
                <div className="flex justify-between items-end mb-1.5">
                  <span className="text-[12px] font-semibold text-ink truncate mr-2">{resolveMemberName(member)}</span>
                  <span className="text-[12px] text-ink-3 shrink-0 tabular-nums">{fmt(spent)}</span>
                </div>
                <div className="w-full bg-kosha-surface-2 rounded-full h-1.5 overflow-hidden">
                  <div
                    className="bg-brand h-full rounded-full transition-[width] duration-400 ease-[cubic-bezier(0.05,0.7,0.1,1)]"
                    style={{ width: `${percent}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="primary"
          size="md"
          icon={<Receipt size={14} />}
          onClick={() => setShowAddExpense(true)}
          disabled={!canManageGroup}
        >
          Add Expense
        </Button>
        <Button
          variant="success"
          size="md"
          icon={<ArrowsLeftRight size={14} />}
          onClick={handleSettleUpClick}
          disabled={!canManageGroup}
        >
          Settle Up
        </Button>
      </div>

      <div className="card p-3.5">
        <p className="section-label mb-2">Suggested Settlements</p>
        {suggestedTransfers.length === 0 ? (
          <div className="py-4 text-center">
            <img src="/illustrations/coffee_chill.webp" className="max-h-[140px] w-auto mx-auto mb-2 illustration" alt="All caught up" />
            <p className="text-[13px] font-semibold text-ink">Everyone is settled.</p>
            <p className="text-[11px] text-ink-3">Time to relax.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {suggestedTransfers.map((transfer, index) => (
              <button
                key={`${transfer.from?.id}-${transfer.to?.id}-${index}`}
                type="button"
                onClick={() => applySuggestedTransfer(transfer)}
                className="w-full mini-panel px-2.5 py-2 text-left hover:brightness-[0.98]"
              >
                <p className="text-[12px] font-semibold text-ink">
                  {resolveMemberName(transfer.from)} pays {resolveMemberName(transfer.to)}
                </p>
                <p className="text-[11px] tabular-nums amt-expense mt-0.5">{fmt(transfer.amount)}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-kosha-border bg-kosha-surface flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt size={16} className="text-brand" />
            <p className="font-semibold text-[14px] text-ink">Transactions</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-medium text-ink-3">{transactions.length} entries</span>
            {transactions.length > 0 && (
              <button onClick={handleExportLedger} className="text-[11px] font-medium text-brand hover:text-brand-dark transition-colors">
                Export Ledger
              </button>
            )}
          </div>
        </div>
        {loading && transactions.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-[13px] font-medium text-ink-3">Loading transactions...</p>
          </div>
        ) : transactions.length === 0 ? (
          <div className="p-10 text-center">
            <div className="w-10 h-10 rounded-full bg-kosha-surface-2 flex items-center justify-center mx-auto mb-3">
              <Receipt size={18} className="text-ink-3" />
            </div>
            <p className="text-[13px] font-medium text-ink">No transactions yet</p>
            <p className="text-[11px] text-ink-3 mt-1">Add an expense to get started.</p>
          </div>
        ) : (
          <div
            ref={txnsListRef}
            className="max-h-[500px] overflow-y-auto w-full relative scroll-smooth"
            style={{ willChange: 'transform', overflowAnchor: 'none' }}
          >
            <div style={{ height: `${txnsTopPadding}px`, width: '100%', flexShrink: 0 }} />
            <div className="divide-y divide-kosha-border w-full flex flex-col">
              {renderedTransactions.map((t, idx) => {
                const actualIndex = txnsStartIndex + idx
                const isExpense = t.type === 'expense'

                return (
                  <div
                    key={t.id}
                    ref={(el) => measureTxnElement(actualIndex, el)}
                    data-index={actualIndex}
                    className="p-2 sm:p-2.5 bg-kosha-surface hover:bg-kosha-surface-2 transition-colors group"
                  >
                    {isExpense ? (() => {
                      const payer = memberById.get(t.paid_by_member_id)
                      return (
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className="h-8 w-8 rounded-full bg-brand/10 text-brand shrink-0 flex items-center justify-center border border-brand/20 mt-0.5">
                              <Receipt size={14} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[13px] font-semibold text-ink truncate leading-tight">{t.description}</p>
                              <p className="text-[11px] text-ink-3 mt-1 truncate">
                                <span className="font-medium text-ink">{resolveMemberName(payer)}</span> paid
                                {t.split_expense_splits?.length > 0 && (
                                  <span className="opacity-60"> · split {t.split_expense_splits.length} ways</span>
                                )}
                              </p>
                              <p className="text-[10px] text-ink-3 mt-0.5 opacity-80">{fmtDate(t.expense_date)}</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0 flex flex-col justify-start items-end">
                            <p className="text-[14px] font-bold text-ink tabular-nums">{fmt(t.amount)}</p>
                            {canManageGroup && (
                              <div className="mt-1 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() => openEditExpense(t)}
                                  className="text-[10px] font-semibold text-brand/80 hover:text-brand"
                                  disabled={!!saving}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { void handleDeleteExpense(t.id) }}
                                  className="text-[10px] font-semibold text-danger/80 hover:text-danger"
                                  disabled={!!saving}
                                >
                                  {isGroupAdmin ? 'Delete for all' : 'Remove'}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })() : (() => {
                      const payer = memberById.get(t.payer_member_id)
                      const payee = memberById.get(t.payee_member_id)
                      return (
                        <div className="flex items-start justify-between gap-2.5">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className="h-8 w-8 rounded-full bg-success/10 text-success shrink-0 flex items-center justify-center border border-success/20 mt-0.5">
                              <ArrowsLeftRight size={14} />
                            </div>
                            <div className="min-w-0">
                              <p className="text-[13px] font-semibold text-ink truncate leading-tight">Settlement</p>
                              <p className="text-[11px] text-ink-3 mt-1 truncate">
                                <span className="font-medium text-ink">{resolveMemberName(payer)}</span> paid <span className="font-medium text-ink">{resolveMemberName(payee)}</span>
                              </p>
                              <p className="text-[10px] text-ink-3 mt-0.5 opacity-80">{fmtDate(t.settled_at)}</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0 flex flex-col justify-start items-end">
                            <p className="text-[14px] font-bold text-success tabular-nums">{fmt(t.amount)}</p>
                            {canManageGroup && (
                              <div className="mt-1 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() => openEditSettlement(t)}
                                  className="text-[10px] font-semibold text-brand/80 hover:text-brand"
                                  disabled={!!saving}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => { void handleDeleteSettlement(t.id) }}
                                  className="text-[10px] font-semibold text-danger/80 hover:text-danger"
                                  disabled={!!saving}
                                >
                                  {isGroupAdmin ? 'Delete for all' : 'Remove'}
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )
              })}
            </div>
            <div style={{ height: `${txnsBottomPadding || 0}px`, width: '100%', flexShrink: 0 }} />
          </div>
        )}
      </div>
    </div>
  )
}
