import {
  buildLearnedStatementAliases,
  parseStatementLines,
  matchStatementEntries,
} from '../../src/lib/statementMatching.js'

function assert(condition, message) {
  if (!condition) throw new Error(message)
}

function testParse() {
  const parsed = parseStatementLines([
    '24/03/2026, UPI/DR SWIGGY INSTAMART, 542.00',
    '2026-03-22 | SALARY ACME LTD | 50000',
    'invalid line',
  ].join('\n'))

  assert(parsed.length === 3, 'should parse all non-empty lines')
  assert(parsed[0].isValid, 'first statement line should be valid')
  assert(parsed[0].date === '2026-03-24', 'first statement date should parse as DMY')
  assert(parsed[0].amount === 542, 'first amount should parse')
  assert(parsed[1].direction === 'credit', 'salary line should infer credit direction')
  assert(parsed[2].isValid === false, 'invalid line should be marked invalid')
}

function testMatching() {
  const entries = parseStatementLines([
    '24/03/2026, UPI/DR SWIGGY INSTAMART, 542.00',
    '2026-03-22 | SALARY ACME LTD | 50000',
  ].join('\n'))

  const txns = [
    {
      id: 't1',
      date: '2026-03-24',
      amount: 542,
      type: 'expense',
      description: 'Swiggy Instamart',
    },
    {
      id: 't2',
      date: '2026-03-22',
      amount: 50000,
      type: 'income',
      description: 'Salary ACME',
    },
    {
      id: 't3',
      date: '2026-03-24',
      amount: 542,
      type: 'income',
      description: 'Gift from friend',
    },
  ]

  const matches = matchStatementEntries(entries, txns)

  assert(matches[0].best?.txn?.id === 't1', 'swiggy line should match swiggy expense transaction')
  assert(matches[0].confidence !== 'low', 'swiggy match should not be low confidence')

  assert(matches[1].best?.txn?.id === 't2', 'salary line should match income salary transaction')
  assert(matches[1].best?.txn?.id !== 't3', 'direction/type scoring should avoid wrong income candidate')
}

function testLearnedAliasMatching() {
  const txns = [
    {
      id: 't100',
      date: '2026-03-20',
      amount: 999,
      type: 'expense',
      description: 'Swiggy Instamart',
    },
  ]

  const reviewRows = [
    {
      status: 'linked',
      statement_line: '20/03/2026, BLINKBASKET ONLINE, 999.00',
      transaction_id: 't100',
    },
  ]

  const aliases = buildLearnedStatementAliases(reviewRows, txns)
  const entries = parseStatementLines('24/03/2026, BLINKBASKET ORDER, 999.00')
  const matches = matchStatementEntries(entries, txns, { aliases })

  assert(matches[0].best?.txn?.id === 't100', 'learned alias should help map similar merchant strings')
}

function main() {
  testParse()
  testMatching()
  testLearnedAliasMatching()
  console.log('PASS: statement matching heuristics are stable.')
}

main()
