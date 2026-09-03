import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence } from 'framer-motion'
import { Plus, ArrowsLeftRight, Receipt, LinkSimple, Trash, CaretLeft, SlidersHorizontal, Archive, ArrowUUpLeft } from '@phosphor-icons/react'
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom'
import PageHeaderPage from '../components/layout/PageHeaderPage'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import Button from '../components/ui/Button'
import PixelDatePicker from '../components/ui/PixelDatePicker'
import EmptyState from '../components/common/EmptyState'
import SkeletonLayout from '../components/common/SkeletonLayout'
import { useAppToast } from '../context/ToastContext'
import { toToastMessage } from '../lib/errorTaxonomy'
import Sheet from '../components/ui/Sheet'
import SecureAvatar from '../components/ui/SecureAvatar'
import { useAuth } from '../context/AuthContext'
import { getAuthUserId } from '../lib/authStore'
import { supabase } from '../lib/supabase'
import { useActiveWallet } from '../lib/walletStore'
import PartnerViewBanner from '../components/common/PartnerViewBanner'
import {
  addSplitExpenseMutation,
  addSplitMemberMutation,
  buildEqualSplits,
  buildExactSplits,
  buildPercentSplits,
  buildShareSplits,
  consumeSplitGroupInviteMutation,
  createSplitGroupMutation,
  createSplitGroupInviteMutation,
  deleteSplitExpenseMutation,
  deleteSplitGroupMutation,
  deleteSplitMemberMutation,
  deleteSplitSettlementMutation,
  previewSplitGroupInviteMutation,
  recordSplitSettlementMutation,
  round2,
  useSplitwise,
  optimisticallyInsertSplitGroup,
  optimisticallyDeleteSplitGroup,
  optimisticallyDeleteSplitExpense,
  optimisticallyInsertSplitExpense,
  optimisticallyDeleteSplitSettlement,
  optimisticallyInsertSplitSettlement,
  leaveSplitGroupMutation,
  toggleArchiveSplitGroupMutation,
  updateSplitExpenseMutation,
  updateSplitGroupMutation,
  updateSplitGroupBannerMutation,
  setSplitGroupAccessRoleMutation,
} from '../hooks/useSplitwise'
import { useAppMutation } from '../hooks/useAppMutation'
import { getCategoriesForType } from '../lib/categories'
import { useUserCategories } from '../hooks/useUserCategories'
import { fmt, fmtDate, todayStr } from '../lib/utils'

import { downloadCsv, toCsv } from '../lib/csv'
import { shareLink } from '../lib/share'
import useWindowedList from '../hooks/useWindowedList'
import { readLocalStorage, writeLocalStorage } from '../lib/safeStorage'

