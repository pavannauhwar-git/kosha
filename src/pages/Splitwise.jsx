import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Plus, Users, ArrowRightLeft, ReceiptText, X, Link2, Trash2, ChevronLeft, Settings2, Archive, ArchiveRestore } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import PageHeaderPage from '../components/layout/PageHeaderPage'
import Button from '../components/ui/Button'
import PixelDatePicker from '../components/ui/PixelDatePicker'
import EmptyState from '../components/common/EmptyState'
import SkeletonLayout from '../components/common/SkeletonLayout'
import AppToast from '../components/common/AppToast'
import { useAuth } from '../context/AuthContext'
import { getAuthUserId } from '../lib/authStore'
import { supabase } from '../lib/supabase'
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
  useSplitwiseRealtime,
  leaveSplitGroupMutation,
  toggleArchiveSplitGroupMutation,
  updateSplitGroupMutation,
  setSplitGroupAccessRoleMutation,
} from '../hooks/useSplitwise'
import { fmt, fmtDate } from '../lib/utils'

import { downloadCsv, toCsv } from '../lib/csv'
import { shareLink } from '../lib/share'

const BANNERS = [
  { id: 'goa', name: 'Goa (Beaches)', src: '/banners/goa.png' },
  { id: 'gujarat', name: 'Gujarat (Rann)', src: '/banners/gujarat.png' },
  { id: 'karnataka', name: 'Karnataka (Hampi)', src: '/banners/karnataka.png' },
  { id: 'kerala', name: 'Kerala (Backwaters)', src: '/banners/kerala.png' },
  { id: 'meghalaya', name: 'Meghalaya (Waterfalls)', src: '/banners/meghalaya.png' },
  { id: 'rajasthan', name: 'Rajasthan (Palace)', src: '/banners/rajasthan.png' },
  { id: 'uttarakhand', name: 'Uttarakhand (Himalayas)', src: '/banners/uttarakhand.png' },
  { id: 'himachal', name: 'Himachal (Mountains)', src: '/banners/himachal.png' },
  { id: 'maharashtra', name: 'Maharashtra (Sahyadri)', src: '/banners/maharashtra.png' },
  { id: 'tamil_nadu', name: 'Tamil Nadu (Temples)', src: '/banners/tamil_nadu.png' },
  { id: 'punjab', name: 'Punjab (Golden Fields)', src: '/banners/punjab.png' },
  { id: 'sikkim', name: 'Sikkim (Monasteries)', src: '/banners/sikkim.png' },
]

const SPLIT_METHOD_OPTIONS = [
  { key: 'equal', label: 'Equal' },
  { key: 'exact', label: 'Exact' },
  { key: 'percent', label: 'Percent' },
  { key: 'shares', label: 'Shares' },
]

function extractErrorMessage(error) {
  return String(error?.message || '').toLowerCase()
}

function isSplitwiseSchemaMissing(error) {
  const message = extractErrorMessage(error)
  return (
    message.includes('split_groups') ||
    message.includes('split_group_members') ||
    message.includes('split_expenses') ||
    message.includes('split_expense_splits') ||
    message.includes('split_settlements') ||
    message.includes('does not exist')
  )
}

function memberName(member, profilesByUserId = null) {
  const direct = String(member?.display_name || '').trim()
  if (direct) return direct

  const profileName = String(
    profilesByUserId?.[member?.linked_user_id]?.display_name || ''
  ).trim()
  if (profileName) return profileName

  return 'Member'
}

function memberAvatarUrl(member, profilesByUserId = null) {
  const avatar = String(
    profilesByUserId?.[member?.linked_user_id]?.avatar_url || ''
  ).trim()
  return avatar || null
}

function memberInitial(name) {
  const label = String(name || '').trim()
  return (label[0] || 'M').toUpperCase()
}

function defaultSplitInput() {
  return {
    enabled: true,
    exact: '',
    percent: '',
    shares: '',
  }
}

