const APP_URL = process.env.APP_URL || 'https://kosha-gamma.vercel.app'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function absolute(base, rel) {
  if (rel.startsWith('http://') || rel.startsWith('https://')) return rel
  return `${base.replace(/\/$/, '')}${rel.startsWith('/') ? '' : '/'}${rel}`
}

async function fetchText(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Fetch failed for ${url} (${res.status})`)
  return res.text()
}

async function main() {
  const html = await fetchText(APP_URL)

  const assetMatches = [...html.matchAll(/(?:src|href)=\"([^\"]*\/assets\/[^\"]+\.(?:js|css))\"/g)]
  const assetPaths = [...new Set(assetMatches.map((m) => m[1]))]

  assert(assetPaths.length > 0, '[production-assets] No bundled assets found in app HTML')

  const jsAssets = assetPaths.filter((p) => p.endsWith('.js')).slice(0, 6)
  assert(jsAssets.length > 0, '[production-assets] No JS assets detected')

  for (const rel of jsAssets) {
    const url = absolute(APP_URL, rel)
    const res = await fetch(url)
    assert(res.ok, `[production-assets] Asset fetch failed ${url} (${res.status})`)
    const ct = (res.headers.get('content-type') || '').toLowerCase()
    assert(
      ct.includes('javascript') || ct.includes('ecmascript') || ct.includes('text/plain'),
      `[production-assets] Unexpected JS asset content-type for ${url}: ${ct}`
    )
  }

  console.log(`[production-assets] PASS (${APP_URL})`)
  console.log('[production-assets] Manual step: after deploy, open browser devtools -> Application -> Service Workers -> Unregister once, then hard refresh.')
}

main().catch((error) => {
  console.error('FAIL: test:production-assets')
  console.error(error.message)
  process.exit(1)
})
