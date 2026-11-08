// Runs `task` once after calls stop for `delayMs`. Every caller's promise
// resolves when that single run finishes, including callers whose timer was
// replaced by a later call.
export function createDebouncedTask(task, delayMs) {
  let timer = null
  let waiters = []
  return function schedule() {
    if (timer) clearTimeout(timer)
    return new Promise((resolve) => {
      waiters.push(resolve)
      timer = setTimeout(async () => {
        timer = null
        const pending = waiters
        waiters = []
        try {
          await task()
        } catch (error) {
          console.warn('[Kosha] debounced refresh failed', error)
        }
        for (const done of pending) done()
      }, delayMs)
    })
  }
}
