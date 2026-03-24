const REMINDER_PREFS_KEY = 'kosha:reminder-prefs-v1'
const REMINDER_SENT_PREFIX = 'kosha:reminder-sent:'

const DEFAULT_PREFS = {
  enabled: false,
  bill_due: true,
  spending_pace: true,
}

function readJson(key) {
  try {
    const raw = localStorage.getItem(key)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore storage failures
  }
}

export function getReminderPrefs() {
  const stored = readJson(REMINDER_PREFS_KEY)
  return { ...DEFAULT_PREFS, ...(stored || {}) }
}

export function setReminderPrefs(nextPrefs) {
  writeJson(REMINDER_PREFS_KEY, nextPrefs)
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
  try {
    const raw = localStorage.getItem(reminderStorageKey(id))
    if (!raw) return false
    const lastTs = Number(raw)
    if (!Number.isFinite(lastTs)) return false
    return Date.now() - lastTs < cooldownMs
  } catch {
    return false
  }
}

function markSent(id) {
  try {
    localStorage.setItem(reminderStorageKey(id), String(Date.now()))
  } catch {
    // ignore storage failures
  }
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