export default function Splitwise() {
  const { user, profile } = useAuth()
  const [activeGroupId, setActiveGroupId] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const authUserId = getAuthUserId()

  const {
    groups,
    members,
    groupAccessRows,
    expenses,
    settlements,
    balances,
    suggestedTransfers,
    loading,
    groupsLoading,
    error,
  } = useSplitwise({ groupId: activeGroupId, enabled: true })

  useSplitwiseRealtime()

  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [showSettlement, setShowSettlement] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [newMemberName, setNewMemberName] = useState('')

  const [toast, setToast] = useState(null)
  const [saving, setSaving] = useState('')
  const [consumingInvite, setConsumingInvite] = useState(false)
  const [invitePreview, setInvitePreview] = useState(null)
  const [memberProfilesByUserId, setMemberProfilesByUserId] = useState({})
  const [editExpense, setEditExpense] = useState(null)
  const [editSettlement, setEditSettlement] = useState(null)

  const [showBannerPicker, setShowBannerPicker] = useState(false)
  const [savedBannerId, setSavedBannerId] = useState('goa')

  const [showEditGroup, setShowEditGroup] = useState(false)
  const [editGroupForm, setEditGroupForm] = useState({ name: '' })
  const [showArchived, setShowArchived] = useState(false)

  // archivedIds removed in favor of global database state

  const groupFormObj = {
    name: '',
  }
  const [groupForm, setGroupForm] = useState(groupFormObj)

  const [expenseForm, setExpenseForm] = useState({
    description: '',
    amount: '',
    expense_date: new Date().toISOString().slice(0, 10),
    paid_by_member_id: '',
    split_method: 'equal',
    notes: '',
  })
  const [splitInputs, setSplitInputs] = useState({})

  const [settlementForm, setSettlementForm] = useState({
    payer_member_id: '',
    payee_member_id: '',
    amount: '',
    settled_at: new Date().toISOString().slice(0, 10),
    note: '',
  })

  useEffect(() => {
    if (!groups.length) {
      if (activeGroupId) {
        setActiveGroupId('')
      }
      return
    }

    if (activeGroupId && !groups.some((group) => group.id === activeGroupId)) {
      setActiveGroupId('')
    } else if (activeGroupId) {
      const stored = localStorage.getItem(`kosha-trip-banner-${activeGroupId}`)
      setSavedBannerId(stored || 'goa')
    }
  }, [groups, activeGroupId])

  const changeBanner = (id) => {
    setSavedBannerId(id)
    if (activeGroupId) {
      localStorage.setItem(`kosha-trip-banner-${activeGroupId}`, id)
    }
    setShowBannerPicker(false)
  }

  const activeBanner = useMemo(() => BANNERS.find(b => b.id === savedBannerId) || BANNERS[0], [savedBannerId])

  const handleUpdateGroup = async () => {
    if (!editGroupForm.name.trim()) return setToast('Name is required.')
    try {
      setSaving('group-edit')
      await updateSplitGroupMutation({ groupId: activeGroupId, name: editGroupForm.name })
      setToast('Trip updated.')
      setShowEditGroup(false)
    } catch (error) {
      setToast(extractErrorMessage(error))
    } finally {
      setSaving('')
    }
  }

  const handleToggleArchive = async (e, groupId, currentStatus) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    setSaving('archive')
    try {
      await toggleArchiveSplitGroupMutation(groupId, !currentStatus)
      if (!currentStatus) setShowEditGroup(false)
      setToast(!currentStatus ? 'Trip archived (Read Only).' : 'Trip restored.')
    } catch (err) {
      setToast(err?.message || 'Could not toggle archive status.')
    } finally {
      setSaving('')
    }
  }

  const handleExportLedger = () => {
    if (!expenses.length && !settlements.length) return
    const headers = ['Type', 'Date', 'Description', 'Amount', 'Paid_By', 'Paid_To']
    const rows = []
    expenses.forEach(e => {
      rows.push([
        'Expense',
        e.expense_date || '',
        e.description || '',
        e.amount || 0,
        members.find(m => m.id === e.paid_by_member_id)?.display_name || 'Unknown',
        ''
      ])
    })
    settlements.forEach(e => {
      rows.push([
        'Settlement',
        e.settled_at || '',
        'Settlement Payment',
        e.amount || 0,
        members.find(m => m.id === e.payer_member_id)?.display_name || 'Unknown',
        members.find(m => m.id === e.payee_member_id)?.display_name || 'Unknown'
      ])
    })
    downloadCsv(`kosha-trip-${activeGroup?.name || 'ledger'}.csv`, toCsv(headers, rows))
  }
  useEffect(() => {
    if (!members.length) {
      setExpenseForm((prev) => (prev.paid_by_member_id ? { ...prev, paid_by_member_id: '' } : prev))
      setSettlementForm((prev) => {
        if (!prev.payer_member_id && !prev.payee_member_id) return prev
        return { ...prev, payer_member_id: '', payee_member_id: '' }
      })
      setSplitInputs((prev) => (Object.keys(prev).length ? {} : prev))
      return
    }

    const preferredPayer = members.find((member) => member.linked_user_id === authUserId)?.id || members[0]?.id || ''
    const preferredPayee = members.find((member) => member.linked_user_id !== authUserId)?.id || members[0]?.id || ''

    setExpenseForm((prev) => {
      const nextPaidBy = prev.paid_by_member_id && members.some((member) => member.id === prev.paid_by_member_id)
        ? prev.paid_by_member_id
        : preferredPayer
      if (nextPaidBy === prev.paid_by_member_id) return prev
      return {
        ...prev,
        paid_by_member_id: nextPaidBy,
      }
    })

    setSettlementForm((prev) => {
      const nextPayer = prev.payer_member_id && members.some((member) => member.id === prev.payer_member_id)
        ? prev.payer_member_id
        : preferredPayer
      const nextPayee = prev.payee_member_id && members.some((member) => member.id === prev.payee_member_id)
        ? prev.payee_member_id
        : preferredPayee
      if (nextPayer === prev.payer_member_id && nextPayee === prev.payee_member_id) return prev
      return {
        ...prev,
        payer_member_id: nextPayer,
        payee_member_id: nextPayee,
      }
    })

    setSplitInputs((prev) => {
      const next = {}
      const memberIds = new Set()
      let changed = false

      for (const member of members) {
        memberIds.add(member.id)
        if (prev[member.id]) {
          next[member.id] = prev[member.id]
        } else {
          next[member.id] = defaultSplitInput()
          changed = true
        }
      }

      if (!changed) {
        for (const memberId of Object.keys(prev)) {
          if (!memberIds.has(memberId)) {
            changed = true
            break
          }
        }
      }

      return changed ? next : prev
    })
  }, [members, authUserId])

  const memberById = useMemo(() => {
    const map = new Map()
    for (const member of members) {
      map.set(member.id, member)
    }
    return map
  }, [members])

  const roleByUserId = useMemo(() => {
    const map = new Map()
    for (const row of groupAccessRows || []) {
      if (row?.user_id) {
        map.set(row.user_id, row.role || 'viewer')
      }
    }
    return map
  }, [groupAccessRows])

  const accountDisplayName = useMemo(() => {
    const profileName = String(profile?.display_name || '').trim()
    if (profileName) return profileName

    const fullName = String(user?.user_metadata?.full_name || '').trim()
    if (fullName) return fullName

    const email = String(user?.email || '').trim()
    if (email.includes('@')) return email.split('@')[0]

    return 'My Account'
  }, [profile?.display_name, user?.user_metadata?.full_name, user?.email])

  useEffect(() => {
    const linkedUserIds = [...new Set(
      (members || []).map((member) => member?.linked_user_id).filter(Boolean)
    )]

    if (!activeGroupId || !linkedUserIds.length) {
      setMemberProfilesByUserId((prev) => (Object.keys(prev).length ? {} : prev))
      return
    }

    let cancelled = false

    async function loadMemberProfiles() {
      const { data, error: profileError } = await supabase.rpc('split_group_member_profiles', {
        p_group_id: activeGroupId,
      })

      if (cancelled || profileError) return

      const next = {}
      for (const row of data || []) {
        if (row?.user_id) {
          next[row.user_id] = row
        }
      }
      setMemberProfilesByUserId(next)
    }

    void loadMemberProfiles()
    return () => {
      cancelled = true
    }
  }, [members, activeGroupId])

  const resolveMemberName = (member) => memberName(member, memberProfilesByUserId)
  const resolveMemberAvatar = (member) => memberAvatarUrl(member, memberProfilesByUserId)

  const selfMember = useMemo(
    () => members.find((member) => member.linked_user_id === authUserId) || members.find((member) => member.is_self) || null,
    [members, authUserId]
  )

  const selfNet = useMemo(() => {
    if (!selfMember?.id) return 0
    const row = balances.find((entry) => entry?.member?.id === selfMember.id)
    return round2(row?.net || 0)
  }, [balances, selfMember?.id])

  const totalExpenses = useMemo(
    () => round2(expenses.reduce((sum, expense) => sum + Number(expense?.amount || 0), 0)),
    [expenses]
  )

  const activeGroupsList = useMemo(() => groups.filter((g) => !g.is_archived), [groups])
  
  const ownedGroupsCount = useMemo(
    () => activeGroupsList.filter((group) => group.my_role === 'admin' || group.user_id === authUserId).length,
    [activeGroupsList, authUserId]
  )

  const sharedGroupsCount = Math.max(0, activeGroupsList.length - ownedGroupsCount)

  const schemaMissing = isSplitwiseSchemaMissing(error)
  const activeGroup = useMemo(
    () => groups.find((group) => group.id === activeGroupId) || null,
    [groups, activeGroupId]
  )
  const isGroupAdmin = !!activeGroup && (activeGroup.my_role === 'admin' || activeGroup.user_id === authUserId)
  // If a group is archived, NO ONE can manage expenses/members unless they unarchive it first
  const canManageGroup = !!activeGroup && !activeGroup.is_archived && (activeGroup.my_role === 'admin' || activeGroup.my_role === 'member' || activeGroup.user_id === authUserId)
  const isViewOnly = !!activeGroup && !canManageGroup
  const inviteTokenFromQuery = String(searchParams.get('splitInvite') || '').trim()

  function clearPendingSplitInviteToken() {
    try {
      sessionStorage.removeItem('pendingSplitGroupInviteToken')
    } catch {
      // no-op
    }

    if (inviteTokenFromQuery) {
      const next = new URLSearchParams(searchParams)
      next.delete('splitInvite')
      setSearchParams(next, { replace: true })
    }
  }

  useEffect(() => {
    let inviteToken = inviteTokenFromQuery

    if (!inviteToken) {
      try {
        inviteToken = String(sessionStorage.getItem('pendingSplitGroupInviteToken') || '').trim()
      } catch {
        inviteToken = ''
      }
    }

    if (!inviteToken || consumingInvite || invitePreview?.token === inviteToken) return

    let cancelled = false

    async function previewInvite() {
      try {
        const preview = await previewSplitGroupInviteMutation(inviteToken)
        if (cancelled) return
        setInvitePreview({
          token: inviteToken,
          groupId: preview.group_id,
          groupName: preview.group_name,
          invitedRole: preview.invited_role || 'viewer',
        })
      } catch (previewError) {
        if (cancelled) return
        setToast(previewError?.message || 'Could not open shared group invite.')
        clearPendingSplitInviteToken()
      }
    }

    void previewInvite()
    return () => {
      cancelled = true
    }
  }, [inviteTokenFromQuery, searchParams, setSearchParams, consumingInvite, invitePreview?.token])

  function closeSheets() {
    setShowCreateGroup(false)
    setShowAddExpense(false)
    setShowSettlement(false)
    setShowAddMember(false)
    setEditExpense(null)
    setEditSettlement(null)
    setNewMemberName('')
  }

  async function handleCreateGroup() {
    const name = String(groupForm.name || '').trim()

    if (!name) {
      setToast('Group name is required.')
      return
    }

    setSaving('group')
    try {
      const created = await createSplitGroupMutation({ name, selfDisplayName: accountDisplayName })
      setActiveGroupId(created.id)
      setGroupForm({ name: '' })
      setShowCreateGroup(false)
    } catch (createError) {
      setToast(createError?.message || 'Could not create group.')
    } finally {
      setSaving('')
    }
  }

  async function handleCreateGroupInvite() {
    if (!activeGroupId || !isGroupAdmin || saving) return

    setSaving('group-invite')
    try {
      const invite = await createSplitGroupInviteMutation({ groupId: activeGroupId })
      const url = `${window.location.origin}/splitwise/join/${invite.token}`

      const result = await shareLink({
        title: 'Join Trip on Kosha',
        url: url,
      })

      if (result.success) {
        if (result.method === 'share') {
          // Already shared via native sheet
        } else {
          setToast('Invite link copied.')
        }
      } else if (!result.aborted) {
        setToast(url)
      }
    } catch (inviteError) {
      setToast(inviteError?.message || 'Could not create group invite.')
    } finally {
      setSaving('')
    }
  }

  async function handleConfirmInviteJoin() {
    if (!invitePreview?.token || consumingInvite) return

    setConsumingInvite(true)
    try {
      const joinedGroup = await consumeSplitGroupInviteMutation(invitePreview.token)
      if (joinedGroup?.id) setActiveGroupId(joinedGroup.id)
      setToast(`Joined ${joinedGroup?.name || invitePreview.groupName} as ${accountDisplayName}.`)
    } catch (consumeError) {
      setToast(consumeError?.message || 'Could not join shared group invite.')
    } finally {
      setConsumingInvite(false)
      setInvitePreview(null)
      clearPendingSplitInviteToken()
    }
  }

  function handleDismissInvitePreview() {
    setInvitePreview(null)
    clearPendingSplitInviteToken()
  }

  async function handleDeleteGroup() {
    if (!activeGroupId || !isGroupAdmin || saving) return

    const ok = window.confirm('Delete this group permanently? This removes members, expenses, and settlements.')
    if (!ok) return

    setSaving('group-delete')
    try {
      await deleteSplitGroupMutation(activeGroupId)
      setToast('Group deleted.')
      setActiveGroupId('')
      closeSheets()
    } catch (deleteError) {
      setToast(deleteError?.message || 'Could not delete group.')
    } finally {
      setSaving('')
    }
  }

  async function handleSetMemberRole(member, role) {
    if (!isGroupAdmin) {
      setToast('Only admins can change member roles.')
      return
    }

    if (!activeGroupId || !member?.linked_user_id) return

    setSaving(`member-role-${member.id}`)
    try {
      await setSplitGroupAccessRoleMutation({
        groupId: activeGroupId,
        memberUserId: member.linked_user_id,
        role,
      })
      setToast(role === 'admin' ? 'Member promoted to admin.' : role === 'member' ? 'Changed to member.' : 'Changed to viewer.')
    } catch (roleError) {
      setToast(roleError?.message || 'Could not update member role.')
    } finally {
      setSaving('')
    }
  }

  async function handleDeleteMember(memberId) {
    if (!isGroupAdmin || saving) return
    const ok = window.confirm('Delete this member? This cannot be undone.')
    if (!ok) return

    setSaving(`delete-${memberId}`)
    try {
      await deleteSplitMemberMutation(memberId)
      setToast('Member removed.')
    } catch (err) {
      setToast(err?.message || 'Could not remove member.')
    } finally {
      setSaving('')
    }
  }

  async function handleLeaveGroup() {
    if (!activeGroupId || saving) return
    const ok = window.confirm('Are you sure you want to leave this group?')
    if (!ok) return

    setSaving('leave-group')
    try {
      await leaveSplitGroupMutation(activeGroupId)
      setToast('You left the group.')
      setActiveGroupId(null)
    } catch (err) {
      setToast(err?.message || 'Could not leave group.')
    } finally {
      setSaving('')
    }
  }

  async function handleAddMember() {
    if (!isGroupAdmin || saving) return
    const name = String(newMemberName || '').trim()
    if (!name) {
      setToast('Name is required.')
      return
    }

    setSaving('add-member')
    try {
      await addSplitMemberMutation({ groupId: activeGroupId, displayName: name })
      setToast('Member added.')
      setShowAddMember(false)
      setNewMemberName('')
    } catch (err) {
      setToast(err?.message || 'Could not add member.')
    } finally {
      setSaving('')
    }
  }

  function buildSplitsPayload(method, amount) {
    const selectedMemberIds = members
      .filter((member) => splitInputs[member.id]?.enabled)
      .map((member) => member.id)

    if (!selectedMemberIds.length) {
      throw new Error('Select at least one participant for this expense.')
    }

    if (method === 'equal') {
      return buildEqualSplits(selectedMemberIds, amount)
    }

    if (method === 'exact') {
      return buildExactSplits(
        selectedMemberIds.map((memberId) => ({
          member_id: memberId,
          share: Number(splitInputs[memberId]?.exact || 0),
        })),
        amount
      )
    }

    if (method === 'percent') {
      return buildPercentSplits(
        selectedMemberIds.map((memberId) => ({
          member_id: memberId,
          percent: Number(splitInputs[memberId]?.percent || 0),
        })),
        amount
      )
    }

    return buildShareSplits(
      selectedMemberIds.map((memberId) => ({
        member_id: memberId,
        shares: Number(splitInputs[memberId]?.shares || 0),
      })),
      amount
    )
  }

  async function handleAddExpense() {
    if (!canManageGroup) {
      setToast('You have view-only access for this group.')
      return
    }

    if (!activeGroupId) {
      setToast('Select a group first.')
      return
    }

    const description = String(expenseForm.description || '').trim()
    const amount = round2(expenseForm.amount)

    if (!description) {
      setToast('Expense description is required.')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setToast('Expense amount must be positive.')
      return
    }
    if (!expenseForm.paid_by_member_id) {
      setToast('Select who paid for this expense.')
      return
    }

    let splits
    try {
      splits = buildSplitsPayload(expenseForm.split_method, amount)
    } catch (splitError) {
      setToast(splitError?.message || 'Invalid split configuration.')
      return
    }

    setSaving(editExpense ? 'expense-edit' : 'expense')
    try {
      if (editExpense) {
        await deleteSplitExpenseMutation(editExpense.id)
      }

      await addSplitExpenseMutation({
        groupId: activeGroupId,
        paidByMemberId: expenseForm.paid_by_member_id,
        description,
        amount,
        expenseDate: expenseForm.expense_date,
        splitMethod: expenseForm.split_method,
        notes: expenseForm.notes,
        splits,
      })

      setExpenseForm((prev) => ({
        ...prev,
        description: '',
        amount: '',
        notes: '',
      }))
      setEditExpense(null)
      setShowAddExpense(false)
      setToast(editExpense ? 'Expense updated.' : 'Expense added.')
    } catch (expenseError) {
      setToast(expenseError?.message || 'Could not save expense.')
    } finally {
      setSaving('')
    }
  }

  async function handleRecordSettlement() {
    if (!canManageGroup) {
      setToast('You have view-only access for this group.')
      return
    }

    if (!activeGroupId) {
      setToast('Select a group first.')
      return
    }

    const amount = round2(settlementForm.amount)
    if (!settlementForm.payer_member_id || !settlementForm.payee_member_id) {
      setToast('Select both payer and payee.')
      return
    }
    if (settlementForm.payer_member_id === settlementForm.payee_member_id) {
      setToast('Payer and payee cannot be the same.')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setToast('Settlement amount must be positive.')
      return
    }

    setSaving(editSettlement ? 'settlement-edit' : 'settlement')
    try {
      if (editSettlement) {
        await deleteSplitSettlementMutation(editSettlement.id)
      }

      await recordSplitSettlementMutation({
        groupId: activeGroupId,
        payerMemberId: settlementForm.payer_member_id,
        payeeMemberId: settlementForm.payee_member_id,
        amount,
        settledAt: settlementForm.settled_at,
        note: settlementForm.note,
      })
      setSettlementForm((prev) => ({
        ...prev,
        amount: '',
        note: '',
      }))
      setEditSettlement(null)
      setShowSettlement(false)
      setToast(editSettlement ? 'Settlement updated.' : 'Settlement recorded.')
    } catch (settleError) {
      setToast(settleError?.message || 'Could not save settlement.')
    } finally {
      setSaving('')
    }
  }

  function openEditExpense(expense) {
    if (!canManageGroup) return
    setEditExpense(expense)
    setExpenseForm({
      description: expense.description || '',
      amount: String(expense.amount || ''),
      expense_date: expense.expense_date || new Date().toISOString().slice(0, 10),
      paid_by_member_id: expense.paid_by_member_id || '',
      split_method: expense.split_method || 'equal',
      notes: expense.notes || '',
    })

    const nextSplits = {}
    members.forEach((m) => {
      const split = expense.split_expense_splits?.find((s) => s.member_id === m.id)
      nextSplits[m.id] = {
        enabled: !!split,
        exact: split?.share ? String(split.share) : '',
        percent: split?.percent ? String(split.percent) : '',
        shares: split?.shares ? String(split.shares) : '',
      }
    })
    setSplitInputs(nextSplits)
    setShowAddExpense(true)
  }

  function openEditSettlement(s) {
    if (!canManageGroup) return
    setEditSettlement(s)
    setSettlementForm({
      payer_member_id: s.payer_member_id || '',
      payee_member_id: s.payee_member_id || '',
      amount: String(s.amount || ''),
      settled_at: s.settled_at || new Date().toISOString().slice(0, 10),
      note: s.note || '',
    })
    setShowSettlement(true)
  }

  async function handleDeleteExpense(expenseId) {
    if (!canManageGroup) {
      setToast('You have view-only access for this group.')
      return
    }

    if (!expenseId || saving) return
    setSaving(`expense-delete-${expenseId}`)
    try {
      await deleteSplitExpenseMutation(expenseId)
    } catch (deleteError) {
      setToast(deleteError?.message || 'Could not delete expense.')
    } finally {
      setSaving('')
    }
  }

  async function handleDeleteSettlement(settlementId) {
    if (!canManageGroup) {
      setToast('You have view-only access for this group.')
      return
    }

    if (!settlementId || saving) return
    setSaving(`settlement-delete-${settlementId}`)
    try {
      await deleteSplitSettlementMutation(settlementId)
    } catch (deleteError) {
      setToast(deleteError?.message || 'Could not delete settlement.')
    } finally {
      setSaving('')
    }
  }

  function applySuggestedTransfer(transfer) {
    if (!transfer?.from?.id || !transfer?.to?.id || !transfer?.amount) return
    setSettlementForm((prev) => ({
      ...prev,
      payer_member_id: transfer.from.id,
      payee_member_id: transfer.to.id,
      amount: String(round2(transfer.amount)),
    }))
    setShowSettlement(true)
  }

  const methodLabel = useMemo(() => {
    const found = SPLIT_METHOD_OPTIONS.find((option) => option.key === expenseForm.split_method)
    return found?.label || 'Equal'
  }, [expenseForm.split_method])

  const transactions = useMemo(() => {
    const list = [
      ...(expenses || []).map(e => ({ ...e, type: 'expense', sortDate: e.expense_date || e.created_at })),
      ...(settlements || []).map(s => ({ ...s, type: 'settlement', sortDate: s.settled_at || s.created_at }))
    ]
    return list.sort((a, b) => new Date(b.sortDate) - new Date(a.sortDate))
  }, [expenses, settlements])

  return (
    <PageHeaderPage title="Splitwise">
      {!schemaMissing && (
        <div className="mb-3 flex items-start justify-between gap-2">
          {activeGroup ? (
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => {
                  closeSheets()
                  setActiveGroupId('')
                }}
                className="inline-flex items-center gap-1 text-[11px] text-ink-3"
              >
                <ChevronLeft size={13} /> All groups
              </button>
              <p className="mt-1 truncate text-[15px] font-semibold text-ink">{activeGroup.name}</p>
            </div>
          ) : (
            <div className="min-w-0 flex-1">
              <p className="text-[12px] text-ink-3">Split groups</p>
              <p className="mt-1 text-[15px] font-semibold text-ink">
                {(() => {
                  const activeCount = groups.filter(g => !g.is_archived).length
                  return activeCount ? `${activeCount} active group${activeCount === 1 ? '' : 's'}` : 'Start your first group'
                })()}
              </p>
            </div>
          )}

          <div className="flex shrink-0 items-center gap-1.5">
            {isGroupAdmin && !activeGroup?.is_archived && (
              <Button
                variant="secondary"
                size="sm"
                icon={<Link2 size={13} />}
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
                icon={<Settings2 size={13} />}
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
                loading={saving === 'leave-group'}
              >
                Leave
              </Button>
            )}

            {!activeGroupId && (
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
          imageUrl="/illustrations/splitwise_group.png"
          title="No split group yet"
          description="Create a group, invite Kosha users, and split expenses together."
          actionLabel="Create group"
          onAction={() => setShowCreateGroup(true)}
        />
      ) : !activeGroup ? (
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="card p-3">
              <p className="text-[10px] text-ink-3">Admin in</p>
              <p className="mt-1 text-[15px] font-semibold text-ink tabular-nums">{ownedGroupsCount}</p>
            </div>
            <div className="card p-3">
              <p className="text-[10px] text-ink-3">Member in</p>
              <p className="mt-1 text-[15px] font-semibold text-ink tabular-nums">{sharedGroupsCount}</p>
            </div>
          </div>

          <div className="card p-3.5">
            <div className="flex items-center justify-between mb-2">
              <p className="section-label">Open a trip</p>
              <button
                onClick={() => setShowArchived(p => !p)}
                className="text-[11px] font-semibold text-ink-3 border border-kosha-border rounded-pill px-2 pl-1.5 py-0.5 hover:bg-kosha-surface-2 flex items-center gap-1 transition-colors"
              >
                <Archive size={10} /> {showArchived ? 'Hide Archived' : 'Show Archived'}
              </button>
            </div>
            <div className="space-y-2">
              {groups.filter(g => showArchived ? g.is_archived : !g.is_archived).length === 0 ? (
                <EmptyState
                  className="py-6"
                  imageUrl="/illustrations/splitwise_group.png"
                  title={showArchived ? "No archived groups" : "No active groups"}
                  description={showArchived ? "You don't have any archived groups." : "Create or join a new group."}
                />
              ) : groups.filter(g => showArchived ? g.is_archived : !g.is_archived).map((group) => {
                const isAdmin = group.my_role === 'admin' || group.user_id === authUserId
                const bgBannerId = localStorage.getItem(`kosha-trip-banner-${group.id}`) || 'goa'
                const bgBanner = BANNERS.find(b => b.id === bgBannerId) || BANNERS[0]
                return (
                  <button
                    key={group.id}
                    type="button"
                    onClick={() => setActiveGroupId(group.id)}
                    className="relative w-full h-24 overflow-hidden rounded-card text-left hover:scale-[1.02] transition-transform shadow-sm"
                  >
                    <div className="absolute inset-0 z-0">
                      <img src={bgBanner.src} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
                    </div>
                    <div className="relative z-10 px-3.5 py-3 h-full flex flex-col justify-between">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-bold text-white shadow-sm">{group.name}</p>
                          <p className="mt-0.5 text-[11px] font-medium text-white/80">
                            Updated {fmtDate(group.updated_at || group.created_at)}
                          </p>
                        </div>
                        <span
                          className={`rounded-pill px-2 py-0.5 text-[10px] font-semibold border ${group.is_archived 
                            ? 'bg-kosha-border/60 text-white/70 border-white/10 backdrop-blur-md'
                            : isAdmin
                              ? 'bg-black/40 text-white border-white/20 backdrop-blur-md'
                              : 'bg-black/40 text-white/70 border-white/10 backdrop-blur-md'
                            }`}
                        >
                          {group.is_archived 
                            ? `Archived · Was ${isAdmin ? 'Admin' : group.my_role === 'member' ? 'Member' : 'Viewer'}` 
                            : (isAdmin ? 'Admin' : group.my_role === 'member' ? 'Member' : 'Viewer')}
                        </span>
                      </div>
                      <p className="text-[10px] font-medium text-white/70 shadow-sm">Tap to view balances, expenses, and settlements.</p>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="relative mb-3 overflow-hidden rounded-card">
            <div className="h-40 w-full bg-kosha-surface-2">
              <img src={activeBanner.src} alt={activeBanner.name} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/20 to-transparent" />
            </div>
            <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between">
              <div className="text-white overflow-hidden max-w-[70%]">
                <p className="text-[10px] opacity-80 uppercase tracking-widest truncate">{activeBanner.name}</p>
                <h2 className="text-[22px] font-bold truncate">{activeGroup.name}</h2>
              </div>
              <button
                onClick={() => setShowBannerPicker(true)}
                className="rounded-pill bg-white/20 backdrop-blur-md border border-white/20 px-2.5 py-1 text-[11px] text-white hover:bg-white/30"
              >
                Change Cover
              </button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2.5 mb-3.5">
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

          <div className="card p-3.5 mb-3">
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
                  const memberRole = member.linked_user_id 
                    ? (member.linked_user_id === activeGroup?.user_id ? 'admin' : (roleByUserId.get(member.linked_user_id) || 'viewer')) 
                    : 'viewer'
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
                            <img
                              src={avatarUrl}
                              alt={displayName}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <span className="text-[11px] font-semibold text-ink">{memberInitial(displayName)}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[12px] font-semibold text-ink truncate">
                            {displayName} {isSelfMember ? '(You)' : ''}
                          </p>
                          <p className="text-[10px] text-ink-3 mt-0.5">
                            {memberRole === 'admin' ? 'Admin' : memberRole === 'member' ? 'Member' : 'Viewer'}
                          </p>
                          <p className={`text-[11px] tabular-nums ${net > 0.01 ? 'amt-income' : net < -0.01 ? 'amt-expense' : 'text-ink-3'}`}>
                            {net > 0.01 ? `gets ${fmt(net)}` : net < -0.01 ? `owes ${fmt(Math.abs(net))}` : 'settled'}
                          </p>
                        </div>
                      </div>
                      {isGroupAdmin && !isSelfMember && (
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
                              <Trash2 size={13} />
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

          <div className="card p-3.5 mb-3">
            <p className="section-label mb-2">Who Paid For What</p>
            {members.length === 0 ? (
              <p className="text-[12px] text-ink-3">No members to show.</p>
            ) : (
              <div className="space-y-4 pt-1">
                {members.map(member => {
                  const spent = (expenses || []).filter(e => e.paid_by_member_id === member.id).reduce((sum, e) => sum + Number(e.amount), 0)
                  const percent = totalExpenses > 0 ? (spent / totalExpenses) * 100 : 0
                  return (
                    <div key={member.id} className="w-full">
                      <div className="flex justify-between items-end mb-1.5">
                        <span className="text-[12px] font-semibold text-ink truncate mr-2">{resolveMemberName(member)}</span>
                        <span className="text-[12px] text-ink-3 shrink-0 tabular-nums">{fmt(spent)}</span>
                      </div>
                      <div className="w-full bg-kosha-surface-2 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-brand h-full rounded-full transition-[width] duration-400 ease-[cubic-bezier(0.05,0.7,0.1,1)]" style={{ width: `${percent}%` }}></div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 mb-3">
            <Button
              variant="primary"
              size="md"
              icon={<ReceiptText size={14} />}
              onClick={() => setShowAddExpense(true)}
              disabled={!canManageGroup}
            >
              Add Expense
            </Button>
            <Button
              variant="success"
              size="md"
              icon={<ArrowRightLeft size={14} />}
              onClick={() => setShowSettlement(true)}
              disabled={!canManageGroup}
            >
              Settle Up
            </Button>
          </div>

          <div className="card p-3.5 mb-3">
            <p className="section-label mb-2">Suggested Settlements</p>
            {suggestedTransfers.length === 0 ? (
              <div className="py-4 text-center">
                <img src="/illustrations/coffee_chill.png" className="max-h-[100px] w-auto mx-auto mb-2 mix-blend-multiply [clip-path:inset(2px)]" alt="All caught up" />
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

          <div className="card mb-3 overflow-hidden">
            <div className="p-4 border-b border-kosha-border bg-kosha-surface flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ReceiptText size={16} className="text-brand" />
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
                  <ReceiptText size={18} className="text-ink-3" />
                </div>
                <p className="text-[13px] font-medium text-ink">No transactions yet</p>
                <p className="text-[11px] text-ink-3 mt-1">Add an expense to get started.</p>
              </div>
            ) : (
              <div className="divide-y divide-kosha-border max-h-[500px] overflow-y-auto">
                {transactions.map((t) => {
                  const isExpense = t.type === 'expense'
                  const deleting = saving === (isExpense ? `expense-delete-${t.id}` : `settlement-delete-${t.id}`)

                  return (
                    <div key={t.id} className="p-2 sm:p-2.5 bg-kosha-surface hover:bg-kosha-surface-2 transition-colors group">
                      {isExpense ? (() => {
                        const payer = memberById.get(t.paid_by_member_id)
                        return (
                          <div className="flex items-start justify-between gap-2.5">
                            <div className="flex items-start gap-2.5 min-w-0">
                              <div className="h-8 w-8 rounded-full bg-brand/10 text-brand shrink-0 flex items-center justify-center border border-brand/20 mt-0.5">
                                <ReceiptText size={14} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[13px] font-semibold text-ink truncate leading-tight">{t.description}</p>
                                <p className="text-[11px] text-ink-3 mt-1 truncate">
                                  <span className="font-medium text-ink">{resolveMemberName(payer)}</span> paid
                                </p>
                                <p className="text-[10px] text-ink-3 mt-0.5 opacity-80">{fmtDate(t.sortDate)}</p>
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
                                    {deleting ? '...' : 'Delete'}
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
                                <ArrowRightLeft size={14} />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[13px] font-semibold text-ink truncate leading-tight">Settlement</p>
                                <p className="text-[11px] text-ink-3 mt-1 truncate">
                                  <span className="font-medium text-ink">{resolveMemberName(payer)}</span> paid <span className="font-medium text-ink">{resolveMemberName(payee)}</span>
                                </p>
                                <p className="text-[10px] text-ink-3 mt-0.5 opacity-80">{fmtDate(t.sortDate)}</p>
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
                                    {deleting ? '...' : 'Delete'}
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
            )}
          </div>
        </>
      )}

      <AnimatePresence>
        {invitePreview && (
          <>
            <motion.div
              className="sheet-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, pointerEvents: 'none' }}
              onClick={handleDismissInvitePreview}
            />
            <motion.div
              className="sheet-panel"
              initial={{ y: '100%' }}
              animate={{ y: 0, transition: { type: 'spring', stiffness: 500, damping: 40 } }}
              exit={{ y: '100%', transition: { duration: 0.2 } }}
            >
              <div className="sheet-handle" />
              <div className="px-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="text-display font-bold text-ink">Join Shared Trip</h2>
                  <button type="button" onClick={handleDismissInvitePreview} className="close-btn" aria-label="Close join group sheet">
                    <X size={16} className="text-ink-3" />
                  </button>
                </div>

                <div className="relative mb-4 overflow-hidden rounded-card">
                  <div className="h-32 w-full bg-kosha-surface-2">
                    <img
                      src={(BANNERS.find(b => b.id === (localStorage.getItem(`kosha-trip-banner-${invitePreview.groupId}`) || 'goa')) || BANNERS[0]).src}
                      className="h-full w-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <p className="text-[10px] opacity-80 mb-0.5 tracking-wider uppercase">Trip Invitation</p>
                    <h2 className="text-[20px] font-bold truncate leading-tight">{invitePreview.groupName || 'Shared group'}</h2>
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
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showCreateGroup && (
          <>
            <motion.div
              className="sheet-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, pointerEvents: 'none' }}
              onClick={closeSheets}
            />
            <motion.div
              className="sheet-panel"
              initial={{ y: '100%' }}
              animate={{ y: 0, transition: { type: 'spring', stiffness: 500, damping: 40 } }}
              exit={{ y: '100%', transition: { duration: 0.2 } }}
            >
              <div className="sheet-handle" />
              <div className="px-5">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-display font-bold text-ink">Create Group</h2>
                  <button type="button" onClick={closeSheets} className="close-btn" aria-label="Close create group sheet">
                    <X size={16} className="text-ink-3" />
                  </button>
                </div>

                <div className="list-card mb-3">
                  <label className="list-row w-full cursor-pointer">
                    <span className="text-[14px] text-ink-3">Group Name</span>
                    <input
                      className="flex-1 bg-transparent text-right text-[14px] text-ink outline-none"
                      value={groupForm.name}
                      onChange={(event) => setGroupForm((prev) => ({ ...prev, name: event.target.value }))}
                      placeholder="Trip to Goa"
                    />
                  </label>
                </div>

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
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddMember && (
          <>
            <motion.div
              className="sheet-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, pointerEvents: 'none' }}
              onClick={closeSheets}
            />
            <motion.div
              className="sheet-panel"
              initial={{ y: '100%' }}
              animate={{ y: 0, transition: { type: 'spring', stiffness: 500, damping: 40 } }}
              exit={{ y: '100%', transition: { duration: 0.2 } }}
            >
              <div className="sheet-handle" />
              <div className="px-5">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-display font-bold text-ink">Add Member</h2>
                  <button type="button" onClick={closeSheets} className="close-btn" aria-label="Close add member sheet">
                    <X size={16} className="text-ink-3" />
                  </button>
                </div>

                <div className="list-card mb-4">
                  <label className="list-row w-full cursor-pointer">
                    <span className="text-[14px] text-ink-3">Name</span>
                    <input
                      className="flex-1 bg-transparent text-right text-[14px] text-ink outline-none"
                      value={newMemberName}
                      onChange={(event) => setNewMemberName(event.target.value)}
                      placeholder="Jane Doe"
                      autoFocus
                    />
                  </label>
                </div>

                <Button
                  variant="primary"
                  size="xl"
                  fullWidth
                  onClick={() => { void handleAddMember() }}
                  loading={saving === 'add-member'}
                >
                  Add Member
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showAddExpense && (
          <>
            <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }} onClick={closeSheets} />
            <motion.div
              className="sheet-panel"
              initial={{ y: '100%' }}
              animate={{ y: 0, transition: { type: 'spring', stiffness: 500, damping: 40 } }}
              exit={{ y: '100%', transition: { duration: 0.2 } }}
            >
              <div className="sheet-handle" />
              <div className="px-5 overflow-y-auto">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-display font-bold text-ink">{editExpense ? 'Edit Expense' : 'Add Expense'}</h2>
                  <button type="button" onClick={closeSheets} className="close-btn" aria-label="Close add expense sheet">
                    <X size={16} className="text-ink-3" />
                  </button>
                </div>

                <div className="list-card mb-3">
                  <label className="list-row w-full cursor-pointer">
                    <span className="text-[14px] text-ink-3">Description</span>
                    <input
                      className="flex-1 bg-transparent text-right text-[14px] text-ink outline-none"
                      value={expenseForm.description}
                      onChange={(event) => setExpenseForm((prev) => ({ ...prev, description: event.target.value }))}
                      placeholder="Dinner"
                    />
                  </label>
                </div>

                <div className="list-card mb-3">
                  <label className="list-row w-full cursor-pointer">
                    <span className="text-[14px] text-ink-3">Amount</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      className="flex-1 bg-transparent text-right text-[14px] text-ink outline-none"
                      value={expenseForm.amount}
                      onChange={(event) => setExpenseForm((prev) => ({ ...prev, amount: event.target.value }))}
                      placeholder="0"
                    />
                  </label>
                </div>

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

                <div className="list-card mb-3">
                  <label className="list-row w-full">
                    <span className="text-[14px] text-ink-3">Paid By</span>
                    <select
                      className="flex-1 bg-transparent text-right text-[14px] text-ink outline-none"
                      value={expenseForm.paid_by_member_id}
                      onChange={(event) => setExpenseForm((prev) => ({ ...prev, paid_by_member_id: event.target.value }))}
                    >
                      {members.map((member) => (
                        <option key={member.id} value={member.id}>{resolveMemberName(member)}</option>
                      ))}
                    </select>
                  </label>
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
                    {members.map((member) => {
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
                              type="number"
                              inputMode="decimal"
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
                              type="number"
                              inputMode="decimal"
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
                              type="number"
                              inputMode="decimal"
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

                <div className="list-card mb-4">
                  <label className="list-row w-full cursor-pointer">
                    <span className="text-[14px] text-ink-3">Note</span>
                    <input
                      className="flex-1 bg-transparent text-right text-[14px] text-ink outline-none"
                      value={expenseForm.notes}
                      onChange={(event) => setExpenseForm((prev) => ({ ...prev, notes: event.target.value }))}
                      placeholder="Optional"
                    />
                  </label>
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
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSettlement && (
          <>
            <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }} onClick={closeSheets} />
            <motion.div
              className="sheet-panel"
              initial={{ y: '100%' }}
              animate={{ y: 0, transition: { type: 'spring', stiffness: 500, damping: 40 } }}
              exit={{ y: '100%', transition: { duration: 0.2 } }}
            >
              <div className="sheet-handle" />
              <div className="px-5 overflow-y-auto">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-display font-bold text-ink">{editSettlement ? 'Edit Settlement' : 'Record Settlement'}</h2>
                  <button type="button" onClick={closeSheets} className="close-btn" aria-label="Close settlement sheet">
                    <X size={16} className="text-ink-3" />
                  </button>
                </div>

                <div className="list-card mb-3">
                  <label className="list-row w-full">
                    <span className="text-[14px] text-ink-3">Payer</span>
                    <select
                      className="flex-1 bg-transparent text-right text-[14px] text-ink outline-none"
                      value={settlementForm.payer_member_id}
                      onChange={(event) => setSettlementForm((prev) => ({ ...prev, payer_member_id: event.target.value }))}
                    >
                      {members.map((member) => (
                        <option key={member.id} value={member.id}>{resolveMemberName(member)}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="list-card mb-3">
                  <label className="list-row w-full">
                    <span className="text-[14px] text-ink-3">Payee</span>
                    <select
                      className="flex-1 bg-transparent text-right text-[14px] text-ink outline-none"
                      value={settlementForm.payee_member_id}
                      onChange={(event) => setSettlementForm((prev) => ({ ...prev, payee_member_id: event.target.value }))}
                    >
                      {members.map((member) => (
                        <option key={member.id} value={member.id}>{resolveMemberName(member)}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="list-card mb-3">
                  <label className="list-row w-full cursor-pointer">
                    <span className="text-[14px] text-ink-3">Amount</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      className="flex-1 bg-transparent text-right text-[14px] text-ink outline-none"
                      value={settlementForm.amount}
                      onChange={(event) => setSettlementForm((prev) => ({ ...prev, amount: event.target.value }))}
                      placeholder="0"
                    />
                  </label>
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

                <div className="list-card mb-4">
                  <label className="list-row w-full cursor-pointer">
                    <span className="text-[14px] text-ink-3">Note</span>
                    <input
                      className="flex-1 bg-transparent text-right text-[14px] text-ink outline-none"
                      value={settlementForm.note}
                      onChange={(event) => setSettlementForm((prev) => ({ ...prev, note: event.target.value }))}
                      placeholder="Optional"
                    />
                  </label>
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
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBannerPicker && (
          <>
            <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }} onClick={() => setShowBannerPicker(false)} />
            <motion.div
              className="sheet-panel"
              initial={{ y: '100%' }}
              animate={{ y: 0, transition: { type: 'spring', stiffness: 500, damping: 40 } }}
              exit={{ y: '100%', transition: { duration: 0.2 } }}
            >
              <div className="sheet-handle" />
              <div className="px-5 pb-8 overflow-y-auto max-h-[85vh]">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-display font-bold text-ink">Trip Banner</h2>
                  <button type="button" onClick={() => setShowBannerPicker(false)} className="close-btn" aria-label="Close banner picker">
                    <X size={16} className="text-ink-3" />
                  </button>
                </div>
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
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEditGroup && (
          <>
            <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }} onClick={() => setShowEditGroup(false)} />
            <motion.div
              className="sheet-panel"
              initial={{ y: '100%' }}
              animate={{ y: 0, transition: { type: 'spring', stiffness: 500, damping: 40 } }}
              exit={{ y: '100%', transition: { duration: 0.2 } }}
            >
              <div className="sheet-handle" />
              <div className="px-5 pb-8 overflow-y-auto max-h-[85vh]">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-display font-bold text-ink">Trip Settings</h2>
                  <button type="button" onClick={() => setShowEditGroup(false)} className="close-btn" aria-label="Close edit group">
                    <X size={16} className="text-ink-3" />
                  </button>
                </div>

                {!activeGroup?.is_archived && (
                  <>
                    <div className="list-card mb-4">
                      <label className="list-row w-full cursor-pointer">
                        <span className="text-[14px] text-ink-3">Trip Name</span>
                        <input
                          className="flex-1 bg-transparent text-right text-[14px] text-ink outline-none"
                          value={editGroupForm.name}
                          onChange={(e) => setEditGroupForm((prev) => ({ ...prev, name: e.target.value }))}
                          placeholder="e.g. Goa 2026"
                          maxLength={50}
                        />
                      </label>
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
                    className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors ${
                      activeGroup?.is_archived
                        ? 'border-brand/20 bg-brand/10 hover:bg-brand/20'
                        : 'border-warning-text/20 bg-warning-text/10 hover:bg-warning-text/20'
                    }`}
                  >
                    {activeGroup?.is_archived ? (
                      <ArchiveRestore size={20} className="text-brand shrink-0" />
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
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <AppToast message={toast} onDismiss={() => setToast(null)} />
    </PageHeaderPage>
  )
}
