export function hapticTap() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(10) } catch {}
  }
}

export function hapticSuccess() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate([15, 50, 15]) } catch {}
  }
}

export function hapticHeavy() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(20) } catch {}
  }
}

export function hapticError() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate([40, 60, 40, 60, 40]) } catch {}
  }
}

export function hapticWarning() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate([25, 40, 25]) } catch {}
  }
}

export function hapticSelection() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(5) } catch {}
  }
}
