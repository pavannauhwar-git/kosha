import { readLocalJson, readLocalStorage, writeLocalJson, writeLocalStorage } from './safeStorage.js'

const REMINDER_PREFS_KEY = 'kosha:reminder-prefs-v1'
const REMINDER_SENT_PREFIX = 'kosha:reminder-sent:'
export const REMINDER_PREFS_EVENT = 'kosha:reminder-prefs-updated'

const DEFAULT_PREFS = {
  enabled: false,
  bill_due: true,
  spending_pace: true,
}

export function getReminderPrefs() {
  const stored = readLocalJson(REMINDER_PREFS_KEY, null)
  return { ...DEFAULT_PREFS, ...(stored || {}) }
}

export function setReminderPrefs(nextPrefs) {
  writeLocalJson(REMINDER_PREFS_KEY, nextPrefs)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(REMINDER_PREFS_EVENT, { detail: nextPrefs }))
  }
}

export function canUseNotifications() {
  return typeof window !== 'undefined' && 'Notification' in window
}

export function getNotificationPermission() {
  if (!canUseNotifications()) return 'unsupported'
  return Notification.permission
}

export async function requestNotificationPermission() {
  if (!canUseNotifications()) return 'unsupported'
  try {
    const result = await Notification.requestPermission()
    return result
  } catch {
    return 'denied'
  }
}

function reminderStorageKey(id) {
  return `${REMINDER_SENT_PREFIX}${id}`
}

function wasSentWithin(id, cooldownMs) {
  const raw = readLocalStorage(reminderStorageKey(id), null)
  if (!raw) return false
  const lastTs = Number(raw)
  if (!Number.isFinite(lastTs)) return false
  return Date.now() - lastTs < cooldownMs
}

function markSent(id) {
  writeLocalStorage(reminderStorageKey(id), String(Date.now()))
}

export function maybeNotify({ id, title, body, cooldownMs = 24 * 60 * 60 * 1000 }) {
  if (!canUseNotifications()) return false
  if (Notification.permission !== 'granted') return false
  if (!id || !title || !body) return false
  if (wasSentWithin(id, cooldownMs)) return false

  try {
    const note = new Notification(title, { body })
    note.onclick = () => {
      try {
        window.focus()
      } catch {
        // ignore
      }
      note.close()
    }
    markSent(id)
    return true
  } catch {
    return false
  }
}
