import { divEvenly, fromRupees, toRupees } from '../../src/lib/paise.js'
import { safeNumber } from '../../src/lib/safeNumber.js'
import { validateAmount } from '../../src/lib/validateAmount.js'

let exitCode = 0

function assertEq(name, actual, expected) {
  const aStr = String(actual)
  const eStr = String(expected)
  if (aStr !== eStr) {
    console.error(`FAIL: ${name}. Expected ${eStr}, got ${aStr}`)
    exitCode = 1
  } else {
    console.log(`PASS: ${name}`)
  }
}

function testPaise() {
  console.log('--- Testing paise.js ---')
  // paise.divEvenly(100, 3) -> [34, 33, 33] (sum = 100)
  const p1 = divEvenly(100n, 3)
  assertEq('divEvenly 100/3', p1.join(','), '34,33,33')

  // paise.divEvenly(-100, 3) -> [-34, -33, -33] (sum = -100)
  const p2 = divEvenly(-100n, 3)
  assertEq('divEvenly -100/3', p2.join(','), '-34,-33,-33')
  
  assertEq('fromRupees("1.23")', fromRupees('1.23'), 123n)
  assertEq('toRupees(123n)', toRupees(123n), 1.23)
}

function testSafeNumber() {
  console.log('--- Testing safeNumber.js ---')
  assertEq('safeNumber(Infinity, 0)', safeNumber(Infinity, 0), 0)
  assertEq('safeNumber(NaN, 0)', safeNumber(NaN, 0), 0)
  assertEq('safeNumber(42)', safeNumber(42), 42)
}

function testValidateAmount() {
  console.log('--- Testing validateAmount.js ---')
  assertEq("validateAmount('1e9')", validateAmount('1e9').ok, false)
  assertEq("validateAmount('1.234')", validateAmount('1.234').ok, false)
  
  const v1 = validateAmount('100.50')
  assertEq("validateAmount('100.50') ok", v1.ok, true)
  assertEq("validateAmount('100.50') paise", v1.paise, 10050n)
}

try {
  console.log('Running Money Math Tests...')
  testPaise()
  testSafeNumber()
  testValidateAmount()
  process.exit(exitCode)
} catch (err) {
  console.error('Unhandled error:', err)
  process.exit(1)
}
