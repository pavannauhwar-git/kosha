// One set of due-date buckets for every bills screen.
//   overdue: due date has passed (days < 0)
//   dueSoon: due today or within the next 7 days (0..7)
//   later:   everything else, including bills with no usable due date
export const DUE_SOON_DAYS = 7

export function billBucket(days) {
  if (days === null || days === undefined || !Number.isFinite(days)) return 'later'
  if (days < 0) return 'overdue'
  if (days <= DUE_SOON_DAYS) return 'dueSoon'
  return 'later'
}

export function summarizeBillBuckets(bills, getDays) {
  const summary = {
    overdue: { count: 0, amount: 0 },
    dueSoon: { count: 0, amount: 0 },
    later: { count: 0, amount: 0 },
    total: { count: 0, amount: 0 },
  }
  for (const bill of Array.isArray(bills) ? bills : []) {
    const amount = Number(bill?.amount || 0)
    const safeAmount = Number.isFinite(amount) ? amount : 0
    const bucket = summary[billBucket(getDays(bill))]
    bucket.count += 1
    bucket.amount += safeAmount
    summary.total.count += 1
    summary.total.amount += safeAmount
  }
  for (const key of Object.keys(summary)) {
    summary[key].amount = Math.round(summary[key].amount * 100) / 100
  }
  return summary
}

// 0..100. An overdue bill weighs twice a bill due this week; 100 means every
// pending bill is overdue.
export function duePressureScore({ overdue = 0, dueSoon = 0, total = 0 } = {}) {
  if (!(total > 0)) return 0
  const weighted = (overdue * 2) + dueSoon
  return Math.min(100, Math.max(0, Math.round((weighted / (total * 2)) * 100)))
}
