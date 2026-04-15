export async function copyToClipboard(text) {
  // 1. Try modern Clipboard API
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return { success: true, method: 'clipboard' }
    } catch (err) {
      // Fall through to legacy
    }
  }

  // 2. Legacy Fallback: document.execCommand('copy')
  // This is more reliable in non-secure contexts and some mobile browsers
  try {
    const textArea = document.createElement('textarea')
    textArea.value = text
    // Ensure the textarea is not visible but part of the DOM
    textArea.style.position = 'fixed'
    textArea.style.left = '-9999px'
    textArea.style.top = '0'
    textArea.style.opacity = '0'
    document.body.appendChild(textArea)
    textArea.focus()
    textArea.select()
    const successful = document.execCommand('copy')
    document.body.removeChild(textArea)
    if (successful) {
      return { success: true, method: 'legacy' }
    }
  } catch (err) {
    // Both methods failed
  }

  return { success: false, method: 'none' }
}

/**
 * Attempts to use the Web Share API on mobile, 
 * otherwise falls back to copying the link to clipboard.
 */
export async function shareLink({ title, text, url }) {
  // Try Web Share API first (best for mobile)
  if (typeof navigator !== 'undefined' && navigator.share) {
    const shareData = { url }
    if (title) shareData.title = title
    if (text) shareData.text = text

    try {
      await navigator.share(shareData)
      return { success: true, method: 'share' }
    } catch (err) {
      if (err.name === 'AbortError') {
        return { success: false, method: 'share', aborted: true }
      }
      // Fall through if share fails
    }
  }

  // Fallback to clipboard
  return await copyToClipboard(url)
}