export default function Splitwise() {
  const {
    activeGroupId, setActiveGroupId, groups, members, expenses, settlements, balances, suggestedTransfers, loading, groupsLoading, error,
    schemaMissing, activeGroup, activeMembers, isGroupAdmin, canManageGroup, isViewOnly, isViewingPartner, methodLabel,
    showCreateGroup, setShowCreateGroup, showAddExpense, setShowAddExpense, showSettlement, setShowSettlement, showAddMember, setShowAddMember,
    newMemberName, setNewMemberName, saving, consumingInvite, invitePreview, editExpense, setEditExpense, editSettlement, setEditSettlement,
    showBannerPicker, setShowBannerPicker, savedBannerId, setSavedBannerId, showEditGroup, setShowEditGroup, editGroupForm, setEditGroupForm,
    showArchived, setShowArchived, groupForm, setGroupForm, expenseForm, setExpenseForm, splitInputs, setSplitInputs, settlementForm, setSettlementForm,
    accountDisplayName, activeBanner, visibleGroups, groupStats, totalExpenses, selfNet, selfMember, expenseCategoryOptions,
    changeBanner, handleUpdateGroup, handleToggleArchive, handleExportLedger, closeSheets, handleCreateGroup, handleCreateGroupInvite,
    handleSettleUpClick, handleConfirmInviteJoin, handleDismissInvitePreview, handleDeleteGroup, handleSetMemberRole, handleDeleteMember,
    handleLeaveGroup, handleAddMember, handleAddExpense, handleDeleteExpense, handleRecordSettlement, handleDeleteSettlement,
    applySuggestedTransfer,
    resolveMemberName, resolveMemberAvatar, memberInitial, BANNERS, SPLIT_METHOD_OPTIONS,
    activeWalletUserId, authUserId, pendingExpenseDeleteRef, pendingSettlementDeleteRef
  } = useSplitwiseLogic()

  return (
    <PageHeaderPage title="Splitwise">
      {!schemaMissing && (
        <div className="mb-3">
          {activeGroup ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => {
                    closeSheets()
                    setActiveGroupId('')
                  }}
                  className="inline-flex items-center gap-1 text-[11px] text-ink-3 whitespace-nowrap"
                >
                  <CaretLeft size={13} /> All groups
                </button>

                <div className="flex shrink-0 items-center gap-1.5">
                  {isGroupAdmin && !!activeGroupId && !activeGroup?.is_archived && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<LinkSimple size={13} />}
                      onClick={() => { void handleCreateGroupInvite() }}
                      loading={saving === 'group-invite'}
                    >
                      Invite
                    </Button>
                  )}

                  {isGroupAdmin && !!activeGroupId && (
                    <Button
                      variant="secondary"
                      size="sm"
                      icon={<SlidersHorizontal size={13} />}
                      onClick={() => {
                        setEditGroupForm({ name: activeGroup.name })
                        setShowEditGroup(true)
                      }}
                    >
                      Settings
                    </Button>
                  )}

                  {!!activeGroupId && !activeGroup?.is_archived && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => { void handleLeaveGroup() }}
                      loading={saving === 'group-leave'}
                    >
                      Leave
                    </Button>
                  )}
                </div>
              </div>
              <p className="truncate text-[18px] font-bold text-ink leading-tight">{activeGroup.name}</p>
            </div>
          ) : (
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-[12px] text-ink-3">Split groups</p>
                <p className="mt-1 text-[15px] font-semibold text-ink">
                  {(() => {
                    const activeCount = groups.filter(g => !g.is_archived).length
                    return activeCount ? `${activeCount} active group${activeCount === 1 ? '' : 's'}` : 'Start your first group'
                  })()}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                {!activeGroupId && !isViewingPartner && (
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Plus size={14} />}
                    onClick={() => setShowCreateGroup(true)}
                  >
                    Group
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {activeGroup && (
        <p className={`mb-3 text-[11px] ${activeGroup.is_archived ? 'text-warning-text font-medium' : isViewOnly ? 'text-warning-text' : 'text-ink-3'}`}>
          {activeGroup.is_archived
            ? 'This trip is archived and read-only.'
            : isViewOnly
              ? 'View-only group access. Ask an admin to make changes.'
              : isGroupAdmin
                ? 'You can manage this group as admin.'
                : 'You can add expenses and settlements in this group.'}
        </p>
      )}

      {schemaMissing ? (
        <div className="card p-4">
          <p className="text-sm font-semibold text-ink">Splitwise schema is not enabled yet.</p>
          <p className="mt-1 text-[12px] text-ink-3">
            Run the latest SQL migration in Supabase to create splitwise tables and RPC functions.
          </p>
        </div>
      ) : groupsLoading ? (
        <SkeletonLayout
          className="space-y-3"
          sections={[
            { type: 'block', height: 'h-[96px]' },
            { type: 'block', height: 'h-[96px]' },
            { type: 'block', height: 'h-[120px]' },
          ]}
        />
      ) : groups.length === 0 ? (
        <EmptyState
          className="py-10"
          imageUrl="/illustrations/splitwise_group.webp"
          title="No split group yet"
          description={isViewingPartner ? "This partner has no split groups." : "Create a group, invite Kosha users, and split expenses together."}
          actionLabel={isViewingPartner ? undefined : "Create group"}
          onAction={isViewingPartner ? undefined : () => setShowCreateGroup(true)}
        />
      ) : !activeGroup ? (
          <GroupList
            groupStats={groupStats}
            showArchived={showArchived}
            setShowArchived={setShowArchived}
            visibleGroups={visibleGroups}
            authUserId={authUserId}
            BANNERS={BANNERS}
            readBannerFromStorage={readBannerFromStorage}
            setActiveGroupId={setActiveGroupId}
            fmtDate={fmtDate}
            isViewingPartner={isViewingPartner}
          />
      ) : (
          <ActiveGroupView
            activeGroup={activeGroup}
            activeBanner={activeBanner}
            canManageGroup={canManageGroup}
            isGroupAdmin={isGroupAdmin}
            setShowBannerPicker={setShowBannerPicker}
            setShowEditGroup={setShowEditGroup}
            setEditGroupForm={setEditGroupForm}
            handleExportLedger={handleExportLedger}
            handleCreateGroupInvite={handleCreateGroupInvite}
            setShowAddMember={setShowAddMember}
            members={members}
            resolveMemberAvatar={resolveMemberAvatar}
            memberInitial={memberInitial}
            resolveMemberName={resolveMemberName}
            handleDeleteMember={handleDeleteMember}
            handleSetMemberRole={handleSetMemberRole}
            authUserId={authUserId}
            selfNet={selfNet}
            handleSettleUpClick={handleSettleUpClick}
            setShowAddExpense={setShowAddExpense}
            totalExpenses={totalExpenses}
            expenses={expenses}
            settlements={settlements}
            editExpense={editExpense}
            setEditExpense={setEditExpense}
            setExpenseForm={setExpenseForm}
            setSplitInputs={setSplitInputs}
            defaultSplitInput={defaultSplitInput}
            handleDeleteExpense={handleDeleteExpense}
            editSettlement={editSettlement}
            setEditSettlement={setEditSettlement}
            setSettlementForm={setSettlementForm}
            handleDeleteSettlement={handleDeleteSettlement}
            saving={saving}
          />
      )}

      {createPortal(
        <>
          <AnimatePresence>
        <Sheet
          open={!!invitePreview}
          onClose={handleDismissInvitePreview}
          title="Join Shared Trip"
          contentClassName="px-5 pt-2"
        >
                <div className="relative mb-4 overflow-hidden rounded-card">
                  <div className="h-32 w-full bg-kosha-surface-2">
                    <img
                      src={(BANNERS.find(b => b.id === (readBannerFromStorage(invitePreview?.groupId) || 'goa')) || BANNERS[0]).src}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <p className="text-[10px] opacity-80 mb-0.5 tracking-wider uppercase">Trip Invitation</p>
                    <h2 className="text-[20px] font-bold truncate leading-tight">{invitePreview?.groupName || 'Shared group'}</h2>
                  </div>
                </div>

                <div className="list-card mb-3">
                  <div className="list-row w-full">
                    <span className="text-[14px] text-ink-3">Join As</span>
                    <span className="text-[14px] text-ink font-semibold">{accountDisplayName}</span>
                  </div>
                </div>

                <p className="mb-4 text-[12px] text-ink-3">
                  You join as a member first. An admin can promote you later.
                </p>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    size="lg"
                    onClick={handleDismissInvitePreview}
                    disabled={consumingInvite}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="lg"
                    onClick={() => { void handleConfirmInviteJoin() }}
                    loading={consumingInvite}
                  >
                    Join Group
                  </Button>
                </div>
        </Sheet>
      </AnimatePresence>

      <AnimatePresence>
        <Sheet
          open={showCreateGroup}
          onClose={closeSheets}
          title="Create Group"
          contentClassName="px-5 pt-2 overflow-y-auto"
        >
                <div className="mb-3"><Input label="Group Name" value={groupForm.name} onChange={(event) => setGroupForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Trip to Goa" /></div>

                <p className="mb-4 text-[12px] text-ink-3">
                  Your Kosha account name ({accountDisplayName}) will be used automatically.
                </p>

                <Button
                  variant="primary"
                  size="xl"
                  fullWidth
                  onClick={() => { void handleCreateGroup() }}
                  loading={saving === 'group'}
                >
                  Create Group
                </Button>
        </Sheet>
      </AnimatePresence>

      <AnimatePresence>
        <Sheet
          open={showAddMember}
          onClose={closeSheets}
          title="Add Member"
          contentClassName="px-5 pt-2 overflow-y-auto"
        >
                <div className="mb-4"><Input label="Name" value={newMemberName} onChange={(event) => setNewMemberName(event.target.value)} placeholder="Jane Doe" /></div>

                <Button
                  variant="primary"
                  size="xl"
                  fullWidth
                  onClick={() => { void handleAddMember() }}
                  loading={saving === 'add-member'}
                >
                  Add Member
                </Button>
        </Sheet>
      </AnimatePresence>

      <AnimatePresence>
        <Sheet
          open={showAddExpense}
          onClose={closeSheets}
          title={editExpense ? 'Edit Expense' : 'Add Expense'}
          contentClassName="px-5 pt-2 overflow-y-auto"
        >

                <div className="mb-3"><Input label="Description" value={expenseForm.description} onChange={(event) => setExpenseForm((prev) => ({ ...prev, description: event.target.value }))} placeholder="Dinner" /></div>

                <div className="mb-3"><Input label="Amount" type="text" inputMode="decimal" pattern="[0-9.]*" value={expenseForm.amount} onChange={(event) => setExpenseForm((prev) => ({ ...prev, amount: event.target.value }))} placeholder="0" /></div>

                <div className="list-card mb-3">
                  <div className="list-row w-full">
                    <span className="text-[14px] text-ink-3">Date</span>
                    <PixelDatePicker
                      name="splitwise-expense-date"
                      value={expenseForm.expense_date}
                      onChange={(nextDate) => setExpenseForm((prev) => ({ ...prev, expense_date: nextDate }))}
                      sheetTitle="Select expense date"
                    />
                  </div>
                </div>

                <div className="mb-3">
                  <Select
                    label="Category"
                    value={expenseForm.transaction_category}
                    onChange={(event) => setExpenseForm((prev) => ({ ...prev, transaction_category: event.target.value }))}
                    options={expenseCategoryOptions.map((cat) => ({
                      value: cat.id,
                      label: cat.label,
                    }))}
                  />
                </div>

                <div className="mb-3">
                  <Select
                    label="Paid By"
                    value={expenseForm.paid_by_member_id}
                    onChange={(event) => setExpenseForm((prev) => ({ ...prev, paid_by_member_id: event.target.value }))}
                    options={activeMembers.map((member) => ({
                      value: member.id,
                      label: resolveMemberName(member),
                    }))}
                  />
                </div>

                <div className="mb-3 grid grid-cols-4 gap-2">
                  {SPLIT_METHOD_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setExpenseForm((prev) => ({ ...prev, split_method: option.key }))}
                      className={`h-9 rounded-card border text-[11px] font-semibold ${expenseForm.split_method === option.key
                        ? 'border-brand-dark bg-brand-dark text-white'
                        : 'border-kosha-border bg-kosha-surface text-ink-3'
                        }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="card p-3 mb-3">
                  <p className="text-[11px] text-ink-3 mb-2">Participants ({methodLabel} split)</p>
                  <div className="space-y-2">
                    {activeMembers.map((member) => {
                      const current = splitInputs[member.id] || defaultSplitInput()
                      return (
                        <div key={member.id} className="mini-panel px-2 py-2 flex items-center gap-2">
                          <label className="inline-flex items-center gap-2 flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={!!current.enabled}
                              onChange={(event) => setSplitInputs((prev) => ({
                                ...prev,
                                [member.id]: {
                                  ...(prev[member.id] || defaultSplitInput()),
                                  enabled: event.target.checked,
                                },
                              }))}
                            />
                            <span className="text-[12px] text-ink truncate">{resolveMemberName(member)}</span>
                          </label>

                          {expenseForm.split_method === 'exact' && (
                            <input
                              type="text"
                              inputMode="decimal"
                              pattern="[0-9.]*"
                              className="w-[92px] rounded-pill border border-kosha-border bg-kosha-surface px-2 py-1 text-right text-[12px] text-ink"
                              placeholder="Amount"
                              value={current.exact}
                              onChange={(event) => setSplitInputs((prev) => ({
                                ...prev,
                                [member.id]: {
                                  ...(prev[member.id] || defaultSplitInput()),
                                  exact: event.target.value,
                                },
                              }))}
                              disabled={!current.enabled}
                            />
                          )}

                          {expenseForm.split_method === 'percent' && (
                            <input
                              type="text"
                              inputMode="decimal"
                              pattern="[0-9.]*"
                              className="w-[92px] rounded-pill border border-kosha-border bg-kosha-surface px-2 py-1 text-right text-[12px] text-ink"
                              placeholder="%"
                              value={current.percent}
                              onChange={(event) => setSplitInputs((prev) => ({
                                ...prev,
                                [member.id]: {
                                  ...(prev[member.id] || defaultSplitInput()),
                                  percent: event.target.value,
                                },
                              }))}
                              disabled={!current.enabled}
                            />
                          )}

                          {expenseForm.split_method === 'shares' && (
                            <input
                              type="text"
                              inputMode="decimal"
                              pattern="[0-9.]*"
                              className="w-[92px] rounded-pill border border-kosha-border bg-kosha-surface px-2 py-1 text-right text-[12px] text-ink"
                              placeholder="Shares"
                              value={current.shares}
                              onChange={(event) => setSplitInputs((prev) => ({
                                ...prev,
                                [member.id]: {
                                  ...(prev[member.id] || defaultSplitInput()),
                                  shares: event.target.value,
                                },
                              }))}
                              disabled={!current.enabled}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="mb-4">
                  <Input
                    label="Note"
                    value={expenseForm.notes}
                    onChange={(event) => setExpenseForm((prev) => ({ ...prev, notes: event.target.value }))}
                    placeholder="Optional"
                  />
                </div>

                <Button
                  variant="primary"
                  size="xl"
                  fullWidth
                  onClick={() => { void handleAddExpense() }}
                  loading={saving === 'expense' || saving === 'expense-edit'}
                >
                  {editExpense ? (saving === 'expense-edit' ? 'Updating…' : 'Update Expense') : (saving === 'expense' ? 'Adding…' : 'Add Expense')}
                </Button>
        </Sheet>
      </AnimatePresence>

      <AnimatePresence>
        <Sheet
          open={showSettlement}
          onClose={closeSheets}
          title={editSettlement ? 'Edit Settlement' : 'Record Settlement'}
          contentClassName="px-5 pt-2 overflow-y-auto"
        >

                <div className="mb-3">
                  <Select
                    label="Payer"
                    value={settlementForm.payer_member_id}
                    onChange={(event) => setSettlementForm((prev) => ({ ...prev, payer_member_id: event.target.value }))}
                    options={activeMembers.map((member) => ({
                      value: member.id,
                      label: resolveMemberName(member),
                    }))}
                  />
                </div>

                <div className="mb-3">
                  <Select
                    label="Payee"
                    value={settlementForm.payee_member_id}
                    onChange={(event) => setSettlementForm((prev) => ({ ...prev, payee_member_id: event.target.value }))}
                    options={activeMembers.map((member) => ({
                      value: member.id,
                      label: resolveMemberName(member),
                    }))}
                  />
                </div>

                <div className="mb-3">
                  <Input
                    label="Amount"
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9.]*"
                    icon="₹"
                    value={settlementForm.amount}
                    onChange={(event) => setSettlementForm((prev) => ({ ...prev, amount: event.target.value }))}
                    placeholder="0"
                  />
                </div>

                <div className="list-card mb-3">
                  <div className="list-row w-full">
                    <span className="text-[14px] text-ink-3">Date</span>
                    <PixelDatePicker
                      name="splitwise-settlement-date"
                      value={settlementForm.settled_at}
                      onChange={(nextDate) => setSettlementForm((prev) => ({ ...prev, settled_at: nextDate }))}
                      sheetTitle="Select settlement date"
                    />
                  </div>
                </div>

                <div className="mb-4">
                  <Input
                    label="Note"
                    value={settlementForm.note}
                    onChange={(event) => setSettlementForm((prev) => ({ ...prev, note: event.target.value }))}
                    placeholder="Optional"
                  />
                </div>

                <Button
                  variant="primary"
                  size="xl"
                  fullWidth
                  onClick={() => { void handleRecordSettlement() }}
                  loading={saving === 'settlement' || saving === 'settlement-edit'}
                >
                  {editSettlement ? (saving === 'settlement-edit' ? 'Updating…' : 'Update Settlement') : (saving === 'settlement' ? 'Recording…' : 'Record Settlement')}
                </Button>
        </Sheet>
      </AnimatePresence>

      <AnimatePresence>
        <Sheet
          open={showBannerPicker}
          onClose={() => setShowBannerPicker(false)}
          title="Trip Banner"
          contentClassName="px-5 pt-2 pb-8 overflow-y-auto max-h-[85vh]"
        >
                <div className="grid grid-cols-2 gap-3">
                  {BANNERS.map((banner) => (
                    <button
                      key={banner.id}
                      onClick={() => changeBanner(banner.id)}
                      className={`relative flex flex-col items-start gap-1 p-1 overflow-hidden transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] active:scale-[0.98] rounded-card ${savedBannerId === banner.id ? 'ring-2 ring-brand ring-offset-1' : ''}`}
                    >
                      <div className="h-20 w-full rounded-card overflow-hidden bg-kosha-surface-2 border border-kosha-border object-cover">
                        <img src={banner.src} alt={banner.name} className="h-full w-full object-cover" loading="lazy" />
                      </div>
                      <span className="text-[11px] font-semibold text-ink px-1 truncate">{banner.name}</span>
                    </button>
                  ))}
                </div>
        </Sheet>
      </AnimatePresence>

      <AnimatePresence>
        <Sheet
          open={showEditGroup}
          onClose={() => setShowEditGroup(false)}
          title="Trip Settings"
          contentClassName="px-5 pt-2 pb-8 overflow-y-auto max-h-[85vh]"
        >

                {!activeGroup?.is_archived && (
                  <>
                    <div className="mb-4">
                      <Input
                        label="Trip Name"
                        value={editGroupForm.name}
                        onChange={(e) => setEditGroupForm((prev) => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g. Goa 2026"
                        maxLength={50}
                      />
                    </div>

                    <Button
                      variant="primary"
                      size="xl"
                      fullWidth
                      onClick={() => { void handleUpdateGroup() }}
                      loading={saving === 'group-edit'}
                      className="mb-4"
                    >
                      Update Name
                    </Button>
                  </>
                )}

                <div className="space-y-3">
                  <button
                    type="button"
                    onClick={(e) => void handleToggleArchive(e, activeGroupId, activeGroup?.is_archived)}
                    disabled={!!saving}
                    className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors ${activeGroup?.is_archived
                        ? 'border-brand/20 bg-brand/10 hover:bg-brand/20'
                        : 'border-warning-text/20 bg-warning-text/10 hover:bg-warning-text/20'
                      }`}
                  >
                    {activeGroup?.is_archived ? (
                      <ArrowUUpLeft size={20} className="text-brand shrink-0" />
                    ) : (
                      <Archive size={20} className="text-warning-text shrink-0" />
                    )}
                    <div>
                      <p className={`text-[14px] font-bold ${activeGroup?.is_archived ? 'text-brand' : 'text-warning-text'}`}>
                        {activeGroup?.is_archived ? 'Restore from Archive' : 'Archive Trip'}
                      </p>
                      <p className={`mt-0.5 text-[12px] leading-tight ${activeGroup?.is_archived ? 'text-brand/80' : 'text-warning-text/80'}`}>
                        {activeGroup?.is_archived
                          ? 'Make this trip active again to add expenses and new members.'
                          : 'Lock this trip. Prevents adding new expenses or members.'}
                      </p>
                    </div>
                  </button>

                  <Button
                    variant="danger"
                    size="xl"
                    fullWidth
                    onClick={() => { setShowEditGroup(false); void handleDeleteGroup(); }}
                    loading={saving === 'group-delete'}
                  >
                    Delete Trip Forever
                  </Button>
                </div>
        </Sheet>
      </AnimatePresence>
        </>,
        document.body
      )}

      
      <PartnerViewBanner />
    </PageHeaderPage>
  )
}
import GroupList from '../components/splitwise/GroupList'
import ActiveGroupView from '../components/splitwise/ActiveGroupView'
import { useSplitwiseLogic, readBannerFromStorage, defaultSplitInput } from '../hooks/useSplitwiseLogic'

