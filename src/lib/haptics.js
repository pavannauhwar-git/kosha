export function hapticTap() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(10) } catch(e){}
  }
}

export function hapticSuccess() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate([15, 50, 15]) } catch(e){}
  }
}

export function hapticHeavy() {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try { navigator.vibrate(20) } catch(e){}
  }
}
