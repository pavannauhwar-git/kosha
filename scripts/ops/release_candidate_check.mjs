import { spawn } from 'node:child_process'

const CHECKS = [
  { label: 'Build', command: ['npm', ['run', 'build']] },
  { label: 'Unit tests', command: ['npm', ['run', 'test:unit', '--', '--run']] },
  { label: 'Offline scripts', command: ['npm', ['run', 'test:no-network']] },
  { label: 'Mutation integration', command: ['npm', ['run', 'lint:mutation-integration']] },
  { label: 'Splitwise mutation paths', command: ['npm', ['run', 'lint:splitwise-mutation-paths']] },
  { label: 'Splitwise viewer invite flow', command: ['npm', ['run', 'test:splitwise-viewer-invite-flow']] },
  { label: 'Statement matching', command: ['npm', ['run', 'test:statement-matching']] },
  { label: 'Reconciliation flow', command: ['npm', ['run', 'test:reconciliation-flow']] },
  { label: 'Deploy readiness', command: ['npm', ['run', 'test:deploy-readiness']] },
  { label: 'Reconciliation schema live', command: ['npm', ['run', 'test:reconciliation-schema-live']] },
  { label: 'RLS partner isolation', command: ['npm', ['run', 'test:rls-partner-isolation']] },
  { label: 'Join flow', command: ['npm', ['run', 'test:join-flow']], retries: 2 },
  { label: 'Liabilities realtime', command: ['npm', ['run', 'test:liabilities-realtime']], retries: 3 },
  { label: 'Mutation stress', command: ['npm', ['run', 'test:mutation-stress']] },
]

function runCommand(cmd, args) {
  return new Promise((resolve) => {
    const startedAt = Date.now()
    const child = spawn(cmd, args, { stdio: 'inherit', shell: false })

    child.on('close', (code) => {
      resolve({
        code: code ?? 1,
        durationMs: Date.now() - startedAt,
      })
    })

    child.on('error', () => {
      resolve({
        code: 1,
        durationMs: Date.now() - startedAt,
      })
    })
  })
}

function fmtMs(ms) {
  const sec = Math.round(ms / 1000)
  return `${sec}s`
}

async function main() {
  console.log('Kosha release-candidate verification started...')
  console.log('')

  const summary = []

  for (const check of CHECKS) {
    console.log(`=== ${check.label} ===`)
    const [cmd, args] = check.command
    const maxAttempts = Math.max(1, Number(check.retries ?? 1))
    let result = null

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      if (attempt > 1) {
        console.log(`Retrying ${check.label} (${attempt}/${maxAttempts})...`)
      }

      result = await runCommand(cmd, args)
      if (result.code === 0) break

      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 1200))
      }
    }

    const ok = result?.code === 0
    summary.push({
      label: check.label,
      ok,
      durationMs: result?.durationMs || 0,
      code: result?.code ?? 1,
    })

    if (!ok) {
      console.log('')
      console.error(`FAILED: ${check.label} (exit code ${result.code})`)
      break
    }

    console.log('')
  }

  console.log('--- Release Candidate Summary ---')
  for (const row of summary) {
    const status = row.ok ? 'PASS' : 'FAIL'
    console.log(`${status} | ${row.label} | ${fmtMs(row.durationMs)}`)
  }

  const passedAll = summary.length === CHECKS.length && summary.every((r) => r.ok)

  if (passedAll) {
    console.log('')
    console.log('PASS: release candidate verification completed successfully.')
    return
  }

  const failed = summary.find((r) => !r.ok)
  throw new Error(`Release candidate verification failed at: ${failed?.label || 'unknown check'}`)
}

main().catch((error) => {
  console.error('')
  console.error('FAIL: release-candidate-check')
  console.error(error.message)
  process.exit(1)
})
