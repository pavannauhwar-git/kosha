import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom'
import { useAppToast } from '../context/ToastContext'
import { toToastMessage } from '../lib/errorTaxonomy'
import { useAuth } from '../context/AuthContext'
import { getAuthUserId } from '../lib/authStore'
import { supabase } from '../lib/supabase'
import { useActiveWallet } from '../lib/walletStore'
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
} from './useSplitwise'
import { useAppMutation } from './useAppMutation'
import { getCategoriesForType } from '../lib/categories'
import { useUserCategories } from './useUserCategories'
import { todayStr } from '../lib/utils'
import { downloadCsv, toCsv } from '../lib/csv'
import { shareLink } from '../lib/share'
import { readLocalStorage, writeLocalStorage } from '../lib/safeStorage'
import { round2 } from '../lib/paise'
import useWindowedList from './useWindowedList'

const BANNERS = [
  { id: 'goa', name: 'Goa (Beaches)', src: '/banners/goa.webp' },
  { id: 'karnataka', name: 'Karnataka (Hampi)', src: '/banners/karnataka.webp' },
  { id: 'kerala', name: 'Kerala (Backwaters)', src: '/banners/kerala.webp' },
  { id: 'meghalaya', name: 'Waterfalls', src: '/banners/meghalaya.webp' },
  { id: 'rajasthan', name: 'Rajasthan (Palace)', src: '/banners/rajasthan.webp' },
  { id: 'uttarakhand', name: 'Himalayas', src: '/banners/uttarakhand.webp' },
  { id: 'himachal', name: 'Himachal (Mountains)', src: '/banners/himachal.webp' },
  { id: 'maharashtra', name: 'Maharashtra (Sahyadri)', src: '/banners/maharashtra.webp' },
  { id: 'tamil_nadu', name: 'Tamil Nadu (Temples)', src: '/banners/tamil_nadu.webp' },
  { id: 'punjab', name: 'Punjab (Golden Fields)', src: '/banners/punjab.webp' },
  { id: 'sikkim', name: 'Sikkim (Monasteries)', src: '/banners/sikkim.webp' },
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

export function defaultSplitInput() {
  return {
    enabled: true,
    exact: '',
    percent: '',
    shares: '',
  }
}

function bannerStorageKey(groupId) {
  return `kosha-trip-banner-${groupId}`
}

export function readBannerFromStorage(groupId) {
  if (!groupId || typeof window === 'undefined') return null
  return readLocalStorage(bannerStorageKey(groupId), null)
}

function writeBannerToStorage(groupId, bannerId) {
  if (!groupId || typeof window === 'undefined') return
  writeLocalStorage(bannerStorageKey(groupId), bannerId)
}

export function useSplitwiseLogic() {
  const { user, profile } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()

  const createGroup = useAppMutation(createSplitGroupMutation, { context: 'splitwise:createGroup' })
  const addMember = useAppMutation(addSplitMemberMutation, { context: 'splitwise:addMember' })
  const addExpense = useAppMutation(addSplitExpenseMutation, { context: 'splitwise:addExpense' })
  const recordSettlement = useAppMutation(recordSplitSettlementMutation, { context: 'splitwise:settle' })
  const deleteSettlement = useAppMutation(deleteSplitSettlementMutation, { context: 'splitwise:deleteSettlement' })
  const deleteExpense = useAppMutation(deleteSplitExpenseMutation, { context: 'splitwise:deleteExpense' })
  const createGroupInvite = useAppMutation(createSplitGroupInviteMutation, { context: 'splitwise:createInvite' })
  const deleteGroup = useAppMutation(deleteSplitGroupMutation, { context: 'splitwise:deleteGroup' })
  const deleteMember = useAppMutation(deleteSplitMemberMutation, { context: 'splitwise:deleteMember' })
  const leaveGroup = useAppMutation(leaveSplitGroupMutation, { context: 'splitwise:leaveGroup' })
  const toggleArchiveGroup = useAppMutation(
    ({ groupId, isArchived }) => toggleArchiveSplitGroupMutation(groupId, isArchived), 
    { context: 'splitwise:toggleArchive' }
  )
  const previewGroupInvite = useAppMutation(previewSplitGroupInviteMutation, { context: 'splitwise:previewInvite' })
  const consumeGroupInvite = useAppMutation(consumeSplitGroupInviteMutation, { context: 'splitwise:consumeInvite' })
  const updateExpense = useAppMutation(updateSplitExpenseMutation, { context: 'splitwise:updateExpense' })
  const updateGroup = useAppMutation(updateSplitGroupMutation, { context: 'splitwise:updateGroup' })
  const updateGroupBanner = useAppMutation(
    ({ groupId, bannerId }) => updateSplitGroupBannerMutation(groupId, bannerId), 
    { context: 'splitwise:updateBanner' }
  )
  const setMemberRole = useAppMutation(setSplitGroupAccessRoleMutation, { context: 'splitwise:setMemberRole' })

  const [activeGroupId, setActiveGroupId] = useState('')
  const authUserId = getAuthUserId()
  const activeWalletUserId = useActiveWallet()
  const isViewingPartner = !!activeWalletUserId && activeWalletUserId !== authUserId

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

  useUserCategories()
  const expenseCategoryOptions = getCategoriesForType('expense')

  // Deep-link from transaction info sheet: open a specific group
  useEffect(() => {
    const openGroupId = location.state?.openGroupId
    if (!openGroupId) return

    setActiveGroupId(openGroupId)

    const nextState = { ...(location.state || {}) }
    delete nextState.openGroupId

    navigate(
      {
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
      },
      {
        replace: true,
        state: Object.keys(nextState).length ? nextState : null,
      }
    )
  }, [location.hash, location.pathname, location.search, location.state, navigate])

  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [showSettlement, setShowSettlement] = useState(false)
  const [showAddMember, setShowAddMember] = useState(false)
  const [newMemberName, setNewMemberName] = useState('')

  const { pushToast } = useAppToast()
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
    expense_date: todayStr(),
    paid_by_member_id: '',
    split_method: 'equal',
    notes: '',
    transaction_category: 'other',
  })
  const [splitInputs, setSplitInputs] = useState({})
  const actionGuard = useRef(false)
  // Undo-delete state: holds the pending deletion during the 7s undo window.
  const pendingExpenseDeleteRef = useRef(null)   // { expenseId, expense, groupId, timerId }
  const pendingSettlementDeleteRef = useRef(null) // { settlementId, settlement, groupId, timerId }


  const [settlementForm, setSettlementForm] = useState({
    payer_member_id: '',
    payee_member_id: '',
    amount: '',
    settled_at: todayStr(),
    note: '',
  })

  // On unmount: commit any deletion that was still pending in the Undo window.
  useEffect(() => {
    return () => {
      const pe = pendingExpenseDeleteRef.current
      if (pe?.timerId) {
        clearTimeout(pe.timerId)
        void deleteSplitExpenseMutation(pe.expenseId)
      }
      const ps = pendingSettlementDeleteRef.current
      if (ps?.timerId) {
        clearTimeout(ps.timerId)
        void deleteSplitSettlementMutation(ps.settlementId)
      }
    }
  }, [])

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
      const activeGroupObj = groups.find(g => g.id === activeGroupId)
      if (activeGroupObj?.banner_id) {
        setSavedBannerId(activeGroupObj.banner_id)
      } else {
        const stored = readBannerFromStorage(activeGroupId)
        setSavedBannerId(stored || 'goa')
      }
    }
  }, [groups, activeGroupId])

  const changeBanner = async (id) => {
    setSavedBannerId(id)
    if (activeGroupId) {
      writeBannerToStorage(activeGroupId, id)
      try {
        await updateGroupBanner.mutateAsync({ groupId: activeGroupId, bannerId: id })
      } catch (error) {
        console.error('Could not sync banner to database', error)
      }
    }
    setShowBannerPicker(false)
  }

  const activeBanner = useMemo(() => BANNERS.find(b => b.id === savedBannerId) || BANNERS[0], [savedBannerId])
  const visibleGroups = useMemo(
    () => groups.filter((group) => (showArchived ? group.is_archived : !group.is_archived)),
    [groups, showArchived]
  )

  const handleUpdateGroup = async () => {
    if (!editGroupForm.name.trim()) return pushToast('Name is required.')
    try {
      setSaving('group-edit')
      await updateGroup.mutateAsync({ groupId: activeGroupId, name: editGroupForm.name })
      pushToast('Trip updated.')
      setShowEditGroup(false)
    } catch (error) {
      pushToast(toToastMessage(error, 'Operation failed.'))
    } finally {
      setSaving('')
    }
  }

  const handleToggleArchive = async (e, groupId, currentStatus) => {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    setSaving('archive')
    try {
      await toggleArchiveGroup.mutateAsync({ groupId, isArchived: !currentStatus })
      if (!currentStatus) setShowEditGroup(false)
      pushToast(!currentStatus ? 'Trip archived (Read Only).' : 'Trip restored.')
    } catch (err) {
      pushToast(toToastMessage(err, 'Could not toggle archive status.'))
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
    const safeName = String(activeGroup?.name || 'ledger').replace(/[^a-z0-9-_]+/gi, '_').slice(0, 60)
    downloadCsv(`kosha-trip-${safeName}.csv`, toCsv(headers, rows))
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

  const groupStats = useMemo(() => {
    let adminActive = 0
    let adminArchived = 0
    let memberActive = 0
    let memberArchived = 0

    groups.forEach((group) => {
      const isAdmin = group.my_role === 'admin' || group.user_id === authUserId
      if (isAdmin) {
        if (group.is_archived) adminArchived++
        else adminActive++
      } else {
        if (group.is_archived) memberArchived++
        else memberActive++
      }
    })

    return { adminActive, adminArchived, memberActive, memberArchived }
  }, [groups, authUserId])

  const schemaMissing = isSplitwiseSchemaMissing(error)
  const activeGroup = useMemo(
    () => groups.find((group) => group.id === activeGroupId) || null,
    [groups, activeGroupId]
  )

  const activeMembers = useMemo(() => {
    return (members || []).filter(member => {
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
      return memberRole !== 'left'
    })
  }, [members, activeGroup?.user_id, roleByUserId])

  const isGroupAdmin = !!activeGroup && !isViewingPartner && (activeGroup.my_role === 'admin' || activeGroup.user_id === authUserId)
  // If a group is archived, NO ONE can manage expenses/members unless they unarchive it first
  const canManageGroup = !!activeGroup && !activeGroup.is_archived && !isViewingPartner && (activeGroup.my_role === 'admin' || activeGroup.my_role === 'member' || activeGroup.user_id === authUserId)
  const isViewOnly = isViewingPartner || (!!activeGroup && !canManageGroup)
  const inviteTokenFromQuery = String(searchParams.get('splitInvite') || '').trim()

  const clearPendingSplitInviteToken = useCallback(() => {
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
  }, [inviteTokenFromQuery, searchParams, setSearchParams])

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
        const preview = await previewGroupInvite.mutateAsync(inviteToken)
        if (cancelled) return
        setInvitePreview({
          token: inviteToken,
          groupId: preview.group_id,
          groupName: preview.group_name,
          invitedRole: preview.invited_role || 'viewer',
        })
      } catch (previewError) {
        if (cancelled) return
        pushToast(toToastMessage(previewError, 'Could not open shared group invite.'))
        clearPendingSplitInviteToken()
      }
    }

    void previewInvite()
    return () => {
      cancelled = true
    }
  }, [inviteTokenFromQuery, searchParams, setSearchParams, consumingInvite, invitePreview?.token, clearPendingSplitInviteToken, previewGroupInvite, pushToast])

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
    if (saving) return
    const name = String(groupForm.name || '').trim()

    if (!name) {
      pushToast('Group name is required.')
      return
    }

    setSaving('group')
    try {
      const created = await createGroup.mutateAsync({ name, selfDisplayName: accountDisplayName })
      optimisticallyInsertSplitGroup({ ...created, my_role: 'admin' }, activeWalletUserId)
      setActiveGroupId(created.id)
      setGroupForm({ name: '' })
      setShowCreateGroup(false)
    } catch (createError) {
      pushToast(toToastMessage(createError, 'Could not create group.'))
    } finally {
      setSaving('')
    }
  }

  async function handleCreateGroupInvite() {
    if (!activeGroupId || !isGroupAdmin || saving) return

    setSaving('group-invite')
    try {
      const invite = await createGroupInvite.mutateAsync({ groupId: activeGroupId })
      const url = `${window.location.origin}/splitwise/join/${invite.token}`

      const result = await shareLink({
        title: 'Join Trip on Kosha',
        url: url,
      })

      if (result.success) {
        if (result.method === 'share') {
          // Already shared via native sheet
        } else {
          pushToast('Invite link copied.')
        }
      } else if (!result.aborted) {
        pushToast(url)
      }
    } catch (inviteError) {
      pushToast(toToastMessage(inviteError, 'Could not create group invite.'))
    } finally {
      setSaving('')
    }
  }

  function handleSettleUpClick() {
    if (!canManageGroup) return

    // Find if the current user owes something in the suggested transfers
    const myDebt = suggestedTransfers.find(t => t.from?.linked_user_id === authUserId)
    if (myDebt) {
      applySuggestedTransfer(myDebt)
      return
    }

    // Fallback: just open the sheet if no specific debt detected
    setShowSettlement(true)
  }

  async function handleConfirmInviteJoin() {
    if (!invitePreview?.token || consumingInvite) return

    setConsumingInvite(true)
    try {
      const joinedGroup = await consumeGroupInvite.mutateAsync(invitePreview.token)
      if (joinedGroup?.id) setActiveGroupId(joinedGroup.id)
      pushToast(`Joined ${joinedGroup?.name || invitePreview.groupName} as ${accountDisplayName}.`)
    } catch (consumeError) {
      pushToast(toToastMessage(consumeError, 'Could not join shared group invite.'))
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

    setSaving('group-delete')
    try {
      optimisticallyDeleteSplitGroup(activeGroupId, activeWalletUserId)
      await deleteGroup.mutateAsync(activeGroupId)
      pushToast('Group deleted.')
      setActiveGroupId('')
      closeSheets()
    } catch (deleteError) {
      pushToast(toToastMessage(deleteError, 'Could not delete group.'))
    } finally {
      setSaving('')
    }
  }

  async function handleSetMemberRole(member, role) {
    if (!isGroupAdmin || activeGroup?.is_archived) {
      pushToast('Only admins can change member roles.')
      return
    }

    if (!activeGroupId || !member?.linked_user_id) return

    setSaving(`member-role-${member.id}`)
    try {
      await setMemberRole.mutateAsync({
        groupId: activeGroupId,
        memberUserId: member.linked_user_id,
        role,
      })
      pushToast(role === 'admin' ? 'Member promoted to admin.' : role === 'member' ? 'Changed to member.' : 'Changed to viewer.')
    } catch (roleError) {
      pushToast(toToastMessage(roleError, 'Could not update member role.'))
    } finally {
      setSaving('')
    }
  }

  async function handleDeleteMember(memberId) {
    if (!isGroupAdmin || activeGroup?.is_archived || saving) return

    setSaving(`delete-${memberId}`)
    try {
      await deleteMember.mutateAsync(memberId)
      pushToast('Member removed.')
    } catch (err) {
      pushToast(toToastMessage(err, 'Could not remove member.'))
    } finally {
      setSaving('')
    }
  }

  async function handleLeaveGroup() {
    if (!activeGroupId || saving) return

    if (activeMembers.length <= 1) {
      if (window.confirm('You are the last member in this group. Would you like to delete the group entirely?')) {
        return handleDeleteGroup()
      }
      return
    }

    setSaving('group-leave')
    try {
      optimisticallyDeleteSplitGroup(activeGroupId, activeWalletUserId)
      await leaveGroup.mutateAsync(activeGroupId)
      pushToast('Left group.')
      setActiveGroupId('')
      closeSheets()
    } catch (err) {
      pushToast(toToastMessage(err, 'Could not leave group.'))
    } finally {
      setSaving('')
    }
  }

  async function handleAddMember() {
    if (!isGroupAdmin || saving) return
    const name = String(newMemberName || '').trim()
    if (!name) {
      pushToast('Name is required.')
      return
    }

    setSaving('add-member')
    try {
      await addMember.mutateAsync({ groupId: activeGroupId, displayName: name })
      pushToast('Member added.')
      setShowAddMember(false)
      setNewMemberName('')
    } catch (err) {
      pushToast(toToastMessage(err, 'Could not add member.'))
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
      const sumPaise = selectedMemberIds.reduce((sum, memberId) => sum + Math.round(Number(splitInputs[memberId]?.exact || 0) * 100), 0)
      const totalPaise = Math.round(amount * 100)
      if (sumPaise !== totalPaise) {
        throw new Error(`Exact splits must add up to the full amount. (Sum: ${sumPaise / 100}, Total: ${totalPaise / 100})`)
      }

      return buildExactSplits(
        selectedMemberIds.map((memberId) => ({
          member_id: memberId,
          share: Number(splitInputs[memberId]?.exact || 0),
        })),
        amount
      )
    }

    if (method === 'percent') {
      const sumBasisPoints = selectedMemberIds.reduce((sum, memberId) => sum + Math.round(Number(splitInputs[memberId]?.percent || 0) * 100), 0)
      if (sumBasisPoints !== 10000) {
        throw new Error(`Percentage splits must total exactly 100%. (Current: ${sumBasisPoints / 100}%)`)
      }

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
    if (!canManageGroup || saving) {
      if (saving) return
      pushToast('You have view-only access for this group.')
      return
    }

    if (!activeGroupId) {
      pushToast('Select a group first.')
      return
    }

    const description = String(expenseForm.description || '').trim()
    const amount = round2(expenseForm.amount)

    if (!description) {
      pushToast('Expense description is required.')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      pushToast('Expense amount must be positive.')
      return
    }
    if (!expenseForm.paid_by_member_id) {
      pushToast('Select who paid for this expense.')
      return
    }

    let splits
    try {
      splits = buildSplitsPayload(expenseForm.split_method, amount)
    } catch (splitError) {
      pushToast(toToastMessage(splitError, 'Invalid split configuration.'))
      return
    }

    if (actionGuard.current) return
    actionGuard.current = true

    setSaving(editExpense ? 'expense-edit' : 'expense')
    try {
      if (editExpense) {
        // Atomic edit: a single RPC updates the expense, its splits, and the
        // linked transaction in one Postgres transaction. The old
        // delete-then-create path could permanently drop the original if the
        // re-create failed.
        await updateExpense.mutateAsync({
          expenseId: editExpense.id,
          groupId: activeGroupId,
          paidByMemberId: expenseForm.paid_by_member_id,
          description,
          amount,
          expenseDate: expenseForm.expense_date,
          splitMethod: expenseForm.split_method,
          notes: expenseForm.notes,
          splits,
          transactionCategory: expenseForm.transaction_category,
        })
      } else {
        await addExpense.mutateAsync({
          groupId: activeGroupId,
          paidByMemberId: expenseForm.paid_by_member_id,
          description,
          amount,
          expenseDate: expenseForm.expense_date,
          splitMethod: expenseForm.split_method,
          notes: expenseForm.notes,
          splits,
          transactionCategory: expenseForm.transaction_category,
        })
      }

      setExpenseForm((prev) => ({
        ...prev,
        description: '',
        amount: '',
        notes: '',
        transaction_category: 'other',
      }))
      setEditExpense(null)
      setShowAddExpense(false)
      pushToast(editExpense ? 'Expense updated.' : 'Expense added.')
    } catch (expenseError) {
      pushToast(toToastMessage(expenseError, 'Could not save expense.'))
    } finally {
      setSaving('')
      actionGuard.current = false
    }
  }

  async function handleRecordSettlement() {
    if (!canManageGroup || saving) {
      if (saving) return
      pushToast('You have view-only access for this group.')
      return
    }

    if (!activeGroupId) {
      pushToast('Select a group first.')
      return
    }

    const amount = round2(settlementForm.amount)
    if (!settlementForm.payer_member_id || !settlementForm.payee_member_id) {
      pushToast('Select both payer and payee.')
      return
    }
    if (settlementForm.payer_member_id === settlementForm.payee_member_id) {
      pushToast('Payer and payee cannot be the same.')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      pushToast('Settlement amount must be positive.')
      return
    }

    const expenseCurrencies = new Set(expenses.map(e => String(e.currency_code || 'INR').toUpperCase()))
    const settlementCurrency = String(settlementForm.currency_code || 'INR').toUpperCase()
    if (expenseCurrencies.size > 0 && !expenseCurrencies.has(settlementCurrency) && !expenseCurrencies.has('INR')) {
      pushToast(`Cross-currency settle-up not supported. Expenses are in ${[...expenseCurrencies].join(', ')}`)
      return
    }

    if (actionGuard.current) return
    actionGuard.current = true

    setSaving(editSettlement ? 'settlement-edit' : 'settlement')
    try {
      await recordSettlement.mutateAsync({
        groupId: activeGroupId,
        payerMemberId: settlementForm.payer_member_id,
        payeeMemberId: settlementForm.payee_member_id,
        amount,
        settledAt: settlementForm.settled_at,
        note: settlementForm.note,
      })

      if (editSettlement) {
        await deleteSettlement.mutateAsync(editSettlement.id)
      }
      setSettlementForm((prev) => ({
        ...prev,
        amount: '',
        note: '',
      }))
      setEditSettlement(null)
      setShowSettlement(false)
      pushToast('Settlement recorded.')
    } catch (settlementError) {
      pushToast(toToastMessage(settlementError, 'Could not record settlement.'))
    } finally {
      setSaving('')
      actionGuard.current = false
    }
  }

  function openEditExpense(expense) {
    if (!canManageGroup) return
    setEditExpense(expense)
    setExpenseForm({
      description: expense.description || '',
      amount: String(expense.amount || ''),
      expense_date: expense.expense_date || todayStr(),
      paid_by_member_id: expense.paid_by_member_id || '',
      split_method: expense.split_method || 'equal',
      notes: expense.notes || '',
      transaction_category: expense.transactions?.category || 'other',
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
      settled_at: s.settled_at || todayStr(),
      note: s.note || '',
    })
    setShowSettlement(true)
  }


  async function handleDeleteExpense(expenseId) {
    if (!canManageGroup) {
      pushToast('You have view-only access for this group.')
      return
    }
    if (!expenseId) return

    const expense = expenses.find(e => e.id === expenseId)
    if (!expense) return

    // If a different expense is already pending deletion, commit it immediately
    // so we don't silently drop an action the user hasn't undone.
    const prevPending = pendingExpenseDeleteRef.current
    if (prevPending?.timerId && prevPending.expenseId !== expenseId) {
      clearTimeout(prevPending.timerId)
      pendingExpenseDeleteRef.current = null
      try {
        await deleteExpense.mutateAsync(prevPending.expenseId)
      } catch (err) {
        optimisticallyInsertSplitExpense(prevPending.groupId, prevPending.expense)
        pushToast(toToastMessage(err, 'Could not delete expense.'))
      }
    }

    // Capture current group so the closure stays correct if the user switches groups.
    const gid = activeGroupId

    // Optimistic remove — UI updates instantly.
    optimisticallyDeleteSplitExpense(gid, expenseId)

    // Build a contextual message: "Expense deleted for 3 members."
    const splitCount = expense.split_expense_splits?.length ?? 0
    const memberLabel = splitCount > 1 ? `${splitCount} members` : 'the group'

    const timerId = setTimeout(async () => {
      pendingExpenseDeleteRef.current = null
      try {
        await deleteExpense.mutateAsync(expenseId)
      } catch (err) {
        // RPC failed — restore the item so the user doesn't lose data.
        optimisticallyInsertSplitExpense(gid, expense)
        pushToast(toToastMessage(err, 'Could not delete expense.'))
      }
    }, 7000)

    pendingExpenseDeleteRef.current = { expenseId, expense, groupId: gid, timerId }

    pushToast(`Expense deleted for ${memberLabel}.`, {
      action: () => {
        clearTimeout(timerId)
        pendingExpenseDeleteRef.current = null
        optimisticallyInsertSplitExpense(gid, expense)
      },
      actionLabel: 'Undo',
      duration: 7500,
    })
  }

  async function handleDeleteSettlement(settlementId) {
    if (!canManageGroup) {
      pushToast('You have view-only access for this group.')
      return
    }
    if (!settlementId) return

    const settlement = settlements.find(s => s.id === settlementId)
    if (!settlement) return

    // Commit any other pending settlement deletion first.
    const prevPending = pendingSettlementDeleteRef.current
    if (prevPending?.timerId && prevPending.settlementId !== settlementId) {
      clearTimeout(prevPending.timerId)
      pendingSettlementDeleteRef.current = null
      try {
        await deleteSettlement.mutateAsync(prevPending.settlementId)
      } catch (err) {
        optimisticallyInsertSplitSettlement(prevPending.groupId, prevPending.settlement)
        pushToast(toToastMessage(err, 'Could not delete settlement.'))
      }
    }

    const gid = activeGroupId

    // Optimistic remove.
    optimisticallyDeleteSplitSettlement(gid, settlementId)

    const timerId = setTimeout(async () => {
      pendingSettlementDeleteRef.current = null
      try {
        await deleteSettlement.mutateAsync(settlementId)
      } catch (err) {
        optimisticallyInsertSplitSettlement(gid, settlement)
        pushToast(toToastMessage(err, 'Could not delete settlement.'))
      }
    }, 7000)

    pendingSettlementDeleteRef.current = { settlementId, settlement, groupId: gid, timerId }

    pushToast('Settlement deleted.', {
      action: () => {
        clearTimeout(timerId)
        pendingSettlementDeleteRef.current = null
        optimisticallyInsertSplitSettlement(gid, settlement)
      },
      actionLabel: 'Undo',
      duration: 7500,
    })
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
      ...(expenses || []).map(e => ({ ...e, type: 'expense', sortValue: new Date(e.expense_date || e.created_at).getTime() })),
      ...(settlements || []).map(s => ({ ...s, type: 'settlement', sortValue: new Date(s.settled_at || s.created_at).getTime() }))
    ]
    return list.sort((a, b) => b.sortValue - a.sortValue)
  }, [expenses, settlements])

  const memberSpendingStats = useMemo(() => {
    if (!activeMembers.length) return []
    return activeMembers.map(member => {
      const spent = (expenses || []).filter(e => e.paid_by_member_id === member.id).reduce((sum, e) => sum + Number(e.amount), 0)
      const percent = totalExpenses > 0 ? (spent / totalExpenses) * 100 : 0
      return { member, spent, percent }
    })
  }, [activeMembers, expenses, totalExpenses])

  const {
    containerRef: txnsListRef,
    startIndex: txnsStartIndex,
    endIndex: txnsEndIndex,
    topPadding: txnsTopPadding,
    bottomPadding: txnsBottomPadding,
    measureElement: measureTxnElement,
  } = useWindowedList({
    count: transactions.length,
    estimateSize: 76,
    overscan: 10,
    enabled: false,
    resetKey: `${activeGroupId}`,
  })

  const renderedTransactions = useMemo(
    () => transactions.slice(txnsStartIndex, txnsEndIndex),
    [transactions, txnsStartIndex, txnsEndIndex]
  )

  // Match the keyboard/focus handling of the other bottom sheets (AddTransactionSheet).
  // On touch this focuses the sheet container instead of auto-popping the keyboard, and
  // restores focus with preventScroll on close — without it, focusing an input scrolls
  // the page and leaves the composited fixed bottom-nav displaced after the keyboard hides.

  return {
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
    activeWalletUserId, authUserId, pendingExpenseDeleteRef, pendingSettlementDeleteRef,
    roleByUserId, memberById, openEditExpense, openEditSettlement, memberSpendingStats, txnsListRef,
    txnsTopPadding, txnsBottomPadding, measureTxnElement, renderedTransactions, txnsStartIndex,
    transactions
  }
}
