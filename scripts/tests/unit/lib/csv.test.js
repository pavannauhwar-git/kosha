import { describe, it, expect } from 'vitest'
import { toCsv } from '../../../../src/lib/csv'

describe('toCsv', () => {
  it('quotes every cell, doubles inner quotes and uses CRLF rows', () => {
    expect(toCsv(['Name', 'Note'], [['Tea', 'said "hi"'], [null, 250]]))
      .toBe('"Name","Note"\r\n"Tea","said ""hi"""\r\n"","250"')
  })

  it('stops spreadsheets running cells as formulas', () => {
    const csv = toCsv(['Cell'], [['=HYPERLINK("http://x")'], ['+1+1'], ['@SUM(A1)'], ['\tcmd'], ['\rcmd']])
    expect(csv.split('\r\n').slice(1)).toEqual([
      '"\'=HYPERLINK(""http://x"")"',
      '"\'+1+1"',
      '"\'@SUM(A1)"',
      '"\'\tcmd"',
      '"\'\rcmd"',
    ])
  })
})
