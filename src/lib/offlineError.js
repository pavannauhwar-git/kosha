export class OfflineError extends Error {
  constructor(message = "You're offline. Connect to the internet and try again.") {
    super(message)
    this.name = 'OfflineError'
    this.code = 'OFFLINE'
  }
}

export function assertOnline() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new OfflineError()
}
