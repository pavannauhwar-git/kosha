import { fromRupees } from './paise.js';

// Money columns are numeric(12,2): at most 10 digits before the decimal point.
export const MAX_AMOUNT = 9999999999.99;

// Cleans what people type or paste into an amount field ("₹1,23,456.50",
// "Rs. 1,250", "1 250") down to a plain decimal string. Returns null when the
// result still isn't one, so the field can ignore that keystroke.
export function sanitizeAmountInput(raw) {
  let str = String(raw ?? '')
    .trim()
    .replace(/^(₹|rs\.?|inr)\s*/i, '')
    .replace(/[\s,\u00a0]/g, '');
  if (str.startsWith('+')) str = str.slice(1);
  return /^[0-9]*\.?[0-9]*$/.test(str) ? str : null;
}

export function validateAmount(input, options = {}) {
  const { min = -Infinity, max = Infinity, allowZero = true } = options;

  if (input === null || input === undefined) {
    return { ok: false, error: 'Amount is required' };
  }

  const rawStr = String(input).trim();

  if (rawStr === '') {
    return { ok: false, error: 'Amount is required' };
  }

  if (rawStr.toLowerCase().includes('e') || rawStr.startsWith('+')) {
    return { ok: false, error: 'Invalid amount format' };
  }

  // Accept grouped numbers (Western "1,234.56" and Indian "1,23,456.78") by
  // stripping grouping commas before parsing. Only commas that sit between
  // digits are removed, so stray commas still fail the Number() check below.
  const str = rawStr.replace(/(?<=\d),(?=\d)/g, '');

  const parts = str.split('.');
  if (parts.length > 2) {
    return { ok: false, error: 'Invalid amount format' };
  }
  if (parts.length === 2 && parts[1].length > 2) {
    return { ok: false, error: 'Maximum 2 decimal places allowed' };
  }

  const num = Number(str);
  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return { ok: false, error: 'Invalid number' };
  }

  if (!allowZero && num === 0) {
    return { ok: false, error: 'Amount cannot be zero' };
  }

  if (num < min) {
    return { ok: false, error: `Amount cannot be less than ${min}` };
  }

  if (num > max) {
    return { ok: false, error: `Amount cannot be greater than ${max}` };
  }

  if (Math.abs(num) > MAX_AMOUNT) {
    return { ok: false, error: 'Amount is too large (the limit is ₹999 crore)' };
  }

  return { ok: true, paise: fromRupees(num) };
}
