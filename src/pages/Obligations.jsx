import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeaderPage from '../components/layout/PageHeaderPage'
import Bills from '../components/obligations/Bills'
import Loans from '../components/obligations/Loans'

const TABS = [
  { key: 'bills', label: 'Bills' },
  { key: 'loans', label: 'Loans' },
]

function resolveTab(value) {
  const raw = String(value || '').trim().toLowerCase()
  return raw === 'loans' ? 'loans' : 'bills'
}

export default function Obligations() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tab = resolveTab(searchParams.get('tab'))

  const tabSubtitle = useMemo(() => {
    if (tab === 'loans') return 'Track given/taken loans and settlements.'
    return 'Track bills, due dates, and payment status.'
  }, [tab])

  function handleTabChange(nextTab) {
    if (nextTab === tab) return
    const next = new URLSearchParams(searchParams)
    next.set('tab', nextTab)
    setSearchParams(next, { replace: true })
  }

  return (
    <PageHeaderPage title="Obligations">
      <div className="sticky-toolbar mb-2">
        <div className="grid grid-cols-2 gap-2 rounded-card bg-kosha-surface p-1">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => handleTabChange(item.key)}
              className={`h-9 rounded-card text-[12px] font-semibold transition-all active:scale-[0.98] ${tab === item.key
                  ? 'bg-brand-dark text-white shadow-card'
                  : 'text-ink-3 hover:text-ink'
                }`}
              aria-pressed={tab === item.key}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-ink-3">{tabSubtitle}</p>
      </div>

      <div className="pt-1">
        {tab === 'loans' ? <Loans embedded /> : <Bills embedded tabParam="billsTab" />}
      </div>
    </PageHeaderPage>
  )
}
