import { fromRupees } from './paise.js';

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

  return { ok: true, paise: fromRupees(num) };
}
